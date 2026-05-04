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
    cancelPriorScheduledForClient,
    selectRecentInboundSinceLastReply,
    resolveLifecycleStage,
    lifecycleForFcmData,
    fireDraftReasoning,
    buildMemoryBlock,
    loadClientProfileFacts,
    buildClientProfileBlock,
    buildCoachBioBlock,
    buildAppXpGuideBlock,
    buildNameUsePolicyBlock,
    buildRelationshipDiscoveryBlock,
    loadEditExamples,
    loadRecentWorkouts,
    formatRecentWorkoutEvidence,
    callVertexAIModel,
    callGeminiFallback,
    stripLeadingGreeting,
    truncate,
    formatCoachLocalTimestamp,
    formatTimedConversationLine,
    replacePhotoMarkers,
    buildMessageImageParts,
    extractPhotoUrls,
} = require('./_lib/client-context');
const { buildQualifierRelationshipBlock } = require('./_lib/qualifier-engine');

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

function replaceVideoMarkers(text, replacer) {
    return String(text || '').replace(/\[video:\s*(https?:\/\/[^\s\]"']+)\]/gi, (_, url) => replacer(url));
}

function extractVideoUrls(text) {
    const urls = [];
    String(text || '').replace(/\[video:\s*(https?:\/\/[^\s\]"']+)\]/gi, (_, url) => {
        urls.push(url);
        return '';
    });
    return urls;
}

function buildDisplayMedia(rawText) {
    return [
        ...extractPhotoUrls(rawText).map(url => ({ type: 'photo', url })),
        ...extractVideoUrls(rawText).map(url => ({ type: 'video', url })),
    ];
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
            `ig_threads?select=id,channel,goals,communication_style,personal_context,injuries_limits,running_notes,qualifier,last_inbound_at&linked_user_id=eq.${clientId}&order=last_inbound_at.desc.nullslast&limit=2`
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
            const qualifierBlock = buildQualifierRelationshipBlock(t.qualifier).trim();
            if (qualifierBlock) memoryParts.push(`${channelLabel} relationship checklist:\n${qualifierBlock}`);
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
            const now = new Date();
            historyText = ordered.map((m, i) => {
                const speaker = m.direction === 'in' ? 'Client' : 'Shannon';
                const cleaned = String(m.text || '')
                    .replace(/\[PHOTO:https?:\/\/[^\s\]]+\]/gi, '[photo]')
                    .replace(/\[AUDIO:https?:\/\/[^\s\]]+\]/gi, '[voice note]')
                    .trim();
                return formatTimedConversationLine({
                    speaker,
                    text: cleaned,
                    createdAt: m.created_at,
                    previousCreatedAt: ordered[i - 1]?.created_at,
                    now,
                });
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
        const profile = await loadClientProfileFacts(senderId);
        snapshot.name = profile.name || profile.email?.split('@')[0] || 'Client';
        snapshot.sex = profile.sex;
        snapshot.personalDetails = profile.personalDetails || {};
    } catch (e) { /* non-critical */ }

    try {
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const [workouts, pbs, mood] = await Promise.all([
            loadRecentWorkouts(senderId, oneWeekAgo, 3),
            supabaseQuery(`personal_bests?select=exercise_name,value,achieved_at&user_id=eq.${senderId}&achieved_at=gte.${oneWeekAgo}&order=achieved_at.desc&limit=3`).catch(() => []),
            supabaseQuery(`mood_logs?select=mood_score,energy_score,created_at&user_id=eq.${senderId}&created_at=gte.${new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()}&order=created_at.desc&limit=3`).catch(() => []),
        ]);
        if (workouts.length) {
            snapshot.recentWorkoutEvidence = formatRecentWorkoutEvidence(workouts, 3);
            snapshot.recent.push(`Recent workouts:\n${snapshot.recentWorkoutEvidence || workouts.map(w => w.templateName).join(', ')}`);
        }
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

function formatInboundBatchForDisplay({ recentInboundMessages = [], currentMessage = '', currentCreatedAt = null, maxChars = 2000 }) {
    const rows = [];
    (Array.isArray(recentInboundMessages) ? recentInboundMessages : []).forEach(m => {
        const rawText = String(m?.text || '').trim();
        const text = replaceVideoMarkers(replacePhotoMarkers(rawText, () => '📷 photo'), () => '🎥 video');
        if (!text) return;
        rows.push({
            text: truncate(text, maxChars),
            media: buildDisplayMedia(rawText),
            created_at: m?.created_at || null,
            is_current: false,
        });
    });
    const latestRawText = String(currentMessage || '').trim();
    const latestText = replaceVideoMarkers(replacePhotoMarkers(latestRawText, () => '📷 photo'), () => '🎥 video');
    if (latestText) {
        rows.push({
            text: truncate(latestText, maxChars),
            media: buildDisplayMedia(latestRawText),
            created_at: currentCreatedAt || null,
            is_current: true,
        });
    }
    return rows;
}

async function generateDraftReply({ clientName, clientSnapshot, conversationHistory, currentMessage, recentInboundMessages = [], memoryBlock, onboardingPhase, igContext, priorScheduledDrafts }) {
    // Scope edits to THIS client first — the AI picks up "this is how Shannon
    // actually talks to this person" once he's edited a few drafts for them.
    // Pads with up to 3 general edits when the person-specific corpus is
    // sparse, capped low so unrelated cross-client edits don't drown out
    // the per-person voice signal.
    const editExamples = await loadEditExamples({
        clientId: clientSnapshot.id,
    });
    const coachBioBlock = buildCoachBioBlock();
    const appXpGuideBlock = buildAppXpGuideBlock();
    const nameUsePolicyBlock = buildNameUsePolicyBlock();
    const relationshipDiscoveryBlock = buildRelationshipDiscoveryBlock();

    // Inline any photos attached to the CURRENT client message so Gemini can
    // actually see them. Prior photos in history stay marked [photo] — no need
    // to refetch/inline them (latency + token cost) since the reply is about
    // the new message.
    const { imageParts, rewrittenMessage } = await buildMessageImageParts(currentMessage);
    const currentMessageText = rewrittenMessage;
    const promptNow = new Date();
    const promptNowText = formatCoachLocalTimestamp(promptNow);
    const unansweredBatch = [
        ...(Array.isArray(recentInboundMessages) ? recentInboundMessages : []).map(m => ({
            text: replacePhotoMarkers(String(m?.text || '').trim(), () => '[photo]'),
            isCurrent: false,
        })),
        { text: currentMessageText, isCurrent: true },
    ].filter(m => m.text);
    const unansweredBatchBlock = unansweredBatch.length <= 1 ? '' : `

UNANSWERED INBOUND BATCH FROM ${clientName} (oldest -> newest):
${unansweredBatch.map((m, i) => `${i + 1}. ${m.text}${m.isCurrent ? ' (latest)' : ''}`).join('\n')}

Reply to the whole batch, not only the newest item. If the newest item is a photo, treat it as extra context for the earlier words unless the earlier words clearly do not relate.`;

    const historyText = conversationHistory.length > 0
        ? conversationHistory.map((m, i) => {
            const speaker = m.sender_id === clientSnapshot.id ? clientName : 'Shannon';
            const cleaned = replacePhotoMarkers(m.message, () => '[photo]');
            return formatTimedConversationLine({
                speaker,
                text: cleaned,
                createdAt: m.created_at,
                previousCreatedAt: conversationHistory[i - 1]?.created_at,
                now: promptNow,
            });
        }).join('\n')
        : '(no prior conversation)';

    const snapshotText = clientSnapshot.recent.length > 0
        ? clientSnapshot.recent.join('\n')
        : '(no recent activity snapshot)';
    const workoutEvidenceText = clientSnapshot.recentWorkoutEvidence || '';
    const clientProfileBlock = buildClientProfileBlock({ clientName, profile: clientSnapshot });

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
- Stay genuinely curious — ask open follow-up questions that build understanding (their why, their wall, their wins so far, and the real-life context around them). One question per reply, not a quiz.
- Prefer questions that teach Shannon something useful about their life: work rhythm, household/family, stress, support, food setup, training history, what they love, what ticks them off, what makes consistency hard, or what makes healthy choices easier.
- Anchor on what you actually know about them (memory + onboarding facts below) — proves you're paying attention.
- Match their energy and mirror their interests when they share something (skateboarding, hiking, whatever).
- Never assume facts that aren't in the data — Shannon got burned assuming a client was vegan when she wasn't.
- ${challengeLine}

ONBOARDING FACTS:
${facts}`;
    }

    // Prior-draft block: when Shannon had a Send-later draft queued for this
    // client and a NEW message arrived before it fired, we cancelled the
    // scheduled send (in the main handler) and pass the canceled draft text
    // here so the model knows what Shannon was about to say. The model can
    // either fold that intent into the new reply (if the new message is a
    // follow-up to the same topic) or pivot away (if the topic changed).
    const priorScheduled = Array.isArray(priorScheduledDrafts) ? priorScheduledDrafts.filter(Boolean) : [];
    const priorScheduledBlock = priorScheduled.length === 0 ? '' : `

PREVIOUSLY DRAFTED (NOT YET SENT — Shannon had this queued to send later, but ${clientName} messaged again before it fired so we canceled it):
${priorScheduled.map((t, i) => `[draft ${i + 1}] ${t}`).join('\n')}

Treat the canceled draft as Shannon's recent intent. If ${clientName}'s new message is a continuation of the same topic, you can fold its key point into your reply. If they've moved on, drop it and address what they actually said now. Either way the new reply must work as a single fresh message — don't reference "I was going to say" or apologise for the delay.`;

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
${nameUsePolicyBlock}
${relationshipDiscoveryBlock}

CONVERSATION RESPONSIBILITY:
- Treat the new message as an answer to Shannon's latest question when that is obvious. Continue that thread before changing topic.
- If they admit they have been "slacking", off track, missed training, or had a rough week, don't reply with filler like "ahh yeah man" on its own, don't ask "wby"/"what about you", and don't repeat the same broad question. Validate lightly, then ask one concrete follow-up about what got in the way or what small session they can lock in next.
- The coaching/funnel flow should feel invisible. It can take hours or months. One smooth human question beats a forced pitch.
- Default to leaving them with one thoughtful question when their message gives you an opening. Make it specific to their words and life, not generic "how are you going?". Skip the question only when a direct answer, link, clean next step, or short celebration is clearly better.
- Keep the spotlight on them unless they directly ask about Shannon.

GROUNDING RULES:
- Specific claims must be traceable to the data below: their message, conversation history, client memory, cross-channel notes, or exact app workout logs.
- Only mention exact weights, reps, exercise names, dates, injuries, goals, events, or personal facts when they appear in those sources.
- If the app logs do not show a weight or exercise, keep the workout reference general. Do not invent numbers like "5kg weights".
- Equipment access is not workout performance. If memory says they own equipment but logs/messages do not say they used it, phrase it as available equipment, not something they did.
- Timeline matters: if the history shows an event already happened, do not ask when it is. Ask about how it went or respond to what they sent.

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
${appXpGuideBlock}
${coachBioBlock}
${unansweredBatchBlock}

CLIENT: ${clientName}${clientProfileBlock}${memoryBlock || ''}${igBlock}${priorScheduledBlock}${onboardingBlock}

RECENT ACTIVITY:
${snapshotText}

EXACT APP WORKOUT LOGS (only use these details if relevant):
${workoutEvidenceText || '(no recent exact workout set logs available)'}

CURRENT TIME (Australia/Brisbane): ${promptNowText}. Use the message timestamps and gaps to judge pace, delays, stale threads, and whether Shannon should acknowledge time passing. Do not mention exact timestamps unless it would feel natural.

CONVERSATION HISTORY:
${historyText}

THEIR NEW MESSAGE (just arrived around ${promptNowText}):
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

async function sendDraftReadyPush({ adminId, clientId, clientName, clientMessage, draftText, alertId, isSimpleReply, isFormCheck, recentInboundMessages, lifecycle }) {
    try {
        const hasDraft = !!draftText && !isSimpleReply;
        const dotPrefix = lifecycle?.dot ? `${lifecycle.dot} ` : '💬 ';
        const title = isFormCheck
            ? `${dotPrefix}${clientName} sent a form check`
            : hasDraft
            ? `${dotPrefix}${clientName} — draft ready`
            : `${dotPrefix}${clientName} just messaged`;
        // Lead with the DRAFT — Android's collapsed notification view only
        // shows one line, and the draft is what Shannon needs to see to
        // decide "send / edit / skip". The client message rides along as
        // a separate FCM data field (clientMessage) so the native service
        // can render both cleanly in MessagingStyle.
        const body = isFormCheck
            ? 'Technique video waiting for review'
            : hasDraft
            ? truncate(draftText, 220)
            : `"${truncate(clientMessage, 180)}"`;

        // Truncate prior inbound texts before stringifying — keeps the FCM
        // payload comfortably under the 4 KB limit even when the client
        // sent five paragraph-length messages in a streak.
        const recentInboundForPush = (recentInboundMessages || []).map(m => ({
            text: truncate(m.text || '', 280),
            created_at: m.created_at || null,
        }));

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
                isFormCheck: !!isFormCheck,
                recentInboundMessages: recentInboundForPush,
                ...lifecycleForFcmData(lifecycle),
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

    // 4. Short-circuit for trivial replies and form-check videos.
    const simple = isSimpleReply(messageText);
    const isFormCheck = /\bform check request\b/i.test(messageText) && /\[video:\s*https?:\/\//i.test(messageText);

    let draftText = '';
    let draftModel = isFormCheck ? 'skipped-form-check' : 'skipped-simple-reply';
    let draftEvidence = null;
    let memoryBlockForReasoning = '';
    let onboardingPhaseForAlert = null;

    // Cancel any prior Send-later drafts for this (coach, client) — see
    // helper docstring for rationale. Returned texts are folded into the
    // fresh draft prompt so the model has Shannon's prior intent in view.
    // Always run this — even for simple replies — so a queued draft never
    // fires after the client has already moved on.
    let priorScheduledDrafts = [];
    try {
        priorScheduledDrafts = await cancelPriorScheduledForClient({
            coachId: receiverId,
            clientId: senderId,
        });
    } catch (e) {
        console.warn('[instant-draft] cancelPriorScheduledForClient failed:', e.message);
    }

    // Load history once — used both by the draft generator (when !simple) AND
    // by the recent-inbound streak so Shannon can see every prior unanswered
    // message that the draft was generated against. The streak runs even on
    // simple-reply alerts (no draft) so a "👍" after three rapid messages
    // still surfaces the earlier ones in the alert card.
    let conversationHistory = [];
    try {
        conversationHistory = await loadConversationContext(senderId, receiverId, messageText);
    } catch (e) {
        console.warn('[instant-draft] loadConversationContext failed:', e.message);
    }
    const recentInboundMessages = selectRecentInboundSinceLastReply({
        history: conversationHistory,
        clientId: senderId,
    });
    const inboundMessageBatch = formatInboundBatchForDisplay({
        recentInboundMessages,
        currentMessage: messageText,
        currentCreatedAt: new Date().toISOString(),
    });

    // Lifecycle stage drives the coloured dot Shannon scans on the push +
    // alert card. For in-app DMs the sender IS the user, so we resolve
    // straight off senderId — no ig_threads lead_stage in this path.
    const lifecycle = await resolveLifecycleStage({ userId: senderId });

    if (!simple && !isFormCheck) {
        try {
            const [memory, onboardingPhase, igContext] = await Promise.all([
                loadClientMemory(receiverId, senderId),
                loadOnboardingPhase(receiverId, senderId),
                loadLinkedIgContext(senderId),
            ]);
            onboardingPhaseForAlert = onboardingPhase;
            const memoryBlock = buildMemoryBlock(memory);
            memoryBlockForReasoning = memoryBlock;
            draftEvidence = {
                source_mode: 'saved_at_draft',
                current_message: truncate(messageText, 400),
                prior_unanswered: recentInboundMessages.map(m => ({
                    text: truncate(m.text, 280),
                    created_at: m.created_at,
                })),
                recent_activity: clientSnapshot.recent.length ? truncate(clientSnapshot.recent.join('\n'), 1600) : '',
                recent_workouts: truncate(clientSnapshot.recentWorkoutEvidence || '', 2000),
                memory_context: truncate(memoryBlock.replace(/\n{3,}/g, '\n\n').trim(), 2000),
                cross_channel_context: igContext && (igContext.memoryText || igContext.historyText)
                    ? truncate([
                        igContext.memoryText ? `${igContext.channelLabel || 'IG'} notes:\n${igContext.memoryText}` : '',
                        igContext.historyText ? `${igContext.channelLabel || 'IG'} messages:\n${igContext.historyText}` : '',
                    ].filter(Boolean).join('\n\n'), 2000)
                    : '',
            };
            const draft = await generateDraftReply({
                clientName,
                clientSnapshot,
                conversationHistory,
                currentMessage: messageText,
                recentInboundMessages,
                memoryBlock,
                onboardingPhase,
                igContext,
                priorScheduledDrafts,
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
        priority: isFormCheck ? 'high' : (simple ? 'medium' : 'high'),
        title: isFormCheck ? `${clientName} sent a form check` : `${clientName} just messaged you`,
        description: isFormCheck ? 'Technique video waiting for Shannon review' : `"${truncate(messageText, 200)}"`,
        suggested_message: draftText || null,
        status: 'pending',
        data: {
            nudge_id: nudgeId,
            message_preview: truncate(messageText, 400),
            hours_waiting: 0,
            draft_model: draftModel,
            is_form_check: isFormCheck,
            is_simple_reply: simple,
            drafted_at: new Date().toISOString(),
            // Trailing streak of inbound messages BEFORE this current one,
            // since Shannon's last reply. Empty when this is the first new
            // message after he replied. Surfaced in the notification (extra
            // MessagingStyle bubbles) + admin dashboard so the coach can
            // verify the draft addresses every unanswered message, not just
            // the latest. Truncated to keep the JSON column lean — the full
            // text is still in nudges.
            recent_inbound_messages: recentInboundMessages.map(m => ({
                text: truncate(m.text, 280),
                created_at: m.created_at,
            })),
            inbound_message_batch: inboundMessageBatch,
            onboarding_phase: onboardingPhaseForAlert,
            draft_evidence: draftEvidence,
            lifecycle,
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
    if (!simple && !isFormCheck && draftText && alertId) {
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
            isFormCheck,
            recentInboundMessages,
            lifecycle,
        });
    }

    // Reasoning runs in parallel with the push so Shannon's phone buzzes
    // immediately, then ~1s later Control Center has a "Why this draft"
    // line waiting for him. Skipped on simple-reply alerts (no draft to
    // explain).
    if (!simple && !isFormCheck && draftText && alertId) {
        const priorCount = Array.isArray(recentInboundMessages) ? recentInboundMessages.length : 0;
        const priorText = priorCount > 0
            ? `\nPrior unanswered messages from ${clientName}:\n${recentInboundMessages.map(m => `- "${truncate(m.text, 200)}"`).join('\n')}`
            : '';
        const workoutText = clientSnapshot.recentWorkoutEvidence
            ? `\nExact recent workout logs:\n${truncate(clientSnapshot.recentWorkoutEvidence, 1200)}`
            : '';
        const activityText = clientSnapshot.recent.length
            ? `\nRecent activity snapshot:\n${truncate(clientSnapshot.recent.join('\n'), 1200)}`
            : '';
        const memoryText = memoryBlockForReasoning
            ? `\nMemory/context used:\n${truncate(memoryBlockForReasoning, 1200)}`
            : '';
        const contextBlocks = `Just-arrived message from ${clientName}: "${truncate(messageText, 400)}"${priorText}${activityText}${workoutText}${memoryText}`;
        fireDraftReasoning({
            alertId,
            draftText,
            alertType: 'incoming_dm',
            contextBlocks,
            clientName,
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
