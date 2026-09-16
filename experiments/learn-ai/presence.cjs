'use strict';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// About 150 words/minute: a 45-word paragraph takes 20 seconds.
// No random jitter or fast-lane compression. Upload time is not extra typing time.
function duration(action){
 if(action.type==='reaction')return 0;
 if(action.type!=='text')return 1800;
 const words=String(action.text||'').trim().split(/\s+/).filter(Boolean).length;
 return Math.min(30000,Math.max(3000,2000+words*400));
}
function createPresence({signal,now=Date.now,wait=sleep,setEvery=setInterval,clearEvery=clearInterval,onHeartbeat=async()=>{}}){
 let timer,stopped=false,inFlight,startedAt,finishedAt,stopPromise;
 const events=[];
 async function emit(action){
  try{const result=await signal(action);events.push({action,at:new Date(now()).toISOString(),ok:result?.ok!==false});}
  catch(e){events.push({action,at:new Date(now()).toISOString(),ok:false,error:e.message});}
 }
 async function refresh(){
  if(stopped)return;
  if(inFlight)return inFlight;
  inFlight=(async()=>{await onHeartbeat();if(!stopped)await emit('typing_on');})();
  try{await inFlight;}finally{inFlight=null;}
 }
 return {
  events,
  async start(){
   await emit('mark_seen');startedAt=now();
   await refresh();
   timer=setEvery(()=>{refresh().catch(()=>{});},4000);timer?.unref?.();
  },
  async before(action){
   const target=duration(action),elapsed=now()-(finishedAt??startedAt);
   const delay=Math.max(0,target-elapsed);
   if(delay)await wait(delay);
   return {target_ms:target,wait_ms:delay};
  },
  async delivered(hasNext){
   finishedAt=now();
   // Sending clears the platform indicator. Reassert immediately for the next
   // bubble, without an artificial typing_off/typing_on flicker between items.
   if(hasNext){if(inFlight)await inFlight;await refresh();}
  },
  stop(){
   if(stopPromise)return stopPromise;
   stopped=true;if(timer)clearEvery(timer);
   stopPromise=(async()=>{if(inFlight)await inFlight.catch(()=>{});await emit('typing_off');})();
   return stopPromise;
  }
 };
}
module.exports={duration,createPresence};
