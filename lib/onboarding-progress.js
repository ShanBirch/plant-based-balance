/* Navigation checkpoints, not proof of payment or course completion. */
(function (root) {
    'use strict';
    const PREFIX = 'pbb_onboarding_progress_v1:';
    // New members receive one first-run tour. Keep established members exempt.
    // This is navigation only; it grants no payment, lesson completion or XP.
    const TOUR_TEST_ACCOUNTS = new Set([
        'e6781875-f657-4f91-91e1-1289c0e345f8',
        '755120c2-b0f9-44ed-8493-0cc14cbc7901',
        'cc632168-874c-447e-a4ad-ee7f6b40bb7e'
    ]);
    const NEW_MEMBER_TOUR_FROM = Date.parse('2026-09-17T14:00:00Z'); // 18 September, Brisbane
    function needsFirstRunTour() {
        const user = root.currentUser;
        if (!user?.id || root.guestMode || root.isAdminViewing) return false;
        if (!(Date.parse(user.created_at || '') >= NEW_MEMBER_TOUR_FROM)) return false;
        if (user.user_metadata?.balance_app_tour_completed_at) return false;
        try { return !root.localStorage.getItem('pbb_app_tour_completed:' + user.id); }
        catch (_) { return true; }
    }
    function completeFirstRunTour() {
        const user = root.currentUser;
        if (!user?.id || root.guestMode || root.isAdminViewing) return;
        const completedAt = new Date().toISOString();
        try { root.localStorage.setItem('pbb_app_tour_completed:' + user.id, completedAt); } catch (_) {}
        user.user_metadata = { ...user.user_metadata, balance_app_tour_completed_at: completedAt };
        // Persist navigation completion across devices, never an entitlement.
        root.supabaseClient?.auth?.updateUser({ data: { balance_app_tour_completed_at: completedAt } })
            .then(result => { if (result.error) console.warn('[onboarding] Tour completion sync failed', result.error.message); })
            .catch(error => console.warn('[onboarding] Tour completion sync failed', error.message));
    }
    function isTourSuppressed() {
        if (root.isAdminViewing) return true;
        const id = root.currentUser && (root.currentUser.id || root.currentUser.user_id);
        if (id && TOUR_TEST_ACCOUNTS.has(String(id))) return false;
        if (needsFirstRunTour()) return false;
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
    async function completionDestination() {
        const id = root.currentUser?.id;
        if (!id || !root.supabaseClient) throw new Error('Account status is not ready');
        if (root.isAdminViewing || root.isBalanceAdminEmail?.(root.currentUser.email)) return 'course';
        let timer;
        try {
            // Navigation only: use this account's current server record, never
            // another account's local subscription flag. This grants no access.
            const { data, error } = await Promise.race([
                root.supabaseClient.from('users').select('id,subscription_status').eq('id', id).maybeSingle(),
                new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Account check timed out')), 8000); })
            ]);
            if (error || !data || data.id !== id || root.currentUser?.id !== id) throw new Error('Account status could not be checked');
            return ['active', 'trialing'].includes(data.subscription_status) ? 'course' : 'checkout';
        } finally { clearTimeout(timer); }
    }
    root.BalanceOnboardingProgress = { read, save, clear, isTourSuppressed, needsFirstRunTour, completeFirstRunTour, completionDestination };
})(typeof window === 'undefined' ? globalThis : window);
