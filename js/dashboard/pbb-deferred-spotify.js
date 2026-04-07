// ===== SPOTIFY NOW PLAYING LOGIC =====
    (function() {
        let _pollInterval  = null;
        let _lastTrackId   = null;
        let _progressTimer = null;
        let _progressMs    = 0;
        let _durationMs    = 1;

        function formatTime(ms) {
            const s   = Math.floor(ms / 1000);
            const min = Math.floor(s / 60);
            const sec = s % 60;
            return `${min}:${sec.toString().padStart(2, '0')}`;
        }

        function setProgressBars(currentMs, totalMs) {
            const pct  = Math.min((currentMs / totalMs) * 100, 100);
            const bar  = document.getElementById('snp-progress');
            if (bar) bar.style.width = pct + '%';
        }


        // Check if any calorie tracker / meal flow modal is active
        // Exposed globally so other script blocks can use it
        window.isMealFlowActive = function() {
            const camModal = document.getElementById('unified-camera-modal');
            if (camModal && camModal.style.display !== 'none' && camModal.style.display !== '') return true;
            const previewModal = document.getElementById('meal-preview-modal');
            if (previewModal && previewModal.style.display !== 'none' && previewModal.style.display !== '') return true;
            const inputModal = document.getElementById('meal-input-modal');
            if (inputModal && inputModal.classList.contains('visible')) return true;
            return false;
        };
        var isMealFlowActive = window.isMealFlowActive;

        function updatePlayerUI(data) {
            const widget = document.getElementById('spotify-now-playing');
            if (!widget) return;


            if (!data || !data.playing || !data.track) {
                widget.style.display = 'none';
                clearInterval(_progressTimer);
                window._snpPlaying = false;
                return;
            }

            const { track } = data;
            window._snpPlaying      = data.playing;
            window._snpTrackUrl     = track.spotify_url || null;
            window._snpCurrentTrack = track;

            // Show mini widget (but not while any calorie tracker modal is open)
            if (isMealFlowActive()) {
                widget.style.display = 'none';
            } else {
                widget.style.display = 'block';
            }

            // Mini player: track name & artist
            const miniTrack  = document.getElementById('snp-track');
            const miniArtist = document.getElementById('snp-artist');
            if (miniTrack)  miniTrack.textContent  = track.name;
            if (miniArtist) miniArtist.textContent = track.artist;

            // Mini player: album art
            const img         = document.getElementById('snp-art');
            const placeholder = document.getElementById('snp-art-placeholder');
            if (track.album_art) {
                if (img) { img.src = track.album_art; img.style.display = 'block'; }
                if (placeholder) placeholder.style.display = 'none';
            } else {
                if (img) img.style.display = 'none';
                if (placeholder) placeholder.style.display = 'flex';
            }

            // Mini play/pause icons
            const mpp  = document.getElementById('snp-play-icon');
            const mppi = document.getElementById('snp-pause-icon');
            if (mpp)  mpp.style.display  = data.playing ? 'none' : 'block';
            if (mppi) mppi.style.display = data.playing ? 'block' : 'none';

            // Progress tracking — reset only when track changes
            if (track.id !== _lastTrackId) {
                _lastTrackId = track.id;
                clearInterval(_progressTimer);
                _progressMs  = track.progress_ms || 0;
                _durationMs  = track.duration_ms || 1;
                setProgressBars(_progressMs, _durationMs);

                if (data.playing) {
                    _progressTimer = setInterval(() => {
                        _progressMs += 1000;
                        if (_progressMs >= _durationMs) clearInterval(_progressTimer);
                        setProgressBars(_progressMs, _durationMs);
                    }, 1000);
                }
            }
        }

        async function pollNowPlaying() {
            if (!window.currentUser) return;
            try {
                const res  = await fetch(`/api/spotify/now-playing?user_id=${window.currentUser.id}`);
                if (!res.ok) return;
                const data = await res.json();
                if (!data.connected) return;
                updatePlayerUI(data);
            } catch (_) { /* silent fail */ }
        }

        function startNowPlayingPolling() {
            if (_pollInterval) return;
            pollNowPlaying();
            _pollInterval = setInterval(pollNowPlaying, 15000);
        }
        function stopNowPlayingPolling() {
            if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }
        }

        function tryStart() {
            if (window.currentUser) startNowPlayingPolling();
            else setTimeout(tryStart, 1000);
        }
        tryStart();

        // Pause Spotify polling when page is hidden to save memory/CPU on iOS
        document.addEventListener('visibilitychange', function() {
            if (document.hidden) stopNowPlayingPolling();
            else startNowPlayingPolling();
        });

        // ── Open in Spotify (native app URI → web fallback) ─────────────────

        window.openInSpotify = function() {
            const track = window._snpCurrentTrack;
            const webUrl = window._snpTrackUrl || 'https://open.spotify.com';
            if (track && track.spotify_uri) {
                window.location.href = track.spotify_uri;
                setTimeout(() => { window.open(webUrl, '_blank'); }, 1500);
            } else {
                window.open(webUrl, '_blank');
            }
        };

        window.spotifyPlayerControl = async function(action, uri) {
            if (!window.currentUser) return;
            try {
                const body = { user_id: window.currentUser.id, action };
                if (uri) body.uri = uri;

                const res = await fetch('/api/spotify/player', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                if (res.status === 403) {
                    alert('Playback controls require Spotify Premium.');
                    return;
                }
                setTimeout(pollNowPlaying, 600);
            } catch (err) {
                console.warn('Spotify player control error:', err);
            }
        };

        // ── Track bottom-nav visibility so mini player repositions itself ──────
        function syncMiniPlayerBottom() {
            const player = document.getElementById('spotify-now-playing');
            if (!player) return;
            const nav = document.querySelector('.bottom-nav');
            const navHidden = !nav || nav.style.display === 'none';
            player.style.bottom = navHidden ? '16px' : '72px';
        }
        const _navEl = document.querySelector('.bottom-nav');
        if (_navEl) {
            new MutationObserver(syncMiniPlayerBottom)
                .observe(_navEl, { attributes: true, attributeFilter: ['style'] });
        }
    })();