import { getBalanceCheckoutPlan } from './checkout-guard.js';

export const LEARN_PLAN = 'balance_learn_weekly';
const WEEK = 7 * 86400;
const idOf = value => typeof value === 'string' ? value : value?.id;

// Checkout takes the first weekly payment. Stripe owns every subsequent
// payment and the six-week transition; no application timer charges cards.
export async function ensureLearnBillingSchedule(stripe, subscription) {
    if (subscription?.metadata?.balance_plan !== LEARN_PLAN) return subscription;
    try {
        const current = await stripe.subscriptions.retrieve(subscription.id);
        if (current.metadata?.learn_schedule_configured === 'v1'
            || current.metadata?.cancellation_requested_at
            || current.cancel_at || current.cancel_at_period_end
            || !['active', 'trialing'].includes(current.status)) return current;
        const offer = getBalanceCheckoutPlan(LEARN_PLAN);
        const item = current.items?.data?.[0];
        const price = item?.price;
        if (current.items?.data?.length !== 1 || price?.unit_amount !== offer.unitAmount
            || price?.currency !== 'aud' || price?.recurring?.interval !== 'week'
            || price.recurring.interval_count !== 1 || item.quantity !== 1) {
            throw new Error('Unexpected Balance Learn subscription price');
        }
        const start = current.start_date;
        const transition = start + offer.introductoryWeeks * WEEK;
        if (!start || transition <= Math.floor(Date.now() / 1000)) throw new Error('Balance Learn schedule setup is overdue');
        let schedule = current.schedule
            ? await stripe.subscriptionSchedules.retrieve(idOf(current.schedule))
            : await stripe.subscriptionSchedules.create({ from_subscription: current.id }, {
                idempotencyKey: 'learn-schedule-create-v1-' + current.id,
            });
        if (schedule.metadata?.learn_schedule_configured === 'v1') return current;
        const metadata = { ...current.metadata, learn_schedule_configured: 'v1' };
        await stripe.subscriptionSchedules.update(schedule.id, {
            end_behavior: 'release', proration_behavior: 'none',
            metadata: { learn_schedule_configured: 'v1', balance_plan: LEARN_PLAN },
            phases: [
                { start_date: start, end_date: transition,
                    items: [{ price: price.id, quantity: 1 }],
                    metadata, proration_behavior: 'none' },
                { start_date: transition, duration: { interval: 'week', interval_count: offer.renewalIntervalCount },
                    items: [{ price_data: { currency: 'aud', product: idOf(price.product),
                        unit_amount: offer.renewalUnitAmount,
                        recurring: { interval: 'week', interval_count: offer.renewalIntervalCount } }, quantity: 1 }],
                    metadata, proration_behavior: 'none', billing_cycle_anchor: 'phase_start' },
            ],
        }, { idempotencyKey: 'learn-schedule-configure-v1-' + current.id });
        return await stripe.subscriptions.retrieve(current.id);
    } catch (error) {
        error.balanceScheduleFailure = true;
        throw error;
    }
}
