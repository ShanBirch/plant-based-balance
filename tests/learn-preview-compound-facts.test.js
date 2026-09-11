const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDeterministicPaidMetaConversationReply } = require('../netlify/functions/ig-instant-draft')._test;
const previewUrl='https://future-balance.netlify.app/p/synthetic-preview-token-12345';
for(const [currentMessage, expected] of [
 ['Can I see the preview and can I do it without a gym?', /train at home/i],
 ['Send the preview please, and when does the course start?', /21 September 2026/],
 ['Can I see the preview, can I train at home, and will it charge me automatically?', /train at home[\s\S]*won.t charge/i],
]) test(`preview answers compound facts: ${currentMessage}`,()=>{
 const draft=buildDeterministicPaidMetaConversationReply({currentMessage,history:[],flowVariant:'broad_pain',appPreviewUrl:previewUrl});
 assert.equal(draft?.appPreviewHandoff,true);
 assert.match(draft.joined,expected);
 assert.ok(draft.joined.includes(previewUrl));
});
