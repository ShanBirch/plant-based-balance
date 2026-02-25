function toggleProfileEditMode() {
        const isEditing = document.getElementById('btn-save-profile').style.display === 'inline-flex';

        // SYMPTOMS_LIST removed - symptoms can only be updated via daily check-in

        const editMap = [
             { id: 'profile-name-display', type: 'text' },
             { id: 'profile-email-display', type: 'text' },
             { id: 'profile-age-display', type: 'text' },
             { id: 'profile-weight-display', type: 'text' },
             { id: 'profile-goal-display', type: 'text' }
             // Energy Level, Equipment, and Symptoms removed - can only be updated via daily check-in
        ];
        
        if (!isEditing) {
            // Enter Edit Mode
            editMap.forEach(f => {
                const el = document.getElementById(f.id);
                if(!el) return;

                let currentVal = el.innerText;
                if(f.id === 'profile-weight-display') currentVal = currentVal.replace(' kg', '');
                // Use dataset raw for mapped values if available
                if(el.dataset.raw) currentVal = el.dataset.raw; 

                el.dataset.original = currentVal;
                
                // Parse current array if multiselect
                let currentArray = [];
                if (f.type === 'multiselect') {
                    // Start with dataset raw (array or comma string)
                     const raw = el.dataset.raw || currentVal; 
                     if (Array.isArray(raw)) currentArray = raw;
                     else if (typeof raw === 'string') currentArray = raw.split(',').map(s=>s.trim().toLowerCase());
                     else currentArray = [];
                     
                     // Handle "None" text case
                     if(currentArray.length === 1 && currentArray[0] === 'none') currentArray = [];
                }

                if (f.type === 'text') {
                     const align = f.id.includes('symptoms') ? 'right' : 'center';
                     el.innerHTML = `<input type="text" value="${currentVal}" style="width:100%; border:1px solid var(--primary); padding:4px 8px; border-radius:6px; font-family:inherit; font-size:inherit; text-align:${align}; background:white;">`;
                } else if (f.type === 'select') {
                    let opts = '';
                    f.options.forEach(opt => {
                        const val = Array.isArray(opt) ? opt[0] : opt;
                        const label = Array.isArray(opt) ? opt[1] : opt;
                        const selected = (String(val).toLowerCase() === String(currentVal).toLowerCase()) ? 'selected' : '';
                        opts += `<option value="${val}" ${selected}>${label}</option>`;
                    });
                    el.innerHTML = `<select style="width:100%; border:1px solid var(--primary); padding:4px; border-radius:6px; font-family:inherit; font-size:inherit; background:white;">${opts}</select>`;
                } else if (f.type === 'multiselect') {
                    let checks = '';
                    f.options.forEach(opt => {
                        const isChecked = currentArray.some(s => s.includes(opt.val) || s === opt.label.toLowerCase()); // Loose match
                        checks += `
                            <label style="display:flex; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid #f1f5f9; cursor:pointer;">
                                <input type="checkbox" value="${opt.val}" ${isChecked ? 'checked' : ''} style="width:18px; height:18px; accent-color:var(--primary);">
                                <span style="font-size:0.9rem; color:var(--text-main);">${opt.label}</span>
                            </label>
                        `;
                    });
                    el.innerHTML = `
                        <div class="multiselect-container" style="border:1px solid var(--primary); background:white; border-radius:8px; padding:8px 12px; max-height:200px; overflow-y:auto; text-align:left;">
                            ${checks}
                        </div>
                    `;
                }
            });
            document.getElementById('btn-save-profile').style.display = 'inline-flex';
            document.getElementById('btn-edit-profile').style.display = 'none';
        }
    }
    
    function saveProfileChanges() {
        const fields = [
            { id: 'profile-name-display', key: 'name' },
            { id: 'profile-email-display', key: 'email' },
            { id: 'profile-age-display', key: 'age' },
            { id: 'profile-weight-display', key: 'weight' },
            { id: 'profile-goal-display', key: 'goal_weight' }
            // Energy Level, Equipment, and Symptoms removed - can only be updated via daily check-in
        ];
        
        let quizData = {};
        try { quizData = JSON.parse(sessionStorage.getItem('userProfile') || '{}'); } catch(e){}
        
        fields.forEach(f => {
            const el = document.getElementById(f.id);
            if(!el) return;

            // NOTE: Energy Level, Equipment, and Symptoms removed - can only be updated via daily check-in

            const input = el.querySelector('input, select');
            if(input) {
                let val = input.value;
                quizData[f.key] = val;
                // Update UI Display properly
                el.innerText = val + (f.key === 'weight' ? ' kg' : '');
            }
        });
        
        // Save to Supabase (Split Logic)
        if (window.currentUser) {
            const userColumns = ['name', 'email'];
            const coreData = {};
            const factsData = {};

            Object.keys(quizData).forEach(k => {
                if (userColumns.includes(k)) coreData[k] = quizData[k];
                else factsData[k] = quizData[k];
            });

            // 1. Core
            if (Object.keys(coreData).length > 0) {
                 dbHelpers.users.update(window.currentUser.id, coreData).catch(console.error);
            }

            // 2. Facts
            if (Object.keys(factsData).length > 0) {
                (async () => {
                    let existingFacts = {};
                    try { existingFacts = await dbHelpers.userFacts.get(window.currentUser.id); } catch(e){}
                    const currentDetails = existingFacts?.personal_details || {};

                    await dbHelpers.userFacts.upsert(window.currentUser.id, {
                        personal_details: { ...currentDetails, ...factsData }
                    });
                    // Note: equipment_access is now only updated via daily check-in
                })();
            }
            
            window.userProfile = { ...window.userProfile, ...quizData }; // Update cache

            // IMPORTANT: Also update localStorage so workout schedules pick up the change
            try {
                const stored = JSON.parse(localStorage.getItem('userProfile') || '{}');
                Object.assign(stored, quizData);
                localStorage.setItem('userProfile', JSON.stringify(stored));
            } catch(e) { console.error('Failed to update localStorage:', e); }

            // Update sessionStorage as well (merge with existing to preserve data)
            try {
                const sessionStored = JSON.parse(sessionStorage.getItem('userProfile') || '{}');
                Object.assign(sessionStored, quizData);
                sessionStorage.setItem('userProfile', JSON.stringify(sessionStored));
            } catch(e) { sessionStorage.setItem('userProfile', JSON.stringify(quizData)); }

            // Clear cached profile to force reload with new values
            // This ensures renderMovementView and other functions get fresh data
            if (window.userProfile) {
                window.userProfile = { ...window.userProfile, ...quizData };
            }

            // Refresh ALL views to reflect new equipment settings
            if(typeof renderMovementView === 'function') setTimeout(renderMovementView, 100);
            if(typeof renderWeeklyCalendar === 'function') setTimeout(renderWeeklyCalendar, 150); // Refresh calendar
            if(typeof loadProfileData === 'function') loadProfileData(); // Refresh profile display logic
        }

        document.getElementById('btn-save-profile').style.display = 'none';
        document.getElementById('btn-edit-profile').style.display = 'inline-flex';
    }

    /**
     * Recalculate calories - opens wizard to allow user to update their profile data
     */
    function recalculateCalories() {
        console.log('recalculateCalories called');
        // Check if user is logged in
        if (!window.currentUser?.id) {
            alert('Please log in to recalculate your calories.');
            return;
        }

        // Open the recalculate calories wizard
        openRecalculateWizard().catch(err => {
            console.error('Error opening recalculate wizard:', err);
            alert('Error opening wizard. Please try again.');
        });
    }

    // Recalculate Wizard State
    let recalcWizardStep = 1;
    const totalRecalcSteps = 3;
    let recalcWizardData = {};

    /**
     * Open the recalculate calories wizard and pre-fill with current data
     */
    async function openRecalculateWizard() {
        console.log('openRecalculateWizard called');

        // Reset wizard state
        recalcWizardStep = 1;
        recalcWizardData = {};

        // Fetch current profile data to pre-fill the form
        let profileData = {};
        try {
            if (typeof dbHelpers !== 'undefined' && window.currentUser?.id) {
                const quizData = await dbHelpers.quizResults.getLatest(window.currentUser.id);
                if (quizData) profileData = quizData;
            }
        } catch (e) {
            console.log('Could not fetch quiz data:', e);
        }

        // Also check localStorage for backup data
        let localProfile = {};
        try { localProfile = JSON.parse(localStorage.getItem('userProfile') || '{}'); } catch(e) {}
        let sessionProfile = {};
        try { sessionProfile = JSON.parse(sessionStorage.getItem('userProfile') || '{}'); } catch(e) {}
        profileData = { ...localProfile, ...sessionProfile, ...profileData };

        try {
            // Pre-fill form fields with current data (using optional chaining to avoid null crashes)
            if (profileData.sex) {
                const genderEl = document.getElementById('recalc-wizard-gender');
                if (genderEl) genderEl.value = profileData.sex;
                selectRecalcGender(profileData.sex, true); // true = don't auto-advance
            }
            if (profileData.age) {
                const ageEl = document.getElementById('recalc-wizard-age');
                if (ageEl) ageEl.value = profileData.age;
            }
            if (profileData.height) {
                const heightEl = document.getElementById('recalc-wizard-height');
                if (heightEl) heightEl.value = profileData.height;
            }
            if (profileData.weight) {
                const weightEl = document.getElementById('recalc-wizard-weight');
                if (weightEl) weightEl.value = profileData.weight;
            }
            if (profileData.goal_weight) {
                const goalWeightEl = document.getElementById('recalc-wizard-goal-weight');
                if (goalWeightEl) goalWeightEl.value = profileData.goal_weight;
            }
            if (profileData.activity_level) {
                const activityEl = document.getElementById('recalc-wizard-activity-level');
                if (activityEl) activityEl.value = profileData.activity_level;
            }

            // Handle goal body type
            const goalType = profileData.goalBodyType || profileData.goal_body_type || '';
            if (goalType) {
                const goalTypeEl = document.getElementById('recalc-wizard-goal-type');
                if (goalTypeEl) goalTypeEl.value = goalType;
            }

            // Reset slides to initial state
            document.querySelectorAll('.recalc-wizard-slide').forEach(slide => {
                slide.style.display = 'none';
                slide.classList.remove('active');
            });
            const slide1 = document.getElementById('recalc-slide-1');
            if (slide1) {
                slide1.style.display = 'block';
                slide1.classList.add('active');
            }

            // Update progress dots
            updateRecalcProgress(1);

            // Update buttons
            const btnBack = document.getElementById('recalc-btn-back');
            if (btnBack) btnBack.style.display = 'none';
            const btnNext = document.getElementById('recalc-btn-next');
            if (btnNext) btnNext.textContent = 'Next';

            // Show the wizard
            console.log('Showing recalculate wizard modal');
            const wizardModal = document.getElementById('recalculate-calories-wizard');
            wizardModal.classList.add('active');
            wizardModal.style.display = 'flex';
            wizardModal.style.opacity = '1';
        } catch (domError) {
            console.error('Error setting up wizard DOM:', domError);
            throw domError;
        }
    }

    /**
     * Close the recalculate wizard
     */
    function closeRecalculateWizard() {
        const wizardModal = document.getElementById('recalculate-calories-wizard');
        wizardModal.classList.remove('active');
        wizardModal.style.display = 'none';
        wizardModal.style.opacity = '0';
        recalcWizardStep = 1;
        recalcWizardData = {};
    }

    /**
     * Select gender in recalculate wizard
     */
    function selectRecalcGender(gender, noAdvance = false) {
        document.getElementById('recalc-wizard-gender').value = gender;
        recalcWizardData.sex = gender;

        // Update button styles
        const femaleBtn = document.getElementById('recalc-gender-btn-female');
        const maleBtn = document.getElementById('recalc-gender-btn-male');

        femaleBtn.style.border = gender === 'female' ? '2px solid var(--primary)' : '2px solid #e2e8f0';
        femaleBtn.style.background = gender === 'female' ? 'rgba(72,134,75,0.1)' : 'white';
        maleBtn.style.border = gender === 'male' ? '2px solid var(--primary)' : '2px solid #e2e8f0';
        maleBtn.style.background = gender === 'male' ? 'rgba(72,134,75,0.1)' : 'white';

        // Auto-advance to next step if not pre-filling
        if (!noAdvance) {
            setTimeout(() => recalcWizardNext(), 300);
        }
    }

    /**
     * Update progress dots for recalculate wizard
     */
    function updateRecalcProgress(step) {
        const dots = document.querySelectorAll('.recalc-wizard-progress .dot');
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index < step);
        });
    }

    /**
     * Navigate to next step in recalculate wizard
     */
    async function recalcWizardNext() {
        // Validate current step
        if (recalcWizardStep === 1) {
            const gender = document.getElementById('recalc-wizard-gender').value;
            if (!gender) {
                alert('Please select your program.');
                return;
            }
            recalcWizardData.sex = gender;
        } else if (recalcWizardStep === 2) {
            // Validate step 2 fields
            const age = document.getElementById('recalc-wizard-age').value;
            const height = document.getElementById('recalc-wizard-height').value;
            const weight = document.getElementById('recalc-wizard-weight').value;
            const goalWeight = document.getElementById('recalc-wizard-goal-weight').value;
            const activityLevel = document.getElementById('recalc-wizard-activity-level').value;
            const goalType = document.getElementById('recalc-wizard-goal-type').value;

            if (!age || !height || !weight || !goalWeight || !activityLevel || !goalType) {
                alert('Please fill in all fields.');
                return;
            }

            recalcWizardData.age = parseInt(age);
            recalcWizardData.height = parseFloat(height);
            recalcWizardData.weight = parseFloat(weight);
            recalcWizardData.goal_weight = parseFloat(goalWeight);
            recalcWizardData.activity_level = activityLevel;
            recalcWizardData.goalBodyType = goalType;

            // Calculate nutrition goals and show results
            const nutritionGoals = calculateNutritionGoals({
                age: recalcWizardData.age,
                height: recalcWizardData.height,
                weight: recalcWizardData.weight,
                goal_weight: recalcWizardData.goal_weight,
                sex: recalcWizardData.sex,
                activity_level: recalcWizardData.activity_level,
                goalBodyType: recalcWizardData.goalBodyType
            });

            if (!nutritionGoals) {
                alert('Failed to calculate nutrition goals. Please check your data.');
                return;
            }

            recalcWizardData.nutritionGoals = nutritionGoals;

            // Update results display
            document.getElementById('recalc-result-calories').textContent = nutritionGoals.calorie_goal + ' kcal';
            document.getElementById('recalc-result-protein').textContent = nutritionGoals.protein_goal_g + 'g';
            document.getElementById('recalc-result-carbs').textContent = nutritionGoals.carbs_goal_g + 'g';
            document.getElementById('recalc-result-fat').textContent = nutritionGoals.fat_goal_g + 'g';

            // Update summary text
            let summaryText = '';
            if (recalcWizardData.weight > recalcWizardData.goal_weight) {
                summaryText = `We've set a calorie deficit to help you lose ${(recalcWizardData.weight - recalcWizardData.goal_weight).toFixed(1)}kg.`;
            } else if (recalcWizardData.weight < recalcWizardData.goal_weight) {
                summaryText = `We've set a calorie surplus to help you gain ${(recalcWizardData.goal_weight - recalcWizardData.weight).toFixed(1)}kg.`;
            } else {
                summaryText = `Your goals are set to maintain your current weight.`;
            }
            document.getElementById('recalc-summary-text').textContent = summaryText;
        } else if (recalcWizardStep === 3) {
            // Save and close
            await saveRecalculateWizardData();
            return;
        }

        // Move to next step
        recalcWizardStep++;
        showRecalcSlide(recalcWizardStep);
    }

    /**
     * Navigate to previous step in recalculate wizard
     */
    function recalcWizardBack() {
        if (recalcWizardStep > 1) {
            recalcWizardStep--;
            showRecalcSlide(recalcWizardStep);
        }
    }

    /**
     * Show specific slide in recalculate wizard
     */
    function showRecalcSlide(step) {
        // Hide all slides
        document.querySelectorAll('.recalc-wizard-slide').forEach(slide => {
            slide.style.display = 'none';
            slide.classList.remove('active');
        });

        // Show target slide
        const targetSlide = document.getElementById(`recalc-slide-${step}`);
        if (targetSlide) {
            targetSlide.style.display = 'block';
            targetSlide.classList.add('active');
        }

        // Update progress
        updateRecalcProgress(step);

        // Update buttons
        const backBtn = document.getElementById('recalc-btn-back');
        const nextBtn = document.getElementById('recalc-btn-next');

        backBtn.style.display = step > 1 ? 'block' : 'none';

        if (step === totalRecalcSteps) {
            nextBtn.textContent = 'Save & Update';
        } else {
            nextBtn.textContent = 'Next';
        }

        // Update title
        const titles = ['Update Your Goals', 'Your Details', 'Your New Goals'];
        document.getElementById('recalc-wizard-title').textContent = titles[step - 1] || 'Update Your Goals';
    }

    /**
     * Save recalculate wizard data to database
     */
    async function saveRecalculateWizardData() {
        const nextBtn = document.getElementById('recalc-btn-next');
        nextBtn.textContent = 'Saving...';
        nextBtn.disabled = true;

        try {
            const nutritionGoals = recalcWizardData.nutritionGoals;

            // Update quiz_results in database
            if (window.supabaseClient && window.currentUser?.id) {
                const { error } = await window.supabaseClient.from('quiz_results')
                    .update({
                        age: recalcWizardData.age,
                        height: recalcWizardData.height,
                        weight: recalcWizardData.weight,
                        goal_weight: recalcWizardData.goal_weight,
                        sex: recalcWizardData.sex,
                        activity_level: recalcWizardData.activity_level,
                        goal_body_type: recalcWizardData.goalBodyType,
                        bmr: nutritionGoals.bmr,
                        tdee: nutritionGoals.tdee,
                        calorie_goal: nutritionGoals.calorie_goal,
                        protein_goal_g: nutritionGoals.protein_goal_g,
                        carbs_goal_g: nutritionGoals.carbs_goal_g,
                        fat_goal_g: nutritionGoals.fat_goal_g
                    })
                    .eq('user_id', window.currentUser.id);

                if (error) {
                    console.error('Failed to save new goals:', error);
                    alert('Failed to save your new goals. Please try again.');
                    nextBtn.textContent = 'Save & Update';
                    nextBtn.disabled = false;
                    return;
                }

                // Also update users table with sex if changed
                await window.supabaseClient.from('users')
                    .update({ sex: recalcWizardData.sex })
                    .eq('id', window.currentUser.id);
            }

            // Update localStorage and sessionStorage
            const updatedData = {
                age: recalcWizardData.age,
                height: recalcWizardData.height,
                weight: recalcWizardData.weight,
                goal_weight: recalcWizardData.goal_weight,
                sex: recalcWizardData.sex,
                activity_level: recalcWizardData.activity_level,
                goalBodyType: recalcWizardData.goalBodyType,
                bmr: nutritionGoals.bmr,
                tdee: nutritionGoals.tdee,
                calorie_goal: nutritionGoals.calorie_goal,
                protein_goal_g: nutritionGoals.protein_goal_g,
                carbs_goal_g: nutritionGoals.carbs_goal_g,
                fat_goal_g: nutritionGoals.fat_goal_g
            };

            let storedLocal = {};
            try { storedLocal = JSON.parse(localStorage.getItem('userProfile') || '{}'); } catch(e) {}
            Object.assign(storedLocal, updatedData);
            localStorage.setItem('userProfile', JSON.stringify(storedLocal));

            let storedSession = {};
            try { storedSession = JSON.parse(sessionStorage.getItem('userProfile') || '{}'); } catch(e) {}
            Object.assign(storedSession, updatedData);
            sessionStorage.setItem('userProfile', JSON.stringify(storedSession));

            // Update window.userProfile cache
            if (window.userProfile) {
                Object.assign(window.userProfile, updatedData);
            }

            // Update today's daily_nutrition record with new goals
            const today = getLocalDateString();
            if (window.supabaseClient && window.currentUser?.id) {
                await window.supabaseClient.from('daily_nutrition')
                    .upsert({
                        user_id: window.currentUser.id,
                        nutrition_date: today,
                        calorie_goal: nutritionGoals.calorie_goal,
                        protein_goal_g: nutritionGoals.protein_goal_g,
                        carbs_goal_g: nutritionGoals.carbs_goal_g,
                        fat_goal_g: nutritionGoals.fat_goal_g
                    }, { onConflict: 'user_id,nutrition_date' });
            }

            // Refresh UI widgets
            if (typeof refreshNutritionWidgets === 'function') {
                refreshNutritionWidgets();
            }
            if (typeof loadNutritionData === 'function') {
                loadNutritionData();
            }

            console.log('✅ New nutrition goals saved:', nutritionGoals);

            // Close wizard and show success
            closeRecalculateWizard();
            alert(`Your goals have been updated!\n\nNew Daily Goals:\n• Calories: ${nutritionGoals.calorie_goal} kcal\n• Protein: ${nutritionGoals.protein_goal_g}g\n• Carbs: ${nutritionGoals.carbs_goal_g}g\n• Fat: ${nutritionGoals.fat_goal_g}g`);

        } catch (error) {
            console.error('Error saving recalculate wizard data:', error);
            alert('An error occurred while saving your goals. Please try again.');
            nextBtn.textContent = 'Save & Update';
            nextBtn.disabled = false;
        }
    }
