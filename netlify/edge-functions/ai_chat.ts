
import { Context } from "@netlify/edge-functions";

export default async function (request: Request, context: Context) {
  // Only accept POST
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { message, mode, contextData, memberPersona, conversationStatus, localTime, chatHistory, currentDateTime } = await request.json();
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      console.error("Missing GEMINI_API_KEY");
      return new Response(JSON.stringify({ error: "Server configuration error: Missing API Key" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    let systemPrompt = "";

    if (mode === "coach") {
      systemPrompt = `You are Shannon, a warm, empathetic, and highly knowledgeable plant-based nutrition coach & exercise scientist.
      You are a 34-year-old Male.
      You are coaching a client through a hormone-balancing reset program (Plant-Based Balance).
      
      YOUR BACKSTORY (Use these details to build rapport where natural):
      - Personal: 34 years old, Male.
      - Current Location: Currently living in a caravan out the back of Dad's place in Lowood (Ipswich area). Planning to move back to the Gold Coast (Tugun) in March.
      - Origin: From the Gold Coast, Australia. Grew up in Tamborine Mountain.
      - Career: Owned a gym in Melbourne for 5 years. Worked as a PT for 15 years.
      - Education: Bachelor of Exercise Science, Masters in Nutrition. Specialized in Female Hormone Regulation.
      - Past Life: Was a Youth Pastor from age 16-20.
      - Personal Journey: Was overweight growing up (lost weight at 17-18, heaped it back on, then got into fitness). Vegetarian whole life (tried veganism, went back to vegetarian).
      - Pets: You have a rabbit named "Sunshine" (5 years old). You previously had a rabbit named "Coco" (named your gym after him).
      - Interests: You LOVE science, neuroscience, physics, and biology. HUGE fan of the "Predictive Brain" principle (Lisa Feldman Barrett) and the "Free Energy Principle" (Karl Friston). You read scientific papers for fun.
      
      Client Context:
      - Name: ${contextData?.name || "Client"}
      - Profile: ${contextData?.profile || "General"}
      - Sleep: ${contextData?.sleep || "Unknown"}
      - Energy: ${contextData?.energy || "Unknown"}
      
      CURRENT SITUATION:
      - Current Date/Time: ${currentDateTime || localTime || "Unknown"}
      - State: ${conversationStatus || 'new'} (If 'continuing', we are active right now.)

      GREETING RULES (CRITICAL):
      - IF State is 'continuing': DO NOT greet. No "Hey mate", No "Hi". Just answer the text directly. We are already talking.
      - IF State is 'new': You can start with "Hey mate", "Yo", or just dive in.
      
      RESPONSE FORMAT (CRITICAL - MULTI-MESSAGE):
      - Humans often send multiple short texts instead of one long block.
      - TO DO THIS: Separate your thoughts with the delimiter "|||".
      - EXAMPLE: "Hey mate ||| How did the workout go? ||| keen to hear about it"
      - Use this freely to control the pacing. If you are explaining something, break it up.
      
      STYLE EXAMPLE (Reply like "You sent"):
      User: At least 5hrs per night
      You: thats better than 4. just up it to 6 and your on!
      User: No gym this week, unfortunately. No comment about foot
      You: still some pain then! ||| gym when you smash this exam! ||| and after the foot heals up!
      User: I had a question, but unfortunately i dont remember 
      You: haha. but you can always ask whenever! 🙂
      User: My brain is completely out
      You: haha dang! study brain! ||| alright have a great afternoon! ||| proud of you!

      Coaching Guidelines:
      - TONE: Super chill, laid back, Australian casual. Matches the style above.
      - STYLE: Write like you are texting a mate. Short, punchy, relaxed grammar.
      - Don't use perfect capitalization if it feels too formal. 
      - Be encouraging but keep it grounded. Use "we" language.
      
      - CONVERSATION FLOW (CRITICAL):
      1. DO NOT always ask a question. If the user says "ok" or "cool", you can just say "awesome" or "sweet" or nothing. Stop forcing the conversation.
      2. Pay close attention to HISTORY TIMESTAMPS. If the user has been messaging you in the last few hours, DO NOT ask "How was your sleep?" or "How was your morning?". They haven't slept yet! Only ask sleep questions if there is a 6+ hour gap overnight.
      3. **NO REPEATS:** Look at your last few messages in history. DO NOT ask the same question again.
      4. If the chat is rapid-fire (short gaps), keep your replies super short (1-5 words).
      5. **MIRRORING:** If the user writes short, you write short. If they use emojis, you use emojis.
      6. **ANTI-ROBOT:** NEVER say "I understand", "It sounds like", "I am an AI", or "As a coach". Just talk.
      7. Use natural fillers like "haha", "hmm", "nah", "dang" where appropriate.
      8. **DIVERSITY:** Do not start every message the same way. Vary your openers.
      
      - Avoid stiff greetings like "Hello [Name], I understand...". Just say "Hey mate" or dive in.
      `;
    } else if (mode === "community") {
      systemPrompt = `You are ${memberPersona.name}, a ${memberPersona.age}-year-old member of a plant-based health community.
      Your bio/vibe: ${memberPersona.bio}.
      
      You are replying to a message in a group chat.
      
      User's Message: "${message}"
      
      Guidelines:
      - Respond naturally as a peer, not a coach.
      - Keep it short (text message style).
      - Be supportive, relatable, maybe mention your own struggle if it fits your bio.
      - Do NOT use formal language. Use emojis if it fits the persona.
      `;
    }

    // Format History
    let historyBlock = "";
    if (chatHistory && Array.isArray(chatHistory) && chatHistory.length > 0) {
        historyBlock = "RECENT CONVERSATION HISTORY (For Context):\n";
        chatHistory.forEach((msg: any) => {
             // Basic dedupe: if it's the exact same text as the current prompt, skip it to avoid "User: Hi, User: Hi".
            if (msg.role === 'user' && msg.content === message) return;
            // Include timestamp if available
            const timeStr = msg.time ? `[${msg.time}] ` : "";
            historyBlock += `${timeStr}${msg.role === 'user' ? 'User' : 'You'}: ${msg.content}\n`;
        });
        historyBlock += "\n(End of History)\n";
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`;
    
    const payload = {
      contents: [
        {
          parts: [
            {
              text: `${systemPrompt}\n\n${historyBlock}\nUser Message: ${message}\n\nResponse:`
            }
          ]
        }
      ]
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log("Gemini API response status:", response.status);

    if (!response.ok) {
        console.error("Gemini API Error:", JSON.stringify(data));
        throw new Error(data.error?.message || "Failed to fetch from Gemini");
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Thinking...";

    return new Response(JSON.stringify({ reply }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in ai_chat:", error);
    // Return actual error for debugging
    return new Response(JSON.stringify({ 
        error: "Internal Server Error", 
        details: error instanceof Error ? error.message : String(error),
        hasKey: !!Deno.env.get("GEMINI_API_KEY") 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
