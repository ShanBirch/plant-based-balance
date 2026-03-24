(function() {
        const bar = document.getElementById('spotify-now-playing');
        if (!bar) return;

        let dragging = false;
        let startY = 0;
        let startBottom = 0;
        let moved = false;
        const MIN_BOTTOM = 72;  // above bottom nav

        function getBottom() {
            return parseInt(bar.style.bottom) || MIN_BOTTOM;
        }

        function clampBottom(b) {
            const maxBottom = window.innerHeight - bar.offsetHeight - 10;
            return Math.max(MIN_BOTTOM, Math.min(b, maxBottom));
        }

        // Restore saved position whenever the bar becomes visible
        function restoreSavedPosition() {
            try {
                const saved = localStorage.getItem('spotify-mini-bottom');
                if (saved) bar.style.bottom = saved;
            } catch(_) {}
        }

        // Patch updatePlayerUI's display toggle so we restore position after it shows the bar
        const _origUpdatePlayerUI = window.updatePlayerUI || null;
        const displayProp = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'display');
        // Use a simpler approach: poll for display changes instead of MutationObserver
        let _lastDisplay = bar.style.display;
        setInterval(function() {
            const cur = bar.style.display;
            if (cur !== 'none' && _lastDisplay === 'none') restoreSavedPosition();
            _lastDisplay = cur;
        }, 500);

        bar.addEventListener('touchstart', function(e) {
            // Don't hijack button taps — only drag from the bar area itself
            if (e.target.closest('button')) return;
            dragging = true;
            moved = false;
            startY = e.touches[0].clientY;
            startBottom = getBottom();
            bar.style.transition = 'none';
        }, { passive: true });

        bar.addEventListener('touchmove', function(e) {
            if (!dragging) return;
            const dy = startY - e.touches[0].clientY;
            if (Math.abs(dy) > 5) moved = true;
            if (!moved) return;
            e.preventDefault();
            bar.style.bottom = clampBottom(startBottom + dy) + 'px';
        }, { passive: false });

        bar.addEventListener('touchend', function() {
            if (!dragging) return;
            dragging = false;
            // Save position so it persists while music plays
            try { localStorage.setItem('spotify-mini-bottom', bar.style.bottom); } catch(_) {}
        }, { passive: true });

        // Suppress onclick/openInSpotify when user was dragging
        bar.addEventListener('click', function(e) {
            if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; }
        }, true);
    })();