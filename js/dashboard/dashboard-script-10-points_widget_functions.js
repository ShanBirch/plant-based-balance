// ==========================================
// POINTS WIDGET FUNCTIONS
// ==========================================

const POINTS_FOR_FREE_WEEK = 200;
const MAX_LEVEL = 99;
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
    let level = 1;

    while (level < MAX_LEVEL) {
        const pointsNeeded = getPointsForLevel(level + 1);
        if (lifetimePoints < pointsNeeded) break;
        level++;
    }

    const currentLevelPoints = getPointsForLevel(level);
    const nextLevelPoints = level < MAX_LEVEL ? getPointsForLevel(level + 1) : currentLevelPoints;
    const pointsIntoLevel = lifetimePoints - currentLevelPoints;
    const pointsNeededForNext = nextLevelPoints - currentLevelPoints;
    const progress = level >= MAX_LEVEL ? 100 : Math.min(100, Math.floor((pointsIntoLevel / pointsNeededForNext) * 100));

    return {
        level,
        currentLevelPoints,
        nextLevelPoints,
        pointsIntoLevel,
        pointsNeededForNext,
        progress,
        isMaxLevel: level >= MAX_LEVEL
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
                xpText.textContent = newLevel >= 99
                    ? 'MAX LEVEL!'
                    : `${pointsIntoLevel} / ${pointsNeeded} XP to Level ${nextLevel}`;
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

// Cached workout-share photo captured once and reused for Balance Feed and
// Instagram so the user does not have to take it twice.
let cachedWorkoutShareFile = null;
let cachedWorkoutShareBase64 = null;

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
    if (group) group.style.display = enabled ? 'grid' : 'none';

    ['share-workout-ig-story-btn', 'share-workout-ig-feed-btn'].forEach(function(id) {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.disabled = !enabled;
        btn.style.display = enabled ? 'flex' : 'none';
    });
}

function getWorkoutShareSubheading(hasPhoto) {
    return hasPhoto
        ? 'Photo ready. Share workout, PB, or photo to Feed.'
        : 'One button, choose workout, PB, or photo to Feed.';
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
    postWorkoutShareCompleted = { workout: false, photo: false, pbs: {} };
    postWorkoutShareBusy = null;

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

    const takeBtn = document.getElementById('share-take-photo-btn');
    if (takeBtn) {
        takeBtn.disabled = false;
        takeBtn.style.opacity = '1';
        takeBtn.innerHTML = '<span style="font-size: 1.5rem;">📷</span><span style="font-size: 1rem;">Take Gym Photo</span>';
    }

    const cardBtn = document.getElementById('share-workout-card-btn');
    if (cardBtn) {
        cardBtn.disabled = false;
        cardBtn.style.opacity = '1';
        cardBtn.style.background = 'linear-gradient(135deg, #ffffff, #f0fdf4)';
        cardBtn.style.border = 'none';
        cardBtn.innerHTML = '<span style="font-size: 1.3rem;">📢</span><span style="font-size: 0.95rem;">Balance Feed (+1 XP)</span>';
    }

    const igStoryBtn = document.getElementById('share-workout-ig-story-btn');
    if (igStoryBtn) {
        igStoryBtn.disabled = false;
        igStoryBtn.style.opacity = '1';
        igStoryBtn.innerHTML = '<span style="font-size: 0.82rem; font-weight: 950; letter-spacing: 0;">IG</span><span style="font-size: 0.9rem;">Story</span>';
    }

    const igFeedBtn = document.getElementById('share-workout-ig-feed-btn');
    if (igFeedBtn) {
        igFeedBtn.disabled = false;
        igFeedBtn.style.opacity = '1';
        igFeedBtn.innerHTML = '<span style="font-size: 0.82rem; font-weight: 950; letter-spacing: 0;">IG</span><span style="font-size: 0.9rem;">Feed</span>';
    }
    updateWorkoutInstagramShareVisibility();
    renderPostWorkoutShareMenu();
}
window.resetWorkoutShareUI = resetWorkoutShareUI;

let postWorkoutShareCompleted = { workout: false, photo: false, pbs: {} };
let postWorkoutShareBusy = null;

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

    menu.appendChild(createPostWorkoutShareOption({
        title: postWorkoutShareCompleted.workout ? 'Workout shared' : (postWorkoutShareBusy === 'workout' ? 'Sharing workout...' : 'Share workout'),
        detail: data ? 'Post your workout summary to Feed.' : 'No completed workout ready.',
        disabled: !data || isBusy || postWorkoutShareCompleted.workout,
        onClick: sharePostWorkoutWorkoutToFeed
    }));

    if (pbs.length > 0) {
        pbs.forEach(function(pb, index) {
            const key = String(index);
            const value = typeof pbbFormatPBShareValue === 'function' ? pbbFormatPBShareValue(pb) : '';
            menu.appendChild(createPostWorkoutShareOption({
                title: postWorkoutShareCompleted.pbs[key] ? 'PB shared' : (postWorkoutShareBusy === 'pb:' + key ? 'Sharing PB...' : 'Share PB: ' + (pb.exercise || 'Personal best')),
                detail: value || 'Post this personal best to Feed.',
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
        detail: data ? 'Take a workout photo and post it to Feed.' : 'No completed workout ready.',
        disabled: !data || isBusy || postWorkoutShareCompleted.photo,
        onClick: sharePostWorkoutPhotoToFeed
    }));

    if (menu.style.display !== 'none') positionPostWorkoutShareMenu();
}

async function awardPostWorkoutFeedShareXP(photoTimestamp, photoHash) {
    if (workoutPointsEarnedThisSession.story) return null;
    if (!isWorkoutDurationEligibleForShareXP(false)) return null;
    return awardWorkoutSharePoint('story', photoTimestamp || new Date().toISOString(), photoHash || null);
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

        const message = xpResult?.success ? 'Workout shared to Feed. +1 XP earned.' : 'Workout shared to Feed.';
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

    setPostWorkoutShareMenuOpen(false);
    const key = String(index);
    postWorkoutShareBusy = 'pb:' + key;
    setPostWorkoutShareStatus('Sharing PB to Feed...');
    renderPostWorkoutShareMenu();

    try {
        const story = await sharePBCardToFeed(pbData);
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

        const message = xpResult?.success ? 'Photo shared to Feed. +1 XP earned.' : 'Photo shared to Feed.';
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

function buildWorkoutShareCardPayload() {
    if (!completedWorkoutDataForShare) return null;

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
        best: ex.bestKg > 0 ? `${ex.sets}x${ex.bestReps} @ ${pbbPointsFormatWeightFromKg(ex.bestKg)}` : (ex.bestReps > 0 ? `${ex.sets}x${ex.bestReps}` : `${ex.sets} sets`)
    }));

    let totalVolume = 0;
    (data.sets || []).forEach(set => {
        const kg = parseFloat(set.kg) || 0;
        const reps = parseInt(set.reps) || 0;
        totalVolume += kg * reps;
    });

    const pbs = (data.newPBs || []).map(pb => ({
        exercise: pb.exercise,
        type: pb.type,
        value: pb.value,
        reps: pb.reps,
        weight: pb.weight,
        improvement: pb.improvement
    }));

    return {
        card_type: 'workout',
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
    return {
        card_type: 'pb',
        exercise: pbData.exercise,
        pb_type: pbData.type,
        value: pbData.value,
        reps: pbData.reps,
        weight: pbData.weight,
        improvement: pbData.improvement,
        previous: pbData.previous != null ? pbData.previous : (pbData.improvement ? pbData.value - pbData.improvement : null)
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

async function pbbShareDrawFullBleedMealCard(ctx, cardPayload, width, height, target) {
    const isFeed = target === 'feed';
    // Keep the logo and all meal information clear of Instagram's top and
    // bottom chrome when the exported image is shown in the native share flow.
    const instagramSafeTop = isFeed ? 118 : 250;
    const instagramSafeBottom = isFeed ? 176 : 360;
    const panelX = 48;
    const panelW = width - 96;
    const panelH = isFeed ? 392 : 456;
    const panelY = Math.max(
        instagramSafeTop + 120,
        height - instagramSafeBottom - panelH
    );

    const lowerGradient = ctx.createLinearGradient(0, height * 0.46, 0, height);
    lowerGradient.addColorStop(0, 'rgba(4, 12, 9, 0)');
    lowerGradient.addColorStop(0.58, 'rgba(4, 12, 9, 0.28)');
    lowerGradient.addColorStop(1, 'rgba(4, 12, 9, 0.78)');
    ctx.fillStyle = lowerGradient;
    ctx.fillRect(0, 0, width, height);

    const upperGradient = ctx.createLinearGradient(0, 0, 0, instagramSafeTop + 180);
    upperGradient.addColorStop(0, 'rgba(4, 12, 9, 0.56)');
    upperGradient.addColorStop(1, 'rgba(4, 12, 9, 0)');
    ctx.fillStyle = upperGradient;
    ctx.fillRect(0, 0, width, instagramSafeTop + 180);

    try {
        const logo = await pbbShareLoadImage('balance_logo_transparent.png');
        ctx.save();
        ctx.globalAlpha = 0.94;
        ctx.drawImage(logo, 64, instagramSafeTop, 82, 82);
        ctx.restore();
    } catch (error) {
        console.warn('Could not draw transparent Balance logo:', error);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 29px Arial, sans-serif';
    ctx.fillText('BALANCE', 164, instagramSafeTop + 54);

    pbbShareFillRoundRect(ctx, panelX, panelY, panelW, panelH, 38, 'rgba(10, 15, 13, 0.62)');
    pbbShareRoundRect(ctx, panelX, panelY, panelW, panelH, 38);
    ctx.strokeStyle = 'rgba(255,255,255,0.72)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const contentX = panelX + 48;
    const contentW = panelW - 96;
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 52px Arial, sans-serif';
    let titleY = panelY + 72;
    titleY = pbbShareWrapText(
        ctx,
        String(cardPayload.foods || cardPayload.meal_type || 'Meal logged').toUpperCase(),
        contentX,
        titleY,
        contentW,
        58,
        2
    );

    const calories = Math.max(0, Math.round(Number(cardPayload.calories || 0)));
    const protein = Math.max(0, Math.round(Number(cardPayload.protein || 0)));
    const carbs = Math.max(0, Math.round(Number(cardPayload.carbs || 0)));
    const fat = Math.max(0, Math.round(Number(cardPayload.fat || 0)));
    const metrics = [
        [calories > 0 ? String(calories) : '-', 'kcal', '#f5c45c'],
        [`${protein}g`, 'protein', '#c9b7ff'],
        [`${carbs}g`, 'carbs', '#c9b7ff'],
        [`${fat}g`, 'fat', '#c9b7ff']
    ];
    const metricY = Math.max(panelY + 184, titleY + 20);
    const metricW = contentW / metrics.length;
    metrics.forEach((metric, index) => {
        const x = contentX + (index * metricW);
        if (index > 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.28)';
            ctx.fillRect(x, metricY - 8, 1, 108);
        }
        ctx.fillStyle = metric[2];
        ctx.font = '900 42px Arial, sans-serif';
        ctx.fillText(metric[0], x + (index === 0 ? 0 : 20), metricY + 42);
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.font = '750 22px Arial, sans-serif';
        ctx.fillText(metric[1], x + (index === 0 ? 0 : 20), metricY + 78);
    });

    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = '750 20px Arial, sans-serif';
    ctx.fillText('Fuel. Track. Level up.', contentX, panelY + panelH - 26);
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

async function renderBalanceShareCardImage(cardPayload, options = {}) {
    if (!cardPayload) throw new Error('Missing share card payload');

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

    if (primaryPhotoDataUrl) {
        try {
            const photo = await pbbShareLoadImage(primaryPhotoDataUrl);
            pbbShareDrawCoverImage(ctx, photo, 0, 0, width, height);
            ctx.fillStyle = cardType === 'meal'
                ? 'rgba(4, 12, 9, 0.18)'
                : 'rgba(4, 12, 9, 0.56)';
            ctx.fillRect(0, 0, width, height);
        } catch (e) {
            console.warn('Could not draw share background photo:', e);
        }
    }

    if (cardType === 'meal' && primaryPhotoDataUrl) {
        await pbbShareDrawFullBleedMealCard(ctx, cardPayload, width, height, target);
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

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 46px Arial, sans-serif';
    ctx.fillText('Train. Track. Level up.', 76, height - 98);
    ctx.font = '750 27px Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.fillText('Balance - Fitness Gamified', 76, height - 58);

    return canvas.toDataURL('image/jpeg', 0.92);
}

async function shareBalanceCardImageExternally(dataUrl, target, text) {
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

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast('Card saved. Upload it to Instagram from your photos.', 'info');
    return true;
}

async function shareBalanceCardWithNativeBridge(dataUrl, safeTarget) {
    const androidShare = window.NativePermissions && window.NativePermissions.shareImageToInstagram;
    if (typeof androidShare === 'function') {
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

async function shareBalanceCardToInstagram(cardPayload, target, options = {}) {
    if (!canUseBalanceInstagramShareTest()) {
        showToast('Instagram sharing is in test mode for now.', 'info');
        return false;
    }

    const safeTarget = target === 'feed' ? 'feed' : 'story';
    const dataUrl = await renderBalanceShareCardImage(cardPayload, {
        target: safeTarget,
        photoDataUrl: options.photoDataUrl || null,
        photoDataUrls: options.photoDataUrls || null
    });

    if (await shareBalanceCardWithNativeBridge(dataUrl, safeTarget)) {
        showToast(`Opening Instagram ${safeTarget === 'story' ? 'Story' : 'Feed'}...`, 'success');
        return true;
    }

    if (isBalanceNativeInstagramSurface()) {
        if (isLegacyIOSInstagramShareShell()) {
            return shareBalanceCardImageExternally(
                dataUrl,
                safeTarget,
                safeTarget === 'story' ? 'Share this to your Instagram Story' : 'Share this to your Instagram Feed'
            );
        }

        showToast('Could not open Instagram directly. Make sure Instagram and the latest Balance app are installed.', 'error');
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
window.pbbShareImageUrlToDataUrl = pbbShareImageUrlToDataUrl;

async function shareWorkoutCardToInstagram(target) {
    if (!canUseBalanceInstagramShareTest()) {
        showToast('Instagram sharing is in test mode for now.', 'info');
        updateWorkoutInstagramShareVisibility();
        return;
    }

    if (!completedWorkoutDataForShare) {
        showToast('No workout data to share', 'error');
        return;
    }

    const safeTarget = target === 'feed' ? 'feed' : 'story';
    const btn = document.getElementById(safeTarget === 'story' ? 'share-workout-ig-story-btn' : 'share-workout-ig-feed-btn');
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
                await shareWorkoutCardToInstagram(safeTarget);
            }, 'Take a workout photo');
            return;
        }

        const cardPayload = buildWorkoutShareCardPayload();
        await shareBalanceCardToInstagram(cardPayload, safeTarget, { photoDataUrl: cachedWorkoutShareBase64 });
    } catch (error) {
        console.error('Error sharing workout card to Instagram:', error);
        showToast('Could not open Instagram share. Please try again.', 'error');
    } finally {
        if (btn) {
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
    const btn = typeof index === 'number' ? document.getElementById(`share-pb-btn-${index}`) : null;
    const originalText = btn ? btn.textContent : '';
    if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.72';
        btn.textContent = 'Sharing...';
    }

    try {
        const story = await sharePBCardToFeed(pbData);
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
            const story = await sharePBCardToFeed(pendingPBShareData);
            if (story) markPBFeedShareDone();
        } else {
            const cardPayload = buildPBShareCardPayload(pendingPBShareData);
            await shareBalanceCardToInstagram(cardPayload, destination === 'instagram-feed' ? 'feed' : 'story');
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
    // Check if already earned story point this session
    if (workoutPointsEarnedThisSession.story) {
        showToast('You already earned the feed post point for this workout!', 'info');
        return;
    }

    if (!validateWorkoutDurationForShare()) return;

    if (!completedWorkoutDataForShare) {
        showToast('No workout data to share', 'error');
        return;
    }

    // Store context so we know this is a card share
    window._pendingCardShare = true;

    // Reuse the cached photo if the user already took one via the new UI.
    if (cachedWorkoutShareFile) {
        handleWorkoutCardPhotoCaptureFromFile(cachedWorkoutShareFile);
        return;
    }

    // Fallback: open the camera (legacy entry points)
    openWorkoutCamera((file) => {
        if (!file) return;
        handleWorkoutCardPhotoCaptureFromFile(file);
    }, 'Take a workout photo');
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

        // Award XP
        const photoTimestamp = new Date().toISOString();
        await awardWorkoutSharePoint('story', photoTimestamp, null);

        // Update button to show success
        if (btn) {
            btn.style.background = 'rgba(68, 255, 68, 0.3)';
            btn.style.border = '1px solid rgba(68, 255, 68, 0.5)';
            btn.innerHTML = '<span style="font-size:1.3rem;">✅</span><span style="font-size:0.95rem;">Shared! +1 XP</span>';
        }

        // Refresh feed if visible
        if (typeof loadPhotoFeed === 'function') {
            loadPhotoFeed('friends-photo-feed', 'friends-feed-empty');
        }

        showToast('Workout card shared to feed! +1 XP', 'success');

    } catch (error) {
        console.error('Error sharing workout card:', error);
        showToast('Failed to share workout card. Please try again.', 'error');

        if (btn) {
            btn.disabled = false;
            btn.querySelector('span:last-child').textContent = 'Balance Feed (+1 XP)';
        }
    }

    window._pendingCardShare = false;
}

// Share a PB achievement card to feed
async function sharePBCardToFeed(pbData) {
    if (!pbData) return;

    try {
        const cardPayload = buildPBShareCardPayload(pbData);

        const story = await dbHelpers.stories.create(window.currentUser.id, {
            media_type: 'workout_card',
            media_url: '',
            thumbnail_url: null,
            caption: JSON.stringify(cardPayload),
            duration: 5
        });

        console.log('PB card story created:', story);

        // Refresh feed if visible
        if (typeof loadPhotoFeed === 'function') {
            loadPhotoFeed('friends-photo-feed', 'friends-feed-empty');
        }

        showToast('PB shared to feed!', 'success');
        return story;

    } catch (error) {
        console.error('Error sharing PB card:', error);
        showToast('Failed to share PB. Please try again.', 'error');
        return null;
    }
}

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
                btn.innerHTML = '<span style="font-size:1rem;">🥗</span><span style="font-size:0.85rem;">Share Nutrition</span>';
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

        const story = await dbHelpers.stories.create(window.currentUser.id, {
            media_type: 'nutrition_card',
            media_url: '',
            thumbnail_url: null,
            caption: JSON.stringify(cardPayload),
            duration: 5
        });

        console.log('Nutrition card story created:', story);

        // Update button to show success
        if (btn) {
            btn.style.background = 'rgba(99, 102, 241, 0.2)';
            btn.style.border = '1px solid rgba(99, 102, 241, 0.4)';
            btn.innerHTML = '<span style="font-size:1rem;">✅</span><span style="font-size:0.85rem;">Shared!</span>';
        }

        // Refresh feed if visible
        if (typeof loadPhotoFeed === 'function') {
            loadPhotoFeed('friends-photo-feed', 'friends-feed-empty');
        }

        showToast('Nutrition card shared to feed!', 'success');

    } catch (error) {
        console.error('Error sharing nutrition card:', error);
        showToast('Failed to share. Please try again.', 'error');

        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span style="font-size:1rem;">🥗</span><span style="font-size:0.85rem;">Share Nutrition</span>';
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
        streak: streak
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
        await shareBalanceCardToInstagram(cardPayload, target === 'feed' ? 'feed' : 'story');
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
        activityIds: Array.isArray(activity.activityIds) ? activity.activityIds : [activity.id]
    };
    showActivitySuccess(savedActivityData);
};

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

    // Reset form UI
    document.getElementById('activity-label-input').value = activityPrefill.label || '';
    document.getElementById('activity-notes-input').value = activityPrefill.notes || '';
    document.getElementById('activity-duration-display').textContent = String(activityFormState.duration);
    document.getElementById('activity-photo-preview').style.display = 'none';
    document.getElementById('activity-photo-btn').style.display = 'flex';
    document.getElementById('activity-calories-display').textContent = '0';
    document.getElementById('activity-save-btn').disabled = false;
    document.getElementById('activity-save-btn').textContent = 'Log Activity';

    const isPilot = isMoveYourWayPilotUser();
    const title = document.querySelector('#view-log-activity h2');
    if (title) title.textContent = isPilot ? 'Log your movement' : 'Log Activity';
    const photoLabel = document.getElementById('activity-photo-heading');
    const photoHint = document.getElementById('activity-photo-hint');
    const notesHeading = document.getElementById('activity-notes-heading');
    if (photoLabel) photoLabel.textContent = isPilot ? 'Photo or workout screenshot' : 'Venue Photo';
    if (photoHint) photoHint.textContent = isPilot ? 'Optional. Add a photo now, or write a caption to make it your own.' : 'Photos of gyms, courts, pools, treadmills = XP. Outdoor scenery = no XP.';
    if (notesHeading) notesHeading.innerHTML = isPilot ? 'Caption <span style="font-weight:400; text-transform:none;">(optional)</span>' : 'Notes <span style="font-weight:400; text-transform:none;">(optional)</span>';

    // Build activity type grid
    const grid = document.getElementById('activity-type-grid');
    const visibleTypes = isPilot
        ? ACTIVITY_TYPES.filter(t => ['fitness_class', 'running', 'walking', 'cycling', 'pilates', 'other'].includes(t.key))
        : ACTIVITY_TYPES;
    grid.innerHTML = visibleTypes.map(t => `
        <button class="activity-type-choice" onclick="selectActivityType('${t.key}')" id="activity-type-btn-${t.key}" style="padding: 14px 8px; border-radius: 14px; border: 2px solid var(--border); background: var(--card-bg); cursor: pointer; text-align: center; transition: all 0.2s;">
            <div style="font-size: 1.5rem;">${t.emoji}</div>
            <div style="font-weight: 700; font-size: 0.75rem; margin-top: 4px; color: var(--text-main);">${t.label}</div>
        </button>
    `).join('');

    selectActivityIntensity(activityFormState.intensity);
    if (activityFormState.selectedType) {
        selectActivityType(activityFormState.selectedType);
    } else {
        updateActivityCalories();
    }

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
    activityFormState.selectedType = typeKey;
    // Update UI - highlight selected
    ACTIVITY_TYPES.forEach(t => {
        const btn = document.getElementById(`activity-type-btn-${t.key}`);
        if (btn) {
            btn.classList.toggle('is-selected', t.key === typeKey);
            if (t.key === typeKey) {
                btn.style.border = `2px solid ${t.color}`;
                btn.style.background = `${t.color}15`;
                btn.style.transform = 'scale(1.05)';
            } else {
                btn.style.border = '2px solid var(--border)';
                btn.style.background = 'var(--card-bg)';
                btn.style.transform = 'scale(1)';
            }
        }
    });
    updateActivityCalories();
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
        btn.style.border = isSelected ? '2px solid #0ea5e9' : '2px solid var(--border)';
        btn.style.background = isSelected ? 'rgba(14,165,233,0.1)' : 'var(--card-bg)';
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

    const saveBtn = document.getElementById('activity-save-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        const session = await window.authHelpers?.getSession();
        if (!session?.user) {
            showToast('Please log in to save activities', 'error');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Log Activity';
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
            notes: notes || null
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
            photoMimeType: activityFormState.photoMimeType
        };

        // Show success screen
        showActivitySuccess(savedActivityData);

    } catch (error) {
        console.error('Error saving activity:', error);
        showToast('Failed to save activity. Please try again.', 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Log Activity';
    }
}
window.saveActivity = saveActivity;

function showActivitySuccess(data) {
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

    // Reset share button
    const shareBtn = document.getElementById('activity-share-btn');
    shareBtn.disabled = false;
    document.getElementById('activity-share-btn-text').textContent = data.xpEligible ? 'Share Activity Card (+1 XP)' : 'Share Activity Card';

    window.history.pushState({ view: 'activity-success' }, '', '#activity-success');
}

async function shareActivityCardToFeed() {
    if (!savedActivityData) {
        showToast('No activity data to share', 'error');
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
            document.getElementById('activity-share-btn-text').textContent = 'Share Activity Card';
            return;
        }

        // Build card payload for feed rendering
        const cardPayload = {
            card_type: 'activity',
            activity_type: savedActivityData.activity_type,
            activity_label: savedActivityData.activity_label,
            duration: savedActivityData.duration + ' min',
            intensity: savedActivityData.intensity,
            calories: savedActivityData.calories,
            emoji: savedActivityData.emoji,
            venue_type: savedActivityData.venueType
        };

        // Create story in feed
        const storyData = {
            media_type: 'workout_card',
            media_url: '',
            caption: JSON.stringify(cardPayload),
            duration: 5
        };

        await window.dbHelpers?.stories?.create(window.currentUser.id, storyData);

        // Award XP if eligible
        if (savedActivityData.xpEligible) {
            await awardWorkoutSharePoint('story', Date.now(), null);

            const xpStatus = document.getElementById('activity-xp-status');
            xpStatus.style.display = 'block';
            xpStatus.style.background = 'rgba(68, 255, 68, 0.2)';
            xpStatus.style.border = '2px solid rgba(68, 255, 68, 0.5)';
            xpStatus.innerHTML = '<div style="font-weight:700; font-size:1.1rem;">+1 XP Earned! 🎉</div>';
        }

        // Update activity log record
        if (savedActivityData.id) {
            try {
                await window.dbHelpers?.activityLogs?.update(savedActivityData.id, {
                    shared_to_feed: true,
                    xp_awarded: savedActivityData.xpEligible
                });
                const additionalIds = (savedActivityData.activityIds || []).filter(id => id && id !== savedActivityData.id);
                await Promise.all(additionalIds.map(id => window.dbHelpers?.activityLogs?.update(id, { shared_to_feed: true })));
            } catch (e) {
                console.error('Failed to update activity log:', e);
            }
        }

        document.getElementById('activity-share-btn-text').textContent = '✅ Shared!';
        showToast('Activity shared to feed!', 'success');

        // Refresh feed in background
        if (typeof window.loadPhotoFeed === 'function') {
            window.loadPhotoFeed();
        }

    } catch (error) {
        console.error('Error sharing activity:', error);
        showToast('Failed to share. Please try again.', 'error');
        shareBtn.disabled = false;
        document.getElementById('activity-share-btn-text').textContent = 'Share Activity Card';
    }
}
window.shareActivityCardToFeed = shareActivityCardToFeed;

function closeLogActivity() {
    document.getElementById('view-log-activity').style.display = 'none';
    switchAppTab('movement-tab');
}
window.closeLogActivity = closeLogActivity;

function closeActivitySuccess() {
    // Grab activity info for rating before clearing
    const activityName = savedActivityData?.activity_label || savedActivityData?.activity_type || 'Activity';
    const activityId = savedActivityData?.id || null;

    document.getElementById('view-activity-success').style.display = 'none';
    switchAppTab('movement-tab');

    // Show post-workout rating modal for activity
    openWorkoutRatingModal(activityName, 'activity', activityId);
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
