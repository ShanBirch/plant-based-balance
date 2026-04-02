/**
 * Native Character Viewer Bridge
 *
 * On iOS, this replaces the WebGL-based <model-viewer> element with a native
 * SceneKit overlay rendered by the NativeCharacterViewer Capacitor plugin.
 * This eliminates the ~300MB WebKit memory limit issue since SceneKit runs
 * in native memory space with access to the full device GPU budget.
 *
 * The bridge intercepts calls that normally go to the <model-viewer> DOM element
 * and routes them to the native plugin instead.
 */
(function() {
    'use strict';

    var isIOS = /iP(ad|hone|od)/.test(navigator.userAgent) && /WebKit/.test(navigator.userAgent);

    // Detect native Capacitor app via multiple methods (belt-and-suspenders):
    // 1. UA string  — 'FitGotchi-Native' appended by appendUserAgent in capacitor.config.json
    // 2. window flag — window._fitgotchiNativePlatform injected by ViewController.swift WKUserScript
    // 3. Capacitor.platform property (synchronous, no function call)
    // 4. Capacitor.getPlatform() method
    // 5. Capacitor.isNativePlatform() method
    // 6. Plugin registry — if NativeCharacterViewer plugin is registered we're definitely native
    var uaMatch     = navigator.userAgent.indexOf('FitGotchi-Native') !== -1;
    var flagMatch   = window._fitgotchiNativePlatform === 'ios';
    var capPlatform = '';
    var capMatch    = false;
    var pluginMatch = false;
    try {
        if (window.Capacitor) {
            capPlatform = String(window.Capacitor.platform || '');
            if (capPlatform === 'ios') {
                capMatch = true;
            } else if (typeof window.Capacitor.getPlatform === 'function' && window.Capacitor.getPlatform() === 'ios') {
                capMatch = true; capPlatform = 'ios(gP)';
            } else if (typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) {
                capMatch = true; capPlatform = capPlatform + '(iNP)';
            }
            // Check plugin registry directly — most specific native indicator
            if (window.Capacitor.Plugins && window.Capacitor.Plugins.NativeCharacterViewer) {
                pluginMatch = true;
            }
        }
    } catch(e) { capPlatform = 'ERR'; }

    // The native_detect crumb fires during <head> parsing so it cannot appear in
    // the on-screen overlay (the debug div isn't in the DOM yet). We add a
    // delayed version at 2000ms so it IS visible in the overlay — even when
    // detection fails — giving us the exact reason on-device without Xcode.
    var _diag = { ua: uaMatch, flag: flagMatch, cap: capPlatform, plugin: pluginMatch };
    setTimeout(function() {
        if (window._crumb) {
            window._crumb('bridge_diag: ua=' + (_diag.ua?'Y':'N') +
                          ' flag=' + (_diag.flag?'Y':'N') +
                          ' cap=' + (_diag.cap||'none') +
                          ' plugin=' + (_diag.plugin?'Y':'N') +
                          ' → ' + (window._pbbNativeViewerAvailable ? 'NATIVE' : 'web'));
        }
    }, 2000);

    var isNativeApp = uaMatch || flagMatch || capMatch || pluginMatch;

    // Only activate on iOS native app
    if (!isIOS || !isNativeApp) return;

    // Signal to other scripts that native viewer is available.
    // script_part_3.js checks this to skip loading model-viewer (WebGL/Three.js),
    // which eliminates the ~300MB memory pressure that causes iOS OOM crashes.
    window._pbbNativeViewerAvailable = true;

    var plugin = null;
    var nativeAvailable = false;
    var nativeActive = false;
    var currentModelUrl = null;
    var modelLoadInFlight = false; // true while a loadModel call is in progress
    var pendingShow = null;

    // Check if the native plugin exists
    function getPlugin() {
        if (plugin) return plugin;
        try {
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.NativeCharacterViewer) {
                plugin = window.Capacitor.Plugins.NativeCharacterViewer;
                return plugin;
            }
        } catch(e) {}
        return null;
    }

    // Probe for native viewer availability
    async function checkAvailability() {
        var p = getPlugin();
        if (!p) {
            if (window._crumb) window._crumb('native_plugin_not_found: Capacitor.Plugins.NativeCharacterViewer=null');
            return false;
        }
        try {
            var result = await p.isAvailable();
            nativeAvailable = result && result.available;
            return nativeAvailable;
        } catch(e) {
            if (window._crumb) window._crumb('native_isAvailable_ERR: ' + (e.message || e));
            nativeAvailable = false;
            return false;
        }
    }

    // Get the position of the tamagotchi widget container relative to the viewport
    function getWidgetRect() {
        var container = document.getElementById('tamagotchi-widget-container');
        if (!container) return { x: 0, y: 0, width: window.innerWidth, height: 420 };
        var rect = container.getBoundingClientRect();
        var scale = window.devicePixelRatio || 1;
        // Capacitor WebView coordinates are in CSS pixels
        return {
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
        };
    }

    // Show the native SceneKit overlay positioned over the model-viewer widget
    async function showNativeViewer() {
        var p = getPlugin();
        if (!p) return false;
        try {
            var rect = getWidgetRect();
            if (window._crumb) window._crumb('native_show_rect: x=' + rect.x + ' y=' + rect.y + ' w=' + rect.width + ' h=' + rect.height);
            var result = await p.show({
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
            });
            nativeActive = true;
            if (window._crumb && result) window._crumb('native_show_result: ' + JSON.stringify(result));
            // Hide the web model-viewer to avoid double rendering
            hideWebModelViewer();
            return true;
        } catch(e) {
            if (window._crumb) window._crumb('native_show_FAILED: ' + (e.message || e));
            console.warn('[NativeViewer] show failed:', e);
            return false;
        }
    }

    // Hide the native overlay
    async function hideNativeViewer() {
        var p = getPlugin();
        if (!p || !nativeActive) return;
        try {
            await p.hide();
            nativeActive = false;
            showWebModelViewer();
        } catch(e) {
            console.warn('[NativeViewer] hide failed:', e);
        }
    }

    // Load model-viewer JS on demand (for Draco/meshopt fallback)
    var modelViewerLoading = false;
    var modelViewerLoaded = false;
    function ensureModelViewerLoaded() {
        return new Promise(function(resolve) {
            if (modelViewerLoaded || customElements.get('model-viewer')) {
                modelViewerLoaded = true;
                resolve();
                return;
            }
            if (modelViewerLoading) {
                // Wait for the already-loading script
                var check = setInterval(function() {
                    if (customElements.get('model-viewer')) {
                        modelViewerLoaded = true;
                        clearInterval(check);
                        resolve();
                    }
                }, 200);
                return;
            }
            modelViewerLoading = true;
            var script = document.createElement('script');
            script.type = 'module';
            script.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.1.0/model-viewer.min.js';
            script.onload = function() {
                // model-viewer registers asynchronously after script loads
                var check = setInterval(function() {
                    if (customElements.get('model-viewer')) {
                        modelViewerLoaded = true;
                        // Configure meshopt decoder for meshopt-compressed GLBs
                        var MV = customElements.get('model-viewer');
                        if (MV) {
                            MV.meshoptDecoderLocation = 'https://cdn.jsdelivr.net/npm/meshoptimizer@0.21.0/meshopt_decoder.min.js';
                            if (window._crumb) window._crumb('bridge_meshopt_configured');
                        }
                        clearInterval(check);
                        resolve();
                    }
                }, 200);
            };
            script.onerror = function() { resolve(); };
            document.head.appendChild(script);
        });
    }

    // Fall back to web model-viewer for models the native viewer can't decode
    async function fallbackToWebModelViewer(url) {
        if (window._crumb) window._crumb('native_draco_fallback_start');

        // Fully dispose the native SceneKit viewer to free GPU/CPU memory.
        // Just hiding it leaves the SCNView, scene, and textures alive,
        // which combined with model-viewer's Three.js can exceed the iOS
        // WKWebView ~300MB Jetsam limit and cause OOM crashes.
        var p = getPlugin();
        if (p) {
            try { await p.dispose(); } catch(e2) {}
            nativeActive = false;
            if (window._crumb) window._crumb('native_disposed_for_web_fallback');
        }

        // Load model-viewer JS on demand
        await ensureModelViewerLoaded();

        // Show and configure the web model-viewer element
        var mv = document.getElementById('tamagotchi-model');
        if (mv) {
            mv.style.visibility = '';
            mv.setAttribute('src', url);
            if (window._crumb) window._crumb('native_draco_fallback_web_src_set');
        }

        // Also hide the fallback emoji since web viewer is active
        var fb = document.getElementById('tamagotchi-fallback');
        if (fb) fb.style.display = 'none';

        // Mark that we're using web fallback so future model changes go through web
        webFallbackActive = true;

        return { loaded: true, fallback: 'web-model-viewer' };
    }

    // Track whether we fell back to web model-viewer
    var webFallbackActive = false;

    // Load a GLB model in the native viewer
    async function loadModel(url) {
        // If we previously fell back to web model-viewer, keep using it
        if (webFallbackActive) {
            var mv = document.getElementById('tamagotchi-model');
            if (mv) {
                mv.setAttribute('src', url);
                try { localStorage.setItem('fitgotchi_model_src', url); } catch(e) {}
                if (window._crumb) window._crumb('native_web_fallback_src_update: ' + (url || '').split('/').pop());
            }
            return { loaded: true, fallback: 'web-model-viewer' };
        }

        var p = getPlugin();
        if (!p) return null;
        try {
            currentModelUrl = url;
            modelLoadInFlight = true;
            if (window._crumb) window._crumb('native_loadModel_start: ' + (url || '').split('/').pop());
            var result = await p.loadModel({ url: url });
            modelLoadInFlight = false;
            // Cache the successfully-loaded URL so future bridge activations auto-load it
            try { localStorage.setItem('fitgotchi_model_src', url); } catch(e) {}
            if (window._crumb) {
                window._crumb('native_model_loaded');
                if (result) {
                    var bb = result.boundingBox;
                    if (bb) window._crumb('native_bb: size=[' + (bb.size || []).map(function(v){return v.toFixed(2)}).join(',') + ']');
                    if (result.cameraPosition) window._crumb('native_cam: [' + result.cameraPosition.map(function(v){return v.toFixed(2)}).join(',') + ']');
                    window._crumb('native_nodes=' + (result.nodeCount || 0) + ' anims=' + (result.animations || []).join(','));
                }
            }
            return result;
        } catch(e) {
            modelLoadInFlight = false;
            var errMsg = (e && (e.message || String(e))) || '';
            if (window._crumb) window._crumb('native_loadModel_FAILED: ' + errMsg);
            console.warn('[NativeViewer] loadModel failed:', e);

            // If the error is about unsupported extensions (Draco, meshopt, etc.)
            // or empty geometry (silent extension failure), fall back to web model-viewer.
            if (errMsg.indexOf('unsupported') !== -1 || errMsg.indexOf('draco') !== -1 ||
                errMsg.indexOf('extension') !== -1 || errMsg.indexOf('empty') !== -1 ||
                errMsg.indexOf('Empty') !== -1 || errMsg.indexOf('0 vertices') !== -1) {
                if (window._crumb) window._crumb('native_ext_unsupported_falling_back_to_web: ' + errMsg.slice(0, 60));
                return await fallbackToWebModelViewer(url);
            }

            return null;
        }
    }

    // Play an animation on the native character
    async function playAnimation(name, opts) {
        var p = getPlugin();
        if (!p || !nativeActive) return null;
        opts = opts || {};
        try {
            return await p.playAnimation({
                name: name,
                loop: opts.loop || false,
                returnToIdle: opts.returnToIdle !== false
            });
        } catch(e) {
            console.warn('[NativeViewer] playAnimation failed:', e);
            return null;
        }
    }

    // Stop current animation
    async function stopAnimation() {
        var p = getPlugin();
        if (!p || !nativeActive) return;
        try {
            await p.stopAnimation();
        } catch(e) {}
    }

    // Set camera orbit and field of view
    async function setCamera(orbit, fov) {
        var p = getPlugin();
        if (!p || !nativeActive) return;
        try {
            var opts = {};
            if (orbit) opts.orbit = orbit;
            if (fov !== undefined) opts.fieldOfView = fov;
            await p.setCamera(opts);
        } catch(e) {}
    }

    // Dispose of the native viewer entirely
    async function dispose() {
        var p = getPlugin();
        if (!p) return;
        try {
            await p.dispose();
            nativeActive = false;
            currentModelUrl = null;
        } catch(e) {}
    }

    // Reposition the native overlay (e.g. after scroll or layout change)
    function repositionOverlay() {
        if (!nativeActive) return;
        var p = getPlugin();
        if (!p) return;
        var rect = getWidgetRect();
        // Skip if widget has no size (hidden or not yet rendered)
        if (rect.width <= 0 || rect.height <= 0) return;
        p.show({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
        }).catch(function() {});
    }

    // Hide the web-based model-viewer element
    function hideWebModelViewer() {
        var mv = document.getElementById('tamagotchi-model');
        if (mv) {
            mv.removeAttribute('src');
            mv.style.visibility = 'hidden';
        }
        // Also hide the fallback emoji
        var fb = document.getElementById('tamagotchi-fallback');
        if (fb) fb.style.display = 'none';
    }

    // Show the web-based model-viewer element (fallback)
    function showWebModelViewer() {
        var mv = document.getElementById('tamagotchi-model');
        if (mv) {
            mv.style.visibility = '';
        }
    }

    // Set src on the web model-viewer (for fallback)
    function setWebModelSrc(url) {
        var mv = document.getElementById('tamagotchi-model');
        if (mv && url) {
            mv.setAttribute('src', url);
        }
    }

    // ── Public API ──────────────────────────────────────────────

    window.NativeCharacterViewer = {
        // Check if native viewer is available
        isAvailable: function() { return nativeAvailable; },
        isActive: function() { return nativeActive; },

        // Initialize: check availability and show if possible
        init: async function() {
            var available = await checkAvailability();
            if (available && window._crumb) {
                window._crumb('native_viewer_available');
            }
            return available;
        },

        // Show the native overlay at the widget position
        show: showNativeViewer,
        hide: hideNativeViewer,

        // Load a GLB model (downloads and caches natively)
        loadModel: loadModel,

        // Animation control
        playAnimation: playAnimation,
        stopAnimation: stopAnimation,

        // Camera control (same format as model-viewer: "0deg 85deg 22m")
        setCamera: setCamera,

        // Reposition overlay after layout changes
        reposition: repositionOverlay,

        // Clean up
        dispose: dispose,

        // Get the current model URL
        getCurrentModel: function() { return currentModelUrl; },

        // True while a loadModel call is in-flight (downloading + parsing)
        isLoading: function() { return modelLoadInFlight; }
    };

    // ── Integration hooks ──────────────────────────────────────

    // Auto-activate native SceneKit viewer on iOS native app.
    // This bypasses WebGL entirely, avoiding WKWebView's ~300MB memory limit
    // that causes OOM crashes when loading GLB models via model-viewer/Three.js.
    // Can be force-disabled by setting localStorage 'native_viewer_disabled' to 'true'.
    window.addEventListener('pbbInitComplete', async function() {
        if (window._crumb) window._crumb('native_pbbInitComplete_fired');
        try {
            var disabled = localStorage.getItem('native_viewer_disabled') === 'true';
            if (disabled) {
                if (window._crumb) window._crumb('native_viewer_force_disabled');
                return;
            }
        } catch(e) { return; }

        var available = await window.NativeCharacterViewer.init();
        if (!available) {
            if (window._crumb) window._crumb('native_viewer_not_available_emoji_fallback');
            // Native plugin not found — the model-viewer was already replaced with a
            // div placeholder by script_part_3, so show the emoji fallback instead.
            var fb = document.getElementById('tamagotchi-fallback');
            if (fb) fb.style.display = 'flex';
            return;
        }

        // Show the egg loader and hide the spinner while model downloads.
        // The spinner waits for a web model-viewer 'load' event that never
        // fires on native, so swap it for the friendlier egg screen.
        var spinner = document.getElementById('model-loading-placeholder');
        if (spinner) spinner.style.display = 'none';
        var fb = document.getElementById('tamagotchi-fallback');
        if (fb) { fb.style.display = 'flex'; }

        // Wait for the tamagotchi widget to be rendered
        setTimeout(async function() {
            var shown = await showNativeViewer();
            if (!shown) {
                if (window._crumb) window._crumb('native_show_failed_emoji_fallback');
                return; // egg fallback already visible
            }

            // Load model: use cached src from localStorage, or fall back to the
            // baby model so something always appears on first native-viewer run.
            var cachedSrc = null;
            try { cachedSrc = localStorage.getItem('fitgotchi_model_src'); } catch(e) {}
            var modelToLoad = cachedSrc || 'https://f005.backblazeb2.com/file/shannonsvideos/baby_full_animations.glb';
            if (window._crumb) window._crumb('native_loading: ' + modelToLoad.split('/').pop());
            var loadResult = await loadModel(modelToLoad);

            if (loadResult) {
                // Model loaded successfully — hide the egg loader
                if (fb) fb.style.display = 'none';
                if (window._crumb) window._crumb('native_viewer_activated');
            } else {
                // loadModel returned null — native viewer failed.
                // Keep the egg visible with an error message so user isn't staring at nothing.
                if (window._crumb) window._crumb('native_loadModel_returned_null_keeping_egg');
                var fbMsg = document.getElementById('tamagotchi-fallback-msg');
                if (fbMsg) fbMsg.textContent = 'Tap to retry loading character';
                if (fb) {
                    fb.style.display = 'flex';
                    fb.onclick = function() {
                        fbMsg.textContent = 'Loading your character...';
                        loadModel(modelToLoad).then(function(r) {
                            if (r) {
                                fb.style.display = 'none';
                                if (window._crumb) window._crumb('native_retry_success');
                            } else {
                                fbMsg.textContent = 'Tap to retry loading character';
                                if (window._crumb) window._crumb('native_retry_failed');
                            }
                        });
                    };
                }
                return;
            }

            // The model loaded while the loading splash screen was still visible.
            // By the time the main dashboard renders the tamagotchi widget is at a
            // completely different position — reposition the native overlay several
            // times so it follows the widget once the layout settles.
            [300, 800, 1500, 3000].forEach(function(ms) {
                setTimeout(function() {
                    if (!nativeActive || webFallbackActive) return;
                    repositionOverlay();
                }, ms);
            });
        }, 1000);
    }, { once: true });

    // Reposition on scroll/resize (only when active).
    // Use requestAnimationFrame instead of setTimeout for smooth tracking —
    // the native UIView must follow the widget exactly or it visually detaches.
    var repositionRAF = null;
    function debouncedReposition() {
        if (!nativeActive) return;
        if (repositionRAF) return; // already scheduled for this frame
        repositionRAF = requestAnimationFrame(function() {
            repositionRAF = null;
            repositionOverlay();
        });
    }
    window.addEventListener('scroll', debouncedReposition, { passive: true });
    window.addEventListener('resize', debouncedReposition, { passive: true });

    // When app goes to background, move overlay off-screen (NOT hide —
    // hide() on older Swift builds destroys the scene entirely).
    // On resume, reposition to the correct location.
    document.addEventListener('visibilitychange', function() {
        if (!nativeAvailable || !nativeActive || webFallbackActive) return;
        if (document.hidden) {
            var p = getPlugin();
            if (p) p.show({ x: 0, y: -9999, width: 1, height: 1 }).catch(function() {});
        } else {
            repositionOverlay();
        }
    });

    // Clean up on page unload
    window.addEventListener('pagehide', function() {
        if (nativeActive) dispose();
    });

    // ── Intercept model-viewer helpers ─────────────────────────────
    // Override _pbbSetModelSrc so that when other scripts (script_part_5,
    // updateFitGotchi, rare skins, etc.) set a model src on the tamagotchi,
    // the native viewer handles it instead of the web model-viewer.
    var origSetModelSrc = window._pbbSetModelSrc;
    window._pbbSetModelSrc = function(id, src) {
        if (id === 'tamagotchi-model' && (nativeActive || webFallbackActive) && src) {
            loadModel(src);
            return document.getElementById(id);
        }
        // For non-tamagotchi viewers or if native isn't active, use original
        if (origSetModelSrc) return origSetModelSrc(id, src);
        var el = document.getElementById(id);
        if (el && src) el.setAttribute('src', src);
        return el;
    };

    // Hook _pbbDeactivateViewer so stories/wizards hide the native overlay
    // when they take over the screen. The original function only strips src
    // from web <model-viewer> elements — native SceneKit isn't affected.
    var origDeactivate = window._pbbDeactivateViewer;
    window._pbbDeactivateViewer = function(id) {
        if (origDeactivate) origDeactivate(id);
        // On native iOS, move the overlay off-screen instead of calling hide()
        // which on older Swift builds destroys the scene entirely.
        if (id === 'tamagotchi-model' && nativeActive && !webFallbackActive) {
            var p = getPlugin();
            if (p) p.show({ x: 0, y: -9999, width: 1, height: 1 }).catch(function() {});
        }
    };

    // Hook _pbbActivateViewer so the native overlay re-appears after
    // stories/wizards finish and return to the dashboard.
    var origActivate = window._pbbActivateViewer;
    window._pbbActivateViewer = function(id, srcOverride) {
        if (id === 'tamagotchi-model' && nativeActive && !webFallbackActive) {
            // Re-show native overlay at current widget position
            repositionOverlay();
            if (srcOverride) loadModel(srcOverride);
            return document.getElementById(id);
        }
        if (origActivate) return origActivate(id, srcOverride);
        var el = document.getElementById(id);
        if (el && srcOverride) el.setAttribute('src', srcOverride);
        return el;
    };

})();
