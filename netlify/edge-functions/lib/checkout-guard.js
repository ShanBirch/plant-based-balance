const DEFAULT_SITE_ORIGIN = "https://plantbased-balance.org";
const NETLIFY_HOST_SUFFIX = ".netlify.app";
const ALLOWED_HOSTS = new Set([
    "plantbased-balance.org",
    "www.plantbased-balance.org",
    "localhost",
    "127.0.0.1",
]);

export class CheckoutGuardError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.name = "CheckoutGuardError";
        this.status = status;
    }
}

function parseUrl(value) {
    if (!value) return null;
    try {
        return new URL(value);
    } catch (_) {
        return null;
    }
}

function isAllowedHost(hostname) {
    const host = String(hostname || "").toLowerCase();
    return ALLOWED_HOSTS.has(host) || host.endsWith(NETLIFY_HOST_SUFFIX);
}

function isAllowedOriginUrl(url) {
    if (!url || !isAllowedHost(url.hostname)) return false;
    if (url.protocol === "https:") return true;
    return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
}

export function assertSameSiteCheckoutRequest(request) {
    const fetchSite = String(request.headers.get("sec-fetch-site") || "").toLowerCase();
    if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
        throw new CheckoutGuardError("Checkout is only available from Balance.", 403);
    }

    const originUrl = parseUrl(request.headers.get("origin"));
    if (isAllowedOriginUrl(originUrl)) return originUrl.origin;

    const refererUrl = parseUrl(request.headers.get("referer"));
    if (isAllowedOriginUrl(refererUrl)) return refererUrl.origin;

    throw new CheckoutGuardError("Checkout is only available from Balance.", 403);
}

export function assertAcceptedCheckoutTerms(compliance) {
    const accepted = compliance?.accepted || {};
    const required = ["terms", "privacy", "client_agreement", "refund_policy"];
    const missing = required.filter((key) => accepted[key] !== true);
    if (missing.length) {
        throw new CheckoutGuardError("Please accept the checkout terms before continuing.", 400);
    }
}

export function assertStarterCoachingPlan(priceId) {
    const onlineCoachingPlans = new Set([
        "balance_online_coaching_6_month_weekly",
        "balance_online_coaching_3_month_weekly",
        "balance_online_coaching_month_to_month_weekly",
    ]);
    if (!onlineCoachingPlans.has(priceId)) {
        throw new CheckoutGuardError("Invalid checkout plan.", 400);
    }
}

const BALANCE_FOUNDATIONS_SIX_WEEK_OFFER = Object.freeze({
    token: "balance_vegan_founders_pass",
    productName: "Balance Learn",
    productDescription: "Six-week Balance Learn course with one weekly check-in, plan review, app access, and support from Shannon",
    unitAmount: 14900,
    currency: "AUD",
    interval: null,
    balanceProduct: "balance_vegan_founders_pass",
    balancePlan: "balance_foundations_six_week",
    accessDays: 42,
    checkinsPerWeek: "1",
    callsPerWeek: "0",
    allowBump: false,
    mode: "payment",
    renewal: "none",
});

const BALANCE_CHECKOUT_PLANS = Object.freeze({
    balance_online_coaching_6_month_weekly: Object.freeze({
        token: "balance_online_coaching_6_month_weekly",
        productName: "Balance Online Coaching, 6 Month",
        productDescription: "Weekly online coaching with a 26-week initial minimum",
        unitAmount: 2999,
        interval: "week",
        balanceProduct: "balance_online_coaching",
        balancePlan: "online_coaching_6_month",
        commitmentWeeks: 26,
        commitmentLabel: "6-month initial term",
        renewalTerms: "continues_weekly_until_cancelled",
        cancellationNoticeDays: 30,
        checkoutDisclosure: "AU$29.99 is billed weekly for an initial minimum of 26 weeks (AU$779.74 minimum total). After that, coaching continues weekly at the same rate. Cancellation requires 30 days' notice and billing continues during the notice period.",
        checkinsPerWeek: "1",
        callsPerWeek: "0",
        allowBump: true,
        mode: "subscription",
    }),
    balance_online_coaching_3_month_weekly: Object.freeze({
        token: "balance_online_coaching_3_month_weekly",
        productName: "Balance Online Coaching, 3 Month",
        productDescription: "Weekly online coaching with a 13-week initial minimum",
        unitAmount: 4999,
        interval: "week",
        balanceProduct: "balance_online_coaching",
        balancePlan: "online_coaching_3_month",
        commitmentWeeks: 13,
        commitmentLabel: "3-month initial term",
        renewalTerms: "continues_weekly_until_cancelled",
        cancellationNoticeDays: 30,
        checkoutDisclosure: "AU$49.99 is billed weekly for an initial minimum of 13 weeks (AU$649.87 minimum total). After that, coaching continues weekly at the same rate. Cancellation requires 30 days' notice and billing continues during the notice period.",
        checkinsPerWeek: "1",
        callsPerWeek: "0",
        allowBump: true,
        mode: "subscription",
    }),
    balance_online_coaching_month_to_month_weekly: Object.freeze({
        token: "balance_online_coaching_month_to_month_weekly",
        productName: "Balance Online Coaching, Month-to-Month",
        productDescription: "Weekly online coaching with a four-week initial minimum",
        unitAmount: 7499,
        interval: "week",
        balanceProduct: "balance_online_coaching",
        balancePlan: "online_coaching_month_to_month",
        commitmentWeeks: 4,
        commitmentLabel: "month-to-month, 4-week initial term",
        renewalTerms: "continues_weekly_until_cancelled",
        cancellationNoticeDays: 30,
        checkoutDisclosure: "AU$74.99 is billed weekly for an initial minimum of four weeks (AU$299.96 minimum total). After that, coaching continues weekly at the same rate. Cancellation requires 30 days' notice and billing continues during the notice period.",
        checkinsPerWeek: "1",
        callsPerWeek: "0",
        allowBump: true,
        mode: "subscription",
    }),
    balance_app_community_monthly: Object.freeze({
        token: "balance_app_community_monthly",
        productName: "Balance App + Community",
        productDescription: "Balance app access and community membership",
        unitAmount: 1999,
        interval: "month",
        balanceProduct: "balance_app_community",
        balancePlan: "app_community_monthly",
        cancellationNoticeDays: 30,
        checkoutDisclosure: "AU$19.99 is billed monthly until cancelled. Cancellation requires 30 days' notice and billing continues during the notice period.",
        checkinsPerWeek: "0",
        callsPerWeek: "0",
        allowBump: false,
        mode: "subscription",
    }),
    balance_coaching_calls_weekly: Object.freeze({
        token: "balance_coaching_calls_weekly",
        productName: "Balance Coaching + Calls",
        productDescription: "Balance app access, coaching support, and one weekly call with Shannon",
        unitAmount: 9999,
        interval: "week",
        balanceProduct: "balance_coaching_calls",
        balancePlan: "coaching_calls_weekly",
        cancellationNoticeDays: 30,
        checkoutDisclosure: "AU$99.99 is billed weekly until cancelled. Cancellation requires 30 days' notice and billing continues during the notice period.",
        checkinsPerWeek: "1",
        callsPerWeek: "1",
        allowBump: false,
        mode: "subscription",
    }),
    balance_vegan_founders_pass: BALANCE_FOUNDATIONS_SIX_WEEK_OFFER,
    // Backwards-compatible campaign token. It intentionally resolves to the
    // exact same offer object so Meta onboarding can never carry a second price.
    balance_meta_foundations_pass: BALANCE_FOUNDATIONS_SIX_WEEK_OFFER,
});

export function getBalanceCheckoutPlan(priceId) {
    const plan = BALANCE_CHECKOUT_PLANS[String(priceId || "")];
    if (!plan) throw new CheckoutGuardError("Invalid checkout plan.", 400);
    return plan;
}

export function getPublicCheckoutOffer(priceId) {
    const plan = getBalanceCheckoutPlan(priceId);
    return Object.freeze({
        token: plan.token,
        name: plan.productName,
        description: plan.productDescription,
        unitAmount: plan.unitAmount,
        currency: plan.currency || "AUD",
        plan: plan.balancePlan,
        accessDays: plan.accessDays || null,
        renewal: plan.renewal || (plan.mode === "payment" ? "none" : "recurring"),
    });
}

export function assertRecurringCheckoutPlan(plan) {
    if (plan?.mode !== "subscription" || !plan?.interval) {
        throw new CheckoutGuardError("This plan must use secure hosted checkout.", 400);
    }
}

export function cleanCheckoutEmail(email, { required = false } = {}) {
    const value = String(email || "").trim().toLowerCase();
    if (!value && !required) return "";
    if (!value || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        throw new CheckoutGuardError("Please enter a valid email address.", 400);
    }
    return value;
}

export function assertStripePaymentMethodId(paymentMethodId) {
    if (!/^pm_[A-Za-z0-9_]+$/.test(String(paymentMethodId || ""))) {
        throw new CheckoutGuardError("Payment method missing.", 400);
    }
}

export function checkoutErrorResponse(error) {
    const status = error instanceof CheckoutGuardError ? error.status : 400;
    const message = error instanceof CheckoutGuardError ? error.message : (error?.message || "Checkout failed");
    return new Response(JSON.stringify({ error: { message } }), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

export function checkoutOriginFallback() {
    return DEFAULT_SITE_ORIGIN;
}
