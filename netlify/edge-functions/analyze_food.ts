
import { Context } from "@netlify/edge-functions";

// Look up food in USDA FoodData Central (Foundation + SR Legacy = real whole foods)
async function lookupUSDA(query: string) {
  try {
    const usdaKey = Deno.env.get("USDA_API_KEY") || "DEMO_KEY";
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${usdaKey}&query=${encodeURIComponent(query)}&dataType=Foundation,SR%20Legacy&pageSize=7`;
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return null;

    const data = await response.json();
    const foods = data.foods || [];
    if (foods.length === 0) return null;

    // Score each result to find the best match for the actual food
    const queryWords = query.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);

    let bestMatch = null;
    let bestScore = -1;

    for (const food of foods) {
      const desc = (food.description || '').toLowerCase();
      let score = 0;

      // How many query words appear in the description?
      for (const word of queryWords) {
        if (desc.includes(word)) score += 3;
      }

      // Bonus for Foundation data (lab-tested whole foods)
      if (food.dataType === 'Foundation') score += 2;

      // Bonus for "raw" (most relevant for whole food calorie lookup)
      if (desc.includes('raw')) score += 2;

      // Penalty for processed/prepared/baby food/oil/candy/bread products
      const penalties = ['oil,', 'candy', 'candies', 'babyfood', 'baby food', 'muffin', 'bagel', 'bread,', 'cake', 'cookie', 'bar,', 'cereal', 'juice', 'sauce', 'soup'];
      for (const p of penalties) {
        if (desc.includes(p)) score -= 5;
      }

      // Penalty for descriptions much longer than query (likely a complex product)
      const descWords = desc.split(/[\s,]+/).length;
      if (descWords > queryWords.length + 4) score -= 1;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = food;
      }
    }

    // Only use if we have a reasonable match (at least the food name was found)
    if (!bestMatch || bestScore < 3) return null;

    // Extract nutrients from the match
    const nutrients = bestMatch.foodNutrients || [];
    const getNutrient = (name: string) => {
      const n = nutrients.find((n: any) => n.nutrientName === name);
      return n ? n.value : 0;
    };

    return {
      name: bestMatch.description,
      dataType: bestMatch.dataType,
      calories_100g: getNutrient('Energy'),
      protein_100g: getNutrient('Protein'),
      carbs_100g: getNutrient('Carbohydrate, by difference'),
      fat_100g: getNutrient('Total lipid (fat)'),
      fiber_100g: getNutrient('Fiber, total dietary'),
    };
  } catch (e) {
    console.error(`USDA lookup failed for ${query}:`, e);
    return null;
  }
}

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

    // Verify all food items against USDA FoodData Central (in parallel for speed)
    console.log(`Verifying ${nutritionData.foodItems.length} items against USDA...`);

    const usdaResults = await Promise.allSettled(
      nutritionData.foodItems.map((item: any) => lookupUSDA(item.name))
    );

    for (let i = 0; i < nutritionData.foodItems.length; i++) {
      const item = nutritionData.foodItems[i];
      const result = usdaResults[i];
      const usdaMatch = result.status === 'fulfilled' ? result.value : null;

      if (usdaMatch && usdaMatch.calories_100g > 0) {
        console.log(`✅ USDA VERIFIED: "${item.name}" → "${usdaMatch.name}" (${usdaMatch.dataType}) = ${usdaMatch.calories_100g} kcal/100g`);

        const weightFactor = (item.portion_weight_g || 100) / 100;

        item.calories = Number((usdaMatch.calories_100g * weightFactor).toFixed(1));
        item.protein_g = Number((usdaMatch.protein_100g * weightFactor).toFixed(1));
        item.carbs_g = Number((usdaMatch.carbs_100g * weightFactor).toFixed(1));
        item.fat_g = Number((usdaMatch.fat_100g * weightFactor).toFixed(1));
        item.fiber_g = Number((usdaMatch.fiber_100g * weightFactor).toFixed(1));
        item.verified = true;
        item.db_source = "USDA FoodData Central";
      } else {
        console.log(`⚠️ No USDA match for "${item.name}", keeping Gemini estimate`);
        item.verified = false;
        item.db_source = "Gemini AI Estimate";
      }
    }

    // Recalculate totals from verified item values
    nutritionData.totals.calories = Number(nutritionData.foodItems.reduce((sum: number, i: any) => sum + i.calories, 0).toFixed(1));
    nutritionData.totals.protein_g = Number(nutritionData.foodItems.reduce((sum: number, i: any) => sum + i.protein_g, 0).toFixed(1));
    nutritionData.totals.carbs_g = Number(nutritionData.foodItems.reduce((sum: number, i: any) => sum + i.carbs_g, 0).toFixed(1));
    nutritionData.totals.fat_g = Number(nutritionData.foodItems.reduce((sum: number, i: any) => sum + i.fat_g, 0).toFixed(1));
    nutritionData.totals.fiber_g = Number(nutritionData.foodItems.reduce((sum: number, i: any) => sum + i.fiber_g, 0).toFixed(1));

    return new Response(JSON.stringify({ success: true, data: nutritionData }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in analyze_food function:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
