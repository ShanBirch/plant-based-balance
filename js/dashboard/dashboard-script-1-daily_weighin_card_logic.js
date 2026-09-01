// ===== WEEKLY SUNDAY WEIGH-IN CARD LOGIC =====

const FRIDAY_WEIGH_LOSS_POINTS = 5;
const FRIDAY_WEIGH_SHARE_POINTS = 5;

    /**
     * Show the weekly weigh-in card on Sunday only.
     */
    async function checkAndShowWeighInCard() {
        if (!window.currentUser) return;

        // Don't show weigh-in card if onboarding wizard is active or pending
        if (window._onboardingWizardPending) return;
        const wizard = document.getElementById('onboarding-wizard');
        if (wizard && wizard.style.display !== 'none') return;

        const card = document.getElementById('daily-weigh-in-card');
        const doneCard = document.getElementById('daily-weigh-in-done-card');

        // Weight can still be logged manually from other app surfaces, but the
        // default Home prompt and completion card belong to Sunday only.
        if (!isSundayWeighInDay()) {
            if (card) card.style.display = 'none';
            if (doneCard) doneCard.style.display = 'none';
            return;
        }

        try {
            const todaysWeighIn = await db.weighIns.getTodaysWeighIn(window.currentUser.id);

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
                    // Show the card for this week's Sunday weigh-in
                    resetDailyWeighInCardVisualState();
                    applyFridayWeighInCardVisualState();
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

    function isSundayWeighInDay(date = new Date()) {
        return date.getDay() === 0;
    }

    function ensureFridayWeighInCardStyles() {
        if (document.getElementById('friday-weigh-in-card-styles')) return;
        const style = document.createElement('style');
        style.id = 'friday-weigh-in-card-styles';
        style.textContent = `
            @keyframes pbbFridaySilverPulse {
                0%, 100% {
                    box-shadow: 0 14px 34px rgba(71,85,105,0.18), 0 0 0 1px rgba(255,255,255,0.96), 0 0 0 2px rgba(148,163,184,0.34), 0 0 28px rgba(203,213,225,0.98), 0 0 52px rgba(100,116,139,0.34);
                    filter: saturate(1);
                }
                50% {
                    box-shadow: 0 18px 42px rgba(51,65,85,0.22), 0 0 0 1px rgba(255,255,255,1), 0 0 0 2px rgba(148,163,184,0.48), 0 0 38px rgba(226,232,240,1), 0 0 68px rgba(100,116,139,0.42);
                    filter: saturate(1.03);
                }
            }
            @keyframes pbbFridaySilverSheen {
                0% { transform: translateX(-115%) rotate(12deg); opacity: 0; }
                18% { opacity: 0.42; }
                42% { opacity: 0.14; }
                100% { transform: translateX(130%) rotate(12deg); opacity: 0; }
            }
            #daily-weigh-in-card.pbb-friday-weigh-card {
                background: linear-gradient(135deg, #ffffff 0%, #f1f5f9 18%, #cbd5e1 45%, #f8fafc 68%, #94a3b8 100%) !important;
                animation: pbbFridaySilverPulse 2.9s ease-in-out infinite !important;
                border: 1px solid rgba(148,163,184,0.86) !important;
                color: #111827 !important;
                -webkit-text-fill-color: #111827 !important;
                text-shadow: none !important;
                isolation: isolate;
            }
            #daily-weigh-in-card.pbb-friday-weigh-card::before {
                content: '';
                position: absolute;
                top: -40%;
                bottom: -40%;
                left: 0;
                width: 42%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent);
                filter: blur(1px);
                animation: pbbFridaySilverSheen 3.8s ease-in-out infinite;
                pointer-events: none;
                z-index: 0;
            }
            #daily-weigh-in-card.pbb-friday-weigh-card::after {
                content: '';
                position: absolute;
                inset: 0;
                border-radius: 16px;
                background: radial-gradient(circle at 88% 16%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.56) 16%, transparent 32%), linear-gradient(135deg, rgba(255,255,255,0.38), transparent 34%, rgba(15,23,42,0.06) 100%);
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 rgba(100,116,139,0.2), inset 0 0 22px rgba(255,255,255,0.56);
                pointer-events: none;
                z-index: 0;
            }
            #daily-weigh-in-card.pbb-friday-weigh-card h3,
            #daily-weigh-in-card.pbb-friday-weigh-card p,
            #daily-weigh-in-card.pbb-friday-weigh-card span,
            #daily-weigh-in-card.pbb-friday-weigh-card div {
                color: #111827 !important;
                -webkit-text-fill-color: #111827 !important;
            }
            #daily-weigh-in-card.pbb-friday-weigh-card input {
                background: rgba(255,255,255,0.98) !important;
                border: 1px solid rgba(148,163,184,0.45) !important;
                color: #111827 !important;
                -webkit-text-fill-color: #111827 !important;
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.92), 0 8px 18px rgba(15,23,42,0.08) !important;
                outline-color: #94a3b8;
                text-shadow: none !important;
            }
            #daily-weigh-in-card.pbb-friday-weigh-card input::placeholder {
                color: #64748b !important;
                -webkit-text-fill-color: #64748b !important;
                opacity: 1;
            }
            #daily-weigh-in-card.pbb-friday-weigh-card input + span {
                color: #334155 !important;
                -webkit-text-fill-color: #334155 !important;
                text-shadow: none !important;
            }
            #daily-weigh-in-card.pbb-friday-weigh-card button {
                background: linear-gradient(135deg, #111827 0%, #334155 100%) !important;
                border: 1px solid rgba(15,23,42,0.16) !important;
                color: #ffffff !important;
                -webkit-text-fill-color: #ffffff !important;
                box-shadow: 0 10px 22px rgba(15,23,42,0.2) !important;
                text-shadow: none !important;
            }
            #daily-weigh-in-card.pbb-friday-weigh-card > div:first-child,
            #daily-weigh-in-card.pbb-friday-weigh-card > div:nth-child(2) {
                display: none !important;
            }
            #daily-weigh-in-card.pbb-friday-weigh-card > div:nth-child(3) {
                position: relative;
                z-index: 1;
            }
            #daily-weigh-in-done-card.pbb-friday-share-card {
                background: linear-gradient(135deg, #ffffff 0%, #f8fafc 36%, #dbe2ea 100%) !important;
                border: 1px solid rgba(203,213,225,0.82);
                box-shadow: 0 16px 38px rgba(71,85,105,0.18), 0 0 30px rgba(226,232,240,0.78);
                align-items: stretch !important;
                color: #111827 !important;
                -webkit-text-fill-color: #111827 !important;
                text-shadow: none !important;
            }
            #daily-weigh-in-done-card.pbb-friday-shared-card {
                background: linear-gradient(135deg, #ecfdf5 0%, #ffffff 48%, #e2e8f0 100%) !important;
                border: 1px solid rgba(134,239,172,0.46);
                color: #064e3b !important;
                -webkit-text-fill-color: #064e3b !important;
                text-shadow: none !important;
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
        setTextContent('weigh-in-card-title', 'Sunday Weigh-In');
        setTextContent('weigh-in-card-subtitle', 'Log this week\'s weight and keep your trend accurate.');
        setTextContent('weigh-in-xp-badge', '+1 XP');
        setTextContent('weigh-in-submit-btn', 'Log It');
        setTextContent('weigh-in-success-xp', '+1 XP');
        setTextContent('weigh-in-success-copy', 'Weekly weigh-in complete!');
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
        setTextContent('weigh-in-card-title', 'Sunday Weigh-Ins');
        setTextContent('weigh-in-card-subtitle', '');
        setTextContent('weigh-in-xp-badge', '');
        setTextContent('weigh-in-submit-btn', 'Weigh In');
        setTextContent('weigh-in-success-xp', 'Weigh-in logged');
        setTextContent('weigh-in-success-copy', 'Share to Feed next for +5 XP.');
        const submitBtn = document.getElementById('weigh-in-submit-btn');
        if (submitBtn) submitBtn.style.color = '#ffffff';
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
                <div id="weigh-in-done-subtitle" style="font-size: 0.82rem; opacity: 0.9; margin-top: 2px;">+1 XP earned. Come back next Sunday!</div>
            </div>
        `;
    }

    function shouldShowFridayShareCard(payload) {
        if (!payload || !payload.is_sunday || !payload.active_challenge || payload.share_already_posted) return false;
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
        let changeCopy = 'First Sunday marker for this challenge.';
        if (isFinite(previous) && isFinite(change)) {
            const abs = Math.abs(change).toFixed(1);
            if (change < 0) changeCopy = `Down ${abs} kg from last Sunday.`;
            else if (change > 0) changeCopy = `Up ${abs} kg from last Sunday.`;
            else changeCopy = 'Steady from last Sunday.';
        }
        doneCard.classList.remove('pbb-friday-shared-card');
        doneCard.classList.add('pbb-friday-share-card');
        doneCard.style.display = 'flex';
        doneCard.style.gap = '0';
        doneCard.innerHTML = `
            <div style="width:100%;">
                <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:12px;">
                    <div>
                        <div style="font-size:0.66rem; color:#64748b; text-transform:uppercase; letter-spacing:0; font-weight:900; margin-bottom:4px;">Sunday weigh-in</div>
                        <div style="font-size:1.08rem; font-weight:950; color:#111827;">Share to Feed?</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.88); border:1px solid rgba(148,163,184,0.38); border-radius:12px; padding:8px 10px; text-align:right; flex-shrink:0; box-shadow:0 8px 18px rgba(15,23,42,0.08);">
                        <div style="font-size:1.25rem; line-height:1; font-weight:950; color:#0f172a;">${escapeWeighInHtml(weight)}</div>
                        <div style="font-size:0.68rem; color:#475569; font-weight:800; margin-top:3px;">logged</div>
                    </div>
                </div>
                <div style="display:flex; gap:7px; flex-wrap:wrap; margin-bottom:12px;">
                    <span style="background:${lost ? 'rgba(22,163,74,0.12)' : 'rgba(255,255,255,0.74)'}; color:${lost ? '#166534' : '#334155'}; border:1px solid ${lost ? 'rgba(22,163,74,0.24)' : 'rgba(148,163,184,0.32)'}; padding:6px 9px; border-radius:999px; font-size:0.72rem; font-weight:900;">+${FRIDAY_WEIGH_LOSS_POINTS} XP if down from last Sunday</span>
                    <span style="background:rgba(37,99,235,0.1); color:#1d4ed8; border:1px solid rgba(37,99,235,0.2); padding:6px 9px; border-radius:999px; font-size:0.72rem; font-weight:900;">+${FRIDAY_WEIGH_SHARE_POINTS} XP for feed share</span>
                </div>
                <div style="font-size:0.84rem; color:#334155; line-height:1.42; font-weight:760; margin-bottom:13px;">${escapeWeighInHtml(changeCopy)} Review it first, then post to Feed for +${FRIDAY_WEIGH_SHARE_POINTS} XP.</div>
                <div style="display:grid; grid-template-columns:1fr auto; gap:9px;">
                    <button onclick="openFridayWeighInShareCard()" style="min-height:42px; border:none; border-radius:12px; background:#111827; color:#ffffff; -webkit-text-fill-color:#ffffff; font-size:0.86rem; font-weight:950; cursor:pointer; box-shadow:0 10px 22px rgba(15,23,42,0.18);">Share to Feed +${FRIDAY_WEIGH_SHARE_POINTS} XP</button>
                    <button onclick="dismissFridayWeighInShare()" style="min-height:42px; border:1px solid rgba(148,163,184,0.38); border-radius:12px; background:rgba(255,255,255,0.72); color:#475569; font-size:0.82rem; font-weight:800; cursor:pointer; padding:0 12px;">Not today</button>
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
            <div style="width:44px; height:44px; background:rgba(255,255,255,0.18); border-radius:14px; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:0.9rem; font-weight:950;">SUN</div>
            <div style="flex:1; min-width:0; padding-right:18px;">
                <div style="font-weight:950; font-size:1rem; color:#064e3b;">Posted to Feed</div>
                <div style="font-size:0.84rem; color:#166534; font-weight:750; margin-top:2px;">${Number(data?.share_points_awarded || 0) > 0 ? '+' + Number(data.share_points_awarded || 0) + ' XP for sharing. ' : ''}Sunday weigh-in posted.</div>
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

    function getFridayWeighFeedStoryPattern(weighInId) {
        return `%friday_weigh_in%${String(weighInId || '')}%`;
    }

    async function findFridayWeighInFeedPost(weighInId) {
        if (!weighInId || !window.currentUser || !window.supabaseClient) return null;
        const { data, error } = await window.supabaseClient
            .from('stories')
            .select('id,caption,created_at')
            .eq('user_id', window.currentUser.id)
            .eq('media_type', 'workout_card')
            .ilike('caption', getFridayWeighFeedStoryPattern(weighInId))
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
        if (error && error.code !== 'PGRST116') {
            console.warn('Could not check Sunday weigh-in feed post:', error);
            return null;
        }
        return data || null;
    }

    async function hasFridayWeighShareLedger(weighInId) {
        if (!weighInId || !window.currentUser || !window.supabaseClient) return false;
        const { data, error } = await window.supabaseClient
            .from('point_transactions')
            .select('id')
            .eq('user_id', window.currentUser.id)
            .eq('transaction_type', 'earn_friday_weigh_share')
            .eq('reference_id', weighInId)
            .limit(1)
            .maybeSingle();
        if (error && error.code !== 'PGRST116') {
            console.warn('Could not check Sunday weigh-in share ledger:', error);
            return false;
        }
        return !!data;
    }

    async function hydrateFridayWeighShareState(payload, weighInId) {
        if (!payload || !weighInId || !payload.is_sunday || !payload.active_challenge) return payload;
        const postedKey = getFridayWeighStorageKey('fridayWeighSharePosted_', weighInId);
        if (localStorage.getItem(postedKey) || await hasFridayWeighShareLedger(weighInId)) {
            try { localStorage.setItem(postedKey, '1'); } catch(e) {}
            payload.share_already_posted = true;
        }
        return payload;
    }

    function buildFridayWeighInFeedCardPayload(payload) {
        const previous = parseFloat(payload.previous_weight_kg);
        const change = parseFloat(payload.change_kg);
        return {
            card_type: 'friday_weigh_in',
            weigh_in_id: String(payload.weigh_in_id || ''),
            weigh_in_date: payload.weigh_in_date || (typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0]),
            weight_kg: Number.isFinite(parseFloat(payload.weight_kg)) ? Math.round(parseFloat(payload.weight_kg) * 10) / 10 : null,
            display_weight: formatWeightForPreference(payload.weight_kg),
            previous_weight_kg: isFinite(previous) ? Math.round(previous * 10) / 10 : null,
            previous_weight_date: payload.previous_weight_date || null,
            change_kg: isFinite(change) ? Math.round(change * 10) / 10 : null,
            comparison_label: payload.comparison_label || (isFinite(previous) ? 'last_friday' : 'first_friday'),
            lost_weight: !!payload.lost_weight || Number(payload.loss_points_awarded || 0) > 0,
            loss_points_awarded: Number(payload.loss_points_awarded || 0),
            share_points_available: FRIDAY_WEIGH_SHARE_POINTS,
            challenge_id: payload.challenge_id || null,
            challenge_name: payload.challenge_name || '30 Day Challenge',
            shared_to: 'feed'
        };
    }

    async function createFridayWeighInFeedPost(payload) {
        const existing = await findFridayWeighInFeedPost(payload.weigh_in_id);
        const cardPayload = buildFridayWeighInFeedCardPayload(payload);
        if (existing) return { story: existing, cardPayload, already_posted: true };

        const { data, error } = await window.supabaseClient
            .from('stories')
            .insert([{
                user_id: window.currentUser.id,
                media_type: 'workout_card',
                media_url: '',
                thumbnail_url: null,
                caption: JSON.stringify(cardPayload),
                duration: 5,
                background_color: '#0f172a'
            }])
            .select()
            .single();
        if (error) throw error;
        return { story: data, cardPayload, already_posted: false };
    }

    async function awardFridayWeighFeedSharePoints(weighInId) {
        if (!weighInId || !window.currentUser || !window.supabaseClient) return 0;
        if (await hasFridayWeighShareLedger(weighInId)) return 0;

        const sharePoints = FRIDAY_WEIGH_SHARE_POINTS;
        const { data: currentPoints } = await window.supabaseClient
            .from('user_points')
            .select('current_points,lifetime_points')
            .eq('user_id', window.currentUser.id)
            .maybeSingle();

        if (currentPoints) {
            const { error: updateError } = await window.supabaseClient
                .from('user_points')
                .update({
                    current_points: (currentPoints.current_points || 0) + sharePoints,
                    lifetime_points: (currentPoints.lifetime_points || 0) + sharePoints
                })
                .eq('user_id', window.currentUser.id);
            if (updateError) throw updateError;
        } else {
            const { error: insertPointsError } = await window.supabaseClient
                .from('user_points')
                .insert({ user_id: window.currentUser.id, current_points: sharePoints, lifetime_points: sharePoints });
            if (insertPointsError) throw insertPointsError;
        }

        const { error: txError } = await window.supabaseClient
            .from('point_transactions')
            .insert({
                user_id: window.currentUser.id,
                transaction_type: 'earn_friday_weigh_share',
                points_amount: sharePoints,
                reference_id: weighInId,
                reference_type: 'daily_weigh_in',
                photo_verified: false,
                verification_method: 'feed_post',
                description: 'Posted Sunday weigh-in to feed'
            });
        if (txError && !String(txError.message || txError.details || '').toLowerCase().includes('duplicate')) throw txError;

        try {
            await window.supabaseClient.rpc('update_challenge_participant_points', { user_uuid: window.currentUser.id });
        } catch (e) {
            console.warn('Could not refresh challenge points after Friday feed share:', e);
        }

        return txError ? 0 : sharePoints;
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
            const weighInDate = String(weighIn.weigh_in_date || '').trim();
            const weighInDay = weighInDate ? new Date(weighInDate + 'T12:00:00').getDay() : new Date().getDay();

            try {
                // Prevent a still-cached pre-migration database function from awarding
                // the retired Friday bonus while production rolls over to Sunday.
                if (weighInDay === 5) {
                    payload = await awardDailyWeighInFallback(weighIn);
                } else {
                    const { data, error } = await window.supabaseClient.rpc('handle_friday_weigh_in_rewards', {
                        p_weigh_in_id: weighIn.id
                    });
                    if (error) throw error;
                    payload = data;
                }
            } catch (error) {
                if (!isMissingFridayWeighRpc(error)) {
                    console.warn('Sunday weigh-in reward check failed:', error);
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
                    if (loss > 0) showWeighRewardToast(`+${daily + loss} XP for Sunday weigh-in progress`, 'success');
                    else showWeighRewardToast(`+${awarded} XP for your weigh-in`, 'success');
                }
            }

            payload = await hydrateFridayWeighShareState(payload, weighIn.id);

            if (payload.is_sunday && payload.active_challenge && !payload.share_already_posted) {
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
                            <div style="font-size:0.72rem; font-weight:900; letter-spacing:0; text-transform:uppercase; color:#64748b; margin-bottom:4px;">Sunday weigh-in</div>
                            <h3 style="margin:0; color:#111827; font-size:1.25rem; line-height:1.2; font-weight:850;">Share to Feed?</h3>
                        </div>
                        <button onclick="closeFridayWeighInShareCard()" title="Close" style="width:34px; height:34px; border:none; border-radius:50%; background:#f1f5f9; color:#334155; font-size:1.2rem; cursor:pointer; line-height:1;">&times;</button>
                    </div>
                    <div id="friday-weigh-share-weight" style="font-size:2rem; font-weight:900; color:#0f172a; line-height:1; margin-bottom:6px;"></div>
                    <div id="friday-weigh-share-detail" style="font-size:0.92rem; color:#475569; line-height:1.45; margin-bottom:14px;"></div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">
                        <span id="friday-weigh-loss-chip" style="background:#dcfce7; color:#166534; border:1px solid #86efac; padding:6px 10px; border-radius:999px; font-size:0.78rem; font-weight:800;">+${FRIDAY_WEIGH_LOSS_POINTS} XP if down from last Sunday</span>
                        <span style="background:#dbeafe; color:#1e3a8a; border:1px solid #93c5fd; padding:6px 10px; border-radius:999px; font-size:0.78rem; font-weight:850;">+${FRIDAY_WEIGH_SHARE_POINTS} XP for feed share</span>
                    </div>
                    <div style="font-size:0.88rem; color:#334155; line-height:1.45; font-weight:650; background:#f8fafc; border:1px solid #cbd5e1; border-radius:12px; padding:12px; margin-bottom:16px;">
                        This posts a Sunday weigh-in card to the Feed so people can react and keep the challenge moving.
                    </div>
                    <div style="display:grid; grid-template-columns:1fr; gap:10px;">
                        <button id="friday-weigh-share-post-btn" onclick="postFridayWeighInShare()" style="width:100%; border:none; border-radius:12px; background:#111827; color:white; -webkit-text-fill-color:white; padding:13px 14px; font-weight:900; font-size:0.95rem; cursor:pointer; box-shadow:0 10px 22px rgba(15,23,42,0.2);">Post to Feed</button>
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
        let detail = 'Post this to the Feed for +' + FRIDAY_WEIGH_SHARE_POINTS + ' XP and keep Sunday weigh-ins moving.';
        if (isFinite(previous) && isFinite(change)) {
            const abs = Math.abs(change).toFixed(1);
            if (change < 0) detail = `Down ${abs} kg from last Sunday. Post it to the Feed for +${FRIDAY_WEIGH_SHARE_POINTS} XP?`;
            else if (change > 0) detail = `Up ${abs} kg from last Sunday. Still worth posting for +${FRIDAY_WEIGH_SHARE_POINTS} XP.`;
            else detail = `Steady from last Sunday. Still counts for showing up.`;
        } else {
            detail = 'First Sunday marker for this run. Post the starting point to the Feed for +' + FRIDAY_WEIGH_SHARE_POINTS + ' XP?';
        }
        if (detailEl) detailEl.textContent = detail;

        const lossAwarded = Number(payload.loss_points_awarded || 0);
        if (lossChip) {
            lossChip.style.display = 'inline-flex';
            lossChip.textContent = lossAwarded > 0 ? `+${lossAwarded} XP for moving down from last Sunday` : `+${FRIDAY_WEIGH_LOSS_POINTS} XP if down from last Sunday`;
        }

        if (postBtn) {
            postBtn.disabled = false;
            postBtn.textContent = 'Post to Feed (+' + FRIDAY_WEIGH_SHARE_POINTS + ' XP)';
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
            postBtn.textContent = 'Posting to Feed...';
        }

        try {
            const feedPost = await createFridayWeighInFeedPost(payload);
            const sharePoints = await awardFridayWeighFeedSharePoints(payload.weigh_in_id);
            const data = {
                ok: true,
                story_id: feedPost.story?.id || feedPost.story?.story_id || null,
                feed_post_id: feedPost.story?.id || feedPost.story?.story_id || null,
                share_points_awarded: sharePoints,
                already_posted: feedPost.already_posted || sharePoints === 0
            };

            localStorage.setItem(getFridayWeighStorageKey('fridayWeighSharePosted_', payload.weigh_in_id), '1');
            const modal = document.getElementById('friday-weigh-share-modal');
            if (modal) modal.style.display = 'none';
            renderFridaySharedDoneCard(data);
            window._pendingFridayWeighShare = null;

            await refreshAfterWeighRewards();
            if (typeof loadPhotoFeed === 'function') loadPhotoFeed('friends-photo-feed', 'friends-feed-empty');
            if (typeof refreshWeeklyGoalsCard === 'function') refreshWeeklyGoalsCard();

            showWeighRewardToast(sharePoints > 0 ? `Posted to Feed. +${sharePoints} XP` : 'Sunday weigh-in already posted to Feed', 'success');

            if (typeof switchAppTab === 'function') {
                switchAppTab('friends');
                setTimeout(function() {
                    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch(e) { window.scrollTo(0, 0); }
                }, 250);
            }
        } catch (error) {
            console.error('Sunday weigh-in share failed:', error);
            showWeighRewardToast('Could not post Sunday weigh-in to Feed. Try again.', 'error');
            if (postBtn) {
                postBtn.disabled = false;
                postBtn.textContent = 'Post to Feed (+' + FRIDAY_WEIGH_SHARE_POINTS + ' XP)';
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
     * Submit the Sunday weigh-in
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
                        if (doneCard) {
                            showDailyWeighInDoneCard(rewardPayload);
                            if (shouldShowFridayShareCard(rewardPayload)) {
                                setTimeout(() => showFridayWeighInSharePrompt(rewardPayload), 450);
                            }
                        }
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

    // ===== FITNESS DIARY CARD (Daily from 5 PM) =====

    window._fitnessDiaryData = { day_rating: null, energy_level: null };

    function getTodayDateKey() {
        var d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    }

    function getBrisbaneHour(date) {
        try {
            var hour = new Intl.DateTimeFormat('en-AU', {
                timeZone: 'Australia/Brisbane',
                hour: '2-digit',
                hour12: false
            }).format(date || new Date());
            return Number(hour) % 24;
        } catch (e) {
            return (date || new Date()).getHours();
        }
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

        // Only show from 5 PM onwards
        if (getBrisbaneHour() < 17) {
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
            updateFitnessDiaryShareButtons(dateKey);
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
        updateFitnessDiaryShareButtons(dateKey);
    }

    // Backwards compatibility alias
    window.checkAndShowWeeklyCheckinCard = checkAndShowFitnessDiaryCard;

    function expandFitnessDiary() {
        var collapsed = document.getElementById('fitness-diary-collapsed');
        var form = document.getElementById('fitness-diary-form');
        if (collapsed) collapsed.style.display = 'none';
        if (form) form.style.display = 'block';
    }

    function openFitnessDiaryForAction() {
        var card = document.getElementById('fitness-diary-card');
        var doneCard = document.getElementById('fitness-diary-done-card');
        if (!card) return false;
        var dateKey = getTodayDateKey();
        var alreadyDone = !!localStorage.getItem('fitnessDiaryDone_' + dateKey);
        window._fitnessDiaryActionOpen = true;
        if (alreadyDone) {
            card.style.display = 'none';
            if (doneCard) doneCard.style.display = 'flex';
            updateFitnessDiaryShareButtons(dateKey);
            if (doneCard && typeof doneCard.scrollIntoView === 'function') doneCard.scrollIntoView({ block: 'center', behavior: 'smooth' });
            return true;
        }
        card.style.display = 'block';
        if (doneCard) doneCard.style.display = 'none';
        expandFitnessDiary();
        card.classList.add('pbb-next-step-active-source');
        if (typeof card.scrollIntoView === 'function') card.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return true;
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

    function getFitnessDiaryStorageKey(dateKey) {
        return 'fitnessDiaryEntry_' + dateKey;
    }

    function getFitnessDiaryShareKey(dateKey) {
        return 'pbbFitnessDiarySharedToFeed_' + dateKey;
    }

    function escapeFitnessDiaryHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatFitnessDiaryValue(value) {
        return String(value || '')
            .replace(/_/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/\b\w/g, function(match) { return match.toUpperCase(); });
    }

    function truncateFitnessDiaryText(value, max) {
        var text = String(value || '').replace(/\s+/g, ' ').trim();
        if (!text) return '';
        return text.length > max ? text.slice(0, max - 3) + '...' : text;
    }

    function setFitnessDiaryStoredPayload(dateKey, payload) {
        try {
            localStorage.setItem(getFitnessDiaryStorageKey(dateKey), JSON.stringify(payload || {}));
        } catch (_) {}
    }

    function getFitnessDiaryStoredPayload(dateKey) {
        try {
            var raw = localStorage.getItem(getFitnessDiaryStorageKey(dateKey));
            return raw ? JSON.parse(raw) : null;
        } catch (_) {
            return null;
        }
    }

    function isFitnessDiaryShared(dateKey) {
        try {
            return localStorage.getItem(getFitnessDiaryShareKey(dateKey)) === '1';
        } catch (_) {
            return false;
        }
    }

    function markFitnessDiaryShared(dateKey) {
        try {
            localStorage.setItem(getFitnessDiaryShareKey(dateKey), '1');
        } catch (_) {}
    }

    function updateFitnessDiaryShareButtons(dateKey) {
        var shared = isFitnessDiaryShared(dateKey || getTodayDateKey());
        [
            { id: 'fitness-diary-share-feed-btn', label: 'Share to Feed' },
            { id: 'fitness-diary-success-share-feed-btn', label: 'Share Fitness Diary to Feed' }
        ].forEach(function(item) {
            var btn = document.getElementById(item.id);
            if (!btn) return;
            btn.dataset.dateKey = dateKey || getTodayDateKey();
            btn.disabled = shared;
            btn.textContent = shared ? 'Shared to Feed' : item.label;
            btn.style.opacity = shared ? '0.72' : '1';
            btn.style.cursor = shared ? 'default' : 'pointer';
        });
    }

    function closeFitnessDiaryFeedSharePrompt() {
        var prompt = document.getElementById('fitness-diary-feed-share-prompt');
        if (prompt) prompt.remove();
    }

    function buildFitnessDiaryFeedPayload(source, dateKey) {
        source = source || {};
        return {
            card_type: 'fitness_diary',
            diary_date: dateKey || source.date || getTodayDateKey(),
            title: 'Fitness Diary',
            day_rating: source.day_rating || null,
            energy_level: source.energy_level || null,
            goals: source.goals || null,
            highlight: source.highlight || null,
            struggle: source.struggle || null,
            note: source.note || null,
            timestamp: source.timestamp || new Date().toISOString()
        };
    }

    async function loadFitnessDiaryPayloadForDate(dateKey) {
        var recent = window._lastFitnessDiaryPayload;
        if (recent && (!recent.date || recent.date === dateKey)) {
            return buildFitnessDiaryFeedPayload(recent, dateKey);
        }

        var stored = getFitnessDiaryStoredPayload(dateKey);
        if (stored) {
            return buildFitnessDiaryFeedPayload(stored, dateKey);
        }

        try {
            if (window.currentUser && window.db && window.db.checkins && typeof window.db.checkins.get === 'function') {
                var row = await window.db.checkins.get(window.currentUser.id, dateKey);
                var additional = row && row.additional_data;
                var diary = additional && (additional.fitness_diary || (additional.type === 'fitness_diary' ? additional : null));
                if (diary) return buildFitnessDiaryFeedPayload(diary, dateKey);
            }
        } catch (_) {}

        return buildFitnessDiaryFeedPayload({}, dateKey);
    }

    function showFitnessDiaryFeedSharePrompt(payload) {
        if (!document.body || !payload) return;
        var dateKey = payload.diary_date || getTodayDateKey();
        if (isFitnessDiaryShared(dateKey)) return;

        if (typeof closeDailyCheckInFeedSharePrompt === 'function') {
            closeDailyCheckInFeedSharePrompt();
        }
        closeFitnessDiaryFeedSharePrompt();

        var detailBits = [
            payload.day_rating ? 'Today: ' + formatFitnessDiaryValue(payload.day_rating) : '',
            payload.energy_level ? 'Energy: ' + formatFitnessDiaryValue(payload.energy_level) : '',
            payload.note ? 'My day: ' + truncateFitnessDiaryText(payload.note, 80) : '',
            payload.goals ? 'Goals: ' + payload.goals : '',
            payload.highlight ? payload.highlight : ''
        ].filter(Boolean);

        var prompt = document.createElement('div');
        prompt.id = 'fitness-diary-feed-share-prompt';
        prompt.style.cssText = 'position:fixed;left:14px;right:14px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:10032;background:#ffffff;border:1px solid #bfdbfe;border-radius:16px;box-shadow:0 18px 42px rgba(15,23,42,0.22);padding:14px;display:flex;align-items:center;gap:12px;font-family:inherit;';
        prompt.innerHTML = '' +
            '<div style="width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#0ea5e9,#6366f1);display:flex;align-items:center;justify-content:center;color:white;flex-shrink:0;">' +
                '<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z"/><path d="M8 7h8"/><path d="M8 11h6"/></svg>' +
            '</div>' +
            '<div style="flex:1;min-width:0;">' +
                '<div style="font-size:0.86rem;font-weight:900;color:#0f172a;line-height:1.25;">Share your Fitness Diary?</div>' +
                '<div style="font-size:0.74rem;font-weight:700;color:#64748b;line-height:1.25;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeFitnessDiaryHtml(detailBits.length ? detailBits.join(' - ') : "Post today's diary entry to the Feed.") + '</div>' +
            '</div>' +
            '<button type="button" data-date-key="' + escapeFitnessDiaryHtml(dateKey) + '" onclick="shareFitnessDiaryToFeed(this)" style="border:none;background:#046a38;color:white;border-radius:999px;padding:10px 13px;font-size:0.78rem;font-weight:900;cursor:pointer;white-space:nowrap;">Share</button>' +
            '<button type="button" onclick="closeFitnessDiaryFeedSharePrompt()" aria-label="Dismiss diary share prompt" style="border:none;background:#f1f5f9;color:#64748b;border-radius:999px;width:32px;height:32px;font-size:1.1rem;line-height:1;cursor:pointer;flex-shrink:0;">&times;</button>';
        document.body.appendChild(prompt);
        setTimeout(function() {
            if (document.getElementById('fitness-diary-feed-share-prompt') === prompt) closeFitnessDiaryFeedSharePrompt();
        }, 15000);
    }

    async function shareFitnessDiaryToFeed(btn) {
        if (!window.currentUser) {
            if (typeof showToast === 'function') showToast('You must be logged in to share', 'error');
            return null;
        }

        var dateKey = (btn && btn.dataset && btn.dataset.dateKey) || getTodayDateKey();
        if (isFitnessDiaryShared(dateKey)) {
            if (typeof showToast === 'function') showToast('Fitness diary already shared to Feed', 'info');
            closeFitnessDiaryFeedSharePrompt();
            updateFitnessDiaryShareButtons(dateKey);
            return null;
        }

        var helpers = window.dbHelpers || (typeof dbHelpers !== 'undefined' ? dbHelpers : null);
        if (!helpers || !helpers.stories || typeof helpers.stories.create !== 'function') {
            if (typeof showToast === 'function') showToast('Feed is still loading. Try again in a moment.', 'info');
            return null;
        }

        if (btn) {
            btn.disabled = true;
            btn.dataset.originalText = btn.textContent || '';
            btn.textContent = 'Sharing...';
            btn.style.opacity = '0.75';
        }

        try {
            var payload = await loadFitnessDiaryPayloadForDate(dateKey);
            var courseActionId = window.socialJourney && typeof window.socialJourney.getFitnessDiaryCourseActionId === 'function'
                ? window.socialJourney.getFitnessDiaryCourseActionId()
                : null;
            var storyData = {
                media_type: 'checkin_card',
                media_url: '',
                thumbnail_url: null,
                caption: JSON.stringify(payload),
                duration: 5,
                course_action_id: courseActionId || null
            };

            var story;
            try {
                story = await helpers.stories.create(window.currentUser.id, storyData);
            } catch (storyError) {
                var message = String(storyError && (storyError.message || storyError.details || storyError.code) || '');
                if (!/media_type|checkin_card|check constraint|violates/i.test(message)) throw storyError;
                story = await helpers.stories.create(window.currentUser.id, Object.assign({}, storyData, {
                    media_type: 'level_up_card'
                }));
            }

            markFitnessDiaryShared(dateKey);
            closeFitnessDiaryFeedSharePrompt();
            updateFitnessDiaryShareButtons(dateKey);
            if (typeof loadPhotoFeed === 'function') {
                loadPhotoFeed('friends-photo-feed', 'friends-feed-empty');
            }
            if (typeof window.refreshWeeklyGoalsCard === 'function') {
                window.refreshWeeklyGoalsCard();
            }
            if (window.socialJourney && typeof window.socialJourney.refresh === 'function') {
                await window.socialJourney.refresh();
            }
            if (typeof showToast === 'function') showToast('Fitness diary shared to Feed!', 'success');
            return story;
        } catch (error) {
            console.error('Error sharing fitness diary to feed:', error);
            if (typeof showToast === 'function') showToast('Failed to share diary. Please try again.', 'error');
            if (btn) {
                btn.disabled = false;
                btn.textContent = btn.dataset.originalText || 'Share to Feed';
                btn.style.opacity = '1';
            }
            return null;
        }
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

        var goalsInput = document.getElementById('diary-goals');
        var highlightInput = document.getElementById('diary-highlight');
        var struggleInput = document.getElementById('diary-struggle');
        var noteInput = document.getElementById('diary-note');

        var dateKey = getTodayDateKey();
        var diaryPayload = {
            type: 'fitness_diary',
            date: dateKey,
            day_rating: window._fitnessDiaryData.day_rating,
            energy_level: window._fitnessDiaryData.energy_level,
            goals: (goalsInput && goalsInput.value.trim()) || null,
            highlight: (highlightInput && highlightInput.value.trim()) || null,
            struggle: (struggleInput && struggleInput.value.trim()) || null,
            note: (noteInput && noteInput.value.trim()) || null,
            timestamp: new Date().toISOString()
        };

        try {
            var existingAdditional = {};
            try {
                if (window.db && window.db.checkins && typeof window.db.checkins.get === 'function') {
                    var existingCheckin = await window.db.checkins.get(window.currentUser.id, dateKey);
                    if (existingCheckin && existingCheckin.additional_data && typeof existingCheckin.additional_data === 'object') {
                        existingAdditional = existingCheckin.additional_data;
                    }
                }
            } catch (_) {}

            var mergedAdditionalData = Object.assign({}, existingAdditional, diaryPayload, {
                fitness_diary: diaryPayload
            });

            // Save to daily_checkins using the existing upsert with additional_data
            await db.checkins.upsert(window.currentUser.id, dateKey, {
                energy: window._fitnessDiaryData.day_rating,
                additional_data: mergedAdditionalData
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
            window._lastFitnessDiaryPayload = diaryPayload;
            setFitnessDiaryStoredPayload(dateKey, diaryPayload);
            updateFitnessDiaryShareButtons(dateKey);
            setTimeout(function() {
                showFitnessDiaryFeedSharePrompt(buildFitnessDiaryFeedPayload(diaryPayload, dateKey));
            }, 650);

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
                        if (doneCard) {
                            doneCard.style.display = 'flex';
                            updateFitnessDiaryShareButtons(dateKey);
                        }
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
    window.openFitnessDiaryForAction = openFitnessDiaryForAction;
    window.selectFitnessDiaryOption = selectFitnessDiaryOption;
    window.submitFitnessDiary = submitFitnessDiary;
    window.shareFitnessDiaryToFeed = shareFitnessDiaryToFeed;
    window.showFitnessDiaryFeedSharePrompt = showFitnessDiaryFeedSharePrompt;
    window.closeFitnessDiaryFeedSharePrompt = closeFitnessDiaryFeedSharePrompt;
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

    async function awardMoodCheckinXp(currentWindow) {
        if (!window.currentUser || !window.supabaseClient) return 0;

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
            return xpAmount;
        } catch (xpErr) {
            console.log('Mood XP award skipped for ' + (currentWindow || 'check-in') + ':', xpErr);
            return 0;
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
            var moodXpAwarded = await awardMoodCheckinXp(currentWindow);
            if (typeof window.refreshWeeklyGoalsCard === 'function') {
                window.refreshWeeklyGoalsCard();
            }

            var completed = getMoodCompletedWindows();
            var allDone = completed.morning && completed.afternoon && completed.evening;

            var form = document.getElementById('mood-checkin-form');
            var success = document.getElementById('mood-checkin-success');
            var successText = document.getElementById('mood-checkin-success-text');
            var card = document.getElementById('mood-checkin-card');

            if (allDone) {
                if (form) form.style.display = 'none';
                if (success) success.style.display = 'block';
                if (successText) successText.textContent = 'All 3 check-ins done! +' + (moodXpAwarded || 1) + ' XP for this one.';

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
                    successText.textContent = getMoodWindowLabel(currentWindow) + ' logged! +' + (moodXpAwarded || 1) + ' XP earned. ' + remaining.join(' & ') + ' left.';
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

    function refreshDailyCardsAfterDeferredLoad() {
        var attempts = 0;
        function run() {
            attempts++;
            if (!window.currentUser) {
                if (attempts < 20) setTimeout(run, 500);
                return;
            }
            if (typeof checkAndShowWeighInCard === 'function') {
                Promise.resolve(checkAndShowWeighInCard()).catch(function(e) {
                    console.warn('Deferred daily card refresh failed: weigh-in', e);
                });
            }
            setTimeout(function() {
                if (typeof checkAndShowMoodCheckinCard === 'function') {
                    Promise.resolve(checkAndShowMoodCheckinCard()).catch(function(e) {
                        console.warn('Deferred daily card refresh failed: mood', e);
                    });
                }
            }, 150);
            setTimeout(function() {
                if (typeof checkAndShowFitnessDiaryCard === 'function') {
                    Promise.resolve(checkAndShowFitnessDiaryCard()).catch(function(e) {
                        console.warn('Deferred daily card refresh failed: diary', e);
                    });
                }
            }, 300);
        }
        setTimeout(run, 50);
    }

    refreshDailyCardsAfterDeferredLoad();

    // Keep the 5 PM rollover reliable when Balance stays open in the foreground.
    // Previously the card was only re-checked on load or after returning to the app.
    var _lastFitnessDiaryHour = new Date().getHours();
    setInterval(function() {
        if (document.visibilityState === 'hidden') return;
        var currentHour = new Date().getHours();
        if (currentHour === _lastFitnessDiaryHour) return;
        _lastFitnessDiaryHour = currentHour;
        Promise.resolve(checkAndShowFitnessDiaryCard()).then(function() {
            if (window.pbbNextSteps && typeof window.pbbNextSteps.refresh === 'function') {
                window.pbbNextSteps.refresh();
            }
        }).catch(function(e) {
            console.warn('Timed daily card refresh failed: diary', e);
        });
    }, 30000);

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
                if (typeof checkAndShowNudgeFriendsCard === 'function') checkAndShowNudgeFriendsCard();
                if (typeof initPerformanceCard === 'function') initPerformanceCard();
                if (typeof initFitbitDashboard === 'function') initFitbitDashboard();
                if (typeof initWhoopDashboard === 'function') initWhoopDashboard();
                if (typeof initOuraDashboard === 'function') initOuraDashboard();
                if (typeof initSpotifyDashboard === 'function') initSpotifyDashboard();
            }
        }
    });
