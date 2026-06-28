const assert = require('assert');

const {
    buildCurrentTurnAnchorBlock,
    buildNativeStoryConfusionRepairBlock,
    isStoryOpenerConfusionMessage,
} = require('../netlify/functions/ig-instant-draft')._test;

const singleMessageAnchor = buildCurrentTurnAnchorBlock({
    currentMessageText: 'yeah',
    lastShannonText: 'Does that work?',
});

assert.match(singleMessageAnchor, /Just-arrived message to answer/);
assert.match(singleMessageAnchor, /Write to the just-arrived message first/);
assert.match(singleMessageAnchor, /short answer\/confirmation/);

assert.strictEqual(isStoryOpenerConfusionMessage("I don\u2019t understand your question"), true);
assert.strictEqual(isStoryOpenerConfusionMessage('Sorry just seen this! It was so good'), false);
assert.strictEqual(isStoryOpenerConfusionMessage('sorry?'), true);

const storyConfusionBlock = buildNativeStoryConfusionRepairBlock({
    currentMessageText: "I don\u2019t understand your question",
    nativeStoryOutreachContext: {
        summary: {
            sent_comment: 'standing lunge couple? hows that one feel?',
            story_description: "a gym story showing a standing lunge couple with the caption 'standing lunge couple?'",
            story_visible_text: 'standing lunge couple?',
        },
    },
});

assert.match(storyConfusionBlock, /NATIVE STORY OPENER CONFUSION REPAIR/);
assert.match(storyConfusionBlock, /standing lunge couple\? hows that one feel\?/);
assert.match(storyConfusionBlock, /Do not ask a fresh qualifier/);

const normalStoryReplyBlock = buildNativeStoryConfusionRepairBlock({
    currentMessageText: 'cold but beautiful',
    nativeStoryOutreachContext: {
        summary: {
            sent_comment: 'wait canada? how was it?',
            story_description: 'a selfie story with the text Canada',
        },
    },
});
assert.strictEqual(normalStoryReplyBlock, '');

console.log('ig instant draft unanswered batch tests passed');
