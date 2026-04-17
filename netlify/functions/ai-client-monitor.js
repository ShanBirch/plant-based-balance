/**
 * AI Client Monitor — Scheduled Function
 *
 * Runs every 2 hours (configured in netlify.toml) to proactively scan all
 * clients and generate actionable alerts for the coach. Checks for:
 *
 *   1. Inactive clients (no login/tracking in X days)
 *   2. Unread messages waiting for coach reply
 *   3. Challenge participants falling behind
 *   4. Broken streaks
 *   5. Milestones worth celebrating
 *   6. Nutrition gaps
 *   …plus a dozen other proactive signal types (see generateSuggestedMessages).
 *
 * Each alert is Vertex-drafted with Shannon's voice and stored in coach_alerts.
 *
 * PUSH BEHAVIOUR (unified 2026-04-17 with the rest of the draft pipeline):
 *   - Every alert that has a suggested_message fires its OWN
 *     coach_draft_ready FCM push so Shannon gets a lockscreen
 *     notification with an inline-reply action pre-filled with the draft.
 *     Same UX as instant-coach-draft, pb-celebration-draft, morning-pulse,
 *     onboarding, etc. — send from the lockscreen without opening the app.
 *   - Alerts without a drafted message (rare — only if Vertex fully failed)
 *     still land in the admin feed, and a single aggregate "N clients need
 *     attention" summary push fires if no per-alert push went out.
 *   - WhatsApp summary still sends if enabled in coach_notification_prefs.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const SITE_URL = process.env.URL || 'https://plantbased-balance.org';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Fine-tuned Shannon voice model on Vertex AI (v7 — trained on 402 curated client conversations)
const VERTEX_PROJECT_ID = '103426154831';
const VERTEX_ENDPOINT_ID = '3547200982821634048';
const VERTEX_LOCATION = 'us-central1';

// Cached OAuth token for Vertex AI (reused across calls within a single function invocation)
let _vertexAccessTokenCache = { token: null, expiresAt: 0 };

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
    // Handle empty responses (e.g. return=minimal returns 201 with no body)
    const text = await response.text();
    if (!text || text.trim() === '') return [];
    try {
        return JSON.parse(text);
    } catch {
        console.warn(`Supabase response not JSON for ${path}:`, text.substring(0, 100));
        return [];
    }
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

    const coachIdSet = new Set(coachIds); // All coach inbox IDs (main + aliases)

    // NOTE: unread-message alerts intentionally IGNORE clientScope. If someone DMs the coach,
    // the coach needs to see it regardless of whether they're a formally assigned client
    // (friends, prospects, unassigned users still count). Only excludeIds (other admins/coaches)
    // is used to filter out coach-to-coach chatter.
    const msgScope = null;

    // Get recent nudges (DMs) sent TO the coach that haven't been read yet
    // The nudges table uses read_at (TIMESTAMPTZ, NULL if unread) not a boolean
    for (const coachId of coachIds) {
        const unread = await supabaseQuery(
            `nudges?select=id,sender_id,message,created_at,read_at&receiver_id=eq.${coachId}&read_at=is.null&created_at=lte.${cutoff}&order=created_at.asc&limit=20`
        );
        console.log(`[UnreadMessages] coach ${coachId}: ${unread.length} unread DM(s) older than ${hoursThreshold}h`);

        for (const msg of unread) {
            // Skip messages from other admin/coach accounts only
            if (!inScope(msg.sender_id, excludeIds, msgScope)) continue;

            // Check if we already alerted about this message (ANY status — if the coach
            // already dismissed/forgot/sent for this nudge_id, don't nag again).
            // This also deduplicates against `incoming_dm` alerts created by the
            // instant-coach-draft trigger — if the real-time handler already queued
            // a draft, we don't need a batch fallback.
            const existing = await supabaseQuery(
                `coach_alerts?alert_type=in.(unread_message,incoming_dm)&data->>nudge_id=eq.${msg.id}&limit=1`
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

        // Also check for conversations where the client spoke last (read but not replied).
        // Get ALL messages in this coach's inbox (sent or received) in last 7 days,
        // then find conversations where the last message is from the client.
        const allConvoMsgs = await supabaseQuery(
            `nudges?select=id,sender_id,receiver_id,message,created_at&or=(sender_id.eq.${coachId},receiver_id.eq.${coachId})&created_at=gte.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}&order=created_at.desc&limit=200`
        );

        // Group by conversation partner — first hit = most recent message
        const conversations = {};
        for (const msg of allConvoMsgs) {
            const partnerId = coachIdSet.has(msg.sender_id) ? msg.receiver_id : msg.sender_id;
            if (!conversations[partnerId]) {
                conversations[partnerId] = msg;
            }
        }

        // Find conversations where the client spoke last (coach hasn't replied)
        for (const [partnerId, lastMsg] of Object.entries(conversations)) {
            // Only alert if the LAST message was FROM the client (not from coach)
            if (coachIdSet.has(lastMsg.sender_id)) continue; // Coach spoke last — already replied

            // Skip other admin/coach accounts only — see note above re: clientScope
            if (!inScope(partnerId, excludeIds, msgScope)) continue;

            const hoursSince = Math.floor((Date.now() - new Date(lastMsg.created_at)) / (1000 * 60 * 60));
            if (hoursSince < hoursThreshold) continue; // Not old enough yet

            // Skip if we already alerted about this specific message (any status).
            // Dedup against both legacy unread_message and new incoming_dm alerts.
            const existingByMsg = await supabaseQuery(
                `coach_alerts?alert_type=in.(unread_message,incoming_dm)&data->>nudge_id=eq.${lastMsg.id}&limit=1`
            );
            if (existingByMsg.length > 0) continue;

            // Also skip if we have any pending alert for this client in last 24h
            const existingByClient = await supabaseQuery(
                `coach_alerts?alert_type=in.(unread_message,incoming_dm)&status=eq.pending&client_id=eq.${partnerId}&created_at=gte.${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}&limit=1`
            );
            if (existingByClient.length > 0) continue;

            const senders = await supabaseQuery(`users?select=id,name,email&id=eq.${partnerId}&limit=1`);
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
            `challenge_participants?select=user_id,current_points,challenge_points,accepted_at&challenge_id=eq.${challenge.id}&status=eq.accepted`
        );

        for (const participant of participants) {
            if (!inScope(participant.user_id, excludeIds, clientScope)) continue;
            // Check their most recent points snapshot
            const snapshots = await supabaseQuery(
                `challenge_points_snapshots?select=snapshot_date,challenge_points&challenge_id=eq.${challenge.id}&user_id=eq.${participant.user_id}&order=snapshot_date.desc&limit=3`
            );

            // If no progress in last 2 days
            if (snapshots.length >= 2 && snapshots[0].challenge_points === snapshots[1].challenge_points) {
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
                    description: `No point progress in the last 2+ days. Currently at ${participant.challenge_points || 0} points.`,
                    data: { challenge_id: challenge.id, challenge_name: challenge.name, current_points: participant.challenge_points },
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
    // Table columns: best_weight_kg, best_weight_reps, best_weight_date, best_reps, best_reps_weight_kg, best_reps_date
    const recentPBs = await supabaseQuery(
        `personal_bests?select=user_id,exercise_name,best_weight_kg,best_weight_reps,best_weight_date,updated_at&updated_at=gte.${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}&order=updated_at.desc&limit=20`
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
            title: `${user[0].name || user[0].email?.split('@')[0]} hit a PB! ${pb.exercise_name}: ${pb.best_weight_kg}kg x ${pb.best_weight_reps}`,
            description: `New personal best achieved ${pb.best_weight_date || 'recently'}. Great moment to send some encouragement!`,
            data: { exercise_name: pb.exercise_name, weight_kg: pb.best_weight_kg, reps: pb.best_weight_reps },
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
// Strip robotic "hey {name}," / "hi mate!" style greetings from the start of
// AI-drafted replies. Only touches the very first token/phrase so message body
// is preserved.
function stripLeadingGreeting(text) {
    if (!text) return text;
    let out = String(text).trim();
    // Repeat in case there are stacked greetings ("hey mate, hi there,")
    for (let i = 0; i < 3; i++) {
        const before = out;
        out = out.replace(/^(hey|hi|hello|yo|heya|howdy|g'day|gday|oi)\b[^\n.!?]*?[,!\-—:]\s*/i, '');
        // Also strip bare "hey " / "hi " when followed by a word (no punctuation)
        out = out.replace(/^(hey|hi|hello|yo)\s+(?=[a-z])/i, '');
        if (out === before) break;
    }
    out = out.trim();
    // Lowercase the first letter if the original was lowercase-style
    if (out && /^[A-Z][a-z]/.test(out) && /[a-z]/.test(text)) {
        out = out[0].toLowerCase() + out.slice(1);
    }
    return out || text;
}

/**
 * Load the Firebase service account (reused for Vertex AI auth).
 * Requires `Vertex AI User` role granted to the service account in GCP IAM.
 */
function getGCPServiceAccount() {
    try {
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        }
        if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PROJECT_ID) {
            return {
                client_email: process.env.FIREBASE_CLIENT_EMAIL,
                private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                project_id: process.env.FIREBASE_PROJECT_ID,
            };
        }
    } catch (e) { console.error('GCP service account parse error:', e.message); }
    return null;
}

/**
 * Get an OAuth2 access token for Vertex AI using JWT bearer flow.
 * Same pattern as FCM auth — just with cloud-platform scope.
 * Caches the token for ~55 minutes to avoid re-signing on every call.
 */
async function getVertexAIAccessToken() {
    const now = Math.floor(Date.now() / 1000);
    if (_vertexAccessTokenCache.token && _vertexAccessTokenCache.expiresAt > now + 60) {
        return _vertexAccessTokenCache.token;
    }

    const serviceAccount = getGCPServiceAccount();
    if (!serviceAccount) throw new Error('No GCP service account configured (FIREBASE_SERVICE_ACCOUNT or FIREBASE_CLIENT_EMAIL/PRIVATE_KEY/PROJECT_ID)');

    const crypto = require('crypto');
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
        iss: serviceAccount.client_email,
        scope: 'https://www.googleapis.com/auth/cloud-platform',
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
    if (!tokenData.access_token) throw new Error(`Vertex token exchange failed: ${JSON.stringify(tokenData)}`);

    _vertexAccessTokenCache = {
        token: tokenData.access_token,
        expiresAt: now + (tokenData.expires_in || 3600),
    };
    return tokenData.access_token;
}

/**
 * Call the fine-tuned Shannon model on Vertex AI.
 * Request/response format matches Gemini's generateContent API.
 * @returns the raw text from the first candidate
 */
async function callVertexAIModel(contents, generationConfig = {}) {
    const accessToken = await getVertexAIAccessToken();
    const url = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT_ID}/locations/${VERTEX_LOCATION}/endpoints/${VERTEX_ENDPOINT_ID}:generateContent`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents,
            generationConfig: {
                maxOutputTokens: 2048,
                temperature: 0.8,
                ...generationConfig,
            },
        }),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Vertex AI call failed: ${response.status} ${errText.slice(0, 500)}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function generateSuggestedMessages(alerts) {
    if (alerts.length === 0) return alerts;

    // Batch alerts into one prompt for efficiency
    const alertSummaries = alerts.map((a, i) =>
        `Alert ${i + 1}: [${a.alert_type}] ${a.title}\nContext: ${a.description}\nClient: ${a.client_name}`
    ).join('\n\n');

    // Learn from Shannon's edits: pull recent sent alerts where he edited the
    // AI draft before sending. These become few-shot examples so the AI drifts
    // toward his actual voice over time.
    let editExamples = '';
    try {
        const recentEdits = await supabaseQuery(
            `coach_alerts?select=alert_type,suggested_message,data&status=eq.sent&data->>sent_message=not.is.null&order=actioned_at.desc&limit=15`
        );
        const goodExamples = recentEdits
            .filter(e => e.data?.sent_message && e.data.sent_message !== e.suggested_message)
            .slice(0, 8);
        if (goodExamples.length > 0) {
            editExamples = '\n\nLEARN FROM PAST EDITS — Shannon rewrote these AI drafts into how he actually talks. Mimic the SECOND version:\n\n' +
                goodExamples.map((e, i) =>
                    `Example ${i + 1} (${e.alert_type}):\nAI draft: ${e.suggested_message}\nShannon rewrote it to: ${e.data.sent_message}`
                ).join('\n\n');
        }
    } catch (e) {
        console.warn('Could not load edit examples:', e.message);
    }

    // Short structural prompt — the fine-tuned model already knows Shannon's voice.
    // We just need to give it the alert context and the output format.
    const prompt = `For each alert below, write a SHORT message for the coach to send their client.

CRITICAL — DO NOT GREET: Never start with "hey [name]", "hi", "yo". Jump straight into content. These are ongoing conversations, not first messages.

Alert-type guidance:
- inactive_client: gentle check-in
- unread_message: react to the client's actual words
- challenge_dropout: motivating nudge
- win_to_celebrate / level_up / comeback: brief celebration
- nutrition_gap: helpful not judgmental
- workout_dropoff / meal_dropoff: casual "whats up"
- checkin_due: prompt weekly review
- new_user_onboarding: warm welcome (greeting OK here)
- not_in_challenge: casual invite
- mood/energy low: empathetic
- wearable: suggest recovery focus${editExamples}

Respond as JSON array, one object per alert:
[{"index": 0, "message": "..."}, ...]

Alerts:
${alertSummaries}`;

    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const generationConfig = { maxOutputTokens: 2048, temperature: 0.8 };

    let reply = '';
    let usedModel = 'none';

    // Primary: fine-tuned Shannon model on Vertex AI
    try {
        reply = await callVertexAIModel(contents, generationConfig);
        usedModel = 'vertex-v7';
    } catch (err) {
        console.warn(`Vertex AI call failed, falling back to Gemini: ${err.message}`);

        // Fallback: Gemini 2.0 Flash if fine-tuned model is unavailable
        if (GEMINI_API_KEY) {
            try {
                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
                const response = await fetch(geminiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents, generationConfig }),
                });
                const data = await response.json();
                reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                usedModel = 'gemini-2.0-fallback';
            } catch (fallbackErr) {
                console.error('Gemini fallback also failed:', fallbackErr.message);
                return alerts;
            }
        } else {
            console.error('No fallback available — GEMINI_API_KEY not set');
            return alerts;
        }
    }

    // Parse the JSON array from the model reply
    try {
        const jsonMatch = reply.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const suggestions = JSON.parse(jsonMatch[0]);
            for (const suggestion of suggestions) {
                if (suggestion.index >= 0 && suggestion.index < alerts.length) {
                    alerts[suggestion.index].suggested_message = stripLeadingGreeting(suggestion.message);
                }
            }
            console.log(`Generated ${suggestions.length} alert messages via ${usedModel}`);
        } else {
            console.warn(`No JSON array found in ${usedModel} reply: ${reply.slice(0, 200)}`);
        }
    } catch (err) {
        console.error(`Failed to parse ${usedModel} suggestions:`, err.message);
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
 * Fire a per-alert "coach_draft_ready" push for ONE alert row so Shannon
 * gets a lockscreen notification with an inline-reply action pre-filled
 * with the drafted message. Mirrors the push shape used by
 * instant-coach-draft, pb-celebration-draft, morning-pulse-scan, and the
 * onboarding functions — integrating the 2-hour batch alerts into the
 * same UX so Shannon can respond without opening the app.
 *
 * Returns true if a push was attempted, false if the alert had nothing
 * to say (skip).
 */
async function fireCoachDraftReadyPush(coachUserId, alert) {
    if (!alert || !alert.id) return false;

    // Skip pushes for alerts that have no drafted message AND no
    // otherwise-actionable content. These stay in the admin feed for
    // Shannon to review if he wants; we don't want an empty inline-reply.
    const draftText = (alert.suggested_message || '').trim();
    if (!draftText) return false;

    // Short preview helpers — these match the conventions used by the
    // other draft functions for consistency across the lockscreen.
    const cap = (s, n) => (!s || s.length <= n ? s || '' : s.slice(0, n - 1) + '…');
    const clientName = alert.client_name || 'Client';

    // Type-aware title emoji / prefix. Keeps the lockscreen scannable.
    const emojiByType = {
        incoming_dm:        '💬',
        win_to_celebrate:   '🎉',
        unread_message:     '💬',
        inactive_client:    '😴',
        challenge_dropout:  '📉',
        streak_broken:      '🔥',
        milestone_near:     '🎯',
        nutrition_gap:      '🥗',
        coaching_idea:      '💡',
        general_idea:       '💡',
        mood_low:           '🫂',
        mood_pattern:       '🫂',
        workout_dropoff:    '🏋️',
        meal_dropoff:       '🍽️',
        wearable_insight:   '⌚',
        new_user_onboarding:'👋',
        not_in_challenge:   '🎪',
        level_up:           '⭐',
        comeback:           '💪',
        checkin_due:        '📋',
    };
    const emoji = emojiByType[alert.alert_type] || '📋';
    const title = `${emoji} ${clientName} — ${cap(alert.title || 'needs attention', 70)}`;
    const body = `${cap(alert.description || '', 80)}\n→ ${cap(draftText, 140)}`;

    try {
        await fetch(`${SITE_URL}/.netlify/functions/send-dm-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientId: coachUserId,
                senderId: alert.client_id || coachUserId,
                senderName: title,
                messageText: body,
                // The critical bit — the Android CoachDraftMessagingService
                // only switches into RemoteInput inline-reply mode for this type.
                type: 'coach_draft_ready',
                alertId: alert.id,
                clientId: alert.client_id || '',
                clientName,
                draftText,
                isSimpleReply: false,
            }),
        });
        return true;
    } catch (e) {
        console.warn(`coach_draft_ready push failed for alert ${alert.id}: ${e.message}`);
        return false;
    }
}

/**
 * Send push notification to a specific coach by user ID.
 */
async function sendCoachPushToUser(coachUserId, alerts, allClear) {
    if (alerts.length === 0 && !allClear) return;

    let title, body;
    if (allClear || alerts.length === 0) {
        title = 'Balance';
        body = 'hey everything looks like its running smooth, will check in again in a few hours 👍';
    } else {
        const urgent = alerts.filter(a => a.priority === 'urgent' || a.priority === 'high');
        const count = urgent.length || alerts.length;
        const topAlert = urgent[0] || alerts[0];
        title = 'Coach Alert';
        body = `${count} client${count > 1 ? 's' : ''} need attention — ${topAlert.title}`;
    }

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
                    data: { type: 'coach_alert', url: './admin-dashboard.html' }
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

        // Also exclude accounts flagged as test/fake (users.is_test_account=true).
        // Shannon was dismissing ~10/day alerts for his own second account +
        // other flagged fakes — filtering upstream stops the Vertex calls AND
        // keeps these names out of the admin feed entirely.
        try {
            const testAccounts = await supabaseQuery(
                `users?select=id&is_test_account=eq.true`
            );
            testAccounts.forEach(t => excludeIds.add(t.id));
            if (testAccounts.length > 0) {
                console.log(`Excluding ${testAccounts.length} test account(s)`);
            }
        } catch (e) { /* ignore — filter is best-effort noise reduction */ }

        console.log(`Found ${admins.length} coach(es), excluding ${excludeIds.size} admin/test account(s)`);

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
                    if (clientScope.size === 0) {
                        // No clients assigned — if this is the only coach,
                        // fall back to scanning all clients (single-coach setup)
                        if (admins.length === 1) {
                            clientScope = null;
                            console.log(`Coach ${coachId}: only coach with no assignments — scanning all clients`);
                        } else {
                            continue; // Multi-coach setup: skip coaches with no clients
                        }
                    }
                } catch (e) {
                    console.warn(`Could not load clients for coach ${coachId}:`, e.message);
                    // If coach_clients table doesn't exist or query fails,
                    // fall back to scanning all clients instead of skipping
                    clientScope = null;
                    console.log(`Coach ${coachId}: coach_clients unavailable — scanning all clients`);
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
            //   - unread_message / incoming_dm: they need a reply
            // Everything else (including coaching_idea subtypes checkin_due,
            // mood_low, wearable_low, meal_dropoff, workout_dropoff) gets
            // suppressed if the coach has messaged this client in the last
            // 3 days. Shannon's dismissal reasons showed proactive "checkin
            // due" reminders being noisy when he'd already chatted — silent
            // on that client for a few days is the right default.
            if (recentlyContacted.size > 0) {
                const before = coachAlerts.length;
                coachAlerts = coachAlerts.filter(a => {
                    if (a.alert_type === 'unread_message') return true;
                    if (a.alert_type === 'incoming_dm') return true; // always surface inbound DMs
                    if (a.client_id && recentlyContacted.has(a.client_id)) return false;
                    return true;
                });
                if (before !== coachAlerts.length) {
                    console.log(`Coach ${coachId}: suppressed ${before - coachAlerts.length} alerts for recently contacted clients`);
                }
            }

            if (coachAlerts.length === 0) {
                console.log(`Coach ${coachId}: no alerts — sending all-clear push`);
                // Send "all clear" push so coach knows the system is alive
                try {
                    await sendCoachPushToUser(coachId, [], true);
                } catch (pushErr) {
                    console.error(`Coach ${coachId}: all-clear push failed:`, pushErr.message);
                }
                continue;
            }

            // Tag every alert with this coach's ID
            coachAlerts.forEach(a => a.coach_id = coachId);

            // Generate AI-suggested messages (non-critical, don't let it block push)
            try {
                coachAlerts = await generateSuggestedMessages(coachAlerts);
            } catch (aiErr) {
                console.warn(`AI suggestions failed for coach ${coachId}:`, aiErr.message);
            }

            // Insert alerts into DB. `return=representation` so we get row IDs
            // back — they're needed for the per-alert coach_draft_ready pushes
            // below so Shannon can inline-reply from the lockscreen without
            // ever opening the app (mirrors instant-coach-draft etc.).
            let insertedAlerts = [];
            try {
                insertedAlerts = await supabaseQuery('coach_alerts', {
                    method: 'POST',
                    body: coachAlerts,
                    prefer: 'return=representation',
                });
                console.log(`Coach ${coachId}: inserted ${insertedAlerts.length} alerts`);
            } catch (insertErr) {
                console.error(`Coach ${coachId}: alert insert failed:`, insertErr.message);
            }

            totalAlerts += insertedAlerts.length;

            // Fire per-alert coach_draft_ready pushes for everything that has
            // a suggested_message — same lockscreen inline-reply UX as DMs, PBs,
            // morning pulse, onboarding, etc. Alerts without a draft (Vertex
            // failed) are skipped — they'll still show in the admin feed.
            let pushedCount = 0;
            let summaryOnlyCount = 0;
            for (const alert of insertedAlerts) {
                try {
                    const fired = await fireCoachDraftReadyPush(coachId, alert);
                    if (fired) pushedCount++;
                    else summaryOnlyCount++;
                } catch (e) {
                    console.warn(`Coach ${coachId}: per-alert push failed (${alert.alert_type}):`, e.message);
                    summaryOnlyCount++;
                }
            }
            console.log(`Coach ${coachId}: ${pushedCount} inline-reply pushes sent, ${summaryOnlyCount} drafts-less alerts (in admin feed only)`);

            // Summary push ONLY for drafts-less alerts — skip it entirely when
            // every alert already fired its own lockscreen push.
            if (summaryOnlyCount > 0 && pushedCount === 0) {
                try {
                    await sendCoachPushToUser(coachId, insertedAlerts);
                } catch (pushErr) {
                    console.error(`Coach ${coachId}: summary push failed:`, pushErr.message);
                }
            }
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
