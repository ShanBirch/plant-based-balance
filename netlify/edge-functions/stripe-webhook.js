import Stripe from "stripe";
import { sendCAPIEvent } from "./lib/capi-utils.js";

const STRIPE_API_VERSION = "2026-02-25.clover";
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

function cleanEmail(email) {
    return String(email || "").trim();
}

function normalizeStripeId(value) {
    if (!value) return "";
    if (typeof value === "string") return value;
    return value.id || "";
}

function isoFromStripeTimestamp(value) {
    return Number.isFinite(value) ? new Date(value * 1000).toISOString() : null;
}

function firstSubscriptionPriceId(subscription) {
    return subscription?.items?.data?.[0]?.price?.id
        || subscription?.items?.data?.[0]?.plan?.id
        || "";
}

function inferSubscriptionPlan(metadata = {}, priceId = "") {
    return metadata.balance_plan
        || metadata.subscription_plan
        || metadata.product_type
        || (priceId ? `stripe_price:${priceId}` : "stripe_subscription");
}

function supabaseConfig() {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_KEY");
    if (!url || !key) return null;
    return { url, key };
}

async function supabaseRequest(path, { method = "GET", body, prefer = "return=representation" } = {}) {
    const config = supabaseConfig();
    if (!config) throw new Error("Supabase env vars not configured");

    const response = await fetch(`${config.url}/rest/v1/${path}`, {
        method,
        headers: {
            "apikey": config.key,
            "Authorization": `Bearer ${config.key}`,
            "Content-Type": "application/json",
            "Prefer": prefer,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    if (!response.ok) {
        throw new Error(`${method} ${path} -> ${response.status}: ${text.slice(0, 300)}`);
    }

    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch (_) {
        return text;
    }
}

async function retrieveCustomer(stripe, customerId) {
    if (!customerId) return null;
    try {
        const customer = await stripe.customers.retrieve(customerId);
        return customer?.deleted ? null : customer;
    } catch (error) {
        console.error("[stripe-sync] customer retrieve failed:", error.message);
        return null;
    }
}

function subscriptionIdFromInvoice(invoice) {
    return normalizeStripeId(invoice?.subscription)
        || normalizeStripeId(invoice?.parent?.subscription_details?.subscription)
        || normalizeStripeId(invoice?.lines?.data?.[0]?.subscription)
        || normalizeStripeId(invoice?.lines?.data?.[0]?.parent?.subscription_item_details?.subscription);
}

async function retrieveSubscriptionForInvoice(stripe, invoice) {
    const subscriptionId = subscriptionIdFromInvoice(invoice);
    if (!subscriptionId) return null;
    return stripe.subscriptions.retrieve(subscriptionId);
}

async function retrieveSubscriptionForSession(stripe, session) {
    const subscriptionId = normalizeStripeId(session?.subscription);
    if (!subscriptionId) return null;
    return stripe.subscriptions.retrieve(subscriptionId);
}

async function patchUsersForSubscription(payload) {
    const update = {
        stripe_customer_id: payload.stripe_customer_id,
        subscription_status: payload.subscription_status,
        subscription_plan: payload.subscription_plan,
    };
    const rowsById = new Map();

    async function patch(path) {
        const rows = await supabaseRequest(path, { method: "PATCH", body: update });
        if (Array.isArray(rows)) {
            rows.forEach(row => {
                if (row?.id) rowsById.set(row.id, row);
            });
        }
    }

    if (payload.user_id) {
        await patch(`users?id=eq.${encodeURIComponent(payload.user_id)}`);
    }

    if (payload.stripe_customer_id) {
        await patch(`users?stripe_customer_id=eq.${encodeURIComponent(payload.stripe_customer_id)}`);
    }

    if (payload.email) {
        await patch(`users?email=ilike.${encodeURIComponent(payload.email)}`);
    }

    return [...rowsById.values()];
}

async function mirrorStripeSubscription(payload) {
    const rows = await supabaseRequest(
        "stripe_subscription_links?on_conflict=stripe_subscription_id",
        {
            method: "POST",
            prefer: "resolution=merge-duplicates,return=representation",
            body: payload,
        }
    );
    return Array.isArray(rows) ? rows[0] : null;
}

async function syncLinkedLeadStages(userIds, status) {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (!ids.length) return;

    const inList = ids.map(id => encodeURIComponent(id)).join(",");
    const isActive = ACTIVE_SUBSCRIPTION_STATUSES.has(status);
    const path = isActive
        ? `ig_threads?linked_user_id=in.(${inList})`
        : `ig_threads?linked_user_id=in.(${inList})&lead_stage=eq.paying`;
    await supabaseRequest(path, {
        method: "PATCH",
        prefer: "return=minimal",
        body: { lead_stage: isActive ? "paying" : "in_app" },
    });
}

async function syncStripeSubscriptionToBalance(stripe, stripeEvent, { subscription, invoice, session } = {}) {
    if (!subscription) return;

    const customerId = normalizeStripeId(subscription.customer || invoice?.customer || session?.customer);
    const customer = await retrieveCustomer(stripe, customerId);
    const metadata = {
        ...(customer?.metadata || {}),
        ...(subscription.metadata || {}),
        ...(invoice?.metadata || {}),
        ...(session?.metadata || {}),
    };
    const email = cleanEmail(
        metadata.email
        || metadata.checkout_email
        || session?.customer_details?.email
        || session?.customer_email
        || invoice?.customer_email
        || customer?.email
    );
    const priceId = firstSubscriptionPriceId(subscription);
    const status = subscription.status || "unknown";
    const userId = metadata.user_id || metadata.balance_user_id || null;

    const payload = {
        user_id: userId,
        email: email || null,
        email_key: email ? email.toLowerCase() : null,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId || null,
        subscription_status: status,
        subscription_plan: inferSubscriptionPlan(metadata, priceId),
        current_period_end: isoFromStripeTimestamp(subscription.current_period_end),
        cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
        latest_invoice_id: normalizeStripeId(invoice?.id || subscription.latest_invoice),
        latest_payment_intent_id: normalizeStripeId(invoice?.payment_intent || session?.payment_intent),
        last_event_id: stripeEvent.id,
        last_event_type: stripeEvent.type,
        raw_summary: {
            customer_email: email || null,
            billing_reason: invoice?.billing_reason || null,
            collection_method: subscription.collection_method || invoice?.collection_method || null,
            invoice_status: invoice?.status || null,
        },
    };

    if (!payload.stripe_customer_id || !payload.stripe_subscription_id) return;

    const mirrorRow = await mirrorStripeSubscription(payload);
    const patchedUsers = await patchUsersForSubscription(payload);
    const userIds = patchedUsers.map(row => row.id);

    if (mirrorRow && userIds[0] && mirrorRow.user_id !== userIds[0]) {
        await supabaseRequest(
            `stripe_subscription_links?stripe_subscription_id=eq.${encodeURIComponent(payload.stripe_subscription_id)}`,
            {
                method: "PATCH",
                prefer: "return=minimal",
                body: { user_id: userIds[0] },
            }
        );
    }

    await syncLinkedLeadStages(userIds, status);
    console.log(`[stripe-sync] ${stripeEvent.type} subscription ${subscription.id} -> ${patchedUsers.length} user row(s)`);
}

export default async (request, context) => {
    // Only allow POST
    if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
        console.error("Missing Stripe Env Vars");
        return new Response("Server Config Error", { status: 500 });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
        httpClient: Stripe.createFetchHttpClient(),
        apiVersion: STRIPE_API_VERSION,
    });

    const signature = request.headers.get("stripe-signature");
    const bodyText = await request.text();

    let stripeEvent;
    try {
        // Use constructEventAsync for Web Crypto support
        stripeEvent = await stripe.webhooks.constructEventAsync(
            bodyText,
            signature,
            STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error(`Webhook Signature Verification Failed: ${err.message}`);
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    // Process Event
    try {
        if (stripeEvent.type === 'invoice.paid') {
            const invoice = stripeEvent.data.object;
            const subscription = await retrieveSubscriptionForInvoice(stripe, invoice);
            await syncStripeSubscriptionToBalance(stripe, stripeEvent, { subscription, invoice });

            const amount = invoice.amount_paid / 100;
            const customerEmail = invoice.customer_email;
            const customerId = invoice.customer;

            // Retrieve customer for metadata
            let customerMetadata = {};
            try {
                const c = await stripe.customers.retrieve(customerId);
                customerMetadata = c.metadata || {};
            } catch (e) {
                console.error("Error retrieving customer:", e.message);
            }

            const fbc = customerMetadata.fbc || invoice.metadata?.fbc;
            const fbp = customerMetadata.fbp || invoice.metadata?.fbp;

            console.log(`Processing invoice.paid (Edge) for ${customerEmail}`);

            // Use context.waitUntil to ensure CAPI fires without blocking response
            context.waitUntil(
                sendCAPIEvent('Purchase', {
                    email: customerEmail,
                    fbc,
                    fbp,
                    sourceUrl: "https://plantbased-balance.org/checkout-renewal",
                    userAgent: "Stripe-Webhook/Edge",
                    ip: "0.0.0.0"
                }, {
                    value: amount,
                    currency: 'AUD',
                    content_name: invoice.billing_reason === 'subscription_cycle' ? 'Subscription Renewal' : 'Initial Subscription',
                    content_category: 'Renewal'
                })
            );
        }

        if (stripeEvent.type === 'checkout.session.completed') {
            const session = stripeEvent.data.object;
            const customerId = session.customer;

            if (session.mode === "subscription" || session.subscription) {
                const subscription = await retrieveSubscriptionForSession(stripe, session);
                await syncStripeSubscriptionToBalance(stripe, stripeEvent, { subscription, session });
            }

            // Handle Challenge Pass purchase
            if (session.metadata?.product_type === 'challenge_pass' && session.metadata?.user_id) {
                const userId = session.metadata.user_id;
                const supabaseUrl = Deno.env.get('SUPABASE_URL');
                const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

                if (supabaseUrl && supabaseServiceKey) {
                    try {
                        // Update user to have challenge pass
                        const updateResponse = await fetch(
                            `${supabaseUrl}/rest/v1/users?id=eq.${userId}`,
                            {
                                method: 'PATCH',
                                headers: {
                                    'apikey': supabaseServiceKey,
                                    'Authorization': `Bearer ${supabaseServiceKey}`,
                                    'Content-Type': 'application/json',
                                    'Prefer': 'return=minimal'
                                },
                                body: JSON.stringify({
                                    has_challenge_pass: true,
                                    challenge_pass_purchased_at: new Date().toISOString()
                                })
                            }
                        );

                        if (updateResponse.ok) {
                            console.log(`Challenge Pass activated for user ${userId}`);
                        } else {
                            console.error(`Failed to activate Challenge Pass: ${await updateResponse.text()}`);
                        }
                    } catch (err) {
                        console.error("Error activating Challenge Pass:", err.message);
                    }
                }
            }

            // Handle Challenge Buy-In payment
            if (session.metadata?.product_type === 'challenge_buyin' && session.metadata?.user_id && session.metadata?.challenge_id) {
                const userId = session.metadata.user_id;
                const challengeId = session.metadata.challenge_id;
                const supabaseUrl = Deno.env.get('SUPABASE_URL');
                const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

                if (supabaseUrl && supabaseServiceKey) {
                    try {
                        // Mark this participant as paid
                        const patchResponse = await fetch(
                            `${supabaseUrl}/rest/v1/challenge_participants?challenge_id=eq.${challengeId}&user_id=eq.${userId}`,
                            {
                                method: 'PATCH',
                                headers: {
                                    'apikey': supabaseServiceKey,
                                    'Authorization': `Bearer ${supabaseServiceKey}`,
                                    'Content-Type': 'application/json',
                                    'Prefer': 'return=minimal'
                                },
                                body: JSON.stringify({
                                    has_paid: true,
                                    paid_at: new Date().toISOString(),
                                    stripe_payment_id: session.payment_intent
                                })
                            }
                        );

                        if (patchResponse.ok) {
                            console.log(`Challenge buy-in confirmed for user ${userId} in challenge ${challengeId}`);
                        } else {
                            console.error(`Failed to confirm buy-in: ${await patchResponse.text()}`);
                        }
                    } catch (err) {
                        console.error("Error confirming challenge buy-in:", err.message);
                    }
                }
            }

            // Handle Coin Pack purchase
            if (session.metadata?.product_type === 'coin_pack' && session.metadata?.user_id) {
                const userId = session.metadata.user_id;
                const coinAmount = parseInt(session.metadata.coin_amount) || 0;
                const packId = session.metadata.pack_id;
                const supabaseUrl = Deno.env.get('SUPABASE_URL');
                const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

                if (supabaseUrl && supabaseServiceKey && coinAmount > 0) {
                    try {
                        // Credit coins via RPC function
                        const rpcResponse = await fetch(
                            `${supabaseUrl}/rest/v1/rpc/credit_coins`,
                            {
                                method: 'POST',
                                headers: {
                                    'apikey': supabaseServiceKey,
                                    'Authorization': `Bearer ${supabaseServiceKey}`,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    user_uuid: userId,
                                    coin_amount: coinAmount,
                                    txn_type: 'pack_purchase',
                                    txn_description: `Purchased ${packId} pack (${coinAmount} coins)`,
                                    txn_reference: session.payment_intent
                                })
                            }
                        );

                        if (rpcResponse.ok) {
                            console.log(`Credited ${coinAmount} coins to user ${userId} (${packId} pack)`);
                        } else {
                            console.error(`Failed to credit coins: ${await rpcResponse.text()}`);
                        }
                    } catch (err) {
                        console.error("Error crediting coins:", err.message);
                    }
                }
            }

            // Store FB metadata on customer
            if (customerId && session.metadata?.fbc) {
                await stripe.customers.update(customerId, {
                    metadata: {
                        fbc: session.metadata.fbc,
                        fbp: session.metadata.fbp,
                        utm_source: session.metadata.utm_source,
                        utm_campaign: session.metadata.utm_campaign,
                        checkout_email: session.customer_details?.email || session.customer_email || session.metadata.checkout_email || "",
                    }
                });
            }
        }

        if (stripeEvent.type === 'customer.subscription.created'
            || stripeEvent.type === 'customer.subscription.updated'
            || stripeEvent.type === 'customer.subscription.deleted') {
            await syncStripeSubscriptionToBalance(stripe, stripeEvent, {
                subscription: stripeEvent.data.object,
            });
        }
    } catch (logicErr) {
        console.error("Webhook Logic Error:", logicErr);
        // Do not fail the webhook request if logic fails, to avoid retries
    }

    return new Response(JSON.stringify({ received: true }), {
        headers: { "Content-Type": "application/json" }
    });
};
