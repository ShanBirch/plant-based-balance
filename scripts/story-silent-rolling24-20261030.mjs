// Planning only. Native review and every existing send/cleanup guard remain required.
const hour=3600000;
export function reviewSilentTiming(input){
 const {now,events,identityVerified,historyComplete,holds=[],trayObservation}=input;
 const time=Date.parse(now);
 const review=reason=>({decision:'needs_review',reason,clearance:false});
 if(identityVerified!==true||historyComplete!==true||!Array.isArray(events)||!Number.isFinite(time))return review('incomplete_identity_or_history');
 if(holds.length)return {decision:'hold',reason:'independent_hold',holds,clearance:false};
 let reply=null;const attempts=new Map();let latest=-Infinity;
 for(const e of events){
  const at=Date.parse(e.at);if(!Number.isFinite(at)||at>time||!e.id)return review('invalid_event');
  if(e.kind==='inbound'){
   if(e.substantive!==true)return review('reaction_or_ambiguous_inbound');
   if(!reply||at>Date.parse(reply.at))reply=e;
  }else if(e.kind==='proactive'){
   if(!e.attempt_id||(!e.verified&&!e.reserved&&!e.uncertain))return review('unproven_attempt');
   latest=Math.max(latest,at);
   const prior=attempts.get(e.attempt_id);
   if(!prior||at>Date.parse(prior.at))attempts.set(e.attempt_id,e);
  }else if(e.kind!=='reciprocal_closer')return review('unknown_event_kind');
 }
 const silent=[...attempts.values()].filter(e=>!reply||Date.parse(e.at)>Date.parse(reply.at)).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
 if(silent.some(e=>e.uncertain||e.reserved&&!e.verified))return {decision:'hold',reason:'unresolved_attempt',unanswered_attempts:silent.length,clearance:false};
 if(silent.length>=3){
  const third=silent[2];const observed=Date.parse(trayObservation?.at);
  if(!Number.isFinite(observed)||observed<=Date.parse(third.at)||observed>time||!trayObservation?.evidence_ref)return review('actual_subsequent_tray_observation_required');
  return {decision:'handoff_for_review',unanswered_attempts:silent.length,third_attempt:third,latest_substantive_reply:reply,eligible_after:new Date(Math.max(...silent.map(e=>Date.parse(e.at)))+7*24*hour).toISOString(),clearance:false};
 }
 const waitHours=silent.length===2?168:silent.length===1?72:24;
 if(time-latest<waitHours*hour)return {decision:'hold',reason:'rolling_24_hours',next_at:new Date(latest+waitHours*hour).toISOString(),unanswered_attempts:silent.length,clearance:false};
 return {decision:'timing_only_pass',unanswered_attempts:silent.length,latest_substantive_reply:reply,clearance:false};
}

