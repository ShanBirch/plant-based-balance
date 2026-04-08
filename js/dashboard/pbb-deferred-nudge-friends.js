// ===== NUDGE-A-FRIEND CARD LOGIC =====
// Shows a homepage card listing friends whose last_login is >= 2 days old.
// Each nudge awards the sender +1 XP, capped at once per friend per week
// (enforced server-side via the `send_inactivity_nudge` RPC and the
// `friend_nudges` table's UNIQUE constraint).

(function () {
    let _inactiveFriends = [];

    /**
     * Entry point called from dashboard startup (dashboard-script-5).
     * Fetches inactive friends and shows/hides the card accordingly.
     */
    async function checkAndShowNudgeFriendsCard() {
        if (!window.currentUser) return;
        if (window._onboardingWizardPending) return;
        const wizard = document.getElementById('onboarding-wizard');
        if (wizard && wizard.style.display !== 'none') return;

        const card = document.getElementById('nudge-friends-card');
        if (!card) return;

        // Honor dismissal for the day
        const today = typeof getLocalDateString === 'function'
            ? getLocalDateString()
            : new Date().toISOString().split('T')[0];
        const isDismissedLocal = localStorage.getItem('nudgeFriendsCardDismissedDate') === today;
        const isDismissedCloud = (window._pbbDismissedDates && window._pbbDismissedDates['nudgeFriendsCard']) === today;
        if (isDismissedLocal || isDismissedCloud) {
            card.style.display = 'none';
            return;
        }

        try {
            const { data, error } = await window.supabaseClient
                .rpc('get_inactive_friends_for_nudging', { user_uuid: window.currentUser.id });

            if (error) {
                console.warn('nudge-friends: RPC error', error);
                card.style.display = 'none';
                return;
            }

            _inactiveFriends = Array.isArray(data) ? data : [];

            if (_inactiveFriends.length === 0) {
                card.style.display = 'none';
                return;
            }

            const subtitle = document.getElementById('nudge-friends-subtitle');
            if (subtitle) {
                const n = _inactiveFriends.length;
                subtitle.textContent = n === 1
                    ? '1 friend hasn\u2019t logged in for 2+ days'
                    : `${n} friends haven\u2019t logged in for 2+ days`;
            }

            renderNudgeFriendsList();
            card.style.display = 'block';
        } catch (e) {
            console.error('nudge-friends: failed to load', e);
            card.style.display = 'none';
        }
    }

    /**
     * Render the expanded list of inactive friends (called lazily on expand
     * and after each successful nudge).
     */
    function renderNudgeFriendsList() {
        const list = document.getElementById('nudge-friends-list');
        if (!list) return;

        if (_inactiveFriends.length === 0) {
            list.innerHTML = '<div style="padding: 14px; text-align: center; font-size: 0.85rem; opacity: 0.85;">All your friends are active this week! 🎉</div>';
            return;
        }

        list.innerHTML = _inactiveFriends.map((f, i) => {
            const name = (f.friend_name || 'Friend').replace(/"/g, '&quot;');
            const initials = (f.friend_name || '?').trim().charAt(0).toUpperCase();
            const days = Math.max(2, parseInt(f.days_inactive, 10) || 2);
            const daysLabel = days === 1 ? '1 day ago' : `${days} days ago`;

            const avatar = f.friend_photo
                ? `<img src="${f.friend_photo}" alt="${name}" style="width: 100%; height: 100%; object-fit: cover;">`
                : `<span>${initials}</span>`;

            return `
                <div id="nudge-friend-row-${i}" style="display: flex; align-items: center; gap: 12px; padding: 10px 12px;${i > 0 ? ' border-top: 1px solid rgba(255,255,255,0.15);' : ''}">
                    <div style="width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,0.25); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.95rem; overflow: hidden; flex-shrink: 0;">${avatar}</div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 600; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</div>
                        <div style="font-size: 0.75rem; opacity: 0.85;">Last seen ${daysLabel}</div>
                    </div>
                    <button
                        id="nudge-friend-btn-${i}"
                        onclick="sendInactivityNudge('${f.friend_id}', ${i})"
                        style="background: white; color: #ef4444; border: none; padding: 8px 14px; border-radius: 20px; font-weight: 700; font-size: 0.78rem; cursor: pointer; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.15);">
                        Nudge +1 XP
                    </button>
                </div>
            `;
        }).join('');
    }

    /**
     * Expand/collapse the friend list.
     */
    function toggleNudgeFriendsExpanded() {
        const list = document.getElementById('nudge-friends-list');
        const chevron = document.getElementById('nudge-friends-chevron');
        if (!list) return;
        const isHidden = list.style.display === 'none' || !list.style.display;
        list.style.display = isHidden ? 'block' : 'none';
        if (chevron) chevron.style.transform = isHidden ? 'rotate(180deg)' : '';
    }

    /**
     * Send an inactivity nudge. Server validates friendship, inactivity,
     * rate limit, and atomically inserts the ledger row + notification
     * row + awards +1 XP in one RPC call.
     */
    async function sendInactivityNudge(friendId, rowIndex) {
        if (!window.currentUser || !friendId) return;

        const btn = document.getElementById(`nudge-friend-btn-${rowIndex}`);
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Sending\u2026';
            btn.style.opacity = '0.7';
        }

        try {
            const { data, error } = await window.supabaseClient
                .rpc('send_inactivity_nudge', { friend_uuid: friendId });

            // RPC returns a single-row set: [{ success, reason, new_lifetime_points }]
            const result = Array.isArray(data) ? data[0] : data;

            if (error || !result || !result.success) {
                const reason = result?.reason || error?.message || 'unknown';
                console.warn('nudge-friends: send failed', reason);
                if (btn) {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    btn.textContent = 'Nudge +1 XP';
                }
                if (typeof showToast === 'function') {
                    if (reason === 'already_nudged_this_week') {
                        showToast('You already nudged this friend this week!', 'info');
                    } else if (reason === 'friend_not_inactive') {
                        showToast('They just logged in — no nudge needed!', 'info');
                    } else if (reason === 'not_friends') {
                        showToast('You\u2019re not friends with this user.', 'error');
                    } else {
                        showToast('Could not send nudge. Try again later.', 'error');
                    }
                }
                return;
            }

            // Success — mark row as nudged
            if (btn) {
                btn.textContent = 'Nudged \u2713';
                btn.style.background = 'rgba(255,255,255,0.25)';
                btn.style.color = 'white';
                btn.style.cursor = 'default';
            }

            if (typeof showToast === 'function') {
                showToast('+1 XP \u2014 nudge sent!', 'success');
            }
            if (typeof triggerXPBarRainbow === 'function') triggerXPBarRainbow();
            if (typeof refreshLevelDisplay === 'function') refreshLevelDisplay();
            if (typeof refreshPointsDisplay === 'function') refreshPointsDisplay();

            // Remove from local list so the count/subtitle stays accurate
            // if the user re-opens the card later. We keep the visual row
            // in place (with the "Nudged" state) for feedback.
            _inactiveFriends = _inactiveFriends.filter(f => f.friend_id !== friendId);
            const subtitle = document.getElementById('nudge-friends-subtitle');
            if (subtitle) {
                const n = _inactiveFriends.length;
                if (n === 0) {
                    subtitle.textContent = 'All nudged for this week!';
                } else {
                    subtitle.textContent = n === 1
                        ? '1 friend left to nudge'
                        : `${n} friends left to nudge`;
                }
            }
        } catch (e) {
            console.error('nudge-friends: exception during send', e);
            if (btn) {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.textContent = 'Nudge +1 XP';
            }
        }
    }

    /**
     * Dismiss the card for the rest of the day.
     */
    function dismissNudgeFriendsCard() {
        const today = typeof getLocalDateString === 'function'
            ? getLocalDateString()
            : new Date().toISOString().split('T')[0];
        try { localStorage.setItem('nudgeFriendsCardDismissedDate', today); } catch (e) {}
        if (typeof window.syncTrendDismissalToDb === 'function') {
            window.syncTrendDismissalToDb('nudgeFriendsCard', today);
        }
        const card = document.getElementById('nudge-friends-card');
        if (card) card.style.display = 'none';
    }

    // Expose to global scope so dashboard startup + inline onclicks can find them
    window.checkAndShowNudgeFriendsCard = checkAndShowNudgeFriendsCard;
    window.toggleNudgeFriendsExpanded = toggleNudgeFriendsExpanded;
    window.sendInactivityNudge = sendInactivityNudge;
    window.dismissNudgeFriendsCard = dismissNudgeFriendsCard;
})();
