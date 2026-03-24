// ===== YOUR PERFORMANCE CARD LOGIC =====

    /**
     * Opens the progress view from the home page performance card
     */
    function openProgressFromHome() {
        window._progressViewOrigin = 'home';
        // Use hideAllAppViews if available, otherwise manual hide
        if (typeof hideAllAppViews === 'function') {
            hideAllAppViews();
        }

        const viewEl = document.getElementById('view-progress');
        if (viewEl) {
            viewEl.style.display = 'block';
            viewEl.scrollTop = 0;
            window.scrollTo(0, 0);
        }

        // Hide bottom nav for full-screen progress view
        const bottomNav = document.querySelector('.bottom-nav');
        if (bottomNav) {
            bottomNav.style.display = 'none';
        }

        // Initialize progress data
        if (typeof initProgressView === 'function') {
            initProgressView();
        }

        // Push navigation state for back button support
        if (typeof pushNavigationState === 'function') {
            pushNavigationState('view-progress', () => closeProgressFromHome());
        }
    }

    function closeProgressFromHome() {
        const viewEl = document.getElementById('view-progress');
        if (viewEl) {
            viewEl.style.display = 'none';
        }
        switchAppTab('dashboard');
    }

    /**
     * Load performance card data (workouts this week, body weight, sleep)
     */
    async function initPerformanceCard() {
        if (!window.currentUser) return;

        const userId = window.currentUser.id;

        // --- Workouts this week ---
        try {
            const now = new Date();
            const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
            const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            const monday = new Date(now);
            monday.setDate(now.getDate() - mondayOffset);
            const mondayStr = getLocalDateString(monday);

            const { data: weekWorkouts, error } = await supabaseClient
                .from('workouts')
                .select('workout_date')
                .eq('user_id', userId)
                .eq('workout_type', 'history')
                .gte('workout_date', mondayStr);

            if (!error && weekWorkouts) {
                const uniqueDates = new Set(weekWorkouts.map(w => w.workout_date));
                const count = uniqueDates.size;
                const el = document.getElementById('perf-workouts-value');
                if (el) el.textContent = count;
            }
        } catch (e) {
            console.warn('Performance card - workouts error:', e);
        }

        // --- Body Weight ---
        try {
            const recentWeighIns = await db.weighIns.getRecent(userId, 7);

            if (recentWeighIns && recentWeighIns.length > 0) {
                const latest = recentWeighIns[0];
                const preferLbs = localStorage.getItem('weightUnitPreference') === 'lbs';
                let displayWeight;
                let unit;

                if (preferLbs) {
                    displayWeight = (latest.weight_kg * 2.20462).toFixed(0);
                    unit = 'lbs';
                } else {
                    displayWeight = parseFloat(latest.weight_kg).toFixed(1);
                    unit = 'kg';
                }

                const weightEl = document.getElementById('perf-weight-value');
                if (weightEl) weightEl.textContent = displayWeight;

                const subEl = document.getElementById('perf-weight-sub');
                if (subEl) {
                    if (recentWeighIns.length >= 2) {
                        const prev = recentWeighIns[1];
                        const diff = preferLbs
                            ? ((latest.weight_kg - prev.weight_kg) * 2.20462).toFixed(1)
                            : (latest.weight_kg - prev.weight_kg).toFixed(1);
                        const sign = diff > 0 ? '+' : '';
                        subEl.textContent = sign + diff + ' ' + unit;
                        subEl.style.color = diff < 0 ? '#10b981' : diff > 0 ? '#ef4444' : '#8b5cf6';
                    } else {
                        subEl.textContent = unit;
                    }
                }
            }
        } catch (e) {
            console.warn('Performance card - weight error:', e);
        }

        // --- Sleep (from wearable data if available) ---
        try {
            // Check each wearable source for sleep data
            let sleepFound = false;

            // Try Fitbit
            if (!sleepFound) {
                try {
                    const resp = await fetch('/api/fitbit/data?user_id=' + userId);
                    const data = await resp.json();
                    if (data.connected && data.sleep && data.sleep[0]) {
                        const mins = data.sleep[0].duration_minutes || 0;
                        const hours = Math.floor(mins / 60);
                        const m = mins % 60;
                        const sleepEl = document.getElementById('perf-sleep-value');
                        if (sleepEl) sleepEl.innerHTML = hours + '<span style="font-size:0.8rem;font-weight:600;">h</span> ' + m + '<span style="font-size:0.8rem;font-weight:600;">m</span>';
                        sleepFound = true;
                    }
                } catch (e) { /* not connected */ }
            }

            // Try WHOOP
            if (!sleepFound) {
                try {
                    const resp = await fetch('/api/whoop/data?user_id=' + userId);
                    const data = await resp.json();
                    if (data.connected && data.sleep && data.sleep[0]) {
                        const mins = data.sleep[0].duration_minutes || 0;
                        const hours = Math.floor(mins / 60);
                        const m = mins % 60;
                        const sleepEl = document.getElementById('perf-sleep-value');
                        if (sleepEl) sleepEl.innerHTML = hours + '<span style="font-size:0.8rem;font-weight:600;">h</span> ' + m + '<span style="font-size:0.8rem;font-weight:600;">m</span>';
                        sleepFound = true;
                    }
                } catch (e) { /* not connected */ }
            }

            // Try Oura
            if (!sleepFound) {
                try {
                    const resp = await fetch('/api/oura/data?user_id=' + userId);
                    const data = await resp.json();
                    if (data.connected && data.sleep && data.sleep[0]) {
                        const mins = data.sleep[0].total_sleep_minutes || 0;
                        const hours = Math.floor(mins / 60);
                        const m = mins % 60;
                        const sleepEl = document.getElementById('perf-sleep-value');
                        if (sleepEl) sleepEl.innerHTML = hours + '<span style="font-size:0.8rem;font-weight:600;">h</span> ' + m + '<span style="font-size:0.8rem;font-weight:600;">m</span>';
                        sleepFound = true;
                    }
                } catch (e) { /* not connected */ }
            }

            if (!sleepFound) {
                const subEl = document.getElementById('perf-sleep-sub');
                if (subEl) subEl.textContent = 'connect device';
            }
        } catch (e) {
            console.warn('Performance card - sleep error:', e);
        }

        // --- Body Fat % from latest weigh-in ---
        try {
            const latest = await db.weighIns.getLatest(userId);
            if (latest && latest.body_fat_pct) {
                const bfEl = document.getElementById('perf-bf-sub');
                if (bfEl) {
                    bfEl.textContent = latest.body_fat_pct.toFixed(1) + '% BF';
                    bfEl.style.display = 'block';
                }
            }
        } catch (e) {
            console.warn('Performance card - body fat error:', e);
        }

        // --- Fitbit performance card (dedicated card above Your Progress) ---
        try {
            const connectedEl  = document.getElementById('fitbit-perf-connected');
            const disconnectedEl = document.getElementById('fitbit-perf-disconnected');

            // Always show the disconnected prompt first so the card is never invisible
            if (disconnectedEl) disconnectedEl.style.display = 'flex';

            const resp = await fetch('/api/fitbit/data?user_id=' + userId);
            if (resp.ok) {
                const data = await resp.json();
                if (data.connected) {
                    const activity = data.activity && data.activity[0];
                    const hr = data.heart_rate && data.heart_rate[0];

                    // Switch to connected view
                    if (disconnectedEl) disconnectedEl.style.display = 'none';
                    if (connectedEl) connectedEl.style.display = 'block';

                    const stepsEl = document.getElementById('fitbit-perf-steps');
                    if (stepsEl && activity && activity.steps != null) {
                        stepsEl.textContent = (activity.steps || 0).toLocaleString();
                    }

                    const calsEl = document.getElementById('fitbit-perf-cals');
                    if (calsEl && activity && activity.calories_burned) {
                        calsEl.textContent = Math.round(activity.calories_burned).toLocaleString();
                    }

                    const hrEl = document.getElementById('fitbit-perf-hr');
                    if (hrEl && hr && hr.resting_heart_rate) {
                        hrEl.textContent = hr.resting_heart_rate + ' bpm';
                    }

                    const activeEl = document.getElementById('fitbit-perf-active');
                    if (activeEl && activity && activity.active_minutes != null) {
                        activeEl.textContent = activity.active_minutes + ' min';
                    }

                    const syncLabel = document.getElementById('fitbit-perf-sync-label');
                    if (syncLabel && data.last_sync) {
                        const mins = Math.round((Date.now() - new Date(data.last_sync)) / 60000);
                        syncLabel.textContent = mins < 60 ? mins + 'm ago' : Math.round(mins/60) + 'h ago';
                    }
                }
            }
        } catch (e) {
            // On error still show disconnected prompt so card is visible
            const disconnectedEl = document.getElementById('fitbit-perf-disconnected');
            if (disconnectedEl) disconnectedEl.style.display = 'flex';
            console.warn('Performance card - Fitbit error:', e);
        }
    }

    window.initPerformanceCard = initPerformanceCard;
    window.openProgressFromHome = openProgressFromHome;
    window.closeProgressFromHome = closeProgressFromHome;