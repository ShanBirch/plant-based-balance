import crypto from 'node:crypto';
import context from '../functions/_lib/client-context.js';
export default async () => {
  const {supabaseQuery}=context;
  const pending=await supabaseQuery('lcp_dm_events?status=eq.queued&select=id&limit=1');
  if(!pending.length)return;
  const rows=await supabaseQuery('app_private_secrets?key=eq.lcp_ig_app_secret&select=value&limit=1');
  const secret=rows[0]?.value||process.env.LCP_IG_APP_SECRET;
  if(!secret)return;
  const body=JSON.stringify({drain:true,timestamp:Date.now()});
  await fetch(`${process.env.URL||'https://plantbased-balance.org'}/.netlify/functions/lcp-dm-background`,{method:'POST',headers:{'Content-Type':'application/json','x-hub-signature-256':'sha256='+crypto.createHmac('sha256',secret).update(body).digest('hex')},body,signal:AbortSignal.timeout(8000)});
};
export const config = { schedule: '* * * * *' };
