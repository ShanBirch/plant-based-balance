const test=require('node:test'),assert=require('node:assert/strict');
const {DELAY_MS,reason,evidence,enqueue}=require('./followup.cjs');
const {THREAD}=require('./live.cjs');
const now=Date.parse('2026-09-16T06:00:00Z');
function fixture(){
 const inbound={id:'in',direction:'in',created_at:new Date(now-3*3600000).toISOString()};
 const anchor={id:'closing',direction:'out',created_at:new Date(now-DELAY_MS-1000).toISOString()};
 const thread={id:THREAD,coach_id:'coach',learn_ai_settings:{mode:'automatic',session:'s'},custom_data:{}};
 const data={session:'s',inbound_id:'in',anchor_id:'closing',link_sent_at:anchor.created_at};
 return{view:{thread,messages:[inbound,anchor],receipts:[]},job:{data,scheduled_for:new Date(now-1000).toISOString()}};
}
test('one two-hour follow-up is eligible only for the unchanged selected conversation',()=>{
 const {job,view}=fixture();assert.equal(DELAY_MS,7200000);assert.equal(reason(job,view,{now}),null);
 assert.equal(reason({...job,scheduled_for:new Date(now+1).toISOString()},view,{now}),'not_due');
 assert.equal(reason(job,{...view,messages:[...view.messages,{id:'reply',direction:'in',created_at:new Date(now).toISOString()}]},{now}),'new_inbound');
 assert.equal(reason(job,{...view,messages:[...view.messages,{id:'manual',direction:'out'}]},{now}),'conversation_changed');
 assert.equal(reason(job,view,{now,booked:true}),'booked');
 assert.equal(reason(job,view,{now,converted:true}),'joined_or_purchased');
 for(const patch of [{linked_user_id:'user'},{lead_stage:'paying'},{custom_data:{do_not_follow_up:true}},{learn_ai_settings:null}])assert.notEqual(reason(job,{...view,thread:{...view.thread,...patch}},{now}),null);
 assert.equal(reason(job,view,{now:now+24*3600000}),'messaging_window_closed');
});
test('link queue uses confirmed card time, closing-message anchor and stable id',async()=>{
 const {view}=fixture();const card={id:'card',data:{inbound_id:'in',index:1,outcome:'confirmed',confirmed_at:view.messages.at(-1).created_at}};
 view.receipts=[card];const written=[];
 const deps={inspect:async()=>view,db:async(route,options)=>{written.push({route,...options});return[];}};
 const args={session:'s',inbound_id:'in',plan:{actions:[{type:'text'},{type:'card',asset_id:'zoom'},{type:'text'}]}};
 const result=await enqueue(args,deps);assert.equal(result.queued,true);
 const job=written[0].body;assert.equal(Date.parse(job.scheduled_for)-Date.parse(card.data.confirmed_at),DELAY_MS);assert.equal(job.data.anchor_id,'closing');assert.equal(job.status,'scheduled');
 assert.equal(written[1].body.status,'canceled');
 const again=await enqueue(args,{...deps,db:async()=>{throw Error('database_409');}});assert.equal(again.reason,'already_queued');
 card.data.outcome='uncertain';assert.equal((await enqueue(args,deps)).queued,false);
});
test('conversion queries use linked identities; lookup failures cannot authorize a reminder',async()=>{
 const {job,view}=fixture();const routes=[];
 await evidence(job,view,async route=>{routes.push(route);return[];});
 assert.match(routes[0],/ig_thread_id=eq\./);assert.match(routes[1],/metadata->>ig_thread_id=eq\./);
 await assert.rejects(()=>evidence(job,view,async()=>{throw Error('database_unavailable');}),/database_unavailable/);
});

test('claimed reminder sends once and rechecks a reply arriving during typing',async()=>{
 const live=require('./live.cjs'),{run}=require('./followup.cjs');
 const originals={db:live.db,inspect:live.inspect,send:live.send,senderActions:live.senderActions};
 try{
  for(const replyDuringTyping of [false,true]){
   const {job,view}=fixture();
   view.messages[0].created_at=new Date(Date.now()-3*3600000).toISOString();
   view.thread.ig_username='goldcoast_ai_solutions';view.thread.subscriber_id='ig_graph:17841415641641750:989348707404558';
   const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
   const rows=new Map([[id,{...job,id,status:'pending',scheduled_for:new Date(Date.now()-1000).toISOString(),data:{...job.data,learn_link_followup:true,experiment_thread_id:THREAD,outcome:'scheduled',kind:'zoom'}}]]);
   let sends=0;
   live.db=async(route,opts={})=>{
    if(route.startsWith('ig_threads'))return [view.thread];
    if(route.startsWith('growth_outcome_events')||route.startsWith('balance_bookings'))return [];
    if(opts.method==='POST'){if(rows.has(opts.body.id))throw Error('database_409');rows.set(opts.body.id,structuredClone(opts.body));return[opts.body];}
    const key=route.match(/id=eq\.([^&]+)/)?.[1],row=rows.get(key);
    if(!row)return[];
    if(route.includes('outcome=eq.scheduled')&&row.data.outcome!=='scheduled')return[];
    const token=route.match(/data->>token=eq\.([^&]*)/)?.[1];if(token!==undefined&&row.data.token!==decodeURIComponent(token))return[];
    if(opts.method==='PATCH')Object.assign(row,structuredClone(opts.body));
    return[structuredClone(row)];
   };
   live.inspect=async()=>view;live.senderActions=()=>async()=>({ok:true});
   live.send=async request=>{await request.beforeSend();sends++;await request.onDelivered();return{outcome:'confirmed'};};
   const presenceFactory=()=>({events:[],start:async()=>{},before:async()=>{if(replyDuringTyping)view.messages.push({id:'new',direction:'in',created_at:new Date().toISOString()});},stop:async()=>{}});
   await Promise.all([run(id,{presenceFactory}),run(id,{presenceFactory})]);
   assert.equal(sends,replyDuringTyping?0:1);
   assert.equal(rows.get(id).status,replyDuringTyping?'canceled':'sent');
  }
 }finally{Object.assign(live,originals);}
});
