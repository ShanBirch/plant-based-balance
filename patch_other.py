import os

def patch_file(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    if 'onclick="authHelpers.signOut()"' in content:
        content = content.replace('onclick="authHelpers.signOut()"', 'onclick="handleLogout()"')
        
        logout_script = """
<script>
async function handleLogout() {
    const keysToClear = [
        'userProfile', 'dashboardInitialized', 'fitgotchi_model_src', 'fitgotchi_camera_orbit', 
        'fitgotchi_fov', 'fitgotchi_scale', 'fitgotchi_level', 'fitgotchi_rank', 'fitgotchi_xp_text', 
        'fitgotchi_xp_percent', 'fitgotchi_streak', 'profile_photo', 'userGender', 'userThemePreference', 
        'pbb_points_data', 'pbb_points_level', 'battleStats', 'unallocatedStatPoints', 'active_rare_skin',
        'dietaryPreference', 'pbb_water_goal_ml', 'weighInDoneCardDismissedDate', 'quizDoneCardDismissedDate',
        'dailyQuizLessonToday', 'progressPhotoDoneCardDismissedDate', 'mealTipCardDismissedDate',
        'workoutTrendCardDismissedDate', 'movementTrendCardDismissedDate', 'myCurrentWorkout',
        'myCurrentWorkoutId', 'weightUnitPreference', 'lastWellnessCheck', 'onboardingComplete', 
        'program_start_date', 'previousLifetimePoints', 'pendingLevelUpCelebration',
        'selectedBackground', 'myChatStats', 'plant_based_learning_progress', 'active_evolution_skin'
    ];
    
    keysToClear.forEach(k => localStorage.removeItem(k));
    sessionStorage.clear();

    if (window.authHelpers && typeof window.authHelpers.signOut === 'function') {
        try { await window.authHelpers.signOut(); } catch (e) { console.error("Error signing out:", e); }
    }
    
    window.location.href = '/login.html';
}
</script>
</body>
"""
        if 'function handleLogout' not in content:
            content = content.replace("</body>", logout_script)

        with open(filename, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Patched {filename}")

patch_file('admin-dashboard.html')
patch_file('battle-arena.html')
patch_file('calculators.html')
patch_file('meal_library.html')
patch_file('shop.html')
patch_file('workout-duel.html')
