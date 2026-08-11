const assert = require('assert');
const fs = require('fs');
const path = require('path');

const clientContext = require('../netlify/functions/_lib/client-context');
const manager = require('../netlify/functions/client-lead-manager')._test;
const clientContextSource = fs.readFileSync(path.join(__dirname, '../netlify/functions/_lib/client-context.js'), 'utf8');

assert.strictEqual(manager.resolveAiDraftReviewLimit(undefined), 8);
assert.strictEqual(manager.resolveAiDraftReviewLimit('0'), 0);
assert.strictEqual(manager.resolveAiDraftReviewLimit('3'), 3);
assert.strictEqual(manager.resolveAiDraftReviewLimit('200'), 80);
assert.strictEqual(manager.resolveAiDraftReviewLimit('bad'), 8);
assert.strictEqual(manager.resolveCleanLeadCloudFallbackLimit(undefined), 8);
assert.strictEqual(manager.resolveCleanLeadCloudFallbackLimit('0'), 0);
assert.strictEqual(manager.resolveCleanLeadCloudFallbackLimit('4'), 4);
assert.strictEqual(manager.resolveCleanLeadCloudFallbackLimit('200'), 80);
assert.strictEqual(manager.resolveCleanLeadCloudRepairLimit(undefined), 4);
assert.strictEqual(manager.resolveCleanLeadCloudRepairLimit('0'), 0);
assert.strictEqual(manager.resolveCleanLeadCloudRepairLimit('200'), 80);

function makeAlert(overrides = {}) {
    return {
        id: 'alert-1',
        status: 'pending',
        alert_type: 'ig_incoming_dm',
        client_id: null,
        client_name: 'Lead',
        description: '"hey"',
        suggested_message: 'hey, how are you going?',
        data: {
            channel: 'instagram',
            lead_stage: 'new',
            message_preview: 'hey',
        },
        ...overrides,
        data: {
            channel: 'instagram',
            lead_stage: 'new',
            message_preview: 'hey',
            ...(overrides.data || {}),
        },
    };
}

const nativeOpenerReviewContext = manager.buildDraftReviewContextBlocks(makeAlert({
    data: {
        draft_evidence: {
            current_message: 'Amazing session!',
            recent_timeline: 'Shannon: good session?',
            native_story_context: 'NATIVE STORY/POST OPENER CONTEXT: Shannon previously commented on their Instagram post.',
        },
    },
}));
assert.match(nativeOpenerReviewContext, /Native story\/post opener context/);
assert.match(nativeOpenerReviewContext, /NATIVE STORY\/POST OPENER CONTEXT/);

const staleNativeOpenerReviewContext = manager.buildDraftReviewContextBlocks(makeAlert({
    created_at: '2026-07-29T08:40:00.000Z',
    data: {
        source_inbound_created_at: '2026-07-29T08:39:00.000Z',
        draft_evidence: {
            current_message: 'Thank you 😊',
            recent_timeline: 'Shannon: these two are so cute haha\nLead: Thank you 😊',
            native_story_context: 'NATIVE STORY/POST OPENER CONTEXT:\nCaptured at: 2026-06-15T02:00:00.000Z.\nStory context: A person doing push-ups on parallel bars.',
        },
    },
}));
assert.doesNotMatch(staleNativeOpenerReviewContext, /push-ups on parallel bars/);
assert.strictEqual(manager.isNativeStoryContextCurrentForAlert(
    'Captured at: 2026-07-29T08:35:00.000Z.',
    makeAlert({ created_at: '2026-07-29T08:40:00.000Z' })
), true);

assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ client_name: 'Shane' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ profile_name: 'Fra' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ ig_username: 'francesca_balance' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ ig_username: 'cavazzanafrancesca' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ client_name: 'Kay' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ ig_username: 'kay_balance' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ client_name: 'Kayla' }), false);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ client_name: 'Nat' }), false);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ profile_name: 'Natalie' }), false);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ ig_username: 'nat_balance' }), false);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ client_name: 'Miranda' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ ig_username: 'miranda_balance' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({
    client_name: 'Miranda',
    custom_data: { client_manager_auto_reply_enabled: true },
}), false);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ client_name: 'Monica' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ ig_username: 'monica_balance' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ client_name: 'Dani' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ client_name: 'Daniela' }), false);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ client_name: 'Nate' }), false);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ client_name: 'Frank' }), false);
assert.strictEqual(clientContext.shouldBypassKayNeedsYouForProgramUpdateOrAppFix({
    record: { client_name: 'Kay' },
    currentMessage: 'Can you update my program for next week?',
}), true);
assert.strictEqual(clientContext.shouldBypassKayNeedsYouForProgramUpdateOrAppFix({
    record: { client_name: 'Kay' },
    currentMessage: 'The Balance app login is not working.',
    draftText: 'Fixed it now, try logging in again.',
}), false);
assert.strictEqual(clientContext.shouldBypassKayNeedsYouForProgramUpdateOrAppFix({
    record: { client_name: 'Kay' },
    currentMessage: 'The Balance app login is not working.',
    draftText: 'Fixed it now, try logging in again.',
    alertData: { app_problem_fix_verified_at: '2026-07-02T08:00:00.000Z' },
}), true);

assert.strictEqual(manager.isAcquisitionLeadAlert(makeAlert()), true);
assert.strictEqual(manager.isAcquisitionLeadAlert(makeAlert({
    client_id: 'client-1',
    data: { lead_stage: 'paying' },
})), false);

const coldLeadNamedShane = manager.classifyNeedsYou(makeAlert({ client_name: 'Shane' }));
assert.strictEqual(coldLeadNamedShane.shouldRoute, false, 'unlinked leads are manager-owned even when a name matches a permanent client');

const shane = manager.classifyNeedsYou(makeAlert({
    client_id: 'client-shane',
    client_name: 'Shane',
    data: { lead_stage: 'paying' },
}));
assert.strictEqual(shane.shouldRoute, true);
assert.ok(shane.reasons.includes('always_needs_you_person'));
assert.match(shane.label, /Kay/);
assert.match(shane.label, /Miranda/);
assert.match(shane.label, /Monica/);
assert.doesNotMatch(shane.label, /Nat/);

const nat = manager.classifyNeedsYou(makeAlert({
    client_id: 'client-nat',
    client_name: 'Nat',
    data: { lead_stage: 'paying' },
}));
assert.ok(!nat.reasons.includes('always_needs_you_person'));
assert.strictEqual(nat.shouldRoute, true, 'every current client must be routed to Needs You');
assert.ok(nat.reasons.includes('linked_client_requires_shannon_approval'));

const miranda = manager.classifyNeedsYou(makeAlert({
    alert_type: 'incoming_dm',
    client_id: 'client-miranda',
    client_name: 'Miranda',
    data: { channel: 'in_app', lead_stage: 'paying' },
}));
assert.strictEqual(miranda.shouldRoute, true);
assert.ok(miranda.reasons.includes('always_needs_you_person'));

const managerOwnedMiranda = manager.classifyNeedsYou(makeAlert({
    client_id: 'client-miranda',
    client_name: 'Miranda',
    suggested_message: 'hey',
    data: {
        channel: 'instagram',
        lead_stage: 'paying',
        last_outbound_message: 'hey, hope you are feeling better',
        client_manager_auto_reply_enabled: true,
        custom_data: { client_manager_auto_reply_enabled: true },
    },
}));
assert.strictEqual(managerOwnedMiranda.shouldRoute, false);
assert.ok(!managerOwnedMiranda.reasons.includes('linked_client_requires_shannon_approval'));
assert.ok(!managerOwnedMiranda.reasons.includes('always_needs_you_person'));

const permanentStamp = manager.buildNeedsYouData(makeAlert({
    alert_type: 'incoming_dm',
    client_id: 'client-miranda',
    client_name: 'Miranda',
    data: { channel: 'in_app', lead_stage: 'paying' },
}), miranda);
assert.strictEqual(permanentStamp.needs_you_required, true);
assert.strictEqual(permanentStamp.operator_queue, 'needs_you');
assert.strictEqual(permanentStamp.needs_shannon_approval, true);
assert.strictEqual(permanentStamp.needs_you_reason, 'linked_client_requires_shannon_approval');
assert.strictEqual(permanentStamp.permanent_needs_you_draft_only, true);
assert.strictEqual(permanentStamp.outbound_attempted, false);
assert.strictEqual(permanentStamp.codex_review.reason, 'linked_client_requires_shannon_approval');
assert.strictEqual(permanentStamp.codex_review.decision, 'needs_you_linked_client_draft_only');

const mirandaAppDeflection = manager.classifyNeedsYou(makeAlert({
    alert_type: 'incoming_dm',
    client_id: 'client-miranda',
    client_name: 'Miranda',
    suggested_message: 'Try again later, but if it still sticks send me a screenshot.',
    data: {
        channel: 'in_app',
        lead_stage: 'in_app',
        message_preview: 'The custom workout start button won’t load the next page.',
    },
}));
assert.strictEqual(mirandaAppDeflection.shouldRoute, true);
assert.ok(mirandaAppDeflection.reasons.includes('app_problem_needs_fix_check'));

const mirandaUnverifiedFixClaim = manager.classifyNeedsYou(makeAlert({
    alert_type: 'incoming_dm',
    client_id: 'client-miranda',
    client_name: 'Miranda',
    suggested_message: 'Fixed it now, try again.',
    data: {
        channel: 'in_app',
        lead_stage: 'in_app',
        message_preview: 'The custom workout start button won’t load the next page.',
    },
}));
assert.strictEqual(mirandaUnverifiedFixClaim.shouldRoute, true);
assert.ok(mirandaUnverifiedFixClaim.reasons.includes('app_problem_unverified_fix_claim'));

const mirandaVerifiedFix = manager.classifyNeedsYou(makeAlert({
    alert_type: 'incoming_dm',
    client_id: 'client-miranda',
    client_name: 'Miranda',
    suggested_message: 'Fixed it now, close/reopen Balance and try the saved workout again.',
    data: {
        channel: 'in_app',
        lead_stage: 'in_app',
        message_preview: 'The custom workout start button won’t load the next page.',
        app_problem_fix_verified_at: '2026-06-22T21:28:00.000Z',
    },
}));
assert.strictEqual(mirandaVerifiedFix.shouldRoute, true);
assert.ok(mirandaVerifiedFix.reasons.includes('always_needs_you_person'));

const kayNormalDm = manager.classifyNeedsYou(makeAlert({
    alert_type: 'incoming_dm',
    client_id: 'client-kay',
    client_name: 'Kay',
    data: {
        channel: 'in_app',
        lead_stage: 'paying',
        message_preview: 'Haha how was your weekend?',
    },
}));
assert.strictEqual(kayNormalDm.shouldRoute, true);
assert.ok(kayNormalDm.reasons.includes('always_needs_you_person'));

const kayProgramUpdate = manager.classifyNeedsYou(makeAlert({
    alert_type: 'incoming_dm',
    client_id: 'client-kay',
    client_name: 'Kay',
    suggested_message: 'Yep, I can tweak that program for next week.',
    data: {
        channel: 'in_app',
        lead_stage: 'paying',
        message_preview: 'Can you update my program for next week?',
    },
}));
assert.strictEqual(kayProgramUpdate.shouldRoute, true, 'current-client program updates still require Shannon approval');
assert.ok(kayProgramUpdate.reasons.includes('linked_client_requires_shannon_approval'));

const kayUnverifiedAppFix = manager.classifyNeedsYou(makeAlert({
    alert_type: 'incoming_dm',
    client_id: 'client-kay',
    client_name: 'Kay',
    suggested_message: 'Fixed it now, try logging in again.',
    data: {
        channel: 'in_app',
        lead_stage: 'paying',
        message_preview: 'The Balance app login is not working.',
    },
}));
assert.strictEqual(kayUnverifiedAppFix.shouldRoute, true);
assert.ok(kayUnverifiedAppFix.reasons.includes('app_problem_unverified_fix_claim'));

const kayVerifiedAppFix = manager.classifyNeedsYou(makeAlert({
    alert_type: 'incoming_dm',
    client_id: 'client-kay',
    client_name: 'Kay',
    suggested_message: 'Fixed it now, try logging in again.',
    data: {
        channel: 'in_app',
        lead_stage: 'paying',
        message_preview: 'The Balance app login is not working.',
        app_problem_fix_verified_at: '2026-07-02T08:00:00.000Z',
    },
}));
assert.strictEqual(kayVerifiedAppFix.shouldRoute, true, 'verified app fixes still require Shannon approval before the reply is sent');
assert.ok(kayVerifiedAppFix.reasons.includes('linked_client_requires_shannon_approval'));

assert.strictEqual(
    manager.draftAsksRedundantCurrentStatusQuestion(
        "ah fra, that's not great. how's it feeling today, still pain when you walk?",
        'Just pain when i walk'
    ),
    true
);
assert.strictEqual(
    manager.draftAsksRedundantCurrentStatusQuestion(
        "ah fra, that's not good. keep it easy today",
        'Just pain when i walk'
    ),
    false
);
assert.strictEqual(
    manager.draftAsksRedundantCurrentStatusQuestion(
        "ah that would be annoying. how's it feeling now?",
        'I had knee pain last year'
    ),
    false
);

const redundantPainQuestion = manager.classifyNeedsYou(makeAlert({
    alert_type: 'incoming_dm',
    client_id: 'client-nat',
    client_name: 'Nat',
    suggested_message: "ah nat, that's not great. how's it feeling today, still pain when you walk?",
    data: {
        channel: 'in_app',
        lead_stage: 'in_app',
        message_preview: 'Just pain when i walk',
        draft_evidence: {
            current_message: 'Just pain when i walk',
        },
    },
}));
assert.strictEqual(redundantPainQuestion.shouldRoute, true);
assert.ok(redundantPainQuestion.reasons.includes('redundant_current_status_question'));

const monica = manager.classifyNeedsYou(makeAlert({
    client_id: 'client-monica',
    client_name: 'Monica',
    data: { lead_stage: 'paying' },
}));
assert.strictEqual(monica.shouldRoute, true);
assert.ok(monica.reasons.includes('always_needs_you_person'));

const mirandaExerciseLookup = manager.classifyNeedsYou(makeAlert({
    client_id: 'client-miranda',
    client_name: 'Miranda',
    data: {
        channel: 'instagram',
        lead_stage: 'paying',
        message_preview: 'What should I put torso rotation machine in as?',
        image_url_count: 1,
        draft_evidence: {
            current_message: 'What should I put torso rotation machine in as?',
            recent_timeline: 'Miranda: [photo]\nMiranda: What should I put torso rotation machine in as?',
        },
    },
}));
assert.strictEqual(mirandaExerciseLookup.shouldRoute, true, 'permanent Needs You must not be bypassed by exercise lookup fast track');
assert.ok(mirandaExerciseLookup.reasons.includes('always_needs_you_person'));

const mirandaConfusedExerciseLookup = manager.classifyNeedsYou(makeAlert({
    client_id: 'client-miranda',
    client_name: 'Miranda',
    data: {
        channel: 'instagram',
        lead_stage: 'paying',
        message_preview: 'No seated option',
        draft_evidence: {
            current_message: 'No seated option',
            recent_timeline: 'Miranda: What can I list this machine under in the app?\nShannon: List that under seated Hip Abduction (machine).',
        },
    },
}));
assert.strictEqual(mirandaConfusedExerciseLookup.shouldRoute, true);
assert.ok(mirandaConfusedExerciseLookup.reasons.includes('exercise_lookup_confused_followup'));

const media = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: '[PHOTO:https://example.com/photo.jpg]',
        image_url_count: 1,
    },
}));
assert.strictEqual(media.shouldRoute, false, 'unlinked lead media stays with the DM manager');

const decodedLeadPhoto = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: '[PHOTO:https://example.com/photo.jpg]',
        image_url_count: 1,
        image_inline_count: 1,
        media_decode: {
            photo_url_count: 1,
            photo_inline_count: 1,
        },
    },
}));
assert.strictEqual(decodedLeadPhoto.shouldRoute, false, 'decoded lead media should not go to Needs You');

const decodedClientPhoto = manager.classifyNeedsYou(makeAlert({
    client_id: 'client-photo',
    data: {
        lead_stage: 'paying',
        message_preview: '[PHOTO:https://example.com/photo.jpg]',
        image_url_count: 1,
        image_inline_count: 1,
        media_decode: {
            photo_url_count: 1,
            photo_inline_count: 1,
        },
    },
}));
assert.strictEqual(decodedClientPhoto.shouldRoute, true, 'decoded client media still ends in Needs You with a draft');

const visibleLeadReel = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: '[VIDEO:https://instagram.com/reel/abc123/]',
        video_url_count: 1,
        video_inline_count: 0,
        media_decode: {
            video_url_count: 1,
            video_inline_count: 0,
            reel_context_count: 1,
        },
    },
}));
assert.strictEqual(visibleLeadReel.shouldRoute, false, 'lead reel with public context should stay out of Needs You');

const unseenLeadReel = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: '[VIDEO:https://instagram.com/reel/abc123/]',
        video_url_count: 1,
        video_inline_count: 0,
        media_decode: {
            video_url_count: 1,
            video_inline_count: 0,
            reel_context_count: 0,
            video_failed: true,
        },
    },
}));
assert.strictEqual(unseenLeadReel.shouldRoute, false, 'inaccessible lead media should trigger manager recovery, not Shannon handoff');

const voiceNoteReview = clientContext.buildContextReviewInfo(makeAlert({
    data: {
        message_preview: '[AUDIO:https://example.com/voice.m4a]',
        media_decode: {
            audio_url_count: 1,
        },
    },
}));
assert.strictEqual(voiceNoteReview.required, true);
assert.ok(voiceNoteReview.reasons.includes('voice_note_review_required'));
assert.match(voiceNoteReview.warning, /voice note/i);

const voiceNoteNeedsYou = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: '[AUDIO:https://example.com/voice.m4a]',
        media_decode: {
            audio_url_count: 1,
        },
    },
}));
assert.strictEqual(voiceNoteNeedsYou.shouldRoute, false, 'voice notes stay with the DM manager for transcription/recovery');

const transcribedVoiceNoteReview = clientContext.buildContextReviewInfo(makeAlert({
    data: {
        message_preview: '[AUDIO:https://example.com/voice.m4a]',
        audio_transcript_count: 1,
        media_decode: {
            audio_url_count: 1,
            audio_inline_count: 1,
            audio_transcript_count: 1,
        },
        audio_transcripts: [{ text: 'Palm Beach already feels way better than the old place.' }],
        context_review: {
            required: true,
            reasons: ['voice_note_review_required'],
            label: 'voice note needs Shannon review',
        },
    },
}));
assert.strictEqual(transcribedVoiceNoteReview.required, false, 'transcribed voice note should not need Shannon audio review');

const transcribedVoiceNoteNeedsYou = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: '[AUDIO:https://example.com/voice.m4a]',
        audio_transcript_count: 1,
        media_decode: {
            audio_url_count: 1,
            audio_inline_count: 1,
            audio_transcript_count: 1,
        },
        audio_transcripts: [{ text: 'Palm Beach already feels way better than the old place.' }],
        media_review: {
            required: true,
            kinds: ['audio'],
            label: 'voice note/audio clip',
        },
        context_review: {
            required: true,
            reasons: ['voice_note_review_required'],
            label: 'voice note needs Shannon review',
        },
    },
}));
assert.strictEqual(transcribedVoiceNoteNeedsYou.shouldRoute, false, 'lead manager should let transcribed voice notes use the normal draft/send path');

const aiSuspicion = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: 'is this AI?',
    },
}));
assert.strictEqual(aiSuspicion.shouldRoute, true);
assert.ok(aiSuspicion.reasons.includes('ai_suspicion_or_authenticity_question'));

const aiDetectionStatement = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: 'this sounds like an automated reply, is it really Shannon?',
    },
}));
assert.strictEqual(aiDetectionStatement.shouldRoute, true);
assert.ok(aiDetectionStatement.reasons.includes('ai_suspicion_or_authenticity_question'));

const aiSuspicionFromQualifierEvidence = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: 'Sorry I just have to ask?',
        qualifier: {
            quote_evidence: 'Shan is this an ai bot talking to me or is it you lol?',
        },
    },
}));
assert.strictEqual(aiSuspicionFromQualifierEvidence.shouldRoute, true);
assert.ok(aiSuspicionFromQualifierEvidence.reasons.includes('ai_suspicion_or_authenticity_question'));

const jennaIdentityChallenge = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: 'Because of how you speak i think you are not even vegan',
        inbound_message_batch: [
            { text: 'Nothing different?' },
            { text: 'Do you eat animals' },
            { text: 'Are you vegan?' },
            { text: 'Because of how you speak i think you are not even vegan' },
        ],
    },
}));
assert.strictEqual(jennaIdentityChallenge.shouldRoute, true);
assert.ok(jennaIdentityChallenge.reasons.includes('shannon_identity_inconsistency_challenge'));

const neutralVeganQuestion = manager.classifyNeedsYou(makeAlert({
    data: { message_preview: 'Are you vegan?' },
}));
assert.strictEqual(neutralVeganQuestion.shouldRoute, false, 'a neutral identity question alone should not be over-routed');

const publicAiDenialDraft = manager.classifyNeedsYou(makeAlert({
    suggested_message: "Haha nah I'm not an AI bot, promise. What move are you trying to progress?",
    data: {
        message_preview: 'Sorry I just have to ask?',
    },
}));
assert.strictEqual(publicAiDenialDraft.shouldRoute, true);
assert.ok(publicAiDenialDraft.reasons.includes('public_ai_automation_wording_in_draft'));

const decodedVoiceNoteClarification = manager.classifyNeedsYou(makeAlert({
    suggested_message: "That last note didn't come through clearly though, what were you saying in that one?",
    data: {
        message_preview: 'Never mind ahhah',
        audio_transcript_count: 2,
        media_decode: {
            audio_url_count: 2,
            audio_inline_count: 2,
            audio_transcript_count: 2,
            audio_transcripts: [
                { text: 'I decided, like, they are not vegan, so it is like, huh?' },
                { text: 'How can you ask that question if you are vegan?' },
            ],
        },
    },
}));
assert.strictEqual(decodedVoiceNoteClarification.shouldRoute, true);
assert.ok(decodedVoiceNoteClarification.reasons.includes('voice_note_public_resend_or_gist_draft'));
assert.ok(decodedVoiceNoteClarification.reasons.includes('decoded_voice_note_stale_clarification'));
assert.ok(decodedVoiceNoteClarification.reasons.includes('dropped_clarification_reopened'));

const partialVoiceNoteBatch = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: '[AUDIO:https://example.com/third.m4a]',
        audio_transcript_count: 2,
        media_decode: {
            audio_url_count: 3,
            audio_inline_count: 2,
            audio_transcript_count: 2,
            analyzed_kinds: ['audio'],
            analysis_succeeded: true,
            analysis_complete: false,
        },
    },
}));
assert.strictEqual(partialVoiceNoteBatch.shouldRoute, true);
assert.ok(partialVoiceNoteBatch.reasons.includes('partial_voice_note_batch'));

const undecodedVoiceNoteResendDraft = manager.classifyNeedsYou(makeAlert({
    suggested_message: "I got your voice note but it didn't come through clearly, can you send me the gist quickly?",
    data: {
        message_preview: '[AUDIO:https://example.com/voice.m4a]',
        media_decode: {
            audio_url_count: 1,
            audio_inline_count: 0,
            audio_failed: true,
        },
    },
}));
assert.strictEqual(undecodedVoiceNoteResendDraft.shouldRoute, true);
assert.ok(undecodedVoiceNoteResendDraft.reasons.includes('voice_note_public_resend_or_gist_draft'));

const droppedClarificationReopened = manager.classifyNeedsYou(makeAlert({
    suggested_message: 'All good haha. What were you trying to say about your food and energy?',
    data: {
        message_preview: 'Never mind ahhah',
    },
}));
assert.strictEqual(droppedClarificationReopened.shouldRoute, true);
assert.ok(droppedClarificationReopened.reasons.includes('dropped_clarification_reopened'));

const storyCuteFitnessPivot = manager.classifyNeedsYou(makeAlert({
    suggested_message: 'Cute haha\nAre you into fitness much too?',
    data: {
        message_preview: 'Cute',
        draft_evidence: {
            story_context: 'IG story reply context: Story caption: Poop. Visible story text: POOP.',
        },
    },
}));
assert.strictEqual(storyCuteFitnessPivot.shouldRoute, true);
assert.ok(storyCuteFitnessPivot.reasons.includes('stock_fitness_pivot_from_light_story'));

const alreadyAnsweredTrainingDetail = manager.classifyNeedsYou(makeAlert({
    suggested_message: "Yeah pretty much, I'm into it. What's your main focus lately?",
    data: {
        message_preview: 'Into fitness?',
        recent_inbound_messages: [
            { text: "I focus on everything except chest, upper traps, and abs. My biggest priority now is bringing up my quads and glutes." },
        ],
    },
}));
assert.strictEqual(alreadyAnsweredTrainingDetail.shouldRoute, true);
assert.ok(alreadyAnsweredTrainingDetail.reasons.includes('already_answered_training_detail_question'));

const leadConstraintProblemHunt = manager.classifyNeedsYou(makeAlert({
    suggested_message: "Damn, that's a lot to juggle. If you could only fix one thing to get started, what would make it easiest right now, time or money?",
    data: {
        message_preview: "Im going through setbacks with being sick, partner financially dependant on me and other obstacles",
        recent_inbound_messages: [
            { text: "Yeah. I'll need help later. But I just need to gather the time and money to get myself started" },
        ],
    },
}));
assert.strictEqual(leadConstraintProblemHunt.shouldRoute, true);
assert.ok(leadConstraintProblemHunt.reasons.includes('lead_no_blocker_or_constraint_problem_hunt'));

const noBlockerFallbackQuestion = manager.classifyNeedsYou(makeAlert({
    suggested_message: 'No that is honestly perfect. With the week-to-week horse schedule, do you ever need a recovery or training fallback plan?',
    data: {
        message_preview: 'No not really, I eat every couple of hours and have snacks prepped.',
    },
}));
assert.strictEqual(noBlockerFallbackQuestion.shouldRoute, true);
assert.ok(noBlockerFallbackQuestion.reasons.includes('lead_no_blocker_or_constraint_problem_hunt'));

const imminentDanger = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: "I can't keep myself safe tonight and I'm thinking about killing myself",
    },
}));
assert.strictEqual(imminentDanger.shouldRoute, true);
assert.ok(imminentDanger.reasons.includes('credible_current_danger'));

const historicDifficultyIsNotImminent = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: 'I had depression years ago but training helped me a lot',
    },
}));
assert.strictEqual(historicDifficultyIsNotImminent.shouldRoute, false);

const unresolvedClientMediaDraft = manager.classifyNeedsYou(makeAlert({
    client_id: 'client-media',
    data: {
        lead_stage: 'paying',
        message_preview: '[AUDIO:https://example.com/voice.m4a]',
        media_decode: { audio_url_count: 1, audio_failed: true },
        draft_review: {
            verdict: 'block',
            summary: 'Voice note media needs review because the audio was unavailable.',
            issues: ['media_review_required'],
            notification_required: true,
            notification_reason: 'media_review_required',
            context_loss_suspected: true,
        },
    },
}));
assert.strictEqual(unresolvedClientMediaDraft.shouldRoute, true, 'client media failures remain visible in Needs You');

const contextLoss = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: 'sorry i dont understand what you mean',
        draft_review: {
            context_loss_suspected: true,
        },
    },
}));
assert.strictEqual(contextLoss.shouldRoute, false, 'lead confusion is repaired and answered by the DM manager');

const curlyApostropheConfusion = manager.classifyNeedsYou(makeAlert({
    data: {
        last_outbound_message: 'standing lunge couple? hows that one feel?',
        message_preview: "I don\u2019t understand your question",
    },
}));
assert.strictEqual(curlyApostropheConfusion.shouldRoute, false);

const bareSorryConfusion = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: 'sorry?',
        last_outbound_message: 'wait canada? how was it?',
    },
}));
assert.strictEqual(bareSorryConfusion.shouldRoute, false);

const lateReplyApology = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: 'Sorry just seen this! It was so good',
        last_outbound_message: 'how was it?',
    },
}));
assert.strictEqual(lateReplyApology.reasons.includes('client_does_not_understand_context'), false);

const typoWhatDoYouMean = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: 'Wat do u mean',
        last_outbound_message: 'Bacon + balsamic glaze on there is a bit elite',
    },
}));
assert.strictEqual(typoWhatDoYouMean.shouldRoute, false);

const nonSequiturReview = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: 'yeah just the link would be good',
        draft_review: {
            verdict: 'warn',
            confidence: 0.64,
            summary: 'Draft slows down instead of answering the latest link request.',
            notification_reason: 'ignored_latest_message',
            context_loss_suspected: false,
        },
    },
}));
assert.strictEqual(nonSequiturReview.shouldRoute, false, 'lead draft problems are repaired by the DM manager');

const genericVoiceReview = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: 'yeah send me the link',
        draft_review: {
            verdict: 'warn',
            confidence: 0.74,
            summary: 'Draft is usable but a bit generic.',
            issues: ['generic_voice'],
            notification_reason: 'lead_quality',
            context_loss_suspected: false,
            notification_required: false,
        },
    },
}));
assert.strictEqual(genericVoiceReview.shouldRoute, false);

const approvedCoachingHandoff = makeAlert({
    suggested_message: "yeah love that you're keen. here's the link: https://plantbased-balance.org/coaching.html",
    data: {
        message_preview: 'yeah send me the link',
        approved_link_auto_sendable: true,
        signup_link_manual_only: false,
        signup_link_handoff_url: 'https://plantbased-balance.org/coaching.html',
        draft_review: {
            verdict: 'pass',
            confidence: 0.9,
            summary: 'Approved coaching link handoff follows the latest message.',
            notification_reason: 'none',
            notification_required: false,
            context_loss_suspected: false,
        },
    },
});
const approvedCoachingClassification = manager.classifyNeedsYou(approvedCoachingHandoff);
assert.strictEqual(approvedCoachingClassification.shouldRoute, false);
assert.strictEqual(manager.shouldAutoScheduleApprovedCoachingHandoff(approvedCoachingHandoff, approvedCoachingClassification), true);
const schedulePatch = manager.buildApprovedCoachingAutoSchedulePatch(approvedCoachingHandoff, new Date('2026-06-22T00:00:00.000Z'));
assert.strictEqual(schedulePatch.status, 'scheduled');
assert.strictEqual(schedulePatch.scheduled_for, '2026-06-22T00:02:00.000Z');
assert.strictEqual(schedulePatch.data.scheduled_via, 'auto_send');
assert.strictEqual(schedulePatch.data.auto_send_review_approved_by, 'balance-lead-client-manager');
assert.strictEqual(schedulePatch.data.client_manager_auto_schedule_reason, 'approved_starter_coaching_link_handoff');
assert.strictEqual(
    manager.shouldAutoScheduleCleanLeadCloudFallback(approvedCoachingHandoff, approvedCoachingClassification),
    false,
    'approved sales handoffs keep their dedicated accelerated path'
);

const cleanCloudFallbackLead = makeAlert({
    suggested_message: 'yeah getting the bag ready the night before should take the thinking out of it',
    data: {
        ig_thread_id: 'thread-clean-lead',
        message_preview: 'I think I just overthink going to the gym',
        qualifier: { commercial_stage: 'problem_qualified' },
        draft_review: {
            verdict: 'pass',
            confidence: 0.91,
            issues: [],
            notification_required: false,
            context_loss_suspected: false,
            reviewed_at: '2026-07-28T00:00:00.000Z',
        },
    },
});
const cleanCloudFallbackClassification = manager.classifyNeedsYou(cleanCloudFallbackLead);
assert.strictEqual(cleanCloudFallbackClassification.shouldRoute, false);
assert.strictEqual(
    manager.shouldAutoScheduleCleanLeadCloudFallback(cleanCloudFallbackLead, cleanCloudFallbackClassification),
    true
);
const cleanCloudFallbackPatch = manager.buildCleanLeadCloudFallbackSchedulePatch(
    cleanCloudFallbackLead,
    new Date('2026-07-28T00:00:00.000Z')
);
assert.strictEqual(cleanCloudFallbackPatch.status, 'scheduled');
assert.strictEqual(cleanCloudFallbackPatch.scheduled_for, '2026-07-28T00:04:00.000Z');
assert.strictEqual(cleanCloudFallbackPatch.data.scheduled_via, 'auto_send');
assert.strictEqual(cleanCloudFallbackPatch.data.cloud_dm_manager_fallback, true);
assert.strictEqual(cleanCloudFallbackPatch.data.client_manager_auto_schedule_reason, 'clean_unlinked_lead_cloud_fallback');

const repairableCloudWarning = makeAlert({
    suggested_message: 'Haha yeah I have a steady roster. You doing one-on-one or group coaching?',
    data: {
        ig_thread_id: 'thread-repairable-warning',
        message_preview: 'Awesome how many clients you got working with ya',
        qualifier: { commercial_stage: 'engaged' },
        draft_review: {
            verdict: 'warn',
            confidence: 0.74,
            issues: ['The draft adds an unnecessary extra question that is not directly prompted.'],
            summary: 'The direct answer is usable but the extra discovery question should be removed.',
            suggested_fix: 'Keep only the direct answer.',
            notification_reason: 'none',
            notification_required: false,
            context_loss_suspected: false,
            reviewed_at: '2026-08-12T00:00:00.000Z',
        },
    },
});
assert.strictEqual(
    manager.shouldAttemptCleanLeadCloudRepair(repairableCloudWarning, manager.classifyNeedsYou(repairableCloudWarning)),
    true,
    'a grounded ordinary-lead style warning should get one cloud repair attempt'
);
assert.strictEqual(manager.parseCleanLeadCloudRepair('{"messages":["That makes sense haha."]}').joined, 'That makes sense haha.');
assert.strictEqual(manager.parseCleanLeadCloudRepair('{"hold_reason":"missing verified client count"}').holdReason, 'missing verified client count');
assert.strictEqual(manager.parseCleanLeadCloudRepair('{"messages":["Check https://example.com"]}').holdReason, 'repair_introduced_forbidden_content');
assert.strictEqual(manager.latestAsksForCurrentClientCount(repairableCloudWarning), true);
assert.strictEqual(manager.latestAsksForCurrentClientCount(makeAlert({ data: { message_preview: 'how is coaching going?' } })), false);
assert.strictEqual(manager.approximateClientCountForDm(44), 40);
assert.strictEqual(manager.approximateClientCountForDm(9), 9);
assert.strictEqual(manager.approximateClientCountForDm(0), 0);

for (const heldWarning of [
    {
        ...repairableCloudWarning,
        data: {
            ...repairableCloudWarning.data,
            draft_review: {
                ...repairableCloudWarning.data.draft_review,
                issues: ['The source DM context is missing; open the DM before replying.'],
                summary: 'Missing context.',
            },
        },
    },
    {
        ...repairableCloudWarning,
        data: {
            ...repairableCloudWarning.data,
            audio_url_count: 1,
        },
    },
    {
        ...repairableCloudWarning,
        data: {
            ...repairableCloudWarning.data,
            cloud_draft_repair: { status: 'held', attempted_at: '2026-08-12T00:01:00.000Z' },
        },
    },
]) {
    assert.strictEqual(
        manager.shouldAttemptCleanLeadCloudRepair(heldWarning, manager.classifyNeedsYou(heldWarning)),
        false,
        'context, media, and already-attempted warnings must stay held'
    );
}
assert.strictEqual(manager.containsCommercialDecisionText('normal gym chat'), false);
assert.strictEqual(manager.containsCommercialDecisionText('I reckon Balance would suit you, want me to send the details?'), true);
assert.strictEqual(
    manager.latestAlertEvidenceAt({
        created_at: '2026-07-28T00:00:00.000Z',
        data: {
            drafted_at: '2026-07-28T00:00:10.000Z',
            inbound_message_batch: [
                { created_at: '2026-07-28T00:00:05.000Z' },
                { created_at: '2026-07-28T00:00:12.000Z' },
            ],
        },
    }),
    '2026-07-28T00:00:12.000Z'
);
assert.strictEqual(manager.latestAlertEvidenceAt({ data: {} }), null);

for (const unsafeFallback of [
    makeAlert({
        client_id: 'linked-client',
        suggested_message: 'yep sounds good',
        data: { ig_thread_id: 'thread-linked', draft_review: { verdict: 'pass', confidence: 0.9, issues: [] } },
    }),
    makeAlert({
        suggested_message: 'here is the link https://example.com',
        data: { ig_thread_id: 'thread-url', draft_review: { verdict: 'pass', confidence: 0.9, issues: [] } },
    }),
    makeAlert({
        suggested_message: 'tell me more',
        data: {
            ig_thread_id: 'thread-voice',
            audio_url_count: 1,
            draft_review: { verdict: 'pass', confidence: 0.9, issues: [] },
        },
    }),
    makeAlert({
        suggested_message: 'that reel is heartbreaking hey',
        data: {
            ig_thread_id: 'thread-decoded-video',
            video_url_count: 1,
            reel_context_count: 1,
            media_decode: { analysis_complete: true, video_url_count: 1, reel_context_count: 1 },
            draft_review: { verdict: 'pass', confidence: 0.9, issues: [] },
        },
    }),
    makeAlert({
        suggested_message: 'want me to send the details?',
        data: {
            ig_thread_id: 'thread-buyer',
            qualifier: { commercial_stage: 'buyer_intent' },
            draft_review: { verdict: 'pass', confidence: 0.9, issues: [] },
        },
    }),
    makeAlert({
        suggested_message: 'Honestly, this is exactly what I help with inside Balance.',
        data: {
            ig_thread_id: 'thread-unflagged-offer',
            qualifier: { commercial_stage: 'problem_qualified' },
            draft_review: { verdict: 'pass', confidence: 0.9, issues: [] },
        },
    }),
    makeAlert({
        suggested_message: 'try logging in again',
        data: {
            ig_thread_id: 'thread-support',
            message_preview: 'the Balance app login is not working',
            draft_review: { verdict: 'pass', confidence: 0.9, issues: [] },
        },
    }),
]) {
    assert.strictEqual(
        manager.shouldAutoScheduleCleanLeadCloudFallback(unsafeFallback, manager.classifyNeedsYou(unsafeFallback)),
        false
    );
}

const approvedCallBookingHandoff = makeAlert({
    suggested_message: "yeah for sure, grab a time that works for you here: https://plantbased-balance.org/book",
    data: {
        message_preview: 'could we do a video call to talk through the Founders Pass?',
        approved_link_auto_sendable: true,
        signup_link_manual_only: false,
        signup_link_handoff_url: 'https://plantbased-balance.org/book',
        call_booking_handoff: true,
        draft_review: {
            verdict: 'pass',
            confidence: 0.9,
            notification_reason: 'none',
            notification_required: false,
            context_loss_suspected: false,
        },
    },
});
assert.strictEqual(manager.approvedLinkHandoffKind(approvedCallBookingHandoff), 'call_booking');
assert.strictEqual(manager.shouldAutoScheduleApprovedCoachingHandoff(approvedCallBookingHandoff, { shouldRoute: false }), true);
const callBookingSchedulePatch = manager.buildApprovedCoachingAutoSchedulePatch(approvedCallBookingHandoff, new Date('2026-06-22T00:00:00.000Z'));
assert.strictEqual(callBookingSchedulePatch.data.client_manager_auto_schedule_reason, 'approved_call_booking_link_handoff');
assert.strictEqual(callBookingSchedulePatch.data.reply_timing_suggestion.signals.approved_call_booking_link_handoff, true);

const unsafeCoachingHandoff = makeAlert({
    suggested_message: "yeah here's the link: https://plantbased-balance.org/coaching.html",
    data: {
        message_preview: 'send the link',
        approved_link_auto_sendable: true,
        signup_link_handoff_url: 'https://plantbased-balance.org/coaching.html',
        draft_review: {
            verdict: 'warn',
            confidence: 0.6,
            notification_required: true,
            notification_reason: 'context_loss',
            context_loss_suspected: true,
        },
    },
});
assert.strictEqual(manager.shouldAutoScheduleApprovedCoachingHandoff(unsafeCoachingHandoff, { shouldRoute: false }), false);

const passReview = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: 'thanks mate, that sounds good',
        last_outbound_message: 'sweet, start with the simple version today',
        draft_review: {
            verdict: 'pass',
            confidence: 0.9,
            summary: 'Draft matches the available context.',
            notification_reason: 'none',
            context_loss_suspected: false,
        },
    },
}));
assert.strictEqual(passReview.shouldRoute, false);

const normal = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: 'thanks mate, that sounds good',
        last_outbound_message: 'sweet, start with the simple version today',
    },
}));
assert.strictEqual(normal.shouldRoute, false);

const reviewContext = manager.buildDraftReviewContextBlocks(makeAlert({
    suggested_message: 'nice, want me to send the link?',
    data: {
        message_preview: 'yeah send me the link',
        draft_evidence: {
            current_message: 'yeah send me the link',
            prior_unanswered: [{ text: 'how do i start?' }],
            recent_timeline: 'Lead: how do i start?\nShannon: i can send the link',
        },
    },
}));
assert.ok(reviewContext.includes('Just-arrived message from Lead'));
assert.ok(reviewContext.includes('Prior unanswered messages'));

const decodedMediaReviewContext = manager.buildDraftReviewContextBlocks(makeAlert({
    data: {
        message_preview: 'Answer is in the video :)',
        draft_evidence: {
            current_message: 'Answer is in the video :)',
            media_context: 'The video reveals the answer in the final frame.',
        },
    },
}));
assert.match(decodedMediaReviewContext, /Media analysis\/context/);
assert.match(decodedMediaReviewContext, /final frame/);

const unresolvedReferencedVideo = makeAlert({
    suggested_message: "Hahaha fair, what's the answer then?",
    data: {
        ig_thread_id: 'thread-unresolved-video',
        message_preview: 'Answer is in the video :)',
        draft_review: {
            verdict: 'pass',
            confidence: 0.94,
            issues: [],
            notification_required: false,
            context_loss_suspected: false,
        },
    },
});
assert.strictEqual(manager.leadNeedsReferencedMediaEvidence(unresolvedReferencedVideo.data), true);
assert.strictEqual(
    manager.shouldAutoScheduleCleanLeadCloudFallback(unresolvedReferencedVideo, manager.classifyNeedsYou(unresolvedReferencedVideo)),
    false,
    'an explicit media reference cannot enter the clean text fallback without decoded evidence'
);

const rankedPending = manager.rankPendingDmAlerts([
    makeAlert({ id: 'old-banter', created_at: '2026-08-11T00:00:00.000Z', data: { message_preview: 'haha yep' } }),
    makeAlert({ id: 'fresh-question', created_at: '2026-08-11T09:58:00.000Z', data: { message_preview: 'Do you have a close friends story?' } }),
    makeAlert({ id: 'fitness-signal', created_at: '2026-08-11T09:55:00.000Z', data: { message_preview: 'I feel fat and unfit and need help getting consistent' } }),
], new Date('2026-08-11T10:00:00.000Z'));
assert.strictEqual(rankedPending[0].id, 'fresh-question', 'direct questions should outrank passive old banter');
assert.ok(
    manager.pendingDmPriorityScore(rankedPending[1], new Date('2026-08-11T10:00:00.000Z'))
        > manager.pendingDmPriorityScore(rankedPending[2], new Date('2026-08-11T10:00:00.000Z')),
    'qualified fitness signals should outrank passive old banter'
);

const exerciseSupportContext = manager.buildDraftReviewContextBlocks(makeAlert({
    suggested_message: 'switch to Cable Hip Abduction instead',
    data: {
        message_preview: 'No seated option',
        draft_evidence: {
            current_message: 'No seated option',
            recent_timeline: 'Lead: What can I list this machine under in the app?\nShannon: List that under seated Hip Abduction (machine).',
        },
    },
}));
assert.ok(exerciseSupportContext.includes('APP EXERCISE LIBRARY CHECK'));
assert.ok(exerciseSupportContext.includes('Machine Seated Abduction'));
assert.ok(exerciseSupportContext.includes('Do not recommend a substitute'));

assert.strictEqual(manager.shouldRunDraftReview(makeAlert({
    suggested_message: 'hey',
    data: { message_preview: 'hey' },
})), true);
assert.strictEqual(manager.shouldRunDraftReview(makeAlert({
    suggested_message: 'hey',
    data: { draft_review: { verdict: 'pass', reviewed_at: '2026-06-02T00:00:00.000Z' } },
})), false);

const stamped = manager.buildNeedsYouData(makeAlert({ client_name: 'Fra' }), shane);
assert.strictEqual(stamped.operator_queue, 'needs_you');
assert.strictEqual(stamped.needs_you_required, true);
assert.strictEqual(stamped.codex_review.source, 'balance-lead-client-manager');
assert.strictEqual(stamped.codex_review.queue, 'needs_you');

const instantDraftSource = fs.readFileSync(path.join(__dirname, '../netlify/functions/instant-coach-draft.js'), 'utf8');
assert.ok(
    instantDraftSource.includes("const currentClientNeedsYou = true")
        && instantDraftSource.includes("needs_you_reason: currentClientNeedsYouReason")
        && instantDraftSource.includes("if (!currentClientNeedsYou && !simple"),
    'every in-app current-client message must generate a Needs You draft and stay out of auto-send'
);
assert.ok(
    instantDraftSource.includes('!permanentNeedsYouClient && !mediaReview.required'),
    'in-app client DM auto-send should be blocked for permanent Needs You clients'
);
assert.ok(
    instantDraftSource.includes('shouldBypassKayNeedsYouForProgramUpdateOrAppFix')
        && instantDraftSource.includes('const permanentNeedsYouIdentity = {'),
    'in-app client DM routing should know Kay program-update/app-fix bypass'
);

const igDraftSource = fs.readFileSync(path.join(__dirname, '../netlify/functions/ig-instant-draft.js'), 'utf8');
assert.ok(
    igDraftSource.includes("code: 'always_needs_you_person'") && igDraftSource.includes("label: 'permanent Needs You client'"),
    'IG auto-send should be held for permanent Needs You clients'
);
assert.ok(
    igDraftSource.includes('const permanentNeedsYouIdentity = {')
        && igDraftSource.includes('isAlwaysNeedsYouPerson(permanentNeedsYouIdentity)'),
    'IG permanent Needs You routing should not depend on the thread already being linked to an app user'
);
assert.ok(
    igDraftSource.includes('client_manager_review_required: draftOnlyNeedsYouClient')
        && igDraftSource.includes('needs_shannon_approval: draftOnlyNeedsYouClient')
        && igDraftSource.includes('linked_client_manual_review: linkedClientNeedsYou'),
    'coalesced lead alerts must be upgraded to linked-client Needs You routing'
);
assert.ok(
    clientContextSource.includes('Do not warn just because a lead/client reply is short and reaction-only'),
    'client/lead manager draft QA should not over-penalize reaction-only Shannon replies'
);
assert.ok(
    clientContextSource.includes('native post opener')
        && clientContextSource.includes('comment Shannon left on their post'),
    'lead draft QA should recognise native post/comment openers'
);
assert.ok(
    clientContextSource.includes('Warn if the draft tacks an optional curiosity question'),
    'client/lead manager draft QA should flag unnecessary curiosity questions'
);

console.log('client-lead-manager tests passed');
