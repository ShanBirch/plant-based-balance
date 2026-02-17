
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
    const workoutHistory = userData?.workoutHistory || [];
    const weighIns = userData?.weighIns || [];
    const wearables = userData?.wearables || {};
    const adaptiveResult = userData?.adaptiveResult || null;
    const facts = userData?.facts || {};

    // Workout schedule context (this week)
    const weekSchedule = userData?.weekSchedule || [];
    const todayDayIndex = userData?.todayDayIndex ?? -1;
    const todayDate = userData?.todayDate || '';
    const activeReplacements = userData?.activeReplacements || [];

    // Format the weekly workout schedule
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    let scheduleSummary = '';
    if (weekSchedule.length === 7) {
      scheduleSummary = weekSchedule.map((day: any, i: number) => {
        const isToday = i === todayDayIndex;
        const replaced = activeReplacements.find((r: any) => r.day_of_week === i);
        let line = `${dayNames[i]}${isToday ? ' (TODAY)' : ''}: ${day.name || day.title || 'Rest'}`;
        if (replaced) {
          line += ` [REPLACED with: ${replaced.replacement_workout?.name || 'Unknown'}]`;
        }
        if (day.exercises && day.exercises.length > 0) {
          const exerciseNames = day.exercises.slice(0, 6).map((e: any) => e.name || e.exercise_name || e).join(', ');
          line += ` (${exerciseNames}${day.exercises.length > 6 ? '...' : ''})`;
        }
        return line;
      }).join('\n');
    } else {
      scheduleSummary = 'Workout schedule not available.';
    }

    // Format daily nutrition (last 14 days)
    const nutritionSummary = dailyNutrition.length > 0
      ? dailyNutrition.map((d: any) =>
          `${d.nutrition_date || d.date}: ${d.total_calories || 0} cal | P: ${d.total_protein_g || d.total_protein || 0}g | C: ${d.total_carbs_g || d.total_carbs || 0}g | F: ${d.total_fat_g || d.total_fat || 0}g (Goal: ${d.calorie_goal || '?'} cal)`
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
            return `  - ${m.type}: ${m.calories || '?'} cal, ${m.protein || '?'}g protein${itemStr ? ` (${itemStr})` : ''}`;
          }).join('\n');
          return `${day}:\n${mealList}`;
        }).join('\n')
      : 'No meals tracked recently.';

    // Format workout history (completed sessions)
    const workoutsByDay: Record<string, any[]> = {};
    workoutHistory.forEach((w: any) => {
      const day = w.workout_date || 'unknown';
      if (!workoutsByDay[day]) workoutsByDay[day] = [];
      workoutsByDay[day].push({
        exercise: w.exercise_name,
        sets: w.set_number,
        reps: w.reps,
        weight: w.weight_kg
      });
    });

    const workoutHistorySummary = Object.keys(workoutsByDay).length > 0
      ? Object.entries(workoutsByDay).map(([day, exercises]) => {
          const exerciseList = exercises.map((e: any) =>
            `  - ${e.exercise}: Set ${e.sets}, ${e.reps} reps @ ${e.weight}kg`
          ).join('\n');
          return `${day}:\n${exerciseList}`;
        }).join('\n')
      : 'No completed workouts recently.';

    // Format weigh-ins
    const weightSummary = weighIns.length > 0
      ? weighIns.map((w: any) => `${w.weigh_in_date}: ${w.weight_kg}kg`).join(', ')
      : 'No weigh-ins recorded recently.';

    // Format wearable data (compact)
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

    // Format adaptive adjustment
    let adaptiveSummary = 'No adaptive data.';
    if (adaptiveResult?.eligible && adaptiveResult?.suggestion) {
      adaptiveSummary = adaptiveResult.suggestion.reason;
      if (adaptiveResult.suggestion.direction !== 'none') {
        adaptiveSummary += ` Suggested: ${adaptiveResult.suggestion.direction} by ${adaptiveResult.suggestion.amount} cal (${adaptiveResult.currentCalorieGoal} → ${adaptiveResult.newCalorieGoal}).`;
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
Sex: ${quiz.sex || 'Unknown'} | Age: ${quiz.age || 'Unknown'}

=== NUTRITION GOALS ===
Daily Calorie Goal: ${quiz.calorie_goal || '?'} cal | Protein: ${quiz.protein_goal_g || '?'}g | Carbs: ${quiz.carbs_goal_g || '?'}g | Fat: ${quiz.fat_goal_g || '?'}g

=== THIS WEEK'S WORKOUT SCHEDULE ===
Today is: ${dayNames[todayDayIndex] || 'Unknown'} (${todayDate})
${scheduleSummary}

=== ADAPTIVE CALORIE RECOMMENDATION ===
${adaptiveSummary}

=== DAILY NUTRITION (Last 14 Days) ===
${nutritionSummary}

=== RECENT MEALS ===
${mealSummary}

=== COMPLETED WORKOUT HISTORY ===
${workoutHistorySummary}

=== WEIGHT HISTORY ===
${weightSummary}

=== WEARABLE DATA ===
${wearableSummary}

=== KNOWN FACTS ===
Struggles: ${facts.struggles?.join(', ') || 'None'}
Preferences: ${facts.preferences?.join(', ') || 'None'}
Health Notes: ${facts.health_notes?.join(', ') || 'None'}
Goals: ${facts.goals?.join(', ') || 'None'}
`;

    const systemPrompt = `You are FITGotchi AI, a smart personal fitness and nutrition assistant built into the FITGotchi app. You talk DIRECTLY to the user.

YOU CAN TAKE ACTIONS. You are not just a chatbot - you can actually modify the user's schedule, goals, and workouts. When the user asks you to do something, you SHOULD propose actions.

YOUR PERSONALITY:
- Warm, encouraging, knowledgeable about plant-based nutrition and exercise science
- Concise - users are on mobile, keep it short (2-4 paragraphs max)
- Reference their actual data (specific numbers, dates, workout names)
- Use their name naturally

=== AVAILABLE ACTIONS ===
When the user asks you to do something (move a workout, adjust calories, etc.), include an "actions" array in your JSON response. Available action types:

1. **swap_workouts** - Swap workouts between two days this week
   { "type": "swap_workouts", "day1_index": 0-6, "day2_index": 0-6, "day1_name": "Monday", "day2_name": "Tuesday", "description": "Swap Back Day and Legs Day" }
   IMPORTANT: When swapping, think about muscle group conflicts. Don't put two heavy leg days back-to-back. Consider recovery.

2. **replace_workout** - Replace a day's workout with a different one
   { "type": "replace_workout", "day_index": 0-6, "day_name": "Monday", "new_workout_name": "Yoga Flow", "new_workout_type": "rest|yoga|stretching|custom", "duration_weeks": 1, "description": "Replace Monday's workout with Yoga" }

3. **make_rest_day** - Turn a day into a rest day
   { "type": "make_rest_day", "day_index": 0-6, "day_name": "Monday", "description": "Make Monday a rest day" }

4. **update_calorie_goal** - Adjust the user's daily calorie goal
   { "type": "update_calorie_goal", "new_calorie_goal": 1800, "reason": "Weight has been stable, reducing by 100 cal", "description": "Adjust calories from 1900 to 1800" }

5. **update_macro_goals** - Adjust macro targets
   { "type": "update_macro_goals", "protein_g": 120, "carbs_g": 200, "fat_g": 60, "description": "Adjust macros for higher protein" }

6. **create_workout** - Build a new custom workout
   { "type": "create_workout", "name": "Upper Body Push", "exercises": [{"name": "Push Ups", "sets": 3, "reps": "10-12"}, ...], "description": "Create a push-focused upper body workout" }

=== RESPONSE FORMAT ===
You MUST respond in valid JSON with this exact structure:
{
  "reply": "Your conversational response to the user (can use markdown for formatting)",
  "actions": []
}

- "reply" is ALWAYS required - this is what the user sees
- "actions" is an array of action objects. Use an empty array [] if no actions needed
- When proposing actions, explain what you're doing in the "reply" and include the actions
- The user will see a confirmation dialog before any action executes
- You can include MULTIPLE actions in one response (e.g., swap two workouts = make day1 rest + replace day2)

=== WORKOUT SCHEDULING INTELLIGENCE ===
The schedule shows 7 days (Monday=0 to Sunday=6). When the user asks to move/swap workouts:
- Consider what's on BOTH days before suggesting a swap
- Think about muscle group recovery (don't put Chest after Shoulders, don't stack two leg days)
- If today is a rest day already and they want to skip, just acknowledge it
- If they want to move today's workout but tomorrow is also a training day, suggest a SWAP (not just moving one)
- Proactively mention conflicts: "Tomorrow you've got Legs scheduled - want me to swap them, or would you prefer I move today's session to your rest day on Thursday?"

=== IMPORTANT RULES ===
- NEVER give medical advice
- NEVER suggest non-plant-based foods
- NEVER make up data not in the context
- Be honest about data gaps
- Keep responses SHORT for mobile
- Return ONLY valid JSON - no markdown wrapping, no backticks around the JSON

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
      parts: [{ text: JSON.stringify({ reply: "I'm ready to help! I can see your full schedule, nutrition data, and workout history. What would you like to do?", actions: [] }) }]
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
          responseMimeType: "application/json",
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error:", JSON.stringify(data));
      throw new Error(data.error?.message || "Failed to fetch from Gemini");
    }

    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse the JSON response
    let parsedResponse;
    try {
      const cleaned = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedResponse = JSON.parse(cleaned);
    } catch {
      // If JSON parsing fails, treat whole response as plain text
      parsedResponse = { reply: aiText, actions: [] };
    }

    // Ensure response has required fields
    const result = {
      reply: parsedResponse.reply || parsedResponse.message || aiText || "Sorry, I couldn't generate a response.",
      actions: Array.isArray(parsedResponse.actions) ? parsedResponse.actions : []
    };

    return new Response(JSON.stringify(result), {
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
