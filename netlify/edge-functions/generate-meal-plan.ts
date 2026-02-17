
import type { Context } from "https://edge.netlify.com";

/**
 * Generate a personalized meal plan for a SINGLE WEEK using Gemini AI.
 * Called 4 times by the frontend (once per week) to avoid edge function timeouts.
 *
 * POST body: {
 *   userData: { profile, quizResults, facts, foodPreferences },
 *   weekNumber: 1-4,
 *   previousWeeks: [{ theme, mealNames[] }]  // summary of prior weeks for continuity
 * }
 * Returns: { success, week: { week_number, theme, theme_description, days: [...] } }
 */

export default async function (request: Request, context: Context) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await request.json();
    const { userData, weekNumber, previousWeeks } = body;
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

    const profile = userData?.profile || {};
    const quiz = userData?.quizResults || {};
    const facts = userData?.facts || {};
    const foodPrefs = userData?.foodPreferences || {};

    const dietType = foodPrefs.diet_type || 'vegan';
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

    // Build context about previous weeks to avoid meal repetition
    let previousContext = '';
    if (previousWeeks && Array.isArray(previousWeeks) && previousWeeks.length > 0) {
      previousContext = `\n\nPREVIOUS WEEKS (DO NOT repeat these meals - create NEW ones):\n`;
      previousWeeks.forEach((pw: any) => {
        previousContext += `Week ${pw.weekNumber}: ${pw.theme} - Meals included: ${(pw.mealNames || []).slice(0, 20).join(', ')}\n`;
      });
    }

    const prompt = `You are an expert plant-based nutritionist. Generate WEEK ${week} of a personalized meal plan.

=== USER PROFILE ===
Name: ${profile.name || 'User'}
Sex: ${quiz.sex || 'Unknown'} | Age: ${quiz.age || 'Unknown'}
Weight: ${quiz.weight || '?'}kg -> Goal: ${quiz.goal_weight || '?'}kg | Height: ${quiz.height || '?'}cm
Activity: ${quiz.activity_level || 'moderate'} | Goal: ${quiz.goal_body_type || 'lean and toned'}
Hormone Profile: ${quiz.hormone_profile || 'N/A'}

=== NUTRITION TARGETS (per day) ===
Calories: ~${calorieGoal} | Protein: ~${proteinGoal}g | Carbs: ~${carbsGoal}g | Fat: ~${fatGoal}g

=== DIETARY ===
Diet: ${dietType} (100% plant-based)
Allergies: ${foodPrefs.allergies?.join(', ') || 'None'}
Dislikes: ${foodPrefs.dislikes?.join(', ') || 'None'}
Favorites: ${foodPrefs.favorites?.join(', ') || 'None'}
Cuisines: ${foodPrefs.cuisine_preferences?.join(', ') || 'Any'}
Skill: ${foodPrefs.cooking_skill || 'intermediate'} | Prep time: ${foodPrefs.prep_time_preference || 'moderate'}
Equipment: ${[foodPrefs.has_blender ? 'Blender' : '', foodPrefs.has_air_fryer ? 'Air Fryer' : '', foodPrefs.has_instant_pot ? 'Instant Pot' : ''].filter(Boolean).join(', ') || 'Standard'}

=== GOALS ===
${facts.goals?.join(', ') || 'General wellness'}
Struggles: ${facts.struggles?.join(', ') || 'None'}
${previousContext}

=== WEEK ${week} THEME: "${currentTheme.theme}" ===
Focus: ${currentTheme.focus}

Generate EXACTLY 7 days, 5 meals each (breakfast, am_snack, lunch, pm_snack, dinner) = 35 meals total.
Each day's meals should sum to approximately ${calorieGoal} calories and ${proteinGoal}g protein.
All meals must be ${dietType} / plant-based. NO animal products.
Make meals varied, delicious, and practical. Different cuisines across days.

=== CRITICAL: CALORIE & PORTION ACCURACY ===
You MUST follow these per-meal calorie ranges strictly. These are for ONE PERSON, standard portion sizes:
- Breakfast: ${Math.round(calorieGoal * 0.25)}-${Math.round(calorieGoal * 0.3)} calories (roughly 25-30% of daily goal)
- AM Snack: ${Math.round(calorieGoal * 0.08)}-${Math.round(calorieGoal * 0.12)} calories (roughly 8-12% of daily goal)
- Lunch: ${Math.round(calorieGoal * 0.28)}-${Math.round(calorieGoal * 0.32)} calories (roughly 28-32% of daily goal)
- PM Snack: ${Math.round(calorieGoal * 0.08)}-${Math.round(calorieGoal * 0.12)} calories (roughly 8-12% of daily goal)
- Dinner: ${Math.round(calorieGoal * 0.25)}-${Math.round(calorieGoal * 0.3)} calories (roughly 25-30% of daily goal)

ABSOLUTE RULES:
1. NO meal may exceed 700 calories. A meal over 700 cal is ALWAYS wrong - reduce the portion.
2. NO snack may exceed 300 calories. Snacks are small - a handful of nuts, a piece of fruit, a small smoothie.
3. Portion sizes must be realistic for ONE person (e.g., 1 cup soup NOT 4 cups, 1 serving pasta NOT 3 servings).
4. Cross-check: calories must match the ingredients and amounts listed. A simple lentil soup (1.5 cups) is ~250-350 cal, NOT 800+.
5. Macros must add up: (protein_g × 4) + (carbs_g × 4) + (fat_g × 9) should approximately equal the stated calories (within 10%).
6. Common calorie references for accuracy:
   - 1 cup cooked lentils = ~230 cal
   - 1 cup cooked rice = ~200 cal
   - 1 cup cooked quinoa = ~220 cal
   - 1 tbsp olive oil = ~120 cal
   - 1 medium banana = ~105 cal
   - 1 block tofu (14oz) = ~350 cal (a serving is usually 1/3 to 1/2 block)
   - 1 cup cooked chickpeas = ~270 cal
   - 1 avocado = ~320 cal (half = ~160 cal)
Double-check every meal's calories against the ingredient amounts before finalizing.

RESPOND WITH VALID JSON:
{
  "week_number": ${week},
  "theme": "${currentTheme.theme}",
  "theme_description": "string",
  "days": [
    {
      "day_of_week": 0,
      "day_name": "Monday",
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
    }
  ]
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 65536,
          temperature: 0.7,
          responseMimeType: "application/json",
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Gemini error for week ${week}:`, errText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let weekData;
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      weekData = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Failed to parse week JSON:", parseErr, text.substring(0, 500));
      throw new Error("Failed to parse meal plan response");
    }

    // Ensure required fields
    weekData.week_number = week;
    weekData.theme = weekData.theme || currentTheme.theme;
    weekData.theme_description = weekData.theme_description || currentTheme.focus;

    // Ensure we have 7 days - if Gemini returned fewer, log a warning
    if (!weekData.days || !Array.isArray(weekData.days)) {
      weekData.days = [];
    }
    if (weekData.days.length < 7) {
      console.warn(`Gemini only returned ${weekData.days.length} days for week ${week}, expected 7`);
    }
    // Normalize day_of_week values
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    weekData.days.forEach((day: any, idx: number) => {
      if (day.day_of_week === undefined || day.day_of_week === null) {
        day.day_of_week = idx;
      }
      if (!day.day_name) {
        day.day_name = dayNames[day.day_of_week] || dayNames[idx];
      }
    });

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
    if (weekData.days && Array.isArray(weekData.days)) {
      for (const day of weekData.days) {
        if (!day.meals || !Array.isArray(day.meals)) continue;
        for (const meal of day.meals) {
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

          // Hard clamp: no meal over absolute max, no snack over 300
          if (meal.calories > max) {
            // Scale macros proportionally
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
    }
    if (correctedCount > 0) {
      console.log(`Corrected ${correctedCount} meals with unrealistic calorie values in week ${week}`);
    }

    return new Response(JSON.stringify({
      success: true,
      week: weekData,
    }), {
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
