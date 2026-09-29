const test=require('node:test');
const assert=require('node:assert/strict');
const {filterInternalTestHistoryAfterReset}=require('../netlify/functions/ig-instant-draft')._test;
test('only explicitly enabled verified ManyChat test contacts get fresh test episodes',()=>{
 const history=[{direction:'out',text:'Prior test reply',created_at:'2026-09-29T08:00:00Z'},{direction:'in',text:'Hi there',created_at:'2026-09-29T10:00:00Z'}];
 const customData={manychat_business:{workspace:'fb996573',page_id:'561122130919678'},internal_test_auto_reply_enabled:true,internal_test_meta_ad_flow:'plant_based_control',internal_test_conversation_reset_at:'2026-09-29T09:00:00Z'};
 assert.deepEqual(filterInternalTestHistoryAfterReset({history,customData}),[history[1]]);
 for(const changed of [{internal_test_auto_reply_enabled:false},{internal_test_meta_ad_flow:null},{manychat_business:{workspace:'another',page_id:'561122130919678'}}]) assert.deepEqual(filterInternalTestHistoryAfterReset({history,customData:{...customData,...changed}}),history);
 assert.deepEqual(filterInternalTestHistoryAfterReset({history,customData,linkedUserId:'client'}),history);
});
