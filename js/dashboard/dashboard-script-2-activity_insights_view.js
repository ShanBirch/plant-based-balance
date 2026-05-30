// ===== ACTIVITY INSIGHTS VIEW =====

    function openInsightsView() {
        if (typeof hideAllAppViews === 'function') hideAllAppViews();
        const viewEl = document.getElementById('view-insights');
        if (viewEl) {
            viewEl.style.display = 'block';
            viewEl.scrollTop = 0;
            window.scrollTo(0, 0);
        }
        const nav = document.getElementById('bottom-nav');
        if (nav) nav.style.display = 'none';
        initInsightsView();
        if (typeof pushNavigationState === 'function') {
            pushNavigationState('view-insights', closeInsightsView);
        } else {
            history.pushState({ view: 'insights' }, '', '');
        }
    }

    function closeInsightsView() {
        const viewEl = document.getElementById('view-insights');
        if (viewEl) viewEl.style.display = 'none';
        const dashEl = document.getElementById('view-dashboard');
        if (dashEl) dashEl.style.display = 'block';
        const nav = document.getElementById('bottom-nav');
        if (nav) nav.style.display = '';
    }

    async function initInsightsView() {
        if (!window.currentUser) return;
        const userId = window.currentUser.id;

        const loadingEl = document.getElementById('insights-loading');
        const contentEl = document.getElementById('insights-main-content');
        if (loadingEl) loadingEl.style.display = 'block';
        if (contentEl) contentEl.style.display = 'none';

        const oneYearAgoDate = new Date(); oneYearAgoDate.setDate(oneYearAgoDate.getDate() - 365);
        const oneYearAgo = getLocalDateString(oneYearAgoDate);
        const sevenDaysAgoDate = new Date(); sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 7);
        const sevenDaysAgo = getLocalDateString(sevenDaysAgoDate);
        const todayStr = getLocalDateString();

        try {
            const [exerciseHistoryResult, weighInsResult, sleepResult, nutritionResult, wearableCaloriesResult, quizResult, moodResult, stepsResult] = await Promise.allSettled([
                supabaseClient
                    .from('workouts')
                    .select('workout_date, exercise_name, weight_kg, reps')
                    .eq('user_id', userId)
                    .eq('workout_type', 'history')
                    .order('workout_date', { ascending: true }),
                db.weighIns.getRecent(userId, 365),
                _loadWearableSleepForInsights(userId),
                // Nutrition (1 year for 3M/6M/1Y graph timeframes)
                db.nutrition.getRange(userId, oneYearAgo, todayStr),
                // Wearable calories burned (try all sources)
                _loadWearableCaloriesForInsights(userId, oneYearAgo),
                // Quiz results for estimated BMR
                db.quizResults.getLatest(userId),
                // Mood logs (last 7 days)
                (async () => {
                    const { data } = await supabaseClient
                        .from('mood_logs').select('*').eq('user_id', userId)
                        .gte('log_date', sevenDaysAgo).order('log_date', { ascending: true });
                    return data;
                })(),
                // Wearable steps (1 year for 3M/6M/1Y graph timeframes)
                _loadWearableStepsForInsights(userId, oneYearAgo),
            ]);

            const exerciseHistory = (exerciseHistoryResult.status === 'fulfilled' && !exerciseHistoryResult.value.error)
                ? exerciseHistoryResult.value.data || []
                : [];
            const weighIns = weighInsResult.status === 'fulfilled' ? (weighInsResult.value || []) : [];
            const sleepData = sleepResult.status === 'fulfilled' ? sleepResult.value : null;
            const nutritionDays = nutritionResult.status === 'fulfilled' ? (nutritionResult.value || []) : [];
            const wearableCalories = wearableCaloriesResult.status === 'fulfilled' ? (wearableCaloriesResult.value || []) : [];
            const quizData = quizResult.status === 'fulfilled' ? (quizResult.value || {}) : {};
            const moodLogs = moodResult.status === 'fulfilled' ? (moodResult.value || []) : [];
            const stepsData = stepsResult.status === 'fulfilled' ? (stepsResult.value || []) : [];

            const strengthGains = _computeStrengthGains(exerciseHistory);

            window._insightsStrengthGains = strengthGains;
            window._insightsQuizData = quizData;

            renderStrengthProgress(strengthGains);
            renderInsightsCorrelations(strengthGains, weighIns, sleepData);
            renderEnergyBalance(nutritionDays, wearableCalories, weighIns, quizData);
            renderMoodTrends(moodLogs);

            // Cache for timeframe toggles
            window._insightsWeighIns = weighIns;
            window._insightsNutrition = nutritionDays;
            window._insightsWearable = wearableCalories;
            window._insightsSleep = sleepData;
            window._insightsSteps = stepsData;
            window._insightsExerciseHistory = exerciseHistory;

            // Vitality Score (top of view)
            renderVitalityScore({
                weighIns,
                nutritionDays,
                sleepData,
                stepsData,
                exerciseHistory
            });

            // Overview charts (in display order)
            renderBodyWeightGraph(weighIns, 'insights-bodyweight-container');
            renderWeighInManager(weighIns);
            renderInsightsCaloriesBurned(document.getElementById('insights-calories-burned-container'), nutritionDays, weighIns, wearableCalories, 14);
            renderTotalIntakeGraph(nutritionDays, 'insights-daily-calories-container');
            renderInsightsSleep(sleepData, 14);
            renderVolumeGraph(userId);
            renderInsightsSteps(stepsData, 7);

            if (loadingEl) loadingEl.style.display = 'none';
            if (contentEl) contentEl.style.display = 'block';
        } catch (err) {
            console.warn('Insights load error:', err);
            if (loadingEl) loadingEl.style.display = 'none';
            if (contentEl) contentEl.style.display = 'block';
        }
    }

    // Fetch wearable calorie data from all connected sources
    async function _loadWearableCaloriesForInsights(userId, sinceDate) {
        const caloriesByDate = {};
        const sources = [
            { url: `/api/fitbit/data?user_id=${userId}`, extract: (d) => (d.activity || []).map(a => ({ date: a.date, calories: a.calories_burned })) },
            { url: `/api/oura/data?user_id=${userId}`, extract: (d) => (d.activity || []).map(a => ({ date: a.date, calories: a.total_calories || a.active_calories })) },
        ];
        for (const src of sources) {
            try {
                const resp = await fetch(src.url);
                if (resp.ok) {
                    const data = await resp.json();
                    if (data.connected) {
                        const entries = src.extract(data);
                        entries.forEach(e => {
                            if (e.date && e.calories && e.date >= sinceDate) {
                                caloriesByDate[e.date] = e.calories;
                            }
                        });
                        if (Object.keys(caloriesByDate).length > 0) break; // use first connected source
                    }
                }
            } catch (e) { /* source not connected */ }
        }
        return Object.entries(caloriesByDate).map(([date, calories]) => ({ date, calories_burned: calories }));
    }

    // Fetch wearable step data from all connected sources
    async function _loadWearableStepsForInsights(userId, sinceDate) {
        const sources = [
            { url: `/api/fitbit/data?user_id=${userId}`, extract: (d) => (d.activity || []).map(a => ({ date: a.date, steps: a.steps })) },
            { url: `/api/oura/data?user_id=${userId}`, extract: (d) => (d.activity || []).map(a => ({ date: a.date, steps: a.steps })) },
        ];
        for (const src of sources) {
            try {
                const resp = await fetch(src.url);
                if (!resp.ok) continue;
                const data = await resp.json();
                if (data.connected) {
                    const entries = src.extract(data)
                        .filter(e => e.date && e.steps != null && e.steps > 0 && e.date >= sinceDate)
                        .sort((a, b) => a.date.localeCompare(b.date));
                    if (entries.length > 0) return entries;
                }
            } catch (_) { /* source not connected */ }
        }
        return [];
    }

    // Render Energy Balance section with real BMR calculation
    function renderEnergyBalance(nutritionDays, wearableCalories, weighIns, quizData) {
        const container = document.getElementById('insights-energy-balance-container');
        if (!container) return;

        const trackedDays = nutritionDays.filter(d => d.total_calories && d.total_calories > 0);
        const sortedWeighIns = [...weighIns].sort((a, b) => (a.weigh_in_date || '').localeCompare(b.weigh_in_date || ''));

        // Need minimum data
        if (trackedDays.length < 3 || sortedWeighIns.length < 2) {
            const trackedLabel = trackedDays.length > 0 ? trackedDays.length + '/7 days tracked' : '0/7 days tracked';
            container.innerHTML = '<div style="text-align: center; padding: 16px; color: var(--text-muted); font-size: 0.85rem;">Keep tracking meals and weigh-ins — need at least 3 nutrition days & 2+ weigh-ins to estimate your energy balance. Right now you have ' + trackedLabel + '.</div>';
            return;
        }

        // Average daily calories consumed
        const avgCaloriesIn = Math.round(trackedDays.reduce((s, d) => s + parseFloat(d.total_calories), 0) / trackedDays.length);

        // Weight change over the tracked period
        const firstWeight = parseFloat(sortedWeighIns[0].weight_kg);
        const lastWeight = parseFloat(sortedWeighIns[sortedWeighIns.length - 1].weight_kg);
        const weightChangeTotalKg = lastWeight - firstWeight;
        const daysBetween = Math.max(1, Math.round((new Date(sortedWeighIns[sortedWeighIns.length - 1].weigh_in_date) - new Date(sortedWeighIns[0].weigh_in_date)) / 86400000));

        // 7700 cal per kg of body mass change (mix of fat + water + muscle)
        const dailyDeficitFromWeight = Math.round((weightChangeTotalKg * 7700) / daysBetween);
        // If losing weight, deficit is positive (burning more than eating)
        // actual_TDEE = calories_in + deficit_from_weight_loss
        const realTDEE = avgCaloriesIn - dailyDeficitFromWeight;

        // Wearable TDEE (average)
        let wearableTDEE = null;
        if (wearableCalories.length >= 3) {
            wearableTDEE = Math.round(wearableCalories.reduce((s, d) => s + d.calories_burned, 0) / wearableCalories.length);
        }

        // Formula BMR/TDEE from quiz
        const formulaBMR = quizData.bmr ? Math.round(quizData.bmr) : null;
        const formulaTDEE = quizData.tdee ? Math.round(quizData.tdee) : null;

        // Back-calculate real BMR (rough estimate using activity multiplier)
        const activityMultiplier = quizData.activity_level === 'active' ? 1.55 : quizData.activity_level === 'moderate' ? 1.375 : 1.2;
        const realBMR = Math.round(realTDEE / activityMultiplier);

        // Build the display
        let html = '';

        // Main comparison cards
        html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">';

        // Calories In card
        html += '<div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 14px; padding: 14px; color: white; text-align: center;">';
        html += '<div style="font-size: 0.68rem; opacity: 0.8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Avg Calories In</div>';
        html += '<div style="font-size: 1.5rem; font-weight: 800;">' + avgCaloriesIn.toLocaleString() + '</div>';
        html += '<div style="font-size: 0.7rem; opacity: 0.75;">tracked ' + trackedDays.length + '/7 days</div>';
        html += '</div>';

        // Real TDEE card
        html += '<div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 14px; padding: 14px; color: white; text-align: center;">';
        html += '<div style="font-size: 0.68rem; opacity: 0.8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Real TDEE</div>';
        html += '<div style="font-size: 1.5rem; font-weight: 800;">' + realTDEE.toLocaleString() + '</div>';
        html += '<div style="font-size: 0.7rem; opacity: 0.75;">from weight change</div>';
        html += '</div>';

        html += '</div>';

        // Deficit/surplus indicator
        const dailyBalance = avgCaloriesIn - realTDEE;
        const balanceColor = dailyBalance < -50 ? '#10b981' : dailyBalance > 50 ? '#ef4444' : '#8b5cf6';
        const balanceLabel = dailyBalance < -50 ? 'deficit' : dailyBalance > 50 ? 'surplus' : 'maintenance';

        html += '<div style="background: #f8fafc; border-radius: 12px; padding: 12px 16px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between;">';
        html += '<span style="font-size: 0.82rem; color: var(--text-muted); font-weight: 600;">Daily Balance</span>';
        html += '<span style="font-size: 0.95rem; font-weight: 800; color: ' + balanceColor + ';">' + (dailyBalance > 0 ? '+' : '') + dailyBalance + ' cal (' + balanceLabel + ')</span>';
        html += '</div>';

        // Comparison table
        html += '<div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600; margin-bottom: 8px;">How the numbers compare:</div>';
        html += '<div style="display: flex; flex-direction: column; gap: 6px;">';

        // BMR row
        if (formulaBMR) {
            html += _buildComparisonRow('BMR', formulaBMR + ' (formula)', realBMR + ' (from data)', realBMR - formulaBMR);
        }

        // TDEE row
        if (formulaTDEE) {
            html += _buildComparisonRow('TDEE', formulaTDEE + ' (formula)', realTDEE + ' (from data)', realTDEE - formulaTDEE);
        }

        // Wearable TDEE row
        if (wearableTDEE) {
            html += _buildComparisonRow('Watch TDEE', wearableTDEE + ' (wearable)', realTDEE + ' (from data)', realTDEE - wearableTDEE);
        }

        html += '</div>';

        // Weight change summary
        html += '<div style="margin-top: 14px; background: #f0fdf4; border-radius: 10px; padding: 10px 14px; font-size: 0.8rem; color: #166534;">';
        html += 'Weight ' + (weightChangeTotalKg < 0 ? 'down' : weightChangeTotalKg > 0 ? 'up' : 'stable') + ' <strong>' + Math.abs(weightChangeTotalKg).toFixed(1) + 'kg</strong> over ' + daysBetween + ' days';
        html += '</div>';

        container.innerHTML = html;
    }

    function _buildComparisonRow(label, estimated, actual, diff) {
        const diffColor = Math.abs(diff) < 50 ? '#10b981' : Math.abs(diff) < 150 ? '#f59e0b' : '#ef4444';
        const sign = diff > 0 ? '+' : '';
        return '<div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border-radius: 8px; padding: 8px 12px;">'
            + '<span style="font-size: 0.78rem; font-weight: 600; color: var(--text-muted); width: 70px;">' + label + '</span>'
            + '<span style="font-size: 0.75rem; color: var(--text-muted);">' + estimated + '</span>'
            + '<span style="font-size: 0.75rem; color: var(--text-main); font-weight: 600;">' + actual + '</span>'
            + '<span style="font-size: 0.72rem; font-weight: 700; color: ' + diffColor + '; min-width: 50px; text-align: right;">' + sign + diff + '</span>'
            + '</div>';
    }

    // Render Mood & Energy trends from mood_logs
    function renderMoodTrends(moodLogs) {
        const container = document.getElementById('insights-mood-container');
        if (!container) return;

        if (!moodLogs || moodLogs.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 16px; color: var(--text-muted); font-size: 0.85rem;">Start logging mood check-ins to see trends here.</div>';
            return;
        }

        // Group by date, average scores per day
        const byDate = {};
        moodLogs.forEach(log => {
            const d = log.log_date;
            if (!byDate[d]) byDate[d] = { mood: [], energy: [], stress: [] };
            if (log.mood_score) byDate[d].mood.push(log.mood_score);
            if (log.energy_score) byDate[d].energy.push(log.energy_score);
            if (log.stress_score) byDate[d].stress.push(log.stress_score);
        });

        const dates = Object.keys(byDate).sort();
        const avg = arr => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : null;

        const dayData = dates.map(d => ({
            date: d,
            dayLabel: new Date(d + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' }),
            mood: avg(byDate[d].mood),
            energy: avg(byDate[d].energy),
            stress: avg(byDate[d].stress)
        }));

        // Build simple bar chart
        let html = '';

        // Legend
        html += '<div style="display: flex; gap: 16px; margin-bottom: 12px; font-size: 0.72rem;">';
        html += '<span style="display: flex; align-items: center; gap: 4px;"><span style="width: 10px; height: 10px; border-radius: 3px; background: #ec4899;"></span> Mood</span>';
        html += '<span style="display: flex; align-items: center; gap: 4px;"><span style="width: 10px; height: 10px; border-radius: 3px; background: #f59e0b;"></span> Energy</span>';
        html += '<span style="display: flex; align-items: center; gap: 4px;"><span style="width: 10px; height: 10px; border-radius: 3px; background: #6366f1;"></span> Stress</span>';
        html += '</div>';

        // Chart
        html += '<div style="display: flex; gap: 6px; align-items: flex-end; height: 120px;">';

        dayData.forEach(day => {
            html += '<div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; height: 100%;">';
            // Bars container (bottom-aligned)
            html += '<div style="flex: 1; display: flex; align-items: flex-end; gap: 2px; width: 100%;">';

            const maxScore = 10;
            const barHeight = (val) => val ? Math.round((val / maxScore) * 90) : 0;

            html += '<div style="flex: 1; height: ' + barHeight(day.mood) + '%; background: #ec4899; border-radius: 3px 3px 0 0; min-height: ' + (day.mood ? '4px' : '0') + ';"></div>';
            html += '<div style="flex: 1; height: ' + barHeight(day.energy) + '%; background: #f59e0b; border-radius: 3px 3px 0 0; min-height: ' + (day.energy ? '4px' : '0') + ';"></div>';
            html += '<div style="flex: 1; height: ' + barHeight(day.stress) + '%; background: #6366f1; border-radius: 3px 3px 0 0; min-height: ' + (day.stress ? '4px' : '0') + ';"></div>';

            html += '</div>';
            // Day label
            html += '<div style="font-size: 0.65rem; color: var(--text-muted); font-weight: 600;">' + day.dayLabel + '</div>';
            html += '</div>';
        });

        html += '</div>';

        // Weekly averages
        const allMoods = moodLogs.filter(l => l.mood_score).map(l => l.mood_score);
        const allEnergy = moodLogs.filter(l => l.energy_score).map(l => l.energy_score);
        const allStress = moodLogs.filter(l => l.stress_score).map(l => l.stress_score);

        html += '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 14px;">';
        html += _buildMoodAvgCard('Mood', avg(allMoods), '#ec4899');
        html += _buildMoodAvgCard('Energy', avg(allEnergy), '#f59e0b');
        html += _buildMoodAvgCard('Stress', avg(allStress), '#6366f1');
        html += '</div>';

        container.innerHTML = html;
    }

    function _buildMoodAvgCard(label, value, color) {
        if (!value) return '<div></div>';
        return '<div style="text-align: center; background: #f8fafc; border-radius: 10px; padding: 10px 6px;">'
            + '<div style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">' + label + '</div>'
            + '<div style="font-size: 1.2rem; font-weight: 800; color: ' + color + ';">' + value + '<span style="font-size: 0.7rem; font-weight: 600; opacity: 0.6;">/10</span></div>'
            + '</div>';
    }

    /**
     * Compute strength gains per exercise.
     * For each exercise, find the best weight on the earliest date vs the best weight on the most recent date.
     * Returns array sorted by biggest gain: [{ name, firstWeight, lastWeight, gain, firstDate, lastDate, sessions }]
     */
    function _computeStrengthGains(exerciseHistory) {
        const byExercise = {};
        for (const row of exerciseHistory) {
            if (!row.exercise_name || !row.weight_kg || parseFloat(row.weight_kg) <= 0) continue;
            const name = row.exercise_name;
            if (!byExercise[name]) byExercise[name] = {};
            const date = row.workout_date;
            const weight = parseFloat(row.weight_kg);
            if (!byExercise[name][date] || weight > byExercise[name][date]) {
                byExercise[name][date] = weight;
            }
        }

        const results = [];
        for (const [name, dateMap] of Object.entries(byExercise)) {
            const dates = Object.keys(dateMap).sort();
            if (dates.length < 2) continue;
            const firstDate = dates[0];
            const lastDate = dates[dates.length - 1];
            const firstWeight = dateMap[firstDate];
            const lastWeight = dateMap[lastDate];
            const gain = lastWeight - firstWeight;
            results.push({ name, firstWeight, lastWeight, gain, firstDate, lastDate, sessions: dates.length });
        }

        // Sort by biggest gain descending
        results.sort((a, b) => b.gain - a.gain);
        return results;
    }

    // Try each connected wearable for recent sleep data (last 7 nights)
    async function _loadWearableSleepForInsights(userId) {
        const sources = [
            { name: 'Fitbit',  url: `/api/fitbit/data?user_id=${userId}`,  key: (d) => d.sleep },
            { name: 'WHOOP',   url: `/api/whoop/data?user_id=${userId}`,   key: (d) => d.sleep },
            { name: 'Oura',    url: `/api/oura/data?user_id=${userId}`,    key: (d) => d.sleep },
        ];
        for (const src of sources) {
            try {
                const res = await fetch(src.url);
                if (!res.ok) continue;
                const d = await res.json();
                const sleep = src.key(d);
                if (sleep && sleep.length > 0) return { source: src.name, records: sleep };
            } catch (_) { /* silent */ }
        }
        return null;
    }

    function renderStrengthProgress(strengthGains) {
        const container = document.getElementById('insights-strength-progress');
        const countEl = document.getElementById('insights-strength-count');
        if (!container) return;

        const preferLbs = localStorage.getItem('weightUnitPreference') === 'lbs';
        const gainers = strengthGains.filter(e => e.gain > 0);

        if (countEl) countEl.textContent = gainers.length > 0 ? `${gainers.length} exercises improved` : '';

        if (gainers.length === 0) {
            container.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.85rem;">Keep logging workouts with weights to see your strength gains here.</div>`;
            return;
        }

        // Show top 6 exercises with biggest gains
        const top = gainers.slice(0, 6);
        const maxGain = Math.max(...top.map(e => e.gain));

        let html = '';
        for (const ex of top) {
            const pct = Math.round((ex.gain / maxGain) * 100);
            const displayGain = preferLbs ? (ex.gain * 2.20462).toFixed(1) : ex.gain.toFixed(1);
            const displayFirst = preferLbs ? (ex.firstWeight * 2.20462).toFixed(1) : ex.firstWeight.toFixed(1);
            const displayLast = preferLbs ? (ex.lastWeight * 2.20462).toFixed(1) : ex.lastWeight.toFixed(1);
            const unit = preferLbs ? 'lbs' : 'kg';
            html += `
                <div style="margin-bottom: 14px;">
                    <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
                        <div style="font-size: 0.82rem; font-weight: 700; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 55%;">${ex.name}</div>
                        <div style="font-size: 0.78rem; font-weight: 800; color: #10b981;">+${displayGain} ${unit}</div>
                    </div>
                    <div style="width: 100%; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden;">
                        <div style="width: ${Math.max(pct, 8)}%; height: 100%; background: linear-gradient(90deg, #10b981, #34d399); border-radius: 4px; transition: width 0.4s ease;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 3px;">
                        <span style="font-size: 0.68rem; color: var(--text-muted);">${displayFirst} → ${displayLast} ${unit}</span>
                        <span style="font-size: 0.68rem; color: var(--text-muted);">${ex.sessions} sessions</span>
                    </div>
                </div>`;
        }
        container.innerHTML = html;
    }

    function renderInsightsCorrelations(strengthGains, weighIns, sleepData) {
        const container = document.getElementById('insights-correlations-container');
        if (!container) return;

        const rows = [];
        const preferLbs = localStorage.getItem('weightUnitPreference') === 'lbs';
        const unit = preferLbs ? 'lbs' : 'kg';

        // Top strength gain
        const topGainer = strengthGains.find(e => e.gain > 0);
        if (topGainer) {
            const displayGain = preferLbs ? (topGainer.gain * 2.20462).toFixed(1) : topGainer.gain.toFixed(1);
            rows.push({
                icon: '💪',
                label: 'Biggest Strength Gain',
                value: `+${displayGain} ${unit}`,
                sub: topGainer.name,
                subColor: '#10b981',
            });
        }

        // Total exercises with gains
        const gainCount = strengthGains.filter(e => e.gain > 0).length;
        if (gainCount > 0) {
            const totalGain = strengthGains.filter(e => e.gain > 0).reduce((s, e) => s + e.gain, 0);
            const displayTotal = preferLbs ? (totalGain * 2.20462).toFixed(1) : totalGain.toFixed(1);
            rows.push({
                icon: '📈',
                label: 'Total Strength Added',
                value: `+${displayTotal} ${unit}`,
                sub: `across ${gainCount} exercises`,
                subColor: '#10b981',
            });
        }

        // Weight trend
        if (weighIns && weighIns.length >= 2) {
            const latest = weighIns[0];
            const oldest = weighIns[weighIns.length - 1];
            const diff = latest.weight_kg - oldest.weight_kg;
            const displayDiff = preferLbs
                ? (diff * 2.20462).toFixed(1) + ' lbs'
                : diff.toFixed(1) + ' kg';
            const sign = diff > 0 ? '+' : '';
            const weightColor = diff < 0 ? '#10b981' : diff > 0 ? '#ef4444' : '#8b5cf6';
            rows.push({
                icon: '⚖️',
                label: 'Weight Trend',
                value: sign + displayDiff,
                sub: `over ${weighIns.length} check-ins`,
                subColor: weightColor,
            });
        }

        // Sleep correlation (if wearable data)
        if (sleepData && sleepData.records && sleepData.records.length > 0) {
            const avgMins = sleepData.records.reduce((s, r) => {
                return s + (r.duration_minutes || r.total_sleep_minutes || 0);
            }, 0) / sleepData.records.length;
            const hrs = Math.floor(avgMins / 60);
            const mins = Math.round(avgMins % 60);
            rows.push({
                icon: '😴',
                label: 'Avg Sleep',
                value: `${hrs}h ${mins}m`,
                sub: `via ${sleepData.source} · ${sleepData.records.length} nights`,
                subColor: '#6366f1',
            });
        }

        if (rows.length === 0) {
            container.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.85rem;">Log workouts with weights to start seeing your strength correlations here.</div>`;
            return;
        }

        container.innerHTML = rows.map(r => `
            <div style="display: flex; align-items: center; gap: 14px; padding: 12px 0; border-bottom: 1px solid #f1f5f9;">
                <div style="width: 40px; height: 40px; background: #f8fafc; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;">${r.icon}</div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">${r.label}</div>
                    <div style="font-size: 1.05rem; font-weight: 800; color: var(--text-main);">${r.value}</div>
                </div>
                <div style="font-size: 0.75rem; font-weight: 700; color: ${r.subColor}; text-align: right; max-width: 120px;">${r.sub}</div>
            </div>
        `).join('');
        // Remove last border
        container.querySelector('div:last-child') && (container.querySelector('div:last-child').style.borderBottom = 'none');
    }

    function renderInsightsSleep(sleepData, days = 14) {
        const container = document.getElementById('insights-sleep-container');
        const connectSection = document.getElementById('insights-connect-section');
        if (!container) return;

        if (!sleepData || !sleepData.records || sleepData.records.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 16px 0;">
                    <div style="font-size: 2rem; margin-bottom: 8px; opacity: 0.4;">😴</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">No sleep data yet. Connect a fitness tracker below to start seeing sleep trends and how they affect your workouts.</div>
                </div>`;
            if (connectSection) connectSection.style.display = 'block';
            return;
        }
        if (connectSection) connectSection.style.display = 'none';

        // 30-day average
        const last30 = sleepData.records.slice(0, 30);
        const avgMins30 = last30.reduce((sum, r) => sum + (r.duration_minutes || r.total_sleep_minutes || 0), 0) / (last30.length || 1);
        const avgHrs30 = Math.floor(avgMins30 / 60);
        const avgMinsRem30 = Math.round(avgMins30 % 60);

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffStr = cutoff.toISOString().split('T')[0];
        const rawRecords = sleepData.records.filter(r => r.date >= cutoffStr).sort((a, b) => a.date.localeCompare(b.date));

        const chartData = rawRecords.map(r => {
            const totalMins = r.duration_minutes || r.total_sleep_minutes || 0;
            let dayLabel = '';
            if (r.date) {
                const d = new Date(r.date + 'T12:00:00');
                d.setDate(d.getDate() - 1);
                dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
            }
            return {
                dayLabel,
                totalHrs: totalMins / 60,
                deepHrs: (r.deep_minutes || 0) / 60,
                remHrs: (r.rem_minutes || 0) / 60,
            };
        });

        const hasStages = chartData.some(d => d.deepHrs > 0 || d.remHrs > 0);

        const svgW = 400, svgH = 270;
        const pad = { top: 28, right: 20, bottom: 36, left: 40 };
        const cW = svgW - pad.left - pad.right;
        const cH = svgH - pad.top - pad.bottom;
        const n = chartData.length;
        const xStep = n > 1 ? cW / (n - 1) : 0;

        const maxTotal = Math.max(...chartData.map(d => d.totalHrs), 6);
        const yMax = Math.ceil(maxTotal / 2) * 2;

        const toX = i => pad.left + xStep * i;
        const toY = hrs => pad.top + cH - (hrs / yMax) * cH;
        const linePath = vals => vals.map((v, i) => (i === 0 ? 'M' : 'L') + ' ' + toX(i) + ',' + toY(v)).join(' ');
        const areaPath = vals => {
            const bot = pad.top + cH;
            let d = 'M ' + toX(0) + ',' + bot + ' L ' + toX(0) + ',' + toY(vals[0]);
            for (let i = 1; i < vals.length; i++) d += ' L ' + toX(i) + ',' + toY(vals[i]);
            return d + ' L ' + toX(vals.length - 1) + ',' + bot + ' Z';
        };

        const totalVals = chartData.map(d => d.totalHrs);
        const deepVals  = chartData.map(d => d.deepHrs);
        const remVals   = chartData.map(d => d.remHrs);

        let svg = '<svg viewBox="0 0 ' + svgW + ' ' + svgH + '" style="width: 100%; display: block; overflow: visible;">';
        svg += '<defs><linearGradient id="insSlpGrad" x1="0" y1="0" x2="0" y2="1">'
            + '<stop offset="0%" stop-color="#6366f1" stop-opacity="0.22"/>'
            + '<stop offset="100%" stop-color="#6366f1" stop-opacity="0.02"/>'
            + '</linearGradient></defs>';

        for (let h = 0; h <= yMax; h += 2) {
            const y = toY(h);
            svg += '<line x1="' + pad.left + '" y1="' + y + '" x2="' + (svgW - pad.right) + '" y2="' + y + '" stroke="#f1f5f9" stroke-width="1"/>';
            svg += '<text x="' + (pad.left - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="10" fill="#94a3b8">' + h + 'h</text>';
        }
        if (yMax >= 8) {
            const y8 = toY(8);
            svg += '<line x1="' + pad.left + '" y1="' + y8 + '" x2="' + (svgW - pad.right) + '" y2="' + y8 + '" stroke="#10b981" stroke-width="1.2" stroke-dasharray="5,4" opacity="0.55"/>';
            svg += '<text x="' + (svgW - pad.right + 3) + '" y="' + (y8 + 4) + '" text-anchor="start" font-size="9" fill="#10b981" opacity="0.75">goal</text>';
        }

        svg += '<path d="' + areaPath(totalVals) + '" fill="url(#insSlpGrad)"/>';
        svg += '<path d="' + linePath(totalVals) + '" fill="none" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
        if (hasStages) {
            svg += '<path d="' + linePath(deepVals) + '" fill="none" stroke="#312e81" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>';
            svg += '<path d="' + linePath(remVals)  + '" fill="none" stroke="#06b6d4" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>';
        }

        const sleepTargetTicks = n <= 7 ? n : 7;
        const sleepTickIndices = new Set(
            sleepTargetTicks <= 1
                ? [0]
                : Array.from({length: sleepTargetTicks}, (_, k) => Math.round(k * (n - 1) / (sleepTargetTicks - 1)))
        );

        chartData.forEach((d, i) => {
            const x = toX(i), yT = toY(d.totalHrs), isLast = i === n - 1;
            svg += '<circle cx="' + x + '" cy="' + yT + '" r="' + (isLast ? 5 : 3.5) + '" fill="' + (isLast ? '#6366f1' : 'white') + '" stroke="#6366f1" stroke-width="2"/>';
            if (sleepTickIndices.has(i))
                svg += '<text x="' + x + '" y="' + (yT - 9) + '" text-anchor="middle" font-size="9.5" font-weight="700" fill="#6366f1">' + d.totalHrs.toFixed(1) + 'h</text>';
            if (hasStages) {
                svg += '<circle cx="' + x + '" cy="' + toY(d.deepHrs) + '" r="2.5" fill="#312e81" opacity="0.85"/>';
                svg += '<circle cx="' + x + '" cy="' + toY(d.remHrs)  + '" r="2.5" fill="#06b6d4" opacity="0.85"/>';
            }
        });

        chartData.forEach((d, i) => {
            if (!sleepTickIndices.has(i)) return;
            const anchor = (i === 0 && n > 1) ? 'start' : (i === n - 1 && n > 1) ? 'end' : 'middle';
            svg += '<text x="' + toX(i) + '" y="' + (svgH - 6) + '" text-anchor="' + anchor + '" font-size="10" fill="#94a3b8">' + d.dayLabel + '</text>';
        });
        svg += '</svg>';

        let legend = '<div style="display: flex; gap: 14px; font-size: 0.68rem; color: var(--text-muted); font-weight: 600; margin-bottom: 12px; flex-wrap: wrap;">'
            + '<div style="display: flex; align-items: center; gap: 5px;"><div style="width: 14px; height: 3px; border-radius: 2px; background: #6366f1;"></div> Total</div>';
        if (hasStages) {
            legend += '<div style="display: flex; align-items: center; gap: 5px;"><div style="width: 14px; height: 3px; border-radius: 2px; background: #312e81;"></div> Deep</div>'
                + '<div style="display: flex; align-items: center; gap: 5px;"><div style="width: 14px; height: 3px; border-radius: 2px; background: #06b6d4;"></div> REM</div>';
        }
        legend += '<div style="display: flex; align-items: center; gap: 5px;"><div style="width: 14px; height: 2px; border-radius: 1px; background: #10b981; opacity: 0.6;"></div> 8h goal</div></div>';

        const fmt = hrs => Math.floor(hrs) + 'h ' + Math.round((hrs % 1) * 60) + 'm';
        const avgTotal = totalVals.reduce((s, v) => s + v, 0) / totalVals.length;
        let statsGrid;
        if (hasStages) {
            const avgDeep = deepVals.reduce((s, v) => s + v, 0) / deepVals.length;
            const avgRem  = remVals.reduce((s, v) => s + v, 0) / remVals.length;
            statsGrid = '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 16px;">'
                + '<div style="background: #eef2ff; padding: 12px 8px; border-radius: 12px; text-align: center;"><div style="font-size: 1.05rem; font-weight: 800; color: #6366f1;">' + fmt(avgTotal) + '</div><div style="font-size: 0.62rem; color: var(--text-muted); margin-top: 3px; font-weight: 700; letter-spacing: 0.5px;">AVG TOTAL</div></div>'
                + '<div style="background: #ede9fe; padding: 12px 8px; border-radius: 12px; text-align: center;"><div style="font-size: 1.05rem; font-weight: 800; color: #312e81;">' + fmt(avgDeep) + '</div><div style="font-size: 0.62rem; color: var(--text-muted); margin-top: 3px; font-weight: 700; letter-spacing: 0.5px;">AVG DEEP</div></div>'
                + '<div style="background: #e0f7fa; padding: 12px 8px; border-radius: 12px; text-align: center;"><div style="font-size: 1.05rem; font-weight: 800; color: #0891b2;">' + fmt(avgRem) + '</div><div style="font-size: 0.62rem; color: var(--text-muted); margin-top: 3px; font-weight: 700; letter-spacing: 0.5px;">AVG REM</div></div>'
                + '</div>';
        } else {
            statsGrid = '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 16px;">'
                + '<div style="background: #eef2ff; padding: 12px 8px; border-radius: 12px; text-align: center;"><div style="font-size: 1.05rem; font-weight: 800; color: #6366f1;">' + fmt(avgTotal) + '</div><div style="font-size: 0.62rem; color: var(--text-muted); margin-top: 3px; font-weight: 700; letter-spacing: 0.5px;">AVG (THIS PERIOD)</div></div>'
                + '<div style="background: #eef2ff; padding: 12px 8px; border-radius: 12px; text-align: center;"><div style="font-size: 1.05rem; font-weight: 800; color: #6366f1;">' + avgHrs30 + 'h ' + avgMinsRem30 + 'm</div><div style="font-size: 0.62rem; color: var(--text-muted); margin-top: 3px; font-weight: 700; letter-spacing: 0.5px;">30-DAY AVG</div></div>'
                + '</div>';
        }

        const header = '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">'
            + '<div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">Last ' + rawRecords.length + ' nights via ' + sleepData.source + '</div>'
            + (last30.length > 0 ? '<div style="font-size: 0.65rem; color: var(--text-main); font-weight: 700; background: #f1f5f9; padding: 3px 8px; border-radius: 12px;">30-Day Avg: ' + avgHrs30 + 'h ' + avgMinsRem30 + 'm</div>' : '')
            + '</div>';

        container.innerHTML = header + legend + svg + statsGrid;
    }

    // --- Volume graph helpers ---

    function _getWeekStart(dateStr) {
        const d = new Date(dateStr + 'T12:00:00');
        const day = d.getDay(); // 0 = Sun
        const diff = day === 0 ? -6 : 1 - day; // shift to Monday
        d.setDate(d.getDate() + diff);
        return d.toISOString().split('T')[0];
    }

    function _parseRepsVal(repsStr) {
        if (!repsStr) return 0;
        const m = String(repsStr).match(/\d+/);
        return m ? parseInt(m[0]) : 0;
    }

    function _fmtVolume(kg, preferLbs) {
        const val = preferLbs ? kg * 2.20462 : kg;
        const unit = preferLbs ? 'lbs' : 'kg';
        if (val >= 1000) return (val / 1000).toFixed(1) + 'k ' + unit;
        return Math.round(val) + ' ' + unit;
    }

    const INSIGHTS_VOLUME_AREAS = [
        { key: 'all', label: 'All', color: '#3b82f6', soft: '#eff6ff' },
        { key: 'chest', label: 'Chest', color: '#ef4444', soft: '#fef2f2' },
        { key: 'back', label: 'Back', color: '#0ea5e9', soft: '#f0f9ff' },
        { key: 'legs', label: 'Legs', color: '#10b981', soft: '#f0fdf4' },
        { key: 'shoulders', label: 'Shoulders', color: '#f59e0b', soft: '#fffbeb' },
        { key: 'core', label: 'Core', color: '#8b5cf6', soft: '#f5f3ff' }
    ];

    const INSIGHTS_VOLUME_TIMEFRAMES = [
        { key: '1m', label: '1M', weeks: 4, detail: 'Last 1 month', avgLabel: '4W Avg' },
        { key: '3m', label: '3M', weeks: 12, detail: 'Last 3 months', avgLabel: '12W Avg' },
        { key: '6m', label: '6M', weeks: 26, detail: 'Last 6 months', avgLabel: '26W Avg' }
    ];

    function _getInsightsVolumeArea(key) {
        return INSIGHTS_VOLUME_AREAS.find(a => a.key === key) || INSIGHTS_VOLUME_AREAS[0];
    }

    function _getInsightsVolumeTimeframe(key) {
        return INSIGHTS_VOLUME_TIMEFRAMES.find(t => t.key === key) || INSIGHTS_VOLUME_TIMEFRAMES[1];
    }

    function _normaliseExerciseLookupName(name) {
        return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    }

    function _normaliseVolumeArea(rawGroup) {
        const group = _normaliseExerciseLookupName(rawGroup).replace(/[_-]/g, ' ');
        if (!group) return null;
        if (group.includes('chest') || group.includes('pec')) return 'chest';
        if (group.includes('back') || group.includes('lat') || group.includes('pull')) return 'back';
        if (group.includes('shoulder') || group.includes('delt')) return 'shoulders';
        if (group.includes('core') || group.includes('ab') || group.includes('oblique')) return 'core';
        if (group.includes('leg') || group.includes('glute') || group.includes('quad') || group.includes('hamstring') || group.includes('calf') || group.includes('lower')) return 'legs';
        return 'other';
    }

    function _classifyExerciseVolumeArea(exerciseName, customMuscleMap) {
        const name = _normaliseExerciseLookupName(exerciseName);
        const customArea = _normaliseVolumeArea(customMuscleMap && customMuscleMap[name]);
        if (customArea && customArea !== 'other') return customArea;
        if (!name) return customArea || 'other';

        if (/\b(chest|pec|push[- ]?up|press[- ]?up)\b/.test(name)) return 'chest';
        if (/\b(bench press|floor press|incline press|decline press|chest press|chest fly|cable fly|dumbbell fly|db fly)\b/.test(name) && !/\b(reverse|rear)\b/.test(name)) return 'chest';
        if (/\b(back|lat|row|pulldown|pull[- ]?down|pull[- ]?up|pullup|chin[- ]?up|chinup|renegade row)\b/.test(name)) return 'back';
        if (/\b(shoulder|delt|lateral raise|front raise|rear delt|overhead press|arnold press|military press|upright row|face pull|reverse fly)\b/.test(name)) return 'shoulders';
        if (/\b(ab|abs|core|crunch|plank|oblique|sit[- ]?up|russian twist|dead bug|hollow hold|bird dog|mountain climber|leg raise|knee raise|pallof)\b/.test(name)) return 'core';
        if (/\b(squat|lunge|leg|quad|hamstring|calf|deadlift|rdl|romanian deadlift|hip thrust|glute|kickback|step[- ]?up|split squat|leg press)\b/.test(name)) return 'legs';
        return customArea || 'other';
    }

    function _addDaysToDateStr(dateStr, days) {
        const d = new Date(dateStr + 'T12:00:00');
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
    }

    function _buildContinuousWeekRange(firstWeek, lastWeek) {
        const weeks = [];
        const d = new Date(firstWeek + 'T12:00:00');
        const end = new Date(lastWeek + 'T12:00:00');
        while (d <= end) {
            weeks.push(d.toISOString().split('T')[0]);
            d.setDate(d.getDate() + 7);
        }
        return weeks;
    }

    function _getSetVolumeKg(row) {
        if (!row || !row.weight_kg || parseFloat(row.weight_kg) <= 0) return 0;
        const reps = Math.max(_parseRepsVal(row.reps), 1);
        return parseFloat(row.weight_kg) * reps;
    }

    function _sumVolumeRows(rows, selectedArea, customMuscleMap, startDate, endDate) {
        let total = 0;
        for (const row of rows || []) {
            if (!row.workout_date || row.workout_date < startDate || row.workout_date > endDate) continue;
            const area = _classifyExerciseVolumeArea(row.exercise_name, customMuscleMap);
            if (selectedArea !== 'all' && area !== selectedArea) continue;
            total += _getSetVolumeKg(row);
        }
        return total;
    }

    function _buildVolumeAggregation(rows, customMuscleMap) {
        const byAreaWeek = { all: {}, chest: {}, back: {}, legs: {}, shoulders: {}, core: {}, other: {} };
        for (const row of rows || []) {
            const vol = _getSetVolumeKg(row);
            if (!vol || !row.workout_date) continue;
            const weekStart = _getWeekStart(row.workout_date);
            const area = _classifyExerciseVolumeArea(row.exercise_name, customMuscleMap);
            byAreaWeek.all[weekStart] = (byAreaWeek.all[weekStart] || 0) + vol;
            byAreaWeek[area] = byAreaWeek[area] || {};
            byAreaWeek[area][weekStart] = (byAreaWeek[area][weekStart] || 0) + vol;
        }
        return byAreaWeek;
    }

    function _renderVolumeAreaChips(selectedArea) {
        return '<div style="display:flex;gap:7px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding:2px 0 12px;margin-bottom:4px;">'
            + INSIGHTS_VOLUME_AREAS.map(area => {
                const active = area.key === selectedArea;
                return '<button type="button" onclick="setInsightsVolumeArea(\'' + area.key + '\')"'
                    + ' style="border:1px solid ' + (active ? area.color : '#e2e8f0') + ';background:' + (active ? area.color : 'white') + ';color:' + (active ? 'white' : '#64748b') + ';border-radius:999px;padding:7px 12px;font-size:0.72rem;font-weight:800;white-space:nowrap;box-shadow:' + (active ? '0 6px 14px rgba(15,23,42,0.12)' : 'none') + ';">'
                    + area.label + '</button>';
            }).join('')
            + '</div>';
    }

    function _renderVolumeTimeframeNav(selectedTimeframe) {
        return '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;background:#f1f5f9;border-radius:12px;padding:4px;margin-bottom:10px;">'
            + INSIGHTS_VOLUME_TIMEFRAMES.map(tf => {
                const active = tf.key === selectedTimeframe;
                return '<button type="button" onclick="setInsightsVolumeTimeframe(\'' + tf.key + '\')"'
                    + ' style="border:0;background:' + (active ? 'white' : 'transparent') + ';color:' + (active ? '#0f172a' : '#64748b') + ';border-radius:9px;padding:8px 6px;font-size:0.72rem;font-weight:900;box-shadow:' + (active ? '0 4px 10px rgba(15,23,42,0.08)' : 'none') + ';">'
                    + tf.label + '</button>';
            }).join('')
            + '</div>';
    }

    function _renderVolumeControls(selectedArea, selectedTimeframe) {
        return _renderVolumeTimeframeNav(selectedTimeframe) + _renderVolumeAreaChips(selectedArea);
    }

    function _renderVolumeProgressVerdict(selectedArea, byAreaWeek, displayWeeks, rows, customMuscleMap, preferLbs) {
        const area = _getInsightsVolumeArea(selectedArea);
        const currentWeekStart = _getWeekStart(new Date().toISOString().split('T')[0]);
        const completedWeeks = displayWeeks.filter(w => w < currentWeekStart);
        const selectedByWeek = byAreaWeek[selectedArea] || {};
        const lastCompleted = completedWeeks[completedWeeks.length - 1];
        const priorWeeks = completedWeeks.slice(Math.max(0, completedWeeks.length - 5), Math.max(0, completedWeeks.length - 1));
        const priorVals = priorWeeks.map(w => selectedByWeek[w] || 0);
        const priorNonZero = priorVals.filter(v => v > 0);
        const lastVol = lastCompleted ? (selectedByWeek[lastCompleted] || 0) : 0;
        const todayStr = new Date().toISOString().split('T')[0];
        const currentWeekSoFar = _sumVolumeRows(rows, selectedArea, customMuscleMap, currentWeekStart, todayStr);

        let title = 'Keep logging';
        let body = selectedArea === 'all'
            ? 'A few more completed weeks will make your strength trend clearer.'
            : area.label + ' needs a few more logged weeks before Balance calls a trend.';
        let color = '#64748b';
        let soft = '#f8fafc';

        if (lastCompleted && priorWeeks.length >= 2) {
            const priorAvg = priorVals.reduce((s, v) => s + v, 0) / priorVals.length;
            if (priorAvg <= 0 && lastVol > 0) {
                title = 'Back in the mix';
                body = area.label + ' logged ' + _fmtVolume(lastVol, preferLbs) + ' last completed week after a quiet run.';
                color = '#10b981';
                soft = '#f0fdf4';
            } else if (priorAvg <= 0 && lastVol <= 0 && priorNonZero.length === 0) {
                title = 'No recent signal yet';
                body = selectedArea === 'all'
                    ? 'No completed-week lifting volume in this window yet.'
                    : 'No recent completed-week ' + area.label.toLowerCase() + ' volume yet.';
            } else {
                const pct = priorAvg > 0 ? ((lastVol - priorAvg) / priorAvg) * 100 : 0;
                const pctText = Math.abs(Math.round(pct)) + '%';
                if (pct >= 60) {
                    title = 'Big jump';
                    body = area.label + ' was ' + pctText + ' above your 4-week average. Good work, just watch recovery.';
                    color = '#f97316';
                    soft = '#fff7ed';
                } else if (pct >= 10) {
                    title = 'Progressing';
                    body = area.label + ' was ' + pctText + ' above your 4-week average last completed week.';
                    color = '#10b981';
                    soft = '#f0fdf4';
                } else if (pct <= -20) {
                    title = 'Dropping';
                    body = area.label + ' was ' + pctText + ' below your 4-week average last completed week.';
                    color = '#f59e0b';
                    soft = '#fffbeb';
                } else {
                    title = 'Steady';
                    body = area.label + ' is sitting close to your recent average.';
                    color = '#3b82f6';
                    soft = '#eff6ff';
                }
            }
        }

        if (currentWeekSoFar > 0) {
            body += ' This week so far: ' + _fmtVolume(currentWeekSoFar, preferLbs) + '.';
        }

        return '<div style="display:flex;gap:10px;align-items:flex-start;background:' + soft + ';border:1px solid rgba(15,23,42,0.06);border-radius:14px;padding:11px 12px;margin-bottom:12px;">'
            + '<div style="width:9px;height:9px;border-radius:50%;background:' + color + ';margin-top:5px;flex-shrink:0;"></div>'
            + '<div><div style="font-size:0.78rem;font-weight:900;color:' + color + ';margin-bottom:2px;">' + title + '</div>'
            + '<div style="font-size:0.74rem;color:#475569;line-height:1.35;">' + body + '</div></div>'
            + '</div>';
    }

    function _renderVolumeSplit(byAreaWeek, splitWeek, preferLbs) {
        const areas = INSIGHTS_VOLUME_AREAS.filter(a => a.key !== 'all')
            .concat([{ key: 'other', label: 'Other', color: '#64748b', soft: '#f8fafc' }]);
        const total = byAreaWeek.all[splitWeek] || 0;
        if (total <= 0) return '';

        const items = areas
            .map(area => Object.assign({}, area, { volume: (byAreaWeek[area.key] && byAreaWeek[area.key][splitWeek]) || 0 }))
            .filter(area => area.volume > 0 || area.key !== 'other');
        const maxVol = Math.max(...items.map(area => area.volume), 1);
        const labelDate = new Date(splitWeek + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        return '<div style="margin-top:14px;padding:12px;border-radius:14px;background:#f8fafc;border:1px solid #eef2f7;">'
            + '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px;">'
            + '<div style="font-size:0.72rem;font-weight:900;color:#334155;text-transform:uppercase;letter-spacing:0.6px;">Body-part split</div>'
            + '<div style="font-size:0.68rem;color:#64748b;font-weight:700;">Week of ' + labelDate + '</div>'
            + '</div>'
            + items.map(area => {
                const width = area.volume > 0 ? Math.max(4, Math.round((area.volume / maxVol) * 100)) : 0;
                const share = Math.round((area.volume / total) * 100);
                return '<div style="display:grid;grid-template-columns:76px 1fr 64px;gap:8px;align-items:center;margin:7px 0;">'
                    + '<div style="font-size:0.72rem;color:#475569;font-weight:800;white-space:nowrap;">' + area.label + '</div>'
                    + '<div style="height:8px;background:#e2e8f0;border-radius:999px;overflow:hidden;">'
                    + '<div style="height:100%;width:' + width + '%;background:' + area.color + ';border-radius:999px;"></div>'
                    + '</div>'
                    + '<div style="font-size:0.68rem;color:#64748b;font-weight:800;text-align:right;">' + (area.volume > 0 ? share + '%' : '-') + '</div>'
                    + '</div>';
            }).join('')
            + '</div>';
    }

    async function renderVolumeGraph(userId) {
        const container = document.getElementById('insights-volume-container');
        const headlineEl = document.getElementById('insights-volume-headline');
        const sublineEl  = document.getElementById('insights-volume-subline');
        if (!container) return;

        const preferLbs = localStorage.getItem('weightUnitPreference') === 'lbs';

        // Own query: newest-first, last 6 months, avoid shared-query ordering/limit issues
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const sinceDate = sixMonthsAgo.toISOString().split('T')[0];

        const { data: rows } = await supabaseClient
            .from('workouts')
            .select('workout_date, exercise_name, set_number, weight_kg, reps')
            .eq('user_id', userId)
            .eq('workout_type', 'history')
            .gte('workout_date', sinceDate)
            .order('workout_date', { ascending: false })
            .limit(5000);

        if (!rows || rows.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 16px; color: var(--text-muted); font-size: 0.85rem;">Log workouts with weights to see your weekly volume trend here.</div>';
            return;
        }

        // Deduplicate: saveWorkoutWithRetry can insert the same set multiple times on
        // network timeout. Keying by date+exercise+set_number keeps only the first copy.
        const seen = new Set();
        const deduped = [];
        for (const row of rows) {
            const key = `${row.workout_date}|${row.exercise_name}|${row.set_number}`;
            if (!seen.has(key)) { seen.add(key); deduped.push(row); }
        }

        // Aggregate volume by week
        // reps fallback to 1 so sets logged with weight but no reps still count
        const byWeek = {};
        for (const row of deduped) {
            if (!row.workout_date || !row.weight_kg || parseFloat(row.weight_kg) <= 0) continue;
            const reps = Math.max(_parseRepsVal(row.reps), 1);
            const vol = parseFloat(row.weight_kg) * reps;
            const weekStart = _getWeekStart(row.workout_date);
            byWeek[weekStart] = (byWeek[weekStart] || 0) + vol;
        }

        const weeks = Object.keys(byWeek).sort();
        if (weeks.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 16px; color: var(--text-muted); font-size: 0.85rem;">Log workouts with weights to see your weekly volume trend here.</div>';
            return;
        }

        // Show last 12 weeks
        const displayWeeks = weeks.slice(-12);
        const volumeKg = displayWeeks.map(w => byWeek[w]);
        const n = displayWeeks.length;

        // Headline: this week's volume
        const latestVol = volumeKg[n - 1];
        const prevVol   = n >= 2 ? volumeKg[n - 2] : null;
        if (headlineEl) headlineEl.textContent = _fmtVolume(latestVol, preferLbs);
        if (sublineEl) {
            if (prevVol !== null) {
                const diff = latestVol - prevVol;
                const diffFmt = (diff >= 0 ? '+' : '') + _fmtVolume(Math.abs(diff), preferLbs);
                const diffColor = diff >= 0 ? '#3b82f6' : '#f59e0b';
                sublineEl.innerHTML = 'This week &nbsp;<span style="font-weight:700;color:' + diffColor + ';">' + diffFmt + ' vs last week</span>';
            } else {
                sublineEl.textContent = 'This week';
            }
        }

        // Build week labels ("Mar 3")
        const labels = displayWeeks.map(w => {
            const d = new Date(w + 'T12:00:00');
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });

        // SVG chart
        const svgW = 400, svgH = 210;
        const pad = { top: 26, right: 16, bottom: 36, left: 46 };
        const cW = svgW - pad.left - pad.right;
        const cH = svgH - pad.top - pad.bottom;
        const xStep = n > 1 ? cW / (n - 1) : 0;

        const maxVol = Math.max(...volumeKg);
        const yMax = Math.ceil(maxVol / 1000) * 1000 || 1000;

        const toX = i => pad.left + xStep * i;
        const toY = v => pad.top + cH - (v / yMax) * cH;

        const linePath = volumeKg.map((v, i) => (i === 0 ? 'M' : 'L') + ' ' + toX(i).toFixed(1) + ',' + toY(v).toFixed(1)).join(' ');
        const areaPath = (() => {
            const bot = pad.top + cH;
            let d = 'M ' + toX(0).toFixed(1) + ',' + bot + ' L ' + toX(0).toFixed(1) + ',' + toY(volumeKg[0]).toFixed(1);
            for (let i = 1; i < n; i++) d += ' L ' + toX(i).toFixed(1) + ',' + toY(volumeKg[i]).toFixed(1);
            return d + ' L ' + toX(n - 1).toFixed(1) + ',' + bot + ' Z';
        })();

        let svg = '<svg viewBox="0 0 ' + svgW + ' ' + svgH + '" style="width:100%;display:block;overflow:visible;">';

        // Gradient
        svg += '<defs><linearGradient id="insVolGrad" x1="0" y1="0" x2="0" y2="1">'
            + '<stop offset="0%" stop-color="#3b82f6" stop-opacity="0.18"/>'
            + '<stop offset="100%" stop-color="#3b82f6" stop-opacity="0.02"/>'
            + '</linearGradient></defs>';

        // Y-axis gridlines (4 levels)
        for (let i = 0; i <= 4; i++) {
            const v = (yMax / 4) * i;
            const y = toY(v);
            svg += '<line x1="' + pad.left + '" y1="' + y.toFixed(1) + '" x2="' + (svgW - pad.right) + '" y2="' + y.toFixed(1) + '" stroke="#f1f5f9" stroke-width="1"/>';
            const label = v >= 1000 ? (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + 'k' : Math.round(v).toString();
            svg += '<text x="' + (pad.left - 5) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" font-size="9.5" fill="#94a3b8">' + label + '</text>';
        }

        // Area + line
        svg += '<path d="' + areaPath + '" fill="url(#insVolGrad)"/>';
        svg += '<path d="' + linePath + '" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';

        // Evenly distributed tick indices always including first and last
        const volTargetTicks = n <= 6 ? n : 6;
        const volTickIndices = new Set(
            volTargetTicks <= 1
                ? [0]
                : Array.from({length: volTargetTicks}, (_, k) => Math.round(k * (n - 1) / (volTargetTicks - 1)))
        );

        // Dots + value labels
        volumeKg.forEach((v, i) => {
            const x = toX(i), y = toY(v);
            const isLast = i === n - 1;
            svg += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (isLast ? 5 : 3.5) + '" fill="' + (isLast ? '#3b82f6' : 'white') + '" stroke="#3b82f6" stroke-width="2"/>';
            if (volTickIndices.has(i)) {
                const displayVal = preferLbs ? (v * 2.20462) : v;
                const valLabel = displayVal >= 1000 ? (displayVal / 1000).toFixed(1) + 'k' : Math.round(displayVal).toString();
                svg += '<text x="' + x.toFixed(1) + '" y="' + (y - 9).toFixed(1) + '" text-anchor="middle" font-size="9" font-weight="700" fill="#3b82f6">' + valLabel + '</text>';
            }
        });

        // X-axis labels
        labels.forEach((lbl, i) => {
            if (!volTickIndices.has(i)) return;
            const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
            svg += '<text x="' + toX(i).toFixed(1) + '" y="' + (svgH - 5) + '" text-anchor="' + anchor + '" font-size="9.5" fill="#94a3b8">' + lbl + '</text>';
        });

        svg += '</svg>';

        // Footer stats
        const totalAllVol = volumeKg.reduce((s, v) => s + v, 0);
        const avgWeekVol  = totalAllVol / n;
        const unit = preferLbs ? 'lbs' : 'kg';

        const statsHtml = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px;">'
            + '<div style="background:#eff6ff;padding:10px 6px;border-radius:10px;text-align:center;">'
            +   '<div style="font-size:0.95rem;font-weight:800;color:#3b82f6;">' + _fmtVolume(latestVol, preferLbs) + '</div>'
            +   '<div style="font-size:0.6rem;color:var(--text-muted);margin-top:2px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">This Week</div>'
            + '</div>'
            + '<div style="background:#f0fdf4;padding:10px 6px;border-radius:10px;text-align:center;">'
            +   '<div style="font-size:0.95rem;font-weight:800;color:#10b981;">' + _fmtVolume(avgWeekVol, preferLbs) + '</div>'
            +   '<div style="font-size:0.6rem;color:var(--text-muted);margin-top:2px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Weekly Avg</div>'
            + '</div>'
            + '<div style="background:#fafafa;padding:10px 6px;border-radius:10px;text-align:center;">'
            +   '<div style="font-size:0.95rem;font-weight:800;color:var(--text-main);">' + _fmtVolume(Math.max(...volumeKg), preferLbs) + '</div>'
            +   '<div style="font-size:0.6rem;color:var(--text-muted);margin-top:2px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Best Week</div>'
            + '</div>'
            + '</div>';

        container.innerHTML = '<div style="font-size:0.7rem;color:var(--text-muted);font-weight:600;margin-bottom:10px;">Last ' + n + ' weeks &nbsp;·&nbsp; weight × reps per set</div>'
            + svg + statsHtml;
    }

    function _renderVolumeGraphFromRows(rows, customMuscleMap) {
        const container = document.getElementById('insights-volume-container');
        const headlineEl = document.getElementById('insights-volume-headline');
        const sublineEl  = document.getElementById('insights-volume-subline');
        if (!container) return;

        const preferLbs = localStorage.getItem('weightUnitPreference') === 'lbs';
        const selectedArea = _getInsightsVolumeArea(window._insightsVolumeSelectedArea || 'all').key;
        const timeframe = _getInsightsVolumeTimeframe(window._insightsVolumeTimeframe || '3m');
        window._insightsVolumeSelectedArea = selectedArea;
        window._insightsVolumeTimeframe = timeframe.key;

        const byAreaWeek = _buildVolumeAggregation(rows, customMuscleMap);
        const allWeeks = Object.keys(byAreaWeek.all).sort();
        if (allWeeks.length === 0) {
            if (headlineEl) headlineEl.textContent = '';
            if (sublineEl) sublineEl.textContent = '';
            container.innerHTML = _renderVolumeControls(selectedArea, timeframe.key)
                + '<div style="text-align: center; padding: 16px; color: var(--text-muted); font-size: 0.85rem;">Log workouts with weights to see your weekly volume trend here.</div>';
            return;
        }

        const currentWeekStart = _getWeekStart(new Date().toISOString().split('T')[0]);
        const firstWeek = allWeeks[0] < currentWeekStart ? allWeeks[0] : currentWeekStart;
        const displayWeeks = _buildContinuousWeekRange(firstWeek, currentWeekStart).slice(-timeframe.weeks);
        const selectedByWeek = byAreaWeek[selectedArea] || {};
        const volumeKg = displayWeeks.map(w => selectedByWeek[w] || 0);
        const n = displayWeeks.length;
        const hasSelectedVolume = volumeKg.some(v => v > 0);
        const areaMeta = _getInsightsVolumeArea(selectedArea);

        if (!hasSelectedVolume) {
            if (headlineEl) headlineEl.textContent = _fmtVolume(0, preferLbs);
            if (sublineEl) sublineEl.textContent = selectedArea === 'all' ? 'No lifting volume in this window' : 'No ' + areaMeta.label.toLowerCase() + ' volume in this window';
            container.innerHTML = _renderVolumeControls(selectedArea, timeframe.key)
                + _renderVolumeProgressVerdict(selectedArea, byAreaWeek, displayWeeks, rows, customMuscleMap, preferLbs)
                + '<div style="text-align: center; padding: 16px; color: var(--text-muted); font-size: 0.85rem;">No ' + areaMeta.label.toLowerCase() + ' volume found in this ' + timeframe.label + ' view.</div>'
                + _renderVolumeSplit(byAreaWeek, currentWeekStart, preferLbs);
            return;
        }

        const latestVol = volumeKg[n - 1];
        const prevVol = n >= 2 ? volumeKg[n - 2] : null;
        const todayStr = new Date().toISOString().split('T')[0];
        const dayOffset = Math.round((new Date(todayStr + 'T12:00:00') - new Date(currentWeekStart + 'T12:00:00')) / 86400000);
        const prevWeekStart = _addDaysToDateStr(currentWeekStart, -7);
        const prevSameDay = _addDaysToDateStr(prevWeekStart, dayOffset);
        const currentWeekSoFar = _sumVolumeRows(rows, selectedArea, customMuscleMap, currentWeekStart, todayStr);
        const prevWeekSamePoint = _sumVolumeRows(rows, selectedArea, customMuscleMap, prevWeekStart, prevSameDay);

        if (headlineEl) headlineEl.textContent = _fmtVolume(latestVol, preferLbs);
        if (sublineEl) {
            if (prevWeekSamePoint > 0) {
                const diff = currentWeekSoFar - prevWeekSamePoint;
                const diffFmt = (diff >= 0 ? '+' : '-') + _fmtVolume(Math.abs(diff), preferLbs);
                const diffColor = diff >= 0 ? '#3b82f6' : '#f59e0b';
                sublineEl.innerHTML = (selectedArea === 'all' ? 'This week so far' : areaMeta.label + ' this week') + ' &nbsp;<span style="font-weight:700;color:' + diffColor + ';">' + diffFmt + ' vs same point last week</span>';
            } else if (prevVol !== null && displayWeeks[n - 1] !== currentWeekStart) {
                const diff = latestVol - prevVol;
                const diffFmt = (diff >= 0 ? '+' : '-') + _fmtVolume(Math.abs(diff), preferLbs);
                const diffColor = diff >= 0 ? '#3b82f6' : '#f59e0b';
                sublineEl.innerHTML = 'This week &nbsp;<span style="font-weight:700;color:' + diffColor + ';">' + diffFmt + ' vs last week</span>';
            } else {
                sublineEl.textContent = selectedArea === 'all' ? 'This week so far' : areaMeta.label + ' this week so far';
            }
        }

        const labels = displayWeeks.map(w => {
            const d = new Date(w + 'T12:00:00');
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });

        const svgW = 400, svgH = 210;
        const pad = { top: 26, right: 16, bottom: 36, left: 46 };
        const cW = svgW - pad.left - pad.right;
        const cH = svgH - pad.top - pad.bottom;
        const xStep = n > 1 ? cW / (n - 1) : 0;
        const maxVol = Math.max(...volumeKg);
        const yMax = Math.ceil(maxVol / 1000) * 1000 || 1000;
        const toX = i => pad.left + xStep * i;
        const toY = v => pad.top + cH - (v / yMax) * cH;

        const linePath = volumeKg.map((v, i) => (i === 0 ? 'M' : 'L') + ' ' + toX(i).toFixed(1) + ',' + toY(v).toFixed(1)).join(' ');
        const areaPath = (() => {
            const bot = pad.top + cH;
            let d = 'M ' + toX(0).toFixed(1) + ',' + bot + ' L ' + toX(0).toFixed(1) + ',' + toY(volumeKg[0]).toFixed(1);
            for (let i = 1; i < n; i++) d += ' L ' + toX(i).toFixed(1) + ',' + toY(volumeKg[i]).toFixed(1);
            return d + ' L ' + toX(n - 1).toFixed(1) + ',' + bot + ' Z';
        })();

        const gradientId = 'insVolGrad' + selectedArea;
        let svg = '<svg viewBox="0 0 ' + svgW + ' ' + svgH + '" style="width:100%;display:block;overflow:visible;">';
        svg += '<defs><linearGradient id="' + gradientId + '" x1="0" y1="0" x2="0" y2="1">'
            + '<stop offset="0%" stop-color="' + areaMeta.color + '" stop-opacity="0.18"/>'
            + '<stop offset="100%" stop-color="' + areaMeta.color + '" stop-opacity="0.02"/>'
            + '</linearGradient></defs>';

        for (let i = 0; i <= 4; i++) {
            const v = (yMax / 4) * i;
            const y = toY(v);
            svg += '<line x1="' + pad.left + '" y1="' + y.toFixed(1) + '" x2="' + (svgW - pad.right) + '" y2="' + y.toFixed(1) + '" stroke="#f1f5f9" stroke-width="1"/>';
            const label = v >= 1000 ? (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + 'k' : Math.round(v).toString();
            svg += '<text x="' + (pad.left - 5) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" font-size="9.5" fill="#94a3b8">' + label + '</text>';
        }

        svg += '<path d="' + areaPath + '" fill="url(#' + gradientId + ')"/>';
        svg += '<path d="' + linePath + '" fill="none" stroke="' + areaMeta.color + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';

        const volTargetTicks = n <= 6 ? n : 6;
        const volTickIndices = new Set(
            volTargetTicks <= 1
                ? [0]
                : Array.from({length: volTargetTicks}, (_, k) => Math.round(k * (n - 1) / (volTargetTicks - 1)))
        );

        volumeKg.forEach((v, i) => {
            const x = toX(i), y = toY(v);
            const isLast = i === n - 1;
            svg += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (isLast ? 5 : 3.5) + '" fill="' + (isLast ? areaMeta.color : 'white') + '" stroke="' + areaMeta.color + '" stroke-width="2"/>';
            if (volTickIndices.has(i)) {
                const displayVal = preferLbs ? (v * 2.20462) : v;
                const valLabel = displayVal >= 1000 ? (displayVal / 1000).toFixed(1) + 'k' : Math.round(displayVal).toString();
                svg += '<text x="' + x.toFixed(1) + '" y="' + (y - 9).toFixed(1) + '" text-anchor="middle" font-size="9" font-weight="700" fill="' + areaMeta.color + '">' + valLabel + '</text>';
            }
        });

        labels.forEach((lbl, i) => {
            if (!volTickIndices.has(i)) return;
            const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
            svg += '<text x="' + toX(i).toFixed(1) + '" y="' + (svgH - 5) + '" text-anchor="' + anchor + '" font-size="9.5" fill="#94a3b8">' + lbl + '</text>';
        });
        svg += '</svg>';

        const totalAllVol = volumeKg.reduce((s, v) => s + v, 0);
        const avgWeekVol  = totalAllVol / n;
        const statsHtml = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px;">'
            + '<div style="background:' + areaMeta.soft + ';padding:10px 6px;border-radius:10px;text-align:center;">'
            +   '<div style="font-size:0.95rem;font-weight:800;color:' + areaMeta.color + ';">' + _fmtVolume(latestVol, preferLbs) + '</div>'
            +   '<div style="font-size:0.6rem;color:var(--text-muted);margin-top:2px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">This Week</div>'
            + '</div>'
            + '<div style="background:#f0fdf4;padding:10px 6px;border-radius:10px;text-align:center;">'
            +   '<div style="font-size:0.95rem;font-weight:800;color:#10b981;">' + _fmtVolume(avgWeekVol, preferLbs) + '</div>'
            +   '<div style="font-size:0.6rem;color:var(--text-muted);margin-top:2px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">' + timeframe.avgLabel + '</div>'
            + '</div>'
            + '<div style="background:#fafafa;padding:10px 6px;border-radius:10px;text-align:center;">'
            +   '<div style="font-size:0.95rem;font-weight:800;color:var(--text-main);">' + _fmtVolume(Math.max(...volumeKg), preferLbs) + '</div>'
            +   '<div style="font-size:0.6rem;color:var(--text-muted);margin-top:2px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Best Week</div>'
            + '</div>'
            + '</div>';

        const splitWeek = byAreaWeek.all[currentWeekStart] ? currentWeekStart : displayWeeks.slice().reverse().find(w => byAreaWeek.all[w] > 0) || currentWeekStart;
        container.innerHTML = _renderVolumeControls(selectedArea, timeframe.key)
            + _renderVolumeProgressVerdict(selectedArea, byAreaWeek, displayWeeks, rows, customMuscleMap, preferLbs)
            + '<div style="font-size:0.7rem;color:var(--text-muted);font-weight:600;margin-bottom:10px;">' + timeframe.detail + ' &middot; ' + n + ' weeks &middot; ' + (selectedArea === 'all' ? 'all exercises' : areaMeta.label.toLowerCase() + ' volume') + ' &middot; weight x reps per set</div>'
            + svg + statsHtml + _renderVolumeSplit(byAreaWeek, splitWeek, preferLbs);
    }

    async function renderVolumeGraphWithBodyPartSplit(userId) {
        const container = document.getElementById('insights-volume-container');
        const headlineEl = document.getElementById('insights-volume-headline');
        const sublineEl  = document.getElementById('insights-volume-subline');
        if (!container) return;

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const sinceDate = sixMonthsAgo.toISOString().split('T')[0];

        const { data: rows, error } = await supabaseClient
            .from('workouts')
            .select('workout_date, exercise_name, set_number, weight_kg, reps')
            .eq('user_id', userId)
            .eq('workout_type', 'history')
            .gte('workout_date', sinceDate)
            .order('workout_date', { ascending: false })
            .limit(5000);

        if (error) console.warn('Volume insight load failed:', error);

        if (!rows || rows.length === 0) {
            if (headlineEl) headlineEl.textContent = '';
            if (sublineEl) sublineEl.textContent = '';
            container.innerHTML = _renderVolumeControls(window._insightsVolumeSelectedArea || 'all', window._insightsVolumeTimeframe || '3m')
                + '<div style="text-align: center; padding: 16px; color: var(--text-muted); font-size: 0.85rem;">Log workouts with weights to see your weekly volume trend here.</div>';
            return;
        }

        const seen = new Set();
        const deduped = [];
        for (const row of rows) {
            const key = `${row.workout_date}|${row.exercise_name}|${row.set_number}`;
            if (!seen.has(key)) { seen.add(key); deduped.push(row); }
        }

        let customMuscleMap = {};
        try {
            const { data: customExercises, error: customError } = await supabaseClient
                .from('custom_exercises')
                .select('exercise_name, muscle_group')
                .eq('user_id', userId);
            if (customError) {
                console.warn('Custom exercise muscle groups unavailable:', customError);
            } else {
                customMuscleMap = (customExercises || []).reduce((map, exercise) => {
                    map[_normaliseExerciseLookupName(exercise.exercise_name)] = exercise.muscle_group;
                    return map;
                }, {});
            }
        } catch (e) {
            console.warn('Custom exercise muscle group lookup failed:', e);
        }

        window._insightsVolumeRows = deduped;
        window._insightsVolumeCustomMuscles = customMuscleMap;
        _renderVolumeGraphFromRows(deduped, customMuscleMap);
    }

    function setInsightsVolumeArea(areaKey) {
        window._insightsVolumeSelectedArea = _getInsightsVolumeArea(areaKey).key;
        if (window._insightsVolumeRows) {
            _renderVolumeGraphFromRows(window._insightsVolumeRows, window._insightsVolumeCustomMuscles || {});
        } else if (window.currentUser && window.currentUser.id) {
            renderVolumeGraphWithBodyPartSplit(window.currentUser.id);
        }
    }

    function setInsightsVolumeTimeframe(timeframeKey) {
        window._insightsVolumeTimeframe = _getInsightsVolumeTimeframe(timeframeKey).key;
        if (window._insightsVolumeRows) {
            _renderVolumeGraphFromRows(window._insightsVolumeRows, window._insightsVolumeCustomMuscles || {});
        } else if (window.currentUser && window.currentUser.id) {
            renderVolumeGraphWithBodyPartSplit(window.currentUser.id);
        }
    }

    renderVolumeGraph = renderVolumeGraphWithBodyPartSplit;

    window.openInsightsView   = openInsightsView;
    window.closeInsightsView  = closeInsightsView;
    window.renderVolumeGraph = renderVolumeGraph;
    window.setInsightsVolumeArea = setInsightsVolumeArea;
    window.setInsightsVolumeTimeframe = setInsightsVolumeTimeframe;

// ===== 7-DAY VITALITY SCORE =====
//
// Combines five inputs over the last 7 days into a single 0-100 score:
//   - Steps          (20 pts)  movement / NEAT
//   - Sleep          (25 pts)  recovery
//   - Strength       (20 pts)  workouts logged
//   - Nutrition      (20 pts)  days where food was tracked
//   - Body weight    (15 pts)  recency of last weigh-in
// The breakdown is shown so the user can see exactly which lever to pull next.

    function renderVitalityScore(opts) {
        const card = document.getElementById('insights-vitality-card');
        if (!card) return;
        const opts2 = opts || {};
        const weighIns = opts2.weighIns || [];
        const nutritionDays = opts2.nutritionDays || [];
        const sleepData = opts2.sleepData || null;
        const stepsData = opts2.stepsData || [];
        const exerciseHistory = opts2.exerciseHistory || [];

        const today = new Date();
        const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 6); // last 7 days inclusive
        const cutoffStr = cutoff.toISOString().split('T')[0];

        // ---- Steps (20 pts) ----
        const recentSteps = (stepsData || []).filter(r => r && r.date >= cutoffStr && typeof r.steps === 'number');
        const stepsAvg = recentSteps.length
            ? Math.round(recentSteps.reduce((s, r) => s + r.steps, 0) / recentSteps.length)
            : 0;
        const stepsPts = recentSteps.length === 0 ? 0 : Math.round(Math.min(20, (stepsAvg / 10000) * 20));
        const stepsHasData = recentSteps.length > 0;

        // ---- Sleep (25 pts) ----
        let sleepAvgHrs = 0, sleepHasData = false;
        if (sleepData && Array.isArray(sleepData.records) && sleepData.records.length) {
            const recent = sleepData.records.filter(r => r && r.date >= cutoffStr);
            if (recent.length) {
                const totalMins = recent.reduce((s, r) => s + (r.duration_minutes || r.total_sleep_minutes || 0), 0);
                sleepAvgHrs = (totalMins / recent.length) / 60;
                sleepHasData = true;
            }
        }
        // Below 5h = 0 pts, 7+ h = 25 pts, linear in between
        let sleepPts = 0;
        if (sleepHasData) {
            if (sleepAvgHrs >= 7) sleepPts = 25;
            else if (sleepAvgHrs <= 5) sleepPts = 0;
            else sleepPts = Math.round(((sleepAvgHrs - 5) / 2) * 25);
        }

        // ---- Strength (20 pts) ----
        // Count distinct workout dates in last 7 days
        const workoutDates = new Set();
        for (const row of exerciseHistory) {
            if (row && row.workout_date && row.workout_date >= cutoffStr) workoutDates.add(row.workout_date);
        }
        const sessionsThisWeek = workoutDates.size;
        // 0 sessions = 0, 1 = 8, 2 = 14, 3 = 18, 4+ = 20
        const strengthPts = sessionsThisWeek >= 4 ? 20
            : sessionsThisWeek === 3 ? 18
            : sessionsThisWeek === 2 ? 14
            : sessionsThisWeek === 1 ? 8
            : 0;
        // Strength always has data (we know if 0)

        // ---- Nutrition (20 pts) ----
        const recentNutrition = nutritionDays.filter(d => d && d.nutrition_date && d.nutrition_date >= cutoffStr && d.total_calories && parseFloat(d.total_calories) > 0);
        const nutritionDaysCount = recentNutrition.length;
        const nutritionPts = Math.round((Math.min(7, nutritionDaysCount) / 7) * 20);

        // ---- Body weight check-in (15 pts) ----
        let daysSinceWeighIn = null;
        if (weighIns && weighIns.length) {
            const sorted = [...weighIns].sort((a, b) => (b.weigh_in_date || '').localeCompare(a.weigh_in_date || ''));
            const latest = sorted[0];
            if (latest && latest.weigh_in_date) {
                const d = new Date(latest.weigh_in_date + 'T12:00:00');
                daysSinceWeighIn = Math.max(0, Math.floor((today - d) / 86400000));
            }
        }
        let bodyPts = 0;
        if (daysSinceWeighIn !== null) {
            if (daysSinceWeighIn <= 2) bodyPts = 15;
            else if (daysSinceWeighIn <= 7) bodyPts = 10;
            else if (daysSinceWeighIn <= 14) bodyPts = 5;
            else bodyPts = 0;
        }

        const total = stepsPts + sleepPts + strengthPts + nutritionPts + bodyPts;

        // ---- Apply visual updates ----
        const ringColor = total >= 80 ? '#10b981' : total >= 60 ? '#84cc16' : total >= 40 ? '#f59e0b' : '#ef4444';
        const label = total >= 80 ? 'Thriving' : total >= 60 ? 'On Track' : total >= 40 ? 'Building Momentum' : total >= 1 ? 'Just Getting Started' : 'Add Your First Data';
        const tagline = total >= 80 ? 'Sleep, training, and nutrition are all clicking — keep it going.'
            : total >= 60 ? 'Solid week. A small tweak below would push you into the green.'
            : total >= 40 ? 'You\'re building real habits. Pick the lowest bar below to focus on.'
            : total >= 1 ? 'Every log counts. Tap a card below to start building your streak.'
            : 'Log a meal, weigh-in or workout to see your first score.';

        const scoreEl = document.getElementById('insights-vitality-score');
        const labelEl = document.getElementById('insights-vitality-label');
        const taglineEl = document.getElementById('insights-vitality-tagline');
        const ringEl = document.getElementById('insights-vitality-ring');
        const breakdownEl = document.getElementById('insights-vitality-breakdown');
        const tipEl = document.getElementById('insights-vitality-tip');

        if (scoreEl) scoreEl.textContent = total;
        if (labelEl) labelEl.textContent = label;
        if (taglineEl) taglineEl.textContent = tagline;
        if (ringEl) {
            const circumference = 2 * Math.PI * 42;
            const offset = circumference - (total / 100) * circumference;
            ringEl.setAttribute('stroke-dasharray', circumference.toFixed(2));
            // Animate from full offset to actual offset on each render
            ringEl.setAttribute('stroke-dashoffset', circumference.toFixed(2));
            ringEl.setAttribute('stroke', ringColor);
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    ringEl.setAttribute('stroke-dashoffset', offset.toFixed(2));
                });
            });
        }

        // Breakdown rows
        const components = [
            { key: 'sleep',     label: '😴 Sleep',     pts: sleepPts,     max: 25, value: sleepHasData ? (Math.floor(sleepAvgHrs) + 'h ' + Math.round((sleepAvgHrs % 1) * 60) + 'm avg') : 'No data', hasData: sleepHasData, color: '#a78bfa' },
            { key: 'steps',     label: '🦶 Steps',     pts: stepsPts,     max: 20, value: stepsHasData ? (stepsAvg.toLocaleString() + ' / day') : 'No data', hasData: stepsHasData, color: '#34d399' },
            { key: 'strength',  label: '🏋️ Strength',  pts: strengthPts,  max: 20, value: sessionsThisWeek + ' session' + (sessionsThisWeek === 1 ? '' : 's'), hasData: true, color: '#60a5fa' },
            { key: 'nutrition', label: '🍎 Nutrition', pts: nutritionPts, max: 20, value: nutritionDaysCount + ' / 7 days logged', hasData: true, color: '#fb923c' },
            { key: 'weight',    label: '⚖️ Body Weight', pts: bodyPts,   max: 15, value: daysSinceWeighIn === null ? 'No weigh-ins' : daysSinceWeighIn === 0 ? 'Today' : daysSinceWeighIn + ' day' + (daysSinceWeighIn === 1 ? '' : 's') + ' ago', hasData: daysSinceWeighIn !== null, color: '#f472b6' }
        ];

        if (breakdownEl) {
            breakdownEl.innerHTML = components.map(c => {
                const pct = Math.round((c.pts / c.max) * 100);
                return '<div style="display: flex; align-items: center; gap: 10px;">'
                    + '<div style="font-size: 0.72rem; color: rgba(255,255,255,0.85); width: 90px; flex-shrink: 0;">' + c.label + '</div>'
                    + '<div style="flex: 1; height: 6px; background: rgba(255,255,255,0.08); border-radius: 999px; overflow: hidden;">'
                    +   '<div style="height: 100%; width: ' + pct + '%; background: ' + c.color + '; border-radius: 999px; transition: width 0.8s cubic-bezier(.4,0,.2,1);"></div>'
                    + '</div>'
                    + '<div style="font-size: 0.7rem; color: rgba(255,255,255,0.6); width: 90px; text-align: right; flex-shrink: 0;">' + c.value + '</div>'
                    + '</div>';
            }).join('');
        }

        // Show focus tip pointing at the lowest-percentage component (if any data exists)
        if (tipEl) {
            const withData = components.filter(c => c.hasData || c.key === 'strength' || c.key === 'nutrition');
            if (total >= 1 && total < 100 && withData.length) {
                const weakest = withData.slice().sort((a, b) => (a.pts / a.max) - (b.pts / b.max))[0];
                const tips = {
                    sleep: 'Your biggest unlock right now: get to bed earlier — aim for 7+ hours over the next week.',
                    steps: 'A short walk after meals adds up fast — try a 20-min loop today to push your steps up.',
                    strength: 'Even one strength session this week boosts this score — open the Movement tab.',
                    nutrition: 'Snap a photo of your next meal — daily logging is the lever that unlocks every other insight.',
                    weight: 'Hop on the scale tomorrow morning — even one weigh-in this week keeps your trend honest.'
                };
                tipEl.innerHTML = '<strong style="color: white;">Focus this week:</strong> ' + (tips[weakest.key] || '');
                tipEl.style.display = 'block';
            } else if (total >= 100) {
                tipEl.innerHTML = '<strong style="color: white;">100/100 — you\'re crushing it.</strong> Keep this rhythm and the strength gains follow.';
                tipEl.style.display = 'block';
            } else {
                tipEl.style.display = 'none';
            }
        }
    }

    window.renderVitalityScore = renderVitalityScore;

    function _formatInsightsWeight(weightKg) {
        const kg = parseFloat(weightKg);
        if (!isFinite(kg)) return '--';
        const preferLbs = localStorage.getItem('weightUnitPreference') === 'lbs';
        return preferLbs ? (kg * 2.20462).toFixed(1) + ' lbs' : kg.toFixed(1) + ' kg';
    }

    function _formatInsightsDate(dateStr) {
        if (!dateStr) return '--';
        const date = new Date(dateStr + 'T12:00:00');
        if (isNaN(date.getTime())) return String(dateStr);
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    function _getInsightsDateKey(date = new Date()) {
        if (typeof getLocalDateString === 'function') return getLocalDateString(date);
        const local = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
        return local.toISOString().slice(0, 10);
    }

    function _getActiveDaysFromNav(navId, fallbackDays) {
        const nav = document.getElementById(navId);
        if (!nav) return fallbackDays;
        const activeBtn = nav.querySelector('button.active');
        if (!activeBtn) return fallbackDays;
        const explicitDays = parseInt(activeBtn.getAttribute('data-days'), 10);
        if (Number.isFinite(explicitDays)) return explicitDays;
        const textDays = parseInt(activeBtn.innerText, 10);
        return Number.isFinite(textDays) ? textDays : fallbackDays;
    }

    function _findWeighInRecord(recordOrId) {
        if (!recordOrId) return null;
        if (typeof recordOrId === 'object') return recordOrId;
        const id = String(recordOrId);
        const source = [].concat(window._insightsWeighIns || [], window._cachedWeighIns || []);
        return source.find(function(row) { return String(row && row.id) === id; }) || null;
    }

    function _syncWeighInManagerCardState() {
        const expanded = !!window._weighInManagerExpanded;
        const body = document.getElementById('weigh-in-management-body');
        const toggle = document.getElementById('weigh-in-management-toggle');
        const chevron = document.getElementById('weigh-in-management-chevron');

        if (body) body.style.display = expanded ? 'block' : 'none';
        if (toggle) toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        if (chevron) chevron.style.transform = expanded ? 'rotate(180deg)' : 'rotate(0deg)';
    }

    function toggleWeighInManagerCard(forceExpanded) {
        if (typeof window._weighInManagerExpanded !== 'boolean') {
            window._weighInManagerExpanded = false;
        }

        window._weighInManagerExpanded = typeof forceExpanded === 'boolean'
            ? forceExpanded
            : !window._weighInManagerExpanded;

        _syncWeighInManagerCardState();
    }

    function _ensureWeighInEditorModal() {
        let modal = document.getElementById('weigh-in-editor-modal');
        if (modal) return modal;

        document.body.insertAdjacentHTML('beforeend', `
            <div id="weigh-in-editor-modal" style="display:none; position:fixed; inset:0; z-index:200050; background:rgba(15,23,42,0.72); align-items:center; justify-content:center; padding:calc(18px + env(safe-area-inset-top, 0px)) 18px calc(18px + env(safe-area-inset-bottom, 0px)); box-sizing:border-box;">
                <div style="width:100%; max-width:420px; max-height:100%; overflow-y:auto; -webkit-overflow-scrolling:touch; overscroll-behavior:contain; background:var(--surface); border-radius:20px; box-shadow:0 24px 70px rgba(0,0,0,0.35); padding:20px; box-sizing:border-box; border:1px solid rgba(148,163,184,0.18);">
                    <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:14px;">
                        <div>
                            <div style="font-size:0.72rem; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:#7BA883; margin-bottom:4px;">Weigh-ins</div>
                            <h3 id="weigh-in-editor-title" style="margin:0; color:var(--text-main); font-size:1.25rem; line-height:1.2; font-weight:850;">Add weigh-in</h3>
                        </div>
                        <button onclick="closeWeighInEditorModal()" title="Close" style="width:34px; height:34px; border:none; border-radius:50%; background:rgba(148,163,184,0.12); color:var(--text-main); font-size:1.2rem; cursor:pointer; line-height:1;">&times;</button>
                    </div>
                    <div style="display:grid; gap:12px;">
                        <label style="display:block; font-size:0.78rem; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-muted);">
                            Date
                            <input id="weigh-in-editor-date" type="date" style="width:100%; margin-top:6px; padding:14px 14px; border:1.5px solid rgba(148,163,184,0.35); border-radius:12px; font-size:1rem; color:var(--text-main); box-sizing:border-box; background:var(--bg); font-family:inherit; caret-color:var(--text-main);">
                        </label>
                        <label style="display:block; font-size:0.78rem; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-muted);">
                            Weight
                            <div style="position:relative; margin-top:6px;">
                                <input id="weigh-in-editor-weight" type="number" step="0.1" min="20" max="500" style="width:100%; padding:14px 54px 14px 14px; border:1.5px solid rgba(148,163,184,0.35); border-radius:12px; font-size:1rem; color:var(--text-main); box-sizing:border-box; background:var(--bg); font-family:inherit; caret-color:var(--text-main);">
                                <span id="weigh-in-editor-unit-label" style="position:absolute; right:14px; top:50%; transform:translateY(-50%); color:var(--text-muted); font-size:0.9rem; font-weight:700;">kg</span>
                            </div>
                        </label>
                        <div id="weigh-in-editor-helper" style="font-size:0.78rem; color:var(--text-muted); line-height:1.45; background:rgba(123,168,131,0.08); border:1px solid rgba(123,168,131,0.18); border-radius:12px; padding:12px;">Saving on an existing day replaces that entry.</div>
                    </div>
                    <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:16px;">
                        <button id="weigh-in-editor-save-btn" onclick="saveWeighInEditorModal()" style="flex:1 1 150px; border:none; border-radius:12px; background:linear-gradient(135deg, #7BA883 0%, #5b8c62 100%); color:white; padding:13px 14px; font-weight:850; font-size:0.95rem; cursor:pointer;">Save weigh-in</button>
                        <button id="weigh-in-editor-delete-btn" onclick="deleteWeighInRecord()" style="display:none; flex:1 1 120px; border:1px solid #fecaca; border-radius:12px; background:#fff1f2; color:#be123c; padding:13px 14px; font-weight:800; font-size:0.95rem; cursor:pointer;">Delete</button>
                        <button onclick="closeWeighInEditorModal()" style="flex:1 1 110px; border:1px solid rgba(148,163,184,0.28); border-radius:12px; background:var(--surface); color:var(--text-main); padding:13px 14px; font-weight:750; font-size:0.95rem; cursor:pointer;">Cancel</button>
                    </div>
                </div>
            </div>
        `);

        return document.getElementById('weigh-in-editor-modal');
    }

    function renderWeighInManager(weighIns, containerId = 'weigh-in-management-container') {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (typeof window._weighInManagerExpanded !== 'boolean') {
            window._weighInManagerExpanded = false;
        }

        const sorted = (weighIns || []).slice().sort(function(a, b) {
            return (b.weigh_in_date || '').localeCompare(a.weigh_in_date || '');
        });

        const total = sorted.length;
        const latest = total ? sorted[0] : null;
        const latestWeight = latest ? _formatInsightsWeight(latest.weight_kg) : null;
        const latestDate = latest ? _formatInsightsDate(latest.weigh_in_date) : null;
        const summaryEl = document.getElementById('weigh-in-management-summary');

        if (summaryEl) {
            summaryEl.textContent = total
                ? `Latest weigh-in: ${latestWeight} \u2022 ${latestDate}`
                : 'No weigh-ins yet';
        }

        if (!sorted.length) {
            container.innerHTML = `
                <div style="text-align:center; padding:18px 10px; color:var(--text-muted);">
                    <div style="font-size:2rem; margin-bottom:8px; opacity:0.35;">&#9878;</div>
                    <div style="font-size:0.92rem; font-weight:700; color:var(--text-main); margin-bottom:4px;">No weigh-ins yet</div>
                    <div style="font-size:0.8rem; line-height:1.45; margin-bottom:12px;">Add your first entry here, or use this panel to fix an older one.</div>
                </div>
            `;
            _syncWeighInManagerCardState();
            return;
        }

        let html = `
            <div style="display:flex; flex-direction:column; gap:10px;">
        `;

        sorted.forEach(function(record) {
            const weightLabel = _formatInsightsWeight(record.weight_kg);
            const dateLabel = _formatInsightsDate(record.weigh_in_date);
            const bfLabel = record.body_fat_pct != null && record.body_fat_pct !== ''
                ? `<div style="font-size:0.78rem; color:var(--text-muted); margin-top:4px;">Body fat ${Number(record.body_fat_pct).toFixed(1)}%</div>`
                : '';

            html += `
                <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:12px 0; border-bottom:1px solid rgba(148,163,184,0.16);">
                    <div style="min-width:0; flex:1;">
                        <div style="font-size:0.86rem; font-weight:800; color:var(--text-main); line-height:1.2;">${dateLabel}</div>
                        <div style="font-size:1.05rem; font-weight:900; color:#7BA883; margin-top:3px;">${weightLabel}</div>
                        ${bfLabel}
                    </div>
                    <div style="display:flex; gap:8px; flex-shrink:0;">
                        <button onclick="openWeighInEditorModal('${record.id}')" style="background:var(--surface); border:1px solid rgba(148,163,184,0.28); color:var(--text-main); padding:8px 10px; border-radius:10px; font-size:0.78rem; font-weight:800; cursor:pointer;">Edit</button>
                        <button onclick="deleteWeighInRecord('${record.id}')" style="background:#fff1f2; border:1px solid #fecaca; color:#be123c; padding:8px 10px; border-radius:10px; font-size:0.78rem; font-weight:800; cursor:pointer;">Delete</button>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
        _syncWeighInManagerCardState();
    }

    async function refreshWeighInDisplays() {
        if (!window.currentUser) return;

        try {
            const weighIns = await db.weighIns.getRecent(window.currentUser.id, 365);
            window._insightsWeighIns = weighIns;
            window._cachedWeighIns = weighIns;

            const bodyDays = _getActiveDaysFromNav('insights-bw-timeframe-nav', 30);
            const bodyCutoffDate = new Date();
            bodyCutoffDate.setDate(bodyCutoffDate.getDate() - bodyDays);
            const bodyCutoff = _getInsightsDateKey(bodyCutoffDate);
            const filteredBodyWeighIns = weighIns.filter(function(row) {
                return (row.weigh_in_date || '') >= bodyCutoff;
            });

            renderBodyWeightGraph(filteredBodyWeighIns, 'insights-bodyweight-container');
            renderWeighInManager(weighIns);

            const burnDays = _getActiveDaysFromNav('insights-burned-timeframe-nav', 14);
            const burnContainer = document.getElementById('insights-calories-burned-container');
            if (burnContainer) {
                renderInsightsCaloriesBurned(
                    burnContainer,
                    window._insightsNutrition || [],
                    weighIns,
                    window._insightsWearable || [],
                    burnDays
                );
            }

            const nutritionDays = window._insightsNutrition || [];
            const quizData = window._insightsQuizData || {};
            const sleepData = window._insightsSleep || null;
            const stepsData = window._insightsSteps || [];
            const exerciseHistory = window._insightsExerciseHistory || [];

            renderVitalityScore({
                weighIns: weighIns,
                nutritionDays: nutritionDays,
                sleepData: sleepData,
                stepsData: stepsData,
                exerciseHistory: exerciseHistory
            });
            renderInsightsCorrelations(window._insightsStrengthGains || [], weighIns, sleepData);
            renderEnergyBalance(nutritionDays, window._insightsWearable || [], weighIns, quizData);
        } catch (error) {
            console.warn('Failed to refresh weigh-in displays:', error);
        }
    }

    async function openWeighInEditorModal(recordOrId = null) {
        const modal = _ensureWeighInEditorModal();
        if (!modal) return;

        const record = _findWeighInRecord(recordOrId);
        window._weighInEditorRecord = record || null;

        const preferLbs = localStorage.getItem('weightUnitPreference') === 'lbs';
        const unitLabel = document.getElementById('weigh-in-editor-unit-label');
        const title = document.getElementById('weigh-in-editor-title');
        const helper = document.getElementById('weigh-in-editor-helper');
        const dateInput = document.getElementById('weigh-in-editor-date');
        const weightInput = document.getElementById('weigh-in-editor-weight');
        const deleteBtn = document.getElementById('weigh-in-editor-delete-btn');

        if (unitLabel) unitLabel.textContent = preferLbs ? 'lbs' : 'kg';
        if (title) title.textContent = record ? 'Edit weigh-in' : 'Add weigh-in';
        if (helper) {
            helper.textContent = record
                ? 'Saving on this date replaces the entry for that day.'
                : 'Pick any date. Saving on an existing day replaces that entry.';
        }
        if (dateInput) {
            dateInput.value = record && record.weigh_in_date ? record.weigh_in_date : _getInsightsDateKey();
        }
        if (weightInput) {
            weightInput.step = preferLbs ? '1' : '0.1';
            weightInput.value = record && record.weight_kg != null
                ? (preferLbs ? (Number(record.weight_kg) * 2.20462).toFixed(1) : Number(record.weight_kg).toFixed(1))
                : '';
            setTimeout(function() { weightInput.focus(); }, 0);
        }
        if (deleteBtn) deleteBtn.style.display = record ? 'block' : 'none';

        modal.style.display = 'flex';
    }

    function closeWeighInEditorModal() {
        const modal = document.getElementById('weigh-in-editor-modal');
        if (modal) modal.style.display = 'none';
        window._weighInEditorRecord = null;
    }

    async function saveWeighInEditorModal() {
        if (!window.currentUser) return;

        const dateInput = document.getElementById('weigh-in-editor-date');
        const weightInput = document.getElementById('weigh-in-editor-weight');
        const saveBtn = document.getElementById('weigh-in-editor-save-btn');

        const weighInDate = dateInput ? dateInput.value : '';
        let weightValue = parseFloat(weightInput && weightInput.value);

        if (!weighInDate) {
            alert('Pick a date first.');
            return;
        }
        if (!weightValue || weightValue < 20 || weightValue > 500) {
            alert('Please enter a valid weight.');
            return;
        }

        const preferLbs = localStorage.getItem('weightUnitPreference') === 'lbs';
        if (preferLbs) weightValue *= 0.453592;

        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.75';
            saveBtn.textContent = 'Saving...';
        }

        try {
            await db.weighIns.save(window.currentUser.id, weighInDate, weightValue);
            closeWeighInEditorModal();
            await refreshWeighInDisplays();
            if (typeof checkAndShowWeighInCard === 'function') {
                await checkAndShowWeighInCard();
            }
            if (typeof showToast === 'function') showToast('Weigh-in saved', 'success');
            else if (typeof showWearableToast === 'function') showWearableToast('Weigh-in saved');
        } catch (error) {
            console.error('Error saving weigh-in from manager:', error);
            alert('Failed to save weigh-in. Please try again.');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.style.opacity = '1';
                saveBtn.textContent = 'Save weigh-in';
            }
        }
    }

    async function deleteWeighInRecord(recordOrId) {
        const record = _findWeighInRecord(recordOrId) || window._weighInEditorRecord;
        if (!record || !record.id) return;

        const dateLabel = _formatInsightsDate(record.weigh_in_date);
        const weightLabel = _formatInsightsWeight(record.weight_kg);
        const ok = confirm(`Delete ${weightLabel} from ${dateLabel}? This removes it from the graph.`);
        if (!ok) return;

        try {
            await db.weighIns.delete(record.id, record.user_id || window.currentUser?.id);
            closeWeighInEditorModal();
            await refreshWeighInDisplays();
            if (typeof checkAndShowWeighInCard === 'function') {
                await checkAndShowWeighInCard();
            }
            if (typeof showToast === 'function') showToast('Weigh-in deleted', 'success');
            else if (typeof showWearableToast === 'function') showWearableToast('Weigh-in deleted');
        } catch (error) {
            console.error('Error deleting weigh-in:', error);
            alert('Failed to delete weigh-in. Please try again.');
        }
    }

    window.renderWeighInManager = renderWeighInManager;
    window.refreshWeighInDisplays = refreshWeighInDisplays;
    window.toggleWeighInManagerCard = toggleWeighInManagerCard;
    window.openWeighInEditorModal = openWeighInEditorModal;
    window.closeWeighInEditorModal = closeWeighInEditorModal;
    window.saveWeighInEditorModal = saveWeighInEditorModal;
    window.deleteWeighInRecord = deleteWeighInRecord;

// ===== CALORIES BURNED COMPARISON GRAPH =====

    function updateInsightsBodyWeightTimeframe(days) {
        const nav = document.getElementById('insights-bw-timeframe-nav');
        if (nav) nav.querySelectorAll('button').forEach(b => b.classList.toggle('active', parseInt(b.getAttribute('data-days')) === days));
        if (!window._insightsWeighIns) return;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffStr = cutoff.toISOString().split('T')[0];
        renderBodyWeightGraph(window._insightsWeighIns.filter(w => w.weigh_in_date >= cutoffStr), 'insights-bodyweight-container');
    }

    function updateInsightsCaloriesBurnedTimeframe(days) {
        const nav = document.getElementById('insights-burned-timeframe-nav');
        if (nav) nav.querySelectorAll('button').forEach(b => b.classList.toggle('active', parseInt(b.getAttribute('data-days')) === days));
        if (!window._insightsNutrition || !window._insightsWeighIns) return;
        renderInsightsCaloriesBurned(document.getElementById('insights-calories-burned-container'), window._insightsNutrition, window._insightsWeighIns, window._insightsWearable || [], days);
    }

    function updateInsightsDailyCaloriesTimeframe(days) {
        const nav = document.getElementById('insights-cal-timeframe-nav');
        if (nav) nav.querySelectorAll('button').forEach(b => b.classList.toggle('active', parseInt(b.getAttribute('data-days')) === days));
        if (!window._insightsNutrition) return;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffStr = cutoff.toISOString().split('T')[0];
        renderTotalIntakeGraph(window._insightsNutrition.filter(d => d.nutrition_date >= cutoffStr), 'insights-daily-calories-container');
    }

    function updateInsightsSleepTimeframe(days) {
        const nav = document.getElementById('insights-sleep-timeframe-nav');
        if (nav) nav.querySelectorAll('button').forEach(b => b.classList.toggle('active', parseInt(b.getAttribute('data-days')) === days));
        if (!window._insightsSleep) return;
        renderInsightsSleep(window._insightsSleep, days);
    }

    function updateInsightsStepsTimeframe(days) {
        const nav = document.getElementById('insights-steps-timeframe-nav');
        if (nav) nav.querySelectorAll('button').forEach(b => b.classList.toggle('active', parseInt(b.getAttribute('data-days')) === days));
        if (!window._insightsSteps) return;
        renderInsightsSteps(window._insightsSteps, days);
    }

    function renderInsightsSteps(stepsData, days = 7) {
        const container = document.getElementById('insights-steps-container');
        if (!container) return;

        if (!stepsData || stepsData.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 16px 0;">
                    <div style="font-size: 2rem; margin-bottom: 8px; opacity: 0.4;">🦶</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">No step data yet. Connect Fitbit or Oura below to start tracking your daily steps.</div>
                </div>`;
            return;
        }

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffStr = cutoff.toISOString().split('T')[0];
        const records = stepsData.filter(r => r.date >= cutoffStr).sort((a, b) => a.date.localeCompare(b.date));

        if (records.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.85rem; opacity: 0.6;">No step data for this period.</div>';
            return;
        }

        const chartData = records.map(r => {
            const d = new Date(r.date + 'T12:00:00');
            const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return { label, steps: r.steps, date: r.date };
        });

        const STEP_GOAL = 10000;
        const maxSteps = Math.max(...chartData.map(d => d.steps), STEP_GOAL);
        const yMax = Math.ceil(maxSteps / 2000) * 2000;

        const svgW = 400, svgH = 260;
        const pad = { top: 28, right: 20, bottom: 36, left: 46 };
        const cW = svgW - pad.left - pad.right;
        const cH = svgH - pad.top - pad.bottom;
        const n = chartData.length;
        const xStep = n > 1 ? cW / (n - 1) : 0;

        const toX = i => pad.left + xStep * i;
        const toY = v => pad.top + cH - (v / yMax) * cH;

        const linePath = chartData.map((d, i) => (i === 0 ? 'M' : 'L') + ' ' + toX(i) + ',' + toY(d.steps)).join(' ');
        const areaBot = pad.top + cH;
        const areaPath = 'M ' + toX(0) + ',' + areaBot + ' L ' + toX(0) + ',' + toY(chartData[0].steps)
            + chartData.slice(1).map((d, i) => ' L ' + toX(i + 1) + ',' + toY(d.steps)).join('')
            + ' L ' + toX(n - 1) + ',' + areaBot + ' Z';

        const tickCount = 4;
        const tickStep = yMax / tickCount;

        let svg = '<svg viewBox="0 0 ' + svgW + ' ' + svgH + '" style="width: 100%; display: block; overflow: visible;">';
        svg += '<defs><linearGradient id="insStepsGrad" x1="0" y1="0" x2="0" y2="1">'
            + '<stop offset="0%" stop-color="#10b981" stop-opacity="0.22"/>'
            + '<stop offset="100%" stop-color="#10b981" stop-opacity="0.02"/>'
            + '</linearGradient></defs>';

        // Grid lines
        for (let t = 0; t <= tickCount; t++) {
            const val = t * tickStep;
            const y = toY(val);
            svg += '<line x1="' + pad.left + '" y1="' + y + '" x2="' + (svgW - pad.right) + '" y2="' + y + '" stroke="#f1f5f9" stroke-width="1"/>';
            const label = val >= 1000 ? (val / 1000).toFixed(val % 1000 === 0 ? 0 : 1) + 'k' : val;
            svg += '<text x="' + (pad.left - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="10" fill="#94a3b8">' + label + '</text>';
        }

        // 10k goal line
        const yGoal = toY(STEP_GOAL);
        if (yGoal >= pad.top) {
            svg += '<line x1="' + pad.left + '" y1="' + yGoal + '" x2="' + (svgW - pad.right) + '" y2="' + yGoal + '" stroke="#10b981" stroke-width="1.2" stroke-dasharray="5,4" opacity="0.55"/>';
            svg += '<text x="' + (svgW - pad.right + 3) + '" y="' + (yGoal + 4) + '" text-anchor="start" font-size="9" fill="#10b981" opacity="0.75">goal</text>';
        }

        // Area + line
        svg += '<path d="' + areaPath + '" fill="url(#insStepsGrad)"/>';
        svg += '<path d="' + linePath + '" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';

        // Determine tick label indices (up to 7)
        const targetTicks = Math.min(n, 7);
        const tickIndices = new Set(
            targetTicks <= 1
                ? [0]
                : Array.from({ length: targetTicks }, (_, k) => Math.round(k * (n - 1) / (targetTicks - 1)))
        );

        // Data points + value labels
        chartData.forEach((d, i) => {
            const x = toX(i), y = toY(d.steps), isLast = i === n - 1;
            const metGoal = d.steps >= STEP_GOAL;
            const dotColor = metGoal ? '#10b981' : '#94a3b8';
            svg += '<circle cx="' + x + '" cy="' + y + '" r="' + (isLast ? 5 : 3.5) + '" fill="' + (isLast ? '#10b981' : 'white') + '" stroke="' + dotColor + '" stroke-width="2"/>';
            if (tickIndices.has(i)) {
                const stepsLabel = d.steps >= 1000 ? (d.steps / 1000).toFixed(1) + 'k' : d.steps;
                svg += '<text x="' + x + '" y="' + (y - 9) + '" text-anchor="middle" font-size="9.5" font-weight="700" fill="#10b981">' + stepsLabel + '</text>';
            }
        });

        // X-axis date labels
        chartData.forEach((d, i) => {
            if (!tickIndices.has(i)) return;
            const anchor = (i === 0 && n > 1) ? 'start' : (i === n - 1 && n > 1) ? 'end' : 'middle';
            svg += '<text x="' + toX(i) + '" y="' + (svgH - 6) + '" text-anchor="' + anchor + '" font-size="10" fill="#94a3b8">' + d.label + '</text>';
        });
        svg += '</svg>';

        // Stats
        const totalSteps = chartData.reduce((s, d) => s + d.steps, 0);
        const avgSteps = Math.round(totalSteps / chartData.length);
        const todayStr = getLocalDateString();
        const todayRecord = chartData.find(d => d.date === todayStr);
        const todaySteps = todayRecord ? todayRecord.steps : null;
        const daysMetGoal = chartData.filter(d => d.steps >= STEP_GOAL).length;

        const fmt = v => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toString();

        let statsGrid = '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 16px;">'
            + '<div style="background: #f0fdf4; padding: 12px 8px; border-radius: 12px; text-align: center;"><div style="font-size: 1.05rem; font-weight: 800; color: #10b981;">' + fmt(totalSteps) + '</div><div style="font-size: 0.62rem; color: var(--text-muted); margin-top: 3px; font-weight: 700; letter-spacing: 0.5px;">TOTAL</div></div>'
            + '<div style="background: #f0fdf4; padding: 12px 8px; border-radius: 12px; text-align: center;"><div style="font-size: 1.05rem; font-weight: 800; color: #10b981;">' + fmt(avgSteps) + '</div><div style="font-size: 0.62rem; color: var(--text-muted); margin-top: 3px; font-weight: 700; letter-spacing: 0.5px;">DAILY AVG</div></div>'
            + '<div style="background: #f0fdf4; padding: 12px 8px; border-radius: 12px; text-align: center;"><div style="font-size: 1.05rem; font-weight: 800; color: #10b981;">'
            + (todaySteps != null ? fmt(todaySteps) : '—')
            + '</div><div style="font-size: 0.62rem; color: var(--text-muted); margin-top: 3px; font-weight: 700; letter-spacing: 0.5px;">TODAY</div></div>'
            + '</div>';

        statsGrid += '<div style="margin-top: 8px; padding: 8px 12px; background: #f0fdf4; border-radius: 10px; font-size: 0.75rem; color: var(--text-muted);">'
            + '🎯 <strong style="color: #10b981;">' + daysMetGoal + ' / ' + chartData.length + '</strong> days hit the 10,000-step goal'
            + '</div>';

        container.innerHTML = svg + statsGrid;
    }

    function renderInsightsCaloriesBurned(container, nutritionDays, weighIns, wearableCalories, days = 14) {
        if (!container) return;
        const PHYSICS_WINDOW = 7;

        // Build extended date range so physics has a 7-day lookback for every visible date
        const extendedDates = [];
        for (let i = days + PHYSICS_WINDOW - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            extendedDates.push(getLocalDateString(d));
        }
        const dates = extendedDates.slice(PHYSICS_WINDOW); // visible range only

        const nutritionByDate = {};
        nutritionDays.forEach(d => {
            if (d.nutrition_date && d.total_calories) nutritionByDate[d.nutrition_date] = parseFloat(d.total_calories);
        });

        const wearableByDate = {};
        wearableCalories.forEach(d => {
            if (d.date && d.calories_burned) wearableByDate[d.date] = d.calories_burned;
        });

        const weightByDate = _interpolateWeightsForCB(weighIns, extendedDates);

        const physicsLineData = extendedDates.map((date, i) => {
            if (i < PHYSICS_WINDOW) return { date, calories: null };
            const weightToday = weightByDate[date];
            const weightWeekAgo = weightByDate[extendedDates[i - PHYSICS_WINDOW]];
            if (weightToday == null || weightWeekAgo == null) return { date, calories: null };
            let calSum = 0, calCount = 0;
            for (let j = i - PHYSICS_WINDOW + 1; j <= i; j++) {
                const c = nutritionByDate[extendedDates[j]];
                if (c) { calSum += c; calCount++; }
            }
            if (calCount < 4) return { date, calories: null };
            const avgCaloriesIn = calSum / calCount;
            const avgDailyWeightChange = (weightToday - weightWeekAgo) / PHYSICS_WINDOW;
            const physics = Math.round(avgCaloriesIn - avgDailyWeightChange * 7700);
            if (physics < 500 || physics > 7000) return { date, calories: null };
            return { date, calories: physics };
        }).slice(PHYSICS_WINDOW); // trim to visible range

        const watchLineData = dates.map(date => ({
            date,
            calories: wearableByDate[date] || null
        }));

        const hasPhysics = physicsLineData.some(d => d.calories != null);
        const hasWatch = watchLineData.some(d => d.calories != null);

        if (!hasPhysics && !hasWatch) {
            container.innerHTML = '<div style="text-align: center; padding: 28px 16px; color: var(--text-muted); font-size: 0.85rem;"><div style="font-size: 2rem; margin-bottom: 8px; opacity: 0.4;">🔥</div><div>Log meals &amp; weigh-ins regularly to see your actual burn rate. Connect a watch (Fitbit/Oura) for the predicted line.</div></div>';
            return;
        }

        _renderCaloriesBurnedSVG(container, dates, watchLineData, physicsLineData, hasPhysics, hasWatch, nutritionByDate);
    }

window._calBurnedDays = 30;

async function loadCaloriesBurnedGraph(days) {
    if (!window.currentUser) return;
    days = days || window._calBurnedDays || 30;
    window._calBurnedDays = days;

    // Update active nav button
    const nav = document.getElementById('cal-burned-timeframe-nav');
    if (nav) nav.querySelectorAll('button').forEach(b => {
        b.classList.toggle('active', b.textContent.trim() === days + 'D');
    });

    const container = document.getElementById('calories-burned-graph-container');
    if (!container) return;
    container.innerHTML = '<div style="text-align: center; padding: 28px 16px; color: var(--text-muted); font-size: 0.85rem;">Loading...</div>';

    const userId = window.currentUser.id;
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    const sinceDateStr = getLocalDateString(sinceDate);
    const todayStr = getLocalDateString();

    // Fetch nutrition with extra lookback so the 7-day physics window has data
    // even for the earliest displayed dates (e.g. day 1 of a 7D view)
    const PHYSICS_WINDOW = 7;
    const extendedSinceDate = new Date();
    extendedSinceDate.setDate(extendedSinceDate.getDate() - days - PHYSICS_WINDOW);
    const extendedSinceDateStr = getLocalDateString(extendedSinceDate);

    const [nutritionResult, weighInsResult, wearableResult] = await Promise.allSettled([
        db.nutrition.getRange(userId, extendedSinceDateStr, todayStr),
        db.weighIns.getRecent(userId, 60),
        _loadWearableCaloriesForInsights(userId, sinceDateStr)
    ]);

    const nutritionDays = (nutritionResult.status === 'fulfilled' ? nutritionResult.value : null) || [];
    const weighIns = (weighInsResult.status === 'fulfilled' ? weighInsResult.value : null) || [];
    const wearableCals = (wearableResult.status === 'fulfilled' ? wearableResult.value : null) || [];

    // Build extended date array (display range + 7-day lookback for physics)
    const extendedDates = [];
    for (let i = days + PHYSICS_WINDOW - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        extendedDates.push(getLocalDateString(d));
    }
    // Visible date range for the graph
    const dates = extendedDates.slice(PHYSICS_WINDOW);

    // Build lookup maps
    const nutritionByDate = {};
    nutritionDays.forEach(d => {
        if (d.nutrition_date && d.total_calories) nutritionByDate[d.nutrition_date] = parseFloat(d.total_calories);
    });

    const wearableByDate = {};
    wearableCals.forEach(d => {
        if (d.date && d.calories_burned) wearableByDate[d.date] = d.calories_burned;
    });

    // Interpolate weight between weigh-ins to smooth daily fluctuations
    // Use extended date range so lookback data is available
    const weightByDate = _interpolateWeightsForCB(weighIns, extendedDates);

    // Physics line: use 7-day rolling window to cancel out daily water-weight noise.
    // avg_burned = avg_calories_in - (7-day_weight_delta / 7) × 7700
    // Compute over extendedDates then slice to the visible range.
    const physicsLineData = extendedDates.map((date, i) => {
        if (i < PHYSICS_WINDOW) return { date, calories: null };

        const weightToday = weightByDate[date];
        const weightWeekAgo = weightByDate[extendedDates[i - PHYSICS_WINDOW]];
        if (weightToday == null || weightWeekAgo == null) return { date, calories: null };

        // Average calorie intake over the window; require at least 4 of 7 days logged
        let calSum = 0, calCount = 0;
        for (let j = i - PHYSICS_WINDOW + 1; j <= i; j++) {
            const c = nutritionByDate[extendedDates[j]];
            if (c) { calSum += c; calCount++; }
        }
        if (calCount < 4) return { date, calories: null };

        const avgCaloriesIn = calSum / calCount;
        const avgDailyWeightChange = (weightToday - weightWeekAgo) / PHYSICS_WINDOW;
        const physics = Math.round(avgCaloriesIn - avgDailyWeightChange * 7700);
        if (physics < 500 || physics > 7000) return { date, calories: null };
        return { date, calories: physics };
    }).slice(PHYSICS_WINDOW); // trim to visible date range

    // Watch line
    const watchLineData = dates.map(date => ({
        date,
        calories: wearableByDate[date] || null
    }));

    const hasPhysics = physicsLineData.some(d => d.calories != null);
    const hasWatch = watchLineData.some(d => d.calories != null);

    if (!hasPhysics && !hasWatch) {
        container.innerHTML = '<div style="text-align: center; padding: 28px 16px; color: var(--text-muted); font-size: 0.85rem;"><div style="font-size: 2rem; margin-bottom: 8px; opacity: 0.4;">🔥</div><div>Log meals &amp; weigh-ins regularly to see your actual burn rate. Connect a watch (Fitbit/Oura) for the predicted line.</div></div>';
        return;
    }

    _renderCaloriesBurnedSVG(container, dates, watchLineData, physicsLineData, hasPhysics, hasWatch, nutritionByDate);
}

function _interpolateWeightsForCB(weighIns, dates) {
    const sorted = [...weighIns]
        .filter(w => w.weigh_in_date && w.weight_kg)
        .sort((a, b) => a.weigh_in_date.localeCompare(b.weigh_in_date))
        .map(w => ({ date: w.weigh_in_date, weight: parseFloat(w.weight_kg) }));

    const result = {};
    for (const date of dates) {
        let before = null, after = null;
        for (const entry of sorted) {
            if (entry.date <= date) before = entry;
            if (entry.date >= date && !after) after = entry;
        }
        if (!before && !after) continue;
        if (!before) { result[date] = after.weight; continue; }
        if (!after)  { result[date] = before.weight; continue; }
        if (before.date === after.date) { result[date] = before.weight; continue; }
        const totalDays = (new Date(after.date) - new Date(before.date)) / 86400000;
        const daysSinceBefore = (new Date(date) - new Date(before.date)) / 86400000;
        result[date] = before.weight + (after.weight - before.weight) * (daysSinceBefore / totalDays);
    }
    return result;
}

function _renderCaloriesBurnedSVG(container, dates, watchLineData, physicsLineData, hasPhysics, hasWatch, nutritionByDate) {
    const svgW = 380, svgH = 220;
    const pad = { top: 24, right: 16, bottom: 38, left: 46 };
    const cW = svgW - pad.left - pad.right;
    const cH = svgH - pad.top - pad.bottom;
    const n = dates.length;
    nutritionByDate = nutritionByDate || {};

    // Y scale from all visible values
    const allVals = [
        ...watchLineData.filter(d => d.calories).map(d => d.calories),
        ...physicsLineData.filter(d => d.calories).map(d => d.calories)
    ];
    const rawMin = Math.min(...allVals);
    const rawMax = Math.max(...allVals);
    const yPad = Math.max((rawMax - rawMin) * 0.15, 100);
    const yMin = Math.max(0, Math.floor((rawMin - yPad) / 100) * 100);
    const yMax = Math.ceil((rawMax + yPad) / 100) * 100;
    const yRange = yMax - yMin;

    const toX = i => pad.left + (n > 1 ? cW / (n - 1) * i : cW / 2);
    const toY = v => pad.top + cH - ((v - yMin) / yRange) * cH;

    // Y grid ticks
    const yTickSize = yRange > 2000 ? 500 : yRange > 1000 ? 250 : 200;
    const yTicks = [];
    for (let v = Math.ceil(yMin / yTickSize) * yTickSize; v <= yMax; v += yTickSize) yTicks.push(v);

    // X labels — evenly distributed ticks always including first and last
    const targetTicks = n <= 7 ? n : n <= 14 ? Math.ceil(n / 2) : 6;
    const tickIndices = new Set(
        targetTicks <= 1
            ? [0]
            : Array.from({length: targetTicks}, (_, k) => Math.round(k * (n - 1) / (targetTicks - 1)))
    );

    // Bridge gaps: linearly interpolate null values that sit between two
    // known values so the line remains continuous across missed days.
    // Leading/trailing nulls stay null (we don't extrapolate off the edges).
    const bridgeGaps = (lineData) => {
        const bridged = lineData.map(p => ({ date: p.date, calories: p.calories, interpolated: false }));
        const knownIdx = [];
        bridged.forEach((p, i) => { if (p.calories != null) knownIdx.push(i); });
        for (let k = 0; k < knownIdx.length - 1; k++) {
            const a = knownIdx[k], b = knownIdx[k + 1];
            if (b - a <= 1) continue;
            const av = bridged[a].calories, bv = bridged[b].calories;
            for (let j = a + 1; j < b; j++) {
                bridged[j].calories = av + (bv - av) * ((j - a) / (b - a));
                bridged[j].interpolated = true;
            }
        }
        return bridged;
    };

    const bridgedWatch = bridgeGaps(watchLineData);
    const bridgedPhysics = bridgeGaps(physicsLineData);

    let svg = `<svg viewBox="0 0 ${svgW} ${svgH}" style="width:100%;display:block;overflow:visible;">`;
    svg += `<defs>
        <linearGradient id="cbWatchGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.15"/>
            <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.01"/>
        </linearGradient>
        <linearGradient id="cbPhysicsGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f97316" stop-opacity="0.15"/>
            <stop offset="100%" stop-color="#f97316" stop-opacity="0.01"/>
        </linearGradient>
    </defs>`;

    // Grid lines
    yTicks.forEach(v => {
        const y = toY(v);
        svg += `<line x1="${pad.left}" y1="${y}" x2="${svgW - pad.right}" y2="${y}" stroke="#f1f5f9" stroke-width="1"/>`;
        svg += `<text x="${pad.left - 5}" y="${y + 4}" text-anchor="end" font-size="9" fill="#94a3b8">${v >= 1000 ? (v/1000).toFixed(1) + 'k' : v}</text>`;
    });

    // Build SVG path for a line (skips nulls by lifting pen)
    const buildLinePath = (lineData) => {
        let d = '', penDown = false;
        lineData.forEach((pt, i) => {
            if (pt.calories == null) { penDown = false; return; }
            const x = toX(i), y = toY(pt.calories);
            d += penDown ? `L ${x},${y} ` : `M ${x},${y} `;
            penDown = true;
        });
        return d;
    };

    // Build area path (fill under line, segment by segment)
    const buildAreaPath = (lineData) => {
        const bot = pad.top + cH;
        let segments = [], cur = null;
        lineData.forEach((pt, i) => {
            if (pt.calories == null) { if (cur) { segments.push(cur); cur = null; } return; }
            if (!cur) cur = [];
            cur.push({ i, calories: pt.calories });
        });
        if (cur) segments.push(cur);
        return segments.filter(s => s.length >= 2).map(seg => {
            let d = `M ${toX(seg[0].i)},${bot} L ${toX(seg[0].i)},${toY(seg[0].calories)} `;
            seg.slice(1).forEach(pt => d += `L ${toX(pt.i)},${toY(pt.calories)} `);
            return d + `L ${toX(seg[seg.length-1].i)},${bot} Z`;
        }).join(' ');
    };

    // Area fills — use bridged data so fills span single-day gaps smoothly
    if (hasWatch) {
        const a = buildAreaPath(bridgedWatch);
        if (a) svg += `<path d="${a}" fill="url(#cbWatchGrad)"/>`;
    }
    if (hasPhysics) {
        const a = buildAreaPath(bridgedPhysics);
        if (a) svg += `<path d="${a}" fill="url(#cbPhysicsGrad)"/>`;
    }

    // Lines — use bridged data for a continuous line through missed days
    if (hasWatch) {
        const l = buildLinePath(bridgedWatch);
        if (l) svg += `<path d="${l}" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    if (hasPhysics) {
        const l = buildLinePath(bridgedPhysics);
        if (l) svg += `<path d="${l}" fill="none" stroke="#f97316" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="7,4"/>`;
    }

    // Dots — only on REAL data points (interpolated points stay dotless)
    // Each dot is wrapped by an invisible larger hit-circle for tap access.
    const dotStep = n <= 14 ? 1 : 3;
    if (hasWatch) {
        watchLineData.forEach((pt, i) => {
            if (pt.calories == null || (i % dotStep !== 0 && i !== n - 1)) return;
            const x = toX(i), y = toY(pt.calories);
            svg += `<circle class="cb-dot" data-date="${pt.date}" cx="${x}" cy="${y}" r="12" fill="transparent" style="cursor:pointer;"/>`;
            svg += `<circle cx="${x}" cy="${y}" r="3" fill="white" stroke="#3b82f6" stroke-width="2" style="pointer-events:none;"/>`;
        });
    }
    if (hasPhysics) {
        physicsLineData.forEach((pt, i) => {
            if (pt.calories == null || (i % dotStep !== 0 && i !== n - 1)) return;
            const x = toX(i), y = toY(pt.calories);
            svg += `<circle class="cb-dot" data-date="${pt.date}" cx="${x}" cy="${y}" r="12" fill="transparent" style="cursor:pointer;"/>`;
            svg += `<circle cx="${x}" cy="${y}" r="3" fill="white" stroke="#f97316" stroke-width="2" style="pointer-events:none;"/>`;
        });
    }

    // X axis labels
    dates.forEach((date, i) => {
        if (!tickIndices.has(i)) return;
        const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
        const dt = new Date(date + 'T12:00:00');
        const label = dt.toLocaleDateString('en', { month: 'short', day: 'numeric' });
        svg += `<text x="${toX(i)}" y="${svgH - 4}" text-anchor="${anchor}" font-size="9.5" fill="#94a3b8">${label}</text>`;
    });

    svg += '</svg>';

    // Legend — only the watch line label sits above the chart; the actual label lives in its stat box
    let legend = '';
    if (hasWatch) {
        legend = '<div style="display: flex; gap: 16px; margin-bottom: 12px; font-size: 0.72rem; color: var(--text-muted); font-weight: 600; flex-wrap: wrap;">'
            + '<span style="display:flex;align-items:center;gap:5px;"><span style="display:inline-block;width:14px;height:3px;background:#3b82f6;border-radius:2px;"></span> Watch estimate</span>'
            + '</div>';
    }

    // Stats row
    let statsRow = '<div style="display: flex; gap: 10px; margin-top: 14px;">';
    if (hasWatch) {
        const vals = watchLineData.filter(d => d.calories).map(d => d.calories);
        const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
        statsRow += `<div style="flex:1;text-align:center;background:#eff6ff;border-radius:12px;padding:10px 6px;">
            <div style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:3px;font-weight:700;">Watch Avg</div>
            <div style="font-size:1.05rem;font-weight:800;color:#3b82f6;">${avg.toLocaleString()}</div>
            <div style="font-size:0.65rem;color:var(--text-muted);">kcal/day</div>
        </div>`;
    }
    if (hasPhysics) {
        const vals = physicsLineData.filter(d => d.calories).map(d => d.calories);
        const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
        statsRow += `<div style="flex:1;text-align:center;background:#fff7ed;border-radius:12px;padding:10px 6px;">
            <div style="display:flex;align-items:center;justify-content:center;gap:5px;font-size:0.65rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:3px;font-weight:700;"><span style="display:inline-block;width:14px;height:3px;border-top:2.5px dashed #f97316;flex-shrink:0;"></span>Actual Avg</div>
            <div style="font-size:1.05rem;font-weight:800;color:#f97316;">${avg.toLocaleString()}</div>
            <div style="font-size:0.65rem;color:var(--text-muted);">kcal/day</div>
        </div>`;
    }
    statsRow += '</div>';

    // Explainer note
    let note = '';
    if (hasPhysics && hasWatch) {
        note = '<div style="margin-top:12px;padding:10px 12px;background:#f8fafc;border-radius:10px;font-size:0.75rem;color:var(--text-muted);line-height:1.5;">'
            + '<strong style="color:var(--text-main);">🔵 Watch</strong> — your device\'s predicted burn.<br>'
            + '<strong style="color:var(--text-main);">🟠 Actual</strong> — back-calculated from your real weight change + calories logged. The gap shows how accurate your watch is.'
            + '</div>';
    } else if (hasPhysics) {
        note = '<div style="margin-top:12px;padding:10px 12px;background:#f8fafc;border-radius:10px;font-size:0.75rem;color:var(--text-muted);line-height:1.4;">Back-calculated from weight change + food logged. Connect Fitbit or Oura to see the watch estimate alongside it.</div>';
    } else if (hasWatch) {
        note = '<div style="margin-top:12px;padding:10px 12px;background:#f8fafc;border-radius:10px;font-size:0.75rem;color:var(--text-muted);line-height:1.4;">Watch estimate only. Log meals daily and weigh in regularly to unlock the physics-based actual burn line.</div>';
    }

    // Wrap the SVG so the tooltip can be absolutely positioned over the chart area
    const chartWrapper = '<div class="cb-chart-wrapper" style="position:relative;">'
        + svg
        + '<div class="cb-tooltip" style="display:none;position:absolute;pointer-events:none;background:white;border:1px solid #e2e8f0;border-radius:10px;padding:8px 11px;box-shadow:0 4px 14px rgba(15,23,42,0.12);font-size:0.72rem;color:var(--text-main);line-height:1.45;z-index:10;white-space:nowrap;"></div>'
        + '</div>';

    container.innerHTML = legend + chartWrapper + statsRow + note;

    // Build a per-date lookup for tooltip content
    const dataByDate = {};
    watchLineData.forEach(pt => {
        if (!dataByDate[pt.date]) dataByDate[pt.date] = {};
        dataByDate[pt.date].watch = pt.calories;
    });
    physicsLineData.forEach(pt => {
        if (!dataByDate[pt.date]) dataByDate[pt.date] = {};
        dataByDate[pt.date].actual = pt.calories;
    });

    const wrapper = container.querySelector('.cb-chart-wrapper');
    const tooltip = container.querySelector('.cb-tooltip');

    const hideTooltip = () => { if (tooltip) tooltip.style.display = 'none'; };

    const showTooltipForDot = (dot) => {
        const date = dot.getAttribute('data-date');
        const info = dataByDate[date] || {};
        const dt = new Date(date + 'T12:00:00');
        const dateLabel = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const intake = nutritionByDate[date];

        let html = `<div style="font-weight:700;margin-bottom:5px;color:var(--text-main);">${dateLabel}</div>`;
        if (info.watch != null) {
            html += `<div style="display:flex;align-items:center;gap:6px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#3b82f6;"></span>Watch: <strong>${Math.round(info.watch).toLocaleString()}</strong> kcal</div>`;
        }
        if (info.actual != null) {
            html += `<div style="display:flex;align-items:center;gap:6px;margin-top:2px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#f97316;"></span>Actual: <strong>${Math.round(info.actual).toLocaleString()}</strong> kcal</div>`;
        }
        if (intake != null) {
            html += `<div style="color:var(--text-muted);margin-top:4px;font-size:0.68rem;">🥗 Logged: ${Math.round(intake).toLocaleString()} kcal</div>`;
        }
        if (info.watch == null && info.actual == null) {
            html += '<div style="color:var(--text-muted);">No data for this day</div>';
        }

        tooltip.innerHTML = html;
        tooltip.style.display = 'block';

        // Position tooltip above the tapped dot, clamped to wrapper bounds
        const wrapRect = wrapper.getBoundingClientRect();
        const dotRect = dot.getBoundingClientRect();
        let left = dotRect.left + dotRect.width / 2 - wrapRect.left;
        let top = dotRect.top - wrapRect.top - 10;
        tooltip.style.transform = 'translate(-50%, -100%)';
        // Clamp horizontally so tooltip doesn't overflow wrapper edges
        const tRect = tooltip.getBoundingClientRect();
        const halfW = tRect.width / 2;
        if (left - halfW < 4) left = halfW + 4;
        if (left + halfW > wrapRect.width - 4) left = wrapRect.width - halfW - 4;
        // If tooltip would render above the top, flip it below the dot
        if (top - tRect.height < 0) {
            top = dotRect.bottom - wrapRect.top + 10;
            tooltip.style.transform = 'translate(-50%, 0)';
        }
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
    };

    container.querySelectorAll('.cb-dot').forEach(dot => {
        dot.addEventListener('click', e => {
            e.stopPropagation();
            showTooltipForDot(dot);
        });
    });

    // Tap anywhere on the chart that isn't a dot closes the tooltip
    wrapper.addEventListener('click', e => {
        if (!e.target.closest('.cb-dot')) hideTooltip();
    });
}

window.loadCaloriesBurnedGraph = loadCaloriesBurnedGraph;
