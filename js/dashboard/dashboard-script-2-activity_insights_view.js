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

        const fourteenDaysAgoDate = new Date(); fourteenDaysAgoDate.setDate(fourteenDaysAgoDate.getDate() - 14);
        const fourteenDaysAgo = getLocalDateString(fourteenDaysAgoDate);
        const sevenDaysAgoDate = new Date(); sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 7);
        const sevenDaysAgo = getLocalDateString(sevenDaysAgoDate);
        const todayStr = getLocalDateString();

        try {
            const [exerciseHistoryResult, weighInsResult, sleepResult, nutritionResult, wearableCaloriesResult, quizResult, moodResult] = await Promise.allSettled([
                supabaseClient
                    .from('workouts')
                    .select('workout_date, exercise_name, weight_kg, reps')
                    .eq('user_id', userId)
                    .eq('workout_type', 'history')
                    .order('workout_date', { ascending: true }),
                db.weighIns.getRecent(userId, 30),
                _loadWearableSleepForInsights(userId),
                // Nutrition for energy balance (14 days)
                db.nutrition.getRange(userId, fourteenDaysAgo, todayStr),
                // Wearable calories burned (try all sources)
                _loadWearableCaloriesForInsights(userId, fourteenDaysAgo),
                // Quiz results for estimated BMR
                db.quizResults.getLatest(userId),
                // Mood logs (last 7 days)
                (async () => {
                    const { data } = await supabaseClient
                        .from('mood_logs').select('*').eq('user_id', userId)
                        .gte('log_date', sevenDaysAgo).order('log_date', { ascending: true });
                    return data;
                })()
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

            const strengthGains = _computeStrengthGains(exerciseHistory);

            renderStrengthProgress(strengthGains);
            renderInsightsCorrelations(strengthGains, weighIns, sleepData);
            renderInsightsSleep(sleepData);
            renderEnergyBalance(nutritionDays, wearableCalories, weighIns, quizData);
            renderMoodTrends(moodLogs);
            renderVolumeGraph(userId);

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

    // Render Energy Balance section with real BMR calculation
    function renderEnergyBalance(nutritionDays, wearableCalories, weighIns, quizData) {
        const container = document.getElementById('insights-energy-balance-container');
        if (!container) return;

        const trackedDays = nutritionDays.filter(d => d.total_calories && d.total_calories > 0);
        const sortedWeighIns = [...weighIns].sort((a, b) => (a.weigh_in_date || '').localeCompare(b.weigh_in_date || ''));

        // Need minimum data
        if (trackedDays.length < 7 || sortedWeighIns.length < 2) {
            container.innerHTML = '<div style="text-align: center; padding: 16px; color: var(--text-muted); font-size: 0.85rem;">Keep tracking meals and weigh-ins — need 7+ nutrition days & 2+ weigh-ins to calculate your real energy balance.</div>';
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
        html += '<div style="font-size: 0.7rem; opacity: 0.75;">per day (' + trackedDays.length + ' days)</div>';
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

    function renderInsightsSleep(sleepData) {
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

        const rawRecords = sleepData.records.slice(0, 14).reverse();

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

        chartData.forEach((d, i) => {
            const x = toX(i), yT = toY(d.totalHrs), isLast = i === n - 1;
            svg += '<circle cx="' + x + '" cy="' + yT + '" r="' + (isLast ? 5 : 3.5) + '" fill="' + (isLast ? '#6366f1' : 'white') + '" stroke="#6366f1" stroke-width="2"/>';
            if (n <= 7 || i % 2 === 0 || isLast)
                svg += '<text x="' + x + '" y="' + (yT - 9) + '" text-anchor="middle" font-size="9.5" font-weight="700" fill="#6366f1">' + d.totalHrs.toFixed(1) + 'h</text>';
            if (hasStages) {
                svg += '<circle cx="' + x + '" cy="' + toY(d.deepHrs) + '" r="2.5" fill="#312e81" opacity="0.85"/>';
                svg += '<circle cx="' + x + '" cy="' + toY(d.remHrs)  + '" r="2.5" fill="#06b6d4" opacity="0.85"/>';
            }
        });

        chartData.forEach((d, i) => {
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

        // Dots + value labels
        volumeKg.forEach((v, i) => {
            const x = toX(i), y = toY(v);
            const isLast = i === n - 1;
            svg += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (isLast ? 5 : 3.5) + '" fill="' + (isLast ? '#3b82f6' : 'white') + '" stroke="#3b82f6" stroke-width="2"/>';
            // Show value label for last point and every other point (avoid crowding)
            if (isLast || n <= 6 || i % 2 === 0) {
                const displayVal = preferLbs ? (v * 2.20462) : v;
                const valLabel = displayVal >= 1000 ? (displayVal / 1000).toFixed(1) + 'k' : Math.round(displayVal).toString();
                svg += '<text x="' + x.toFixed(1) + '" y="' + (y - 9).toFixed(1) + '" text-anchor="middle" font-size="9" font-weight="700" fill="#3b82f6">' + valLabel + '</text>';
            }
        });

        // X-axis labels (show every other if crowded)
        labels.forEach((lbl, i) => {
            const show = n <= 6 || i === 0 || i === n - 1 || i % 2 === 0;
            if (!show) return;
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

    window.openInsightsView   = openInsightsView;
    window.closeInsightsView  = closeInsightsView;
