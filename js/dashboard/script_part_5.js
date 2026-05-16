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
                if (window.pbbBustModelUrl) modelSrc = window.pbbBustModelUrl(modelSrc);

                function applyModelSrc() {
                    // Re-query the element fresh — iosHotSwapModel may have destroyed
                    // the original and created a new one with the same ID.
                    var el = document.getElementById('tamagotchi-model');
                    if (!el) return;
                    // If iosHotSwapModel already set src (race with updateFitGotchi),
                    // don't overwrite with the cached/default model.
                    if (el.getAttribute('src')) return;
                    el.setAttribute('src', modelSrc);
                    // For the baby model, force the correct small scale + canonical
                    // camera/FOV (the same values updateFitGotchi in script-13.js
                    // applies for a level-1 baby: camera-orbit "0deg 85deg 22m",
                    // field-of-view "30deg", viewport scale(0.334)).
                    //
                    // Without pinning these here, first-login iOS users briefly
                    // render the HTML default FOV (wider) then the 0.5s viewport
                    // transform transition animates the scale down while FOV has
                    // already snapped to 30deg telephoto — causing the "cut off
                    // baby" flash during the scale animation. After close/reopen,
                    // the cached values get restored directly and the flash
                    // doesn't happen; we want first-login to match that path.
                    var isBaby = modelSrc && modelSrc.indexOf('baby') !== -1;
                    if (isBaby) {
                        // Match dashboard-script-13.js: charHeight 78 → (78/175)*0.75 ≈ 0.334
                        var babyScale = 'scale(0.334)';
                        el.setAttribute('camera-orbit', '0deg 85deg 22m');
                        el.setAttribute('field-of-view', '30deg');
                        var viewport = document.getElementById('tamagotchi-viewport');
                        if (viewport) {
                            // Disable the bouncy transition for the very first
                            // scale set so the baby snaps to its final size
                            // instead of animating through a cut-off state.
                            var prevTransition = viewport.style.transition;
                            viewport.style.transition = 'none';
                            viewport.style.transform = babyScale;
                            viewport.style.transformOrigin = 'center center';
                            // Force a reflow so the "no transition" scale is
                            // committed before we restore the CSS transition.
                            void viewport.offsetWidth;
                            viewport.style.transition = prevTransition;
                            el.style.transform = '';
                        } else {
                            el.style.transform = babyScale;
                            el.style.transformOrigin = 'center center';
                        }
                    } else if (isReturning && usableCache) {
                        if (cachedOrbit) el.setAttribute('camera-orbit', cachedOrbit);
                        if (cachedFov) el.setAttribute('field-of-view', cachedFov);
                        if (cachedScale) {
                            var viewport2 = document.getElementById('tamagotchi-viewport');
                            if (viewport2) {
                                viewport2.style.transform = cachedScale;
                                viewport2.style.transformOrigin = 'center center';
                            } else {
                                el.style.transform = cachedScale;
                                el.style.transformOrigin = 'center center';
                            }
                        }
                    }
                }

                if (window._pbbNativeViewerAvailable) {
                    // iOS native app: the native SceneKit viewer handles 3D rendering.
                    // The bridge's pbbInitComplete handler (native-character-viewer-bridge.js)
                    // is the PRIMARY loader — it calls loadModel ~1s after init.
                    // This is a BACKUP that fires at +5s only if the bridge failed or is
                    // still in-flight. We check isLoading() to avoid firing a competing
                    // loadModel that would cancel the bridge's in-progress download via
                    // the Swift loadGeneration guard.
                    window.addEventListener('pbbInitComplete', function() {
                        if (window._crumb) window._crumb('native_viewer_applying_model_src');
                        if (window.NativeCharacterViewer) {
                            setTimeout(function() {
                                var active = window.NativeCharacterViewer.isActive();
                                var current = window.NativeCharacterViewer.getCurrentModel();
                                var loading = window.NativeCharacterViewer.isLoading ? window.NativeCharacterViewer.isLoading() : false;
                                if (window._crumb) window._crumb('native_s5: active=' + active + ' current=' + (current ? current.split('/').pop() : 'none') + ' loading=' + loading + ' want=' + (modelSrc||'').split('/').pop());
                                // Only load if active, NOT already loading, and bridge hasn't loaded
                                if (active && !current && !loading) {
                                    window.NativeCharacterViewer.loadModel(modelSrc).then(function(r) {
                                        if (window._crumb) window._crumb('native_s5_load: ' + (r ? 'ok nodes=' + r.nodeCount : 'null'));
                                    }).catch(function(e) {
                                        if (window._crumb) window._crumb('native_s5_load_ERR: ' + e);
                                    });
                                }
                            }, 5000); // 5s (up from 3s) to give bridge more time
                        }
                    }, { once: true });
                } else if (window._pbbIsIOSSafari || window._pbbIsNativeAndroid) {
                    // Mobile WebViews are sensitive to starting WebGL/GLB work while
                    // the dashboard is still compiling and hydrating. Defer model
                    // loading until after core JS init and model-viewer registration.
                    var deferReason = window._pbbIsNativeAndroid ? 'android_native' : 'ios';
                    var modelApplyDelay = window._pbbIsNativeAndroid ? 2500 : 0;
                    var modelLoadRetryDelay = window._pbbIsNativeAndroid ? 35000 : 15000;
                    var _modelSrcApplied = false;
                    function applyModelSrcOnce() {
                        if (_modelSrcApplied) return;
                        _modelSrcApplied = true;
                        applyModelSrc();
                    }
                    window.addEventListener('pbbInitComplete', function() {
                        if (window._crumb) window._crumb(deferReason + '_waiting_for_model_viewer_ce');
                        customElements.whenDefined('model-viewer').then(function() {
                            if (window._crumb) window._crumb(deferReason + '_model_viewer_ready');
                            setTimeout(function() {
                                if (window._crumb) window._crumb(deferReason + '_applying_model_src');
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
                                    if (window._crumb) window._crumb(deferReason + '_model_NOT_loaded_after_' + Math.round(modelLoadRetryDelay / 1000) + 's_retrying');
                                    // Force a fresh load by cycling src
                                    el.removeAttribute('src');
                                    setTimeout(function() {
                                        var freshEl = document.getElementById('tamagotchi-model');
                                        if (freshEl && !freshEl.getAttribute('src')) {
                                            freshEl.setAttribute('src', src);
                                        }
                                    }, 500);
                                }
                            }, modelLoadRetryDelay);
                            }, modelApplyDelay);
                        });
                        // Safety: if model-viewer never registers (blocked/failed), apply after 15s
                        // (accounts for 1s delay before model-viewer script loads + download time)
                        setTimeout(applyModelSrcOnce, window._pbbIsNativeAndroid ? 18000 : 15000);
                    }, { once: true });
                    // Safety fallback: if init never completes (fatal error), load after timeout
                    // so the user at least sees the emoji fallback rather than a blank screen.
                    setTimeout(applyModelSrcOnce, window._pbbIsNativeAndroid ? 25000 : 20000);
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
