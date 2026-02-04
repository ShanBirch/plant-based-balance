/**
 * Learning System Configuration
 * Duolingo-style fitness education with games and XP rewards
 */

// =============================================================================
// XP REWARDS (balanced for 6-month progression to level 99)
// =============================================================================

export const LEARNING_XP = {
  LESSON_COMPLETE: 1,      // Same as logging a meal
  UNIT_COMPLETE_BONUS: 2,  // Small milestone
  MODULE_COMPLETE_BONUS: 5, // Medium milestone
  DAILY_LESSON_LIMIT: 3,   // Prevents grinding
};

// =============================================================================
// GAME TYPES
// =============================================================================

export const GAME_TYPES = {
  SWIPE_TRUE_FALSE: 'swipe_true_false',   // Swipe left (myth) or right (fact)
  MATCH_PAIRS: 'match_pairs',              // Drag to connect related concepts
  ORDER_SEQUENCE: 'order_sequence',        // Drag to put steps in order
  FILL_BLANK: 'fill_blank',                // Tap to select missing word
  SCENARIO_STORY: 'scenario_story',        // Choose response in a scenario
  TAP_ALL: 'tap_all',                      // Select all that apply
  CONNECT_CONCEPTS: 'connect_concepts',    // Draw lines between related items
  QUICK_FIRE: 'quick_fire',                // Timed rapid response
};

// =============================================================================
// MODULE DEFINITIONS
// =============================================================================

export const MODULES = {
  body: {
    id: 'body',
    title: 'Body',
    subtitle: 'Anatomy & Movement',
    icon: 'bone',
    color: '#E57373',
    description: 'Understand how your body works, moves, and adapts to training.',
    order: 1,
  },
  fuel: {
    id: 'fuel',
    title: 'Fuel',
    subtitle: 'Nutrition & Energy',
    icon: 'apple',
    color: '#81C784',
    description: 'Learn how food becomes energy and fuels your transformation.',
    order: 2,
  },
  mind: {
    id: 'mind',
    title: 'Mind',
    subtitle: 'Brain & Adaptation',
    icon: 'brain',
    color: '#7986CB',
    description: 'Discover how your brain predicts, adapts, and creates lasting change.',
    order: 3,
  },
  longevity: {
    id: 'longevity',
    title: 'Longevity',
    subtitle: 'Health Span & Disease Prevention',
    icon: 'heart-pulse',
    color: '#9575CD',
    description: 'Learn how to extend your healthy years and prevent chronic disease through science-backed strategies.',
    order: 4,
  },
};

// =============================================================================
// UNIT DEFINITIONS
// =============================================================================

export const UNITS = {
  // === BODY MODULE ===
  'body-1': {
    id: 'body-1',
    moduleId: 'body',
    title: 'Muscle Basics',
    description: 'The building blocks of movement',
    order: 1,
    icon: 'dumbbell',
  },
  'body-2': {
    id: 'body-2',
    moduleId: 'body',
    title: 'The Core Foundation',
    description: 'Your center of power',
    order: 2,
    icon: 'circle-dot',
  },
  'body-3': {
    id: 'body-3',
    moduleId: 'body',
    title: 'The Kinetic Chain',
    description: 'How muscles work together',
    order: 3,
    icon: 'link',
  },
  'body-4': {
    id: 'body-4',
    moduleId: 'body',
    title: 'Posture & Form',
    description: 'Moving with intention',
    order: 4,
    icon: 'user',
  },
  'body-5': {
    id: 'body-5',
    moduleId: 'body',
    title: 'Training Smart',
    description: 'Principles that work',
    order: 5,
    icon: 'trending-up',
  },

  // === FUEL MODULE ===
  'fuel-1': {
    id: 'fuel-1',
    moduleId: 'fuel',
    title: 'Energy Fundamentals',
    description: 'What powers your body',
    order: 1,
    icon: 'zap',
  },
  'fuel-2': {
    id: 'fuel-2',
    moduleId: 'fuel',
    title: 'Macronutrients',
    description: 'Protein, carbs, and fats',
    order: 2,
    icon: 'pie-chart',
  },
  'fuel-3': {
    id: 'fuel-3',
    moduleId: 'fuel',
    title: 'Micronutrients',
    description: 'The hidden essentials',
    order: 3,
    icon: 'sparkles',
  },
  'fuel-4': {
    id: 'fuel-4',
    moduleId: 'fuel',
    title: 'Meal Timing',
    description: 'When you eat matters',
    order: 4,
    icon: 'clock',
  },
  'fuel-5': {
    id: 'fuel-5',
    moduleId: 'fuel',
    title: 'Fueling for Goals',
    description: 'Eating with purpose',
    order: 5,
    icon: 'target',
  },

  // === MIND MODULE ===
  'mind-1': {
    id: 'mind-1',
    moduleId: 'mind',
    title: 'The Prediction Machine',
    description: 'Your brain constructs reality',
    order: 1,
    icon: 'cpu',
  },
  'mind-2': {
    id: 'mind-2',
    moduleId: 'mind',
    title: 'Body Budgeting',
    description: 'Allostasis and energy management',
    order: 2,
    icon: 'wallet',
  },
  'mind-3': {
    id: 'mind-3',
    moduleId: 'mind',
    title: 'Experience Shapes Reality',
    description: 'Your past creates your present',
    order: 3,
    icon: 'history',
  },
  'mind-4': {
    id: 'mind-4',
    moduleId: 'mind',
    title: 'Training the Predictive Brain',
    description: 'Why consistency transforms',
    order: 4,
    icon: 'refresh-cw',
  },
  'mind-5': {
    id: 'mind-5',
    moduleId: 'mind',
    title: 'Becoming Your Future Self',
    description: 'Identity and lasting change',
    order: 5,
    icon: 'sunrise',
  },

  // === LONGEVITY MODULE ===
  'longevity-1': {
    id: 'longevity-1',
    moduleId: 'longevity',
    title: 'The Science of Aging',
    description: 'Why we age and what we can do about it',
    order: 1,
    icon: 'hourglass',
  },
  'longevity-2': {
    id: 'longevity-2',
    moduleId: 'longevity',
    title: 'Metabolic Health',
    description: 'Blood sugar, insulin, and disease risk',
    order: 2,
    icon: 'activity',
  },
  'longevity-3': {
    id: 'longevity-3',
    moduleId: 'longevity',
    title: 'Chronic Disease Prevention',
    description: 'The big killers and how to avoid them',
    order: 3,
    icon: 'shield',
  },
  'longevity-4': {
    id: 'longevity-4',
    moduleId: 'longevity',
    title: 'Cellular Health & Repair',
    description: 'Autophagy, mitochondria, and regeneration',
    order: 4,
    icon: 'refresh-cw',
  },
  'longevity-5': {
    id: 'longevity-5',
    moduleId: 'longevity',
    title: 'Lifestyle Medicine',
    description: 'Sleep, stress, and the pillars of longevity',
    order: 5,
    icon: 'sun',
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get all units for a module, sorted by order
 */
export const getUnitsForModule = (moduleId) => {
  return Object.values(UNITS)
    .filter(unit => unit.moduleId === moduleId)
    .sort((a, b) => a.order - b.order);
};

/**
 * Get all modules sorted by order
 */
export const getModulesSorted = () => {
  return Object.values(MODULES).sort((a, b) => a.order - b.order);
};

/**
 * Calculate total XP possible from learning
 * 100 lessons × 1 XP = 100
 * 20 units × 2 XP = 40
 * 4 modules × 5 XP = 20
 * Total: 160 XP
 */
export const TOTAL_LEARNING_XP = 160;

/**
 * Check if user can do more lessons today
 */
export const canDoMoreLessonsToday = (lessonsCompletedToday) => {
  return lessonsCompletedToday < LEARNING_XP.DAILY_LESSON_LIMIT;
};

/**
 * Get remaining lessons for today
 */
export const getRemainingLessonsToday = (lessonsCompletedToday) => {
  return Math.max(0, LEARNING_XP.DAILY_LESSON_LIMIT - lessonsCompletedToday);
};

export default {
  LEARNING_XP,
  GAME_TYPES,
  MODULES,
  UNITS,
  getUnitsForModule,
  getModulesSorted,
  TOTAL_LEARNING_XP,
  canDoMoreLessonsToday,
  getRemainingLessonsToday,
};
