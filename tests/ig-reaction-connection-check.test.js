const test=require('node:test');
const assert=require('node:assert/strict');
const {handler}=require('../netlify/functions/ig-reaction-connection-check');
test('reaction diagnostics require server-admin authentication and do not leak a Page token',async()=>{
 const previous={...process.env};const original=global.fetch;
 process.env.SUPABASE_SERVICE_ROLE_KEY='test-secret';process.env.FACEBOOK_PAGE_ID='561122130919678';process.env.FACEBOOK_PAGE_ACCESS_TOKEN='private-page-token';
 let calls=0;
 global.fetch=async(url,options)=>{calls++;assert.equal(options.method,undefined);assert.ok(url.includes('instagram_business_account'));return new Response(JSON.stringify({id:'561122130919678',instagram_business_account:{id:'17841415641641750'}}));};
 try {
  assert.equal((await handler({httpMethod:'POST',headers:{}})).statusCode,403);assert.equal(calls,0);
  const result=await handler({httpMethod:'POST',headers:{authorization:'Bearer test-secret'}});
  assert.equal(JSON.parse(result.body).instagram_owner_matches,true);assert.equal(result.body.includes('private-page-token'),false);assert.equal(calls,1);
 }finally{global.fetch=original;for(const key of ['SUPABASE_SERVICE_ROLE_KEY','FACEBOOK_PAGE_ID','FACEBOOK_PAGE_ACCESS_TOKEN']){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}}
});
