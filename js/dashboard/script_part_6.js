// Fallback detection — waits patiently for big GLB models to load.
            // No load timeout: models can be large and take 1-2 min on slow connections.
            // Only shows fallback if model-viewer script itself is blocked, or after
            // repeated fetch errors (not slow loads).
            (function() {
                // iOS native app: native SceneKit viewer handles 3D — no web fallback needed.
                if (window._pbbNativeViewerAvailable) return;

                var mv = document.getElementById('tamagotchi-model');
                var fb = document.getElementById('tamagotchi-fallback');
                if (!mv || !fb) return;

                var loaded = false;
                var fallbackShown = false;
                var errorRetries = 0;
                var maxErrorRetries = 5;
                // On iOS Safari, limit retries to avoid memory pressure from repeated loads.
                // Allow 2 attempts (network can be flaky) but not 5.
                var isIOSSafari = /iP(ad|hone|od)/.test(navigator.userAgent) &&
                                  /WebKit/.test(navigator.userAgent) &&
                                  !/CriOS/.test(navigator.userAgent);
                if (isIOSSafari) maxErrorRetries = 2;

                // Show loading animation (pulsing egg) while model downloads
                fb.style.display = 'flex';

                function showFallback(msg) {
                    if (fallbackShown) return;
                    fallbackShown = true;
                    var msgEl = document.getElementById('tamagotchi-fallback-msg');
                    if (msgEl && msg) msgEl.textContent = msg;
                    fb.style.display = 'flex';
                    mv.style.display = 'none';
                }

                function hideLoading() {
                    if (fallbackShown) return;
                    fb.style.display = 'none';
                    mv.style.display = '';
                }

                // On error, silently retry (same URL, no cache-bust so SW cache works)
                function retryOnError() {
                    if (loaded || fallbackShown) return;
                    errorRetries++;
                    if (errorRetries > maxErrorRetries) {
                        showFallback('Could not load your character. Check your connection and restart the app.');
                        return;
                    }
                    // Exponential backoff: 3s, 6s, 12s, 24s, 48s
                    var delay = 3000 * Math.pow(2, errorRetries - 1);
                    setTimeout(function() {
                        if (loaded || fallbackShown) return;
                        var src = mv.getAttribute('src');
                        if (src) {
                            // Release WebGL context properly before retry
                            if (window._pbbReleaseModelViewer) window._pbbReleaseModelViewer(mv);
                            else mv.removeAttribute('src');
                            // Wait for GPU cleanup, then re-set src
                            setTimeout(function() { mv.setAttribute('src', src); }, 200);
                        }
                    }, delay);
                }

                // Listen for successful load
                mv.addEventListener('load', function() {
                    loaded = true;
                    hideLoading();
                });

                // Listen for explicit errors (e.g. GLB fetch failure) — retry silently
                mv.addEventListener('error', function() {
                    if (!loaded) retryOnError();
                });

                // Check if model-viewer custom element registered (script loaded).
                // If the ES module script failed (e.g. blocked by privacy settings),
                // the custom element won't be defined and model-viewer is inert.
                // On iOS, model-viewer is deferred until after init completes,
                // so give it more time before showing fallback.
                var ceCheckDelay = isIOSSafari ? 25000 : 15000;
                var ceCheckTimeout = setTimeout(function() {
                    if (!customElements.get('model-viewer')) {
                        showFallback('3D viewer could not load. Please restart the app.');
                    }
                }, ceCheckDelay);

                customElements.whenDefined('model-viewer').then(function() {
                    clearTimeout(ceCheckTimeout);
                });

                // No load timeout — we wait patiently for the model to finish downloading.
                // The service worker caches models after first successful load,
                // so subsequent app opens will be near-instant.
            })();