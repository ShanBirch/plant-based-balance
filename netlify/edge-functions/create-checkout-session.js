import Stripe from "https://esm.sh/stripe?target=deno";

export default async (request, context) => {
    if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const body = await request.json();
        const { priceId, isTrial, email, bump, fbc, fbp, utm_data } = body;
        
        const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
        if (!STRIPE_SECRET_KEY) throw new Error("Missing Internal Configuration");

        const stripe = new Stripe(STRIPE_SECRET_KEY, {
            httpClient: Stripe.createFetchHttpClient(),
            apiVersion: "2023-10-16",
        });

        const lineItems = [{ price: priceId, quantity: 1 }];
        
        // Handle Bump (One-Time Payment)
        if (bump) {
             const ACUPRESSURE_ID = 'price_1SkOMQCGCyRUsOfKlgfmqUsP'; 
             lineItems.push({ price: ACUPRESSURE_ID, quantity: 1 });
        }

        const subscriptionData = {};
        if (isTrial) {
            subscriptionData.trial_period_days = 7;
        }

        // Apply Discount Coupon (rjrlOEdm)
        // This ensures that when the trial ends (or immediately for non-trial), the price is 50% off.
        const discounts = [{ coupon: 'rjrlOEdm' }];

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            customer_email: email,
            line_items: lineItems,
            subscription_data: subscriptionData,
            discounts: discounts,
            success_url: request.headers.get("origin") + '/success.html?session_id={CHECKOUT_SESSION_ID}',
            cancel_url: request.headers.get("origin") + '/plantbasedswitch.html',
            metadata: {
                fbc: fbc || "",
                fbp: fbp || "",
                ...utm_data,
                is_trial: isTrial ? "true" : "false"
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
