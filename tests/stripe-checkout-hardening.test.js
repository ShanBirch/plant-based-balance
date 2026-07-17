const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const guard = fs.readFileSync(path.join(root, 'netlify/edge-functions/lib/checkout-guard.js'), 'utf8');
const checkoutSession = fs.readFileSync(path.join(root, 'netlify/edge-functions/create-checkout-session.js'), 'utf8');
const createSubscription = fs.readFileSync(path.join(root, 'netlify/edge-functions/create-subscription.js'), 'utf8');
const checkout = fs.readFileSync(path.join(root, 'checkout.js'), 'utf8');
const webhook = fs.readFileSync(path.join(root, 'netlify/edge-functions/stripe-webhook.js'), 'utf8');

assert(
    guard.includes('assertSameSiteCheckoutRequest') &&
    guard.includes('assertAcceptedCheckoutTerms') &&
    guard.includes('assertStarterCoachingPlan') &&
    guard.includes('getBalanceCheckoutPlan') &&
    guard.includes('balance_app_community_monthly') &&
    guard.includes('unitAmount: 1999') &&
    guard.includes('interval: "month"') &&
    guard.includes('balance_coaching_calls_weekly') &&
    guard.includes('unitAmount: 9999') &&
    guard.includes('callsPerWeek: "1"') &&
    guard.includes('balance_vegan_founders_pass') &&
    guard.includes('unitAmount: 9900') &&
    guard.includes('mode: "payment"') &&
    guard.includes('assertRecurringCheckoutPlan') &&
    guard.includes('plantbased-balance.org'),
    'checkout guard should enforce Balance origin, accepted terms, and the allowlisted recurring plan tokens'
);

assert(
    checkoutSession.includes('const checkoutOrigin = assertSameSiteCheckoutRequest(request);') &&
    checkoutSession.includes('assertAcceptedCheckoutTerms(compliance);') &&
    checkoutSession.includes('successUrl: checkoutOrigin') &&
    checkoutSession.includes('const plan = getBalanceCheckoutPlan(priceId);') &&
    checkoutSession.includes('checkout.plan.unitAmount') &&
    checkoutSession.includes('params.set("mode", checkout.plan.mode)') &&
    checkoutSession.includes('payment_intent_data[metadata]') &&
    checkoutSession.includes('calls_per_week: plan.callsPerWeek') &&
    checkoutSession.includes('customerEmail: checkoutEmail') &&
    checkoutSession.includes('https://api.stripe.com/v1/checkout/sessions') &&
    checkoutSession.includes('"Content-Type": "application/x-www-form-urlencoded"') &&
    !checkoutSession.includes('import Stripe from "stripe"'),
    'hosted Checkout sessions should use the guarded origin and Stripe REST API without the restricted Node SDK runtime'
);

assert(
    createSubscription.includes('assertStripePaymentMethodId(paymentMethodId);') &&
    createSubscription.includes('const checkoutEmail = cleanCheckoutEmail(email, { required: true });') &&
    createSubscription.includes('const plan = getBalanceCheckoutPlan(priceId);') &&
    createSubscription.includes('assertRecurringCheckoutPlan(plan);') &&
    createSubscription.includes('unit_amount: plan.unitAmount') &&
    createSubscription.includes('interval: plan.interval') &&
    createSubscription.includes('balance_plan: plan.balancePlan') &&
    createSubscription.includes('calls_per_week: plan.callsPerWeek') &&
    createSubscription.includes('email: checkoutEmail') &&
    !createSubscription.includes('unit_amount: 2999'),
    'wallet subscription creation should validate the payer and create the selected allowlisted plan'
);

assert(
    checkout.includes("'app-monthly': { amount: 1999, label: 'Balance App + Community', successPlan: 'app_community_monthly' }") &&
    checkout.includes("'coaching-calls': { amount: 9999, label: 'Balance Coaching + Calls', successPlan: 'coaching_calls_weekly' }") &&
    checkout.includes("'founders-pass': { amount: 9900, label: 'Balance Vegan Fitness Founders Pass', successPlan: 'founders_pass_lifetime' }") &&
    checkout.includes("walletAvailable && btn.dataset.hostedCheckoutOnly !== 'true' && !isBumpChecked") &&
    checkout.includes('plan=${encodeURIComponent(successPlan)}'),
    'wallet checkout should preserve the selected plan and route order bumps through hosted Checkout'
);

assert(
    webhook.includes('async function patchUsersForSubscription(payload, { patchByEmail = true } = {})') &&
    webhook.includes('const isActive = ACTIVE_SUBSCRIPTION_STATUSES.has(status);') &&
    webhook.includes('patchUsersForSubscription(payload, { patchByEmail: isActive })') &&
    webhook.includes('mirrored without user/status side effects') &&
    webhook.includes('function subscriptionOfferDetails(plan)') &&
    webhook.includes('app_community_monthly') &&
    webhook.includes('checkinsPerWeek: "0"') &&
    webhook.includes('coaching_calls_weekly') &&
    webhook.includes('subtype: "coaching_calls_sale"') &&
    webhook.includes('async function recordFoundersPassSale') &&
    webhook.includes('founders_pass_purchases?on_conflict=stripe_checkout_session_id') &&
    webhook.includes('calls_per_week: offer.callsPerWeek') &&
    webhook.includes('function createStripeRestClient(secretKey)') &&
    webhook.includes('https://api.stripe.com/v1/') &&
    webhook.includes('const stripe = createStripeRestClient(STRIPE_SECRET_KEY);') &&
    !webhook.includes('Stripe.createFetchHttpClient()'),
    'webhooks should safely mirror subscription truth and use REST for Stripe network calls in the restricted Edge runtime'
);

console.log('Stripe checkout hardening assertions passed');
