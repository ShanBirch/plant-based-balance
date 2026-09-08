const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDeterministicPaidMetaConversationReply: build, shouldApplyDeterministicPaidMetaReplyOverride: selected, buildPaidMetaConversationApproval: approve } = require('../netlify/functions/ig-instant-draft')._test;
const base = { flowVariant: 'broad_pain', checkoutUrl: 'https://future-balance.netlify.app/fitness', appPreviewUrl: 'https://future-balance.netlify.app/p/Test_123-xyz9876543210', allowVideoAttachment: true };
test('short acceptance delivers the offered preview across natural invitation wording', () => {
  for (const text of ['Want to see the preview?', 'Would you like a free app preview first?', 'Want me to send you the preview?']) {
    for (const currentMessage of ['yep', 'Yes please']) {
      const draft = build({...base, currentMessage, history:[{direction:'out',text}]});
      assert.equal(draft.appPreviewHandoff, true);
      assert.match(draft.joined, /https:\/\/future-balance.netlify.app\/p\//);
      assert.equal(approve({metaAdConversationFastLane:true, draft, currentMessage})?.required, false);
    }
  }
});
test('two-sentence signup request reaches checkout while negated request does not', () => {
  assert.equal(build({...base,currentMessage:'I want to join. Please send the signup link.'}).replyMode, 'campaign_buyer_handoff');
  assert.notEqual(build({...base,currentMessage:"I don't want to join. Don't send the signup link."})?.replyMode,'campaign_buyer_handoff');
});
test('goal proof survives the progression selector and typo input', () => {
  for (const currentMessage of ['I want to build strength', 'loose wieght']) {
    const draft = build({...base,currentMessage});
    assert.ok(draft.imageAttachmentUrl);
    assert.equal(selected(draft),true);
  }
});
test('combined goal and blocker preserves photo and native course video without rediscovery', () => {
  const draft = build({...base,currentMessage:'I want to feel fitter and stronger. My shifts change every week, so fixed training days never stick. I need something flexible.'});
  assert.ok(draft.imageAttachmentUrl);
  assert.ok(draft.videoAttachmentUrl);
  assert.doesNotMatch(draft.joined,/what.*gets in the way/i);
});
test('course facts and weekly terms answer the actual question', () => {
  const curriculum = build({...base,currentMessage:'How many lessons and is there a certificate?'});
  assert.match(curriculum.joined,/31 lessons/);
  assert.match(curriculum.joined,/Certificate of Completion/);
  const weekly = build({...base,currentMessage:'Can I pay weekly? Does it keep charging after six weeks?'});
  assert.match(weekly.joined,/24\.83/);
  assert.match(weekly.joined,/continues weekly.*cancel/);
  assert.match(weekly.joined,/148\.98/);
});
