const test = require('node:test');
const assert = require('node:assert/strict');

const boundary = require('../netlify/functions/_lib/personal-dm-boundary');
const clientContext = require('../netlify/functions/_lib/client-context');
const manager = require('../netlify/functions/client-lead-manager')._test;
const igDraft = require('../netlify/functions/ig-instant-draft')._test;

function leadAlert(message, suggestedMessage = 'sounds good') {
    return {
        id: 'alert-erika',
        status: 'pending',
        alert_type: 'ig_incoming_dm',
        client_id: null,
        client_name: 'Erika',
        suggested_message: suggestedMessage,
        data: {
            channel: 'instagram',
            lead_stage: 'qualifying',
            message_preview: message,
            draft_evidence: { current_message: message },
        },
    };
}

test('routes a personal video-chat request to Shannon instead of treating it as a sales call', () => {
    const result = boundary.classifyPersonalDmBoundary({
        inboundText: "would you like to video chat? you can see the cute awkward face to face",
        outboundText: "yeah I'm down. when were you thinking?",
    });
    assert.equal(result.requires_manual, true);
    assert.equal(result.reason, 'personal_social_call_manual_only');
});

test('routes explicit flirtation even when no call is requested', () => {
    const result = manager.classifyNeedsYou(leadAlert(
        'I thought you were cute and I am getting kind of flirty',
        'awkward-cute is definitely sticking now'
    ));
    assert.equal(result.shouldRoute, true);
    assert.ok(result.reasons.includes('flirtation_or_personal_relationship_manual_only'));
});

test('stops automated replies when a lead sexually escalates before attempting a call', () => {
    const inbound = [
        'Im horny hungover and hungry',
        'Yeh bro',
        'Hello',
    ].join('\n');
    const result = boundary.classifyPersonalDmBoundary({
        inboundText: inbound,
        outboundText: 'Haha yeh I am here',
    });
    assert.equal(boundary.hasSexualPersonalEscalation(inbound), true);
    assert.equal(result.requires_manual, true);
    assert.equal(result.reason, 'sexual_or_personal_escalation_manual_only');
});

test('routes terse flirtation to Shannon, including for linked clients', () => {
    const result = boundary.classifyPersonalDmBoundary({
        inboundText: 'Sexy X',
        outboundText: 'Say less',
        linkedUserId: 'client-harold',
    });
    assert.equal(result.requires_manual, true);
    assert.equal(result.reason, 'flirtation_or_personal_relationship_manual_only');
});

test('does not treat uncertainty phrasing as flirtation', () => {
    const result = boundary.classifyPersonalDmBoundary({
        inboundText: "back when I drank I'm pretty sure that caused my cravings",
        outboundText: 'three proper meals is already a decent base though',
    });
    assert.equal(result.requires_manual, false);
});

test('routes explicit personal sexual questions to Shannon', () => {
    const result = boundary.classifyPersonalDmBoundary({
        inboundText: 'I saw the Balance workout. Are you hung?',
    });
    assert.equal(result.requires_manual, true);
    assert.equal(result.reason, 'sexual_or_personal_escalation_manual_only');
});

test('does not confuse ordinary coaching language about libido with sexual escalation', () => {
    const result = boundary.classifyPersonalDmBoundary({
        inboundText: 'my libido has been low since changing my diet',
        outboundText: 'we can look at recovery and nutrition first',
    });
    assert.equal(result.requires_manual, false);
});

test('collects decoded voice-note text for the same boundary check', () => {
    const inbound = boundary.collectAlertInboundText({
        message_preview: '[AUDIO:https://example.com/voice.m4a]',
        media_decode: {
            audio_transcripts: [{ text: 'send me photos from the beach, I would like seeing you there' }],
        },
    });
    assert.match(inbound, /send me photos from the beach/i);
    assert.equal(boundary.classifyPersonalDmBoundary({ inboundText: inbound }).requires_manual, true);
});

test('allows a call that is explicitly about the paid Balance decision', () => {
    const inbound = 'could we do a video call to talk through the Founders Pass before I join?';
    assert.equal(boundary.hasBusinessCallRequest(inbound), true);
    assert.equal(boundary.classifyPersonalDmBoundary({ inboundText: inbound }).requires_manual, false);
    assert.equal(igDraft.isExplicitCallBookingRequest(inbound), true);
});

test('does not treat a social video chat as an approved booking handoff', () => {
    assert.equal(igDraft.isExplicitCallBookingRequest('would you like to video chat? you are not shy are you?'), false);
    assert.equal(igDraft.isExplicitCallBookingRequest('what is your Discord name?'), false);
});

test('does not block ordinary location wording', () => {
    const result = boundary.classifyPersonalDmBoundary({
        inboundText: 'where are you based?',
        outboundText: "I'm down in Tugun on the Gold Coast",
    });
    assert.equal(result.requires_manual, false);
});

test('generic manual-only thread flags are honoured', () => {
    assert.equal(clientContext.isAlwaysNeedsYouPerson({
        ig_username: 'veganswemo',
        custom_data: { manual_review_only: true },
    }), true);
    const manualAlert = leadAlert('have fun', 'enjoy your night');
    manualAlert.data.permanent_needs_you_draft_only = true;
    const manualResult = manager.classifyNeedsYou(manualAlert);
    assert.equal(manualResult.shouldRoute, true);
    assert.ok(manualResult.reasons.includes('always_needs_you_person'));
});
