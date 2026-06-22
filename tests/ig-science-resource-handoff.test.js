const assert = require('assert');

const {
    buildCommentResourceContextFromFulfillment,
    buildCommentResourceHandoffBlock,
} = require('../netlify/functions/ig-instant-draft')._test;

const context = buildCommentResourceContextFromFulfillment({
    id: 'fulfillment-1',
    automation_id: 'automation-1',
    comment_id: 'comment-1',
    ig_media_id: 'media-1',
    from_ig_user_id: 'lead-1',
    from_username: 'example_user',
    matched_keyword: 'neuroscience',
    landing_url: 'https://plantbased-balance.org/science/free-will-willpower/',
    private_reply_id: 'reply-1',
    private_reply_message: 'Here is the link',
    status: 'sent',
    sent_at: '2026-06-21T01:02:03.000Z',
    created_at: '2026-06-21T01:02:04.000Z',
    raw_payload: {
        automation: {
            post_slug: 'free-will-willpower',
            keyword: 'neuroscience',
        },
        source_post: {
            title: 'Free will, willpower, and fitness behaviour',
            topic: 'Neuroscience / Fitness Behaviour',
            paper_title: 'Unconscious determinants of free decisions in the human brain',
            paper_year: 2008,
        },
    },
});

assert.strictEqual(context.source_lane, 'science_comment_resource');
assert.strictEqual(context.funnel, 'free_challenge');
assert.strictEqual(context.link_sent, true);
assert.strictEqual(context.post_slug, 'free-will-willpower');
assert.strictEqual(context.from_username, 'example_user');

const block = buildCommentResourceHandoffBlock(context);
assert.match(block, /already been sent the resource\/study link/i);
assert.match(block, /normal free challenge lead path/i);
assert.match(block, /Do not ask if they want the resource link again/i);
assert.match(block, /Unconscious determinants of free decisions/i);

const exerciseContext = buildCommentResourceContextFromFulfillment({
    id: 'fulfillment-rdl-1',
    automation_id: 'automation-rdl-1',
    comment_id: 'comment-rdl-1',
    ig_media_id: '18395417650088523',
    from_ig_user_id: 'lead-rdl-1',
    from_username: 'rdl_user',
    matched_keyword: 'RDL',
    landing_url: 'https://www.instagram.com/reel/DZ05qzCkmEA/',
    private_reply_id: 'reply-rdl-1',
    private_reply_message: 'Here is the RDL checklist',
    status: 'sent',
    sent_at: '2026-06-21T02:02:03.000Z',
    created_at: '2026-06-21T02:02:04.000Z',
    raw_payload: {
        automation: {
            post_slug: 'dumbbell-rdl-form-fix-2026-06-21',
            keyword: 'rdl',
        },
        source_post: {
            source_lane: 'exercise_comment_flow',
            funnel: 'exercise_form_fix',
            content_type: 'exercise_reel',
            exercise: 'Dumbbell RDL',
            main_mistake: 'Turning the hip hinge into a squat so the lower back takes over.',
            context_summary: 'RDL reel explaining how to hinge from the hips without annoying the lower back.',
            reply_guidance: 'If they reply BACK, troubleshoot brace, hips back, load, and range.',
            suggested_next_question: 'Where do you feel the rep first, hamstrings or lower back?',
            full_script: 'Alright potatoes, if your RDL hurts your lower back, it is cause you cannot do them.',
            coaching_points: [
                'Brace your core',
                'Push your bum backwards',
                'Soft knees, shins still',
            ],
        },
    },
});

assert.strictEqual(exerciseContext.source_lane, 'exercise_comment_flow');
assert.strictEqual(exerciseContext.funnel, 'exercise_form_fix');
assert.strictEqual(exerciseContext.exercise, 'Dumbbell RDL');

const exerciseBlock = buildCommentResourceHandoffBlock(exerciseContext);
assert.match(exerciseBlock, /EXERCISE COMMENT-TO-DM HANDOFF/);
assert.match(exerciseBlock, /recently commented "RDL"/);
assert.match(exerciseBlock, /Dumbbell RDL/);
assert.match(exerciseBlock, /Push your bum backwards/);
assert.match(exerciseBlock, /Do not ask what this is about/i);
assert.match(exerciseBlock, /reply BACK/i);

console.log('ig science resource handoff tests passed');
