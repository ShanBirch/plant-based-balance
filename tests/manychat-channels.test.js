const test=require('node:test');const assert=require('node:assert/strict');
const {normalizeManyChatChannel,buildManyChatContent,isBalanceManyChatThread}=require('../netlify/functions/_lib/manychat-channels');
const {resolveChallengeLeadRoute}=require('../netlify/functions/_lib/plant-based-challenge-dm');
for(const channel of ['messenger','whatsapp']) test(channel+' shares the challenge without keywords, but preserves client and identity boundaries',()=>{
const thread={channel,subscriber_id:'123',created_at:new Date().toISOString(),custom_data:{manychat_business:{workspace:'fb996573',page_id:'561122130919678'}}};
assert.equal(isBalanceManyChatThread(thread),true);
assert.equal(resolveChallengeLeadRoute({thread,currentMessage:'Hey, I saw your ad. How does it work?'}),true);
assert.equal(resolveChallengeLeadRoute({thread:{...thread,linked_user_id:'client'},currentMessage:'Summer Shred'}),false);
assert.equal(resolveChallengeLeadRoute({thread:{...thread,custom_data:{}},currentMessage:'Summer Shred'}),false);
assert.equal(isBalanceManyChatThread({...thread,subscriber_id:'fb_graph:123:456'}),false);
const content=buildManyChatContent({channel,text:'Find a time for your Balance fit call',button:{title:'Book a call',url:'https://plantbased-balance.org/book?source=plant_based_challenge'}});
assert.equal(content.type,channel==='whatsapp'?'whatsapp':undefined);
assert.deepEqual(content.messages[0].buttons,[{type:'url',caption:'Book a call',url:'https://plantbased-balance.org/book?source=plant_based_challenge'}]);
});
test('unknown channels cannot silently become Instagram',()=>{assert.equal(normalizeManyChatChannel('whatsapp'),'whatsapp');assert.equal(normalizeManyChatChannel('email'),null);assert.equal(normalizeManyChatChannel(undefined),'instagram');});
