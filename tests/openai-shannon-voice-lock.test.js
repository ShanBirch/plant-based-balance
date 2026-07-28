const assert = require('assert');
const {
    buildOpenAIShannonVoiceBlock,
    buildCoachBioBlock,
    buildShannonDmTuningBlock,
    buildNameUsePolicyBlock,
    rankNativeIgVoiceRows,
} = require('../netlify/functions/_lib/client-context');

const block = buildOpenAIShannonVoiceBlock();

assert.match(block, /OPENAI SHANNON VOICE LOCK/);
assert.match(block, /first words should answer or react to the latest inbound message/i);
assert.match(block, /Never use the words AI, bot, automation/i);
assert.match(block, /If a reply could be sent to almost anyone/i);
assert.match(block, /Do not defend, deny, or explain automation/i);
assert.match(block, /subtraction pass/i);
assert.match(block, /normal phone autocorrect casing/i);

const tuning = buildShannonDmTuningBlock();
const groundedPersonalVoice = `${buildCoachBioBlock()}\n${tuning}`;
assert.match(groundedPersonalVoice, /plausible low-stakes detail is still an unsupported claim/i);
assert.doesNotMatch(groundedPersonalVoice, /invent plausible|low-stakes invented|safe day texture/i);
assert.match(tuning, /July 29 live native fingerprint/i);
assert.match(tuning, /Arggg rough!/);
assert.match(tuning, /Huge shift <name>!/);
assert.match(tuning, /Do not force every reply into all lowercase/i);
assert.match(buildNameUsePolicyBlock(), /person-specific native history wins/i);
assert.match(buildNameUsePolicyBlock(), /Do not transfer that nickname pattern/i);

const rankedNativeRows = rankNativeIgVoiceRows([
    { text: 'graph newest', source: 'instagram_graph', created_at: '2026-07-29T03:00:00Z' },
    { text: 'native older', source: 'instagram_native_inbox', created_at: '2026-07-29T01:00:00Z' },
    { text: 'native newest', source: 'instagram_native_inbox', created_at: '2026-07-29T02:00:00Z' },
]);
assert.deepStrictEqual(
    rankedNativeRows.map(row => row.text),
    ['native newest', 'native older', 'graph newest'],
    'manual native inbox messages should outrank Graph/API output as voice evidence'
);

console.log('openai shannon voice lock tests passed');
