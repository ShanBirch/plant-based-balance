import Stripe from "stripe";

export default async (request, context) => {
    if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const body = await request.json();
        const { userId, email } = body;

        if (!userId || !email) {
            return new Response(JSON.stringify({ error: { message: "Missing userId or email" } }), {
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

        // Challenge Pass - one-time payment of $9.99 AUD
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            customer_email: email,
            line_items: [{
                price_data: {
                    currency: 'aud',
                    product_data: {
                        name: 'Challenge Pass',
                        description: 'Unlock challenges with 2x XP boost! Earn points twice as fast in all challenges.',
                    },
                    unit_amount: 999, // $9.99 AUD
                },
                quantity: 1,
            }],
            success_url: request.headers.get("origin") + '/dashboard.html?challenge_pass=success',
            cancel_url: request.headers.get("origin") + '/dashboard.html?challenge_pass=cancelled',
            metadata: {
                user_id: userId,
                product_type: 'challenge_pass'
            }
        });

        return new Response(JSON.stringify({ sessionId: session.id }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error("Challenge Pass Checkout Error:", error.message);
        return new Response(JSON.stringify({ error: { message: error.message } }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
    }
};
