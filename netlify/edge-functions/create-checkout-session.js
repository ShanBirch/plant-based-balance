import Stripe from "stripe";

export default async (request, context) => {
    if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const body = await request.json();
        const { priceId, isTrial, trialDays, referralCode, email, bump, fbc, fbp, utm_data, compliance } = body;
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

        const STRIPE_SECRET_KEY = globalThis.Netlify?.env?.get?.("STRIPE_SECRET_KEY") || Deno.env.get("STRIPE_SECRET_KEY");
        if (!STRIPE_SECRET_KEY) throw new Error("Missing Internal Configuration");

        const stripe = new Stripe(STRIPE_SECRET_KEY, {
            httpClient: Stripe.createFetchHttpClient(),
            apiVersion: "2026-02-25.clover",
        });

        // Use custom price data to control branding and ensure the current weekly coaching price.
        const lineItems = [{
            price_data: {
                currency: 'aud',
                product_data: {
                    name: 'Balance Starter Coaching',
                    description: 'Online coaching with one weekly check-in from Shannon',
                },
                unit_amount: 2999, // AUD $29.99
                recurring: {
                    interval: 'week',
                },
            },
            quantity: 1,
        }];

        // Handle Bump (One-Time Payment)
        if (bump) {
             const ACUPRESSURE_ID = 'price_1SkOMQCGCyRUsOfKlgfmqUsP';
             lineItems.push({ price: ACUPRESSURE_ID, quantity: 1 });
        }

        const subscriptionData = {
            metadata: {
                checkout_email: email || "",
                balance_product: "balance_starter_coaching",
                balance_plan: "starter_weekly",
                checkins_per_week: "1",
                ...stripeComplianceMetadata,
            },
        };

        // No trial on the starter offer: the first weekly coaching payment is due today.

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            customer_email: email,
            line_items: lineItems,
            subscription_data: subscriptionData,
            success_url: request.headers.get("origin") + `/success.html?session_id={CHECKOUT_SESSION_ID}&bump=${bump ? "true" : "false"}`,
            cancel_url: request.headers.get("origin") + '/plantbasedswitch.html',
            metadata: {
                checkout_email: email || "",
                balance_product: "balance_starter_coaching",
                balance_plan: "starter_weekly",
                checkins_per_week: "1",
                price_token: priceId || "",
                fbc: fbc || "",
                fbp: fbp || "",
                ...utm_data,
                is_trial: "false",
                trial_days: "0",
                referral_code: referralCode || "",
                ...stripeComplianceMetadata
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
