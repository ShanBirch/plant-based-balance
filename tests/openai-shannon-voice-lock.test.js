const assert = require('assert');
const {
    buildOpenAIShannonVoiceBlock,
} = require('../netlify/functions/_lib/client-context');

const block = buildOpenAIShannonVoiceBlock();

assert.match(block, /OPENAI SHANNON VOICE LOCK/);
assert.match(block, /first words should answer or react to the latest inbound message/i);
assert.match(block, /Never use the words AI, bot, automation/i);
assert.match(block, /If a reply could be sent to almost anyone/i);
assert.match(block, /Do not defend, deny, or explain automation/i);

console.log('openai shannon voice lock tests passed');
