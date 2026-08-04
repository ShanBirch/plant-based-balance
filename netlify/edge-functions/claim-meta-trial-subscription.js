const STRIPE_API_VERSION = "2026-02-25.clover";
const META_TRIAL_PRODUCT = "balance_app_community";
const META_TRIAL_PLAN = "app_community_monthly";
const ACTIVE_STATUSES = new Set(["active", "trialing"]);

function json(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

function cleanSessionId(value) {
    const sessionId = String(value || "").trim();
    return /^cs_(?:test|live)_[A-Za-z0-9_]+$/.test(sessionId) ? sessionId : "";
}

function cleanEmail(value) {
    return String(value || "").trim().toLowerCase();
}

function stripeId(value) {
    return typeof value === "string" ? value : value?.id || null;
}

async function supabaseRequest(url, key, path, options = {}) {
    const response = await fetch(`${url}/rest/v1/${path}`, {
        method: options.method || "GET",
        headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            Prefer: options.prefer || "return=representation",
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Supabase request failed (${response.status}): ${text.slice(0, 240)}`);
    return text ? JSON.parse(text) : null;
}

async function authenticatedUser(supabaseUrl, serviceKey, request) {
    const authorization = request.headers.get("authorization") || "";
    if (!/^Bearer\s+\S+$/i.test(authorization)) return null;
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { apikey: serviceKey, Authorization: authorization },
    });
    if (!response.ok) return null;
    return response.json();
}

async function stripeGet(secretKey, path) {
    const response = await fetch(`https://api.stripe.com/v1/${path}`, {
        headers: { Authorization: `Bearer ${secretKey}`, "Stripe-Version": STRIPE_API_VERSION },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error?.message || "Unable to verify Stripe payment.");
    return payload;
}

export default async (request) => {
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    try {
        const supabaseUrl = Netlify.env.get("SUPABASE_URL");
        const serviceKey = Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY");
        const stripeKey = Netlify.env.get("STRIPE_SECRET_KEY");
        if (!supabaseUrl || !serviceKey || !stripeKey) throw new Error("Missing Internal Configuration");

        const user = await authenticatedUser(supabaseUrl, serviceKey, request);
        if (!user?.id || !user?.email) return json({ error: "Authentication required." }, 401);

        const body = await request.json().catch(() => ({}));
        const sessionId = cleanSessionId(body.sessionId);
        if (!sessionId) return json({ error: "Stripe session required." }, 400);

        const session = await stripeGet(stripeKey, `checkout/sessions/${encodeURIComponent(sessionId)}`);
        const checkoutEmail = cleanEmail(session?.customer_details?.email || session?.customer_email || session?.metadata?.checkout_email);
        const userEmail = cleanEmail(user.email);
        const subscriptionId = stripeId(session?.subscription);
        const customerId = stripeId(session?.customer);
        const isExpectedCheckout = session?.mode === "subscription"
            && session?.status === "complete"
            && session?.payment_status === "paid"
            && session?.metadata?.balance_product === META_TRIAL_PRODUCT
            && session?.metadata?.balance_plan === META_TRIAL_PLAN
            && session?.metadata?.checkout_source === "meta_ad_trial";
        if (!isExpectedCheckout || !checkoutEmail || checkoutEmail !== userEmail || !subscriptionId || !customerId) {
            return json({ error: "This payment does not match the signed-in Balance account." }, 403);
        }

        const subscription = await stripeGet(stripeKey, `subscriptions/${encodeURIComponent(subscriptionId)}`);
        const status = String(subscription?.status || "").toLowerCase();
        if (!ACTIVE_STATUSES.has(status)) {
            return json({ error: "The Balance subscription is not active." }, 409);
        }

        const updatedUsers = await supabaseRequest(supabaseUrl, serviceKey, `users?id=eq.${encodeURIComponent(user.id)}`, {
            method: "PATCH",
            body: {
                stripe_customer_id: customerId,
                subscription_status: status,
                subscription_plan: META_TRIAL_PLAN,
            },
        });
        if (!Array.isArray(updatedUsers) || !updatedUsers[0]?.id) {
            return json({ error: "Your Balance account is still being prepared. Please try again." }, 409);
        }
        await supabaseRequest(
            supabaseUrl,
            serviceKey,
            `stripe_subscription_links?stripe_subscription_id=eq.${encodeURIComponent(subscriptionId)}`,
            { method: "PATCH", prefer: "return=minimal", body: { user_id: user.id } }
        );

        return json({ claimed: true, plan: META_TRIAL_PLAN, status });
    } catch (error) {
        console.error("Meta trial subscription claim error:", error.message);
        return json({ error: "We could not connect the payment yet. Please try again shortly." }, 400);
    }
};
