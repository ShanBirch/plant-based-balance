/**
 * Signal detectors — shared by the three daily pulses (morning/lunch/evening).
 *
 * Each detector takes { supabaseQuery, coachId, clientScope, excludeIds, opts }
 * and returns Array<AlertDraft>.
 *
 * AlertDraft shape (matches coach_alerts row, less coach_id/pulse_origin which
 * the runner adds):
 *   { client_id, client_name, alert_type, priority, title, description, data }
 *
 * Consumed by _lib/pulse-runner.js. The runner handles ALL cross-cutting
 * concerns (test account filter, recentlyContacted gate, dormant suppression,
 * 48h pulse cooldown, dedup against pending alerts, Vertex drafting, push
 * dispatch) — detectors are pure "look at the data and raise flags".
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const DAY_NAMES = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

function inScope(userId, excludeIds, clientScope) {
    if (excludeIds && excludeIds.has(userId)) return false;
    if (clientScope && !clientScope.has(userId)) return false;
    return true;
}

function iso(daysAgo = 0) {
    return new Date(Date.now() - daysAgo * DAY_MS).toISOString();
}

function nameOf(user) {
    return user?.name || user?.email?.split('@')[0] || 'Client';
}

// ============================================================
// Inactive client — no login in N days
// ============================================================

async function detectInactiveClients({ supabaseQuery, excludeIds, clientScope, opts = {} }) {
    const alerts = [];
    const inactiveDays = opts.inactiveDays || 2;
    const users = await supabaseQuery('users?select=id,name,email,last_login,program_start_date&order=last_login.desc&limit=500').catch(() => []);

    for (const user of users) {
        if (!user.last_login) continue;
        if (!inScope(user.id, excludeIds, clientScope)) continue;

        const daysSince = Math.floor((Date.now() - new Date(user.last_login)) / DAY_MS);
        if (daysSince < inactiveDays || daysSince > 14) continue;

        const existing = await supabaseQuery(
            `coach_alerts?client_id=eq.${user.id}&alert_type=eq.inactive_client&status=eq.pending&created_at=gte.${iso(1)}&limit=1`
        ).catch(() => []);
        if (existing.length) continue;

        const priority = daysSince >= 5 ? 'high' : daysSince >= 3 ? 'medium' : 'low';
        alerts.push({
            client_id: user.id,
            client_name: nameOf(user),
            alert_type: 'inactive_client',
            priority,
            title: `${nameOf(user)} hasn't been active for ${daysSince} days`,
            description: `Last login: ${new Date(user.last_login).toLocaleDateString('en-AU')}.`,
            data: { days_inactive: daysSince, last_login: user.last_login },
        });
    }
    return alerts;
}

// ============================================================
// Unread messages — client DM waiting >N hours for coach reply
// ============================================================

async function detectUnreadMessages({ supabaseQuery, excludeIds, coachInboxIds = [], opts = {} }) {
    const alerts = [];
    const hoursThreshold = opts.hoursThreshold || 4;
    if (coachInboxIds.length === 0) return alerts;

    const cutoff = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000).toISOString();
    const coachIdSet = new Set(coachInboxIds);

    for (const coachId of coachInboxIds) {
        // Unread (read_at IS NULL)
        const unread = await supabaseQuery(
            `nudges?select=id,sender_id,message,created_at,read_at&receiver_id=eq.${coachId}&read_at=is.null&created_at=lte.${cutoff}&order=created_at.asc&limit=20`
        ).catch(() => []);

        for (const msg of unread) {
            if (excludeIds && excludeIds.has(msg.sender_id)) continue;
            const existing = await supabaseQuery(
                `coach_alerts?alert_type=in.(unread_message,incoming_dm)&data->>nudge_id=eq.${msg.id}&limit=1`
            ).catch(() => []);
            if (existing.length) continue;

            const senders = await supabaseQuery(`users?select=id,name,email&id=eq.${msg.sender_id}&limit=1`).catch(() => []);
            if (!senders[0]) continue;

            const hoursSince = Math.floor((Date.now() - new Date(msg.created_at)) / (60 * 60 * 1000));
            const priority = hoursSince >= 12 ? 'urgent' : hoursSince >= 6 ? 'high' : 'medium';
            alerts.push({
                client_id: senders[0].id,
                client_name: nameOf(senders[0]),
                alert_type: 'unread_message',
                priority,
                title: `${nameOf(senders[0])} messaged ${hoursSince}h ago — no reply yet`,
                description: `Message: "${(msg.message || '').substring(0, 100)}${(msg.message || '').length > 100 ? '...' : ''}"`,
                data: { nudge_id: msg.id, hours_waiting: hoursSince, message_preview: (msg.message || '').substring(0, 200) },
            });
        }

        // Conversations where the client spoke last (read but no reply)
        const convoMsgs = await supabaseQuery(
            `nudges?select=id,sender_id,receiver_id,message,created_at&or=(sender_id.eq.${coachId},receiver_id.eq.${coachId})&created_at=gte.${iso(7)}&order=created_at.desc&limit=200`
        ).catch(() => []);
        const conversations = {};
        for (const m of convoMsgs) {
            const partnerId = coachIdSet.has(m.sender_id) ? m.receiver_id : m.sender_id;
            if (!conversations[partnerId]) conversations[partnerId] = m;
        }
        for (const [partnerId, lastMsg] of Object.entries(conversations)) {
            if (coachIdSet.has(lastMsg.sender_id)) continue;
            if (excludeIds && excludeIds.has(partnerId)) continue;
            const hoursSince = Math.floor((Date.now() - new Date(lastMsg.created_at)) / (60 * 60 * 1000));
            if (hoursSince < hoursThreshold) continue;

            const existingByMsg = await supabaseQuery(
                `coach_alerts?alert_type=in.(unread_message,incoming_dm)&data->>nudge_id=eq.${lastMsg.id}&limit=1`
            ).catch(() => []);
            if (existingByMsg.length) continue;

            const existingByClient = await supabaseQuery(
                `coach_alerts?alert_type=in.(unread_message,incoming_dm)&status=eq.pending&client_id=eq.${partnerId}&created_at=gte.${iso(1)}&limit=1`
            ).catch(() => []);
            if (existingByClient.length) continue;

            const senders = await supabaseQuery(`users?select=id,name,email&id=eq.${partnerId}&limit=1`).catch(() => []);
            if (!senders[0]) continue;

            const priority = hoursSince >= 12 ? 'urgent' : hoursSince >= 6 ? 'high' : 'medium';
            alerts.push({
                client_id: senders[0].id,
                client_name: nameOf(senders[0]),
                alert_type: 'unread_message',
                priority,
                title: `${nameOf(senders[0])} is waiting for a reply (${hoursSince}h)`,
                description: `Their last message: "${(lastMsg.message || '').substring(0, 100)}${(lastMsg.message || '').length > 100 ? '...' : ''}"`,
                data: { nudge_id: lastMsg.id, hours_waiting: hoursSince, message_preview: (lastMsg.message || '').substring(0, 200) },
            });
        }
    }
    return alerts;
}

// ============================================================
// Challenge dropouts — stalled 2+ days
// ============================================================

async function detectChallengeDropouts({ supabaseQuery, excludeIds, clientScope }) {
    const alerts = [];
    const challenges = await supabaseQuery(
        `challenges?select=id,name,start_date,end_date,challenge_type&status=eq.active`
    ).catch(() => []);

    for (const challenge of challenges) {
        const participants = await supabaseQuery(
            `challenge_participants?select=user_id,current_points,challenge_points,accepted_at&challenge_id=eq.${challenge.id}&status=eq.accepted`
        ).catch(() => []);

        for (const p of participants) {
            if (!inScope(p.user_id, excludeIds, clientScope)) continue;
            const snapshots = await supabaseQuery(
                `challenge_points_snapshots?select=snapshot_date,challenge_points&challenge_id=eq.${challenge.id}&user_id=eq.${p.user_id}&order=snapshot_date.desc&limit=3`
            ).catch(() => []);
            if (snapshots.length < 2 || snapshots[0].challenge_points !== snapshots[1].challenge_points) continue;

            const user = await supabaseQuery(`users?select=id,name,email&id=eq.${p.user_id}&limit=1`).catch(() => []);
            if (!user[0]) continue;

            const existing = await supabaseQuery(
                `coach_alerts?client_id=eq.${p.user_id}&alert_type=eq.challenge_dropout&status=eq.pending&data->>challenge_id=eq.${challenge.id}&created_at=gte.${iso(2)}&limit=1`
            ).catch(() => []);
            if (existing.length) continue;

            alerts.push({
                client_id: p.user_id,
                client_name: nameOf(user[0]),
                alert_type: 'challenge_dropout',
                priority: 'high',
                title: `${nameOf(user[0])} stalling in "${challenge.name}"`,
                description: `No point progress in the last 2+ days. Currently at ${p.challenge_points || 0} points.`,
                data: { challenge_id: challenge.id, challenge_name: challenge.name, current_points: p.challenge_points },
            });
        }
    }
    return alerts;
}

// ============================================================
// Wins to celebrate — PBs + streak milestones (24h window)
// Backup for real-time pb-celebration-draft trigger.
// ============================================================

async function detectWinsToCelebrate({ supabaseQuery, excludeIds, clientScope }) {
    const alerts = [];

    const recentPBs = await supabaseQuery(
        `personal_bests?select=user_id,exercise_name,best_weight_kg,best_weight_reps,best_weight_date,updated_at&updated_at=gte.${iso(1)}&order=updated_at.desc&limit=20`
    ).catch(() => []);
    for (const pb of recentPBs) {
        if (!inScope(pb.user_id, excludeIds, clientScope)) continue;
        const user = await supabaseQuery(`users?select=id,name,email&id=eq.${pb.user_id}&limit=1`).catch(() => []);
        if (!user[0]) continue;

        const existing = await supabaseQuery(
            `coach_alerts?client_id=eq.${pb.user_id}&alert_type=eq.win_to_celebrate&status=eq.pending&data->>exercise_name=eq.${encodeURIComponent(pb.exercise_name)}&created_at=gte.${iso(1)}&limit=1`
        ).catch(() => []);
        if (existing.length) continue;

        alerts.push({
            client_id: pb.user_id,
            client_name: nameOf(user[0]),
            alert_type: 'win_to_celebrate',
            priority: 'medium',
            title: `${nameOf(user[0])} hit a PB! ${pb.exercise_name}: ${pb.best_weight_kg}kg x ${pb.best_weight_reps}`,
            description: `New personal best achieved ${pb.best_weight_date || 'recently'}.`,
            data: { subtype: 'pb', exercise_name: pb.exercise_name, weight_kg: pb.best_weight_kg, reps: pb.best_weight_reps },
        });
    }

    const streakers = await supabaseQuery(
        `user_points?select=user_id,current_streak&current_streak=gte.7&order=current_streak.desc&limit=20`
    ).catch(() => []);
    const milestones = [7, 14, 21, 28, 30, 50, 100];
    for (const s of streakers) {
        if (!inScope(s.user_id, excludeIds, clientScope)) continue;
        if (!milestones.includes(s.current_streak)) continue;

        const user = await supabaseQuery(`users?select=id,name,email&id=eq.${s.user_id}&limit=1`).catch(() => []);
        if (!user[0]) continue;
        const existing = await supabaseQuery(
            `coach_alerts?client_id=eq.${s.user_id}&alert_type=eq.win_to_celebrate&status=eq.pending&data->>streak_days=eq.${s.current_streak}&limit=1`
        ).catch(() => []);
        if (existing.length) continue;

        alerts.push({
            client_id: s.user_id,
            client_name: nameOf(user[0]),
            alert_type: 'win_to_celebrate',
            priority: 'medium',
            title: `${nameOf(user[0])} is on a ${s.current_streak}-day streak!`,
            description: `${s.current_streak} days straight. Perfect time to acknowledge it.`,
            data: { subtype: 'streak', streak_days: s.current_streak },
        });
    }
    return alerts;
}

// ============================================================
// Level ups + comebacks (backup for real-time triggers if they exist)
// ============================================================

async function detectLevelUps({ supabaseQuery, excludeIds, clientScope }) {
    const alerts = [];
    const rows = await supabaseQuery(
        `level_milestones?select=user_id,level_reached,title_earned,achieved_at&achieved_at=gte.${iso(1)}&order=achieved_at.desc&limit=30`
    ).catch(() => []);
    for (const m of rows) {
        if (!inScope(m.user_id, excludeIds, clientScope)) continue;
        const existing = await supabaseQuery(
            `coach_alerts?client_id=eq.${m.user_id}&alert_type=eq.win_to_celebrate&status=eq.pending&data->>subtype=eq.level_up&data->>level=eq.${m.level_reached}&limit=1`
        ).catch(() => []);
        if (existing.length) continue;
        const user = await supabaseQuery(`users?select=id,name,email&id=eq.${m.user_id}&limit=1`).catch(() => []);
        if (!user[0]) continue;
        alerts.push({
            client_id: m.user_id,
            client_name: nameOf(user[0]),
            alert_type: 'win_to_celebrate',
            priority: 'medium',
            title: `${nameOf(user[0])} leveled up to Level ${m.level_reached}!`,
            description: `${m.title_earned ? `Earned title: "${m.title_earned}". ` : ''}Great moment to celebrate.`,
            data: { subtype: 'level_up', level: m.level_reached, title: m.title_earned },
        });
    }
    return alerts;
}

async function detectComebacks({ supabaseQuery, excludeIds, clientScope }) {
    const alerts = [];
    const recentLogins = await supabaseQuery(
        `users?select=id,name,email,last_login&last_login=gte.${iso(1)}&order=last_login.desc&limit=200`
    ).catch(() => []);
    for (const user of recentLogins) {
        if (!inScope(user.id, excludeIds, clientScope)) continue;
        const wasInactive = await supabaseQuery(
            `coach_alerts?client_id=eq.${user.id}&alert_type=eq.inactive_client&created_at=gte.${iso(14)}&limit=1`
        ).catch(() => []);
        if (!wasInactive.length) continue;
        const existing = await supabaseQuery(
            `coach_alerts?client_id=eq.${user.id}&alert_type=eq.win_to_celebrate&status=eq.pending&data->>subtype=eq.comeback&created_at=gte.${iso(3)}&limit=1`
        ).catch(() => []);
        if (existing.length) continue;

        alerts.push({
            client_id: user.id,
            client_name: nameOf(user),
            alert_type: 'win_to_celebrate',
            priority: 'medium',
            title: `${nameOf(user)} is back!`,
            description: `Was inactive but just logged in again. Welcome them back before they drift off.`,
            data: { subtype: 'comeback' },
        });
    }
    return alerts;
}

// ============================================================
// Check-in due — 7+ days since last daily_checkin
// ============================================================

async function detectCheckinDue({ supabaseQuery, excludeIds, clientScope }) {
    const alerts = [];
    const users = await supabaseQuery('users?select=id,name,email&order=name.asc&limit=500').catch(() => []);
    for (const user of users) {
        if (!inScope(user.id, excludeIds, clientScope)) continue;
        const rows = await supabaseQuery(
            `daily_checkins?select=checkin_date&user_id=eq.${user.id}&order=checkin_date.desc&limit=1`
        ).catch(() => []);
        if (!rows.length) continue;
        const daysSince = Math.floor((Date.now() - new Date(rows[0].checkin_date)) / DAY_MS);
        if (daysSince < 7) continue;

        const existing = await supabaseQuery(
            `coach_alerts?client_id=eq.${user.id}&alert_type=eq.coaching_idea&status=eq.pending&data->>subtype=eq.checkin_due&created_at=gte.${iso(3)}&limit=1`
        ).catch(() => []);
        if (existing.length) continue;

        alerts.push({
            client_id: user.id,
            client_name: nameOf(user),
            alert_type: 'coaching_idea',
            priority: daysSince >= 14 ? 'high' : 'medium',
            title: `${nameOf(user)} is due for a check-in (${daysSince} days)`,
            description: `Last check-in was ${new Date(rows[0].checkin_date).toLocaleDateString('en-AU')}.`,
            data: { subtype: 'checkin_due', days_since_checkin: daysSince },
        });
    }
    return alerts;
}

// ============================================================
// Not in any active challenge
// ============================================================

async function detectNotInChallenge({ supabaseQuery, excludeIds, clientScope }) {
    const alerts = [];
    const challenges = await supabaseQuery('challenges?select=id,name&status=eq.active').catch(() => []);
    if (!challenges.length) return alerts;

    const challengeIds = challenges.map(c => c.id);
    const inList = challengeIds.map(id => `"${id}"`).join(',');
    const participants = await supabaseQuery(
        `challenge_participants?select=user_id&challenge_id=in.(${inList})&status=eq.accepted&limit=500`
    ).catch(() => []);
    const participantIds = new Set(participants.map(p => p.user_id));

    const activeUsers = await supabaseQuery(
        `users?select=id,name,email&last_login=gte.${iso(14)}&order=name.asc&limit=500`
    ).catch(() => []);
    const challengeNames = challenges.map(c => c.name).join(', ');

    for (const user of activeUsers) {
        if (!inScope(user.id, excludeIds, clientScope)) continue;
        if (participantIds.has(user.id)) continue;

        const existing = await supabaseQuery(
            `coach_alerts?client_id=eq.${user.id}&alert_type=eq.coaching_idea&status=eq.pending&data->>subtype=eq.not_in_challenge&created_at=gte.${iso(7)}&limit=1`
        ).catch(() => []);
        if (existing.length) continue;

        alerts.push({
            client_id: user.id,
            client_name: nameOf(user),
            alert_type: 'coaching_idea',
            priority: 'low',
            title: `${nameOf(user)} isn't in any challenge`,
            description: `Active user not participating in current challenges (${challengeNames}).`,
            data: { subtype: 'not_in_challenge', active_challenges: challengeNames },
        });
    }
    return alerts;
}

// ============================================================
// New user idle — joined in last 3 days, no meals or workouts
// ============================================================

async function detectNewUserIdle({ supabaseQuery, excludeIds, clientScope }) {
    const alerts = [];
    const newUsers = await supabaseQuery(
        `users?select=id,name,email,created_at&created_at=gte.${iso(3)}&order=created_at.desc&limit=100`
    ).catch(() => []);

    for (const user of newUsers) {
        if (!inScope(user.id, excludeIds, clientScope)) continue;
        const [meals, workouts] = await Promise.all([
            supabaseQuery(`meal_logs?select=id&user_id=eq.${user.id}&limit=1`).catch(() => []),
            supabaseQuery(`workouts?select=id&user_id=eq.${user.id}&workout_type=eq.history&limit=1`).catch(() => []),
        ]);
        if (meals.length || workouts.length) continue;

        const existing = await supabaseQuery(
            `coach_alerts?client_id=eq.${user.id}&alert_type=eq.coaching_idea&status=eq.pending&data->>subtype=eq.new_user&limit=1`
        ).catch(() => []);
        if (existing.length) continue;

        const hoursAgo = Math.floor((Date.now() - new Date(user.created_at)) / (60 * 60 * 1000));
        alerts.push({
            client_id: user.id,
            client_name: nameOf(user),
            alert_type: 'coaching_idea',
            priority: hoursAgo >= 48 ? 'high' : 'medium',
            title: `New user ${nameOf(user)} hasn't logged anything yet`,
            description: `Joined ${hoursAgo < 24 ? hoursAgo + 'h' : Math.floor(hoursAgo / 24) + ' days'} ago but no meals or workouts tracked.`,
            data: { subtype: 'new_user', hours_since_join: hoursAgo },
        });
    }
    return alerts;
}

// ============================================================
// Nutrition gap — averaging <60% of protein goal over 3+ days
// ============================================================

async function detectNutritionGaps({ supabaseQuery, excludeIds, clientScope }) {
    const alerts = [];
    const weekAgo = iso(7).split('T')[0];

    const rows = await supabaseQuery(
        `daily_nutrition?select=user_id,nutrition_date,total_calories,total_protein_g,calorie_goal,protein_goal_g&nutrition_date=gte.${weekAgo}&order=user_id,nutrition_date.desc`
    ).catch(() => []);

    const byUser = {};
    for (const n of rows) {
        if (!inScope(n.user_id, excludeIds, clientScope)) continue;
        (byUser[n.user_id] ||= []).push(n);
    }

    for (const [userId, days] of Object.entries(byUser)) {
        if (days.length < 3) continue;
        const proteinGoal = days[0].protein_goal_g;
        if (!proteinGoal) continue;

        const avgProtein = days.reduce((s, d) => s + (d.total_protein_g || 0), 0) / days.length;
        const proteinPct = Math.round((avgProtein / proteinGoal) * 100);
        if (proteinPct >= 60) continue;

        const existing = await supabaseQuery(
            `coach_alerts?client_id=eq.${userId}&alert_type=eq.nutrition_gap&status=eq.pending&created_at=gte.${iso(3)}&limit=1`
        ).catch(() => []);
        if (existing.length) continue;

        const user = await supabaseQuery(`users?select=id,name,email&id=eq.${userId}&limit=1`).catch(() => []);
        if (!user[0]) continue;

        alerts.push({
            client_id: userId,
            client_name: nameOf(user[0]),
            alert_type: 'nutrition_gap',
            priority: proteinPct < 40 ? 'high' : 'medium',
            title: `${nameOf(user[0])} is only hitting ${proteinPct}% of protein goal`,
            description: `Averaging ${Math.round(avgProtein)}g protein vs ${proteinGoal}g goal over ${days.length} days.`,
            data: { avg_protein: Math.round(avgProtein), protein_goal: proteinGoal, protein_pct: proteinPct, days_tracked: days.length },
        });
    }
    return alerts;
}

// ============================================================
// Workout dropoff — 3+ last week, 0 this week
// ============================================================

async function detectWorkoutDropoff({ supabaseQuery, excludeIds, clientScope }) {
    const alerts = [];
    const twoWeeksAgo = iso(14).split('T')[0];
    const oneWeekAgo = iso(7).split('T')[0];

    const workouts = await supabaseQuery(
        `workouts?select=user_id,workout_date&workout_type=eq.history&workout_date=gte.${twoWeeksAgo}&order=user_id,workout_date.desc`
    ).catch(() => []);

    const byUser = {};
    for (const w of workouts) {
        if (!inScope(w.user_id, excludeIds, clientScope)) continue;
        (byUser[w.user_id] ||= []).push(w.workout_date);
    }

    for (const [userId, dates] of Object.entries(byUser)) {
        const unique = [...new Set(dates)];
        const thisWeek = unique.filter(d => d >= oneWeekAgo).length;
        const lastWeek = unique.filter(d => d < oneWeekAgo).length;
        if (lastWeek < 3 || thisWeek > 0) continue;

        const existing = await supabaseQuery(
            `coach_alerts?client_id=eq.${userId}&alert_type=eq.coaching_idea&status=eq.pending&data->>subtype=eq.workout_dropoff&created_at=gte.${iso(3)}&limit=1`
        ).catch(() => []);
        if (existing.length) continue;

        const user = await supabaseQuery(`users?select=id,name,email&id=eq.${userId}&limit=1`).catch(() => []);
        if (!user[0]) continue;

        alerts.push({
            client_id: userId,
            client_name: nameOf(user[0]),
            alert_type: 'coaching_idea',
            priority: 'medium',
            title: `${nameOf(user[0])} trained ${lastWeek}x last week but 0 this week`,
            description: `Was on a good rhythm. Quick check-in could help.`,
            data: { subtype: 'workout_dropoff', last_week_sessions: lastWeek, this_week_sessions: thisWeek },
        });
    }
    return alerts;
}

// ============================================================
// Meal dropoff — logging history, nothing in 2+ days
// ============================================================

async function detectMealDropoff({ supabaseQuery, excludeIds, clientScope }) {
    const alerts = [];
    const weekAgo = iso(7).split('T')[0];
    const twoDaysAgo = iso(2).split('T')[0];

    const rows = await supabaseQuery(
        `meal_logs?select=user_id,meal_date&meal_date=gte.${weekAgo}&order=user_id,meal_date.desc`
    ).catch(() => []);

    const byUser = {};
    for (const m of rows) {
        if (!inScope(m.user_id, excludeIds, clientScope)) continue;
        (byUser[m.user_id] ||= []).push(m.meal_date);
    }

    for (const [userId, dates] of Object.entries(byUser)) {
        const unique = [...new Set(dates)].sort().reverse();
        if (unique.length < 3) continue;
        if (unique[0] >= twoDaysAgo) continue;

        const existing = await supabaseQuery(
            `coach_alerts?client_id=eq.${userId}&alert_type=eq.coaching_idea&status=eq.pending&data->>subtype=eq.meal_dropoff&created_at=gte.${iso(2)}&limit=1`
        ).catch(() => []);
        if (existing.length) continue;

        const user = await supabaseQuery(`users?select=id,name,email&id=eq.${userId}&limit=1`).catch(() => []);
        if (!user[0]) continue;

        const daysSince = Math.floor((Date.now() - new Date(unique[0])) / DAY_MS);
        alerts.push({
            client_id: userId,
            client_name: nameOf(user[0]),
            alert_type: 'coaching_idea',
            priority: 'low',
            title: `${nameOf(user[0])} stopped logging meals (${daysSince} days)`,
            description: `Was tracking regularly but nothing logged since ${unique[0]}.`,
            data: { subtype: 'meal_dropoff', days_since_meal: daysSince, total_days_tracked: unique.length },
        });
    }
    return alerts;
}

// ============================================================
// Mood low — avg mood_score <5 over 3 days (uses mood_logs, the live table)
// ============================================================

async function detectMoodLow({ supabaseQuery, excludeIds, clientScope }) {
    const alerts = [];
    const since = iso(3);

    // Pull all recent mood logs in one query; client-scope/exclude filter in memory
    const rows = await supabaseQuery(
        `mood_logs?select=user_id,mood_score,energy_score,created_at&created_at=gte.${since}&order=user_id,created_at.desc&limit=1000`
    ).catch(() => []);

    const byUser = {};
    for (const r of rows) {
        if (!inScope(r.user_id, excludeIds, clientScope)) continue;
        (byUser[r.user_id] ||= []).push(r);
    }

    for (const [userId, entries] of Object.entries(byUser)) {
        if (entries.length < 2) continue;
        const avgMood = entries.reduce((s, e) => s + (e.mood_score || 0), 0) / entries.length;
        if (!(avgMood > 0 && avgMood < 5)) continue;

        const existing = await supabaseQuery(
            `coach_alerts?client_id=eq.${userId}&alert_type=eq.coaching_idea&status=eq.pending&data->>subtype=eq.mood_low&created_at=gte.${iso(3)}&limit=1`
        ).catch(() => []);
        if (existing.length) continue;

        const user = await supabaseQuery(`users?select=id,name,email&id=eq.${userId}&limit=1`).catch(() => []);
        if (!user[0]) continue;

        alerts.push({
            client_id: userId,
            client_name: nameOf(user[0]),
            alert_type: 'coaching_idea',
            priority: 'medium',
            title: `${nameOf(user[0])}'s mood has been low`,
            description: `Avg mood ${avgMood.toFixed(1)}/10 over last 3 days (${entries.length} logs). Might need some support.`,
            data: { subtype: 'mood_low', avg_mood: avgMood.toFixed(1), entries: entries.length },
        });
    }
    return alerts;
}

// ============================================================
// Wearable low — WHOOP recovery <40% over 3+ days
// ============================================================

async function detectWearableLow({ supabaseQuery, excludeIds, clientScope }) {
    const alerts = [];
    const weekAgo = iso(7).split('T')[0];

    const rows = await supabaseQuery(
        `whoop_recovery?select=user_id,date,recovery_score&date=gte.${weekAgo}&order=user_id,date.desc`
    ).catch(() => []);

    const byUser = {};
    for (const r of rows) {
        if (!inScope(r.user_id, excludeIds, clientScope)) continue;
        (byUser[r.user_id] ||= []).push(r);
    }

    for (const [userId, entries] of Object.entries(byUser)) {
        if (entries.length < 3) continue;
        const avg = entries.reduce((s, e) => s + (e.recovery_score || 0), 0) / entries.length;
        if (avg >= 40) continue;

        const existing = await supabaseQuery(
            `coach_alerts?client_id=eq.${userId}&alert_type=eq.coaching_idea&status=eq.pending&data->>subtype=eq.wearable_low&created_at=gte.${iso(3)}&limit=1`
        ).catch(() => []);
        if (existing.length) continue;

        const user = await supabaseQuery(`users?select=id,name,email&id=eq.${userId}&limit=1`).catch(() => []);
        if (!user[0]) continue;

        alerts.push({
            client_id: userId,
            client_name: nameOf(user[0]),
            alert_type: 'coaching_idea',
            priority: 'medium',
            title: `${nameOf(user[0])}'s WHOOP recovery is low (${Math.round(avg)}%)`,
            description: `Avg ${Math.round(avg)}% over ${entries.length} days. May need lighter training or recovery focus.`,
            data: { subtype: 'wearable_low', source: 'whoop', avg_recovery: Math.round(avg) },
        });
    }
    return alerts;
}

// ============================================================
// Morning-unique signals (ported from morning-pulse-scan.js)
// ============================================================

async function detectMissedScheduledWorkout({ supabaseQuery, clientId, clientName, personalDetails }) {
    if (!personalDetails?.workout_calendar) return null;
    let cal;
    try {
        cal = typeof personalDetails.workout_calendar === 'string'
            ? JSON.parse(personalDetails.workout_calendar)
            : personalDetails.workout_calendar;
    } catch { return null; }

    const yesterday = new Date(Date.now() - DAY_MS);
    const yestKey = yesterday.toISOString().slice(0, 10);
    const scheduled = cal[DAY_NAMES[yesterday.getDay()]];
    if (!scheduled || /^(rest|off)$/i.test(scheduled) || /^yoga-rest/i.test(scheduled)) return null;

    const rows = await supabaseQuery(
        `workouts?select=id&user_id=eq.${clientId}&workout_date=eq.${yestKey}&is_current_workout=eq.false&limit=1`
    ).catch(() => []);
    if (rows.length) return null;

    // Dedup on (client, subtype, missed date) across ALL statuses so a dismissed
    // "Forget" click doesn't re-surface the same alert on the next pulse run.
    const existing = await supabaseQuery(
        `coach_alerts?select=id&client_id=eq.${clientId}&alert_type=eq.morning_pulse&data->>subtype=eq.missed_scheduled_workout&data->>date_key=eq.${yestKey}&limit=1`
    ).catch(() => []);
    if (existing.length) return null;

    return {
        client_id: clientId,
        client_name: clientName,
        alert_type: 'morning_pulse',
        priority: 'high',
        title: `🌅 ${clientName} — missed yesterday's ${scheduled}`,
        description: `Scheduled ${scheduled} for ${DAY_NAMES[yesterday.getDay()]}, nothing logged.`,
        data: {
            signal_reason: `Skipped yesterday's scheduled ${scheduled} workout.`,
            signal_context: `Scheduled ${scheduled}, nothing logged for ${yestKey}.`,
            signal_priority: 'high',
            subtype: 'missed_scheduled_workout',
            date_key: yestKey,
        },
    };
}

async function detectStreakBreak({ supabaseQuery, clientId, clientName }) {
    const rows = await supabaseQuery(
        `workouts?select=workout_date&user_id=eq.${clientId}&is_current_workout=eq.false&workout_date=gte.${iso(10).split('T')[0]}&order=workout_date.desc&limit=200`
    ).catch(() => []);
    const dates = new Set(rows.map(r => r.workout_date));

    const yestKey = iso(1).split('T')[0];
    if (dates.has(yestKey)) return null;

    let streak = 0;
    for (let i = 2; i <= 10; i++) {
        const d = iso(i).split('T')[0];
        if (dates.has(d)) streak++;
        else break;
    }
    if (streak < 5) return null;

    // Dedup on (client, subtype, break date) across ALL statuses so a dismissed
    // alert doesn't re-surface the same broken-streak event on the next run.
    const existing = await supabaseQuery(
        `coach_alerts?select=id&client_id=eq.${clientId}&alert_type=eq.morning_pulse&data->>subtype=eq.streak_break&data->>date_key=eq.${yestKey}&limit=1`
    ).catch(() => []);
    if (existing.length) return null;

    return {
        client_id: clientId,
        client_name: clientName,
        alert_type: 'morning_pulse',
        priority: 'high',
        title: `🌅 ${clientName} — ${streak}-day streak broken`,
        description: `${streak} consecutive days of workouts, missed yesterday.`,
        data: {
            signal_reason: `Had a ${streak}-day workout streak going — skipped yesterday.`,
            signal_context: `${streak} consecutive days of workouts, broken ${yestKey}.`,
            signal_priority: 'high',
            subtype: 'streak_break',
            streak_days: streak,
            date_key: yestKey,
        },
    };
}

/**
 * Find the banter-worthy active challenge (coach-in = trash talk, solo = hype).
 * Returns full challenge context or null.
 */
async function findBanterChallenge({ supabaseQuery, clientId, coachId }) {
    const myRows = await supabaseQuery(
        `challenge_participants?select=challenge_id,user_id,current_points,challenge_points,status&user_id=eq.${clientId}&status=eq.accepted&limit=20`
    ).catch(() => []);
    if (!myRows.length) return null;

    const ids = myRows.map(r => r.challenge_id);
    const inList = ids.map(id => `"${id}"`).join(',');
    const challenges = await supabaseQuery(
        `challenges?select=id,name,challenge_type,status,start_date,end_date&id=in.(${inList})&status=eq.active&limit=20`
    ).catch(() => []);
    if (!challenges.length) return null;

    const activeList = challenges.map(c => `"${c.id}"`).join(',');
    const allParticipants = await supabaseQuery(
        `challenge_participants?select=challenge_id,user_id,current_points,challenge_points,status&challenge_id=in.(${activeList})&status=eq.accepted&limit=500`
    ).catch(() => []);

    const byChallenge = new Map();
    for (const p of allParticipants) {
        if (!byChallenge.has(p.challenge_id)) byChallenge.set(p.challenge_id, []);
        byChallenge.get(p.challenge_id).push(p);
    }
    for (const [, arr] of byChallenge) {
        arr.sort((a, b) => (b.challenge_points || b.current_points || 0) - (a.challenge_points || a.current_points || 0));
    }

    const scored = [];
    for (const c of challenges) {
        const participants = byChallenge.get(c.id) || [];
        if (participants.length < 2) continue;
        const clientRow = participants.find(p => p.user_id === clientId);
        if (!clientRow) continue;
        const coachRow = participants.find(p => p.user_id === coachId);
        const coachIn = !!coachRow;
        const leader = participants[0];
        const clientScore = clientRow.challenge_points || clientRow.current_points || 0;

        let daysLeft = null;
        if (c.end_date) daysLeft = Math.max(0, Math.ceil((new Date(c.end_date).getTime() - Date.now()) / DAY_MS));

        let interestScore = 0;
        if (coachIn) {
            interestScore += 100;
            const coachScore = coachRow.challenge_points || coachRow.current_points || 0;
            interestScore += Math.max(0, 50 - Math.abs(coachScore - clientScore));
        } else {
            const rank = participants.findIndex(p => p.user_id === clientId) + 1;
            if (rank === 1) interestScore += 40;
            else if (rank === participants.length) interestScore += 15;
            else interestScore += 25;
            const gap = Math.abs((leader.challenge_points || leader.current_points || 0) - clientScore);
            interestScore += Math.max(0, 30 - gap);
        }
        if (daysLeft !== null && daysLeft <= 3) interestScore += 25;

        scored.push({ challenge: c, participants, coachIn, leader, clientRow, coachRow: coachRow || null, daysLeft, interestScore });
    }
    if (!scored.length) return null;
    scored.sort((a, b) => b.interestScore - a.interestScore);
    return scored[0];
}

async function detectChallengeBanter({ supabaseQuery, clientId, clientName, coachId }) {
    const b = await findBanterChallenge({ supabaseQuery, clientId, coachId });
    if (!b) return null;

    const daysLeftStr = b.daysLeft !== null ? `${b.daysLeft}d left` : 'ongoing';
    const clientScore = b.clientRow.challenge_points || b.clientRow.current_points || 0;

    if (b.coachIn) {
        const coachScore = b.coachRow?.challenge_points || b.coachRow?.current_points || 0;
        const diff = coachScore - clientScore;
        const tied = diff === 0;
        const coachAhead = diff > 0;
        return {
            client_id: clientId,
            client_name: clientName,
            alert_type: 'morning_pulse',
            priority: 'high',
            title: `🌅 ${clientName} — "${b.challenge.name}"`,
            description: tied ? `Neck-and-neck (${daysLeftStr}).`
                : coachAhead ? `You +${diff}pts (${daysLeftStr}).`
                : `Client +${Math.abs(diff)}pts (${daysLeftStr}).`,
            data: {
                signal_reason: tied
                    ? `Neck-and-neck in ${b.challenge.name} (${daysLeftStr}).`
                    : coachAhead
                        ? `Leading ${b.challenge.name} by ${Math.abs(diff)}pts (${daysLeftStr}) — trash-talk mode.`
                        : `Behind in ${b.challenge.name} by ${Math.abs(diff)}pts (${daysLeftStr}) — client's winning, rev them.`,
                signal_context: `Challenge "${b.challenge.name}" (${b.challenge.challenge_type}). Shannon ${coachScore}pts vs client ${clientScore}pts. ${daysLeftStr}.`,
                signal_priority: 'high',
                subtype: 'challenge_banter',
                challenge_id: b.challenge.id,
                challenge_name: b.challenge.name,
                coach_in_challenge: true,
                _banter: b, // internal — consumed by prompt builder, stripped before insert
            },
        };
    }

    // Solo — client vs friends, coach cheers from the sideline
    const clientRank = b.participants.findIndex(p => p.user_id === clientId) + 1;
    const leaderPts = b.leader.challenge_points || b.leader.current_points || 0;
    const gap = leaderPts - clientScore;
    const isLeading = b.leader.user_id === clientId;
    return {
        client_id: clientId,
        client_name: clientName,
        alert_type: 'morning_pulse',
        priority: 'medium',
        title: `🌅 ${clientName} — "${b.challenge.name}"`,
        description: isLeading
            ? `Leading, ${daysLeftStr}.`
            : `Rank ${clientRank}/${b.participants.length}, ${gap}pts from 1st, ${daysLeftStr}.`,
        data: {
            signal_reason: isLeading
                ? `Leading "${b.challenge.name}" — ${daysLeftStr}, keep them pushing.`
                : `In "${b.challenge.name}" — rank ${clientRank}/${b.participants.length}, ${gap}pts from 1st, ${daysLeftStr}.`,
            signal_context: `Challenge "${b.challenge.name}" (${b.challenge.challenge_type}). Shannon NOT in this — hype mode. ${daysLeftStr}.`,
            signal_priority: 'medium',
            subtype: 'challenge_solo',
            challenge_id: b.challenge.id,
            challenge_name: b.challenge.name,
            coach_in_challenge: false,
            _banter: b,
        },
    };
}

async function detectQuietClient({ supabaseQuery, clientId, clientName }) {
    const [lastDm, recentWorkouts] = await Promise.all([
        supabaseQuery(`nudges?select=created_at&sender_id=eq.${clientId}&order=created_at.desc&limit=1`).catch(() => []),
        supabaseQuery(`workouts?select=workout_date&user_id=eq.${clientId}&is_current_workout=eq.false&workout_date=gte.${iso(3).split('T')[0]}&limit=1`).catch(() => []),
    ]);
    const lastDmAt = lastDm[0]?.created_at;
    const noDm5d = !lastDmAt || new Date(lastDmAt) < new Date(iso(5));
    if (!noDm5d) return null;
    if (recentWorkouts.length) return null;

    const daysSinceDm = lastDmAt ? Math.floor((Date.now() - new Date(lastDmAt).getTime()) / DAY_MS) : null;
    return {
        client_id: clientId,
        client_name: clientName,
        alert_type: 'morning_pulse',
        priority: 'medium',
        title: `🌅 ${clientName} — quiet`,
        description: `${daysSinceDm !== null ? `${daysSinceDm}d since last DM, ` : ''}no workout in 3+ days.`,
        data: {
            signal_reason: `Quiet — ${daysSinceDm !== null ? `${daysSinceDm} days since last message, ` : ''}no workout logged in 3+ days.`,
            signal_context: `Last DM: ${daysSinceDm !== null ? daysSinceDm + ' days ago' : 'never'}. Workouts last 3d: 0.`,
            signal_priority: 'medium',
            subtype: 'quiet_client',
        },
    };
}

async function detectCycleCheckin({ clientId, clientName, personalDetails }) {
    if (personalDetails?.cycle_sync_preference !== 'yes' || !personalDetails?.last_period_start) return null;
    const cycleLen = personalDetails.cycle_length || 28;
    let next = new Date(personalDetails.last_period_start);
    while (next.getTime() < Date.now() - DAY_MS) next = new Date(next.getTime() + cycleLen * DAY_MS);
    const hoursUntil = (next.getTime() - Date.now()) / (60 * 60 * 1000);
    if (!(hoursUntil >= -24 && hoursUntil <= 24)) return null;

    return {
        client_id: clientId,
        client_name: clientName,
        alert_type: 'morning_pulse',
        priority: 'low',
        title: `🌅 ${clientName} — cycle check-in`,
        description: `Period due around now${personalDetails.period_energy_response === 'low' ? ' (tends to have low energy)' : ''}.`,
        data: {
            signal_reason: `Period is due around now (cycle-sync enabled${personalDetails.period_energy_response === 'low' ? ', she tends to have low energy' : ''}).`,
            signal_context: `Predicted period start within 24h. Cycle length ${cycleLen}d.`,
            signal_priority: 'low',
            subtype: 'cycle_checkin',
        },
    };
}

async function detectMomentum({ supabaseQuery, clientId, clientName }) {
    const [pbs, workouts] = await Promise.all([
        supabaseQuery(`pb_history?select=id&user_id=eq.${clientId}&achieved_at=gte.${iso(7)}&limit=10`).catch(() => []),
        supabaseQuery(`workouts?select=workout_date&user_id=eq.${clientId}&is_current_workout=eq.false&workout_date=gte.${iso(7).split('T')[0]}&limit=50`).catch(() => []),
    ]);
    const uniqueWorkoutDays = new Set(workouts.map(w => w.workout_date)).size;

    if (pbs.length >= 2) {
        return {
            client_id: clientId,
            client_name: clientName,
            alert_type: 'morning_pulse',
            priority: 'low',
            title: `🌅 ${clientName} — momentum`,
            description: `${pbs.length} PBs in the last 7 days.`,
            data: {
                signal_reason: `Momentum — ${pbs.length} PBs in the last 7 days.`,
                signal_context: `${pbs.length} PBs logged in last 7d, ${uniqueWorkoutDays} workouts.`,
                signal_priority: 'low',
                subtype: 'momentum',
            },
        };
    }
    if (uniqueWorkoutDays >= 5) {
        return {
            client_id: clientId,
            client_name: clientName,
            alert_type: 'morning_pulse',
            priority: 'low',
            title: `🌅 ${clientName} — consistency`,
            description: `${uniqueWorkoutDays} workouts this week.`,
            data: {
                signal_reason: `Consistency — ${uniqueWorkoutDays} workouts this week.`,
                signal_context: `${uniqueWorkoutDays} workouts logged in last 7d.`,
                signal_priority: 'low',
                subtype: 'momentum',
            },
        };
    }
    return null;
}

module.exports = {
    // shared utils
    DAY_MS,
    DAY_NAMES,
    inScope,
    iso,
    nameOf,
    // cohort detectors (runner iterates all clients internally)
    detectInactiveClients,
    detectUnreadMessages,
    detectChallengeDropouts,
    detectWinsToCelebrate,
    detectLevelUps,
    detectComebacks,
    detectCheckinDue,
    detectNotInChallenge,
    detectNewUserIdle,
    detectNutritionGaps,
    detectWorkoutDropoff,
    detectMealDropoff,
    detectMoodLow,
    detectWearableLow,
    // per-client detectors (runner loops clients + awaits these)
    detectMissedScheduledWorkout,
    detectStreakBreak,
    detectChallengeBanter,
    detectQuietClient,
    detectCycleCheckin,
    detectMomentum,
};
