/**
 * Netlify Edge Function: Award Points
 * Awards points for verified meal/workout submissions
 * Includes anti-cheat validation and streak/milestone tracking
 */

import type { Context } from "https://edge.netlify.com";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Points configuration (keep in sync with lib/points-config.js)
const POINTS_CONFIG = {
  POINTS_PER_MEAL: 1,
  POINTS_PER_WORKOUT: 1,
  POINTS_PER_PERSONAL_BEST: 1,
  CALORIE_GOAL_BONUS: 1,        // 1 bonus point for hitting daily calorie goal
  CALORIE_GOAL_TOLERANCE: 0.10, // 10% tolerance
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
  type: 'meal' | 'workout' | 'personal_best' | 'calorie_goal_bonus';
  referenceId: string;
  photoTimestamp?: string;  // ISO timestamp from EXIF or file
  aiConfidence?: string;    // 'high', 'medium', 'low'
  photoHash?: string;       // SHA-256 hash for duplicate detection
  exercise?: string;        // For personal_best: exercise name
  pbType?: string;          // For personal_best: 'weight' or 'reps'
  value?: number;           // For personal_best: the new PB value
  improvement?: number;     // For personal_best: improvement amount
  bonusDate?: string;       // For calorie_goal_bonus: the date being awarded (YYYY-MM-DD)
  totalCalories?: number;   // For calorie_goal_bonus: total calories for the day
  calorieGoal?: number;     // For calorie_goal_bonus: the calorie goal for the day
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
  milestonesUnlocked: Array<{ type: string; label: string; points: number }>;
  canRedeem: boolean;
  error?: string;
  reason?: string;
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

    if (type !== 'meal' && type !== 'workout' && type !== 'personal_best' && type !== 'calorie_goal_bonus') {
      return new Response(JSON.stringify({
        error: 'Invalid type',
        message: 'Type must be "meal", "workout", "personal_best", or "calorie_goal_bonus"'
      }), {
        status: 400,
        headers
      });
    }

    // Personal bests and calorie goal bonuses don't require photo verification
    const skipPhotoValidation = type === 'personal_best' || type === 'calorie_goal_bonus';

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

    // === CALORIE GOAL BONUS VALIDATION ===
    if (type === 'calorie_goal_bonus') {
      const { bonusDate, totalCalories, calorieGoal } = body;

      // Validate required fields
      if (!bonusDate || totalCalories === undefined || calorieGoal === undefined) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Missing required fields for calorie goal bonus',
          required: ['bonusDate', 'totalCalories', 'calorieGoal'],
          pointsAwarded: 0
        }), {
          status: 200,
          headers
        });
      }

      // Verify calories are within 10% tolerance
      const tolerance = POINTS_CONFIG.CALORIE_GOAL_TOLERANCE;
      const lowerBound = calorieGoal * (1 - tolerance);
      const upperBound = calorieGoal * (1 + tolerance);

      if (totalCalories < lowerBound || totalCalories > upperBound) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Calories not within goal range',
          reason: `Calories (${Math.round(totalCalories)}) must be within 10% of goal (${Math.round(calorieGoal)}). Range: ${Math.round(lowerBound)}-${Math.round(upperBound)}`,
          pointsAwarded: 0
        }), {
          status: 200,
          headers
        });
      }

      // Check if bonus already awarded for this date
      const { data: existingBonus } = await supabase
        .from('point_transactions')
        .select('id')
        .eq('user_id', userId)
        .eq('transaction_type', 'calorie_goal_bonus')
        .eq('reference_id', bonusDate)
        .single();

      if (existingBonus) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Bonus already awarded',
          reason: `Calorie goal bonus already awarded for ${bonusDate}`,
          pointsAwarded: 0
        }), {
          status: 200,
          headers
        });
      }
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
    } else if (type === 'calorie_goal_bonus') {
      basePoints = POINTS_CONFIG.CALORIE_GOAL_BONUS;
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

    // Calculate dates for streak
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
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

    // Check for streak bonus
    let bonusPoints = 0;
    let bonusDescription = '';

    const streakBonus = POINTS_CONFIG.STREAK_BONUSES.find(b => b.days === newStreak);
    if (streakBonus) {
      bonusPoints = streakBonus.points;
      bonusDescription = streakBonus.label;
    }

    // Calculate new totals
    const totalPointsEarned = pointsToAward + bonusPoints;
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
    // personal_best type doesn't update specific counters - just awards points

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
    let transactionType: string;
    let referenceType: string;
    let description: string;

    if (type === 'meal') {
      transactionType = 'earn_meal';
      referenceType = 'meal_log';
      description = `Earned ${pointsToAward} point for ${type}`;
    } else if (type === 'workout') {
      transactionType = 'earn_workout';
      referenceType = 'workout';
      description = `Earned ${pointsToAward} point for ${type}`;
    } else if (type === 'calorie_goal_bonus') {
      transactionType = 'calorie_goal_bonus';
      referenceType = 'daily_nutrition';
      description = `Earned ${pointsToAward} point for hitting daily calorie goal`;
    } else {
      transactionType = 'earn_personal_best';
      referenceType = 'personal_best';
      description = `Earned ${pointsToAward} point for personal best`;
    }

    await supabase.from('point_transactions').insert({
      user_id: userId,
      transaction_type: transactionType,
      points_amount: pointsToAward,
      reference_id: referenceId,
      reference_type: referenceType,
      photo_verified: type !== 'personal_best' && type !== 'calorie_goal_bonus',
      photo_timestamp: photoTimestamp || null,
      verification_method: (type === 'personal_best' || type === 'calorie_goal_bonus') ? 'data_verified' : (photoHash ? 'hash_verified' : (photoTimestamp ? 'timestamp_verified' : 'none')),
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
      pointsAwarded: pointsToAward,
      basePoints: basePoints,
      xpMultiplier: xpMultiplier,
      doubleXpActive: hasDoubleXp,
      bonusPoints: bonusPoints + milestoneBonus,
      bonusDescription: bonusDescription || (milestones.length > 0 ? milestones[0].label : null),
      newTotal: finalTotal,
      currentStreak: newStreak,
      milestonesUnlocked: milestones,
      canRedeem: finalTotal >= POINTS_CONFIG.POINTS_FOR_FREE_WEEK
    };

    console.log(`Awarded ${totalPointsEarned} points to user ${userId} for ${type}${hasDoubleXp ? ' (2x XP active)' : ''}`);

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
