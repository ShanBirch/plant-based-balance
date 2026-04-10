(function() {
        function initBackground() {
            const savedBg = localStorage.getItem('selectedBackground');
            // Only apply a saved preference. If nothing is saved, do nothing here —
            // applyBackgroundForLevel (dashboard-script-14) handles the default gym
            // background, and dashboard-script-5 restores the DB preference once the
            // profile loads. Writing 'none' to localStorage here would block that
            // restoration check which guards on !localStorage.getItem('selectedBackground').
            if (!savedBg) return;
            if (window.selectBackground) {
                window.selectBackground(savedBg);
            }
        }
        // Run after a short delay so models have time to initialize
        setTimeout(initBackground, 2500);
        // Also expose for other code
        window._initBackground = initBackground;
    })();