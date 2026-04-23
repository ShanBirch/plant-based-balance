/**
 * Onboarding Welcome Draft — Day 0 Event-Driven Function
 *
 * Fires the moment a client is assigned to a coach (coach_clients INSERT).
 * See database/coach_clients_onboarding_trigger.sql.
 *
 * Generates a warm first-message draft in Shannon's voice that references
 * the client's #1 goal (from client_memory or onboarding quiz data) and asks
 * one open question. Lands on Shannon's lockscreen with the inline-reply
 * action pre-filled — same UX as every other coach_draft_ready notification.
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
    isTestAccount,
    recentlyMessaged,
} = require('./_lib/client-context');

const SITE_URL = process.env.URL || 'https://plantbased-balance.org';

// ============================================================
// Context — pull whatever we know about this client
// ============================================================

async function loadOnboardingFacts(clientId) {
    const facts = { name: 'Client', onboarding: [] };

    try {
        const users = await supabaseQuery(`users?select=id,name,email,sex,program_start_date&id=eq.${clientId}&limit=1`);
        if (users[0]) {
            facts.name = users[0].name || users[0].email?.split('@')[0] || 'Client';
            facts.sex = users[0].sex;
            facts.programStart = users[0].program_start_date;
        }
    } catch (e) { /* non-critical */ }

    // user_facts.personal_details carries the onboarding quiz answers
    try {
        const uf = await supabaseQuery(`user_facts?select=personal_details,goals,preferences&user_id=eq.${clientId}&limit=1`);
        const pd = uf[0]?.personal_details || {};
        if (pd.weight && pd.goal_weight) {
            const delta = Math.round(pd.weight - pd.goal_weight);
            if (delta > 0) facts.onboarding.push(`Stated goal weight: ${pd.weight}kg → ${pd.goal_weight}kg (${delta}kg to lose)`);
            else if (delta < 0) facts.onboarding.push(`Stated goal weight: ${pd.weight}kg → ${pd.goal_weight}kg (${Math.abs(delta)}kg to gain)`);
        }
        if (pd.goalBodyType) facts.onboarding.push(`Body type goal: ${pd.goalBodyType}`);
        if (pd.training_frequency) facts.onboarding.push(`Training frequency: ${pd.training_frequency}x/week`);
        if (pd.equipment_access) facts.onboarding.push(`Equipment: ${pd.equipment_access}`);
        if (pd.dietary_preference) facts.onboarding.push(`Diet: ${pd.dietary_preference}`);
        if (pd.activity_level) facts.onboarding.push(`Activity level: ${pd.activity_level}`);
        if (pd.profile) facts.onboarding.push(`Profile: ${pd.profile}`);
    } catch (e) { /* non-critical */ }

    return facts;
}

// ============================================================
// Draft generation
// ============================================================

async function generateWelcomeDraft({ clientName, onboardingFacts, memoryBlock }) {
    // Onboarding-specific edit examples are rare; pull general ones.
    const editExamples = await loadEditExamples({ lookback: 15, max: 4 });

    const onboardingText = onboardingFacts.length > 0
        ? onboardingFacts.join('\n')
        : '(no onboarding facts captured)';

    const prompt = `Draft Shannon's FIRST message to a brand new client — they signed up seconds ago and Shannon's been assigned as their coach. The goal: start a real conversation. JUST a conversation — no challenge pitch yet, no plan, no sell. Shannon will pitch a wellness challenge a few messages in once there's some rapport.

VOICE — Aussie casual, warm, genuine real-mate energy. Not corporate, not coachy. 1-2 emojis max (😊 ☺️ 🙏🏼 🤙 💪). Exclamation marks ok, emoji spam not.

DO NOT GREET with "hey [name]" or "welcome to the app" or "congrats on joining". Jump straight into substance.

STRUCTURE — 2-3 short sentences, ~30-40 words total:
1. Stoked-they-downloaded line that anchors on ONE specific thing from their onboarding/memory (their goal, their plan, what they're working on). Proves Shannon actually read their profile.
2. Ask ONE genuine open question to get them talking — about their goal, their why, what's been hard ("what's been the biggest blocker so far?", "how long have you been at it?", "what made you finally pull the trigger?").

That's it. No challenges, no offers, no calls to action. Just open the door.

CRITICAL — only state facts you can see in their onboarding/memory. Don't guess their diet, sex, or training history if it's not listed (Shannon got burned assuming a client was vegan when she wasn't).

Avoid: walls of text, bullet lists, multiple questions, "Welcome!", "Congrats on joining", hollow platitudes, hard sells, listing app features, mentioning challenges/quizzes/programs.

CLIENT: ${clientName}${memoryBlock || ''}

ONBOARDING FACTS:
${onboardingText}${editExamples}

Reply with just the message text — no quotes, no commentary, no labels.`;

    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const generationConfig = { maxOutputTokens: 1024, temperature: 0.85 };

    try {
        const reply = await callVertexAIModel(contents, generationConfig);
        return { text: stripLeadingGreeting(reply), model: 'vertex-v7' };
    } catch (err) {
        console.warn(`[onboarding-welcome] Vertex failed, falling back to Gemini: ${err.message}`);
    }

    try {
        const reply = await callGeminiFallback(contents, generationConfig);
        return { text: stripLeadingGreeting(reply), model: 'gemini-2.0-fallback' };
    } catch (err) {
        console.error('[onboarding-welcome] Gemini fallback failed:', err.message);
        return { text: '', model: 'none' };
    }
}

// ============================================================
// Push
// ============================================================

async function sendWelcomePush({ coachId, clientId, clientName, draftText, alertId }) {
    try {
        const title = `👋 ${clientName} — new client, draft ready`;
        const body = draftText
            ? `New assignment: ${clientName}\n→ ${truncate(draftText, 140)}`
            : `New assignment: ${clientName} — open the app to welcome them.`;

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
                draftText: draftText || '',
                isSimpleReply: false,
            }),
        }).catch(e => console.warn('[onboarding-welcome] push dispatch failed:', e.message));
    } catch (err) {
        console.warn('[onboarding-welcome] push failed:', err.message);
    }
}

// ============================================================
// Main handler
// ============================================================

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    let payload;
    try { payload = JSON.parse(event.body); }
    catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

    const { coachId, clientId, assignedAt } = payload;
    if (!coachId || !clientId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing coachId/clientId' }) };
    }

    // 1. Dedup — skip if an onboarding_welcome already exists for this pair
    try {
        const existing = await supabaseQuery(
            `coach_alerts?select=id&coach_id=eq.${coachId}&client_id=eq.${clientId}&alert_type=eq.onboarding_welcome&limit=1`
        );
        if (existing.length > 0) {
            console.log(`[onboarding-welcome] dedup — welcome already exists for ${clientId}`);
            return { statusCode: 200, body: JSON.stringify({ skipped: 'dedup' }) };
        }
    } catch (e) { /* continue */ }

    // Skip test accounts
    if (await isTestAccount(clientId)) {
        console.log(`[onboarding-welcome] skipping test account ${clientId}`);
        return { statusCode: 200, body: JSON.stringify({ skipped: 'test_account' }) };
    }

    // Skip if Shannon already messaged this client in the last 24h (covers
    // the "I already welcomed her" dismissal pattern — the welcome trigger
    // can fire after Shannon's already reached out via the app).
    if (await recentlyMessaged({ coachId, clientId, hours: 24 })) {
        console.log(`[onboarding-welcome] skipping ${clientId} — messaged within 24h`);
        return { statusCode: 200, body: JSON.stringify({ skipped: 'recently_messaged' }) };
    }

    // 2. Load facts + memory
    const onboardingFacts = await loadOnboardingFacts(clientId);
    const clientName = onboardingFacts.name;
    const memory = await loadClientMemory(coachId, clientId);
    const memoryBlock = buildMemoryBlock(memory);

    // 3. Draft
    let draftText = '';
    let draftModel = 'none';
    try {
        const draft = await generateWelcomeDraft({
            clientName,
            onboardingFacts: onboardingFacts.onboarding,
            memoryBlock,
        });
        draftText = draft.text;
        draftModel = draft.model;
    } catch (err) {
        console.error('[onboarding-welcome] draft generation failed:', err.message);
    }

    // 4. Insert alert
    const alertRow = {
        client_id: clientId,
        client_name: clientName,
        coach_id: coachId,
        alert_type: 'onboarding_welcome',
        priority: 'medium',
        title: `👋 ${clientName} joined — welcome them`,
        description: `New client assigned${assignedAt ? ` ${new Date(assignedAt).toISOString().slice(0,10)}` : ''}. Draft a warm opener.`,
        suggested_message: draftText || null,
        status: 'pending',
        data: {
            milestone: 'day_0',
            assigned_at: assignedAt || new Date().toISOString(),
            draft_model: draftModel,
            onboarding_facts: onboardingFacts.onboarding,
            drafted_at: new Date().toISOString(),
        },
    };

    let alertId = null;
    try {
        const inserted = await supabaseQuery(
            'coach_alerts?on_conflict=coach_id,client_id,alert_type',
            {
                method: 'POST',
                body: [alertRow],
                prefer: 'return=representation,resolution=ignore-duplicates',
            }
        );
        if (!inserted || inserted.length === 0) {
            // Concurrent invocation won the insert — partial unique index
            // kept its row. Skip the push so the coach only buzzes once.
            console.log(`[onboarding-welcome] dedup (race) for ${clientId}`);
            return { statusCode: 200, body: JSON.stringify({ skipped: 'dedup_race' }) };
        }
        alertId = inserted[0].id;
        console.log(`[onboarding-welcome] alert ${alertId} created for ${clientId} (model: ${draftModel})`);
    } catch (err) {
        console.error('[onboarding-welcome] alert insert failed:', err.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Alert insert failed', details: err.message }) };
    }

    // 5. Auto-send for trusted clients, otherwise push the approve-gate
    //    notification.
    let autoSent = false;
    if (draftText && alertId) {
        autoSent = await maybeAutoSendDraft({
            coachId,
            clientId,
            clientName,
            alertId,
            alertType: 'onboarding_welcome',
            draftText,
            siteUrl: SITE_URL,
            pushTitlePrefix: '👋 Auto-welcomed',
        });
    }

    if (!autoSent) {
        await sendWelcomePush({ coachId, clientId, clientName, draftText, alertId });
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ alert_id: alertId, draft_model: draftModel, draft_generated: !!draftText, auto_sent: autoSent }),
    };
};
