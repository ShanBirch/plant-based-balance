import Stripe from "stripe";
import { sendCAPIEvent } from "./lib/capi-utils.js";

const STRIPE_API_VERSION = "2026-02-25.clover";
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);
const BALANCE_ADMIN_EMAIL = "shannonbirch@cocospersonaltraining.com";
const SITE_URL = Deno.env.get("URL") || "https://plantbased-balance.org";
const STARTER_COACHING_PRODUCT = "Balance Starter Coaching";

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

function firstSubscriptionPrice(subscription) {
    return subscription?.items?.data?.[0]?.price || null;
}

function cleanCurrency(value) {
    return String(value || "aud").trim().toUpperCase();
}

function amountMinorFromSale({ subscription, invoice, session } = {}) {
    const price = firstSubscriptionPrice(subscription);
    const candidates = [
        session?.amount_total,
        invoice?.amount_paid,
        price?.unit_amount,
    ];
    const amount = candidates.map(Number).find(Number.isFinite);
    return Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
}

function currencyFromSale({ subscription, invoice, session } = {}) {
    return cleanCurrency(session?.currency || invoice?.currency || firstSubscriptionPrice(subscription)?.currency || "aud");
}

function formatMoney(amountMinor, currency = "AUD") {
    const amount = Number(amountMinor || 0) / 100;
    return `${currency.toUpperCase()} $${amount.toFixed(2)}`;
}

function isInitialPaidSubscriptionSale({ subscription, invoice, session } = {}) {
    if (!subscription?.id) return false;
    if (!ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status || "")) return false;
    if (invoice?.billing_reason === "subscription_cycle") return false;
    return amountMinorFromSale({ subscription, invoice, session }) > 0;
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

async function findBalanceAdminId() {
    const rows = await supabaseRequest(
        `users?select=id&email=eq.${encodeURIComponent(BALANCE_ADMIN_EMAIL)}&limit=1`
    );
    return Array.isArray(rows) ? rows[0]?.id || null : null;
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
    if (!subscription) return null;

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

    if (!payload.stripe_customer_id || !payload.stripe_subscription_id) return null;

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
    return {
        payload,
        mirrorRow,
        patchedUsers,
        userIds,
        customer,
        metadata,
    };
}

function saleCustomerName({ syncResult, session } = {}) {
    const user = syncResult?.patchedUsers?.[0] || {};
    const metadata = syncResult?.metadata || {};
    const email = cleanEmail(syncResult?.payload?.email || "");
    return user.name
        || metadata.name
        || metadata.client_name
        || metadata.profile_name
        || session?.customer_details?.name
        || syncResult?.customer?.name
        || (email ? email.split("@")[0] : "New client");
}

function buildSubscriptionSaleAlert({ adminId, syncResult, stripeEvent, subscription, invoice, session } = {}) {
    const payload = syncResult?.payload || {};
    const amountMinor = amountMinorFromSale({ subscription, invoice, session });
    const currency = currencyFromSale({ subscription, invoice, session });
    const amountDisplay = formatMoney(amountMinor, currency);
    const client = syncResult?.patchedUsers?.[0] || {};
    const clientId = payload.user_id || client.id || null;
    const clientName = saleCustomerName({ syncResult, session });
    const email = cleanEmail(payload.email || session?.customer_details?.email || session?.customer_email || invoice?.customer_email || "");
    const idempotencyKey = `subscription_sale:${subscription.id}`;
    const plan = payload.subscription_plan || "starter_weekly";
    const createdAt = new Date().toISOString();

    return {
        idempotency_key: idempotencyKey,
        client_id: clientId,
        client_name: clientName,
        coach_id: adminId,
        alert_type: "subscription_sale",
        priority: "urgent",
        title: `New sale: ${clientName}`,
        description: `${clientName} bought ${STARTER_COACHING_PRODUCT} (${amountDisplay}/week).`,
        suggested_message: null,
        status: "pending",
        data: {
            subtype: "starter_coaching_sale",
            sale_made: true,
            product_name: STARTER_COACHING_PRODUCT,
            amount_minor: amountMinor,
            amount_display: amountDisplay,
            currency,
            recurring_interval: "week",
            checkins_per_week: "1",
            email: email || null,
            user_id: clientId,
            lifecycle: { stage: "paying" },
            subscription_status: payload.subscription_status || subscription.status || null,
            subscription_plan: plan,
            stripe_customer_id: payload.stripe_customer_id || normalizeStripeId(subscription.customer),
            stripe_subscription_id: subscription.id,
            stripe_price_id: payload.stripe_price_id || firstSubscriptionPriceId(subscription) || null,
            stripe_event_id: stripeEvent.id,
            stripe_event_type: stripeEvent.type,
            checkout_session_id: session?.id || null,
            invoice_id: invoice?.id || null,
            payment_intent_id: payload.latest_payment_intent_id || normalizeStripeId(invoice?.payment_intent || session?.payment_intent),
            needs_you_required: true,
            needs_you_reason: "subscription_sale",
            needs_you_reasons: ["subscription_sale", "starter_coaching_sale"],
            operator_queue: "needs_you",
            codex_review: {
                decision: "needs_you_subscription_sale",
                queue: "needs_you",
                reason: "Stripe confirmed a new paid Starter Coaching subscription.",
                needs_shannon_approval: true,
                source: "stripe-webhook",
                reviewed_at: createdAt,
            },
        },
    };
}

async function findCoachAlertByIdempotencyKey(idempotencyKey) {
    if (!idempotencyKey) return null;
    const rows = await supabaseRequest(
        `coach_alerts?select=id&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`
    );
    return Array.isArray(rows) ? rows[0] || null : null;
}

function isUniqueViolation(error) {
    return /23505|duplicate key value violates unique|coach_alerts_idempotency_key_unique/i.test(error?.message || "");
}

async function insertSubscriptionSaleAlert(row) {
    const existing = await findCoachAlertByIdempotencyKey(row.idempotency_key).catch(() => null);
    if (existing?.id) return { alert: existing, deduped: true };

    try {
        const rows = await supabaseRequest("coach_alerts", {
            method: "POST",
            prefer: "return=representation",
            body: row,
        });
        const inserted = Array.isArray(rows) ? rows[0] : null;
        return { alert: inserted, deduped: false };
    } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        const raced = await findCoachAlertByIdempotencyKey(row.idempotency_key).catch(() => null);
        return { alert: raced, deduped: true };
    }
}

async function createSubscriptionSaleNeedsYouAlert({ syncResult, stripeEvent, subscription, invoice, session } = {}) {
    if (!isInitialPaidSubscriptionSale({ subscription, invoice, session })) {
        return { skipped: "not_initial_paid_subscription_sale" };
    }

    const adminId = await findBalanceAdminId();
    if (!adminId) return { skipped: "no_balance_admin" };

    const row = buildSubscriptionSaleAlert({ adminId, syncResult, stripeEvent, subscription, invoice, session });
    const result = await insertSubscriptionSaleAlert(row);
    return { ...result, row };
}

async function sendSaleNeedsYouNotification({ alert, row } = {}) {
    if (!alert?.id || !row?.coach_id) return;
    await fetch(`${SITE_URL}/.netlify/functions/send-dm-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            recipientId: row.coach_id,
            senderId: row.client_id || row.data?.stripe_customer_id || row.idempotency_key,
            senderName: row.title,
            messageText: row.description,
            type: "sale_made",
            alertId: alert.id,
            clientId: row.client_id || "",
            clientName: row.client_name || "",
            lifecycleStage: "paying",
            actionRequired: true,
            actionType: "subscription_sale",
            actionLabel: "New sale",
            actionReason: "Stripe confirmed a paid coaching subscription.",
            collapseKey: row.idempotency_key,
        }),
    }).catch(error => console.warn("[stripe-sync] sale push failed:", error.message));
}

async function createSaleAlertAndNotify(context, args) {
    try {
        const result = await createSubscriptionSaleNeedsYouAlert(args);
        if (result?.alert?.id && !result.deduped) {
            console.log(`[stripe-sync] sale alert ${result.alert.id} for subscription ${args.subscription?.id}`);
            if (context?.waitUntil) {
                context.waitUntil(sendSaleNeedsYouNotification(result));
            } else {
                await sendSaleNeedsYouNotification(result);
            }
        }
        return result;
    } catch (error) {
        console.error("[stripe-sync] sale alert failed:", error.message);
        return { skipped: "sale_alert_failed", error: error.message };
    }
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
            const syncResult = await syncStripeSubscriptionToBalance(stripe, stripeEvent, { subscription, invoice });
            await createSaleAlertAndNotify(context, { syncResult, stripeEvent, subscription, invoice });

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
                const syncResult = await syncStripeSubscriptionToBalance(stripe, stripeEvent, { subscription, session });
                await createSaleAlertAndNotify(context, { syncResult, stripeEvent, subscription, session });
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
