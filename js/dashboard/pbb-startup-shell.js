(function(root) {
    'use strict';
    function waitFor(test, timeoutMs) {
        return new Promise(function(resolve, reject) {
            var started = Date.now();
            function check() {
                if (test()) return resolve();
                if (Date.now() - started >= timeoutMs) return reject(new Error('Home setup is still loading'));
                setTimeout(check, 50);
            }
            check();
        });
    }
    function bounded(promise, timeoutMs) {
        return new Promise(function(resolve, reject) {
            var timer = setTimeout(function() { reject(new Error('Home setup timed out')); }, timeoutMs);
            Promise.resolve(promise).then(function(value) { clearTimeout(timer); resolve(value); }, function(error) { clearTimeout(timer); reject(error); });
        });
    }
    async function prepare() {
        var refreshTimeout = root._pbbStartupRefreshTimeoutMs || 8000;
        await waitFor(function() {
            var styles = Array.from(document.querySelectorAll('link[rel="stylesheet"][href*="dashboard/"]'));
            return styles.length > 0 && styles.every(function(link) { return !!link.sheet && link.media !== 'print'; });
        }, 15000);
        // Home cards are enhancements, not login prerequisites. Keep their
        // saved state and let them finish/retry independently after opening.
        var jobs = [];
        if (root.weeklyGoals && !root.weeklyGoals.getState().week) {
            jobs.push(bounded(Promise.resolve().then(function() { return root.weeklyGoals.refresh(); }), refreshTimeout));
        }
        if (root.socialJourney) jobs.push(bounded(Promise.resolve().then(function() { return root.socialJourney.refresh(); }), refreshTimeout));
        if (root.pbbNextSteps) jobs.push(bounded(Promise.resolve().then(function() { return root.pbbNextSteps.refreshStatus(); }), refreshTimeout));
        var results = await Promise.allSettled(jobs);
        root._pbbHomeRefreshDeferred = results.some(function(result) { return result.status === 'rejected' || result.value === false; });
        if (root._pbbHomeRefreshDeferred && root._crumb) root._crumb('home_refresh_deferred');
        if (root.pbbNextSteps) {
            try { root.pbbNextSteps.refresh(); } catch (error) { root._pbbHomeRefreshDeferred = true; }
        }
        // Commit styles and the final card order before the loader starts fading.
        await new Promise(function(resolve) { requestAnimationFrame(function() { requestAnimationFrame(resolve); }); });
    }
    function reveal() { document.documentElement.setAttribute('data-pbb-shell-ready', 'true'); }
    function fail() {
        var overlay = document.getElementById('login-loading-overlay');
        if (!overlay) return;
        overlay.classList.remove('fade-out');
        overlay.style.display = 'flex';
        overlay.style.opacity = '1';
        overlay.replaceChildren();
        var message = document.createElement('p');
        message.textContent = 'Your setup is taking longer to load. Please try again.';
        message.style.cssText = 'display:block!important;opacity:1!important;color:#514b41;-webkit-text-fill-color:#514b41;text-align:center;max-width:320px;font:16px/1.5 sans-serif;';
        var button = document.createElement('button');
        button.textContent = 'Retry';
        button.style.cssText = 'min-height:48px;padding:12px 28px;border:0;border-radius:14px;background:#d8b25e;color:#101010;font-weight:700;';
        button.onclick = function() {
            button.disabled = true;
            button.textContent = 'Opening…';
            // A fresh request avoids repeating a broken cached startup page.
            var url = new URL(root.location.href);
            url.searchParams.set('startup_retry', Date.now().toString());
            root.location.replace(url.href);
        };
        overlay.append(message, button);
    }
    root.BalanceStartupShell = { prepare: prepare, reveal: reveal, fail: fail };
})(window);
