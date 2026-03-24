// Set model src from cache (returning users) or default to Shanbot/baby (new users).
            // On iOS Safari the src is deferred until after the JS init sequence completes
            // (pbbInitComplete event) to avoid WebGL context initialisation racing with
            // the Supabase DB calls in loadProfileData, which causes an OOM process crash.
            (function() {
                var mv = document.getElementById('tamagotchi-model');
                if (!mv) return;

                var cachedModel = window._fitgotchiCachedModel || localStorage.getItem('fitgotchi_model_src');
                var cachedOrbit = localStorage.getItem('fitgotchi_camera_orbit');
                var cachedFov = localStorage.getItem('fitgotchi_fov');
                var cachedScale = localStorage.getItem('fitgotchi_scale');
                var isReturning = localStorage.getItem('dashboardInitialized') === 'true';
                var vp = document.getElementById('tamagotchi-viewport');

                // Determine which model to load
                var modelSrc;
                // Don't use cached shanbot unless it's the active rare skin
                var cachedIsShanbot = cachedModel && cachedModel.indexOf('shanbot') !== -1;
                var shanbotIsActive = localStorage.getItem('active_rare_skin') === 'shanbot';
                var usableCache = cachedModel && (!cachedIsShanbot || shanbotIsActive);
                // If a stale shanbot was cached, clear it so next load doesn't check
                if (cachedIsShanbot && !shanbotIsActive) {
                    try { localStorage.removeItem('fitgotchi_model_src'); } catch(e) {}
                }
                if (isReturning && usableCache) {
                    modelSrc = cachedModel;
                } else if (isReturning) {
                    // Returning user with bad/missing cache — always use baby, never shanbot
                    modelSrc = 'https://f005.backblazeb2.com/file/shannonsvideos/baby_full_animations.glb';
                } else {
                    // First-time or unknown user.
                    // On iOS Safari: always use baby model to keep memory low.
                    // Shanbot (onboarding story) is loaded separately via _pbbActivateViewer
                    // only when the story actually starts, not during initial page load.
                    // On non-iOS: load Shanbot for onboarding so it's SW-cached before the
                    // wizard starts.  After onboarding, updateFitGotchi() switches to baby.
                    var needsOnboarding = localStorage.getItem('onboardingComplete') !== 'true';
                    if (window._pbbIsIOSSafari || !needsOnboarding) {
                        modelSrc = 'https://f005.backblazeb2.com/file/shannonsvideos/baby_full_animations.glb';
                    } else {
                        modelSrc = 'https://f005.backblazeb2.com/file/shannonsvideos/shanbot_final.glb';
                    }
                }

                function applyModelSrc() {
                    // Safe mode: skip all WebGL to break crash loops
                    if (window._pbbSafeMode) return;
                    mv.setAttribute('src', modelSrc);
                    if (isReturning && usableCache) {
                        if (cachedOrbit) mv.setAttribute('camera-orbit', cachedOrbit);
                        if (cachedFov) mv.setAttribute('field-of-view', cachedFov);
                        if (cachedScale) {
                            if (vp) {
                                vp.style.transform = cachedScale;
                                vp.style.transformOrigin = 'center center';
                            } else {
                                mv.style.transform = cachedScale;
                                mv.style.transformOrigin = 'center center';
                            }
                        }
                    }
                }

                if (window._pbbIsIOSSafari) {
                    // iOS Safari: defer model loading until after core JS init completes
                    // AND the model-viewer custom element is registered.
                    // The model-viewer script is also deferred until pbbInitComplete,
                    // so we wait for customElements.whenDefined before setting src.
                    window.addEventListener('pbbInitComplete', function() {
                        if (window._crumb) window._crumb('ios_waiting_for_model_viewer_ce');
                        customElements.whenDefined('model-viewer').then(function() {
                            if (window._crumb) window._crumb('ios_model_viewer_ready');
                            applyModelSrc();
                        });
                        // Safety: if model-viewer never registers (blocked/failed), apply after 20s
                        // (accounts for 5s delay before model-viewer script loads + download time)
                        setTimeout(function() { applyModelSrc(); }, 20000);

                        // Rare/story models (shanbot, arny, optimus, steve_irwin) are NO
                        // LONGER background-fetched on iOS. Each GLB is 5-20MB and fetching
                        // them adds memory pressure that contributes to OOM crashes. They
                        // will be cached on-demand via the SW fetch handler when the user
                        // actually opens the onboarding story or selects a rare skin.
                    }, { once: true });
                    // Safety fallback: if init never completes (fatal error), load after timeout
                    // so the user at least sees the emoji fallback rather than a blank screen.
                    // 25s accounts for deferred scripts + 5s model-viewer delay.
                    setTimeout(applyModelSrc, 25000);
                } else {
                    // Non-iOS: set src immediately so the model starts downloading in parallel
                    // with the init sequence (faster first load on desktop / Android).
                    applyModelSrc();
                }

                // After model loads, add class to make background transparent so 3D environment shows through.
                // Keeping it opaque during load ensures Safari users see a dark bg instead of a blank void.
                mv.addEventListener('load', function() {
                    mv.classList.add('model-loaded');
                });
            })();