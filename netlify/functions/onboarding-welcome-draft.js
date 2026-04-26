/**
 * Onboarding Welcome Draft — Day 0 Event-Driven Function
 *
 * Fires the moment a client is assigned to a coach (coach_clients INSERT).
 * See database/coach_clients_onboarding_trigger.sql.
 *
 * Drops a short, fixed welcome template ("Hey {name}, thanks so much for
 * joining us...") onto Shannon's lockscreen with the inline-reply action
 * pre-filled — same UX as every other coach_draft_ready notification.
 */

const {
    supabaseQuery,
    maybeAutoSendDraft,
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

function buildWelcomeDraft(clientName) {
    const firstName = (clientName || '').split(/\s+/)[0] || 'there';
    const text = `Hey ${firstName}, thanks so much for joining us. I'm Coach Shannon — I built this app this year. If you ever need anything or have any suggestions for the app, let me know. How are you doing?`;
    return { text, model: 'static-template' };
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

    // 2. Load facts (for client name + alert metadata)
    const onboardingFacts = await loadOnboardingFacts(clientId);
    const clientName = onboardingFacts.name;

    // 3. Draft
    const { text: draftText, model: draftModel } = buildWelcomeDraft(clientName);

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
        const inserted = await supabaseQuery('coach_alerts', {
            method: 'POST',
            body: [alertRow],
            prefer: 'return=representation',
        });
        alertId = inserted?.[0]?.id || null;
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
