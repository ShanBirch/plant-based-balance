/**
 * Onboarding Scheduled Scan — Days 3 / 7 / 14 / 30
 *
 * Netlify scheduled function. Scans coach_clients for active assignments
 * that crossed a milestone threshold in the last ~90 minutes and generates
 * a coach_draft_ready alert + push for each one.
 *
 * Runs hourly at :17 (staggered off the :00 mark to avoid contention with
 * other scheduled jobs like ai-client-monitor at :00 and sync-wearable-data
 * at :00). The 90-minute bucket width is slightly wider than the 60-minute
 * cadence so a missed run doesn't leave a gap.
 *
 * Dedup: skips any (coach_id, client_id, alert_type) already present in
 * coach_alerts. Idempotent — safe to run twice in the same hour.
 *
 * Every draft injects the CLIENT MEMORY block the same way the DM + PB
 * drafts do, so by the time a client hits day 3, Shannon already has weeks
 * of Hannah-style auto-extracted notes to reference.
 */

const {
    supabaseQuery,
    insertCoachAlert,
    loadClientMemory,
    maybeAutoSendDraft,
    buildMemoryBlock,
    loadClientProfileFacts,
    buildClientProfileBlock,
    buildNameUsePolicyBlock,
    buildRelationshipDiscoveryBlock,
    buildHeardFirstConversationBlock,
    loadEditExamples,
    loadRecentWorkouts,
    callVertexAIModel,
    callGeminiFallback,
    stripLeadingGreeting,
    truncate,
    recentlyMessaged,
    fireDraftReasoning,
} = require('./_lib/client-context');

const SITE_URL = process.env.URL || 'https://plantbased-balance.org';

const BUCKET_MINUTES = 90; // how wide the "just crossed the threshold" window is

// ============================================================
// Milestones — days elapsed + prompt builder
// ============================================================

function buildDayPrompt({ milestone, clientName, profileBlock, memoryBlock, activitySummary, editExamples, onboardingFacts }) {
    const nameUsePolicy = buildNameUsePolicyBlock();
    const relationshipDiscovery = buildRelationshipDiscoveryBlock();
    const heardFirstConversation = buildHeardFirstConversationBlock();
    const commonPrefix = `Draft a SHORT check-in message from Shannon to a client who just hit day ${milestone.days} with him.

CRITICAL — DO NOT GREET with "hey [name]" / "hi". Jump straight in. This is an ongoing coaching relationship, not a first message. Aussie casual, warm, no corporate tone.

Keep it ${milestone.lengthBrief}. Reference something SPECIFIC about ${clientName} from their memory / onboarding / activity below — show you've been paying attention.

${nameUsePolicy}
${relationshipDiscovery}
${heardFirstConversation}

CLIENT: ${clientName}${profileBlock || ''}${memoryBlock || ''}

ONBOARDING FACTS:
${onboardingFacts.length ? onboardingFacts.join('\n') : '(none captured)'}

ACTIVITY THIS PAST ${milestone.windowLabel}:
${activitySummary || '(no logged activity in this window)'}`;

    const instructions = milestone.instructions;

    return `${commonPrefix}

${instructions}${editExamples}

Reply with just the message text — no quotes, no commentary, no labels.`;
}

const MILESTONES = [
    {
        days: 3,
        alertType: 'onboarding_day_3',
        priority: 'medium',
        title: (name) => `${name} — day 3 check-in`,
        lengthBrief: '1-2 sentences max',
        windowLabel: 'THREE DAYS',
        windowMs: 3 * 24 * 60 * 60 * 1000,
        instructions: `This is their first check-in. If they've logged workouts or meals, acknowledge it specifically. If they haven't logged anything, gentle nudge — no shame. End with ONE open question to invite a reply and learn something useful about their real-life routine, food setup, support, or what is getting in the way.`,
    },
    {
        days: 7,
        alertType: 'onboarding_day_7',
        priority: 'medium',
        title: (name) => `${name} — 1 week review`,
        lengthBrief: '2-3 sentences max',
        windowLabel: 'WEEK',
        windowMs: 7 * 24 * 60 * 60 * 1000,
        instructions: `First-week review. Call out actual patterns — consistency, what days they hit hardest, gaps. Be honest but encouraging. End with a steer for the next week ("this week let's focus on X") or one specific question about their routine, stress, food setup, support, or biggest friction point.`,
    },
    {
        days: 14,
        alertType: 'onboarding_day_14',
        priority: 'medium',
        title: (name) => `${name} — 2 week check`,
        lengthBrief: '2-3 sentences max',
        windowLabel: '2 WEEKS',
        windowMs: 14 * 24 * 60 * 60 * 1000,
        instructions: `Mid-month progress check. Reference weight logged, any PBs, running_notes observations — show Shannon has been watching. Validate the grind. Ask one specific question about any roadblock and what life context is feeding it.`,
    },
    {
        days: 30,
        alertType: 'onboarding_day_30',
        priority: 'high',
        title: (name) => `${name} — 1 month milestone 🎉`,
        lengthBrief: '2-4 sentences',
        windowLabel: 'MONTH',
        windowMs: 30 * 24 * 60 * 60 * 1000,
        instructions: `First-month celebration. Summarise the wins specifically (workout count, PBs hit, weight change if logged). Name ONE thing to focus on next month. Include one thoughtful question about what made the month easier/harder or what support they need next. Genuine pride, not corporate "congrats on your journey". Aussie hype.`,
    },
];

// ============================================================
// Activity summary — loads recent activity for the milestone window
// ============================================================

async function buildActivitySummary(clientId, windowMs) {
    const since = new Date(Date.now() - windowMs).toISOString();
    const lines = [];
    try {
        const [workouts, pbs, weighIns, mood] = await Promise.all([
            loadRecentWorkouts(clientId, since, 20),
            supabaseQuery(`pb_history?select=exercise_name,pb_type,new_value,improvement,achieved_at&user_id=eq.${clientId}&achieved_at=gte.${since}&order=achieved_at.desc&limit=10`).catch(() => []),
            supabaseQuery(`daily_weigh_ins?select=weight,created_at&user_id=eq.${clientId}&created_at=gte.${since}&order=created_at.asc&limit=30`).catch(() => []),
            supabaseQuery(`mood_logs?select=mood_score,energy_score,created_at&user_id=eq.${clientId}&created_at=gte.${since}&order=created_at.desc&limit=10`).catch(() => []),
        ]);

        if (workouts.length) {
            const names = [...new Set(workouts.map(w => w.templateName).filter(Boolean))].slice(0, 5);
            lines.push(`${workouts.length} workouts logged${names.length ? ` (${names.join(', ')})` : ''}`);
        } else {
            lines.push('0 workouts logged');
        }

        if (pbs.length) {
            lines.push(`${pbs.length} PB(s): ${pbs.slice(0, 3).map(p => `${p.exercise_name} ${p.new_value}${p.pb_type === 'weight' ? 'kg' : ''}`).join(', ')}`);
        }

        if (weighIns.length >= 2) {
            const first = weighIns[0].weight;
            const last = weighIns[weighIns.length - 1].weight;
            const diff = Math.round((last - first) * 10) / 10;
            if (Math.abs(diff) > 0) {
                lines.push(`Weight: ${first}kg → ${last}kg (${diff > 0 ? '+' : ''}${diff}kg over ${weighIns.length} weigh-ins)`);
            } else {
                lines.push(`Weight: steady at ${last}kg (${weighIns.length} weigh-ins)`);
            }
        } else if (weighIns.length === 1) {
            lines.push(`Latest weight: ${weighIns[0].weight}kg`);
        }

        if (mood.length) {
            const avgMood = Math.round((mood.reduce((s, m) => s + (m.mood_score || 0), 0) / mood.length) * 10) / 10;
            const avgEnergy = Math.round((mood.reduce((s, m) => s + (m.energy_score || 0), 0) / mood.length) * 10) / 10;
            lines.push(`Mood avg ${avgMood}/10, energy ${avgEnergy}/10 (${mood.length} logs)`);
        }
    } catch (e) { /* non-critical */ }
    return lines.join('\n');
}

async function loadOnboardingFactsCompact(clientId) {
    try {
        const uf = await supabaseQuery(`user_facts?select=personal_details&user_id=eq.${clientId}&limit=1`);
        const pd = uf[0]?.personal_details || {};
        const out = [];
        const goalIntentLabels = Array.isArray(pd.goal_intent_labels)
            ? pd.goal_intent_labels
            : Array.isArray(pd.onboarding_goal_intents)
                ? pd.onboarding_goal_intents.map(item => item?.label || item).filter(Boolean)
                : [];
        if (goalIntentLabels.length) out.push(`goal themes: ${goalIntentLabels.slice(0, 6).join(', ')}`);
        const weeklyGoalFocusLabels = Array.isArray(pd.weekly_goal_focus_labels)
            ? pd.weekly_goal_focus_labels
            : Array.isArray(pd.onboarding_weekly_goal_focus)
                ? pd.onboarding_weekly_goal_focus.map(item => item?.label || item).filter(Boolean)
                : [];
        if (weeklyGoalFocusLabels.length) out.push(`weekly goal targets: ${weeklyGoalFocusLabels.slice(0, 6).join(', ')}`);
        const onboardingFreeform = (pd.onboarding_chat_freeform && typeof pd.onboarding_chat_freeform === 'object')
            ? pd.onboarding_chat_freeform
            : {};
        const onboardingNotes = Object.entries(onboardingFreeform)
            .filter(([, value]) => String(value || '').trim())
            .slice(0, 4)
            .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`);
        if (onboardingNotes.length) out.push(`onboarding notes: ${onboardingNotes.join('; ')}`);
        const goalCatcher = (pd.goal_catcher && typeof pd.goal_catcher === 'object') ? pd.goal_catcher : {};
        if (goalCatcher.thirty_day_win || pd.thirty_day_win) out.push(`30-day win: ${goalCatcher.thirty_day_win || pd.thirty_day_win}`);
        if (goalCatcher.main_blocker || pd.main_blocker) out.push(`blocker: ${goalCatcher.main_blocker || pd.main_blocker}`);
        if (goalCatcher.why_now || pd.why_now) out.push(`why now: ${goalCatcher.why_now || pd.why_now}`);
        if (goalCatcher.long_term_goal || pd.long_term_goal) out.push(`6-month goal: ${goalCatcher.long_term_goal || pd.long_term_goal}`);
        if (goalCatcher.independence_goal || pd.independence_goal) out.push(`independence goal: ${goalCatcher.independence_goal || pd.independence_goal}`);
        if (pd.weight && pd.goal_weight) out.push(`${pd.weight}kg → goal ${pd.goal_weight}kg`);
        if (pd.training_frequency) out.push(`${pd.training_frequency}x/wk training`);
        if (pd.equipment_access) out.push(`equipment: ${pd.equipment_access}`);
        const exercisePrefs = pd.exercise_preferences || {};
        if (Array.isArray(exercisePrefs.liked_exercises) && exercisePrefs.liked_exercises.length) {
            out.push(`likes: ${exercisePrefs.liked_exercises.slice(0, 5).join(', ')}`);
        }
        if (Array.isArray(exercisePrefs.avoided_exercises) && exercisePrefs.avoided_exercises.length) {
            out.push(`avoids: ${exercisePrefs.avoided_exercises.slice(0, 5).join(', ')}`);
        }
        if (pd.dietary_preference) out.push(`diet: ${pd.dietary_preference}`);
        if (pd.profile) out.push(`profile: ${pd.profile}`);
        return out;
    } catch (e) { return []; }
}

// ============================================================
// Draft + push for one candidate (client, milestone) pair
// ============================================================

async function draftAndQueue({ coachId, clientId, clientName, milestone }) {
    const [memory, profile, activitySummary, onboardingFacts, editExamples] = await Promise.all([
        loadClientMemory(coachId, clientId),
        loadClientProfileFacts(clientId),
        buildActivitySummary(clientId, milestone.windowMs),
        loadOnboardingFactsCompact(clientId),
        loadEditExamples({ lookback: 15, max: 4 }),
    ]);
    const memoryBlock = buildMemoryBlock(memory);
    const profileBlock = buildClientProfileBlock({ clientName, profile });

    const prompt = buildDayPrompt({
        milestone,
        clientName,
        profileBlock,
        memoryBlock,
        activitySummary,
        editExamples,
        onboardingFacts,
    });

    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const generationConfig = { maxOutputTokens: 1024, temperature: 0.85 };

    let draftText = '';
    let draftModel = 'none';
    try {
        const reply = await callVertexAIModel(contents, generationConfig);
        draftText = stripLeadingGreeting(reply);
        draftModel = 'vertex-v7';
    } catch (err) {
        console.warn(`[onboarding-scan] day_${milestone.days} Vertex failed for ${clientId}: ${err.message}`);
        try {
            const reply = await callGeminiFallback(contents, generationConfig);
            draftText = stripLeadingGreeting(reply);
            draftModel = 'gemini-2.0-fallback';
        } catch (err2) {
            console.error(`[onboarding-scan] day_${milestone.days} Gemini fallback failed for ${clientId}: ${err2.message}`);
        }
    }

    // Insert alert
    const alertRow = {
        client_id: clientId,
        client_name: clientName,
        coach_id: coachId,
        alert_type: milestone.alertType,
        priority: milestone.priority,
        title: milestone.title(clientName),
        description: activitySummary ? truncate(activitySummary, 240) : `Day ${milestone.days} milestone reached.`,
        suggested_message: draftText || null,
        status: 'pending',
        data: {
            milestone: `day_${milestone.days}`,
            draft_model: draftModel,
            activity_snapshot: activitySummary,
            drafted_at: new Date().toISOString(),
        },
    };

    let alertId = null;
    let deduped = false;
    try {
        const idempotencyKey = `${milestone.alertType}:${coachId}:${clientId}`;
        const result = await insertCoachAlert(alertRow, idempotencyKey);
        alertId = result.alertId;
        deduped = result.deduped;
        if (deduped) {
            console.log(`[onboarding-scan] day_${milestone.days} dedup race for ${clientId} — alert ${alertId} already exists`);
            return null;
        }
        console.log(`[onboarding-scan] day_${milestone.days} alert ${alertId} created for ${clientId}`);
    } catch (err) {
        console.error(`[onboarding-scan] day_${milestone.days} alert insert failed for ${clientId}: ${err.message}`);
        return null;
    }

    // Auto-send for trusted clients, otherwise push the approve-gate
    // notification.
    let autoSent = false;
    if (draftText && alertId) {
        autoSent = await maybeAutoSendDraft({
            coachId,
            clientId,
            clientName,
            alertId,
            alertType: milestone.alertType,
            draftText,
            siteUrl: SITE_URL,
            pushTitlePrefix: `📅 Auto-sent day ${milestone.days}`,
        });
    }

    if (!autoSent && draftText && alertId) {
        try {
            const title = milestone.title(clientName);
            const body = `${truncate(activitySummary || `Day ${milestone.days} milestone`, 80)}\n→ ${truncate(draftText, 140)}`;
            const pushUrl = `${SITE_URL}/.netlify/functions/send-dm-notification`;
            await fetch(pushUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipientId: coachId,
                    senderId: clientId,
                    senderName: title,
                    messageText: body,
                    type: 'coach_draft_ready',
                    alertId,
                    clientId,
                    clientName,
                    draftText,
                    isSimpleReply: false,
                }),
            }).catch(e => console.warn(`[onboarding-scan] day_${milestone.days} push dispatch failed: ${e.message}`));
        } catch (err) {
            console.warn(`[onboarding-scan] day_${milestone.days} push failed: ${err.message}`);
        }
    }

    // Reasoning hook — runs after the alert is live, lands on data
    // .draft_reasoning a beat later. Activity summary is the strongest
    // signal here (which workouts logged, weight trend, mood scores) so
    // we feed that as the primary context.
    if (alertId && draftText) {
        const contextBlocks = `Day ${milestone.days} milestone reached for ${clientName}.${activitySummary ? `\n\nActivity summary:\n${activitySummary}` : '\n(No activity in the window — this nudge is a re-engagement attempt.)'}`;
        fireDraftReasoning({
            alertId,
            draftText,
            alertType: milestone.alertType,
            contextBlocks,
            clientName,
        });
    }

    return alertId;
}

// ============================================================
// Main handler
// ============================================================

exports.handler = async (event) => {
    const started = Date.now();
    console.log(`[onboarding-scan] starting at ${new Date().toISOString()}`);

    const now = Date.now();
    const bucketMs = BUCKET_MINUTES * 60 * 1000;
    const results = { started_at: new Date(started).toISOString(), milestones: {} };

    for (const milestone of MILESTONES) {
        const bucketEnd = new Date(now - milestone.windowMs).toISOString();
        const bucketStart = new Date(now - milestone.windowMs - bucketMs).toISOString();

        let candidates = [];
        try {
            candidates = await supabaseQuery(
                `coach_clients?select=coach_id,client_id,assigned_at,client:users!coach_clients_client_id_fkey(id,name,email,is_test_account)&status=eq.active&assigned_at=gte.${bucketStart}&assigned_at=lt.${bucketEnd}`
            );
        } catch (err) {
            console.error(`[onboarding-scan] day_${milestone.days} query failed: ${err.message}`);
            results.milestones[`day_${milestone.days}`] = { error: err.message };
            continue;
        }

        const beforeFilter = candidates.length;
        candidates = candidates.filter(c => !c.client?.is_test_account);
        if (candidates.length !== beforeFilter) {
            console.log(`[onboarding-scan] day_${milestone.days} filtered ${beforeFilter - candidates.length} test account(s)`);
        }

        const result = { candidates: candidates.length, fired: 0, skipped_dedup: 0, failed: 0 };

        for (const c of candidates) {
            try {
                // Dedup
                const existing = await supabaseQuery(
                    `coach_alerts?select=id&coach_id=eq.${c.coach_id}&client_id=eq.${c.client_id}&alert_type=eq.${milestone.alertType}&limit=1`
                );
                if (existing.length > 0) {
                    result.skipped_dedup++;
                    continue;
                }

                // Skip if coach already DM'd this client in the last 24h
                if (await recentlyMessaged({ coachId: c.coach_id, clientId: c.client_id, hours: 24 })) {
                    result.skipped_recently_messaged = (result.skipped_recently_messaged || 0) + 1;
                    continue;
                }

                const clientName = c.client?.name || c.client?.email?.split('@')[0] || 'Client';
                const alertId = await draftAndQueue({
                    coachId: c.coach_id,
                    clientId: c.client_id,
                    clientName,
                    milestone,
                });
                if (alertId) result.fired++;
                else result.failed++;
            } catch (err) {
                console.error(`[onboarding-scan] day_${milestone.days} error for client ${c.client_id}: ${err.message}`);
                result.failed++;
            }
        }

        results.milestones[`day_${milestone.days}`] = result;
        console.log(`[onboarding-scan] day_${milestone.days}: ${JSON.stringify(result)}`);
    }

    const elapsed = Date.now() - started;
    console.log(`[onboarding-scan] completed in ${elapsed}ms`);
    return {
        statusCode: 200,
        body: JSON.stringify({ ...results, elapsed_ms: elapsed }),
    };
};
