// ===== WHOOP INTEGRATION LOGIC =====

    async function initWhoopDashboard() {
        if (!window.currentUser) return;
        try {
            const response = await fetch(`/api/whoop/data?user_id=${window.currentUser.id}`);
            const data = await response.json();
            if (data.connected) {
                const card = document.getElementById('whoop-dashboard-card');
                if (card) card.style.display = 'block';
                const btn = document.getElementById('whoop-connect-btn');
                const statusText = document.getElementById('whoop-status-text');
                if (btn) { btn.textContent = 'Disconnect'; btn.style.background = '#ef4444'; }
                if (statusText) statusText.textContent = 'Connected and syncing';
                updateWhoopDisplay(data);
            } else {
                const card = document.getElementById('whoop-dashboard-card');
                if (card) card.style.display = 'none';
                const btn = document.getElementById('whoop-connect-btn');
                const statusText = document.getElementById('whoop-status-text');
                if (btn) { btn.textContent = 'Connect'; btn.style.background = '#1a1a1a'; }
                if (statusText) statusText.textContent = 'Sync recovery, strain & sleep';
            }
        } catch (err) { console.warn('WHOOP init error:', err); }
    }

    function updateWhoopDisplay(data) {
        const todayRecovery = data.recovery && data.recovery[0];
        if (todayRecovery) {
            const recEl = document.getElementById('whoop-recovery');
            const hrEl = document.getElementById('whoop-resting-hr');
            const hrvEl = document.getElementById('whoop-hrv');
            if (recEl) recEl.textContent = (todayRecovery.recovery_score || 0) + '%';
            if (hrEl && todayRecovery.resting_heart_rate) hrEl.textContent = todayRecovery.resting_heart_rate;
            if (hrvEl && todayRecovery.hrv_rmssd) hrvEl.textContent = Math.round(todayRecovery.hrv_rmssd);
        }
        const todaySleep = data.sleep && data.sleep[0];
        if (todaySleep) {
            const sleepEl = document.getElementById('whoop-sleep');
            if (sleepEl) {
                const hours = Math.floor((todaySleep.duration_minutes || 0) / 60);
                const mins = (todaySleep.duration_minutes || 0) % 60;
                sleepEl.textContent = hours + 'h ' + mins + 'm';
            }
        }
        const todayWorkout = data.workouts && data.workouts[0];
        if (todayWorkout) {
            const strainEl = document.getElementById('whoop-strain');
            if (strainEl) strainEl.textContent = (todayWorkout.strain || 0).toFixed(1);
        }
        if (data.last_sync) {
            const syncEl = document.getElementById('whoop-last-sync');
            if (syncEl) syncEl.textContent = 'Last synced ' + formatTimeAgo(data.last_sync);
        }
    }

    function toggleWhoopConnection() {
        if (!window.currentUser) return;
        const btn = document.getElementById('whoop-connect-btn');
        if (btn && btn.textContent.trim() === 'Disconnect') {
            if (confirm('Disconnect your WHOOP? Your synced data will remain.')) {
                btn.textContent = '...'; btn.disabled = true;
                fetch('/api/whoop/disconnect', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: window.currentUser.id }),
                }).then(() => {
                    btn.textContent = 'Connect'; btn.style.background = '#1a1a1a'; btn.disabled = false;
                    document.getElementById('whoop-status-text').textContent = 'Sync recovery, strain & sleep';
                    const card = document.getElementById('whoop-dashboard-card');
                    if (card) card.style.display = 'none';
                }).catch(() => { btn.textContent = 'Disconnect'; btn.disabled = false; alert('Failed to disconnect.'); });
            }
        } else {
            window.location.href = '/api/whoop/auth?user_id=' + window.currentUser.id;
        }
    }

    function syncWhoopNow() {
        if (!window.currentUser) return;
        const btn = document.getElementById('whoop-sync-btn');
        if (btn) { btn.style.opacity = '0.5'; btn.style.pointerEvents = 'none'; }
        fetch('/api/whoop/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: window.currentUser.id }) })
            .then(r => r.json()).then(() => fetch('/api/whoop/data?user_id=' + window.currentUser.id))
            .then(r => r.json()).then(data => {
                if (data.connected) updateWhoopDisplay(data);
                // Refresh challenge progress (sleep challenge uses WHOOP data)
                if (typeof refreshChallengeProgress === 'function') refreshChallengeProgress();
            })
            .catch(err => console.warn('WHOOP sync error:', err))
            .finally(() => { if (btn) { btn.style.opacity = '1'; btn.style.pointerEvents = 'auto'; } });
    }

    function checkWhoopOAuthResult() {
        const params = new URLSearchParams(window.location.search);
        const result = params.get('whoop');
        if (result) {
            window.history.replaceState({}, '', window.location.pathname);
            if (result === 'connected') {
                showWearableToast('WHOOP connected! Syncing your data...');
                setTimeout(() => initWhoopDashboard(), 2000);
            } else if (result === 'denied') {
                alert('WHOOP connection was cancelled. You can connect anytime from Settings.');
            } else if (result === 'error') {
                alert('There was a problem connecting to WHOOP. Please try again.');
            }
        }
    }

    window.toggleWhoopConnection = toggleWhoopConnection;
    window.syncWhoopNow = syncWhoopNow;
    window.initWhoopDashboard = initWhoopDashboard;
    checkWhoopOAuthResult();