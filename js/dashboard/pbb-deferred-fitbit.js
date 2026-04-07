// ===== FITBIT INTEGRATION LOGIC =====

    /**
     * Check Fitbit connection status and load data
     */
    async function initFitbitDashboard() {
        if (!window.currentUser) return;

        try {
            const response = await fetch(`/api/fitbit/data?user_id=${window.currentUser.id}`);
            const data = await response.json();

            if (data.connected) {
                // Update settings button
                const btn = document.getElementById('fitbit-connect-btn');
                const statusText = document.getElementById('fitbit-status-text');
                if (btn) {
                    btn.textContent = 'Disconnect';
                    btn.style.background = '#ef4444';
                }
                if (statusText) statusText.textContent = 'Connected and syncing';
            } else {
                // Reset settings button
                const btn = document.getElementById('fitbit-connect-btn');
                const statusText = document.getElementById('fitbit-status-text');
                if (btn) {
                    btn.textContent = 'Connect';
                    btn.style.background = '#00B0B9';
                }
                if (statusText) statusText.textContent = 'Sync steps, sleep & heart rate';
            }
        } catch (err) {
            console.warn('Fitbit init error:', err);
        }
    }

    /**
     * Award 2 XP when the user reaches 10,000 steps in a day.
     * Only fires once per calendar day (tracked via localStorage).
     */
    window.checkStepXpReward = async function checkStepXpReward(steps) {
        if (!steps || steps < 10000) return;
        if (!window.currentUser?.id || !window.supabaseClient) return;

        const today = new Date().toISOString().split('T')[0];
        const storageKey = 'step_xp_awarded_' + today;
        if (localStorage.getItem(storageKey)) return; // already awarded today

        try {
            const { data: currentPoints } = await window.supabaseClient
                .from('user_points')
                .select('lifetime_points')
                .eq('user_id', window.currentUser.id)
                .maybeSingle();

            if (currentPoints) {
                await window.supabaseClient
                    .from('user_points')
                    .update({ lifetime_points: (currentPoints.lifetime_points || 0) + 2 })
                    .eq('user_id', window.currentUser.id);
            } else {
                await window.supabaseClient
                    .from('user_points')
                    .insert({ user_id: window.currentUser.id, lifetime_points: 2, current_points: 0 });
            }

            localStorage.setItem(storageKey, '1');
            if (typeof triggerXPBarRainbow === 'function') triggerXPBarRainbow();
            if (typeof refreshLevelDisplay === 'function') refreshLevelDisplay();
            console.log('[Steps] 10k steps reached — awarded 2 XP');
        } catch (err) {
            console.warn('[Steps] XP award error:', err);
        }
    }

    /**
     * Update the Fitbit display cards with data
     */
    function updateFitbitDisplay(data) {
        // Today's activity
        const todayActivity = data.activity && data.activity[0];
        if (todayActivity) {
            const stepsEl = document.getElementById('fitbit-steps');
            const activeMinsEl = document.getElementById('fitbit-active-mins');
            const caloriesEl = document.getElementById('fitbit-calories');

            if (stepsEl) stepsEl.textContent = (todayActivity.steps || 0).toLocaleString();
            if (activeMinsEl) activeMinsEl.textContent = (todayActivity.active_minutes || 0) + ' min';
            if (caloriesEl) caloriesEl.textContent = (todayActivity.calories_burned || 0).toLocaleString();
            checkStepXpReward(todayActivity.steps);
        }

        // Today's sleep
        const todaySleep = data.sleep && data.sleep[0];
        if (todaySleep) {
            const sleepEl = document.getElementById('fitbit-sleep');
            if (sleepEl) {
                const hours = Math.floor((todaySleep.duration_minutes || 0) / 60);
                const mins = (todaySleep.duration_minutes || 0) % 60;
                sleepEl.textContent = hours + 'h ' + mins + 'm';
            }
        }

        // Today's heart rate
        const todayHR = data.heart_rate && data.heart_rate[0];
        if (todayHR && todayHR.resting_heart_rate) {
            const hrEl = document.getElementById('fitbit-heart-rate');
            if (hrEl) hrEl.textContent = todayHR.resting_heart_rate;
        }

        // Last sync time
        if (data.last_sync) {
            const syncEl = document.getElementById('fitbit-last-sync');
            if (syncEl) {
                const syncDate = new Date(data.last_sync);
                const now = new Date();
                const diffMins = Math.floor((now - syncDate) / 60000);
                let timeAgo;
                if (diffMins < 1) timeAgo = 'Just now';
                else if (diffMins < 60) timeAgo = diffMins + 'm ago';
                else if (diffMins < 1440) timeAgo = Math.floor(diffMins / 60) + 'h ago';
                else timeAgo = Math.floor(diffMins / 1440) + 'd ago';
                syncEl.textContent = 'Last synced ' + timeAgo;
            }
        }
    }

    /**
     * Connect or disconnect Fitbit
     */
    function toggleFitbitConnection() {
        if (!window.currentUser) return;

        const btn = document.getElementById('fitbit-connect-btn');
        if (btn && btn.textContent.trim() === 'Disconnect') {
            // Disconnect
            if (confirm('Disconnect your Fitbit? Your synced data will remain.')) {
                btn.textContent = '...';
                btn.disabled = true;
                fetch('/api/fitbit/disconnect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: window.currentUser.id }),
                }).then(() => {
                    btn.textContent = 'Connect';
                    btn.style.background = '#00B0B9';
                    btn.disabled = false;
                    const statusText = document.getElementById('fitbit-status-text');
                    if (statusText) statusText.textContent = 'Sync steps, sleep & heart rate';
                    const card = document.getElementById('fitbit-dashboard-card');
                    if (card) card.style.display = 'none';
                }).catch(() => {
                    btn.textContent = 'Disconnect';
                    btn.disabled = false;
                    alert('Failed to disconnect. Please try again.');
                });
            }
        } else {
            // Connect - redirect to Fitbit OAuth
            window.location.href = '/api/fitbit/auth?user_id=' + window.currentUser.id;
        }
    }

    /**
     * Manual sync button
     */
    function syncFitbitNow() {
        if (!window.currentUser) return;

        const btn = document.getElementById('fitbit-sync-btn');
        if (btn) {
            btn.style.opacity = '0.5';
            btn.style.pointerEvents = 'none';
        }

        fetch('/api/fitbit/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: window.currentUser.id }),
        }).then(r => r.json()).then(() => {
            // Refresh display
            return fetch('/api/fitbit/data?user_id=' + window.currentUser.id);
        }).then(r => r.json()).then(data => {
            if (data.connected) updateFitbitDisplay(data);
            // Refresh challenge progress (steps/sleep challenges may use Fitbit data)
            if (typeof refreshChallengeProgress === 'function') refreshChallengeProgress();
        }).catch(err => {
            console.warn('Fitbit sync error:', err);
        }).finally(() => {
            if (btn) {
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
            }
        });
    }

    /**
     * Handle Fitbit OAuth redirect results
     */
    function checkFitbitOAuthResult() {
        const params = new URLSearchParams(window.location.search);
        const fitbitResult = params.get('fitbit');

        if (fitbitResult) {
            // Clean URL
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, '', cleanUrl);

            if (fitbitResult === 'connected') {
                // Show success message
                const toast = document.createElement('div');
                toast.style.cssText = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); background:#10b981; color:white; padding:14px 24px; border-radius:12px; font-weight:600; z-index:99999; box-shadow:0 4px 12px rgba(0,0,0,0.15); font-size:0.9rem;';
                toast.textContent = 'Fitbit connected! Syncing your data...';
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 4000);

                // Refresh Fitbit data
                setTimeout(() => initFitbitDashboard(), 2000);
            } else if (fitbitResult === 'denied') {
                alert('Fitbit connection was cancelled. You can connect anytime from Settings.');
            } else if (fitbitResult === 'error') {
                alert('There was a problem connecting to Fitbit. Please try again.');
            }
        }
    }

    // Make functions globally available
    window.toggleFitbitConnection = toggleFitbitConnection;
    window.syncFitbitNow = syncFitbitNow;
    window.initFitbitDashboard = initFitbitDashboard;

    // Check OAuth result on page load
    checkFitbitOAuthResult();