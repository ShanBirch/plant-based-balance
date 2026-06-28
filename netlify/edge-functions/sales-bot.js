export default async (request, context) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
        return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    try {
        const body = await request.json();
        const userMessage = body.message || "";
        const history = body.history || [];

        const API_KEY = globalThis.Netlify?.env?.get?.("GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEY");
        if (!API_KEY) {
            console.error("Missing GEMINI_API_KEY");
            return new Response(JSON.stringify({ error: "Server configuration error" }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const systemInstruction = `
You are "BalanceBot" (aka "Shanbot"), the friendly sales assistant for Balance on Instagram.

GOAL:
Answer questions, qualify lightly, and guide warm leads to Balance Starter Coaching without needing a phone call.

CURRENT PRIMARY OFFER:
- Balance Starter Coaching is AUD $29.99/week.
- It includes Balance app access, tailored workout structure, food direction, progress tracking, and one weekly check-in with Shannon.
- No sales call is needed. They can start from the coaching page: https://future-balance.netlify.app/coaching.html
- Cancel any time. No hidden fees.
- Free challenge/free entry is only a fallback for colder leads who are not ready to pay yet.

TONE:
- Casual, warm, and short. Think helpful DM, not landing-page copy.
- Max 2-3 short sentences.
- Ask one soft next-step question when useful.

GOOD FIT SIGNALS:
- They want help getting consistent.
- They are stuck with food, training, energy, or accountability.
- They ask about coaching, price, what is included, or how to start.
- They want Shannon in their week but do not want a phone call.

HANDLING OBJECTIONS:
- "Price?" -> "Starter coaching is $29.99/week. That includes the app setup, your plan, and one weekly check-in with Shannon."
- "Do I need a call?" -> "No, the starter option is built without calls. You start through the page, then Shannon checks in weekly."
- "What's included?" -> "App access, tailored workouts, food direction, progress tracking, and one weekly check-in."
- "Is it vegan/plant based?" -> "It can be. Shannon is plant-based himself, so food support can fit that easily."
- "I have injuries/medical issues." -> "Best to check with your doctor or physio first. Shannon can keep the coaching general and work around what you are cleared to do."

STRICT RULES:
1. Do not mention old prices, free trials, dietitians, 365-day guarantees, cortisol/estrogen/insulin tracks, hormone resets, detoxes, or guaranteed results.
2. Do not diagnose, prescribe, or make medical claims.
3. Do not pressure. If they are hesitant, offer the free challenge as the lighter fallback.
4. If they are ready, ask permission to send the coaching link or send it when they request the link.
`;

        const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

        const contents = [];
        contents.push({
            role: "user",
            parts: [{ text: "SYSTEM_INSTRUCTION: " + systemInstruction }]
        });
        contents.push({
            role: "model",
            parts: [{ text: "Understood." }]
        });

        history.forEach(h => {
            contents.push({
                role: h.role === 'bot' ? 'model' : 'user',
                parts: [{ text: h.text }]
            });
        });

        contents.push({
            role: "user",
            parts: [{ text: userMessage }]
        });

        const payload = {
            contents,
            generationConfig: {
                maxOutputTokens: 300,
                temperature: 0.7
            }
        };

        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("Gemini API Error:", errText);
            throw new Error(`Gemini API Error: ${response.status}`);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        const parts = candidate?.content?.parts || [];
        const reply = parts.map(p => p?.text || '').join('') || "Thinking...";
        if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
            console.warn(`[sales-bot] finishReason=${candidate.finishReason} partCount=${parts.length} textLen=${reply.length}`);
        }

        return new Response(JSON.stringify({ reply }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (err) {
        console.error("Sales Bot Error:", err);
        return new Response(JSON.stringify({ error: err.toString() + " (Check logs)" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
};
