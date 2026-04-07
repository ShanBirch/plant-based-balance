// --- HORMONE HUB & SUPERBOOST ENGINE ---

// Use window.checkInProgress (may already be defined by early script)
if (typeof window.checkInProgress === 'undefined') {
    window.checkInProgress = { flow: null, symptoms: [], mood: null, energy: null, fluid: null, equipment: null, recovery: null };
}
var checkInProgress = window.checkInProgress;

async function initCycleView() {
    // 0. Render instantly with cached state to prevent "The Flush" base flash
    renderCycleStatus();

    // 1. Ensure Data Loaded - MUST await this to load from DB before rendering
    if(typeof initCalendarView === 'function') {
        await initCalendarView();
    }

    // 2. Render Wheel (now data is loaded)
    renderCycleStatus();

    // 3. Render Calendar
    if(typeof renderWeeklyCalendar === 'function') renderWeeklyCalendar();

    // 4. Check Daily Log Status
    const today = getLocalDateString();
    const hasLog = userCycleData.logs && userCycleData.logs[today];

    const promptCard = document.getElementById('check-in-prompt-card');
    const completeCard = document.getElementById('check-in-completed-card');

    if(promptCard && completeCard) {
        // Hide cycle sync cards for male users
        if (typeof isMaleUser === 'function' && isMaleUser()) {
            promptCard.style.display = 'none';
            completeCard.style.display = 'none';
        } else if(hasLog) {
            promptCard.style.display = 'none';
            completeCard.style.display = 'block';
        } else {
            promptCard.style.display = 'flex';
            completeCard.style.display = 'none';
        }
    }
}

function renderCycleStatus() {
    // Determine if male early using local storage if function is not yet ready
    let isMale = false;
    if (typeof isMaleUser === 'function') {
        isMale = isMaleUser();
    } else {
        const gender = localStorage.getItem('userGender');
        isMale = (gender === 'Male' || gender === 'male');
    }

    // For male users, show Performance Mode (no cycle tracking)
    if (isMale) {
        const phase = PHASE_INFO['performance'] || { name: 'Performance Mode', color: '#3b82f6', icon: '⚡' };
        const dayDisplay = document.getElementById('cycle-day-display');
        const nameDisplay = document.getElementById('cycle-phase-name');
        const descDisplay = document.getElementById('cycle-phase-desc');
        const tagsContainer = document.getElementById('cycle-phase-tags');

        if (dayDisplay && dayDisplay.parentElement) {
            dayDisplay.parentElement.style.display = 'none'; // Hide day counter for males
        }
        if (nameDisplay && phase) {
            nameDisplay.innerText = phase.name;
            nameDisplay.style.color = phase.color;
        }
        if (descDisplay) {
            descDisplay.innerText = "Train based on energy and recovery. Push hard, recover smart.";
        }
        if (tagsContainer && phase) {
            tagsContainer.innerHTML = `
                <span style="background:${phase.color}20; color:${phase.color}; padding:4px 10px; border-radius:12px; font-size:0.8rem; font-weight:600;">${phase.icon} PERFORMANCE</span>
            `;
        }
        return;
    }

    const today = new Date();
    // Default values
    let dayNum = 1;
    let phase = 'wellness';
    
    if (userCycleData.lastPeriod && !userCycleData.noPeriodMode) {
        const lastP = new Date(userCycleData.lastPeriod);
        const diff = Math.floor((today - lastP) / (1000 * 60 * 60 * 24));
        dayNum = (diff % userCycleData.cycleLength) + 1;
        
        // Determine Phase
        if (dayNum >= 1 && dayNum <= 5) phase = 'menstrual';
        else if (dayNum <= 13) phase = 'follicular';
        else if (dayNum <= 16) phase = 'ovulation';
        else phase = 'luteal';
    }
    
    // Update UI
    const dayDisplay = document.getElementById('cycle-day-display');
    const nameDisplay = document.getElementById('cycle-phase-name');
    const descDisplay = document.getElementById('cycle-phase-desc');
    const tagsContainer = document.getElementById('cycle-phase-tags');
    
    if(dayDisplay) dayDisplay.innerText = dayNum;
    
    const info = PHASE_INFO[phase];
    if(nameDisplay && info) {
        nameDisplay.innerText = info.name;
        nameDisplay.style.color = info.color;
    }
    if(descDisplay && info) {
        descDisplay.innerText = info.rec || "Listen to your body.";
    }
    
    // Tags
    if(tagsContainer && info) {
        tagsContainer.innerHTML = `
            <span style="background:${info.color}20; color:${info.color}; padding:4px 10px; border-radius:12px; font-size:0.8rem; font-weight:600;">${info.icon} ${phase.toUpperCase()}</span>
        `;
    }
}

// --- CHECK-IN LOGIC ---

function openCheckInModal() {
    // Ensure gender-specific UI is applied before showing modal
    if (typeof applyGenderSpecificUI === 'function') {
        applyGenderSpecificUI();
    }
    document.getElementById('check-in-modal').style.display = 'flex';
    // Clear previous selection visually? Or keep if re-opening?
    // For now, keep state
}

function closeCheckInModal() {
    document.getElementById('check-in-modal').style.display = 'none';
}

function selectCheckInOption(category, value, el) {
    // 1. Update State
    checkInProgress[category] = value;

    // 2. Update UI (Siblings)
    const options = document.querySelectorAll(`.check-in-chip[data-group="${category}"]`);
    options.forEach(opt => opt.classList.remove('selected'));

    // 3. Select Clicked
    el.classList.add('selected');
}

function toggleCheckInOption(category, value, el) {
    // 1. Update State (Array)
    if(!checkInProgress[category]) checkInProgress[category] = [];

    const idx = checkInProgress[category].indexOf(value);
    if(idx > -1) {
        checkInProgress[category].splice(idx, 1); // Remove
        el.classList.remove('selected');
    } else {
        checkInProgress[category].push(value); // Add
        el.classList.add('selected');
    }
}

// Expose check-in functions to global scope for inline onclick handlers
window.openCheckInModal = openCheckInModal;
window.closeCheckInModal = closeCheckInModal;
window.selectCheckInOption = selectCheckInOption;
window.toggleCheckInOption = toggleCheckInOption;

// Real implementation of submitDailyCycleSync
window._submitDailyCycleSyncImpl = async function() {
    // 1. Save Log locally
    const today = getLocalDateString();
    if(!userCycleData.logs) userCycleData.logs = {};

    // Clone to avoid ref issues
    userCycleData.logs[today] = JSON.parse(JSON.stringify(checkInProgress));

    // NEW: Add timestamp for when check-in was completed (for equipment override priority)
    userCycleData.logs[today].timestamp = new Date().toISOString();

    // Update userCycleData.symptoms from check-in
    userCycleData.symptoms = checkInProgress.symptoms || [];

    // Persist to localStorage
    localStorage.setItem('userCycleData', JSON.stringify(userCycleData));

    // 2. Save to Supabase for persistence across refreshes
    if(window.currentUser && typeof dbHelpers !== 'undefined') {
        try {
            await dbHelpers.checkins.upsert(window.currentUser.id, today, {
                energy: checkInProgress.energy || null,
                equipment: checkInProgress.equipment || null,
                additional_data: {
                    symptoms: checkInProgress.symptoms || [],
                    mood: checkInProgress.mood || null,
                    flow: checkInProgress.flow || null,
                    fluid: checkInProgress.fluid || null,
                    recovery: checkInProgress.recovery || null
                }
            });
            console.log('✅ Check-in saved to Supabase');
        } catch (e) {
            console.error('Failed to save check-in to DB:', e);
        }
    }

    // Mark check-in as completed for today
    localStorage.setItem('lastWellnessCheck', new Date().toDateString());

    // 2.5. Save equipment selection to update workout recommendations
    if (checkInProgress.equipment && window.currentUser && typeof dbHelpers !== 'undefined') {
        try {
            // Update equipment_access in quiz_results (where it's stored)
            await window.supabaseClient.from('quiz_results')
                .update({ equipment_access: checkInProgress.equipment })
                .eq('user_id', window.currentUser.id);

            // Also update localStorage profile so workout schedules pick it up immediately
            const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
            userProfile.equipment_access = checkInProgress.equipment;
            // Clear legacy gym_access field - equipment_access is the source of truth
            userProfile.gym_access = (checkInProgress.equipment === 'gym');

            // NEW: Add timestamp for equipment update (for override priority)
            userProfile.equipment_updated_at = new Date().toISOString();
            localStorage.setItem('equipmentUpdatedAt', userProfile.equipment_updated_at);
            localStorage.setItem('userProfile', JSON.stringify(userProfile));

            // Update window cache too
            if (window.userProfile) {
                window.userProfile.equipment_access = checkInProgress.equipment;
                window.userProfile.gym_access = (checkInProgress.equipment === 'gym');
                window.userProfile.equipment_updated_at = userProfile.equipment_updated_at;
            }

            // Also update sessionStorage for consistency across all views
            const sessionProfile = JSON.parse(sessionStorage.getItem('userProfile') || '{}');
            sessionProfile.equipment_access = checkInProgress.equipment;
            sessionProfile.gym_access = (checkInProgress.equipment === 'gym');
            sessionProfile.equipment_updated_at = userProfile.equipment_updated_at;
            sessionStorage.setItem('userProfile', JSON.stringify(sessionProfile));

            console.log('✅ Equipment access saved:', checkInProgress.equipment, 'at', userProfile.equipment_updated_at);
        } catch (e) {
            console.warn('Failed to save equipment access:', e);
        }
    }

    // 3. Update Active Symptoms display in Metabolic Protocol section
    const symptomsDisplay = document.getElementById('profile-symptoms-display');
    if (symptomsDisplay) {
        const symptoms = checkInProgress.symptoms || [];
        if (symptoms.length > 0) {
            // Format symptom names nicely (e.g., cramps -> Cramps, back_pain -> Back Pain)
            const formattedSymptoms = symptoms.map(s =>
                s.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
            ).join(', ');
            symptomsDisplay.textContent = formattedSymptoms;
        } else {
            symptomsDisplay.textContent = 'None';
        }
    }

    // 4. Trigger Cycle Sync Engine (updates workout recommendations)
    applyCycleSync(checkInProgress);

    // 5. Close & Refresh views
    closeCheckInModal();
    initCycleView(); // Updates calendar
    renderWeeklyCalendar(); // Update weekly calendar view

    // CRITICAL: Refresh Movement view to apply equipment selection
    if (typeof renderMovementView === 'function') {
        renderMovementView();
    }

    // 6. Handle rest-indicating conditions - show yoga recommendation popup
    const isMale = (typeof isMaleUser === 'function' && isMaleUser());
    const checkInSymptoms = checkInProgress.symptoms || [];
    let yogaPopupReason = null;

    // Check for conditions that should trigger yoga recommendation
    if (checkInProgress.energy === 'low') {
        yogaPopupReason = 'low_energy';
    } else if (isMale && checkInProgress.recovery === 'tired') {
        yogaPopupReason = 'tired';
    } else if (isMale && checkInProgress.recovery === 'moderate') {
        yogaPopupReason = 'fatigued';
    } else if (isMale && checkInSymptoms.includes('muscle_soreness')) {
        yogaPopupReason = 'muscle_soreness';
    } else if (checkInSymptoms.includes('back_pain')) {
        yogaPopupReason = 'back_pain';
    } else if (!isMale && checkInSymptoms.includes('cramps')) {
        yogaPopupReason = 'cramps';
    }

    if (yogaPopupReason) {
        // Show yoga recommendation popup with context-aware message
        showLowEnergyYogaPopup(yogaPopupReason);
        return; // The popup will handle navigation
    }

    // 6.5. Handle cycle-based workout recommendations (for women who opted in)
    if (!isMale) {
        // Get user profile to check cycle preferences
        let userProfile = {};
        try { userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}'); } catch(e) {}
        const cycleSyncEnabled = userProfile.cycle_sync_preference === 'yes';
        const periodEnergyLow = userProfile.period_energy_response === 'low';

        // Calculate current cycle phase
        if (cycleSyncEnabled && periodEnergyLow && userCycleData.lastPeriod && !userCycleData.noPeriodMode) {
            const lastPeriod = new Date(userCycleData.lastPeriod);
            const todayDate = new Date();
            const daysSinceStart = Math.floor((todayDate - lastPeriod) / (24 * 60 * 60 * 1000));
            const currentCycleDay = (daysSinceStart % (userCycleData.cycleLength || 28)) + 1;

            // If in menstrual phase (days 1-5), AUTOMATICALLY switch to yoga (no popup)
            if (currentCycleDay >= 1 && currentCycleDay <= 5) {
                const todayDateStr = getLocalDateString();

                // Set automatic yoga override
                const yogaOverride = {
                    date: todayDateStr,
                    program: 'yoga',
                    reason: 'cycle_sync_automatic' // Distinct from 'low_energy' popup reason
                };
                localStorage.setItem('todayWorkoutOverride', JSON.stringify(yogaOverride));

                // Update check-in log with automatic flag
                if (userCycleData.logs && userCycleData.logs[todayDateStr]) {
                    userCycleData.logs[todayDateStr].workoutOverride = 'yoga';
                    userCycleData.logs[todayDateStr].cycleAutoSync = true;
                    localStorage.setItem('userCycleData', JSON.stringify(userCycleData));
                }

                // Save to database
                if (typeof saveUserCycleData === 'function') {
                    saveUserCycleData(userCycleData);
                }


                // NO POPUP - continue to dashboard display
                // Let it fall through to normal flow (don't return here)
            }
        }
    }

    // Clear any existing yoga override if energy is NOT low and not in menstrual phase
    localStorage.removeItem('todayWorkoutOverride');

    // Also clear the workoutOverride from today's log
    if (userCycleData.logs && userCycleData.logs[today]) {
        delete userCycleData.logs[today].workoutOverride;
        localStorage.setItem('userCycleData', JSON.stringify(userCycleData));
    }


    // 7. Redirect to Dashboard with Animation
    switchAppTab('dashboard');

    // Show Toast/Banner on Dashboard
    showCycleSyncBanner();
};

// Recovery/Rest yoga recommendation popup - supports multiple trigger reasons
function showLowEnergyYogaPopup(reason = 'low_energy') {
    const isMale = (typeof isMaleUser === 'function' && isMaleUser());
    const syncLabel = isMale ? '💪 Daily Sync' : '✨ Cycle Sync';

    // Context-aware messaging based on why the popup was triggered
    let messageText;
    switch(reason) {
        case 'tired':
        case 'need_rest':
            messageText = isMale
                ? "You indicated you need rest today. We recommend <strong>Somatic Yoga</strong> to help your body recover and rebuild."
                : "You indicated you need rest today. We recommend <strong>Somatic Yoga</strong> to support your recovery.";
            break;
        case 'fatigued':
            messageText = "You're feeling a bit fatigued today. We recommend <strong>Somatic Yoga</strong> to help restore your energy and support recovery.";
            break;
        case 'muscle_soreness':
            messageText = "You're feeling sore today. We recommend <strong>Somatic Yoga</strong> to ease tension, improve mobility, and speed up recovery.";
            break;
        case 'back_pain':
            messageText = "Back pain can benefit from gentle movement. We recommend <strong>Somatic Yoga</strong> to release tension and support healing.";
            break;
        case 'cramps':
            messageText = "Gentle movement can help with cramps. We recommend <strong>Somatic Yoga</strong> designed to ease discomfort and relax your body.";
            break;
        case 'low_energy':
        default:
            messageText = isMale
                ? "We noticed you're feeling low energy today. We recommend <strong>Somatic Yoga</strong> to help you recover and recharge."
                : "We noticed you're feeling low energy today. We recommend <strong>Somatic Yoga</strong> to help you recover and recharge.";
            break;
    }

    // Store the reason for acceptYogaRecommendation to use
    window._yogaPopupReason = reason;

    // Create popup overlay
    const popup = document.createElement('div');
    popup.id = 'low-energy-popup';
    popup.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.6); z-index: 3000;
        display: flex; align-items: center; justify-content: center;
        animation: fadeIn 0.3s ease;
    `;

    popup.innerHTML = `
        <div style="background: white; border-radius: 20px; padding: 30px; max-width: 340px; margin: 20px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
            <div style="font-size: 3rem; margin-bottom: 15px;">🧘‍♀️</div>
            <h3 style="margin: 0 0 10px 0; color: var(--primary); font-size: 1.3rem;">${syncLabel}</h3>
            <p style="color: #64748b; margin: 0 0 20px 0; line-height: 1.5;">
                ${messageText}
            </p>
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button onclick="acceptYogaRecommendation()" style="
                    flex: 1; padding: 14px 20px; background: var(--primary); color: white;
                    border: none; border-radius: 12px; font-weight: 600; cursor: pointer;
                    font-size: 1rem;
                ">Yes, switch to Yoga</button>
                <button onclick="declineYogaRecommendation()" style="
                    flex: 1; padding: 14px 20px; background: #f1f5f9; color: #64748b;
                    border: none; border-radius: 12px; font-weight: 600; cursor: pointer;
                    font-size: 1rem;
                ">Keep my workout</button>
            </div>
        </div>
    `;

    document.body.appendChild(popup);
}

function acceptYogaRecommendation() {
    // Save yoga override for today - use the reason from popup trigger
    const today = getLocalDateString();
    const reason = window._yogaPopupReason || 'low_energy';
    const yogaOverride = { date: today, program: 'yoga', reason: reason };
    localStorage.setItem('todayWorkoutOverride', JSON.stringify(yogaOverride));

    // Also update the check-in log to reflect yoga choice
    if (userCycleData.logs && userCycleData.logs[today]) {
        userCycleData.logs[today].workoutOverride = 'yoga';
        localStorage.setItem('userCycleData', JSON.stringify(userCycleData));
    }

    // Save to database if possible
    if (window.currentUser && typeof dbHelpers !== 'undefined') {
        dbHelpers.checkins.upsert(window.currentUser.id, today, {
            workout_override: 'yoga'
        }).catch(e => console.warn('Failed to save workout override:', e));
    }

    // Close popup
    const popup = document.getElementById('low-energy-popup');
    if (popup) popup.remove();

    // Refresh views to show yoga
    if (typeof renderMovementView === 'function') renderMovementView();
    if (typeof renderWeeklyCalendar === 'function') renderWeeklyCalendar();

    // Navigate to dashboard
    switchAppTab('dashboard');

    // Show confirmation banner
    const banner = document.createElement('div');
    banner.innerText = "🧘 Switched to Somatic Yoga for today!";
    banner.style.cssText = "position:fixed; top:80px; left:50%; transform:translateX(-50%); background:var(--accent-green); color:white; padding:12px 24px; border-radius:20px; z-index:2000; font-weight:600; box-shadow:0 4px 12px rgba(0,0,0,0.2);";
    document.body.appendChild(banner);
    setTimeout(() => { banner.style.opacity = '0'; setTimeout(() => banner.remove(), 500); }, 3000);
}

function declineYogaRecommendation() {
    // Record that user declined - so we don't force yoga on them
    const today = getLocalDateString();
    if (userCycleData.logs && userCycleData.logs[today]) {
        userCycleData.logs[today].workoutOverride = 'declined';
        localStorage.setItem('userCycleData', JSON.stringify(userCycleData));
    }

    // Close popup without changing workout
    const popup = document.getElementById('low-energy-popup');
    if (popup) popup.remove();

    // Navigate to dashboard
    switchAppTab('dashboard');

    // Show regular banner
    showCycleSyncBanner();
}

// Expose yoga recommendation functions to global scope for inline onclick handlers
window.acceptYogaRecommendation = acceptYogaRecommendation;
window.declineYogaRecommendation = declineYogaRecommendation;

function applyCycleSync(data) {
    console.log("🚀 Applying Cycle Sync:", data);
    // This function will be called by renderDashboard to override suggestions
    // For now, we save it to session state or global
    window.cycleSyncState = data;
    
}

function showCycleSyncBanner() {
    // Create a temporary banner
    const banner = document.createElement('div');
    banner.innerText = "✨ Dashboard Updated with your Cycle Sync!";
    banner.style.cssText = "position:fixed; top:80px; left:50%; transform:translateX(-50%); background:var(--primary); color:white; padding:10px 20px; border-radius:20px; z-index:2000; font-weight:600; box-shadow:0 4px 12px rgba(0,0,0,0.2); animation: fadeIn 0.5s;";
    document.body.appendChild(banner);
    
    setTimeout(() => {
        banner.style.opacity = '0';
        setTimeout(() => banner.remove(), 500);
    }, 3000);
}

// --- CYCLE SYNC RECIPE DATABASE ---
const CYCLE_SYNC_RECIPES = {
    'bloating': {
        title: "Ginger Pear Smoothie",
        meta: "Anti-Bloat Elixir",
        img: "/assets/ginger_pear_smoothie.png",
        why: "Ginger and pear are natural diuretics that help flush excess water and soothe digestion.",
        ingredients: ["Pear 170g", "Spinach 50g", "Cucumber 80g", "Ginger 1 inch", "Pea Protein 30g"],
        prep: "Blend all ingredients with water and ice until smooth."
    },
    'cramps': {
        title: "Stuffed Sweet Potato",
        meta: "Magnesium Rescue",
        img: "/assets/stuffed_sweet_potato.jpg",
        why: "Sweet potatoes and black beans are rich in magnesium, which relaxes uterine muscles to ease cramps.",
        ingredients: ["Sweet Potato 1 large", "Black Beans 1/2 cup", "Quinoa 1/2 cup", "Pumpkin Seeds 1 tbsp"],
        prep: "Roast potato. Stuff with quinoa and beans. Top with seeds."
    },
    'mood': {
        title: "Cacao Night Calm",
        meta: "Serotonin Boost",
        img: "/assets/smoothie_cacao_calm.png",
        why: "Raw cacao stimulates serotonin, while almond butter stabilizes blood sugar to level out your mood.",
        ingredients: ["Frozen Banana 1", "Raw Cacao 1 tbsp", "Almond Butter 1 tbsp", "Oat Milk 1 cup"],
        prep: "Blend until creamy. Top with cacao nibs."
    },
    'fatigue': {
        title: "Matcha Mint Energy",
        meta: "Sustained Focus",
        img: "/assets/smoothie_matcha_mint.png",
        why: "L-Theanine in matcha provides calm, sustained energy without the cortisol spike of coffee.",
        ingredients: ["Matcha Powder 1 tsp", "Mint Leaves 5", "Frozen Banana 1/2", "Vanilla Protein 1 scoop"],
        prep: "Blend with coconut milk for a creamy energy boost."
    },
    'inflammation': {
        title: "Golden Turmeric Tonic",
        meta: "Inflammation Fighter",
        img: "/assets/smoothie_golden_turmeric.png",
        why: "Turmeric's curcumin is a potent anti-inflammatory compound, especially when paired with black pepper.",
        ingredients: ["Mango 1/2 cup", "Turmeric 1 tsp", "Black Pepper pinch", "Flax Oil 1 tsp"],
        prep: "Blend with coconut milk. Enjoy immediately."
    }
};

function renderCycleSyncMeal(reason, recipeKey) {
    const container = document.getElementById('today-meals-container'); // Need to ensure this exists or find where to inject
    const recipe = CYCLE_SYNC_RECIPES[recipeKey];
    if(!recipe || !container) return;

    // Save the swapped meal data so we can add it to the meal plan
    window.cycleSyncMealTitle = recipe.title;
    window.cycleSyncMealData = recipe;
    window.cycleSyncMealReason = reason;

    const html = `
    <div style="background: linear-gradient(135deg, #fff 0%, #fefce8 100%); border: 2px solid var(--secondary); border-radius: 16px; margin-bottom: 25px; overflow: hidden; box-shadow: 0 10px 30px rgba(180, 155, 10, 0.15); animation: slideUp 0.4s ease-out;">
        <div style="background: var(--secondary); color: black; padding: 8px 15px; font-weight: 700; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; display:flex; justify-content:space-between; align-items:center;">
             <span>✨ Cycle Sync Meal Swap</span>
             <span>${reason}</span>
        </div>
        <div style="display: flex; flex-direction: column; md:flex-row;">
            <div style="padding: 20px;">
                <div style="font-family:'Playfair Display'; font-size: 1.4rem; color: var(--primary); margin-bottom: 5px; font-weight:700;">${recipe.title}</div>
                <div style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 12px; font-weight:500;">${recipe.meta}</div>
                <p style="font-size: 0.95rem; color: #4a5568; margin-bottom: 15px; line-height: 1.5; background: rgba(255,255,255,0.6); padding: 10px; border-radius: 8px; border-left: 3px solid var(--secondary);">${recipe.why}</p>
                
                <button onclick="switchAppTab('meals', this); setTimeout(() => switchWeek('today'), 50);" style="background: white; border: 1px solid #cbd5e0; padding: 8px 16px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; cursor: pointer;">View Recipe</button>
            </div>
            <img src="${recipe.img}" style="width: 100%; height: 180px; object-fit: cover; md:width: 150px; md:height: auto;" onerror="this.style.display='none'">
        </div>
        
        <!-- Collapsible Details (Hidden by default) -->
        <div class="card card-body" style="padding: 0 20px; margin:0; box-shadow:none; border:none; background:transparent;">
            <div style="padding: 20px 0;">
                <h4 style="margin-top:0;">Ingredients</h4>
                <ul style="margin-bottom:15px;">
                    ${recipe.ingredients.map(i => `<li>${i}</li>`).join('')}
                </ul>
                <h4 style="margin-top:0;">Preparation</h4>
                <p>${recipe.prep}</p>
            </div>
        </div>
    </div>
    `;
    
    // Insert at top of meals
    const existing = document.getElementById('cycle-sync-meal-card');
    if(existing) existing.remove();
    
    // Create wrapper if implies
    const wrapper = document.createElement('div');
    wrapper.id = 'cycle-sync-meal-card';
    wrapper.innerHTML = html;
    
    container.insertBefore(wrapper, container.firstChild);
}

function checkAndRenderCycleSync() {
    // Check if we have a log for today
    if(!userCycleData || !userCycleData.logs) return;

    const today = getLocalDateString();
    const log = userCycleData.logs[today];
    
    if(log && log.symptoms && log.symptoms.length > 0) {
        // Prioritize symptoms for display
        const priorities = ['bloating', 'cramps', 'mood', 'fatigue', 'inflammation'];
        let match = null;
        
        // Find highest priority symptom
        for(let p of priorities) {
             // Basic matching - handle "mood" specially if it's a category
             if(p === 'mood') {
                 if(log.mood === 'sad' || log.mood === 'anxious') {
                     match = 'mood'; 
                     break; 
                 }
             }
             if(log.symptoms.includes(p)) {
                 match = p;
                 break;
             }
        }
        
        // Fallback to mood mapping if no physical symptoms but mood is low
        if(!match && (log.mood === 'sad' || log.mood === 'anxious')) {
            match = 'mood';
        }

        if(match) {
            renderCycleSyncMeal(match.charAt(0).toUpperCase() + match.slice(1), match);
        }
    
    } else if (log && log.energy === 'low') {
         renderCycleSyncMeal('Energy Boost', 'fatigue');
    }
}

// Initial Load - MUST wait for auth before loading cycle data from DB
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for auth to complete before loading user-specific data
    const waitForAuth = () => new Promise(resolve => {
        if(window.currentUser) return resolve(window.currentUser);
        const check = setInterval(() => {
            if(window.currentUser) {
                clearInterval(check);
                resolve(window.currentUser);
            }
        }, 100);
        // Timeout after 5s just in case
        setTimeout(() => { clearInterval(check); resolve(null); }, 5000);
    });

    await waitForAuth();
    console.log('🔐 Auth ready for cycle data load, currentUser:', window.currentUser?.id);

    // Load cycle data from localStorage AND database (now that auth is ready)
    if(typeof initCalendarView === 'function') {
        initCalendarView().then(() => {
            // After data is loaded, check for Cycle Sync
            checkAndRenderCycleSync();
        }).catch(err => {
            console.log('Error loading calendar view:', err);
            // Still try to check Cycle Sync even if there was an error
            checkAndRenderCycleSync();
        });
    } else {
        // Fallback if initCalendarView doesn't exist
        setTimeout(checkAndRenderCycleSync, 1000);
    }
    // Check if we need to load cycle view
    // (Existing init calls will handle this if tab is active)
});
