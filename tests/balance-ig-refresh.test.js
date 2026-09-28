const test=require('node:test');
const assert=require('node:assert/strict');
const {refreshBalanceToken}=require('../netlify/functions/_lib/balance-ig-refresh');
const now=Date.parse('2026-09-28T06:00:00Z');
const old={value:'test-only',updated_at:new Date(now-8*86400000).toISOString()};
const responses=(identity={user_id:'17841415641641750',username:'shan_n_sunny'})=>[{ok:true,json:async()=>({access_token:'renewed-test-only',expires_in:5184000})},{ok:true,json:async()=>identity}];
test('renewal leaves absent and recently renewed connections alone',async()=>{
 const unexpected=async()=>{throw Error('unexpected request')};
 assert.equal((await refreshBalanceToken(async()=>[],unexpected,now)).status,'not_connected');
 assert.equal((await refreshBalanceToken(async()=>[{...old,updated_at:new Date(now-86400000).toISOString()}],unexpected,now)).status,'not_due');
});
test('renewal verifies identity and writes only the unchanged account secret',async()=>{
 let write;const rs=responses();
 const result=await refreshBalanceToken(async(path,options)=>{if(options){write={path,...options};return [{key:'saved'}]}return [old]},async()=>rs.shift(),now);
 assert.equal(result.status,'renewed');assert.match(write.path,/meta_ig_access_token_17841415641641750/);assert.ok(write.path.includes(encodeURIComponent(old.updated_at)));assert.equal(write.body.value,'renewed-test-only');
});
test('expired credentials and wrong identities cannot overwrite the connection',async()=>{
 for(const rs of [[{ok:false}],responses({user_id:'wrong',username:'shan_n_sunny'}),responses({user_id:'17841415641641750',username:'wrong'})]){
 let writes=0;await assert.rejects(refreshBalanceToken(async(p,o)=>{if(o)writes++;return [old]},async()=>rs.shift(),now));assert.equal(writes,0);
 }
});
test('concurrent reconnect is reported without claiming renewal',async()=>{
 const rs=responses();assert.equal((await refreshBalanceToken(async(p,o)=>o?[]:[old],async()=>rs.shift(),now)).status,'connection_changed');
});
test('warm workers pick up a rotated credential after one minute',async()=>{
 const {resolveMetaIgAccessToken}=require('../netlify/functions/_lib/meta-ig-accounts');
 const original=Date.now;let clock=now,token='first-test-token',reads=0;
 Date.now=()=>clock;
 try { const query=async()=>{reads++;return [{value:token}]};
 assert.equal((await resolveMetaIgAccessToken('17841415641641750',query)).token,token);
 token='rotated-test-token';clock+=61000;
 assert.equal((await resolveMetaIgAccessToken('17841415641641750',query)).token,token);assert.equal(reads,2);
 }finally{Date.now=original}
});
