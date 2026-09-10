const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/dashboard/script_part_24.js'),'utf8').split('// Send a push notification')[0];
test('a member resolves the coach without reading another private user profile',async()=>{
    let calls=0;
    const context={window:{supabaseClient:{rpc:async name=>{assert.equal(name,'get_balance_coach_id');calls++;return {data:'coach-id'};},from:()=>{throw Error('Private profile lookup attempted');}}},console};
    vm.runInNewContext(source,context);
    assert.equal(await context.getCoachUserId(),'coach-id');
    assert.equal(await context.getCoachUserId(),'coach-id');
    assert.equal(calls,1);
});
