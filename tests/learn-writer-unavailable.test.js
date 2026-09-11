const test = require('node:test');
const assert = require('node:assert/strict');
const {buildPaidMetaUnavailableAcknowledgement, isPaidMetaUnavailableAcknowledgement, buildPaidMetaConversationApproval, collectPaidMetaWriterContractIssues, getAutoDmHoldReason} = require('../netlify/functions/ig-instant-draft')._test;

test('an unavailable writer yields a sendable, honest acknowledgement with retained diagnosis', () => {
  const draft=buildPaidMetaUnavailableAcknowledgement('429 no credits remaining');
  assert.equal(draft.error,null);
  assert.match(draft.writerFailure,/429/);
  assert.match(draft.joined,/reply system is having trouble/);
  assert.doesNotMatch(draft.joined,/https?:|149|beginners|yes/i);
  assert.deepEqual(collectPaidMetaWriterContractIssues({draft,currentMessage:'Is it suitable for beginners?',flowVariant:'broad_pain'}),[]);
  const approval=buildPaidMetaConversationApproval({metaAdConversationFastLane:true,draft,currentMessage:'Is it suitable for beginners?'});
  assert.equal(approval?.required,false);
  assert.notEqual(getAutoDmHoldReason({draft})?.code,'draft_unavailable');
});

test('outage approval requires the exact reviewed acknowledgement and never bypasses sensitive gates', () => {
  const draft=buildPaidMetaUnavailableAcknowledgement('offline');
  assert.equal(isPaidMetaUnavailableAcknowledgement({...draft,joined:'Buy now',chunks:['Buy now']}),false);
  assert.equal(isPaidMetaUnavailableAcknowledgement({...draft,appPreviewHandoff:true}),false);
  assert.equal(buildPaidMetaConversationApproval({metaAdConversationFastLane:false,draft,currentMessage:'Hi'}),null);
  assert.equal(buildPaidMetaConversationApproval({metaAdConversationFastLane:true,linkedUserId:'client',draft,currentMessage:'Hi'}),null);
  assert.equal(buildPaidMetaConversationApproval({metaAdConversationFastLane:true,draft,currentMessage:'Stop messaging me'}),null);
});
