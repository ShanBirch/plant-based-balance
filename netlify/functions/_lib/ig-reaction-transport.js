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
async function postGoalReaction({payload,accountId,token,query,fetcher=fetch,env=process.env,version='v25.0'}) {
 const primary=await request(fetcher,`https://graph.instagram.com/${version}/${encodeURIComponent(accountId)}/messages`,token,payload);
 if(primary.ok && !primary.data.error)return {...primary.data,reaction_transport:'instagram_graph'};
 // The verified linked-Page probe failed with capability error 3.
 // Preserve the primary failure without another request or blind retry.
 throw failure(primary);
}
module.exports={postGoalReaction};
