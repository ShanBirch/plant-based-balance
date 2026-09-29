const test = require('node:test');
const assert = require('node:assert/strict');
const {goalReactionTarget,sendGoalReaction} = require('../netlify/functions/_lib/ig-goal-reaction');
const review = {goal_heart:true,verdict:'pass',issues:[],reviewer_model:'openai-gpt-5.4-mini-challenge-review-medium'};
const inbound = {direction:'in',manychat_message_id:'ig_graph:verified-mid'};
test('only reviewed challenge goals with an actual inbound Graph id can be liked',()=>{
    assert.equal(goalReactionTarget({review,inbound,challenge:true}),'verified-mid');
    assert.equal(goalReactionTarget({review,inbound,challenge:true,enabled:false}),null);
    for(const override of [{challenge:false},{edited:true},{inbound:{...inbound,direction:'out'}},{inbound:{...inbound,manychat_message_id:'unverified'}},{review:{...review,goal_heart:false}},{review:{...review,verdict:'warn'}},{review:{...review,issues:['distress']}},{review:{...review,reviewer_model:'deterministic'}}]) {
        assert.equal(goalReactionTarget({review,inbound,challenge:true,...override}),null);
    }
});
test('reaction targets native message, persists before sending and never repeats on retry',async()=>{
    const events=[];let receipt;
    const args={target:'mid',recipientId:'recipient',persist:async r=>{receipt={...r};events.push(r.outcome);},post:async body=>{events.push(body);return {recipient_id:'recipient'};}};
    await sendGoalReaction(args);
    assert.equal(events[0],'attempting');
    assert.deepEqual(events[1],{recipient:{id:'recipient'},sender_action:'react',payload:{message_id:'mid',reaction:'love'}});
    assert.equal(receipt.outcome,'confirmed');
    await sendGoalReaction({...args,previous:receipt});assert.equal(events.length,3);
});
test('ambiguous reaction transport is recorded without retry; failed persistence sends nothing',async()=>{
    let count=0,receipt;
    const args={target:'mid',recipientId:'recipient',persist:async r=>{receipt={...r};},post:async()=>{count++;throw Error('timeout');}};
    await sendGoalReaction(args);assert.equal(receipt.outcome,'unconfirmed');
    await sendGoalReaction({...args,previous:receipt});assert.equal(count,1);
    await assert.rejects(sendGoalReaction({...args,persist:async()=>{throw Error('db');}}),/db/);assert.equal(count,1);
});
