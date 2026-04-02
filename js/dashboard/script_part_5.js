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
                    // Re-query the element fresh — iosHotSwapModel may have destroyed
                    // the original and created a new one with the same ID.
                    var el = document.getElementById('tamagotchi-model');
                    if (!el) return;
                    // If iosHotSwapModel already set src (race with updateFitGotchi),
                    // don't overwrite with the cached/default model.
                    if (el.getAttribute('src')) return;
                    el.setAttribute('src', modelSrc);
                    if (isReturning && usableCache) {
                        if (cachedOrbit) el.setAttribute('camera-orbit', cachedOrbit);
                        if (cachedFov) el.setAttribute('field-of-view', cachedFov);
                        if (cachedScale) {
                            var viewport = document.getElementById('tamagotchi-viewport');
                            if (viewport) {
                                viewport.style.transform = cachedScale;
                                viewport.style.transformOrigin = 'center center';
                            } else {
                                el.style.transform = cachedScale;
                                el.style.transformOrigin = 'center center';
                            }
                        }
                    }
                }

                if (window._pbbNativeViewerAvailable) {
                    // iOS native app: the native SceneKit viewer handles 3D rendering.
                    // Pass the model URL to the native bridge after init completes.
                    window.addEventListener('pbbInitComplete', function() {
                        if (window._crumb) window._crumb('native_viewer_applying_model_src');
                        // The native viewer bridge intercepts _pbbSetModelSrc for tamagotchi-model
                        if (window.NativeCharacterViewer) {
                            // Wait for native viewer to be ready (init + show)
                            setTimeout(function() {
                                var active = window.NativeCharacterViewer.isActive();
                                var current = window.NativeCharacterViewer.getCurrentModel();
                                if (window._crumb) window._crumb('native_s5: active=' + active + ' current=' + (current ? current.split('/').pop() : 'none') + ' want=' + (modelSrc||'').split('/').pop());
                                // Only load if active and bridge hasn't already loaded something
                                if (active && !current) {
                                    window.NativeCharacterViewer.loadModel(modelSrc).then(function(r) {
                                        if (window._crumb) window._crumb('native_s5_load: ' + (r ? 'ok nodes=' + r.nodeCount : 'null'));
                                    }).catch(function(e) {
                                        if (window._crumb) window._crumb('native_s5_load_ERR: ' + e);
                                    });
                                }
                            }, 3000);
                        }
                    }, { once: true });
                } else if (window._pbbIsIOSSafari) {
                    // iOS Safari (PWA / browser): defer model loading until after core JS
                    // init completes AND the model-viewer custom element is registered.
                    // The model-viewer script is also deferred until pbbInitComplete,
                    // so we wait for customElements.whenDefined before setting src.
                    var _modelSrcApplied = false;
                    function applyModelSrcOnce() {
                        if (_modelSrcApplied) return;
                        _modelSrcApplied = true;
                        applyModelSrc();
                    }
                    window.addEventListener('pbbInitComplete', function() {
                        if (window._crumb) window._crumb('ios_waiting_for_model_viewer_ce');
                        customElements.whenDefined('model-viewer').then(function() {
                            if (window._crumb) window._crumb('ios_model_viewer_ready');
                            applyModelSrcOnce();

                            // Monitor for model load failure — if src is set but model
                            // doesn't load within 15s, the meshopt decoder may have failed.
                            // Try removing and re-setting src to trigger a fresh load attempt.
                            setTimeout(function() {
                                var el = document.getElementById('tamagotchi-model');
                                if (!el) return;
                                var src = el.getAttribute('src');
                                if (!src) return;
                                // Check if model actually loaded (model-loaded class is added on 'load' event)
                                if (!el.classList.contains('model-loaded')) {
                                    if (window._crumb) window._crumb('ios_model_NOT_loaded_after_15s_retrying');
                                    // Force a fresh load by cycling src
                                    el.removeAttribute('src');
                                    setTimeout(function() {
                                        var freshEl = document.getElementById('tamagotchi-model');
                                        if (freshEl && !freshEl.getAttribute('src')) {
                                            freshEl.setAttribute('src', src);
                                        }
                                    }, 500);
                                }
                            }, 15000);
                        });
                        // Safety: if model-viewer never registers (blocked/failed), apply after 15s
                        // (accounts for 1s delay before model-viewer script loads + download time)
                        setTimeout(applyModelSrcOnce, 15000);
                    }, { once: true });
                    // Safety fallback: if init never completes (fatal error), load after timeout
                    // so the user at least sees the emoji fallback rather than a blank screen.
                    setTimeout(applyModelSrcOnce, 20000);
                } else {
                    // Non-iOS: set src immediately so the model starts downloading in parallel
                    // with the init sequence (faster first load on desktop / Android).
                    applyModelSrc();
                }

                // After model loads, add class to make background transparent so 3D environment shows through.
                // Keeping it opaque during load ensures Safari users see a dark bg instead of a blank void.
                // Use a MutationObserver to handle the case where iosHotSwapModel destroys/recreates
                // the element — a listener on the old element would be lost.
                function attachLoadClass(elem) {
                    if (!elem) return;
                    elem.addEventListener('load', function() {
                        elem.classList.add('model-loaded');
                    });
                }
                attachLoadClass(mv);
                // Also observe for element replacement (iosHotSwapModel destroys & recreates)
                if (mv && mv.parentNode) {
                    var obs = new MutationObserver(function(mutations) {
                        for (var m = 0; m < mutations.length; m++) {
                            for (var n = 0; n < mutations[m].addedNodes.length; n++) {
                                var node = mutations[m].addedNodes[n];
                                if (node.id === 'tamagotchi-model' && node.tagName && node.tagName.toLowerCase() === 'model-viewer') {
                                    attachLoadClass(node);
                                }
                            }
                        }
                    });
                    obs.observe(mv.parentNode, { childList: true });
                }
            })();