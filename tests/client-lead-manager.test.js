const assert = require('assert');
const fs = require('fs');
const path = require('path');

const clientContext = require('../netlify/functions/_lib/client-context');
const manager = require('../netlify/functions/client-lead-manager')._test;

assert.strictEqual(manager.resolveAiDraftReviewLimit(undefined), 8);
assert.strictEqual(manager.resolveAiDraftReviewLimit('0'), 0);
assert.strictEqual(manager.resolveAiDraftReviewLimit('3'), 3);
assert.strictEqual(manager.resolveAiDraftReviewLimit('200'), 80);
assert.strictEqual(manager.resolveAiDraftReviewLimit('bad'), 8);

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

assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ client_name: 'Shane' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ profile_name: 'Fra' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ ig_username: 'francesca_balance' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ ig_username: 'cavazzanafrancesca' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ client_name: 'Nat' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ profile_name: 'Natalie' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ ig_username: 'nat_balance' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ client_name: 'Miranda' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ ig_username: 'miranda_balance' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ client_name: 'Monica' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ ig_username: 'monica_balance' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ client_name: 'Dani' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ client_name: 'Daniela' }), false);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ client_name: 'Nate' }), false);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ client_name: 'Frank' }), false);

assert.strictEqual(manager.isAcquisitionLeadAlert(makeAlert()), true);
assert.strictEqual(manager.isAcquisitionLeadAlert(makeAlert({
    client_id: 'client-1',
    data: { lead_stage: 'paying' },
})), false);

const coldLeadNamedShane = manager.classifyNeedsYou(makeAlert({ client_name: 'Shane' }));
assert.strictEqual(coldLeadNamedShane.shouldRoute, true, 'permanent IG thread identities must route to Needs You');
assert.ok(coldLeadNamedShane.reasons.includes('always_needs_you_person'));

const shane = manager.classifyNeedsYou(makeAlert({
    client_id: 'client-shane',
    client_name: 'Shane',
    data: { lead_stage: 'paying' },
}));
assert.strictEqual(shane.shouldRoute, true);
assert.ok(shane.reasons.includes('always_needs_you_person'));
assert.match(shane.label, /Miranda/);
assert.match(shane.label, /Monica/);
assert.match(shane.label, /Nat/);

const nat = manager.classifyNeedsYou(makeAlert({
    client_id: 'client-nat',
    client_name: 'Nat',
    data: { lead_stage: 'paying' },
}));
assert.strictEqual(nat.shouldRoute, true);
assert.ok(nat.reasons.includes('always_needs_you_person'));

const miranda = manager.classifyNeedsYou(makeAlert({
    alert_type: 'incoming_dm',
    client_id: 'client-miranda',
    client_name: 'Miranda',
    data: { channel: 'in_app', lead_stage: 'paying' },
}));
assert.strictEqual(miranda.shouldRoute, true);
assert.ok(miranda.reasons.includes('always_needs_you_person'));

const permanentStamp = manager.buildNeedsYouData(makeAlert({
    alert_type: 'incoming_dm',
    client_id: 'client-miranda',
    client_name: 'Miranda',
    data: { channel: 'in_app', lead_stage: 'paying' },
}), miranda);
assert.strictEqual(permanentStamp.needs_you_required, true);
assert.strictEqual(permanentStamp.operator_queue, 'needs_you');
assert.strictEqual(permanentStamp.needs_shannon_approval, true);
assert.strictEqual(permanentStamp.needs_you_reason, 'always_needs_you_person');
assert.strictEqual(permanentStamp.permanent_needs_you_draft_only, true);
assert.strictEqual(permanentStamp.outbound_attempted, false);
assert.strictEqual(permanentStamp.codex_review.reason, 'always_needs_you_person');
assert.strictEqual(permanentStamp.codex_review.decision, 'needs_you_permanent_person_draft_only');

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
    client_name: 'Miranda',
    data: {
        channel: 'instagram',
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
assert.strictEqual(media.shouldRoute, true);
assert.ok(media.reasons.includes('media_review_required'));

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
assert.strictEqual(decodedClientPhoto.shouldRoute, true, 'client media review still routes');
assert.ok(decodedClientPhoto.reasons.includes('media_review_required'));

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
assert.strictEqual(unseenLeadReel.shouldRoute, true, 'lead reel without decoded/context evidence should route');
assert.ok(unseenLeadReel.reasons.includes('media_review_required'));

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
assert.strictEqual(voiceNoteNeedsYou.shouldRoute, true);
assert.ok(voiceNoteNeedsYou.reasons.includes('voice_note_review_required'));

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

const contextLoss = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: 'sorry i dont understand what you mean',
        draft_review: {
            context_loss_suspected: true,
        },
    },
}));
assert.strictEqual(contextLoss.shouldRoute, true);
assert.ok(contextLoss.reasons.includes('client_does_not_understand_context'));
assert.ok(contextLoss.reasons.includes('draft_review_context_loss'));

const curlyApostropheConfusion = manager.classifyNeedsYou(makeAlert({
    data: {
        last_outbound_message: 'standing lunge couple? hows that one feel?',
        message_preview: "I don\u2019t understand your question",
    },
}));
assert.strictEqual(curlyApostropheConfusion.shouldRoute, true);
assert.ok(curlyApostropheConfusion.reasons.includes('client_does_not_understand_context'));

const bareSorryConfusion = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: 'sorry?',
        last_outbound_message: 'wait canada? how was it?',
    },
}));
assert.strictEqual(bareSorryConfusion.shouldRoute, true);
assert.ok(bareSorryConfusion.reasons.includes('client_does_not_understand_context'));

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
assert.strictEqual(typoWhatDoYouMean.shouldRoute, true);
assert.ok(typoWhatDoYouMean.reasons.includes('client_does_not_understand_context'));

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
assert.strictEqual(nonSequiturReview.shouldRoute, true);
assert.ok(nonSequiturReview.reasons.includes('draft_review_manual_check'));

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
    suggested_message: "yeah love that you're keen. here's the link: https://future-balance.netlify.app/coaching.html",
    data: {
        message_preview: 'yeah send me the link',
        approved_link_auto_sendable: true,
        signup_link_manual_only: false,
        signup_link_handoff_url: 'https://future-balance.netlify.app/coaching.html',
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

const unsafeCoachingHandoff = makeAlert({
    suggested_message: "yeah here's the link: https://future-balance.netlify.app/coaching.html",
    data: {
        message_preview: 'send the link',
        approved_link_auto_sendable: true,
        signup_link_handoff_url: 'https://future-balance.netlify.app/coaching.html',
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
    instantDraftSource.includes('!permanentNeedsYouClient && !mediaReview.required'),
    'in-app client DM auto-send should be blocked for permanent Needs You clients'
);

const igDraftSource = fs.readFileSync(path.join(__dirname, '../netlify/functions/ig-instant-draft.js'), 'utf8');
assert.ok(
    igDraftSource.includes("code: 'always_needs_you_person'") && igDraftSource.includes("label: 'permanent Needs You client'"),
    'IG auto-send should be held for permanent Needs You clients'
);
assert.ok(
    igDraftSource.includes('const permanentNeedsYouClient = isAlwaysNeedsYouPerson({'),
    'IG permanent Needs You routing should not depend on the thread already being linked to an app user'
);

console.log('client-lead-manager tests passed');
