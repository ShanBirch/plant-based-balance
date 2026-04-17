/**
 * Pulse Runner — shared orchestrator for the three daily pulses
 * (morning / lunch / evening). Consumed by:
 *   - netlify/functions/pulse-morning.js
 *   - netlify/functions/pulse-lunch.js
 *   - netlify/functions/pulse-evening.js
 *
 * Replaces the old ai-client-monitor.js (2-hourly scan) + morning-pulse-scan.js.
 *
 * What this handles so the three pulse entry-points stay tiny:
 *   1. Load admins + exclude IDs (coach emails, test accounts)
 *   2. Per coach: resolve client scope (coach_clients) + DM inbox IDs
 *   3. Run only the signal detectors listed in the pulse config
 *   4. Suppression layers:
 *       - `recentlyContacted` (coach DM'd client in last 3d)
 *       - `dormant` (client >30d since last login — except wins / DMs)
 *       - `pulseCooldown` (this client already got a pulse alert in last 48h)
 *       - per-signal dedup already handled inside each detector
 *   5. Vertex draft batch generation (Shannon voice v7 with Gemini fallback)
 *   6. Insert alerts with `data.pulse_origin` tag so the cooldown can see them
 *   7. maybeAutoSendDraft for trusted clients (bypasses approve-gate)
 *   8. Per-alert `coach_draft_ready` push so Shannon can inline-reply from
 *      the lockscreen. No more aggregate summary push. No more WhatsApp.
 *
 * No per-pulse cap. The suppression layers above already stop pile-up.
 */

const {
    supabaseQuery,
    loadClientMemory,
    maybeAutoSendDraft,
    buildMemoryBlock,
    loadEditExamples,
    callVertexAIModel,
    callGeminiFallback,
    stripLeadingGreeting,
    truncate,
} = require('./client-context');

const {
    DAY_MS,
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
    detectMissedScheduledWorkout,
    detectStreakBreak,
    detectChallengeBanter,
    detectQuietClient,
    detectCycleCheckin,
    detectMomentum,
} = require('./signal-detectors');

const SITE_URL = process.env.URL || 'https://plantbased-balance.org';

const PULSE_COOLDOWN_HOURS = 48;
const RECENTLY_CONTACTED_DAYS = 3;
const DORMANT_DAYS = 30;

// Map of signal names (used in pulse configs) to their detector functions.
// "cohort" detectors take { supabaseQuery, excludeIds, clientScope, coachInboxIds?, opts? }
// and return the full list of alerts across all in-scope clients.
const COHORT_DETECTORS = {
    inactive_client:   detectInactiveClients,
    unread_message:    detectUnreadMessages,
    challenge_dropout: detectChallengeDropouts,
    win_to_celebrate:  detectWinsToCelebrate,
    level_up:          detectLevelUps,
    comeback:          detectComebacks,
    checkin_due:       detectCheckinDue,
    not_in_challenge:  detectNotInChallenge,
    new_user_idle:     detectNewUserIdle,
    nutrition_gap:     detectNutritionGaps,
    workout_dropoff:   detectWorkoutDropoff,
    meal_dropoff:      detectMealDropoff,
    mood_low:          detectMoodLow,
    wearable_low:      detectWearableLow,
};

// "per-client" detectors take { supabaseQuery, clientId, clientName, coachId, personalDetails }
// and return a single alert (or null). The runner loops in-scope clients for these.
const PER_CLIENT_DETECTORS = {
    missed_scheduled_workout: detectMissedScheduledWorkout,
    streak_break:             detectStreakBreak,
    challenge_banter:         detectChallengeBanter,
    quiet_client:             detectQuietClient,
    cycle_checkin:            detectCycleCheckin,
    momentum:                 detectMomentum,
};

// Some alert-type + subtype combinations must ALWAYS surface regardless of the
// usual suppression layers. Inbound DMs and real-time wins would otherwise get
// eaten by "recently contacted" or "pulse cooldown" and disappear.
const ALWAYS_SHOW_TYPES = new Set(['unread_message', 'incoming_dm']);
const ALWAYS_SHOW_WIN_SUBTYPES = new Set(['pb', 'streak', 'level_up']);

function shouldAlwaysShow(alert) {
    if (ALWAYS_SHOW_TYPES.has(alert.alert_type)) return true;
    if (alert.alert_type === 'win_to_celebrate' && ALWAYS_SHOW_WIN_SUBTYPES.has(alert.data?.subtype)) return true;
    return false;
}

// Lockscreen emoji per alert_type. Preserved from ai-client-monitor.
const EMOJI_BY_TYPE = {
    incoming_dm:        '💬',
    win_to_celebrate:   '🎉',
    unread_message:     '💬',
    inactive_client:    '😴',
    challenge_dropout:  '📉',
    nutrition_gap:      '🥗',
    coaching_idea:      '💡',
    morning_pulse:      '🌅',
    lunch_pulse:        '☀️',
    evening_pulse:      '🌙',
};

// ============================================================
// Vertex batch drafter — one call, one message per alert
// ============================================================

async function generateSuggestedMessages(alerts) {
    if (alerts.length === 0) return alerts;

    const summaries = alerts.map((a, i) =>
        `Alert ${i + 1}: [${a.alert_type}${a.data?.subtype ? ':' + a.data.subtype : ''}] ${a.title}\nContext: ${a.description}\nClient: ${a.client_name}`
    ).join('\n\n');

    const editExamples = await loadEditExamples({ lookback: 15, max: 8 });

    const prompt = `For each alert below, write a SHORT message for Shannon (the coach) to send the client.

CRITICAL — DO NOT GREET: Never start with "hey [name]", "hi", "yo". Jump straight into content. These are ongoing conversations, not first messages.

Alert-type guidance:
- inactive_client: gentle check-in
- unread_message: react to the client's actual words
- challenge_dropout: motivating nudge
- win_to_celebrate: brief celebration (subtype=pb/streak/level_up/comeback)
- nutrition_gap: helpful not judgmental
- workout_dropoff / meal_dropoff: casual "what's up"
- checkin_due: prompt weekly review
- new_user: warm welcome (greeting OK here)
- not_in_challenge: casual invite
- mood_low: empathetic
- wearable_low: suggest recovery focus
- morning_pulse (missed_scheduled_workout / streak_break): direct, concerned but not guilt-trippy
- morning_pulse (challenge_banter + coach_in_challenge=true): TRASH TALK, playful, a little cocky
- morning_pulse (challenge_banter + coach_in_challenge=false): HYPE MODE, cheer from sideline
- morning_pulse (quiet_client): "haven't heard from ya, everything alright"
- morning_pulse (cycle_checkin): soft, aware, no performative care
- morning_pulse (momentum): one sentence of specific recognition${editExamples}

Respond as JSON array, one object per alert:
[{"index": 0, "message": "..."}, ...]

Alerts:
${summaries}`;

    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const generationConfig = { maxOutputTokens: 2048, temperature: 0.85 };

    let reply = '';
    let usedModel = 'none';
    try {
        reply = await callVertexAIModel(contents, generationConfig);
        usedModel = 'vertex-v7';
    } catch (err) {
        console.warn(`[pulse] Vertex failed, falling back to Gemini: ${err.message}`);
        try {
            reply = await callGeminiFallback(contents, generationConfig);
            usedModel = 'gemini-2.0-fallback';
        } catch (err2) {
            console.error(`[pulse] Gemini fallback failed: ${err2.message}`);
            return alerts;
        }
    }

    try {
        const jsonMatch = reply.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const suggestions = JSON.parse(jsonMatch[0]);
            for (const s of suggestions) {
                if (s.index >= 0 && s.index < alerts.length) {
                    alerts[s.index].suggested_message = stripLeadingGreeting(s.message);
                    alerts[s.index]._draftModel = usedModel;
                }
            }
            console.log(`[pulse] Drafted ${suggestions.length} messages via ${usedModel}`);
        }
    } catch (err) {
        console.error(`[pulse] Failed to parse ${usedModel} reply: ${err.message}`);
    }

    return alerts;
}

// ============================================================
// Push dispatch — per-alert coach_draft_ready (RemoteInput inline-reply)
// ============================================================

async function fireCoachDraftReadyPush(coachUserId, alert) {
    if (!alert?.id) return false;
    const draftText = (alert.suggested_message || '').trim();
    if (!draftText) return false;

    const cap = (s, n) => (!s || s.length <= n ? s || '' : s.slice(0, n - 1) + '…');
    const clientName = alert.client_name || 'Client';
    const emoji = EMOJI_BY_TYPE[alert.alert_type] || '📋';
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
        console.warn(`[pulse] coach_draft_ready push failed for alert ${alert.id}: ${e.message}`);
        return false;
    }
}

// ============================================================
// Per-coach scan
// ============================================================

async function scanForCoach({
    coachId,
    isSuperAdmin,
    excludeIds,
    coachEmails,
    cohortSignals,
    perClientSignals,
    label,
    pulseOrigin,
}) {
    // Resolve this coach's client scope
    let clientScope = null;
    if (!isSuperAdmin) {
        try {
            const assignments = await supabaseQuery(
                `coach_clients?select=client_id&coach_id=eq.${coachId}&status=eq.active`
            );
            clientScope = new Set(assignments.map(a => a.client_id));
            if (clientScope.size === 0) clientScope = null; // fall back to all
        } catch (e) {
            console.warn(`[${label}] coach_clients unavailable for ${coachId}: ${e.message}`);
            clientScope = null;
        }
    }

    // Resolve coach inbox IDs (main user_id + known email aliases)
    const coachInboxIds = [coachId];
    try {
        for (const email of coachEmails) {
            const acc = await supabaseQuery(`users?select=id&email=eq.${encodeURIComponent(email)}&limit=1`);
            if (acc[0] && !coachInboxIds.includes(acc[0].id)) coachInboxIds.push(acc[0].id);
        }
    } catch { /* use just main id */ }

    // Recently-contacted (coach → client DM in last 3 days)
    const recentlyContacted = new Set();
    try {
        const cutoff = new Date(Date.now() - RECENTLY_CONTACTED_DAYS * DAY_MS).toISOString();
        for (const inboxId of coachInboxIds) {
            const sent = await supabaseQuery(
                `nudges?select=receiver_id&sender_id=eq.${inboxId}&created_at=gte.${cutoff}&order=created_at.desc&limit=200`
            );
            sent.forEach(s => recentlyContacted.add(s.receiver_id));
        }
    } catch (e) { console.warn(`[${label}] recently-contacted build failed: ${e.message}`); }

    // Run cohort detectors in parallel
    const cohortPromises = cohortSignals.map(name => {
        const fn = COHORT_DETECTORS[name];
        if (!fn) { console.warn(`[${label}] unknown cohort signal: ${name}`); return Promise.resolve([]); }
        return fn({ supabaseQuery, excludeIds, clientScope, coachInboxIds }).catch(e => {
            console.error(`[${label}] ${name} failed: ${e.message}`);
            return [];
        });
    });
    const cohortResults = await Promise.all(cohortPromises);
    let allAlerts = cohortResults.flat();

    // Run per-client detectors if configured — loop in-scope clients, pull
    // personal_details once for the cohort.
    if (perClientSignals.length > 0) {
        let scopedClients = [];
        try {
            if (clientScope) {
                const inList = [...clientScope].map(id => `"${id}"`).join(',');
                if (inList) {
                    scopedClients = await supabaseQuery(`users?select=id,name,email&id=in.(${inList})&limit=500`);
                }
            } else {
                // super_admin / fallback — scan all non-excluded, non-dormant users
                scopedClients = await supabaseQuery(
                    `users?select=id,name,email,last_login&last_login=gte.${new Date(Date.now() - DORMANT_DAYS * DAY_MS).toISOString()}&limit=500`
                );
            }
        } catch (e) { console.warn(`[${label}] per-client user fetch failed: ${e.message}`); }

        const scopedIds = scopedClients.map(u => u.id).filter(id => !excludeIds.has(id));
        let factsByClient = {};
        if (scopedIds.length) {
            try {
                const inList = scopedIds.map(id => `"${id}"`).join(',');
                const facts = await supabaseQuery(`user_facts?select=user_id,personal_details&user_id=in.(${inList})`);
                factsByClient = Object.fromEntries(facts.map(f => [f.user_id, f.personal_details || {}]));
            } catch { /* no facts — detectors handle missing */ }
        }

        for (const user of scopedClients) {
            if (excludeIds.has(user.id)) continue;
            const clientName = user.name || (user.email || '').split('@')[0] || 'Client';
            for (const sig of perClientSignals) {
                const fn = PER_CLIENT_DETECTORS[sig];
                if (!fn) { console.warn(`[${label}] unknown per-client signal: ${sig}`); continue; }
                try {
                    const alert = await fn({
                        supabaseQuery,
                        clientId: user.id,
                        clientName,
                        coachId,
                        personalDetails: factsByClient[user.id] || {},
                    });
                    if (alert) allAlerts.push(alert);
                } catch (e) {
                    console.warn(`[${label}] ${sig} failed for ${user.id}: ${e.message}`);
                }
            }
        }
    }

    if (allAlerts.length === 0) return { inserted: 0, pushed: 0 };

    // Tag with coach_id
    allAlerts.forEach(a => a.coach_id = coachId);

    // Filter: recently contacted (except always-show types)
    if (recentlyContacted.size > 0) {
        const before = allAlerts.length;
        allAlerts = allAlerts.filter(a => shouldAlwaysShow(a) || !recentlyContacted.has(a.client_id));
        if (before !== allAlerts.length) {
            console.log(`[${label}] suppressed ${before - allAlerts.length} for recently-contacted`);
        }
    }

    // Filter: dormant (>30d since last login) — except always-show + win_to_celebrate
    try {
        const clientIds = [...new Set(allAlerts.map(a => a.client_id).filter(Boolean))];
        if (clientIds.length) {
            const inList = clientIds.map(id => `"${id}"`).join(',');
            const dormantCutoff = new Date(Date.now() - DORMANT_DAYS * DAY_MS).toISOString();
            const rows = await supabaseQuery(
                `users?select=id&id=in.(${inList})&or=(last_login.is.null,last_login.lt.${dormantCutoff})`
            );
            const dormant = new Set(rows.map(r => r.id));
            if (dormant.size > 0) {
                const before = allAlerts.length;
                allAlerts = allAlerts.filter(a => {
                    if (shouldAlwaysShow(a)) return true;
                    if (a.alert_type === 'win_to_celebrate') return true;
                    return !dormant.has(a.client_id);
                });
                if (before !== allAlerts.length) {
                    console.log(`[${label}] suppressed ${before - allAlerts.length} for ${dormant.size} dormant client(s)`);
                }
            }
        }
    } catch (e) { console.warn(`[${label}] dormant filter failed: ${e.message}`); }

    // Filter: 48h per-client pulse cooldown. Any alert created by ANY pulse
    // (data.pulse_origin set) in the last 48h suppresses further pulse alerts
    // for that client — even if the signal is a different type. Stops one
    // client dominating the day. Always-show types bypass this.
    try {
        const clientIds = [...new Set(allAlerts.map(a => a.client_id).filter(Boolean))];
        if (clientIds.length) {
            const inList = clientIds.map(id => `"${id}"`).join(',');
            const cutoff = new Date(Date.now() - PULSE_COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
            const rows = await supabaseQuery(
                `coach_alerts?select=client_id&coach_id=eq.${coachId}&client_id=in.(${inList})&created_at=gte.${cutoff}&data->>pulse_origin=not.is.null&limit=200`
            );
            const onCooldown = new Set(rows.map(r => r.client_id));
            if (onCooldown.size > 0) {
                const before = allAlerts.length;
                allAlerts = allAlerts.filter(a => shouldAlwaysShow(a) || !onCooldown.has(a.client_id));
                if (before !== allAlerts.length) {
                    console.log(`[${label}] suppressed ${before - allAlerts.length} for ${onCooldown.size} client(s) on pulse cooldown`);
                }
            }
        }
    } catch (e) { console.warn(`[${label}] cooldown filter failed: ${e.message}`); }

    // Within this run, dedup by (coach_id, client_id) — keep the highest-priority
    // alert when multiple signals fire for one client.
    const PRIORITY_WEIGHT = { urgent: 4, high: 3, medium: 2, low: 1 };
    const byClient = new Map();
    for (const a of allAlerts) {
        const key = `${a.coach_id}|${a.client_id}`;
        const prev = byClient.get(key);
        if (!prev || (PRIORITY_WEIGHT[a.priority] || 0) > (PRIORITY_WEIGHT[prev.priority] || 0)) {
            byClient.set(key, a);
        }
    }
    allAlerts = [...byClient.values()];

    if (allAlerts.length === 0) return { inserted: 0, pushed: 0 };

    // Draft messages via Vertex (batch)
    try {
        allAlerts = await generateSuggestedMessages(allAlerts);
    } catch (e) { console.warn(`[${label}] Vertex batch failed: ${e.message}`); }

    // Tag pulse_origin on every row + strip runtime-only fields before insert
    const rowsToInsert = allAlerts.map(a => {
        const data = { ...(a.data || {}), pulse_origin: pulseOrigin, draft_model: a._draftModel || 'none' };
        // Drop internal prompt-builder scaffolding that's not DB-safe
        if (data._banter) delete data._banter;
        return {
            client_id: a.client_id,
            client_name: a.client_name,
            coach_id: a.coach_id,
            alert_type: a.alert_type,
            priority: a.priority,
            title: a.title,
            description: a.description,
            suggested_message: a.suggested_message || null,
            status: 'pending',
            data,
        };
    });

    let inserted = [];
    try {
        inserted = await supabaseQuery('coach_alerts', {
            method: 'POST',
            body: rowsToInsert,
            prefer: 'return=representation',
        });
        console.log(`[${label}] inserted ${inserted.length} alerts for coach ${coachId}`);
    } catch (e) {
        console.error(`[${label}] alert insert failed: ${e.message}`);
        return { inserted: 0, pushed: 0 };
    }

    // Auto-send + push per alert
    let pushed = 0;
    for (const alert of inserted) {
        let autoSent = false;
        try {
            autoSent = await maybeAutoSendDraft({
                coachId,
                clientId: alert.client_id,
                clientName: alert.client_name,
                alertId: alert.id,
                alertType: alert.alert_type,
                draftText: alert.suggested_message,
                siteUrl: SITE_URL,
                pushTitlePrefix: `${EMOJI_BY_TYPE[alert.alert_type] || '📋'} Auto-sent`,
            });
        } catch (e) { console.warn(`[${label}] auto-send check failed for ${alert.id}: ${e.message}`); }

        if (!autoSent) {
            const fired = await fireCoachDraftReadyPush(coachId, alert);
            if (fired) pushed++;
        }
    }

    return { inserted: inserted.length, pushed };
}

// ============================================================
// Public runner
// ============================================================

const COACH_EMAILS = [
    'shannon@plantbasedbalance.com',
    'shannon.birch@cocospersonaltraining.com',
    'shannon@plantbased-balance.org',
    'shannonbirch@cocospersonaltraining.com',
];

/**
 * Run one pulse. Called by the three entry-point functions.
 *
 * @param {object} config
 * @param {string} config.label        short log prefix, e.g. 'pulse-morning'
 * @param {string} config.pulseOrigin  'morning' | 'lunch' | 'evening' — tags every inserted alert.data
 * @param {string[]} [config.cohortSignals]    cohort-level detectors to run
 * @param {string[]} [config.perClientSignals] per-client detectors to run
 */
async function runPulse({ label, pulseOrigin, cohortSignals = [], perClientSignals = [] }) {
    const started = Date.now();
    console.log(`[${label}] starting at ${new Date().toISOString()} (origin=${pulseOrigin})`);

    // 1. Load admins
    const admins = await supabaseQuery('admin_users?select=user_id,role&limit=20').catch(() => []);
    if (admins.length === 0) {
        console.log(`[${label}] no admin users found`);
        return { statusCode: 200, body: JSON.stringify({ message: 'No coaches configured' }) };
    }

    // 2. Build exclude set: admins + known coach emails + test accounts
    const excludeIds = new Set();
    admins.forEach(a => excludeIds.add(a.user_id));
    try {
        const rows = await supabaseQuery(
            `users?select=id&email=in.(${COACH_EMAILS.map(e => `"${e}"`).join(',')})`
        );
        rows.forEach(r => excludeIds.add(r.id));
    } catch { /* ignore */ }
    try {
        const tests = await supabaseQuery(`users?select=id&is_test_account=eq.true`);
        tests.forEach(t => excludeIds.add(t.id));
        if (tests.length) console.log(`[${label}] excluding ${tests.length} test account(s)`);
    } catch { /* ignore */ }

    // 3. Scan per coach
    let totalInserted = 0;
    let totalPushed = 0;
    for (const admin of admins) {
        try {
            const r = await scanForCoach({
                coachId: admin.user_id,
                isSuperAdmin: admin.role === 'super_admin',
                excludeIds,
                coachEmails: COACH_EMAILS,
                cohortSignals,
                perClientSignals,
                label,
                pulseOrigin,
            });
            totalInserted += r.inserted;
            totalPushed += r.pushed;
        } catch (e) {
            console.error(`[${label}] coach ${admin.user_id} failed: ${e.message}`);
        }
    }

    const elapsed = Date.now() - started;
    console.log(`[${label}] done in ${elapsed}ms — inserted=${totalInserted} pushed=${totalPushed}`);
    return {
        statusCode: 200,
        body: JSON.stringify({
            label,
            pulseOrigin,
            inserted: totalInserted,
            pushed: totalPushed,
            elapsed_ms: elapsed,
            started_at: new Date(started).toISOString(),
        }),
    };
}

module.exports = { runPulse };
