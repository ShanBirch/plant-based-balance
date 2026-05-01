/**
 * ig-instant-draft — produces an AI draft reply for an inbound Instagram DM
 * captured by the manychat-inbound webhook.
 *
 * Mirrors instant-coach-draft.js for the in-app DM path with channel-specific
 * differences:
 *
 *   - Conversation history comes from ig_messages, not nudges.
 *   - Client identity is by ManyChat subscriber_id, not users.id. The IG
 *     thread might have a linked_user_id (lead converted to app user) — when
 *     present we also load client_memory so the voice stays consistent.
 *   - Coach_alert row is alert_type='ig_incoming_dm' and stamped with
 *     data.channel='instagram' so send-coach-reply routes the outbound
 *     through ManyChat instead of the in-app nudges path.
 *   - Auto-send is intentionally NOT wired in this v1 — IG always goes
 *     through the approve-gate. We'll add an IG-aware auto-send later
 *     (needs a parallel ManyChat send call, not the nudges insert that the
 *     in-app maybeAutoSendDraft uses).
 *
 * Trigger: POST from manychat-inbound after it has persisted the inbound
 * message and upserted the thread.
 */

const {
    supabaseQuery,
    insertCoachAlert,
    loadClientMemory,
    cancelPriorScheduledForIgThread,
    selectRecentInboundSinceLastReplyIg,
    resolveLifecycleStage,
    lifecycleForFcmData,
    fireDraftReasoning,
    buildMemoryBlock,
    buildCoachBioBlock,
    loadEditExamples,
    callVertexAIModel,
    callGeminiFallback,
    callVertexGeminiMultimodal,
    stripLeadingGreeting,
    truncate,
    buildMessageImageParts,
    replacePhotoMarkers,
} = require('./_lib/client-context');

const {
    isQualifierEligible,
    evaluateQualifier,
    persistQualifier,
    formatPushTitle,
    formatPushBody,
    summarizeForFcmData,
} = require('./_lib/qualifier-engine');

const SITE_URL = process.env.URL || 'https://plantbased-balance.org';
const HISTORY_LIMIT = 12;
const MAX_CHUNKS = 3;
// When a lead fires multiple messages back-to-back, coalesce them onto the
// existing pending alert instead of stacking pushes. The draft is
// regenerated against the full message history (which now includes the
// follow-up), so the reply addresses everything in one shot.
const COALESCE_WINDOW_MIN = 2;

/**
 * Funnel context for leads coming through Shannon's Meta (IG/FB) ads. The ad
 * opens a Click-to-Messenger / Click-to-IG conversation with three quick-reply
 * prompts they can tap, OR they may DM organically asking about the challenge.
 * Either way, the AI needs to recognise challenge intent and mirror Shannon's
 * actual qualifier flow.
 *
 * Update this block when the ad's quick-replies or offering structure changes.
 */
const META_AD_FUNNEL_CONTEXT = `
META AD FUNNEL CONTEXT:
This lead very likely came from Shannon's Meta ad for his 30-day plant-based wellness challenge. The ad opens the DM with three quick-reply buttons they may have tapped — or they may be asking about it organically. Either way, the words below trigger challenge-inquiry mode:
  1. "What's actually included?"
  2. "Do I need to already be Plant Based?"
  3. "I'm In - save me a spot!"
Also treat as challenge inquiry: any mention of "the challenge", "your program", "your thing", "saw your ad", "wanna join", "interested in".

THE OFFERING (for context — never list as a brochure; speak like a friend):
- 30 days, plant-based wellness challenge
- Plant-based meal guide + simple recipes
- Workouts that scale beginner -> advanced (gym OR home, no equipment-gating)
- 3x/week check-ins + 1:1 coaching support direct from Shannon
- Private group of others running it together for accountability

RESPONSE PATTERNS (mimic Shannon's actual voice for each prompt):
- "What's actually included?" -> confirm the offering casually, then ask one personalising follow-up about their current situation. Don't dump the bullet list.
- "Do I need to already be Plant Based?" -> warm reassurance ("not at all, lots of my crew start curious"), then ask their current eating situation, ever cooked plant-based before.
- "I'm In - save me a spot!" -> lock them in fast, ask the qualifier set in this format: Name + Age, Main goal, Anything that's tripped them up before with their fitness. Sign off "ill get back to you asap".

When the conversation has clearly moved past intake (qualifier answers received, or they're chatting about something else), drop this context and just chat naturally.`;

/**
 * Parse the model's JSON-formatted draft into 1-3 message chunks.
 *
 * The IG prompt instructs the model to output `{"messages": [...]}`. When the
 * model complies we split that into chunks for multi-message send (lands as
 * separate IG bubbles, feels less like AI than one wall of text). When it
 * doesn't (occasional plain-text fallback from the fine-tuned model) we still
 * try to recover natural breaks before defaulting to a single chunk.
 */
function parseDraftChunks(rawText) {
    if (!rawText) return { chunks: [], joined: '' };
    const trimmed = String(rawText).trim();
    if (!trimmed) return { chunks: [], joined: '' };

    // Strip optional ```json fences before JSON.parse — Gemini hedges
    // with code fences sometimes despite "JSON only" instructions.
    const jsonCandidate = trimmed
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
    try {
        const parsed = JSON.parse(jsonCandidate);
        if (parsed && Array.isArray(parsed.messages)) {
            const chunks = parsed.messages
                .map(m => typeof m === 'string' ? m.trim() : '')
                .filter(Boolean)
                .slice(0, MAX_CHUNKS);
            if (chunks.length > 0) return { chunks, joined: chunks.join('\n') };
        }
    } catch { /* fall through to plain-text splitting */ }

    // Plain-text fallback. Honour explicit paragraph or line breaks the model
    // may have used as natural pauses; otherwise treat as one chunk.
    const paragraphs = trimmed.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
    if (paragraphs.length >= 2) {
        const chunks = paragraphs.slice(0, MAX_CHUNKS);
        return { chunks, joined: chunks.join('\n') };
    }
    const lines = trimmed.split(/\n+/).map(s => s.trim()).filter(Boolean);
    if (lines.length >= 2 && lines.length <= 4) {
        const chunks = lines.slice(0, MAX_CHUNKS);
        return { chunks, joined: chunks.join('\n') };
    }
    return { chunks: [trimmed], joined: trimmed };
}

async function loadThread(threadId) {
    const rows = await supabaseQuery(
        `ig_threads?select=id,subscriber_id,coach_id,channel,ig_username,profile_name,lead_stage,linked_user_id,custom_data,goals,communication_style,running_notes,injuries_limits,personal_context,coach_instructions,qualifier&id=eq.${threadId}&limit=1`
    );
    return rows[0] || null;
}

async function loadIgHistory(threadId, currentText) {
    const rows = await supabaseQuery(
        `ig_messages?select=direction,text,created_at&thread_id=eq.${threadId}&order=created_at.desc&limit=${HISTORY_LIMIT}`
    );
    // Drop the just-inserted current message and reverse to chronological order.
    const prior = rows
        .filter(r => !(r.direction === 'in' && r.text === currentText))
        .reverse();
    return prior;
}

/**
 * Cross-channel: when an IG/FB lead has been linked to an app account,
 * pull recent in-app DMs between coach and client so the IG draft sees
 * the parallel conversation (which might be where the actual onboarding
 * happened, e.g. Shannon DM'd in-app "did you find the challenge yet?",
 * client replies on IG "yes very keen!").
 *
 * Without this, the IG producer's history only has IG messages — and
 * Shannon's IG-side outbounds are usually sent natively (bypassing
 * ManyChat) so the IG-side history misses BOTH halves of recent context.
 *
 * Returns chronologically-ordered messages: { sender_id, message,
 * created_at }, oldest -> newest. Empty array on no link / no rows.
 */
async function loadLinkedNudgesContext(coachId, linkedUserId) {
    if (!coachId || !linkedUserId) return [];
    try {
        const rows = await supabaseQuery(
            `nudges?select=sender_id,message,created_at&or=(and(sender_id.eq.${coachId},receiver_id.eq.${linkedUserId}),and(sender_id.eq.${linkedUserId},receiver_id.eq.${coachId}))&order=created_at.desc&limit=${HISTORY_LIMIT}`
        );
        return rows.reverse();
    } catch (e) {
        console.warn('[ig-draft] loadLinkedNudgesContext failed:', e.message);
        return [];
    }
}

/**
 * Returns the lead_stage we should ACTUALLY use for prompt routing,
 * promoting stale 'new'/'qualifying'/'invited' to 'in_app' when the
 * thread already has a linked_user_id (i.e. they're an app user — the
 * funnel was already cleared no matter what the column says).
 *
 * Why: ig_threads.lead_stage isn't always updated in lockstep with
 * linked_user_id. When a lead signs up to the app the linked_user_id
 * gets stamped, but lead_stage may still say 'new'. That's how the
 * 2026-04-29 Taylah incident produced an "ask Name + Age + main goal"
 * onboarding-pitch reply for a fully-onboarded client. linked_user_id
 * is the truth — if it's set, treat the thread as in_app regardless.
 */
function effectiveLeadStageForPrompt(thread) {
    const raw = thread?.lead_stage || 'new';
    if (thread?.linked_user_id && (raw === 'new' || raw === 'qualifying' || raw === 'invited')) {
        return 'in_app';
    }
    return raw;
}

function buildLeadBlock({ profileName, igUsername, customData, leadStage }) {
    const lines = [];
    if (profileName) lines.push(`Name: ${profileName}`);
    if (igUsername) lines.push(`IG handle: ${igUsername}`);
    if (leadStage && leadStage !== 'new') lines.push(`Funnel stage: ${leadStage}`);
    if (customData && typeof customData === 'object') {
        for (const [key, val] of Object.entries(customData)) {
            if (val == null || val === '') continue;
            const rendered = typeof val === 'string' ? val : JSON.stringify(val);
            lines.push(`${key}: ${rendered}`);
        }
    }
    if (lines.length === 0) return '';
    return `\n\nWHAT WE KNOW ABOUT THIS LEAD:\n${lines.join('\n')}`;
}

function pitchHintForStage(stage) {
    switch (stage) {
        case 'qualifying':
            return "Conversation is warming up. If there's a natural opening (they ask about your training, vegan stuff, weight loss, energy), you can mention you run a 7-day vegan challenge in your app. Keep it casual, no link drops, no urgency.";
        case 'invited':
            return "You've already mentioned the challenge or app. DON'T re-pitch. Answer their questions plainly. If they're close to signing up, help them across the line.";
        case 'in_app':
            return "They're already in the app. Coach them like a normal client. The IG thread is just a parallel channel — same voice, same memory.";
        case 'churned':
            return "They went cold or opted out earlier. Respect the no. Be friendly, no pitch, no follow-up bait.";
        case 'new':
        default:
            return "EARLY in this DM thread. Just chat. Ask one genuine follow-up question that builds on what they said. DO NOT pitch the app, the challenge, or anything else yet — they're a stranger.";
    }
}

async function generateDraft({ leadName, leadBlock, memoryBlock, history, currentMessage, leadStage, channel, igThreadId, linkedUserId, priorScheduledDrafts, linkedNudges }) {
    // Scope edits to THIS conversation first. Pulls per-IG-thread edits
    // (and per-app-user when a converted lead has been linked) so the AI
    // picks up the specific voice Shannon uses with this person. General
    // edits fill remaining slots when person-specific is sparse.
    const editExamples = await loadEditExamples({
        igThreadId,
        clientId: linkedUserId,
    });
    const coachBio = buildCoachBioBlock();

    // Inline any photos attached to the CURRENT inbound so Gemini Vision can
    // actually see them. Past messages with photos stay as `[photo]`
    // placeholders in the history -- inlining historical photos every time
    // would balloon the prompt with no payoff (the new message is what we're
    // replying to).
    const { imageParts, rewrittenMessage } = await buildMessageImageParts(currentMessage);
    // Detect when the message had photo URLs but the fetch failed (Meta CDN
    // rejected us, signed URL expired, image too large, etc). In that case
    // imageParts is empty even though the original message had `[PHOTO:url]`
    // markers — the AI should still know a photo came in so it can reply
    // naturally ("can you re-send that, didn't open for me") instead of
    // producing a confused or empty draft.
    const hadPhotoUrls = /\[PHOTO:https?:\/\//i.test(String(currentMessage || ''));
    const photoFetchFailed = hadPhotoUrls && imageParts.length === 0;
    const currentMessageText = photoFetchFailed
        ? rewrittenMessage + ' (NOTE: the photo did not open on my end — react like Shannon would: ask casually if they can re-send, or check if it loaded for them. Don\'t pretend you saw it.)'
        : rewrittenMessage;

    const historyText = history.length === 0
        ? '(no prior messages — this is the first DM)'
        : history.map(m => {
            const speaker = m.direction === 'in' ? leadName : 'Shannon';
            const cleaned = replacePhotoMarkers(m.text, () => '[photo]');
            return `${speaker}: ${cleaned}`;
        }).join('\n');

    const pitchHint = pitchHintForStage(leadStage);
    const channelLabel = channel === 'messenger' ? 'Facebook Messenger' : 'Instagram';
    const channelShort = channel === 'messenger' ? 'Messenger' : 'IG';

    // Once a lead is in_app (or paying / churned), the Meta-ad-funnel
    // intake script is actively HARMFUL: it tells the AI to ask Name +
    // Age + main goal + tripped-you-up-before whenever the message
    // matches "I'm In!" intent. For Taylah on 2026-04-29 this produced
    // a fully-onboarded client being asked to onboard from scratch.
    // Linked-user threads are also gated even if lead_stage is somehow
    // still 'new' — linked_user_id is the truth, the column lags.
    const isOnboardedOrPostFunnel = ['in_app', 'paying', 'churned'].includes(leadStage)
        || !!linkedUserId;
    const funnelContext = isOnboardedOrPostFunnel ? '' : META_AD_FUNNEL_CONTEXT;

    // Cross-channel: when this lead is linked to an app user, fold in
    // the in-app DM transcript so the AI sees BOTH sides of recent
    // conversation (Shannon's IG-side outbounds are usually sent
    // natively and don't land in ig_messages). Without this the prompt
    // sees only the inbound IG message with no idea what the client is
    // replying to.
    const linkedHistory = Array.isArray(linkedNudges) ? linkedNudges : [];
    const crossChannelBlock = linkedHistory.length === 0 ? '' : `

CROSS-CHANNEL HISTORY (in-app DMs, older → newer — the parallel conversation Shannon has had with this client inside the Balance app):
${linkedHistory.map(m => {
        const speaker = m.sender_id === linkedUserId ? leadName : 'Shannon';
        const cleaned = replacePhotoMarkers(m.message || '', () => '[photo]');
        return `${speaker}: ${cleaned}`;
    }).join('\n')}

Treat this as the SAME relationship as the ${channelLabel} thread below. Don't ask things they've already answered in-app. If Shannon sent an in-app message that the new ${channelShort} reply is clearly answering, use that as the question being answered.`;

    // Prior-draft block: when Shannon had a Send-later draft queued and the
    // lead messaged again before it fired, the main handler canceled the
    // scheduled send and passes the canceled text here. Same UX intent as
    // the in-app instant-coach-draft path — the new draft sees Shannon's
    // prior intent so it can fold or pivot.
    const priorScheduled = Array.isArray(priorScheduledDrafts) ? priorScheduledDrafts.filter(Boolean) : [];
    const priorScheduledBlock = priorScheduled.length === 0 ? '' : `

PREVIOUSLY DRAFTED (NOT YET SENT — Shannon had this queued to send later, but ${leadName} messaged again before it fired so we canceled it):
${priorScheduled.map((t, i) => `[draft ${i + 1}] ${t}`).join('\n')}

Treat the canceled draft as Shannon's recent intent. If ${leadName}'s new message continues the same topic, fold the key point into your reply. If they've moved on, drop it. Either way the new chunks must work as fresh messages — never reference "I was about to say" or apologise for the delay.`;

    const prompt = `Draft a SHORT ${channelLabel} DM reply in Shannon's voice, broken into 1-3 messages so it lands like real texting (separate bubbles, not one wall of text).

CRITICAL — DO NOT GREET: Never start with "hey [name]", "hi", "yo". Jump straight into content.

This is ${channelShort}. Tight chunks: each message 1-2 sentences max, lowercase-friendly, Australian casual. No emojis unless they used one first. No links unless absolutely necessary. Sound like a person texting back, not a brand.

NEVER reveal AI, automation, "trained on Shannon's voice", "24/7", or anything that breaks the personal-coach illusion. Shannon is replying personally.

NO em-dashes. Use periods, colons, or commas instead.

${pitchHint}
${coachBio}
${funnelContext}

LEAD: ${leadName}${leadBlock}${memoryBlock || ''}${priorScheduledBlock}${crossChannelBlock}

CONVERSATION HISTORY (${channelLabel} DM):
${historyText}

THEIR NEW MESSAGE:
${currentMessageText}${imageParts.length ? ` (${imageParts.length} photo${imageParts.length === 1 ? '' : 's'} attached below — look at ${imageParts.length === 1 ? 'it' : 'them'} and let what you see shape your reply. If it's food, react to what you see. If it's a body/progress shot, give specific feedback. If it's something casual or funny, react naturally — don't pretend you can't see it.)` : ''}${editExamples}

OUTPUT FORMAT — JSON only, nothing else:
{"messages": ["chunk 1", "chunk 2 (if needed)", "chunk 3 (if needed)"]}

Rules:
- 1 to 3 chunks. One-liner is fine — just one item in the array.
- Split where Shannon would naturally pause: new thought, change of topic, follow-up question.
- Don't artificially split a single sentence. Each chunk should stand on its own.
- No quotes, labels, code-fence, or commentary outside the JSON.`;

    const visionParts = [{ text: prompt }, ...imageParts];
    const visionContents = [{ role: 'user', parts: visionParts }];
    // Text-only contents — used when vision fails OR when there's no image.
    // We rebuild the prompt with the photo-failed hint so the AI knows to
    // ask casually about the photo without pretending it saw it.
    const textOnlyPrompt = imageParts.length > 0
        ? prompt.replace(
            'THEIR NEW MESSAGE:\n' + currentMessageText,
            'THEIR NEW MESSAGE:\n' + currentMessageText + ' (NOTE: a photo was attached but the image API failed -- react like Shannon would: casually ask if they can re-send it, or check if it loaded for them. Don\'t pretend you saw it.)'
        )
        : prompt;
    const textContents = [{ role: 'user', parts: [{ text: textOnlyPrompt }] }];
    const generationConfig = { maxOutputTokens: 2048, temperature: 0.85 };

    let rawText = '';
    let model = 'none';
    let lastError = null;

    if (imageParts.length > 0) {
        // Vision path: try the public Gemini API first (works fine on a paid
        // tier key, which is what Shannon has now), and fall back to Vertex
        // AI's hosted Gemini if the public API has a hiccup. v7 is text-only
        // fine-tuned so we never send image bytes there -- it's out-of-
        // distribution.
        try {
            rawText = await callGeminiFallback(visionContents, generationConfig);
            model = 'gemini-vision';
        } catch (err) {
            console.warn('[ig-draft] public Gemini vision failed, trying Vertex Gemini:', err.message);
            lastError = `public-vision: ${err.message.slice(0, 200)}`;
            try {
                rawText = await callVertexGeminiMultimodal(visionContents, generationConfig);
                model = 'vertex-gemini-vision-fallback';
                lastError = null; // recovered
            } catch (err2) {
                console.warn('[ig-draft] Vertex Gemini vision also failed:', err2.message);
                lastError = `${lastError} | vertex-vision: ${err2.message.slice(0, 200)}`;
            }
        }
    }

    if (!rawText) {
        // No image OR vision failed -> text-only path. Vertex v7 first
        // (Shannon's voice), Gemini fallback if that errors.
        try {
            rawText = await callVertexAIModel(textContents, generationConfig);
            model = lastError ? 'vertex-v7+vision-failed' : 'vertex-v7';
        } catch (err) {
            console.warn(`[ig-draft] Vertex failed, falling back to Gemini: ${err.message}`);
            lastError = `${lastError ? lastError + ' | ' : ''}vertex: ${err.message.slice(0, 200)}`;
            try {
                rawText = await callGeminiFallback(textContents, generationConfig);
                model = lastError ? 'gemini-fallback+vision-failed' : 'gemini-2.0-fallback';
            } catch (err2) {
                console.error('[ig-draft] Gemini fallback failed:', err2.message);
                lastError = `${lastError ? lastError + ' | ' : ''}gemini: ${err2.message.slice(0, 200)}`;
                return { chunks: [], joined: '', model: 'none', error: lastError, imageCount: imageParts.length };
            }
        }
    }

    const parsed = parseDraftChunks(rawText);
    // Strip robotic openers from the FIRST chunk only — subsequent chunks are
    // continuations and shouldn't have lower-cased capitals or dropped names.
    const cleanedChunks = parsed.chunks.map((c, i) => i === 0 ? stripLeadingGreeting(c) : c).filter(Boolean);
    return {
        chunks: cleanedChunks,
        joined: cleanedChunks.join('\n'),
        model,
        error: lastError,
        imageCount: imageParts.length,
        urlCount: hadPhotoUrls ? (currentMessage.match(/\[PHOTO:/gi) || []).length : 0,
    };
}

async function sendDraftReadyPush({ adminId, alertId, leadName, leadMessage, draftText, clientId, channel, recentInboundMessages, qualifier, qualifierEligible, lifecycle }) {
    if (!adminId) {
        console.warn('[ig-draft] skipping push — no admin coach_id on thread');
        return;
    }
    if (!clientId) {
        // The Android CoachDraftMessagingService rejects pushes with empty
        // clientId (it uses it as the MessagingStyle Person key). For cold
        // ManyChat leads with no linked_user_id we fall back to the
        // subscriber_id — stable per conversation, satisfies the contract.
        console.warn('[ig-draft] no clientId for push — skipping');
        return;
    }
    try {
        // Title is just the lead name now — channel info goes in the
        // subText, which Android renders in the small top-bar slot. Drops
        // the em-dash that used to read as AI-generated, and frees the
        // bold title line for the thing Shannon actually scans for: who
        // messaged him.
        const channelLabel = channel === 'messenger' ? 'Balance FB' : 'Balance IG';
        // Open-button deep link: launches the source app (Instagram or
        // Messenger) directly to the inbox so Shannon can find the
        // conversation natively. Both URLs route to the installed app via
        // intent filter when it's available; the browser is the fallback.
        const openUrl = channel === 'messenger'
            ? 'https://www.messenger.com/'
            : 'https://www.instagram.com/direct/inbox/';
        const hasDraft = !!draftText;
        // Qualifier-aware title/body. When the lead is in the funnel and
        // the AI thinks now's a question moment, body becomes "ask: <q>"
        // so Shannon sees the strategic move from the lock screen — taps
        // through to send the actual draft. When it's just chatting, body
        // is the draft preview as before.
        // Lifecycle dot prefix lets Shannon scan the lock-screen banner and
        // immediately tell whether this is a cold lead, a free-trial member,
        // a paying client, or someone who churned — without expanding the
        // notification or thinking about the lead_stage.
        const titleCore = formatPushTitle({ leadName, qualifier, eligible: qualifierEligible });
        const title = lifecycle?.dot ? `${lifecycle.dot} ${titleCore}` : titleCore;
        const body = hasDraft
            ? formatPushBody({ qualifier, draftText: truncate(draftText, 220), eligible: qualifierEligible })
            : `"${truncate(leadMessage, 180)}"`;
        // Strip the [PHOTO:url] markers and truncate so the FCM payload stays
        // under the 4 KB limit even when several long messages stream in.
        const recentInboundForPush = (recentInboundMessages || []).map(m => ({
            text: truncate(replacePhotoMarkers(m.text || '', () => '📷 photo'), 280),
            created_at: m.created_at || null,
        }));
        // Qualifier sidecar — flat fields the Android coach-draft service
        // and PWA push fallback can render as a strip without parsing the
        // full JSON. Empty strings when the lead isn't qualifier-eligible
        // (in_app, paying, churned).
        const qualifierFields = qualifierEligible ? summarizeForFcmData(qualifier) : {};

        await fetch(`${SITE_URL}/.netlify/functions/send-dm-notification`, {
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
                clientName: leadName,
                clientMessage: leadMessage || '',
                draftText: draftText || '',
                isSimpleReply: false,
                channelLabel,
                openUrl,
                recentInboundMessages: recentInboundForPush,
                ...qualifierFields,
                ...lifecycleForFcmData(lifecycle),
            }),
        }).catch(e => console.warn('[ig-draft] push dispatch failed:', e.message));
    } catch (err) {
        console.warn('[ig-draft] push dispatch errored:', err.message);
    }
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    let payload;
    try { payload = JSON.parse(event.body || '{}'); }
    catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

    const { threadId, messageText, manychatMessageId } = payload;
    if (!threadId || !messageText) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing threadId or messageText' }) };
    }

    const thread = await loadThread(threadId);
    if (!thread) {
        return { statusCode: 404, body: JSON.stringify({ error: 'Thread not found' }) };
    }

    // Idempotency — when ManyChat supplied a message_id, reuse it. Otherwise
    // fall back to thread+timestamp (less robust but better than nothing
    // for ManyChat configs that don't pass message_id through).
    const idempotencyKey = manychatMessageId
        ? `ig_incoming_dm:${manychatMessageId}`
        : `ig_incoming_dm:${threadId}:${Date.now()}`;

    try {
        const existing = await supabaseQuery(
            `coach_alerts?select=id&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`
        );
        if (existing.length > 0) {
            return { statusCode: 200, body: JSON.stringify({ skipped: 'duplicate', alert_id: existing[0].id }) };
        }
    } catch (e) { /* continue — partial unique index is the real guarantee */ }

    // Pick the friendliest display name for the push.
    //   - Prefer profile_name if it actually resolved (i.e. no literal
    //     `{{first_name}}` template strings sneaking through)
    //   - Otherwise prefer the IG/Messenger handle
    //   - Last resort: "Lead"
    const isUnresolvedTemplate = (v) => !v || /\{\{[^}]+\}\}/.test(String(v));
    const leadName = !isUnresolvedTemplate(thread.profile_name)
        ? thread.profile_name
        : (!isUnresolvedTemplate(thread.ig_username) ? thread.ig_username : 'Lead');
    const history = await loadIgHistory(threadId, messageText);

    let memoryBlock = '';
    // For converted leads, prefer the in-app client_memory (richer signal,
    // includes workout/mood/diet history alongside conversation).
    if (thread.linked_user_id && thread.coach_id) {
        try {
            const memory = await loadClientMemory(thread.coach_id, thread.linked_user_id);
            memoryBlock = buildMemoryBlock(memory);
        } catch (e) { /* non-critical */ }
    }
    // Fall back to the thread's own running memory (populated by the
    // extract-ig-thread-memory cron) for cold leads who haven't signed up.
    // Same column shape as client_memory so buildMemoryBlock works as-is.
    if (!memoryBlock) {
        memoryBlock = buildMemoryBlock({
            goals: thread.goals,
            communication_style: thread.communication_style,
            running_notes: thread.running_notes,
            injuries_limits: thread.injuries_limits,
            personal_context: thread.personal_context,
            coach_instructions: thread.coach_instructions,
        });
    }

    // Resolve the lead stage we'll actually use for prompt routing.
    // linked_user_id is the truth — once a lead has signed up, the
    // ig_threads.lead_stage column may still say 'new' until something
    // updates it. effectiveLeadStageForPrompt promotes that to 'in_app'
    // so the funnel script doesn't hijack the draft.
    const effectiveLeadStage = effectiveLeadStageForPrompt(thread);

    const leadBlock = buildLeadBlock({
        profileName: thread.profile_name,
        igUsername: thread.ig_username,
        customData: thread.custom_data,
        leadStage: effectiveLeadStage,
    });

    // Cancel any prior Send-later drafts queued for this thread — see
    // helper docstring. Run before draft generation so the texts can be
    // folded into the prompt as context.
    let priorScheduledDrafts = [];
    try {
        priorScheduledDrafts = await cancelPriorScheduledForIgThread({ igThreadId: thread.id });
    } catch (e) {
        console.warn('[ig-draft] cancelPriorScheduledForIgThread failed:', e.message);
    }

    // Trailing streak of inbound IG/FB messages BEFORE this current one,
    // since Shannon's last outbound. Same UX as in-app: surface in the
    // notification + admin dashboard so the coach can see every message
    // the draft was generated against (especially after IG coalescing,
    // where multiple inbounds roll into one alert).
    const recentInboundMessages = selectRecentInboundSinceLastReplyIg({ history });

    // For linked clients, also pull the in-app nudges thread so the AI
    // has both sides of recent conversation. Shannon's IG outbounds
    // usually fly natively (bypassing ManyChat → ig_messages), so without
    // this the prompt would only see the inbound IG message with no idea
    // what it's responding to.
    const linkedNudges = await loadLinkedNudgesContext(thread.coach_id, thread.linked_user_id);

    const channel = thread.channel || 'instagram';
    const draft = await generateDraft({
        leadName,
        leadBlock,
        memoryBlock,
        history,
        currentMessage: messageText,
        leadStage: effectiveLeadStage,
        channel,
        igThreadId: thread.id,
        linkedUserId: thread.linked_user_id || null,
        priorScheduledDrafts,
        linkedNudges,
    });

    // Qualifier evaluation: per-lead funnel state for the 4-stage playbook
    // (current_state → motivation → history_blockers → commitment). Runs
    // for cold leads in the new/qualifying/invited window — skipped once
    // they're linked to an app account or marked paying/churned (the
    // funnel has already cleared past these questions).
    //
    // The model decides whether THIS turn is a question moment or just
    // chat, so the push notification can surface "ask: <question>" only
    // when the timing is right. Persists back to ig_threads.qualifier so
    // the next inbound builds on accumulated facts. Failures fall back
    // gracefully to the prior state, never block draft delivery.
    const qualifierEligible = isQualifierEligible({
        leadStage: effectiveLeadStage,
        linkedUserId: thread.linked_user_id,
    });
    let qualifier = thread.qualifier || null;
    let qualifierEvaluated = false;
    if (qualifierEligible) {
        try {
            const result = await evaluateQualifier({
                thread,
                history,
                currentMessage: messageText,
                draftText: draft.joined || '',
                leadName,
                channel,
            });
            qualifier = result.qualifier;
            qualifierEvaluated = result.evaluated;
            if (result.evaluated) {
                // Fire-and-forget persist — the alert insert/coalesce below
                // already carries the qualifier snapshot, so a write delay
                // here doesn't break the notification flow.
                persistQualifier(thread.id, qualifier).catch(e =>
                    console.warn('[ig-draft] qualifier persist failed:', e.message)
                );
            }
        } catch (e) {
            console.warn('[ig-draft] qualifier evaluation failed:', e.message);
        }
    }

    // When the qualifier engine flags this as a question moment, append
    // the next qualifier question as a new IG bubble so the AI's natural
    // reply flows into the funnel question seamlessly. Shannon sees one
    // combined draft and taps Send once — no separate "ask:" override.
    if (qualifierEligible && qualifier?.is_question_moment && qualifier?.next_question && draft.chunks.length > 0) {
        const q = qualifier.next_question.trim();
        draft.chunks.push(q);
        draft.joined = draft.chunks.join('\n');
    }

    // Display-friendly version of the inbound — strips the giant raw
    // `[PHOTO:https://lookaside.fbsbx.com/...]` marker out of anything
    // user-facing (notification body, MessagingStyle bubble, admin
    // description) and replaces it with a clean "📷 photo" tag. The
    // actual URL stays stored in ig_messages.text and alert.data
    // .message_preview so we can still re-fetch / analyse it.
    const displayMessage = replacePhotoMarkers(messageText, () => '📷 photo');

    // Lifecycle stage drives the coloured dot on the push + alert card.
    // For IG/FB threads the userId is whatever app account the lead has
    // linked to (post-conversion); cold leads have no userId so we lean
    // on the thread's own lead_stage instead.
    const lifecycle = await resolveLifecycleStage({
        userId: thread.linked_user_id,
        leadStage: effectiveLeadStage,
    });

    const alertType = channel === 'messenger' ? 'fb_incoming_dm' : 'ig_incoming_dm';
    const channelLabel = channel === 'messenger' ? 'Messenger' : 'Instagram';

    const alertRow = {
        // client_id stays NULL for cold ManyChat leads (no users.id yet).
        // Once the lead converts (ig_threads.linked_user_id set), it's
        // populated so client-centric admin views still find the alert.
        client_id: thread.linked_user_id || null,
        client_name: leadName,
        coach_id: thread.coach_id || null,
        alert_type: alertType,
        priority: 'high',
        title: `${leadName} just DM'd on ${channelLabel}`,
        description: `"${truncate(displayMessage, 200)}"`,
        suggested_message: draft.joined || null,
        status: 'pending',
        data: {
            channel,
            subscriber_id: thread.subscriber_id,
            ig_thread_id: thread.id,
            ig_username: thread.ig_username || null,
            lead_stage: thread.lead_stage || 'new',
            manychat_message_id: manychatMessageId || null,
            message_preview: truncate(messageText, 400),
            // Multi-message split — `draft_messages` is the array of chunks
            // we want to send as separate IG/Messenger bubbles. `draft_text`
            // is the joined version shown in the push notification (so
            // Shannon can review the whole reply at once). send-ig-reply
            // uses draft_messages when Shannon sends without editing; falls
            // back to single-message send when his edit invalidates the
            // chunk boundaries.
            draft_messages: draft.chunks,
            draft_text: draft.joined,
            draft_model: draft.model,
            drafted_at: new Date().toISOString(),
            // Diagnostics so we can see from the DB why a draft failed
            // without needing Netlify function logs.
            draft_error: draft.error || null,
            image_url_count: draft.urlCount || 0,
            image_inline_count: draft.imageCount || 0,
            // Trailing inbound streak, same shape as instant-coach-draft.
            // Photos in those prior messages get rendered as "📷 photo".
            recent_inbound_messages: recentInboundMessages.map(m => ({
                text: truncate(replacePhotoMarkers(m.text || '', () => '📷 photo'), 280),
                created_at: m.created_at,
            })),
            // Per-lead qualifier snapshot at the moment this alert was
            // produced — stage, warmth, suggested next question, and the
            // quote-grounded reason for the timing. The admin dashboard
            // alert card reads these to render the strategic strip
            // (stage badge / warmth / next-question / why-now). Null
            // for paying clients and leads outside the funnel window.
            qualifier: qualifierEligible ? qualifier : null,
            qualifier_evaluated: qualifierEvaluated,
            lifecycle,
        },
    };

    // Coalesce window: if there's a pending alert for this same thread from
    // the last COALESCE_WINDOW_MIN minutes, UPDATE it instead of inserting
    // a new one. The just-generated draft already incorporates the new
    // message via conversation history, so we swap the alert's stored draft
    // and re-fire the push (Android replaces by alertId tag, so the lead
    // sees one rolling notification rather than a stack of pushes for
    // back-to-back messages).
    const coalesceCutoffIso = new Date(Date.now() - COALESCE_WINDOW_MIN * 60 * 1000).toISOString();
    let existingPending = null;
    try {
        const rows = await supabaseQuery(
            `coach_alerts?select=id,data&data->>ig_thread_id=eq.${thread.id}&status=eq.pending&created_at=gte.${encodeURIComponent(coalesceCutoffIso)}&alert_type=in.(ig_incoming_dm,fb_incoming_dm)&order=created_at.desc&limit=1`
        );
        existingPending = rows[0] || null;
    } catch (e) { /* non-critical, fall through to insert */ }

    let alertId = null;
    let coalesced = false;
    if (existingPending) {
        const previousCount = (existingPending.data && existingPending.data.coalesced_count) || 1;
        const newCount = previousCount + 1;
        const mergedData = {
            ...(existingPending.data || alertRow.data),
            message_preview: truncate(messageText, 400),
            manychat_message_id: manychatMessageId || (existingPending.data && existingPending.data.manychat_message_id) || null,
            draft_messages: draft.chunks,
            draft_text: draft.joined,
            draft_model: draft.model,
            drafted_at: new Date().toISOString(),
            coalesced_count: newCount,
            // Refresh on every coalesce — `history` already includes every
            // unanswered inbound up to (but excluding) the current one, so
            // the saved streak grows naturally as messages roll in.
            recent_inbound_messages: recentInboundMessages.map(m => ({
                text: truncate(replacePhotoMarkers(m.text || '', () => '📷 photo'), 280),
                created_at: m.created_at,
            })),
            // Refresh the qualifier snapshot so the alert card reflects
            // the latest stage/warmth/question after every coalesced
            // message. The full qualifier object also lives on
            // ig_threads.qualifier (single source of truth); this is
            // just the per-alert snapshot for the admin feed.
            qualifier: qualifierEligible ? qualifier : (existingPending.data?.qualifier || null),
            qualifier_evaluated: qualifierEvaluated || (existingPending.data?.qualifier_evaluated || false),
        };
        // Same qualifier-question pre-fill as the insert path
        const coalescedSuggestion = (qualifierEligible && qualifier?.is_question_moment && qualifier?.next_question)
            ? qualifier.next_question.trim()
            : (draft.joined || null);
        try {
            await supabaseQuery(`coach_alerts?id=eq.${existingPending.id}`, {
                method: 'PATCH',
                body: {
                    suggested_message: coalescedSuggestion,
                    description: `"${truncate(displayMessage, 200)}" (+${newCount - 1} earlier)`,
                    data: mergedData,
                },
                prefer: 'return=minimal',
            });
            alertId = existingPending.id;
            coalesced = true;
            console.log(`[ig-draft] coalesced into alert ${alertId} (count=${newCount})`);
        } catch (err) {
            console.warn('[ig-draft] coalesce PATCH failed, falling back to insert:', err.message);
            existingPending = null; // force the insert path below
        }
    }

    if (!existingPending) {
        try {
            const result = await insertCoachAlert(alertRow, idempotencyKey);
            alertId = result.alertId;
            if (result.deduped) {
                return { statusCode: 200, body: JSON.stringify({ skipped: 'duplicate', alert_id: alertId }) };
            }
        } catch (err) {
            console.error('[ig-draft] alert insert failed:', err.message);
            return { statusCode: 500, body: JSON.stringify({ error: 'Alert insert failed', details: err.message }) };
        }
    }

    await sendDraftReadyPush({
        adminId: thread.coach_id,
        alertId,
        leadName,
        leadMessage: displayMessage,
        draftText: draft.joined,
        // For linked-app users we pass their real users.id so the
        // MessagingStyle conversation merges with any in-app coach drafts
        // for the same client. For cold ManyChat leads we fall back to the
        // subscriber_id — stable per conversation, non-empty so
        // CoachDraftMessagingService doesn't reject the payload.
        clientId: thread.linked_user_id || thread.subscriber_id,
        channel,
        recentInboundMessages,
        qualifier: qualifierEligible ? qualifier : null,
        qualifierEligible,
        lifecycle,
    });

    // For qualifier-eligible leads, qualifier.why_now ALREADY explains the
    // strategic timing — surfacing a second generic reasoning on top would
    // just dilute that signal. Skip those alerts; everything else (warm
    // already-converted leads with no qualifier) gets the generic pass.
    if (alertId && draft.joined && !qualifierEligible) {
        const priorCount = Array.isArray(recentInboundMessages) ? recentInboundMessages.length : 0;
        const priorText = priorCount > 0
            ? `\nPrior unanswered messages from ${leadName}:\n${recentInboundMessages.map(m => `- "${truncate(replacePhotoMarkers(m.text || '', () => '📷 photo'), 200)}"`).join('\n')}`
            : '';
        const contextBlocks = `Just-arrived ${channelLabel} message from ${leadName}: "${truncate(displayMessage, 400)}"${priorText}`;
        fireDraftReasoning({
            alertId,
            draftText: draft.joined,
            alertType,
            contextBlocks,
            clientName: leadName,
        });
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            alert_id: alertId,
            draft_model: draft.model,
            draft_generated: !!draft.joined,
            chunk_count: draft.chunks.length,
            coalesced,
        }),
    };
};
