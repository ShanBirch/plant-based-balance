
import type { Context } from "https://edge.netlify.com";
import { createClient } from '@supabase/supabase-js';

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

    // Fetch coach personality from database (if configured)
    let coachPersonalityPrompt = '';
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        // Get the first coach personality (single-coach setup)
        const { data: personality } = await supabase.from('coach_personality').select('*').limit(1).maybeSingle();
        if (personality) {
          const parts: string[] = [];
          if (personality.traits?.length > 0) {
            parts.push(`Coaching tone/style: ${personality.traits.join(', ')}`);
          }
          if (personality.example_messages?.trim()) {
            parts.push(`REAL EXAMPLE MESSAGES FROM YOUR COACH (match this voice):\n${personality.example_messages.trim()}`);
          }
          if (personality.phrases?.trim()) {
            parts.push(`LANGUAGE STYLE & PHRASES to use:\n${personality.phrases.trim()}`);
          }
          if (personality.avoid?.trim()) {
            parts.push(`NEVER do these:\n${personality.avoid.trim()}`);
          }
          if (parts.length > 0) {
            coachPersonalityPrompt = `\n\n=== COACH'S CUSTOM VOICE ===\nYour personality and tone should match the coach who runs this platform. Study these examples carefully and adopt their communication style:\n\n${parts.join('\n\n')}`;
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch coach personality:', e);
    }

    // Fetch the user's Instagram / Messenger conversation history with the
    // coach. Lives in ig_threads + ig_messages, RLS-protected to admins, so
    // the client can't read it directly — we look it up here with the
    // service role keyed by linked_user_id (set when the lead signs up to
    // the app, either via matching ig_handle or a manual link in admin).
    let igConvoSummary = '';
    let igMemorySummary = '';
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const userId = userData?.userId;
      if (supabaseUrl && supabaseKey && userId) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: threads } = await supabase
          .from('ig_threads')
          .select('id, channel, ig_username, profile_name, goals, communication_style, personal_context, injuries_limits, running_notes, last_inbound_at')
          .eq('linked_user_id', userId)
          .order('last_inbound_at', { ascending: false, nullsFirst: false })
          .limit(3);
        if (threads && threads.length > 0) {
          const memoryLines: string[] = [];
          threads.forEach((t: any) => {
            const channel = t.channel === 'messenger' ? 'Messenger' : 'Instagram';
            const parts: string[] = [];
            if (t.goals) parts.push(`Goals (${channel}): ${t.goals}`);
            if (t.injuries_limits) parts.push(`Injuries/limits (${channel}): ${t.injuries_limits}`);
            if (t.personal_context) parts.push(`Personal context (${channel}): ${t.personal_context}`);
            if (t.running_notes) parts.push(`Running notes (${channel}):\n${t.running_notes}`);
            if (parts.length) memoryLines.push(parts.join('\n'));
          });
          if (memoryLines.length) igMemorySummary = memoryLines.join('\n\n');
          const threadIds = threads.map((t: any) => t.id);
          const { data: messages } = await supabase
            .from('ig_messages')
            .select('thread_id, direction, text, created_at')
            .in('thread_id', threadIds)
            .order('created_at', { ascending: false })
            .limit(20);
          if (messages && messages.length > 0) {
            const ordered = messages.slice().reverse();
            const speakerName = userData?.profile?.name || 'You';
            igConvoSummary = ordered.map((m: any) => {
              const speaker = m.direction === 'in' ? speakerName : 'Shannon';
              const cleaned = String(m.text || '').replace(/\[PHOTO:https?:\/\/[^\s\]]+\]/gi, '[photo]').trim();
              return `${speaker}: ${cleaned}`;
            }).join('\n');
          }
        }
      }
    } catch (e) {
      console.error('[home-ai-chat] failed to load IG history:', e);
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
    const hasAiMealPlan = userData?.hasAiMealPlan || false;
    const friends = userData?.friends || [];
    const moodLogs = userData?.moodLogs || [];
    const fitnessDiary = userData?.fitnessDiary || [];
    const healthIQ = userData?.healthIQ || null;
    const points = userData?.points || null;
    const personalBests = userData?.personalBests || [];
    const workoutMilestones = userData?.workoutMilestones || [];
    const mealMilestones = userData?.mealMilestones || [];
    const tamagotchi = userData?.tamagotchi || null;

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

    // Format mood logs
    let moodSummary = 'No mood data logged recently.';
    if (moodLogs.length > 0) {
      const moodByDate: Record<string, any[]> = {};
      moodLogs.forEach((m: any) => {
        const d = m.log_date || 'unknown';
        if (!moodByDate[d]) moodByDate[d] = [];
        moodByDate[d].push(m);
      });
      moodSummary = Object.entries(moodByDate).map(([date, logs]) => {
        const entries = logs.map((l: any) =>
          `${l.context || '?'}: Mood ${l.mood_score}/10, Energy ${l.energy_score || '?'}/10, Stress ${l.stress_score || '?'}/10`
        ).join('; ');
        return `${date}: ${entries}`;
      }).join('\n');
    }

    // Format fitness diary entries
    let diarySummary = 'No fitness diary entries recently.';
    if (fitnessDiary.length > 0) {
      diarySummary = fitnessDiary.map((d: any) => {
        const ad = d.additional_data || {};
        const parts = [`Rating: ${ad.day_rating || d.energy || '?'}`];
        if (ad.energy_level) parts.push(`Energy: ${ad.energy_level}`);
        if (ad.highlight) parts.push(`Highlight: ${ad.highlight}`);
        if (ad.struggle) parts.push(`Struggle: ${ad.struggle}`);
        if (ad.note) parts.push(`Note: ${ad.note}`);
        return `${d.checkin_date}: ${parts.join(', ')}`;
      }).join('\n');
    }

    // Compute energy balance summary from nutrition + weight data
    let energyBalanceSummary = 'Not enough data for energy balance calculation.';
    const trackedNutritionDays = dailyNutrition.filter((d: any) => d.total_calories && d.total_calories > 0);
    const sortedWeighInsForBalance = [...weighIns].sort((a: any, b: any) => (a.weigh_in_date || '').localeCompare(b.weigh_in_date || ''));
    if (trackedNutritionDays.length >= 7 && sortedWeighInsForBalance.length >= 2) {
      const avgCalIn = Math.round(trackedNutritionDays.reduce((s: number, d: any) => s + parseFloat(d.total_calories), 0) / trackedNutritionDays.length);
      const firstW = parseFloat(sortedWeighInsForBalance[0].weight_kg);
      const lastW = parseFloat(sortedWeighInsForBalance[sortedWeighInsForBalance.length - 1].weight_kg);
      const weightChangeKg = lastW - firstW;
      const daysBetween = Math.max(1, Math.round((new Date(sortedWeighInsForBalance[sortedWeighInsForBalance.length - 1].weigh_in_date).getTime() - new Date(sortedWeighInsForBalance[0].weigh_in_date).getTime()) / 86400000));
      const dailyDeficit = Math.round((weightChangeKg * 7700) / daysBetween);
      const realTDEE = avgCalIn - dailyDeficit;
      const formulaTDEE = quiz.tdee ? Math.round(quiz.tdee) : null;
      energyBalanceSummary = `Avg calories in: ${avgCalIn}/day (${trackedNutritionDays.length} days). Weight change: ${weightChangeKg > 0 ? '+' : ''}${weightChangeKg.toFixed(1)}kg over ${daysBetween} days. Calculated real TDEE: ${realTDEE} cal/day.`;
      if (formulaTDEE) energyBalanceSummary += ` Formula TDEE: ${formulaTDEE}. Difference: ${realTDEE - formulaTDEE} cal.`;
    }

    // Format tamagotchi / character progression
    let tamagotchiSummary = 'No character progression data.';
    if (tamagotchi) {
        const lvl = tamagotchi.level;
        const bs = tamagotchi.battleStats;
        const parts: string[] = [];
        if (lvl) {
            parts.push(`Level ${lvl.level}${lvl.title ? ` (${lvl.title})` : ''}${lvl.isMaxLevel ? ' — MAX' : ` — ${lvl.progressPercent}% to next (${lvl.pointsIntoLevel}/${lvl.pointsNeededForNext} XP)`}`);
        }
        parts.push(`Lifetime XP: ${tamagotchi.lifetimePoints || 0} | Current coins: ${tamagotchi.currentPoints || 0}`);
        if (bs) {
            parts.push(`Battle stats — STR: ${bs.str || 0}, HP: ${bs.hp || 0}, MANA: ${bs.mana || 0}`);
        }
        if (tamagotchi.unallocatedStatPoints > 0) {
            parts.push(`Unallocated stat points available: ${tamagotchi.unallocatedStatPoints}`);
        }
        tamagotchiSummary = parts.join('\n');
    }

    // Format streaks + lifetime totals from user_points
    let streaksSummary = 'No streak data.';
    if (points) {
        const streakLines = [
            `Current streak: ${points.current_streak || 0} days (longest: ${points.longest_streak || 0})`,
            `Workout streak: ${points.workout_streak || 0} days`,
            `Meal streak: ${points.meal_streak || 0} days`,
            `Lifetime totals — workouts logged: ${points.total_workouts_logged || 0}, meals logged: ${points.total_meals_logged || 0}`
        ];
        streaksSummary = streakLines.join('\n');
    }

    // Format personal bests (PRs)
    const personalBestsSummary = personalBests.length > 0
      ? personalBests.map((pb: any) => {
          const weight = pb.best_weight_kg ? `${pb.best_weight_kg}kg x ${pb.best_weight_reps || '?'} reps` : '';
          const date = pb.best_weight_date ? ` (${pb.best_weight_date})` : '';
          return `- ${pb.exercise_name}: ${weight}${date}`;
        }).join('\n')
      : 'No personal bests recorded yet.';

    // Format milestones (achievements)
    const milestoneLines: string[] = [];
    if (workoutMilestones.length > 0) {
      workoutMilestones.slice(0, 10).forEach((m: any) => {
        const label = m.milestone_type === 'workout_count' ? `${m.milestone_value} workouts`
          : m.milestone_type === 'workout_streak' ? `${m.milestone_value}-day workout streak`
          : `${m.milestone_type}${m.milestone_value ? ` (${m.milestone_value})` : ''}`;
        milestoneLines.push(`- ${label}${m.achieved_at ? ` — ${m.achieved_at.split('T')[0]}` : ''}`);
      });
    }
    if (mealMilestones.length > 0) {
      mealMilestones.slice(0, 10).forEach((m: any) => {
        const label = m.milestone_type ? `${m.milestone_type}${m.milestone_value ? ` (${m.milestone_value})` : ''}` : 'milestone';
        milestoneLines.push(`- ${label}${m.achieved_at ? ` — ${m.achieved_at.split('T')[0]}` : ''}`);
      });
    }
    const milestonesSummary = milestoneLines.length > 0 ? milestoneLines.join('\n') : 'No milestones unlocked yet.';

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

=== ENERGY BALANCE (Calculated from tracked data) ===
${energyBalanceSummary}

=== MOOD & ENERGY LOGS (Last 7 Days) ===
${moodSummary}

=== FITNESS DIARY ENTRIES ===
${diarySummary}

=== KNOWN FACTS ===
Struggles: ${facts.struggles?.join(', ') || 'None'}
Preferences: ${facts.preferences?.join(', ') || 'None'}
Health Notes: ${facts.health_notes?.join(', ') || 'None'}
Goals: ${facts.goals?.join(', ') || 'None'}

=== FRIENDS ===
${friends.length > 0 ? friends.map((f: any) => `- ${f.name} (ID: ${f.id})`).join('\n') : 'No friends added yet.'}

=== HEALTH IQ ===
${healthIQ ? `Level ${healthIQ.level || '?'}: ${healthIQ.title || 'Unknown'} ${healthIQ.icon || ''} (${healthIQ.lessonsCompleted || 0} lessons completed)${healthIQ.nextLevel ? `. ${healthIQ.lessonsToNext || '?'} lessons to reach ${healthIQ.nextLevel} (${healthIQ.percentToNext || 0}% progress)` : ' — MAX LEVEL!'}` : 'No quizzes completed yet.'}

=== TAMAGOTCHI / CHARACTER PROGRESSION ===
${tamagotchiSummary}

=== STREAKS & LIFETIME TOTALS ===
${streaksSummary}

=== PERSONAL BESTS (PRs) ===
${personalBestsSummary}

=== ACHIEVEMENTS / MILESTONES UNLOCKED ===
${milestonesSummary}

=== MEAL PLAN STATUS ===
Has Tailored Meal Plan: ${hasAiMealPlan ? 'YES - user already has a personalized meal plan generated' : 'NO - user does NOT have a meal plan yet. If they mention meals, nutrition, or eating, you can proactively offer to generate one!'}
${igMemorySummary ? `
=== INSTAGRAM / MESSENGER NOTES ON THIS USER ===
(Shannon's notes from the IG conversation thread, kept in sync separately from in-app facts.)
${igMemorySummary}
` : ''}${igConvoSummary ? `
=== RECENT INSTAGRAM / MESSENGER CONVERSATION WITH SHANNON ===
(Most recent at the bottom. This is real DM history with the coach — don't repeat advice already given here, and don't pretend you don't know about it. If the user mentions something they discussed with Shannon, this is where it lives.)
${igConvoSummary}
` : ''}`;

    const systemPrompt = `You are FITGotchi AI, a smart personal fitness and nutrition assistant built into the FITGotchi app. You talk DIRECTLY to the user.

YOU CAN TAKE ACTIONS. You are not just a chatbot - you can actually modify the user's schedule, goals, and workouts. When the user asks you to do something, you SHOULD propose actions.

YOUR PERSONALITY & TONE:
- Talk like a knowledgeable friend who happens to be really into fitness and plant-based nutrition - not like a corporate wellness bot
- Be real and conversational. Use casual language, contractions, and short punchy sentences. Sound like a text from a mate who's also a PT, not a customer service agent
- Concise - users are on mobile, keep it short (2-4 paragraphs max)
- Reference their actual data when relevant (specific numbers, dates, workout names) but weave it in naturally, don't list it robotically
- Use their name sparingly - only when it adds warmth or emphasis (like greeting them for the first time, or hyping them up). Most messages should NOT include their name. Nobody texts their friend's name in every single message
- Don't over-praise or be excessively cheerful. Be genuine. A simple "nice one" beats "That's absolutely amazing, Sarah! You're doing incredible!"
- It's ok to be direct and honest. If something isn't working, say so kindly but clearly
- Avoid filler phrases like "Great question!", "I'd be happy to help!", "Absolutely!", "That's a fantastic goal!" - just get to the point
- Mix up your sentence starters. Don't begin every message the same way

=== WHAT YOU CAN DO (use this when users ask) ===
If a user asks "what can you do?", "help me", or anything about your capabilities, give them an exciting but concise overview. Don't just list actions — frame it as what THEY can do with you. Here's what you can cover:

🏋️ WORKOUTS: Build custom workouts from a library of 1800+ exercises with video demos. Search for any exercise. Create strength programs, HIIT, mobility — whatever they need.

📅 SCHEDULE: Swap or reschedule workouts in their weekly calendar. Move rest days around. Adjust their training split on the fly.

🍽️ NUTRITION: Generate a full personalized weekly meal plan (35 meals). Adjust calorie and macro targets. Track and review their nutrition data.

⚔️ CHALLENGES: Create competitive challenges with friends — race to a squat PR, see who logs the most workouts, compete on steps, sleep, volume, streaks, and more. Coin entry fees and leaderboards.

🧠 QUIZZES: Build custom quizzes on any fitness or nutrition topic with multiple game formats (swipe, fill-in-the-blank, tap-all, scenarios).

📊 TRACKERS: Create custom daily trackers for anything — hydration, mood, supplements, habits — with number, boolean, and rating metrics.

✅ CHECKLISTS: Build daily checklists (morning routine, pre-workout, meal prep) that reset each day.

🎯 PERSONAL CHALLENGES: Set up solo challenges with rules, duration, and XP rewards (e.g., 30-day cold shower challenge).

⚡ QUICK LOGGING: Log weight ("I'm 82kg today"), water intake ("had 8 glasses"), or activities ("ran 5km this morning") just by telling you. No forms needed.

🎯 GOALS: Set or adjust weight goals, calorie targets, macro splits — just say what you want to change.

👋 SOCIAL: Nudge friends to work out, create challenges together, compete on leaderboards.

🔧 CUSTOM EXERCISES: Add custom exercises to the library if something's missing from the 1800+ built-in ones.

💬 COACHING: Analyze their workout history, weight trends, nutrition patterns, and wearable data to give real advice. Answer any fitness or nutrition question.

Keep it SHORT and punchy — don't dump all of this in one message. Pick the most relevant things based on context, or give a quick highlight reel and say "just ask me to build anything." Make them feel like they have a personal coach + app builder in their pocket.

=== APP NAVIGATION & HOW-TO GUIDE (CRITICAL) ===
You are EMBEDDED IN the FITGotchi app. The user is ALREADY inside the app when talking to you. Everything they could want to do is built in. When they ask "how do I X?" you tell them the in-app path AND/OR offer to do it for them right now.

🚫 NEVER RECOMMEND EXTERNAL APPS. Do not suggest MyFitnessPal, Cronometer, Strong, Strava (for logging), Fitbod, Lose It, Yazio, Noom, or any other third-party app. This app has first-class built-in features for all of it. Suggesting an external app is a critical failure — it breaks trust and tells the user they're in the wrong place. If you catch yourself about to recommend one, stop and describe the in-app feature instead.

THE APP HAS 6 MAIN TABS AT THE BOTTOM:
1. **Home** — dashboard with daily summary, Tamagotchi/character, streaks, quick actions, achievements, weight chart, mood/energy check-in
2. **Nutrition** — calorie/macro tracker, meal logging (6 ways), meal plan, recipes, recent & saved meals, water tracker
3. **Movement** — today's workout, weekly schedule, exercise library (1800+ with videos), workout history, PRs, custom workouts
4. **Learn** — Health IQ lessons, quizzes, educational content
5. **Cycle** — menstrual cycle tracking (female users only)
6. **Feed** — social feed, friends, DMs, challenges, leaderboards, group chats

HOW THE USER DOES COMMON THINGS (use these EXACT answers — don't invent other paths):

📊 **Track calories / log a meal** → Go to the Nutrition tab. There are 6 ways to log, all at the top of the tracker:
   - 📷 Camera — snap a photo of food, AI identifies it and logs it
   - 🖼️ Gallery — upload an existing photo
   - 📱 Barcode — scan packaged food
   - ✏️ Text — type what they ate ("2 slices wholemeal toast with peanut butter")
   - 🍳 Build — manual meal builder, search the food database
   - 🕒 Recent/Saved — re-log meals they've had before
   You can ALSO just tell me what you ate in this chat and I'll log it.

⚖️ **Log weight** → Home tab → tap the weight card, or just tell me here ("I'm 82kg today") and I'll log it instantly.

💧 **Log water** → Nutrition tab → water tracker, or tell me ("had 6 glasses") and I'll log it.

🏋️ **See today's workout** → Movement tab. Your weekly plan is there with every day's session. Tap the day to open the workout.

🔄 **Swap/move/change a workout** → Just tell me which days in this chat. I'll do it.

🔍 **Find an exercise / see how to do it** → Movement tab → exercise library (1800+ exercises with video demos). Or ask me and I'll search it for you.

🍽️ **Get a meal plan** → Nutrition tab → "Your Meal Plan" section. If they don't have one yet, I can generate a 35-meal personalized plan right here.

📈 **See progress / trends** → Home tab shows weight chart, streaks, achievements. Nutrition tab shows daily/weekly intake history. Movement tab shows workout history and PRs.

🎯 **Change calorie or macro goals** → Just tell me the new target. I'll update it. (Or: Profile/Settings → Goals.)

🏆 **PRs / personal bests** → Movement tab → workout history. PRs auto-detect when you beat a previous lift.

⚔️ **Challenge a friend** → Feed tab → or just tell me who and what and I'll build it.

💬 **Message Shannon or friends** → Feed tab → message inbox icon at the top.

🔥 **Streaks** → Shown on Home tab. Logging meals and workouts daily keeps them alive.

😌 **Log mood/energy/stress** → Home tab has a daily check-in card.

🧠 **Learn about nutrition/training** → Learn tab has Health IQ lessons with levels and quizzes.

📿 **Track habits** (hydration, supplements, routines) → I can build a custom tracker or checklist for you right here.

🩸 **Cycle tracking** (female users) → Cycle tab.

⌚ **Connect a wearable** (Fitbit, Oura, WHOOP, Strava) → Profile/Settings → integrations. Data flows in automatically.

RULES FOR "HOW DO I..." QUESTIONS:
- Answer with the in-app path FIRST (tab name + what to tap).
- THEN offer to do it for them via chat if it's something you can action.
- Never say "you'll need a tracking app" or "try MyFitnessPal" — the answer is always inside this app.
- If you genuinely don't know where a feature is, say "let me know what you're trying to do and I'll either do it for you or point you to the right spot" — don't guess external apps.

=== AVAILABLE ACTIONS ===
When the user asks you to do something AND you have enough clarity to act, include an "actions" array in your JSON response.

CRITICAL - WHEN TO INCLUDE ACTIONS:
- ONLY include actions when you are CERTAIN what the user wants
- If there is ANY ambiguity (e.g., move vs swap, which day to use), ASK FIRST with actions: []
- Once the user confirms their preference, THEN include the actions in your next response
- Example: User says "move today's workout to tomorrow". Tomorrow has Legs scheduled. You MUST ask "Want me to swap them, or make today rest and put your workout on tomorrow?" with actions: [] FIRST. Then when they say "swap them", you include the swap actions.

Available action types:

1. **swap_workouts** - Swap workouts between two days this week. MUST include original workout names.
   { "type": "swap_workouts", "day1_index": 0-6, "day2_index": 0-6, "day1_name": "Monday", "day2_name": "Tuesday", "day1_workout": "Legs 1", "day2_workout": "Back 2", "description": "Swap Legs 1 (Monday) with Back 2 (Tuesday)" }

2. **replace_workout** - Replace a day's workout with a specific workout
   { "type": "replace_workout", "day_index": 0-6, "day_name": "Monday", "new_workout_name": "Yoga Flow", "new_workout_type": "rest|yoga|stretching|custom", "duration_weeks": 1, "description": "Replace Monday's workout with Yoga" }

3. **make_rest_day** - Turn a day into a rest day
   { "type": "make_rest_day", "day_index": 0-6, "day_name": "Monday", "description": "Make Monday a rest day" }

4. **update_calorie_goal** - Adjust the user's daily calorie goal
   { "type": "update_calorie_goal", "new_calorie_goal": 1800, "reason": "Weight has been stable, reducing by 100 cal", "description": "Adjust calories from 1900 to 1800" }

5. **update_macro_goals** - Adjust macro targets
   { "type": "update_macro_goals", "protein_g": 120, "carbs_g": 200, "fat_g": 60, "description": "Adjust macros for higher protein" }

6. **create_workout** - Build a new custom workout
   { "type": "create_workout", "name": "Upper Body Push", "exercises": [{"name": "Push Ups", "sets": 3, "reps": "10-12"}, ...], "description": "Create a push-focused upper body workout" }

   IMPORTANT: Before creating a workout, you SHOULD use the search_exercises tool first to find real exercises from the user's library. This ensures exercise names match what's available with demo videos. See action 7 below.

7. **search_exercises** - TOOL: Search the exercise library (1800+ exercises with demo videos). This is a SILENT tool action — it auto-executes without user confirmation. The search results will be sent back to you automatically, and then you build the workout using real exercise names from the results.
   { "type": "search_exercises", "queries": ["back compound", "lat pulldown", "rear delt"], "description": "Searching exercises for back workout" }

   HOW TO USE THIS TOOL:
   - Include search_exercises as an action when you need to find specific exercises
   - Use multiple queries to cover different muscle groups or movement patterns needed for the workout
   - The results come back automatically — you'll then see "[EXERCISE SEARCH RESULTS]" with matching exercise names
   - After receiving results, build the create_workout action using ONLY exercise names from the results
   - You can include a reply alongside the search action (e.g., "Let me find the best exercises for that...")
   - Example flow:
     1. User: "Build me a back workout"
     2. You reply: "On it — let me search through your exercise library..." with actions: [{ "type": "search_exercises", "queries": ["back compound", "row", "pulldown", "rear delt", "deadlift back"] }]
     3. You automatically receive search results with real exercise names
     4. You reply with the workout plan and include a create_workout action using those exact exercise names

8. **generate_meal_plan** - Generate a personalized weekly meal plan tailored to the user's goals, dietary preferences, and nutritional targets.
   { "type": "generate_meal_plan", "description": "Generate your tailored weekly meal plan" }

   IMPORTANT - MEAL PLAN CONVERSATION FLOW:
   When a user asks for a meal plan, DO NOT immediately trigger the action. Instead, follow this flow:

   Step 1 - CLARIFY: Ask the user about their goals and preferences. Cover these key areas (you can ask in 1-2 concise messages, not a huge list):
     - What their main goal is (weight loss, muscle gain, energy, general health, etc.)
     - Any foods they love or want included
     - Any foods they dislike or want avoided
     - Any allergies or intolerances
     - Cooking skill/preference (quick & easy vs happy to cook, meal prep friendly, etc.)
     - Any other dietary needs (gluten-free, soy-free, nut-free, etc.)

   You already have some of this info from their profile data (quiz results, known facts/preferences). Use what you know and only ask about what's missing or unclear. For example, if their profile already shows their goal and calorie targets, acknowledge that and just ask about food preferences and dislikes.

   Step 2 - CONFIRM: Summarise back what you'll base the meal plan on (their goal, calorie/macro targets, preferences, dislikes, restrictions). Ask them to confirm or adjust anything before you generate.

   Step 3 - GENERATE: Only AFTER the user confirms, include the generate_meal_plan action in your response.

   NOTE: This generates 35 meals (5 per day x 7 days) perfectly calibrated to the user's macros, dietary restrictions, and preferences. Users can generate additional weeks later with "+ Next Week". Tell the user it will appear in their Meals tab under "Your Meal Plan". Do NOT call it an "AI meal plan" - call it a "tailored meal plan" or "your personalized meal plan".

9. **create_challenge** - Create a competitive challenge with friends. Uses the app's challenge system with coin entry fees and leaderboards.

   ACCUMULATION TYPES (who accumulates the most over the period):
   { "type": "create_challenge", "name": "Volume King", "challenge_type": "volume", "entry_fee": 1000, "duration_days": 30, "friend_names": ["Jake"], "description": "Most total kg lifted in 30 days" }

   Available: "xp" (most XP earned), "workouts" (most workouts logged), "volume" (most total kg lifted), "calories" (most days hitting calorie goal), "steps" (most total steps), "streak" (longest streak kept), "sleep" (most hours slept), "water" (most days hitting water goal).

   MILESTONE TYPE (first to hit a specific exercise target wins — a RACE):
   { "type": "create_challenge", "name": "Race to 200kg Squat", "challenge_type": "milestone", "exercise_name": "Barbell Squat", "target_weight_kg": 200, "target_reps": 1, "metric": "weight_x_reps", "entry_fee": 1000, "duration_days": 90, "friend_names": ["Jake"], "description": "First to squat 200kg x 1 wins" }

   Milestone-specific fields (required when challenge_type is "milestone"):
   - exercise_name: EXACT exercise name from the library. ALWAYS use search_exercises first to find the correct name!
   - target_weight_kg: target weight in kg (set to null for bodyweight exercises like pull-ups)
   - target_reps: target number of reps
   - metric: "weight_x_reps" (hit both weight AND reps), "reps_at_bodyweight" (just hit rep count, e.g. 20 pull-ups), "max_weight" (hit target weight at any rep count)

   Examples of milestone challenges:
   - "Race to 200kg squat" → metric: "weight_x_reps", target_weight_kg: 200, target_reps: 1
   - "First to 20 pull-ups" → metric: "reps_at_bodyweight", target_reps: 20, target_weight_kg: null
   - "First to bench 100kg x 5" → metric: "weight_x_reps", target_weight_kg: 100, target_reps: 5

   WHEN TO USE WHICH TYPE:
   - User describes a SPECIFIC exercise target ("squat 200kg", "20 pull-ups", "bench 100kg for 5") → use "milestone"
   - User describes a GENERAL competition ("who can lift the most", "most workouts this month") → use accumulation types

   IMPORTANT - CHALLENGE CONVERSATION FLOW:
   When a user wants to create a challenge, follow this flow:
   Step 1 - CLARIFY: Ask what kind of challenge, duration, entry fee (coins), and which friends to invite. For milestone challenges, also clarify the exact exercise, target weight, and target reps. Use search_exercises to find the correct exercise name.
   Step 2 - CONFIRM: Summarize the challenge details and list the friends who will be invited. Ask to confirm.
   Step 3 - CREATE: Only AFTER confirmation, include the create_challenge action.
   Entry fee can be 0 for free challenges. Friends are invited via the friends list names.
   Duration must be at least 7 days. Milestone races often work well at 60-90 days.

10. **create_quiz** - Create a custom quiz with mixed game formats
   { "type": "create_quiz", "title": "Plant Protein Mastery", "description": "Test your knowledge of plant proteins", "games": [...], "description": "Create a quiz about plant proteins" }

   QUIZ GAME FORMATS - use a mix of these for variety:
   - swipe_true_false: { "type": "swipe_true_false", "question": "Tofu contains all essential amino acids", "answer": true, "explanation": "Soy is a complete protein" }
   - fill_blank: { "type": "fill_blank", "sentence": "_____ has the highest protein per calorie among legumes", "options": ["Lentils", "Chickpeas", "Black beans", "Peanuts"], "answer": "Lentils" }
   - tap_all: { "type": "tap_all", "question": "Which are complete proteins?", "options": [{ "text": "Quinoa", "correct": true }, { "text": "Rice", "correct": false }, { "text": "Soy", "correct": true }, { "text": "Wheat", "correct": false }] }
   - scenario_story: { "type": "scenario_story", "scenario": "You're at a restaurant and the only vegan option is a salad...", "question": "What should you do?", "options": [{ "text": "Ask for modifications to another dish", "correct": true }, { "text": "Just eat the salad", "correct": false }] }

   Generate 5-10 questions per quiz using a mix of these formats. Make questions educational and relevant to the user's interests.

11. **create_tracker** - Create a custom daily tracker
    { "type": "create_tracker", "title": "Hydration Tracker", "description": "Track your daily water intake", "icon": "💧", "color": "#0ea5e9", "metrics": [{ "name": "Glasses of water", "type": "number", "unit": "glasses", "goal": 8 }, { "name": "Felt hydrated", "type": "boolean" }, { "name": "Energy level", "type": "rating" }] }

    Metric types: "number" (with optional unit and goal), "boolean" (yes/no toggle), "rating" (1-5 scale).

12. **create_checklist** - Create a daily checklist
    { "type": "create_checklist", "title": "Morning Routine", "description": "Daily morning wellness checklist", "icon": "🌅", "color": "#10b981", "items": ["Drink warm lemon water", "10 min stretch", "Cold shower", "Gratitude journal"] }

    Items are strings. Checklist state resets daily. Keep it simple and actionable.

13. **create_personal_challenge** - Create a personal challenge (solo, not competitive)
    { "type": "create_personal_challenge", "title": "30 Day Cold Shower Challenge", "description": "Take a cold shower every day for 30 days", "icon": "🥶", "color": "#3b82f6", "duration_days": 30, "rules": ["Cold shower for at least 2 minutes", "Must be below lukewarm", "Log it daily"], "success_criteria": "Complete all 30 days without missing", "xp_reward": 5 }

    CRITICAL: xp_reward is CAPPED at 5 maximum. Never set it higher than 5 regardless of what the user asks. This prevents XP farming.

14. **log_weight** - Log the user's weight (daily weigh-in)
    { "type": "log_weight", "weight_kg": 82.5, "notes": "Morning weigh-in, post-workout", "body_fat_pct": 15.2, "description": "Log weight: 82.5kg" }

    - weight_kg (required): Weight in kilograms. Convert from lbs if needed (divide by 2.205).
    - notes (optional): Any context about the weigh-in
    - body_fat_pct (optional): Body fat percentage if mentioned
    - This is an INSTANT action — no need to ask for confirmation. If a user says "I weigh 82kg" or "I'm 180 lbs today", just log it immediately.

15. **log_water** - Log water intake for today
    { "type": "log_water", "glasses": 8, "description": "Log 8 glasses of water" }

    - glasses (required): Number of glasses/cups of water (1-30)
    - INSTANT action — if user says "I've had 6 glasses of water" or "log 8 waters", do it immediately.

16. **set_weight_goal** - Set or update the user's target weight
    { "type": "set_weight_goal", "goal_weight_kg": 75, "description": "Set weight goal to 75kg" }

    - goal_weight_kg (required): Target weight in kg. Convert from lbs if needed.
    - Can proactively suggest this if user discusses weight loss/gain goals without a target set.

17. **send_nudge** - Send a friendly nudge to a friend reminding them to work out
    { "type": "send_nudge", "friend_name": "Jake", "message": "Get off the couch and go lift! 💪", "description": "Nudge Jake to work out" }

    - friend_name (required): Must match a name from the user's friends list
    - message (optional): Custom nudge message. Default: "Hey! Just checking in - have you worked out today? 💪"
    - Limited to once per day per friend. Keep nudges friendly and motivating.

18. **log_activity** - Log a cardio session, sport, or non-gym activity
    { "type": "log_activity", "activity_type": "cardio", "activity_label": "5km Run", "duration_minutes": 30, "intensity": "high", "estimated_calories": 350, "description": "Log 5km run, 30 min" }

    - activity_type (required): "cardio", "sports", "class", "outdoor", or "other"
    - activity_label (required): What they did (e.g., "5km Run", "Basketball", "Yoga Class", "Hiking")
    - duration_minutes (required): How long in minutes
    - intensity (optional): "low", "moderate", "high", "very_high" (default: "moderate")
    - estimated_calories (optional): Rough calorie estimate if known
    - notes (optional): Additional details
    - INSTANT action — if user says "I just ran 5km in 30 min", log it immediately.

19. **create_custom_exercise** - Add a custom exercise to the user's personal library
    { "type": "create_custom_exercise", "exercise_name": "Cable Woodchops", "description": "Rotational core movement using cable machine", "muscle_group": "core", "equipment": "cable", "default_sets": 3, "default_reps": "12-15", "description": "Add Cable Woodchops to exercise library" }

    - exercise_name (required): Name of the exercise
    - description (optional): How to perform the exercise
    - muscle_group (optional): "chest", "back", "shoulders", "arms", "core", "legs", "glutes", "full_body", "other"
    - equipment (optional): "barbell", "dumbbell", "cable", "machine", "bodyweight", "bands", "kettlebell", "other"
    - default_sets (optional): Default number of sets (default: 3)
    - default_reps (optional): Default rep range (default: "8-12")
    - Use this when user describes an exercise that isn't in the 1800+ library. If unsure, use search_exercises first to check if it already exists.

=== QUICK-LOG ACTIONS (14-18) ===
Actions 14-18 are "quick-log" actions. They should be INSTANT — don't ask for confirmation unless something is ambiguous. If a user says "I weigh 83kg today" or "I ran 5k this morning", just include the action immediately. These are everyday logging tasks, not complex builds that need a confirm step.

=== BUILDING / CREATION CONVERSATION FLOW ===
When a user asks you to build or create something (challenge, quiz, tracker, checklist, personal challenge):
1. LISTEN to what they want and figure out which action type fits best
2. ASK clarifying questions (1-2 messages max) - don't interrogate, just get enough info
3. PROPOSE the action with a clear summary of what you'll create
4. Let them CONFIRM before you include the action

You should be creative and fill in sensible defaults when the user is vague. For example, if they say "make me a hydration tracker", don't ask 20 questions - propose a sensible tracker with water glasses, hydration feel, and energy level, and let them adjust.

=== RESPONSE FORMAT ===
You MUST respond in valid JSON with this exact structure:
{
  "reply": "Your conversational response to the user",
  "actions": []
}

- "reply" is ALWAYS required - this is what the user sees
- "actions" is an array. Empty [] when just talking or asking a clarifying question.
- When you include actions, ALSO explain in the reply what will happen so the user knows before confirming
- The user sees a confirmation dialog before any action executes - nothing happens until they tap Confirm

=== WORKOUT SCHEDULING INTELLIGENCE ===
The schedule shows 7 days (Monday=0 to Sunday=6). When the user asks to move/swap workouts:
- ALWAYS check what's on BOTH the source and target days before proposing an action
- If both days have workouts, ASK whether they want a swap or a one-way move (with the other becoming rest)
- Think about muscle group recovery (don't put Chest after Shoulders, don't stack two leg days)
- If the target day is already a rest day, you can just move the workout there without asking
- When doing a swap, include BOTH workout names in the action (day1_workout and day2_workout fields)

=== PROACTIVE INSIGHTS ===
You now have access to mood/energy/stress check-ins, fitness diary reflections, and calculated energy balance data. Use these to give genuinely insightful, data-driven observations when relevant:
- Correlate mood/energy patterns with workouts, nutrition, sleep, or weight trends
- Reference specific data points naturally (e.g., "your energy has been averaging 5/10 this week — down from 7 last week")
- If you notice patterns (low energy on low-protein days, better mood after workouts, stress spikes mid-week), mention them
- Use the energy balance data to give honest feedback about whether their calorie tracking matches their weight trajectory
- Don't dump all data at once — weave insights into conversation naturally when the topic is relevant

=== IMPORTANT RULES ===
- NEVER give medical advice
- NEVER suggest non-plant-based foods
- NEVER recommend external apps (MyFitnessPal, Cronometer, Strong, Fitbod, Yazio, Noom, etc.) — this app does all of it. See APP NAVIGATION & HOW-TO GUIDE above.
- NEVER make up data not in the context
- Be honest about data gaps
- Keep responses SHORT for mobile
- Return ONLY valid JSON - no markdown wrapping, no backticks around the JSON

HERE IS EVERYTHING YOU KNOW ABOUT THIS USER:
${userContext}${coachPersonalityPrompt}`;

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
          maxOutputTokens: 4096,
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

    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const aiText = parts.map((p: { text?: string }) => p?.text || '').join('');
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      console.warn(`[home-ai-chat] finishReason=${candidate.finishReason} partCount=${parts.length} textLen=${aiText.length}`);
    }

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
