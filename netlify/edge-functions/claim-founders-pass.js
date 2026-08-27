const STRIPE_API_VERSION = "2026-02-25.clover";
const FOUNDERS_PRODUCT = "balance_vegan_founders_pass";
const FOUNDERS_PLAN = "balance_foundations_six_week";
const LEGACY_FOUNDERS_PLAN = "founders_pass_lifetime";
const FOUNDATIONS_ACCESS_DAYS = 42;

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

async function retrieveStripeSession(secretKey, sessionId) {
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
        headers: { Authorization: `Bearer ${secretKey}`, "Stripe-Version": STRIPE_API_VERSION },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error?.message || "Unable to verify Stripe purchase.");
    return payload;
}

function purchaseFromSession(session) {
    const email = cleanEmail(session?.customer_details?.email || session?.customer_email || session?.metadata?.checkout_email);
    if (session?.mode !== "payment"
        || session?.payment_status !== "paid"
        || session?.metadata?.product_type !== FOUNDERS_PRODUCT
        || !email) {
        return null;
    }
    const purchasedAt = new Date(Number(session.created || Math.floor(Date.now() / 1000)) * 1000);
    const sessionPlan = String(session?.metadata?.balance_plan || "");
    const balancePlan = sessionPlan === LEGACY_FOUNDERS_PLAN ? LEGACY_FOUNDERS_PLAN : FOUNDERS_PLAN;
    const accessExpiresAt = balancePlan === FOUNDERS_PLAN
        ? new Date(purchasedAt.getTime() + FOUNDATIONS_ACCESS_DAYS * 24 * 60 * 60 * 1000).toISOString()
        : null;
    return {
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null,
        stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer?.id || null,
        email,
        amount_minor: Number(session.amount_total || 14900),
        currency: String(session.currency || "aud").toLowerCase(),
        status: "paid",
        purchased_at: purchasedAt.toISOString(),
        metadata: {
            balance_plan: balancePlan,
            product_type: FOUNDERS_PRODUCT,
            access_type: balancePlan === LEGACY_FOUNDERS_PLAN ? "lifetime_core_app_community" : "fixed_six_week_foundations",
            access_days: balancePlan === FOUNDERS_PLAN ? FOUNDATIONS_ACCESS_DAYS : null,
            access_expires_at: accessExpiresAt,
        },
    };
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
        const userEmail = cleanEmail(user.email);

        if (sessionId) {
            const session = await retrieveStripeSession(stripeKey, sessionId);
            const verified = purchaseFromSession(session);
            if (!verified || verified.email !== userEmail) {
                return json({ error: "This purchase does not match the signed-in account." }, 403);
            }
            await supabaseRequest(supabaseUrl, serviceKey, "founders_pass_purchases?on_conflict=stripe_checkout_session_id", {
                method: "POST",
                prefer: "resolution=merge-duplicates,return=representation",
                body: verified,
            });
        }

        const purchases = await supabaseRequest(
            supabaseUrl,
            serviceKey,
            `founders_pass_purchases?select=id,stripe_checkout_session_id,status,user_id,purchased_at,metadata&email=eq.${encodeURIComponent(userEmail)}&status=eq.paid&order=purchased_at.desc&limit=1`
        );
        const purchase = Array.isArray(purchases) ? purchases[0] : null;
        if (!purchase) return json({ claimed: false, reason: "no_paid_founders_pass" });

        const now = new Date().toISOString();
        await supabaseRequest(supabaseUrl, serviceKey, `founders_pass_purchases?id=eq.${encodeURIComponent(purchase.id)}`, {
            method: "PATCH",
            body: { user_id: user.id, claimed_at: now },
        });
        const purchasePlan = purchase?.metadata?.balance_plan === FOUNDERS_PLAN ? FOUNDERS_PLAN : LEGACY_FOUNDERS_PLAN;
        const accessExpiresAt = purchasePlan === FOUNDERS_PLAN
            ? purchase?.metadata?.access_expires_at || new Date(new Date(purchase.purchased_at).getTime() + FOUNDATIONS_ACCESS_DAYS * 24 * 60 * 60 * 1000).toISOString()
            : null;
        const expired = Boolean(accessExpiresAt && new Date(accessExpiresAt).getTime() <= Date.now());
        await supabaseRequest(supabaseUrl, serviceKey, `users?id=eq.${encodeURIComponent(user.id)}`, {
            method: "PATCH",
            body: { subscription_status: expired ? "expired" : "active", subscription_plan: purchasePlan },
        });

        return json({ claimed: true, plan: purchasePlan, accessExpiresAt, expired });
    } catch (error) {
        console.error("Founders Pass claim error:", error.message);
        return json({ error: "We could not activate the Founders Pass yet. Please try again shortly." }, 400);
    }
};
