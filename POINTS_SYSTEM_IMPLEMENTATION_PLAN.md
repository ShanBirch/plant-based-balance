# Points-Based Membership System - Implementation Plan

> **Last Updated:** January 2026
> **Status:** Planning Phase
> **Decisions Made:**
> - Pricing: $30 / $75 / $120 (1mo / 3mo / 6mo)
> - Points Economy: 200 posts = 1 free week, no daily cap
> - Discount Model: Flat pricing (no "was $60 now $30")

---

## Executive Summary

Build a rewards system where users earn points by posting verified meal photos and workout logs. Points can be redeemed for free membership time. The system includes anti-cheat measures to ensure photos are taken in real-time, Gemini AI verification, and gamification features (streaks, milestones).

---

## Part 1: Database Schema

### 1.1 New Tables

Create migration file: `database/points_system_migration.sql`

```sql
-- ============================================================
-- USER POINTS TABLE
-- Tracks total points balance for each user
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_points (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,

  -- Points balances
  current_points INTEGER DEFAULT 0,      -- Available to redeem
  lifetime_points INTEGER DEFAULT 0,     -- Total ever earned
  redeemed_points INTEGER DEFAULT 0,     -- Total spent

  -- Streak tracking
  current_streak INTEGER DEFAULT 0,      -- Days in a row with verified post
  longest_streak INTEGER DEFAULT 0,      -- Personal best streak
  last_post_date DATE,                   -- For streak calculation

  -- Meal-specific streaks
  meal_streak INTEGER DEFAULT 0,         -- Days tracking meals
  longest_meal_streak INTEGER DEFAULT 0,
  last_meal_date DATE,

  -- Workout-specific streaks
  workout_streak INTEGER DEFAULT 0,      -- Days logging workouts
  longest_workout_streak INTEGER DEFAULT 0,
  last_workout_date DATE,

  -- Stats
  total_meals_logged INTEGER DEFAULT 0,
  total_workouts_logged INTEGER DEFAULT 0,
  weeks_redeemed INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- POINT TRANSACTIONS TABLE
-- Audit log of all point earnings and redemptions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.point_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Transaction details
  transaction_type TEXT NOT NULL,  -- 'earn_meal', 'earn_workout', 'redeem_week', 'bonus_streak', 'admin_adjust'
  points_amount INTEGER NOT NULL,  -- Positive for earn, negative for redeem

  -- Reference to source (meal_log_id or workout_id)
  reference_id UUID,
  reference_type TEXT,             -- 'meal_log', 'workout', 'milestone', 'streak'

  -- Anti-cheat metadata
  photo_verified BOOLEAN DEFAULT FALSE,
  photo_timestamp TIMESTAMPTZ,
  verification_method TEXT,        -- 'exif', 'file_modified', 'gemini_confidence'
  ai_confidence TEXT,              -- 'high', 'medium', 'low'

  -- Description for UI
  description TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_point_transactions_user ON public.point_transactions(user_id, created_at DESC);

-- ============================================================
-- MEAL MILESTONES TABLE
-- Track meal-related achievements
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meal_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  milestone_type TEXT NOT NULL,    -- 'first_meal', '10_meals', '50_meals', 'meal_streak_7', etc.
  milestone_value INTEGER,         -- Threshold reached

  achievement_data JSONB,          -- Additional context
  points_awarded INTEGER DEFAULT 0,

  achieved_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, milestone_type, milestone_value)
);

CREATE INDEX idx_meal_milestones_user ON public.meal_milestones(user_id, achieved_at DESC);

-- ============================================================
-- PHOTO HASHES TABLE
-- Prevent duplicate photo submissions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.photo_hashes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  photo_hash TEXT NOT NULL,        -- SHA-256 or perceptual hash
  photo_type TEXT NOT NULL,        -- 'meal', 'workout'
  reference_id UUID,               -- meal_log_id or workout_id

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, photo_hash)
);

CREATE INDEX idx_photo_hashes_lookup ON public.photo_hashes(user_id, photo_hash);

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_hashes ENABLE ROW LEVEL SECURITY;

-- Users can view/update own data
CREATE POLICY "Users can view own points" ON public.user_points
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own points" ON public.user_points
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own points" ON public.user_points
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own transactions" ON public.point_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON public.point_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own milestones" ON public.meal_milestones
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own milestones" ON public.meal_milestones
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins can view all points" ON public.user_points
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid()));

CREATE POLICY "Admins can view all transactions" ON public.point_transactions
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid()));

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Initialize points record for new users
CREATE OR REPLACE FUNCTION initialize_user_points()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_points (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_initialize_points
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION initialize_user_points();

-- Update timestamp on points change
CREATE OR REPLACE FUNCTION update_points_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER points_updated_at
  BEFORE UPDATE ON public.user_points
  FOR EACH ROW
  EXECUTE FUNCTION update_points_timestamp();
```

### 1.2 Modify Existing Tables

Add to `users` table (if not already present via referral system):
```sql
-- Already exists from referral system, but ensure these are present:
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS free_days_earned INTEGER DEFAULT 0;
```

---

## Part 2: Points Economy Configuration

### 2.1 Points Values (Constants)

Create config file: `lib/points-config.js`

```javascript
// Points Economy Configuration
export const POINTS_CONFIG = {
  // === EARNING ===
  POINTS_PER_MEAL: 1,           // 1 point per verified meal photo
  POINTS_PER_WORKOUT: 1,        // 1 point per verified workout log

  // === REDEMPTION ===
  POINTS_FOR_FREE_WEEK: 200,    // 200 posts = 1 free week
  FREE_DAYS_PER_REDEMPTION: 7,  // 7 days per redemption

  // === STREAK BONUSES ===
  STREAK_BONUS_7_DAYS: 5,       // +5 points at 7-day streak
  STREAK_BONUS_14_DAYS: 10,     // +10 points at 14-day streak
  STREAK_BONUS_30_DAYS: 25,     // +25 points at 30-day streak
  STREAK_BONUS_60_DAYS: 50,     // +50 points at 60-day streak
  STREAK_BONUS_100_DAYS: 100,   // +100 points at 100-day streak

  // === MILESTONE BONUSES ===
  MILESTONES: {
    FIRST_MEAL: 5,              // First meal logged
    MEALS_10: 10,               // 10 meals
    MEALS_50: 25,               // 50 meals
    MEALS_100: 50,              // 100 meals
    MEALS_365: 100,             // 365 meals (1 year)

    FIRST_WORKOUT_POINTS: 5,    // First workout (already have milestone, add points)
    WORKOUTS_50: 25,
    WORKOUTS_100: 50,
    WORKOUTS_365: 100,
  },

  // === ANTI-CHEAT ===
  MAX_PHOTO_AGE_MINUTES: 5,     // Photo must be taken within 5 minutes
  MIN_AI_CONFIDENCE: 'medium', // Reject 'low' confidence analyses
  REQUIRE_UNIQUE_PHOTOS: true,  // Reject duplicate photo hashes

  // === LIMITS ===
  MAX_MEALS_PER_DAY: 10,        // Reasonable max (breakfast, lunch, dinner, snacks)
  MAX_WORKOUTS_PER_DAY: 3,      // Reasonable max
};

// Dollar value calculation
export const calculatePointsValue = (points) => {
  // $30/month = ~$7/week
  // 200 points = 1 week = $7
  // 1 point ≈ $0.035 value
  const DOLLAR_VALUE_PER_POINT = 7 / POINTS_CONFIG.POINTS_FOR_FREE_WEEK;
  return (points * DOLLAR_VALUE_PER_POINT).toFixed(2);
};
```

### 2.2 Economy Math

With 200 posts = 1 free week:

| Scenario | Daily Posts | Days to Earn 1 Week | Monthly Value |
|----------|-------------|---------------------|---------------|
| Light user | 2 | 100 days | ~$2.10 |
| Regular user | 4 | 50 days | ~$4.20 |
| Power user | 6 | 33 days | ~$6.30 |
| Max engagement | 10 | 20 days | ~$10.50 |

**Analysis:** At maximum engagement (10 posts/day = 3 meals + snacks + workout), a user could earn ~$10.50/month value, which is 35% of the $30 subscription. This is challenging enough while still being rewarding.

---

## Part 3: Edge Functions

### 3.1 Award Points (`netlify/edge-functions/award-points.ts`)

```typescript
/**
 * Netlify Edge Function: Award Points
 * Awards points for verified meal/workout submissions
 */

import type { Context } from "https://edge.netlify.com";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const POINTS_CONFIG = {
  POINTS_PER_MEAL: 1,
  POINTS_PER_WORKOUT: 1,
  POINTS_FOR_FREE_WEEK: 200,
  MIN_AI_CONFIDENCE: 'medium',
  MAX_PHOTO_AGE_MINUTES: 5,
};

interface AwardPointsRequest {
  userId: string;
  type: 'meal' | 'workout';
  referenceId: string;
  photoTimestamp?: string;  // ISO timestamp from EXIF or file
  aiConfidence?: string;
  photoHash?: string;
}

export default async (request: Request, context: Context) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body: AwardPointsRequest = await request.json();
    const { userId, type, referenceId, photoTimestamp, aiConfidence, photoHash } = body;

    if (!userId || !type || !referenceId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // === ANTI-CHEAT CHECKS ===

    // 1. Check AI confidence (reject low confidence)
    if (aiConfidence === 'low') {
      return new Response(JSON.stringify({
        error: 'Photo verification failed',
        reason: 'AI could not verify this is a valid meal/workout photo',
        pointsAwarded: 0
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Check photo timestamp (must be recent)
    if (photoTimestamp) {
      const photoTime = new Date(photoTimestamp).getTime();
      const now = Date.now();
      const ageMinutes = (now - photoTime) / (1000 * 60);

      if (ageMinutes > POINTS_CONFIG.MAX_PHOTO_AGE_MINUTES) {
        return new Response(JSON.stringify({
          error: 'Photo too old',
          reason: 'Please take a fresh photo for points',
          pointsAwarded: 0
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // 3. Check for duplicate photos
    if (photoHash) {
      const { data: existingHash } = await supabase
        .from('photo_hashes')
        .select('id')
        .eq('user_id', userId)
        .eq('photo_hash', photoHash)
        .single();

      if (existingHash) {
        return new Response(JSON.stringify({
          error: 'Duplicate photo',
          reason: 'This photo has already been used for points',
          pointsAwarded: 0
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Store hash for future checks
      await supabase.from('photo_hashes').insert({
        user_id: userId,
        photo_hash: photoHash,
        photo_type: type,
        reference_id: referenceId
      });
    }

    // === AWARD POINTS ===
    const pointsToAward = type === 'meal'
      ? POINTS_CONFIG.POINTS_PER_MEAL
      : POINTS_CONFIG.POINTS_PER_WORKOUT;

    // Get current points record
    const { data: userPoints, error: fetchError } = await supabase
      .from('user_points')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    const today = new Date().toISOString().split('T')[0];
    const lastPostDate = userPoints?.last_post_date;
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Calculate streak
    let newStreak = 1;
    if (lastPostDate === yesterday) {
      newStreak = (userPoints?.current_streak || 0) + 1;
    } else if (lastPostDate === today) {
      newStreak = userPoints?.current_streak || 1;
    }

    // Check for streak bonuses
    let bonusPoints = 0;
    let bonusDescription = '';
    const streakBonuses = [
      { days: 7, points: 5 },
      { days: 14, points: 10 },
      { days: 30, points: 25 },
      { days: 60, points: 50 },
      { days: 100, points: 100 },
    ];

    for (const bonus of streakBonuses) {
      if (newStreak === bonus.days) {
        bonusPoints = bonus.points;
        bonusDescription = `${bonus.days}-day streak bonus!`;
        break;
      }
    }

    // Update points
    const newCurrentPoints = (userPoints?.current_points || 0) + pointsToAward + bonusPoints;
    const newLifetimePoints = (userPoints?.lifetime_points || 0) + pointsToAward + bonusPoints;

    const updateData: any = {
      current_points: newCurrentPoints,
      lifetime_points: newLifetimePoints,
      current_streak: newStreak,
      longest_streak: Math.max(userPoints?.longest_streak || 0, newStreak),
      last_post_date: today,
    };

    // Update type-specific counters
    if (type === 'meal') {
      updateData.total_meals_logged = (userPoints?.total_meals_logged || 0) + 1;
      updateData.meal_streak = lastPostDate === yesterday || lastPostDate === today
        ? (userPoints?.meal_streak || 0) + (lastPostDate === yesterday ? 1 : 0)
        : 1;
      updateData.last_meal_date = today;
    } else {
      updateData.total_workouts_logged = (userPoints?.total_workouts_logged || 0) + 1;
      updateData.workout_streak = lastPostDate === yesterday || lastPostDate === today
        ? (userPoints?.workout_streak || 0) + (lastPostDate === yesterday ? 1 : 0)
        : 1;
      updateData.last_workout_date = today;
    }

    // Upsert points record
    const { error: updateError } = await supabase
      .from('user_points')
      .upsert({ user_id: userId, ...updateData });

    if (updateError) throw updateError;

    // Log transaction
    await supabase.from('point_transactions').insert({
      user_id: userId,
      transaction_type: type === 'meal' ? 'earn_meal' : 'earn_workout',
      points_amount: pointsToAward,
      reference_id: referenceId,
      reference_type: type === 'meal' ? 'meal_log' : 'workout',
      photo_verified: true,
      photo_timestamp: photoTimestamp,
      verification_method: photoHash ? 'hash_verified' : 'timestamp_only',
      ai_confidence: aiConfidence,
      description: `Earned ${pointsToAward} point${pointsToAward > 1 ? 's' : ''} for ${type}`
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

    // Check milestones
    const milestones = await checkMilestones(supabase, userId, type, updateData);

    return new Response(JSON.stringify({
      success: true,
      pointsAwarded: pointsToAward,
      bonusPoints,
      bonusDescription: bonusDescription || null,
      newTotal: newCurrentPoints,
      currentStreak: newStreak,
      milestonesUnlocked: milestones,
      canRedeem: newCurrentPoints >= POINTS_CONFIG.POINTS_FOR_FREE_WEEK
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error awarding points:', error);
    return new Response(JSON.stringify({
      error: 'Failed to award points',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

async function checkMilestones(supabase: any, userId: string, type: string, stats: any) {
  const unlocked = [];
  const milestoneChecks = type === 'meal' ? [
    { count: 1, type: 'first_meal', points: 5, label: 'First Meal Tracked!' },
    { count: 10, type: '10_meals', points: 10, label: '10 Meals Tracked!' },
    { count: 50, type: '50_meals', points: 25, label: '50 Meals Tracked!' },
    { count: 100, type: '100_meals', points: 50, label: '100 Meals Tracked!' },
    { count: 365, type: '365_meals', points: 100, label: '365 Meals - One Year!' },
  ] : [
    { count: 50, type: '50_workouts_points', points: 25, label: '50 Workouts!' },
    { count: 100, type: '100_workouts_points', points: 50, label: '100 Workouts!' },
    { count: 365, type: '365_workouts_points', points: 100, label: '365 Workouts!' },
  ];

  const totalCount = type === 'meal' ? stats.total_meals_logged : stats.total_workouts_logged;

  for (const milestone of milestoneChecks) {
    if (totalCount === milestone.count) {
      // Check if already achieved
      const { data: existing } = await supabase
        .from('meal_milestones')
        .select('id')
        .eq('user_id', userId)
        .eq('milestone_type', milestone.type)
        .single();

      if (!existing) {
        await supabase.from('meal_milestones').insert({
          user_id: userId,
          milestone_type: milestone.type,
          milestone_value: milestone.count,
          points_awarded: milestone.points
        });

        // Award bonus points
        await supabase.rpc('increment_user_points', {
          p_user_id: userId,
          p_amount: milestone.points
        });

        await supabase.from('point_transactions').insert({
          user_id: userId,
          transaction_type: 'bonus_milestone',
          points_amount: milestone.points,
          reference_type: 'milestone',
          description: milestone.label
        });

        unlocked.push({ type: milestone.type, label: milestone.label, points: milestone.points });
      }
    }
  }

  return unlocked;
}

export const config = {
  path: '/api/award-points'
};
```

### 3.2 Redeem Points (`netlify/edge-functions/redeem-points.ts`)

```typescript
/**
 * Netlify Edge Function: Redeem Points
 * Converts points to free subscription days
 */

import type { Context } from "https://edge.netlify.com";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0';

const POINTS_FOR_FREE_WEEK = 200;
const FREE_DAYS_PER_REDEMPTION = 7;

export default async (request: Request, context: Context) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { userId } = await request.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user's points
    const { data: userPoints, error: fetchError } = await supabase
      .from('user_points')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fetchError || !userPoints) {
      return new Response(JSON.stringify({ error: 'User points not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if enough points
    if (userPoints.current_points < POINTS_FOR_FREE_WEEK) {
      return new Response(JSON.stringify({
        error: 'Insufficient points',
        currentPoints: userPoints.current_points,
        required: POINTS_FOR_FREE_WEEK
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get user's Stripe customer ID
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (userError || !user?.stripe_customer_id) {
      return new Response(JSON.stringify({
        error: 'No active subscription found',
        message: 'You need an active subscription to redeem points'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Extend subscription via Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2024-11-20.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripe_customer_id,
      status: 'active',
      limit: 1
    });

    if (subscriptions.data.length === 0) {
      return new Response(JSON.stringify({
        error: 'No active subscription',
        message: 'Points can only be redeemed with an active subscription'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const subscription = subscriptions.data[0];
    const currentPeriodEnd = subscription.current_period_end;
    const daysInSeconds = FREE_DAYS_PER_REDEMPTION * 24 * 60 * 60;
    const newPeriodEnd = currentPeriodEnd + daysInSeconds;

    // Update subscription
    await stripe.subscriptions.update(subscription.id, {
      trial_end: newPeriodEnd,
      proration_behavior: 'none',
      metadata: {
        ...subscription.metadata,
        points_redeemed: (parseInt(subscription.metadata.points_redeemed || '0') + POINTS_FOR_FREE_WEEK).toString(),
        last_points_redemption: new Date().toISOString()
      }
    });

    // Deduct points
    await supabase
      .from('user_points')
      .update({
        current_points: userPoints.current_points - POINTS_FOR_FREE_WEEK,
        redeemed_points: userPoints.redeemed_points + POINTS_FOR_FREE_WEEK,
        weeks_redeemed: userPoints.weeks_redeemed + 1
      })
      .eq('user_id', userId);

    // Log transaction
    await supabase.from('point_transactions').insert({
      user_id: userId,
      transaction_type: 'redeem_week',
      points_amount: -POINTS_FOR_FREE_WEEK,
      description: `Redeemed ${POINTS_FOR_FREE_WEEK} points for 1 free week`
    });

    return new Response(JSON.stringify({
      success: true,
      pointsRedeemed: POINTS_FOR_FREE_WEEK,
      daysAdded: FREE_DAYS_PER_REDEMPTION,
      newPointsBalance: userPoints.current_points - POINTS_FOR_FREE_WEEK,
      newSubscriptionEnd: new Date(newPeriodEnd * 1000).toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error redeeming points:', error);
    return new Response(JSON.stringify({
      error: 'Failed to redeem points',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = {
  path: '/api/redeem-points'
};
```

### 3.3 Verify Photo (`netlify/edge-functions/verify-photo.ts`)

```typescript
/**
 * Netlify Edge Function: Verify Photo
 * Checks if photo is real-time (not from gallery)
 */

import type { Context } from "https://edge.netlify.com";

const MAX_PHOTO_AGE_MINUTES = 5;

export default async (request: Request, context: Context) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const {
      fileLastModified,  // File.lastModified from JavaScript
      exifTimestamp,     // EXIF DateTimeOriginal if available
      serverTimestamp    // When request was made
    } = await request.json();

    const now = Date.now();
    let photoTimestamp = now;
    let verificationMethod = 'none';
    let isValid = false;

    // Priority: EXIF > lastModified > server time
    if (exifTimestamp) {
      photoTimestamp = new Date(exifTimestamp).getTime();
      verificationMethod = 'exif';
    } else if (fileLastModified) {
      photoTimestamp = fileLastModified;
      verificationMethod = 'file_modified';
    }

    const ageMinutes = (now - photoTimestamp) / (1000 * 60);
    isValid = ageMinutes <= MAX_PHOTO_AGE_MINUTES;

    // Also check if timestamp is in the future (suspicious)
    if (photoTimestamp > now + 60000) { // More than 1 minute in future
      isValid = false;
      verificationMethod = 'future_timestamp_rejected';
    }

    return new Response(JSON.stringify({
      isValid,
      ageMinutes: Math.round(ageMinutes * 10) / 10,
      maxAgeMinutes: MAX_PHOTO_AGE_MINUTES,
      verificationMethod,
      photoTimestamp: new Date(photoTimestamp).toISOString(),
      message: isValid
        ? 'Photo verified as recent'
        : 'Photo appears to be from gallery or too old'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error verifying photo:', error);
    return new Response(JSON.stringify({
      isValid: false,
      error: 'Verification failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = {
  path: '/api/verify-photo'
};
```

### 3.4 Update `analyze_food.ts`

Add workout photo analysis capability and return verification data:

```typescript
// Add to existing analyze_food.ts - ADD NEW ENDPOINT or modify existing

// In the system prompt, add:
// - Check if this appears to be a real food photo (not a screenshot, not a photo of a screen)
// - Look for signs of manipulation

// Add to response structure:
// "isRealPhoto": true/false,
// "photoQuality": "good/acceptable/poor",
// "suspiciousIndicators": [] // e.g., "appears to be screenshot", "multiple compression artifacts"
```

### 3.5 New: Analyze Workout Photo (`netlify/edge-functions/analyze_workout.ts`)

```typescript
/**
 * Netlify Edge Function: Analyze Workout Photo
 * Uses Gemini to verify workout photos for points
 */

import { Context } from "@netlify/edge-functions";

export default async function (request: Request, context: Context) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { imageBase64, mimeType, workoutType } = await request.json();
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

    const systemPrompt = `You are a workout verification AI. Analyze this image to determine if it shows a legitimate workout or exercise activity.

INSTRUCTIONS:
1. Determine if the image shows workout-related content (gym, exercise, fitness activity)
2. Check for signs this is a real photo (not a screenshot, not AI-generated)
3. Look for indicators of actual exercise (equipment, workout clothes, gym environment, exercise pose)

RESPONSE FORMAT - Return ONLY valid JSON:
{
  "isWorkoutPhoto": true/false,
  "confidence": "high/medium/low",
  "workoutType": "gym/home/outdoor/yoga/cardio/unknown",
  "detectedElements": ["gym equipment", "workout clothes", etc.],
  "suspiciousIndicators": [],
  "notes": "Any observations"
}

IMPORTANT:
- Be strict but fair - real workout photos should pass
- Reject obvious fakes (stock photos, screenshots, non-workout content)
- "low" confidence means rejection for points`;

    const payload = {
      contents: [{
        parts: [
          { text: systemPrompt },
          { inline_data: { mime_type: mimeType || "image/jpeg", data: imageBase64 } }
        ]
      }],
      generationConfig: {
        temperature: 0.3,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    };

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", errorText);
      return new Response(JSON.stringify({ error: "Failed to analyze image" }), {
        status: geminiResponse.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const geminiData = await geminiResponse.json();
    const aiText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiText) {
      return new Response(JSON.stringify({ error: "AI couldn't analyze this image" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    let analysisData;
    try {
      const cleanedText = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysisData = JSON.parse(cleanedText);
    } catch (parseError) {
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: analysisData,
      pointsEligible: analysisData.isWorkoutPhoto && analysisData.confidence !== 'low'
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in analyze_workout function:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export const config = {
  path: '/api/analyze-workout'
};
```

---

## Part 4: Frontend Components

### 4.1 Points Display Widget

Add to `dashboard.html` - Snap-style points/streak display:

```html
<!-- Points Widget (add near top of dashboard) -->
<div id="points-widget" class="points-widget" style="display:none;">
  <div class="points-main">
    <div class="points-balance">
      <span class="points-number" id="points-current">0</span>
      <span class="points-label">points</span>
    </div>
    <div class="streak-badge" id="streak-badge">
      <span class="streak-fire">🔥</span>
      <span class="streak-number" id="streak-current">0</span>
    </div>
  </div>
  <div class="points-progress">
    <div class="progress-bar">
      <div class="progress-fill" id="points-progress-fill" style="width: 0%"></div>
    </div>
    <span class="progress-label" id="points-progress-label">0/200 to free week</span>
  </div>
  <button class="redeem-btn" id="redeem-btn" onclick="redeemPoints()" disabled>
    Redeem Free Week
  </button>
</div>
```

### 4.2 Points Widget Styles

```css
.points-widget {
  background: linear-gradient(135deg, #48864B 0%, #2d5a30 100%);
  border-radius: 20px;
  padding: 20px;
  margin: 15px;
  color: white;
  box-shadow: 0 8px 25px rgba(72, 134, 75, 0.3);
}

.points-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.points-balance {
  display: flex;
  flex-direction: column;
}

.points-number {
  font-size: 2.5rem;
  font-weight: 900;
  line-height: 1;
}

.points-label {
  font-size: 0.9rem;
  opacity: 0.8;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.streak-badge {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50px;
  padding: 10px 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  backdrop-filter: blur(10px);
}

.streak-fire {
  font-size: 1.5rem;
}

.streak-number {
  font-size: 1.5rem;
  font-weight: 800;
}

.points-progress {
  margin-bottom: 15px;
}

.progress-bar {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  height: 12px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  background: linear-gradient(90deg, #90EE90 0%, #FFD700 100%);
  height: 100%;
  border-radius: 10px;
  transition: width 0.5s ease;
}

.progress-label {
  font-size: 0.85rem;
  opacity: 0.9;
}

.redeem-btn {
  width: 100%;
  background: white;
  color: #48864B;
  border: none;
  padding: 14px;
  border-radius: 12px;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.redeem-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.redeem-btn:not(:disabled):hover {
  transform: scale(1.02);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}
```

### 4.3 Milestone Toast Notifications

```javascript
// Add to dashboard.html or separate file

function showMilestoneToast(milestone) {
  const toast = document.createElement('div');
  toast.className = 'milestone-toast';
  toast.innerHTML = `
    <div class="milestone-icon">🎉</div>
    <div class="milestone-content">
      <div class="milestone-title">${milestone.label}</div>
      <div class="milestone-points">+${milestone.points} points</div>
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

function showPointsEarned(points, bonusPoints = 0, streak = 0) {
  const toast = document.createElement('div');
  toast.className = 'points-earned-toast';
  toast.innerHTML = `
    <div class="points-earned-main">+${points}</div>
    ${bonusPoints > 0 ? `<div class="points-earned-bonus">+${bonusPoints} streak bonus!</div>` : ''}
    ${streak > 0 ? `<div class="points-earned-streak">🔥 ${streak} day streak</div>` : ''}
  `;

  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
```

### 4.4 Milestone Toast Styles

```css
.milestone-toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%) translateY(-100px);
  background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
  border-radius: 16px;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 10px 40px rgba(255, 165, 0, 0.4);
  z-index: 10009;
  transition: transform 0.3s ease;
}

.milestone-toast.show {
  transform: translateX(-50%) translateY(0);
}

.milestone-icon {
  font-size: 2rem;
}

.milestone-title {
  font-weight: 700;
  color: #333;
  font-size: 1.1rem;
}

.milestone-points {
  color: #666;
  font-weight: 600;
}

.points-earned-toast {
  position: fixed;
  top: 80px;
  right: 20px;
  background: #48864B;
  color: white;
  border-radius: 12px;
  padding: 12px 20px;
  box-shadow: 0 6px 20px rgba(72, 134, 75, 0.4);
  z-index: 10009;
  transform: translateX(200px);
  transition: transform 0.3s ease;
}

.points-earned-toast.show {
  transform: translateX(0);
}

.points-earned-main {
  font-size: 1.5rem;
  font-weight: 800;
}

.points-earned-bonus,
.points-earned-streak {
  font-size: 0.85rem;
  opacity: 0.9;
}
```

---

## Part 5: Pricing Update

### 5.1 Files to Update

| File | Changes |
|------|---------|
| `checkout.js` | Update PLAN_DETAILS amounts, may need new Stripe price IDs |
| `plantbasedswitch.html` | Update all price displays, remove discount strikethrough |
| `shop.html` | Update price displays |
| `success.html` | Update default purchase value |
| `terms.html` | Update example pricing |
| **Stripe Dashboard** | Create new products/prices for $30/$75/$120 |

### 5.2 New Pricing Values

```javascript
// checkout.js - NEW FLAT PRICING
const PLAN_DETAILS = {
  '1-month': { amount: 3000, label: '28-Day Switch (1 Month)' },      // $30
  '3-month': { amount: 7500, label: '28-Day Switch (3 Months)' },     // $75
  '6-month': { amount: 12000, label: '28-Day Switch (6 Months)' }     // $120
};

// Remove discounted vs full price logic
// Remove isDiscounted checks
// Remove discount coupon application
```

### 5.3 plantbasedswitch.html Changes

```html
<!-- BEFORE -->
<div class="price-old">AUD $92</div>
<div class="price-new">AUD $46</div>
<span class="weekly-price">AUD $11.50 per week</span>

<!-- AFTER -->
<div class="price-new">AUD $30</div>
<span class="weekly-price">AUD $7.50 per week</span>
```

Remove all:
- `price-old` elements (strikethrough prices)
- References to 50% discount
- `is_discounted` logic

### 5.4 Stripe Setup Required

1. Create new products in Stripe Dashboard:
   - **1-Month Plan:** $30 AUD recurring monthly
   - **3-Month Plan:** $75 AUD recurring every 3 months
   - **6-Month Plan:** $120 AUD recurring every 6 months

2. Get new price IDs and update `checkout.js`:
```javascript
const PRICES = {
  '1-month': 'price_NEW_1MONTH_ID',
  '3-month': 'price_NEW_3MONTH_ID',
  '6-month': 'price_NEW_6MONTH_ID'
};
```

---

## Part 6: Integration Points

### 6.1 Meal Logging Flow (Updated)

```
User taps "Log Meal" → Opens camera (capture="environment")
                           ↓
                     Photo captured
                           ↓
              ┌────────────────────────────┐
              │  Client-side checks:       │
              │  1. Get File.lastModified  │
              │  2. Generate photo hash    │
              │  3. Extract EXIF (if avail)│
              └────────────────────────────┘
                           ↓
              POST /api/verify-photo
              {fileLastModified, exifTimestamp}
                           ↓
              ┌────────────────────────────┐
              │  If not valid:             │
              │  Show "Please take a       │
              │  fresh photo for points"   │
              │  (Still allow logging,     │
              │  just no points)           │
              └────────────────────────────┘
                           ↓
              POST /api/edge-functions/analyze_food
              {imageBase64, mimeType, description}
                           ↓
              ┌────────────────────────────┐
              │  If confidence == "low":   │
              │  No points, show warning   │
              └────────────────────────────┘
                           ↓
              Save meal to meal_logs table
                           ↓
              POST /api/award-points
              {userId, type: 'meal', referenceId,
               photoTimestamp, aiConfidence, photoHash}
                           ↓
              Show points earned toast
              Update points widget
              Check for milestones
```

### 6.2 Workout Logging Flow (New Points Integration)

```
User completes workout log
        ↓
(Optional) Prompt for workout selfie
        ↓
If photo provided:
    - Verify photo timestamp
    - Analyze with /api/analyze-workout
    - Award points if valid
        ↓
If no photo:
    - Award points based on logged data
    - (Consider reduced points for no-photo?)
        ↓
Update points widget
Check for milestones
```

### 6.3 Supabase Helper Functions

Add to `lib/supabase.js`:

```javascript
// Points System Helpers
const PointsDB = {
  // Get user's points data
  async getPoints(userId) {
    const { data, error } = await supabase
      .from('user_points')
      .select('*')
      .eq('user_id', userId)
      .single();
    return { data, error };
  },

  // Get recent transactions
  async getTransactions(userId, limit = 20) {
    const { data, error } = await supabase
      .from('point_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return { data, error };
  },

  // Get milestones
  async getMilestones(userId) {
    const { data, error } = await supabase
      .from('meal_milestones')
      .select('*')
      .eq('user_id', userId)
      .order('achieved_at', { ascending: false });
    return { data, error };
  },

  // Get all-time leaderboard (optional feature)
  async getLeaderboard(limit = 10) {
    const { data, error } = await supabase
      .from('user_points')
      .select('user_id, lifetime_points, longest_streak')
      .order('lifetime_points', { ascending: false })
      .limit(limit);
    return { data, error };
  }
};
```

---

## Part 7: Implementation Order

### Phase 1: Database & Backend (Foundation)
1. Create `database/points_system_migration.sql`
2. Run migration in Supabase
3. Create `netlify/edge-functions/award-points.ts`
4. Create `netlify/edge-functions/redeem-points.ts`
5. Create `netlify/edge-functions/verify-photo.ts`
6. Create `netlify/edge-functions/analyze_workout.ts`
7. Add points helpers to `lib/supabase.js`

### Phase 2: Frontend Points Display
1. Add points widget HTML to `dashboard.html`
2. Add points widget CSS
3. Add milestone toast system
4. Add points earned animations
5. Wire up points data loading on dashboard init

### Phase 3: Meal Integration
1. Update meal camera flow to capture photo metadata
2. Add photo hash generation (client-side)
3. Call verify-photo before analyze_food
4. Call award-points after successful meal log
5. Show points feedback to user

### Phase 4: Workout Integration
1. Add optional workout selfie prompt
2. Integrate analyze_workout for photo verification
3. Award points on workout completion
4. Update existing workout milestones to award points

### Phase 5: Redemption System
1. Add redeem button to points widget
2. Implement redemption confirmation modal
3. Wire up redeem-points endpoint
4. Show success/error feedback
5. Update subscription display after redemption

### Phase 6: Pricing Update
1. Create new Stripe products (in Stripe Dashboard)
2. Update `checkout.js` with new prices and IDs
3. Update `plantbasedswitch.html` pricing display
4. Update `shop.html` pricing display
5. Update `success.html` default values
6. Update `terms.html` example text
7. Remove all discount/strikethrough logic
8. Test checkout flow end-to-end

### Phase 7: Polish & Testing
1. Test anti-cheat measures
2. Test streak calculations
3. Test milestone triggers
4. Test redemption flow
5. Mobile testing
6. Edge cases (timezone handling, streak reset, etc.)

---

## Part 8: Security Considerations

### 8.1 Anti-Cheat Summary

| Attack Vector | Mitigation |
|---------------|------------|
| Old photos from gallery | Check File.lastModified, EXIF timestamp, reject if >5 min old |
| Duplicate photos | SHA-256 hash stored in photo_hashes table |
| Fake food photos | Gemini confidence check, reject "low" confidence |
| Screenshot of food | Gemini detects screen artifacts, compression patterns |
| API manipulation | Server-side validation, user can only award points to self |
| Point inflation | Rate limits on posts per day, all transactions logged |
| Fake workout logs | Optional photo verification, or reduced points for no-photo |

### 8.2 Rate Limits

- Max 10 meals per day (reasonable for breakfast, lunch, dinner, snacks)
- Max 3 workouts per day
- Points awarded server-side only (not client-side)
- All transactions logged for audit

### 8.3 Fraud Detection (Future Enhancement)

Consider adding:
- Anomaly detection for unusual posting patterns
- Manual review queue for high-volume users
- IP/device fingerprinting
- Community reporting

---

## Part 9: Future Enhancements (Post-MVP)

1. **Leaderboard** - Weekly/monthly top point earners
2. **Challenges** - "Log 7 meals this week for bonus points"
3. **Referral + Points combo** - Bonus points when friend joins
4. **Point multipliers** - Double points on weekends
5. **Achievement badges** - Visual badges for milestones
6. **Social sharing** - "I just hit 100 points!" share cards
7. **Point gifting** - Send points to friends
8. **Tiered rewards** - Different redemption options (merch, coaching calls)

---

## Summary

This plan covers:
- **Database schema** for points, transactions, milestones, photo hashes
- **4 new edge functions** for awarding, redeeming, and verifying
- **Anti-cheat system** with photo timestamp validation and duplicate detection
- **Frontend components** for points display, streaks, and milestones
- **Full pricing update** from $46 to $30/month with flat pricing
- **Integration points** showing how it connects to existing meal/workout flows
- **7-phase implementation order** for systematic rollout

Ready to start building when you give the go-ahead!
