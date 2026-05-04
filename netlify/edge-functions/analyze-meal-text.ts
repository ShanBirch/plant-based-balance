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
    // Model fallback chain: primary → gemini-2.5-flash → gemini-2.5-pro
    const modelFallbacks = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-pro"];

    const systemPrompt = `You are a precise nutrition analysis AI. Analyze the following meal description and provide accurate nutritional information.
MEAL DESCRIPTION: "${description}"
MEAL TYPE: "${mealType || 'Not specified'}"

INSTRUCTIONS:
1. Break down the description into individual food items
2. For each item, use this priority order for nutritional values:
   a. KNOWN DATA FIRST: If it's a branded/packaged product, common food, or restaurant item you have nutritional data for, use those known values scaled to the portion
   b. STANDARD REFERENCES: For whole foods (chicken breast, rice, banana, etc.), use standard USDA/nutritional database values per gram, scaled to the portion
   c. ESTIMATION ONLY as a last resort for vague descriptions where ingredients are unclear
3. Estimate portion sizes in grams (use the description, packaging info, or common serving sizes)
4. Provide your confidence level (high/medium/low)

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
    "potassium_mg": number,
    "b12_mcg": number,
    "omega3_g": number,
    "zinc_mg": number,
    "vitamin_d_mcg": number,
    "iodine_mcg": number,
    "selenium_mcg": number,
    "folate_mcg": number,
    "magnesium_mg": number,
    "vitamin_a_mcg": number,
    "vitamin_e_mg": number,
    "vitamin_k_mcg": number
  },
  "confidence": "high/medium/low",
  "notes": "Any additional observations or caveats about the analysis",
  "meal_insight": "2-3 educational sentences about the nutritional highlights of this meal. Mention specific standout nutrients, interesting food-science facts about the ingredients, or how the components work together nutritionally."
}

IMPORTANT:
- Return RAW JSON only - no markdown, no code blocks, no backticks
- Keep food item names SHORT (max 30 chars)
- Be realistic with portion sizes
- Round numbers to 1 decimal place
- CALORIES must be calculated strictly as: (protein_g × 4) + (carbs_g × 4) + (fat_g × 9). Do not estimate calories independently — derive them from the macros`;

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

    let geminiData: any = null;
    let lastError = "";
    let usedModel = "";

    for (const model of modelFallbacks) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      console.log(`Sending request to Gemini API (${model}) for text-based food analysis...`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);

      let geminiResponse: Response;
      try {
        geminiResponse = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } catch (fetchErr: any) {
        clearTimeout(timeout);
        lastError = fetchErr?.name === "AbortError" ? `${model} timed out after 20s` : fetchErr.message;
        console.warn(`Gemini model ${model} fetch failed: ${lastError}, trying next fallback...`);
        continue;
      }
      clearTimeout(timeout);

      if (geminiResponse.ok) {
        geminiData = await geminiResponse.json();
        usedModel = model;
        break;
      }

      const errorText = await geminiResponse.text();
      lastError = errorText;
      console.warn(`Gemini model ${model} failed (${geminiResponse.status}), trying next fallback...`);

      // Only fall back on rate limit (429) or server errors (5xx)
      if (geminiResponse.status !== 429 && geminiResponse.status < 500) {
        return new Response(JSON.stringify({ error: "Gemini API error", details: errorText }), { status: geminiResponse.status });
      }
    }

    if (!geminiData) {
      return new Response(JSON.stringify({ error: "All Gemini models failed", details: lastError }), { status: 503 });
    }

    const candidate = geminiData?.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const aiText = parts.map((p: { text?: string }) => p?.text || '').join('');
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      console.warn(`[analyze-meal-text] finishReason=${candidate.finishReason} partCount=${parts.length} textLen=${aiText.length}`);
    }

    if (!aiText) throw new Error("Empty AI response");

    const cleanedText = aiText.replace(/\`\`\`json\n?/g, '').replace(/\`\`\`\n?/g, '').trim();
    const nutritionData = JSON.parse(cleanedText);

    // Correct calories from macros (protein×4 + carbs×4 + fat×9) since Gemini sometimes miscalculates
    if (Array.isArray(nutritionData.foodItems)) {
      for (const item of nutritionData.foodItems) {
        const p = parseFloat(item.protein_g) || 0;
        const c = parseFloat(item.carbs_g) || 0;
        const f = parseFloat(item.fat_g) || 0;
        item.calories = Math.round(p * 4 + c * 4 + f * 9);
      }
    }
    if (nutritionData.totals) {
      const p = parseFloat(nutritionData.totals.protein_g) || 0;
      const c = parseFloat(nutritionData.totals.carbs_g) || 0;
      const f = parseFloat(nutritionData.totals.fat_g) || 0;
      nutritionData.totals.calories = Math.round(p * 4 + c * 4 + f * 9);
    }

    return new Response(JSON.stringify({ success: true, data: nutritionData }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in analyze-meal-text function:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
