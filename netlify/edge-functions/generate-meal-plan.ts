
import type { Context } from "https://edge.netlify.com";
import { callGeminiModelChain } from "./_shared/ai-router.js";

/**
 * Generate meals for a SINGLE DAY of a meal plan using Gemini AI.
 * Called 7 times by the frontend (once per day) for fast, reliable generation.
 *
 * POST body: {
 *   userData: { profile, quizResults, facts, foodPreferences },
 *   weekNumber: 1-4,
 *   dayNumber: 0-6,
 *   previousDays: [{ day_name, mealNames[] }],  // prior days in this week for variety
 *   previousWeeks: [{ theme, mealNames[] }]      // prior weeks for continuity
 * }
 * Returns: { success, day: { day_of_week, day_name, meals: [...] }, weekMeta?: {...} }
 */

export default async function (request: Request, context: Context) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await request.json();
    const { userData, weekNumber, dayNumber, previousDays, previousWeeks } = body;
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing API Key" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const week = parseInt(weekNumber) || 1;
    if (week < 1 || week > 4) {
      return new Response(JSON.stringify({ error: "weekNumber must be 1-4" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const day = parseInt(dayNumber) || 0;
    if (day < 0 || day > 6) {
      return new Response(JSON.stringify({ error: "dayNumber must be 0-6" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dayName = dayNames[day];

    const profile = userData?.profile || {};
    const quiz = userData?.quizResults || {};
    const facts = userData?.facts || {};
    const foodPrefs = userData?.foodPreferences || {};

    const dietType = foodPrefs.diet_type || 'vegan';
    const dietKey = String(dietType).toLowerCase().replace(/[\s-]/g, '_');
    const isVegan = dietKey === 'vegan' || dietKey === 'plant_based';
    const isVegetarian = dietKey === 'vegetarian';
    const isPescatarian = dietKey === 'pescatarian';

    // dietary_requirements is the new multi-select tag list (vegan, gluten_free, halal, etc).
    // Treat it as the source of truth for restrictions; fall back to the legacy single
    // diet_type if the array is empty.
    const dietaryRequirements: string[] = Array.isArray(foodPrefs.dietary_requirements)
      ? foodPrefs.dietary_requirements.map((t: string) => String(t).toLowerCase())
      : [];
    const reqSet = new Set(dietaryRequirements);

    const nutritionistRole = isVegan
      ? 'plant-based nutritionist'
      : (isVegetarian ? 'vegetarian nutritionist' : 'nutritionist');

    // Per-tag spec lines. Each line is appended to the dietary spec block when its
    // tag is selected, giving the LLM strict, unambiguous rules for each requirement.
    const TAG_SPECS: Record<string, string> = {
      vegan:          '• Vegan: 100% plant-based — NO meat, poultry, fish, dairy, eggs, honey, gelatin, whey, or casein.',
      vegetarian:     '• Vegetarian: NO meat, poultry, fish, or gelatin. Dairy and eggs are OK.',
      pescatarian:    '• Pescatarian: NO red meat or poultry. Fish, shellfish, dairy, and eggs are OK.',
      flexitarian:    '• Flexitarian: mostly plant-based; small amounts of meat/fish OK in 1–2 meals/week max. Lead with plants.',
      omnivore:       '• Omnivore: meat, fish, poultry, dairy, eggs, plants all welcome. Favour whole foods and lean protein.',
      mediterranean:  '• Mediterranean: olive oil as primary fat, plenty of vegetables, legumes, whole grains, fish 2x/wk, limited red meat, no ultra-processed foods.',
      keto:           '• Keto: <30g net carbs/day. NO grains, sugar, starchy vegetables, legumes, or most fruit. High fat (60–75% of cals), moderate protein.',
      paleo:          '• Paleo: NO grains, legumes, dairy, refined sugar, or seed/vegetable oils. Meat, fish, eggs, vegetables, fruit, nuts, seeds OK.',
      whole30:        '• Whole30: NO sugar/sweeteners (incl. honey/maple), grains, legumes, dairy, alcohol, or processed additives. Real whole foods only.',
      gluten_free:    '• Gluten-Free: NO wheat, barley, rye, spelt, kamut, triticale, or any product containing gluten (incl. soy sauce, seitan, malt). Use certified GF oats only.',
      dairy_free:     '• Dairy-Free: NO milk, butter, cheese, yogurt, cream, ghee, whey, or casein from any animal. Plant-based alternatives are fine.',
      nut_free:       '• Nut-Free: NO tree nuts (almonds, cashews, walnuts, pistachios, pecans, hazelnuts, Brazil, macadamia) or peanuts/peanut butter.',
      soy_free:       '• Soy-Free: NO soy in any form (soybeans, tofu, tempeh, edamame, soy sauce, soy milk, soy lecithin, miso).',
      egg_free:       '• Egg-Free: NO eggs or products containing egg (incl. mayo, fresh pasta, many baked goods).',
      shellfish_free: '• Shellfish-Free: NO shrimp, prawns, crab, lobster, mussels, clams, oysters, scallops, squid, or octopus.',
      low_fodmap:     '• Low FODMAP: avoid garlic, onion, wheat, lactose, beans/lentils, apples, pears, stone fruit, honey, high-fructose corn syrup, sugar alcohols.',
      low_sodium:     '• Low Sodium: ≤1500mg sodium/day. Avoid added salt, soy sauce, canned/processed foods, deli meats, cheese; use herbs/spices/citrus instead.',
      low_sugar:      '• Low Sugar: ≤25g added sugar/day. NO sweetened drinks, desserts, syrups, or processed snacks. Whole fruit in moderation.',
      halal:          '• Halal: NO pork or pork-derived ingredients (gelatin, lard). Meat must be from halal sources. NO alcohol in cooking or ingredients.',
      kosher:         '• Kosher: NO pork or shellfish. NEVER mix meat with dairy in the same meal. NO non-kosher fish (must have fins + scales).'
    };

    // Pull spec lines from the requirements tag set. If the set is empty, fall back
    // to whatever the legacy single dietType implies so existing users don't lose specs.
    const activeTags = reqSet.size
      ? Array.from(reqSet)
      : (isVegan ? ['vegan'] : isVegetarian ? ['vegetarian'] : isPescatarian ? ['pescatarian'] : ['omnivore']);

    const specLines = activeTags.map(t => TAG_SPECS[t]).filter(Boolean);
    const dietarySpec = `Dietary requirements (STRICT): ${activeTags.join(', ') || dietType}\n${specLines.join('\n')}`;
    const dietaryReminder = `Every meal MUST satisfy ALL of the user's dietary requirements (${activeTags.join(', ') || dietType}). When two rules conflict, take the stricter one. Re-check the ingredient list against every requirement before finalizing.`;

    const calorieGoal = quiz.calorie_goal || 1800;
    const proteinGoal = quiz.protein_goal_g || 100;
    const carbsGoal = quiz.carbs_goal_g || 200;
    const fatGoal = quiz.fat_goal_g || 60;

    // Week themes
    const weekThemes: Record<number, { theme: string; focus: string }> = {
      1: { theme: "Foundation & Reset", focus: "Simple, nourishing meals to reduce inflammation and establish healthy habits" },
      2: { theme: "Build & Energize", focus: "Higher protein, more variety, building energy through balanced nutrition" },
      3: { theme: "Peak Performance", focus: "Optimized macros, diverse cuisines, thermogenic and metabolism-boosting foods" },
      4: { theme: "Sustain & Thrive", focus: "Balanced, sustainable meals you can repeat long-term with confidence" }
    };

    const currentTheme = weekThemes[week] || weekThemes[1];

    // Build context about previous days in this week to avoid repetition
    let previousDayContext = '';
    if (previousDays && Array.isArray(previousDays) && previousDays.length > 0) {
      previousDayContext = `\n\nALREADY GENERATED THIS WEEK (do NOT repeat these meals - make ${dayName} different):\n`;
      previousDays.forEach((pd: any) => {
        previousDayContext += `${pd.day_name}: ${(pd.mealNames || []).join(', ')}\n`;
      });
    }

    // Build context about previous weeks
    let previousWeekContext = '';
    if (previousWeeks && Array.isArray(previousWeeks) && previousWeeks.length > 0) {
      previousWeekContext = `\n\nPREVIOUS WEEKS (avoid repeating these meals too):\n`;
      previousWeeks.forEach((pw: any) => {
        previousWeekContext += `Week ${pw.weekNumber}: ${(pw.mealNames || []).slice(0, 15).join(', ')}\n`;
      });
    }

    const prompt = `You are an expert ${nutritionistRole}. Generate meals for ${dayName} (Day ${day + 1} of 7) in Week ${week}.

=== USER PROFILE ===
Name: ${profile.name || 'User'}
Sex: ${quiz.sex || 'Unknown'} | Age: ${quiz.age || 'Unknown'}
Weight: ${quiz.weight || '?'}kg -> Goal: ${quiz.goal_weight || '?'}kg | Height: ${quiz.height || '?'}cm
Activity: ${quiz.activity_level || 'moderate'} | Goal: ${quiz.goal_body_type || 'lean and toned'}

=== NUTRITION TARGETS (per day) ===
Calories: ~${calorieGoal} | Protein: ~${proteinGoal}g | Carbs: ~${carbsGoal}g | Fat: ~${fatGoal}g

=== DIETARY (STRICT — NEVER VIOLATE) ===
${dietarySpec}
Allergies (NEVER INCLUDE — this is a safety requirement): ${foodPrefs.allergies?.join(', ') || 'None'}
Dislikes (DO NOT include in any meal): ${foodPrefs.dislikes?.join(', ') || 'None'}
Favorites (work these in where it makes sense): ${foodPrefs.favorites?.join(', ') || 'None'}
Cuisines: ${foodPrefs.cuisine_preferences?.join(', ') || 'Any'}
Skill: ${foodPrefs.cooking_skill || 'intermediate'} | Prep time: ${foodPrefs.prep_time_preference || 'moderate'}
Equipment: ${[foodPrefs.has_blender ? 'Blender' : '', foodPrefs.has_air_fryer ? 'Air Fryer' : '', foodPrefs.has_instant_pot ? 'Instant Pot' : ''].filter(Boolean).join(', ') || 'Standard'}

Before finalizing any meal, double-check the ingredient list contains NONE of the user's allergies or dislikes. If a meal would, swap to a safe alternative.

=== GOALS ===
${facts.goals?.join(', ') || 'General wellness'}
${previousDayContext}${previousWeekContext}

=== WEEK ${week} THEME: "${currentTheme.theme}" ===
Focus: ${currentTheme.focus}

Generate EXACTLY 5 meals for ${dayName}: breakfast, am_snack, lunch, pm_snack, dinner.
The 5 meals should sum to approximately ${calorieGoal} calories and ${proteinGoal}g protein.
${dietaryReminder}

=== CALORIE RULES ===
- Breakfast: ${Math.round(calorieGoal * 0.25)}-${Math.round(calorieGoal * 0.3)} cal
- AM Snack: ${Math.round(calorieGoal * 0.08)}-${Math.round(calorieGoal * 0.12)} cal
- Lunch: ${Math.round(calorieGoal * 0.28)}-${Math.round(calorieGoal * 0.32)} cal
- PM Snack: ${Math.round(calorieGoal * 0.08)}-${Math.round(calorieGoal * 0.12)} cal
- Dinner: ${Math.round(calorieGoal * 0.25)}-${Math.round(calorieGoal * 0.3)} cal
- NO meal over 700 cal. NO snack over 300 cal.
- Macros must add up: (protein×4)+(carbs×4)+(fat×9) ≈ stated calories (±10%).

RESPOND WITH VALID JSON:
{
  "day_of_week": ${day},
  "day_name": "${dayName}",
  "meals": [
    {
      "meal_slot": "breakfast",
      "meal_time": "7:30 AM",
      "name": "string",
      "description": "short appetizing one-liner",
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "fiber_g": number,
      "ingredients": [{"name": "string", "amount": "string"}],
      "preparation": "brief cooking steps",
      "prep_time_mins": number,
      "cook_time_mins": number,
      "tags": ["string"],
      "cuisine": "string"
    }
  ]
}`;

    let data: any;
    let model = '';
    try {
      const routed = await callGeminiModelChain({
        apiKey,
        profile: "meal_plan",
        label: `meal-plan-w${week}-d${day}`,
        timeoutMs: 22_000,
        payload: {
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0.7,
            responseMimeType: "application/json",
          },
        },
      });
      data = routed.data;
      model = routed.model;
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        console.error(`Gemini timeout for week ${week} day ${day}`);
        return new Response(JSON.stringify({ error: "Gemini timed out", details: "AI service did not respond in time" }), {
          status: 504,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw err;
    }
    console.log(`Meal plan model week=${week} day=${day}: ${model}`);
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const text = parts.map((p: { text?: string }) => p?.text || '').join('');
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      console.warn(`[generate-meal-plan] finishReason=${candidate.finishReason} partCount=${parts.length} textLen=${text.length} week=${week} day=${day}`);
    }

    let dayData;
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      dayData = JSON.parse(cleaned);
    } catch (parseErr) {
      // Fallback: try to extract the first balanced JSON object from the text.
      // Gemini occasionally wraps its JSON in prose despite responseMimeType.
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        try {
          dayData = JSON.parse(text.slice(firstBrace, lastBrace + 1));
        } catch (_e) {
          console.error("Failed to parse day JSON (both attempts):", parseErr, text.substring(0, 500));
          throw new Error("Failed to parse meal plan response");
        }
      } else {
        console.error("Failed to parse day JSON:", parseErr, text.substring(0, 500));
        throw new Error("Failed to parse meal plan response");
      }
    }

    // Ensure required fields
    dayData.day_of_week = day;
    dayData.day_name = dayData.day_name || dayName;

    // Post-generation calorie validation & correction
    const maxCalories: Record<string, number> = {
      breakfast: Math.round(calorieGoal * 0.35),
      am_snack: 300,
      lunch: Math.round(calorieGoal * 0.38),
      pm_snack: 300,
      dinner: Math.round(calorieGoal * 0.35),
    };
    const minCalories: Record<string, number> = {
      breakfast: Math.round(calorieGoal * 0.15),
      am_snack: 50,
      lunch: Math.round(calorieGoal * 0.18),
      pm_snack: 50,
      dinner: Math.round(calorieGoal * 0.18),
    };

    let correctedCount = 0;
    if (dayData.meals && Array.isArray(dayData.meals)) {
      for (const meal of dayData.meals) {
        const slot = meal.meal_slot || 'lunch';
        const max = maxCalories[slot] || 700;
        const min = minCalories[slot] || 50;
        const cal = parseInt(meal.calories) || 0;

        // Macro cross-check: (P×4 + C×4 + F×9)
        const p = parseFloat(meal.protein_g) || 0;
        const c = parseFloat(meal.carbs_g) || 0;
        const f = parseFloat(meal.fat_g) || 0;
        const macroCalc = Math.round(p * 4 + c * 4 + f * 9);

        // If stated calories are way off from macros, use macro-calculated value
        if (macroCalc > 0 && Math.abs(cal - macroCalc) > cal * 0.3) {
          meal.calories = macroCalc;
          correctedCount++;
        }

        // Hard clamp
        if (meal.calories > max) {
          const scale = max / meal.calories;
          meal.protein_g = Math.round((parseFloat(meal.protein_g) || 0) * scale * 10) / 10;
          meal.carbs_g = Math.round((parseFloat(meal.carbs_g) || 0) * scale * 10) / 10;
          meal.fat_g = Math.round((parseFloat(meal.fat_g) || 0) * scale * 10) / 10;
          meal.calories = max;
          correctedCount++;
        } else if (meal.calories < min) {
          meal.calories = min;
          correctedCount++;
        }
      }
    }
    if (correctedCount > 0) {
      console.log(`Corrected ${correctedCount} meals with unrealistic calorie values in week ${week} day ${day}`);
    }

    // Include week metadata on the first day's response
    const result: any = { success: true, day: dayData };
    if (day === 0) {
      result.weekMeta = {
        week_number: week,
        theme: currentTheme.theme,
        theme_description: currentTheme.focus,
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in generate-meal-plan:", error);
    return new Response(JSON.stringify({
      error: "Failed to generate meal plan",
      details: error instanceof Error ? error.message : String(error),
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
