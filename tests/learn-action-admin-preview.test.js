const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../lib/learn-action-review.js'),'utf8');
function fixture(preview){
 const calls=[];const window={BalanceLearnCurriculum:{actionsEnabled:true},currentUser:{id:'jennie'},isAdminViewing:preview,supabaseClient:{auth:{getSession:async()=>({data:{session:{access_token:'test'}}})}},dispatchEvent(){}};
 vm.runInNewContext(source,{window,URLSearchParams,CustomEvent:class{},fetch:async url=>{calls.push(url);return {ok:true,json:async()=>({available:true,current_week:url.includes('client_id=jennie')?1:4,records:[]})};}});
 return {window,calls};
}
test('admin member preview requests the viewed member course week, not the signed-in admin',async()=>{
 const {window,calls}=fixture(true);await window.BalanceLearnActionReview.load();assert.match(calls[0],/client_id=jennie/);assert.equal(window.BalanceLearnActionReview.state.current_week,1);
 await assert.rejects(window.BalanceLearnActionReview.savePlan(1,'My note'),/read-only/);assert.equal(calls.length,1);
 window.currentUser={id:'another-member'};assert.equal(window.BalanceLearnActionReview.state,null);
});
test('ordinary member course actions retain their authenticated self lookup',async()=>{
 const {window,calls}=fixture(false);await window.BalanceLearnActionReview.load();assert.ok(!calls[0].includes('client_id='));assert.equal(window.BalanceLearnActionReview.state.current_week,4);
});
