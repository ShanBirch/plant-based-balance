const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('node:vm');
function endpoint(user,admin=true){const source=fs.readFileSync('netlify/functions/coaching-support-preview.js','utf8');const c={exports:{},require:()=>({supabaseQuery:async()=>admin?[{user_id:user.id}]:[]}),process:{env:{SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture'}},fetch:async()=>({ok:true,json:async()=>user})};vm.runInNewContext(source,c);return c.exports.handler;}
test('preview requires exact Shannon identity and authoritative administrator membership',async()=>{
 const event={httpMethod:'GET',headers:{authorization:'Bearer fixture'}};
 assert.equal((await endpoint({id:'other'})(event)).statusCode,403);
 assert.equal((await endpoint({id:'00a6605e-8edb-4917-85ba-24a23f179059'},false)(event)).statusCode,403);
 assert.equal((await endpoint({id:'00a6605e-8edb-4917-85ba-24a23f179059'})(event)).statusCode,200);
 assert.equal((await endpoint({id:'other'})({...event,httpMethod:'POST'})).statusCode,405);
});
test('walkthrough reads real component choices without saving consent or resetting onboarding',()=>{
 const s=fs.readFileSync('coaching-support-preview.js','utf8');assert.match(s,/BalanceCoachingSupport\.read/);assert.doesNotMatch(s,/\.rpc\(|\.save\(|localStorage\.setItem|sessionStorage\.setItem|onboarding_complete/);
});
