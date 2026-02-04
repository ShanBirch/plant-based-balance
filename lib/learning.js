/**
 * Learning System - Duolingo-style fitness education
 * Handles UI rendering, game logic, and progress tracking
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
};

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize learning tab when opened
 */
export async function initLearning() {
  learningState.isLoading = true;
  renderLearningLoading();

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
  const dailyStatus = progress?.daily_status || { can_learn: true, lessons_remaining: 3 };

  // Calculate overall progress
  const totalLessons = 75; // 3 modules × 5 units × 5 lessons
  const completedLessons = progress?.lessons_completed?.length || 0;
  const progressPercent = Math.round((completedLessons / totalLessons) * 100);

  container.innerHTML = `
    <!-- Daily Status Banner -->
    <div style="margin: 15px; padding: 16px 20px; background: ${dailyStatus.can_learn ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : 'linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)'}; border-radius: 16px; display: flex; align-items: center; gap: 15px;">
      <div style="font-size: 2rem;">${dailyStatus.can_learn ? '🧠' : '😴'}</div>
      <div style="flex: 1;">
        <div style="font-weight: 700; color: white; font-size: 1rem;">
          ${dailyStatus.can_learn
            ? `${dailyStatus.lessons_remaining} lesson${dailyStatus.lessons_remaining !== 1 ? 's' : ''} available today`
            : 'Daily limit reached'}
        </div>
        <div style="font-size: 0.85rem; color: rgba(255,255,255,0.85); margin-top: 2px;">
          ${dailyStatus.can_learn
            ? '+1 XP per new lesson completed'
            : 'Come back tomorrow for more learning!'}
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
  const dailyStatus = progress?.daily_status || { can_learn: true };

  return `
    <div onclick="${canAccess && dailyStatus.can_learn ? `startLesson('${lesson.id}')` : ''}"
         style="background: white; border-radius: 12px; padding: 16px; box-shadow: 0 2px 6px rgba(0,0,0,0.05); cursor: ${canAccess && dailyStatus.can_learn ? 'pointer' : 'not-allowed'}; opacity: ${canAccess ? '1' : '0.5'}; display: flex; align-items: center; gap: 14px; transition: transform 0.2s;"
         ${canAccess && dailyStatus.can_learn ? `onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'"` : ''}>
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
      ${canAccess && !isComplete && dailyStatus.can_learn ? `
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

/**
 * Render lesson intro/content screen
 */
function renderLessonIntro(lesson) {
  const container = document.getElementById('learning-content');
  if (!container) return;

  const unit = UNITS[lesson.unitId];
  const module = MODULES[unit.moduleId];

  container.innerHTML = `
    <div style="min-height: 100vh; background: linear-gradient(180deg, ${module.color}15 0%, white 30%);">
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

      <!-- Lesson Content Card -->
      <div style="margin: 10px 15px; background: white; border-radius: 20px; padding: 25px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
        <h1 style="margin: 0 0 20px; font-size: 1.5rem; font-weight: 700; color: var(--text-main); line-height: 1.3;">${lesson.title}</h1>

        <div style="font-size: 1rem; color: var(--text-main); line-height: 1.7; white-space: pre-wrap;">${lesson.content.intro}</div>

        <!-- Key Point -->
        <div style="margin-top: 25px; padding: 16px; background: ${module.color}10; border-radius: 12px; border-left: 4px solid ${module.color};">
          <div style="font-size: 0.75rem; font-weight: 700; color: ${module.color}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Key Insight</div>
          <div style="font-size: 0.95rem; color: var(--text-main); line-height: 1.5; font-weight: 500;">${lesson.content.keyPoint}</div>
        </div>
      </div>

      <!-- Start Games Button -->
      <div style="padding: 20px 15px;">
        <button onclick="startLessonGames()" style="width: 100%; background: ${module.color}; color: white; border: none; padding: 16px; border-radius: 14px; font-size: 1.1rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 4px 12px ${module.color}40;">
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
    <div style="min-height: 100vh; background: #f8fafc; display: flex; flex-direction: column;">
      <!-- Header with Progress -->
      <div style="padding: 15px 20px; background: white; border-bottom: 1px solid #e5e7eb;">
        <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 12px;">
          <button onclick="exitLesson()" style="background: none; border: none; padding: 5px; cursor: pointer;">
            <svg viewBox="0 0 24 24" style="width: 24px; height: 24px; fill: #9ca3af;"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
          <div style="flex: 1; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden;">
            <div style="height: 100%; width: ${progressPercent}%; background: ${module.color}; border-radius: 4px; transition: width 0.3s ease;"></div>
          </div>
          <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500;">${gameIndex + 1}/${lesson.games.length}</span>
        </div>
      </div>

      <!-- Game Content -->
      <div style="flex: 1; padding: 20px; display: flex; flex-direction: column;">
        ${gameHtml}
      </div>
    </div>
  `;

  // Initialize any game-specific listeners
  initGameListeners(game);
}

// =============================================================================
// GAME RENDERERS
// =============================================================================

/**
 * Swipe True/False game
 */
function renderSwipeTrueFalse(game, module) {
  return `
    <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 20px;">
      <div style="font-size: 0.9rem; color: ${module.color}; font-weight: 600; margin-bottom: 15px;">TRUE OR FALSE?</div>

      <div id="swipe-card" style="background: white; border-radius: 20px; padding: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 340px; width: 100%; transform: translateX(0); transition: transform 0.3s ease, opacity 0.3s ease;">
        <p style="font-size: 1.2rem; color: var(--text-main); line-height: 1.5; margin: 0;">${game.question}</p>
      </div>

      <div style="display: flex; gap: 40px; margin-top: 40px;">
        <button onclick="answerSwipe(false)" style="width: 70px; height: 70px; border-radius: 50%; background: white; border: 3px solid #ef4444; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.2s, background 0.2s;" onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='white'">
          <svg viewBox="0 0 24 24" style="width: 32px; height: 32px; fill: #ef4444;"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
        <button onclick="answerSwipe(true)" style="width: 70px; height: 70px; border-radius: 50%; background: white; border: 3px solid #10b981; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.2s, background 0.2s;" onmouseover="this.style.background='#ecfdf5'" onmouseout="this.style.background='white'">
          <svg viewBox="0 0 24 24" style="width: 32px; height: 32px; fill: #10b981;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        </button>
      </div>

      <div style="margin-top: 20px; display: flex; gap: 30px; font-size: 0.85rem; color: var(--text-muted);">
        <span>FALSE</span>
        <span>TRUE</span>
      </div>
    </div>
  `;
}

/**
 * Fill in the blank game
 */
function renderFillBlank(game, module) {
  const shuffledOptions = [...game.options].sort(() => Math.random() - 0.5);

  return `
    <div style="flex: 1; display: flex; flex-direction: column;">
      <div style="font-size: 0.9rem; color: ${module.color}; font-weight: 600; margin-bottom: 20px;">FILL IN THE BLANK</div>

      <div style="background: white; border-radius: 16px; padding: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.06); margin-bottom: 30px;">
        <p style="font-size: 1.15rem; color: var(--text-main); line-height: 1.6; margin: 0;">
          ${game.sentence.replace('_______', '<span id="blank-slot" style="display: inline-block; min-width: 100px; border-bottom: 3px solid ' + module.color + '; margin: 0 5px; text-align: center; font-weight: 600; color: ' + module.color + ';">_______</span>')}
        </p>
      </div>

      <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;">
        ${shuffledOptions.map(option => `
          <button class="fill-blank-option" data-value="${option}" onclick="selectFillBlank('${option}')"
                  style="background: white; border: 2px solid #e5e7eb; border-radius: 25px; padding: 12px 24px; font-size: 1rem; font-weight: 500; color: var(--text-main); cursor: pointer; transition: all 0.2s;">
            ${option}
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Match pairs game
 */
function renderMatchPairs(game, module) {
  const leftItems = game.pairs.map((p, i) => ({ text: p.left, index: i }));
  const rightItems = game.pairs.map((p, i) => ({ text: p.right, index: i })).sort(() => Math.random() - 0.5);

  return `
    <div style="flex: 1; display: flex; flex-direction: column;">
      <div style="font-size: 0.9rem; color: ${module.color}; font-weight: 600; margin-bottom: 20px;">MATCH THE PAIRS</div>
      <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 20px;">Tap items to match them</p>

      <div style="display: flex; gap: 15px;">
        <div style="flex: 1; display: flex; flex-direction: column; gap: 10px;">
          ${leftItems.map(item => `
            <div class="match-item match-left" data-index="${item.index}" onclick="selectMatchItem(this, 'left')"
                 style="background: white; border: 2px solid #e5e7eb; border-radius: 12px; padding: 14px; font-size: 0.9rem; color: var(--text-main); cursor: pointer; transition: all 0.2s; text-align: center;">
              ${item.text}
            </div>
          `).join('')}
        </div>
        <div style="flex: 1; display: flex; flex-direction: column; gap: 10px;">
          ${rightItems.map(item => `
            <div class="match-item match-right" data-index="${item.index}" onclick="selectMatchItem(this, 'right')"
                 style="background: white; border: 2px solid #e5e7eb; border-radius: 12px; padding: 14px; font-size: 0.9rem; color: var(--text-main); cursor: pointer; transition: all 0.2s; text-align: center;">
              ${item.text}
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

/**
 * Order sequence game
 */
function renderOrderSequence(game, module) {
  const shuffledItems = game.items.map((item, i) => ({ text: item, correctIndex: i })).sort(() => Math.random() - 0.5);

  return `
    <div style="flex: 1; display: flex; flex-direction: column;">
      <div style="font-size: 0.9rem; color: ${module.color}; font-weight: 600; margin-bottom: 10px;">PUT IN ORDER</div>
      <p style="font-size: 0.95rem; color: var(--text-main); margin-bottom: 20px;">${game.question}</p>

      <div id="order-container" style="display: flex; flex-direction: column; gap: 10px;">
        ${shuffledItems.map((item, i) => `
          <div class="order-item" data-correct="${item.correctIndex}" draggable="true"
               style="background: white; border: 2px solid #e5e7eb; border-radius: 12px; padding: 14px 16px; font-size: 0.95rem; color: var(--text-main); cursor: grab; display: flex; align-items: center; gap: 12px; transition: all 0.2s;">
            <div style="width: 28px; height: 28px; background: #f1f5f9; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; color: var(--text-muted); font-size: 0.85rem;">${i + 1}</div>
            <span style="flex: 1;">${item.text}</span>
            <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: #d1d5db;"><path d="M3 15h18v-2H3v2zm0 4h18v-2H3v2zm0-8h18V9H3v2zm0-6v2h18V5H3z"/></svg>
          </div>
        `).join('')}
      </div>

      <button onclick="checkOrderSequence()" style="margin-top: 25px; background: ${module.color}; color: white; border: none; padding: 14px; border-radius: 12px; font-size: 1rem; font-weight: 600; cursor: pointer;">
        Check Order
      </button>
    </div>
  `;
}

/**
 * Scenario story game
 */
function renderScenarioStory(game, module) {
  return `
    <div style="flex: 1; display: flex; flex-direction: column;">
      <div style="font-size: 0.9rem; color: ${module.color}; font-weight: 600; margin-bottom: 15px;">SCENARIO</div>

      <div style="background: white; border-radius: 16px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.06); margin-bottom: 20px;">
        <p style="font-size: 1rem; color: var(--text-main); line-height: 1.6; margin: 0 0 15px;">${game.scenario}</p>
        <p style="font-size: 1rem; color: var(--text-main); font-weight: 600; margin: 0;">${game.question}</p>
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px;">
        ${game.options.map((option, i) => `
          <button class="scenario-option" data-correct="${option.correct}" onclick="selectScenarioOption(this)"
                  style="background: white; border: 2px solid #e5e7eb; border-radius: 12px; padding: 16px; font-size: 0.95rem; color: var(--text-main); cursor: pointer; text-align: left; transition: all 0.2s; display: flex; align-items: flex-start; gap: 12px;">
            <span style="width: 26px; height: 26px; background: #f1f5f9; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; color: var(--text-muted); font-size: 0.85rem; flex-shrink: 0;">${String.fromCharCode(65 + i)}</span>
            <span>${option.text}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Tap all that apply game
 */
function renderTapAll(game, module) {
  const shuffledOptions = [...game.options].sort(() => Math.random() - 0.5);

  return `
    <div style="flex: 1; display: flex; flex-direction: column;">
      <div style="font-size: 0.9rem; color: ${module.color}; font-weight: 600; margin-bottom: 10px;">SELECT ALL THAT APPLY</div>
      <p style="font-size: 1rem; color: var(--text-main); margin-bottom: 20px;">${game.question}</p>

      <div style="display: flex; flex-direction: column; gap: 10px;">
        ${shuffledOptions.map(option => `
          <button class="tap-all-option" data-correct="${option.correct}" onclick="toggleTapAllOption(this)"
                  style="background: white; border: 2px solid #e5e7eb; border-radius: 12px; padding: 14px 16px; font-size: 0.95rem; color: var(--text-main); cursor: pointer; text-align: left; transition: all 0.2s; display: flex; align-items: center; gap: 12px;">
            <div class="tap-checkbox" style="width: 24px; height: 24px; border: 2px solid #d1d5db; border-radius: 6px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"></div>
            <span>${option.text}</span>
          </button>
        `).join('')}
      </div>

      <button onclick="checkTapAll()" style="margin-top: 25px; background: ${module.color}; color: white; border: none; padding: 14px; border-radius: 12px; font-size: 1rem; font-weight: 600; cursor: pointer;">
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
 * Swipe answer handler
 */
window.answerSwipe = function(answer) {
  const lesson = learningState.currentLesson;
  const game = lesson.games[learningState.currentGameIndex];
  const isCorrect = answer === game.answer;

  learningState.gamesPlayed++;
  if (isCorrect) learningState.gamesCorrect++;

  showGameFeedback(isCorrect, game.explanation);
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
 * Match pair selection handler
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
    }
  });

  // Select this item
  element.style.borderColor = module.color;
  element.style.background = module.color + '10';

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
      // Correct match
      matchState.selectedLeft.classList.add('matched');
      matchState.selectedRight.classList.add('matched');
      matchState.selectedLeft.style.background = '#dcfce7';
      matchState.selectedLeft.style.borderColor = '#10b981';
      matchState.selectedRight.style.background = '#dcfce7';
      matchState.selectedRight.style.borderColor = '#10b981';
      matchState.matched.push(leftIndex);

      // Check if all matched
      const lesson = learningState.currentLesson;
      const game = lesson.games[learningState.currentGameIndex];
      if (matchState.matched.length === game.pairs.length) {
        learningState.gamesPlayed++;
        learningState.gamesCorrect++;
        setTimeout(() => showGameFeedback(true), 500);
      }
    } else {
      // Wrong match - flash red
      matchState.selectedLeft.style.background = '#fee2e2';
      matchState.selectedLeft.style.borderColor = '#ef4444';
      matchState.selectedRight.style.background = '#fee2e2';
      matchState.selectedRight.style.borderColor = '#ef4444';

      setTimeout(() => {
        if (!matchState.selectedLeft.classList.contains('matched')) {
          matchState.selectedLeft.style.background = 'white';
          matchState.selectedLeft.style.borderColor = '#e5e7eb';
        }
        if (!matchState.selectedRight.classList.contains('matched')) {
          matchState.selectedRight.style.background = 'white';
          matchState.selectedRight.style.borderColor = '#e5e7eb';
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
 * Tap all toggle handler
 */
window.toggleTapAllOption = function(element) {
  const checkbox = element.querySelector('.tap-checkbox');
  const isSelected = element.classList.toggle('selected');

  if (isSelected) {
    element.style.borderColor = '#7c3aed';
    element.style.background = '#f5f3ff';
    checkbox.style.background = '#7c3aed';
    checkbox.style.borderColor = '#7c3aed';
    checkbox.innerHTML = '<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: white;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
  } else {
    element.style.borderColor = '#e5e7eb';
    element.style.background = 'white';
    checkbox.style.background = 'white';
    checkbox.style.borderColor = '#d1d5db';
    checkbox.innerHTML = '';
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

  container.querySelectorAll('.order-item').forEach(item => {
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
 * Show feedback after answering
 */
function showGameFeedback(isCorrect, explanation = '') {
  const unit = UNITS[learningState.currentLesson.unitId];
  const module = MODULES[unit.moduleId];

  const feedbackOverlay = document.createElement('div');
  feedbackOverlay.id = 'game-feedback-overlay';
  feedbackOverlay.style.cssText = `
    position: fixed; bottom: 0; left: 0; right: 0;
    background: ${isCorrect ? '#10b981' : '#ef4444'};
    padding: 25px 20px; border-radius: 20px 20px 0 0;
    z-index: 1000; transform: translateY(100%);
    transition: transform 0.3s ease;
  `;

  feedbackOverlay.innerHTML = `
    <div style="display: flex; align-items: center; gap: 15px; margin-bottom: ${explanation ? '15px' : '0'};">
      <div style="width: 50px; height: 50px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
        ${isCorrect
          ? '<svg viewBox="0 0 24 24" style="width: 30px; height: 30px; fill: white;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'
          : '<svg viewBox="0 0 24 24" style="width: 30px; height: 30px; fill: white;"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>'
        }
      </div>
      <div style="flex: 1;">
        <div style="font-size: 1.2rem; font-weight: 700; color: white;">${isCorrect ? 'Correct!' : 'Not quite'}</div>
      </div>
    </div>
    ${explanation ? `<p style="color: rgba(255,255,255,0.95); font-size: 0.95rem; line-height: 1.5; margin: 0 0 20px;">${explanation}</p>` : ''}
    <button onclick="continueAfterFeedback()" style="width: 100%; background: white; color: ${isCorrect ? '#10b981' : '#ef4444'}; border: none; padding: 14px; border-radius: 12px; font-size: 1rem; font-weight: 700; cursor: pointer;">
      Continue
    </button>
  `;

  document.body.appendChild(feedbackOverlay);
  requestAnimationFrame(() => {
    feedbackOverlay.style.transform = 'translateY(0)';
  });
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
    openLearningUnit(learningState.currentLesson.unitId);
  }
};

/**
 * Complete the lesson and award XP
 */
async function completeLesson() {
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

    // Check for unit completion
    const lessons = getLessonsForUnit(lesson.unitId);
    const completedLessons = [...(learningState.userProgress?.lessons_completed || []), lesson.id];
    const unitComplete = lessons.every(l => completedLessons.includes(l.id));

    if (unitComplete && !learningState.userProgress?.units_completed?.includes(lesson.unitId)) {
      await window.supabase.rpc('complete_unit', {
        p_user_id: window.currentUser?.id,
        p_unit_id: lesson.unitId,
        p_module_id: unit.moduleId
      });
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
 * Render lesson completion screen
 */
function renderLessonComplete(result, lesson, module) {
  const container = document.getElementById('learning-content');
  if (!container) return;

  const scorePercent = learningState.gamesPlayed > 0
    ? Math.round((learningState.gamesCorrect / learningState.gamesPlayed) * 100)
    : 100;

  // Determine status message
  let statusMessage = '';
  if (result?.is_new_lesson === false) {
    statusMessage = `<div style="padding: 12px; background: rgba(255,255,255,0.2); border-radius: 10px; font-size: 0.85rem; color: white;">
      You've already earned XP for this lesson.
    </div>`;
  } else if (result?.needs_perfect_score) {
    statusMessage = `<div style="padding: 12px; background: rgba(255,255,255,0.2); border-radius: 10px; font-size: 0.85rem; color: white;">
      Get 100% to earn XP! You can retake this lesson.
    </div>`;
  }

  container.innerHTML = `
    <div style="min-height: 100vh; background: ${module.color}; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; text-align: center;">
      <!-- Celebration Icon -->
      <div style="width: 100px; height: 100px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 25px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
        <span style="font-size: 50px;">${scorePercent === 100 ? '🎉' : scorePercent >= 80 ? '👍' : '💪'}</span>
      </div>

      <h1 style="color: white; font-size: 1.8rem; font-weight: 700; margin: 0 0 10px;">${scorePercent === 100 ? 'Perfect Score!' : 'Lesson Complete!'}</h1>
      <p style="color: rgba(255,255,255,0.9); font-size: 1rem; margin: 0 0 30px;">${lesson.title}</p>

      <!-- Stats Card -->
      <div style="background: white; border-radius: 20px; padding: 25px; width: 100%; max-width: 320px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
        <div style="display: flex; justify-content: space-around; margin-bottom: 20px;">
          <div style="text-align: center;">
            <div style="font-size: 2rem; font-weight: 700; color: var(--text-main);">${scorePercent}%</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">Score</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 2rem; font-weight: 700; color: ${result?.xp_earned > 0 ? '#10b981' : 'var(--text-muted)'};">${result?.xp_earned > 0 ? '+' + result.xp_earned : '0'}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">XP Earned</div>
          </div>
        </div>

        ${statusMessage}
      </div>

      <!-- Action Buttons -->
      <div style="display: flex; gap: 12px; margin-top: 30px; flex-wrap: wrap; justify-content: center;">
        ${scorePercent < 100 && result?.is_new_lesson !== false ? `
          <button onclick="startLesson('${lesson.id}')" style="background: white; color: ${module.color}; border: none; padding: 16px 30px; border-radius: 30px; font-size: 1.1rem; font-weight: 700; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
            Try Again
          </button>
        ` : ''}
        <button onclick="openLearningUnit('${lesson.unitId}')" style="background: ${scorePercent < 100 && result?.is_new_lesson !== false ? 'rgba(255,255,255,0.2)' : 'white'}; color: ${scorePercent < 100 && result?.is_new_lesson !== false ? 'white' : module.color}; border: none; padding: 16px 30px; border-radius: 30px; font-size: 1.1rem; font-weight: 700; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
          Continue Learning
        </button>
      </div>
    </div>
  `;
}

// Make functions globally available
window.renderLearningHome = renderLearningHome;
window.initLearning = initLearning;

export default {
  initLearning,
  renderLearningHome,
};
