export const TEXT_PLAN='standard_text_coaching_weekly',TEXT_PRICE='price_1UWlnXCGCyRUsOfKeq1Kn01q';
export function isStandardTextSubscription(s){return s?.metadata?.balance_plan===TEXT_PLAN||s?.items?.data?.some(x=>x.price?.id===TEXT_PRICE);}
export function verifyStandardTextSubscription(s){if(!isStandardTextSubscription(s))return;const m=s.metadata||{},items=s.items?.data||[];if(m.balance_plan!==TEXT_PLAN||m.paid_agreement!=='standard_text_4999_13w_20261101_v1'||!m.user_id||m.checkin_format!=='text'||m.commitment_weeks!=='13'||items.length!==1||items[0].price?.id!==TEXT_PRICE||items[0].quantity!==1)throw Object.assign(new Error('Standard text membership identity, price or terms mismatch'),{standardTextMembership:true});}
export async function ensureTextCoachingRelationship(subscription,query){
 verifyStandardTextSubscription(subscription);if(!isStandardTextSubscription(subscription)||subscription.status!=='active')return;
 const uid=subscription.metadata.user_id,coach='00a6605e-8edb-4917-85ba-24a23f179059';
 const existing=await query(`coach_clients?client_id=eq.${encodeURIComponent(uid)}&select=id&limit=1`);if(existing?.length)return;
 await query('coach_clients?on_conflict=coach_id,client_id',{method:'POST',prefer:'resolution=ignore-duplicates,return=minimal',body:{coach_id:coach,client_id:uid,status:'active',assigned_at:new Date().toISOString()}});
 // This is a normal paid coaching relationship. No free grant, outreach cohort,
 // reminder consent, voice entitlement or auto-send permission is created.
}
