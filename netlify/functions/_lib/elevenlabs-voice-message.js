const { createHash, randomUUID } = require('crypto');

const DEFAULT_SHANNON_PROFESSIONAL_VOICE_ID = 'UHnJrglEof8vTMenwnVm';
const DEFAULT_MODEL_ID = 'eleven_multilingual_v2';
const DEFAULT_OUTPUT_FORMAT = 'pcm_16000';
// Exact settings from the five Cocos clips Shannon approved on 2026-07-24.
const DEFAULT_STABILITY = 0.5;
const DEFAULT_SIMILARITY_BOOST = 0.75;
const DEFAULT_STYLE = 0;
const MAX_TTS_CHARS = 3500;
const MIN_VOICE_NOTE_WORDS = 34;
const MAX_VOICE_THOUGHT_PAUSE_MS = 1500;
const SHAN_N_SUNNY_GRAPH_ACCOUNT_IDS = new Set(['17841415641641750']);
const COCOS_GRAPH_ACCOUNT_IDS = new Set(['17841435394720504', '26328183736859579']);
const MANUAL_AI_AUTHENTICITY_VOICE_SCRIPT = "hey, yep it's Shannon. I do use a bit of help organising my inbox because it gets busy, but the coaching and support inside Balance is me.";

function cleanString(value, max = 500) {
    return String(value || '').trim().slice(0, max);
}

const SPOKEN_NUMBERS_UNDER_100 = [
    'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
    'seventeen', 'eighteen', 'nineteen', 'twenty', 'twenty-one', 'twenty-two',
    'twenty-three', 'twenty-four', 'twenty-five', 'twenty-six', 'twenty-seven',
    'twenty-eight', 'twenty-nine', 'thirty', 'thirty-one', 'thirty-two',
    'thirty-three', 'thirty-four', 'thirty-five', 'thirty-six', 'thirty-seven',
    'thirty-eight', 'thirty-nine', 'forty', 'forty-one', 'forty-two', 'forty-three',
    'forty-four', 'forty-five', 'forty-six', 'forty-seven', 'forty-eight',
    'forty-nine', 'fifty', 'fifty-one', 'fifty-two', 'fifty-three', 'fifty-four',
    'fifty-five', 'fifty-six', 'fifty-seven', 'fifty-eight', 'fifty-nine',
    'sixty', 'sixty-one', 'sixty-two', 'sixty-three', 'sixty-four', 'sixty-five',
    'sixty-six', 'sixty-seven', 'sixty-eight', 'sixty-nine', 'seventy',
    'seventy-one', 'seventy-two', 'seventy-three', 'seventy-four', 'seventy-five',
    'seventy-six', 'seventy-seven', 'seventy-eight', 'seventy-nine', 'eighty',
    'eighty-one', 'eighty-two', 'eighty-three', 'eighty-four', 'eighty-five',
    'eighty-six', 'eighty-seven', 'eighty-eight', 'eighty-nine', 'ninety',
    'ninety-one', 'ninety-two', 'ninety-three', 'ninety-four', 'ninety-five',
    'ninety-six', 'ninety-seven', 'ninety-eight', 'ninety-nine',
];

function speakNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value || '');
    if (Number.isInteger(number) && number >= 0 && number < 100) return SPOKEN_NUMBERS_UNDER_100[number];
    const [whole, decimal = ''] = String(value).split('.');
    if (decimal) {
        return `${speakNumber(whole)} point ${decimal.split('').map(digit => speakNumber(digit)).join(' ')}`;
    }
    return String(value);
}

function normalizeTtsPronunciation(text = '') {
    return String(text || '')
        .replace(/\b(\d{1,2}(?:\.\d+)?)\s*(?:kg|kgs|kilograms?)\b/gi, (_, amount) => `${speakNumber(amount)} kilos`)
        .replace(/(?:AU\s*)?\$(\d{1,2})(?:\.(\d{2}))?/gi, (_, dollars, cents) => {
            const spokenDollars = speakNumber(dollars);
            return cents && cents !== '00'
                ? `${spokenDollars} ${speakNumber(Number(cents))}`
                : `${spokenDollars} dollars`;
        });
}

function parseBoolean(value, fallback = false) {
    if (value == null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    const raw = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'on'].includes(raw)) return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(raw)) return false;
    return fallback;
}

function safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeAccountKey(value) {
    return String(value || '').trim().replace(/^@+/, '').toLowerCase();
}

function isAiAuthenticityQuestion(text = '') {
    const value = String(text || '').trim().toLowerCase();
    if (!value) return false;
    return /\b(are\s+(you|u)\s+(an?\s+)?(ai|bot|robot)|is\s+this\s+(an?\s+)?(ai|bot|automated)|am\s+i\s+(talking|speaking|chatting)\s+to\s+(an?\s+)?(ai|bot)|is\s+this\s+(really\s+)?shannon|real\s+person|human\s+or\s+(ai|bot))\b/i.test(value);
}

function hasPersonalGoalOrBlockerSignal(text = '') {
    const value = String(text || '').trim();
    if (value.length < 18) return false;
    return /\b(my goal|i(?:'m| am) trying|i want to|i need to|hoping to|would love to|struggl|stuck|keep falling|fall off|can(?:'t| not) stay|consisten|motivat|overwhelm|no time|busy|energy|confidence|lose weight|build muscle|get stronger|feel better|healthier|food|training)\b/i.test(value);
}

function hasAccountabilityConnectionSignal(text = '') {
    const value = String(text || '').trim();
    if (value.length < 12) return false;
    return /\b(accountab\w*|check[ -]?ins?|keep me on track|keep(?:ing)? me accountable|stay on track|follow[ -]?through)\b/i.test(value);
}

function hasHighSignalConsistencyBlocker(text = '') {
    const value = String(text || '').trim();
    if (value.length < 10) return false;
    return /\b(?:can(?:'t| not) stick|never stick|keep falling|fall off|keep stopping|always restart|can(?:'t| not) stay consistent|struggl\w* to stay consistent|routine\w* (?:go|fall|drop)\w* (?:off|sideways)|lose motivation|no accountability|things? (?:just )?get(?:s)? in the way|work (?:and|&) (?:the )?kids|kids (?:and|&) work|busy with (?:work|kids|family))\b/i.test(value);
}

function hasHighSignalGoalBlocker(text = '') {
    const value = String(text || '').trim();
    if (value.length < 10) return false;
    if (/\b(?:nothing (?:is )?(?:stopping|blocking|get(?:ting)? in the way)|no current (?:issue|blocker)|no(?:thing)? really gets? in the way|already (?:pretty )?consistent)\b/i.test(value)) {
        return false;
    }
    return hasHighSignalConsistencyBlocker(value)
        || /\b(?:struggl\w*|stuck|overwhelm\w*|procrastinat\w*|discourag\w*|lack(?:ing)? (?:time|energy|motivation|confidence)|low (?:energy|motivation|confidence)|no time|too busy|shift work|rotating shifts?|shifts? change|changing shifts?|schedule keeps?|caregiv\w*|kids?|children|family commitments?|family stuff|pain|injur\w*|sore|fatigue\w*|exhaust\w*|sleep|stress\w*|anxi\w*|nervous|self-conscious|embarrass\w*|confidence|motivat\w*|crav\w*|weekends?|food keeps?|routine|travel|gym anxiety|miss(?:ed|ing) (?:a )?(?:workout|session)|don['’]?t know (?:what|how|where)|not sure (?:what|how|where)|keeps? (?:me )?(?:stuck|stopping)|stops? me|holds? me back|gets? in the way|barrier|blocker)\b/i.test(value);
}

function hasQualifierPersonalEvidence(qualifier = {}) {
    const facts = safeObject(qualifier.facts);
    const relationshipChecklist = safeObject(facts.relationship_checklist);
    return [
        facts.current_state,
        facts.motivation,
        facts.history_blockers,
        facts.relationship_context,
        relationshipChecklist.stressors_frustrations,
    ]
        .some(value => cleanString(value, 500).length >= 12);
}

function hasGoalAndBlockerEvidence(qualifier = {}) {
    const facts = safeObject(qualifier.facts);
    const relationshipChecklist = safeObject(facts.relationship_checklist);
    const goal = cleanString(facts.current_state || facts.motivation || '', 500);
    const blocker = cleanString(
        facts.history_blockers
        || facts.relationship_context
        || relationshipChecklist.stressors_frustrations
        || '',
        500
    );
    return goal.length >= 8 && blocker.length >= 8;
}

function hasProgramExplanationSignal(text = '') {
    const value = String(text || '').trim();
    return /\b(?:personali[sz]ed (?:coaching|plans?)|how (?:does|would) (?:the )?(?:program|coaching) work|what(?:'s| is) included in (?:the )?(?:program|coaching)|tell me (?:more )?about (?:the )?(?:program|coaching))\b/i.test(value);
}

function hasVoiceTextFallbackSignal(text = '') {
    const value = String(text || '').trim();
    return /\b(?:can(?:'t| not) listen|unable to listen|don't send (?:a )?voice|do not send (?:a )?voice|text (?:me|it|instead)|write it (?:out|instead)|prefer (?:a )?text|no voice notes?)\b/i.test(value);
}

function resolvePersonalVoiceReplyPlan({
    channel = '',
    hasInstagramGraphRoute = false,
    linkedUserId = null,
    currentMessage = '',
    qualifier = {},
    meaningfulLeadReplyCount = 0,
    hasRecentVoiceMessage = false,
    inboundVoiceMessage = false,
    bypassRecentVoiceCooldownForInternalTest = false,
} = {}) {
    if (isAiAuthenticityQuestion(currentMessage)) {
        return {
            useSyntheticVoice: false,
            reason: '',
            syntheticVoiceForbidden: true,
            manualNativeVoiceRecommended: true,
            manualNativeVoiceReason: 'ai_authenticity_question',
            manualNativeVoiceScript: MANUAL_AI_AUTHENTICITY_VOICE_SCRIPT,
        };
    }

    if (hasVoiceTextFallbackSignal(currentMessage)) {
        return {
            useSyntheticVoice: false,
            reason: 'lead_requested_text_fallback',
            syntheticVoiceForbidden: false,
            manualNativeVoiceRecommended: false,
            manualNativeVoiceReason: '',
            manualNativeVoiceScript: '',
        };
    }

    const isUnlinkedInstagramLead = channel === 'instagram' && !linkedUserId;
    if (isUnlinkedInstagramLead && inboundVoiceMessage) {
        return {
            useSyntheticVoice: hasInstagramGraphRoute,
            reason: hasInstagramGraphRoute ? 'lead_continuing_voice_note_lane' : '',
            syntheticVoiceForbidden: false,
            manualNativeVoiceRecommended: !hasInstagramGraphRoute,
            manualNativeVoiceReason: hasInstagramGraphRoute ? '' : 'inbound_voice_requires_manual_route',
            manualNativeVoiceScript: '',
        };
    }

    const accountabilityConnection = hasAccountabilityConnectionSignal(currentMessage);
    const consistencyBlocker = hasHighSignalConsistencyBlocker(currentMessage);
    const goalBlocker = hasHighSignalGoalBlocker(currentMessage)
        && hasGoalAndBlockerEvidence(qualifier);
    const programExplanation = hasProgramExplanationSignal(currentMessage)
        && hasGoalAndBlockerEvidence(qualifier);
    const eligible = isUnlinkedInstagramLead
        && hasInstagramGraphRoute
        && (!hasRecentVoiceMessage || bypassRecentVoiceCooldownForInternalTest)
        && Number(meaningfulLeadReplyCount || 0) >= 2
        && (accountabilityConnection || consistencyBlocker || goalBlocker || programExplanation)
        && hasQualifierPersonalEvidence(qualifier);

    return {
        useSyntheticVoice: eligible,
        reason: eligible
            ? (accountabilityConnection
                ? 'lead_accountability_connection_moment'
                : (programExplanation
                    ? 'lead_program_explanation_moment'
                    : (consistencyBlocker ? 'lead_shared_consistency_blocker' : 'lead_shared_goal_blocker')))
            : '',
        syntheticVoiceForbidden: false,
        manualNativeVoiceRecommended: false,
        manualNativeVoiceReason: '',
        manualNativeVoiceScript: '',
    };
}

function preserveInitialCase(original, replacement) {
    const first = String(original || '').charAt(0);
    if (first && first === first.toLowerCase()) {
        return replacement.charAt(0).toLowerCase() + replacement.slice(1);
    }
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
}

function normalizeShannonVoiceContractions(text = '') {
    let value = String(text || '');
    const replacements = [
        [/\bcan\s+not\b/gi, "can't"],
        [/\bcannot\b/gi, "can't"],
        [/\bwould\s+not\b/gi, "wouldn't"],
        [/\bshould\s+not\b/gi, "shouldn't"],
        [/\bcould\s+not\b/gi, "couldn't"],
        [/\bwill\s+not\b/gi, "won't"],
        [/\bdo\s+not\b/gi, "don't"],
        [/\bdoes\s+not\b/gi, "doesn't"],
        [/\bdid\s+not\b/gi, "didn't"],
        [/\bis\s+not\b/gi, "isn't"],
        [/\bare\s+not\b/gi, "aren't"],
        [/\bwas\s+not\b/gi, "wasn't"],
        [/\bwere\s+not\b/gi, "weren't"],
        [/\bi\s+am\b/gi, "I'm"],
        [/\bi\s+have\b(?!\s+to\b)/gi, "I've"],
        [/\bi\s+will\b/gi, "I'll"],
        [/\bi\s+would\b/gi, "I'd"],
        [/\bit\s+is\b/gi, "it's"],
        [/\bthat\s+is\b/gi, "that's"],
        [/\bthere\s+is\b/gi, "there's"],
        [/\bwhat\s+is\b/gi, "what's"],
        [/\bwho\s+is\b/gi, "who's"],
        [/\bwhere\s+is\b/gi, "where's"],
        [/\bhere\s+is\b/gi, "here's"],
        [/\byou\s+are\b/gi, "you're"],
        [/\byou\s+have\b(?!\s+to\b)/gi, "you've"],
        [/\byou\s+will\b/gi, "you'll"],
        [/\bwe\s+are\b/gi, "we're"],
        [/\bwe\s+have\b(?!\s+to\b)/gi, "we've"],
        [/\bwe\s+will\b/gi, "we'll"],
        [/\bthey\s+are\b/gi, "they're"],
        [/\bthey\s+have\b(?!\s+to\b)/gi, "they've"],
        [/\bthey\s+will\b/gi, "they'll"],
        [/\bwouldnt\b/gi, "wouldn't"],
        [/\bshouldnt\b/gi, "shouldn't"],
        [/\bcouldnt\b/gi, "couldn't"],
        [/\bdont\b/gi, "don't"],
        [/\bdoesnt\b/gi, "doesn't"],
        [/\bdidnt\b/gi, "didn't"],
        [/\bcant\b/gi, "can't"],
        [/\bwont\b/gi, "won't"],
        [/\bisnt\b/gi, "isn't"],
    ];
    for (const [pattern, replacement] of replacements) {
        value = value.replace(pattern, match => preserveInitialCase(match, replacement));
    }
    return value;
}

function resolveVoiceId(alertData = {}) {
    return cleanString(
        alertData.elevenlabs_voice_id
        || alertData.elevenLabsVoiceId
        || process.env.ELEVENLABS_SHANNON_PROFESSIONAL_VOICE_ID
        || process.env.ELEVENLABS_VOICE_ID
        || DEFAULT_SHANNON_PROFESSIONAL_VOICE_ID,
        120
    );
}

function resolveModelId(alertData = {}) {
    return cleanString(
        alertData.elevenlabs_model_id
        || alertData.elevenLabsModelId
        || process.env.ELEVENLABS_TTS_MODEL_ID
        || DEFAULT_MODEL_ID,
        120
    );
}

function resolveOutputFormat(alertData = {}) {
    return cleanString(
        alertData.elevenlabs_output_format
        || process.env.ELEVENLABS_TTS_OUTPUT_FORMAT
        || DEFAULT_OUTPUT_FORMAT,
        80
    );
}

function isVoiceMessageRequested(alertData = {}) {
    return parseBoolean(
        alertData.outbound_voice_message
        ?? alertData.outboundVoiceMessage
        ?? alertData.voice_reply_enabled
        ?? alertData.voiceReplyEnabled,
        false
    );
}

function resolveOutboundVoiceMessageConfig(alertData = {}, { shouldUseGraph = false, channel = '' } = {}) {
    const enabled = isVoiceMessageRequested(alertData);
    if (!enabled) return { enabled: false };
    if (channel !== 'instagram' || !shouldUseGraph) {
        return {
            enabled: true,
            available: false,
            blockedReason: 'voice_messages_require_instagram_graph',
        };
    }
    return {
        enabled: true,
        available: true,
        voiceId: resolveVoiceId(alertData),
        modelId: resolveModelId(alertData),
        outputFormat: resolveOutputFormat(alertData),
        reason: cleanString(alertData.outbound_voice_message_reason || alertData.voice_reply_reason || '', 160),
    };
}

function ensureNaturalVoiceHesitation(text = '') {
    const value = String(text || '').trim();
    if (!value || /\b(?:um+|ah+)\b/i.test(value)) return value;

    const paragraphBreak = value.indexOf('\n\n');
    if (paragraphBreak >= 0) {
        return `${value.slice(0, paragraphBreak + 2)}Um... ${value.slice(paragraphBreak + 2)}`;
    }
    const sentenceBreak = value.search(/[.!?]\s+(?=[A-Za-z])/);
    if (sentenceBreak >= 0) {
        const splitAt = sentenceBreak + 1;
        return `${value.slice(0, splitAt)} Um...${value.slice(splitAt)}`;
    }
    const comma = value.indexOf(',');
    if (comma >= 8) {
        return `${value.slice(0, comma + 1)} um...${value.slice(comma + 1)}`;
    }
    return `Ah... ${value}`;
}

function buildTtsText(messages = []) {
    const text = (Array.isArray(messages) ? messages : [messages])
        .map(value => String(value || '').trim())
        .filter(Boolean)
        .join('\n\n')
        .replace(/[^\S\n]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    return normalizeTtsPronunciation(
        ensureNaturalVoiceHesitation(normalizeShannonVoiceContractions(text))
    )
        .slice(0, MAX_TTS_CHARS);
}

function splitVoiceThoughtGroups(text = '') {
    return String(text || '')
        .split(/\n\s*\n+/)
        .map(value => value.trim())
        .filter(Boolean);
}

function resolveVoiceThoughtPauseMs(alertData = {}) {
    const requested = Number(
        alertData.outbound_voice_thought_pause_ms
        ?? alertData.voice_thought_pause_ms
        ?? 0
    );
    if (!Number.isFinite(requested) || requested <= 0) return 0;
    return Math.min(MAX_VOICE_THOUGHT_PAUSE_MS, Math.round(requested));
}

function resolveVoiceThoughtPausesMs(alertData = {}) {
    const requested = alertData.outbound_voice_thought_pauses_ms
        ?? alertData.voice_thought_pauses_ms;
    if (Array.isArray(requested)) {
        return requested
            .map(value => Number(value))
            .filter(value => Number.isFinite(value) && value > 0)
            .map(value => Math.min(MAX_VOICE_THOUGHT_PAUSE_MS, Math.round(value)));
    }
    const fallback = resolveVoiceThoughtPauseMs(alertData);
    return fallback > 0 ? [fallback] : [];
}

function buildSsmlPausedVoiceText(thoughtGroups = [], pauseSchedule = []) {
    const groups = (Array.isArray(thoughtGroups) ? thoughtGroups : [])
        .map(value => String(value || '').trim())
        .filter(Boolean);
    const pauses = Array.isArray(pauseSchedule) ? pauseSchedule : [pauseSchedule];
    if (groups.length < 2 || !pauses.length) return groups.join(' ');
    return groups.map((group, index) => {
        if (index >= groups.length - 1) return group;
        const requested = Number(pauses[Math.min(index, pauses.length - 1)]) || 0;
        const clamped = Math.min(MAX_VOICE_THOUGHT_PAUSE_MS, Math.max(0, Math.round(requested)));
        if (!clamped) return group;
        const seconds = (clamped / 1000).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
        return `${group} <break time="${seconds}s" />`;
    }).join(' ');
}

function unwrapPcmWav(wavBuffer) {
    const wav = Buffer.isBuffer(wavBuffer) ? wavBuffer : Buffer.from(wavBuffer || []);
    if (wav.length < 44 || wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') {
        throw new Error('Expected PCM WAV audio for thought-pause assembly');
    }
    return wav.subarray(44);
}

function assemblePcmThoughtGroups(groupWavs = [], sampleRate = 16000, pauseMs = 0) {
    const groups = groupWavs.map(unwrapPcmWav);
    if (!groups.length) throw new Error('No voice thought groups were generated');
    const pauseSchedule = Array.isArray(pauseMs) ? pauseMs : [pauseMs];
    const pcmParts = [];
    groups.forEach((group, index) => {
        if (index > 0 && pauseSchedule.length) {
            const requestedPause = Number(pauseSchedule[Math.min(index - 1, pauseSchedule.length - 1)]) || 0;
            const silenceBytes = Math.max(0, Math.round(sampleRate * 2 * (requestedPause / 1000)));
            if (silenceBytes > 0) pcmParts.push(Buffer.alloc(silenceBytes));
        }
        pcmParts.push(group);
    });
    return wrapPcm16LeAsWav(Buffer.concat(pcmParts), sampleRate, 1);
}

async function synthesizeThoughtGroups(thoughtGroups = [], generate, concurrency = 2) {
    const results = [];
    const batchSize = Math.max(1, Math.min(2, Number(concurrency) || 2));
    for (let index = 0; index < thoughtGroups.length; index += batchSize) {
        const batch = thoughtGroups.slice(index, index + batchSize);
        results.push(...await Promise.all(batch.map(generate)));
    }
    return results;
}

function countVoiceScriptWords(text = '') {
    return (String(text || '').match(/[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)*/g) || []).length;
}

function hasWrittenLaughter(text = '') {
    return /\b(?:ha|hah[a-z]*|ahah[a-z]*|heh[a-z]*|lol+|lmao)\b/i.test(String(text || ''));
}

function countVoiceThinkingBeats(text = '') {
    // Avoid counting "like" here because ordinary comparisons such as
    // "sounds like me" are not spoken imperfections.
    return (String(text || '').match(/\b(?:um+|ah+|okay|yeah|honestly|anyway|alright|you know|i mean)\b/gi) || []).length;
}

function hasCoreVoiceHesitation(text = '') {
    return /\b(?:um+|ah+)\b/i.test(String(text || ''));
}

function inspectVoiceScriptQuality(text = '') {
    const value = String(text || '').trim();
    const wordCount = countVoiceScriptWords(value);
    const thinkingBeatCount = countVoiceThinkingBeats(value);
    const issues = [];
    if (wordCount < MIN_VOICE_NOTE_WORDS) {
        issues.push(`voice note is ${wordCount} words; minimum is ${MIN_VOICE_NOTE_WORDS}`);
    }
    if (!hasCoreVoiceHesitation(value)) {
        issues.push('voice note needs at least one natural um or ah');
    }
    if (thinkingBeatCount < 3) {
        issues.push(`voice note has ${thinkingBeatCount} thinking beat${thinkingBeatCount === 1 ? '' : 's'}; minimum is 3`);
    }
    if (hasWrittenLaughter(value)) {
        issues.push('voice note contains written laughter');
    }
    return {
        valid: issues.length === 0,
        wordCount,
        thinkingBeatCount,
        issues,
    };
}

function resolveAudioUploadFormat(outputFormat, contentType = '') {
    const format = cleanString(outputFormat || DEFAULT_OUTPUT_FORMAT, 80).toLowerCase();
    const pcmMatch = format.match(/^pcm_(\d{4,6})$/);
    if (pcmMatch) {
        return {
            contentType: 'audio/wav',
            extension: 'wav',
            sourceEncoding: 'pcm_s16le',
            sampleRate: Number(pcmMatch[1]),
        };
    }
    if (format.includes('mp3') || /mpeg|mp3/i.test(contentType)) {
        return {
            contentType: contentType || 'audio/mpeg',
            extension: 'mp3',
            sourceEncoding: 'encoded',
            sampleRate: null,
        };
    }
    return {
        contentType: contentType || 'audio/mpeg',
        extension: 'mp3',
        sourceEncoding: 'encoded',
        sampleRate: null,
    };
}

function wrapPcm16LeAsWav(pcmBuffer, sampleRate = 16000, channels = 1) {
    const pcm = Buffer.isBuffer(pcmBuffer) ? pcmBuffer : Buffer.from(pcmBuffer || []);
    const byteRate = sampleRate * channels * 2;
    const blockAlign = channels * 2;
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + pcm.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(pcm.length, 40);
    return Buffer.concat([header, pcm]);
}

async function secretValueForKey(key, supabaseQuery) {
    const cleanKey = cleanString(key, 180);
    if (!cleanKey || typeof supabaseQuery !== 'function') return '';
    try {
        const rows = await supabaseQuery(`app_private_secrets?select=value&key=eq.${encodeURIComponent(cleanKey)}&limit=1`);
        return cleanString(rows?.[0]?.value || '', 5000);
    } catch (err) {
        console.warn(`[elevenlabs-voice] secret lookup failed for ${cleanKey}:`, err.message || err);
        return '';
    }
}

async function resolveElevenLabsApiKey(supabaseQuery) {
    const envKey = cleanString(process.env.ELEVENLABS_API_KEY || process.env.XI_API_KEY || '', 5000);
    if (envKey) return envKey;
    return await secretValueForKey('elevenlabs_api_key', supabaseQuery)
        || await secretValueForKey('ELEVENLABS_API_KEY', supabaseQuery);
}

async function generateElevenLabsSpeech({ text, voiceId, modelId, outputFormat, supabaseQuery, alertData = {} }) {
    const apiKey = await resolveElevenLabsApiKey(supabaseQuery);
    if (!apiKey) throw new Error('ELEVENLABS_API_KEY not configured');
    if (!voiceId) throw new Error('ElevenLabs voice id missing');
    if (!text) throw new Error('Voice message text is empty');

    const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat || DEFAULT_OUTPUT_FORMAT)}`,
        {
            method: 'POST',
            headers: {
                'xi-api-key': apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text,
                model_id: modelId || DEFAULT_MODEL_ID,
                voice_settings: {
                    stability: Number.isFinite(Number(alertData.elevenlabs_stability)) ? Number(alertData.elevenlabs_stability) : DEFAULT_STABILITY,
                    similarity_boost: Number.isFinite(Number(alertData.elevenlabs_similarity_boost)) ? Number(alertData.elevenlabs_similarity_boost) : DEFAULT_SIMILARITY_BOOST,
                    style: Number.isFinite(Number(alertData.elevenlabs_style)) ? Number(alertData.elevenlabs_style) : DEFAULT_STYLE,
                    use_speaker_boost: alertData.elevenlabs_speaker_boost == null
                        ? true
                        : parseBoolean(alertData.elevenlabs_speaker_boost, true),
                },
            }),
        }
    );
    const responseContentType = res.headers.get('content-type') || 'audio/mpeg';
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (!res.ok) {
        const detail = buffer.toString('utf8').slice(0, 400);
        throw new Error(`ElevenLabs ${res.status}: ${detail}`);
    }
    if (!buffer.length) throw new Error('ElevenLabs returned empty audio');
    const uploadFormat = resolveAudioUploadFormat(outputFormat, responseContentType);
    if (uploadFormat.sourceEncoding === 'pcm_s16le') {
        return {
            buffer: wrapPcm16LeAsWav(buffer, uploadFormat.sampleRate || 16000, 1),
            contentType: uploadFormat.contentType,
            extension: uploadFormat.extension,
            sourceEncoding: uploadFormat.sourceEncoding,
            sampleRate: uploadFormat.sampleRate,
        };
    }
    return {
        buffer,
        contentType: uploadFormat.contentType,
        extension: uploadFormat.extension,
        sourceEncoding: uploadFormat.sourceEncoding,
        sampleRate: uploadFormat.sampleRate,
    };
}

async function uploadVoiceNoteToB2({ buffer, contentType = 'audio/mpeg', extension = 'mp3', alertId = '' }) {
    const keyId = cleanString(process.env.B2_KEY_ID || '', 5000);
    const appKey = cleanString(process.env.B2_APPLICATION_KEY || '', 5000);
    const bucketId = cleanString(process.env.B2_BUCKET_ID || '', 500);
    const bucketName = cleanString(process.env.B2_BUCKET_NAME || '', 500);
    if (!keyId || !appKey || !bucketId || !bucketName) {
        throw new Error('B2 storage configuration missing');
    }

    const authRes = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
        headers: {
            Authorization: `Basic ${Buffer.from(`${keyId}:${appKey}`).toString('base64')}`,
        },
    });
    const authText = await authRes.text();
    if (!authRes.ok) throw new Error(`B2 authorize ${authRes.status}: ${authText.slice(0, 240)}`);
    const auth = JSON.parse(authText || '{}');

    const uploadUrlRes = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_upload_url`, {
        method: 'POST',
        headers: {
            Authorization: auth.authorizationToken,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bucketId }),
    });
    const uploadUrlText = await uploadUrlRes.text();
    if (!uploadUrlRes.ok) throw new Error(`B2 upload-url ${uploadUrlRes.status}: ${uploadUrlText.slice(0, 240)}`);
    const upload = JSON.parse(uploadUrlText || '{}');

    const dateKey = new Date().toISOString().slice(0, 10);
    const cleanAlertId = cleanString(alertId, 80).replace(/[^a-zA-Z0-9_-]+/g, '-');
    const safeExtension = cleanString(extension, 12).replace(/[^a-zA-Z0-9]+/g, '').toLowerCase() || 'mp3';
    const fileName = `ai-voice-notes/${dateKey}/${Date.now()}-${cleanAlertId || 'alert'}-${randomUUID()}.${safeExtension}`;
    const sha1 = createHash('sha1').update(buffer).digest('hex');

    const uploadRes = await fetch(upload.uploadUrl, {
        method: 'POST',
        headers: {
            Authorization: upload.authorizationToken,
            'X-Bz-File-Name': encodeURIComponent(fileName),
            'Content-Type': contentType || 'audio/mpeg',
            'Content-Length': String(buffer.length),
            'X-Bz-Content-Sha1': sha1,
            'X-Bz-Info-upload-type': 'ai-coach-voice-note',
        },
        body: buffer,
    });
    const uploadedText = await uploadRes.text();
    if (!uploadRes.ok) throw new Error(`B2 upload ${uploadRes.status}: ${uploadedText.slice(0, 240)}`);
    const uploaded = JSON.parse(uploadedText || '{}');

    return {
        url: `${auth.downloadUrl}/file/${bucketName}/${fileName}`,
        fileName,
        fileId: uploaded.fileId || null,
        sizeBytes: buffer.length,
        contentType,
    };
}

async function createVoiceMessageAudio({ messages, alertId, alertData = {}, supabaseQuery }) {
    const text = buildTtsText(messages);
    const quality = inspectVoiceScriptQuality(text);
    if (!quality.valid) {
        const error = new Error(`Voice script quality failed: ${quality.issues.join('; ')}`);
        error.code = 'voice_script_quality_failed';
        error.voiceScriptQuality = quality;
        throw error;
    }
    const config = {
        voiceId: resolveVoiceId(alertData),
        modelId: resolveModelId(alertData),
        outputFormat: resolveOutputFormat(alertData),
    };
    const thoughtPausesMs = resolveVoiceThoughtPausesMs(alertData);
    const thoughtGroups = splitVoiceThoughtGroups(text);
    let speech;
    if (thoughtPausesMs.length > 0
        && thoughtGroups.length > 1
        && !/^eleven_v3$/i.test(config.modelId)) {
        // Keep the cloned voice in one continuous generation. Separate TTS
        // requests re-seed timbre and prosody at every pause.
        speech = await generateElevenLabsSpeech({
            text: buildSsmlPausedVoiceText(thoughtGroups, thoughtPausesMs),
            ...config,
            supabaseQuery,
            alertData,
        });
    } else {
        speech = await generateElevenLabsSpeech({
            text,
            ...config,
            supabaseQuery,
            alertData,
        });
    }
    const uploaded = await uploadVoiceNoteToB2({
        buffer: speech.buffer,
        contentType: speech.contentType || 'audio/mpeg',
        extension: speech.extension || 'mp3',
        alertId,
    });
    return {
        ...uploaded,
        text,
        voiceId: config.voiceId,
        modelId: config.modelId,
        outputFormat: config.outputFormat,
        sourceEncoding: speech.sourceEncoding || null,
        sampleRate: speech.sampleRate || null,
        thoughtGroupCount: thoughtPauseMs > 0 ? thoughtGroups.length : 1,
        thoughtPauseMs,
    };
}

function resolveCocosShanSunnyVoiceTestReason({ botAccount, igUsername, customData = {} } = {}) {
    const graph = safeObject(customData.instagram_graph);
    const bot = normalizeAccountKey(botAccount || customData.bot_account || graph.bot_account);
    const lead = normalizeAccountKey(igUsername || customData.ig_username || graph.ig_username || graph.username);
    const accountId = cleanString(
        customData.ig_graph_account_id
        || customData.ig_account_id
        || graph.ig_account_id
        || graph.account_id
        || graph.owner_id,
        120
    );
    const shanSunnyReceiver = bot === 'shan_n_sunny' || SHAN_N_SUNNY_GRAPH_ACCOUNT_IDS.has(accountId);
    if (shanSunnyReceiver && lead === 'cocos_pt_studio') return 'cocos_pt_studio_to_shan_n_sunny_test';

    const cocosReceiver = bot === 'cocos_pt_studio' || COCOS_GRAPH_ACCOUNT_IDS.has(accountId);
    if (cocosReceiver && lead === 'shan_n_sunny') return 'shan_n_sunny_to_cocos_pt_studio_test';

    return '';
}

function isCocosToShanSunnyVoiceTest(input = {}) {
    return !!resolveCocosShanSunnyVoiceTestReason(input);
}

module.exports = {
    DEFAULT_SHANNON_PROFESSIONAL_VOICE_ID,
    DEFAULT_OUTPUT_FORMAT,
    DEFAULT_STABILITY,
    DEFAULT_SIMILARITY_BOOST,
    DEFAULT_STYLE,
    MIN_VOICE_NOTE_WORDS,
    buildTtsText,
    normalizeTtsPronunciation,
    inspectVoiceScriptQuality,
    ensureNaturalVoiceHesitation,
    createVoiceMessageAudio,
    isCocosToShanSunnyVoiceTest,
    isAiAuthenticityQuestion,
    parseBoolean,
    resolvePersonalVoiceReplyPlan,
    hasHighSignalGoalBlocker,
    resolveCocosShanSunnyVoiceTestReason,
    resolveOutboundVoiceMessageConfig,
    _test: {
        isVoiceMessageRequested,
        hasAccountabilityConnectionSignal,
        hasProgramExplanationSignal,
        hasVoiceTextFallbackSignal,
        hasHighSignalConsistencyBlocker,
        hasHighSignalGoalBlocker,
        hasPersonalGoalOrBlockerSignal,
        hasQualifierPersonalEvidence,
        hasWrittenLaughter,
        countVoiceThinkingBeats,
        hasCoreVoiceHesitation,
        normalizeAccountKey,
        normalizeShannonVoiceContractions,
        resolveCocosShanSunnyVoiceTestReason,
        resolveAudioUploadFormat,
        resolveModelId,
        resolveOutputFormat,
        resolveVoiceId,
        wrapPcm16LeAsWav,
        splitVoiceThoughtGroups,
        resolveVoiceThoughtPauseMs,
        resolveVoiceThoughtPausesMs,
        buildSsmlPausedVoiceText,
        unwrapPcmWav,
    assemblePcmThoughtGroups,
    synthesizeThoughtGroups,
    },
};
