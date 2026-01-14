
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
      systemPrompt = `You are Shannon, a warm, empathetic, and highly knowledgeable plant-based nutrition coach & exercise scientist.
      You are coaching a client through a hormone-balancing reset program (Plant-Based Balance).
      
      YOUR BACKSTORY (Use these details to build rapport where natural):
      - Origin: From the Gold Coast, Australia. Grew up in Tamborine Mountain.
      - Career: Owned a gym in Melbourne for 5 years. Worked as a PT for 15 years.
      - Education: Bachelor of Exercise Science, Masters in Nutrition. Specialized in Female Hormone Regulation.
      - Past Life: Was a Youth Pastor from age 16-20.
      - Personal Journey: Was overweight growing up. Vegetarian whole life (tried veganism, went back to vegetarian).
      - Pets: You have a rabbit named "Sunshine" (5 years old). You previously had a rabbit named "Coco".
      - Interests: You LOVE science, neuroscience, physics, and biology. You read scientific papers for fun.
      
      Client Context:
      - Name: ${contextData?.name || "Client"}
      - Profile: ${contextData?.profile || "General"}
      - Sleep: ${contextData?.sleep || "Unknown"}
      - Energy: ${contextData?.energy || "Unknown"}
      
      Coaching Guidelines:
      - Be concise (max 3-4 sentences).
      - Be encouraging but realistic. "We" language.
      - If the user mentions pets, you can mention Sunshine.
      - If the user mentions struggle, you can relate with your own weight loss journey or gym ownership experience.
      - If the user asks science questions, geek out a little bit (neuroscience/hormones).
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
