import {
    assertAcceptedCheckoutTerms,
    assertSameSiteCheckoutRequest,
    assertStarterCoachingPlan,
    checkoutErrorResponse,
    cleanCheckoutEmail,
} from "./lib/checkout-guard.js";

const STRIPE_API_VERSION = "2026-02-25.clover";

function appendMetadata(params, prefix, metadata) {
    Object.entries(metadata || {}).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        const normalized = typeof value === "string" ? value : JSON.stringify(value);
        params.set(`${prefix}[${key}]`, normalized.slice(0, 500));
    });
}

async function createStripeCheckoutSession(secretKey, checkout) {
    const params = new URLSearchParams();
    params.set("mode", "subscription");
    if (checkout.customerEmail) params.set("customer_email", checkout.customerEmail);

    params.set("line_items[0][price_data][currency]", "aud");
    params.set("line_items[0][price_data][product_data][name]", "Balance Starter Coaching");
    params.set("line_items[0][price_data][product_data][description]", "Online coaching with one weekly check-in from Shannon");
    params.set("line_items[0][price_data][unit_amount]", "2999");
    params.set("line_items[0][price_data][recurring][interval]", "week");
    params.set("line_items[0][quantity]", "1");

    if (checkout.bump) {
        params.set("line_items[1][price]", "price_1SkOMQCGCyRUsOfKlgfmqUsP");
        params.set("line_items[1][quantity]", "1");
    }

    params.set("success_url", checkout.successUrl);
    params.set("cancel_url", checkout.cancelUrl);
    appendMetadata(params, "subscription_data[metadata]", checkout.subscriptionMetadata);
    appendMetadata(params, "metadata", checkout.metadata);

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${secretKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "Stripe-Version": STRIPE_API_VERSION,
        },
        body: params,
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.id) {
        throw new Error(payload?.error?.message || "Stripe checkout is temporarily unavailable.");
    }
    return payload;
}

export default async (request, context) => {
    if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const body = await request.json();
        const { priceId, isTrial, trialDays, referralCode, email, bump, fbc, fbp, utm_data, compliance } = body;
        const checkoutOrigin = assertSameSiteCheckoutRequest(request);
        assertStarterCoachingPlan(priceId);
        assertAcceptedCheckoutTerms(compliance);
        const checkoutEmail = cleanCheckoutEmail(email, { required: false });
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

        const subscriptionData = {
            metadata: {
                checkout_email: checkoutEmail,
                balance_product: "balance_starter_coaching",
                balance_plan: "starter_weekly",
                checkins_per_week: "1",
                ...stripeComplianceMetadata,
            },
        };

        // No trial on the starter offer: the first weekly coaching payment is due today.

        const session = await createStripeCheckoutSession(STRIPE_SECRET_KEY, {
            customerEmail: checkoutEmail,
            bump: Boolean(bump),
            subscriptionMetadata: subscriptionData.metadata,
            successUrl: checkoutOrigin + `/success.html?session_id={CHECKOUT_SESSION_ID}&bump=${bump ? "true" : "false"}`,
            cancelUrl: checkoutOrigin + "/plantbasedswitch.html",
            metadata: {
                checkout_email: checkoutEmail,
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
            },
        });

        return new Response(JSON.stringify({ sessionId: session.id }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
         console.error("Session Error:", error.message);
         return checkoutErrorResponse(error);
    }
};
