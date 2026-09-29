const test=require('node:test'); const assert=require('node:assert/strict');
const draft=require('../netlify/functions/ig-instant-draft')._test;
for(const policy of ['plant_based_challenge_consent_v2','summer_ready_shred_oct5_v3'])test(policy+' dispatches reviewed responses promptly without inventing ad attribution',()=>{
 const args={alertData:{challenge_policy_version:policy,draft_review:{verdict:'pass'}},normalizedTiming:{action:'send_now'},scheduleResolution:{deferredForWorkingHours:false}};
 assert.equal(draft.shouldDispatchMetaAdReplyImmediately(args),true);
 assert.equal(draft.shouldDispatchMetaAdReplyImmediately({...args,alertData:{...args.alertData,auto_send_review_hold:{code:'safety'}}}),false);
 assert.equal(draft.shouldDispatchMetaAdReplyImmediately({...args,alertData:{...args.alertData,draft_review:{verdict:'fail'}}}),false);
 assert.equal(draft.shouldDispatchMetaAdReplyImmediately({...args,alertData:{draft_review:{verdict:'pass'}}}),false);
});
