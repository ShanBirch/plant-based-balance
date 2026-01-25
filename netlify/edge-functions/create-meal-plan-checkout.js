import Stripe from "https://esm.sh/stripe?target=deno";

/**
 * Create a Stripe checkout session for one-time meal plan purchases
 *
 * POST /api/create-meal-plan-checkout
 * Body: {
 *   planSlug: string,      // e.g., "summer-shred"
 *   email?: string,        // Customer email (optional)
 *   preferences: {         // User's dietary preferences
 *     diet: string,        // vegan, vegetarian, pescatarian, omnivore
 *     allergies: string[], // gluten, dairy, nuts, etc.
 *     cookingTime: string  // quick, moderate, any
 *   }
 * }
 */

// Meal plan price IDs (create these in Stripe Dashboard)
// TODO: Replace with actual Stripe price IDs after creating them
const MEAL_PLAN_PRICES = {
    'summer-shred': 'price_meal_plan_summer_shred',
    'clean-bulk': 'price_meal_plan_clean_bulk',
    'energy-boost': 'price_meal_plan_energy_boost',
    'gut-reset': 'price_meal_plan_gut_reset',
    'quick-easy': 'price_meal_plan_quick_easy',
    // Fallback/default price for any plan
    'default': 'price_meal_plan_default'
};

// Plan metadata for Stripe
const MEAL_PLAN_INFO = {
    'summer-shred': {
        name: 'Summer Shred 28-Day',
        description: 'High-protein meal plan for fat loss and muscle retention',
        images: ['https://plantbasedbalance.com/assets/summer_shred_plan.png']
    },
    'clean-bulk': {
        name: 'Clean Bulk Protocol',
        description: 'Muscle-building meal plan with quality whole foods',
        images: ['https://plantbasedbalance.com/assets/clean_bulk_plan.png']
    },
    'energy-boost': {
        name: 'Energy Boost 28-Day',
        description: 'Meals designed for sustained energy throughout the day',
        images: ['https://plantbasedbalance.com/assets/energy_boost_plan.png']
    },
    'gut-reset': {
        name: 'Gut Reset Protocol',
        description: 'Healing meal plan focused on digestive health',
        images: ['https://plantbasedbalance.com/assets/gut_reset_plan.png']
    },
    'quick-easy': {
        name: 'Quick & Easy Meals',
        description: 'Healthy meals in 20 minutes or less',
        images: ['https://plantbasedbalance.com/assets/quick_easy_plan.png']
    }
};

export default async (request, context) => {
    // Only allow POST
    if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
            status: 405,
            headers: { "Content-Type": "application/json" }
        });
    }

    // CORS headers
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json"
    };

    // Handle preflight
    if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const body = await request.json();
        const { planSlug, email, preferences, userId } = body;

        // Validate required fields
        if (!planSlug) {
            return new Response(JSON.stringify({
                error: { message: "Missing required field: planSlug" }
            }), { status: 400, headers: corsHeaders });
        }

        // Get Stripe key
        const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
        if (!STRIPE_SECRET_KEY) {
            console.error("Missing STRIPE_SECRET_KEY");
            return new Response(JSON.stringify({
                error: { message: "Server configuration error" }
            }), { status: 500, headers: corsHeaders });
        }

        // Initialize Stripe
        const stripe = new Stripe(STRIPE_SECRET_KEY, {
            httpClient: Stripe.createFetchHttpClient(),
            apiVersion: "2023-10-16",
        });

        // Get price ID for this plan
        const priceId = MEAL_PLAN_PRICES[planSlug] || MEAL_PLAN_PRICES['default'];
        const planInfo = MEAL_PLAN_INFO[planSlug] || {
            name: 'Meal Plan',
            description: '28-day personalized meal plan'
        };

        // Build line items
        const lineItems = [{
            price: priceId,
            quantity: 1
        }];

        // Origin for redirect URLs
        const origin = request.headers.get("origin") || "https://plantbasedbalance.com";

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            mode: 'payment', // One-time payment, not subscription
            customer_email: email || undefined,
            line_items: lineItems,
            success_url: `${origin}/meal-plan-success.html?session_id={CHECKOUT_SESSION_ID}&plan=${planSlug}`,
            cancel_url: `${origin}/dashboard.html#meals`,
            metadata: {
                // Store preferences and plan info for webhook processing
                plan_slug: planSlug,
                user_id: userId || '',
                purchase_type: 'meal_plan',
                diet_type: preferences?.diet || '',
                allergies: preferences?.allergies?.join(',') || '',
                cooking_time: preferences?.cookingTime || ''
            },
            // Custom fields to collect additional info if needed
            custom_fields: [],
            // Payment intent data
            payment_intent_data: {
                metadata: {
                    plan_slug: planSlug,
                    purchase_type: 'meal_plan'
                }
            }
        });

        console.log(`Created meal plan checkout session: ${session.id} for plan: ${planSlug}`);

        return new Response(JSON.stringify({
            sessionId: session.id,
            url: session.url
        }), { headers: corsHeaders });

    } catch (error) {
        console.error("Meal plan checkout error:", error.message);
        return new Response(JSON.stringify({
            error: { message: error.message }
        }), { status: 400, headers: corsHeaders });
    }
};

export const config = {
    path: "/api/create-meal-plan-checkout"
};
