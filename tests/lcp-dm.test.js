const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('crypto');
const {OWNER_ID,ORDER_URL,parseDecision,replyFor,bubbles,outboundMessages}=require('../netlify/functions/_lib/lcp-dm-knowledge');
const {inboundEvents,validSignature,validDeliverySignature}=require('../netlify/functions/lcp-dm-background')._test;
const {routePortraitEntries}=require('../netlify/functions/_lib/lcp-dm-route');
const {refreshPortraitToken}=require('../netlify/functions/_lib/lcp-dm-refresh');
const offer={checkoutEnabled:true,framedEnabled:false,customDesignEnabled:true,proofWindow:'Within five business days',revisionWindow:'Within three business days',fulfilmentWindow:'After approval'};
test('single and group prices are exact, selected formats stay focused',()=>{
 for(const [subjects,price] of [[1,49],[2,69],[3,89],[4,89]]){
  const r=replyFor({intents:['prices'],subjects,format:'digital'},offer);
  assert.match(r.text,new RegExp('A\\$'+price));assert.ok(r.text.includes(ORDER_URL));assert.equal(r.pause,false);assert.ok(!r.text.includes('black framed'));
 }
 assert.match(replyFor({intents:['prices'],subjects:2,format:'framed'},offer).text,/A\$139/);
 assert.match(replyFor({intents:['prices'],subjects:2,format:'framed'},offer).text,/not open yet/);
 assert.doesNotMatch(replyFor({intents:['prices'],subjects:2,format:'framed'},offer).text,/upload your photo|Secure payment comes/);
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
 const r=replyFor({intents:['prices','preview','custom'],subjects:4},offer);const p=bubbles(r.text);assert.ok(p.every(x=>x.length<=1000));assert.ok(p.some(x=>x.includes(ORDER_URL)));assert.ok(p.length<=9);
});
test('a simple price enquiry answers in text before its clickable image card',()=>{
 const live={...offer,framedEnabled:true};const decision={intents:['prices']};
 const messages=outboundMessages(replyFor(decision,live),decision,live);
 assert.equal(messages.length,2);assert.match(messages[0].text,/digital A\$49/);
 const payload=messages[1].attachment.payload,card=payload.elements[0];
 assert.equal(payload.template_type,'generic');assert.match(card.subtitle,/A\$49.*A\$89.*A\$119/);
 assert.match(card.subtitle,/GST.*delivery included/);assert.ok(card.subtitle.length<=80);
 assert.equal(card.buttons[0].type,'web_url');assert.equal(card.buttons[0].url,ORDER_URL);
 assert.equal(card.default_action.url,ORDER_URL);assert.equal(card.image_url,'https://plantbased-balance.org/assets/little-companion-dm-jumper.png');assert.equal(payload.image_aspect_ratio,'square');
});
test('specific prices and long answers retain detail with a separate card',()=>{
 const live={...offer,framedEnabled:true,groupTypes:['pets']};
 for(const decision of [{intents:['prices'],subjects:2,format:'framed'},{intents:['prices','preview','custom'],subjects:4}]){
  const messages=outboundMessages(replyFor(decision,live),decision,live);
  assert.ok(messages.some(m=>m.text));assert.ok(messages.some(m=>m.attachment));
  for(const m of messages.filter(m=>m.text)){assert.ok(m.text.length<=1000);assert.ok(!m.text.includes('https://'));}
 }
 assert.deepEqual(bubbles('First paragraph.\n\nSecond paragraph.'),['First paragraph.\n\nSecond paragraph.']);
});
test('cheapest questions always answer in text and distinguish design fees from finished portraits',()=>{
 const live={...offer,framedEnabled:true,groupTypes:['pets']};
 for(const text of ['Whats your cheapest offer?','What is your lowest price?','most affordable option','least expensive portrait','budget option']){
  const d=parseDecision('{"intents":["prices"]}',text);
  assert.equal(d.cheapest,true);
  const messages=outboundMessages(replyFor(d,live),d,live);
  assert.match(messages[0].text,/A\$20 custom-design session: one design plus up to five edits/);
  assert.match(messages[0].text,/finished digital portrait for one pet is A\$49/);
  assert.match(messages[0].text,/totals A\$69/);
  assert.ok(messages[1].attachment);
  const closed=replyFor(d,{...live,checkoutEnabled:false});assert.match(closed.text,/paused/);assert.doesNotMatch(closed.text,/lowest-priced purchase/);
  assert.doesNotMatch(replyFor(d,{...live,customDesignEnabled:false}).text,/A\$20/);
 }
 const print=parseDecision('{"intents":["prices"],"format":"unframed"}','cheapest print');
 assert.match(replyFor(print,live).text,/A\$89/);assert.doesNotMatch(replyFor(print,live).text,/A\$20/);
 assert.equal(replyFor(parseDecision('{"intents":["human"]}','cheapest refund'),live).pause,true);
 assert.match(replyFor({intents:['custom']},live).text,/one design and up to five edits/);
 assert.doesNotMatch(replyFor({intents:['custom','style']},live).text,/three choices|3 choices/);
 const missed=parseDecision('{"intents":["unrelated"]}','How much is a portrait?');
 assert.deepEqual(missed.intents,['prices']);
 const missedPrint=parseDecision('{"intents":["prices"],"format":null}','What is your cheapest print?');
 assert.equal(missedPrint.format,'unframed');assert.match(replyFor(missedPrint,live).text,/A\$89/);
});
test('cards respect paused checkout and human holds, and use the right destination',()=>{
 for(const intent of ['stop','human']){
  const d={intents:[intent,'prices']};assert.ok(outboundMessages(replyFor(d,offer),d,offer).every(m=>m.text&&!m.attachment));
 }
 const closed={...offer,checkoutEnabled:false},d={intents:['order']};
 const messages=outboundMessages(replyFor(d,closed),d,closed);
 assert.match(messages.at(-1).attachment.payload.elements[0].subtitle,/availability/);
 assert.equal(messages.at(-1).attachment.payload.elements[0].buttons[0].title,'Browse portraits');
 const custom={intents:['custom']};
 assert.match(outboundMessages(replyFor(custom,offer),custom,offer).at(-1).attachment.payload.elements[0].buttons[0].url,/\/custom-design\?/);
 const refund={intents:['refund']};
 assert.match(outboundMessages(replyFor(refund,offer),refund,offer).at(-1).attachment.payload.elements[0].buttons[0].url,/\/refunds$/);
});
test('casual greetings do not bury the answer or add a needless sales follow-up',()=>{
 const live={...offer,framedEnabled:true};const d={intents:['greeting','prices','thanks']};
 assert.equal(outboundMessages(replyFor(d,live),d,live).length,2);
 assert.doesNotMatch(replyFor(d,live).text,/Are you thinking|Is it for|You’re welcome/);
 const thanks=replyFor({intents:['thanks']},live);assert.ok(thanks.text.length<40);assert.ok(!thanks.text.includes('http'));
 assert.match(replyFor({intents:['revision']},live).text,/Standard portraits include one minor correction/);
 assert.match(replyFor({intents:['revision']},live).text,/five edits/);
});
test('requires genuine exact signature, rejects missing credentials',()=>{
 const raw='{"hello":1}',secret='test-only';const sig='sha256='+crypto.createHmac('sha256',secret).update(raw).digest('hex');assert.ok(validSignature(raw,sig,secret));assert.equal(validSignature(raw+' ',sig,secret),false);assert.equal(validSignature(raw,sig,''),false);
});
test('accepts the existing Balance delivery signature without accepting unknown apps',()=>{
 const raw='{"entry":[]}',sign=key=>'sha256='+crypto.createHmac('sha256',key).update(raw).digest('hex');
 const env={META_APP_SECRET:'existing-balance-app'};
 assert.equal(validDeliverySignature(raw,sign('existing-balance-app'),'portrait-app',env),true);
 assert.equal(validDeliverySignature(raw,sign('portrait-app'),'portrait-app',env),true);
 assert.equal(validDeliverySignature(raw,sign('unknown-app'),'portrait-app',env),false);
 assert.equal(validDeliverySignature(raw+' ',sign('existing-balance-app'),'portrait-app',env),false);
 assert.equal(validDeliverySignature(raw,'',null,{}),false);
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
test('renewal waits seven days and rejects a different account without overwriting credentials',async()=>{
 const now=Date.now();let writes=0,requests=0;
 const query=async(path,options)=>{if(options){writes++;return [];}return [{value:'test-only',updated_at:new Date(now-86400000).toISOString()}];};
 assert.equal((await refreshPortraitToken(query,async()=>{requests++;},{},now)).status,'not_due');
 assert.equal(requests,0);assert.equal(writes,0);
 const oldQuery=async(path,options)=>{if(options){writes++;return [];}return [{value:'test-only',updated_at:new Date(now-8*86400000).toISOString()}];};
 const responses=[{access_token:'renewed-test-only',expires_in:5184000},{user_id:'999',username:'other'}];
 await assert.rejects(refreshPortraitToken(oldQuery,async()=>({ok:true,json:async()=>responses.shift()}),{},now),/identity mismatch/);
 assert.equal(writes,0);
});
test('renewal saves a verified portrait token with a concurrency guard',async()=>{
 const now=Date.now(),updated_at=new Date(now-8*86400000).toISOString();let write;
 const query=async(path,options)=>{if(options){write={path,...options};return [];}return [{value:'test-only',updated_at}];};
 const responses=[{access_token:'renewed-test-only',expires_in:5184000},{user_id:OWNER_ID,username:'littlecompanionportraits'}];
 assert.equal((await refreshPortraitToken(query,async()=>({ok:true,json:async()=>responses.shift()}),{},now)).status,'renewed');
 assert.ok(write.path.includes(encodeURIComponent(updated_at)));assert.equal(write.body.value,'renewed-test-only');
});
