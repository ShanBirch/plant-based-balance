import Stripe from "stripe";
import { sendCAPIEvent } from "./lib/capi-utils.js";

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
        apiVersion: "2023-10-16",
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

            // Store FB metadata on customer
            if (customerId && session.metadata?.fbc) {
                await stripe.customers.update(customerId, {
                    metadata: {
                        fbc: session.metadata.fbc,
                        fbp: session.metadata.fbp,
                        utm_source: session.metadata.utm_source,
                        utm_campaign: session.metadata.utm_campaign
                    }
                });
            }
        }
    } catch (logicErr) {
        console.error("Webhook Logic Error:", logicErr);
        // Do not fail the webhook request if logic fails, to avoid retries
    }

    return new Response(JSON.stringify({ received: true }), {
        headers: { "Content-Type": "application/json" }
    });
};
