/**
 * Badge Earned Alert — Event-Driven Function
 *
 * Fires when a client earns one or more milestone badges (10th meal tracked,
 * 30-day streak, level 50, etc). Drafts a single batched congrats message in
 * Shannon's voice and queues it as a `coach_alerts` row so Shannon can tap-send
 * a quick well-done from his lockscreen.
 *
 * Why server-side: the badge-earning logic lives in dashboard-script-15.js and
 * mirrors earned badges to localStorage. That's fine for the client-side toast
 * but it means clearing storage or logging in on a new device would re-fire
 * alerts. This function uses the `user_badges` table as the source of truth —
 * only badges that are NEWLY inserted (not already in the ledger) count as
 * "earned right now" and can trigger an alert.
 *
 * Callers (all client-side): batched POST from the awardBadge() path in
 * js/dashboard/dashboard-script-15.js via a short debounce, so two badges
 * earned from the same meal log share one alert / one push.
 *
 * Trigger: POST with { clientId, badges: [{ id, name, emoji, desc, category }] }
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
    callVertexAIModel,
    callGeminiFallback,
    stripLeadingGreeting,
    truncate,
    isTestAccount,
    recentlyMessaged,
    fireDraftReasoning,
} = require('./_lib/client-context');

const SITE_URL = process.env.URL || 'https://plantbased-balance.org';
const BALANCE_ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining.com';

// ============================================================
// "Big" badges — the only ones that fire a coach alert.
//
// Tiny "_1" badges are intentionally excluded: first-workout is already
// covered by first-workout-celebration.js, first-meal / first-PB / first-rare
// would be too noisy across a roster. The list below keeps the alerts to
// genuinely hype-worthy moments.
// ============================================================

const BIG_BADGE_IDS = new Set([
    // Workouts — first-workout has its own dedicated alert
    'workout_5', 'workout_25', 'workout_100', 'workout_365',
    // Streaks
    'streak_7', 'streak_30', 'streak_60',
    // Meal milestones
    'meal_10', 'meal_50', 'meal_100', 'meal_365',
    // PB milestones — individual PBs already fire pb-celebration-draft,
    // these are the "hit 10 / 25 / 50 PBs total" milestones.
    'pb_10', 'pb_25', 'pb_50',
    // Rare collection milestones
    'rare_3', 'rare_6', 'rare_11',
    // Challenge milestones
    'challenge_3', 'challenge_w1', 'challenge_w5',
    // Level milestones
    'level_10', 'level_30', 'level_50', 'level_99',
]);

// ============================================================
// Helpers
// ============================================================

async function resolveCoach(clientId) {
    try {
        const links = await supabaseQuery(
            `coach_clients?select=coach_id&client_id=eq.${clientId}&status=eq.active&order=assigned_at.asc&limit=1`
        );
        if (links[0]?.coach_id) return links[0].coach_id;
    } catch (e) { /* fall through */ }
    try {
        const admins = await supabaseQuery(`users?select=id&email=eq.${encodeURIComponent(BALANCE_ADMIN_EMAIL)}&limit=1`);
        if (admins[0]?.id) return admins[0].id;
    } catch (e) { /* ignore */ }
    return null;
}

async function loadClientName(clientId) {
    try {
        const users = await supabaseQuery(`users?select=name,email&id=eq.${clientId}&limit=1`);
        if (users[0]) return users[0].name || users[0].email?.split('@')[0] || 'Client';
    } catch (e) { /* non-critical */ }
    return 'Client';
}

/**
 * Inserts each submitted badge into user_badges with conflict-ignore.
 * Returns the set of badge IDs that were actually newly inserted — i.e. not
 * already in the ledger for this user. This is our "earned right now" set.
 */
async function insertNewBadges(clientId, badgeIds) {
    if (!badgeIds.length) return [];
    const rows = badgeIds.map(id => ({ user_id: clientId, badge_id: id }));
    try {
        const inserted = await supabaseQuery('user_badges', {
            method: 'POST',
            body: rows,
            prefer: 'return=representation,resolution=ignore-duplicates',
        });
        return (inserted || []).map(r => r.badge_id);
    } catch (err) {
        console.error('[badge-earned] user_badges insert failed:', err.message);
        return [];
    }
}

function badgeHeadline(badges) {
    if (badges.length === 1) {
        const b = badges[0];
        return `${b.emoji || '🏅'} ${b.name}`;
    }
    const top = badges[0];
    return `${top.emoji || '🏅'} ${top.name} (+${badges.length - 1} more)`;
}

function describeBadgesForPrompt(badges) {
    return badges.map(b => {
        const parts = [b.name];
        if (b.desc) parts.push(`(${b.desc})`);
        return `- ${b.emoji || '🏅'} ${parts.join(' ')}`;
    }).join('\n');
}

// ============================================================
// Draft generation
// ============================================================

async function generateBadgeDraft({ clientName, badges, profileBlock, memoryBlock }) {
    const editExamples = await loadEditExamples({ lookback: 15, max: 4 });
    const nameUsePolicy = buildNameUsePolicyBlock();
    const relationshipDiscovery = buildRelationshipDiscoveryBlock();
    const heardFirstConversation = buildHeardFirstConversationBlock();

    const isMulti = badges.length > 1;
    const badgeList = describeBadgesForPrompt(badges);

    const prompt = `Draft a SHORT message acknowledging a client who just unlocked ${isMulti ? 'multiple milestone badges' : 'a milestone badge'} in the app. Send it unprompted — you noticed the milestone, not a reply.

CRITICAL — DO NOT GREET with "hey [name]" / "hi" / "yo". Jump straight into content. Aussie casual, 1-2 sentences max, normal phone autocorrect casing, warm. Profanity welcome — that's Shannon's voice.

${isMulti ? 'Acknowledge the milestones together — not a list. Pick the most meaningful one and build the message around it, maybe nod at the other(s) if it flows.' : 'Reference the specific milestone — it shows you noticed.'} Prefer ending with ONE open question that keeps momentum and learns something real about what helped or what got in the way. Use a short hype beat only if a question would feel forced.

Avoid: "great job", "well done", "congrats on". Match the tone of a mate who was watching, not a brand congratulating.

${nameUsePolicy}
${relationshipDiscovery}
${heardFirstConversation}

CLIENT: ${clientName}${profileBlock || ''}${memoryBlock || ''}

BADGE${isMulti ? 'S' : ''} JUST EARNED:
${badgeList}${editExamples}

Reply with just the message text — no quotes, no commentary, no labels.`;

    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const generationConfig = { maxOutputTokens: 1024, temperature: 0.85 };

    try {
        const reply = await callVertexAIModel(contents, generationConfig);
        return { text: stripLeadingGreeting(reply), model: 'vertex-v7' };
    } catch (err) {
        console.warn(`[badge-earned] Vertex failed, falling back: ${err.message}`);
    }
    try {
        const reply = await callGeminiFallback(contents, generationConfig);
        return { text: stripLeadingGreeting(reply), model: 'gemini-2.0-fallback' };
    } catch (err) {
        console.error('[badge-earned] Gemini fallback failed:', err.message);
        return { text: '', model: 'none' };
    }
}

// ============================================================
// Handler
// ============================================================

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    let payload;
    try { payload = JSON.parse(event.body); }
    catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

    const { clientId } = payload;
    const badges = Array.isArray(payload.badges) ? payload.badges : [];

    if (!clientId || !badges.length) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing clientId or badges' }) };
    }

    // Skip test accounts entirely — don't even ledger the badges, Shannon
    // doesn't need his own second-account milestones cluttering the feed.
    if (await isTestAccount(clientId)) {
        return { statusCode: 200, body: JSON.stringify({ skipped: 'test_account' }) };
    }

    // 1. Persist every submitted badge to the ledger (ignore-duplicates).
    //    The ledger survives localStorage wipes / new devices so we never
    //    re-fire an alert for a badge this user already had.
    const submittedIds = [...new Set(badges.map(b => b && b.id).filter(Boolean))];
    const newlyEarnedIds = new Set(await insertNewBadges(clientId, submittedIds));

    if (newlyEarnedIds.size === 0) {
        return { statusCode: 200, body: JSON.stringify({ skipped: 'no_new_badges' }) };
    }

    // 2. Filter down to the "big" badges worth an alert. Small/first badges
    //    still get persisted (for the user's own collection view) but don't
    //    bother the coach.
    const alertBadges = badges.filter(b =>
        b && b.id && newlyEarnedIds.has(b.id) && BIG_BADGE_IDS.has(b.id)
    );

    if (alertBadges.length === 0) {
        return { statusCode: 200, body: JSON.stringify({ persisted: newlyEarnedIds.size, skipped: 'no_big_badges' }) };
    }

    // 3. Resolve coach
    const coachId = await resolveCoach(clientId);
    if (!coachId) {
        return { statusCode: 200, body: JSON.stringify({ persisted: newlyEarnedIds.size, skipped: 'no_coach' }) };
    }

    // 4. Dedup — if an identical badge_earned alert landed in the last 10
    //    minutes (race between client retries), bail. Client-side debounce
    //    should cover most of this; this is a seatbelt.
    try {
        const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const existing = await supabaseQuery(
            `coach_alerts?select=id,data&coach_id=eq.${coachId}&client_id=eq.${clientId}&alert_type=eq.badge_earned&created_at=gte.${cutoff}&limit=5`
        );
        const alreadyAlerted = new Set();
        for (const row of existing) {
            const ids = row.data?.badge_ids || [];
            ids.forEach(id => alreadyAlerted.add(id));
        }
        const unseen = alertBadges.filter(b => !alreadyAlerted.has(b.id));
        if (unseen.length === 0) {
            return { statusCode: 200, body: JSON.stringify({ skipped: 'dedup_recent' }) };
        }
        // keep only unseen for the draft + alert body
        alertBadges.length = 0;
        alertBadges.push(...unseen);
    } catch (e) { /* continue */ }

    // Suppress if Shannon has messaged this client within the last 24h —
    // badge hype is nice but not urgent, and we don't want a double-message.
    if (await recentlyMessaged({ coachId, clientId, hours: 24 })) {
        // Still persist the alert as pending so it shows up in the feed
        // for later — just skip the push and skip auto-send.
    }

    // 5. Draft
    const clientName = await loadClientName(clientId);
    const [memory, profile] = await Promise.all([
        loadClientMemory(coachId, clientId),
        loadClientProfileFacts(clientId),
    ]);
    const memoryBlock = buildMemoryBlock(memory);
    const profileBlock = buildClientProfileBlock({ clientName, profile });

    let draftText = '';
    let draftModel = 'none';
    try {
        const draft = await generateBadgeDraft({ clientName, badges: alertBadges, profileBlock, memoryBlock });
        draftText = draft.text;
        draftModel = draft.model;
    } catch (err) {
        console.error('[badge-earned] draft generation failed:', err.message);
    }

    // 6. Insert the alert
    const headline = badgeHeadline(alertBadges);
    const isMulti = alertBadges.length > 1;
    const descLines = alertBadges.map(b => `${b.emoji || '🏅'} ${b.name}${b.desc ? ` — ${b.desc}` : ''}`);

    const alertRow = {
        client_id: clientId,
        client_name: clientName,
        coach_id: coachId,
        alert_type: 'badge_earned',
        priority: 'medium',
        title: isMulti
            ? `🏅 ${clientName} unlocked ${alertBadges.length} badges!`
            : `${alertBadges[0].emoji || '🏅'} ${clientName} unlocked "${alertBadges[0].name}"`,
        description: descLines.join('  •  '),
        suggested_message: draftText || null,
        status: 'pending',
        data: {
            badge_ids: alertBadges.map(b => b.id),
            badges: alertBadges.map(b => ({
                id: b.id, name: b.name, emoji: b.emoji || null,
                desc: b.desc || null, category: b.category || null,
            })),
            draft_model: draftModel,
            drafted_at: new Date().toISOString(),
        },
    };

    let alertId = null;
    let deduped = false;
    try {
        // Sort badge IDs so retries with the same set in different orders
        // collapse onto the same key. One alert per (client, badge-set) for life.
        const badgeKey = [...alertBadges.map(b => b.id)].sort().join(',');
        const idempotencyKey = `badge_earned:${clientId}:${badgeKey}`;
        const result = await insertCoachAlert(alertRow, idempotencyKey);
        alertId = result.alertId;
        deduped = result.deduped;
        if (deduped) {
            console.log(`[badge-earned] dedup race — alert ${alertId} already exists for ${clientId} / ${badgeKey}`);
            return { statusCode: 200, body: JSON.stringify({ skipped: 'dedup_race', alert_id: alertId }) };
        }
        console.log(`[badge-earned] alert ${alertId} for ${clientId} — ${alertBadges.map(b => b.id).join(', ')} (model: ${draftModel})`);
    } catch (err) {
        console.error('[badge-earned] alert insert failed:', err.message);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }

    // Skip push/auto-send if we've already chatted with them today — the
    // alert is still in the feed for when Shannon opens the dashboard.
    const suppressPush = await recentlyMessaged({ coachId, clientId, hours: 24 });

    // 7. Auto-send (if toggle is on for this client) OR push the approve-gate
    let autoSent = false;
    if (!suppressPush && draftText && alertId) {
        autoSent = await maybeAutoSendDraft({
            coachId,
            clientId,
            clientName,
            alertId,
            alertType: 'badge_earned',
            draftText,
            siteUrl: SITE_URL,
            pushTitlePrefix: '🏅 Auto-hyped',
        });
    }

    if (!suppressPush && !autoSent && alertId) {
        try {
            const title = isMulti
                ? `🏅 ${clientName} — ${alertBadges.length} badges!`
                : `${alertBadges[0].emoji || '🏅'} ${clientName} — ${alertBadges[0].name}`;
            const body = draftText
                ? `${truncate(headline, 80)}\n→ ${truncate(draftText, 140)}`
                : truncate(descLines.join(' • '), 180);
            await fetch(`${SITE_URL}/.netlify/functions/send-dm-notification`, {
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
            }).catch(e => console.warn('[badge-earned] push dispatch failed:', e.message));
        } catch (err) {
            console.warn('[badge-earned] push failed:', err.message);
        }
    }

    // Fire-and-forget reasoning — lands on data.draft_reasoning a beat later
    if (alertId && draftText) {
        const badgeNames = alertBadges.map(b => `${b.emoji || '🏅'} ${b.name}`).join(', ');
        const contextBlocks = `${clientName} just unlocked ${alertBadges.length > 1 ? `${alertBadges.length} badges` : 'a badge'}: ${badgeNames}.${alertBadges[0]?.desc ? `\nTop badge: ${alertBadges[0].desc}` : ''}`;
        fireDraftReasoning({
            alertId,
            draftText,
            alertType: 'badge_earned',
            contextBlocks,
            clientName,
        });
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            alert_id: alertId,
            badges_alerted: alertBadges.map(b => b.id),
            badges_persisted: [...newlyEarnedIds],
            draft_model: draftModel,
            draft_generated: !!draftText,
            auto_sent: autoSent,
            push_suppressed: suppressPush,
        }),
    };
};
