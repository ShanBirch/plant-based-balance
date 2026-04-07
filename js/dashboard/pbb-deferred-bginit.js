(function() {
        function initBackground() {
            const savedBg = localStorage.getItem('selectedBackground') || 'none';
            if (window.selectBackground) {
                window.selectBackground(savedBg);
                return;
            }
            // Fallback if selectBackground not yet available - default to plain dark background
            const container = document.getElementById('tamagotchi-widget-container');
            if (!container) return;
            const ALL_BG = ['tamagotchi-bg-none','tamagotchi-bg-gym','tamagotchi-bg-park','tamagotchi-bg-home','tamagotchi-bg-beach','tamagotchi-bg-mountain','tamagotchi-bg-dojo','tamagotchi-bg-arena'];
            ALL_BG.forEach(t => container.classList.remove(t));
            container.classList.add('tamagotchi-bg-none');
            const staticBg = document.getElementById('tamagotchi-static-bg');
            const bgModel = document.getElementById('tamagotchi-bg-model');
            const floor = document.getElementById('tamagotchi-floor');
            if (staticBg) staticBg.style.display = 'none';
            if (bgModel) bgModel.style.display = 'none';
            if (floor) floor.style.display = 'none';
        }
        // Run after a short delay so models have time to initialize
        setTimeout(initBackground, 2500);
        // Also expose for other code
        window._initBackground = initBackground;
    })();