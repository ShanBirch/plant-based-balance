// checkInProgress already defined above
if (typeof window.checkInProgress === 'undefined') {
    window.checkInProgress = { flow: null, symptoms: [], mood: null, energy: null, fluid: null, equipment: null, recovery: null };
}

function selectCheckInOption(category, value, el) {
    window.checkInProgress[category] = value;
    const options = document.querySelectorAll('.check-in-chip[data-group="' + category + '"]');
    options.forEach(function(opt) { opt.classList.remove('selected'); });
    el.classList.add('selected');
}

function toggleCheckInOption(category, value, el) {
    if (!window.checkInProgress[category]) window.checkInProgress[category] = [];
    var idx = window.checkInProgress[category].indexOf(value);
    if (idx > -1) {
        window.checkInProgress[category].splice(idx, 1);
        el.classList.remove('selected');
    } else {
        window.checkInProgress[category].push(value);
        el.classList.add('selected');
    }
}

function openCheckInModal() {
    if (typeof applyGenderSpecificUI === 'function') {
        applyGenderSpecificUI();
    }
    document.getElementById('check-in-modal').style.display = 'flex';
}

function closeCheckInModal() {
    document.getElementById('check-in-modal').style.display = 'none';
}

function formatCheckInValue(value) {
    return String(value || '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, function(match) { return match.toUpperCase(); });
}

function escapeCheckInHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getDailyCheckInDateKey() {
    return typeof getLocalDateString === 'function'
        ? getLocalDateString()
        : new Date().toISOString().slice(0, 10);
}

function getDailyCheckInSource(dateKey) {
    const logs = window.userCycleData && window.userCycleData.logs;
    if (logs && logs[dateKey]) return logs[dateKey];
    return window.checkInProgress || {};
}

function buildDailyCheckInFeedPayload() {
    const dateKey = getDailyCheckInDateKey();
    const source = getDailyCheckInSource(dateKey);
    const isMale = typeof isMaleUser === 'function' && isMaleUser();
    const symptoms = Array.isArray(source.symptoms) ? source.symptoms : [];

    return {
        card_type: 'daily_checkin',
        checkin_date: dateKey,
        title: isMale ? 'Daily recovery check-in' : 'Daily check-in',
        energy: source.energy || null,
        mood: source.mood || null,
        recovery: source.recovery || null,
        equipment: source.equipment || null,
        flow: source.flow || null,
        fluid: source.fluid || null,
        symptoms: symptoms,
        timestamp: source.timestamp || new Date().toISOString()
    };
}

function isDailyCheckInShared(dateKey) {
    try {
        return localStorage.getItem('pbbDailyCheckInSharedToFeed_' + dateKey) === '1';
    } catch (_) {
        return false;
    }
}

function markDailyCheckInShared(dateKey) {
    try {
        localStorage.setItem('pbbDailyCheckInSharedToFeed_' + dateKey, '1');
    } catch (_) {}
}

function closeDailyCheckInFeedSharePrompt() {
    const prompt = document.getElementById('daily-checkin-feed-share-prompt');
    if (prompt) prompt.remove();
}

async function shareDailyCheckInToFeed(btn) {
    if (!window.currentUser) {
        if (typeof showToast === 'function') showToast('You must be logged in to share', 'error');
        return null;
    }

    const dateKey = getDailyCheckInDateKey();
    if (isDailyCheckInShared(dateKey)) {
        if (typeof showToast === 'function') showToast('Today\'s check-in is already shared to Feed', 'info');
        closeDailyCheckInFeedSharePrompt();
        return null;
    }

    const helpers = window.dbHelpers || (typeof dbHelpers !== 'undefined' ? dbHelpers : null);
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
        const payload = buildDailyCheckInFeedPayload();
        const storyData = {
            media_type: 'checkin_card',
            media_url: '',
            thumbnail_url: null,
            caption: JSON.stringify(payload),
            duration: 5
        };

        let story;
        try {
            story = await helpers.stories.create(window.currentUser.id, storyData);
        } catch (storyError) {
            const message = String(storyError && (storyError.message || storyError.details || storyError.code) || '');
            if (!/media_type|checkin_card|check constraint|violates/i.test(message)) throw storyError;
            story = await helpers.stories.create(window.currentUser.id, Object.assign({}, storyData, {
                media_type: 'level_up_card'
            }));
        }

        markDailyCheckInShared(dateKey);
        closeDailyCheckInFeedSharePrompt();
        if (typeof loadPhotoFeed === 'function') {
            loadPhotoFeed('friends-photo-feed', 'friends-feed-empty');
        }
        if (typeof window.refreshWeeklyGoalsCard === 'function') {
            window.refreshWeeklyGoalsCard();
        }
        if (typeof showToast === 'function') showToast('Daily check-in shared to Feed!', 'success');
        return story;
    } catch (error) {
        console.error('Error sharing daily check-in to feed:', error);
        if (typeof showToast === 'function') showToast('Failed to share check-in. Please try again.', 'error');
        if (btn) {
            btn.disabled = false;
            btn.textContent = btn.dataset.originalText || 'Share';
            btn.style.opacity = '1';
        }
        return null;
    }
}

function showDailyCheckInFeedSharePrompt() {
    if (!document.body) return;
    const dateKey = getDailyCheckInDateKey();
    if (isDailyCheckInShared(dateKey)) return;

    closeDailyCheckInFeedSharePrompt();
    const payload = buildDailyCheckInFeedPayload();
    const detailBits = [
        payload.energy ? 'Energy: ' + formatCheckInValue(payload.energy) : '',
        payload.recovery ? 'Recovery: ' + formatCheckInValue(payload.recovery) : '',
        payload.mood ? 'Mood: ' + formatCheckInValue(payload.mood) : ''
    ].filter(Boolean);

    const prompt = document.createElement('div');
    prompt.id = 'daily-checkin-feed-share-prompt';
    prompt.style.cssText = 'position:fixed;left:14px;right:14px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:10031;background:#ffffff;border:1px solid #bbf7d0;border-radius:16px;box-shadow:0 18px 42px rgba(15,23,42,0.22);padding:14px;display:flex;align-items:center;gap:12px;font-family:inherit;';
    prompt.innerHTML = `
        <div style="width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#046a38,#14b8a6);display:flex;align-items:center;justify-content:center;color:white;flex-shrink:0;">
            <svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v14"/></svg>
        </div>
        <div style="flex:1;min-width:0;">
            <div style="font-size:0.86rem;font-weight:900;color:#0f172a;line-height:1.25;">Share today's check-in?</div>
            <div style="font-size:0.74rem;font-weight:700;color:#64748b;line-height:1.25;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeCheckInHtml(detailBits.length ? detailBits.join(' - ') : 'Post your daily update to the Feed.')}</div>
        </div>
        <button type="button" onclick="shareDailyCheckInToFeed(this)" style="border:none;background:#046a38;color:white;border-radius:999px;padding:10px 13px;font-size:0.78rem;font-weight:900;cursor:pointer;white-space:nowrap;">Share</button>
        <button type="button" onclick="closeDailyCheckInFeedSharePrompt()" aria-label="Dismiss check-in share prompt" style="border:none;background:#f1f5f9;color:#64748b;border-radius:999px;width:32px;height:32px;font-size:1.1rem;line-height:1;cursor:pointer;flex-shrink:0;">&times;</button>
    `;
    document.body.appendChild(prompt);
    setTimeout(function() {
        if (document.getElementById('daily-checkin-feed-share-prompt') === prompt) closeDailyCheckInFeedSharePrompt();
    }, 15000);
}

// Full implementation of submitDailyCycleSync
async function submitDailyCycleSync() {
    try {
        // 1. Save Log locally
        const today = getLocalDateString();
        if (typeof userCycleData === 'undefined') {
            window.userCycleData = JSON.parse(localStorage.getItem('userCycleData') || '{}');
        }
        if (!userCycleData.logs) userCycleData.logs = {};

        // Clone to avoid ref issues and add timestamp for priority comparisons
        userCycleData.logs[today] = JSON.parse(JSON.stringify(window.checkInProgress));
        userCycleData.logs[today].timestamp = new Date().toISOString();

        // Update userCycleData.symptoms from check-in
        userCycleData.symptoms = window.checkInProgress.symptoms || [];

        // Persist to localStorage
        localStorage.setItem('userCycleData', JSON.stringify(userCycleData));

        // 2. Save to Supabase
        if (window.currentUser && typeof dbHelpers !== 'undefined') {
            try {
                await dbHelpers.checkins.upsert(window.currentUser.id, today, {
                    energy: window.checkInProgress.energy || null,
                    equipment: window.checkInProgress.equipment || null,
                    additional_data: {
                        symptoms: window.checkInProgress.symptoms || [],
                        mood: window.checkInProgress.mood || null,
                        flow: window.checkInProgress.flow || null,
                        fluid: window.checkInProgress.fluid || null,
                        recovery: window.checkInProgress.recovery || null
                    }
                });
                console.log('✅ Check-in saved to Supabase');
            } catch (e) {
                console.error('Failed to save check-in to DB:', e);
            }
        }

        // Mark check-in as completed for today
        localStorage.setItem('lastWellnessCheck', new Date().toDateString());

        // Save equipment selection
        if (window.checkInProgress.equipment && window.currentUser && typeof dbHelpers !== 'undefined') {
            try {
                await window.supabaseClient.from('quiz_results')
                    .update({ equipment_access: window.checkInProgress.equipment })
                    .eq('user_id', window.currentUser.id);

                const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
                userProfile.equipment_access = window.checkInProgress.equipment;
                userProfile.gym_access = (window.checkInProgress.equipment === 'gym');
                localStorage.setItem('userProfile', JSON.stringify(userProfile));
                if (window.userProfile) {
                    window.userProfile.equipment_access = window.checkInProgress.equipment;
                    window.userProfile.gym_access = (window.checkInProgress.equipment === 'gym');
                }
                console.log('✅ Equipment access saved:', window.checkInProgress.equipment);
            } catch (e) {
                console.warn('Failed to save equipment access:', e);
            }
        }

        // Update Active Symptoms display
        const symptomsDisplay = document.getElementById('profile-symptoms-display');
        if (symptomsDisplay) {
            const symptoms = window.checkInProgress.symptoms || [];
            if (symptoms.length > 0) {
                const formattedSymptoms = symptoms.map(s =>
                    s.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
                ).join(', ');
                symptomsDisplay.textContent = formattedSymptoms;
            } else {
                symptomsDisplay.textContent = 'None';
            }
        }

        // Trigger Cycle Sync Engine
        if (typeof applyCycleSync === 'function') applyCycleSync(window.checkInProgress);

        // Handle rest-indicating conditions - show yoga recommendation popup
        // IMPORTANT: Check this BEFORE refreshing views, as view refreshes may interfere
        const isMale = (typeof isMaleUser === 'function' && isMaleUser());
        const symptoms = window.checkInProgress.symptoms || [];
        let yogaPopupReason = null;

        // Debug logging for yoga popup trigger
        console.log('🧘 Yoga popup check:', {
            energy: window.checkInProgress.energy,
            recovery: window.checkInProgress.recovery,
            symptoms: symptoms,
            isMale: isMale
        });

        // Check for conditions that should trigger yoga recommendation
        if (window.checkInProgress.energy === 'low') {
            yogaPopupReason = 'low_energy';
        } else if (isMale && window.checkInProgress.recovery === 'tired') {
            yogaPopupReason = 'tired';
        } else if (isMale && window.checkInProgress.recovery === 'moderate') {
            yogaPopupReason = 'fatigued';
        } else if (isMale && symptoms.includes('muscle_soreness')) {
            yogaPopupReason = 'muscle_soreness';
        } else if (symptoms.includes('back_pain')) {
            yogaPopupReason = 'back_pain';
        } else if (!isMale && symptoms.includes('cramps')) {
            yogaPopupReason = 'cramps';
        }

        if (yogaPopupReason) {
            console.log('🧘 Triggering yoga popup with reason:', yogaPopupReason);
            // Close the check-in modal first so the yoga popup is visible
            closeCheckInModal();
            if (typeof showLowEnergyYogaPopup === 'function') showLowEnergyYogaPopup(yogaPopupReason);
            return;
        } else {
            console.log('🧘 No yoga popup needed');
        }

        // Close & Refresh views (only if no yoga popup shown)
        closeCheckInModal();
        if (typeof initCycleView === 'function') initCycleView();
        if (typeof renderWeeklyCalendar === 'function') renderWeeklyCalendar();
        if (typeof renderMovementView === 'function') renderMovementView();

        // Clear any workout override
        localStorage.removeItem('todayWorkoutOverride');
        if (userCycleData.logs && userCycleData.logs[today]) {
            delete userCycleData.logs[today].workoutOverride;
            localStorage.setItem('userCycleData', JSON.stringify(userCycleData));
        }

        if (typeof switchAppTab === 'function') switchAppTab('dashboard');
        if (typeof showCycleSyncBanner === 'function') {
            showCycleSyncBanner();
        } else {
            showDailyCheckInFeedSharePrompt();
        }

    } catch (err) {
        console.error('Error in submitDailyCycleSync:', err);
        alert('There was an error saving your check-in. Please try again.');
    }
}

// Expose to global scope
window.selectCheckInOption = selectCheckInOption;
window.toggleCheckInOption = toggleCheckInOption;
window.openCheckInModal = openCheckInModal;
window.closeCheckInModal = closeCheckInModal;
window.submitDailyCycleSync = submitDailyCycleSync;
window.shareDailyCheckInToFeed = shareDailyCheckInToFeed;
window.showDailyCheckInFeedSharePrompt = showDailyCheckInFeedSharePrompt;
window.closeDailyCheckInFeedSharePrompt = closeDailyCheckInFeedSharePrompt;
