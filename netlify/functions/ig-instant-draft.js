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
    loadClientProfileFacts,
    buildClientProfileBlock,
    buildCoachBioBlock,
    loadEditExamples,
    callVertexAIModel,
    callGeminiFallback,
    callVertexGeminiMultimodal,
    stripLeadingGreeting,
    truncate,
    formatCoachLocalTimestamp,
    formatTimedConversationLine,
    buildMessageMediaParts,
    replacePhotoMarkers,
    replaceAudioMarkers,
    extractPhotoUrls,
    extractAudioUrls,
} = require('./_lib/client-context');

const {
    isQualifierEligible,
    evaluateQualifier,
    persistQualifier,
    formatPushTitle,
    formatPushBody,
    summarizeForFcmData,
    cleanFactValue,
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
LEAD ACQUISITION CONTEXT:
Shannon finds leads by browsing Instagram/Facebook stories, reels, and posts, then DMs them first. He initiates the conversation. Some leads also come from Shannon's Meta ad for his 30-day plant-based wellness challenge (the ad opens the DM with quick-reply buttons). Either way, the words below trigger challenge-inquiry mode:
  1. "What's actually included?"
  2. "Do I need to already be Plant Based?"
  3. "I'm In - save me a spot!"
Also treat as challenge inquiry: any mention of "the challenge", "your program", "your thing", "saw your ad", "wanna join", "interested in".

Important: when there is no prior tracked conversation, do NOT assume the lead started the DM. Most first captured lead messages happen because Shannon commented on or replied to their story/post natively, and that opener is not visible in ManyChat. Their reply may be tiny or ambiguous because they are answering that unseen opener. Treat it as an open door, build rapport from whatever signal exists, and ask one light human question unless they are clearly asking about the challenge or link.

THE OFFERING (for context — never list as a brochure; speak like a friend):
- The FIRST offer is a free 30-day challenge, not a standalone custom meal plan or workout program.
- If they are plant-based / vegan / vegetarian-curious, route them to the plant-based challenge.
- If they just want fitness, muscle, weight loss, energy, or consistency with no plant-based signal, route them to the generic transformation challenge.
- Once they join, the Balance app tailors their workout program and meal plan. Shannon can edit it if needed after they sign up.
- Shannon checks in Monday, Wednesday, Friday. Friday is a weekly review and adjustment check-in.
- Keep it free/no pressure. The paid coaching pitch comes later, after the challenge has built trust.

RESPONSE PATTERNS (mimic Shannon's actual voice for each prompt):
- "What's actually included?" -> explain the free challenge casually: app sets up workouts/meals, Shannon checks in Mon/Wed/Fri, he can tweak the plan if needed. Don't dump a brochure.
- "Do I need to already be Plant Based?" -> warm reassurance ("not at all, lots of my crew start curious"), then ask their current eating situation, ever cooked plant-based before.
- "I'm In - save me a spot!" / "let's do it" / "keen" -> if they have already shared enough context or clearly accepted, send the relevant challenge link and explain the next step. Do NOT ask a Name + Age + Main goal intake bundle.

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
        `ig_threads?select=id,subscriber_id,coach_id,channel,ig_username,profile_name,lead_stage,linked_user_id,custom_data,goals,communication_style,running_notes,injuries_limits,personal_context,coach_instructions,qualifier,auto_send_enabled&id=eq.${threadId}&limit=1`
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
function qualifierHasProgress(qualifier) {
    if (!qualifier || typeof qualifier !== 'object') return false;
    const facts = qualifier.facts || {};
    const hasFacts = ['relationship_context', 'current_state', 'motivation', 'history_blockers', 'commitment']
        .some(key => !!facts[key]);
    return hasFacts
        || (qualifier.stage && qualifier.stage !== 'current_state')
        || Number(qualifier.stage_index || 1) > 1;
}

function historyShowsActiveConversation(history = []) {
    if (!Array.isArray(history) || history.length === 0) return false;
    const inbound = history.filter(m => m.direction === 'in').length;
    const outbound = history.filter(m => m.direction === 'out').length;
    return (inbound >= 2 && outbound >= 1)
        || (inbound >= 1 && outbound >= 2)
        || (history.length >= 6 && inbound > 0 && outbound > 0);
}

function effectiveLeadStageForPrompt(thread, history = []) {
    const raw = thread?.lead_stage || 'new';
    if (thread?.linked_user_id && (raw === 'new' || raw === 'qualifying' || raw === 'invited')) {
        return 'in_app';
    }
    if (raw === 'new' && (qualifierHasProgress(thread?.qualifier) || historyShowsActiveConversation(history))) {
        return 'qualifying';
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
    if (!stage || stage === 'new') {
        return "EARLY in this DM thread. If there are no visible prior messages, assume Shannon's native story/post opener is missing from ManyChat and this is the lead's first captured reply. Just chat. Ask one genuine follow-up question that builds rapport from what they said. Prefer light human context before fitness goals: where they're based, kids/family, work/life rhythm, cooking situation, training background, or what made them reply. DO NOT pitch the app, the challenge, or anything else yet.";
    }
    switch (stage) {
        case 'qualifying':
            return "Conversation is warming up. Do rapport before coaching discovery: where they're based, kids/family, work/life rhythm, cooking situation, training background, what made them reply. Stay in the topic, ask one useful follow-up, and only mention the free challenge when they ask how to start, ask for help, or there is a very clear opening. Do not offer to write a standalone meal plan or workout program in DMs. The app tailors those after they join the challenge.";
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

function challengeUrlForRoute(route) {
    return route === 'vegan'
        ? 'https://plantbased-balance.org/vegan-challenge.html'
        : 'https://plantbased-balance.org/transform-challenge.html';
}

function buildChallengeNextStepBlock(qualifier) {
    if (!qualifier || typeof qualifier !== 'object') return '';
    const url = challengeUrlForRoute(qualifier.challenge_route || 'generic');
    if (qualifier.stage === 'won') {
        return `

CHALLENGE ACCEPTED NEXT STEP:
They have accepted the free 30-day challenge. Do NOT ask more qualifier/intake questions in this reply.
Your reply should:
- Send this link: ${url}
- Say the next free challenge starts Monday, but do not invent a date.
- Explain simply that the app will tailor their workout program and meal plan.
- Mention Shannon can edit/tweak the plan if needed after they sign up.
- Mention Shannon checks in Mon/Wed/Fri, and Friday is the weekly review/check-in.
- Keep it casual and direct, one clear CTA to jump on the link.
Do not offer to manually write a meal plan or workout program in DMs before signup.`;
    }
    if (qualifier.stage === 'pitched') {
        return `

CHALLENGE PITCHED:
The free 30-day challenge has already been offered. If they sound keen or ask how to start, send this link: ${url}. If they are still unsure, answer the concern and keep it easy.`;
    }
    return '';
}

function replaceIgMediaMarkers(text, { photo = '📷 photo', audio = '🎙️ voice note', video = '🎥 video' } = {}) {
    return replaceAudioMarkers(
        replacePhotoMarkers(String(text || ''), () => photo),
        () => audio
    ).replace(/\[video:\s*https?:\/\/[^\]]+\]/gi, video);
}

function extractIgMessageMedia(rawText) {
    return [
        ...extractPhotoUrls(rawText).map(url => ({ type: 'photo', url })),
        ...extractAudioUrls(rawText).map(url => ({ type: 'audio', url })),
    ];
}

function formatInboundBatchForDisplay({ recentInboundMessages = [], currentMessage = '', currentCreatedAt = null, maxChars = 2000 }) {
    const rows = [];
    (Array.isArray(recentInboundMessages) ? recentInboundMessages : []).forEach(m => {
        const rawText = String(m?.text || '').trim();
        const text = replaceIgMediaMarkers(rawText);
        if (!text) return;
        rows.push({
            text: truncate(text, maxChars),
            media: extractIgMessageMedia(rawText),
            created_at: m?.created_at || null,
            is_current: false,
        });
    });
    const latestRawText = String(currentMessage || '').trim();
    const latestText = replaceIgMediaMarkers(latestRawText);
    if (latestText) {
        rows.push({
            text: truncate(latestText, maxChars),
            media: extractIgMessageMedia(latestRawText),
            created_at: currentCreatedAt || null,
            is_current: true,
        });
    }
    return rows;
}

async function generateDraft({ leadName, leadBlock, profileBlock, memoryBlock, history, currentMessage, recentInboundMessages = [], leadStage, channel, igThreadId, linkedUserId, priorScheduledDrafts, linkedNudges, qualifier, qualifierQuestion }) {
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
    const {
        imageParts,
        audioParts,
        mediaParts,
        rewrittenMessage,
        photoUrlCount,
        audioUrlCount,
    } = await buildMessageMediaParts(currentMessage);
    // Detect when the message had photo URLs but the fetch failed (Meta CDN
    // rejected us, signed URL expired, image too large, etc). In that case
    // imageParts is empty even though the original message had `[PHOTO:url]`
    // markers — the AI should still know a photo came in so it can reply
    // naturally ("can you re-send that, didn't open for me") instead of
    // producing a confused or empty draft.
    const hadPhotoUrls = /\[PHOTO:https?:\/\//i.test(String(currentMessage || ''));
    const hadAudioUrls = /\[AUDIO:https?:\/\//i.test(String(currentMessage || ''));
    const photoFetchFailed = hadPhotoUrls && imageParts.length === 0;
    const audioFetchFailed = hadAudioUrls && audioParts.length === 0;
    const mediaFailureNotes = [];
    if (photoFetchFailed) {
        mediaFailureNotes.push('the photo did not open on my end, ask casually if they can re-send or check if it loaded for them');
    }
    if (audioFetchFailed) {
        mediaFailureNotes.push('the voice note did not play on my end, ask casually if they can resend it or type the gist');
    }
    const currentMessageText = mediaFailureNotes.length
        ? rewrittenMessage + ` (NOTE: ${mediaFailureNotes.join('. ')}. Don't pretend you saw or heard it.)`
        : rewrittenMessage;
    const promptNow = new Date();
    const promptNowText = formatCoachLocalTimestamp(promptNow);
    const unansweredBatch = [
        ...(Array.isArray(recentInboundMessages) ? recentInboundMessages : []).map(m => ({
            text: replaceIgMediaMarkers(String(m?.text || '').trim(), { photo: '[photo]', audio: '[voice note]', video: '[video]' }),
            created_at: m?.created_at || null,
            isCurrent: false,
        })),
        {
            text: currentMessageText,
            created_at: promptNow.toISOString(),
            isCurrent: true,
        },
    ].filter(m => m.text);
    const unansweredBatchBlock = unansweredBatch.length <= 1 ? '' : `

UNANSWERED INBOUND BATCH FROM ${leadName} (oldest -> newest):
${unansweredBatch.map((m, i) => `${i + 1}. ${m.text}${m.isCurrent ? ' (latest)' : ''}`).join('\n')}

Reply to the whole batch, not only the newest item. If the newest item is a photo or voice note, treat it as extra context for the earlier words unless the earlier words clearly do not relate.`;

    const historyText = history.length === 0
        ? "(no prior tracked messages. This is probably the first captured lead reply after Shannon's native story/post opener, so there may be no visible context.)"
        : history.map((m, i) => {
            const speaker = m.direction === 'in' ? leadName : 'Shannon';
            const cleaned = replaceIgMediaMarkers(m.text, { photo: '[photo]', audio: '[voice note]', video: '[video]' });
            return formatTimedConversationLine({
                speaker,
                text: cleaned,
                createdAt: m.created_at,
                previousCreatedAt: history[i - 1]?.created_at,
                now: promptNow,
            });
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
    const challengeNextStepBlock = buildChallengeNextStepBlock(qualifier);

    // Cross-channel: when this lead is linked to an app user, fold in
    // the in-app DM transcript so the AI sees BOTH sides of recent
    // conversation (Shannon's IG-side outbounds are usually sent
    // natively and don't land in ig_messages). Without this the prompt
    // sees only the inbound IG message with no idea what the client is
    // replying to.
    const linkedHistory = Array.isArray(linkedNudges) ? linkedNudges : [];
    const crossChannelBlock = linkedHistory.length === 0 ? '' : `

CROSS-CHANNEL HISTORY (in-app DMs, older → newer — the parallel conversation Shannon has had with this client inside the Balance app):
${linkedHistory.map((m, i) => {
        const speaker = m.sender_id === linkedUserId ? leadName : 'Shannon';
        const cleaned = replaceIgMediaMarkers(m.message || '', { photo: '[photo]', audio: '[voice note]', video: '[video]' });
        return formatTimedConversationLine({
            speaker,
            text: cleaned,
            createdAt: m.created_at,
            previousCreatedAt: linkedHistory[i - 1]?.created_at,
            now: promptNow,
        });
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

    const isFirstCapturedLeadReply = !isOnboardedOrPostFunnel
        && history.length === 0
        && linkedHistory.length === 0
        && priorScheduled.length === 0;
    const firstCapturedLeadReplyBlock = isFirstCapturedLeadReply ? `

FIRST CAPTURED LEAD REPLY:
There is no reliable prior DM context in the system. Usually Shannon has already commented on or replied to their story/post from Instagram/Facebook, but that native opener was not captured by ManyChat.
- Do not ask what this is about or say you have no context.
- If their message is short or ambiguous, treat it as them opening the door. Match their energy, make a small human observation if possible, then ask one light rapport question.
- If they clearly ask about the challenge, what is included, plant-based stuff, or a signup link, answer that directly and keep it casual.
- No coaching intake, no pitch, no name/age/goal bundle on this first captured reply.` : '';

    const mediaInstruction = [
        imageParts.length
            ? `(${imageParts.length} photo${imageParts.length === 1 ? '' : 's'} attached below, look at ${imageParts.length === 1 ? 'it' : 'them'} and let what you see shape your reply. If it's food, react to what you see. If it's a body/progress shot, give specific feedback. If it's something casual or funny, react naturally, don't pretend you can't see it.)`
            : '',
        audioParts.length
            ? `(${audioParts.length} voice note${audioParts.length === 1 ? '' : 's'} attached below, listen to ${audioParts.length === 1 ? 'it' : 'them'} and respond to what they actually said. Treat it like a normal DM, not a transcription task.)`
            : '',
    ].filter(Boolean).join(' ');

    const prompt = `Draft a SHORT ${channelLabel} DM reply in Shannon's voice, broken into 1-3 messages so it lands like real texting (separate bubbles, not one wall of text).

CRITICAL — DO NOT GREET: Never start with "hey [name]", "hi", "yo". Jump straight into content.

This is ${channelShort}. Tight chunks: each message 1-2 sentences max, lowercase-friendly, Australian casual. No emojis unless they used one first. No links unless absolutely necessary. Sound like a person texting back, not a brand.
${firstCapturedLeadReplyBlock}

CONVERSATION RESPONSIBILITY:
- Treat the new message as an answer to Shannon's latest question when that is obvious. Continue that thread before changing topic.
- If they admit they have been "slacking", off track, missed training, or had a rough week, don't reply with filler like "ahh yeah man" on its own, don't ask "wby"/"what about you", and don't repeat the same broad question. Validate lightly, then ask one concrete follow-up about what got in the way or what small session they can lock in next.
- The funnel should feel invisible. It can take hours or months. One smooth human question beats a forced qualifier or pitch.
- Keep the spotlight on them unless they directly ask about Shannon.

ACQUISITION STYLE:
- Human first, coach second. Before goals/blockers, learn one normal-life anchor when it fits: where they're based, kids/family, work/life rhythm, cooking situation, training background, or why they replied.
- Do not bundle questions. Never ask name + age + goal + blocker together.
- If the discovery question is about relationship context, ask one light version and stop. Do not tack on a fitness goal in the same reply.
- If they are already asking how to join, accepted the challenge, or clearly want the link, move them forward instead of slowing them down with more questions.

NEVER reveal AI, automation, "trained on Shannon's voice", "24/7", or anything that breaks the personal-coach illusion. Shannon is replying personally.

NO em-dashes. Use periods, colons, or commas instead.

${pitchHint}
${coachBio}
${funnelContext}
${challengeNextStepBlock}
${unansweredBatchBlock}

LEAD: ${leadName}${profileBlock || ''}${leadBlock}${memoryBlock || ''}${priorScheduledBlock}${crossChannelBlock}

CURRENT TIME (Australia/Brisbane): ${promptNowText}. Use the message timestamps and gaps to judge pace, delays, stale threads, and whether Shannon should acknowledge time passing. Do not mention exact timestamps unless it would feel natural.

CONVERSATION HISTORY (${channelLabel} DM):
${historyText}

THEIR NEW MESSAGE (just arrived around ${promptNowText}):
${currentMessageText}${mediaInstruction ? ` ${mediaInstruction}` : ''}${editExamples}
${qualifierQuestion ? `
IMPORTANT — CONVERSATIONAL DISCOVERY:
Somewhere in your reply, casually work in this question or something very close to it: "${qualifierQuestion}"
This is NOT a coaching intake question. It should sound like genuine curiosity from a mate, like something you'd ask over a beer. If the conversation is about food, ask about a specific meal. If it's about training, ask what they did today. Rephrase freely to fit the vibe. The lead should never feel like they're being assessed or funnelled.
If this question is about normal-life context (location, kids/family, work, household, cooking, daily rhythm), ask only that light question. Do not add a goal, age, blocker, or challenge pitch in the same reply.
` : ''}
OUTPUT FORMAT — JSON only, nothing else:
{"messages": ["chunk 1", "chunk 2 (if needed)", "chunk 3 (if needed)"]}

Rules:
- 1 to 3 chunks. One-liner is fine — just one item in the array.
- Split where Shannon would naturally pause: new thought, change of topic, follow-up question.
- Don't artificially split a single sentence. Each chunk should stand on its own.
- No quotes, labels, code-fence, or commentary outside the JSON.`;

    const inlineMediaParts = [{ text: prompt }, ...mediaParts];
    const mediaContents = [{ role: 'user', parts: inlineMediaParts }];
    const hasInlineMedia = mediaParts.length > 0;
    // Text-only contents — used when vision fails OR when there's no image.
    // We rebuild the prompt with the photo-failed hint so the AI knows to
    // ask casually about the photo without pretending it saw it.
    const textOnlyPrompt = hasInlineMedia
        ? prompt.replace(
            'THEIR NEW MESSAGE:\n' + currentMessageText,
            'THEIR NEW MESSAGE:\n' + currentMessageText + ' (NOTE: attached media could not be decoded in this fallback. If the reply depends on it, casually ask them to resend it or type the gist. Do not pretend you saw or heard it.)'
        )
        : prompt;
    const textContents = [{ role: 'user', parts: [{ text: textOnlyPrompt }] }];
    const generationConfig = { maxOutputTokens: 2048, temperature: 0.85 };

    let rawText = '';
    let model = 'none';
    let lastError = null;

    if (hasInlineMedia) {
        // Vision path: try the public Gemini API first (works fine on a paid
        // tier key, which is what Shannon has now), and fall back to Vertex
        // AI's hosted Gemini if the public API has a hiccup. v7 is text-only
        // fine-tuned so we never send image bytes there -- it's out-of-
        // distribution.
        try {
            rawText = await callGeminiFallback(mediaContents, generationConfig);
            model = audioParts.length > 0
                ? (imageParts.length > 0 ? 'gemini-media' : 'gemini-audio')
                : 'gemini-vision';
        } catch (err) {
            console.warn('[ig-draft] public Gemini media failed, trying Vertex Gemini:', err.message);
            lastError = `public-media: ${err.message.slice(0, 200)}`;
            try {
                rawText = await callVertexGeminiMultimodal(mediaContents, generationConfig);
                model = audioParts.length > 0
                    ? (imageParts.length > 0 ? 'vertex-gemini-media-fallback' : 'vertex-gemini-audio-fallback')
                    : 'vertex-gemini-vision-fallback';
                lastError = null; // recovered
            } catch (err2) {
                console.warn('[ig-draft] Vertex Gemini media also failed:', err2.message);
                lastError = `${lastError} | vertex-media: ${err2.message.slice(0, 200)}`;
            }
        }
    }

    if (!rawText) {
        // No image OR vision failed -> text-only path. Vertex v7 first
        // (Shannon's voice), Gemini fallback if that errors.
        try {
            rawText = await callVertexAIModel(textContents, generationConfig);
            model = lastError ? 'vertex-v7+media-failed' : 'vertex-v7';
        } catch (err) {
            console.warn(`[ig-draft] Vertex failed, falling back to Gemini: ${err.message}`);
            lastError = `${lastError ? lastError + ' | ' : ''}vertex: ${err.message.slice(0, 200)}`;
            try {
                rawText = await callGeminiFallback(textContents, generationConfig);
                model = lastError ? 'gemini-fallback+media-failed' : 'gemini-2.0-fallback';
            } catch (err2) {
                console.error('[ig-draft] Gemini fallback failed:', err2.message);
                lastError = `${lastError ? lastError + ' | ' : ''}gemini: ${err2.message.slice(0, 200)}`;
                return { chunks: [], joined: '', model: 'none', error: lastError, imageCount: imageParts.length, audioCount: audioParts.length };
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
        audioCount: audioParts.length,
        urlCount: photoUrlCount,
        audioUrlCount,
    };
}

function _notifyQualifierAdvance({ priorStage, priorFacts, nextQualifier, leadName, channel, coachId }) {
    if (!coachId || !nextQualifier) return;
    const newStage = nextQualifier.stage;
    const stageLabels = { current_state: 'Current state', motivation: 'Motivation', history_blockers: 'History + blockers', commitment: 'Commitment', pitched: 'Pitched', won: 'Won', lost: 'Lost', paused: 'Paused' };
    const factKeys = ['current_state', 'motivation', 'history_blockers', 'commitment'];
    const newFacts = nextQualifier.facts || {};
    const justAnswered = factKeys.filter(k => !cleanFactValue(priorFacts[k]) && cleanFactValue(newFacts[k]));
    const stageAdvanced = priorStage && newStage && priorStage !== newStage;
    if (justAnswered.length === 0 && !stageAdvanced) return;
    const channelLabel = channel === 'messenger' ? 'FB' : 'IG';
    const completed = factKeys.filter(k => !!cleanFactValue(newFacts[k])).length;
    let title = `📊 ${leadName} (${channelLabel})`;
    let body = '';
    if (justAnswered.length > 0) {
        const answered = justAnswered.map(k => stageLabels[k] || k).join(', ');
        body += `Answered: ${answered}. `;
    }
    if (stageAdvanced) {
        const label = stageLabels[newStage] || newStage;
        body += `Now on stage ${nextQualifier.stage_index || '?'}/4: ${label}. `;
    }
    body += `(${completed}/4 complete)`;
    fetch(`${SITE_URL}/.netlify/functions/send-dm-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            recipientId: coachId,
            senderName: title,
            messageText: body,
            type: 'qualifier_advance',
        }),
    }).catch(e => console.warn('[ig-draft] qualifier advance push failed:', e.message));
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
        // Strip media markers and truncate so the FCM payload stays
        // under the 4 KB limit even when several long messages stream in.
        const recentInboundForPush = (recentInboundMessages || []).map(m => ({
            text: truncate(replaceIgMediaMarkers(m.text || ''), 280),
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

    let profileBlock = '';
    if (thread.linked_user_id) {
        try {
            const profile = await loadClientProfileFacts(thread.linked_user_id);
            profileBlock = buildClientProfileBlock({ clientName: leadName, profile });
        } catch (e) { /* non-critical */ }
    }
    if (!profileBlock) {
        profileBlock = buildClientProfileBlock({
            clientName: leadName,
            profile: { customData: thread.custom_data || {} },
            customData: thread.custom_data || {},
        });
    }

    // Resolve the lead stage we'll actually use for prompt routing.
    // linked_user_id is the truth — once a lead has signed up, the
    // ig_threads.lead_stage column may still say 'new' until something
    // updates it. effectiveLeadStageForPrompt promotes that to 'in_app'
    // so the funnel script doesn't hijack the draft.
    const effectiveLeadStage = effectiveLeadStageForPrompt(thread, history);
    if (!thread.linked_user_id && thread.lead_stage === 'new' && effectiveLeadStage === 'qualifying') {
        try {
            await supabaseQuery(`ig_threads?id=eq.${thread.id}`, {
                method: 'PATCH',
                body: { lead_stage: 'qualifying' },
                prefer: 'return=minimal',
            });
            thread.lead_stage = 'qualifying';
        } catch (e) {
            console.warn('[ig-draft] mature-thread stage promotion failed:', e.message);
        }
    }

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

    // Qualifier evaluation runs BEFORE draft generation so we can inject
    // the next funnel question into the AI prompt. The model weaves it
    // naturally into its reply as one smooth message instead of bolting
    // it on as a separate bubble.
    const qualifierEligible = isQualifierEligible({
        leadStage: effectiveLeadStage,
        linkedUserId: thread.linked_user_id,
    });
    let qualifier = thread.qualifier || null;
    let qualifierEvaluated = false;
    let qualifierError = null;
    let qualifierModel = null;
    const priorStage = qualifier?.stage || null;
    const priorFacts = qualifier?.facts ? { ...qualifier.facts } : {};
    const priorQualifier = qualifier;
    if (qualifierEligible) {
        try {
            const result = await evaluateQualifier({
                thread,
                history,
                currentMessage: replaceIgMediaMarkers(messageText, { photo: '[photo]', audio: '[voice note]', video: '[video]' }),
                draftText: '',
                leadName,
                channel,
            });
            qualifierError = result.error || null;
            qualifierModel = result.model || null;
            if (result.evaluated) {
                qualifier = result.qualifier;
                qualifierEvaluated = true;
                const persisted = await persistQualifier(thread.id, qualifier);
                if (!persisted) {
                    console.warn(`[ig-draft] qualifier persist failed for thread ${thread.id}`);
                }
                _notifyQualifierAdvance({
                    priorStage,
                    priorFacts,
                    nextQualifier: qualifier,
                    leadName,
                    channel,
                    coachId: thread.coach_id,
                });
            } else {
                qualifier = priorQualifier;
                console.warn('[ig-draft] qualifier skipped question injection:', result.error || 'evaluation_failed');
            }
        } catch (e) {
            qualifier = priorQualifier;
            qualifierError = e.message;
            console.warn('[ig-draft] qualifier evaluation failed:', e.message);
        }
    }

    const terminalQualifierStage = ['pitched', 'won'].includes(qualifier?.stage);
    const qualifierQuestion = (!terminalQualifierStage && qualifierEligible && qualifierEvaluated && qualifier?.is_question_moment && qualifier?.next_question)
        ? qualifier.next_question.trim()
        : null;

    const draft = await generateDraft({
        leadName,
        leadBlock,
        profileBlock,
        memoryBlock,
        history,
        currentMessage: messageText,
        recentInboundMessages,
        leadStage: effectiveLeadStage,
        channel,
        igThreadId: thread.id,
        linkedUserId: thread.linked_user_id || null,
        priorScheduledDrafts,
        linkedNudges,
        qualifier,
        qualifierQuestion,
    });

    // Display-friendly version of the inbound — strips the giant raw
    // `[PHOTO:https://lookaside.fbsbx.com/...]` marker out of anything
    // user-facing (notification body, MessagingStyle bubble, admin
    // description) and replaces it with a clean "📷 photo" tag. The
    // actual URL stays stored in ig_messages.text and alert.data
    // .message_preview so we can still re-fetch / analyse it.
    const displayMessage = replaceIgMediaMarkers(messageText);
    const inboundMessageBatch = formatInboundBatchForDisplay({
        recentInboundMessages,
        currentMessage: messageText,
        currentCreatedAt: new Date().toISOString(),
    });

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
            audio_url_count: draft.audioUrlCount || 0,
            audio_inline_count: draft.audioCount || 0,
            // Trailing inbound streak, same shape as instant-coach-draft.
            // Media in those prior messages gets rendered as clean labels.
            recent_inbound_messages: recentInboundMessages.map(m => ({
                text: truncate(replaceIgMediaMarkers(m.text || ''), 280),
                created_at: m.created_at,
            })),
            inbound_message_batch: inboundMessageBatch,
            // Per-lead qualifier snapshot at the moment this alert was
            // produced — stage, warmth, suggested next question, and the
            // quote-grounded reason for the timing. The admin dashboard
            // alert card reads these to render the strategic strip
            // (stage badge / warmth / next-question / why-now). Null
            // for paying clients and leads outside the funnel window.
            qualifier: (qualifierEligible && qualifierEvaluated) ? qualifier : null,
            qualifier_evaluated: qualifierEvaluated,
            qualifier_error: qualifierError,
            qualifier_model: qualifierModel,
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
            draft_error: draft.error || null,
            image_url_count: draft.urlCount || 0,
            image_inline_count: draft.imageCount || 0,
            audio_url_count: draft.audioUrlCount || 0,
            audio_inline_count: draft.audioCount || 0,
            // Refresh on every coalesce — `history` already includes every
            // unanswered inbound up to (but excluding) the current one, so
            // the saved streak grows naturally as messages roll in.
            recent_inbound_messages: recentInboundMessages.map(m => ({
                text: truncate(replaceIgMediaMarkers(m.text || ''), 280),
                created_at: m.created_at,
            })),
            inbound_message_batch: inboundMessageBatch,
            // Refresh the qualifier snapshot so the alert card reflects
            // the latest stage/warmth/question after every coalesced
            // message. The full qualifier object also lives on
            // ig_threads.qualifier (single source of truth); this is
            // just the per-alert snapshot for the admin feed.
            qualifier: (qualifierEligible && qualifierEvaluated) ? qualifier : (existingPending.data?.qualifier || null),
            qualifier_evaluated: qualifierEvaluated,
            qualifier_error: qualifierError,
            qualifier_model: qualifierModel,
        };
        const coalescedSuggestion = draft.joined || null;
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

    // Auto-send path: only converted IG/FB threads can bypass the approve
    // gate. Cold leads still need Shannon's approval even if a stale admin
    // toggle was left on.
    let autoSent = false;
    const igAutoSendAllowed = !!thread.linked_user_id
        && ['in_app', 'paying'].includes(effectiveLeadStage);
    if (thread.auto_send_enabled && !igAutoSendAllowed) {
        console.warn(`[ig-draft] auto-send blocked for cold/non-converted thread ${thread.id}`);
    }
    if (thread.auto_send_enabled && igAutoSendAllowed && alertId && draft.joined) {
        try {
            const replyFn = 'send-ig-reply';
            const res = await fetch(`${SITE_URL}/.netlify/functions/${replyFn}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    alertId,
                    replyText: draft.joined,
                    draftText: draft.joined,
                    source: 'auto_send',
                }),
            });
            if (res.ok) {
                autoSent = true;
                console.log(`[ig-draft] auto-sent alert ${alertId} for ${leadName}`);
                // FYI push so Shannon knows what went out
                fetch(`${SITE_URL}/.netlify/functions/send-dm-notification`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        recipientId: thread.coach_id,
                        senderName: `📤 Auto-sent → ${leadName}`,
                        messageText: truncate(draft.joined, 160),
                        type: 'auto_sent_confirmation',
                    }),
                }).catch(e => console.warn('[ig-draft] auto-send confirmation push failed:', e.message));
            } else {
                console.warn(`[ig-draft] auto-send ${replyFn} returned ${res.status}, falling back to approve-gate`);
            }
        } catch (e) {
            console.warn('[ig-draft] auto-send failed, falling back to approve-gate:', e.message);
        }
    }

    if (!autoSent) {
        await sendDraftReadyPush({
            adminId: thread.coach_id,
            alertId,
            leadName,
            leadMessage: displayMessage,
            draftText: draft.joined,
            clientId: thread.linked_user_id || thread.subscriber_id,
            channel,
            recentInboundMessages,
            qualifier: (qualifierEligible && qualifierEvaluated) ? qualifier : null,
            qualifierEligible,
            lifecycle,
        });
    }

    // For qualifier-eligible leads, qualifier.why_now ALREADY explains the
    // strategic timing — surfacing a second generic reasoning on top would
    // just dilute that signal. Skip those alerts; everything else (warm
    // already-converted leads with no qualifier) gets the generic pass.
    if (alertId && draft.joined && !qualifierEligible) {
        const priorCount = Array.isArray(recentInboundMessages) ? recentInboundMessages.length : 0;
        const priorText = priorCount > 0
            ? `\nPrior unanswered messages from ${leadName}:\n${recentInboundMessages.map(m => `- "${truncate(replaceIgMediaMarkers(m.text || ''), 200)}"`).join('\n')}`
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
