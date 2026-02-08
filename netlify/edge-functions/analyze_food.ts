
import { Context } from "@netlify/edge-functions";

export default async function (request: Request, context: Context) {
  // Only accept POST
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { imageBase64, mimeType, description } = await request.json();
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
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

    const systemPrompt = `You are a precise nutrition analysis AI. Analyze the food in this image and provide accurate nutritional information.
${description ? `\nUSER'S MEAL DESCRIPTION: "${description}"\nUse this description to help identify the food items and estimate portions more accurately.\n` : ''}
INSTRUCTIONS:
1. Identify all food items visible in the image
2. Estimate portion sizes in grams based on visual cues (plate size, item proportions)
3. Calculate nutritional values using standard USDA nutrition data per 100g, then scale to the estimated portion
4. Provide your confidence level (high/medium/low)

CALORIE REFERENCE (per 100g raw weight):
- Fruits: 30-90 kcal (berries ~57, banana ~89, apple ~52)
- Vegetables: 15-40 kcal (broccoli ~34, spinach ~23)
- Grains/rice (cooked): 100-150 kcal (white rice ~130, pasta ~131)
- Chicken breast (cooked): ~165 kcal
- Eggs: ~155 kcal
- Bread: ~250 kcal
- Nuts: 550-650 kcal
- Oils/butter: 700-900 kcal

Use these as anchors. If your estimate is wildly different from these ranges for a similar food, double-check your calculation.

RESPONSE FORMAT - Return ONLY valid JSON with this exact structure:
{
  "foodItems": [
    {
      "name": "Food item name",
      "portion": "estimated portion size in grams",
      "portion_weight_g": number,
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
- Return RAW JSON only - no markdown, no code blocks, no backticks
- Keep food item names SHORT (max 30 chars)
- Be realistic with portion sizes
- Round numbers to 1 decimal place
- Calculate each item as: (calories_per_100g * portion_weight_g / 100)`;

    const payload = {
      contents: [
        {
          parts: [
            { text: systemPrompt },
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
        temperature: 0.1, // More deterministic
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4096,
      }
    };

    console.log("Sending request to Gemini API for food analysis...");

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        return new Response(JSON.stringify({ error: "Gemini API error", details: errorText }), { status: geminiResponse.status });
    }

    const geminiData = await geminiResponse.json();
    const aiText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!aiText) throw new Error("Empty AI response");

    const cleanedText = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const nutritionData = JSON.parse(cleanedText);

    return new Response(JSON.stringify({ success: true, data: nutritionData }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in analyze_food function:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
