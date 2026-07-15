const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const guard = fs.readFileSync(path.join(root, 'netlify/edge-functions/lib/checkout-guard.js'), 'utf8');
const checkoutSession = fs.readFileSync(path.join(root, 'netlify/edge-functions/create-checkout-session.js'), 'utf8');
const createSubscription = fs.readFileSync(path.join(root, 'netlify/edge-functions/create-subscription.js'), 'utf8');
const webhook = fs.readFileSync(path.join(root, 'netlify/edge-functions/stripe-webhook.js'), 'utf8');

assert(
    guard.includes('assertSameSiteCheckoutRequest') &&
    guard.includes('assertAcceptedCheckoutTerms') &&
    guard.includes('assertStarterCoachingPlan') &&
    guard.includes('plantbased-balance.org'),
    'checkout guard should enforce Balance origin, accepted terms, and the starter plan token'
);

assert(
    checkoutSession.includes('const checkoutOrigin = assertSameSiteCheckoutRequest(request);') &&
    checkoutSession.includes('assertAcceptedCheckoutTerms(compliance);') &&
    checkoutSession.includes('successUrl: checkoutOrigin') &&
    checkoutSession.includes('customerEmail: checkoutEmail') &&
    checkoutSession.includes('https://api.stripe.com/v1/checkout/sessions') &&
    checkoutSession.includes('"Content-Type": "application/x-www-form-urlencoded"') &&
    !checkoutSession.includes('import Stripe from "stripe"'),
    'hosted Checkout sessions should use the guarded origin and Stripe REST API without the restricted Node SDK runtime'
);

assert(
    createSubscription.includes('assertStripePaymentMethodId(paymentMethodId);') &&
    createSubscription.includes('const checkoutEmail = cleanCheckoutEmail(email, { required: true });') &&
    createSubscription.includes('email: checkoutEmail'),
    'wallet subscription creation should require a real payment method and validated payer email'
);

assert(
    webhook.includes('async function patchUsersForSubscription(payload, { patchByEmail = true } = {})') &&
    webhook.includes('const isActive = ACTIVE_SUBSCRIPTION_STATUSES.has(status);') &&
    webhook.includes('patchUsersForSubscription(payload, { patchByEmail: isActive })') &&
    webhook.includes('mirrored without user/status side effects') &&
    webhook.includes('function createStripeRestClient(secretKey)') &&
    webhook.includes('https://api.stripe.com/v1/') &&
    webhook.includes('const stripe = createStripeRestClient(STRIPE_SECRET_KEY);') &&
    !webhook.includes('Stripe.createFetchHttpClient()'),
    'webhooks should safely mirror subscription truth and use REST for Stripe network calls in the restricted Edge runtime'
);

console.log('Stripe checkout hardening assertions passed');
