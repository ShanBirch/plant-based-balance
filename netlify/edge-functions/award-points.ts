/**
 * Netlify Edge Function: Award Points
 * Awards points for verified meal/workout submissions
 * Includes anti-cheat validation and streak/milestone tracking
 */

import type { Context } from "https://edge.netlify.com";
import { createClient } from '@supabase/supabase-js';

// Points configuration (keep in sync with lib/points-config.js)
const POINTS_CONFIG = {
  POINTS_PER_MEAL: 1,
  POINTS_PER_WORKOUT: 1,
  POINTS_PER_PERSONAL_BEST: 1,
  POINTS_PER_DAILY_LOG: 2,
  POINTS_PER_MEAL_TIMING: 1,    // 1 bonus point for logging a meal within 30 minutes of scheduled time
  MEAL_TIMING_WINDOW_MINUTES: 30,
  DAILY_LOG_TOLERANCE: 0.20,  // 20% tolerance for hitting macro/calorie goals
  MAX_PHOTO_AGE_MINUTES: 5,
  STREAK_BONUSES: [
    { days: 7, points: 5, label: '7-day streak!' },
    { days: 14, points: 10, label: '2-week streak!' },
    { days: 30, points: 25, label: '30-day streak!' },
    { days: 60, points: 50, label: '60-day streak!' },
    { days: 100, points: 100, label: '100-day streak!' },
  ],
  MEAL_MILESTONES: [
    { count: 1, type: 'first_meal', points: 5, label: 'First Meal Tracked!' },
    { count: 10, type: '10_meals', points: 10, label: '10 Meals Tracked!' },
    { count: 50, type: '50_meals', points: 25, label: '50 Meals Tracked!' },
    { count: 100, type: '100_meals', points: 50, label: '100 Meals - Centurion!' },
    { count: 365, type: '365_meals', points: 100, label: '365 Meals - One Year!' },
  ],
  WORKOUT_MILESTONES: [
    { count: 1, type: 'first_workout_points', points: 5, label: 'First Workout Logged!' },
    { count: 50, type: '50_workouts_points', points: 25, label: '50 Workouts!' },
    { count: 100, type: '100_workouts_points', points: 50, label: '100 Workouts!' },
    { count: 365, type: '365_workouts_points', points: 100, label: '365 Workouts - One Year!' },
  ],
  POINTS_FOR_FREE_WEEK: 200,
};

interface AwardPointsRequest {
  userId: string;
  type: 'meal' | 'workout' | 'personal_best' | 'daily_log';
  referenceId: string;
  photoTimestamp?: string;  // ISO timestamp from EXIF or file
  aiConfidence?: string;    // 'high', 'medium', 'low'
  photoHash?: string;       // SHA-256 hash for duplicate detection
  exercise?: string;        // For personal_best: exercise name
  pbType?: string;          // For personal_best: 'weight' or 'reps'
  value?: number;           // For personal_best: the new PB value
  improvement?: number;     // For personal_best: improvement amount
  mealTime?: string;        // For meal: HH:MM:SS format for timing bonus check
  nutritionDate?: string;   // For daily_log: the date being logged (YYYY-MM-DD)
  finishDay?: boolean;      // For daily_log: mark day complete without requiring goals met
  clientDate?: string;      // Client's local date (YYYY-MM-DD) for timezone-correct streak logic
}

interface PointsResult {
  success: boolean;
  pointsAwarded: number;
  basePoints: number;
  xpMultiplier: number;
  doubleXpActive: boolean;
  bonusPoints: number;
  bonusDescription: string | null;
  newTotal: number;
  currentStreak: number;
  mealTimingBonus: number;
  mealOnTime: boolean;
  milestonesUnlocked: Array<{ type: string; label: string; points: number }>;
  canRedeem: boolean;
  error?: string;
  reason?: string;
}

/**
 * Convert a time string (HH:MM:SS or HH:MM) to minutes since midnight
 */
function timeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

export default async (request: Request, context: Context): Promise<Response> => {
  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers
    });
  }

  try {
    const body: AwardPointsRequest = await request.json();
    const { userId, type, referenceId, photoTimestamp, aiConfidence, photoHash } = body;

    // Validate required fields
    if (!userId || !type || !referenceId) {
      return new Response(JSON.stringify({
        error: 'Missing required fields',
        required: ['userId', 'type', 'referenceId']
      }), {
        status: 400,
        headers
      });
    }

    if (type !== 'meal' && type !== 'workout' && type !== 'personal_best' && type !== 'daily_log') {
      return new Response(JSON.stringify({
        error: 'Invalid type',
        message: 'Type must be "meal", "workout", "personal_best", or "daily_log"'
      }), {
        status: 400,
        headers
      });
    }

    // Personal bests and daily logs don't require photo verification
    const skipPhotoValidation = type === 'personal_best' || type === 'daily_log';

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // === ANTI-CHEAT CHECKS (skip for personal_best which is data-verified) ===

    // 1. Check AI confidence (reject low confidence)
    if (!skipPhotoValidation && aiConfidence === 'low') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Photo verification failed',
        reason: 'AI could not verify this is a valid meal/workout photo. Try a clearer photo.',
        pointsAwarded: 0
      }), {
        status: 200, // Return 200 so client can handle gracefully
        headers
      });
    }

    // 2. Check photo timestamp (must be recent)
    if (!skipPhotoValidation && photoTimestamp) {
      const photoTime = new Date(photoTimestamp).getTime();
      const now = Date.now();
      const ageMinutes = (now - photoTime) / (1000 * 60);

      if (ageMinutes > POINTS_CONFIG.MAX_PHOTO_AGE_MINUTES) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Photo too old',
          reason: `Photos must be taken within ${POINTS_CONFIG.MAX_PHOTO_AGE_MINUTES} minutes. Please take a fresh photo.`,
          pointsAwarded: 0
        }), {
          status: 200,
          headers
        });
      }

      // Check for future timestamps (suspicious)
      if (photoTime > now + 60000) { // More than 1 minute in future
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid photo timestamp',
          reason: 'Photo timestamp appears invalid. Please try again.',
          pointsAwarded: 0
        }), {
          status: 200,
          headers
        });
      }
    }

    // 3. Check for duplicate photos
    if (!skipPhotoValidation && photoHash) {
      const { data: existingHash } = await supabase
        .from('photo_hashes')
        .select('id')
        .eq('user_id', userId)
        .eq('photo_hash', photoHash)
        .single();

      if (existingHash) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Duplicate photo',
          reason: 'This photo has already been used for points. Take a new photo!',
          pointsAwarded: 0
        }), {
          status: 200,
          headers
        });
      }

      // Store hash for future duplicate checks
      await supabase.from('photo_hashes').insert({
        user_id: userId,
        photo_hash: photoHash,
        photo_type: type,
        reference_id: referenceId
      });
    }

    // === DAILY LOG VALIDATION ===
    if (type === 'daily_log') {
      const nutritionDate = body.nutritionDate || body.clientDate || new Date().toISOString().split('T')[0];
      const finishDay = body.finishDay || false;

      // Check if day already completed (either via bonus claim or finish-day)
      const { data: dailyNutritionCheck } = await supabase
        .from('daily_nutrition')
        .select('day_completed')
        .eq('user_id', userId)
        .eq('nutrition_date', nutritionDate)
        .single();

      if (dailyNutritionCheck?.day_completed) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Already claimed',
          reason: 'You already completed your nutrition tracking for today!',
          pointsAwarded: 0
        }), {
          status: 200,
          headers
        });
      }

      // Also check point_transactions for existing bonus claim
      const { data: existingClaim } = await supabase
        .from('point_transactions')
        .select('id')
        .eq('user_id', userId)
        .eq('transaction_type', 'earn_daily_log')
        .gte('created_at', nutritionDate + 'T00:00:00')
        .lte('created_at', nutritionDate + 'T23:59:59')
        .limit(1)
        .maybeSingle();

      if (existingClaim) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Already claimed',
          reason: 'You already earned your daily nutrition bonus today!',
          pointsAwarded: 0
        }), {
          status: 200,
          headers
        });
      }

      // Verify nutrition data from daily_nutrition table
      const { data: dailyNutrition } = await supabase
        .from('daily_nutrition')
        .select('total_calories, total_protein_g, total_carbs_g, total_fat_g, calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g, meal_count')
        .eq('user_id', userId)
        .eq('nutrition_date', nutritionDate)
        .single();

      if (!dailyNutrition || !dailyNutrition.meal_count || dailyNutrition.meal_count < 1) {
        return new Response(JSON.stringify({
          success: false,
          error: 'No meals logged',
          reason: 'Log at least one meal before completing your nutrition day.',
          pointsAwarded: 0
        }), {
          status: 200,
          headers
        });
      }

      // Check if within 20% tolerance for calories and macros
      const tolerance = POINTS_CONFIG.DAILY_LOG_TOLERANCE;
      const checks = [
        { name: 'Calories', actual: dailyNutrition.total_calories || 0, goal: dailyNutrition.calorie_goal || 0 },
        { name: 'Protein', actual: dailyNutrition.total_protein_g || 0, goal: dailyNutrition.protein_goal_g || 0 },
        { name: 'Carbs', actual: dailyNutrition.total_carbs_g || 0, goal: dailyNutrition.carbs_goal_g || 0 },
        { name: 'Fat', actual: dailyNutrition.total_fat_g || 0, goal: dailyNutrition.fat_goal_g || 0 },
      ];

      const failedChecks: string[] = [];
      for (const check of checks) {
        if (check.goal <= 0) continue; // Skip if no goal set
        const lower = check.goal * (1 - tolerance);
        const upper = check.goal * (1 + tolerance);
        if (check.actual < lower || check.actual > upper) {
          failedChecks.push(check.name);
        }
      }

      if (failedChecks.length > 0) {
        if (finishDay) {
          // User chose to finish their day without hitting goals - mark complete but no points
          await supabase
            .from('daily_nutrition')
            .update({
              day_completed: true,
              day_completed_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .eq('nutrition_date', nutritionDate);

          return new Response(JSON.stringify({
            success: true,
            dayCompleted: true,
            goalsMetBonus: false,
            pointsAwarded: 0,
            basePoints: 0,
            xpMultiplier: 1,
            doubleXpActive: false,
            bonusPoints: 0,
            bonusDescription: null,
            newTotal: 0,
            currentStreak: 0,
            milestonesUnlocked: [],
            canRedeem: false,
            failedChecks,
            reason: `Day completed! Macros weren't within 20% for: ${failedChecks.join(', ')} — no bonus points, but your meals are tracked.`
          }), {
            status: 200,
            headers
          });
        }

        return new Response(JSON.stringify({
          success: false,
          error: 'Goals not met',
          reason: `Not within 20% of your goals for: ${failedChecks.join(', ')}. You can still finish your day without the bonus.`,
          failedChecks,
          pointsAwarded: 0
        }), {
          status: 200,
          headers
        });
      }

      // Goals met - mark day as completed (points will be awarded below)
      await supabase
        .from('daily_nutrition')
        .update({
          day_completed: true,
          day_completed_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('nutrition_date', nutritionDate);
    }

    // === CHECK FOR DOUBLE XP ===
    // Fetch user's double XP status
    const { data: userData } = await supabase
      .from('users')
      .select('double_xp_until')
      .eq('id', userId)
      .single();

    const now = new Date();
    const hasDoubleXp = userData?.double_xp_until && new Date(userData.double_xp_until) > now;
    const xpMultiplier = hasDoubleXp ? 2 : 1;

    // === AWARD POINTS ===
    let basePoints: number;
    if (type === 'meal') {
      basePoints = POINTS_CONFIG.POINTS_PER_MEAL;
    } else if (type === 'workout') {
      basePoints = POINTS_CONFIG.POINTS_PER_WORKOUT;
    } else if (type === 'daily_log') {
      basePoints = POINTS_CONFIG.POINTS_PER_DAILY_LOG;
    } else {
      basePoints = POINTS_CONFIG.POINTS_PER_PERSONAL_BEST;
    }

    // Apply double XP multiplier
    const pointsToAward = basePoints * xpMultiplier;

    // Get current points record
    const { data: userPoints, error: fetchError } = await supabase
      .from('user_points')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine for new users
      console.error('Error fetching user points:', fetchError);
    }

    // Calculate dates for streak (prefer client's local date for timezone correctness)
    const today = (body.clientDate && /^\d{4}-\d{2}-\d{2}$/.test(body.clientDate))
      ? body.clientDate
      : new Date().toISOString().split('T')[0];
    const todayDate = new Date(today + 'T00:00:00');
    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().split('T')[0];
    const lastPostDate = userPoints?.last_post_date;

    // Calculate streak
    let newStreak = 1;
    if (lastPostDate === yesterday) {
      // Continue streak
      newStreak = (userPoints?.current_streak || 0) + 1;
    } else if (lastPostDate === today) {
      // Already posted today, keep current streak
      newStreak = userPoints?.current_streak || 1;
    }
    // Otherwise, streak resets to 1

    // Check for streak bonus - only award when streak actually incremented (first post of a new day)
    // Without this guard, the bonus is awarded on every post made on the milestone day
    let bonusPoints = 0;
    let bonusDescription = '';

    const streakJustIncremented = lastPostDate === yesterday;
    if (streakJustIncremented) {
      const streakBonus = POINTS_CONFIG.STREAK_BONUSES.find(b => b.days === newStreak);
      if (streakBonus) {
        bonusPoints = streakBonus.points;
        bonusDescription = streakBonus.label;
      }
    }

    // === MEAL TIMING BONUS ===
    // Check if meal was logged within 30 minutes of the user's scheduled meal time
    let mealTimingBonus = 0;
    let mealOnTime = false;

    if (type === 'meal' && body.mealTime) {
      try {
        // Get user's meal schedule from meal_reminder_preferences
        const { data: mealPrefs } = await supabase
          .from('meal_reminder_preferences')
          .select('breakfast_time, lunch_time, dinner_time')
          .eq('user_id', userId)
          .maybeSingle();

        if (mealPrefs) {
          // Determine which scheduled time to compare against based on meal time
          const mealTimeStr = body.mealTime; // HH:MM:SS or HH:MM format
          const mealMinutes = timeToMinutes(mealTimeStr);

          // Determine meal type from time and get corresponding schedule
          let scheduledTimeStr: string | null = null;
          if (mealMinutes < 660) { // Before 11:00 = breakfast
            scheduledTimeStr = mealPrefs.breakfast_time;
          } else if (mealMinutes < 900) { // Before 15:00 = lunch
            scheduledTimeStr = mealPrefs.lunch_time;
          } else { // 15:00+ = dinner
            scheduledTimeStr = mealPrefs.dinner_time;
          }

          if (scheduledTimeStr) {
            const scheduledMinutes = timeToMinutes(scheduledTimeStr);
            const diff = Math.abs(mealMinutes - scheduledMinutes);

            if (diff <= POINTS_CONFIG.MEAL_TIMING_WINDOW_MINUTES) {
              mealTimingBonus = POINTS_CONFIG.POINTS_PER_MEAL_TIMING * xpMultiplier;
              mealOnTime = true;
              console.log(`Meal timing bonus! Meal at ${mealTimeStr}, scheduled ${scheduledTimeStr}, diff ${diff}min`);
            }
          }
        }
      } catch (timingError) {
        console.error('Error checking meal timing:', timingError);
        // Non-fatal: don't block points for timing check failure
      }
    }

    // Calculate new totals
    const totalPointsEarned = pointsToAward + bonusPoints + mealTimingBonus;
    const newCurrentPoints = (userPoints?.current_points || 0) + totalPointsEarned;
    const newLifetimePoints = (userPoints?.lifetime_points || 0) + totalPointsEarned;

    // Prepare update data
    const updateData: Record<string, unknown> = {
      current_points: newCurrentPoints,
      lifetime_points: newLifetimePoints,
      current_streak: newStreak,
      longest_streak: Math.max(userPoints?.longest_streak || 0, newStreak),
      last_post_date: today,
      updated_at: new Date().toISOString(),
    };

    // Update type-specific counters
    if (type === 'meal') {
      const newMealCount = (userPoints?.total_meals_logged || 0) + 1;
      updateData.total_meals_logged = newMealCount;
      updateData.last_meal_date = today;

      // Update meal streak
      if (userPoints?.last_meal_date === yesterday) {
        updateData.meal_streak = (userPoints?.meal_streak || 0) + 1;
      } else if (userPoints?.last_meal_date !== today) {
        updateData.meal_streak = 1;
      }
      updateData.longest_meal_streak = Math.max(
        userPoints?.longest_meal_streak || 0,
        updateData.meal_streak as number
      );
    } else if (type === 'workout') {
      const newWorkoutCount = (userPoints?.total_workouts_logged || 0) + 1;
      updateData.total_workouts_logged = newWorkoutCount;
      updateData.last_workout_date = today;

      // Update workout streak
      if (userPoints?.last_workout_date === yesterday) {
        updateData.workout_streak = (userPoints?.workout_streak || 0) + 1;
      } else if (userPoints?.last_workout_date !== today) {
        updateData.workout_streak = 1;
      }
      updateData.longest_workout_streak = Math.max(
        userPoints?.longest_workout_streak || 0,
        updateData.workout_streak as number
      );
    }
    // personal_best and daily_log types don't update specific counters - just award points

    // Upsert points record
    const { error: updateError } = await supabase
      .from('user_points')
      .upsert({
        user_id: userId,
        ...updateData
      }, {
        onConflict: 'user_id'
      });

    if (updateError) {
      console.error('Error updating user points:', updateError);
      throw updateError;
    }

    // Log main transaction
    const transactionTypeMap: Record<string, string> = {
      meal: 'earn_meal',
      workout: 'earn_workout',
      personal_best: 'earn_personal_best',
      daily_log: 'earn_daily_log',
    };
    const referenceTypeMap: Record<string, string> = {
      meal: 'meal_log',
      workout: 'workout',
      personal_best: 'personal_best',
      daily_log: 'daily_nutrition',
    };
    const transactionType = transactionTypeMap[type];
    const referenceType = referenceTypeMap[type];
    const description = type === 'daily_log'
      ? `Earned ${pointsToAward} points for hitting daily nutrition goals`
      : type === 'personal_best'
        ? `Earned ${pointsToAward} point for personal best`
        : `Earned ${pointsToAward} point for ${type}`;

    await supabase.from('point_transactions').insert({
      user_id: userId,
      transaction_type: transactionType,
      points_amount: pointsToAward,
      reference_id: referenceId,
      reference_type: referenceType,
      photo_verified: type === 'meal' || type === 'workout',
      photo_timestamp: photoTimestamp || null,
      verification_method: (type === 'personal_best' || type === 'daily_log') ? 'data_verified' : (photoHash ? 'hash_verified' : (photoTimestamp ? 'timestamp_verified' : 'none')),
      ai_confidence: aiConfidence || null,
      description: description
    });

    // Log bonus transaction if applicable
    if (bonusPoints > 0) {
      await supabase.from('point_transactions').insert({
        user_id: userId,
        transaction_type: 'bonus_streak',
        points_amount: bonusPoints,
        reference_type: 'streak',
        description: bonusDescription
      });
    }

    // Log meal timing bonus transaction if applicable
    if (mealTimingBonus > 0) {
      await supabase.from('point_transactions').insert({
        user_id: userId,
        transaction_type: 'bonus_meal_timing',
        points_amount: mealTimingBonus,
        reference_id: referenceId,
        reference_type: 'meal_log',
        description: `Earned ${mealTimingBonus} bonus point for eating on schedule`
      });
    }

    // Update challenge points for any active challenges
    await supabase.rpc('update_challenge_participant_points', {
      user_uuid: userId
    });

    // Check for milestones (not applicable for personal_best)
    const milestones: Array<{ type: string; label: string; points: number }> = [];

    // Only check meal/workout milestones (personal_best doesn't have count-based milestones)
    if (type === 'meal' || type === 'workout') {
      const totalCount = type === 'meal'
        ? updateData.total_meals_logged as number
        : updateData.total_workouts_logged as number;

      const milestonesToCheck = type === 'meal'
        ? POINTS_CONFIG.MEAL_MILESTONES
        : POINTS_CONFIG.WORKOUT_MILESTONES;

      for (const milestone of milestonesToCheck) {
        if (totalCount === milestone.count) {
          // Check if already achieved
          const { data: existing } = await supabase
            .from('meal_milestones')
            .select('id')
            .eq('user_id', userId)
            .eq('milestone_type', milestone.type)
            .single();

          if (!existing) {
            // Record milestone
            await supabase.from('meal_milestones').insert({
              user_id: userId,
              milestone_type: milestone.type,
              milestone_value: milestone.count,
              points_awarded: milestone.points,
              achievement_data: { type, count: totalCount }
            });

            // Award milestone bonus points
            await supabase.rpc('increment_user_points', {
              p_user_id: userId,
              p_amount: milestone.points
            });

            // Log milestone transaction
            await supabase.from('point_transactions').insert({
              user_id: userId,
              transaction_type: 'bonus_milestone',
              points_amount: milestone.points,
              reference_type: 'milestone',
              description: milestone.label
            });

            milestones.push({
              type: milestone.type,
              label: milestone.label,
              points: milestone.points
            });
          }
        }
      }
    } // End of meal/workout milestone check

    // If any milestones were unlocked, update challenge points again
    if (milestones.length > 0) {
      await supabase.rpc('update_challenge_participant_points', {
        user_uuid: userId
      });
    }

    // Calculate final total (including any milestone bonuses)
    const milestoneBonus = milestones.reduce((sum, m) => sum + m.points, 0);
    const finalTotal = newCurrentPoints + milestoneBonus;

    const result: PointsResult = {
      success: true,
      pointsAwarded: pointsToAward + mealTimingBonus,
      basePoints: basePoints,
      xpMultiplier: xpMultiplier,
      doubleXpActive: hasDoubleXp,
      bonusPoints: bonusPoints + milestoneBonus + mealTimingBonus,
      bonusDescription: mealOnTime
        ? (bonusDescription ? bonusDescription + ' + On-time meal!' : 'On-time meal bonus!')
        : (bonusDescription || (milestones.length > 0 ? milestones[0].label : null)),
      mealTimingBonus: mealTimingBonus,
      mealOnTime: mealOnTime,
      newTotal: finalTotal,
      currentStreak: newStreak,
      milestonesUnlocked: milestones,
      canRedeem: finalTotal >= POINTS_CONFIG.POINTS_FOR_FREE_WEEK
    };

    console.log(`Awarded ${totalPointsEarned} points to user ${userId} for ${type}${hasDoubleXp ? ' (2x XP active)' : ''}${mealOnTime ? ' (on-time bonus!)' : ''}`);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('Error in award-points:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to award points',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers
    });
  }
};

export const config = {
  path: '/api/award-points'
};
