/**
 * Points System Configuration
 * Central config for points economy, streaks, and milestones
 */

// Points Economy Configuration
export const POINTS_CONFIG = {
  // === EARNING ===
  POINTS_PER_MEAL: 1,           // 1 point per verified meal photo
  POINTS_PER_WORKOUT: 1,        // 1 point per verified workout log
  POINTS_PER_WORKOUT_STORY: 2,  // 2 points for sharing workout feed post (encourages social sharing)
  POINTS_PER_WORKOUT_FEED_SHARE: 15, // 15 points for the first workout video shared to Feed each day
  POINTS_PER_ACTIVITY_FEED_SHARE: 15, // 15 points for sharing a tracked walk/run/activity to Feed
  POINTS_PER_SOCIAL_SHARE: 15, // 15 points for each eligible Balance Feed or Instagram Feed share
  POINTS_PER_MILESTONE_FEED_SHARE: 10, // 10 points for sharing selected milestone celebration cards
  POINTS_PER_EXERCISE_CONTRIBUTION: 15, // 15 points for adding a video-backed exercise to the shared library
  POINTS_PER_FEED_CHECKIN: 2,   // 2 points for one regular Feed check-in post per day
  POINTS_PER_FEED_COMMENT: 2,   // 2 points for one comment turn on another user's Feed post
  POINTS_PER_MEAL_FEED_SHARE: 15, // 15 points for one logged meal Feed share per day
  POINTS_PER_PROGRESS_PHOTO: 10, // 10 points for a weekly progress photo
  POINTS_PER_PROGRESS_PHOTO_SHARE: 20, // 20 extra points for sharing weekly progress photos to Feed
  POINTS_PER_DAILY_LOG: 2,      // 2 points for logging all meals and hitting within 20% of cal/macro goals
  POINTS_PER_WALKTHROUGH_CHECKPOINT: 1, // 1 XP at selected walkthrough checkpoints only
  WALKTHROUGH_LEVEL_4_LIFETIME_XP: 12, // Level 4 requires 12 lifetime XP on the current curve
  POINTS_PER_WEEKLY_GOAL: 10,   // 10 XP per completed weekly goal, paid in Weekly Wrapped
  WEEKLY_GOALS_ALL_HIT_BONUS: 20, // 20 XP bonus for hitting 3/3 weekly goals
  WEEKLY_GOALS_MAX_POINTS: 50,  // Weekly goals cap at 50 XP
  DAILY_QUIZ_BONUS: 0,          // Daily quizzes use their module's perfect-quiz reward
  POINTS_PER_MEAL_TIMING: 1,    // 1 bonus point for logging a meal within 30 minutes of scheduled time
  MEAL_TIMING_WINDOW_MINUTES: 30, // Window in minutes for on-time meal bonus
  // Note: Daily weigh-in awards 1 XP directly (not points)

  // === REDEMPTION ===
  POINTS_FOR_FREE_WEEK: 200,    // 200 posts = 1 free week
  FREE_DAYS_PER_REDEMPTION: 7,  // 7 days per redemption

  // === STREAK BONUSES ===
  STREAK_BONUSES: [
    { days: 7, points: 5, label: '7-day streak!' },
    { days: 14, points: 10, label: '2-week streak!' },
    { days: 30, points: 25, label: '30-day streak!' },
    { days: 60, points: 50, label: '60-day streak!' },
    { days: 100, points: 100, label: '100-day streak!' },
  ],

  // === MEAL MILESTONES ===
  MEAL_MILESTONES: [
    { count: 1, type: 'first_meal', points: 5, label: 'First Meal Tracked!' },
    { count: 10, type: '10_meals', points: 10, label: '10 Meals Tracked!' },
    { count: 50, type: '50_meals', points: 25, label: '50 Meals Tracked!' },
    { count: 100, type: '100_meals', points: 50, label: '100 Meals - Centurion!' },
    { count: 365, type: '365_meals', points: 100, label: '365 Meals - One Year!' },
  ],

  // === WORKOUT MILESTONES (points additions to existing system) ===
  WORKOUT_POINT_MILESTONES: [
    { count: 1, type: 'first_workout_points', points: 5, label: 'First Workout Logged!' },
    { count: 50, type: '50_workouts_points', points: 25, label: '50 Workouts!' },
    { count: 100, type: '100_workouts_points', points: 50, label: '100 Workouts!' },
    { count: 365, type: '365_workouts_points', points: 100, label: '365 Workouts - One Year!' },
  ],

  // === STREAK MILESTONES ===
  STREAK_MILESTONES: [
    { days: 7, type: 'streak_7', points: 10, label: '7-Day Streak!' },
    { days: 14, type: 'streak_14', points: 20, label: '2-Week Streak!' },
    { days: 30, type: 'streak_30', points: 50, label: 'Monthly Warrior!' },
    { days: 60, type: 'streak_60', points: 75, label: '60-Day Champion!' },
    { days: 100, type: 'streak_100', points: 150, label: '100-Day Legend!' },
  ],

  // === FEED POST MILESTONES ===
  STORY_MILESTONES: [
    { count: 1, type: 'first_story', points: 5, label: 'First Feed Post!' },
    { count: 10, type: '10_stories', points: 15, label: '10 Feed Posts!' },
    { count: 50, type: '50_stories', points: 50, label: '50 Posts - Social Star!' },
    { count: 100, type: '100_stories', points: 100, label: '100 Posts - Influencer!' },
  ],

  // === WEIGH-IN MILESTONES ===
  WEIGH_IN_MILESTONES: [
    { count: 1, type: 'first_weigh_in', points: 5, label: 'First Weigh-In!' },
    { count: 7, type: '7_weigh_ins', points: 10, label: '7-Day Tracking!' },
    { count: 30, type: '30_weigh_ins', points: 25, label: '30-Day Commitment!' },
    { count: 100, type: '100_weigh_ins', points: 50, label: '100 Weigh-Ins!' },
  ],

  // === ANTI-CHEAT ===
  MAX_PHOTO_AGE_MINUTES: 5,     // Photo must be taken within 5 minutes
  MIN_AI_CONFIDENCE: 'medium', // Reject 'low' confidence analyses
  REQUIRE_UNIQUE_PHOTOS: true, // Reject duplicate photo hashes

  // === DAILY LIMITS (reasonable maximums) ===
  MAX_MEALS_PER_DAY: 10,        // breakfast, lunch, dinner, snacks
  MAX_WORKOUTS_PER_DAY: 3,      // reasonable max
};

/**
 * Calculate dollar value of points
 * $29.99/week starter coaching
 * 200 points = 1 week = $29.99
 * 1 point = ~$0.15 value
 */
export const calculatePointsValue = (points) => {
  const DOLLAR_VALUE_PER_POINT = 29.99 / POINTS_CONFIG.POINTS_FOR_FREE_WEEK;
  return (points * DOLLAR_VALUE_PER_POINT).toFixed(2);
};

/**
 * Calculate progress percentage toward free week
 */
export const calculateProgressPercent = (currentPoints) => {
  return Math.min(100, (currentPoints / POINTS_CONFIG.POINTS_FOR_FREE_WEEK) * 100);
};

/**
 * Check if user can redeem points
 */
export const canRedeem = (currentPoints) => {
  return currentPoints >= POINTS_CONFIG.POINTS_FOR_FREE_WEEK;
};

/**
 * Get streak bonus for a given streak length
 * Returns { points, label } or null if no bonus
 */
export const getStreakBonus = (streakDays) => {
  const bonus = POINTS_CONFIG.STREAK_BONUSES.find(b => b.days === streakDays);
  return bonus ? { points: bonus.points, label: bonus.label } : null;
};

/**
 * Get meal milestone for a given count
 * Returns milestone object or null
 */
export const getMealMilestone = (mealCount) => {
  return POINTS_CONFIG.MEAL_MILESTONES.find(m => m.count === mealCount) || null;
};

/**
 * Get workout milestone for a given count
 * Returns milestone object or null
 */
export const getWorkoutMilestone = (workoutCount) => {
  return POINTS_CONFIG.WORKOUT_POINT_MILESTONES.find(m => m.count === workoutCount) || null;
};

/**
 * Format points display with comma separators
 */
export const formatPoints = (points) => {
  return points.toLocaleString();
};

/**
 * Get motivational message based on progress
 */
export const getProgressMessage = (currentPoints) => {
  const remaining = POINTS_CONFIG.POINTS_FOR_FREE_WEEK - currentPoints;
  const percent = calculateProgressPercent(currentPoints);

  if (percent >= 100) {
    return 'You can redeem a free week!';
  } else if (percent >= 75) {
    return `Almost there! ${remaining} more to go`;
  } else if (percent >= 50) {
    return `Halfway! ${remaining} points to free week`;
  } else if (percent >= 25) {
    return `Great progress! ${remaining} to go`;
  } else {
    return `${remaining} points to free week`;
  }
};

// ============================================================
// LEVELING SYSTEM
// Levels continue indefinitely on an accelerating XP curve.
// ============================================================

export const LEVEL_CONFIG = {
  // XP curve mirrors database/leveling_system_migration.sql and profile display.
  // points = 0.07 * level^2.4 + 0.7 * level
  // - Level 10: ~24 points
  // - Level 20: ~106 points
  // - Level 30: ~266 points
  // - Level 50: ~871 points
  // - Level 75: ~2266 points
  // - Level 99: ~4380 points
  CURVE_MULTIPLIER: 0.07,
  CURVE_EXPONENT: 2.4,
  LINEAR_BONUS: 0.7,
};

/**
 * Calculate the lifetime points required to reach a given level
 * Uses formula: points = 0.07 * level^2.4 + 0.7 * level (level 1 = 0 points)
 */
export const getPointsForLevel = (level) => {
  if (level <= 1) return 0;
  return Math.floor(
    LEVEL_CONFIG.CURVE_MULTIPLIER * Math.pow(level, LEVEL_CONFIG.CURVE_EXPONENT)
    + LEVEL_CONFIG.LINEAR_BONUS * level
  );
};

/**
 * Calculate user's current level from their lifetime points
 * Returns { level, currentLevelPoints, nextLevelPoints, progress }
 */
export const calculateLevel = (lifetimePoints) => {
  const parsedLifetimePoints = Number(lifetimePoints);
  const safeLifetimePoints = Number.isFinite(parsedLifetimePoints)
    ? Math.max(0, parsedLifetimePoints)
    : 0;
  let level = 1;

  // Find the highest level the user has reached
  while (true) {
    const pointsNeeded = getPointsForLevel(level + 1);
    if (safeLifetimePoints < pointsNeeded) {
      break;
    }
    level++;
  }

  const currentLevelPoints = getPointsForLevel(level);
  const nextLevelPoints = getPointsForLevel(level + 1);

  // Calculate progress to next level (0-100%)
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
    isMaxLevel: false,
  };
};

/**
 * Get level title/rank based on level ranges
 */
export const getLevelTitle = (level) => {
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
};

/**
 * Check if user leveled up from previous points to new points
 * Returns new level if leveled up, null otherwise
 */
export const checkLevelUp = (previousLifetimePoints, newLifetimePoints) => {
  const previousLevel = calculateLevel(previousLifetimePoints).level;
  const newLevel = calculateLevel(newLifetimePoints).level;

  if (newLevel > previousLevel) {
    return {
      previousLevel,
      newLevel,
      title: getLevelTitle(newLevel),
    };
  }
  return null;
};

// Default export for convenience
export default POINTS_CONFIG;
