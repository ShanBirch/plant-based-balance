(function() {
    var CRASH_KEY = '_pbb_crash_count';
    var CRASH_TS_KEY = '_pbb_crash_ts';
    var CRASH_LOG_KEY = '_pbb_crash_log';

    // Count consecutive page loads that didn't reach init_complete.
    // Each load increments the counter; init_complete resets it to 0.
    var count = 0;
    var lastTs = 0;
    try {
        count = parseInt(localStorage.getItem(CRASH_KEY) || '0', 10) || 0;
        lastTs = parseInt(localStorage.getItem(CRASH_TS_KEY) || '0', 10) || 0;
    } catch(e) {}

    // If the last crash was > 10 minutes ago, reset the counter
    // (user probably navigated away and came back — not a crash loop)
    var now = Date.now();
    if (now - lastTs > 10 * 60 * 1000) count = 0;

    // Increment crash counter (will be reset to 0 on successful init)
    count++;
    try {
        localStorage.setItem(CRASH_KEY, String(count));
        localStorage.setItem(CRASH_TS_KEY, String(now));
    } catch(e) {}

    // iOS detection — ALL browsers on iPhone/iPad use WebKit under the hood
    // (Chrome = CriOS, Firefox = FxiOS, Edge = EdgiOS, etc.), so they all
    // share the same memory limits and WebGL constraints as Safari.
    var isIOS = /iP(ad|hone|od)/.test(navigator.userAgent) &&
                /WebKit/.test(navigator.userAgent);

    window._pbbCrashCount = count;

    // Early global _crumb so we can track which <script> tags crash the page.
    // On iOS, buffer crumbs in memory and flush periodically to reduce
    // localStorage I/O during HTML parsing (JSON.parse + JSON.stringify on
    // every call was 12+ sync I/O ops during the critical parsing window).
    var _crumbBuffer = [];
    var _crumbFlushTimer = null;
    function _crumbFlush() {
        _crumbFlushTimer = null;
        try {
            var log = JSON.parse(localStorage.getItem(CRASH_LOG_KEY) || '[]');
            for (var i = 0; i < _crumbBuffer.length; i++) log.push(_crumbBuffer[i]);
            _crumbBuffer = [];
            if (log.length > 40) log = log.slice(-40);
            localStorage.setItem(CRASH_LOG_KEY, JSON.stringify(log));
        } catch(e) {}
    }
    window._crumb = function(step) {
        try {
            var mvCount = 0;
            // On iOS, skip the querySelectorAll('model-viewer[src]') check during
            // init. Model src is deferred until after pbbInitComplete, so this
            // always returns 0 during parsing — and the querySelector itself adds
            // memory pressure by scanning the growing DOM on every crumb call.
            if (!isIOS || window._pbbInitDone) {
                try { mvCount = document.querySelectorAll('model-viewer[src]').length; } catch(e2) {}
            }
            var entry = { step: step, ts: Date.now(), mv: mvCount };
            if (isIOS) {
                // Buffer and flush every 200ms to reduce I/O during parsing
                _crumbBuffer.push(entry);
                if (!_crumbFlushTimer) _crumbFlushTimer = setTimeout(_crumbFlush, 200);
            } else {
                var log = JSON.parse(localStorage.getItem(CRASH_LOG_KEY) || '[]');
                log.push(entry);
                if (log.length > 40) log = log.slice(-40);
                localStorage.setItem(CRASH_LOG_KEY, JSON.stringify(log));
            }
        } catch(e) {}
    };
    // Flush any buffered crumbs before unload so crash log is complete
    if (isIOS) {
        window.addEventListener('pagehide', _crumbFlush);
        window.addEventListener('beforeunload', _crumbFlush);
    }

    // ── Deferred-JS injection system ──────────────────────────────────
    // Large inline <script> blocks in the body use type="text/pbb-deferred-js"
    // to prevent the JS engine from compiling them during HTML parsing.
    // On non-iOS: a tiny inline script after each block injects it immediately
    //             (same timing as a regular <script>, no user-visible difference).
    // On iOS:     blocks stay dormant until pbbInitComplete fires, keeping
    //             ~1400 lines of JS out of the critical parsing window.
    
    if (isIOS) {
        window.addEventListener('pbbInitComplete', function() {
            if(window._crumb)window._crumb('deferred_js_inject_start');
            var queue = window._pbbDeferredQueue || [];
            for (var i = 0; i < queue.length; i++) {
                (function(src, idx) {
                    setTimeout(function() {
                        var s = document.createElement('script');
                        s.src = src;
                        s.async = false; // ensure ordered execution
                        document.body.appendChild(s);
                    }, idx * 100);
                })(queue[i], i);
            }
            setTimeout(function() {
                if(window._crumb)window._crumb('deferred_js_inject_done');
            }, queue.length * 100 + 50);
        }, { once: true });
    }


    // Clear previous load's crash log unconditionally
    // so the log doesn't accumulate stale entries across normal loads.
    try { localStorage.removeItem(CRASH_LOG_KEY); } catch(e) {}

    // Log this load as a breadcrumb
    window._crumb('page_load (crash_count=' + count + (isIOS ? ', iOS' : '') + ')');

    // iOS Safari: clean up WebGL contexts BEFORE the page unloads (refresh/navigation).
    // iOS keeps the old page in memory while loading the new one. If the old page has
    // active WebGL contexts (from model-viewer), the combined memory of old + new page
    // exceeds the per-process limit and causes an OOM crash.

    // Release a model-viewer: just remove src to free the model's memory.
    // Do NOT manually lose the WebGL context — model-viewer uses a shared
    // renderer, and losing it breaks rendering for ALL model-viewer elements.
    window._pbbReleaseModelViewer = function(mv) {
        if (!mv) return;
        mv.removeAttribute('src');
    };

    // ── iOS model-viewer Strategy (v2) ──────────────────────────────────
    // model-viewer uses a SHARED WebGL renderer across all instances, so
    // multiple <model-viewer> elements do NOT create multiple WebGL contexts.
    // The old placeholder system (v1) was creating/destroying elements which
    // caused memory leaks and fought model-viewer's internal management.
    //
    // New strategy: leave all <model-viewer> elements in the DOM. They have
    // loading="lazy" so they only load models when visible. We just manage
    // src attributes to control which models are loaded.  After the CE
    // registers we set modelCacheSize=0 to prevent memory buildup.
    if (isIOS) {
        // Activate a viewer: just set its src. No DOM replacement needed.
        window._pbbActivateViewer = function(id, srcOverride) {
            var el = document.getElementById(id);
            if (!el) return null;
            if (srcOverride) {
                el.setAttribute('src', srcOverride);
            }
            return el;
        };

        // Deactivate a viewer: remove src to free the model's memory.
        // Do NOT destroy the element or manually lose the WebGL context —
        // model-viewer's shared renderer handles that.
        window._pbbDeactivateViewer = function(id) {
            var el = document.getElementById(id);
            if (!el) return;
            el.removeAttribute('src');
        };

        // Strip extra viewers: on iOS, remove src from all model-viewers
        // that aren't the main tamagotchi, so they don't load models.
        // The elements stay in the DOM (shared renderer, no extra contexts).
        window._pbbStripExtraViewers = function() {
            var all = document.querySelectorAll('model-viewer[src]');
            var stripped = 0;
            for (var j = 0; j < all.length; j++) {
                if (all[j].id === 'tamagotchi-model') continue;
                all[j].removeAttribute('src');
                stripped++;
            }
            if (stripped > 0 && window._crumb) window._crumb('ios_cleared_src_' + stripped + '_viewers');
        };

        // Configure model-viewer for low memory after CE registers.
        // modelCacheSize=0 prevents memory buildup when swapping src.
        // powerPreference="low-power" reduces thermal/battery on iOS.
        customElements.whenDefined('model-viewer').then(function() {
            try {
                var MV = customElements.get('model-viewer');
                if (MV) {
                    MV.modelCacheSize = 0;
                    MV.powerPreference = 'low-power';
                    if (window._crumb) window._crumb('ios_mv_configured_cache0_lowpower');
                }
            } catch(e) {}
        });
    }

    // Universal helper: set src on a model-viewer by id.
    // Returns the element, or null if not found.
    // On iOS, if the element is a placeholder <div>, it gets restored to <model-viewer> first.
    window._pbbSetModelSrc = function(id, src) {
        var el = document.getElementById(id);
        if (!el) return null;
        // Restore placeholder to real model-viewer if needed (iOS optimization)
        if (el.dataset && el.dataset.mvPlaceholder) {
            el = window._pbbRestorePlaceholder(id);
            if (!el) return null;
        }
        if (src) el.setAttribute('src', src);
        return el;
    };

    // Universal helper: clear/release a model-viewer by id.
    // Just removes src — model-viewer's shared renderer handles cleanup.
    window._pbbClearModelSrc = function(id) {
        var el = document.getElementById(id);
        if (el) el.removeAttribute('src');
    };

    // iOS helper: restore a placeholder <div> back to a <model-viewer> element.
    // Used when a non-essential model-viewer is actually needed (user opens that view).
    window._pbbRestorePlaceholder = function(id) {
        var ph = document.getElementById(id);
        if (!ph || !ph.dataset || !ph.dataset.mvPlaceholder) return ph;
        var mv = document.createElement('model-viewer');
        mv.id = ph.id;
        mv.className = ph.className;
        mv.setAttribute('style', ph.getAttribute('style') || '');
        // Restore saved attributes
        var keys = Object.keys(ph.dataset);
        for (var i = 0; i < keys.length; i++) {
            if (keys[i].indexOf('mv_') === 0) {
                var attrName = keys[i].substring(3).replace(/_/g, '-');
                mv.setAttribute(attrName, ph.dataset[keys[i]]);
            }
        }
        ph.parentNode.replaceChild(mv, ph);
        return mv;
    };

    if (isIOS) {
        // On pagehide, aggressively free ALL WebGL/GPU resources.
        // iOS keeps the old page in memory while loading the new one — if WebGL
        // contexts survive, the combined memory of old + new page causes OOM.
        // Since the page is unloading, it's safe to destroy everything.
        window.addEventListener('pagehide', function() {
            try {
                // 0. Clear all tracked intervals to free timers & closures
                var intervalKeys = [
                    '_battleChallengeInterval', '_quizBattleChallengeInterval',
                    '_dmPollingInterval', '_coachPoll', 'workoutTimerInterval',
                    'workoutAutoSaveInterval', 'workoutTimer',
                    '_customExerciseRecTimerInterval'
                ];
                for (var ik = 0; ik < intervalKeys.length; ik++) {
                    if (window[intervalKeys[ik]]) {
                        clearInterval(window[intervalKeys[ik]]);
                        window[intervalKeys[ik]] = null;
                    }
                }
                // 1. Remove model src to free model data
                var viewers = document.querySelectorAll('model-viewer[src]');
                for (var i = 0; i < viewers.length; i++) {
                    viewers[i].removeAttribute('src');
                }
                // 2. Force-lose ALL WebGL contexts to free GPU memory.
                // This is safe on pagehide — the page is leaving, shared renderer
                // doesn't matter anymore.
                var canvases = document.querySelectorAll('canvas');
                for (var j = 0; j < canvases.length; j++) {
                    try {
                        var gl = canvases[j].getContext('webgl2') || canvases[j].getContext('webgl');
                        if (gl) {
                            var ext = gl.getExtension('WEBGL_lose_context');
                            if (ext) ext.loseContext();
                        }
                    } catch(e2) {}
                }
            } catch(e) {}
        });
        // Also listen to beforeunload as a backup — pagehide doesn't always fire
        // on iOS Safari when the page is killed under memory pressure.
        window.addEventListener('beforeunload', function() {
            try {
                var canvases = document.querySelectorAll('canvas');
                for (var j = 0; j < canvases.length; j++) {
                    try {
                        var gl = canvases[j].getContext('webgl2') || canvases[j].getContext('webgl');
                        if (gl) {
                            var ext = gl.getExtension('WEBGL_lose_context');
                            if (ext) ext.loseContext();
                        }
                    } catch(e2) {}
                }
            } catch(e) {}
        });

        // On visibilitychange (user switches to another app/tab), release all models
        // to free GPU memory.  iOS keeps the page alive but under memory pressure;
        // releasing models prevents Jetsam from killing the process.
        // On return, restore only the main tamagotchi model.
        //
        // IMPORTANT: Only activate AFTER init completes. During page load, a
        // visibility change (splash screen, app switch) would strip model src
        // while scripts are still loading, causing an OOM crash from the
        // simultaneous GPU cleanup + JS parsing memory pressure.
        window._pbbVisibilityHandlerActive = false;
        window.addEventListener('pbbInitComplete', function() {
            window._pbbInitDone = true;
            window._pbbVisibilityHandlerActive = true;
        }, { once: true });
        document.addEventListener('visibilitychange', function() {
            if (!window._pbbVisibilityHandlerActive) {
                if (window._crumb) window._crumb('ios_visibility_SKIPPED_not_init');
                return;
            }
            try {
                if (document.hidden) {
                    // Going to background — save main model src and release everything
                    var mv = document.getElementById('tamagotchi-model');
                    if (mv && mv.getAttribute('src')) {
                        window._pbbSavedTamagotchiSrc = mv.getAttribute('src');
                    }
                    var viewers = document.querySelectorAll('model-viewer[src]');
                    for (var i = 0; i < viewers.length; i++) {
                        viewers[i].removeAttribute('src');
                    }
                    if (window._crumb) window._crumb('ios_visibility_hidden_released_' + viewers.length);
                } else {
                    // Returning to foreground — restore main model only
                    if (window._pbbSavedTamagotchiSrc) {
                        var mv = document.getElementById('tamagotchi-model');
                        if (mv && !mv.getAttribute('src')) {
                            mv.setAttribute('src', window._pbbSavedTamagotchiSrc);
                        }
                    }
                    if (window._crumb) window._crumb('ios_visibility_visible_restored');
                }
            } catch(e) {}
        });

        // WebGL context loss recovery — model-viewer uses a shared renderer.
        // When Safari kills the WebGL context under memory pressure, ALL model-viewer
        // elements go blank (black screen).  This listener detects the loss, shows the
        // emoji fallback, and attempts to recover by re-setting src after a delay.
        window._pbbSetupContextLossRecovery = function() {
            // model-viewer renders into a shared canvas.  Find it after CE registers.
            customElements.whenDefined('model-viewer').then(function() {
                // The shared canvas is inside the first model-viewer's shadow DOM
                // or as a child of the model-viewer element.  We also listen on the
                // document level since model-viewer may manage its own canvas lifecycle.
                var mv = document.getElementById('tamagotchi-model');
                if (!mv) return;

                // model-viewer fires its own 'error' event on context loss, but we
                // also watch for the native webglcontextlost on any canvas in the page.
                document.addEventListener('webglcontextlost', function(e) {
                    e.preventDefault(); // Required to allow context restore
                    if (window._crumb) window._crumb('webgl_context_LOST');

                    // Show fallback
                    var fb = document.getElementById('tamagotchi-fallback');
                    var fbMsg = document.getElementById('tamagotchi-fallback-msg');
                    if (fb) fb.style.display = 'flex';
                    if (fbMsg) fbMsg.textContent = 'Recovering 3D...';
                    if (mv) mv.style.opacity = '0';

                    // Attempt recovery: release all models, wait, then restore main model
                    try {
                        var viewers = document.querySelectorAll('model-viewer[src]');
                        var mainSrc = mv.getAttribute('src') || window._pbbSavedTamagotchiSrc;
                        window._pbbSavedTamagotchiSrc = mainSrc;
                        for (var i = 0; i < viewers.length; i++) {
                            viewers[i].removeAttribute('src');
                        }
                    } catch(ex) {}

                    // After GPU has time to recover, reload the main model
                    setTimeout(function() {
                        if (window._pbbSavedTamagotchiSrc) {
                            mv.setAttribute('src', window._pbbSavedTamagotchiSrc);
                            mv.style.opacity = '1';
                            // Hide fallback when model loads
                            mv.addEventListener('load', function onRecover() {
                                mv.removeEventListener('load', onRecover);
                                var fb = document.getElementById('tamagotchi-fallback');
                                if (fb) fb.style.display = 'none';
                                if (window._crumb) window._crumb('webgl_context_RECOVERED');
                            });
                        }
                    }, 2000);
                }, true); // Use capture to catch canvas events before model-viewer

                document.addEventListener('webglcontextrestored', function() {
                    if (window._crumb) window._crumb('webgl_context_restored_event');
                }, true);
            });
        };
        // Call setup after model-viewer CE is likely available
        window.addEventListener('pbbInitComplete', function() {
            // Note: _pbbStripExtraViewers is NOT called here because
            // script_part_3.js already replaces non-main model-viewer
            // elements with <div> placeholders BEFORE the CE loads.
            // Running strip after placeholder replacement would be a no-op
            // (no model-viewer[src] to strip) and the two strategies
            // must not run simultaneously.
            setTimeout(window._pbbSetupContextLossRecovery, 5000);
        }, { once: true });
    }

    // ── Debug overlay ─────────────────────────────────────────
    // Shows crash breadcrumbs on-screen so we can diagnose crashes
    // on real devices without Xcode. Tap the overlay 5 times to dismiss.
    if (isIOS) {
        var debugDiv = document.createElement('div');
        debugDiv.id = '_pbb_debug';
        debugDiv.style.cssText = 'position:fixed;bottom:0;left:0;right:0;max-height:30vh;overflow-y:auto;' +
            'background:rgba(0,0,0,0.85);color:#0f0;font:10px/1.3 monospace;padding:8px;z-index:999999;' +
            'pointer-events:auto;-webkit-overflow-scrolling:touch;';
        debugDiv.innerHTML = '<b>PBB Debug (crash_count=' + count + ', iOS=' + isIOS + ')</b><br>';

        var tapCount = 0;
        debugDiv.addEventListener('click', function() {
            tapCount++;
            if (tapCount >= 5) debugDiv.style.display = 'none';
        });

        // Append early
        if (document.body) {
            document.body.appendChild(debugDiv);
        } else {
            document.addEventListener('DOMContentLoaded', function() {
                document.body.appendChild(debugDiv);
            });
        }

        // Override _crumb to also write to the debug overlay
        var origCrumb = window._crumb;
        window._crumb = function(step) {
            if (origCrumb) origCrumb(step);
            try {
                var d = document.getElementById('_pbb_debug');
                if (d) {
                    var elapsed = ((Date.now() - now) / 1000).toFixed(1);
                    d.innerHTML += elapsed + 's: ' + step + '<br>';
                    d.scrollTop = d.scrollHeight;
                }
            } catch(e2) {}
        };

        // Catch unhandled errors and show them
        window.addEventListener('error', function(ev) {
            try {
                var d = document.getElementById('_pbb_debug');
                if (d) {
                    d.innerHTML += '<span style="color:red">ERR: ' +
                        (ev.message || 'unknown') + ' @ ' +
                        (ev.filename || '').split('/').pop() + ':' + (ev.lineno || '?') +
                        '</span><br>';
                    d.scrollTop = d.scrollHeight;
                }
            } catch(e2) {}
        });

        // Show memory info if available
        if (window.performance && performance.memory) {
            setInterval(function() {
                try {
                    var d = document.getElementById('_pbb_debug');
                    if (d && d.style.display !== 'none') {
                        var mem = performance.memory;
                        var used = (mem.usedJSHeapSize / 1048576).toFixed(1);
                        var total = (mem.totalJSHeapSize / 1048576).toFixed(1);
                        d.innerHTML += '<span style="color:cyan">MEM: ' + used + '/' + total + 'MB</span><br>';
                        d.scrollTop = d.scrollHeight;
                    }
                } catch(e2) {}
            }, 5000);
        }
    }
})();