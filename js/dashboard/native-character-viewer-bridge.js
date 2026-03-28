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
    var isNativeApp = navigator.userAgent.indexOf('FitGotchi-Native') !== -1;

    // Only activate on iOS native app
    if (!isIOS || !isNativeApp) return;

    var plugin = null;
    var nativeAvailable = false;
    var nativeActive = false;
    var currentModelUrl = null;
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
        if (!p) return false;
        try {
            var result = await p.isAvailable();
            nativeAvailable = result && result.available;
            return nativeAvailable;
        } catch(e) {
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
            await p.show({
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
            });
            nativeActive = true;
            // Hide the web model-viewer to avoid double rendering
            hideWebModelViewer();
            return true;
        } catch(e) {
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

    // Load a GLB model in the native viewer
    async function loadModel(url) {
        var p = getPlugin();
        if (!p) return null;
        try {
            currentModelUrl = url;
            var result = await p.loadModel({ url: url });
            if (window._crumb) window._crumb('native_model_loaded');
            return result;
        } catch(e) {
            console.warn('[NativeViewer] loadModel failed:', e);
            // Fall back to web model-viewer
            nativeActive = false;
            showWebModelViewer();
            setWebModelSrc(url);
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
        getCurrentModel: function() { return currentModelUrl; }
    };

    // ── Integration hooks ──────────────────────────────────────

    // After init completes, check if native viewer is available and activate it
    window.addEventListener('pbbInitComplete', async function() {
        var available = await window.NativeCharacterViewer.init();
        if (!available) {
            if (window._crumb) window._crumb('native_viewer_not_available');
            return;
        }

        // Wait for the tamagotchi widget to be rendered
        setTimeout(async function() {
            var shown = await showNativeViewer();
            if (!shown) return;

            // If there's a cached model src, load it natively
            var cachedSrc = null;
            try { cachedSrc = localStorage.getItem('fitgotchi_model_src'); } catch(e) {}
            if (cachedSrc) {
                await loadModel(cachedSrc);
                // Apply cached camera settings
                var orbit = null, fov = null;
                try {
                    orbit = localStorage.getItem('fitgotchi_camera_orbit');
                    fov = parseFloat(localStorage.getItem('fitgotchi_fov'));
                } catch(e) {}
                if (orbit || fov) {
                    await setCamera(orbit, isNaN(fov) ? undefined : fov);
                }
            }

            if (window._crumb) window._crumb('native_viewer_activated');
        }, 1000);
    }, { once: true });

    // Reposition on scroll/resize
    var repositionTimer = null;
    function debouncedReposition() {
        if (repositionTimer) clearTimeout(repositionTimer);
        repositionTimer = setTimeout(repositionOverlay, 100);
    }
    window.addEventListener('scroll', debouncedReposition, { passive: true });
    window.addEventListener('resize', debouncedReposition, { passive: true });

    // Hide native viewer when app goes to background, show on return
    document.addEventListener('visibilitychange', function() {
        if (!nativeAvailable) return;
        if (document.hidden) {
            if (nativeActive) {
                var p = getPlugin();
                if (p) p.hide().catch(function() {});
                // Don't set nativeActive=false so we restore on return
            }
        } else {
            if (nativeActive && currentModelUrl) {
                showNativeViewer().then(function() {
                    if (currentModelUrl) loadModel(currentModelUrl);
                });
            }
        }
    });

    // Clean up on page unload
    window.addEventListener('pagehide', function() {
        dispose();
    });

    // ── Monkey-patch integration ───────────────────────────────
    // Intercept model-viewer setAttribute('src', ...) to route through native viewer.
    // This is done by overriding the global iosHotSwapModel and applyIdleAnimation
    // functions once the native viewer is active.

    // Hook into updateFitGotchi's model loading: when native viewer is active,
    // intercept localStorage writes of fitgotchi_model_src to also load natively.
    var origSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key, value) {
        origSetItem(key, value);
        if (key === 'fitgotchi_model_src' && nativeActive && value) {
            loadModel(value).catch(function() {});
        }
        if (key === 'fitgotchi_camera_orbit' && nativeActive && value) {
            setCamera(value).catch(function() {});
        }
        if (key === 'fitgotchi_fov' && nativeActive && value) {
            var fovVal = parseFloat(value);
            if (!isNaN(fovVal)) setCamera(null, fovVal).catch(function() {});
        }
    };

    // Hook into playAnimation — intercept window.playAnimationFromSelector
    // and the tap-to-greet handler
    var hookAnimations = function() {
        // Intercept playAnimation if it exists
        if (window.playAnimation && !window.playAnimation._nativeHooked) {
            var origPlayAnimation = window.playAnimation;
            window.playAnimation = function(animName, returnToStatic) {
                if (nativeActive) {
                    playAnimation(animName, { loop: false, returnToIdle: returnToStatic !== false });
                }
                return origPlayAnimation.call(this, animName, returnToStatic);
            };
            window.playAnimation._nativeHooked = true;
        }

        // Intercept applyIdleAnimation
        if (window.applyIdleAnimation && !window.applyIdleAnimation._nativeHooked) {
            var origApplyIdle = window.applyIdleAnimation;
            window.applyIdleAnimation = function(mv) {
                if (nativeActive) {
                    // Native viewer handles idle animation internally
                    playAnimation('idle', { loop: true, returnToIdle: false }).catch(function() {});
                }
                return origApplyIdle.call(this, mv);
            };
            window.applyIdleAnimation._nativeHooked = true;
        }
    };

    // Apply hooks after scripts are loaded
    window.addEventListener('pbbInitComplete', function() {
        setTimeout(hookAnimations, 2000);
        // Retry in case scripts load later
        setTimeout(hookAnimations, 5000);
    });

})();
