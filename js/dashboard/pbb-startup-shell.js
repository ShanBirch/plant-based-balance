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
        await waitFor(function() {
            var styles = Array.from(document.querySelectorAll('link[rel="stylesheet"][href*="dashboard/"]'));
            return root.socialJourney && root.pbbNextSteps && root.weeklyGoals && styles.every(function(link) { return !!link.sheet && link.media !== 'print'; });
        }, 15000);
        if (!root.weeklyGoals.getState().week) await bounded(root.weeklyGoals.refresh(), 15000);
        await waitFor(function() { return !root.weeklyGoals.getState().loading; }, 15000);
        var ready = await bounded(root.socialJourney.refresh(), 15000);
        if (ready === false) throw new Error('Could not load saved Home setup');
        await bounded(root.pbbNextSteps.refreshStatus(), 15000);
        root.pbbNextSteps.refresh();
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
        message.style.cssText = 'color:var(--pbb-loading-copy,#655f55);text-align:center;max-width:320px;font:16px/1.5 sans-serif;';
        var button = document.createElement('button');
        button.textContent = 'Retry';
        button.style.cssText = 'min-height:48px;padding:12px 28px;border:0;border-radius:14px;background:#d8b25e;color:#101010;font-weight:700;';
        button.onclick = function() { root.location.reload(); };
        overlay.append(message, button);
    }
    root.BalanceStartupShell = { prepare: prepare, reveal: reveal, fail: fail };
})(window);
