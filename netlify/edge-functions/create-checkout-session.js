import Stripe from "stripe";

export default async (request, context) => {
    if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const body = await request.json();
        const { priceId, isTrial, trialDays, referralCode, email, bump, fbc, fbp, utm_data } = body;

        const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
        if (!STRIPE_SECRET_KEY) throw new Error("Missing Internal Configuration");

        const stripe = new Stripe(STRIPE_SECRET_KEY, {
            httpClient: Stripe.createFetchHttpClient(),
            apiVersion: "2023-10-16",
        });

        // Use custom price data to control branding and ensure exact $30 price
        // This avoids "coupon expires" messages and overrides the legacy "28 day" name
        const lineItems = [{
            price_data: {
                currency: 'aud',
                product_data: {
                    name: 'Balance Membership',
                    description: '14-Day Free Trial Included',
                },
                unit_amount: 3000, // Exact $30.00 AUD
                recurring: {
                    interval: 'month',
                },
            },
            quantity: 1,
        }];

        // Handle Bump (One-Time Payment)
        if (bump) {
             const ACUPRESSURE_ID = 'price_1SkOMQCGCyRUsOfKlgfmqUsP';
             lineItems.push({ price: ACUPRESSURE_ID, quantity: 1 });
        }

        const subscriptionData = {};
        if (isTrial) {
            // Default to 14 days as requested
            subscriptionData.trial_period_days = trialDays || 14;
        }

        // NOTE: Coupon removed. We set unit_amount to 3000 directly 
        // to avoid "Until coupon expires" messaging in Stripe Checkout.

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            customer_email: email,
            line_items: lineItems,
            subscription_data: subscriptionData,
            success_url: request.headers.get("origin") + '/success.html?session_id={CHECKOUT_SESSION_ID}',
            cancel_url: request.headers.get("origin") + '/plantbasedswitch.html',
            metadata: {
                fbc: fbc || "",
                fbp: fbp || "",
                ...utm_data,
                is_trial: isTrial ? "true" : "false",
                trial_days: trialDays ? trialDays.toString() : "0",
                referral_code: referralCode || ""
            }
        });

        return new Response(JSON.stringify({ sessionId: session.id }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
         console.error("Session Error:", error.message);
         return new Response(JSON.stringify({ error: { message: error.message } }), { status: 400 });
    }
};
