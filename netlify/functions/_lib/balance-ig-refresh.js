'use strict';
const OWNER_ID='17841415641641750';
async function refreshBalanceToken(query,fetcher=fetch,now=Date.now()){
  const key='meta_ig_access_token_17841415641641750';
  const rows=await query(`app_private_secrets?key=eq.${key}&select=value,updated_at&limit=1`);
  const row=rows[0];
  const token=row?.value;
  if(!token)return {status:'not_connected'};
  const stamp=new Date(now).toISOString();
  if(now-Date.parse(row.updated_at)<7*86400000)return {status:'not_due'};
  // Meta requires a valid token older than 24 hours. Never log this URL or body.
  const url=new URL('https://graph.instagram.com/refresh_access_token');
  url.searchParams.set('grant_type','ig_refresh_token');
  url.searchParams.set('access_token',token);
  const response=await fetcher(url,{signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Balance token renewal needs attention');
  const renewed=await response.json();
  if(typeof renewed.access_token!=='string'||!renewed.access_token||Number(renewed.expires_in)<86400)throw Error('Balance token renewal incomplete');
  const identityResponse=await fetcher('https://graph.instagram.com/v25.0/me?fields=user_id,username',{headers:{Authorization:`Bearer ${renewed.access_token}`},signal:AbortSignal.timeout(10000)});
  const identity=await identityResponse.json();
  if(!identityResponse.ok||String(identity.user_id)!==OWNER_ID||identity.username!=='shan_n_sunny')throw Error('Balance renewal identity mismatch');
  const saved=await query(`app_private_secrets?key=eq.${key}&updated_at=eq.${encodeURIComponent(row.updated_at)}`,{method:'PATCH',body:{value:renewed.access_token,updated_at:stamp}});
  return {status:saved?.length?'renewed':'connection_changed'};
}
module.exports={refreshBalanceToken};
