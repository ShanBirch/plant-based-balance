const {supabaseQuery}=require('./_lib/client-context');
exports.handler=async event=>{
 const reply=(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(body)});
 if(event.httpMethod!=='GET')return reply(405,{error:'Read-only preview access.'});
 const authorization=event.headers?.authorization||event.headers?.Authorization||'';
 if(!/^Bearer \S+$/i.test(authorization))return reply(401,{error:'Sign into your own Balance account first.'});
 try {
  const r=await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`,{headers:{Authorization:authorization,apikey:process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY}});
  if(!r.ok)return reply(401,{error:'Please sign in again.'});
  const user=await r.json();
  if(user.id==='76e73c43-d06b-45db-afed-8203dc862752'&&!user.is_anonymous&&user.app_metadata?.balance_support_preview===true){
   const profile=await supabaseQuery(`users?id=eq.${encodeURIComponent(user.id)}&select=is_test_account&limit=1`);
   if(profile?.[0]?.is_test_account===true)return reply(200,{adminPreview:true,previewRole:'test',userId:user.id});
  }
  if(user.id!=='00a6605e-8edb-4917-85ba-24a23f179059'||user.is_anonymous)return reply(403,{error:'This read-only walkthrough is for Shannon only.'});
  const admin=await supabaseQuery(`admin_users?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`);
  if(!admin?.length)return reply(403,{error:'Administrator verification required.'});
  return reply(200,{adminPreview:true,userId:user.id});
 }catch(e){return reply(503,{error:'Preview access could not be verified. Please retry.'});}
};
