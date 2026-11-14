const test = require('node:test');
const assert = require('node:assert/strict');
const {canQueueStoryReplyReview,buildStoryReplyAlertData,routeInboundStoryReplyToBrowser} =
  require('../netlify/functions/_lib/ig-story-reply-browser-routing');
const lead = {id:'thread',ig_username:'ordinary_lead',auto_send_enabled:true,custom_data:{}};
test('eligible Story inbound queues sole native review without any send permission',()=>{
 const d=buildStoryReplyAlertData({thread:lead,sourceMessageId:'source',storyId:'123'});
 assert.equal(d.operator_queue,'dm_manager');assert.equal(d.needs_shannon_approval,false);
 assert.equal(d.browser_dispatch_reason,'sole_native_reactive_review');
 assert.equal(d.browser_send_allowed,false);assert.equal(d.native_story_context_required,true);
 assert.deepEqual(d.draft_messages,[]);
});
test('client, manual, opted-out and disabled threads keep their holds',()=>{
 for(const t of [{...lead,linked_user_id:'client'},{...lead,auto_send_enabled:false},
   {...lead,custom_data:{manual_only:'true'}},{...lead,custom_data:{opt_out:true}},
   {...lead,custom_data:{outreach_relationship_kind:'client'}}]){
  assert.equal(canQueueStoryReplyReview(t),false);
  assert.equal(buildStoryReplyAlertData({thread:t}).needs_shannon_approval,true);
 }
});
test('a denied database route returns the shell to Needs You, never a generic sender',async()=>{
 const patches=[];
 const r=await routeInboundStoryReplyToBrowser({thread:lead,sourceMessageId:'source',
  messageText:'[IG_STORY_REPLY_CONTEXT]\nTheir reply: "nice"',
  createAlert:async()=>({alertId:'alert'}),
  query:async(path,options)=>{
   if(path.startsWith('coach_alerts?select'))return [{id:'alert',status:'pending',data:{}}];
   if(path.startsWith('rpc/'))return {outcome:'active_claim_preserved'};
   patches.push(options.body);return [];
  }});
 assert.equal(r.routed,false);assert.equal(patches.at(-1).data.needs_you_required,true);
 assert.equal(patches.at(-1).data.browser_send_allowed,false);
});
test('replayed Story webhook preserves a human hold without rerouting or rewriting',async()=>{
 const calls=[];
 const r=await routeInboundStoryReplyToBrowser({thread:lead,sourceMessageId:'source',
  createAlert:async()=>({alertId:'held',deduped:true}),
  query:async(path)=>{calls.push(path);return [{id:'held',status:'pending',
    data:{needs_shannon_approval:true,operator_queue:'needs_you'}}];}});
 assert.equal(r.outcome,'existing_alert_hold_preserved');assert.equal(calls.length,1);
});
test('confirmed unlinked client cannot slip into the lead queue',async()=>{
 let rpc=false;
 const r=await routeInboundStoryReplyToBrowser({thread:{...lead,custom_data:{outreach_relationship_kind:'client'}},
 sourceMessageId:'source',createAlert:async()=>({alertId:'held'}),
 query:async(path)=>{if(path.startsWith('rpc/'))rpc=true;return [];}});
 assert.equal(rpc,false);assert.equal(r.outcome,'story_reply_independent_hold');
});
