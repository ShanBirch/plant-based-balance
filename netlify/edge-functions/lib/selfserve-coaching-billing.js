import {isStandardTextSubscription,verifyStandardTextSubscription,ensureTextCoachingRelationship} from './standard-text-coaching-billing.js';
export const EXTRA_COACHING_PLANS=[{"key": "voice", "amount": 7500, "price": "price_1UWnyfCGCyRUsOfK1MOjgOMq", "product": "prod_balance_voice_support_20261101", "name": "Voice support", "plan": "standard_voice_coaching_weekly", "checkinFormat": "voice", "calls": 0, "minimumWeeks": 13, "termsVersion": "standard_voice_7500_13w_20261101_v1", "renewal": "weekly"}, {"key": "zoom", "amount": 12500, "price": "price_1UWnygCGCyRUsOfKqOS6nA6f", "product": "prod_balance_zoom_support_20261101", "name": "Zoom coaching", "plan": "standard_zoom_coaching_weekly", "checkinFormat": "voice", "calls": 1, "minimumWeeks": 13, "termsVersion": "standard_zoom_12500_13w_20261101_v1", "renewal": "weekly"}];
export function isSelfServeCoachingSubscription(s){return isStandardTextSubscription(s)||EXTRA_COACHING_PLANS.some(p=>s?.metadata?.balance_plan===p.plan||s?.items?.data?.some(i=>i.price?.id===p.price));}
export function verifySelfServeCoachingSubscription(s){
 if(isStandardTextSubscription(s)){verifyStandardTextSubscription(s);return;}if(!isSelfServeCoachingSubscription(s))return;
 const p=EXTRA_COACHING_PLANS.find(p=>p.plan===s.metadata?.balance_plan),m=s.metadata||{},items=s.items?.data||[],price=items[0]?.price;
 if(!p||!m.user_id||m.paid_agreement!==p.termsVersion||m.commitment_weeks!=='13'||m.cancellation_notice_days!=='0'||m.checkin_format!==p.checkinFormat||m.calls_per_week!==String(p.calls)||m.renewal_policy!==p.renewal||items.length!==1||items[0].quantity!==1||price.id!==p.price||price.unit_amount!==p.amount||price.currency!=='aud'||price.recurring?.interval!=='week'||price.recurring.interval_count!==1)throw Object.assign(Error('Coaching membership price, owner or agreement mismatch'),{standardTextMembership:true});
}
export async function ensureSelfServeCoachingRelationship(s,query){
 verifySelfServeCoachingSubscription(s);if(isStandardTextSubscription(s))return ensureTextCoachingRelationship(s,query);if(!isSelfServeCoachingSubscription(s)||s.status!=='active')return;
 const uid=s.metadata.user_id,coach='00a6605e-8edb-4917-85ba-24a23f179059';
 await query('coach_clients?on_conflict=coach_id,client_id',{method:'POST',prefer:'resolution=ignore-duplicates,return=minimal',body:{coach_id:coach,client_id:uid,status:'active',assigned_at:new Date().toISOString()}});
}
