const assert = require('assert');
const {
    buildOpenAIShannonVoiceBlock,
    buildCoachBioBlock,
    buildShannonDmTuningBlock,
} = require('../netlify/functions/_lib/client-context');

const block = buildOpenAIShannonVoiceBlock();

assert.match(block, /OPENAI SHANNON VOICE LOCK/);
assert.match(block, /first words should answer or react to the latest inbound message/i);
assert.match(block, /Never use the words AI, bot, automation/i);
assert.match(block, /If a reply could be sent to almost anyone/i);
assert.match(block, /Do not defend, deny, or explain automation/i);

const groundedPersonalVoice = `${buildCoachBioBlock()}\n${buildShannonDmTuningBlock()}`;
assert.match(groundedPersonalVoice, /plausible low-stakes detail is still an unsupported claim/i);
assert.doesNotMatch(groundedPersonalVoice, /invent plausible|low-stakes invented|safe day texture/i);

console.log('openai shannon voice lock tests passed');
