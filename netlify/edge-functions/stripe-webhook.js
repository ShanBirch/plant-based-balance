import Stripe from "stripe";
import { sendCAPIEvent } from "./lib/capi-utils.js";

const STRIPE_API_VERSION = "2026-06-24.dahlia";
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);
const BALANCE_ADMIN_EMAIL = "shannonbirch@cocospersonaltraining.com";
const SITE_URL = Deno.env.get("URL") || "https://plantbased-balance.org";
const ONLINE_COACHING_PRODUCT = "Balance Online Coaching";
const APP_COMMUNITY_PRODUCT = "Balance App + Community";
const COACHING_CALLS_PRODUCT = "Balance Coaching + Calls";
const FOUNDERS_PASS_PRODUCT = "Balance Learn Founders Pass";
const FOUNDERS_PASS_PRODUCT_TYPE = "balance_vegan_founders_pass";
const FOUNDERS_PASS_PLAN = "balance_foundations_six_week";
const LEGACY_FOUNDERS_PASS_PLAN = "founders_pass_lifetime";
const FOUNDATIONS_ACCESS_DAYS = 42;
const ACCOUNTABILITY_ADDON_PRODUCT = "balance_accountability_addon";
const META_PREVIEW_PURCHASE_MESSAGE = "You're in 🙌 Your Balance Learn pass is sorted. Finish signing in to the app and everything you set up will be there.";
const META_PREVIEW_PURCHASE_DELAY_MS = 60 * 1000;

function subscriptionOfferDetails(plan) {
    if (plan === "zoom_pt_1_weekly") {
        return {
            productName: "Balance Zoom PT 1",
            subtype: "zoom_pt_1_sale",
            recurringInterval: "week",
            commitmentWeeks: 6,
            checkinsPerWeek: "1",
            callsPerWeek: "1",
            needsYouReason: "zoom_pt_1_sale",
        };
    }
    if (plan === "app_community_monthly") {
        return {
            productName: APP_COMMUNITY_PRODUCT,
            subtype: "app_community_sale",
            recurringInterval: "month",
            checkinsPerWeek: "0",
            callsPerWeek: "0",
            needsYouReason: "app_community_sale",
        };
    }
    if (plan === "coaching_calls_weekly") {
        return {
            productName: COACHING_CALLS_PRODUCT,
            subtype: "coaching_calls_sale",
            recurringInterval: "week",
            checkinsPerWeek: "1",
            callsPerWeek: "1",
            needsYouReason: "coaching_calls_sale",
        };
    }
    const onlineCoachingTerms = {
        online_coaching_6_month: { label: "6 Month", commitmentWeeks: 26 },
        online_coaching_3_month: { label: "3 Month", commitmentWeeks: 13 },
        online_coaching_month_to_month: { label: "Month-to-Month", commitmentWeeks: 4 },
    };
    const onlineCoaching = onlineCoachingTerms[plan];
    if (onlineCoaching) {
        return {
            productName: `${ONLINE_COACHING_PRODUCT}, ${onlineCoaching.label}`,
            subtype: "online_coaching_sale",
            recurringInterval: "week",
            commitmentWeeks: onlineCoaching.commitmentWeeks,
            checkinsPerWeek: "1",
            callsPerWeek: "0",
            needsYouReason: "online_coaching_sale",
        };
    }
    return {
        productName: ONLINE_COACHING_PRODUCT,
        subtype: "starter_coaching_sale",
        recurringInterval: "week",
        commitmentWeeks: 0,
        checkinsPerWeek: "1",
        callsPerWeek: "0",
        needsYouReason: "starter_coaching_sale",
    };
}

function appendStripeFormValue(params, prefix, value) {
    if (value === undefined || value === null) return;
    if (typeof value === "object" && !Array.isArray(value)) {
        Object.entries(value).forEach(([key, nested]) => {
            appendStripeFormValue(params, `${prefix}[${key}]`, nested);
        });
        return;
    }
    params.set(prefix, String(value));
}

async function stripeRestRequest(secretKey, method, path, body) {
    const options = {
        method,
        headers: {
            Authorization: `Bearer ${secretKey}`,
            "Stripe-Version": STRIPE_API_VERSION,
        },
    };
    if (body !== undefined) {
        const params = new URLSearchParams();
        Object.entries(body).forEach(([key, value]) => appendStripeFormValue(params, key, value));
        options.headers["Content-Type"] = "application/x-www-form-urlencoded";
        options.body = params;
    }

    const response = await fetch(`https://api.stripe.com/v1/${path}`, options);
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(payload?.error?.message || `Stripe API request failed (${response.status})`);
    }
    return payload;
}

function createStripeRestClient(secretKey) {
    return {
        customers: {
            retrieve: customerId => stripeRestRequest(secretKey, "GET", `customers/${encodeURIComponent(customerId)}`),
            update: (customerId, body) => stripeRestRequest(secretKey, "POST", `customers/${encodeURIComponent(customerId)}`, body),
        },
        subscriptions: {
            retrieve: subscriptionId => stripeRestRequest(secretKey, "GET", `subscriptions/${encodeURIComponent(subscriptionId)}`),
            cancel: subscriptionId => stripeRestRequest(secretKey, "DELETE", `subscriptions/${encodeURIComponent(subscriptionId)}`),
        },
    };
}

function cleanEmail(email) {
    return String(email || "").trim();
}

function cleanString(value, max = 1000) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function base64UrlBytes(value = "") {
    const padded = String(value).replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(String(value).length / 4) * 4, "=");
    const binary = atob(padded);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function verifyMetaPreviewRef(token, nowMs = Date.now()) {
    const value = cleanString(token, 700);
    const secret = cleanString(
        Deno.env.get("META_APP_PREVIEW_REF_SECRET")
        || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
        || Deno.env.get("SUPABASE_SERVICE_KEY")
        || "",
        4000,
    );
    if (!secret) return null;
    try {
        if (!value.includes(".")) {
            const compact = base64UrlBytes(value);
            const payloadLength = 21;
            const signatureLength = 12;
            if (compact.length !== payloadLength + signatureLength || compact[0] !== 2) return null;
            const payload = compact.slice(0, payloadLength);
            const signature = compact.slice(payloadLength);
            const key = await crypto.subtle.importKey(
                "raw",
                new TextEncoder().encode(secret),
                { name: "HMAC", hash: "SHA-256" },
                false,
                ["sign"],
            );
            const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, payload)).slice(0, signatureLength);
            let mismatch = 0;
            for (let index = 0; index < signatureLength; index += 1) mismatch |= signature[index] ^ expected[index];
            if (mismatch !== 0) return null;
            const threadHex = Array.from(payload.slice(1, 17), byte => byte.toString(16).padStart(2, "0")).join("");
            const threadId = `${threadHex.slice(0, 8)}-${threadHex.slice(8, 12)}-${threadHex.slice(12, 16)}-${threadHex.slice(16, 20)}-${threadHex.slice(20)}`;
            const expiresMs = new DataView(payload.buffer, payload.byteOffset, payload.byteLength).getUint32(17) * 1000;
            const issuedMs = expiresMs - (24 * 60 * 60 * 1000);
            if (expiresMs <= nowMs || expiresMs > nowMs + (24 * 60 * 60 * 1000) + 60_000) return null;
            return { threadId, issuedMs, expiresMs };
        }
        const parts = value.split(".");
        if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
        const key = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(secret),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["verify"],
        );
        const valid = await crypto.subtle.verify(
            "HMAC",
            key,
            base64UrlBytes(parts[1]),
            new TextEncoder().encode(parts[0]),
        );
        if (!valid) return null;
        const payload = JSON.parse(new TextDecoder().decode(base64UrlBytes(parts[0])));
        const threadId = cleanString(payload?.t, 80);
        const issuedMs = Number(payload?.i) * 1000;
        const expiresMs = Number(payload?.e) * 1000;
        if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(threadId)
            || !Number.isFinite(issuedMs)
            || !Number.isFinite(expiresMs)
            || issuedMs > nowMs + 60_000
            || expiresMs <= nowMs
            || expiresMs - issuedMs > (24 * 60 * 60 * 1000) + 60_000) return null;
        return { threadId, issuedMs, expiresMs };
    } catch (_) {
        return null;
    }
}

function objectOrEmpty(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function previewGraphRecipientId(thread = {}) {
    const customData = objectOrEmpty(thread.custom_data);
    const graph = objectOrEmpty(customData.instagram_graph);
    const subscriberId = cleanString(thread.subscriber_id, 200);
    return cleanString(
        graph.ig_graph_user_id
        || graph.recipient_id
        || customData.ig_graph_recipient_id
        || (subscriberId.startsWith("ig_graph:") ? subscriberId.slice("ig_graph:".length) : ""),
        200,
    );
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

async function patchUsersForSubscription(payload, { patchByEmail = true } = {}) {
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

    if (patchByEmail && payload.email) {
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

async function recordStripeGrowthOutcome({ payload, mirrorRow, userIds, stripeEvent, status }) {
    const isActive = ACTIVE_SUBSCRIPTION_STATUSES.has(status);
    const eventType = isActive ? "subscription_started" : "subscription_canceled";
    const eventKey = isActive
        ? `stripe_subscription:${payload.stripe_subscription_id}:subscription_started`
        : `stripe_subscription:${payload.stripe_subscription_id}:subscription_canceled:${stripeEvent.id || status}`;
    const now = new Date().toISOString();
    try {
        await supabaseRequest("growth_outcome_events?on_conflict=event_key", {
            method: "POST",
            prefer: "resolution=merge-duplicates,return=minimal",
            body: [{
                event_key: eventKey,
                event_type: eventType,
                event_family: "revenue",
                event_status: cleanString(status, 80) || "unknown",
                source_system: "stripe_webhook",
                email: payload.email || null,
                email_key: payload.email_key || null,
                client_id: userIds?.[0] || payload.user_id || null,
                stripe_subscription_link_id: mirrorRow?.id || null,
                score: isActive ? 100 : -30,
                score_breakdown: {
                    default_score: isActive ? 100 : -30,
                    score: isActive ? 100 : -30,
                    reason: status,
                },
                attribution: {
                    stripe_customer_id: payload.stripe_customer_id || null,
                    stripe_subscription_id: payload.stripe_subscription_id || null,
                    stripe_price_id: payload.stripe_price_id || null,
                    subscription_plan: payload.subscription_plan || null,
                    last_event_type: payload.last_event_type || stripeEvent.type || null,
                },
                raw_payload: {
                    stripe_event_id: stripeEvent.id || null,
                    raw_summary: payload.raw_summary || {},
                    patched_user_ids: userIds || [],
                },
                occurred_at: now,
            }],
        });
    } catch (error) {
        console.warn("[stripe-sync] growth outcome log failed:", error.message || error);
    }
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
            commitment_weeks: Number(metadata.commitment_weeks || 0) || null,
            commitment_label: cleanString(metadata.commitment_label, 100) || null,
            renewal_terms: cleanString(metadata.renewal_terms, 100) || null,
            billing_reason: invoice?.billing_reason || null,
            collection_method: subscription.collection_method || invoice?.collection_method || null,
            invoice_status: invoice?.status || null,
        },
    };

    if (!payload.stripe_customer_id || !payload.stripe_subscription_id) return null;

    const isActive = ACTIVE_SUBSCRIPTION_STATUSES.has(status);
    const mirrorRow = await mirrorStripeSubscription(payload);
    let replacedByActiveSubscription = false;
    if (!isActive && customerId) {
        const activeLinks = await supabaseRequest(
            `stripe_subscription_links?select=stripe_subscription_id,subscription_plan&stripe_customer_id=eq.${encodeURIComponent(customerId)}&subscription_status=in.(active,trialing)&stripe_subscription_id=neq.${encodeURIComponent(subscription.id)}&limit=10`
        ).catch(() => []);
        replacedByActiveSubscription = Array.isArray(activeLinks) && activeLinks.some(link =>
            !["extra_voice_checkin_weekly", "extra_zoom_pt_weekly"].includes(String(link.subscription_plan || ""))
        );
    }
    const patchedUsers = replacedByActiveSubscription
        ? []
        : await patchUsersForSubscription(payload, { patchByEmail: isActive });
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

    if (replacedByActiveSubscription) {
        console.log(`[stripe-sync] ${subscription.id} ended after replacement; current Balance plan preserved`);
    } else if (isActive || userIds.length > 0) {
        await syncLinkedLeadStages(userIds, status);
        await recordStripeGrowthOutcome({ payload, mirrorRow, userIds, stripeEvent, status });
    } else {
        console.log(`[stripe-sync] ${stripeEvent.type} subscription ${subscription.id} mirrored without user/status side effects`);
    }
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

function isAccountabilityAddonSubscription(subscription, invoice, session) {
    const metadata = {
        ...(subscription?.metadata || {}),
        ...(invoice?.metadata || {}),
        ...(session?.metadata || {}),
    };
    return metadata.balance_product === ACCOUNTABILITY_ADDON_PRODUCT
        && (metadata.addon_type === "voice_checkin" || metadata.addon_type === "extra_zoom_pt");
}

async function recordAccountabilityAddonPurchase({ subscription, invoice, session }) {
    const metadata = {
        ...(subscription?.metadata || {}),
        ...(invoice?.metadata || {}),
        ...(session?.metadata || {}),
    };
    const clientId = cleanString(metadata.balance_user_id, 80);
    if (!clientId || !subscription?.id) return;
    const existing = await supabaseRequest(`coach_alerts?select=id&data->>stripe_subscription_id=eq.${encodeURIComponent(subscription.id)}&limit=1`).catch(() => []);
    if (Array.isArray(existing) && existing.length) return;
    const clients = await supabaseRequest(`users?select=id,name,email&id=eq.${encodeURIComponent(clientId)}&limit=1`).catch(() => []);
    const client = Array.isArray(clients) ? clients[0] : null;
    const coaches = await supabaseRequest(`coach_clients?select=coach_id&client_id=eq.${encodeURIComponent(clientId)}&status=eq.active&limit=1`).catch(() => []);
    const coachId = Array.isArray(coaches) ? coaches[0]?.coach_id : null;
    if (!coachId) return;
    const isExtraPt = metadata.addon_type === 'extra_zoom_pt';
    await supabaseRequest('coach_alerts', {
        method: 'POST',
        prefer: 'return=minimal',
        body: [{
            client_id: clientId,
            client_name: client?.name || cleanEmail(metadata.checkout_email) || 'Client',
            coach_id: coachId,
            alert_type: 'subscription_sale',
            priority: 'medium',
            title: isExtraPt
                ? `${client?.name || 'Client'} added an extra weekly Zoom PT session`
                : `${client?.name || 'Client'} added an extra voice check-in`,
            description: isExtraPt
                ? 'AU$75/week payment received. Their recurring 30-minute Zoom PT time is booked in.'
                : 'AU$25/week payment received. Add the mid-week accountability voice check-in to their coaching rhythm.',
            status: 'pending',
            data: {
                subtype: isExtraPt ? 'accountability_extra_zoom_pt_paid' : 'accountability_extra_voice_checkin_paid',
                operator_queue: 'needs_you',
                needs_you_required: true,
                addon_type: isExtraPt ? 'extra_zoom_pt' : 'voice_checkin',
                weekly_price_aud: isExtraPt ? 75 : 25,
                stripe_subscription_id: subscription.id,
                stripe_customer_id: normalizeStripeId(subscription.customer),
                week_start: cleanString(metadata.week_start, 10) || null,
                booking_id: cleanString(metadata.booking_id, 80) || null,
                recurring_starts_at: cleanString(metadata.recurring_starts_at, 80) || null,
            },
        }],
    });
}

async function cancelReplacedCoachingSubscription(stripe, subscription, session) {
    const metadata = { ...(subscription?.metadata || {}), ...(session?.metadata || {}) };
    const previousId = cleanString(metadata.previous_subscription_id, 120);
    if (metadata.addon_type !== "zoom_pt_1_upgrade" || !previousId || previousId === subscription?.id) return;
    try {
        await stripe.subscriptions.cancel(previousId);
        console.log(`[stripe-sync] replaced coaching subscription ${previousId} with ${subscription.id}`);
    } catch (error) {
        const message = cleanString(error?.message, 300).toLowerCase();
        if (!message.includes("no such subscription") && !message.includes("already canceled")) throw error;
    }
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
    const offer = subscriptionOfferDetails(plan);
    const createdAt = new Date().toISOString();

    return {
        idempotency_key: idempotencyKey,
        client_id: clientId,
        client_name: clientName,
        coach_id: adminId,
        alert_type: "subscription_sale",
        priority: "urgent",
        title: `New sale: ${clientName}`,
        description: `${clientName} bought ${offer.productName} (${amountDisplay}/${offer.recurringInterval}${offer.commitmentWeeks ? `, ${offer.commitmentWeeks}-week initial term` : ""}).`,
        suggested_message: null,
        status: "pending",
        data: {
            subtype: offer.subtype,
            sale_made: true,
            product_name: offer.productName,
            amount_minor: amountMinor,
            amount_display: amountDisplay,
            currency,
            recurring_interval: offer.recurringInterval,
            commitment_weeks: offer.commitmentWeeks || null,
            checkins_per_week: offer.checkinsPerWeek,
            calls_per_week: offer.callsPerWeek,
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
            needs_you_reasons: ["subscription_sale", offer.needsYouReason],
            operator_queue: "needs_you",
            codex_review: {
                decision: "needs_you_subscription_sale",
                queue: "needs_you",
                reason: `Stripe confirmed a new paid ${offer.productName} subscription.`,
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

async function recordMetaPreviewPurchaseAndQueue({ session, stripeEvent, email, user, purchasedAt } = {}) {
    const token = cleanString(session?.metadata?.meta_ref, 700);
    const verified = await verifyMetaPreviewRef(token);
    if (!verified) return { skipped: "not_signed_meta_preview" };

    const threadRows = await supabaseRequest(
        `ig_threads?select=id,coach_id,linked_user_id,subscriber_id,ig_username,profile_name,lead_stage,last_inbound_at,last_outbound_at,custom_data&id=eq.${encodeURIComponent(verified.threadId)}&limit=1`,
    );
    const thread = Array.isArray(threadRows) ? threadRows[0] || null : null;
    if (!thread) return { skipped: "preview_thread_missing" };

    const customData = objectOrEmpty(thread.custom_data);
    const graph = objectOrEmpty(customData.instagram_graph);
    const botAccount = cleanString(customData.bot_account || graph.bot_account, 100).toLowerCase();
    if (botAccount !== "shan_n_sunny") return { skipped: "wrong_preview_account" };

    const messageRows = await supabaseRequest(
        `ig_messages?select=id,direction,text,created_at&thread_id=eq.${encodeURIComponent(thread.id)}&order=created_at.desc&limit=20`,
    );
    const canonicalOutbound = Array.isArray(messageRows) ? messageRows.find(message =>
        String(message.direction || "").toLowerCase() === "out"
        && String(message.text || "").includes(token)
        && /https:\/\/(?:plantbased-balance\.org|future-balance\.netlify\.app)\/(?:meta-app-preview\.html|p\/)/i.test(String(message.text || ""))
    ) : null;
    if (!canonicalOutbound) return { skipped: "canonical_preview_missing" };

    const analyticsSessionId = cleanString(session?.metadata?.session_id, 100);
    const visitorId = cleanString(session?.metadata?.visitor_id, 100);
    await supabaseRequest("growth_outcome_events?on_conflict=event_key", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: [{
            event_key: `stripe_checkout:${session.id}:meta_app_preview_purchase`,
            event_type: "meta_app_preview_purchase_completed",
            event_family: "revenue",
            event_status: "paid",
            source_system: "meta_app_preview",
            bot_account: "shan_n_sunny",
            from_username: thread.ig_username || null,
            email: email || null,
            email_key: email ? email.toLowerCase() : null,
            ig_thread_id: thread.id,
            client_id: user?.id || null,
            campaign_slug: cleanString(session?.metadata?.utm_campaign, 128) || null,
            landing_url: cleanString(session?.metadata?.landing_url, 500) || null,
            utm_source: cleanString(session?.metadata?.utm_source, 128) || null,
            utm_medium: cleanString(session?.metadata?.utm_medium, 128) || null,
            utm_campaign: cleanString(session?.metadata?.utm_campaign, 128) || null,
            score: 100,
            score_breakdown: { stage: "purchase_completed", amount_minor: Number(session.amount_total || 14900) },
            attribution: {
                analytics_session_id: analyticsSessionId || null,
                visitor_id: visitorId || null,
                stripe_checkout_session_id: session.id,
                stripe_event_id: stripeEvent?.id || null,
            },
            raw_payload: {
                stage: "purchase_completed",
                stripe_checkout_session_id: session.id,
                stripe_payment_intent_id: normalizeStripeId(session.payment_intent) || null,
            },
            occurred_at: purchasedAt || new Date().toISOString(),
        }],
    });

    await supabaseRequest(`ig_threads?id=eq.${encodeURIComponent(thread.id)}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: { lead_stage: "paying" },
    });

    const existingAlerts = await supabaseRequest(
        `coach_alerts?select=id,status,data&status=in.(scheduled,pending)&data-%3E%3Eig_thread_id=eq.${encodeURIComponent(thread.id)}&limit=50`,
    ).catch(() => []);
    for (const alert of Array.isArray(existingAlerts) ? existingAlerts : []) {
        if (alert?.data?.meta_app_preview_followup !== true || alert?.data?.meta_app_preview_followup_kind === "purchase") continue;
        await supabaseRequest(`coach_alerts?id=eq.${encodeURIComponent(alert.id)}&status=in.(scheduled,pending)`, {
            method: "PATCH",
            prefer: "return=minimal",
            body: {
                status: "canceled",
                actioned_at: new Date().toISOString(),
                data: {
                    ...alert.data,
                    cancel_reason: "meta_app_preview_purchase_completed",
                    meta_app_preview_conversion_at: purchasedAt || new Date().toISOString(),
                    meta_app_preview_conversion_event: "stripe_purchase_completed",
                },
            },
        });
    }

    const nowMs = Date.now();
    const inboundMs = Date.parse(thread.last_inbound_at || "");
    const recipientId = previewGraphRecipientId(thread);
    const eligible = !customData.do_not_follow_up
        && recipientId
        && Number.isFinite(inboundMs)
        && nowMs >= inboundMs
        && nowMs - inboundMs < (23.5 * 60 * 60 * 1000);
    if (!eligible) return { recorded: true, skipped: "outside_graph_followup_window" };

    const createdAt = new Date(nowMs).toISOString();
    const purchaseAmount = (Math.max(0, Number(session.amount_total || 0)) / 100).toFixed(2).replace(/\.00$/, "");
    const graphData = {
        ...graph,
        ig_graph_user_id: recipientId,
        send_ready: true,
    };
    const result = await insertSubscriptionSaleAlert({
        idempotency_key: `meta_app_preview_purchase_followup:${session.id}`,
        client_id: user?.id || null,
        client_name: thread.profile_name || thread.ig_username || email?.split("@")[0] || "New member",
        coach_id: thread.coach_id,
        alert_type: "follow_up_review",
        priority: "urgent",
        title: `${thread.profile_name || thread.ig_username || "Instagram lead"} bought Balance Learn`,
        description: `Stripe confirmed the $${purchaseAmount} Balance Learn purchase. A short welcome is queued.`,
        suggested_message: META_PREVIEW_PURCHASE_MESSAGE,
        scheduled_reply_text: META_PREVIEW_PURCHASE_MESSAGE,
        status: "scheduled",
        scheduled_at: createdAt,
        scheduled_for: new Date(nowMs + META_PREVIEW_PURCHASE_DELAY_MS).toISOString(),
        data: {
            channel: "instagram",
            delivery_channel: "instagram_graph",
            subscriber_id: thread.subscriber_id,
            ig_thread_id: thread.id,
            ig_username: thread.ig_username || null,
            profile_name: thread.profile_name || null,
            bot_account: "shan_n_sunny",
            ig_graph_recipient_id: recipientId,
            ig_graph_account_id: graph.ig_account_id || null,
            instagram_graph: graphData,
            last_inbound_at: thread.last_inbound_at,
            source_inbound_created_at: purchasedAt || createdAt,
            drafted_at: createdAt,
            scheduled_via: "balance_lead_client_manager_cron",
            auto_send_review_approved_at: createdAt,
            outbound_attempted: false,
            draft_messages: [META_PREVIEW_PURCHASE_MESSAGE],
            draft_text: META_PREVIEW_PURCHASE_MESSAGE,
            draft_model: "deterministic_meta_app_preview_purchase_v1",
            draft_reply_mode: "campaign_app_preview_purchase_welcome",
            draft_review: {
                verdict: "pass",
                confidence: 1,
                summary: "Stripe-confirmed Balance Learn purchase welcome.",
                issues: [],
                reviewed_at: createdAt,
                reviewer_model: "deterministic_stripe_purchase_v1",
            },
            context_review: { required: false, reason: "signed preview reference and Stripe purchase verified" },
            media_review: { required: false },
            meta_app_preview_followup: true,
            meta_app_preview_followup_kind: "purchase",
            meta_app_preview_session_id: analyticsSessionId || null,
            meta_app_preview_checkout_session_id: session.id,
            meta_app_preview_gate_shown_at: purchasedAt || createdAt,
            meta_app_preview_purchase_at: purchasedAt || createdAt,
            meta_app_preview_canonical_outbound_id: canonicalOutbound.id,
            stripe_event_id: stripeEvent?.id || null,
        },
    });
    return { recorded: true, queued: Boolean(result?.alert?.id), deduped: Boolean(result?.deduped) };
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

async function recordFoundersPassSale(context, stripeEvent, session) {
    if (session?.mode !== "payment"
        || session?.payment_status !== "paid"
        || session?.metadata?.product_type !== FOUNDERS_PASS_PRODUCT_TYPE) {
        return { skipped: "not_paid_founders_pass" };
    }

    const email = cleanEmail(
        session?.customer_details?.email
        || session?.customer_email
        || session?.metadata?.checkout_email
    ).toLowerCase();
    if (!email) return { skipped: "missing_checkout_email" };

    const amountMinor = Math.max(0, Number(session.amount_total || 14900));
    const currency = cleanCurrency(session.currency || "aud");
    const purchasedAt = isoFromStripeTimestamp(session.created) || new Date().toISOString();
    const sessionPlan = String(session?.metadata?.balance_plan || "");
    const purchasePlan = sessionPlan === LEGACY_FOUNDERS_PASS_PLAN ? LEGACY_FOUNDERS_PASS_PLAN : FOUNDERS_PASS_PLAN;
    const accessExpiresAt = purchasePlan === FOUNDERS_PASS_PLAN
        ? new Date(new Date(purchasedAt).getTime() + FOUNDATIONS_ACCESS_DAYS * 24 * 60 * 60 * 1000).toISOString()
        : null;
    const attribution = {
        utm_source: cleanString(session?.metadata?.utm_source, 128) || null,
        utm_medium: cleanString(session?.metadata?.utm_medium, 128) || null,
        utm_campaign: cleanString(session?.metadata?.utm_campaign, 128) || null,
        utm_term: cleanString(session?.metadata?.utm_term, 128) || null,
        utm_content: cleanString(session?.metadata?.utm_content, 128) || null,
        campaign_id: cleanString(session?.metadata?.campaign_id, 128) || null,
        adset_id: cleanString(session?.metadata?.adset_id, 128) || null,
        ad_id: cleanString(session?.metadata?.ad_id, 128) || null,
        placement: cleanString(session?.metadata?.placement, 128) || null,
        site_source_name: cleanString(session?.metadata?.site_source_name, 128) || null,
        page_variant: cleanString(session?.metadata?.landing_page_variant, 64) || null,
        landing_url: cleanString(session?.metadata?.landing_url, 500) || null,
        visitor_id: cleanString(session?.metadata?.visitor_id, 100) || null,
        analytics_session_id: cleanString(session?.metadata?.session_id, 100) || null,
        fbclid: cleanString(session?.metadata?.fbclid, 500) || null,
        fbc: cleanString(session?.metadata?.fbc, 500) || null,
        fbp: cleanString(session?.metadata?.fbp, 500) || null,
    };
    const existingUsers = await supabaseRequest(
        `users?select=id,name,email&email=eq.${encodeURIComponent(email)}&limit=1`
    );
    const user = Array.isArray(existingUsers) ? existingUsers[0] || null : null;

    const purchaseRows = await supabaseRequest(
        "founders_pass_purchases?on_conflict=stripe_checkout_session_id",
        {
            method: "POST",
            prefer: "resolution=merge-duplicates,return=representation",
            body: {
                stripe_checkout_session_id: session.id,
                stripe_payment_intent_id: normalizeStripeId(session.payment_intent) || null,
                stripe_customer_id: normalizeStripeId(session.customer) || null,
                email,
                user_id: user?.id || null,
                amount_minor: amountMinor,
                currency: currency.toLowerCase(),
                status: "paid",
                purchased_at: purchasedAt,
                claimed_at: user?.id ? new Date().toISOString() : null,
                metadata: {
                    balance_plan: purchasePlan,
                    product_type: FOUNDERS_PASS_PRODUCT_TYPE,
                    access_type: purchasePlan === LEGACY_FOUNDERS_PASS_PLAN ? "lifetime_core_app_community" : "fixed_six_week_foundations",
                    access_days: purchasePlan === FOUNDERS_PASS_PLAN ? FOUNDATIONS_ACCESS_DAYS : null,
                    access_expires_at: accessExpiresAt,
                    stripe_event_id: stripeEvent.id,
                    attribution,
                },
            },
        }
    );

    try {
        await supabaseRequest("growth_outcome_events?on_conflict=event_key", {
            method: "POST",
            prefer: "resolution=merge-duplicates,return=minimal",
            body: [{
                event_key: `stripe_checkout:${session.id}:founders_pass_purchase`,
                event_type: "purchase_completed",
                event_family: "revenue",
                event_status: "paid",
                source_system: "stripe_webhook",
                email,
                email_key: email,
                client_id: user?.id || null,
                campaign_slug: attribution.utm_campaign,
                landing_url: attribution.landing_url,
                utm_source: attribution.utm_source,
                utm_medium: attribution.utm_medium,
                utm_campaign: attribution.utm_campaign,
                score: 100,
                score_breakdown: { default_score: 100, score: 100, reason: "paid_founders_pass" },
                attribution,
                raw_payload: {
                    stripe_event_id: stripeEvent.id,
                    stripe_checkout_session_id: session.id,
                    stripe_payment_intent_id: normalizeStripeId(session.payment_intent) || null,
                    amount_minor: amountMinor,
                    currency,
                },
                occurred_at: purchasedAt,
            }],
        });
    } catch (error) {
        console.warn("[stripe-sync] founders purchase growth outcome failed:", error.message || error);
    }

    if (user?.id) {
        await supabaseRequest(`users?id=eq.${encodeURIComponent(user.id)}`, {
            method: "PATCH",
            prefer: "return=minimal",
            body: {
                subscription_status: "active",
                subscription_plan: purchasePlan,
            },
        });
        await syncLinkedLeadStages([user.id], "active");
    }

    try {
        await recordMetaPreviewPurchaseAndQueue({ session, stripeEvent, email, user, purchasedAt });
    } catch (error) {
        console.warn("[stripe-sync] meta preview purchase follow-up failed:", error.message || error);
    }

    const adminId = await findBalanceAdminId();
    if (!adminId) return { purchase: purchaseRows?.[0] || null, skipped: "no_balance_admin" };

    const clientName = user?.name || session?.customer_details?.name || email.split("@")[0] || "New member";
    const amountDisplay = formatMoney(amountMinor, currency);
    const createdAt = new Date().toISOString();
    const row = {
        idempotency_key: `founders_pass_sale:${session.id}`,
        client_id: user?.id || null,
        client_name: clientName,
        coach_id: adminId,
        alert_type: "subscription_sale",
        priority: "urgent",
        title: `New Founders Pass sale: ${clientName}`,
        description: `${clientName} bought ${FOUNDERS_PASS_PRODUCT} (${amountDisplay} once).`,
        suggested_message: null,
        status: "pending",
        data: {
            subtype: "founders_pass_sale",
            sale_made: true,
            product_name: FOUNDERS_PASS_PRODUCT,
            amount_minor: amountMinor,
            amount_display: amountDisplay,
            currency,
            recurring_interval: "none",
            checkins_per_week: purchasePlan === FOUNDERS_PASS_PLAN ? "1" : "0",
            calls_per_week: "0",
            email,
            user_id: user?.id || null,
            lifecycle: { stage: "paying" },
            subscription_status: "active",
            subscription_plan: purchasePlan,
            access_expires_at: accessExpiresAt,
            stripe_customer_id: normalizeStripeId(session.customer) || null,
            checkout_session_id: session.id,
            payment_intent_id: normalizeStripeId(session.payment_intent) || null,
            stripe_event_id: stripeEvent.id,
            stripe_event_type: stripeEvent.type,
            needs_you_required: true,
            needs_you_reason: "founders_pass_sale",
            needs_you_reasons: ["subscription_sale", "founders_pass_sale"],
            operator_queue: "needs_you",
            codex_review: {
                decision: "needs_you_founders_pass_sale",
                queue: "needs_you",
                reason: `Stripe confirmed a paid ${FOUNDERS_PASS_PRODUCT} purchase.`,
                needs_shannon_approval: true,
                source: "stripe-webhook",
                reviewed_at: createdAt,
            },
        },
    };
    const result = await insertSubscriptionSaleAlert(row);
    if (result?.alert?.id && !result.deduped) {
        const notify = fetch(`${SITE_URL}/.netlify/functions/send-dm-notification`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                recipientId: adminId,
                senderId: user?.id || normalizeStripeId(session.customer) || session.id,
                senderName: row.title,
                messageText: row.description,
                type: "sale_made",
                alertId: result.alert.id,
                clientId: user?.id || "",
                clientName,
                lifecycleStage: "paying",
                actionRequired: true,
                actionType: "subscription_sale",
                actionLabel: "New Founders Pass sale",
                actionReason: "Stripe confirmed a paid Founders Pass purchase.",
                collapseKey: row.idempotency_key,
            }),
        }).catch(error => console.warn("[stripe-sync] founders sale push failed:", error.message));
        if (context?.waitUntil) context.waitUntil(notify); else await notify;
    }
    return { purchase: purchaseRows?.[0] || null, ...result };
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

    const stripeVerifier = new Stripe(STRIPE_SECRET_KEY, {
        apiVersion: STRIPE_API_VERSION,
        telemetry: false,
    });
    const stripe = createStripeRestClient(STRIPE_SECRET_KEY);

    const signature = request.headers.get("stripe-signature");
    const bodyText = await request.text();

    let stripeEvent;
    try {
        // Use constructEventAsync for Web Crypto support
        stripeEvent = await stripeVerifier.webhooks.constructEventAsync(
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
            if (isAccountabilityAddonSubscription(subscription, invoice)) {
                await recordAccountabilityAddonPurchase({ subscription, invoice });
            } else {
                const syncResult = await syncStripeSubscriptionToBalance(stripe, stripeEvent, { subscription, invoice });
                await createSaleAlertAndNotify(context, { syncResult, stripeEvent, subscription, invoice });
            }

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
                if (!isAccountabilityAddonSubscription(subscription, null, session)) {
                    const syncResult = await syncStripeSubscriptionToBalance(stripe, stripeEvent, { subscription, session });
                    await createSaleAlertAndNotify(context, { syncResult, stripeEvent, subscription, session });
                    await cancelReplacedCoachingSubscription(stripe, subscription, session);
                } else {
                    await recordAccountabilityAddonPurchase({ subscription, session });
                }
            }

            if (session.metadata?.product_type === FOUNDERS_PASS_PRODUCT_TYPE) {
                await recordFoundersPassSale(context, stripeEvent, session);
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
