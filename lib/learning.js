/**
 * Learning System - Duolingo-style fitness education
 * Handles UI rendering, game logic, and progress tracking
 * Enhanced with Duolingo-inspired animations and interactions
 */

import { MODULES, UNITS, LEARNING_XP, GAME_TYPES, getUnitsForModule, getModulesSorted } from './learning-config.js';
import { LESSONS, getLessonsForUnit, getLessonById } from './learning-lessons.js';

// =============================================================================
// STATE
// =============================================================================

let learningState = {
  currentModule: null,
  currentUnit: null,
  currentLesson: null,
  currentGameIndex: 0,
  gamesCorrect: 0,
  gamesPlayed: 0,
  userProgress: null,
  isLoading: false,
  // Duolingo-style additions
  currentStreak: 0,
  maxStreak: 0,
  soundEnabled: true,
  animationsEnabled: true,
  // Interactive reading mode: 'normal', 'focus', 'speed', 'rsvp'
  readingMode: 'focus',
  rsvpState: {
    isPlaying: false,
    wordIndex: 0,
    speed: 250, // ms per word
    intervalId: null
  }
};

// =============================================================================
// SOUND EFFECTS (using Web Audio API)
// =============================================================================

const sounds = {
  correct: null,
  incorrect: null,
  complete: null,
  streak: null,
};

function initSounds() {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  // Correct answer sound - pleasant ascending tone
  sounds.correct = () => {
    if (!learningState.soundEnabled) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
    osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.3);
  };

  // Incorrect answer sound - soft descending tone
  sounds.incorrect = () => {
    if (!learningState.soundEnabled) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(330, audioCtx.currentTime);
    osc.frequency.setValueAtTime(294, audioCtx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.3);
  };

  // Streak sound - triumphant chord
  sounds.streak = () => {
    if (!learningState.soundEnabled) return;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc.start(audioCtx.currentTime + i * 0.05);
      osc.stop(audioCtx.currentTime + 0.5);
    });
  };

  // Complete sound - celebratory fanfare
  sounds.complete = () => {
    if (!learningState.soundEnabled) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.1);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.1 + 0.4);
      osc.start(audioCtx.currentTime + i * 0.1);
      osc.stop(audioCtx.currentTime + i * 0.1 + 0.4);
    });
  };
}

// =============================================================================
// CONFETTI SYSTEM
// =============================================================================

function createConfetti(count = 50, colors = ['#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6']) {
  const container = document.createElement('div');
  container.className = 'confetti-container';
  container.id = 'confetti-container';
  document.body.appendChild(container);

  for (let i = 0; i < count; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti-piece';
    confetti.style.left = Math.random() * 100 + 'vw';
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
    confetti.style.animationDelay = Math.random() * 0.5 + 's';

    // Random shapes
    const shapes = ['circle', 'square', 'triangle'];
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    if (shape === 'circle') {
      confetti.style.borderRadius = '50%';
    } else if (shape === 'triangle') {
      confetti.style.width = '0';
      confetti.style.height = '0';
      confetti.style.borderLeft = '5px solid transparent';
      confetti.style.borderRight = '5px solid transparent';
      confetti.style.borderBottom = '10px solid ' + confetti.style.backgroundColor;
      confetti.style.backgroundColor = 'transparent';
    }

    container.appendChild(confetti);
  }

  // Clean up after animation
  setTimeout(() => container.remove(), 4000);
}

function createParticleBurst(x, y, color = '#10b981', count = 12) {
  const container = document.createElement('div');
  container.style.cssText = `position: fixed; left: ${x}px; top: ${y}px; pointer-events: none; z-index: 9999;`;
  document.body.appendChild(container);

  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    const angle = (i / count) * Math.PI * 2;
    const velocity = 50 + Math.random() * 30;
    particle.className = 'particle';
    particle.style.cssText = `
      background: ${color};
      --tx: ${Math.cos(angle) * velocity}px;
      --ty: ${Math.sin(angle) * velocity}px;
    `;
    container.appendChild(particle);
  }

  setTimeout(() => container.remove(), 1000);
}

// =============================================================================
// CHARACTER REACTIONS (Duolingo-style mascot feedback)
// =============================================================================

const characterEmojis = {
  correct: ['🎉', '✨', '💪', '🌟', '🔥', '👏', '💚'],
  incorrect: ['🤔', '💭', '🧠', '📚', '💡'],
  streak: ['🔥', '⚡', '🚀', '💥', '⭐'],
  perfect: ['🏆', '👑', '🎯', '💯', '🌈'],
  encouragement: ['💪', '🌱', '🧠', '✨', '🎯'],
};

function getRandomEmoji(type) {
  const emojis = characterEmojis[type] || characterEmojis.encouragement;
  return emojis[Math.floor(Math.random() * emojis.length)];
}

const feedbackMessages = {
  correct: [
    "Nailed it!",
    "You got it!",
    "Brilliant!",
    "Exactly right!",
    "Perfect!",
    "Great thinking!",
    "You're on fire!",
  ],
  incorrect: [
    "Almost there!",
    "Not quite...",
    "Good try!",
    "Keep learning!",
    "You'll get it!",
  ],
  streak3: ["3 in a row! 🔥", "Hat trick!", "Triple threat!"],
  streak5: ["5 streak! Amazing!", "On a roll!", "Unstoppable!"],
  streak10: ["10 streak! LEGENDARY!", "Incredible run!", "Master learner!"],
};

function getRandomMessage(type) {
  const messages = feedbackMessages[type] || feedbackMessages.correct;
  return messages[Math.floor(Math.random() * messages.length)];
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize learning tab when opened
 */
export async function initLearning() {
  learningState.isLoading = true;
  renderLearningLoading();

  // Load CSS animations if not already loaded
  if (!document.getElementById('learning-animations-css')) {
    const link = document.createElement('link');
    link.id = 'learning-animations-css';
    link.rel = 'stylesheet';
    link.href = '/lib/learning-animations.css';
    document.head.appendChild(link);
  }

  // Initialize sound system on first user interaction
  if (!sounds.correct) {
    try {
      initSounds();
    } catch (e) {
      console.log('Sound init deferred until user interaction');
    }
  }

  try {
    // Fetch user progress from database
    const { data, error } = await window.supabase.rpc('get_learning_summary', {
      p_user_id: window.currentUser?.id
    });

    if (error) throw error;

    learningState.userProgress = data || {
      lessons_completed: [],
      units_completed: [],
      modules_completed: [],
      daily_status: { can_learn: true, lessons_remaining: 3 }
    };

  } catch (err) {
    console.error('Error loading learning progress:', err);
    learningState.userProgress = {
      lessons_completed: [],
      units_completed: [],
      modules_completed: [],
      daily_status: { can_learn: true, lessons_remaining: 3 }
    };
  }

  learningState.isLoading = false;
  learningState.currentStreak = 0;
  learningState.maxStreak = 0;
  renderLearningHome();
}

// =============================================================================
// MAIN VIEWS
// =============================================================================

/**
 * Render loading state
 */
function renderLearningLoading() {
  const container = document.getElementById('learning-content');
  if (!container) return;

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; gap: 20px;">
      <div class="learning-spinner"></div>
      <p style="color: var(--text-muted); font-size: 0.95rem;">Loading your learning journey...</p>
    </div>
  `;
}

/**
 * Render the main learning home screen with modules
 */
function renderLearningHome() {
  const container = document.getElementById('learning-content');
  if (!container) return;

  const modules = getModulesSorted();
  const progress = learningState.userProgress;
  // Calculate overall progress
  const totalLessons = 125; // 5 modules × 5 units × 5 lessons
  const completedLessons = progress?.lessons_completed?.length || 0;
  const progressPercent = Math.round((completedLessons / totalLessons) * 100);

  container.innerHTML = `
    <!-- XP Info Banner -->
    <div style="margin: 15px; padding: 16px 20px; background: linear-gradient(135deg, #059669 0%, #10b981 100%); border-radius: 16px; display: flex; align-items: center; gap: 15px;">
      <div style="font-size: 2rem;">🧠</div>
      <div style="flex: 1;">
        <div style="font-weight: 700; color: white; font-size: 1rem;">
          Learn at your own pace
        </div>
        <div style="font-size: 0.85rem; color: rgba(255,255,255,0.85); margin-top: 2px;">
          Get 100% on a quiz and earn 1 XP
        </div>
      </div>
    </div>

    <!-- Overall Progress -->
    <div style="margin: 0 15px 20px; padding: 20px; background: white; border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span style="font-weight: 600; color: var(--text-main);">Your Progress</span>
        <span style="font-size: 0.9rem; color: var(--text-muted);">${completedLessons}/${totalLessons} lessons</span>
      </div>
      <div style="height: 10px; background: #e5e7eb; border-radius: 5px; overflow: hidden;">
        <div style="height: 100%; width: ${progressPercent}%; background: linear-gradient(90deg, var(--primary), var(--secondary)); border-radius: 5px; transition: width 0.5s ease;"></div>
      </div>
    </div>

    <!-- Modules Grid -->
    <div style="padding: 0 15px;">
      <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin-bottom: 15px;">Choose a Topic</h3>

      <div style="display: flex; flex-direction: column; gap: 15px;">
        ${modules.map(module => renderModuleCard(module, progress)).join('')}
      </div>
    </div>

    <!-- Learning Streak (if any) -->
    ${progress?.current_streak > 0 ? `
      <div style="margin: 20px 15px; padding: 16px 20px; background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%); border-radius: 16px; display: flex; align-items: center; gap: 15px;">
        <div style="font-size: 2rem;">🔥</div>
        <div>
          <div style="font-weight: 700; color: white; font-size: 1rem;">${progress.current_streak} Day Learning Streak!</div>
          <div style="font-size: 0.85rem; color: rgba(255,255,255,0.9);">Keep it going!</div>
        </div>
      </div>
    ` : ''}
  `;
}

/**
 * Render a module card
 */
function renderModuleCard(module, progress) {
  const units = getUnitsForModule(module.id);
  const completedUnits = units.filter(u =>
    progress?.units_completed?.includes(u.id)
  ).length;

  const isModuleComplete = progress?.modules_completed?.includes(module.id);

  // Count completed lessons in this module
  let completedLessons = 0;
  units.forEach(unit => {
    const lessons = getLessonsForUnit(unit.id);
    lessons.forEach(lesson => {
      if (progress?.lessons_completed?.includes(lesson.id)) {
        completedLessons++;
      }
    });
  });

  const totalLessons = units.length * 5; // 5 lessons per unit
  const moduleProgress = Math.round((completedLessons / totalLessons) * 100);

  return `
    <div onclick="openLearningModule('${module.id}')"
         style="background: white; border-radius: 16px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); cursor: pointer; border-left: 4px solid ${module.color}; transition: transform 0.2s, box-shadow 0.2s;"
         onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)';"
         onmouseout="this.style.transform='none'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.06)';">
      <div style="display: flex; align-items: center; gap: 15px;">
        <div style="width: 56px; height: 56px; background: ${module.color}20; border-radius: 14px; display: flex; align-items: center; justify-content: center; position: relative;">
          <i data-lucide="${module.icon}" style="width: 28px; height: 28px; color: ${module.color};"></i>
          ${isModuleComplete ? `
            <div style="position: absolute; top: -5px; right: -5px; width: 22px; height: 22px; background: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
              <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: white;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            </div>
          ` : ''}
        </div>
        <div style="flex: 1;">
          <div style="font-weight: 700; font-size: 1.1rem; color: var(--text-main);">${module.title}</div>
          <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 2px;">${module.subtitle}</div>
          <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
            <div style="flex: 1; height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden;">
              <div style="height: 100%; width: ${moduleProgress}%; background: ${module.color}; border-radius: 3px;"></div>
            </div>
            <span style="font-size: 0.75rem; color: var(--text-muted); white-space: nowrap;">${completedUnits}/${units.length} units</span>
          </div>
        </div>
        <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: #d1d5db;"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>
      </div>
    </div>
  `;
}

/**
 * Open a module to show its units
 */
window.openLearningModule = function(moduleId) {
  learningState.currentModule = MODULES[moduleId];
  renderModuleView(moduleId);
};

/**
 * Render module view with units
 */
function renderModuleView(moduleId) {
  const container = document.getElementById('learning-content');
  if (!container) return;

  const module = MODULES[moduleId];
  const units = getUnitsForModule(moduleId);
  const progress = learningState.userProgress;

  container.innerHTML = `
    <!-- Header -->
    <div style="padding: 20px; background: white; border-bottom: 1px solid #f1f5f9;">
      <div style="display: flex; align-items: center; gap: 15px;">
        <button onclick="renderLearningHome()" style="background: #f1f5f9; border: none; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: #64748b;"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        </button>
        <div style="flex: 1;">
          <h2 style="margin: 0; font-size: 1.3rem; font-weight: 700; color: var(--text-main);">${module.title}</h2>
          <p style="margin: 4px 0 0; font-size: 0.9rem; color: var(--text-muted);">${module.subtitle}</p>
        </div>
        <div style="width: 50px; height: 50px; background: ${module.color}20; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
          <i data-lucide="${module.icon}" style="width: 26px; height: 26px; color: ${module.color};"></i>
        </div>
      </div>
    </div>

    <!-- Module Description -->
    <div style="margin: 15px; padding: 16px; background: ${module.color}10; border-radius: 12px; border-left: 3px solid ${module.color};">
      <p style="margin: 0; font-size: 0.9rem; color: var(--text-main); line-height: 1.5;">${module.description}</p>
    </div>

    <!-- Units List -->
    <div style="padding: 0 15px 100px;">
      <h3 style="font-size: 1rem; font-weight: 600; color: var(--text-main); margin-bottom: 15px;">Units</h3>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${units.map((unit, index) => renderUnitCard(unit, index, progress, module)).join('')}
      </div>
    </div>
  `;

  // Re-initialize Lucide icons
  if (window.lucide) window.lucide.createIcons();
}

/**
 * Render a unit card
 */
function renderUnitCard(unit, index, progress, module) {
  const lessons = getLessonsForUnit(unit.id);
  const completedLessons = lessons.filter(l =>
    progress?.lessons_completed?.includes(l.id)
  ).length;

  const isUnitComplete = progress?.units_completed?.includes(unit.id);
  const isLocked = index > 0 && !progress?.units_completed?.includes(getUnitsForModule(unit.moduleId)[index - 1].id);

  // For first unit or unlocked units
  const canAccess = index === 0 || !isLocked;

  return `
    <div onclick="${canAccess ? `openLearningUnit('${unit.id}')` : ''}"
         style="background: white; border-radius: 14px; padding: 16px; box-shadow: 0 2px 6px rgba(0,0,0,0.05); cursor: ${canAccess ? 'pointer' : 'not-allowed'}; opacity: ${canAccess ? '1' : '0.6'}; transition: transform 0.2s;"
         ${canAccess ? `onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'"` : ''}>
      <div style="display: flex; align-items: center; gap: 14px;">
        <div style="width: 48px; height: 48px; background: ${isUnitComplete ? '#10b981' : (canAccess ? module.color : '#9ca3af')}20; border-radius: 12px; display: flex; align-items: center; justify-content: center; position: relative;">
          ${isLocked && !canAccess ? `
            <svg viewBox="0 0 24 24" style="width: 22px; height: 22px; fill: #9ca3af;"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
          ` : isUnitComplete ? `
            <svg viewBox="0 0 24 24" style="width: 24px; height: 24px; fill: #10b981;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          ` : `
            <span style="font-weight: 700; font-size: 1.2rem; color: ${module.color};">${index + 1}</span>
          `}
        </div>
        <div style="flex: 1;">
          <div style="font-weight: 600; font-size: 1rem; color: var(--text-main);">${unit.title}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">${unit.description}</div>
          <div style="display: flex; align-items: center; gap: 6px; margin-top: 8px;">
            ${[0,1,2,3,4].map(i => `
              <div style="width: 8px; height: 8px; border-radius: 50%; background: ${i < completedLessons ? '#10b981' : '#e5e7eb'};"></div>
            `).join('')}
            <span style="font-size: 0.7rem; color: var(--text-muted); margin-left: 4px;">${completedLessons}/5</span>
          </div>
        </div>
        ${canAccess ? `
          <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: #d1d5db;"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Open a unit to show its lessons
 */
window.openLearningUnit = function(unitId) {
  learningState.currentUnit = UNITS[unitId];
  renderUnitView(unitId);
};

/**
 * Render unit view with lessons
 */
function renderUnitView(unitId) {
  const container = document.getElementById('learning-content');
  if (!container) return;

  const unit = UNITS[unitId];
  const module = MODULES[unit.moduleId];
  const lessons = getLessonsForUnit(unitId);
  const progress = learningState.userProgress;

  container.innerHTML = `
    <!-- Header -->
    <div style="padding: 20px; background: white; border-bottom: 1px solid #f1f5f9;">
      <div style="display: flex; align-items: center; gap: 15px;">
        <button onclick="openLearningModule('${unit.moduleId}')" style="background: #f1f5f9; border: none; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: #64748b;"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        </button>
        <div style="flex: 1;">
          <div style="font-size: 0.8rem; color: ${module.color}; font-weight: 600; margin-bottom: 2px;">${module.title}</div>
          <h2 style="margin: 0; font-size: 1.2rem; font-weight: 700; color: var(--text-main);">${unit.title}</h2>
        </div>
      </div>
    </div>

    <!-- Lessons List -->
    <div style="padding: 15px 15px 100px;">
      <div style="display: flex; flex-direction: column; gap: 10px;">
        ${lessons.map((lesson, index) => renderLessonCard(lesson, index, progress, module)).join('')}
      </div>
    </div>
  `;
}

/**
 * Render a lesson card
 */
function renderLessonCard(lesson, index, progress, module) {
  const isComplete = progress?.lessons_completed?.includes(lesson.id);
  const isLocked = index > 0 && !progress?.lessons_completed?.includes(getLessonsForUnit(lesson.unitId)[index - 1]?.id);
  const canAccess = index === 0 || !isLocked;

  return `
    <div onclick="${canAccess ? `startLesson('${lesson.id}')` : ''}"
         style="background: white; border-radius: 12px; padding: 16px; box-shadow: 0 2px 6px rgba(0,0,0,0.05); cursor: ${canAccess ? 'pointer' : 'not-allowed'}; opacity: ${canAccess ? '1' : '0.5'}; display: flex; align-items: center; gap: 14px; transition: transform 0.2s;"
         ${canAccess ? `onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'"` : ''}>
      <div style="width: 44px; height: 44px; background: ${isComplete ? '#10b98120' : module.color + '20'}; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
        ${isComplete ? `
          <svg viewBox="0 0 24 24" style="width: 22px; height: 22px; fill: #10b981;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        ` : isLocked ? `
          <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: #9ca3af;"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
        ` : `
          <span style="font-weight: 700; font-size: 1.1rem; color: ${module.color};">${index + 1}</span>
        `}
      </div>
      <div style="flex: 1;">
        <div style="font-weight: 600; font-size: 0.95rem; color: var(--text-main);">${lesson.title}</div>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
          ${lesson.games?.length || 0} games ${isComplete ? '• Completed' : '• +1 XP'}
        </div>
      </div>
      ${canAccess && !isComplete ? `
        <div style="background: ${module.color}; color: white; padding: 6px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 600;">
          Start
        </div>
      ` : ''}
    </div>
  `;
}

// =============================================================================
// LESSON & GAME LOGIC
// =============================================================================

/**
 * Start a lesson
 */
window.startLesson = async function(lessonId) {
  const lesson = getLessonById(lessonId);
  if (!lesson) return;

  learningState.currentLesson = lesson;
  learningState.currentGameIndex = 0;
  learningState.gamesCorrect = 0;
  learningState.gamesPlayed = 0;

  // Show intro content first
  renderLessonIntro(lesson);
};

// =============================================================================
// INTERACTIVE READING HELPERS
// =============================================================================

/**
 * Convert text to bionic reading format (bold first part of each word)
 */
function toBionicText(text) {
  return text.split(/(\s+)/).map(word => {
    if (!word.trim()) return word; // preserve whitespace
    const len = word.length;
    // Bold first ~40% of the word, minimum 1 char
    const boldLen = Math.max(1, Math.ceil(len * 0.4));
    const boldPart = word.slice(0, boldLen);
    const lightPart = word.slice(boldLen);
    return `<span class="bionic-word"><span class="bionic-bold">${boldPart}</span><span class="bionic-light">${lightPart}</span></span>`;
  }).join('');
}

/**
 * Parse text for interactive terms (words in asterisks like *term*)
 * and auto-detect key terms
 */
function parseInteractiveText(text, moduleColor) {
  // Common fitness/nutrition key terms to highlight
  const keyTerms = {
    'contract': 'To shorten and generate force - the only action muscles can perform.',
    'antagonist': 'The opposing muscle that relaxes while the other contracts.',
    'muscle fibers': 'The individual cells that make up muscle tissue.',
    'biceps': 'The muscle on the front of your upper arm that bends the elbow.',
    'triceps': 'The muscle on the back of your upper arm that straightens the elbow.',
    'opposing pairs': 'Muscles that work together by taking turns contracting and relaxing.',
    'nervous system': 'The body\'s control center that coordinates muscle movements.',
    'strength training': 'Exercise that creates resistance to build muscle.',
    'protein': 'A macronutrient essential for muscle repair and growth.',
    'calories': 'Units of energy from food that fuel your body.',
    'metabolism': 'The process by which your body converts food into energy.',
    'macros': 'Short for macronutrients: protein, carbs, and fats.',
    'progressive overload': 'Gradually increasing workout difficulty to continue making gains.',
    'recovery': 'The rest period when muscles repair and grow stronger.',
    'compound movements': 'Exercises that work multiple muscle groups at once.',
    'isolation exercises': 'Exercises that target a single muscle group.'
  };

  let processedText = text;

  // Replace key terms with interactive spans
  Object.entries(keyTerms).forEach(([term, definition]) => {
    const regex = new RegExp(`\\b(${term})\\b`, 'gi');
    processedText = processedText.replace(regex,
      `<span class="interactive-term" data-definition="${definition.replace(/"/g, '&quot;')}" onclick="window.toggleTermDefinition(this, '${moduleColor}')">$1</span>`
    );
  });

  return processedText;
}

/**
 * Toggle term definition tooltip
 */
window.toggleTermDefinition = function(element, moduleColor) {
  // Remove any existing tooltips
  document.querySelectorAll('.term-tooltip').forEach(t => t.remove());
  document.querySelectorAll('.interactive-term.expanded').forEach(t => t.classList.remove('expanded'));

  // Check if this term was already expanded
  if (element.querySelector('.term-tooltip')) {
    element.classList.remove('expanded');
    return;
  }

  element.classList.add('expanded');
  const definition = element.getAttribute('data-definition');

  const tooltip = document.createElement('div');
  tooltip.className = 'term-tooltip';
  tooltip.innerHTML = `
    <div style="font-weight: 600; color: ${moduleColor}; margin-bottom: 4px;">Definition</div>
    <div>${definition}</div>
  `;
  tooltip.style.setProperty('--module-color', moduleColor);

  element.style.position = 'relative';
  element.appendChild(tooltip);

  // Close when clicking elsewhere
  setTimeout(() => {
    document.addEventListener('click', function closeTooltip(e) {
      if (!element.contains(e.target)) {
        tooltip.remove();
        element.classList.remove('expanded');
        document.removeEventListener('click', closeTooltip);
      }
    });
  }, 10);
};

/**
 * Split text into paragraphs for progressive reveal
 */
function splitIntoParagraphs(text) {
  return text.split(/\n\n+/).filter(p => p.trim());
}

/**
 * Set reading mode and re-render
 */
window.setReadingMode = function(mode) {
  learningState.readingMode = mode;

  // Stop RSVP if switching away
  if (mode !== 'rsvp' && learningState.rsvpState.intervalId) {
    clearInterval(learningState.rsvpState.intervalId);
    learningState.rsvpState.isPlaying = false;
  }

  // Re-render the intro
  if (learningState.currentLesson) {
    renderLessonIntro(learningState.currentLesson);
  }
};

/**
 * RSVP Controls
 */
window.toggleRsvp = function() {
  const state = learningState.rsvpState;
  const playBtn = document.querySelector('.rsvp-play-btn');
  const unit = UNITS[learningState.currentLesson?.unitId];
  const module = unit ? MODULES[unit.moduleId] : { color: '#48864B' };

  if (state.isPlaying) {
    clearInterval(state.intervalId);
    state.isPlaying = false;
    if (playBtn) {
      playBtn.classList.remove('active');
      playBtn.innerHTML = `<svg viewBox="0 0 24 24" style="width: 40px; height: 40px; fill: white;"><path d="M8 5v14l11-7z"/></svg>`;
    }
  } else {
    state.isPlaying = true;
    if (playBtn) {
      playBtn.classList.add('active');
      playBtn.innerHTML = `<svg viewBox="0 0 24 24" style="width: 40px; height: 40px; fill: white;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
    }
    advanceRsvpWord();
    state.intervalId = setInterval(advanceRsvpWord, state.speed);
  }
};

window.resetRsvp = function() {
  const state = learningState.rsvpState;
  clearInterval(state.intervalId);
  state.isPlaying = false;
  state.wordIndex = 0;
  document.querySelector('.rsvp-play-btn')?.classList.remove('active');
  updateRsvpDisplay();
};

window.setRsvpSpeed = function(speed) {
  learningState.rsvpState.speed = parseInt(speed);
  if (learningState.rsvpState.isPlaying) {
    clearInterval(learningState.rsvpState.intervalId);
    learningState.rsvpState.intervalId = setInterval(advanceRsvpWord, learningState.rsvpState.speed);
  }
};

function advanceRsvpWord() {
  const lesson = learningState.currentLesson;
  if (!lesson) return;

  // Split on whitespace AND hyphens/dashes to get individual words
  const words = lesson.content.intro
    .split(/[\s]+/)
    .flatMap(word => word.split(/[-—–]+/))
    .filter(w => w.trim());
  const state = learningState.rsvpState;

  if (state.wordIndex >= words.length) {
    clearInterval(state.intervalId);
    state.isPlaying = false;
    state.wordIndex = 0;
    // Show replay state
    const playBtn = document.querySelector('.rsvp-play-btn');
    if (playBtn) {
      playBtn.classList.remove('active');
      playBtn.innerHTML = `<svg viewBox="0 0 24 24" style="width: 40px; height: 40px; fill: white;"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>`;
    }
    const wordEl = document.querySelector('.rsvp-word');
    if (wordEl) {
      wordEl.innerHTML = `<span style="font-size: 1.5rem; color: #94a3b8;">Tap to replay</span>`;
    }
    return;
  }

  updateRsvpDisplay();
  state.wordIndex++;
}

function updateRsvpDisplay() {
  const lesson = learningState.currentLesson;
  if (!lesson) return;

  // Split on whitespace AND hyphens/dashes to get individual words
  const words = lesson.content.intro
    .split(/[\s]+/)
    .flatMap(word => word.split(/[-—–]+/))
    .filter(w => w.trim());
  const state = learningState.rsvpState;
  const word = words[state.wordIndex] || '';

  // Find focus point (middle-ish character)
  const focusIndex = Math.floor(word.length * 0.3);
  const before = word.slice(0, focusIndex);
  const focus = word.charAt(focusIndex);
  const after = word.slice(focusIndex + 1);

  const wordEl = document.querySelector('.rsvp-word');
  if (wordEl) {
    wordEl.innerHTML = `${before}<span class="rsvp-focus">${focus}</span>${after}`;
  }

  // Update progress
  const progressEl = document.querySelector('.rsvp-progress-bar');
  if (progressEl) {
    progressEl.style.width = `${(state.wordIndex / words.length) * 100}%`;
  }
}

/**
 * Reveal answer in think prompt
 */
window.revealThinkAnswer = function(btn) {
  const answerEl = btn.parentElement.querySelector('.think-prompt-answer');
  if (answerEl) {
    answerEl.classList.add('revealed');
    btn.textContent = 'Got it!';
    btn.onclick = () => btn.parentElement.style.display = 'none';
  }
};

/**
 * Render lesson intro/content screen - Flash reading mode
 */
function renderLessonIntro(lesson) {
  const container = document.getElementById('learning-content');
  if (!container) return;

  const unit = UNITS[lesson.unitId];
  const module = MODULES[unit.moduleId];

  // Reset RSVP state when re-rendering
  learningState.rsvpState.wordIndex = 0;
  learningState.rsvpState.isPlaying = false;
  if (learningState.rsvpState.intervalId) {
    clearInterval(learningState.rsvpState.intervalId);
  }

  container.innerHTML = `
    <div style="min-height: 100vh; background: linear-gradient(180deg, ${module.color}15 0%, white 30%); --module-color: ${module.color};">
      <!-- Header -->
      <div style="padding: 20px; display: flex; align-items: center; gap: 15px;">
        <button onclick="openLearningUnit('${lesson.unitId}')" style="background: white; border: none; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: #64748b;"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
        <div style="flex: 1; text-align: center;">
          <span style="font-size: 0.8rem; color: ${module.color}; font-weight: 600;">${module.title} • ${unit.title}</span>
        </div>
        <div style="width: 40px;"></div>
      </div>

      <!-- Lesson Title -->
      <div style="text-align: center; padding: 0 20px 20px;">
        <h1 style="margin: 0; font-size: 1.4rem; font-weight: 700; color: var(--text-main);">${lesson.title}</h1>
      </div>

      <!-- Flash Reader - Main Focus Area -->
      <div style="margin: 0 15px; background: white; border-radius: 24px; padding: 40px 25px; box-shadow: 0 8px 30px rgba(0,0,0,0.12); min-height: 320px; display: flex; flex-direction: column; align-items: center; justify-content: center;">

        <!-- Word Display -->
        <div class="rsvp-word" style="font-size: 2.5rem; font-weight: 700; color: var(--text-main); text-align: center; min-height: 80px; display: flex; align-items: center; justify-content: center; padding: 20px; width: 100%;">
          <span style="color: #94a3b8; font-size: 1.2rem; font-weight: 500;">Tap play to start</span>
        </div>

        <!-- Progress Bar -->
        <div class="rsvp-progress" style="width: 100%; max-width: 280px; height: 6px; background: #e5e7eb; border-radius: 3px; margin: 30px 0; overflow: hidden;">
          <div class="rsvp-progress-bar" style="height: 100%; background: ${module.color}; width: 0%; transition: width 0.1s linear; border-radius: 3px;"></div>
        </div>

        <!-- Big Play Button -->
        <button class="rsvp-play-btn" onclick="toggleRsvp()" style="width: 80px; height: 80px; border-radius: 50%; border: none; background: ${module.color}; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 20px ${module.color}50; transition: transform 0.2s ease, box-shadow 0.2s ease;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
          <svg viewBox="0 0 24 24" style="width: 40px; height: 40px; fill: white;"><path d="M8 5v14l11-7z"/></svg>
        </button>

      </div>

      <!-- Key Insight - Below the reader -->
      <div style="margin: 25px 15px; padding: 16px 20px; background: ${module.color}10; border-radius: 16px; border-left: 4px solid ${module.color};">
        <div style="font-size: 0.7rem; font-weight: 700; color: ${module.color}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Key Insight</div>
        <div style="font-size: 0.9rem; color: var(--text-main); line-height: 1.5; font-weight: 500;">${lesson.content.keyPoint}</div>
      </div>

      <!-- Start Quiz Button -->
      <div style="padding: 15px 15px 30px;">
        <button onclick="startLessonGames()" style="width: 100%; background: ${module.color}; color: white; border: none; padding: 16px; border-radius: 14px; font-size: 1.1rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 4px 12px ${module.color}40; transition: transform 0.2s ease;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
          <span>Test Your Understanding</span>
          <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: white;"><path d="M8 5v14l11-7z"/></svg>
        </button>
        <p style="text-align: center; font-size: 0.85rem; color: var(--text-muted); margin-top: 12px;">${lesson.games?.length || 0} quick games ahead</p>
      </div>
    </div>
  `;
}

/**
 * Start the games portion of a lesson
 */
window.startLessonGames = function() {
  const lesson = learningState.currentLesson;
  if (!lesson || !lesson.games?.length) {
    completeLesson();
    return;
  }

  // Show mascot for games
  if (window.LearningMascot) {
    window.LearningMascot.show();
  }

  learningState.currentGameIndex = 0;
  renderCurrentGame();
};

/**
 * Render the current game
 */
function renderCurrentGame() {
  const lesson = learningState.currentLesson;
  const gameIndex = learningState.currentGameIndex;

  if (gameIndex >= lesson.games.length) {
    completeLesson();
    return;
  }

  const game = lesson.games[gameIndex];
  const unit = UNITS[lesson.unitId];
  const module = MODULES[unit.moduleId];

  const container = document.getElementById('learning-content');
  if (!container) return;

  // Progress bar
  const progressPercent = ((gameIndex) / lesson.games.length) * 100;
  const streak = learningState.currentStreak;

  let gameHtml = '';

  switch (game.type) {
    case GAME_TYPES.SWIPE_TRUE_FALSE:
      gameHtml = renderSwipeTrueFalse(game, module);
      break;
    case GAME_TYPES.FILL_BLANK:
      gameHtml = renderFillBlank(game, module);
      break;
    case GAME_TYPES.MATCH_PAIRS:
      gameHtml = renderMatchPairs(game, module);
      break;
    case GAME_TYPES.ORDER_SEQUENCE:
      gameHtml = renderOrderSequence(game, module);
      break;
    case GAME_TYPES.SCENARIO_STORY:
      gameHtml = renderScenarioStory(game, module);
      break;
    case GAME_TYPES.TAP_ALL:
      gameHtml = renderTapAll(game, module);
      break;
    default:
      gameHtml = renderFillBlank(game, module); // Fallback
  }

  container.innerHTML = `
    <div style="min-height: 100vh; background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%); display: flex; flex-direction: column;">
      <!-- Header with Progress & Streak -->
      <div style="padding: 15px 20px; background: white; border-bottom: 1px solid #e5e7eb; box-shadow: 0 2px 10px rgba(0,0,0,0.03);">
        <div style="display: flex; align-items: center; gap: 12px;">
          <button onclick="exitLesson()" style="background: #f1f5f9; border: none; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">
            <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: #64748b;"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>

          <div style="flex: 1; position: relative;">
            <div style="height: 12px; background: #e5e7eb; border-radius: 6px; overflow: hidden;">
              <div class="progress-bar-animated" style="height: 100%; width: ${progressPercent}%; background: linear-gradient(90deg, ${module.color}, ${module.color}dd); border-radius: 6px; position: relative;">
                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%); animation: progressShine 2s ease-in-out infinite;"></div>
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            ${streak >= 2 ? `
              <div class="streak-badge" style="display: flex; align-items: center; gap: 4px; background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%); padding: 4px 10px; border-radius: 20px; box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);">
                <span class="streak-fire" style="font-size: 14px;">🔥</span>
                <span style="font-size: 0.8rem; font-weight: 700; color: white;">${streak}</span>
              </div>
            ` : ''}
            <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600; background: #f1f5f9; padding: 4px 10px; border-radius: 12px;">${gameIndex + 1}/${lesson.games.length}</span>
          </div>
        </div>
      </div>

      <!-- Game Content with Animation -->
      <div id="game-container" class="card-enter" style="flex: 1; padding: 20px; display: flex; flex-direction: column;">
        ${gameHtml}
      </div>
    </div>

    <style>
      @keyframes progressShine {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(200%); }
      }
    </style>
  `;

  // Initialize any game-specific listeners
  initGameListeners(game);
}

// =============================================================================
// GAME RENDERERS
// =============================================================================

/**
 * Swipe True/False game - Duolingo-style card swipe
 */
function renderSwipeTrueFalse(game, module) {
  return `
    <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 20px;">
      <!-- Game Type Badge -->
      <div style="display: inline-flex; align-items: center; gap: 8px; background: ${module.color}15; padding: 8px 16px; border-radius: 20px; margin-bottom: 25px;">
        <span style="font-size: 1.2rem;">🤔</span>
        <span style="font-size: 0.85rem; color: ${module.color}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">True or False?</span>
      </div>

      <!-- Swipeable Card -->
      <div id="swipe-card" style="background: white; border-radius: 24px; padding: 35px 30px; box-shadow: 0 8px 30px rgba(0,0,0,0.12); max-width: 340px; width: 100%; transform: translateX(0) rotate(0deg); transition: transform 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 0.3s ease; position: relative; overflow: hidden;">
        <!-- Decorative gradient top -->
        <div style="position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, ${module.color}, ${module.color}aa);"></div>

        <p style="font-size: 1.25rem; color: var(--text-main); line-height: 1.6; margin: 0; font-weight: 500;">${game.question}</p>

        <!-- Swipe indicators -->
        <div id="swipe-indicator-false" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); opacity: 0; transition: opacity 0.2s;">
          <div style="background: #fee2e2; border: 2px solid #ef4444; border-radius: 8px; padding: 6px 10px;">
            <span style="font-weight: 700; color: #ef4444; font-size: 0.8rem;">FALSE</span>
          </div>
        </div>
        <div id="swipe-indicator-true" style="position: absolute; right: 15px; top: 50%; transform: translateY(-50%); opacity: 0; transition: opacity 0.2s;">
          <div style="background: #dcfce7; border: 2px solid #10b981; border-radius: 8px; padding: 6px 10px;">
            <span style="font-weight: 700; color: #10b981; font-size: 0.8rem;">TRUE</span>
          </div>
        </div>
      </div>

      <!-- Answer Buttons -->
      <div style="display: flex; gap: 50px; margin-top: 45px;">
        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
          <button id="btn-false" onclick="answerSwipe(false)" style="width: 80px; height: 80px; border-radius: 50%; background: white; border: 4px solid #ef4444; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s cubic-bezier(0.68, -0.55, 0.265, 1.55); box-shadow: 0 4px 15px rgba(239, 68, 68, 0.2);" onmouseover="this.style.transform='scale(1.1)'; this.style.background='#fef2f2'; this.style.boxShadow='0 6px 20px rgba(239, 68, 68, 0.3)'" onmouseout="this.style.transform='scale(1)'; this.style.background='white'; this.style.boxShadow='0 4px 15px rgba(239, 68, 68, 0.2)'">
            <svg viewBox="0 0 24 24" style="width: 36px; height: 36px; fill: #ef4444;"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
          <span style="font-size: 0.85rem; color: #ef4444; font-weight: 600;">FALSE</span>
        </div>

        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
          <button id="btn-true" onclick="answerSwipe(true)" style="width: 80px; height: 80px; border-radius: 50%; background: white; border: 4px solid #10b981; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s cubic-bezier(0.68, -0.55, 0.265, 1.55); box-shadow: 0 4px 15px rgba(16, 185, 129, 0.2);" onmouseover="this.style.transform='scale(1.1)'; this.style.background='#ecfdf5'; this.style.boxShadow='0 6px 20px rgba(16, 185, 129, 0.3)'" onmouseout="this.style.transform='scale(1)'; this.style.background='white'; this.style.boxShadow='0 4px 15px rgba(16, 185, 129, 0.2)'">
            <svg viewBox="0 0 24 24" style="width: 36px; height: 36px; fill: #10b981;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          </button>
          <span style="font-size: 0.85rem; color: #10b981; font-weight: 600;">TRUE</span>
        </div>
      </div>

      <!-- Hint text -->
      <p style="margin-top: 25px; font-size: 0.8rem; color: var(--text-muted); opacity: 0.7;">Tap a button or swipe the card</p>
    </div>
  `;
}

/**
 * Fill in the blank game - Duolingo-style word selection
 */
function renderFillBlank(game, module) {
  const shuffledOptions = [...game.options].sort(() => Math.random() - 0.5);

  return `
    <div style="flex: 1; display: flex; flex-direction: column;">
      <!-- Game Type Badge -->
      <div style="display: inline-flex; align-items: center; gap: 8px; background: ${module.color}15; padding: 8px 16px; border-radius: 20px; margin-bottom: 20px; align-self: flex-start;">
        <span style="font-size: 1.2rem;">✏️</span>
        <span style="font-size: 0.85rem; color: ${module.color}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Fill in the Blank</span>
      </div>

      <!-- Sentence Card -->
      <div style="background: white; border-radius: 20px; padding: 30px; box-shadow: 0 6px 25px rgba(0,0,0,0.08); margin-bottom: 35px; position: relative; overflow: hidden;">
        <div style="position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, ${module.color}, ${module.color}aa);"></div>
        <p style="font-size: 1.2rem; color: var(--text-main); line-height: 1.7; margin: 0;">
          ${game.sentence.replace('_______', `<span id="blank-slot" class="blank-highlight" style="display: inline-block; min-width: 120px; padding: 4px 8px; border-bottom: 3px dashed ${module.color}; margin: 0 5px; text-align: center; font-weight: 700; color: ${module.color}; background: ${module.color}10; border-radius: 4px 4px 0 0; transition: all 0.3s;">_______</span>`)}
        </p>
      </div>

      <!-- Word Options -->
      <div style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: center;">
        ${shuffledOptions.map((option, i) => `
          <button class="fill-blank-option" data-value="${option}" onclick="selectFillBlank('${option}')"
                  style="background: white; border: 2px solid #e5e7eb; border-radius: 30px; padding: 14px 28px; font-size: 1.05rem; font-weight: 600; color: var(--text-main); cursor: pointer; transition: all 0.2s cubic-bezier(0.68, -0.55, 0.265, 1.55); box-shadow: 0 3px 10px rgba(0,0,0,0.05); animation: cardEnter 0.4s ease-out forwards; animation-delay: ${i * 0.05}s; opacity: 0;"
                  onmouseover="this.style.transform='translateY(-3px) scale(1.02)'; this.style.borderColor='${module.color}'; this.style.boxShadow='0 6px 15px rgba(0,0,0,0.1)'"
                  onmouseout="this.style.transform='translateY(0) scale(1)'; this.style.borderColor='#e5e7eb'; this.style.boxShadow='0 3px 10px rgba(0,0,0,0.05)'">
            ${option}
          </button>
        `).join('')}
      </div>

      <!-- Helper Text -->
      <p style="text-align: center; margin-top: 25px; font-size: 0.8rem; color: var(--text-muted); opacity: 0.7;">Tap the word that best completes the sentence</p>
    </div>
  `;
}

/**
 * Match pairs game - Duolingo-style connection game
 */
function renderMatchPairs(game, module) {
  const leftItems = game.pairs.map((p, i) => ({ text: p.left, index: i }));
  const rightItems = game.pairs.map((p, i) => ({ text: p.right, index: i })).sort(() => Math.random() - 0.5);

  return `
    <div style="flex: 1; display: flex; flex-direction: column;">
      <!-- Game Type Badge -->
      <div style="display: inline-flex; align-items: center; gap: 8px; background: ${module.color}15; padding: 8px 16px; border-radius: 20px; margin-bottom: 15px; align-self: flex-start;">
        <span style="font-size: 1.2rem;">🔗</span>
        <span style="font-size: 0.85rem; color: ${module.color}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Match the Pairs</span>
      </div>
      <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 20px;">Tap one item from each column to match them</p>

      <!-- Match Grid -->
      <div style="display: flex; gap: 20px;">
        <!-- Left Column -->
        <div style="flex: 1; display: flex; flex-direction: column; gap: 12px;">
          ${leftItems.map((item, i) => `
            <div class="match-item match-left" data-index="${item.index}" onclick="selectMatchItem(this, 'left')"
                 style="background: white; border: 3px solid #e5e7eb; border-radius: 16px; padding: 16px; font-size: 0.95rem; color: var(--text-main); cursor: pointer; transition: all 0.25s cubic-bezier(0.68, -0.55, 0.265, 1.55); text-align: center; font-weight: 500; box-shadow: 0 3px 10px rgba(0,0,0,0.05); animation: cardEnter 0.3s ease-out forwards; animation-delay: ${i * 0.05}s; opacity: 0; position: relative;"
                 onmouseover="if(!this.classList.contains('matched')) { this.style.transform='translateY(-2px)'; this.style.boxShadow='0 5px 15px rgba(0,0,0,0.1)'; }"
                 onmouseout="if(!this.classList.contains('matched')) { this.style.transform='translateY(0)'; this.style.boxShadow='0 3px 10px rgba(0,0,0,0.05)'; }">
              ${item.text}
            </div>
          `).join('')}
        </div>

        <!-- Right Column -->
        <div style="flex: 1; display: flex; flex-direction: column; gap: 12px;">
          ${rightItems.map((item, i) => `
            <div class="match-item match-right" data-index="${item.index}" onclick="selectMatchItem(this, 'right')"
                 style="background: white; border: 3px solid #e5e7eb; border-radius: 16px; padding: 16px; font-size: 0.95rem; color: var(--text-main); cursor: pointer; transition: all 0.25s cubic-bezier(0.68, -0.55, 0.265, 1.55); text-align: center; font-weight: 500; box-shadow: 0 3px 10px rgba(0,0,0,0.05); animation: cardEnter 0.3s ease-out forwards; animation-delay: ${(i + leftItems.length) * 0.05}s; opacity: 0; position: relative;"
                 onmouseover="if(!this.classList.contains('matched')) { this.style.transform='translateY(-2px)'; this.style.boxShadow='0 5px 15px rgba(0,0,0,0.1)'; }"
                 onmouseout="if(!this.classList.contains('matched')) { this.style.transform='translateY(0)'; this.style.boxShadow='0 3px 10px rgba(0,0,0,0.05)'; }">
              ${item.text}
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Match Progress -->
      <div id="match-progress" style="display: flex; justify-content: center; gap: 8px; margin-top: 25px;">
        ${game.pairs.map((_, i) => `
          <div class="match-dot" data-pair="${i}" style="width: 12px; height: 12px; border-radius: 50%; background: #e5e7eb; transition: all 0.3s;"></div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Order sequence game - Duolingo-style drag-and-drop ordering
 */
function renderOrderSequence(game, module) {
  const shuffledItems = game.items.map((item, i) => ({ text: item, correctIndex: i })).sort(() => Math.random() - 0.5);

  return `
    <div style="flex: 1; display: flex; flex-direction: column;">
      <!-- Game Type Badge -->
      <div style="display: inline-flex; align-items: center; gap: 8px; background: ${module.color}15; padding: 8px 16px; border-radius: 20px; margin-bottom: 15px; align-self: flex-start;">
        <span style="font-size: 1.2rem;">📋</span>
        <span style="font-size: 0.85rem; color: ${module.color}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Put in Order</span>
      </div>
      <p style="font-size: 1rem; color: var(--text-main); margin-bottom: 20px; font-weight: 500;">${game.question}</p>

      <!-- Sortable List -->
      <div id="order-container" style="display: flex; flex-direction: column; gap: 12px;">
        ${shuffledItems.map((item, i) => `
          <div class="order-item" data-correct="${item.correctIndex}" draggable="true"
               style="background: white; border: 3px solid #e5e7eb; border-radius: 16px; padding: 16px 18px; font-size: 1rem; color: var(--text-main); cursor: grab; display: flex; align-items: center; gap: 14px; transition: all 0.25s cubic-bezier(0.68, -0.55, 0.265, 1.55); box-shadow: 0 3px 10px rgba(0,0,0,0.05); animation: cardEnter 0.3s ease-out forwards; animation-delay: ${i * 0.05}s; opacity: 0;"
               onmouseover="this.style.boxShadow='0 6px 20px rgba(0,0,0,0.1)'; this.style.borderColor='${module.color}50'"
               onmouseout="this.style.boxShadow='0 3px 10px rgba(0,0,0,0.05)'; this.style.borderColor='#e5e7eb'">
            <div class="order-number" style="width: 32px; height: 32px; background: ${module.color}20; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; color: ${module.color}; font-size: 0.9rem; flex-shrink: 0;">${i + 1}</div>
            <span style="flex: 1; font-weight: 500;">${item.text}</span>
            <div style="display: flex; flex-direction: column; gap: 2px; opacity: 0.4;">
              <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: #64748b;"><path d="M3 15h18v-2H3v2zm0 4h18v-2H3v2zm0-8h18V9H3v2zm0-6v2h18V5H3z"/></svg>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Check Button -->
      <button id="check-order-btn" onclick="checkOrderSequence()" style="margin-top: 30px; background: linear-gradient(135deg, ${module.color} 0%, ${module.color}dd 100%); color: white; border: none; padding: 16px; border-radius: 16px; font-size: 1.05rem; font-weight: 700; cursor: pointer; box-shadow: 0 4px 15px ${module.color}40; transition: all 0.2s;"
              onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px ${module.color}50'"
              onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px ${module.color}40'">
        Check Order
      </button>

      <p style="text-align: center; margin-top: 15px; font-size: 0.8rem; color: var(--text-muted); opacity: 0.7;">Drag items to reorder them</p>
    </div>
  `;
}

/**
 * Scenario story game - Duolingo-style situational multiple choice
 */
function renderScenarioStory(game, module) {
  return `
    <div style="flex: 1; display: flex; flex-direction: column;">
      <!-- Game Type Badge -->
      <div style="display: inline-flex; align-items: center; gap: 8px; background: ${module.color}15; padding: 8px 16px; border-radius: 20px; margin-bottom: 15px; align-self: flex-start;">
        <span style="font-size: 1.2rem;">📖</span>
        <span style="font-size: 0.85rem; color: ${module.color}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Scenario</span>
      </div>

      <!-- Scenario Card -->
      <div style="background: white; border-radius: 20px; padding: 24px; box-shadow: 0 6px 25px rgba(0,0,0,0.08); margin-bottom: 25px; position: relative; overflow: hidden;">
        <div style="position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, ${module.color}, ${module.color}aa);"></div>
        <!-- Scenario Icon -->
        <div style="display: flex; gap: 15px; margin-bottom: 15px;">
          <div style="width: 40px; height: 40px; background: ${module.color}15; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <span style="font-size: 1.3rem;">💭</span>
          </div>
          <p style="font-size: 1.05rem; color: var(--text-main); line-height: 1.65; margin: 0; flex: 1;">${game.scenario}</p>
        </div>
        <div style="border-top: 1px solid #e5e7eb; padding-top: 15px; margin-top: 10px;">
          <p style="font-size: 1.05rem; color: var(--text-main); font-weight: 700; margin: 0;">${game.question}</p>
        </div>
      </div>

      <!-- Answer Options -->
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${game.options.map((option, i) => `
          <button class="scenario-option" data-correct="${option.correct}" onclick="selectScenarioOption(this)"
                  style="background: white; border: 3px solid #e5e7eb; border-radius: 16px; padding: 18px; font-size: 1rem; color: var(--text-main); cursor: pointer; text-align: left; transition: all 0.25s cubic-bezier(0.68, -0.55, 0.265, 1.55); display: flex; align-items: flex-start; gap: 14px; box-shadow: 0 3px 10px rgba(0,0,0,0.05); animation: cardEnter 0.3s ease-out forwards; animation-delay: ${i * 0.08}s; opacity: 0;"
                  onmouseover="this.style.transform='translateY(-2px)'; this.style.borderColor='${module.color}'; this.style.boxShadow='0 6px 15px rgba(0,0,0,0.1)'"
                  onmouseout="this.style.transform='translateY(0)'; this.style.borderColor='#e5e7eb'; this.style.boxShadow='0 3px 10px rgba(0,0,0,0.05)'">
            <span style="width: 32px; height: 32px; background: ${module.color}15; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 700; color: ${module.color}; font-size: 0.95rem; flex-shrink: 0;">${String.fromCharCode(65 + i)}</span>
            <span style="flex: 1; font-weight: 500; line-height: 1.5;">${option.text}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Tap all that apply game - Duolingo-style multi-select
 */
function renderTapAll(game, module) {
  const shuffledOptions = [...game.options].sort(() => Math.random() - 0.5);

  return `
    <div style="flex: 1; display: flex; flex-direction: column;">
      <!-- Game Type Badge -->
      <div style="display: inline-flex; align-items: center; gap: 8px; background: ${module.color}15; padding: 8px 16px; border-radius: 20px; margin-bottom: 15px; align-self: flex-start;">
        <span style="font-size: 1.2rem;">☑️</span>
        <span style="font-size: 0.85rem; color: ${module.color}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Select All That Apply</span>
      </div>
      <p style="font-size: 1.1rem; color: var(--text-main); margin-bottom: 25px; font-weight: 600; line-height: 1.5;">${game.question}</p>

      <!-- Selection Count -->
      <div id="selection-count" style="text-align: center; margin-bottom: 20px; font-size: 0.9rem; color: var(--text-muted);">
        <span id="selected-count">0</span> selected
      </div>

      <!-- Options -->
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${shuffledOptions.map((option, i) => `
          <button class="tap-all-option" data-correct="${option.correct}" onclick="toggleTapAllOption(this)"
                  style="background: white; border: 3px solid #e5e7eb; border-radius: 16px; padding: 16px 18px; font-size: 1rem; color: var(--text-main); cursor: pointer; text-align: left; transition: all 0.25s cubic-bezier(0.68, -0.55, 0.265, 1.55); display: flex; align-items: center; gap: 14px; box-shadow: 0 3px 10px rgba(0,0,0,0.05); animation: cardEnter 0.3s ease-out forwards; animation-delay: ${i * 0.05}s; opacity: 0;"
                  onmouseover="if(!this.classList.contains('selected')) { this.style.borderColor='${module.color}50'; this.style.boxShadow='0 5px 15px rgba(0,0,0,0.08)'; }"
                  onmouseout="if(!this.classList.contains('selected')) { this.style.borderColor='#e5e7eb'; this.style.boxShadow='0 3px 10px rgba(0,0,0,0.05)'; }">
            <div class="tap-checkbox" style="width: 28px; height: 28px; border: 3px solid #d1d5db; border-radius: 8px; display: flex; align-items: center; justify-content: center; transition: all 0.25s cubic-bezier(0.68, -0.55, 0.265, 1.55); flex-shrink: 0;"></div>
            <span style="flex: 1; font-weight: 500; line-height: 1.4;">${option.text}</span>
          </button>
        `).join('')}
      </div>

      <!-- Check Button -->
      <button id="check-tap-all-btn" onclick="checkTapAll()" style="margin-top: 30px; background: linear-gradient(135deg, ${module.color} 0%, ${module.color}dd 100%); color: white; border: none; padding: 16px; border-radius: 16px; font-size: 1.05rem; font-weight: 700; cursor: pointer; box-shadow: 0 4px 15px ${module.color}40; transition: all 0.2s;"
              onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px ${module.color}50'"
              onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px ${module.color}40'">
        Check Answer
      </button>
    </div>
  `;
}

// =============================================================================
// GAME INTERACTION HANDLERS
// =============================================================================

let matchState = { selectedLeft: null, selectedRight: null, matched: [] };

/**
 * Initialize game-specific listeners
 */
function initGameListeners(game) {
  matchState = { selectedLeft: null, selectedRight: null, matched: [] };

  // Add drag and drop for order sequence
  if (game.type === GAME_TYPES.ORDER_SEQUENCE) {
    initDragAndDrop();
  }
}

/**
 * Swipe answer handler - Enhanced with card animation
 */
window.answerSwipe = function(answer) {
  const lesson = learningState.currentLesson;
  const game = lesson.games[learningState.currentGameIndex];
  const isCorrect = answer === game.answer;

  // Animate card swipe
  const card = document.getElementById('swipe-card');
  if (card) {
    const direction = answer ? 'right' : 'left';
    card.classList.add(`swipe-${direction}`);

    // Show swipe indicator
    const indicator = document.getElementById(`swipe-indicator-${answer ? 'true' : 'false'}`);
    if (indicator) {
      indicator.style.opacity = '1';
    }
  }

  // Animate button press
  const btn = document.getElementById(answer ? 'btn-true' : 'btn-false');
  if (btn) {
    btn.style.transform = 'scale(0.9)';
    setTimeout(() => btn.style.transform = 'scale(1)', 150);
  }

  learningState.gamesPlayed++;
  if (isCorrect) learningState.gamesCorrect++;

  // Delay feedback to show animation
  setTimeout(() => showGameFeedback(isCorrect, game.explanation), 400);
};

/**
 * Fill blank selection handler
 */
window.selectFillBlank = function(value) {
  const lesson = learningState.currentLesson;
  const game = lesson.games[learningState.currentGameIndex];
  const isCorrect = value === game.answer;

  // Update UI
  document.querySelectorAll('.fill-blank-option').forEach(btn => {
    btn.style.opacity = '0.5';
    btn.style.pointerEvents = 'none';
    if (btn.dataset.value === value) {
      btn.style.background = isCorrect ? '#dcfce7' : '#fee2e2';
      btn.style.borderColor = isCorrect ? '#10b981' : '#ef4444';
      btn.style.opacity = '1';
    }
    if (btn.dataset.value === game.answer && !isCorrect) {
      btn.style.background = '#dcfce7';
      btn.style.borderColor = '#10b981';
      btn.style.opacity = '1';
    }
  });

  document.getElementById('blank-slot').textContent = value;

  learningState.gamesPlayed++;
  if (isCorrect) learningState.gamesCorrect++;

  setTimeout(() => showGameFeedback(isCorrect), 500);
};

/**
 * Match pair selection handler - Enhanced with animations
 */
window.selectMatchItem = function(element, side) {
  const unit = UNITS[learningState.currentLesson.unitId];
  const module = MODULES[unit.moduleId];

  if (element.classList.contains('matched')) return;

  // Clear previous selection on same side
  document.querySelectorAll(`.match-${side}`).forEach(el => {
    if (!el.classList.contains('matched')) {
      el.style.borderColor = '#e5e7eb';
      el.style.background = 'white';
      el.style.transform = 'scale(1)';
    }
  });

  // Select this item with animation
  element.style.borderColor = module.color;
  element.style.background = module.color + '15';
  element.style.transform = 'scale(1.03)';
  element.style.boxShadow = `0 5px 20px ${module.color}30`;

  if (side === 'left') {
    matchState.selectedLeft = element;
  } else {
    matchState.selectedRight = element;
  }

  // Check for match
  if (matchState.selectedLeft && matchState.selectedRight) {
    const leftIndex = matchState.selectedLeft.dataset.index;
    const rightIndex = matchState.selectedRight.dataset.index;

    if (leftIndex === rightIndex) {
      // Correct match - success animation
      matchState.selectedLeft.classList.add('matched', 'match-success');
      matchState.selectedRight.classList.add('matched', 'match-success');
      matchState.selectedLeft.style.background = '#dcfce7';
      matchState.selectedLeft.style.borderColor = '#10b981';
      matchState.selectedLeft.style.transform = 'scale(1)';
      matchState.selectedLeft.style.boxShadow = '0 3px 10px rgba(16, 185, 129, 0.2)';
      matchState.selectedRight.style.background = '#dcfce7';
      matchState.selectedRight.style.borderColor = '#10b981';
      matchState.selectedRight.style.transform = 'scale(1)';
      matchState.selectedRight.style.boxShadow = '0 3px 10px rgba(16, 185, 129, 0.2)';
      matchState.matched.push(leftIndex);

      // Update progress dot
      const dot = document.querySelector(`.match-dot[data-pair="${leftIndex}"]`);
      if (dot) {
        dot.style.background = '#10b981';
        dot.style.transform = 'scale(1.3)';
        setTimeout(() => dot.style.transform = 'scale(1)', 200);
      }

      // Create small particle burst at element center
      const rect = matchState.selectedLeft.getBoundingClientRect();
      createParticleBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, '#10b981', 6);

      // Check if all matched
      const lesson = learningState.currentLesson;
      const game = lesson.games[learningState.currentGameIndex];
      if (matchState.matched.length === game.pairs.length) {
        learningState.gamesPlayed++;
        learningState.gamesCorrect++;
        setTimeout(() => showGameFeedback(true), 600);
      }
    } else {
      // Wrong match - shake animation
      matchState.selectedLeft.classList.add('match-fail');
      matchState.selectedRight.classList.add('match-fail');
      matchState.selectedLeft.style.background = '#fee2e2';
      matchState.selectedLeft.style.borderColor = '#ef4444';
      matchState.selectedRight.style.background = '#fee2e2';
      matchState.selectedRight.style.borderColor = '#ef4444';

      setTimeout(() => {
        if (!matchState.selectedLeft.classList.contains('matched')) {
          matchState.selectedLeft.style.background = 'white';
          matchState.selectedLeft.style.borderColor = '#e5e7eb';
          matchState.selectedLeft.style.transform = 'scale(1)';
          matchState.selectedLeft.style.boxShadow = '0 3px 10px rgba(0,0,0,0.05)';
          matchState.selectedLeft.classList.remove('match-fail');
        }
        if (!matchState.selectedRight.classList.contains('matched')) {
          matchState.selectedRight.style.background = 'white';
          matchState.selectedRight.style.borderColor = '#e5e7eb';
          matchState.selectedRight.style.transform = 'scale(1)';
          matchState.selectedRight.style.boxShadow = '0 3px 10px rgba(0,0,0,0.05)';
          matchState.selectedRight.classList.remove('match-fail');
        }
      }, 500);
    }

    matchState.selectedLeft = null;
    matchState.selectedRight = null;
  }
};

/**
 * Scenario option selection handler
 */
window.selectScenarioOption = function(element) {
  const isCorrect = element.dataset.correct === 'true';
  const lesson = learningState.currentLesson;
  const game = lesson.games[learningState.currentGameIndex];

  // Update UI
  document.querySelectorAll('.scenario-option').forEach(btn => {
    btn.style.pointerEvents = 'none';
    if (btn.dataset.correct === 'true') {
      btn.style.background = '#dcfce7';
      btn.style.borderColor = '#10b981';
    } else if (btn === element && !isCorrect) {
      btn.style.background = '#fee2e2';
      btn.style.borderColor = '#ef4444';
    }
  });

  learningState.gamesPlayed++;
  if (isCorrect) learningState.gamesCorrect++;

  setTimeout(() => showGameFeedback(isCorrect, game.explanation), 500);
};

/**
 * Tap all toggle handler - Enhanced with animations
 */
window.toggleTapAllOption = function(element) {
  const checkbox = element.querySelector('.tap-checkbox');
  const isSelected = element.classList.toggle('selected');
  const unit = UNITS[learningState.currentLesson.unitId];
  const module = MODULES[unit.moduleId];

  if (isSelected) {
    element.style.borderColor = module.color;
    element.style.background = module.color + '10';
    element.style.transform = 'scale(1.02)';
    checkbox.style.background = module.color;
    checkbox.style.borderColor = module.color;
    checkbox.innerHTML = '<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: white;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
    checkbox.style.transform = 'scale(1.1)';

    // Add pop animation
    setTimeout(() => {
      element.style.transform = 'scale(1)';
      checkbox.style.transform = 'scale(1)';
    }, 150);
  } else {
    element.style.borderColor = '#e5e7eb';
    element.style.background = 'white';
    element.style.transform = 'scale(0.98)';
    checkbox.style.background = 'white';
    checkbox.style.borderColor = '#d1d5db';
    checkbox.innerHTML = '';

    setTimeout(() => {
      element.style.transform = 'scale(1)';
    }, 150);
  }

  // Update selection count
  const selectedCount = document.querySelectorAll('.tap-all-option.selected').length;
  const countEl = document.getElementById('selected-count');
  if (countEl) {
    countEl.textContent = selectedCount;
    countEl.style.fontWeight = selectedCount > 0 ? '700' : '400';
    countEl.style.color = selectedCount > 0 ? module.color : 'var(--text-muted)';
  }
};

/**
 * Check tap all answers
 */
window.checkTapAll = function() {
  const options = document.querySelectorAll('.tap-all-option');
  let allCorrect = true;

  options.forEach(opt => {
    const isSelected = opt.classList.contains('selected');
    const shouldBeSelected = opt.dataset.correct === 'true';

    opt.style.pointerEvents = 'none';

    if (shouldBeSelected) {
      opt.style.background = '#dcfce7';
      opt.style.borderColor = '#10b981';
    }

    if (isSelected !== shouldBeSelected) {
      allCorrect = false;
      if (isSelected && !shouldBeSelected) {
        opt.style.background = '#fee2e2';
        opt.style.borderColor = '#ef4444';
      }
    }
  });

  learningState.gamesPlayed++;
  if (allCorrect) learningState.gamesCorrect++;

  setTimeout(() => showGameFeedback(allCorrect), 500);
};

/**
 * Check order sequence
 */
window.checkOrderSequence = function() {
  const items = document.querySelectorAll('.order-item');
  let allCorrect = true;

  items.forEach((item, i) => {
    const correctIndex = parseInt(item.dataset.correct);
    const isCorrect = correctIndex === i;

    if (!isCorrect) allCorrect = false;

    item.style.background = isCorrect ? '#dcfce7' : '#fee2e2';
    item.style.borderColor = isCorrect ? '#10b981' : '#ef4444';
  });

  learningState.gamesPlayed++;
  if (allCorrect) learningState.gamesCorrect++;

  setTimeout(() => showGameFeedback(allCorrect), 800);
};

/**
 * Initialize drag and drop for order sequence
 */
function initDragAndDrop() {
  const container = document.getElementById('order-container');
  if (!container) return;

  let draggedItem = null;
  let touchStartY = 0;
  let placeholder = null;

  container.querySelectorAll('.order-item').forEach(item => {
    // Desktop drag events
    item.addEventListener('dragstart', (e) => {
      draggedItem = item;
      item.style.opacity = '0.5';
    });

    item.addEventListener('dragend', () => {
      draggedItem.style.opacity = '1';
      draggedItem = null;
      updateOrderNumbers();
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (draggedItem && draggedItem !== item) {
        const rect = item.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
          container.insertBefore(draggedItem, item);
        } else {
          container.insertBefore(draggedItem, item.nextSibling);
        }
      }
    });

    // Touch events for mobile
    item.addEventListener('touchstart', (e) => {
      draggedItem = item;
      touchStartY = e.touches[0].clientY;
      item.style.opacity = '0.7';
      item.style.transform = 'scale(1.02)';
      item.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.15)';
      item.style.zIndex = '1000';
      item.style.transition = 'none';
    }, { passive: true });

    item.addEventListener('touchmove', (e) => {
      if (!draggedItem) return;
      e.preventDefault();

      const touchY = e.touches[0].clientY;
      const items = Array.from(container.querySelectorAll('.order-item'));

      // Find the item we're hovering over
      for (const otherItem of items) {
        if (otherItem === draggedItem) continue;

        const rect = otherItem.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;

        if (touchY < midY && touchY > rect.top - 20) {
          container.insertBefore(draggedItem, otherItem);
          break;
        } else if (touchY > midY && touchY < rect.bottom + 20) {
          container.insertBefore(draggedItem, otherItem.nextSibling);
          break;
        }
      }
    }, { passive: false });

    item.addEventListener('touchend', () => {
      if (draggedItem) {
        draggedItem.style.opacity = '1';
        draggedItem.style.transform = '';
        draggedItem.style.boxShadow = '';
        draggedItem.style.zIndex = '';
        draggedItem.style.transition = '';
        draggedItem = null;
        updateOrderNumbers();
      }
    });
  });
}

/**
 * Update order numbers after reordering
 */
function updateOrderNumbers() {
  document.querySelectorAll('.order-item').forEach((item, i) => {
    const numberEl = item.querySelector('div');
    if (numberEl) numberEl.textContent = i + 1;
  });
}

// =============================================================================
// FEEDBACK & COMPLETION
// =============================================================================

/**
 * Show feedback after answering - Duolingo-style with celebrations
 */
function showGameFeedback(isCorrect, explanation = '') {
  const unit = UNITS[learningState.currentLesson.unitId];
  const module = MODULES[unit.moduleId];

  // Update streak
  if (isCorrect) {
    learningState.currentStreak++;
    if (learningState.currentStreak > learningState.maxStreak) {
      learningState.maxStreak = learningState.currentStreak;
    }

    // Mascot reaction
    if (window.LearningMascot) {
      window.LearningMascot.onCorrect(learningState.currentStreak);
    }

    // Play sounds and effects based on streak
    try {
      if (learningState.currentStreak >= 3 && learningState.currentStreak % 3 === 0) {
        sounds.streak?.();
        createConfetti(30, [module.color, '#f59e0b', '#10b981']);
      } else {
        sounds.correct?.();
      }
    } catch (e) {}

    // Create particle burst at center of screen for correct answers
    if (learningState.currentStreak >= 2) {
      createParticleBurst(window.innerWidth / 2, window.innerHeight / 2, module.color, 8);
    }
  } else {
    learningState.currentStreak = 0;
    try { sounds.incorrect?.(); } catch (e) {}

    // Mascot reaction
    if (window.LearningMascot) {
      window.LearningMascot.onIncorrect();
    }
  }

  // Get dynamic feedback message
  let feedbackTitle = isCorrect ? getRandomMessage('correct') : getRandomMessage('incorrect');
  let streakMessage = '';

  if (isCorrect && learningState.currentStreak === 3) {
    streakMessage = getRandomMessage('streak3');
  } else if (isCorrect && learningState.currentStreak === 5) {
    streakMessage = getRandomMessage('streak5');
  } else if (isCorrect && learningState.currentStreak >= 10 && learningState.currentStreak % 5 === 0) {
    streakMessage = getRandomMessage('streak10');
  }

  const emoji = isCorrect ? getRandomEmoji('correct') : getRandomEmoji('incorrect');

  const feedbackOverlay = document.createElement('div');
  feedbackOverlay.id = 'game-feedback-overlay';
  feedbackOverlay.style.cssText = `
    position: fixed; bottom: 0; left: 0; right: 0;
    background: ${isCorrect ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'};
    padding: 30px 24px; border-radius: 28px 28px 0 0;
    z-index: 1000; transform: translateY(100%);
    transition: transform 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    box-shadow: 0 -10px 40px rgba(0,0,0,0.2);
  `;

  feedbackOverlay.innerHTML = `
    <div style="display: flex; align-items: center; gap: 16px; margin-bottom: ${explanation || streakMessage ? '18px' : '0'};">
      <!-- Animated Character/Emoji -->
      <div class="${isCorrect ? 'character-happy' : 'character-sad'}" style="width: 60px; height: 60px; background: rgba(255,255,255,0.25); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2rem; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
        ${emoji}
      </div>
      <div style="flex: 1;">
        <div style="font-size: 1.4rem; font-weight: 800; color: white; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">${feedbackTitle}</div>
        ${isCorrect && learningState.currentStreak >= 2 ? `
          <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
            <span class="streak-fire" style="font-size: 1rem;">🔥</span>
            <span style="font-size: 0.9rem; color: rgba(255,255,255,0.95); font-weight: 600;">${learningState.currentStreak} in a row!</span>
          </div>
        ` : ''}
      </div>
      ${isCorrect ? `
        <div class="icon-pop" style="width: 50px; height: 50px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
          <svg viewBox="0 0 24 24" style="width: 28px; height: 28px; fill: white;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        </div>
      ` : ''}
    </div>

    ${streakMessage ? `
      <div class="streak-badge" style="background: rgba(255,255,255,0.2); padding: 12px 16px; border-radius: 12px; margin-bottom: 15px; text-align: center;">
        <span style="font-size: 1.1rem; font-weight: 700; color: white;">${streakMessage}</span>
      </div>
    ` : ''}

    ${explanation ? `
      <div style="background: rgba(255,255,255,0.15); padding: 14px 16px; border-radius: 14px; margin-bottom: 20px;">
        <p style="color: white; font-size: 0.95rem; line-height: 1.55; margin: 0; font-weight: 500;">${explanation}</p>
      </div>
    ` : ''}

    <button onclick="continueAfterFeedback()" style="width: 100%; background: white; color: ${isCorrect ? '#10b981' : '#ef4444'}; border: none; padding: 16px; border-radius: 16px; font-size: 1.1rem; font-weight: 800; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.15); transition: transform 0.2s;"
            onmouseover="this.style.transform='scale(1.02)'"
            onmouseout="this.style.transform='scale(1)'">
      Continue
    </button>
  `;

  document.body.appendChild(feedbackOverlay);
  requestAnimationFrame(() => {
    feedbackOverlay.style.transform = 'translateY(0)';
  });

  // Auto-advance after delay for correct answers (optional enhancement)
  if (isCorrect && !explanation) {
    // Could add auto-continue here if desired
  }
}

/**
 * Continue to next game after feedback
 */
window.continueAfterFeedback = function() {
  const overlay = document.getElementById('game-feedback-overlay');
  if (overlay) {
    overlay.style.transform = 'translateY(100%)';
    setTimeout(() => overlay.remove(), 300);
  }

  learningState.currentGameIndex++;
  renderCurrentGame();
};

/**
 * Exit lesson early
 */
window.exitLesson = function() {
  if (confirm('Exit this lesson? Your progress in this lesson won\'t be saved.')) {
    // Hide mascot
    if (window.LearningMascot) {
      window.LearningMascot.hide();
    }
    openLearningUnit(learningState.currentLesson.unitId);
  }
};

/**
 * Complete the lesson and award XP
 */
async function completeLesson() {
  // Hide mascot when lesson completes
  if (window.LearningMascot) {
    window.LearningMascot.hide();
  }

  const lesson = learningState.currentLesson;
  const unit = UNITS[lesson.unitId];
  const module = MODULES[unit.moduleId];

  // Call database to record completion
  try {
    const { data, error } = await window.supabase.rpc('complete_lesson', {
      p_user_id: window.currentUser?.id,
      p_lesson_id: lesson.id,
      p_unit_id: lesson.unitId,
      p_module_id: unit.moduleId,
      p_games_played: learningState.gamesPlayed,
      p_games_correct: learningState.gamesCorrect
    });

    if (error) throw error;

    // Update tamagotchi XP bar if XP was earned
    if (data?.xp_earned > 0) {
      if (typeof window.triggerXPBarRainbow === 'function') window.triggerXPBarRainbow();
      if (typeof window.refreshLevelDisplay === 'function') window.refreshLevelDisplay();
    }

    // Check for unit completion
    const lessons = getLessonsForUnit(lesson.unitId);
    const completedLessons = [...(learningState.userProgress?.lessons_completed || []), lesson.id];
    const unitComplete = lessons.every(l => completedLessons.includes(l.id));

    if (unitComplete && !learningState.userProgress?.units_completed?.includes(lesson.unitId)) {
      const unitResult = await window.supabase.rpc('complete_unit', {
        p_user_id: window.currentUser?.id,
        p_unit_id: lesson.unitId,
        p_module_id: unit.moduleId
      });

      // Update tamagotchi XP bar for unit completion bonus
      if (unitResult?.data?.xp_earned > 0) {
        if (typeof window.triggerXPBarRainbow === 'function') window.triggerXPBarRainbow();
        if (typeof window.refreshLevelDisplay === 'function') window.refreshLevelDisplay();
      }
    }

    // Show completion screen
    renderLessonComplete(data, lesson, module);

    // Refresh progress
    initLearning();

  } catch (err) {
    console.error('Error completing lesson:', err);
    // Show completion screen anyway
    renderLessonComplete({ xp_earned: 0, is_new_lesson: false }, lesson, module);
  }
}

/**
 * Render lesson completion screen - Duolingo-style celebration
 */
function renderLessonComplete(result, lesson, module) {
  const container = document.getElementById('learning-content');
  if (!container) return;

  const scorePercent = learningState.gamesPlayed > 0
    ? Math.round((learningState.gamesCorrect / learningState.gamesPlayed) * 100)
    : 100;

  const maxStreak = learningState.maxStreak;

  // Trigger celebration for good scores
  if (scorePercent === 100) {
    createConfetti(80, [module.color, '#f59e0b', '#10b981', '#8b5cf6']);
    try { sounds.complete?.(); } catch (e) {}
  } else if (scorePercent >= 80) {
    createConfetti(40, [module.color, '#10b981']);
    try { sounds.correct?.(); } catch (e) {}
  }

  // Determine status message and celebration emoji
  let statusMessage = '';
  let celebrationEmoji = '🎉';
  let celebrationTitle = 'Lesson Complete!';

  if (scorePercent === 100) {
    celebrationEmoji = '🏆';
    celebrationTitle = 'Perfect Score!';
  } else if (scorePercent >= 80) {
    celebrationEmoji = '⭐';
    celebrationTitle = 'Great Job!';
  } else if (scorePercent >= 60) {
    celebrationEmoji = '👍';
    celebrationTitle = 'Good Effort!';
  } else {
    celebrationEmoji = '💪';
    celebrationTitle = 'Keep Learning!';
  }

  if (result?.is_new_lesson === false) {
    statusMessage = `<div style="padding: 14px 18px; background: rgba(255,255,255,0.15); border-radius: 14px; font-size: 0.9rem; color: white; backdrop-filter: blur(10px);">
      <span style="margin-right: 8px;">📚</span>You've already earned XP for this lesson.
    </div>`;
  } else if (result?.needs_perfect_score) {
    statusMessage = `<div style="padding: 14px 18px; background: rgba(255,255,255,0.15); border-radius: 14px; font-size: 0.9rem; color: white; backdrop-filter: blur(10px);">
      <span style="margin-right: 8px;">🎯</span>Get 100% to earn XP! You can retake this lesson.
    </div>`;
  }

  container.innerHTML = `
    <div style="min-height: 100vh; background: linear-gradient(180deg, ${module.color} 0%, ${module.color}dd 50%, ${module.color}bb 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 30px 20px; text-align: center; position: relative; overflow: hidden;">

      <!-- Background decorations -->
      <div style="position: absolute; top: 10%; left: 10%; width: 100px; height: 100px; background: rgba(255,255,255,0.1); border-radius: 50%; filter: blur(40px);"></div>
      <div style="position: absolute; bottom: 20%; right: 10%; width: 150px; height: 150px; background: rgba(255,255,255,0.08); border-radius: 50%; filter: blur(50px);"></div>

      <!-- Celebration Icon -->
      <div class="celebration-bounce" style="width: 120px; height: 120px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 30px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); position: relative;">
        <span style="font-size: 60px;">${celebrationEmoji}</span>
        <!-- Sparkles -->
        <div class="icon-twinkle" style="position: absolute; top: -5px; right: 5px; font-size: 24px;">✨</div>
        <div class="icon-twinkle" style="position: absolute; bottom: 5px; left: -5px; font-size: 18px; animation-delay: 0.3s;">✨</div>
      </div>

      <!-- Title -->
      <h1 class="text-reveal" style="color: white; font-size: 2rem; font-weight: 800; margin: 0 0 8px; text-shadow: 0 4px 15px rgba(0,0,0,0.15);">${celebrationTitle}</h1>
      <p class="text-reveal text-reveal-delay-1" style="color: rgba(255,255,255,0.9); font-size: 1.05rem; margin: 0 0 35px; font-weight: 500;">${lesson.title}</p>

      <!-- Stats Card -->
      <div class="text-reveal text-reveal-delay-2" style="background: white; border-radius: 24px; padding: 30px; width: 100%; max-width: 340px; box-shadow: 0 15px 50px rgba(0,0,0,0.2);">

        <!-- Score Ring -->
        <div style="display: flex; justify-content: center; margin-bottom: 25px;">
          <div style="position: relative; width: 100px; height: 100px;">
            <svg viewBox="0 0 100 100" style="transform: rotate(-90deg);">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" stroke-width="8"/>
              <circle cx="50" cy="50" r="42" fill="none" stroke="${scorePercent === 100 ? '#10b981' : module.color}" stroke-width="8" stroke-linecap="round"
                      stroke-dasharray="${scorePercent * 2.64} 264"
                      style="transition: stroke-dasharray 1s ease-out;"/>
            </svg>
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
              <div class="score-pop" style="font-size: 1.8rem; font-weight: 800; color: var(--text-main);">${scorePercent}%</div>
            </div>
          </div>
        </div>

        <!-- Stats Grid -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px;">
          <div style="text-align: center; padding: 12px; background: #f8fafc; border-radius: 12px;">
            <div style="font-size: 1.4rem; font-weight: 700; color: var(--text-main);">${learningState.gamesCorrect}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">Correct</div>
          </div>
          <div style="text-align: center; padding: 12px; background: ${result?.xp_earned > 0 ? '#dcfce7' : '#f8fafc'}; border-radius: 12px;">
            <div style="font-size: 1.4rem; font-weight: 700; color: ${result?.xp_earned > 0 ? '#10b981' : 'var(--text-muted)'};">${result?.xp_earned > 0 ? '+' + result.xp_earned : '0'}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">XP</div>
          </div>
          <div style="text-align: center; padding: 12px; background: ${maxStreak >= 3 ? '#fef3c7' : '#f8fafc'}; border-radius: 12px;">
            <div style="font-size: 1.4rem; font-weight: 700; color: ${maxStreak >= 3 ? '#f59e0b' : 'var(--text-main)'};">${maxStreak >= 2 ? '🔥' : ''}${maxStreak}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">Best Streak</div>
          </div>
        </div>

        ${statusMessage}
      </div>

      <!-- Action Buttons -->
      <div class="text-reveal text-reveal-delay-3" style="display: flex; gap: 14px; margin-top: 35px; flex-wrap: wrap; justify-content: center;">
        ${scorePercent < 100 && result?.is_new_lesson !== false ? `
          <button onclick="startLesson('${lesson.id}')" style="background: rgba(255,255,255,0.2); color: white; border: 2px solid rgba(255,255,255,0.4); padding: 16px 32px; border-radius: 50px; font-size: 1.1rem; font-weight: 700; cursor: pointer; backdrop-filter: blur(10px); transition: all 0.2s;"
                  onmouseover="this.style.background='rgba(255,255,255,0.3)'; this.style.transform='scale(1.02)'"
                  onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.transform='scale(1)'">
            🔄 Try Again
          </button>
        ` : ''}
        <button onclick="openLearningUnit('${lesson.unitId}')" style="background: white; color: ${module.color}; border: none; padding: 16px 32px; border-radius: 50px; font-size: 1.1rem; font-weight: 800; cursor: pointer; box-shadow: 0 6px 25px rgba(0,0,0,0.15); transition: all 0.2s;"
                onmouseover="this.style.transform='translateY(-2px) scale(1.02)'; this.style.boxShadow='0 8px 30px rgba(0,0,0,0.2)'"
                onmouseout="this.style.transform='translateY(0) scale(1)'; this.style.boxShadow='0 6px 25px rgba(0,0,0,0.15)'">
          ${scorePercent === 100 ? '🚀' : '📚'} Continue Learning
        </button>
      </div>
    </div>
  `;

  // Reset streak for next lesson
  learningState.currentStreak = 0;
  learningState.maxStreak = 0;
}

// ============================================================================
// LEARNING MASCOT SYSTEM
// ============================================================================

const LearningMascot = {
  messages: {
    greeting: [
      "Let's learn! 🌱",
      "Ready to grow?",
      "Time to level up! 💪"
    ],
    correct: [
      "Nice one! 🎉",
      "You got it!",
      "Brilliant! ⭐",
      "Keep going!",
      "Awesome! 💪"
    ],
    incorrect: [
      "Almost there!",
      "Try again!",
      "You'll get it! 💪",
      "Keep learning!"
    ],
    streak: [
      "On fire! 🔥",
      "Unstoppable!",
      "You're crushing it!",
      "Amazing streak! 💪"
    ],
    encouragement: [
      "You've got this!",
      "Keep it up! 🌟",
      "Great progress!",
      "Learning is power!"
    ],
    tips: [
      "Protein builds muscle!",
      "Sleep = recovery 💤",
      "Hydration matters!",
      "Consistency wins! 🏆"
    ]
  },

  show() {
    const mascot = document.getElementById('learnMascot');
    if (mascot) {
      mascot.classList.add('visible');
      // Show greeting
      setTimeout(() => {
        this.showMessage(this.getRandomMessage('greeting'));
      }, 500);
    }
  },

  hide() {
    const mascot = document.getElementById('learnMascot');
    if (mascot) mascot.classList.remove('visible');
  },

  getRandomMessage(category) {
    const msgs = this.messages[category];
    return msgs[Math.floor(Math.random() * msgs.length)];
  },

  showMessage(message, duration = 3000) {
    const speech = document.getElementById('learnMascotSpeech');
    if (!speech) return;

    speech.textContent = message;
    speech.classList.add('visible');

    setTimeout(() => {
      speech.classList.remove('visible');
    }, duration);
  },

  react(type) {
    const avatar = document.getElementById('learnMascotAvatar');
    if (!avatar) return;

    // Remove existing reactions
    avatar.classList.remove('happy', 'sad', 'excited', 'thinking');
    void avatar.offsetWidth; // Force reflow

    avatar.classList.add(type);

    setTimeout(() => {
      avatar.classList.remove(type);
    }, type === 'excited' ? 2000 : 600);
  },

  onCorrect(streak) {
    this.react('happy');

    // Special messages for streaks
    if (streak >= 3 && streak % 3 === 0) {
      this.react('excited');
      this.showMessage(this.getRandomMessage('streak'));
    } else if (Math.random() > 0.6) {
      this.showMessage(this.getRandomMessage('correct'));
    }
  },

  onIncorrect() {
    this.react('sad');
    if (Math.random() > 0.5) {
      this.showMessage(this.getRandomMessage('incorrect'));
    }
  },

  tapped() {
    this.react('happy');
    const msgType = Math.random() > 0.5 ? 'tips' : 'encouragement';
    this.showMessage(this.getRandomMessage(msgType));
  }
};

// Make mascot globally available
window.LearningMascot = LearningMascot;

// Make functions globally available
window.renderLearningHome = renderLearningHome;
window.initLearning = initLearning;

export default {
  initLearning,
  renderLearningHome,
};
