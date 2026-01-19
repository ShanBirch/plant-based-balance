
import { Context } from "@netlify/edge-functions";

export default async function (request: Request, context: Context) {
  // Only accept POST
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { imageBase64, mimeType } = await request.json();
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      console.error("Missing GEMINI_API_KEY");
      return new Response(JSON.stringify({ error: "Server configuration error: Missing API Key" }), {
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

    // Prepare the Gemini API request
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const systemPrompt = `You are a nutrition analysis AI. Analyze the food in this image and provide detailed nutritional information.

INSTRUCTIONS:
1. Identify all food items visible in the image
2. Estimate portion sizes
3. Calculate nutritional values (calories, macros, and key micronutrients)
4. Provide your confidence level (high/medium/low)

RESPONSE FORMAT - Return ONLY valid JSON with this exact structure:
{
  "foodItems": [
    {
      "name": "Food item name",
      "portion": "estimated portion size",
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "fiber_g": number
    }
  ],
  "totals": {
    "calories": number,
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number,
    "fiber_g": number
  },
  "micronutrients": {
    "vitamin_c_mg": number,
    "iron_mg": number,
    "calcium_mg": number,
    "potassium_mg": number
  },
  "confidence": "high/medium/low",
  "notes": "Any additional observations or caveats about the analysis"
}

IMPORTANT:
- Be realistic with portion sizes
- If you're unsure, estimate conservatively and indicate lower confidence
- Round numbers to 1 decimal place
- Only include micronutrients if they're significant in the foods present
- If the image doesn't contain food, set confidence to "low" and explain in notes`;

    const payload = {
      contents: [
        {
          parts: [
            {
              text: systemPrompt
            },
            {
              inline_data: {
                mime_type: mimeType || "image/jpeg",
                data: imageBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.3, // Lower temperature for more consistent analysis
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    };

    console.log("Sending request to Gemini API for food analysis...");

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", errorText);
      return new Response(JSON.stringify({ error: "Failed to analyze image", details: errorText }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const geminiData = await geminiResponse.json();
    console.log("Gemini API response received");

    // Extract the text response
    const aiText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiText) {
      return new Response(JSON.stringify({ error: "No response from AI" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse the JSON response from the AI
    let nutritionData;
    try {
      // Remove markdown code blocks if present
      const cleanedText = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      nutritionData = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", aiText);
      return new Response(JSON.stringify({
        error: "Failed to parse nutrition data",
        rawResponse: aiText
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Return the structured nutrition data
    return new Response(JSON.stringify({
      success: true,
      data: nutritionData
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in analyze_food function:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
