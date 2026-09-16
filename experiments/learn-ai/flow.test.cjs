const test=require('node:test');const assert=require('node:assert/strict');
const {decide,validatePlan,facts}=require('./flow.cjs');
const {assertTestSession,receiptId,graphMessage,THREAD}=require('./live.cjs');
test('delayed video confirmation is read back, never resent, before following text',async()=>{
 const {deliverActions}=require('./deliver.cjs');const calls=[];
 await deliverActions({session:'s',inbound_id:'i',plan:{actions:[{},{}]},sleep:async()=>{},call:async x=>{calls.push([x.mode,x.index]);if(x.mode==='send'&&x.index===0)throw Error('gateway_timeout');if(x.mode==='status')return{receipts:[{data:{inbound_id:'i',index:0,outcome:'confirmed'}}]};return{inbound_id:'i',index:1,outcome:'confirmed'};}});
 assert.deepEqual(calls,[['send',0],['status',undefined],['send',1]]);
});
test('uncertain delivery stops later messages with no resend',async()=>{
 const {deliverActions}=require('./deliver.cjs');const calls=[];
 await assert.rejects(()=>deliverActions({session:'s',inbound_id:'i',plan:{actions:[{},{}]},sleep:async()=>{},call:async x=>{calls.push(x.mode);if(x.mode==='send')throw Error('timeout');return{receipts:[{data:{inbound_id:'i',index:0,outcome:'uncertain'}}]};}}),/delivery_uncertain/);
 assert.deepEqual(calls,['send','status']);
});
test('Graph echoes match confirmed receipts without treating real human messages as ours',()=>{
 const {reconcileMessages}=require('./live.cjs');
 const rows=[{id:'echo',direction:'out',source:'instagram_native_inbox',manychat_message_id:'ig_graph:abc'},{id:'copy',direction:'out',source:'learn_ai_experiment',manychat_message_id:'abc'},{id:'human',direction:'out',source:'instagram_native_inbox',manychat_message_id:'ig_graph:def'}];
 const actual=reconcileMessages(rows,[{id:'receipt',data:{outcome:'confirmed',message_id:'abc'}}]);
 assert.equal(actual.length,2);assert.equal(actual[0].source,'learn_ai_experiment');assert.equal(actual[1].source,'instagram_native_inbox');
 assert.equal(reconcileMessages(rows,[{id:'receipt',data:{outcome:'uncertain',message_id:'abc'}}])[0].source,'instagram_native_inbox');
});
test('live dispatch requires exact test identity and explicit active session',()=>{
 const t={id:THREAD,ig_username:'goldcoast_ai_solutions',subscriber_id:'ig_graph:17841415641641750:989348707404558',linked_user_id:null,custom_data:{codex_ai_opt_out:true,learn_ai_experiment:{session:'test',expires_at:'2099-01-01'}}};
 assert.doesNotThrow(()=>assertTestSession(t,'test'));
 assert.throws(()=>assertTestSession({...t,id:'another-thread'},'test'));
 assert.throws(()=>assertTestSession({...t,linked_user_id:'customer'},'test'));
 assert.throws(()=>assertTestSession(t,'different-session'));
 assert.throws(()=>assertTestSession({...t,custom_data:{...t.custom_data,codex_ai_opt_out:false}},'test'));
 assert.throws(()=>assertTestSession(t,'test',Date.parse('2100-01-01')));
});
test('dispatch claims are stable across retry and distinct per action',()=>{
 assert.equal(receiptId('inbound',0),receiptId('inbound',0));assert.notEqual(receiptId('inbound',0),receiptId('inbound',1));
});
test('preview card describes website and keeps download out of its label',()=>{
 const m=graphMessage({type:'card',asset_id:'preview'});
 assert.match(m.attachment.payload.buttons[0].url,/meta-app-preview|\/p\//);
 assert.doesNotMatch(m.attachment.payload.buttons[0].title,/download/i);
});
test('reject unknown assets and unintroduced media without rewriting conversation',()=>{
 assert.throws(()=>validatePlan({status:'reply',actions:[{type:'image',asset_id:'made_up',text:''}]}));
 assert.throws(()=>validatePlan({status:'reply',actions:[{type:'image',asset_id:'ally',text:''}]}));
});
test('wording length is not a silence gate',()=>{
 assert.equal(validatePlan({status:'reply',actions:[{type:'text',text:'A detailed answer. '.repeat(35),asset_id:''}]}).actions.length,1);
});
test('pause cannot include a media sales action',()=>assert.throws(()=>validatePlan({status:'pause',actions:[{type:'text',text:'Okay',asset_id:''},{type:'card',asset_id:'preview',text:''}]})));
test('pricing changes at Brisbane boundary',()=>{
 assert.equal(facts(new Date('2026-10-20T13:59:59Z')).upfront_aud,149);
 assert.equal(facts(new Date('2026-10-20T14:00:00Z')).upfront_aud,450);
});
test('API error never invents an apology or retries',async()=>{
 let calls=0;await assert.rejects(()=>decide({inbound:['hello'],apiKey:'test',fetchImpl:async()=>{calls++;return{ok:false,status:429}}}),/model_http_429/);assert.equal(calls,1);
});
test('incomplete response cannot be mistaken for a plan',async()=>{
 await assert.rejects(()=>decide({inbound:['hello'],apiKey:'test',fetchImpl:async()=>({ok:true,json:async()=>({status:'incomplete'})})}),/model_incomplete/);
});
