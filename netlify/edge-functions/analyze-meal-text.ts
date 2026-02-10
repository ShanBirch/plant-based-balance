import { Context } from "@netlify/edge-functions";

export default async function (request: Request, context: Context) {
  // Only accept POST
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { description, mealType } = await request.json();
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      console.error("Missing GEMINI_API_KEY");
      return new Response(JSON.stringify({ error: "Server configuration error: Missing API Key" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!description) {
      return new Response(JSON.stringify({ error: "No description provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Prepare the Gemini API request (text-only, no image)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

    const systemPrompt = `You are a precise nutrition analysis AI. Analyze the following meal description and provide accurate nutritional information.
MEAL DESCRIPTION: "${description}"
MEAL TYPE: "${mealType || 'Not specified'}"

INSTRUCTIONS:
1. Break down the description into individual food items
2. Estimate portion sizes in grams (use common serving sizes if not specified)
3. Calculate nutritional values using standard USDA nutrition data per 100g, then scale to the estimated portion
4. Provide your confidence level (high/medium/low)

CALORIE REFERENCE (per 100g unless stated):
Fruits: berries ~57, banana ~89, apple ~52, mango ~60
Vegetables: broccoli ~34, spinach ~23, sweet potato ~86, carrot ~41
Grains (COOKED): white rice ~130, brown rice ~112, pasta ~131, oats/porridge ~71
Protein: chicken breast (cooked) ~165, tofu ~76, eggs ~155, salmon ~208, lentils (cooked) ~116
Dairy & drinks: whole milk ~61, semi-skimmed milk ~47, soy milk ~33, oat milk ~48
Drinks: black coffee ~2, latte (whole milk) ~56 per 100ml (~135 for small 240ml), soy latte ~45 per 100ml (~108 for small 240ml), cappuccino ~40 per 100ml
Bread & baked: bread ~250, bagel ~270, muffin ~340
Nuts & fats: almonds ~579, peanut butter ~588, olive oil ~884, butter ~717
Snacks: dark chocolate ~546, crisps/chips ~536

CRITICAL RULES:
- A "small latte" is about 240ml and ~130-150 calories. A "large latte" is about 480ml and ~250-300 calories. Do NOT confuse drinks with their raw ingredient calories.
- Use COOKED values for grains, rice, pasta, lentils — not raw/dry values (raw is roughly 3x higher)
- A typical meal plate is 400-700 calories. If your total exceeds 1000 calories for a normal-looking meal, double-check your work.

RESPONSE FORMAT - Return ONLY valid JSON with this exact structure:
{
  "foodItems": [
    {
      "name": "Food item name",
      "portion": "estimated portion size",
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
          parts: [{ text: systemPrompt }]
        }
      ],
      generationConfig: {
        temperature: 0.1, // More deterministic
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    };

    console.log("Sending request to Gemini API for text-based food analysis...");

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

    const cleanedText = aiText.replace(/\`\`\`json\n?/g, '').replace(/\`\`\`\n?/g, '').trim();
    const nutritionData = JSON.parse(cleanedText);

    return new Response(JSON.stringify({ success: true, data: nutritionData }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in analyze-meal-text function:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
