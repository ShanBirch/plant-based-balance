/* Navigation checkpoints, not proof of payment or course completion. */
(function (root) {
    'use strict';
    const PREFIX = 'pbb_onboarding_progress_v1:';
    // Account-scoped support exemption requested by Shannon. This only bypasses
    // the guide; it never grants payment, lesson completion or XP.
    const TOUR_EXEMPT_ACCOUNTS = new Set(['e1403726-19bc-4663-85d4-59b668791a80']);
    function isTourSuppressed() {
        const id = root.currentUser && (root.currentUser.id || root.currentUser.user_id);
        return !!id && TOUR_EXEMPT_ACCOUNTS.has(String(id));
    }
    function key() {
        if (root.isAdminViewing) return null;
        const id = root.currentUser && (root.currentUser.id || root.currentUser.user_id);
        if (!id) return null; // Wait for authentication; never resume another member's draft.
        const trial = root.BalanceMetaAdTrial?.readState();
        return PREFIX + id + (trial && !trial.claimedAt ? ':' + trial.activatedAt : '');
    }
    function read() {
        try {
            const target = key();
            if (!target) return null;
            const value = JSON.parse(root.localStorage.getItem(target) || 'null');
            if (value?.stage === 'tour' && isTourSuppressed()) {
                root.localStorage.removeItem(target);
                return null;
            }
            return value && value.version === 1 && ['setup', 'tour', 'checkout'].includes(value.stage) ? value : null;
        } catch (_) { return null; }
    }
    function save(stage, data) {
        if (stage === 'tour' && isTourSuppressed()) return;
        const target = key();
        if (!target) return;
        try {
            root.localStorage.setItem(target, JSON.stringify({ ...(read() || {}), ...data, version:1, stage, updatedAt:Date.now() }));
        } catch (_) { /* Storage unavailable: keep the current flow usable. */ }
    }
    function clear() {
        try { const target = key(); if (target) root.localStorage.removeItem(target); } catch (_) {}
    }
    root.BalanceOnboardingProgress = { read, save, clear, isTourSuppressed };
})(typeof window === 'undefined' ? globalThis : window);
