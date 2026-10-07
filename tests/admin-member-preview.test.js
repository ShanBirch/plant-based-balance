const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('netlify/modern-functions/admin-member-preview.mts','utf8').replace('export default async function handler','module.exports = async function handler');
async function run(email,authorized=true){
 const calls=[],module={exports:{}};
 vm.runInNewContext(code,{module,Response,process:{env:{SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'test-only'}},fetch:async(url)=>{calls.push(url);return Response.json(url.endsWith('/user')?{email}:{id:'7d3f1d49-884d-48e1-99fd-c3be0f7c48e0',user_metadata:{balance_learning_profile:'family_lower_carb_v1',balance_coach_prepared:true,private_field:'must not return'}});}});
 const response=await module.exports(new Request('https://example.invalid',{method:'POST',headers:authorized?{Authorization:'Bearer test-token'}:{},body:JSON.stringify({userId:'7d3f1d49-884d-48e1-99fd-c3be0f7c48e0'})}));return {response,calls};
}
test('preview preferences require authenticated Shannon admin',async()=>{
 let result=await run('other@example.invalid');assert.equal(result.response.status,403);assert.equal(result.calls.length,1);
 result=await run('shannonbirch@cocospersonaltraining.com',false);assert.equal(result.response.status,401);assert.equal(result.calls.length,0);
});
test('preview returns only matching member display preferences',async()=>{
 const {response}=await run('shannonbirch@cocospersonaltraining.com');const body=await response.json();
 assert.equal(response.status,200);assert.equal(body.user_metadata.balance_learning_profile,'family_lower_carb_v1');assert.equal(body.user_metadata.private_field,undefined);assert.equal(response.headers.get('Cache-Control'),'no-store');
});
