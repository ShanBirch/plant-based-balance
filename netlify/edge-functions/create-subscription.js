import Stripe from "https://esm.sh/stripe?target=deno";
import { sendCAPIEvent, hash } from "./capi-utils.js";

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

        // 1. Calculate Value for CAPI
        const priceMap = {
            'price_1SkDKhCGCyRUsOfKdi44QCWi': 92,
            'price_1SkDKiCGCyRUsOfKcb3Wm9O3': 186,
            'price_1SkDKjCGCyRUsOfKQDGEmmkv': 216
        };
        let finalValue = priceMap[priceId] || 46;
        if (isDiscounted !== false) finalValue = finalValue / 2;

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

        if (isDiscounted !== false) {
            subscriptionData.coupon = 'rjrlOEdm'; 
        }

        const subscription = await stripe.subscriptions.create(subscriptionData);

        const status = subscription.latest_invoice.payment_intent.status;
        const clientSecret = subscription.latest_invoice.payment_intent.client_secret;

        // 5. Fire to Zapier (Background)
        const ZAPIER_URL = 'https://hooks.zapier.com/hooks/catch/17459466/uw28ea0/';
        const zapPayload = {
            email,
            full_name: name,
            first_name: name.split(' ')[0],
            last_name: name.split(' ').slice(1).join(' ') || 'Client',
            price_id: priceId,
            status: 'purchased_via_wallet',
            timestamp: new Date().toISOString()
        };

        context.waitUntil(
            fetch(ZAPIER_URL, {
                method: 'POST',
                body: JSON.stringify(zapPayload)
            }).catch(e => console.error("Zapier Background Sync Error:", e))
        );

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
