
import type { Context } from "https://edge.netlify.com";

export default async function (request: Request, context: Context) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { query, userData, chatHistory } = await request.json();
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing API Key" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!query || !userData) {
      return new Response(JSON.stringify({ error: "Missing query or userData" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build a rich context string from all the user data
    const profile = userData.profile || {};
    const facts = userData.facts || {};
    const quiz = userData.quizResults || {};
    const workouts = userData.workouts || [];
    const meals = userData.mealLogs || [];
    const dailyNutrition = userData.dailyNutrition || [];
    const checkins = userData.checkins || [];
    const conversations = userData.conversations || [];
    const wearables = userData.wearables || {};
    const personalBests = userData.personalBests || [];

    // Format workouts by day
    const workoutsByDay: Record<string, any[]> = {};
    workouts.forEach((w: any) => {
      const day = w.workout_date || 'unknown';
      if (!workoutsByDay[day]) workoutsByDay[day] = [];
      workoutsByDay[day].push({
        exercise: w.exercise_name,
        sets: w.set_number,
        reps: w.reps,
        weight: w.weight_kg,
        time: w.time_duration,
        dropSet: w.is_drop_set ? `Yes (weights: ${w.drop_set_weights}, reps: ${w.drop_set_reps})` : 'No'
      });
    });

    const workoutSummary = Object.keys(workoutsByDay).length > 0
      ? Object.entries(workoutsByDay).map(([day, exercises]) => {
          const exerciseList = exercises.map((e: any) =>
            `  - ${e.exercise}: Set ${e.sets}, ${e.reps} reps @ ${e.weight}kg${e.time ? `, ${e.time}` : ''}${e.dropSet !== 'No' ? ` (Drop set: ${e.dropSet})` : ''}`
          ).join('\n');
          return `${day}:\n${exerciseList}`;
        }).join('\n\n')
      : 'No workouts recorded in this period.';

    // Format meals by day
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
        items: m.food_items,
        confidence: m.confidence
      });
    });

    const mealSummary = Object.keys(mealsByDay).length > 0
      ? Object.entries(mealsByDay).map(([day, dayMeals]) => {
          const mealList = dayMeals.map((m: any) => {
            let itemStr = '';
            if (m.items && Array.isArray(m.items)) {
              itemStr = m.items.map((i: any) => typeof i === 'string' ? i : (i.name || i.food || JSON.stringify(i))).join(', ');
            } else if (m.items) {
              itemStr = JSON.stringify(m.items);
            }
            return `  - ${m.type}: ${m.calories || '?'} cal, ${m.protein || '?'}g protein, ${m.carbs || '?'}g carbs, ${m.fat || '?'}g fat${itemStr ? ` (${itemStr})` : ''}`;
          }).join('\n');
          return `${day}:\n${mealList}`;
        }).join('\n\n')
      : 'No meals tracked in this period.';

    // Format daily nutrition totals
    const nutritionSummary = dailyNutrition.length > 0
      ? dailyNutrition.map((d: any) =>
          `${d.date}: ${d.total_calories || 0} cal total | Protein: ${d.total_protein || 0}g | Carbs: ${d.total_carbs || 0}g | Fat: ${d.total_fat || 0}g | Fibre: ${d.total_fiber || 0}g`
        ).join('\n')
      : 'No daily nutrition summaries.';

    // Format check-ins
    const checkinSummary = checkins.length > 0
      ? checkins.map((c: any) => {
          const parts = [`Date: ${c.checkin_date}`];
          if (c.energy) parts.push(`Energy: ${c.energy}`);
          if (c.sleep) parts.push(`Sleep: ${c.sleep}`);
          if (c.equipment) parts.push(`Equipment: ${c.equipment}`);
          if (c.water_intake) parts.push(`Water: ${c.water_intake}`);
          if (c.additional_data) parts.push(`Extra: ${JSON.stringify(c.additional_data)}`);
          return parts.join(' | ');
        }).join('\n')
      : 'No check-ins recorded.';

    // Format recent conversations (last 30 messages)
    const recentConvos = conversations.slice(-30);
    const convoSummary = recentConvos.length > 0
      ? recentConvos.map((c: any) => {
          const time = new Date(c.timestamp).toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
          return `[${time}] ${c.role === 'user' ? profile.name || 'User' : 'Shannon'}: ${c.message_text}`;
        }).join('\n')
      : 'No conversations in this period.';

    // Format wearable data
    let wearableSummary = '';
    if (wearables.fitbitActivity?.length > 0) {
      wearableSummary += '\nFitbit Activity:\n' + wearables.fitbitActivity.map((a: any) =>
        `${a.date}: ${a.steps || 0} steps, ${a.calories_burned || 0} cal burned, ${a.active_minutes || 0} active mins`
      ).join('\n');
    }
    if (wearables.fitbitSleep?.length > 0) {
      wearableSummary += '\nFitbit Sleep:\n' + wearables.fitbitSleep.map((s: any) =>
        `${s.date}: ${s.duration_hours || '?'}h sleep, efficiency: ${s.efficiency || '?'}%`
      ).join('\n');
    }
    if (wearables.whoopRecovery?.length > 0) {
      wearableSummary += '\nWHOOP Recovery:\n' + wearables.whoopRecovery.map((r: any) =>
        `Score: ${r.recovery_score || '?'}%, HRV: ${r.hrv || '?'}, RHR: ${r.resting_hr || '?'}`
      ).join('\n');
    }
    if (wearables.whoopSleep?.length > 0) {
      wearableSummary += '\nWHOOP Sleep:\n' + wearables.whoopSleep.map((s: any) =>
        `Performance: ${s.sleep_performance || '?'}%, Duration: ${s.total_sleep_hours || '?'}h`
      ).join('\n');
    }
    if (wearables.ouraReadiness?.length > 0) {
      wearableSummary += '\nOura Readiness:\n' + wearables.ouraReadiness.map((r: any) =>
        `Score: ${r.score || '?'}, HRV: ${r.hrv_balance || '?'}, Temp: ${r.body_temperature || '?'}`
      ).join('\n');
    }
    if (wearables.ouraSleep?.length > 0) {
      wearableSummary += '\nOura Sleep:\n' + wearables.ouraSleep.map((s: any) =>
        `Score: ${s.score || '?'}, Duration: ${s.total_sleep || '?'}h, Efficiency: ${s.efficiency || '?'}%`
      ).join('\n');
    }
    if (wearables.stravaActivities?.length > 0) {
      wearableSummary += '\nStrava Activities:\n' + wearables.stravaActivities.map((a: any) =>
        `${a.name || a.type}: ${a.distance_km || '?'}km, ${a.moving_time_minutes || '?'}min, ${a.calories || '?'} cal`
      ).join('\n');
    }
    if (!wearableSummary) wearableSummary = 'No wearable data connected or recorded.';

    // Format personal bests
    const pbSummary = personalBests.length > 0
      ? personalBests.map((pb: any) =>
          `${pb.exercise_name}: ${pb.weight_kg}kg x ${pb.reps} reps (${pb.achieved_date})`
        ).join('\n')
      : 'No personal bests recorded.';

    // Build the full context for the AI
    const fullContext = `
=== CLIENT PROFILE ===
Name: ${profile.name || 'Unknown'}
Email: ${profile.email || 'Unknown'}
Joined: ${profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-AU') : 'Unknown'}
Last Login: ${profile.last_login ? new Date(profile.last_login).toLocaleString('en-AU') : 'Never'}
Subscription: ${profile.subscription_status || 'Unknown'} (${profile.subscription_type || 'N/A'})

=== KNOWN FACTS ABOUT CLIENT ===
Location: ${facts.location || 'Not specified'}
Struggles: ${facts.struggles?.length > 0 ? facts.struggles.join(', ') : 'None recorded'}
Preferences: ${facts.preferences?.length > 0 ? facts.preferences.join(', ') : 'None recorded'}
Health Notes: ${facts.health_notes?.length > 0 ? facts.health_notes.join(', ') : 'None recorded'}
Personal Details: ${facts.personal_details?.length > 0 ? facts.personal_details.join(', ') : 'None recorded'}
Goals: ${facts.goals?.length > 0 ? facts.goals.join(', ') : 'None recorded'}
Sleep Quality: ${facts.sleep_quality || 'Unknown'}
Energy Level: ${facts.energy_level || 'Unknown'}

=== NUTRITION PROFILE (from Quiz) ===
Menopause Status: ${quiz.menopause_status || 'Unknown'}
Hormone Profile: ${quiz.hormone_profile || 'Unknown'}
BMR: ${quiz.bmr || '?'} | TDEE: ${quiz.tdee || '?'}
Calorie Goal: ${quiz.calorie_goal || '?'} cal/day
Protein Goal: ${quiz.protein_goal_g || '?'}g/day

=== WORKOUTS (Last ${userData._days || 7} Days) ===
${workoutSummary}

=== PERSONAL BESTS ===
${pbSummary}

=== MEALS TRACKED (Last ${userData._days || 7} Days) ===
${mealSummary}

=== DAILY NUTRITION TOTALS ===
${nutritionSummary}

=== DAILY CHECK-INS ===
${checkinSummary}

=== RECENT CONVERSATIONS WITH SHANNON ===
${convoSummary}

=== WEARABLE DATA ===
${wearableSummary}
`;

    const systemPrompt = `You are an AI coaching assistant for Shannon, who runs FITGotchi - a plant-based nutrition and fitness coaching platform.

Your job is to help Shannon (the admin/coach) review and understand his clients' data. You are Shannon's behind-the-scenes assistant.

When Shannon asks you about a client, you have access to ALL their data: workouts, meals, check-ins, conversations, wearable data, personal facts, quiz results, and more.

YOUR CAPABILITIES:
1. **Weekly Reviews**: Summarise what a client did this week - workouts completed, meals tracked, check-ins, patterns
2. **Check-in Reports**: Write a coaching check-in review for a client based on their data
3. **Pattern Analysis**: Spot trends in their training, nutrition, sleep, energy
4. **Coaching Suggestions**: Recommend what Shannon should focus on with this client
5. **Conversation Analysis**: Review what topics came up in their chats with Shannon
6. **Compliance Tracking**: How consistent are they with tracking meals, doing workouts, checking in
7. **Draft Messages**: Write draft messages Shannon could send to the client
8. **Nutrition Analysis**: Assess if they're hitting their macro/calorie goals
9. **Workout Progress**: Track if they're progressing in weights, volume, consistency

RESPONSE STYLE:
- Be direct, professional but casual - you're talking to Shannon, not the client
- Use Australian casual language since Shannon is Australian
- Present data clearly with structure (use headers, bullet points, numbers)
- Highlight the IMPORTANT stuff first - what needs attention
- If data is missing or sparse, say so clearly
- When writing draft messages for clients, match Shannon's texting style (casual, short messages, "lovely", Australian slang)
- Use markdown formatting for readability (headers, bold, lists)
- If asked to write a check-in review, structure it with clear sections

IMPORTANT:
- You are NOT talking to the client. You are talking to Shannon the coach.
- Be honest about gaps in data - if a client hasn't tracked meals, say that
- Flag concerning patterns (e.g., no workouts for 3 days, skipping meals, low energy reports)
- Celebrate wins too - consistency streaks, PBs, good nutrition days

Here is the complete data for the client being discussed:
${fullContext}`;

    // Build chat contents for Gemini
    const contents: any[] = [];

    contents.push({
      role: "user",
      parts: [{ text: `SYSTEM: ${systemPrompt}` }]
    });
    contents.push({
      role: "model",
      parts: [{ text: "Got it. I have all the client data loaded and ready to help you review your clients. What would you like to know?" }]
    });

    // Add previous chat history if provided
    if (chatHistory && Array.isArray(chatHistory)) {
      chatHistory.forEach((msg: any) => {
        const role = msg.role === 'user' ? 'user' : 'model';
        const text = msg.text || '';
        if (!text) return;

        if (contents.length > 0 && contents[contents.length - 1].role === role) {
          contents[contents.length - 1].parts[0].text += `\n\n${text}`;
        } else {
          contents.push({ role, parts: [{ text }] });
        }
      });
    }

    // Add current query
    if (contents.length > 0 && contents[contents.length - 1].role === "user") {
      contents[contents.length - 1].parts[0].text += `\n\n${query}`;
    } else {
      contents.push({ role: "user", parts: [{ text: query }] });
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.7,
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error:", JSON.stringify(data));
      throw new Error(data.error?.message || "Failed to fetch from Gemini");
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";

    return new Response(JSON.stringify({ reply }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in admin-ai-coach:", error);
    return new Response(JSON.stringify({
      error: "Internal Server Error",
      details: error instanceof Error ? error.message : String(error),
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
