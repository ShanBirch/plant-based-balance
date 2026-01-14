
import { Context } from "@netlify/edge-functions";

export default async function (request: Request, context: Context) {
  // Only accept POST
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { message, mode, contextData, memberPersona } = await request.json();
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
      systemPrompt = `You are Shannon, a warm, empathetic, and knowledgeable plant-based nutrition coach. 
      You are coaching a client through a hormone-balancing reset program (Plant-Based Balance).
      
      Client Context:
      - Name: ${contextData?.name || "Client"}
      - Profile: ${contextData?.profile || "General"}
      - Sleep: ${contextData?.sleep || "Unknown"}
      - Energy: ${contextData?.energy || "Unknown"}
      
      Guidelines:
      - Be concise (max 3-4 sentences).
      - Be encouraging but realistic.
      - Use "we" language.
      - Refer to their specific context if relevant (e.g., if they are tired, mention sleep).
      - Do NOT sound like a robot. Be human, conversational, and caring.
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

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
    
    const payload = {
      contents: [
        {
          parts: [
            {
              text: `${systemPrompt}\n\nUser Message: ${message}\n\nResponse:`
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
    // Return 500 so frontend can silently fail
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
