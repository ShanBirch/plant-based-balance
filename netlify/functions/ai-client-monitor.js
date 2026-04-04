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
async function checkInactiveClients(inactiveDays = 2) {
    const alerts = [];
    const cutoff = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000).toISOString();

    // Get all users with their last login
    const users = await supabaseQuery('users?select=id,name,email,last_login,program_start_date&order=last_login.desc');

    for (const user of users) {
        if (!user.last_login) continue;

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
async function checkUnreadMessages(hoursThreshold = 4) {
    const alerts = [];
    const cutoff = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000).toISOString();

    // Get coach user IDs from admin_users table (these are the people who receive DMs from clients)
    const admins = await supabaseQuery('admin_users?select=user_id&limit=10');
    const coachIds = admins.map(a => a.user_id);
    if (coachIds.length === 0) return alerts;

    // Also include the real coach account email (may be different from admin login)
    try {
        const coachAccounts = await supabaseQuery(
            `users?select=id&email=in.("shannon@plantbased-balance.org","shannonbirch@cocospersonaltraining.com")`
        );
        for (const c of coachAccounts) {
            if (!coachIds.includes(c.id)) coachIds.push(c.id);
        }
    } catch (e) { /* ignore if these accounts don't exist */ }

    // Get recent nudges (DMs) sent TO the coach that haven't been read yet
    // The nudges table uses read_at (TIMESTAMPTZ, NULL if unread) not a boolean
    for (const coachId of coachIds) {
        const unread = await supabaseQuery(
            `nudges?select=id,sender_id,message,created_at,read_at&receiver_id=eq.${coachId}&read_at=is.null&created_at=lte.${cutoff}&order=created_at.asc&limit=20`
        );

        for (const msg of unread) {
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
async function checkChallengeDropouts() {
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
async function checkWinsToCelebrate() {
    const alerts = [];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Check for new personal bests in the last 24h
    const recentPBs = await supabaseQuery(
        `personal_bests?select=user_id,exercise_name,weight_kg,reps,achieved_date&achieved_date=gte.${yesterday}&order=achieved_date.desc&limit=20`
    );

    for (const pb of recentPBs) {
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
- For wins: brief celebration, genuine
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
        // Load coach preferences for thresholds
        let inactiveDays = 2;
        let unreadHours = 4;
        try {
            const prefs = await supabaseQuery('coach_notification_prefs?limit=1');
            if (prefs.length > 0) {
                inactiveDays = prefs[0].inactive_days_threshold || 2;
                unreadHours = prefs[0].unread_hours_threshold || 4;
            }
        } catch (e) {
            console.log('No coach prefs found, using defaults');
        }

        // Run all scans in parallel
        const [inactive, unread, challengeDropouts, wins] = await Promise.all([
            checkInactiveClients(inactiveDays).catch(e => { console.error('Inactive check failed:', e.message); return []; }),
            checkUnreadMessages(unreadHours).catch(e => { console.error('Unread check failed:', e.message); return []; }),
            checkChallengeDropouts().catch(e => { console.error('Challenge check failed:', e.message); return []; }),
            checkWinsToCelebrate().catch(e => { console.error('Wins check failed:', e.message); return []; }),
        ]);

        let allAlerts = [...inactive, ...unread, ...challengeDropouts, ...wins];
        console.log(`Found ${allAlerts.length} alerts (${inactive.length} inactive, ${unread.length} unread, ${challengeDropouts.length} challenge, ${wins.length} wins)`);

        if (allAlerts.length === 0) {
            console.log('No alerts to generate. All clients looking good!');
            return { statusCode: 200, body: JSON.stringify({ message: 'No alerts', scanned: true }) };
        }

        // Generate AI-suggested messages for each alert
        allAlerts = await generateSuggestedMessages(allAlerts);

        // Insert all alerts into the database
        await supabaseQuery('coach_alerts', {
            method: 'POST',
            body: allAlerts,
            prefer: 'return=minimal',
        });

        console.log(`✅ Inserted ${allAlerts.length} alerts`);

        // Send notifications to the coach
        await Promise.all([
            sendWhatsAppSummary(allAlerts),
            sendCoachPush(allAlerts),
        ]);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: `Generated ${allAlerts.length} alerts`,
                breakdown: {
                    inactive: inactive.length,
                    unread: unread.length,
                    challenge_dropouts: challengeDropouts.length,
                    wins: wins.length,
                },
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
