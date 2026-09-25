'use strict';
const {OWNER_ID}=require('./lcp-dm-knowledge');
async function refreshPortraitToken(query,fetcher=fetch,env=process.env,now=Date.now()){
  const key='lcp_ig_access_token';
  const rows=await query(`app_private_secrets?key=eq.${key}&select=value,updated_at&limit=1`);
  const row=rows[0];
  const token=row?.value||env.LCP_IG_ACCESS_TOKEN;
  if(!token)return {status:'not_connected'};
  const stamp=new Date(now).toISOString();
  if(!row){
    await query('app_private_secrets?on_conflict=key',{method:'POST',prefer:'resolution=ignore-duplicates,return=representation',body:{key,value:token,updated_at:stamp}});
    return {status:'renewal_scheduled'};
  }
  if(now-Date.parse(row.updated_at)<7*86400000)return {status:'not_due'};
  // Meta requires a valid token older than 24 hours. Never log this URL or body.
  const url=new URL('https://graph.instagram.com/refresh_access_token');
  url.searchParams.set('grant_type','ig_refresh_token');
  url.searchParams.set('access_token',token);
  const response=await fetcher(url,{signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Portrait token renewal needs attention');
  const renewed=await response.json();
  if(typeof renewed.access_token!=='string'||!renewed.access_token||Number(renewed.expires_in)<86400)throw Error('Portrait token renewal incomplete');
  const identityResponse=await fetcher('https://graph.instagram.com/v25.0/me?fields=user_id,username',{headers:{Authorization:`Bearer ${renewed.access_token}`},signal:AbortSignal.timeout(10000)});
  const identity=await identityResponse.json();
  if(!identityResponse.ok||String(identity.user_id)!==OWNER_ID||identity.username!=='littlecompanionportraits')throw Error('Portrait renewal identity mismatch');
  await query(`app_private_secrets?key=eq.${key}&updated_at=eq.${encodeURIComponent(row.updated_at)}`,{method:'PATCH',body:{value:renewed.access_token,updated_at:stamp}});
  return {status:'renewed'};
}
module.exports={refreshPortraitToken};
