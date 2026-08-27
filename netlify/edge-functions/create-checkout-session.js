import {
    assertAcceptedCheckoutTerms,
    assertSameSiteCheckoutRequest,
    checkoutErrorResponse,
    cleanCheckoutEmail,
    getBalanceCheckoutPlan,
} from "./lib/checkout-guard.js";

const STRIPE_API_VERSION = "2026-07-29.dahlia";

function buildIntegrationIdentifier() {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const suffix = Array.from(bytes, byte => String.fromCharCode(97 + (byte % 26))).join("");
    return `balance_checkout_${suffix}`;
}

function safeReturnPath(value, fallback) {
    const allowed = new Set(["/plant-based-fitness.html", "/fitness-coaching.html", "/coaching.html", "/dashboard.html"]);
    if (allowed.has(value)) return value;
    if (/^\/(?:founders|fitness)(?:\/[0-9a-z]+)?\/?$/i.test(String(value || ""))) return value;
    return fallback;
}

function appendMetadata(params, prefix, metadata) {
    Object.entries(metadata || {}).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        const normalized = typeof value === "string" ? value : JSON.stringify(value);
        params.set(`${prefix}[${key}]`, normalized.slice(0, 500));
    });
}

async function createStripeCheckoutSession(secretKey, checkout) {
    const params = new URLSearchParams();
    params.set("mode", checkout.plan.mode);
    params.set("integration_identifier", buildIntegrationIdentifier());
    if (checkout.customerEmail) params.set("customer_email", checkout.customerEmail);

    params.set("line_items[0][price_data][currency]", "aud");
    params.set("line_items[0][price_data][product_data][name]", checkout.plan.productName);
    params.set("line_items[0][price_data][product_data][description]", checkout.plan.productDescription);
    params.set("line_items[0][price_data][unit_amount]", String(checkout.plan.unitAmount));
    if (checkout.plan.mode === "subscription") {
        params.set("line_items[0][price_data][recurring][interval]", checkout.plan.interval);
        if (checkout.plan.checkoutDisclosure) {
            params.set("custom_text[submit][message]", checkout.plan.checkoutDisclosure);
        }
    }
    params.set("line_items[0][quantity]", "1");

    if (checkout.bump) {
        params.set("line_items[1][price]", "price_1SkOMQCGCyRUsOfKlgfmqUsP");
        params.set("line_items[1][quantity]", "1");
    }

    params.set("success_url", checkout.successUrl);
    params.set("cancel_url", checkout.cancelUrl);
    if (checkout.plan.mode === "subscription") {
        appendMetadata(params, "subscription_data[metadata]", checkout.subscriptionMetadata);
    } else {
        appendMetadata(params, "payment_intent_data[metadata]", checkout.paymentMetadata);
    }
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
        const { priceId, isTrial, trialDays, referralCode, email, bump, fbc, fbp, utm_data, compliance, returnPath, pageVariant, checkoutSource } = body;
        const checkoutOrigin = assertSameSiteCheckoutRequest(request);
        const plan = getBalanceCheckoutPlan(priceId);
        const cancelPath = safeReturnPath(returnPath, "/plant-based-fitness.html");
        assertAcceptedCheckoutTerms(compliance);
        const checkoutEmail = cleanCheckoutEmail(email, { required: false });
        const isMetaAdTrialCheckout = checkoutSource === "meta_ad_trial"
            && ["facebook_5m_foundations_v3", "facebook_5m_paid_v2"].includes(pageVariant);
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
                balance_product: plan.balanceProduct,
                balance_plan: plan.balancePlan,
                commitment_weeks: String(plan.commitmentWeeks || ""),
                commitment_label: plan.commitmentLabel || "",
                renewal_terms: plan.renewalTerms || "",
                checkins_per_week: plan.checkinsPerWeek,
                calls_per_week: plan.callsPerWeek,
                ...stripeComplianceMetadata,
            },
        };
        const purchaseMetadata = {
            ...subscriptionData.metadata,
            product_type: plan.balanceProduct,
            access_type: "fixed_six_week_foundations",
            access_days: String(plan.accessDays || ""),
        };

        // No trial: the first subscription payment is due today.

        const session = await createStripeCheckoutSession(STRIPE_SECRET_KEY, {
            plan,
            customerEmail: checkoutEmail,
            bump: Boolean(bump && plan.allowBump),
            subscriptionMetadata: subscriptionData.metadata,
            paymentMetadata: purchaseMetadata,
            successUrl: checkoutOrigin + `/success.html?session_id={CHECKOUT_SESSION_ID}&plan=${encodeURIComponent(plan.balancePlan)}&amount=${(plan.unitAmount / 100).toFixed(2)}&bump=${bump && plan.allowBump ? "true" : "false"}${isMetaAdTrialCheckout ? "&source=meta_ad_trial_paid" : ""}`,
            cancelUrl: checkoutOrigin + (isMetaAdTrialCheckout ? "/dashboard.html" : plan.balancePlan === "balance_foundations_six_week" ? `${cancelPath}#join` : "/coaching.html#plan-checkout"),
            metadata: {
                checkout_email: checkoutEmail,
                balance_product: plan.balanceProduct,
                balance_plan: plan.balancePlan,
                commitment_weeks: String(plan.commitmentWeeks || ""),
                commitment_label: plan.commitmentLabel || "",
                renewal_terms: plan.renewalTerms || "",
                checkins_per_week: plan.checkinsPerWeek,
                calls_per_week: plan.callsPerWeek,
                price_token: priceId || "",
                product_type: plan.balanceProduct,
                access_type: plan.mode === "payment" ? "fixed_six_week_foundations" : "recurring_membership",
                access_days: String(plan.accessDays || ""),
                landing_page_variant: pageVariant || "general",
                landing_return_path: cancelPath,
                checkout_source: isMetaAdTrialCheckout ? "meta_ad_trial" : "general",
                fbc: fbc || "",
                fbp: fbp || "",
                ...utm_data,
                is_trial: "false",
                trial_days: "0",
                referral_code: referralCode || "",
                ...stripeComplianceMetadata
            },
        });

        return new Response(JSON.stringify({
            sessionId: session.id,
            url: session.url || null,
            offer: {
                token: plan.token,
                name: plan.productName,
                unitAmount: plan.unitAmount,
                currency: plan.currency || "AUD",
                plan: plan.balancePlan,
                accessDays: plan.accessDays || null,
                renewal: plan.renewal || (plan.mode === "payment" ? "none" : "recurring"),
            },
        }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
         console.error("Session Error:", error.message);
         return checkoutErrorResponse(error);
    }
};
