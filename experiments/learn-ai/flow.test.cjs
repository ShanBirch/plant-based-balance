const test=require('node:test');const assert=require('node:assert/strict');
const {decide,validatePlan,facts}=require('./flow.cjs');
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
