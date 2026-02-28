// ===== DAILY WEIGH-IN CARD LOGIC =====

    /**
     * Check if user has weighed in today and show/hide card accordingly
     */
    async function checkAndShowWeighInCard() {
        if (!window.currentUser) return;

        // Don't show weigh-in card if onboarding wizard is active or pending
        if (window._onboardingWizardPending) return;
        const wizard = document.getElementById('onboarding-wizard');
        if (wizard && wizard.style.display !== 'none') return;

        try {
            const todaysWeighIn = await db.weighIns.getTodaysWeighIn(window.currentUser.id);
            const card = document.getElementById('daily-weigh-in-card');
            const doneCard = document.getElementById('daily-weigh-in-done-card');

            if (card) {
                if (todaysWeighIn) {
                    // Already weighed in today - hide input card, show done card (unless dismissed)
                    card.style.display = 'none';
                    if (doneCard) {
                        const today = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];
                        const isDismissedLocal = localStorage.getItem('weighInDoneCardDismissedDate') === today;
                        const isDismissedCloud = (window._pbbDismissedDates && window._pbbDismissedDates['weighInDoneCard']) === today;
                        
                        if (isDismissedLocal || isDismissedCloud) {
                            doneCard.style.display = 'none';
                            if (isDismissedCloud && !isDismissedLocal) {
                                try { localStorage.setItem('weighInDoneCardDismissedDate', today); } catch(e) {}
                            }
                        } else {
                            doneCard.style.display = 'flex';
                        }
                    }
                } else {
                    // Show the card for today's weigh-in
                    card.style.display = 'block';
                    if (doneCard) doneCard.style.display = 'none';

                    // Pre-fill with last known weight if available
                    const latestWeighIn = await db.weighIns.getLatest(window.currentUser.id);
                    if (latestWeighIn) {
                        const input = document.getElementById('weigh-in-weight-input');
                        if (input) input.placeholder = `Last: ${latestWeighIn.weight_kg} kg`;
                    }

                    // Check user's preferred unit and update label
                    updateWeighInUnitLabel();
                }
            }
        } catch (error) {
            console.error('Error checking weigh-in status:', error);
        }
    }

    /**
     * Update the unit label based on user preference
     */
    function updateWeighInUnitLabel() {
        const unitLabel = document.getElementById('weigh-in-unit-label');
        const input = document.getElementById('weigh-in-weight-input');

        // Check if user prefers lbs (from localStorage or user settings)
        const preferLbs = localStorage.getItem('weightUnitPreference') === 'lbs';

        if (unitLabel && input) {
            if (preferLbs) {
                unitLabel.textContent = 'lbs';
                input.step = '1';
            } else {
                unitLabel.textContent = 'kg';
                input.step = '0.1';
            }
        }
    }

    /**
     * Submit the daily weigh-in
     */
    async function submitDailyWeighIn() {
        if (!window.currentUser) {
            alert('Please log in to track your weight.');
            return;
        }

        const input = document.getElementById('weigh-in-weight-input');
        const inputSection = document.getElementById('weigh-in-input-section');
        const successSection = document.getElementById('weigh-in-success-section');
        const card = document.getElementById('daily-weigh-in-card');

        let weightValue = parseFloat(input?.value);

        if (!weightValue || weightValue < 20 || weightValue > 500) {
            alert('Please enter a valid weight.');
            return;
        }

        // Convert lbs to kg if needed
        const preferLbs = localStorage.getItem('weightUnitPreference') === 'lbs';
        if (preferLbs) {
            weightValue = weightValue * 0.453592; // Convert lbs to kg
        }

        try {
            // Log the weigh-in
            await db.weighIns.log(window.currentUser.id, weightValue);

            // Award 1 XP (add to lifetime_points for leveling)
            try {
                const { data: currentPoints } = await supabaseClient
                    .from('user_points')
                    .select('lifetime_points')
                    .eq('user_id', window.currentUser.id)
                    .maybeSingle();

                if (currentPoints) {
                    await supabaseClient
                        .from('user_points')
                        .update({ lifetime_points: (currentPoints.lifetime_points || 0) + 1 })
                        .eq('user_id', window.currentUser.id);
                } else {
                    // Create user_points record if doesn't exist
                    await supabaseClient
                        .from('user_points')
                        .insert({ user_id: window.currentUser.id, lifetime_points: 1, current_points: 0 });
                }

                // Trigger XP bar animation if available
                if (typeof triggerXPBarRainbow === 'function') triggerXPBarRainbow();
                if (typeof refreshLevelDisplay === 'function') refreshLevelDisplay();
            } catch (xpError) {
                console.log('XP award skipped:', xpError);
            }

            // Show success animation
            if (inputSection) inputSection.style.display = 'none';
            if (successSection) successSection.style.display = 'block';

            // Update user's current weight in profile
            try {
                await db.users.update(window.currentUser.id, { weight: weightValue });
            } catch (updateError) {
                console.log('Profile weight update skipped:', updateError);
            }

            // Hide input card after 2 seconds and show done card
            setTimeout(() => {
                if (card) {
                    card.style.transition = 'opacity 0.5s, transform 0.5s';
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(-20px)';
                    setTimeout(() => {
                        card.style.display = 'none';
                        // Reset for next day
                        card.style.opacity = '1';
                        card.style.transform = 'translateY(0)';
                        if (inputSection) inputSection.style.display = 'flex';
                        if (successSection) successSection.style.display = 'none';
                        if (input) input.value = '';
                        // Show the completed card
                        const doneCard = document.getElementById('daily-weigh-in-done-card');
                        if (doneCard) doneCard.style.display = 'flex';
                    }, 500);
                }
            }, 2000);

            // Refresh points display if visible
            if (typeof refreshPointsDisplay === 'function') {
                refreshPointsDisplay();
            }

        } catch (error) {
            console.error('Error logging weigh-in:', error);
            alert('Failed to log weigh-in. Please try again.');
        }
    }

    function dismissWeighInDoneCard() {
        const today = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];
        try {
            localStorage.setItem('weighInDoneCardDismissedDate', today);
        } catch (e) { console.warn('localStorage full', e); }
        
        // Sync to cloud
        if (typeof window.syncTrendDismissalToDb === 'function') {
            window.syncTrendDismissalToDb('weighInDoneCard', today);
        }

        const el = document.getElementById('daily-weigh-in-done-card');
        if (el) el.style.display = 'none';
    }

    // Make functions globally available
    window.dismissWeighInDoneCard = dismissWeighInDoneCard;
    window.submitDailyWeighIn = submitDailyWeighIn;
    window.checkAndShowWeighInCard = checkAndShowWeighInCard;

    // ===== FITNESS DIARY CARD (Daily from 6 PM) =====

    window._fitnessDiaryData = { day_rating: null, energy_level: null };

    function getTodayDateKey() {
        var d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    }

    async function checkAndShowFitnessDiaryCard() {
        if (!window.currentUser) return;
        // Don't show if onboarding wizard is active
        if (window._onboardingWizardPending) return;
        var wizard = document.getElementById('onboarding-wizard');
        if (wizard && wizard.style.display !== 'none') return;

        var card = document.getElementById('fitness-diary-card');
        var doneCard = document.getElementById('fitness-diary-done-card');
        if (!card) return;

        // Only show from 6 PM onwards
        var now = new Date();
        if (now.getHours() < 18) {
            card.style.display = 'none';
            if (doneCard) doneCard.style.display = 'none';
            return;
        }

        // Check if already completed today
        var dateKey = getTodayDateKey();
        var lsKey = 'fitnessDiaryDone_' + dateKey;

        if (localStorage.getItem(lsKey)) {
            // Already done — show done card (unless dismissed)
            card.style.display = 'none';
            if (doneCard) {
                var dismissKey = 'fitnessDiaryDoneDismissed_' + dateKey;
                doneCard.style.display = localStorage.getItem(dismissKey) ? 'none' : 'flex';
            }
            return;
        }

        // Show the diary card
        card.style.display = 'block';
        if (doneCard) doneCard.style.display = 'none';

        // Reset form state
        var collapsed = document.getElementById('fitness-diary-collapsed');
        var form = document.getElementById('fitness-diary-form');
        var success = document.getElementById('fitness-diary-success');
        if (collapsed) collapsed.style.display = 'flex';
        if (form) form.style.display = 'none';
        if (success) success.style.display = 'none';
        window._fitnessDiaryData = { day_rating: null, energy_level: null };
    }

    // Backwards compatibility alias
    window.checkAndShowWeeklyCheckinCard = checkAndShowFitnessDiaryCard;

    function expandFitnessDiary() {
        var collapsed = document.getElementById('fitness-diary-collapsed');
        var form = document.getElementById('fitness-diary-form');
        if (collapsed) collapsed.style.display = 'none';
        if (form) form.style.display = 'block';
    }

    function selectFitnessDiaryOption(group, value, el) {
        window._fitnessDiaryData[group] = value;
        var chips = document.querySelectorAll('.wcheckin-chip[data-group="' + group + '"]');
        chips.forEach(function(c) {
            c.style.background = 'rgba(255,255,255,0.15)';
            c.style.borderColor = 'transparent';
            c.style.fontWeight = '400';
        });
        el.style.background = 'rgba(255,255,255,0.35)';
        el.style.borderColor = 'white';
        el.style.fontWeight = '700';
    }

    async function submitFitnessDiary() {
        if (!window.currentUser) return;

        if (!window._fitnessDiaryData.day_rating) {
            alert('Please select how your day felt!');
            return;
        }

        var form = document.getElementById('fitness-diary-form');
        var success = document.getElementById('fitness-diary-success');
        var card = document.getElementById('fitness-diary-card');

        var highlightInput = document.getElementById('diary-highlight');
        var struggleInput = document.getElementById('diary-struggle');
        var noteInput = document.getElementById('diary-note');

        var dateKey = getTodayDateKey();
        var diaryPayload = {
            type: 'fitness_diary',
            day_rating: window._fitnessDiaryData.day_rating,
            energy_level: window._fitnessDiaryData.energy_level,
            highlight: (highlightInput && highlightInput.value.trim()) || null,
            struggle: (struggleInput && struggleInput.value.trim()) || null,
            note: (noteInput && noteInput.value.trim()) || null
        };

        try {
            // Save to daily_checkins using the existing upsert with additional_data
            await db.checkins.upsert(window.currentUser.id, dateKey, {
                energy: window._fitnessDiaryData.day_rating,
                additional_data: diaryPayload
            });

            // Award 1 XP
            try {
                var { data: currentPoints } = await supabaseClient
                    .from('user_points')
                    .select('lifetime_points')
                    .eq('user_id', window.currentUser.id)
                    .maybeSingle();

                if (currentPoints) {
                    await supabaseClient
                        .from('user_points')
                        .update({ lifetime_points: (currentPoints.lifetime_points || 0) + 1 })
                        .eq('user_id', window.currentUser.id);
                } else {
                    await supabaseClient
                        .from('user_points')
                        .insert({ user_id: window.currentUser.id, lifetime_points: 1, current_points: 0 });
                }

                if (typeof triggerXPBarRainbow === 'function') triggerXPBarRainbow();
                if (typeof refreshLevelDisplay === 'function') refreshLevelDisplay();
            } catch (xpErr) {
                console.log('Fitness diary XP award skipped:', xpErr);
            }

            // Show success
            if (form) form.style.display = 'none';
            if (success) success.style.display = 'block';

            // Mark as done in localStorage
            localStorage.setItem('fitnessDiaryDone_' + dateKey, '1');

            // Transition to done card
            setTimeout(function() {
                if (card) {
                    card.style.transition = 'opacity 0.5s, transform 0.5s';
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(-20px)';
                    setTimeout(function() {
                        card.style.display = 'none';
                        card.style.opacity = '1';
                        card.style.transform = 'translateY(0)';
                        var doneCard = document.getElementById('fitness-diary-done-card');
                        if (doneCard) doneCard.style.display = 'flex';
                    }, 500);
                }
            }, 2000);

            if (typeof refreshPointsDisplay === 'function') refreshPointsDisplay();

        } catch (err) {
            console.error('Error submitting fitness diary:', err);
            alert('Failed to save diary entry. Please try again.');
        }
    }

    function dismissFitnessDiaryDoneCard() {
        var dateKey = getTodayDateKey();
        localStorage.setItem('fitnessDiaryDoneDismissed_' + dateKey, '1');
        document.getElementById('fitness-diary-done-card').style.display = 'none';
    }

    window.checkAndShowFitnessDiaryCard = checkAndShowFitnessDiaryCard;
    window.expandFitnessDiary = expandFitnessDiary;
    window.selectFitnessDiaryOption = selectFitnessDiaryOption;
    window.submitFitnessDiary = submitFitnessDiary;
    window.dismissFitnessDiaryDoneCard = dismissFitnessDiaryDoneCard;

    // ===== MOOD CHECK-IN CARD (3x daily: morning, afternoon, evening) =====

    window._moodCheckinData = { mood: null, energy: null, stress: null };

    function getMoodTimeWindow() {
        var hour = new Date().getHours();
        if (hour >= 4 && hour < 12) return 'morning';
        if (hour >= 12 && hour < 18) return 'afternoon';
        if (hour >= 18 || hour < 4) return 'evening';
        return null;
    }

    function getMoodWindowLabel(w) {
        if (w === 'morning') return 'Morning';
        if (w === 'afternoon') return 'Afternoon';
        if (w === 'evening') return 'Evening';
        return '';
    }

    function getMoodCompletedWindows() {
        var dateKey = getTodayDateKey();
        var raw = localStorage.getItem('moodCheckin_' + dateKey);
        return raw ? JSON.parse(raw) : {};
    }

    function setMoodCompletedWindow(window_name) {
        var dateKey = getTodayDateKey();
        var completed = getMoodCompletedWindows();
        completed[window_name] = true;
        localStorage.setItem('moodCheckin_' + dateKey, JSON.stringify(completed));
    }

    function updateMoodDots() {
        var completed = getMoodCompletedWindows();
        ['morning', 'afternoon', 'evening'].forEach(function(w) {
            var dot = document.getElementById('mood-dot-' + w);
            if (dot) {
                if (completed[w]) {
                    dot.style.background = 'white';
                    dot.style.borderColor = 'white';
                } else {
                    dot.style.background = 'transparent';
                    dot.style.borderColor = 'rgba(255,255,255,0.6)';
                }
            }
        });
    }

    async function checkAndShowMoodCheckinCard() {
        if (!window.currentUser) return;
        if (window._onboardingWizardPending) return;
        var wizard = document.getElementById('onboarding-wizard');
        if (wizard && wizard.style.display !== 'none') return;

        var card = document.getElementById('mood-checkin-card');
        var doneCard = document.getElementById('mood-checkin-done-card');
        if (!card) return;

        var currentWindow = getMoodTimeWindow();
        var completed = getMoodCompletedWindows();
        var allDone = completed.morning && completed.afternoon && completed.evening;

        updateMoodDots();

        if (allDone) {
            // All 3 windows done — show done card unless dismissed
            card.style.display = 'none';
            if (doneCard) {
                var dateKey = getTodayDateKey();
                var dismissKey = 'moodCheckinDoneDismissed_' + dateKey;
                doneCard.style.display = localStorage.getItem(dismissKey) ? 'none' : 'flex';
            }
            return;
        }

        if (!currentWindow || completed[currentWindow]) {
            // Current window done or outside windows — hide card
            card.style.display = 'none';
            if (doneCard) doneCard.style.display = 'none';
            return;
        }

        // Show the mood card for this window
        card.style.display = 'block';
        if (doneCard) doneCard.style.display = 'none';

        // Update title
        var titleEl = document.getElementById('mood-checkin-title');
        var subtitleEl = document.getElementById('mood-checkin-subtitle');
        if (titleEl) titleEl.textContent = getMoodWindowLabel(currentWindow) + ' Check-In';
        if (subtitleEl) subtitleEl.textContent = 'Quick mood check — 3 taps';

        // Reset selections
        window._moodCheckinData = { mood: null, energy: null, stress: null };
        document.querySelectorAll('.mood-emoji-btn').forEach(function(btn) {
            btn.style.background = 'rgba(255,255,255,0.12)';
            btn.style.borderColor = 'transparent';
            btn.style.transform = 'scale(1)';
        });
        var submitBtn = document.getElementById('mood-checkin-submit');
        if (submitBtn) submitBtn.style.display = 'none';
        var form = document.getElementById('mood-checkin-form');
        var success = document.getElementById('mood-checkin-success');
        if (form) form.style.display = 'block';
        if (success) success.style.display = 'none';
    }

    function selectMoodEmoji(group, value, el) {
        window._moodCheckinData[group] = value;

        // Visual: reset group, highlight selected
        document.querySelectorAll('.mood-emoji-btn[data-group="' + group + '"]').forEach(function(btn) {
            btn.style.background = 'rgba(255,255,255,0.12)';
            btn.style.borderColor = 'transparent';
            btn.style.transform = 'scale(1)';
        });
        el.style.background = 'rgba(255,255,255,0.3)';
        el.style.borderColor = 'white';
        el.style.transform = 'scale(1.05)';

        // Show submit if all 3 selected
        var d = window._moodCheckinData;
        if (d.mood && d.energy && d.stress) {
            var btn = document.getElementById('mood-checkin-submit');
            if (btn) {
                btn.style.display = 'block';
                btn.style.animation = 'none';
                btn.offsetHeight; // reflow
                btn.style.animation = 'fadeIn 0.3s ease';
            }
        }
    }

    async function submitMoodCheckin() {
        if (!window.currentUser) return;
        var d = window._moodCheckinData;
        if (!d.mood || !d.energy || !d.stress) return;

        var currentWindow = getMoodTimeWindow();
        if (!currentWindow) return;

        // Map 1-5 scale to 2/4/6/8/10 for the mood_logs table (1-10 range)
        var moodScore = d.mood * 2;
        var energyScore = d.energy * 2;
        // Stress is inverted for the DB: 1=chill(low stress=2), 5=max(high stress=10)
        var stressScore = d.stress * 2;

        var dateKey = getTodayDateKey();

        try {
            // Save to mood_logs table
            await window.supabaseClient.from('mood_logs').insert({
                user_id: window.currentUser.id,
                logged_at: new Date().toISOString(),
                log_date: dateKey,
                mood_score: moodScore,
                energy_score: energyScore,
                stress_score: stressScore,
                context: currentWindow
            });

            // Mark this window as completed
            setMoodCompletedWindow(currentWindow);
            updateMoodDots();

            var completed = getMoodCompletedWindows();
            var allDone = completed.morning && completed.afternoon && completed.evening;

            var form = document.getElementById('mood-checkin-form');
            var success = document.getElementById('mood-checkin-success');
            var successText = document.getElementById('mood-checkin-success-text');
            var card = document.getElementById('mood-checkin-card');

            if (allDone) {
                // Award 1 XP for completing all 3
                try {
                    var { data: currentPoints } = await window.supabaseClient
                        .from('user_points')
                        .select('lifetime_points')
                        .eq('user_id', window.currentUser.id)
                        .maybeSingle();

                    if (currentPoints) {
                        await window.supabaseClient
                            .from('user_points')
                            .update({ lifetime_points: (currentPoints.lifetime_points || 0) + 1 })
                            .eq('user_id', window.currentUser.id);
                    } else {
                        await window.supabaseClient
                            .from('user_points')
                            .insert({ user_id: window.currentUser.id, lifetime_points: 1, current_points: 0 });
                    }
                    if (typeof triggerXPBarRainbow === 'function') triggerXPBarRainbow();
                    if (typeof refreshLevelDisplay === 'function') refreshLevelDisplay();
                } catch (xpErr) {
                    console.log('Mood XP award skipped:', xpErr);
                }

                if (form) form.style.display = 'none';
                if (success) success.style.display = 'block';
                if (successText) successText.textContent = 'All 3 check-ins done! Nice one.';

                // Transition to done card
                setTimeout(function() {
                    if (card) {
                        card.style.transition = 'opacity 0.5s, transform 0.5s';
                        card.style.opacity = '0';
                        card.style.transform = 'translateY(-20px)';
                        setTimeout(function() {
                            card.style.display = 'none';
                            card.style.opacity = '1';
                            card.style.transform = 'translateY(0)';
                            var doneCard = document.getElementById('mood-checkin-done-card');
                            if (doneCard) doneCard.style.display = 'flex';
                        }, 500);
                    }
                }, 2000);
            } else {
                // Not all done yet — show quick confirmation then hide card
                if (form) form.style.display = 'none';
                if (success) success.style.display = 'block';
                if (successText) {
                    var remaining = [];
                    if (!completed.morning) remaining.push('Morning');
                    if (!completed.afternoon) remaining.push('Afternoon');
                    if (!completed.evening) remaining.push('Evening');
                    successText.textContent = getMoodWindowLabel(currentWindow) + ' logged! ' + remaining.join(' & ') + ' left for +1 XP.';
                }

                setTimeout(function() {
                    if (card) {
                        card.style.transition = 'opacity 0.5s, transform 0.5s';
                        card.style.opacity = '0';
                        card.style.transform = 'translateY(-20px)';
                        setTimeout(function() {
                            card.style.display = 'none';
                            card.style.opacity = '1';
                            card.style.transform = 'translateY(0)';
                        }, 500);
                    }
                }, 2000);
            }

            if (typeof refreshPointsDisplay === 'function') refreshPointsDisplay();

        } catch (err) {
            console.error('Error submitting mood check-in:', err);
            alert('Failed to save mood check-in. Please try again.');
        }
    }

    function dismissMoodCheckinDoneCard() {
        var dateKey = getTodayDateKey();
        localStorage.setItem('moodCheckinDoneDismissed_' + dateKey, '1');
        var el = document.getElementById('mood-checkin-done-card');
        if (el) el.style.display = 'none';
    }

    window.checkAndShowMoodCheckinCard = checkAndShowMoodCheckinCard;
    window.selectMoodEmoji = selectMoodEmoji;
    window.submitMoodCheckin = submitMoodCheckin;
    window.dismissMoodCheckinDoneCard = dismissMoodCheckinDoneCard;

    // PWA resume: re-check weigh-in when app comes back to foreground
    // (e.g., user opens PWA the next day without a hard refresh)
    let _lastWeighInCheckDate = new Date().toDateString();
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') {
            // Always re-check mood & fitness diary on resume (time window may have changed)
            if (typeof checkAndShowMoodCheckinCard === 'function') checkAndShowMoodCheckinCard();
            if (typeof checkAndShowFitnessDiaryCard === 'function') checkAndShowFitnessDiaryCard();

            const today = new Date().toDateString();
            if (today !== _lastWeighInCheckDate) {
                // It's a new day since last check - refresh weigh-in card, modal & daily quiz
                _lastWeighInCheckDate = today;
                console.log('🔄 New day detected on PWA resume, refreshing daily cards');
                if (typeof checkAndShowWeighInCard === 'function') checkAndShowWeighInCard();
                if (typeof checkAndShowWeighInModal === 'function') checkAndShowWeighInModal();
                if (typeof checkAndShowMoodCheckinCard === 'function') checkAndShowMoodCheckinCard();
                if (typeof checkAndShowFitnessDiaryCard === 'function') checkAndShowFitnessDiaryCard();
                if (typeof checkAndShowDailyQuizCard === 'function') checkAndShowDailyQuizCard();
                if (typeof checkAndShowMealTipCard === 'function') checkAndShowMealTipCard();
                if (typeof checkAndShowProgressPhotoCard === 'function') checkAndShowProgressPhotoCard();
                if (typeof checkAndShowWorkoutTrendCard === 'function') checkAndShowWorkoutTrendCard();
                if (typeof initPerformanceCard === 'function') initPerformanceCard();
                if (typeof initFitbitDashboard === 'function') initFitbitDashboard();
                if (typeof initWhoopDashboard === 'function') initWhoopDashboard();
                if (typeof initOuraDashboard === 'function') initOuraDashboard();
                if (typeof initStravaDashboard === 'function') initStravaDashboard();
                if (typeof initSpotifyDashboard === 'function') initSpotifyDashboard();
            }
        }
    });