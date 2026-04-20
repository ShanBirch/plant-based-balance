// ===== STRAVA INTEGRATION LOGIC =====

    async function initStravaDashboard() {
        if (!window.currentUser) return;
        try {
            const response = await fetch(`/api/strava/data?user_id=${window.currentUser.id}`);
            const data = await response.json();
            if (data.connected) {
                const card = document.getElementById('strava-dashboard-card');
                if (card) card.style.display = 'block';
                const btn = document.getElementById('strava-connect-btn');
                const statusText = document.getElementById('strava-status-text');
                if (btn) { btn.textContent = 'Disconnect'; btn.style.background = '#ef4444'; }
                if (statusText) statusText.textContent = 'Connected and syncing';
                updateStravaDisplay(data);
            } else {
                const card = document.getElementById('strava-dashboard-card');
                if (card) card.style.display = 'none';
                const btn = document.getElementById('strava-connect-btn');
                const statusText = document.getElementById('strava-status-text');
                if (btn) { btn.textContent = 'Connect'; btn.style.background = '#FC4C02'; }
                if (statusText) statusText.textContent = 'Sync workouts, runs & rides';
            }
        } catch (err) { console.warn('Strava init error:', err); }
    }

    function updateStravaDisplay(data) {
        const latest = data.activities && data.activities[0];
        if (latest) {
            const nameEl = document.getElementById('strava-activity-name');
            const typeEl = document.getElementById('strava-activity-type');
            const distEl = document.getElementById('strava-distance');
            const durEl = document.getElementById('strava-duration');
            const hrEl = document.getElementById('strava-heart-rate');
            const calEl = document.getElementById('strava-calories');
            const elevEl = document.getElementById('strava-elevation');

            if (nameEl) nameEl.textContent = latest.name || 'Activity';
            if (typeEl) typeEl.textContent = latest.sport_type || '';

            // Distance: convert meters to km or miles
            if (distEl) {
                const km = ((latest.distance_meters || 0) / 1000).toFixed(1);
                distEl.textContent = km + ' km';
            }
            // Duration: convert seconds to h:mm
            if (durEl) {
                const totalMins = Math.round((latest.moving_time_seconds || 0) / 60);
                const hours = Math.floor(totalMins / 60);
                const mins = totalMins % 60;
                durEl.textContent = hours > 0 ? hours + 'h ' + mins + 'm' : mins + 'm';
            }
            if (hrEl && latest.avg_heart_rate) hrEl.textContent = latest.avg_heart_rate;
            if (calEl) calEl.textContent = (latest.calories || 0).toLocaleString();
            if (elevEl) elevEl.textContent = Math.round(latest.total_elevation_gain || 0) + 'm';
        }
        if (data.last_sync) {
            const syncEl = document.getElementById('strava-last-sync');
            if (syncEl) syncEl.textContent = 'Last synced ' + formatTimeAgo(data.last_sync);
        }
    }

    function toggleStravaConnection() {
        if (!window.currentUser) return;
        const btn = document.getElementById('strava-connect-btn');
        if (btn && btn.textContent.trim() === 'Disconnect') {
            if (confirm('Disconnect your Strava? Your synced data will remain.')) {
                btn.textContent = '...'; btn.disabled = true;
                fetch('/api/strava/disconnect', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: window.currentUser.id }),
                }).then(() => {
                    btn.textContent = 'Connect'; btn.style.background = '#FC4C02'; btn.disabled = false;
                    document.getElementById('strava-status-text').textContent = 'Sync workouts, runs & rides';
                    const card = document.getElementById('strava-dashboard-card');
                    if (card) card.style.display = 'none';
                }).catch(() => { btn.textContent = 'Disconnect'; btn.disabled = false; alert('Failed to disconnect.'); });
            }
        } else {
            // Strava's OAuth page blocks WebView embedding and strava.com is outside
            // Capacitor's allowNavigation list — so in the native app we must open
            // the authorize flow in the system browser. On app resume the
            // visibilitychange handler re-runs initStravaDashboard() to pick up
            // the newly connected state.
            const authUrl = window.location.origin + '/api/strava/auth?user_id=' + window.currentUser.id;
            const isNative = navigator.userAgent.includes('FitGotchi-Native');
            if (isNative) {
                if (window.NativePermissions && window.NativePermissions.openExternalBrowser) {
                    window.NativePermissions.openExternalBrowser(authUrl);
                } else {
                    window.open(authUrl, '_blank');
                }
            } else {
                window.location.href = authUrl;
            }
        }
    }

    function syncStravaNow() {
        if (!window.currentUser) return;
        const btn = document.getElementById('strava-sync-btn');
        if (btn) { btn.style.opacity = '0.5'; btn.style.pointerEvents = 'none'; }
        fetch('/api/strava/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: window.currentUser.id }) })
            .then(r => r.json()).then(() => fetch('/api/strava/data?user_id=' + window.currentUser.id))
            .then(r => r.json()).then(data => { if (data.connected) updateStravaDisplay(data); })
            .catch(err => console.warn('Strava sync error:', err))
            .finally(() => { if (btn) { btn.style.opacity = '1'; btn.style.pointerEvents = 'auto'; } });
    }

    function checkStravaOAuthResult() {
        const params = new URLSearchParams(window.location.search);
        const result = params.get('strava');
        if (result) {
            window.history.replaceState({}, '', window.location.pathname);
            if (result === 'connected') {
                showWearableToast('Strava connected! Syncing your data...');
                setTimeout(() => initStravaDashboard(), 2000);
            } else if (result === 'denied') {
                alert('Strava connection was cancelled. You can connect anytime from Settings.');
            } else if (result === 'error') {
                alert('There was a problem connecting to Strava. Please try again.');
            }
        }
    }

    window.toggleStravaConnection = toggleStravaConnection;
    window.syncStravaNow = syncStravaNow;
    window.initStravaDashboard = initStravaDashboard;
    checkStravaOAuthResult();

    // When the user returns from the external browser after completing Strava
    // OAuth, re-check connection status so the UI updates without a manual reload.
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden && window.currentUser) initStravaDashboard();
    });