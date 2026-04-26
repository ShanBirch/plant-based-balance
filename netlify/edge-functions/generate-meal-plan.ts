
import type { Context } from "https://edge.netlify.com";

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

    const nutritionistRole = isVegan
      ? 'plant-based nutritionist'
      : (isVegetarian ? 'vegetarian nutritionist' : 'nutritionist');

    const dietarySpec = isVegan
      ? `Diet: ${dietType} (100% plant-based — NO meat, poultry, fish, dairy, eggs, honey, gelatin, whey, casein)`
      : isVegetarian
        ? `Diet: ${dietType} (no meat, poultry, fish, or gelatin — dairy and eggs are OK)`
        : isPescatarian
          ? `Diet: ${dietType} (no red meat or poultry — fish, dairy, eggs, plants are OK)`
          : `Diet: ${dietType} (omnivore — meat, fish, poultry, dairy, eggs, plants all welcome; favour whole foods, lean protein, and plenty of vegetables)`;

    const dietaryReminder = isVegan
      ? `All meals must be ${dietType} / plant-based. NO animal products.`
      : isVegetarian
        ? `All meals must be vegetarian. NO meat, poultry, or fish (dairy and eggs OK).`
        : isPescatarian
          ? `All meals must be pescatarian. NO red meat or poultry (fish, dairy, eggs OK).`
          : `All meals must fit a ${dietType} diet. Use a balanced mix of lean protein (meat, fish, eggs, dairy) and plenty of plants. Prioritise whole foods over processed.`;

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

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    // Gemini can be flaky with 429/503. Retry a couple of times with a short backoff
    // before giving up, so the frontend loop doesn't have to pay the full cost of
    // a cold retry for every transient blip.
    async function callGemini(): Promise<Response> {
      const maxAttempts = 3;
      let lastErr: unknown;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 22000);
        try {
          const res = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: {
                maxOutputTokens: 4096,
                temperature: 0.7,
                responseMimeType: "application/json",
              }
            }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (res.status === 429 || res.status === 500 || res.status === 502 || res.status === 503) {
            const body = await res.text().catch(() => '');
            console.warn(`Gemini transient ${res.status} (attempt ${attempt}/${maxAttempts}) week=${week} day=${day}: ${body.slice(0, 200)}`);
            if (attempt < maxAttempts) {
              await new Promise(r => setTimeout(r, 400 * attempt));
              continue;
            }
            return res;
          }
          return res;
        } catch (err) {
          clearTimeout(timeoutId);
          lastErr = err;
          const isTimeout = (err as Error)?.name === 'AbortError';
          console.warn(`Gemini fetch failed attempt ${attempt}/${maxAttempts}${isTimeout ? ' (timeout)' : ''}:`, err);
          if (attempt === maxAttempts) throw err;
          await new Promise(r => setTimeout(r, 400 * attempt));
        }
      }
      throw lastErr || new Error('Gemini call failed');
    }

    let response: Response;
    try {
      response = await callGemini();
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

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Gemini error for week ${week} day ${day}:`, errText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
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
