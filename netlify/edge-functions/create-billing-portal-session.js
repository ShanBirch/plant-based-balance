import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" }
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

export default async (request) => {
    if (request.method !== "POST") {
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

        const authHeader = request.headers.get("Authorization") || "";
        const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
        if (!accessToken) {
            return json({ error: "Missing authorization" }, 401);
        }

        const body = await request.json().catch(() => ({}));
        const supabase = createClient(supabaseUrl, supabaseKey);
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

        const stripe = new Stripe(stripeSecretKey, {
            httpClient: Stripe.createFetchHttpClient(),
            apiVersion: "2026-02-25.clover",
        });

        const portalSession = await stripe.billingPortal.sessions.create({
            customer: user.stripe_customer_id,
            return_url: getSameOriginReturnUrl(request, body.returnUrl),
        });

        return json({ url: portalSession.url });
    } catch (error) {
        console.error("[billing-portal] failed:", error?.message || error);
        return json({ error: "Could not open payment settings yet" }, 500);
    }
};
