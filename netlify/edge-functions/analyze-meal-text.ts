import type { Context } from "@netlify/edge-functions";

type MealPlanMeal = {
  id: string;
  plan_id: string;
  name: string;
  description?: string;
  ingredients?: Array<{ name?: string; amount?: string } | string>;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  fiber_g?: number;
  meal_slot?: string;
  week_number?: number;
  day_of_week?: number;
};

const STOP_TOKENS = new Set([
  "a", "an", "and", "are", "as", "at", "cal", "cals", "calorie", "calories",
  "for", "from", "i", "in", "it", "log", "logged", "meal", "my", "of",
  "on", "plan", "please", "the", "this", "to", "with", "you"
]);

const PORTION_PATTERN = /\b(\d+(?:[./]\d+)?\s?(?:cups?|tbsp|tablespoons?|tsp|teaspoons?|grams?|gram|g|kg|ml|mL|litres?|liters?|oz|ounce|ounces|scoops?|servings?)|\d+(?:[./]\d+)?|half|halved|halve|quarter|quarters?|cups?|tbsp|tablespoons?|tsp|teaspoons?|grams?|gram|g|kg|ml|mL|litres?|liters?|oz|ounce|ounces|scoops?|servings?|serve|serves|handful|double|doubled|triple|tripled|extra|more|less|bigger|smaller|large|small|added?|without|minus|plus|swapped?|instead)\b|\b\d+(?:[./]\d+)?x\b|\bx\d+(?:[./]\d+)?\b/i;
const REMOVAL_PATTERN = /\b(without|minus|no|removed?|took out|take out|left out|omit(?:ted)?|skip(?:ped)?)\b/i;
const ADDITION_PATTERN = /\b(add(?:ed)?|extra|more|bigger|double|doubled|triple|tripled|plus|instead|swapped?)\b/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeToken(token: string): string {
  let clean = token.toLowerCase().trim();
  if (!clean) return "";
  const aliases: Record<string, string> = {
    berries: "berry",
    raspberry: "berry",
    raspberries: "berry",
    very: "berry",
    backed: "baked",
    backing: "baked",
    oates: "oat",
    oats: "oat",
    rolled: "roll"
  };
  clean = aliases[clean] || clean;
  clean = clean.replace(/ies$/, "y").replace(/s$/, "");
  return clean;
}

function tokenize(value: unknown): string[] {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map(normalizeToken)
    .filter(token => token.length > 1 && !STOP_TOKENS.has(token));
}

function ingredientText(meal: MealPlanMeal): string {
  return (meal.ingredients || [])
    .map(item => typeof item === "string" ? item : `${item?.name || ""} ${item?.amount || ""}`)
    .join(" ");
}

function hasExplicitPortions(description: string): boolean {
  return PORTION_PATTERN.test(description);
}

function hasRemovalOnlyEdit(description: string): boolean {
  return REMOVAL_PATTERN.test(description) && !ADDITION_PATTERN.test(description);
}

function removalSegment(description: string): string {
  const lower = String(description || "").toLowerCase();
  const match = lower.match(REMOVAL_PATTERN);
  if (!match || typeof match.index !== "number") return "";
  return lower.slice(match.index).split(/[.;\n]/)[0] || "";
}

function titleMatchScore(inputTokens: Set<string>, titleTokens: string[]): number {
  if (titleTokens.length === 0) return 0;
  let hits = 0;
  for (const token of titleTokens) {
    if (inputTokens.has(token)) hits += 1;
  }
  return hits / titleTokens.length;
}

function planMealMatch(description: string, meals: MealPlanMeal[]): { meal: MealPlanMeal; score: number } | null {
  const inputTokens = new Set(tokenize(description));
  if (inputTokens.size < 2) return null;

  let best: { meal: MealPlanMeal; score: number; titleHits: number } | null = null;
  for (const meal of meals) {
    const titleTokens = tokenize(meal.name);
    const ingredientTokens = new Set(tokenize(`${meal.description || ""} ${ingredientText(meal)}`));
    const titleScore = titleMatchScore(inputTokens, titleTokens);
    let ingredientHits = 0;
    for (const token of inputTokens) {
      if (ingredientTokens.has(token)) ingredientHits += 1;
    }
    const ingredientScore = inputTokens.size ? ingredientHits / inputTokens.size : 0;
    const score = (titleScore * 0.78) + (ingredientScore * 0.22);
    const titleHits = titleTokens.filter(token => inputTokens.has(token)).length;

    if (!best || score > best.score) {
      best = { meal, score, titleHits };
    }
  }

  if (!best) return null;

  // Require the user to be naming the planned meal, not just listing one shared ingredient.
  const enoughTitleEvidence = best.titleHits >= 2 || best.score >= 0.72;
  if (best.score >= 0.58 && enoughTitleEvidence) {
    return { meal: best.meal, score: best.score };
  }
  return null;
}

function ingredientName(item: { name?: string; amount?: string } | string): string {
  return typeof item === "string" ? item : String(item?.name || "");
}

function ingredientKeys(name: string): string[] {
  const lower = name.toLowerCase();
  const keys = new Set<string>();
  const cleaned = lower
    .replace(/\([^)]*\)/g, " ")
    .replace(/[,/]/g, " ")
    .replace(/\bor\b|\band\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned) keys.add(cleaned);
  if (lower.includes("maple") || lower.includes("syrup")) {
    keys.add("maple syrup");
    keys.add("syrup");
  }
  if (lower.includes("honey")) keys.add("honey");
  if (lower.includes("cinnamon")) keys.add("cinnamon");
  if (lower.includes("almond butter")) keys.add("almond butter");
  if (lower.includes("peanut butter")) keys.add("peanut butter");
  if (lower.includes("chia")) keys.add("chia");
  if (lower.includes("hemp")) keys.add("hemp");
  if (lower.includes("granola")) keys.add("granola");
  if (lower.includes("protein")) keys.add("protein");
  return [...keys].filter(key => key.length > 2);
}

function segmentMentionsIngredient(segment: string, ingredient: { name?: string; amount?: string } | string): boolean {
  const name = ingredientName(ingredient);
  if (!name || !segment) return false;
  return ingredientKeys(name).some(key => new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(segment));
}

function removedIngredients(description: string, meal: MealPlanMeal): Array<{ name?: string; amount?: string } | string> {
  const segment = removalSegment(description);
  if (!segment) return [];
  return (meal.ingredients || []).filter(item => segmentMentionsIngredient(segment, item));
}

function parseAmount(raw: unknown): number | null {
  const text = String(raw || "").trim().toLowerCase();
  const words: Record<string, number> = { half: 0.5, quarter: 0.25, one: 1, two: 2, three: 3 };
  if (Object.prototype.hasOwnProperty.call(words, text)) return words[text];
  const mixed = text.match(/^(\d+)\s+(\d+)\/(\d+)/);
  if (mixed) return Number(mixed[1]) + (Number(mixed[2]) / Number(mixed[3]));
  const fraction = text.match(/^(\d+)\/(\d+)/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  const decimal = text.match(/^(\d+(?:\.\d+)?)/);
  if (decimal) return Number(decimal[1]);
  return null;
}

function ingredientAmount(ingredient: { name?: string; amount?: string } | string): { value: number; unit: string; isTiny: boolean } {
  const amount = typeof ingredient === "string" ? "" : String(ingredient?.amount || "");
  const unit = (amount.match(/\b(cups?|tbsp|tablespoons?|tsp|teaspoons?|scoops?|g|grams?|ml|mL)\b/i)?.[1] || "").toLowerCase();
  return {
    value: parseAmount(amount) || 1,
    unit,
    isTiny: /\b(pinch|dash|sprinkle|to taste)\b/i.test(amount),
  };
}

function scaleToReferenceUnit(value: number, unit: string, referenceUnit: string): number {
  if (!unit || unit === referenceUnit) return value;
  if (/^tbsp|tablespoon/.test(unit) && /^tsp|teaspoon/.test(referenceUnit)) return value * 3;
  if (/^tsp|teaspoon/.test(unit) && /^tbsp|tablespoon/.test(referenceUnit)) return value / 3;
  if (/^g|gram/.test(unit) && /^100g$/.test(referenceUnit)) return value / 100;
  return value;
}

function estimateIngredientNutrition(ingredient: { name?: string; amount?: string } | string) {
  const name = ingredientName(ingredient).toLowerCase();
  const { value, unit, isTiny } = ingredientAmount(ingredient);
  if (isTiny) return { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };

  const references = [
    { match: /maple|syrup|honey/, unit: "tsp", calories: 17, protein_g: 0, carbs_g: 4.5, fat_g: 0, fiber_g: 0 },
    { match: /cinnamon/, unit: "tsp", calories: 6, protein_g: 0.1, carbs_g: 2.1, fat_g: 0, fiber_g: 1.4 },
    { match: /chia/, unit: "tsp", calories: 26, protein_g: 0.8, carbs_g: 2.1, fat_g: 1.6, fiber_g: 1.8 },
    { match: /almond butter/, unit: "tbsp", calories: 102, protein_g: 3.4, carbs_g: 3, fat_g: 8.5, fiber_g: 1.6 },
    { match: /peanut butter/, unit: "tbsp", calories: 95, protein_g: 3.5, carbs_g: 3.5, fat_g: 8, fiber_g: 1 },
    { match: /rolled oats|oats?/, unit: "cup", calories: 307, protein_g: 10.7, carbs_g: 54.8, fat_g: 5.3, fiber_g: 8.2 },
    { match: /raspberr|berries|berry/, unit: "cup", calories: 72, protein_g: 1.5, carbs_g: 14.7, fat_g: 0.8, fiber_g: 8 },
    { match: /almond milk/, unit: "cup", calories: 30, protein_g: 1, carbs_g: 1, fat_g: 2.5, fiber_g: 0.5 },
    { match: /granola/, unit: "cup", calories: 480, protein_g: 10, carbs_g: 72, fat_g: 16, fiber_g: 8 },
    { match: /protein/, unit: "scoop", calories: 110, protein_g: 22, carbs_g: 2, fat_g: 2, fiber_g: 1 },
  ];
  const ref = references.find(item => item.match.test(name));
  if (!ref) return { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };
  const servings = scaleToReferenceUnit(value, unit, ref.unit);
  return {
    calories: Math.round(ref.calories * servings),
    protein_g: Number((ref.protein_g * servings).toFixed(1)),
    carbs_g: Number((ref.carbs_g * servings).toFixed(1)),
    fat_g: Number((ref.fat_g * servings).toFixed(1)),
    fiber_g: Number((ref.fiber_g * servings).toFixed(1)),
  };
}

async function supabaseGet<T>(path: string): Promise<T[]> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_KEY");
  if (!supabaseUrl || !serviceKey) return [];

  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    console.warn(`[analyze-meal-text] Supabase lookup failed (${res.status}) for ${path}`);
    return [];
  }
  return await res.json();
}

async function loadActivePlanMeals(userId: string): Promise<MealPlanMeal[]> {
  if (!UUID_PATTERN.test(userId)) return [];
  const plans = await supabaseGet<{ id: string }>(
    `ai_generated_meal_plans?select=id&user_id=eq.${encodeURIComponent(userId)}&status=eq.active&order=created_at.desc&limit=1`
  );
  const planId = plans?.[0]?.id;
  if (!planId) return [];
  return await supabaseGet<MealPlanMeal>(
    `ai_generated_meals?select=id,plan_id,name,description,ingredients,calories,protein_g,carbs_g,fat_g,fiber_g,meal_slot,week_number,day_of_week&plan_id=eq.${encodeURIComponent(planId)}&limit=200`
  );
}

function mealPlanNutritionData(
  description: string,
  meal: MealPlanMeal,
  score: number,
  removed: Array<{ name?: string; amount?: string } | string> = [],
) {
  const removedNutrition = removed
    .map(estimateIngredientNutrition)
    .reduce((sum, item) => ({
      calories: sum.calories + item.calories,
      protein_g: sum.protein_g + item.protein_g,
      carbs_g: sum.carbs_g + item.carbs_g,
      fat_g: sum.fat_g + item.fat_g,
      fiber_g: sum.fiber_g + item.fiber_g,
    }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 });
  const removedNames = removed.map(ingredientName).filter(Boolean);
  const calories = Math.max(0, Math.round((Number(meal.calories) || 0) - removedNutrition.calories));
  const protein = Math.max(0, Number(((Number(meal.protein_g) || 0) - removedNutrition.protein_g).toFixed(1)));
  const carbs = Math.max(0, Number(((Number(meal.carbs_g) || 0) - removedNutrition.carbs_g).toFixed(1)));
  const fat = Math.max(0, Number(((Number(meal.fat_g) || 0) - removedNutrition.fat_g).toFixed(1)));
  const fiber = Math.max(0, Number(((Number(meal.fiber_g) || 0) - removedNutrition.fiber_g).toFixed(1)));
  const removalNote = removedNames.length ? ` and adjusted for removed ${removedNames.join(", ")}` : "";

  return {
    foodItems: [{
      name: meal.name,
      portion: removedNames.length ? `1 planned serving without ${removedNames.join(", ")}` : "1 planned serving",
      portion_weight_g: 0,
      calories,
      protein_g: protein,
      carbs_g: carbs,
      fat_g: fat,
      fiber_g: fiber,
    }],
    totals: {
      calories,
      protein_g: protein,
      carbs_g: carbs,
      fat_g: fat,
      fiber_g: fiber,
    },
    micronutrients: {},
    confidence: "high",
    notes: `Matched ${meal.name} from your active meal plan${removalNote}.`,
    meal_insight: `${meal.name} was matched from your active meal plan${removalNote}, so the saved plan calories and macros were used instead of re-estimating the whole meal from text.`,
    matched_meal_plan: {
      meal_id: meal.id,
      plan_id: meal.plan_id,
      name: meal.name,
      match_score: Number(score.toFixed(3)),
      typed_description: description,
      removed_ingredients: removedNames,
    },
  };
}

export default async function (request: Request, context: Context) {
  // Only accept POST
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { description, mealType, userId } = await request.json();

    if (!description) {
      return new Response(JSON.stringify({ error: "No description provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const cleanDescription = String(description).trim();
    const cleanUserId = typeof userId === "string" && UUID_PATTERN.test(userId) ? userId : "";
    if (cleanUserId) {
      const explicitPortions = hasExplicitPortions(cleanDescription);
      const planMeals = await loadActivePlanMeals(cleanUserId);
      const match = planMealMatch(cleanDescription, planMeals);
      if (match && !explicitPortions) {
        return new Response(JSON.stringify({
          success: true,
          data: mealPlanNutritionData(cleanDescription, match.meal, match.score),
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (match && explicitPortions && hasRemovalOnlyEdit(cleanDescription)) {
        const removed = removedIngredients(cleanDescription, match.meal);
        if (removed.length > 0) {
          return new Response(JSON.stringify({
            success: true,
            data: mealPlanNutritionData(cleanDescription, match.meal, match.score, removed),
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      console.error("Missing GEMINI_API_KEY");
      return new Response(JSON.stringify({ error: "Server configuration error: Missing API Key" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Prepare the Gemini API request (text-only, no image)
    // Model fallback chain: primary → gemini-2.5-flash → gemini-2.5-pro
    const modelFallbacks = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-pro"];

    const systemPrompt = `You are a precise nutrition analysis AI. Analyze the following meal description and provide accurate nutritional information.
MEAL DESCRIPTION: "${cleanDescription}"
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
