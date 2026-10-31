const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('node:vm');
function endpoint(user,admin=true,testProfile=true){const source=fs.readFileSync('netlify/functions/coaching-support-preview.js','utf8');const c={exports:{},require:()=>({supabaseQuery:async(path)=>path.startsWith('users?')?[{is_test_account:testProfile}]:admin?[{user_id:user.id}]:[]}),process:{env:{SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture'}},fetch:async()=>({ok:true,json:async()=>user})};vm.runInNewContext(source,c);return c.exports.handler;}
test('preview requires exact Shannon identity and authoritative administrator membership',async()=>{
 const event={httpMethod:'GET',headers:{authorization:'Bearer fixture'}};
 assert.equal((await endpoint({id:'other'})(event)).statusCode,403);
 assert.equal((await endpoint({id:'00a6605e-8edb-4917-85ba-24a23f179059'},false)(event)).statusCode,403);
 assert.equal((await endpoint({id:'00a6605e-8edb-4917-85ba-24a23f179059'})(event)).statusCode,200);
 assert.equal((await endpoint({id:'other'})({...event,httpMethod:'POST'})).statusCode,405);
});
test('the dedicated tester needs both the server-controlled marker and authoritative test profile',async()=>{
 const event={httpMethod:'GET',headers:{authorization:'Bearer fixture'}},user={id:'76e73c43-d06b-45db-afed-8203dc862752',app_metadata:{balance_support_preview:true}};
 assert.equal((await endpoint(user,false)(event)).statusCode,200);
 assert.equal((await endpoint(user,false,false)(event)).statusCode,403);
 assert.equal((await endpoint({...user,is_anonymous:true},false)(event)).statusCode,403);
 assert.equal((await endpoint({id:user.id,user_metadata:{balance_support_preview:true}},false)(event)).statusCode,403);
 assert.equal((await endpoint({...user,id:'another-test'},false)(event)).statusCode,403);
});
test('walkthrough reads real component choices without saving consent or resetting onboarding',()=>{
 const s=fs.readFileSync('coaching-support-preview.js','utf8');assert.match(s,/BalanceCoachingSupport\.read/);assert.doesNotMatch(s,/\.rpc\(|\.save\(|localStorage\.setItem|sessionStorage\.setItem|onboarding_complete/);
});
