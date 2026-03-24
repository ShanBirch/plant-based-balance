(function() {
    // Show only if explicitly enabled via ?debug=1 or localStorage flag
    var show = (location.search.includes('debug=1')) || localStorage.getItem('pbb_debug') === '1';
    if (!show) return;

    var panel = document.getElementById('pbb-debug-panel');
    panel.style.display = 'block';

    // Tap 3× quickly to dismiss
    var taps = 0;
    panel.addEventListener('click', function() {
        taps++;
        if (taps >= 3) { panel.style.display = 'none'; taps = 0; }
        setTimeout(function() { taps = 0; }, 800);
    });

    function ts() {
        return new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
    }

    function log(color, msg) {
        var line = document.createElement('div');
        line.style.color = color;
        line.textContent = '[' + ts() + '] ' + msg;
        panel.appendChild(line);
        panel.scrollTop = panel.scrollHeight;
    }

    // Expose log so _crumb() in JS can write to the panel
    window._pbbDebugLog = log;

    // Header
    log('#ffffff', '=== PBB Debug Panel ===');
    log('#aaaaaa', 'UA: ' + navigator.userAgent.slice(0, 80));
    log('#aaaaaa', 'SW: ' + ('serviceWorker' in navigator ? 'supported' : 'NOT supported'));
    if (window._pbbSafeMode) log('#ff6b6b', 'SAFE MODE ACTIVE (crash count: ' + window._pbbCrashCount + ')');
    if (window._pbbIsIOSSafari) log('#ffdd00', 'iOS Safari detected');

    // --- Show crash breadcrumbs from the PREVIOUS load ---
    try {
        var prevLog = JSON.parse(localStorage.getItem('_pbb_crash_log') || '[]');
        if (prevLog.length) {
            log('#ff8800', '--- CRASH LOG FROM LAST LOAD (' + prevLog.length + ' steps) ---');
            prevLog.forEach(function(e) {
                var t = new Date(e.ts).toISOString().slice(11, 23);
                var isLast = (e === prevLog[prevLog.length - 1]);
                var mvInfo = (e.mv !== undefined) ? ' [mv:' + e.mv + ']' : '';
                log(isLast ? '#ff4444' : '#ff8800', '[' + t + '] ' + e.step + mvInfo + (isLast ? ' ← LAST BEFORE CRASH' : ''));
            });
            log('#ff8800', '--- END CRASH LOG ---');
        } else {
            log('#aaaaaa', 'No crash log from previous load');
        }
        // Clear so next load starts fresh
        localStorage.removeItem('_pbb_crash_log');
    } catch(e) {
        log('#ff4444', 'Could not read crash log: ' + e);
    }

    // SW state
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(function(reg) {
            if (!reg) { log('#ff4444', 'SW: no registration found'); return; }
            var state = reg.active ? 'active' : reg.installing ? 'installing' : reg.waiting ? 'waiting' : 'unknown';
            log('#00ff88', 'SW reg state: ' + state);
            log('#aaaaaa', 'SW scope: ' + reg.scope);
        }).catch(function(e) {
            log('#ff4444', 'SW getRegistration error: ' + e);
        });

        // Listen for broadcasts from the service worker
        navigator.serviceWorker.addEventListener('message', function(event) {
            var d = event.data;
            if (!d || d.type !== 'SW_DEBUG') return;
            var evt = d.event || '?';
            var color = evt.includes('error') ? '#ff6666'
                      : evt.includes('cached') || evt === 'all_models_done' || evt === 'sw_active' ? '#00ff88'
                      : '#ffdd00';
            var extra = '';
            if (d.model) extra += ' ' + d.model;
            if (d.source) extra += ' [' + d.source + ']';
            if (d.ms)     extra += ' ' + d.ms + 'ms';
            if (d.detail) extra += ' ⚠ ' + d.detail;
            log(color, 'SW→ ' + evt + extra);
        });
    }

    // Track every model-viewer load/error on the page
    document.addEventListener('load', function(e) {
        var el = e.target;
        if (el && el.tagName && el.tagName.toLowerCase() === 'model-viewer') {
            var src = (el.getAttribute('src') || '').split('/').pop();
            log('#00ff88', 'model-viewer LOADED: ' + (src || el.id || '?'));
        }
    }, true);

    document.addEventListener('error', function(e) {
        var el = e.target;
        if (el && el.tagName && el.tagName.toLowerCase() === 'model-viewer') {
            var src = (el.getAttribute('src') || '').split('/').pop();
            log('#ff4444', 'model-viewer ERROR: ' + (src || el.id || '?'));
        }
    }, true);

    // Catch unhandled JS errors
    window.addEventListener('error', function(e) {
        log('#ff4444', 'JS ERROR: ' + (e.message || e) + ' (' + (e.filename || '').split('/').pop() + ':' + e.lineno + ')');
    });

    window.addEventListener('unhandledrejection', function(e) {
        log('#ff8800', 'UNHANDLED PROMISE: ' + (e.reason && e.reason.message ? e.reason.message : String(e.reason)));
    });

    log('#aaaaaa', 'Tap panel 3× to dismiss');
})();