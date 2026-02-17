
import type { Context } from "https://edge.netlify.com";

/**
 * Generate a personalized 4-week meal plan using Gemini AI
 * Also generates meal photos using Gemini Imagen 3
 *
 * POST body: { userData: { profile, quizResults, facts, foodPreferences } }
 * Returns: { plan: { weeks: [...] }, images: { [mealKey]: base64 } }
 */

export default async function (request: Request, context: Context) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { userData } = await request.json();
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing API Key" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const profile = userData?.profile || {};
    const quiz = userData?.quizResults || {};
    const facts = userData?.facts || {};
    const foodPrefs = userData?.foodPreferences || {};

    // Build the personalization context
    const userContext = `
=== USER PROFILE ===
Name: ${profile.name || 'User'}
Sex: ${quiz.sex || 'Unknown'}
Age: ${quiz.age || 'Unknown'}
Current Weight: ${quiz.weight || 'Unknown'}kg
Goal Weight: ${quiz.goal_weight || 'Unknown'}kg
Height: ${quiz.height || 'Unknown'}cm
Activity Level: ${quiz.activity_level || 'moderate'}
Goal Body Type: ${quiz.goal_body_type || 'lean and toned'}
Hormone Profile: ${quiz.hormone_profile || 'Unknown'}

=== NUTRITION GOALS ===
Daily Calorie Goal: ${quiz.calorie_goal || 1800} cal
Protein: ${quiz.protein_goal_g || 100}g
Carbs: ${quiz.carbs_goal_g || 200}g
Fat: ${quiz.fat_goal_g || 60}g

=== DIETARY PREFERENCES ===
Diet Type: ${foodPrefs.diet_type || 'vegan'}
Allergies: ${foodPrefs.allergies?.join(', ') || 'None'}
Intolerances: ${foodPrefs.intolerances?.join(', ') || 'None'}
Dislikes: ${foodPrefs.dislikes?.join(', ') || 'None'}
Favorites: ${foodPrefs.favorites?.join(', ') || 'None'}
Cuisine Preferences: ${foodPrefs.cuisine_preferences?.join(', ') || 'Any'}
Prep Time Preference: ${foodPrefs.prep_time_preference || 'moderate'}
Cooking Skill: ${foodPrefs.cooking_skill || 'intermediate'}
Batch Cooking OK: ${foodPrefs.batch_cooking_ok ?? true}
Meals Per Day: ${foodPrefs.meals_per_day || 5}
Equipment: ${[foodPrefs.has_blender ? 'Blender' : '', foodPrefs.has_air_fryer ? 'Air Fryer' : '', foodPrefs.has_instant_pot ? 'Instant Pot' : ''].filter(Boolean).join(', ') || 'Standard kitchen'}

=== GOALS & STRUGGLES ===
Goals: ${facts.goals?.join(', ') || 'General health'}
Struggles: ${facts.struggles?.join(', ') || 'None specified'}
Health Notes: ${facts.health_notes?.join(', ') || 'None'}
Preferences: ${facts.preferences?.join(', ') || 'None'}
`;

    // Step 1: Generate the full 4-week meal plan via Gemini
    const mealPlanPrompt = `You are an expert plant-based nutritionist and meal planner. Generate a COMPLETE personalized 4-week meal plan for this user.

${userContext}

REQUIREMENTS:
- Generate EXACTLY 4 weeks, 7 days each, 5 meals per day (breakfast, am_snack, lunch, pm_snack, dinner)
- TOTAL: 140 meals
- All meals must be ${foodPrefs.diet_type || 'vegan'} / plant-based
- Hit the daily macro targets: ~${quiz.calorie_goal || 1800} cal, ~${quiz.protein_goal_g || 100}g protein, ~${quiz.carbs_goal_g || 200}g carbs, ~${quiz.fat_goal_g || 60}g fat
- Avoid user's allergies and dislikes
- Prioritize user's favorite foods and cuisine preferences
- Each week should have a THEME that builds progressively:
  - Week 1: Foundation / Reset (simple, nourishing meals)
  - Week 2: Build & Energize (higher protein, more variety)
  - Week 3: Peak Performance (optimized macros, diverse cuisines)
  - Week 4: Sustain & Thrive (balanced, sustainable long-term meals)
- Include realistic prep times based on cooking skill
- Vary the cuisines and meal types throughout

RESPOND WITH VALID JSON ONLY. Structure:
{
  "plan_name": "string - catchy personalized plan name",
  "plan_description": "string - 1-2 sentence description",
  "weeks": [
    {
      "week_number": 1,
      "theme": "string",
      "theme_description": "string - why this week matters",
      "days": [
        {
          "day_of_week": 0,
          "day_name": "Monday",
          "meals": [
            {
              "meal_slot": "breakfast",
              "meal_time": "7:30 AM",
              "name": "string",
              "description": "string - short appetizing description",
              "calories": number,
              "protein_g": number,
              "carbs_g": number,
              "fat_g": number,
              "fiber_g": number,
              "ingredients": [
                { "name": "string", "amount": "string" }
              ],
              "preparation": "string - brief cooking instructions",
              "prep_time_mins": number,
              "cook_time_mins": number,
              "tags": ["string"],
              "cuisine": "string"
            }
          ]
        }
      ]
    }
  ]
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const planResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: mealPlanPrompt }] }],
        generationConfig: {
          maxOutputTokens: 65536,
          temperature: 0.8,
          responseMimeType: "application/json",
        }
      })
    });

    if (!planResponse.ok) {
      const errText = await planResponse.text();
      console.error("Gemini plan generation error:", errText);
      throw new Error("Failed to generate meal plan: " + planResponse.status);
    }

    const planData = await planResponse.json();
    const planText = planData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let mealPlan;
    try {
      const cleaned = planText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      mealPlan = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Failed to parse meal plan JSON:", parseErr, planText.substring(0, 500));
      throw new Error("Failed to parse meal plan response");
    }

    // Step 2: Generate images for a selection of key meals using Gemini Imagen 3
    // We'll generate images for the first meal of each day for week 1 (7 images),
    // plus the overview/hero meal for weeks 2-4 (3 images) = 10 images total
    // This keeps API costs manageable while providing visual variety
    const imagesToGenerate: { key: string; prompt: string }[] = [];

    // Collect meals to generate images for
    if (mealPlan.weeks) {
      for (const week of mealPlan.weeks) {
        if (!week.days) continue;
        for (const day of week.days) {
          if (!day.meals) continue;
          // Generate images for breakfast and dinner only (2 per day = 56 total would be too many)
          // Instead: generate for ALL meals but we'll do it in batches and use a fast approach
          // For MVP: generate 1 image per day (the dinner/main meal) = 28 images
          const mainMeal = day.meals.find((m: any) => m.meal_slot === 'dinner') ||
                           day.meals.find((m: any) => m.meal_slot === 'lunch') ||
                           day.meals[0];
          if (mainMeal) {
            const key = `w${week.week_number}_d${day.day_of_week}`;
            imagesToGenerate.push({
              key,
              prompt: `Professional food photography of "${mainMeal.name}": ${mainMeal.description || mainMeal.name}. Plant-based vegan meal, beautifully plated on a ceramic dish, natural lighting, overhead angle, kitchen background, appetizing and vibrant colors, high resolution food blog style.`
            });
          }
        }
      }
    }

    // Generate images in parallel batches (Imagen 3 via Gemini API)
    const imageResults: Record<string, string> = {};
    const BATCH_SIZE = 5; // Process 5 at a time to avoid rate limits

    for (let i = 0; i < imagesToGenerate.length; i += BATCH_SIZE) {
      const batch = imagesToGenerate.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(async (img) => {
        try {
          const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;

          const imgResponse = await fetch(imagenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              instances: [{ prompt: img.prompt }],
              parameters: {
                sampleCount: 1,
                aspectRatio: "16:9",
                safetyFilterLevel: "BLOCK_MEDIUM_AND_ABOVE",
              }
            })
          });

          if (imgResponse.ok) {
            const imgData = await imgResponse.json();
            const b64 = imgData.predictions?.[0]?.bytesBase64Encoded;
            if (b64) {
              return { key: img.key, image: `data:image/png;base64,${b64}` };
            }
          } else {
            // Fallback: try generateContent with image generation
            const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
            const fallbackResponse = await fetch(fallbackUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: `Generate a photo of this meal: ${img.prompt}` }] }],
                generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
              })
            });
            if (fallbackResponse.ok) {
              const fallbackData = await fallbackResponse.json();
              const parts = fallbackData.candidates?.[0]?.content?.parts || [];
              for (const part of parts) {
                if (part.inlineData) {
                  return { key: img.key, image: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` };
                }
              }
            }
          }
          return { key: img.key, image: null };
        } catch (err) {
          console.warn(`Image generation failed for ${img.key}:`, err);
          return { key: img.key, image: null };
        }
      });

      const results = await Promise.allSettled(batchPromises);
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value?.image) {
          imageResults[result.value.key] = result.value.image;
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      plan: mealPlan,
      images: imageResults,
      generatedAt: new Date().toISOString()
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
