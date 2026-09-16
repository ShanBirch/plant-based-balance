import { timingSafeEqual } from 'node:crypto';
import followup from '../../experiments/learn-ai/followup.cjs';
export default async (request: Request) => {
 const expected=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||'';
 const supplied=request.headers.get('authorization')||'';
 const a=Buffer.from(supplied),b=Buffer.from(`Bearer ${expected}`);
 if(request.method!=='POST'||!expected||a.length!==b.length||!timingSafeEqual(a,b))return new Response('Unauthorized',{status:401});
 const payload=await request.json();
 return Response.json(await followup.run(String(payload.id||'')));
};
export const config={background:true};
