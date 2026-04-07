import Stripe from "stripe";

const COIN_PACKS = {
    small:    { coins: 2500,  price: 2499,  name: 'Small Pack',    description: '2,500 FitCoins' },
    medium:   { coins: 5500,  price: 4999,  name: 'Medium Pack',   description: '5,500 FitCoins (+10% bonus)' },
    large:    { coins: 12000, price: 9999,  name: 'Large Pack',    description: '12,000 FitCoins (+20% bonus)' },
    xl:       { coins: 32500, price: 24999, name: 'XL Pack',       description: '32,500 FitCoins (+30% bonus)' },
    ultimate: { coins: 70000, price: 49999, name: 'Ultimate Pack', description: '70,000 FitCoins (+40% bonus)' },
};

export default async (request, context) => {
    if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const body = await request.json();
        const { userId, email, packId } = body;

        if (!userId || !email || !packId) {
            return new Response(JSON.stringify({ error: { message: "Missing userId, email, or packId" } }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        const pack = COIN_PACKS[packId];
        if (!pack) {
            return new Response(JSON.stringify({ error: { message: "Invalid pack ID" } }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
        if (!STRIPE_SECRET_KEY) throw new Error("Missing Internal Configuration");

        const stripe = new Stripe(STRIPE_SECRET_KEY, {
            httpClient: Stripe.createFetchHttpClient(),
            apiVersion: "2023-10-16",
        });

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            customer_email: email,
            line_items: [{
                price_data: {
                    currency: 'aud',
                    product_data: {
                        name: pack.name,
                        description: pack.description,
                    },
                    unit_amount: pack.price,
                },
                quantity: 1,
            }],
            success_url: request.headers.get("origin") + '/dashboard.html?coin_purchase=success&pack=' + packId,
            cancel_url: request.headers.get("origin") + '/dashboard.html?coin_purchase=cancelled',
            metadata: {
                user_id: userId,
                product_type: 'coin_pack',
                pack_id: packId,
                coin_amount: pack.coins.toString()
            }
        });

        return new Response(JSON.stringify({ sessionId: session.id }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error("Coin Pack Checkout Error:", error.message);
        return new Response(JSON.stringify({ error: { message: error.message } }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
    }
};
