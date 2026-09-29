const {configuredPageIds,getMessengerToken}=require('./facebook-messenger');
async function request(fetcher,url,token,payload) {
 const response=await fetcher(url,{
  method:payload?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
  ...(payload?{body:JSON.stringify(payload)}:{}),signal:AbortSignal.timeout(5000),
 });
 return {ok:response.ok,status:response.status,data:await response.json()};
}
function failure(result) {
 return new Error(`reaction_graph_${result.status}: ${result.data.error?.code || ''}/${result.data.error?.error_subcode || ''} ${String(result.data.error?.message || '').slice(0,160)}`);
}
async function postFacebookGoalReaction({payload,accountId,query,fetcher=fetch,env=process.env,version='v25.0'}) {
 for(const pageId of configuredPageIds(env)) {
  const token=await getMessengerToken(pageId,query,env);
  if(!token)continue;
  const identity=await request(fetcher,`https://graph.facebook.com/${version}/${pageId}?fields=id,instagram_business_account`,token);
  if(!identity.ok || String(identity.data.id)!==pageId || String(identity.data.instagram_business_account?.id)!==String(accountId))continue;
  const sent=await request(fetcher,`https://graph.facebook.com/${version}/${accountId}/messages`,token,payload);
  if(!sent.ok || sent.data.error)throw failure(sent);
  return {...sent.data,reaction_transport:'facebook_linked_instagram'};
 }
 throw new Error('reaction_verified_page_connection_unavailable');
}
async function postGoalReaction({payload,accountId,token,query,fetcher=fetch,env=process.env,version='v25.0'}) {
 const primary=await request(fetcher,`https://graph.instagram.com/${version}/${encodeURIComponent(accountId)}/messages`,token,payload);
 if(primary.ok && !primary.data.error)return {...primary.data,reaction_transport:'instagram_graph'};
 // Only a definite transient rejection can change routes. Never retry an
 // ambiguous timeout, accepted request, permission failure or invalid target.
 if(primary.status>=500 && primary.data.error?.code===2 && primary.data.error?.is_transient===true) {
  return postFacebookGoalReaction({payload,accountId,query,fetcher,env,version});
 }
 throw failure(primary);
}
module.exports={postGoalReaction,postFacebookGoalReaction};
