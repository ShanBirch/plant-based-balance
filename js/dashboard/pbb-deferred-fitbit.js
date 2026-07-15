// ===== FITBIT INTEGRATION LOGIC =====

    /**
     * Check Fitbit connection status and load data
     */
    async function initFitbitDashboard() {
        if (!window.currentUser) return;

        try {
            const response = await fetch(`/api/fitbit/data?user_id=${window.currentUser.id}`);
            const data = await response.json();

            if (data.connected) {
                // Update settings button
                const btn = document.getElementById('fitbit-connect-btn');
                const statusText = document.getElementById('fitbit-status-text');
                if (btn) {
                    btn.textContent = 'Disconnect';
                    btn.style.background = '#ef4444';
                }
                if (statusText) statusText.textContent = 'Connected and syncing';
                renderFitbitImportedActivityHomeCard();
                maybeSyncFitbitImportedActivity();
            } else {
                // Reset settings button
                const btn = document.getElementById('fitbit-connect-btn');
                const statusText = document.getElementById('fitbit-status-text');
                if (btn) {
                    btn.textContent = 'Connect';
                    btn.style.background = '#00B0B9';
                }
                if (statusText) statusText.textContent = 'Sync steps, sleep & heart rate';
            }
        } catch (err) {
            console.warn('Fitbit init error:', err);
        }
    }

    const FITBIT_CARD_SYNC_COOLDOWN_MS = 10 * 60 * 1000;
    let fitbitImportedActivitySyncInFlight = null;

    function importedActivitySourceLabel(activity) {
        if (activity?.source === 'native_health') {
            return activity?.source_metadata?.provider || 'your health app';
        }
        return 'Fitbit';
    }

    async function syncNativeWorkoutsForImportedCard() {
        if (!window.currentUser || !window.NativeHealth || typeof window.NativeHealth.syncWorkoutsForSharing !== 'function') return [];
        try {
            let ready = !!window._nativeHealthReady;
            if (!ready && typeof window.NativeHealth.checkPermission === 'function') {
                ready = await window.NativeHealth.checkPermission();
            }
            if (!ready) return [];
            return await window.NativeHealth.syncWorkoutsForSharing(window.supabaseClient, window.currentUser.id, 2);
        } catch (error) {
            console.warn('Could not sync native workouts for the activity card:', error);
            return [];
        }
    }

    async function renderFitbitImportedActivityHomeCard() {
        if (!window.currentUser || !window.isMoveYourWayPilotUser?.()) return;
        try {
            await syncNativeWorkoutsForImportedCard();
            const activityLogs = window.dbHelpers?.activityLogs;
            const activities = typeof activityLogs?.getRecentImportedFromSources === 'function'
                ? await activityLogs.getRecentImportedFromSources(window.currentUser.id, ['fitbit', 'native_health'], 25)
                : await activityLogs?.getRecentImported?.(window.currentUser.id, 'fitbit', 25) || [];
            const newest = activities.find(activity => {
                const importedAt = new Date(activity.imported_at || 0).getTime();
                return importedAt && (Date.now() - importedAt) < 7 * 24 * 60 * 60 * 1000;
            });
            const existing = document.getElementById('fitbit-imported-activity-card');
            if (!newest) {
                if (existing) existing.remove();
                return;
            }
            const groupedActivities = activities.filter(activity => activity.source === newest.source && activity.activity_date === newest.activity_date && activity.activity_type === newest.activity_type);
            const distance = groupedActivities.reduce((sum, activity) => {
                const metadata = activity.source_metadata || {};
                return sum + Number(metadata.distance ?? metadata.distance_km ?? 0);
            }, 0);
            const distanceUnit = newest.source_metadata?.distance_unit || 'km';
            const distanceText = distance > 0 ? `${distance.toFixed(distance < 10 ? 1 : 0)} ${distanceUnit} ` : '';
            const totalDuration = groupedActivities.reduce((sum, activity) => sum + Number(activity.duration_minutes || 0), 0);
            const label = groupedActivities.length > 1 && newest.activity_type === 'walking' ? 'Walk' : String(newest.activity_label || newest.activity_type || 'activity');
            const sourceLabel = importedActivitySourceLabel(newest);
            const combinedActivity = { ...newest, duration_minutes: totalDuration, estimated_calories: groupedActivities.reduce((sum, activity) => sum + Number(activity.estimated_calories || 0), 0), activity_label: label, source_metadata: { ...(newest.source_metadata || {}), distance, distance_unit: distanceUnit }, activityIds: groupedActivities.map(activity => activity.id) };
            const card = existing || document.createElement('div');
            card.id = 'fitbit-imported-activity-card';
            card.style.cssText = 'margin:0 25px 14px; padding:18px; border-radius:18px; background:linear-gradient(135deg,#0f766e,#0e7490); color:#fff; box-shadow:0 8px 22px rgba(14,116,144,.2);';
            card.innerHTML = `<div style="display:flex; gap:12px; align-items:flex-start;"><div style="font-size:2rem; line-height:1;">${newest.activity_type === 'walking' ? '🚶' : newest.activity_type === 'running' ? '🏃' : newest.activity_type === 'cycling' ? '🚴' : '✨'}</div><div style="min-width:0; flex:1;"><div style="font-size:.74rem; font-weight:800; letter-spacing:.08em; text-transform:uppercase; opacity:.9;">Imported from ${sourceLabel}</div><div style="font-size:1.08rem; font-weight:800; line-height:1.25; margin-top:4px;">${distanceText}${label}</div><div style="font-size:.85rem; margin-top:4px; opacity:.92;">${totalDuration || 0} min. Share your movement with the Feed.</div></div></div><button id="fitbit-imported-activity-share" style="margin-top:14px; width:100%; padding:12px; border:0; border-radius:12px; background:var(--card-bg); color:var(--text-main); font:inherit; font-weight:800; cursor:pointer;">Share to Feed</button>`;
            const anchor = document.getElementById('weekly-goals-card') || document.getElementById('ai-assistant-card');
            if (!existing && anchor?.parentNode) anchor.parentNode.insertBefore(card, anchor.nextSibling);
            const shareButton = card.querySelector('#fitbit-imported-activity-share');
            if (shareButton) shareButton.onclick = () => window.openImportedActivityForSharing?.(combinedActivity);
        } catch (error) {
            console.warn('Could not render Fitbit imported-activity home card:', error);
        }
    }

    async function maybeSyncFitbitImportedActivity(force = false) {
        if (!window.currentUser || !window.isMoveYourWayPilotUser?.()) return 0;
        if (fitbitImportedActivitySyncInFlight) return fitbitImportedActivitySyncInFlight;

        const storageKey = `pbb_fitbit_activity_sync_at:${window.currentUser.id}`;
        const lastSync = Number(localStorage.getItem(storageKey) || 0);
        if (!force && lastSync && Date.now() - lastSync < FITBIT_CARD_SYNC_COOLDOWN_MS) return 0;
        localStorage.setItem(storageKey, String(Date.now()));

        fitbitImportedActivitySyncInFlight = fetch('/api/fitbit/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: window.currentUser.id })
        }).then(async response => {
            if (!response.ok) throw new Error(`Fitbit sync failed (${response.status})`);
            return response.json();
        }).then(async result => {
            await renderFitbitImportedActivityHomeCard();
            return Number(result?.imported_activities || 0);
        }).catch(error => {
            console.warn('Could not refresh Fitbit activities for the share card:', error);
            return 0;
        }).finally(() => {
            fitbitImportedActivitySyncInFlight = null;
        });

        return fitbitImportedActivitySyncInFlight;
    }

    function bindImportedActivityRefresh() {
        if (window._importedActivityRefreshBound) return;
        window._importedActivityRefreshBound = true;
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible') return;
            renderFitbitImportedActivityHomeCard();
            maybeSyncFitbitImportedActivity();
        });
        window._importedActivityRefreshInterval = setInterval(() => {
            if (document.visibilityState === 'visible') maybeSyncFitbitImportedActivity();
        }, FITBIT_CARD_SYNC_COOLDOWN_MS);
    }

    /**
     * Award 2 XP when the user reaches 10,000 steps in a day.
     * Only fires once per calendar day (tracked via localStorage).
     */
    window.checkStepXpReward = async function checkStepXpReward(steps) {
        if (!steps || steps < 10000) return;
        if (!window.currentUser?.id || !window.supabaseClient) return;

        const today = new Date().toISOString().split('T')[0];
        const storageKey = 'step_xp_awarded_' + today;
        if (localStorage.getItem(storageKey)) return; // already awarded today

        try {
            const { data: currentPoints } = await window.supabaseClient
                .from('user_points')
                .select('lifetime_points')
                .eq('user_id', window.currentUser.id)
                .maybeSingle();

            if (currentPoints) {
                await window.supabaseClient
                    .from('user_points')
                    .update({ lifetime_points: (currentPoints.lifetime_points || 0) + 2 })
                    .eq('user_id', window.currentUser.id);
            } else {
                await window.supabaseClient
                    .from('user_points')
                    .insert({ user_id: window.currentUser.id, lifetime_points: 2, current_points: 0 });
            }

            localStorage.setItem(storageKey, '1');
            if (typeof triggerXPBarRainbow === 'function') triggerXPBarRainbow();
            if (typeof refreshLevelDisplay === 'function') refreshLevelDisplay();
            console.log('[Steps] 10k steps reached — awarded 2 XP');
        } catch (err) {
            console.warn('[Steps] XP award error:', err);
        }
    }

    /**
     * Update the Fitbit display cards with data
     */
    function updateFitbitDisplay(data) {
        // Today's activity
        const todayActivity = data.activity && data.activity[0];
        if (todayActivity) {
            const stepsEl = document.getElementById('fitbit-steps');
            const activeMinsEl = document.getElementById('fitbit-active-mins');
            const caloriesEl = document.getElementById('fitbit-calories');

            if (stepsEl) stepsEl.textContent = (todayActivity.steps || 0).toLocaleString();
            if (activeMinsEl) activeMinsEl.textContent = (todayActivity.active_minutes || 0) + ' min';
            if (caloriesEl) caloriesEl.textContent = (todayActivity.calories_burned || 0).toLocaleString();
            checkStepXpReward(todayActivity.steps);
        }

        // Today's sleep
        const todaySleep = data.sleep && data.sleep[0];
        if (todaySleep) {
            const sleepEl = document.getElementById('fitbit-sleep');
            if (sleepEl) {
                const hours = Math.floor((todaySleep.duration_minutes || 0) / 60);
                const mins = (todaySleep.duration_minutes || 0) % 60;
                sleepEl.textContent = hours + 'h ' + mins + 'm';
            }
        }

        // Today's heart rate
        const todayHR = data.heart_rate && data.heart_rate[0];
        if (todayHR && todayHR.resting_heart_rate) {
            const hrEl = document.getElementById('fitbit-heart-rate');
            if (hrEl) hrEl.textContent = todayHR.resting_heart_rate;
        }

        // Last sync time
        if (data.last_sync) {
            const syncEl = document.getElementById('fitbit-last-sync');
            if (syncEl) {
                const syncDate = new Date(data.last_sync);
                const now = new Date();
                const diffMins = Math.floor((now - syncDate) / 60000);
                let timeAgo;
                if (diffMins < 1) timeAgo = 'Just now';
                else if (diffMins < 60) timeAgo = diffMins + 'm ago';
                else if (diffMins < 1440) timeAgo = Math.floor(diffMins / 60) + 'h ago';
                else timeAgo = Math.floor(diffMins / 1440) + 'd ago';
                syncEl.textContent = 'Last synced ' + timeAgo;
            }
        }
    }

    /**
     * Connect or disconnect Fitbit
     */
    function toggleFitbitConnection() {
        if (!window.currentUser) return;

        const btn = document.getElementById('fitbit-connect-btn');
        if (btn && btn.textContent.trim() === 'Disconnect') {
            // Disconnect
            if (confirm('Disconnect your Fitbit? Your synced data will remain.')) {
                btn.textContent = '...';
                btn.disabled = true;
                fetch('/api/fitbit/disconnect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: window.currentUser.id }),
                }).then(() => {
                    btn.textContent = 'Connect';
                    btn.style.background = '#00B0B9';
                    btn.disabled = false;
                    const statusText = document.getElementById('fitbit-status-text');
                    if (statusText) statusText.textContent = 'Sync steps, sleep & heart rate';
                    const card = document.getElementById('fitbit-dashboard-card');
                    if (card) card.style.display = 'none';
                }).catch(() => {
                    btn.textContent = 'Disconnect';
                    btn.disabled = false;
                    alert('Failed to disconnect. Please try again.');
                });
            }
        } else {
            // Connect - redirect to Fitbit OAuth
            window.location.href = '/api/fitbit/auth?user_id=' + window.currentUser.id;
        }
    }

    /**
     * Manual sync button
     */
    function syncFitbitNow() {
        if (!window.currentUser) return;

        const btn = document.getElementById('fitbit-sync-btn');
        if (btn) {
            btn.style.opacity = '0.5';
            btn.style.pointerEvents = 'none';
        }

        maybeSyncFitbitImportedActivity(true).then(syncResult => {
            // Refresh display
            return fetch('/api/fitbit/data?user_id=' + window.currentUser.id).then(r => r.json()).then(data => ({ data, syncResult }));
        }).then(({ data, syncResult }) => {
            if (data.connected) updateFitbitDisplay(data);
            if (Number(syncResult || 0) > 0 && typeof showToast === 'function') {
                showToast('Your activity is ready to share on Dashboard', 'success');
            }
            // Refresh challenge progress (steps/sleep challenges may use Fitbit data)
            if (typeof refreshChallengeProgress === 'function') refreshChallengeProgress();
        }).catch(err => {
            console.warn('Fitbit sync error:', err);
        }).finally(() => {
            if (btn) {
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
            }
        });
    }

    /**
     * Handle Fitbit OAuth redirect results
     */
    function checkFitbitOAuthResult() {
        const params = new URLSearchParams(window.location.search);
        const fitbitResult = params.get('fitbit');

        if (fitbitResult) {
            // Clean URL
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, '', cleanUrl);

            if (fitbitResult === 'connected') {
                // Show success message
                const toast = document.createElement('div');
                toast.style.cssText = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); background:#10b981; color:white; padding:14px 24px; border-radius:12px; font-weight:600; z-index:99999; box-shadow:0 4px 12px rgba(0,0,0,0.15); font-size:0.9rem;';
                toast.textContent = 'Fitbit connected! Syncing your data...';
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 4000);

                // Refresh Fitbit data
                setTimeout(() => initFitbitDashboard(), 2000);
            } else if (fitbitResult === 'denied') {
                alert('Fitbit connection was cancelled. You can connect anytime from Settings.');
            } else if (fitbitResult === 'error') {
                alert('There was a problem connecting to Fitbit. Please try again.');
            }
        }
    }

    // Make functions globally available
    window.toggleFitbitConnection = toggleFitbitConnection;
    window.syncFitbitNow = syncFitbitNow;
    window.initFitbitDashboard = initFitbitDashboard;
    window.renderFitbitImportedActivityHomeCard = renderFitbitImportedActivityHomeCard;
    window.refreshImportedActivityHomeCard = renderFitbitImportedActivityHomeCard;
    window.maybeSyncFitbitImportedActivity = maybeSyncFitbitImportedActivity;
    bindImportedActivityRefresh();

    // Check OAuth result on page load
    checkFitbitOAuthResult();
