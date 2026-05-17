// ===== SPOTIFY INTEGRATION =====
    (function() {
        let spotifyConnected = false;
        let latestSpotifyData = null;

        async function initSpotifyDashboard() {
            if (!window.currentUser) return;
            try {
                const res  = await fetch(`/api/spotify/data?user_id=${window.currentUser.id}`);
                const data = await res.json();
                updateSpotifyDisplay(data);
            } catch (err) {
                console.warn('Spotify data fetch error:', err);
            }
        }

        function updateSpotifyDisplay(data) {
            data = data || { connected: false };
            latestSpotifyData = data;
            spotifyConnected = !!data.connected;
            const btn  = document.getElementById('spotify-connect-btn');
            const text = document.getElementById('spotify-status-text');
            if (!btn) return;

            if (data.connected) {
                btn.textContent  = 'Disconnect';
                btn.setAttribute('aria-label', 'Disconnect Spotify');
                btn.style.background = '#ef4444';
                if (text) {
                    const name = data.display_name ? `${data.display_name} - ` : '';
                    const sync = data.last_sync ? formatTimeAgo(data.last_sync) : 'never';
                    text.textContent = `${name}Last sync: ${sync}`;
                }
            } else {
                btn.textContent  = 'Connect';
                btn.setAttribute('aria-label', 'Connect Spotify');
                btn.style.background = '#1DB954';
                if (text) text.textContent = 'Sync listening habits & music data';
            }
        }

        function refreshSpotifySettingsRow() {
            if (latestSpotifyData) {
                updateSpotifyDisplay(latestSpotifyData);
                return;
            }
            initSpotifyDashboard();
        }

        async function toggleSpotifyConnection() {
            if (!window.currentUser) return;

            if (spotifyConnected) {
                if (!confirm('Disconnect Spotify? Your listening history will be kept.')) return;
                const btn = document.getElementById('spotify-connect-btn');
                btn.disabled = true; btn.textContent = 'Disconnecting...';
                try {
                    await fetch('/api/spotify/disconnect', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: window.currentUser.id }),
                    });
                    updateSpotifyDisplay({ connected: false });
                } catch (err) {
                    console.error('Spotify disconnect error:', err);
                    alert('Failed to disconnect. Please try again.');
                } finally {
                    btn.disabled = false;
                }
            } else {
                window.location.href = `/api/spotify/auth?user_id=${window.currentUser.id}`;
            }
        }

        function checkSpotifyOAuthResult() {
            const params = new URLSearchParams(window.location.search);
            const result = params.get('spotify');
            if (result) {
                window.history.replaceState({}, '', window.location.pathname);
                if (result === 'connected') {
                    showWearableToast('Spotify connected! Syncing your listening data...');
                    setTimeout(() => initSpotifyDashboard(), 2000);
                } else if (result === 'denied') {
                    alert('Spotify connection was cancelled. You can connect anytime from Settings.');
                } else if (result === 'error') {
                    alert('There was a problem connecting to Spotify. Please try again.');
                }
            }
        }

        window.toggleSpotifyConnection = toggleSpotifyConnection;
        window.initSpotifyDashboard    = initSpotifyDashboard;
        window.refreshSpotifySettingsRow = refreshSpotifySettingsRow;

        document.addEventListener('DOMContentLoaded', refreshSpotifySettingsRow);
        window.addEventListener('pbbInitComplete', refreshSpotifySettingsRow);

        initSpotifyDashboard();
        checkSpotifyOAuthResult();
    })();
