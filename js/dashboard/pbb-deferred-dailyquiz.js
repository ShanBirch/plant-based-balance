// ===== DAILY QUIZ CARD LOGIC =====

    /**
     * Check if user has completed their daily quiz and show/hide card accordingly.
     * Uses learning system state exposed via window functions.
     */
    async function checkAndShowDailyQuizCard() {
        if (!window.currentUser) return;

        // Don't show if onboarding wizard is active
        if (window._onboardingWizardPending) return;
        const wizard = document.getElementById('onboarding-wizard');
        if (wizard && wizard.style.display !== 'none') return;

        const card = document.getElementById('daily-quiz-card');
        const doneCard = document.getElementById('daily-quiz-done-card');
        if (!card || !doneCard) return;

        try {
            // Ensure learning progress is loaded before checking
            if (typeof window._ensureLearningProgressLoaded === 'function') {
                await window._ensureLearningProgressLoaded();
            }

            // Check if daily quiz already completed today (uses learning-inline.js exposed fn)
            if (typeof window._isDailyQuizCompletedToday === 'function' && window._isDailyQuizCompletedToday()) {
                card.style.display = 'none';
                const today = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];
                const isDismissedLocal = localStorage.getItem('quizDoneCardDismissedDate') === today;
                const isDismissedCloud = (window._pbbDismissedDates && window._pbbDismissedDates['quizDoneCard']) === today;
                
                if (isDismissedLocal || isDismissedCloud) {
                    doneCard.style.display = 'none';
                    if (isDismissedCloud && !isDismissedLocal) {
                        try { localStorage.setItem('quizDoneCardDismissedDate', today); } catch(e) {}
                    }
                } else {
                    doneCard.style.display = 'flex';
                }
                return;
            }

            // Find the next available lesson in curriculum order (progression)
            // Falls back to random if next-available helper isn't loaded yet.
            var pickLesson = window._getNextAvailableLesson || window._getRandomAvailableLesson;
            if (typeof pickLesson !== 'function') {
                card.style.display = 'none';
                doneCard.style.display = 'none';
                return;
            }

            // Check if we already picked a daily quiz lesson for today
            var d2 = new Date();
            var todayStr = d2.getFullYear() + '-' + String(d2.getMonth()+1).padStart(2,'0') + '-' + String(d2.getDate()).padStart(2,'0');
            var savedQuizLesson = null;
            try {
                var saved = JSON.parse(localStorage.getItem('dailyQuizLessonToday') || 'null');
                if (saved && saved.date === todayStr && saved.lessonId) {
                    // Use the saved lesson if it hasn't been completed yet
                    if (typeof window._getLessonById === 'function') {
                        var savedLesson = window._getLessonById(saved.lessonId);
                        if (savedLesson) {
                            savedQuizLesson = savedLesson;
                        }
                    }
                }
            } catch (e) { /* ignore parse errors */ }

            var lesson, unit, module;
            // Use the saved lesson only if it's still uncompleted. If the user
            // finished it via the regular learning path (or it's otherwise
            // stale in localStorage), fall through and pick a fresh one so
            // the daily quiz card never shows a lesson the user already did.
            if (savedQuizLesson && typeof window._isLessonCompleted === 'function' && window._isLessonCompleted(savedQuizLesson.lesson.id)) {
                savedQuizLesson = null;
                try { localStorage.removeItem('dailyQuizLessonToday'); } catch (e) {}
            }
            if (savedQuizLesson) {
                lesson = savedQuizLesson.lesson;
                unit = savedQuizLesson.unit;
                module = savedQuizLesson.module;
            } else {
                const nextLesson = pickLesson();
                if (!nextLesson) {
                    // All lessons completed
                    card.style.display = 'none';
                    doneCard.style.display = 'none';
                    return;
                }
                lesson = nextLesson.lesson;
                unit = nextLesson.unit;
                module = nextLesson.module;
                // Save today's daily quiz lesson so it stays consistent
                localStorage.setItem('dailyQuizLessonToday', JSON.stringify({ date: todayStr, lessonId: lesson.id }));
            }

            const moduleEmojis = { body: '💪', fuel: '🥗', mind: '🧠', longevity: '⏳', workouts: '🏋️', hormones: '🧪' };

            // Populate card content
            document.getElementById('daily-quiz-icon').textContent = moduleEmojis[module.id] || '📚';
            document.getElementById('daily-quiz-lesson-title').textContent = lesson.title;
            document.getElementById('daily-quiz-lesson-context').textContent = module.title + ' \u2022 ' + unit.title;

            card.onclick = function() {
                window.startInlineHomeLesson(lesson.id);
            };

            card.style.display = 'block';
            doneCard.style.display = 'none';

        } catch (error) {
            console.error('Error checking daily quiz status:', error);
        }
    }

    window.checkAndShowDailyQuizCard = checkAndShowDailyQuizCard;

    function dismissQuizDoneCard() {
        const today = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];
        try {
            localStorage.setItem('quizDoneCardDismissedDate', today);
        } catch (e) { console.warn('localStorage full', e); }
        
        // Sync to cloud
        if (typeof window.syncTrendDismissalToDb === 'function') {
            window.syncTrendDismissalToDb('quizDoneCard', today);
        }

        var el = document.getElementById('daily-quiz-done-card');
        if (el) el.style.display = 'none';
    }
    window.dismissQuizDoneCard = dismissQuizDoneCard;

    // The card-quiz engine (window.startInlineHomeLesson) lives in
    // js/dashboard/pbb-home-card-quiz.js — it plays the lesson directly on
    // the daily-quiz-card with a magical card-wipe between questions.

    /**
     * Called after daily quiz is completed to update dashboard card
     */
    window.refreshDailyQuizCard = function() {
        const card = document.getElementById('daily-quiz-card');
        const doneCard = document.getElementById('daily-quiz-done-card');
        if (card) {
            card.style.transition = 'opacity 0.5s, transform 0.5s';
            card.style.opacity = '0';
            card.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                card.style.display = 'none';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
                if (doneCard) doneCard.style.display = 'flex';
            }, 500);
        }
    };