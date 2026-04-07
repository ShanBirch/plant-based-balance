import Stripe from "stripe";

export default async (request, context) => {
    if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const body = await request.json();
        const { userId, email, challengeId } = body;

        if (!userId || !email || !challengeId) {
            return new Response(JSON.stringify({ error: { message: "Missing userId, email, or challengeId" } }), {
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

        // Challenge Buy-In - $9.99 AUD entry fee
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            customer_email: email,
            line_items: [{
                price_data: {
                    currency: 'aud',
                    product_data: {
                        name: 'Challenge Entry',
                        description: '30-day challenge entry. Earn double XP and compete for rare drops!',
                    },
                    unit_amount: 999, // $9.99 AUD
                },
                quantity: 1,
            }],
            success_url: request.headers.get("origin") + '/dashboard.html?challenge_buyin=success&challenge_id=' + challengeId,
            cancel_url: request.headers.get("origin") + '/dashboard.html?challenge_buyin=cancelled',
            metadata: {
                user_id: userId,
                challenge_id: challengeId,
                product_type: 'challenge_buyin'
            }
        });

        return new Response(JSON.stringify({ sessionId: session.id }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error("Challenge Buy-In Checkout Error:", error.message);
        return new Response(JSON.stringify({ error: { message: error.message } }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
    }
};
