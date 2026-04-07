// checkInProgress already defined above
if (typeof window.checkInProgress === 'undefined') {
    window.checkInProgress = { flow: null, symptoms: [], mood: null, energy: null, fluid: null, equipment: null, recovery: null };
}

function selectCheckInOption(category, value, el) {
    window.checkInProgress[category] = value;
    const options = document.querySelectorAll('.check-in-chip[data-group="' + category + '"]');
    options.forEach(function(opt) { opt.classList.remove('selected'); });
    el.classList.add('selected');
}

function toggleCheckInOption(category, value, el) {
    if (!window.checkInProgress[category]) window.checkInProgress[category] = [];
    var idx = window.checkInProgress[category].indexOf(value);
    if (idx > -1) {
        window.checkInProgress[category].splice(idx, 1);
        el.classList.remove('selected');
    } else {
        window.checkInProgress[category].push(value);
        el.classList.add('selected');
    }
}

function openCheckInModal() {
    if (typeof applyGenderSpecificUI === 'function') {
        applyGenderSpecificUI();
    }
    document.getElementById('check-in-modal').style.display = 'flex';
}

function closeCheckInModal() {
    document.getElementById('check-in-modal').style.display = 'none';
}

// Full implementation of submitDailyCycleSync
async function submitDailyCycleSync() {
    try {
        // 1. Save Log locally
        const today = getLocalDateString();
        if (typeof userCycleData === 'undefined') {
            window.userCycleData = JSON.parse(localStorage.getItem('userCycleData') || '{}');
        }
        if (!userCycleData.logs) userCycleData.logs = {};

        // Clone to avoid ref issues and add timestamp for priority comparisons
        userCycleData.logs[today] = JSON.parse(JSON.stringify(window.checkInProgress));
        userCycleData.logs[today].timestamp = new Date().toISOString();

        // Update userCycleData.symptoms from check-in
        userCycleData.symptoms = window.checkInProgress.symptoms || [];

        // Persist to localStorage
        localStorage.setItem('userCycleData', JSON.stringify(userCycleData));

        // 2. Save to Supabase
        if (window.currentUser && typeof dbHelpers !== 'undefined') {
            try {
                await dbHelpers.checkins.upsert(window.currentUser.id, today, {
                    energy: window.checkInProgress.energy || null,
                    equipment: window.checkInProgress.equipment || null,
                    additional_data: {
                        symptoms: window.checkInProgress.symptoms || [],
                        mood: window.checkInProgress.mood || null,
                        flow: window.checkInProgress.flow || null,
                        fluid: window.checkInProgress.fluid || null,
                        recovery: window.checkInProgress.recovery || null
                    }
                });
                console.log('✅ Check-in saved to Supabase');
            } catch (e) {
                console.error('Failed to save check-in to DB:', e);
            }
        }

        // Mark check-in as completed for today
        localStorage.setItem('lastWellnessCheck', new Date().toDateString());

        // Save equipment selection
        if (window.checkInProgress.equipment && window.currentUser && typeof dbHelpers !== 'undefined') {
            try {
                await window.supabaseClient.from('quiz_results')
                    .update({ equipment_access: window.checkInProgress.equipment })
                    .eq('user_id', window.currentUser.id);

                const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
                userProfile.equipment_access = window.checkInProgress.equipment;
                userProfile.gym_access = (window.checkInProgress.equipment === 'gym');
                localStorage.setItem('userProfile', JSON.stringify(userProfile));
                if (window.userProfile) {
                    window.userProfile.equipment_access = window.checkInProgress.equipment;
                    window.userProfile.gym_access = (window.checkInProgress.equipment === 'gym');
                }
                console.log('✅ Equipment access saved:', window.checkInProgress.equipment);
            } catch (e) {
                console.warn('Failed to save equipment access:', e);
            }
        }

        // Update Active Symptoms display
        const symptomsDisplay = document.getElementById('profile-symptoms-display');
        if (symptomsDisplay) {
            const symptoms = window.checkInProgress.symptoms || [];
            if (symptoms.length > 0) {
                const formattedSymptoms = symptoms.map(s =>
                    s.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
                ).join(', ');
                symptomsDisplay.textContent = formattedSymptoms;
            } else {
                symptomsDisplay.textContent = 'None';
            }
        }

        // Trigger Cycle Sync Engine
        if (typeof applyCycleSync === 'function') applyCycleSync(window.checkInProgress);

        // Handle rest-indicating conditions - show yoga recommendation popup
        // IMPORTANT: Check this BEFORE refreshing views, as view refreshes may interfere
        const isMale = (typeof isMaleUser === 'function' && isMaleUser());
        const symptoms = window.checkInProgress.symptoms || [];
        let yogaPopupReason = null;

        // Debug logging for yoga popup trigger
        console.log('🧘 Yoga popup check:', {
            energy: window.checkInProgress.energy,
            recovery: window.checkInProgress.recovery,
            symptoms: symptoms,
            isMale: isMale
        });

        // Check for conditions that should trigger yoga recommendation
        if (window.checkInProgress.energy === 'low') {
            yogaPopupReason = 'low_energy';
        } else if (isMale && window.checkInProgress.recovery === 'tired') {
            yogaPopupReason = 'tired';
        } else if (isMale && window.checkInProgress.recovery === 'moderate') {
            yogaPopupReason = 'fatigued';
        } else if (isMale && symptoms.includes('muscle_soreness')) {
            yogaPopupReason = 'muscle_soreness';
        } else if (symptoms.includes('back_pain')) {
            yogaPopupReason = 'back_pain';
        } else if (!isMale && symptoms.includes('cramps')) {
            yogaPopupReason = 'cramps';
        }

        if (yogaPopupReason) {
            console.log('🧘 Triggering yoga popup with reason:', yogaPopupReason);
            // Close the check-in modal first so the yoga popup is visible
            closeCheckInModal();
            if (typeof showLowEnergyYogaPopup === 'function') showLowEnergyYogaPopup(yogaPopupReason);
            return;
        } else {
            console.log('🧘 No yoga popup needed');
        }

        // Close & Refresh views (only if no yoga popup shown)
        closeCheckInModal();
        if (typeof initCycleView === 'function') initCycleView();
        if (typeof renderWeeklyCalendar === 'function') renderWeeklyCalendar();
        if (typeof renderMovementView === 'function') renderMovementView();

        // Clear any workout override
        localStorage.removeItem('todayWorkoutOverride');
        if (userCycleData.logs && userCycleData.logs[today]) {
            delete userCycleData.logs[today].workoutOverride;
            localStorage.setItem('userCycleData', JSON.stringify(userCycleData));
        }

        if (typeof switchAppTab === 'function') switchAppTab('dashboard');
        if (typeof showCycleSyncBanner === 'function') showCycleSyncBanner();

    } catch (err) {
        console.error('Error in submitDailyCycleSync:', err);
        alert('There was an error saving your check-in. Please try again.');
    }
}

// Expose to global scope
window.selectCheckInOption = selectCheckInOption;
window.toggleCheckInOption = toggleCheckInOption;
window.openCheckInModal = openCheckInModal;
window.closeCheckInModal = closeCheckInModal;
window.submitDailyCycleSync = submitDailyCycleSync;