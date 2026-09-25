'use strict';
const {OWNER_ID}=require('./lcp-dm-knowledge');

// Remove the entire portrait-account entry before any legacy coaching,
// comment campaign, media or history processing can see it.
async function routePortraitEntries(payload,event,fetcher=fetch) {
  const own=(payload.entry||[]).filter(e=>String(e.id)===OWNER_ID);
  if(!own.length)return payload;
  const response=await fetcher(`${process.env.URL||'https://plantbased-balance.org'}/.netlify/functions/lcp-dm-background`,{
    method:'POST',headers:{'Content-Type':'application/json','x-hub-signature-256':event.headers?.['x-hub-signature-256']||event.headers?.['X-Hub-Signature-256']||''},
    body:event.isBase64Encoded?Buffer.from(event.body||'','base64').toString('utf8'):event.body,
    signal:AbortSignal.timeout(8000),
  });
  if(!response.ok)throw Error('Portrait DM dispatch unavailable');
  return {...payload,entry:(payload.entry||[]).filter(e=>String(e.id)!==OWNER_ID)};
}
module.exports={routePortraitEntries};
