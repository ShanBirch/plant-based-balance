// ===== OURA RING INTEGRATION LOGIC =====

    async function initOuraDashboard() {
        if (!window.currentUser) return;
        try {
            const response = await fetch(`/api/oura/data?user_id=${window.currentUser.id}`);
            const data = await response.json();
            if (data.connected) {
                const card = document.getElementById('oura-dashboard-card');
                if (card) card.style.display = 'block';
                const btn = document.getElementById('oura-connect-btn');
                const statusText = document.getElementById('oura-status-text');
                if (btn) { btn.textContent = 'Disconnect'; btn.style.background = '#ef4444'; }
                if (statusText) statusText.textContent = 'Connected and syncing';
                updateOuraDisplay(data);
            } else {
                const card = document.getElementById('oura-dashboard-card');
                if (card) card.style.display = 'none';
                const btn = document.getElementById('oura-connect-btn');
                const statusText = document.getElementById('oura-status-text');
                if (btn) { btn.textContent = 'Connect'; btn.style.background = '#c4a862'; }
                if (statusText) statusText.textContent = 'Sync readiness, sleep & activity';
            }
        } catch (err) { console.warn('Oura init error:', err); }
    }

    function updateOuraDisplay(data) {
        const todayActivity = data.activity && data.activity[0];
        if (todayActivity) {
            const stepsEl = document.getElementById('oura-steps');
            const caloriesEl = document.getElementById('oura-calories');
            if (stepsEl) stepsEl.textContent = (todayActivity.steps || 0).toLocaleString();
            if (caloriesEl) caloriesEl.textContent = (todayActivity.active_calories || 0).toLocaleString();
            checkStepXpReward(todayActivity.steps);
        }
        const todaySleep = data.sleep && data.sleep[0];
        if (todaySleep) {
            const sleepEl = document.getElementById('oura-sleep');
            const scoreEl = document.getElementById('oura-sleep-score');
            if (sleepEl) {
                const hours = Math.floor((todaySleep.total_sleep_minutes || 0) / 60);
                const mins = (todaySleep.total_sleep_minutes || 0) % 60;
                sleepEl.textContent = hours + 'h ' + mins + 'm';
            }
            if (scoreEl && todaySleep.sleep_score) scoreEl.textContent = todaySleep.sleep_score;
        }
        const todayReadiness = data.readiness && data.readiness[0];
        if (todayReadiness && todayReadiness.readiness_score) {
            const readyEl = document.getElementById('oura-readiness');
            if (readyEl) readyEl.textContent = todayReadiness.readiness_score;
        }
        if (data.last_sync) {
            const syncEl = document.getElementById('oura-last-sync');
            if (syncEl) syncEl.textContent = 'Last synced ' + formatTimeAgo(data.last_sync);
        }
    }

    function toggleOuraConnection() {
        if (!window.currentUser) return;
        const btn = document.getElementById('oura-connect-btn');
        if (btn && btn.textContent.trim() === 'Disconnect') {
            if (confirm('Disconnect your Oura Ring? Your synced data will remain.')) {
                btn.textContent = '...'; btn.disabled = true;
                fetch('/api/oura/disconnect', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: window.currentUser.id }),
                }).then(() => {
                    btn.textContent = 'Connect'; btn.style.background = '#c4a862'; btn.disabled = false;
                    document.getElementById('oura-status-text').textContent = 'Sync readiness, sleep & activity';
                    const card = document.getElementById('oura-dashboard-card');
                    if (card) card.style.display = 'none';
                }).catch(() => { btn.textContent = 'Disconnect'; btn.disabled = false; alert('Failed to disconnect.'); });
            }
        } else {
            window.location.href = '/api/oura/auth?user_id=' + window.currentUser.id;
        }
    }

    function syncOuraNow() {
        if (!window.currentUser) return;
        const btn = document.getElementById('oura-sync-btn');
        if (btn) { btn.style.opacity = '0.5'; btn.style.pointerEvents = 'none'; }
        fetch('/api/oura/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: window.currentUser.id }) })
            .then(r => r.json()).then(() => fetch('/api/oura/data?user_id=' + window.currentUser.id))
            .then(r => r.json()).then(data => {
                if (data.connected) updateOuraDisplay(data);
                // Refresh challenge progress (sleep + steps challenges use Oura data)
                if (typeof refreshChallengeProgress === 'function') refreshChallengeProgress();
            })
            .catch(err => console.warn('Oura sync error:', err))
            .finally(() => { if (btn) { btn.style.opacity = '1'; btn.style.pointerEvents = 'auto'; } });
    }

    function checkOuraOAuthResult() {
        const params = new URLSearchParams(window.location.search);
        const result = params.get('oura');
        if (result) {
            window.history.replaceState({}, '', window.location.pathname);
            if (result === 'connected') {
                showWearableToast('Oura Ring connected! Syncing your data...');
                setTimeout(() => initOuraDashboard(), 2000);
            } else if (result === 'denied') {
                alert('Oura connection was cancelled. You can connect anytime from Settings.');
            } else if (result === 'error') {
                alert('There was a problem connecting to Oura. Please try again.');
            }
        }
    }

    window.toggleOuraConnection = toggleOuraConnection;
    window.syncOuraNow = syncOuraNow;
    window.initOuraDashboard = initOuraDashboard;
    checkOuraOAuthResult();