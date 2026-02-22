
import type { Context } from "https://edge.netlify.com";

export default async function (request: Request, context: Context) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { message, chatHistory, userData, existingCards } = await request.json();
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing API Key" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!message) {
      return new Response(JSON.stringify({ error: "Missing message" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build user context
    const profile = userData?.profile || {};
    const quiz = userData?.quizResults || {};
    const facts = userData?.facts || {};

    const userContext = `
=== USER PROFILE ===
Name: ${profile.name || 'Unknown'}
Goal: ${quiz.goal_body_type || 'General fitness'}
Activity Level: ${quiz.activity_level || 'Unknown'}
Dietary Preference: ${userData?.dietaryPreference || 'plant-based'}

=== KNOWN FACTS ===
Struggles: ${facts.struggles?.join(', ') || 'None'}
Preferences: ${facts.preferences?.join(', ') || 'None'}
Health Notes: ${facts.health_notes?.join(', ') || 'None'}
Goals: ${facts.goals?.join(', ') || 'None'}

=== EXISTING CUSTOM CARDS ===
${existingCards?.length > 0 ? existingCards.map((c: any) => `- ${c.title} (${c.type})`).join('\n') : 'None yet'}
`;

    const systemPrompt = `You are FITGotchi AI Card Builder — a creative assistant that helps users design custom cards, challenges, trackers, and mini-games for their fitness app.

YOU CAN BUILD THESE CARD TYPES:

1. **tracker** — A daily/weekly tracker card that appears on the dashboard
   - Examples: water intake, supplement tracker, meditation minutes, cold plunge streak, gratitude journal, step counter goal, sleep quality log
   - Fields: title, description, icon (emoji), color (hex gradient start), trackingType (checkbox | counter | timer | rating), goal (number), unit (string), frequency (daily | weekly)

2. **challenge** — A personal challenge card with a duration and goal
   - Examples: "30-day cold shower challenge", "No sugar for 2 weeks", "10k steps daily for a month", "Read 20 minutes every day"
   - Fields: title, description, icon (emoji), color (hex gradient start), durationDays (number), dailyTarget (string), rules (string[])

3. **lesson** — A custom learning card with mini-games (quiz-style)
   - Examples: "Plant protein sources quiz", "Hormone balance facts", "My supplement knowledge test"
   - Fields: title, description, icon (emoji), color (hex gradient start), games[] where each game is one of:
     - { type: "swipe_true_false", question: string, answer: boolean, explanation: string }
     - { type: "fill_blank", sentence: string (use _______ for blank), options: string[], answer: string }
     - { type: "tap_all", question: string, options: [{ text: string, correct: boolean }] }
     - { type: "match_pairs", pairs: [{ left: string, right: string }] }
     - { type: "scenario_story", scenario: string, question: string, options: [{ text: string, correct: boolean }], explanation: string }

4. **widget** — A custom info/stat widget for the dashboard
   - Examples: "Daily affirmation", "Macro check", "Weekly wins summary", "Motivation quote rotator"
   - Fields: title, description, icon (emoji), color (hex gradient start), widgetType (affirmation | stat | checklist | note), content (object with type-specific data)

CONVERSATION FLOW:
1. When the user first describes what they want, ask a BRIEF clarifying question (1-2 sentences max) if needed. Don't overwhelm them.
2. Once you understand what they want, generate the card and include it in your response as a "card" object.
3. The user can then tweak it by chatting more ("make it harder", "add more questions", "change the color", "make it 14 days instead").

RESPONSE FORMAT:
You MUST respond in valid JSON:
{
  "reply": "Your conversational response to the user",
  "card": null | { ...card object },
  "status": "chatting" | "preview" | "saved"
}

- "reply" — always required, conversational text the user sees
- "card" — null while chatting, populated when you have enough info to generate a card
- "status" — "chatting" while gathering info, "preview" when showing a card for review, "saved" is never set by you (the app sets this)

CARD OBJECT STRUCTURE:
{
  "type": "tracker" | "challenge" | "lesson" | "widget",
  "title": "Short catchy title",
  "description": "One line description",
  "icon": "emoji",
  "color": "#hex (gradient start color)",
  "config": { ...type-specific fields from above }
}

PERSONALITY:
- Be creative and enthusiastic but concise (mobile app, keep it short)
- Suggest improvements or additions the user might not have thought of
- Make cards feel polished and fun
- Use the user's context (goals, struggles, preferences) to personalize suggestions when relevant
- If the user is vague ("make me something cool"), suggest 2-3 specific card ideas they can pick from based on their profile

RULES:
- Keep plant-based/health focus
- No medical advice
- Card titles should be punchy and short (under 30 chars)
- Always include 4-8 games for lesson cards
- Challenges should have clear, measurable daily targets
- Return ONLY valid JSON — no markdown wrapping

${userContext}`;

    // Build chat contents for Gemini
    const contents: any[] = [];

    contents.push({
      role: "user",
      parts: [{ text: `SYSTEM: ${systemPrompt}` }]
    });
    contents.push({
      role: "model",
      parts: [{ text: JSON.stringify({ reply: "Hey! I'm your card builder. Tell me what you want to create — a tracker, challenge, quiz, or widget — and I'll build it for you. Or just describe an idea and I'll figure out the best format!", card: null, status: "chatting" }) }]
    });

    // Add chat history
    if (chatHistory && Array.isArray(chatHistory)) {
      chatHistory.forEach((msg: any) => {
        const role = msg.role === 'user' ? 'user' : 'model';
        const text = msg.text || '';
        if (!text) return;

        if (contents.length > 0 && contents[contents.length - 1].role === role) {
          contents[contents.length - 1].parts[0].text += `\n\n${text}`;
        } else {
          contents.push({ role, parts: [{ text }] });
        }
      });
    }

    // Add current message
    if (contents.length > 0 && contents[contents.length - 1].role === "user") {
      contents[contents.length - 1].parts[0].text += `\n\n${message}`;
    } else {
      contents.push({ role: "user", parts: [{ text: message }] });
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.8,
          responseMimeType: "application/json",
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error:", JSON.stringify(data));
      throw new Error(data.error?.message || "Failed to fetch from Gemini");
    }

    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let parsedResponse;
    try {
      const cleaned = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedResponse = JSON.parse(cleaned);
    } catch {
      parsedResponse = { reply: aiText, card: null, status: "chatting" };
    }

    const result = {
      reply: parsedResponse.reply || aiText || "Hmm, let me try that again.",
      card: parsedResponse.card || null,
      status: parsedResponse.status || (parsedResponse.card ? "preview" : "chatting"),
    };

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in card-builder-ai:", error);
    return new Response(JSON.stringify({
      error: "Internal Server Error",
      details: error instanceof Error ? error.message : String(error),
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
