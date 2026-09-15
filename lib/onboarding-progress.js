/* Navigation checkpoints, not proof of payment or course completion. */
(function (root) {
    'use strict';
    const PREFIX = 'pbb_onboarding_progress_v1:';
    // Tours are for the active Meta free-look journey and dedicated QA accounts.
    // Regular members must never be pulled back into the guide by a checkpoint.
    // This is navigation only; it grants no payment, lesson completion or XP.
    const TOUR_TEST_ACCOUNTS = new Set([
        'e6781875-f657-4f91-91e1-1289c0e345f8',
        '755120c2-b0f9-44ed-8493-0cc14cbc7901',
        'cc632168-874c-447e-a4ad-ee7f6b40bb7e'
    ]);
    function isTourSuppressed() {
        if (root.isAdminViewing) return true;
        const id = root.currentUser && (root.currentUser.id || root.currentUser.user_id);
        if (id && TOUR_TEST_ACCOUNTS.has(String(id))) return false;
        const trial = root.BalanceMetaAdTrial?.readState();
        // A previous visitor's preview on a shared device is not this member's.
        if (!trial || trial.claimedAt || (id && root.guestMode !== true && trial.ownerUserId !== id)) return true;
        return root.BalanceMetaAdTrial?.isActive() !== true;
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
