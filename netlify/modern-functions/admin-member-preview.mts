export default async function handler(request) {
  const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  if(request.method!=='POST')return reply(405,{error:'Method not allowed'});
  const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY;
  if(!url||!key)return reply(500,{error:'Server unavailable'});
  const authorization=request.headers.get('authorization')||'';
  if(!/^Bearer\s+\S+$/i.test(authorization))return reply(401,{error:'Unauthorized'});
  const identity=await fetch(url+'/auth/v1/user',{headers:{apikey:key,Authorization:authorization}});
  if(!identity.ok)return reply(401,{error:'Unauthorized'});
  const admin=await identity.json();
  if(String(admin.email||'').toLowerCase()!=='shannonbirch@cocospersonaltraining.com')return reply(403,{error:'Forbidden'});
  let body;try{body=await request.json();}catch{return reply(400,{error:'Invalid request'});}
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.userId||''))return reply(400,{error:'Invalid member'});
  const result=await fetch(url+'/auth/v1/admin/users/'+body.userId,{headers:{apikey:key,Authorization:'Bearer '+key}});
  if(!result.ok)return reply(404,{error:'Member not found'});
  const member=await result.json(),metadata=member.user_metadata||{};
  // Navigation/display preferences only; no tokens or unrelated private metadata.
  return reply(200,{id:member.id,user_metadata:{balance_onboarding_mode:metadata.balance_onboarding_mode,balance_coach_prepared:metadata.balance_coach_prepared===true,balance_learning_profile:metadata.balance_learning_profile}});
}
