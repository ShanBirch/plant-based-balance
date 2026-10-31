export const ORGANIC_PLAN='organic_coaching_continuation_weekly';
export const ORGANIC_PRICE='price_1UWkkrCGCyRUsOfKYcvJGqiR';
const id=value=>typeof value==='string'?value:value?.id;
export function isOrganicContinuation(subscription){return subscription?.metadata?.balance_plan===ORGANIC_PLAN||subscription?.items?.data?.some(x=>id(x.price)===ORGANIC_PRICE);}
export async function verifyOrganicContinuation(subscription,query){
 if(!isOrganicContinuation(subscription))return;
 const m=subscription.metadata||{},items=subscription.items?.data||[];
 if(m.balance_plan!==ORGANIC_PLAN||m.paid_agreement!=='explicit_checkout_20261101'||!m.user_id||items.length!==1||id(items[0].price)!==ORGANIC_PRICE||items[0].quantity!==1||await query('rpc/organic_outreach_cohort_allowed',{method:'POST',body:{p_user_id:m.user_id}})!==true)throw Object.assign(new Error('Organic continuation identity, agreement, price or cohort could not be verified'),{organicContinuation:true});
}
// Resolve risk events through Stripe resources, never customer-supplied metadata.
export async function organicBillingSubscriptions(event,read){
 const obj=event.data.object,subscriptions=new Map();
 const addInvoice=async invoice=>{const sid=id(invoice?.parent?.subscription_details?.subscription||invoice?.subscription);if(sid){const sub=await read('subscriptions/'+encodeURIComponent(sid));if(isOrganicContinuation(sub))subscriptions.set(sub.id,sub);}};
 if(event.type==='invoice.payment_failed'){await addInvoice(obj);return [...subscriptions.values()];}
 if(!['charge.refunded','charge.dispute.created','radar.early_fraud_warning.created'].includes(event.type))return [];
 let pi=id(obj.payment_intent);
 if(!pi){const charge=event.type==='charge.refunded'?obj:await read('charges/'+encodeURIComponent(id(obj.charge)));pi=id(charge.payment_intent);}
 if(!pi)return [];
 let after='';
 do {const params=new URLSearchParams({'payment[type]':'payment_intent','payment[payment_intent]':pi,status:'paid',limit:'100'});if(after)params.set('starting_after',after);const page=await read('invoice_payments?'+params);for(const payment of page.data||[]){await addInvoice(await read('invoices/'+encodeURIComponent(id(payment.invoice))));}if(!page.has_more)break;const next=page.data?.at(-1)?.id;if(!next||next===after)throw Error('Invoice payment pagination did not advance');after=next;}while(true);
 return [...subscriptions.values()];
}
