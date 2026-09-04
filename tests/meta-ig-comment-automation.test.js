const assert = require('assert');

const automation = require('../netlify/functions/_lib/meta-ig-comment-automation')._test;

assert.strictEqual(
    automation.keywordMatches('Neuroscience please', 'neuroscience'),
    true,
    'keyword matching should be case-insensitive'
);

assert.strictEqual(
    automation.keywordMatches('can you send the neuroscience link?', 'neuroscience'),
    true,
    'keyword matching should tolerate punctuation'
);

assert.strictEqual(
    automation.keywordMatches('i love neurosciences', 'neuroscience'),
    false,
    'single-word keywords should not match longer words'
);

assert.strictEqual(
    automation.keywordMatches('send the free will paper', 'free will'),
    true,
    'multi-word aliases should match exact normalized phrases'
);

const row = {
    active: true,
    bot_account: 'shan_n_sunny',
    target_handle: '@shan_n_sunny',
    ig_media_id: 'media-1',
    post_slug: 'free-will-willpower',
    keyword: 'neuroscience',
    keyword_aliases: ['free will'],
};

const match = automation.automationMatchesComment(row, {
    event: {
        text: 'Neuroscience',
        mediaId: 'media-1',
    },
    contentItem: {
        source_key: 'ig_media:media-1',
    },
    accountConfig: {
        botAccount: 'shan_n_sunny',
    },
});

assert.strictEqual(match.ok, true, 'active automation should match account, media id, and keyword');
assert.strictEqual(match.matchedKeyword, 'neuroscience', 'match result should expose the keyword that triggered');

const wrongMedia = automation.automationMatchesComment(row, {
    event: {
        text: 'Neuroscience',
        mediaId: 'media-2',
    },
    accountConfig: {
        botAccount: 'shan_n_sunny',
    },
});

assert.strictEqual(wrongMedia.ok, false, 'automation should not match the wrong reel');
assert.strictEqual(wrongMedia.reason, 'media_mismatch');

const templated = automation.fillTemplate(
    'Here you go: {landingUrl} keyword={keyword} user={username}',
    {
        row: {
            landing_url: 'https://plantbased-balance.org/science/free-will-willpower/',
            keyword: 'neuroscience',
        },
        event: {
            username: 'example_user',
        },
        matchedKeyword: 'neuroscience',
    }
);

assert.strictEqual(
    templated,
    'Here you go: https://plantbased-balance.org/science/free-will-willpower/ keyword=neuroscience user=example_user',
    'private reply templates should fill landing URL, keyword, and username'
);

const leadContext = automation.buildCommentResourceLeadContext({
    row: {
        id: 'automation-1',
        post_slug: 'free-will-willpower',
        keyword: 'neuroscience',
        cta_text: "Comment neuroscience and I'll send the study.",
        landing_url: 'https://plantbased-balance.org/science/free-will-willpower/',
        source_post_json: {
            publicTitle: 'Free will, willpower, and fitness behaviour',
            paper: {
                title: 'Unconscious determinants of free decisions in the human brain',
                authors: 'Soon, Brass, Heinze and Haynes',
                year: 2008,
            },
            resource: {
                eyebrow: 'Neuroscience / Fitness Behaviour',
                headline: 'Willpower is a terrible plan.',
            },
        },
    },
    event: {
        mediaId: 'media-1',
        commentId: 'comment-1',
        fromId: 'lead-1',
        username: 'example_user',
    },
    matchedKeyword: 'neuroscience',
    privateReplyMessage: 'Here is the link',
    privateReplyId: 'reply-1',
    status: 'sent',
    sentAt: '2026-06-21T01:02:03.000Z',
});

assert.strictEqual(leadContext.source_lane, 'science_comment_resource');
assert.strictEqual(leadContext.funnel, 'free_challenge');
assert.strictEqual(leadContext.link_sent, true);
assert.strictEqual(leadContext.landing_url, 'https://plantbased-balance.org/science/free-will-willpower/');
assert.strictEqual(leadContext.paper_title, 'Unconscious determinants of free decisions in the human brain');
assert.strictEqual(
    leadContext.next_step.includes('normal organic Balance Learn conversation'),
    true,
    'lead context should keep the AI in the organic Balance Learn conversation path'
);

const exerciseLeadContext = automation.buildCommentResourceLeadContext({
    row: {
        id: 'automation-rdl-1',
        post_slug: 'dumbbell-rdl-form-fix-2026-06-21',
        keyword: 'rdl',
        keyword_aliases: ['hinge'],
        cta_text: "Comment RDL and I'll send you the checklist.",
        landing_url: 'https://www.instagram.com/reel/DZ05qzCkmEA/',
        source_post_json: {
            source_lane: 'exercise_comment_flow',
            funnel: 'exercise_form_fix',
            content_type: 'exercise_reel',
            exercise: 'Dumbbell RDL',
            main_mistake: 'Turning the hip hinge into a squat so the lower back takes over.',
            context_summary: 'RDL reel explaining how to hinge from the hips without annoying the lower back.',
            reply_guidance: 'If they reply BACK, troubleshoot brace, hips back, load, and range.',
            suggested_next_question: 'Where do you feel the rep first, hamstrings or lower back?',
            full_script: 'Alright potatoes, if your RDL hurts your lower back...',
            coaching_points: [
                'Brace your core',
                'Push your bum backwards',
                'Soft knees, shins still',
            ],
        },
    },
    event: {
        mediaId: '18395417650088523',
        commentId: 'comment-rdl-1',
        fromId: 'lead-rdl-1',
        username: 'rdl_user',
    },
    matchedKeyword: 'RDL',
    privateReplyMessage: 'Here is the RDL checklist',
    privateReplyId: 'reply-rdl-1',
    status: 'sent',
    sentAt: '2026-06-21T02:02:03.000Z',
});

assert.strictEqual(exerciseLeadContext.source_lane, 'exercise_comment_flow');
assert.strictEqual(exerciseLeadContext.funnel, 'exercise_form_fix');
assert.strictEqual(exerciseLeadContext.exercise, 'Dumbbell RDL');
assert.strictEqual(exerciseLeadContext.coaching_points.includes('Push your bum backwards'), true);
assert.strictEqual(
    exerciseLeadContext.next_step.includes('exercise reel context'),
    true,
    'exercise comment flow should tell the AI to keep the exercise reel context'
);

const goldCoastAiRow = {
    active: true,
    bot_account: 'goldcoast_ai_solutions',
    target_handle: '@goldcoast_ai_solutions',
    ig_media_id: 'gcai-media-1',
    source_key: 'ig_media:gcai-media-1',
    post_slug: 'disney-ai-ads-checklist',
    keyword: 'ads',
    keyword_aliases: [],
};

const goldCoastAiMatch = automation.automationMatchesComment(goldCoastAiRow, {
    event: {
        text: 'ADS',
        mediaId: 'gcai-media-1',
    },
    contentItem: {
        source_key: 'ig_media:gcai-media-1',
    },
    accountConfig: {
        botAccount: 'goldcoast_ai_solutions',
    },
});

assert.strictEqual(goldCoastAiMatch.ok, true, 'Gold Coast AI ADS campaign should match the intended reel');
assert.strictEqual(goldCoastAiMatch.matchedKeyword, 'ads');

const goldCoastAiWrongMedia = automation.automationMatchesComment(goldCoastAiRow, {
    event: {
        text: 'ADS',
        mediaId: 'other-media',
    },
    accountConfig: {
        botAccount: 'goldcoast_ai_solutions',
    },
});

assert.strictEqual(goldCoastAiWrongMedia.ok, false, 'Gold Coast AI ADS campaign should not match another reel');
assert.strictEqual(goldCoastAiWrongMedia.reason, 'media_mismatch');

const goldCoastAiWrongAccount = automation.automationMatchesComment(goldCoastAiRow, {
    event: {
        text: 'ADS',
        mediaId: 'gcai-media-1',
    },
    accountConfig: {
        botAccount: 'shan_n_sunny',
    },
});

assert.strictEqual(goldCoastAiWrongAccount.ok, false, 'Gold Coast AI ADS campaign should not match another account');
assert.strictEqual(goldCoastAiWrongAccount.reason, 'account_mismatch');

console.log('meta ig comment automation tests passed');
