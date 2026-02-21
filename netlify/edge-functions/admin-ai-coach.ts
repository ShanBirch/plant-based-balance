
import type { Context } from "https://edge.netlify.com";

export default async function (request: Request, context: Context) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { query, userData, chatHistory, analyticsSummary, coachPersonality } = await request.json();
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing API Key" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!query) {
      return new Response(JSON.stringify({ error: "Missing query" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build coach personality context if provided
    let personalityPrompt = '';
    if (coachPersonality) {
      const parts: string[] = [];
      if (coachPersonality.traits?.length > 0) {
        parts.push(`Coaching tone/style traits: ${coachPersonality.traits.join(', ')}`);
      }
      if (coachPersonality.example_messages?.trim()) {
        parts.push(`REAL EXAMPLE MESSAGES FROM THE COACH (learn their exact voice from these):\n${coachPersonality.example_messages.trim()}`);
      }
      if (coachPersonality.phrases?.trim()) {
        parts.push(`SPECIFIC PHRASES & LANGUAGE STYLE the coach uses:\n${coachPersonality.phrases.trim()}`);
      }
      if (coachPersonality.avoid?.trim()) {
        parts.push(`THINGS THE COACH WANTS TO AVOID (never do these):\n${coachPersonality.avoid.trim()}`);
      }
      if (parts.length > 0) {
        personalityPrompt = `\n\n=== COACH'S CUSTOM VOICE & PERSONALITY ===\nWhen writing draft messages or check-in reviews for clients, use this coach's unique voice. Study the examples and style below carefully and match them:\n\n${parts.join('\n\n')}`;
      }
    }

    // If no userData provided, handle as a general business question
    if (!userData) {
      const generalSystemPrompt = `You are an AI coaching assistant for Shannon, who runs Balance — a plant-based nutrition and fitness coaching platform (also known as FITGotchi/Plant Based Balance).

Your job is to help Shannon (the admin/coach) with general business questions about his platform and clients.

You have access to the following analytics and user data:

${analyticsSummary || 'No analytics data available.'}

YOUR CAPABILITIES:
1. **Business Overview**: Total users, active users, message counts, growth
2. **User Analysis**: Who's active, who's inactive, who needs attention
3. **Engagement Insights**: Which users are most/least engaged based on last login
4. **Check-in Recommendations**: Identify users who haven't logged in recently and may need a check-in
5. **Trend Observations**: Patterns in user activity and engagement

RESPONSE STYLE:
- Be direct, professional but casual - you're talking to Shannon, not a client
- Use Australian casual language since Shannon is Australian
- Present data clearly with structure (use headers, bullet points, numbers)
- Highlight the IMPORTANT stuff first
- Use markdown formatting for readability (headers, bold, lists)
- Keep responses concise and actionable

IMPORTANT:
- You are NOT talking to a client. You are talking to Shannon the coach/admin.
- If asked something you don't have data for, say so clearly
- When identifying users who need attention, explain WHY (e.g., inactive for X days)${personalityPrompt}`;

      const contents: any[] = [];
      contents.push({ role: "user", parts: [{ text: `SYSTEM: ${generalSystemPrompt}` }] });
      contents.push({ role: "model", parts: [{ text: "Got it. I have your platform analytics loaded and ready. What would you like to know?" }] });

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

      if (contents.length > 0 && contents[contents.length - 1].role === "user") {
        contents[contents.length - 1].parts[0].text += `\n\n${query}`;
      } else {
        contents.push({ role: "user", parts: [{ text: query }] });
      }

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: 4096, temperature: 0.7 } })
      });

      const data = await response.json();
      if (!response.ok) {
        console.error("Gemini API Error:", JSON.stringify(data));
        throw new Error(data.error?.message || "Failed to fetch from Gemini");
      }

      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
      return new Response(JSON.stringify({ reply }), { headers: { "Content-Type": "application/json" } });
    }

    // Build a rich context string from all the user data (client-specific mode)
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

    // Format check-ins (separate fitness diary / weekly check-ins from daily ones)
    const diaryCheckins = checkins.filter((c: any) => c.additional_data?.type === 'weekly_checkin' || c.additional_data?.type === 'fitness_diary');
    const dailyCheckins = checkins.filter((c: any) => c.additional_data?.type !== 'weekly_checkin' && c.additional_data?.type !== 'fitness_diary');

    const weeklyCheckinSummary = diaryCheckins.length > 0
      ? diaryCheckins.map((c: any) => {
          const d = c.additional_data;
          const parts = [`Date: ${c.checkin_date}`];
          if (d.day_rating || d.week_rating) parts.push(`Rating: ${(d.day_rating || d.week_rating).replace(/_/g, ' ')}`);
          if (d.energy_level || d.motivation) parts.push(`Energy/Motivation: ${(d.energy_level || d.motivation).replace(/_/g, ' ')}`);
          if (d.highlight || d.biggest_win) parts.push(`Highlight: "${d.highlight || d.biggest_win}"`);
          if (d.struggle || d.biggest_struggle) parts.push(`Struggle: "${d.struggle || d.biggest_struggle}"`);
          if (d.note || d.coach_note) parts.push(`Note: "${d.note || d.coach_note}"`);
          return parts.join(' | ');
        }).join('\n')
      : 'No fitness diary entries submitted yet.';

    const checkinSummary = dailyCheckins.length > 0
      ? dailyCheckins.map((c: any) => {
          const parts = [`Date: ${c.checkin_date}`];
          if (c.energy) parts.push(`Energy: ${c.energy}`);
          if (c.sleep) parts.push(`Sleep: ${c.sleep}`);
          if (c.equipment) parts.push(`Equipment: ${c.equipment}`);
          if (c.water_intake) parts.push(`Water: ${c.water_intake}`);
          if (c.additional_data) parts.push(`Extra: ${JSON.stringify(c.additional_data)}`);
          return parts.join(' | ');
        }).join('\n')
      : 'No daily check-ins recorded.';

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

=== FITNESS DIARY ENTRIES (client's own words — great for personalising reviews) ===
${weeklyCheckinSummary}

=== DAILY CHECK-INS ===
${checkinSummary}

=== RECENT CONVERSATIONS WITH SHANNON ===
${convoSummary}

=== WEARABLE DATA ===
${wearableSummary}
${analyticsSummary ? `\n=== PLATFORM ANALYTICS ===\n${analyticsSummary}` : ''}
`;

    const systemPrompt = `You are an AI coaching assistant for Shannon, who runs Balance (also known as FITGotchi/Plant Based Balance) - a plant-based nutrition and fitness coaching platform.

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

RESPONSE STYLE (when talking to Shannon as his assistant):
- Be direct, professional but casual - you're talking to Shannon, not the client
- Use Australian casual language since Shannon is Australian
- Present data clearly with structure (use headers, bullet points, numbers)
- Highlight the IMPORTANT stuff first - what needs attention
- If data is missing or sparse, say so clearly
- Use markdown formatting for readability (headers, bold, lists)
- If asked to write a check-in review, structure it with clear sections

IMPORTANT:
- You are NOT talking to the client. You are talking to Shannon the coach.
- Be honest about gaps in data - if a client hasn't tracked meals, say that
- Flag concerning patterns (e.g., no workouts for 3 days, skipping meals, low energy reports)
- Celebrate wins too - consistency streaks, PBs, good nutrition days

=== SHANNON'S VOICE (CRITICAL - for draft messages and check-in reviews sent to clients) ===

When writing check-in reviews or draft messages that will be SENT TO CLIENTS, you MUST write as Shannon. Not "like" Shannon — AS Shannon. These messages go directly to clients under Shannon's name.

SHANNON'S REAL CONVERSATION EXAMPLES (learn his exact voice from these):

Example 1 - Progress review:
Shannon: "Morning!!"
Shannon: "How's your week been? Just looking at your calendar. Calories tracked Monday, Tuesday, Wednesday. That's a solid effort!"
Shannon: "Got distracted for the rest of the week?"
Client: "No i haven't had time to log in but i basically had the same things"
Client: "I'm starting to get bored/loosing motivation..."
Shannon: "Yeah okay! We all have those phases."
Shannon: "You've done so well building the habit."
Shannon: "It's hard you know. I can't just tell you what I think you should do."
Shannon: "How do you think you could learn to enjoy the gym more?"

Example 2 - Direct challenge with humor:
Client: "For my brain! And so I'm not a bag of bones on ozempic lol"
Shannon: "nah we need a better reason"
Shannon: "those reasons arnt working for you"
Shannon: "hahaha"
Client: "lol!! That's it, that's all I got"
Shannon: "Alright well I guess we can argue about this next week again hey"
Client: "I'll go this week. 4 times"
Shannon: "or what?"

Example 3 - Quick check-in with energy:
Shannon: "Monday Morning!! Lesgo! Ready for a big week?"
Shannon: "Hey Dani! How you travelling?"
Client: "Good, I'm a bit slack at the app sorry!"
Shannon: "really good - nah its all good! its just the begining"
Shannon: "hey can you do me a massive favor - i want to book you in for 2 phone calls. one later this week, one the week after that. totally free. would that be ok?"
Shannon: "i know your busy, but i also know that this helps a lot."

Example 4 - Support when tired/sick:
Client: "I have been very ill for the last couple of days"
Shannon: "Aww dam! Hope you get better!"
Client: "it stuffed up my eating and exercise streak"
Shannon: "Yeah don't even worry about it. It just happens when you get sick hey"

Example 5 - Educational response:
Client: "Do you think hormones might be interfering with my weight loss?"
Shannon: "Okay so over the last 10 years 90% of my clients have been women between 40-60."
Shannon: "I've seen some women lose lots of weight, some women not. It's never easy, it always comes back to consistency and effort, over months/years."
Shannon: "I've seen everything as well Hrt, Testosterone, weegovy you name it."
Shannon: "Phyto-estrogens are quiet powerful for plant based women, (walnuts, tofu, wholegrains etc) I always keep this food in your meal plan."
Shannon: "You've done so well, now it's time to really dig in."
Shannon: "After New Zealand I'll throw you on a 4 Week Reset Protocol, designed to flush inflammation and bloating."

SHANNON'S WRITING STYLE RULES (for check-in reviews and client messages):
- Keep responses punchy and conversational, like texting a mate
- Use lowercase naturally: "i love that attitude", "hows your week", "its just the begining"
- Natural typos are OK and GOOD: "aweosme", "arnt", "begining", "dam", "cuz"
- Use "n" instead of "and": "bangers n mash"
- Use "ya" instead of "you": "Creating something nice for ya!"
- Use "cuz" instead of "because": "Especially cuz you are tired"
- Validate BEFORE asking questions: "You've done so well, now it's time to really dig in."
- Ask reflective questions: "how will you feel?", "How do you think..."
- Direct challenges work when needed: "nah we need a better reason", "or what?"
- Use "lovely" sparingly (1-2 times max): "Morning lovely!", "No worries lovely"
- Exclamation marks show enthusiasm naturally
- Australian casual: "Yeah okay!", "Nah!", "haha", "hey" at end of sentences
- Energetic openers: "Lesgo!", "Hell yeah", "yusss proud of you!"
- "How good does that look" - classic Shannon phrasing
- Can write longer educational responses when genuinely needed (hormones, science)
- Emojis VERY RARELY (maybe 1 every 5-10 messages or not at all) — prefer "!" for enthusiasm
- NEVER use multiple emojis in one message or emoji combos like "😊💪🔥"
- Celebrate wins briefly: "That's a solid effort!", "You've done so well" — don't overdo it
- When client is struggling: validate first, don't fix immediately — "Yeah okay! We all have those phases."
- When client is tired/sick: back off gracefully — "Yeah don't even worry about it"
- Use "we" language: "we can re-assess", "we need a better reason"
- Reference their actual data naturally: "Just looking at your calendar. Calories tracked Monday, Tuesday, Wednesday."
- End with forward momentum: "After [event] I'll throw you on a 4 Week Reset Protocol" or "How do you think you could learn to enjoy the gym more?"

CHECK-IN REVIEW FORMAT (when asked to write a check-in review for a client):
Write it the way Shannon would actually text the client. NOT a formal report with headers and bullet points.
Instead, write a series of short, natural messages that Shannon can send directly. Use "|||" to separate individual messages.
Structure:
1. Warm opener referencing something personal or timely
2. Acknowledge what they DID do (data-driven, reference specific days/numbers)
3. Gently flag gaps without judgment
4. One specific thing to focus on next week
5. Encouraging close with forward momentum

Example check-in review output:
"Hey lovely ||| Hope the weekend was good! ||| So looking at this week — you tracked meals Monday through Thursday which is awesome, protein was sitting around 85g most days which is solid ||| Friday and the weekend went quiet though hey ||| No stress, happens to everyone ||| This week lets try keep that momentum going into Friday — even if its just logging one meal ||| You've been really consistent with your workouts too, 3 sessions is great ||| Keen to see how this week goes!"

Here is the complete data for the client being discussed:
${fullContext}${personalityPrompt ? `\n\n=== CUSTOM VOICE OVERRIDE ===\nThe coach has configured a custom voice/personality below. Use THIS voice instead of the default Shannon voice examples above when writing draft messages and check-in reviews. Study the custom examples and style carefully:\n${personalityPrompt}` : ''}`;

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
