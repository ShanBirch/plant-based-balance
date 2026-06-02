const assert = require('assert');

const {
    buildMemoryBlock,
    buildCoachBioBlock,
    buildShannonDmTuningBlock,
} = require('../netlify/functions/_lib/client-context');

const block = buildShannonDmTuningBlock();
const bioBlock = buildCoachBioBlock();

assert.ok(block.includes('Emotional replies need one true acknowledgement'), 'warns against validation stacks');
assert.ok(block.includes('support-line closers'), 'names support-line closers as a pattern');
assert.ok(block.includes('"I\'m here for you"'), 'calls out the repeated here-for-you closer');
assert.ok(block.includes('"if you need to talk about it"'), 'calls out talk-about-it closers');
assert.ok(block.includes('Use them sparingly'), 'allows support closers only sparingly');
assert.ok(block.includes('If a similar reassurance already appeared recently, do not repeat it'), 'prevents repeated reassurance loops');
assert.ok(block.includes('Vegetarian voice guard'), 'keeps meat praise out of Shannon DM tuning');
assert.ok(block.includes('do not call meat, bacon, fish, or other animal products yum/elite/delicious'), 'prevents praising meat in Shannon voice');
assert.ok(bioBlock.includes('Shannon is vegetarian'), 'keeps vegetarian fact in coach bio');
assert.ok(bioBlock.includes('do not praise meat, bacon, fish, or other animal products'), 'keeps meat praise out of coach bio facts');

const memoryBlock = buildMemoryBlock({
    coach_instructions: [
        'For Abbey: do not use her name in normal DM replies.',
        '',
        'Learned from Shannon edits:',
        '- When Abbey is expressing distress or dealing with difficulties, prioritize acknowledging her situation and offering support.',
        "- When Abbey is expressing distress or dealing with difficulties, avoid answering casual check-ins about your own day or providing factual information, even if asked.",
    ].join('\n'),
});

assert.ok(memoryBlock.includes('For distress, acknowledge one specific thing'), 'softens stale offer-support memory bullets');
assert.ok(memoryBlock.includes('do not default to "I\'m here for you"'), 'keeps support closer warning in client memory');
assert.ok(memoryBlock.includes('acknowledge the heavy bit first, then answer briefly'), 'preserves direct Shannon questions inside heavy threads');
assert.ok(!memoryBlock.includes('offering support'), 'removes generic offer-support phrasing');
assert.ok(!memoryBlock.includes('avoid answering casual check-ins'), 'removes over-strict direct-question suppression');

console.log('shannon emotional support cliche tests passed');
