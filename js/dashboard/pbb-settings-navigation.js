(function () {
    'use strict';

    var destinations = {
        equipment: {
            open: 'openEquipmentPicker',
            surfaces: [{ id: 'equipment-picker-overlay', close: 'closeEquipmentPicker' }]
        },
        food: {
            open: 'openDietaryPicker',
            surfaces: [{ id: 'dietary-picker-overlay', close: 'closeDietaryPicker' }]
        },
        macros: {
            open: 'openCaloriesAndMacroGoals',
            surfaces: [
                { id: 'calories-macro-actions-overlay', close: 'closeCaloriesAndMacroGoals' },
                { id: 'macro-settings-modal-overlay', close: 'closeMacroSettingsModal' },
                { id: 'recalculate-calories-wizard', close: 'closeRecalculateWizard' }
            ]
        },
        cycle: {
            open: 'openCycleTrackingModal',
            surfaces: [{ id: 'cycle-tracking-modal', close: 'closeCycleTrackingModal' }]
        },
        battle: {
            open: 'openFeedBattleChooser',
            surfaces: [{ id: 'feed-battle-chooser-overlay', close: 'closeFeedBattleChooser' }]
        },
        challenge: {
            open: 'openChallengeTypePicker',
            surfaces: [
                { id: 'challenge-type-picker', close: 'closeChallengeTypePicker' },
                { id: 'create-challenge-modal', close: 'closeCreateChallengeModal' }
            ]
        },
        character: {
            open: 'openCharacterCustomizationShortcut',
            surfaces: [{ id: 'onboarding-wizard', close: 'closeCharacterCustomizationShortcut' }]
        },
        health: {
            open: 'toggleHealthConnect',
            surfaces: [{ id: 'health-connect-modal', close: 'dismissHealthConnectModal' }]
        },
        addFriend: {
            open: 'openAddFriendModal',
            surfaces: [{ id: 'add-friend-modal', close: 'closeAddFriendModal' }]
        },
        inviteFriend: {
            open: 'openShareReferralModal',
            surfaces: [{ id: 'share-referral-modal', close: 'closeShareReferralModal' }]
        },
        password: {
            open: 'openChangePasswordModal',
            surfaces: [{ id: 'change-password-modal-overlay', close: 'closeChangePasswordModal' }]
        }
    };

    var activeKey = null;
    var observer = null;
    var settleTimer = null;
    var activationTimers = [];
    var ignoreNextPop = false;
    var holdUntil = 0;
    var touchStart = null;

    function surfaceIsVisible(surface) {
        var element = document.getElementById(surface.id);
        if (!element || !element.isConnected || element.hidden) return false;
        var display = element.style && element.style.display;
        if (display === 'none') return false;
        if (display === 'flex' || display === 'block' || display === 'grid') return true;
        if (element.classList && element.classList.contains('active')) return true;
        if (typeof window.getComputedStyle === 'function') {
            return window.getComputedStyle(element).display !== 'none';
        }
        return false;
    }

    function visibleSurface(entry) {
        if (!entry) return null;
        for (var index = entry.surfaces.length - 1; index >= 0; index -= 1) {
            if (surfaceIsVisible(entry.surfaces[index])) return entry.surfaces[index];
        }
        return null;
    }

    function stopWatching() {
        if (observer) observer.disconnect();
        observer = null;
        if (settleTimer) window.clearTimeout(settleTimer);
        settleTimer = null;
    }

    function clearActivationTimers() {
        activationTimers.forEach(function (timer) { window.clearTimeout(timer); });
        activationTimers = [];
    }

    function removeSyntheticHistoryEntry() {
        if (!activeKey) return;
        activeKey = null;
        holdUntil = 0;
        stopWatching();
        ignoreNextPop = true;
        window.history.back();
    }

    function scheduleClosedCheck() {
        if (!activeKey || settleTimer) return;
        var delay = Math.max(140, holdUntil - Date.now());
        settleTimer = window.setTimeout(function () {
            settleTimer = null;
            var entry = destinations[activeKey];
            if (visibleSurface(entry)) return;
            if (Date.now() < holdUntil) {
                scheduleClosedCheck();
                return;
            }
            removeSyntheticHistoryEntry();
        }, delay);
    }

    function watchActiveDestination() {
        stopWatching();
        if (!document.body || typeof MutationObserver !== 'function') return;
        observer = new MutationObserver(function () {
            if (!activeKey) return;
            if (visibleSurface(destinations[activeKey])) {
                if (settleTimer) window.clearTimeout(settleTimer);
                settleTimer = null;
                return;
            }
            scheduleClosedCheck();
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class', 'hidden']
        });
    }

    function activateDestination(key) {
        if (activeKey || !visibleSurface(destinations[key])) return false;
        activeKey = key;
        var currentState = window.history.state || {};
        window.history.pushState(Object.assign({}, currentState, {
            pbbSettingsDestination: key
        }), '', window.location.href);
        watchActiveDestination();
        return true;
    }

    function activateWhenReady(key) {
        clearActivationTimers();
        [0, 60, 220, 700, 1600].forEach(function (delay) {
            activationTimers.push(window.setTimeout(function () {
                if (activeKey) return;
                activateDestination(key);
            }, delay));
        });
    }

    function unavailableMessage(key) {
        var message = key === 'battle'
            ? 'Battles are still loading. Try again in a moment.'
            : 'This setting is still loading. Try again in a moment.';
        if (typeof window.showToast === 'function') window.showToast(message, 'info');
        else window.alert(message);
    }

    window.openSettingsDestination = function (key) {
        var entry = destinations[key];
        if (!entry) return false;
        var opener = window[entry.open];
        if (typeof opener !== 'function') {
            unavailableMessage(key);
            return false;
        }
        try {
            var result = opener();
            activateWhenReady(key);
            if (result && typeof result.then === 'function') {
                Promise.resolve(result).then(
                    function () { activateWhenReady(key); },
                    function () { activateWhenReady(key); }
                );
            }
            return result === undefined ? true : result;
        } catch (error) {
            console.error('Could not open Settings destination:', key, error);
            unavailableMessage(key);
            return false;
        }
    };

    window.pbbHoldSettingsNavigation = function (milliseconds) {
        if (!activeKey) return;
        holdUntil = Math.max(holdUntil, Date.now() + Math.max(0, Number(milliseconds) || 0));
    };

    window.openCancellationSettings = function () {
        window.location.href = '/cancellation.html?from=settings';
    };

    function closeVisibleDestination() {
        var key = activeKey;
        if (!key) return false;
        var entry = destinations[key];
        var surface = visibleSurface(entry);
        activeKey = null;
        holdUntil = 0;
        stopWatching();
        clearActivationTimers();
        if (surface && typeof window[surface.close] === 'function') {
            window[surface.close]();
        }
        return true;
    }

    window.addEventListener('popstate', function (event) {
        if (ignoreNextPop) {
            ignoreNextPop = false;
            event.stopImmediatePropagation();
            return;
        }
        if (!activeKey) return;
        event.stopImmediatePropagation();
        closeVisibleDestination();
    }, true);

    document.addEventListener('click', function (event) {
        if (!activeKey) return;
        var action = event.target && event.target.closest
            ? event.target.closest('[data-action="recalculate"]')
            : null;
        if (activeKey === 'macros' && action) window.pbbHoldSettingsNavigation(5000);
    }, true);

    function platformName() {
        try {
            if (window.Capacitor && typeof window.Capacitor.getPlatform === 'function') {
                return String(window.Capacitor.getPlatform()).toLowerCase();
            }
        } catch (_) {}
        return /android/i.test(navigator.userAgent || '') ? 'android' : 'ios';
    }

    document.addEventListener('touchstart', function (event) {
        if (!activeKey || !event.touches || event.touches.length !== 1) return;
        var touch = event.touches[0];
        var width = window.innerWidth || document.documentElement.clientWidth || 0;
        var platform = platformName();
        var fromEdge = platform === 'android' ? touch.clientX >= width - 56 : touch.clientX <= 56;
        touchStart = fromEdge ? { x: touch.clientX, y: touch.clientY, platform: platform } : null;
    }, { passive: true });

    document.addEventListener('touchend', function (event) {
        if (!touchStart || !activeKey || !event.changedTouches || !event.changedTouches.length) {
            touchStart = null;
            return;
        }
        var touch = event.changedTouches[0];
        var deltaX = touch.clientX - touchStart.x;
        var deltaY = Math.abs(touch.clientY - touchStart.y);
        var isBack = touchStart.platform === 'android' ? deltaX < -90 : deltaX > 90;
        touchStart = null;
        if (isBack && deltaY < 90) window.history.back();
    }, { passive: true });

    window.PBB_SETTINGS_DESTINATIONS = destinations;
})();
