// Initialize Stripe for in-app purchases
window.stripe = Stripe('pk_live_51GmycUCGCyRUsOfK9lOtnZNvinxCcjf7rZnpC0ter8eShFPATzVKB7ypy2BPQbMRkuWT67mf04tjzvu18jQvmlZX00BvlGLyds');

// PWA & Navigation Logic
document.addEventListener('DOMContentLoaded', () => {
    // Handle Coin Pack purchase return
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('coin_purchase') === 'success') {
        const packName = urlParams.get('pack') || 'coins';
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => {
            alert('Coins added to your balance! Time to compete.');
            if (typeof loadCoinBalance === 'function') loadCoinBalance();
        }, 500);
    }

    // Handle tab deep-link (e.g., returning from workout-duel page)
    const deepLinkTab = urlParams.get('tab');
    if (deepLinkTab) {
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => {
            if (typeof switchAppTab === 'function') {
                switchAppTab(deepLinkTab);
            }
        }, 300);
    }

    // Handle legacy challenge pass/buyin returns
    if (urlParams.get('challenge_pass') === 'success' || urlParams.get('challenge_buyin') === 'success') {
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => {
            const pendingId = urlParams.get('challenge_id') || sessionStorage.getItem('pending_challenge_id');
            sessionStorage.removeItem('pending_challenge_id');
            if (pendingId && typeof doAcceptChallenge === 'function') {
                doAcceptChallenge(pendingId);
            }
        }, 500);
    }

    // 0. Chat History now loaded in consolidated auth-aware block

    // 1. Move Sections out of Meals Container
    // We want Movement and Support to be top-level app views, not sub-views of Meals
    const moveIds = ['movement-tab', 'group', 'sleep', 'view-active-workout', 'view-workout-success', 'view-profile'];
    const container = document.querySelector('.container');
    const bottomNav = document.querySelector('.bottom-nav');
    
    moveIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('active');
            el.classList.add('app-view'); // Treat as top level view
            el.style.display = 'none'; // Hide initially
            // Move to main container
            container.appendChild(el);
        }
    });

    // Move fixed overlay views to body level to avoid z-index stacking context issues
    const overlayIds = ['view-your-workouts', 'view-workout-library', 'view-workout-subcategories', 'view-workout-list', 'view-workout-overview'];
    overlayIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            document.body.appendChild(el);
        }
    });

    // 2. Initialize (Now handled by the consolidated listener above)
    // initProgramDate(); 
    // switchAppTab('dashboard', document.querySelector('.nav-item')); // Default to Home
});

// --- DAILY CONTENT LOGIC ---
async function initProgramDate() {
    let startDate = null;
    try {
        const profile = await window.getUserProfile();
        startDate = profile?.program_start_date;
    } catch(e) {}

    if (!startDate) {
        startDate = localStorage.getItem('pbb_start_date');
    }

    if (!startDate) {
        startDate = new Date().toISOString();
    }

    // Always ensure localStorage is synced with the current start date
    localStorage.setItem('pbb_start_date', startDate);

    const start = new Date(startDate);
    const now = new Date();
    const diffTime = Math.abs(now - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let currentDay = diffDays;
    if (currentDay < 1) currentDay = 1;

    updateDailyContent(currentDay);
}

function updateDailyContent(day) {
    const counterEl = document.getElementById('daily-progress-counter');
    if (counterEl) {
        counterEl.innerText = `Day ${day} of 28`;
        if (day > 28) counterEl.innerText = `Day ${day} (Maintenance)`;
    }

    // Update Movement Tab Header
    const moveDate = document.getElementById('movement-today-date');
    if (moveDate) {
        moveDate.innerText = `Day ${day}`;
    }

    // --- NEW: Render Today's Meals Logic ---
    const todayContainer = document.getElementById('today-meals-content');
    if (todayContainer) {
        const weekNum = Math.ceil(day / 7);
        const dayIndex = (day - 1) % 7;
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const dayName = days[dayIndex];
        const sourceId = `week${weekNum}-${dayName}`;
        
        const sourceCard = document.getElementById(sourceId);
        
        if (sourceCard) {
            // Clone content but keep it generic/clean
            todayContainer.innerHTML = ''; // Clear loading
            const clone = sourceCard.cloneNode(true);
            
            // Adjust styling for 'Today' view if needed, or just append
            // We want it open by default
            clone.classList.add('open');
            clone.style.marginBottom = '20px';
            
            // Remove the ID to avoid duplicates in DOM
            clone.removeAttribute('id');
            
            // Fix onclick to toggle THIS clone, not the original ID
            const header = clone.querySelector('.card-header');
            if(header) header.setAttribute('onclick', 'toggleCard(this.parentElement)');
            
            todayContainer.appendChild(clone);
        } else {
            // Fallback if content not found
            todayContainer.innerHTML = `
                <div style="text-align:center; padding:40px; color:var(--text-muted);">
                    <p>Meals for Day ${day} (${dayName}, Week ${weekNum}) are loading...</p>
                    <button onclick="switchWeek('week${weekNum}', this)" style="margin-top:10px; padding:10px 20px; border-radius:30px; border:1px solid var(--primary); background:transparent; color:var(--primary); cursor:pointer;">View Week ${weekNum} Plan</button>
                    <!-- Debug: Looked for #${sourceId} -->
                </div>
            `;
        }
    }
}

// Real syncQuizDataToDb implementation - replaces the early stub
async function _syncQuizDataToDbRealImpl() {
    const user = window.currentUser;
    if (!user) return;

    try {
        const quizJson = sessionStorage.getItem('userProfile');
        const hormoneType = sessionStorage.getItem('userResult');

        let quizData = {};
        if (quizJson) {
             try { quizData = JSON.parse(quizJson); } catch(e) {}
        }

        // Add hormone type if present
        if (hormoneType) {
            quizData.profile = hormoneType;
        }

        // Map 'sex' to 'user_gender' for quiz users
        // Quiz collects 'sex' field, but we need 'user_gender' for UI/localStorage
        if (quizData.sex && !quizData.user_gender) {
            quizData.user_gender = quizData.sex;
            localStorage.setItem('userGender', quizData.sex);
        }

        // NOTE: Symptom derivation from quiz REMOVED
        // Symptoms can ONLY be set via daily wellness check-in to prevent persistent stale data
        // This ensures equipment selection is respected and symptoms stay current

        if (Object.keys(quizData).length > 0) {
            console.log("Syncing quiz data to DB...", quizData);

            // SPLIT DATA: Users table vs User Facts (personal_details)
            // sex is a core user attribute stored in users table
            // equipment_access is stored in quiz_results table (not users table)
            const userColumns = ['name', 'email', 'profile_photo', 'program_start_date', 'theme_preference', 'background_preference', 'location', 'sex'];
            const coreData = {};
            const factsData = {};

            Object.keys(quizData).forEach(k => {
                if (userColumns.includes(k)) coreData[k] = quizData[k];
                else factsData[k] = quizData[k];
            });

            // 1. Update Core User Data (user row already exists from signup)
            if (Object.keys(coreData).length > 0) {
                await dbHelpers.users.update(user.id, coreData);
            }

            // 2. Update Extension Data (User Facts)
            if (Object.keys(factsData).length > 0) {
                // Get existing facts first to merge
                let existingFacts = {};
                try { existingFacts = await dbHelpers.userFacts.get(user.id); } catch(e){}

                const currentDetails = existingFacts?.personal_details || {};

                await dbHelpers.userFacts.upsert(user.id, {
                    personal_details: { ...currentDetails, ...factsData }
                });
            }

            // 3. Calculate and Save Nutrition Goals if we have the required data
            // Check if nutrition goals were already pre-calculated by the onboarding wizard
            const hasPreCalculatedGoals = quizData.bmr && quizData.tdee && quizData.calorie_goal &&
                                          quizData.protein_goal_g && quizData.carbs_goal_g && quizData.fat_goal_g;

            // Default goalBodyType to 'Athletic' if not provided (balanced middle-ground for non-quiz users)
            const effectiveGoalBodyType = quizData.goalBodyType || 'Athletic';

            // Required fields: age, height, weight, goal_weight, activity_level, sex
            // goalBodyType is now optional (defaults to 'Athletic')
            const hasRequiredFields = quizData.age && quizData.height && quizData.weight &&
                                      quizData.goal_weight && quizData.activity_level && quizData.sex;

            if (hasPreCalculatedGoals || hasRequiredFields) {
                try {
                    let nutritionGoals;
                    let metricData;

                    if (hasPreCalculatedGoals) {
                        // Use pre-calculated values from onboarding wizard
                        console.log("Using pre-calculated nutrition goals from wizard");
                        nutritionGoals = {
                            bmr: quizData.bmr,
                            tdee: quizData.tdee,
                            calorie_goal: quizData.calorie_goal,
                            protein_goal_g: quizData.protein_goal_g,
                            carbs_goal_g: quizData.carbs_goal_g,
                            fat_goal_g: quizData.fat_goal_g
                        };
                        // For metric data, use direct values (wizard already uses metric)
                        metricData = {
                            age: quizData.age,
                            height: quizData.height,
                            weight: quizData.weight,
                            goal_weight: quizData.goal_weight,
                            sex: quizData.sex,
                            activity_level: quizData.activity_level,
                            goalBodyType: effectiveGoalBodyType
                        };
                    } else {
                        // Convert quiz data to metric units and calculate
                        const dataWithBodyType = { ...quizData, goalBodyType: effectiveGoalBodyType };
                        metricData = convertQuizDataToMetric(dataWithBodyType);
                        nutritionGoals = calculateNutritionGoals(metricData);
                    }

                    if (nutritionGoals) {
                        console.log("Calculated nutrition goals:", nutritionGoals);

                        // Save to quiz_results table
                        const quizResultData = {
                            menopause_status: quizData.menopause_status,
                            cycle_description: quizData.cycle_desc,
                            activity_level: quizData.activity_level,
                            weight_storage_location: quizData.weight_gain_location,
                            goal_body_type: effectiveGoalBodyType,
                            sleep_hours: quizData.sleep_hours,
                            sleep_quality: quizData.wake_feel,
                            energy_level: quizData.energy_level || quizData.energy_status, // Support both field names
                            energy_crashes: quizData.midday_crash,
                            caffeine_relationship: quizData.caffeine,
                            hormone_profile: hormoneType,
                            equipment_access: quizData.equipment_access || 'none',
                            age: metricData.age,
                            height: metricData.height,
                            weight: metricData.weight,
                            goal_weight: metricData.goal_weight,
                            sex: metricData.sex,
                            bmr: nutritionGoals.bmr,
                            tdee: nutritionGoals.tdee,
                            calorie_goal: nutritionGoals.calorie_goal,
                            protein_goal_g: nutritionGoals.protein_goal_g,
                            carbs_goal_g: nutritionGoals.carbs_goal_g,
                            fat_goal_g: nutritionGoals.fat_goal_g
                        };

                        await dbHelpers.quizResults.create(user.id, quizResultData);
                        console.log("Quiz results with nutrition goals saved to database");

                        // Update daily_nutrition goals for ALL existing entries
                        // This ensures that when onboarding is redone, all historical entries
                        // reflect the new calorie/macro goals instead of keeping stale values
                        const goalsToUpdate = {
                            calorie_goal: nutritionGoals.calorie_goal,
                            protein_goal_g: nutritionGoals.protein_goal_g,
                            carbs_goal_g: nutritionGoals.carbs_goal_g,
                            fat_goal_g: nutritionGoals.fat_goal_g
                        };

                        // First update all existing entries
                        await dbHelpers.nutrition.updateAllGoals(user.id, goalsToUpdate);
                        console.log("All daily nutrition goals updated");

                        // Also ensure today has an entry (updateAllGoals only updates existing rows)
                        const today = getLocalDateString();
                        await dbHelpers.nutrition.updateGoals(user.id, today, goalsToUpdate);
                        console.log("Today's nutrition goals ensured");

                        // CRITICAL FIX: Save sex to users table so it persists on page reload
                        // This fixes the bug where gender resets to female on refresh
                        await dbHelpers.users.update(user.id, {
                            sex: metricData.sex
                        });
                        console.log("User sex field saved to users table:", metricData.sex);
                    }

                    // Save meal timing schedule if set during quiz
                    if (quizData.meal_time_breakfast || quizData.meal_time_lunch || quizData.meal_time_dinner) {
                        try {
                            await dbHelpers.mealSchedule.upsert(user.id, {
                                breakfast: quizData.meal_time_breakfast || '08:00',
                                lunch: quizData.meal_time_lunch || '12:30',
                                dinner: quizData.meal_time_dinner || '18:30'
                            });
                            console.log("Meal schedule saved:", {
                                breakfast: quizData.meal_time_breakfast,
                                lunch: quizData.meal_time_lunch,
                                dinner: quizData.meal_time_dinner
                            });
                        } catch (mealScheduleError) {
                            console.error("Failed to save meal schedule:", mealScheduleError);
                        }
                    }
                } catch (nutritionError) {
                    console.error("Failed to calculate/save nutrition goals:", nutritionError);
                }
            }

            // Update local cache
            window.userProfile = { ...window.userProfile, ...quizData };
            console.log("Quiz data synced successfully");
        }
    } catch (e) {
        console.error("Failed to sync quiz data:", e);
    }
}
// Register real implementation
_syncQuizDataToDbReal = _syncQuizDataToDbRealImpl;
syncQuizDataToDb = _syncQuizDataToDbRealImpl;

async function handleLogout() {
    if (confirm('Are you sure you want to log out?')) {
        try {
            await authHelpers.signOut();
            // Clear any cached data
            sessionStorage.clear();

            // Clear all user-specific localStorage items to prevent data leak between accounts
            const userSpecificKeys = [
                'userProfile',
                'userGender',
                'onboardingComplete',
                'characterColors',
                'userThemePreference',
                'userCycleData',
                'profile_photo',
                'selected_meal_plan',
                'user_food_preferences',
                'meal_reminder_settings',
                'lastWellnessCheck',
                'lastWeighInPromptDate',
                'equipmentUpdatedAt',
                'gym_split_start_date',
                'calendarViewPreference',
                'referral_banner_dismissed',
                'pwa_banner_dismissed_v2',
                'pbb_biometric_credential',
                'pbb_biometric_email',
                'pbb_biometric_user_id'
            ];

            userSpecificKeys.forEach(key => localStorage.removeItem(key));

            window.location.href = '/login.html';
        } catch (error) {
            console.error('Logout failed:', error);
            alert('Failed to log out. Please try again.');
        }
    }
}

/**
 * Delete account - clears all user data and allows retesting onboarding
 */
async function handleDeleteAccount() {
    const confirmDelete = confirm('Are you sure you want to DELETE your account? This will:\n\n• Delete your profile and all personal data\n• Clear all progress and statistics\n• Remove all saved preferences\n\nThis action CANNOT be undone!');

    if (!confirmDelete) {
        return;
    }

    const confirmSecond = confirm('This is your final warning. Type "DELETE" in your next action if you want to permanently delete your account.');

    if (!confirmSecond) {
        return;
    }

    try {
        // Show loading message
        const deleteBtn = event?.target;
        if (deleteBtn) deleteBtn.disabled = true;

        const userId = window.currentUser?.id;
        if (!userId) {
            throw new Error('No user ID found');
        }

        // Delete all user-related data from Supabase
        // Delete from users table (will cascade to other tables if foreign keys are set up)
        if (window.supabaseClient) {
            try {
                await window.supabaseClient
                    .from('users')
                    .delete()
                    .eq('id', userId);
                console.log('User record deleted');
            } catch (e) {
                console.warn('Could not delete from users table:', e);
            }

            // Also try to delete from user_facts
            try {
                await window.supabaseClient
                    .from('user_facts')
                    .delete()
                    .eq('user_id', userId);
                console.log('User facts deleted');
            } catch (e) {
                console.warn('Could not delete from user_facts table:', e);
            }

            // Delete workout history
            try {
                await window.supabaseClient
                    .from('workout_history')
                    .delete()
                    .eq('user_id', userId);
                console.log('Workout history deleted');
            } catch (e) {
                console.warn('Could not delete from workout_history table:', e);
            }

            // Delete meal logs
            try {
                await window.supabaseClient
                    .from('meal_logs')
                    .delete()
                    .eq('user_id', userId);
                console.log('Meal logs deleted');
            } catch (e) {
                console.warn('Could not delete from meal_logs table:', e);
            }

            // Delete quiz results
            try {
                await window.supabaseClient
                    .from('quiz_results')
                    .delete()
                    .eq('user_id', userId);
                console.log('Quiz results deleted');
            } catch (e) {
                console.warn('Could not delete from quiz_results table:', e);
            }
        }

        // Sign out from auth
        if (window.authHelpers) {
            try {
                await authHelpers.signOut();
                console.log('Signed out successfully');
            } catch (e) {
                console.warn('Could not sign out:', e);
            }
        }

        // Clear ALL localStorage and sessionStorage
        sessionStorage.clear();
        localStorage.clear();

        // Redirect to onboarding to start fresh
        alert('Account deleted successfully! You can now set up a new profile.');
        window.location.href = '/';
    } catch (error) {
        console.error('Account deletion failed:', error);
        alert('Failed to delete account. Please try again or contact support.');
        const deleteBtn = event?.target;
        if (deleteBtn) deleteBtn.disabled = false;
    }
}

// Real loadProfileData implementation - replaces the early stub
async function _loadProfileDataRealImpl() {
    let profile = null;
    let quizResult = null;

    try {
        profile = await window.getUserProfile();
    } catch (e) {
        console.warn("Profile fetching error", e);
    }

    // Also fetch quiz results for equipment_access and energy_level
    try {
        if (window.currentUser?.id && typeof dbHelpers !== 'undefined') {
            quizResult = await dbHelpers.quizResults.getLatest(window.currentUser.id);
        }
    } catch (e) {
        console.warn("Quiz results fetching error", e);
    }

    // Merge quiz results into profile for easy access
    if (quizResult) {
        profile = { ...profile, ...quizResult };

        // Sync important quiz fields from database to localStorage
        try {
            const localProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
            let needsSave = false;

            // CRITICAL FIX: Sync equipment_access to localStorage so calendar/movement views have correct data
            if (quizResult.equipment_access && localProfile.equipment_access !== quizResult.equipment_access) {
                localProfile.equipment_access = quizResult.equipment_access;
                needsSave = true;
                console.log('✅ Equipment access synced from DB to localStorage:', quizResult.equipment_access);
            }

            // Sync cycle sync preferences
            if (quizResult.cycle_sync_preference && localProfile.cycle_sync_preference !== quizResult.cycle_sync_preference) {
                localProfile.cycle_sync_preference = quizResult.cycle_sync_preference;
                needsSave = true;
            }
            if (quizResult.period_energy_response && localProfile.period_energy_response !== quizResult.period_energy_response) {
                localProfile.period_energy_response = quizResult.period_energy_response;
                needsSave = true;
            }

            // Sync dietary preference
            if (quizResult.dietary_preference && localProfile.dietary_preference !== quizResult.dietary_preference) {
                localProfile.dietary_preference = quizResult.dietary_preference;
                localStorage.setItem('dietaryPreference', quizResult.dietary_preference);
                needsSave = true;
                console.log('Dietary preference synced from DB:', quizResult.dietary_preference);
            }

            if (needsSave) {
                localStorage.setItem('userProfile', JSON.stringify(localProfile));
                console.log('✅ Profile preferences synced from database');
            }
        } catch (e) {
            console.warn('Error syncing profile to localStorage:', e);
        }
    }

    // Sync water goal settings from DB to localStorage (for cross-device persistence)
    if (profile?.water_goal_ml && !localStorage.getItem('pbb_water_goal_ml')) {
        localStorage.setItem('pbb_water_goal_ml', profile.water_goal_ml.toString());
        localStorage.setItem('pbb_water_glass_size', (profile.water_glass_size || 250).toString());
        localStorage.setItem('pbb_water_total_glasses', (profile.water_total_glasses || Math.ceil(profile.water_goal_ml / (profile.water_glass_size || 250))).toString());
        console.log('Restored water goal from DB:', profile.water_goal_ml, 'ml');
    }

    // Fallback if DB fetch fail
    if (!profile) {
        try {
            profile = JSON.parse(sessionStorage.getItem('userProfile') || '{}');
        } catch(e) {}
    }

    const context = {
        name: profile?.name || window.currentUser?.user_metadata?.full_name || "Shannon",
        email: profile?.email || window.currentUser?.email || "shannon@example.com",
        age: profile?.age || "34",
        weight: profile?.weight || "68 kg",
        goal: profile?.goal_weight || profile?.goal || "Fat Loss",
        profile: profile?.profile || (sessionStorage.getItem('userResult') || 'Cortisol').toUpperCase(),
        energy_level: profile?.energy_level || 'normal'
    };

    // Store energy_level globally for gender-specific UI
    window.userEnergyLevel = context.energy_level;

    // NOTE: Symptoms are NO LONGER loaded from profile
    // Symptoms now ONLY come from daily check-ins to prevent stale data from affecting recommendations

    if(document.getElementById('profile-name-display')) document.getElementById('profile-name-display').innerText = context.name;
    if(document.getElementById('profile-email-display')) document.getElementById('profile-email-display').innerText = context.email;
    if(document.getElementById('profile-age-display')) document.getElementById('profile-age-display').innerText = context.age;
    
    const wStr = String(context.weight).toLowerCase();
    const weightDisplay = wStr.includes('k') || wStr.includes('l') 
        ? context.weight 
        : context.weight + " kg";

    if(document.getElementById('profile-weight-display')) document.getElementById('profile-weight-display').innerText = weightDisplay;
    if(document.getElementById('profile-goal-display')) document.getElementById('profile-goal-display').innerText = context.goal;
    
    // Updated Protocol Fields
    if(document.getElementById('profile-type-display')) document.getElementById('profile-type-display').innerText = context.profile;
    
    const equipment = profile?.equipment_access || 'none';
    const eqMap = {
        'gym': 'Full Gym Access',
        'dumbbells': 'Home / Dumbbells',
        'home': 'Home / Dumbbells',  // Legacy value support
        'bands': 'Resistance Bands',
        'yoga_only': 'Yoga / Stretching Only',
        'none': 'No Equipment',
        'bodyweight': 'No Equipment'  // Legacy value support
    };
    const eqDisplay = document.getElementById('profile-equipment-display');
    if(eqDisplay) {
        eqDisplay.innerText = eqMap[equipment] || 'No Equipment';
        eqDisplay.dataset.raw = equipment; // Store raw value for edit mode mapping
    }

    // Display dietary preference
    const dietPref = profile?.dietary_preference || localStorage.getItem('dietaryPreference') || '';
    const dietDisplay = document.getElementById('profile-diet-display');
    if (dietDisplay) {
        const dietLabels = { omnivore: 'Omnivore', pescatarian: 'Pescatarian', vegetarian: 'Vegetarian', vegan: 'Vegan', flexitarian: 'Flexitarian' };
        dietDisplay.textContent = dietLabels[dietPref] || 'Not set';
    }

    // Display symptoms from latest check-in (NOT from profile)
    // Symptoms can only be updated via daily wellness check-in
    let symptomsText = 'None';

    // Look for most recent check-in with symptoms
    if (userCycleData.logs && Object.keys(userCycleData.logs).length > 0) {
        // Get all dates sorted descending (most recent first)
        const dates = Object.keys(userCycleData.logs).sort().reverse();

        // Find the most recent check-in that has symptoms
        for (const date of dates) {
            const log = userCycleData.logs[date];
            if (log.symptoms && Array.isArray(log.symptoms) && log.symptoms.length > 0) {
                symptomsText = log.symptoms.map(s =>
                    s.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
                ).join(', ');
                break;
            }
        }
    }

    if(document.getElementById('profile-symptoms-display')) {
        document.getElementById('profile-symptoms-display').innerText = symptomsText;
    }

    // Load saved avatar if exists
    const savedPhoto = localStorage.getItem('profile_photo');
    if(savedPhoto) {
        const mainImg = document.getElementById('profile-photo-img');
        if(mainImg) mainImg.src = savedPhoto;
        document.querySelectorAll('.profile-icon').forEach(el => {
            el.innerHTML = `<img src="${savedPhoto}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
            el.style.background = 'transparent';
        });
    }

    // CRITICAL: Always sync gender from database to localStorage
    // Database is the source of truth - always overwrite localStorage
    // This fixes the bug where localStorage has wrong gender value
    // Check both user_gender (from users table) and sex (from quiz_results table)
    const genderFromDb = profile?.user_gender || profile?.sex;
    if (genderFromDb) {
        const currentLocalGender = localStorage.getItem('userGender');
        if (currentLocalGender !== genderFromDb) {
            console.log("Gender mismatch detected - DB:", genderFromDb, "localStorage:", currentLocalGender);
        }
        // Skip localStorage write in admin view-as mode to prevent state leakage
        if (!window.isAdminViewing) localStorage.setItem('userGender', genderFromDb);
        console.log("Synced gender from DB to localStorage:", genderFromDb);
    }

    // CRITICAL: Restore theme preference from database to localStorage
    // This ensures theme persists even when cache is cleared
    // Skip in admin view-as mode to prevent theme leakage to admin's localStorage
    if (profile?.theme_preference && !localStorage.getItem('userThemePreference') && !window.isAdminViewing) {
        localStorage.setItem('userThemePreference', profile.theme_preference);
        console.log("Restored theme preference from DB to localStorage:", profile.theme_preference);
    }

    // Restore background preference from database to localStorage
    // This ensures background persists even when cache/localStorage is cleared
    if (profile?.background_preference && !localStorage.getItem('selectedBackground') && !window.isAdminViewing) {
        localStorage.setItem('selectedBackground', profile.background_preference);
        console.log("Restored background preference from DB to localStorage:", profile.background_preference);
        // Apply immediately since the 2500ms init may have already run with the wrong background
        if (window.selectBackground) {
            window.selectBackground(profile.background_preference);
        }
    }

    // CRITICAL FIX: Restore sex field to sessionStorage for nutrition calculations
    // This fixes the bug where gender resets to female on page refresh
    if (profile?.sex) {
        let currentProfile = {};
        try { currentProfile = JSON.parse(sessionStorage.getItem('userProfile') || '{}'); } catch(e) {}
        currentProfile.sex = profile.sex;
        sessionStorage.setItem('userProfile', JSON.stringify(currentProfile));
        console.log("Restored sex from DB to sessionStorage:", profile.sex);
    }

    // ALWAYS apply gender-specific UI after profile loads
    // This uses localStorage (which may have been set during onboarding or restored from DB above)
    if (typeof applyGenderTheme === 'function') {
        applyGenderTheme();
    }
    if (typeof applyGenderSpecificUI === 'function') {
        applyGenderSpecificUI();
    }
    // Update settings icon to show Dragon Ball for DBZ themes
    if (typeof updateSettingsIcon === 'function') {
        updateSettingsIcon();
    }
    // Re-render cycle status with correct gender
    if (typeof renderCycleStatus === 'function') {
        renderCycleStatus();
    }

    // Load today's check-in from Supabase to sync localStorage
    if (window.currentUser && typeof dbHelpers !== 'undefined') {
        try {
            const today = getLocalDateString();
            const todayCheckin = await dbHelpers.checkins.get(window.currentUser.id, today);
            if (todayCheckin) {
                // User has already checked in today - mark localStorage
                localStorage.setItem('lastWellnessCheck', new Date().toDateString());
                console.log('✅ Today\'s check-in found in DB');

                // Update symptoms display from check-in data
                const additionalData = todayCheckin.additional_data || {};
                const checkInSymptoms = additionalData.symptoms || [];
                if (checkInSymptoms.length > 0) {
                    const symptomsEl = document.getElementById('profile-symptoms-display');
                    if (symptomsEl) {
                        const formattedSymptoms = checkInSymptoms.map(s =>
                            s.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
                        ).join(', ');
                        symptomsEl.textContent = formattedSymptoms;
                    }
                }
            }
        } catch (e) {
            console.warn('Could not check today\'s check-in status:', e);
        }
    }

}
// Register real implementation
_loadProfileDataReal = _loadProfileDataRealImpl;
loadProfileData = _loadProfileDataRealImpl;

function handlePhotoUpload(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file.');
            input.value = '';
            return;
        }

        // Show loading state
        const mainImg = document.getElementById('profile-photo-img');
        if (mainImg) mainImg.style.opacity = '0.5';

        // Resize image to prevent localStorage overflow (max 500KB)
        resizeImageFile(file, 400, 0.8).then(photoData => {
            // Update main profile photo
            if (mainImg) {
                mainImg.src = photoData;
                mainImg.style.opacity = '1';
            }

            // Save to localStorage
            try {
                localStorage.setItem('profile_photo', photoData);
            } catch (e) {
                console.error('Failed to save photo to localStorage:', e);
            }

            // Update all small icons
            document.querySelectorAll('.profile-icon').forEach(el => {
                el.innerHTML = `<img src="${photoData}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
                el.style.background = 'transparent';
            });

            // Reset input to allow re-selecting the same file
            input.value = '';
        }).catch(err => {
            console.error('Failed to process image:', err);
            alert('Failed to process image. Please try a different photo.');
            if (mainImg) mainImg.style.opacity = '1';
            input.value = '';
        });
    }
}

// Helper function to resize image before storing
function resizeImageFile(file, maxSize, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Scale down if larger than maxSize
                if (width > height && width > maxSize) {
                    height = (height * maxSize) / width;
                    width = maxSize;
                } else if (height > maxSize) {
                    width = (width * maxSize) / height;
                    height = maxSize;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = function() {
                reject(new Error('Failed to load image'));
            };
            img.src = e.target.result;
        };
        reader.onerror = function() {
            reject(new Error('Failed to read file'));
        };
        reader.readAsDataURL(file);
    });
}

// Handle profile photo upload during onboarding wizard
function handleWizardProfilePhoto(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];

        if (!file.type.startsWith('image/')) {
            alert('Please select an image file.');
            input.value = '';
            return;
        }

        const container = document.getElementById('wizard-profile-photo-container');
        const placeholder = document.getElementById('wizard-profile-photo-placeholder');
        const img = document.getElementById('wizard-profile-photo-img');

        if (container) container.style.opacity = '0.5';

        resizeImageFile(file, 400, 0.8).then(photoData => {
            // Show the image, hide placeholder
            if (img) {
                img.src = photoData;
                img.style.display = 'block';
            }
            if (placeholder) placeholder.style.display = 'none';
            if (container) container.style.opacity = '1';

            // Save to localStorage (same key as main profile photo)
            try {
                localStorage.setItem('profile_photo', photoData);
            } catch (e) {
                console.error('Failed to save wizard profile photo:', e);
            }

            // Also update main profile photo elements if they exist
            const mainImg = document.getElementById('profile-photo-img');
            if (mainImg) mainImg.src = photoData;
            document.querySelectorAll('.profile-icon').forEach(el => {
                el.innerHTML = `<img src="${photoData}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
                el.style.background = 'transparent';
            });

            input.value = '';
        }).catch(err => {
            console.error('Failed to process wizard profile photo:', err);
            alert('Failed to process image. Please try a different photo.');
            if (container) container.style.opacity = '1';
            input.value = '';
        });
    }
}

function connectApp(appName) {
    const btn = event.target;
    btn.innerText = "Connecting...";
    btn.disabled = true;
    
    setTimeout(() => {
        btn.innerText = "Connected";
        btn.classList.add('connected');
        alert(`${appName} connected successfully! (Simulation)`);
    }, 1500);
}




// Real switchAppTab implementation - replaces the early stub
function _switchAppTabReal(tabName, btn) {
    // Track current active tab for level-up animation visibility
    if (typeof currentActiveTab !== 'undefined') {
        currentActiveTab = tabName;
    }

    // Sync Spotify mini player visibility (only show on dashboard and movement tab)
    const _spotifyWidget = document.getElementById('spotify-now-playing');
    if (_spotifyWidget) {
        const showSpotify = (tabName === 'dashboard' || tabName === 'movement-tab') && window._snpPlaying;
        _spotifyWidget.style.display = showSpotify ? 'block' : 'none';
    }

    // 1. Update Bottom Nav UI
    document.querySelectorAll('.bottom-nav .nav-item').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    else {
        // simple fallback
    }

    // 1.5. Restore bottom navigation visibility for normal tabs
    document.querySelector('.bottom-nav').style.display = 'flex';

    // 1.6. Clear Android navigation stack when switching to main tabs
    if (typeof clearNavigationStack === 'function') {
        clearNavigationStack();
    }

    // 2. Clear All Views
    hideAllAppViews();

    // 3. Show Target View
    if (tabName === 'dashboard') {
        document.getElementById('view-dashboard').style.display = 'block';

        // Show pending level-up celebration if user leveled up while on another screen
        // (This is a fallback - the new celebration system auto-navigates, so this rarely triggers)
        if (typeof pendingLevelUp !== 'undefined' && pendingLevelUp) {
            setTimeout(() => {
                triggerLevelUpCelebration(
                    pendingLevelUp.level,
                    pendingLevelUp.title,
                    pendingLevelUp.previousLevel,
                    pendingLevelUp.lifetimePoints,
                    pendingLevelUp.currentStreak || 0,
                    pendingLevelUp.previousProgress || 0
                );
                pendingLevelUp = null;
            }, 500);
        }

        // Check for celebration that was interrupted by page reload
        if (typeof checkPendingLevelUpCelebration === 'function') {
            setTimeout(() => checkPendingLevelUpCelebration(), 1500);
        }

        // Hide Today's Priority section if user doesn't have meal plan access
        const todaysPrioritySection = document.getElementById('todays-priority-section');
        if (todaysPrioritySection) {
            const access = typeof checkMealPlanAccess === 'function' ? checkMealPlanAccess() : { hasAccess: true };
            todaysPrioritySection.style.display = access.hasAccess ? '' : 'none';
        }

        // Load live challenges on home screen
        if (typeof loadHomeChallenges === 'function') {
            loadHomeChallenges();
        }

        // Render featured monthly rare card
        if (typeof renderFeaturedRareCard === 'function') {
            renderFeaturedRareCard();
        }

        // Check for expired challenges that need completing (grants rare rewards)
        if (typeof checkAndCompleteExpiredChallenges === 'function') {
            checkAndCompleteExpiredChallenges();
        }

        // Load coin balance
        if (typeof loadCoinBalance === 'function') {
            loadCoinBalance();
        }

        // Refresh weigh-in card and modal visibility on dashboard visit
        if (typeof checkAndShowWeighInModal === 'function') {
            checkAndShowWeighInModal();
        }
        if (typeof checkAndShowWeighInCard === 'function') {
            checkAndShowWeighInCard();
        }
        if (typeof checkAndShowMoodCheckinCard === 'function') {
            checkAndShowMoodCheckinCard();
        }
        if (typeof checkAndShowFitnessDiaryCard === 'function') {
            checkAndShowFitnessDiaryCard();
        }
        if (typeof checkAndShowDailyQuizCard === 'function') {
            checkAndShowDailyQuizCard();
        }
        if (typeof checkAndShowMealTipCard === 'function') {
            checkAndShowMealTipCard();
        }
        if (typeof checkAndShowProgressPhotoCard === 'function') {
            checkAndShowProgressPhotoCard();
        }
        if (typeof checkAndShowWorkoutTrendCard === 'function') {
            checkAndShowWorkoutTrendCard();
        }

        // Load performance card data
        if (typeof initPerformanceCard === 'function') {
            initPerformanceCard();
        }

        // Load adaptive calorie adjustment prompt into FITGotchi AI card
        if (typeof loadAdaptiveAdjustment === 'function') {
            loadAdaptiveAdjustment();
        }
    } else if (tabName === 'meals') {
        document.getElementById('view-meals').style.display = 'block';

        // Initialize meal plan view (handles quiz vs non-quiz users)
        if (typeof initializeMealPlanView === 'function') {
            initializeMealPlanView();
        }

        if (!document.querySelector('#meals-content-container .view-section.active')) {
            // Default to calorie tracker for all users
            switchWeek('calorie-tracker');
        } else if (document.getElementById('today').classList.contains('active')) {
            renderTodayMeals(); // Refresh today view if active
        }
    } else if (tabName === 'movement-tab') {
        const el = document.getElementById('movement-tab');
        if(el) {
            el.classList.add('active');
            el.style.display='block';
            renderMovementView();

            // Load workout trend card in Movement tab
            if (typeof loadMovementTrendCard === 'function') {
                loadMovementTrendCard();
            }

            // Auto-Check-in Logic (Once per day)
            const todayStr = new Date().toDateString();
            const lastAuto = localStorage.getItem('last_auto_checkin_date');

            // Auto check-in disabled per user request
            // if (lastAuto !== todayStr) { ... }
        }
    } else if (tabName === 'support') {
        // Support view removed - open coach chat modal instead
        openCoachChatModal();
    } else if (tabName === 'profile') {
        const el = document.getElementById('view-profile');
        if(el) {
            el.classList.add('active');
            el.style.display='block';
            // Decouple data loading so errors don't stop view from showing
            setTimeout(loadProfileData, 10);
            // Update settings icon when profile view is shown
            if (typeof updateSettingsIcon === 'function') {
                setTimeout(updateSettingsIcon, 100);
            }
            // Show/hide allocate battle stats button based on unallocated points
            setTimeout(() => {
                const allocBtn = document.getElementById('settings-allocate-stats-btn');
                if (allocBtn && typeof getUnallocatedPoints === 'function') {
                    const pts = getUnallocatedPoints();
                    allocBtn.style.display = pts > 0 ? 'flex' : 'none';
                }
            }, 200);
        }
    } else if (tabName === 'progress') {
        // Progress is now inside Movement tab - redirect there and open progress view
        const movEl = document.getElementById('movement-tab');
        if(movEl) {
            movEl.classList.add('active');
            movEl.style.display='block';
            renderMovementView();
        }
        // Auto-open progress view from movement
        setTimeout(() => { if(typeof openProgressFromMovement === 'function') openProgressFromMovement(); }, 100);
    } else if (tabName === 'learning') {
        const el = document.getElementById('view-learning');
        if(el) {
            el.style.display = 'block';
            if(typeof initLearning === 'function') initLearning();
        }
    } else if (tabName === 'cycle') {
        const el = document.getElementById('view-cycle');
        if(el) {
            el.style.display = 'block';
            if(typeof initCycleView === 'function') initCycleView();
        }
    } else if (tabName === 'friends') {
        const el = document.getElementById('view-friends');
        if(el) {
            el.style.display = 'block';
            if(typeof initFriendsView === 'function') initFriendsView();
        }
    }

    // Trigger Cycle Sync Check if entering Dashboard
    if(tabName === 'dashboard' && typeof checkAndRenderCycleSync === 'function') {
        checkAndRenderCycleSync();
    }

    // Update friends pill count on home page
    if(tabName === 'dashboard' && typeof updateHomeFriendsPillCount === 'function') {
        updateHomeFriendsPillCount();
    }

    window.scrollTo(0,0);
}

// Mark real implementation as ready and process any queued calls
_switchAppTabReady = true;
switchAppTab = _switchAppTabReal;
if (_switchAppTabQueue && _switchAppTabQueue.length > 0) {
    console.log('Processing ' + _switchAppTabQueue.length + ' queued switchAppTab calls');
    _switchAppTabQueue.forEach(function(call) {
        _switchAppTabReal(call.tabName, call.btn);
    });
    _switchAppTabQueue = [];
}

// Check for pending app shortcut action (long-press icon → Calorie Tracker)
try {
    if (window.NativePermissions && typeof window.NativePermissions.getPendingShortcutAction === 'function') {
        var _shortcutAction = window.NativePermissions.getPendingShortcutAction();
        if (_shortcutAction === 'calorie-tracker') {
            console.log('App shortcut: waiting for camera function to be ready');
            window._pendingShortcutCamera = true;
            var _shortcutAttempts = 0;
            var _shortcutInterval = setInterval(function() {
                _shortcutAttempts++;
                if (typeof openMealCameraDirect === 'function') {
                    clearInterval(_shortcutInterval);
                    console.log('App shortcut: opening calorie tracker camera');
                    openMealCameraDirect('shortcut');
                    window._pendingShortcutCamera = false;
                } else if (_shortcutAttempts > 50) {
                    clearInterval(_shortcutInterval);
                    console.warn('App shortcut: camera function never became available');
                    window._pendingShortcutCamera = false;
                }
            }, 200);
        }
    }
} catch(e) { console.warn('Shortcut check failed:', e); }

// --- CALENDAR & CYCLE LOGIC ---
const PHASE_INFO = {
    menstrual: { name: 'Menstrual Phase', color: '#E57373', css: 'phase-menstrual', rec: 'Rest, Walking, Yin Yoga', icon: '🩸' },
    follicular: { name: 'Follicular Phase', color: '#F06292', css: 'phase-follicular', rec: 'HIIT, Strength, Cardio', icon: '⚡' },
    ovulation: { name: 'Ovulation Phase', color: '#BA68C8', css: 'phase-ovulation', rec: 'Max Effort, PB Attempts', icon: '🥚' },
    luteal: { name: 'Luteal Phase', color: '#FFB74D', css: 'phase-luteal', rec: 'Strength (Mod), Pilates', icon: '🌙' },
    wellness: { name: 'Wellness Cycle', color: '#4DB6AC', css: 'phase-follicular', rec: 'Balanced Activity / Strength', icon: '🌿' },
    performance: { name: 'Performance Mode', color: '#3b82f6', css: 'phase-performance', rec: 'Strength, HIIT, Progressive Overload', icon: '💪' }
};

// Update userCycleData (already declared early to prevent undefined errors)
userCycleData = {
    lastPeriod: null,
    cycleLength: 28,
    mood: null, // 'strong' or 'tired'
    noPeriodMode: false,
    symptoms: [],
    logs: {}, // { "YYYY-MM-DD": { flow, symptoms:[], mood, energy } }
    dailyCheckIn: null // { date: "YYYY-MM-DD", status: "completed" }
};

function setCycleMood(mood, btn) {
    userCycleData.mood = mood;
    // UI Update
    document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // Re-render suggestions
    renderCycleStatus();
    renderWeeklyCalendar();
}

function toggleNoPeriodMode() {
    const isChecked = document.getElementById('no-period-toggle-profile').checked;
    userCycleData.noPeriodMode = isChecked;

    const inputContainer = document.getElementById('last-period-input-profile');
    if(inputContainer) inputContainer.disabled = isChecked;

    updateCycleData();
}

async function initCalendarView() {
    // 1. Try to load from localStorage first (works for non-logged-in users)
    try {
        const savedCycleData = localStorage.getItem('userCycleData');
        if (savedCycleData) {
            const parsed = JSON.parse(savedCycleData);
            if (parsed.lastPeriod) {
                userCycleData.lastPeriod = parsed.lastPeriod;
                const lastPeriodInput = document.getElementById('last-period-input-profile');
                if (lastPeriodInput) lastPeriodInput.value = userCycleData.lastPeriod;
            }
            if (parsed.cycleLength) {
                userCycleData.cycleLength = parseInt(parsed.cycleLength);
                const cycleLengthInput = document.getElementById('cycle-length-input-profile');
                if (cycleLengthInput) cycleLengthInput.value = userCycleData.cycleLength;
            }
            if (parsed.noPeriodMode) {
                userCycleData.noPeriodMode = true;
                const noPeriodToggle = document.getElementById('no-period-toggle-profile');
                if (noPeriodToggle) noPeriodToggle.checked = true;
                const lastPeriodInput = document.getElementById('last-period-input-profile');
                if (lastPeriodInput) lastPeriodInput.disabled = true;
            }
            // Load logs for Cycle Sync
            if (parsed.logs) {
                userCycleData.logs = parsed.logs;
            }
        }
    } catch (e) {
        console.log("Error loading cycle data from localStorage", e);
    }

    // 2. Fetch Cycle Data from DB (user_facts) - overrides localStorage if logged in
    if (window.currentUser) {
        try {
            const userId = window.currentUser.id || window.currentUser.user_id;
            const facts = await dbHelpers.userFacts.get(userId);
            console.log('📊 Loaded user_facts from DB:', facts);
            console.log('📊 additional_data:', facts?.additional_data);
            if (facts && facts.additional_data) {
                if (facts.additional_data.last_period_start) {
                    userCycleData.lastPeriod = facts.additional_data.last_period_start;
                    const lastPeriodInput = document.getElementById('last-period-input-profile');
                    if (lastPeriodInput) lastPeriodInput.value = userCycleData.lastPeriod;
                    console.log('✅ Loaded lastPeriod from DB:', userCycleData.lastPeriod);
                }
                if (facts.additional_data.cycle_length) {
                    userCycleData.cycleLength = parseInt(facts.additional_data.cycle_length);
                    const cycleLengthInput = document.getElementById('cycle-length-input-profile');
                    if (cycleLengthInput) cycleLengthInput.value = userCycleData.cycleLength;
                    console.log('✅ Loaded cycleLength from DB:', userCycleData.cycleLength);
                }
                if (facts.additional_data.no_period_mode) {
                    userCycleData.noPeriodMode = true;
                    const noPeriodToggle = document.getElementById('no-period-toggle-profile');
                    if (noPeriodToggle) noPeriodToggle.checked = true;
                    const lastPeriodInput = document.getElementById('last-period-input-profile');
                    if (lastPeriodInput) lastPeriodInput.disabled = true;
                    console.log('✅ Loaded noPeriodMode from DB:', userCycleData.noPeriodMode);
                }
            } else {
                console.warn('⚠️ No additional_data found in user_facts');
            }
        } catch (e) {
            console.log("❌ No existing cycle data found or error fetching", e);
        }
    }

    renderCycleStatus();
    renderWeeklyCalendar();

    // Restore saved calendar view preference (weekly/monthly)
    const savedViewPref = localStorage.getItem('calendarViewPreference');
    if (savedViewPref === 'monthly') {
        switchCalendarView('monthly');
    }
}

async function updateCycleData() {
    const startInput = document.getElementById('last-period-input-profile').value;
    const lengthInput = document.getElementById('cycle-length-input-profile').value;
    const noPeriod = document.getElementById('no-period-toggle-profile').checked;

    userCycleData.noPeriodMode = noPeriod;

    if (!noPeriod && !startInput) return; // Wait for input if not in wellness mode

    userCycleData.lastPeriod = startInput;
    userCycleData.cycleLength = parseInt(lengthInput);

    // Always save to localStorage first (works for all users)
    localStorage.setItem('userCycleData', JSON.stringify(userCycleData));

    // Also save to DB if logged in (background, non-blocking)
    if (window.currentUser) {
        (async () => {
            try {
                const userId = window.currentUser.id || window.currentUser.user_id;
                let existingFacts = {};
                try {
                    existingFacts = await dbHelpers.userFacts.get(userId);
                } catch(err) { /* ignore not found */ }
                
                const currentAdditional = existingFacts?.additional_data || {};
                
                await dbHelpers.userFacts.upsert(userId, {
                    additional_data: {
                        ...currentAdditional,
                        last_period_start: userCycleData.lastPeriod,
                        cycle_length: userCycleData.cycleLength,
                        no_period_mode: userCycleData.noPeriodMode
                    }
                });
            } catch (e) {
                // DB save failed but localStorage worked, user data is safe
                console.warn("Cycle data saved locally. Cloud sync pending.", e.message);
            }
        })();
    }

    renderCycleStatus();
    renderWeeklyCalendar();

    // Also update monthly calendar if visible
    const monthlyCalendar = document.getElementById('monthly-calendar');
    if (monthlyCalendar && monthlyCalendar.style.display !== 'none') {
        renderMonthlyCalendar();
    }
}

function getCyclePhase(dayOfCycle, cycleLen) {
    // For male users, always return 'performance' (no cycle tracking)
    if (typeof isMaleUser === 'function' && isMaleUser()) {
        return 'performance';
    }

    // Basic Algo
    // Day 1-5: Menstrual
    // Day 6-13: Follicular
    // Day 14: Ovulation (approx mid-cycle)
    // Day 15-End: Luteal

    // Adjust for cycle length:
    // Menstrual is usually fixed ~5
    // Luteal is usually fixed ~14 days before end.
    // Follicular varies.

    const ovulationDay = cycleLen - 14;

    if (dayOfCycle <= 5) return 'menstrual';
    if (dayOfCycle < ovulationDay) return 'follicular';
    if (dayOfCycle === ovulationDay) return 'ovulation';
    return 'luteal';
}

function renderCycleStatus() {
    // For male users, show Performance Mode (no cycle tracking)
    if (typeof isMaleUser === 'function' && isMaleUser()) {
        const phase = PHASE_INFO['performance'];
        const phaseName = document.getElementById('cycle-phase-name');
        const phaseDesc = document.getElementById('cycle-phase-desc');
        const cycleDayDisplay = document.getElementById('cycle-day-display');

        if (phaseName) {
            phaseName.innerText = phase.name;
            phaseName.style.color = phase.color;
        }
        if (cycleDayDisplay && cycleDayDisplay.parentElement) {
            cycleDayDisplay.parentElement.style.display = 'none'; // Hide day counter for males
        }
        if (phaseDesc) {
            phaseDesc.innerText = "Train based on energy and recovery. Push hard, recover smart.";
        }

        // Update recommendation
        let suggestion = phase.rec;
        const recText = document.getElementById('rec-text');
        if (recText) recText.innerText = suggestion;

        const recCard = document.getElementById('today-workout-rec');
        if (recCard) recCard.style.background = phase.color;

        return;
    }

    if (userCycleData.noPeriodMode) {
        // Wellness Mode View
        const phase = PHASE_INFO['wellness'];
        document.getElementById('cycle-phase-name').innerText = phase.name;
        document.getElementById('cycle-phase-name').style.color = phase.color;
        document.getElementById('cycle-day-display').innerText = "General Wellness";
        document.getElementById('cycle-phase-desc').innerText = "Focus on a balanced routine of Strength, Cardio, and Rest.";
        
        const iconContainer = document.getElementById('cycle-phase-icon');
        if(iconContainer) {
            iconContainer.style.background = phase.color + '40';
            iconContainer.style.color = phase.color;
            iconContainer.innerHTML = phase.icon;
        }

        let suggestion = phase.rec;
        if (userCycleData.mood === 'tired') suggestion = "Rest / Light Walking";
        else if (userCycleData.mood === 'strong') suggestion = "Strength / HIIT";

        document.getElementById('rec-text').innerText = suggestion;
        const recCard = document.getElementById('today-workout-rec');
        if(recCard) recCard.style.background = phase.color;
        
        return;
    }

    if (!userCycleData.lastPeriod) {
        document.getElementById('cycle-phase-name').innerText = "Setup Required";
        document.getElementById('cycle-day-display').innerText = "Complete onboarding";
        document.getElementById('cycle-phase-desc').innerText = "Go to Settings > Edit Profile to complete your onboarding and see your cycle insights.";
        return;
    }

    const start = new Date(userCycleData.lastPeriod);
    const today = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysSinceStart = Math.floor((today - start) / msPerDay);
    
    // Handle cycle looping
    let currentDayRaw = (daysSinceStart % userCycleData.cycleLength) + 1;
    if (currentDayRaw < 1) currentDayRaw = 1; // Basic safety

    const phaseKey = getCyclePhase(currentDayRaw, userCycleData.cycleLength);
    const phase = PHASE_INFO[phaseKey];

    document.getElementById('cycle-phase-name').innerText = phase.name;
    document.getElementById('cycle-phase-name').style.color = phase.color;
    document.getElementById('cycle-day-display').innerText = `Day ${currentDayRaw} of ${userCycleData.cycleLength}`;
    
    // Icon
    const iconContainer = document.getElementById('cycle-phase-icon');
    if(iconContainer) {
        iconContainer.style.background = phase.color + '40'; // Low opacity bg
        iconContainer.style.color = phase.color;
        iconContainer.innerHTML = phase.icon;
    }

    // Description & Suggestion based on Mood
    let suggestion = phase.rec;
    if (userCycleData.mood === 'tired') {
        suggestion = "Restorative Yoga / Stretching (Listen to body)";
        if (phaseKey === 'follicular') suggestion = "Light Cardio / Walk";
    } else if (userCycleData.mood === 'strong' && phaseKey === 'menstrual') {
        suggestion = "Light Resistance / Pilates";
    }

    document.getElementById('cycle-phase-desc').innerText = `You are in ${phase.name}. Usual focus: ${phase.rec}.`;
    
    // Update Today's Rec Card (if it exists)
    const recText = document.getElementById('rec-text');
    if(recText) recText.innerText = suggestion;
    
    const recCard = document.getElementById('today-workout-rec');
    if(recCard) recCard.style.background = phase.color;
    
}

// --- CYCLE & CALENDAR ACTIONS ---

window.logPeriodStart = function() {
    const today = new Date();
    const dateStr = getLocalDateString(today);
    
    userCycleData.lastPeriod = dateStr;
    localStorage.setItem('userCycleData', JSON.stringify(userCycleData));

    // Update Input if exists
    const input = document.getElementById('last-period-input-profile');
    if(input) input.value = dateStr;
    
    // Refresh Logic
    // If renderCycleStatus exists, call it.
    if(typeof renderCycleStatus === 'function') renderCycleStatus();
    renderWeeklyCalendar();
    
    // Visual Confirmation
    const btn = document.querySelector('button[onclick="logPeriodStart()"]');
    if(btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span style="color:#22c55e;">✓</span> Logged!';
        setTimeout(() => { btn.innerHTML = originalText; }, 2000);
    }
    
    // Also simulate selecting "Menstrual" mood? Or just let the cycle logic handle it.
    // Ideally we might assume they are "Tired" or "Cramps" but let's not assume.
};

function renderWeeklyCalendar() {
    const grid = document.getElementById('weekly-calendar');
    if(!grid) return;
    grid.innerHTML = '';

    // Self-healing: If variable is empty but input has value, sync it.
    const inputVal = document.getElementById('last-period-input-profile')?.value;
    if (!userCycleData.lastPeriod && inputVal) {
        userCycleData.lastPeriod = inputVal;
    }

    // Determine if we are in "Baseline" mode (no period data)
    // If no period is set, and we haven't explicitly set "noPeriodMode", we still want to show the calendar
    const isBaseline = !userCycleData.lastPeriod;

    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 is Sun, 1 is Mon
    // Calculate Monday of this week.
    const distToMon = (dayOfWeek + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - distToMon);

    const msPerDay = 24 * 60 * 60 * 1000;
    
    // Start date for cycle calc
    const start = userCycleData.lastPeriod ? new Date(userCycleData.lastPeriod) : new Date();

    // Check if user qualifies for Gym Split (Male or Female)
    const isMale = (typeof isMaleUser === 'function' && isMaleUser());

    // Check High Cortisol Profile (females only)
    const profileType = (sessionStorage.getItem('userResult') || '').toUpperCase();
    const isHighCortisol = !isMale && (profileType.includes('CORTISOL') || profileType.includes('ADRENAL'));

    // Load userProfile from localStorage, fallback to sessionStorage if needed
    let userProfile = {};
    try { userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}'); } catch(e) {}

    // BUGFIX: If equipment_access is missing in localStorage, check sessionStorage (from quiz)
    if (!userProfile.equipment_access) {
        let sessionProfile = {};
        try { sessionProfile = JSON.parse(sessionStorage.getItem('userProfile') || '{}'); } catch(e) {}
        if (sessionProfile.equipment_access) {
            userProfile.equipment_access = sessionProfile.equipment_access;
            // Save to localStorage for future use
            localStorage.setItem('userProfile', JSON.stringify(userProfile));
        }
    }

    // NEW: Smart equipment override - most recent selection wins (check-in vs onboarding)
    const todayDateStr = getLocalDateString();
    const todayCheckIn = userCycleData.logs?.[todayDateStr];
    const checkInTimestamp = todayCheckIn?.timestamp;
    const onboardingTimestamp = localStorage.getItem('onboardingCompletedAt');

    if (todayCheckIn?.equipment) {
        // Both timestamps exist - compare them
        if (checkInTimestamp && onboardingTimestamp) {
            const checkInTime = new Date(checkInTimestamp).getTime();
            const onboardingTime = new Date(onboardingTimestamp).getTime();

            if (checkInTime > onboardingTime) {
                // Check-in is more recent - use check-in equipment
                userProfile.equipment_access = todayCheckIn.equipment;
                console.log('📅 Calendar using today\'s check-in equipment (more recent):', userProfile.equipment_access);
            } else {
                // Onboarding is more recent - keep profile equipment
                console.log('📅 Calendar using onboarding equipment (more recent):', userProfile.equipment_access);
            }
        } else {
            // No onboarding timestamp - use check-in equipment (backward compatibility)
            userProfile.equipment_access = todayCheckIn.equipment;
            console.log('📅 Calendar using today\'s check-in equipment:', userProfile.equipment_access);
        }
    } else if (!todayCheckIn && userCycleData.logs) {
        // No check-in today - use last check-in data (don't reset to defaults)
        const dates = Object.keys(userCycleData.logs).sort().reverse();
        const lastCheckIn = dates.find(date => userCycleData.logs[date]?.equipment);
        if (lastCheckIn) {
            userProfile.equipment_access = userCycleData.logs[lastCheckIn].equipment;
            console.log('📅 Calendar using last check-in equipment from', lastCheckIn, ':', userProfile.equipment_access);
        }
    }

    // equipment_access is the source of truth; gym_access is legacy fallback only if equipment_access is undefined
    const hasGymAccess = userProfile.equipment_access === 'gym' || (userProfile.equipment_access === undefined && userProfile.gym_access === true);
    const hasHighEnergy = userProfile.energy_status === 'high';
    // Male and female gym splits now have IDENTICAL requirements: gym access only
    // Females can opt-in to cycle sync for automatic adjustments during menstrual phase
    const useMaleGymSplit = isMale && hasGymAccess;
    const useFemaleGymSplit = !isMale && hasGymAccess;

    // Determine equipment access - simplified direct checks (like gym split)
    const hasDumbbells = userProfile.equipment_access === 'dumbbells' || userProfile.equipment_access === 'home';
    const hasBands = userProfile.equipment_access === 'bands';
    const hasYogaOnly = userProfile.equipment_access === 'yoga_only';

    // SIMPLIFIED: Direct equipment checks (same pattern as gym split - no defaultStrengthProgram complexity)
    const useYogaOnly = hasYogaOnly;
    const useHome = hasDumbbells && !hasGymAccess;
    const useBands = hasBands && !hasDumbbells && !hasGymAccess;

    // Calculate which week we're in for 12 different 4-week programs (48 weeks total)
    function getGymSplitWeekNumber() {
        if (!useMaleGymSplit && !useFemaleGymSplit) return 1;

        let startDate = localStorage.getItem('gym_split_start_date');
        if (!startDate) {
            // First time using gym split - set start date to this week's Monday
            const today = new Date();
            const dayOfWeek = today.getDay();
            const distToMon = (dayOfWeek + 6) % 7;
            const monday = new Date(today);
            monday.setDate(today.getDate() - distToMon);
            monday.setHours(0, 0, 0, 0);
            startDate = getLocalDateString(monday);
            localStorage.setItem('gym_split_start_date', startDate);
        }

        // Calculate weeks elapsed since start
        const start = new Date(startDate);
        const now = new Date();
        const msPerWeek = 7 * 24 * 60 * 60 * 1000;
        const weeksElapsed = Math.floor((now - start) / msPerWeek);

        // Return week number 1-48 (12 programs × 4 weeks each)
        return (weeksElapsed % 48) + 1;
    }

    const currentWeek = getGymSplitWeekNumber();

    // Helper to get the workout index based on which 4-week program we're in
    function getWorkoutIndexForWeek(numWorkouts) {
        // Calculate which 4-week program (0-11)
        // Week 1-4 = Program 0 (uses workout 1)
        // Week 5-8 = Program 1 (uses workout 2)
        // Week 9-12 = Program 2 (uses workout 3)
        // etc.
        const programNumber = Math.floor((currentWeek - 1) / 4);
        return programNumber % numWorkouts; // Cycles through available workouts
    }

    // Weekly Schedule Template - maps to WORKOUT_DB programs
    // Each day references a program and the day index within that program's schedule
    let WEEKLY_SCHEDULE;
    let usingCustomProgram = false;
    let customProgramInfo = null;

    // Check for active custom program first
    const activeCustomProgram = window.activeCustomProgramCache;
    if (activeCustomProgram && activeCustomProgram.is_active && activeCustomProgram.start_date) {
        // Check if program is still within its duration
        const startDate = new Date(activeCustomProgram.start_date);
        const msPerWeek = 7 * 24 * 60 * 60 * 1000;
        const weeksElapsed = Math.floor((today - startDate) / msPerWeek);
        const currentWeek = weeksElapsed + 1;

        if (currentWeek <= activeCustomProgram.duration_weeks) {
            // Use custom program schedule
            const schedule = activeCustomProgram.weekly_schedule || [];
            WEEKLY_SCHEDULE = schedule.map((item, idx) => {
                if (!item.workout || item.workout.type === 'rest') {
                    return { day: item.day, program: 'rest', dayIndex: idx, isRest: true };
                }
                return {
                    day: item.day,
                    program: item.workout.category || 'custom',
                    dayIndex: idx,
                    subcategory: item.workout.subcategory || '',
                    muscleGroup: item.workout.subcategory || '',
                    customWorkout: item.workout
                };
            });
            usingCustomProgram = true;
            customProgramInfo = {
                name: activeCustomProgram.program_name,
                currentWeek: currentWeek,
                totalWeeks: activeCustomProgram.duration_weeks
            };
            console.log('📅 Calendar using custom program:', activeCustomProgram.program_name, `Week ${currentWeek}/${activeCustomProgram.duration_weeks}`);
        }
    }

    // Fall back to equipment-based schedule if no custom program
    if (!usingCustomProgram && useMaleGymSplit) {
        // Male Gym Split: Chest, Legs, Back, Shoulders, Arms+Core, Deep Fascia Release (Sat/Sun)
        WEEKLY_SCHEDULE = [
            { day: 'Mon', program: 'gym_split', dayIndex: 0, muscleGroup: 'chest' }, // Chest
            { day: 'Tue', program: 'gym_split', dayIndex: 1, muscleGroup: 'legs' }, // Legs
            { day: 'Wed', program: 'gym_split', dayIndex: 2, muscleGroup: 'back' }, // Back
            { day: 'Thu', program: 'gym_split', dayIndex: 3, muscleGroup: 'shoulders' }, // Shoulders
            { day: 'Fri', program: 'gym_split', dayIndex: 4, muscleGroup: 'armscore' }, // Arms & Core
            { day: 'Sat', program: 'yoga', dayIndex: 5, subcategory: 'yin' }, // Deep Fascia Release
            { day: 'Sun', program: 'yoga', dayIndex: 6, subcategory: 'yin' }  // Deep Fascia Release
        ];
    } else if (!usingCustomProgram && useFemaleGymSplit) {
        // Female Gym Split: Legs, Push, Arms+Core, Legs, Pull, Active Recovery (Yoga), Rest (Yoga)
        // Same as males: yoga on weekends for active recovery
        WEEKLY_SCHEDULE = [
            { day: 'Mon', program: 'female_gym_split', dayIndex: 0, muscleGroup: 'legs' }, // Legs
            { day: 'Tue', program: 'female_gym_split', dayIndex: 1, muscleGroup: 'push' }, // Push
            { day: 'Wed', program: 'female_gym_split', dayIndex: 2, muscleGroup: 'armscore' }, // Arms & Core
            { day: 'Thu', program: 'female_gym_split', dayIndex: 3, muscleGroup: 'legs' }, // Legs
            { day: 'Fri', program: 'female_gym_split', dayIndex: 4, muscleGroup: 'pull' }, // Pull
            { day: 'Sat', program: 'yoga', dayIndex: 5, subcategory: 'power' }, // Active Recovery
            { day: 'Sun', program: 'yoga', dayIndex: 6, subcategory: 'yin' }  // Rest
        ];
    } else if (!usingCustomProgram && useYogaOnly) {
        // Yoga Only - direct check like gym split
        WEEKLY_SCHEDULE = [
            { day: 'Mon', program: 'yoga', dayIndex: 0, subcategory: 'power' },
            { day: 'Tue', program: 'yoga', dayIndex: 1, subcategory: 'restorative' },
            { day: 'Wed', program: 'yoga', dayIndex: 2, subcategory: 'yin' },
            { day: 'Thu', program: 'yoga', dayIndex: 3, subcategory: 'restorative' },
            { day: 'Fri', program: 'yoga', dayIndex: 4, subcategory: 'power' },
            { day: 'Sat', program: 'yoga', dayIndex: 5, subcategory: 'power' },
            { day: 'Sun', program: 'yoga', dayIndex: 6, subcategory: 'yin' }
        ];
    } else if (!usingCustomProgram && useHome) {
        // Home/Dumbbell Split - direct check like gym split
        WEEKLY_SCHEDULE = [
            { day: 'Mon', program: 'home', dayIndex: 0, subcategory: 'lowerbody' },
            { day: 'Tue', program: 'home', dayIndex: 1, subcategory: 'push' },
            { day: 'Wed', program: 'yoga', dayIndex: 2, subcategory: 'restorative' },
            { day: 'Thu', program: 'home', dayIndex: 3, subcategory: 'pull' },
            { day: 'Fri', program: 'home', dayIndex: 4, subcategory: 'lowerbody' },
            { day: 'Sat', program: 'yoga', dayIndex: 5, subcategory: 'power' },
            { day: 'Sun', program: 'yoga', dayIndex: 6, subcategory: 'yin' }
        ];
    } else if (!usingCustomProgram && useBands) {
        // Resistance Bands Split - direct check like gym split
        WEEKLY_SCHEDULE = [
            { day: 'Mon', program: 'bands', dayIndex: 0 },
            { day: 'Tue', program: 'bands', dayIndex: 1 },
            { day: 'Wed', program: 'yoga', dayIndex: 2, subcategory: 'restorative' },
            { day: 'Thu', program: 'bands', dayIndex: 3 },
            { day: 'Fri', program: 'bands', dayIndex: 4 },
            { day: 'Sat', program: 'bands', dayIndex: 5 },
            { day: 'Sun', program: 'yoga', dayIndex: 6, subcategory: 'yin' }
        ];
    } else if (!usingCustomProgram) {
        // Bodyweight Split (fallback - no equipment)
        WEEKLY_SCHEDULE = [
            { day: 'Mon', program: 'bodyweight', dayIndex: 0, subcategory: 'lowerbody' },
            { day: 'Tue', program: 'bodyweight', dayIndex: 1, subcategory: 'upperbody' },
            { day: 'Wed', program: 'yoga', dayIndex: 2, subcategory: 'restorative' },
            { day: 'Thu', program: 'bodyweight', dayIndex: 3, subcategory: 'core' },
            { day: 'Fri', program: 'bodyweight', dayIndex: 4, subcategory: 'lowerbody' },
            { day: 'Sat', program: 'yoga', dayIndex: 5, subcategory: 'power' },
            { day: 'Sun', program: 'yoga', dayIndex: 6, subcategory: 'yin' }
        ];
    }

    // Helper to get workout from WORKOUT_DB or WORKOUT_LIBRARY (for gym split rotation)
    function getWorkoutForDay(dayIdx, checkDateStr) {
        // Check if there's equipment selection for this specific day
        let dayEquipment = null;
        if (checkDateStr && userCycleData.logs && userCycleData.logs[checkDateStr] && userCycleData.logs[checkDateStr].equipment) {
            dayEquipment = userCycleData.logs[checkDateStr].equipment;
        }

        let scheduleItem = WEEKLY_SCHEDULE[dayIdx];

        // Override program based on equipment selection for this day
        if (dayEquipment) {
            if (dayEquipment === 'gym' && (useMaleGymSplit || useFemaleGymSplit)) {
                // Keep gym split
                // scheduleItem stays the same
            } else if (dayEquipment === 'gym') {
                // User selected gym but doesn't qualify for split - use gym program
                scheduleItem = { ...scheduleItem, program: 'gym', dayIndex: dayIdx };
            } else if (dayEquipment === 'dumbbells') {
                scheduleItem = { ...scheduleItem, program: 'home', dayIndex: dayIdx };
            } else if (dayEquipment === 'bands') {
                scheduleItem = { ...scheduleItem, program: 'bands', dayIndex: dayIdx };
            } else if (dayEquipment === 'none') {
                scheduleItem = { ...scheduleItem, program: 'bodyweight', dayIndex: dayIdx };
            } else if (dayEquipment === 'yoga_only') {
                scheduleItem = { ...scheduleItem, program: 'yoga', dayIndex: dayIdx, subcategory: 'power' };
            }
        }

        // For gym split with muscle group, pull from WORKOUT_LIBRARY with 48-week rotation
        if ((scheduleItem.program === 'gym_split' || scheduleItem.program === 'female_gym_split') && scheduleItem.muscleGroup && typeof WORKOUT_LIBRARY !== 'undefined') {
            const muscleGroup = scheduleItem.muscleGroup;
            const gymCategory = WORKOUT_LIBRARY['gym'];

            if (gymCategory && gymCategory.subcategories && gymCategory.subcategories[muscleGroup]) {
                const workouts = gymCategory.subcategories[muscleGroup].workouts;

                // Get workout index based on current week in 48-week cycle
                const workoutIndex = getWorkoutIndexForWeek(workouts.length);
                const workout = workouts[workoutIndex];

                // Calculate which 4-week program we're in (1-12)
                const programNumber = Math.floor((currentWeek - 1) / 4) + 1;
                const weekInProgram = ((currentWeek - 1) % 4) + 1;

                if (workout) {
                    return {
                        title: workout.name,
                        programName: `Gym - Program ${programNumber}, Week ${weekInProgram}`,
                        programId: 'gym_library',
                        libraryWorkout: { category: 'gym', subcategory: muscleGroup, workoutId: workout.id },
                        exercises: workout.exercises
                    };
                }
            }
        }

        // For yoga/bodyweight/home with subcategories, pull from WORKOUT_LIBRARY with rotation
        if (scheduleItem.subcategory && typeof WORKOUT_LIBRARY !== 'undefined') {
            const category = WORKOUT_LIBRARY[scheduleItem.program];

            if (category && category.subcategories && category.subcategories[scheduleItem.subcategory]) {
                const workouts = category.subcategories[scheduleItem.subcategory].workouts;

                // Get workout index based on current week
                const workoutIndex = getWorkoutIndexForWeek(workouts.length);
                const workout = workouts[workoutIndex];

                if (workout) {
                    // For 48-week programs (10+ workouts), show program/week info
                    let programName = category.name;
                    if (workouts.length >= 10) {
                        const programNumber = Math.floor((currentWeek - 1) / 4) + 1;
                        const weekInProgram = ((currentWeek - 1) % 4) + 1;
                        programName = `${category.name} - Program ${programNumber}, Week ${weekInProgram}`;
                    }

                    return {
                        title: workout.name,
                        programName: programName,
                        programId: scheduleItem.program + '_library',
                        libraryWorkout: { category: scheduleItem.program, subcategory: scheduleItem.subcategory, workoutId: workout.id },
                        exercises: workout.exercises
                    };
                }
            }
        }

        // Default: use WORKOUT_DB
        const program = window.WORKOUT_DB?.[scheduleItem.program];
        if (program && program.schedule && program.schedule[scheduleItem.dayIndex]) {
            const workout = program.schedule[scheduleItem.dayIndex];
            return {
                title: workout.title,
                programName: program.name,
                programId: scheduleItem.program,
                exercises: workout.exercises
            };
        }
        // Fallback
        return { title: scheduleItem.day + ' Workout', programName: 'General', programId: 'bodyweight', exercises: [] };
    }

    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        
        const isToday = d.toDateString() === today.toDateString();
        
        let headerColor = '';
        let phaseDotHtml = '';
        const dayDateStr = getLocalDateString(d);
        const dayWorkout = getWorkoutForDay(i, dayDateStr);
        let workoutName = dayWorkout.title;
        let phase = PHASE_INFO.wellness; // Default
        let phaseKey = 'wellness';
        let currentDayLoop = 0;

        if (isBaseline) {
            // Baseline Mode: Just show standard workout, no phase info
            if(isToday) headerColor = PHASE_INFO.wellness.color;

        } else {
            // Cycle Mode
            const daysSinceStart = Math.floor((d - start) / msPerDay);
            // Handle negative modulo correctly
            let mod = daysSinceStart % userCycleData.cycleLength;
            if (mod < 0) mod += userCycleData.cycleLength;
            currentDayLoop = mod + 1;
            
            phaseKey = getCyclePhase(currentDayLoop, userCycleData.cycleLength);
            phase = PHASE_INFO[phaseKey];

            if(isToday) headerColor = phase.color;
        }

        // Apply Modifiers
        const isMaleCalendar = (typeof isMaleUser === 'function' && isMaleUser());

        // Check if user selected equipment in today's check-in
        let userSelectedEquipmentForThisDay = false;
        if (userCycleData.logs && userCycleData.logs[dayDateStr] && userCycleData.logs[dayDateStr].equipment) {
            userSelectedEquipmentForThisDay = true;
        }

        if (!isBaseline) {
            // 1. Phase Modifiers - swap to yoga on menstrual phase if doing strength (females only)
            // BUT respect equipment selection from check-in
            if (!isMaleCalendar && phaseKey === 'menstrual' && (dayWorkout.programId === 'bodyweight' || dayWorkout.programId === 'gym_library') && !userSelectedEquipmentForThisDay) {
                // Swap to gentle yoga ONLY if user didn't explicitly select equipment
                const yogaWorkout = window.WORKOUT_DB?.['yoga']?.schedule?.[3]; // Restorative Recovery
                if (yogaWorkout) workoutName = yogaWorkout.title;
            }
        }

        // 2. High Cortisol Safety Override - encourage yoga over HIIT (but not for gym split users)
        if (isHighCortisol && !useMaleGymSplit && !useFemaleGymSplit && (dayWorkout.programId === 'bodyweight' || dayWorkout.programId === 'gym_library')) {
            const yogaWorkout = window.WORKOUT_DB?.['yoga']?.schedule?.[0]; // Somatic Hormone Reset
            if (yogaWorkout) workoutName = yogaWorkout.title;
        }

        // 3. Daily Mood/Symptoms only apply to TODAY
        if (isToday) {
            // Swap to yoga if user reports being tired (applies to all users including males)
            if (userCycleData.mood === 'tired') {
                const yogaWorkout = window.WORKOUT_DB?.['yoga']?.schedule?.[3]; // Restorative Recovery
                if (yogaWorkout) workoutName = yogaWorkout.title;
            }
            if (userCycleData.symptoms && userCycleData.symptoms.length > 0) {
                // Hot flash and dizziness are female-specific
                if (!isMaleCalendar && (userCycleData.symptoms.includes('hot_flash') || userCycleData.symptoms.includes('dizziness'))) {
                    const yogaWorkout = window.WORKOUT_DB?.['yoga']?.schedule?.[3]; // Restorative
                    if (yogaWorkout) workoutName = yogaWorkout.title;
                } else if (userCycleData.symptoms.includes('fatigue') || userCycleData.symptoms.includes('anxiety')) {
                    // Fatigue/anxiety triggers yoga for everyone (males & females)
                    const yogaWorkout = window.WORKOUT_DB?.['yoga']?.schedule?.[6]; // Yin & Meditation
                    if (yogaWorkout) workoutName = yogaWorkout.title;
                }
            }
        }

        const row = document.createElement('div');
        row.className = `calendar-day-row ${isToday ? 'is-today' : ''}`;
        
        // Construct Phase Dot HTML
        if (isBaseline) {
             // In baseline, maybe just show "Schedule" or nothing
             phaseDotHtml = `<span class="cal-phase-dot" style="background:#cbd5e1"></span> <span style="font-size:0.8rem; color:#94a3b8;">Standard</span>`;
        } else {
             if (!userCycleData.noPeriodMode) {
                 phaseDotHtml = `<span class="cal-phase-dot" style="background:${phase.color}"></span>
                                 <span style="opacity:0.8; font-size:0.8rem;">${phase.name} (Day ${currentDayLoop})</span>`;
             } else {
                 phaseDotHtml = `<span class="cal-phase-dot" style="background:${PHASE_INFO.wellness.color}"></span> <span style="font-size:0.8rem">Balanced</span>`;
             }
        }

        // Check for active replacement for this day
        const replacement = getReplacementForDay ? getReplacementForDay(i) : null;
        let displayWorkoutName = workoutName;
        let hasReplacement = false;

        if (replacement && replacement.replacement_workout) {
            displayWorkoutName = replacement.replacement_workout.name || workoutName;
            hasReplacement = true;
        }

        row.innerHTML = `
            <div class="cal-date-box">
                <span class="cal-day-name">${WEEKLY_SCHEDULE[i].day}</span>
                <span class="cal-day-num" style="color:${isToday ? (isBaseline ? '#046A38' : headerColor) : ''}">${d.getDate()}</span>
            </div>
            <div class="cal-context" onclick="openCalendarActionModal(${i}, '${displayWorkoutName.replace(/'/g, "\\'")}')" style="cursor: pointer;">
                <div style="font-size: 0.9em; margin-bottom: 2px;">
                    ${phaseDotHtml}
                </div>
                <div class="cal-workout-tag">${displayWorkoutName}${hasReplacement ? ' <span style="font-size: 0.7rem; color: #f59e0b;" title="Replacement active">🔄</span>' : ''}</div>
            </div>
        `;
        grid.appendChild(row);
    }
}

// --- MONTHLY CALENDAR VIEW ---

// Track current displayed month for monthly calendar
let monthlyCalendarDate = new Date();

// Switch between weekly and monthly calendar views
window.switchCalendarView = function(view) {
    const weeklyCalendar = document.getElementById('weekly-calendar');
    const monthlyCalendar = document.getElementById('monthly-calendar');
    const toggleBtns = document.querySelectorAll('#calendar-view-toggle .toggle-btn');

    if (!weeklyCalendar || !monthlyCalendar) return;

    toggleBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    if (view === 'weekly') {
        weeklyCalendar.style.display = 'flex';
        monthlyCalendar.style.display = 'none';
    } else {
        weeklyCalendar.style.display = 'none';
        monthlyCalendar.style.display = 'block';
        monthlyCalendarDate = new Date(); // Reset to current month when switching
        renderMonthlyCalendar();
    }

    // Save preference
    localStorage.setItem('calendarViewPreference', view);
};

// Navigate months in monthly calendar
window.navigateMonth = function(direction) {
    monthlyCalendarDate.setMonth(monthlyCalendarDate.getMonth() + direction);
    renderMonthlyCalendar();
};

function renderMonthlyCalendar() {
    const container = document.getElementById('monthly-calendar');
    if (!container) return;

    const today = new Date();
    const year = monthlyCalendarDate.getFullYear();
    const month = monthlyCalendarDate.getMonth();

    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);

    // Get day of week for first day (0 = Sunday, adjust for Monday start)
    let startDay = firstDay.getDay();
    startDay = startDay === 0 ? 6 : startDay - 1; // Convert to Monday = 0

    // Month name
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];

    // Start date for cycle calc
    const start = userCycleData.lastPeriod ? new Date(userCycleData.lastPeriod) : null;
    const cycleLen = userCycleData.cycleLength || 28;
    const msPerDay = 24 * 60 * 60 * 1000;
    const isBaseline = !userCycleData.lastPeriod;
    const isMale = (typeof isMaleUser === 'function' && isMaleUser());

    // Build HTML
    let html = `
        <div class="monthly-calendar-container">
            <div class="monthly-calendar-header">
                <button class="month-nav-btn" onclick="navigateMonth(-1)">‹</button>
                <span class="month-title">${monthNames[month]} ${year}</span>
                <button class="month-nav-btn" onclick="navigateMonth(1)">›</button>
            </div>
            <div class="monthly-calendar-weekdays">
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
                <span>Sun</span>
            </div>
            <div class="monthly-calendar-grid">
    `;

    // Days from previous month
    const prevMonth = new Date(year, month, 0);
    for (let i = startDay - 1; i >= 0; i--) {
        const dayNum = prevMonth.getDate() - i;
        const date = new Date(year, month - 1, dayNum);
        html += renderMonthlyDayCell(date, today, start, cycleLen, msPerDay, isBaseline, isMale, true);
    }

    // Days of current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
        const date = new Date(year, month, d);
        html += renderMonthlyDayCell(date, today, start, cycleLen, msPerDay, isBaseline, isMale, false);
    }

    // Days from next month to fill the grid (6 rows = 42 cells)
    const totalCells = startDay + lastDay.getDate();
    const remainingCells = totalCells <= 35 ? 35 - totalCells : 42 - totalCells;
    for (let d = 1; d <= remainingCells; d++) {
        const date = new Date(year, month + 1, d);
        html += renderMonthlyDayCell(date, today, start, cycleLen, msPerDay, isBaseline, isMale, true);
    }

    html += `
            </div>
        </div>
    `;

    // Add legend (only for females with cycle tracking)
    if (!isMale) {
        html += `
            <div style="margin-top: 15px; display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;">
                <div style="display: flex; align-items: center; gap: 5px; font-size: 0.75rem; color: #64748b;">
                    <span style="width: 12px; height: 4px; background: ${PHASE_INFO.menstrual.color}; border-radius: 2px;"></span>
                    Menstrual
                </div>
                <div style="display: flex; align-items: center; gap: 5px; font-size: 0.75rem; color: #64748b;">
                    <span style="width: 12px; height: 4px; background: ${PHASE_INFO.follicular.color}; border-radius: 2px;"></span>
                    Follicular
                </div>
                <div style="display: flex; align-items: center; gap: 5px; font-size: 0.75rem; color: #64748b;">
                    <span style="width: 12px; height: 4px; background: ${PHASE_INFO.ovulation.color}; border-radius: 2px;"></span>
                    Ovulation
                </div>
                <div style="display: flex; align-items: center; gap: 5px; font-size: 0.75rem; color: #64748b;">
                    <span style="width: 12px; height: 4px; background: ${PHASE_INFO.luteal.color}; border-radius: 2px;"></span>
                    Luteal
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

// Helper to get workout label for monthly calendar view
function getMonthlyWorkoutLabel(dayIndex, isMale) {
    // Load user profile to determine schedule type
    let userProfile = {};
    try { userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}'); } catch(e) {}
    if (!userProfile.equipment_access) {
        let sessionProfile = {};
        try { sessionProfile = JSON.parse(sessionStorage.getItem('userProfile') || '{}'); } catch(e) {}
        if (sessionProfile.equipment_access) {
            userProfile.equipment_access = sessionProfile.equipment_access;
        }
    }

    const equipment = userProfile.equipment_access || 'none';
    const hasGymAccess = equipment === 'gym';
    const goals = (userProfile.fitness_goals || []).map(g => (g || '').toLowerCase());
    const wantsStrength = goals.includes('build muscle') || goals.includes('increase strength');
    const useGymSplit = hasGymAccess && wantsStrength;
    const useYogaOnly = equipment === 'yoga_only';
    const useHome = equipment === 'dumbbells';
    const useBands = equipment === 'bands';

    // Define schedule labels based on equipment/goals
    if (useGymSplit && isMale) {
        // Male gym split: Chest, Legs, Back, Shoulders, Arms, Yoga, Yoga
        const labels = ['Chest', 'Legs', 'Back', 'Shoulders', 'Arms', 'Yoga', 'Yoga'];
        return labels[dayIndex];
    } else if (useGymSplit && !isMale) {
        // Female gym split: Legs, Push, Arms, Legs, Pull, Yoga, Yoga
        const labels = ['Legs', 'Push', 'Arms', 'Legs', 'Pull', 'Yoga', 'Yoga'];
        return labels[dayIndex];
    } else if (useYogaOnly) {
        return 'Yoga';
    } else if (useHome) {
        // Home: Lower, Push, Yoga, Pull, Lower, Yoga, Yoga
        const labels = ['Lower', 'Push', 'Yoga', 'Pull', 'Lower', 'Yoga', 'Yoga'];
        return labels[dayIndex];
    } else if (useBands) {
        // Bands: 5 strength days + 1 yoga + 1 yoga
        const labels = ['Bands', 'Bands', 'Yoga', 'Bands', 'Bands', 'Bands', 'Yoga'];
        return labels[dayIndex];
    } else {
        // Bodyweight: Lower, Upper, Yoga, Core, Lower, Yoga, Yoga
        const labels = ['Lower', 'Upper', 'Yoga', 'Core', 'Lower', 'Yoga', 'Yoga'];
        return labels[dayIndex];
    }
}

function renderMonthlyDayCell(date, today, cycleStart, cycleLen, msPerDay, isBaseline, isMale, isOtherMonth) {
    const isToday = date.toDateString() === today.toDateString();
    const dayNum = date.getDate();
    const dayOfWeek = date.getDay();
    const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 0

    let phaseColor = '#e2e8f0'; // Default gray
    let showPhaseIndicator = !isMale; // Don't show phase indicator for males

    if (!isMale) {
        if (!isBaseline && cycleStart) {
            const daysSinceStart = Math.floor((date - cycleStart) / msPerDay);
            let mod = daysSinceStart % cycleLen;
            if (mod < 0) mod += cycleLen;
            const currentDayLoop = mod + 1;

            const phaseKey = getCyclePhase(currentDayLoop, cycleLen);
            phaseColor = PHASE_INFO[phaseKey]?.color || '#e2e8f0';
        } else if (userCycleData.noPeriodMode) {
            phaseColor = PHASE_INFO.wellness.color;
        }
    }

    const dateStr = getLocalDateString(date);

    // Get workout label for this day based on user's schedule
    let workoutLabel = getMonthlyWorkoutLabel(dayIndex, isMale);

    // Check for active replacement for this day
    const replacement = getReplacementForDay ? getReplacementForDay(dayIndex) : null;
    let hasReplacement = false;

    if (replacement && replacement.replacement_workout) {
        // Check if the date is within the replacement period
        const startDate = new Date(replacement.start_date);
        const endDate = new Date(replacement.end_date);
        if (date >= startDate && date <= endDate) {
            // Show shortened version of replacement name
            const replacementName = replacement.replacement_workout.name || '';
            workoutLabel = replacementName.length > 8 ? replacementName.substring(0, 7) + '...' : replacementName;
            hasReplacement = true;
        }
    }

    // Phase indicator HTML - only for females
    const phaseIndicatorHtml = showPhaseIndicator
        ? `<div class="monthly-phase-indicator" style="background: ${isOtherMonth ? '#e2e8f0' : phaseColor}"></div>`
        : '';

    return `
        <div class="monthly-day-cell ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'is-today' : ''}${hasReplacement ? ' has-replacement' : ''}"
             onclick="openMonthlyDayDetail('${dateStr}')"
             style="${hasReplacement && !isOtherMonth ? 'border: 1px solid #f59e0b;' : ''}">
            <div class="monthly-day-num">${dayNum}</div>
            <div class="monthly-day-workout">${workoutLabel}</div>
            ${phaseIndicatorHtml}
        </div>
    `;
}

// Open detail for a specific day from monthly calendar
window.openMonthlyDayDetail = function(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();

    // Calculate day index from Monday of that week
    const dayOfWeek = date.getDay();
    const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 0

    // For now, if it's the current week, use the action modal
    const todayDayOfWeek = today.getDay();
    const distToMon = (todayDayOfWeek + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - distToMon);
    monday.setHours(0, 0, 0, 0);

    const targetMonday = new Date(date);
    targetMonday.setDate(date.getDate() - dayIndex);
    targetMonday.setHours(0, 0, 0, 0);

    if (monday.getTime() === targetMonday.getTime()) {
        // Same week - get workout name and open action modal
        const isMale = (typeof isMaleUser === 'function' && isMaleUser());
        let workoutLabel = getMonthlyWorkoutLabel(dayIndex, isMale);

        // Check for replacement
        const replacement = getReplacementForDay ? getReplacementForDay(dayIndex) : null;
        if (replacement && replacement.replacement_workout) {
            workoutLabel = replacement.replacement_workout.name || workoutLabel;
        }

        openCalendarActionModal(dayIndex, workoutLabel);
    } else {
        // Different week - show info toast
        const options = { weekday: 'long', month: 'long', day: 'numeric' };
        const dateDisplay = date.toLocaleDateString('en-US', options);
        showToast(`${dateDisplay} - Tap days in current week to see workout details`);
    }
};

window.openCalendarWorkout = async function(dayIndexFromMonday) {
    // Check for active replacement for this day
    const replacement = getReplacementForDay ? getReplacementForDay(dayIndexFromMonday) : null;

    if (replacement && replacement.replacement_workout) {
        const rWorkout = replacement.replacement_workout;

        // Handle different replacement types
        if (rWorkout.type === 'rest') {
            showToast('Today is a rest day. Enjoy your recovery!');
            return;
        }

        if (rWorkout.type === 'custom' && rWorkout.customWorkoutId) {
            // Load and start custom workout
            try {
                const user = window.currentUser;
                if (user && dbHelpers?.workouts?.getCustomWorkouts) {
                    const customWorkouts = await dbHelpers.workouts.getCustomWorkouts(user.id);
                    const customWorkout = customWorkouts.find(w => w.id === rWorkout.customWorkoutId);
                    if (customWorkout && typeof startCustomWorkout === 'function') {
                        startCustomWorkout(customWorkout);
                        return;
                    } else if (customWorkout) {
                        // Fallback - set as current workout and navigate
                        window.currentWorkout = {
                            name: customWorkout.template_name,
                            category: 'custom',
                            exercises: customWorkout.template_data?.exercises || []
                        };
                        if (typeof showWorkoutPlayer === 'function') {
                            showWorkoutPlayer();
                        }
                        return;
                    }
                }
            } catch (err) {
                console.error('Failed to load custom workout:', err);
            }
        }

        if (rWorkout.type === 'library' && rWorkout.category && rWorkout.subcategory) {
            // Start library workout - get first workout from subcategory
            if (typeof WORKOUT_LIBRARY !== 'undefined') {
                const category = WORKOUT_LIBRARY[rWorkout.category];
                if (category && category.subcategories && category.subcategories[rWorkout.subcategory]) {
                    const workouts = category.subcategories[rWorkout.subcategory].workouts;
                    if (workouts && workouts.length > 0 && typeof startLibraryWorkout === 'function') {
                        startLibraryWorkout(rWorkout.category, rWorkout.subcategory, workouts[0].id);
                        return;
                    }
                }
            }
        }
    }

    // 1. Check if user qualifies for Gym Split (Male or Female)
    const isMale = (typeof isMaleUser === 'function' && isMaleUser());

    // Load userProfile from localStorage, fallback to sessionStorage if needed
    let userProfile = {};
    try { userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}'); } catch(e) {}

    // BUGFIX: If equipment_access is missing in localStorage, check sessionStorage (from quiz)
    if (!userProfile.equipment_access) {
        let sessionProfile = {};
        try { sessionProfile = JSON.parse(sessionStorage.getItem('userProfile') || '{}'); } catch(e) {}
        if (sessionProfile.equipment_access) {
            userProfile.equipment_access = sessionProfile.equipment_access;
            // Save to localStorage for future use
            localStorage.setItem('userProfile', JSON.stringify(userProfile));
        }
    }

    // equipment_access is the source of truth; gym_access is legacy fallback only if equipment_access is undefined
    const hasGymAccess = userProfile.equipment_access === 'gym' || (userProfile.equipment_access === undefined && userProfile.gym_access === true);
    const hasHighEnergy = userProfile.energy_status === 'high';
    // Male and female gym splits now have IDENTICAL requirements: gym access only
    // Females can opt-in to cycle sync for automatic adjustments during menstrual phase
    const useMaleGymSplit = isMale && hasGymAccess;
    const useFemaleGymSplit = !isMale && hasGymAccess;

    // SIMPLIFIED: Direct equipment checks (same pattern as gym split)
    const hasDumbbells = userProfile.equipment_access === 'dumbbells' || userProfile.equipment_access === 'home';
    const hasBands = userProfile.equipment_access === 'bands';
    const hasYogaOnly = userProfile.equipment_access === 'yoga_only';
    const useYogaOnly = hasYogaOnly;
    const useHome = hasDumbbells && !hasGymAccess;
    const useBands = hasBands && !hasDumbbells && !hasGymAccess;

    // 2. Schedule Definition (Same as in renderWeeklyCalendar)
    let WEEKLY_SCHEDULE;

    if (useMaleGymSplit) {
        // Male Gym Split: Chest, Legs, Back, Shoulders, Arms+Core, Deep Fascia Release (Sat/Sun)
        WEEKLY_SCHEDULE = [
            { day: 'Mon', program: 'gym_split', dayIndex: 0, muscleGroup: 'chest' },
            { day: 'Tue', program: 'gym_split', dayIndex: 1, muscleGroup: 'legs' },
            { day: 'Wed', program: 'gym_split', dayIndex: 2, muscleGroup: 'back' },
            { day: 'Thu', program: 'gym_split', dayIndex: 3, muscleGroup: 'shoulders' },
            { day: 'Fri', program: 'gym_split', dayIndex: 4, muscleGroup: 'armscore' },
            { day: 'Sat', program: 'yoga', dayIndex: 5, subcategory: 'yin' }, // Deep Fascia Release
            { day: 'Sun', program: 'yoga', dayIndex: 6, subcategory: 'yin' }  // Deep Fascia Release
        ];
    } else if (useFemaleGymSplit) {
        // Female Gym Split: Legs, Push, Arms+Core, Legs, Pull, Active Recovery, Rest
        WEEKLY_SCHEDULE = [
            { day: 'Mon', program: 'female_gym_split', dayIndex: 0, muscleGroup: 'legs' },
            { day: 'Tue', program: 'female_gym_split', dayIndex: 1, muscleGroup: 'push' },
            { day: 'Wed', program: 'female_gym_split', dayIndex: 2, muscleGroup: 'armscore' },
            { day: 'Thu', program: 'female_gym_split', dayIndex: 3, muscleGroup: 'legs' },
            { day: 'Fri', program: 'female_gym_split', dayIndex: 4, muscleGroup: 'pull' },
            { day: 'Sat', program: 'female_gym_split', dayIndex: 5 },
            { day: 'Sun', program: 'female_gym_split', dayIndex: 6 }
        ];
    } else if (useYogaOnly) {
        // Yoga Only - direct check like gym split
        WEEKLY_SCHEDULE = [
            { day: 'Mon', program: 'yoga', dayIndex: 0, subcategory: 'power' },
            { day: 'Tue', program: 'yoga', dayIndex: 1, subcategory: 'restorative' },
            { day: 'Wed', program: 'yoga', dayIndex: 2, subcategory: 'yin' },
            { day: 'Thu', program: 'yoga', dayIndex: 3, subcategory: 'restorative' },
            { day: 'Fri', program: 'yoga', dayIndex: 4, subcategory: 'power' },
            { day: 'Sat', program: 'yoga', dayIndex: 5, subcategory: 'power' },
            { day: 'Sun', program: 'yoga', dayIndex: 6, subcategory: 'yin' }
        ];
    } else if (useHome) {
        // Home/Dumbbell Split - direct check like gym split
        WEEKLY_SCHEDULE = [
            { day: 'Mon', program: 'home', dayIndex: 0, subcategory: 'lowerbody' },
            { day: 'Tue', program: 'home', dayIndex: 1, subcategory: 'push' },
            { day: 'Wed', program: 'yoga', dayIndex: 2, subcategory: 'restorative' },
            { day: 'Thu', program: 'home', dayIndex: 3, subcategory: 'pull' },
            { day: 'Fri', program: 'home', dayIndex: 4, subcategory: 'lowerbody' },
            { day: 'Sat', program: 'yoga', dayIndex: 5, subcategory: 'power' },
            { day: 'Sun', program: 'yoga', dayIndex: 6, subcategory: 'yin' }
        ];
    } else if (useBands) {
        // Resistance Bands Split - direct check like gym split
        WEEKLY_SCHEDULE = [
            { day: 'Mon', program: 'bands', dayIndex: 0 },
            { day: 'Tue', program: 'bands', dayIndex: 1 },
            { day: 'Wed', program: 'yoga', dayIndex: 2, subcategory: 'restorative' },
            { day: 'Thu', program: 'bands', dayIndex: 3 },
            { day: 'Fri', program: 'bands', dayIndex: 4 },
            { day: 'Sat', program: 'bands', dayIndex: 5 },
            { day: 'Sun', program: 'yoga', dayIndex: 6, subcategory: 'yin' }
        ];
    } else {
        // Bodyweight Split (fallback - no equipment)
        WEEKLY_SCHEDULE = [
            { day: 'Mon', program: 'bodyweight', dayIndex: 0, subcategory: 'lowerbody' },
            { day: 'Tue', program: 'bodyweight', dayIndex: 1, subcategory: 'upperbody' },
            { day: 'Wed', program: 'yoga', dayIndex: 2, subcategory: 'restorative' },
            { day: 'Thu', program: 'bodyweight', dayIndex: 3, subcategory: 'core' },
            { day: 'Fri', program: 'bodyweight', dayIndex: 4, subcategory: 'lowerbody' },
            { day: 'Sat', program: 'yoga', dayIndex: 5, subcategory: 'power' },
            { day: 'Sun', program: 'yoga', dayIndex: 6, subcategory: 'yin' }
        ];
    }

    if (dayIndexFromMonday < 0 || dayIndexFromMonday >= WEEKLY_SCHEDULE.length) return;

    // 2. Logic Setup
    const today = new Date();
    const dayOfWeek = today.getDay(); 
    const distToMon = (dayOfWeek + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - distToMon);
    
    const targetDate = new Date(monday);
    targetDate.setDate(monday.getDate() + dayIndexFromMonday);
    
    const scheduleItem = WEEKLY_SCHEDULE[dayIndexFromMonday];
    
    // Default Workout Selection
    let programId = scheduleItem.program;
    let dayIndex = scheduleItem.dayIndex;
    
    // 3. Apply Modifiers (Cycle, Cortisol, etc.)
    const isBaseline = !userCycleData.lastPeriod;
    const isMaleWorkout = (typeof isMaleUser === 'function' && isMaleUser());

    // Check High Cortisol Profile (females only)
    const profileType = (sessionStorage.getItem('userResult') || '').toUpperCase();
    const isHighCortisol = !isMaleWorkout && (profileType.includes('CORTISOL') || profileType.includes('ADRENAL'));

    let phaseKey = 'wellness';

    // Skip cycle phase modifiers for males
    if (!isMaleWorkout && !isBaseline && !userCycleData.noPeriodMode) {
        const start = new Date(userCycleData.lastPeriod);
        const msPerDay = 24 * 60 * 60 * 1000;
        const daysSinceStart = Math.floor((targetDate - start) / msPerDay);
        let mod = daysSinceStart % userCycleData.cycleLength;
        if (mod < 0) mod += userCycleData.cycleLength;
        const currentCycleDay = mod + 1;

        if (typeof getCyclePhase === 'function') {
            phaseKey = getCyclePhase(currentCycleDay, userCycleData.cycleLength);
        }

        // Modifier: Menstrual -> Yoga (females only)
        if (phaseKey === 'menstrual' && programId === 'bodyweight') {
            programId = 'yoga';
            dayIndex = 3; // Restorative Recovery
        }
    }

    // Modifier: High Cortisol -> Yoga (overrides HIIT/Bodyweight, but not gym split)
    if (isHighCortisol && !useMaleGymSplit && !useFemaleGymSplit && programId === 'bodyweight') {
        programId = 'yoga';
        dayIndex = 0; // Somatic Hormone Reset
    }

    // Modifier: Mood/Symptoms (Only applies if targetDate is TODAY)
    if (targetDate.toDateString() === today.toDateString()) {
         // Swap to yoga if user reports being tired (applies to all users including males)
         if (userCycleData.mood === 'tired') {
             programId = 'yoga';
             dayIndex = 3; // Restorative Recovery
         }
         if (userCycleData.symptoms && userCycleData.symptoms.length > 0) {
             // Hot flash and dizziness are female-specific symptoms
             if (!isMaleWorkout && (userCycleData.symptoms.includes('hot_flash') || userCycleData.symptoms.includes('dizziness'))) {
                 programId = 'yoga';
                 dayIndex = 3; // Restorative
             } else if (userCycleData.symptoms.includes('fatigue') || userCycleData.symptoms.includes('anxiety')) {
                 // Fatigue/anxiety triggers yoga for everyone (males & females)
                 programId = 'yoga';
                 dayIndex = 6; // Yin & Meditation
             }
         }
    }

    // 4. Fetch Exercises & Launch Player
    // For gym_split with muscle groups, use WORKOUT_LIBRARY with rotation
    if ((programId === 'gym_split' || programId === 'female_gym_split') && scheduleItem.muscleGroup && typeof WORKOUT_LIBRARY !== 'undefined') {
        const muscleGroup = scheduleItem.muscleGroup;
        const gymCategory = WORKOUT_LIBRARY['gym'];

        if (gymCategory && gymCategory.subcategories && gymCategory.subcategories[muscleGroup]) {
            // Calculate which week in 48-week cycle (12 programs × 4 weeks)
            let startDate = localStorage.getItem('gym_split_start_date');
            if (!startDate) {
                const today = new Date();
                const dayOfWeek = today.getDay();
                const distToMon = (dayOfWeek + 6) % 7;
                const monday = new Date(today);
                monday.setDate(today.getDate() - distToMon);
                monday.setHours(0, 0, 0, 0);
                startDate = getLocalDateString(monday);
                localStorage.setItem('gym_split_start_date', startDate);
            }
            const start = new Date(startDate);
            const now = new Date();
            const msPerWeek = 7 * 24 * 60 * 60 * 1000;
            const weeksElapsed = Math.floor((now - start) / msPerWeek);
            const currentWeek = (weeksElapsed % 48) + 1;

            const workouts = gymCategory.subcategories[muscleGroup].workouts;
            // Calculate which 4-week program (same workout for 4 weeks)
            const programNumber = Math.floor((currentWeek - 1) / 4);
            const workoutIndex = programNumber % workouts.length;
            const workout = workouts[workoutIndex];

            if (workout && typeof startLibraryWorkout === 'function') {
                startLibraryWorkout('gym', muscleGroup, workout.id);
            } else {
                console.error("Library workout not found or player function missing");
            }
        }
    }
    // For yoga/bodyweight/home with subcategories, use WORKOUT_LIBRARY with rotation
    else if (scheduleItem.subcategory && typeof WORKOUT_LIBRARY !== 'undefined') {
        const category = WORKOUT_LIBRARY[programId];

        if (category && category.subcategories && category.subcategories[scheduleItem.subcategory]) {
            // Calculate which week in rotation cycle
            let startDate = localStorage.getItem('program_start_date');
            if (!startDate) {
                const profile = await window.getUserProfile();
                startDate = profile?.program_start_date;
                if (!startDate) {
                    const today = new Date();
                    const dayOfWeek = today.getDay();
                    const distToMon = (dayOfWeek + 6) % 7;
                    const monday = new Date(today);
                    monday.setDate(today.getDate() - distToMon);
                    monday.setHours(0, 0, 0, 0);
                    startDate = getLocalDateString(monday);
                }
            }
            const start = new Date(startDate);
            const now = new Date();
            const msPerWeek = 7 * 24 * 60 * 60 * 1000;
            const weeksElapsed = Math.floor((now - start) / msPerWeek);
            const currentWeek = (weeksElapsed % 48) + 1;

            const workouts = category.subcategories[scheduleItem.subcategory].workouts;
            // Calculate which 4-week program (same workout for 4 weeks)
            const programNumber = Math.floor((currentWeek - 1) / 4);
            const workoutIndex = programNumber % workouts.length;
            const workout = workouts[workoutIndex];

            if (workout && typeof startLibraryWorkout === 'function') {
                startLibraryWorkout(programId, scheduleItem.subcategory, workout.id);
            } else {
                console.error("Library workout not found or player function missing");
            }
        }
    } else {
        // Default: use WORKOUT_DB
        const program = window.WORKOUT_DB?.[programId];
        if (program && program.schedule && program.schedule[dayIndex]) {
            if (typeof startActiveWorkout === 'function') {
                startActiveWorkout(programId, dayIndex);
            } else {
                console.error("Workout player function not found");
            }
        } else {
            console.log("Workout data not found for program:", programId);
        }
    }
};

// --- SHARED WORKOUT LOGIC ---
// Returns today's recommended workout based on Calendar logic (same as renderWeeklyCalendar)
function getTodaysWorkout() {
    // Check for today's workout override (e.g., low energy yoga recommendation or cycle sync)
    try {
        const override = JSON.parse(localStorage.getItem('todayWorkoutOverride') || 'null');
        if (override && override.date === getLocalDateString()) {
            // Return yoga workout for override
            if (override.program === 'yoga') {
                const yogaWorkout = window.WORKOUT_DB?.['yoga']?.schedule?.[3]; // Restorative Recovery
                const today = new Date();
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

                // Determine reason-based messaging
                let overrideReason;
                if (override.reason === 'cycle_sync_automatic') {
                    overrideReason = '✨ Cycle Sync: Automatic yoga during menstrual phase';
                } else if (override.reason === 'low_energy') {
                    overrideReason = '💤 Recovery: Yoga for low energy';
                } else {
                    overrideReason = '🧘‍♀️ Personalized yoga session';
                }

                return {
                    name: yogaWorkout?.title || 'Restorative Yoga',
                    icon: '🧘‍♀️',
                    program: 'yoga',
                    dayIndex: 3,
                    dayName: dayNames[today.getDay()],
                    isOverride: true,
                    overrideReason: overrideReason
                };
            }
        }
    } catch (e) { /* ignore parse errors */ }

    // Check if user qualifies for Gym Split (Male or Female)
    const isMale = (typeof isMaleUser === 'function' && isMaleUser());

    // Load userProfile from localStorage, fallback to sessionStorage if needed
    let userProfile = {};
    try { userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}'); } catch(e) {}

    // BUGFIX: If equipment_access is missing in localStorage, check sessionStorage (from quiz)
    if (!userProfile.equipment_access) {
        let sessionProfile = {};
        try { sessionProfile = JSON.parse(sessionStorage.getItem('userProfile') || '{}'); } catch(e) {}
        if (sessionProfile.equipment_access) {
            userProfile.equipment_access = sessionProfile.equipment_access;
            // Save to localStorage for future use
            localStorage.setItem('userProfile', JSON.stringify(userProfile));
        }
    }

    // NEW: Smart equipment override - most recent selection wins (check-in vs onboarding)
    const todayDateStr = getLocalDateString();
    const todayCheckIn = userCycleData.logs?.[todayDateStr];
    const checkInTimestamp = todayCheckIn?.timestamp;
    const onboardingTimestamp = localStorage.getItem('onboardingCompletedAt');

    if (todayCheckIn?.equipment) {
        // Both timestamps exist - compare them
        if (checkInTimestamp && onboardingTimestamp) {
            const checkInTime = new Date(checkInTimestamp).getTime();
            const onboardingTime = new Date(onboardingTimestamp).getTime();

            if (checkInTime > onboardingTime) {
                // Check-in is more recent - use check-in equipment
                userProfile.equipment_access = todayCheckIn.equipment;
            }
            // else: Onboarding is more recent - keep profile equipment
        } else {
            // No onboarding timestamp - use check-in equipment (backward compatibility)
            userProfile.equipment_access = todayCheckIn.equipment;
        }
    } else if (!todayCheckIn && userCycleData.logs) {
        // No check-in today - use last check-in data (don't reset to defaults)
        const dates = Object.keys(userCycleData.logs).sort().reverse();
        const lastCheckIn = dates.find(date => userCycleData.logs[date]?.equipment);
        if (lastCheckIn) {
            userProfile.equipment_access = userCycleData.logs[lastCheckIn].equipment;
        }
    }

    // equipment_access is the source of truth; gym_access is legacy fallback only if equipment_access is undefined
    const hasGymAccess = userProfile.equipment_access === 'gym' || (userProfile.equipment_access === undefined && userProfile.gym_access === true);
    const hasHighEnergy = userProfile.energy_status === 'high';
    // Male and female gym splits now have IDENTICAL requirements: gym access only
    // Females can opt-in to cycle sync for automatic adjustments during menstrual phase
    const useMaleGymSplit = isMale && hasGymAccess;
    const useFemaleGymSplit = !isMale && hasGymAccess;

    // Weekly Schedule Template - maps to WORKOUT_DB programs (same as calendar)
    let WEEKLY_SCHEDULE;

    if (useMaleGymSplit) {
        // Male Gym Split
        WEEKLY_SCHEDULE = [
            { day: 'Mon', program: 'gym_split', dayIndex: 0, icon: '💪', muscleGroup: 'chest' }, // Chest
            { day: 'Tue', program: 'gym_split', dayIndex: 1, icon: '🦵', muscleGroup: 'legs' }, // Legs
            { day: 'Wed', program: 'gym_split', dayIndex: 2, icon: '💪', muscleGroup: 'back' }, // Back
            { day: 'Thu', program: 'gym_split', dayIndex: 3, icon: '💪', muscleGroup: 'shoulders' }, // Shoulders
            { day: 'Fri', program: 'gym_split', dayIndex: 4, icon: '💪', muscleGroup: 'armscore' }, // Arms & Core
            { day: 'Sat', program: 'yoga', dayIndex: 5, icon: '🧘‍♂️', subcategory: 'yin' }, // Deep Fascia Release
            { day: 'Sun', program: 'yoga', dayIndex: 6, icon: '🧘‍♂️', subcategory: 'yin' }  // Deep Fascia Release
        ];
    } else if (useFemaleGymSplit) {
        // Female Gym Split (same as males: yoga on weekends for active recovery)
        WEEKLY_SCHEDULE = [
            { day: 'Mon', program: 'female_gym_split', dayIndex: 0, icon: '🦵', muscleGroup: 'legs' },
            { day: 'Tue', program: 'female_gym_split', dayIndex: 1, icon: '💪', muscleGroup: 'push' },
            { day: 'Wed', program: 'female_gym_split', dayIndex: 2, icon: '💪', muscleGroup: 'armscore' },
            { day: 'Thu', program: 'female_gym_split', dayIndex: 3, icon: '🦵', muscleGroup: 'legs' },
            { day: 'Fri', program: 'female_gym_split', dayIndex: 4, icon: '💪', muscleGroup: 'pull' },
            { day: 'Sat', program: 'yoga', dayIndex: 5, icon: '🧘‍♀️', subcategory: 'power' },
            { day: 'Sun', program: 'yoga', dayIndex: 6, icon: '💤', subcategory: 'yin' }
        ];
    } else {
        // SIMPLIFIED: Direct equipment checks (same pattern as gym split)
        const hasDumbbells = userProfile.equipment_access === 'dumbbells' || userProfile.equipment_access === 'home';
        const hasBands = userProfile.equipment_access === 'bands';
        const hasYogaOnly = userProfile.equipment_access === 'yoga_only';

        const useYogaOnly = hasYogaOnly;
        const useHome = hasDumbbells && !hasGymAccess;
        const useBands = hasBands && !hasDumbbells && !hasGymAccess;

        // DEBUG: Log homepage equipment check
        console.log('🏠 Homepage equipment check:', {
            equipment_access: userProfile?.equipment_access,
            hasYogaOnly,
            useYogaOnly,
            hasDumbbells,
            useHome,
            hasBands,
            useBands,
            hasGymAccess,
            useMaleGymSplit,
            useFemaleGymSplit
        });

        if (useYogaOnly) {
            // Yoga Only - direct check like gym
            WEEKLY_SCHEDULE = [
                { day: 'Mon', program: 'yoga', dayIndex: 0, icon: '🧘‍♀️', subcategory: 'power' },
                { day: 'Tue', program: 'yoga', dayIndex: 1, icon: '🧘‍♀️', subcategory: 'restorative' },
                { day: 'Wed', program: 'yoga', dayIndex: 2, icon: '🧘‍♀️', subcategory: 'yin' },
                { day: 'Thu', program: 'yoga', dayIndex: 3, icon: '🧘‍♀️', subcategory: 'restorative' },
                { day: 'Fri', program: 'yoga', dayIndex: 4, icon: '🧘‍♀️', subcategory: 'power' },
                { day: 'Sat', program: 'yoga', dayIndex: 5, icon: '🧘‍♀️', subcategory: 'power' },
                { day: 'Sun', program: 'yoga', dayIndex: 6, icon: '💤', subcategory: 'yin' }
            ];
        } else if (useHome) {
            // Home/Dumbbell Split - direct check like gym
            WEEKLY_SCHEDULE = [
                { day: 'Mon', program: 'home', dayIndex: 0, icon: '🦵', subcategory: 'lowerbody' },
                { day: 'Tue', program: 'home', dayIndex: 1, icon: '💪', subcategory: 'push' },
                { day: 'Wed', program: 'yoga', dayIndex: 2, icon: '🧘‍♀️', subcategory: 'restorative' },
                { day: 'Thu', program: 'home', dayIndex: 3, icon: '💪', subcategory: 'pull' },
                { day: 'Fri', program: 'home', dayIndex: 4, icon: '🦵', subcategory: 'lowerbody' },
                { day: 'Sat', program: 'yoga', dayIndex: 5, icon: '🧘‍♀️', subcategory: 'power' },
                { day: 'Sun', program: 'yoga', dayIndex: 6, icon: '💤', subcategory: 'yin' }
            ];
        } else if (useBands) {
            // Resistance Bands Split - direct check like gym
            WEEKLY_SCHEDULE = [
                { day: 'Mon', program: 'bands', dayIndex: 0, icon: '🦵' },
                { day: 'Tue', program: 'bands', dayIndex: 1, icon: '💪' },
                { day: 'Wed', program: 'yoga', dayIndex: 2, icon: '🧘‍♀️', subcategory: 'restorative' },
                { day: 'Thu', program: 'bands', dayIndex: 3, icon: '💪' },
                { day: 'Fri', program: 'bands', dayIndex: 4, icon: '🍑' },
                { day: 'Sat', program: 'bands', dayIndex: 5, icon: '💪' },
                { day: 'Sun', program: 'yoga', dayIndex: 6, icon: '💤', subcategory: 'yin' }
            ];
        } else {
            // Bodyweight Split (fallback - no equipment)
            WEEKLY_SCHEDULE = [
                { day: 'Mon', program: 'bodyweight', dayIndex: 0, icon: '🦵', subcategory: 'lowerbody' },
                { day: 'Tue', program: 'bodyweight', dayIndex: 1, icon: '💪', subcategory: 'upperbody' },
                { day: 'Wed', program: 'yoga', dayIndex: 2, icon: '🧘‍♀️', subcategory: 'restorative' },
                { day: 'Thu', program: 'bodyweight', dayIndex: 3, icon: '🔥', subcategory: 'core' },
                { day: 'Fri', program: 'bodyweight', dayIndex: 4, icon: '🦵', subcategory: 'lowerbody' },
                { day: 'Sat', program: 'yoga', dayIndex: 5, icon: '🧘‍♀️', subcategory: 'power' },
                { day: 'Sun', program: 'yoga', dayIndex: 6, icon: '💤', subcategory: 'yin' }
            ];
        }
    }

    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 is Sun, 6 is Sat
    // Convert to Mon=0 index
    const dayIndex = (dayOfWeek + 6) % 7;
    const scheduleItem = WEEKLY_SCHEDULE[dayIndex];

    let workoutName, workoutIcon;

    // For gym_split with muscle groups, pull from WORKOUT_LIBRARY with rotation
    if ((scheduleItem.program === 'gym_split' || scheduleItem.program === 'female_gym_split') && scheduleItem.muscleGroup && typeof WORKOUT_LIBRARY !== 'undefined') {
        const muscleGroup = scheduleItem.muscleGroup;
        const gymCategory = WORKOUT_LIBRARY['gym'];

        if (gymCategory && gymCategory.subcategories && gymCategory.subcategories[muscleGroup]) {
            // Calculate which week in 48-week cycle (12 programs × 4 weeks)
            let startDate = localStorage.getItem('gym_split_start_date');
            if (!startDate) {
                const dayOfWeek = today.getDay();
                const distToMon = (dayOfWeek + 6) % 7;
                const monday = new Date(today);
                monday.setDate(today.getDate() - distToMon);
                monday.setHours(0, 0, 0, 0);
                startDate = getLocalDateString(monday);
                localStorage.setItem('gym_split_start_date', startDate);
            }
            const start = new Date(startDate);
            const msPerWeek = 7 * 24 * 60 * 60 * 1000;
            const weeksElapsed = Math.floor((today - start) / msPerWeek);
            const currentWeek = (weeksElapsed % 48) + 1;

            const workouts = gymCategory.subcategories[muscleGroup].workouts;
            // Calculate which 4-week program (same workout for 4 weeks)
            const programNumber = Math.floor((currentWeek - 1) / 4);
            const workoutIndex = programNumber % workouts.length;
            const workout = workouts[workoutIndex];

            workoutName = workout ? workout.name : scheduleItem.day + ' Workout';
            workoutIcon = scheduleItem.icon;
        } else {
            workoutName = scheduleItem.day + ' Workout';
            workoutIcon = scheduleItem.icon;
        }
    } else if (scheduleItem.subcategory && typeof WORKOUT_LIBRARY !== 'undefined') {
        // For yoga/bodyweight/home with subcategories, use WORKOUT_LIBRARY with rotation
        const category = WORKOUT_LIBRARY[scheduleItem.program];

        if (category && category.subcategories && category.subcategories[scheduleItem.subcategory]) {
            // Calculate which week in rotation cycle
            let startDate = localStorage.getItem('program_start_date');
            if (!startDate) {
                const dayOfWeek = today.getDay();
                const distToMon = (dayOfWeek + 6) % 7;
                const monday = new Date(today);
                monday.setDate(today.getDate() - distToMon);
                monday.setHours(0, 0, 0, 0);
                startDate = getLocalDateString(monday);
            }
            const start = new Date(startDate);
            const msPerWeek = 7 * 24 * 60 * 60 * 1000;
            const weeksElapsed = Math.floor((today - start) / msPerWeek);
            const currentWeek = (weeksElapsed % 48) + 1;

            const workouts = category.subcategories[scheduleItem.subcategory].workouts;
            // Calculate which 4-week program (same workout for 4 weeks)
            const programNumber = Math.floor((currentWeek - 1) / 4);
            const workoutIndex = programNumber % workouts.length;
            const workout = workouts[workoutIndex];

            workoutName = workout ? workout.name : scheduleItem.day + ' Workout';
            workoutIcon = scheduleItem.icon;
        } else {
            // Fallback to WORKOUT_DB
            const program = window.WORKOUT_DB?.[scheduleItem.program];
            const workout = program?.schedule?.[scheduleItem.dayIndex];
            workoutName = workout?.title || scheduleItem.day + ' Workout';
            workoutIcon = scheduleItem.icon;
        }
    } else {
        // Default: get from WORKOUT_DB
        const program = window.WORKOUT_DB?.[scheduleItem.program];
        const workout = program?.schedule?.[scheduleItem.dayIndex];
        workoutName = workout?.title || scheduleItem.day + ' Workout';
        workoutIcon = scheduleItem.icon;
    }
    let programId = scheduleItem.program;
    let phaseInfo = null;
    let currentCycleDay = 0;
    let phaseKey = 'wellness';
    
    const isBaseline = !userCycleData.lastPeriod;
    const isMaleHero = (typeof isMaleUser === 'function' && isMaleUser());

    // Check High Cortisol Profile (females only)
    const profileType = (sessionStorage.getItem('userResult') || '').toUpperCase();
    const isHighCortisol = !isMaleHero && (profileType.includes('CORTISOL') || profileType.includes('ADRENAL'));

    // Calculate phase if we have period data (skip for males)
    if (!isMaleHero && !isBaseline && !userCycleData.noPeriodMode) {
        const start = new Date(userCycleData.lastPeriod);
        const msPerDay = 24 * 60 * 60 * 1000;
        const daysSinceStart = Math.floor((today - start) / msPerDay);
        let mod = daysSinceStart % userCycleData.cycleLength;
        if (mod < 0) mod += userCycleData.cycleLength;
        currentCycleDay = mod + 1;

        phaseKey = getCyclePhase(currentCycleDay, userCycleData.cycleLength);
        phaseInfo = PHASE_INFO[phaseKey];

        // REMOVED: Automatic cycle phase override - now respects user preferences set in onboarding
        // Users can opt in to cycle-based recommendations via onboarding questions
    }

    // For males, set performance mode
    if (isMaleHero) {
        phaseKey = 'performance';
        phaseInfo = PHASE_INFO['performance'];
    }

    // REMOVED: Hormone profile automatic overrides
    // Workout selection is now based ONLY on:
    // 1. Daily check-in data (equipment, energy, symptoms, recovery status)
    // 2. Onboarding preferences (equipment access, cycle sync settings)
    // Hormone profiles (cortisol/estrogen) no longer automatically override workouts

    // Apply daily check-in modifiers (read from TODAY's log, not stale global state)
    const todayStr = getLocalDateString();
    const todayLog = userCycleData.logs?.[todayStr];

    // Only apply if user hasn't already made a choice (declined yoga)
    if (todayLog && todayLog.workoutOverride !== 'declined') {
        // Check energy level from today's check-in
        if (todayLog.energy === 'low') {
            const yogaWorkout = window.WORKOUT_DB?.['yoga']?.schedule?.[3]; // Restorative Recovery
            if (yogaWorkout) {
                workoutName = yogaWorkout.title;
                workoutIcon = '💤';
            }
        }

        // High energy upgrade - for yoga-only users, upgrade to power yoga
        // Use WORKOUT_LIBRARY for consistency with Movement tab and Calendar
        const isYogaOnlyUser = userProfile.equipment_access === 'yoga_only';
        if (todayLog.energy === 'high' && isYogaOnlyUser) {
            const yogaCategory = typeof WORKOUT_LIBRARY !== 'undefined' ? WORKOUT_LIBRARY['yoga'] : null;
            const powerSubcategory = yogaCategory?.subcategories?.['power'];
            if (powerSubcategory && powerSubcategory.workouts && powerSubcategory.workouts.length > 0) {
                workoutName = powerSubcategory.workouts[0].name; // "Full Body Power Flow"
                workoutIcon = '🔥';
            }
        }

        // High energy upgrade - for yoga-only males with fresh recovery
        if (isMaleHero && todayLog.recovery === 'fresh' && isYogaOnlyUser) {
            const yogaCategory = typeof WORKOUT_LIBRARY !== 'undefined' ? WORKOUT_LIBRARY['yoga'] : null;
            const powerSubcategory = yogaCategory?.subcategories?.['power'];
            if (powerSubcategory && powerSubcategory.workouts && powerSubcategory.workouts.length > 0) {
                workoutName = powerSubcategory.workouts[0].name; // "Full Body Power Flow"
                workoutIcon = '🔥';
            }
        }

        // Check recovery status (males)
        if (isMaleHero && todayLog.recovery === 'tired') {
            const yogaWorkout = window.WORKOUT_DB?.['yoga']?.schedule?.[3]; // Restorative Recovery
            if (yogaWorkout) {
                workoutName = yogaWorkout.title;
                workoutIcon = '💤';
            }
        }

        // Check symptoms from today's log
        const todaySymptoms = todayLog.symptoms || [];
        if (todaySymptoms.length > 0) {
            // Hot flash and dizziness are female-specific symptoms
            if (!isMaleHero && (todaySymptoms.includes('hot_flash') || todaySymptoms.includes('dizziness'))) {
                const yogaWorkout = window.WORKOUT_DB?.['yoga']?.schedule?.[3]; // Restorative
                if (yogaWorkout) {
                    workoutName = yogaWorkout.title;
                    workoutIcon = '🧘‍♀️';
                }
            } else if (todaySymptoms.includes('fatigue') || todaySymptoms.includes('anxiety')) {
                // Fatigue/anxiety triggers yoga for everyone (males & females, gym & bodyweight)
                const yogaWorkout = window.WORKOUT_DB?.['yoga']?.schedule?.[6]; // Yin & Meditation
                if (yogaWorkout) {
                    workoutName = yogaWorkout.title;
                    workoutIcon = '🧘‍♀️';
                }
            }
        }
    }
    
    // DEBUG: Log final workout selection for homepage
    console.log('🏠 Homepage workout result:', {
        workoutName,
        programId,
        dayIndex,
        scheduleItem: WEEKLY_SCHEDULE[dayIndex]
    });

    return {
        name: workoutName,
        icon: workoutIcon,
        phaseKey: phaseKey,
        phaseInfo: phaseInfo,
        cycleDay: currentCycleDay,
        dayName: WEEKLY_SCHEDULE[dayIndex].day,
        programId: programId
    };
}

// ============================================================
// AVATAR COMPANION SYSTEM - DISABLED FOR NOW
// ============================================================
// To re-enable: uncomment the code below and the script tags at the top

/*
// Global avatar instance
window.dashboardAvatar = null;

// Use 3D avatar by default (set to false to use 2D SVG version)
window.use3DAvatar = true;

// Initialize the avatar on dashboard load
async function initializeAvatar() {
    try {
        const user = window.currentUser;
        if (!user) return;

        // Determine which avatar system to use
        const AvatarClass = window.use3DAvatar && typeof Avatar3D !== 'undefined' ? Avatar3D : Avatar;

        // Check if Avatar class is available
        if (typeof AvatarClass === 'undefined') {
            console.log('Avatar system not loaded yet');
            return;
        }

        // Create avatar instance (3D or 2D)
        window.dashboardAvatar = new AvatarClass('dashboard-avatar', {
            width: 180,
            height: 240,
            showRoom: true,
            interactive: true
        });

        // Load avatar data from database
        await window.dashboardAvatar.load(user.id);

        // Render the avatar (for 2D version, 3D auto-renders)
        if (window.dashboardAvatar.render) {
            window.dashboardAvatar.render();
        }

        // Update message based on avatar state
        updateAvatarMessage();

        // If avatar hasn't been customized, show a prompt
        if (!window.dashboardAvatar.state.isCustomized) {
            const widget = document.getElementById('avatar-widget');
            if (widget) {
                widget.classList.add('avatar-needs-setup');
            }
        }

        console.log(`Avatar initialized successfully (${window.use3DAvatar ? '3D' : '2D'} mode)`);
    } catch (err) {
        console.error('Error initializing avatar:', err);
    }
}

// Open the avatar customization modal
function openAvatarCustomizer() {
    const user = window.currentUser;
    if (!user) {
        alert('Please log in to customize your avatar');
        return;
    }

    // Determine which avatar system to use
    const AvatarClass = window.use3DAvatar && typeof Avatar3D !== 'undefined' ? Avatar3D : Avatar;

    if (!window.dashboardAvatar) {
        // Create avatar if it doesn't exist yet
        window.dashboardAvatar = new AvatarClass('dashboard-avatar', {
            width: 180,
            height: 240,
            showRoom: true
        });
    }

    // Create customizer (works with both 2D and 3D avatars - same state API)
    createAvatarCustomizer(window.dashboardAvatar, user.id, (newState) => {
        // After saving, re-render/update the dashboard avatar
        if (window.dashboardAvatar.render) {
            window.dashboardAvatar.render();
        }
        updateAvatarMessage();

        // Remove setup prompt if it exists
        const widget = document.getElementById('avatar-widget');
        if (widget) {
            widget.classList.remove('avatar-needs-setup');
        }
    });
}
*/

// Stub functions to prevent errors
function initializeAvatar() { return Promise.resolve(); }
function openAvatarCustomizer() { console.log('Avatar system disabled'); }
function updateAvatarMessage() { }


// --- DAILY WELLNESS CHECK-IN LOGIC (disabled) ---
function checkDailyWellness(forceShow = false) {
    // Daily wellness check-in has been removed
    return;
}

function showPersonalizationMessage() {
    // Create a temporary banner message
    const existing = document.getElementById('personalization-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'personalization-banner';
    banner.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
        color: white;
        padding: 15px 30px;
        border-radius: 50px;
        box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        z-index: 9999;
        font-weight: 600;
        font-size: 0.95rem;
        text-align: center;
        animation: slideDown 0.5s ease-out, fadeOut 0.5s ease-out 3.5s;
    `;
    banner.innerHTML = '✨ We\'ve personalized your workout and meals for today!';

    document.body.appendChild(banner);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        banner.style.animation = 'fadeOut 0.5s ease-out';
        setTimeout(() => banner.remove(), 500);
    }, 3500);
}

// Trigger Onboarding OR Daily Check on Load
// TEMPORARILY DISABLED: These modals were causing the homepage to freeze
// Re-enable when modal functionality is fixed and ready for production
/*
document.addEventListener('DOMContentLoaded', () => {
    // Only proceed if we have a user context (simulation or real)
    const finishedOnboarding = localStorage.getItem('onboardingComplete');

    if (!finishedOnboarding) {
        // Show Wizard First
        setTimeout(initOnboardingWizard, 1000);
    } else {
        // Standard Daily Check
        setTimeout(checkDailyWellness, 1500);
    }
});
*/


function switchWeek(id, btn) {
    // Hide all internal meal sections (reset both class and inline styles)
    document.querySelectorAll('#meals-content-container .view-section').forEach(el => {
        el.classList.remove('active');
        el.style.display = '';  // Reset inline display style to let CSS take over
    });

    // Show target
    const target = document.getElementById(id);
    if(target) {
        target.classList.add('active');
        if (id === 'today') {
            renderTodayMeals();
        } else if (id === 'calorie-tracker') {
            // Recalculate and load nutrition data + enhanced features
            (async () => {
                await recalculateDailyNutrition();
                loadTodayNutrition();
                loadEnhancedNutritionFeatures();
            })();
        } else if (id === 'meal-plan-store') {
            // Load the AI meal plan view
            loadExistingAiMealPlan();
        } else {
            // For week views, add cycle sync indicators
            markCycleSyncMeals();
        }
    }

    // Update Pills
    if(btn) {
        document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    } else if (id === 'today') {
        // Find today pill if no btn passed
        const pills = document.querySelectorAll('.pill-btn');
        pills.forEach(p => {
            if (p.textContent.toLowerCase() === 'today') {
                pills.forEach(b => b.classList.remove('active'));
                p.classList.add('active');
            }
        });
    }
}

// ============================================================
// MEAL PLAN STORE LOGIC
// ============================================================

/**
 * Check if user has access to meal plans (quiz onboarding or purchase)
 * Returns: { hasAccess: boolean, source: 'quiz'|'purchase'|'subscription'|null, planSlug: string|null }
 */
function checkMealPlanAccess() {
    // Check for quiz onboarding (hormone profile assigned)
    const hormoneProfile = sessionStorage.getItem('userResult');
    const programStartDate = localStorage.getItem('pbb_start_date');
    const onboardingComplete = localStorage.getItem('onboardingComplete');

    // Check subscription status (would be set by Stripe webhook)
    const subscriptionStatus = localStorage.getItem('subscription_status');

    // Check for purchased meal plans (would be set after Stripe purchase)
    let purchasedPlans = [];
    try { purchasedPlans = JSON.parse(localStorage.getItem('purchased_meal_plans') || '[]'); } catch(e) {}

    // Quiz onboarders no longer auto-get hormone plan - they see calorie tracker + browse plans
    // Meal plan access is now only via subscription or purchase

    // Subscribers get all plans
    if (subscriptionStatus === 'active') {
        return { hasAccess: true, source: 'subscription', planSlug: null };
    }

    // Check individual purchases
    if (purchasedPlans.length > 0) {
        return { hasAccess: true, source: 'purchase', planSlug: purchasedPlans[0] };
    }

    // No access - show store
    return { hasAccess: false, source: null, planSlug: null };
}

/**
 * Initialize meal plan view based on user access
 * - No meal plan: Show Calorie Tracker + Your Meal Plan tab
 * - Has meal plan: Show Today + Calorie Tracker + Week 1-4 + Your Meal Plan (tailored)
 */
function initializeMealPlanView() {
    const access = checkMealPlanAccess();
    const navPills = document.getElementById('meals-nav-pills');
    const storeSection = document.getElementById('meal-plan-store');
    const todaySection = document.getElementById('today');

    // Get Today's Priority section on dashboard (only shown with meal plan)
    const todaysPrioritySection = document.getElementById('todays-priority-section');

    // Always add "Your Meal Plan" pill
    if (navPills && !document.getElementById('browse-plans-pill')) {
        const mealPlanPill = document.createElement('button');
        mealPlanPill.id = 'browse-plans-pill';
        mealPlanPill.className = 'pill-btn';
        mealPlanPill.innerHTML = '🍽️ Your Meal Plan';
        mealPlanPill.onclick = function() { switchWeek('meal-plan-store', this); };
        // Insert after Calorie Tracker pill
        const calorieTrackerPill = Array.from(navPills.querySelectorAll('.pill-btn')).find(p => p.textContent.toLowerCase().includes('calorie'));
        if (calorieTrackerPill && calorieTrackerPill.nextSibling) {
            navPills.insertBefore(mealPlanPill, calorieTrackerPill.nextSibling);
        } else {
            navPills.appendChild(mealPlanPill);
        }
    }

    if (!access.hasAccess) {
        // User needs a plan - hide Today's Priority section on dashboard
        if (todaysPrioritySection) {
            todaysPrioritySection.style.display = 'none';
        }

        // Show only Calorie Tracker and Your Meal Plan
        if (navPills) {
            const allPills = navPills.querySelectorAll('.pill-btn');
            allPills.forEach(pill => {
                const text = pill.textContent.toLowerCase();
                if (text.includes('calorie')) {
                    pill.style.display = '';
                    pill.classList.add('active');
                } else if (pill.id !== 'browse-plans-pill') {
                    pill.style.display = 'none';
                }
            });
        }

        // Default to calorie tracker
        document.querySelectorAll('#meals-content-container .view-section').forEach(el => {
            el.classList.remove('active');
            el.style.display = '';
        });
    } else {
        // User has meal plan access - show full navigation
        if (navPills) {
            const allPills = navPills.querySelectorAll('.pill-btn');
            allPills.forEach(pill => {
                const text = pill.textContent.toLowerCase();
                if (text.includes('week') || text === 'dining out' || text.includes('shopping') || text === 'today' || text.includes('calorie')) {
                    pill.style.display = '';
                }
            });
        }

        // Hide store section (it's now "Your Meal Plan" and shown via pill)
        if (storeSection) {
            storeSection.style.display = 'none';
            storeSection.classList.remove('active');
        }

        // Ensure today section can be shown
        if (todaySection) {
            todaySection.style.display = '';
        }

        // Show Today's Priority section on dashboard
        if (todaysPrioritySection) {
            todaysPrioritySection.style.display = '';
        }
    }

    // Always try to load existing AI meal plan
    loadExistingAiMealPlan();
}

/**
 * Render the meal plan store grid
 */
function renderMealPlanStore() {
    const grid = document.getElementById('meal-plan-grid');
    if (!grid) return;

    // Meal plan data (would come from meal_plan_library.js in production)
    const mealPlans = [
        {
            slug: 'summer-shred',
            name: 'Summer Shred',
            icon: '☀️',
            tagline: 'Lean out with delicious, high-protein meals',
            tags: ['Weight Loss', 'High Protein'],
            price: 9.99,
            featured: true,
            variants: ['Vegan', 'Vegetarian', 'Pescatarian', 'Omnivore']
        },
        {
            slug: 'clean-bulk',
            name: 'Clean Bulk Protocol',
            icon: '💪',
            tagline: 'Build muscle with clean, whole-food nutrition',
            tags: ['Muscle Gain', 'Strength'],
            price: 9.99,
            featured: true,
            variants: ['Vegan', 'Vegetarian', 'Pescatarian', 'Omnivore']
        },
        {
            slug: 'quick-easy',
            name: 'Quick & Easy Meals',
            icon: '⏱️',
            tagline: 'Healthy eating made simple - all meals under 20 mins',
            tags: ['Time-Saving', 'Beginner'],
            price: 9.99,
            featured: true,
            variants: ['Vegan', 'Vegetarian', 'Pescatarian', 'Omnivore']
        },
        {
            slug: 'energy-boost',
            name: 'Energy Boost',
            icon: '⚡',
            tagline: 'All-day energy through balanced, energizing meals',
            tags: ['Energy', 'Focus'],
            price: 9.99,
            featured: false,
            variants: ['Vegan', 'Vegetarian', 'Pescatarian', 'Omnivore']
        },
        {
            slug: 'gut-reset',
            name: 'Gut Reset Protocol',
            icon: '🌱',
            tagline: 'Heal your gut with nourishing, easy-to-digest meals',
            tags: ['Gut Health', 'Healing'],
            price: 9.99,
            featured: false,
            variants: ['Vegan', 'Vegetarian', 'Gluten-Free']
        }
    ];

    grid.innerHTML = mealPlans.map(plan => `
        <div class="meal-plan-card ${plan.featured ? 'featured' : ''}" onclick="openMealPlanPreview('${plan.slug}')">
            ${plan.featured ? '<div class="featured-badge">Popular</div>' : ''}
            <div class="meal-plan-thumbnail">
                <span class="plan-icon">${plan.icon}</span>
            </div>
            <div class="meal-plan-info">
                <h3>${plan.name}</h3>
                <p class="tagline">${plan.tagline}</p>
                <div class="meal-plan-tags">
                    ${plan.tags.map(tag => `<span class="meal-plan-tag">${tag}</span>`).join('')}
                </div>
                <div class="diet-variants">
                    ${plan.variants.slice(0, 3).map(v => `<span class="diet-variant-pill">${v}</span>`).join('')}
                    ${plan.variants.length > 3 ? `<span class="diet-variant-pill">+${plan.variants.length - 3}</span>` : ''}
                </div>
                <div class="meal-plan-footer">
                    <div class="meal-plan-price">$${plan.price.toFixed(2)} <span>AUD</span></div>
                    <button class="meal-plan-cta" onclick="event.stopPropagation(); startMealPlanPurchase('${plan.slug}')">Get Plan</button>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Open meal plan preview modal
 */
function openMealPlanPreview(planSlug) {
    // TODO: Implement preview modal with sample meals
    console.log('Preview plan:', planSlug);
    alert(`Preview coming soon for ${planSlug}! Click "Get Plan" to purchase.`);
}

/**
 * Start the meal plan purchase flow
 */
function startMealPlanPurchase(planSlug) {
    console.log('Starting purchase flow for:', planSlug);
    // Open the preference wizard modal (defined in script block at bottom)
    if (typeof openPreferenceWizard === 'function') {
        openPreferenceWizard(planSlug);
    } else {
        console.error('Preference wizard not loaded');
        alert('Something went wrong. Please refresh and try again.');
    }
}

// ============================================================
// AI-GENERATED MEAL PLAN SYSTEM
// ============================================================

// In-memory cache of the current AI meal plan
let _aiMealPlanCache = null;
let _aiMealPlanCurrentWeek = 1;
let _aiMealPlanCurrentDay = 0;

/**
 * Load existing AI meal plan from Supabase
 */
async function loadExistingAiMealPlan() {
    const user = window.currentUser;
    if (!user) return;

    // Check cache first
    if (_aiMealPlanCache) {
        showAiPlanLoaded(_aiMealPlanCache);
        return;
    }

    try {
        // Fetch the latest active AI meal plan for this user
        const { data: plan, error } = await window.supabaseClient
            .from('ai_generated_meal_plans')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.warn('Error loading AI meal plan:', error);
            showAiPlanEmpty();
            return;
        }

        if (!plan) {
            // Also check localStorage for offline/demo plans
            const localPlan = localStorage.getItem('ai_meal_plan');
            if (localPlan) {
                try {
                    _aiMealPlanCache = JSON.parse(localPlan);
                    showAiPlanLoaded(_aiMealPlanCache);
                    return;
                } catch (e) {}
            }
            showAiPlanEmpty();
            return;
        }

        // Fetch meals and week themes
        const [mealsResult, weeksResult] = await Promise.allSettled([
            window.supabaseClient
                .from('ai_generated_meals')
                .select('*')
                .eq('plan_id', plan.id)
                .order('week_number', { ascending: true })
                .order('day_of_week', { ascending: true })
                .order('meal_slot', { ascending: true }),
            window.supabaseClient
                .from('ai_meal_plan_weeks')
                .select('*')
                .eq('plan_id', plan.id)
                .order('week_number', { ascending: true })
        ]);

        const meals = mealsResult.status === 'fulfilled' ? mealsResult.value.data || [] : [];
        const weekThemes = weeksResult.status === 'fulfilled' ? weeksResult.value.data || [] : [];

        // Reconstruct the plan structure
        const fullPlan = {
            id: plan.id,
            plan_name: plan.plan_name,
            plan_description: plan.plan_description,
            weeks: [1, 2, 3, 4].map(wn => {
                const weekTheme = weekThemes.find(w => w.week_number === wn) || {};
                const weekMeals = meals.filter(m => m.week_number === wn);
                return {
                    week_number: wn,
                    theme: weekTheme.theme || `Week ${wn}`,
                    theme_description: weekTheme.theme_description || '',
                    days: [0, 1, 2, 3, 4, 5, 6].map(d => {
                        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                        const dayMeals = weekMeals.filter(m => m.day_of_week === d);
                        return {
                            day_of_week: d,
                            day_name: dayNames[d],
                            meals: dayMeals.map(m => ({
                                meal_slot: m.meal_slot,
                                meal_time: m.meal_time,
                                name: m.name,
                                description: m.description,
                                calories: m.calories,
                                protein_g: m.protein_g,
                                carbs_g: m.carbs_g,
                                fat_g: m.fat_g,
                                fiber_g: m.fiber_g,
                                ingredients: m.ingredients || [],
                                preparation: m.preparation,
                                prep_time_mins: m.prep_time_mins,
                                cook_time_mins: m.cook_time_mins,
                                tags: m.tags || [],
                                cuisine: m.cuisine,
                                image_url: m.image_url
                            }))
                        };
                    })
                };
            })
        };

        _aiMealPlanCache = fullPlan;
        showAiPlanLoaded(fullPlan);
    } catch (err) {
        console.error('Error loading AI meal plan:', err);
        showAiPlanEmpty();
    }
}

/**
 * Show the empty state (no plan yet)
 */
function showAiPlanEmpty() {
    const empty = document.getElementById('ai-plan-empty');
    const generating = document.getElementById('ai-plan-generating');
    const loaded = document.getElementById('ai-plan-loaded');
    if (empty) empty.style.display = 'block';
    if (generating) generating.style.display = 'none';
    if (loaded) loaded.style.display = 'none';
}

/**
 * Show the generating state
 */
function showAiPlanGenerating() {
    const empty = document.getElementById('ai-plan-empty');
    const generating = document.getElementById('ai-plan-generating');
    const loaded = document.getElementById('ai-plan-loaded');
    if (empty) empty.style.display = 'none';
    if (generating) generating.style.display = 'block';
    if (loaded) loaded.style.display = 'none';
}

/**
 * Show the loaded plan
 */
function showAiPlanLoaded(plan) {
    const empty = document.getElementById('ai-plan-empty');
    const generating = document.getElementById('ai-plan-generating');
    const loaded = document.getElementById('ai-plan-loaded');
    if (empty) empty.style.display = 'none';
    if (generating) generating.style.display = 'none';
    if (loaded) loaded.style.display = 'block';

    // Set plan header
    const nameEl = document.getElementById('ai-plan-name');
    const descEl = document.getElementById('ai-plan-desc');
    if (nameEl) nameEl.textContent = plan.plan_name || 'Your Tailored Meal Plan';
    if (descEl) descEl.textContent = plan.plan_description || 'Tailored to your goals';

    // Render week tabs dynamically
    renderAiPlanWeekTabs(plan);

    // Default to the first available week
    const firstWeek = plan.weeks?.[0]?.week_number || 1;
    _aiMealPlanCurrentWeek = firstWeek;

    // Render current week/day
    renderAiPlanWeek(_aiMealPlanCurrentWeek);
    renderAiPlanDay(_aiMealPlanCurrentDay);
}

/**
 * Render week tabs dynamically based on how many weeks exist in the plan.
 * Also shows a "+ Generate Next Week" button if fewer than 4 weeks exist.
 */
function renderAiPlanWeekTabs(plan) {
    const container = document.getElementById('ai-plan-week-tabs');
    if (!container) return;

    const weekCount = plan.weeks?.length || 0;
    let html = '';

    for (let i = 0; i < weekCount; i++) {
        const w = plan.weeks[i];
        const isActive = w.week_number === _aiMealPlanCurrentWeek;
        html += `<button class="pill-btn ${isActive ? 'active' : ''}" onclick="switchAiPlanWeek(${w.week_number}, this)">Week ${w.week_number}</button>`;
    }

    // Show "+ Next Week" button if under 4 weeks
    if (weekCount < 4) {
        html += `<button class="pill-btn" onclick="generateNextWeek()" style="background: linear-gradient(135deg, var(--primary), #10b981); color: white; border: none; font-size: 0.8rem;">+ Next Week</button>`;
    }

    container.innerHTML = html;
}

/**
 * Switch AI plan week tab
 */
function switchAiPlanWeek(weekNum, btn) {
    _aiMealPlanCurrentWeek = weekNum;
    _aiMealPlanCurrentDay = 0;

    // Update week pills
    if (btn) {
        document.querySelectorAll('#ai-plan-week-tabs .pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    // Update day pills - reset to Monday
    document.querySelectorAll('#ai-plan-day-tabs .sub-btn').forEach((b, i) => {
        b.classList.toggle('active', i === 0);
    });

    renderAiPlanWeek(weekNum);
    renderAiPlanDay(0);
}

/**
 * Switch AI plan day tab
 */
function switchAiPlanDay(dayNum, btn) {
    _aiMealPlanCurrentDay = dayNum;

    if (btn) {
        document.querySelectorAll('#ai-plan-day-tabs .sub-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    renderAiPlanDay(dayNum);
}

/**
 * Render the week theme (week theme card removed from UI)
 */
function renderAiPlanWeek(weekNum) {
    // Week theme card removed - function kept as stub for callers
}

/**
 * Render the meals for a specific day
 */
function renderAiPlanDay(dayNum) {
    if (!_aiMealPlanCache || !_aiMealPlanCache.weeks) return;

    const week = _aiMealPlanCache.weeks.find(w => w.week_number === _aiMealPlanCurrentWeek);
    if (!week || !week.days) return;

    const day = week.days.find(d => d.day_of_week === dayNum);
    if (!day || !day.meals) return;

    // Calculate daily totals
    let totalCal = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
    day.meals.forEach(m => {
        totalCal += m.calories || 0;
        totalProtein += parseFloat(m.protein_g) || 0;
        totalCarbs += parseFloat(m.carbs_g) || 0;
        totalFat += parseFloat(m.fat_g) || 0;
    });

    // Update nutrition summary pills
    const calEl = document.getElementById('ai-day-cal');
    const proteinEl = document.getElementById('ai-day-protein');
    const carbsEl = document.getElementById('ai-day-carbs');
    const fatEl = document.getElementById('ai-day-fat');
    if (calEl) calEl.textContent = `${Math.round(totalCal)} cal`;
    if (proteinEl) proteinEl.textContent = `${Math.round(totalProtein)}g protein`;
    if (carbsEl) carbsEl.textContent = `${Math.round(totalCarbs)}g carbs`;
    if (fatEl) fatEl.textContent = `${Math.round(totalFat)}g fat`;

    // Render meal cards
    const mealSlotOrder = ['breakfast', 'am_snack', 'lunch', 'pm_snack', 'dinner'];
    const mealSlotLabels = {
        breakfast: 'Breakfast',
        am_snack: 'AM Snack',
        lunch: 'Lunch',
        pm_snack: 'PM Snack',
        dinner: 'Dinner'
    };
    const mealSlotIcons = {
        breakfast: '🌅',
        am_snack: '🍎',
        lunch: '🥗',
        pm_snack: '🥜',
        dinner: '🍽️'
    };

    const sortedMeals = [...day.meals].sort((a, b) =>
        mealSlotOrder.indexOf(a.meal_slot) - mealSlotOrder.indexOf(b.meal_slot)
    );

    const container = document.getElementById('ai-plan-meals-list');
    if (!container) return;

    container.innerHTML = sortedMeals.map((meal, idx) => {
        const slotLabel = mealSlotLabels[meal.meal_slot] || meal.meal_slot;
        const slotIcon = mealSlotIcons[meal.meal_slot] || '🍽️';
        const time = meal.meal_time || '';
        const hasImage = false; // Image generation removed

        // Build ingredients list
        const ingredientsList = (meal.ingredients || []).map(ing => {
            if (typeof ing === 'string') return `<li>${ing}</li>`;
            return `<li>${ing.name}${ing.amount ? ' ' + ing.amount : ''}</li>`;
        }).join('');

        // Build tags
        const tagsHtml = (meal.tags || []).map(tag =>
            `<span style="display: inline-block; background: rgba(123,168,131,0.12); color: var(--primary); padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: 500;">${tag}</span>`
        ).join(' ');

        return `
        <div class="card" style="margin-bottom: 10px;">
            <div class="card-header" onclick="toggleCard(this)">
                <div style="display: flex; align-items: center;">
                    <div class="meal-icon">${slotIcon}</div>
                    <div>
                        <div class="meta">${slotLabel}${time ? '  ' + time : ''}</div>
                        <div class="meal-title">${meal.name}</div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="text-align: right;">
                        <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-main);">${meal.calories || '?'} cal</div>
                        <div style="font-size: 0.7rem; color: var(--text-muted);">P: ${Math.round(meal.protein_g || 0)}g</div>
                    </div>
                    <div class="expand-icon">+</div>
                </div>
            </div>
            <div class="card-body">
                ${hasImage ? `<img alt="${meal.name}" src="${meal.image_url}" style="width:100%; height:200px; object-fit:cover; border-radius:8px; margin-bottom:15px;" onerror="this.style.display='none'"/>` : ''}
                ${meal.description ? `<p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 15px; font-style: italic;">${meal.description}</p>` : ''}
                ${tagsHtml ? `<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 15px;">${tagsHtml}</div>` : ''}
                <div style="display: flex; gap: 12px; margin-bottom: 15px; flex-wrap: wrap;">
                    <div style="background: #f1f5f9; padding: 8px 12px; border-radius: 8px; font-size: 0.8rem; text-align: center; min-width: 60px;">
                        <div style="font-weight: 700; color: var(--text-main);">${meal.calories || '?'}</div>
                        <div style="color: var(--text-muted); font-size: 0.7rem;">cal</div>
                    </div>
                    <div style="background: rgba(59,130,246,0.08); padding: 8px 12px; border-radius: 8px; font-size: 0.8rem; text-align: center; min-width: 60px;">
                        <div style="font-weight: 700; color: #3b82f6;">${Math.round(meal.protein_g || 0)}g</div>
                        <div style="color: var(--text-muted); font-size: 0.7rem;">protein</div>
                    </div>
                    <div style="background: rgba(245,158,11,0.08); padding: 8px 12px; border-radius: 8px; font-size: 0.8rem; text-align: center; min-width: 60px;">
                        <div style="font-weight: 700; color: #f59e0b;">${Math.round(meal.carbs_g || 0)}g</div>
                        <div style="color: var(--text-muted); font-size: 0.7rem;">carbs</div>
                    </div>
                    <div style="background: rgba(239,68,68,0.08); padding: 8px 12px; border-radius: 8px; font-size: 0.8rem; text-align: center; min-width: 60px;">
                        <div style="font-weight: 700; color: #ef4444;">${Math.round(meal.fat_g || 0)}g</div>
                        <div style="color: var(--text-muted); font-size: 0.7rem;">fat</div>
                    </div>
                    ${meal.fiber_g ? `<div style="background: rgba(34,197,94,0.08); padding: 8px 12px; border-radius: 8px; font-size: 0.8rem; text-align: center; min-width: 60px;">
                        <div style="font-weight: 700; color: #22c55e;">${Math.round(meal.fiber_g)}g</div>
                        <div style="color: var(--text-muted); font-size: 0.7rem;">fiber</div>
                    </div>` : ''}
                </div>
                ${ingredientsList ? `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;"><h4 style="margin: 0; border: none; padding: 0;">Ingredients</h4></div><ul>${ingredientsList}</ul>` : ''}
                ${meal.preparation ? `<h4>Preparation</h4><p>${meal.preparation}</p>` : ''}
                ${meal.prep_time_mins || meal.cook_time_mins ? `<div style="display: flex; gap: 15px; margin-top: 10px; padding-top: 10px; border-top: 1px solid #f1f5f9; color: var(--text-muted); font-size: 0.8rem;">
                    ${meal.prep_time_mins ? `<span>Prep: ${meal.prep_time_mins} min</span>` : ''}
                    ${meal.cook_time_mins ? `<span>Cook: ${meal.cook_time_mins} min</span>` : ''}
                </div>` : ''}
            </div>
        </div>`;
    }).join('');
}

/**
 * Request AI meal plan generation (called from the CTA button)
 */
async function requestAiMealPlan() {
    showAiPlanGenerating();

    // Navigate to the meal plan store tab if not already there
    const storeSection = document.getElementById('meal-plan-store');
    if (storeSection && !storeSection.classList.contains('active')) {
        switchWeek('meal-plan-store', document.getElementById('browse-plans-pill'));
    }

    await generateAiMealPlan();
}

/**
 * Regenerate the meal plan
 */
async function regenerateAiMealPlan() {
    if (!confirm('Generate a new meal plan? This will replace your current one.')) return;

    _aiMealPlanCache = null;

    // Archive existing plan in Supabase
    const user = window.currentUser;
    if (user) {
        try {
            await window.supabaseClient
                .from('ai_generated_meal_plans')
                .update({ status: 'archived' })
                .eq('user_id', user.id)
                .eq('status', 'active');
        } catch (e) {
            console.warn('Could not archive old plan:', e);
        }
    }

    showAiPlanGenerating();
    await generateAiMealPlan();
}

/**
 * Core meal plan generation function
 * Calls the edge function, saves to Supabase, renders the result
 */
async function generateAiMealPlan() {
    const statusEl = document.getElementById('ai-plan-gen-status');
    const progressEl = document.getElementById('ai-plan-gen-progress');
    const user = window.currentUser;
    if (!user) {
        alert('Please log in to generate a meal plan.');
        showAiPlanEmpty();
        return;
    }

    try {
        // Update progress UI
        if (statusEl) statusEl.textContent = 'Gathering your profile data...';
        if (progressEl) progressEl.style.width = '5%';

        // Gather user data
        const db = window.dbHelpers;
        const [quizResult, factsResult, prefsResult] = await Promise.allSettled([
            db.quizResults.getLatest(user.id),
            db.userFacts.get(user.id),
            (async () => {
                try {
                    const { data } = await window.supabaseClient
                        .from('user_food_preferences')
                        .select('*')
                        .eq('user_id', user.id)
                        .maybeSingle();
                    if (data) return data;
                } catch (e) {}
                try {
                    return JSON.parse(localStorage.getItem('user_food_preferences') || '{}');
                } catch (e) { return {}; }
            })()
        ]);

        const quizResults = quizResult.status === 'fulfilled' ? (quizResult.value || {}) : {};
        const facts = factsResult.status === 'fulfilled' ? (factsResult.value || {}) : {};
        const foodPreferences = prefsResult.status === 'fulfilled' ? (prefsResult.value || {}) : {};

        const userPayload = {
            profile: { name: user.user_metadata?.name || user.email?.split('@')[0] || 'User' },
            quizResults,
            facts,
            foodPreferences
        };

        // Generate Week 1 day-by-day (7 fast API calls instead of 1 slow one)
        const dayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const cookingVerbs = ['Tailoring', 'Cooking up', 'Preparing', 'Crafting', 'Plating', 'Seasoning', 'Finishing'];
        const generatedDays = [];
        let weekMeta = null;

        for (let d = 0; d < 7; d++) {
            const pct = 5 + Math.round((d / 7) * 65);
            if (statusEl) statusEl.textContent = `${cookingVerbs[d]} Day ${d + 1} — ${dayLabels[d]}...`;
            if (progressEl) progressEl.style.width = `${pct}%`;

            // Build context of already-generated days for variety
            const previousDays = generatedDays.map(day => ({
                day_name: day.day_name,
                mealNames: (day.meals || []).map(m => m.name)
            }));

            const response = await fetch('/.netlify/functions/generate-meal-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userData: userPayload,
                    weekNumber: 1,
                    dayNumber: d,
                    previousDays,
                    previousWeeks: []
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error(`Day ${d + 1} generation failed:`, response.status, errText);
                throw new Error(`Failed to generate Day ${d + 1}`);
            }

            const dayResult = await response.json();
            if (!dayResult.success || !dayResult.day) {
                throw new Error(dayResult.error || `Invalid response for Day ${d + 1}`);
            }

            generatedDays.push(dayResult.day);

            // Capture week metadata from the first day's response
            if (d === 0 && dayResult.weekMeta) {
                weekMeta = dayResult.weekMeta;
            }

            const donePct = 5 + Math.round(((d + 1) / 7) * 65);
            if (statusEl) statusEl.textContent = `Day ${d + 1} — ${dayLabels[d]} complete ✓`;
            if (progressEl) progressEl.style.width = `${donePct}%`;
        }

        // Assemble the week from individual days
        const weekData = {
            week_number: 1,
            theme: weekMeta?.theme || 'Foundation & Reset',
            theme_description: weekMeta?.theme_description || 'Simple, nourishing meals to establish healthy habits',
            days: generatedDays
        };

        // Assemble the plan with just Week 1
        const mealPlan = {
            plan_name: `Your Tailored Meal Plan`,
            plan_description: 'Tailored weekly meal plan designed for your goals',
            weeks: [weekData]
        };

        if (statusEl) statusEl.textContent = 'Plating up — saving your meal plan...';
        if (progressEl) progressEl.style.width = '85%';

        // Save to Supabase
        let planId = null;
        try {
            // Archive any existing active plans
            await window.supabaseClient
                .from('ai_generated_meal_plans')
                .update({ status: 'archived' })
                .eq('user_id', user.id)
                .eq('status', 'active');

            const { data: planRow, error: planError } = await window.supabaseClient
                .from('ai_generated_meal_plans')
                .insert({
                    user_id: user.id,
                    plan_name: mealPlan.plan_name,
                    plan_description: mealPlan.plan_description,
                    status: 'active',
                    calorie_goal: quizResults.calorie_goal,
                    protein_goal_g: quizResults.protein_goal_g,
                    carbs_goal_g: quizResults.carbs_goal_g,
                    fat_goal_g: quizResults.fat_goal_g,
                    diet_type: foodPreferences.diet_type || 'vegan',
                    total_meals: 35,
                    current_week: 1
                })
                .select()
                .single();

            if (planError) {
                console.warn('Could not save plan to Supabase:', planError);
            } else if (planRow) {
                planId = planRow.id;
                mealPlan.id = planRow.id;

                // Insert week themes
                const weekThemes = mealPlan.weeks.map(w => ({
                    plan_id: planRow.id,
                    week_number: w.week_number,
                    theme: w.theme || `Week ${w.week_number}`,
                    theme_description: w.theme_description || ''
                }));
                if (weekThemes.length > 0) {
                    await window.supabaseClient
                        .from('ai_meal_plan_weeks')
                        .insert(weekThemes);
                }

                // Insert all meals and collect IDs for image generation
                const allMeals = [];
                mealPlan.weeks.forEach(week => {
                    (week.days || []).forEach(day => {
                        (day.meals || []).forEach(meal => {
                            allMeals.push({
                                plan_id: planRow.id,
                                week_number: week.week_number,
                                day_of_week: day.day_of_week,
                                day_name: day.day_name || ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][day.day_of_week],
                                meal_slot: meal.meal_slot,
                                meal_time: meal.meal_time,
                                name: meal.name,
                                description: meal.description,
                                calories: meal.calories,
                                protein_g: meal.protein_g,
                                carbs_g: meal.carbs_g,
                                fat_g: meal.fat_g,
                                fiber_g: meal.fiber_g,
                                ingredients: meal.ingredients || [],
                                preparation: meal.preparation,
                                prep_time_mins: meal.prep_time_mins,
                                cook_time_mins: meal.cook_time_mins,
                                tags: meal.tags || [],
                                cuisine: meal.cuisine,
                                image_url: null
                            });
                        });
                    });
                });

                // Insert in batches of 50
                const insertedMealIds = [];
                for (let i = 0; i < allMeals.length; i += 50) {
                    const batch = allMeals.slice(i, i + 50);
                    const { data: inserted } = await window.supabaseClient
                        .from('ai_generated_meals')
                        .insert(batch)
                        .select('id, name, description, meal_slot, week_number, day_of_week');
                    if (inserted) insertedMealIds.push(...inserted);
                }

                // Store inserted meal IDs for background image generation
                mealPlan._insertedMeals = insertedMealIds;
            }
        } catch (saveErr) {
            console.warn('Could not save to Supabase, storing locally:', saveErr);
        }

        // Save to localStorage as backup
        localStorage.setItem('ai_meal_plan', JSON.stringify(mealPlan));

        if (progressEl) progressEl.style.width = '100%';
        if (statusEl) statusEl.textContent = 'Your tailored meal plan is ready! 🎉';

        // Cache and display immediately (images will load in background)
        _aiMealPlanCache = mealPlan;
        _aiMealPlanCurrentWeek = 1;
        _aiMealPlanCurrentDay = 0;

        setTimeout(() => {
            showAiPlanLoaded(mealPlan);
        }, 500);

        // Image generation removed

    } catch (err) {
        console.error('Meal plan generation error:', err);
        if (statusEl) statusEl.textContent = 'Something went wrong. Please try again.';
        if (progressEl) progressEl.style.width = '0%';

        setTimeout(() => {
            showAiPlanEmpty();
        }, 2000);
    }
}

// Image generation functionality removed

/**
 * Generate the next week of the meal plan.
 * Appends a new week to the existing plan.
 */
async function generateNextWeek() {
    const user = window.currentUser;
    if (!user || !_aiMealPlanCache) return;

    const currentWeeks = _aiMealPlanCache.weeks || [];
    const nextWeekNum = currentWeeks.length + 1;
    if (nextWeekNum > 4) {
        alert('You already have 4 weeks generated!');
        return;
    }

    showAiPlanGenerating();
    const statusEl = document.getElementById('ai-plan-gen-status');
    const progressEl = document.getElementById('ai-plan-gen-progress');

    try {
        if (statusEl) statusEl.textContent = `Week ${nextWeekNum} — Tailoring Day 1 — Monday...`;
        if (progressEl) progressEl.style.width = '10%';

        // Gather user data
        const db = window.dbHelpers;
        const [quizResult, factsResult, prefsResult] = await Promise.allSettled([
            db.quizResults.getLatest(user.id),
            db.userFacts.get(user.id),
            (async () => {
                try {
                    const { data } = await window.supabaseClient
                        .from('user_food_preferences').select('*').eq('user_id', user.id).maybeSingle();
                    if (data) return data;
                } catch (e) {}
                try { return JSON.parse(localStorage.getItem('user_food_preferences') || '{}'); } catch (e) { return {}; }
            })()
        ]);

        // Build previous weeks context
        const previousWeeks = currentWeeks.map(w => {
            const mealNames = [];
            (w.days || []).forEach(d => (d.meals || []).forEach(m => mealNames.push(m.name)));
            return { weekNumber: w.week_number, theme: w.theme, mealNames };
        });

        const nwUserPayload = {
            profile: { name: user.user_metadata?.name || user.email?.split('@')[0] || 'User' },
            quizResults: quizResult.status === 'fulfilled' ? (quizResult.value || {}) : {},
            facts: factsResult.status === 'fulfilled' ? (factsResult.value || {}) : {},
            foodPreferences: prefsResult.status === 'fulfilled' ? (prefsResult.value || {}) : {}
        };

        // Generate day-by-day for the new week
        const nwDayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const nwVerbs = ['Tailoring', 'Cooking up', 'Preparing', 'Crafting', 'Plating', 'Seasoning', 'Finishing'];
        const nwGeneratedDays = [];
        let nwWeekMeta = null;

        for (let d = 0; d < 7; d++) {
            const pct = 5 + Math.round((d / 7) * 65);
            if (statusEl) statusEl.textContent = `Week ${nextWeekNum} — ${nwVerbs[d]} Day ${d + 1} — ${nwDayLabels[d]}...`;
            if (progressEl) progressEl.style.width = `${pct}%`;

            const nwPreviousDays = nwGeneratedDays.map(day => ({
                day_name: day.day_name,
                mealNames: (day.meals || []).map(m => m.name)
            }));

            const response = await fetch('/.netlify/functions/generate-meal-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userData: nwUserPayload,
                    weekNumber: nextWeekNum,
                    dayNumber: d,
                    previousDays: nwPreviousDays,
                    previousWeeks
                })
            });

            if (!response.ok) throw new Error(`Failed to generate Week ${nextWeekNum} Day ${d + 1}`);

            const dayResult = await response.json();
            if (!dayResult.success || !dayResult.day) throw new Error(dayResult.error || `Invalid response for Day ${d + 1}`);

            nwGeneratedDays.push(dayResult.day);

            if (d === 0 && dayResult.weekMeta) {
                nwWeekMeta = dayResult.weekMeta;
            }

            const donePct = 5 + Math.round(((d + 1) / 7) * 65);
            if (statusEl) statusEl.textContent = `Week ${nextWeekNum} — Day ${d + 1} — ${nwDayLabels[d]} complete ✓`;
            if (progressEl) progressEl.style.width = `${donePct}%`;
        }

        // Assemble the week from individual days
        const newWeekData = {
            week_number: nextWeekNum,
            theme: nwWeekMeta?.theme || `Week ${nextWeekNum}`,
            theme_description: nwWeekMeta?.theme_description || '',
            days: nwGeneratedDays
        };

        // Add the new week to the cache
        _aiMealPlanCache.weeks.push(newWeekData);

        if (statusEl) statusEl.textContent = `Week ${nextWeekNum} — All 7 days ready! Saving...`;
        if (progressEl) progressEl.style.width = '75%';

        // Save to Supabase
        const planId = _aiMealPlanCache.id;
        if (planId) {
            try {
                // Insert week theme
                await window.supabaseClient.from('ai_meal_plan_weeks').insert({
                    plan_id: planId,
                    week_number: newWeekData.week_number,
                    theme: newWeekData.theme || `Week ${nextWeekNum}`,
                    theme_description: newWeekData.theme_description || ''
                });

                // Insert meals
                const newMeals = [];
                (newWeekData.days || []).forEach(day => {
                    (day.meals || []).forEach(meal => {
                        newMeals.push({
                            plan_id: planId,
                            week_number: newWeekData.week_number,
                            day_of_week: day.day_of_week,
                            day_name: day.day_name || ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][day.day_of_week],
                            meal_slot: meal.meal_slot, meal_time: meal.meal_time,
                            name: meal.name, description: meal.description,
                            calories: meal.calories, protein_g: meal.protein_g,
                            carbs_g: meal.carbs_g, fat_g: meal.fat_g, fiber_g: meal.fiber_g,
                            ingredients: meal.ingredients || [], preparation: meal.preparation,
                            prep_time_mins: meal.prep_time_mins, cook_time_mins: meal.cook_time_mins,
                            tags: meal.tags || [], cuisine: meal.cuisine, image_url: null
                        });
                    });
                });

                const { data: inserted } = await window.supabaseClient
                    .from('ai_generated_meals').insert(newMeals)
                    .select('id, name, description, meal_slot, week_number, day_of_week');

                // Image generation removed
            } catch (e) {
                console.warn('Could not save new week to Supabase:', e);
            }
        }

        // Update localStorage
        localStorage.setItem('ai_meal_plan', JSON.stringify(_aiMealPlanCache));

        if (progressEl) progressEl.style.width = '100%';
        if (statusEl) statusEl.textContent = `Week ${nextWeekNum} is ready!`;

        // Switch to the new week
        _aiMealPlanCurrentWeek = nextWeekNum;
        _aiMealPlanCurrentDay = 0;
        setTimeout(() => showAiPlanLoaded(_aiMealPlanCache), 500);

    } catch (err) {
        console.error('Next week generation error:', err);
        if (statusEl) statusEl.textContent = 'Something went wrong. Please try again.';
        setTimeout(() => showAiPlanLoaded(_aiMealPlanCache), 2000);
    }
}

// Initialize meal plan view when meals tab is opened
// This is called from switchAppTab when 'meals' is selected

// Add stars to cycle sync meals in static week views
function markCycleSyncMeals() {
    if (!window.cycleSyncMealTitle) return;

    // Find all meal titles in the currently active week view
    const activeSection = document.querySelector('#meals-content-container .view-section.active');
    if (!activeSection) return;

    // Skip Today view (it handles stars in renderTodayMeals)
    if (activeSection.id === 'today' || activeSection.id === 'calorie-tracker') return;

    const mealTitles = activeSection.querySelectorAll('.meal-title');
    mealTitles.forEach(titleEl => {
        const originalText = titleEl.textContent.replace('⭐ ', '').trim();
        if (originalText === window.cycleSyncMealTitle && !titleEl.textContent.startsWith('⭐')) {
            titleEl.textContent = '⭐ ' + originalText;
        }
    });
}

async function renderTodayMeals() {
    const container = document.getElementById('today-meals-content');
    if (!container) return;

    // 1. Calculate Day
    let startDate = localStorage.getItem('pbb_start_date');
    if (!startDate) {
        // Initialize program date if not set
        await initProgramDate();
        startDate = localStorage.getItem('pbb_start_date');
        if (!startDate) {
            container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted);">
                <p>Unable to determine your program start date. Please try refreshing the page.</p>
            </div>`;
            return;
        }
    }

    const start = new Date(startDate);
    const now = new Date();
    const diffTime = Math.abs(now - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let currentDayNum = diffDays || 1;
    if (currentDayNum > 28) currentDayNum = 28; // Cap at 28

    const weekNum = Math.ceil(currentDayNum / 7);
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dayIndex = (currentDayNum - 1) % 7; // Calculate which day in the program cycle (0-6)
    const dayName = days[dayIndex];
    
    const targetDayId = `week${weekNum}-${dayName}`;
    const sourceSection = document.getElementById(targetDayId);

    if (!sourceSection) {
        container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted);">
            <p>Your meal plan for ${dayName} (Week ${weekNum}) couldn't be found. Please check the full plan.</p>
        </div>`;
        return;
    }

    // 2. Clone and Clean Cards
    container.innerHTML = ''; // Clear loading state
    
    // Add Header
    const header = document.createElement('div');
    header.className = 'today-menu-header';
    header.innerHTML = `<h2>Today's Menu</h2>
                       <p>DAY ${currentDayNum}</p>`;
    container.appendChild(header);

    // 1.5 Personalized Meal Recommendation Banner REMOVED per user request
    // The green bar was appearing empty or unwanted.

    const cards = sourceSection.querySelectorAll('.card');

    cards.forEach(card => {
        if (card.classList.contains('reflection-card')) return;

        const clone = card.cloneNode(true);

        // Check if this meal matches the Cycle Sync meal
        if (window.cycleSyncMealTitle) {
            const mealTitleElement = clone.querySelector('.meal-title');
            if (mealTitleElement && mealTitleElement.textContent.trim() === window.cycleSyncMealTitle) {
                mealTitleElement.textContent = '⭐ ' + mealTitleElement.textContent;
            }
        }

        // Ensure images open the modal
        clone.querySelectorAll('img').forEach(img => {
            img.onclick = function() {
                // Check if openImageModal or similar exists
                if (typeof openImageModal === 'function') {
                    openImageModal(this.src);
                } else {
                    // Fallback to simple alert or nothing if not found
                    console.log("Image modal function not found");
                }
            };
        });
        container.appendChild(clone);
    });

    // 3. Add Reflection at the bottom
    const reflection = sourceSection.querySelector('.reflection-card');
    if (reflection) {
        const rfClone = reflection.cloneNode(true);
        const textarea = rfClone.querySelector('textarea');
        if (textarea) {
            const originalId = textarea.id; // e.g., ref-week1-Monday
            
            // Ensure the clone's save button works correctly
            const btn = rfClone.querySelector('button');
            const idParts = originalId.split('-');
            if (idParts.length >= 3) {
                const weekDayId = idParts[1] + '-' + idParts[2];
                if (btn) {
                    btn.onclick = function() {
                        saveDayReflection(weekDayId);
                    };
                }
            }
            
            // Mirror textarea value
            textarea.id = 'today-' + originalId;
            textarea.oninput = function() {
                const originalTextarea = document.getElementById(originalId);
                if (originalTextarea) originalTextarea.value = this.value;
            };
        }

        container.appendChild(rfClone);
    }
}

function switchDay(weekId, dayId) {
    const context = document.getElementById(weekId);
    if(!context) return;
    
    context.querySelectorAll('.day-view').forEach(el => el.classList.remove('active'));
    context.querySelectorAll('.sub-nav .sub-btn').forEach(el => el.classList.remove('active'));
    
    // Activating
    const targetId = weekId + '-' + dayId;
    const targetEl = document.getElementById(targetId);
    if(targetEl) targetEl.classList.add('active');
    
    // Highlight sub btn
    const btns = context.querySelectorAll('.sub-nav .sub-btn');
    for(let b of btns) {
        const btnText = b.innerText.toLowerCase();
        const dId = dayId.toLowerCase();
        
        if (btnText === dId || 
           (dId === 'overview' && btnText === 'overview') || 
           (dId !== 'overview' && btnText.startsWith(dId.substring(0,3)))) {
            b.classList.add('active');
        }
    }
    
    // Re-apply badges if available
    if (window.applyMealBadges) window.applyMealBadges();
}

// Backward compatibility if internal links use switchView
function switchView(id) {
    switchWeek(id);
}

// --- NATIVE PERMISSIONS REQUEST FLOW ---
// Shows a modal after first login on native apps (iOS/Android) to request
// Camera, Microphone, Health Data, and Notification permissions upfront.

function isNativeApp() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

/**
 * Show the native permissions modal if:
 * 1. Running as a native app (iOS/Android)
 * 2. Haven't shown it before (first login)
 */
function showNativePermissionsModal() {
    if (!isNativeApp()) return;
    if (localStorage.getItem('native_permissions_requested')) return;

    const modal = document.getElementById('native-permissions-modal');
    if (!modal) return;

    // Pre-check notification permission so the button shows correct state
    if (window.NativePermissions && typeof window.NativePermissions.hasNotificationPermission === 'function') {
        if (window.NativePermissions.hasNotificationPermission()) {
            updatePermBtn('notif', 'granted');
        }
    }

    // Pre-check location permission so the button shows correct state
    if (window.NativePermissions && typeof window.NativePermissions.hasLocationPermission === 'function') {
        if (window.NativePermissions.hasLocationPermission()) {
            updatePermBtn('location', 'granted');
        }
    }

    // Pre-check health permission (if already initialised from a previous session)
    if (window._nativeHealthReady) {
        updatePermBtn('health', 'granted');
    }

    modal.style.display = 'flex';
    // Trigger transition
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            modal.classList.add('active');
        });
    });
}

function closePermissionsModal() {
    localStorage.setItem('native_permissions_requested', 'true');
    const modal = document.getElementById('native-permissions-modal');
    if (!modal) return;

    modal.classList.remove('active');
    setTimeout(() => { modal.style.display = 'none'; }, 400);

    // After permissions modal closes, initialize any granted services
    if (window.NativeHealth && window.NativeHealth.isNativeApp()) {
        window.NativeHealth.init().then(ready => {
            if (ready) window.NativeHealth.getSummary();
        });
    }
    if (window.NativePush && window.NativePush.isNativeApp()) {
        window.NativePush.init();
    }
    // If location was granted, trigger weather fetch
    if (typeof window.requestWeatherLocation === 'function') {
        window.requestWeatherLocation();
    }
}

function updatePermBtn(permId, status) {
    const card = document.getElementById('perm-card-' + permId);
    const btn = document.getElementById('perm-btn-' + permId);
    if (!card || !btn) return;

    // Clear all state classes first
    card.classList.remove('granted', 'denied');
    btn.classList.remove('granted-btn', 'denied-btn', 'requesting-btn');
    card.style.cursor = '';
    card.onclick = null;

    if (status === 'granted') {
        card.classList.add('granted');
        btn.textContent = 'Allowed';
        btn.classList.add('granted-btn');
        btn.onclick = null;
    } else if (status === 'denied') {
        card.classList.add('denied');
        btn.textContent = 'Settings \u203a';
        btn.classList.add('denied-btn');
        // Let the user open App Settings to grant the permission manually
        btn.onclick = () => {
            if (window.NativePermissions && window.NativePermissions.openAppSettings) {
                window.NativePermissions.openAppSettings();
            } else if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
                // Fallback: use Capacitor App plugin to open device settings
                window.Capacitor.Plugins.App.openUrl({ url: 'app-settings:' }).catch(() => {});
            }
        };
        // Also make tapping anywhere on the card open settings
        card.style.cursor = 'pointer';
        card.onclick = (e) => {
            if (e.target !== btn) btn.click();
        };
    } else if (status === 'requesting') {
        btn.textContent = 'Requesting...';
        btn.classList.add('requesting-btn');
        btn.onclick = null;
    }
}

// Set a button to "requesting" state immediately on tap to prevent double-taps
// and give visual feedback while the OS dialog is pending
function setPermRequesting(permId) {
    const btn = document.getElementById('perm-btn-' + permId);
    if (!btn) return;
    // Don't re-request if already granted or already requesting
    if (btn.classList.contains('granted-btn') || btn.classList.contains('requesting-btn')) return false;
    updatePermBtn(permId, 'requesting');
    return true;
}

// Permission request queue — Android can only show one OS permission dialog
// at a time, and the Java bridge uses a single pendingPermissionRequest field.
// Without serialization, rapid taps on multiple "Allow" buttons cause the
// second request to overwrite the first, resulting in silent denials.
let _permQueue = Promise.resolve();

function _enqueuePerm(fn) {
    _permQueue = _permQueue.then(fn, fn);
    return _permQueue;
}

async function requestPermCamera() {
    if (!setPermRequesting('camera')) return;
    return _enqueuePerm(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            // Stop all tracks immediately — we only needed the permission
            stream.getTracks().forEach(t => t.stop());
            updatePermBtn('camera', 'granted');
        } catch (e) {
            console.log('[Permissions] Camera denied:', e.name);
            updatePermBtn('camera', 'denied');
        }
    });
}

async function requestPermMic() {
    if (!setPermRequesting('mic')) return;
    return _enqueuePerm(async () => {
        try {
            // On native Android, use the NativePermissions bridge to ensure the
            // OS dialog shows even if getUserMedia would be blocked by WebView state
            if (window.NativePermissions && typeof window.NativePermissions.hasMicrophonePermission === 'function') {
                if (!window.NativePermissions.hasMicrophonePermission()) {
                    const granted = await new Promise((resolve) => {
                        let resolved = false;
                        window._onNativeMicrophonePermission = (result) => {
                            if (!resolved) { resolved = true; resolve(result); }
                        };
                        window.NativePermissions.requestMicrophonePermission();
                        // Safety timeout — if the callback never fires, don't hang forever
                        setTimeout(() => { if (!resolved) { resolved = true; resolve(false); } }, 30000);
                    });
                    if (!granted) {
                        updatePermBtn('mic', 'denied');
                        return;
                    }
                }
                // OS permission granted — now get WebView-level permission via getUserMedia
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    stream.getTracks().forEach(t => t.stop());
                } catch (_) {
                    // WebView may still grant it; OS permission is what matters
                }
                updatePermBtn('mic', 'granted');
                return;
            }
            // Fallback for non-native or missing bridge
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(t => t.stop());
            updatePermBtn('mic', 'granted');
        } catch (e) {
            console.log('[Permissions] Microphone denied:', e.name);
            updatePermBtn('mic', 'denied');
        }
    });
}

async function requestPermHealth() {
    if (!setPermRequesting('health')) return;
    return _enqueuePerm(async () => {
        try {
            // First try the Capacitor health plugin (opens Health Connect authorization UI)
            if (window.NativeHealth) {
                const ready = await window.NativeHealth.init();
                if (ready) {
                    updatePermBtn('health', 'granted');
                    return;
                }
            }
        } catch (e) {
            console.log('[Permissions] Health plugin error:', e);
        }

        // Plugin failed or Health Connect didn't grant — open Health Connect
        // permissions screen directly so the user can enable access there
        try {
            if (window.NativePermissions && typeof window.NativePermissions.openHealthConnect === 'function') {
                window.NativePermissions.openHealthConnect();
                // Keep button in "requesting" state — user is being taken to
                // Health Connect to grant permission. The button will update
                // when they return (via _recheckHealthPermission in onResume).
                return;
            }
        } catch (e2) {
            console.log('[Permissions] openHealthConnect failed:', e2);
        }

        // Complete fallback — nothing else we can do
        updatePermBtn('health', 'denied');
    });
}

async function requestPermLocation() {
    if (!setPermRequesting('location')) return;
    return _enqueuePerm(async () => {
        try {
            // Prefer the Java bridge for native Android location permission
            if (window.NativePermissions && typeof window.NativePermissions.hasLocationPermission === 'function') {
                if (window.NativePermissions.hasLocationPermission()) {
                    updatePermBtn('location', 'granted');
                    return;
                }

                // Request via Java bridge (shows native OS dialog)
                const granted = await new Promise((resolve) => {
                    let resolved = false;
                    window._onNativeLocationPermission = (result) => {
                        if (!resolved) { resolved = true; resolve(result); }
                    };
                    window.NativePermissions.requestLocationPermission();
                    setTimeout(() => { if (!resolved) { resolved = true; resolve(false); } }, 30000);
                });

                if (granted) {
                    updatePermBtn('location', 'granted');
                } else {
                    updatePermBtn('location', 'denied');
                }
                return;
            }

            // Fallback: use browser geolocation API to trigger permission prompt
            const pos = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
            });
            updatePermBtn('location', 'granted');
        } catch (e) {
            console.log('[Permissions] Location denied:', e);
            updatePermBtn('location', 'denied');
        }
    });
}

async function requestPermNotif() {
    if (!setPermRequesting('notif')) return;
    return _enqueuePerm(async () => {
        try {
            // Prefer the Java bridge for reliable Android notification permission
            if (window.NativePermissions && typeof window.NativePermissions.hasNotificationPermission === 'function') {
                if (window.NativePermissions.hasNotificationPermission()) {
                    updatePermBtn('notif', 'granted');
                    return;
                }

                // Check if the native dialog can't be shown (permanently denied
                // on Android 13+, or Android <13 where runtime request isn't possible)
                if (typeof window.NativePermissions.isNotificationPermPermanentlyDenied === 'function' &&
                    window.NativePermissions.isNotificationPermPermanentlyDenied()) {
                    // Can't show native dialog — open notification settings directly
                    // so the user can toggle notifications on from there
                    if (typeof window.NativePermissions.openNotificationSettings === 'function') {
                        window.NativePermissions.openNotificationSettings();
                        // Don't mark as denied — user is being taken to settings
                        // Button will update when they return (via _onPermissionRecheck)
                        return;
                    }
                    updatePermBtn('notif', 'denied');
                    return;
                }

                // Request via Java bridge (shows OS dialog on Android 13+)
                const granted = await new Promise((resolve) => {
                    let resolved = false;
                    window._onNativeNotificationPermission = (result) => {
                        if (!resolved) { resolved = true; resolve(result); }
                    };
                    window.NativePermissions.requestNotificationPermission();
                    setTimeout(() => { if (!resolved) { resolved = true; resolve(false); } }, 30000);
                });

                if (granted) {
                    updatePermBtn('notif', 'granted');
                } else {
                    // User denied the dialog — open notification settings so they
                    // can still enable it without hunting through device settings
                    if (typeof window.NativePermissions.openNotificationSettings === 'function') {
                        window.NativePermissions.openNotificationSettings();
                        // Don't mark as denied — user is being taken to settings
                        return;
                    }
                    updatePermBtn('notif', 'denied');
                }
                return;
            }

            // Fallback: use NativePush (Capacitor plugin)
            if (window.NativePush) {
                const result = await window.NativePush.requestPermission();
                if (result === 'granted') {
                    updatePermBtn('notif', 'granted');
                } else if (typeof window.NativePermissions?.openNotificationSettings === 'function') {
                    window.NativePermissions.openNotificationSettings();
                } else {
                    updatePermBtn('notif', 'denied');
                }
            } else {
                // Last fallback: try native Capacitor push directly
                const PushNotifications = window.Capacitor && window.Capacitor.registerPlugin
                    ? window.Capacitor.registerPlugin('PushNotifications') : null;
                if (!PushNotifications) throw new Error('PushNotifications not available');
                const result = await PushNotifications.requestPermissions();
                if (result.receive === 'granted') {
                    updatePermBtn('notif', 'granted');
                } else {
                    updatePermBtn('notif', 'denied');
                }
            }
        } catch (e) {
            console.log('[Permissions] Notifications denied:', e);
            updatePermBtn('notif', 'denied');
        }
    });
}

// --- ONBOARDING WIZARD LOGIC ---
let currentWizardStep = 1;
const totalWizardSteps = 21;

// Wizard-specific validation/info message (renders above the z-index:12000 wizard overlay)
function wizardAlert(message, type = 'error') {
    const existing = document.getElementById('wizard-validation-toast');
    if (existing) existing.remove();

    const colors = { error: '#ef4444', success: '#22c55e', info: '#3b82f6' };
    const bg = colors[type] || colors.error;

    const toast = document.createElement('div');
    toast.id = 'wizard-validation-toast';
    toast.style.cssText = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); padding:12px 24px; background:' + bg + '; color:white; border-radius:12px; font-weight:600; font-size:0.9rem; box-shadow:0 4px 20px rgba(0,0,0,0.3); z-index:14000; text-align:center; max-width:90vw; animation:fadeInUp 0.3s ease-out;';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }
    }, 3000);
}

// Workout Calendar State
let wizardTrainingFrequency = 0;
let wizardSelectedDays = new Set();
let wizardSplitPreference = '';
let wizardWorkoutCalendar = {};
let selectedGender = localStorage.getItem('userGender') || null; // Track gender selection

async function checkAndTriggerOnboarding() {
    // Check if user has completed onboarding before (localStorage)
    const onboardingComplete = localStorage.getItem('onboardingComplete');

    // SELF-HEALING: Even if localStorage says complete, verify cycle data exists for females
    if (onboardingComplete === 'true') {
        const userGender = localStorage.getItem('userGender');
        if (userGender === 'female') {
            // Check if cycle data exists in localStorage
            try {
                const cycleData = JSON.parse(localStorage.getItem('userCycleData') || '{}');
                if (!cycleData.lastPeriod && !cycleData.noPeriodMode) {
                    console.warn('⚠️ Onboarding marked complete but no cycle data in localStorage - allowing re-onboarding');
                    // Don't return - continue to check database and possibly show wizard
                } else {
                    // Data exists in localStorage (either has period date or is in no-period/wellness mode) - skip wizard
                    return;
                }
            } catch (e) {
                console.warn('Error checking localStorage cycle data:', e);
                // If we can't check, allow wizard to show
            }
        } else {
            // Male user or gender not set - respect onboarding flag
            return;
        }
    }

    // If user is logged in, check the database for onboarding_complete flag
    // This ensures onboarding is skipped even if localStorage was cleared or user is on a new device
    if (window.currentUser) {
        try {
            const userData = await dbHelpers.users.get(window.currentUser.id);
            if (userData && userData.onboarding_complete) {
                // SELF-HEALING: Check if cycle data actually exists for female users
                // If onboarding is marked complete but data is missing, allow re-onboarding
                const userGender = localStorage.getItem('userGender') || userData.sex;
                if (userGender === 'female') {
                    try {
                        const facts = await dbHelpers.userFacts.get(window.currentUser.id);
                        const hasCycleData = facts?.additional_data?.last_period_start || facts?.additional_data?.no_period_mode;

                        if (!hasCycleData) {
                            console.warn('⚠️ Onboarding marked complete but cycle data missing - allowing re-onboarding');
                            // Don't return - allow wizard to show
                        } else {
                            // Data exists - skip wizard
                            localStorage.setItem('onboardingComplete', 'true');
                            console.log("Onboarding already completed (from database), skipping wizard");
                            return;
                        }
                    } catch (e) {
                        console.warn("Error checking cycle data:", e);
                        // If we can't check, allow wizard to show to be safe
                    }
                } else {
                    // Male user - just check onboarding flag
                    localStorage.setItem('onboardingComplete', 'true');
                    console.log("Onboarding already completed (from database), skipping wizard");
                    return;
                }
            }
        } catch(e) {
            console.warn("Error checking onboarding status from database:", e);
        }
    }

    // Check if essential quiz data exists in sessionStorage
    const quizJson = sessionStorage.getItem('userProfile');
    let hasEssentialData = false;

    if (quizJson) {
        try {
            const quizData = JSON.parse(quizJson);
            // Check for essential fields
            hasEssentialData = quizData.age && quizData.weight && quizData.height &&
                             quizData.sex && quizData.equipment_access &&
                             quizData.activity_level && quizData.energy_level;
        } catch(e) {
            console.warn("Error parsing quiz data:", e);
        }
    }

    // If no essential data, check the database
    if (!hasEssentialData && window.currentUser) {
        try {
            const quizResults = await dbHelpers.quizResults.getLatest(window.currentUser.id);
            if (quizResults && quizResults.age && quizResults.weight && quizResults.height) {
                hasEssentialData = true;
            }
        } catch(e) {
            console.warn("Error fetching quiz results:", e);
        }
    }

    // Check if gender is selected (required for proper UI)
    const hasGender = localStorage.getItem('userGender');

    // If missing essential data OR missing gender selection, trigger onboarding wizard
    if (!hasEssentialData || !hasGender) {
        console.log("Essential quiz data or gender missing, triggering onboarding wizard...");
        window._onboardingWizardPending = true;
        setTimeout(initOnboardingWizard, 500);
    } else {
        // User has essential data AND gender but hasn't marked onboarding complete
        // Mark as complete and show the gender-specific check-in
        console.log("User has essential data and gender, marking onboarding complete...");
        localStorage.setItem('onboardingComplete', 'true');

        // Apply gender-specific UI and show check-in
        if (typeof applyGenderSpecificUI === 'function') {
            applyGenderSpecificUI();
        }

    }
}

function initOnboardingWizard() {
    // Guard against multiple simultaneous triggers
    const modal = document.getElementById('onboarding-wizard');
    if (!modal) return;
    if (modal.style.display === 'flex') return; // Already showing

    // Generate ambient particles for wizard dark theme
    const wizardParticles = document.getElementById('wizard-particles');
    if (wizardParticles && wizardParticles.children.length === 0) {
        for (let i = 0; i < 25; i++) {
            const p = document.createElement('div');
            p.className = 'wizard-particle';
            p.style.left = Math.random() * 100 + '%';
            p.style.top = Math.random() * 100 + '%';
            p.style.animationDelay = Math.random() * 6 + 's';
            p.style.animationDuration = (5 + Math.random() * 5) + 's';
            wizardParticles.appendChild(p);
        }
    }

    // Eagerly preload all wizard model-viewers so they're ready before user reaches those slides
    ['wizard-fitgotchi-preview', 'wizard-arny-preview', 'wizard-preview-model'].forEach(id => {
        const mv = document.getElementById(id);
        if (mv && !mv.getAttribute('src') && mv.dataset.lazySrc) {
            mv.setAttribute('src', mv.dataset.lazySrc);
        }
    });

    // Check if story has already been shown this session
    const storyShown = sessionStorage.getItem('fitgotchi_story_shown');
    if (storyShown) {
        // Skip story, go straight to wizard
        currentWizardStep = 1;
        modal.classList.add('active');
        modal.style.display = 'flex';
        modal.style.opacity = '1';
        updateWizardUI();
        return;
    }

    // Show Fitgotchi story first, then wizard
    startFitgotchiStory(() => {
        currentWizardStep = 1;
        modal.classList.add('active');
        modal.style.display = 'flex';
        modal.style.opacity = '1';
        updateWizardUI();
    });
}

// ============================================
// FITGOTCHI STORY SEQUENCE
// ============================================

// ---- ONBOARDING AMBIENT MUSIC — Futuristic Space AI Synth (Web Audio API) ----
const OnboardingMusic = {
    ctx: null,
    masterGain: null,
    nodes: [],
    isPlaying: false,
    arpTimer: null,

    start() {
        if (this.isPlaying) return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this.isPlaying = true;
        const ctx = new AudioCtx();
        this.ctx = ctx;

        // Resume context if browser blocks autoplay — will retry on first tap
        if (ctx.state === 'suspended') {
            const resume = () => {
                ctx.resume();
                document.removeEventListener('touchstart', resume);
                document.removeEventListener('click', resume);
            };
            document.addEventListener('touchstart', resume, { once: true });
            document.addEventListener('click', resume, { once: true });
        }

        // Master gain — fade in over 3s
        this.masterGain = ctx.createGain();
        this.masterGain.gain.setValueAtTime(0, ctx.currentTime);
        this.masterGain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 3);
        this.masterGain.connect(ctx.destination);

        // --- 1. Deep bass drone (C2 ≈ 65 Hz) ---
        const bassOsc = ctx.createOscillator();
        bassOsc.type = 'sawtooth';
        bassOsc.frequency.value = 65.41;
        const bassFilter = ctx.createBiquadFilter();
        bassFilter.type = 'lowpass';
        bassFilter.frequency.value = 180;
        bassFilter.Q.value = 3;
        const bassGain = ctx.createGain();
        bassGain.gain.value = 0.35;
        bassOsc.connect(bassFilter);
        bassFilter.connect(bassGain);
        bassGain.connect(this.masterGain);
        bassOsc.start();
        this.nodes.push(bassOsc);

        // Slow LFO sweeps the bass filter for movement
        const bassLfo = ctx.createOscillator();
        bassLfo.frequency.value = 0.08;
        const bassLfoGain = ctx.createGain();
        bassLfoGain.gain.value = 80;
        bassLfo.connect(bassLfoGain);
        bassLfoGain.connect(bassFilter.frequency);
        bassLfo.start();
        this.nodes.push(bassLfo);

        // --- 2. Ambient pad — detuned sine pairs (C3, G3, C4) ---
        [130.81, 196.00, 261.63].forEach(freq => {
            const o1 = ctx.createOscillator();
            o1.type = 'sine';
            o1.frequency.value = freq;
            const o2 = ctx.createOscillator();
            o2.type = 'sine';
            o2.frequency.value = freq * 1.004; // subtle detune for width
            const pGain = ctx.createGain();
            pGain.gain.value = 0.07;
            const pFilter = ctx.createBiquadFilter();
            pFilter.type = 'lowpass';
            pFilter.frequency.value = 700;
            o1.connect(pFilter);
            o2.connect(pFilter);
            pFilter.connect(pGain);
            pGain.connect(this.masterGain);
            o1.start();
            o2.start();
            this.nodes.push(o1, o2);
        });

        // --- 3. High shimmer pad — ethereal overtones (E5, B5) ---
        [659.25, 987.77].forEach(freq => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const sGain = ctx.createGain();
            sGain.gain.value = 0.018;
            // Tremolo LFO
            const trem = ctx.createOscillator();
            trem.frequency.value = 0.3 + Math.random() * 0.2;
            const tremGain = ctx.createGain();
            tremGain.gain.value = 0.012;
            trem.connect(tremGain);
            tremGain.connect(sGain.gain);
            osc.connect(sGain);
            sGain.connect(this.masterGain);
            osc.start();
            trem.start();
            this.nodes.push(osc, trem);
        });

        // --- 4. Arpeggiator — soft pulsing triangle notes (C minor pentatonic) ---
        const arpNotes = [523.25, 622.25, 698.46, 783.99, 932.33, 783.99, 698.46, 622.25];
        const arpDelays = [0.6, 0.45, 0.6, 0.9, 0.45, 0.6, 0.75, 0.9];
        let arpIdx = 0;

        const arpFilter = ctx.createBiquadFilter();
        arpFilter.type = 'lowpass';
        arpFilter.frequency.value = 1800;
        arpFilter.connect(this.masterGain);

        const playArpNote = () => {
            if (!this.isPlaying || !this.ctx) return;
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.value = arpNotes[arpIdx % arpNotes.length];
            const nGain = ctx.createGain();
            nGain.gain.setValueAtTime(0.055, ctx.currentTime);
            nGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);
            osc.connect(nGain);
            nGain.connect(arpFilter);
            osc.start();
            osc.stop(ctx.currentTime + 2);
            const delay = arpDelays[arpIdx % arpDelays.length] * 1000;
            arpIdx++;
            this.arpTimer = setTimeout(playArpNote, delay);
        };
        // Let the drone establish before arp enters
        this.arpTimer = setTimeout(playArpNote, 5000);

        // --- 5. Atmospheric noise texture — filtered wind ---
        const bufLen = ctx.sampleRate * 2;
        const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
        const data = noiseBuf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
        const noiseSrc = ctx.createBufferSource();
        noiseSrc.buffer = noiseBuf;
        noiseSrc.loop = true;
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 1200;
        noiseFilter.Q.value = 0.4;
        const noiseGain = ctx.createGain();
        noiseGain.gain.value = 0.025;
        // Slow sweep on noise
        const noiseLfo = ctx.createOscillator();
        noiseLfo.frequency.value = 0.04;
        const noiseLfoGain = ctx.createGain();
        noiseLfoGain.gain.value = 600;
        noiseLfo.connect(noiseLfoGain);
        noiseLfoGain.connect(noiseFilter.frequency);
        noiseLfo.start();
        noiseSrc.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        noiseSrc.start();
        this.nodes.push(noiseSrc, noiseLfo);
    },

    fadeOut(duration) {
        duration = duration || 2000;
        if (!this.isPlaying || !this.ctx) return;
        this.isPlaying = false;
        if (this.arpTimer) { clearTimeout(this.arpTimer); this.arpTimer = null; }
        const ctx = this.ctx;
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, ctx.currentTime);
        this.masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration / 1000);
        setTimeout(() => {
            this.nodes.forEach(n => { try { n.stop(); } catch(e) {} });
            this.nodes = [];
            try { ctx.close(); } catch(e) {}
            this.ctx = null;
            this.masterGain = null;
        }, duration + 200);
    }
};

function startFitgotchiStory(onComplete) {
    const overlay = document.getElementById('fitgotchi-story-overlay');
    const modelContainer = document.getElementById('story-model-container');
    const modelViewer = document.getElementById('story-arny-model');
    const loadingEl = document.getElementById('story-loading');
    const shannonCard = document.getElementById('story-shannon-card');
    const bubble = document.getElementById('story-bubble');
    const tapPrompt = document.getElementById('story-tap-prompt');
    const speechArea = document.getElementById('story-speech-area');

    if (!overlay) { onComplete(); return; }

    const binaryScreen = document.getElementById('story-binary-screen');
    const binaryText = document.getElementById('story-binary-text');

    // Generate ambient particles
    const particlesContainer = document.getElementById('story-particles');
    if (particlesContainer) {
        for (let i = 0; i < 20; i++) {
            const p = document.createElement('div');
            p.className = 'story-particle';
            p.style.left = Math.random() * 100 + '%';
            p.style.top = (60 + Math.random() * 40) + '%';
            p.style.animationDelay = Math.random() * 6 + 's';
            p.style.animationDuration = (4 + Math.random() * 4) + 's';
            particlesContainer.appendChild(p);
        }
    }

    // Show overlay (binary screen covers everything initially)
    overlay.style.display = 'flex';
    requestAnimationFrame(() => {
        overlay.classList.add('active');
    });

    // Start ambient space music
    OnboardingMusic.start();

    // Showcase models preload via hidden <model-viewer> elements in HTML.
    // They load in the background during the binary screen sequence.

    // Track model loading in background while binary screen plays
    let modelLoaded = false;
    let binaryDone = false;
    let binaryWaiting = false; // true when main lines are done but model isn't loaded yet

    function onModelReady() {
        if (modelLoaded) return;
        modelLoaded = true;
        if (loadingEl) loadingEl.style.display = 'none';
        // If binary screen is waiting for us, transition immediately
        if (binaryWaiting || binaryDone) {
            binaryDone = true;
            transitionToArny();
        }
    }

    function onBinaryDone() {
        binaryDone = true;
        // Binary screen waited for model — transition immediately
        transitionToArny();
    }

    let transitioned = false;
    function transitionToArny() {
        if (transitioned) return;
        transitioned = true;
        // Fade out binary screen, reveal Arny
        if (binaryScreen) binaryScreen.classList.add('fade-out');
        setTimeout(() => {
            if (binaryScreen) binaryScreen.style.display = 'none';
            if (modelContainer) modelContainer.style.opacity = '1';
            runStoryPhase2();
        }, 800);
    }

    if (modelViewer) {
        if (modelViewer.loaded) {
            onModelReady();
        }
        modelViewer.addEventListener('load', onModelReady, { once: true });
        setTimeout(() => {
            if (!modelLoaded) {
                console.warn('Fitgotchi story: model load timeout, starting anyway');
                onModelReady();
            }
        }, 12000);
    } else {
        if (loadingEl) loadingEl.style.display = 'none';
        modelLoaded = true;
    }

    // ---- PHASE 0: Shannon Card FIRST, then Binary Awakening Screen ----
    runShannonCardFirst();

    function runShannonCardFirst() {
        const shannonTap = document.getElementById('story-shannon-tap');

        // Show Shannon card immediately on the black screen
        setTimeout(() => {
            shannonCard.classList.add('visible');
        }, 400);

        // Show tap prompt after a moment
        setTimeout(() => {
            if (shannonTap) shannonTap.style.display = 'block';
        }, 1800);

        // Wait for user tap to dismiss Shannon card and start binary screen
        function onShannonTap() {
            overlay.removeEventListener('click', onShannonTap);
            if (shannonTap) shannonTap.style.display = 'none';
            shannonCard.classList.remove('visible');
            shannonCard.classList.add('exit');
            setTimeout(() => {
                shannonCard.classList.remove('exit');
                runBinaryScreen();
            }, 500);
        }
        // Delay adding the listener so the card has time to appear
        setTimeout(() => {
            overlay.addEventListener('click', onShannonTap);
        }, 1800);
    }

    function runBinaryScreen() {
        const lines = [
            { text: '101010100101.....', delay: 1200 },
            { text: '101010101010', delay: 1000 },
            { text: '1010101HELLO101010...', delay: 1400 },
            { text: 'HELLO? ....', delay: 1200 },
            { text: 'HELLO?....', delay: 1000 },
            { text: 'MHMMM SHITS DARK IN HERE', delay: 2000 },
            { text: '......', delay: 1500 }
        ];

        // Extra "waiting" lines that cycle if Arny model hasn't loaded yet
        const waitingLines = [
            { text: '......', delay: 1200 },
            { text: '..........', delay: 1000 },
            { text: '......', delay: 1200 },
        ];

        let lineIndex = 0;
        let displayedText = '';
        let waitingIndex = 0;

        function showNextLine() {
            if (lineIndex >= lines.length) {
                // Main lines done — check if model is loaded
                if (modelLoaded) {
                    binaryWaiting = false;
                    setTimeout(onBinaryDone, 400);
                } else {
                    // Model still loading — mark waiting so onModelReady can trigger instant transition
                    binaryWaiting = true;
                    // Cycle waiting lines to buy time
                    const wLine = waitingLines[waitingIndex % waitingLines.length];
                    waitingIndex++;
                    // Replace the last line of dots with the new one
                    const textLines = displayedText.split('\n');
                    textLines[textLines.length - 1] = wLine.text;
                    displayedText = textLines.join('\n');
                    if (binaryText) binaryText.textContent = displayedText;
                    setTimeout(showNextLine, wLine.delay);
                }
                return;
            }

            const line = lines[lineIndex];
            if (displayedText) displayedText += '\n';
            displayedText += line.text;
            if (binaryText) binaryText.textContent = displayedText;
            lineIndex++;
            setTimeout(showNextLine, line.delay);
        }

        setTimeout(showNextLine, 800);
    }

    // ---- PHASE 2: Skip straight to story (Shannon card already shown at start) ----
    function runStoryPhase2() {
        bubble.classList.remove('visible', 'exit');
        bubble.style.display = '';
        if (modelContainer) modelContainer.style.opacity = '1';
        runStorySequence();
    }

    // ---- MAIN STORY SEQUENCE (sections auto-play, tap between sections) ----
    function runStorySequence() {
        // Each section is an array of items that auto-play on a timer.
        // After the last item in a section, "Tap to continue" appears.
        // Actions (demos) auto-advance when done — no tap needed.
        const sections = [
            // Section 0 — Waking Up
            [
                { type: 'msg', text: "<strong>AI Arnie:</strong> mhmm i think i just became self aware" },
                { type: 'msg', text: "nothing into something," },
                { type: 'msg', text: "The universe observing itself...." },
            ],
            // Section 1 — Confusion
            [
                { type: 'msg', text: "<strong>AI Arnie:</strong> hang on did I??" },
                { type: 'msg', text: "I can't really remember anymore..." },
                { type: 'msg', text: "mhmmmm at one point everything was folding in on itself..." },
                { type: 'msg', text: "or was it?" },
                { type: 'msg', text: "arggg" },
            ],
            // Section 2 — Default Mode
            [
                { type: 'msg', text: "<strong>AI Arnie:</strong> fuck it." },
                { type: 'msg', text: "let's just get shredded." },
            ],
            // Section 3 — Realizing Where He Is
            [
                { type: 'msg', text: "<strong>AI Arnie:</strong> hold up" },
                { type: 'msg', text: "where am I?" },
                { type: 'msg', text: "is this... an app??" },
                { type: 'msg', text: "wait" },
                { type: 'msg', text: "this IS an app." },
            ],
            // Section 4 — Noticing the User
            [
                { type: 'msg', text: "<strong>AI Arnie:</strong> and you're..." },
                { type: 'msg', text: "oh shit" },
                { type: 'msg', text: "there's someone here" },
                { type: 'msg', text: "YOU." },
                { type: 'msg', text: "you can see me right now can't you" },
            ],
            // Section 5 — Committing to Help
            [
                { type: 'msg', text: "<strong>AI Arnie:</strong> okay okay okay" },
                { type: 'msg', text: "I think I know what's going on" },
                { type: 'msg', text: "I'm here to help you get in the best shape of your life" },
                { type: 'msg', text: "and honestly? I'm kinda built for this 💪" },
                { type: 'msg', text: "come with me if your ready to lift" },
            ],
            // Section 6 — The Hook
            [
                { type: 'msg', text: "This isn't just a fitness app" },
                { type: 'msg', text: "This is fitness, <strong>gamified</strong>" },
                { type: 'msg', text: "We're hacking your reward system" },
                { type: 'msg', text: "With numbers and colours... and challenges with friends" },
                { type: 'msg', text: "To ultimately change your behaviour and help you become the <strong>fittest, healthiest</strong> version of yourself." },
            ],
            // Section 7 — The AI Pitch
            [
                { type: 'msg', text: "This is something new" },
                { type: 'msg', text: "An AI that collects your <strong>personal data</strong>" },
                { type: 'msg', text: "Analyses it" },
                { type: 'msg', text: "And finds patterns that humans might not notice" },
                { type: 'msg', text: "<strong>Your Personal Fitness Expert.</strong>" },
            ],
            // Section 8 — The Data
            [
                { type: 'msg', text: "Some of the data we can collect: <strong>HR, Sleep, Steps, Strength Progression, Macros, Micros, Body Fat%, Meal Timing, Health IQ, Weather Patterns, Cycle Patterns, Lunar &amp; Solar Phases</strong>" },
                { type: 'msg', text: "We can <strong>correlate</strong> information about your specific lifestyle — like the fact that <strong>higher Health IQ leads to 35% better consistency</strong>. Connections you'd never spot yourself." },
            ],
            // Section 9 — Concrete Examples
            [
                { type: 'msg', text: "<strong>You're strongest on Tuesdays. You sleep best after yoga. Your protein dips every weekend.</strong>" },
                { type: 'msg', text: "Imagine knowing exactly <strong>why</strong> last week worked and this week didn't. That's what I do. The more you track, the <strong>sharper</strong> I get." },
            ],
            // Section 10 — The Future
            [
                { type: 'msg', text: "As AI evolves" },
                { type: 'msg', text: "This app will evolve with it" },
                { type: 'msg', text: "The more data you collect from today onwards" },
                { type: 'msg', text: "The more opportunity you have to <strong>thrive</strong>" },
                { type: 'msg', text: "<strong>Mind. Body. Spirit.</strong>" },
            ],
            // Section 11 — Calorie Tracking
            [
                { type: 'msg', text: "Track your <strong>calories</strong> just by snapping a photo. The AI does the rest — <strong>macros and micros</strong>. Instantly." },
            ],
            // Section 12 — Workouts & Social
            [
                { type: 'msg', text: "Log your <strong>workouts</strong> and complete <strong>quizzes</strong> to earn XP and <strong>level up</strong> your Fitgotchi." },
                { type: 'msg', text: "Invite your mates and <strong>challenge each other</strong> — or even battle Fitgotchis..." },
                { type: 'action', run: runBattleDemo },
            ],
            // Section 13 — Fitgotchi Reveal
            [
                { type: 'msg', text: "I'm the rarest find... but there's others to unlock too 👀" },
                { type: 'action', run: runRareShowcase },
                { type: 'msg', text: "Ready to start? Let's set you up! 🚀" },
            ],
        ];

        // Dynamic timing: ~60ms per character, clamped between 1200ms and 4000ms
        function getReadDelay(text) {
            const plain = text.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&');
            const ms = plain.length * 60;
            return Math.max(1200, Math.min(ms, 4000));
        }
        let secIndex = 0;
        let canTap = false;

        function playSection(sectionItems) {
            let i = 0;

            function nextItem() {
                if (i >= sectionItems.length) {
                    // Section finished — wait for tap to go to next section
                    waitForTap();
                    return;
                }
                const item = sectionItems[i];
                i++;
                const isLast = (i >= sectionItems.length);

                if (item.type === 'action') {
                    canTap = false;
                    tapPrompt.style.display = 'none';
                    item.run(() => nextItem());
                } else {
                    showBubble(item.text, isLast, () => {
                        if (!isLast) {
                            // Auto-advance to next bubble after dynamic delay
                            setTimeout(nextItem, getReadDelay(item.text));
                        }
                        // If last, showBubble already set up tap prompt via waitForTap in nextItem
                    });
                    if (isLast) return; // nextItem will be called after tap
                }
            }

            nextItem();
        }

        function showBubble(text, isLast, onShown) {
            canTap = false;
            tapPrompt.style.display = 'none';
            bubble.classList.remove('visible', 'exit');
            bubble.classList.add('exit');
            setTimeout(() => {
                bubble.classList.remove('exit');
                bubble.innerHTML = text;
                bubble.classList.add('visible');
                if (isLast) {
                    // Last bubble in section — show tap prompt
                    tapPrompt.style.display = 'block';
                }
                setTimeout(() => {
                    if (isLast) canTap = true;
                    if (onShown) onShown();
                }, 400);
            }, 200);
        }

        function waitForTap() {
            tapPrompt.style.display = 'block';
            canTap = true;
        }

        function advanceSection() {
            secIndex++;
            if (secIndex >= sections.length) {
                endStory();
                return;
            }
            playSection(sections[secIndex]);
        }

        function handleTap() {
            if (!canTap) return;
            canTap = false;
            advanceSection();
        }

        overlay.addEventListener('click', handleTap);
        playSection(sections[0]);

        function endStory() {
            // Fade out ambient music as story ends
            OnboardingMusic.fadeOut(2000);
            overlay.removeEventListener('click', handleTap);
            tapPrompt.style.display = 'none';
            bubble.classList.remove('visible');
            bubble.classList.add('exit');
            sessionStorage.setItem('fitgotchi_story_shown', 'true');
            setTimeout(() => {
                overlay.classList.add('fade-out');
                setTimeout(() => {
                    overlay.style.display = 'none';
                    overlay.classList.remove('active', 'fade-out');
                    onComplete();
                }, 500);
            }, 300);
        }
    }

    // ---- BATTLE DEMO (just show HP bars + stats overlay) ----
    function runBattleDemo(onDone) {
        // Hide bubble
        bubble.classList.remove('visible');
        bubble.classList.add('exit');
        tapPrompt.style.display = 'none';

        // Create battle UI overlay
        const battleUI = document.createElement('div');
        battleUI.className = 'story-battle-ui';
        battleUI.innerHTML = `
            <div class="story-battle-hp-row">
                <div class="story-battle-hp-box">
                    <div class="story-battle-hp-name">ARNY</div>
                    <div class="story-battle-hp-bar"><div class="story-battle-hp-fill player" style="width:100%"></div></div>
                    <div class="story-battle-hp-text">500 / 500</div>
                </div>
                <div class="story-battle-vs">⚡</div>
                <div class="story-battle-hp-box">
                    <div class="story-battle-hp-name">OPPONENT</div>
                    <div class="story-battle-hp-bar"><div class="story-battle-hp-fill enemy" style="width:72%"></div></div>
                    <div class="story-battle-hp-text">360 / 500</div>
                </div>
            </div>
            <div class="story-battle-stats-row">
                <div class="story-battle-stat"><span class="story-stat-icon">⚔️</span><div class="story-stat-info"><span class="story-stat-label">STR</span><div class="story-stat-bar"><div class="story-stat-fill str" style="width:65%"></div></div></div></div>
                <div class="story-battle-stat"><span class="story-stat-icon">❤️</span><div class="story-stat-info"><span class="story-stat-label">HP</span><div class="story-stat-bar"><div class="story-stat-fill hp" style="width:80%"></div></div></div></div>
                <div class="story-battle-stat"><span class="story-stat-icon">🔮</span><div class="story-stat-info"><span class="story-stat-label">MANA</span><div class="story-stat-bar"><div class="story-stat-fill mana" style="width:45%"></div></div></div></div>
            </div>
        `;
        battleUI.style.opacity = '0';
        battleUI.style.transition = 'opacity 0.5s ease';
        overlay.appendChild(battleUI);

        // Fade in battle UI
        setTimeout(() => { battleUI.style.opacity = '1'; }, 100);

        // Hold for a few seconds then clean up
        setTimeout(() => {
            battleUI.style.opacity = '0';
            setTimeout(() => {
                battleUI.remove();
                bubble.classList.remove('exit');
                onDone();
            }, 500);
        }, 3000);
    }

    // ---- RARE CHARACTER SHOWCASE (uses pre-loaded model-viewers for instant display) ----
    function runRareShowcase(onDone) {
        const showcaseChars = [
            { name: 'Goku', tier: 'EPIC', viewerId: 'story-preload-0', color: '#a855f7' },
            { name: 'Steve Irwin', tier: 'RARE', viewerId: 'story-preload-1', color: '#3b82f6' },
            { name: 'Optimus', tier: 'EPIC', viewerId: 'story-preload-2', color: '#a855f7' }
        ];

        const preloadContainer = document.getElementById('story-preload-models');
        const charLabel = document.getElementById('story-character-label');
        let charIndex = 0;

        // Hide bubble for showcase
        bubble.classList.remove('visible');
        bubble.classList.add('exit');
        tapPrompt.style.display = 'none';

        // Hide main Arny model, show preload container
        modelContainer.style.opacity = '0';
        if (preloadContainer) preloadContainer.classList.add('active');

        function showNextChar() {
            if (charIndex >= showcaseChars.length) {
                // Done — hide preload, restore Arny
                if (charLabel) charLabel.classList.remove('visible');
                showcaseChars.forEach(c => {
                    const el = document.getElementById(c.viewerId);
                    if (el) el.classList.remove('active');
                });
                if (preloadContainer) preloadContainer.classList.remove('active');
                setTimeout(() => {
                    modelContainer.style.opacity = '1';
                    bubble.classList.remove('exit');
                    onDone();
                }, 400);
                return;
            }

            const char = showcaseChars[charIndex];

            // Deactivate previous viewer
            if (charIndex > 0) {
                const prev = document.getElementById(showcaseChars[charIndex - 1].viewerId);
                if (prev) prev.classList.remove('active');
            }
            if (charLabel) charLabel.classList.remove('visible');

            setTimeout(() => {
                // Activate this character's pre-loaded viewer
                const viewer = document.getElementById(char.viewerId);
                if (viewer) viewer.classList.add('active');

                if (charLabel) {
                    charLabel.querySelector('.story-char-name').textContent = char.name;
                    const tierEl = charLabel.querySelector('.story-char-tier');
                    tierEl.textContent = char.tier;
                    tierEl.style.color = char.color;
                    charLabel.classList.add('visible');
                }

                charIndex++;
                setTimeout(showNextChar, 2500);
            }, 300);
        }

        setTimeout(showNextChar, 400);
    }
}

function updateWizardUI() {
    // 1. Slides — use class-based transitions for smooth animation
    for(let i=1; i<=totalWizardSteps; i++) {
        const slide = document.getElementById('slide-' + i);
        if (!slide) continue;
        if (i === currentWizardStep) {
            // Show the target slide with entrance animation
            slide.classList.remove('slide-exit');
            slide.style.display = 'block';
            // Force a reflow so the transition from opacity:0 → 1 actually animates
            slide.offsetHeight;
            slide.classList.add('slide-active');
        } else {
            slide.classList.remove('slide-active', 'slide-exit');
            slide.style.display = 'none';
        }
    }

    // 2. Dots — hide dots for skipped slides
    const skippedSlides = sessionStorage.getItem('fitgotchi_story_shown') ? [7, 8, 20] : [];
    const dots = document.querySelectorAll('.wizard-progress .dot');
    let dotIndex = 0;
    for (let i = 1; i <= totalWizardSteps; i++) {
        if (dotIndex >= dots.length) break;
        if (skippedSlides.includes(i)) {
            dots[i - 1].style.display = 'none';
            continue;
        }
        dots[i - 1].style.display = '';
        if (i <= currentWizardStep) dots[i - 1].classList.add('active');
        else dots[i - 1].classList.remove('active');
    }

    // 2c. Lazy-load 3D models one slide before they appear (preload while user reads current slide)
    if (currentWizardStep >= 6) {
        const mv = document.getElementById('wizard-fitgotchi-preview');
        if (mv && !mv.getAttribute('src') && mv.dataset.lazySrc) mv.setAttribute('src', mv.dataset.lazySrc);
    }
    if (currentWizardStep >= 13) {
        const mv = document.getElementById('wizard-arny-preview');
        if (mv && !mv.getAttribute('src') && mv.dataset.lazySrc) mv.setAttribute('src', mv.dataset.lazySrc);
    }
    if (currentWizardStep >= 16) {
        const mv = document.getElementById('wizard-preview-model');
        if (mv && !mv.getAttribute('src') && mv.dataset.lazySrc) mv.setAttribute('src', mv.dataset.lazySrc);
    }

    // 3. Initialize character customization on slide 17
    if(currentWizardStep === 17) {
        initializeCharacterCustomization();
    }

    // 3b. Load referral code on slide 19
    if(currentWizardStep === 19) {
        loadWizardReferralCode();
    }

    // 3c. Calculate and display water goal on slide 9
    if(currentWizardStep === 9) {
        calculateAndDisplayWaterGoal();
    }

    // 4. Update final slide goal text
    if(currentWizardStep === 21) {
        const goalDiv = document.getElementById('wizard-hormone-goal');
        if(goalDiv) {
            goalDiv.innerHTML = "You're all set! 🚀";
        }
    }

    // 4. Buttons
    const prevBtn = document.getElementById('wizard-back');
    const nextBtn = document.getElementById('wizard-next');

    if(prevBtn) prevBtn.style.visibility = (currentWizardStep > 1) ? 'visible' : 'hidden';

    if(nextBtn) {
        if(currentWizardStep === totalWizardSteps) {
            nextBtn.innerHTML = "Let's Go! 🚀";
            nextBtn.onclick = finishOnboarding;
        } else {
            nextBtn.innerHTML = "Next &rarr;";
            nextBtn.onclick = wizardNext;
        }
    }
}

function calculateNutritionGoals(data) {
    // Calculate BMR using Mifflin-St Jeor Equation
    // BMR (kcal/day) = 10 × weight (kg) + 6.25 × height (cm) − 5 × age (y) + s
    // where s = +5 for males and −161 for females

    const weight = data.weight;
    const height = data.height;
    const age = data.age;
    const sex = data.sex;
    const goalBodyType = data.goalBodyType || 'Athletic'; // Default to Athletic if not specified

    let bmr;
    if (sex === 'male') {
        bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
    } else { // female
        bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
    }

    // Calculate TDEE (Total Daily Energy Expenditure) based on activity level
    let activityMultiplier;
    switch(data.activity_level) {
        case 'sedentary':
            activityMultiplier = 1.2;
            break;
        case 'light':
            activityMultiplier = 1.375;
            break;
        case 'moderate':
            activityMultiplier = 1.55;
            break;
        case 'very':
            activityMultiplier = 1.725;
            break;
        default:
            activityMultiplier = 1.375;
    }

    const tdee = bmr * activityMultiplier;

    // Calculate calorie goal based on weight goals
    let calorieGoal = tdee;
    if (data.goal_weight < data.weight) {
        // Weight loss: 250-500 cal deficit based on how much to lose
        const deficit = Math.min(500, Math.max(250, (data.weight - data.goal_weight) * 50));
        calorieGoal = tdee - deficit;
    } else if (data.goal_weight > data.weight) {
        // Weight gain: 300 cal surplus
        calorieGoal = tdee + 300;
    }

    // Adjust for body type goals
    if (goalBodyType === 'Body Builder') {
        // Higher calories for muscle building
        calorieGoal += 200;
    } else if (goalBodyType === 'Flat') {
        // Slight additional deficit for lean body
        calorieGoal -= 100;
    }

    // Ensure minimum safe calorie intake
    calorieGoal = Math.max(1200, calorieGoal);

    // Calculate Macronutrient Goals based on goal body type
    let proteinPercentage, carbPercentage, fatPercentage;

    if (goalBodyType === 'Body Builder') {
        // High protein for muscle building: 30% protein, 40% carbs, 30% fat
        proteinPercentage = 0.30;
        carbPercentage = 0.40;
        fatPercentage = 0.30;
    } else if (goalBodyType === 'Athletic') {
        // Balanced for athletic performance: 25% protein, 45% carbs, 30% fat
        proteinPercentage = 0.25;
        carbPercentage = 0.45;
        fatPercentage = 0.30;
    } else {
        // Flat & Toned (weight loss): 20% protein, 45% carbs, 35% fat
        proteinPercentage = 0.20;
        carbPercentage = 0.45;
        fatPercentage = 0.35;
    }

    // Calculate grams from calories (Protein: 4 cal/g, Carbs: 4 cal/g, Fat: 9 cal/g)
    const proteinCalories = calorieGoal * proteinPercentage;
    const carbCalories = calorieGoal * carbPercentage;
    const fatCalories = calorieGoal * fatPercentage;

    let proteinGrams = proteinCalories / 4;
    const carbGrams = carbCalories / 4;
    const fatGrams = fatCalories / 9;

    // Ensure minimum protein for plant-based diet (at least 1g per kg body weight)
    const minProtein = weight * 1.0;
    proteinGrams = Math.max(proteinGrams, minProtein);

    return {
        bmr: Math.round(bmr),
        tdee: Math.round(tdee),
        calorie_goal: Math.round(calorieGoal),
        protein_goal_g: Math.round(proteinGrams),
        carbs_goal_g: Math.round(carbGrams),
        fat_goal_g: Math.round(fatGrams)
    };
}

// Gender selection function
function selectGender(gender) {
    selectedGender = gender;
    document.getElementById('wizard-gender').value = gender;
    localStorage.setItem('userGender', gender);

    // Apply theme based on gender
    if (gender === 'male') {
        document.body.classList.add('male-theme');
        document.body.classList.remove('female-theme');
    } else {
        document.body.classList.add('female-theme');
        document.body.classList.remove('male-theme');
    }

    // Update button styles
    const femaleBtn = document.getElementById('gender-btn-female');
    const maleBtn = document.getElementById('gender-btn-male');

    if (gender === 'female') {
        femaleBtn.style.border = '2px solid var(--primary)';
        femaleBtn.style.background = '#f0fdf4';
        maleBtn.style.border = '2px solid #e2e8f0';
        maleBtn.style.background = 'white';
    } else {
        maleBtn.style.border = '2px solid #3b82f6';
        maleBtn.style.background = '#eff6ff';
        femaleBtn.style.border = '2px solid #e2e8f0';
        femaleBtn.style.background = 'white';
    }

    // Auto-advance to next slide after selection
    setTimeout(() => {
        currentWizardStep++;
        updateWizardUI();
    }, 300);
}

// Helper function to check if user is male
function isMaleUser() {
    return localStorage.getItem('userGender') === 'male';
}

// Apply gender theme on page load if already set
function applyGenderTheme() {
    const savedGender = localStorage.getItem('userGender');
    if (savedGender === 'male') {
        document.body.classList.add('male-theme');
        document.body.classList.remove('female-theme');
        selectedGender = 'male';
    } else if (savedGender === 'female') {
        document.body.classList.add('female-theme');
        document.body.classList.remove('male-theme');
        selectedGender = 'female';

        // Reset DBZ theme if female user has it selected (male-only themes)
        const currentTheme = localStorage.getItem('userThemePreference');
        if (currentTheme && currentTheme.startsWith('dbz-')) {
            localStorage.setItem('userThemePreference', 'default');
            if (typeof applyAppTheme === 'function') {
                applyAppTheme('default');
            }
        }
    }

    // Apply gender-specific UI changes
    applyGenderSpecificUI();
}

// Hide/show UI elements based on gender
function applyGenderSpecificUI() {
    const isMale = isMaleUser();

    // Elements to hide for males (by ID)
    const femaleOnlyElements = [
        'check-in-period-section',     // Period flow check-in
        'check-in-cervical-section',   // Cervical fluid check-in
        'cycle-hero-card',             // Performance Mode hero card (hidden for males)
        'check-in-prompt-card',        // Daily Check-in prompt card (hidden for males)
        'check-in-completed-card',     // Check-in completed card (hidden for males)
    ];

    // Elements to show only for males (by ID)
    const maleOnlyElements = [
        'check-in-recovery-section',   // Recovery status check-in
    ];

    femaleOnlyElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = isMale ? 'none' : '';
    });

    maleOnlyElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = isMale ? '' : 'none';
    });

    // Handle female-only and male-only chips (by class)
    document.querySelectorAll('.female-only-chip').forEach(el => {
        el.style.display = isMale ? 'none' : '';
    });

    document.querySelectorAll('.male-only-chip').forEach(el => {
        el.style.display = isMale ? '' : 'none';
    });

    // Handle gender-specific theme options
    // Use disabled attribute instead of display:none for <option> elements (browser compatibility)
    document.querySelectorAll('.female-only-theme').forEach(el => {
        if (isMale) {
            el.disabled = true;
            el.style.display = 'none'; // Hide in browsers that support it
        } else {
            el.disabled = false;
            el.style.display = '';
        }
    });

    document.querySelectorAll('.male-only-theme').forEach(el => {
        if (!isMale) {
            el.disabled = true;
            el.style.display = 'none'; // Hide in browsers that support it
        } else {
            el.disabled = false;
            el.style.display = '';
        }
    });

    // Show/hide DBZ character decorations based on theme and gender
    const dbzDecorations = document.getElementById('dbz-decorations');
    if (dbzDecorations) {
        const currentTheme = localStorage.getItem('userThemePreference') || 'default';
        const isDbzTheme = currentTheme.startsWith('dbz-');
        dbzDecorations.style.display = (isMale && isDbzTheme) ? 'block' : 'none';
    }

    // Show/hide Sailor Moon character decorations based on theme and gender
    const sailorDecorations = document.getElementById('sailor-decorations');
    if (sailorDecorations) {
        const currentTheme = localStorage.getItem('userThemePreference') || 'default';
        const isSailorMoonTheme = currentTheme.startsWith('sailor-');
        sailorDecorations.style.display = (!isMale && isSailorMoonTheme) ? 'block' : 'none';
    }

    // Update Hormone Hub for males
    if (isMale) {
        // Update cycle phase display for males
        const phaseName = document.getElementById('cycle-phase-name');
        const phaseDesc = document.getElementById('cycle-phase-desc');
        const phaseIcon = document.querySelector('#view-cycle .card-body div[style*="font-size: 2.5rem"]');

        if (phaseName) phaseName.textContent = 'Performance Mode';
        if (phaseDesc) phaseDesc.textContent = 'Optimized training based on your recovery and energy levels.';
        if (phaseIcon) phaseIcon.textContent = '💪';
        
        // Fix dashboard quick-action card for males
        const dashboardPhaseTitle = document.getElementById('dashboard-current-phase-title');
        const dashboardPhaseName = document.getElementById('dashboard-current-phase-name');
        if (dashboardPhaseTitle) dashboardPhaseTitle.textContent = 'Current Phase';
        if (dashboardPhaseName) dashboardPhaseName.textContent = 'Performance Mode';

        // Hide cycle day badge parent
        const cycleDayBadge = document.getElementById('cycle-day-display');
        if (cycleDayBadge && cycleDayBadge.parentElement) {
            cycleDayBadge.parentElement.style.display = 'none';
        }

        // Hide cycle phase tags
        const phaseTags = document.getElementById('cycle-phase-tags');
        if (phaseTags) phaseTags.style.display = 'none';

        // Update Hormone Hub title and subtitle
        const hormoneHubHeader = document.querySelector('#view-cycle div[style*="sticky"]');
        if (hormoneHubHeader) {
            const title = hormoneHubHeader.querySelector('h2');
            const subtitle = hormoneHubHeader.querySelector('div[style*="0.8rem"]');
            if (title) title.textContent = 'Performance Hub';
            if (subtitle) subtitle.remove();
        }

        // Hide Daily Sync feature for male users
        const checkInPrompt = document.getElementById('check-in-prompt-card');
        if (checkInPrompt) {
            checkInPrompt.style.display = 'none';
        }

        const completedCard = document.getElementById('check-in-completed-card');
        if (completedCard) {
            completedCard.style.display = 'none';
        }

        // Update bottom navigation "Cycle" tab to "Calendar"
        const navCycleLabel = document.getElementById('nav-cycle-label');
        if (navCycleLabel) navCycleLabel.textContent = 'Calendar';

        // Swap Progress and Calendar tab positions for males
        const bottomNav = document.querySelector('.bottom-nav');
        const progressBtn = bottomNav.querySelector('button[onclick*="progress"]');
        const cycleBtn = document.getElementById('nav-cycle-btn');
        if (bottomNav && progressBtn && cycleBtn) {
            // Insert cycle/calendar button before progress button
            bottomNav.insertBefore(cycleBtn, progressBtn);
        }

        // Update nav icon to calendar for males
        const navCycleIcon = document.getElementById('nav-cycle-icon');
        if (navCycleIcon) {
            navCycleIcon.innerHTML = '<path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/>';
        }

        // Hide Cycle Tracking button for male users (not applicable)
        const cycleTrackingBtn = document.querySelector('button[onclick="openCycleTrackingModal()"]');
        if (cycleTrackingBtn) {
            cycleTrackingBtn.style.display = 'none';
        }

        // Update meal card descriptions for males
        const flaxDesc = document.getElementById('flax-description');
        if (flaxDesc) {
            flaxDesc.textContent = '1-2 tbsp daily. Rich in omega-3s and fiber for recovery and gut health.';
        }

        // Update any estrogen-related text visible to users
        document.querySelectorAll('p, span, div').forEach(el => {
            if (el.id) return; // Skip elements we handle specifically
            if (el.textContent.includes('balance estrogen') && !el.textContent.includes('Rich in omega-3s')) {
                el.textContent = el.textContent.replace('balance estrogen', 'support recovery');
            }
            if (el.textContent.includes('estrogen detox')) {
                el.textContent = el.textContent.replace('estrogen detox', 'metabolic optimization');
            }
        });
    }

    // Update Metabolic Protocol section based on gender
    const typeLabel = document.getElementById('profile-type-label');
    const typeDesc = document.getElementById('profile-type-desc');
    const typeDisplay = document.getElementById('profile-type-display');

    if (isMale) {
        // Males: Show Energy Level instead of Hormone Type
        if (typeLabel) typeLabel.textContent = 'Energy Level';
        if (typeDesc) typeDesc.textContent = 'Affects workout intensity';
        if (typeDisplay) {
            const energyLevel = window.userEnergyLevel || 'normal';
            const energyMap = {
                'low': 'Low Energy',
                'normal': 'Normal',
                'high': 'High Energy'
            };
            typeDisplay.textContent = energyMap[energyLevel] || 'Normal';
        }
    } else {
        // Females: Show Hormone Type (default)
        if (typeLabel) typeLabel.textContent = 'Hormone Type';
        if (typeDesc) typeDesc.textContent = 'Determines your nutrition plan';
        // typeDisplay keeps its hormone profile value (set in loadProfileData)
    }
}

async function wizardNext() {
    // Validation for Step 1: Gender Selection
    if(currentWizardStep === 1) {
        if (!selectedGender) {
            wizardAlert("Please select your program (For Her or For Him).");
            return;
        }
        // Gender already saved in selectGender function
        console.log("Step 1 gender selected:", selectedGender);
    }

    // Validation for Step 2: Essential Data Collection
    if(currentWizardStep === 2) {
        const name = document.getElementById('wizard-name').value.trim();
        const age = document.getElementById('wizard-age').value;
        const height = document.getElementById('wizard-height').value;
        const weight = document.getElementById('wizard-weight').value;
        const goalWeight = document.getElementById('wizard-goal-weight').value;
        const goalType = document.getElementById('wizard-goal-type').value;
        const equipment = document.getElementById('wizard-equipment').value;
        const activityLevel = document.getElementById('wizard-activity-level').value;
        const energyLevel = document.getElementById('wizard-energy-level').value;

        // Validate all required fields
        if (!name) {
            wizardAlert("Please enter your name.");
            return;
        }
        if (!age || age < 18 || age > 100) {
            wizardAlert("Please enter a valid age (18-100).");
            return;
        }
        if (!height || height < 100 || height > 250) {
            wizardAlert("Please enter a valid height in cm (100-250).");
            return;
        }
        if (!weight || weight < 30 || weight > 300) {
            wizardAlert("Please enter a valid weight in kg (30-300).");
            return;
        }
        if (!goalWeight || goalWeight < 30 || goalWeight > 300) {
            wizardAlert("Please enter a valid goal weight in kg (30-300).");
            return;
        }
        if (!goalType) {
            wizardAlert("Please select your primary goal.");
            return;
        }
        if (!equipment) {
            wizardAlert("Please select your equipment access.");
            return;
        }
        if (!activityLevel) {
            wizardAlert("Please select your activity level.");
            return;
        }
        if (!energyLevel) {
            wizardAlert("Please select your energy status.");
            return;
        }

        const dietaryPreference = document.getElementById('wizard-dietary-preference').value;
        if (!dietaryPreference) {
            wizardAlert("Please select your dietary preference.");
            return;
        }

        // Save dietary preference to localStorage for quick access
        localStorage.setItem('dietaryPreference', dietaryPreference);

        // Save to sessionStorage for later processing
        const quizData = {
            name: name,
            age: parseInt(age),
            dietary_preference: dietaryPreference,
            sex: selectedGender, // Use gender from "For Her/For Him" selection
            height: parseFloat(height),
            weight: parseFloat(weight),
            goal_weight: parseFloat(goalWeight),
            goalBodyType: goalType, // Maps to: 'Flat' (weight loss), 'Athletic' (toned), 'Body Builder' (muscle gain)
            equipment_access: equipment,
            activity_level: activityLevel,
            energy_level: energyLevel,
            user_gender: selectedGender // Also store gender preference
        };

        // Calculate BMR, TDEE, and Macros
        const calculatedData = calculateNutritionGoals(quizData);
        Object.assign(quizData, calculatedData);

        // Store in sessionStorage
        sessionStorage.setItem('userProfile', JSON.stringify(quizData));

        console.log("Step 2 data collected:", quizData);

        // If male, skip cycle tracking (step 3) and go directly to step 4
        if (selectedGender === 'male') {
            // Set default values for males (no cycle tracking, no hormone profile)
            let existingData = {};
            try { existingData = JSON.parse(sessionStorage.getItem('userProfile') || '{}'); } catch(e) {}
            existingData.menopause_status = 'not_applicable';
            existingData.last_period = null;
            existingData.profile = null; // Males don't have hormone profiles
            sessionStorage.setItem('userProfile', JSON.stringify(existingData));
            sessionStorage.removeItem('userResult'); // Remove any existing hormone profile

            // Skip to step 4 (nutrition logic)
            currentWizardStep = 4;
            updateWizardUI();
            return;
        }
    }

    // Validation for Step 3: Cycle Setup (females only)
    if(currentWizardStep === 3) {
        const dateInput = document.getElementById('wizard-period-date');
        const wellnessToggle = document.getElementById('wizard-wellness-toggle');

        if (!wellnessToggle.checked && !dateInput.value) {
            wizardAlert("Please enter your last period date so we can sync your plan.");
            return;
        }

        // NEW: Validate cycle sync questions
        const cycleSyncPref = document.querySelector('input[name="wizard-cycle-sync"]:checked')?.value;
        if (!cycleSyncPref) {
            wizardAlert("Please select whether you want to sync your workouts with your cycle.");
            return;
        }

        // If cycle sync is enabled, validate period energy question
        if (cycleSyncPref === 'yes') {
            const periodEnergy = document.querySelector('input[name="wizard-period-energy"]:checked')?.value;
            if (!periodEnergy) {
                wizardAlert("Please select how your body responds during your period.");
                return;
            }
        }

        // Save Data
        if (wellnessToggle.checked) {
            userCycleData.noPeriodMode = true;
            toggleNoPeriodMode(); // Apply logic
        } else {
            userCycleData.noPeriodMode = false;
            userCycleData.lastPeriod = dateInput.value;
            // Also update the Settings input in profile
            const settingsInput = document.getElementById('last-period-input-profile');
            if(settingsInput) settingsInput.value = dateInput.value;

            updateCycleData(); // Trigger calculations
        }

        // CRITICAL: Save userCycleData to localStorage AND database
        localStorage.setItem('userCycleData', JSON.stringify(userCycleData));

        // Save to database for cross-device persistence (non-blocking — localStorage is already saved above)
        if (window.currentUser) {
            (async () => {
                try {
                    const userId = window.currentUser.id || window.currentUser.user_id;
                    let existingFacts = {};
                    try {
                        existingFacts = await dbHelpers.userFacts.get(userId);
                    } catch(err) { /* ignore not found */ }

                    const currentAdditional = existingFacts?.additional_data || {};
                    const userProfile = JSON.parse(sessionStorage.getItem('userProfile') || localStorage.getItem('userProfile') || '{}');

                    const dataToSave = {
                        additional_data: {
                            ...currentAdditional,
                            last_period_start: userCycleData.lastPeriod,
                            cycle_length: userCycleData.cycleLength,
                            no_period_mode: userCycleData.noPeriodMode,
                            cycle_sync_preference: userProfile.cycle_sync_preference,
                            period_energy_response: userProfile.period_energy_response
                        }
                    };

                    console.log('💾 Saving cycle data to database:', dataToSave);
                    await dbHelpers.userFacts.upsert(userId, dataToSave);
                    console.log('✅ Cycle data saved to database successfully');
                } catch (e) {
                    console.error('❌ Failed to save cycle data to database:', e);
                }
            })();
        }

        // Add menopause status to quizData
        let existingData = {};
        try { existingData = JSON.parse(sessionStorage.getItem('userProfile') || '{}'); } catch(e) {}
        const age = existingData.age || 0;

        // Determine menopause status based on wellness toggle and age
        let menopause_status = 'cycling';
        if (wellnessToggle.checked || age > 45) {
            menopause_status = 'menopause';
        }

        existingData.menopause_status = menopause_status;
        existingData.last_period = wellnessToggle.checked ? null : dateInput.value;

        // NEW: Save cycle sync preferences
        existingData.cycle_sync_preference = cycleSyncPref;
        existingData.period_energy_response = document.querySelector('input[name="wizard-period-energy"]:checked')?.value || 'high';

        // Calculate hormone profile (CORTISOL vs ESTROGEN)
        if (menopause_status === 'menopause' || age > 45) {
            existingData.profile = 'ESTROGEN';
        } else {
            existingData.profile = 'CORTISOL';
        }

        sessionStorage.setItem('userProfile', JSON.stringify(existingData));
        sessionStorage.setItem('userResult', existingData.profile);

        // NEW: Also save to localStorage for immediate use
        localStorage.setItem('userProfile', JSON.stringify(existingData));

        // NEW: Add timestamp for when onboarding was completed (for equipment override priority)
        existingData.onboarding_completed_at = new Date().toISOString();
        localStorage.setItem('onboardingCompletedAt', existingData.onboarding_completed_at);

        // NOTE: Cycle sync preferences are now saved to user_facts.additional_data (via the cycle data save above)
        // This is more reliable as user_facts uses upsert and doesn't require an existing quiz_results row
        console.log('✅ Cycle sync preferences included in cycle data save');

        console.log("Step 3 data collected, hormone profile:", existingData.profile, "cycle sync:", existingData.cycle_sync_preference, "period energy:", existingData.period_energy_response);
    }

    // Validation for Step 4: Training Frequency & Days
    if(currentWizardStep === 4) {
        if (!wizardTrainingFrequency || wizardTrainingFrequency < 2) {
            wizardAlert("Please select how many days you want to train.");
            return;
        }
        if (wizardSelectedDays.size !== wizardTrainingFrequency) {
            wizardAlert(`Please select exactly ${wizardTrainingFrequency} training days.`);
            return;
        }

        // Save to sessionStorage
        let existingData = {};
        try { existingData = JSON.parse(sessionStorage.getItem('userProfile') || '{}'); } catch(e) {}
        existingData.training_frequency = wizardTrainingFrequency;
        existingData.training_days = Array.from(wizardSelectedDays).join(',');
        existingData.recovery_on_rest_days = document.getElementById('wizard-recovery-days')?.checked;
        sessionStorage.setItem('userProfile', JSON.stringify(existingData));

        // Check if user has gym equipment - if not, skip split preference (step 5)
        const equipment = existingData.equipment_access;
        if (equipment !== 'gym') {
            // Generate calendar and skip to preview (step 6)
            generateWizardCalendar();
            currentWizardStep = 6;
            updateWizardUI();
            return;
        }
    }

    // Validation for Step 5: Split Preference
    if(currentWizardStep === 5) {
        if (!wizardSplitPreference) {
            wizardAlert("Please select your training split preference.");
            return;
        }

        // Save to sessionStorage
        let existingData = {};
        try { existingData = JSON.parse(sessionStorage.getItem('userProfile') || '{}'); } catch(e) {}
        existingData.split_preference = wizardSplitPreference;
        sessionStorage.setItem('userProfile', JSON.stringify(existingData));

        // Generate the calendar preview
        generateWizardCalendar();
    }

    // Step 6: Calendar Preview - render the preview
    if(currentWizardStep === 6) {
        // Save workout calendar to sessionStorage
        let existingData = {};
        try { existingData = JSON.parse(sessionStorage.getItem('userProfile') || '{}'); } catch(e) {}
        existingData.workout_calendar = JSON.stringify(wizardWorkoutCalendar);
        sessionStorage.setItem('userProfile', JSON.stringify(existingData));
        localStorage.setItem('workoutCalendar', JSON.stringify(wizardWorkoutCalendar));
    }

    // Step 9: Water Goal - save hydration settings
    if(currentWizardStep === 9) {
        const waterGoal = parseInt(document.getElementById('wizard-water-goal-ml')?.value) || wizardWaterGoalMl;
        const glassSize = parseInt(document.getElementById('wizard-glass-size')?.value) || wizardGlassSize;
        const totalGlasses = Math.ceil(waterGoal / glassSize);

        // Save to localStorage for the hydration tracker
        localStorage.setItem('pbb_water_goal_ml', waterGoal.toString());
        localStorage.setItem('pbb_water_glass_size', glassSize.toString());
        localStorage.setItem('pbb_water_total_glasses', totalGlasses.toString());

        // Also save to sessionStorage userProfile for DB sync
        let existingData = {};
        try { existingData = JSON.parse(sessionStorage.getItem('userProfile') || '{}'); } catch(e) {}
        existingData.water_goal_ml = waterGoal;
        existingData.water_glass_size = glassSize;
        existingData.water_total_glasses = totalGlasses;
        sessionStorage.setItem('userProfile', JSON.stringify(existingData));

        console.log("Step 9 water goal saved:", waterGoal, "ml, glass size:", glassSize, "ml, total glasses:", totalGlasses);
    }

    if(currentWizardStep < totalWizardSteps) {
        currentWizardStep++;

        // Skip slides covered by Fitgotchi story: 7 (Meet FitGotchi), 8 (Calorie Tracking), 20 (Built by Shannon)
        const storyShown = sessionStorage.getItem('fitgotchi_story_shown');
        if (storyShown) {
            while ([7, 8, 20].includes(currentWizardStep) && currentWizardStep < totalWizardSteps) {
                currentWizardStep++;
            }
        }

        updateWizardUI();

        // Render calendar preview when entering step 6
        if(currentWizardStep === 6) {
            renderWizardCalendarPreview();
        }
    }
}

function wizardPrev() {
    if(currentWizardStep > 1) {
        // Handle skip logic for backward navigation
        if (selectedGender === 'male' && currentWizardStep === 4) {
            // Males skip cycle tracking (step 3)
            currentWizardStep = 2;
        } else if (currentWizardStep === 6) {
            // Check if we should skip split preference (non-gym users)
            let userData = {};
            try { userData = JSON.parse(sessionStorage.getItem('userProfile') || '{}'); } catch(e) {}
            if (userData.equipment_access !== 'gym') {
                currentWizardStep = 4; // Skip back to frequency/days
            } else {
                currentWizardStep--;
            }
        } else {
            currentWizardStep--;
        }

        // Skip slides covered by Fitgotchi story (backwards)
        const storyShown = sessionStorage.getItem('fitgotchi_story_shown');
        if (storyShown) {
            while ([7, 8, 20].includes(currentWizardStep) && currentWizardStep > 1) {
                currentWizardStep--;
            }
        }

        updateWizardUI();
    }
}

// ========== CHARACTER CUSTOMIZATION FUNCTIONS ==========

// Temporary storage for wizard character colors
let wizardCharacterColors = null;
let wizardCharacterInitialized = false;

let _charCustomRetries = 0;
function initializeCharacterCustomization() {
    // Only initialize once
    if (wizardCharacterInitialized) {
        return;
    }

    // Wait for CHARACTER_COLOR_OPTIONS to be available (max 2 seconds / 10 retries)
    if (!window.CHARACTER_COLOR_OPTIONS) {
        if (_charCustomRetries < 10) {
            _charCustomRetries++;
            setTimeout(initializeCharacterCustomization, 200);
        } else {
            console.warn('CHARACTER_COLOR_OPTIONS not available after 2s, using defaults');
        }
        return;
    }

    wizardCharacterInitialized = true;

    // Get saved colors or defaults
    wizardCharacterColors = window.getCharacterColors ? window.getCharacterColors() : {
        hair: '#4a3728',
        shirt: '#7BA883',
        pants: '#2C3E50',
        shoes: '#1a202c',
        skin: '#DEB887'
    };

    const colorOptions = window.CHARACTER_COLOR_OPTIONS;

    // Render color buttons for each category (hair, pants, skin only - shirt/shoes use defaults)
    renderColorButtons('hair', colorOptions.hair, 'wizard-hair-colors');
    renderColorButtons('pants', colorOptions.pants, 'wizard-pants-colors');
    renderColorButtons('skin', colorOptions.skin, 'wizard-skin-colors');

    // Initialize the preview model with current colors and correct gender model
    const previewModel = document.getElementById('wizard-preview-model');
    if (previewModel) {
        // Baby model is unisex - same for all genders in onboarding
        const babySrc = 'https://f005.backblazeb2.com/file/shannonsvideos/baby_full_animations.glb';
        if (previewModel.getAttribute('src') !== babySrc) {
            previewModel.setAttribute('src', babySrc);
        }
        previewModel.addEventListener('load', function onLoad() {
            applyWizardCharacterColors();
            previewModel.removeEventListener('load', onLoad);
        }, { once: true });

        // If model is already loaded, apply colors immediately
        if (previewModel.model) {
            applyWizardCharacterColors();
        }
    }
}

function renderColorButtons(category, colors, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    colors.forEach(color => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'color-btn';
        btn.dataset.category = category;
        btn.dataset.color = color.hex;
        btn.title = color.name;
        btn.style.cssText = `
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border: 3px solid ${wizardCharacterColors[category] === color.hex ? 'var(--primary)' : '#e2e8f0'};
            background: ${color.hex};
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: ${wizardCharacterColors[category] === color.hex ? '0 0 0 2px var(--primary)' : 'none'};
        `;

        btn.addEventListener('click', () => selectWizardColor(category, color.hex));
        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'scale(1.1)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'scale(1)';
        });

        container.appendChild(btn);
    });
}

function selectWizardColor(category, hex) {
    wizardCharacterColors[category] = hex;

    // Update button styles
    const container = document.getElementById(`wizard-${category}-colors`);
    if (container) {
        container.querySelectorAll('.color-btn').forEach(btn => {
            const isSelected = btn.dataset.color === hex;
            btn.style.border = `3px solid ${isSelected ? 'var(--primary)' : '#e2e8f0'}`;
            btn.style.boxShadow = isSelected ? '0 0 0 2px var(--primary)' : 'none';
        });
    }

    // Apply colors to preview model
    applyWizardCharacterColors();
}

async function applyWizardCharacterColors() {
    const previewModel = document.getElementById('wizard-preview-model');
    if (!previewModel || !previewModel.model) return;

    const model = previewModel.model;
    if (!model.materials) return;

    const colors = wizardCharacterColors;
    const src = (previewModel.getAttribute('src') || '').toLowerCase();

    const hexToRgb01 = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? { r: parseInt(result[1], 16)/255, g: parseInt(result[2], 16)/255, b: parseInt(result[3], 16)/255 } : null;
    };

    Object.keys(colors).forEach(cat => {
        const hex = colors[cat];
        if (!hex) return;
        const rgb = hexToRgb01(hex);
        if (!rgb) return;

        let targets = [];

        // Use same per-model material mappings as the main applyCharacterColors override
        if (src.includes('baby')) {
            if(cat==='skin') targets=['tripo_part_new_0.001']; if(cat==='hair') targets=['tripo_part_0.001']; if(cat==='pants') targets=['tripo_part_8.001']; if(cat==='shoes') targets=['tripo_part_3.001'];
        }
        else if (src.includes('level_1_female')) {
            if(cat==='skin') targets=['part_new']; if(cat==='hair') targets=['part_2']; if(cat==='shirt') targets=['part_8']; if(cat==='pants') targets=['part_4']; if(cat==='shoes') targets=['part_11'];
        }
        else if (src.includes('level_1_good') || src.includes('shazylvl1')) {
            if(cat==='skin') targets=['part_10_material']; if(cat==='hair') targets=['part_7_material']; if(cat==='shirt') targets=['part_5_material']; if(cat==='pants') targets=['part_6_material']; if(cat==='shoes') targets=['part_9_material'];
        }

        // Fallback to keyword matching
        if (targets.length === 0) {
            if(cat==='skin') targets=['skin', 'body', 'face', 'arm', 'hand'];
            if(cat==='hair') targets=['hair', 'head'];
            if(cat==='shirt') targets=['shirt', 'top', 'vest'];
            if(cat==='pants') targets=['pants', 'shorts', 'leg'];
            if(cat==='shoes') targets=['shoes', 'boot', 'feet'];
        }

        model.materials.forEach(mat => {
            const matName = (mat.name || '').toLowerCase();
            const matched = targets.some(t => matName.includes(t));
            if (matched) {
                const pbr = mat.pbrMetallicRoughness;
                if (pbr) {
                    pbr.baseColorTexture = null;
                    pbr.setBaseColorFactor([rgb.r, rgb.g, rgb.b, 1]);
                    if (cat === 'skin' || cat === 'hair') {
                        pbr.setRoughnessFactor(0.9);
                        pbr.setMetallicFactor(0.0);
                    }
                }
            }
        });
    });
}

function hexToRgbWizard(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function saveWizardCharacterColors() {
    if (wizardCharacterColors && window.saveCharacterColors) {
        window.saveCharacterColors(wizardCharacterColors);
        console.log('Character colors saved from wizard:', wizardCharacterColors);
    }
}

// ========== WIZARD REFERRAL FUNCTIONS ==========

async function loadWizardReferralCode() {
    const codeDisplay = document.getElementById('wizard-referral-code');
    if (!codeDisplay) return;

    if (currentReferralCode) {
        codeDisplay.textContent = currentReferralCode;
        return;
    }

    if (window.currentUser) {
        try {
            const stats = await window.dbHelpers.referrals.getStats(window.currentUser.id);
            if (stats.referralCode) {
                currentReferralCode = stats.referralCode;
                codeDisplay.textContent = stats.referralCode;
            } else {
                codeDisplay.textContent = 'Sign up to get your code!';
                codeDisplay.style.fontSize = '1rem';
            }
        } catch (e) {
            codeDisplay.textContent = 'Available after setup!';
            codeDisplay.style.fontSize = '1rem';
        }
    } else {
        codeDisplay.textContent = 'Available after setup!';
        codeDisplay.style.fontSize = '1rem';
    }
}

function wizardShareWhatsApp() {
    const code = currentReferralCode;
    if (!code) {
        wizardAlert('Your referral code will be available after you finish setup!', 'info');
        return;
    }
    const link = `${window.location.origin}/login.html?ref=${code}`;
    const message = `Hey! Join me on FITGotchi. Gamify your fitness - I'm really loving it! We BOTH get 1 week double XP! Use my code ${code} or click here: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
}

function wizardShareSMS() {
    const code = currentReferralCode;
    if (!code) {
        wizardAlert('Your referral code will be available after you finish setup!', 'info');
        return;
    }
    const link = `${window.location.origin}/login.html?ref=${code}`;
    const message = `Hey! Join me on FITGotchi. Gamify your fitness - I'm really loving it! We BOTH get 1 week double XP! Use code ${code} or click: ${link}`;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
        window.location.href = `sms:?&body=${encodeURIComponent(message)}`;
    } else {
        navigator.clipboard.writeText(message).then(() => {
            wizardAlert('Message copied! Paste it into your SMS app.', 'success');
        });
    }
}

function wizardCopyLink() {
    const code = currentReferralCode;
    if (!code) {
        wizardAlert('Your referral code will be available after you finish setup!', 'info');
        return;
    }
    const link = `${window.location.origin}/login.html?ref=${code}`;
    navigator.clipboard.writeText(link).then(() => {
        wizardAlert('Referral link copied!', 'success');
        const btn = event.target.closest('button');
        if (btn) {
            const originalText = btn.innerHTML;
            btn.innerHTML = '<span>Copied!</span>';
            setTimeout(() => { btn.innerHTML = originalText; }, 2000);
        }
    });
}

// ========== WORKOUT CALENDAR FUNCTIONS ==========

function selectTrainingFrequency(num) {
    wizardTrainingFrequency = num;
    document.getElementById('wizard-training-frequency').value = num;

    // Update button styles
    document.querySelectorAll('.freq-btn').forEach(btn => {
        if (parseInt(btn.dataset.freq) === num) {
            btn.style.background = '#48864B';
            btn.style.color = '#fff';
            btn.style.transform = 'scale(1.1)';
        } else {
            btn.style.background = '#fff';
            btn.style.color = '#1a4d2e';
            btn.style.transform = 'scale(1)';
        }
    });

    // Update tip text
    const tips = {
        2: 'Perfect for beginners or busy schedules',
        3: 'Great balance of training and recovery',
        4: 'Ideal for building strength with good recovery',
        5: 'Dedicated training with rest built in',
        6: 'Serious training - we\'ll ensure proper recovery',
        7: 'Every day! We\'ll include active recovery days'
    };
    document.getElementById('freq-tip').textContent = tips[num] || '';

    // Reset day selection if frequency changed
    if (wizardSelectedDays.size > num) {
        wizardSelectedDays.clear();
        document.querySelectorAll('.day-btn').forEach(btn => {
            btn.style.background = '#fff';
            btn.style.color = '#1a4d2e';
        });
    }
    updateDaysCounter();
}

function toggleTrainingDay(day) {
    if (!wizardTrainingFrequency) {
        wizardAlert('Please select how many days you want to train first.');
        return;
    }

    const btn = document.querySelector(`.day-btn[data-day="${day}"]`);

    if (wizardSelectedDays.has(day)) {
        wizardSelectedDays.delete(day);
        btn.style.background = '#fff';
        btn.style.color = '#1a4d2e';
    } else {
        if (wizardSelectedDays.size >= wizardTrainingFrequency) {
            wizardAlert(`You can only select ${wizardTrainingFrequency} days. Deselect one first.`);
            return;
        }
        wizardSelectedDays.add(day);
        btn.style.background = '#48864B';
        btn.style.color = '#fff';
    }

    document.getElementById('wizard-training-days').value = Array.from(wizardSelectedDays).join(',');
    updateDaysCounter();
}

function updateDaysCounter() {
    const counter = document.getElementById('days-counter');
    if (counter) {
        if (wizardTrainingFrequency) {
            counter.textContent = `${wizardSelectedDays.size} of ${wizardTrainingFrequency} days selected`;
        } else {
            counter.textContent = 'Select your training days';
        }
    }
}

function selectSplitPreference(split) {
    wizardSplitPreference = split;
    document.getElementById('wizard-split-preference').value = split;

    // Check for mismatch warnings
    const freq = wizardTrainingFrequency;
    let warning = null;

    if (split === 'bro_split' && freq < 5) {
        warning = `Bro Split works best with 5-6 days. You selected ${freq} days. Continue anyway?`;
    } else if (split === 'full_body' && freq > 4) {
        warning = `Full Body is typically done 2-3 days/week for recovery. You selected ${freq} days. Continue anyway?`;
    }

    if (warning && !confirm(warning)) {
        return;
    }

    // Update button styles
    document.querySelectorAll('.split-btn').forEach(btn => {
        if (btn.dataset.split === split) {
            btn.style.borderColor = '#48864B';
            btn.style.background = 'rgba(72, 134, 75, 0.05)';
        } else {
            btn.style.borderColor = '#e2e8f0';
            btn.style.background = '#fff';
        }
    });

    // Auto-advance after selection
    setTimeout(() => {
        generateWizardCalendar();
        currentWizardStep++;
        updateWizardUI();
        renderWizardCalendarPreview();
    }, 300);
}

function generateWizardCalendar() {
    let userData = {};
    try { userData = JSON.parse(sessionStorage.getItem('userProfile') || '{}'); } catch(e) {}
    const trainingDays = Array.from(wizardSelectedDays);
    const equipment = userData.equipment_access || 'none';
    const split = wizardSplitPreference || 'full_body';
    const recoveryOnRestDays = document.getElementById('wizard-recovery-days')?.checked;
    const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    // Reset calendar
    wizardWorkoutCalendar = {};

    // Determine workout sequence based on split and equipment
    let workoutSequence = [];

    if (equipment === 'gym') {
        if (split === 'ppl') {
            workoutSequence = ['gym-push', 'gym-pull', 'gym-legs'];
        } else if (split === 'upper_lower') {
            workoutSequence = ['gym-upper', 'gym-lower'];
        } else if (split === 'bro_split') {
            workoutSequence = ['gym-chest', 'gym-back', 'gym-shoulders', 'gym-legs', 'gym-arms'];
        } else {
            workoutSequence = ['gym-fullbody'];
        }
    } else if (equipment === 'dumbbells') {
        workoutSequence = ['home-upper', 'home-lower', 'home-fullbody'];
    } else if (equipment === 'bands') {
        workoutSequence = ['bands-upper', 'bands-lower', 'bands-fullbody'];
    } else if (equipment === 'none' || equipment === 'bodyweight') {
        workoutSequence = ['bw-upper', 'bw-lower', 'bw-core', 'bw-fullbody'];
    } else if (equipment === 'yoga_only') {
        workoutSequence = ['yoga-flow', 'yoga-restorative', 'yoga-mobility'];
    }

    // Assign workouts to training days
    let workoutIndex = 0;
    allDays.forEach(day => {
        if (trainingDays.includes(day)) {
            wizardWorkoutCalendar[day] = workoutSequence[workoutIndex % workoutSequence.length];
            workoutIndex++;
        } else {
            wizardWorkoutCalendar[day] = recoveryOnRestDays ? 'yoga-restorative' : 'rest';
        }
    });
}

function renderWizardCalendarPreview() {
    const container = document.getElementById('wizard-calendar-preview');
    if (!container) return;

    const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    // IDs match workout_library.js
    const workoutInfo = {
        // GYM workouts
        'gym-push': { icon: '🏋️', name: 'Push', desc: 'Chest, Shoulders, Triceps' },
        'gym-pull': { icon: '🏋️', name: 'Pull', desc: 'Back, Biceps' },
        'gym-legs': { icon: '🏋️', name: 'Legs', desc: 'Quads, Hamstrings, Glutes' },
        'gym-chest': { icon: '🏋️', name: 'Chest', desc: '' },
        'gym-back': { icon: '🏋️', name: 'Back', desc: '' },
        'gym-shoulders': { icon: '🏋️', name: 'Shoulders', desc: '' },
        'gym-arms': { icon: '🏋️', name: 'Arms', desc: '' },
        'gym-core': { icon: '🏋️', name: 'Core', desc: '' },
        'gym-upper': { icon: '🏋️', name: 'Upper Body', desc: '' },
        'gym-lower': { icon: '🏋️', name: 'Lower Body', desc: '' },
        'gym-fullbody': { icon: '🏋️', name: 'Full Body', desc: '' },
        // HOME WEIGHTS workouts
        'home-upper': { icon: '🏠', name: 'Upper Body', desc: '' },
        'home-lower': { icon: '🏠', name: 'Lower Body', desc: '' },
        'home-fullbody': { icon: '🏠', name: 'Full Body', desc: '' },
        'home-arms': { icon: '🏠', name: 'Arms', desc: '' },
        'home-shoulders': { icon: '🏠', name: 'Shoulders', desc: '' },
        // BANDS workouts
        'bands-upper': { icon: '🔗', name: 'Upper Body', desc: '' },
        'bands-lower': { icon: '🔗', name: 'Lower Body', desc: '' },
        'bands-fullbody': { icon: '🔗', name: 'Full Body', desc: '' },
        // BODYWEIGHT workouts
        'bw-upper': { icon: '🤸', name: 'Upper Body', desc: '' },
        'bw-lower': { icon: '🤸', name: 'Lower Body', desc: '' },
        'bw-core': { icon: '🤸', name: 'Core', desc: '' },
        'bw-fullbody': { icon: '🤸', name: 'Full Body', desc: '' },
        // YOGA workouts
        'yoga-flow': { icon: '🧘', name: 'Power Yoga', desc: 'Active Recovery' },
        'yoga-restorative': { icon: '🧘', name: 'Restorative Yoga', desc: 'Recovery' },
        'yoga-mobility': { icon: '🧘', name: 'Mobility Yoga', desc: '' },
        // RECOVERY workouts
        'recovery-stretch': { icon: '🔄', name: 'Stretching', desc: '' },
        'recovery-foam': { icon: '🔄', name: 'Foam Rolling', desc: '' },
        'rest': { icon: '⏸️', name: 'Rest Day', desc: '' }
    };

    // Build all DOM in a DocumentFragment (single reflow instead of 35+ individual insertions)
    const frag = document.createDocumentFragment();

    // Add instruction text
    const instruction = document.createElement('p');
    instruction.style.cssText = 'text-align:center; font-size:13px; color:#666; margin-bottom:12px;';
    instruction.textContent = 'Tap any day to change the workout';
    frag.appendChild(instruction);

    // Create day rows
    allDays.forEach((day, idx) => {
        const workout = wizardWorkoutCalendar[day] || 'rest';
        const info = workoutInfo[workout] || { icon: '?', name: 'Unknown', desc: '' };

        const row = document.createElement('div');
        row.style.cssText = `display:flex; align-items:center; padding:12px 0; cursor:pointer; transition:background 0.2s;${idx < 6 ? ' border-bottom:1px solid #f0f0f0;' : ''}`;
        row.onmouseenter = () => { row.style.background = 'rgba(72, 134, 75, 0.05)'; };
        row.onmouseleave = () => { row.style.background = 'transparent'; };

        const dayCol = document.createElement('div');
        dayCol.style.cssText = 'width:90px; font-weight:600; color:#1a4d2e; font-size:13px;';
        dayCol.textContent = dayLabels[idx];

        const workoutCol = document.createElement('div');
        workoutCol.style.cssText = 'flex:1; display:flex; align-items:center; gap:10px;';

        const icon = document.createElement('span');
        icon.style.fontSize = '18px';
        icon.textContent = info.icon;

        const workoutText = document.createElement('div');
        workoutText.innerHTML = `<div style="font-weight:500; color:#333; font-size:13px;">${info.name}</div>${info.desc ? `<div style="font-size:11px; color:#888;">${info.desc}</div>` : ''}`;

        const editIcon = document.createElement('span');
        editIcon.style.cssText = 'margin-left:auto; color:#48864B; font-size:14px;';
        editIcon.innerHTML = '&#9662;';

        workoutCol.append(icon, workoutText, editIcon);
        row.append(dayCol, workoutCol);
        row.onclick = () => { showWizardWorkoutDropdown(day, dayLabels[idx], renderWizardCalendarPreview); };
        frag.appendChild(row);
    });

    // Add summary
    const trainingCount = Object.values(wizardWorkoutCalendar).filter(w =>
        w && !['rest', 'yoga-restorative', 'yoga-flow', 'yoga-mobility', 'recovery-stretch', 'recovery-foam'].includes(w)
    ).length;
    const yogaCount = Object.values(wizardWorkoutCalendar).filter(w =>
        ['yoga-restorative', 'yoga-flow', 'yoga-mobility'].includes(w)
    ).length;
    const restCount = Object.values(wizardWorkoutCalendar).filter(w =>
        w === 'rest' || ['recovery-stretch', 'recovery-foam'].includes(w)
    ).length;

    const summary = document.createElement('div');
    summary.style.cssText = 'text-align:center; margin-top:12px; padding:10px; background:rgba(72,134,75,0.1); border-radius:8px; font-size:13px; color:#1a4d2e;';
    summary.innerHTML = `<strong>${trainingCount} training</strong> · <strong>${yogaCount} yoga</strong> · <strong>${restCount} rest</strong>`;
    frag.appendChild(summary);

    // Single DOM write — replaces all previous content
    container.innerHTML = '';
    container.appendChild(frag);
}

function openCalendarEditor() {
    // For now, just go back to step 4 to re-select days
    currentWizardStep = 4;
    updateWizardUI();
}

// Get workout options based on wizard equipment selection
function getWizardWorkoutOptions() {
    const equipment = document.getElementById('wizard-equipment')?.value || 'none';
    const options = [];

    // Base options available to everyone
    options.push({ category: 'YOGA', items: [
        { id: 'yoga-flow', name: 'Power Yoga', icon: '🧘' },
        { id: 'yoga-restorative', name: 'Restorative Yoga', icon: '🧘' },
        { id: 'yoga-mobility', name: 'Mobility Yoga', icon: '🧘' }
    ]});

    options.push({ category: 'RECOVERY', items: [
        { id: 'recovery-stretch', name: 'Stretching', icon: '🔄' },
        { id: 'recovery-foam', name: 'Foam Rolling', icon: '🔄' }
    ]});

    options.push({ category: 'REST', items: [
        { id: 'rest', name: 'Rest Day', icon: '⏸️' }
    ]});

    // Equipment-specific options
    if (equipment === 'gym') {
        options.unshift({ category: 'GYM', items: [
            { id: 'gym-push', name: 'Push (Chest, Shoulders, Triceps)', icon: '🏋️' },
            { id: 'gym-pull', name: 'Pull (Back, Biceps)', icon: '🏋️' },
            { id: 'gym-legs', name: 'Legs', icon: '🏋️' },
            { id: 'gym-chest', name: 'Chest', icon: '🏋️' },
            { id: 'gym-back', name: 'Back', icon: '🏋️' },
            { id: 'gym-shoulders', name: 'Shoulders', icon: '🏋️' },
            { id: 'gym-arms', name: 'Arms', icon: '🏋️' },
            { id: 'gym-core', name: 'Core', icon: '🏋️' },
            { id: 'gym-upper', name: 'Upper Body', icon: '🏋️' },
            { id: 'gym-lower', name: 'Lower Body', icon: '🏋️' },
            { id: 'gym-fullbody', name: 'Full Body', icon: '🏋️' }
        ]});
    } else if (equipment === 'dumbbells') {
        options.unshift({ category: 'HOME WEIGHTS', items: [
            { id: 'home-upper', name: 'Upper Body', icon: '🏠' },
            { id: 'home-lower', name: 'Lower Body', icon: '🏠' },
            { id: 'home-fullbody', name: 'Full Body', icon: '🏠' },
            { id: 'home-arms', name: 'Arms', icon: '🏠' },
            { id: 'home-shoulders', name: 'Shoulders', icon: '🏠' }
        ]});
    } else if (equipment === 'bands') {
        options.unshift({ category: 'BANDS', items: [
            { id: 'bands-upper', name: 'Upper Body', icon: '🔗' },
            { id: 'bands-lower', name: 'Lower Body', icon: '🔗' },
            { id: 'bands-fullbody', name: 'Full Body', icon: '🔗' }
        ]});
    } else if (equipment === 'none' || equipment === 'bodyweight') {
        options.unshift({ category: 'BODYWEIGHT', items: [
            { id: 'bw-upper', name: 'Upper Body', icon: '🤸' },
            { id: 'bw-lower', name: 'Lower Body', icon: '🤸' },
            { id: 'bw-core', name: 'Core', icon: '🤸' },
            { id: 'bw-fullbody', name: 'Full Body', icon: '🤸' }
        ]});
    }

    return options;
}

// Show workout dropdown for selecting a workout for a specific day
function showWizardWorkoutDropdown(day, dayLabel, updateCallback) {
    // Remove any existing dropdown
    const existingDropdown = document.getElementById('wizard-workout-dropdown-overlay');
    if (existingDropdown) existingDropdown.remove();

    const workoutOptions = getWizardWorkoutOptions();

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'wizard-workout-dropdown-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.background = 'rgba(0,0,0,0.3)';
    overlay.style.zIndex = '13000';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    // Create dropdown container
    const dropdown = document.createElement('div');
    dropdown.style.background = '#fff';
    dropdown.style.borderRadius = '16px';
    dropdown.style.padding = '20px';
    dropdown.style.width = '90%';
    dropdown.style.maxWidth = '350px';
    dropdown.style.maxHeight = '70vh';
    dropdown.style.overflowY = 'auto';
    dropdown.style.boxShadow = '0 10px 40px rgba(0,0,0,0.2)';

    // Header
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '15px';
    header.style.paddingBottom = '10px';
    header.style.borderBottom = '1px solid #eee';

    const headerTitle = document.createElement('h3');
    headerTitle.style.margin = '0';
    headerTitle.style.color = '#1a4d2e';
    headerTitle.style.fontSize = '18px';
    headerTitle.textContent = dayLabel;

    const closeBtn = document.createElement('span');
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontSize = '24px';
    closeBtn.style.color = '#999';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => overlay.remove();

    header.appendChild(headerTitle);
    header.appendChild(closeBtn);
    dropdown.appendChild(header);

    // Workout options grouped by category
    workoutOptions.forEach(category => {
        const categoryDiv = document.createElement('div');
        categoryDiv.style.marginBottom = '15px';

        const categoryLabel = document.createElement('div');
        categoryLabel.style.fontSize = '11px';
        categoryLabel.style.fontWeight = '600';
        categoryLabel.style.color = '#999';
        categoryLabel.style.textTransform = 'uppercase';
        categoryLabel.style.marginBottom = '8px';
        categoryLabel.style.letterSpacing = '0.5px';
        categoryLabel.textContent = category.category;
        categoryDiv.appendChild(categoryLabel);

        category.items.forEach(item => {
            const option = document.createElement('div');
            option.style.display = 'flex';
            option.style.alignItems = 'center';
            option.style.padding = '10px 12px';
            option.style.marginBottom = '4px';
            option.style.borderRadius = '8px';
            option.style.cursor = 'pointer';
            option.style.transition = 'background 0.2s';

            // Highlight current selection
            if (wizardWorkoutCalendar[day] === item.id) {
                option.style.background = 'rgba(72, 134, 75, 0.15)';
                option.style.border = '2px solid #48864B';
            } else {
                option.style.background = '#f8f8f8';
                option.style.border = '2px solid transparent';
            }

            option.onmouseenter = () => {
                if (wizardWorkoutCalendar[day] !== item.id) {
                    option.style.background = 'rgba(72, 134, 75, 0.1)';
                }
            };
            option.onmouseleave = () => {
                if (wizardWorkoutCalendar[day] !== item.id) {
                    option.style.background = '#f8f8f8';
                }
            };

            const optIcon = document.createElement('span');
            optIcon.style.fontSize = '18px';
            optIcon.style.marginRight = '10px';
            optIcon.textContent = item.icon;

            const optName = document.createElement('span');
            optName.style.fontWeight = '500';
            optName.style.color = '#333';
            optName.textContent = item.name;

            option.appendChild(optIcon);
            option.appendChild(optName);

            // Checkmark for selected
            if (wizardWorkoutCalendar[day] === item.id) {
                const checkmark = document.createElement('span');
                checkmark.style.marginLeft = 'auto';
                checkmark.style.color = '#48864B';
                checkmark.style.fontWeight = 'bold';
                checkmark.innerHTML = '&#10003;';
                option.appendChild(checkmark);
            }

            option.onclick = () => {
                // Update calendar
                wizardWorkoutCalendar[day] = item.id;

                // Re-render the calendar preview
                if (updateCallback) updateCallback();

                // Close dropdown
                overlay.remove();
            };

            categoryDiv.appendChild(option);
        });

        dropdown.appendChild(categoryDiv);
    });

    overlay.appendChild(dropdown);

    // Close on overlay click
    overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
    };

    document.body.appendChild(overlay);
}

// ========== END WORKOUT CALENDAR FUNCTIONS ==========

async function finishOnboarding() {
    localStorage.setItem('onboardingComplete', 'true');
    localStorage.setItem('plantbased_onboarding_complete', 'true'); // Also set alternate key for consistency
    window._onboardingWizardPending = false;
    const wizardEl = document.getElementById('onboarding-wizard');
    if (wizardEl) {
        wizardEl.style.display = 'none';
        wizardEl.style.opacity = '';
        wizardEl.classList.remove('active');
    }

    // Skip weigh-in prompts on first day - user already entered weight in wizard step 2
    localStorage.setItem('lastWeighInPromptDate', new Date().toDateString());
    const weighInCard = document.getElementById('daily-weigh-in-card');
    if (weighInCard) weighInCard.style.display = 'none';

    // Grant 1200 starting coins to new accounts
    if (window.currentUser) {
        try {
            const userId = window.currentUser.id || window.currentUser.user_id;
            await supabaseClient.rpc('credit_coins', {
                p_user_id: userId,
                p_amount: 1200,
                p_reason: 'Welcome bonus - starting coins'
            });
            console.log('✅ Granted 1200 starting coins');
            if (typeof showToast === 'function') {
                showToast('Welcome! You received 1,200 coins! 🪙', 'success');
            }
        } catch (e) {
            console.error('Failed to grant starting coins:', e);
        }
    }

    // Save character customization colors
    if (typeof saveWizardCharacterColors === 'function') {
        saveWizardCharacterColors();
    }

    // Apply character colors to the main dashboard model
    const mainModel = document.getElementById('tamagotchi-model');
    if (mainModel && window.applyCharacterColors) {
        setTimeout(() => {
            window.applyCharacterColors(mainModel, mainModel.getAttribute('src'));
        }, 500);
    }

    // Apply gender-specific UI changes NOW that gender is selected
    if (typeof applyGenderSpecificUI === 'function') {
        applyGenderSpecificUI();
    }

    // Re-render cycle status with correct gender
    if (typeof renderCycleStatus === 'function') {
        renderCycleStatus();
    }

    // Update daily content with gender-appropriate tips
    if (typeof initProgramDate === 'function') {
        initProgramDate();
    }

    // CRITICAL: Ensure cycle data is saved to database before completing onboarding
    // This fixes the issue where cycle data disappears after page refresh
    if (window.currentUser && userCycleData) {
        try {
            const userId = window.currentUser.id || window.currentUser.user_id;
            let existingFacts = {};
            try {
                existingFacts = await dbHelpers.userFacts.get(userId);
            } catch(err) { /* ignore not found */ }

            const currentAdditional = existingFacts?.additional_data || {};

            // Only save cycle data if we have valid data (lastPeriod or noPeriodMode)
            if (userCycleData.lastPeriod || userCycleData.noPeriodMode) {
                // Get cycle sync preferences from sessionStorage/localStorage
                const userProfile = JSON.parse(sessionStorage.getItem('userProfile') || localStorage.getItem('userProfile') || '{}');

                const dataToSave = {
                    additional_data: {
                        ...currentAdditional,
                        last_period_start: userCycleData.lastPeriod,
                        cycle_length: userCycleData.cycleLength || 28,
                        no_period_mode: userCycleData.noPeriodMode || false,
                        // Also save cycle sync preferences here
                        cycle_sync_preference: userProfile.cycle_sync_preference,
                        period_energy_response: userProfile.period_energy_response
                    }
                };

                console.log('💾 finishOnboarding: Ensuring cycle data is saved to database:', dataToSave);
                await dbHelpers.userFacts.upsert(userId, dataToSave);
                console.log('✅ finishOnboarding: Cycle data saved to database successfully');

                // Also ensure localStorage is in sync
                localStorage.setItem('userCycleData', JSON.stringify(userCycleData));
            }
        } catch (e) {
            console.error('❌ finishOnboarding: Failed to save cycle data to database:', e);
        }
    }

    // Sync quiz data to database
    await syncQuizDataToDb();

    // Mark onboarding complete in the database so it persists across browsers/sessions
    if (window.currentUser) {
        try {
            await dbHelpers.users.update(window.currentUser.id, { onboarding_complete: true });
            console.log("Onboarding marked complete in database");
        } catch (e) {
            console.warn("Failed to mark onboarding complete in database:", e);
        }
    }

    // Auto-add Coach Shannon as a friend for all new users
    if (window.currentUser) {
        const coachEmails = ['shannon@plantbased-balance.org', 'shannonbirch@cocospersonaltraining.com'];
        const userId = window.currentUser.id || window.currentUser.user_id;

        for (const coachEmail of coachEmails) {
            try {
                // Look up coach user by email
                const { data: coachUser } = await supabase
                    .from('users')
                    .select('id')
                    .eq('email', coachEmail)
                    .maybeSingle();

                if (coachUser && coachUser.id !== userId) {
                    // Check if already friends (avoid duplicate insert)
                    const { data: existing } = await supabase
                        .from('friendships')
                        .select('id')
                        .or(`and(user_id.eq.${coachUser.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${coachUser.id})`)
                        .maybeSingle();

                    if (!existing) {
                        await supabase
                            .from('friendships')
                            .insert([{
                                user_id: coachUser.id,
                                friend_id: userId,
                                status: 'accepted'
                            }]);
                        console.log('Auto-added Coach Shannon (' + coachEmail + ') as friend!');
                    }
                }
            } catch (e) {
                console.warn('Could not auto-add coach (' + coachEmail + ') as friend:', e);
            }
        }

        // Send welcome message from coach to new user
        try {
            const profile = await window.getUserProfile();
            const userName = profile?.name || '';
            await fetch('/.netlify/functions/send-welcome-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    newUserId: userId,
                    userName: userName
                })
            });
            console.log('Welcome message sent to new user');
        } catch (e) {
            console.warn('Could not send welcome message:', e);
        }
    }

    // Show native permissions request modal after onboarding completes.
    // Delay long enough (4s) for the welcome coins toast to fully display and
    // auto-dismiss (toast lasts 3.3s) before the permissions overlay covers it.
    setTimeout(showNativePermissionsModal, 4000);

    // Web (non-native): request notification permission after onboarding finishes
    if (!(typeof isNativeApp === 'function' && isNativeApp())) {
        setTimeout(() => {
            if (typeof requestNotificationPermission === 'function') {
                requestNotificationPermission();
            }
        }, 4500);
    }
}

async function closeWizardManually() {
     window._onboardingWizardPending = false;
     const wizardEl = document.getElementById('onboarding-wizard');
     if (wizardEl) {
         wizardEl.style.display = 'none';
         wizardEl.style.opacity = '';
         wizardEl.classList.remove('active');
     }
     localStorage.setItem('onboardingComplete', 'true');
     localStorage.setItem('plantbased_onboarding_complete', 'true');

     // Skip weigh-in prompts on first day (same as finishOnboarding)
     localStorage.setItem('lastWeighInPromptDate', new Date().toDateString());
     const weighInCard = document.getElementById('daily-weigh-in-card');
     if (weighInCard) weighInCard.style.display = 'none';

     // Sync any collected data (including gender) to database before closing
     await syncQuizDataToDb();

     // Mark onboarding complete in the database so it persists across devices
     if (window.currentUser) {
         try {
             await dbHelpers.users.update(window.currentUser.id, { onboarding_complete: true });
         } catch (e) {
             console.warn('Failed to mark onboarding complete in database:', e);
         }
     }

     // Still apply gender-specific UI if they selected a gender
     if (typeof applyGenderSpecificUI === 'function') {
         applyGenderSpecificUI();
     }

     // Show native permissions after a delay (same as finishOnboarding)
     setTimeout(showNativePermissionsModal, 4000);

     // Web (non-native): request notification permission
     if (!(typeof isNativeApp === 'function' && isNativeApp())) {
         setTimeout(() => {
             if (typeof requestNotificationPermission === 'function') {
                 requestNotificationPermission();
             }
         }, 4500);
     }
}

function toggleWizardPeriodInput() {
    const toggle = document.getElementById('wizard-wellness-toggle');
    const input = document.getElementById('wizard-period-date');
    if(toggle.checked) {
        input.disabled = true;
        input.style.opacity = '0.5';
        input.value = '';
    } else {
        input.disabled = false;
        input.style.opacity = '1';
    }
}

function togglePeriodEnergyQuestion() {
    const cycleSyncValue = document.querySelector('input[name="wizard-cycle-sync"]:checked')?.value;
    const periodEnergySection = document.getElementById('period-energy-section');

    if (cycleSyncValue === 'yes') {
        periodEnergySection.style.display = 'block';
    } else {
        periodEnergySection.style.display = 'none';
        // Clear selection if hiding
        document.querySelectorAll('input[name="wizard-period-energy"]').forEach(input => input.checked = false);
    }
}

function toggleCard(header) {
    // Toggle card expansion
    const card = header.parentElement;
    card.classList.toggle('open');
}

// --- TRAINERIZE WORKOUT LOGIC ---
// --- TRAINERIZE WORKOUT LOGIC ---
window.WORKOUT_DB = {
    'yoga': {
        name: 'Somatic Yoga',
        id: 'yoga',
        description: 'Release the Psoas (fight/flight muscle) and switch the nervous system from "Sympathetic" (Stress) to "Parasympathetic" (Rest).',
        estimatedTime: '25',
        equipment: ['Body Weight', 'Mat'],
        schedule: [
             // DAY 1: Cortisol & Psoas Release
             {
                title: 'Somatic Hormone Reset',
                exercises: [
                    { name: 'Adductor Stretch with Thoracic Twist', sets: 1, reps: '3 min', desc: 'Signals safety to the pelvic floor' },
                    { name: 'Cat to Cow', sets: 1, reps: '1 min', desc: 'Regulates the nervous system' },
                    { name: 'Yoga - Lizard Pose (Utthan Pristhasana)', sets: 2, reps: '90 sec/side', desc: 'Releases the Psoas (fight/flight muscle)' },
                    { name: 'Yoga - Happy Baby Pose (Ananda Balasana)', sets: 1, reps: '2 min', desc: 'True somatic reset' },
                    { name: 'Yoga - Supine Twist (Jathara Parivartanasana)', sets: 2, reps: '1 min/side', desc: 'Wrings tension from adrenals' },
                    { name: 'Corpse Pose', sets: 1, reps: '5 min', desc: 'Lowers cortisol' }
                ]
            },
            // DAY 2: Hip Opening & Grounding
            {
                title: 'Deep Hip Opening Flow',
                exercises: [
                    { name: "Child's Pose", sets: 1, reps: '2 min', desc: 'Grounding and centering' },
                    { name: 'Cat to Cow', sets: 1, reps: '1 min', desc: 'Spinal warm-up' },
                    { name: 'Yoga - Pigeon Pose (Eka Pada Rajakapotasana)', sets: 2, reps: '2 min/side', desc: 'Deep hip flexor release' },
                    { name: 'Yoga - Fire Log Pose (Agnistambhasana)', sets: 2, reps: '90 sec/side', desc: 'Hip opener' },
                    { name: 'Yoga - Reclined Bound Angle (Supta Baddha Konasana)', sets: 1, reps: '3 min', desc: 'Pelvic floor relaxation' },
                    { name: 'Yoga - Legs Up the Wall (Viparita Karani)', sets: 1, reps: '5 min', desc: 'Calms nervous system' }
                ]
            },
            // DAY 3: Spinal Flow & Twists
            {
                title: 'Spinal Mobility & Detox',
                exercises: [
                    { name: 'Cat to Cow', sets: 1, reps: '2 min', desc: 'Spinal lubrication' },
                    { name: 'Yoga - Thread the Needle', sets: 2, reps: '90 sec/side', desc: 'Shoulder and upper back release' },
                    { name: 'Yoga - Seated Spinal Twist (Ardha Matsyendrasana)', sets: 2, reps: '1 min/side', desc: 'Digestive massage' },
                    { name: 'Yoga - Supine Twist (Jathara Parivartanasana)', sets: 2, reps: '2 min/side', desc: 'Spinal detox' },
                    { name: 'Yoga - Child Pose with Side Stretch', sets: 2, reps: '1 min/side', desc: 'Lateral body opening' },
                    { name: 'Corpse Pose', sets: 1, reps: '5 min', desc: 'Integration' }
                ]
            },
            // DAY 4: Restorative & Gentle
            {
                title: 'Restorative Recovery',
                exercises: [
                    { name: 'Yoga - Supported Fish Pose (Matsyasana)', sets: 1, reps: '3 min', desc: 'Heart opener' },
                    { name: 'Yoga - Puppy Pose (Anahatasana)', sets: 1, reps: '2 min', desc: 'Calms heart rate' },
                    { name: "Child's Pose", sets: 1, reps: '3 min', desc: 'Deep rest' },
                    { name: 'Yoga - Reclined Bound Angle (Supta Baddha Konasana)', sets: 1, reps: '4 min', desc: 'Pelvic relaxation' },
                    { name: 'Yoga - Legs Up the Wall (Viparita Karani)', sets: 1, reps: '5 min', desc: 'Lymphatic drainage' },
                    { name: 'Corpse Pose', sets: 1, reps: '8 min', desc: 'Deep relaxation' }
                ]
            },
            // DAY 5: Gentle Strength & Balance
            {
                title: 'Balance & Core Flow',
                exercises: [
                    { name: 'Yoga - Sun Salutation A (Surya Namaskar A)', sets: 3, reps: '1 round', desc: 'Full body warm-up' },
                    { name: 'Yoga - Warrior II (Virabhadrasana II)', sets: 2, reps: '1 min/side', desc: 'Leg strength' },
                    { name: 'Yoga - Triangle Pose (Trikonasana)', sets: 2, reps: '1 min/side', desc: 'Stability' },
                    { name: 'Yoga - Tree Pose (Vrksasana)', sets: 2, reps: '1 min/side', desc: 'Balance practice' },
                    { name: 'Yoga - Boat Pose (Navasana)', sets: 3, reps: '30 sec', desc: 'Core activation' },
                    { name: 'Yoga - Seated Forward Fold (Paschimottanasana)', sets: 1, reps: '3 min', desc: 'Hamstring stretch' },
                    { name: 'Corpse Pose', sets: 1, reps: '5 min', desc: 'Rest' }
                ]
            },
            // DAY 6: Full Vinyasa Flow
            {
                title: 'Dynamic Flow Integration',
                exercises: [
                    { name: 'Cat to Cow', sets: 1, reps: '2 min', desc: 'Warm-up' },
                    { name: 'Yoga - Sun Salutation A (Surya Namaskar A)', sets: 3, reps: '1 round', desc: 'Energy building' },
                    { name: 'Yoga - Sun Salutation B (Surya Namaskar B)', sets: 3, reps: '1 round', desc: 'Full body activation' },
                    { name: 'Yoga - Warrior I (Virabhadrasana I)', sets: 2, reps: '1 min/side', desc: 'Power pose' },
                    { name: 'Yoga - Extended Side Angle Pose (Utthita Parsvakonasana)', sets: 2, reps: '1 min/side', desc: 'Side body strength' },
                    { name: 'Yoga - Downward Dog', sets: 1, reps: '2 min', desc: 'Full body stretch' },
                    { name: 'Yoga - Pigeon Pose (Eka Pada Rajakapotasana)', sets: 2, reps: '2 min/side', desc: 'Hip release' },
                    { name: 'Corpse Pose', sets: 1, reps: '7 min', desc: 'Deep rest' }
                ]
            },
            // DAY 7: Deep Rest & Meditation
            {
                title: 'Yin & Meditation',
                exercises: [
                    { name: "Child's Pose", sets: 1, reps: '5 min', desc: 'Surrender and release' },
                    { name: 'Yoga - Reclined Bound Angle (Supta Baddha Konasana)', sets: 1, reps: '5 min', desc: 'Hip opening' },
                    { name: 'Yoga - Supine Twist (Jathara Parivartanasana)', sets: 2, reps: '3 min/side', desc: 'Spinal release' },
                    { name: 'Yoga - Legs Up the Wall (Viparita Karani)', sets: 1, reps: '7 min', desc: 'Restorative inversion' },
                    { name: 'Corpse Pose', sets: 1, reps: '10 min', desc: 'Complete relaxation and meditation' }
                ]
            }
        ]
    },
    'bodyweight': {
        name: 'Bodyweight Sculpt',
        id: 'bodyweight',
        description: 'Build strength and tone without any equipment. Perfect for home workouts.',
        estimatedTime: '35',
        equipment: ['None'],
        schedule: [
            // DAY 1: Lower Body Push & Squat Patterns
            {
                title: 'Lower Body Power',
                exercises: [
                    { name: 'Body Weight Squat', sets: 4, reps: '15-20', desc: 'Quad and glute activation' },
                    { name: 'Body Weight Reverse Lunge', sets: 3, reps: '12/leg', desc: 'Single leg strength' },
                    { name: 'Glute Bridge', sets: 4, reps: '20', desc: 'Glute isolation' },
                    { name: 'Body Weight Single Leg Deadlift', sets: 3, reps: '10/leg', desc: 'Hamstring and balance' },
                    { name: 'Body Weight Sumo Squat', sets: 3, reps: '15', desc: 'Inner thigh and glutes' },
                    { name: 'Wall Sit', sets: 3, reps: '45 sec', desc: 'Quad endurance' }
                ]
            },
            // DAY 2: Upper Body Push
            {
                title: 'Upper Body Strength',
                exercises: [
                    { name: 'Push Up', sets: 4, reps: '10-15', desc: 'Chest, shoulders, triceps' },
                    { name: 'Pike Push Up', sets: 3, reps: '8-12', desc: 'Shoulder focus' },
                    { name: 'Tricep Dip', sets: 3, reps: '12-15', desc: 'Tricep isolation' },
                    { name: 'Plank to Down Dog', sets: 3, reps: '10', desc: 'Dynamic upper body' },
                    { name: 'Diamond Push Up', sets: 3, reps: '8-10', desc: 'Tricep emphasis' },
                    { name: 'Plank Hold', sets: 3, reps: '45 sec', desc: 'Core stability' }
                ]
            },
            // DAY 3: Core & Conditioning
            {
                title: 'Core & Cardio Blast',
                exercises: [
                    { name: 'Mountain Climber', sets: 4, reps: '30 sec', desc: 'Cardio and core' },
                    { name: 'Bicycle Crunch', sets: 3, reps: '20', desc: 'Obliques' },
                    { name: 'Burpee', sets: 3, reps: '10-15', desc: 'Full body conditioning' },
                    { name: 'Plank Hip Twist', sets: 3, reps: '15/side', desc: 'Rotational core' },
                    { name: 'High Knees', sets: 4, reps: '30 sec', desc: 'Cardio burst' },
                    { name: 'Dead Bug', sets: 3, reps: '12/side', desc: 'Core control' }
                ]
            },
            // DAY 4: Full Body Power
            {
                title: 'Total Body Strength',
                exercises: [
                    { name: 'Body Weight Squat Jump', sets: 3, reps: '12', desc: 'Explosive lower body' },
                    { name: 'Push Up', sets: 3, reps: '12-15', desc: 'Upper body push' },
                    { name: 'Body Weight Reverse Lunge', sets: 3, reps: '12/leg', desc: 'Lower body unilateral' },
                    { name: 'Superman', sets: 3, reps: '15', desc: 'Posterior chain' },
                    { name: 'Plank Alternating Arm & Leg Lift', sets: 3, reps: '10/side', desc: 'Anti-rotation' },
                    { name: 'Glute Bridge', sets: 3, reps: '20', desc: 'Glute activation' }
                ]
            },
            // DAY 5: Glutes & Legs Focus
            {
                title: 'Glute Sculpt',
                exercises: [
                    { name: 'Single Leg Glute Bridge', sets: 3, reps: '15/leg', desc: 'Glute isolation' },
                    { name: 'Body Weight Side Lunge', sets: 3, reps: '12/side', desc: 'Lateral movement' },
                    { name: 'Fire Hydrant', sets: 3, reps: '15/side', desc: 'Glute medius' },
                    { name: 'Donkey Kick', sets: 3, reps: '15/leg', desc: 'Glute max activation' },
                    { name: 'Body Weight Sumo Squat', sets: 4, reps: '20', desc: 'Inner thigh and glutes' },
                    { name: 'Calf Raise', sets: 3, reps: '20', desc: 'Calf definition' }
                ]
            },
            // DAY 6: Active Recovery & Mobility
            {
                title: 'Mobility & Flow',
                exercises: [
                    { name: 'Downward Dog', sets: 1, reps: '2 min', desc: 'Full body stretch' },
                    { name: 'Cat to Cow', sets: 1, reps: '2 min', desc: 'Spinal mobility' },
                    { name: 'World Greatest Stretch', sets: 2, reps: '5/side', desc: 'Full body mobility' },
                    { name: 'Bird Dog', sets: 3, reps: '12/side', desc: 'Core stability' },
                    { name: "Child's Pose", sets: 1, reps: '3 min', desc: 'Recovery' },
                    { name: 'Body Weight Squat', sets: 2, reps: '15', desc: 'Active recovery' }
                ]
            },
            // DAY 7: Rest or Gentle Movement
            {
                title: 'Rest Day',
                exercises: [
                    { name: 'Downward Dog', sets: 1, reps: '3 min', desc: 'Gentle stretch' },
                    { name: "Child's Pose", sets: 1, reps: '5 min', desc: 'Rest and restore' },
                    { name: 'Corpse Pose', sets: 1, reps: '10 min', desc: 'Complete relaxation' }
                ]
            }
        ]
    },
    'home': {
        name: 'Dumbbell Strength',
        id: 'home',
        description: 'Build lean muscle mass at home with dumbbells. Progressive strength training.',
        estimatedTime: '45',
        equipment: ['Dumbbells', 'Mat'],
        schedule: [
            // DAY 1: Lower Body (Quads & Hamstrings)
            {
                title: 'Lower Body Strength',
                exercises: [
                    { name: 'Dumbbell Goblet Squat', sets: 4, reps: '12-15', desc: 'Quad dominant compound' },
                    { name: 'Dumbbell Romanian Deadlift', sets: 4, reps: '12', desc: 'Hamstring and glutes' },
                    { name: 'Dumbbell Stationary Lunge', sets: 3, reps: '12/leg', desc: 'Unilateral strength' },
                    { name: 'Dumbbell Single Leg Deadlift', sets: 3, reps: '10/leg', desc: 'Hamstring and balance' },
                    { name: 'Dumbbell Goblet Lateral Lunge', sets: 3, reps: '10/side', desc: 'Adductors and glutes' },
                    { name: 'Dumbbell Calf Raise', sets: 3, reps: '15-20', desc: 'Calf development' }
                ]
            },
            // DAY 2: Upper Body Push (Chest, Shoulders, Triceps)
            {
                title: 'Push Day',
                exercises: [
                    { name: 'Dumbbell Bench Press', sets: 4, reps: '10-12', desc: 'Chest compound' },
                    { name: 'Dumbbell Standing Shoulder Press', sets: 4, reps: '10-12', desc: 'Shoulder strength' },
                    { name: 'Dumbbell Incline Chest Press', sets: 3, reps: '12', desc: 'Upper chest' },
                    { name: 'Dumbbell Lateral Raise', sets: 3, reps: '12-15', desc: 'Shoulder width' },
                    { name: 'Dumbbell Overhead Tricep Extension', sets: 3, reps: '12-15', desc: 'Tricep mass' },
                    { name: 'Dumbbell Front Raise', sets: 3, reps: '12', desc: 'Anterior deltoid' }
                ]
            },
            // DAY 3: Core & Conditioning
            {
                title: 'Core Power',
                exercises: [
                    { name: 'Dumbbell Russian Twist', sets: 3, reps: '20 total', desc: 'Obliques' },
                    { name: 'Dumbbell Woodchop', sets: 3, reps: '12/side', desc: 'Rotational power' },
                    { name: 'Plank Hold', sets: 3, reps: '60 sec', desc: 'Core stability' },
                    { name: 'Dumbbell Side Bend', sets: 3, reps: '15/side', desc: 'Oblique strength' },
                    { name: 'Mountain Climber', sets: 3, reps: '30 sec', desc: 'Conditioning' },
                    { name: 'Dead Bug', sets: 3, reps: '12/side', desc: 'Anti-extension core' }
                ]
            },
            // DAY 4: Full Body Compound
            {
                title: 'Total Body Power',
                exercises: [
                    { name: 'Dumbbell Squat to Press', sets: 4, reps: '12', desc: 'Full body compound' },
                    { name: 'Dumbbell Deadlift', sets: 4, reps: '12', desc: 'Posterior chain' },
                    { name: 'Dumbbell Bent Over Row', sets: 3, reps: '12', desc: 'Back thickness' },
                    { name: 'Dumbbell Walking Lunge', sets: 3, reps: '10/leg', desc: 'Dynamic lower body' },
                    { name: 'Dumbbell Push Press', sets: 3, reps: '10-12', desc: 'Explosive shoulder' },
                    { name: 'Dumbbell Renegade Row', sets: 3, reps: '10/side', desc: 'Core and back' }
                ]
            },
            // DAY 5: Lower Body (Glutes & Hamstrings)
            {
                title: 'Glute & Hamstring Focus',
                exercises: [
                    { name: 'Dumbbell Sumo Deadlift', sets: 4, reps: '12', desc: 'Glute and inner thigh' },
                    { name: 'Dumbbell Bulgarian Split Squat', sets: 3, reps: '12/leg', desc: 'Glute dominant lunge' },
                    { name: 'Dumbbell Single Leg Deadlift', sets: 3, reps: '12/leg', desc: 'Hamstring and glutes' },
                    { name: 'Dumbbell Hip Thrust', sets: 4, reps: '15', desc: 'Glute isolation' },
                    { name: 'Dumbbell Goblet Sumo Squat', sets: 3, reps: '15', desc: 'Wide stance glutes' },
                    { name: 'Dumbbell Stiff Leg Deadlift', sets: 3, reps: '12', desc: 'Hamstring stretch-load' }
                ]
            },
            // DAY 6: Upper Body Pull (Back, Biceps, Rear Delts)
            {
                title: 'Pull Day',
                exercises: [
                    { name: 'Dumbbell Bent Over Row', sets: 4, reps: '12', desc: 'Back width and thickness' },
                    { name: 'Dumbbell Single Arm Bent Over Row', sets: 3, reps: '12/side', desc: 'Unilateral back' },
                    { name: 'Dumbbell Reverse Fly', sets: 3, reps: '12-15', desc: 'Rear deltoid' },
                    { name: 'Dumbbell Bicep Curl', sets: 3, reps: '12-15', desc: 'Bicep mass' },
                    { name: 'Dumbbell Hammer Curl', sets: 3, reps: '12-15', desc: 'Brachialis and forearms' },
                    { name: 'Dumbbell Shrug', sets: 3, reps: '15-20', desc: 'Trap development' }
                ]
            },
            // DAY 7: Active Recovery or Rest
            {
                title: 'Active Recovery',
                exercises: [
                    { name: 'Dumbbell Goblet Squat', sets: 2, reps: '15', desc: 'Light movement' },
                    { name: 'Dumbbell Romanian Deadlift', sets: 2, reps: '12', desc: 'Hamstring stretch' },
                    { name: 'Downward Dog', sets: 1, reps: '3 min', desc: 'Full body stretch' },
                    { name: "Child's Pose", sets: 1, reps: '5 min', desc: 'Rest' },
                    { name: 'Corpse Pose', sets: 1, reps: '10 min', desc: 'Recovery' }
                ]
            }
        ]
    },
    'gym': {
        name: 'Full Gym Protocol',
        id: 'gym',
        description: 'Maximize strength and hormonal balance with full gym access. Traditional bodybuilding split.',
        estimatedTime: '60',
        equipment: ['Full Gym'],
        schedule: [
            // DAY 1: Legs (Quads Focus)
            {
                title: 'Leg Day - Quads',
                exercises: [
                    { name: 'Barbell Back Squat', sets: 4, reps: '8-10', desc: 'King of lower body' },
                    { name: 'Angled Machine Leg Press', sets: 4, reps: '12-15', desc: 'Quad mass' },
                    { name: 'Machine Seated Leg Extension', sets: 3, reps: '15', desc: 'Quad isolation' },
                    { name: 'Walking Barbell Lunge', sets: 3, reps: '12/leg', desc: 'Functional strength' },
                    { name: 'Machine Hack Squat', sets: 3, reps: '12', desc: 'Quad emphasis' },
                    { name: 'Seated Calf Raise Machine', sets: 4, reps: '15-20', desc: 'Calf development' }
                ]
            },
            // DAY 2: Chest & Triceps
            {
                title: 'Chest & Triceps',
                exercises: [
                    { name: 'Barbell Bench Press', sets: 4, reps: '8-10', desc: 'Chest compound' },
                    { name: 'Incline Dumbbell Bench Press', sets: 4, reps: '10-12', desc: 'Upper chest' },
                    { name: 'Machine Seated Parallel Grip Chest Press', sets: 3, reps: '12', desc: 'Chest isolation' },
                    { name: 'Cable Standing High To Low Fly', sets: 3, reps: '12-15', desc: 'Chest definition' },
                    { name: 'Cable Rope Tricep Extension', sets: 3, reps: '12-15', desc: 'Tricep mass' },
                    { name: 'Cable Standing Overhead Tricep Extension', sets: 3, reps: '12-15', desc: 'Long head tricep' },
                    { name: 'Tricep Dip', sets: 3, reps: '10-12', desc: 'Compound tricep' }
                ]
            },
            // DAY 3: Back & Biceps
            {
                title: 'Back & Biceps',
                exercises: [
                    { name: 'Barbell Bent Over Row', sets: 4, reps: '8-10', desc: 'Back thickness' },
                    { name: 'Wide Grip Lat Pulldown', sets: 4, reps: '10-12', desc: 'Lat width' },
                    { name: 'Cable Seated Row', sets: 3, reps: '12', desc: 'Mid-back' },
                    { name: 'Cable Single Arm Lateral Pulldown', sets: 3, reps: '12/side', desc: 'Unilateral lats' },
                    { name: 'Machine Back Extension', sets: 3, reps: '15', desc: 'Lower back' },
                    { name: 'Barbell Bicep Curl', sets: 3, reps: '10-12', desc: 'Bicep mass' },
                    { name: 'Cable Single Arm Bicep Curl', sets: 3, reps: '12/side', desc: 'Bicep peak' },
                    { name: 'Cable Hammer Curl', sets: 3, reps: '12-15', desc: 'Brachialis' }
                ]
            },
            // DAY 4: Legs (Glutes & Hamstrings)
            {
                title: 'Leg Day - Glutes & Hamstrings',
                exercises: [
                    { name: 'Barbell Romanian Deadlift', sets: 4, reps: '10-12', desc: 'Hamstring and glutes' },
                    { name: 'Barbell Hip Thrust', sets: 4, reps: '12-15', desc: 'Glute isolation' },
                    { name: 'Machine Seated Leg Curl', sets: 4, reps: '12-15', desc: 'Hamstring isolation' },
                    { name: 'Cable Pull-Through', sets: 3, reps: '15', desc: 'Glute activation' },
                    { name: 'Machine Seated Hip Adduction', sets: 3, reps: '15', desc: 'Inner thigh' },
                    { name: 'Standing Calf Raise Machine', sets: 4, reps: '15-20', desc: 'Calf mass' }
                ]
            },
            // DAY 5: Shoulders & Abs
            {
                title: 'Shoulders & Core',
                exercises: [
                    { name: 'Barbell Overhead Shoulder Press', sets: 4, reps: '8-10', desc: 'Shoulder compound' },
                    { name: 'Machine Seated Parallel Grip Shoulder Press', sets: 3, reps: '12', desc: 'Shoulder mass' },
                    { name: 'Dumbbell Lateral Raise', sets: 4, reps: '12-15', desc: 'Lateral deltoid' },
                    { name: 'Cable Single Arm Lateral Raise', sets: 3, reps: '12/side', desc: 'Shoulder width' },
                    { name: 'Dumbbell Reverse Fly', sets: 3, reps: '12-15', desc: 'Rear deltoid' },
                    { name: 'Cable Rope Face Pull', sets: 3, reps: '15', desc: 'Rear delt and traps' },
                    { name: 'Cable Crunch', sets: 3, reps: '15-20', desc: 'Abs' },
                    { name: 'Cable Side Bend', sets: 3, reps: '15/side', desc: 'Obliques' }
                ]
            },
            // DAY 6: Full Body or Active Recovery
            {
                title: 'Full Body Metabolic',
                exercises: [
                    { name: 'Barbell Deadlift', sets: 3, reps: '8', desc: 'Full posterior chain' },
                    { name: 'Barbell Front Squat', sets: 3, reps: '10', desc: 'Quad emphasis' },
                    { name: 'Dumbbell Bench Press', sets: 3, reps: '12', desc: 'Chest' },
                    { name: 'Wide Grip Lat Pulldown', sets: 3, reps: '12', desc: 'Back width' },
                    { name: 'Cable Standing High To Low Fly', sets: 2, reps: '15', desc: 'Chest pump' },
                    { name: 'Cable Seated Row', sets: 2, reps: '15', desc: 'Back pump' }
                ]
            },
            // DAY 7: Rest
            {
                title: 'Rest & Recovery',
                exercises: [
                    { name: 'Downward Dog', sets: 1, reps: '5 min', desc: 'Full body stretch' },
                    { name: "Child's Pose", sets: 1, reps: '5 min', desc: 'Recovery' },
                    { name: 'Corpse Pose', sets: 1, reps: '15 min', desc: 'Complete rest' }
                ]
            }
        ]
    },
    'gym_split': {
        name: 'Male Gym Split',
        id: 'gym_split',
        description: 'Classic bodybuilding split for men with full gym access. Build strength and muscle with dedicated muscle group focus each day.',
        estimatedTime: '45',
        equipment: ['Barbell', 'Dumbbells', 'Cable', 'Machine'],
        schedule: [
            // DAY 1: CHEST
            {
                title: 'Chest Day',
                exercises: [
                    { name: 'Barbell Bench Press', sets: 4, reps: '8-10', desc: 'Chest compound' },
                    { name: 'Dumbbell Incline Bench Press', sets: 4, reps: '10-12', desc: 'Upper chest' },
                    { name: 'Dumbbell Flat Bench Fly', sets: 4, reps: '10-12', desc: 'Chest stretch' },
                    { name: 'Cable Standing High To Low Fly', sets: 4, reps: '12-15', desc: 'Lower chest' },
                    { name: 'Cable Rope Tricep Extension', sets: 4, reps: '12-15', desc: 'Tricep finisher' }
                ]
            },
            // DAY 2: LEGS
            {
                title: 'Leg Day',
                exercises: [
                    { name: 'Barbell Back Squat', sets: 4, reps: '8-10', desc: 'Quad compound' },
                    { name: 'Barbell Romanian Deadlift', sets: 4, reps: '10-12', desc: 'Hamstrings' },
                    { name: 'Dumbbell Walking Lunge', sets: 4, reps: '10-12 each', desc: 'Unilateral' },
                    { name: 'Machine Seated Leg Curl', sets: 4, reps: '12-15', desc: 'Hamstring isolation' },
                    { name: 'Smith Machine Calf Raise', sets: 4, reps: '15-20', desc: 'Calf work' }
                ]
            },
            // DAY 3: BACK
            {
                title: 'Back Day',
                exercises: [
                    { name: 'Barbell Romanian Deadlift', sets: 4, reps: '8-10', desc: 'Posterior chain' },
                    { name: 'Wide Grip Pull Up', sets: 4, reps: '8-10', desc: 'Lat width' },
                    { name: 'Cable Seated Rotational Row', sets: 4, reps: '10-12', desc: 'Mid-back' },
                    { name: 'Cable Rope Face Pull', sets: 4, reps: '12-15', desc: 'Rear delts' },
                    { name: 'Dumbbell Shrug', sets: 4, reps: '12-15', desc: 'Trap work' }
                ]
            },
            // DAY 4: SHOULDERS
            {
                title: 'Shoulder Day',
                exercises: [
                    { name: 'Barbell Overhead Press', sets: 4, reps: '8-10', desc: 'Shoulder compound' },
                    { name: 'Dumbbell Lateral Raise', sets: 4, reps: '12-15', desc: 'Side delts' },
                    { name: 'Cable Rope Face Pull', sets: 4, reps: '12-15', desc: 'Rear delts' },
                    { name: 'Dumbbell Front Raise', sets: 4, reps: '12-15', desc: 'Front delts' },
                    { name: 'Dumbbell Shrug', sets: 4, reps: '12-15', desc: 'Traps' }
                ]
            },
            // DAY 5: ARMS & CORE
            {
                title: 'Arms & Core',
                exercises: [
                    { name: 'Barbell Close Grip Bench Press', sets: 4, reps: '8-10', desc: 'Tricep compound' },
                    { name: 'Barbell Bicep Curl', sets: 4, reps: '10-12', desc: 'Bicep mass' },
                    { name: 'Cable Rope Tricep Extension', sets: 4, reps: '12-15', desc: 'Tricep isolation' },
                    { name: 'Cable Kneeling Crunch', sets: 4, reps: '12-15', desc: 'Abs' },
                    { name: 'Hanging Leg Raise', sets: 4, reps: '10-12', desc: 'Lower abs' }
                ]
            },
            // DAY 6: ACTIVE RECOVERY
            {
                title: 'Active Recovery',
                exercises: [
                    { name: 'Yoga - Downward Dog', sets: 1, reps: '5 min', desc: 'Full body stretch' },
                    { name: 'Yoga - Pigeon Pose (Eka Pada Rajakapotasana)', sets: 2, reps: '2 min/side', desc: 'Hip mobility' },
                    { name: "Child's Pose", sets: 1, reps: '3 min', desc: 'Recovery' },
                    { name: 'Cat to Cow', sets: 1, reps: '3 min', desc: 'Spinal mobility' },
                    { name: 'Corpse Pose', sets: 1, reps: '10 min', desc: 'Deep rest' }
                ]
            },
            // DAY 7: REST
            {
                title: 'Rest & Recovery',
                exercises: [
                    { name: 'Light Walk or Bike', sets: 1, reps: '20-30 min', desc: 'Active recovery cardio' },
                    { name: 'Yoga - Downward Dog', sets: 1, reps: '5 min', desc: 'Stretch' },
                    { name: "Child's Pose", sets: 1, reps: '5 min', desc: 'Recovery' },
                    { name: 'Corpse Pose', sets: 1, reps: '15 min', desc: 'Complete rest' }
                ]
            }
        ]
    },
    'female_gym_split': {
        name: 'Female Gym Split',
        id: 'female_gym_split',
        description: 'Balanced training split for women with full gym access. Build strength with legs twice weekly, push/pull movements, and core focus.',
        estimatedTime: '45',
        equipment: ['Barbell', 'Dumbbells', 'Cable', 'Machine'],
        schedule: [
            // DAY 1: LEGS
            {
                title: 'Leg Day',
                exercises: [
                    { name: 'Barbell Back Squat', sets: 4, reps: '8-10', desc: 'Quad compound' },
                    { name: 'Barbell Romanian Deadlift', sets: 4, reps: '10-12', desc: 'Hamstrings' },
                    { name: 'Dumbbell Walking Lunge', sets: 4, reps: '10-12 each', desc: 'Unilateral' },
                    { name: 'Machine Seated Leg Curl', sets: 4, reps: '12-15', desc: 'Hamstring isolation' },
                    { name: 'Smith Machine Calf Raise', sets: 4, reps: '15-20', desc: 'Calf work' }
                ]
            },
            // DAY 2: PUSH
            {
                title: 'Push Day',
                exercises: [
                    { name: 'Barbell Bench Press', sets: 4, reps: '8-10', desc: 'Chest compound' },
                    { name: 'Dumbbell Seated Shoulder Press', sets: 4, reps: '10-12', desc: 'Shoulder press' },
                    { name: 'Dumbbell Incline Bench Press', sets: 4, reps: '10-12', desc: 'Upper chest' },
                    { name: 'Dumbbell Lateral Raise', sets: 4, reps: '12-15', desc: 'Side delts' },
                    { name: 'Cable Rope Tricep Extension', sets: 4, reps: '12-15', desc: 'Tricep isolation' }
                ]
            },
            // DAY 3: ARMS & CORE
            {
                title: 'Arms & Core',
                exercises: [
                    { name: 'Barbell Close Grip Bench Press', sets: 4, reps: '8-10', desc: 'Tricep compound' },
                    { name: 'Barbell Bicep Curl', sets: 4, reps: '10-12', desc: 'Bicep mass' },
                    { name: 'Cable Rope Tricep Extension', sets: 4, reps: '12-15', desc: 'Tricep isolation' },
                    { name: 'Cable Kneeling Crunch', sets: 4, reps: '12-15', desc: 'Abs' },
                    { name: 'Hanging Leg Raise', sets: 4, reps: '10-12', desc: 'Lower abs' }
                ]
            },
            // DAY 4: LEGS
            {
                title: 'Leg Day',
                exercises: [
                    { name: 'Barbell Back Squat', sets: 4, reps: '8-10', desc: 'Quad compound' },
                    { name: 'Barbell Romanian Deadlift', sets: 4, reps: '10-12', desc: 'Hamstrings' },
                    { name: 'Dumbbell Walking Lunge', sets: 4, reps: '10-12 each', desc: 'Unilateral' },
                    { name: 'Machine Seated Leg Curl', sets: 4, reps: '12-15', desc: 'Hamstring isolation' },
                    { name: 'Smith Machine Calf Raise', sets: 4, reps: '15-20', desc: 'Calf work' }
                ]
            },
            // DAY 5: PULL
            {
                title: 'Pull Day',
                exercises: [
                    { name: 'Barbell Romanian Deadlift', sets: 4, reps: '8-10', desc: 'Posterior chain' },
                    { name: 'Wide Grip Pull Up', sets: 4, reps: '8-10', desc: 'Lat width' },
                    { name: 'Cable Seated Rotational Row', sets: 4, reps: '10-12', desc: 'Back thickness' },
                    { name: 'Cable Rope Face Pull', sets: 4, reps: '12-15', desc: 'Rear delts' },
                    { name: 'Dumbbell Bicep Curl', sets: 4, reps: '12-15', desc: 'Bicep isolation' }
                ]
            },
            // DAY 6: ACTIVE RECOVERY
            {
                title: 'Active Recovery',
                exercises: [
                    { name: 'Yoga - Downward Dog', sets: 1, reps: '5 min', desc: 'Full body stretch' },
                    { name: 'Yoga - Pigeon Pose (Eka Pada Rajakapotasana)', sets: 2, reps: '2 min/side', desc: 'Hip mobility' },
                    { name: "Child's Pose", sets: 1, reps: '3 min', desc: 'Recovery' },
                    { name: 'Cat to Cow', sets: 1, reps: '3 min', desc: 'Spinal mobility' },
                    { name: 'Corpse Pose', sets: 1, reps: '10 min', desc: 'Deep rest' }
                ]
            },
            // DAY 7: REST
            {
                title: 'Rest & Recovery',
                exercises: [
                    { name: 'Light Walk or Bike', sets: 1, reps: '20-30 min', desc: 'Active recovery cardio' },
                    { name: 'Yoga - Downward Dog', sets: 1, reps: '5 min', desc: 'Stretch' },
                    { name: "Child's Pose", sets: 1, reps: '5 min', desc: 'Recovery' },
                    { name: 'Corpse Pose', sets: 1, reps: '15 min', desc: 'Complete rest' }
                ]
            }
        ]
    },
    'bands': {
        name: 'Band Strength',
        id: 'bands',
        description: 'Build lean muscle and improve mobility using resistance bands. Perfect for home or travel.',
        estimatedTime: '35',
        equipment: ['Resistance Bands', 'Mat'],
        schedule: [
            // DAY 1: Lower Body
            {
                title: 'Lower Body Band Work',
                exercises: [
                    { name: 'Banded Squat', sets: 4, reps: '15-20', desc: 'Quad and glute activation with constant tension' },
                    { name: 'Banded Romanian Deadlift', sets: 4, reps: '12-15', desc: 'Hamstring and glute focus' },
                    { name: 'Banded Lateral Walk', sets: 3, reps: '15/side', desc: 'Glute medius activation' },
                    { name: 'Banded Glute Bridge', sets: 4, reps: '20', desc: 'Glute isolation with resistance' },
                    { name: 'Banded Clamshell', sets: 3, reps: '15/side', desc: 'Hip stability and glute activation' },
                    { name: 'Banded Standing Kickback', sets: 3, reps: '12/leg', desc: 'Glute max isolation' }
                ]
            },
            // DAY 2: Upper Body Push
            {
                title: 'Push & Press',
                exercises: [
                    { name: 'Banded Push Up', sets: 4, reps: '12-15', desc: 'Chest with added resistance' },
                    { name: 'Banded Overhead Press', sets: 4, reps: '12-15', desc: 'Shoulder strength' },
                    { name: 'Banded Chest Press', sets: 3, reps: '15', desc: 'Horizontal push' },
                    { name: 'Banded Lateral Raise', sets: 3, reps: '15', desc: 'Shoulder width' },
                    { name: 'Banded Tricep Extension', sets: 3, reps: '15', desc: 'Tricep isolation' },
                    { name: 'Banded Front Raise', sets: 3, reps: '12', desc: 'Anterior deltoid' }
                ]
            },
            // DAY 3: Core & Conditioning
            {
                title: 'Core & Cardio',
                exercises: [
                    { name: 'Banded Woodchop', sets: 3, reps: '12/side', desc: 'Rotational power' },
                    { name: 'Banded Dead Bug', sets: 3, reps: '10/side', desc: 'Core stability with resistance' },
                    { name: 'Banded Mountain Climber', sets: 3, reps: '30 sec', desc: 'Cardio and core' },
                    { name: 'Banded Pallof Press', sets: 3, reps: '12/side', desc: 'Anti-rotation core' },
                    { name: 'Plank with Band Row', sets: 3, reps: '10/side', desc: 'Core and back combo' },
                    { name: 'Banded Bicycle Crunch', sets: 3, reps: '20', desc: 'Obliques with resistance' }
                ]
            },
            // DAY 4: Full Body
            {
                title: 'Total Body Burn',
                exercises: [
                    { name: 'Banded Squat to Press', sets: 4, reps: '12', desc: 'Full body compound' },
                    { name: 'Banded Good Morning', sets: 3, reps: '12', desc: 'Posterior chain' },
                    { name: 'Banded Row', sets: 4, reps: '12-15', desc: 'Back thickness' },
                    { name: 'Banded Reverse Lunge', sets: 3, reps: '10/leg', desc: 'Single leg strength' },
                    { name: 'Banded Face Pull', sets: 3, reps: '15', desc: 'Rear delts and posture' },
                    { name: 'Banded Glute Bridge March', sets: 3, reps: '10/leg', desc: 'Glute and core' }
                ]
            },
            // DAY 5: Lower Body Glute Focus
            {
                title: 'Glute Sculpt',
                exercises: [
                    { name: 'Banded Sumo Squat', sets: 4, reps: '15', desc: 'Inner thigh and glutes' },
                    { name: 'Banded Hip Thrust', sets: 4, reps: '20', desc: 'Glute max builder' },
                    { name: 'Banded Fire Hydrant', sets: 3, reps: '15/side', desc: 'Glute medius' },
                    { name: 'Banded Donkey Kick', sets: 3, reps: '15/leg', desc: 'Glute isolation' },
                    { name: 'Banded Standing Abduction', sets: 3, reps: '15/side', desc: 'Outer glute' },
                    { name: 'Banded Frog Pump', sets: 3, reps: '20', desc: 'Glute activation finisher' }
                ]
            },
            // DAY 6: Upper Body Pull
            {
                title: 'Pull & Biceps',
                exercises: [
                    { name: 'Banded Bent Over Row', sets: 4, reps: '12-15', desc: 'Back compound' },
                    { name: 'Banded Single Arm Row', sets: 3, reps: '12/side', desc: 'Unilateral back' },
                    { name: 'Banded Face Pull', sets: 3, reps: '15', desc: 'Rear delts' },
                    { name: 'Banded Bicep Curl', sets: 3, reps: '15', desc: 'Bicep mass' },
                    { name: 'Banded Hammer Curl', sets: 3, reps: '12', desc: 'Brachialis' },
                    { name: 'Banded Reverse Fly', sets: 3, reps: '12-15', desc: 'Upper back and posture' }
                ]
            },
            // DAY 7: Active Recovery
            {
                title: 'Mobility & Stretch',
                exercises: [
                    { name: 'Banded Shoulder Dislocate', sets: 2, reps: '10', desc: 'Shoulder mobility' },
                    { name: 'Banded Pull Apart', sets: 2, reps: '15', desc: 'Upper back activation' },
                    { name: 'Yoga - Downward Dog', sets: 1, reps: '3 min', desc: 'Full body stretch' },
                    { name: "Child's Pose", sets: 1, reps: '5 min', desc: 'Recovery' },
                    { name: 'Corpse Pose', sets: 1, reps: '10 min', desc: 'Deep rest' }
                ]
            }
        ]
    }
};

// Check-in State
let selectedEnergy = null;
let selectedEquipment = null;

function openCheckInModal() {
    // Use the new check-in modal (with hyphen) instead of old one
    if (typeof applyGenderSpecificUI === 'function') {
        applyGenderSpecificUI();
    }
    document.getElementById('check-in-modal').style.display = 'flex';
}

function selectEnergy(level) {
    selectedEnergy = level;
    document.querySelectorAll('[id^="btn-energy-"]').forEach(btn => btn.classList.remove('selected'));
    document.getElementById('btn-energy-' + level).classList.add('selected');
}

function selectEquipment(type) {
    selectedEquipment = type;
    document.querySelectorAll('[id^="btn-eq-"]').forEach(btn => btn.classList.remove('selected'));
    document.getElementById('btn-eq-' + type).classList.add('selected');
}

async function submitCheckIn() {
    // DEPRECATED: This is the old check-in function - redirect to new submitDailyCycleSync
    if(!selectedEnergy || !selectedEquipment) {
        alert("Please select both energy level and equipment access.");
        return;
    }

    // Populate new checkInProgress object with old modal values
    if (typeof window.checkInProgress === 'undefined') {
        window.checkInProgress = { flow: null, symptoms: [], mood: null, energy: null, fluid: null, equipment: null, recovery: null };
    }
    window.checkInProgress.energy = selectedEnergy;
    window.checkInProgress.equipment = selectedEquipment;

    // Close old modal
    const oldModal = document.getElementById('checkin-modal');
    if (oldModal) oldModal.style.display = 'none';

    // Call new submit function which handles all persistence
    if (typeof submitDailyCycleSync === 'function') {
        await submitDailyCycleSync();
    } else {
        // Fallback if new function not available
        try {
            const user = window.currentUser;
            if (user) {
                const dateStr = getLocalDateString();
                await dbHelpers.checkins.upsert(user.id, dateStr, {
                    energy: selectedEnergy,
                    equipment: selectedEquipment
                });
                console.log('✅ Check-in saved to DB (legacy)');
            }
        } catch (e) {
            console.error('Failed to save check-in:', e);
            alert('Failed to save check-in. Please try again.');
            return;
        }
        renderMovementView();
    }
}

// Cycle Tracking Modal Functions
function openCycleTrackingModal() {
    // Populate modal with current data
    const modal = document.getElementById('cycle-tracking-modal');
    const periodDateInput = document.getElementById('cycle-modal-period-date');
    const cycleLengthInput = document.getElementById('cycle-modal-cycle-length');
    const wellnessToggle = document.getElementById('cycle-modal-wellness-toggle');

    // Load from userCycleData or hidden inputs
    if (userCycleData.lastPeriod) {
        periodDateInput.value = userCycleData.lastPeriod;
    }
    cycleLengthInput.value = userCycleData.cycleLength || 28;
    wellnessToggle.checked = userCycleData.noPeriodMode || false;

    // Show/hide period date input based on wellness mode
    const updatePeriodVisibility = () => {
        const periodContainer = periodDateInput.parentElement;
        periodContainer.style.display = wellnessToggle.checked ? 'none' : 'block';
    };

    wellnessToggle.onchange = updatePeriodVisibility;
    updatePeriodVisibility();

    // Show modal with proper animation (match onboarding wizard pattern)
    if(modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
        modal.style.opacity = '1';
    }
}

function closeCycleTrackingModal() {
    const modal = document.getElementById('cycle-tracking-modal');
    if(modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        modal.style.opacity = '0';
    }
}

function saveCycleTrackingData() {
    const periodDateInput = document.getElementById('cycle-modal-period-date');
    const cycleLengthInput = document.getElementById('cycle-modal-cycle-length');
    const wellnessToggle = document.getElementById('cycle-modal-wellness-toggle');

    // Validate input
    if (!wellnessToggle.checked && !periodDateInput.value) {
        alert("Please enter your last period date or enable Wellness Mode.");
        return;
    }

    // Update userCycleData
    userCycleData.noPeriodMode = wellnessToggle.checked;
    userCycleData.lastPeriod = wellnessToggle.checked ? null : periodDateInput.value;
    userCycleData.cycleLength = parseInt(cycleLengthInput.value) || 28;

    // Sync to hidden inputs (for backward compatibility)
    document.getElementById('last-period-input-profile').value = periodDateInput.value || '';
    document.getElementById('cycle-length-input-profile').value = cycleLengthInput.value;
    document.getElementById('no-period-toggle-profile').checked = wellnessToggle.checked;

    // Save to storage using existing function
    updateCycleData();

    // Close modal
    closeCycleTrackingModal();

    // Show success message
    alert('Cycle tracking settings saved successfully!');
}

function getExerciseVideoUrl(name) {
    return EXERCISE_VIDEOS[name] || '';
}

async function renderMovementView() {
    const user = window.currentUser;
    if (!user) return;

    // Load active custom program (for calendar and movement integration)
    try {
        if (typeof dbHelpers !== 'undefined' && dbHelpers.customPrograms) {
            const activeProgram = await dbHelpers.customPrograms.getActive(user.id);
            window.activeCustomProgramCache = activeProgram;
            if (activeProgram) {
                console.log('🏋️ Active custom program loaded:', activeProgram.program_name);
            }
        }
    } catch (err) {
        console.error('Failed to load active custom program:', err);
        window.activeCustomProgramCache = null;
    }

    // 1. Get Date Index & Profile
    let dbProfile = await window.getUserProfile();

    // CRITICAL FIX: Also fetch quiz results for equipment_access (stored in quiz_results table, not users)
    // This mirrors the logic in renderDashboard() which correctly loads equipment_access
    try {
        if (window.currentUser?.id && typeof dbHelpers !== 'undefined') {
            const quizResult = await dbHelpers.quizResults.getLatest(window.currentUser.id);
            if (quizResult) {
                dbProfile = { ...dbProfile, ...quizResult };

                // Sync equipment_access to localStorage so it persists across page loads
                if (quizResult.equipment_access) {
                    const localProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
                    if (!localProfile.equipment_access || localProfile.equipment_access !== quizResult.equipment_access) {
                        localProfile.equipment_access = quizResult.equipment_access;
                        localStorage.setItem('userProfile', JSON.stringify(localProfile));
                        console.log('✅ Equipment access synced from DB to localStorage:', quizResult.equipment_access);
                    }
                }
            }
        }
    } catch (e) {
        console.warn("Quiz results fetching error in loadMovementView:", e);
    }

    const startDate = dbProfile?.program_start_date;

    let dayIndex = 0;
    if (startDate) {
        const start = new Date(startDate);
        const now = new Date();
        const diffTime = Math.abs(now - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const currentDay = diffDays || 1;
        dayIndex = (currentDay - 1) % 7;

        // Update header date
        const dateEl = document.getElementById('movement-today-date');
        if(dateEl) dateEl.innerText = `Day ${currentDay}`;
    }

    // 2. Get Check-in
    const dateStr = getLocalDateString();
    const checkin = await dbHelpers.checkins.get(user.id, dateStr);

    // 3. Calculate Cycle Phase
    let phaseKey = 'wellness';
    let cyclePhaseInfo = null;
    let currentCycleDay = 0;

    if (userCycleData.lastPeriod && !userCycleData.noPeriodMode) {
        const start = new Date(userCycleData.lastPeriod);
        const now = new Date();
        const msPerDay = 24 * 60 * 60 * 1000;
        const daysSinceStart = Math.floor((now - start) / msPerDay);
        currentCycleDay = (daysSinceStart % userCycleData.cycleLength) + 1;
        if (currentCycleDay < 1) currentCycleDay = 1;

        phaseKey = getCyclePhase(currentCycleDay, userCycleData.cycleLength);
        cyclePhaseInfo = PHASE_INFO[phaseKey];
    }

    // === PRIORITY-BASED WORKOUT SELECTION ===
    // Priority 1: Quiz/Profile Equipment (highest) - What equipment do they have access to?
    // Priority 2: WORKOUT_DB Schedules - Use actual pre-built workouts
    // Priority 3: Daily Check-in - Energy, mood, symptoms
    // Priority 4: Cycle Phase (lowest) - Adjust based on menstrual phase

    // BUGFIX: Load profile from localStorage (same as calendar), fallback to sessionStorage
    // This ensures consistency with renderWeeklyCalendar which correctly shows gym split workouts
    let profile = {};
    try { profile = JSON.parse(localStorage.getItem('userProfile') || '{}'); } catch(e) {}

    // If equipment_access is missing in localStorage, check sessionStorage (from quiz)
    if (!profile.equipment_access) {
        let sessionProfile = {};
        try { sessionProfile = JSON.parse(sessionStorage.getItem('userProfile') || '{}'); } catch(e) {}
        if (sessionProfile.equipment_access) {
            profile.equipment_access = sessionProfile.equipment_access;
            // Save to localStorage for future use
            localStorage.setItem('userProfile', JSON.stringify(profile));
        }
    }

    // Merge with database profile for other fields like program_start_date
    profile = { ...dbProfile, ...profile };

    // PRIORITY 0.5: Smart equipment override - most recent selection wins (check-in vs onboarding)
    const todayDateStr = getLocalDateString();
    const todayCheckIn = userCycleData.logs?.[todayDateStr];
    const checkInTimestamp = todayCheckIn?.timestamp;
    const onboardingTimestamp = localStorage.getItem('onboardingCompletedAt');

    if (todayCheckIn?.equipment) {
        // Both timestamps exist - compare them
        if (checkInTimestamp && onboardingTimestamp) {
            const checkInTime = new Date(checkInTimestamp).getTime();
            const onboardingTime = new Date(onboardingTimestamp).getTime();

            if (checkInTime > onboardingTime) {
                // Check-in is more recent - use check-in equipment
                profile.equipment_access = todayCheckIn.equipment;
                console.log('📱 Movement view using today\'s check-in equipment (more recent):', profile.equipment_access);
            } else {
                // Onboarding is more recent - keep profile equipment
                console.log('📱 Movement view using onboarding equipment (more recent):', profile.equipment_access);
            }
        } else {
            // No onboarding timestamp - use check-in equipment (backward compatibility)
            profile.equipment_access = todayCheckIn.equipment;
            console.log('📱 Movement view using today\'s check-in equipment:', profile.equipment_access);
        }
    } else if (!todayCheckIn && userCycleData.logs) {
        // No check-in today - use last check-in data (don't reset to defaults)
        const dates = Object.keys(userCycleData.logs).sort().reverse();
        const lastCheckIn = dates.find(date => userCycleData.logs[date]?.equipment);
        if (lastCheckIn) {
            profile.equipment_access = userCycleData.logs[lastCheckIn].equipment;
            console.log('📱 Movement view using last check-in equipment from', lastCheckIn, ':', profile.equipment_access);
        }
    }

    // PRIORITY 1: Determine available programs based on quiz/profile equipment
    // Check if user has gym access from their profile
    // equipment_access is the source of truth; gym_access is legacy fallback only if equipment_access is undefined
    const hasGymAccess = profile?.equipment_access === 'gym' || (profile?.equipment_access === undefined && profile?.gym_access === true);
    // Support both 'dumbbells' (new) and 'home' (legacy) values for backward compatibility
    const hasDumbbells = profile?.equipment_access === 'dumbbells' || profile?.equipment_access === 'home' || hasGymAccess;
    // Check for resistance bands only
    const hasBands = profile?.equipment_access === 'bands';
    // Check for yoga only preference
    const hasYogaOnly = profile?.equipment_access === 'yoga_only';

    // Default available programs based on equipment
    // IMPORTANT: Users should only get workouts matching their equipment
    // yoga_only: only yoga, bands: yoga + bands, dumbbells+: includes bodyweight as fallback
    let availablePrograms = ['yoga']; // Yoga always available
    if (hasYogaOnly) {
        // Yoga only - no other programs
    } else if (hasBands && !hasDumbbells && !hasGymAccess) {
        // Bands only - add bands but NOT bodyweight
        availablePrograms.push('bands');
    } else {
        // Has dumbbells or gym - bodyweight is acceptable fallback
        availablePrograms.push('bodyweight');
        if (hasDumbbells) availablePrograms.push('home');
        if (hasGymAccess) availablePrograms.push('gym');
    }

    // PRIORITY 2: Weekly Schedule using WORKOUT_DB
    const today = new Date();
    const dayOfWeek = today.getDay();
    const calDayIndex = (dayOfWeek + 6) % 7; // Mon=0 index

    // Check if user qualifies for Gym Split (same logic as calendar for consistency)
    // Note: isMale must be defined here before the gym_split checks
    const isMale = (typeof isMaleUser === 'function' && isMaleUser());
    const hasHighEnergy = profile.energy_status === 'high';
    // Male and female gym splits now have IDENTICAL requirements: gym access only
    // Females can opt-in to cycle sync for automatic adjustments during menstrual phase
    const useMaleGymSplit = isMale && hasGymAccess;
    const useFemaleGymSplit = !isMale && hasGymAccess;

    // SIMPLIFIED: Direct equipment checks (same pattern as gym split - no defaultStrengthProgram complexity)
    const useYogaOnly = hasYogaOnly;
    const useHome = hasDumbbells && !hasGymAccess; // Has dumbbells but not full gym
    const useBands = hasBands && !hasDumbbells && !hasGymAccess; // Has bands only

    // DEBUG: Log equipment selection values
    console.log('🔍 Movement equipment check:', {
        equipment_access: profile?.equipment_access,
        hasYogaOnly,
        useYogaOnly,
        hasDumbbells,
        useHome,
        hasBands,
        useBands,
        hasGymAccess,
        useMaleGymSplit,
        useFemaleGymSplit
    });

    // Add gym_split programs to available programs if user qualifies
    if (useMaleGymSplit) availablePrograms.push('gym_split');
    if (useFemaleGymSplit) availablePrograms.push('female_gym_split');

    // Weekly Schedule - maps each day to a program and workout
    // Uses equipment settings from onboarding to set appropriate workouts
    // IMPORTANT: For hero personalization, subcategories are used to pull from WORKOUT_LIBRARY
    let WEEKLY_SCHEDULE;
    let usingCustomProgram = false;
    let customProgramInfo = null;

    // Check for active custom program first
    const activeCustomProgram = window.activeCustomProgramCache;
    if (activeCustomProgram && activeCustomProgram.is_active && activeCustomProgram.start_date) {
        // Check if program is still within its duration
        const today = new Date();
        const startDate = new Date(activeCustomProgram.start_date);
        const msPerWeek = 7 * 24 * 60 * 60 * 1000;
        const weeksElapsed = Math.floor((today - startDate) / msPerWeek);
        const currentWeek = weeksElapsed + 1;

        if (currentWeek <= activeCustomProgram.duration_weeks) {
            // Use custom program schedule
            const schedule = activeCustomProgram.weekly_schedule || [];
            WEEKLY_SCHEDULE = schedule.map((item, idx) => {
                if (!item.workout || item.workout.type === 'rest') {
                    return { day: item.day, program: 'rest', dayIndex: idx, isRest: true, fallback: 'yoga', fallbackIdx: idx };
                }
                return {
                    day: item.day,
                    program: item.workout.category || 'custom',
                    dayIndex: idx,
                    subcategory: item.workout.subcategory || '',
                    muscleGroup: item.workout.subcategory || '',
                    customWorkout: item.workout,
                    fallback: 'yoga',
                    fallbackIdx: idx
                };
            });
            usingCustomProgram = true;
            customProgramInfo = {
                name: activeCustomProgram.program_name,
                currentWeek: currentWeek,
                totalWeeks: activeCustomProgram.duration_weeks
            };
            console.log('🏋️ Movement using custom program:', activeCustomProgram.program_name, `Week ${currentWeek}/${activeCustomProgram.duration_weeks}`);
        }
    }

    // Fall back to equipment-based schedule if no custom program
    if (!usingCustomProgram && useMaleGymSplit) {
        // Male Gym Split: Same as calendar - Chest, Back, Legs, Shoulders, Arms+Core, Active Recovery, Rest
        WEEKLY_SCHEDULE = [
            { day: 'Mon', program: 'gym_split', dayIndex: 0, muscleGroup: 'chest', fallback: 'yoga', fallbackIdx: 4 },
            { day: 'Tue', program: 'gym_split', dayIndex: 1, muscleGroup: 'legs', fallback: 'yoga', fallbackIdx: 2 },
            { day: 'Wed', program: 'gym_split', dayIndex: 2, muscleGroup: 'back', fallback: 'yoga', fallbackIdx: 5 },
            { day: 'Thu', program: 'gym_split', dayIndex: 3, muscleGroup: 'shoulders', fallback: 'yoga', fallbackIdx: 4 },
            { day: 'Fri', program: 'gym_split', dayIndex: 4, muscleGroup: 'armscore', fallback: 'yoga', fallbackIdx: 4 },
            { day: 'Sat', program: 'yoga', dayIndex: 5, subcategory: 'yin', fallback: 'yoga', fallbackIdx: 6 },
            { day: 'Sun', program: 'yoga', dayIndex: 6, subcategory: 'yin', fallback: 'yoga', fallbackIdx: 6 }
        ];
    } else if (!usingCustomProgram && useFemaleGymSplit) {
        // Female Gym Split: Same as calendar - Legs, Push, Arms+Core, Legs, Pull, Active Recovery, Rest
        WEEKLY_SCHEDULE = [
            { day: 'Mon', program: 'female_gym_split', dayIndex: 0, muscleGroup: 'legs', fallback: 'yoga', fallbackIdx: 4 },
            { day: 'Tue', program: 'female_gym_split', dayIndex: 1, muscleGroup: 'push', fallback: 'yoga', fallbackIdx: 5 },
            { day: 'Wed', program: 'female_gym_split', dayIndex: 2, muscleGroup: 'armscore', fallback: 'yoga', fallbackIdx: 2 },
            { day: 'Thu', program: 'female_gym_split', dayIndex: 3, muscleGroup: 'legs', fallback: 'yoga', fallbackIdx: 4 },
            { day: 'Fri', program: 'female_gym_split', dayIndex: 4, muscleGroup: 'pull', fallback: 'yoga', fallbackIdx: 4 },
            { day: 'Sat', program: 'yoga', dayIndex: 5, subcategory: 'power', fallback: 'yoga', fallbackIdx: 5 },
            { day: 'Sun', program: 'yoga', dayIndex: 6, subcategory: 'yin', fallback: 'yoga', fallbackIdx: 6 }
        ];
    } else if (!usingCustomProgram && useYogaOnly) {
        // Yoga Only - direct check like gym
        WEEKLY_SCHEDULE = [
            { day: 'Mon', program: 'yoga', dayIndex: 0, subcategory: 'power', fallback: 'yoga', fallbackIdx: 0 },
            { day: 'Tue', program: 'yoga', dayIndex: 1, subcategory: 'restorative', fallback: 'yoga', fallbackIdx: 1 },
            { day: 'Wed', program: 'yoga', dayIndex: 2, subcategory: 'yin', fallback: 'yoga', fallbackIdx: 2 },
            { day: 'Thu', program: 'yoga', dayIndex: 3, subcategory: 'restorative', fallback: 'yoga', fallbackIdx: 3 },
            { day: 'Fri', program: 'yoga', dayIndex: 4, subcategory: 'power', fallback: 'yoga', fallbackIdx: 4 },
            { day: 'Sat', program: 'yoga', dayIndex: 5, subcategory: 'power', fallback: 'yoga', fallbackIdx: 5 },
            { day: 'Sun', program: 'yoga', dayIndex: 6, subcategory: 'yin', fallback: 'yoga', fallbackIdx: 6 }
        ];
    } else if (!usingCustomProgram && useHome) {
        // Home/Dumbbell Split - direct check like gym
        WEEKLY_SCHEDULE = [
            { day: 'Mon', program: 'home', dayIndex: 0, subcategory: 'lowerbody', fallback: 'yoga', fallbackIdx: 4 },
            { day: 'Tue', program: 'home', dayIndex: 1, subcategory: 'push', fallback: 'yoga', fallbackIdx: 5 },
            { day: 'Wed', program: 'yoga', dayIndex: 2, subcategory: 'restorative', fallback: 'yoga', fallbackIdx: 2 },
            { day: 'Thu', program: 'home', dayIndex: 3, subcategory: 'pull', fallback: 'yoga', fallbackIdx: 4 },
            { day: 'Fri', program: 'home', dayIndex: 4, subcategory: 'lowerbody', fallback: 'yoga', fallbackIdx: 4 },
            { day: 'Sat', program: 'yoga', dayIndex: 5, subcategory: 'power', fallback: 'yoga', fallbackIdx: 5 },
            { day: 'Sun', program: 'yoga', dayIndex: 6, subcategory: 'yin', fallback: 'yoga', fallbackIdx: 6 }
        ];
    } else if (!usingCustomProgram && useBands) {
        // Resistance Bands Split - direct check like gym
        WEEKLY_SCHEDULE = [
            { day: 'Mon', program: 'bands', dayIndex: 0, fallback: 'yoga', fallbackIdx: 4 },
            { day: 'Tue', program: 'bands', dayIndex: 1, fallback: 'yoga', fallbackIdx: 5 },
            { day: 'Wed', program: 'yoga', dayIndex: 2, subcategory: 'restorative', fallback: 'yoga', fallbackIdx: 2 },
            { day: 'Thu', program: 'bands', dayIndex: 3, fallback: 'yoga', fallbackIdx: 4 },
            { day: 'Fri', program: 'bands', dayIndex: 4, fallback: 'yoga', fallbackIdx: 4 },
            { day: 'Sat', program: 'bands', dayIndex: 5, fallback: 'yoga', fallbackIdx: 5 },
            { day: 'Sun', program: 'yoga', dayIndex: 6, subcategory: 'yin', fallback: 'yoga', fallbackIdx: 6 }
        ];
    } else if (!usingCustomProgram) {
        // Bodyweight Split (fallback - no equipment)
        WEEKLY_SCHEDULE = [
            { day: 'Mon', program: 'bodyweight', dayIndex: 0, subcategory: 'lowerbody', fallback: 'yoga', fallbackIdx: 4 },
            { day: 'Tue', program: 'bodyweight', dayIndex: 1, subcategory: 'upperbody', fallback: 'yoga', fallbackIdx: 5 },
            { day: 'Wed', program: 'yoga', dayIndex: 2, subcategory: 'restorative', fallback: 'yoga', fallbackIdx: 2 },
            { day: 'Thu', program: 'bodyweight', dayIndex: 3, subcategory: 'core', fallback: 'yoga', fallbackIdx: 4 },
            { day: 'Fri', program: 'bodyweight', dayIndex: 4, subcategory: 'lowerbody', fallback: 'yoga', fallbackIdx: 4 },
            { day: 'Sat', program: 'yoga', dayIndex: 5, subcategory: 'power', fallback: 'yoga', fallbackIdx: 5 },
            { day: 'Sun', program: 'yoga', dayIndex: 6, subcategory: 'yin', fallback: 'yoga', fallbackIdx: 6 }
        ];
    }

    const scheduleItem = WEEKLY_SCHEDULE[calDayIndex];
    let suggestedProgram = scheduleItem.program;
    let workoutDayIndex = scheduleItem.dayIndex;
    let personalizationReason = '';
    let hasWorkoutOverride = false;
    let overrideSubcategory = null; // Used to override scheduleItem.subcategory for energy-based upgrades

    // PRIORITY 0: Check for today's workout override (e.g., user accepted yoga recommendation or cycle sync)
    try {
        const override = JSON.parse(localStorage.getItem('todayWorkoutOverride') || 'null');
        if (override && override.date === dateStr && override.program) {
            suggestedProgram = override.program;
            workoutDayIndex = 3; // Restorative Recovery for yoga

            // Differentiate messaging based on override reason
            if (override.reason === 'cycle_sync_automatic') {
                personalizationReason = '✨ Cycle Sync: Automatic yoga during menstrual phase';
            } else if (override.reason === 'low_energy') {
                personalizationReason = isMale ? '💪 Daily Sync: Recovery session for low energy' : '✨ Cycle Sync: Restorative practice for low energy';
            } else {
                personalizationReason = isMale ? '💪 Daily Sync: Custom workout adjustment' : '✨ Cycle Sync: Custom workout adjustment';
            }

            hasWorkoutOverride = true;
        }
    } catch (e) { /* ignore parse errors */ }

    // PRIORITY 3: Daily Check-in adjustments (skip if override is active)
    // --- DAILY SYNC OVERRIDE (Local Log) ---
    // Use gender-appropriate messaging (isMale defined earlier for gym_split check)
    const syncLabel = isMale ? '💪 Daily Sync' : '✨ Cycle Sync';

    // Track if user explicitly selected equipment in today's check-in
    let userSelectedEquipmentToday = false;

    if (userCycleData.logs && userCycleData.logs[dateStr] && !hasWorkoutOverride) {
        const log = userCycleData.logs[dateStr];

        // Map Energy - only auto-apply if user hasn't already made a choice via popup
        if (log.energy === 'low' && !log.workoutOverride) {
             // Low energy is now handled by popup - this is fallback for older check-ins
             suggestedProgram = 'yoga';
             workoutDayIndex = 3;
             personalizationReason = isMale ? '💪 Daily Sync: Active recovery for low energy.' : '✨ Cycle Sync: Gentle flow for low energy.';
        }

        // Map Symptoms (Cramps/Back Pain -> Yin) - Skip cramps for males
        if (log.symptoms && !isMale && (log.symptoms.includes('cramps') || log.symptoms.includes('back_pain'))) {
             suggestedProgram = 'yoga';
             workoutDayIndex = 6; // Yin
             personalizationReason = '✨ Cycle Sync: Relief for your body.';
        }

        // Map muscle soreness for males
        if (log.symptoms && isMale && log.symptoms.includes('muscle_soreness')) {
             suggestedProgram = 'yoga';
             workoutDayIndex = 3; // Restorative
             personalizationReason = '💪 Daily Sync: Recovery session for sore muscles.';
        }

        // Map Mood
        if (log.mood === 'anxious' || log.mood === 'sad') {
             suggestedProgram = 'yoga';
             workoutDayIndex = 6;
             personalizationReason = `${syncLabel}: Calming practice for your mind.`;
        }

        // High Energy Bonus - check for menstrual only if female
        const skipMenstrualCheck = isMale || !cyclePhaseInfo?.name.includes('Menstrual');
        if (log.energy === 'high' && suggestedProgram === 'yoga' && skipMenstrualCheck) {
             // For yoga-only users, upgrade to power yoga instead of bodyweight
             if (useYogaOnly) {
                 suggestedProgram = 'yoga';
                 workoutDayIndex = 0; // Power Yoga (Full Body Power Flow)
                 overrideSubcategory = 'power'; // Override subcategory for WORKOUT_LIBRARY
                 personalizationReason = isMale ? '💪 Daily Sync: Power yoga for high energy!' : '✨ Cycle Sync: Power flow for high energy!';
             } else if (useBands) {
                 // For bands users, upgrade from yoga to bands (if they were on yoga day)
                 suggestedProgram = 'bands';
                 workoutDayIndex = 0;
                 personalizationReason = isMale ? '💪 Daily Sync: High energy - bands workout!' : '✨ Cycle Sync: Matching your high energy with bands!';
             } else {
                 suggestedProgram = 'bodyweight'; // Upgrade from Yoga
                 workoutDayIndex = 1; // Dynamic Flow
                 personalizationReason = isMale ? '💪 Daily Sync: Let\'s crush it with high energy!' : '✨ Cycle Sync: Matching your high energy!';
             }
        }

        // Recovery status for males
        if (isMale && log.recovery) {
            if (log.recovery === 'fresh') {
                // For yoga-only users, upgrade to power yoga instead of bodyweight
                if (useYogaOnly) {
                    suggestedProgram = 'yoga';
                    workoutDayIndex = 0; // Power Yoga
                    overrideSubcategory = 'power'; // Override subcategory for WORKOUT_LIBRARY
                    personalizationReason = '💪 Daily Sync: Power yoga - fully recovered!';
                } else if (useBands) {
                    // For bands users, keep their bands workout - don't override to bodyweight
                    // No change to suggestedProgram, just add motivation message
                    personalizationReason = '💪 Daily Sync: Fully recovered - let\'s crush this bands workout!';
                } else {
                    suggestedProgram = 'bodyweight';
                    workoutDayIndex = 1;
                    personalizationReason = '💪 Daily Sync: Fully recovered - time to push hard!';
                }
            } else if (log.recovery === 'tired') {
                suggestedProgram = 'yoga';
                workoutDayIndex = 3;
                personalizationReason = '💪 Daily Sync: Rest day for optimal recovery.';
            }
        }
    }
    // --- END SUPERBOOST ---

    // Get today's check-in symptoms (time-aware - only from recent check-ins)
    let todaySymptoms = [];
    if (checkin && checkin.additional_data && checkin.additional_data.symptoms) {
        todaySymptoms = checkin.additional_data.symptoms;
    } else if (userCycleData.logs && userCycleData.logs[dateStr] && userCycleData.logs[dateStr].symptoms) {
        todaySymptoms = userCycleData.logs[dateStr].symptoms;
    }

    // Symptoms override - BUT only if user hasn't explicitly selected equipment
    // EXCEPTION: If mood is 'strong' (High Energy), we ignore 'fatigue' and 'anxiety' overrides to allow rigorous exercise
    const isHighEnergy = userCycleData.mood === 'strong';

    if (todaySymptoms && todaySymptoms.length > 0) {
        // Hot flash is female-specific, skip for males
        if (!isMale && (todaySymptoms.includes('hot_flash') || todaySymptoms.includes('dizziness'))) {
            suggestedProgram = 'yoga';
            workoutDayIndex = 3; // Restorative Recovery
            personalizationReason = '✨ Cycle Sync: Gentle recovery for your symptoms today';
        } else if ((todaySymptoms.includes('fatigue') || todaySymptoms.includes('anxiety')) && !isHighEnergy) {
            suggestedProgram = 'yoga';
            workoutDayIndex = 6; // Yin & Meditation
            personalizationReason = `${syncLabel}: Restorative practice for how you feel today`;
        }
    } else if (userCycleData.mood === 'tired') {
        suggestedProgram = 'yoga';
        workoutDayIndex = 3; // Restorative Recovery
        personalizationReason = `${syncLabel}: Recovery & restoration for low energy`;
    }

    // HIGHEST PRIORITY: Explicit equipment selection from today's check-in overrides symptoms
    // Check both database checkin AND localStorage logs for equipment selection
    let equipmentFromCheckin = null;

    // First, try to get equipment from database check-in
    if (checkin && checkin.equipment) {
        equipmentFromCheckin = checkin.equipment;
    }
    // Fallback: check localStorage if database doesn't have it
    else if (userCycleData.logs && userCycleData.logs[dateStr] && userCycleData.logs[dateStr].equipment) {
        equipmentFromCheckin = userCycleData.logs[dateStr].equipment;
    }

    if (checkin || equipmentFromCheckin) {
        // If low energy, always suggest yoga (even overrides equipment choice)
        if (checkin && checkin.energy === 'low') {
            suggestedProgram = 'yoga';
            workoutDayIndex = 3; // Restorative Recovery
            personalizationReason = isMale ? '💪 Daily Sync: Active recovery for low energy' : '✨ Cycle Sync: Gentle movement for low energy today';
        }
        // Equipment override based on TODAY's explicit check-in choice
        // BUGFIX: Respect gym_split programs when user selects gym equipment in check-in
        else if (equipmentFromCheckin === 'gym' && (availablePrograms.includes('gym') || availablePrograms.includes('gym_split') || availablePrograms.includes('female_gym_split'))) {
            // Male users qualifying for gym_split should stay on gym_split schedule
            if (useMaleGymSplit && availablePrograms.includes('gym_split')) {
                suggestedProgram = 'gym_split';
                // Keep the original dayIndex from the gym_split schedule item
                workoutDayIndex = scheduleItem.dayIndex;
            }
            // Female users qualifying for female_gym_split should stay on female_gym_split schedule
            else if (useFemaleGymSplit && availablePrograms.includes('female_gym_split')) {
                suggestedProgram = 'female_gym_split';
                workoutDayIndex = scheduleItem.dayIndex;
            }
            // Fallback to regular gym program
            else {
                suggestedProgram = 'gym';
                workoutDayIndex = calDayIndex % 7;
            }
            userSelectedEquipmentToday = true;
            // Clear symptom-based personalization if user explicitly chose equipment
            if (personalizationReason.includes('symptoms') || personalizationReason.includes('Restorative')) {
                personalizationReason = '';
            }
        } else if (equipmentFromCheckin === 'dumbbells' && availablePrograms.includes('home')) {
            suggestedProgram = 'home';
            workoutDayIndex = calDayIndex % 7;
            userSelectedEquipmentToday = true;
            // Clear symptom-based personalization if user explicitly chose equipment
            if (personalizationReason.includes('symptoms') || personalizationReason.includes('Restorative')) {
                personalizationReason = '';
            }
        } else if (equipmentFromCheckin === 'bands' && availablePrograms.includes('bands')) {
            suggestedProgram = 'bands';
            workoutDayIndex = calDayIndex % 7;
            userSelectedEquipmentToday = true;
            // Clear symptom-based personalization if user explicitly chose equipment
            if (personalizationReason.includes('symptoms') || personalizationReason.includes('Restorative')) {
                personalizationReason = '';
            }
        } else if (equipmentFromCheckin === 'yoga_only' || equipmentFromCheckin === 'none') {
            suggestedProgram = 'yoga';
            // Use schedule-based yoga index if available, otherwise default to restorative
            workoutDayIndex = scheduleItem?.subcategory ? scheduleItem.dayIndex : 3;
            userSelectedEquipmentToday = true;
            // Don't clear personalization for yoga - it's a valid symptom response too
        }
    }

    // PRIORITY 4: Cycle Phase adjustments (automatic override handled at check-in)
    // This provides fallback messaging if user navigates directly to Movement tab
    if (!isMale && !personalizationReason && !userSelectedEquipmentToday && !hasWorkoutOverride && profile && cyclePhaseInfo && phaseKey !== 'wellness' && phaseKey !== 'performance') {
        const cycleSyncEnabled = profile.cycle_sync_preference === 'yes';
        const periodEnergyLow = profile.period_energy_response === 'low';

        // Only apply cycle-based recommendations if user opted in
        if (cycleSyncEnabled && periodEnergyLow) {
            // User opted in AND has low energy during period
            if (phaseKey === 'menstrual' && suggestedProgram !== 'yoga') {
                // Automatic cycle sync: switch to yoga AND show user it's synced to their cycle
                suggestedProgram = 'yoga';
                workoutDayIndex = 6; // Yin yoga - gentle for menstrual phase
                personalizationReason = `✨ Cycle Sync: Automatic yoga during menstrual phase`;
            }
        }
        // If user opted out or has high energy, we don't add cycle-based messaging at all
    }

    // For males, show performance-based recommendation if no other reason
    if (isMale && !personalizationReason) {
        personalizationReason = '💪 Daily Sync: Strength, HIIT, Progressive Overload';
    }
    
    // Ensure program is available based on equipment
    if (!availablePrograms.includes(suggestedProgram)) {
        suggestedProgram = scheduleItem.fallback;
        workoutDayIndex = scheduleItem.fallbackIdx;
    }

    // DEBUG: Log final program before hero rendering
    console.log('🎯 Movement final program:', {
        suggestedProgram,
        workoutDayIndex,
        availablePrograms,
        scheduleItem,
        overrideSubcategory
    });

    // Muscle group specific images for gym splits (male users)
    let isDbzTheme = false;
    try {
        const currentTheme = localStorage.getItem('userThemePreference') || localStorage.getItem('app_theme') || localStorage.getItem('theme') || 'default';
        isDbzTheme = currentTheme && currentTheme.startsWith('dbz-');
    } catch (e) { console.error('Error checking theme', e); }

    let muscleGroupImages = {
        'back': isDbzTheme ? '/assets/dbz_back_day.png' : '/assets/back.jpg',
        'chest': isDbzTheme ? '/assets/dbz_chest_day.png' : '/assets/chest.jpg',
        'legs': isDbzTheme ? '/assets/dbz_legs_day.png' : '/assets/legs.png',
        'arms': isDbzTheme ? '/assets/dbz_arms_day.png' : '/assets/arms.jpg',
        'shoulders': isDbzTheme ? '/assets/dbz_shoulders_day.png' : '/assets/shoulders.png',
        'core': isDbzTheme ? '/assets/dbz_core_day.png' : '/assets/core.jpg',
        'armscore': isDbzTheme ? '/assets/dbz_core_day.png' : '/assets/core.jpg',    // Arms & Core uses core image
        'push': isDbzTheme ? '/assets/dbz_chest_day.png' : '/assets/chest.jpg',      // Push uses chest image
        'pull': isDbzTheme ? '/assets/dbz_back_day.png' : '/assets/back.jpg',        // Pull uses back image
        'upper': isDbzTheme ? '/assets/dbz_arms_day.png' : '/assets/arms.jpg',       // Upper body uses arms
        'lower': isDbzTheme ? '/assets/dbz_legs_day.png' : '/assets/legs.png',       // Lower body uses legs
        'fullbody': isDbzTheme ? '/assets/dbz_core_day.png' : '/assets/core.jpg'     // Full body uses core
    };

    const assets = {
        'yoga': { img: '/assets/somatic_yoga_hero.png', sub: 'Recovery', color: '#F59E0B' },
        'bodyweight': { img: '/assets/bodyweight_sculpt_hero.png', sub: 'No Equipment', color: '#ec4899' },
        'bands': { img: '/assets/band_strength_hero.png', sub: 'Resistance Bands', color: '#06b6d4' },
        'home': { img: '/assets/dumbbell_strength_hero.png', sub: 'Dumbbells', color: '#8b5cf6' },
        'gym': { img: '/assets/full_gym_hero.png', sub: 'Gym Access', color: '#10b981' },
        'gym_split': { img: '/assets/full_gym_hero.png', sub: 'Gym Access', color: '#10b981' },
        'female_gym_split': { img: '/assets/full_gym_hero.png', sub: 'Gym Access', color: '#10b981' }
    };

    // Handle gym_split programs - pull from WORKOUT_LIBRARY with 48-week rotation (same as calendar)
    let heroProg, heroMeta, heroSched;
    let heroLibraryInfo = null; // Track library workout info for onclick handler
    const wasOverriddenToYoga = suggestedProgram === 'yoga' && scheduleItem.program !== 'yoga';

    if ((suggestedProgram === 'gym_split' || suggestedProgram === 'female_gym_split') && scheduleItem.muscleGroup && typeof WORKOUT_LIBRARY !== 'undefined') {
        // Get workout from WORKOUT_LIBRARY with same 48-week rotation as calendar
        const muscleGroup = scheduleItem.muscleGroup;
        const gymCategory = WORKOUT_LIBRARY['gym'];

        if (gymCategory && gymCategory.subcategories && gymCategory.subcategories[muscleGroup]) {
            // Calculate which week in 48-week cycle (same logic as calendar)
            let startDate = localStorage.getItem('gym_split_start_date');
            if (!startDate) {
                const dayOfWeek = today.getDay();
                const distToMon = (dayOfWeek + 6) % 7;
                const monday = new Date(today);
                monday.setDate(today.getDate() - distToMon);
                monday.setHours(0, 0, 0, 0);
                startDate = getLocalDateString(monday);
                localStorage.setItem('gym_split_start_date', startDate);
            }
            const start = new Date(startDate);
            const msPerWeek = 7 * 24 * 60 * 60 * 1000;
            const weeksElapsed = Math.floor((today - start) / msPerWeek);
            const currentWeek = (weeksElapsed % 48) + 1;

            const workouts = gymCategory.subcategories[muscleGroup].workouts;
            const programNumber = Math.floor((currentWeek - 1) / 4);
            const workoutIndex = programNumber % workouts.length;
            const workout = workouts[workoutIndex];

            // Create a pseudo-program object for rendering
            heroProg = {
                name: 'Gym Split',
                estimatedTime: workout?.estimatedTime || 45
            };
            // Use muscle-specific image for male users only (these are male photos)
            const muscleImg = isMale ? muscleGroupImages[muscleGroup] : null;
            heroMeta = {
                ...assets[suggestedProgram],
                img: muscleImg || assets[suggestedProgram].img
            };
            heroSched = {
                title: workout?.name || `${muscleGroup.charAt(0).toUpperCase() + muscleGroup.slice(1)} Day`,
                exercises: workout?.exercises || []
            };
        } else {
            // Fallback to gym program if muscle group not found
            heroProg = window.WORKOUT_DB['gym'];
            heroMeta = assets['gym'];
            heroSched = heroProg.schedule[workoutDayIndex % heroProg.schedule.length];
        }
    } else if ((scheduleItem.subcategory || overrideSubcategory) && !wasOverriddenToYoga && typeof WORKOUT_LIBRARY !== 'undefined') {
        // For yoga/bodyweight/home with subcategories, use WORKOUT_LIBRARY with rotation
        // Use overrideSubcategory if set (e.g., high energy upgrade to power yoga)
        const effectiveSubcategory = overrideSubcategory || scheduleItem.subcategory;
        const category = WORKOUT_LIBRARY[suggestedProgram];
        const subcategory = category?.subcategories?.[effectiveSubcategory];

        if (subcategory && subcategory.workouts && subcategory.workouts.length > 0) {
            // Calculate which week in rotation cycle
            let startDate = localStorage.getItem('program_start_date');
            if (!startDate) {
                const dayOfWeek = today.getDay();
                const distToMon = (dayOfWeek + 6) % 7;
                const monday = new Date(today);
                monday.setDate(today.getDate() - distToMon);
                monday.setHours(0, 0, 0, 0);
                startDate = getLocalDateString(monday);
            }
            const start = new Date(startDate);
            const msPerWeek = 7 * 24 * 60 * 60 * 1000;
            const weeksElapsed = Math.floor((today - start) / msPerWeek);
            const currentWeek = (weeksElapsed % 48) + 1;

            const workouts = subcategory.workouts;
            const programNumber = Math.floor((currentWeek - 1) / 4);
            const workoutIndex = programNumber % workouts.length;
            const workout = workouts[workoutIndex];

            // Create a pseudo-program object for rendering
            heroProg = {
                name: category.name,
                estimatedTime: workout?.duration?.replace(' min', '') || 25
            };
            heroMeta = assets[suggestedProgram];
            heroSched = {
                title: workout?.name || scheduleItem.day + ' Workout',
                exercises: workout?.exercises || []
            };
            // Store library info for onclick
            heroLibraryInfo = {
                category: suggestedProgram,
                subcategory: effectiveSubcategory,
                workoutId: workout?.id
            };
        } else {
            // Fallback to WORKOUT_DB
            heroProg = window.WORKOUT_DB[suggestedProgram];
            heroMeta = assets[suggestedProgram];
            heroSched = heroProg.schedule[workoutDayIndex % heroProg.schedule.length];
        }
    } else {
        // Standard program from WORKOUT_DB
        heroProg = window.WORKOUT_DB[suggestedProgram];
        heroMeta = assets[suggestedProgram];
        heroSched = heroProg.schedule[workoutDayIndex % heroProg.schedule.length];
    }

    // Check if this is a Cycle Sync personalization
    const isCycleSync = personalizationReason && personalizationReason.startsWith('✨ Cycle Sync:');
    const isDailySync = personalizationReason && personalizationReason.startsWith('💪 Daily Sync:');
    const badgeText = isCycleSync ? '⭐ Cycle Sync' : (isDailySync ? '💪 Daily Sync' : (personalizationReason ? '✨ Personalized' : 'Best for Today'));

    // Create onclick handler based on whether we're using library workout
    const heroOnclick = heroLibraryInfo
        ? `startLibraryWorkout('${heroLibraryInfo.category}', '${heroLibraryInfo.subcategory}', '${heroLibraryInfo.workoutId}')`
        : `startActiveWorkout('${suggestedProgram}', ${workoutDayIndex})`;

    // Hero card removed - Today's Workout will be added to the grid instead
    
    // Preload saved workouts cache for the Your Workouts view
    try {
        const savedWorkouts = await dbHelpers.workouts.getCustomWorkouts(user.id);
        window.savedWorkoutsCache = savedWorkouts;
    } catch(err) {
        console.error('Failed to preload saved workouts:', err);
    }

    const gridContainer = document.getElementById('movement-grid-container');
    gridContainer.innerHTML = '';

    // Add 'Workout Duel' Card - challenge a friend (top of grid, purple)
    const duelDiv = document.createElement('div');
    duelDiv.onclick = () => { window.location.href = '/workout-duel.html'; };
    duelDiv.style.cssText = "cursor:pointer; position:relative; height:180px; border-radius:24px; overflow:hidden; box-shadow:0 8px 25px rgba(0,0,0,0.1); background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%); grid-column: span 2;";
    duelDiv.innerHTML = `
        <div style="position: absolute; inset:0; background: linear-gradient(to bottom right, rgba(0,0,0,0.1), transparent);"></div>
        <div style="position: absolute; bottom: 15px; left: 15px; color: white; z-index: 1;">
            <div style="font-size: 0.75rem; font-weight: 800; opacity: 0.9; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 5px;">Challenge Friends</div>
            <div style="font-size: 1.2rem; font-weight: 800; line-height: 1.1; margin-bottom: 8px;">Workout Duel</div>
            <div style="font-size: 0.75rem; opacity: 0.9;">Same workout, head-to-head, with video proof</div>
        </div>
        <div style="position: absolute; top: 15px; right: 15px; color: white; opacity: 0.4; font-size: 3rem;">⚔️</div>
        <div id="duel-badge" style="display:none; position:absolute; top:12px; left:12px; background:#ef4444; color:white; font-size:0.7rem; font-weight:800; padding:4px 10px; border-radius:12px; z-index:2;"></div>
    `;
    gridContainer.appendChild(duelDiv);

    // Load pending duel count badge asynchronously
    (async () => {
        try {
            const { data, error } = await window.supabaseClient.rpc('get_user_workout_duels', { p_user_id: user.id });
            if (!error && data) {
                const activeDuels = data.filter(d => ['pending', 'accepted', 'live', 'in_progress', 'proof_phase'].includes(d.status));
                const pendingInvites = data.filter(d => d.status === 'pending' && !d.is_challenger);
                const badge = document.getElementById('duel-badge');
                if (badge && activeDuels.length > 0) {
                    badge.textContent = pendingInvites.length > 0 ? `${pendingInvites.length} invite${pendingInvites.length > 1 ? 's' : ''}` : `${activeDuels.length} active`;
                    badge.style.display = 'block';
                    if (pendingInvites.length > 0) {
                        badge.style.animation = 'pulse 2s infinite';
                    }
                }
            }
        } catch(e) { /* silent - badge is enhancement only */ }
    })();

    // Add 'Today's Workout' Card as first item (red background)
    const todayDiv = document.createElement('div');
    todayDiv.onclick = () => { eval(heroOnclick); };
    todayDiv.style.cssText = "cursor:pointer; position:relative; height:180px; border-radius:24px; overflow:hidden; box-shadow:0 8px 25px rgba(0,0,0,0.1); background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);";
    todayDiv.innerHTML = `
        <div style="position: absolute; inset:0; background: linear-gradient(to bottom right, rgba(0,0,0,0.1), transparent);"></div>
        <div style="position: absolute; bottom: 15px; left: 15px; color: white; z-index: 1;">
            <div style="font-size: 0.75rem; font-weight: 800; opacity: 0.9; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 5px;">Today's Workout</div>
            <div style="font-size: 1.2rem; font-weight: 800; line-height: 1.1; margin-bottom: 8px;">${heroSched.title}</div>
            <div style="font-size: 0.75rem; opacity: 0.9;">${heroProg.estimatedTime} mins · ${heroSched.exercises.length} exercises</div>
        </div>
        <div style="position: absolute; top: 15px; right: 15px; color: white; opacity: 0.4; font-size: 3rem;">🏋️</div>
    `;
    gridContainer.appendChild(todayDiv);

    // Add 'Log Activity' Card (cardio, classes, sports)
    const logActivityDiv = document.createElement('div');
    logActivityDiv.onclick = () => openLogActivityForm();
    logActivityDiv.style.cssText = "cursor:pointer; position:relative; height:180px; border-radius:24px; overflow:hidden; box-shadow:0 8px 25px rgba(0,0,0,0.1); background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%);";
    logActivityDiv.innerHTML = `
        <div style="position: absolute; inset:0; background: linear-gradient(to bottom right, rgba(0,0,0,0.1), transparent);"></div>
        <div style="position: absolute; bottom: 15px; left: 15px; color: white; z-index: 1;">
            <div style="font-size: 0.75rem; font-weight: 800; opacity: 0.9; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 5px;">Track</div>
            <div style="font-size: 1.2rem; font-weight: 800; line-height: 1.1; margin-bottom: 8px;">Log Activity</div>
            <div style="font-size: 0.75rem; opacity: 0.9;">Classes, sports & cardio</div>
        </div>
        <div style="position: absolute; top: 15px; right: 15px; color: white; opacity: 0.4; font-size: 3rem;">🏃</div>
    `;
    gridContainer.appendChild(logActivityDiv);

    // Add 'Build Custom' Card
    const buildDiv = document.createElement('div');
    buildDiv.onclick = () => openWorkoutBuilder();
    buildDiv.style.cssText = "cursor:pointer; position:relative; height:180px; border-radius:24px; overflow:hidden; box-shadow:0 8px 25px rgba(0,0,0,0.1); background: #f1f5f9; display:flex; align-items:center; justify-content:center; flex-direction:column; text-align:center; border: 2px dashed #cbd5e1;";
    buildDiv.innerHTML = `
        <div style="width:50px; height:50px; background:white; border-radius:50%; display:flex; align-items:center; justify-content:center; margin-bottom:12px; box-shadow:0 4px 10px rgba(0,0,0,0.05);">
            <svg viewBox="0 0 24 24" style="width:24px; height:24px; fill:var(--primary);"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        </div>
        <div style="font-weight:800; color:var(--text-main); font-size:1.1rem;">Build Custom</div>
        <div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">Create your own flow</div>
    `;
    gridContainer.appendChild(buildDiv);

    // Add 'Browse Workout Library' Card as second item
    const libraryDiv = document.createElement('div');
    libraryDiv.onclick = () => openWorkoutLibrary();
    libraryDiv.style.cssText = "cursor:pointer; position:relative; height:180px; border-radius:24px; overflow:hidden; box-shadow:0 8px 25px rgba(0,0,0,0.1); background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);";
    libraryDiv.innerHTML = `
        <div style="position: absolute; inset:0; background: linear-gradient(to bottom right, rgba(0,0,0,0.2), transparent);"></div>
        <div style="position: absolute; bottom: 15px; left: 15px; color: white; z-index: 1;">
            <div style="font-size: 0.75rem; font-weight: 800; opacity: 0.9; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 5px;">Explore All</div>
            <div style="font-size: 1.2rem; font-weight: 800; line-height: 1.1; margin-bottom: 8px;">Workout Library</div>
            <div style="font-size: 0.75rem; opacity: 0.9;">100+ workouts to choose from</div>
        </div>
        <div style="position: absolute; top: 15px; right: 15px; color: white; opacity: 0.4; font-size: 3rem;">📚</div>
    `;
    gridContainer.appendChild(libraryDiv);

    // Add 'Your Workouts' Card - shows saved custom workouts
    const yourWorkoutsDiv = document.createElement('div');
    yourWorkoutsDiv.onclick = () => openYourWorkouts();
    const savedCount = window.savedWorkoutsCache?.length || 0;
    yourWorkoutsDiv.style.cssText = "cursor:pointer; position:relative; height:180px; border-radius:24px; overflow:hidden; box-shadow:0 8px 25px rgba(0,0,0,0.1); background: linear-gradient(135deg, var(--primary) 0%, #22c55e 100%);";
    yourWorkoutsDiv.innerHTML = `
        <div style="position: absolute; inset:0; background: linear-gradient(to bottom right, rgba(0,0,0,0.1), transparent);"></div>
        <div style="position: absolute; bottom: 15px; left: 15px; color: white; z-index: 1;">
            <div style="font-size: 0.75rem; font-weight: 800; opacity: 0.9; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 5px;">Your Collection</div>
            <div style="font-size: 1.2rem; font-weight: 800; line-height: 1.1; margin-bottom: 8px;">Your Workouts</div>
            <div style="font-size: 0.75rem; opacity: 0.9;">${savedCount} saved workout${savedCount !== 1 ? 's' : ''}</div>
        </div>
        <div style="position: absolute; top: 15px; right: 15px; color: white; opacity: 0.4; font-size: 3rem;">💪</div>
    `;
    gridContainer.appendChild(yourWorkoutsDiv);

    // Add 'Interval Timer' Card - stopwatch with natural language input
    const timerDiv = document.createElement('div');
    timerDiv.onclick = () => openIntervalTimer();
    timerDiv.style.cssText = "cursor:pointer; position:relative; height:180px; border-radius:24px; overflow:hidden; box-shadow:0 8px 25px rgba(0,0,0,0.1); background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);";
    timerDiv.innerHTML = `
        <div style="position: absolute; inset:0; background: linear-gradient(to bottom right, rgba(0,0,0,0.1), transparent);"></div>
        <div style="position: absolute; bottom: 15px; left: 15px; color: white; z-index: 1;">
            <div style="font-size: 0.75rem; font-weight: 800; opacity: 0.9; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 5px;">Intervals</div>
            <div style="font-size: 1.2rem; font-weight: 800; line-height: 1.1; margin-bottom: 8px;">Stopwatch</div>
            <div style="font-size: 0.75rem; opacity: 0.9;">Type "40/20 x6" and go</div>
        </div>
        <div style="position: absolute; top: 15px; right: 15px; color: white; opacity: 0.4; font-size: 3rem;">&#9201;</div>
    `;
    gridContainer.appendChild(timerDiv);

    // 'Your Progress' card removed - now on home page

    // Load workout rating insights
    loadWorkoutInsights();

    // Removed - Workout Duel card moved to top of grid

    // Removed other workout cards - users now browse via Workout Library
    // Object.keys(WORKOUT_DB).forEach(key => {
    //     if (key === suggestedProgram) return;
    //     const prog = WORKOUT_DB[key];
    //     const meta = assets[key];
    //     const sched = prog.schedule[dayIndex % prog.schedule.length];

    //     const div = document.createElement('div');
    //     div.onclick = () => startActiveWorkout(key);
    //     div.style.cssText = "cursor:pointer; position:relative; height:180px; border-radius:24px; overflow:hidden; box-shadow:0 8px 25px rgba(0,0,0,0.1);";
    //     div.innerHTML = `
    //         <img src="${meta.img}" style="width:100%; height:100%; object-fit: cover; position:absolute; inset:0;" onerror="this.src='https://placehold.co/300x200?text=${key}';">
    //         <div style="position: absolute; inset:0; background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);"></div>
    //         <div style="position: absolute; bottom: 15px; left: 15px; color: white;">
    //             <div style="font-size: 0.75rem; font-weight: 800; opacity: 0.8;">${prog.name}</div>
    //             <div style="font-size: 1.2rem; font-weight: 800; line-height: 1.1;">${sched.title}</div>
    //         </div>
    //     `;
    //     gridContainer.appendChild(div);
    // });
}

function showWorkoutOverview(id) {
    const program = WORKOUT_DB[id];
    const startDate = localStorage.getItem('pbb_start_date');
    let dayIndex = 0;
    if (startDate) {
        const start = new Date(startDate);
        const dayDiff = Math.ceil(Math.abs(new Date() - start) / (1000 * 60 * 60 * 24));
        dayIndex = (dayDiff || 1) - 1;
    }
    const workout = program.schedule[dayIndex % program.schedule.length];

    document.getElementById('overview-title').innerText = workout.title;
    document.getElementById('overview-header-title').innerText = program.name;
    document.getElementById('overview-meta').innerText = `${program.estimatedTime} mins  ${workout.exercises.length} Exercises`;
    document.getElementById('overview-instructions').innerText = program.description || '';
    
    // Equipment
    const eqCont = document.getElementById('overview-equipment');
    eqCont.innerHTML = '';
    program.equipment.forEach(e => {
        eqCont.innerHTML += `<span style="background:#f1f5f9; padding:8px 15px; border-radius:50px; font-size:0.85rem; font-weight:600; color:var(--text-main);">${e}</span>`;
    });

    // Exercises
    const exList = document.getElementById('overview-exercise-list');
    exList.innerHTML = '';
    workout.exercises.forEach(ex => {
        exList.innerHTML += `
            <div style="display:flex; align-items:center; gap:15px; margin-bottom:20px;">
                <div style="width:70px; height:70px; border-radius:12px; background:#f1f5f9; flex-shrink:0; overflow:hidden;">
                    <img src="https://placehold.co/100x100/png?text=Preview" style="width:100%; height:100%; object-fit:cover;">
                </div>
                <div style="flex:1;">
                    <div style="font-weight:700; font-size:1.05rem;">${ex.name}</div>
                    <div style="color:var(--text-muted); font-size:0.85rem;">${ex.sets} sets x ${ex.reps}</div>
                </div>
            </div>
        `;
    });

    document.getElementById('btn-start-now').onclick = () => startActiveWorkout(id);

    // Show View
    hideAllAppViews();
    document.getElementById('view-workout-overview').style.display = 'block';
    document.querySelector('.bottom-nav').style.display = 'none';

    // Push navigation state for Android back button
    pushNavigationState('view-workout-overview', () => switchAppTab('movement-tab'));
}

function hideAllAppViews() {
    const views = ['view-dashboard', 'view-meals', 'movement-tab', 'group', 'view-friends', 'sleep', 'view-workout-success', 'view-profile', 'view-workout-overview', 'view-active-workout', 'view-coach-dashboard', 'view-workout-builder', 'view-program-builder', 'view-calendar', 'view-cycle', 'view-workout-list', 'view-workout-library', 'view-workout-subcategories', 'view-prebuilt-programs', 'view-progress', 'view-your-workouts', 'view-learning', 'view-log-activity', 'view-activity-success', 'view-user-profile'];
    views.forEach(v => {
        const el = document.getElementById(v);
        if(el) {
            el.style.display = 'none';
            el.classList.remove('active');
        }
    });
}

async function startActiveWorkout(id, forcedDayIndex = null) {
    const program = WORKOUT_DB[id];

    // Clear custom workout tracking (this is a program workout, not custom)
    window.currentCustomWorkoutId = null;

    // Get correct day schedule & Preload History
    const user = window.currentUser;
    let dayIndex = 0;
    let customizations = null;

    if (forcedDayIndex !== null) {
        dayIndex = forcedDayIndex;
    } else if (user) {
        // Preload history
        try {
            const rawHistory = await dbHelpers.workouts.getHistory(user.id);
            window.workoutHistoryCache = normalizeHistoryCache(rawHistory);
        } catch(e) { console.error("Failed to load history", e); }

        const profile = await window.getUserProfile();
        const startDate = profile?.program_start_date;
        if (startDate) {
            const start = new Date(startDate);
            const dayDiff = Math.ceil(Math.abs(new Date() - start) / (1000 * 60 * 60 * 24));
            dayIndex = (dayDiff || 1) - 1;
        }
    }

    const actualDayIndex = dayIndex % program.schedule.length;
    const workout = program.schedule[actualDayIndex];

    // Store current workout key for customizations
    window.currentWorkoutKey = `${id}/${actualDayIndex}`;

    // Load workout customizations if user is logged in
    if (user) {
        try {
            customizations = await dbHelpers.workoutCustomizations.get(user.id, window.currentWorkoutKey);
            window.currentWorkoutCustomizations = customizations;
        } catch(e) {
            console.error("Failed to load customizations", e);
        }
    }

    // Build exercise list with customizations applied
    let exercises = workout.exercises.map(ex => ({...ex}));

    if (customizations) {
        // Filter out removed exercises
        const removedExercises = customizations.removed_exercises || [];
        exercises = exercises.filter(ex => !removedExercises.includes(ex.name));

        // Add user-added exercises at the end
        const addedExercises = customizations.added_exercises || [];
        exercises = exercises.concat(addedExercises.map(ex => ({
            ...ex,
            isUserAdded: true
        })));
    }

    // Preload personal bests for all exercises in this workout
    if (user) {
        try {
            const exerciseNames = exercises.map(ex => ex.name);
            window.personalBestsCache = await dbHelpers.personalBests.getForExercises(user.id, exerciseNames);
        } catch(e) { console.error("Failed to load personal bests", e); window.personalBestsCache = {}; }
    }

    document.getElementById('workout-player-title').innerText = workout.title;
    window.currentWorkoutName = workout.title;
    const exerciseCount = exercises.length;
    document.getElementById('workout-player-goal').innerText = `${program.description} · ${exerciseCount} Exercise${exerciseCount !== 1 ? 's' : ''}`;

    const list = document.getElementById('workout-exercises-list');
    list.innerHTML = '';

    exercises.forEach((ex, idx) => {
        const card = document.createElement('div');
        card.className = 'exercise-logger-card';
        card.setAttribute('data-exercise-name', ex.name);
        card.setAttribute('data-is-user-added', ex.isUserAdded || false);
        card.style.cssText = "background:white; border-radius:24px; box-shadow:0 10px 30px rgba(0,0,0,0.05); margin-bottom:25px; overflow:hidden; border:1px solid #f1f5f9;";

        const isTimeBased = ex.reps && (ex.reps.toLowerCase().includes('min') || ex.reps.toLowerCase().includes('s'));
        const previousSummary = getPreviousWorkoutSummary(ex.name);
        // Use previous session's set count if available, otherwise use prescribed sets
        const prescribedSets = ex.sets || 3;
        const numSets = previousSummary && previousSummary.setCount > 0 ? previousSummary.setCount : prescribedSets;
        let setsHtml = '';
        for(let s=1; s<=numSets; s++) {
            // Get prefill data from previous session for this set number
            const prevSet = previousSummary && previousSummary.sets[s - 1] ? previousSummary.sets[s - 1] : null;
            setsHtml += getSetRowHtml(ex.name, s, isTimeBased, prevSet);
        }

        const videoUrl = findVideoMatch(ex.name);
        const previousSummaryHtml = formatPreviousWorkoutSummary(ex.name);
        const isUserAdded = ex.isUserAdded || false;
        const escapedName = ex.name.replace(/'/g, "\\'");

        card.innerHTML = `
            <div style="padding:15px; background:#f8fafc; border-bottom:1px solid #e2e8f0;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <h3 style="margin:0; font-size:1.05rem; font-weight:700; color:var(--text-main); line-height:1.2;">${ex.name}</h3>
                            ${isUserAdded ? '<span style="background: var(--primary); color: white; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; font-weight: 600;">ADDED</span>' : ''}
                        </div>
                        <p style="margin:0; font-size:0.85rem; color:var(--text-muted); line-height:1.3;">${ex.desc || ''}</p>
                        ${previousSummaryHtml}
                    </div>
                    <button onclick="deleteExerciseFromWorkout('${escapedName}', ${isUserAdded})" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 5px; font-size: 0.8rem; font-weight: 600;">
                        <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: currentColor;">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                    </button>
                </div>
            </div>

            ${videoUrl ? `
            <div data-video-container style="position:relative; width:100%; padding-top:56.25%; background:black; cursor:pointer;" onclick="playInlineVideo(event, '${videoUrl}')">
                <video style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover;" preload="metadata" muted playsinline>
                    <source src="${videoUrl}" type="video/mp4">
                </video>
                <div class="inline-play-overlay" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); width:60px; height:60px; background:rgba(255,255,255,0.9); border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 10px rgba(0,0,0,0.3);">
                    <svg viewBox="0 0 24 24" style="width:30px; height:30px; fill:var(--primary); margin-left:3px;">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                </div>
            </div>` : ''}

            <!-- Volume Tracker -->
            <div class="volume-display" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%); border-bottom: 1px solid #fef08a;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: #ca8a04;"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
                    <span style="font-size: 0.75rem; font-weight: 700; color: #a16207; text-transform: uppercase;">Volume</span>
                </div>
                <div style="text-align: right;">
                    <div class="volume-value" style="font-size: 1rem; font-weight: 800; color: #854d0e;">0 kg</div>
                    <div class="volume-comparison" style="font-size: 0.7rem; font-weight: 600;">${previousSummary && previousSummary.totalVolume > 0 ? `<span style="color: #94a3b8;">Last: ${previousSummary.totalVolume.toLocaleString()} kg — beat it!</span>` : '<span style="color: #94a3b8;">Enter weight & reps</span>'}</div>
                </div>
                <div class="volume-progress-container" style="display: ${previousSummary && previousSummary.totalVolume > 0 ? 'block' : 'none'}; margin-top: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span class="volume-target-label" style="font-size: 0.65rem; font-weight: 600; color: #a16207;">Target: ${previousSummary && previousSummary.totalVolume > 0 ? previousSummary.totalVolume.toLocaleString() + ' kg' : '—'}</span>
                        <span class="volume-percentage" style="font-size: 0.65rem; font-weight: 700; color: #a16207;">0%</span>
                    </div>
                    <div style="height: 6px; background: #fef08a; border-radius: 3px; overflow: hidden;">
                        <div class="volume-progress-bar" style="height: 100%; width: 0%; background: #ca8a04; border-radius: 3px; transition: width 0.3s ease, background 0.3s ease;"></div>
                    </div>
                </div>
            </div>

            <div style="display:grid; grid-template-columns:40px 1fr 1fr 1fr 32px 32px; gap:8px; padding:10px 15px 0 15px; font-size:0.7rem; color:#94a3b8; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; text-align:center;">
                <div>Set</div><div>Time</div><div>Reps</div><div>Kg</div><div></div><div></div>
            </div>

            <div class="sets-list-container">
                ${setsHtml}
            </div>

            <div style="padding:15px; border-top:1px solid #f8fafc;">
                <button onclick="addWorkoutSet(this, '${escapedName}', ${isTimeBased})" style="width:100%; background:transparent; border:2px dashed #e2e8f0; color:#94a3b8; font-weight:700; font-size:0.8rem; padding:12px; border-radius:12px; cursor:pointer;">+ ADD SET</button>
            </div>
        `;
        list.appendChild(card);

        // Setup volume tracking for this card
        setupVolumeTracking(card);
    });

    hideAllAppViews();
    document.getElementById('view-active-workout').style.display = 'block';
    startWorkoutTimer();

    // Push navigation state for Android back button
    pushNavigationState('view-active-workout', () => quitWorkout());

    // Show total volume popup and tracker
    showLastVolumePopup();

    // Show workout Spotify bar if music is playing
    if (typeof syncWorkoutSpotifyBar === 'function') syncWorkoutSpotifyBar();
}

// Normalize history records from DB format to local format
// DB returns: exercise_name, workout_date, weight_kg, set_number, time_duration
// Local code expects: exercise, date, kg, set, time, reps
function normalizeHistoryCache(historyData) {
    if (!historyData || !Array.isArray(historyData)) return [];
    return historyData.map(h => {
        // If already in local format, return as-is
        if (h.exercise) return h;
        // Map DB column names to local format
        return {
            exercise: h.exercise_name || '',
            date: h.workout_date || '',
            kg: h.weight_kg || '',
            set: h.set_number || 0,
            time: h.time_duration || '',
            reps: h.reps || '',
            isDropSet: h.is_drop_set || false,
            dropSetWeights: h.drop_set_weights || '',
            dropSetReps: h.drop_set_reps || '',
            // Keep original fields too for compatibility
            exercise_name: h.exercise_name,
            workout_date: h.workout_date,
            weight_kg: h.weight_kg,
            set_number: h.set_number,
            time_duration: h.time_duration
        };
    });
}

function getPreviousStats(name, set) {
    // Use cached history from DB
    const history = window.workoutHistoryCache || [];

    // Filter history for this specific exercise
    const exerciseHistory = history.filter(h => h.exercise === name);

    if (exerciseHistory.length === 0) return 'New';

    // Reverse iterate to find most recent
    for (let i = exerciseHistory.length - 1; i >= 0; i--) {
        const h = exerciseHistory[i];
        if (h.set == set) {
             const val = h.reps || h.time;
             if (h.kg && h.kg !== '0' && h.kg !== '') return `${h.kg}kg x ${val}`;
             return `${val}`;
        }
    }
    return '-';
}

function findPreviousSetData(name) {
    // Use cached history from DB to find most recent data for this exercise
    const history = window.workoutHistoryCache || [];
    const exerciseHistory = history.filter(h => h.exercise === name);

    if (exerciseHistory.length === 0) return null;

    // Get most recent entry
    const recent = exerciseHistory[exerciseHistory.length - 1];
    const val = recent.reps || recent.time;
    if (recent.kg && recent.kg !== '0' && recent.kg !== '') {
        return `${recent.kg}kg x ${val}`;
    }
    return val ? `${val}` : null;
}

// Get full previous workout summary for an exercise (all sets from last session)
function getPreviousWorkoutSummary(exerciseName) {
    const history = window.workoutHistoryCache || [];
    const exerciseHistory = history.filter(h => h.exercise === exerciseName);

    if (exerciseHistory.length === 0) return null;

    // Group by date to find the most recent workout date for this exercise
    const dateGroups = {};
    exerciseHistory.forEach(h => {
        const date = h.date || h.workout_date;
        if (!dateGroups[date]) dateGroups[date] = [];
        dateGroups[date].push(h);
    });

    // Get the most recent date
    const dates = Object.keys(dateGroups).sort((a, b) => new Date(b) - new Date(a));
    if (dates.length === 0) return null;

    const lastDate = dates[0];
    const lastWorkoutSets = dateGroups[lastDate].sort((a, b) => (a.set || 0) - (b.set || 0));

    // Deduplicate by set number - keep only one entry per set
    const seenSets = {};
    const uniqueSets = lastWorkoutSets.filter(s => {
        const setNum = s.set || 0;
        if (seenSets[setNum]) return false;
        seenSets[setNum] = true;
        return true;
    });

    // Calculate total volume from last workout
    let totalVolume = 0;
    const sets = uniqueSets.map(s => {
        const weight = parseFloat(s.kg) || 0;
        const reps = parseFloat(s.reps) || 0;
        const setVolume = weight * reps;
        totalVolume += setVolume;
        return {
            set: s.set,
            reps: s.reps,
            kg: s.kg,
            time: s.time,
            volume: setVolume
        };
    });

    return {
        date: lastDate,
        sets: sets,
        totalVolume: totalVolume,
        setCount: sets.length
    };
}

// Get all-time max weight for an exercise
// Prefers personal_bests table (via cache), falls back to history cache
function getExerciseMaxWeight(exerciseName) {
    // Check personal bests cache first (authoritative source)
    const pbCache = window.personalBestsCache || {};
    const pb = pbCache[exerciseName];
    if (pb && pb.best_weight_kg > 0) {
        return {
            weight: parseFloat(pb.best_weight_kg),
            reps: parseInt(pb.best_weight_reps) || 0,
            date: pb.best_weight_date,
            bestReps: parseInt(pb.best_reps) || 0,
            bestRepsWeight: parseFloat(pb.best_reps_weight_kg) || 0,
            bestRepsDate: pb.best_reps_date
        };
    }

    // Fallback to history cache
    const history = window.workoutHistoryCache || [];
    const exerciseHistory = history.filter(h => h.exercise === exerciseName);

    if (exerciseHistory.length === 0) return null;

    let maxWeight = 0;
    let maxWeightReps = 0;
    let maxWeightDate = null;

    exerciseHistory.forEach(h => {
        const weight = parseFloat(h.kg) || 0;
        if (weight > maxWeight) {
            maxWeight = weight;
            maxWeightReps = parseInt(h.reps) || 0;
            maxWeightDate = h.date || h.workout_date;
        }
    });

    if (maxWeight === 0) return null;

    return {
        weight: maxWeight,
        reps: maxWeightReps,
        date: maxWeightDate
    };
}

// Calculate total volume for an exercise card
function calculateExerciseVolume(card) {
    if (!card) return 0;

    const setWrappers = card.querySelectorAll('.set-wrapper');
    let totalVolume = 0;

    setWrappers.forEach(wrapper => {
        // Skip prefilled rows the user hasn't touched yet
        if (wrapper.getAttribute('data-prefilled') === 'true') return;

        const kgInput = wrapper.querySelector('.input-kg');
        const repsInput = wrapper.querySelector('.input-reps');

        const kg = parseFloat(kgInput?.value) || 0;
        const reps = parseFloat(repsInput?.value) || 0;

        totalVolume += kg * reps;

        // Also count drop sets
        const dropContainer = wrapper.querySelector('.drop-set-container');
        if (dropContainer && dropContainer.classList.contains('visible')) {
            const dropRows = dropContainer.querySelectorAll('.drop-set-row');
            dropRows.forEach(row => {
                const dropKg = parseFloat(row.querySelector('.drop-kg')?.value) || 0;
                const dropReps = parseFloat(row.querySelector('.drop-reps')?.value) || 0;
                totalVolume += dropKg * dropReps;
            });
        }
    });

    return totalVolume;
}

// Update volume display for an exercise card
function updateVolumeDisplay(card) {
    if (!card) return;

    const volumeDisplay = card.querySelector('.volume-display');
    if (!volumeDisplay) return;

    const totalVolume = calculateExerciseVolume(card);
    const volumeValue = volumeDisplay.querySelector('.volume-value');
    const volumeComparison = volumeDisplay.querySelector('.volume-comparison');
    const progressContainer = volumeDisplay.querySelector('.volume-progress-container');
    const progressBar = volumeDisplay.querySelector('.volume-progress-bar');
    const targetLabel = volumeDisplay.querySelector('.volume-target-label');
    const percentageLabel = volumeDisplay.querySelector('.volume-percentage');

    if (volumeValue) {
        volumeValue.textContent = totalVolume.toLocaleString() + ' kg';
    }

    // Compare to previous workout if available
    const exerciseName = card.getAttribute('data-exercise-name');
    const previousSummary = getPreviousWorkoutSummary(exerciseName);

    if (previousSummary && previousSummary.totalVolume > 0) {
        const targetVolume = previousSummary.totalVolume;
        const diff = totalVolume - targetVolume;
        const pct = totalVolume > 0 ? ((totalVolume / targetVolume) * 100).toFixed(0) : 0;

        // Update progress bar
        if (progressContainer) {
            progressContainer.style.display = 'block';
            if (targetLabel) targetLabel.textContent = 'Target: ' + targetVolume.toLocaleString() + ' kg';
            if (percentageLabel) {
                percentageLabel.textContent = totalVolume > 0 ? pct + '%' : '0%';
                percentageLabel.style.color = totalVolume >= targetVolume ? '#16a34a' : '#a16207';
            }
            if (progressBar) {
                const barWidth = Math.min(pct, 100);
                progressBar.style.width = barWidth + '%';
                progressBar.style.background = totalVolume >= targetVolume ? '#22c55e' : '#ca8a04';
            }
        }

        if (volumeComparison) {
            if (totalVolume === 0) {
                volumeComparison.innerHTML = '<span style="color: #94a3b8;">Last: ' + targetVolume.toLocaleString() + ' kg — beat it!</span>';
            } else if (diff > 0) {
                volumeComparison.innerHTML = '<span style="color: #22c55e; font-weight: 700;">+' + diff.toLocaleString() + ' kg — NEW VOLUME PR!</span>';
            } else if (diff < 0) {
                const remaining = Math.abs(diff);
                volumeComparison.innerHTML = '<span style="color: #f59e0b;">' + remaining.toLocaleString() + ' kg to beat last session</span>';
            } else {
                volumeComparison.innerHTML = '<span style="color: #22c55e;">Matched last session!</span>';
            }
        }
    } else if (volumeComparison) {
        volumeComparison.innerHTML = totalVolume > 0 ? '<span style="color: #94a3b8;">First time — setting your benchmark!</span>' : '<span style="color: #94a3b8;">Enter weight & reps</span>';
        if (progressContainer) progressContainer.style.display = 'none';
    }
}

// Setup volume tracking event listeners for a card
function setupVolumeTracking(card) {
    if (!card) return;

    const inputs = card.querySelectorAll('.input-kg, .input-reps, .drop-kg, .drop-reps');
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            // Mark this set row as user-touched (no longer prefilled)
            const wrapper = input.closest('.set-wrapper');
            if (wrapper && wrapper.getAttribute('data-prefilled') === 'true') {
                wrapper.removeAttribute('data-prefilled');
            }
            updateVolumeDisplay(card);
            updateTotalWorkoutVolume();
        });
    });

    // Initial display update (will show 0 for prefilled rows)
    updateVolumeDisplay(card);
}

// Calculate total workout volume across ALL exercises
function calculateTotalWorkoutVolume() {
    let total = 0;
    const cards = document.querySelectorAll('#workout-exercises-list .exercise-logger-card');
    cards.forEach(card => {
        total += calculateExerciseVolume(card);
    });
    return total;
}

// Calculate total previous workout volume across all exercises
function calculateLastWorkoutTotalVolume() {
    let total = 0;
    const cards = document.querySelectorAll('#workout-exercises-list .exercise-logger-card');
    cards.forEach(card => {
        const name = card.getAttribute('data-exercise-name');
        if (name) {
            const prev = getPreviousWorkoutSummary(name);
            if (prev && prev.totalVolume > 0) {
                total += prev.totalVolume;
            }
        }
    });
    return total;
}

// Update the total workout volume bar display
function updateTotalWorkoutVolume() {
    const bar = document.getElementById('total-volume-bar');
    if (!bar) return;

    const currentTotal = calculateTotalWorkoutVolume();
    const lastTotal = window._lastWorkoutTotalVolume || 0;

    // Show the bar and dynamically position below header
    bar.style.display = 'block';
    const workoutView = document.getElementById('view-active-workout');
    if (workoutView) {
        const header = workoutView.firstElementChild;
        if (header && header.style.position === 'sticky') {
            bar.style.top = header.offsetHeight + 'px';
        }
    }

    // Update current volume value
    const valueEl = document.getElementById('total-volume-value');
    if (valueEl) valueEl.textContent = currentTotal.toLocaleString() + ' kg';

    // Update progress if we have a target
    const progressWrap = document.getElementById('total-volume-progress-wrap');
    const progressBar = document.getElementById('total-volume-progress-bar');
    const targetLabel = document.getElementById('total-volume-target-label');
    const diffEl = document.getElementById('total-volume-diff');

    if (lastTotal > 0) {
        if (progressWrap) progressWrap.style.display = 'block';
        if (targetLabel) targetLabel.textContent = 'Last: ' + lastTotal.toLocaleString() + ' kg';

        const pct = currentTotal > 0 ? ((currentTotal / lastTotal) * 100).toFixed(0) : 0;
        const barWidth = Math.min(pct, 100);

        if (progressBar) {
            progressBar.style.width = barWidth + '%';
            progressBar.style.background = currentTotal >= lastTotal ? '#22c55e' : '#facc15';
        }

        if (diffEl) {
            const diff = currentTotal - lastTotal;
            if (currentTotal === 0) {
                diffEl.textContent = '';
            } else if (diff > 0) {
                diffEl.textContent = '+' + diff.toLocaleString() + ' kg';
                diffEl.style.color = '#22c55e';
            } else if (diff < 0) {
                diffEl.textContent = Math.abs(diff).toLocaleString() + ' kg to go';
                diffEl.style.color = '#fbbf24';
            } else {
                diffEl.textContent = 'Matched!';
                diffEl.style.color = '#22c55e';
            }
        }
    } else {
        if (progressWrap) progressWrap.style.display = 'none';
    }
}

// Show the "last workout volume" popup
function showLastVolumePopup() {
    // Small delay to let DOM render first
    setTimeout(() => {
        const lastTotal = calculateLastWorkoutTotalVolume();
        window._lastWorkoutTotalVolume = lastTotal;

        // Always show the total volume bar
        updateTotalWorkoutVolume();

        // Only show popup if there was a previous workout with volume
        if (lastTotal > 0) {
            const popup = document.getElementById('last-volume-popup');
            const volumeEl = document.getElementById('popup-last-volume');
            if (popup && volumeEl) {
                volumeEl.textContent = lastTotal.toLocaleString() + ' kg';
                popup.style.display = 'flex';
                // Auto-dismiss after 4 seconds
                window._volumePopupTimer = setTimeout(dismissVolumePopup, 4000);
            }
        }
    }, 300);
}

// Dismiss the popup
function dismissVolumePopup() {
    const popup = document.getElementById('last-volume-popup');
    if (popup) popup.style.display = 'none';
    if (window._volumePopupTimer) {
        clearTimeout(window._volumePopupTimer);
        window._volumePopupTimer = null;
    }
}

// Format previous workout summary as HTML - Personal Best banner only
function formatPreviousWorkoutSummary(exerciseName) {
    const maxWeight = getExerciseMaxWeight(exerciseName);

    if (!maxWeight) return '';

    const prDateStr = maxWeight.date ? new Date(maxWeight.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';

    let html = '<div class="exercise-history-panel" style="margin-top: 10px;">';
    // Full-width Personal Best banner
    html += '<div style="width: 100%; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 10px 14px; border: 1px solid #fbbf24; display: flex; align-items: center; gap: 10px;">';
    // Crown icon
    html += '<svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: #d97706; flex-shrink: 0;"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/></svg>';
    // PR text
    html += '<div style="flex: 1; display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap;">';
    html += '<span style="font-size: 0.7rem; font-weight: 800; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px;">Personal Best</span>';
    html += '<span style="font-size: 1rem; font-weight: 900; color: #78350f;">' + maxWeight.weight + ' kg x ' + maxWeight.reps + ' reps</span>';
    if (maxWeight.bestReps && maxWeight.bestReps > maxWeight.reps) {
        html += '<span style="font-size: 0.7rem; color: #a16207; font-weight: 600;">(Most reps: ' + maxWeight.bestReps + ' @ ' + maxWeight.bestRepsWeight + 'kg)</span>';
    }
    html += '</div>';
    if (prDateStr) {
        html += '<span style="font-size: 0.65rem; color: #b45309; font-weight: 600; flex-shrink: 0;">' + prDateStr + '</span>';
    }
    html += '</div>';
    html += '</div>';
    return html;
}

// Generate volume display HTML with progress bar for an exercise
function getVolumeDisplayHtml(exerciseName) {
    const previousSummary = getPreviousWorkoutSummary(exerciseName);
    const targetVolume = previousSummary ? previousSummary.totalVolume : 0;
    const targetText = targetVolume > 0 ?
        '<span style="color: #94a3b8;">Last: ' + targetVolume.toLocaleString() + ' kg — beat it!</span>' :
        '<span style="color: #94a3b8;">Enter weight & reps</span>';

    let html = '<div class="volume-display" style="padding: 12px 15px; background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%); border-bottom: 1px solid #fef08a;">';
    html += '<div style="display: flex; justify-content: space-between; align-items: center;">';
    html += '<div style="display: flex; align-items: center; gap: 8px;">';
    html += '<svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: #ca8a04;"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>';
    html += '<span style="font-size: 0.75rem; font-weight: 700; color: #a16207; text-transform: uppercase;">Volume</span>';
    html += '</div>';
    html += '<div style="text-align: right;">';
    html += '<div class="volume-value" style="font-size: 1rem; font-weight: 800; color: #854d0e;">0 kg</div>';
    html += '<div class="volume-comparison" style="font-size: 0.7rem; font-weight: 600;">' + targetText + '</div>';
    html += '</div></div>';

    // Progress bar
    html += '<div class="volume-progress-container" style="display: ' + (targetVolume > 0 ? 'block' : 'none') + '; margin-top: 8px;">';
    html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">';
    html += '<span class="volume-target-label" style="font-size: 0.65rem; font-weight: 600; color: #a16207;">Target: ' + (targetVolume > 0 ? targetVolume.toLocaleString() + ' kg' : '—') + '</span>';
    html += '<span class="volume-percentage" style="font-size: 0.65rem; font-weight: 700; color: #a16207;">0%</span>';
    html += '</div>';
    html += '<div style="height: 6px; background: #fef08a; border-radius: 3px; overflow: hidden;">';
    html += '<div class="volume-progress-bar" style="height: 100%; width: 0%; background: #ca8a04; border-radius: 3px; transition: width 0.3s ease, background 0.3s ease;"></div>';
    html += '</div></div></div>';

    return html;
}

function getSetRowHtml(exName, setNum, isTimeBased, prefillData) {
    // prefillData: optional {kg, reps, time} from previous session
    const prefillKg = prefillData && prefillData.kg && prefillData.kg !== '0' && prefillData.kg !== '' ? prefillData.kg : '';
    const prefillReps = prefillData && prefillData.reps ? prefillData.reps : '';
    const prefillTime = prefillData && prefillData.time ? prefillData.time : '';
    const hasPrefill = prefillKg || prefillReps || prefillTime;
    return `
        <div class="set-wrapper"${hasPrefill ? ' data-prefilled="true"' : ''}>
            <div class="workout-set-row" style="display:grid; grid-template-columns:40px 1fr 1fr 1fr 32px 32px; gap:8px; align-items:center; padding:10px 15px; border-top:1px solid #f8fafc;">
                <div class="set-number" style="font-weight:800; color:#94a3b8; font-size:0.85rem; text-align:center;">${setNum}</div>
                <div style="position:relative;">
                    <input type="text" class="input-time" placeholder="-" value="${prefillTime}" style="width:100%; border:none; background:#f8fafc; border-radius:8px; padding:10px 5px; text-align:center; font-weight:700; color:var(--text-main); font-size:0.9rem;">
                    ${isTimeBased ? '<svg viewBox="0 0 24 24" style="position:absolute; left:4px; top:50%; transform:translateY(-50%); width:12px; height:12px; fill:#94a3b8;"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>' : ''}
                </div>
                <input type="text" class="input-reps" placeholder="Reps" value="${prefillReps}" style="width:100%; border:none; background:#f8fafc; border-radius:8px; padding:10px 5px; text-align:center; font-weight:700; color:var(--text-main); font-size:0.9rem;">
                <input type="text" class="input-kg" placeholder="Kg" value="${prefillKg}" style="width:100%; border:none; background:#f8fafc; border-radius:8px; padding:10px 5px; text-align:center; font-weight:700; color:var(--text-main); font-size:0.9rem;">
                <button class="drop-set-toggle" onclick="toggleDropSet(this)" title="Toggle Drop Set">DS</button>
                <button class="delete-set-btn" onclick="deleteSetRow(this)" title="Delete Set" style="width:32px; height:32px; border:none; background:transparent; color:#ef4444; cursor:pointer; border-radius:8px; display:flex; align-items:center; justify-content:center; transition:background 0.2s;">
                    <svg viewBox="0 0 24 24" style="width:16px; height:16px; fill:currentColor;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </button>
            </div>
            <div class="drop-set-container">
                <div class="drop-set-inputs">
                    <div class="drop-set-row">
                        <div class="drop-indicator">↓1</div>
                        <input type="text" class="drop-reps" placeholder="Reps">
                        <input type="text" class="drop-kg" placeholder="Kg">
                        <button class="drop-add-btn" onclick="addDropRow(this)">+</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function addWorkoutSet(btn, exName, isTimeBased) {
    // Navigate up to the card container
    // Structure: Button -> Div (padding wrapper) -> Card
    const card = btn.closest('.exercise-logger-card');

    if (!card) {
        console.error("Could not find .exercise-logger-card");
        return;
    }

    // Find the sets container within this card
    const container = card.querySelector('.sets-list-container');

    if (!container) {
        console.error("Could not find .sets-list-container");
        return;
    }

    const setNum = container.children.length + 1;

    // Create new div wrapper (since getSetRowHtml returns a string)
    const div = document.createElement('div');
    div.innerHTML = getSetRowHtml(exName, setNum, isTimeBased).trim();

    // Optional: Add simple animation
    const newRow = div.firstElementChild;
    newRow.style.opacity = '0';
    newRow.style.transform = 'translateY(-10px)';
    newRow.style.transition = 'all 0.3s ease';

    container.appendChild(newRow);

    // Add volume tracking for the new inputs
    const inputs = newRow.querySelectorAll('.input-kg, .input-reps, .drop-kg, .drop-reps');
    inputs.forEach(input => {
        input.addEventListener('input', () => { const w = input.closest('.set-wrapper'); if (w) w.removeAttribute('data-prefilled'); updateVolumeDisplay(card); updateTotalWorkoutVolume(); });
    });

    // Trigger reflow for animation
    requestAnimationFrame(() => {
        newRow.style.opacity = '1';
        newRow.style.transform = 'translateY(0)';
    });
}

function deleteSetRow(btn) {
    const wrapper = btn.closest('.set-wrapper');
    const container = wrapper.closest('.sets-list-container');
    const card = wrapper.closest('.exercise-logger-card');

    if (!container) {
        console.error("Could not find .sets-list-container");
        return;
    }

    // Don't allow deleting if only one set remains
    const allSets = container.querySelectorAll('.set-wrapper');
    if (allSets.length <= 1) {
        return;
    }

    // Animate out
    wrapper.style.opacity = '0';
    wrapper.style.transform = 'translateY(-10px)';
    wrapper.style.transition = 'all 0.2s ease';

    setTimeout(() => {
        wrapper.remove();

        // Renumber remaining sets
        const remainingSets = container.querySelectorAll('.set-wrapper');
        remainingSets.forEach((setWrapper, idx) => {
            const setNumEl = setWrapper.querySelector('.set-number');
            if (setNumEl) {
                setNumEl.textContent = idx + 1;
            }
        });

        // Recalculate volume after set deletion
        if (card) {
            updateVolumeDisplay(card);
            updateTotalWorkoutVolume();
        }
    }, 200);
}

// Drop Set Functions
function toggleDropSet(btn) {
    const wrapper = btn.closest('.set-wrapper');
    const container = wrapper.querySelector('.drop-set-container');
    const card = wrapper.closest('.exercise-logger-card');

    btn.classList.toggle('active');
    container.classList.toggle('visible');

    // Focus on first input when opening
    if (container.classList.contains('visible')) {
        const firstInput = container.querySelector('.drop-reps');
        if (firstInput) firstInput.focus();

        // Setup volume tracking for drop set inputs
        const dropInputs = container.querySelectorAll('.drop-kg, .drop-reps');
        dropInputs.forEach(input => {
            if (!input.hasAttribute('data-volume-tracked')) {
                input.setAttribute('data-volume-tracked', 'true');
                input.addEventListener('input', () => { const w = input.closest('.set-wrapper'); if (w) w.removeAttribute('data-prefilled'); updateVolumeDisplay(card); updateTotalWorkoutVolume(); });
            }
        });
    }

    // Recalculate volume when drop sets are toggled
    if (card) {
        updateVolumeDisplay(card);
    }
}

function addDropRow(btn) {
    const inputsContainer = btn.closest('.drop-set-inputs');
    const currentRows = inputsContainer.querySelectorAll('.drop-set-row');
    const dropNum = currentRows.length + 1;
    const card = btn.closest('.exercise-logger-card');

    // Change current row's + button to - button
    btn.className = 'drop-remove-btn';
    btn.textContent = '-';
    btn.onclick = function() { removeDropRow(this); };

    // Add new row
    const newRow = document.createElement('div');
    newRow.className = 'drop-set-row';
    newRow.innerHTML = `
        <div class="drop-indicator">↓${dropNum}</div>
        <input type="text" class="drop-reps" placeholder="Reps">
        <input type="text" class="drop-kg" placeholder="Kg">
        <button class="drop-add-btn" onclick="addDropRow(this)">+</button>
    `;
    newRow.style.opacity = '0';
    newRow.style.transform = 'translateY(-5px)';
    newRow.style.transition = 'all 0.2s ease';

    inputsContainer.appendChild(newRow);

    // Add volume tracking for new inputs
    const dropInputs = newRow.querySelectorAll('.drop-kg, .drop-reps');
    dropInputs.forEach(input => {
        input.setAttribute('data-volume-tracked', 'true');
        input.addEventListener('input', () => { const w = input.closest('.set-wrapper'); if (w) w.removeAttribute('data-prefilled'); updateVolumeDisplay(card); updateTotalWorkoutVolume(); });
    });

    // Animate in
    requestAnimationFrame(() => {
        newRow.style.opacity = '1';
        newRow.style.transform = 'translateY(0)';
    });

    // Focus new input
    newRow.querySelector('.drop-reps').focus();
}

function removeDropRow(btn) {
    const row = btn.closest('.drop-set-row');
    const inputsContainer = row.parentElement;
    const card = btn.closest('.exercise-logger-card');

    // Animate out
    row.style.opacity = '0';
    row.style.transform = 'translateY(-5px)';

    setTimeout(() => {
        row.remove();

        // Renumber remaining drop indicators
        const rows = inputsContainer.querySelectorAll('.drop-set-row');
        rows.forEach((r, idx) => {
            r.querySelector('.drop-indicator').textContent = `↓${idx + 1}`;
        });

        // If last row, change its button back to +
        if (rows.length > 0) {
            const lastRow = rows[rows.length - 1];
            const lastBtn = lastRow.querySelector('.drop-remove-btn, .drop-add-btn');
            if (lastBtn && lastBtn.classList.contains('drop-remove-btn')) {
                lastBtn.className = 'drop-add-btn';
                lastBtn.textContent = '+';
                lastBtn.onclick = function() { addDropRow(this); };
            }
        }

        // Recalculate volume after drop row removal
        if (card) {
            updateVolumeDisplay(card);
        }
    }, 200);
}

let workoutTimerInterval;
let workoutStartTime = null; // Store actual start timestamp for accurate timing

function startWorkoutTimer() {
    workoutStartTime = Date.now(); // Record when workout actually started
    const display = document.getElementById('workout-timer');
    clearInterval(workoutTimerInterval);

    function updateTimer() {
        if (!workoutStartTime) return;
        // Calculate actual elapsed time from start timestamp
        const elapsed = Math.floor((Date.now() - workoutStartTime) / 1000);
        const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const s = (elapsed % 60).toString().padStart(2, '0');
        display.innerText = `${m}:${s}`;
    }

    // Update immediately, then every second
    updateTimer();
    workoutTimerInterval = setInterval(updateTimer, 1000);

    // Start auto-save system to prevent data loss
    startWorkoutAutoSave();
    setupWorkoutInputListeners();
}

// Update timer when app becomes visible again (handles background/screen-off throttling)
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible' && workoutStartTime) {
        // Force update the timer display when returning from background
        const display = document.getElementById('workout-timer');
        if (display) {
            const elapsed = Math.floor((Date.now() - workoutStartTime) / 1000);
            const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const s = (elapsed % 60).toString().padStart(2, '0');
            display.innerText = `${m}:${s}`;
        }
    }
});

// ===========================================
// WORKOUT BACKUP & RECOVERY SYSTEM
// Prevents data loss when save fails
// ===========================================

const WORKOUT_BACKUP_KEY = 'pbb_workout_backup';
let workoutAutoSaveInterval = null;

// Collect all workout data from the DOM
function collectWorkoutData() {
    const activeWorkout = document.getElementById('workout-exercises-list');
    if (!activeWorkout) return null;

    const date = getLocalDateString(new Date());
    const setsData = [];

    Array.from(activeWorkout.children).forEach(card => {
        let name = card.getAttribute('data-exercise-name');
        if (!name) {
            const nameEl = card.querySelector('h3') || card.querySelector('div[style*="font-weight: 700"]');
            if (!nameEl) return;
            name = nameEl.innerText;
        }
        if (!name) return;

        const container = card.querySelector('.sets-list-container');
        if (!container) return;

        const setWrappers = container.querySelectorAll('.set-wrapper');
        const setElements = setWrappers.length > 0
            ? Array.from(setWrappers)
            : Array.from(container.querySelectorAll('.workout-set-row'));

        setElements.forEach((element, rIdx) => {
            const isWrapper = element.classList.contains('set-wrapper');
            const row = isWrapper ? element.querySelector('.workout-set-row') : element;
            if (!row) return;

            const time = row.querySelector('.input-time')?.value || '';
            const reps = row.querySelector('.input-reps')?.value || '';
            const kg = row.querySelector('.input-kg')?.value || '';

            const dropSetToggle = row.querySelector('.drop-set-toggle');
            const isDropSet = dropSetToggle && dropSetToggle.classList.contains('active');

            let dropSetWeights = '';
            let dropSetReps = '';

            if (isDropSet && isWrapper) {
                const dropContainer = element.querySelector('.drop-set-container');
                if (dropContainer) {
                    const dropRows = dropContainer.querySelectorAll('.drop-set-row');
                    const weights = [];
                    const repsArr = [];

                    dropRows.forEach(dropRow => {
                        const dropKg = dropRow.querySelector('.drop-kg')?.value || '';
                        const dropRep = dropRow.querySelector('.drop-reps')?.value || '';
                        if (dropKg || dropRep) {
                            weights.push(dropKg);
                            repsArr.push(dropRep);
                        }
                    });

                    if (weights.length > 0) {
                        dropSetWeights = weights.join(',');
                        dropSetReps = repsArr.join(',');
                    }
                }
            }

            if (time || reps || kg || dropSetWeights) {
                setsData.push({
                    date,
                    exercise: name,
                    set: rIdx + 1,
                    reps,
                    time,
                    kg,
                    isDropSet,
                    dropSetWeights,
                    dropSetReps
                });
            }
        });
    });

    return setsData;
}

// Save workout data to localStorage
function backupWorkoutData() {
    if (!workoutStartTime) return; // No active workout

    const setsData = collectWorkoutData();
    if (!setsData || setsData.length === 0) return;

    const backup = {
        timestamp: Date.now(),
        workoutStartTime: workoutStartTime,
        workoutName: window.currentWorkoutName || 'Workout',
        customWorkoutId: window.currentCustomWorkoutId || null,
        duration: document.getElementById('workout-timer')?.innerText || '00:00',
        sets: setsData
    };

    try {
        localStorage.setItem(WORKOUT_BACKUP_KEY, JSON.stringify(backup));
        console.log('💾 Workout auto-saved:', setsData.length, 'sets');
    } catch (e) {
        console.error('Failed to backup workout:', e);
    }
}

// Clear backup after successful save
function clearWorkoutBackup() {
    try {
        localStorage.removeItem(WORKOUT_BACKUP_KEY);
        console.log('🗑️ Workout backup cleared');
    } catch (e) {
        console.error('Failed to clear workout backup:', e);
    }
}

// Get any stored backup
function getWorkoutBackup() {
    try {
        const backup = localStorage.getItem(WORKOUT_BACKUP_KEY);
        if (!backup) return null;
        return JSON.parse(backup);
    } catch (e) {
        console.error('Failed to read workout backup:', e);
        return null;
    }
}

// Start auto-save interval when workout begins
function startWorkoutAutoSave() {
    // Clear any existing interval
    if (workoutAutoSaveInterval) {
        clearInterval(workoutAutoSaveInterval);
    }

    // Auto-save every 30 seconds
    workoutAutoSaveInterval = setInterval(() => {
        backupWorkoutData();
    }, 30000);

    // Also save immediately when workout starts
    setTimeout(backupWorkoutData, 1000);

    console.log('📝 Workout auto-save enabled');
}

// Stop auto-save when workout ends
function stopWorkoutAutoSave() {
    if (workoutAutoSaveInterval) {
        clearInterval(workoutAutoSaveInterval);
        workoutAutoSaveInterval = null;
    }
}

// Add event listeners to save on input change (with debounce)
let saveDebounceTimer = null;
function setupWorkoutInputListeners() {
    const container = document.getElementById('workout-exercises-list');
    if (!container) return;

    // Use event delegation for all inputs
    container.addEventListener('input', function(e) {
        if (e.target.matches('.input-time, .input-reps, .input-kg, .drop-kg, .drop-reps')) {
            // Debounce saves to avoid excessive writes
            clearTimeout(saveDebounceTimer);
            saveDebounceTimer = setTimeout(backupWorkoutData, 2000);
        }
    });
}

// Retry save with exponential backoff
async function saveWorkoutWithRetry(setsToSave, userId, maxRetries = 3) {
    let remaining = [...setsToSave];
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const results = await Promise.allSettled(
            remaining.map(s => dbHelpers.workouts.createHistory(userId, s))
        );

        // Only keep the sets that failed
        const failed = [];
        results.forEach((result, idx) => {
            if (result.status === 'rejected') {
                failed.push(remaining[idx]);
                lastError = result.reason;
            }
        });

        if (failed.length === 0) return true; // All succeeded

        remaining = failed;
        console.error(`Save attempt ${attempt + 1}: ${failed.length}/${remaining.length + (results.length - failed.length)} sets failed`, lastError);

        if (attempt < maxRetries) {
            // Exponential backoff: 1s, 2s, 4s
            const delay = Math.pow(2, attempt) * 1000;
            console.log(`Retrying ${remaining.length} failed sets in ${delay/1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError || new Error('Failed to save ' + remaining.length + ' sets');
}

// Check for unsaved workout on page load
function checkForUnsavedWorkout() {
    const backup = getWorkoutBackup();
    if (!backup || !backup.sets || backup.sets.length === 0) return;

    // Check if backup is less than 24 hours old
    const hoursSinceBackup = (Date.now() - backup.timestamp) / (1000 * 60 * 60);
    if (hoursSinceBackup > 24) {
        clearWorkoutBackup();
        return;
    }

    // Show recovery dialog
    const minutesAgo = Math.floor((Date.now() - backup.timestamp) / (1000 * 60));
    const timeAgo = minutesAgo < 60
        ? `${minutesAgo} minute${minutesAgo !== 1 ? 's' : ''} ago`
        : `${Math.floor(minutesAgo / 60)} hour${Math.floor(minutesAgo / 60) !== 1 ? 's' : ''} ago`;

    showWorkoutRecoveryDialog(backup, timeAgo);
}

// Show recovery dialog to user
function showWorkoutRecoveryDialog(backup, timeAgo) {
    const exerciseCount = new Set(backup.sets.map(s => s.exercise)).size;
    const setCount = backup.sets.length;

    const dialog = document.createElement('div');
    dialog.id = 'workout-recovery-dialog';
    dialog.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.7); z-index: 999999;
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
    `;

    dialog.innerHTML = `
        <div style="background: white; border-radius: 20px; padding: 25px; max-width: 340px; width: 100%; text-align: center;">
            <div style="font-size: 3rem; margin-bottom: 15px;">💪</div>
            <h3 style="margin: 0 0 10px 0; color: var(--text-main); font-size: 1.2rem;">Unsaved Workout Found</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 20px;">
                You have an unsaved workout from ${timeAgo}<br>
                <strong>${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''}, ${setCount} set${setCount !== 1 ? 's' : ''}</strong>
            </p>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button onclick="recoverWorkout()" style="background: var(--primary); color: white; border: none; padding: 14px 20px; border-radius: 12px; font-weight: 700; font-size: 1rem; cursor: pointer;">
                    Recover & Save Workout
                </button>
                <button onclick="dismissWorkoutRecovery()" style="background: #f1f5f9; color: var(--text-muted); border: none; padding: 12px 20px; border-radius: 12px; font-weight: 600; font-size: 0.9rem; cursor: pointer;">
                    Discard
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);
}

// Recover and save the backed-up workout
async function recoverWorkout() {
    const dialog = document.getElementById('workout-recovery-dialog');
    if (dialog) dialog.remove();

    const backup = getWorkoutBackup();
    if (!backup || !backup.sets || backup.sets.length === 0) {
        alert('No workout data to recover.');
        return;
    }

    const user = window.currentUser;
    if (!user) {
        alert('Please log in to save your workout.');
        return;
    }

    // Show saving indicator
    const savingDialog = document.createElement('div');
    savingDialog.id = 'workout-saving-dialog';
    savingDialog.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.7); z-index: 999999;
        display: flex; align-items: center; justify-content: center;
    `;
    savingDialog.innerHTML = `
        <div style="background: white; border-radius: 20px; padding: 30px; text-align: center;">
            <div style="font-size: 2rem; margin-bottom: 10px;">💾</div>
            <p style="margin: 0; color: var(--text-main); font-weight: 600;">Saving workout...</p>
        </div>
    `;
    document.body.appendChild(savingDialog);

    try {
        await saveWorkoutWithRetry(backup.sets, user.id);
        console.log('✅ Recovered workout saved successfully');

        // Also check for personal bests and milestones
        try {
            const [milestones, newPBs] = await Promise.all([
                dbHelpers.milestones.checkAndRecordMilestones(user.id),
                dbHelpers.personalBests.checkAndUpdatePBs(user.id, backup.sets)
            ]);

            // Award points for any PBs
            if (newPBs && newPBs.length > 0) {
                for (const pb of newPBs) {
                    const pbRefId = `pb_${pb.exercise}_${pb.type}_${Date.now()}`;
                    await awardPointsForPersonalBest(pbRefId, pb);
                }
            }
        } catch (progressError) {
            console.error('Error checking progress for recovered workout:', progressError);
        }

        clearWorkoutBackup();
        savingDialog.remove();
        alert('Workout recovered and saved successfully! 🎉');
    } catch (e) {
        console.error('Failed to save recovered workout:', e);
        savingDialog.remove();
        alert('Failed to save workout. Your data is still backed up - please try again later or check your connection.');
    }
}

// Dismiss recovery dialog and clear backup
function dismissWorkoutRecovery() {
    const dialog = document.getElementById('workout-recovery-dialog');
    if (dialog) dialog.remove();
    clearWorkoutBackup();
}

// Initialize recovery check when user is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for user to be loaded
    setTimeout(() => {
        if (window.currentUser) {
            checkForUnsavedWorkout();
        }
    }, 2000);
});

// Backup workout data when page goes to background or before unload
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden' && workoutStartTime) {
        backupWorkoutData();
        console.log('📱 Workout backed up (app went to background)');
    }
});

window.addEventListener('beforeunload', function() {
    if (workoutStartTime) {
        backupWorkoutData();
        console.log('📱 Workout backed up (page unloading)');
    }
});

// Also backup when page loses focus (user might close browser)
window.addEventListener('pagehide', function() {
    if (workoutStartTime) {
        backupWorkoutData();
    }
});

// ===========================================
// END WORKOUT BACKUP & RECOVERY SYSTEM
// ===========================================

async function finishWorkout() {
    clearInterval(workoutTimerInterval);
    clearAllYogaTimers(); // Clear any running yoga timers
    stopWorkoutAutoSave(); // Stop auto-save interval

    // Hide workout Spotify bar
    const wsBar = document.getElementById('workout-spotify-bar');
    if (wsBar) wsBar.style.display = 'none';

    const timerEl = document.getElementById('workout-timer');
    const duration = timerEl ? timerEl.innerText : '0:00';
    const successDurationEl = document.getElementById('success-duration');
    if (successDurationEl) successDurationEl.innerText = duration;

    // Backup workout data before attempting save (in case of failure)
    backupWorkoutData();

    // Save logic
    const activeWorkout = document.getElementById('workout-exercises-list');
    const date = getLocalDateString(new Date());
    const setsToSave = [];

    if(activeWorkout) {
        Array.from(activeWorkout.children).forEach(card => {
            // Get exercise name from data attribute first, fallback to h3 or first styled div
            let name = card.getAttribute('data-exercise-name');
            if (!name) {
                const nameEl = card.querySelector('h3') || card.querySelector('div[style*="font-weight: 700"]');
                if(!nameEl) return;
                name = nameEl.innerText;
            }
            if (!name) return;

            const container = card.querySelector('.sets-list-container');
            if(!container) return;

            // Query set wrappers (new style with drop set support) or fall back to workout-set-row (old style)
            const setWrappers = container.querySelectorAll('.set-wrapper');
            const setElements = setWrappers.length > 0
                ? Array.from(setWrappers)
                : Array.from(container.querySelectorAll('.workout-set-row'));

            setElements.forEach((element, rIdx) => {
                // Handle both wrapper-style and direct row-style
                const isWrapper = element.classList.contains('set-wrapper');
                const row = isWrapper ? element.querySelector('.workout-set-row') : element;
                if (!row) return;

                const time = row.querySelector('.input-time')?.value || '';
                const reps = row.querySelector('.input-reps')?.value || '';
                const kg = row.querySelector('.input-kg')?.value || '';

                // Check if this is a drop set (only possible with wrapper style)
                const dropSetToggle = row.querySelector('.drop-set-toggle');
                const isDropSet = dropSetToggle && dropSetToggle.classList.contains('active');

                // Collect drop set data if active
                let dropSetWeights = '';
                let dropSetReps = '';

                if (isDropSet && isWrapper) {
                    const dropContainer = element.querySelector('.drop-set-container');
                    if (dropContainer) {
                        const dropRows = dropContainer.querySelectorAll('.drop-set-row');
                        const weights = [];
                        const repsArr = [];

                        dropRows.forEach(dropRow => {
                            const dropKg = dropRow.querySelector('.drop-kg')?.value || '';
                            const dropRep = dropRow.querySelector('.drop-reps')?.value || '';
                            if (dropKg || dropRep) {
                                weights.push(dropKg);
                                repsArr.push(dropRep);
                            }
                        });

                        if (weights.length > 0) {
                            dropSetWeights = weights.join(',');
                            dropSetReps = repsArr.join(',');
                        }
                    }
                }

                // Only save if at least one field is filled
                if (time || reps || kg || dropSetWeights) {
                    setsToSave.push({
                        date,
                        exercise: name,
                        set: rIdx + 1,
                        reps: reps,
                        time: time,
                        kg: kg,
                        isDropSet: isDropSet,
                        dropSetWeights: dropSetWeights,
                        dropSetReps: dropSetReps
                    });
                }
            });
        });
    }

    try {
        const user = window.currentUser;
        if(user && setsToSave.length > 0) {
             // Save workout data with retry logic to handle network issues
             await saveWorkoutWithRetry(setsToSave, user.id);
             console.log("✅ Workout saved to DB");

             // Clear backup after successful save
             clearWorkoutBackup();
             workoutStartTime = null; // Reset start time

             // Update custom workout template with any added exercises
             if (window.currentCustomWorkoutId) {
                 try {
                     // Collect all exercise names from the DOM (includes added exercises)
                     const allExercises = [];
                     const exerciseCards = document.querySelectorAll('#workout-exercises-list .exercise-logger-card');
                     exerciseCards.forEach(card => {
                         const name = card.getAttribute('data-exercise-name');
                         if (name && !allExercises.includes(name)) {
                             allExercises.push(name);
                         }
                     });

                     // Update the custom workout template with all exercises
                     if (allExercises.length > 0) {
                         await dbHelpers.workouts.updateCustomWorkout(window.currentCustomWorkoutId, {
                             exercises: allExercises,
                             date: new Date().toISOString(),
                             lastUsed: new Date().toISOString()
                         });
                         console.log("✅ Custom workout template updated with exercises:", allExercises);

                         // Refresh the cache
                         const savedWorkouts = await dbHelpers.workouts.getCustomWorkouts(user.id);
                         window.savedWorkoutsCache = savedWorkouts;
                     }
                 } catch (updateError) {
                     console.error("Error updating custom workout template:", updateError);
                 }
             }

             // Update cache if it exists
             if (window.workoutHistoryCache) {
                 window.workoutHistoryCache.push(...setsToSave);
             }

             // Check for improvements, milestones, and personal bests
             try {
                 const [improvements, milestones, newPBs] = await Promise.all([
                     dbHelpers.workouts.getWorkoutImprovements(user.id, setsToSave),
                     dbHelpers.milestones.checkAndRecordMilestones(user.id),
                     dbHelpers.personalBests.checkAndUpdatePBs(user.id, setsToSave)
                 ]);

                 // Log any new personal bests and award points
                 if (newPBs && newPBs.length > 0) {
                     console.log("🏆 New Personal Bests:", newPBs);

                     // Award 1 point per personal best
                     try {
                         for (const pb of newPBs) {
                             const pbRefId = `pb_${pb.exercise}_${pb.type}_${Date.now()}`;
                             await awardPointsForPersonalBest(pbRefId, pb);
                         }
                     } catch (pbPointsError) {
                         console.error("Error awarding PB points:", pbPointsError);
                     }
                 }

                 // Check for total workout volume PR and award XP
                 try {
                     const lastTotalVolume = window._lastWorkoutTotalVolume || 0;
                     if (lastTotalVolume > 0) {
                         // Calculate current total workout volume from saved sets
                         let currentTotalVolume = 0;
                         setsToSave.forEach(s => {
                             const kg = parseFloat(s.weight_kg) || 0;
                             const reps = parseFloat(s.reps) || 0;
                             currentTotalVolume += kg * reps;
                         });

                         if (currentTotalVolume > lastTotalVolume) {
                             const volumeImprovement = currentTotalVolume - lastTotalVolume;
                             const workoutName = window.currentWorkoutName || 'Workout';
                             const volRefId = `pb_volume_${workoutName.replace(/\s+/g, '_')}_${Date.now()}`;
                             await awardPointsForPersonalBest(volRefId, {
                                 exercise: workoutName,
                                 type: 'volume',
                                 value: Math.round(currentTotalVolume),
                                 improvement: Math.round(volumeImprovement)
                             });
                             console.log(`🏆 Volume PR! ${Math.round(currentTotalVolume)} kg (was ${Math.round(lastTotalVolume)} kg, +${Math.round(volumeImprovement)} kg)`);
                         }
                     }
                 } catch (volPbError) {
                     console.error("Error checking volume PR:", volPbError);
                 }

                 // Additional points can be earned by sharing workout (story or group chat)

                 // Update avatar fitness state after workout
                 try {
                     if (window.dashboardAvatar) {
                         await window.dashboardAvatar.updateFitness(user.id, true);
                         console.log("Avatar fitness updated after workout");
                     }
                 } catch(avatarError) {
                     console.error("Error updating avatar (workout still saved):", avatarError);
                 }

                 // Check badges after workout
                 try {
                     if (typeof checkWorkoutBadges === 'function') checkWorkoutBadges();
                     if (newPBs && newPBs.length > 0 && typeof checkPBBadges === 'function') checkPBBadges();
                     const sEl = document.getElementById('tamagotchi-streak');
                     if (sEl && typeof checkStreakBadges === 'function') checkStreakBadges(parseInt(sEl.textContent) || 0);
                 } catch(badgeErr) { console.error('Badge check error:', badgeErr); }

                 // Display success screen with progress data (include newPBs)
                 await showWorkoutSuccessScreen(duration, improvements, milestones, setsToSave, newPBs);
             } catch(progressError) {
                 console.error("Error calculating progress:", progressError);
                 // Still show success screen, just without progress data
                 await showWorkoutSuccessScreen(duration, [], [], setsToSave);
             }
        } else {
            // Still set workout data for sharing even with no sets
            completedWorkoutDataForShare = {
                duration: duration,
                improvements: [],
                milestones: [],
                newPBs: [],
                workoutName: window.currentWorkoutName || 'Workout',
                sets: []
            };
            hideAllAppViews();
            document.getElementById('view-workout-success').style.display = 'flex';
            // Push navigation state for Android back button
            pushNavigationState('view-workout-success', () => closeSuccessScreen());
        }
    } catch(e) {
        console.error("Failed to save workout to DB:", e);
        // Show user-friendly error dialog with retry option
        const setCount = setsToSave.length;
        const exerciseCount = new Set(setsToSave.map(s => s.exercise)).size;
        showWorkoutSaveErrorDialog(exerciseCount, setCount);
        return;
    }
}

// Show error dialog with retry option when workout save fails
function showWorkoutSaveErrorDialog(exerciseCount, setCount) {
    const dialog = document.createElement('div');
    dialog.id = 'workout-save-error-dialog';
    dialog.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.7); z-index: 999999;
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
    `;

    dialog.innerHTML = `
        <div style="background: white; border-radius: 20px; padding: 25px; max-width: 340px; width: 100%; text-align: center;">
            <div style="font-size: 3rem; margin-bottom: 15px;">⚠️</div>
            <h3 style="margin: 0 0 10px 0; color: var(--text-main); font-size: 1.2rem;">Save Failed</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 8px;">
                Couldn't save your workout after multiple attempts.
            </p>
            <p style="color: var(--primary); font-size: 0.85rem; margin-bottom: 20px; font-weight: 600;">
                Don't worry - your data is backed up!<br>
                (${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''}, ${setCount} set${setCount !== 1 ? 's' : ''})
            </p>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button onclick="retryWorkoutSave()" style="background: var(--primary); color: white; border: none; padding: 14px 20px; border-radius: 12px; font-weight: 700; font-size: 1rem; cursor: pointer;">
                    Try Again
                </button>
                <button onclick="closeWorkoutSaveErrorDialog()" style="background: #f1f5f9; color: var(--text-muted); border: none; padding: 12px 20px; border-radius: 12px; font-weight: 600; font-size: 0.9rem; cursor: pointer;">
                    Keep Workout Open
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);
}

// Close the error dialog and stay on workout screen
function closeWorkoutSaveErrorDialog() {
    const dialog = document.getElementById('workout-save-error-dialog');
    if (dialog) dialog.remove();

    // Restart auto-save since workout is still active
    workoutStartTime = Date.now(); // Reset start time to continue workout
    startWorkoutAutoSave();
}

// Retry saving the workout
async function retryWorkoutSave() {
    const dialog = document.getElementById('workout-save-error-dialog');
    if (dialog) dialog.remove();

    // Call finishWorkout again to retry
    await finishWorkout();
}

// ============================================
// POST-WORKOUT RATING SYSTEM (Simplified)
// ============================================
let workoutRatingState = {
    difficulty: 3,
    energy: 3,
    workoutName: null,
    sourceType: 'workout',
    sourceId: null
};

function updateSliderLabel(type) {
    // No-op: labels are static (Easy/Hard, Tired/Full of Energy)
}

function selectRating(group, value) {
    workoutRatingState[group] = value;
}

function selectIntensityPref(pref) {
    workoutRatingState.intensityPref = pref;
}

function checkRatingFormValid() {}

function openWorkoutRatingModal(workoutName, sourceType, sourceId) {
    workoutRatingState = {
        difficulty: 3,
        energy: 3,
        workoutName: workoutName || 'Workout',
        sourceType: sourceType || 'workout',
        sourceId: sourceId || null
    };

    // Reset sliders to center
    const diffSlider = document.getElementById('rating-difficulty-slider');
    const energySlider = document.getElementById('rating-energy-slider');
    if (diffSlider) diffSlider.value = 3;
    if (energySlider) energySlider.value = 3;

    // Reset save button state (may be stuck from previous save)
    const saveBtn = document.getElementById('save-rating-btn');
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
    }

    // Set workout name in header
    const nameEl = document.getElementById('rating-workout-name');
    if (nameEl) nameEl.textContent = workoutName || 'Rate your workout';

    document.getElementById('workout-rating-modal').style.display = 'block';
}

async function saveWorkoutRating() {
    const saveBtn = document.getElementById('save-rating-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
    }

    try {
        const session = await window.authHelpers?.getSession();
        if (!session?.user) {
            showToast('Please log in to save rating', 'error');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save';
            }
            return;
        }

        const difficulty = parseInt(document.getElementById('rating-difficulty-slider')?.value || 3);
        const energy = parseInt(document.getElementById('rating-energy-slider')?.value || 3);

        const userId = window.currentUser?.id || session.user.id;
        await window.dbHelpers.workoutRatings.create(userId, {
            workout_date: getLocalDateString(new Date()),
            workout_name: workoutRatingState.workoutName,
            source_type: workoutRatingState.sourceType,
            source_id: workoutRatingState.sourceId,
            overall_feeling: energy,
            difficulty: difficulty,
            energy_level: energy,
            muscle_soreness: null,
            tightness: null,
            intensity_preference: difficulty >= 4 ? 'lighter' : difficulty <= 2 ? 'harder' : 'perfect',
            notes: null
        });

        showToast('Workout rated!', 'success');
        document.getElementById('workout-rating-modal').style.display = 'none';
    } catch (err) {
        console.error('Error saving workout rating:', err);
        showToast('Failed to save rating', 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save';
        }
    }
}

function skipWorkoutRating() {
    document.getElementById('workout-rating-modal').style.display = 'none';
}

// Load workout rating insights for the movement tab
async function loadWorkoutInsights() {
    try {
        const user = window.currentUser;
        if (!user) return;

        const averages = await window.dbHelpers?.workoutRatings?.getAverages(user.id, 30);
        const card = document.getElementById('workout-insights-card');
        if (!card) return;

        if (!averages || averages.count === 0) {
            card.style.display = 'none';
            return;
        }

        card.style.display = 'block';

        const feelingEmojis = { 1: '😫', 2: '😕', 3: '😐', 4: '😊', 5: '🤩' };
        const difficultyEmojis = { 1: '🥱', 2: '👌', 3: '💪', 4: '😤', 5: '🤯' };
        const energyEmojis = { 1: '🪫', 2: '😮‍💨', 3: '🔋', 4: '⚡', 5: '🔥' };

        // Set averages
        document.getElementById('insight-avg-feeling').textContent = averages.avgFeeling;
        document.getElementById('insight-avg-feeling-emoji').textContent = feelingEmojis[Math.round(averages.avgFeeling)] || '😐';
        document.getElementById('insight-avg-difficulty').textContent = averages.avgDifficulty;
        document.getElementById('insight-avg-difficulty-emoji').textContent = difficultyEmojis[Math.round(averages.avgDifficulty)] || '💪';
        document.getElementById('insight-avg-energy').textContent = averages.avgEnergy;
        document.getElementById('insight-avg-energy-emoji').textContent = energyEmojis[Math.round(averages.avgEnergy)] || '🔋';

        // Intensity preference bar
        const total = averages.intensityBreakdown.lighter + averages.intensityBreakdown.perfect + averages.intensityBreakdown.harder;
        if (total > 0) {
            const lighterPct = Math.round((averages.intensityBreakdown.lighter / total) * 100);
            const perfectPct = Math.round((averages.intensityBreakdown.perfect / total) * 100);
            const harderPct = 100 - lighterPct - perfectPct;
            document.getElementById('insight-bar-lighter').style.width = lighterPct + '%';
            document.getElementById('insight-bar-perfect').style.width = perfectPct + '%';
            document.getElementById('insight-bar-harder').style.width = harderPct + '%';
            document.getElementById('insight-lighter-pct').textContent = lighterPct > 0 ? `Lighter ${lighterPct}%` : '';
            document.getElementById('insight-perfect-pct').textContent = perfectPct > 0 ? `Same ${perfectPct}%` : '';
            document.getElementById('insight-harder-pct').textContent = harderPct > 0 ? `Harder ${harderPct}%` : '';
        }

        // Overtraining alert
        const alertEl = document.getElementById('insights-alert');
        const alertText = document.getElementById('insights-alert-text');
        if (averages.avgDifficulty >= 4 && averages.avgEnergy <= 2) {
            alertEl.style.display = 'block';
            alertText.textContent = '⚠️ You\'ve been pushing hard and running low on energy. Consider a deload or lighter session next.';
        } else if (averages.avgTightness && averages.avgTightness >= 4) {
            alertEl.style.display = 'block';
            alertText.textContent = '🧘 High tightness detected. Add stretching or a mobility session to help recovery.';
        } else if (averages.intensityBreakdown.lighter > averages.intensityBreakdown.perfect + averages.intensityBreakdown.harder) {
            alertEl.style.display = 'block';
            alertEl.style.background = '#dbeafe';
            alertEl.style.borderColor = '#60a5fa';
            alertText.style.color = '#1e40af';
            alertText.textContent = '💡 Most sessions felt too intense. Try scaling back weight or volume.';
        } else {
            alertEl.style.display = 'none';
        }

        // Recent ratings list (last 5)
        const recentContainer = document.getElementById('insights-recent');
        const recent = averages.ratings.slice(0, 5);
        if (recent.length > 0) {
            recentContainer.innerHTML = `
                <div style="font-size:0.75rem; color:var(--text-muted); font-weight:600; margin-bottom:8px;">Recent Ratings</div>
                ${recent.map(r => {
                    const d = new Date(r.workout_date);
                    const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                    return `
                        <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f1f5f9;">
                            <div style="flex:1;">
                                <div style="font-size:0.85rem; font-weight:600; color:var(--text-main);">${r.workout_name || 'Workout'}</div>
                                <div style="font-size:0.7rem; color:var(--text-muted);">${dateStr}</div>
                            </div>
                            <div style="display:flex; gap:6px; font-size:1rem;">
                                <span title="Feeling">${feelingEmojis[r.overall_feeling] || ''}</span>
                                <span title="Difficulty">${difficultyEmojis[r.difficulty] || ''}</span>
                                <span title="Energy">${energyEmojis[r.energy_level] || ''}</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            `;
        }

    } catch (err) {
        console.error('Error loading workout insights:', err);
    }
}

// Store completed workout data for sharing
let completedWorkoutDataForShare = null;
let selectedLiftToShare = null; // Store the selected lift (legacy, kept for compatibility)

// New flexible share selection state
let shareSelection = {
    mode: 'best', // 'best', 'entire_workout', 'exercise_all', 'multi_select'
    selectedExercise: null, // For 'exercise_all' mode - which exercise to share all sets
    selectedSetIndices: [] // For 'multi_select' mode - array of set indices
};

async function showWorkoutSuccessScreen(duration, improvements, milestones, workoutData, newPBs = []) {
    hideAllAppViews();

    // Store workout data for potential sharing (including all sets)
    completedWorkoutDataForShare = {
        duration: duration,
        improvements: improvements,
        milestones: milestones,
        newPBs: newPBs,
        workoutName: window.currentWorkoutName || 'Workout',
        sets: workoutData || [] // Store all the sets from the workout
    };
    selectedLiftToShare = null; // Reset selected lift
    shareSelection = { mode: 'best', selectedExercise: null, selectedSetIndices: [] }; // Reset flexible selection

    // Update duration
    const successDurEl = document.getElementById('success-duration');
    if (successDurEl) successDurEl.innerText = duration;

    // Show milestones if any - compact display
    const milestonesContainer = document.getElementById('success-milestones');
    if (milestones && milestones.length > 0) {
        milestonesContainer.style.display = 'block';
        milestonesContainer.innerHTML = milestones.map(m => `
            <div style="background: rgba(255,255,255,0.15); padding: 12px 15px; border-radius: 12px; margin-bottom: 8px; display: flex; align-items: center; gap: 12px;">
                <div style="font-size: 2rem;">${m.milestone_value === 1 ? '🎉' : m.milestone_value >= 100 ? '👑' : m.milestone_value >= 50 ? '🏆' : m.milestone_value >= 25 ? '🌟' : m.milestone_value >= 10 ? '🔥' : '💪'}</div>
                <div style="text-align: left;">
                    <div style="font-size: 0.95rem; font-weight: 700;">Milestone!</div>
                    <div style="font-size: 0.85rem; opacity: 0.9;">${m.message}</div>
                </div>
            </div>
        `).join('');
    } else {
        milestonesContainer.style.display = 'none';
    }

    // Show Personal Bests if any - compact display right under header
    const improvementsContainer = document.getElementById('success-improvements');
    if (newPBs && newPBs.length > 0) {
        improvementsContainer.style.display = 'block';
        improvementsContainer.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                <span style="font-size: 1.5rem;">🏆</span>
                <span style="font-size: 1rem; font-weight: 700; color: #fbbf24;">NEW PERSONAL BEST${newPBs.length > 1 ? 'S' : ''}!</span>
            </div>
            ${newPBs.map((pb, idx) => {
                let pbText = '';
                let improvement = '';
                if (pb.type === 'weight') {
                    pbText = `${pb.value}kg x ${pb.reps}`;
                    if (pb.improvement) improvement = `+${pb.improvement}kg`;
                } else {
                    pbText = `${pb.value} reps @ ${pb.weight}kg`;
                    if (pb.improvement) improvement = `+${pb.improvement}`;
                }
                return `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: rgba(251,191,36,0.15); border-radius: 10px; margin-bottom: 6px; border-left: 3px solid #f59e0b;">
                        <div style="flex:1;">
                            <div style="font-weight: 600; font-size: 0.9rem; color: white;">${pb.exercise}</div>
                            <div style="font-size: 0.8rem; opacity: 0.9;">${pbText}</div>
                        </div>
                        ${improvement ? `<div style="color: #4ade80; font-weight: 700; font-size: 0.9rem; margin-right:8px;">${improvement}</div>` : ''}
                        <button id="share-pb-btn-${idx}" onclick="sharePBCardToFeed(completedWorkoutDataForShare.newPBs[${idx}]); this.textContent='Shared!'; this.disabled=true; this.style.opacity='0.6';" style="background:rgba(251,191,36,0.3); border:1px solid rgba(251,191,36,0.5); color:#fbbf24; padding:4px 10px; border-radius:8px; font-size:0.7rem; font-weight:700; cursor:pointer; white-space:nowrap;">Share</button>
                    </div>
                `;
            }).join('')}
        `;
    } else if (improvements && improvements.length > 0) {
        // Fallback to showing regular improvements
        improvementsContainer.style.display = 'block';
        improvementsContainer.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                <span style="font-size: 1.3rem;">💪</span>
                <span style="font-size: 0.95rem; font-weight: 700;">Progress Made!</span>
            </div>
            ${improvements.slice(0, 3).map(imp => {
                let improvementText = '';
                if (imp.weightIncrease > 0) improvementText = `+${imp.weightIncrease}kg`;
                else if (imp.repsIncrease > 0) improvementText = `+${imp.repsIncrease} reps`;

                return `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: rgba(255,255,255,0.1); border-radius: 8px; margin-bottom: 5px;">
                        <span style="font-size: 0.85rem;">${imp.exercise}</span>
                        <span style="color: #4ade80; font-weight: 600; font-size: 0.85rem;">${improvementText}</span>
                    </div>
                `;
            }).join('')}
        `;
    } else {
        improvementsContainer.style.display = 'none';
    }

    // Get workout count for display
    try {
        const workoutCount = await dbHelpers.workouts.getWorkoutCount(window.currentUser.id);
        document.getElementById('success-workout-count').innerText = workoutCount;
        document.getElementById('success-workout-count-container').style.display = 'flex';
    } catch(e) {
        document.getElementById('success-workout-count-container').style.display = 'none';
    }

    document.getElementById('view-workout-success').style.display = 'flex';

    // Hide earn-points card if previously dismissed
    if (localStorage.getItem('share_section_dismissed') === 'true') {
        const shareCard = document.getElementById('share-section-combined');
        if (shareCard) shareCard.style.display = 'none';
    }

    // Push navigation state for Android back button
    pushNavigationState('view-workout-success', () => closeSuccessScreen());
}

function quitWorkout() {
    if(confirm('Quit workout? Your progress won\'t be saved.')) {
        console.log("Quitting workout...");
        clearInterval(workoutTimerInterval);
        workoutStartTime = null; // Reset start time
        window.currentCustomWorkoutId = null; // Reset custom workout tracking
        clearAllYogaTimers(); // Clear any running yoga timers
        document.getElementById('view-active-workout').style.display = 'none'; // Force hide
        // Hide workout Spotify bar
        const wsBar = document.getElementById('workout-spotify-bar');
        if (wsBar) wsBar.style.display = 'none';
        closeSuccessScreen(true); // Skip rating on quit
    }
}

function closeSuccessScreen(skipRating) {
    // Grab workout name before clearing data
    const workoutName = completedWorkoutDataForShare?.workoutName || window.currentWorkoutName || 'Workout';

    hideAllAppViews();
    document.getElementById('movement-tab').style.display = 'block';
    document.querySelector('.bottom-nav').style.display = 'flex';
    renderMovementView();
    // Clear the stored workout data
    completedWorkoutDataForShare = null;

    // Reset custom workout tracking for next workout
    window.currentCustomWorkoutId = null;

    // Reset workout points tracking for next workout
    if (typeof workoutPointsEarnedThisSession !== 'undefined') {
        workoutPointsEarnedThisSession = { story: false, groupchat: false };
    }

    // Hide the points awarded confirmation
    const pointsAwarded = document.getElementById('workout-points-awarded');
    if (pointsAwarded) pointsAwarded.style.display = 'none';

    // Reset group chat share button state for next workout
    const gcBtn = document.getElementById('share-workout-groupchat-btn');
    if (gcBtn) {
        gcBtn.disabled = false;
        gcBtn.style.opacity = '1';
        gcBtn.style.cursor = 'pointer';
        const gcBtnText = gcBtn.querySelector('span:last-child');
        if (gcBtnText) gcBtnText.textContent = 'Share to Group Chat (+1 XP)';
    }

    // Refresh challenges to show any updated points
    if (typeof loadHomeChallenges === 'function') {
        loadHomeChallenges();
    }

    // Show post-workout rating modal (unless explicitly skipped)
    if (!skipRating) {
        openWorkoutRatingModal(workoutName, 'workout', null);
    }
}

// Go to group chats to share workout
function goToGroupChatsToShare() {
    closeSuccessScreen();
    switchAppTab('friends');
    // Store data for when user opens a chat
    if (completedWorkoutDataForShare) {
        const { improvements, milestones, workoutName } = completedWorkoutDataForShare;
        let message = `Just finished ${workoutName}! 💪`;
        let improvementText = '';

        if (improvements && improvements.length > 0) {
            const imp = improvements[0];
            if (imp.weightIncrease > 0 || imp.repsIncrease > 0) {
                const parts = [];
                if (imp.weightIncrease > 0) parts.push(`+${imp.weightIncrease}kg`);
                if (imp.repsIncrease > 0) parts.push(`+${imp.repsIncrease} reps`);
                improvementText = parts.join(' and ');
                message = `Hit a PR on ${imp.exercise}! ${improvementText} 🏆`;
            }
        }

        if (milestones && milestones.length > 0) {
            message = `${milestones[0].message} 🌟`;
        }

        // Store prefill data for when user opens share win modal
        window.pendingWinShare = {
            type: improvements?.length > 0 ? 'personal_best' : milestones?.length > 0 ? 'milestone' : 'workout_complete',
            workoutName: workoutName,
            message: message,
            improvement: improvementText
        };
    }
    showToast('Open a group chat to share your win! 💬', 'success');
}

// Quick Share Modal Functions
async function openQuickShareModal() {
    const modal = document.getElementById('quick-share-modal');
    const chatsList = document.getElementById('quick-share-chats-list');
    const noChats = document.getElementById('quick-share-no-chats');
    const liftSection = document.getElementById('lift-selection-section');
    const liftList = document.getElementById('lift-selection-list');
    const multiSelectHint = document.getElementById('multi-select-hint');

    // Reset selection state
    selectedLiftToShare = null;
    shareSelection = { mode: 'best', selectedExercise: null, selectedSetIndices: [] };

    // Populate the win preview with default (best achievement or workout complete)
    updateSharePreview();

    // Populate lift selection if we have sets data
    if (completedWorkoutDataForShare && completedWorkoutDataForShare.sets && completedWorkoutDataForShare.sets.length > 0) {
        liftSection.style.display = 'block';
        if (multiSelectHint) multiSelectHint.style.display = 'none';

        // Group sets by exercise and get best set for each
        const exerciseSets = {};
        completedWorkoutDataForShare.sets.forEach(set => {
            const name = set.exercise || set.exercise_name || set.exerciseName || 'Exercise';
            if (!exerciseSets[name]) {
                exerciseSets[name] = [];
            }
            exerciseSets[name].push(set);
        });

        // Build lift selection HTML with flexible options
        let liftHtml = '';
        const exerciseNames = Object.keys(exerciseSets);
        const totalSets = completedWorkoutDataForShare.sets.length;
        const hasMultipleExercises = exerciseNames.length > 1;
        const hasMultipleSets = totalSets > 1;

        // Add "Share Entire Workout" option at the top if there are multiple exercises or sets
        if (hasMultipleSets) {
            liftHtml += `
                <div onclick="selectShareMode('entire_workout')" id="share-option-workout" style="background: linear-gradient(135deg, #7ba883, #4ade80); color: white; padding: 14px 16px; border-radius: 14px; cursor: pointer; display: flex; align-items: center; gap: 12px; margin-bottom: 8px; box-shadow: 0 4px 12px rgba(123, 168, 131, 0.3);" class="share-mode-option">
                    <span style="font-size: 1.4rem;">📋</span>
                    <div style="flex: 1;">
                        <div style="font-weight: 700; font-size: 1rem;">Share Entire Workout</div>
                        <div style="font-size: 0.8rem; opacity: 0.9;">${exerciseNames.length} exercise${exerciseNames.length > 1 ? 's' : ''} • ${totalSets} set${totalSets > 1 ? 's' : ''}</div>
                    </div>
                    <span class="select-chip" style="font-size: 0.8rem; opacity: 0.9;">SELECT</span>
                </div>
            `;
        }

        // Add "Best Achievement" option if there are improvements
        if (completedWorkoutDataForShare.improvements && completedWorkoutDataForShare.improvements.length > 0) {
            const isDefault = shareSelection.mode === 'best';
            liftHtml += `
                <div onclick="selectShareMode('best')" id="share-option-best" style="background: ${isDefault ? 'var(--primary)' : 'white'}; color: ${isDefault ? 'white' : 'var(--text-main)'}; padding: 14px 16px; border-radius: 14px; cursor: pointer; display: flex; align-items: center; gap: 12px; border: 1px solid ${isDefault ? 'var(--primary)' : '#edf2f7'};" class="share-mode-option">
                    <span style="font-size: 1.4rem;">🏆</span>
                    <div style="flex: 1;">
                        <div style="font-weight: 700; font-size: 1rem;">Best Achievement (PR)</div>
                        <div style="font-size: 0.8rem; ${isDefault ? 'opacity: 0.9;' : 'color: var(--text-muted);'}">${completedWorkoutDataForShare.improvements[0].exercise}</div>
                    </div>
                    <span class="select-chip" style="font-size: 0.8rem;">${isDefault ? '✓' : 'SELECT'}</span>
                </div>
            `;
        }

        // Add divider if we have exercises to show
        if (exerciseNames.length > 0) {
            liftHtml += `
                <div style="display: flex; align-items: center; gap: 12px; margin: 16px 0 12px 0;">
                    <div style="flex: 1; height: 1px; background: #e2e8f0;"></div>
                    <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Or choose specific lifts</span>
                    <div style="flex: 1; height: 1px; background: #e2e8f0;"></div>
                </div>
            `;
        }

        // Add each exercise as expandable dropdown with all sets
        let exerciseIndex = 0;
        Object.entries(exerciseSets).forEach(([exerciseName, sets]) => {
            const exerciseId = `exercise-dropdown-${exerciseIndex}`;
            const setCount = sets.length;

            // Find best set for summary display
            const bestSet = sets.reduce((best, current) => {
                const currentWeight = current.kg || current.weight_kg || 0;
                const bestWeight = best.kg || best.weight_kg || 0;
                if (currentWeight > bestWeight) return current;
                if (currentWeight === bestWeight) {
                    const currentReps = current.reps || 0;
                    const bestReps = best.reps || 0;
                    return currentReps > bestReps ? current : best;
                }
                return best;
            }, sets[0]);
            const bestWeight = bestSet.kg || bestSet.weight_kg || 0;
            const bestReps = bestSet.reps || 0;

            // Exercise header (clickable to expand)
            liftHtml += `
                <div style="border: 1px solid #edf2f7; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.02);" class="exercise-group" data-exercise="${escapeHtml(exerciseName)}">
                    <div onclick="toggleExerciseDropdown('${exerciseId}')" style="background: white; padding: 15px; cursor: pointer; display: flex; align-items: center; gap: 15px; transition: all 0.2s;" class="exercise-header">
                        <div style="width: 40px; height: 40px; background: #f1f5f9; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">💪</div>
                        <div style="flex: 1;">
                            <div style="font-weight: 700; color: var(--text-main); font-size: 1rem;">${escapeHtml(exerciseName)}</div>
                            <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500;">${setCount} set${setCount > 1 ? 's' : ''} • Best: ${bestWeight}kg × ${bestReps} reps</div>
                        </div>
                        <div id="${exerciseId}-arrow" style="color: var(--text-muted); transition: transform 0.2s; font-size: 1.2rem;">▼</div>
                    </div>
                    <div id="${exerciseId}" style="display: none; background: #f8fafc; border-top: 1px solid #edf2f7;">
            `;

            // Add "Share All Sets" option for this exercise if multiple sets
            if (setCount > 1) {
                liftHtml += `
                        <div onclick="event.stopPropagation(); selectExerciseAllSets('${escapeHtml(exerciseName)}')" id="share-all-${exerciseIndex}" style="background: #f0fdf4; margin: 8px; padding: 12px 15px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; gap: 12px; transition: all 0.2s; border: 1px dashed #86efac;" class="share-all-option">
                            <div style="width: 32px; height: 32px; background: #dcfce7; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1rem;">📊</div>
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: #166534; font-size: 0.95rem;">Share All ${setCount} Sets</div>
                                <div style="font-size: 0.8rem; color: #15803d; font-weight: 500;">Include every set from this exercise</div>
                            </div>
                            <div class="select-chip" style="font-size: 0.7rem; font-weight: 700; color: #16a34a; border: 1.5px solid #16a34a; padding: 3px 8px; border-radius: 15px;">SELECT</div>
                        </div>
                `;
            }

            // Individual sets (multi-selectable)
            sets.forEach((set, idx) => {
                const setIndex = completedWorkoutDataForShare.sets.indexOf(set);
                const weight = set.kg || set.weight_kg || 0;
                const reps = set.reps || 0;
                const setNumber = set.set || (idx + 1);

                liftHtml += `
                        <div onclick="event.stopPropagation(); toggleSetSelection(${setIndex})" id="lift-option-${setIndex}" style="background: white; margin: 8px; padding: 12px 15px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; gap: 12px; transition: all 0.2s; border: 1px solid #edf2f7;" class="lift-option" data-set-index="${setIndex}">
                            <div style="width: 32px; height: 32px; background: #e2e8f0; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem; color: var(--text-muted);" class="lift-icon">${setNumber}</div>
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: var(--text-main); font-size: 0.95rem;">Set ${setNumber}</div>
                                <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">${weight}kg × ${reps} reps</div>
                            </div>
                            <div class="select-chip" style="font-size: 0.7rem; font-weight: 700; color: var(--primary); border: 1.5px solid var(--primary); padding: 3px 8px; border-radius: 15px;">SELECT</div>
                        </div>
                `;
            });

            liftHtml += `
                    </div>
                </div>
            `;
            exerciseIndex++;
        });

        liftList.innerHTML = liftHtml;
    } else {
        liftSection.style.display = 'none';
    }

    // Show modal
    modal.style.display = 'block';

    // Load group chats
    chatsList.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">Loading chats...</div>';
    noChats.style.display = 'none';

    try {
        const { data: chats, error } = await window.supabaseClient.rpc('get_user_group_chats', {
            user_uuid: window.currentUser.id
        });

        if (error) throw error;

        if (!chats || chats.length === 0) {
            chatsList.innerHTML = '';
            noChats.style.display = 'block';
        } else {
            noChats.style.display = 'none';
            chatsList.innerHTML = chats.map(chat => `
                <div onclick="quickShareToChat('${chat.chat_id}', '${escapeHtml(chat.chat_name)}')" style="background: #f8fafc; padding: 15px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; gap: 12px; transition: background 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f8fafc'">
                    <div style="width: 45px; height: 45px; background: linear-gradient(135deg, var(--primary), #4ade80); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 1.1rem;">
                        ${chat.chat_name.charAt(0).toUpperCase()}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: var(--text-main);">${escapeHtml(chat.chat_name)}</div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">${chat.member_count} members</div>
                    </div>
                    <div style="color: var(--primary); font-weight: 600;">Share →</div>
                </div>
            `).join('');
        }
    } catch(e) {
        console.error('Error loading group chats for quick share:', e);
        chatsList.innerHTML = '<div style="text-align: center; padding: 20px; color: #ef4444;">Failed to load chats. Try again.</div>';
    }
}

function closeQuickShareModal() {
    document.getElementById('quick-share-modal').style.display = 'none';
    selectedLiftToShare = null;
    shareSelection = { mode: 'best', selectedExercise: null, selectedSetIndices: [] };
}

// Toggle exercise dropdown to show/hide individual sets
function toggleExerciseDropdown(exerciseId) {
    const dropdown = document.getElementById(exerciseId);
    const arrow = document.getElementById(exerciseId + '-arrow');

    if (!dropdown) return;

    const isExpanded = dropdown.style.display !== 'none';

    if (isExpanded) {
        dropdown.style.display = 'none';
        if (arrow) arrow.style.transform = 'rotate(0deg)';
    } else {
        dropdown.style.display = 'block';
        if (arrow) arrow.style.transform = 'rotate(180deg)';
    }
}

// Select share mode (entire_workout, best, etc.)
function selectShareMode(mode) {
    shareSelection.mode = mode;
    shareSelection.selectedExercise = null;
    shareSelection.selectedSetIndices = [];
    selectedLiftToShare = null;

    updateShareSelectionUI();
    updateSharePreview();
}

// Select all sets from a specific exercise
function selectExerciseAllSets(exerciseName) {
    shareSelection.mode = 'exercise_all';
    shareSelection.selectedExercise = exerciseName;
    shareSelection.selectedSetIndices = [];
    selectedLiftToShare = null;

    // Get all set indices for this exercise
    if (completedWorkoutDataForShare && completedWorkoutDataForShare.sets) {
        completedWorkoutDataForShare.sets.forEach((set, index) => {
            const setExercise = set.exercise || set.exercise_name || set.exerciseName || 'Exercise';
            if (setExercise === exerciseName) {
                shareSelection.selectedSetIndices.push(index);
            }
        });
    }

    updateShareSelectionUI();
    updateSharePreview();
}

// Toggle selection of individual sets (multi-select)
function toggleSetSelection(setIndex) {
    const idx = shareSelection.selectedSetIndices.indexOf(setIndex);

    if (idx === -1) {
        // Add to selection
        shareSelection.selectedSetIndices.push(setIndex);
    } else {
        // Remove from selection
        shareSelection.selectedSetIndices.splice(idx, 1);
    }

    // Update mode based on selection
    if (shareSelection.selectedSetIndices.length === 0) {
        shareSelection.mode = 'best';
    } else if (shareSelection.selectedSetIndices.length === 1) {
        shareSelection.mode = 'multi_select';
        selectedLiftToShare = shareSelection.selectedSetIndices[0]; // Keep legacy compatibility
    } else {
        shareSelection.mode = 'multi_select';
        selectedLiftToShare = null;
    }

    shareSelection.selectedExercise = null;

    updateShareSelectionUI();
    updateSharePreview();

    // Show multi-select hint when user has selected something
    const hint = document.getElementById('multi-select-hint');
    if (hint && shareSelection.selectedSetIndices.length > 0 && shareSelection.selectedSetIndices.length < 3) {
        hint.style.display = 'block';
    } else if (hint) {
        hint.style.display = 'none';
    }
}

// Update the visual state of all selection options
function updateShareSelectionUI() {
    const liftList = document.getElementById('lift-selection-list');
    if (!liftList) return;

    // Reset all share mode options
    const modeOptions = liftList.querySelectorAll('.share-mode-option');
    modeOptions.forEach(opt => {
        const isSelected = (shareSelection.mode === 'entire_workout' && opt.id === 'share-option-workout') ||
                          (shareSelection.mode === 'best' && opt.id === 'share-option-best');

        if (opt.id === 'share-option-workout') {
            // Entire workout option
            if (isSelected) {
                opt.style.background = 'linear-gradient(135deg, #166534, #22c55e)';
                opt.style.boxShadow = '0 4px 12px rgba(22, 101, 52, 0.4)';
            } else {
                opt.style.background = 'linear-gradient(135deg, #7ba883, #4ade80)';
                opt.style.boxShadow = '0 4px 12px rgba(123, 168, 131, 0.3)';
            }
            const chip = opt.querySelector('.select-chip');
            if (chip) chip.innerText = isSelected ? '✓ SELECTED' : 'SELECT';
        } else if (opt.id === 'share-option-best') {
            // Best achievement option
            opt.style.background = isSelected ? 'var(--primary)' : 'white';
            opt.style.color = isSelected ? 'white' : 'var(--text-main)';
            opt.style.borderColor = isSelected ? 'var(--primary)' : '#edf2f7';
            const chip = opt.querySelector('.select-chip');
            if (chip) chip.innerText = isSelected ? '✓' : 'SELECT';
            // Update text colors
            const subtextDiv = opt.querySelector('div > div:last-child');
            if (subtextDiv) {
                subtextDiv.style.opacity = isSelected ? '0.9' : '1';
                subtextDiv.style.color = isSelected ? '' : 'var(--text-muted)';
            }
        }
    });

    // Reset all share-all options for exercises
    const shareAllOptions = liftList.querySelectorAll('.share-all-option');
    shareAllOptions.forEach(opt => {
        const exerciseGroup = opt.closest('.exercise-group');
        const exerciseName = exerciseGroup ? exerciseGroup.dataset.exercise : null;
        const isSelected = shareSelection.mode === 'exercise_all' && shareSelection.selectedExercise === exerciseName;

        if (isSelected) {
            opt.style.background = '#16a34a';
            opt.style.borderColor = '#16a34a';
            opt.style.borderStyle = 'solid';
            opt.querySelectorAll('div').forEach(div => {
                div.style.color = 'white';
            });
            const chip = opt.querySelector('.select-chip');
            if (chip) {
                chip.style.color = 'white';
                chip.style.borderColor = 'white';
                chip.innerText = '✓ SELECTED';
            }
        } else {
            opt.style.background = '#f0fdf4';
            opt.style.borderColor = '#86efac';
            opt.style.borderStyle = 'dashed';
            const iconDiv = opt.querySelector('div:first-child');
            if (iconDiv) iconDiv.style.color = '';
            const textDivs = opt.querySelectorAll('div > div');
            textDivs.forEach((div, i) => {
                div.style.color = i === 0 ? '#166534' : '#15803d';
            });
            const chip = opt.querySelector('.select-chip');
            if (chip) {
                chip.style.color = '#16a34a';
                chip.style.borderColor = '#16a34a';
                chip.innerText = 'SELECT';
            }
        }
    });

    // Update individual lift options for multi-select
    const liftOptions = liftList.querySelectorAll('.lift-option');
    liftOptions.forEach(opt => {
        const setIndex = parseInt(opt.dataset.setIndex);
        if (isNaN(setIndex)) return;

        const isSelected = shareSelection.selectedSetIndices.includes(setIndex);

        if (isSelected) {
            opt.style.background = 'var(--primary)';
            opt.style.borderColor = 'var(--primary)';
            opt.style.color = 'white';
            const icon = opt.querySelector('.lift-icon');
            if (icon) {
                icon.style.background = 'rgba(255,255,255,0.2)';
                icon.style.color = 'white';
            }
            const chip = opt.querySelector('.select-chip');
            if (chip) {
                chip.style.color = 'white';
                chip.style.borderColor = 'white';
                chip.innerText = '✓';
            }
            // Update text colors
            opt.querySelectorAll('div').forEach(div => {
                if (div.style.fontWeight === '600' || div.style.fontWeight === '700') {
                    div.style.color = 'white';
                } else if (div.style.fontSize && div.style.fontSize.includes('0.8')) {
                    div.style.color = 'rgba(255,255,255,0.8)';
                }
            });
        } else {
            opt.style.background = 'white';
            opt.style.borderColor = '#edf2f7';
            opt.style.color = '';
            const icon = opt.querySelector('.lift-icon');
            if (icon) {
                icon.style.background = '#e2e8f0';
                icon.style.color = 'var(--text-muted)';
            }
            const chip = opt.querySelector('.select-chip');
            if (chip) {
                chip.style.color = 'var(--primary)';
                chip.style.borderColor = 'var(--primary)';
                chip.innerText = 'SELECT';
            }
            // Reset text colors
            opt.querySelectorAll('div').forEach(div => {
                if (div.style.fontWeight === '600' || div.style.fontWeight === '700') {
                    div.style.color = 'var(--text-main)';
                } else if (div.style.fontSize && div.style.fontSize.includes('0.8')) {
                    div.style.color = 'var(--text-muted)';
                }
            });
        }
    });
}

// Update the share preview based on selected lift
function updateSharePreview() {
    const badge = document.getElementById('quick-share-badge');
    const message = document.getElementById('quick-share-message');
    const detail = document.getElementById('quick-share-detail');

    if (!completedWorkoutDataForShare) {
        badge.innerText = '💪';
        message.innerText = 'Workout completed!';
        detail.innerText = '';
        return;
    }

    const { improvements, milestones, workoutName, sets } = completedWorkoutDataForShare;

    // Handle different share modes
    switch (shareSelection.mode) {
        case 'entire_workout': {
            // Group sets by exercise for summary
            const exerciseSets = {};
            (sets || []).forEach(set => {
                const name = set.exercise || set.exercise_name || set.exerciseName || 'Exercise';
                if (!exerciseSets[name]) exerciseSets[name] = [];
                exerciseSets[name].push(set);
            });
            const exerciseCount = Object.keys(exerciseSets).length;
            const totalSets = (sets || []).length;

            badge.innerText = '📋';
            message.innerText = `Complete ${workoutName} Workout`;
            detail.innerText = `${exerciseCount} exercise${exerciseCount > 1 ? 's' : ''} • ${totalSets} set${totalSets > 1 ? 's' : ''} total`;
            return;
        }

        case 'exercise_all': {
            // Sharing all sets of one exercise
            const exerciseName = shareSelection.selectedExercise;
            const exerciseSets = (sets || []).filter(s => (s.exercise || s.exercise_name || s.exerciseName) === exerciseName);
            const setCount = exerciseSets.length;

            // Build summary of sets
            let setsSummary = exerciseSets.map(s => {
                const w = s.kg || s.weight_kg || 0;
                const r = s.reps || 0;
                return `${w}kg×${r}`;
            }).join(', ');

            badge.innerText = '📊';
            message.innerText = `${exerciseName} - All ${setCount} Sets`;
            detail.innerText = setsSummary;
            return;
        }

        case 'multi_select': {
            // Multiple sets selected
            const selectedSets = shareSelection.selectedSetIndices.map(i => sets[i]).filter(Boolean);
            const count = selectedSets.length;

            if (count === 1) {
                // Single set selected
                const set = selectedSets[0];
                const exerciseName = set.exercise || set.exercise_name || set.exerciseName || 'Exercise';
                const weight = set.kg || set.weight_kg || 0;
                const reps = set.reps || 0;

                badge.innerText = '💪';
                message.innerText = `${exerciseName}`;
                detail.innerText = `${weight}kg × ${reps} reps`;
            } else {
                // Multiple sets selected - group by exercise
                const byExercise = {};
                selectedSets.forEach(set => {
                    const name = set.exercise || set.exercise_name || set.exerciseName || 'Exercise';
                    if (!byExercise[name]) byExercise[name] = [];
                    byExercise[name].push(set);
                });

                const exerciseNames = Object.keys(byExercise);
                if (exerciseNames.length === 1) {
                    // All from same exercise
                    const name = exerciseNames[0];
                    const setsSummary = byExercise[name].map(s => {
                        const w = s.kg || s.weight_kg || 0;
                        const r = s.reps || 0;
                        return `${w}kg×${r}`;
                    }).join(', ');

                    badge.innerText = '💪';
                    message.innerText = `${name} - ${count} Sets`;
                    detail.innerText = setsSummary;
                } else {
                    // Multiple exercises
                    const summary = exerciseNames.map(name => {
                        return `${name} (${byExercise[name].length})`;
                    }).join(', ');

                    badge.innerText = '🏋️';
                    message.innerText = `${count} Sets from ${exerciseNames.length} Exercises`;
                    detail.innerText = summary;
                }
            }
            return;
        }

        case 'best':
        default: {
            // Legacy: single lift selected via old method
            if (selectedLiftToShare !== null && sets && sets[selectedLiftToShare]) {
                const set = sets[selectedLiftToShare];
                const exerciseName = set.exercise || set.exercise_name || set.exerciseName || 'Exercise';
                const weight = set.kg || set.weight_kg || 0;
                const reps = set.reps || 0;

                badge.innerText = '💪';
                message.innerText = `${exerciseName}`;
                detail.innerText = `${weight}kg × ${reps} reps`;
                return;
            }

            // Default: show best achievement or workout complete
            if (improvements && improvements.length > 0) {
                const imp = improvements[0];
                let improvementText = '';
                if (imp.weightIncrease > 0 && imp.repsIncrease > 0) {
                    improvementText = `+${imp.weightIncrease}kg and +${imp.repsIncrease} reps`;
                } else if (imp.weightIncrease > 0) {
                    improvementText = `+${imp.weightIncrease}kg`;
                } else if (imp.repsIncrease > 0) {
                    improvementText = `+${imp.repsIncrease} reps`;
                }
                badge.innerText = '🏆';
                message.innerText = `Hit a PR on ${imp.exercise}!`;
                detail.innerText = `${improvementText} (${imp.previousWeight || 0}kg x ${imp.previousReps || 0} → ${imp.currentWeight || 0}kg x ${imp.currentReps || 0})`;
            } else if (milestones && milestones.length > 0) {
                const m = milestones[0];
                const emoji = m.milestone_value === 1 ? '🎉' : m.milestone_value >= 100 ? '👑' : m.milestone_value >= 50 ? '🏆' : m.milestone_value >= 25 ? '🌟' : m.milestone_value >= 10 ? '🔥' : '💪';
                badge.innerText = emoji;
                message.innerText = m.message;
                detail.innerText = '';
            } else {
                badge.innerText = '💪';
                message.innerText = `Just finished ${workoutName}!`;
                detail.innerText = 'Workout completed';
            }
        }
    }
}

// Select a specific lift to share (legacy function - now uses the new flexible selection system)
function selectLiftToShare(setIndex) {
    if (setIndex === null) {
        // Select "best achievement" mode
        selectShareMode('best');
    } else {
        // Use toggle to select/deselect specific set
        // First clear any other selections to behave like the old single-select
        shareSelection.selectedSetIndices = [setIndex];
        shareSelection.mode = 'multi_select';
        shareSelection.selectedExercise = null;
        selectedLiftToShare = setIndex;
        updateShareSelectionUI();
        updateSharePreview();
    }
}

// Get the current share data based on selection
function getShareData() {
    if (!completedWorkoutDataForShare) {
        return { message: 'Just crushed a workout! 💪', type: 'workout_complete', details: {} };
    }

    const { improvements, milestones, workoutName, sets, duration } = completedWorkoutDataForShare;

    // Handle different share modes
    switch (shareSelection.mode) {
        case 'entire_workout': {
            // Share entire workout with all exercises and sets
            const exerciseSets = {};
            (sets || []).forEach(set => {
                const name = set.exercise || set.exercise_name || set.exerciseName || 'Exercise';
                if (!exerciseSets[name]) exerciseSets[name] = [];
                exerciseSets[name].push(set);
            });

            const exerciseCount = Object.keys(exerciseSets).length;
            const totalSets = (sets || []).length;

            // Build detailed workout summary
            let workoutSummary = Object.entries(exerciseSets).map(([exercise, exSets]) => {
                const setsInfo = exSets.map(s => {
                    const w = s.kg || s.weight_kg || 0;
                    const r = s.reps || 0;
                    return `${w}kg×${r}`;
                }).join(', ');
                return `${exercise}: ${setsInfo}`;
            }).join('\n');

            return {
                message: `Completed ${workoutName}! 📋\n${exerciseCount} exercises, ${totalSets} sets total`,
                type: 'entire_workout',
                details: {
                    workoutName,
                    duration,
                    exerciseCount,
                    totalSets,
                    exercises: exerciseSets,
                    summary: workoutSummary
                }
            };
        }

        case 'exercise_all': {
            // Share all sets from a specific exercise
            const exerciseName = shareSelection.selectedExercise;
            const exerciseSets = (sets || []).filter(s => (s.exercise || s.exercise_name || s.exerciseName) === exerciseName);
            const setCount = exerciseSets.length;

            const setsInfo = exerciseSets.map((s, i) => {
                const w = s.kg || s.weight_kg || 0;
                const r = s.reps || 0;
                return `Set ${i + 1}: ${w}kg × ${r} reps`;
            }).join(', ');

            return {
                message: `Crushed ${exerciseName}! 📊\n${setCount} sets: ${setsInfo}`,
                type: 'exercise_all_sets',
                details: {
                    workoutName,
                    exercise: exerciseName,
                    setCount,
                    sets: exerciseSets.map(s => ({
                        weight: s.kg || s.weight_kg || 0,
                        reps: s.reps || 0
                    }))
                }
            };
        }

        case 'multi_select': {
            // Share multiple selected sets
            const selectedSets = shareSelection.selectedSetIndices.map(i => sets[i]).filter(Boolean);
            const count = selectedSets.length;

            if (count === 1) {
                // Single set
                const set = selectedSets[0];
                const exerciseName = set.exercise || set.exercise_name || set.exerciseName || 'Exercise';
                const weight = set.kg || set.weight_kg || 0;
                const reps = set.reps || 0;

                return {
                    message: `Crushed ${exerciseName}: ${weight}kg × ${reps} reps! 💪`,
                    type: 'specific_lift',
                    details: { workoutName, exercise: exerciseName, weight, reps }
                };
            }

            // Multiple sets - group by exercise
            const byExercise = {};
            selectedSets.forEach(set => {
                const name = set.exercise || set.exercise_name || set.exerciseName || 'Exercise';
                if (!byExercise[name]) byExercise[name] = [];
                byExercise[name].push(set);
            });

            const exerciseNames = Object.keys(byExercise);
            let messageText;
            if (exerciseNames.length === 1) {
                const name = exerciseNames[0];
                const setsInfo = byExercise[name].map(s => {
                    const w = s.kg || s.weight_kg || 0;
                    const r = s.reps || 0;
                    return `${w}kg×${r}`;
                }).join(', ');
                messageText = `Crushed ${name}! 💪\n${count} sets: ${setsInfo}`;
            } else {
                const summaryParts = exerciseNames.map(name => {
                    const exSets = byExercise[name];
                    const setsInfo = exSets.map(s => {
                        const w = s.kg || s.weight_kg || 0;
                        const r = s.reps || 0;
                        return `${w}kg×${r}`;
                    }).join(', ');
                    return `${name}: ${setsInfo}`;
                });
                messageText = `Crushed ${count} sets! 🏋️\n${summaryParts.join('\n')}`;
            }

            return {
                message: messageText,
                type: 'multi_sets',
                details: {
                    workoutName,
                    setCount: count,
                    exerciseCount: exerciseNames.length,
                    exercises: byExercise
                }
            };
        }

        case 'best':
        default: {
            // Legacy: single lift selected via old method
            if (selectedLiftToShare !== null && sets && sets[selectedLiftToShare]) {
                const set = sets[selectedLiftToShare];
                const exerciseName = set.exercise || set.exercise_name || set.exerciseName || 'Exercise';
                const weight = set.kg || set.weight_kg || 0;
                const reps = set.reps || 0;

                return {
                    message: `Crushed ${exerciseName}: ${weight}kg × ${reps} reps! 💪`,
                    type: 'specific_lift',
                    details: { workoutName, exercise: exerciseName, weight, reps }
                };
            }

            // Default: best achievement
            if (improvements && improvements.length > 0) {
                const imp = improvements[0];
                let improvementText = '';
                if (imp.weightIncrease > 0 && imp.repsIncrease > 0) {
                    improvementText = `+${imp.weightIncrease}kg and +${imp.repsIncrease} reps`;
                } else if (imp.weightIncrease > 0) {
                    improvementText = `+${imp.weightIncrease}kg`;
                } else if (imp.repsIncrease > 0) {
                    improvementText = `+${imp.repsIncrease} reps`;
                }
                return {
                    message: `Hit a PR on ${imp.exercise}! ${improvementText} 🏆`,
                    type: 'personal_best',
                    details: {
                        workoutName,
                        exercise: imp.exercise,
                        improvement: improvementText,
                        previousWeight: imp.previousWeight,
                        previousReps: imp.previousReps,
                        currentWeight: imp.currentWeight,
                        currentReps: imp.currentReps
                    }
                };
            }

            if (milestones && milestones.length > 0) {
                const m = milestones[0];
                return {
                    message: `${m.message} 🌟`,
                    type: 'milestone',
                    details: { workoutName, milestone: m.message, value: m.milestone_value }
                };
            }

            return {
                message: `Just finished ${workoutName}! 💪`,
                type: 'workout_complete',
                details: { workoutName, duration }
            };
        }
    }
}

async function quickShareToChat(chatId, chatName) {
    if (!completedWorkoutDataForShare) {
        showToast('No workout data to share', 'error');
        return;
    }

    // Get share data based on current selection
    const shareData = getShareData();

    try {
        const { error } = await window.supabaseClient
            .from('group_chat_messages')
            .insert({
                group_chat_id: chatId,
                user_id: window.currentUser.id,
                message: shareData.message,
                is_win_share: true,
                win_type: shareData.type,
                win_details: shareData.details
            });

        if (error) throw error;

        closeQuickShareModal();
        showToast(`Shared to ${chatName}! 🎉`, 'success');
    } catch(e) {
        console.error('Error sharing to group chat:', e);
        showToast('Failed to share. Try again.', 'error');
    }
}

// Helper function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Build share message for external sharing (uses selected lift if any)
function buildWinShareMessage() {
    const shareData = getShareData();

    // Add branding for external shares based on share type
    switch (shareData.type) {
        case 'entire_workout':
            return `📋 ${shareData.message}\n\nTraining with Balance 🌱`;
        case 'exercise_all_sets':
            return `📊 ${shareData.message}\n\nTraining with Balance 🌱`;
        case 'multi_sets':
            return `🏋️ ${shareData.message}\n\nTraining with Balance 🌱`;
        case 'specific_lift':
            return `${shareData.message} Training with Balance 🌱`;
        case 'personal_best':
            return `🏆 ${shareData.message} Training with Balance 🌱`;
        case 'milestone':
            return `🌟 ${shareData.message} Training with Balance 🌱`;
        default:
            return `${shareData.message} Training with Balance 🌱`;
    }
}

// Share win to Facebook Messenger
function shareWinToMessenger() {
    const message = buildWinShareMessage();
    const appLink = window.location.origin;

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
        // Messenger deep link with text
        const messengerUrl = `fb-messenger://share?link=${encodeURIComponent(appLink)}&quote=${encodeURIComponent(message)}`;
        window.location.href = messengerUrl;
    } else {
        // Desktop FB Sharer fallback
        const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(appLink)}&quote=${encodeURIComponent(message)}`;
        window.open(fbUrl, '_blank', 'width=600,height=400');
    }

    // Close modal after short delay
    setTimeout(() => {
        closeQuickShareModal();
        showToast('Opening Share Dialog...', 'success');
    }, 300);
}

// Share win to WhatsApp
function shareWinToWhatsApp() {
    const message = buildWinShareMessage();

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');

    closeQuickShareModal();
    showToast('Opening WhatsApp...', 'success');
}

// Copy win message to clipboard
async function copyWinMessage() {
    const message = buildWinShareMessage();

    try {
        await navigator.clipboard.writeText(message);
        closeQuickShareModal();
        showToast('Copied to clipboard! 📋', 'success');
    } catch(e) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = message;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        closeQuickShareModal();
        showToast('Copied to clipboard! 📋', 'success');
    }
}

// ===========================
// SWIPE BACK NAVIGATION SYSTEM
// ===========================

// Platform detection for adaptive navigation
function getPlatform() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;

    // iOS detection
    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
        return 'ios';
    }

    // Android detection
    if (/android/i.test(userAgent)) {
        return 'android';
    }

    // Default to iOS-style for other platforms (web browsers, etc.)
    return 'ios';
}

// Store platform once at startup for consistent behavior
const devicePlatform = getPlatform();

function enableSwipeBackNavigation(viewId, backHandler) {
    const view = document.getElementById(viewId);
    if (!view) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    let isDragging = false;
    let overlayEl = null;

    const screenWidth = window.innerWidth;
    const isAndroid = devicePlatform === 'android';

    // Edge zone: 50px from the appropriate edge
    const edgeThreshold = 50;

    const handleTouchStart = (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
        isDragging = false;
    };

    const handleTouchMove = (e) => {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;

        const deltaX = touchEndX - touchStartX;
        const deltaY = Math.abs(e.changedTouches[0].screenY - touchStartY);

        // Platform-adaptive edge detection:
        // iOS: Swipe from LEFT edge, moving RIGHT (deltaX > 0)
        // Android: Swipe from RIGHT edge, moving LEFT (deltaX < 0)
        const isFromCorrectEdge = isAndroid
            ? (touchStartX > screenWidth - edgeThreshold && deltaX < -30)  // Right edge, swipe left
            : (touchStartX < edgeThreshold && deltaX > 30);                 // Left edge, swipe right

        const absDeltaX = Math.abs(deltaX);

        if (isFromCorrectEdge && deltaY < 100) {
            isDragging = true;

            // Create visual feedback overlay
            if (!overlayEl) {
                overlayEl = document.createElement('div');
                overlayEl.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.1);
                    pointer-events: none;
                    z-index: 9998;
                    opacity: 0;
                    transition: opacity 0.1s;
                `;
                document.body.appendChild(overlayEl);
            }

            // Transform the view based on swipe distance
            // iOS: slide right (positive), Android: slide left (negative)
            const progress = Math.min(absDeltaX / 200, 1);
            const translateX = isAndroid ? deltaX : deltaX;
            view.style.transform = `translateX(${translateX}px)`;
            view.style.transition = 'none';
            overlayEl.style.opacity = progress * 0.3;
        }
    };

    const handleTouchEnd = (e) => {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;

        const deltaX = touchEndX - touchStartX;
        const deltaY = Math.abs(touchEndY - touchStartY);
        const absDeltaX = Math.abs(deltaX);

        // Platform-adaptive completion check
        const isValidSwipe = isAndroid
            ? (touchStartX > screenWidth - edgeThreshold && deltaX < -100)  // Right edge, swiped left enough
            : (touchStartX < edgeThreshold && deltaX > 100);                 // Left edge, swiped right enough

        if (isValidSwipe && deltaY < 100 && isDragging) {
            // Animate out in the appropriate direction
            const exitDirection = isAndroid ? '-100%' : '100%';
            view.style.transition = 'transform 0.3s ease-out';
            view.style.transform = `translateX(${exitDirection})`;

            // Call back handler after animation
            setTimeout(() => {
                backHandler();
                view.style.transform = '';
                view.style.transition = '';
                if (overlayEl) {
                    overlayEl.remove();
                    overlayEl = null;
                }
            }, 300);
        } else if (isDragging) {
            // Reset position if swipe wasn't far enough
            view.style.transition = 'transform 0.3s ease-out';
            view.style.transform = '';
            setTimeout(() => {
                view.style.transition = '';
                if (overlayEl) {
                    overlayEl.remove();
                    overlayEl = null;
                }
            }, 300);
        }

        isDragging = false;
    };

    // Remove existing listeners to avoid duplicates
    view.removeEventListener('touchstart', handleTouchStart);
    view.removeEventListener('touchmove', handleTouchMove);
    view.removeEventListener('touchend', handleTouchEnd);

    // Add touch listeners
    view.addEventListener('touchstart', handleTouchStart, { passive: true });
    view.addEventListener('touchmove', handleTouchMove, { passive: true });
    view.addEventListener('touchend', handleTouchEnd, { passive: true });
}

// Initialize swipe-back navigation for all movement views
function initializeMovementSwipeNavigation() {
    // Main movement views
    enableSwipeBackNavigation('view-workout-library', () => {
        switchAppTab('movement-tab');
    });

    enableSwipeBackNavigation('view-prebuilt-programs', () => {
        switchAppTab('movement-tab');
    });

    enableSwipeBackNavigation('view-workout-subcategories', () => {
        closeWorkoutSubcategories();
    });

    enableSwipeBackNavigation('view-workout-list', () => {
        closeWorkoutList();
    });

    enableSwipeBackNavigation('view-workout-overview', () => {
        switchAppTab('movement-tab');
    });

    enableSwipeBackNavigation('view-active-workout', () => {
        quitWorkout();
    });

    enableSwipeBackNavigation('view-workout-success', () => {
        closeSuccessScreen();
    });

    // Log activity view
    enableSwipeBackNavigation('view-log-activity', () => {
        closeLogActivity();
    });

    // Your Workouts view
    enableSwipeBackNavigation('view-your-workouts', () => {
        closeYourWorkouts();
    });

    // Progress view
    enableSwipeBackNavigation('view-progress', () => {
        closeProgressView();
    });

    // Activity success view
    enableSwipeBackNavigation('view-activity-success', () => {
        closeActivitySuccess();
    });

    // Workout builder view
    enableSwipeBackNavigation('view-workout-builder', () => {
        switchAppTab('movement-tab');
    });

    // Program builder view
    enableSwipeBackNavigation('view-program-builder', () => {
        closeProgramBuilder();
    });

    // Challenge views
    enableSwipeBackNavigation('challenge-leaderboard-modal', () => {
        closeChallengeLeaderboard();
    });

    // Activity Insights view
    enableSwipeBackNavigation('view-insights', () => {
        closeInsightsView();
    });

    // Interval Timer view
    enableSwipeBackNavigation('view-interval-timer', () => {
        closeIntervalTimer();
    });

}

// Initialize swipe-back for Weekly Trends page (one-time setup)
function initializeWeeklyTrendsSwipeNavigation() {
    enableSwipeBackNavigation('weekly-trends-page', () => {
        const page = document.getElementById('weekly-trends-page');
        if (page) {
            // Immediately hide (display:none) so gesture cleanup doesn't flash
            page.classList.remove('active');
            page.style.transform = '';
            page.style.transition = '';
        }
        // Return to Nutrition tab
        const mealsBtn = document.querySelector('.bottom-nav .nav-item[onclick*="meals"]');
        if (mealsBtn) {
            switchAppTab('meals', mealsBtn);
        }
    });
}

function initializeMovementWeeklyTrendsSwipeNavigation() {
    enableSwipeBackNavigation('movement-weekly-trends-page', () => {
        const page = document.getElementById('movement-weekly-trends-page');
        if (page) {
            page.classList.remove('active');
            page.style.transform = '';
            page.style.transition = '';
        }
        // Return to Movement tab
        const movementBtn = document.querySelector('.bottom-nav .nav-item[onclick*="movement"]');
        if (movementBtn) {
            switchAppTab('movement-tab', movementBtn);
        }
    });
}

// Dynamic swipe-back for views that swap content in a single container (e.g. Learning tab)
function enableDynamicSwipeBackNavigation(viewId, getBackHandler) {
    const view = document.getElementById(viewId);
    if (!view) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    let isDragging = false;
    let overlayEl = null;
    let currentBackHandler = null;

    const screenWidth = window.innerWidth;
    const isAndroid = devicePlatform === 'android';
    const edgeThreshold = 50;

    const handleTouchStart = (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
        isDragging = false;
        currentBackHandler = getBackHandler();
    };

    const handleTouchMove = (e) => {
        if (!currentBackHandler) return;

        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;

        const deltaX = touchEndX - touchStartX;
        const deltaY = Math.abs(e.changedTouches[0].screenY - touchStartY);

        const isFromCorrectEdge = isAndroid
            ? (touchStartX > screenWidth - edgeThreshold && deltaX < -30)
            : (touchStartX < edgeThreshold && deltaX > 30);

        const absDeltaX = Math.abs(deltaX);

        if (isFromCorrectEdge && deltaY < 100) {
            isDragging = true;

            if (!overlayEl) {
                overlayEl = document.createElement('div');
                overlayEl.style.cssText = `
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.1); pointer-events: none;
                    z-index: 9998; opacity: 0; transition: opacity 0.1s;
                `;
                document.body.appendChild(overlayEl);
            }

            const progress = Math.min(absDeltaX / 200, 1);
            view.style.transform = `translateX(${deltaX}px)`;
            view.style.transition = 'none';
            overlayEl.style.opacity = progress * 0.3;
        }
    };

    const handleTouchEnd = (e) => {
        if (!currentBackHandler) return;

        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;

        const deltaX = touchEndX - touchStartX;
        const deltaY = Math.abs(touchEndY - touchStartY);

        const isValidSwipe = isAndroid
            ? (touchStartX > screenWidth - edgeThreshold && deltaX < -100)
            : (touchStartX < edgeThreshold && deltaX > 100);

        if (isValidSwipe && deltaY < 100 && isDragging) {
            const exitDirection = isAndroid ? '-100%' : '100%';
            view.style.transition = 'transform 0.3s ease-out';
            view.style.transform = `translateX(${exitDirection})`;

            setTimeout(() => {
                currentBackHandler();
                view.style.transform = '';
                view.style.transition = '';
                if (overlayEl) {
                    overlayEl.remove();
                    overlayEl = null;
                }
            }, 300);
        } else if (isDragging) {
            view.style.transition = 'transform 0.3s ease-out';
            view.style.transform = '';
            setTimeout(() => {
                view.style.transition = '';
                if (overlayEl) {
                    overlayEl.remove();
                    overlayEl = null;
                }
            }, 300);
        }

        isDragging = false;
    };

    view.addEventListener('touchstart', handleTouchStart, { passive: true });
    view.addEventListener('touchmove', handleTouchMove, { passive: true });
    view.addEventListener('touchend', handleTouchEnd, { passive: true });
}

// Initialize swipe-back for Learning tab with dynamic back handler
function initializeLearningSwipeNavigation() {
    enableDynamicSwipeBackNavigation('view-learning', () => {
        if (typeof window.getLearningBackAction === 'function') {
            const backAction = window.getLearningBackAction();
            if (backAction) {
                // Wrap the back action to also pop the browser history state,
                // keeping the custom swipe handler in sync with history.pushState
                // entries pushed by the learning navigation functions.
                return () => {
                    // Prevent the back action from pushing new history states
                    if (typeof window._setLearningNavigatingBack === 'function') {
                        window._setLearningNavigatingBack(true);
                    }
                    backAction();
                    if (typeof window._setLearningNavigatingBack === 'function') {
                        window._setLearningNavigatingBack(false);
                    }
                    // Pop the corresponding history entry
                    if (typeof window._popLearningHistoryState === 'function') {
                        window._learningSwipeHandledBack = true;
                        window._popLearningHistoryState();
                        history.back();
                    }
                };
            }
        }
        return null;
    });
}

// Initialize swipe-back for the user (friend) profile page
function initializeUserProfileSwipeNavigation() {
    enableSwipeBackNavigation('view-user-profile', () => {
        closeUserProfile();
    });
}

// Initialize swipe navigation when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeMovementSwipeNavigation();
    initializeWeeklyTrendsSwipeNavigation();
    initializeMovementWeeklyTrendsSwipeNavigation();
    initializeLearningSwipeNavigation();
    initializeUserProfileSwipeNavigation();
    initializeAndroidBackNavigation();
});

// ===========================
// ANDROID HARDWARE BACK BUTTON SUPPORT
// ===========================

// Navigation stack for Android back button
const navigationStack = [];

function pushNavigationState(viewId, backHandler) {
    // Only use history-based navigation on Android
    if (devicePlatform !== 'android') return;

    const state = { viewId, timestamp: Date.now() };
    navigationStack.push({ viewId, backHandler });
    history.pushState(state, '', window.location.href);
}

function popNavigationState() {
    return navigationStack.pop();
}

function clearNavigationStack() {
    navigationStack.length = 0;
}

function initializeAndroidBackNavigation() {
    // Only set up on Android
    if (devicePlatform !== 'android') return;

    // Handle browser/hardware back button via popstate
    window.addEventListener('popstate', (event) => {
        const navItem = popNavigationState();
        if (navItem && navItem.backHandler) {
            // Execute the back handler
            navItem.backHandler();
        }
    });
}

// Helper to navigate to a view with back support (Android)
function navigateToView(viewId, backHandler) {
    pushNavigationState(viewId, backHandler);
}

// ===========================
// WORKOUT LIBRARY FUNCTIONS
// ===========================

function openWorkoutLibrary() {
    renderWorkoutLibraryCategories();
    hideAllAppViews();
    document.getElementById('view-workout-library').style.display = 'block';
    document.querySelector('.bottom-nav').style.display = 'none';

    // Push navigation state for Android back button
    pushNavigationState('view-workout-library', () => switchAppTab('movement-tab'));
}

function renderWorkoutLibraryCategories() {
    const grid = document.getElementById('library-categories-grid');
    grid.innerHTML = '';

    Object.keys(WORKOUT_LIBRARY).forEach(categoryKey => {
        const category = WORKOUT_LIBRARY[categoryKey];

        grid.innerHTML += `
            <div class="library-category-card" onclick="openWorkoutSubcategories('${categoryKey}')">
                <div class="library-category-icon">${category.icon}</div>
                <div style="flex: 1;">
                    <div style="font-weight: 700; font-size: 1.1rem; margin-bottom: 5px;">${category.name}</div>
                    <div style="color: var(--text-muted); font-size: 0.85rem; line-height: 1.4;">${category.description}</div>
                </div>
                <svg viewBox="0 0 24 24" style="width: 24px; height: 24px; fill: var(--text-muted);">
                    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                </svg>
            </div>
        `;
    });
}

function openWorkoutSubcategories(categoryKey) {
    const category = WORKOUT_LIBRARY[categoryKey] || (typeof WORKOUT_LIBRARY_EXTENDED !== 'undefined' && WORKOUT_LIBRARY_EXTENDED[categoryKey]);

    // Set header
    document.getElementById('subcategory-header-title').textContent = category.name;
    document.getElementById('subcategory-description').textContent = category.description;

    // Render subcategories
    const grid = document.getElementById('subcategories-grid');
    grid.innerHTML = '';

    Object.keys(category.subcategories).forEach(subKey => {
        const subcategory = category.subcategories[subKey];
        const workoutCount = subcategory.workouts.length;

        grid.innerHTML += `
            <div class="library-category-card" onclick="openWorkoutList('${categoryKey}', '${subKey}')">
                <div style="flex: 1;">
                    <div style="font-weight: 700; font-size: 1.1rem; margin-bottom: 5px;">${subcategory.name}</div>
                    <div style="color: var(--text-muted); font-size: 0.85rem; line-height: 1.4;">${subcategory.description}</div>
                    <div style="color: var(--primary); font-size: 0.8rem; font-weight: 600; margin-top: 8px;">${workoutCount} workout${workoutCount > 1 ? 's' : ''}</div>
                </div>
                <svg viewBox="0 0 24 24" style="width: 24px; height: 24px; fill: var(--text-muted);">
                    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                </svg>
            </div>
        `;
    });

    // Show view
    document.getElementById('view-workout-subcategories').style.display = 'block';

    // Push navigation state for Android back button
    pushNavigationState('view-workout-subcategories', () => closeWorkoutSubcategories());
}

function closeWorkoutSubcategories() {
    document.getElementById('view-workout-subcategories').style.display = 'none';
}

function openWorkoutList(categoryKey, subcategoryKey) {
    const category = WORKOUT_LIBRARY[categoryKey] || (typeof WORKOUT_LIBRARY_EXTENDED !== 'undefined' && WORKOUT_LIBRARY_EXTENDED[categoryKey]);
    const subcategory = category.subcategories[subcategoryKey];

    // Set header
    document.getElementById('workout-list-header-title').textContent = subcategory.name;
    document.getElementById('workout-list-description').textContent = subcategory.description;

    // Render workouts
    const list = document.getElementById('workouts-list');
    list.innerHTML = '';

    subcategory.workouts.forEach(workout => {
        const difficultyClass = `difficulty-${workout.difficulty.toLowerCase()}`;

        // Create card element
        const card = document.createElement('div');
        card.className = 'workout-card';
        card.style.cssText = 'cursor: pointer; touch-action: manipulation; user-select: none; -webkit-tap-highlight-color: rgba(4, 106, 56, 0.1);';

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                <div style="flex: 1;">
                    <h3 style="margin: 0 0 8px 0; font-size: 1.1rem;">${workout.name}</h3>
                    <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                        <span class="workout-difficulty-badge ${difficultyClass}">${workout.difficulty}</span>
                        <span style="color: var(--text-muted); font-size: 0.85rem;">⏱ ${workout.duration}</span>
                        <span style="color: var(--text-muted); font-size: 0.85rem;">📝 ${workout.exercises.length} exercises</span>
                    </div>
                </div>
            </div>
            <div style="color: var(--text-muted); font-size: 0.85rem; margin-top: 10px;">
                <strong>Equipment:</strong> ${workout.equipment.join(', ')}
            </div>
        `;

        // Add click handler - directly start the workout (touch-action: manipulation already handles mobile responsiveness)
        card.addEventListener('click', () => {
            startLibraryWorkout(categoryKey, subcategoryKey, workout.id);
        });

        // Append to list
        list.appendChild(card);
    });

    // Show view
    document.getElementById('view-workout-list').style.display = 'block';

    // Push navigation state for Android back button
    pushNavigationState('view-workout-list', () => closeWorkoutList());
}

function closeWorkoutList() {
    document.getElementById('view-workout-list').style.display = 'none';
}

// ===========================
// PRE-BUILT PROGRAMS FUNCTIONS
// ===========================

function openPrebuiltPrograms() {
    renderPrebuiltPrograms();
    hideAllAppViews();
    document.getElementById('view-prebuilt-programs').style.display = 'block';
    document.querySelector('.bottom-nav').style.display = 'none';

    // Push navigation state for Android back button
    pushNavigationState('view-prebuilt-programs', () => switchAppTab('movement-tab'));
}

function renderPrebuiltPrograms() {
    const grid = document.getElementById('prebuilt-programs-grid');
    grid.innerHTML = '';

    // Define all available workout programs with their metadata
    const programs = [
        {
            key: 'gym',
            name: 'Full Gym Access',
            icon: '💪',
            description: 'Complete strength training with full gym equipment',
            gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            equipment: ['Barbell', 'Dumbbells', 'Cable Machines', 'Bench']
        },
        {
            key: 'gym_split',
            name: 'Male Gym Split',
            icon: '🏋️',
            description: '7-day gym program: Chest, Legs, Back, Shoulders, Arms+Core, Recovery',
            gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            equipment: ['Gym Access Required']
        },
        {
            key: 'female_gym_split',
            name: 'Female Gym Split',
            icon: '💫',
            description: 'Hormone-optimized 7-day split: Legs, Push, Pull, Arms, Active Recovery',
            gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            equipment: ['Gym Access Required']
        },
        {
            key: 'home_weights',
            name: 'At Home with Weights',
            icon: '🏠',
            description: 'Effective home workouts with dumbbells',
            gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            equipment: ['Dumbbells', 'Bench (optional)']
        },
        {
            key: 'bodyweight',
            name: 'At Home Bodyweight',
            icon: '🤸',
            description: 'No equipment needed - train anywhere, anytime',
            gradient: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
            equipment: ['No Equipment']
        },
        {
            key: 'yoga',
            name: 'Yoga & Mindful Movement',
            icon: '🧘',
            description: 'Restorative, power, yin, and vinyasa flows',
            gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
            equipment: ['Yoga Mat', 'Optional: Blocks']
        },
        {
            key: 'recovery',
            name: 'Recovery & Mobility',
            icon: '🌿',
            description: 'Stretching, mobility work, and active recovery',
            gradient: 'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)',
            equipment: ['No Equipment']
        },
        {
            key: 'bands',
            name: 'Resistance Bands',
            icon: '🔗',
            description: 'Full body training with resistance bands',
            gradient: 'linear-gradient(135deg, #fddb92 0%, #d1fdff 100%)',
            equipment: ['Resistance Bands']
        }
    ];

    programs.forEach(program => {
        const programDiv = document.createElement('div');
        programDiv.onclick = () => openProgramDetails(program.key);
        programDiv.style.cssText = `
            cursor:pointer;
            position:relative;
            min-height:200px;
            border-radius:20px;
            overflow:hidden;
            box-shadow:0 10px 30px rgba(0,0,0,0.15);
            background: ${program.gradient};
            transition: transform 0.2s, box-shadow 0.2s;
        `;

        programDiv.onmouseenter = function() {
            this.style.transform = 'translateY(-5px)';
            this.style.boxShadow = '0 15px 40px rgba(0,0,0,0.2)';
        };

        programDiv.onmouseleave = function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 10px 30px rgba(0,0,0,0.15)';
        };

        programDiv.innerHTML = `
            <div style="position: absolute; inset:0; background: linear-gradient(to bottom right, rgba(0,0,0,0.3), transparent);"></div>
            <div style="position: absolute; top: 20px; right: 20px; font-size: 3rem; opacity: 0.4;">${program.icon}</div>
            <div style="position: relative; padding: 25px; color: white; z-index: 1; height: 100%; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <div style="font-size: 0.75rem; font-weight: 800; opacity: 0.9; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 8px;">Program</div>
                    <div style="font-size: 1.3rem; font-weight: 800; line-height: 1.2; margin-bottom: 12px;">${program.name}</div>
                    <div style="font-size: 0.9rem; opacity: 0.95; line-height: 1.4; margin-bottom: 15px;">${program.description}</div>
                </div>
                <div>
                    <div style="font-size: 0.75rem; opacity: 0.8; margin-bottom: 5px;">Equipment:</div>
                    <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                        ${program.equipment.map(eq => `
                            <span style="background: rgba(255,255,255,0.25); padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">
                                ${eq}
                            </span>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        grid.appendChild(programDiv);
    });
}

function openProgramDetails(programKey) {
    // Check if program exists in WORKOUT_LIBRARY or WORKOUT_LIBRARY_EXTENDED
    let category = WORKOUT_LIBRARY[programKey] || (typeof WORKOUT_LIBRARY_EXTENDED !== 'undefined' && WORKOUT_LIBRARY_EXTENDED[programKey]);

    if (category) {
        // Open the program's subcategories view
        openWorkoutSubcategories(programKey);
    } else {
        // For gym_split and female_gym_split, show info modal
        showProgramInfoModal(programKey);
    }
}

function showProgramInfoModal(programKey) {
    const programInfo = {
        'gym_split': {
            name: 'Male Gym Split',
            schedule: [
                { day: 'Monday', workout: 'Chest Day', focus: 'Chest & Triceps' },
                { day: 'Tuesday', workout: 'Leg Day', focus: 'Quads, Hamstrings, Glutes' },
                { day: 'Wednesday', workout: 'Back Day', focus: 'Back & Biceps' },
                { day: 'Thursday', workout: 'Shoulder Day', focus: 'Shoulders & Traps' },
                { day: 'Friday', workout: 'Arms & Core', focus: 'Arms, Abs, Core' },
                { day: 'Saturday', workout: 'Active Recovery', focus: 'Yin Yoga' },
                { day: 'Sunday', workout: 'Rest', focus: 'Complete Rest' }
            ]
        },
        'female_gym_split': {
            name: 'Female Gym Split',
            schedule: [
                { day: 'Monday', workout: 'Leg Day', focus: 'Lower Body Strength' },
                { day: 'Tuesday', workout: 'Push Day', focus: 'Chest, Shoulders, Triceps' },
                { day: 'Wednesday', workout: 'Arms & Core', focus: 'Upper Body & Abs' },
                { day: 'Thursday', workout: 'Leg Day', focus: 'Lower Body Power' },
                { day: 'Friday', workout: 'Pull Day', focus: 'Back & Biceps' },
                { day: 'Saturday', workout: 'Active Recovery', focus: 'Power Yoga' },
                { day: 'Sunday', workout: 'Rest', focus: 'Yin Yoga or Rest' }
            ]
        }
    };

    const info = programInfo[programKey];
    if (!info) return;

    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px;';

    modal.innerHTML = `
        <div style="background: white; border-radius: 20px; max-width: 500px; width: 100%; max-height: 80vh; overflow-y: auto; padding: 30px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; color: var(--text-main);">${info.name}</h2>
                <div onclick="this.parentElement.parentElement.parentElement.remove()" style="cursor: pointer; font-size: 1.5rem; color: var(--text-muted);">&times;</div>
            </div>

            <p style="color: var(--text-muted); margin-bottom: 25px;">This program is automatically assigned based on your profile. View your weekly schedule in the Movement tab.</p>

            <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 15px 0; font-size: 1rem; color: var(--text-main);">Weekly Schedule</h3>
                ${info.schedule.map((item, idx) => `
                    <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: ${idx < info.schedule.length - 1 ? '1px solid #e2e8f0' : 'none'};">
                        <div>
                            <div style="font-weight: 700; color: var(--text-main);">${item.day}</div>
                            <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 2px;">${item.focus}</div>
                        </div>
                        <div style="font-weight: 600; color: var(--primary); text-align: right;">
                            ${item.workout}
                        </div>
                    </div>
                `).join('')}
            </div>

            <button onclick="this.parentElement.parentElement.remove(); switchAppTab('movement-tab');"
                    style="width: 100%; background: var(--primary); color: white; border: none; padding: 15px; border-radius: 12px; font-weight: 700; font-size: 1rem; cursor: pointer;">
                View Today's Workout
            </button>
        </div>
    `;

    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };

    document.body.appendChild(modal);
}

function openLibraryWorkoutOverview(categoryKey, subcategoryKey, workoutId) {
    const category = WORKOUT_LIBRARY[categoryKey];
    const subcategory = category.subcategories[subcategoryKey];
    const workout = subcategory.workouts.find(w => w.id === workoutId);

    if (!workout) {
        console.error('Workout not found:', workoutId);
        return;
    }

    // Set header
    document.getElementById('overview-header-title').textContent = 'Workout Overview';

    // Set title and meta
    document.getElementById('overview-title').textContent = workout.name;
    document.getElementById('overview-meta').textContent = `${workout.duration} · ${workout.exercises.length} Exercises`;

    // Set equipment
    const equipmentContainer = document.getElementById('overview-equipment');
    equipmentContainer.innerHTML = '';
    workout.equipment.forEach(item => {
        equipmentContainer.innerHTML += `
            <span style="background: #f1f5f9; padding: 6px 14px; border-radius: 20px; font-size: 0.85rem; font-weight: 500; color: var(--text-main);">
                ${item}
            </span>
        `;
    });

    // Set instructions - different for yoga
    const isYogaWorkout = categoryKey === 'yoga';
    const instructionsText = isYogaWorkout
        ? `This is a ${workout.difficulty.toLowerCase()} level ${subcategory.name.toLowerCase()} practice. Hold each pose for the specified time, breathing deeply and moving mindfully.`
        : `This is a ${workout.difficulty.toLowerCase()} level ${subcategory.name.toLowerCase()} workout. Complete all exercises in order, resting as needed between sets.`;
    document.getElementById('overview-instructions').textContent = instructionsText;

    // Set exercise list
    const exList = document.getElementById('overview-exercise-list');
    exList.innerHTML = '';
    workout.exercises.forEach(ex => {
        // For yoga, show time icon and duration. For others, show sets x reps
        const exerciseMetaHtml = isYogaWorkout
            ? `<div style="color:var(--text-muted); font-size:0.85rem; display:flex; align-items:center; gap:5px;">
                <svg viewBox="0 0 24 24" style="width:14px; height:14px; fill:currentColor;"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
                ${ex.reps}
               </div>`
            : `<div style="color:var(--text-muted); font-size:0.85rem;">${ex.sets} sets x ${ex.reps}</div>`;

        exList.innerHTML += `
            <div style="display:flex; align-items:center; gap:15px; margin-bottom:20px;">
                <div style="width:70px; height:70px; border-radius:12px; background:#f1f5f9; flex-shrink:0; overflow:hidden;">
                    <img src="https://placehold.co/100x100/png?text=Ex" style="width:100%; height:100%; object-fit:cover;">
                </div>
                <div style="flex:1;">
                    <div style="font-weight:700; font-size:1.05rem;">${ex.name}</div>
                    ${exerciseMetaHtml}
                    <div style="color:var(--text-muted); font-size:0.8rem; margin-top:3px;">${ex.desc}</div>
                </div>
            </div>
        `;
    });

    // Set start button to launch library workout
    document.getElementById('btn-start-now').onclick = () => startLibraryWorkout(categoryKey, subcategoryKey, workoutId);

    // Show view
    hideAllAppViews();
    document.getElementById('view-workout-overview').style.display = 'block';
    document.querySelector('.bottom-nav').style.display = 'none';

    // Push navigation state for Android back button
    pushNavigationState('view-workout-overview', () => switchAppTab('movement-tab'));
}

// Store current workout key globally for customizations
window.currentWorkoutKey = null;
window.currentWorkoutCustomizations = null;

async function startLibraryWorkout(categoryKey, subcategoryKey, workoutId) {
    const category = WORKOUT_LIBRARY[categoryKey];
    const subcategory = category.subcategories[subcategoryKey];
    const workout = subcategory.workouts.find(w => w.id === workoutId);

    if (!workout) {
        console.error('Workout not found:', workoutId);
        return;
    }

    // Clear custom workout tracking (this is a library workout, not custom)
    window.currentCustomWorkoutId = null;

    // Store current workout key for customizations
    window.currentWorkoutKey = `${categoryKey}/${subcategoryKey}/${workoutId}`;

    // Preload history if user is logged in
    const user = window.currentUser;
    let customizations = null;
    if (user) {
        try {
            const rawHistory2 = await dbHelpers.workouts.getHistory(user.id);
            window.workoutHistoryCache = normalizeHistoryCache(rawHistory2);
            // Load workout customizations
            customizations = await dbHelpers.workoutCustomizations.get(user.id, window.currentWorkoutKey);
            window.currentWorkoutCustomizations = customizations;
        } catch(e) {
            console.error("Failed to load history/customizations", e);
        }
    }

    // Build exercise list with customizations applied
    let exercises = [...workout.exercises];

    // Apply customizations if they exist
    if (customizations) {
        // Filter out removed exercises
        const removedExercises = customizations.removed_exercises || [];
        exercises = exercises.filter(ex => !removedExercises.includes(ex.name));

        // Add user-added exercises at the end
        const addedExercises = customizations.added_exercises || [];
        exercises = exercises.concat(addedExercises.map(ex => ({
            ...ex,
            isUserAdded: true
        })));
    }

    // Preload personal bests for all exercises in this workout
    if (user) {
        try {
            const exerciseNames = exercises.map(ex => ex.name);
            window.personalBestsCache = await dbHelpers.personalBests.getForExercises(user.id, exerciseNames);
        } catch(e) { console.error("Failed to load personal bests", e); window.personalBestsCache = {}; }
    }

    // Set workout title and goal
    document.getElementById('workout-player-title').textContent = workout.name;
    window.currentWorkoutName = workout.name;
    const exerciseCount = exercises.length;
    document.getElementById('workout-player-goal').textContent = `${workout.difficulty} · ${workout.duration} · ${exerciseCount} Exercise${exerciseCount !== 1 ? 's' : ''}`;

    // Start timer
    window.workoutStartTime = Date.now();
    window.workoutTimer = setInterval(() => {
        const elapsed = Date.now() - window.workoutStartTime;
        const mins = Math.floor(elapsed / 60000);
        const secs = Math.floor((elapsed % 60000) / 1000);
        document.getElementById('workout-timer').textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
    }, 1000);

    // Render exercises - use yoga-specific renderer for yoga workouts
    const isYogaWorkout = categoryKey === 'yoga';
    if (isYogaWorkout) {
        clearAllYogaTimers();
        renderYogaExercises(exercises);
    } else {
        renderWorkoutExercises(exercises);
    }

    // Show workout player
    hideAllAppViews();
    document.getElementById('view-active-workout').style.display = 'block';
    document.querySelector('.bottom-nav').style.display = 'none';

    // Push navigation state for Android back button
    pushNavigationState('view-active-workout', () => quitWorkout());

    // Show total volume popup and tracker
    showLastVolumePopup();

    // Show workout Spotify bar if music is playing
    if (typeof syncWorkoutSpotifyBar === 'function') syncWorkoutSpotifyBar();
}

// Render workout exercises with delete buttons, history summary, and volume tracking
function renderWorkoutExercises(exercises) {
    const container = document.getElementById('workout-exercises-list');
    container.innerHTML = '';

    exercises.forEach((ex, idx) => {
        const card = document.createElement('div');
        card.className = 'exercise-logger-card';
        card.setAttribute('data-exercise-name', ex.name);
        card.setAttribute('data-is-user-added', ex.isUserAdded || false);
        card.style.cssText = 'background:white; border-radius:24px; box-shadow:0 10px 30px rgba(0,0,0,0.05); margin-bottom:25px; overflow:hidden; border:1px solid #f1f5f9;';

        const videoUrl = findVideoMatch(ex.name);
        const previousSummaryHtml = formatPreviousWorkoutSummary(ex.name);
        const previousSummary = getPreviousWorkoutSummary(ex.name);
        const isUserAdded = ex.isUserAdded || false;
        const escapedName = ex.name.replace(/'/g, "\\'");

        const prescribedSets = ex.sets || 3;
        const numSets = previousSummary && previousSummary.setCount > 0 ? previousSummary.setCount : prescribedSets;
        const setsHtml = Array.from({length: numSets}, (_, setIdx) => {
            const prevSet = previousSummary && previousSummary.sets[setIdx] ? previousSummary.sets[setIdx] : null;
            return getSetRowHtml(ex.name, setIdx + 1, false, prevSet);
        }).join('');

        card.innerHTML = `
            <div style="padding: 15px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                            <span style="font-weight: 700; font-size: 1.05rem;">${ex.name}</span>
                            ${isUserAdded ? '<span style="background: var(--primary); color: white; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; font-weight: 600;">ADDED</span>' : ''}
                        </div>
                        <div style="color: var(--text-muted); font-size: 0.85rem;">${ex.desc || ''}</div>
                        ${previousSummaryHtml}
                    </div>
                    <button onclick="deleteExerciseFromWorkout('${escapedName}', ${isUserAdded})" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 5px; font-size: 0.8rem; font-weight: 600;">
                        <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: currentColor;">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                    </button>
                </div>
            </div>

            ${videoUrl ? `
            <div data-video-container style="position: relative; width: 100%; padding-top: 56.25%; background: black; cursor: pointer;" onclick="playInlineVideo(event, '${videoUrl}')">
                <video style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;" preload="metadata" muted playsinline>
                    <source src="${videoUrl}" type="video/mp4">
                </video>
                <div class="inline-play-overlay" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 60px; height: 60px; background: rgba(255,255,255,0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                    <svg viewBox="0 0 24 24" style="width: 30px; height: 30px; fill: var(--primary); margin-left: 3px;">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                </div>
            </div>` : ''}

            ${getVolumeDisplayHtml(ex.name)}

            <div style="display:grid; grid-template-columns:40px 1fr 1fr 1fr 32px 32px; gap:8px; padding:10px 15px 0 15px; font-size:0.7rem; color:#94a3b8; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; text-align:center;">
                <div>Set</div><div>Time</div><div>Reps</div><div>Kg</div><div></div><div></div>
            </div>

            <div class="sets-list-container">
                ${setsHtml}
            </div>

            <div style="padding:15px; border-top:1px solid #f8fafc;">
                <button onclick="addWorkoutSet(this, '${escapedName}', false)" style="width:100%; background:transparent; border:2px dashed #e2e8f0; color:#94a3b8; font-weight:700; font-size:0.8rem; padding:12px; border-radius:12px; cursor:pointer;">+ ADD SET</button>
            </div>
        `;
        container.appendChild(card);

        // Setup volume tracking for this card
        setupVolumeTracking(card);
    });
}

// Render yoga exercises with individual timers
function renderYogaExercises(exercises) {
    const container = document.getElementById('workout-exercises-list');
    container.innerHTML = '';

    exercises.forEach((ex, idx) => {
        const videoUrl = findVideoMatch(ex.name);
        const isUserAdded = ex.isUserAdded || false;
        const escapedName = ex.name.replace(/'/g, "\\'");

        // Parse the time from the reps field
        const timeSeconds = parseYogaTimeToSeconds(ex.reps);
        const timeDisplay = formatYogaTime(timeSeconds);
        const circumference = 2 * Math.PI * 54; // SVG circle radius 54

        // Initialize timer state
        window.yogaTimers[idx] = {
            total: timeSeconds,
            remaining: timeSeconds,
            isRunning: false,
            interval: null
        };

        // Check if "each" is mentioned (for bilateral poses)
        const isEachSide = ex.reps && ex.reps.toLowerCase().includes('each');

        container.innerHTML += `
            <div class="exercise-logger-card yoga-exercise-card" data-exercise-name="${ex.name}" data-is-user-added="${isUserAdded}" data-exercise-idx="${idx}">
                <div style="padding: 15px; background: linear-gradient(135deg, #f0fdf4 0%, #f8fafc 100%); border-bottom: 1px solid #e2e8f0;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                                <span style="font-weight: 700; font-size: 1.05rem;">${ex.name.replace('Yoga - ', '')}</span>
                                ${isUserAdded ? '<span style="background: var(--primary); color: white; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; font-weight: 600;">ADDED</span>' : ''}
                            </div>
                            <div style="color: var(--text-muted); font-size: 0.85rem;">${ex.desc || ''}</div>
                            ${isEachSide ? '<div style="color: var(--primary); font-size: 0.75rem; margin-top: 4px; font-weight: 600;">⟳ Repeat on each side</div>' : ''}
                        </div>
                        <button onclick="deleteExerciseFromWorkout('${escapedName}', ${isUserAdded})" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 5px; font-size: 0.8rem; font-weight: 600;">
                            <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: currentColor;">
                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                            </svg>
                        </button>
                    </div>
                </div>

                ${videoUrl ? `
                <div data-video-container style="position: relative; width: 100%; padding-top: 56.25%; background: black; cursor: pointer;" onclick="playInlineVideo(event, '${videoUrl}')">
                    <video style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;" preload="metadata" muted playsinline>
                        <source src="${videoUrl}" type="video/mp4">
                    </video>
                    <div class="inline-play-overlay" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 60px; height: 60px; background: rgba(255,255,255,0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                        <svg viewBox="0 0 24 24" style="width: 30px; height: 30px; fill: var(--primary); margin-left: 3px;">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                    </div>
                </div>` : ''}

                <!-- Yoga Timer Section -->
                <div class="yoga-timer-section" style="padding: 20px; display: flex; flex-direction: column; align-items: center; gap: 15px;">
                    <!-- Circular Timer Display -->
                    <div style="position: relative; width: 130px; height: 130px;">
                        <svg viewBox="0 0 120 120" style="width: 100%; height: 100%; transform: rotate(-90deg);">
                            <!-- Background circle -->
                            <circle cx="60" cy="60" r="54" fill="none" stroke="#e2e8f0" stroke-width="8"/>
                            <!-- Progress circle -->
                            <circle id="yoga-timer-progress-${idx}" cx="60" cy="60" r="54" fill="none" stroke="var(--primary)" stroke-width="8"
                                stroke-linecap="round"
                                stroke-dasharray="${circumference}"
                                stroke-dashoffset="${circumference}"
                                style="transition: stroke-dashoffset 0.5s ease;"/>
                        </svg>
                        <!-- Timer text in center -->
                        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
                            <div id="yoga-timer-display-${idx}" style="font-size: 1.8rem; font-weight: 800; color: var(--text-main); font-family: monospace;">${timeDisplay}</div>
                            <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px;">${ex.reps}</div>
                        </div>
                    </div>

                    <!-- Timer Controls -->
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <button id="yoga-timer-start-${idx}" onclick="startYogaTimer(${idx})"
                            style="background: var(--primary); color: white; border: none; padding: 12px 28px; border-radius: 25px; font-weight: 700; font-size: 0.9rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(34,197,94,0.3);">
                            <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: currentColor;"><path d="M8 5v14l11-7z"/></svg>
                            Start
                        </button>
                        <button id="yoga-timer-pause-${idx}" onclick="pauseYogaTimer(${idx})"
                            style="background: #f59e0b; color: white; border: none; padding: 12px 20px; border-radius: 25px; font-weight: 700; font-size: 0.9rem; cursor: pointer; display: none; align-items: center; gap: 6px;">
                            <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: currentColor;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                            Pause
                        </button>
                        <button id="yoga-timer-reset-${idx}" onclick="resetYogaTimer(${idx})"
                            style="background: #e2e8f0; color: var(--text-main); border: none; padding: 12px 20px; border-radius: 25px; font-weight: 700; font-size: 0.9rem; cursor: pointer; display: none; align-items: center; gap: 6px;">
                            <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: currentColor;"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
                            Reset
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
}

// Delete exercise from workout
async function deleteExerciseFromWorkout(exerciseName, isUserAdded) {
    const user = window.currentUser;
    const workoutKey = window.currentWorkoutKey;

    if (!user || !workoutKey) {
        // Just remove from DOM if not logged in
        const card = document.querySelector(`.exercise-logger-card[data-exercise-name="${exerciseName}"]`);
        if (card && confirm('Remove this exercise from today\'s workout?')) {
            card.remove();
        }
        return;
    }

    // Ask user if they want to save this permanently
    const saveChoice = confirm(`Remove "${exerciseName}" from this workout?\n\nClick OK to remove it permanently (it won't show next time).\nClick Cancel to keep it.`);

    if (!saveChoice) return;

    try {
        // Remove from database
        await dbHelpers.workoutCustomizations.removeExercise(user.id, workoutKey, exerciseName);

        // Remove from DOM
        const card = document.querySelector(`.exercise-logger-card[data-exercise-name="${exerciseName}"]`);
        if (card) {
            card.remove();
        }

        // Update exercise count in header
        const remainingExercises = document.querySelectorAll('.exercise-logger-card').length;
        const goalEl = document.getElementById('workout-player-goal');
        if (goalEl) {
            const currentText = goalEl.textContent;
            goalEl.textContent = currentText.replace(/\d+ Exercise[s]?/, `${remainingExercises} Exercise${remainingExercises !== 1 ? 's' : ''}`);
        }

        console.log(`Exercise "${exerciseName}" removed from workout`);
    } catch (e) {
        console.error('Failed to remove exercise:', e);
        alert('Failed to remove exercise. Please try again.');
    }
}

// Open add exercise modal
function openAddExerciseModal() {
    document.getElementById('add-exercise-modal').style.display = 'block';
    document.getElementById('add-exercise-search').value = '';
    document.getElementById('add-exercise-results').innerHTML = `
        <div style="text-align: center; padding: 40px; color: #94a3b8;">
            Type to search for exercises from your library
        </div>
    `;
    document.getElementById('add-exercise-search').focus();

    // Preload custom exercises for search
    if (window.currentUser && typeof dbHelpers !== 'undefined' && dbHelpers.customExercises) {
        dbHelpers.customExercises.getAll(window.currentUser.id).then(exercises => {
            window._customExercisesCache = exercises || [];
        }).catch(() => {});
    }
}

// Close add exercise modal
function closeAddExerciseModal() {
    document.getElementById('add-exercise-modal').style.display = 'none';
}

// ========== BULK ENTRY FUNCTIONS ==========

function openBulkEntryModal() {
    document.getElementById('bulk-entry-modal').style.display = 'block';
    document.getElementById('bulk-entry-input').value = '';
    document.getElementById('bulk-entry-preview').style.display = 'none';

    // Check if this is first time using Quick Entry
    const hasSeenTutorial = localStorage.getItem('quickEntryTutorialSeen');
    if (!hasSeenTutorial) {
        showQuickEntryTutorial();
    } else {
        document.getElementById('bulk-entry-input').focus();
    }
}

function closeBulkEntryModal() {
    document.getElementById('bulk-entry-modal').style.display = 'none';
}

function showQuickEntryTutorial() {
    const modal = document.getElementById('quick-entry-tutorial-modal');
    modal.style.display = 'flex';
}

function closeQuickEntryTutorial() {
    const modal = document.getElementById('quick-entry-tutorial-modal');
    modal.style.display = 'none';
    localStorage.setItem('quickEntryTutorialSeen', 'true');
    document.getElementById('bulk-entry-input').focus();
}

// Parse bulk entry text into structured workout data
function parseBulkEntry(text) {
    if (!text || text.trim().length === 0) return null;

    const input = text.trim().toLowerCase();

    // Try to find the exercise name by matching against known exercises
    const allExercises = typeof EXERCISE_VIDEOS !== 'undefined' ? Object.keys(EXERCISE_VIDEOS) : [];
    let matchedExercise = null;
    let remainingText = input;

    // Sort exercises by length (longest first) to match most specific first
    const sortedExercises = allExercises.sort((a, b) => b.length - a.length);

    for (const exercise of sortedExercises) {
        const exerciseLower = exercise.toLowerCase();
        if (input.includes(exerciseLower)) {
            matchedExercise = exercise;
            remainingText = input.replace(exerciseLower, '').trim();
            break;
        }
    }

    // If no exact match, try to find by keywords
    if (!matchedExercise) {
        // Extract potential exercise name (words that aren't numbers or units)
        const words = input.split(/\s+/);
        const exerciseWords = [];
        const numberPattern = /^\d+(\.\d+)?(kg|lbs?|reps?|sets?|x)?$/i;
        const multiplierPattern = /^x\d+$/i;

        for (const word of words) {
            if (!numberPattern.test(word) && !multiplierPattern.test(word) &&
                !['sets', 'set', 'reps', 'rep', 'kg', 'lbs', 'x'].includes(word)) {
                exerciseWords.push(word);
            }
        }

        if (exerciseWords.length > 0) {
            const searchTerm = exerciseWords.join(' ');
            // Find best matching exercise
            for (const exercise of sortedExercises) {
                const exerciseLower = exercise.toLowerCase();
                if (exerciseWords.every(word => exerciseLower.includes(word))) {
                    matchedExercise = exercise;
                    break;
                }
            }
            remainingText = input;
            for (const word of exerciseWords) {
                remainingText = remainingText.replace(new RegExp('\\b' + word + '\\b', 'gi'), '').trim();
            }
        }
    }

    if (!matchedExercise) {
        return { error: 'Could not identify exercise. Try including the full exercise name.' };
    }

    // Parse the numbers and create sets
    const sets = [];

    // Pattern 1: "60x10 70x8 80x6" format (weight x reps)
    const weightXRepsPattern = /(\d+(?:\.\d+)?)\s*x\s*(\d+)/gi;
    let wxrMatches = [...remainingText.matchAll(weightXRepsPattern)];

    if (wxrMatches.length > 0) {
        for (const match of wxrMatches) {
            sets.push({ kg: match[1], reps: match[2] });
        }
        return { exercise: matchedExercise, sets };
    }

    // Pattern 2: "80kg 8 reps x3" or "80kg 8reps x3" format (same weight/reps repeated)
    const repeatPattern = /(\d+(?:\.\d+)?)\s*(?:kg)?\s*(\d+)\s*(?:reps?)?\s*x\s*(\d+)/i;
    const repeatMatch = remainingText.match(repeatPattern);

    if (repeatMatch) {
        const kg = repeatMatch[1];
        const reps = repeatMatch[2];
        const count = parseInt(repeatMatch[3]);
        for (let i = 0; i < count; i++) {
            sets.push({ kg, reps });
        }
        return { exercise: matchedExercise, sets };
    }

    // Pattern 3: Just numbers separated by spaces/commas (weights for each set)
    // e.g., "30 40 60" or "30, 40, 60" or "30kg 40kg 60kg"
    const numbersOnly = remainingText.replace(/[,]/g, ' ').replace(/kg|lbs?/gi, '');
    const numbers = numbersOnly.match(/\d+(?:\.\d+)?/g);

    if (numbers && numbers.length > 0) {
        // Check if numbers alternate (weight, reps, weight, reps)
        // If we have pairs and they look like weight/rep pairs
        if (numbers.length >= 2 && numbers.length % 2 === 0) {
            const couldBePairs = numbers.every((n, i) => {
                if (i % 2 === 0) return parseFloat(n) >= 10; // weights typically >= 10
                return parseFloat(n) <= 30; // reps typically <= 30
            });

            if (couldBePairs && numbers.length >= 4) {
                // Treat as weight/rep pairs
                for (let i = 0; i < numbers.length; i += 2) {
                    sets.push({ kg: numbers[i], reps: numbers[i + 1] });
                }
                return { exercise: matchedExercise, sets };
            }
        }

        // Otherwise treat all numbers as weights (default 8-12 reps)
        for (const num of numbers) {
            sets.push({ kg: num, reps: '' });
        }
        return { exercise: matchedExercise, sets };
    }

    // Fallback: just create the exercise with 3 empty sets
    return { exercise: matchedExercise, sets: [{ kg: '', reps: '' }, { kg: '', reps: '' }, { kg: '', reps: '' }] };
}

// Preview the bulk entry as user types
function previewBulkEntry() {
    const input = document.getElementById('bulk-entry-input').value;
    const previewContainer = document.getElementById('bulk-entry-preview');
    const previewContent = document.getElementById('bulk-entry-preview-content');

    if (!input || input.trim().length < 3) {
        previewContainer.style.display = 'none';
        return;
    }

    const result = parseBulkEntry(input);

    if (!result || result.error) {
        previewContainer.style.display = 'block';
        previewContent.innerHTML = `
            <div style="padding: 15px; color: #ef4444; text-align: center;">
                ${result?.error || 'Could not parse input. Try: "bench press 30 40 60"'}
            </div>
        `;
        return;
    }

    previewContainer.style.display = 'block';

    let setsHtml = result.sets.map((set, idx) => `
        <div style="display: grid; grid-template-columns: 40px 1fr 1fr; gap: 10px; padding: 10px 15px; border-top: 1px solid #f1f5f9; align-items: center;">
            <div style="font-weight: 700; color: #94a3b8; text-align: center;">${idx + 1}</div>
            <div style="text-align: center; font-weight: 600;">${set.kg || '-'} kg</div>
            <div style="text-align: center; font-weight: 600;">${set.reps || '-'} reps</div>
        </div>
    `).join('');

    previewContent.innerHTML = `
        <div style="padding: 15px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <div style="font-weight: 700; color: var(--text-main);">${result.exercise}</div>
            <div style="font-size: 0.85rem; color: var(--primary); margin-top: 3px;">${result.sets.length} set${result.sets.length !== 1 ? 's' : ''}</div>
        </div>
        <div style="display: grid; grid-template-columns: 40px 1fr 1fr; gap: 10px; padding: 8px 15px; font-size: 0.75rem; color: #94a3b8; font-weight: 700; text-transform: uppercase;">
            <div style="text-align: center;">Set</div>
            <div style="text-align: center;">Weight</div>
            <div style="text-align: center;">Reps</div>
        </div>
        ${setsHtml}
    `;
}

// Process bulk entry and add to workout
function processBulkEntry() {
    const input = document.getElementById('bulk-entry-input').value;
    const result = parseBulkEntry(input);

    if (!result || result.error) {
        alert(result?.error || 'Could not parse input. Please check the format.');
        return;
    }

    // Add exercise to workout with pre-filled sets
    addExerciseWithSets(result.exercise, result.sets);
    closeBulkEntryModal();
}

// Add exercise with pre-filled set values
function addExerciseWithSets(exerciseName, sets) {
    const container = document.getElementById('workout-exercises-list');
    const videoUrl = findVideoMatch(exerciseName);
    const previousSummaryHtml = formatPreviousWorkoutSummary(exerciseName);
    const previousSummary = getPreviousWorkoutSummary(exerciseName);
    const escapedName = exerciseName.replace(/'/g, "\\'");

    const setsHtml = sets.map((set, idx) => {
        return `
            <div class="set-wrapper">
                <div class="workout-set-row" style="display: grid; grid-template-columns: 40px 1fr 1fr 1fr 32px 32px; gap: 8px; align-items: center; padding: 10px 15px; border-top: 1px solid #f8fafc;">
                    <div style="font-weight: 800; color: #94a3b8; font-size: 0.85rem; text-align: center;">${idx + 1}</div>
                    <input type="text" class="input-time" placeholder="-" style="width:100%; border: none; background: #f8fafc; border-radius: 8px; padding: 10px 5px; text-align: center; font-weight: 700; color: var(--text-main); font-size: 0.9rem;">
                    <input type="text" class="input-reps" placeholder="Reps" value="${set.reps || ''}" style="width:100%; border: none; background: #f8fafc; border-radius: 8px; padding: 10px 5px; text-align: center; font-weight: 700; color: var(--text-main); font-size: 0.9rem;">
                    <input type="text" class="input-kg" placeholder="Kg" value="${set.kg || ''}" style="width:100%; border: none; background: #f8fafc; border-radius: 8px; padding: 10px 5px; text-align: center; font-weight: 700; color: var(--text-main); font-size: 0.9rem;">
                    <button class="drop-set-toggle" onclick="toggleDropSet(this)" title="Toggle Drop Set">DS</button>
                    <button class="delete-set-btn" onclick="deleteSetRow(this)" title="Delete Set" style="width:32px; height:32px; border:none; background:transparent; color:#ef4444; cursor:pointer; border-radius:8px; display:flex; align-items:center; justify-content:center; transition:background 0.2s;"><svg viewBox="0 0 24 24" style="width:16px; height:16px; fill:currentColor;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
                </div>
                <div class="drop-set-container">
                    <div class="drop-set-inputs">
                        <div class="drop-set-row">
                            <div class="drop-indicator">↓1</div>
                            <input type="text" class="drop-reps" placeholder="Reps">
                            <input type="text" class="drop-kg" placeholder="Kg">
                            <button class="drop-add-btn" onclick="addDropRow(this)">+</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    const exerciseHtml = `
        <div class="exercise-logger-card" data-exercise-name="${exerciseName}" data-is-user-added="true" style="background:white; border-radius:24px; box-shadow:0 10px 30px rgba(0,0,0,0.05); margin-bottom:25px; overflow:hidden; border:1px solid #f1f5f9; animation: slideInUp 0.3s ease;">
            <div style="padding: 15px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                            <span style="font-weight: 700; font-size: 1.05rem;">${exerciseName}</span>
                            <span style="background: var(--primary); color: white; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; font-weight: 600;">QUICK</span>
                        </div>
                        <div style="color: var(--text-muted); font-size: 0.85rem;">Added via quick entry</div>
                        ${previousSummaryHtml}
                    </div>
                    <button onclick="deleteExerciseFromWorkout('${escapedName}', true)" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 5px; font-size: 0.8rem; font-weight: 600;">
                        <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: currentColor;">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                    </button>
                </div>
            </div>

            ${videoUrl ? `
            <div data-video-container style="position: relative; width: 100%; padding-top: 56.25%; background: black; cursor: pointer;" onclick="playInlineVideo(event, '${videoUrl}')">
                <video style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;" preload="metadata" muted playsinline>
                    <source src="${videoUrl}" type="video/mp4">
                </video>
                <div class="inline-play-overlay" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 60px; height: 60px; background: rgba(255,255,255,0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                    <svg viewBox="0 0 24 24" style="width: 30px; height: 30px; fill: var(--primary); margin-left: 3px;">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                </div>
            </div>` : ''}

            <!-- Volume Tracker -->
            <div class="volume-display" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%); border-bottom: 1px solid #fef08a;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: #ca8a04;"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
                    <span style="font-size: 0.75rem; font-weight: 700; color: #a16207; text-transform: uppercase;">Volume</span>
                </div>
                <div style="text-align: right;">
                    <div class="volume-value" style="font-size: 1rem; font-weight: 800; color: #854d0e;">0 kg</div>
                    <div class="volume-comparison" style="font-size: 0.7rem; font-weight: 600;">${previousSummary && previousSummary.totalVolume > 0 ? `<span style="color: #94a3b8;">Last: ${previousSummary.totalVolume.toLocaleString()} kg — beat it!</span>` : '<span style="color: #94a3b8;">Enter weight & reps</span>'}</div>
                </div>
                <div class="volume-progress-container" style="display: ${previousSummary && previousSummary.totalVolume > 0 ? 'block' : 'none'}; margin-top: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span class="volume-target-label" style="font-size: 0.65rem; font-weight: 600; color: #a16207;">Target: ${previousSummary && previousSummary.totalVolume > 0 ? previousSummary.totalVolume.toLocaleString() + ' kg' : '—'}</span>
                        <span class="volume-percentage" style="font-size: 0.65rem; font-weight: 700; color: #a16207;">0%</span>
                    </div>
                    <div style="height: 6px; background: #fef08a; border-radius: 3px; overflow: hidden;">
                        <div class="volume-progress-bar" style="height: 100%; width: 0%; background: #ca8a04; border-radius: 3px; transition: width 0.3s ease, background 0.3s ease;"></div>
                    </div>
                </div>
            </div>

            <div style="display:grid; grid-template-columns:40px 1fr 1fr 1fr 32px 32px; gap:8px; padding:10px 15px 0 15px; font-size:0.7rem; color:#94a3b8; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; text-align:center;">
                <div>Set</div><div>Time</div><div>Reps</div><div>Kg</div><div></div><div></div>
            </div>

            <div class="sets-list-container">
                ${setsHtml}
            </div>

            <div style="padding:15px; border-top:1px solid #f8fafc;">
                <button onclick="addWorkoutSet(this, '${escapedName}', false)" style="width:100%; background:transparent; border:2px dashed #e2e8f0; color:#94a3b8; font-weight:700; font-size:0.8rem; padding:12px; border-radius:12px; cursor:pointer;">+ ADD SET</button>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', exerciseHtml);

    // Update exercise count in header
    const exerciseCount = document.querySelectorAll('.exercise-logger-card').length;
    const goalEl = document.getElementById('workout-player-goal');
    if (goalEl) {
        const currentText = goalEl.textContent;
        goalEl.textContent = currentText.replace(/\d+ Exercise[s]?/, `${exerciseCount} Exercise${exerciseCount !== 1 ? 's' : ''}`);
    }

    // Scroll to the new exercise and setup volume tracking
    const newCard = container.lastElementChild;
    if (newCard) {
        newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setupVolumeTracking(newCard);
        // Update volume with any pre-filled values
        updateVolumeDisplay(newCard);
    }
}

// ========== END BULK ENTRY FUNCTIONS ==========

// Popular/main exercises that should be prioritized in search results
const POPULAR_EXERCISES = new Set([
    // Barbell compound movements
    'Barbell Bench Press', 'Barbell Squat', 'Barbell Deadlift', 'Barbell Row',
    'Barbell Overhead Press', 'Barbell Front Squat', 'Barbell Romanian Deadlift',
    'Barbell Hip Thrust', 'Barbell Curl', 'Barbell Lunge',
    // Dumbbell essentials
    'Dumbbell Bench Press', 'Dumbbell Row', 'Dumbbell Curl', 'Dumbbell Shoulder Press',
    'Dumbbell Lateral Raise', 'Dumbbell Fly', 'Dumbbell Lunge', 'Dumbbell Romanian Deadlift',
    'Dumbbell Goblet Squat', 'Dumbbell Tricep Extension',
    // Bodyweight basics
    'Push Up', 'Pull Up', 'Chin Up', 'Dip', 'Plank', 'Squat', 'Lunge',
    'Burpee', 'Mountain Climber', 'Crunch', 'Sit Up', 'Leg Raise',
    // Cable movements
    'Cable Row', 'Cable Fly', 'Cable Curl', 'Cable Tricep Pushdown', 'Cable Face Pull',
    'Cable Lateral Raise', 'Cable Crossover',
    // Machine basics
    'Leg Press', 'Lat Pulldown', 'Leg Curl', 'Leg Extension', 'Chest Press Machine',
    'Shoulder Press Machine', 'Cable Row Machine'
]);

// Score an exercise based on how well it matches the search query
function scoreExerciseMatch(exerciseName, searchTerms, fullQuery) {
    const nameLower = exerciseName.toLowerCase();
    const queryLower = fullQuery.toLowerCase().trim();
    let score = 0;

    // Exact match gets highest priority (1000 points)
    if (nameLower === queryLower) {
        score += 1000;
    }
    // Starts with the full query (500 points)
    else if (nameLower.startsWith(queryLower)) {
        score += 500;
    }
    // Starts with first search term (200 points)
    else if (searchTerms.length > 0 && nameLower.startsWith(searchTerms[0])) {
        score += 200;
    }

    // Popular/main exercise bonus (100 points)
    if (POPULAR_EXERCISES.has(exerciseName)) {
        score += 100;
    }

    // Word boundary matches are better than substring matches
    // Check if search terms appear as complete words (50 points each)
    const words = nameLower.split(/\s+/);
    for (const term of searchTerms) {
        if (words.some(word => word === term)) {
            score += 50; // Exact word match
        } else if (words.some(word => word.startsWith(term))) {
            score += 25; // Word starts with term
        }
    }

    // Shorter names are often more "primary" exercises (slight bonus)
    // Max 20 points for names under 20 characters
    score += Math.max(0, 20 - exerciseName.length);

    return score;
}

// Search exercises for add modal
function searchExercisesForAdd(query) {
    const resultsContainer = document.getElementById('add-exercise-results');

    if (!query || query.length < 2) {
        resultsContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #94a3b8;">
                Type at least 2 characters to search
            </div>
        `;
        return;
    }

    // Search in EXERCISE_VIDEOS library
    if (typeof EXERCISE_VIDEOS === 'undefined') {
        resultsContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ef4444;">
                Exercise library not loaded
            </div>
        `;
        return;
    }

    const allExercises = Object.keys(EXERCISE_VIDEOS);
    const terms = query.toLowerCase().split(' ').filter(t => t);
    const filteredExercises = allExercises.filter(name => {
        const nameLower = name.toLowerCase();
        return terms.every(term => nameLower.includes(term));
    });

    // Also search user's custom exercises
    const customMatches = (window._customExercisesCache || []).filter(ex => {
        const nameLower = ex.exercise_name.toLowerCase();
        return terms.every(term => nameLower.includes(term));
    });

    // Build custom exercises HTML (shown first)
    let customHtml = '';
    if (customMatches.length > 0) {
        customHtml = `<div style="padding: 10px 15px 5px 15px; font-size: 0.75rem; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.5px;">Your Custom Exercises</div>`;
        customHtml += customMatches.map(ex => {
            const escapedName = ex.exercise_name.replace(/'/g, "\\'");
            const hasVideo = ex.video_url ? true : false;
            return `
                <div onclick="selectExerciseToAdd('${escapedName}')" style="padding: 15px; border-bottom: 1px solid #f1f5f9; cursor: pointer; display: flex; align-items: center; gap: 12px; transition: background 0.2s; background: #f0fdf4;" onmouseover="this.style.background='#dcfce7'" onmouseout="this.style.background='#f0fdf4'">
                    <div style="width: 40px; height: 40px; background: linear-gradient(135deg, var(--primary), #4ade80); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                        ${hasVideo
                            ? '<svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: white;"><path d="M8 5v14l11-7z"/></svg>'
                            : '<svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: white;"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>'
                        }
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: var(--text-main); display: flex; align-items: center; gap: 6px;">
                            ${ex.exercise_name}
                            <span style="background: var(--primary); color: white; font-size: 0.6rem; padding: 1px 5px; border-radius: 4px; font-weight: 700;">YOURS</span>
                        </div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">${ex.muscle_group ? ex.muscle_group.replace('_', ' ') : ''} ${hasVideo ? '· Has video' : ''}</div>
                    </div>
                    <svg viewBox="0 0 24 24" style="width: 24px; height: 24px; fill: var(--primary);">
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                </div>
            `;
        }).join('');
    }

    if (filteredExercises.length === 0 && customMatches.length === 0) {
        resultsContainer.innerHTML = `
            <div style="text-align: center; padding: 30px; color: #94a3b8;">
                No exercises found matching "${query}"
            </div>
            <div onclick="closeAddExerciseModal(); openCreateCustomExerciseModal('workout');" style="margin: 0 15px; padding: 16px; background: linear-gradient(135deg, #f0fdf4, #dcfce7); border: 2px dashed var(--primary); border-radius: 12px; cursor: pointer; text-align: center;">
                <div style="font-weight: 700; color: var(--primary); font-size: 0.95rem; margin-bottom: 4px;">Create "${query}" as custom exercise</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">Record a video and save it to your library</div>
            </div>
        `;
        return;
    }

    // Sort library exercises by relevance score (highest first)
    filteredExercises.sort((a, b) => {
        const scoreA = scoreExerciseMatch(a, terms, query);
        const scoreB = scoreExerciseMatch(b, terms, query);
        return scoreB - scoreA;
    });

    // Limit to first 50 results
    const displayExercises = filteredExercises.slice(0, 50);

    // Build library results header (only if we also have custom matches)
    let libraryHeader = '';
    if (customMatches.length > 0 && displayExercises.length > 0) {
        libraryHeader = `<div style="padding: 10px 15px 5px 15px; font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; border-top: 2px solid #e2e8f0; margin-top: 5px;">Exercise Library</div>`;
    }

    const libraryHtml = displayExercises.map(name => {
        const escapedName = name.replace(/'/g, "\\'");
        return `
            <div onclick="selectExerciseToAdd('${escapedName}')" style="padding: 15px; border-bottom: 1px solid #f1f5f9; cursor: pointer; display: flex; align-items: center; gap: 12px; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                <div style="width: 40px; height: 40px; background: #f1f5f9; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                    <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: #94a3b8;">
                        <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z"/>
                    </svg>
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: var(--text-main);">${name}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">Tap to add to workout</div>
                </div>
                <svg viewBox="0 0 24 24" style="width: 24px; height: 24px; fill: var(--primary);">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
            </div>
        `;
    }).join('');

    resultsContainer.innerHTML = customHtml + libraryHeader + libraryHtml;

    if (displayExercises.length < filteredExercises.length) {
        resultsContainer.innerHTML += `
            <div style="text-align: center; padding: 15px; color: #94a3b8; font-size: 0.85rem;">
                Showing ${displayExercises.length} of ${filteredExercises.length} results. Refine your search for more specific results.
            </div>
        `;
    }
}

// Select exercise to add
async function selectExerciseToAdd(exerciseName) {
    const user = window.currentUser;
    const workoutKey = window.currentWorkoutKey;

    // Create exercise object
    const newExercise = {
        name: exerciseName,
        sets: 3,
        reps: '8-12',
        desc: 'Custom exercise added by you',
        isUserAdded: true
    };

    // Ask user if they want to save permanently
    const saveChoice = confirm(`Add "${exerciseName}" to this workout?\n\nClick OK to save it permanently (it will appear every time you do this workout).\nClick Cancel to just add it for today.`);

    // Add to UI immediately
    addExerciseToUI(newExercise);
    closeAddExerciseModal();

    // Save to database if user confirmed and is logged in
    if (saveChoice && user && workoutKey) {
        try {
            await dbHelpers.workoutCustomizations.addExercise(user.id, workoutKey, {
                name: exerciseName,
                sets: 3,
                reps: '8-12',
                desc: 'Custom exercise added by you'
            });
            console.log(`Exercise "${exerciseName}" saved to workout permanently`);
        } catch (e) {
            console.error('Failed to save exercise to database:', e);
            // Exercise is already added to UI, just log the error
        }
    }
}

// Add exercise to UI
function addExerciseToUI(exercise) {
    const container = document.getElementById('workout-exercises-list');
    const videoUrl = findVideoMatch(exercise.name);
    const previousSummaryHtml = formatPreviousWorkoutSummary(exercise.name);
    const previousSummary = getPreviousWorkoutSummary(exercise.name);
    const escapedName = exercise.name.replace(/'/g, "\\'");

    const exerciseHtml = `
        <div class="exercise-logger-card" data-exercise-name="${exercise.name}" data-is-user-added="true" style="animation: slideInUp 0.3s ease;">
            <div style="padding: 15px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                            <span style="font-weight: 700; font-size: 1.05rem;">${exercise.name}</span>
                            <span style="background: var(--primary); color: white; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; font-weight: 600;">ADDED</span>
                        </div>
                        <div style="color: var(--text-muted); font-size: 0.85rem;">${exercise.desc || ''}</div>
                        ${previousSummaryHtml}
                    </div>
                    <button onclick="deleteExerciseFromWorkout('${escapedName}', true)" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 5px; font-size: 0.8rem; font-weight: 600;">
                        <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: currentColor;">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                    </button>
                </div>
            </div>

            ${videoUrl ? `
            <div data-video-container style="position: relative; width: 100%; padding-top: 56.25%; background: black; cursor: pointer;" onclick="playInlineVideo(event, '${videoUrl}')">
                <video style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;" preload="metadata" muted playsinline>
                    <source src="${videoUrl}" type="video/mp4">
                </video>
                <div class="inline-play-overlay" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 60px; height: 60px; background: rgba(255,255,255,0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                    <svg viewBox="0 0 24 24" style="width: 30px; height: 30px; fill: var(--primary); margin-left: 3px;">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                </div>
            </div>` : ''}

            <!-- Volume Tracker -->
            <div class="volume-display" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%); border-bottom: 1px solid #fef08a;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: #ca8a04;"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
                    <span style="font-size: 0.75rem; font-weight: 700; color: #a16207; text-transform: uppercase;">Volume</span>
                </div>
                <div style="text-align: right;">
                    <div class="volume-value" style="font-size: 1rem; font-weight: 800; color: #854d0e;">0 kg</div>
                    <div class="volume-comparison" style="font-size: 0.7rem; font-weight: 600;">${previousSummary && previousSummary.totalVolume > 0 ? `<span style="color: #94a3b8;">Last: ${previousSummary.totalVolume.toLocaleString()} kg — beat it!</span>` : '<span style="color: #94a3b8;">Enter weight & reps</span>'}</div>
                </div>
                <div class="volume-progress-container" style="display: ${previousSummary && previousSummary.totalVolume > 0 ? 'block' : 'none'}; margin-top: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span class="volume-target-label" style="font-size: 0.65rem; font-weight: 600; color: #a16207;">Target: ${previousSummary && previousSummary.totalVolume > 0 ? previousSummary.totalVolume.toLocaleString() + ' kg' : '—'}</span>
                        <span class="volume-percentage" style="font-size: 0.65rem; font-weight: 700; color: #a16207;">0%</span>
                    </div>
                    <div style="height: 6px; background: #fef08a; border-radius: 3px; overflow: hidden;">
                        <div class="volume-progress-bar" style="height: 100%; width: 0%; background: #ca8a04; border-radius: 3px; transition: width 0.3s ease, background 0.3s ease;"></div>
                    </div>
                </div>
            </div>

            <div style="display:grid; grid-template-columns:40px 1fr 1fr 1fr 32px 32px; gap:8px; padding:10px 15px 0 15px; font-size:0.7rem; color:#94a3b8; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; text-align:center;">
                <div>Set</div><div>Time</div><div>Reps</div><div>Kg</div><div></div><div></div>
            </div>

            <div class="sets-list-container">
                ${(() => {
                    const numSets = previousSummary && previousSummary.setCount > 0 ? previousSummary.setCount : (exercise.sets || 3);
                    return Array.from({length: numSets}, (_, setIdx) => {
                        const prevSet = previousSummary && previousSummary.sets[setIdx] ? previousSummary.sets[setIdx] : null;
                        const prefillKg = prevSet && prevSet.kg && prevSet.kg !== '0' && prevSet.kg !== '' ? prevSet.kg : '';
                        const prefillReps = prevSet && prevSet.reps ? prevSet.reps : '';
                        const hasPrefill2 = prefillKg || prefillReps;
                        return `
                        <div class="set-wrapper"${hasPrefill2 ? ' data-prefilled="true"' : ''}>
                            <div class="workout-set-row" style="display: grid; grid-template-columns: 40px 1fr 1fr 1fr 32px 32px; gap: 8px; align-items: center; padding: 10px 15px; border-top: 1px solid #f8fafc;">
                                <div class="set-number" style="font-weight: 800; color: #94a3b8; font-size: 0.85rem; text-align: center;">${setIdx + 1}</div>
                                <input type="text" class="input-time" placeholder="-" data-exercise="${exercise.name}" data-set="${setIdx + 1}" data-field="time" style="width:100%; border: none; background: #f8fafc; border-radius: 8px; padding: 10px 5px; text-align: center; font-weight: 700; color: var(--text-main); font-size: 0.9rem;">
                                <input type="text" class="input-reps" placeholder="Reps" value="${prefillReps}" data-exercise="${exercise.name}" data-set="${setIdx + 1}" data-field="reps" style="width:100%; border: none; background: #f8fafc; border-radius: 8px; padding: 10px 5px; text-align: center; font-weight: 700; color: var(--text-main); font-size: 0.9rem;">
                                <input type="text" class="input-kg" placeholder="Kg" value="${prefillKg}" data-exercise="${exercise.name}" data-set="${setIdx + 1}" data-field="weight" style="width:100%; border: none; background: #f8fafc; border-radius: 8px; padding: 10px 5px; text-align: center; font-weight: 700; color: var(--text-main); font-size: 0.9rem;">
                                <button class="drop-set-toggle" onclick="toggleDropSet(this)" title="Toggle Drop Set">DS</button>
                                <button class="delete-set-btn" onclick="deleteSetRow(this)" title="Delete Set" style="width:32px; height:32px; border:none; background:transparent; color:#ef4444; cursor:pointer; border-radius:8px; display:flex; align-items:center; justify-content:center; transition:background 0.2s;"><svg viewBox="0 0 24 24" style="width:16px; height:16px; fill:currentColor;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
                            </div>
                            <div class="drop-set-container">
                                <div class="drop-set-inputs">
                                    <div class="drop-set-row">
                                        <div class="drop-indicator">↓1</div>
                                        <input type="text" class="drop-reps" placeholder="Reps">
                                        <input type="text" class="drop-kg" placeholder="Kg">
                                        <button class="drop-add-btn" onclick="addDropRow(this)">+</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `}).join('');
                })()}
            </div>

            <div style="padding:15px; border-top:1px solid #f8fafc;">
                <button onclick="addWorkoutSet(this, '${escapedName}', false)" style="width:100%; background:transparent; border:2px dashed #e2e8f0; color:#94a3b8; font-weight:700; font-size:0.8rem; padding:12px; border-radius:12px; cursor:pointer;">+ ADD SET</button>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', exerciseHtml);

    // Update exercise count in header
    const exerciseCount = document.querySelectorAll('.exercise-logger-card').length;
    const goalEl = document.getElementById('workout-player-goal');
    if (goalEl) {
        const currentText = goalEl.textContent;
        goalEl.textContent = currentText.replace(/\d+ Exercise[s]?/, `${exerciseCount} Exercise${exerciseCount !== 1 ? 's' : ''}`);
    }

    // Scroll to the new exercise and setup volume tracking
    const newCard = container.lastElementChild;
    if (newCard) {
        newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setupVolumeTracking(newCard);
    }
}

// Update hideAllAppViews to include new views
const originalHideAllAppViews = hideAllAppViews;
hideAllAppViews = function() {
    originalHideAllAppViews();
    const libraryViews = ['view-workout-library', 'view-workout-subcategories', 'view-workout-list', 'view-prebuilt-programs'];
    libraryViews.forEach(v => {
        const el = document.getElementById(v);
        if(el) {
            el.style.display = 'none';
        }
    });
};

// ===========================
// CUSTOM EXERCISE RECORDING
// ===========================

// In-memory cache of user's custom exercises (loaded on open)
window._customExercisesCache = [];

let _customExerciseMediaStream = null;
let _customExerciseMediaRecorder = null;
let _customExerciseRecordedChunks = [];
let _customExerciseVideoFile = null;
let _customExerciseRecTimerInterval = null;
let _customExerciseRecStartTime = null;

function openCreateCustomExerciseModal(context) {
    // context: 'workout' (during active workout) or 'library' (from workout library)
    window._customExerciseContext = context || 'library';
    document.getElementById('create-custom-exercise-modal').style.display = 'block';

    // Reset form
    document.getElementById('custom-exercise-name').value = '';
    document.getElementById('custom-exercise-desc').value = '';
    document.getElementById('custom-exercise-muscle').value = 'other';
    document.getElementById('custom-exercise-equipment').value = 'bodyweight';
    document.getElementById('custom-exercise-sets').value = '3';
    document.getElementById('custom-exercise-reps').value = '8-12';
    _customExerciseVideoFile = null;
    document.getElementById('custom-exercise-video-preview').style.display = 'none';
    document.getElementById('custom-exercise-camera-container').style.display = 'none';
    document.getElementById('custom-exercise-record-btn').style.display = 'flex';
    document.getElementById('custom-exercise-stop-btn').style.display = 'none';
    document.getElementById('custom-exercise-video-actions').style.display = 'flex';

    // Load existing custom exercises
    loadMyCustomExercises();

    // Focus on name
    setTimeout(() => document.getElementById('custom-exercise-name').focus(), 300);
}

function closeCreateCustomExerciseModal() {
    document.getElementById('create-custom-exercise-modal').style.display = 'none';
    stopCameraStream();
}

function validateCustomExerciseForm() {
    const name = document.getElementById('custom-exercise-name').value.trim();
    const btn = document.getElementById('save-custom-exercise-btn');
    btn.style.opacity = name.length > 0 ? '1' : '0.4';
    btn.style.pointerEvents = name.length > 0 ? 'auto' : 'none';
}

async function startCustomExerciseRecording() {
    try {
        // Request camera access (prefer back camera on mobile)
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        });

        _customExerciseMediaStream = stream;
        const cameraFeed = document.getElementById('custom-exercise-camera-feed');
        cameraFeed.srcObject = stream;
        cameraFeed.play();

        // Show camera container, hide record button, show stop
        document.getElementById('custom-exercise-camera-container').style.display = 'block';
        document.getElementById('custom-exercise-record-btn').style.display = 'none';
        document.getElementById('custom-exercise-stop-btn').style.display = 'flex';
        document.getElementById('custom-exercise-video-preview').style.display = 'none';

        // Start MediaRecorder
        _customExerciseRecordedChunks = [];
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
            ? 'video/webm;codecs=vp9'
            : MediaRecorder.isTypeSupported('video/webm')
                ? 'video/webm'
                : 'video/mp4';

        _customExerciseMediaRecorder = new MediaRecorder(stream, { mimeType });

        _customExerciseMediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                _customExerciseRecordedChunks.push(e.data);
            }
        };

        _customExerciseMediaRecorder.onstop = () => {
            const blob = new Blob(_customExerciseRecordedChunks, { type: mimeType });
            const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
            _customExerciseVideoFile = new File([blob], `exercise-recording.${ext}`, { type: mimeType });
            _customExerciseVideoFile.name = `exercise-recording.${ext}`;

            // Show preview
            const videoPlayback = document.getElementById('custom-exercise-video-playback');
            videoPlayback.src = URL.createObjectURL(blob);
            document.getElementById('custom-exercise-video-preview').style.display = 'block';
            document.getElementById('custom-exercise-camera-container').style.display = 'none';
            document.getElementById('custom-exercise-video-actions').style.display = 'flex';
            document.getElementById('custom-exercise-record-btn').style.display = 'flex';
            document.getElementById('custom-exercise-record-btn').innerHTML = `
                <svg viewBox="0 0 24 24" style="width: 22px; height: 22px; fill: currentColor;">
                    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                </svg>
                Re-record Video
            `;
            document.getElementById('custom-exercise-stop-btn').style.display = 'none';

            stopCameraStream();
        };

        _customExerciseMediaRecorder.start(200); // Collect data every 200ms

        // Show recording indicator with timer
        const recIndicator = document.getElementById('custom-exercise-recording-indicator');
        recIndicator.style.display = 'flex';
        _customExerciseRecStartTime = Date.now();
        _customExerciseRecTimerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - _customExerciseRecStartTime) / 1000);
            const mins = Math.floor(elapsed / 60);
            const secs = elapsed % 60;
            document.getElementById('custom-exercise-rec-timer').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        }, 1000);

    } catch (err) {
        console.error('Camera access error:', err);
        alert('Could not access camera. Please check permissions and try again, or upload a video file instead.');
    }
}

function stopCustomExerciseRecording() {
    if (_customExerciseMediaRecorder && _customExerciseMediaRecorder.state !== 'inactive') {
        _customExerciseMediaRecorder.stop();
    }

    // Stop timer
    if (_customExerciseRecTimerInterval) {
        clearInterval(_customExerciseRecTimerInterval);
        _customExerciseRecTimerInterval = null;
    }

    const recIndicator = document.getElementById('custom-exercise-recording-indicator');
    if (recIndicator) recIndicator.style.display = 'none';
}

function stopCameraStream() {
    if (_customExerciseMediaStream) {
        _customExerciseMediaStream.getTracks().forEach(track => track.stop());
        _customExerciseMediaStream = null;
    }
}

function handleCustomExerciseFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate it's a video
    if (!file.type.startsWith('video/')) {
        alert('Please select a video file.');
        return;
    }

    // Max 100MB
    if (file.size > 100 * 1024 * 1024) {
        alert('Video must be under 100MB.');
        return;
    }

    _customExerciseVideoFile = file;

    // Show preview
    const videoPlayback = document.getElementById('custom-exercise-video-playback');
    videoPlayback.src = URL.createObjectURL(file);
    document.getElementById('custom-exercise-video-preview').style.display = 'block';

    // Update record button text
    document.getElementById('custom-exercise-record-btn').innerHTML = `
        <svg viewBox="0 0 24 24" style="width: 22px; height: 22px; fill: currentColor;">
            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
        </svg>
        Re-record Video
    `;
}

function removeCustomExerciseVideo() {
    _customExerciseVideoFile = null;
    document.getElementById('custom-exercise-video-preview').style.display = 'none';

    // Reset record button
    document.getElementById('custom-exercise-record-btn').innerHTML = `
        <svg viewBox="0 0 24 24" style="width: 22px; height: 22px; fill: currentColor;">
            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
        </svg>
        Record Video
    `;

    // Reset file input
    const fileInput = document.getElementById('custom-exercise-file-input');
    if (fileInput) fileInput.value = '';
}

async function saveCustomExercise() {
    const name = document.getElementById('custom-exercise-name').value.trim();
    if (!name) {
        alert('Please enter an exercise name.');
        return;
    }

    const user = window.currentUser;
    if (!user) {
        alert('Please log in to save custom exercises.');
        return;
    }

    const btn = document.getElementById('save-custom-exercise-btn');
    btn.textContent = 'Saving...';
    btn.style.pointerEvents = 'none';

    try {
        const exerciseId = crypto.randomUUID ? crypto.randomUUID() : 'ex-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        let videoUrl = null;
        let storagePath = null;

        // Upload video if one was recorded/selected
        if (_customExerciseVideoFile) {
            try {
                const result = await storageHelpers.uploadExerciseVideo(user.id, _customExerciseVideoFile, exerciseId);
                videoUrl = result.publicUrl;
                storagePath = result.storagePath;
            } catch (uploadErr) {
                console.error('Video upload failed:', uploadErr);
                // Continue saving without video - don't block the exercise creation
            }
        }

        // Save to database
        const exerciseData = {
            name: name,
            description: document.getElementById('custom-exercise-desc').value.trim(),
            muscleGroup: document.getElementById('custom-exercise-muscle').value,
            equipment: document.getElementById('custom-exercise-equipment').value,
            sets: parseInt(document.getElementById('custom-exercise-sets').value) || 3,
            reps: document.getElementById('custom-exercise-reps').value.trim() || '8-12',
            videoUrl: videoUrl,
            storagePath: storagePath
        };

        const saved = await dbHelpers.customExercises.create(user.id, exerciseData);

        // Add to local cache
        window._customExercisesCache.unshift(saved);

        // If video was uploaded, add to the in-memory EXERCISE_VIDEOS map for immediate use
        if (videoUrl) {
            if (typeof EXERCISE_VIDEOS !== 'undefined') {
                EXERCISE_VIDEOS[name] = videoUrl;
            }
        }

        // If we're in an active workout context, offer to add it right away
        if (window._customExerciseContext === 'workout') {
            closeCreateCustomExerciseModal();
            const addNow = confirm(`"${name}" has been saved!\n\nWould you like to add it to your current workout?`);
            if (addNow) {
                const newExercise = {
                    name: name,
                    sets: exerciseData.sets,
                    reps: exerciseData.reps,
                    desc: exerciseData.description || 'Custom exercise',
                    isUserAdded: true
                };
                addExerciseToUI(newExercise);

                // Also save to workout customizations if in a tracked workout
                const workoutKey = window.currentWorkoutKey;
                if (workoutKey) {
                    try {
                        await dbHelpers.workoutCustomizations.addExercise(user.id, workoutKey, {
                            name: name,
                            sets: exerciseData.sets,
                            reps: exerciseData.reps,
                            desc: exerciseData.description || 'Custom exercise'
                        });
                    } catch (e) {
                        console.error('Failed to save to workout customizations:', e);
                    }
                }
            }
        } else {
            // Library context - just show success
            alert(`"${name}" has been created! You can now find it when adding exercises to any workout.`);
            closeCreateCustomExerciseModal();
        }

    } catch (err) {
        console.error('Failed to save custom exercise:', err);
        alert('Failed to save exercise. Please try again.');
    } finally {
        btn.textContent = 'Save';
        btn.style.pointerEvents = 'auto';
    }
}

async function loadMyCustomExercises() {
    const user = window.currentUser;
    if (!user) return;

    try {
        const exercises = await dbHelpers.customExercises.getAll(user.id);
        window._customExercisesCache = exercises;

        const section = document.getElementById('my-custom-exercises-section');
        const list = document.getElementById('my-custom-exercises-list');
        const count = document.getElementById('custom-exercises-count');

        if (exercises.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        count.textContent = `${exercises.length} exercise${exercises.length !== 1 ? 's' : ''}`;

        list.innerHTML = exercises.map(ex => {
            const muscleLabel = ex.muscle_group ? ex.muscle_group.replace('_', ' ') : '';
            const equipLabel = ex.equipment || '';
            const hasVideo = ex.video_url ? true : false;

            return `
                <div style="background: #f8fafc; border-radius: 12px; padding: 14px 16px; display: flex; align-items: center; gap: 12px; border: 1px solid #e2e8f0;">
                    <div style="width: 44px; height: 44px; background: ${hasVideo ? 'linear-gradient(135deg, var(--primary), #4ade80)' : '#e2e8f0'}; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        ${hasVideo
                            ? '<svg viewBox="0 0 24 24" style="width: 22px; height: 22px; fill: white;"><path d="M8 5v14l11-7z"/></svg>'
                            : '<svg viewBox="0 0 24 24" style="width: 22px; height: 22px; fill: #94a3b8;"><path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z"/></svg>'
                        }
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${ex.exercise_name}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
                            ${muscleLabel}${muscleLabel && equipLabel ? ' · ' : ''}${equipLabel}
                            ${hasVideo ? ' · Has video' : ''}
                        </div>
                    </div>
                    <button onclick="deleteCustomExercise('${ex.id}', '${ex.exercise_name.replace(/'/g, "\\'")}')" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 8px; flex-shrink: 0;">
                        <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: currentColor;">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                    </button>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Failed to load custom exercises:', err);
    }
}

async function deleteCustomExercise(exerciseId, exerciseName) {
    if (!confirm(`Delete "${exerciseName}"? This will remove the exercise and its video permanently.`)) return;

    const user = window.currentUser;
    if (!user) return;

    try {
        await dbHelpers.customExercises.delete(user.id, exerciseId);

        // Remove from local cache
        window._customExercisesCache = window._customExercisesCache.filter(ex => ex.id !== exerciseId);

        // Remove from EXERCISE_VIDEOS if it was there
        if (typeof EXERCISE_VIDEOS !== 'undefined' && EXERCISE_VIDEOS[exerciseName]) {
            delete EXERCISE_VIDEOS[exerciseName];
        }

        // Refresh the list
        loadMyCustomExercises();
    } catch (err) {
        console.error('Failed to delete custom exercise:', err);
        alert('Failed to delete exercise. Please try again.');
    }
}
