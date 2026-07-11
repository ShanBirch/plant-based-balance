const assert = require('assert');
const fs = require('fs');
const path = require('path');

const approvalApi = require('../netlify/functions/tahlia-feed-approvals')._test;
const worker = require('../netlify/functions/tahlia-social-worker')._test;
const coachAction = require('../netlify/functions/perform-coach-action')._test;

const tahlia = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Tahlia Brooks',
    email: 'seed.tahlia.brooks+kayla30@plantbased-balance.org',
    profile_photo: 'https://cdn.example.com/tahlia.jpg',
};

const postAlert = worker.buildFeedPostAlert({
    coachId: 'coach-1',
    tahliaUser: tahlia,
    transaction: {
        id: 'tx-1',
        transaction_type: 'earn_workout',
        reference_type: 'tahlia_brooks_xp_autopilot',
        points_amount: 8,
        description: 'Workout logged',
        created_at: '2026-07-09T08:10:00.000Z',
    },
    now: new Date('2026-07-09T08:20:00.000Z'),
});
postAlert.id = 'alert-post-1';
postAlert.created_at = '2026-07-09T08:20:00.000Z';

const commentAlert = worker.buildCommentAlert({
    coachId: 'coach-1',
    tahliaUser: tahlia,
    story: {
        id: 'story-1',
        user_id: 'member-1',
        media_type: 'workout_card',
        caption: JSON.stringify({ card_type: 'workout', share_caption: 'Leg day done' }),
        created_at: '2026-07-09T08:00:00.000Z',
    },
    author: { name: 'Shane' },
    now: new Date('2026-07-09T08:25:00.000Z'),
});
commentAlert.id = 'alert-comment-1';
commentAlert.created_at = '2026-07-09T08:25:00.000Z';

const projection = approvalApi.buildFeedApprovalProjection([postAlert, commentAlert], tahlia);
assert.strictEqual(projection.posts.length, 1);
assert.strictEqual(projection.comments.length, 1);
assert.strictEqual(projection.posts[0].pending_tahlia_approval, true);
assert.strictEqual(projection.posts[0].created_at, '2026-07-09T08:10:00.000Z');
assert.strictEqual(projection.posts[0].approval_alert_id, postAlert.id);
assert.strictEqual(projection.posts[0].approval_action_id, postAlert.data.proposed_actions[0].id);
assert.strictEqual(projection.posts[0].approval_draft_text, postAlert.data.draft_text);
assert.strictEqual(projection.posts[0].user_name, 'Tahlia Brooks');
assert.strictEqual(projection.posts[0].approval_draft_text, '');
assert.strictEqual(JSON.parse(projection.posts[0].caption).share_caption, undefined);
assert.strictEqual(projection.comments[0].story_id, 'story-1');
assert.strictEqual(projection.comments[0].created_at, '2026-07-09T08:25:00.000Z');
assert.strictEqual(projection.comments[0].approval_alert_id, commentAlert.id);
assert.strictEqual(projection.comments[0].approval_draft_text, commentAlert.data.draft_text);
assert.strictEqual(
    approvalApi.stripTahliaMediaPostCopy(JSON.stringify({
        card_type: 'fitness_diary',
        title: 'Fitness Diary',
        note: 'legacy note',
    })),
    JSON.stringify({ card_type: 'fitness_diary', title: 'Fitness Diary' })
);

const dismissedAlert = { ...postAlert, status: 'dismissed' };
const wrongSourceAlert = {
    ...postAlert,
    data: { ...postAlert.data, source: 'not-tahlia-social-worker' },
};
assert.deepStrictEqual(
    approvalApi.buildFeedApprovalProjection([dismissedAlert, wrongSourceAlert], tahlia),
    { posts: [], comments: [] }
);

assert.strictEqual(
    coachAction.normalizeTahliaProposedCreatedAt('2026-07-09T08:10:00.000Z'),
    '2026-07-09T08:10:00.000Z'
);
assert.strictEqual(postAlert.data.proposed_actions[0].payload.proposed_created_at, '2026-07-09T08:10:00.000Z');
assert.strictEqual(commentAlert.data.proposed_actions[0].payload.proposed_created_at, '2026-07-09T08:25:00.000Z');

const apiSource = fs.readFileSync(path.join(__dirname, '../netlify/functions/tahlia-feed-approvals.js'), 'utf8');
const feedSource = fs.readFileSync(path.join(__dirname, '../lib/stories.js'), 'utf8');
const dashboardSource = fs.readFileSync(path.join(__dirname, '../dashboard.html'), 'utf8');
const adminSource = fs.readFileSync(path.join(__dirname, '../admin-dashboard.html'), 'utf8');
const performSource = fs.readFileSync(path.join(__dirname, '../netlify/functions/perform-coach-action.js'), 'utf8');
const privateRevealCondition = /condition\s*:\s*function\(\)\{\s*return !!\(window\.currentUser && \['bd1bccd6-56b6-4975-b708-7404c910d1a2','00a6605e-8edb-4917-85ba-24a23f179059'\]\.includes\(String\(window\.currentUser\.id \|\| ''\)\)\);\s*\}/g;

assert.ok(apiSource.includes("!SHANNON_FEED_REVIEW_USER_IDS.has(String(user.id || ''))"));
assert.ok(apiSource.includes("'00a6605e-8edb-4917-85ba-24a23f179059'"));
assert.ok(apiSource.includes("'Cache-Control': 'private, no-store, max-age=0'"));
assert.ok(feedSource.includes("fetch('/.netlify/functions/tahlia-feed-approvals'"));
assert.ok(feedSource.includes('SHANNON_FEED_REVIEW_USER_IDS.has'));
assert.ok(feedSource.includes('loadTahliaFeedApprovals({ force: !append && tahliaFeedApprovalState.loaded })'));
assert.ok(feedSource.includes('renderTahliaFeedApprovalPanel(story)'));
assert.ok(feedSource.includes('mergePendingTahliaComments'));
assert.ok(feedSource.includes('Only you can see this'));
assert.ok(feedSource.includes('beginTahliaInlineEdit'));
assert.ok(feedSource.includes('saveTahliaInlineEdit'));
assert.ok(feedSource.includes('publishTahliaPostInPlace'));
assert.ok(feedSource.includes('publishTahliaCommentInPlace'));
assert.ok(!feedSource.includes('refreshFeedAfterTahliaApproval'));
assert.ok(feedSource.includes('saveOnly: true'));
assert.ok(feedSource.includes('Future drafts will learn from it.'));
assert.ok(feedSource.includes('Send edit'));
assert.ok(feedSource.includes("fetch('/.netlify/functions/perform-coach-action'"));
assert.ok(feedSource.includes("fetch('/.netlify/functions/dismiss-coach-reply'"));
assert.ok(dashboardSource.includes("id: 'tahlia-private-feed-approval-v1'"));
assert.ok(dashboardSource.includes("id: 'tahlia-private-feed-edit-learning-v2'"));
assert.ok(dashboardSource.includes("sel: '.tahlia-feed-approval-panel'"));
assert.ok(dashboardSource.includes("sel: '.tahlia-feed-approval-edit'"));
assert.strictEqual(
    (dashboardSource.match(privateRevealCondition) || []).length,
    4,
    'All Tahlia guided tour and Feature Drop entries must stay restricted to Shannon account IDs'
);
assert.ok(dashboardSource.includes('html.pbb-theme-dark'));
assert.ok(dashboardSource.includes('.tahlia-feed-inline-editor'));
assert.ok(!dashboardSource.includes('.tahlia-feed-edit-overlay'));
assert.ok(performSource.includes('created_at: proposedCreatedAt'));
assert.ok(performSource.includes('SHANNON_FEED_REVIEW_USER_IDS'));
assert.ok(performSource.includes("body.saveOnly === true"));
assert.ok(performSource.includes('tahlia_social_learning_pending: true'));
assert.ok(adminSource.includes('if (isTahliaSocialApprovalAlert(alert)) return false;'));
assert.ok(adminSource.includes('if (isTahliaSocialApprovalAlert(row)) return;'));

console.log('tahlia-feed-approval tests passed');
