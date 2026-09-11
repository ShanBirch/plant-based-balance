const test = require('node:test');
const assert = require('node:assert/strict');
const {buildPaidMetaUnavailableDraft, isAutomatedOutageNotice, buildPaidMetaConversationApproval, getAutoDmHoldReason} = require('../netlify/functions/ig-instant-draft')._test;

test('writer failure stays empty and held, with diagnosis retained', () => {
  const draft=buildPaidMetaUnavailableDraft('429 no credits remaining');
  assert.deepEqual(draft.chunks,[]);
  assert.equal(draft.joined,'');
  assert.match(draft.error,/429/);
  assert.match(draft.writerFailure,/429/);
  assert.equal(buildPaidMetaConversationApproval({metaAdConversationFastLane:true,draft,currentMessage:'Is it suitable for beginners?'}),null);
  assert.equal(getAutoDmHoldReason({draft})?.code,'draft_unavailable');
});
for(const text of [
  'Sorry, our reply system is having trouble right now. Please try again a little later.',
  'Sorry, our reply is having trouble right now. Please try again a little later.',
  'Sorry. This message cannot be replied to right now.',
]) test(`old outage copy cannot auto-send: ${text}`, () => {
  assert.equal(isAutomatedOutageNotice(text),true);
  assert.equal(getAutoDmHoldReason({draft:{joined:text,chunks:[text],model:'deterministic_paid_meta_unavailable_v1'}})?.code,'draft_unavailable');
});
test('ordinary replies are unaffected', () => {
  assert.equal(isAutomatedOutageNotice('Hey, how are you?'),false);
  assert.equal(isAutomatedOutageNotice('No worries, I will not send the preview.'),false);
});
