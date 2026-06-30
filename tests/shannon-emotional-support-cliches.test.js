const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
    buildMemoryBlock,
    buildCoachBioBlock,
    buildShannonDmTuningBlock,
} = require('../netlify/functions/_lib/client-context');

const block = buildShannonDmTuningBlock();
const bioBlock = buildCoachBioBlock();
const clientContextSource = fs.readFileSync(path.join(__dirname, '../netlify/functions/_lib/client-context.js'), 'utf8');

assert.ok(block.includes('Emotional replies need one true acknowledgement'), 'warns against validation stacks');
assert.ok(block.includes('support-line closers'), 'names support-line closers as a pattern');
assert.ok(block.includes('"I\'m here for you"'), 'calls out the repeated here-for-you closer');
assert.ok(block.includes('"if you need to talk about it"'), 'calls out talk-about-it closers');
assert.ok(block.includes('Use them sparingly'), 'allows support closers only sparingly');
assert.ok(block.includes('If a similar reassurance already appeared recently, do not repeat it'), 'prevents repeated reassurance loops');
assert.ok(block.includes('Live edit pattern from the last 30 days'), 'learns from recent edits that remove optional curiosity questions');
assert.ok(block.includes('reaction + extra question'), 'prevents reaction-plus-question overreach');
assert.ok(block.includes('reaction-only pattern'), 'teaches examples where Shannon keeps only the reaction');
assert.ok(block.includes('Avoid neat life-coach prompts'), 'prevents polished life-coach follow-up prompts in casual rapport');
assert.ok(block.includes('before Hawaii feels real'), 'captures the Hawaii-style AI-ish question pattern');
assert.ok(block.includes('Current-status answers are answers'), 'prevents asking for status they just gave');
assert.ok(block.includes('just pain when i walk'), 'captures Fra-style pain status repeat');
assert.ok(clientContextSource.includes('Do not warn just because a lead/client reply is short and reaction-only'), 'draft QA respects reaction-only Shannon sends');
assert.ok(clientContextSource.includes('Warn if the draft tacks an optional curiosity question'), 'draft QA catches unnecessary curiosity questions');
assert.ok(clientContextSource.includes('Warn when the draft asks for a current status'), 'draft QA catches redundant current-status questions');
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
