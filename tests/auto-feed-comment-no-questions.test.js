const assert = require('assert');

const autoFeedComment = require('../netlify/functions/auto-feed-comment').__test;

const workoutStory = {
    media_type: 'workout_card',
    caption: JSON.stringify({
        card_type: 'workout',
        workout_name: 'Upper day',
    }),
};

const levelUpStory = {
    media_type: 'level_up_card',
    caption: JSON.stringify({
        card_type: 'level_up',
        level: 20,
        title: 'Growing',
    }),
};

assert.doesNotMatch(
    autoFeedComment.fallbackComment(workoutStory),
    /\?/,
    'workout fallback comments should not ask questions'
);

assert.doesNotMatch(
    autoFeedComment.fallbackComment(levelUpStory),
    /\?/,
    'level-up fallback comments should not ask questions'
);

assert.strictEqual(
    autoFeedComment.normalizeGeneratedComment("level 20, growing is awesome. what's your next goal?"),
    '',
    'goal-seeking questions should be rejected'
);

assert.strictEqual(
    autoFeedComment.normalizeGeneratedComment('HELL YEAH!!'),
    'hell yeah',
    'short hype comments should survive normalization'
);

assert.strictEqual(
    autoFeedComment.normalizeGeneratedComment("let's goo!"),
    "let's goo",
    'casual hype comments with apostrophes should survive normalization'
);

console.log('auto feed comment no-question tests passed');
