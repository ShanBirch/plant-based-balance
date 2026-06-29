import Stripe from "stripe";
import { sendCAPIEvent, hash } from "./lib/capi-utils.js";
import {
    assertAcceptedCheckoutTerms,
    assertSameSiteCheckoutRequest,
    assertStarterCoachingPlan,
    assertStripePaymentMethodId,
    checkoutErrorResponse,
    cleanCheckoutEmail,
} from "./lib/checkout-guard.js";

export default async (request, context) => {
    // Only allow POST
    if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const body = await request.json();
        const { email, name, paymentMethodId, priceId, isDiscounted, fbc, fbp, compliance } = body;
        assertSameSiteCheckoutRequest(request);
        assertStarterCoachingPlan(priceId);
        assertAcceptedCheckoutTerms(compliance);
        assertStripePaymentMethodId(paymentMethodId);
        const checkoutEmail = cleanCheckoutEmail(email, { required: true });
        const complianceMetadata = compliance?.metadata || {};
        const documentVersions = compliance?.document_versions || {};
        const stripeComplianceMetadata = {
            agreement_session_id: complianceMetadata.compliance_session_id || "",
            accepted_terms: compliance?.accepted?.terms ? "true" : "false",
            accepted_privacy: compliance?.accepted?.privacy ? "true" : "false",
            accepted_client_agreement: compliance?.accepted?.client_agreement ? "true" : "false",
            accepted_refund_policy: compliance?.accepted?.refund_policy ? "true" : "false",
            legal_versions: JSON.stringify(documentVersions).slice(0, 500),
        };
        
        const ip = request.headers.get("x-nf-client-connection-ip") || "0.0.0.0";
        const userAgent = request.headers.get("user-agent");
        const referer = request.headers.get("referer");

        const STRIPE_SECRET_KEY = globalThis.Netlify?.env?.get?.("STRIPE_SECRET_KEY") || Deno.env.get("STRIPE_SECRET_KEY");
        if (!STRIPE_SECRET_KEY) throw new Error("Missing Internal Configuration");

        const stripe = new Stripe(STRIPE_SECRET_KEY, {
            httpClient: Stripe.createFetchHttpClient(),
            apiVersion: "2026-02-25.clover",
        });

        // Balance Starter Coaching: AUD $29.99/week with one weekly check-in.
        let finalValue = 29.99;

        const externalId = await hash(checkoutEmail);

        // 2. Track InitiateCheckout via CAPI (Background)
        // context.waitUntil runs this without blocking variables
        context.waitUntil(
            sendCAPIEvent('InitiateCheckout', {
                email: checkoutEmail,
                external_id: externalId,
                firstName: name ? name.split(' ')[0] : undefined,
                ip,
                userAgent,
                fbc, fbp,
                sourceUrl: referer
            }, {
                content_category: 'Starter Coaching',
                content_ids: [priceId],
                value: finalValue,
                currency: 'AUD'
            })
        );

        // 3. Create Stripe Customer
        const customer = await stripe.customers.create({
            email: checkoutEmail,
            name,
            payment_method: paymentMethodId,
            invoice_settings: { default_payment_method: paymentMethodId },
            metadata: {
                fbc,
                fbp,
                checkout_email: checkoutEmail,
                balance_product: "balance_starter_coaching",
                balance_plan: "starter_weekly",
                checkins_per_week: "1",
                ...stripeComplianceMetadata
            }
        });

        // 4. Create Subscription
        const subscriptionData = {
            customer: customer.id,
            items: [{
                price_data: {
                    currency: 'aud',
                    product_data: {
                        name: 'Balance Starter Coaching',
                        description: 'Online coaching with one weekly check-in from Shannon',
                    },
                    unit_amount: 2999,
                    recurring: {
                        interval: 'week',
                    },
                },
                quantity: 1,
            }],
            payment_behavior: 'default_incomplete',
            payment_settings: { save_default_payment_method: 'on_subscription' },
            metadata: {
                checkout_email: checkoutEmail,
                balance_product: "balance_starter_coaching",
                balance_plan: "starter_weekly",
                checkins_per_week: "1",
                price_token: priceId || "",
                ...stripeComplianceMetadata,
            },
            expand: ['latest_invoice.payment_intent'],
        };

        // No trial on the starter offer: the first weekly coaching payment is due today.

        const subscription = await stripe.subscriptions.create(subscriptionData);

        const status = subscription.latest_invoice.payment_intent.status;
        const clientSecret = subscription.latest_invoice.payment_intent.client_secret;

        // 5. Fire to Zapier - REMOVED to prevent false positives. 
        // We now rely on success.html (client-side) or stripe-webhook (server-side) 
        // to ensure we only track *successful* payments.

        // 6. Return Data
        return new Response(JSON.stringify({
            subscriptionId: subscription.id,
            clientSecret: clientSecret,
            status: status,
        }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error("Subscription Error:", error.message);
        return checkoutErrorResponse(error);
    }
};
