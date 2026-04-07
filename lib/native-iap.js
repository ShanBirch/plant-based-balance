// native-iap.js - In-App Purchase abstraction layer
// Routes purchases to native IAP (App Store / Play Store) or Stripe (web)

const IAP_PRODUCTS = {
    // Subscription
    subscription_monthly: {
        id: 'com.fitgotchi.subscription.monthly',
        type: 'subscription',
        title: 'FitGotchi Monthly',
        priceAUD: 30.00
    },
    // Coin packs (consumable)
    coins_starter: {
        id: 'com.fitgotchi.coins.starter',
        type: 'consumable',
        title: '500 Coins - Starter Pack',
        coins: 500,
        priceAUD: 4.99,
        stripePackId: 'starter'
    },
    coins_popular: {
        id: 'com.fitgotchi.coins.popular',
        type: 'consumable',
        title: '1,200 Coins - Popular Pack',
        coins: 1200,
        priceAUD: 9.99,
        stripePackId: 'popular'
    },
    coins_pro: {
        id: 'com.fitgotchi.coins.pro',
        type: 'consumable',
        title: '2,800 Coins - Pro Pack',
        coins: 2800,
        priceAUD: 19.99,
        stripePackId: 'pro'
    },
    coins_ultimate: {
        id: 'com.fitgotchi.coins.ultimate',
        type: 'consumable',
        title: '8,000 Coins - Ultimate Pack',
        coins: 8000,
        priceAUD: 49.99,
        stripePackId: 'ultimate'
    },
    // One-time purchases (non-consumable)
    challenge_pass: {
        id: 'com.fitgotchi.challenge.pass',
        type: 'non_consumable',
        title: 'Challenge Pass - 2x XP',
        priceAUD: 9.99
    },
    challenge_entry: {
        id: 'com.fitgotchi.challenge.entry',
        type: 'consumable',
        title: 'Challenge Entry',
        priceAUD: 9.99
    },
    // Meal plans (non-consumable)
    meal_plan_summer_shred: { id: 'com.fitgotchi.mealplan.summershred', type: 'non_consumable', title: 'Summer Shred 28-Day', priceAUD: 9.99 },
    meal_plan_clean_bulk: { id: 'com.fitgotchi.mealplan.cleanbulk', type: 'non_consumable', title: 'Clean Bulk Protocol', priceAUD: 9.99 },
    meal_plan_energy_boost: { id: 'com.fitgotchi.mealplan.energyboost', type: 'non_consumable', title: 'Energy Boost 28-Day', priceAUD: 9.99 },
    meal_plan_gut_reset: { id: 'com.fitgotchi.mealplan.gutreset', type: 'non_consumable', title: 'Gut Reset Protocol', priceAUD: 9.99 },
    meal_plan_quick_easy: { id: 'com.fitgotchi.mealplan.quickeasy', type: 'non_consumable', title: 'Quick & Easy Meals', priceAUD: 9.99 }
};

// Map coin pack IDs to IAP product keys
const COIN_PACK_MAP = {
    starter: 'coins_starter',
    popular: 'coins_popular',
    pro: 'coins_pro',
    ultimate: 'coins_ultimate'
};

// Map meal plan slugs to IAP product keys
const MEAL_PLAN_MAP = {
    'summer-shred': 'meal_plan_summer_shred',
    'clean-bulk': 'meal_plan_clean_bulk',
    'energy-boost': 'meal_plan_energy_boost',
    'gut-reset': 'meal_plan_gut_reset',
    'quick-easy': 'meal_plan_quick_easy'
};

const NativeIAP = {
    _initialized: false,
    _plugin: null,

    // Get the Capacitor plugin (injected by native shell)
    _getPlugin() {
        if (this._plugin) return this._plugin;
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.FitGotchiIAP) {
            this._plugin = window.Capacitor.Plugins.FitGotchiIAP;
            return this._plugin;
        }
        return null;
    },

    // Initialize the store and register products
    async initialize() {
        if (this._initialized) return true;

        const plugin = this._getPlugin();
        if (!plugin) {
            console.warn('[IAP] Native IAP plugin not available');
            return false;
        }

        try {
            const productIds = Object.values(IAP_PRODUCTS).map(p => ({
                id: p.id,
                type: p.type
            }));
            await plugin.initialize({ products: productIds });
            this._initialized = true;
            console.log('[IAP] Native IAP initialized with', productIds.length, 'products');
            return true;
        } catch (err) {
            console.error('[IAP] Failed to initialize:', err);
            return false;
        }
    },

    // Purchase a product by its IAP product key
    async purchase(productKey, metadata) {
        const product = IAP_PRODUCTS[productKey];
        if (!product) {
            throw new Error('Unknown product: ' + productKey);
        }

        const plugin = this._getPlugin();
        if (!plugin) {
            throw new Error('Native IAP not available');
        }

        if (!this._initialized) {
            await this.initialize();
        }

        try {
            const result = await plugin.purchase({
                productId: product.id,
                type: product.type,
                metadata: JSON.stringify(metadata || {})
            });

            // Validate receipt on server
            if (result && result.receipt) {
                const validation = await this._validateReceipt(
                    result.receipt,
                    product,
                    metadata
                );
                return validation;
            }

            return result;
        } catch (err) {
            if (err.code === 'CANCELLED' || err.message?.includes('cancel')) {
                console.log('[IAP] Purchase cancelled by user');
                return { cancelled: true };
            }
            throw err;
        }
    },

    // Server-side receipt validation
    async _validateReceipt(receipt, product, metadata) {
        const provider = window.Platform.isIOS() ? 'apple' : 'google';
        const userId = window.currentUser?.id || localStorage.getItem('user_id');

        const response = await fetch('/api/validate-iap-receipt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                receipt: receipt,
                productId: product.id,
                productType: product.type,
                provider: provider,
                userId: userId,
                metadata: metadata || {}
            })
        });

        const data = await response.json();
        if (!response.ok || data.error) {
            throw new Error(data.error?.message || 'Receipt validation failed');
        }

        return data;
    },

    // Restore previous purchases (required by Apple)
    async restorePurchases() {
        const plugin = this._getPlugin();
        if (!plugin) {
            throw new Error('Native IAP not available');
        }

        try {
            const result = await plugin.restorePurchases();
            if (result && result.purchases && result.purchases.length > 0) {
                // Validate each restored purchase
                for (const purchase of result.purchases) {
                    await this._validateReceipt(
                        purchase.receipt,
                        { id: purchase.productId, type: purchase.type },
                        { restored: true }
                    );
                }
            }
            return result;
        } catch (err) {
            console.error('[IAP] Restore failed:', err);
            throw err;
        }
    },

    // Get product info (localized price from the store)
    async getProductInfo(productKey) {
        const product = IAP_PRODUCTS[productKey];
        if (!product) return null;

        const plugin = this._getPlugin();
        if (!plugin) return null;

        try {
            const info = await plugin.getProductInfo({ productId: product.id });
            return info;
        } catch (err) {
            console.error('[IAP] Failed to get product info:', err);
            return null;
        }
    }
};

// High-level purchase functions that auto-route by platform

/**
 * Purchase a subscription - routes to IAP or Stripe based on platform
 */
async function purchaseSubscription() {
    if (window.Platform.isWeb()) {
        // Web: use existing Stripe checkout
        return null; // Let the existing Stripe flow handle it
    }

    // Native: use IAP
    const userId = window.currentUser?.id;
    const email = window.currentUser?.email;
    const result = await NativeIAP.purchase('subscription_monthly', { userId, email });
    if (result && !result.cancelled) {
        showToast('Subscription activated!', 'success');
        // Reload to reflect new subscription status
        setTimeout(() => location.reload(), 1500);
    }
    return result;
}

/**
 * Purchase coin pack - routes to IAP or Stripe
 */
async function purchaseCoinPack(packId) {
    if (window.Platform.isWeb()) {
        return null; // Let existing Stripe flow handle it
    }

    const productKey = COIN_PACK_MAP[packId];
    if (!productKey) throw new Error('Unknown coin pack: ' + packId);

    const product = IAP_PRODUCTS[productKey];
    const userId = window.currentUser?.id;
    const email = window.currentUser?.email;

    const result = await NativeIAP.purchase(productKey, {
        userId,
        email,
        packId,
        coins: product.coins
    });

    if (result && !result.cancelled) {
        showToast(product.coins + ' coins added!', 'success');
        // Refresh coin balance
        if (typeof loadCoinBalance === 'function') loadCoinBalance();
    }
    return result;
}

/**
 * Purchase challenge pass - routes to IAP or Stripe
 */
async function purchaseChallengePass() {
    if (window.Platform.isWeb()) {
        return null; // Let existing Stripe flow handle it
    }

    const userId = window.currentUser?.id;
    const email = window.currentUser?.email;

    const result = await NativeIAP.purchase('challenge_pass', { userId, email });
    if (result && !result.cancelled) {
        showToast('Challenge Pass unlocked! 2x XP active.', 'success');
    }
    return result;
}

/**
 * Purchase challenge entry - routes to IAP or Stripe
 */
async function purchaseChallengeEntry(challengeId) {
    if (window.Platform.isWeb()) {
        return null; // Let existing Stripe flow handle it
    }

    const userId = window.currentUser?.id;
    const email = window.currentUser?.email;

    const result = await NativeIAP.purchase('challenge_entry', {
        userId,
        email,
        challengeId
    });

    if (result && !result.cancelled) {
        showToast('Challenge entry confirmed!', 'success');
    }
    return result;
}

/**
 * Purchase meal plan - routes to IAP or Stripe
 */
async function purchaseMealPlan(planSlug, preferences) {
    if (window.Platform.isWeb()) {
        return null; // Let existing Stripe flow handle it
    }

    const productKey = MEAL_PLAN_MAP[planSlug];
    if (!productKey) throw new Error('Unknown meal plan: ' + planSlug);

    const userId = window.currentUser?.id;
    const email = window.currentUser?.email;

    const result = await NativeIAP.purchase(productKey, {
        userId,
        email,
        planSlug,
        preferences
    });

    if (result && !result.cancelled) {
        showToast('Meal plan unlocked!', 'success');
    }
    return result;
}

// Initialize IAP when on native platforms
if (window.Platform && window.Platform.isNative()) {
    document.addEventListener('DOMContentLoaded', () => {
        NativeIAP.initialize().then(ok => {
            if (ok) console.log('[IAP] Ready for native purchases');
        });
    });
}

window.NativeIAP = NativeIAP;
window.IAP_PRODUCTS = IAP_PRODUCTS;
window.purchaseSubscription = purchaseSubscription;
window.purchaseCoinPack = purchaseCoinPack;
window.purchaseChallengePass = purchaseChallengePass;
window.purchaseChallengeEntry = purchaseChallengeEntry;
window.purchaseMealPlan = purchaseMealPlan;
