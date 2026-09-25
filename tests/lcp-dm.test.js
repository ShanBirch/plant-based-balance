const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('crypto');
const {OWNER_ID,ORDER_URL,parseDecision,replyFor,bubbles}=require('../netlify/functions/_lib/lcp-dm-knowledge');
const {inboundEvents,validSignature}=require('../netlify/functions/lcp-dm-background')._test;
const {routePortraitEntries}=require('../netlify/functions/_lib/lcp-dm-route');
const offer={checkoutEnabled:true,framedEnabled:false,customDesignEnabled:true,proofWindow:'Within five business days',revisionWindow:'Within three business days',fulfilmentWindow:'After approval'};
test('single and group prices are exact, selected formats stay focused',()=>{
 for(const [subjects,price] of [[1,49],[2,69],[3,89],[4,89]]){
  const r=replyFor({intents:['prices'],subjects,format:'digital'},offer);
  assert.match(r.text,new RegExp('A\\$'+price));assert.ok(r.text.includes(ORDER_URL));assert.equal(r.pause,false);assert.ok(!r.text.includes('black framed'));
 }
 assert.match(replyFor({intents:['prices'],subjects:2,format:'framed'},offer).text,/A\$139/);
 assert.match(replyFor({intents:['prices'],subjects:2,format:'framed'},offer).text,/not open yet/);
});
test('closed checkout never claims payment is available',()=>{
 const r=replyFor({intents:['order']},{...offer,checkoutEnabled:false});assert.match(r.text,/Checkout is currently paused/);assert.doesNotMatch(r.text,/Secure payment comes/);
});
test('custom fee is additional and identity is truthful',()=>{
 assert.match(replyFor({intents:['custom']},offer).text,/not deducted/);
 assert.match(replyFor({intents:['identity']},offer).text,/automated assistant/);
 assert.equal(replyFor({intents:['stop','prices']},offer).pause,true);
 assert.equal(replyFor({intents:['human']},offer).pause,true);
});
test('classifier cannot add arbitrary text, invalid intents or prices',()=>{
 assert.throws(()=>parseDecision('{"intents":["discount"]}'));
 const d=parseDecision('{"intents":["prices"],"subjects":10,"price":1,"format":"free"}');assert.equal(d.subjects,null);assert.equal(d.format,null);assert.match(replyFor(d,offer).text,/A\$49/);
});
test('all outbound bubbles fit and preserve complete links',()=>{
 const r=replyFor({intents:['prices','preview','custom'],subjects:4},offer);const p=bubbles(r.text);assert.ok(p.every(x=>x.length<=240));assert.ok(p.some(x=>x.includes(ORDER_URL)));assert.ok(p.length<=9);
});
test('requires genuine exact signature, rejects missing credentials',()=>{
 const raw='{"hello":1}',secret='test-only';const sig='sha256='+crypto.createHmac('sha256',secret).update(raw).digest('hex');assert.ok(validSignature(raw,sig,secret));assert.equal(validSignature(raw+' ',sig,secret),false);assert.equal(validSignature(raw,sig,''),false);
});
test('only fresh incoming portrait DMs qualify, no echoes or other accounts',()=>{
 const now=Date.now();const message={sender:{id:'1234'},recipient:{id:OWNER_ID},timestamp:now,message:{mid:'test',text:'price?'}};
 assert.equal(inboundEvents({entry:[{id:OWNER_ID,messaging:[message]}]},now).length,1);
 for(const m of [{...message,message:{...message.message,is_echo:true}},{...message,timestamp:now-86400000},{...message,recipient:{id:'999'}},{...message,timestamp:now+120000}])assert.equal(inboundEvents({entry:[{id:OWNER_ID,messaging:[m]}]},now).length,0);
 assert.equal(inboundEvents({entry:[{id:'999',messaging:[message]}]},now).length,0);
});
test('portrait entries never fall through into coaching or old comment campaigns',async()=>{
 const payload={entry:[{id:OWNER_ID,messaging:[]},{id:'17841415641641750',messaging:[]}]};let calls=0;
 const result=await routePortraitEntries(payload,{body:JSON.stringify(payload),headers:{}},async()=>{calls++;return {ok:true};});
 assert.equal(calls,1);assert.deepEqual(result.entry,[payload.entry[1]]);
 await assert.rejects(routePortraitEntries(payload,{body:'{}'},async()=>({ok:false})));
});
