(function (root) {
    'use strict';

    const SHANNON_PRIMARY_USER_ID = '00a6605e-8edb-4917-85ba-24a23f179059';
    const STORAGE_KEY = 'pbb_workout_player_view_v1';

    function normalizeMode(value) {
        return value === 'list' ? 'list' : 'swipe';
    }

    function isTester(user) {
        return !!user && String(user.id || '').toLowerCase() === SHANNON_PRIMARY_USER_ID;
    }

    function clampIndex(index, count) {
        if (!Number.isFinite(index) || count <= 0) return 0;
        return Math.min(Math.max(Math.trunc(index), 0), count - 1);
    }

    const exported = {
        SHANNON_PRIMARY_USER_ID,
        normalizeMode,
        isTester,
        clampIndex
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = exported;
    }

    if (!root || !root.document) return;

    const document = root.document;
    let currentIndex = 0;
    let currentWorkoutKey = null;
    let touchStart = null;
    let syncQueued = false;

    function getView() {
        return document.getElementById('view-active-workout');
    }

    function getContainer() {
        return document.getElementById('workout-exercises-list');
    }

    function getCards() {
        const container = getContainer();
        return container ? Array.from(container.querySelectorAll(':scope > .exercise-logger-card')) : [];
    }

    function readMode() {
        try {
            return normalizeMode(root.localStorage.getItem(STORAGE_KEY));
        } catch (error) {
            return 'swipe';
        }
    }

    function writeMode(mode) {
        try {
            root.localStorage.setItem(STORAGE_KEY, normalizeMode(mode));
        } catch (error) {
            // The player still works when storage is unavailable.
        }
    }

    function addStyles() {
        if (document.getElementById('pbb-workout-swipe-player-styles')) return;
        const style = document.createElement('style');
        style.id = 'pbb-workout-swipe-player-styles';
        style.textContent = `
            #view-active-workout {
                --workout-swipe-surface: #ffffff;
                --workout-swipe-soft: #f7f3e9;
                --workout-swipe-border: #e7dcc2;
                --workout-swipe-text: #171717;
                --workout-swipe-muted: #665f53;
                --workout-swipe-accent: #a8791f;
            }
            #workout-player-experiment-controls,
            #workout-swipe-actions,
            #workout-swipe-pager { display: none; }
            #view-active-workout.workout-player-tester #workout-player-experiment-controls {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                margin: 4px 0 16px;
                padding: 8px 9px 8px 12px;
                border: 1px solid var(--workout-swipe-border);
                border-radius: 14px;
                background: var(--workout-swipe-surface);
                color: var(--workout-swipe-text);
                -webkit-text-fill-color: var(--workout-swipe-text);
                box-shadow: 0 5px 18px rgba(15,23,42,.05);
            }
            .workout-player-experiment-label {
                font-size: .74rem;
                font-weight: 850;
                letter-spacing: .02em;
            }
            .workout-player-mode-switch {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 3px;
                min-width: 148px;
                padding: 3px;
                border-radius: 11px;
                background: var(--workout-swipe-soft);
            }
            .workout-player-mode-switch button {
                min-height: 38px;
                padding: 7px 13px;
                border: 0;
                border-radius: 8px;
                background: transparent;
                color: var(--workout-swipe-muted);
                -webkit-text-fill-color: var(--workout-swipe-muted);
                font: inherit;
                font-size: .76rem;
                font-weight: 850;
                cursor: pointer;
            }
            .workout-player-mode-switch button[aria-pressed="true"] {
                background: var(--workout-swipe-text);
                color: var(--workout-swipe-surface);
                -webkit-text-fill-color: var(--workout-swipe-surface);
                box-shadow: 0 3px 10px rgba(15,23,42,.18);
            }
            #view-active-workout.workout-swipe-mode #workout-form-check-top-btn,
            #view-active-workout.workout-swipe-mode #workout-share-set-btn,
            #view-active-workout.workout-swipe-mode #workout-add-exercise-video-btn,
            #view-active-workout.workout-swipe-mode #workout-add-existing-wrap {
                display: none !important;
            }
            #view-active-workout.workout-swipe-mode #workout-swipe-actions {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: 7px;
                margin: 0 0 13px;
            }
            .workout-swipe-action {
                min-width: 0;
                min-height: 58px;
                padding: 8px 4px;
                border: 1px solid var(--workout-swipe-border);
                border-radius: 13px;
                background: var(--workout-swipe-surface);
                color: var(--workout-swipe-text);
                -webkit-text-fill-color: var(--workout-swipe-text);
                box-shadow: 0 4px 14px rgba(15,23,42,.05);
                font: inherit;
                font-size: .64rem;
                line-height: 1.12;
                font-weight: 800;
                cursor: pointer;
            }
            .workout-swipe-action-icon {
                display: block;
                margin: 0 auto 5px;
                color: var(--workout-swipe-accent);
                -webkit-text-fill-color: var(--workout-swipe-accent);
                font-size: 1.05rem;
                line-height: 1;
            }
            #view-active-workout.workout-swipe-mode #workout-swipe-pager {
                display: grid;
                grid-template-columns: 48px 1fr 48px;
                align-items: center;
                gap: 9px;
                margin: 0 0 11px;
            }
            .workout-swipe-nav {
                width: 48px;
                min-height: 48px;
                border: 1px solid var(--workout-swipe-border);
                border-radius: 14px;
                background: var(--workout-swipe-surface);
                color: var(--workout-swipe-text);
                -webkit-text-fill-color: var(--workout-swipe-text);
                font-size: 1.25rem;
                font-weight: 900;
                cursor: pointer;
            }
            .workout-swipe-nav:disabled { opacity: .35; cursor: default; }
            .workout-swipe-progress { min-width: 0; text-align: center; }
            #workout-swipe-count {
                display: block;
                color: var(--workout-swipe-text);
                -webkit-text-fill-color: var(--workout-swipe-text);
                font-size: .77rem;
                font-weight: 900;
            }
            #workout-swipe-hint {
                display: block;
                margin-top: 2px;
                color: var(--workout-swipe-muted);
                -webkit-text-fill-color: var(--workout-swipe-muted);
                font-size: .64rem;
                font-weight: 650;
            }
            #workout-swipe-dots {
                display: flex;
                justify-content: center;
                gap: 4px;
                margin-top: 6px;
            }
            .workout-swipe-dot {
                width: 5px;
                height: 5px;
                border-radius: 999px;
                background: var(--workout-swipe-border);
            }
            .workout-swipe-dot.is-active { width: 16px; background: var(--workout-swipe-accent); }
            #view-active-workout.workout-swipe-mode #workout-exercises-list > .exercise-logger-card:not(.workout-swipe-active) {
                display: none !important;
            }
            #view-active-workout.workout-swipe-mode #workout-exercises-list > .exercise-logger-card.workout-swipe-active {
                display: block !important;
                margin-bottom: 12px !important;
                border-color: var(--workout-swipe-border) !important;
                box-shadow: 0 12px 34px rgba(15,23,42,.10) !important;
                animation: workoutSwipeCardIn .18s ease-out;
            }
            .workout-swipe-prescription {
                display: none;
                flex-wrap: wrap;
                gap: 6px;
                margin-top: 10px;
            }
            #view-active-workout.workout-swipe-mode .workout-swipe-prescription { display: flex; }
            .workout-swipe-prescription span {
                padding: 6px 9px;
                border: 1px solid var(--workout-swipe-border);
                border-radius: 999px;
                background: var(--workout-swipe-soft);
                color: var(--workout-swipe-text);
                -webkit-text-fill-color: var(--workout-swipe-text);
                font-size: .7rem;
                font-weight: 850;
            }
            #view-active-workout.workout-swipe-mode .workout-swipe-active .workout-exercise-tip:not(:empty) {
                margin-top: 9px;
                padding: 10px 11px;
                border-left: 3px solid var(--workout-swipe-accent);
                border-radius: 0 9px 9px 0;
                background: var(--workout-swipe-soft);
                color: var(--workout-swipe-muted) !important;
                -webkit-text-fill-color: var(--workout-swipe-muted) !important;
                line-height: 1.4;
            }
            #view-active-workout.workout-swipe-mode .workout-swipe-active .workout-exercise-tip:not(:empty)::before {
                content: 'Tip';
                display: block;
                margin-bottom: 3px;
                color: var(--workout-swipe-text);
                -webkit-text-fill-color: var(--workout-swipe-text);
                font-size: .64rem;
                font-weight: 900;
                letter-spacing: .06em;
                text-transform: uppercase;
            }
            @keyframes workoutSwipeCardIn {
                from { opacity: .55; transform: translateX(10px); }
                to { opacity: 1; transform: translateX(0); }
            }
            html.pbb-theme-dark #view-active-workout,
            body.dark-mode #view-active-workout,
            body.pbb-theme-dark #view-active-workout {
                --workout-swipe-surface: #17191d;
                --workout-swipe-soft: #24272d;
                --workout-swipe-border: #3b4049;
                --workout-swipe-text: #f7f4ed;
                --workout-swipe-muted: #c5beb0;
                --workout-swipe-accent: #e1b95f;
            }
            @media (max-width: 360px) {
                #workout-content-wrapper { padding-left: 11px !important; padding-right: 11px !important; }
                #view-active-workout.workout-swipe-mode #workout-swipe-actions { gap: 5px; }
                .workout-swipe-action { padding-left: 2px; padding-right: 2px; font-size: .59rem; }
                .workout-player-mode-switch { min-width: 136px; }
            }
            @media (prefers-reduced-motion: reduce) {
                #view-active-workout.workout-swipe-mode #workout-exercises-list > .exercise-logger-card.workout-swipe-active { animation: none; }
            }
        `;
        document.head.appendChild(style);
    }

    function makeButton(label, icon, handler) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'workout-swipe-action';
        button.setAttribute('aria-label', label);
        const iconEl = document.createElement('span');
        iconEl.className = 'workout-swipe-action-icon';
        iconEl.setAttribute('aria-hidden', 'true');
        iconEl.textContent = icon;
        const labelEl = document.createElement('span');
        labelEl.textContent = label;
        button.append(iconEl, labelEl);
        button.addEventListener('click', handler);
        return button;
    }

    function callGlobal(name, argument) {
        if (typeof root[name] === 'function') root[name](argument);
    }

    function workoutContext() {
        const title = document.getElementById('workout-player-title');
        return {
            source: 'workout',
            workoutName: root.currentWorkoutName || (title ? title.textContent : '')
        };
    }

    function ensureControls() {
        const wrapper = document.getElementById('workout-content-wrapper');
        const goal = document.getElementById('workout-player-goal');
        const list = getContainer();
        if (!wrapper || !goal || !list) return;

        if (!document.getElementById('workout-player-experiment-controls')) {
            const controls = document.createElement('div');
            controls.id = 'workout-player-experiment-controls';
            controls.innerHTML = `
                <span class="workout-player-experiment-label">Workout view</span>
                <div class="workout-player-mode-switch" role="group" aria-label="Workout view">
                    <button type="button" data-workout-mode="list">List</button>
                    <button type="button" data-workout-mode="swipe">Swipe</button>
                </div>
            `;
            controls.querySelectorAll('[data-workout-mode]').forEach((button) => {
                button.addEventListener('click', () => setMode(button.dataset.workoutMode));
            });
            goal.insertAdjacentElement('afterend', controls);
        }

        if (!document.getElementById('workout-swipe-actions')) {
            const actions = document.createElement('div');
            actions.id = 'workout-swipe-actions';
            actions.setAttribute('aria-label', 'Workout actions');
            actions.append(
                makeButton('Form Check', '◉', () => callGlobal('openFormCheck', workoutContext())),
                makeButton('Share Set', '↗', () => callGlobal('openWorkoutFeedShare', workoutContext())),
                makeButton('Add Existing', '+', () => callGlobal('openAddExerciseModal')),
                makeButton('Create New', '✦', () => callGlobal('openCreateCustomExerciseModal', 'workout'))
            );
            list.insertAdjacentElement('beforebegin', actions);
        }

        if (!document.getElementById('workout-swipe-pager')) {
            const pager = document.createElement('div');
            pager.id = 'workout-swipe-pager';
            pager.innerHTML = `
                <button id="workout-swipe-prev" class="workout-swipe-nav" type="button" aria-label="Previous exercise">‹</button>
                <div class="workout-swipe-progress" aria-live="polite">
                    <span id="workout-swipe-count">0 of 0</span>
                    <span id="workout-swipe-hint">Swipe for next exercise</span>
                    <div id="workout-swipe-dots" aria-hidden="true"></div>
                </div>
                <button id="workout-swipe-next" class="workout-swipe-nav" type="button" aria-label="Next exercise">›</button>
            `;
            pager.querySelector('#workout-swipe-prev').addEventListener('click', previous);
            pager.querySelector('#workout-swipe-next').addEventListener('click', next);
            list.insertAdjacentElement('beforebegin', pager);
        }
    }

    function ensurePrescription(card) {
        let prescription = card.querySelector('.workout-swipe-prescription');
        if (!prescription) {
            prescription = document.createElement('div');
            prescription.className = 'workout-swipe-prescription';
            const headerCopy = card.firstElementChild && card.firstElementChild.querySelector('[style*="flex: 1"]');
            (headerCopy || card.firstElementChild || card).appendChild(prescription);
        }

        const setCount = card.dataset.prescribedSets || card.querySelectorAll('.set-wrapper').length || 1;
        const repTarget = card.dataset.prescribedReps || 'Log each set';
        prescription.replaceChildren();
        const sets = document.createElement('span');
        sets.textContent = `${setCount} ${String(setCount) === '1' ? 'set' : 'sets'}`;
        const reps = document.createElement('span');
        reps.textContent = `Target: ${repTarget}`;
        prescription.append(sets, reps);
    }

    function renderPager(cards) {
        const count = document.getElementById('workout-swipe-count');
        const dots = document.getElementById('workout-swipe-dots');
        const previousButton = document.getElementById('workout-swipe-prev');
        const nextButton = document.getElementById('workout-swipe-next');
        if (count) count.textContent = cards.length ? `${currentIndex + 1} of ${cards.length}` : '0 of 0';
        if (previousButton) previousButton.disabled = currentIndex <= 0;
        if (nextButton) nextButton.disabled = !cards.length || currentIndex >= cards.length - 1;
        if (dots) {
            dots.replaceChildren();
            cards.forEach((card, index) => {
                const dot = document.createElement('span');
                dot.className = `workout-swipe-dot${index === currentIndex ? ' is-active' : ''}`;
                dots.appendChild(dot);
            });
        }
    }

    function applyMode(options) {
        const view = getView();
        if (!view) return 'list';
        const tester = isTester(root.currentUser);
        view.classList.toggle('workout-player-tester', tester);
        if (!tester) {
            view.classList.remove('workout-swipe-mode');
            getCards().forEach((card) => {
                card.classList.remove('workout-swipe-active');
                card.removeAttribute('aria-hidden');
            });
            return 'list';
        }

        const mode = readMode();
        view.classList.toggle('workout-swipe-mode', mode === 'swipe');
        document.querySelectorAll('[data-workout-mode]').forEach((button) => {
            button.setAttribute('aria-pressed', String(button.dataset.workoutMode === mode));
        });

        const workoutKey = String(root.currentWorkoutKey || root.currentWorkoutName || 'workout');
        if (workoutKey !== currentWorkoutKey) {
            currentWorkoutKey = workoutKey;
            currentIndex = 0;
        }

        const cards = getCards();
        const focusName = options && options.focusName;
        if (focusName) {
            const foundIndex = cards.findIndex((card) => card.dataset.exerciseName === focusName);
            if (foundIndex >= 0) currentIndex = foundIndex;
        }
        currentIndex = clampIndex(currentIndex, cards.length);
        cards.forEach((card, index) => {
            ensurePrescription(card);
            const active = mode === 'swipe' && index === currentIndex;
            card.classList.toggle('workout-swipe-active', active);
            if (mode === 'swipe') card.setAttribute('aria-hidden', String(!active));
            else card.removeAttribute('aria-hidden');
        });
        renderPager(cards);

        if (mode === 'swipe' && options && options.scroll) {
            const content = document.getElementById('workout-content-wrapper');
            if (content) view.scrollTo({ top: Math.max(0, content.offsetTop - 8), behavior: 'smooth' });
        }
        return mode;
    }

    function sync(options) {
        addStyles();
        ensureControls();
        return applyMode(options || {});
    }

    function queueSync(options) {
        if (syncQueued) return;
        syncQueued = true;
        root.requestAnimationFrame(() => {
            syncQueued = false;
            sync(options);
        });
    }

    function setMode(mode) {
        writeMode(mode);
        sync({ scroll: normalizeMode(mode) === 'swipe' });
    }

    function goTo(index) {
        const cards = getCards();
        const nextIndex = clampIndex(index, cards.length);
        if (nextIndex === currentIndex) return;
        currentIndex = nextIndex;
        sync({ scroll: true });
    }

    function next() {
        goTo(currentIndex + 1);
    }

    function previous() {
        goTo(currentIndex - 1);
    }

    function bindInteractions() {
        const container = getContainer();
        if (!container || container.dataset.swipePlayerBound === 'true') return;
        container.dataset.swipePlayerBound = 'true';
        container.addEventListener('touchstart', (event) => {
            if (!getView() || !getView().classList.contains('workout-swipe-mode')) return;
            if (event.target.closest('input, textarea, select, button, video, a, summary, [data-video-container]')) return;
            const touch = event.changedTouches[0];
            touchStart = { x: touch.clientX, y: touch.clientY };
        }, { passive: true });
        container.addEventListener('touchend', (event) => {
            if (!touchStart) return;
            const touch = event.changedTouches[0];
            const deltaX = touch.clientX - touchStart.x;
            const deltaY = touch.clientY - touchStart.y;
            touchStart = null;
            if (Math.abs(deltaX) < 55 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
            if (deltaX < 0) next();
            else previous();
        }, { passive: true });
    }

    function init() {
        sync();
        bindInteractions();
        const container = getContainer();
        if (container && typeof root.MutationObserver === 'function') {
            const observer = new root.MutationObserver(() => queueSync());
            observer.observe(container, { childList: true });
        }
        document.addEventListener('keydown', (event) => {
            const view = getView();
            if (!view || view.style.display === 'none' || !view.classList.contains('workout-swipe-mode')) return;
            if (document.activeElement && document.activeElement.matches('input, textarea, select, button')) return;
            if (event.key === 'ArrowRight') next();
            if (event.key === 'ArrowLeft') previous();
        });
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) sync();
        });
    }

    root.PBBWorkoutSwipePlayer = Object.assign(exported, {
        init,
        sync,
        setMode,
        next,
        previous
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})(typeof window !== 'undefined' ? window : null);
