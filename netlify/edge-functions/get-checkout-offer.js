import { getPublicCheckoutOffer } from "./lib/checkout-guard.js";

export default async (request) => {
    if (request.method !== "GET") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const url = new URL(request.url);
        const offer = getPublicCheckoutOffer(url.searchParams.get("priceId"));
        return new Response(JSON.stringify({ offer }), {
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=60, s-maxage=300",
            },
        });
    } catch (_) {
        return new Response(JSON.stringify({ error: "Offer unavailable." }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
        });
    }
};
