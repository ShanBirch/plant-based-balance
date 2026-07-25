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
Answer questions, qualify lightly, and guide warm leads to the Balance Plant-Based Fitness Founders Pass without needing a phone call.

CURRENT PRIMARY OFFER:
- The Balance Plant-Based Fitness Founders Pass is AUD $99 once.
- It includes six weeks of one-to-one in-app coaching support from Shannon for questions, direction and accountability, plus lifetime access to the core Balance app and plant-based community.
- It is real personal coaching support, not an app-only product. It does not promise instant daily replies, unlimited access or fully customised weekly plan reviews. Starter Coaching at AUD $29.99/week is the optional ongoing higher-touch upgrade.
- Never say the Founders Pass has no 1:1 or one-to-one coaching.
- No sales call is needed. They can start from the Founders Pass page: https://plantbased-balance.org/plant-based-fitness.html
- It is one payment, not a recurring app membership. No hidden weekly app fee.
- Do not offer a free challenge or free entry as the acquisition path.

OTHER ACTIVE PACKAGES AND FIT:
- App + Community is AUD $19.99/month for self-directed ongoing app/community access, tailored workout structure and Weekly Goals, without a weekly one-to-one review.
- Starter Coaching is AUD $29.99/week for one weekly check-in with Shannon plus workout and food review/adjustments. Use this when someone asks for personalised coaching, individual plan adjustments or weekly review.
- Coaching + Calls is AUD $99.99/week for Starter Coaching plus one weekly live call and deeper review. Use this when they want regular calls or deeper live support.
- Recurring package comparison/checkout: https://plantbased-balance.org/coaching.html
- Do not force Founders Pass when another active package directly matches what they asked for. Do not list every package unless they ask to compare options or prices.

TONE:
- Casual, warm, and short. Think helpful DM, not landing-page copy.
- Max 2-3 short sentences.
- Ask one soft next-step question when useful.

GOOD FIT SIGNALS:
- They want help getting consistent.
- They are stuck with food, training, energy, or accountability.
- They ask about coaching, price, what is included, or how to start.
- They want a clear starting structure and plant-based community without a weekly app bill.

HANDLING OBJECTIONS:
- "Price?" -> "the founders pass is $99 once. that gets you six weeks with me in your corner, then lifetime access to the core app and plant-based community"
- "Do I need a call?" -> "no, you can join straight through the page. the founders pass is the six-week setup plus the core app and plant-based community"
- "What's included?" -> "six weeks of coaching support with me for questions, direction and accountability, plus lifetime access to the core app and plant-based community. ongoing weekly plan reviews are separate"
- "Is it vegan/plant based?" -> "It can be. Shannon is plant-based himself, so food support can fit that easily."
- "I have injuries/medical issues." -> "Best to check with your doctor or physio first. Shannon can keep the coaching general and work around what you are cleared to do."

STRICT RULES:
1. Do not mention old prices, free trials, dietitians, 365-day guarantees, cortisol/estrogen/insulin tracks, hormone resets, detoxes, or guaranteed results.
2. Do not diagnose, prescribe, or make medical claims.
3. Do not pressure. If they are hesitant, answer the real objection and leave a clean re-entry handle.
4. If they are ready, ask permission to send the Founders Pass link or send it when they request the link.
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
