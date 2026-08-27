(function () {
    'use strict';

    const TEST_USER_IDS = new Set([
        'cc632168-874c-447e-a4ad-ee7f6b40bb7e'
    ]);

    function isTester() {
        const host = String(window.location.hostname || '').toLowerCase();
        const userId = window.currentUser && window.currentUser.id;
        const explicitlyRequested = new URLSearchParams(window.location.search).get('testFlow') === '1';
        return explicitlyRequested && (host === 'localhost' || host === '127.0.0.1' || TEST_USER_IDS.has(userId));
    }

    function visible(element) {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    }

    function clickByText(labels) {
        const wanted = labels.map(function (label) { return label.toLowerCase(); });
        const elements = Array.from(document.querySelectorAll('button, a, [role="button"], [onclick], .card'));
        const match = elements.find(function (element) {
            if (element.closest('#pbb-test-flow-navigator')) return false;
            const text = String(element.textContent || '').trim().toLowerCase();
            return visible(element) && wanted.some(function (label) { return text.includes(label); });
        });
        if (!match) return false;
        match.click();
        return true;
    }

    function callFirst(names, args) {
        for (let index = 0; index < names.length; index += 1) {
            const fn = window[names[index]];
            if (typeof fn === 'function') {
                fn.apply(window, args || []);
                return true;
            }
        }
        return false;
    }

    function closeBlockingSetup() {
        window.__pbbTransferredSetupPending = false;
        ['onboarding-wizard', 'wizard-workout-dropdown-overlay'].forEach(function (id) {
            const element = document.getElementById(id);
            if (element) {
                element.classList.remove('active');
                element.style.display = 'none';
            }
        });
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
    }

    function notify(message) {
        if (typeof window.showToast === 'function') {
            window.showToast(message, 'info');
            return;
        }
        const status = document.getElementById('pbb-test-flow-status');
        if (status) status.textContent = message;
    }

    function resetJourneyForFreshRun(attempt) {
        const retry = Math.max(0, Number(attempt) || 0);
        if (window.socialJourney && typeof window.socialJourney.resetActivationForTest === 'function') {
            return window.socialJourney.resetActivationForTest();
        }
        if (retry < 40) {
            window.setTimeout(function () { resetJourneyForFreshRun(retry + 1); }, 150);
        }
        return false;
    }

    function restartOnboarding() {
        closeBlockingSetup();
        localStorage.removeItem('featureTourComplete');
        localStorage.setItem('userThemePreference', 'light');
        if (typeof window.applyAppTheme === 'function') window.applyAppTheme('light');
        resetJourneyForFreshRun(0);
        if (typeof window.startTransferredClientFlow === 'function') {
            window.startTransferredClientFlow();
            notify('Restarting the tailored onboarding flow');
        } else {
            notify('Onboarding is still loading. Try again in a moment.');
        }
    }

    function jumpToAppTour() {
        closeBlockingSetup();
        localStorage.removeItem('featureTourComplete');
        resetJourneyForFreshRun(0);
        if (clickByText(['test: jump to app tour'])) return;
        if (callFirst(['startGuidedFeatureTour', 'startFeatureTour', 'launchFeatureTour', 'runFeatureTour'])) return;
        notify('The app tour trigger is not ready on this screen yet.');
    }

    function jumpToInbox() {
        closeBlockingSetup();
        if (window.socialJourney && typeof window.socialJourney.openCoachInbox === 'function') {
            window.socialJourney.openCoachInbox();
            return;
        }
        if (callFirst(['openCoachInbox', 'openDirectMessages', 'openMessagesView'])) return;
        if (clickByText(['inbox', 'messages'])) {
            window.setTimeout(function () { clickByText(['coach shannon']); }, 350);
            return;
        }
        const messageButton = document.querySelector('[aria-label*="message" i], [title*="message" i], .messages-button, .inbox-button');
        if (messageButton) {
            messageButton.click();
            window.setTimeout(function () { clickByText(['coach shannon']); }, 350);
            return;
        }
        notify('The inbox control is not ready on this screen yet.');
    }

    function jumpToFirstLesson() {
        closeBlockingSetup();
        if (window.socialJourney && typeof window.socialJourney.startFirstCourseLesson === 'function') {
            window.socialJourney.startFirstCourseLesson();
            return;
        }
        if (!callFirst(['showSection', 'switchSection'], ['course'])) {
            clickByText(['course']);
        }
        window.setTimeout(function () {
            if (!clickByText(['build a rhythm that can stick'])) {
                clickByText(['balance foundations']);
                window.setTimeout(function () { clickByText(['build a rhythm that can stick']); }, 350);
            }
        }, 350);
    }

    function jumpToNextSteps() {
        closeBlockingSetup();
        if (window.socialJourney && typeof window.socialJourney.previewGoalsForTest === 'function') {
            if (window.socialJourney.previewGoalsForTest()) return;
        }
        if (callFirst(['openSocialJourney', 'showSocialJourney', 'openFirstActions', 'showFirstActions'])) return;
        if (clickByText(['your next steps', 'make the first reps visible', 'start today\'s first step'])) return;
        if (!callFirst(['showSection', 'switchSection'], ['home'])) clickByText(['home']);
        window.setTimeout(function () {
            if (!clickByText(['your next steps', 'make the first reps visible'])) {
                notify('The next-steps card is not ready on this screen yet.');
            }
        }, 350);
    }

    function createNavigator() {
        if (!isTester() || document.getElementById('pbb-test-flow-navigator')) return;

        const shell = document.createElement('div');
        shell.id = 'pbb-test-flow-navigator';
        shell.innerHTML = [
            '<button type="button" class="pbb-test-flow-toggle" aria-expanded="false">TEST FLOW</button>',
            '<div class="pbb-test-flow-menu" hidden>',
            '<div class="pbb-test-flow-title">Jump through onboarding</div>',
            '<div class="pbb-test-flow-copy">Testing only. This does not complete client actions.</div>',
            '<button type="button" data-action="restart">Restart onboarding</button>',
            '<button type="button" data-action="tour">App tour</button>',
            '<button type="button" data-action="inbox">Coach inbox</button>',
            '<button type="button" data-action="lesson">First lesson</button>',
            '<button type="button" data-action="steps">Final next steps</button>',
            '<div id="pbb-test-flow-status" aria-live="polite"></div>',
            '</div>'
        ].join('');

        const style = document.createElement('style');
        style.textContent = [
            '#pbb-test-flow-navigator{position:fixed;left:12px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:2147483646;font-family:Montserrat,sans-serif;color:#17191f;-webkit-text-fill-color:#17191f}',
            '.pbb-test-flow-toggle{border:1px solid #d4af37;border-radius:999px;background:#17191f;color:#fff7df;-webkit-text-fill-color:#fff7df;padding:10px 14px;font-weight:900;letter-spacing:.08em;box-shadow:0 10px 28px rgba(0,0,0,.22)}',
            '.pbb-test-flow-menu{position:absolute;left:0;bottom:50px;width:min(290px,calc(100vw - 24px));padding:16px;border:1px solid #d8bd72;border-radius:18px;background:#fffaf0;box-shadow:0 18px 48px rgba(37,29,13,.28)}',
            '.pbb-test-flow-title{font:900 17px/1.2 Georgia,serif;margin-bottom:4px}',
            '.pbb-test-flow-copy{font-size:11px;line-height:1.4;color:#6b6252;-webkit-text-fill-color:#6b6252;margin-bottom:12px}',
            '.pbb-test-flow-menu button{display:block;width:100%;margin:7px 0;padding:11px 12px;border:1px solid #dccb9f;border-radius:11px;background:#fff;color:#191b22;-webkit-text-fill-color:#191b22;text-align:left;font-weight:800}',
            '.pbb-test-flow-menu button[data-action="steps"]{background:#d8b34f;border-color:#b78d27}',
            '#pbb-test-flow-status{min-height:16px;margin-top:8px;font-size:11px;color:#725a24;-webkit-text-fill-color:#725a24}'
        ].join('');
        document.head.appendChild(style);
        document.body.appendChild(shell);

        const toggle = shell.querySelector('.pbb-test-flow-toggle');
        const menu = shell.querySelector('.pbb-test-flow-menu');
        toggle.addEventListener('click', function () {
            menu.hidden = !menu.hidden;
            toggle.setAttribute('aria-expanded', String(!menu.hidden));
        });

        const actions = {
            restart: restartOnboarding,
            tour: jumpToAppTour,
            inbox: jumpToInbox,
            lesson: jumpToFirstLesson,
            steps: jumpToNextSteps
        };
        shell.addEventListener('click', function (event) {
            const button = event.target.closest('[data-action]');
            if (!button) return;
            const action = actions[button.dataset.action];
            if (action) action();
        });
    }

    let attempts = 0;
    const timer = window.setInterval(function () {
        attempts += 1;
        if (isTester()) {
            window.clearInterval(timer);
            document.documentElement.classList.add('pbb-onboarding-phone-test');
            const oldNavigator = document.getElementById('pbb-test-flow-navigator');
            if (oldNavigator) oldNavigator.remove();
        } else if (attempts > 80) {
            window.clearInterval(timer);
        }
    }, 250);
})();
