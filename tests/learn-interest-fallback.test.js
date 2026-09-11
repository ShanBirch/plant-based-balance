const test = require('node:test');
const assert = require('node:assert/strict');
const {buildPaidMetaTailoredOfferChunks} = require('../netlify/functions/ig-instant-draft')._test;

for (const message of [
  "I don't want weight loss. I want strength but keep losing interest.",
  'I get bored and lose motivation.',
  'I lose interest after a couple of weeks.',
]) test(`writer outage still acknowledges interest: ${message}`, () => {
  const reply = buildPaidMetaTailoredOfferChunks(message, message, 'broad_pain').join('\n');
  assert.match(reply, /interest|boredom|motivation/i);
  assert.doesNotMatch(reply, /lose weight|losing fat|gym anxiety|cravings/i);
  assert.match(reply, /149/);
});

test('negated boredom does not get asserted as the problem', () => {
  const reply = buildPaidMetaTailoredOfferChunks("I'm not bored. My shifts make it hard.", 'Strength', 'broad_pain').join('\n');
  assert.doesNotMatch(reply, /interest|boredom|motivation/i);
  assert.match(reply, /schedule/i);
});
