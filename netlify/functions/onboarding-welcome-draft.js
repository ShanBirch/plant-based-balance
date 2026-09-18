/** Coach assignment hook: preserve signup context; the video replaces the legacy text welcome. */

const { supabaseQuery } = require('./_lib/client-context');

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

function buildWelcomeDraft(clientName, facts = {}) {
    const firstName = (clientName || '').split(/\s+/)[0] || 'there';
    const goalsAreSet = Array.isArray(facts.weeklyGoals) && facts.weeklyGoals.length >= 3;
    let setupLine = '';
    if (facts.mealPlanReady && goalsAreSet) {
        setupLine = 'looks like your meal plan and weekly goals are all sorted. how did you go with setup?';
    } else if (facts.mealPlanNeedsReview) {
        setupLine = goalsAreSet
            ? 'your weekly goals are sorted. i’m just checking your meal plan against your food preferences. how did you go with setup?'
            : 'i’m just checking your meal plan against your food preferences. have you picked your three weekly goals on Home yet?';
    } else if (facts.mealPlanReady) {
        setupLine = 'your meal plan is ready in Nutrition. have you picked your three weekly goals on Home yet?';
    } else if (goalsAreSet) {
        setupLine = 'your weekly goals are sorted. have you found your meal plan in Nutrition yet?';
    } else {
        setupLine = 'have you found your meal plan in Nutrition and picked your three weekly goals on Home yet?';
    }
    const text = `hey ${firstName}, saw you made it in 🙌 welcome. ${setupLine}`
        .replace(/\s+/g, ' ')
        .trim();
    return { text, model: 'static-template' };
}

// ============================================================
// Push
// ============================================================

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    let payload;
    try { payload = JSON.parse(event.body); }
    catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }
    const { coachId, clientId } = payload || {};
    if (!coachId || !clientId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing coachId/clientId' }) };
    }

    // The coach video is the welcome. Keep signup context for future coaching,
    // but never create a welcome text, pending draft, or notification here.
    try {
        await seedMemoryFromInvitation({ coachId, clientId });
    } catch (error) {
        console.warn('[onboarding-welcome] memory seed failed (non-critical):', error.message);
    }
    return {
        statusCode: 200,
        body: JSON.stringify({ skipped: 'video_welcome_replaces_text', auto_sent: false }),
    };
};
exports._buildWelcomeDraft = buildWelcomeDraft;
