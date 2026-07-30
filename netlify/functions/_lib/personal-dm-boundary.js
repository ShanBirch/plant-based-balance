'use strict';

function cleanText(value) {
    return String(value || '')
        .replace(/\[(?:PHOTO|VIDEO|AUDIO):[^\]]+\]/gi, ' ')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

function collectAlertInboundText(data = {}) {
    const evidence = data.draft_evidence || {};
    const decode = data.media_decode || data.mediaDecode || {};
    const transcriptRows = Array.isArray(decode.audio_transcripts) ? decode.audio_transcripts : [];
    const recentRows = Array.isArray(data.recent_inbound_messages) ? data.recent_inbound_messages : [];
    const priorRows = Array.isArray(evidence.prior_unanswered) ? evidence.prior_unanswered : [];
    return [
        evidence.current_message,
        data.message_preview,
        data.client_message,
        ...recentRows.map(row => row?.text || row?.message),
        ...priorRows.map(row => row?.text || row?.message),
        ...transcriptRows.map(row => row?.text || row?.transcript),
    ].map(cleanText).filter(Boolean).join('\n');
}

function hasBusinessConversationContext(value) {
    const text = cleanText(value);
    if (!text) return false;
    return /\b(?:balance|founders? pass|starter coaching|coach(?:ing)?|work with you|fitness|health|training|workouts?|gym|exercise|nutrition|meal plan|food structure|consistency|accountability|program|six[- ]week|price|pricing|cost|checkout|sign up|signup|join|membership|offer|sales|consult(?:ation)?|help (?:me|with)|get started)\b/i.test(text);
}

function hasBusinessCallRequest(value) {
    const text = cleanText(value);
    if (!text) return false;
    const business = '(?:balance|founders? pass|starter coaching|coach(?:ing)?|work with you|fitness|health|training|workouts?|nutrition|food structure|consistency|accountability|program|offer|sales|consult(?:ation)?|help me|get started)';
    const call = '(?:call|video call|phone call|chat|talk|speak)';
    return new RegExp(`\\b${business}\\b.{0,100}\\b${call}\\b|\\b${call}\\b.{0,100}\\b${business}\\b`, 'i').test(text);
}

function hasPersonalCallRequest(value) {
    const text = cleanText(value);
    if (!text) return false;
    return /\b(?:video chat|video call|facetime|discord|whats\s*app|face[ -]to[ -]face|call me|call you|call through here|chat when you get home|talk when you get home|jump on (?:a )?(?:video )?call|see (?:you|your .*face)|you(?:'re| are) not shy|what(?:'s| is) your discord|discord (?:name|handle)|hang out)\b/i.test(text);
}

function hasFlirtationSignal(value) {
    const text = cleanText(value);
    if (!text) return false;
    return /\b(?:flirt(?:ing|y)?|thought you were cute|think (?:i'm|im|i am|you(?:'re| are)) cute|you(?:'re| are) (?:cute|gorgeous|hot|sexy|handsome)|i(?:'m| am) (?:cute|pretty|gorgeous|hot|sexy)|sexy(?:\s+x+)?|cute awkward|awkward cute|ador(?:e|ing) you|date me|go on a date|kiss(?:ing)? you|attracted to you|seeing you at the beach|send me (?:some )?(?:beach )?photos?|see (?:your|the) cute .*face)\b/i.test(text);
}

function hasSexualPersonalEscalation(value) {
    const text = cleanText(value);
    if (!text) return false;
    return /\b(?:horny|turned on|sext(?:ing)?|send (?:me )?nudes?|naked (?:pic|photo)|sexual(?:ly)?|are you hung|how hung are you|hook up|sleep with you|come over|come to bed)\b/i.test(text);
}

function hasAutomatedPersonalReciprocation(value) {
    const text = cleanText(value);
    if (!text) return false;
    return /\b(?:when were you thinking|call me when|call you when|let(?:'s|s) do it through here|what(?:'s| is) your discord|my discord|add me on discord|whats\s*app me|you(?:'re| are) (?:cute|gorgeous|hot|sexy|pretty)|awkward[- ]?cute|cute.*sticking|i(?:'ll| will) make it up to you|owe you one|send (?:you|me) (?:some )?(?:beach )?photos?|see you face[ -]to[ -]face)\b/i.test(text);
}

function classifyPersonalDmBoundary({ inboundText = '', outboundText = '', linkedUserId = null } = {}) {
    const inbound = cleanText(inboundText);
    const outbound = cleanText(outboundText);
    const businessCall = hasBusinessCallRequest(inbound);
    const personalCall = hasPersonalCallRequest(inbound);
    const sexualEscalation = hasSexualPersonalEscalation(inbound) || hasSexualPersonalEscalation(outbound);
    const flirtation = hasFlirtationSignal(inbound) || hasFlirtationSignal(outbound);
    const personalReciprocation = hasAutomatedPersonalReciprocation(outbound);

    if (personalCall && !businessCall) {
        return {
            requires_manual: true,
            reason: 'personal_social_call_manual_only',
            label: 'Personal or social call request is not a Balance sales call',
        };
    }
    if (sexualEscalation) {
        return {
            requires_manual: true,
            reason: 'sexual_or_personal_escalation_manual_only',
            label: 'Sexual or personal escalation requires Shannon and stops AI replies',
        };
    }
    if (flirtation || (personalReciprocation && !businessCall)) {
        return {
            requires_manual: true,
            reason: 'flirtation_or_personal_relationship_manual_only',
            label: 'Flirtation or personal relationship conversation requires Shannon',
        };
    }
    return { requires_manual: false, reason: null };
}

module.exports = {
    cleanText,
    collectAlertInboundText,
    hasBusinessConversationContext,
    hasBusinessCallRequest,
    hasPersonalCallRequest,
    hasFlirtationSignal,
    hasSexualPersonalEscalation,
    hasAutomatedPersonalReciprocation,
    classifyPersonalDmBoundary,
};
