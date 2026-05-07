(function() {
    // Chat state
    let aiChatHistory = [];
    let aiPendingActions = [];
    let aiIsLoading = false;
    let askBalanceConversationMode = null;

    const ASK_BALANCE_SHORTCUTS = [
        { target: 'quick-log-photo', label: 'Opening the meal camera', terms: ['camera', 'photo', 'snap meal', 'meal photo', 'take a photo'] },
        { target: 'barcode', label: 'Opening barcode scanner', terms: ['barcode', 'scan barcode', 'scanner'] },
        { target: 'manual-log', label: 'Opening manual macros', terms: ['manual macros', 'manual calories', 'enter macros', 'known macros'] },
        { target: 'recent-meals', label: 'Opening recent meals', terms: ['recent meal', 'saved meal', 'same meal', 'relog meal'] },
        { target: 'quick-log', label: 'Opening quick log', terms: ['quick log', 'type meal'] },
        { target: 'calorie-tracker', label: 'Opening calorie tracker', terms: ['track calories', 'calorie tracker', 'calories', 'macros', 'nutrition tracker'] },
        { target: 'meal-plan', label: 'Opening your meal plan', terms: ['meal plan', 'food plan', 'menu'] },
        { target: 'today-workout', label: 'Opening today\'s workout', terms: ['today workout', 'daily workout', 'start workout', 'open workout', 'my workout'] },
        { target: 'workout-builder', label: 'Opening workout builder', terms: ['build workout', 'workout builder', 'custom workout'] },
        { target: 'workout-library', label: 'Opening workout library', terms: ['workout library', 'program library', 'browse workouts'] },
        { target: 'daily-quiz', label: 'Opening today\'s quiz', terms: ['daily quiz', 'open quiz', 'start quiz', 'quiz', 'health iq'] },
        { target: 'feed-photo', label: 'Opening a feed post', terms: ['post photo', 'post a photo', 'post this photo', 'share photo', 'share a photo', 'post on feed', 'post to feed', 'photo on feed'] },
        { target: 'feed', label: 'Opening Feed', terms: ['open feed', 'go to feed', 'feed tab'] },
        { target: 'movement', label: 'Opening Movement', terms: ['movement tab', 'training tab'] },
        { target: 'coach', label: 'Opening messages with Shannon', terms: ['message shannon', 'coach', 'dm shannon', 'message coach'] },
        { target: 'form-check', label: 'Opening form check', terms: ['form check', 'check form', 'technique check'] },
        { target: 'weigh-in', label: 'Opening weigh-in', terms: ['weigh in', 'weigh-in', 'weight', 'scale'] },
        { target: 'mood-check', label: 'Opening mood check', terms: ['mood check', 'energy check', 'stress check'] },
        { target: 'fitgotchi', label: 'Opening your character', terms: ['character', 'fitgotchi', 'avatar'] },
        { target: 'ask-balance', label: 'Opening Ask Balance', terms: ['ask balance'] },
        { target: 'dashboard', label: 'Opening Home', terms: ['home', 'dashboard'] }
    ];

    const ASK_BALANCE_STOP_WORDS = new Set([
        'a', 'an', 'and', 'add', 'delete', 'remove', 'replace', 'swap', 'with', 'the', 'this',
        'that', 'exercise', 'workout', 'please', 'want', 'wanna', 'to', 'from', 'for', 'in',
        'my', 'current', 'today', 'session', 'instead', 'put', 'it'
    ]);

    const ASK_BALANCE_TITLE_COLORS = ['#7BA883', '#0f766e', '#2563eb', '#a855f7', '#db2777', '#d97706'];

    function normalizeAskBalanceText(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9.\s-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function setAskBalanceLoading(isLoading) {
        const page = document.getElementById('view-ask-balance');
        if (page) page.classList.toggle('thinking', !!isLoading);
        const sendBtn = document.getElementById('ai-assistant-send-btn');
        if (sendBtn) sendBtn.style.opacity = isLoading ? '0.5' : '1';
    }

    function refreshAskBalanceTitleColor() {
        const label = document.querySelector('#view-ask-balance .ask-balance-page-kicker');
        if (!label || ASK_BALANCE_TITLE_COLORS.length === 0) return;

        const current = Number(label.dataset.askBalanceColorIndex || '-1');
        const next = (current + 1) % ASK_BALANCE_TITLE_COLORS.length;
        label.dataset.askBalanceColorIndex = String(next);
        label.style.setProperty('--ask-balance-accent', ASK_BALANCE_TITLE_COLORS[next]);
    }

    function openAskBalanceSheet(prefill, options) {
        try { hideAskBalanceCommandPalette(); } catch(e) {}
        if (typeof switchAppTab === 'function') {
            switchAppTab('ask-balance', document.querySelector('.bottom-nav .nav-item[onclick*="ask-balance"]'));
        }
        const input = document.getElementById('ai-assistant-input');
        if (input && typeof prefill === 'string') {
            input.value = prefill;
        }
        setTimeout(() => {
            const activeInput = document.getElementById('ai-assistant-input');
            if (activeInput) {
                activeInput.focus();
                if (activeInput.setSelectionRange) activeInput.setSelectionRange(activeInput.value.length, activeInput.value.length);
            }
        }, 80);
        if (options && options.sendNow) {
            setTimeout(() => sendMessage(), 90);
        }
    }

    function closeAskBalanceSheet() {
        // Kept for older inline handlers; Ask Balance is now a real app page.
    }

    function showAskBalanceCommandPalette(prefill) {
        const palette = document.getElementById('ask-balance-command-palette');
        const input = document.getElementById('ask-balance-palette-input');
        if (!palette || !input) {
            openAskBalanceSheet(typeof prefill === 'string' ? prefill : '');
            return;
        }
        if (typeof prefill === 'string') input.value = prefill;
        palette.classList.add('visible');
        palette.setAttribute('aria-hidden', 'false');
        setTimeout(() => {
            input.focus();
            if (input.setSelectionRange) input.setSelectionRange(input.value.length, input.value.length);
        }, 40);
    }

    function hideAskBalanceCommandPalette() {
        const palette = document.getElementById('ask-balance-command-palette');
        if (!palette) return;
        palette.classList.remove('visible');
        palette.setAttribute('aria-hidden', 'true');
    }

    function submitAskBalanceCommandPalette() {
        const input = document.getElementById('ask-balance-palette-input');
        const text = input ? input.value.trim() : '';
        if (!text) {
            if (input) input.focus();
            return;
        }
        if (input) input.value = '';
        hideAskBalanceCommandPalette();
        openAskBalanceSheet(text, { sendNow: true });
    }

    function isAskBalancePageVisible() {
        const page = document.getElementById('view-ask-balance');
        return !!(page && page.style.display !== 'none');
    }

    function shouldIgnoreAskBalanceHold(target) {
        if (!target || !target.closest) return false;
        return !!target.closest('input, textarea, select, button, a, [contenteditable="true"], .ask-balance-command-card, .bottom-nav');
    }

    function initializeAskBalanceLongPress() {
        const palette = document.getElementById('ask-balance-command-palette');
        if (palette) {
            palette.addEventListener('click', event => {
                if (event.target === palette) hideAskBalanceCommandPalette();
            });
        }
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') hideAskBalanceCommandPalette();
        });

        let holdTimer = null;
        let holdStart = null;
        let holdPointerId = null;

        document.addEventListener('contextmenu', event => {
            const visiblePalette = document.getElementById('ask-balance-command-palette');
            if (holdTimer || (visiblePalette && visiblePalette.classList.contains('visible'))) {
                event.preventDefault();
            }
        }, { passive: false });

        function clearHoldTimer() {
            if (holdTimer) clearTimeout(holdTimer);
            holdTimer = null;
            holdStart = null;
            holdPointerId = null;
        }

        document.addEventListener('pointerdown', event => {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            if (isAskBalancePageVisible()) return;
            const visiblePalette = document.getElementById('ask-balance-command-palette');
            if (visiblePalette && visiblePalette.classList.contains('visible')) return;
            if (shouldIgnoreAskBalanceHold(event.target)) return;

            clearHoldTimer();
            holdPointerId = event.pointerId;
            holdStart = { x: event.clientX, y: event.clientY };
            holdTimer = setTimeout(() => {
                holdTimer = null;
                holdStart = null;
                holdPointerId = null;
                event.preventDefault();
                showAskBalanceCommandPalette('');
            }, 3000);
        }, { passive: false });

        document.addEventListener('pointermove', event => {
            if (!holdTimer || holdPointerId !== event.pointerId || !holdStart) return;
            const dx = Math.abs(event.clientX - holdStart.x);
            const dy = Math.abs(event.clientY - holdStart.y);
            if (dx > 18 || dy > 18) clearHoldTimer();
        }, { passive: true });

        document.addEventListener('pointerup', clearHoldTimer, { passive: true });
        document.addEventListener('pointercancel', clearHoldTimer, { passive: true });
        document.addEventListener('scroll', clearHoldTimer, true);
    }

    function submitAskBalanceBar() {
        const input = document.getElementById('ask-balance-global-input');
        const text = input ? input.value.trim() : '';
        if (!text) {
            openAskBalanceSheet('');
            return;
        }
        if (input) input.value = '';
        openAskBalanceSheet(text, { sendNow: true });
    }

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

    function gatherCurrentWorkoutContext() {
        const cards = Array.from(document.querySelectorAll('#workout-exercises-list .exercise-logger-card[data-exercise-name]'));
        const workoutView = document.getElementById('view-active-workout');
        const hasWorkout = cards.length > 0 && (workoutView || window.currentWorkoutKey || window.currentWorkoutName);
        if (!hasWorkout) return null;
        return {
            active: true,
            workoutKey: window.currentWorkoutKey || null,
            workoutName: window.currentWorkoutName || document.getElementById('workout-player-title')?.textContent?.trim() || 'Workout',
            exercises: cards.map((card, index) => ({
                index,
                name: card.dataset.exerciseName || '',
                isUserAdded: card.dataset.isUserAdded === 'true'
            })).filter(ex => ex.name)
        };
    }

    function updateWorkoutExerciseCountLabel() {
        const remainingExercises = document.querySelectorAll('#workout-exercises-list .exercise-logger-card').length;
        const goalEl = document.getElementById('workout-player-goal');
        if (goalEl) {
            const currentText = goalEl.textContent || '';
            if (/\d+ Exercise[s]?/.test(currentText)) {
                goalEl.textContent = currentText.replace(/\d+ Exercise[s]?/, `${remainingExercises} Exercise${remainingExercises !== 1 ? 's' : ''}`);
            }
        }
    }

    function singularToken(token) {
        return String(token || '').replace(/ies$/, 'y').replace(/s$/, '');
    }

    function tokenizeMeaningful(value) {
        return normalizeAskBalanceText(value)
            .split(' ')
            .map(singularToken)
            .filter(token => token.length > 1 && !ASK_BALANCE_STOP_WORDS.has(token));
    }

    function scoreNameAgainstText(name, text) {
        const normalizedName = normalizeAskBalanceText(name);
        const normalizedText = normalizeAskBalanceText(text);
        if (!normalizedName || !normalizedText) return 0;
        if (normalizedText.includes(normalizedName)) return 1000 + normalizedName.length;
        const textTokens = new Set(tokenizeMeaningful(normalizedText));
        const nameTokens = tokenizeMeaningful(normalizedName);
        if (nameTokens.length === 0) return 0;
        let score = 0;
        nameTokens.forEach(token => {
            if (textTokens.has(token)) score += 40;
            else if (Array.from(textTokens).some(t => t.includes(token) || token.includes(t))) score += 18;
        });
        return score;
    }

    function findBestFromNames(names, query) {
        const scored = names
            .map(name => ({ name, score: scoreNameAgainstText(name, query) }))
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score || a.name.length - b.name.length);
        if (scored.length === 0) return { match: null, ambiguous: [] };
        const top = scored[0];
        const tied = scored.filter(item => item.score === top.score).slice(0, 4);
        return {
            match: tied.length === 1 ? top.name : null,
            ambiguous: tied.map(item => item.name),
            top: top.name
        };
    }

    function extractAddExerciseQuery(text) {
        const normalized = normalizeAskBalanceText(text);
        const replaceMatch = normalized.match(/\b(?:replace|swap)\b.+?\bwith\b\s+(.+)$/);
        if (replaceMatch && replaceMatch[1]) return replaceMatch[1];
        const addMatch = normalized.match(/\b(?:add|put in|swap in)\b\s+(.+)$/);
        if (addMatch && addMatch[1]) return addMatch[1];
        return '';
    }

    function findExerciseLibraryMatches(query, limit) {
        const cleanQuery = tokenizeMeaningful(query).join(' ');
        if (!cleanQuery || typeof EXERCISE_VIDEOS === 'undefined') return [];
        const terms = cleanQuery.split(' ').filter(Boolean);
        const names = Object.keys(EXERCISE_VIDEOS);
        return names
            .map(name => ({
                name,
                score: typeof scoreExerciseMatch === 'function'
                    ? scoreExerciseMatch(name, terms, cleanQuery)
                    : scoreNameAgainstText(name, cleanQuery)
            }))
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score || a.name.length - b.name.length)
            .slice(0, limit || 5)
            .map(item => item.name);
    }

    async function removeCurrentWorkoutExercise(exerciseName) {
        const cards = Array.from(document.querySelectorAll('#workout-exercises-list .exercise-logger-card[data-exercise-name]'));
        const card = cards.find(el => (el.dataset.exerciseName || '') === exerciseName);
        if (!card) throw new Error(`Could not find ${exerciseName} in this workout`);
        const user = window.currentUser;
        const workoutKey = window.currentWorkoutKey;
        if (user && workoutKey && window.dbHelpers?.workoutCustomizations) {
            await window.dbHelpers.workoutCustomizations.removeExercise(user.id, workoutKey, exerciseName);
        }
        card.remove();
        updateWorkoutExerciseCountLabel();
        return exerciseName;
    }

    async function addCurrentWorkoutExercise(exerciseName) {
        if (!exerciseName) throw new Error('Missing exercise name');
        if (typeof addExerciseToUI !== 'function') {
            throw new Error('Workout editor is not ready yet');
        }
        const user = window.currentUser;
        const workoutKey = window.currentWorkoutKey;
        const exercise = {
            name: exerciseName,
            sets: 3,
            reps: '8-12',
            desc: 'Added by Ask Balance',
            isUserAdded: true
        };
        addExerciseToUI(exercise);
        if (user && workoutKey && window.dbHelpers?.workoutCustomizations) {
            await window.dbHelpers.workoutCustomizations.addExercise(user.id, workoutKey, {
                name: exerciseName,
                sets: 3,
                reps: '8-12',
                desc: 'Added by Ask Balance'
            });
        }
        return exerciseName;
    }

    async function tryHandleWorkoutEditCommand(text) {
        const normalized = normalizeAskBalanceText(text);
        const wantsRemove = /\b(delete|remove|replace|swap out)\b/.test(normalized);
        const wantsAdd = /\b(add|replace|swap in|put in)\b/.test(normalized);
        if (!wantsRemove && !wantsAdd) return false;

        const context = gatherCurrentWorkoutContext();
        if (!context || !context.exercises || context.exercises.length === 0) return false;

        const completed = [];
        if (wantsRemove) {
            const names = context.exercises.map(ex => ex.name);
            const result = findBestFromNames(names, normalized);
            if (!result.match) {
                const options = result.ambiguous.length ? result.ambiguous.join(', ') : names.slice(0, 4).join(', ');
                addAiMessage(`Which exercise should I remove? I can see: ${options}.`, 'bot');
                return true;
            }
            const removed = await removeCurrentWorkoutExercise(result.match);
            completed.push(`removed **${removed}**`);
        }

        if (wantsAdd) {
            const addQuery = extractAddExerciseQuery(text);
            if (!addQuery || tokenizeMeaningful(addQuery).length === 0) {
                addAiMessage('Which exercise should I add?', 'bot');
                return true;
            }
            const matches = findExerciseLibraryMatches(addQuery, 4);
            if (matches.length === 0) {
                addAiMessage(`I could not find "${addQuery}" in the exercise library. Try the exact exercise name or ask me to create it as a custom exercise.`, 'bot');
                return true;
            }
            const added = await addCurrentWorkoutExercise(matches[0]);
            completed.push(`added **${added}**`);
        }

        if (completed.length > 0) {
            addAiMessage(`Done, ${completed.join(' and ')}.`, 'bot');
            return true;
        }
        return false;
    }

    function isMealTrackingRequest(text) {
        const normalized = normalizeAskBalanceText(text);
        if (!normalized) return false;
        return /\b(track|log|add)\b/.test(normalized)
            && /\b(calorie|calories|food|meal|macros|breakfast|lunch|dinner|snack)\b/.test(normalized);
    }

    function extractMealDescriptionFromCommand(text) {
        const raw = String(text || '').trim();
        const stripped = raw
            .replace(/^\s*(can you\s+)?(please\s+)?(track|log|add)\s+(these|this|my|the)?\s*(calories|food|meal|macros)?\s*(for|:|-)?\s*/i, '')
            .trim();
        if (!stripped) return '';
        if (/^(these|this|calories|food|meal|macros|it|that)$/i.test(stripped)) return '';
        return stripped.length >= 3 ? stripped : '';
    }

    async function logMealFromAskBalance(description) {
        if (typeof saveMealLogWithType !== 'function') {
            addAiMessage('Meal logging is still loading. Try again in a second.', 'bot');
            return true;
        }

        const mealType = typeof autoDetectMealType === 'function' ? autoDetectMealType() : 'snack';
        const response = await fetch('/.netlify/functions/analyze-meal-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description, mealType })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Could not analyse that meal.' }));
            throw new Error(errorData.error || 'Could not analyse that meal.');
        }

        const result = await response.json();
        if (!result.success || !result.data) {
            throw new Error('Could not analyse that meal.');
        }

        const nutritionData = result.data;
        await saveMealLogWithType({
            foodItems: nutritionData.foodItems || [],
            totals: nutritionData.totals || {},
            micronutrients: nutritionData.micronutrients || {},
            confidence: nutritionData.confidence || 'medium',
            notes: nutritionData.notes || description,
            mealType,
            inputMethod: 'text',
            mealDescription: description
        });

        try { if (typeof recalculateDailyNutrition === 'function') await recalculateDailyNutrition(); } catch (e) {}
        try { if (typeof loadTodayNutrition === 'function') await loadTodayNutrition(); } catch (e) {}
        try { if (typeof loadMicronutrientInsights === 'function') await loadMicronutrientInsights(); } catch (e) {}
        try { if (typeof checkMealBadges === 'function') checkMealBadges(); } catch (e) {}

        const calories = Math.round(nutritionData.totals?.calories || 0);
        const itemNames = (nutritionData.foodItems || []).map(item => item.name).filter(Boolean).slice(0, 3).join(', ');
        addAiMessage(`Logged **${calories || '?'} calories**${itemNames ? ` for ${itemNames}` : ''}.`, 'bot');
        return true;
    }

    async function tryHandleAskBalanceMealFlow(text) {
        if (askBalanceConversationMode?.type === 'meal-intake') {
            askBalanceConversationMode = null;
            await logMealFromAskBalance(text);
            return true;
        }

        if (!isMealTrackingRequest(text)) return false;
        const description = extractMealDescriptionFromCommand(text);
        if (description) {
            await logMealFromAskBalance(description);
            return true;
        }

        askBalanceConversationMode = { type: 'meal-intake' };
        addAiMessage('Okay, what did you eat?', 'bot');
        return true;
    }

    function resolveShortcutTarget(text) {
        const normalized = normalizeAskBalanceText(text);
        if (!normalized) return null;
        if ((normalized.includes('camera') || normalized.includes('photo') || normalized.includes('snap')) &&
            (normalized.includes('meal') || normalized.includes('food') || normalized.includes('calorie') || normalized === 'camera')) {
            return ASK_BALANCE_SHORTCUTS.find(item => item.target === 'quick-log-photo');
        }
        if (normalized.includes('log') && /\b\d+/.test(normalized) && (normalized.includes('cal') || normalized.includes('macro'))) {
            return ASK_BALANCE_SHORTCUTS.find(item => item.target === 'manual-log');
        }
        return ASK_BALANCE_SHORTCUTS.find(shortcut => shortcut.terms.some(term => normalized.includes(term))) || null;
    }

    async function tryHandleInstantCommand(text) {
        if (await tryHandleAskBalanceMealFlow(text)) return true;
        if (await tryHandleWorkoutEditCommand(text)) return true;
        const shortcut = resolveShortcutTarget(text);
        if (!shortcut) return false;
        const handled = typeof window.handleBalanceShortcutAction === 'function'
            ? window.handleBalanceShortcutAction(shortcut.target)
            : false;
        if (!handled) {
            window._pendingBalanceShortcutAction = shortcut.target;
        }
        addAiMessage(`${shortcut.label}.`, 'bot');
        setTimeout(closeAskBalanceSheet, 450);
        return true;
    }

    // Gather all user context data for the AI
    async function gatherUserContext() {
        const user = window.currentUser;
        if (!user) return {};

        const db = window.dbHelpers;
        const context = {};

        // Profile
        context.profile = { name: user.user_metadata?.name || user.email?.split('@')[0] || 'User' };
        // Pass user.id to the edge function so it can fetch RLS-protected
        // data (e.g. linked ig_threads / ig_messages) server-side using the
        // service role. The client itself can't read those tables.
        context.userId = user.id;

        const twoWeeksAgoDate = new Date(); twoWeeksAgoDate.setDate(twoWeeksAgoDate.getDate() - 14);
        const twoWeeksAgo = getLocalDateString(twoWeeksAgoDate);
        const sevenDaysAgoDate = new Date(); sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 7);
        const sevenDaysAgo = getLocalDateString(sevenDaysAgoDate);
        const todayStr = getLocalDateString();

        // Run all data fetches in parallel for speed
        const [quizResult, factsResult, nutritionResult, mealsResult, workoutsResult, weighInsResult, replacementsResult, wearableResult, friendsResult, aiMealPlanResult, moodLogsResult, fitnessDiaryResult, pointsResult, personalBestsResult, workoutMilestonesResult, mealMilestonesResult] = await Promise.allSettled([
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
            })(),
            // Points, streaks, lifetime totals (gamification core)
            (async () => {
                try { return await db.points.getPoints(user.id); } catch (e) { return null; }
            })(),
            // Personal bests (top 10 most recent PRs)
            (async () => {
                try { return await db.personalBests.getAll(user.id, 10); } catch (e) { return []; }
            })(),
            // Workout milestones (achievements)
            (async () => {
                try { return await db.milestones.getAll(user.id, 10); } catch (e) { return []; }
            })(),
            // Meal milestones (achievements)
            (async () => {
                try { return await db.points.getMilestones(user.id); } catch (e) { return []; }
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
        context.points = pointsResult.status === 'fulfilled' ? (pointsResult.value || null) : null;
        context.personalBests = personalBestsResult.status === 'fulfilled' ? (personalBestsResult.value || []) : [];
        context.workoutMilestones = workoutMilestonesResult.status === 'fulfilled' ? (workoutMilestonesResult.value || []) : [];
        context.mealMilestones = mealMilestonesResult.status === 'fulfilled' ? (mealMilestonesResult.value || []) : [];

        // Tamagotchi / character: level from lifetime points + battle stats from localStorage
        try {
            const lifetimePoints = context.points?.lifetime_points || 0;
            let levelInfo = null;
            if (typeof calculateLevel === 'function') {
                const ld = calculateLevel(lifetimePoints);
                const title = typeof getLevelTitle === 'function' ? getLevelTitle(ld.level) : null;
                levelInfo = {
                    level: ld.level,
                    title,
                    progressPercent: ld.progress,
                    pointsIntoLevel: ld.pointsIntoLevel,
                    pointsNeededForNext: ld.pointsNeededForNext,
                    isMaxLevel: ld.isMaxLevel
                };
            }
            let battleStats = null;
            try {
                const saved = localStorage.getItem('battleStats');
                if (saved) battleStats = JSON.parse(saved);
            } catch (e) { /* ignore */ }
            const unallocated = parseInt(localStorage.getItem('unallocatedStatPoints') || '0') || 0;
            context.tamagotchi = {
                lifetimePoints,
                currentPoints: context.points?.current_points || 0,
                level: levelInfo,
                battleStats, // { str, hp, mana }
                unallocatedStatPoints: unallocated
            };
        } catch (e) { /* tamagotchi info not critical */ }

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
        context.currentWorkout = gatherCurrentWorkoutContext();

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
            search_exercises: '🔍',
            open_app_action: '⚡',
            add_current_workout_exercise: '+',
            remove_current_workout_exercise: '-',
            replace_current_workout_exercise: '↔'
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
                        const validTypes = ['xp', 'workouts', 'volume', 'calories', 'steps', 'streak', 'sleep', 'water', 'milestone', 'quiz'];
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
                                        nudge_type: 'challenge_invite',
                                        // Store the challenge id so the nudge bubble can render a
                                        // tappable "Accept Challenge" button in the recipient's inbox.
                                        reference_id: challenge.id
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
                        if (typeof window.handlePostWeighInRewards === 'function') {
                            const weighIn = await db.weighIns.getTodaysWeighIn(user.id);
                            await window.handlePostWeighInRewards(weighIn, { source: 'ask-balance' });
                        }
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

                    case 'open_app_action': {
                        const target = action.target || action.shortcut || action.destination;
                        if (!target) throw new Error('Missing target');
                        const handled = typeof window.handleBalanceShortcutAction === 'function'
                            ? window.handleBalanceShortcutAction(target)
                            : false;
                        if (!handled) window._pendingBalanceShortcutAction = target;
                        addAiMessage(action.description || 'Opening that now.', 'bot');
                        successCount++;
                        break;
                    }

                    case 'remove_current_workout_exercise': {
                        const exerciseName = action.exercise_name || action.name;
                        if (!exerciseName) throw new Error('Missing exercise_name');
                        const context = gatherCurrentWorkoutContext();
                        const names = (context?.exercises || []).map(ex => ex.name);
                        const result = findBestFromNames(names, exerciseName);
                        const targetName = result.match || exerciseName;
                        const removed = await removeCurrentWorkoutExercise(targetName);
                        addAiMessage(`Removed **${removed}** from this workout.`, 'bot');
                        successCount++;
                        break;
                    }

                    case 'add_current_workout_exercise': {
                        const exerciseName = action.exercise_name || action.name;
                        if (!exerciseName) throw new Error('Missing exercise_name');
                        const added = await addCurrentWorkoutExercise(exerciseName);
                        addAiMessage(`Added **${added}** to this workout.`, 'bot');
                        successCount++;
                        break;
                    }

                    case 'replace_current_workout_exercise': {
                        const removeName = action.remove_exercise_name || action.old_exercise_name || action.exercise_name;
                        const addName = action.add_exercise_name || action.new_exercise_name || action.replacement_exercise_name;
                        if (!removeName || !addName) throw new Error('Missing exercise names');
                        const context = gatherCurrentWorkoutContext();
                        const names = (context?.exercises || []).map(ex => ex.name);
                        const result = findBestFromNames(names, removeName);
                        const targetName = result.match || removeName;
                        const removed = await removeCurrentWorkoutExercise(targetName);
                        const added = await addCurrentWorkoutExercise(addName);
                        addAiMessage(`Replaced **${removed}** with **${added}**.`, 'bot');
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
    async function sendMessage(rawText) {
        if (aiIsLoading) return;

        const input = document.getElementById('ai-assistant-input');
        const text = (typeof rawText === 'string' ? rawText : (input ? input.value : '')).trim();
        if (!text) return;

        if (input) input.value = '';
        const globalInput = document.getElementById('ask-balance-global-input');
        if (globalInput && globalInput.value.trim() === text) globalInput.value = '';
        aiIsLoading = true;
        setAskBalanceLoading(true);

        // Show user message
        addAiMessage(text, 'user');
        showTypingIndicator();

        // Add to history
        aiChatHistory.push({ role: 'user', text: text });

        try {
            if (await tryHandleInstantCommand(text)) {
                removeTypingIndicator();
                aiIsLoading = false;
                setAskBalanceLoading(false);
                return;
            }

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
        setAskBalanceLoading(false);
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

    function initializeAskBalanceControls() {
        document.querySelectorAll('[data-ask-action]').forEach(btn => {
            if (btn.dataset.askBound === 'true') return;
            btn.dataset.askBound = 'true';
            btn.addEventListener('click', () => {
                const target = btn.dataset.askAction;
                if (!target) return;
                openAskBalanceSheet('');
                const shortcut = ASK_BALANCE_SHORTCUTS.find(item => item.target === target) || { target, label: 'Opening that' };
                addAiMessage(shortcut.label + '.', 'bot');
                const handled = typeof window.handleBalanceShortcutAction === 'function'
                    ? window.handleBalanceShortcutAction(target)
                    : false;
                if (!handled) window._pendingBalanceShortcutAction = target;
                setTimeout(closeAskBalanceSheet, 450);
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initializeAskBalanceControls();
            initializeAskBalanceLongPress();
        }, { once: true });
    } else {
        initializeAskBalanceControls();
        initializeAskBalanceLongPress();
    }

    // Expose functions globally
    window.sendAiAssistantMessage = sendMessage;
    window.toggleAiAssistantExpand = toggleExpand;
    window._aiExecuteActions = executeActions;
    window._aiDeclineActions = declineActions;
    window._aiAddMessage = addAiMessage;
    window._aiRenderActions = renderActions;
    window.openAskBalanceSheet = openAskBalanceSheet;
    window.closeAskBalanceSheet = closeAskBalanceSheet;
    window.submitAskBalanceBar = submitAskBalanceBar;
    window.showAskBalanceCommandPalette = showAskBalanceCommandPalette;
    window.hideAskBalanceCommandPalette = hideAskBalanceCommandPalette;
    window.submitAskBalanceCommandPalette = submitAskBalanceCommandPalette;
    window.refreshAskBalanceTitleColor = refreshAskBalanceTitleColor;
    if (window._queuedAskBalanceText) {
        const queuedText = window._queuedAskBalanceText;
        window._queuedAskBalanceText = '';
        openAskBalanceSheet(queuedText, { sendNow: true });
    }
})();
