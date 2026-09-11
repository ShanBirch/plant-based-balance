import { getBalanceCheckoutPlan } from './checkout-guard.js';

export const choices = ['balance_online_coaching_6_month_weekly', 'balance_online_coaching_3_month_weekly', 'balance_online_coaching_month_to_month_weekly'].map(token => getBalanceCheckoutPlan(token));
export function previewChange(subscription, token, now = Math.floor(Date.now()/1000)) {
 const plan = choices.find(p => p.token === token);
 const item = subscription.items?.data?.[0];
 const current = subscription.metadata?.balance_plan;
 if (!plan || ![...choices.map(p=>p.balancePlan), 'app_community_monthly'].includes(current)) throw new Error('Please contact Shannon to arrange this membership change.');
 if (subscription.status !== 'active' || subscription.items?.data?.length !== 1 || item.quantity !== 1 || subscription.schedule || subscription.cancel_at || subscription.cancel_at_period_end || subscription.pause_collection || subscription.pending_update || subscription.discount || subscription.discounts?.length || item.discounts?.length || subscription.automatic_tax?.enabled || subscription.default_tax_rates?.length || item.tax_rates?.length || subscription.pending_invoice_item_interval || subscription.billing_thresholds || subscription.transfer_data || subscription.application_fee_percent || item.price.recurring?.usage_type === 'metered' || subscription.collection_method !== 'charge_automatically') throw new Error('This membership needs a review before changing. Please contact Shannon.');
 if (current === plan.balancePlan || item.price.currency !== 'aud' || !['week','month'].includes(item.price.recurring?.interval) || item.price.recurring.interval_count !== 1) throw new Error('Choose a different eligible membership.');
 const start = Number(subscription.metadata?.commitment_start || subscription.start_date || subscription.created);
 const minimumEnd = start + Number(subscription.metadata?.commitment_weeks || 0)*604800;
 let effectiveAt = Number(item.current_period_end || subscription.current_period_end);
 if (!Number.isFinite(effectiveAt) || effectiveAt <= now + 300) throw new Error('Your payment is renewing. Please try again after renewal.');
 // Weekly commitments can end between two boundaries after a previous pause.
 if (minimumEnd > effectiveAt) {
  if (item.price.recurring.interval !== 'week') throw new Error('Please contact Shannon to review your existing commitment.');
  effectiveAt += Math.ceil((minimumEnd-effectiveAt)/604800)*604800;
 }
 return {subscriptionId:subscription.id, token, name:plan.productName, unitAmount:plan.unitAmount, effectiveAt, commitmentWeeks:plan.commitmentWeeks, minimumTotal:plan.unitAmount*plan.commitmentWeeks, disclosure:plan.checkoutDisclosure, currentPrice:item.price.id, currentAmount:item.price.unit_amount, currentInterval:item.price.recurring.interval};
}
export function scheduleParameters(schedule, subscription, quote, priceId) {
 const plan = choices.find(p=>p.token===quote.token);
 const params = new URLSearchParams({end_behavior:'release',proration_behavior:'none'});
 const set=(k,v)=>params.set(k,String(v));
 set('phases[0][start_date]',schedule.current_phase.start_date);
 set('phases[0][end_date]',quote.effectiveAt);
 set('phases[0][items][0][price]',quote.currentPrice);
 set('phases[0][items][0][quantity]',1);
 set('phases[0][proration_behavior]','none');
 set('phases[1][start_date]',quote.effectiveAt);
 set('phases[1][end_date]',quote.effectiveAt+plan.commitmentWeeks*604800);
 set('phases[1][items][0][price]',priceId);
 set('phases[1][items][0][quantity]',1);
 set('phases[1][billing_cycle_anchor]','phase_start');
 set('phases[1][proration_behavior]','none');
 const metadata={...subscription.metadata,balance_plan:plan.balancePlan,balance_product:plan.balanceProduct,commitment_weeks:plan.commitmentWeeks,commitment_start:quote.effectiveAt,commitment_label:plan.commitmentLabel,cancellation_notice_days:30,renewal_terms:plan.renewalTerms,checkins_per_week:1,calls_per_week:0,membership_change_source:'website'};
 for(const [key,value] of Object.entries(metadata)) set(`phases[1][metadata][${key}]`,value);
 set('metadata[balance_membership_change]','website_v1');
 set('metadata[target_name]',quote.name);
 set('metadata[effective_at]',quote.effectiveAt);
 return params;
}
