// Video Logic
let currentVideoUrl = '';

function findVideoMatch(name) {
    if(EXERCISE_VIDEOS[name]) return EXERCISE_VIDEOS[name];

    // Check user's custom exercises cache for video
    if (window._customExercisesCache && window._customExercisesCache.length > 0) {
        const customMatch = window._customExercisesCache.find(ex => ex.exercise_name === name);
        if (customMatch && customMatch.video_url) return customMatch.video_url;
    }

    // Clean name logic: Remove common prefixes and trim
    const cleanName = name.replace(/(Dumbbell|Barbell|Body Weight|Band|Cable|Machine) /gi, '').trim();
    if(EXERCISE_VIDEOS[cleanName]) return EXERCISE_VIDEOS[cleanName];

    // Fuzzy Search (Simple Includes)
    const keys = Object.keys(EXERCISE_VIDEOS);

    // 1. Try to find a key that CONTAINS the clean name
    const partialMatch = keys.find(k => k.toLowerCase().includes(cleanName.toLowerCase()));
    if(partialMatch) return EXERCISE_VIDEOS[partialMatch];

    // 2. Try to find a key that is CONTAINED BY the clean name
    const reverseMatch = keys.find(k => cleanName.toLowerCase().includes(k.toLowerCase()));
    if(reverseMatch) return EXERCISE_VIDEOS[reverseMatch];

    return '';
}

// Inline video playback for workout cards
let currentInlineVideo = null;

function playInlineVideo(event, videoUrl) {
    event.stopPropagation();
    event.preventDefault();

    // Get the container that was clicked
    const container = event.currentTarget;
    const video = container.querySelector('video');
    const playOverlay = container.querySelector('.inline-play-overlay');

    if (!video || !videoUrl) return;

    // Stop any other playing inline video
    if (currentInlineVideo && currentInlineVideo !== video) {
        stopInlineVideo(currentInlineVideo);
    }

    // Check if video is already playing - if so, pause it
    if (!video.paused) {
        video.pause();
        if (playOverlay) playOverlay.style.display = 'flex';
        video.controls = false;
        currentInlineVideo = null;
        return;
    }

    // Hide play overlay and show controls
    if (playOverlay) playOverlay.style.display = 'none';
    video.controls = true;
    video.muted = false;

    // Set source directly on video element (currentSrc may be from source tag)
    if (!video.currentSrc || !video.currentSrc.includes('backblazeb2')) {
        video.src = videoUrl;
    }

    // Play the video
    video.play().catch(e => {
        console.error("Inline video play error:", e);
        if (playOverlay) playOverlay.style.display = 'flex';
        video.controls = false;
    });

    currentInlineVideo = video;

    // Listen for video end to reset
    video.onended = function() {
        if (playOverlay) playOverlay.style.display = 'flex';
        video.controls = false;
        video.currentTime = 0;
        currentInlineVideo = null;
    };

    // Listen for pause to show overlay
    video.onpause = function() {
        if (video.ended) return;
        // Small delay to allow user to use controls
        setTimeout(() => {
            if (video.paused && !video.ended) {
                if (playOverlay) playOverlay.style.display = 'flex';
            }
        }, 100);
    };
}

function stopInlineVideo(video) {
    if (!video) return;
    video.pause();
    video.currentTime = 0;
    video.controls = false;
    const container = video.closest('[data-video-container]');
    if (container) {
        const playOverlay = container.querySelector('.inline-play-overlay');
        if (playOverlay) playOverlay.style.display = 'flex';
    }
}

// =====================
// YOGA TIMER FUNCTIONS
// =====================

// Parse yoga time string (e.g., "2 min", "45 sec each", "5 breaths") to seconds
function parseYogaTimeToSeconds(timeStr) {
    if (!timeStr) return 60; // default 1 min

    const str = timeStr.toLowerCase().trim();

    // Handle "X breaths" - assume 5 seconds per breath
    const breathMatch = str.match(/(\d+)\s*breaths?/);
    if (breathMatch) {
        return parseInt(breathMatch[1]) * 5;
    }

    // Handle "X min" or "X minutes"
    const minMatch = str.match(/(\d+)\s*min/);
    if (minMatch) {
        return parseInt(minMatch[1]) * 60;
    }

    // Handle "X sec" or "X seconds"
    const secMatch = str.match(/(\d+)\s*sec/);
    if (secMatch) {
        return parseInt(secMatch[1]);
    }

    // Default to 60 seconds if unparseable
    return 60;
}

// Format seconds to display string (MM:SS)
function formatYogaTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

// Global yoga timer state
window.yogaTimers = {};

// Start yoga timer for a specific exercise
function startYogaTimer(exerciseIdx) {
    const timer = window.yogaTimers[exerciseIdx];
    if (!timer) return;

    const timerDisplay = document.getElementById(`yoga-timer-display-${exerciseIdx}`);
    const startBtn = document.getElementById(`yoga-timer-start-${exerciseIdx}`);
    const pauseBtn = document.getElementById(`yoga-timer-pause-${exerciseIdx}`);
    const resetBtn = document.getElementById(`yoga-timer-reset-${exerciseIdx}`);
    const progressRing = document.getElementById(`yoga-timer-progress-${exerciseIdx}`);

    if (timer.interval) {
        clearInterval(timer.interval);
    }

    timer.isRunning = true;
    startBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-flex';
    resetBtn.style.display = 'inline-flex';

    timer.interval = setInterval(() => {
        timer.remaining--;

        if (timer.remaining <= 0) {
            timer.remaining = 0;
            clearInterval(timer.interval);
            timer.interval = null;
            timer.isRunning = false;

            // Timer complete - play sound and show completion
            timerDisplay.textContent = '0:00';
            timerDisplay.style.color = 'var(--primary)';
            startBtn.textContent = '✓ Done';
            startBtn.style.display = 'inline-flex';
            startBtn.style.background = 'var(--primary)';
            startBtn.disabled = true;
            pauseBtn.style.display = 'none';

            // Update progress ring
            if (progressRing) {
                progressRing.style.strokeDashoffset = '0';
            }

            // Play completion sound if available
            try {
                const audio = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU');
            } catch(e) {}

            // Vibrate on mobile if available
            if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200]);
            }

            return;
        }

        timerDisplay.textContent = formatYogaTime(timer.remaining);

        // Update progress ring
        if (progressRing) {
            const circumference = 2 * Math.PI * 54; // radius 54
            const progress = timer.remaining / timer.total;
            const offset = circumference * progress;
            progressRing.style.strokeDashoffset = offset;
        }
    }, 1000);
}

// Pause yoga timer
function pauseYogaTimer(exerciseIdx) {
    const timer = window.yogaTimers[exerciseIdx];
    if (!timer) return;

    if (timer.interval) {
        clearInterval(timer.interval);
        timer.interval = null;
    }
    timer.isRunning = false;

    const startBtn = document.getElementById(`yoga-timer-start-${exerciseIdx}`);
    const pauseBtn = document.getElementById(`yoga-timer-pause-${exerciseIdx}`);

    startBtn.textContent = 'Resume';
    startBtn.style.display = 'inline-flex';
    pauseBtn.style.display = 'none';
}

// Reset yoga timer
function resetYogaTimer(exerciseIdx) {
    const timer = window.yogaTimers[exerciseIdx];
    if (!timer) return;

    if (timer.interval) {
        clearInterval(timer.interval);
        timer.interval = null;
    }
    timer.remaining = timer.total;
    timer.isRunning = false;

    const timerDisplay = document.getElementById(`yoga-timer-display-${exerciseIdx}`);
    const startBtn = document.getElementById(`yoga-timer-start-${exerciseIdx}`);
    const pauseBtn = document.getElementById(`yoga-timer-pause-${exerciseIdx}`);
    const resetBtn = document.getElementById(`yoga-timer-reset-${exerciseIdx}`);
    const progressRing = document.getElementById(`yoga-timer-progress-${exerciseIdx}`);

    timerDisplay.textContent = formatYogaTime(timer.total);
    timerDisplay.style.color = 'var(--text-main)';
    startBtn.textContent = 'Start';
    startBtn.style.display = 'inline-flex';
    startBtn.style.background = 'var(--primary)';
    startBtn.disabled = false;
    pauseBtn.style.display = 'none';
    resetBtn.style.display = 'none';

    // Reset progress ring
    if (progressRing) {
        const circumference = 2 * Math.PI * 54;
        progressRing.style.strokeDashoffset = circumference;
    }
}

// Clear all yoga timers when leaving workout
function clearAllYogaTimers() {
    Object.keys(window.yogaTimers).forEach(key => {
        const timer = window.yogaTimers[key];
        if (timer && timer.interval) {
            clearInterval(timer.interval);
        }
    });
    window.yogaTimers = {};
}

// ==========================================
// INTERVAL TIMER / STOPWATCH
// ==========================================

window.intervalTimerState = {
    workSeconds: 40,
    restSeconds: 20,
    totalRounds: 6,
    currentRound: 1,
    currentPhase: 'work', // 'work', 'rest', 'countdown'
    secondsLeft: 0,
    isRunning: false,
    isPaused: false,
    interval: null,
    audioCtx: null
};

function openIntervalTimer() {
    const view = document.getElementById('view-interval-timer');
    if (view) {
        view.style.display = 'block';
        pushNavigationState('view-interval-timer', closeIntervalTimer);
        document.getElementById('interval-timer-setup').style.display = 'block';
        document.getElementById('interval-timer-active').style.display = 'none';
        document.getElementById('interval-timer-done').style.display = 'none';
        document.getElementById('interval-timer-input').value = '';
        document.getElementById('interval-timer-preview').style.display = 'none';
        document.getElementById('interval-timer-manual').style.display = 'none';
        document.getElementById('interval-start-btn').style.display = 'none';
    }
}

function closeIntervalTimer() {
    // Stop any running timer
    if (window.intervalTimerState.interval) {
        clearInterval(window.intervalTimerState.interval);
        window.intervalTimerState.interval = null;
    }
    window.intervalTimerState.isRunning = false;
    window.intervalTimerState.isPaused = false;

    const view = document.getElementById('view-interval-timer');
    if (view) view.style.display = 'none';
}

// Parse natural language timer input
function parseTimerInput(input) {
    const text = input.trim().toLowerCase();
    let work = null, rest = null, rounds = null;

    // Presets
    if (text === 'tabata') return { work: 20, rest: 10, rounds: 8 };
    if (/^emom\s*(\d+)\s*(min|minutes?)?$/i.test(text)) {
        const m = text.match(/^emom\s*(\d+)/i);
        return { work: 60, rest: 0, rounds: parseInt(m[1]) };
    }

    // Pattern: "40/20 x6", "40/20 6 rounds", "40/20 6"
    const slashPattern = /(\d+)\s*\/\s*(\d+)\s*(?:x|×)?\s*(\d+)?(?:\s*rounds?)?/i;
    const slashMatch = text.match(slashPattern);
    if (slashMatch) {
        work = parseInt(slashMatch[1]);
        rest = parseInt(slashMatch[2]);
        rounds = slashMatch[3] ? parseInt(slashMatch[3]) : 6;
        return { work, rest, rounds };
    }

    // Pattern: "30 on 10 off 8 rounds"
    const onOffPattern = /(\d+)\s*(?:sec(?:onds?)?\s+)?on\s+(\d+)\s*(?:sec(?:onds?)?\s+)?off\s+(\d+)\s*(?:rounds?|sets?|x|times?)?/i;
    const onOffMatch = text.match(onOffPattern);
    if (onOffMatch) {
        return { work: parseInt(onOffMatch[1]), rest: parseInt(onOffMatch[2]), rounds: parseInt(onOffMatch[3]) };
    }

    // Pattern: "30 on 10 off" (no rounds)
    const onOffNoRounds = /(\d+)\s*(?:sec(?:onds?)?\s+)?on\s+(\d+)\s*(?:sec(?:onds?)?\s+)?off/i;
    const onOffNR = text.match(onOffNoRounds);
    if (onOffNR) {
        return { work: parseInt(onOffNR[1]), rest: parseInt(onOffNR[2]), rounds: 6 };
    }

    // Pattern: "30 work 10 rest 8 rounds"
    const workRestPattern = /(\d+)\s*(?:sec(?:onds?)?\s+)?(?:work|go|on)\s+(\d+)\s*(?:sec(?:onds?)?\s+)?(?:rest|off|break)\s+(\d+)\s*(?:rounds?|sets?|x|times?)?/i;
    const workRestMatch = text.match(workRestPattern);
    if (workRestMatch) {
        return { work: parseInt(workRestMatch[1]), rest: parseInt(workRestMatch[2]), rounds: parseInt(workRestMatch[3]) };
    }

    // Pattern: just "X rounds" with numbers already set
    const justRounds = /^(\d+)\s*(?:rounds?|sets?)$/i;
    const justRoundsMatch = text.match(justRounds);
    if (justRoundsMatch) {
        return { work: 40, rest: 20, rounds: parseInt(justRoundsMatch[1]) };
    }

    // Pattern: two numbers like "40 20" (work rest)
    const twoNums = /^(\d+)\s+(\d+)$/;
    const twoMatch = text.match(twoNums);
    if (twoMatch) {
        return { work: parseInt(twoMatch[1]), rest: parseInt(twoMatch[2]), rounds: 6 };
    }

    // Pattern: three numbers like "40 20 6"
    const threeNums = /^(\d+)\s+(\d+)\s+(\d+)$/;
    const threeMatch = text.match(threeNums);
    if (threeMatch) {
        return { work: parseInt(threeMatch[1]), rest: parseInt(threeMatch[2]), rounds: parseInt(threeMatch[3]) };
    }

    return null;
}

function parseAndPreviewTimer() {
    const input = document.getElementById('interval-timer-input').value;
    const parsed = parseTimerInput(input);
    if (!parsed) return;

    document.getElementById('interval-work-input').value = parsed.work;
    document.getElementById('interval-rest-input').value = parsed.rest;
    document.getElementById('interval-rounds-input').value = parsed.rounds;
    updateIntervalPreview();
}

function loadIntervalPreset(work, rest, rounds, name) {
    document.getElementById('interval-timer-input').value = name;
    document.getElementById('interval-work-input').value = work;
    document.getElementById('interval-rest-input').value = rest;
    document.getElementById('interval-rounds-input').value = rounds;
    updateIntervalPreview();
}

function adjustIntervalValue(type, delta) {
    const inputId = type === 'work' ? 'interval-work-input' : type === 'rest' ? 'interval-rest-input' : 'interval-rounds-input';
    const input = document.getElementById(inputId);
    const min = type === 'rounds' ? 1 : (type === 'rest' ? 0 : 5);
    const max = type === 'rounds' ? 100 : 300;
    let val = parseInt(input.value) || 0;
    val = Math.max(min, Math.min(max, val + delta));
    input.value = val;
    updateIntervalPreview();
}

function updateIntervalPreview() {
    const work = parseInt(document.getElementById('interval-work-input').value) || 0;
    const rest = parseInt(document.getElementById('interval-rest-input').value) || 0;
    const rounds = parseInt(document.getElementById('interval-rounds-input').value) || 1;

    const totalSec = (work + rest) * rounds;
    const totalMin = Math.floor(totalSec / 60);
    const totalRemSec = totalSec % 60;
    const totalStr = totalRemSec > 0 ? `${totalMin}:${String(totalRemSec).padStart(2, '0')}` : `${totalMin}:00`;

    const restLabel = rest > 0 ? ` / ${rest}s Rest` : ' (no rest)';
    document.getElementById('interval-preview-title').textContent = `${work}s Work${restLabel}`;
    document.getElementById('interval-preview-subtitle').textContent = `${rounds} round${rounds > 1 ? 's' : ''} \u00b7 ${totalStr} total`;
    document.getElementById('interval-preview-work').textContent = `${work}s`;
    document.getElementById('interval-preview-rest').textContent = `${rest}s`;
    document.getElementById('interval-preview-rounds').textContent = rounds;

    document.getElementById('interval-timer-preview').style.display = 'block';
    document.getElementById('interval-timer-manual').style.display = 'block';
    document.getElementById('interval-start-btn').style.display = 'block';
}

function formatTimerSeconds(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${String(sec).padStart(2, '0')}` : `${sec}`;
}

// Audio beep using Web Audio API
function playTimerBeep(type) {
    try {
        if (!window.intervalTimerState.audioCtx) {
            window.intervalTimerState.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        const ctx = window.intervalTimerState.audioCtx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'work') {
            // High double beep for work
            osc.frequency.value = 880;
            gain.gain.value = 0.3;
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.15);
            // Second beep
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.frequency.value = 880;
            gain2.gain.value = 0.3;
            osc2.start(ctx.currentTime + 0.2);
            osc2.stop(ctx.currentTime + 0.35);
        } else if (type === 'rest') {
            // Lower single beep for rest
            osc.frequency.value = 440;
            gain.gain.value = 0.25;
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
        } else if (type === 'done') {
            // Triple high beep for done
            osc.frequency.value = 1047;
            gain.gain.value = 0.3;
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.15);
            for (let i = 1; i <= 2; i++) {
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.connect(g);
                g.connect(ctx.destination);
                o.frequency.value = 1047;
                g.gain.value = 0.3;
                o.start(ctx.currentTime + i * 0.2);
                o.stop(ctx.currentTime + i * 0.2 + 0.15);
            }
        } else if (type === 'tick') {
            // Soft tick for last 3 seconds
            osc.frequency.value = 660;
            gain.gain.value = 0.15;
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.08);
        }

        // Also vibrate if supported
        if (navigator.vibrate) {
            if (type === 'done') navigator.vibrate([200, 100, 200, 100, 200]);
            else if (type === 'work' || type === 'rest') navigator.vibrate(150);
        }
    } catch (e) { /* audio not available */ }
}

function renderRoundDots() {
    const st = window.intervalTimerState;
    const container = document.getElementById('interval-round-dots');
    if (!container) return;
    let html = '';
    for (let i = 1; i <= st.totalRounds; i++) {
        const isActive = i === st.currentRound;
        const isComplete = i < st.currentRound;
        const bg = isComplete ? '#22c55e' : (isActive ? (st.currentPhase === 'work' ? '#f59e0b' : '#3b82f6') : '#e2e8f0');
        const size = isActive ? '14px' : '10px';
        html += `<div style="width:${size}; height:${size}; border-radius:50%; background:${bg}; transition: all 0.3s;"></div>`;
    }
    container.innerHTML = html;
}

function updateTimerRing() {
    const st = window.intervalTimerState;
    const ring = document.getElementById('interval-timer-ring');
    if (!ring) return;

    const totalForPhase = st.currentPhase === 'work' ? st.workSeconds : st.restSeconds;
    const fraction = totalForPhase > 0 ? (totalForPhase - st.secondsLeft) / totalForPhase : 0;
    const circumference = 2 * Math.PI * 115; // r=115
    ring.setAttribute('stroke-dashoffset', (fraction * circumference).toFixed(2));

    // Color: amber for work, blue for rest
    ring.setAttribute('stroke', st.currentPhase === 'work' ? '#f59e0b' : '#3b82f6');
}

function startIntervalTimer() {
    const st = window.intervalTimerState;

    st.workSeconds = parseInt(document.getElementById('interval-work-input').value) || 40;
    st.restSeconds = parseInt(document.getElementById('interval-rest-input').value) || 0;
    st.totalRounds = parseInt(document.getElementById('interval-rounds-input').value) || 6;
    st.currentRound = 1;
    st.currentPhase = 'work';
    st.secondsLeft = st.workSeconds;
    st.isRunning = true;
    st.isPaused = false;

    // Show active timer, hide setup
    document.getElementById('interval-timer-setup').style.display = 'none';
    document.getElementById('interval-timer-active').style.display = 'block';
    document.getElementById('interval-timer-done').style.display = 'none';

    // Init display
    document.getElementById('interval-timer-phase').textContent = 'WORK';
    document.getElementById('interval-timer-phase').style.color = '#f59e0b';
    document.getElementById('interval-timer-display').textContent = formatTimerSeconds(st.secondsLeft);
    document.getElementById('interval-timer-round').textContent = `Round ${st.currentRound} / ${st.totalRounds}`;
    document.getElementById('interval-pause-btn').textContent = 'Pause';
    renderRoundDots();
    updateTimerRing();

    playTimerBeep('work');

    // Start ticking
    if (st.interval) clearInterval(st.interval);
    st.interval = setInterval(tickIntervalTimer, 1000);
}

function tickIntervalTimer() {
    const st = window.intervalTimerState;
    if (!st.isRunning || st.isPaused) return;

    st.secondsLeft--;

    // Countdown ticks for last 3 seconds
    if (st.secondsLeft > 0 && st.secondsLeft <= 3) {
        playTimerBeep('tick');
    }

    if (st.secondsLeft <= 0) {
        // Phase ended
        if (st.currentPhase === 'work') {
            if (st.restSeconds > 0) {
                // Switch to rest
                st.currentPhase = 'rest';
                st.secondsLeft = st.restSeconds;
                document.getElementById('interval-timer-phase').textContent = 'REST';
                document.getElementById('interval-timer-phase').style.color = '#3b82f6';
                playTimerBeep('rest');
            } else {
                // No rest - advance round
                advanceIntervalRound();
                return;
            }
        } else {
            // Rest ended - advance round
            advanceIntervalRound();
            return;
        }
    }

    document.getElementById('interval-timer-display').textContent = formatTimerSeconds(st.secondsLeft);
    updateTimerRing();
    renderRoundDots();
}

function advanceIntervalRound() {
    const st = window.intervalTimerState;

    if (st.currentRound >= st.totalRounds) {
        // All rounds done
        completeIntervalTimer();
        return;
    }

    st.currentRound++;
    st.currentPhase = 'work';
    st.secondsLeft = st.workSeconds;

    document.getElementById('interval-timer-phase').textContent = 'WORK';
    document.getElementById('interval-timer-phase').style.color = '#f59e0b';
    document.getElementById('interval-timer-round').textContent = `Round ${st.currentRound} / ${st.totalRounds}`;
    document.getElementById('interval-timer-display').textContent = formatTimerSeconds(st.secondsLeft);
    updateTimerRing();
    renderRoundDots();
    playTimerBeep('work');
}

function completeIntervalTimer() {
    const st = window.intervalTimerState;

    clearInterval(st.interval);
    st.interval = null;
    st.isRunning = false;

    playTimerBeep('done');

    // Calculate total time
    const totalSec = (st.workSeconds + st.restSeconds) * st.totalRounds;
    const totalMin = Math.floor(totalSec / 60);
    const totalRemSec = totalSec % 60;
    const totalStr = totalRemSec > 0 ? `${totalMin}:${String(totalRemSec).padStart(2, '0')}` : `${totalMin}:00`;

    document.getElementById('interval-timer-active').style.display = 'none';
    document.getElementById('interval-timer-done').style.display = 'block';
    document.getElementById('interval-done-summary').textContent = `${st.totalRounds} rounds completed \u00b7 ${totalStr}`;
}

function togglePauseIntervalTimer() {
    const st = window.intervalTimerState;
    st.isPaused = !st.isPaused;
    document.getElementById('interval-pause-btn').textContent = st.isPaused ? 'Resume' : 'Pause';
    document.getElementById('interval-pause-btn').style.background = st.isPaused ? '#22c55e' : '#f59e0b';
}

function resetIntervalTimer() {
    const st = window.intervalTimerState;
    if (st.interval) {
        clearInterval(st.interval);
        st.interval = null;
    }
    st.isRunning = false;
    st.isPaused = false;

    document.getElementById('interval-timer-setup').style.display = 'block';
    document.getElementById('interval-timer-active').style.display = 'none';
    document.getElementById('interval-timer-done').style.display = 'none';
}

function skipIntervalPhase() {
    const st = window.intervalTimerState;
    if (!st.isRunning) return;

    st.secondsLeft = 0;
    // Manually trigger the tick logic
    tickIntervalTimer();
}

// ==========================================
// END INTERVAL TIMER
// ==========================================

let pendingVideoUrl = '';

function playVideo() {
    const direct = document.getElementById('video-direct');
    const poster = document.getElementById('video-poster');

    if(poster) poster.style.display = 'none';

    // Play Backblaze B2 video in native player
    if (direct && pendingVideoUrl) {
        direct.style.display = 'block';
        direct.src = pendingVideoUrl;
        direct.play().catch(e => {
            console.error("Video play error:", e);
            alert("Unable to play video. The video file may not be accessible.");
        });
    }
}

function openExerciseVideo(url, title, autoplay = false) {
    console.log("Opening video for:", title);

    // 1. Resolve URL if missing
    if (!url) {
        url = findVideoMatch(title);
        if(!url) {
            console.log("No video found for:", title);
            alert("Video coming soon for: " + title);
            return;
        }
    }

    // 2. Check if this is a Google Drive video (not yet migrated)
    if (url.includes('drive.google.com')) {
        alert(`This video hasn't been migrated yet.\n\n"${title}" is still on Google Drive and needs to be uploaded to Backblaze B2.\n\nPlease check the migration list.`);
        console.log("Google Drive video not migrated:", title, url);
        return;
    }

    // 3. Only support Backblaze B2 and direct video files
    if (!url.includes('backblazeb2.com') && !url.match(/\.(mp4|mov|webm)$/i)) {
        alert(`Unsupported video format.\n\nOnly Backblaze B2 videos are supported. This video needs to be migrated: "${title}"`);
        console.log("Unsupported video format:", title, url);
        return;
    }

    // 4. Setup video for Backblaze B2
    let embedUrl = url;
    let viewUrl = url;
    let type = 'b2'; // Backblaze B2 native video

    // 5. Setup Modal State
    currentVideoUrl = viewUrl;
    pendingVideoUrl = embedUrl;
    window.pendingVideoType = type;

    // 6. Setup Modal
    const modal = document.getElementById('video-modal');
    const direct = document.getElementById('video-direct');
    const poster = document.getElementById('video-poster');
    const titleEl = document.getElementById('video-modal-title');

    if(titleEl) titleEl.innerText = title;

    // Reset video player
    if(direct) {
        direct.src = '';
        direct.style.display = 'none';
    }

    // Show poster with play button
    if(poster) {
        poster.style.display = 'flex';
        poster.style.backgroundImage = 'none'; // B2 videos don't have thumbnails
    }

    modal.style.display = 'flex';

    // Autoplay and auto-close for Easter egg videos
    if (autoplay && direct) {
        // Auto-play the video after a short delay
        setTimeout(() => {
            playVideo();

            // Add event listener to close modal when video ends
            const handleVideoEnd = () => {
                closeVideoModal();
                direct.removeEventListener('ended', handleVideoEnd);
            };
            direct.addEventListener('ended', handleVideoEnd);
        }, 500);
    }
}

function openVideoNewTab() {
    if(currentVideoUrl) window.open(currentVideoUrl, '_blank');
}

function closeVideoModal() {
    const modal = document.getElementById('video-modal');
    const direct = document.getElementById('video-direct');

    modal.style.display = 'none';

    // Stop video player
    if(direct) {
        direct.pause();
        direct.src = '';
    }
}

// Close on background click
document.getElementById('video-modal').addEventListener('click', function(e) {
    if (e.target === this) closeVideoModal();
});
