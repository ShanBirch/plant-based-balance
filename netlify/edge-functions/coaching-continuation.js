import { assertSameSiteCheckoutRequest } from "./lib/checkout-guard.js";

const accountId = "b8d2b28a-5efd-42d3-882b-3b3ab3230a03";
const freeUntil = Date.parse("2026-11-22T20:05:00+10:00");
const plan = "private_coaching_continuation_weekly";

export const config = { path: "/api/coaching-continuation" };

function json(body, status = 200) {
    return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function stripe(path, body, key) {
    const headers = {
        Authorization: `Bearer ${Netlify.env.get("STRIPE_SECRET_KEY")}`,
        "Stripe-Version": "2026-02-25.clover",
    };
    if (key) headers["Idempotency-Key"] = key;
    const response = await fetch(`https://api.stripe.com/v1/${path}`, {
        method: body ? "POST" : "GET",
        headers,
        body: body ? new URLSearchParams(body) : undefined,
    });
    if (!response.ok) throw new Error(`Stripe request failed (${response.status})`);
    return response.json();
}

export default async function handler(request) {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    try {
        assertSameSiteCheckoutRequest(request);
        const url = Netlify.env.get("SUPABASE_URL");
        const key = Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY");
        const auth = await fetch(`${url}/auth/v1/user`, {
            headers: { apikey: key, Authorization: request.headers.get("authorization") || "" },
        });
        if (!auth.ok) return json({ error: "Sign in to continue." }, 401);
        const user = await auth.json();
        if (user.id !== accountId) return json({ error: "Offer unavailable." }, 403);
        if (Date.now() < freeUntil) return json({ unlocked: true });

        const { checkout } = await request.json();
        const customers = await stripe(`customers?limit=100&email=${encodeURIComponent(user.email)}`);
        let customer = customers.data.find(({ metadata }) => metadata?.continuation_account === user.id);
        if (!customer && !checkout) return json({ unlocked: false });
        if (!customer) {
            customer = await stripe("customers", {
                email: user.email,
                "metadata[continuation_account]": user.id,
            }, `continuation-customer-${user.id}`);
        }

        const subscriptions = await stripe(`subscriptions?customer=${customer.id}&status=all&limit=100&expand[]=data.latest_invoice`);
        const matching = subscriptions.data.filter(item => item.metadata?.balance_plan === plan);
        if (matching.some(item => item.status === "active" && item.latest_invoice?.status === "paid")) {
            return json({ unlocked: true });
        }
        if (!checkout) return json({ unlocked: false });
        if (matching.some(item => ["active", "past_due", "unpaid", "incomplete"].includes(item.status))) {
            const portal = await stripe("billing_portal/sessions", {
                customer: customer.id,
                return_url: "https://plantbased-balance.org/dashboard.html",
            });
            return json({ url: portal.url });
        }

        const sessions = await stripe(`checkout/sessions?customer=${customer.id}&limit=1`);
        const previous = sessions.data[0];
        if (previous?.status === "open") return json({ url: previous.url });

        const session = await stripe("checkout/sessions", {
            mode: "subscription",
            customer: customer.id,
            "payment_method_types[0]": "card",
            client_reference_id: user.id,
            success_url: "https://plantbased-balance.org/dashboard.html",
            cancel_url: "https://plantbased-balance.org/dashboard.html",
            "line_items[0][quantity]": "1",
            "line_items[0][price_data][currency]": "aud",
            "line_items[0][price_data][unit_amount]": "1499",
            "line_items[0][price_data][recurring][interval]": "week",
            "line_items[0][price_data][product_data][name]": "Balance coaching with Shannon",
            "subscription_data[metadata][balance_plan]": plan,
            "subscription_data[metadata][balance_user_id]": user.id,
            "subscription_data[metadata][checkout_email]": user.email,
            "custom_text[submit][message]": "A$14.99 billed today and every week until cancelled.",
        }, `continuation-checkout-${customer.id}-${previous?.id || "first"}`);
        return json({ url: session.url });
    } catch (error) {
        console.error("Coaching continuation:", error.message);
        return json({ error: "Couldn’t check your membership. Please try again." }, 503);
    }
}