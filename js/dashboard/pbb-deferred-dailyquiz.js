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
            if (savedQuizLesson) {
                // Check if the saved lesson was already completed (e.g., via regular learning path)
                if (typeof window._isLessonCompleted === 'function' && window._isLessonCompleted(savedQuizLesson.lesson.id)) {
                    // Lesson was completed outside daily quiz flow — treat daily quiz as done
                    card.style.display = 'none';
                    doneCard.style.display = 'none';
                    return;
                }
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

    // ===========================================================================
    // INLINE HOME LESSON OVERLAY
    //
    // Plays the chosen daily-quiz lesson inline as a fullscreen overlay over the
    // home view (no tab switch). Reuses the existing learning render pipeline by
    // temporarily relocating the `learning-content` element ID onto a host div
    // inside our overlay. The wrapped continueAfterFeedback adds a "wrong answer"
    // path that lets the user retry or read the lesson refresher without losing
    // their score (we roll back gamesPlayed so a perfect retry still scores 100%).
    // ===========================================================================

    function ensureHomeLessonOverlay() {
        var overlay = document.getElementById('home-lesson-overlay');
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.id = 'home-lesson-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:#ffffff;overflow-y:auto;display:none;-webkit-overflow-scrolling:touch;';
        overlay.innerHTML = ''
            + '<button id="home-lesson-close-btn" aria-label="Close lesson" '
            + 'style="position:fixed;top:max(12px,env(safe-area-inset-top));right:12px;z-index:10000;background:rgba(0,0,0,0.55);color:#fff;border:none;width:38px;height:38px;border-radius:50%;font-size:20px;line-height:1;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.25);">&#x2715;</button>'
            + '<div id="home-lesson-content-host"></div>';
        document.body.appendChild(overlay);

        document.getElementById('home-lesson-close-btn').addEventListener('click', function() {
            if (confirm('Exit this lesson? Your progress for this round won\'t be saved.')) {
                closeInlineHomeLesson();
            }
        });

        return overlay;
    }

    function activateHomeLessonHost() {
        var host = document.getElementById('home-lesson-content-host');
        if (!host) return null;
        var realContent = document.getElementById('learning-content');
        if (realContent && realContent !== host) {
            realContent.id = '__learning-content-stash';
        }
        host.id = 'learning-content';
        host.dataset.homeHost = '1';
        return host;
    }

    function deactivateHomeLessonHost() {
        var host = document.getElementById('learning-content');
        if (host && host.dataset.homeHost === '1') {
            host.id = 'home-lesson-content-host';
            host.innerHTML = '';
        }
        var stash = document.getElementById('__learning-content-stash');
        if (stash) stash.id = 'learning-content';
    }

    function closeInlineHomeLesson() {
        var overlay = document.getElementById('home-lesson-overlay');
        if (overlay) overlay.style.display = 'none';
        deactivateHomeLessonHost();
        window._homeLessonActive = false;
        // Hide the learning mascot if it's still visible
        if (window.LearningMascot && typeof window.LearningMascot.hide === 'function') {
            try { window.LearningMascot.hide(); } catch(e) {}
        }
        // Refresh the daily quiz card so the done state shows immediately
        if (typeof window.checkAndShowDailyQuizCard === 'function') {
            try { window.checkAndShowDailyQuizCard(); } catch(e) {}
        }
    }
    window.closeInlineHomeLesson = closeInlineHomeLesson;

    function startInlineHomeLesson(lessonId) {
        // Wait for the learning system to be ready
        if (typeof window.startDailyQuiz !== 'function' || window._learningInitInProgress) {
            var attempts = 0;
            var waiter = setInterval(function() {
                attempts++;
                if (typeof window.startDailyQuiz === 'function' && !window._learningInitInProgress) {
                    clearInterval(waiter);
                    startInlineHomeLesson(lessonId);
                } else if (attempts > 25) {
                    clearInterval(waiter);
                    // Fallback: if learning still not loaded, switch to learning tab
                    if (typeof switchAppTab === 'function') {
                        var learningNav = document.querySelectorAll('.nav-item')[3];
                        switchAppTab('learning', learningNav);
                        if (typeof window.startDailyQuiz === 'function') window.startDailyQuiz(lessonId);
                    }
                }
            }, 200);
            return;
        }

        var overlay = ensureHomeLessonOverlay();
        activateHomeLessonHost();
        window._homeLessonActive = true;
        overlay.style.display = 'block';
        overlay.scrollTop = 0;
        installHomeLessonHooks();
        window.startDailyQuiz(lessonId);
    }
    window.startInlineHomeLesson = startInlineHomeLesson;

    // --- Wrong-answer + completion hooks (installed once, no-op when inactive) ---

    function showHomeLessonWrongOptions() {
        var ls = window._learningState;
        if (!ls || !ls.currentLesson) return;
        var lesson = ls.currentLesson;
        var game = (lesson.games || [])[ls.currentGameIndex] || {};
        var explanation = game.explanation || lesson.content && lesson.content.keyPoint || '';

        var host = document.getElementById('learning-content');
        if (!host) return;

        var panel = document.createElement('div');
        panel.id = 'home-lesson-wrong-panel';
        panel.style.cssText = 'position:fixed;left:0;right:0;bottom:0;background:#ffffff;border-top:3px solid #ef4444;border-radius:24px 24px 0 0;padding:24px 20px max(28px,env(safe-area-inset-bottom));box-shadow:0 -10px 40px rgba(0,0,0,0.18);z-index:99998;animation:slideUpHL 0.3s ease;';
        panel.innerHTML = ''
            + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">'
            + '  <div style="width:36px;height:36px;background:#fee2e2;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.1rem;">&#x1F914;</div>'
            + '  <div style="font-weight:700;color:#1f2937;font-size:1.05rem;">Not quite — that\'s okay!</div>'
            + '</div>'
            + (explanation ? '<div style="background:#f9fafb;border-radius:12px;padding:14px 16px;margin-bottom:16px;font-size:0.92rem;color:#374151;line-height:1.5;">' + explanation + '</div>' : '')
            + '<div style="display:flex;gap:10px;">'
            + '  <button id="home-lesson-retry-btn" style="flex:1;background:#10b981;color:#fff;border:none;padding:14px;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;">Try again</button>'
            + '  <button id="home-lesson-learn-btn" style="flex:1;background:#6366f1;color:#fff;border:none;padding:14px;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;">Learn this</button>'
            + '</div>';

        // Add slide-up keyframe once
        if (!document.getElementById('home-lesson-keyframes')) {
            var styleEl = document.createElement('style');
            styleEl.id = 'home-lesson-keyframes';
            styleEl.textContent = '@keyframes slideUpHL{from{transform:translateY(100%);}to{transform:translateY(0);}}';
            document.head.appendChild(styleEl);
        }

        // Remove any prior panel
        var existing = document.getElementById('home-lesson-wrong-panel');
        if (existing) existing.remove();
        document.body.appendChild(panel);

        document.getElementById('home-lesson-retry-btn').onclick = function() {
            panel.remove();
            // Re-render the same question (currentGameIndex was not advanced)
            if (typeof window.renderCurrentGameAgain === 'function') {
                window.renderCurrentGameAgain();
            } else if (window._learningState && window._learningState.currentLesson) {
                // Fallback: nudge index forward then back to force a re-render via continue
                // Actually safest path: re-trigger startDailyQuiz preserves state poorly, so use direct.
                var evt = new Event('home-lesson-rerender');
                document.dispatchEvent(evt);
                // As a robust fallback, just call startDailyQuiz to restart the lesson
                if (typeof window.startDailyQuiz === 'function') {
                    window.startDailyQuiz(window._learningState.currentLesson.id);
                }
            }
        };
        document.getElementById('home-lesson-learn-btn').onclick = function() {
            panel.remove();
            // Restart the lesson with the story-reveal intro slides
            if (window._learningState && window._learningState.currentLesson && typeof window.startDailyQuiz === 'function') {
                window.startDailyQuiz(window._learningState.currentLesson.id);
            }
        };
    }

    function installHomeLessonHooks() {
        // Wrap continueAfterFeedback once to intercept wrong answers
        if (typeof window.continueAfterFeedback === 'function' && !window.continueAfterFeedback._homeWrapped) {
            var origContinue = window.continueAfterFeedback;
            var wrappedContinue = function() {
                if (window._homeLessonActive) {
                    var overlay = document.getElementById('game-feedback-overlay');
                    var wasWrong = false;
                    if (overlay) {
                        // The overlay's gradient contains #ef4444 for wrong answers
                        var bg = overlay.style.background || '';
                        var html = overlay.innerHTML || '';
                        if (bg.indexOf('#ef4444') !== -1 || bg.indexOf('239, 68, 68') !== -1 || html.indexOf('#ef4444') !== -1) {
                            wasWrong = true;
                        }
                    }
                    if (wasWrong) {
                        // Dismiss the feedback overlay without advancing
                        if (overlay) {
                            overlay.style.transform = 'translateY(100%)';
                            setTimeout(function(){ if (overlay && overlay.parentNode) overlay.remove(); }, 300);
                        }
                        // Roll back the wrong attempt so a perfect retry still scores 100%
                        var ls = window._learningState;
                        if (ls && ls.gamesPlayed > 0) ls.gamesPlayed--;
                        showHomeLessonWrongOptions();
                        return;
                    }
                }
                return origContinue.apply(this, arguments);
            };
            wrappedContinue._homeWrapped = true;
            window.continueAfterFeedback = wrappedContinue;
        }

        // Wrap openLearningUnit so the "Continue Learning" button on the
        // lesson-complete screen closes the inline overlay instead of switching tabs.
        if (typeof window.openLearningUnit === 'function' && !window.openLearningUnit._homeWrapped) {
            var origOpenUnit = window.openLearningUnit;
            var wrappedOpenUnit = function() {
                if (window._homeLessonActive) {
                    closeInlineHomeLesson();
                    return;
                }
                return origOpenUnit.apply(this, arguments);
            };
            wrappedOpenUnit._homeWrapped = true;
            window.openLearningUnit = wrappedOpenUnit;
        }

        // Helper: re-render the current game (used by the "Try again" button)
        window.renderCurrentGameAgain = function() {
            // The simplest reliable way is to nudge the learning system to re-render
            // the current question. continueAfterFeedback advances + renders, so we
            // temporarily decrement currentGameIndex and call the original continue.
            var ls = window._learningState;
            if (!ls || !ls.currentLesson) return;
            // Find original continueAfterFeedback (un-wrapped) by walking the chain
            var fn = window.continueAfterFeedback;
            // Build a minimal "advance and render" by mutating index then calling render
            // through a temporary fake-continue path: decrement so the next ++ lands us
            // on the same question.
            ls.currentGameIndex = Math.max(0, ls.currentGameIndex);
            // Easiest: directly invoke a re-render by calling continueAfterFeedback with
            // a pre-decrement so the internal ++ lands us back on the same index.
            ls.currentGameIndex--;
            // Temporarily mark inactive so the wrap doesn't intercept
            var wasActive = window._homeLessonActive;
            window._homeLessonActive = false;
            try { fn(); } catch(e) {}
            window._homeLessonActive = wasActive;
        };
    }

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