/**
 * AI Client Monitor — Scheduled Function
 *
 * Runs every 2 hours (configured in netlify.toml) to proactively scan all clients
 * and generate actionable alerts for the coach. Checks for:
 *
 * 1. Inactive clients (no login/tracking in X days)
 * 2. Unread messages waiting for coach reply
 * 3. Challenge participants falling behind
 * 4. Broken streaks
 * 5. Milestones worth celebrating
 * 6. Nutrition gaps
 *
 * Alerts are stored in coach_alerts table and optionally sent via WhatsApp/push.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const SITE_URL = process.env.URL || 'https://plantbased-balance.org';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Twilio WhatsApp config (optional)
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM; // e.g. whatsapp:+14155238886

async function supabaseQuery(path, options = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${path}`;
    const headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': options.prefer || 'return=representation',
    };
    const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Supabase ${options.method || 'GET'} ${path} failed: ${response.status} ${text}`);
    }
    return response.json();
}

/**
 * Scan for inactive clients — haven't had any activity in X days
 */
// Helper: check if a user is in scope for this coach
function inScope(userId, excludeIds, clientScope) {
    if (excludeIds.has(userId)) return false;
    if (clientScope && !clientScope.has(userId)) return false;
    return true;
}

async function checkInactiveClients(inactiveDays = 2, excludeIds = new Set(), clientScope = null) {
    const alerts = [];
    const cutoff = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000).toISOString();

    // Get all users with their last login
    const users = await supabaseQuery('users?select=id,name,email,last_login,program_start_date&order=last_login.desc');

    for (const user of users) {
        if (!user.last_login) continue;
        if (!inScope(user.id, excludeIds, clientScope)) continue;

        const lastLogin = new Date(user.last_login);
        const daysSince = Math.floor((Date.now() - lastLogin) / (1000 * 60 * 60 * 24));

        if (daysSince >= inactiveDays && daysSince <= 14) {
            // Check if we already have a recent alert for this client
            const existing = await supabaseQuery(
                `coach_alerts?client_id=eq.${user.id}&alert_type=eq.inactive_client&status=eq.pending&created_at=gte.${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}&limit=1`
            );
            if (existing.length > 0) continue;

            const priority = daysSince >= 5 ? 'high' : daysSince >= 3 ? 'medium' : 'low';
            alerts.push({
                client_id: user.id,
                client_name: user.name || user.email?.split('@')[0] || 'Unknown',
                alert_type: 'inactive_client',
                priority,
                title: `${user.name || user.email?.split('@')[0]} hasn't been active for ${daysSince} days`,
                description: `Last login: ${lastLogin.toLocaleDateString('en-AU')}. ${user.program_start_date ? `Program day ${Math.ceil((Date.now() - new Date(user.program_start_date)) / (1000 * 60 * 60 * 24))}.` : ''}`,
                data: { days_inactive: daysSince, last_login: user.last_login },
            });
        }
    }
    return alerts;
}

/**
 * Scan for unread messages — client sent a message the coach hasn't replied to
 */
async function checkUnreadMessages(hoursThreshold = 4, excludeIds = new Set(), coachIds = [], clientScope = null) {
    const alerts = [];
    const cutoff = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000).toISOString();

    if (coachIds.length === 0) return alerts;

    // Get recent nudges (DMs) sent TO the coach that haven't been read yet
    // The nudges table uses read_at (TIMESTAMPTZ, NULL if unread) not a boolean
    for (const coachId of coachIds) {
        const unread = await supabaseQuery(
            `nudges?select=id,sender_id,message,created_at,read_at&receiver_id=eq.${coachId}&read_at=is.null&created_at=lte.${cutoff}&order=created_at.asc&limit=20`
        );

        for (const msg of unread) {
            // Skip messages from admin/coach accounts, or clients not in scope
            if (!inScope(msg.sender_id, excludeIds, clientScope)) continue;

            // Check if we already alerted about this message
            const existing = await supabaseQuery(
                `coach_alerts?alert_type=eq.unread_message&status=eq.pending&data->>nudge_id=eq.${msg.id}&limit=1`
            );
            if (existing.length > 0) continue;

            // Get sender info
            const senders = await supabaseQuery(`users?select=id,name,email&id=eq.${msg.sender_id}&limit=1`);
            const sender = senders[0];
            if (!sender) continue;

            const hoursSince = Math.floor((Date.now() - new Date(msg.created_at)) / (1000 * 60 * 60));
            const priority = hoursSince >= 12 ? 'urgent' : hoursSince >= 6 ? 'high' : 'medium';

            alerts.push({
                client_id: sender.id,
                client_name: sender.name || sender.email?.split('@')[0],
                alert_type: 'unread_message',
                priority,
                title: `${sender.name || sender.email?.split('@')[0]} messaged ${hoursSince}h ago — no reply yet`,
                description: `Message: "${msg.message?.substring(0, 100)}${msg.message?.length > 100 ? '...' : ''}"`,
                data: { nudge_id: msg.id, hours_waiting: hoursSince, message_preview: msg.message?.substring(0, 200) },
            });
        }

        // Also check for messages the coach has READ but not REPLIED to
        // Find the most recent message from each client where the client spoke last
        const recentFromClients = await supabaseQuery(
            `nudges?select=id,sender_id,message,created_at&receiver_id=eq.${coachId}&read_at=not.is.null&created_at=gte.${new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()}&order=created_at.desc&limit=50`
        );

        // Group by sender and check if coach replied after their last message
        const lastMessageBySender = {};
        for (const msg of recentFromClients) {
            if (!lastMessageBySender[msg.sender_id]) {
                lastMessageBySender[msg.sender_id] = msg;
            }
        }

        for (const [senderId, lastMsg] of Object.entries(lastMessageBySender)) {
            // Skip admin/coach accounts or clients not in scope
            if (!inScope(senderId, excludeIds, clientScope)) continue;
            // Check if coach sent a reply AFTER this message
            const coachReplies = await supabaseQuery(
                `nudges?select=id&sender_id=eq.${coachId}&receiver_id=eq.${senderId}&created_at=gte.${lastMsg.created_at}&limit=1`
            );
            if (coachReplies.length > 0) continue; // Coach already replied

            const hoursSince = Math.floor((Date.now() - new Date(lastMsg.created_at)) / (1000 * 60 * 60));
            if (hoursSince < hoursThreshold) continue; // Not old enough yet

            // Check if we already have an alert for this
            const existing = await supabaseQuery(
                `coach_alerts?alert_type=eq.unread_message&status=eq.pending&client_id=eq.${senderId}&created_at=gte.${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}&limit=1`
            );
            if (existing.length > 0) continue;

            const senders = await supabaseQuery(`users?select=id,name,email&id=eq.${senderId}&limit=1`);
            const sender = senders[0];
            if (!sender) continue;

            const priority = hoursSince >= 12 ? 'urgent' : hoursSince >= 6 ? 'high' : 'medium';

            alerts.push({
                client_id: sender.id,
                client_name: sender.name || sender.email?.split('@')[0],
                alert_type: 'unread_message',
                priority,
                title: `${sender.name || sender.email?.split('@')[0]} is waiting for a reply (${hoursSince}h)`,
                description: `Their last message: "${lastMsg.message?.substring(0, 100)}${lastMsg.message?.length > 100 ? '...' : ''}"`,
                data: { nudge_id: lastMsg.id, hours_waiting: hoursSince, message_preview: lastMsg.message?.substring(0, 200) },
            });
        }
    }
    return alerts;
}

/**
 * Scan for challenge dropouts — participants not logging activity
 */
async function checkChallengeDropouts(excludeIds = new Set(), clientScope = null) {
    const alerts = [];

    // Get active challenges
    const challenges = await supabaseQuery(
        `challenges?select=id,name,start_date,end_date,challenge_type&status=eq.active`
    );

    for (const challenge of challenges) {
        // Get participants
        const participants = await supabaseQuery(
            `challenge_participants?select=user_id,points,joined_at&challenge_id=eq.${challenge.id}&status=eq.accepted`
        );

        for (const participant of participants) {
            if (!inScope(participant.user_id, excludeIds, clientScope)) continue;
            // Check their most recent points snapshot
            const snapshots = await supabaseQuery(
                `challenge_points_snapshots?select=snapshot_date,points&challenge_id=eq.${challenge.id}&user_id=eq.${participant.user_id}&order=snapshot_date.desc&limit=3`
            );

            // If no progress in last 2 days
            if (snapshots.length >= 2 && snapshots[0].points === snapshots[1].points) {
                const user = await supabaseQuery(`users?select=id,name,email&id=eq.${participant.user_id}&limit=1`);
                if (!user[0]) continue;

                // Check for existing alert
                const existing = await supabaseQuery(
                    `coach_alerts?client_id=eq.${participant.user_id}&alert_type=eq.challenge_dropout&status=eq.pending&data->>challenge_id=eq.${challenge.id}&created_at=gte.${new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()}&limit=1`
                );
                if (existing.length > 0) continue;

                alerts.push({
                    client_id: participant.user_id,
                    client_name: user[0].name || user[0].email?.split('@')[0],
                    alert_type: 'challenge_dropout',
                    priority: 'high',
                    title: `${user[0].name || user[0].email?.split('@')[0]} stalling in "${challenge.name}"`,
                    description: `No point progress in the last 2+ days. Currently at ${participant.points || 0} points.`,
                    data: { challenge_id: challenge.id, challenge_name: challenge.name, current_points: participant.points },
                });
            }
        }
    }
    return alerts;
}

/**
 * Scan for wins to celebrate — PBs, streak milestones, consistent tracking
 */
async function checkWinsToCelebrate(excludeIds = new Set(), clientScope = null) {
    const alerts = [];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Check for new personal bests in the last 24h
    const recentPBs = await supabaseQuery(
        `personal_bests?select=user_id,exercise_name,weight_kg,reps,achieved_date&achieved_date=gte.${yesterday}&order=achieved_date.desc&limit=20`
    );

    for (const pb of recentPBs) {
        if (!inScope(pb.user_id, excludeIds, clientScope)) continue;
        const user = await supabaseQuery(`users?select=id,name,email&id=eq.${pb.user_id}&limit=1`);
        if (!user[0]) continue;

        const existing = await supabaseQuery(
            `coach_alerts?client_id=eq.${pb.user_id}&alert_type=eq.win_to_celebrate&status=eq.pending&data->>exercise_name=eq.${encodeURIComponent(pb.exercise_name)}&created_at=gte.${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}&limit=1`
        );
        if (existing.length > 0) continue;

        alerts.push({
            client_id: pb.user_id,
            client_name: user[0].name || user[0].email?.split('@')[0],
            alert_type: 'win_to_celebrate',
            priority: 'medium',
            title: `${user[0].name || user[0].email?.split('@')[0]} hit a PB! ${pb.exercise_name}: ${pb.weight_kg}kg x ${pb.reps}`,
            description: `New personal best achieved ${pb.achieved_date}. Great moment to send some encouragement!`,
            data: { exercise_name: pb.exercise_name, weight_kg: pb.weight_kg, reps: pb.reps },
        });
    }

    // Check for users with 7+ day streaks (via user_points table)
    const streakers = await supabaseQuery(
        `user_points?select=user_id,current_streak&current_streak=gte.7&order=current_streak.desc&limit=20`
    );

    for (const s of streakers) {
        if (!inScope(s.user_id, excludeIds, clientScope)) continue;
        // Only alert on milestone streaks: 7, 14, 21, 28, 30
        const milestones = [7, 14, 21, 28, 30, 50, 100];
        if (!milestones.includes(s.current_streak)) continue;

        const user = await supabaseQuery(`users?select=id,name,email&id=eq.${s.user_id}&limit=1`);
        if (!user[0]) continue;

        const existing = await supabaseQuery(
            `coach_alerts?client_id=eq.${s.user_id}&alert_type=eq.win_to_celebrate&status=eq.pending&data->>streak_days=eq.${s.current_streak}&limit=1`
        );
        if (existing.length > 0) continue;

        alerts.push({
            client_id: s.user_id,
            client_name: user[0].name || user[0].email?.split('@')[0],
            alert_type: 'win_to_celebrate',
            priority: 'medium',
            title: `${user[0].name || user[0].email?.split('@')[0]} is on a ${s.current_streak}-day streak!`,
            description: `They've been consistent for ${s.current_streak} days straight. Perfect time to acknowledge it.`,
            data: { streak_days: s.current_streak },
        });
    }

    return alerts;
}

/**
 * Scan for clients who haven't had a check-in review in 7+ days
 */
async function checkCheckinDue(excludeIds = new Set(), clientScope = null) {
    const alerts = [];
    const users = await supabaseQuery('users?select=id,name,email&order=name.asc');

    for (const user of users) {
        if (!inScope(user.id, excludeIds, clientScope)) continue;

        // Get their most recent daily check-in
        const checkins = await supabaseQuery(
            `daily_checkins?select=checkin_date&user_id=eq.${user.id}&order=checkin_date.desc&limit=1`
        );

        if (checkins.length === 0) continue; // Never checked in — onboarding scan handles this

        const lastCheckin = new Date(checkins[0].checkin_date);
        const daysSince = Math.floor((Date.now() - lastCheckin) / (1000 * 60 * 60 * 24));

        if (daysSince >= 7) {
            const existing = await supabaseQuery(
                `coach_alerts?client_id=eq.${user.id}&alert_type=eq.coaching_idea&status=eq.pending&data->>subtype=eq.checkin_due&created_at=gte.${new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()}&limit=1`
            );
            if (existing.length > 0) continue;

            alerts.push({
                client_id: user.id,
                client_name: user.name || user.email?.split('@')[0],
                alert_type: 'coaching_idea',
                priority: daysSince >= 14 ? 'high' : 'medium',
                title: `${user.name || user.email?.split('@')[0]} is due for a check-in (${daysSince} days)`,
                description: `Last check-in was ${lastCheckin.toLocaleDateString('en-AU')}. Good time to send a weekly review.`,
                data: { subtype: 'checkin_due', days_since_checkin: daysSince },
            });
        }
    }
    return alerts;
}

/**
 * Scan for clients not in any active challenge — suggest inviting them
 */
async function checkNotInChallenge(excludeIds = new Set(), clientScope = null) {
    const alerts = [];

    // Get active challenges
    const challenges = await supabaseQuery('challenges?select=id,name&status=eq.active');
    if (challenges.length === 0) return alerts; // No active challenges

    // Get all users who ARE in an active challenge
    const challengeIds = challenges.map(c => c.id);
    let participantIds = new Set();
    for (const cId of challengeIds) {
        const participants = await supabaseQuery(
            `challenge_participants?select=user_id&challenge_id=eq.${cId}&status=eq.accepted`
        );
        participants.forEach(p => participantIds.add(p.user_id));
    }

    // Get all active users (logged in within last 14 days) who aren't in a challenge
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const activeUsers = await supabaseQuery(
        `users?select=id,name,email&last_login=gte.${cutoff}&order=name.asc`
    );

    for (const user of activeUsers) {
        if (!inScope(user.id, excludeIds, clientScope)) continue;
        if (participantIds.has(user.id)) continue;

        const existing = await supabaseQuery(
            `coach_alerts?client_id=eq.${user.id}&alert_type=eq.coaching_idea&status=eq.pending&data->>subtype=eq.not_in_challenge&created_at=gte.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}&limit=1`
        );
        if (existing.length > 0) continue;

        const challengeNames = challenges.map(c => c.name).join(', ');
        alerts.push({
            client_id: user.id,
            client_name: user.name || user.email?.split('@')[0],
            alert_type: 'coaching_idea',
            priority: 'low',
            title: `${user.name || user.email?.split('@')[0]} isn't in any challenge`,
            description: `Active user not participating in current challenges (${challengeNames}). Could be a good invite.`,
            data: { subtype: 'not_in_challenge', active_challenges: challengeNames },
        });
    }
    return alerts;
}

/**
 * Scan for new users who haven't logged anything yet (onboarding)
 */
async function checkNewUserOnboarding(excludeIds = new Set(), clientScope = null) {
    const alerts = [];
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    // Users who joined in the last 3 days
    const newUsers = await supabaseQuery(
        `users?select=id,name,email,created_at&created_at=gte.${threeDaysAgo}&order=created_at.desc`
    );

    for (const user of newUsers) {
        if (!inScope(user.id, excludeIds, clientScope)) continue;

        // Check if they've logged any meal or workout
        const meals = await supabaseQuery(`meal_logs?select=id&user_id=eq.${user.id}&limit=1`);
        const workouts = await supabaseQuery(`workouts?select=id&user_id=eq.${user.id}&workout_type=eq.history&limit=1`);

        if (meals.length > 0 || workouts.length > 0) continue; // They've started

        const existing = await supabaseQuery(
            `coach_alerts?client_id=eq.${user.id}&alert_type=eq.coaching_idea&status=eq.pending&data->>subtype=eq.new_user&limit=1`
        );
        if (existing.length > 0) continue;

        const hoursAgo = Math.floor((Date.now() - new Date(user.created_at)) / (1000 * 60 * 60));
        alerts.push({
            client_id: user.id,
            client_name: user.name || user.email?.split('@')[0],
            alert_type: 'coaching_idea',
            priority: hoursAgo >= 48 ? 'high' : 'medium',
            title: `New user ${user.name || user.email?.split('@')[0]} hasn't logged anything yet`,
            description: `Joined ${hoursAgo < 24 ? hoursAgo + 'h' : Math.floor(hoursAgo / 24) + ' days'} ago but no meals or workouts tracked. A welcome message could help.`,
            data: { subtype: 'new_user', hours_since_join: hoursAgo },
        });
    }
    return alerts;
}

/**
 * Scan for nutrition gaps — clients consistently missing protein/calorie goals
 */
async function checkNutritionGaps(excludeIds = new Set(), clientScope = null) {
    const alerts = [];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Get users with nutrition data in the last 7 days
    const nutrition = await supabaseQuery(
        `daily_nutrition?select=user_id,nutrition_date,total_calories,total_protein_g,calorie_goal,protein_goal_g&nutrition_date=gte.${weekAgo}&order=user_id,nutrition_date.desc`
    );

    // Group by user
    const byUser = {};
    for (const n of nutrition) {
        if (!inScope(n.user_id, excludeIds, clientScope)) continue;
        if (!byUser[n.user_id]) byUser[n.user_id] = [];
        byUser[n.user_id].push(n);
    }

    for (const [userId, days] of Object.entries(byUser)) {
        if (days.length < 3) continue; // Need at least 3 days of data

        const proteinGoal = days[0].protein_goal_g;
        const calorieGoal = days[0].calorie_goal;
        if (!proteinGoal && !calorieGoal) continue;

        // Check protein
        if (proteinGoal) {
            const avgProtein = days.reduce((s, d) => s + (d.total_protein_g || 0), 0) / days.length;
            const proteinPct = Math.round((avgProtein / proteinGoal) * 100);

            if (proteinPct < 60) {
                const existing = await supabaseQuery(
                    `coach_alerts?client_id=eq.${userId}&alert_type=eq.nutrition_gap&status=eq.pending&created_at=gte.${new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()}&limit=1`
                );
                if (existing.length > 0) continue;

                const user = await supabaseQuery(`users?select=id,name,email&id=eq.${userId}&limit=1`);
                if (!user[0]) continue;

                alerts.push({
                    client_id: userId,
                    client_name: user[0].name || user[0].email?.split('@')[0],
                    alert_type: 'nutrition_gap',
                    priority: proteinPct < 40 ? 'high' : 'medium',
                    title: `${user[0].name || user[0].email?.split('@')[0]} is only hitting ${proteinPct}% of protein goal`,
                    description: `Averaging ${Math.round(avgProtein)}g protein vs ${proteinGoal}g goal over ${days.length} days. Could use some nutrition coaching.`,
                    data: { avg_protein: Math.round(avgProtein), protein_goal: proteinGoal, protein_pct: proteinPct, days_tracked: days.length },
                });
            }
        }
    }
    return alerts;
}

/**
 * Scan for workout drop-off — was training regularly, suddenly stopped
 */
async function checkWorkoutDropoff(excludeIds = new Set(), clientScope = null) {
    const alerts = [];
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Get users with workout history in the past 2 weeks
    const workouts = await supabaseQuery(
        `workouts?select=user_id,workout_date&workout_type=eq.history&workout_date=gte.${twoWeeksAgo}&order=user_id,workout_date.desc`
    );

    // Group by user
    const byUser = {};
    for (const w of workouts) {
        if (!inScope(w.user_id, excludeIds, clientScope)) continue;
        if (!byUser[w.user_id]) byUser[w.user_id] = [];
        byUser[w.user_id].push(w.workout_date);
    }

    for (const [userId, dates] of Object.entries(byUser)) {
        const uniqueDates = [...new Set(dates)];
        const week1 = uniqueDates.filter(d => d >= oneWeekAgo).length; // This week
        const week2 = uniqueDates.filter(d => d < oneWeekAgo).length;  // Last week

        // Drop-off: trained 3+ times last week, 0 this week
        if (week2 >= 3 && week1 === 0) {
            const existing = await supabaseQuery(
                `coach_alerts?client_id=eq.${userId}&alert_type=eq.coaching_idea&status=eq.pending&data->>subtype=eq.workout_dropoff&created_at=gte.${new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()}&limit=1`
            );
            if (existing.length > 0) continue;

            const user = await supabaseQuery(`users?select=id,name,email&id=eq.${userId}&limit=1`);
            if (!user[0]) continue;

            alerts.push({
                client_id: userId,
                client_name: user[0].name || user[0].email?.split('@')[0],
                alert_type: 'coaching_idea',
                priority: 'medium',
                title: `${user[0].name || user[0].email?.split('@')[0]} trained ${week2}x last week but 0 this week`,
                description: `Was on a good rhythm. Quick check-in could help get them back on track.`,
                data: { subtype: 'workout_dropoff', last_week_sessions: week2, this_week_sessions: week1 },
            });
        }
    }
    return alerts;
}

/**
 * Scan for meal tracking drop-off — was logging daily, stopped for 2+ days
 */
async function checkMealDropoff(excludeIds = new Set(), clientScope = null) {
    const alerts = [];

    // Get users who had meal logs in the last 7 days but nothing in last 2
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const recentMeals = await supabaseQuery(
        `meal_logs?select=user_id,meal_date&meal_date=gte.${weekAgo}&order=user_id,meal_date.desc`
    );

    const byUser = {};
    for (const m of recentMeals) {
        if (!inScope(m.user_id, excludeIds, clientScope)) continue;
        if (!byUser[m.user_id]) byUser[m.user_id] = [];
        byUser[m.user_id].push(m.meal_date);
    }

    for (const [userId, dates] of Object.entries(byUser)) {
        const uniqueDates = [...new Set(dates)].sort().reverse();
        if (uniqueDates.length < 3) continue; // Need a pattern of logging

        const mostRecent = uniqueDates[0];
        if (mostRecent >= twoDaysAgo) continue; // Still active

        const daysSinceLastMeal = Math.floor((Date.now() - new Date(mostRecent)) / (1000 * 60 * 60 * 24));

        const existing = await supabaseQuery(
            `coach_alerts?client_id=eq.${userId}&alert_type=eq.coaching_idea&status=eq.pending&data->>subtype=eq.meal_dropoff&created_at=gte.${new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()}&limit=1`
        );
        if (existing.length > 0) continue;

        const user = await supabaseQuery(`users?select=id,name,email&id=eq.${userId}&limit=1`);
        if (!user[0]) continue;

        alerts.push({
            client_id: userId,
            client_name: user[0].name || user[0].email?.split('@')[0],
            alert_type: 'coaching_idea',
            priority: 'low',
            title: `${user[0].name || user[0].email?.split('@')[0]} stopped logging meals (${daysSinceLastMeal} days)`,
            description: `Was tracking meals regularly but nothing logged since ${mostRecent}. Gentle nudge might help.`,
            data: { subtype: 'meal_dropoff', days_since_meal: daysSinceLastMeal, total_days_tracked: uniqueDates.length },
        });
    }
    return alerts;
}

/**
 * Scan for level ups — client just hit a new level milestone
 */
async function checkLevelUps(excludeIds = new Set(), clientScope = null) {
    const alerts = [];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const milestones = await supabaseQuery(
        `level_milestones?select=user_id,level_reached,title_earned,achieved_at&achieved_at=gte.${yesterday}&order=achieved_at.desc&limit=30`
    );

    for (const m of milestones) {
        if (!inScope(m.user_id, excludeIds, clientScope)) continue;

        const existing = await supabaseQuery(
            `coach_alerts?client_id=eq.${m.user_id}&alert_type=eq.win_to_celebrate&status=eq.pending&data->>subtype=eq.level_up&data->>level=eq.${m.level_reached}&limit=1`
        );
        if (existing.length > 0) continue;

        const user = await supabaseQuery(`users?select=id,name,email&id=eq.${m.user_id}&limit=1`);
        if (!user[0]) continue;

        alerts.push({
            client_id: m.user_id,
            client_name: user[0].name || user[0].email?.split('@')[0],
            alert_type: 'win_to_celebrate',
            priority: 'medium',
            title: `${user[0].name || user[0].email?.split('@')[0]} leveled up to Level ${m.level_reached}!`,
            description: `${m.title_earned ? `Earned title: "${m.title_earned}". ` : ''}Great moment to celebrate with them.`,
            data: { subtype: 'level_up', level: m.level_reached, title: m.title_earned },
        });
    }
    return alerts;
}

/**
 * Scan for comebacks — was inactive 5+ days and just logged back in
 */
async function checkComebacks(excludeIds = new Set(), clientScope = null) {
    const alerts = [];
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Users who logged in today/yesterday
    const recentLogins = await supabaseQuery(
        `users?select=id,name,email,last_login&last_login=gte.${yesterday}&order=last_login.desc`
    );

    for (const user of recentLogins) {
        if (!inScope(user.id, excludeIds, clientScope)) continue;

        // Check if they had an inactive_client alert recently (meaning they WERE inactive)
        const wasInactive = await supabaseQuery(
            `coach_alerts?client_id=eq.${user.id}&alert_type=eq.inactive_client&created_at=gte.${new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()}&limit=1`
        );
        if (wasInactive.length === 0) continue; // Wasn't flagged as inactive

        const existing = await supabaseQuery(
            `coach_alerts?client_id=eq.${user.id}&alert_type=eq.win_to_celebrate&status=eq.pending&data->>subtype=eq.comeback&created_at=gte.${new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()}&limit=1`
        );
        if (existing.length > 0) continue;

        alerts.push({
            client_id: user.id,
            client_name: user.name || user.email?.split('@')[0],
            alert_type: 'win_to_celebrate',
            priority: 'medium',
            title: `${user.name || user.email?.split('@')[0]} is back!`,
            description: `Was inactive but just logged in again. Welcome them back before they drift off.`,
            data: { subtype: 'comeback' },
        });
    }
    return alerts;
}

/**
 * Scan for mood/energy patterns — scores trending down over a week
 */
async function checkMoodPatterns(excludeIds = new Set(), clientScope = null) {
    const alerts = [];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const moods = await supabaseQuery(
        `mood?select=user_id,mood_score,energy_score,log_date&logged_at=gte.${weekAgo}&order=user_id,log_date.desc`
    );

    const byUser = {};
    for (const m of moods) {
        if (!inScope(m.user_id, excludeIds, clientScope)) continue;
        if (!byUser[m.user_id]) byUser[m.user_id] = [];
        byUser[m.user_id].push(m);
    }

    for (const [userId, entries] of Object.entries(byUser)) {
        if (entries.length < 3) continue;

        // Check energy trend
        const avgEnergy = entries.reduce((s, e) => s + (e.energy_score || 0), 0) / entries.length;
        const avgMood = entries.reduce((s, e) => s + (e.mood_score || 0), 0) / entries.length;

        if (avgEnergy <= 4 || avgMood <= 4) {
            const existing = await supabaseQuery(
                `coach_alerts?client_id=eq.${userId}&alert_type=eq.coaching_idea&status=eq.pending&data->>subtype=eq.mood_low&created_at=gte.${new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()}&limit=1`
            );
            if (existing.length > 0) continue;

            const user = await supabaseQuery(`users?select=id,name,email&id=eq.${userId}&limit=1`);
            if (!user[0]) continue;

            const issue = avgEnergy <= 4 && avgMood <= 4 ? 'energy and mood' : avgEnergy <= 4 ? 'energy' : 'mood';
            alerts.push({
                client_id: userId,
                client_name: user[0].name || user[0].email?.split('@')[0],
                alert_type: 'coaching_idea',
                priority: 'medium',
                title: `${user[0].name || user[0].email?.split('@')[0]}'s ${issue} is low this week`,
                description: `Avg energy: ${avgEnergy.toFixed(1)}/10, avg mood: ${avgMood.toFixed(1)}/10 over ${entries.length} entries. Might need some support.`,
                data: { subtype: 'mood_low', avg_energy: avgEnergy.toFixed(1), avg_mood: avgMood.toFixed(1) },
            });
        }
    }
    return alerts;
}

/**
 * Scan for wearable insights — recovery/HRV/sleep trending down
 */
async function checkWearableInsights(excludeIds = new Set(), clientScope = null) {
    const alerts = [];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // WHOOP recovery scores
    try {
        const recovery = await supabaseQuery(
            `whoop_recovery?select=user_id,date,recovery_score&date=gte.${weekAgo}&order=user_id,date.desc`
        );

        const byUser = {};
        for (const r of recovery) {
            if (!inScope(r.user_id, excludeIds, clientScope)) continue;
            if (!byUser[r.user_id]) byUser[r.user_id] = [];
            byUser[r.user_id].push(r);
        }

        for (const [userId, entries] of Object.entries(byUser)) {
            if (entries.length < 3) continue;
            const avgRecovery = entries.reduce((s, e) => s + (e.recovery_score || 0), 0) / entries.length;

            if (avgRecovery < 40) {
                const existing = await supabaseQuery(
                    `coach_alerts?client_id=eq.${userId}&alert_type=eq.coaching_idea&status=eq.pending&data->>subtype=eq.wearable_low&created_at=gte.${new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()}&limit=1`
                );
                if (existing.length > 0) continue;

                const user = await supabaseQuery(`users?select=id,name,email&id=eq.${userId}&limit=1`);
                if (!user[0]) continue;

                alerts.push({
                    client_id: userId,
                    client_name: user[0].name || user[0].email?.split('@')[0],
                    alert_type: 'coaching_idea',
                    priority: 'medium',
                    title: `${user[0].name || user[0].email?.split('@')[0]}'s WHOOP recovery is low (${Math.round(avgRecovery)}%)`,
                    description: `Avg recovery ${Math.round(avgRecovery)}% over ${entries.length} days. May need lighter training or recovery focus.`,
                    data: { subtype: 'wearable_low', source: 'whoop', avg_recovery: Math.round(avgRecovery) },
                });
            }
        }
    } catch (e) { /* WHOOP table may not exist for all users */ }

    return alerts;
}

/**
 * Use Gemini to generate a suggested message for each alert
 */
async function generateSuggestedMessages(alerts) {
    if (!GEMINI_API_KEY || alerts.length === 0) return alerts;

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    // Batch alerts into one prompt for efficiency
    const alertSummaries = alerts.map((a, i) =>
        `Alert ${i + 1}: [${a.alert_type}] ${a.title}\nContext: ${a.description}\nClient: ${a.client_name}`
    ).join('\n\n');

    const prompt = `You are Shannon's AI assistant. Shannon is an Australian plant-based fitness coach.

For each alert below, write a SHORT suggested message Shannon could send to the client. Write as Shannon — casual, Australian, lowercase, punchy. Like texting a mate.

Rules:
- Keep each message under 3 sentences
- Match Shannon's voice: "hey", "hows it going", "nah", "ya", ending sentences with "hey"
- NEVER use trailing apostrophes on shortened words. Write "checkin" not "checkin'", "goin" not "goin'", "comin" not "comin'". Shannon doesn't use those.
- Natural typos and casual spelling are good: "aweosme", "arnt", "begining", "dam", "hows"
- For inactive clients: gentle check-in, not guilt-tripping
- For unread messages: draft a quick reply based on what the client said
- For challenge dropouts: motivating nudge
- For wins/level ups/comebacks: brief celebration, genuine
- For nutrition gaps: helpful not judgmental, suggest easy protein ideas
- For workout/meal drop-off: casual "whats been going on" vibe
- For check-in due: prompt to do a weekly review
- For new users: warm welcome, get them started
- For not in challenge: casual invite, no pressure
- For mood/energy low: empathetic, check how they're doing
- For wearable insights: suggest recovery focus
- No emojis or very sparingly (max 1)
- Use "n" instead of "and", "ya" for "you", "cuz" for "because"
- Use lowercase naturally, like texting a mate

RESPOND AS JSON ARRAY with one object per alert:
[{"index": 0, "message": "the suggested message"}, ...]

Alerts:
${alertSummaries}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { maxOutputTokens: 2048, temperature: 0.8 },
            }),
        });

        const data = await response.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Parse the JSON from the response
        const jsonMatch = reply.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const suggestions = JSON.parse(jsonMatch[0]);
            for (const suggestion of suggestions) {
                if (suggestion.index >= 0 && suggestion.index < alerts.length) {
                    alerts[suggestion.index].suggested_message = suggestion.message;
                }
            }
        }
    } catch (err) {
        console.error('Failed to generate AI suggestions:', err.message);
        // Alerts still work without AI suggestions
    }

    return alerts;
}

/**
 * Send WhatsApp notification summary to the coach
 */
async function sendWhatsAppSummary(alerts) {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
        console.log('WhatsApp not configured, skipping');
        return;
    }

    // Get coach notification prefs
    const prefs = await supabaseQuery('coach_notification_prefs?whatsapp_enabled=eq.true&limit=1');
    if (prefs.length === 0 || !prefs[0].whatsapp_number) {
        console.log('No WhatsApp number configured or WhatsApp disabled');
        return;
    }

    const pref = prefs[0];

    // Check quiet hours
    const now = new Date();
    const tz = pref.timezone || 'Australia/Brisbane';
    const hour = parseInt(now.toLocaleString('en-AU', { timeZone: tz, hour: 'numeric', hour12: false }));
    if (hour >= pref.quiet_hours_start || hour < pref.quiet_hours_end) {
        console.log(`Quiet hours (${pref.quiet_hours_start}-${pref.quiet_hours_end}), skipping WhatsApp`);
        return;
    }

    // Build summary message
    const urgent = alerts.filter(a => a.priority === 'urgent' || a.priority === 'high');
    if (urgent.length === 0 && alerts.length < 3) {
        console.log('Not enough alerts to warrant a WhatsApp notification');
        return;
    }

    let body = `*Balance Coach Alert* (${alerts.length} new)\n\n`;

    const topAlerts = alerts.slice(0, 5);
    for (const alert of topAlerts) {
        const icon = alert.priority === 'urgent' ? '🔴' : alert.priority === 'high' ? '🟠' : alert.alert_type === 'win_to_celebrate' ? '🎉' : '📋';
        body += `${icon} ${alert.title}\n`;
    }
    if (alerts.length > 5) {
        body += `\n+${alerts.length - 5} more alerts`;
    }
    body += '\n\nOpen the admin dashboard to review and act.';

    // Send via Twilio
    try {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
        const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

        await fetch(twilioUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                From: TWILIO_WHATSAPP_FROM,
                To: `whatsapp:${pref.whatsapp_number}`,
                Body: body,
            }).toString(),
        });

        console.log('WhatsApp summary sent');
    } catch (err) {
        console.error('WhatsApp send failed:', err.message);
    }
}

/**
 * Send push notification to a specific coach by user ID.
 */
async function sendCoachPushToUser(coachUserId, alerts) {
    if (alerts.length === 0) return;

    const urgent = alerts.filter(a => a.priority === 'urgent' || a.priority === 'high');
    const count = urgent.length || alerts.length;
    const topAlert = urgent[0] || alerts[0];

    const title = 'Coach Alert';
    const body = `${count} client${count > 1 ? 's' : ''} need attention — ${topAlert.title}`;

    try {
        const subs = await supabaseQuery(
            `push_subscriptions?select=endpoint,p256dh,auth&user_id=eq.${coachUserId}`
        );
        if (subs.length === 0) return;

        for (const sub of subs) {
            const isNative = sub.endpoint && sub.endpoint.startsWith('native://');
            if (isNative) {
                await sendFCMPush(sub.auth, title, body);
            } else {
                try {
                    await fetch(`${SITE_URL}/.netlify/functions/send-dm-notification`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            recipientId: coachUserId,
                            senderName: title,
                            messageText: body,
                            senderId: 'coach_alert',
                        }),
                    });
                } catch (e) { console.warn('Web push fallback failed:', e.message); }
            }
        }
    } catch (err) {
        console.error(`Push to coach ${coachUserId} failed:`, err.message);
    }
}

/**
 * Send push notification directly to all admin devices.
 * Fetches push subscriptions from Supabase and sends via FCM (native) or
 * web-push (browser). Does NOT call send-dm-notification to avoid self-referencing
 * HTTP calls from scheduled functions, which can be unreliable on Netlify.
 */
async function sendCoachPush(alerts) {
    if (alerts.length === 0) return;

    const urgent = alerts.filter(a => a.priority === 'urgent' || a.priority === 'high');
    const count = urgent.length || alerts.length;
    const topAlert = urgent[0] || alerts[0];

    const title = 'Coach Alert';
    const body = `${count} client${count > 1 ? 's' : ''} need attention — ${topAlert.title}`;

    try {
        // Get admin user IDs
        const admins = await supabaseQuery('admin_users?select=user_id&limit=5');

        for (const admin of admins) {
            // Fetch their push subscriptions directly
            const subs = await supabaseQuery(
                `push_subscriptions?select=endpoint,p256dh,auth&user_id=eq.${admin.user_id}`
            );

            if (subs.length === 0) {
                console.log(`No push subscriptions for admin ${admin.user_id}`);
                continue;
            }

            for (const sub of subs) {
                const isNative = sub.endpoint && sub.endpoint.startsWith('native://');

                if (isNative) {
                    // Send via FCM using the auth field as the FCM token
                    await sendFCMPush(sub.auth, title, body);
                } else {
                    // Send via Web Push — call the DM notification endpoint as fallback
                    // since web-push requires the npm library which isn't available here
                    try {
                        await fetch(`${SITE_URL}/.netlify/functions/send-dm-notification`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                recipientId: admin.user_id,
                                senderName: title,
                                messageText: body,
                                senderId: 'coach_alert',
                            }),
                        });
                    } catch (e) {
                        console.warn('Web push fallback failed:', e.message);
                    }
                }
            }
        }
        console.log('Push notifications sent to admin(s)');
    } catch (err) {
        console.error('Push notification failed:', err.message);
    }
}

/**
 * Send a push notification via Firebase Cloud Messaging V1 API.
 * Uses a short-lived JWT signed with the service account private key.
 */
async function sendFCMPush(fcmToken, title, body) {
    let serviceAccount = null;
    try {
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        } else if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PROJECT_ID) {
            serviceAccount = {
                client_email: process.env.FIREBASE_CLIENT_EMAIL,
                private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                project_id: process.env.FIREBASE_PROJECT_ID,
            };
        }
    } catch (e) { console.error('Firebase config parse error:', e.message); }

    if (!serviceAccount) {
        console.log('No Firebase config — skipping FCM push');
        return;
    }

    try {
        const crypto = require('crypto');
        const now = Math.floor(Date.now() / 1000);
        const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify({
            iss: serviceAccount.client_email,
            scope: 'https://www.googleapis.com/auth/firebase.messaging',
            aud: 'https://oauth2.googleapis.com/token',
            iat: now,
            exp: now + 3600
        })).toString('base64url');
        const sign = crypto.createSign('RSA-SHA256');
        sign.update(`${header}.${payload}`);
        const signature = sign.sign(serviceAccount.private_key, 'base64url');
        const jwt = `${header}.${payload}.${signature}`;

        const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
        });
        const tokenData = await tokenResp.json();
        if (!tokenData.access_token) throw new Error('No access token');

        const fcmUrl = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;
        const resp = await fetch(fcmUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: {
                    token: fcmToken,
                    notification: { title, body },
                    android: {
                        priority: 'high',
                        notification: { channel_id: 'coach-alerts', sound: 'default', click_action: 'FCM_PLUGIN_ACTIVITY' }
                    },
                    data: { type: 'dm_message', senderId: 'coach_alert', url: './admin-dashboard.html' }
                }
            })
        });

        if (!resp.ok) {
            const errText = await resp.text();
            console.error('FCM error:', resp.status, errText);
        } else {
            console.log('FCM push sent successfully');
        }
    } catch (err) {
        console.error('FCM push failed:', err.message);
    }
}

exports.handler = async (event) => {
    console.log('🤖 AI Client Monitor scan started');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.error('Missing Supabase configuration');
        return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error' }) };
    }

    try {
        // ============================================================
        // MULTI-COACH: Get all coaches and their assigned clients
        // ============================================================
        const admins = await supabaseQuery('admin_users?select=user_id,role&limit=20');
        if (admins.length === 0) {
            console.log('No admin users found');
            return { statusCode: 200, body: JSON.stringify({ message: 'No coaches configured' }) };
        }

        // Build the full set of admin/coach IDs (to exclude from scans)
        const excludeIds = new Set();
        admins.forEach(a => excludeIds.add(a.user_id));

        // Also add known coach email accounts
        const coachEmails = [
            'shannon@plantbasedbalance.com',
            'shannon.birch@cocospersonaltraining.com',
            'shannon@plantbased-balance.org',
            'shannonbirch@cocospersonaltraining.com'
        ];
        try {
            const coachAccounts = await supabaseQuery(
                `users?select=id&email=in.(${coachEmails.map(e => `"${e}"`).join(',')})`
            );
            coachAccounts.forEach(c => excludeIds.add(c.id));
        } catch (e) { /* ignore */ }

        console.log(`Found ${admins.length} coach(es), excluding ${excludeIds.size} admin account(s)`);

        let totalAlerts = 0;

        // ============================================================
        // Run scans for EACH coach, scoped to their clients
        // ============================================================
        for (const admin of admins) {
            const coachId = admin.user_id;
            const isSuperAdmin = admin.role === 'super_admin';

            // Get this coach's assigned client IDs
            let clientScope = null; // null = all clients (super admin)
            if (!isSuperAdmin) {
                try {
                    const assignments = await supabaseQuery(
                        `coach_clients?select=client_id&coach_id=eq.${coachId}&status=eq.active`
                    );
                    clientScope = new Set(assignments.map(a => a.client_id));
                    console.log(`Coach ${coachId}: ${clientScope.size} assigned clients`);
                    if (clientScope.size === 0) continue; // No clients assigned
                } catch (e) {
                    console.warn(`Could not load clients for coach ${coachId}:`, e.message);
                    continue;
                }
            } else {
                console.log(`Coach ${coachId}: super_admin — scanning all clients`);
            }

            // Get this coach's DM inbox IDs (their user_id + any email aliases)
            const coachInboxIds = [coachId];
            try {
                const coachUser = await supabaseQuery(`users?select=email&id=eq.${coachId}&limit=1`);
                if (coachUser[0]?.email) {
                    // Check if any of the known coach emails resolve to different IDs
                    for (const email of coachEmails) {
                        const acc = await supabaseQuery(`users?select=id&email=eq.${encodeURIComponent(email)}&limit=1`);
                        if (acc[0] && !coachInboxIds.includes(acc[0].id)) {
                            coachInboxIds.push(acc[0].id);
                        }
                    }
                }
            } catch (e) { /* use just the main ID */ }

            // Build "recently contacted" set — clients the coach messaged in the last 3 days.
            // We skip all non-unread alerts for these clients (no point nagging about
            // someone you're already talking to).
            const recentlyContacted = new Set();
            try {
                const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
                for (const inboxId of coachInboxIds) {
                    const sent = await supabaseQuery(
                        `nudges?select=receiver_id&sender_id=eq.${inboxId}&created_at=gte.${threeDaysAgo}&order=created_at.desc&limit=100`
                    );
                    sent.forEach(s => recentlyContacted.add(s.receiver_id));
                }
                if (recentlyContacted.size > 0) {
                    console.log(`Coach ${coachId}: recently contacted ${recentlyContacted.size} client(s) — will skip non-unread alerts for them`);
                }
            } catch (e) { console.warn('Could not build recently-contacted set:', e.message); }

            // Load this coach's preferences
            let inactiveDays = 2;
            let unreadHours = 4;
            try {
                const prefs = await supabaseQuery(`coach_notification_prefs?coach_id=eq.${coachId}&limit=1`);
                if (prefs.length > 0) {
                    inactiveDays = prefs[0].inactive_days_threshold || 2;
                    unreadHours = prefs[0].unread_hours_threshold || 4;
                }
            } catch (e) { /* use defaults */ }

            // Run all scans in parallel for this coach
            const [inactive, unread, challengeDropouts, wins, checkinDue, notInChallenge, newUsers, nutritionGaps, workoutDropoff, mealDropoff, levelUps, comebacks, moodPatterns, wearableInsights] = await Promise.all([
                checkInactiveClients(inactiveDays, excludeIds, clientScope).catch(e => { console.error('Inactive check failed:', e.message); return []; }),
                checkUnreadMessages(unreadHours, excludeIds, coachInboxIds, clientScope).catch(e => { console.error('Unread check failed:', e.message); return []; }),
                checkChallengeDropouts(excludeIds, clientScope).catch(e => { console.error('Challenge check failed:', e.message); return []; }),
                checkWinsToCelebrate(excludeIds, clientScope).catch(e => { console.error('Wins check failed:', e.message); return []; }),
                checkCheckinDue(excludeIds, clientScope).catch(e => { console.error('Checkin due check failed:', e.message); return []; }),
                checkNotInChallenge(excludeIds, clientScope).catch(e => { console.error('Not in challenge check failed:', e.message); return []; }),
                checkNewUserOnboarding(excludeIds, clientScope).catch(e => { console.error('New user check failed:', e.message); return []; }),
                checkNutritionGaps(excludeIds, clientScope).catch(e => { console.error('Nutrition check failed:', e.message); return []; }),
                checkWorkoutDropoff(excludeIds, clientScope).catch(e => { console.error('Workout dropoff check failed:', e.message); return []; }),
                checkMealDropoff(excludeIds, clientScope).catch(e => { console.error('Meal dropoff check failed:', e.message); return []; }),
                checkLevelUps(excludeIds, clientScope).catch(e => { console.error('Level up check failed:', e.message); return []; }),
                checkComebacks(excludeIds, clientScope).catch(e => { console.error('Comeback check failed:', e.message); return []; }),
                checkMoodPatterns(excludeIds, clientScope).catch(e => { console.error('Mood check failed:', e.message); return []; }),
                checkWearableInsights(excludeIds, clientScope).catch(e => { console.error('Wearable check failed:', e.message); return []; }),
            ]);

            let coachAlerts = [...inactive, ...unread, ...challengeDropouts, ...wins, ...checkinDue, ...notInChallenge, ...newUsers, ...nutritionGaps, ...workoutDropoff, ...mealDropoff, ...levelUps, ...comebacks, ...moodPatterns, ...wearableInsights];

            // Filter out alerts for clients we've recently been in touch with.
            // Some alert types ALWAYS show regardless:
            //   - unread_message: they need a reply
            //   - coaching_idea with subtype checkin_due: actual coaching work
            // Everything else gets suppressed if the coach has messaged this
            // client in the last 3 days (inactive, PBs, nutrition gaps, etc.)
            if (recentlyContacted.size > 0) {
                const before = coachAlerts.length;
                coachAlerts = coachAlerts.filter(a => {
                    if (a.alert_type === 'unread_message') return true;
                    if (a.alert_type === 'coaching_idea' && a.data?.subtype === 'checkin_due') return true;
                    if (a.client_id && recentlyContacted.has(a.client_id)) return false;
                    return true;
                });
                if (before !== coachAlerts.length) {
                    console.log(`Coach ${coachId}: suppressed ${before - coachAlerts.length} alerts for recently contacted clients`);
                }
            }

            if (coachAlerts.length === 0) {
                console.log(`Coach ${coachId}: no alerts`);
                continue;
            }

            // Tag every alert with this coach's ID
            coachAlerts.forEach(a => a.coach_id = coachId);

            // Generate AI-suggested messages
            coachAlerts = await generateSuggestedMessages(coachAlerts);

            // Insert alerts
            await supabaseQuery('coach_alerts', {
                method: 'POST',
                body: coachAlerts,
                prefer: 'return=minimal',
            });

            console.log(`Coach ${coachId}: inserted ${coachAlerts.length} alerts`);
            totalAlerts += coachAlerts.length;

            // Send push notification to this specific coach
            await sendCoachPushToUser(coachId, coachAlerts);
        }

        // Send WhatsApp summary (for coaches who have it enabled)
        // This queries coach_notification_prefs internally
        if (totalAlerts > 0) {
            await sendWhatsAppSummary([]).catch(e => console.warn('WhatsApp failed:', e.message));
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: `Generated ${totalAlerts} alerts across ${admins.length} coach(es)`,
                total_alerts: totalAlerts,
                coaches: admins.length,
            }),
        };
    } catch (err) {
        console.error('AI Client Monitor error:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Monitor failed', details: err.message }),
        };
    }
};
