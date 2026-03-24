(function() {
    var ADMIN_BACKUP_KEY = '_admin_ls_backup';
    var isViewAs = new URLSearchParams(window.location.search).get('view_as');

    // All user-specific localStorage keys that must be isolated
    var USER_KEYS = [
        'userProfile', 'dashboardInitialized',
        'fitgotchi_model_src', 'fitgotchi_camera_orbit', 'fitgotchi_fov', 'fitgotchi_scale',
        'fitgotchi_level', 'fitgotchi_rank', 'fitgotchi_xp_text', 'fitgotchi_xp_percent', 'fitgotchi_streak',
        'profile_photo', 'userGender', 'userThemePreference', 'dietaryPreference',
        'pbb_water_goal_ml', 'weighInDoneCardDismissedDate', 'quizDoneCardDismissedDate',
        'dailyQuizLessonToday', 'progressPhotoDoneCardDismissedDate', 'mealTipCardDismissedDate',
        'workoutTrendCardDismissedDate', 'movementTrendCardDismissedDate', 'myCurrentWorkout',
        'myCurrentWorkoutId', 'weightUnitPreference', 'lastWellnessCheck', 'pbb_points_data',
        'pbb_points_level', 'onboardingComplete', 'program_start_date',
        'battleStats', 'unallocatedStatPoints', 'previousLifetimePoints', 'pendingLevelUpCelebration',
        'selectedBackground', 'cachedNutritionStreak', 'cachedNutritionData', 'myChatStats', 'plant_based_learning_progress',
        'customPBSlots', 'pbSlotsMigratedV2'
    ];

    if (isViewAs) {
        // ENTERING view-as mode: backup admin's localStorage, then clear
        // Only create backup if one doesn't already exist — prevents overwriting
        // the admin's original data when navigating between viewed users
        if (!localStorage.getItem(ADMIN_BACKUP_KEY)) {
            var backup = {};
            USER_KEYS.forEach(function(k) {
                var v = localStorage.getItem(k);
                if (v !== null) backup[k] = v;
            });
            localStorage.setItem(ADMIN_BACKUP_KEY, JSON.stringify(backup));
        }
        USER_KEYS.forEach(function(k) { localStorage.removeItem(k); });
        sessionStorage.clear();
    } else if (localStorage.getItem(ADMIN_BACKUP_KEY)) {
        // RETURNING from view-as mode: restore admin's localStorage
        try {
            var backup = JSON.parse(localStorage.getItem(ADMIN_BACKUP_KEY));
            // Clear any viewed-user data that may have been written
            USER_KEYS.forEach(function(k) { localStorage.removeItem(k); });
            // Restore admin's original values
            Object.keys(backup).forEach(function(k) {
                localStorage.setItem(k, backup[k]);
            });
        } catch (e) { /* ignore parse errors */ }
        localStorage.removeItem(ADMIN_BACKUP_KEY);
    }
})();