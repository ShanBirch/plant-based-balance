import Stripe from "stripe";

const COIN_PACKS = {
    starter:  { coins: 500,  price: 499,  name: 'Starter Pack',  description: '500 Coins' },
    popular:  { coins: 1200, price: 999,  name: 'Popular Pack',  description: '1,200 Coins (+20% bonus)' },
    pro:      { coins: 2800, price: 1999, name: 'Pro Pack',      description: '2,800 Coins (+40% bonus)' },
    ultimate: { coins: 8000, price: 4999, name: 'Ultimate Pack',  description: '8,000 Coins (+60% bonus)' },
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
