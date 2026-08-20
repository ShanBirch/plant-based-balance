(function () {
    'use strict';

    var params = new URLSearchParams(window.location.search);
    var target = String(params.get('admin_target') || '').trim().toLowerCase();
    if (!params.get('view_as') || !['program', 'meal-plan'].includes(target)) return;

    var startedAt = Date.now();
    var timer = null;

    function openAdminTarget() {
        if (!window.isAdminViewing) return false;
        if (target === 'program' && typeof window.openYourWorkouts === 'function') {
            window.openYourWorkouts();
            return true;
        }
        if (target === 'meal-plan'
            && typeof window.switchAppTab === 'function'
            && typeof window.openAiMealPlanView === 'function') {
            var mealsButton = document.querySelector('.bottom-nav .nav-item[onclick*="meals"]');
            window.switchAppTab('meals', mealsButton);
            window.setTimeout(function () {
                window.openAiMealPlanView(document.getElementById('browse-plans-pill'));
            }, 250);
            return true;
        }
        return false;
    }

    function tryOpen() {
        if (openAdminTarget() || Date.now() - startedAt > 25000) {
            if (timer) window.clearInterval(timer);
        }
    }

    if (document.readyState === 'complete') {
        timer = window.setInterval(tryOpen, 250);
        tryOpen();
    } else {
        window.addEventListener('load', function () {
            timer = window.setInterval(tryOpen, 250);
            tryOpen();
        }, { once: true });
    }
})();
