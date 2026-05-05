// ===== DAILY QUIZ CARD LOGIC =====

    function normalizeDailyQuizWidgetGame(game, lessonHint) {
        if (!game || !game.type) return null;

        function withHint(item) {
            if (!item) return null;
            var hint = game.explanation || lessonHint || '';
            if (hint) item.explanation = String(hint);
            return item;
        }

        function withCorrectOption(question, rawOptions, correctValue) {
            var options = (rawOptions || []).map(function(opt) { return String(opt || ''); }).filter(Boolean);
            if (!options.length) return null;
            var answerIndex = options.indexOf(String(correctValue || ''));
            if (answerIndex < 0) return null;
            if (answerIndex >= 4) {
                options = options.slice(0, 3).concat([String(correctValue)]);
                answerIndex = 3;
            } else {
                options = options.slice(0, 4);
            }
            return withHint({ question: question, options: options, answerIndex: answerIndex });
        }

        if (game.type === 'swipe_true_false') {
            return withHint({
                question: game.question || 'True or false?',
                options: ['True', 'False'],
                answerIndex: game.answer ? 0 : 1
            });
        }

        if (game.type === 'fill_blank') {
            return withCorrectOption(game.sentence || game.question || 'Fill the blank.', game.options || [], game.answer);
        }

        if (game.type === 'scenario_story') {
            var scenarioOptions = (game.options || []).map(function(opt) { return opt && opt.text; });
            var correctScenario = (game.options || []).find(function(opt) { return opt && opt.correct; });
            var scenarioQuestion = [game.scenario, game.question].filter(Boolean).join(' ');
            return correctScenario ? withCorrectOption(scenarioQuestion, scenarioOptions, correctScenario.text) : null;
        }

        if (game.type === 'tap_all') {
            var tapOptions = game.options || [];
            var correctTap = tapOptions.find(function(opt) { return opt && opt.correct; });
            if (!correctTap) return null;
            return withCorrectOption(
                'Pick one correct answer: ' + (game.question || ''),
                tapOptions.map(function(opt) { return opt && opt.text; }),
                correctTap.text
            );
        }

        if (game.type === 'match_pairs') {
            var pairs = game.pairs || [];
            if (!pairs.length || !pairs[0] || !pairs[0].right) return null;
            return withCorrectOption(
                'Match: ' + (pairs[0].left || ''),
                pairs.map(function(pair) { return pair && pair.right; }),
                pairs[0].right
            );
        }

        if (game.type === 'order_sequence') {
            var items = game.items || [];
            if (!items.length) return null;
            return withCorrectOption(
                'What comes first? ' + (game.question || ''),
                items,
                items[0]
            );
        }

        return null;
    }

    function syncDailyQuizWidgetSnapshot(todayStr, lesson, unit, module) {
        try {
            var games = (lesson && lesson.games) ? lesson.games : [];
            var lessonHint = lesson && lesson.content && lesson.content.keyPoint ? lesson.content.keyPoint : '';
            var questions = games
                .map(function(game) { return normalizeDailyQuizWidgetGame(game, lessonHint); })
                .filter(Boolean)
                .slice(0, 8);
            if (!questions.length) return;

            var snapshot = {
                date: todayStr,
                lessonId: lesson.id,
                lessonTitle: lesson.title || 'Daily Quiz',
                moduleTitle: module && module.title ? module.title : '',
                unitTitle: unit && unit.title ? unit.title : '',
                lessonHint: lessonHint,
                questions: questions
            };
            var payload = JSON.stringify(snapshot);

            if (window.NativePermissions && typeof window.NativePermissions.setDailyQuizWidgetData === 'function') {
                window.NativePermissions.setDailyQuizWidgetData(payload);
            }

            var cap = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BalanceNutritionWidget;
            if (cap && typeof cap.saveDailyQuizSnapshot === 'function') {
                cap.saveDailyQuizSnapshot({ json: payload }).catch(function(err) {
                    console.warn('Daily quiz widget snapshot failed:', err);
                });
            }
        } catch (e) {
            console.warn('Could not sync daily quiz widget snapshot:', e);
        }
    }

    function getDailyQuizTodayString() {
        var d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function syncAvailableDailyQuizWidgetSnapshot(todayStr) {
        var pickLesson = window._getNextAvailableLesson || window._getRandomAvailableLesson;
        if (typeof pickLesson !== 'function') return false;
        var nextLesson = pickLesson();
        if (!nextLesson || !nextLesson.lesson) return false;
        syncDailyQuizWidgetSnapshot(todayStr, nextLesson.lesson, nextLesson.unit, nextLesson.module);
        return true;
    }

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
                const today = getDailyQuizTodayString();
                syncAvailableDailyQuizWidgetSnapshot(today);
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
            var todayStr = getDailyQuizTodayString();
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
            syncDailyQuizWidgetSnapshot(todayStr, lesson, unit, module);

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
