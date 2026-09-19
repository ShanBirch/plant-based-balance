const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../lib/onboarding-progress.js'),'utf8');
function setup(status,error){
 const queries=[];const window={currentUser:{id:'new-account'},localStorage:{getItem:()=>null},supabaseClient:{from(table){queries.push(table);return {select(columns){queries.push(columns);return {eq(column,id){queries.push([column,id]);return {maybeSingle:async()=>({data:{id,subscription_status:status},error})}}}}}}}};
 vm.runInNewContext(source,{window,setTimeout,clearTimeout});return {window,queries};
}
test('new unpaid accounts route to checkout using their own server record',async()=>{
 for(const status of [null,'test','incomplete','expired','canceled']){const {window,queries}=setup(status);assert.equal(await window.BalanceOnboardingProgress.completionDestination(),'checkout');assert.deepEqual(queries,['users','id,subscription_status',['id','new-account']]);}
});
test('existing active and trialing members are not asked to purchase again',async()=>{
 for(const status of ['active','trialing']){const {window}=setup(status);assert.equal(await window.BalanceOnboardingProgress.completionDestination(),'course');}
});
test('failed account checks do not silently choose a destination',async()=>{
 const {window}=setup(null,{message:'offline'});await assert.rejects(window.BalanceOnboardingProgress.completionDestination());
});
test('changing accounts during a status lookup cannot route using the previous account',async()=>{
 const {window}=setup('active');const pending=window.BalanceOnboardingProgress.completionDestination();window.currentUser={id:'another-account'};await assert.rejects(pending);
});
