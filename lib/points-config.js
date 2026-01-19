/**
 * Points System Configuration
 * Central config for points economy, streaks, and milestones
 */

// Points Economy Configuration
export const POINTS_CONFIG = {
  // === EARNING ===
  POINTS_PER_MEAL: 1,           // 1 point per verified meal photo
  POINTS_PER_WORKOUT: 1,        // 1 point per verified workout log

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
 * $30/month = ~$7/week
 * 200 points = 1 week = $7
 * 1 point = $0.035 value
 */
export const calculatePointsValue = (points) => {
  const DOLLAR_VALUE_PER_POINT = 7 / POINTS_CONFIG.POINTS_FOR_FREE_WEEK;
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

// Default export for convenience
export default POINTS_CONFIG;
