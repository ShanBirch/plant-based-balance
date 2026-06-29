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
    checkoutSession.includes('success_url: checkoutOrigin') &&
    checkoutSession.includes('customer_email: checkoutEmail || undefined'),
    'hosted Checkout sessions should use the guarded origin and validated compliance context'
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
    webhook.includes('mirrored without user/status side effects'),
    'inactive Stripe subscription attempts should not patch users by email or record negative revenue unless linked'
);

console.log('Stripe checkout hardening assertions passed');
