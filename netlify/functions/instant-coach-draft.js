/**
 * Instant Coach Draft — Event-Driven Function
 *
 * Fires the moment a client sends a DM to an admin/coach account.
 * Generates an AI draft reply in Shannon's voice and queues it as a
 * coach_alert so Shannon can review-edit-send in one tap.
 *
 * Trigger: DB trigger on nudges INSERT (see database/instant_coach_draft_trigger.sql)
 *
 * Flow:
 *   1. Verify receiver is an admin (reject otherwise)
 *   2. Skip "simple reply" messages (emoji-only, "ty", "👍", etc.) — don't waste Vertex calls
 *   3. Load recent conversation + client profile + client_memory for context
 *   4. Call fine-tuned Shannon model (Vertex v7, fallback Gemini) to draft a reply
 *   5. Insert coach_alerts row with type='incoming_dm', priority='high'
 *   6. Fire a "draft ready" push so Shannon's phone buzzes with the suggested reply
 *
 * Admin-only — does NOT draft replies for non-admin recipients.
 */

const {
    supabaseQuery,
    insertCoachAlert,
    loadClientMemory,
    loadOnboardingPhase,
    maybeAutoSendDraft,
    buildMemoryBlock,
    buildCoachBioBlock,
    loadEditExamples,
    loadRecentWorkouts,
    callVertexAIModel,
    callGeminiFallback,
    stripLeadingGreeting,
    truncate,
    replacePhotoMarkers,
    buildMessageImageParts,
} = require('./_lib/client-context');

const SITE_URL = process.env.URL || 'https://plantbased-balance.org';

// ============================================================
// Simple-reply detection — skip AI drafting for trivial messages
// ============================================================

/**
 * Returns true when a message is too trivial to warrant an AI draft
 * (emoji-only reactions, "ty", "got it", etc.). We still create a
 * lightweight alert so Shannon knows about the message, but with no
 * suggested_message — saves a Vertex call and his review time.
 */
function isSimpleReply(message) {
    if (!message) return true;
    const text = String(message).trim();
    if (text.length === 0) return true;

    // Strip emoji and whitespace — if nothing meaningful remains, it's a reaction
    const stripped = text
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/gu, '')
        .replace(/[\s\p{P}]/gu, '')
        .trim();
    if (stripped.length === 0) return true;

    // Short thank-yous / acknowledgements
    const lower = text.toLowerCase();
    const trivialPatterns = [
        /^(ty|thx|thanks|thank you|tysm|cheers|ok|okay|k|kk|yep|yup|yes|no|nah|got it|sounds good|sg|np|👍|❤️|🙏)\.?!?$/i,
    ];
    if (text.length <= 20 && trivialPatterns.some(p => p.test(lower))) return true;

    return false;
}

// ============================================================
// Context loading — recent conversation + lightweight client facts
// ============================================================

// Conversation lookback. Gemini 2.5 Flash + Vertex v7 both handle the full
// transcript for typical clients (a few hundred messages, ~10-20k tokens),
// so we feed essentially the whole DM history. The MAX cap is defensive
// for the rare super-chatty client — at ~500 short messages we're still
// well under any model's context budget but won't accidentally send a
// megabyte payload to Vertex.
const MAX_CONVERSATION_HISTORY = 500;

async function loadConversationContext(senderId, receiverId, currentMessage) {
    const history = await supabaseQuery(
        `nudges?select=sender_id,message,created_at&or=(and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId}))&order=created_at.desc&limit=${MAX_CONVERSATION_HISTORY + 1}`
    );
    const prior = history.filter(m => m.message !== currentMessage).reverse();
    return prior.slice(-MAX_CONVERSATION_HISTORY);
}

// If this client also has an IG/FB thread linked to their account (because
// they came in via ManyChat or Shannon manually linked them), pull the
// IG-side memory + recent IG messages so the in-app draft is grounded in
// the same relationship history as the IG draft producer.
//
// Returns { memoryText, historyText, channelLabel } — empty strings when
// there's no linked thread or the lookup fails.
async function loadLinkedIgContext(clientId) {
    const empty = { memoryText: '', historyText: '', channelLabel: '' };
    if (!clientId) return empty;
    try {
        const threads = await supabaseQuery(
            `ig_threads?select=id,channel,goals,communication_style,personal_context,injuries_limits,running_notes,last_inbound_at&linked_user_id=eq.${clientId}&order=last_inbound_at.desc.nullslast&limit=2`
        );
        if (!threads || threads.length === 0) return empty;
        const channelLabel = threads.some(t => t.channel === 'instagram') ? 'Instagram' : 'Messenger';
        const memoryParts = [];
        threads.forEach(t => {
            if (t.goals) memoryParts.push(`Goals (${channelLabel}): ${t.goals}`);
            if (t.injuries_limits) memoryParts.push(`Injuries/limits (${channelLabel}): ${t.injuries_limits}`);
            if (t.personal_context) memoryParts.push(`Personal context (${channelLabel}): ${t.personal_context}`);
            if (t.communication_style) memoryParts.push(`Communication style (${channelLabel}): ${t.communication_style}`);
            if (t.running_notes) memoryParts.push(`Running notes (${channelLabel}):\n${t.running_notes}`);
        });
        const memoryText = memoryParts.join('\n\n');
        const threadIds = threads.map(t => t.id);
        const idFilter = threadIds.map(id => `"${id}"`).join(',');
        const messages = await supabaseQuery(
            `ig_messages?select=direction,text,created_at&thread_id=in.(${idFilter})&order=created_at.desc&limit=${MAX_CONVERSATION_HISTORY}`
        );
        let historyText = '';
        if (messages && messages.length > 0) {
            const ordered = messages.slice().reverse();
            historyText = ordered.map(m => {
                const speaker = m.direction === 'in' ? 'Client' : 'Shannon';
                const cleaned = String(m.text || '').replace(/\[PHOTO:https?:\/\/[^\s\]]+\]/gi, '[photo]').trim();
                return `${speaker}: ${cleaned}`;
            }).join('\n');
        }
        return { memoryText, historyText, channelLabel };
    } catch (e) {
        console.error('[instant-draft] loadLinkedIgContext failed:', e.message);
        return empty;
    }
}

async function loadClientSnapshot(senderId) {
    const snapshot = { name: 'Client', recent: [] };

    try {
        const users = await supabaseQuery(`users?select=id,name,email&id=eq.${senderId}&limit=1`);
        if (users[0]) snapshot.name = users[0].name || users[0].email?.split('@')[0] || 'Client';
    } catch (e) { /* non-critical */ }

    try {
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const [workouts, pbs, mood] = await Promise.all([
            loadRecentWorkouts(senderId, oneWeekAgo, 3),
            supabaseQuery(`personal_bests?select=exercise_name,value,achieved_at&user_id=eq.${senderId}&achieved_at=gte.${oneWeekAgo}&order=achieved_at.desc&limit=3`).catch(() => []),
            supabaseQuery(`mood_logs?select=mood_score,energy_score,created_at&user_id=eq.${senderId}&created_at=gte.${new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()}&order=created_at.desc&limit=3`).catch(() => []),
        ]);
        if (workouts.length) snapshot.recent.push(`Recent workouts: ${workouts.map(w => w.templateName).join(', ')}`);
        if (pbs.length) snapshot.recent.push(`PBs this week: ${pbs.map(p => `${p.exercise_name} ${p.value}`).join(', ')}`);
        if (mood.length) {
            const latest = mood[0];
            snapshot.recent.push(`Latest mood: ${latest.mood_score}/10, energy ${latest.energy_score}/10`);
        }
    } catch (e) { /* non-critical */ }

    return snapshot;
}

// ============================================================
// Draft generation
// ============================================================

async function generateDraftReply({ clientName, clientSnapshot, conversationHistory, currentMessage, memoryBlock, onboardingPhase, igContext }) {
    // Scope edits to THIS client first — the AI picks up "this is how Shannon
    // actually talks to this person" once he's edited a few drafts for them.
    // Pads with up to 3 general edits when the person-specific corpus is
    // sparse, capped low so unrelated cross-client edits don't drown out
    // the per-person voice signal.
    const editExamples = await loadEditExamples({
        clientId: clientSnapshot.id,
    });
    const coachBioBlock = buildCoachBioBlock();

    // Inline any photos attached to the CURRENT client message so Gemini can
    // actually see them. Prior photos in history stay marked [photo] — no need
    // to refetch/inline them (latency + token cost) since the reply is about
    // the new message.
    const { imageParts, rewrittenMessage } = await buildMessageImageParts(currentMessage);
    const currentMessageText = rewrittenMessage;

    const historyText = conversationHistory.length > 0
        ? conversationHistory.map(m => {
            const speaker = m.sender_id === clientSnapshot.id ? clientName : 'Shannon';
            const cleaned = replacePhotoMarkers(m.message, () => '[photo]');
            return `${speaker}: ${cleaned}`;
        }).join('\n')
        : '(no prior conversation)';

    const snapshotText = clientSnapshot.recent.length > 0
        ? clientSnapshot.recent.join('\n')
        : '(no recent activity snapshot)';

    // Onboarding mode: first 72h with this coach. Shifts the prompt from
    // "answer their question" to "keep the get-to-know-you conversation
    // moving" — and only pitches the wellness challenge after a few
    // back-and-forth messages, never on the first reply.
    let onboardingBlock = '';
    if (onboardingPhase?.inOnboarding) {
        const facts = onboardingPhase.onboardingFacts.length
            ? onboardingPhase.onboardingFacts.join('\n')
            : '(none captured)';

        // Count how many messages the CLIENT has actually sent in this thread,
        // including the new message we're replying to. Drives when to pitch.
        const clientReplyCount = conversationHistory.filter(m => m.sender_id === clientSnapshot.id).length + 1;

        let challengeLine;
        if (onboardingPhase.challengeAccepted) {
            challengeLine = `${clientName} has already accepted a wellness challenge with Shannon — DON'T re-pitch. Reference it naturally if relevant ("excited to verse you in the quiz!") but focus on rapport.`;
        } else if (clientReplyCount < 3) {
            challengeLine = `EARLY conversation (${clientReplyCount} client message${clientReplyCount === 1 ? '' : 's'} so far). DO NOT pitch any challenge, program, or call-to-action yet. Just chat. Ask a genuine follow-up question that builds on what they just said — keep getting to know them. The pitch comes later.`;
        } else {
            challengeLine = `Conversation is warming up (${clientReplyCount} client messages now). If there's a NATURAL opening in this reply, soft-pitch a wellness challenge framed as a favour: "I need someone to verse me in a Health IQ quiz challenge, you keen?" If their goal is activity/weight-loss focused, a step challenge fits too. Only ONE pitch — if they dodge, drop it and keep building rapport. If their current message is heavy/vulnerable (struggle, plateau, doubt), validate first and skip the pitch this turn.`;
        }

        onboardingBlock = `

ONBOARDING MODE (active — ${onboardingPhase.hoursSinceAssigned}h since ${clientName} signed up, ${clientReplyCount} client message${clientReplyCount === 1 ? '' : 's'} into the convo):
This is the first 72 hours of the coaching relationship. Shannon is still getting to know them. Your job for these replies:
- Stay genuinely curious — ask open follow-up questions that build understanding (their why, their wall, their wins so far). One question per reply, not a quiz.
- Anchor on what you actually know about them (memory + onboarding facts below) — proves you're paying attention.
- Match their energy and mirror their interests when they share something (skateboarding, hiking, whatever).
- Never assume facts that aren't in the data — Shannon got burned assuming a client was vegan when she wasn't.
- ${challengeLine}

ONBOARDING FACTS:
${facts}`;
    }

    // Cross-channel context: when this client also has an IG/FB thread linked
    // to their account, include the IG-side memory and recent IG messages so
    // Shannon's draft is grounded in the longer relationship — not just the
    // in-app DM thread we have here.
    const igMemoryText = igContext?.memoryText || '';
    const igHistoryText = igContext?.historyText || '';
    const igChannelLabel = igContext?.channelLabel || 'Instagram';
    const igBlock = (igMemoryText || igHistoryText) ? `

CROSS-CHANNEL HISTORY (${igChannelLabel}):
${clientName} also has DM history with Shannon on ${igChannelLabel}. Treat this as one continuous relationship — don't repeat advice already given over there, and don't ignore facts they've already shared. The IG-side notes below were extracted from those conversations.${igMemoryText ? `

${igChannelLabel.toUpperCase()} NOTES:
${igMemoryText}` : ''}${igHistoryText ? `

RECENT ${igChannelLabel.toUpperCase()} MESSAGES (older → newer):
${igHistoryText}` : ''}` : '';

    const prompt = `Draft a SHORT reply to this incoming client DM in Shannon's voice.

CRITICAL — DO NOT GREET: Never start with "hey [name]", "hi", "yo". Jump straight into content. This is an ongoing conversation, not a first message.

Keep it brief — 1–3 sentences max. Match energy: if they're celebrating, celebrate. If they're stressed, validate first. If it's a practical question, answer directly. Australian casual tone, lowercase-friendly, no corporate fluff.

APP FEATURES (the client is using FITGotchi / Plant Based Balance — DO NOT recommend external apps like MyFitnessPal, Cronometer, Strong, Fitbod, etc. Everything is built in):
- Calories/meals: Nutrition tab. Log via photo, gallery, barcode scan, text ("2 slices toast w/ PB"), manual build, or recent/saved meals. AI identifies food from a photo.
- Weight: Home tab → tap weight card (or can also tell the AI assistant).
- Water: Nutrition tab → water tracker.
- Workouts: Movement tab — weekly schedule, 1800+ exercise library with video demos, PRs auto-detect.
- Meal plan: Nutrition tab — AI can generate a 35-meal personalised plan.
- Progress: Home tab shows weight chart, streaks, achievements; Movement shows PRs and history.
- Mood/energy/stress check-in: Home tab.
- Challenges with friends, Health IQ quizzes, custom trackers/checklists, cycle tracking, wearable sync (Fitbit/Oura/WHOOP/Strava) — all in-app.
If they ask "how do I X?", point them to the right tab IN THIS APP. Never suggest downloading another tracker.
${coachBioBlock}

CLIENT: ${clientName}${memoryBlock || ''}${igBlock}${onboardingBlock}

RECENT ACTIVITY:
${snapshotText}

CONVERSATION HISTORY:
${historyText}

THEIR NEW MESSAGE:
${currentMessageText}${imageParts.length ? `\n\n(${imageParts.length} photo${imageParts.length === 1 ? '' : 's'} attached below — look at ${imageParts.length === 1 ? 'it' : 'them'} and let ${imageParts.length === 1 ? 'it' : 'them'} shape your reply. If it's food, react to what you see. If it's progress/body/form, give specific feedback on what's visible.)` : ''}${editExamples}

Reply with just the message text — no quotes, no commentary, no labels.`;

    const parts = [{ text: prompt }, ...imageParts];
    const contents = [{ role: 'user', parts }];
    // 2048 gives headroom for the fine-tuned v7 model's internal reasoning
    // tokens (which count against maxOutputTokens on Gemini 2.x) so the
    // visible reply never gets cut off mid-sentence. 1-3 sentence replies
    // nowhere near fill this budget.
    const generationConfig = { maxOutputTokens: 2048, temperature: 0.8 };

    // When the client attached a photo, skip the fine-tuned Vertex v7 model
    // and go straight to Gemini 2.0 Flash. v7 was trained on text-only
    // coach replies, so inlining images there is out-of-distribution —
    // better to use the stock multimodal model that actually knows how to
    // read an image. Text-only messages keep the Vertex-primary path.
    if (imageParts.length > 0) {
        try {
            const reply = await callGeminiFallback(contents, generationConfig);
            return { text: stripLeadingGreeting(reply), model: 'gemini-2.0-vision' };
        } catch (err) {
            console.error('[instant-draft] Gemini vision call failed:', err.message);
            return { text: '', model: 'none' };
        }
    }

    // Primary: fine-tuned Shannon model
    try {
        const reply = await callVertexAIModel(contents, generationConfig);
        return { text: stripLeadingGreeting(reply), model: 'vertex-v7' };
    } catch (err) {
        console.warn(`[instant-draft] Vertex failed, falling back to Gemini: ${err.message}`);
    }

    // Fallback: Gemini 2.0 Flash
    try {
        const reply = await callGeminiFallback(contents, generationConfig);
        return { text: stripLeadingGreeting(reply), model: 'gemini-2.0-fallback' };
    } catch (err) {
        console.error('[instant-draft] Gemini fallback failed:', err.message);
        return { text: '', model: 'none' };
    }
}

// ============================================================
// Push notification — "draft ready" buzz with the actual draft
// ============================================================

async function sendDraftReadyPush({ adminId, clientId, clientName, clientMessage, draftText, alertId, isSimpleReply }) {
    try {
        const hasDraft = !!draftText && !isSimpleReply;
        const title = hasDraft
            ? `💬 ${clientName} — draft ready`
            : `💬 ${clientName} just messaged`;
        // Lead with the DRAFT — Android's collapsed notification view only
        // shows one line, and the draft is what Shannon needs to see to
        // decide "send / edit / skip". The client message rides along as
        // a separate FCM data field (clientMessage) so the native service
        // can render both cleanly in MessagingStyle.
        const body = hasDraft
            ? truncate(draftText, 220)
            : `"${truncate(clientMessage, 180)}"`;

        const pushUrl = `${SITE_URL}/.netlify/functions/send-dm-notification`;
        await fetch(pushUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientId: adminId,
                senderId: clientId,
                senderName: title,
                messageText: body,
                type: 'coach_draft_ready',
                alertId,
                clientId,
                clientName,
                clientMessage: clientMessage || '',
                draftText: draftText || '',
                isSimpleReply: !!isSimpleReply,
            }),
        }).catch(e => console.warn('[instant-draft] push dispatch failed:', e.message));
    } catch (err) {
        console.warn('[instant-draft] draft-ready push failed:', err.message);
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

    const { nudgeId, senderId, receiverId, messageText } = payload;
    if (!nudgeId || !senderId || !receiverId || !messageText) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    // 1. Safety check — only draft for admin/coach recipients
    const admins = await supabaseQuery(`admin_users?select=user_id&user_id=eq.${receiverId}&limit=1`);
    if (admins.length === 0) {
        console.log(`[instant-draft] receiver ${receiverId} is not admin — ignoring`);
        return { statusCode: 200, body: JSON.stringify({ skipped: 'not_admin' }) };
    }

    // 2. Pre-check dedup — atomic guarantee comes from the idempotency_key
    //    UNIQUE index on insert; this saves the Vertex call on retries.
    const idempotencyKey = `incoming_dm:${nudgeId}`;
    try {
        const existing = await supabaseQuery(
            `coach_alerts?select=id&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`
        );
        if (existing.length > 0) {
            console.log(`[instant-draft] alert already exists for nudge ${nudgeId}`);
            return { statusCode: 200, body: JSON.stringify({ skipped: 'duplicate' }) };
        }
    } catch (e) { /* continue */ }

    // 3. Resolve client name
    const clientSnapshot = await loadClientSnapshot(senderId);
    clientSnapshot.id = senderId;
    const clientName = clientSnapshot.name;

    // 4. Short-circuit for trivial replies
    const simple = isSimpleReply(messageText);

    let draftText = '';
    let draftModel = 'skipped-simple-reply';

    if (!simple) {
        try {
            const [history, memory, onboardingPhase, igContext] = await Promise.all([
                loadConversationContext(senderId, receiverId, messageText),
                loadClientMemory(receiverId, senderId),
                loadOnboardingPhase(receiverId, senderId),
                loadLinkedIgContext(senderId),
            ]);
            const memoryBlock = buildMemoryBlock(memory);
            const draft = await generateDraftReply({
                clientName,
                clientSnapshot,
                conversationHistory: history,
                currentMessage: messageText,
                memoryBlock,
                onboardingPhase,
                igContext,
            });
            draftText = draft.text;
            draftModel = onboardingPhase?.inOnboarding ? `${draft.model}+onboarding` : draft.model;
        } catch (err) {
            console.error('[instant-draft] draft generation failed:', err.message);
        }
    }

    // 5. Insert coach_alert
    const alertRow = {
        client_id: senderId,
        client_name: clientName,
        coach_id: receiverId,
        alert_type: 'incoming_dm',
        priority: simple ? 'medium' : 'high',
        title: `${clientName} just messaged you`,
        description: `"${truncate(messageText, 200)}"`,
        suggested_message: draftText || null,
        status: 'pending',
        data: {
            nudge_id: nudgeId,
            message_preview: truncate(messageText, 400),
            hours_waiting: 0,
            draft_model: draftModel,
            is_simple_reply: simple,
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
            console.log(`[instant-draft] dedup race — alert ${alertId} already exists for nudge ${nudgeId}`);
            return { statusCode: 200, body: JSON.stringify({ skipped: 'duplicate', alert_id: alertId }) };
        }
        console.log(`[instant-draft] alert ${alertId} created for nudge ${nudgeId} (model: ${draftModel})`);
    } catch (err) {
        console.error('[instant-draft] alert insert failed:', err.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Alert insert failed', details: err.message }) };
    }

    // 6. Auto-send for trusted clients, otherwise push the approve-gate
    //    notification. Simple replies never auto-send — no draft exists.
    let autoSent = false;
    if (!simple && draftText && alertId) {
        autoSent = await maybeAutoSendDraft({
            coachId: receiverId,
            clientId: senderId,
            clientName,
            alertId,
            alertType: 'incoming_dm',
            draftText,
            siteUrl: SITE_URL,
            pushTitlePrefix: '💬 Auto-replied',
        });
    }

    if (!autoSent) {
        await sendDraftReadyPush({
            adminId: receiverId,
            clientId: senderId,
            clientName,
            clientMessage: messageText,
            draftText,
            alertId,
            isSimpleReply: simple,
        });
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            alert_id: alertId,
            draft_model: draftModel,
            draft_generated: !!draftText,
            is_simple_reply: simple,
            auto_sent: autoSent,
        }),
    };
};
