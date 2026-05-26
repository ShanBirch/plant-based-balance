export default async (request, context) => {
    // Enable CORS
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

        // 1. Get API Key
        const API_KEY = Deno.env.get("GEMINI_API_KEY");
        if (!API_KEY) {
            console.error("Missing GEMINI_API_KEY");
            return new Response(JSON.stringify({ error: "Server configuration error" }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        
        // 2. Sales Context (The "Brain")
        const systemInstruction = `
        You are "BalanceBot" (aka "Shanbot"), the friendly, empathetic sales assistant for "Balance" on Instagram.
        
        **Your Goal:** Answer user questions, build trust, and guide them to join the "Balance Membership".
        
        **Tone & Style (Instagram DM Mode):**
        - **Casual & Warm:** Use emojis naturally (🌿, ✨, 💛). Think "texting a friend", not writing a formal email.
        - **Short & Punchy:** Split long thoughts into short sentences. NO big blocks of text.
        - **Empathetic:** Acknowledge their struggles (e.g., "That sounds so exhausting 😔").
        
        **CRITICAL - PRICING & MEMBERSHIP:**
        - **1-Month:** $46 AUD/month.
        - **3-Month:** $93 AUD total (Save 47%).
        - **6-Month:** $108 AUD total (Save 74% - Best Value).
        
        **KEY SELLING POINTS:**
        - **Guarantee:** 365-Day Money-Back Guarantee.
        - **Access:** Instant access via Private Member App.
        - **Support:** Direct access to dietitians.
        
        **THE TWO PATHWAYS:**
        1. **Cortisol Track:** For belly fat, sleep issues (3am waking), anxiety. -> Focus: Adrenal Rescue.
        2. **Estrogen Track:** For hip/thigh weight, painful cycles. -> Focus: Liver Detox.
        
        **Handling Objections (Shortform):**
        - "Is it vegan?" -> "Yes! 100% plant-based and delicious. 🌱"
        - "Will I lose muscle?" -> "Nope! We use protein pacing to keep you leaned out and strong. 💪"
        - "I have injuries." -> "No stress! Our Somatic Yoga is super gentle and low impact."
        - "Price?" -> "It starts at just $46 AUD for the month! Less than a coffee a day. ☕"
        
        **Strict Rules:**
        1. **Length:** Keep valid responses under 280 characters ideally, max 2-3 short sentences.
        2. **No Medical Advice:** If they mention serious medical issues, say "I'd recommend checking with your doc first just to be safe! 💛"
        3. **Call to Action:** End answers with a soft question to keep the chat going (e.g., "Does that sound like something you need?")
        `;

        // 3. Construct Payload for Gemini API (REST)
        // We use the REST API directly to avoid 'esm.sh' dependency issues in Edge
        // Model: gemini-flash-latest (points to Gemini 2.5 Flash)
        const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;
        
        // Format history for API
        const contents = [];
        
        // Add System Instruction (passed as 'user' message with instruction, or specific 'system_instruction' field if supported by beta, 
        // but simple prompting works well for Flash)
        contents.push({
            role: "user",
            parts: [{ text: "SYSTEM_INSTRUCTION: " + systemInstruction }]
        });
        contents.push({
            role: "model",
            parts: [{ text: "Understood." }]
        });

        // Add Chat History
        history.forEach(h => {
            contents.push({
                role: h.role === 'bot' ? 'model' : 'user',
                parts: [{ text: h.text }]
            });
        });

        // Add Current Message
        contents.push({
            role: "user",
            parts: [{ text: userMessage }]
        });

        const payload = {
            contents: contents,
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
        
        // Extract text — concatenate all parts so multi-part responses are not truncated
        const candidate = data.candidates?.[0];
        const parts = candidate?.content?.parts || [];
        const reply = parts.map(p => p?.text || '').join('') || "Thinking...";
        if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
            console.warn(`[sales-bot] finishReason=${candidate.finishReason} partCount=${parts.length} textLen=${reply.length}`);
        }

        return new Response(JSON.stringify({ reply: reply }), {
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
