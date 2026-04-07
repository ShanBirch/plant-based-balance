import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Validate IAP receipts from Apple App Store and Google Play Store
 * Then credit the user's account (coins, subscription, etc.)
 *
 * POST /api/validate-iap-receipt
 */
export default async (request, context) => {
    if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    const corsHeaders = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const body = await request.json();
        const { receipt, productId, productType, provider, userId, metadata } = body;

        if (!receipt || !productId || !provider || !userId) {
            return new Response(JSON.stringify({
                error: { message: "Missing required fields: receipt, productId, provider, userId" }
            }), { status: 400, headers: corsHeaders });
        }

        // Initialize Supabase with service role for writes
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error("Missing Supabase configuration");
        }
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        let validationResult;

        if (provider === "apple") {
            validationResult = await validateAppleReceipt(receipt, productId);
        } else if (provider === "google") {
            validationResult = await validateGoogleReceipt(receipt, productId, productType);
        } else {
            return new Response(JSON.stringify({
                error: { message: "Invalid provider. Use 'apple' or 'google'" }
            }), { status: 400, headers: corsHeaders });
        }

        if (!validationResult.valid) {
            return new Response(JSON.stringify({
                error: { message: "Receipt validation failed: " + (validationResult.reason || "invalid") }
            }), { status: 403, headers: corsHeaders });
        }

        // Receipt is valid — now credit the user's account
        const creditResult = await creditPurchase(supabase, userId, productId, productType, validationResult.transactionId, metadata);

        return new Response(JSON.stringify({
            success: true,
            transactionId: validationResult.transactionId,
            ...creditResult
        }), { headers: corsHeaders });

    } catch (error) {
        console.error("IAP validation error:", error.message);
        return new Response(JSON.stringify({
            error: { message: error.message }
        }), { status: 500, headers: corsHeaders });
    }
};

// ─── Apple Receipt Validation (App Store Server API v2) ────────────────

async function validateAppleReceipt(jwsTransaction, productId) {
    // In production, verify the JWS signature using Apple's public keys
    // For App Store Server API v2, the transaction is a signed JWS
    // The native StoreKit 2 already verifies locally, but server validation adds security

    try {
        // Decode the JWS payload (base64url)
        const parts = jwsTransaction.split('.');
        if (parts.length !== 3) {
            return { valid: false, reason: "Invalid JWS format" };
        }

        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

        // Verify the product ID matches
        if (payload.productId !== productId) {
            return { valid: false, reason: "Product ID mismatch" };
        }

        // Verify the bundle ID
        if (payload.bundleId && payload.bundleId !== "com.fitgotchi.app") {
            return { valid: false, reason: "Bundle ID mismatch" };
        }

        // Check environment (sandbox vs production)
        const environment = payload.environment || "Production";
        console.log(`Apple receipt validated: ${productId} (${environment})`);

        return {
            valid: true,
            transactionId: payload.transactionId || payload.originalTransactionId,
            environment
        };
    } catch (err) {
        console.error("Apple validation error:", err);
        return { valid: false, reason: err.message };
    }
}

// ─── Google Play Receipt Validation ────────────────────────────────────

async function validateGoogleReceipt(receiptJson, productId, productType) {
    try {
        const receipt = typeof receiptJson === "string" ? JSON.parse(receiptJson) : receiptJson;

        // Verify the product ID matches
        const receiptProductId = receipt.productId || (receipt.productIds && receipt.productIds[0]);
        if (receiptProductId !== productId) {
            return { valid: false, reason: "Product ID mismatch" };
        }

        // Verify the package name
        if (receipt.packageName && receipt.packageName !== "com.fitgotchi.app") {
            return { valid: false, reason: "Package name mismatch" };
        }

        // Check purchase state (0 = purchased, 1 = canceled, 2 = pending)
        if (receipt.purchaseState !== undefined && receipt.purchaseState !== 0) {
            return { valid: false, reason: "Purchase not completed" };
        }

        // For production, you should verify with Google Play Developer API
        // using a service account. The purchaseToken can be verified via:
        // GET https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{packageName}/purchases/products/{productId}/tokens/{token}

        const transactionId = receipt.orderId || receipt.purchaseToken;
        console.log(`Google receipt validated: ${productId}`);

        return {
            valid: true,
            transactionId
        };
    } catch (err) {
        console.error("Google validation error:", err);
        return { valid: false, reason: err.message };
    }
}

// ─── Credit the purchase to the user's account ─────────────────────────

async function creditPurchase(supabase, userId, productId, productType, transactionId, metadata) {
    // Check for duplicate transaction
    const { data: existing } = await supabase
        .from('coin_transactions')
        .select('id')
        .eq('reference_id', transactionId)
        .limit(1);

    if (existing && existing.length > 0) {
        console.log(`Duplicate transaction skipped: ${transactionId}`);
        return { duplicate: true, message: "Transaction already processed" };
    }

    // Route by product type
    if (productId === 'com.fitgotchi.subscription.monthly') {
        // Activate subscription
        const { error } = await supabase
            .from('users')
            .update({
                subscription_status: 'active',
                subscription_plan: 'monthly'
            })
            .eq('id', userId);

        if (error) throw new Error("Failed to activate subscription: " + error.message);
        return { type: 'subscription', status: 'active' };
    }

    if (productId.startsWith('com.fitgotchi.coins.')) {
        // Credit coins
        const coinAmounts = {
            'com.fitgotchi.coins.starter': 500,
            'com.fitgotchi.coins.popular': 1200,
            'com.fitgotchi.coins.pro': 2800,
            'com.fitgotchi.coins.ultimate': 8000
        };
        const coins = coinAmounts[productId];
        if (!coins) throw new Error("Unknown coin product: " + productId);

        const { data, error } = await supabase.rpc('credit_coins', {
            user_uuid: userId,
            coin_amount: coins,
            txn_type: 'pack_purchase',
            txn_description: `Purchased ${coins} coins (${productId.split('.').pop()} pack via app store)`,
            txn_reference: transactionId
        });

        if (error) throw new Error("Failed to credit coins: " + error.message);
        return { type: 'coins', amount: coins, newBalance: data };
    }

    if (productId === 'com.fitgotchi.challenge.pass') {
        // Activate challenge pass
        const { error } = await supabase
            .from('users')
            .update({
                has_challenge_pass: true,
                challenge_pass_purchased_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (error) throw new Error("Failed to activate challenge pass: " + error.message);
        return { type: 'challenge_pass', status: 'active' };
    }

    if (productId === 'com.fitgotchi.challenge.entry') {
        // Activate challenge entry
        const challengeId = metadata?.challengeId;
        if (challengeId) {
            const { error } = await supabase
                .from('challenge_participants')
                .update({
                    has_paid: true,
                    paid_at: new Date().toISOString(),
                    stripe_payment_id: transactionId // reusing field for IAP tx
                })
                .eq('challenge_id', challengeId)
                .eq('user_id', userId);

            if (error) throw new Error("Failed to activate challenge entry: " + error.message);
        }
        return { type: 'challenge_entry', status: 'paid' };
    }

    if (productId.startsWith('com.fitgotchi.mealplan.')) {
        // Grant meal plan access
        const slugMap = {
            'com.fitgotchi.mealplan.summershred': 'summer-shred',
            'com.fitgotchi.mealplan.cleanbulk': 'clean-bulk',
            'com.fitgotchi.mealplan.energyboost': 'energy-boost',
            'com.fitgotchi.mealplan.gutreset': 'gut-reset',
            'com.fitgotchi.mealplan.quickeasy': 'quick-easy'
        };
        const planSlug = slugMap[productId];

        // Look up the meal plan ID
        const { data: planData } = await supabase
            .from('meal_plans')
            .select('id')
            .eq('slug', planSlug)
            .limit(1)
            .single();

        if (planData) {
            const { error } = await supabase
                .from('meal_plan_purchases')
                .insert({
                    user_id: userId,
                    meal_plan_id: planData.id,
                    stripe_payment_intent_id: transactionId,
                    amount_cents: 999,
                    currency: 'aud',
                    status: 'completed',
                    purchase_date: new Date().toISOString(),
                    source: 'store'
                });

            if (error) throw new Error("Failed to grant meal plan: " + error.message);
        }
        return { type: 'meal_plan', planSlug, status: 'purchased' };
    }

    return { type: 'unknown', productId };
}

export const config = {
    path: "/api/validate-iap-receipt"
};
