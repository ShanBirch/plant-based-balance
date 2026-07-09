const assert = require('assert');
const fs = require('fs');
const path = require('path');

const profile = require('../netlify/functions/_lib/tahlia-profile');
const worker = require('../netlify/functions/tahlia-social-worker')._test;
const coachAction = require('../netlify/functions/perform-coach-action')._test;

const adminSource = fs.readFileSync(path.join(__dirname, '../admin-dashboard.html'), 'utf8');
const performSource = fs.readFileSync(path.join(__dirname, '../netlify/functions/perform-coach-action.js'), 'utf8');
const netlifySource = fs.readFileSync(path.join(__dirname, '../netlify.toml'), 'utf8');

assert.strictEqual(profile.TAHLIA_PROFILE.displayName, 'Tahlia Brooks');
assert.strictEqual(profile.TAHLIA_PROFILE.age, 25);
assert.strictEqual(profile.TAHLIA_PROFILE.gender, 'female');
assert.strictEqual(profile.TAHLIA_PROFILE.portfolio.trainingLevel, 'beginner-to-intermediate');
assert.strictEqual(profile.TAHLIA_PROFILE.portfolio.estimatedWeightKg, 64);
assert.strictEqual(profile.TAHLIA_PROFILE.portfolio.calorieTargetRange, '1850-2250 kcal/day');
assert.ok(profile.TAHLIA_PROFILE.voice.avoids.includes('mentions of AI, bots, automation, seeded accounts, or testing'));
assert.strictEqual(worker.DEFAULT_MAX_POST_ALERTS_PER_RUN, 1);
assert.strictEqual(worker.DEFAULT_MAX_COMMENT_ALERTS_PER_RUN, 1);
assert.strictEqual(worker.DEFAULT_DAILY_POST_ALERT_CAP, 3);
assert.strictEqual(worker.DEFAULT_DAILY_COMMENT_ALERT_CAP, 6);
assert.strictEqual(worker.DEFAULT_RESUME_DATE_KEY, '2026-07-05');
assert.strictEqual(worker.isBeforeBrisbaneDateKey(new Date('2026-07-04T13:59:00.000Z'), '2026-07-05'), true);
assert.strictEqual(worker.isBeforeBrisbaneDateKey(new Date('2026-07-04T14:00:00.000Z'), '2026-07-05'), false);
assert.deepStrictEqual(worker.brisbaneDayBounds(new Date('2026-07-04T13:59:00.000Z')), {
    dateKey: '2026-07-04',
    startIso: '2026-07-03T14:00:00.000Z',
    endIso: '2026-07-04T14:00:00.000Z',
});

function parseCardVolumeKg(value) {
    return Number(String(value || '').replace(/[^0-9.]/g, ''));
}

function exerciseVolumeKg(exercise = {}) {
    const match = String(exercise.best || '').match(/(\d+)x(\d+)\s*@\s*([\d.]+)\s*kg/i);
    if (!match) return 0;
    return Number(match[1]) * Number(match[2]) * Number(match[3]);
}

function assertWorkoutVolumeMatches(card) {
    const actual = (card.exercises || []).reduce((sum, exercise) => sum + exerciseVolumeKg(exercise), 0);
    assert.strictEqual(parseCardVolumeKg(card.total_volume), actual);
}

assertWorkoutVolumeMatches(profile.buildTahliaPostCardPayload('workout', 'caption', 'tx-upper'));
assertWorkoutVolumeMatches(profile.buildTahliaPostCardPayload('workout', 'caption', 'tx-workout'));
assert.deepStrictEqual(worker.summarizeDailyTahliaAlertCounts([
    { data: { source: 'tahlia-social-worker', social_action: 'feed_comment' } },
    { data: { subtype: 'tahlia_social_approval', social_action: 'feed_comment' } },
    { data: { tahlia_profile_key: 'tahlia_brooks', social_action: 'feed_post' } },
    { data: { source: 'other-worker', social_action: 'feed_comment' } },
]), { feed_post: 1, feed_comment: 2, total: 3 });

const workoutTx = {
    id: 'tx-workout',
    transaction_type: 'earn_workout',
    reference_type: 'tahlia_brooks_xp_autopilot',
    points_amount: 8,
    description: 'Workout logged',
    created_at: '2026-07-03T00:00:00.000Z',
};
const mealTx = { ...workoutTx, id: 'tx-meal', transaction_type: 'earn_meal', description: 'Meal logged' };
const checkinTx = { ...workoutTx, id: 'tx-checkin', transaction_type: 'daily_checkin', description: 'Daily check-in' };
const nightCheckinTx = { ...checkinTx, id: 'tx-night-checkin', created_at: '2026-07-03T09:05:00.000Z' };
const pbTx = { ...workoutTx, id: 'tx-pb', transaction_type: 'personal_best', description: 'Personal best logged' };
const workoutPbTx = { ...workoutTx, id: 'tx-workout-pb', transaction_type: 'earn_workout', description: 'Workout personal best logged' };
const workoutCardPayload = {
    card_type: 'workout',
    workout_name: 'Upper Body',
    total_sets: 8,
    total_volume: '3,250 kg',
    exercises: [
        { name: 'Lat Pulldown', best: '40kg x 10' },
        { name: 'Chest Press', best: '25kg x 12' },
    ],
    share_caption: 'Shared 8 sets from 2 exercises',
};

assert.strictEqual(worker.pointTransactionActivityType(workoutTx), 'workout');
assert.strictEqual(worker.pointTransactionActivityType(mealTx), '');
assert.strictEqual(worker.pointTransactionActivityType(checkinTx), '');
assert.strictEqual(worker.pointTransactionActivityType(nightCheckinTx), 'fitness_diary');
assert.strictEqual(worker.pointTransactionActivityType(pbTx), 'personal_best');
assert.strictEqual(worker.pointTransactionActivityType(workoutPbTx), 'personal_best');
assert.strictEqual(worker.isAllowedTahliaPostActivityType('workout'), true);
assert.strictEqual(worker.isAllowedTahliaPostActivityType('personal_best'), true);
assert.strictEqual(worker.isAllowedTahliaPostActivityType('weigh_in'), true);
assert.strictEqual(worker.isAllowedTahliaPostActivityType('fitness_diary'), true);
assert.strictEqual(worker.isAllowedTahliaPostActivityType('meal'), false);
assert.strictEqual(worker.buildFeedPostAlert({
    coachId: 'coach-1',
    tahliaUser: { id: '00000000-0000-4000-8000-000000000001', name: 'Tahlia Brooks' },
    transaction: mealTx,
    now: new Date('2026-07-03T01:00:00.000Z'),
}), null);
assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '../netlify/functions/_lib/tahlia-profile.js'), 'utf8'), /session win/i);
assert.match(profile.storyText({ caption: JSON.stringify(workoutCardPayload) }), /Upper Body/i);
assert.match(profile.storyText({ caption: JSON.stringify(workoutCardPayload) }), /Lat Pulldown/i);

const tahliaUser = { id: '00000000-0000-4000-8000-000000000001', name: 'Tahlia Brooks' };
const feedAlert = worker.buildFeedPostAlert({
    coachId: 'coach-1',
    tahliaUser,
    transaction: workoutTx,
    now: new Date('2026-07-03T01:00:00.000Z'),
});

assert.strictEqual(feedAlert.alert_type, 'general_idea');
assert.strictEqual(feedAlert.client_id, null);
assert.strictEqual(feedAlert.data.subtype, 'tahlia_social_approval');
assert.strictEqual(feedAlert.data.operator_queue, 'needs_you');
assert.strictEqual(feedAlert.data.needs_shannon_approval, true);
assert.strictEqual(feedAlert.data.proposed_actions[0].type, 'publish_tahlia_feed_post');
assert.strictEqual(feedAlert.data.proposed_actions[0].payload.user_id, tahliaUser.id);
assert.strictEqual(feedAlert.data.proposed_actions[0].payload.media_type, 'workout_card');
assert.strictEqual(feedAlert.data.proposed_actions[0].payload.card_payload.card_type, 'workout');
assert.strictEqual(JSON.parse(feedAlert.data.proposed_actions[0].payload.caption).card_type, 'workout');
assert.strictEqual(feedAlert.data.evidence.post_card_type, 'workout');
assert.strictEqual(feedAlert.data.draft_text, feedAlert.data.proposed_actions[0].preview);

const pbAlert = worker.buildFeedPostAlert({
    coachId: 'coach-1',
    tahliaUser,
    transaction: pbTx,
    now: new Date('2026-07-03T01:00:00.000Z'),
});
assert.strictEqual(pbAlert.data.activity_type, 'personal_best');
assert.strictEqual(pbAlert.data.proposed_actions[0].payload.media_type, 'workout_card');
assert.strictEqual(pbAlert.data.proposed_actions[0].payload.card_payload.card_type, 'pb');
assert.strictEqual(JSON.parse(pbAlert.data.proposed_actions[0].payload.caption).card_type, 'pb');

const fitnessDiaryAlert = worker.buildFeedPostAlert({
    coachId: 'coach-1',
    tahliaUser,
    transaction: nightCheckinTx,
    now: new Date('2026-07-03T11:00:00.000Z'),
});
assert.strictEqual(fitnessDiaryAlert.data.activity_type, 'fitness_diary');
assert.strictEqual(fitnessDiaryAlert.data.proposed_actions[0].payload.media_type, 'checkin_card');
assert.strictEqual(fitnessDiaryAlert.data.proposed_actions[0].payload.card_payload.card_type, 'fitness_diary');
assert.strictEqual(JSON.parse(fitnessDiaryAlert.data.proposed_actions[0].payload.caption).card_type, 'fitness_diary');

const commentAlert = worker.buildCommentAlert({
    coachId: 'coach-1',
    tahliaUser,
    story: {
        id: 'story-1',
        user_id: 'member-1',
        media_type: 'meal_card',
        media_url: 'https://cdn.example.com/story-1.jpg',
        thumbnail_url: 'https://cdn.example.com/story-1-thumb.jpg',
        background_color: '#fff7ed',
        caption: JSON.stringify({ card_type: 'meal', share_caption: 'tofu bowl after training' }),
        created_at: '2026-07-03T00:20:00.000Z',
    },
    author: { name: 'Abbey' },
    now: new Date('2026-07-03T01:00:00.000Z'),
});

assert.strictEqual(commentAlert.data.proposed_actions[0].type, 'publish_tahlia_feed_comment');
assert.strictEqual(commentAlert.data.target_story_author_name, 'Abbey');
assert.strictEqual(commentAlert.data.evidence.story_media_url, 'https://cdn.example.com/story-1.jpg');
assert.strictEqual(commentAlert.data.evidence.story_thumbnail_url, 'https://cdn.example.com/story-1-thumb.jpg');
assert.strictEqual(commentAlert.data.evidence.story_background_color, '#fff7ed');
assert.match(commentAlert.data.draft_text, /meal|win|solid|yum|good|love/i);
assert.doesNotMatch(commentAlert.data.draft_text, /looks/i);

const workoutCommentAlert = worker.buildCommentAlert({
    coachId: 'coach-1',
    tahliaUser,
    story: {
        id: 'story-workout-1',
        user_id: 'member-2',
        media_type: 'workout_card',
        caption: JSON.stringify(workoutCardPayload),
        created_at: '2026-07-03T00:25:00.000Z',
    },
    author: { name: 'Miranda' },
    now: new Date('2026-07-03T01:00:00.000Z'),
});

assert.strictEqual(workoutCommentAlert.data.evidence.story_card_type, 'workout');
assert.strictEqual(workoutCommentAlert.data.evidence.story_card_data.workout_name, 'Upper Body');
assert.match(workoutCommentAlert.data.evidence.story_text, /Lat Pulldown/i);
assert.doesNotMatch(workoutCommentAlert.data.draft_text, /session win/i);

assert.deepStrictEqual(worker.shouldConsiderStory({
    story: { id: 'story-2', user_id: tahliaUser.id },
    author: {},
    tahliaId: tahliaUser.id,
    shannonId: 'coach-1',
}), { ok: false, reason: 'own_post' });

assert.deepStrictEqual(worker.shouldConsiderStory({
    story: { id: 'story-3', user_id: 'member-2', caption: 'hospital and pain update' },
    author: {},
    tahliaId: tahliaUser.id,
    shannonId: 'coach-1',
}), { ok: false, reason: 'sensitive_post' });

assert.strictEqual(coachAction.isTahliaSocialAction({ type: 'publish_tahlia_feed_post' }), true);
assert.strictEqual(coachAction.isTahliaSocialAction({ type: 'publish_tahlia_feed_comment' }), true);
assert.strictEqual(coachAction.isTahliaSocialAction({ type: 'move_workout_days' }), false);
assert.strictEqual(coachAction.isAllowedTahliaPostActivityType('workout'), true);
assert.strictEqual(coachAction.isAllowedTahliaPostActivityType('personal_best'), true);
assert.strictEqual(coachAction.isAllowedTahliaPostActivityType('fitness_diary'), true);
assert.strictEqual(coachAction.isAllowedTahliaPostActivityType('meal'), false);
assert.match(
    performSource,
    /if \(user\.is_test_account\)[\s\S]*is_test_account: false/,
    'Tahlia approvals must repair the test-account flag so her posts are visible in Feed'
);

const editedComment = coachAction.applyTahliaSocialEditFromRequest({
    data: commentAlert.data,
    action: commentAlert.data.proposed_actions[0],
    actionId: commentAlert.data.proposed_actions[0].id,
    body: {
        editedText: 'Love this, proper meal win',
        originalText: commentAlert.data.draft_text,
        editReason: 'Less polished',
        source: 'admin_dashboard_tahlia_social',
    },
    now: new Date('2026-07-03T02:00:00.000Z'),
});

assert.strictEqual(editedComment.action.payload.comment_text, 'Love this, proper meal win');
assert.strictEqual(editedComment.action.preview, 'Love this, proper meal win');
assert.strictEqual(editedComment.data.draft_text, 'Love this, proper meal win');
assert.strictEqual(editedComment.data.tahlia_social_last_edit.edit_reason, 'Less polished');
assert.strictEqual(editedComment.data.tahlia_social_last_edit.action_kind, 'feed_comment');
assert.strictEqual(editedComment.data.tahlia_social_edit_history.length, 1);
assert.strictEqual(editedComment.data.original_draft_text, commentAlert.data.draft_text);
assert.strictEqual(editedComment.data.was_edited, true);

const editedWorkoutPost = coachAction.applyTahliaSocialEditFromRequest({
    data: feedAlert.data,
    action: feedAlert.data.proposed_actions[0],
    actionId: feedAlert.data.proposed_actions[0].id,
    body: {
        editedText: 'Love this!',
        originalText: feedAlert.data.draft_text,
        editReason: 'Shorter',
        source: 'admin_dashboard_tahlia_social',
    },
    now: new Date('2026-07-03T02:10:00.000Z'),
});
const editedWorkoutCard = JSON.parse(editedWorkoutPost.action.payload.caption);
assert.strictEqual(editedWorkoutPost.action.payload.media_type, 'workout_card');
assert.strictEqual(editedWorkoutPost.action.payload.card_payload.share_caption, 'Love this!');
assert.strictEqual(editedWorkoutCard.share_caption, 'Love this!');
assert.strictEqual(editedWorkoutPost.data.draft_text, 'Love this!');

const learningExamples = worker.normalizeTahliaSocialLearningExamples([{
    id: 'edited-alert-1',
    created_at: '2026-07-03T02:00:00.000Z',
    data: editedComment.data,
}]);
assert.strictEqual(learningExamples.length, 1);
assert.strictEqual(learningExamples[0].original_text, commentAlert.data.draft_text);
assert.strictEqual(learningExamples[0].edited_text, 'Love this, proper meal win');
assert.strictEqual(
    worker.selectTahliaSocialLearningExamples(learningExamples, { actionKind: 'feed_comment', theme: 'meal' }).length,
    1
);

const learnedCommentAlert = worker.applyGeneratedTahliaDraft(commentAlert, {
    text: 'proper meal win this',
    mode: 'recent_shannon_edits',
    example_count: 1,
    example_alert_ids: ['edited-alert-1'],
});
assert.strictEqual(learnedCommentAlert.data.draft_text, 'proper meal win this');
assert.strictEqual(learnedCommentAlert.data.proposed_actions[0].payload.comment_text, 'proper meal win this');
assert.strictEqual(learnedCommentAlert.data.tahlia_social_learning.example_count, 1);
assert.strictEqual(worker.isSafeLearnedTahliaDraft('proper meal win this'), true);
assert.strictEqual(worker.isSafeLearnedTahliaDraft('you should try a calorie deficit'), false);
assert.strictEqual(worker.parseTahliaDraftReply('{"text":"little win"}'), 'little win');

assert.ok(adminSource.includes('function isTahliaSocialApprovalAlert'));
assert.ok(adminSource.includes('function isSupportedTahliaSocialApprovalAlert'));
assert.ok(adminSource.includes('function isSupportVerificationNeedsYouAlert'));
assert.ok(adminSource.includes("'personal_best', 'weigh_in'"));
assert.ok(adminSource.includes("mediaType === 'workout_card'"));
assert.ok(adminSource.includes("mediaType === 'checkin_card'"));
assert.ok(adminSource.includes('function buildCoachActionRequestBody'));
assert.ok(adminSource.includes('body.editedText = editedText'));
assert.ok(adminSource.includes('function renderTahliaSocialContext'));
assert.ok(adminSource.includes('function hydrateTahliaSocialContexts'));
assert.ok(adminSource.includes('function renderTahliaWorkoutCardDetails'));
assert.ok(adminSource.includes('function updateTahliaSocialActionEditState'));
assert.ok(adminSource.includes('Send edit'));
assert.ok(adminSource.includes('tahlia-workout-detail-row-stacked'));
assert.ok(adminSource.includes('const tahliaSentLabel'));
assert.ok(adminSource.includes('showAlertSentOverlay(alertId, tahliaSentLabel)'));
assert.ok(adminSource.includes('data-tahlia-card-details'));
assert.ok(adminSource.includes('data-tahlia-story-id'));
assert.ok(adminSource.includes('Relevant Feed post'));
assert.ok(adminSource.includes('function renderTahliaFeedCardPreview'));
assert.ok(adminSource.includes('tahlia-feed-card-preview'));
assert.ok(adminSource.includes("'Tahlia social'"));
assert.ok(netlifySource.includes('[functions."tahlia-social-worker"]'));
assert.ok(netlifySource.includes('schedule = "*/20 * * * *"'));
assert.ok(performSource.includes('publish_tahlia_feed_post'));
assert.ok(performSource.includes('publish_tahlia_feed_comment'));
assert.ok(performSource.includes('Tahlia can only publish workout, PB, or check-in posts'));
assert.ok(performSource.includes('Tahlia Feed posts must not include generated media'));
assert.ok(performSource.includes('TAHLIA_CARD_MEDIA_TYPES'));
assert.ok(performSource.includes('tahlia_social_edit_history'));
assert.ok(performSource.includes('Tahlia social action must be approved from Needs You'));

console.log('tahlia-social-worker tests passed');
