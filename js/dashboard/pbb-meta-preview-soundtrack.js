(function () {
  'use strict';

  if (window.metaAdTrialMode !== true || window.BalanceMetaPreviewSoundtrack) return;

  const STORAGE_KEY = 'pbb_meta_preview_music_muted_v1';
  const CONTROL_ID = 'meta-preview-music-control';
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const chordProgression = [
    [130.81, 164.81, 196.00, 246.94],
    [110.00, 130.81, 164.81, 196.00],
    [87.31, 130.81, 174.61, 220.00],
    [98.00, 146.83, 196.00, 220.00]
  ];
  const phaseVolumes = {
    setup: 0.34,
    tour: 0.28,
    course: 0.09,
    voice: 0,
    weekly_goals: 0.3,
    payment: 0.32
  };

  let context = null;
  let masterGain = null;
  let toneFilter = null;
  let scheduler = null;
  let chordIndex = 0;
  let started = false;
  let stopped = false;
  let voicePlaying = false;
  let phase = 'setup';
  let muted = false;
  try { muted = localStorage.getItem(STORAGE_KEY) === '1'; } catch (_) {}

  function currentVolume() {
    if (muted || voicePlaying || stopped) return 0;
    return Object.prototype.hasOwnProperty.call(phaseVolumes, phase) ? phaseVolumes[phase] : phaseVolumes.tour;
  }

  function fadeToCurrentVolume(duration) {
    if (!context || !masterGain) return;
    const now = context.currentTime;
    const gain = masterGain.gain;
    try {
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(Math.max(0.0001, gain.value || 0.0001), now);
      gain.linearRampToValueAtTime(currentVolume(), now + (duration || 0.8));
    } catch (_) {
      gain.value = currentVolume();
    }
  }

  function scheduleChord() {
    if (!context || stopped) return;
    const startAt = context.currentTime + 0.04;
    const duration = 7.4;
    const chord = chordProgression[chordIndex % chordProgression.length];
    const chordGain = context.createGain();
    chordGain.gain.setValueAtTime(0.0001, startAt);
    chordGain.gain.exponentialRampToValueAtTime(0.032, startAt + 1.45);
    chordGain.gain.setValueAtTime(0.032, startAt + 4.6);
    chordGain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    chordGain.connect(toneFilter);

    chord.forEach(function (frequency, noteIndex) {
      const oscillator = context.createOscillator();
      oscillator.type = noteIndex === 0 ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(frequency, startAt);
      oscillator.detune.setValueAtTime(noteIndex % 2 ? 2.5 : -2.5, startAt);
      oscillator.connect(chordGain);
      oscillator.start(startAt);
      oscillator.stop(startAt + duration + 0.08);
    });

    const accent = context.createOscillator();
    const accentGain = context.createGain();
    accent.type = 'sine';
    accent.frequency.setValueAtTime(chord[3] * 2, startAt + 1.9);
    accentGain.gain.setValueAtTime(0.0001, startAt + 1.9);
    accentGain.gain.exponentialRampToValueAtTime(0.0045, startAt + 2.08);
    accentGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 3.8);
    accent.connect(accentGain);
    accentGain.connect(toneFilter);
    accent.start(startAt + 1.9);
    accent.stop(startAt + 3.9);
    chordIndex += 1;
  }

  function buildAudioGraph() {
    context = new AudioContextClass();
    masterGain = context.createGain();
    masterGain.gain.value = 0.0001;
    toneFilter = context.createBiquadFilter();
    toneFilter.type = 'lowpass';
    toneFilter.frequency.value = 820;
    toneFilter.Q.value = 0.35;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 18;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.08;
    compressor.release.value = 0.7;
    toneFilter.connect(masterGain);
    masterGain.connect(compressor);
    compressor.connect(context.destination);
  }

  async function start() {
    if (started || stopped || muted || !AudioContextClass) return;
    started = true;
    try {
      buildAudioGraph();
      await context.resume();
      scheduleChord();
      scheduler = window.setInterval(scheduleChord, 6000);
      fadeToCurrentVolume(1.2);
      try {
        window.trackBalanceActivity('meta_preview_soundtrack_started', { phase: phase }, { dedupeKey: 'soundtrack', dedupeMs: 86400000 });
      } catch (_) {}
    } catch (error) {
      started = false;
      if (scheduler) window.clearInterval(scheduler);
      scheduler = null;
      console.warn('[meta preview] soundtrack unavailable', error);
    }
  }

  function setPhase(nextPhase) {
    phase = phaseVolumes[nextPhase] === undefined ? 'tour' : nextPhase;
    fadeToCurrentVolume(phase === 'voice' ? 0.45 : 0.9);
  }

  function setVoicePlaying(isPlaying) {
    voicePlaying = !!isPlaying;
    fadeToCurrentVolume(isPlaying ? 0.35 : 1.1);
  }

  function updateControl() {
    const control = document.getElementById(CONTROL_ID);
    if (!control) return;
    control.setAttribute('aria-pressed', muted ? 'true' : 'false');
    control.setAttribute('aria-label', muted ? 'Turn background music on' : 'Turn background music off');
    control.innerHTML = '<span aria-hidden="true">' + (muted ? '&#128263;' : '&#128266;') + '</span><span>Music ' + (muted ? 'off' : 'on') + '</span>';
  }

  function setMuted(nextMuted, source) {
    muted = !!nextMuted;
    try { localStorage.setItem(STORAGE_KEY, muted ? '1' : '0'); } catch (_) {}
    updateControl();
    if (!muted && !started) start();
    fadeToCurrentVolume(0.45);
    try {
      window.trackBalanceActivity('meta_preview_soundtrack_toggled', { muted: muted, source: source || 'control' }, { immediate: true });
    } catch (_) {}
  }

  function createControl() {
    if (document.getElementById(CONTROL_ID) || !AudioContextClass) return;
    const style = document.createElement('style');
    style.textContent = [
      '#meta-preview-music-control{position:fixed;right:12px;top:calc(12px + env(safe-area-inset-top,0px));z-index:400004;display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(183,138,46,.48);border-radius:999px;background:rgba(26,32,44,.92);color:#fffaf0;-webkit-text-fill-color:#fffaf0;padding:8px 11px;font:800 11px/1.1 inherit;letter-spacing:.03em;box-shadow:0 8px 24px rgba(26,32,44,.2);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);cursor:pointer;touch-action:manipulation}',
      '#meta-preview-music-control:focus-visible{outline:3px solid rgba(216,178,94,.75);outline-offset:2px}',
      '#meta-preview-music-control span:first-child{font-size:14px;line-height:1}',
      '@media(max-width:390px){#meta-preview-music-control{right:8px;padding:7px 9px;font-size:10px}}'
    ].join('');
    document.head.appendChild(style);

    const control = document.createElement('button');
    control.id = CONTROL_ID;
    control.type = 'button';
    control.addEventListener('click', function () { setMuted(!muted, 'control'); });
    document.body.appendChild(control);
    updateControl();
  }

  function isWelcomeVoice(target) {
    return !!(target && target.matches && target.matches('#meta-ad-trial-welcome-audio,#balance-onboarding-welcome-audio,#social-journey-welcome-audio'));
  }

  function installMediaDucking() {
    document.addEventListener('play', function (event) {
      if (isWelcomeVoice(event.target)) setVoicePlaying(true);
    }, true);
    document.addEventListener('pause', function (event) {
      if (isWelcomeVoice(event.target)) setVoicePlaying(false);
    }, true);
    document.addEventListener('ended', function (event) {
      if (isWelcomeVoice(event.target)) setVoicePlaying(false);
    }, true);
  }

  function stop() {
    stopped = true;
    fadeToCurrentVolume(0.5);
    if (scheduler) window.clearInterval(scheduler);
    scheduler = null;
    window.setTimeout(function () {
      if (context && typeof context.close === 'function') context.close().catch(function () {});
      context = null;
      masterGain = null;
      toneFilter = null;
    }, 650);
    const control = document.getElementById(CONTROL_ID);
    if (control) control.remove();
  }

  function install() {
    createControl();
    installMediaDucking();
    const unlock = function () {
      if (!muted) start();
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('touchstart', unlock, true);
      document.removeEventListener('keydown', unlock, true);
    };
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('touchstart', unlock, true);
    document.addEventListener('keydown', unlock, true);
    document.addEventListener('visibilitychange', function () {
      if (!context) return;
      if (document.hidden) context.suspend().catch(function () {});
      else if (!muted && !stopped) context.resume().catch(function () {});
    });
  }

  window.BalanceMetaPreviewSoundtrack = {
    start: start,
    stop: stop,
    setPhase: setPhase,
    setVoicePlaying: setVoicePlaying,
    setMuted: setMuted,
    isMuted: function () { return muted; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
