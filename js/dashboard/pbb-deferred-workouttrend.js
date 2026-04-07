// ===== DAILY WORKOUT TREND CARD LOGIC =====

    /**
     * Check and show the daily workout trend card on the home screen.
     * Analyzes recent workout history and shows a summary insight.
     */
    async function checkAndShowWorkoutTrendCard() {
        if (!window.currentUser) return;
        if (window._onboardingWizardPending) return;
        const wizard = document.getElementById('onboarding-wizard');
        if (wizard && wizard.style.display !== 'none') return;

        const card = document.getElementById('daily-workout-trend-card');
        if (!card) return;

        // Check if dismissed today (Check BOTH localStorage and cloud-synced state)
        const today = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];
        
        const isDismissedLocal = localStorage.getItem('workoutTrendCardDismissedDate') === today;
        const isDismissedCloud = (window._pbbDismissedDates && window._pbbDismissedDates['workoutTrendCard']) === today;

        if (isDismissedLocal || isDismissedCloud) {
            card.style.display = 'none';
            // Sync local if cloud is ahead
            if (isDismissedCloud && !isDismissedLocal) {
                try { localStorage.setItem('workoutTrendCardDismissedDate', today); } catch(e) {}
            }
            return;
        }

        try {
            var workoutData = await _getWorkoutTrendData();
            if (!workoutData) {
                card.style.display = 'none';
                return;
            }

            var textEl = document.getElementById('daily-workout-trend-text');
            if (textEl) textEl.textContent = workoutData.insight;
            card.style.display = 'block';
        } catch (err) {
            console.error('Error in checkAndShowWorkoutTrendCard:', err);
            card.style.display = 'none';
        }
    }

    /**
     * Load and show workout trend in the Movement tab card.
     */
    async function loadMovementTrendCard() {
        var card = document.getElementById('movement-workout-trend-card');
        if (!card) return;

        // Check if dismissed today
        const today = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];
        
        const isDismissedLocal = localStorage.getItem('movementTrendCardDismissedDate') === today;
        const isDismissedCloud = (window._pbbDismissedDates && window._pbbDismissedDates['movementTrendCard']) === today;

        if (isDismissedLocal || isDismissedCloud) {
            card.style.display = 'none';
            if (isDismissedCloud && !isDismissedLocal) {
                try { localStorage.setItem('movementTrendCardDismissedDate', today); } catch(e) {}
            }
            return;
        }

        try {
            var workoutData = await _getWorkoutTrendData();
            if (!workoutData) {
                card.style.display = 'none';
                return;
            }

            // Update Movement tab trend stats
            var weekEl = document.getElementById('movement-trend-week-count');
            var totalEl = document.getElementById('movement-trend-total-count');
            var streakEl = document.getElementById('movement-trend-streak');
            var insightEl = document.getElementById('movement-trend-insight');

            if (weekEl) weekEl.textContent = workoutData.thisWeekCount;
            if (totalEl) totalEl.textContent = workoutData.totalCount;
            if (streakEl) streakEl.textContent = workoutData.weekStreak;
            if (insightEl) insightEl.textContent = workoutData.insight;

            card.style.display = 'block';
        } catch (err) {
            console.error('Error loading movement trend card:', err);
            card.style.display = 'none';
        }
    }

    /**
     * Get workout trend data from history. Shared between home and movement tab.
     */
    async function _getWorkoutTrendData() {
        if (!window.currentUser) return null;

        try {
            // Get workout history (last 60 days worth)
            var history = await dbHelpers.workouts.getHistory(window.currentUser.id, 500);
            if (!history || history.length === 0) return null;

            // Get unique workout dates
            var uniqueDates = [];
            var dateSet = {};
            history.forEach(function(w) {
                if (w.workout_date && !dateSet[w.workout_date]) {
                    dateSet[w.workout_date] = true;
                    uniqueDates.push(w.workout_date);
                }
            });

            uniqueDates.sort(function(a, b) { return new Date(b) - new Date(a); });

            var totalCount = uniqueDates.length;
            if (totalCount === 0) return null;

            // This week's workouts (Mon-Sun)
            var now = new Date();
            var dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
            var mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            var monday = new Date(now);
            monday.setDate(monday.getDate() - mondayOffset);
            monday.setHours(0, 0, 0, 0);

            var thisWeekCount = 0;
            uniqueDates.forEach(function(dateStr) {
                var dateObj = new Date(dateStr + 'T12:00:00');
                if (dateObj >= monday) thisWeekCount++;
            });

            // Calculate week streak (consecutive weeks with at least 1 workout)
            var weekStreak = 0;
            var checkWeekStart = new Date(monday);

            for (var w = 0; w < 52; w++) {
                var weekStart = new Date(checkWeekStart);
                weekStart.setDate(weekStart.getDate() - (w * 7));
                var weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 7);

                var hasWorkout = uniqueDates.some(function(dateStr) {
                    var dateObj = new Date(dateStr + 'T12:00:00');
                    return dateObj >= weekStart && dateObj < weekEnd;
                });

                if (hasWorkout) {
                    weekStreak++;
                } else {
                    break;
                }
            }

            // Last week's workouts for comparison
            var lastMonday = new Date(monday);
            lastMonday.setDate(lastMonday.getDate() - 7);
            var lastWeekCount = 0;
            uniqueDates.forEach(function(dateStr) {
                var dateObj = new Date(dateStr + 'T12:00:00');
                if (dateObj >= lastMonday && dateObj < monday) lastWeekCount++;
            });

            // Generate insight
            var insight = '';
            if (thisWeekCount === 0 && lastWeekCount > 0) {
                insight = 'No workouts logged this week yet. Last week you hit ' + lastWeekCount + ' session' + (lastWeekCount !== 1 ? 's' : '') + ' \u2014 keep the momentum going!';
            } else if (thisWeekCount > lastWeekCount && lastWeekCount > 0) {
                insight = 'You\'re ahead of last week! ' + thisWeekCount + ' workout' + (thisWeekCount !== 1 ? 's' : '') + ' so far vs ' + lastWeekCount + ' last week. Keep pushing!';
            } else if (thisWeekCount === lastWeekCount && thisWeekCount > 0) {
                insight = 'Matching last week\'s pace with ' + thisWeekCount + ' workout' + (thisWeekCount !== 1 ? 's' : '') + '. Consistency is key!';
            } else if (thisWeekCount > 0 && lastWeekCount === 0) {
                insight = 'Great start! ' + thisWeekCount + ' workout' + (thisWeekCount !== 1 ? 's' : '') + ' this week. You\'re building a solid habit!';
            } else if (thisWeekCount > 0) {
                insight = thisWeekCount + ' workout' + (thisWeekCount !== 1 ? 's' : '') + ' this week. ' + (weekStreak > 1 ? weekStreak + '-week streak \u2014 you\'re on fire!' : 'Keep it up!');
            } else {
                insight = 'Start your week strong \u2014 your ' + totalCount + ' total workout' + (totalCount !== 1 ? 's' : '') + ' show you\'ve got what it takes!';
            }

            return {
                thisWeekCount: thisWeekCount,
                lastWeekCount: lastWeekCount,
                totalCount: totalCount,
                weekStreak: weekStreak,
                insight: insight
            };
        } catch (err) {
            console.error('Error computing workout trend data:', err);
            return null;
        }
    }

    function dismissWorkoutTrendCard() {
        const today = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];
        try {
            localStorage.setItem('workoutTrendCardDismissedDate', today);
        } catch (e) { console.warn('localStorage full', e); }
        
        // Sync to cloud
        window.syncTrendDismissalToDb('workoutTrendCard', today);

        var card = document.getElementById('daily-workout-trend-card');
        if (card) {
            card.style.transition = 'opacity 0.4s, transform 0.4s';
            card.style.opacity = '0';
            card.style.transform = 'translateY(-15px)';
            setTimeout(function() { card.style.display = 'none'; card.style.opacity = '1'; card.style.transform = 'translateY(0)'; }, 400);
        }
    }

    function dismissMovementTrendCard() {
        const today = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];
        try {
            localStorage.setItem('movementTrendCardDismissedDate', today);
        } catch (e) { console.warn('localStorage full', e); }
        
        // Sync to cloud
        window.syncTrendDismissalToDb('movementTrendCard', today);

        var card = document.getElementById('movement-workout-trend-card');
        if (card) {
            card.style.transition = 'opacity 0.4s, transform 0.4s';
            card.style.opacity = '0';
            card.style.transform = 'translateY(-15px)';
            setTimeout(function() { card.style.display = 'none'; card.style.opacity = '1'; card.style.transform = 'translateY(0)'; }, 400);
        }
    }

    window.checkAndShowWorkoutTrendCard = checkAndShowWorkoutTrendCard;
    window.loadMovementTrendCard = loadMovementTrendCard;
    window.dismissWorkoutTrendCard = dismissWorkoutTrendCard;
    window.dismissMovementTrendCard = dismissMovementTrendCard;