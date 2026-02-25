(function() {
    // Chat state
    let aiChatHistory = [];
    let aiPendingActions = [];
    let aiIsLoading = false;

    // Build schedule from a custom program object
    function buildScheduleFromProgram(program) {
        const schedule = [];
        if (program && program.weekly_schedule && program.weekly_schedule.length === 7) {
            program.weekly_schedule.forEach((item, i) => {
                if (!item.workout || item.workout.type === 'rest') {
                    schedule.push({ name: 'Rest', dayIndex: i, exercises: [] });
                } else {
                    schedule.push({
                        name: item.workout.name || item.workout.subcategory || 'Workout',
                        dayIndex: i,
                        exercises: item.workout.exercises || []
                    });
                }
            });
        }
        return schedule;
    }

    // Gather the user's weekly workout schedule (tries DOM, cache, then DB)
    async function gatherWeekSchedule() {
        const schedule = [];

        // Try reading from the weekly calendar DOM (works when Movement tab has been visited)
        const grid = document.getElementById('weekly-calendar');
        if (grid) {
            const tags = grid.querySelectorAll('.cal-workout-tag');
            if (tags.length >= 7) {
                tags.forEach((tag, i) => {
                    const text = tag.textContent.replace('🔄', '').trim();
                    schedule.push({ name: text, dayIndex: i, exercises: [] });
                });
                return schedule.slice(0, 7);
            }
        }

        // Fallback: try to build schedule from the active custom program cache
        const cachedProgram = window.activeCustomProgramCache;
        const fromCache = buildScheduleFromProgram(cachedProgram);
        if (fromCache.length === 7) return fromCache;

        // Fallback: actively fetch the custom program from DB
        try {
            const user = window.currentUser;
            const db = window.dbHelpers;
            if (user && db && db.customPrograms) {
                const activeProgram = await db.customPrograms.getActive(user.id);
                if (activeProgram) {
                    window.activeCustomProgramCache = activeProgram;
                    const fromDb = buildScheduleFromProgram(activeProgram);
                    if (fromDb.length === 7) return fromDb;
                }
            }
        } catch (e) {
            console.warn('AI: Failed to fetch custom program:', e);
        }

        // Final fallback: return empty schedule
        for (let i = 0; i < 7; i++) {
            schedule.push({ name: 'Schedule not loaded', dayIndex: i, exercises: [] });
        }
        return schedule;
    }

    // Gather all user context data for the AI
    async function gatherUserContext() {
        const user = window.currentUser;
        if (!user) return {};

        const db = window.dbHelpers;
        const context = {};

        // Profile
        context.profile = { name: user.user_metadata?.name || user.email?.split('@')[0] || 'User' };

        const twoWeeksAgoDate = new Date(); twoWeeksAgoDate.setDate(twoWeeksAgoDate.getDate() - 14);
        const twoWeeksAgo = getLocalDateString(twoWeeksAgoDate);
        const sevenDaysAgoDate = new Date(); sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 7);
        const sevenDaysAgo = getLocalDateString(sevenDaysAgoDate);
        const todayStr = getLocalDateString();

        // Run all data fetches in parallel for speed
        const [quizResult, factsResult, nutritionResult, mealsResult, workoutsResult, weighInsResult, replacementsResult, wearableResult, friendsResult, aiMealPlanResult, moodLogsResult, fitnessDiaryResult] = await Promise.allSettled([
            // Quiz results
            db.quizResults.getLatest(user.id),
            // User facts
            db.userFacts.get(user.id),
            // Daily nutrition (last 14 days)
            db.nutrition.getRange(user.id, twoWeeksAgo, todayStr),
            // Recent meals (last 7 days)
            (async () => {
                const { data } = await window.supabaseClient
                    .from('meal_logs').select('*').eq('user_id', user.id)
                    .gte('meal_date', sevenDaysAgo).order('meal_date', { ascending: false }).limit(50);
                return data;
            })(),
            // Recent workout history (last 14 days)
            (async () => {
                const { data } = await window.supabaseClient
                    .from('workouts').select('*').eq('user_id', user.id).eq('workout_type', 'history')
                    .gte('workout_date', twoWeeksAgo).order('workout_date', { ascending: false }).limit(100);
                return data;
            })(),
            // Weigh-ins (last 14 days)
            (async () => {
                const { data } = await window.supabaseClient
                    .from('daily_weigh_ins').select('*').eq('user_id', user.id)
                    .gte('weigh_in_date', twoWeeksAgo).order('weigh_in_date', { ascending: true });
                return data;
            })(),
            // Active replacements
            db.workoutReplacements.getActive(user.id),
            // Wearable data (Fitbit, Oura, Strava - last 7 days)
            (async () => {
                const wearables = {};
                const tables = [
                    { key: 'fitbitActivity', table: 'fitbit_activity', dateCol: 'date' },
                    { key: 'ouraSleep', table: 'oura_sleep', dateCol: 'date' },
                    { key: 'stravaActivities', table: 'strava_activities', dateCol: 'start_date' }
                ];
                await Promise.allSettled(tables.map(async (t) => {
                    try {
                        const { data } = await window.supabaseClient
                            .from(t.table).select('*').eq('user_id', user.id)
                            .gte(t.dateCol, sevenDaysAgo).order(t.dateCol, { ascending: false }).limit(10);
                        if (data && data.length > 0) wearables[t.key] = data;
                    } catch (e) { /* table may not exist */ }
                }));
                return wearables;
            })(),
            // Friends list (for challenge creation)
            (async () => {
                try {
                    return await db.friends.getFriendsWithFallback(user.id);
                } catch (e) { return []; }
            })(),
            // Check if user has a tailored meal plan
            (async () => {
                try {
                    const { data } = await window.supabaseClient
                        .from('ai_generated_meal_plans')
                        .select('id, plan_name, status, created_at')
                        .eq('user_id', user.id)
                        .eq('status', 'active')
                        .limit(1)
                        .maybeSingle();
                    return data;
                } catch (e) {
                    // Table may not exist yet
                    return localStorage.getItem('ai_meal_plan') ? { plan_name: 'Local plan', status: 'active' } : null;
                }
            })(),
            // Mood logs (last 7 days)
            (async () => {
                try {
                    const { data } = await window.supabaseClient
                        .from('mood_logs').select('*').eq('user_id', user.id)
                        .gte('log_date', sevenDaysAgo).order('logged_at', { ascending: false }).limit(30);
                    return data;
                } catch (e) { return []; }
            })(),
            // Fitness diary entries (last 7 days)
            (async () => {
                try {
                    const { data } = await window.supabaseClient
                        .from('daily_checkins').select('checkin_date, energy, additional_data').eq('user_id', user.id)
                        .gte('checkin_date', sevenDaysAgo).order('checkin_date', { ascending: false }).limit(7);
                    return data;
                } catch (e) { return []; }
            })()
        ]);

        context.quizResults = quizResult.status === 'fulfilled' ? (quizResult.value || {}) : {};
        context.facts = factsResult.status === 'fulfilled' ? (factsResult.value || {}) : {};
        context.dailyNutrition = nutritionResult.status === 'fulfilled' ? (nutritionResult.value || []) : [];
        context.mealLogs = mealsResult.status === 'fulfilled' ? (mealsResult.value || []) : [];
        context.workoutHistory = workoutsResult.status === 'fulfilled' ? (workoutsResult.value || []) : [];
        context.weighIns = weighInsResult.status === 'fulfilled' ? (weighInsResult.value || []) : [];
        context.activeReplacements = replacementsResult.status === 'fulfilled' ? (replacementsResult.value || []) : [];
        context.wearables = wearableResult.status === 'fulfilled' ? (wearableResult.value || {}) : {};
        context.hasAiMealPlan = aiMealPlanResult.status === 'fulfilled' && !!aiMealPlanResult.value;
        context.moodLogs = moodLogsResult.status === 'fulfilled' ? (moodLogsResult.value || []) : [];
        context.fitnessDiary = fitnessDiaryResult.status === 'fulfilled' ? (fitnessDiaryResult.value || []) : [];

        // Health IQ (calculated from learning progress)
        try {
            if (typeof window._getHealthIQProgress === 'function') {
                const hiqProgress = window._getHealthIQProgress();
                if (hiqProgress && hiqProgress.current) {
                    context.healthIQ = {
                        level: hiqProgress.current.level,
                        title: hiqProgress.current.title,
                        icon: hiqProgress.current.icon,
                        lessonsCompleted: hiqProgress.current.lessonsRequired + (hiqProgress.lessonsToNext != null ? (hiqProgress.next ? hiqProgress.next.lessonsRequired - hiqProgress.lessonsToNext - hiqProgress.current.lessonsRequired : 0) : 0),
                        nextLevel: hiqProgress.next ? hiqProgress.next.title : null,
                        lessonsToNext: hiqProgress.lessonsToNext,
                        percentToNext: hiqProgress.percent
                    };
                }
            }
            // Fallback: read from DB if learning lib not loaded yet
            if (!context.healthIQ) {
                const { data: lp } = await window.supabaseClient
                    .from('user_learning_progress').select('lessons_completed, total_lessons_completed')
                    .eq('user_id', user.id).maybeSingle();
                if (lp) {
                    const count = lp.lessons_completed?.length || lp.total_lessons_completed || 0;
                    context.healthIQ = { lessonsCompleted: count, level: null, title: null };
                }
            }
        } catch (e) { /* health IQ not critical */ }

        // Friends list (names + IDs for AI challenge creation)
        const friendsList = friendsResult.status === 'fulfilled' ? (friendsResult.value || []) : [];
        context.friends = friendsList.map(f => ({
            id: f.friend_id || f.id,
            name: f.friend_name || f.name || 'Unknown'
        }));

        // Adaptive calorie recommendation
        try {
            if (typeof analyzeAdaptiveAdjustment === 'function' && context.quizResults.calorie_goal) {
                const adaptiveResult = analyzeAdaptiveAdjustment(
                    context.dailyNutrition,
                    context.weighIns,
                    context.quizResults.calorie_goal,
                    context.quizResults.goal_weight || context.quizResults.weight
                );
                if (adaptiveResult) {
                    context.adaptiveResult = {
                        eligible: adaptiveResult.eligible,
                        suggestion: adaptiveResult.suggestion || null,
                        currentCalorieGoal: context.quizResults.calorie_goal,
                        newCalorieGoal: adaptiveResult.suggestion?.direction === 'increase'
                            ? context.quizResults.calorie_goal + (adaptiveResult.suggestion?.amount || 0)
                            : adaptiveResult.suggestion?.direction === 'decrease'
                            ? context.quizResults.calorie_goal - (adaptiveResult.suggestion?.amount || 0)
                            : context.quizResults.calorie_goal
                    };
                }
            }
        } catch (e) {
            console.warn('AI: Failed to compute adaptive adjustment:', e);
        }

        // Workout schedule (this week) - async, may fetch from DB
        context.weekSchedule = await gatherWeekSchedule();

        // Today info
        const today = new Date();
        context.todayDayIndex = (today.getDay() + 6) % 7; // Monday=0
        context.todayDate = getLocalDateString(today);

        return context;
    }

    // Simple markdown-to-HTML conversion
    function mdToHtml(text) {
        if (!text) return '';
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/^- (.*)/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/^(.*)$/, '<p>$1</p>')
            .replace(/<p><\/p>/g, '');
    }

    // Add a message to the chat UI
    function addAiMessage(text, role) {
        const container = document.getElementById('ai-assistant-messages');
        if (!container) return;
        container.style.display = 'block';

        const msgDiv = document.createElement('div');
        msgDiv.className = `ai-msg ai-msg-${role === 'user' ? 'user' : 'bot'}`;

        const bubble = document.createElement('div');
        bubble.className = 'ai-msg-bubble';
        bubble.innerHTML = role === 'user' ? text : mdToHtml(text);

        msgDiv.appendChild(bubble);
        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;

        // Show expand button
        const expandBtn = document.getElementById('ai-assistant-expand-btn');
        if (expandBtn) expandBtn.style.display = 'block';
    }

    // Show typing indicator
    function showTypingIndicator() {
        const container = document.getElementById('ai-assistant-messages');
        if (!container) return;

        const indicator = document.createElement('div');
        indicator.className = 'ai-msg ai-msg-bot';
        indicator.id = 'ai-typing';
        indicator.innerHTML = '<div class="ai-typing-indicator"><div class="ai-typing-dot"></div><div class="ai-typing-dot"></div><div class="ai-typing-dot"></div></div>';
        container.appendChild(indicator);
        container.scrollTop = container.scrollHeight;
    }

    function removeTypingIndicator() {
        const el = document.getElementById('ai-typing');
        if (el) el.remove();
    }

    // Render action confirmation cards
    function renderActions(actions) {
        if (!actions || actions.length === 0) return;

        aiPendingActions = actions;
        const container = document.getElementById('ai-assistant-actions');
        if (!container) return;
        container.style.display = 'block';

        const actionIcons = {
            swap_workouts: '🔄',
            replace_workout: '🔄',
            make_rest_day: '😴',
            update_calorie_goal: '🔥',
            update_macro_goals: '📊',
            create_workout: '💪',
            generate_meal_plan: '🥗',
            create_challenge: '⚔️',
            create_quiz: '🧠',
            create_tracker: '📊',
            create_checklist: '✅',
            create_personal_challenge: '🏆',
            search_exercises: '🔍'
        };

        // Filter out silent tool actions (search_exercises auto-executes, never shown to user)
        const visibleActions = actions.filter(a => a.type !== 'search_exercises');
        if (visibleActions.length === 0) return;

        let html = '';
        visibleActions.forEach((action) => {
            const icon = actionIcons[action.type] || '⚡';
            html += `<div class="ai-action-card">
                <div class="ai-action-title">${icon} ${action.description || action.type}</div>
            </div>`;
        });

        html += `<div class="ai-action-btns">
            <button class="ai-action-confirm accept" onclick="window._aiExecuteActions()">Confirm</button>
            <button class="ai-action-confirm decline" onclick="window._aiDeclineActions()">No thanks</button>
        </div>`;

        container.innerHTML = html;
    }

    // Helper to calculate start date for a replacement
    function calcReplacementStartDate(dayIndex) {
        const today = new Date();
        const todayDayIdx = (today.getDay() + 6) % 7;
        let daysUntil = dayIndex - todayDayIdx;
        if (daysUntil < 0) daysUntil += 7;
        const startDate = new Date(today);
        startDate.setDate(today.getDate() + daysUntil);
        return getLocalDateString(startDate);
    }

    // Execute confirmed actions
    async function executeActions() {
        const user = window.currentUser;
        if (!user) {
            addAiMessage('You need to be logged in to apply changes.', 'bot');
            return;
        }
        if (aiPendingActions.length === 0) {
            addAiMessage('No actions to apply.', 'bot');
            return;
        }

        const db = window.dbHelpers;
        if (!db) {
            addAiMessage('System error: database helpers not available. Please refresh the page.', 'bot');
            return;
        }

        const actionsContainer = document.getElementById('ai-assistant-actions');
        if (actionsContainer) {
            actionsContainer.innerHTML = '<div style="text-align: center; padding: 10px; color: var(--text-muted); font-size: 0.85rem;">Applying changes...</div>';
        }

        let successCount = 0;
        let errors = [];

        for (const action of aiPendingActions) {
            try {
                console.log('AI executing action:', JSON.stringify(action));

                switch (action.type) {
                    case 'swap_workouts': {
                        const d1 = parseInt(action.day1_index);
                        const d2 = parseInt(action.day2_index);
                        if (isNaN(d1) || isNaN(d2) || d1 < 0 || d1 > 6 || d2 < 0 || d2 > 6) {
                            throw new Error('Invalid day indices: ' + action.day1_index + ', ' + action.day2_index);
                        }

                        const day1Workout = action.day1_workout || action.day1_name || 'Workout';
                        const day2Workout = action.day2_workout || action.day2_name || 'Workout';

                        // Replace day1 with day2's workout
                        console.log('AI: Deleting existing replacement for day', d1);
                        await db.workoutReplacements.deleteForDay(user.id, d1);
                        console.log('AI: Creating replacement for day', d1, '→', day2Workout);
                        await db.workoutReplacements.create(user.id, {
                            dayOfWeek: d1,
                            workout: { name: day2Workout, type: 'swap' },
                            durationWeeks: 1,
                            startDate: calcReplacementStartDate(d1)
                        });

                        // Replace day2 with day1's workout
                        console.log('AI: Deleting existing replacement for day', d2);
                        await db.workoutReplacements.deleteForDay(user.id, d2);
                        console.log('AI: Creating replacement for day', d2, '→', day1Workout);
                        await db.workoutReplacements.create(user.id, {
                            dayOfWeek: d2,
                            workout: { name: day1Workout, type: 'swap' },
                            durationWeeks: 1,
                            startDate: calcReplacementStartDate(d2)
                        });
                        successCount++;
                        break;
                    }

                    case 'replace_workout': {
                        const dayIdx = parseInt(action.day_index);
                        if (isNaN(dayIdx) || dayIdx < 0 || dayIdx > 6) {
                            throw new Error('Invalid day index: ' + action.day_index);
                        }
                        if (!action.new_workout_name) {
                            throw new Error('Missing new_workout_name');
                        }

                        await db.workoutReplacements.deleteForDay(user.id, dayIdx);
                        await db.workoutReplacements.create(user.id, {
                            dayOfWeek: dayIdx,
                            workout: { name: action.new_workout_name, type: action.new_workout_type || 'custom' },
                            durationWeeks: parseInt(action.duration_weeks) || 1,
                            startDate: calcReplacementStartDate(dayIdx)
                        });
                        successCount++;
                        break;
                    }

                    case 'make_rest_day': {
                        const dayIdx = parseInt(action.day_index);
                        if (isNaN(dayIdx) || dayIdx < 0 || dayIdx > 6) {
                            throw new Error('Invalid day index: ' + action.day_index);
                        }

                        await db.workoutReplacements.deleteForDay(user.id, dayIdx);
                        await db.workoutReplacements.create(user.id, {
                            dayOfWeek: dayIdx,
                            workout: { name: 'Rest Day', type: 'rest' },
                            durationWeeks: 1,
                            startDate: calcReplacementStartDate(dayIdx)
                        });
                        successCount++;
                        break;
                    }

                    case 'update_calorie_goal': {
                        if (!action.new_calorie_goal || isNaN(parseInt(action.new_calorie_goal))) {
                            throw new Error('Invalid calorie goal: ' + action.new_calorie_goal);
                        }
                        const todayStr = getLocalDateString();
                        // Fetch existing goals first so we don't null-out macros
                        let existingGoals = {};
                        try {
                            const existing = await db.nutrition.getTodayGoals(user.id);
                            if (existing) existingGoals = existing;
                        } catch (e) { /* no existing entry */ }

                        await db.nutrition.updateGoals(user.id, todayStr, {
                            calorie_goal: parseInt(action.new_calorie_goal),
                            protein_goal_g: existingGoals.protein_goal_g || undefined,
                            carbs_goal_g: existingGoals.carbs_goal_g || undefined,
                            fat_goal_g: existingGoals.fat_goal_g || undefined
                        });
                        successCount++;
                        break;
                    }

                    case 'update_macro_goals': {
                        const todayStr = getLocalDateString();
                        // Fetch existing goals first so we only update specified fields
                        let existingGoals = {};
                        try {
                            const existing = await db.nutrition.getTodayGoals(user.id);
                            if (existing) existingGoals = existing;
                        } catch (e) { /* no existing entry */ }

                        await db.nutrition.updateGoals(user.id, todayStr, {
                            calorie_goal: action.new_calorie_goal ? parseInt(action.new_calorie_goal) : (existingGoals.calorie_goal || undefined),
                            protein_goal_g: action.protein_g ? parseInt(action.protein_g) : (existingGoals.protein_goal_g || undefined),
                            carbs_goal_g: action.carbs_g ? parseInt(action.carbs_g) : (existingGoals.carbs_goal_g || undefined),
                            fat_goal_g: action.fat_g ? parseInt(action.fat_g) : (existingGoals.fat_goal_g || undefined)
                        });
                        successCount++;
                        break;
                    }

                    case 'create_workout': {
                        if (!action.name) throw new Error('Missing workout name');
                        if (!action.exercises || !Array.isArray(action.exercises) || action.exercises.length === 0) {
                            throw new Error('Missing or empty exercises array');
                        }
                        await db.workouts.saveCustomWorkout(user.id, action.name, {
                            name: action.name,
                            exercises: action.exercises,
                            source: 'ai_assistant'
                        });
                        successCount++;
                        break;
                    }

                    case 'generate_meal_plan': {
                        // Trigger meal plan generation
                        addAiMessage('Starting your tailored meal plan generation! Head to the **Meals** tab and tap **Your Meal Plan** to watch it come to life.', 'bot');

                        // Navigate to meals tab and trigger generation
                        if (typeof switchAppTab === 'function') {
                            switchAppTab('meals');
                        }
                        // Show the meal plan store section and start generation
                        setTimeout(() => {
                            const pill = document.getElementById('browse-plans-pill');
                            if (pill) {
                                switchWeek('meal-plan-store', pill);
                            }
                            setTimeout(() => {
                                requestAiMealPlan();
                            }, 300);
                        }, 300);

                        successCount++;
                        break;
                    }

                    case 'create_challenge': {
                        // Create a competitive challenge with friends
                        const challengeName = action.name || 'AI Challenge';
                        const challengeType = action.challenge_type || 'xp';
                        const validTypes = ['xp', 'workouts', 'volume', 'calories', 'steps', 'streak', 'sleep', 'water', 'milestone'];
                        if (!validTypes.includes(challengeType)) {
                            throw new Error('Invalid challenge type: ' + challengeType + '. Must be one of: ' + validTypes.join(', '));
                        }
                        const entryFee = Math.max(0, parseInt(action.entry_fee) || 0);
                        const durationDays = parseInt(action.duration_days) || 30;

                        // Debit coins if entry fee > 0
                        if (entryFee > 0) {
                            const { data: newBalance, error: coinError } = await window.supabaseClient
                                .rpc('debit_coins', {
                                    user_uuid: user.id,
                                    coin_amount: entryFee,
                                    txn_type: 'challenge_entry',
                                    txn_description: 'Created challenge: ' + challengeName + ' (' + entryFee.toLocaleString() + ' coins)'
                                });
                            if (coinError) throw new Error('Coin debit failed: ' + coinError.message);
                            if (newBalance === -1) throw new Error('Not enough coins! You need ' + entryFee.toLocaleString() + ' coins.');
                        }

                        // Calculate dates
                        const startDate = getLocalDateString();
                        const endDateObj = new Date();
                        endDateObj.setDate(endDateObj.getDate() + durationDays);
                        const endDate = getLocalDateString(endDateObj);

                        // Build challenge insert data
                        const challengeInsert = {
                            name: challengeName,
                            creator_id: user.id,
                            start_date: startDate,
                            end_date: endDate,
                            duration_days: durationDays,
                            status: 'pending',
                            entry_fee: entryFee,
                            challenge_type: challengeType
                        };

                        // Add milestone criteria if this is a milestone challenge
                        if (challengeType === 'milestone') {
                            challengeInsert.milestone_criteria = {
                                exercise_name: action.exercise_name || null,
                                target_weight_kg: parseFloat(action.target_weight_kg) || null,
                                target_reps: parseInt(action.target_reps) || null,
                                metric: action.metric || 'weight_x_reps'
                            };
                        }

                        // Insert challenge
                        const { data: challenge, error: createError } = await window.supabaseClient
                            .from('challenges')
                            .insert(challengeInsert)
                            .select()
                            .single();
                        if (createError) throw createError;

                        // Add creator as participant
                        await window.supabaseClient
                            .from('challenge_participants')
                            .insert({
                                challenge_id: challenge.id,
                                user_id: user.id,
                                status: 'accepted',
                                accepted_at: new Date().toISOString(),
                                starting_points: 0,
                                current_points: 0,
                                challenge_points: 0,
                                has_paid: entryFee > 0,
                                paid_at: entryFee > 0 ? new Date().toISOString() : null
                            });

                        // Invite friends if specified
                        const friendNames = action.friend_names || [];
                        if (friendNames.length > 0) {
                            // Resolve friend names to IDs using the context friends list
                            const contextFriends = window._aiUserContext?.friends || [];
                            const friendIds = [];
                            friendNames.forEach(name => {
                                const match = contextFriends.find(f =>
                                    f.name.toLowerCase().includes(name.toLowerCase()) ||
                                    name.toLowerCase().includes(f.name.toLowerCase())
                                );
                                if (match) friendIds.push(match.id);
                            });

                            if (friendIds.length > 0) {
                                // Insert as invited participants
                                const invites = friendIds.map(fid => ({
                                    challenge_id: challenge.id,
                                    user_id: fid,
                                    status: 'invited'
                                }));
                                await window.supabaseClient.from('challenge_participants').insert(invites);

                                // Send nudge notifications
                                const creatorName = user.user_metadata?.name || user.user_metadata?.full_name || 'Someone';
                                const typeLabel = challengeType.charAt(0).toUpperCase() + challengeType.slice(1);
                                for (const fid of friendIds) {
                                    await window.supabaseClient.from('nudges').insert({
                                        sender_id: user.id,
                                        receiver_id: fid,
                                        message: `⚔️ ${typeLabel.toUpperCase()} CHALLENGE! ${creatorName} challenged you to "${challengeName}"!${entryFee > 0 ? ' 🪙 ' + entryFee.toLocaleString() + ' entry' : ''}`,
                                        nudge_type: 'challenge_invite'
                                    });
                                }
                            }
                        }

                        addAiMessage(`Challenge **"${challengeName}"** created!${friendNames.length > 0 ? ' Invites sent to your friends.' : ''} Check the Challenges tab to track progress.`, 'bot');
                        successCount++;
                        break;
                    }

                    case 'create_quiz': {
                        // Save a custom quiz card
                        if (!action.games || !Array.isArray(action.games) || action.games.length === 0) {
                            throw new Error('Quiz needs at least one game/question');
                        }
                        await window.saveCustomCard('quiz', action.title || 'Custom Quiz', action.description || '', {
                            games: action.games
                        });
                        addAiMessage(`Quiz **"${action.title || 'Custom Quiz'}"** created! You\'ll find it on your home screen.`, 'bot');
                        successCount++;
                        break;
                    }

                    case 'create_tracker': {
                        // Save a custom tracker card
                        if (!action.metrics || !Array.isArray(action.metrics) || action.metrics.length === 0) {
                            throw new Error('Tracker needs at least one metric');
                        }
                        await window.saveCustomCard('tracker', action.title || 'Custom Tracker', action.description || '', {
                            icon: action.icon || '📊',
                            color: action.color || '#0ea5e9',
                            metrics: action.metrics
                        });
                        addAiMessage(`Tracker **"${action.title || 'Custom Tracker'}"** created! Tap it on your home screen to log daily.`, 'bot');
                        successCount++;
                        break;
                    }

                    case 'create_checklist': {
                        // Save a custom checklist card
                        if (!action.items || !Array.isArray(action.items) || action.items.length === 0) {
                            throw new Error('Checklist needs at least one item');
                        }
                        await window.saveCustomCard('checklist', action.title || 'Custom Checklist', action.description || '', {
                            icon: action.icon || '✅',
                            color: action.color || '#10b981',
                            items: action.items
                        });
                        addAiMessage(`Checklist **"${action.title || 'Custom Checklist'}"** created! Check it off daily from your home screen.`, 'bot');
                        successCount++;
                        break;
                    }

                    case 'create_personal_challenge': {
                        // Save a personal challenge card (XP capped at 5)
                        const xpReward = Math.min(parseInt(action.xp_reward) || 0, 5);
                        await window.saveCustomCard('challenge', action.title || 'Personal Challenge', action.description || '', {
                            icon: action.icon || '🏆',
                            color: action.color || '#f59e0b',
                            duration_days: parseInt(action.duration_days) || 30,
                            rules: action.rules || [],
                            success_criteria: action.success_criteria || '',
                            xp_reward: xpReward
                        });
                        addAiMessage(`Personal challenge **"${action.title || 'Personal Challenge'}"** created!${xpReward > 0 ? ' Complete it to earn ' + xpReward + ' XP.' : ''} Find it on your home screen.`, 'bot');
                        successCount++;
                        break;
                    }

                    case 'log_weight': {
                        const weightKg = parseFloat(action.weight_kg);
                        if (!weightKg || weightKg < 20 || weightKg > 300) {
                            errors.push('Invalid weight value');
                            break;
                        }
                        const notes = action.notes || null;
                        const bodyFatPct = action.body_fat_pct ? parseFloat(action.body_fat_pct) : null;
                        await db.weighIns.log(user.id, weightKg, notes, bodyFatPct);
                        addAiMessage(`Logged your weight: **${weightKg} kg**${bodyFatPct ? ` (${bodyFatPct}% body fat)` : ''}${notes ? ` — "${notes}"` : ''} ✅`, 'bot');
                        successCount++;
                        break;
                    }

                    case 'log_water': {
                        const glasses = parseInt(action.glasses);
                        if (!glasses || glasses < 1 || glasses > 30) {
                            errors.push('Invalid water intake value');
                            break;
                        }
                        const now = new Date();
                        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                        await window.supabaseClient
                            .from('daily_checkins')
                            .upsert({
                                user_id: user.id,
                                checkin_date: todayStr,
                                water_intake: glasses
                            }, { onConflict: 'user_id,checkin_date' });
                        addAiMessage(`Logged **${glasses} glasses** of water for today 💧`, 'bot');
                        successCount++;
                        break;
                    }

                    case 'set_weight_goal': {
                        const goalWeight = parseFloat(action.goal_weight_kg);
                        if (!goalWeight || goalWeight < 30 || goalWeight > 250) {
                            errors.push('Invalid goal weight value');
                            break;
                        }
                        const { error: gwError } = await window.supabaseClient
                            .from('quiz_results')
                            .update({ goal_weight: goalWeight })
                            .eq('user_id', user.id);
                        if (gwError) throw gwError;
                        addAiMessage(`Weight goal set to **${goalWeight} kg** 🎯`, 'bot');
                        successCount++;
                        break;
                    }

                    case 'send_nudge': {
                        const nudgeFriendName = action.friend_name;
                        const contextFriendsNudge = window._aiUserContext?.friends || [];
                        const nudgeFriend = contextFriendsNudge.find(f =>
                            f.name && f.name.toLowerCase().includes(nudgeFriendName?.toLowerCase())
                        );
                        if (!nudgeFriend) {
                            errors.push(`Couldn't find friend "${nudgeFriendName}" in your friends list`);
                            break;
                        }
                        const nudgeMessage = action.message || `Hey! Just checking in - have you worked out today? 💪`;
                        const { error: nudgeError } = await window.supabaseClient
                            .from('nudges')
                            .insert({
                                sender_id: user.id,
                                receiver_id: nudgeFriend.id,
                                message: nudgeMessage
                            });
                        if (nudgeError) throw nudgeError;
                        addAiMessage(`Nudge sent to **${nudgeFriend.name}**! 👋`, 'bot');
                        successCount++;
                        break;
                    }

                    case 'log_activity': {
                        const activityType = action.activity_type || 'cardio';
                        const activityLabel = action.activity_label || action.name || activityType;
                        const durationMin = parseInt(action.duration_minutes);
                        if (!durationMin || durationMin < 1 || durationMin > 600) {
                            errors.push('Invalid activity duration');
                            break;
                        }
                        const activityIntensity = action.intensity || 'moderate';
                        const estCalories = action.estimated_calories ? parseInt(action.estimated_calories) : null;
                        await db.activityLogs.create(user.id, {
                            activity_type: activityType,
                            activity_label: activityLabel,
                            duration_minutes: durationMin,
                            intensity: activityIntensity,
                            estimated_calories: estCalories,
                            notes: action.notes || null
                        });
                        addAiMessage(`Logged **${activityLabel}** — ${durationMin} min${activityIntensity !== 'moderate' ? ` (${activityIntensity})` : ''}${estCalories ? `, ~${estCalories} cal` : ''} 🏃`, 'bot');
                        successCount++;
                        break;
                    }

                    case 'create_custom_exercise': {
                        const exName = action.exercise_name || action.name;
                        if (!exName) {
                            errors.push('Exercise name is required');
                            break;
                        }
                        await db.customExercises.create(user.id, {
                            name: exName,
                            description: action.description || '',
                            muscleGroup: action.muscle_group || 'other',
                            equipment: action.equipment || 'bodyweight',
                            sets: parseInt(action.default_sets) || 3,
                            reps: action.default_reps || '8-12'
                        });
                        addAiMessage(`Custom exercise **"${exName}"** added to your library! 💪 You can now use it in any workout.`, 'bot');
                        successCount++;
                        break;
                    }

                    default:
                        console.warn('Unknown AI action type:', action.type);
                        errors.push('Unknown action: ' + action.type);
                }
            } catch (err) {
                console.error('Error executing AI action:', action.type, err);
                const errMsg = err?.message || err?.details || (typeof err === 'string' ? err : 'unknown error');
                errors.push(action.type + ': ' + errMsg);
            }
        }

        // Clear pending
        aiPendingActions = [];
        if (actionsContainer) {
            actionsContainer.style.display = 'none';
            actionsContainer.innerHTML = '';
        }

        if (errors.length === 0 && successCount > 0) {
            addAiMessage('Done! I\'ve made those changes for you.', 'bot');
        } else if (successCount > 0) {
            addAiMessage('Partially done - some changes were applied but there were issues with: ' + errors.join('; '), 'bot');
        } else {
            addAiMessage('Sorry, something went wrong applying those changes.\n\n**Error:** ' + errors.join('; '), 'bot');
        }

        // Refresh the calendar views
        try {
            if (typeof loadActiveReplacements === 'function') await loadActiveReplacements();
            if (typeof renderWeeklyCalendar === 'function') renderWeeklyCalendar();
            if (typeof renderMonthlyCalendar === 'function') renderMonthlyCalendar();
        } catch (e) {
            console.warn('Could not refresh calendar:', e);
        }
    }

    function declineActions() {
        aiPendingActions = [];
        const container = document.getElementById('ai-assistant-actions');
        if (container) {
            container.style.display = 'none';
            container.innerHTML = '';
        }
        addAiMessage('No worries! Let me know if you need anything else.', 'bot');
    }

    // Main send function
    async function sendMessage() {
        if (aiIsLoading) return;

        const input = document.getElementById('ai-assistant-input');
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;

        input.value = '';
        aiIsLoading = true;

        // Disable send button
        const sendBtn = document.getElementById('ai-assistant-send-btn');
        if (sendBtn) sendBtn.style.opacity = '0.5';

        // Show user message
        addAiMessage(text, 'user');
        showTypingIndicator();

        // Add to history
        aiChatHistory.push({ role: 'user', text: text });

        try {
            // Gather context
            const userData = await gatherUserContext();
            window._aiUserContext = userData;

            // Call the edge function
            const response = await fetch('/.netlify/functions/home-ai-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    userData: userData,
                    chatHistory: aiChatHistory.slice(-20)
                })
            });

            removeTypingIndicator();

            if (!response.ok) {
                const errText = await response.text();
                console.error('AI response error:', response.status, errText);
                throw new Error('AI request failed: ' + response.status);
            }

            const data = await response.json();

            if (data.error) {
                console.error('AI returned error:', data.error, data.details);
                addAiMessage('Sorry, I ran into an issue. Please try again!', 'bot');
            } else {
                // Check for search_exercises tool action (auto-execute, no confirm)
                const searchAction = data.actions?.find(a => a.type === 'search_exercises');
                if (searchAction) {
                    // Show the AI's reply while we search
                    addAiMessage(data.reply, 'bot');
                    aiChatHistory.push({ role: 'bot', text: data.reply });

                    // Run the exercise search client-side
                    const searchResults = searchExerciseLibrary(searchAction.queries || [searchAction.query || '']);

                    // Feed results back as a system message and call AI again
                    showTypingIndicator();
                    const toolResultMsg = `[EXERCISE SEARCH RESULTS]\n${searchResults}\n\nNow use ONLY exercises from these results to build the workout. Use the exact exercise names as shown.`;
                    aiChatHistory.push({ role: 'user', text: toolResultMsg });

                    try {
                        const followUp = await fetch('/.netlify/functions/home-ai-chat', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                message: toolResultMsg,
                                userData: userData,
                                chatHistory: aiChatHistory.slice(-20)
                            })
                        });
                        removeTypingIndicator();

                        if (followUp.ok) {
                            const followUpData = await followUp.json();
                            if (followUpData.reply) {
                                addAiMessage(followUpData.reply, 'bot');
                                aiChatHistory.push({ role: 'bot', text: followUpData.reply });
                            }
                            // Show non-search actions for confirmation
                            const realActions = (followUpData.actions || []).filter(a => a.type !== 'search_exercises');
                            if (realActions.length > 0) {
                                renderActions(realActions);
                            }
                        }
                    } catch (e) {
                        removeTypingIndicator();
                        console.error('Follow-up AI call failed:', e);
                    }
                } else {
                    // Normal flow: show reply and actions
                    addAiMessage(data.reply, 'bot');
                    aiChatHistory.push({ role: 'bot', text: data.reply });

                    if (data.actions && data.actions.length > 0) {
                        renderActions(data.actions);
                    }
                }
            }
        } catch (err) {
            console.error('AI Assistant error:', err);
            removeTypingIndicator();
            addAiMessage('Sorry, I couldn\'t connect right now. Please try again in a moment.', 'bot');
        }

        aiIsLoading = false;
        if (sendBtn) sendBtn.style.opacity = '1';
    }

    // Exercise search tool — searches EXERCISE_VIDEOS + WORKOUT_LIBRARY + custom exercises
    function searchExerciseLibrary(queries) {
        const results = [];
        const seen = new Set();

        for (const query of queries) {
            if (!query || query.length < 2) continue;
            const terms = query.toLowerCase().split(' ').filter(t => t);

            // Search EXERCISE_VIDEOS (the main exercise library)
            if (typeof EXERCISE_VIDEOS !== 'undefined') {
                const matches = Object.keys(EXERCISE_VIDEOS).filter(name => {
                    const nameLower = name.toLowerCase();
                    return terms.every(term => nameLower.includes(term));
                });

                // Score and sort
                matches.sort((a, b) => {
                    const scoreA = scoreExerciseMatch(a, terms, query);
                    const scoreB = scoreExerciseMatch(b, terms, query);
                    return scoreB - scoreA;
                });

                // Take top 15 per query
                matches.slice(0, 15).forEach(name => {
                    if (!seen.has(name)) {
                        seen.add(name);
                        results.push(name);
                    }
                });
            }

            // Search WORKOUT_LIBRARY for exercises in relevant subcategories
            if (typeof WORKOUT_LIBRARY !== 'undefined') {
                for (const [catKey, cat] of Object.entries(WORKOUT_LIBRARY)) {
                    const subs = cat.subcategories || {};
                    for (const [subKey, sub] of Object.entries(subs)) {
                        // Check if this subcategory matches any search term
                        const subLower = subKey.toLowerCase();
                        const catLower = catKey.toLowerCase();
                        const nameMatch = terms.some(t => subLower.includes(t) || catLower.includes(t));
                        if (nameMatch) {
                            (sub.workouts || []).forEach(w => {
                                (w.exercises || []).forEach(ex => {
                                    const eName = ex.name;
                                    if (!seen.has(eName)) {
                                        seen.add(eName);
                                        results.push(`${eName} (${ex.sets} sets x ${ex.reps})`);
                                    }
                                });
                            });
                        }
                    }
                }
            }

            // Search custom exercises
            (window._customExercisesCache || []).forEach(ex => {
                const nameLower = ex.exercise_name.toLowerCase();
                if (terms.every(t => nameLower.includes(t)) && !seen.has(ex.exercise_name)) {
                    seen.add(ex.exercise_name);
                    results.push(`${ex.exercise_name} [CUSTOM]${ex.muscle_group ? ' (' + ex.muscle_group + ')' : ''}`);
                }
            });
        }

        if (results.length === 0) {
            return 'No exercises found. You can still suggest exercises by common name — the user may have them available.';
        }
        return results.slice(0, 60).join('\n');
    }

    // Toggle expand/collapse
    function toggleExpand() {
        const messages = document.getElementById('ai-assistant-messages');
        if (!messages) return;
        if (messages.style.display === 'none') {
            messages.style.display = 'block';
        } else {
            messages.style.display = 'none';
        }
    }

    // Expose functions globally
    window.sendAiAssistantMessage = sendMessage;
    window.toggleAiAssistantExpand = toggleExpand;
    window._aiExecuteActions = executeActions;
    window._aiDeclineActions = declineActions;
    window._aiAddMessage = addAiMessage;
    window._aiRenderActions = renderActions;
})();
