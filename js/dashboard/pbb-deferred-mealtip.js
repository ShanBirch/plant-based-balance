// ===== DAILY MEAL TIP CARD LOGIC =====

    // Global tracking for dismissed dates (synced from DB)
    window._pbbDismissedDates = window._pbbDismissedDates || {};

    /**
     * Centralized dismissal sync to DB
     */
    window.syncTrendDismissalToDb = async function(key, date) {
        if (!window.currentUser) return;
        try {
            const userId = window.currentUser.id || window.currentUser.user_id;
            const facts = await dbHelpers.userFacts.get(userId);
            const additional = facts?.additional_data || {};
            const dismissed = additional.dismissed_dates || {};
            dismissed[key] = date;
            
            // Update local cache too
            window._pbbDismissedDates = dismissed;
            
            await dbHelpers.userFacts.upsert(userId, {
                additional_data: {
                    ...additional,
                    dismissed_dates: dismissed
                }
            });
            console.log('✅ Dismissed date synced to DB:', key, date);
        } catch (e) {
            console.warn('Failed to sync dismissal to DB:', e);
        }
    };

    /**
     * Check and show the daily meal tip card with the most recent meal pattern insight.
     * Shows one insight per day, dismissible. Reappears next day with a new insight.
     */
    async function checkAndShowMealTipCard() {
        if (!window.currentUser) return;
        if (window._onboardingWizardPending) return;
        const wizard = document.getElementById('onboarding-wizard');
        if (wizard && wizard.style.display !== 'none') return;

        const card = document.getElementById('daily-meal-tip-card');
        if (!card) return;

        // Check if dismissed today (Check BOTH localStorage and cloud-synced state)
        const today = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];
        
        const isDismissedLocal = localStorage.getItem('mealTipCardDismissedDate') === today;
        const isDismissedCloud = (window._pbbDismissedDates && window._pbbDismissedDates['mealTipCard']) === today;
        
        if (isDismissedLocal || isDismissedCloud) {
            card.style.display = 'none';
            // Sync local if cloud is ahead
            if (isDismissedCloud && !isDismissedLocal) {
                try { localStorage.setItem('mealTipCardDismissedDate', today); } catch(e) {}
            }
            return;
        }

        try {
            const session = await window.authHelpers?.getSession();
            if (!session?.user) { card.style.display = 'none'; return; }

            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

            const { data: meals, error } = await window.supabaseClient
                .from('meal_logs')
                .select('meal_date, meal_time, meal_type, calories, protein_g, carbs_g, fat_g, fiber_g, micronutrients')
                .eq('user_id', window.currentUser.id)
                .gte('meal_date', today.substring(0, 4) + '-' + today.substring(5, 7) + '-' + today.substring(8, 10)) // Use today's local date
                .order('meal_date', { ascending: true });

            // Actually, we want the last 7 days of logic for "trends"
            const realSevenDaysAgo = new Date();
            realSevenDaysAgo.setDate(realSevenDaysAgo.getDate() - 7);
            const dateStr = realSevenDaysAgo.getFullYear() + '-' + String(realSevenDaysAgo.getMonth()+1).padStart(2,'0') + '-' + String(realSevenDaysAgo.getDate()).padStart(2,'0');

            const { data: trendMeals } = await window.supabaseClient
                .from('meal_logs')
                .select('*')
                .eq('user_id', window.currentUser.id)
                .gte('meal_date', dateStr);

            if (!trendMeals || trendMeals.length < 3) {
                card.style.display = 'none';
                return;
            }

            const insights = _analyzeMealPatterns(trendMeals);
            if (!insights || insights.length === 0) {
                card.style.display = 'none';
                return;
            }

            // Pick one insight for today (rotate by day-of-year so it changes daily)
            var d = new Date();
            var dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
            var insightIndex = dayOfYear % insights.length;
            var tip = insights[insightIndex];

            const textEl = document.getElementById('daily-meal-tip-text');
            if (textEl) {
                textEl.innerHTML = tip.icon + ' ' + tip.text;
            }
            card.style.display = 'block';

        } catch (err) {
            console.error('Error in checkAndShowMealTipCard:', err);
            card.style.display = 'none';
        }

        function _analyzeMealPatterns(meals) {
            var insights = [];
            
            // 1. Protein consistency
            var dayMap = {};
            meals.forEach(m => {
                var d = m.meal_date;
                dayMap[d] = (dayMap[d] || 0) + (m.protein_g || 0);
            });
            var highProteinDays = Object.values(dayMap).filter(p => p > 50).length;
            if (highProteinDays >= 3) {
                insights.push({
                    icon: '💪',
                    text: '<strong>Protein Focus:</strong> You hit your protein baseline ' + highProteinDays + ' times this week. Your muscles are thanking you!'
                });
            }

            // 2. Early vs Late eating
            var lateMeals = meals.filter(m => {
                var hour = parseInt((m.meal_time || '00:00').split(':')[0]);
                return hour >= 20;
            }).length;
            if (lateMeals >= 3) {
                insights.push({
                    icon: '🌙',
                    text: '<strong>Night Owl:</strong> You tend to eat late. Try to finish your last meal 2-3 hours before bed for better cortisol recovery.'
                });
            }

            // 3. Variety
            var types = [...new Set(meals.map(m => m.meal_type))];
            if (types.length >= 4) {
                insights.push({
                    icon: '🌈',
                    text: '<strong>Diversity Win:</strong> You\'re logging a great variety of meal types. This helps ensure a broad micronutrient profile!'
                });
            }

            // 4. Fiber
            var avgFiber = meals.reduce((s, m) => s + (m.fiber_g || 0), 0) / (Object.keys(dayMap).length || 1);
            if (avgFiber > 25) {
                insights.push({
                    icon: '🌿',
                    text: '<strong>Fiber King:</strong> Your daily fiber average is ' + Math.round(avgFiber) + 'g. Exceptional work for gut health and satiety!'
                });
            }

            // 5. Default
            if (insights.length === 0) {
                insights.push({
                    icon: '🥗',
                    text: 'Consistency is your superpower. You\'ve logged ' + meals.length + ' meals this week \u2014 keep tracking to see deeper trends!'
                });
            }

            return insights;
        }
    }

    function dismissMealTipCard() {
        const today = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];
        try {
            localStorage.setItem('mealTipCardDismissedDate', today);
        } catch (e) { console.warn('localStorage full', e); }
        
        // Sync to cloud
        window.syncTrendDismissalToDb('mealTipCard', today);

        var card = document.getElementById('daily-meal-tip-card');
        if (card) {
            card.style.transition = 'opacity 0.4s, transform 0.4s';
            card.style.opacity = '0';
            card.style.transform = 'translateY(-15px)';
            setTimeout(function() { card.style.display = 'none'; card.style.opacity = '1'; card.style.transform = 'translateY(0)'; }, 400);
        }
    }

    window.checkAndShowMealTipCard = checkAndShowMealTipCard;
    window.dismissMealTipCard = dismissMealTipCard;