const assert = require('assert');
const fs = require('fs');
const path = require('path');

const profile = require('../netlify/functions/_lib/tahlia-profile');
const worker = require('../netlify/functions/tahlia-social-worker')._test;
const coachAction = require('../netlify/functions/perform-coach-action')._test;

const adminSource = fs.readFileSync(path.join(__dirname, '../admin-dashboard.html'), 'utf8');
const performSource = fs.readFileSync(path.join(__dirname, '../netlify/functions/perform-coach-action.js'), 'utf8');

assert.strictEqual(profile.TAHLIA_PROFILE.displayName, 'Tahlia Brooks');
assert.strictEqual(profile.TAHLIA_PROFILE.age, 25);
assert.strictEqual(profile.TAHLIA_PROFILE.gender, 'female');
assert.ok(profile.TAHLIA_PROFILE.voice.avoids.includes('mentions of AI, bots, automation, seeded accounts, or testing'));

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
assert.ok(['weigh_in', 'fitness_diary'].includes(worker.pointTransactionActivityType(checkinTx)));
assert.strictEqual(worker.isAllowedTahliaPostActivityType('workout'), true);
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
assert.strictEqual(coachAction.isAllowedTahliaPostActivityType('fitness_diary'), true);
assert.strictEqual(coachAction.isAllowedTahliaPostActivityType('meal'), false);

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

assert.ok(adminSource.includes('function isTahliaSocialApprovalAlert'));
assert.ok(adminSource.includes('function isSupportedTahliaSocialApprovalAlert'));
assert.ok(adminSource.includes('function buildCoachActionRequestBody'));
assert.ok(adminSource.includes('body.editedText = editedText'));
assert.ok(adminSource.includes('function renderTahliaSocialContext'));
assert.ok(adminSource.includes('function hydrateTahliaSocialContexts'));
assert.ok(adminSource.includes('function renderTahliaWorkoutCardDetails'));
assert.ok(adminSource.includes('data-tahlia-card-details'));
assert.ok(adminSource.includes('data-tahlia-story-id'));
assert.ok(adminSource.includes('Relevant Feed post'));
assert.ok(adminSource.includes("'Tahlia social'"));
assert.ok(performSource.includes('publish_tahlia_feed_post'));
assert.ok(performSource.includes('publish_tahlia_feed_comment'));
assert.ok(performSource.includes('Tahlia can only publish workout or check-in text posts'));
assert.ok(performSource.includes('Tahlia Feed posts must be text-only'));
assert.ok(performSource.includes('tahlia_social_edit_history'));
assert.ok(performSource.includes('Tahlia social action must be approved from Needs You'));

console.log('tahlia-social-worker tests passed');
