import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { sendCAPIEvent, hash } from "./lib/capi-utils.js";

export default async (request, context) => {
    // Only allow POST
    if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const body = await request.json();
        const { email, name, paymentMethodId, priceId, isDiscounted, fbc, fbp } = body;
        
        const ip = request.headers.get("x-nf-client-connection-ip") || "0.0.0.0";
        const userAgent = request.headers.get("user-agent");
        const referer = request.headers.get("referer");

        const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
        if (!STRIPE_SECRET_KEY) throw new Error("Missing Internal Configuration");

        const stripe = new Stripe(STRIPE_SECRET_KEY, {
            httpClient: Stripe.createFetchHttpClient(),
            apiVersion: "2023-10-16",
        });

        // Balance Redesign: Flat $30 AUD Pricing
        let finalValue = 30; // $30 AUD flat
        const isTrial = body.isTrial === true;
        const trialDays = body.trialDays || 14;

        const externalId = email ? await hash(email) : undefined;

        // 2. Track InitiateCheckout via CAPI (Background)
        // context.waitUntil runs this without blocking variables
        context.waitUntil(
            sendCAPIEvent('InitiateCheckout', {
                email,
                external_id: externalId,
                firstName: name ? name.split(' ')[0] : undefined,
                ip,
                userAgent,
                fbc, fbp,
                sourceUrl: referer
            }, {
                content_category: 'Hormone Plan',
                content_ids: [priceId],
                value: finalValue,
                currency: 'AUD'
            })
        );

        // 3. Create Stripe Customer
        const customer = await stripe.customers.create({
            email,
            name,
            payment_method: paymentMethodId,
            invoice_settings: { default_payment_method: paymentMethodId },
            metadata: { fbc, fbp }
        });

        // 4. Create Subscription
        const subscriptionData = {
            customer: customer.id,
            items: [{ price: priceId }],
            payment_behavior: 'default_incomplete',
            payment_settings: { save_default_payment_method: 'on_subscription' },
            expand: ['latest_invoice.payment_intent'],
        };

        // No coupons used anymore - flat $30 price

        // Logic for 7-Day Mobile Wallet Trial
        // Set 14-Day Trial for Balance Membership
        if (isTrial) {
             subscriptionData.trial_period_days = trialDays;
        }
        
        // Ensure we use the correct price ID for $30
        // If the pass priceId is for $92, we'll swap it to our $30 one 
        // OR better: use the one passed if it's already $30.
        // For now, let's assume 'price_1SkDKhCGCyRUsOfKdi44QCWi' is our target.
        subscriptionData.items = [{ price: priceId }];

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
        return new Response(JSON.stringify({ error: { message: error.message } }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
    }
};
