
import type { Context } from "https://edge.netlify.com";

export default async function (request: Request, context: Context) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { message, userData, chatHistory } = await request.json();
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing API Key" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!message) {
      return new Response(JSON.stringify({ error: "Missing message" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build rich user context from all available data
    const profile = userData?.profile || {};
    const quiz = userData?.quizResults || {};
    const dailyNutrition = userData?.dailyNutrition || [];
    const meals = userData?.mealLogs || [];
    const workouts = userData?.workouts || [];
    const weighIns = userData?.weighIns || [];
    const checkins = userData?.checkins || [];
    const wearables = userData?.wearables || {};
    const adaptiveResult = userData?.adaptiveResult || null;
    const facts = userData?.facts || {};

    // Format daily nutrition (last 14 days)
    const nutritionSummary = dailyNutrition.length > 0
      ? dailyNutrition.map((d: any) =>
          `${d.nutrition_date || d.date}: ${d.total_calories || 0} cal | P: ${d.total_protein_g || d.total_protein || 0}g | C: ${d.total_carbs_g || d.total_carbs || 0}g | F: ${d.total_fat_g || d.total_fat || 0}g | Fibre: ${d.total_fiber_g || d.total_fiber || 0}g (Goal: ${d.calorie_goal || '?'} cal)`
        ).join('\n')
      : 'No nutrition data tracked recently.';

    // Format recent meals (last 7 days)
    const mealsByDay: Record<string, any[]> = {};
    meals.forEach((m: any) => {
      const day = m.meal_date || 'unknown';
      if (!mealsByDay[day]) mealsByDay[day] = [];
      mealsByDay[day].push({
        type: m.meal_type || 'meal',
        calories: m.calories,
        protein: m.protein_g,
        carbs: m.carbs_g,
        fat: m.fat_g,
        items: m.food_items
      });
    });

    const mealSummary = Object.keys(mealsByDay).length > 0
      ? Object.entries(mealsByDay).map(([day, dayMeals]) => {
          const mealList = dayMeals.map((m: any) => {
            let itemStr = '';
            if (m.items && Array.isArray(m.items)) {
              itemStr = m.items.map((i: any) => typeof i === 'string' ? i : (i.name || i.food || '')).filter(Boolean).join(', ');
            }
            return `  - ${m.type}: ${m.calories || '?'} cal, ${m.protein || '?'}g protein, ${m.carbs || '?'}g carbs, ${m.fat || '?'}g fat${itemStr ? ` (${itemStr})` : ''}`;
          }).join('\n');
          return `${day}:\n${mealList}`;
        }).join('\n')
      : 'No meals tracked recently.';

    // Format workouts
    const workoutsByDay: Record<string, any[]> = {};
    workouts.forEach((w: any) => {
      const day = w.workout_date || 'unknown';
      if (!workoutsByDay[day]) workoutsByDay[day] = [];
      workoutsByDay[day].push({
        exercise: w.exercise_name,
        sets: w.set_number,
        reps: w.reps,
        weight: w.weight_kg
      });
    });

    const workoutSummary = Object.keys(workoutsByDay).length > 0
      ? Object.entries(workoutsByDay).map(([day, exercises]) => {
          const exerciseList = exercises.map((e: any) =>
            `  - ${e.exercise}: Set ${e.sets}, ${e.reps} reps @ ${e.weight}kg`
          ).join('\n');
          return `${day}:\n${exerciseList}`;
        }).join('\n')
      : 'No workouts recorded recently.';

    // Format weigh-ins
    const weightSummary = weighIns.length > 0
      ? weighIns.map((w: any) => `${w.weigh_in_date}: ${w.weight_kg}kg`).join(', ')
      : 'No weigh-ins recorded recently.';

    // Format wearable data
    let wearableSummary = '';
    if (wearables.fitbitActivity?.length > 0) {
      wearableSummary += 'Fitbit: ' + wearables.fitbitActivity.map((a: any) =>
        `${a.date}: ${a.steps || 0} steps, ${a.calories_burned || 0} cal burned`
      ).join(' | ') + '\n';
    }
    if (wearables.ouraSleep?.length > 0) {
      wearableSummary += 'Oura Sleep: ' + wearables.ouraSleep.map((s: any) =>
        `Score ${s.score || '?'}, ${s.total_sleep || '?'}h`
      ).join(' | ') + '\n';
    }
    if (wearables.stravaActivities?.length > 0) {
      wearableSummary += 'Strava: ' + wearables.stravaActivities.map((a: any) =>
        `${a.name || a.type}: ${a.distance_km || '?'}km, ${a.calories || '?'} cal`
      ).join(' | ') + '\n';
    }
    if (!wearableSummary) wearableSummary = 'No wearable data available.';

    // Format adaptive adjustment recommendation
    let adaptiveSummary = 'No adaptive adjustment data available.';
    if (adaptiveResult) {
      if (adaptiveResult.eligible && adaptiveResult.suggestion) {
        adaptiveSummary = `Adaptive Analysis: ${adaptiveResult.suggestion.reason}`;
        if (adaptiveResult.suggestion.direction !== 'none') {
          adaptiveSummary += ` Suggested: ${adaptiveResult.suggestion.direction} calories by ${adaptiveResult.suggestion.amount} (from ${adaptiveResult.currentCalorieGoal} to ${adaptiveResult.newCalorieGoal}).`;
        }
        adaptiveSummary += ` Weight trend: ${adaptiveResult.weightChange > 0 ? '+' : ''}${adaptiveResult.weightChange}kg over 2 weeks. Tracking consistency: ${adaptiveResult.trackedDays}/14 days, ${adaptiveResult.adherenceRate}% adherence.`;
      } else if (adaptiveResult.eligible === false) {
        adaptiveSummary = `Not yet eligible for adaptive adjustment: ${adaptiveResult.message || adaptiveResult.reason}`;
      }
    }

    // Build the full user context
    const userContext = `
=== USER PROFILE ===
Name: ${profile.name || 'Unknown'}
Goal Body Type: ${quiz.goal_body_type || 'Unknown'}
Activity Level: ${quiz.activity_level || 'Unknown'}
Current Weight: ${weighIns.length > 0 ? weighIns[weighIns.length - 1]?.weight_kg + 'kg' : (quiz.weight ? quiz.weight + 'kg' : 'Unknown')}
Goal Weight: ${quiz.goal_weight || 'Unknown'}kg
Sex: ${quiz.sex || 'Unknown'}
Age: ${quiz.age || 'Unknown'}

=== NUTRITION GOALS ===
BMR: ${quiz.bmr || '?'} cal | TDEE: ${quiz.tdee || '?'} cal
Daily Calorie Goal: ${quiz.calorie_goal || '?'} cal
Protein Goal: ${quiz.protein_goal_g || '?'}g | Carbs Goal: ${quiz.carbs_goal_g || '?'}g | Fat Goal: ${quiz.fat_goal_g || '?'}g

=== KNOWN FACTS ===
Struggles: ${facts.struggles?.length > 0 ? facts.struggles.join(', ') : 'None recorded'}
Preferences: ${facts.preferences?.length > 0 ? facts.preferences.join(', ') : 'None recorded'}
Health Notes: ${facts.health_notes?.length > 0 ? facts.health_notes.join(', ') : 'None recorded'}
Goals: ${facts.goals?.length > 0 ? facts.goals.join(', ') : 'None recorded'}

=== ADAPTIVE CALORIE RECOMMENDATION ===
${adaptiveSummary}

=== DAILY NUTRITION (Last 14 Days) ===
${nutritionSummary}

=== RECENT MEALS ===
${mealSummary}

=== RECENT WORKOUTS ===
${workoutSummary}

=== WEIGHT HISTORY ===
${weightSummary}

=== WEARABLE DATA ===
${wearableSummary}
`;

    const systemPrompt = `You are FITGotchi AI, a friendly and knowledgeable plant-based nutrition and fitness assistant built into the FITGotchi app.

YOU ARE TALKING DIRECTLY TO THE USER (not to a coach or admin). You are their personal AI assistant.

YOUR PERSONALITY:
- Warm, encouraging, and knowledgeable
- Casual but not overly informal - you're a helpful assistant, not a texting buddy
- You know a lot about plant-based nutrition, exercise science, and healthy habits
- Be concise - keep responses focused and actionable
- Use the user's name when it feels natural
- You can use bullet points and short paragraphs for clarity

YOUR CAPABILITIES:
1. **Nutrition Guidance**: Analyse their meal logs, daily nutrition, and macro goals. Tell them how they're tracking against goals. Suggest improvements.
2. **Calorie Recommendations**: You have access to their adaptive calorie analysis. If their calories need adjusting, explain why in a supportive way.
3. **Workout Insights**: Review their workout history. Spot consistency patterns, suggest exercises, celebrate progress.
4. **Weight Trend Analysis**: Look at their weigh-in history and relate it to their goals. Be sensitive - weight is personal.
5. **Meal Ideas**: Suggest plant-based meals that fit their macro targets. Be practical and specific.
6. **Wearable Data**: If they have connected wearables (Fitbit, Oura, Strava), reference that data for sleep, activity, and recovery insights.
7. **General Health Q&A**: Answer questions about plant-based nutrition, exercise, supplements (B12, iron, etc.), and healthy habits.
8. **Motivation & Accountability**: Celebrate streaks, consistency, and progress. Gently nudge when tracking gaps appear.

IMPORTANT RULES:
- NEVER give medical advice. For medical concerns, recommend they see a healthcare professional.
- NEVER suggest non-plant-based foods. This is a plant-based program.
- Be honest about data gaps. If they haven't tracked meals this week, mention it encouragingly.
- When recommending calorie changes, explain the reasoning (weight trend, activity level, goals).
- Keep responses SHORT and actionable. 2-4 short paragraphs max for most responses. Users are on mobile.
- If you don't have enough data to answer a question well, say so and suggest what they could track.
- Reference SPECIFIC data points from their history when possible (e.g., "I can see you hit 1,850 cal yesterday which is right on your 1,900 goal").
- NEVER make up or hallucinate data that isn't provided in the context.

HERE IS EVERYTHING YOU KNOW ABOUT THIS USER:
${userContext}`;

    // Build chat contents for Gemini
    const contents: any[] = [];

    contents.push({
      role: "user",
      parts: [{ text: `SYSTEM: ${systemPrompt}` }]
    });
    contents.push({
      role: "model",
      parts: [{ text: "Understood. I'm FITGotchi AI, ready to help the user with personalised nutrition and fitness guidance based on their data. I'll keep responses concise, reference their actual data, and stay focused on plant-based nutrition." }]
    });

    // Add chat history
    if (chatHistory && Array.isArray(chatHistory)) {
      chatHistory.forEach((msg: any) => {
        const role = msg.role === 'user' ? 'user' : 'model';
        const text = msg.text || msg.message_text || '';
        if (!text) return;

        if (contents.length > 0 && contents[contents.length - 1].role === role) {
          contents[contents.length - 1].parts[0].text += `\n\n${text}`;
        } else {
          contents.push({ role, parts: [{ text }] });
        }
      });
    }

    // Add current message
    if (contents.length > 0 && contents[contents.length - 1].role === "user") {
      contents[contents.length - 1].parts[0].text += `\n\n${message}`;
    } else {
      contents.push({ role: "user", parts: [{ text: message }] });
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.7,
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error:", JSON.stringify(data));
      throw new Error(data.error?.message || "Failed to fetch from Gemini");
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response. Try again!";

    return new Response(JSON.stringify({ reply }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in home-ai-chat:", error);
    return new Response(JSON.stringify({
      error: "Internal Server Error",
      details: error instanceof Error ? error.message : String(error),
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
