// ===== DAILY WEIGH-IN CARD LOGIC =====

    /**
     * Check if user has weighed in today and show/hide card accordingly
     */
    async function checkAndShowWeighInCard() {
        if (!window.currentUser) return;

        // Don't show weigh-in card if onboarding wizard is active or pending
        if (window._onboardingWizardPending) return;
        const wizard = document.getElementById('onboarding-wizard');
        if (wizard && wizard.style.display !== 'none') return;

        try {
            const todaysWeighIn = await db.weighIns.getTodaysWeighIn(window.currentUser.id);
            const card = document.getElementById('daily-weigh-in-card');
            const doneCard = document.getElementById('daily-weigh-in-done-card');

            if (card) {
                ensureFridayWeighInCardStyles();
                if (todaysWeighIn) {
                    syncNativeWeighInWidgetStatus(true, todaysWeighIn.weight_kg, todaysWeighIn.weight_kg);
                    const rewardPayload = await handlePostWeighInRewards(todaysWeighIn, { silent: true, source: 'existing', inlineShare: true });

                    // Already weighed in today - hide input card, show done card (unless dismissed)
                    card.style.display = 'none';
                    if (doneCard) {
                        const today = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];
                        const isDismissedLocal = localStorage.getItem('weighInDoneCardDismissedDate') === today;
                        const isDismissedCloud = (window._pbbDismissedDates && window._pbbDismissedDates['weighInDoneCard']) === today;
                        
                        if (isDismissedLocal || isDismissedCloud) {
                            doneCard.style.display = 'none';
                            if (isDismissedCloud && !isDismissedLocal) {
                                try { localStorage.setItem('weighInDoneCardDismissedDate', today); } catch(e) {}
                            }
                        } else {
                            showDailyWeighInDoneCard(rewardPayload);
                        }
                    }
                } else {
                    // Show the card for today's weigh-in
                    resetDailyWeighInCardVisualState();
                    if (isFridayWeighInDay()) {
                        applyFridayWeighInCardVisualState();
                    }
                    card.style.display = 'block';
                    if (doneCard) doneCard.style.display = 'none';

                    // Pre-fill with last known weight if available
                    const latestWeighIn = await db.weighIns.getLatest(window.currentUser.id);
                    if (latestWeighIn) {
                        syncNativeWeighInWidgetStatus(false, latestWeighIn.weight_kg, latestWeighIn.weight_kg);
                        const input = document.getElementById('weigh-in-weight-input');
                        if (input) input.placeholder = `Last: ${latestWeighIn.weight_kg} kg`;
                    } else if (window.userProfile && window.userProfile.weight) {
                        syncNativeWeighInWidgetStatus(false, window.userProfile.weight, window.userProfile.weight);
                    }

                    // Check user's preferred unit and update label
                    updateWeighInUnitLabel();
                }
            }
        } catch (error) {
            console.error('Error checking weigh-in status:', error);
        }
    }

    function syncNativeWeighInWidgetStatus(loggedToday, latestWeightKg, todayWeightKg) {
        try {
            var latest = parseFloat(latestWeightKg);
            var todayWeight = parseFloat(todayWeightKg);
            if (!isFinite(latest) || latest <= 0) return;
            if (!isFinite(todayWeight) || todayWeight <= 0) todayWeight = latest;
            var today = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];
            var payload = JSON.stringify({
                date: today,
                loggedToday: !!loggedToday,
                latestWeightKg: latest,
                todayWeightKg: todayWeight,
                updatedAt: Date.now()
            });

            if (window.NativePermissions && typeof window.NativePermissions.setWeighInWidgetStatus === 'function') {
                window.NativePermissions.setWeighInWidgetStatus(payload);
            }

            var cap = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BalanceNutritionWidget;
            if (cap && typeof cap.saveWeighInSnapshot === 'function') {
                cap.saveWeighInSnapshot({ json: payload }).catch(function(err) {
                    console.warn('Weigh-in widget snapshot failed:', err);
                });
            }
        } catch (e) {
            console.warn('Could not sync weigh-in widget status:', e);
        }
    }

    function isFridayWeighInDay(date = new Date()) {
        return date.getDay() === 5;
    }

    function ensureFridayWeighInCardStyles() {
        if (document.getElementById('friday-weigh-in-card-styles')) return;
        const style = document.createElement('style');
        style.id = 'friday-weigh-in-card-styles';
        style.textContent = `
            @keyframes pbbFridayWeighBoardShift {
                0% { background-position: 0% 50%; }
                45% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }
            @keyframes pbbFridayWeighGlow {
                0%, 100% { transform: scale(1); opacity: 0.45; }
                50% { transform: scale(1.08); opacity: 0.78; }
            }
            #daily-weigh-in-card.pbb-friday-weigh-card {
                background: linear-gradient(120deg, #0f172a, #0369a1, #14b8a6, #84cc16, #0f172a) !important;
                background-size: 320% 320% !important;
                animation: pbbFridayWeighBoardShift 3.8s ease-in-out infinite !important;
                border: 1px solid rgba(255,255,255,0.28) !important;
                box-shadow: 0 10px 32px rgba(14,165,233,0.28), inset 0 1px 0 rgba(255,255,255,0.2) !important;
            }
            #daily-weigh-in-card.pbb-friday-weigh-card::after {
                content: 'FRIDAY';
                position: absolute;
                right: 18px;
                bottom: 14px;
                font-size: 2.4rem;
                font-weight: 950;
                letter-spacing: 0.05em;
                color: rgba(255,255,255,0.09);
                pointer-events: none;
            }
            #daily-weigh-in-card.pbb-friday-weigh-card > div:first-child {
                animation: pbbFridayWeighGlow 2.4s ease-in-out infinite;
            }
            #daily-weigh-in-done-card.pbb-friday-share-card {
                background: linear-gradient(135deg, #0f172a 0%, #075985 48%, #0f766e 100%) !important;
                border: 1px solid rgba(125,211,252,0.34);
                box-shadow: 0 10px 30px rgba(14,165,233,0.22);
                align-items: stretch !important;
            }
            #daily-weigh-in-done-card.pbb-friday-shared-card {
                background: linear-gradient(135deg, #064e3b 0%, #0f766e 55%, #0f172a 100%) !important;
                border: 1px solid rgba(134,239,172,0.34);
            }
        `;
        document.head.appendChild(style);
    }

    function setTextContent(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function resetDailyWeighInCardVisualState() {
        const card = document.getElementById('daily-weigh-in-card');
        if (card) card.classList.remove('pbb-friday-weigh-card');
        const subtitle = document.getElementById('weigh-in-card-subtitle');
        if (subtitle) subtitle.style.display = '';
        const xpBadge = document.getElementById('weigh-in-xp-badge');
        if (xpBadge) xpBadge.style.display = '';
        setTextContent('weigh-in-card-title', 'Daily Weigh-In');
        setTextContent('weigh-in-card-subtitle', 'Track your progress, earn XP!');
        setTextContent('weigh-in-xp-badge', '+1 XP');
        setTextContent('weigh-in-submit-btn', 'Log It');
        setTextContent('weigh-in-success-xp', '+1 XP');
        setTextContent('weigh-in-success-copy', 'Weigh-in complete!');
        const submitBtn = document.getElementById('weigh-in-submit-btn');
        if (submitBtn) submitBtn.style.color = '#667eea';
    }

    function applyFridayWeighInCardVisualState() {
        const card = document.getElementById('daily-weigh-in-card');
        if (card) card.classList.add('pbb-friday-weigh-card');
        const subtitle = document.getElementById('weigh-in-card-subtitle');
        if (subtitle) subtitle.style.display = 'none';
        const xpBadge = document.getElementById('weigh-in-xp-badge');
        if (xpBadge) xpBadge.style.display = 'none';
        setTextContent('weigh-in-card-title', 'Friday Weigh-Ins');
        setTextContent('weigh-in-card-subtitle', '');
        setTextContent('weigh-in-xp-badge', '');
        setTextContent('weigh-in-submit-btn', 'Weigh In');
        setTextContent('weigh-in-success-xp', 'Weigh-in logged');
        setTextContent('weigh-in-success-copy', 'Now add it to the challenge chat.');
        const submitBtn = document.getElementById('weigh-in-submit-btn');
        if (submitBtn) submitBtn.style.color = '#075985';
    }

    function renderStandardWeighInDoneCard() {
        const doneCard = document.getElementById('daily-weigh-in-done-card');
        if (!doneCard) return;
        doneCard.classList.remove('pbb-friday-share-card', 'pbb-friday-shared-card');
        doneCard.style.display = 'flex';
        doneCard.style.alignItems = 'center';
        doneCard.style.gap = '15px';
        doneCard.innerHTML = `
            <button id="weigh-in-done-close" onclick="dismissWeighInDoneCard()" style="position: absolute; top: 8px; right: 8px; background: rgba(255,255,255,0.2); border: none; color: white; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; line-height: 1; padding: 0;">&#x2715;</button>
            <div id="weigh-in-done-icon" style="width: 44px; height: 44px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; line-height: 1; overflow: hidden; flex-shrink: 0;">&#x2705;</div>
            <div style="flex: 1;">
                <div id="weigh-in-done-title" style="font-weight: 700; font-size: 1rem;">Weigh-In Complete!</div>
                <div id="weigh-in-done-subtitle" style="font-size: 0.82rem; opacity: 0.9; margin-top: 2px;">+1 XP earned. Come back tomorrow!</div>
            </div>
        `;
    }

    function shouldShowFridayShareCard(payload) {
        if (!payload || !payload.is_friday || !payload.active_challenge || !payload.chat_id || payload.share_already_posted) return false;
        const weighInId = payload.weigh_in_id;
        if (!weighInId) return false;
        const dismissed = localStorage.getItem(getFridayWeighStorageKey('fridayWeighShareDismissed_', weighInId));
        const posted = localStorage.getItem(getFridayWeighStorageKey('fridayWeighSharePosted_', weighInId));
        return !dismissed && !posted;
    }

    function renderFridaySharePromptCard(payload) {
        const doneCard = document.getElementById('daily-weigh-in-done-card');
        if (!doneCard || !payload) return;
        window._pendingFridayWeighShare = payload;
        const previous = parseFloat(payload.previous_weight_kg);
        const change = parseFloat(payload.change_kg);
        const weight = formatWeightForPreference(payload.weight_kg);
        const lost = payload.lost_weight || Number(payload.loss_points_awarded || 0) > 0;
        let changeCopy = 'First Friday marker for this challenge.';
        if (isFinite(previous) && isFinite(change)) {
            const abs = Math.abs(change).toFixed(1);
            if (change < 0) changeCopy = `Down ${abs} kg from last Friday.`;
            else if (change > 0) changeCopy = `Up ${abs} kg from last Friday.`;
            else changeCopy = 'Steady from last Friday.';
        }
        doneCard.classList.remove('pbb-friday-shared-card');
        doneCard.classList.add('pbb-friday-share-card');
        doneCard.style.display = 'flex';
        doneCard.style.gap = '0';
        doneCard.innerHTML = `
            <div style="width:100%;">
                <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:12px;">
                    <div>
                        <div style="font-size:0.66rem; color:rgba(186,230,253,0.9); text-transform:uppercase; letter-spacing:0.12em; font-weight:900; margin-bottom:4px;">Friday weigh-in</div>
                        <div style="font-size:1.05rem; font-weight:900; color:white;">Add to group chat?</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.16); border:1px solid rgba(255,255,255,0.18); border-radius:12px; padding:8px 10px; text-align:right; flex-shrink:0;">
                        <div style="font-size:1.25rem; line-height:1; font-weight:950; color:white;">${escapeWeighInHtml(weight)}</div>
                        <div style="font-size:0.68rem; opacity:0.78; margin-top:3px;">logged</div>
                    </div>
                </div>
                <div style="display:flex; gap:7px; flex-wrap:wrap; margin-bottom:12px;">
                    <span style="background:${lost ? 'rgba(22,163,74,0.22)' : 'rgba(255,255,255,0.12)'}; color:${lost ? '#bbf7d0' : 'rgba(255,255,255,0.82)'}; border:1px solid ${lost ? 'rgba(134,239,172,0.34)' : 'rgba(255,255,255,0.15)'}; padding:6px 9px; border-radius:999px; font-size:0.72rem; font-weight:850;">+10 XP if down from last Friday</span>
                    <span style="background:rgba(59,130,246,0.24); color:#dbeafe; border:1px solid rgba(147,197,253,0.34); padding:6px 9px; border-radius:999px; font-size:0.72rem; font-weight:850;">+2 XP for sharing</span>
                </div>
                <div style="font-size:0.83rem; color:rgba(255,255,255,0.78); line-height:1.35; margin-bottom:13px;">${escapeWeighInHtml(changeCopy)} Tap yes to review the share card before anything posts to ${escapeWeighInHtml(payload.chat_name || 'the challenge chat')}.</div>
                <div style="display:grid; grid-template-columns:1fr auto; gap:9px;">
                    <button onclick="openFridayWeighInShareCard()" style="min-height:42px; border:none; border-radius:12px; background:white; color:#075985; font-size:0.86rem; font-weight:900; cursor:pointer;">Yes, review card</button>
                    <button onclick="dismissFridayWeighInShare()" style="min-height:42px; border:1px solid rgba(255,255,255,0.18); border-radius:12px; background:rgba(255,255,255,0.1); color:white; font-size:0.82rem; font-weight:800; cursor:pointer; padding:0 12px;">Not today</button>
                </div>
            </div>
        `;
    }

    function openFridayWeighInShareCard() {
        const payload = window._pendingFridayWeighShare;
        if (!payload || !payload.weigh_in_id) return;
        showFridayWeighInSharePrompt(payload);
    }

    function renderFridaySharedDoneCard(data) {
        const doneCard = document.getElementById('daily-weigh-in-done-card');
        if (!doneCard) return;
        doneCard.classList.remove('pbb-friday-share-card');
        doneCard.classList.add('pbb-friday-shared-card');
        doneCard.style.display = 'flex';
        doneCard.style.gap = '12px';
        doneCard.innerHTML = `
            <button onclick="dismissWeighInDoneCard()" style="position:absolute; top:8px; right:8px; background:rgba(255,255,255,0.18); border:none; color:white; width:24px; height:24px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:14px; line-height:1; padding:0;">&#x2715;</button>
            <div style="width:44px; height:44px; background:rgba(255,255,255,0.18); border-radius:14px; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:0.9rem; font-weight:950;">FRI</div>
            <div style="flex:1; min-width:0; padding-right:18px;">
                <div style="font-weight:900; font-size:1rem; color:white;">Posted to group chat</div>
                <div style="font-size:0.82rem; opacity:0.9; margin-top:2px;">${Number(data?.share_points_awarded || 0) > 0 ? '+2 XP for sharing. ' : ''}Friday weigh-in posted.</div>
            </div>
        `;
    }

    function showDailyWeighInDoneCard(payload) {
        if (shouldShowFridayShareCard(payload)) renderFridaySharePromptCard(payload);
        else renderStandardWeighInDoneCard();
    }

    function escapeWeighInHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getFridayWeighStorageKey(prefix, weighInId) {
        return prefix + String(weighInId || '');
    }

    function formatWeighInNumber(value) {
        const num = parseFloat(value);
        if (!isFinite(num)) return '--';
        return (Math.round(num * 10) / 10).toFixed(1);
    }

    function formatWeightForPreference(weightKg) {
        const kg = parseFloat(weightKg);
        if (!isFinite(kg)) return '--';
        const preferLbs = localStorage.getItem('weightUnitPreference') === 'lbs';
        if (preferLbs) return formatWeighInNumber(kg * 2.20462) + ' lbs';
        return formatWeighInNumber(kg) + ' kg';
    }

    function showWeighRewardToast(message, type) {
        if (!message) return;
        if (typeof showToast === 'function') showToast(message, type || 'success');
        else if (typeof showWearableToast === 'function') showWearableToast(message);
        else console.log(message);
    }

    function isMissingFridayWeighRpc(error) {
        const msg = String(error && (error.message || error.details || error.hint || error) || '').toLowerCase();
        return msg.includes('handle_friday_weigh_in_rewards') || msg.includes('function') && msg.includes('does not exist');
    }

    async function awardDailyWeighInFallback(weighIn) {
        if (!weighIn || !weighIn.id || !window.currentUser || !window.supabaseClient) return null;
        const fallbackKey = getFridayWeighStorageKey('weighInXpFallback_', weighIn.id);
        if (localStorage.getItem(fallbackKey)) return null;

        const xpAmount = typeof getXPMultiplier === 'function' ? await getXPMultiplier() : 1;
        const { data: currentPoints } = await window.supabaseClient
            .from('user_points')
            .select('current_points,lifetime_points')
            .eq('user_id', window.currentUser.id)
            .maybeSingle();

        if (currentPoints) {
            await window.supabaseClient
                .from('user_points')
                .update({
                    current_points: (currentPoints.current_points || 0) + xpAmount,
                    lifetime_points: (currentPoints.lifetime_points || 0) + xpAmount
                })
                .eq('user_id', window.currentUser.id);
        } else {
            await window.supabaseClient
                .from('user_points')
                .insert({ user_id: window.currentUser.id, current_points: xpAmount, lifetime_points: xpAmount });
        }

        try {
            await window.supabaseClient.rpc('update_challenge_participant_points', { user_uuid: window.currentUser.id });
        } catch (e) {
            console.warn('Could not refresh challenge points after weigh-in fallback:', e);
        }

        localStorage.setItem(fallbackKey, '1');
        return { total_points_awarded: xpAmount, daily_points_awarded: xpAmount };
    }

    async function refreshAfterWeighRewards() {
        if (typeof refreshPointsDisplay === 'function') refreshPointsDisplay();
        if (typeof refreshLevelDisplay === 'function') refreshLevelDisplay();
        if (typeof refreshChallengeProgress === 'function') refreshChallengeProgress();
        if (typeof triggerXPBarRainbow === 'function') triggerXPBarRainbow();
    }

    async function handlePostWeighInRewards(weighIn, options = {}) {
        if (!weighIn || !weighIn.id || !window.currentUser || !window.supabaseClient) return null;

        const weighInId = String(weighIn.id);
        window._pbbWeighRewardInFlight = window._pbbWeighRewardInFlight || {};
        if (window._pbbWeighRewardInFlight[weighInId]) return window._pbbWeighRewardInFlight[weighInId];

        const work = (async function() {
            let payload = null;

            try {
                const { data, error } = await window.supabaseClient.rpc('handle_friday_weigh_in_rewards', {
                    p_weigh_in_id: weighIn.id
                });
                if (error) throw error;
                payload = data;
            } catch (error) {
                if (!isMissingFridayWeighRpc(error)) {
                    console.warn('Friday weigh-in reward check failed:', error);
                    return null;
                }
                payload = await awardDailyWeighInFallback(weighIn);
            }

            if (!payload || payload.ok === false) return payload;

            const awarded = Number(payload.total_points_awarded || 0);
            if (awarded > 0) {
                await refreshAfterWeighRewards();
                if (!options.silent) {
                    const loss = Number(payload.loss_points_awarded || 0);
                    const daily = Number(payload.daily_points_awarded || 0);
                    if (loss > 0) showWeighRewardToast(`+${daily + loss} XP for Friday weigh-in progress`, 'success');
                    else showWeighRewardToast(`+${awarded} XP for your weigh-in`, 'success');
                }
            }

            if (payload.is_friday && payload.active_challenge && payload.chat_id && !payload.share_already_posted) {
                const dismissed = localStorage.getItem(getFridayWeighStorageKey('fridayWeighShareDismissed_', weighIn.id));
                const posted = localStorage.getItem(getFridayWeighStorageKey('fridayWeighSharePosted_', weighIn.id));
                if (!dismissed && !posted) {
                    if (options.inlineShare) window._pendingFridayWeighShare = payload;
                    else showFridayWeighInSharePrompt(payload);
                }
            }

            return payload;
        })();

        window._pbbWeighRewardInFlight[weighInId] = work;
        try {
            return await work;
        } finally {
            delete window._pbbWeighRewardInFlight[weighInId];
        }
    }

    function ensureFridayWeighInShareModal() {
        let modal = document.getElementById('friday-weigh-share-modal');
        if (modal) return modal;

        document.body.insertAdjacentHTML('beforeend', `
            <div id="friday-weigh-share-modal" style="display:none; position:fixed; inset:0; z-index:10080; background:rgba(15,23,42,0.72); align-items:center; justify-content:center; padding:calc(18px + env(safe-area-inset-top, 0px)) 18px calc(18px + env(safe-area-inset-bottom, 0px)); box-sizing:border-box;">
                <div style="width:100%; max-width:390px; max-height:100%; overflow-y:auto; -webkit-overflow-scrolling:touch; background:white; border-radius:18px; box-shadow:0 24px 70px rgba(0,0,0,0.35); padding:20px; box-sizing:border-box;">
                    <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:14px;">
                        <div>
                            <div style="font-size:0.72rem; font-weight:800; letter-spacing:0; text-transform:uppercase; color:#2563eb; margin-bottom:4px;">Friday weigh-in</div>
                            <h3 style="margin:0; color:#111827; font-size:1.25rem; line-height:1.2; font-weight:850;">Put it on the board?</h3>
                        </div>
                        <button onclick="closeFridayWeighInShareCard()" title="Close" style="width:34px; height:34px; border:none; border-radius:50%; background:#f1f5f9; color:#334155; font-size:1.2rem; cursor:pointer; line-height:1;">&times;</button>
                    </div>
                    <div id="friday-weigh-share-weight" style="font-size:2rem; font-weight:900; color:#0f172a; line-height:1; margin-bottom:6px;"></div>
                    <div id="friday-weigh-share-detail" style="font-size:0.92rem; color:#475569; line-height:1.45; margin-bottom:14px;"></div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">
                        <span id="friday-weigh-loss-chip" style="background:#dcfce7; color:#166534; border:1px solid #86efac; padding:6px 10px; border-radius:999px; font-size:0.78rem; font-weight:800;">+10 XP if down from last Friday</span>
                        <span style="background:#dbeafe; color:#1d4ed8; border:1px solid #93c5fd; padding:6px 10px; border-radius:999px; font-size:0.78rem; font-weight:800;">+2 XP for posting</span>
                    </div>
                    <div style="font-size:0.86rem; color:#64748b; line-height:1.45; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:12px; margin-bottom:16px;">
                        The challenge chat can tap your weight to see your trend graph for the last month, 3 months, or 6 months.
                    </div>
                    <div style="display:grid; grid-template-columns:1fr; gap:10px;">
                        <button id="friday-weigh-share-post-btn" onclick="postFridayWeighInShare()" style="width:100%; border:none; border-radius:12px; background:#2563eb; color:white; padding:13px 14px; font-weight:850; font-size:0.95rem; cursor:pointer;">Post to challenge chat</button>
                        <button onclick="dismissFridayWeighInShare()" style="width:100%; border:1px solid #e2e8f0; border-radius:12px; background:white; color:#475569; padding:12px 14px; font-weight:750; font-size:0.9rem; cursor:pointer;">Not today</button>
                    </div>
                </div>
            </div>
        `);

        return document.getElementById('friday-weigh-share-modal');
    }

    function showFridayWeighInSharePrompt(payload) {
        if (!payload || !payload.weigh_in_id) return;
        const modal = ensureFridayWeighInShareModal();
        if (!modal) return;

        window._pendingFridayWeighShare = payload;

        const weightEl = document.getElementById('friday-weigh-share-weight');
        const detailEl = document.getElementById('friday-weigh-share-detail');
        const lossChip = document.getElementById('friday-weigh-loss-chip');
        const postBtn = document.getElementById('friday-weigh-share-post-btn');

        if (weightEl) weightEl.textContent = formatWeightForPreference(payload.weight_kg);

        const previous = parseFloat(payload.previous_weight_kg);
        const change = parseFloat(payload.change_kg);
        let detail = `Post this in ${payload.chat_name || 'the challenge chat'} and keep Friday weigh-ins moving.`;
        if (isFinite(previous) && isFinite(change)) {
            const abs = Math.abs(change).toFixed(1);
            if (change < 0) detail = `Down ${abs} kg from last Friday. Post it in ${payload.chat_name || 'the challenge chat'}?`;
            else if (change > 0) detail = `Up ${abs} kg from last Friday. Still worth posting.`;
            else detail = `Steady from last Friday. Still counts for showing up.`;
        } else {
            detail = `First Friday marker for this run. Post the starting point in ${payload.chat_name || 'the challenge chat'}?`;
        }
        if (detailEl) detailEl.textContent = detail;

        const lossAwarded = Number(payload.loss_points_awarded || 0);
        if (lossChip) {
            lossChip.style.display = 'inline-flex';
            lossChip.textContent = lossAwarded > 0 ? `+${lossAwarded} XP for moving down from last Friday` : '+10 XP if down from last Friday';
        }

        if (postBtn) {
            postBtn.disabled = false;
            postBtn.textContent = `Post to ${payload.chat_name || 'challenge chat'} (+2 XP)`;
        }

        modal.style.display = 'flex';
    }

    function closeFridayWeighInShareCard() {
        const modal = document.getElementById('friday-weigh-share-modal');
        if (modal) modal.style.display = 'none';
        const payload = window._pendingFridayWeighShare;
        if (payload && shouldShowFridayShareCard(payload)) renderFridaySharePromptCard(payload);
    }

    function dismissFridayWeighInShare() {
        const payload = window._pendingFridayWeighShare;
        if (payload && payload.weigh_in_id) {
            localStorage.setItem(getFridayWeighStorageKey('fridayWeighShareDismissed_', payload.weigh_in_id), '1');
        }
        const modal = document.getElementById('friday-weigh-share-modal');
        if (modal) modal.style.display = 'none';
        window._pendingFridayWeighShare = null;
        renderStandardWeighInDoneCard();
    }

    async function postFridayWeighInShare() {
        const payload = window._pendingFridayWeighShare;
        if (!payload || !payload.weigh_in_id || !window.supabaseClient) return;

        const postBtn = document.getElementById('friday-weigh-share-post-btn');
        if (postBtn) {
            postBtn.disabled = true;
            postBtn.textContent = 'Posting...';
        }

        try {
            const { data, error } = await window.supabaseClient.rpc('post_friday_weigh_in_to_challenge_chat', {
                p_weigh_in_id: payload.weigh_in_id
            });
            if (error) throw error;
            if (!data || data.ok === false) throw new Error(data?.error || 'Could not post weigh-in');

            localStorage.setItem(getFridayWeighStorageKey('fridayWeighSharePosted_', payload.weigh_in_id), '1');
            const modal = document.getElementById('friday-weigh-share-modal');
            if (modal) modal.style.display = 'none';
            renderFridaySharedDoneCard(data);
            window._pendingFridayWeighShare = null;

            await refreshAfterWeighRewards();
            if (typeof loadGroupChats === 'function') loadGroupChats();

            const sharePoints = Number(data.share_points_awarded || 0);
            showWeighRewardToast(sharePoints > 0 ? `Posted to challenge chat. +${sharePoints} XP` : 'Friday weigh-in already posted', 'success');

            if (data.chat_id && typeof openGroupChat === 'function') {
                openGroupChat(data.chat_id, data.chat_name || '30 Day Challenge Chat', 'Challenge group');
            }
        } catch (error) {
            console.error('Friday weigh-in share failed:', error);
            showWeighRewardToast('Could not post Friday weigh-in. Try again.', 'error');
            if (postBtn) {
                postBtn.disabled = false;
                postBtn.textContent = `Post to ${payload.chat_name || 'challenge chat'} (+2 XP)`;
            }
        }
    }

    /**
     * Update the unit label based on user preference
     */
    function updateWeighInUnitLabel() {
        const unitLabel = document.getElementById('weigh-in-unit-label');
        const input = document.getElementById('weigh-in-weight-input');

        // Check if user prefers lbs (from localStorage or user settings)
        const preferLbs = localStorage.getItem('weightUnitPreference') === 'lbs';

        if (unitLabel && input) {
            if (preferLbs) {
                unitLabel.textContent = 'lbs';
                input.step = '1';
            } else {
                unitLabel.textContent = 'kg';
                input.step = '0.1';
            }
        }
    }

    /**
     * Submit the daily weigh-in
     */
    async function submitDailyWeighIn() {
        if (!window.currentUser) {
            alert('Please log in to track your weight.');
            return;
        }

        const input = document.getElementById('weigh-in-weight-input');
        const inputSection = document.getElementById('weigh-in-input-section');
        const successSection = document.getElementById('weigh-in-success-section');
        const card = document.getElementById('daily-weigh-in-card');

        let weightValue = parseFloat(input?.value);

        if (!weightValue || weightValue < 20 || weightValue > 500) {
            alert('Please enter a valid weight.');
            return;
        }

        // Convert lbs to kg if needed
        const preferLbs = localStorage.getItem('weightUnitPreference') === 'lbs';
        if (preferLbs) {
            weightValue = weightValue * 0.453592; // Convert lbs to kg
        }

        try {
            // Log the weigh-in
            const weighIn = await db.weighIns.log(window.currentUser.id, weightValue);
            syncNativeWeighInWidgetStatus(true, weightValue, weightValue);
            const rewardPayload = await handlePostWeighInRewards(weighIn, { source: 'home-card', inlineShare: true });

            // Show success animation
            if (inputSection) inputSection.style.display = 'none';
            if (successSection) successSection.style.display = 'block';

            // Update user's current weight in profile
            try {
                await db.users.update(window.currentUser.id, { weight: weightValue });

                // Update the profile weight display element live
                const profileWeightEl = document.getElementById('profile-weight-display');
                if (profileWeightEl) {
                    const displayWeight = preferLbs
                        ? (weightValue / 0.453592).toFixed(1) + ' lbs'
                        : weightValue.toFixed(1) + ' kg';
                    profileWeightEl.innerText = displayWeight;
                }

                // Keep in-memory profile cache in sync
                if (window.userProfile) window.userProfile.weight = weightValue;
            } catch (updateError) {
                console.log('Profile weight update skipped:', updateError);
            }

            // Hide input card after 2 seconds and show done card
            setTimeout(() => {
                if (card) {
                    card.style.transition = 'opacity 0.5s, transform 0.5s';
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(-20px)';
                    setTimeout(() => {
                        card.style.display = 'none';
                        // Reset for next day
                        card.style.opacity = '1';
                        card.style.transform = 'translateY(0)';
                        if (inputSection) inputSection.style.display = 'flex';
                        if (successSection) successSection.style.display = 'none';
                        if (input) input.value = '';
                        // Show the completed card
                        const doneCard = document.getElementById('daily-weigh-in-done-card');
                        if (doneCard) showDailyWeighInDoneCard(rewardPayload);
                    }, 500);
                }
            }, 2000);

            // Refresh points display if visible
            if (typeof refreshPointsDisplay === 'function') {
                refreshPointsDisplay();
            }

            // Update weight_loss challenge progress
            if (typeof refreshChallengeProgress === 'function') {
                refreshChallengeProgress();
            }

        } catch (error) {
            console.error('Error logging weigh-in:', error);
            alert('Failed to log weigh-in. Please try again.');
        }
    }

    function dismissWeighInDoneCard() {
        const today = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];
        try {
            localStorage.setItem('weighInDoneCardDismissedDate', today);
        } catch (e) { console.warn('localStorage full', e); }
        
        // Sync to cloud
        if (typeof window.syncTrendDismissalToDb === 'function') {
            window.syncTrendDismissalToDb('weighInDoneCard', today);
        }

        const el = document.getElementById('daily-weigh-in-done-card');
        if (el) el.style.display = 'none';
    }

    // Make functions globally available
    window.dismissWeighInDoneCard = dismissWeighInDoneCard;
    window.submitDailyWeighIn = submitDailyWeighIn;
    window.checkAndShowWeighInCard = checkAndShowWeighInCard;
    window.handlePostWeighInRewards = handlePostWeighInRewards;
    window.openFridayWeighInShareCard = openFridayWeighInShareCard;
    window.closeFridayWeighInShareCard = closeFridayWeighInShareCard;
    window.dismissFridayWeighInShare = dismissFridayWeighInShare;
    window.postFridayWeighInShare = postFridayWeighInShare;

    // ===== FITNESS DIARY CARD (Daily from 6 PM) =====

    window._fitnessDiaryData = { day_rating: null, energy_level: null };

    function getTodayDateKey() {
        var d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    }

    async function checkAndShowFitnessDiaryCard() {
        if (!window.currentUser) return;
        // Don't show if onboarding wizard is active
        if (window._onboardingWizardPending) return;
        var wizard = document.getElementById('onboarding-wizard');
        if (wizard && wizard.style.display !== 'none') return;

        var card = document.getElementById('fitness-diary-card');
        var doneCard = document.getElementById('fitness-diary-done-card');
        if (!card) return;

        // Only show from 6 PM onwards
        var now = new Date();
        if (now.getHours() < 18) {
            card.style.display = 'none';
            if (doneCard) doneCard.style.display = 'none';
            return;
        }

        // Check if already completed today
        var dateKey = getTodayDateKey();
        var lsKey = 'fitnessDiaryDone_' + dateKey;

        if (localStorage.getItem(lsKey)) {
            // Already done — show done card (unless dismissed)
            card.style.display = 'none';
            if (doneCard) {
                var dismissKey = 'fitnessDiaryDoneDismissed_' + dateKey;
                doneCard.style.display = localStorage.getItem(dismissKey) ? 'none' : 'flex';
            }
            return;
        }

        // Show the diary card
        card.style.display = 'block';
        if (doneCard) doneCard.style.display = 'none';

        // Reset form state
        var collapsed = document.getElementById('fitness-diary-collapsed');
        var form = document.getElementById('fitness-diary-form');
        var success = document.getElementById('fitness-diary-success');
        if (collapsed) collapsed.style.display = 'flex';
        if (form) form.style.display = 'none';
        if (success) success.style.display = 'none';
        window._fitnessDiaryData = { day_rating: null, energy_level: null };
    }

    // Backwards compatibility alias
    window.checkAndShowWeeklyCheckinCard = checkAndShowFitnessDiaryCard;

    function expandFitnessDiary() {
        var collapsed = document.getElementById('fitness-diary-collapsed');
        var form = document.getElementById('fitness-diary-form');
        if (collapsed) collapsed.style.display = 'none';
        if (form) form.style.display = 'block';
    }

    function selectFitnessDiaryOption(group, value, el) {
        window._fitnessDiaryData[group] = value;
        var chips = document.querySelectorAll('.wcheckin-chip[data-group="' + group + '"]');
        chips.forEach(function(c) {
            c.style.background = 'rgba(255,255,255,0.15)';
            c.style.borderColor = 'transparent';
            c.style.fontWeight = '400';
        });
        el.style.background = 'rgba(255,255,255,0.35)';
        el.style.borderColor = 'white';
        el.style.fontWeight = '700';
    }

    async function submitFitnessDiary() {
        if (!window.currentUser) return;

        if (!window._fitnessDiaryData.day_rating) {
            alert('Please select how your day felt!');
            return;
        }

        var form = document.getElementById('fitness-diary-form');
        var success = document.getElementById('fitness-diary-success');
        var card = document.getElementById('fitness-diary-card');

        var highlightInput = document.getElementById('diary-highlight');
        var struggleInput = document.getElementById('diary-struggle');
        var noteInput = document.getElementById('diary-note');

        var dateKey = getTodayDateKey();
        var diaryPayload = {
            type: 'fitness_diary',
            day_rating: window._fitnessDiaryData.day_rating,
            energy_level: window._fitnessDiaryData.energy_level,
            highlight: (highlightInput && highlightInput.value.trim()) || null,
            struggle: (struggleInput && struggleInput.value.trim()) || null,
            note: (noteInput && noteInput.value.trim()) || null
        };

        try {
            // Save to daily_checkins using the existing upsert with additional_data
            await db.checkins.upsert(window.currentUser.id, dateKey, {
                energy: window._fitnessDiaryData.day_rating,
                additional_data: diaryPayload
            });

            // Award 1 XP (2x if in any active challenge)
            try {
                var xpAmount = await getXPMultiplier();
                var { data: currentPoints } = await supabaseClient
                    .from('user_points')
                    .select('lifetime_points')
                    .eq('user_id', window.currentUser.id)
                    .maybeSingle();

                if (currentPoints) {
                    await supabaseClient
                        .from('user_points')
                        .update({ lifetime_points: (currentPoints.lifetime_points || 0) + xpAmount })
                        .eq('user_id', window.currentUser.id);
                } else {
                    await supabaseClient
                        .from('user_points')
                        .insert({ user_id: window.currentUser.id, lifetime_points: xpAmount, current_points: 0 });
                }

                if (typeof triggerXPBarRainbow === 'function') triggerXPBarRainbow();
                if (typeof refreshLevelDisplay === 'function') refreshLevelDisplay();
            } catch (xpErr) {
                console.log('Fitness diary XP award skipped:', xpErr);
            }

            // Show success
            if (form) form.style.display = 'none';
            if (success) success.style.display = 'block';

            // Mark as done in localStorage
            localStorage.setItem('fitnessDiaryDone_' + dateKey, '1');

            // Transition to done card
            setTimeout(function() {
                if (card) {
                    card.style.transition = 'opacity 0.5s, transform 0.5s';
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(-20px)';
                    setTimeout(function() {
                        card.style.display = 'none';
                        card.style.opacity = '1';
                        card.style.transform = 'translateY(0)';
                        var doneCard = document.getElementById('fitness-diary-done-card');
                        if (doneCard) doneCard.style.display = 'flex';
                    }, 500);
                }
            }, 2000);

            if (typeof refreshPointsDisplay === 'function') refreshPointsDisplay();

        } catch (err) {
            console.error('Error submitting fitness diary:', err);
            alert('Failed to save diary entry. Please try again.');
        }
    }

    function dismissFitnessDiaryDoneCard() {
        var dateKey = getTodayDateKey();
        localStorage.setItem('fitnessDiaryDoneDismissed_' + dateKey, '1');
        document.getElementById('fitness-diary-done-card').style.display = 'none';
    }

    window.checkAndShowFitnessDiaryCard = checkAndShowFitnessDiaryCard;
    window.expandFitnessDiary = expandFitnessDiary;
    window.selectFitnessDiaryOption = selectFitnessDiaryOption;
    window.submitFitnessDiary = submitFitnessDiary;
    window.dismissFitnessDiaryDoneCard = dismissFitnessDiaryDoneCard;

    // ===== MOOD CHECK-IN CARD (3x daily: morning, afternoon, evening) =====

    window._moodCheckinData = { mood: null, energy: null, stress: null };

    function getMoodTimeWindow() {
        var hour = new Date().getHours();
        if (hour >= 4 && hour < 12) return 'morning';
        if (hour >= 12 && hour < 18) return 'afternoon';
        if (hour >= 18 || hour < 4) return 'evening';
        return null;
    }

    function getMoodWindowLabel(w) {
        if (w === 'morning') return 'Morning';
        if (w === 'afternoon') return 'Afternoon';
        if (w === 'evening') return 'Evening';
        return '';
    }

    function getMoodCompletedWindows() {
        var dateKey = getTodayDateKey();
        var raw = localStorage.getItem('moodCheckin_' + dateKey);
        return raw ? JSON.parse(raw) : {};
    }

    function setMoodCompletedWindow(window_name) {
        var dateKey = getTodayDateKey();
        var completed = getMoodCompletedWindows();
        completed[window_name] = true;
        localStorage.setItem('moodCheckin_' + dateKey, JSON.stringify(completed));
    }

    async function syncMoodCompletedWindowsFromDb() {
        if (!window.currentUser || !window.supabaseClient) return;
        var dateKey = getTodayDateKey();
        try {
            var result = await window.supabaseClient
                .from('mood_logs')
                .select('context')
                .eq('user_id', window.currentUser.id)
                .eq('log_date', dateKey);
            var rows = result && result.data;
            if (!Array.isArray(rows) || !rows.length) return;

            var completed = getMoodCompletedWindows();
            rows.forEach(function(row) {
                if (row && (row.context === 'morning' || row.context === 'afternoon' || row.context === 'evening')) {
                    completed[row.context] = true;
                }
            });
            localStorage.setItem('moodCheckin_' + dateKey, JSON.stringify(completed));
        } catch (e) {
            console.warn('Mood widget sync skipped:', e);
        }
    }

    function updateMoodDots() {
        var completed = getMoodCompletedWindows();
        ['morning', 'afternoon', 'evening'].forEach(function(w) {
            var dot = document.getElementById('mood-dot-' + w);
            if (dot) {
                if (completed[w]) {
                    dot.style.background = 'white';
                    dot.style.borderColor = 'white';
                } else {
                    dot.style.background = 'transparent';
                    dot.style.borderColor = 'rgba(255,255,255,0.6)';
                }
            }
        });
    }

    async function checkAndShowMoodCheckinCard() {
        if (!window.currentUser) return;
        if (window._onboardingWizardPending) return;
        var wizard = document.getElementById('onboarding-wizard');
        if (wizard && wizard.style.display !== 'none') return;

        var card = document.getElementById('mood-checkin-card');
        var doneCard = document.getElementById('mood-checkin-done-card');
        if (!card) return;

        var currentWindow = getMoodTimeWindow();
        await syncMoodCompletedWindowsFromDb();
        var completed = getMoodCompletedWindows();
        var allDone = completed.morning && completed.afternoon && completed.evening;

        updateMoodDots();

        if (allDone) {
            // All 3 windows done — show done card unless dismissed
            card.style.display = 'none';
            if (doneCard) {
                var dateKey = getTodayDateKey();
                var dismissKey = 'moodCheckinDoneDismissed_' + dateKey;
                doneCard.style.display = localStorage.getItem(dismissKey) ? 'none' : 'flex';
            }
            return;
        }

        if (!currentWindow || completed[currentWindow]) {
            // Current window done or outside windows — hide card
            card.style.display = 'none';
            if (doneCard) doneCard.style.display = 'none';
            return;
        }

        // Show the mood card for this window
        card.style.display = 'block';
        if (doneCard) doneCard.style.display = 'none';

        // Update title
        var titleEl = document.getElementById('mood-checkin-title');
        var subtitleEl = document.getElementById('mood-checkin-subtitle');
        if (titleEl) titleEl.textContent = getMoodWindowLabel(currentWindow) + ' Check-In';
        if (subtitleEl) subtitleEl.textContent = 'Quick mood check — 3 taps';

        // Reset selections
        window._moodCheckinData = { mood: null, energy: null, stress: null };
        document.querySelectorAll('.mood-emoji-btn').forEach(function(btn) {
            btn.style.background = 'rgba(255,255,255,0.12)';
            btn.style.borderColor = 'transparent';
            btn.style.transform = 'scale(1)';
        });
        var submitBtn = document.getElementById('mood-checkin-submit');
        if (submitBtn) submitBtn.style.display = 'none';
        var form = document.getElementById('mood-checkin-form');
        var success = document.getElementById('mood-checkin-success');
        if (form) form.style.display = 'block';
        if (success) success.style.display = 'none';
    }

    function selectMoodEmoji(group, value, el) {
        window._moodCheckinData[group] = value;

        // Visual: reset group, highlight selected
        document.querySelectorAll('.mood-emoji-btn[data-group="' + group + '"]').forEach(function(btn) {
            btn.style.background = 'rgba(255,255,255,0.12)';
            btn.style.borderColor = 'transparent';
            btn.style.transform = 'scale(1)';
        });
        el.style.background = 'rgba(255,255,255,0.3)';
        el.style.borderColor = 'white';
        el.style.transform = 'scale(1.05)';

        // Show submit if all 3 selected
        var d = window._moodCheckinData;
        if (d.mood && d.energy && d.stress) {
            var btn = document.getElementById('mood-checkin-submit');
            if (btn) {
                btn.style.display = 'block';
                btn.style.animation = 'none';
                btn.offsetHeight; // reflow
                btn.style.animation = 'fadeIn 0.3s ease';
            }
        }
    }

    async function submitMoodCheckin() {
        if (!window.currentUser) return;
        var d = window._moodCheckinData;
        if (!d.mood || !d.energy || !d.stress) return;

        var currentWindow = getMoodTimeWindow();
        if (!currentWindow) return;

        // Map 1-5 scale to 2/4/6/8/10 for the mood_logs table (1-10 range)
        var moodScore = d.mood * 2;
        var energyScore = d.energy * 2;
        // Stress is inverted for the DB: 1=chill(low stress=2), 5=max(high stress=10)
        var stressScore = d.stress * 2;

        var dateKey = getTodayDateKey();

        try {
            // Save to mood_logs table
            await window.supabaseClient.from('mood_logs').insert({
                user_id: window.currentUser.id,
                logged_at: new Date().toISOString(),
                log_date: dateKey,
                mood_score: moodScore,
                energy_score: energyScore,
                stress_score: stressScore,
                context: currentWindow
            });

            // Mark this window as completed
            setMoodCompletedWindow(currentWindow);
            updateMoodDots();

            var completed = getMoodCompletedWindows();
            var allDone = completed.morning && completed.afternoon && completed.evening;

            var form = document.getElementById('mood-checkin-form');
            var success = document.getElementById('mood-checkin-success');
            var successText = document.getElementById('mood-checkin-success-text');
            var card = document.getElementById('mood-checkin-card');

            if (allDone) {
                // Award 1 XP for completing all 3
                try {
                    var xpAmount = await getXPMultiplier();
                    var { data: currentPoints } = await window.supabaseClient
                        .from('user_points')
                        .select('lifetime_points')
                        .eq('user_id', window.currentUser.id)
                        .maybeSingle();

                    if (currentPoints) {
                        await window.supabaseClient
                            .from('user_points')
                            .update({ lifetime_points: (currentPoints.lifetime_points || 0) + xpAmount })
                            .eq('user_id', window.currentUser.id);
                    } else {
                        await window.supabaseClient
                            .from('user_points')
                            .insert({ user_id: window.currentUser.id, lifetime_points: xpAmount, current_points: 0 });
                    }
                    if (typeof triggerXPBarRainbow === 'function') triggerXPBarRainbow();
                    if (typeof refreshLevelDisplay === 'function') refreshLevelDisplay();
                } catch (xpErr) {
                    console.log('Mood XP award skipped:', xpErr);
                }

                if (form) form.style.display = 'none';
                if (success) success.style.display = 'block';
                if (successText) successText.textContent = 'All 3 check-ins done! Nice one.';

                // Transition to done card
                setTimeout(function() {
                    if (card) {
                        card.style.transition = 'opacity 0.5s, transform 0.5s';
                        card.style.opacity = '0';
                        card.style.transform = 'translateY(-20px)';
                        setTimeout(function() {
                            card.style.display = 'none';
                            card.style.opacity = '1';
                            card.style.transform = 'translateY(0)';
                            var doneCard = document.getElementById('mood-checkin-done-card');
                            if (doneCard) doneCard.style.display = 'flex';
                        }, 500);
                    }
                }, 2000);
            } else {
                // Not all done yet — show quick confirmation then hide card
                if (form) form.style.display = 'none';
                if (success) success.style.display = 'block';
                if (successText) {
                    var remaining = [];
                    if (!completed.morning) remaining.push('Morning');
                    if (!completed.afternoon) remaining.push('Afternoon');
                    if (!completed.evening) remaining.push('Evening');
                    successText.textContent = getMoodWindowLabel(currentWindow) + ' logged! ' + remaining.join(' & ') + ' left for +1 XP.';
                }

                setTimeout(function() {
                    if (card) {
                        card.style.transition = 'opacity 0.5s, transform 0.5s';
                        card.style.opacity = '0';
                        card.style.transform = 'translateY(-20px)';
                        setTimeout(function() {
                            card.style.display = 'none';
                            card.style.opacity = '1';
                            card.style.transform = 'translateY(0)';
                        }, 500);
                    }
                }, 2000);
            }

            if (typeof refreshPointsDisplay === 'function') refreshPointsDisplay();

        } catch (err) {
            console.error('Error submitting mood check-in:', err);
            alert('Failed to save mood check-in. Please try again.');
        }
    }

    function dismissMoodCheckinDoneCard() {
        var dateKey = getTodayDateKey();
        localStorage.setItem('moodCheckinDoneDismissed_' + dateKey, '1');
        var el = document.getElementById('mood-checkin-done-card');
        if (el) el.style.display = 'none';
    }

    window.checkAndShowMoodCheckinCard = checkAndShowMoodCheckinCard;
    window.selectMoodEmoji = selectMoodEmoji;
    window.submitMoodCheckin = submitMoodCheckin;
    window.dismissMoodCheckinDoneCard = dismissMoodCheckinDoneCard;

    // PWA resume: re-check weigh-in when app comes back to foreground
    // (e.g., user opens PWA the next day without a hard refresh)
    let _lastWeighInCheckDate = new Date().toDateString();
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') {
            // Always re-check mood & fitness diary on resume (time window may have changed)
            if (typeof checkAndShowMoodCheckinCard === 'function') checkAndShowMoodCheckinCard();
            if (typeof checkAndShowFitnessDiaryCard === 'function') checkAndShowFitnessDiaryCard();

            const today = new Date().toDateString();
            if (today !== _lastWeighInCheckDate) {
                // It's a new day since last check - refresh weigh-in card, modal & daily quiz
                _lastWeighInCheckDate = today;
                console.log('🔄 New day detected on PWA resume, refreshing daily cards');
                if (typeof checkAndShowWeighInCard === 'function') checkAndShowWeighInCard();
                if (typeof checkAndShowWeighInModal === 'function') checkAndShowWeighInModal();
                if (typeof checkAndShowMoodCheckinCard === 'function') checkAndShowMoodCheckinCard();
                if (typeof checkAndShowFitnessDiaryCard === 'function') checkAndShowFitnessDiaryCard();
                if (typeof checkAndShowDailyQuizCard === 'function') checkAndShowDailyQuizCard();
                if (typeof checkAndShowMealTipCard === 'function') checkAndShowMealTipCard();
                if (typeof checkAndShowProgressPhotoCard === 'function') checkAndShowProgressPhotoCard();
                if (typeof checkAndShowWorkoutTrendCard === 'function') checkAndShowWorkoutTrendCard();
                if (typeof checkAndShowNudgeFriendsCard === 'function') checkAndShowNudgeFriendsCard();
                if (typeof initPerformanceCard === 'function') initPerformanceCard();
                if (typeof initFitbitDashboard === 'function') initFitbitDashboard();
                if (typeof initWhoopDashboard === 'function') initWhoopDashboard();
                if (typeof initOuraDashboard === 'function') initOuraDashboard();
                if (typeof initStravaDashboard === 'function') initStravaDashboard();
                if (typeof initSpotifyDashboard === 'function') initSpotifyDashboard();
            }
        }
    });
