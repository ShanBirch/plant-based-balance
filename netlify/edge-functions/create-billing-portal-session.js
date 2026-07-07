import { createClient } from "@supabase/supabase-js";

function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" }
    });
}

function html(body, status = 200) {
    return new Response(body, {
        status,
        headers: { "Content-Type": "text/html; charset=utf-8" }
    });
}

function getEnv(name) {
    return globalThis.Netlify?.env?.get?.(name) || Deno.env.get(name);
}

function getSameOriginReturnUrl(request, rawReturnUrl) {
    const requestUrl = new URL(request.url);
    const fallback = new URL("/dashboard.html?tab=profile", requestUrl.origin);
    if (!rawReturnUrl) return fallback.toString();

    const returnUrl = new URL(String(rawReturnUrl), requestUrl.origin);
    if (returnUrl.origin !== requestUrl.origin) return fallback.toString();
    return returnUrl.toString();
}

function paymentLinkMessage(title, copy) {
    return '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">'
        + '<title>' + title + '</title>'
        + '<style>body{margin:0;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0f172a;color:#fff;display:grid;min-height:100vh;place-items:center;padding:24px;box-sizing:border-box;}main{max-width:420px;text-align:center;}h1{font-size:1.45rem;margin:0 0 10px;}p{color:rgba(255,255,255,.76);line-height:1.45;margin:0;}</style>'
        + '</head><body><main><h1>' + title + '</h1><p>' + copy + '</p></main></body></html>';
}

async function stripeRequest(stripeSecretKey, method, path, params = null) {
    const url = new URL(path, "https://api.stripe.com");
    const options = {
        method,
        headers: {
            Authorization: "Bearer " + stripeSecretKey
        }
    };

    if (method === "GET" && params) {
        for (const [key, value] of params.entries()) {
            url.searchParams.set(key, value);
        }
    } else if (params) {
        options.headers["Content-Type"] = "application/x-www-form-urlencoded";
        options.body = params;
    }

    const response = await fetch(url.toString(), options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data?.error?.message || data?.error || "Stripe request failed");
    }
    return data;
}

async function getPaymentUpdateConfigurationId(stripeSecretKey, returnUrl) {
    const marker = "balance_payment_update_link_v1";
    const listParams = new URLSearchParams();
    listParams.set("active", "true");
    listParams.set("limit", "100");
    const configs = await stripeRequest(stripeSecretKey, "GET", "/v1/billing_portal/configurations", listParams);
    const existing = configs.data.find((config) => config?.metadata?.balance_portal_kind === marker);
    if (existing?.id) return existing.id;

    const createParams = new URLSearchParams();
    createParams.set("name", "Balance card update");
    createParams.set("default_return_url", returnUrl);
    createParams.set("features[payment_method_update][enabled]", "true");
    createParams.set("features[invoice_history][enabled]", "true");
    createParams.set("business_profile[headline]", "Update your Balance payment method");
    createParams.set("metadata[balance_portal_kind]", marker);
    const created = await stripeRequest(stripeSecretKey, "POST", "/v1/billing_portal/configurations", createParams);
    return created.id;
}

async function createPaymentMethodPortalSession(stripeSecretKey, customerId, returnUrl) {
    let configuration = null;
    try {
        configuration = await getPaymentUpdateConfigurationId(stripeSecretKey, returnUrl);
    } catch (error) {
        console.warn("[billing-portal] could not prepare card update configuration:", error?.message || error);
    }

    try {
        const sessionParams = new URLSearchParams();
        sessionParams.set("customer", customerId);
        sessionParams.set("return_url", returnUrl);
        if (configuration) sessionParams.set("configuration", configuration);
        sessionParams.set("flow_data[type]", "payment_method_update");
        sessionParams.set("flow_data[after_completion][type]", "hosted_confirmation");
        sessionParams.set("flow_data[after_completion][hosted_confirmation][custom_message]", "Your payment method has been updated.");
        return await stripeRequest(stripeSecretKey, "POST", "/v1/billing_portal/sessions", sessionParams);
    } catch (error) {
        console.warn("[billing-portal] payment method deep link failed, falling back:", error?.message || error);
        const sessionParams = new URLSearchParams();
        sessionParams.set("customer", customerId);
        sessionParams.set("return_url", returnUrl);
        if (configuration) sessionParams.set("configuration", configuration);
        return await stripeRequest(stripeSecretKey, "POST", "/v1/billing_portal/sessions", sessionParams);
    }
}

async function handleTokenPaymentLink(request, supabase, stripeSecretKey) {
    const requestUrl = new URL(request.url);
    const token = String(requestUrl.searchParams.get("t") || "").trim();
    if (!/^[A-Za-z0-9_-]{32,160}$/.test(token)) {
        return html(paymentLinkMessage("Payment link expired", "Message Shannon and he can send you a fresh card update link."), 404);
    }

    const { data: alert, error: alertError } = await supabase
        .from("coach_alerts")
        .select("id,client_id,data")
        .eq("data->>payment_update_token", token)
        .limit(1)
        .maybeSingle();

    if (alertError) {
        console.error("[billing-portal] token lookup failed:", alertError.message);
        return html(paymentLinkMessage("Payment link unavailable", "Message Shannon and he can send you a fresh card update link."), 500);
    }

    const expiresAt = alert?.data?.payment_update_expires_at;
    if (!alert?.client_id || !expiresAt || new Date(expiresAt).getTime() < Date.now()) {
        return html(paymentLinkMessage("Payment link expired", "Message Shannon and he can send you a fresh card update link."), 404);
    }

    const { data: user, error: userError } = await supabase
        .from("users")
        .select("id,stripe_customer_id")
        .eq("id", alert.client_id)
        .single();

    if (userError || !user?.stripe_customer_id) {
        console.error("[billing-portal] token user lookup failed:", userError?.message || "missing customer");
        return html(paymentLinkMessage("Payment link unavailable", "Message Shannon and he can send you a fresh card update link."), 500);
    }

    const returnUrl = getSameOriginReturnUrl(request, requestUrl.searchParams.get("return_url"));
    const portalSession = await createPaymentMethodPortalSession(stripeSecretKey, user.stripe_customer_id, returnUrl);

    const updatedData = {
        ...(alert.data || {}),
        payment_update_last_opened_at: new Date().toISOString(),
        payment_update_last_session_id: portalSession.id
    };
    supabase
        .from("coach_alerts")
        .update({ data: updatedData })
        .eq("id", alert.id)
        .then(({ error }) => {
            if (error) console.warn("[billing-portal] token readback update failed:", error.message);
        });

    return Response.redirect(portalSession.url, 303);
}

export default async (request) => {
    if (request.method !== "POST" && request.method !== "GET") {
        return json({ error: "Method Not Allowed" }, 405);
    }

    try {
        const supabaseUrl = getEnv("SUPABASE_URL");
        const supabaseKey = getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("SUPABASE_SERVICE_KEY");
        const stripeSecretKey = getEnv("STRIPE_SECRET_KEY");

        if (!supabaseUrl || !supabaseKey || !stripeSecretKey) {
            console.error("[billing-portal] missing server configuration");
            return json({ error: "Server configuration error" }, 500);
        }

        const supabase = createClient(supabaseUrl, supabaseKey);
        if (request.method === "GET") {
            return await handleTokenPaymentLink(request, supabase, stripeSecretKey);
        }

        const authHeader = request.headers.get("Authorization") || "";
        const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
        if (!accessToken) {
            return json({ error: "Missing authorization" }, 401);
        }

        const body = await request.json().catch(() => ({}));
        const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
        const userId = authData?.user?.id;

        if (authError || !userId) {
            return json({ error: "Invalid authorization" }, 401);
        }

        const { data: user, error: userError } = await supabase
            .from("users")
            .select("id,stripe_customer_id")
            .eq("id", userId)
            .single();

        if (userError) {
            console.error("[billing-portal] user lookup failed:", userError.message);
            return json({ error: "Could not load payment profile" }, 500);
        }

        if (!user?.stripe_customer_id) {
            return json({ error: "No active payment profile found" }, 404);
        }

        const portalSession = await createPaymentMethodPortalSession(
            stripeSecretKey,
            user.stripe_customer_id,
            getSameOriginReturnUrl(request, body.returnUrl)
        );

        return json({ url: portalSession.url });
    } catch (error) {
        console.error("[billing-portal] failed:", error?.message || error);
        try {
            const requestUrl = new URL(request.url);
            if (request.method === "GET"
                && requestUrl.searchParams.get("debug") === "1"
                && /^[A-Za-z0-9_-]{32,160}$/.test(String(requestUrl.searchParams.get("t") || ""))) {
                return json({
                    error: "Could not open payment settings yet",
                    detail: String(error?.message || error).slice(0, 500)
                }, 500);
            }
        } catch(e) {}
        return json({ error: "Could not open payment settings yet" }, 500);
    }
};
