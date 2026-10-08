const crypto=require('node:crypto');
const {SUPABASE_URL,SUPABASE_SERVICE_KEY,supabaseQuery}=require('./_lib/client-context');
const reply=(statusCode,data)=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Referrer-Policy':'no-referrer'},body:JSON.stringify(data)});
function timing(day,time,now=Date.now()){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^\d{2}:\d{2}$/.test(time))throw Error('Choose a day and time.');
 const shop=new Date(day+'T'+time+':00+10:00');
 if(!Number.isFinite(+shop)||+shop<now||+shop>now+90*86400000||time>'22:30')throw Error('Choose a future shopping time before 10:30 pm, within the next 90 days.');
 const follow=new Date(Math.max(+new Date(day+'T19:00:00+10:00'),+shop+3600000));
 return {shop_at:shop.toISOString(),follow_up_at:follow.toISOString()};
}
exports.handler=async event=>{
 if(!['GET','POST'].includes(event.httpMethod))return reply(405,{error:'Method not allowed'});
 try{
 const input=event.httpMethod==='POST'?JSON.parse(event.body||'{}'):(event.queryStringParameters||{});
 if(!/^[a-f0-9]{64}$/.test(input.token||''))return reply(403,{error:'Open the shopping link from your email.'});
 const tokenHash=crypto.createHash('sha256').update(input.token).digest('hex');
 const [invite]=await supabaseQuery('meal_shop_invitations?select=id,shop_at,follow_up_at&token_hash=eq.'+tokenHash+'&expires_at=gt.'+encodeURIComponent(new Date().toISOString())+'&limit=1');
 if(!invite)return reply(403,{error:'This shopping link has expired. Ask Shannon for a new one.'});
 if(event.httpMethod==='GET')return reply(200,{shop_at:invite.shop_at,follow_up_at:invite.follow_up_at});
 const dates=timing(input.day,input.time);
 const saved=await supabaseQuery('rpc/save_meal_shop',{method:'POST',body:{p_token_hash:tokenHash,p_shop_at:dates.shop_at,p_follow_up_at:dates.follow_up_at}});
 return reply(200,saved);
 }catch(error){return reply(400,{error:error.message?.includes('Choose')?error.message:'Your shopping time could not be saved. Try again or contact Shannon.'});}
};
exports.timing=timing;
