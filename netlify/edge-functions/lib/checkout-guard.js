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
    if (priceId !== "balance_starter_coaching_weekly") {
        throw new CheckoutGuardError("Invalid checkout plan.", 400);
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
