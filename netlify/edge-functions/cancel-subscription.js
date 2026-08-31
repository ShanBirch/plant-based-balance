import { createClient } from "@supabase/supabase-js";

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due", "unpaid"]);
const NOTICE_DAYS = 30;
const DAY_SECONDS = 24 * 60 * 60;

function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
}

function getEnv(name) {
    return globalThis.Netlify?.env?.get?.(name) || Deno.env.get(name);
}

async function stripeRequest(secretKey, method, path, params = null) {
    const url = new URL(path, "https://api.stripe.com");
    const options = { method, headers: { Authorization: `Bearer ${secretKey}` } };
    if (method === "GET" && params) {
        for (const [key, value] of params.entries()) url.searchParams.set(key, value);
    } else if (params) {
        options.headers["Content-Type"] = "application/x-www-form-urlencoded";
        options.body = params;
    }
    const response = await fetch(url.toString(), options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || "Stripe request failed");
    return data;
}

function cleanInteger(value) {
    const parsed = Number.parseInt(String(value || ""), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function cancellationTiming(subscription, nowSeconds) {
    const metadata = subscription.metadata || {};
    const commitmentWeeks = cleanInteger(metadata.commitment_weeks);
    const commitmentEnd = commitmentWeeks
        ? cleanInteger(subscription.created) + (commitmentWeeks * 7 * DAY_SECONDS)
        : 0;
    const hasNoticePolicy = cleanInteger(metadata.cancellation_notice_days) === NOTICE_DAYS;
    const policyEnd = hasNoticePolicy
        ? nowSeconds + (NOTICE_DAYS * DAY_SECONDS)
        : cleanInteger(subscription.current_period_end) || nowSeconds;
    return {
        noticeDays: hasNoticePolicy ? NOTICE_DAYS : 0,
        commitmentWeeks,
        effectiveAt: Math.max(policyEnd, commitmentEnd, nowSeconds + 60),
    };
}

function subscriptionSummary(subscription, nowSeconds = Math.floor(Date.now() / 1000)) {
    const timing = cancellationTiming(subscription, nowSeconds);
    const scheduledAt = cleanInteger(subscription.cancel_at)
        || (subscription.cancel_at_period_end ? cleanInteger(subscription.current_period_end) : 0);
    return {
        id: subscription.id,
        status: subscription.status,
        plan: subscription.metadata?.balance_plan || subscription.metadata?.balance_product || "Balance subscription",
        noticeDays: timing.noticeDays,
        commitmentWeeks: timing.commitmentWeeks,
        currentPeriodEnd: cleanInteger(subscription.current_period_end) || null,
        cancellationScheduledAt: scheduledAt || null,
        estimatedCancellationAt: scheduledAt || timing.effectiveAt,
    };
}

async function listSubscriptions(secretKey, customerId) {
    const params = new URLSearchParams({ customer: customerId, status: "all", limit: "100" });
    const result = await stripeRequest(secretKey, "GET", "/v1/subscriptions", params);
    return (result.data || []).filter(subscription => ACTIVE_STATUSES.has(subscription.status));
}

export default async (request) => {
    if (request.method !== "GET" && request.method !== "POST") {
        return json({ error: "Method Not Allowed" }, 405);
    }

    try {
        const supabaseUrl = getEnv("SUPABASE_URL");
        const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("SUPABASE_SERVICE_KEY");
        const stripeKey = getEnv("STRIPE_SECRET_KEY");
        if (!supabaseUrl || !serviceKey || !stripeKey) return json({ error: "Server configuration error" }, 500);

        const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
        if (!token) return json({ error: "Please log in to continue" }, 401);

        const supabase = createClient(supabaseUrl, serviceKey);
        const { data: authData, error: authError } = await supabase.auth.getUser(token);
        if (authError || !authData?.user?.id) return json({ error: "Please log in again" }, 401);

        const { data: user, error: userError } = await supabase
            .from("users")
            .select("id,stripe_customer_id")
            .eq("id", authData.user.id)
            .single();
        if (userError) return json({ error: "Could not load your subscription" }, 500);
        if (!user?.stripe_customer_id) {
            return json({ subscriptions: [], storeManaged: true, message: "No direct Balance subscription was found. If you paid through Apple or Google, cancel through that store." });
        }

        const subscriptions = await listSubscriptions(stripeKey, user.stripe_customer_id);
        if (request.method === "GET") {
            return json({ subscriptions: subscriptions.map(item => subscriptionSummary(item)) });
        }

        const body = await request.json().catch(() => ({}));
        if (String(body.confirmation || "").trim().toUpperCase() !== "CANCEL") {
            return json({ error: "Type CANCEL to confirm" }, 400);
        }

        const requestedAt = new Date().toISOString();
        const nowSeconds = Math.floor(Date.now() / 1000);
        const updated = [];
        for (const subscription of subscriptions) {
            const existing = subscriptionSummary(subscription, nowSeconds);
            if (existing.cancellationScheduledAt) {
                updated.push(existing);
                continue;
            }

            const timing = cancellationTiming(subscription, nowSeconds);
            const params = new URLSearchParams();
            params.set("cancel_at", String(timing.effectiveAt));
            params.set("proration_behavior", "create_prorations");
            params.set("metadata[cancellation_requested_at]", requestedAt);
            params.set("metadata[cancellation_request_source]", "balance_self_service");
            params.set("metadata[cancellation_effective_at]", new Date(timing.effectiveAt * 1000).toISOString());
            const result = await stripeRequest(stripeKey, "POST", `/v1/subscriptions/${encodeURIComponent(subscription.id)}`, params);
            updated.push(subscriptionSummary(result, nowSeconds));
        }

        return json({
            success: true,
            requestedAt,
            subscriptions: updated,
            message: updated.length
                ? "Your cancellation has been scheduled."
                : "No active direct Balance subscription was found.",
        });
    } catch (error) {
        console.error("[cancel-subscription] failed:", error?.message || error);
        return json({ error: "We could not schedule the cancellation yet. Please contact support." }, 500);
    }
};

export const _test = { cancellationTiming, subscriptionSummary };
