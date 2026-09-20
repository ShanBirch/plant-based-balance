const review=require('./_lib/learn-action-review');
const learnAI=require('./_lib/learn-action-ai-review');
const {SUPABASE_URL,SUPABASE_SERVICE_KEY,supabaseQuery}=require('./_lib/client-context');
const json=(status,body)=>({statusCode:status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(body)});
exports.handler=async event=>{
 if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'});
 const token=String(event.headers?.authorization||event.headers?.Authorization||'').replace(/^Bearer\s+/i,'');
 if(!token)return json(401,{error:'Login required'});
 try{
   const auth=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:{apikey:SUPABASE_SERVICE_KEY,Authorization:'Bearer '+token}});
   const user=auth.ok ? await auth.json() : null;
   if(!user?.id)return json(401,{error:'Login required'});
   const input=event.httpMethod==='POST'?JSON.parse(event.body||'{}'):(event.queryStringParameters||{});
   const target=input.client_id||user.id;
   if(event.httpMethod==='GET' && input.course_preview==='1'){
     if(target!==user.id && !await review.canReview(user.id,target))return json(403,{error:'Coach authorization required.'});
     const rows=await supabaseQuery(`social_journey_progress?select=*&user_id=eq.${encodeURIComponent(target)}&limit=1`);
     return json(200,{ok:true,journey:rows[0]||null});
   }
   const ctx=await review.context(user.id,target,input.enrollment_id||null);
   if(event.httpMethod==='GET'){
     if(ctx.available && !ctx.can_review)ctx.records=await learnAI.retryPending(user.id,ctx.records);
     const mealWeek=ctx.available ? review.actions.curriculum.weeks(ctx.curriculum_version).find(w=>w.action===6)?.number : null;
     if(ctx.available && !ctx.can_review && mealWeek && ctx.current_week>=mealWeek)Object.assign(ctx,await review.nutrition(user.id,review.weekStart(ctx,mealWeek)));
     return json(200,{ok:true,...ctx});
   }
   if(input.operation==='restart'){
     if(target!==user.id || !ctx.available)throw review.error('Only your own enrollment can be restarted.',403);
     const enrollment=await supabaseQuery('rpc/ensure_learn_action_enrollment',{method:'POST',body:{p_user_id:user.id,p_start_date:ctx.enrollment.start_date,p_restart:true}});
     return json(200,{ok:true,enrollment:Array.isArray(enrollment)?enrollment[0]:enrollment});
   }
   if(input.operation==='plan'){
     if(target!==user.id)throw review.error('Only the member can save their reflection.',403);
     const {week,definition}=review.assertMemberContext(ctx,input);
     if(input.lesson_id!==definition.lessonId || review.clean(input.reflection_text).length<3)throw review.error('Add your reflection for this lesson.');
     const record=await review.write(ctx,user.id,week,'plan',{reflection_text:review.clean(input.reflection_text),lesson_id:definition.lessonId,instructions:definition},Number(input.revision));
     return json(200,{ok:true,record});
   }
   if(['approve','request_information'].includes(input.operation)){
     if(!ctx.can_review || !await review.canReview(user.id,target))throw review.error('Coach authorization required.',403);
     const existing=ctx.records.find(r=>Number(r.week)===Number(input.week));
     if(input.operation==='approve' && existing?.instructions?.requiresFeed){
       const feed=existing.report?.feed;
       if(!feed?.verified_at || !review.actions.feedEvidence(feed.posts||[],feed.comments||[],target,feed.start,feed.end).complete)throw review.error('Three saved Feed posts and comments on three other posts are needed. Ask the member to update their weekly check-in.');
     }
     const note=review.clean(input.note);
     if(note.length<2)throw review.error('Record why the criteria are met or what information is needed.');
     const record=await review.write(ctx,user.id,Number(input.week),input.operation,{note},Number(input.revision));
     return json(200,{ok:true,record});
   }
   return json(400,{error:'Unsupported action'});
 }catch(e){
   if(e.sqlstate==='40001')return json(409,{error:'This evidence changed. Reload before continuing.'});
   if(e.sqlstate==='42501')return json(403,{error:'You are not authorized to change this action.'});
   if(e.sqlstate)return json(409,{error:'This action cannot be changed in its current state. Reload to see the saved record.'});
   if(e instanceof SyntaxError)return json(400,{error:'Invalid request.'});
   return json(e.status && !e.body ? e.status : 500,{error:e.status && !e.body ? e.message : 'The action could not be saved. Please reload and try again.'});
 }
};
