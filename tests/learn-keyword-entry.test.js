const test=require('node:test');
const assert=require('node:assert/strict');
const {buildLearnKeywordFlowCustomData,isMetaAdFastLaneEligible,isMetaAdConversationFastLaneEligible,resolveMetaAdFlowVariant,buildMetaAdFoundersPassFirstReply}=require('../netlify/functions/ig-instant-draft')._test;
const {resolveIgAcquisitionMode,hasVerifiedMetaAttribution}=require('../netlify/functions/_lib/ig-acquisition-mode');

for(const currentMessage of ['balance','BALANCE','Balance','  balance  ','balance!','Balance.','balance\n']) test(`ordinary DM starts Learn: ${JSON.stringify(currentMessage)}`,()=>{
    const customData=buildLearnKeywordFlowCustomData({currentMessage,customData:{bot_account:'shan_n_sunny'},manychatMessageId:'ig_graph:keyword1'});
    assert.ok(customData);
    assert.equal(hasVerifiedMetaAttribution(customData),false,'keyword must not fabricate paid attribution');
    assert.equal(resolveIgAcquisitionMode({customData}),'learn_keyword');
    assert.equal(isMetaAdFastLaneEligible({customData,manychatMessageId:'ig_graph:keyword1'}),true);
    assert.equal(isMetaAdFastLaneEligible({customData,manychatMessageId:'ig_graph:later'}),false);
    const later={...customData,current_inbound_routing:{source:'instagram_graph',message_id:'later'}};
    assert.equal(isMetaAdConversationFastLaneEligible({customData:later}),true);
    assert.equal(resolveMetaAdFlowVariant({customData:later}),'broad_pain');
    const reply=buildMetaAdFoundersPassFirstReply(currentMessage,{customData});
    assert.match(reply.joined,/^Hey/);
    assert.match(reply.joined,/Balance Learn/);
    assert.doesNotMatch(reply.joined,/already plant.based/i);
});
test('keyword route stays scoped to explicit course interest and unlinked leads',()=>{
    for(const currentMessage of ['my balance is bad','bank balance','balanced','stop messaging me','']) assert.equal(buildLearnKeywordFlowCustomData({currentMessage,customData:{bot_account:'shan_n_sunny'}}),null);
    assert.equal(buildLearnKeywordFlowCustomData({currentMessage:'balance',linkedUserId:'client',customData:{bot_account:'shan_n_sunny'}}),null);
    assert.equal(buildLearnKeywordFlowCustomData({currentMessage:'balance',customData:{bot_account:'another_account'}}),null);
});
