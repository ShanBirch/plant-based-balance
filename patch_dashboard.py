import os

with open('dashboard.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace authHelpers.signOut() inline handler with a custom function call
old_btn = 'onclick="authHelpers.signOut()"'
new_btn = 'onclick="handleLogout()"'

content = content.replace(old_btn, new_btn)

# Now we need to inject the handleLogout function somewhere.
# A good place is right before the closing </script> tag at the end of the file, or just before </body>.
# Let's find the closing </body> tag.

logout_script = """
<script>
async function handleLogout() {
    // Clear user-specific caches in localStorage
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
    
    // Clear session storage as well
    sessionStorage.clear();

    // Call Supabase sign out
    if (window.authHelpers && typeof window.authHelpers.signOut === 'function') {
        try {
            await window.authHelpers.signOut();
        } catch (e) {
            console.error("Error signing out:", e);
        }
    }
    
    // Redirect to login page
    window.location.href = '/login.html';
}
</script>
</body>
"""

content = content.replace("</body>", logout_script)

with open('dashboard.html', 'w', encoding='utf-8') as f:
    f.write(content)
