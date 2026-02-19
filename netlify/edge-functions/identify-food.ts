import { Context } from "@netlify/edge-functions";

export default async function (request: Request, context: Context) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { imageBase64, mimeType } = await request.json();
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const systemPrompt = `You are a quick food identification AI. Look at this image and identify what food or drink is shown.

RESPONSE FORMAT - Return ONLY valid JSON:
{
  "identified": true,
  "name": "Short food/drink name (max 40 chars)",
  "approx_calories": number (rough estimate per typical serving),
  "serving_hint": "e.g. per cup, per slice, per bowl",
  "suggestion": "Brief description for the user to confirm/edit (e.g. 'Black coffee, 250ml')"
}

If no food or drink is visible in the image, return:
{"identified": false, "name": "", "approx_calories": 0, "serving_hint": "", "suggestion": ""}

IMPORTANT:
- Return RAW JSON only - no markdown, no code blocks
- Be concise - this is a quick identification, not full analysis
- Focus on the main/most prominent food item
- Give a realistic calorie estimate for a typical serving`;

    const payload = {
      contents: [
        {
          parts: [
            { text: systemPrompt },
            {
              inline_data: {
                mime_type: mimeType || "image/jpeg",
                data: imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 256,
      },
    };

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      return new Response(JSON.stringify({ error: "Gemini API error", details: errorText }), {
        status: geminiResponse.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const geminiData = await geminiResponse.json();
    const aiText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiText) throw new Error("Empty AI response");

    const cleanedText = aiText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const identificationData = JSON.parse(cleanedText);

    return new Response(JSON.stringify({ success: true, data: identificationData }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in identify-food function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
