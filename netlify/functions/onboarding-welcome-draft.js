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
    insertCoachAlert,
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
        const exercisePrefs = pd.exercise_preferences || {};
        if (Array.isArray(exercisePrefs.liked_exercises) && exercisePrefs.liked_exercises.length) {
            facts.onboarding.push(`Liked exercises: ${exercisePrefs.liked_exercises.slice(0, 8).join(', ')}`);
        }
        if (Array.isArray(exercisePrefs.avoided_exercises) && exercisePrefs.avoided_exercises.length) {
            facts.onboarding.push(`Exercises to avoid: ${exercisePrefs.avoided_exercises.slice(0, 8).join(', ')}`);
        }
        if (pd.dietary_preference) facts.onboarding.push(`Diet: ${pd.dietary_preference}`);
        if (pd.activity_level) facts.onboarding.push(`Activity level: ${pd.activity_level}`);
        if (pd.profile) facts.onboarding.push(`Profile: ${pd.profile}`);
    } catch (e) { /* non-critical */ }

    return facts;
}

// ============================================================
// Seed client_memory from the cohort invitation's `about_me` field.
// LP applicants describe themselves on vegan-challenge.html; that text
// belongs in client_memory.personal_context so every future AI draft
// (instant-coach-draft, scheduled-scan, weekly-check-in, etc.) has the
// signup intent baked into its prompt.
//
// Only writes if no manual personal_context already exists — Shannon's
// own notes always win.
// ============================================================
async function seedMemoryFromInvitation({ coachId, clientId }) {
    const users = await supabaseQuery(`users?select=email&id=eq.${clientId}&limit=1`);
    const email = users[0]?.email?.toLowerCase();
    if (!email) return;

    const invs = await supabaseQuery(
        `cohort_invitations?select=about_me,created_at&email=eq.${encodeURIComponent(email)}&about_me=not.is.null&order=created_at.desc&limit=1`
    );
    const aboutMe = invs[0]?.about_me?.trim();
    if (!aboutMe) return;

    const existing = await supabaseQuery(
        `client_memory?select=id,personal_context&coach_id=eq.${coachId}&client_id=eq.${clientId}&limit=1`
    );

    if (existing.length === 0) {
        await supabaseQuery('client_memory', {
            method: 'POST',
            body: [{ coach_id: coachId, client_id: clientId, personal_context: aboutMe }],
            prefer: 'return=minimal',
        });
        console.log(`[onboarding-welcome] seeded new client_memory from invitation for ${clientId}`);
    } else if (!existing[0].personal_context) {
        await supabaseQuery(`client_memory?id=eq.${existing[0].id}`, {
            method: 'PATCH',
            body: { personal_context: aboutMe },
            prefer: 'return=minimal',
        });
        console.log(`[onboarding-welcome] populated empty personal_context from invitation for ${clientId}`);
    } else {
        console.log(`[onboarding-welcome] skip seed — personal_context already set for ${clientId}`);
    }
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

    // 1. Pre-check dedup — saves the seed-from-invitation cost when we
    //    already know the welcome went out. The hard guarantee comes from
    //    the idempotency_key UNIQUE index on insert.
    const idempotencyKey = `onboarding_welcome:${coachId}:${clientId}`;
    try {
        const existing = await supabaseQuery(
            `coach_alerts?select=id&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`
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

    // 2.5. Seed client_memory.personal_context from the LP's `about_me` field
    //      so every future draft (instant-coach-draft, scheduled scans, etc.)
    //      has signup intent in its prompt. Non-critical — soft-fail.
    try {
        await seedMemoryFromInvitation({ coachId, clientId });
    } catch (e) {
        console.warn('[onboarding-welcome] memory seed failed (non-critical):', e.message);
    }

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
    let deduped = false;
    try {
        const result = await insertCoachAlert(alertRow, idempotencyKey);
        alertId = result.alertId;
        deduped = result.deduped;
        if (deduped) {
            console.log(`[onboarding-welcome] dedup race — welcome ${alertId} already exists for ${clientId}`);
            return { statusCode: 200, body: JSON.stringify({ skipped: 'dedup_race', alert_id: alertId }) };
        }
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
