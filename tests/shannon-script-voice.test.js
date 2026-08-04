const assert = require('assert');
const { analyzeScript } = require('../scripts/check-shannon-script-voice');
const { isSingleSpeaker, uniqueSpeakers } = require('../scripts/analyze-shannon-spoken-voice');

assert.equal(isSingleSpeaker({ segments: [{ speaker: 'A' }, { speaker: 'A' }] }), true);
assert.equal(isSingleSpeaker({ segments: [{ speaker: 'A' }, { speaker: 'B' }] }), false);
assert.deepStrictEqual(uniqueSpeakers({ segments: [{ speaker: 'B' }, { speaker: 'A' }, { speaker: 'B' }] }), ['B', 'A']);

const formal = analyzeScript(
    'How are you going? I would be happy to help. It is important to understand that you are not failing.',
    { context: 'dm' }
);
assert.equal(formal.valid, false);
assert(formal.issues.some(issue => issue.code === 'formal_greeting'));
assert(formal.issues.some(issue => issue.code === 'expanded_contraction'));

const shannon = analyzeScript(
    "How ya going? Umm, yeah, that's the bit I'd look at first. You're not failing. It's more that the setup keeps making the same thing hard, so we'd change one part and see what happens.",
    { context: 'dm' }
);
assert.equal(shannon.valid, true);
assert.equal(shannon.metrics.coreHesitations, 1);

const stacked = analyzeScript(
    "Ahh, umm, yeah, you're probably trying to solve too much at once, and that's why it keeps feeling harder than it needs to.",
    { context: 'dm' }
);
assert.equal(stacked.valid, false);
assert(stacked.issues.some(issue => issue.code === 'stacked_hesitations'));

const newLead = analyzeScript(
    "How ya going, bro? Ahh, that's a fair goal. What keeps getting in the way?",
    { context: 'new_lead' }
);
assert(newLead.issues.some(issue => issue.code === 'unearned_relationship_word'));

console.log('shannon-script-voice tests passed');
