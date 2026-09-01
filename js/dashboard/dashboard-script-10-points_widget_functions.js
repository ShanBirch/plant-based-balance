// ==========================================
// POINTS WIDGET FUNCTIONS
// ==========================================

const POINTS_FOR_FREE_WEEK = 200;
const LEVEL_CURVE_MULTIPLIER = 0.07;
const LEVEL_CURVE_EXPONENT = 2.4;
const LEVEL_LINEAR_BONUS = 0.7;

function pbbPointsWeightUnit() {
    try {
        return localStorage.getItem('weightUnitPreference') === 'lbs' ? 'lbs' : 'kg';
    } catch (e) {
        return 'kg';
    }
}

function pbbPointsFormatWeightFromKg(weightKg) {
    if (typeof formatWorkoutWeightFromKg === 'function') return formatWorkoutWeightFromKg(weightKg);
    const kg = Number(weightKg);
    if (!Number.isFinite(kg) || kg <= 0) return '-';
    if (pbbPointsWeightUnit() === 'lbs') return (kg * 2.20462).toFixed(1).replace(/\.0$/, '') + ' lbs';
    return kg.toFixed(1).replace(/\.0$/, '') + ' kg';
}

function pbbPointsFormatVolumeFromKg(volumeKg) {
    if (typeof formatWorkoutVolumeFromKg === 'function') return formatWorkoutVolumeFromKg(volumeKg);
    const kg = Number(volumeKg) || 0;
    if (pbbPointsWeightUnit() === 'lbs') return Math.round(kg * 2.20462).toLocaleString() + ' lbs';
    return Math.round(kg).toLocaleString() + ' kg';
}

// Calculate points required for a given level
function getPointsForLevel(level) {
    if (level <= 1) return 0;
    return Math.floor(LEVEL_CURVE_MULTIPLIER * Math.pow(level, LEVEL_CURVE_EXPONENT) + LEVEL_LINEAR_BONUS * level);
}

// Calculate user's current level from lifetime points
function calculateLevel(lifetimePoints) {
    const parsedLifetimePoints = Number(lifetimePoints);
    const safeLifetimePoints = Number.isFinite(parsedLifetimePoints) ? Math.max(0, parsedLifetimePoints) : 0;
    let level = 1;

    while (true) {
        const pointsNeeded = getPointsForLevel(level + 1);
        if (safeLifetimePoints < pointsNeeded) break;
        level++;
    }

    const currentLevelPoints = getPointsForLevel(level);
    const nextLevelPoints = getPointsForLevel(level + 1);
    const pointsIntoLevel = safeLifetimePoints - currentLevelPoints;
    const pointsNeededForNext = nextLevelPoints - currentLevelPoints;
    const progress = Math.min(100, Math.floor((pointsIntoLevel / pointsNeededForNext) * 100));

    return {
        level,
        currentLevelPoints,
        nextLevelPoints,
        pointsIntoLevel,
        pointsNeededForNext,
        progress,
        isMaxLevel: false
    };
}

// Get level title based on level
function getLevelTitle(level) {
    if (level >= 99) return 'Legend';
    if (level >= 90) return 'Master';
    if (level >= 80) return 'Champion';
    if (level >= 70) return 'Expert';
    if (level >= 60) return 'Veteran';
    if (level >= 50) return 'Dedicated';
    if (level >= 40) return 'Committed';
    if (level >= 30) return 'Consistent';
    if (level >= 20) return 'Growing';
    if (level >= 10) return 'Rising';
    if (level >= 5) return 'Beginner';
    return 'Newcomer';
}

// Load and display user's points data
async function loadPointsWidget() {
    // Always show the widget (even with default values)
    const widget = document.getElementById('points-widget');
    if (widget) {
        widget.style.display = 'block';
    }

    try {
        const session = await window.authHelpers?.getSession();
        if (!session?.user) {
            console.log('No user session, skipping points update to preserve cached level');
            return;
        }

        const userId = window.currentUser.id;

        // Try to get points data, fall back to defaults if table doesn't exist
        let pointsData = { current_points: 0, current_streak: 0 };
        try {
            const data = await window.db?.points?.getPoints(userId);
            if (data) {
                pointsData = data;
            }
        } catch (dbError) {
            console.log('Points table not set up yet, using defaults');
        }

        // Update points display
        updatePointsDisplay(pointsData);

    } catch (error) {
        console.error('Error loading points widget:', error);
        // Don't call updatePointsDisplay with zeroed-out defaults here;
        // it would reset level to 1 and overwrite the localStorage cache.
    }
}

// Expose to window for other scripts (stories.js) to refresh points
window.loadUserPoints = loadPointsWidget;
// Alias for learning-inline.js and other scripts that call refreshLevelDisplay
window.refreshLevelDisplay = loadPointsWidget;

// Update points display with current data
function updatePointsDisplay(pointsData) {
    const currentPoints = pointsData.current_points || 0;
    const lifetimePoints = pointsData.lifetime_points || 0;
    const currentStreak = pointsData.current_streak || 0;

    // Calculate level from lifetime points
    const levelData = calculateLevel(lifetimePoints);

    // Only update level-related UI when we have real data.
    // When lifetime_points is missing (0) but a cached level exists,
    // skip overwriting to prevent resetting a high-level user to level 1.
    const hasRealLevelData = lifetimePoints > 0 || !parseInt(localStorage.getItem('fitgotchi_level'));

    if (hasRealLevelData) {
        // Update level display
        const levelEl = document.getElementById('level-current');
        if (levelEl) {
            levelEl.textContent = levelData.level;
        }

        // Update SVG level ring progress (circumference = 2 * PI * 45 ≈ 283)
        const levelRingSvg = document.getElementById('level-ring-svg');
        if (levelRingSvg) {
            const circumference = 283;
            const offset = circumference - (levelData.progress / 100) * circumference;
            levelRingSvg.style.strokeDashoffset = offset;
        }

        // Update level title
        const levelTitleEl = document.getElementById('level-title');
        if (levelTitleEl) {
            levelTitleEl.textContent = getLevelTitle(levelData.level);
        }

        // Update level progress bar
        const levelProgressFill = document.getElementById('level-progress-fill');
        if (levelProgressFill) {
            levelProgressFill.style.width = `${levelData.progress}%`;
        }

        // Update level progress label
        const levelProgressLabel = document.getElementById('level-progress-label');
        if (levelProgressLabel) {
            if (levelData.isMaxLevel) {
                levelProgressLabel.textContent = 'MAX LEVEL - Legend!';
            } else {
                const xpToNext = levelData.pointsNeededForNext - levelData.pointsIntoLevel;
                levelProgressLabel.textContent = `${xpToNext} XP to Level ${levelData.level + 1}`;
            }
        }

        // Keep the compact Home level bar in sync when the character is hidden.
        const compactLevel = document.getElementById('balance-level-number');
        const compactRank = document.getElementById('balance-level-rank');
        const compactXp = document.getElementById('balance-level-xp-text');
        const compactFill = document.getElementById('balance-level-xp-fill');
        const compactTrack = compactFill?.parentElement;
        if (compactLevel) compactLevel.textContent = levelData.level;
        if (compactRank) compactRank.textContent = getLevelTitle(levelData.level);
        if (compactXp) {
            compactXp.textContent = levelData.isMaxLevel
                ? 'MAX LEVEL'
                : `${levelData.pointsIntoLevel} / ${levelData.pointsNeededForNext} XP`;
        }
        if (compactFill) compactFill.style.width = `${levelData.progress}%`;
        if (compactTrack) compactTrack.setAttribute('aria-valuenow', String(levelData.progress));
    }

    // Update points number
    const pointsEl = document.getElementById('points-current');
    if (pointsEl) {
        pointsEl.textContent = currentPoints.toLocaleString();
    }

    // Update streak
    const streakEl = document.getElementById('streak-current');
    if (streakEl) {
        streakEl.textContent = currentStreak;
    }

    // Update progress bar
    const progressPercent = Math.min(100, (currentPoints / POINTS_FOR_FREE_WEEK) * 100);
    const progressFill = document.getElementById('points-progress-fill');
    if (progressFill) {
        progressFill.style.width = `${progressPercent}%`;
    }

    // Update progress label
    const progressLabel = document.getElementById('points-progress-label');
    if (progressLabel) {
        const remaining = POINTS_FOR_FREE_WEEK - currentPoints;
        if (currentPoints >= POINTS_FOR_FREE_WEEK) {
            progressLabel.textContent = 'Ready to redeem a free week!';
        } else {
            progressLabel.textContent = `${currentPoints}/${POINTS_FOR_FREE_WEEK} to free week`;
        }
    }

    // UPDATE FITGOTCHI WIDGET
    if (typeof window.updateFitGotchi === 'function') {
        window.updateFitGotchi(pointsData);
    }
}

// Redeem points for free week
async function redeemPointsForFreeWeek() {
    try {
        const session = await window.authHelpers?.getSession();
        if (!session?.user) {
            alert('Please log in to redeem points');
            return;
        }

        const redeemBtn = document.getElementById('redeem-btn');
        if (redeemBtn) {
            redeemBtn.disabled = true;
            redeemBtn.textContent = 'Redeeming...';
        }

        const result = await window.db?.points?.redeemPoints(window.currentUser.id);

        if (result?.success) {
            showMilestoneToast({
                label: 'Free Week Unlocked!',
                points: -POINTS_FOR_FREE_WEEK
            });

            // Refresh points display
            await loadPointsWidget();

            alert(`Congratulations! You've earned 7 free days!\n\nYour subscription has been extended.`);
        } else {
            alert(result?.message || 'Could not redeem points. Please try again.');
            // Re-enable button
            if (redeemBtn) {
                redeemBtn.disabled = false;
                redeemBtn.textContent = 'Redeem Free Week!';
            }
        }
    } catch (error) {
        console.error('Error redeeming points:', error);
        alert('An error occurred. Please try again.');
    }
}

// Show milestone achievement toast
function showMilestoneToast(milestone) {
    const toast = document.createElement('div');
    toast.className = 'milestone-toast';
    toast.innerHTML = `
        <div class="milestone-icon">&#x1F389;</div>
        <div>
            <div class="milestone-title">${milestone.label}</div>
            ${milestone.points > 0 ? `<div class="milestone-points">+${milestone.points} points</div>` : ''}
        </div>
    `;

    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after 4 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Show points earned toast
function showPointsEarnedToast(points, bonusPoints = 0, streak = 0) {
    const toast = document.createElement('div');
    toast.className = 'points-earned-toast';
    toast.innerHTML = `
        <div class="points-earned-main">+${points} pt${points > 1 ? 's' : ''}</div>
        ${bonusPoints > 0 ? `<div class="points-earned-bonus">+${bonusPoints} streak bonus!</div>` : ''}
        ${streak > 0 ? `<div class="points-earned-streak">&#x1F525; ${streak}</div>` : ''}
    `;

    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Play level-up sound effect using Web Audio API
function playLevelUpSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        // Create a celebratory ascending arpeggio
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        const noteDuration = 0.15;

        notes.forEach((freq, index) => {
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime + index * noteDuration);

            // Envelope
            gainNode.gain.setValueAtTime(0, audioCtx.currentTime + index * noteDuration);
            gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + index * noteDuration + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + index * noteDuration + noteDuration);

            oscillator.start(audioCtx.currentTime + index * noteDuration);
            oscillator.stop(audioCtx.currentTime + index * noteDuration + noteDuration);
        });

        // Final triumphant chord
        const chordDelay = notes.length * noteDuration;
        const chordFreqs = [523.25, 659.25, 783.99]; // C major chord
        chordFreqs.forEach(freq => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime + chordDelay);
            gain.gain.setValueAtTime(0, audioCtx.currentTime + chordDelay);
            gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + chordDelay + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + chordDelay + 0.5);
            osc.start(audioCtx.currentTime + chordDelay);
            osc.stop(audioCtx.currentTime + chordDelay + 0.5);
        });
    } catch (e) {
        console.log('Could not play level up sound:', e);
    }
}

// Create expanding glow rings effect
function createGlowRings() {
    const container = document.createElement('div');
    container.className = 'level-up-rings-container';

    for (let i = 0; i < 4; i++) {
        const ring = document.createElement('div');
        ring.className = 'level-up-ring';
        container.appendChild(ring);
    }

    document.body.appendChild(container);

    // Remove after animation completes
    setTimeout(() => container.remove(), 2000);
}

// Trigger victory animation on Shazie
function triggerVictoryAnimation() {
    const mv = document.getElementById('tamagotchi-model');
    if (!mv) return;

    function playVictoryAnim() {
        if (!mv.availableAnimations || !mv.availableAnimations.length) return;

        // Prioritise dance animations for level-up celebrations
        const victoryAnim = mv.availableAnimations.find(a =>
            a === 'dance' ||
            a === 'dance_1'
        ) || mv.availableAnimations.find(a =>
            a === 'clap' ||
            a === 'arms_up_still' ||
            a === 'laugh'
        ) || mv.availableAnimations.find(a =>
            a === 'greet' ||
            a === 'strut' ||
            a === 'warm_up'
        );

        if (victoryAnim) {
            mv.animationName = victoryAnim;
            mv.play();

            // Loop the dance: replay once after the first play to fill the celebration window
            setTimeout(() => {
                if (mv.animationName === victoryAnim) {
                    mv.currentTime = 0;
                    mv.play();
                }
            }, 2500);

            // Return to the shared resting loop after celebration
            setTimeout(() => {
                if (window.applyIdleAnimation) {
                    window.applyIdleAnimation(mv);
                } else {
                    mv.pause();
                    mv.currentTime = 0;
                }
            }, 6000);
        }
    }

    // If model already has animations loaded, play immediately
    if (mv.availableAnimations && mv.availableAnimations.length) {
        playVictoryAnim();
    } else {
        // Wait for model to finish loading before playing animation
        mv.addEventListener('load', function onModelLoad() {
            mv.removeEventListener('load', onModelLoad);
            setTimeout(playVictoryAnim, 200);
        });
    }
}

// Show animation unlock notification
function showAnimationUnlockToast(animInfo) {
    const toast = document.createElement('div');
    toast.className = 'animation-unlock-toast';
    toast.innerHTML = `
        <div class="animation-unlock-icon">${animInfo.icon}</div>
        <div class="animation-unlock-title">New Move Unlocked!</div>
        <div class="animation-unlock-name">${animInfo.displayName}</div>
    `;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Check for newly unlocked animations when leveling up
function checkNewAnimationUnlocks(previousLevel, newLevel) {
    const mv = document.getElementById('tamagotchi-model');
    if (!mv || !mv.availableAnimations) return;

    // Check for milestone unlocks (character skin, battle mode, backgrounds)
    const MILESTONE_UNLOCKS = [
        { level: 5, displayName: 'Newcomer Skin', icon: '🧑', category: 'milestone' },
        { level: 5, displayName: 'Gym Background', icon: '🏋️', category: 'milestone' },
        { level: 10, displayName: 'Battle Mode', icon: '🥊', category: 'milestone' },
        { level: 10, displayName: 'Rising Skin', icon: '💪', category: 'milestone' },
    ];

    const newMilestones = MILESTONE_UNLOCKS.filter(m => previousLevel < m.level && newLevel >= m.level);
    newMilestones.forEach((milestone, index) => {
        setTimeout(() => {
            showAnimationUnlockToast(milestone);
        }, 1500 + (index * 3000));
    });

    // Find animations that were just unlocked
    const newlyUnlocked = ANIMATION_UNLOCKS.filter(unlock => {
        // Was locked before, unlocked now
        const wasLocked = previousLevel < unlock.unlockLevel;
        const isUnlockedNow = newLevel >= unlock.unlockLevel;

        // Check if this animation actually exists in the model
        const existsInModel = mv.availableAnimations.some(a =>
            a.toLowerCase() === unlock.name.toLowerCase()
        );

        return wasLocked && isUnlockedNow && existsInModel;
    });

    // Show unlock toasts with delay between each (after milestones)
    const milestoneDelay = newMilestones.length * 3000 + 1500;
    newlyUnlocked.forEach((unlock, index) => {
        setTimeout(() => {
            showAnimationUnlockToast(unlock);
        }, milestoneDelay + (index * 3500));
    });
}

// Trigger XP bar rainbow flash
function triggerXPBarRainbow() {
    const xpBar = document.getElementById('tamagotchi-xp-bar');
    if (xpBar) {
        xpBar.classList.add('xp-bar-rainbow');
        setTimeout(() => xpBar.classList.remove('xp-bar-rainbow'), 1500);
    }
}

function showLevelUpSidePulse(newLevel, title, previousLevel = null) {
    try {
        document.querySelectorAll('.level-up-side-pulse').forEach(el => el.remove());

        const pulse = document.createElement('div');
        pulse.className = 'level-up-side-pulse';
        if (window.__balanceGuidedTourActive) {
            pulse.classList.add('walkthrough-level-up-side-pulse');
            pulse.style.zIndex = '400002';
        }
        const levelsGained = previousLevel ? Math.max(1, newLevel - previousLevel) : 1;
        const levelLabel = levelsGained > 1 ? `+${levelsGained} levels` : `Level ${newLevel}`;

        pulse.innerHTML = `
            <div class="level-up-side-pulse-content">
                <div class="level-up-side-pulse-badge">${newLevel}</div>
                <div>
                    <div class="level-up-side-pulse-kicker">Level up</div>
                    <div class="level-up-side-pulse-title">${levelLabel}</div>
                    <div class="level-up-side-pulse-rank">${title}</div>
                </div>
            </div>
        `;

        document.body.appendChild(pulse);
        setTimeout(() => pulse.remove(), 4200);
    } catch (e) {
        console.warn('Level-up side pulse failed:', e);
    }
}

function playWalkthroughLevelUpCelebration(payload) {
    if (!payload) return;
    try {
        window.__balancePendingStatAllocationModal = true;
        showLevelUpSidePulse(payload.newLevel, payload.title, payload.previousLevel);
        if (typeof triggerXPBarRainbow === 'function') triggerXPBarRainbow();
        if (typeof triggerVictoryAnimation === 'function' && currentActiveTab === 'dashboard') {
            triggerVictoryAnimation();
        }
        if (payload.previousLevel && typeof checkNewAnimationUnlocks === 'function') {
            checkNewAnimationUnlocks(payload.previousLevel, payload.newLevel);
        }
        if (payload.previousLevel && payload.newLevel > payload.previousLevel && typeof window.grantStatPointsForLevelUp === 'function') {
            window.grantStatPointsForLevelUp(payload.previousLevel, payload.newLevel);
        }
        if (typeof window.applyBackgroundForLevel === 'function') {
            window.applyBackgroundForLevel(payload.newLevel);
        }
        if (typeof window.updateBattleButtonLock === 'function') {
            window.updateBattleButtonLock();
        }
    } catch (e) {
        console.warn('[tour] walkthrough level-up side celebration failed', e);
    }
}

function showWalkthroughXpPulse(points) {
    try {
        const amount = Math.max(1, Number(points) || 1);
        document.querySelectorAll('.walkthrough-xp-pulse').forEach(el => el.remove());

        const pulse = document.createElement('div');
        pulse.className = 'walkthrough-xp-pulse';
        pulse.innerHTML = `
            <div class="walkthrough-xp-pulse-orb">+${amount}</div>
            <div>
                <div class="walkthrough-xp-pulse-label">XP earned</div>
                <div class="walkthrough-xp-pulse-sub">Walkthrough</div>
            </div>
        `;

        document.body.appendChild(pulse);
        setTimeout(() => pulse.remove(), 2200);
    } catch (e) {
        console.warn('[tour] walkthrough XP pulse failed', e);
    }
}

let levelUpStatAllocationRetryTimer = null;

function isRareUnlockCelebrationVisible() {
    const modal = document.getElementById('rare-unlock-celebration');
    if (!modal) return false;
    if (modal.style.display && modal.style.display !== 'none') return true;
    return modal.classList.contains('active') || modal.classList.contains('show');
}

function queueLevelUpStatAllocationModal(delayMs = 800) {
    if (window.isAdminViewing || window.guestMode) return;
    if (levelUpStatAllocationRetryTimer) {
        clearTimeout(levelUpStatAllocationRetryTimer);
        levelUpStatAllocationRetryTimer = null;
    }

    const startedAt = Date.now();
    const retryWhileMissingMs = 20000;
    const rareUnlockGraceMs = 3000;
    const rareUnlockMaxWaitMs = 90000;

    const tryShow = () => {
        levelUpStatAllocationRetryTimer = null;
        if (window.isAdminViewing || window.guestMode) return;
        if (document.getElementById('stat-alloc-overlay')) return;

        const elapsed = Date.now() - startedAt;
        const waitingForRareUnlock = isRareUnlockCelebrationVisible()
            || (window._showStatAllocationAfterRareUnlock && elapsed < rareUnlockGraceMs);

        if (waitingForRareUnlock) {
            if (elapsed < rareUnlockMaxWaitMs) {
                levelUpStatAllocationRetryTimer = setTimeout(tryShow, 1200);
            }
            return;
        }

        if (window._showStatAllocationAfterRareUnlock && !isRareUnlockCelebrationVisible()) {
            window._showStatAllocationAfterRareUnlock = false;
        }

        if (typeof window.showStatAllocationModal === 'function') {
            window.showStatAllocationModal();
            if (document.getElementById('stat-alloc-overlay')) return;
        }

        if (elapsed < retryWhileMissingMs) {
            levelUpStatAllocationRetryTimer = setTimeout(tryShow, 1000);
        }
    };

    levelUpStatAllocationRetryTimer = setTimeout(tryShow, Math.max(0, Number(delayMs) || 0));
}

window.queueLevelUpStatAllocationModal = queueLevelUpStatAllocationModal;

/**
 * NEW LEVEL UP CELEBRATION SYSTEM
 * Shows celebration directly in the Tamagotchi widget instead of as a popup toast.
 * Auto-navigates to dashboard, plays dance animation, and animates the XP bar.
 * Persists pending celebration to localStorage so it survives page reloads.
 */
function triggerLevelUpCelebration(newLevel, title, previousLevel = null, lifetimePoints = 0, currentStreak = 0, previousProgress = 0) {
    if (window.isAdminViewing) return; // Admin view-as is read-only
    showLevelUpSidePulse(newLevel, title, previousLevel);
    console.log('🎉 Level Up Celebration triggered!', { newLevel, title, previousLevel });

    // Persist celebration data so it can be recovered if page reloads mid-flow
    try {
        localStorage.setItem('pendingLevelUpCelebration', JSON.stringify({
            newLevel, title, previousLevel, lifetimePoints, currentStreak, previousProgress,
            timestamp: Date.now()
        }));
    } catch (e) { /* ignore storage errors */ }

    // Get the previous title for rank transition display
    const previousTitle = previousLevel ? getLevelTitle(previousLevel) : null;
    const showRankTransition = previousTitle && previousTitle !== title;

    // Calculate new progress percentage for the new level
    const newLevelData = calculateLevel(lifetimePoints);
    const newProgress = newLevelData.progress || 0;

    // Step 1: Navigate to dashboard if not already there
    if (currentActiveTab !== 'dashboard') {
        // Find the dashboard nav button
        const dashboardBtn = document.querySelector('.bottom-nav .nav-item');
        switchAppTab('dashboard', dashboardBtn);
        // Wait for navigation transition then scroll to top so character is visible
        setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            startCelebrationSequence();
        }, 500);
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        startCelebrationSequence();
    }

    function startCelebrationSequence() {
        const overlay = document.getElementById('tamagotchi-levelup-overlay');
        const banner = document.getElementById('levelup-banner');
        const statsBar = document.getElementById('tamagotchi-stats-bar');
        const xpBar = document.getElementById('tamagotchi-xp-bar');
        const levelDisplay = document.getElementById('tamagotchi-level');
        const rankDisplay = document.getElementById('tamagotchi-rank');
        const xpText = document.getElementById('tamagotchi-xp-text');

        if (!overlay || !banner) {
            console.log('Level up overlay elements not found, falling back to toast');
            showLevelUpToast(newLevel, title, previousLevel, lifetimePoints, currentStreak);
            clearPendingCelebration();
            queueLevelUpStatAllocationModal(5500);
            return;
        }

        // Clear any existing celebration elements
        overlay.innerHTML = '';

        // Step 2: Play sound
        playLevelUpSound();

        // Step 3: Full-screen flash effect for impact
        const flash = document.createElement('div');
        flash.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(255,215,0,0.4);z-index:9998;pointer-events:none;animation:celebrationFlash 0.6s ease-out forwards;';
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 700);

        // Step 4: Activate overlay and add effects
        overlay.classList.add('active');

        // Add burst effect
        const burst = document.createElement('div');
        burst.className = 'levelup-burst';
        overlay.appendChild(burst);

        // Add sparkle particles (more particles for bigger celebration)
        for (let i = 0; i < 30; i++) {
            setTimeout(() => {
                const sparkle = document.createElement('div');
                sparkle.className = 'levelup-sparkle';
                sparkle.style.left = `${10 + Math.random() * 80}%`;
                sparkle.style.bottom = `${10 + Math.random() * 40}%`;
                sparkle.style.animationDelay = `${Math.random() * 0.5}s`;
                sparkle.style.animationDuration = `${1.5 + Math.random()}s`;
                overlay.appendChild(sparkle);
            }, i * 40);
        }

        // Add rising stars
        const starPositions = [15, 30, 42, 58, 70, 85];
        starPositions.forEach((pos, i) => {
            setTimeout(() => {
                const star = document.createElement('div');
                star.className = 'levelup-star';
                star.textContent = '⭐';
                star.style.left = `${pos}%`;
                star.style.bottom = '30%';
                star.style.animationDelay = `${i * 0.12}s`;
                overlay.appendChild(star);
            }, 200 + i * 80);
        });

        // Add confetti - first wave
        const confettiColors = ['#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96E6A1', '#FF69B4', '#9B59B6'];
        for (let i = 0; i < 40; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.className = 'levelup-confetti';
                confetti.style.left = `${Math.random() * 100}%`;
                confetti.style.top = '-20px';
                confetti.style.backgroundColor = confettiColors[Math.floor(Math.random() * confettiColors.length)];
                confetti.style.animationDelay = `${Math.random() * 0.5}s`;
                confetti.style.animationDuration = `${2 + Math.random() * 1.5}s`;
                confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
                confetti.style.width = `${6 + Math.random() * 8}px`;
                confetti.style.height = `${6 + Math.random() * 8}px`;
                overlay.appendChild(confetti);
            }, i * 25);
        }

        // Second wave of confetti for sustained celebration
        setTimeout(() => {
            for (let i = 0; i < 25; i++) {
                setTimeout(() => {
                    const confetti = document.createElement('div');
                    confetti.className = 'levelup-confetti';
                    confetti.style.left = `${Math.random() * 100}%`;
                    confetti.style.top = '-20px';
                    confetti.style.backgroundColor = confettiColors[Math.floor(Math.random() * confettiColors.length)];
                    confetti.style.animationDelay = `${Math.random() * 0.3}s`;
                    confetti.style.animationDuration = `${2 + Math.random() * 1.5}s`;
                    confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
                    confetti.style.width = `${6 + Math.random() * 8}px`;
                    confetti.style.height = `${6 + Math.random() * 8}px`;
                    overlay.appendChild(confetti);
                }, i * 30);
            }
        }, 2000);

        // Step 5: Show level-up banner
        setTimeout(() => {
            banner.style.display = 'block';
            // Reset animation by removing and re-adding class
            banner.style.animation = 'none';
            banner.offsetHeight; // Trigger reflow
            banner.style.animation = 'bannerPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';

            // Update banner content
            document.getElementById('levelup-banner-number').textContent = newLevel;

            const rankContainer = document.getElementById('levelup-banner-rank');
            if (showRankTransition) {
                rankContainer.innerHTML = `
                    <div class="levelup-rank-transition">
                        <span class="levelup-rank-old">${previousTitle}</span>
                        <span class="levelup-rank-arrow">→</span>
                        <span class="levelup-rank-new">${title}</span>
                    </div>
                `;
            } else {
                rankContainer.textContent = title;
            }

            // Check for unlocked moves and display in banner
            const unlockedContainer = document.getElementById('levelup-unlocked-container');
            const unlockedIcon = document.getElementById('levelup-unlocked-icon');
            const unlockedText = document.getElementById('levelup-unlocked-text');

            if (unlockedContainer && previousLevel) {
                // Get newly unlocked animations for this level
                const mv = document.getElementById('tamagotchi-model');
                const availableAnims = mv?.availableAnimations || [];

                // Find animations unlocked at exactly this new level
                const newlyUnlocked = (typeof ANIMATION_UNLOCKS !== 'undefined' ? ANIMATION_UNLOCKS : []).filter(unlock => {
                    const wasLocked = previousLevel < unlock.unlockLevel;
                    const isUnlockedNow = newLevel >= unlock.unlockLevel;
                    const existsInModel = availableAnims.some(a =>
                        a.toLowerCase() === unlock.name.toLowerCase()
                    );
                    return wasLocked && isUnlockedNow && existsInModel;
                });

                if (newlyUnlocked.length > 0) {
                    // Show the first unlocked move (or combine if multiple)
                    const firstUnlock = newlyUnlocked[0];
                    unlockedIcon.textContent = firstUnlock.icon || '🎬';

                    if (newlyUnlocked.length === 1) {
                        unlockedText.textContent = firstUnlock.displayName;
                    } else {
                        // Multiple unlocks - show count
                        unlockedText.textContent = `${firstUnlock.displayName} +${newlyUnlocked.length - 1} more`;
                    }

                    unlockedContainer.style.display = 'block';
                    // Reset animation
                    unlockedContainer.style.animation = 'none';
                    unlockedContainer.offsetHeight;
                    unlockedContainer.style.animation = 'unlockSlideIn 0.5s ease-out 0.8s both';
                } else {
                    unlockedContainer.style.display = 'none';
                }
            } else if (unlockedContainer) {
                unlockedContainer.style.display = 'none';
            }
        }, 300);

        // Step 6: Trigger Shazie's celebration dance
        triggerVictoryAnimation();

        // Step 7: Animate XP bar (fill to 100%, then reset to new progress)
        if (xpBar) {
            // Set CSS variables for the animation
            xpBar.style.setProperty('--start-width', `${previousProgress}%`);
            xpBar.style.setProperty('--end-width', `${newProgress}%`);
            xpBar.classList.add('xp-bar-levelup-fill');

            setTimeout(() => {
                xpBar.classList.remove('xp-bar-levelup-fill');
                xpBar.style.width = `${newProgress}%`;
            }, 1600);
        }

        // Step 8: Update level number with animation
        if (levelDisplay) {
            setTimeout(() => {
                levelDisplay.textContent = newLevel;
                levelDisplay.classList.add('level-number-update');
                setTimeout(() => levelDisplay.classList.remove('level-number-update'), 600);
            }, 800);
        }

        // Step 9: Update rank display
        if (rankDisplay) {
            setTimeout(() => {
                rankDisplay.textContent = title.toUpperCase();
            }, 900);
        }

        // Step 10: Update XP text
        if (xpText && newLevelData) {
            setTimeout(() => {
                const pointsIntoLevel = newLevelData.pointsIntoLevel || 0;
                const pointsNeeded = newLevelData.pointsNeededForNext || 1;
                const nextLevel = newLevel + 1;
                xpText.textContent = `${pointsIntoLevel} / ${pointsNeeded} XP to Level ${nextLevel}`;
            }, 1000);
        }

        // Step 11: Glow effect on stats bar
        if (statsBar) {
            statsBar.classList.add('stats-bar-celebrating');
            setTimeout(() => statsBar.classList.remove('stats-bar-celebrating'), 3000);
        }

        // Step 12: Check for newly unlocked animations
        if (previousLevel) {
            checkNewAnimationUnlocks(previousLevel, newLevel);
        }

        // Step 13: Auto-share level-up to feed
        shareLevelUpToFeed({
            newLevel: newLevel,
            previousLevel: previousLevel,
            title: title,
            lifetimePoints: lifetimePoints
        });

        // Step 14: Clean up after celebration (6.5 seconds - gives dance time to finish)
        setTimeout(() => {
            overlay.classList.remove('active');
            banner.style.display = 'none';
            banner.style.animation = '';
            overlay.innerHTML = '';
            // Reset unlocked move container
            const unlockedContainer = document.getElementById('levelup-unlocked-container');
            if (unlockedContainer) {
                unlockedContainer.style.display = 'none';
                unlockedContainer.style.animation = '';
            }
            // Clear localStorage flag - celebration completed successfully
            clearPendingCelebration();

            // Step 15: Unlock level-gated rare characters, then show stat allocation.
            let levelRareUnlocked = false;
            try {
                if (typeof window.unlockLevelRareCharactersForLevel === 'function') {
                    const unlocks = window.unlockLevelRareCharactersForLevel(newLevel, previousLevel, {
                        celebrate: true,
                        delayMs: 500
                    });
                    levelRareUnlocked = Array.isArray(unlocks) && unlocks.length > 0;
                } else if (previousLevel && newLevel >= 55) {
                    localStorage.setItem('pendingLevelRareUnlockCheck', JSON.stringify({
                        newLevel,
                        previousLevel,
                        celebrate: true,
                        delayMs: 500,
                        timestamp: Date.now()
                    }));
                }
            } catch(e) {
                console.warn('[levelRare] unlock check failed:', e);
            }

            if (levelRareUnlocked) {
                window._showStatAllocationAfterRareUnlock = true;
                queueLevelUpStatAllocationModal(1200);
            } else {
                queueLevelUpStatAllocationModal(800);
            }
        }, 6500);
    }
}

// Clear pending celebration from localStorage
function clearPendingCelebration() {
    try { localStorage.removeItem('pendingLevelUpCelebration'); } catch (e) { /* ignore */ }
}

// Check for and replay any pending celebration that was interrupted (e.g. page reload)
function checkPendingLevelUpCelebration() {
    try {
        const raw = localStorage.getItem('pendingLevelUpCelebration');
        if (!raw) return;
        const data = JSON.parse(raw);
        // Only replay if less than 2 minutes old (prevent stale celebrations)
        if (Date.now() - data.timestamp > 120000) {
            clearPendingCelebration();
            return;
        }
        console.log('🎉 Replaying pending level-up celebration from localStorage');
        clearPendingCelebration(); // Clear first to prevent infinite loop
        triggerLevelUpCelebration(
            data.newLevel,
            data.title,
            data.previousLevel,
            data.lifetimePoints,
            data.currentStreak || 0,
            data.previousProgress || 0
        );
    } catch (e) {
        clearPendingCelebration();
    }
}

// Show level up toast with celebration (legacy - kept as fallback)
function showLevelUpToast(newLevel, title, previousLevel = null, lifetimePoints = 0, currentStreak = 0) {
    // Get the previous title if we have previous level
    const previousTitle = previousLevel ? getLevelTitle(previousLevel) : null;
    const showTitleTransition = previousTitle && previousTitle !== title;

    // Build stats HTML
    const statsHtml = `
        <div class="level-up-stats">
            <div class="level-up-stat">
                <div class="level-up-stat-value">${lifetimePoints}</div>
                <div class="level-up-stat-label">Total XP</div>
            </div>
            <div class="level-up-stat">
                <div class="level-up-stat-value">${newLevel - (previousLevel || newLevel - 1)}</div>
                <div class="level-up-stat-label">Levels Gained</div>
            </div>
            <div class="level-up-stat">
                <div class="level-up-stat-value">${99 - newLevel}</div>
                <div class="level-up-stat-label">To Max</div>
            </div>
        </div>
    `;

    // Build streak bonus HTML if on a streak
    const streakHtml = currentStreak >= 2 ? `
        <div class="level-up-streak-bonus">
            <span>🔥</span> ${currentStreak} Day Streak!
        </div>
    ` : '';

    // Build title transition HTML
    const titleTransitionHtml = showTitleTransition ? `
        <div class="level-up-title-transition">
            <span class="level-up-old-title">${previousTitle}</span>
            <span class="level-up-arrow">→</span>
            <span class="level-up-new-title">${title}</span>
        </div>
    ` : `<div class="level-up-rank">${title}</div>`;

    const toast = document.createElement('div');
    toast.className = 'level-up-toast level-up-toast-enhanced';
    toast.innerHTML = `
        <div class="level-up-glow"></div>
        <div class="level-up-content">
            <div class="level-up-icon">⭐</div>
            <div class="level-up-text">
                <div class="level-up-title">LEVEL UP!</div>
                <div class="level-up-level">Level ${newLevel}</div>
                ${titleTransitionHtml}
                ${streakHtml}
                ${statsHtml}
            </div>
        </div>
    `;

    document.body.appendChild(toast);

    // Trigger all the celebration effects!
    playLevelUpSound();
    createGlowRings();
    triggerVictoryAnimation();
    triggerXPBarRainbow();

    // Auto-share level-up to feed
    shareLevelUpToFeed({
        newLevel: newLevel,
        previousLevel: previousLevel,
        title: title,
        lifetimePoints: lifetimePoints
    });

    // Check for newly unlocked animations
    if (previousLevel) {
        checkNewAnimationUnlocks(previousLevel, newLevel);
    }

    // Add level-up animation to the badge
    const levelBadge = document.getElementById('level-badge');
    if (levelBadge) {
        levelBadge.classList.add('level-up-animation');
        setTimeout(() => levelBadge.classList.remove('level-up-animation'), 600);
    }

    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after 5 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// Track previous lifetime points to detect level-ups
let previousLifetimePoints = 0;

// Timer for resetting the daily-log button after transient error states —
// cancelled immediately if the user successfully logs meals in the meantime.
let _dailyLogResetTimer = null;

// Track current active tab and pending level-ups (only show level-up on home screen)
let currentActiveTab = 'dashboard';
let pendingLevelUp = null; // { level: number, title: string }

// Award points for a meal (called after successful meal logging)
async function awardPointsForMeal(mealLogId, photoTimestamp, aiConfidence, photoHash, mealType = null) {
    console.log('awardPointsForMeal called with:', { mealLogId, photoTimestamp, aiConfidence, photoHash });
    try {
        const session = await window.authHelpers?.getSession();
        if (!session?.user) {
            console.log('No user session for points');
            return null;
        }

        // Get current points to track level before awarding
        let pointsBefore = null;
        try {
            pointsBefore = await window.db?.points?.getPoints(window.currentUser.id);
        } catch (e) {
            console.log('Could not get previous points');
        }
        const previousLevelData = calculateLevel(pointsBefore?.lifetime_points || 0);
        const previousLevel = previousLevelData.level;
        const previousProgress = previousLevelData.progress || 0;

        // Get current time in HH:MM:SS format for meal timing bonus check
        const now = new Date();
        const mealTime = now.toTimeString().split(' ')[0]; // HH:MM:SS

        console.log('Calling window.db.points.awardPoints...');
        const result = await window.db?.points?.awardPoints(
            window.currentUser.id,
            'meal',
            mealLogId,
            { photoTimestamp, aiConfidence, photoHash, mealTime, mealType }
        );
        console.log('awardPoints result:', result);

        if (result?.success) {
            // Show points earned toast
            showPointsEarnedToast(
                result.pointsAwarded,
                result.bonusPoints,
                result.currentStreak
            );

            // Show meal timing bonus toast if earned
            if (result.mealOnTime && result.mealTimingBonus > 0) {
                setTimeout(() => {
                    showToast(`On-time meal! +${result.mealTimingBonus} bonus XP`, 'success');
                }, 400);
            }

            // Show milestone toasts
            if (result.milestonesUnlocked?.length > 0) {
                result.milestonesUnlocked.forEach((milestone, index) => {
                    setTimeout(() => showMilestoneToast(milestone), (index + 1) * 500);
                });
            }

            // Check for level-up
            const newLifetimePoints = result.newLifetimePoints || (pointsBefore?.lifetime_points || 0) + (result.pointsAwarded || 0) + (result.bonusPoints || 0);
            const newLevelData = calculateLevel(newLifetimePoints);
            if (newLevelData.level > previousLevel) {
                // Delay level-up celebration to appear after points toast
                const delayMs = (result.milestonesUnlocked?.length || 0) * 500 + 1000;
                setTimeout(() => {
                    // Use new in-Tamagotchi celebration (auto-navigates to dashboard)
                    triggerLevelUpCelebration(
                        newLevelData.level,
                        getLevelTitle(newLevelData.level),
                        previousLevel,
                        newLifetimePoints,
                        result.currentStreak || 0,
                        previousProgress
                    );
                }, delayMs);
            }

            // Refresh points widget
            await loadPointsWidget();

            // Refresh all challenge types (calories, XP, streak, etc.)
            if (typeof refreshChallengeProgress === 'function') {
                refreshChallengeProgress();
            }
        } else if (result?.error) {
            console.log('Points not awarded:', result.reason || result.error);
            // Optionally show a subtle message about why points weren't awarded
        }

        return result;
    } catch (error) {
        console.error('Error awarding points for meal:', error);
        return null;
    }
}

async function deductPointsForDeletedMeal(mealLogId) {
    try {
        const session = await window.authHelpers?.getSession();
        const userId = window.currentUser?.id || session?.user?.id;
        if (!userId || !mealLogId || !window.supabaseClient) {
            return { success: false, pointsDeducted: 0, reason: 'Missing user, meal, or Supabase client' };
        }

        const { data: transactions, error: txError } = await window.supabaseClient
            .from('point_transactions')
            .select('id, points_amount, transaction_type')
            .eq('user_id', userId)
            .eq('reference_id', mealLogId)
            .eq('reference_type', 'meal_log')
            .in('transaction_type', ['earn_meal', 'bonus_meal_timing'])
            .gt('points_amount', 0);

        if (txError) throw txError;

        const pointsToDeduct = (transactions || []).reduce((sum, tx) => {
            return sum + Math.max(0, Number(tx.points_amount) || 0);
        }, 0);

        if (pointsToDeduct <= 0) {
            return { success: true, pointsDeducted: 0 };
        }

        const { data: pointsData, error: pointsError } = await window.supabaseClient
            .from('user_points')
            .select('current_points, lifetime_points, total_meals_logged')
            .eq('user_id', userId)
            .maybeSingle();

        if (pointsError) throw pointsError;
        if (!pointsData) {
            throw new Error('No user_points row found for meal XP deduction');
        }

        const { data: updatedPoints, error: updateError } = await window.supabaseClient
            .from('user_points')
            .update({
                current_points: Math.max(0, Number(pointsData?.current_points || 0) - pointsToDeduct),
                lifetime_points: Math.max(0, Number(pointsData?.lifetime_points || 0) - pointsToDeduct),
                total_meals_logged: Math.max(0, Number(pointsData?.total_meals_logged || 0) - 1),
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .select('user_id')
            .maybeSingle();

        if (updateError) throw updateError;
        if (!updatedPoints) {
            throw new Error('Meal XP deduction did not update user_points');
        }

        const { error: reversalError } = await window.supabaseClient
            .from('point_transactions')
            .insert({
                user_id: userId,
                transaction_type: 'meal_delete_reversal',
                points_amount: -pointsToDeduct,
                reference_id: mealLogId,
                reference_type: 'meal_log',
                description: `Deducted ${pointsToDeduct} XP after deleting a meal`
            });

        if (reversalError) {
            console.warn('Meal delete XP was deducted but reversal transaction could not be logged:', reversalError);
        }

        try {
            await window.supabaseClient.rpc('update_challenge_participant_points', { user_uuid: userId });
        } catch (challengeError) {
            console.warn('Could not refresh challenge points after meal delete:', challengeError);
        }

        if (typeof loadPointsWidget === 'function') {
            await loadPointsWidget();
        }
        if (typeof refreshChallengeProgress === 'function') {
            refreshChallengeProgress();
        }

        return { success: true, pointsDeducted: pointsToDeduct };
    } catch (error) {
        console.error('Error deducting points for deleted meal:', error);
        return { success: false, pointsDeducted: 0, error };
    }
}

// Returns true if the current user is an accepted participant in any active challenge of the given type
async function checkInActiveChallengeType(challengeType) {
    try {
        if (!window.currentUser || !window.supabaseClient) return false;
        const { data } = await window.supabaseClient
            .from('challenge_participants')
            .select('challenge_id, challenges!inner(status, challenge_type)')
            .eq('user_id', window.currentUser.id)
            .eq('status', 'accepted')
            .eq('challenges.status', 'active')
            .eq('challenges.challenge_type', challengeType)
            .limit(1);
        return !!(data && data.length > 0);
    } catch {
        return false;
    }
}

// Claim daily nutrition bonus (2 points for hitting within 20% of cal/macro goals)
async function claimDailyNutritionBonus() {
    // Use popup button if available, fall back to main button
    const btn = document.getElementById('popup-claim-btn') || document.getElementById('daily-log-btn');
    const hint = document.getElementById('popup-claim-hint') || document.getElementById('daily-log-hint');
    if (!btn) return;

    try {
        const session = await window.authHelpers?.getSession();
        if (!session?.user) {
            if (hint) hint.textContent = 'Please log in to claim your daily bonus.';
            return;
        }

        // Disable button while processing
        btn.disabled = true;
        btn.style.opacity = '0.6';
        btn.querySelector('span:nth-child(2)').textContent = 'Checking...';

        const today = getLocalDateString();

        // If in an active Calories challenge, enforce photo requirement before hitting backend
        const inCaloriesChallenge = await checkInActiveChallengeType('calories');
        if (inCaloriesChallenge) {
            const { data: meals } = await window.supabaseClient
                .from('meal_logs')
                .select('id, photo_url, ai_confidence')
                .eq('user_id', session.user.id)
                .eq('meal_date', today)
                .neq('meal_type', 'water');
            const unverified = (meals || []).filter(m =>
                !m.photo_url || m.photo_url === 'text-input' || m.ai_confidence === 'low'
            );
            if (unverified.length > 0) {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.querySelector('span:nth-child(2)').textContent = 'Claim Daily Bonus';
                if (hint) hint.textContent = `${unverified.length} meal${unverified.length > 1 ? 's need' : ' needs'} a verified photo. In a Calories challenge, every meal must be logged with a photo.`;
                return;
            }
        }

        // Get current points to track level before awarding
        let pointsBefore = null;
        try {
            pointsBefore = await window.db?.points?.getPoints(window.currentUser.id);
        } catch (e) {
            console.log('Could not get previous points');
        }
        const previousLevelData = calculateLevel(pointsBefore?.lifetime_points || 0);
        const previousLevel = previousLevelData.level;
        const previousProgress = previousLevelData.progress || 0;

        // Call the award-points endpoint with daily_log type
        const response = await fetch('/api/award-points', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: window.currentUser.id,
                type: 'daily_log',
                referenceId: `daily_${today}`,
                nutritionDate: today,
                clientDate: getLocalDateString()
            })
        });

        const result = await response.json();

        if (result.success) {
            // Show success state on popup button
            btn.style.background = 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)';
            btn.innerHTML = `
                <span style="font-size: 1.3rem;">&#x1F389;</span>
                <span>Meals Logged for the Day</span>
                <span style="background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 20px; font-size: 0.85rem;">+${result.pointsAwarded} pts</span>
            `;
            btn.disabled = true;
            btn.style.opacity = '0.7';
            btn.style.cursor = 'default';
            if (hint) hint.textContent = 'Great job hitting your nutrition goals today!';

            // Also update the main Log button to show claimed state
            setDailyLogButtonClaimed();

            // Show points toast
            showPointsEarnedToast(result.pointsAwarded, result.bonusPoints || 0, result.currentStreak || 0);

            // Check for level-up
            const newLifetimePoints = result.newLifetimePoints || (pointsBefore?.lifetime_points || 0) + (result.pointsAwarded || 0) + (result.bonusPoints || 0);
            const newLevelData = calculateLevel(newLifetimePoints);
            if (newLevelData.level > previousLevel) {
                setTimeout(() => {
                    triggerLevelUpCelebration(
                        newLevelData.level,
                        getLevelTitle(newLevelData.level),
                        previousLevel,
                        newLifetimePoints,
                        result.currentStreak || 0,
                        previousProgress
                    );
                }, 1500);
            }

            // Refresh points widget
            await loadPointsWidget();

            // Refresh all challenge types (calories, XP, streak, etc.)
            if (typeof refreshChallengeProgress === 'function') {
                refreshChallengeProgress();
            }
        } else {
            // Handle specific errors
            btn.style.opacity = '1';
            if (result.error === 'Already claimed') {
                setDailyLogButtonClaimed();
            } else if (result.error === 'Goals not met') {
                btn.style.background = 'linear-gradient(135deg, #6c757d 0%, #495057 100%)';
                btn.style.boxShadow = '0 4px 12px rgba(108, 117, 125, 0.3)';
                btn.innerHTML = `
                    <span style="font-size: 1.3rem;">&#x274C;</span>
                    <span>Goals Not Met Yet</span>
                `;
                if (hint) hint.textContent = result.reason || 'Get closer to your calorie & macro goals, or finish your day without the bonus.';
                // Show "Finish Day Without Bonus" button in popup
                const finishDayBtn = document.getElementById('popup-finish-day-btn');
                const finishHint = document.getElementById('popup-finish-hint');
                if (finishDayBtn) finishDayBtn.style.display = 'flex';
                if (finishHint) finishHint.style.display = 'block';
                // Re-enable claim button after 3 seconds so they can try again
                _dailyLogResetTimer = setTimeout(() => {
                    _dailyLogResetTimer = null;
                    resetDailyLogButton();
                }, 3000);
            } else if (result.error === 'Photos required') {
                btn.style.background = 'linear-gradient(135deg, #6c757d 0%, #495057 100%)';
                btn.innerHTML = `
                    <span style="font-size: 1.3rem;">&#x1F4F7;</span>
                    <span>Photos Required</span>
                `;
                if (hint) hint.textContent = result.reason || 'All meals need a verified photo to count in a Calories challenge.';
                _dailyLogResetTimer = setTimeout(() => {
                    _dailyLogResetTimer = null;
                    resetDailyLogButton();
                }, 4000);
            } else if (result.error === 'No meals logged') {
                btn.style.background = 'linear-gradient(135deg, #6c757d 0%, #495057 100%)';
                btn.innerHTML = `
                    <span style="font-size: 1.3rem;">&#x1F37D;</span>
                    <span>Log Meals First</span>
                `;
                if (hint) hint.textContent = result.reason || 'Log at least one meal before claiming your bonus.';
                _dailyLogResetTimer = setTimeout(() => {
                    _dailyLogResetTimer = null;
                    resetDailyLogButton();
                }, 3000);
            } else {
                btn.innerHTML = `
                    <span style="font-size: 1.3rem;">&#x26A0;</span>
                    <span>Something went wrong</span>
                `;
                if (hint) hint.textContent = result.reason || 'Please try again.';
                _dailyLogResetTimer = setTimeout(() => {
                    _dailyLogResetTimer = null;
                    resetDailyLogButton();
                }, 3000);
            }
        }
    } catch (error) {
        console.error('Error claiming daily nutrition bonus:', error);
        btn.style.opacity = '1';
        btn.innerHTML = `
            <span style="font-size: 1.3rem;">&#x26A0;</span>
            <span>Error - Try Again</span>
        `;
        _dailyLogResetTimer = setTimeout(() => {
            _dailyLogResetTimer = null;
            resetDailyLogButton();
        }, 3000);
    }
}

// Finish day without bonus points (marks all meals as tracked for AI coach)
async function finishDayWithoutBonus() {
    const btn = document.getElementById('popup-finish-day-btn');
    const claimBtn = document.getElementById('popup-claim-btn') || document.getElementById('daily-log-btn');
    const hint = document.getElementById('popup-claim-hint') || document.getElementById('daily-log-hint');
    if (!btn) return;

    try {
        const session = await window.authHelpers?.getSession();
        if (!session?.user) return;

        btn.disabled = true;
        btn.style.opacity = '0.6';
        btn.querySelector('span').textContent = 'Logging...';

        const today = getLocalDateString();

        const response = await fetch('/api/award-points', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: window.currentUser.id,
                type: 'daily_log',
                referenceId: `daily_${today}`,
                nutritionDate: today,
                finishDay: true,
                clientDate: getLocalDateString()
            })
        });

        const result = await response.json();

        if (result.success || result.dayCompleted) {
            // Mark both buttons as day completed (no bonus)
            setDailyLogButtonDayCompleted();
            // Hide the finish day button
            btn.style.display = 'none';
            const finishHint = document.getElementById('popup-finish-hint');
            if (finishHint) finishHint.style.display = 'none';
            // Close the modal and return to nutrition page
            closeDailyScorePopup();
            // Refresh challenge progress (calories challenge counts completed days)
            if (typeof refreshChallengeProgress === 'function') {
                refreshChallengeProgress();
            }
        } else if (result.error === 'Already claimed') {
            setDailyLogButtonClaimed();
            btn.style.display = 'none';
            closeDailyScorePopup();
        } else {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.querySelector('span').textContent = 'Log Your Meals for the Day Anyway';
            if (hint) hint.textContent = result.reason || 'Something went wrong. Please try again.';
        }
    } catch (error) {
        console.error('Error finishing day:', error);
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.querySelector('span').textContent = 'Log Your Meals for the Day Anyway';
    }
}

// Set buttons to "Day Completed" state (no bonus earned)
function setDailyLogButtonDayCompleted() {
    // Cancel any pending reset timer so a successful log always wins
    if (_dailyLogResetTimer) { clearTimeout(_dailyLogResetTimer); _dailyLogResetTimer = null; }

    const btn = document.getElementById('daily-log-btn');
    const hint = document.getElementById('daily-log-hint');
    if (btn) {
        btn.disabled = true;
        btn.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
        btn.style.opacity = '0.85';
        btn.style.boxShadow = 'none';
        btn.style.cursor = 'default';
        btn.innerHTML = `
            <span style="font-size: 1.3rem; font-weight: 900;">&#x2713;</span>
            <span>Meals Logged for the Day</span>
        `;
    }
    if (hint) hint.textContent = 'Your meals are tracked for today. Try to hit your macros tomorrow for bonus points!';

    const popupBtn = document.getElementById('popup-claim-btn');
    const popupHint = document.getElementById('popup-claim-hint');
    if (popupBtn) {
        popupBtn.disabled = true;
        popupBtn.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
        popupBtn.style.opacity = '0.85';
        popupBtn.style.cursor = 'default';
        popupBtn.innerHTML = `
            <span style="font-size: 1.3rem; font-weight: 900;">&#x2713;</span>
            <span>Meals Logged for the Day</span>
        `;
    }
    if (popupHint) popupHint.textContent = 'Your meals are tracked for today. Try to hit your macros tomorrow for bonus points!';

    // Hide finish day button
    const finishDayBtn = document.getElementById('popup-finish-day-btn');
    const finishHint = document.getElementById('popup-finish-hint');
    if (finishDayBtn) finishDayBtn.style.display = 'none';
    if (finishHint) finishHint.style.display = 'none';
}

function setDailyLogButtonClaimed() {
    // Cancel any pending reset timer so a successful claim always wins
    if (_dailyLogResetTimer) { clearTimeout(_dailyLogResetTimer); _dailyLogResetTimer = null; }

    const btn = document.getElementById('daily-log-btn');
    const hint = document.getElementById('daily-log-hint');
    if (btn) {
        btn.disabled = true;
        btn.style.background = 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)';
        btn.style.opacity = '0.7';
        btn.style.boxShadow = 'none';
        btn.style.cursor = 'default';
        btn.innerHTML = `
            <span style="font-size: 1.3rem; font-weight: 900;">&#x2713;</span>
            <span>Meals Logged for the Day</span>
        `;
    }
    if (hint) hint.textContent = 'Come back tomorrow for another chance!';

    // Also update popup claim button
    const popupBtn = document.getElementById('popup-claim-btn');
    const popupHint = document.getElementById('popup-claim-hint');
    if (popupBtn) {
        popupBtn.disabled = true;
        popupBtn.style.background = 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)';
        popupBtn.style.opacity = '0.7';
        popupBtn.style.cursor = 'default';
        popupBtn.innerHTML = `
            <span style="font-size: 1.3rem; font-weight: 900;">&#x2713;</span>
            <span>Meals Logged for the Day</span>
        `;
    }
    if (popupHint) popupHint.textContent = 'Come back tomorrow for another chance!';
}

function resetDailyLogButton() {
    const btn = document.getElementById('daily-log-btn');
    const hint = document.getElementById('daily-log-hint');
    if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.background = 'linear-gradient(135deg, var(--primary) 0%, #065f3a 100%)';
        btn.style.boxShadow = '0 4px 12px rgba(4, 106, 56, 0.3)';
        btn.style.cursor = 'pointer';
        btn.innerHTML = `
            <span style="font-size: 1.3rem; font-weight: 900;">&#x2713;</span>
            <span>Log Your Meals for the Day</span>
            <span style="background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 20px; font-size: 0.85rem;">+2 pts</span>
        `;
    }
    if (hint) hint.textContent = 'Hit within 20% of your calorie & macro goals to earn 2 bonus points';

    // Also reset popup claim button
    const popupBtn = document.getElementById('popup-claim-btn');
    const popupHint = document.getElementById('popup-claim-hint');
    if (popupBtn) {
        popupBtn.disabled = false;
        popupBtn.style.opacity = '1';
        popupBtn.style.background = 'linear-gradient(135deg, var(--primary) 0%, #065f3a 100%)';
        popupBtn.style.cursor = 'pointer';
        popupBtn.innerHTML = `
            <span style="font-size: 1.3rem; font-weight: 900;">&#x2713;</span>
            <span>Claim Daily Bonus</span>
            <span style="background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 20px; font-size: 0.85rem;">+2 pts</span>
        `;
    }
    if (popupHint) popupHint.textContent = 'Hit within 20% of your calorie & macro goals to earn 2 bonus points';

    // Also reset the finish-day button so it doesn't stay stuck on "Logging..."
    const finishBtn = document.getElementById('popup-finish-day-btn');
    if (finishBtn) {
        finishBtn.disabled = false;
        finishBtn.style.opacity = '1';
        finishBtn.style.display = 'none';
        finishBtn.innerHTML = '<span>Log Your Meals for the Day Anyway</span>';
    }
    const finishHint = document.getElementById('popup-finish-hint');
    if (finishHint) finishHint.style.display = 'none';
}

// Check if daily log bonus has already been claimed today (called from loadTodayNutrition)
async function checkDailyLogBonusStatus() {
    try {
        const session = await window.authHelpers?.getSession();
        if (!session?.user) return;

        const today = getLocalDateString();

        // Check for points bonus claim
        const { data: existingClaim } = await window.supabaseClient
            .from('point_transactions')
            .select('id')
            .eq('user_id', window.currentUser.id)
            .eq('transaction_type', 'earn_daily_log')
            .gte('created_at', today + 'T00:00:00')
            .lte('created_at', today + 'T23:59:59')
            .limit(1)
            .maybeSingle();

        if (existingClaim) {
            setDailyLogButtonClaimed();
            return;
        }

        // Check if day was completed without bonus (finish day flow)
        const { data: dailyNutrition } = await window.supabaseClient
            .from('daily_nutrition')
            .select('day_completed')
            .eq('user_id', window.currentUser.id)
            .eq('nutrition_date', today)
            .single();

        if (dailyNutrition?.day_completed) {
            setDailyLogButtonDayCompleted();
        }
    } catch (error) {
        console.error('Error checking daily log bonus status:', error);
    }
}

// Award points for a workout (called after successful workout logging)
async function awardPointsForWorkout(workoutId, photoTimestamp = null, aiConfidence = null, photoHash = null) {
    try {
        const session = await window.authHelpers?.getSession();
        if (!session?.user) return null;

        // Get current points to track level before awarding
        let pointsBefore = null;
        try {
            pointsBefore = await window.db?.points?.getPoints(window.currentUser.id);
        } catch (e) {
            console.log('Could not get previous points');
        }
        const previousLevelData = calculateLevel(pointsBefore?.lifetime_points || 0);
        const previousLevel = previousLevelData.level;
        const previousProgress = previousLevelData.progress || 0;

        const result = await window.db?.points?.awardPoints(
            window.currentUser.id,
            'workout',
            workoutId,
            { photoTimestamp, aiConfidence, photoHash }
        );

        if (result?.success) {
            // Show points earned toast
            showPointsEarnedToast(
                result.pointsAwarded,
                result.bonusPoints,
                result.currentStreak
            );

            // Show milestone toasts
            if (result.milestonesUnlocked?.length > 0) {
                result.milestonesUnlocked.forEach((milestone, index) => {
                    setTimeout(() => showMilestoneToast(milestone), (index + 1) * 500);
                });
            }

            // Check for level-up
            const newLifetimePoints = result.newLifetimePoints || (pointsBefore?.lifetime_points || 0) + (result.pointsAwarded || 0) + (result.bonusPoints || 0);
            const newLevelData = calculateLevel(newLifetimePoints);
            if (newLevelData.level > previousLevel) {
                // Delay level-up celebration to appear after points toast
                const delayMs = (result.milestonesUnlocked?.length || 0) * 500 + 1000;
                setTimeout(() => {
                    // Use new in-Tamagotchi celebration (auto-navigates to dashboard)
                    triggerLevelUpCelebration(
                        newLevelData.level,
                        getLevelTitle(newLevelData.level),
                        previousLevel,
                        newLifetimePoints,
                        result.currentStreak || 0,
                        previousProgress
                    );
                }, delayMs);
            }

            // Refresh points widget
            await loadPointsWidget();

            // Refresh all challenge types (workouts, volume, XP, etc.)
            if (typeof refreshChallengeProgress === 'function') {
                refreshChallengeProgress();
            }
        }

        return result;
    } catch (error) {
        console.error('Error awarding points for workout:', error);
        return null;
    }
}

// Award points for achieving a personal best (1 point per PB)
async function awardPointsForPersonalBest(pbRefId, pbData) {
    try {
        const session = await window.authHelpers?.getSession();
        if (!session?.user) return null;
        const canonicalPbRefId = pbData?.historyId
            || pbData?.pbHistoryId
            || pbData?.pb_history_id
            || pbRefId;

        // Get current points to track level before awarding
        let pointsBefore = null;
        try {
            pointsBefore = await window.db?.points?.getPoints(window.currentUser.id);
        } catch (e) {
            console.log('Could not get previous points');
        }
        const previousLevelData = calculateLevel(pointsBefore?.lifetime_points || 0);
        const previousLevel = previousLevelData.level;
        const previousProgress = previousLevelData.progress || 0;

        // Award point for personal best (type: 'personal_best')
        const result = await window.db?.points?.awardPoints(
            window.currentUser.id,
            'personal_best',
            canonicalPbRefId,
            {
                exercise: pbData.exercise,
                pbType: pbData.type, // 'weight' or 'reps'
                value: pbData.value,
                improvement: pbData.improvement
            }
        );

        if (result?.success) {
            // Show PB points toast
            const pbTypeText = pbData.type === 'weight' ? 'weight' : pbData.type === 'volume' ? 'volume' : 'reps';
            const toastMsg = pbData.type === 'volume'
                ? `+1 XP — Volume PR! ${pbData.value.toLocaleString()} kg total (+${pbData.improvement.toLocaleString()} kg)`
                : `+1 point for ${pbData.exercise} PB! (${pbTypeText})`;
            showToast(toastMsg, 'success');

            // Check for level-up
            const newLifetimePoints = result.newLifetimePoints || (pointsBefore?.lifetime_points || 0) + 1;
            const newLevelData = calculateLevel(newLifetimePoints);
            if (newLevelData.level > previousLevel) {
                setTimeout(() => {
                    // Use new in-Tamagotchi celebration (auto-navigates to dashboard)
                    triggerLevelUpCelebration(
                        newLevelData.level,
                        getLevelTitle(newLevelData.level),
                        previousLevel,
                        newLifetimePoints,
                        result.currentStreak || 0,
                        previousProgress
                    );
                }, 1500);
            }
        }

        return result;
    } catch (error) {
        console.error('Error awarding points for personal best:', error);
        return null;
    }
}

const WALKTHROUGH_TARGET_LEVEL = 4;
const WALKTHROUGH_TARGET_LIFETIME_XP = getPointsForLevel(WALKTHROUGH_TARGET_LEVEL);
const WALKTHROUGH_XP_STORAGE_PREFIX = 'pbb_walkthrough_xp_awarded_v2';

function getWalkthroughStorageKey() {
    return `${WALKTHROUGH_XP_STORAGE_PREFIX}:${window.currentUser?.id || 'guest'}`;
}

function getWalkthroughAwardedRefs() {
    try {
        const raw = localStorage.getItem(getWalkthroughStorageKey());
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

function markWalkthroughRefAwarded(ref) {
    try {
        const awarded = getWalkthroughAwardedRefs();
        if (awarded.indexOf(ref) === -1) {
            awarded.push(ref);
            localStorage.setItem(getWalkthroughStorageKey(), JSON.stringify(awarded));
        }
    } catch (e) {
        console.warn('Could not persist walkthrough XP ref', e);
    }
}

function makeWalkthroughRewardRef(step) {
    const checkpoint = step?.xpReward || step?.walkthroughReward;
    if (!checkpoint) return null;
    return 'walkthrough:' + encodeURIComponent(String(checkpoint));
}

function queueWalkthroughLevelUpCelebration(payload) {
    try {
        const existing = window.__balanceQueuedWalkthroughLevelUp;
        if (!existing) {
            window.__balanceQueuedWalkthroughLevelUp = payload;
            return;
        }

        window.__balanceQueuedWalkthroughLevelUp = {
            newLevel: Math.max(existing.newLevel || 1, payload.newLevel || 1),
            title: (payload.newLevel || 1) >= (existing.newLevel || 1) ? payload.title : existing.title,
            previousLevel: existing.previousLevel || payload.previousLevel,
            lifetimePoints: Math.max(existing.lifetimePoints || 0, payload.lifetimePoints || 0),
            currentStreak: payload.currentStreak || existing.currentStreak || 0,
            previousProgress: existing.previousProgress ?? payload.previousProgress ?? 0
        };
    } catch (e) {
        window.__balanceQueuedWalkthroughLevelUp = payload;
    }
}

async function awardPointsForWalkthroughStep(step, stepNumber, totalSteps) {
    try {
        if (!step?.xpReward && !step?.walkthroughReward) return null;

        const session = await window.authHelpers?.getSession();
        if (!session?.user) return null;

        const rewardRef = makeWalkthroughRewardRef(step || {});
        if (!rewardRef) return null;

        const awardedRefs = getWalkthroughAwardedRefs();
        if (awardedRefs.indexOf(rewardRef) !== -1) {
            return { success: false, alreadyAwarded: true, pointsAwarded: 0 };
        }

        let pointsBefore = null;
        try {
            pointsBefore = await window.db?.points?.getPoints(window.currentUser.id);
        } catch (e) {
            console.log('Could not get previous points');
        }
        const lifetimeBefore = pointsBefore?.lifetime_points || 0;
        if (lifetimeBefore >= WALKTHROUGH_TARGET_LIFETIME_XP) {
            return { success: false, targetReached: true, pointsAwarded: 0 };
        }

        const previousLevelData = calculateLevel(lifetimeBefore);
        const previousLevel = previousLevelData.level;
        const previousProgress = previousLevelData.progress || 0;

        const result = await window.db?.points?.awardPoints(
            window.currentUser.id,
            'walkthrough',
            rewardRef,
            {
                stepNumber,
                totalSteps,
                checkpoint: step.xpReward || step.walkthroughReward,
                title: step.title || null
            }
        );

        if (result?.alreadyAwarded) {
            markWalkthroughRefAwarded(rewardRef);
            return result;
        }

        if (result?.success) {
            if ((result.pointsAwarded || 0) > 0) {
                showWalkthroughXpPulse(result.pointsAwarded);
                markWalkthroughRefAwarded(rewardRef);
            }

            const newLifetimePoints = result.newLifetimePoints || lifetimeBefore + (result.pointsAwarded || 0) + (result.bonusPoints || 0);
            const newLevelData = calculateLevel(newLifetimePoints);
            if (newLevelData.level > previousLevel) {
                const levelUpPayload = {
                    newLevel: newLevelData.level,
                    title: getLevelTitle(newLevelData.level),
                    previousLevel,
                    lifetimePoints: newLifetimePoints,
                    currentStreak: result.currentStreak || 0,
                    previousProgress
                };
                setTimeout(() => {
                    if (window.__balanceGuidedTourActive) {
                        playWalkthroughLevelUpCelebration(levelUpPayload);
                        return;
                    }
                    triggerLevelUpCelebration(
                        levelUpPayload.newLevel,
                        levelUpPayload.title,
                        levelUpPayload.previousLevel,
                        levelUpPayload.lifetimePoints,
                        levelUpPayload.currentStreak,
                        levelUpPayload.previousProgress
                    );
                }, window.__balanceGuidedTourActive ? 650 : 900);
            }

            await loadPointsWidget();
            if (typeof refreshChallengeProgress === 'function') {
                refreshChallengeProgress();
            }
        }

        return result;
    } catch (error) {
        console.error('Error awarding walkthrough XP:', error);
        return null;
    }
}

// ==========================================
// WORKOUT PHOTO VERIFICATION FUNCTIONS
// ==========================================

let capturedWorkoutFile = null;
let workoutPhotoBase64 = null;

// Capture workout completion screen and share card/photo destinations.
// Legacy "story" here means the in-app feed story row used for workout-share XP.
let pendingWorkoutShareType = null;
let workoutPointsEarnedThisSession = { story: false, groupchat: false };
let workoutInstagramShareCompleted = { story: false };
let workoutFeedShareMarkedStorageKey = '';

function getWorkoutFeedShareDayKey(date = new Date()) {
    try {
        const parts = new Intl.DateTimeFormat('en-AU', {
            timeZone: 'Australia/Brisbane',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).formatToParts(date);
        const byType = {};
        parts.forEach(part => { byType[part.type] = part.value; });
        if (byType.year && byType.month && byType.day) {
            return `${byType.year}-${byType.month}-${byType.day}`;
        }
    } catch (_) {}
    return new Date(date).toISOString().slice(0, 10);
}

function getWorkoutFeedShareUsedStorageKey() {
    const userId = window.currentUser?.id || 'anonymous';
    return `pbbWorkoutSharedToFeedDay_${userId}_${getWorkoutFeedShareDayKey()}`;
}

function isWorkoutFeedShareUsedToday() {
    const storageKey = getWorkoutFeedShareUsedStorageKey();
    if (workoutFeedShareMarkedStorageKey === storageKey) return true;
    try {
        return localStorage.getItem(storageKey) === '1';
    } catch (_) {
        return false;
    }
}

function markWorkoutFeedShareUsedToday() {
    workoutPointsEarnedThisSession.story = true;
    workoutFeedShareMarkedStorageKey = getWorkoutFeedShareUsedStorageKey();
    try {
        localStorage.setItem(workoutFeedShareMarkedStorageKey, '1');
    } catch (_) {}
}

function getWorkoutFeedShareButtonLabel() {
    return isWorkoutFeedShareUsedToday() ? 'Balance Feed' : 'Balance Feed (+15 XP)';
}

async function syncWorkoutFeedShareUsedToday() {
    if (isWorkoutFeedShareUsedToday()) return true;
    if (!window.currentUser?.id || !window.db?.points?.getTransactions) return false;

    try {
        const transactions = await window.db.points.getTransactions(window.currentUser.id, 100);
        const referenceType = `workout_feed_share:${getWorkoutFeedShareDayKey()}`;
        const usedToday = Array.isArray(transactions) && transactions.some(transaction => (
            transaction?.transaction_type === 'earn_workout_feed_share'
            && transaction?.reference_type === referenceType
        ));
        if (usedToday) markWorkoutFeedShareUsedToday();
        return usedToday;
    } catch (error) {
        console.warn('Could not sync daily workout Feed XP state:', error);
        return false;
    }
}

// Cached workout-share photo captured once and reused for Balance Feed and
// Instagram so the user does not have to take it twice.
let cachedWorkoutShareFile = null;
let cachedWorkoutShareBase64 = null;
let pendingPostWorkoutCompositeShare = null;
let cachedNutritionShareBase64 = null;

const BALANCE_INSTAGRAM_SHARE_TESTER_EMAILS = [
    'shannonbirch@cocospersonaltraining.com'
];

let balanceInstagramSharePlugin = null;

function isBalanceNativeInstagramSurface() {
    try {
        return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    } catch (_) {
        return false;
    }
}

function getBalanceNativeShellRevision() {
    try {
        const params = new URLSearchParams(window.location.search || '');
        return String(params.get('native_rev') || '').trim();
    } catch (_) {
        return '';
    }
}

function getBalanceNativePlatform() {
    try {
        if (window.Capacitor && typeof window.Capacitor.getPlatform === 'function') {
            return String(window.Capacitor.getPlatform() || '').toLowerCase();
        }
    } catch (_) {}
    return '';
}

function isLegacyIOSInstagramShareShell() {
    const revision = getBalanceNativeShellRevision();
    return isBalanceNativeInstagramSurface()
        && getBalanceNativePlatform() === 'ios'
        && revision !== 'ig_meal_share_v15';
}
function getBalanceInstagramSharePlugin() {
    if (balanceInstagramSharePlugin) return balanceInstagramSharePlugin;

    if (window.Capacitor && window.Capacitor.Plugins) {
        balanceInstagramSharePlugin = window.Capacitor.Plugins.BalanceInstagramShare
            || window.Capacitor.Plugins.BalanceInstagramSharePlugin
            || null;
        if (balanceInstagramSharePlugin) return balanceInstagramSharePlugin;
    }

    if (window.Capacitor && typeof window.Capacitor.registerPlugin === 'function') {
        try {
            balanceInstagramSharePlugin = window.Capacitor.registerPlugin('BalanceInstagramShare');
        } catch (registerError) {
            console.warn('Could not register BalanceInstagramShare plugin:', registerError);
        }
    }

    if (!balanceInstagramSharePlugin && window.Capacitor && window.Capacitor.Plugins) {
        console.warn('BalanceInstagramShare plugin unavailable. Available plugins:', Object.keys(window.Capacitor.Plugins).join(','));
    }

    return balanceInstagramSharePlugin;
}

function getBalanceInstagramShareTesterEmail() {
    const user = window.currentUser || {};
    const email = user.email
        || (user.user_metadata && user.user_metadata.email)
        || (user.app_metadata && user.app_metadata.email)
        || '';
    return String(email).trim().toLowerCase();
}

function canUseBalanceInstagramShareTest() {
    return true;
}

function updateWorkoutInstagramShareVisibility() {
    const enabled = canUseBalanceInstagramShareTest();
    const group = document.getElementById('share-workout-ig-options');
    if (group) group.style.display = enabled ? 'block' : 'none';

    const btn = document.getElementById('share-workout-ig-story-btn');
    if (!btn) return;
    btn.disabled = !enabled;
    btn.style.display = enabled ? 'flex' : 'none';
}

function getWorkoutShareSubheading(hasPhoto) {
    return hasPhoto
        ? 'Photo ready. Add a workout or PB overlay, or share the photo on its own.'
        : 'Choose a workout or PB overlay, a card, or a photo to share to Feed.';
}

window.canUseBalanceInstagramShareTest = canUseBalanceInstagramShareTest;
window.updateWorkoutInstagramShareVisibility = updateWorkoutInstagramShareVisibility;

// --- Workout Camera (getUserMedia fallback) ---
// The primary path on Android is now the native Camera intent exposed via
// window.NativePermissions.takeWorkoutPhoto(), which opens the system camera
// app instantly. getUserMedia is slow to initialize inside the WebView. We
// keep the getUserMedia modal as a fallback for iOS / web / older builds.
let workoutCameraStream = null;
let workoutCameraFacingMode = 'environment';
let _workoutCameraCallback = null;
let workoutCameraTimerSeconds = 0;
let workoutCameraCountdownTimer = null;
let workoutCameraCaptureInProgress = false;

function showWorkoutCameraPermissionIssue() {
    if (typeof showCameraPermissionSettingsDialog === 'function') {
        showCameraPermissionSettingsDialog();
    } else if (typeof showToast === 'function') {
        showToast('Could not access camera. Check permissions.', 'error');
    } else {
        alert('Could not access camera. Check permissions.');
    }
}

function finishWorkoutCameraCallback(file) {
    const cb = _workoutCameraCallback;
    _workoutCameraCallback = null;
    if (typeof cb === 'function') {
        cb(file || null);
    }
}

function updateWorkoutCameraTimerButton() {
    const btn = document.getElementById('workout-camera-timer-btn');
    if (!btn) return;
    btn.textContent = workoutCameraTimerSeconds > 0 ? (workoutCameraTimerSeconds + 's') : 'Timer';
    btn.style.background = workoutCameraTimerSeconds > 0
        ? 'rgba(236,72,153,0.85)'
        : 'rgba(255,255,255,0.15)';
}

function setWorkoutCameraTimer(seconds) {
    workoutCameraTimerSeconds = [0, 3, 10].includes(Number(seconds)) ? Number(seconds) : 0;
    updateWorkoutCameraTimerButton();
}

function toggleWorkoutCameraTimer() {
    const next = workoutCameraTimerSeconds === 0 ? 3 : (workoutCameraTimerSeconds === 3 ? 10 : 0);
    setWorkoutCameraTimer(next);
}

function clearWorkoutCameraCountdown() {
    if (workoutCameraCountdownTimer) {
        clearInterval(workoutCameraCountdownTimer);
        workoutCameraCountdownTimer = null;
    }
    workoutCameraCaptureInProgress = false;
    const overlay = document.getElementById('workout-camera-countdown');
    if (overlay) overlay.style.display = 'none';
}

// Primary entry point: prefers the native camera bridge for speed, falls back
// to the in-WebView getUserMedia modal if the bridge isn't available.
async function openWorkoutCamera(callback, label, options = {}) {
    _workoutCameraCallback = callback;
    const cameraOptions = options && typeof options === 'object' ? options : {};
    setWorkoutCameraTimer(cameraOptions.defaultTimerSeconds || 0);

    // Prefer native Android camera intent — opens the system camera app
    // instantly, far faster than spinning up getUserMedia inside the WebView.
    if (!cameraOptions.forceWebCamera && window.NativePermissions && typeof window.NativePermissions.takeWorkoutPhoto === 'function') {
        try {
            // Make sure camera permission is granted before launching the intent.
            // The native TakePicture contract doesn't request permission itself.
            if (typeof window.NativePermissions.hasCameraPermission === 'function'
                && !window.NativePermissions.hasCameraPermission()) {
                if (window.NativePermissions.isPermissionPermanentlyDenied
                    && window.NativePermissions.isPermissionPermanentlyDenied()) {
                    showWorkoutCameraPermissionIssue();
                    finishWorkoutCameraCallback(null);
                    return;
                }
                const granted = await new Promise((resolve) => {
                    window._onNativeCameraPermission = function(result) {
                        delete window._onNativeCameraPermission;
                        resolve(result);
                    };
                    window.NativePermissions.requestCameraPermission();
                    setTimeout(() => {
                        if (window._onNativeCameraPermission) {
                            delete window._onNativeCameraPermission;
                            resolve(false);
                        }
                    }, 60000);
                });
                if (!granted) {
                    showWorkoutCameraPermissionIssue();
                    finishWorkoutCameraCallback(null);
                    return;
                }
            }

            const dataUrl = await new Promise((resolve) => {
                let settled = false;
                window._onNativeWorkoutPhoto = function(result) {
                    if (settled) return;
                    settled = true;
                    delete window._onNativeWorkoutPhoto;
                    resolve(result);
                };
                try {
                    window.NativePermissions.takeWorkoutPhoto();
                } catch (e) {
                    if (settled) return;
                    settled = true;
                    delete window._onNativeWorkoutPhoto;
                    resolve(null);
                }
                // Safety timeout — 2 minutes
                setTimeout(() => {
                    if (settled) return;
                    settled = true;
                    delete window._onNativeWorkoutPhoto;
                    resolve(null);
                }, 120000);
            });

            if (dataUrl && typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
                const file = dataUrlToFile(dataUrl, `workout-${Date.now()}.jpg`);
                finishWorkoutCameraCallback(file);
                return;
            }
            // User cancelled — just bail, no fallback needed since the native
            // camera bridge is available on this platform.
            finishWorkoutCameraCallback(null);
            return;
        } catch (bridgeErr) {
            console.warn('Native workout camera bridge failed, falling back:', bridgeErr);
            // Fall through to getUserMedia modal
        }
    }

    // Fallback: in-WebView camera modal (getUserMedia)
    const modal = document.getElementById('workout-camera-modal');
    if (!modal) {
        console.error('workout-camera-modal not found');
        finishWorkoutCameraCallback(null);
        return;
    }

    // Update dynamic label
    const labelEl = document.getElementById('generic-camera-label');
    if (labelEl) labelEl.textContent = label || 'Take a photo';

    // Enter immersive mode (hide status bar) on native
    if (window.NativePermissions && window.NativePermissions.enterImmersiveMode) {
        try { window.NativePermissions.enterImmersiveMode(); } catch(e) {}
    }

    modal.style.display = 'flex';
    await startWorkoutCamera();
}

// Convert a data URL (e.g. "data:image/jpeg;base64,...") into a File object.
function dataUrlToFile(dataUrl, filename) {
    const [meta, b64] = dataUrl.split(',');
    const mime = (meta.match(/data:(.*?);base64/) || [null, 'image/jpeg'])[1];
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], filename, { type: mime });
}

async function startWorkoutCamera() {
    stopWorkoutCamera();

    // Request native Android camera permission via bridge (same as unified camera)
    if (window.NativePermissions) {
        try {
            if (window.NativePermissions.isPermissionPermanentlyDenied &&
                window.NativePermissions.isPermissionPermanentlyDenied()) {
                showWorkoutCameraPermissionIssue();
                closeWorkoutCamera();
                finishWorkoutCameraCallback(null);
                return;
            }
            if (!window.NativePermissions.hasCameraPermission()) {
                const granted = await new Promise((resolve) => {
                    window._onNativeCameraPermission = function(result) {
                        delete window._onNativeCameraPermission;
                        resolve(result);
                    };
                    window.NativePermissions.requestCameraPermission();
                    setTimeout(() => {
                        if (window._onNativeCameraPermission) {
                            delete window._onNativeCameraPermission;
                            resolve(false);
                        }
                    }, 60000);
                });
                if (!granted) {
                    showWorkoutCameraPermissionIssue();
                    closeWorkoutCamera();
                    finishWorkoutCameraCallback(null);
                    return;
                }
            }
        } catch (bridgeErr) {
            console.warn('NativePermissions bridge error:', bridgeErr);
        }
    }

    try {
        workoutCameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: workoutCameraFacingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false
        });
        const video = document.getElementById('workout-camera-video');
        video.srcObject = workoutCameraStream;
        video.style.opacity = '0';
        await video.play();
        video.style.opacity = '1';
    } catch (err) {
        console.error('Workout camera failed:', err);
        if (err.name === 'NotAllowedError') {
            showWorkoutCameraPermissionIssue();
        } else {
            showToast('Could not access camera. Check permissions.', 'error');
        }
        closeWorkoutCamera();
        finishWorkoutCameraCallback(null);
    }
}

function stopWorkoutCamera() {
    clearWorkoutCameraCountdown();
    if (workoutCameraStream) {
        workoutCameraStream.getTracks().forEach(t => t.stop());
        workoutCameraStream = null;
    }
    const video = document.getElementById('workout-camera-video');
    if (video) video.srcObject = null;
}

function closeWorkoutCamera(resolveAsCancel = false) {
    stopWorkoutCamera();
    const modal = document.getElementById('workout-camera-modal');
    if (modal) modal.style.display = 'none';
    const video = document.getElementById('workout-camera-video');
    if (video) video.style.opacity = '0';
    // Exit immersive mode
    if (window.NativePermissions && window.NativePermissions.exitImmersiveMode) {
        try { window.NativePermissions.exitImmersiveMode(); } catch(e) {}
    }
    if (resolveAsCancel) {
        finishWorkoutCameraCallback(null);
    }
}

function flipWorkoutCamera() {
    clearWorkoutCameraCountdown();
    workoutCameraFacingMode = workoutCameraFacingMode === 'environment' ? 'user' : 'environment';
    startWorkoutCamera();
}

function captureWorkoutPhoto() {
    if (workoutCameraCaptureInProgress) return;
    if (workoutCameraTimerSeconds > 0) {
        startWorkoutCameraCountdown(workoutCameraTimerSeconds);
        return;
    }
    captureWorkoutPhotoNow();
}

function startWorkoutCameraCountdown(seconds) {
    const overlay = document.getElementById('workout-camera-countdown');
    const numberEl = document.getElementById('workout-camera-countdown-number');
    if (!overlay || !numberEl) {
        captureWorkoutPhotoNow();
        return;
    }

    let remaining = Number(seconds) || 0;
    if (remaining <= 0) {
        captureWorkoutPhotoNow();
        return;
    }

    workoutCameraCaptureInProgress = true;
    overlay.style.display = 'flex';
    numberEl.textContent = String(remaining);

    workoutCameraCountdownTimer = setInterval(function() {
        remaining -= 1;
        if (remaining > 0) {
            numberEl.textContent = String(remaining);
            return;
        }

        clearWorkoutCameraCountdown();
        captureWorkoutPhotoNow();
    }, 1000);
}

function captureWorkoutPhotoNow() {
    const video = document.getElementById('workout-camera-video');
    const canvas = document.getElementById('workout-camera-canvas');
    if (!video || !canvas || video.readyState < 2) {
        showToast('Camera not ready. Please wait a moment.', 'warning');
        return;
    }

    // Animate button
    const btn = document.getElementById('workout-capture-btn');
    if (btn) { btn.style.transform = 'scale(0.9)'; setTimeout(() => { btn.style.transform = ''; }, 150); }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
        if (!blob) {
            showToast('Failed to capture photo.', 'error');
            return;
        }
        const file = new File([blob], `workout-${Date.now()}.jpg`, { type: 'image/jpeg' });
        closeWorkoutCamera();
        finishWorkoutCameraCallback(file);
    }, 'image/jpeg', 0.92);
}
// --- End Workout Camera ---

// ==========================================
// WORKOUT SHARE PHOTO CACHING
// One photo captured up front and reused across the selected share destination.
// ==========================================

// Validate that the workout is long enough to earn share XP.
// Returns true if valid, false + shows a toast if not.
function getWorkoutDurationMinutesForShare() {
    const successDurationEl = document.getElementById('success-duration');
    const durationText = successDurationEl ? successDurationEl.textContent : '00:00';
    const [mins, secs] = durationText.split(':').map(Number);
    return {
        mins: Number.isFinite(mins) ? mins : 0,
        secs: Number.isFinite(secs) ? secs : 0,
        totalMinutes: (Number.isFinite(mins) ? mins : 0) + ((Number.isFinite(secs) ? secs : 0) / 60)
    };
}

function isWorkoutDurationEligibleForShareXP(showMessage = true) {
    const duration = getWorkoutDurationMinutesForShare();
    const totalMinutes = duration.totalMinutes;
    if (totalMinutes < 15) {
        if (showMessage) {
            showToast(`Workout must be 15+ minutes for XP (yours: ${duration.mins}m ${duration.secs}s)`, 'error');
        }
        return false;
    }
    return true;
}

function validateWorkoutDurationForShare() {
    return isWorkoutDurationEligibleForShareXP(true);
}

// Called when the user taps "Take Gym Photo" on the post-workout success screen.
// Opens the camera, caches the result, and flips the share section UI to the
// preview + share-buttons state.
async function captureWorkoutSharePhoto() {
    // Bounce the button for feedback
    const takeBtn = document.getElementById('share-take-photo-btn');
    if (takeBtn) {
        takeBtn.style.transform = 'scale(0.97)';
        setTimeout(() => { if (takeBtn) takeBtn.style.transform = ''; }, 150);
    }

    openWorkoutCamera(async (file) => {
        if (!file) return;
        await onWorkoutSharePhotoReady(file);
    }, 'Take a workout photo');
}

// Called when the user taps "Retake" on the photo preview. Discards the
// cached photo and reopens the camera.
function retakeWorkoutSharePhoto() {
    cachedWorkoutShareFile = null;
    cachedWorkoutShareBase64 = null;

    // Flip UI back to the capture step
    const captureStep = document.getElementById('share-step-capture');
    const shareStep = document.getElementById('share-step-share');
    if (captureStep) captureStep.style.display = 'block';
    if (shareStep) shareStep.style.display = 'none';

    // Reopen the camera immediately
    captureWorkoutSharePhoto();
}

// Store the captured photo and flip the UI into its "share buttons" state.
async function onWorkoutSharePhotoReady(file) {
    try {
        // Prepare once up front so previews, hashes, and uploads use upright pixels.
        const preparedFile = typeof window.normalizeFeedImageUploadFile === 'function'
            ? await window.normalizeFeedImageUploadFile(file)
            : file;
        const compressedFile = typeof compressMealImage === 'function'
            ? await compressMealImage(preparedFile)
            : preparedFile;
        const base64Data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(compressedFile);
        });
        cachedWorkoutShareFile = compressedFile;
        cachedWorkoutShareBase64 = base64Data;

        // Update the preview image
        const preview = document.getElementById('share-photo-preview');
        if (preview) preview.src = base64Data;

        // Swap visible step
        const captureStep = document.getElementById('share-step-capture');
        const shareStep = document.getElementById('share-step-share');
        if (captureStep) captureStep.style.display = 'none';
        if (shareStep) shareStep.style.display = 'block';

        // Update the sub-heading
        updateWorkoutInstagramShareVisibility();
        const sub = document.getElementById('share-section-sub');
        if (sub) sub.textContent = getWorkoutShareSubheading(true);

        if (pendingPostWorkoutCompositeShare) {
            await preparePostWorkoutCompositePreview();
            if (window.BalancePrivateShareStudio?.isEnabled?.()) {
                const pending = pendingPostWorkoutCompositeShare;
                await window.BalancePrivateShareStudio.open({
                    context: pending?.type === 'pb' ? 'pb' : 'workout',
                    photoDataUrl: cachedWorkoutShareBase64,
                    cardPayload: pending?.cardPayload,
                    previewTarget: 'story',
                    overlayStyle: getBalanceShareOverlayStyle(pending?.type),
                    textStyle: getBalanceShareTextStyle(pending?.type),
                    onFeed: async () => sharePendingPostWorkoutCompositeToFeed(),
                    onInstagram: async () => pending.type === 'workout'
                        ? shareWorkoutCardToInstagram()
                        : shareBalanceCardToInstagram(pending.cardPayload, 'story', {
                            photoDataUrl: cachedWorkoutShareBase64,
                            overlayStyle: getBalanceShareOverlayStyle(pending.type),
                            textStyle: getBalanceShareTextStyle(pending.type)
                        })
                });
            }
        } else {
            const workoutPayload = buildWorkoutShareCardPayload();
            if (workoutPayload) {
                await renderBalanceShareStylePreview('workout', workoutPayload, cachedWorkoutShareBase64, {
                    previewImageId: 'share-photo-preview',
                    previewWrapId: 'share-photo-preview-wrap',
                    controlsId: 'workout-share-style-controls'
                });
                if (window.BalancePrivateShareStudio?.isEnabled?.()) {
                    await window.BalancePrivateShareStudio.open({
                        context: 'workout',
                        photoDataUrl: cachedWorkoutShareBase64,
                        cardPayload: workoutPayload,
                        previewTarget: 'story',
                        overlayStyle: getBalanceShareOverlayStyle('workout'),
                        textStyle: getBalanceShareTextStyle('workout'),
                        onFeed: async () => shareWorkoutCardToFeed(),
                        onInstagram: async () => shareWorkoutCardToInstagram()
                    });
                }
            }
        }
    } catch (err) {
        console.error('Failed to process workout share photo:', err);
        showToast('Couldn\'t process that photo. Try again.', 'error');
    }
}

// Reset the share section UI back to its initial "take photo" state. Called
// when the success screen is opened (fresh workout) and when it closes.
function resetWorkoutShareUI() {
    cachedWorkoutShareFile = null;
    cachedWorkoutShareBase64 = null;
    pendingPostWorkoutCompositeShare = null;
    postWorkoutShareCompleted = { workout: false, photo: false, pbs: {} };
    postWorkoutShareBusy = null;
    loadWorkoutInstagramShareCompleted();

    const captureStep = document.getElementById('share-step-capture');
    const shareStep = document.getElementById('share-step-share');
    if (captureStep) captureStep.style.display = 'none';
    if (shareStep) shareStep.style.display = 'none';

    const sub = document.getElementById('share-section-sub');
    if (sub) sub.textContent = getWorkoutShareSubheading(false);

    setPostWorkoutShareMenuOpen(false);
    setPostWorkoutShareStatus('');

    const postWorkoutPreviewWrap = document.getElementById('post-workout-photo-preview-wrap');
    const postWorkoutPreview = document.getElementById('post-workout-photo-preview');
    if (postWorkoutPreviewWrap) postWorkoutPreviewWrap.style.display = 'none';
    if (postWorkoutPreview) postWorkoutPreview.removeAttribute('src');
    const workoutStyleControls = document.getElementById('workout-share-style-controls');
    const workoutStylePreviewWrap = document.getElementById('share-photo-preview-wrap');
    if (workoutStyleControls) workoutStyleControls.style.display = 'none';
    if (workoutStylePreviewWrap) workoutStylePreviewWrap.style.display = 'none';

    const takeBtn = document.getElementById('share-take-photo-btn');
    if (takeBtn) {
        takeBtn.disabled = false;
        takeBtn.style.opacity = '1';
        takeBtn.innerHTML = '<span style="font-size: 1.5rem;">📷</span><span style="font-size: 1rem;">Take Gym Photo</span>';
    }

    const cardBtn = document.getElementById('share-workout-card-btn');
    if (cardBtn) {
        cardBtn.disabled = false;
        cardBtn.setAttribute('onclick', 'shareWorkoutCardToFeed()');
        cardBtn.style.opacity = '1';
        cardBtn.style.background = 'linear-gradient(135deg, #ffffff, #f0fdf4)';
        cardBtn.style.border = 'none';
        cardBtn.innerHTML = `<span style="font-size: 1.3rem;">📢</span><span style="font-size: 0.95rem;">${getWorkoutFeedShareButtonLabel()}</span>`;
    }

    renderWorkoutInstagramShareButton();
    updateWorkoutInstagramShareVisibility();
    renderPostWorkoutShareMenu();
    syncWorkoutFeedShareUsedToday().then(function(usedToday) {
        if (!usedToday) return;
        const currentCardBtn = document.getElementById('share-workout-card-btn');
        const currentCardLabel = currentCardBtn?.querySelector('span:last-child');
        if (currentCardLabel) currentCardLabel.textContent = getWorkoutFeedShareButtonLabel();
        renderPostWorkoutShareMenu();
    });
}
window.resetWorkoutShareUI = resetWorkoutShareUI;

let postWorkoutShareCompleted = { workout: false, photo: false, pbs: {} };
let postWorkoutShareBusy = null;

async function preparePostWorkoutCompositePreview() {
    const pending = pendingPostWorkoutCompositeShare;
    if (!pending || !cachedWorkoutShareBase64) return;

    try {
        const preview = document.getElementById('share-photo-preview');
        const captureStep = document.getElementById('share-step-capture');
        const shareStep = document.getElementById('share-step-share');
        const shareButton = document.getElementById('share-workout-card-btn');
        const igOptions = document.getElementById('share-workout-ig-options');

        if (preview) preview.alt = pending.type === 'pb' ? 'Personal best share preview' : 'Workout share preview';
        if (captureStep) captureStep.style.display = 'none';
        if (shareStep) shareStep.style.display = 'block';
        await renderBalanceShareStylePreview(pending.type, pending.cardPayload, cachedWorkoutShareBase64, {
            previewImageId: 'share-photo-preview',
            previewWrapId: 'share-photo-preview-wrap',
            controlsId: 'workout-share-style-controls'
        });
        if (shareButton) {
            shareButton.disabled = false;
            shareButton.setAttribute('onclick', 'sharePendingPostWorkoutCompositeToFeed()');
            const feedRewardLabel = isWorkoutFeedShareUsedToday() ? '' : ' (+15 XP)';
            shareButton.innerHTML = pending.cardPayload.card_type === 'pb'
                ? `<span style="font-size:1.3rem;">🏆</span><span style="font-size:0.95rem;">Photo + PB to Feed${feedRewardLabel}</span>`
                : `<span style="font-size:1.3rem;">📢</span><span style="font-size:0.95rem;">Photo + workout to Feed${feedRewardLabel}</span>`;
        }
        if (igOptions) igOptions.style.display = pending.cardPayload.card_type === 'pb' ? 'none' : 'block';
        setPostWorkoutShareStatus('Preview ready. Check the overlay, then share it.', 'info');
    } catch (error) {
        console.error('Could not prepare combined workout share preview:', error);
        setPostWorkoutShareStatus('Could not build the combined preview. Try again.', 'error');
    }
}

function postWorkoutShareFileFromDataUrl(dataUrl, fileName) {
    const blob = pbbShareDataUrlToBlob(dataUrl);
    try {
        return new File([blob], fileName || 'balance-workout-share.jpg', { type: blob.type || 'image/jpeg', lastModified: Date.now() });
    } catch (_) {
        blob.name = fileName || 'balance-workout-share.jpg';
        return blob;
    }
}

async function beginPostWorkoutCompositeShare(cardPayload, type, index) {
    if (!window.currentUser || !window.currentUser.id) {
        showToast('Please log in to share', 'error');
        return;
    }
    if (!cardPayload) {
        showToast('Nothing to share yet', 'error');
        return;
    }

    pendingPostWorkoutCompositeShare = {
        cardPayload,
        type: type === 'pb' ? 'pb' : 'workout',
        index: typeof index === 'number' ? index : null
    };
    setPostWorkoutShareMenuOpen(false);
    postWorkoutShareBusy = pendingPostWorkoutCompositeShare.type === 'pb' ? 'pb:' + index : 'workout-photo';
    setPostWorkoutShareStatus(window.BalancePrivateShareStudio?.isEnabled?.()
        ? 'Choose a gym photo to design your share.'
        : 'Opening camera for your gym photo...');
    renderPostWorkoutShareMenu();

    if (cachedWorkoutShareBase64) {
        await preparePostWorkoutCompositePreview();
        postWorkoutShareBusy = null;
        return;
    }

    const useSelectedWorkoutPhoto = async function(file) {
        if (!file) {
            pendingPostWorkoutCompositeShare = null;
            postWorkoutShareBusy = null;
            setPostWorkoutShareStatus('');
            renderPostWorkoutShareMenu();
            return;
        }
        await onWorkoutSharePhotoReady(file);
        postWorkoutShareBusy = null;
        renderPostWorkoutShareMenu();
    };

    if (window.BalancePrivateShareStudio?.isEnabled?.() && typeof window.BalancePrivateShareStudio.choosePhoto === 'function') {
        window.BalancePrivateShareStudio.choosePhoto({
            onCamera: function() {
                openWorkoutCamera(useSelectedWorkoutPhoto, 'Take a gym photo for your workout share');
            },
            onGallery: function() {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.style.display = 'none';
                input.addEventListener('change', async function() {
                    await useSelectedWorkoutPhoto(input.files?.[0] || null);
                    input.remove();
                }, { once: true });
                document.body.appendChild(input);
                input.click();
            },
            onCancel: function() {
                pendingPostWorkoutCompositeShare = null;
                postWorkoutShareBusy = null;
                setPostWorkoutShareStatus('');
                renderPostWorkoutShareMenu();
            }
        });
        return;
    }

    openWorkoutCamera(useSelectedWorkoutPhoto, 'Take a gym photo for your workout share');
}

async function sharePendingPostWorkoutCompositeToFeed() {
    const pending = pendingPostWorkoutCompositeShare;
    if (!pending || !cachedWorkoutShareBase64) {
        showToast('Take a gym photo first.', 'info');
        return;
    }

    postWorkoutShareBusy = pending.type === 'pb' ? 'pb:' + pending.index : 'workout-photo';
    setPostWorkoutShareStatus('Building your photo overlay...');
    const button = document.getElementById('share-workout-card-btn');
    let didShare = false;
    if (button) {
        button.disabled = true;
        button.style.opacity = '0.72';
    }

    try {
        const compositeDataUrl = await renderBalanceShareCardImage(pending.cardPayload, {
            target: 'feed',
            photoDataUrl: cachedWorkoutShareBase64,
            overlayStyle: getBalanceShareOverlayStyle(pending.type),
            textStyle: getBalanceShareTextStyle(pending.type)
        });
        const compositeFile = postWorkoutShareFileFromDataUrl(compositeDataUrl, 'balance-workout-overlay.jpg');
        const tempStoryId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
        if (typeof uploadStoryMediaToBackblaze !== 'function') {
            throw new Error('Feed uploader is still loading. Please try again.');
        }
        // Canvas-created files can fail when iOS WKWebView sends them through
        // a multipart FormData relay. Use the Feed's authenticated direct B2
        // uploader, which already selects the native-safe XHR transport.
        const uploadData = await uploadStoryMediaToBackblaze(compositeFile, {
            userId: window.currentUser.id,
            storyId: tempStoryId,
            source: 'feed_workout_photo_overlay',
            preferDirectUpload: true
        });
        if (!uploadData?.url) throw new Error('The overlay upload was not confirmed.');
        const storyPayload = Object.assign({}, pending.cardPayload, {
            share_style: 'photo_overlay',
            share_overlay_style: getBalanceShareOverlayStyle(pending.type),
            share_text_style: getBalanceShareTextStyle(pending.type),
            share_caption: pending.type === 'pb' ? 'Personal best, captured in the moment.' : 'Workout complete, captured in the moment.'
        });
        const story = await dbHelpers.stories.create(window.currentUser.id, {
            media_type: 'workout_card',
            media_url: uploadData.url,
            thumbnail_url: uploadData.url,
            caption: JSON.stringify(storyPayload),
            duration: 5
        });

        const xpResult = await awardPostWorkoutFeedShareXP(new Date().toISOString(), null);
        if (pending.type === 'pb' && pending.index != null) {
            postWorkoutShareCompleted.pbs[String(pending.index)] = true;
        } else {
            postWorkoutShareCompleted.workout = true;
        }
        didShare = true;
        pendingPostWorkoutCompositeShare = null;
        if (typeof loadPhotoFeed === 'function') loadPhotoFeed('friends-photo-feed', 'friends-feed-empty');
        if (typeof loadStories === 'function') loadStories();

        const shareLabel = pending.type === 'pb' ? 'Photo + PB overlay' : 'Photo + workout overlay';
        const message = xpResult?.success ? shareLabel + ' shared. +15 XP earned.' : shareLabel + ' shared to Feed.';
        setPostWorkoutShareStatus(message, 'success');
        showToast(message, 'success');
        return story;
    } catch (error) {
        console.error('Error sharing workout photo overlay to Feed:', error);
        setPostWorkoutShareStatus('Could not share the overlay. Please try again.', 'error');
        showToast('Could not share the overlay. Please try again.', 'error');
        return null;
    } finally {
        postWorkoutShareBusy = null;
        if (button) {
            button.disabled = didShare;
            button.style.opacity = '1';
            if (didShare) {
                button.style.background = 'rgba(68, 255, 68, 0.3)';
                button.style.border = '1px solid rgba(68, 255, 68, 0.5)';
                button.innerHTML = '<span style="font-size:1.3rem;">✅</span><span style="font-size:0.95rem;">Shared to Feed</span>';
            }
        }
        renderPostWorkoutShareMenu();
    }
}

function getPostWorkoutShareViewportBottom() {
    const bottomNav = document.querySelector('.bottom-nav');
    if (!bottomNav) return window.innerHeight;

    const navStyle = window.getComputedStyle(bottomNav);
    if (navStyle.display === 'none' || navStyle.visibility === 'hidden') {
        return window.innerHeight;
    }

    const navRect = bottomNav.getBoundingClientRect();
    if (navRect.height <= 0 || navRect.top >= window.innerHeight) {
        return window.innerHeight;
    }

    return Math.max(0, navRect.top);
}

function positionPostWorkoutShareMenu() {
    const menu = document.getElementById('post-workout-share-menu');
    const btn = document.getElementById('post-workout-share-btn');
    if (!menu || !btn || menu.style.display === 'none') return;

    const btnRect = btn.getBoundingClientRect();
    const gap = 8;
    const cushion = 12;
    const maxMenuHeight = 330;
    const minMenuHeight = 120;
    const viewportBottom = getPostWorkoutShareViewportBottom();
    const availableBelow = Math.max(minMenuHeight, viewportBottom - btnRect.bottom - gap - cushion);
    const availableAbove = Math.max(minMenuHeight, btnRect.top - gap - cushion);
    const preferredHeight = Math.min(menu.scrollHeight || maxMenuHeight, maxMenuHeight);
    const shouldOpenUp = availableBelow < preferredHeight && availableAbove > availableBelow;
    const availableHeight = shouldOpenUp ? availableAbove : availableBelow;

    menu.style.top = shouldOpenUp ? 'auto' : 'calc(100% + 8px)';
    menu.style.bottom = shouldOpenUp ? 'calc(100% + 8px)' : 'auto';
    menu.style.maxHeight = Math.max(minMenuHeight, Math.min(maxMenuHeight, availableHeight)) + 'px';
    menu.style.overflowY = 'auto';
}

function setPostWorkoutShareMenuOpen(open) {
    const menu = document.getElementById('post-workout-share-menu');
    const btn = document.getElementById('post-workout-share-btn');
    const chevron = document.getElementById('post-workout-share-chevron');
    if (menu) menu.style.display = open ? 'block' : 'none';
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (chevron) chevron.textContent = open ? '^' : 'v';
    if (open) {
        renderPostWorkoutShareMenu();
        positionPostWorkoutShareMenu();
    }
}

function togglePostWorkoutShareMenu(event) {
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
    const menu = document.getElementById('post-workout-share-menu');
    const isOpen = !!(menu && menu.style.display !== 'none');
    setPostWorkoutShareMenuOpen(!isOpen);
}

function setPostWorkoutShareStatus(message, type = 'info') {
    const status = document.getElementById('post-workout-share-status');
    if (!status) return;
    if (!message) {
        status.style.display = 'none';
        status.textContent = '';
        return;
    }
    status.style.display = 'block';
    status.textContent = message;
    status.style.background = type === 'error'
        ? 'rgba(239,68,68,0.22)'
        : type === 'success'
            ? 'rgba(34,197,94,0.22)'
            : 'rgba(255,255,255,0.14)';
}

function createPostWorkoutShareOption(config) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('role', 'menuitem');
    btn.style.cssText = 'width:100%; border:none; border-radius:10px; background:#f8fafc; color:#0f172a; padding:12px; min-height:58px; cursor:pointer; display:flex; flex-direction:column; align-items:flex-start; gap:3px; text-align:left; font-family:inherit; margin:0 0 6px;';

    const title = document.createElement('span');
    title.textContent = config.title;
    title.style.cssText = 'font-size:0.95rem; font-weight:900; color:#0f172a; line-height:1.2;';
    btn.appendChild(title);

    if (config.detail) {
        const detail = document.createElement('span');
        detail.textContent = config.detail;
        detail.style.cssText = 'font-size:0.78rem; font-weight:700; color:#64748b; line-height:1.25;';
        btn.appendChild(detail);
    }

    if (config.disabled) {
        btn.disabled = true;
        btn.style.opacity = '0.58';
        btn.style.cursor = 'default';
    } else if (typeof config.onClick === 'function') {
        btn.addEventListener('click', function(event) {
            event.stopPropagation();
            config.onClick();
        });
    }

    return btn;
}

function renderPostWorkoutShareMenu() {
    const menu = document.getElementById('post-workout-share-menu');
    if (!menu) return;

    menu.innerHTML = '';
    const data = typeof completedWorkoutDataForShare !== 'undefined' ? completedWorkoutDataForShare : null;
    const pbs = data && Array.isArray(data.newPBs) ? data.newPBs : [];
    const isBusy = !!postWorkoutShareBusy;
    const rewardDetail = isWorkoutFeedShareUsedToday()
        ? ' Daily workout share XP is already used.'
        : ' First workout or PB share today earns +15 XP.';

    menu.appendChild(createPostWorkoutShareOption({
        title: postWorkoutShareCompleted.workout ? 'Photo + workout shared' : (postWorkoutShareBusy === 'workout-photo' ? 'Preparing workout overlay...' : 'Photo + workout'),
        detail: data ? 'Take a gym photo and place your workout summary over it.' + rewardDetail : 'No completed workout ready.',
        disabled: !data || isBusy || postWorkoutShareCompleted.workout,
        onClick: function() { beginPostWorkoutCompositeShare(buildWorkoutShareCardPayload(), 'workout'); }
    }));

    menu.appendChild(createPostWorkoutShareOption({
        title: postWorkoutShareCompleted.workout ? 'Workout shared' : (postWorkoutShareBusy === 'workout' ? 'Sharing workout...' : 'Share workout'),
        detail: data ? 'Post your workout summary to Feed.' + rewardDetail : 'No completed workout ready.',
        disabled: !data || isBusy || postWorkoutShareCompleted.workout,
        onClick: sharePostWorkoutWorkoutToFeed
    }));

    if (pbs.length > 0) {
        pbs.forEach(function(pb, index) {
            const key = String(index);
            const value = typeof pbbFormatPBShareValue === 'function' ? pbbFormatPBShareValue(pb) : '';
            menu.appendChild(createPostWorkoutShareOption({
                title: postWorkoutShareCompleted.pbs[key] ? 'Photo + PB shared' : (postWorkoutShareBusy === 'pb:' + key ? 'Preparing PB overlay...' : 'Photo + PB: ' + (pb.exercise || 'Personal best')),
                detail: (value ? value + ' over your gym photo.' : 'Place this personal best over a gym photo.') + rewardDetail,
                disabled: isBusy || !!postWorkoutShareCompleted.pbs[key],
                onClick: function() { beginPostWorkoutCompositeShare(buildPBShareCardPayload(pb), 'pb', index); }
            }));
            menu.appendChild(createPostWorkoutShareOption({
                title: postWorkoutShareCompleted.pbs[key] ? 'PB shared' : (postWorkoutShareBusy === 'pb:' + key ? 'Sharing PB...' : 'Share PB: ' + (pb.exercise || 'Personal best')),
                detail: (value || 'Post this personal best to Feed.') + rewardDetail,
                disabled: isBusy || !!postWorkoutShareCompleted.pbs[key],
                onClick: function() { sharePostWorkoutPBToFeed(index); }
            }));
        });
    } else {
        menu.appendChild(createPostWorkoutShareOption({
            title: 'Share PB',
            detail: 'No new PB from this workout.',
            disabled: true
        }));
    }

    menu.appendChild(createPostWorkoutShareOption({
        title: postWorkoutShareCompleted.photo ? 'Photo shared' : (postWorkoutShareBusy === 'photo' ? 'Posting photo...' : 'Share photo'),
        detail: data ? 'Take a workout photo and post it to Feed.' + rewardDetail : 'No completed workout ready.',
        disabled: !data || isBusy || postWorkoutShareCompleted.photo,
        onClick: sharePostWorkoutPhotoToFeed
    }));

    if (menu.style.display !== 'none') positionPostWorkoutShareMenu();
}

async function awardPostWorkoutFeedShareXP(photoTimestamp, photoHash) {
    if (isWorkoutFeedShareUsedToday()) return null;
    if (!isWorkoutDurationEligibleForShareXP(false)) return null;
    const result = await awardBalanceSocialShareXP(
        'workout',
        'balance_feed',
        getCompletedWorkoutSocialShareReferenceId()
    );
    if (result?.success || result?.alreadyAwarded) markWorkoutFeedShareUsedToday();
    return result;
}

async function sharePostWorkoutWorkoutToFeed() {
    setPostWorkoutShareMenuOpen(false);
    if (!window.currentUser || !window.currentUser.id) {
        showToast('Please log in to share', 'error');
        return;
    }
    if (!completedWorkoutDataForShare) {
        showToast('No workout data to share', 'error');
        return;
    }

    postWorkoutShareBusy = 'workout';
    setPostWorkoutShareStatus('Sharing workout to Feed...');
    renderPostWorkoutShareMenu();

    try {
        const cardPayload = buildWorkoutShareCardPayload();
        if (!cardPayload) throw new Error('Workout card could not be built');

        await dbHelpers.stories.create(window.currentUser.id, {
            media_type: 'workout_card',
            media_url: '',
            thumbnail_url: null,
            caption: JSON.stringify(cardPayload),
            duration: 5
        });

        const xpResult = await awardPostWorkoutFeedShareXP(new Date().toISOString(), null);
        postWorkoutShareCompleted.workout = true;

        if (typeof loadPhotoFeed === 'function') {
            loadPhotoFeed('friends-photo-feed', 'friends-feed-empty');
        }

        const message = xpResult?.success ? 'Workout shared to Feed. +15 XP earned.' : 'Workout shared to Feed.';
        setPostWorkoutShareStatus(message, 'success');
        showToast(message, 'success');
    } catch (error) {
        console.error('Error sharing workout to Feed:', error);
        setPostWorkoutShareStatus('Could not share workout. Please try again.', 'error');
        showToast('Could not share workout. Please try again.', 'error');
    } finally {
        postWorkoutShareBusy = null;
        renderPostWorkoutShareMenu();
    }
}

async function sharePostWorkoutPBToFeed(index) {
    const pbs = completedWorkoutDataForShare && Array.isArray(completedWorkoutDataForShare.newPBs)
        ? completedWorkoutDataForShare.newPBs
        : [];
    const pbData = pbs[index];
    if (!pbData) {
        showToast('No PB to share', 'error');
        return;
    }

    if (!cachedWorkoutShareBase64) {
        setPostWorkoutShareMenuOpen(false);
        showToast('Take a selfie or gym photo for your PB share first.', 'info');
        openWorkoutCamera(async function(file) {
            if (!file) return;
            await onWorkoutSharePhotoReady(file);
            await sharePostWorkoutPBToFeed(index);
        }, 'Take a selfie or gym photo for your PB share');
        return;
    }

    setPostWorkoutShareMenuOpen(false);
    const key = String(index);
    postWorkoutShareBusy = 'pb:' + key;
    setPostWorkoutShareStatus('Sharing PB to Feed...');
    renderPostWorkoutShareMenu();

    try {
        const story = await sharePBCardToFeed(pbData, cachedWorkoutShareBase64);
        if (story) {
            postWorkoutShareCompleted.pbs[key] = true;
            setPostWorkoutShareStatus('PB shared to Feed.', 'success');
        }
    } catch (error) {
        console.error('Error sharing PB to Feed:', error);
        setPostWorkoutShareStatus('Could not share PB. Please try again.', 'error');
        showToast('Could not share PB. Please try again.', 'error');
    } finally {
        postWorkoutShareBusy = null;
        renderPostWorkoutShareMenu();
    }
}

function sharePostWorkoutPhotoToFeed() {
    setPostWorkoutShareMenuOpen(false);
    if (!window.currentUser || !window.currentUser.id) {
        showToast('Please log in to share', 'error');
        return;
    }
    if (!completedWorkoutDataForShare) {
        showToast('No workout data to share', 'error');
        return;
    }

    postWorkoutShareBusy = 'photo';
    setPostWorkoutShareStatus('Opening camera...');
    renderPostWorkoutShareMenu();

    openWorkoutCamera(async function(file) {
        if (!file) {
            postWorkoutShareBusy = null;
            setPostWorkoutShareStatus('');
            renderPostWorkoutShareMenu();
            return;
        }
        await uploadPostWorkoutPhotoToFeed(file);
    }, 'Take a workout photo');
}

async function uploadPostWorkoutPhotoToFeed(file) {
    postWorkoutShareBusy = 'photo';
    setPostWorkoutShareStatus('Posting photo to Feed...');
    renderPostWorkoutShareMenu();

    try {
        const userId = window.currentUser.id;
        const preparedFile = typeof window.normalizeFeedImageUploadFile === 'function'
            ? await window.normalizeFeedImageUploadFile(file)
            : file;
        const compressedFile = typeof compressMealImage === 'function'
            ? await compressMealImage(preparedFile)
            : preparedFile;
        const base64Data = await new Promise(function(resolve, reject) {
            const reader = new FileReader();
            reader.onload = function(event) { resolve(event.target.result); };
            reader.onerror = reject;
            reader.readAsDataURL(compressedFile);
        });

        let photoHash = null;
        try {
            if (window.db?.points?.generatePhotoHash) {
                photoHash = await window.db.points.generatePhotoHash(base64Data);
            }
        } catch (hashError) {
            console.warn('Could not hash workout photo:', hashError);
        }

        const tempStoryId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
        const formData = new FormData();
        formData.append('file', compressedFile);
        formData.append('userId', userId);
        formData.append('storyId', tempStoryId);
        formData.append('source', 'workout_completion_photo');

        const uploadResponse = await fetch('/api/upload-story-media', {
            method: 'POST',
            body: formData
        });

        if (!uploadResponse.ok) {
            let message = 'Upload failed';
            try {
                const errorData = await uploadResponse.json();
                message = errorData.error || message;
            } catch (e) {}
            throw new Error(message);
        }

        const uploadData = await uploadResponse.json();
        const workoutName = completedWorkoutDataForShare?.workoutName || 'Workout';
        await dbHelpers.stories.create(userId, {
            media_type: 'image',
            media_url: uploadData.url,
            thumbnail_url: null,
            caption: `Just finished ${workoutName}!`,
            duration: 5
        });

        const photoTimestamp = new Date().toISOString();
        const xpResult = await awardPostWorkoutFeedShareXP(photoTimestamp, photoHash);
        postWorkoutShareCompleted.photo = true;

        const preview = document.getElementById('post-workout-photo-preview');
        const previewWrap = document.getElementById('post-workout-photo-preview-wrap');
        if (preview) preview.src = base64Data;
        if (previewWrap) previewWrap.style.display = 'block';

        if (typeof loadPhotoFeed === 'function') {
            loadPhotoFeed('friends-photo-feed', 'friends-feed-empty');
        }
        if (typeof loadStories === 'function') {
            loadStories();
        }

        const message = xpResult?.success ? 'Photo shared to Feed. +15 XP earned.' : 'Photo shared to Feed.';
        setPostWorkoutShareStatus(message, 'success');
        showToast(message, 'success');
    } catch (error) {
        console.error('Error sharing workout photo to Feed:', error);
        setPostWorkoutShareStatus('Could not share photo. Please try again.', 'error');
        showToast('Could not share photo. Please try again.', 'error');
    } finally {
        postWorkoutShareBusy = null;
        renderPostWorkoutShareMenu();
    }
}

document.addEventListener('click', function(event) {
    const root = document.getElementById('post-workout-share-root');
    const menu = document.getElementById('post-workout-share-menu');
    if (!root || !menu || menu.style.display === 'none') return;
    if (!root.contains(event.target)) setPostWorkoutShareMenuOpen(false);
});

window.addEventListener('resize', positionPostWorkoutShareMenu);

window.togglePostWorkoutShareMenu = togglePostWorkoutShareMenu;
window.renderPostWorkoutShareMenu = renderPostWorkoutShareMenu;
window.beginPostWorkoutCompositeShare = beginPostWorkoutCompositeShare;
window.sharePendingPostWorkoutCompositeToFeed = sharePendingPostWorkoutCompositeToFeed;
window.sharePostWorkoutWorkoutToFeed = sharePostWorkoutWorkoutToFeed;
window.sharePostWorkoutPBToFeed = sharePostWorkoutPBToFeed;
window.sharePostWorkoutPhotoToFeed = sharePostWorkoutPhotoToFeed;

// Share workout to story - requires camera photo
function shareWorkoutToStory() {
    // Check if already earned story point this session
    if (workoutPointsEarnedThisSession.story) {
        showToast('You already earned the feed post point for this workout!', 'info');
        return;
    }

    // Check workout duration first - must be at least 15 minutes for points
    const successDurationEl = document.getElementById('success-duration');
    const durationText = successDurationEl ? successDurationEl.textContent : '00:00';
    const [mins, secs] = durationText.split(':').map(Number);
    const totalMinutes = mins + (secs / 60);

    if (totalMinutes < 15) {
        showToast(`Workout must be 15+ minutes for points (yours: ${mins}m ${secs}s)`, 'error');
        return;
    }

    pendingWorkoutShareType = 'story';

    // Open live camera (getUserMedia) instead of file input which opens gallery in WebView
    openWorkoutCamera((file) => {
        handleWorkoutPhotoCaptureFromFile(file);
    }, 'Take a workout photo');
}

// Share workout to group chat - uses the cached gym photo captured up front
function shareWorkoutToGroupChat() {
    // Check if already earned groupchat point this session
    if (workoutPointsEarnedThisSession.groupchat) {
        showToast('You already earned the group chat point for this workout!', 'info');
        return;
    }

    if (!validateWorkoutDurationForShare()) return;

    pendingWorkoutShareType = 'groupchat';

    // If the user already captured a photo via the new share UI, reuse it —
    // no need to open the camera a second time.
    if (cachedWorkoutShareFile) {
        handleWorkoutPhotoCaptureFromFile(cachedWorkoutShareFile);
        return;
    }

    // Fallback: open the camera (e.g. if this is invoked from an old entry
    // point that didn't pre-capture).
    openWorkoutCamera((file) => {
        if (!file) return;
        handleWorkoutPhotoCaptureFromFile(file);
    }, 'Take a workout photo');
}

// Handle the captured workout photo (from file input - legacy/web fallback)
async function handleWorkoutPhotoCapture(event) {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = '';
    handleWorkoutPhotoCaptureFromFile(file);
}

// Handle workout photo from a File object (used by both camera modal and file input)
async function handleWorkoutPhotoCaptureFromFile(file) {
    if (!file) return;

    const preparedFile = typeof window.normalizeFeedImageUploadFile === 'function'
        ? await window.normalizeFeedImageUploadFile(file)
        : file;
    const photoTimestamp = new Date().toISOString();

    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64Data = e.target.result;

        try {
            const photoHash = await window.db?.points?.generatePhotoHash(base64Data);

            if (pendingWorkoutShareType === 'story') {
                window.pendingStoryFile = preparedFile;
                window.pendingStoryBase64 = base64Data;
                window.pendingStoryType = 'image';
                window.pendingWorkoutPhotoData = {
                    timestamp: photoTimestamp,
                    hash: photoHash,
                    forPoints: true
                };

                // Open story modal
                const modal = document.getElementById('story-upload-modal');
                if (modal) modal.style.display = 'flex';

                // Set preview
                const previewImage = document.getElementById('story-preview-image');
                const previewVideo = document.getElementById('story-preview-video');
                const placeholder = document.getElementById('story-preview-placeholder');

                if (previewImage) {
                    previewImage.src = base64Data;
                    previewImage.style.display = 'block';
                }
                if (previewVideo) previewVideo.style.display = 'none';
                if (placeholder) placeholder.style.display = 'none';

                // Set caption
                const captionInput = document.getElementById('story-caption-input');
                if (captionInput) captionInput.value = 'Just finished my workout! 💪';

                // Enable upload button
                const uploadBtn = document.getElementById('story-upload-button');
                if (uploadBtn) {
                    uploadBtn.disabled = false;
                    uploadBtn.style.opacity = '1';
                }
            } else if (pendingWorkoutShareType === 'groupchat') {
                // Award point first, then go to group chat selection
                await awardWorkoutSharePoint('groupchat', photoTimestamp, photoHash);

                // Go to quick share modal for group chat selection
                openQuickShareModal();
            }
        } catch (error) {
            console.error('Error processing workout photo:', error);
            showToast('Failed to process photo. Please try again.', 'error');
        }
    };
    reader.readAsDataURL(preparedFile);
}

// Award point for workout share
async function awardWorkoutSharePoint(shareType, photoTimestamp, photoHash) {
    try {
        const session = await window.authHelpers?.getSession();
        if (!session?.user) return null;

        const workoutRefId = `workout_${shareType}_${Date.now()}`;
        const result = await window.db?.points?.awardPoints(
            window.currentUser.id,
            'workout',
            workoutRefId,
            { photoTimestamp, aiConfidence: 'high', photoHash }
        );

        if (result?.success) {
            // Mark as earned for this session
            if (shareType === 'story') {
                workoutPointsEarnedThisSession.story = true;
            } else {
                workoutPointsEarnedThisSession.groupchat = true;
            }

            // Tally earned XP and update the confirmation banner
            const earnedCount =
                (workoutPointsEarnedThisSession.story ? 1 : 0) +
                (workoutPointsEarnedThisSession.groupchat ? 1 : 0);
            const pointsAwarded = document.getElementById('workout-points-awarded');
            const pointsText = document.getElementById('workout-points-text');
            if (pointsAwarded) {
                pointsAwarded.style.display = 'block';
                if (pointsText) {
                    pointsText.textContent = `+${earnedCount} XP Earned!`;
                }
            }

            showToast(`+1 XP for sharing your workout${shareType === 'groupchat' ? ' to group chat' : ''}!`, 'success');

            // Refresh tamagotchi display to sync XP with database
            if (typeof window.refreshLevelDisplay === 'function') {
                window.refreshLevelDisplay();
            }

            // Trigger XP bar rainbow animation
            if (typeof window.triggerXPBarRainbow === 'function') {
                window.triggerXPBarRainbow();
            }

            return result;
        }
    } catch (error) {
        console.error('Error awarding workout share point:', error);
    }
    return null;
}

// Legacy function - kept for backward compatibility but now uses new flow
async function captureAndShareWorkout() {
    shareWorkoutToStory();
}

function pbbGetWorkoutShareDurationText() {
    const successDurationEl = document.getElementById('success-duration');
    const durationText = successDurationEl ? String(successDurationEl.textContent || '').trim() : '';
    return durationText || '00:00';
}

const PBB_SHARE_CREATIVE_VARIANT = 'earned_share_motion_v1';

const PBB_SHARE_OVERLAY_STYLES = [
    { id: 'classic', label: 'Clean' },
    { id: 'gold', label: 'Gold' },
    { id: 'midnight', label: 'Dark' },
    { id: 'fresh', label: 'Fresh' }
];
const PBB_SHARE_TEXT_STYLES = [
    { id: 'bold', label: 'Bold' },
    { id: 'scorecard', label: 'Scorecard' },
    { id: 'simple', label: 'Simple' },
    { id: 'full', label: 'All lifts', contexts: ['workout'] }
];
const pbbShareOverlaySelections = {
    workout: 'classic',
    pb: 'classic',
    activity: 'classic',
    nutrition: 'classic'
};
const pbbShareTextSelections = {
    workout: 'bold',
    pb: 'bold',
    activity: 'bold',
    nutrition: 'bold'
};
const pbbShareStylePreviewState = {};

function pbbShareNormalizeContext(context) {
    const safeContext = String(context || '').toLowerCase();
    return ['workout', 'pb', 'activity', 'nutrition'].includes(safeContext) ? safeContext : 'workout';
}

function getBalanceShareOverlayStyle(context) {
    const safeContext = pbbShareNormalizeContext(context);
    return pbbShareOverlaySelections[safeContext] || 'classic';
}

function pbbShareNormalizeOverlayStyle(style) {
    const safeStyle = String(style || '').toLowerCase();
    return PBB_SHARE_OVERLAY_STYLES.some(option => option.id === safeStyle) ? safeStyle : 'classic';
}

function pbbShareSupportsTextStyle(context) {
    const safeContext = pbbShareNormalizeContext(context);
    return ['workout', 'pb', 'activity', 'nutrition'].includes(safeContext);
}

function getBalanceShareTextStyle(context) {
    const safeContext = pbbShareNormalizeContext(context);
    return pbbShareTextSelections[safeContext] || 'bold';
}

function pbbShareNormalizeTextStyle(style) {
    const safeStyle = String(style || '').toLowerCase();
    return PBB_SHARE_TEXT_STYLES.some(option => option.id === safeStyle) ? safeStyle : 'bold';
}

function pbbShareTextStyleOptions(context) {
    const safeContext = pbbShareNormalizeContext(context);
    return PBB_SHARE_TEXT_STYLES.filter(option => !option.contexts || option.contexts.includes(safeContext));
}

function pbbShareApplyPhotoStyle(ctx, width, height, style, target) {
    const safeStyle = pbbShareNormalizeOverlayStyle(style);
    if (safeStyle === 'classic') return;

    ctx.save();
    if (safeStyle === 'gold') {
        const goldWash = ctx.createLinearGradient(0, 0, width, height);
        goldWash.addColorStop(0, 'rgba(245,196,92,0.08)');
        goldWash.addColorStop(0.58, 'rgba(120,53,15,0.02)');
        goldWash.addColorStop(1, 'rgba(245,158,11,0.24)');
        ctx.fillStyle = goldWash;
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = 'rgba(253,230,138,0.88)';
        ctx.lineWidth = target === 'feed' ? 18 : 22;
        ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, width - ctx.lineWidth, height - ctx.lineWidth);
    } else if (safeStyle === 'midnight') {
        const midnightWash = ctx.createLinearGradient(0, 0, 0, height);
        midnightWash.addColorStop(0, 'rgba(2,6,23,0.18)');
        midnightWash.addColorStop(0.55, 'rgba(2,6,23,0.10)');
        midnightWash.addColorStop(1, 'rgba(2,6,23,0.42)');
        ctx.fillStyle = midnightWash;
        ctx.fillRect(0, 0, width, height);
    } else if (safeStyle === 'fresh') {
        const freshWash = ctx.createLinearGradient(0, height * 0.12, width, height);
        freshWash.addColorStop(0, 'rgba(20,184,166,0.08)');
        freshWash.addColorStop(0.55, 'rgba(255,255,255,0)');
        freshWash.addColorStop(1, 'rgba(16,185,129,0.22)');
        ctx.fillStyle = freshWash;
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = 'rgba(167,243,208,0.72)';
        ctx.lineWidth = target === 'feed' ? 12 : 16;
        ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, width - ctx.lineWidth, height - ctx.lineWidth);
    }
    ctx.restore();
}

function buildWorkoutShareCardPayload() {
    if (!completedWorkoutDataForShare) return null;

    const data = completedWorkoutDataForShare;
    const workoutPBs = Array.isArray(data.newPBs) ? data.newPBs : [];
    const normaliseExerciseName = value => String(value || '').trim().toLowerCase();
    const exerciseMap = {};
    (data.sets || []).forEach(set => {
        const name = set.exercise || set.exercise_name || 'Exercise';
        if (!exerciseMap[name]) {
            exerciseMap[name] = { name, sets: 0, bestKg: 0, bestReps: 0, setDetails: [] };
        }
        exerciseMap[name].sets++;
        const kg = parseFloat(set.kg != null ? set.kg : set.weight_kg) || 0;
        const reps = parseInt(set.reps) || 0;
        const seconds = parseInt(set.duration_seconds != null ? set.duration_seconds : set.seconds) || 0;
        const matchingPB = workoutPBs.find(pb => {
            if (normaliseExerciseName(pb.exercise || pb.exercise_name) !== normaliseExerciseName(name)) return false;
            const pbType = String(pb.pb_type || pb.type || 'weight').toLowerCase();
            if (pbType === 'reps') {
                return Number(pb.value || pb.new_value || 0) === reps
                    && (!Number(pb.weight || pb.new_weight_kg || 0) || Number(pb.weight || pb.new_weight_kg || 0) === kg);
            }
            return Number(pb.value || pb.new_value || 0) === kg
                && (!Number(pb.reps || pb.new_reps || 0) || Number(pb.reps || pb.new_reps || 0) === reps);
        });
        const value = kg > 0
            ? `${pbbPointsFormatWeightFromKg(kg)} x ${reps}`
            : (reps > 0 ? `${reps} reps` : (seconds > 0 ? `${seconds} sec` : 'Completed'));
        exerciseMap[name].setDetails.push({
            set: Number(set.set || set.set_number || exerciseMap[name].sets),
            weight_kg: kg,
            reps: reps,
            seconds: seconds,
            value: value,
            is_pb: !!matchingPB
        });
        if (kg > exerciseMap[name].bestKg) {
            exerciseMap[name].bestKg = kg;
            exerciseMap[name].bestReps = reps;
        } else if (kg === exerciseMap[name].bestKg && reps > exerciseMap[name].bestReps) {
            exerciseMap[name].bestReps = reps;
        }
    });

    const exercises = Object.values(exerciseMap).map(ex => ({
        name: ex.name,
        sets: ex.sets,
        best: ex.bestKg > 0 ? `${ex.sets}x${ex.bestReps} @ ${pbbPointsFormatWeightFromKg(ex.bestKg)}` : (ex.bestReps > 0 ? `${ex.sets}x${ex.bestReps}` : `${ex.sets} sets`),
        set_details: ex.setDetails,
        has_pb: ex.setDetails.some(set => set.is_pb)
    }));

    let totalVolume = 0;
    (data.sets || []).forEach(set => {
        const kg = parseFloat(set.kg != null ? set.kg : set.weight_kg) || 0;
        const reps = parseInt(set.reps) || 0;
        totalVolume += kg * reps;
    });

    const pbs = workoutPBs.map(pb => ({
        exercise: pb.exercise,
        type: pb.type,
        value: pb.value,
        reps: pb.reps,
        weight: pb.weight,
        improvement: pb.improvement
    }));

    return {
        card_type: 'workout',
        share_variant: PBB_SHARE_CREATIVE_VARIANT,
        share_overlay_style: getBalanceShareOverlayStyle('workout'),
        share_text_style: getBalanceShareTextStyle('workout'),
        workout_name: data.workoutName || 'Workout',
        duration: data.duration || pbbGetWorkoutShareDurationText(),
        exercises: exercises,
        total_sets: data.sets ? data.sets.length : 0,
        total_volume: totalVolume > 0 ? pbbPointsFormatVolumeFromKg(totalVolume) : null,
        pbs: pbs.length > 0 ? pbs : null
    };
}

function buildPBShareCardPayload(pbData) {
    if (!pbData) return null;
    const pbType = String(pbData.pb_type || pbData.type || 'weight').toLowerCase() === 'reps' ? 'reps' : 'weight';
    const value = pbData.new_value != null ? pbData.new_value : pbData.value;
    const improvement = pbData.improvement != null ? pbData.improvement : null;
    const previous = pbData.previous_value != null
        ? pbData.previous_value
        : (pbData.previousValue != null
            ? pbData.previousValue
            : (pbData.previous != null ? pbData.previous : (improvement ? value - improvement : null)));
    return {
        card_type: 'pb',
        share_variant: PBB_SHARE_CREATIVE_VARIANT,
        share_overlay_style: getBalanceShareOverlayStyle('pb'),
        share_text_style: getBalanceShareTextStyle('pb'),
        pb_history_id: pbData.pbHistoryId || pbData.historyId || pbData.id || null,
        exercise: pbData.exercise_name || pbData.exercise || 'Personal best',
        pb_type: pbType,
        value: value,
        reps: pbData.new_reps != null ? pbData.new_reps : pbData.reps,
        weight: pbData.new_weight_kg != null ? pbData.new_weight_kg : pbData.weight,
        improvement: improvement,
        previous: previous
    };
}

function pbbFormatPBShareValue(pbData) {
    if (!pbData) return '';
    if (pbData.pb_type === 'weight' || pbData.type === 'weight') {
        const reps = pbData.reps ? ` x ${pbData.reps}` : '';
        return `${pbbPointsFormatWeightFromKg(pbData.value)}${reps}`;
    }
    const weight = pbData.weight ? ` @ ${pbbPointsFormatWeightFromKg(pbData.weight)}` : '';
    return `${pbData.value || 0} reps${weight}`;
}

function pbbShareRoundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function pbbShareFillRoundRect(ctx, x, y, w, h, r, fillStyle) {
    pbbShareRoundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = fillStyle;
    ctx.fill();
}

function pbbShareDrawCoverImage(ctx, img, x, y, w, h) {
    const scale = Math.max(w / img.width, h / img.height);
    const sw = w / scale;
    const sh = h / scale;
    const sx = (img.width - sw) / 2;
    const sy = (img.height - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function pbbShareLoadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        if (/^https?:/i.test(String(src || ''))) {
            img.crossOrigin = 'anonymous';
            img.referrerPolicy = 'no-referrer';
        }
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

function pbbShareImageUrlToDataUrl(url) {
    if (!url) return Promise.resolve('');
    if (/^data:image\//i.test(String(url))) return Promise.resolve(url);
    return fetch(url, { mode: 'cors', credentials: 'omit' })
        .then(response => {
            if (!response.ok) throw new Error('Image fetch failed');
            return response.blob();
        })
        .then(blob => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        }));
}

function pbbShareFormatNumber(value, suffix) {
    const number = Number(value || 0);
    const rounded = Number.isFinite(number) ? Math.round(number) : 0;
    return rounded.toLocaleString() + (suffix || '');
}

function pbbShareDrawMetricBox(ctx, x, y, w, h, label, value, fill) {
    pbbShareFillRoundRect(ctx, x, y, w, h, 26, fill || '#f8fafc');
    ctx.fillStyle = '#475569';
    ctx.font = '800 22px Arial, sans-serif';
    pbbShareWrapText(ctx, label, x + 24, y + 42, w - 48, 26, 1);
    ctx.fillStyle = '#111827';
    ctx.font = '900 34px Arial, sans-serif';
    pbbShareWrapText(ctx, value, x + 24, y + 90, w - 48, 36, 1);
}

function pbbShareDrawNutritionCard(ctx, cardPayload, panelX, panelY, panelW, panelH) {
    let y = panelY + 154;
    ctx.fillStyle = '#111827';
    ctx.font = '900 72px Arial, sans-serif';
    ctx.fillText(String(Math.round(Number(cardPayload.score || 0))), panelX + 56, y);
    ctx.font = '900 32px Arial, sans-serif';
    ctx.fillStyle = '#0f766e';
    ctx.fillText('Nutrition score', panelX + 178, y - 12);
    ctx.font = '750 25px Arial, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText((cardPayload.meal_count || 0) + ' meals logged today', panelX + 178, y + 26);
    y += 80;

    const metricW = (panelW - 136) / 3;
    const calorieText = pbbShareFormatNumber(cardPayload.calories) + '/' + pbbShareFormatNumber(cardPayload.calorie_goal);
    const metrics = [
        ['Calories', calorieText, '#fef3c7'],
        ['Protein', pbbShareFormatNumber(cardPayload.protein, 'g') + '/' + pbbShareFormatNumber(cardPayload.protein_goal, 'g'), '#dcfce7'],
        ['Streak', pbbShareFormatNumber(cardPayload.streak), '#eef2ff']
    ];
    metrics.forEach((metric, index) => {
        const x = panelX + 56 + (index * (metricW + 12));
        pbbShareDrawMetricBox(ctx, x, y, metricW, 138, metric[0], metric[1], metric[2]);
    });
    y += 198;

    const macroRows = [
        ['Protein', cardPayload.protein, cardPayload.protein_goal, '#16a34a'],
        ['Carbs', cardPayload.carbs, cardPayload.carbs_goal, '#2563eb'],
        ['Fat', cardPayload.fat, cardPayload.fat_goal, '#f97316']
    ];
    macroRows.forEach(row => {
        const current = Math.max(0, Number(row[1] || 0));
        const goal = Math.max(1, Number(row[2] || 0));
        const pct = Math.min(1, current / goal);
        ctx.fillStyle = '#334155';
        ctx.font = '900 28px Arial, sans-serif';
        ctx.fillText(row[0], panelX + 56, y);
        ctx.fillStyle = '#64748b';
        ctx.font = '800 24px Arial, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(pbbShareFormatNumber(current, 'g') + ' / ' + pbbShareFormatNumber(goal, 'g'), panelX + panelW - 56, y);
        ctx.textAlign = 'left';
        pbbShareFillRoundRect(ctx, panelX + 56, y + 24, panelW - 112, 30, 15, '#e2e8f0');
        pbbShareFillRoundRect(ctx, panelX + 56, y + 24, (panelW - 112) * pct, 30, 15, row[3]);
        y += 96;
    });

    pbbShareFillRoundRect(ctx, panelX + 56, panelY + panelH - 150, panelW - 112, 94, 26, '#ecfeff');
    ctx.fillStyle = '#155e75';
    ctx.font = '900 30px Arial, sans-serif';
    ctx.fillText('Fuelled and tracked in Balance', panelX + 92, panelY + panelH - 92);
}

async function pbbShareDrawMealCard(ctx, cardPayload, panelX, panelY, panelW, panelH, photoDataUrl) {
    let y = panelY + 150;
    if (photoDataUrl) {
        try {
            const mealPhoto = await pbbShareLoadImage(photoDataUrl);
            pbbShareFillRoundRect(ctx, panelX + 56, y, panelW - 112, 360, 32, '#f1f5f9');
            ctx.save();
            pbbShareRoundRect(ctx, panelX + 56, y, panelW - 112, 360, 32);
            ctx.clip();
            pbbShareDrawCoverImage(ctx, mealPhoto, panelX + 56, y, panelW - 112, 360);
            ctx.restore();
            y += 412;
        } catch (e) {
            console.warn('Could not draw meal photo:', e);
        }
    }

    ctx.fillStyle = '#111827';
    ctx.font = '900 58px Arial, sans-serif';
    y = pbbShareWrapText(ctx, cardPayload.foods || cardPayload.meal_type || 'Meal logged', panelX + 56, y, panelW - 112, 64, 2) + 28;

    const metricW = (panelW - 148) / 4;
    const metrics = [
        ['Calories', pbbShareFormatNumber(cardPayload.calories), '#fef3c7'],
        ['Protein', pbbShareFormatNumber(cardPayload.protein, 'g'), '#dcfce7'],
        ['Carbs', pbbShareFormatNumber(cardPayload.carbs, 'g'), '#eef2ff'],
        ['Fat', pbbShareFormatNumber(cardPayload.fat, 'g'), '#fdf2f8']
    ];
    metrics.forEach((metric, index) => {
        const x = panelX + 56 + (index * (metricW + 12));
        pbbShareDrawMetricBox(ctx, x, y, metricW, 128, metric[0], metric[1], metric[2]);
    });
    y += 180;

    const ingredients = Array.isArray(cardPayload.ingredients) ? cardPayload.ingredients.slice(0, 4) : [];
    if (ingredients.length) {
        ctx.fillStyle = '#0f3d2e';
        ctx.font = '900 30px Arial, sans-serif';
        ctx.fillText('What was in it', panelX + 56, y);
        y += 42;
        ingredients.forEach(item => {
            const portion = item.portion ? ' (' + item.portion + ')' : '';
            pbbShareFillRoundRect(ctx, panelX + 56, y, panelW - 112, 62, 18, 'rgba(15, 118, 110, 0.08)');
            ctx.fillStyle = '#111827';
            ctx.font = '800 25px Arial, sans-serif';
            pbbShareWrapText(ctx, (item.name || 'Food') + portion, panelX + 82, y + 39, panelW - 164, 28, 1);
            y += 74;
        });
    }
}

function pbbShareSetFittedFont(ctx, text, maxWidth, startSize, minimumSize, family = 'Arial, sans-serif') {
    let size = startSize;
    do {
        ctx.font = `900 ${size}px ${family}`;
        if (ctx.measureText(String(text || '')).width <= maxWidth) break;
        size -= 4;
    } while (size > minimumSize);
    size = Math.max(size, minimumSize);
    ctx.font = `900 ${size}px ${family}`;
    return size;
}

function pbbShareWorkoutMetrics(cardPayload) {
    if (cardPayload && cardPayload.studio_hide_stats) return [];
    return [
        ['DURATION', cardPayload.duration || '00:00'],
        ['SETS', String(cardPayload.total_sets || 0)],
        ['VOLUME', cardPayload.total_volume || '-']
    ];
}

function pbbSharePBImprovementText(cardPayload) {
    if (!cardPayload.improvement) return '';
    return cardPayload.pb_type === 'weight'
        ? '+' + pbbPointsFormatWeightFromKg(cardPayload.improvement)
        : '+' + cardPayload.improvement + ' REPS';
}

function pbbShareDrawLargeMetricColumns(ctx, metrics, x, y, width, options = {}) {
    const metricW = width / metrics.length;
    const valueSize = Number(options.valueSize || 48);
    const labelSize = Number(options.labelSize || 22);
    metrics.forEach((metric, index) => {
        const metricX = x + (index * metricW);
        if (index > 0) {
            ctx.save();
            ctx.shadowColor = 'transparent';
            ctx.fillStyle = 'rgba(255,255,255,0.56)';
            ctx.fillRect(metricX - 22, y - valueSize + 4, 2, valueSize + labelSize + 28);
            ctx.restore();
        }
        ctx.fillStyle = '#ffffff';
        pbbShareSetFittedFont(ctx, metric[1], metricW - 34, valueSize, Math.max(30, valueSize - 14));
        ctx.fillText(metric[1], metricX, y);
        ctx.fillStyle = 'rgba(255,255,255,0.84)';
        ctx.font = `900 ${labelSize}px Arial, sans-serif`;
        ctx.fillText(metric[0], metricX, y + labelSize + 18);
    });
}

function pbbShareDrawFeaturedSets(ctx, cardPayload, x, y, width, limit) {
    const exercises = (cardPayload.exercises || []).slice(0, limit);
    if (!exercises.length) return y;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '900 24px Arial, sans-serif';
    ctx.fillText(limit === 1 ? 'TOP SET' : 'TOP SETS', x, y);
    y += 42;
    exercises.forEach(exercise => {
        const exerciseName = String(exercise.name || 'Exercise');
        const exerciseBest = String(exercise.best || '');
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 29px Arial, sans-serif';
        const nameBottom = pbbShareWrapText(ctx, exerciseName, x, y, width - 280, 34, 1);
        ctx.textAlign = 'right';
        ctx.font = '900 27px Arial, sans-serif';
        pbbShareSetFittedFont(ctx, exerciseBest, 250, 27, 22);
        ctx.fillText(exerciseBest, x + width, y);
        ctx.textAlign = 'left';
        y = Math.max(nameBottom, y + 34) + 18;
    });
    return y;
}

function pbbShareCompactSetDetails(exercise) {
    const details = Array.isArray(exercise && exercise.set_details) ? exercise.set_details : [];
    const groups = [];
    details.forEach(detail => {
        const value = String(detail.value || 'Completed');
        const isPB = !!detail.is_pb;
        const previous = groups[groups.length - 1];
        if (previous && previous.value === value && previous.isPB === isPB) {
            previous.count += 1;
        } else {
            groups.push({ value, isPB, count: 1 });
        }
    });
    return groups.map(group => {
        const value = group.count > 1 ? `${group.count} x (${group.value})` : group.value;
        return group.isPB ? `${value}  PB` : value;
    }).join('  |  ') || String(exercise && exercise.best || `${exercise && exercise.sets || 0} sets`);
}

function pbbShareDrawCompleteWorkout(ctx, cardPayload, width, contentBottom, brandTop, target) {
    const exercises = Array.isArray(cardPayload.exercises) ? cardPayload.exercises : [];
    const contentX = 64;
    const contentW = width - (contentX * 2);
    const pbCount = Array.isArray(cardPayload.pbs) ? cardPayload.pbs.length : 0;
    const isFeed = target === 'feed';
    const columnCount = exercises.length > 8 ? 2 : 1;
    const rowsPerColumn = Math.max(1, Math.ceil(exercises.length / columnCount));
    const columnGap = 14;
    const columnW = (contentW - (columnGap * (columnCount - 1))) / columnCount;
    const headerH = isFeed ? 72 : 84;
    const metricH = isFeed ? 90 : 104;
    const cardGap = isFeed ? 8 : 11;
    const desiredCardH = isFeed ? 76 : 92;
    const minimumStackTop = brandTop + (isFeed ? 190 : 350);
    const fixedH = headerH + metricH + 24;
    const availableCardH = Math.max(56, (contentBottom - minimumStackTop - fixedH - (cardGap * rowsPerColumn)) / rowsPerColumn);
    const cardH = Math.min(desiredCardH, availableCardH);
    const stackH = fixedH + (rowsPerColumn * (cardH + cardGap));
    let y = contentBottom - stackH;

    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${isFeed ? 30 : 36}px Arial, sans-serif`;
    ctx.fillText('COMPLETE WORKOUT', contentX, y + (isFeed ? 30 : 36));
    if (pbCount > 0) {
        ctx.fillStyle = '#f5c45c';
        ctx.font = `900 ${isFeed ? 17 : 20}px Arial, sans-serif`;
        ctx.fillText(`${pbCount} PB${pbCount === 1 ? '' : 'S'}`, contentX, y + (isFeed ? 56 : 66));
    }
    y += headerH;

    pbbShareFillRoundRect(ctx, contentX, y, contentW, metricH, 18, 'rgba(2, 6, 23, 0.62)');
    ctx.save();
    ctx.shadowColor = 'transparent';
    pbbShareRoundRect(ctx, contentX, y, contentW, metricH, 18);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    const metrics = pbbShareWorkoutMetrics(cardPayload);
    const metricW = contentW / metrics.length;
    metrics.forEach((metric, index) => {
        const metricCenter = contentX + (metricW * index) + (metricW / 2);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        pbbShareSetFittedFont(ctx, metric[1], metricW - 30, isFeed ? 25 : 30, 19);
        ctx.fillText(metric[1], metricCenter, y + (isFeed ? 38 : 44));
        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        ctx.font = `800 ${isFeed ? 13 : 15}px Arial, sans-serif`;
        ctx.fillText(metric[0], metricCenter, y + (isFeed ? 65 : 76));
    });
    ctx.textAlign = 'left';
    y += metricH + 14;

    const nameSize = Math.max(15, Math.min(columnCount === 1 ? 24 : 20, cardH * 0.28));
    const detailSize = Math.max(12, Math.min(columnCount === 1 ? 18 : 15, cardH * 0.22));

    exercises.forEach((exercise, index) => {
        const column = Math.floor(index / rowsPerColumn);
        const row = index % rowsPerColumn;
        const x = contentX + (column * (columnW + columnGap));
        const rowY = y + (row * (cardH + cardGap));
        const hasPB = !!exercise.has_pb;
        const name = String(exercise.name || 'Exercise');
        const details = pbbShareCompactSetDetails(exercise);

        pbbShareFillRoundRect(ctx, x, rowY, columnW, cardH, 16, 'rgba(2, 6, 23, 0.68)');
        ctx.save();
        ctx.shadowColor = 'transparent';
        pbbShareRoundRect(ctx, x, rowY, columnW, cardH, 16);
        ctx.strokeStyle = hasPB ? 'rgba(245,196,92,0.46)' : 'rgba(255,255,255,0.13)';
        ctx.lineWidth = 2;
        ctx.stroke();
        if (hasPB) {
            pbbShareRoundRect(ctx, x, rowY, 7, cardH, 4);
            ctx.fillStyle = '#f5c45c';
            ctx.fill();
        }
        ctx.restore();

        const textX = x + (hasPB ? 28 : 22);
        const textW = columnW - (hasPB ? 48 : 44);
        ctx.fillStyle = '#ffffff';
        pbbShareSetFittedFont(ctx, name, textW, nameSize, Math.max(13, nameSize - 7));
        ctx.fillText(name, textX, rowY + Math.max(24, cardH * 0.38));
        ctx.fillStyle = hasPB ? '#fde68a' : 'rgba(255,255,255,0.82)';
        pbbShareSetFittedFont(ctx, details, textW, detailSize, 11);
        ctx.fillText(details, textX, rowY + Math.max(45, cardH * 0.73));
    });
}

async function pbbShareDrawFullBleedWorkoutCard(ctx, cardPayload, width, height, target) {
    const cardType = cardPayload.card_type === 'pb' ? 'pb' : 'workout';
    const textStyle = pbbShareNormalizeTextStyle(cardPayload.share_text_style);
    const contentX = 64;
    const contentW = width - (contentX * 2);
    // Keep every important word and number clear of Instagram's reply and navigation controls.
    const contentBottom = target === 'feed' ? height - 72 : height - 132;

    const fadeStart = textStyle === 'full' ? (target === 'feed' ? 0.08 : 0.22) : (textStyle === 'simple' ? 0.60 : 0.46);
    const lowerGradient = ctx.createLinearGradient(0, height * fadeStart, 0, height);
    lowerGradient.addColorStop(0, 'rgba(2, 6, 23, 0)');
    lowerGradient.addColorStop(0.58, textStyle === 'simple' ? 'rgba(2, 6, 23, 0.12)' : 'rgba(2, 6, 23, 0.24)');
    lowerGradient.addColorStop(1, textStyle === 'simple' ? 'rgba(2, 6, 23, 0.62)' : 'rgba(2, 6, 23, 0.80)');
    ctx.fillStyle = lowerGradient;
    ctx.fillRect(0, 0, width, height);

    const brandTop = target === 'feed' ? 48 : 228;
    try {
        const logo = await pbbShareLoadImage('balance_logo_transparent.png');
        ctx.save();
        ctx.globalAlpha = 0.94;
        ctx.drawImage(logo, 64, brandTop, 82, 82);
        ctx.restore();
    } catch (error) {
        console.warn('Could not draw transparent Balance logo:', error);
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 34px Arial, sans-serif';
    ctx.fillText('BALANCE', 164, brandTop + 46);
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.font = '750 21px Arial, sans-serif';
    ctx.fillText('SHOW UP. KEEP THE RECEIPTS.', 164, brandTop + 78);

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.88)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 5;

    const title = cardType === 'pb'
        ? (cardPayload.exercise || 'Personal best')
        : (cardPayload.workout_name || 'Workout');

    if (textStyle === 'full' && cardType === 'workout') {
        pbbShareDrawCompleteWorkout(ctx, cardPayload, width, contentBottom, brandTop, target);
        ctx.restore();
        return;
    }

    if (textStyle === 'scorecard') {
        const panelHeight = cardType === 'pb'
            ? (target === 'feed' ? 470 : 520)
            : (target === 'feed' ? 600 : 670);
        const panelX = 40;
        const panelY = contentBottom - panelHeight + 24;
        const panelW = width - 80;
        pbbShareFillRoundRect(ctx, panelX, panelY, panelW, panelHeight, 38, 'rgba(2, 6, 23, 0.76)');
        ctx.save();
        ctx.shadowColor = 'transparent';
        pbbShareRoundRect(ctx, panelX, panelY, panelW, panelHeight, 38);
        ctx.strokeStyle = 'rgba(245,196,92,0.86)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();

        let y = panelY + 62;
        ctx.fillStyle = '#f5c45c';
        ctx.font = '900 27px Arial, sans-serif';
        ctx.fillText(cardType === 'pb' ? 'NEW PERSONAL BEST' : 'WORKOUT COMPLETE', contentX, y);
        y += cardType === 'pb' ? 68 : 108;

        if (cardType === 'pb') {
            ctx.fillStyle = '#ffffff';
            const result = pbbFormatPBShareValue(cardPayload);
            pbbShareSetFittedFont(ctx, result, contentW, 104, 72);
            ctx.fillText(result, contentX, y + 72);
            y += 132;
            pbbShareSetFittedFont(ctx, title.toUpperCase(), contentW, 66, 46);
            ctx.fillText(title.toUpperCase(), contentX, y);
            const improvementText = pbbSharePBImprovementText(cardPayload);
            if (improvementText) {
                const badgeW = Math.min(300, ctx.measureText(improvementText).width + 64);
                pbbShareFillRoundRect(ctx, contentX, y + 38, badgeW, 68, 18, '#f5c45c');
                ctx.fillStyle = '#111827';
                ctx.font = '900 32px Arial, sans-serif';
                ctx.fillText(improvementText, contentX + 30, y + 83);
            }
        } else {
            ctx.fillStyle = '#ffffff';
            pbbShareSetFittedFont(ctx, title.toUpperCase(), contentW, 86, 58);
            ctx.fillText(title.toUpperCase(), contentX, y);
            y += 54;
            ctx.save();
            ctx.shadowColor = 'transparent';
            ctx.fillStyle = 'rgba(245,196,92,0.84)';
            ctx.fillRect(contentX, y, contentW, 3);
            ctx.restore();
            y += 84;
            pbbShareDrawLargeMetricColumns(ctx, pbbShareWorkoutMetrics(cardPayload), contentX, y, contentW, {
                valueSize: 50,
                labelSize: 22
            });
            y += 104;
            pbbShareDrawFeaturedSets(ctx, cardPayload, contentX, y, contentW, 1);
        }
    } else if (textStyle === 'simple') {
        let y = cardType === 'pb' ? contentBottom - 300 : contentBottom - 360;
        ctx.fillStyle = '#f5c45c';
        ctx.font = '900 27px Arial, sans-serif';
        ctx.fillText(cardType === 'pb' ? 'NEW PERSONAL BEST' : 'WORKOUT COMPLETE', contentX, y);
        y += cardType === 'pb' ? 64 : 114;
        if (cardType === 'pb') {
            ctx.fillStyle = '#ffffff';
            const result = pbbFormatPBShareValue(cardPayload);
            pbbShareSetFittedFont(ctx, result, contentW, 116, 78);
            ctx.fillText(result, contentX, y + 78);
            y += 142;
            pbbShareSetFittedFont(ctx, title.toUpperCase(), contentW, 58, 42);
            ctx.fillText(title.toUpperCase(), contentX, y);
        } else {
            ctx.fillStyle = '#ffffff';
            pbbShareSetFittedFont(ctx, title.toUpperCase(), contentW, 92, 58);
            ctx.fillText(title.toUpperCase(), contentX, y);
            y += 82;
            pbbShareDrawLargeMetricColumns(ctx, pbbShareWorkoutMetrics(cardPayload), contentX, y, contentW, {
                valueSize: 40,
                labelSize: 19
            });
        }
    } else if (cardType === 'pb') {
        let y = contentBottom - 470;
        ctx.fillStyle = '#f5c45c';
        ctx.font = '900 29px Arial, sans-serif';
        ctx.fillText('NEW PERSONAL BEST', contentX, y);
        y += 48;
        const result = pbbFormatPBShareValue(cardPayload);
        ctx.fillStyle = '#ffffff';
        pbbShareSetFittedFont(ctx, result, contentW, 156, 104);
        ctx.fillText(result, contentX, y + 116);
        y += 180;
        pbbShareSetFittedFont(ctx, title.toUpperCase(), contentW, 72, 48);
        ctx.fillText(title.toUpperCase(), contentX, y);
        const improvementText = pbbSharePBImprovementText(cardPayload);
        if (improvementText) {
            const badgeW = Math.min(310, ctx.measureText(improvementText).width + 68);
            pbbShareFillRoundRect(ctx, contentX, y + 38, badgeW, 72, 18, '#f5c45c');
            ctx.fillStyle = '#111827';
            ctx.font = '900 34px Arial, sans-serif';
            ctx.fillText(improvementText, contentX + 32, y + 86);
            ctx.fillStyle = '#f5c45c';
            ctx.font = '900 25px Arial, sans-serif';
            ctx.fillText('LOGGED IN BALANCE', contentX + badgeW + 28, y + 84);
        }
    } else {
        let y = contentBottom - 642;
        ctx.fillStyle = 'rgba(255,255,255,0.96)';
        ctx.font = '900 28px Arial, sans-serif';
        ctx.fillText('WORKOUT COMPLETE', contentX, y);
        y += 132;
        ctx.fillStyle = '#ffffff';
        pbbShareSetFittedFont(ctx, title.toUpperCase(), contentW, 116, 72);
        y = pbbShareWrapText(ctx, title.toUpperCase(), contentX, y, contentW, 116, 2) + 26;
        ctx.save();
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#f5c45c';
        ctx.fillRect(contentX, y, contentW, 4);
        ctx.restore();
        y += 82;
        pbbShareDrawLargeMetricColumns(ctx, pbbShareWorkoutMetrics(cardPayload), contentX, y, contentW, {
            valueSize: 52,
            labelSize: 22
        });
        y += 112;
        pbbShareDrawFeaturedSets(ctx, cardPayload, contentX, y, contentW, 2);
    }

    ctx.restore();
}

async function pbbShareDrawBalanceBrandMark(ctx, x, y, size = 38) {
    try {
        const logo = await pbbShareLoadImage('balance_logo_transparent.png');
        ctx.save();
        ctx.globalAlpha = 0.92;
        ctx.drawImage(logo, x, y, size, size);
        ctx.restore();
    } catch (error) {
        console.warn('Could not draw Balance share mark:', error);
    }
}

function pbbShareDecodeRoutePolyline(polyline) {
    const encoded = String(polyline || '');
    const points = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
        let result = 0;
        let shift = 0;
        let byte;
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20 && index <= encoded.length);
        lat += (result & 1) ? ~(result >> 1) : (result >> 1);

        result = 0;
        shift = 0;
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20 && index <= encoded.length);
        lng += (result & 1) ? ~(result >> 1) : (result >> 1);

        const point = { lat: lat / 1e5, lng: lng / 1e5 };
        if (Number.isFinite(point.lat) && Number.isFinite(point.lng)) points.push(point);
    }
    return points;
}

function pbbShareDrawActivityRoute(ctx, cardPayload, x, y, w, h) {
    const points = pbbShareDecodeRoutePolyline(cardPayload.route_polyline);
    if (points.length < 2) return false;

    const lats = points.map(point => point.lat);
    const lngs = points.map(point => point.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const centreLat = (minLat + maxLat) / 2;
    const centreLng = (minLng + maxLng) / 2;
    const lngScale = Math.max(Math.cos(centreLat * Math.PI / 180), 0.01);
    const dataW = Math.max((maxLng - minLng) * lngScale, 0.00001);
    const dataH = Math.max(maxLat - minLat, 0.00001);
    const pad = 40;
    const scale = Math.min((w - (pad * 2)) / dataW, (h - (pad * 2)) / dataH);
    const project = (point) => ({
        x: x + (w / 2) + ((point.lng - centreLng) * lngScale * scale),
        y: y + (h / 2) - ((point.lat - centreLat) * scale)
    });

    pbbShareFillRoundRect(ctx, x, y, w, h, 26, 'rgba(2, 23, 36, 0.56)');
    ctx.save();
    pbbShareRoundRect(ctx, x, y, w, h, 26);
    ctx.clip();
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.16)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
        const gridX = x + (w * i / 5);
        const gridY = y + (h * i / 5);
        ctx.beginPath();
        ctx.moveTo(gridX, y);
        ctx.lineTo(gridX, y + h);
        ctx.moveTo(x, gridY);
        ctx.lineTo(x + w, gridY);
        ctx.stroke();
    }

    const first = project(points[0]);
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    points.slice(1).forEach(point => {
        const projected = project(point);
        ctx.lineTo(projected.x, projected.y);
    });
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.lineWidth = 15;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.strokeStyle = '#f8c255';
    ctx.lineWidth = 8;
    ctx.stroke();

    const last = project(points[points.length - 1]);
    [[first, '#22c55e'], [last, '#f97316']].forEach(([point, colour]) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 12, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(point.x, point.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = colour;
        ctx.fill();
    });
    ctx.restore();

    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = '900 18px Arial, sans-serif';
    ctx.fillText('ROUTE', x + 20, y + 30);
    const distance = Number(cardPayload.distance_km || 0);
    if (distance > 0) {
        ctx.textAlign = 'right';
        ctx.fillText(`${distance.toFixed(distance < 10 ? 1 : 0)} KM`, x + w - 20, y + 30);
        ctx.textAlign = 'left';
    }
    return true;
}

async function pbbShareDrawFullBleedActivityCard(ctx, cardPayload, width, height, target) {
    const textStyle = pbbShareNormalizeTextStyle(cardPayload.share_text_style);
    const contentBottom = target === 'feed' ? height - 72 : height - 132;
    const brandTop = target === 'feed' ? 48 : 228;
    const x = 64;
    const w = width - (x * 2);
    const label = String(cardPayload.activity_label || 'Activity');
    const metrics = [
        ['DURATION', String(cardPayload.duration || '-')],
        ['KCAL', String(cardPayload.calories || '-')],
        ['INTENSITY', String(cardPayload.intensity || 'moderate').toUpperCase()]
    ];

    const fadeStart = textStyle === 'simple' ? 0.60 : 0.45;
    const gradient = ctx.createLinearGradient(0, height * fadeStart, 0, height);
    gradient.addColorStop(0, 'rgba(3, 7, 18, 0)');
    gradient.addColorStop(0.56, textStyle === 'simple' ? 'rgba(3, 7, 18, 0.12)' : 'rgba(3, 7, 18, 0.24)');
    gradient.addColorStop(1, textStyle === 'simple' ? 'rgba(3, 7, 18, 0.64)' : 'rgba(3, 7, 18, 0.82)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    await pbbShareDrawBalanceBrandMark(ctx, x, brandTop, 72);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 32px Arial, sans-serif';
    ctx.fillText('BALANCE', x + 92, brandTop + 38);
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.font = '750 20px Arial, sans-serif';
    ctx.fillText('MOVE. TRACK. FEEL GOOD.', x + 92, brandTop + 68);

    if (cardPayload.route_polyline) {
        const routeY = brandTop + 128;
        const routeH = target === 'feed' ? 280 : 360;
        pbbShareDrawActivityRoute(ctx, cardPayload, x, routeY, w, routeH);
    }

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.72)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 5;

    if (textStyle === 'scorecard') {
        const panelH = target === 'feed' ? 500 : 560;
        const panelY = contentBottom - panelH + 24;
        pbbShareFillRoundRect(ctx, 40, panelY, width - 80, panelH, 38, 'rgba(2, 6, 23, 0.76)');
        ctx.save();
        ctx.shadowColor = 'transparent';
        pbbShareRoundRect(ctx, 40, panelY, width - 80, panelH, 38);
        ctx.strokeStyle = 'rgba(245,196,92,0.86)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();

        let y = panelY + 62;
        ctx.fillStyle = '#f5c45c';
        ctx.font = '900 27px Arial, sans-serif';
        ctx.fillText('ACTIVITY COMPLETE', x, y);
        y += 74;
        ctx.fillStyle = '#ffffff';
        pbbShareSetFittedFont(ctx, label.toUpperCase(), w, 84, 56);
        ctx.fillText(label.toUpperCase(), x, y);
        y += 52;
        ctx.save();
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = 'rgba(245,196,92,0.84)';
        ctx.fillRect(x, y, w, 3);
        ctx.restore();
        y += 92;
        pbbShareDrawLargeMetricColumns(ctx, metrics, x, y, w, { valueSize: 48, labelSize: 21 });
        if (cardPayload.distance_km) {
            ctx.fillStyle = '#f5c45c';
            ctx.font = '900 29px Arial, sans-serif';
            ctx.fillText(`${Number(cardPayload.distance_km).toFixed(1)} KM ROUTE`, x, y + 110);
        }
    } else if (textStyle === 'simple') {
        let y = contentBottom - 300;
        ctx.fillStyle = '#f5c45c';
        ctx.font = '900 27px Arial, sans-serif';
        ctx.fillText('ACTIVITY COMPLETE', x, y);
        y += 72;
        ctx.fillStyle = '#ffffff';
        pbbShareSetFittedFont(ctx, label.toUpperCase(), w, 92, 58);
        ctx.fillText(label.toUpperCase(), x, y);
        y += 88;
        const simpleMetrics = [metrics[0], cardPayload.distance_km
            ? ['DISTANCE', `${Number(cardPayload.distance_km).toFixed(1)} KM`]
            : metrics[1]];
        pbbShareDrawLargeMetricColumns(ctx, simpleMetrics, x, y, w, { valueSize: 46, labelSize: 20 });
    } else {
        let y = contentBottom - 500;
        ctx.fillStyle = 'rgba(255,255,255,0.96)';
        ctx.font = '900 28px Arial, sans-serif';
        ctx.fillText('ACTIVITY COMPLETE', x, y);
        y += 58;
        ctx.fillStyle = '#ffffff';
        pbbShareSetFittedFont(ctx, label.toUpperCase(), w, 118, 76);
        y = pbbShareWrapText(ctx, label.toUpperCase(), x, y, w, 116, 2) + 28;
        ctx.save();
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#f5c45c';
        ctx.fillRect(x, y, w, 4);
        ctx.restore();
        y += 84;
        pbbShareDrawLargeMetricColumns(ctx, metrics, x, y, w, { valueSize: 52, labelSize: 22 });
        if (cardPayload.distance_km) {
            ctx.fillStyle = '#f5c45c';
            ctx.font = '900 28px Arial, sans-serif';
            ctx.fillText(`${Number(cardPayload.distance_km).toFixed(1)} KM ROUTE`, x, y + 116);
        }
    }
    ctx.restore();
}

async function pbbShareDrawFullBleedMealCard(ctx, cardPayload, width, height, target) {
    const textStyle = pbbShareNormalizeTextStyle(cardPayload.share_text_style);
    const contentX = 64;
    const contentW = width - (contentX * 2);
    const contentBottom = target === 'feed' ? height - 72 : height - 132;
    const brandTop = target === 'feed' ? 48 : 228;
    const calories = Math.max(0, Math.round(Number(cardPayload.calories || 0)));
    const protein = Math.max(0, Math.round(Number(cardPayload.protein || 0)));
    const carbs = Math.max(0, Math.round(Number(cardPayload.carbs || 0)));
    const fat = Math.max(0, Math.round(Number(cardPayload.fat || 0)));
    const mealType = String(cardPayload.meal_type || 'Meal');

    const lowerGradient = ctx.createLinearGradient(0, height * (textStyle === 'simple' ? 0.60 : 0.46), 0, height);
    lowerGradient.addColorStop(0, 'rgba(4, 12, 9, 0)');
    lowerGradient.addColorStop(0.58, textStyle === 'simple' ? 'rgba(4, 12, 9, 0.12)' : 'rgba(4, 12, 9, 0.28)');
    lowerGradient.addColorStop(1, textStyle === 'simple' ? 'rgba(4, 12, 9, 0.64)' : 'rgba(4, 12, 9, 0.80)');
    ctx.fillStyle = lowerGradient;
    ctx.fillRect(0, 0, width, height);

    await pbbShareDrawBalanceBrandMark(ctx, contentX, brandTop, 72);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 32px Arial, sans-serif';
    ctx.fillText('BALANCE', contentX + 92, brandTop + 38);
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.font = '750 20px Arial, sans-serif';
    ctx.fillText('PLANT-BASED. LOGGED.', contentX + 92, brandTop + 68);

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.76)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 5;

    if (textStyle === 'scorecard') {
        const panelH = target === 'feed' ? 560 : 620;
        const panelY = contentBottom - panelH + 24;
        pbbShareFillRoundRect(ctx, 40, panelY, width - 80, panelH, 38, 'rgba(2, 6, 23, 0.76)');
        ctx.save();
        ctx.shadowColor = 'transparent';
        pbbShareRoundRect(ctx, 40, panelY, width - 80, panelH, 38);
        ctx.strokeStyle = 'rgba(245,196,92,0.86)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();

        let y = panelY + 62;
        ctx.fillStyle = '#f5c45c';
        ctx.font = '900 27px Arial, sans-serif';
        ctx.fillText('MEAL LOGGED', contentX, y);
        y += 72;
        ctx.fillStyle = '#ffffff';
        pbbShareSetFittedFont(ctx, mealType.toUpperCase(), contentW, 84, 56);
        ctx.fillText(mealType.toUpperCase(), contentX, y);
        y += 62;
        ctx.fillStyle = 'rgba(255,255,255,0.84)';
        ctx.font = '800 27px Arial, sans-serif';
        y = pbbShareWrapText(ctx, cardPayload.foods || 'Tracked in Balance', contentX, y, contentW, 34, 2) + 42;
        pbbShareDrawLargeMetricColumns(ctx, [
            ['KCAL', calories > 0 ? String(calories) : '-'],
            ['PROTEIN', `${protein}g`],
            ['CARBS', `${carbs}g`],
            ['FAT', `${fat}g`]
        ], contentX, y, contentW, { valueSize: 40, labelSize: 18 });
    } else if (textStyle === 'simple') {
        let y = contentBottom - 300;
        ctx.fillStyle = '#f5c45c';
        ctx.font = '900 27px Arial, sans-serif';
        ctx.fillText('MEAL LOGGED', contentX, y);
        y += 72;
        ctx.fillStyle = '#ffffff';
        pbbShareSetFittedFont(ctx, mealType.toUpperCase(), contentW, 94, 60);
        ctx.fillText(mealType.toUpperCase(), contentX, y);
        y += 90;
        pbbShareDrawLargeMetricColumns(ctx, [
            ['KCAL', calories > 0 ? String(calories) : '-'],
            ['PROTEIN', `${protein}g`]
        ], contentX, y, contentW, { valueSize: 48, labelSize: 20 });
    } else {
        let y = contentBottom - 500;
        ctx.fillStyle = 'rgba(255,255,255,0.96)';
        ctx.font = '900 28px Arial, sans-serif';
        ctx.fillText('MEAL LOGGED', contentX, y);
        y += 58;
        ctx.fillStyle = '#ffffff';
        pbbShareSetFittedFont(ctx, mealType.toUpperCase(), contentW, 112, 72);
        ctx.fillText(mealType.toUpperCase(), contentX, y);
        y += 70;
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.font = '800 28px Arial, sans-serif';
        y = pbbShareWrapText(ctx, cardPayload.foods || 'Tracked in Balance', contentX, y, contentW, 36, 2) + 56;
        pbbShareDrawLargeMetricColumns(ctx, [
            ['KCAL', calories > 0 ? String(calories) : '-'],
            ['PROTEIN', `${protein}g`],
            ['CARBS', `${carbs}g`],
            ['FAT', `${fat}g`]
        ], contentX, y, contentW, { valueSize: 42, labelSize: 18 });
    }
    ctx.restore();
}

async function pbbShareDrawFullBleedNutritionCard(ctx, cardPayload, width, height, target) {
    const textStyle = pbbShareNormalizeTextStyle(cardPayload.share_text_style);
    const brandTop = target === 'feed' ? 48 : 228;
    const contentBottom = target === 'feed' ? height - 72 : height - 132;
    const x = 64;
    const w = width - 128;
    const score = String(Math.round(Number(cardPayload.score || 0)));
    const metrics = [
        ['CALORIES', pbbShareFormatNumber(cardPayload.calories)],
        ['PROTEIN', pbbShareFormatNumber(cardPayload.protein, 'g')],
        ['CARBS', pbbShareFormatNumber(cardPayload.carbs, 'g')],
        ['FAT', pbbShareFormatNumber(cardPayload.fat, 'g')]
    ];

    const lowerGradient = ctx.createLinearGradient(0, height * (textStyle === 'simple' ? 0.60 : 0.44), 0, height);
    lowerGradient.addColorStop(0, 'rgba(3,18,14,0)');
    lowerGradient.addColorStop(0.60, textStyle === 'simple' ? 'rgba(3,18,14,0.12)' : 'rgba(3,18,14,0.32)');
    lowerGradient.addColorStop(1, textStyle === 'simple' ? 'rgba(3,18,14,0.64)' : 'rgba(3,18,14,0.82)');
    ctx.fillStyle = lowerGradient;
    ctx.fillRect(0, 0, width, height);

    await pbbShareDrawBalanceBrandMark(ctx, x, brandTop, 72);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 32px Arial, sans-serif';
    ctx.fillText('BALANCE', x + 92, brandTop + 38);
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.font = '750 20px Arial, sans-serif';
    ctx.fillText('PLANT-BASED. LOGGED.', x + 92, brandTop + 68);

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.72)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 5;

    if (textStyle === 'scorecard') {
        const panelH = target === 'feed' ? 540 : 600;
        const panelY = contentBottom - panelH + 24;
        pbbShareFillRoundRect(ctx, 40, panelY, width - 80, panelH, 38, 'rgba(2,6,23,0.76)');
        ctx.save();
        ctx.shadowColor = 'transparent';
        pbbShareRoundRect(ctx, 40, panelY, width - 80, panelH, 38);
        ctx.strokeStyle = 'rgba(245,196,92,0.86)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();

        let y = panelY + 62;
        ctx.fillStyle = '#f5c45c';
        ctx.font = '900 27px Arial, sans-serif';
        ctx.fillText('DAILY NUTRITION', x, y);
        y += 102;
        ctx.fillStyle = '#ffffff';
        pbbShareSetFittedFont(ctx, score, 250, 112, 82);
        ctx.fillText(score, x, y);
        ctx.font = '900 27px Arial, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.86)';
        ctx.fillText('DAILY SCORE', x + 190, y - 12);
        y += 96;
        pbbShareDrawLargeMetricColumns(ctx, metrics, x, y, w, { valueSize: 40, labelSize: 18 });
        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.font = '800 22px Arial, sans-serif';
        ctx.fillText(`${cardPayload.meal_count || 0} meals logged`, x, panelY + panelH - 42);
        ctx.textAlign = 'right';
        ctx.fillText(`${cardPayload.streak || 0} day streak`, x + w, panelY + panelH - 42);
        ctx.textAlign = 'left';
    } else if (textStyle === 'simple') {
        let y = contentBottom - 300;
        ctx.fillStyle = '#f5c45c';
        ctx.font = '900 27px Arial, sans-serif';
        ctx.fillText('DAILY NUTRITION', x, y);
        y += 112;
        ctx.fillStyle = '#ffffff';
        pbbShareSetFittedFont(ctx, score, 260, 132, 94);
        ctx.fillText(score, x, y);
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.font = '900 28px Arial, sans-serif';
        ctx.fillText('SCORE', x + 210, y - 14);
        pbbShareDrawLargeMetricColumns(ctx, metrics.slice(0, 2), x + 430, y, w - 430, { valueSize: 42, labelSize: 18 });
    } else {
        let y = contentBottom - 490;
        ctx.fillStyle = 'rgba(255,255,255,0.96)';
        ctx.font = '900 28px Arial, sans-serif';
        ctx.fillText('DAILY NUTRITION', x, y);
        y += 126;
        ctx.fillStyle = '#ffffff';
        pbbShareSetFittedFont(ctx, score, 300, 156, 108);
        ctx.fillText(score, x, y);
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.font = '900 29px Arial, sans-serif';
        ctx.fillText('DAILY SCORE', x + 238, y - 18);
        y += 86;
        ctx.save();
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#f5c45c';
        ctx.fillRect(x, y, w, 4);
        ctx.restore();
        y += 84;
        pbbShareDrawLargeMetricColumns(ctx, metrics, x, y, w, { valueSize: 42, labelSize: 18 });
        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.font = '800 22px Arial, sans-serif';
        ctx.fillText(`${cardPayload.meal_count || 0} meals logged`, x, y + 112);
        ctx.textAlign = 'right';
        ctx.fillText(`${cardPayload.streak || 0} day streak`, x + w, y + 112);
        ctx.textAlign = 'left';
    }
    ctx.restore();
}

async function pbbShareDrawProgressPhotoCard(ctx, cardPayload, panelX, panelY, panelW, panelH, photoDataUrls) {
    let y = panelY + 142;
    const photos = Array.isArray(photoDataUrls) ? photoDataUrls.filter(Boolean).slice(0, 3) : [];
    if (photos.length) {
        const gap = 12;
        const photoW = (panelW - 112 - gap * (photos.length - 1)) / photos.length;
        const photoH = 520;
        for (let i = 0; i < photos.length; i++) {
            try {
                const img = await pbbShareLoadImage(photos[i]);
                const x = panelX + 56 + i * (photoW + gap);
                pbbShareFillRoundRect(ctx, x, y, photoW, photoH, 28, '#f1f5f9');
                ctx.save();
                pbbShareRoundRect(ctx, x, y, photoW, photoH, 28);
                ctx.clip();
                pbbShareDrawCoverImage(ctx, img, x, y, photoW, photoH);
                ctx.restore();
            } catch (e) {
                console.warn('Could not draw progress photo:', e);
            }
        }
        y += photoH + 48;
    }

    ctx.fillStyle = '#111827';
    ctx.font = '900 58px Arial, sans-serif';
    y = pbbShareWrapText(ctx, cardPayload.title || 'Progress photos logged', panelX + 56, y, panelW - 112, 64, 2) + 24;
    ctx.fillStyle = '#475569';
    ctx.font = '750 29px Arial, sans-serif';
    pbbShareWrapText(ctx, cardPayload.subtitle || 'Showing up, checking in, and keeping the receipts.', panelX + 56, y, panelW - 112, 40, 3);

    const shotCount = Number(cardPayload.shot_count || photos.length || 1);
    pbbShareFillRoundRect(ctx, panelX + 56, panelY + panelH - 150, panelW - 112, 94, 26, '#fce7f3');
    ctx.fillStyle = '#9d174d';
    ctx.font = '900 30px Arial, sans-serif';
    ctx.fillText(shotCount + ' progress photo' + (shotCount === 1 ? '' : 's') + ' saved this week', panelX + 92, panelY + panelH - 92);
}

function pbbShareWrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    words.forEach(word => {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && line) {
            lines.push(line);
            line = word;
        } else {
            line = test;
        }
    });
    if (line) lines.push(line);

    const limit = maxLines || lines.length;
    lines.slice(0, limit).forEach((lineText, index) => {
        let output = lineText;
        if (index === limit - 1 && lines.length > limit) output = output.replace(/\s+\S*$/, '') + '...';
        ctx.fillText(output, x, y + (index * lineHeight));
    });
    return y + (Math.min(lines.length, limit) * lineHeight);
}

function pbbShareDataUrlToBlob(dataUrl) {
    const parts = String(dataUrl || '').split(',');
    const mimeMatch = parts[0].match(/data:(.*?);base64/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const binary = atob(parts[1] || '');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
}

function pbbShareGetStudioCustomization(cardType) {
    const all = window.__balanceShareStudioCustomizations || {};
    const safeType = String(cardType || '').toLowerCase();
    return all[safeType] || (safeType === 'meal' ? all.nutrition : null) || null;
}

function pbbShareDrawStudioCaption(ctx, width, height, cardType, options) {
    if (options && options.suppressCustomCaption) return;
    const custom = pbbShareGetStudioCustomization(cardType);
    const text = String(custom && custom.caption || '').trim();
    if (!text) return;

    const xRatio = Math.max(0.1, Math.min(0.9, Number(custom.captionX) || 0.5));
    const yRatio = Math.max(0.1, Math.min(0.9, Number(custom.captionY) || 0.22));
    const style = ['plain', 'label', 'gold'].includes(custom.captionStyle) ? custom.captionStyle : 'plain';
    const fontSize = Math.round(width * 0.058);
    const lineHeight = Math.round(fontSize * 1.12);
    const maxWidth = width * 0.78;
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';

    ctx.save();
    ctx.font = `900 ${fontSize}px Arial, sans-serif`;
    words.forEach(word => {
        const candidate = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(candidate).width > maxWidth) {
            lines.push(line);
            line = word;
        } else {
            line = candidate;
        }
    });
    if (line) lines.push(line);
    const visibleLines = lines.slice(0, 4);
    const textWidth = Math.min(maxWidth, Math.max(...visibleLines.map(value => ctx.measureText(value).width), 1));
    const blockHeight = visibleLines.length * lineHeight;
    const centerX = width * xRatio;
    const top = Math.max(28, Math.min(height - blockHeight - 28, (height * yRatio) - (blockHeight / 2)));
    const paddingX = 24;
    const paddingY = 16;

    if (style === 'label' || style === 'gold') {
        pbbShareFillRoundRect(
            ctx,
            centerX - (textWidth / 2) - paddingX,
            top - paddingY,
            textWidth + (paddingX * 2),
            blockHeight + (paddingY * 2),
            18,
            style === 'gold' ? '#e9c87e' : 'rgba(20,18,13,0.82)'
        );
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = style === 'gold' ? '#241d10' : '#ffffff';
    if (style === 'plain') {
        ctx.shadowColor = 'rgba(0,0,0,0.82)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 4;
    }
    visibleLines.forEach((value, index) => ctx.fillText(value, centerX, top + (index * lineHeight)));
    ctx.restore();
}

async function renderBalanceShareCardImage(cardPayload, options = {}) {
    if (!cardPayload) throw new Error('Missing share card payload');

    if (cardPayload.studio_hide_pb) {
        cardPayload = Object.assign({}, cardPayload, {
            pbs: null,
            improvement: null,
            exercises: (cardPayload.exercises || []).map(exercise => Object.assign({}, exercise, {
                has_pb: false,
                set_details: (exercise.set_details || []).map(set => Object.assign({}, set, { is_pb: false }))
            }))
        });
    }

    const target = options.target === 'feed' ? 'feed' : 'story';
    const cardType = cardPayload.card_type || 'workout';
    const width = 1080;
    const height = target === 'feed' ? 1350 : 1920;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, '#07140f');
    bgGradient.addColorStop(0.52, '#124734');
    bgGradient.addColorStop(1, '#f5c45c');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    const photoDataUrls = Array.isArray(options.photoDataUrls) ? options.photoDataUrls.filter(Boolean) : [];
    const primaryPhotoDataUrl = options.photoDataUrl || photoDataUrls[0] || '';
    const requestedOverlayStyle = String(options.overlayStyle || cardPayload.share_overlay_style || '').toLowerCase();
    const overlayStyle = ['gold', 'midnight', 'fresh'].includes(requestedOverlayStyle) ? requestedOverlayStyle : 'classic';
    const textStyle = pbbShareNormalizeTextStyle(options.textStyle || cardPayload.share_text_style);

    if (primaryPhotoDataUrl) {
        try {
            const photo = await pbbShareLoadImage(primaryPhotoDataUrl);
            if (overlayStyle === 'classic') {
                pbbShareDrawCoverImage(ctx, photo, 0, 0, width, height);
            } else {
                ctx.save();
                if (overlayStyle === 'midnight') ctx.filter = 'grayscale(0.72) contrast(1.08) brightness(0.86)';
                if (overlayStyle === 'gold') ctx.filter = 'saturate(0.88) contrast(1.04)';
                if (overlayStyle === 'fresh') ctx.filter = 'saturate(1.08) contrast(1.02)';
                pbbShareDrawCoverImage(ctx, photo, 0, 0, width, height);
                ctx.restore();
                pbbShareApplyPhotoStyle(ctx, width, height, overlayStyle, target);
            }
            // Workout, PB, and activity overlays keep the original photo
            // brightness. Their local fades give the white stats enough contrast.
            if (cardType !== 'workout' && cardType !== 'pb' && cardType !== 'activity' && cardType !== 'nutrition') {
                ctx.fillStyle = cardType === 'meal'
                    ? 'rgba(4, 12, 9, 0.18)'
                    : 'rgba(4, 12, 9, 0.56)';
                ctx.fillRect(0, 0, width, height);
            }
        } catch (e) {
            console.warn('Could not draw share background photo:', e);
        }
    }

    if ((cardType === 'workout' || cardType === 'pb') && primaryPhotoDataUrl) {
        await pbbShareDrawFullBleedWorkoutCard(
            ctx,
            Object.assign({}, cardPayload, { share_text_style: textStyle }),
            width,
            height,
            target
        );
        pbbShareDrawStudioCaption(ctx, width, height, cardType, options);
        return canvas.toDataURL('image/jpeg', 0.92);
    }

    if (cardType === 'meal' && primaryPhotoDataUrl) {
        await pbbShareDrawFullBleedMealCard(
            ctx,
            Object.assign({}, cardPayload, { share_text_style: textStyle }),
            width,
            height,
            target
        );
        pbbShareDrawStudioCaption(ctx, width, height, cardType, options);
        return canvas.toDataURL('image/jpeg', 0.92);
    }

    if (cardType === 'nutrition' && primaryPhotoDataUrl) {
        await pbbShareDrawFullBleedNutritionCard(
            ctx,
            Object.assign({}, cardPayload, { share_text_style: textStyle }),
            width,
            height,
            target
        );
        pbbShareDrawStudioCaption(ctx, width, height, cardType, options);
        return canvas.toDataURL('image/jpeg', 0.92);
    }

    if (cardType === 'activity') {
        await pbbShareDrawFullBleedActivityCard(
            ctx,
            Object.assign({}, cardPayload, { share_text_style: textStyle }),
            width,
            height,
            target
        );
        pbbShareDrawStudioCaption(ctx, width, height, cardType, options);
        return canvas.toDataURL('image/jpeg', 0.92);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, height - 190, width, 190);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 42px Arial, sans-serif';
    ctx.fillText('Balance', 76, 110);
    ctx.font = '700 24px Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.fillText('plantbased-balance.org/bio', 76, 146);

    const panelX = 70;
    const panelW = width - 140;
    const panelY = target === 'feed' ? 214 : 430;
    const panelH = cardType === 'pb'
        ? (target === 'feed' ? 790 : 930)
        : (cardType === 'progress_photo' ? (target === 'feed' ? 940 : 1120) : (target === 'feed' ? 870 : 1040));
    pbbShareFillRoundRect(ctx, panelX, panelY, panelW, panelH, 42, 'rgba(255,255,255,0.94)');

    let y = panelY + 78;
    const eyebrowByType = {
        pb: 'NEW PERSONAL BEST',
        workout: 'WORKOUT COMPLETE',
        nutrition: 'NUTRITION CHECK-IN',
        meal: 'MEAL LOGGED',
        progress_photo: 'PROGRESS PHOTOS'
    };
    ctx.fillStyle = '#0f3d2e';
    ctx.font = '900 32px Arial, sans-serif';
    ctx.fillText(eyebrowByType[cardType] || 'BALANCE UPDATE', panelX + 56, y);
    y += 76;

    if (cardType === 'pb') {
        ctx.fillStyle = '#111827';
        ctx.font = '900 70px Arial, sans-serif';
        y = pbbShareWrapText(ctx, cardPayload.exercise || 'Personal best', panelX + 56, y, panelW - 112, 78, 2) + 34;

        pbbShareFillRoundRect(ctx, panelX + 56, y, panelW - 112, 188, 30, '#fef3c7');
        ctx.fillStyle = '#92400e';
        ctx.font = '900 26px Arial, sans-serif';
        ctx.fillText('PB RESULT', panelX + 96, y + 56);
        ctx.fillStyle = '#111827';
        ctx.font = '900 58px Arial, sans-serif';
        ctx.fillText(pbbFormatPBShareValue(cardPayload), panelX + 96, y + 132);
        y += 238;

        if (cardPayload.improvement) {
            pbbShareFillRoundRect(ctx, panelX + 56, y, panelW - 112, 112, 26, '#dcfce7');
            ctx.fillStyle = '#166534';
            ctx.font = '900 38px Arial, sans-serif';
            const improvementText = cardPayload.pb_type === 'weight'
                ? `Up ${pbbPointsFormatWeightFromKg(cardPayload.improvement)}`
                : `Up ${cardPayload.improvement} reps`;
            ctx.fillText(improvementText, panelX + 96, y + 70);
            y += 150;
        }

        ctx.fillStyle = '#475569';
        ctx.font = '700 32px Arial, sans-serif';
        pbbShareWrapText(ctx, 'Logged in Balance after showing up and doing the work.', panelX + 56, y, panelW - 112, 42, 3);
    } else if (cardType === 'nutrition') {
        pbbShareDrawNutritionCard(ctx, cardPayload, panelX, panelY, panelW, panelH);
    } else if (cardType === 'meal') {
        await pbbShareDrawMealCard(ctx, cardPayload, panelX, panelY, panelW, panelH, primaryPhotoDataUrl);
    } else if (cardType === 'progress_photo') {
        await pbbShareDrawProgressPhotoCard(ctx, cardPayload, panelX, panelY, panelW, panelH, photoDataUrls.length ? photoDataUrls : [primaryPhotoDataUrl]);
    } else {
        ctx.fillStyle = '#111827';
        ctx.font = '900 64px Arial, sans-serif';
        y = pbbShareWrapText(ctx, cardPayload.workout_name || 'Workout', panelX + 56, y, panelW - 112, 72, 2) + 28;

        const metricY = y;
        const metricW = (panelW - 136) / 3;
        const metrics = [
            ['Duration', cardPayload.duration || '00:00'],
            ['Sets', String(cardPayload.total_sets || 0)],
            ['Volume', cardPayload.total_volume || '-']
        ];
        metrics.forEach((metric, index) => {
            const x = panelX + 56 + (index * (metricW + 12));
            pbbShareFillRoundRect(ctx, x, metricY, metricW, 138, 26, index === 0 ? '#ecfeff' : (index === 1 ? '#f0fdf4' : '#eef2ff'));
            ctx.fillStyle = '#475569';
            ctx.font = '800 22px Arial, sans-serif';
            ctx.fillText(metric[0], x + 26, metricY + 44);
            ctx.fillStyle = '#111827';
            ctx.font = '900 32px Arial, sans-serif';
            pbbShareWrapText(ctx, metric[1], x + 26, metricY + 91, metricW - 52, 35, 1);
        });
        y += 190;

        ctx.fillStyle = '#0f3d2e';
        ctx.font = '900 30px Arial, sans-serif';
        ctx.fillText('Top sets', panelX + 56, y);
        y += 42;

        (cardPayload.exercises || []).slice(0, 5).forEach(exercise => {
            pbbShareFillRoundRect(ctx, panelX + 56, y, panelW - 112, 84, 22, 'rgba(15, 61, 46, 0.08)');
            ctx.fillStyle = '#111827';
            ctx.font = '800 27px Arial, sans-serif';
            pbbShareWrapText(ctx, exercise.name || 'Exercise', panelX + 84, y + 34, panelW - 360, 30, 1);
            ctx.fillStyle = '#0f766e';
            ctx.font = '900 25px Arial, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(exercise.best || `${exercise.sets || 0} sets`, panelX + panelW - 84, y + 52);
            ctx.textAlign = 'left';
            y += 98;
        });

        if (cardPayload.pbs && cardPayload.pbs.length > 0) {
            pbbShareFillRoundRect(ctx, panelX + 56, panelY + panelH - 146, panelW - 112, 92, 26, '#fef3c7');
            ctx.fillStyle = '#92400e';
            ctx.font = '900 32px Arial, sans-serif';
            ctx.fillText(`${cardPayload.pbs.length} new PB${cardPayload.pbs.length === 1 ? '' : 's'}`, panelX + 92, panelY + panelH - 88);
        }
    }

    await pbbShareDrawBalanceBrandMark(ctx, 76, height - 142, 34);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 46px Arial, sans-serif';
    ctx.fillText('Train. Track. Level up.', 124, height - 98);
    ctx.font = '750 27px Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.fillText('Balance: Plant-Based Fitness', 124, height - 58);

    pbbShareDrawStudioCaption(ctx, width, height, cardType, options);
    return canvas.toDataURL('image/jpeg', 0.92);
}

async function renderBalanceShareStylePreview(context, cardPayload, photoDataUrl, config = {}) {
    if (!cardPayload || !photoDataUrl) return;
    const safeContext = pbbShareNormalizeContext(context || cardPayload.card_type);
    const previewImage = document.getElementById(config.previewImageId || `${safeContext}-share-style-preview`);
    const previewWrap = document.getElementById(config.previewWrapId || `${safeContext}-share-style-preview-wrap`);
    const controls = document.getElementById(config.controlsId || `${safeContext}-share-style-controls`);
    if (!previewImage || !previewWrap || !controls) return;

    const state = pbbShareStylePreviewState[safeContext] || {};
    state.cardPayload = Object.assign({}, cardPayload);
    state.photoDataUrl = photoDataUrl;
    state.previewImageId = previewImage.id;
    state.previewWrapId = previewWrap.id;
    state.controlsId = controls.id;
    state.renderToken = (state.renderToken || 0) + 1;
    pbbShareStylePreviewState[safeContext] = state;

    previewWrap.style.display = 'block';
    controls.style.display = 'block';
    const supportsTextStyle = pbbShareSupportsTextStyle(safeContext);
    const textStyleOptions = pbbShareTextStyleOptions(safeContext);
    controls.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:9px; color:#ffffff; -webkit-text-fill-color:#ffffff;">
            <span style="font-size:0.78rem; font-weight:900;">Colour</span>
            <span data-balance-share-style-name="${safeContext}" style="font-size:0.72rem; font-weight:900; color:#fde68a; -webkit-text-fill-color:#fde68a;"></span>
        </div>
        <div style="display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:7px;">
            ${PBB_SHARE_OVERLAY_STYLES.map(option => `<button type="button" data-balance-share-style="${option.id}" onclick="selectBalanceShareOverlayStyle('${safeContext}','${option.id}')" style="min-width:0; border:1px solid rgba(255,255,255,0.28); border-radius:999px; padding:8px 5px; background:rgba(255,255,255,0.1); color:#ffffff; -webkit-text-fill-color:#ffffff; font:inherit; font-size:0.7rem; font-weight:900; cursor:pointer;">${option.label}</button>`).join('')}
        </div>
        ${supportsTextStyle ? `
            <div style="height:1px; background:rgba(255,255,255,0.14); margin:13px 0 11px;"></div>
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:9px; color:#ffffff; -webkit-text-fill-color:#ffffff;">
                <span style="font-size:0.78rem; font-weight:900;">Text layout</span>
                <span data-balance-share-text-style-name="${safeContext}" style="font-size:0.72rem; font-weight:900; color:#fde68a; -webkit-text-fill-color:#fde68a;"></span>
            </div>
            <div style="display:grid; grid-template-columns:repeat(${textStyleOptions.length === 4 ? 2 : 3},minmax(0,1fr)); gap:7px;">
                ${textStyleOptions.map(option => `<button type="button" data-balance-share-text-style="${option.id}" onclick="selectBalanceShareTextStyle('${safeContext}','${option.id}')" style="min-width:0; border:1px solid rgba(255,255,255,0.28); border-radius:999px; padding:9px 6px; background:rgba(255,255,255,0.1); color:#ffffff; -webkit-text-fill-color:#ffffff; font:inherit; font-size:0.7rem; font-weight:900; cursor:pointer;">${option.label}</button>`).join('')}
            </div>` : ''}`;

    if (previewWrap.dataset.balanceShareSwipeBound !== 'true') {
        let touchStartX = null;
        previewWrap.addEventListener('touchstart', event => {
            touchStartX = event.touches && event.touches[0] ? event.touches[0].clientX : null;
        }, { passive: true });
        previewWrap.addEventListener('touchend', event => {
            if (touchStartX == null) return;
            const endX = event.changedTouches && event.changedTouches[0] ? event.changedTouches[0].clientX : touchStartX;
            const deltaX = endX - touchStartX;
            touchStartX = null;
            if (Math.abs(deltaX) < 36) return;
            cycleBalanceShareOverlayStyle(previewWrap.dataset.balanceShareContext, deltaX < 0 ? 1 : -1);
        }, { passive: true });
        previewWrap.dataset.balanceShareSwipeBound = 'true';
    }
    previewWrap.dataset.balanceShareContext = safeContext;

    await updateBalanceShareStylePreview(safeContext);
}

async function updateBalanceShareStylePreview(context) {
    const safeContext = pbbShareNormalizeContext(context);
    const state = pbbShareStylePreviewState[safeContext];
    if (!state) return;
    const previewImage = document.getElementById(state.previewImageId);
    const controls = document.getElementById(state.controlsId);
    if (!previewImage || !controls) return;

    const style = getBalanceShareOverlayStyle(safeContext);
    const option = PBB_SHARE_OVERLAY_STYLES.find(item => item.id === style) || PBB_SHARE_OVERLAY_STYLES[0];
    const textStyle = getBalanceShareTextStyle(safeContext);
    const textStyleOptions = pbbShareTextStyleOptions(safeContext);
    const textOption = textStyleOptions.find(item => item.id === textStyle) || textStyleOptions[0];
    const token = ++state.renderToken;
    previewImage.style.opacity = '0.58';
    previewImage.setAttribute('aria-busy', 'true');
    controls.querySelectorAll('[data-balance-share-style]').forEach(button => {
        const selected = button.dataset.balanceShareStyle === style;
        button.style.background = selected ? '#f5c45c' : 'rgba(255,255,255,0.1)';
        button.style.color = selected ? '#111827' : '#ffffff';
        button.style.webkitTextFillColor = selected ? '#111827' : '#ffffff';
        button.style.borderColor = selected ? '#fde68a' : 'rgba(255,255,255,0.28)';
        button.setAttribute('aria-pressed', String(selected));
    });
    const name = controls.querySelector(`[data-balance-share-style-name="${safeContext}"]`);
    if (name) name.textContent = option.label;
    controls.querySelectorAll('[data-balance-share-text-style]').forEach(button => {
        const selected = button.dataset.balanceShareTextStyle === textStyle;
        button.style.background = selected ? '#f5c45c' : 'rgba(255,255,255,0.1)';
        button.style.color = selected ? '#111827' : '#ffffff';
        button.style.webkitTextFillColor = selected ? '#111827' : '#ffffff';
        button.style.borderColor = selected ? '#fde68a' : 'rgba(255,255,255,0.28)';
        button.setAttribute('aria-pressed', String(selected));
    });
    const textName = controls.querySelector(`[data-balance-share-text-style-name="${safeContext}"]`);
    if (textName) textName.textContent = textOption.label;

    try {
        const previewPayload = Object.assign({}, state.cardPayload, {
            share_overlay_style: style,
            share_text_style: textStyle
        });
        const dataUrl = await renderBalanceShareCardImage(previewPayload, {
            target: 'feed',
            photoDataUrl: state.photoDataUrl,
            overlayStyle: style,
            textStyle
        });
        if (token !== state.renderToken) return;
        previewImage.src = dataUrl;
        previewImage.style.opacity = '1';
        previewImage.removeAttribute('aria-busy');
    } catch (error) {
        console.error('Could not render share style preview:', error);
        if (token !== state.renderToken) return;
        previewImage.style.opacity = '1';
        previewImage.removeAttribute('aria-busy');
        if (typeof showToast === 'function') showToast('Could not preview that style. Try another one.', 'error');
    }
}

function selectBalanceShareOverlayStyle(context, style) {
    const safeContext = pbbShareNormalizeContext(context);
    pbbShareOverlaySelections[safeContext] = pbbShareNormalizeOverlayStyle(style);
    return updateBalanceShareStylePreview(safeContext);
}

function cycleBalanceShareOverlayStyle(context, direction) {
    const safeContext = pbbShareNormalizeContext(context);
    const current = getBalanceShareOverlayStyle(safeContext);
    const currentIndex = Math.max(0, PBB_SHARE_OVERLAY_STYLES.findIndex(option => option.id === current));
    const nextIndex = (currentIndex + (direction < 0 ? -1 : 1) + PBB_SHARE_OVERLAY_STYLES.length) % PBB_SHARE_OVERLAY_STYLES.length;
    return selectBalanceShareOverlayStyle(safeContext, PBB_SHARE_OVERLAY_STYLES[nextIndex].id);
}

function selectBalanceShareTextStyle(context, style) {
    const safeContext = pbbShareNormalizeContext(context);
    if (!pbbShareSupportsTextStyle(safeContext)) return Promise.resolve();
    pbbShareTextSelections[safeContext] = pbbShareNormalizeTextStyle(style);
    return updateBalanceShareStylePreview(safeContext);
}

if (typeof window !== 'undefined') {
    window.renderBalanceShareStylePreview = renderBalanceShareStylePreview;
    window.selectBalanceShareOverlayStyle = selectBalanceShareOverlayStyle;
    window.cycleBalanceShareOverlayStyle = cycleBalanceShareOverlayStyle;
    window.getBalanceShareOverlayStyle = getBalanceShareOverlayStyle;
    window.selectBalanceShareTextStyle = selectBalanceShareTextStyle;
    window.getBalanceShareTextStyle = getBalanceShareTextStyle;
}

async function shareBalanceCardImageExternally(dataUrl, target, text, options = {}) {
    const blob = pbbShareDataUrlToBlob(dataUrl);
    const file = new File([blob], `balance-${target || 'share'}-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
    const shareData = {
        title: 'Balance',
        text: text || 'Shared from Balance',
        files: [file]
    };

    if (navigator.share) {
        try {
            if (!navigator.canShare || navigator.canShare(shareData)) {
                await navigator.share(shareData);
                showToast('Share sheet opened. Choose Instagram to post it.', 'success');
                return true;
            }
        } catch (error) {
            if (error && error.name === 'AbortError') return false;
            console.warn('Native web share failed:', error);
        }
    }

    if (options.allowDownloadFallback === false) return null;

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast('Card saved. Upload it to Instagram from your photos.', 'info');
    return true;
}

function pbbShareBlobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('Could not prepare motion share'));
        reader.readAsDataURL(blob);
    });
}

function pbbSharePickVideoMimeType() {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return '';
    const candidates = [
        'video/mp4;codecs=avc1.42E01E',
        'video/mp4',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm'
    ];
    return candidates.find(type => MediaRecorder.isTypeSupported(type)) || '';
}

function pbbShareDrawMotionFrame(ctx, image, width, height, progress, target, major) {
    const eased = 1 - Math.pow(1 - Math.min(1, progress), 3);
    const scale = 1 + (eased * 0.018);
    const drawW = width * scale;
    const drawH = height * scale;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);

    const introFade = Math.max(0, 1 - (progress / 0.24));
    if (introFade > 0) {
        ctx.fillStyle = `rgba(2, 6, 23, ${introFade * 0.46})`;
        ctx.fillRect(0, 0, width, height);
    }

    const burstProgress = Math.min(1, Math.max(0, (progress - 0.05) / 0.32));
    const burstFade = Math.min(1, Math.max(0, (0.52 - progress) / 0.18));
    if (burstProgress > 0 && burstFade > 0) {
        const originX = width * 0.82;
        const originY = target === 'feed' ? 154 : 310;
        const colours = major
            ? ['#fbbf24', '#fde68a', '#ffffff', '#34d399']
            : ['#f5c45c', '#ffffff', '#5eead4'];
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (let i = 0; i < (major ? 28 : 20); i++) {
            const angle = ((Math.PI * 2) / (major ? 28 : 20)) * i + 0.16;
            const distance = burstProgress * (74 + ((i * 43) % 190));
            const x = originX + Math.cos(angle) * distance;
            const y = originY + Math.sin(angle) * distance * 0.72 + (burstProgress * burstProgress * 38);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle + (burstProgress * 2.4));
            ctx.globalAlpha = burstFade * (0.62 + ((i % 3) * 0.14));
            pbbShareFillRoundRect(ctx, -3, -10, 6 + (i % 2) * 3, 20 + (i % 4) * 5, 5, colours[i % colours.length]);
            ctx.restore();
        }
        ctx.restore();
    }

    const sweepProgress = Math.min(1, Math.max(0, (progress - 0.12) / 0.42));
    if (sweepProgress > 0 && sweepProgress < 1) {
        const sweepX = -360 + (width + 720) * sweepProgress;
        ctx.save();
        ctx.translate(sweepX, 0);
        ctx.rotate(-0.16);
        const sweep = ctx.createLinearGradient(-170, 0, 170, 0);
        sweep.addColorStop(0, 'rgba(245,196,92,0)');
        sweep.addColorStop(0.46, 'rgba(253,230,138,0.08)');
        sweep.addColorStop(0.5, 'rgba(255,255,255,0.42)');
        sweep.addColorStop(0.54, 'rgba(253,230,138,0.1)');
        sweep.addColorStop(1, 'rgba(245,196,92,0)');
        ctx.fillStyle = sweep;
        ctx.fillRect(-170, -220, 340, height + 440);
        ctx.restore();
    }
}

async function renderBalanceShareCardVideo(cardPayload, options = {}) {
    const target = options.target === 'feed' ? 'feed' : 'story';
    const mimeType = pbbSharePickVideoMimeType();
    if (!mimeType || typeof document === 'undefined') throw new Error('Motion sharing is not supported on this phone');

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = target === 'feed' ? 1350 : 1920;
    if (typeof canvas.captureStream !== 'function') throw new Error('Motion sharing is not supported on this phone');
    const ctx = canvas.getContext('2d');
    const stillDataUrl = await renderBalanceShareCardImage(cardPayload, options);
    const stillImage = await pbbShareLoadImage(stillDataUrl);
    const stream = canvas.captureStream(30);
    const chunks = [];
    const recorderOptions = { mimeType, videoBitsPerSecond: target === 'feed' ? 3200000 : 4200000 };
    const recorder = new MediaRecorder(stream, recorderOptions);
    const durationMs = 4200;
    const major = cardPayload.card_type === 'pb' || !!(cardPayload.pbs && cardPayload.pbs.length);

    const completion = new Promise((resolve, reject) => {
        const safetyTimer = setTimeout(() => {
            try { if (recorder.state !== 'inactive') recorder.stop(); } catch (e) {}
            reject(new Error('Motion share timed out'));
        }, durationMs + 3500);
        recorder.ondataavailable = event => {
            if (event.data && event.data.size > 0) chunks.push(event.data);
        };
        recorder.onerror = event => {
            clearTimeout(safetyTimer);
            reject(event.error || new Error('Could not record motion share'));
        };
        recorder.onstop = () => {
            clearTimeout(safetyTimer);
            stream.getTracks().forEach(track => track.stop());
            if (!chunks.length) {
                reject(new Error('Motion share was empty'));
                return;
            }
            resolve(new Blob(chunks, { type: recorder.mimeType || mimeType }));
        };
    });

    const startedAt = performance.now();
    const drawFrame = now => {
        const elapsed = now - startedAt;
        const progress = Math.min(1, elapsed / durationMs);
        pbbShareDrawMotionFrame(ctx, stillImage, canvas.width, canvas.height, progress, target, major);
        if (progress < 1 && recorder.state !== 'inactive') {
            requestAnimationFrame(drawFrame);
        } else if (recorder.state !== 'inactive') {
            recorder.stop();
        }
    };

    pbbShareDrawMotionFrame(ctx, stillImage, canvas.width, canvas.height, 0, target, major);
    recorder.start(250);
    requestAnimationFrame(drawFrame);
    return completion;
}

async function shareBalanceCardVideoExternally(blob, target) {
    const mimeType = blob.type || 'video/mp4';
    const extension = mimeType.includes('webm') ? 'webm' : (mimeType.includes('quicktime') ? 'mov' : 'mp4');
    const file = new File([blob], `balance-${target || 'share'}-${Date.now()}.${extension}`, { type: mimeType });
    const shareData = {
        title: 'Balance',
        text: target === 'story' ? 'Share this to your Instagram Story' : 'Share this to your Instagram Feed',
        files: [file]
    };
    if (!navigator.share || (navigator.canShare && !navigator.canShare(shareData))) return null;
    try {
        await navigator.share(shareData);
        showToast('Share sheet opened. Choose Instagram to post it.', 'success');
        return true;
    } catch (error) {
        if (error && error.name === 'AbortError') return false;
        console.warn('Motion share sheet failed:', error);
        return null;
    }
}

function canUseFreshAndroidInstagramShareBridge() {
    const nativePermissions = window.NativePermissions;
    if (!nativePermissions) return false;
    const getVersion = nativePermissions.getInstagramShareBridgeVersion;
    if (typeof getVersion !== 'function') return false;
    try {
        return Number(getVersion.call(nativePermissions)) >= 2;
    } catch (error) {
        console.warn('Could not verify Android Instagram share bridge version:', error);
        return false;
    }
}

async function shareBalanceCardVideoWithNativeBridge(blob, safeTarget) {
    const dataUrl = await pbbShareBlobToDataUrl(blob);
    const androidShare = window.NativePermissions && window.NativePermissions.shareVideoToInstagram;
    if (typeof androidShare === 'function' && canUseFreshAndroidInstagramShareBridge()) {
        try {
            const opened = androidShare.call(window.NativePermissions, dataUrl, safeTarget);
            if (opened === true || opened === 'true') return true;
        } catch (error) {
            console.warn('Android Instagram motion share failed:', error);
        }
    }

    const iosShare = getBalanceInstagramSharePlugin();
    if (iosShare && typeof iosShare.shareVideoToInstagram === 'function') {
        try {
            const result = await iosShare.shareVideoToInstagram({ dataUrl, target: safeTarget });
            if (result && (result.opened === true || result.success === true)) return true;
        } catch (error) {
            console.warn('iOS Instagram motion share failed:', error);
        }
    }
    return false;
}

async function shareBalanceCardWithNativeBridge(dataUrl, safeTarget) {
    const androidShare = window.NativePermissions && window.NativePermissions.shareImageToInstagram;
    if (typeof androidShare === 'function' && canUseFreshAndroidInstagramShareBridge()) {
        try {
            const opened = androidShare.call(window.NativePermissions, dataUrl, safeTarget);
            window._balanceInstagramShareLastResult = { platform: 'android', opened };
            if (opened === true || opened === 'true') return true;
        } catch (androidError) {
            window._balanceInstagramShareLastResult = { platform: 'android', error: String(androidError && androidError.message || androidError) };
            console.warn('Android Instagram share failed:', androidError);
        }
    }

    const iosShare = getBalanceInstagramSharePlugin();
    if (iosShare && typeof iosShare.shareImageToInstagram === 'function') {
        try {
            const result = await iosShare.shareImageToInstagram({ dataUrl, target: safeTarget });
            window._balanceInstagramShareLastResult = { platform: 'ios', result };
            if (result && (result.opened === true || result.success === true)) return true;
            console.warn('iOS Instagram share did not open:', result);
        } catch (iosError) {
            window._balanceInstagramShareLastResult = { platform: 'ios', error: String(iosError && iosError.message || iosError) };
            console.warn('iOS Instagram share failed:', iosError);
        }
    }

    return false;
}

async function shareBalanceCardWithLegacyAndroidBridge(dataUrl, safeTarget) {
    const nativePermissions = window.NativePermissions;
    const androidShare = nativePermissions && nativePermissions.shareImageToInstagram;
    if (typeof androidShare !== 'function' || canUseFreshAndroidInstagramShareBridge()) return false;
    try {
        const opened = androidShare.call(nativePermissions, dataUrl, safeTarget);
        window._balanceInstagramShareLastResult = { platform: 'android-legacy', opened };
        return opened === true || opened === 'true';
    } catch (error) {
        window._balanceInstagramShareLastResult = { platform: 'android-legacy', error: String(error && error.message || error) };
        console.warn('Legacy Android Instagram share failed:', error);
        return false;
    }
}

async function shareBalanceCardToInstagram(cardPayload, target, options = {}) {
    if (!canUseBalanceInstagramShareTest()) {
        showToast('Instagram sharing is in test mode for now.', 'info');
        return false;
    }

    const safeTarget = target === 'feed' ? 'feed' : 'story';
    const renderOptions = {
        target: safeTarget,
        photoDataUrl: options.photoDataUrl || null,
        photoDataUrls: options.photoDataUrls || null,
        overlayStyle: options.overlayStyle || cardPayload.share_overlay_style || 'classic',
        textStyle: options.textStyle || cardPayload.share_text_style || 'bold'
    };
    let preparedNotified = false;
    const notifyPrepared = () => {
        if (preparedNotified) return;
        preparedNotified = true;
        if (typeof options.onSharePrepared === 'function') options.onSharePrepared();
    };
    const motionEligible = options.animate !== false
        && !!renderOptions.photoDataUrl
        && ['workout', 'pb', 'activity'].includes(String(cardPayload.card_type || ''));

    if (motionEligible) {
        try {
            showToast('Making your motion card...', 'info');
            const videoBlob = await renderBalanceShareCardVideo(cardPayload, renderOptions);
            notifyPrepared();
            if (await shareBalanceCardVideoWithNativeBridge(videoBlob, safeTarget)) {
                showToast(`Opening Instagram ${safeTarget === 'story' ? 'Story' : 'Feed'}...`, 'success');
                return true;
            }
            const sharedExternally = await shareBalanceCardVideoExternally(videoBlob, safeTarget);
            if (sharedExternally === true) return true;
            if (sharedExternally === false) return false;
        } catch (motionError) {
            console.warn('Motion card unavailable, using still share:', motionError);
        }
    }

    const dataUrl = await renderBalanceShareCardImage(cardPayload, renderOptions);

    notifyPrepared();

    if (await shareBalanceCardWithNativeBridge(dataUrl, safeTarget)) {
        showToast(`Opening Instagram ${safeTarget === 'story' ? 'Story' : 'Feed'}...`, 'success');
        return true;
    }

    if (isBalanceNativeInstagramSurface()) {
        // Direct Instagram intents can be rejected by either mobile platform,
        // including Android OEM/Instagram combinations where the app is
        // installed but does not resolve the targeted composer. Keep the share
        // usable by falling back to the platform share sheet on both platforms.
        const sharedExternally = await shareBalanceCardImageExternally(
            dataUrl,
            safeTarget,
            safeTarget === 'story' ? 'Share this to your Instagram Story' : 'Share this to your Instagram Feed',
            { allowDownloadFallback: false }
        );
        if (sharedExternally === true || sharedExternally === false) return sharedExternally;

        // Shells installed before bridge v2 cannot mint a fresh content URI.
        // If their WebView has no usable file share sheet, still open Instagram
        // directly instead of silently downloading the prepared overlay.
        if (await shareBalanceCardWithLegacyAndroidBridge(dataUrl, safeTarget)) {
            showToast(`Opening Instagram ${safeTarget === 'story' ? 'Story' : 'Feed'}...`, 'success');
            return true;
        }
        return false;
    }

    return shareBalanceCardImageExternally(
        dataUrl,
        safeTarget,
        safeTarget === 'story' ? 'Share this to your Instagram Story' : 'Share this to your Instagram Feed'
    );
}

window.shareBalanceCardToInstagram = shareBalanceCardToInstagram;
window.renderBalanceShareCardImage = renderBalanceShareCardImage;
window.renderBalanceShareCardVideo = renderBalanceShareCardVideo;
window.pbbShareImageUrlToDataUrl = pbbShareImageUrlToDataUrl;

async function awardBalanceSocialShareXP(shareKind, shareDestination, referenceId) {
    if (!window.currentUser?.id || !window.db?.points?.awardPoints) return null;
    const metadata = { shareKind, shareDestination };
    const shareStyleContext = shareKind === 'meal' ? 'nutrition' : shareKind;
    if (shareKind === 'workout' || shareKind === 'activity' || shareKind === 'pb' || shareKind === 'meal') {
        metadata.creativeVariant = PBB_SHARE_CREATIVE_VARIANT;
        metadata.overlayStyle = getBalanceShareOverlayStyle(shareStyleContext);
        if (pbbShareSupportsTextStyle(shareStyleContext)) {
            metadata.textStyle = getBalanceShareTextStyle(shareStyleContext);
        }
    }
    const result = await window.db.points.awardPoints(
        window.currentUser.id,
        'social_share',
        referenceId,
        metadata
    );
    if (result?.success) {
        if (typeof window.refreshLevelDisplay === 'function') window.refreshLevelDisplay();
        if (typeof window.refreshPointsDisplay === 'function') window.refreshPointsDisplay();
        if (typeof window.triggerXPBarRainbow === 'function') window.triggerXPBarRainbow();
        if (typeof window.refreshChallengeProgress === 'function') window.refreshChallengeProgress();
    }
    if (shareKind === 'workout'
        && shareDestination === 'balance_feed'
        && (result?.success || result?.alreadyAwarded)) {
        markWorkoutFeedShareUsedToday();
    }
    return result;
}
window.awardBalanceSocialShareXP = awardBalanceSocialShareXP;

function getCompletedWorkoutSocialShareReferenceId() {
    const data = completedWorkoutDataForShare || {};
    const firstSet = Array.isArray(data.sets) ? data.sets[0] : null;
    const existing = data.workoutId || data.workout_id || data.id || firstSet?.workout_id || firstSet?.id;
    if (existing) return existing;
    if (!window._pbbWorkoutSocialShareReferenceId) {
        window._pbbWorkoutSocialShareReferenceId = crypto.randomUUID();
    }
    return window._pbbWorkoutSocialShareReferenceId;
}

function getWorkoutInstagramShareStorageKey() {
    if (!window.currentUser?.id || !completedWorkoutDataForShare) return '';
    return `pbb_workout_instagram_share:${window.currentUser.id}:${getCompletedWorkoutSocialShareReferenceId()}`;
}

function loadWorkoutInstagramShareCompleted() {
    workoutInstagramShareCompleted = { story: false };
    const key = getWorkoutInstagramShareStorageKey();
    if (!key) return;
    try {
        const saved = JSON.parse(localStorage.getItem(key) || '{}');
        workoutInstagramShareCompleted.story = saved.story === true;
    } catch (_) {}
}

function renderWorkoutInstagramShareButton() {
    const btn = document.getElementById('share-workout-ig-story-btn');
    if (!btn) return;

    const completed = workoutInstagramShareCompleted.story === true;
    btn.disabled = completed;
    btn.style.opacity = '1';
    btn.style.background = completed
        ? 'linear-gradient(135deg, #dcfce7, #bbf7d0)'
        : 'linear-gradient(135deg, #ffffff, #fdf2f8)';
    btn.style.color = completed ? '#166534' : '#be185d';
    btn.style.webkitTextFillColor = completed ? '#166534' : '#be185d';
    btn.style.border = completed ? '1px solid #86efac' : 'none';
    btn.innerHTML = completed
        ? '<span style="font-size: 1rem; font-weight: 950;">&#10003;</span><span style="font-size: 1rem;">IG Story shared</span>'
        : '<span style="font-size: 0.9rem; font-weight: 950; letter-spacing: 0;">IG</span><span style="font-size: 1rem;">Story (+15 XP)</span>';
}

function markWorkoutInstagramShareCompleted() {
    workoutInstagramShareCompleted.story = true;
    const key = getWorkoutInstagramShareStorageKey();
    if (key) {
        try {
            localStorage.setItem(key, JSON.stringify(workoutInstagramShareCompleted));
        } catch (_) {}
    }
    renderWorkoutInstagramShareButton();
}

function clearWorkoutInstagramShareCompleted() {
    workoutInstagramShareCompleted.story = false;
    const key = getWorkoutInstagramShareStorageKey();
    if (key) {
        try {
            localStorage.setItem(key, JSON.stringify(workoutInstagramShareCompleted));
        } catch (_) {}
    }
    renderWorkoutInstagramShareButton();
}

async function shareWorkoutCardToInstagram() {
    if (!canUseBalanceInstagramShareTest()) {
        showToast('Instagram sharing is in test mode for now.', 'info');
        updateWorkoutInstagramShareVisibility();
        return;
    }

    if (!completedWorkoutDataForShare) {
        showToast('No workout data to share', 'error');
        return;
    }

    const btn = document.getElementById('share-workout-ig-story-btn');
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.72';
        btn.innerHTML = '<span style="font-size: 0.82rem; font-weight: 950; letter-spacing: 0;">IG</span><span style="font-size: 0.9rem;">Preparing...</span>';
    }

    try {
        if (!cachedWorkoutShareBase64 && cachedWorkoutShareFile) {
            cachedWorkoutShareBase64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(cachedWorkoutShareFile);
            });
        }

        if (!cachedWorkoutShareBase64) {
            openWorkoutCamera(async (file) => {
                if (!file) {
                    if (btn) {
                        btn.disabled = false;
                        btn.style.opacity = '1';
                        btn.innerHTML = originalHtml;
                    }
                    return;
                }
                await onWorkoutSharePhotoReady(file);
                showToast('Swipe to choose a style, then tap IG Story again.', 'info');
            }, 'Take a workout photo');
            return;
        }

        const cardPayload = buildWorkoutShareCardPayload();
        // Persist the handoff before iOS backgrounds/suspends the web view.
        // The native plugin can successfully open Instagram before its
        // promise continuation gets another chance to run in JavaScript.
        const opened = await shareBalanceCardToInstagram(cardPayload, 'story', {
            photoDataUrl: cachedWorkoutShareBase64,
            overlayStyle: getBalanceShareOverlayStyle('workout'),
            textStyle: getBalanceShareTextStyle('workout'),
            onSharePrepared: () => markWorkoutInstagramShareCompleted()
        });
        if (!opened) clearWorkoutInstagramShareCompleted();
        if (opened) {
            // `instagram_feed` is the legacy backend key for the independent Instagram XP lane.
            // This workout card now opens only in Instagram Story.
            const xpResult = await awardBalanceSocialShareXP(
                'workout',
                'instagram_feed',
                getCompletedWorkoutSocialShareReferenceId()
            );
            showToast(
                xpResult?.success ? 'Workout shared to Instagram Story! +15 XP' : 'Workout opened in Instagram Story. Today\'s Instagram XP is already claimed.',
                'success'
            );
        }
    } catch (error) {
        clearWorkoutInstagramShareCompleted();
        console.error('Error sharing workout card to Instagram:', error);
        showToast('Could not open Instagram Story. Please try again.', 'error');
    } finally {
        if (btn && !workoutInstagramShareCompleted.story) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.innerHTML = originalHtml;
        }
    }
}

let pendingPBShareData = null;
let pendingPBShareButtonIndex = null;

function ensurePBShareOptionsModal() {
    let modal = document.getElementById('pb-share-options-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'pb-share-options-modal';
    modal.style.cssText = 'display:none; position:fixed; inset:0; z-index:10095; background:rgba(15,23,42,0.72); align-items:flex-end; justify-content:center; padding:calc(16px + env(safe-area-inset-top, 0px)) 14px calc(16px + env(safe-area-inset-bottom, 0px)); box-sizing:border-box;';
    modal.innerHTML = `
        <div style="width:100%; max-width:460px; max-height:100%; overflow-y:auto; -webkit-overflow-scrolling:touch; overscroll-behavior:contain; background:white; border-radius:18px 18px 14px 14px; box-shadow:0 18px 50px rgba(0,0,0,0.35); padding:16px; box-sizing:border-box;">
             <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:14px;">
                <div style="min-width:0;">
                    <div style="font-size:0.72rem; font-weight:900; color:#be123c; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:4px;">Share PB</div>
                    <div id="pb-share-options-title" style="font-size:1.05rem; font-weight:950; color:#0f172a; line-height:1.2;"></div>
                    <div id="pb-share-options-detail" style="font-size:0.82rem; font-weight:750; color:#64748b; margin-top:4px;"></div>
                </div>
                 <button onclick="closePBShareOptions()" aria-label="Close share options" style="width:34px; height:34px; border:none; border-radius:50%; background:#f1f5f9; color:#334155; font-size:1.15rem; line-height:1; cursor:pointer; flex-shrink:0;">&times;</button>
             </div>
            <div id="pb-share-style-preview-wrap" style="display:none; width:100%; aspect-ratio:4/5; border-radius:16px; overflow:hidden; background:#0f172a; margin-bottom:10px; touch-action:pan-y;">
                <img id="pb-share-style-preview" alt="Personal best share preview" style="width:100%; height:100%; object-fit:cover; display:block; transition:opacity 0.18s ease;" />
            </div>
            <div id="pb-share-style-controls" style="display:none; background:#0f172a; border-radius:14px; padding:12px; margin-bottom:12px;"></div>
             <div style="display:flex; flex-direction:column; gap:10px;">
                <button data-pb-share-action="balance-feed" onclick="sharePendingPBToDestination('balance-feed')" style="width:100%; min-height:50px; border:none; border-radius:12px; background:#0f766e; color:white; font-size:0.95rem; font-weight:900; cursor:pointer;">Balance Feed</button>
                <button data-pb-share-action="instagram-story" onclick="sharePendingPBToDestination('instagram-story')" style="width:100%; min-height:50px; border:none; border-radius:12px; background:#be185d; color:white; font-size:0.95rem; font-weight:900; cursor:pointer;">Instagram Story</button>
                <button data-pb-share-action="instagram-feed" onclick="sharePendingPBToDestination('instagram-feed')" style="width:100%; min-height:50px; border:none; border-radius:12px; background:#4338ca; color:white; font-size:0.95rem; font-weight:900; cursor:pointer;">Instagram Feed</button>
            </div>
        </div>
    `;
    modal.addEventListener('click', function(event) {
        if (event.target === modal) closePBShareOptions();
    });
    document.body.appendChild(modal);
    return modal;
}

function openPBShareOptions(pbData, index) {
    if (!pbData) return;
    pendingPBShareData = pbData;
    pendingPBShareButtonIndex = typeof index === 'number' ? index : null;

    if (!canUseBalanceInstagramShareTest()) {
        sharePBToBalanceFeedOnly(pbData, pendingPBShareButtonIndex);
        return;
    }

    const modal = ensurePBShareOptionsModal();
    const title = document.getElementById('pb-share-options-title');
    const detail = document.getElementById('pb-share-options-detail');
    if (title) title.textContent = pbData.exercise || 'Personal best';
    if (detail) detail.textContent = pbbFormatPBShareValue(pbData);
    modal.style.display = 'flex';
    if (cachedWorkoutShareBase64) {
        renderBalanceShareStylePreview('pb', buildPBShareCardPayload(pbData), cachedWorkoutShareBase64, {
            previewImageId: 'pb-share-style-preview',
            previewWrapId: 'pb-share-style-preview-wrap',
            controlsId: 'pb-share-style-controls'
        });
    } else {
        openWorkoutCamera(async function(file) {
            if (!file) return;
            await onWorkoutSharePhotoReady(file);
            await renderBalanceShareStylePreview('pb', buildPBShareCardPayload(pbData), cachedWorkoutShareBase64, {
                previewImageId: 'pb-share-style-preview',
                previewWrapId: 'pb-share-style-preview-wrap',
                controlsId: 'pb-share-style-controls'
            });
        }, 'Take a selfie or gym photo for your PB share');
    }
}

function closePBShareOptions() {
    const modal = document.getElementById('pb-share-options-modal');
    if (modal) modal.style.display = 'none';
}

function markPBFeedShareDone() {
    if (pendingPBShareButtonIndex == null) return;
    const btn = document.getElementById(`share-pb-btn-${pendingPBShareButtonIndex}`);
    if (!btn) return;
    btn.textContent = 'Shared';
    btn.disabled = true;
    btn.style.opacity = '0.6';
}

async function sharePBToBalanceFeedOnly(pbData, index) {
    if (!cachedWorkoutShareBase64) {
        showToast('Take a selfie or gym photo for your PB share first.', 'info');
        openWorkoutCamera(async function(file) {
            if (!file) return;
            await onWorkoutSharePhotoReady(file);
            await sharePBToBalanceFeedOnly(pbData, index);
        }, 'Take a selfie or gym photo for your PB share');
        return;
    }

    const btn = typeof index === 'number' ? document.getElementById(`share-pb-btn-${index}`) : null;
    const originalText = btn ? btn.textContent : '';
    if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.72';
        btn.textContent = 'Sharing...';
    }

    try {
        const story = await sharePBCardToFeed(pbData, cachedWorkoutShareBase64);
        if (story) markPBFeedShareDone();
    } catch (error) {
        console.error('PB feed share failed:', error);
        showToast('Could not share that PB. Please try again.', 'error');
    } finally {
        if (btn && btn.textContent !== 'Shared') {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.textContent = originalText || 'Share';
        }
    }
}

async function sharePendingPBToDestination(destination) {
    if (!pendingPBShareData) return;
    if (destination !== 'balance-feed' && !canUseBalanceInstagramShareTest()) {
        showToast('Instagram sharing is in test mode for now.', 'info');
        closePBShareOptions();
        return;
    }

    if (!cachedWorkoutShareBase64) {
        showToast('Take a selfie or gym photo for your PB share first.', 'info');
        openWorkoutCamera(async file => {
            if (!file) return;
            await onWorkoutSharePhotoReady(file);
            await renderBalanceShareStylePreview('pb', buildPBShareCardPayload(pendingPBShareData), cachedWorkoutShareBase64, {
                previewImageId: 'pb-share-style-preview',
                previewWrapId: 'pb-share-style-preview-wrap',
                controlsId: 'pb-share-style-controls'
            });
            showToast('Swipe to choose a style, then choose where to share it.', 'info');
        }, 'Take a selfie or gym photo for your PB share');
        return;
    }

    const modal = ensurePBShareOptionsModal();
    const buttons = Array.from(modal.querySelectorAll('[data-pb-share-action]'));
    const activeButton = modal.querySelector(`[data-pb-share-action="${destination}"]`);
    const originalLabels = buttons.map(btn => btn.textContent);
    buttons.forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.72';
    });
    if (activeButton) activeButton.textContent = 'Preparing...';

    try {
        if (destination === 'balance-feed') {
            const story = await sharePBCardToFeed(pendingPBShareData, cachedWorkoutShareBase64);
            if (story) markPBFeedShareDone();
        } else {
            const cardPayload = buildPBShareCardPayload(pendingPBShareData);
            const instagramTarget = destination === 'instagram-feed' ? 'feed' : 'story';
            const opened = await shareBalanceCardToInstagram(cardPayload, instagramTarget, {
                photoDataUrl: cachedWorkoutShareBase64,
                overlayStyle: getBalanceShareOverlayStyle('pb'),
                textStyle: getBalanceShareTextStyle('pb')
            });
            if (opened && instagramTarget === 'feed') {
                const xpResult = await awardBalanceSocialShareXP(
                    'workout',
                    'instagram_feed',
                    pendingPBShareData.pbHistoryId || pendingPBShareData.historyId || pendingPBShareData.id || getCompletedWorkoutSocialShareReferenceId()
                );
                showToast(
                    xpResult?.success ? 'PB shared to Instagram Feed! +15 XP' : 'PB opened in Instagram. Today\'s workout IG Feed XP is already claimed.',
                    'success'
                );
            }
        }
        closePBShareOptions();
    } catch (error) {
        console.error('PB share destination failed:', error);
        showToast('Could not share that PB. Please try again.', 'error');
    } finally {
        buttons.forEach((btn, index) => {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.textContent = originalLabels[index];
        });
    }
}

window.shareWorkoutCardToInstagram = shareWorkoutCardToInstagram;
window.openPBShareOptions = openPBShareOptions;
window.closePBShareOptions = closePBShareOptions;
window.sharePendingPBToDestination = sharePendingPBToDestination;

// Share workout as an aesthetic card to feed — uses the cached gym photo
async function shareWorkoutCardToFeed() {
    if (!validateWorkoutDurationForShare()) return;

    if (!completedWorkoutDataForShare) {
        showToast('No workout data to share', 'error');
        return;
    }

    const cardPayload = buildWorkoutShareCardPayload();
    if (!cachedWorkoutShareBase64) {
        await beginPostWorkoutCompositeShare(cardPayload, 'workout');
        return;
    }

    pendingPostWorkoutCompositeShare = { cardPayload, type: 'workout', index: null };
    await sharePendingPostWorkoutCompositeToFeed();
}

// Handle the gym photo captured for workout card share (from file input - legacy/web fallback)
async function handleWorkoutCardPhotoCapture(event) {
    const file = event.target.files[0];
    if (!file) {
        window._pendingCardShare = false;
        return;
    }
    event.target.value = '';
    handleWorkoutCardPhotoCaptureFromFile(file);
}

// Handle workout card photo from a File object (used by both camera modal and file input)
async function handleWorkoutCardPhotoCaptureFromFile(file) {
    if (!file) {
        window._pendingCardShare = false;
        return;
    }

    const btn = document.getElementById('share-workout-card-btn');
    if (btn) {
        btn.disabled = true;
        btn.querySelector('span:last-child').textContent = 'Posting...';
    }

    try {
        // Build workout card data from completedWorkoutDataForShare
        const data = completedWorkoutDataForShare;
        const exerciseMap = {};
        (data.sets || []).forEach(set => {
            const name = set.exercise || set.exercise_name || 'Exercise';
            if (!exerciseMap[name]) {
                exerciseMap[name] = { name, sets: 0, bestKg: 0, bestReps: 0 };
            }
            exerciseMap[name].sets++;
            const kg = parseFloat(set.kg) || 0;
            const reps = parseInt(set.reps) || 0;
            if (kg > exerciseMap[name].bestKg) {
                exerciseMap[name].bestKg = kg;
                exerciseMap[name].bestReps = reps;
            } else if (kg === exerciseMap[name].bestKg && reps > exerciseMap[name].bestReps) {
                exerciseMap[name].bestReps = reps;
            }
        });

        const exercises = Object.values(exerciseMap).map(ex => ({
            name: ex.name,
            sets: ex.sets,
            best: ex.bestKg > 0 ? `${ex.sets}×${ex.bestReps} ${ex.bestKg}kg` : (ex.bestReps > 0 ? `${ex.sets}×${ex.bestReps}` : `${ex.sets} sets`)
        }));

        // Calculate total volume
        let totalVolume = 0;
        (data.sets || []).forEach(set => {
            const kg = parseFloat(set.kg) || 0;
            const reps = parseInt(set.reps) || 0;
            totalVolume += kg * reps;
        });

        // Build PBs data
        const pbs = (data.newPBs || []).map(pb => ({
            exercise: pb.exercise,
            type: pb.type,
            value: pb.value,
            reps: pb.reps,
            weight: pb.weight,
            improvement: pb.improvement
        }));

        const cardPayload = {
            card_type: 'workout',
            share_variant: PBB_SHARE_CREATIVE_VARIANT,
            share_overlay_style: getBalanceShareOverlayStyle('workout'),
            share_text_style: getBalanceShareTextStyle('workout'),
            workout_name: data.workoutName || 'Workout',
            duration: data.duration || pbbGetWorkoutShareDurationText(),
            exercises: exercises,
            total_sets: data.sets ? data.sets.length : 0,
            total_volume: totalVolume > 0 ? totalVolume.toLocaleString() + ' kg' : null,
            pbs: pbs.length > 0 ? pbs : null
        };

        // Create story with photo + workout card data
        const story = await dbHelpers.stories.create(window.currentUser.id, {
            media_type: 'workout_card',
            media_url: '',
            thumbnail_url: null,
            caption: JSON.stringify(cardPayload),
            duration: 5
        });

        console.log('Workout card story created:', story);

        const xpResult = await awardBalanceSocialShareXP('workout', 'balance_feed', story.id);
        if (xpResult?.success || xpResult?.alreadyAwarded) workoutPointsEarnedThisSession.story = true;

        // Update button to show success
        if (btn) {
            btn.style.background = 'rgba(68, 255, 68, 0.3)';
            btn.style.border = '1px solid rgba(68, 255, 68, 0.5)';
            btn.innerHTML = `<span style="font-size:1.3rem;">✅</span><span style="font-size:0.95rem;">${xpResult?.success ? 'Shared! +15 XP' : 'Shared!'}</span>`;
        }

        // Refresh feed if visible
        if (typeof loadPhotoFeed === 'function') {
            loadPhotoFeed('friends-photo-feed', 'friends-feed-empty');
        }

        showToast(xpResult?.success ? 'Workout shared to Balance Feed! +15 XP' : 'Workout shared. Today\'s Balance Feed XP is already claimed.', 'success');

    } catch (error) {
        console.error('Error sharing workout card:', error);
        showToast('Failed to share workout card. Please try again.', 'error');

        if (btn) {
            btn.disabled = false;
            btn.querySelector('span:last-child').textContent = getWorkoutFeedShareButtonLabel();
        }
    }

    window._pendingCardShare = false;
}

// Share a PB achievement card to feed
async function sharePBCardToFeed(pbData, photoDataUrl) {
    if (!pbData) throw new Error('No personal best was selected.');

    try {
        const cardPayload = buildPBShareCardPayload(pbData);
        const helpers = window.dbHelpers || (typeof dbHelpers !== 'undefined' ? dbHelpers : null);
        if (!window.currentUser || !window.currentUser.id) {
            throw new Error('Please log in before sharing a personal best.');
        }
        if (!helpers || !helpers.stories || typeof helpers.stories.create !== 'function') {
            throw new Error('Feed sharing is still loading. Please try again.');
        }

        let mediaUrl = '';
        if (photoDataUrl) {
            const compositeDataUrl = await renderBalanceShareCardImage(cardPayload, {
                target: 'feed',
                photoDataUrl,
                overlayStyle: getBalanceShareOverlayStyle('pb'),
                textStyle: getBalanceShareTextStyle('pb')
            });
            const compositeFile = postWorkoutShareFileFromDataUrl(compositeDataUrl, 'balance-pb-overlay.jpg');
            if (typeof uploadStoryMediaToBackblaze !== 'function') {
                throw new Error('Feed uploader is still loading. Please try again.');
            }
            const uploadData = await uploadStoryMediaToBackblaze(compositeFile, {
                userId: window.currentUser.id,
                storyId: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
                source: 'feed_pb_photo_overlay',
                preferDirectUpload: true
            });
            if (!uploadData?.url) throw new Error('The PB photo upload was not confirmed.');
            mediaUrl = uploadData.url;
            cardPayload.share_style = 'photo_overlay';
            cardPayload.share_overlay_style = getBalanceShareOverlayStyle('pb');
            cardPayload.share_text_style = getBalanceShareTextStyle('pb');
            cardPayload.share_caption = 'Personal best, captured in the moment.';
        }

        const story = await helpers.stories.create(window.currentUser.id, {
            media_type: 'workout_card',
            media_url: mediaUrl,
            thumbnail_url: mediaUrl || null,
            caption: JSON.stringify(cardPayload),
            duration: 5
        });

        if (!story || !story.id) {
            throw new Error('The PB post was not confirmed by the Feed.');
        }

        console.log('PB card story created:', story);

        const xpResult = await awardBalanceSocialShareXP('workout', 'balance_feed', story.id);
        if (xpResult?.success || xpResult?.alreadyAwarded) workoutPointsEarnedThisSession.story = true;

        // Refresh feed if visible
        if (typeof loadPhotoFeed === 'function') {
            loadPhotoFeed('friends-photo-feed', 'friends-feed-empty');
        }

        showToast(
            xpResult?.success ? 'PB shared to Balance Feed! +15 XP' : 'PB shared. Today\'s workout Feed XP is already claimed.',
            'success'
        );
        return story;

    } catch (error) {
        console.error('Error sharing PB card:', error);
        throw error;
    }
}

async function handleNutritionSharePhotoSelected(input) {
    const file = input?.files?.[0];
    if (!file) return;
    await useNutritionSharePhotoFile(file);
    input.value = '';
}

async function useNutritionSharePhotoFile(file) {
    if (!file) return;
    const label = document.getElementById('nutrition-share-photo-btn-text');
    try {
        const normalizedFile = typeof window.normalizeFeedImageUploadFile === 'function'
            ? await window.normalizeFeedImageUploadFile(file)
            : file;
        const preparedFile = typeof compressMealImage === 'function'
            ? await compressMealImage(normalizedFile)
            : normalizedFile;
        cachedNutritionShareBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = reject;
            reader.readAsDataURL(preparedFile);
        });
        if (label) label.textContent = 'Photo added, choose your colour and text layout';
        const cardPayload = await buildDailyNutritionInstagramPayload();
        await renderBalanceShareStylePreview('nutrition', cardPayload, cachedNutritionShareBase64, {
            previewImageId: 'nutrition-share-style-preview',
            previewWrapId: 'nutrition-share-style-preview-wrap',
            controlsId: 'nutrition-share-style-controls'
        });
        if (window.BalancePrivateShareStudio?.isEnabled?.()) {
            await window.BalancePrivateShareStudio.open({
                context: 'nutrition',
                photoDataUrl: cachedNutritionShareBase64,
                cardPayload,
                previewTarget: 'story',
                overlayStyle: getBalanceShareOverlayStyle('nutrition'),
                textStyle: getBalanceShareTextStyle('nutrition'),
                onFeed: async () => shareNutritionToFeed(),
                onInstagram: async () => shareNutritionToInstagram('story')
            });
        }
    } catch (error) {
        console.error('Could not prepare nutrition share photo:', error);
        showToast(error?.message || 'Could not use that photo. Please try another one.', 'error');
    }
}

function toggleNutritionSharePhotoSourceMenu(event) {
    event?.stopPropagation?.();
    const menu = document.getElementById('nutrition-share-photo-source-menu');
    const button = document.getElementById('nutrition-share-photo-btn');
    if (!menu) return;
    const isOpen = menu.style.display !== 'none';
    menu.style.display = isOpen ? 'none' : 'block';
    button?.setAttribute('aria-expanded', String(!isOpen));
}

function openNutritionSharePhotoSource(source) {
    const menu = document.getElementById('nutrition-share-photo-source-menu');
    const button = document.getElementById('nutrition-share-photo-btn');
    if (menu) menu.style.display = 'none';
    button?.setAttribute('aria-expanded', 'false');
    if (source === 'camera' && typeof openWorkoutCamera === 'function') {
        openWorkoutCamera(async file => {
            if (file) await useNutritionSharePhotoFile(file);
        }, 'Take a nutrition share photo');
        return;
    }
    document.getElementById(source === 'camera' ? 'nutrition-share-photo-camera-input' : 'nutrition-share-photo-gallery-input')?.click();
}

window.handleNutritionSharePhotoSelected = handleNutritionSharePhotoSelected;
window.toggleNutritionSharePhotoSourceMenu = toggleNutritionSharePhotoSourceMenu;
window.openNutritionSharePhotoSource = openNutritionSharePhotoSource;

// Share daily nutrition summary card to feed
async function shareNutritionToFeed() {
    if (!window.currentUser) {
        showToast('You must be logged in to share', 'error');
        return;
    }

    const btn = document.getElementById('share-nutrition-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span style="font-size:1rem;">🥗</span><span style="font-size:0.85rem;">Sharing...</span>';
    }

    try {
        const userId = window.currentUser.id;
        const today = getLocalDateString();

        // Load today's nutrition data
        const { data: dailyData, error: dailyError } = await window.supabaseClient
            .from('daily_nutrition')
            .select('*')
            .eq('user_id', userId)
            .eq('nutrition_date', today)
            .single();

        if (dailyError || !dailyData || !dailyData.total_calories) {
            showToast('Log some meals first before sharing!', 'info');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<span style="font-size:1rem;">🥗</span><span style="font-size:0.85rem;">Balance Feed (+15 XP)</span>';
            }
            return;
        }

        // Calculate score
        const scoreData = calculateNutritionScore(dailyData);
        const score = scoreData ? scoreData.total : 0;

        // Get meal count for today
        const { data: mealsData } = await window.supabaseClient
            .from('meal_logs')
            .select('id')
            .eq('user_id', userId)
            .eq('meal_date', today);

        const mealCount = mealsData ? mealsData.length : 0;

        // Get streak
        let streak = 0;
        try {
            const pointsData = await window.db?.points?.getPoints(userId);
            streak = pointsData?.current_streak || 0;
        } catch (e) {
            console.log('Could not get streak for nutrition card');
        }

        const cardPayload = {
            card_type: 'nutrition',
            share_overlay_style: getBalanceShareOverlayStyle('nutrition'),
            share_text_style: getBalanceShareTextStyle('nutrition'),
            score: score,
            calories: dailyData.total_calories || 0,
            calorie_goal: dailyData.calorie_goal || 2000,
            protein: dailyData.total_protein_g || 0,
            protein_goal: dailyData.protein_goal_g || 50,
            carbs: dailyData.total_carbs_g || 0,
            carbs_goal: dailyData.carbs_goal_g || 250,
            fat: dailyData.total_fat_g || 0,
            fat_goal: dailyData.fat_goal_g || 70,
            meal_count: mealCount,
            streak: streak
        };

        let mediaUrl = '';
        if (cachedNutritionShareBase64) {
            const compositeDataUrl = await renderBalanceShareCardImage(cardPayload, {
                target: 'feed',
                photoDataUrl: cachedNutritionShareBase64,
                overlayStyle: getBalanceShareOverlayStyle('nutrition'),
                textStyle: getBalanceShareTextStyle('nutrition')
            });
            const compositeFile = postWorkoutShareFileFromDataUrl(compositeDataUrl, 'balance-nutrition-overlay.jpg');
            if (typeof uploadStoryMediaToBackblaze !== 'function') {
                throw new Error('Feed uploader is still loading. Please try again.');
            }
            const uploadData = await uploadStoryMediaToBackblaze(compositeFile, {
                userId: window.currentUser.id,
                storyId: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
                source: 'feed_nutrition_photo_overlay',
                preferDirectUpload: true
            });
            if (!uploadData?.url) throw new Error('The nutrition overlay upload was not confirmed.');
            mediaUrl = uploadData.url;
            cardPayload.share_style = 'photo_overlay';
        }

        const story = await dbHelpers.stories.create(window.currentUser.id, {
            media_type: 'nutrition_card',
            media_url: mediaUrl,
            thumbnail_url: mediaUrl || null,
            caption: JSON.stringify(cardPayload),
            duration: 5
        });

        console.log('Nutrition card story created:', story);

        const xpResult = await awardBalanceSocialShareXP('meal', 'balance_feed', story.id);
        if (xpResult?.success && typeof markMealFeedShareUsedToday === 'function') {
            markMealFeedShareUsedToday();
        }

        // Update button to show success
        if (btn) {
            btn.style.background = 'rgba(99, 102, 241, 0.2)';
            btn.style.border = '1px solid rgba(99, 102, 241, 0.4)';
            btn.innerHTML = `<span style="font-size:1rem;">✅</span><span style="font-size:0.85rem;">${xpResult?.success ? 'Shared! +15 XP' : 'Shared!'}</span>`;
        }

        // Refresh feed if visible
        if (typeof loadPhotoFeed === 'function') {
            loadPhotoFeed('friends-photo-feed', 'friends-feed-empty');
        }

        showToast(xpResult?.success ? 'Nutrition shared to Balance Feed! +15 XP' : 'Nutrition shared. Today\'s food Feed XP is already claimed.', 'success');

    } catch (error) {
        console.error('Error sharing nutrition card:', error);
        showToast('Failed to share. Please try again.', 'error');

        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span style="font-size:1rem;">🥗</span><span style="font-size:0.85rem;">Balance Feed (+15 XP)</span>';
        }
    }
}

async function buildDailyNutritionInstagramPayload() {
    if (!window.currentUser) throw new Error('You must be logged in to share');

    const userId = window.currentUser.id;
    const today = getLocalDateString();
    const { data: dailyData, error: dailyError } = await window.supabaseClient
        .from('daily_nutrition')
        .select('*')
        .eq('user_id', userId)
        .eq('nutrition_date', today)
        .single();

    if (dailyError || !dailyData || !dailyData.total_calories) {
        throw new Error('Log some meals first before sharing');
    }

    const scoreData = calculateNutritionScore(dailyData);
    const { data: mealsData } = await window.supabaseClient
        .from('meal_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('meal_date', today);

    let streak = 0;
    try {
        const pointsData = await window.db?.points?.getPoints(userId);
        streak = pointsData?.current_streak || 0;
    } catch (e) {
        console.log('Could not get streak for nutrition Instagram card');
    }

    return {
        card_type: 'nutrition',
        share_overlay_style: getBalanceShareOverlayStyle('nutrition'),
        share_text_style: getBalanceShareTextStyle('nutrition'),
        score: scoreData ? scoreData.total : 0,
        calories: dailyData.total_calories || 0,
        calorie_goal: dailyData.calorie_goal || 2000,
        protein: dailyData.total_protein_g || 0,
        protein_goal: dailyData.protein_goal_g || 50,
        carbs: dailyData.total_carbs_g || 0,
        carbs_goal: dailyData.carbs_goal_g || 250,
        fat: dailyData.total_fat_g || 0,
        fat_goal: dailyData.fat_goal_g || 70,
        meal_count: mealsData ? mealsData.length : 0,
        streak: streak,
        share_reference_id: dailyData.id || mealsData?.[0]?.id || null
    };
}

async function shareNutritionToInstagram(target = 'story') {
    if (!window.currentUser) {
        showToast('You must be logged in to share', 'error');
        return;
    }

    const btn = document.getElementById('share-nutrition-ig-story-btn');
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.72';
        btn.innerHTML = '<span style="font-size:0.82rem;font-weight:950;">IG</span><span style="font-size:0.85rem;">Preparing...</span>';
    }

    try {
        const cardPayload = await buildDailyNutritionInstagramPayload();
        const safeTarget = target === 'feed' ? 'feed' : 'story';
        const opened = await shareBalanceCardToInstagram(cardPayload, safeTarget, {
            photoDataUrl: cachedNutritionShareBase64 || null,
            overlayStyle: getBalanceShareOverlayStyle('nutrition'),
            textStyle: getBalanceShareTextStyle('nutrition')
        });
        if (opened) {
            const xpResult = await awardBalanceSocialShareXP(
                'meal',
                'instagram_feed',
                cardPayload.share_reference_id || crypto.randomUUID()
            );
            if (xpResult?.success && typeof markMealInstagramShareUsedToday === 'function') {
                markMealInstagramShareUsedToday();
            }
            showToast(
                xpResult?.success ? 'Nutrition shared to Instagram Story! +15 XP' : 'Nutrition opened in Instagram Story. Today\'s food IG XP is already claimed.',
                'success'
            );
        }
    } catch (error) {
        console.error('Error sharing nutrition to Instagram:', error);
        showToast(error?.message || 'Could not open Instagram share.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.innerHTML = originalHtml || '<span style="font-size:0.82rem;font-weight:950;">IG</span><span style="font-size:0.85rem;">Story</span>';
        }
    }
}

window.shareNutritionToInstagram = shareNutritionToInstagram;

function getLevelUpShareKey(userId, level) {
    return `level_up_feed_share:${userId}:${level}`;
}

function getLevelUpShareValue(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
}

function setLevelUpShareValue(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* ignore storage errors */ }
}

function clearLevelUpShareValue(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore storage errors */ }
}

function levelUpCaptionMatches(caption, level) {
    try {
        const payload = typeof caption === 'string' ? JSON.parse(caption) : caption;
        return payload?.card_type === 'level_up' && Number(payload?.level) === Number(level);
    } catch (e) {
        return false;
    }
}

async function hasExistingLevelUpFeedPost(userId, level) {
    try {
        const stories = await dbHelpers.stories.getUserStories(userId);
        return (stories || []).some(story =>
            story?.media_type === 'level_up_card' && levelUpCaptionMatches(story.caption, level)
        );
    } catch (e) {
        console.warn('Could not check existing level-up feed post:', e);
        return false;
    }
}

// Share level-up achievement card to feed
async function shareLevelUpToFeed(levelData) {
    if (!window.currentUser || !levelData) return;

    const level = levelData.newLevel || levelData.level;
    if (!level) return;

    if (!window.__levelUpFeedSharePending) {
        window.__levelUpFeedSharePending = new Set();
    }

    const shareKey = getLevelUpShareKey(window.currentUser.id, level);
    if (window.__levelUpFeedSharePending.has(shareKey)) {
        console.log('Level-up feed share already pending:', shareKey);
        return;
    }
    if (getLevelUpShareValue(shareKey) === 'shared') {
        console.log('Level-up feed share already completed:', shareKey);
        return;
    }

    window.__levelUpFeedSharePending.add(shareKey);
    setLevelUpShareValue(shareKey, 'pending');

    try {
        if (await hasExistingLevelUpFeedPost(window.currentUser.id, level)) {
            setLevelUpShareValue(shareKey, 'shared');
            console.log('Level-up feed post already exists:', { level });
            return;
        }

        // Get streak
        let streak = 0;
        try {
            const session = await window.authHelpers?.getSession();
            if (session?.user) {
                const pointsData = await window.db?.points?.getPoints(window.currentUser.id);
                streak = pointsData?.current_streak || 0;
            }
        } catch (e) {
            console.log('Could not get streak for level-up card');
        }

        const cardPayload = {
            card_type: 'level_up',
            level: level,
            title: levelData.title || getLevelTitle(level),
            previous_level: levelData.previousLevel || null,
            previous_title: levelData.previousLevel ? getLevelTitle(levelData.previousLevel) : null,
            lifetime_xp: levelData.lifetimePoints || 0,
            streak: streak
        };

        const story = await dbHelpers.stories.create(window.currentUser.id, {
            media_type: 'level_up_card',
            media_url: '',
            thumbnail_url: null,
            caption: JSON.stringify(cardPayload),
            duration: 5
        });

        console.log('Level-up card story created:', story);
        setLevelUpShareValue(shareKey, 'shared');

        // Refresh feed if visible
        if (typeof loadPhotoFeed === 'function') {
            loadPhotoFeed('friends-photo-feed', 'friends-feed-empty');
        }

        showToast('Level up shared to feed!', 'success');

    } catch (error) {
        console.error('Error sharing level-up card:', error);
        clearLevelUpShareValue(shareKey);
        showToast('Failed to share level up. Please try again.', 'error');
    } finally {
        window.__levelUpFeedSharePending.delete(shareKey);
    }
}

// ============================================
// ACTIVITY LOGGING SYSTEM
// Supports fitness classes, boxing, tennis, swimming, running, cycling, walking, yoga, dance, etc.
// ============================================

const ACTIVITY_TYPES = [
    { key: 'fitness_class', label: 'Fitness Class', emoji: '🏋️', color: '#dc2626' },
    { key: 'boxing',        label: 'Boxing',        emoji: '🥊', color: '#b91c1c' },
    { key: 'tennis',        label: 'Tennis',        emoji: '🎾', color: '#65a30d' },
    { key: 'swimming',      label: 'Swimming',      emoji: '🏊', color: '#0284c7' },
    { key: 'running',       label: 'Running',       emoji: '🏃', color: '#ea580c' },
    { key: 'cycling',       label: 'Cycling',       emoji: '🚴', color: '#7c3aed' },
    { key: 'walking',       label: 'Walking',       emoji: '🚶', color: '#059669' },
    { key: 'yoga',          label: 'Yoga',          emoji: '🧘', color: '#c026d3' },
    { key: 'dance',         label: 'Dance',         emoji: '💃', color: '#e11d48' },
    { key: 'hiking',        label: 'Hiking',        emoji: '🥾', color: '#854d0e' },
    { key: 'pilates',       label: 'Pilates',       emoji: '🤸', color: '#0d9488' },
    { key: 'martial_arts',  label: 'Martial Arts',  emoji: '🥋', color: '#1e293b' },
    { key: 'other',         label: 'Other',         emoji: '⚡', color: '#64748b' }
];

const MOVE_YOUR_WAY_PILOT_EMAIL = 'shannonbirch@cocospersonaltraining.com';
const MOVE_YOUR_WAY_PILOT_USER_ID = '00a6605e-8edb-4917-85ba-24a23f179059';
function isMoveYourWayPilotUser() {
    const user = window.currentUser || {};
    return String(user.id || '') === MOVE_YOUR_WAY_PILOT_USER_ID ||
        String(user.email || '').trim().toLowerCase() === MOVE_YOUR_WAY_PILOT_EMAIL;
}
window.isMoveYourWayPilotUser = isMoveYourWayPilotUser;

window.showFitbitImportedActivityPrompt = async function() {
    if (!isMoveYourWayPilotUser() || !window.currentUser || !window.dbHelpers?.activityLogs?.getRecentImported) return;
    try {
        const imported = await window.dbHelpers.activityLogs.getRecentImported(window.currentUser.id, 'fitbit', 1);
        const activity = imported[0];
        if (!activity) return;
        const metadata = activity.source_metadata || {};
        const distance = Number(metadata.distance || 0);
        const unit = metadata.distance_unit || 'km';
        const distanceText = distance > 0 ? `${distance.toFixed(distance < 10 ? 1 : 0)} ${unit} ` : '';
        const label = activity.activity_label || activity.activity_type || 'activity';
        const prompt = document.createElement('div');
        prompt.style.cssText = 'position:fixed; left:16px; right:16px; bottom:calc(84px + env(safe-area-inset-bottom, 0px)); z-index:10050; padding:16px; border-radius:18px; background:var(--card-bg); color:var(--text-main); border:1px solid var(--border); box-shadow:0 16px 40px rgba(0,0,0,.28);';
        prompt.innerHTML = `<div style="font-weight:800; font-size:1rem;">${distanceText}${label.toLowerCase()} imported</div><div style="font-size:.85rem; color:var(--text-muted); margin-top:4px;">Add a photo or caption?</div><div style="display:flex; gap:8px; margin-top:13px;"><button data-action="add" style="flex:1; border:0; border-radius:11px; padding:11px; background:#0ea5e9; color:white; font-weight:800;">Add details</button><button data-action="dismiss" style="border:0; border-radius:11px; padding:11px 14px; background:var(--border); color:var(--text-main); font-weight:700;">Not now</button></div>`;
        prompt.querySelector('[data-action="dismiss"]').onclick = () => prompt.remove();
        prompt.querySelector('[data-action="add"]').onclick = () => {
            prompt.remove();
            openLogActivityForm({ activityType: activity.activity_type, duration: activity.duration_minutes, label: activity.activity_label, notes: `Imported from Fitbit: ${activity.activity_label || 'activity'}` });
        };
        document.body.appendChild(prompt);
    } catch (error) {
        console.warn('Could not show Fitbit imported-activity prompt:', error);
    }
};

window.openImportedActivityForSharing = function(activity) {
    if (!activity) return;
    const typeInfo = ACTIVITY_TYPES.find(t => t.key === activity.activity_type) || ACTIVITY_TYPES[ACTIVITY_TYPES.length - 1];
    const metadata = activity.source_metadata || {};
    savedActivityData = {
        id: activity.id,
        activity_type: activity.activity_type,
        activity_label: activity.activity_label || typeInfo.label,
        duration: activity.duration_minutes,
        intensity: activity.intensity || 'moderate',
        calories: activity.estimated_calories || 0,
        emoji: typeInfo.emoji,
        color: typeInfo.color,
        xpEligible: false,
        venueVerifiable: false,
        venueType: null,
        photoBase64: null,
        photoMimeType: null,
        sourceMetadata: metadata,
        source: activity.source || null,
        isImportedActivity: activity.source === 'fitbit' || activity.source === 'native_health',
        sharePromptHandled: Boolean(metadata.share_prompt_handled || activity.shared_to_feed),
        routePolyline: metadata.route_polyline || null,
        distanceKm: Number(metadata.distance_km || 0) || null,
        includeRoute: Boolean(metadata.route_polyline),
        activityIds: Array.isArray(activity.activityIds) ? activity.activityIds : [activity.id],
        activityMetadataById: activity.activityMetadataById || {}
    };
    showActivitySuccess(savedActivityData);
};

async function markImportedActivitySharePromptHandled(reason) {
    if (!savedActivityData?.isImportedActivity || savedActivityData.sharePromptHandled) return false;
    const activityIds = (savedActivityData.activityIds || [savedActivityData.id]).filter(Boolean);
    if (!activityIds.length) return false;

    savedActivityData.sharePromptHandled = true;
    window.pbbPendingImportedActivity = null;
    window.dispatchEvent(new CustomEvent('pbb:imported-activity-updated'));
    window.pbbNextSteps?.refresh?.();

    const handledAt = new Date().toISOString();
    await Promise.all(activityIds.map(id => {
        const existingMetadata = savedActivityData.activityMetadataById?.[id] || savedActivityData.sourceMetadata || {};
        return window.dbHelpers?.activityLogs?.update(id, {
            source_metadata: {
                ...existingMetadata,
                share_prompt_handled: reason || 'dismissed',
                share_prompt_handled_at: handledAt
            }
        });
    }));
    if (typeof window.refreshImportedActivityHomeCard === 'function') {
        await window.refreshImportedActivityHomeCard();
    }
    return true;
}
window.markImportedActivitySharePromptHandled = markImportedActivitySharePromptHandled;

// MET values for calorie estimation (Metabolic Equivalent of Task)
// Source: Compendium of Physical Activities
const ACTIVITY_MET_VALUES = {
    walking:        { light: 2.5, moderate: 3.5, vigorous: 5.0 },
    running:        { light: 6.0, moderate: 8.0, vigorous: 11.0 },
    cycling:        { light: 4.0, moderate: 6.8, vigorous: 10.0 },
    swimming:       { light: 4.5, moderate: 6.0, vigorous: 9.8 },
    boxing:         { light: 5.5, moderate: 7.8, vigorous: 12.0 },
    tennis:         { light: 5.0, moderate: 7.3, vigorous: 10.0 },
    yoga:           { light: 2.5, moderate: 3.0, vigorous: 4.0 },
    dance:          { light: 3.5, moderate: 5.5, vigorous: 7.8 },
    pilates:        { light: 3.0, moderate: 4.0, vigorous: 5.0 },
    fitness_class:  { light: 4.5, moderate: 6.5, vigorous: 9.0 },
    hiking:         { light: 4.5, moderate: 6.0, vigorous: 8.0 },
    martial_arts:   { light: 5.0, moderate: 7.0, vigorous: 10.3 },
    other:          { light: 3.5, moderate: 5.0, vigorous: 7.0 }
};

function estimateCaloriesBurned(activityType, intensityLevel, durationMinutes, userWeightKg) {
    const mets = ACTIVITY_MET_VALUES[activityType] || ACTIVITY_MET_VALUES.other;
    const met = mets[intensityLevel] || mets.moderate;
    const hours = durationMinutes / 60;
    return Math.round(met * userWeightKg * hours);
}

// XP eligibility check for activities
function isActivityXPEligible(activityType, hasPhoto, venueVerifiable) {
    if (!hasPhoto) return false;
    // Walks/runs/hikes only get XP with a verifiable venue (treadmill, track, etc.)
    const outdoorOnlyTypes = ['walking', 'running', 'hiking'];
    if (outdoorOnlyTypes.includes(activityType)) {
        return venueVerifiable === true;
    }
    // All other activities with a verifiable venue photo get XP
    return venueVerifiable === true;
}

// Activity form state
let activityFormState = {
    selectedType: null,
    duration: 30,
    intensity: 'moderate',
    photoBase64: null,
    photoMimeType: null,
    userWeightKg: 70 // default, will be loaded from quiz_results
};

// Saved activity data for sharing after save
let savedActivityData = null;
let activityGuidedStep = 1;

const BALANCE_ROUTE_ACTIVITY_TYPES = new Set(['walking', 'running', 'cycling', 'hiking']);
const BALANCE_ROUTE_STORAGE_KEY = 'balance_active_route_v1';
let balanceRouteTracker = {
    active: false,
    startedAt: null,
    stoppedAt: null,
    points: [],
    distanceMeters: 0,
    nativePlugin: null,
    webWatchId: null,
    timerId: null,
    error: null
};

function balanceRouteDistanceMeters(a, b) {
    const toRadians = value => value * Math.PI / 180;
    const lat1 = toRadians(a.latitude);
    const lat2 = toRadians(b.latitude);
    const dLat = lat2 - lat1;
    const dLon = toRadians(b.longitude - a.longitude);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function encodeBalanceRoutePolyline(points) {
    let lastLat = 0;
    let lastLon = 0;
    let encoded = '';
    const encodeValue = value => {
        let shifted = value < 0 ? ~(value << 1) : value << 1;
        let output = '';
        while (shifted >= 0x20) {
            output += String.fromCharCode((0x20 | (shifted & 0x1f)) + 63);
            shifted >>= 5;
        }
        return output + String.fromCharCode(shifted + 63);
    };
    points.forEach(point => {
        const lat = Math.round(Number(point.latitude) * 1e5);
        const lon = Math.round(Number(point.longitude) * 1e5);
        encoded += encodeValue(lat - lastLat) + encodeValue(lon - lastLon);
        lastLat = lat;
        lastLon = lon;
    });
    return encoded;
}

function persistBalanceRouteTracker() {
    try {
        if (!balanceRouteTracker.startedAt) {
            localStorage.removeItem(BALANCE_ROUTE_STORAGE_KEY);
            return;
        }
        localStorage.setItem(BALANCE_ROUTE_STORAGE_KEY, JSON.stringify({
            active: balanceRouteTracker.active,
            startedAt: balanceRouteTracker.startedAt,
            stoppedAt: balanceRouteTracker.stoppedAt,
            points: balanceRouteTracker.points.slice(-5000),
            distanceMeters: balanceRouteTracker.distanceMeters
        }));
    } catch (error) {
        console.warn('[BalanceRoute] Could not persist route progress:', error);
    }
}

function updateBalanceRouteUI() {
    const section = document.getElementById('activity-route-section');
    const eligible = BALANCE_ROUTE_ACTIVITY_TYPES.has(activityFormState.selectedType);
    if (section) section.style.display = eligible ? 'block' : 'none';

    const button = document.getElementById('activity-route-toggle-btn');
    const status = document.getElementById('activity-route-status');
    const distance = document.getElementById('activity-route-distance');
    const duration = document.getElementById('activity-route-duration');
    if (button) {
        button.textContent = balanceRouteTracker.active ? 'Stop route recording' : (balanceRouteTracker.points.length > 1 ? 'Record route again' : 'Start route recording');
        button.style.background = balanceRouteTracker.active ? '#a33b32' : 'linear-gradient(100deg,var(--activity-accent),var(--activity-action))';
        button.style.color = balanceRouteTracker.active ? '#ffffff' : '#17130d';
    }
    if (status) {
        const nativeRouteRecorder = !!window.Capacitor?.Plugins?.BackgroundGeolocation;
        status.textContent = balanceRouteTracker.active
            ? nativeRouteRecorder
                ? 'Balance is recording your route. You can lock your phone and keep moving.'
                : 'Balance is recording your route. Keep this page open while you move.'
            : balanceRouteTracker.points.length > 1
                ? 'Route ready. Your photo and sharing choices come after you save.'
                : 'Balance uses your phone GPS to record the route you choose.';
    }
    if (distance) distance.textContent = `${(balanceRouteTracker.distanceMeters / 1000).toFixed(2)} km`;
    if (duration) {
        const end = balanceRouteTracker.active ? Date.now() : (balanceRouteTracker.stoppedAt || Date.now());
        const seconds = balanceRouteTracker.startedAt ? Math.max(0, Math.floor((end - balanceRouteTracker.startedAt) / 1000)) : 0;
        duration.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }
    const guidedNext = document.getElementById('activity-guided-next-btn');
    if (guidedNext && activityGuidedStep === 2) {
        guidedNext.textContent = balanceRouteTracker.active ? 'Stop GPS & review' : 'Next · Review';
    }
}

function acceptBalanceRouteLocation(rawLocation) {
    if (!balanceRouteTracker.active || !rawLocation) return;
    const point = {
        latitude: Number(rawLocation.latitude ?? rawLocation.coords?.latitude),
        longitude: Number(rawLocation.longitude ?? rawLocation.coords?.longitude),
        accuracy: Number(rawLocation.accuracy ?? rawLocation.coords?.accuracy ?? 999),
        altitude: rawLocation.altitude ?? rawLocation.coords?.altitude ?? null,
        time: Number(rawLocation.time ?? rawLocation.timestamp ?? Date.now())
    };
    if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || point.accuracy > 80) return;

    const previous = balanceRouteTracker.points[balanceRouteTracker.points.length - 1];
    if (previous) {
        const segment = balanceRouteDistanceMeters(previous, point);
        const seconds = Math.max(1, (point.time - previous.time) / 1000);
        const maxSpeed = activityFormState.selectedType === 'cycling' ? 30 : 15;
        if (segment < 3 || segment / seconds > maxSpeed) return;
        balanceRouteTracker.distanceMeters += segment;
    }
    balanceRouteTracker.points.push(point);
    persistBalanceRouteTracker();
    updateBalanceRouteUI();
}

async function startBalanceRouteTracking() {
    if (!BALANCE_ROUTE_ACTIVITY_TYPES.has(activityFormState.selectedType)) {
        showToast('Choose Walking, Running, Cycling or Hiking first', 'error');
        return false;
    }
    balanceRouteTracker = {
        active: true,
        startedAt: Date.now(),
        stoppedAt: null,
        points: [],
        distanceMeters: 0,
        nativePlugin: null,
        webWatchId: null,
        timerId: null,
        error: null
    };
    updateBalanceRouteUI();
    persistBalanceRouteTracker();

    try {
        const nativePlugin = window.Capacitor?.Plugins?.BackgroundGeolocation;
        if (nativePlugin && typeof nativePlugin.start === 'function') {
            balanceRouteTracker.nativePlugin = nativePlugin;
            await nativePlugin.start({
                backgroundTitle: 'Balance route recording',
                backgroundMessage: 'Balance is recording your walk, run or ride.',
                requestPermissions: true,
                stale: false,
                distanceFilter: 8
            }, (location, error) => {
                if (error) {
                    balanceRouteTracker.error = error.code || error.message || 'Location unavailable';
                    updateBalanceRouteUI();
                    return;
                }
                acceptBalanceRouteLocation(location);
            });
        } else if (navigator.geolocation) {
            balanceRouteTracker.webWatchId = navigator.geolocation.watchPosition(
                position => acceptBalanceRouteLocation(position),
                error => {
                    balanceRouteTracker.error = error.message || 'Location unavailable';
                    updateBalanceRouteUI();
                },
                { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
            );
        } else {
            throw new Error('Location tracking is unavailable on this device');
        }
        balanceRouteTracker.timerId = setInterval(updateBalanceRouteUI, 1000);
        showToast('Balance route recording started', 'success');
        return true;
    } catch (error) {
        console.error('[BalanceRoute] Could not start tracking:', error);
        balanceRouteTracker.active = false;
        balanceRouteTracker.error = error.message || 'Location permission is required';
        persistBalanceRouteTracker();
        updateBalanceRouteUI();
        showToast('Turn on location access to record your route', 'error');
        return false;
    }
}

async function stopBalanceRouteTracking(options = {}) {
    if (balanceRouteTracker.nativePlugin) {
        try { await balanceRouteTracker.nativePlugin.stop(); } catch (error) { console.warn('[BalanceRoute] Native stop failed:', error); }
    }
    if (balanceRouteTracker.webWatchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(balanceRouteTracker.webWatchId);
    }
    if (balanceRouteTracker.timerId) clearInterval(balanceRouteTracker.timerId);
    if (balanceRouteTracker.startedAt) {
        balanceRouteTracker.stoppedAt = Date.now();
        activityFormState.duration = Math.max(1, Math.round((balanceRouteTracker.stoppedAt - balanceRouteTracker.startedAt) / 60000));
        const durationDisplay = document.getElementById('activity-duration-display');
        if (durationDisplay) durationDisplay.textContent = String(activityFormState.duration);
        updateActivityCalories();
    }
    balanceRouteTracker.active = false;
    balanceRouteTracker.nativePlugin = null;
    balanceRouteTracker.webWatchId = null;
    balanceRouteTracker.timerId = null;
    persistBalanceRouteTracker();
    updateBalanceRouteUI();
    if (!options.silent) {
        showToast(balanceRouteTracker.points.length > 1 ? 'Route recorded by Balance' : 'Route stopped before enough GPS points were recorded', balanceRouteTracker.points.length > 1 ? 'success' : 'error');
    }
    return balanceRouteTracker.points.length > 1;
}

async function toggleBalanceRouteTracking() {
    return balanceRouteTracker.active ? stopBalanceRouteTracking() : startBalanceRouteTracking();
}
window.toggleBalanceRouteTracking = toggleBalanceRouteTracking;

function updateActivityGuidedReview() {
    const typeInfo = ACTIVITY_TYPES.find(type => type.key === activityFormState.selectedType) || ACTIVITY_TYPES[ACTIVITY_TYPES.length - 1];
    const label = document.getElementById('activity-label-input')?.value.trim() || typeInfo.label;
    const intensityLabels = { light: 'Easy', moderate: 'Steady', vigorous: 'Hard' };
    const calories = estimateCaloriesBurned(
        activityFormState.selectedType || 'other',
        activityFormState.intensity,
        activityFormState.duration,
        activityFormState.userWeightKg
    );
    const hasRoute = balanceRouteTracker.active || balanceRouteTracker.points.length > 1;
    const emoji = document.getElementById('activity-guided-review-emoji');
    const name = document.getElementById('activity-guided-review-name');
    const duration = document.getElementById('activity-guided-review-duration');
    const intensity = document.getElementById('activity-guided-review-intensity');
    const gps = document.getElementById('activity-guided-review-gps');
    const calorieValue = document.getElementById('activity-guided-review-calories');
    if (emoji) emoji.textContent = typeInfo.emoji;
    if (name) name.textContent = label;
    if (duration) duration.textContent = activityFormState.duration + ' min';
    if (intensity) intensity.textContent = intensityLabels[activityFormState.intensity] || 'Steady';
    if (gps) gps.textContent = hasRoute ? (balanceRouteTracker.distanceMeters / 1000).toFixed(2) + ' km' : 'Off';
    if (calorieValue) calorieValue.textContent = String(calories);
}

function setActivityGuidedStep(step) {
    activityGuidedStep = Math.max(1, Math.min(3, Number(step) || 1));
    [1, 2, 3].forEach(number => {
        const section = document.getElementById('activity-guided-step-' + number);
        if (section) section.style.display = number === activityGuidedStep ? 'block' : 'none';
    });
    document.querySelectorAll('#activity-guided-progress span').forEach((segment, index) => {
        segment.classList.toggle('is-active', index < activityGuidedStep);
    });
    const progress = document.getElementById('activity-guided-progress');
    if (progress) progress.setAttribute('aria-label', 'Step ' + activityGuidedStep + ' of 3');
    const backButton = document.getElementById('activity-guided-back-btn');
    const nextButton = document.getElementById('activity-guided-next-btn');
    const saveButton = document.getElementById('activity-save-btn');
    if (backButton) backButton.style.display = activityGuidedStep > 1 ? 'block' : 'none';
    if (nextButton) {
        nextButton.style.display = activityGuidedStep < 3 ? 'block' : 'none';
        nextButton.disabled = activityGuidedStep === 1 && !activityFormState.selectedType;
        nextButton.textContent = activityGuidedStep === 1
            ? (activityFormState.selectedType ? 'Next · Add details' : 'Choose an activity')
            : (balanceRouteTracker.active ? 'Stop GPS & review' : 'Next · Review');
    }
    if (saveButton) {
        saveButton.style.display = activityGuidedStep === 3 ? 'block' : 'none';
        saveButton.disabled = false;
        saveButton.textContent = 'Save activity';
    }
    if (activityGuidedStep === 3) updateActivityGuidedReview();
    const view = document.getElementById('view-log-activity');
    if (view) view.scrollTo({ top: 0, behavior: 'smooth' });
}
window.setActivityGuidedStep = setActivityGuidedStep;

async function advanceActivityGuidedStep() {
    if (activityGuidedStep === 1 && !activityFormState.selectedType) {
        showToast('Choose an activity first', 'info');
        return;
    }
    if (activityGuidedStep === 2 && balanceRouteTracker.active) {
        const button = document.getElementById('activity-guided-next-btn');
        if (button) {
            button.disabled = true;
            button.textContent = 'Finishing GPS route...';
        }
        await stopBalanceRouteTracking({ silent: true });
    }
    setActivityGuidedStep(activityGuidedStep + 1);
}
window.advanceActivityGuidedStep = advanceActivityGuidedStep;

function previousActivityGuidedStep() {
    setActivityGuidedStep(activityGuidedStep - 1);
}
window.previousActivityGuidedStep = previousActivityGuidedStep;

function toggleActivityTypeChoices() {
    const grid = document.getElementById('activity-type-grid');
    const shouldShow = !grid?.classList.contains('is-expanded');
    grid?.classList.toggle('is-expanded', shouldShow);
    const button = document.getElementById('activity-type-more-btn');
    if (button) button.textContent = shouldShow ? 'Show fewer activities' : 'More activities';
}
window.toggleActivityTypeChoices = toggleActivityTypeChoices;

function openLogActivityForm(prefill = null) {
    const activityPrefill = prefill && typeof prefill === 'object' ? prefill : {};
    const prefillDuration = parseInt(activityPrefill.durationMinutes || activityPrefill.duration, 10);
    const initialDuration = Number.isFinite(prefillDuration) ? Math.max(5, Math.min(300, prefillDuration)) : 30;
    const initialIntensity = ['light', 'moderate', 'vigorous'].includes(activityPrefill.intensity)
        ? activityPrefill.intensity
        : 'moderate';
    const initialType = activityPrefill.activityType || activityPrefill.type || null;

    hideAllAppViews();
    document.getElementById('view-log-activity').style.display = 'block';
    document.querySelector('.bottom-nav').style.display = 'none';

    // Push navigation state for Android back button
    pushNavigationState('view-log-activity', () => closeLogActivity());

    // Reset form state
    activityFormState = {
        selectedType: initialType,
        duration: initialDuration,
        intensity: initialIntensity,
        photoBase64: null,
        photoMimeType: null,
        userWeightKg: 70
    };
    savedActivityData = null;
    if (!balanceRouteTracker.active) {
        balanceRouteTracker = {
            active: false,
            startedAt: null,
            stoppedAt: null,
            points: [],
            distanceMeters: 0,
            nativePlugin: null,
            webWatchId: null,
            timerId: null,
            error: null
        };
        localStorage.removeItem(BALANCE_ROUTE_STORAGE_KEY);
    }

    // Reset form UI
    document.getElementById('activity-label-input').value = activityPrefill.label || '';
    document.getElementById('activity-notes-input').value = activityPrefill.notes || '';
    document.getElementById('activity-duration-display').textContent = String(activityFormState.duration);
    const activityPhotoPreview = document.getElementById('activity-photo-preview');
    const activityPhotoButton = document.getElementById('activity-photo-btn');
    if (activityPhotoPreview) activityPhotoPreview.style.display = 'none';
    if (activityPhotoButton) activityPhotoButton.style.display = 'none';
    document.getElementById('activity-calories-display').textContent = '0';
    document.getElementById('activity-save-btn').disabled = false;
    document.getElementById('activity-save-btn').textContent = 'Save activity';

    const isPilot = isMoveYourWayPilotUser();
    const title = document.querySelector('#view-log-activity h2');
    if (title) title.textContent = 'Log Activity';
    const notesHeading = document.getElementById('activity-notes-heading');
    if (notesHeading) notesHeading.innerHTML = isPilot ? 'Caption <span style="font-weight:400; text-transform:none;">(optional)</span>' : 'Notes <span style="font-weight:400; text-transform:none;">(optional)</span>';

    // Build activity type grid
    const grid = document.getElementById('activity-type-grid');
    const primaryTypeKeys = ['walking', 'running', 'cycling', 'fitness_class', 'swimming', 'other'];
    const orderedTypes = primaryTypeKeys
        .map(key => ACTIVITY_TYPES.find(type => type.key === key))
        .filter(Boolean)
        .concat(ACTIVITY_TYPES.filter(type => !primaryTypeKeys.includes(type.key)));
    grid.innerHTML = orderedTypes.map(t => `
        <button class="activity-type-choice${primaryTypeKeys.includes(t.key) ? '' : ' is-extra'}" onclick="selectActivityType('${t.key}')" id="activity-type-btn-${t.key}" style="padding:14px 8px;border-radius:14px;border:2px solid var(--border);background:var(--card-bg);cursor:pointer;text-align:center;transition:all .2s;">
            <div style="font-size: 1.5rem;">${t.emoji}</div>
            <div style="font-weight: 700; font-size: 0.75rem; margin-top: 4px; color: var(--text-main);">${t.label}</div>
        </button>
    `).join('') + '<button id="activity-type-more-btn" type="button" onclick="toggleActivityTypeChoices()" style="min-height:48px;border:1px dashed var(--border);border-radius:14px;background:transparent;color:var(--text-muted);font:inherit;font-weight:800;cursor:pointer;">More activities</button>';

    selectActivityIntensity(activityFormState.intensity);
    if (activityFormState.selectedType) {
        selectActivityType(activityFormState.selectedType);
    } else {
        updateActivityCalories();
        updateBalanceRouteUI();
    }
    setActivityGuidedStep(1);

    // Load user weight for calorie estimation
    loadUserWeightForActivity();

    // Push navigation state
    window.history.pushState({ view: 'log-activity' }, '', '#log-activity');
}
window.openLogActivityForm = openLogActivityForm;

async function loadUserWeightForActivity() {
    try {
        const session = await window.authHelpers?.getSession();
        if (!session?.user) return;
        const quiz = await window.dbHelpers?.quizResults?.getLatest(window.currentUser.id);
        if (quiz?.weight) {
            activityFormState.userWeightKg = parseFloat(quiz.weight) || 70;
            updateActivityCalories();
        }
    } catch (e) {
        console.error('Failed to load user weight for activity:', e);
    }
}

function selectActivityType(typeKey) {
    if (balanceRouteTracker.active && !BALANCE_ROUTE_ACTIVITY_TYPES.has(typeKey)) {
        stopBalanceRouteTracking({ silent: true });
    }
    activityFormState.selectedType = typeKey;
    // Update UI - highlight selected
    ACTIVITY_TYPES.forEach(t => {
        const btn = document.getElementById(`activity-type-btn-${t.key}`);
        if (btn) {
            btn.classList.toggle('is-selected', t.key === typeKey);
            btn.style.removeProperty('border');
            btn.style.removeProperty('background');
            btn.style.removeProperty('transform');
        }
    });
    const selectedButton = document.getElementById(`activity-type-btn-${typeKey}`);
    if (selectedButton?.classList.contains('is-extra')) {
        document.getElementById('activity-type-grid')?.classList.add('is-expanded');
        const moreButton = document.getElementById('activity-type-more-btn');
        if (moreButton) moreButton.textContent = 'Show fewer activities';
    }
    const guidedNext = document.getElementById('activity-guided-next-btn');
    if (guidedNext && activityGuidedStep === 1) {
        guidedNext.disabled = false;
        guidedNext.textContent = 'Next · Add details';
    }
    updateActivityCalories();
    updateBalanceRouteUI();
}
window.selectActivityType = selectActivityType;

function adjustActivityDuration(delta) {
    activityFormState.duration = Math.max(5, Math.min(300, activityFormState.duration + delta));
    document.getElementById('activity-duration-display').textContent = activityFormState.duration;
    updateActivityCalories();
}
window.adjustActivityDuration = adjustActivityDuration;

function selectActivityIntensity(level) {
    activityFormState.intensity = level;
    document.querySelectorAll('#activity-intensity-row .intensity-btn').forEach(btn => {
        const isSelected = btn.getAttribute('data-intensity') === level;
        btn.classList.toggle('is-selected', isSelected);
        btn.style.removeProperty('border');
        btn.style.removeProperty('background');
    });
    updateActivityCalories();
}
window.selectActivityIntensity = selectActivityIntensity;

function updateActivityCalories() {
    const type = activityFormState.selectedType || 'other';
    const cal = estimateCaloriesBurned(type, activityFormState.intensity, activityFormState.duration, activityFormState.userWeightKg);
    document.getElementById('activity-calories-display').textContent = cal;
}

function captureActivityPhoto() {
    // Use getUserMedia camera instead of file input (which opens gallery in Capacitor WebView)
    openWorkoutCamera((file) => {
        handleActivityPhotoCaptureFromFile(file);
    }, 'Take an activity photo');
}
window.captureActivityPhoto = captureActivityPhoto;

// Legacy handler for file input (kept for compatibility)
function handleActivityPhotoCapture(input) {
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    handleActivityPhotoCaptureFromFile(file);
}
window.handleActivityPhotoCapture = handleActivityPhotoCapture;

// Handle activity photo from a File object (used by both camera modal and file input)
async function handleActivityPhotoCaptureFromFile(file) {
    if (!file) return;

    const preparedFile = typeof window.normalizeFeedImageUploadFile === 'function'
        ? await window.normalizeFeedImageUploadFile(file)
        : file;
    const reader = new FileReader();
    reader.onload = function(e) {
        const base64Full = e.target.result;
        const base64Data = base64Full.split(',')[1];
        activityFormState.photoBase64 = base64Data;
        activityFormState.photoMimeType = preparedFile.type || 'image/jpeg';

        // Show preview
        document.getElementById('activity-photo-img').src = base64Full;
        document.getElementById('activity-photo-preview').style.display = 'block';
        document.getElementById('activity-photo-btn').style.display = 'none';
    };
    reader.readAsDataURL(preparedFile);
}

function removeActivityPhoto() {
    activityFormState.photoBase64 = null;
    activityFormState.photoMimeType = null;
    document.getElementById('activity-photo-preview').style.display = 'none';
    document.getElementById('activity-photo-btn').style.display = 'flex';
}
window.removeActivityPhoto = removeActivityPhoto;

async function saveActivity() {
    if (!activityFormState.selectedType) {
        showToast('Please select an activity type', 'error');
        return;
    }

    if (balanceRouteTracker.active) {
        await stopBalanceRouteTracking({ silent: true });
    }

    const saveBtn = document.getElementById('activity-save-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        const session = await window.authHelpers?.getSession();
        if (!session?.user) {
            showToast('Please log in to save activities', 'error');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save activity';
            return;
        }

        const activityType = activityFormState.selectedType;
        const duration = activityFormState.duration;
        const intensity = activityFormState.intensity;
        const label = document.getElementById('activity-label-input').value.trim();
        const notes = document.getElementById('activity-notes-input').value.trim();
        const calories = estimateCaloriesBurned(activityType, intensity, duration, activityFormState.userWeightKg);
        const metValues = ACTIVITY_MET_VALUES[activityType] || ACTIVITY_MET_VALUES.other;
        const metValue = metValues[intensity] || metValues.moderate;
        const routePolyline = balanceRouteTracker.points.length > 1
            ? encodeBalanceRoutePolyline(balanceRouteTracker.points)
            : null;
        const routeMetadata = routePolyline ? {
            provider: 'Balance GPS',
            route_polyline: routePolyline,
            distance_meters: Math.round(balanceRouteTracker.distanceMeters),
            started_at: new Date(balanceRouteTracker.startedAt).toISOString(),
            ended_at: new Date(balanceRouteTracker.stoppedAt || Date.now()).toISOString(),
            point_count: balanceRouteTracker.points.length
        } : {};

        // Photo verification
        let venueVerifiable = false;
        let venueType = null;
        let aiConfidence = null;
        let detectedElements = [];
        let photoVerified = false;
        let xpEligible = false;

        if (activityFormState.photoBase64) {
            saveBtn.textContent = 'Verifying photo...';
            try {
                const verifyResponse = await fetch('/api/analyze-workout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        imageBase64: activityFormState.photoBase64,
                        mimeType: activityFormState.photoMimeType,
                        activityType: activityType
                    })
                });

                if (verifyResponse.ok) {
                    const verifyData = await verifyResponse.json();
                    if (verifyData.success) {
                        venueVerifiable = verifyData.venueVerifiable || false;
                        venueType = verifyData.venueType || 'unknown';
                        aiConfidence = verifyData.data?.confidence || 'low';
                        detectedElements = verifyData.data?.detectedElements || [];
                        photoVerified = verifyData.data?.isWorkoutPhoto || false;
                    }
                }
            } catch (verifyError) {
                console.error('Photo verification failed:', verifyError);
                // Continue without verification — no XP but still save
            }

            xpEligible = isActivityXPEligible(activityType, true, venueVerifiable);
        }

        saveBtn.textContent = 'Saving...';

        // Save to database
        const activityRecord = await window.dbHelpers?.activityLogs?.create(window.currentUser.id, {
            activity_type: activityType,
            activity_label: label || null,
            duration_minutes: duration,
            intensity: intensity,
            estimated_calories: calories,
            met_value: metValue,
            photo_url: activityFormState.photoBase64 ? 'photo_captured' : null,
            photo_verified: photoVerified,
            venue_type: venueType,
            venue_verifiable: venueVerifiable,
            ai_confidence: aiConfidence,
            detected_elements: detectedElements,
            xp_eligible: xpEligible,
            notes: notes || null,
            source: routePolyline ? 'balance_gps' : 'manual',
            source_metadata: routeMetadata
        });

        // Store for sharing
        const typeInfo = ACTIVITY_TYPES.find(t => t.key === activityType) || ACTIVITY_TYPES[ACTIVITY_TYPES.length - 1];
        savedActivityData = {
            id: activityRecord?.id,
            activity_type: activityType,
            activity_label: label || typeInfo.label,
            duration: duration,
            intensity: intensity,
            calories: calories,
            emoji: typeInfo.emoji,
            color: typeInfo.color,
            xpEligible: xpEligible,
            venueVerifiable: venueVerifiable,
            venueType: venueType,
            photoBase64: activityFormState.photoBase64,
            photoMimeType: activityFormState.photoMimeType,
            routePolyline: routePolyline,
            distanceMeters: Math.round(balanceRouteTracker.distanceMeters),
            distanceKm: routePolyline ? Number((balanceRouteTracker.distanceMeters / 1000).toFixed(2)) : null,
            source: routePolyline ? 'balance_gps' : 'manual',
            sourceMetadata: routeMetadata
        };

        // Show success screen
        showActivitySuccess(savedActivityData);

    } catch (error) {
        console.error('Error saving activity:', error);
        showToast('Failed to save activity. Please try again.', 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save activity';
    }
}
window.saveActivity = saveActivity;

function showActivitySuccess(data) {
    if (!data) return;
    data.ratingEligible = true;
    savedActivityData = data;
    hideAllAppViews();
    document.getElementById('view-activity-success').style.display = 'block';
    document.querySelector('.bottom-nav').style.display = 'none';

    // Push navigation state for Android back button
    pushNavigationState('view-activity-success', () => closeActivitySuccess());

    // Update success screen
    document.getElementById('activity-success-emoji').textContent = data.emoji;
    document.getElementById('activity-success-label').textContent = data.activity_label;
    document.getElementById('activity-success-duration').textContent = data.duration + ' min';
    document.getElementById('activity-success-calories').textContent = data.calories + ' kcal';

    const intensityEmojis = { light: '🚶', moderate: '🏃', vigorous: '🔥' };
    document.getElementById('activity-success-intensity').textContent = intensityEmojis[data.intensity] || '🏃';

    // XP status
    const xpStatus = document.getElementById('activity-xp-status');
    const noXpHint = document.getElementById('activity-no-xp-hint');

    if (data.xpEligible) {
        xpStatus.style.display = 'block';
        xpStatus.style.background = 'rgba(68, 255, 68, 0.2)';
        xpStatus.style.border = '2px solid rgba(68, 255, 68, 0.5)';
        xpStatus.innerHTML = '<div style="font-weight:700;">📸 Venue verified! Share to earn XP</div>';
        noXpHint.style.display = 'none';
    } else if (data.photoBase64) {
        xpStatus.style.display = 'block';
        xpStatus.style.background = 'rgba(255, 200, 50, 0.2)';
        xpStatus.style.border = '2px solid rgba(255, 200, 50, 0.5)';
        xpStatus.innerHTML = '<div style="font-weight:700;">📸 Photo taken but venue not verified for XP</div><div style="font-size:0.8rem; margin-top:4px; opacity:0.85;">Try a clearer photo showing gym equipment, court, or studio next time</div>';
        noXpHint.style.display = 'none';
    } else {
        xpStatus.style.display = 'none';
        noXpHint.style.display = 'block';
    }

    // Activity shares earn independent daily XP in Balance and on Instagram.
    xpStatus.style.display = 'block';
    xpStatus.style.background = 'rgba(68, 255, 68, 0.2)';
    xpStatus.style.border = '2px solid rgba(68, 255, 68, 0.5)';
    xpStatus.innerHTML = '<div style="font-weight:700;">Balance Feed +15 XP, Instagram Story +15 XP</div>';
    noXpHint.style.display = 'none';

    // Reset share button
    const shareBtn = document.getElementById('activity-share-btn');
    shareBtn.disabled = false;
    document.getElementById('activity-share-btn-text').textContent = 'Balance Feed (+15 XP)';
    const instagramBtn = document.getElementById('activity-share-instagram-btn');
    if (instagramBtn) {
        instagramBtn.disabled = false;
        instagramBtn.style.opacity = '1';
        const instagramLabel = document.getElementById('activity-share-instagram-btn-text');
        if (instagramLabel) instagramLabel.textContent = 'IG Story (+15 XP)';
    }
    const sharePhotoLabel = document.getElementById('activity-share-photo-btn-text');
    if (sharePhotoLabel) {
        const routeCopy = data.routePolyline ? 'route and activity stats' : 'activity stats';
        sharePhotoLabel.textContent = data.photoBase64
            ? `Photo ready, choose your ${routeCopy} colour and text layout`
            : `Add a photo for your ${routeCopy}`;
    }
    const activityStyleWrap = document.getElementById('activity-share-style-preview-wrap');
    const activityStyleControls = document.getElementById('activity-share-style-controls');
    const destinationActions = document.getElementById('activity-share-destination-actions');
    if (data.photoBase64) {
        if (destinationActions) destinationActions.style.display = 'grid';
        void renderBalanceShareStylePreview('activity', buildActivityShareCardPayload(), data.photoBase64, {
            previewImageId: 'activity-share-style-preview',
            previewWrapId: 'activity-share-style-preview-wrap',
            controlsId: 'activity-share-style-controls'
        });
    } else {
        if (destinationActions) destinationActions.style.display = 'none';
        if (activityStyleWrap) activityStyleWrap.style.display = 'none';
        if (activityStyleControls) activityStyleControls.style.display = 'none';
    }

    window.history.pushState({ view: 'activity-success' }, '', '#activity-success');
}

function buildActivityShareCardPayload() {
    if (!savedActivityData) return null;
    const cardPayload = {
        card_type: 'activity',
        share_variant: PBB_SHARE_CREATIVE_VARIANT,
        share_overlay_style: getBalanceShareOverlayStyle('activity'),
        share_text_style: getBalanceShareTextStyle('activity'),
        activity_type: savedActivityData.activity_type,
        activity_label: savedActivityData.activity_label,
        duration: savedActivityData.duration + ' min',
        intensity: savedActivityData.intensity,
        calories: savedActivityData.calories,
        emoji: savedActivityData.emoji,
        venue_type: savedActivityData.venueType
    };
    if (savedActivityData.includeRoute !== false && savedActivityData.routePolyline) {
        cardPayload.route_polyline = savedActivityData.routePolyline;
        cardPayload.distance_km = savedActivityData.distanceKm || null;
        cardPayload.route_source = savedActivityData.sourceMetadata?.provider || 'Balance GPS';
    }
    return cardPayload;
}

function getActivitySocialShareReferenceId() {
    if (!savedActivityData) return crypto.randomUUID();
    if (!savedActivityData.socialShareReferenceId) {
        savedActivityData.socialShareReferenceId = savedActivityData.id || crypto.randomUUID();
    }
    return savedActivityData.socialShareReferenceId;
}

async function shareActivityCardToFeed() {
    if (!savedActivityData) {
        showToast('No activity data to share', 'error');
        return;
    }
    if (!savedActivityData.photoBase64) {
        showToast('Add a selfie or activity photo before sharing.', 'info');
        toggleActivitySharePhotoSourceMenu();
        return;
    }

    const shareBtn = document.getElementById('activity-share-btn');
    shareBtn.disabled = true;
    document.getElementById('activity-share-btn-text').textContent = 'Sharing...';

    try {
        const session = await window.authHelpers?.getSession();
        if (!session?.user) {
            showToast('Please log in to share', 'error');
            shareBtn.disabled = false;
            document.getElementById('activity-share-btn-text').textContent = 'Balance Feed (+15 XP)';
            return;
        }

        const cardPayload = buildActivityShareCardPayload();

        let mediaUrl = '';
        if (savedActivityData.photoBase64 || cardPayload.route_polyline) {
            const compositeDataUrl = await renderBalanceShareCardImage(cardPayload, {
                target: 'feed',
                photoDataUrl: savedActivityData.photoBase64 || null,
                overlayStyle: getBalanceShareOverlayStyle('activity'),
                textStyle: getBalanceShareTextStyle('activity')
            });
            const compositeFile = postWorkoutShareFileFromDataUrl(compositeDataUrl, 'balance-activity-overlay.jpg');
            const formData = new FormData();
            formData.append('file', compositeFile);
            formData.append('userId', window.currentUser.id);
            formData.append('storyId', crypto.randomUUID ? crypto.randomUUID() : Date.now().toString());
            formData.append('source', 'activity_share_photo_overlay');
            const uploadResponse = await fetch('/api/upload-story-media', { method: 'POST', body: formData });
            if (!uploadResponse.ok) throw new Error('Photo overlay upload failed');
            const uploadData = await uploadResponse.json();
            mediaUrl = uploadData.url;
            cardPayload.share_style = 'photo_overlay';
        }

        // Create story in feed. A selected photo is rendered with the activity text overlaid.
        const storyData = {
            media_type: 'workout_card',
            media_url: mediaUrl,
            thumbnail_url: mediaUrl || null,
            caption: JSON.stringify(cardPayload),
            duration: 5
        };

        await window.dbHelpers?.stories?.create(window.currentUser.id, storyData);

        const xpResult = await awardBalanceSocialShareXP(
            'activity',
            'balance_feed',
            getActivitySocialShareReferenceId()
        );
        if (xpResult?.success) {
            const xpStatus = document.getElementById('activity-xp-status');
            xpStatus.style.display = 'block';
            xpStatus.style.background = 'rgba(68, 255, 68, 0.2)';
            xpStatus.style.border = '2px solid rgba(68, 255, 68, 0.5)';
            xpStatus.innerHTML = '<div style="font-weight:700; font-size:1.1rem;">Balance Feed +15 XP earned! 🎉</div>';
        }

        // Update activity log record
        if (savedActivityData.id) {
            try {
                const primaryMetadata = savedActivityData.activityMetadataById?.[savedActivityData.id] || savedActivityData.sourceMetadata || {};
                await window.dbHelpers?.activityLogs?.update(savedActivityData.id, {
                    shared_to_feed: true,
                    xp_awarded: !!xpResult?.success,
                    source_metadata: {
                        ...primaryMetadata,
                        share_prompt_handled: 'balance_feed',
                        share_prompt_handled_at: new Date().toISOString()
                    }
                });
                const additionalIds = (savedActivityData.activityIds || []).filter(id => id && id !== savedActivityData.id);
                await Promise.all(additionalIds.map(id => {
                    const existingMetadata = savedActivityData.activityMetadataById?.[id] || savedActivityData.sourceMetadata || {};
                    return window.dbHelpers?.activityLogs?.update(id, {
                        shared_to_feed: true,
                        source_metadata: {
                            ...existingMetadata,
                            share_prompt_handled: 'balance_feed',
                            share_prompt_handled_at: new Date().toISOString()
                        }
                    });
                }));
                savedActivityData.sharePromptHandled = true;
                if (typeof window.refreshImportedActivityHomeCard === 'function') {
                    await window.refreshImportedActivityHomeCard();
                }
                if (window.pbbNextSteps && typeof window.pbbNextSteps.refresh === 'function') {
                    window.pbbNextSteps.refresh();
                }
            } catch (e) {
                console.error('Failed to update activity log:', e);
            }
        }

        document.getElementById('activity-share-btn-text').textContent = '✅ Shared!';
        showToast(xpResult?.success ? 'Activity shared to Balance Feed! +15 XP' : 'Activity shared. Its Balance Feed XP is already claimed.', 'success');

        // Refresh feed in background
        if (typeof window.loadPhotoFeed === 'function') {
            window.loadPhotoFeed();
        }

    } catch (error) {
        console.error('Error sharing activity:', error);
        showToast('Failed to share. Please try again.', 'error');
        shareBtn.disabled = false;
        document.getElementById('activity-share-btn-text').textContent = 'Balance Feed (+15 XP)';
    }
}
window.shareActivityCardToFeed = shareActivityCardToFeed;

async function shareActivityCardToInstagram() {
    if (!savedActivityData) {
        showToast('No activity data to share', 'error');
        return false;
    }
    if (!savedActivityData.photoBase64) {
        showToast('Add a selfie or activity photo before sharing.', 'info');
        toggleActivitySharePhotoSourceMenu();
        return false;
    }
    const btn = document.getElementById('activity-share-instagram-btn');
    const label = document.getElementById('activity-share-instagram-btn-text');
    if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.72';
    }
    if (label) label.textContent = 'Preparing...';

    try {
        const opened = await shareBalanceCardToInstagram(
            buildActivityShareCardPayload(),
            'story',
            {
                photoDataUrl: savedActivityData.photoBase64 || null,
                overlayStyle: getBalanceShareOverlayStyle('activity'),
                textStyle: getBalanceShareTextStyle('activity')
            }
        );
        if (!opened) return false;

        const xpResult = await awardBalanceSocialShareXP(
            'activity',
            'instagram_feed',
            getActivitySocialShareReferenceId()
        );
        if (savedActivityData.id) {
            const activityIds = savedActivityData.activityIds || [savedActivityData.id];
            await Promise.all(activityIds.filter(Boolean).map(id => {
                const existingMetadata = savedActivityData.activityMetadataById?.[id] || savedActivityData.sourceMetadata || {};
                return window.dbHelpers?.activityLogs?.update(id, {
                    source_metadata: { ...existingMetadata, share_prompt_handled: 'instagram_story' }
                });
            }));
            if (typeof window.refreshImportedActivityHomeCard === 'function') await window.refreshImportedActivityHomeCard();
            savedActivityData.sharePromptHandled = true;
        }
        // `instagram_feed` is the legacy backend key for the independent Instagram XP lane.
        // The user-facing destination for activity cards is Instagram Story.
        if (label) label.textContent = xpResult?.success ? 'IG Story shared (+15 XP)' : 'IG Story opened';
        showToast(
            xpResult?.success ? 'Activity shared to Instagram Story! +15 XP' : 'Activity opened in Instagram Story. Today\'s Instagram XP is already claimed.',
            'success'
        );
        return true;
    } catch (error) {
        console.error('Error sharing activity to Instagram:', error);
        showToast('Could not open Instagram Story. Please try again.', 'error');
        return false;
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
        }
        if (label && label.textContent === 'Preparing...') label.textContent = 'IG Story (+15 XP)';
    }
}
window.shareActivityCardToInstagram = shareActivityCardToInstagram;

async function handleActivitySharePhotoSelected(input) {
    const file = input?.files?.[0];
    if (!file) return;
    await useActivitySharePhotoFile(file);
    input.value = '';
}
window.handleActivitySharePhotoSelected = handleActivitySharePhotoSelected;

async function useActivitySharePhotoFile(file) {
    if (!file || !savedActivityData) return;
    const label = document.getElementById('activity-share-photo-btn-text');
    try {
        const normalizedFile = typeof window.normalizeFeedImageUploadFile === 'function'
            ? await window.normalizeFeedImageUploadFile(file)
            : file;
        const preparedFile = typeof compressMealImage === 'function'
            ? await compressMealImage(normalizedFile)
            : normalizedFile;
        const reader = new FileReader();
        const dataUrl = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(preparedFile);
        });
        savedActivityData.photoBase64 = String(dataUrl || '');
        savedActivityData.photoMimeType = preparedFile.type || 'image/jpeg';
        if (label) label.textContent = 'Photo added, swipe to choose your overlay style';
        await renderBalanceShareStylePreview('activity', buildActivityShareCardPayload(), savedActivityData.photoBase64, {
            previewImageId: 'activity-share-style-preview',
            previewWrapId: 'activity-share-style-preview-wrap',
            controlsId: 'activity-share-style-controls'
        });
        if (window.BalancePrivateShareStudio?.isEnabled?.()) {
            await window.BalancePrivateShareStudio.open({
                context: 'activity',
                photoDataUrl: savedActivityData.photoBase64,
                cardPayload: buildActivityShareCardPayload(),
                previewTarget: 'story',
                overlayStyle: getBalanceShareOverlayStyle('activity'),
                textStyle: getBalanceShareTextStyle('activity'),
                onFeed: async () => shareActivityCardToFeed(),
                onInstagram: async () => shareActivityCardToInstagram()
            });
        }
        const destinationActions = document.getElementById('activity-share-destination-actions');
        if (destinationActions) destinationActions.style.display = 'grid';
    } catch (error) {
        console.error('Could not read activity share photo:', error);
        showToast('Could not use that photo. Please try another one.', 'error');
    }
}

function toggleActivitySharePhotoSourceMenu(event) {
    event?.stopPropagation?.();
    const menu = document.getElementById('activity-share-photo-source-menu');
    const button = document.getElementById('activity-share-photo-btn');
    if (!menu) return;
    const isOpen = menu.style.display !== 'none';
    menu.style.display = isOpen ? 'none' : 'block';
    button?.setAttribute('aria-expanded', String(!isOpen));
}
window.toggleActivitySharePhotoSourceMenu = toggleActivitySharePhotoSourceMenu;

function openActivitySharePhotoSource(source) {
    const menu = document.getElementById('activity-share-photo-source-menu');
    const button = document.getElementById('activity-share-photo-btn');
    if (menu) menu.style.display = 'none';
    button?.setAttribute('aria-expanded', 'false');
    const inputId = source === 'camera'
        ? 'activity-share-photo-camera-input'
        : 'activity-share-photo-gallery-input';
    if (source === 'camera' && typeof openWorkoutCamera === 'function') {
        openWorkoutCamera(async function(file) {
            if (file) await useActivitySharePhotoFile(file);
        }, 'Take an activity photo');
        return;
    }
    document.getElementById(inputId)?.click();
}
window.openActivitySharePhotoSource = openActivitySharePhotoSource;

document.addEventListener('click', function(event) {
    [
        ['activity-share-photo-source-menu', 'activity-share-photo-btn'],
        ['nutrition-share-photo-source-menu', 'nutrition-share-photo-btn']
    ].forEach(([menuId, buttonId]) => {
        const menu = document.getElementById(menuId);
        const button = document.getElementById(buttonId);
        if (!menu || menu.style.display === 'none') return;
        if (menu.contains(event.target) || button?.contains(event.target)) return;
        menu.style.display = 'none';
        button?.setAttribute('aria-expanded', 'false');
    });
});

function closeLogActivity() {
    if (balanceRouteTracker.active) stopBalanceRouteTracking({ silent: true });
    savedActivityData = null;
    document.getElementById('view-log-activity').style.display = 'none';
    switchAppTab('movement-tab');
}
window.closeLogActivity = closeLogActivity;

function closeActivitySuccess() {
    const successView = document.getElementById('view-activity-success');
    const completedSession = !!(
        successView
        && successView.style.display !== 'none'
        && savedActivityData
        && savedActivityData.ratingEligible === true
    );
    // Grab activity info for rating before clearing
    const activityName = savedActivityData?.activity_label || savedActivityData?.activity_type || 'Activity';
    const activityId = savedActivityData?.id || null;

    if (successView) successView.style.display = 'none';
    switchAppTab('movement-tab');

    // Only a genuinely completed activity may open the feedback screen. This
    // prevents Android back/cancel paths from reusing stale activity details.
    if (completedSession) {
        if (savedActivityData?.isImportedActivity && !savedActivityData.sharePromptHandled) {
            markImportedActivitySharePromptHandled('dismissed').catch(error => {
                console.warn('Could not dismiss imported activity share prompt:', error);
            });
        }
        openWorkoutRatingModal(activityName, 'activity', activityId);
    }
    savedActivityData = null;
}
window.closeActivitySuccess = closeActivitySuccess;

// ============================================
// END ACTIVITY LOGGING SYSTEM
// ============================================

// Open story upload modal with a pre-loaded image
function openStoryUploadWithImage(file, base64Data, defaultCaption = '') {
    // Store the file for upload
    window.pendingStoryFile = file;
    window.pendingStoryBase64 = base64Data;
    window.pendingStoryType = 'image';

    // Show the story upload modal
    const modal = document.getElementById('story-upload-modal');
    if (modal) {
        modal.style.display = 'flex';
    }

    // Set the preview image
    const previewImage = document.getElementById('story-preview-image');
    const previewVideo = document.getElementById('story-preview-video');
    const placeholder = document.getElementById('story-preview-placeholder');

    if (previewImage) {
        previewImage.src = base64Data;
        previewImage.style.display = 'block';
    }
    if (previewVideo) previewVideo.style.display = 'none';
    if (placeholder) placeholder.style.display = 'none';

    // Set default caption
    const captionInput = document.getElementById('story-caption-input');
    if (captionInput) {
        captionInput.value = defaultCaption;
    }

    // Enable the upload button
    const uploadBtn = document.getElementById('story-upload-button');
    if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.style.opacity = '1';
    }
}

// Handle story file selection (from file picker)
async function handleStoryFileSelect(event) {
    let file = event.target.files[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    if (!isVideo && typeof window.normalizeFeedImageUploadFile === 'function') {
        file = await window.normalizeFeedImageUploadFile(file);
    }
    const reader = new FileReader();

    reader.onload = function(e) {
        const base64Data = e.target.result;
        window.pendingStoryFile = file;
        window.pendingStoryBase64 = base64Data;
        window.pendingStoryType = isVideo ? 'video' : 'image';

        // Show preview
        const previewImage = document.getElementById('story-preview-image');
        const previewVideo = document.getElementById('story-preview-video');
        const placeholder = document.getElementById('story-preview-placeholder');

        if (isVideo) {
            if (previewVideo) {
                previewVideo.src = base64Data;
                previewVideo.style.display = 'block';
            }
            if (previewImage) previewImage.style.display = 'none';
        } else {
            if (previewImage) {
                previewImage.src = base64Data;
                previewImage.style.display = 'block';
            }
            if (previewVideo) previewVideo.style.display = 'none';
        }
        if (placeholder) placeholder.style.display = 'none';

        // Enable upload button
        const uploadBtn = document.getElementById('story-upload-button');
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.style.opacity = '1';
        }
    };

    reader.readAsDataURL(file);
    event.target.value = ''; // Reset for future selections
}

// Close story upload modal
function closeStoryUploadModal() {
    const modal = document.getElementById('story-upload-modal');
    if (modal) modal.style.display = 'none';

    // Reset state
    window.pendingStoryFile = null;
    window.pendingStoryBase64 = null;
    window.pendingStoryType = null;

    // Reset preview
    const previewImage = document.getElementById('story-preview-image');
    const previewVideo = document.getElementById('story-preview-video');
    const placeholder = document.getElementById('story-preview-placeholder');
    const captionInput = document.getElementById('story-caption-input');
    const uploadBtn = document.getElementById('story-upload-button');

    if (previewImage) { previewImage.src = ''; previewImage.style.display = 'none'; }
    if (previewVideo) { previewVideo.src = ''; previewVideo.style.display = 'none'; }
    if (placeholder) placeholder.style.display = 'flex';
    if (captionInput) captionInput.value = '';
    if (uploadBtn) { uploadBtn.disabled = true; uploadBtn.style.opacity = '0.5'; }
}

// Upload story to database and storage
async function uploadStory() {
    if (!window.pendingStoryFile || !window.pendingStoryBase64) {
        alert('Please select a photo or video first');
        return;
    }

    const uploadBtn = document.getElementById('story-upload-button');
    const captionInput = document.getElementById('story-caption-input');
    const caption = captionInput ? captionInput.value.trim() : '';

    // Disable button and show loading
    if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';
    }

    try {
        const userId = window.currentUser?.id;

        if (!userId) {
            throw new Error('Please sign in to share stories');
        }

        // Compress image if needed
        let fileToUpload = window.pendingStoryFile;
        if (window.pendingStoryType === 'image') {
            const preparedFile = typeof window.normalizeFeedImageUploadFile === 'function'
                ? await window.normalizeFeedImageUploadFile(window.pendingStoryFile)
                : window.pendingStoryFile;
            fileToUpload = typeof compressMealImage === 'function'
                ? await compressMealImage(preparedFile)
                : preparedFile;
        }

        const fileSizeMB = fileToUpload.size / (1024 * 1024);
        let mediaUrl;

        if (uploadBtn) {
            uploadBtn.textContent = `Uploading ${Math.max(1, Math.round(fileSizeMB))}MB...`;
        }

        const tempStoryId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
        const formData = new FormData();
        formData.append('file', fileToUpload);
        formData.append('userId', userId);
        formData.append('storyId', tempStoryId);
        formData.append('source', 'feed_capture');

        const uploadResponse = await fetch('/api/upload-story-media', {
            method: 'POST',
            body: formData
        });

        if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(errorData.error || 'Upload failed');
        }

        const uploadData = await uploadResponse.json();
        mediaUrl = uploadData.url;

        // Save story to database
        const storyData = await dbHelpers.stories.create(userId, {
            media_type: window.pendingStoryType || 'image',
            media_url: mediaUrl,
            thumbnail_url: null,
            caption: caption,
            duration: 5
        });

        // Check if this is a verified workout share (from the workout success screen)
        if (window.pendingWorkoutPhotoData?.forPoints) {
            // Award workout point with verified photo data
            await awardWorkoutSharePoint('story', window.pendingWorkoutPhotoData.timestamp, window.pendingWorkoutPhotoData.hash);
            window.pendingWorkoutPhotoData = null; // Clear after use
        } else if (window.pendingStoryType === 'image') {
            // Regular story - analyze for workout points (in background)
            analyzeStoryForPoints(userId, storyData.id, window.pendingStoryBase64);
        }

        // Close modal and show success
        closeStoryUploadModal();
        showToast('Post shared!', 'success');

        // Refresh feed and stories
        if (typeof loadPhotoFeed === 'function') {
            loadPhotoFeed('friends-photo-feed', 'friends-feed-empty');
        }
        if (typeof loadStories === 'function') {
            loadStories();
        }

    } catch (error) {
        console.error('Error uploading story:', error);
        alert('Failed to upload story: ' + (error.message || 'Please try again'));
    } finally {
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Share Post';
        }
    }
}

// Analyze story for workout points
async function analyzeStoryForPoints(userId, storyId, imageBase64) {
    try {
        // Extract base64 data without prefix
        const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

        const response = await fetch('/api/analyze-story-points', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                storyId,
                imageBase64: base64Data
            })
        });

        const result = await response.json();

        if (result.success && result.pointsAwarded > 0) {
            console.log(`Workout point awarded! Total points: ${result.newTotal}`);
            // Optionally show a toast notification
            if (typeof showToast === 'function') {
                showToast(`+${result.pointsAwarded} point${result.pointsAwarded > 1 ? 's' : ''} for workout story!`, 'success');
            }
        }
    } catch (error) {
        console.error('Error analyzing story for points:', error);
        // Don't alert - this runs in background
    }
}

// Handle workout photo selection
async function handleWorkoutPhotoSelect(event) {
    let file = event.target.files[0];
    if (!file) return;

    if (typeof window.normalizeFeedImageUploadFile === 'function') {
        file = await window.normalizeFeedImageUploadFile(file);
    }

    // Compress image first to avoid 502 errors on large photos
    capturedWorkoutFile = typeof compressMealImage === 'function'
        ? await compressMealImage(file)
        : file;

    // Convert compressed image to base64 for preview and analysis
    workoutPhotoBase64 = await fileToBase64(capturedWorkoutFile);

    // Show preview modal
    const previewModal = document.getElementById('workout-preview-modal');
    const previewPhoto = document.getElementById('workout-preview-photo');

    if (previewModal && previewPhoto) {
        previewPhoto.src = workoutPhotoBase64;
        previewModal.style.display = 'flex';
    }

    // Reset file input for future selections
    event.target.value = '';
}

// Close workout preview modal
function closeWorkoutPreviewModal() {
    const previewModal = document.getElementById('workout-preview-modal');
    if (previewModal) {
        previewModal.style.display = 'none';
    }
    capturedWorkoutFile = null;
    workoutPhotoBase64 = null;

    // Hide any loading/error states
    const loading = document.getElementById('workout-photo-loading');
    const error = document.getElementById('workout-photo-error');
    if (loading) loading.style.display = 'none';
    if (error) error.style.display = 'none';
}

// Verify workout photo with Gemini AI
async function verifyWorkoutPhoto() {
    if (!capturedWorkoutFile || !workoutPhotoBase64) {
        alert('No photo captured. Please try again.');
        return;
    }

    const loadingEl = document.getElementById('workout-photo-loading');
    const errorEl = document.getElementById('workout-photo-error');
    const verifyBtn = document.getElementById('workout-verify-btn');

    // Check workout duration first - must be at least 15 minutes for points
    // Try success-duration first (on success screen), then fallback to workout-timer
    const successDurationEl = document.getElementById('success-duration');
    const workoutTimerEl = document.getElementById('workout-timer');
    const durationText = (successDurationEl && successDurationEl.textContent !== '00:00')
        ? successDurationEl.textContent
        : (workoutTimerEl ? workoutTimerEl.textContent : '00:00');
    const [mins, secs] = durationText.split(':').map(Number);
    const totalMinutes = mins + (secs / 60);

    if (totalMinutes < 15) {
        if (errorEl) {
            document.getElementById('workout-photo-error-text').textContent =
                `Workouts need to be at least 15 minutes to earn points. Your workout was ${mins} minute${mins !== 1 ? 's' : ''} ${secs} second${secs !== 1 ? 's' : ''}. Keep going next time!`;
            errorEl.style.display = 'block';
        }
        return;
    }

    // Show loading
    if (loadingEl) loadingEl.style.display = 'block';
    if (verifyBtn) verifyBtn.disabled = true;

    try {
        // Get base64 data without prefix
        const base64Data = workoutPhotoBase64.split(',')[1];

        // Call Gemini API to verify workout photo
        const response = await fetch('/api/analyze-workout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                imageBase64: base64Data,
                mimeType: capturedWorkoutFile.type
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errorData.error || 'Failed to verify workout photo');
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Verification failed');
        }

        const analysisData = result.data;

        // Check if photo is eligible for points
        if (!result.pointsEligible) {
            // Show why it wasn't eligible
            let reason = 'This photo could not be verified as a workout.';
            if (!analysisData.isWorkoutPhoto) {
                reason = 'This doesn\'t appear to be a workout photo. Try taking a photo at the gym, during exercise, or showing workout equipment.';
            } else if (analysisData.confidence === 'low') {
                reason = 'The photo quality or content couldn\'t be clearly verified. Try a clearer photo showing your workout.';
            } else if (analysisData.suspiciousIndicators?.length > 0) {
                reason = 'This photo appears to be a screenshot or stock image. Please take a real photo of your workout.';
            }

            if (errorEl) {
                document.getElementById('workout-photo-error-text').textContent = reason;
                errorEl.style.display = 'block';
            }
            if (loadingEl) loadingEl.style.display = 'none';
            if (verifyBtn) verifyBtn.disabled = false;
            return;
        }

        // Photo verified! Upload and save
        await saveVerifiedWorkoutPhoto(analysisData);

    } catch (error) {
        console.error('Error verifying workout photo:', error);
        if (errorEl) {
            document.getElementById('workout-photo-error-text').textContent = error.message || 'Failed to verify photo. Please try again.';
            errorEl.style.display = 'block';
        }
        if (loadingEl) loadingEl.style.display = 'none';
        if (verifyBtn) verifyBtn.disabled = false;
    }
}

// Save verified workout photo and award points
async function saveVerifiedWorkoutPhoto(analysisData) {
    const loadingEl = document.getElementById('workout-photo-loading');
    const loadingText = document.getElementById('workout-photo-loading-text');

    if (loadingText) loadingText.textContent = 'Saving workout...';

    try {
        const userId = window.currentUser?.id;

        if (!userId) {
            throw new Error('User not authenticated');
        }

        // Upload photo to B2
        const formData = new FormData();
        formData.append('file', capturedWorkoutFile);
        formData.append('userId', userId);

        const uploadResponse = await fetch('/api/upload-workout-photo', {
            method: 'POST',
            body: formData
        });

        if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(errorData.error || 'Failed to upload photo');
        }

        const uploadData = await uploadResponse.json();
        const photoUrl = uploadData.url;

        // Generate photo hash for duplicate detection
        const photoHash = await window.db?.points?.generatePhotoHash(workoutPhotoBase64);

        // Save workout photo log to database
        const { data: savedLog, error: saveError } = await window.supabaseClient
            .from('workout_photo_logs')
            .insert({
                user_id: userId,
                photo_url: photoUrl,
                storage_path: uploadData.fileName,
                is_workout_photo: analysisData.isWorkoutPhoto,
                workout_type: analysisData.workoutType,
                detected_elements: analysisData.detectedElements || [],
                suspicious_indicators: analysisData.suspiciousIndicators || [],
                ai_confidence: analysisData.confidence,
                ai_notes: analysisData.notes,
                analysis_timestamp: new Date().toISOString(),
                points_eligible: true,
                photo_hash: photoHash
            })
            .select();

        if (saveError) {
            console.error('Error saving workout photo log:', saveError);
            // Continue anyway - we still want to award points
        }

        // Award points for the verified workout photo
        const workoutLogId = savedLog?.[0]?.id || `workout_photo_${Date.now()}`;
        const photoTimestamp = capturedWorkoutFile.lastModified
            ? new Date(capturedWorkoutFile.lastModified).toISOString()
            : null;

        const pointsResult = await awardPointsForWorkout(
            workoutLogId,
            photoTimestamp,
            analysisData.confidence,
            photoHash
        );

        // Update the saved log with points awarded
        if (savedLog?.[0]?.id && pointsResult?.pointsAwarded) {
            await window.supabaseClient
                .from('workout_photo_logs')
                .update({ points_awarded: pointsResult.pointsAwarded })
                .eq('id', savedLog[0].id);
        }

        // Close modal and show success
        closeWorkoutPreviewModal();

        // Update success screen to show points earned
        const photoSection = document.getElementById('workout-photo-section');
        const pointsAwarded = document.getElementById('workout-points-awarded');

        if (photoSection) photoSection.style.display = 'none';
        if (pointsAwarded) pointsAwarded.style.display = 'block';

        console.log('Workout photo verified and points awarded!', pointsResult);

    } catch (error) {
        console.error('Error saving workout photo:', error);
        const errorEl = document.getElementById('workout-photo-error');
        if (errorEl) {
            document.getElementById('workout-photo-error-text').textContent = error.message || 'Failed to save workout. Please try again.';
            errorEl.style.display = 'block';
        }
        if (loadingEl) loadingEl.style.display = 'none';
        const verifyBtn = document.getElementById('workout-verify-btn');
        if (verifyBtn) verifyBtn.disabled = false;
    }
}

// Upload workout photo to B2 storage
async function uploadWorkoutPhoto(file) {
    const userId = window.currentUser?.id;

    if (!userId) {
        throw new Error('User not authenticated');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId);

    const response = await fetch('/api/upload-workout-photo', {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload photo');
    }

    const data = await response.json();
    return data.url;
}

// Initialize points widget on dashboard load
// On iOS this script is deferred, so DOMContentLoaded has already fired.
// Use the same _onDomReady pattern as script-5: run immediately if DOM is ready.
(function() {
    function run() { setTimeout(loadPointsWidget, 1000); }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }
})();
