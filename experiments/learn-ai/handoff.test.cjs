const test=require('node:test'),assert=require('node:assert/strict');
const {queue,pending}=require('./handoff.cjs');
const {reason}=require('./followup.cjs'),{THREAD}=require('./live.cjs');
test('a crisis creates a real review-only alert and pending review suppresses sales follow-up',async()=>{
 let row;const args={thread:{id:THREAD,coach_id:'coach'},session:'qa',inbound_id:'urgent',plan:{status:'needs_human',decision_summary:'Immediate safety concern'},media_context:[]};
 const first=await queue(args,async(_route,options)=>{row=options.body;return[row];});
 assert.equal(row.status,'pending');assert.equal(row.data.operator_queue,'needs_you');assert.equal(row.data.public_reply_blocked,true);assert.equal(row.suggested_message,null);
 assert.equal(pending([row]),true);assert.equal(pending([{...row,status:'dismissed'}]),false);
 assert.equal(reason({data:{}},{thread:{},receipts:[row]}),'safety_review_pending');
 const duplicate=await queue(args,async()=>{throw Error('database_409');});assert.equal(duplicate,first);
 await assert.rejects(queue(args,async()=>{throw Error('database_503');}),/database_503/);
});
