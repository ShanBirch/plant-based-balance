const assert = require('assert');

const workoutTouch = require('../netlify/functions/recent-workout-touch-scan')._test;

const NOW = new Date('2026-06-08T02:00:00.000Z');

function assignment(overrides = {}) {
    return {
        coach_id: 'coach-1',
        client_id: 'client-1',
        client: {
            name: 'Shane',
            email: 'shane@example.com',
            is_test_account: false,
        },
        ...overrides,
    };
}

function thread(overrides = {}) {
    return {
        id: 'thread-1',
        subscriber_id: 'ig_graph:account-1:recipient-1',
        ig_username: 'shane_minahan',
        profile_name: 'Shane',
        linked_user_id: 'client-1',
        last_inbound_at: '2026-06-08T01:00:00.000Z',
        custom_data: {
            instagram_graph: {
                ig_graph_user_id: 'recipient-1',
                ig_account_id: 'account-1',
            },
        },
        ...overrides,
    };
}

assert.strictEqual(workoutTouch.exerciseCategory('Front Squat').key, 'front_squat');
assert.strictEqual(workoutTouch.exerciseCategory('Romanian Deadlift').key, 'hinge');
assert.strictEqual(workoutTouch.exerciseCategory('Cable Row').key, 'pull');

const rows = [
    {
        user_id: 'client-1',
        template_name: 'Front Squat Program',
        workout_date: '2026-06-08',
        exercise_name: 'Front Squat',
        set_number: 1,
        reps: 5,
        weight_kg: 60,
        created_at: '2026-06-08T01:43:00.000Z',
    },
    {
        user_id: 'client-1',
        template_name: 'Front Squat Program',
        workout_date: '2026-06-08',
        exercise_name: 'Front Squat',
        set_number: 2,
        reps: 5,
        weight_kg: 65,
        created_at: '2026-06-08T01:44:00.000Z',
    },
    {
        user_id: 'client-1',
        template_name: 'Front Squat Program',
        workout_date: '2026-06-08',
        exercise_name: 'Leg Press',
        set_number: 1,
        reps: 12,
        weight_kg: 120,
        created_at: '2026-06-08T01:45:00.000Z',
    },
];

const session = workoutTouch.summarizeWorkoutSession(rows);
assert.strictEqual(session.templateName, 'Front Squat Program');
assert.strictEqual(session.exerciseCount, 2);
assert.strictEqual(session.setRows, 3);
assert.strictEqual(session.completedAt, '2026-06-08T01:45:00.000Z');
assert.strictEqual(session.highlight.key, 'front_squat');
assert.strictEqual(
    workoutTouch.buildWorkoutTouchMessage(session),
    'yo, those front squats looked solid. how was the session?'
);

const grouped = workoutTouch.groupWorkoutSessions([
    ...rows,
    {
        user_id: 'client-2',
        template_name: 'Upper Body',
        workout_date: '2026-06-08',
        exercise_name: 'Bench Press',
        created_at: '2026-06-08T01:40:00.000Z',
    },
]);
assert.strictEqual(grouped.length, 2, 'rows should group into one session per user/date/template');

const alert = workoutTouch.buildNeedsYouAlert({
    assignment: assignment(),
    thread: thread(),
    session,
    now: NOW,
});
assert.strictEqual(alert.alert_type, 'weekly_checkin');
assert.strictEqual(alert.status, 'pending');
assert.strictEqual(alert.data.operator_queue, 'needs_you');
assert.strictEqual(alert.data.recent_workout_touch, true);
assert.strictEqual(alert.data.needs_shannon_approval, true);
assert.strictEqual(alert.data.delivery_channel, 'instagram_graph');
assert.match(alert.suggested_message, /front squats looked solid/);
assert.deepStrictEqual(alert.data.recent_workout_touch_evidence.exercise_names, ['Front Squat', 'Leg Press']);

const oldThreadAlert = workoutTouch.buildNeedsYouAlert({
    assignment: assignment(),
    thread: thread({ last_inbound_at: '2026-06-06T01:00:00.000Z' }),
    session,
    now: NOW,
});
assert.strictEqual(oldThreadAlert.data.delivery_channel, 'manual_ig');
assert.strictEqual(oldThreadAlert.data.manual_ig_required, true);

const key = workoutTouch.workoutTouchIdempotencyKey({
    assignment: assignment(),
    session,
});
assert.ok(key.includes('recent_workout_touch:coach-1:client-1:2026-06-08T01:45:00.000Z'));

assert.strictEqual(
    workoutTouch.buildWorkoutTouchMessage({
        highlight: { key: 'general' },
    }),
    'yo, workout looked sweet. how was it?'
);

console.log('recent workout touch scan tests passed');
