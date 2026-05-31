/**
 * Weekly Wrapped
 *
 * Spotify Wrapped-style Sunday morning to Monday midday recap. Gathers 7-day + 4-week trends
 * across workouts/mood/PBs/weight/social/XP/coins, computes trend-line
 * predictions, renders a 10-slide animated takeover with anime-style impact
 * frames, speed lines, halftone overlays, and number count-ups.
 *
 * Triggered by:
 *   - Sunday 09:00 Brisbane push (weekly-wrapped-push.js scheduled fn)
 *   - Home card visible Sun 09:00 -> Mon 12:00 Brisbane if unseen for this ISO week
 *   - Manual replay from settings
 *
 * Seen state: localStorage `pbb_wrapped_seen_{iso_week}` (client-only dedup)
 * Archive:    `weekly_wrapped` table (optional snapshot for revisit — write on open)
 *
 * Exposes:
 *   window.weeklyWrapped = {
 *     open(userId, opts)        — fetch + render + show
 *     buildData(userId)         — gather only, no UI
 *     getCurrentISOWeek()       — 'YYYY-Www' of now
 *     markSeen(isoWeek)         — mark current week as seen locally
 *     hasSeen(isoWeek)          — check localStorage flag
 *   }
 */

(function(){
  'use strict';

  const DAY_MS = 24 * 60 * 60 * 1000;
  const SEEN_KEY_PREFIX = 'pbb_wrapped_seen_';
  const SLIDE_DURATION_MS = 5200;
  const WEEKLY_GOAL_XP_PER_GOAL = 10;
  const WEEKLY_GOAL_ALL_HIT_BONUS = 20;
  const WEEKLY_GOAL_XP_CAP = 50;
  const BRISBANE_OFFSET_MS = 10 * 60 * 60 * 1000;

  function getBrisbaneWallClockDate(date){
    return new Date((date ? date.getTime() : Date.now()) + BRISBANE_OFFSET_MS);
  }

  function toUtcInstantFromBrisbaneWallClock(date){
    return new Date(date.getTime() - BRISBANE_OFFSET_MS);
  }

  // Currently-playing synth instance — module-level so closeOverlay() can
  // stop it without threading the reference through every call site.
  let currentSynth = null;

  // Set once the user's wrapped data has loaded, so closeOverlay() can mark
  // the week as seen regardless of which close path fires (X button,
  // swipe-back gesture, Android back button, slideshow completion).
  let activeUserId = null;
  let activeIsoWeek = null;

  // ============================================================
  //  Date / ISO week helpers
  // ============================================================

  function getWeekStart(date){
    // Monday 00:00 local as start-of-week.
    const d = new Date(date || Date.now());
    d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0 Sun … 6 Sat
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff);
    return d;
  }

  // Monday 00:00 local of the week the wrapped is REVIEWING.
  //
  //   Sunday  → Monday of this week (the week ending today at Sun 23:59)
  //   Mon–Sat → Monday of the PREVIOUS week (we always review a full
  //             just-completed Mon–Sun; mid-week data would be garbage)
  //
  // This is the fix for "opened Monday morning, said 0 workouts" - the
  // wrapped needs to show last week's numbers regardless of which day
  // in the home-card window (Sun 09:00 -> Mon 12:00 Brisbane) the user
  // actually opens.
  function getWrappedWeekStart(date){
    const d = new Date(date || Date.now());
    d.setUTCHours(0, 0, 0, 0);
    const day = d.getUTCDay(); // 0 Sun … 6 Sat in Brisbane wall-clock time
    if (day === 0) {
      // Sunday — this week's Monday is 6 days ago
      d.setUTCDate(d.getUTCDate() - 6);
    } else {
      // Mon–Sat — previous week's Monday
      d.setUTCDate(d.getUTCDate() - (day - 1) - 7);
    }
    return d;
  }

  function getISOWeek(date){
    const d = new Date(Date.UTC(
      (date || new Date()).getFullYear(),
      (date || new Date()).getMonth(),
      (date || new Date()).getDate()
    ));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil(((d - yearStart) / DAY_MS + 1) / 7);
    return d.getUTCFullYear() + '-W' + String(weekNum).padStart(2, '0');
  }

  // Format a Brisbane wall-clock date (+10h shifted) as YYYY-MM-DD.
  function formatDate(d){
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return y + '-' + m + '-' + dd;
  }

  function round1(n){ return Math.round(n * 10) / 10; }

  function readWeeklyGoalsSnapshot(userId, weekStartDate) {
    if (!userId || !weekStartDate) return null;
    try {
      const raw = localStorage.getItem('pbb_weekly_goals_' + userId + '_' + weekStartDate);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  // ============================================================
  //  Data gathering — 4 weeks of source rows in one Promise.all
  // ============================================================

  async function buildData(userId){
    const supabase = window.supabaseClient;
    if (!supabase) throw new Error('Supabase client not ready');

    const now = getBrisbaneWallClockDate(new Date());
    // IMPORTANT: thisWeekStart is the Monday of the week being REVIEWED,
    // not the Monday of the literal calendar week. On a Mon–Sat open it
    // points to last week's Monday so the wrapped reports on a completed
    // Mon–Sun range instead of an empty half-week.
    const thisWeekStartBrisbane = getWrappedWeekStart(now);
    const thisWeekEndBrisbane = new Date(thisWeekStartBrisbane.getTime() + 7 * DAY_MS);
    const lastWeekStartBrisbane = new Date(thisWeekStartBrisbane.getTime() - 7 * DAY_MS);
    const fourWeeksAgoBrisbane = new Date(thisWeekStartBrisbane.getTime() - 28 * DAY_MS);

    const thisWeekStart = toUtcInstantFromBrisbaneWallClock(thisWeekStartBrisbane);
    const thisWeekEnd = toUtcInstantFromBrisbaneWallClock(thisWeekEndBrisbane);
    const lastWeekStart = toUtcInstantFromBrisbaneWallClock(lastWeekStartBrisbane);
    const fourWeeksAgo = toUtcInstantFromBrisbaneWallClock(fourWeeksAgoBrisbane);

    const sinceThis = thisWeekStart.toISOString();
    const untilThis = thisWeekEnd.toISOString();
    const sinceFour = fourWeeksAgo.toISOString();
    const sinceThisDate = formatDate(thisWeekStartBrisbane);
    const untilThisDate = formatDate(thisWeekEndBrisbane);
    const sinceFourDate = formatDate(fourWeeksAgoBrisbane);

    // All per-week queries below are bounded [thisWeekStart, thisWeekEnd).
    // Without the upper bound, opening the wrapped on Mon afternoon (after the
    // reviewed week ended) lets *today's* rows leak into "last week's" stats.
    const results = await Promise.allSettled([
      supabase.from('workouts')
        .select('workout_date, exercise_name, created_at')
        .eq('user_id', userId).eq('workout_type', 'history')
        .gte('created_at', sinceFour),
      supabase.from('mood_logs')
        .select('mood_score, energy_score, stress_score, logged_at')
        .eq('user_id', userId).gte('logged_at', sinceFour),
      supabase.from('pb_history')
        .select('exercise_name, pb_type, new_value, improvement, achieved_at')
        .eq('user_id', userId)
        .gte('achieved_at', sinceThis).lt('achieved_at', untilThis)
        .order('achieved_at', { ascending: false }),
      supabase.from('daily_weigh_ins')
        .select('weight, created_at')
        .eq('user_id', userId).gte('created_at', sinceFour)
        .order('created_at', { ascending: true }),
      supabase.from('stories')
        .select('id, created_at, media_type')
        .eq('user_id', userId)
        .gte('created_at', sinceThis).lt('created_at', untilThis),
      supabase.from('activity_logs')
        .select('duration_minutes, estimated_calories, activity_date, activity_type')
        .eq('user_id', userId).gte('activity_date', sinceFourDate),
      supabase.from('quiz_battles')
        .select('id, challenger_id, opponent_id, winner_id, status, created_at')
        .or('challenger_id.eq.' + userId + ',opponent_id.eq.' + userId)
        .gte('created_at', sinceThis).lt('created_at', untilThis),
      supabase.from('lesson_completions')
        .select('xp_earned, completed_at')
        .eq('user_id', userId)
        .gte('completed_at', sinceThis).lt('completed_at', untilThis),
      supabase.from('point_transactions')
        .select('points_amount, transaction_type, created_at')
        .eq('user_id', userId).gt('points_amount', 0)
        .gte('created_at', sinceThis).lt('created_at', untilThis),
      supabase.from('coin_transactions')
        .select('amount, created_at')
        .eq('user_id', userId).gt('amount', 0)
        .gte('created_at', sinceThis).lt('created_at', untilThis),
      supabase.from('meal_logs')
        .select('meal_date, calories, created_at')
        .eq('user_id', userId)
        .gte('meal_date', sinceThisDate).lt('meal_date', untilThisDate),
      supabase.from('weekly_goals')
        .select('id, selected_goals, progress_snapshot, arc_snapshot, completed_count, total_count, completion_rate, points_awarded, points_awarded_amount, points_awarded_at')
        .eq('user_id', userId)
        .eq('week_start', sinceThisDate)
        .maybeSingle(),
    ]);

    const [
      workoutsR, moodR, pbsR, weighsR, storiesR,
      activityR, battlesR, lessonsR, pointsR, coinsR, mealsR, weeklyGoalsR,
    ] = results;

    const pick = r => (r.status === 'fulfilled' && r.value && Array.isArray(r.value.data)) ? r.value.data : [];
    const workouts = pick(workoutsR);
    const moodLogs = pick(moodR);
    const pbs = pick(pbsR);
    const weighs = pick(weighsR);
    const stories = pick(storiesR);
    const activity = pick(activityR);
    const battles = pick(battlesR);
    const lessons = pick(lessonsR);
    const pointTransactions = pick(pointsR);
    const coins = pick(coinsR);
    const meals = pick(mealsR);
    const weeklyGoalRow = (weeklyGoalsR.status === 'fulfilled' && weeklyGoalsR.value && !weeklyGoalsR.value.error)
      ? weeklyGoalsR.value.data
      : null;
    const weeklyGoals = buildWeeklyGoalsSummary(weeklyGoalRow, userId, sinceThisDate);

    // Reactions received on user's stories this week (two-step)
    let reactionsCount = 0;
    if (stories.length > 0) {
      try {
        const ids = stories.map(s => s.id);
        const { data: rxs } = await supabase
          .from('feed_reactions')
          .select('id')
          .in('story_id', ids);
        reactionsCount = (rxs || []).length;
      } catch(_){}
    }

    // ---- Week slicing ----
    const inThisWeek = r => {
      const t = new Date(r.created_at || r.logged_at || r.achieved_at || r.completed_at || r.activity_date).getTime();
      return t >= thisWeekStart.getTime() && t < thisWeekEnd.getTime();
    };
    const inLastWeek = r => {
      const t = new Date(r.created_at || r.logged_at || r.achieved_at || r.completed_at || r.activity_date).getTime();
      return t >= lastWeekStart.getTime() && t < thisWeekStart.getTime();
    };

    // Slice workouts by `workout_date` (the day the session happened), NOT
    // `created_at` (the row insert time). Otherwise a workout done last
    // Friday but logged this Monday would count toward the wrong week.
    const lastWeekStartStr = formatDate(lastWeekStartBrisbane);
    const workoutsThis = workouts.filter(w => w.workout_date >= sinceThisDate && w.workout_date < untilThisDate);
    const workoutsLast = workouts.filter(w => w.workout_date >= lastWeekStartStr && w.workout_date < sinceThisDate);
    const workoutDatesThis = [...new Set(workoutsThis.map(w => w.workout_date))];
    const workoutDatesLast = [...new Set(workoutsLast.map(w => w.workout_date))];

    // Minutes — activities have explicit duration; workouts estimate 45min each
    const activityThis = activity.filter(a => {
      const d = a.activity_date || '';
      return d >= sinceThisDate && d < untilThisDate;
    });
    const activityMin = activityThis.reduce((s, a) => s + (a.duration_minutes || 0), 0);
    const workoutMin = workoutDatesThis.length * 45;
    const totalMinutes = activityMin + workoutMin;

    // Mood
    const moodThis = moodLogs.filter(inThisWeek);
    const moodLast = moodLogs.filter(inLastWeek);
    const avgMood = moodThis.length ? round1(moodThis.reduce((s,m)=>s+(m.mood_score||0), 0) / moodThis.length) : null;
    const avgMoodLast = moodLast.length ? round1(moodLast.reduce((s,m)=>s+(m.mood_score||0), 0) / moodLast.length) : null;
    const dailyMood = buildDailyMoodArc(moodThis, thisWeekStart);

    // Weight
    const weighsThisWeek = weighs.filter(w => {
      const t = new Date(w.created_at).getTime();
      return t >= thisWeekStart.getTime() && t < thisWeekStart.getTime() + 7 * DAY_MS;
    });
    let weightChange = null;
    let latestWeight = null;
    if (weighsThisWeek.length >= 2) {
      weightChange = round1(weighsThisWeek[weighsThisWeek.length - 1].weight - weighsThisWeek[0].weight);
      latestWeight = weighsThisWeek[weighsThisWeek.length - 1].weight;
    } else if (weighsThisWeek.length === 1) {
      latestWeight = weighsThisWeek[0].weight;
    } else if (weighs.length > 0) {
      latestWeight = weighs[weighs.length - 1].weight;
    }

    // Meals / calories
    const mealsCount = meals.length;
    const mealDays = new Set(meals.map(m => m.meal_date).filter(Boolean));
    const trackedMealDays = mealDays.size;
    const nutritionWindowDays = 7;
    const caloriesAvg = trackedMealDays >= Math.ceil(nutritionWindowDays / 2)
      ? Math.round(meals.reduce((s, m) => s + (m.calories || 0), 0) / trackedMealDays)
      : null;

    // Streak (consecutive days ending today or yesterday)
    const allWorkoutDates = [...new Set(workouts.map(w => w.workout_date))].filter(Boolean);
    const streak = computeStreak(allWorkoutDates);

    // Quiz battles
    const battlesComplete = battles.filter(b => b.status === 'complete' || b.status === 'completed');
    const battlesWon = battlesComplete.filter(b => b.winner_id === userId).length;

    // XP + coins. The normal Balance points ledger covers meals, weigh-ins,
    // photos, workouts and bonuses; lesson completions are stored separately.
    const ledgerXp = pointTransactions.reduce((s, p) => s + Number(p.points_amount || 0), 0);
    const lessonXp = lessons.reduce((s, l) => s + Number(l.xp_earned || 0), 0);
    const xp = ledgerXp + lessonXp;
    const coinsEarned = coins.reduce((s, c) => s + (c.amount || 0), 0);

    // ---- Trend-line predictions (last 4 weeks) ----
    const workoutsByWeek = binByWeek(workouts, thisWeekStart, 4, 'workout_date')
      .map(group => new Set(group.map(w => w.workout_date)).size);
    const predictionWorkouts = predictNext(workoutsByWeek);
    const workoutTrend = trendDirection(workoutsByWeek);

    const moodByWeek = binByWeek(moodLogs, thisWeekStart, 4, 'logged_at').map(group => {
      if (!group.length) return null;
      return round1(group.reduce((s, m) => s + (m.mood_score || 0), 0) / group.length);
    });
    const predictionMood = predictNext(moodByWeek);
    const moodTrend = trendDirection(moodByWeek);

    const weightPrediction = predictNextWeight(weighs);

    return {
      user_id: userId,
      iso_week: getISOWeek(thisWeekStartBrisbane),
      generated_at: new Date().toISOString(),
      week_start: thisWeekStartBrisbane.toISOString(),
      workouts: {
        this_week: workoutDatesThis.length,
        last_week: workoutDatesLast.length,
        delta: workoutDatesThis.length - workoutDatesLast.length,
      },
      minutes: { total: totalMinutes, from_activities: activityMin, from_workouts: workoutMin },
      pbs: {
        count: pbs.length,
        items: pbs.slice(0, 4).map(p => ({
          name: p.exercise_name,
          value: p.new_value,
          type: p.pb_type,
          improvement: p.improvement,
        })),
      },
      mood: {
        avg: avgMood,
        last_week_avg: avgMoodLast,
        logs: moodThis.length,
        daily: dailyMood,
      },
      weight: { change: weightChange, latest: latestWeight },
      nutrition: {
        meals_logged: mealsCount,
        avg_calories: caloriesAvg,
        tracked_days: trackedMealDays,
        window_days: nutritionWindowDays,
      },
      social: { posts: stories.length, reactions_received: reactionsCount },
      goals: weeklyGoals,
      streak: streak,
      battles: { played: battlesComplete.length, won: battlesWon },
      xp: xp,
      coins: coinsEarned,
      predictions: {
        next_week_workouts: predictionWorkouts,
        workout_trend: workoutTrend,
        next_week_mood: predictionMood,
        mood_trend: moodTrend,
        next_week_weight: weightPrediction,
        workouts_per_week_history: workoutsByWeek,
      },
    };
  }

  function clampWeeklyGoalCount(value){
    const number = Math.floor(Number(value || 0));
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(3, number));
  }

  function calculateWeeklyGoalReward(completed, total){
    const safeCompleted = clampWeeklyGoalCount(completed);
    const safeTotal = clampWeeklyGoalCount(total);
    const max = Math.min(
      WEEKLY_GOAL_XP_CAP,
      (safeTotal * WEEKLY_GOAL_XP_PER_GOAL) + (safeTotal >= 3 ? WEEKLY_GOAL_ALL_HIT_BONUS : 0)
    );
    const earned = Math.min(
      WEEKLY_GOAL_XP_CAP,
      (safeCompleted * WEEKLY_GOAL_XP_PER_GOAL) + (safeCompleted >= 3 && safeTotal >= 3 ? WEEKLY_GOAL_ALL_HIT_BONUS : 0)
    );
    return { earned, max };
  }

  function normalizeRpcJson(value){
    if (!value) return {};
    if (typeof value === 'string') {
      try { return JSON.parse(value); }
      catch(_) { return {}; }
    }
    return value;
  }

  async function maybeAwardWeeklyGoalsInWrappedData(data){
    if (!data || !data.goals || !data.goals.reward || data.goals.total <= 0) return null;
    const supabase = window.supabaseClient;
    if (!supabase || typeof supabase.rpc !== 'function') return null;

    try {
      const weekStartDate = formatDate(new Date(data.week_start));
      const { data: rpcData, error } = await supabase.rpc('award_weekly_goal_points', {
        p_week_start: weekStartDate
      });
      if (error) throw error;

      const result = normalizeRpcJson(rpcData);
      const pointsAwarded = Math.max(0, Number(result.pointsAwarded || result.points_awarded || 0));
      const totalWeeklyGoalPoints = Math.max(
        data.goals.reward.awarded || 0,
        Number(result.totalWeeklyGoalPoints || result.total_weekly_goal_points || 0)
      );
      const maxPoints = Math.max(
        data.goals.reward.max || 0,
        Number(result.maxWeeklyGoalPoints || result.max_weekly_goal_points || 0)
      );

      data.goals.reward = Object.assign({}, data.goals.reward, {
        awarded: Math.min(WEEKLY_GOAL_XP_CAP, totalWeeklyGoalPoints),
        just_awarded: Math.min(WEEKLY_GOAL_XP_CAP, pointsAwarded),
        max: Math.min(WEEKLY_GOAL_XP_CAP, maxPoints),
        all_goals_hit: Boolean(result.allGoalsHit || result.all_goals_hit || data.goals.reward.all_goals_hit),
        ready: result.success !== false
      });

      if (pointsAwarded > 0) {
        if (typeof window.loadUserPoints === 'function') {
          window.loadUserPoints();
        } else if (typeof window.refreshLevelDisplay === 'function') {
          window.refreshLevelDisplay();
        }
      }

      return Object.assign({}, result, {
        pointsAwarded: pointsAwarded,
        totalWeeklyGoalPoints: data.goals.reward.awarded,
        maxWeeklyGoalPoints: data.goals.reward.max,
        completedCount: Number(result.completedCount || result.completed_count || data.goals.completed),
        totalCount: Number(result.totalCount || result.total_count || data.goals.total),
        allGoalsHit: Boolean(result.allGoalsHit || result.all_goals_hit)
      });
    } catch (error) {
      console.warn('[weekly-wrapped] weekly goal reward failed', error);
      return null;
    }
  }

  function prettifyGoalId(goalId) {
    return String(goalId || '')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, function(match) {
        return match.toUpperCase();
      });
  }

  function getWeeklyGoalLookup() {
    const lookup = {};
    const catalog = window.weeklyGoals && typeof window.weeklyGoals.getCatalog === 'function'
      ? window.weeklyGoals.getCatalog()
      : null;
    if (!Array.isArray(catalog)) return lookup;
    catalog.forEach(group => {
      const goals = group && Array.isArray(group.goals) ? group.goals : [];
      goals.forEach(goal => {
        if (!goal || !goal.id) return;
        lookup[goal.id] = Object.assign({ category: group.category || '' }, goal);
      });
    });
    return lookup;
  }

  function buildWeeklyGoalsSummary(row, userId, weekStartDate, rewardResult){
    const liveState = window.weeklyGoals && typeof window.weeklyGoals.getState === 'function'
      ? window.weeklyGoals.getState()
      : null;
    const liveWeekStart = liveState && liveState.week && liveState.week.start ? liveState.week.start : null;
    const liveMatchesReviewWeek = Boolean(weekStartDate && liveWeekStart && liveWeekStart === weekStartDate);
    const localRow = readWeeklyGoalsSnapshot(userId, weekStartDate);
    const liveRow = liveMatchesReviewWeek && liveState && liveState.row && typeof liveState.row === 'object'
      ? liveState.row
      : null;
    // Prefer the week being reviewed, not whichever week the home card has
    // already rolled to. Fall back to the persisted snapshot for that exact week.
    const sourceRow = liveRow || localRow || row;
    if (!sourceRow) return { total: 0, completed: 0, completion_rate: 0, items: [], arc: null };
    const goalLookup = getWeeklyGoalLookup();
    const selected = liveMatchesReviewWeek && Array.isArray(liveState.selected) && liveState.selected.length
      ? liveState.selected
      : (Array.isArray(sourceRow.selected_goals) ? sourceRow.selected_goals : []);
    const snapshot = liveMatchesReviewWeek && liveState.progress && Array.isArray(liveState.progress.goals)
      ? liveState.progress
      : (sourceRow.progress_snapshot && typeof sourceRow.progress_snapshot === 'object' ? sourceRow.progress_snapshot : {});
    const snapshotItems = Array.isArray(snapshot.goals) ? snapshot.goals : [];
    const items = selected.map(goal => {
      const goalId = typeof goal === 'string'
        ? goal
        : goal && (goal.id || goal.goal_id || goal.goalId);
      const progress = snapshotItems.find(item => {
        const itemId = item && (item.id || item.goal_id || item.goalId);
        return goalId && itemId === goalId;
      }) || {};
      const goalDef = goalId && goalLookup[goalId] ? goalLookup[goalId] : null;
      return {
        id: goalId || (goal && goal.id) || progress.id || prettifyGoalId(goalId) || 'goal',
        label: (goal && goal.label) || (goalDef && goalDef.label) || progress.label || prettifyGoalId(goalId) || 'Goal',
        category: (goal && goal.category) || (goalDef && goalDef.category) || progress.category || '',
        current: progress.current != null ? progress.current : 0,
        target: progress.target != null
          ? progress.target
          : (goal && goal.target != null ? goal.target : (goalDef && goalDef.target)),
        unit: (goal && goal.unit) || (goalDef && goalDef.unit) || progress.unit || '',
        complete: !!progress.complete
      };
    });
    const total = items.length || clampWeeklyGoalCount(sourceRow.total_count);
    const completed = items.length
      ? Math.min(total, items.filter(item => item.complete).length)
      : Math.min(total, clampWeeklyGoalCount(sourceRow.completed_count));
    const reward = calculateWeeklyGoalReward(completed, total);
    const awarded = Math.max(
      Number(sourceRow.points_awarded_amount || 0),
      Number(rewardResult && (rewardResult.totalWeeklyGoalPoints || rewardResult.total_weekly_goal_points) || 0)
    );
    const justAwarded = Number(rewardResult && (rewardResult.pointsAwarded || rewardResult.points_awarded) || 0);
    return {
      total: total,
      completed: completed,
      completion_rate: total ? Math.round((completed / total) * 100) : 0,
      items: items,
      arc: sourceRow.arc_snapshot && typeof sourceRow.arc_snapshot === 'object' ? sourceRow.arc_snapshot : null,
      reward: {
        earned: reward.earned,
        awarded: Math.max(0, Math.min(WEEKLY_GOAL_XP_CAP, awarded)),
        just_awarded: Math.max(0, Math.min(WEEKLY_GOAL_XP_CAP, justAwarded)),
        max: reward.max,
        all_goals_hit: total > 0 && completed >= total,
        ready: Boolean(rewardResult && rewardResult.success !== false)
      }
    };
  }

  function buildDailyMoodArc(logs, weekStart){
    const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    return labels.map((label, i) => {
      const dayStart = new Date(weekStart.getTime() + i * DAY_MS);
      const ds = formatDate(dayStart);
      const dayLogs = logs.filter(m => {
        const ld = formatDate(new Date(m.logged_at));
        return ld === ds;
      });
      const avg = dayLogs.length
        ? round1(dayLogs.reduce((s, m) => s + (m.mood_score || 0), 0) / dayLogs.length)
        : null;
      return { day: label, date: ds, avg };
    });
  }

  function computeStreak(dates){
    if (!dates.length) return 0;
    const set = new Set(dates);
    let streak = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    // If today isn't logged, start from yesterday
    if (!set.has(formatDate(cursor))) cursor.setDate(cursor.getDate() - 1);
    for (let i = 0; i < 365; i++) {
      if (set.has(formatDate(cursor))) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }

  function binByWeek(rows, thisWeekStart, weeks, field){
    const bins = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const start = new Date(thisWeekStart.getTime() - i * 7 * DAY_MS);
      const end = new Date(start.getTime() + 7 * DAY_MS);
      bins.push(rows.filter(r => {
        const t = new Date(r[field]).getTime();
        return t >= start.getTime() && t < end.getTime();
      }));
    }
    return bins;
  }

  // ============================================================
  //  Trend-line predictions (simple linear regression)
  // ============================================================

  function predictNext(values){
    const clean = values.filter(v => v != null).map(Number);
    if (clean.length < 2) return clean[0] != null ? clean[0] : null;
    const n = clean.length;
    const xs = clean.map((_, i) => i);
    const xMean = xs.reduce((s,x)=>s+x, 0) / n;
    const yMean = clean.reduce((s,y)=>s+y, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - xMean) * (clean[i] - yMean);
      den += (xs[i] - xMean) ** 2;
    }
    if (den === 0) return round1(clean[clean.length - 1]);
    const slope = num / den;
    const intercept = yMean - slope * xMean;
    const next = slope * n + intercept;
    return Math.max(0, round1(next));
  }

  function predictNextWeight(weighs){
    if (weighs.length < 3) return null;
    const recent = weighs.slice(-12);
    const firstT = new Date(recent[0].created_at).getTime();
    const xs = recent.map(w => (new Date(w.created_at).getTime() - firstT) / DAY_MS);
    const ys = recent.map(w => Number(w.weight));
    const n = xs.length;
    const xMean = xs.reduce((s,x)=>s+x, 0) / n;
    const yMean = ys.reduce((s,y)=>s+y, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - xMean) * (ys[i] - yMean);
      den += (xs[i] - xMean) ** 2;
    }
    if (den === 0) return null;
    const slopePerDay = num / den;
    const weeklyDelta = round1(slopePerDay * 7);
    const projected = round1(recent[recent.length - 1].weight + weeklyDelta);
    return { projected, weekly_delta: weeklyDelta };
  }

  function trendDirection(values){
    const clean = values.filter(v => v != null);
    if (clean.length < 2) return 'flat';
    const first = clean[0];
    const last = clean[clean.length - 1];
    if (first === 0 && last === 0) return 'flat';
    if (first === 0) return last > 0 ? 'up' : 'flat';
    const pct = (last - first) / Math.max(first, 0.5);
    if (pct > 0.15) return 'up';
    if (pct < -0.15) return 'down';
    return 'flat';
  }

  // ============================================================
  //  Local seen-state
  // ============================================================

  function hasSeen(isoWeek){
    try { return !!localStorage.getItem(SEEN_KEY_PREFIX + isoWeek); }
    catch(_) { return false; }
  }
  function markSeen(isoWeek){
    try { localStorage.setItem(SEEN_KEY_PREFIX + isoWeek, String(Date.now())); }
    catch(_) {}
  }
  // Returns the ISO week of the Mon–Sun being REVIEWED, not the calendar
  // week of "right now". Keeps seen-flags + auto-open dedup consistent
  // across the Sun 09:00 -> Mon 12:00 Brisbane window.
  function getCurrentISOWeek(){ return getISOWeek(getWrappedWeekStart(getBrisbaneWallClockDate(new Date()))); }

  // ============================================================
  //  Music — 8 procedural themes rotated by ISO week
  //
  //  No audio files. Each theme is a `scheduleBar(barStart, barIdx)`
  //  fn that schedules its own kick/hat/bass/etc via shared utils.
  //  The scheduler keeps a 0.6s lookahead so mobile throttling or
  //  a GC pause won't leave a dead gap between loops, and a
  //  visibilitychange listener re-resumes the AudioContext if it
  //  gets suspended (happens on iOS when the app backgrounds).
  //
  //  Themes (cycle by ISO-week number % 8):
  //    0 Synthwave · 1 Chiptune · 2 Lo-Fi · 3 Phonk
  //    4 Drum & Bass · 5 Jazz · 6 Techno · 7 Trap
  //
  //  Autoplay: iOS Safari blocks AudioContext before a user
  //  gesture. We create it in open(), try to resume, and if it
  //  stays suspended the music button pulses and resumes it on
  //  the user's first tap.
  // ============================================================

  const MUTED_KEY = 'pbb_wrapped_muted';

  // ── Shared sound utilities ──────────────────────────────────

  function makeSoundUtils(ctx, master){
    function kick(t, opts){
      opts = opts || {};
      const pitch = opts.pitch || 130;
      const pitchEnd = opts.pitchEnd || 35;
      const gain = opts.gain != null ? opts.gain : 0.9;
      const dur = opts.dur || 0.2;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, t);
      osc.frequency.exponentialRampToValueAtTime(pitchEnd, t + 0.12);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g).connect(master);
      osc.start(t); osc.stop(t + dur + 0.02);
    }
    function snare(t, opts){
      opts = opts || {};
      const gain = opts.gain != null ? opts.gain : 0.3;
      const dur = opts.dur || 0.12;
      const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(bp).connect(g).connect(master);
      src.start(t);
      // body tone
      const osc = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + dur);
      g2.gain.setValueAtTime(gain * 0.3, t);
      g2.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g2).connect(master);
      osc.start(t); osc.stop(t + dur + 0.02);
    }
    function hat(t, opts){
      opts = opts || {};
      const gain = opts.gain != null ? opts.gain : 0.14;
      const dur = opts.dur || 0.035;
      const hp = opts.hp || 7500;
      const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = hp;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f).connect(g).connect(master);
      src.start(t);
    }
    function cowbell(t, opts){
      opts = opts || {};
      const gain = opts.gain != null ? opts.gain : 0.1;
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      o1.type = 'square'; o1.frequency.value = 560;
      o2.type = 'square'; o2.frequency.value = 845;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o1.connect(g); o2.connect(g); g.connect(master);
      o1.start(t); o2.start(t);
      o1.stop(t + 0.28); o2.stop(t + 0.28);
    }
    function tone(t, freq, opts){
      opts = opts || {};
      const wave = opts.wave || 'sawtooth';
      const dur = opts.dur || 0.2;
      const gain = opts.gain != null ? opts.gain : 0.3;
      const cutoff = opts.cutoff || 2000;
      const q = opts.q || 1;
      const osc = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = wave;
      osc.frequency.value = freq;
      lp.type = 'lowpass'; lp.frequency.value = cutoff; lp.Q.value = q;
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(lp).connect(g).connect(master);
      osc.start(t); osc.stop(t + dur + 0.04);
    }
    function chord(t, freqs, opts){
      freqs.forEach(f => tone(t, f, opts));
    }
    return { kick, snare, hat, cowbell, tone, chord };
  }

  // ── Theme definitions ───────────────────────────────────────

  const THEMES = [
    {
      id: 'synthwave', name: 'Synthwave', bpm: 126, bars: 4, gain: 0.42,
      scheduleBar(u, barStart, barIdx, beat){
        const roots = [110.00, 87.31, 130.81, 98.00]; // Am-F-C-G
        const root = roots[barIdx];
        const fifth = root * 1.498, third = root * 1.189;
        for (let i = 0; i < 4; i++) u.kick(barStart + i * beat);
        for (let i = 0; i < 8; i++) u.hat(barStart + (i + 0.5) * (beat / 2));
        const pat = [root, root, fifth, root, root, root, fifth, root];
        for (let i = 0; i < 8; i++)
          u.tone(barStart + i * (beat/2), pat[i], { wave: 'sawtooth', dur: 0.17, gain: 0.38, cutoff: 650 });
        const notes = [root*2, third*2, fifth*2, root*4];
        for (let i = 0; i < 4; i++)
          u.tone(barStart + 3*beat + i*(beat/4), notes[i], { wave: 'square', dur: 0.11, gain: 0.08, cutoff: 4000 });
      },
    },
    {
      id: 'chiptune', name: 'Chiptune', bpm: 140, bars: 4, gain: 0.38,
      scheduleBar(u, barStart, barIdx, beat){
        const roots = [130.81, 174.61, 196.00, 220.00]; // C-F-G-Am
        const root = roots[barIdx];
        u.kick(barStart); u.kick(barStart + 2*beat);
        u.snare(barStart + beat, { gain: 0.22 });
        u.snare(barStart + 3*beat, { gain: 0.22 });
        for (let i = 0; i < 8; i++)
          u.tone(barStart + i*(beat/2), root/2, { wave: 'square', dur: 0.14, gain: 0.22, cutoff: 1400 });
        const intervals = [0, 4, 7, 12];
        for (let i = 0; i < 16; i++){
          const interval = intervals[i % 4];
          const freq = root * Math.pow(2, interval/12);
          u.tone(barStart + i*(beat/4), freq, { wave: 'square', dur: 0.08, gain: 0.09, cutoff: 4500 });
        }
      },
    },
    {
      id: 'lofi', name: 'Lo-Fi', bpm: 82, bars: 4, gain: 0.5,
      scheduleBar(u, barStart, barIdx, beat){
        const roots = [87.31, 82.41, 73.42, 65.41]; // F-E-D-C maj7-ish pad
        const root = roots[barIdx];
        u.kick(barStart, { gain: 0.75, pitch: 100 });
        u.kick(barStart + 2*beat + beat*0.667, { gain: 0.55 });
        u.snare(barStart + 2*beat, { gain: 0.22 });
        for (let i = 0; i < 8; i++){
          const swing = (i % 2 === 1) ? 0.667 : 0.5;
          u.hat(barStart + Math.floor(i/2)*beat + swing*beat, { gain: 0.07 });
        }
        u.tone(barStart, root, { wave: 'triangle', dur: 3.5, gain: 0.28, cutoff: 420 });
        const maj7 = [root, root*1.26, root*1.498, root*1.888];
        u.chord(barStart, maj7, { wave: 'sine', dur: 1.8, gain: 0.06, cutoff: 1200 });
        u.chord(barStart + 2*beat, maj7, { wave: 'sine', dur: 1.8, gain: 0.05, cutoff: 1200 });
      },
    },
    {
      id: 'phonk', name: 'Phonk', bpm: 130, bars: 4, gain: 0.46,
      scheduleBar(u, barStart, barIdx, beat){
        const roots = [82.41, 82.41, 87.31, 73.42]; // E-E-F-D
        const root = roots[barIdx];
        u.kick(barStart, { pitch: 90, pitchEnd: 30, gain: 1.0, dur: 0.3 });
        u.kick(barStart + 1.5*beat, { pitch: 90, pitchEnd: 30, gain: 0.85, dur: 0.25 });
        u.kick(barStart + 2.5*beat, { pitch: 90, pitchEnd: 30, gain: 0.9, dur: 0.25 });
        u.kick(barStart + 3.5*beat, { pitch: 90, pitchEnd: 30, gain: 0.75, dur: 0.2 });
        for (let i = 0; i < 12; i++)
          u.hat(barStart + i*(beat/3), { gain: 0.1, dur: 0.035 });
        u.cowbell(barStart + beat, { gain: 0.07 });
        u.cowbell(barStart + 3*beat, { gain: 0.07 });
        u.tone(barStart, root/2, { wave: 'sine', dur: 1.9, gain: 0.5, cutoff: 260 });
        u.tone(barStart + 2*beat, root/2, { wave: 'sine', dur: 1.9, gain: 0.5, cutoff: 260 });
      },
    },
    {
      id: 'dnb', name: 'Drum & Bass', bpm: 174, bars: 2, gain: 0.4,
      scheduleBar(u, barStart, barIdx, beat){
        const roots = [110, 98];
        const root = roots[barIdx % 2];
        u.kick(barStart);
        u.kick(barStart + 2.5*beat);
        u.snare(barStart + beat, { gain: 0.38 });
        u.snare(barStart + 3*beat, { gain: 0.38 });
        for (let i = 0; i < 16; i++)
          u.hat(barStart + i*(beat/4), { gain: 0.07 + (i%2 === 0 ? 0.04 : 0) });
        // Reese (detuned saws)
        u.tone(barStart, root/2, { wave: 'sawtooth', dur: 1.7, gain: 0.26, cutoff: 500, q: 3 });
        u.tone(barStart, root/2 * 1.007, { wave: 'sawtooth', dur: 1.7, gain: 0.26, cutoff: 500, q: 3 });
      },
    },
    {
      id: 'jazz', name: 'Jazz', bpm: 95, bars: 4, gain: 0.48,
      scheduleBar(u, barStart, barIdx, beat){
        const roots = [73.42, 98, 65.41, 110]; // Dm7-G7-Cmaj7-Am7
        const root = roots[barIdx];
        for (let i = 0; i < 8; i++){
          const swingOff = (i % 2 === 1) ? 0.667 : 0;
          u.hat(barStart + Math.floor(i/2)*beat + swingOff*beat, { gain: 0.1, dur: 0.05 });
        }
        u.kick(barStart, { gain: 0.55, pitch: 100 });
        u.kick(barStart + 2*beat, { gain: 0.5, pitch: 100 });
        const walk = [root, root*1.189, root*1.498, root*1.888];
        for (let i = 0; i < 4; i++)
          u.tone(barStart + i*beat, walk[i]/2, { wave: 'triangle', dur: 0.45, gain: 0.36, cutoff: 520 });
        const ch = [root, root*1.189, root*1.498, root*1.888];
        u.chord(barStart, ch, { wave: 'triangle', dur: 0.4, gain: 0.09, cutoff: 1800 });
        u.chord(barStart + 2*beat, ch, { wave: 'triangle', dur: 0.4, gain: 0.09, cutoff: 1800 });
      },
    },
    {
      id: 'techno', name: 'Techno', bpm: 128, bars: 4, gain: 0.42,
      scheduleBar(u, barStart, barIdx, beat){
        const root = 55.00; // A1 drone
        for (let i = 0; i < 4; i++) u.kick(barStart + i*beat, { gain: 1.0, pitch: 130 });
        for (let i = 0; i < 16; i++)
          u.hat(barStart + i*(beat/4), { gain: (i%4 === 2 ? 0.14 : 0.06) });
        if (barIdx % 2 === 1){
          u.snare(barStart + beat, { gain: 0.22 });
          u.snare(barStart + 3*beat, { gain: 0.22 });
        }
        // Acid bass — TB-303-ish, cutoff sweeps across the bar
        const pattern = [0, 0, 7, 0, 0, 3, 5, 0, 0, 7, 3, 0, 0, 0, 5, 0];
        for (let i = 0; i < 16; i++){
          const freq = root * Math.pow(2, pattern[i]/12);
          u.tone(barStart + i*(beat/4), freq, {
            wave: 'sawtooth', dur: 0.12, gain: 0.26,
            cutoff: 400 + (i*70), q: 5,
          });
        }
      },
    },
    {
      id: 'trap', name: 'Trap', bpm: 140, bars: 2, gain: 0.45,
      scheduleBar(u, barStart, barIdx, beat){
        const roots = [110, 98]; // Am, G
        const root = roots[barIdx % 2];
        u.kick(barStart, { gain: 1.0, dur: 0.4, pitch: 90, pitchEnd: 25 });
        u.kick(barStart + 2.5*beat, { gain: 0.85, dur: 0.35 });
        u.snare(barStart + beat, { gain: 0.3 });
        u.snare(barStart + 3*beat, { gain: 0.3 });
        // Hat rolls — 32nd notes, bursts on beat 4
        for (let i = 0; i < 32; i++){
          const inBurst = (i >= 12 && i < 16) || (i >= 28 && i < 32);
          u.hat(barStart + i*(beat/8), { gain: inBurst ? 0.05 : 0.1, dur: 0.02 });
        }
        u.tone(barStart, root/4, { wave: 'sine', dur: 2.3, gain: 0.55, cutoff: 230 });
      },
    },
  ];

  function pickWrappedTheme(isoWeek){
    const m = /W(\d+)/.exec(isoWeek || '');
    const n = m ? parseInt(m[1], 10) : 0;
    return THEMES[((n % THEMES.length) + THEMES.length) % THEMES.length];
  }

  function createWrappedSynth(theme){
    theme = theme || THEMES[0];
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;

    let ctx;
    try { ctx = new Ctx(); } catch(_) { return null; }

    const master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);

    const u = makeSoundUtils(ctx, master);

    const beat = 60 / theme.bpm;
    const bar = beat * 4;
    const bars = theme.bars || 4;
    const loopLen = bar * bars;

    function scheduleLoop(startAt){
      for (let b = 0; b < bars; b++){
        theme.scheduleBar(u, startAt + b * bar, b, beat);
      }
    }

    let running = true;
    let nextLoopAt = ctx.currentTime;
    let tickId = null;

    function tick(){
      if (!running) return;
      // Generous 0.6s lookahead — survives mobile Safari throttling and
      // GC hitches without leaving a dead gap at the loop boundary.
      if (ctx.currentTime + 0.6 >= nextLoopAt){
        const start = Math.max(ctx.currentTime + 0.05, nextLoopAt);
        scheduleLoop(start);
        nextLoopAt = start + loopLen;
      }
      tickId = setTimeout(tick, 80);
    }
    tick();

    // If iOS quietly suspends the context mid-playback (e.g. the phone's
    // mute switch toggles, the app loses focus briefly, etc.), this wakes
    // it up as soon as the page is visible + the user is back.
    const onVisibilityChange = () => {
      if (!running) return;
      if (ctx.state === 'suspended') {
        try { ctx.resume(); } catch(_){}
      }
    };
    try { document.addEventListener('visibilitychange', onVisibilityChange); } catch(_){}

    const targetVol = theme.gain || 0.42;

    return {
      ctx,
      theme,
      setMuted(m){
        const v = m ? 0.0001 : targetVol;
        try { master.gain.cancelScheduledValues(ctx.currentTime); } catch(_){}
        master.gain.setTargetAtTime(v, ctx.currentTime, 0.08);
      },
      fadeIn(){
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(0.0001, ctx.currentTime);
        master.gain.exponentialRampToValueAtTime(targetVol, ctx.currentTime + 0.6);
      },
      resume(){ try { return ctx.resume(); } catch(_) {} },
      state(){ return ctx.state; },
      stop(){
        running = false;
        if (tickId) clearTimeout(tickId);
        try { document.removeEventListener('visibilitychange', onVisibilityChange); } catch(_){}
        try {
          master.gain.cancelScheduledValues(ctx.currentTime);
          master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
        } catch(_){}
        setTimeout(() => { try { ctx.close(); } catch(_){} }, 400);
      }
    };
  }

  function isMutedPref(){
    try { return localStorage.getItem(MUTED_KEY) === '1'; } catch(_) { return false; }
  }
  function setMutedPref(m){
    try {
      if (m) localStorage.setItem(MUTED_KEY, '1');
      else localStorage.removeItem(MUTED_KEY);
    } catch(_) {}
  }

  // ============================================================
  //  Archive to weekly_wrapped table (best-effort)
  // ============================================================

  async function upsertSnapshot(userId, data){
    const supabase = window.supabaseClient;
    if (!supabase || !userId) return;
    try {
      await supabase.from('weekly_wrapped').upsert({
        user_id: userId,
        iso_week: data.iso_week,
        data_snapshot: data,
        generated_at: data.generated_at,
      }, { onConflict: 'user_id,iso_week' });
    } catch(e) { /* non-fatal */ }
  }

  async function markViewed(userId, isoWeek){
    const supabase = window.supabaseClient;
    if (!supabase || !userId) return;
    try {
      await supabase.from('weekly_wrapped')
        .update({ viewed_at: new Date().toISOString() })
        .eq('user_id', userId).eq('iso_week', isoWeek);
    } catch(_){}
  }

  // ============================================================
  //  UI — styles, slide engine, open()
  // ============================================================

  function ensureStyles(){
    if (document.getElementById('ww-styles')) return;
    const style = document.createElement('style');
    style.id = 'ww-styles';
    style.textContent = WW_STYLES;
    document.head.appendChild(style);
  }

  const WW_STYLES = `
    .ww-overlay {
      position: fixed; inset: 0; z-index: 99998;
      background: #050505;
      overflow: hidden;
      padding-top: env(safe-area-inset-top, 0px);
      padding-bottom: env(safe-area-inset-bottom, 0px);
      box-sizing: border-box;
      color: #fff;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      touch-action: manipulation;
      user-select: none; -webkit-user-select: none;
    }
    .ww-progress {
      position: absolute;
      top: calc(env(safe-area-inset-top, 0px) + 10px);
      left: 14px; right: 60px;
      display: flex; gap: 4px; z-index: 10;
    }
    .ww-progress-bar {
      flex: 1; height: 3px;
      background: rgba(255,255,255,0.25);
      border-radius: 2px; overflow: hidden;
    }
    .ww-progress-bar-fill {
      height: 100%; background: #fff; width: 0%;
    }
    .ww-progress-bar.seen .ww-progress-bar-fill { width: 100%; }
    .ww-progress-bar.current .ww-progress-bar-fill {
      animation: wwProgressFill var(--dur, 5.2s) linear forwards;
    }
    .ww-progress-bar.paused .ww-progress-bar-fill {
      animation-play-state: paused;
    }
    @keyframes wwProgressFill { from { width: 0%; } to { width: 100%; } }

    .ww-close {
      position: absolute;
      top: calc(env(safe-area-inset-top, 0px) + 6px);
      right: 14px;
      width: 38px; height: 38px;
      background: rgba(255,255,255,0.14);
      border: none; border-radius: 50%;
      color: #fff; font-size: 1.5rem;
      cursor: pointer; z-index: 11;
      line-height: 1; padding: 0;
    }
    .ww-close:active { transform: scale(0.92); }

    .ww-music-btn {
      position: absolute;
      top: calc(env(safe-area-inset-top, 0px) + 6px);
      right: 60px;
      width: 38px; height: 38px;
      background: rgba(255,255,255,0.14);
      border: none; border-radius: 50%;
      color: #fff; font-size: 1.05rem;
      cursor: pointer; z-index: 11;
      line-height: 1; padding: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .ww-music-btn:active { transform: scale(0.92); }
    .ww-music-btn.suspended {
      animation: wwMusicPulse 1.4s ease-in-out infinite;
      background: rgba(255,255,255,0.28);
      box-shadow: 0 0 0 0 rgba(255,255,255,0.7);
    }
    @keyframes wwMusicPulse {
      0%,100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.55); }
      50%     { box-shadow: 0 0 0 10px rgba(255,255,255,0); }
    }

    .ww-slide {
      position: absolute; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: calc(env(safe-area-inset-top, 0px) + 54px) 24px calc(env(safe-area-inset-bottom, 0px) + 40px) 24px;
      box-sizing: border-box;
      opacity: 0; visibility: hidden;
      transition: opacity 0.25s ease;
      text-align: center;
      overflow: hidden;
    }
    .ww-slide.active { opacity: 1; visibility: visible; }

    /* Anime effects */
    .ww-speed-lines {
      position: absolute; inset: -50%;
      background:
        repeating-linear-gradient(90deg,
          transparent 0, transparent 8px,
          rgba(255,255,255,0.14) 8px, rgba(255,255,255,0.14) 10px);
      -webkit-mask-image: radial-gradient(ellipse at center, transparent 22%, black 60%);
      mask-image: radial-gradient(ellipse at center, transparent 22%, black 60%);
      animation: wwSpeedSpin 4.5s linear infinite;
      pointer-events: none;
      opacity: 0.7;
    }
    @keyframes wwSpeedSpin { to { transform: rotate(360deg); } }

    .ww-halftone {
      position: absolute; inset: 0;
      background-image: radial-gradient(circle, rgba(255,255,255,0.18) 1px, transparent 1.5px);
      background-size: 7px 7px;
      mix-blend-mode: overlay;
      pointer-events: none;
    }

    .ww-scanlines {
      position: absolute; inset: 0;
      background: repeating-linear-gradient(180deg, transparent 0, transparent 3px, rgba(0,0,0,0.15) 3px, rgba(0,0,0,0.15) 4px);
      pointer-events: none; mix-blend-mode: multiply;
    }

    /* Big impact number */
    .ww-big-num {
      font-size: clamp(6rem, 28vw, 15rem);
      font-weight: 900; line-height: 0.9;
      color: #fff;
      font-family: 'Impact','Arial Black','Oswald',system-ui,sans-serif;
      letter-spacing: -0.02em;
      text-shadow: 4px 4px 0 #000, 8px 8px 0 rgba(0,0,0,0.45);
      position: relative; z-index: 2;
      animation: wwCountPop 0.85s cubic-bezier(.2,1.8,.3,1) both;
    }
    @keyframes wwCountPop {
      0% { transform: scale(0.25); opacity: 0; filter: blur(14px); }
      55% { transform: scale(1.18); opacity: 1; filter: blur(0); }
      75% { transform: scale(0.95); }
      100% { transform: scale(1); }
    }

    .ww-kicker {
      font-size: 0.7rem; font-weight: 800;
      letter-spacing: 3.5px; text-transform: uppercase;
      color: rgba(255,255,255,0.82);
      margin-bottom: 10px;
      position: relative; z-index: 2;
      animation: wwFadeSlideUp 0.5s ease-out 0.1s both;
    }
    @keyframes wwFadeSlideUp { from { opacity:0; transform: translateY(16px);} to { opacity:1; transform: translateY(0);} }

    .ww-caption {
      font-size: 1.05rem; color: rgba(255,255,255,0.88);
      margin-top: 18px; font-weight: 600;
      max-width: 88%; line-height: 1.35;
      position: relative; z-index: 2;
      animation: wwFadeSlideUp 0.55s ease-out 0.35s both;
    }

    .ww-stamp {
      display: inline-block;
      padding: 8px 18px; background: #ef4444; color: #fff;
      font-weight: 900; font-size: 1rem;
      letter-spacing: 2.5px; text-transform: uppercase;
      transform: rotate(-8deg);
      margin-top: 26px;
      border: 3px solid #fff;
      box-shadow: 5px 5px 0 #000;
      position: relative; z-index: 3;
      animation: wwStampSlam 0.55s cubic-bezier(.18,2.2,.4,1) 0.55s both;
    }
    .ww-stamp.gold { background: #fbbf24; color: #1a0a0a; }
    .ww-stamp.green { background: #22c55e; color: #051505; }
    .ww-stamp.blue { background: #3b82f6; }
    .ww-stamp.purple { background: #a855f7; }
    @keyframes wwStampSlam {
      0% { transform: rotate(-8deg) scale(2.8); opacity: 0; }
      55% { transform: rotate(-8deg) scale(0.85); opacity: 1; }
      100% { transform: rotate(-8deg) scale(1); opacity: 1; }
    }

    .ww-delta {
      display: inline-block;
      font-size: 1.1rem; font-weight: 800;
      padding: 6px 14px; border-radius: 999px;
      margin-top: 12px;
      background: rgba(255,255,255,0.18);
      backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
      position: relative; z-index: 2;
      animation: wwFadeSlideUp 0.5s ease-out 0.45s both;
    }
    .ww-delta.up { color: #4ade80; }
    .ww-delta.down { color: #fb7185; }

    /* Manga-panel for PBs */
    .ww-pb-panel {
      position: relative;
      background: #fff; color: #0a0a0a;
      border: 4px solid #000;
      padding: 28px 22px 22px;
      max-width: 86%;
      box-shadow: 8px 8px 0 #000;
      transform: rotate(-2deg);
      animation: wwPanelSlam 0.5s cubic-bezier(.2,2,.3,1) both;
      z-index: 3;
    }
    .ww-pb-panel + .ww-pb-panel {
      margin-top: 14px;
      transform: rotate(1.5deg);
    }
    @keyframes wwPanelSlam {
      0% { transform: rotate(-2deg) scale(0.3); opacity: 0; }
      70% { transform: rotate(-2deg) scale(1.08); opacity: 1; }
      100% { transform: rotate(-2deg) scale(1); }
    }
    .ww-pb-panel::before {
      content: 'NEW RECORD';
      position: absolute; top: -14px; left: 12px;
      background: #ef4444; color: #fff;
      font-weight: 900; font-size: 0.7rem;
      letter-spacing: 2px;
      padding: 4px 10px;
      border: 2px solid #000;
    }
    .ww-pb-panel-title {
      font-family: 'Impact','Arial Black',sans-serif;
      font-size: 1.5rem; line-height: 1.1;
      margin-bottom: 4px; letter-spacing: 0.5px;
    }
    .ww-pb-panel-value {
      font-size: 2.4rem; font-weight: 900;
      color: #dc2626;
    }
    .ww-pb-panel-delta {
      font-size: 0.85rem; font-weight: 700;
      color: #666; margin-top: 4px;
    }

    /* Mood arc sparkline */
    .ww-mood-arc {
      display: flex; justify-content: space-between;
      width: 100%; max-width: 420px;
      margin-top: 22px;
      position: relative; z-index: 2;
    }
    .ww-mood-day {
      display: flex; flex-direction: column; align-items: center;
      flex: 1; gap: 6px;
      animation: wwFadeSlideUp 0.4s ease-out both;
    }
    .ww-mood-face { font-size: 1.6rem; filter: drop-shadow(0 2px 0 rgba(0,0,0,0.4)); }
    .ww-mood-day-label {
      font-size: 0.65rem; font-weight: 800;
      letter-spacing: 1px;
      color: rgba(255,255,255,0.7);
    }

    /* Streak flame */
    .ww-flame {
      font-size: clamp(6rem, 30vw, 14rem);
      line-height: 1;
      animation: wwFlameDance 1s ease-in-out infinite alternate;
      filter: drop-shadow(0 0 30px rgba(255,120,0,0.8));
      position: relative; z-index: 2;
    }
    @keyframes wwFlameDance {
      from { transform: scale(1) rotate(-3deg); }
      to   { transform: scale(1.08) rotate(3deg); }
    }

    /* Trend arrow */
    .ww-trend-arrow {
      display: inline-block;
      font-size: 2.2rem; font-weight: 900;
      margin-left: 8px;
    }
    .ww-trend-arrow.up { color: #4ade80; }
    .ww-trend-arrow.down { color: #fb7185; }
    .ww-trend-arrow.flat { color: #94a3b8; }

    /* Slide bg palettes */
    .ww-bg-intro   { background: radial-gradient(circle at 30% 20%, #2a1a4a 0%, #050505 70%); }
    .ww-bg-workouts{ background: radial-gradient(circle at 70% 30%, #4a1a0a 0%, #0a0505 70%); }
    .ww-bg-minutes { background: linear-gradient(135deg, #ff6b35 0%, #7a1e0d 100%); }
    .ww-bg-pbs     { background: linear-gradient(135deg, #f59e0b 0%, #7c2d12 100%); }
    .ww-bg-mood    { background: linear-gradient(160deg, #1e3a8a 0%, #0a1a3a 100%); }
    .ww-bg-weight  { background: linear-gradient(160deg, #166534 0%, #052e16 100%); }
    .ww-bg-social  { background: linear-gradient(135deg, #a21caf 0%, #3b0764 100%); }
    .ww-bg-streak  { background: radial-gradient(circle at 50% 45%, #f97316 0%, #7c2d12 60%, #1a0a0a 100%); }
    .ww-bg-xp      { background: linear-gradient(135deg, #6d28d9 0%, #b45309 100%); }
    .ww-bg-predict { background: radial-gradient(circle at 50% 60%, #06b6d4 0%, #1e3a8a 50%, #020617 100%); }
    /* "Ask ChatGPT" educational series — indigo → cyan, signals learn-mode not promo */
    .ww-bg-ask     { background: linear-gradient(160deg, #1e1b4b 0%, #0c4a6e 55%, #020617 100%); }
    .ww-bg-level-saga {
      background:
        radial-gradient(circle at 50% 44%, rgba(253,224,71,0.95) 0%, rgba(249,115,22,0.86) 18%, rgba(14,165,233,0.32) 36%, rgba(15,23,42,0.95) 66%, #020617 100%);
    }
    .ww-bg-challenge-week {
      background:
        linear-gradient(146deg, #07120d 0%, #102118 42%, #f8f3e7 42%, #f8f3e7 100%);
    }
    .ww-bg-challenge-score {
      background:
        linear-gradient(160deg, #f8f3e7 0%, #f3d36b 48%, #101820 48%, #07120d 100%);
    }
    .ww-bg-challenge-action {
      background:
        linear-gradient(135deg, #101820 0%, #17352a 52%, #ef5b45 52%, #f5b84b 100%);
    }
    .ww-bg-challenge-night {
      background:
        linear-gradient(155deg, #07120d 0%, #15241d 45%, #102a3a 100%);
    }

    /* 30 Day Challenge reel: scoreboard / race-day energy, distinct from the DBZ reel */
    .ww-challenge-tape {
      position:absolute;
      left:-10%;
      right:-10%;
      height:42px;
      display:flex;
      align-items:center;
      gap:18px;
      padding:0 18px;
      background:#f8f3e7;
      color:#101820;
      border-top:3px solid #101820;
      border-bottom:3px solid #101820;
      box-shadow:0 8px 0 rgba(0,0,0,0.35);
      font-family:'Impact','Arial Black',sans-serif;
      font-size:clamp(0.9rem, 3vw, 1.15rem);
      letter-spacing:1.5px;
      text-transform:uppercase;
      white-space:nowrap;
      transform:rotate(var(--rot, -7deg));
      overflow:hidden;
      z-index:1;
    }
    .ww-challenge-tape.top { top:8%; }
    .ww-challenge-tape.bottom { bottom:10%; --rot:7deg; }
    .ww-challenge-tape span {
      animation:wwChallengeTicker 10s linear infinite;
    }
    @keyframes wwChallengeTicker {
      to { transform:translateX(-160px); }
    }
    .ww-challenge-pill {
      position:relative;
      z-index:2;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-height:36px;
      padding:8px 14px;
      border:3px solid #101820;
      border-radius:999px;
      background:#f8f3e7;
      color:#101820;
      box-shadow:5px 5px 0 #101820;
      font-size:0.72rem;
      font-weight:900;
      letter-spacing:1.3px;
      text-transform:uppercase;
    }
    .ww-challenge-pill.green {
      background:#69c779;
    }
    .ww-challenge-pill.coral {
      background:#ef5b45;
      color:#fff;
    }
    .ww-challenge-scorecard {
      position:relative;
      z-index:2;
      width:min(86vw, 430px);
      border:4px solid #101820;
      border-radius:8px;
      background:#f8f3e7;
      color:#101820;
      box-shadow:10px 10px 0 #101820;
      padding:18px;
      display:grid;
      grid-template-columns:repeat(2, minmax(0, 1fr));
      gap:12px;
      transform:rotate(-1deg);
    }
    .ww-challenge-scorecell {
      border:3px solid #101820;
      border-radius:6px;
      padding:12px 8px;
      background:#fffaf0;
      text-align:center;
      min-height:84px;
      display:flex;
      flex-direction:column;
      justify-content:center;
    }
    .ww-challenge-scorecell strong {
      font-size:clamp(1.7rem, 8vw, 3.2rem);
      line-height:0.95;
      font-family:'Impact','Arial Black',sans-serif;
    }
    .ww-challenge-scorecell span {
      margin-top:7px;
      font-size:0.68rem;
      font-weight:900;
      letter-spacing:1px;
      text-transform:uppercase;
    }
    .ww-challenge-stack {
      position:relative;
      z-index:2;
      display:flex;
      flex-direction:column;
      gap:10px;
      width:min(86vw, 390px);
      margin-top:22px;
    }
    .ww-challenge-bar {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      min-height:50px;
      padding:10px 13px;
      border:3px solid #101820;
      border-radius:6px;
      background:#f8f3e7;
      color:#101820;
      box-shadow:5px 5px 0 rgba(0,0,0,0.9);
      animation:wwFadeSlideUp 0.45s ease-out both;
      animation-delay:var(--delay, 0s);
    }
    .ww-challenge-bar span:first-child {
      font-weight:900;
      letter-spacing:0.5px;
      text-transform:uppercase;
      font-size:0.78rem;
    }
    .ww-challenge-bar span:last-child {
      font-family:'Impact','Arial Black',sans-serif;
      font-size:clamp(1.35rem, 6vw, 2.5rem);
      line-height:1;
    }
    .ww-challenge-logo-final {
      position:relative;
      z-index:2;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      gap:12px;
    }

    /* Level-character promo reel: original battle-anime power-up treatment */
    .ww-ki-aura {
      position: absolute;
      width: clamp(280px, 82vw, 520px);
      aspect-ratio: 1;
      border-radius: 50%;
      background:
        radial-gradient(circle, rgba(255,255,255,0.86) 0 8%, rgba(253,224,71,0.82) 9% 22%, rgba(249,115,22,0.42) 23% 42%, rgba(34,211,238,0.24) 43% 58%, transparent 68%);
      filter: blur(2px);
      animation: wwKiPulse 1.05s ease-in-out infinite alternate;
      pointer-events: none;
    }
    .ww-ki-aura::before,
    .ww-ki-aura::after {
      content: '';
      position: absolute;
      inset: 9%;
      border-radius: 50%;
      border: 3px solid rgba(255,255,255,0.42);
      box-shadow: 0 0 38px rgba(253,224,71,0.72), inset 0 0 30px rgba(34,211,238,0.34);
      animation: wwKiRing 1.7s linear infinite;
    }
    .ww-ki-aura::after {
      inset: 20%;
      border-color: rgba(34,211,238,0.36);
      animation-direction: reverse;
      animation-duration: 2.25s;
    }
    @keyframes wwKiPulse {
      from { transform: scale(0.94); opacity: 0.74; }
      to   { transform: scale(1.08); opacity: 1; }
    }
    @keyframes wwKiRing {
      to { transform: rotate(360deg); }
    }
    .ww-energy-bolt {
      position: absolute;
      width: 5px;
      height: clamp(72px, 18vh, 140px);
      background: linear-gradient(180deg, transparent, #fff 14%, #22d3ee 46%, #facc15 74%, transparent);
      border-radius: 999px;
      box-shadow: 0 0 18px rgba(34,211,238,0.9);
      opacity: 0.82;
      transform: rotate(var(--r, 0deg)) translateY(var(--y, 0));
      animation: wwBoltFlash 0.78s steps(2,end) infinite;
      animation-delay: var(--d, 0s);
      pointer-events: none;
    }
    @keyframes wwBoltFlash {
      50% { opacity: 0.2; transform: rotate(var(--r, 0deg)) translateY(var(--y, 0)) scaleY(0.72); }
    }
    .ww-orb-ring {
      position: relative;
      z-index: 2;
      width: clamp(230px, 70vw, 390px);
      aspect-ratio: 1;
      margin: 8px auto 0;
      animation: wwOrbFloat 2.6s ease-in-out infinite alternate;
    }
    .ww-orb-ring::before {
      content: '';
      position: absolute;
      inset: 16%;
      border-radius: 50%;
      border: 2px dashed rgba(255,255,255,0.34);
      box-shadow: 0 0 34px rgba(251,191,36,0.42);
      animation: wwKiRing 8s linear infinite;
    }
    @keyframes wwOrbFloat {
      from { transform: translateY(4px) scale(0.98); }
      to   { transform: translateY(-8px) scale(1.02); }
    }
    .ww-wish-orb {
      position: absolute;
      left: var(--x);
      top: var(--y);
      width: clamp(38px, 11vw, 58px);
      height: clamp(38px, 11vw, 58px);
      border-radius: 50%;
      background:
        radial-gradient(circle at 32% 24%, rgba(255,255,255,0.96) 0 8%, rgba(254,240,138,0.98) 9% 18%, rgba(251,146,60,0.98) 30%, rgba(234,88,12,0.98) 72%, rgba(124,45,18,1) 100%);
      border: 2px solid rgba(255,255,255,0.75);
      box-shadow: 0 0 22px rgba(251,191,36,0.92), inset -8px -10px 14px rgba(124,45,18,0.34);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #7c2d12;
      font-size: clamp(0.7rem, 2.8vw, 1rem);
      font-weight: 900;
      animation: wwOrbPop 0.65s cubic-bezier(.2,1.8,.3,1) both, wwOrbGlow 1.2s ease-in-out infinite alternate;
      animation-delay: var(--delay, 0s), calc(var(--delay, 0s) + 0.65s);
    }
    @keyframes wwOrbPop {
      from { opacity: 0; transform: translate(-50%, -50%) scale(0.2); }
      70%  { opacity: 1; transform: translate(-50%, -50%) scale(1.18); }
      to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
    @keyframes wwOrbGlow {
      from { filter: saturate(1) brightness(1); }
      to   { filter: saturate(1.35) brightness(1.18); }
    }
    .ww-ki-core {
      position: absolute;
      inset: 30%;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle, #fff 0 16%, #facc15 17% 46%, #0f172a 47% 100%);
      border: 4px solid #fff;
      box-shadow: 0 0 40px rgba(253,224,71,0.9), 0 0 80px rgba(34,211,238,0.45);
      color: #020617;
      font-family: 'Impact','Arial Black',sans-serif;
      font-size: clamp(3.4rem, 15vw, 7rem);
      line-height: 0.9;
      text-shadow: 2px 2px 0 rgba(255,255,255,0.6);
      animation: wwCountPop 0.85s cubic-bezier(.2,1.8,.3,1) 0.22s both;
    }
    .ww-level-ladder {
      display: grid;
      grid-template-columns: repeat(5, minmax(44px, 1fr));
      gap: 8px;
      width: min(440px, 88vw);
      position: relative;
      z-index: 2;
      margin-top: 26px;
    }
    .ww-level-node {
      min-height: 58px;
      border: 2px solid rgba(255,255,255,0.62);
      background: rgba(15,23,42,0.58);
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 20px rgba(34,211,238,0.18);
      animation: wwFadeSlideUp 0.45s ease-out both;
      animation-delay: var(--delay, 0s);
    }
    .ww-level-node strong {
      color: #facc15;
      font-size: clamp(1.05rem, 5vw, 1.7rem);
      font-family: 'Impact','Arial Black',sans-serif;
      line-height: 1;
    }
    .ww-level-node span {
      color: rgba(255,255,255,0.76);
      font-size: 0.58rem;
      font-weight: 900;
      letter-spacing: 1.8px;
      text-transform: uppercase;
      margin-top: 4px;
    }
    .ww-unlock-card {
      position: relative;
      z-index: 2;
      width: min(420px, 88vw);
      padding: 18px 16px;
      border: 3px solid #fff;
      background: rgba(2,6,23,0.74);
      box-shadow: 8px 8px 0 #000, 0 0 44px rgba(251,191,36,0.28);
      border-radius: 14px;
      display: grid;
      gap: 12px;
      animation: wwPanelSlam 0.55s cubic-bezier(.2,2,.3,1) both;
    }
    .ww-unlock-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 12px 14px;
      border-radius: 10px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.16);
      font-weight: 900;
      color: #fff;
      letter-spacing: 0.4px;
    }
    .ww-unlock-row b {
      color: #facc15;
      font-family: 'Impact','Arial Black',sans-serif;
      font-size: 1.4rem;
      letter-spacing: 1px;
    }

    /* ─── Chat-bubble layout for the "Ask ChatGPT" educational reels ─── */
    /* Fake ChatGPT chrome pill at the top of every slide */
    .ask-chrome {
      position: absolute; top: calc(env(safe-area-inset-top, 0px) + 18px);
      left: 50%; transform: translateX(-50%);
      display: inline-flex; align-items: center; gap: 8px;
      padding: 7px 14px 7px 8px; border-radius: 999px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.14);
      color: rgba(255,255,255,0.9);
      font-size: 0.72rem; font-weight: 800;
      letter-spacing: 1.5px; text-transform: uppercase;
      backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
      z-index: 5;
    }
    .ask-chrome-dot {
      width: 20px; height: 20px; border-radius: 50%;
      background: radial-gradient(circle at 35% 30%, #10a37f 0%, #047857 100%);
      box-shadow: inset 0 0 0 2px rgba(255,255,255,0.12);
    }
    /* The stack of bubbles */
    .ask-chat {
      width: 100%; max-width: 480px;
      display: flex; flex-direction: column; gap: 14px;
      padding: 0 6px; margin-top: 18px;
      position: relative; z-index: 2;
      text-align: left;
    }
    .ask-row {
      display: flex; gap: 10px; align-items: flex-end;
      opacity: 0;
      animation: askRowIn 0.4s cubic-bezier(.2,1.4,.3,1) both;
    }
    .ask-row.user { flex-direction: row-reverse; }
    .ask-row:nth-child(1) { animation-delay: 0.05s; }
    .ask-row:nth-child(2) { animation-delay: 0.45s; }
    .ask-row:nth-child(3) { animation-delay: 0.85s; }
    .ask-row:nth-child(4) { animation-delay: 1.25s; }
    .ask-row:nth-child(5) { animation-delay: 1.65s; }
    .ask-row:nth-child(6) { animation-delay: 2.05s; }
    .ask-row:nth-child(7) { animation-delay: 2.45s; }
    .ask-row:nth-child(8) { animation-delay: 2.85s; }
    @keyframes askRowIn {
      0% { opacity: 0; transform: translateY(12px) scale(0.96); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    .ask-avatar {
      width: 34px; height: 34px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-weight: 900; font-size: 0.78rem;
      flex-shrink: 0;
      border: 2px solid rgba(255,255,255,0.18);
      font-family: 'Inter', system-ui, sans-serif;
      letter-spacing: 0;
    }
    .ask-avatar.gpt  { background: #0f0f0f; color: #10a37f; }
    .ask-avatar.user { background: #22d3ee; color: #042f3a; }
    .ask-col { display: flex; flex-direction: column; max-width: 78%; min-width: 0; }
    .ask-row.user .ask-col { align-items: flex-end; }
    .ask-label {
      font-size: 0.58rem; font-weight: 800;
      letter-spacing: 2.5px; text-transform: uppercase;
      color: rgba(255,255,255,0.55);
      margin: 0 6px 4px;
    }
    .ask-bubble {
      padding: 12px 16px;
      border-radius: 18px;
      font-size: 1rem; line-height: 1.38; font-weight: 600;
      box-shadow: 0 4px 16px rgba(0,0,0,0.28);
      font-family: 'Inter', system-ui, sans-serif;
      word-break: break-word;
    }
    .ask-bubble.gpt  {
      background: #262626; color: #f5f5f5;
      border-bottom-left-radius: 6px;
    }
    .ask-bubble.user {
      background: #22d3ee; color: #042f3a;
      border-bottom-right-radius: 6px;
    }
    .ask-bubble strong { color: #fde047; font-weight: 800; }
    .ask-bubble.user strong { color: #083344; }
    .ask-bubble em { color: #a5f3fc; font-style: normal; font-weight: 700; }
    .ask-bubble ol, .ask-bubble ul {
      margin: 8px 0 2px; padding-left: 22px;
    }
    .ask-bubble li { margin: 4px 0; }

    /* Kicker above the chat (context / section title) */
    .ask-section {
      font-size: 0.68rem; font-weight: 800;
      letter-spacing: 3.5px; text-transform: uppercase;
      color: rgba(255,255,255,0.65);
      margin-bottom: 8px;
      animation: wwFadeSlideUp 0.5s ease-out 0.1s both;
    }
    /* Educational outro — softer than the app-store CTA */
    .ask-outro-tag {
      font-size: 1rem; color: rgba(255,255,255,0.92);
      font-weight: 700; letter-spacing: 0.5px;
      margin-top: 14px;
    }

    /* ─── Typewriter layout for the "Ask ChatGPT" educational reels ─── */
    /* One full-screen slide per sentence. Speaker label fades in at top,
       then the text types out char-by-char with a blinking caret. Slide
       wipes (via the existing .ww-slide cross-fade) to the next line. */
    .tw-stage {
      position: relative; z-index: 2;
      width: 100%; max-width: 640px;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 24px;
      padding: 0 10px;
    }
    /* Speaker label — rendered as a bold coloured pill so a speaker
       change is impossible to miss. Shan's pill anchors on the right,
       ChatGPT's on the left, and each pill slides in from its side. */
    .tw-label {
      font-size: 0.82rem; font-weight: 900;
      letter-spacing: 3.5px; text-transform: uppercase;
      display: inline-flex; align-items: center; gap: 10px;
      padding: 9px 18px;
      border-radius: 999px;
      backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
      font-family: 'Inter', system-ui, sans-serif;
      margin-bottom: 10px;
    }
    .tw-label.gpt {
      color: #22d3ee;
      background: rgba(34, 211, 238, 0.14);
      border: 1.5px solid rgba(34, 211, 238, 0.55);
      box-shadow: 0 4px 24px rgba(34, 211, 238, 0.22);
      align-self: flex-start;
      animation: twLabelInLeft 0.45s cubic-bezier(.2,1.4,.3,1) 0.08s both;
    }
    .tw-label.user {
      color: #fde047;
      background: rgba(253, 224, 71, 0.16);
      border: 1.5px solid rgba(253, 224, 71, 0.6);
      box-shadow: 0 4px 24px rgba(253, 224, 71, 0.22);
      align-self: flex-end;
      animation: twLabelInRight 0.45s cubic-bezier(.2,1.4,.3,1) 0.08s both;
    }
    .tw-label-dot {
      width: 10px; height: 10px; border-radius: 50%;
      background: currentColor;
      box-shadow: 0 0 14px currentColor, 0 0 3px currentColor;
    }
    @keyframes twLabelInLeft {
      from { opacity: 0; transform: translateX(-22px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes twLabelInRight {
      from { opacity: 0; transform: translateX(22px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    /* Kept for the Libet visual slide which uses the old animation name */
    @keyframes twLabelIn {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .tw-text {
      font-size: clamp(1.35rem, 5.4vw, 2.1rem);
      line-height: 1.38;
      font-weight: 600;
      color: #f5f5f5;
      font-family: 'Inter', system-ui, sans-serif;
      text-align: center;
      max-width: 100%;
      letter-spacing: 0.01em;
      /* Reserve min-height so short lines don't jump around the viewport */
      min-height: 2.8em;
      display: block;
    }
    .tw-visible { color: #f5f5f5; }
    .tw-visible strong { color: #fde047; font-weight: 800; }
    .tw-visible em { color: #a5f3fc; font-style: normal; font-weight: 700; }
    /* The "hidden" span holds the future chars with layout preserved but
       invisible, so wrapping + line-height match the final rendered text
       and the cursor doesn't jitter across the screen as chars land. */
    .tw-hidden { opacity: 0; }
    .tw-cursor {
      display: inline-block;
      width: 0.55ch;
      height: 1.05em;
      background: #22d3ee;
      vertical-align: -0.18em;
      margin: 0 1px;
      box-shadow: 0 0 12px rgba(34, 211, 238, 0.55);
      animation: twBlink 0.78s steps(2) infinite;
    }
    @keyframes twBlink { 50% { opacity: 0; } }
    /* When the slide is fading out, hide the cursor so it doesn't keep
       blinking through the cross-fade. */
    .ww-slide:not(.active) .tw-cursor { display: none; }

    /* Minimal testimonial-card story posts */
    .ww-bg-story-card { background: #050505; }
    .story-card-stage {
      position: relative; z-index: 2;
      width: 100%;
      display: flex; align-items: center; justify-content: center;
      padding: 0 4px;
    }
    .story-card {
      position: relative;
      width: min(88vw, 720px);
      min-height: clamp(300px, 42vh, 460px);
      background: #fbfcfd;
      border: 1px solid #dbe7f1;
      border-right: 3px solid #dbe7f1;
      border-radius: 2px;
      box-shadow: 0 2px 0 rgba(148,163,184,0.16), 0 18px 44px rgba(0,0,0,0.28);
      box-sizing: border-box;
      padding: clamp(34px, 7vw, 56px);
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      text-align: left;
      animation: storyCardIn 0.32s ease-out both;
    }
    @media (min-width: 720px) {
      .story-card { aspect-ratio: 1.62; min-height: 0; }
    }
    @keyframes storyCardIn {
      from { opacity: 0; transform: translateY(10px) scale(0.992); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .story-card-name {
      position: absolute;
      top: clamp(34px, 19%, 92px);
      left: clamp(34px, 7vw, 56px);
      right: clamp(34px, 7vw, 56px);
      color: #65778e;
      font-size: clamp(1rem, 3.4vw, 1.45rem);
      font-weight: 900;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      line-height: 1.05;
      font-family: 'Inter', system-ui, sans-serif;
    }
    .story-card-name.shan { color: #334155; }
    .story-type.tw-text {
      margin-top: clamp(54px, 11vh, 124px);
      min-height: 4.6em;
      color: #243246;
      font-size: clamp(1.24rem, 4.35vw, 2.25rem);
      line-height: 1.34;
      font-weight: 500;
      text-align: left;
      letter-spacing: 0;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      overflow-wrap: anywhere;
    }
    .story-type .tw-visible,
    .story-type .tw-visible strong,
    .story-type .tw-visible em {
      color: #243246;
    }
    .story-type .tw-cursor {
      background: #5f7288;
      box-shadow: 0 0 10px rgba(95,114,136,0.38);
    }

    .ww-cta-btn {
      margin-top: 30px;
      padding: 16px 36px; border: none; cursor: pointer;
      background: #fff; color: #0a0a0a;
      font-weight: 900; font-size: 1.1rem;
      letter-spacing: 2px; text-transform: uppercase;
      font-family: 'Impact','Arial Black',sans-serif;
      box-shadow: 6px 6px 0 #000;
      border-radius: 8px;
      transition: transform 0.15s ease;
      position: relative; z-index: 3;
      animation: wwFadeSlideUp 0.5s ease-out 0.8s both;
    }
    .ww-cta-btn:active { transform: translate(3px, 3px); box-shadow: 2px 2px 0 #000; }

    .ww-share-btn {
      position: absolute; z-index: 11;
      bottom: calc(env(safe-area-inset-bottom, 0px) + 80px);
      right: 18px;
      width: 44px; height: 44px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.5);
      background: rgba(0,0,0,0.35);
      color: #fff; cursor: pointer;
      font-size: 1.2rem; display: flex;
      align-items: center; justify-content: center;
    }
    .ww-share-btn:active { transform: scale(0.92); }

    .ww-tap-hint {
      position: absolute;
      bottom: calc(env(safe-area-inset-bottom, 0px) + 24px);
      left: 50%; transform: translateX(-50%);
      font-size: 0.72rem;
      color: rgba(255,255,255,0.55);
      font-weight: 700; letter-spacing: 2px;
      text-transform: uppercase;
      animation: wwHintPulse 1.3s ease-in-out infinite;
      z-index: 4;
    }
    @keyframes wwHintPulse { 0%,100% { opacity: 0.35; } 50% { opacity: 0.9; } }

    .ww-tap-zones {
      position: absolute; inset: 0; display: flex;
      z-index: 5;
    }
    .ww-tap-zones > div { flex: 1; }

    .ww-theme-pill {
      display: inline-block;
      margin-top: 18px;
      padding: 5px 14px;
      border: 1px solid rgba(255,255,255,0.35);
      border-radius: 999px;
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.85);
      font-size: 0.72rem; font-weight: 700;
      letter-spacing: 1.8px; text-transform: uppercase;
      backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
      animation: wwFadeSlideUp 0.55s ease-out 0.9s both;
      position: relative; z-index: 2;
    }

    /* App Store / Google Play pill badges on the CTA slide */
    .ww-store-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 18px;
      background: #000;
      color: #fff;
      border: 2px solid #fff;
      border-radius: 12px;
      font-weight: 800;
      font-size: 0.9rem;
      letter-spacing: 0.5px;
      box-shadow: 4px 4px 0 rgba(255,255,255,0.85);
      animation: wwFadeSlideUp 0.5s ease-out 0.5s both;
      position: relative; z-index: 2;
    }
    .ww-store-pill:nth-child(2) { animation-delay: 0.7s; }
  `;

  // --- Open ---

  async function open(userId, opts){
    opts = opts || {};
    if (!userId && window.currentUser) userId = window.currentUser.id;
    if (!userId) { console.warn('[ww] no userId'); return; }

    ensureStyles();

    // Create overlay shell immediately so user sees loading state
    let overlay = document.getElementById('weekly-wrapped-overlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'weekly-wrapped-overlay';
    overlay.className = 'ww-overlay';
    overlay.innerHTML = `
      <div class="ww-slide active ww-bg-intro" style="display:flex;">
        <div class="ww-speed-lines"></div>
        <div class="ww-halftone"></div>
        <div class="ww-kicker" style="animation:none;">Loading your week…</div>
        <div style="width:44px; height:44px; border:3px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation: wwSpeedSpin 0.8s linear infinite; margin-top:18px;"></div>
      </div>
      <button class="ww-close" aria-label="Close">&times;</button>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('.ww-close').onclick = () => closeOverlay();

    if (typeof window.pushNavigationState === 'function') {
      try { window.pushNavigationState('weekly-wrapped-overlay', closeOverlay); } catch(_){}
    }

    // Build data (or reuse pre-built snapshot if passed)
    let data = opts.data;
    const builtFresh = !data;
    if (!data) {
      try { data = await buildData(userId); }
      catch (err) {
        console.error('[ww] buildData failed:', err);
        overlay.innerHTML = `
          <div class="ww-slide active ww-bg-intro" style="display:flex;">
            <div class="ww-kicker">Couldn't load your week</div>
            <div class="ww-caption">Try again later, something went sideways.</div>
            <button class="ww-cta-btn" onclick="document.getElementById('weekly-wrapped-overlay').remove();">Close</button>
          </div>
          <button class="ww-close" aria-label="Close">&times;</button>
        `;
        overlay.querySelector('.ww-close').onclick = () => closeOverlay();
        return;
      }
    }

    await maybeAwardWeeklyGoalsInWrappedData(data);
    if (builtFresh) upsertSnapshot(userId, data);

    // Register active week so closeOverlay() can mark-seen on any close path.
    activeUserId = userId;
    activeIsoWeek = data.iso_week;

    // Spin up the synth using the theme picked from this wrapped's ISO week.
    // Done AFTER data fetch so replays of archived weeks keep the theme they
    // originally rotated with. If the user had muted last time, honour that.
    // If AudioContext starts suspended (iOS autoplay block), the music button
    // pulses until the user's first tap.
    try {
      if (currentSynth) { currentSynth.stop(); currentSynth = null; }
      const theme = pickWrappedTheme(data.iso_week);
      currentSynth = createWrappedSynth(theme);
      if (currentSynth) {
        const wasMuted = isMutedPref();
        if (wasMuted) currentSynth.setMuted(true);
        const res = currentSynth.resume();
        const afterResume = () => {
          if (!currentSynth) return;
          if (!wasMuted && currentSynth.state() === 'running') currentSynth.fadeIn();
        };
        if (res && typeof res.then === 'function') res.then(afterResume, afterResume);
        else afterResume();
      }
    } catch(e) { console.warn('[ww] synth init failed', e); }

    const slides = buildSlides(data);
    if (!slides.length) { closeOverlay(); return; }

    renderSlides(overlay, slides, () => {
      markSeen(data.iso_week);
      markViewed(userId, data.iso_week);
    });
  }

  function closeOverlay(){
    // Mark-seen on ALL close paths — X button, swipe-back, back button, end
    // of slideshow. markSeen is idempotent so double-calls from the explicit
    // onFinish callback in renderSlides are harmless.
    if (activeIsoWeek) {
      try { markSeen(activeIsoWeek); } catch(_){}
      if (activeUserId) { try { markViewed(activeUserId, activeIsoWeek); } catch(_){} }
      activeIsoWeek = null;
      activeUserId = null;
    }
    const overlay = document.getElementById('weekly-wrapped-overlay');
    if (overlay) overlay.remove();
    // Promo's hidden preload model-viewer lives on document.body, not inside
    // the overlay — clean it up so we don't leak a WebGL context.
    const preload = document.getElementById('ww-fitgotchi-preload');
    if (preload) preload.remove();
    if (currentSynth) { try { currentSynth.stop(); } catch(_){} currentSynth = null; }
  }

  // Each slide: { bg, html, hold_ms? }
  function buildSlides(d){
    const u = (window.currentUser && (window.currentUser.name || window.currentUser.email)) || 'you';
    const firstName = String(u).split(/[ @]/)[0];

    const slides = [];

    // 1. INTRO
    const theme = pickWrappedTheme(d.iso_week);
    slides.push({
      bg: 'ww-bg-intro',
      html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-halftone"></div>
        <div class="ww-kicker" style="margin-bottom:22px;">${escapeHtml(firstName)}'s Week</div>
        <div class="ww-big-num" style="font-size: clamp(4rem, 16vw, 9rem);">WRAPPED</div>
        <div class="ww-caption">Seven days. One slideshow. Let's roll.</div>
        <div class="ww-stamp gold" style="margin-top:34px;">${escapeHtml(d.iso_week)}</div>
        <div class="ww-theme-pill">♪ ${escapeHtml(theme.name)}</div>
      `,
    });

    // 2. WORKOUTS
    const wThis = d.workouts.this_week;
    const wDelta = d.workouts.delta;
    const deltaHtml = wDelta === 0
      ? `<div class="ww-delta">Same as last week</div>`
      : wDelta > 0
        ? `<div class="ww-delta up">+${wDelta} vs last week</div>`
        : `<div class="ww-delta down">${wDelta} vs last week</div>`;
    let wStamp = '';
    if (wThis >= 5) wStamp = `<div class="ww-stamp">UNHINGED</div>`;
    else if (wThis >= 3) wStamp = `<div class="ww-stamp green">LOCKED IN</div>`;
    else if (wThis >= 1) wStamp = `<div class="ww-stamp blue">ON THE BOARD</div>`;
    else wStamp = `<div class="ww-stamp purple">REST MODE</div>`;
    slides.push({
      bg: 'ww-bg-workouts',
      html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-kicker">Workouts done</div>
        <div class="ww-big-num" data-count="${wThis}">${wThis}</div>
        ${deltaHtml}
        ${wStamp}
      `,
    });

    // 3. MINUTES MOVED
    const mins = d.minutes.total;
    const narutoEps = Math.max(1, Math.round(mins / 23));
    slides.push({
      bg: 'ww-bg-minutes',
      html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-halftone"></div>
        <div class="ww-kicker">Minutes moved</div>
        <div class="ww-big-num" data-count="${mins}">${mins}</div>
        <div class="ww-caption">That's <strong>${narutoEps}</strong> episode${narutoEps === 1 ? '' : 's'} of Naruto.</div>
      `,
    });

    // 4. PBs (only if any)
    if (d.pbs.count > 0) {
      const panels = d.pbs.items.slice(0, 2).map(pb => {
        const valLabel = pb.type === 'weight' ? `${pb.value}kg` : `${pb.value} reps`;
        const impLabel = pb.improvement ? `+${pb.improvement} from last` : '';
        return `
          <div class="ww-pb-panel">
            <div class="ww-pb-panel-title">${escapeHtml(pb.name || 'Lift')}</div>
            <div class="ww-pb-panel-value">${escapeHtml(valLabel)}</div>
            ${impLabel ? `<div class="ww-pb-panel-delta">${escapeHtml(impLabel)}</div>` : ''}
          </div>
        `;
      }).join('');
      const moreNote = d.pbs.count > 2
        ? `<div class="ww-caption" style="margin-top:20px;">+${d.pbs.count - 2} more ${d.pbs.count - 2 === 1 ? 'PB' : 'PBs'} smashed</div>`
        : '';
      slides.push({
        bg: 'ww-bg-pbs',
        html: `
          <div class="ww-halftone"></div>
          <div class="ww-kicker" style="color:#1a0a00;">${d.pbs.count} Personal Best${d.pbs.count === 1 ? '' : 's'}</div>
          <div style="display:flex; flex-direction:column; align-items:center; gap:4px; margin-top:12px;">${panels}</div>
          ${moreNote}
        `,
      });
    }

    // 5. MOOD ARC
    if (d.mood.avg != null || d.mood.daily.some(x => x.avg != null)) {
      const arcHtml = d.mood.daily.map((day, i) => {
        const face = moodFace(day.avg);
        return `
          <div class="ww-mood-day" style="animation-delay: ${0.1 + i * 0.08}s;">
            <div class="ww-mood-face">${face}</div>
            <div class="ww-mood-day-label">${day.day}</div>
          </div>
        `;
      }).join('');
      const trendArrow = arrowFor(d.mood.last_week_avg, d.mood.avg);
      slides.push({
        bg: 'ww-bg-mood',
        html: `
          <div class="ww-kicker">Mood this week</div>
          <div>
            <span class="ww-big-num" style="display:inline-block;">${d.mood.avg != null ? d.mood.avg : '—'}</span>
            <span class="ww-trend-arrow ${trendArrow.cls}">${trendArrow.symbol}</span>
          </div>
          <div class="ww-caption">avg mood · ${d.mood.logs} check-in${d.mood.logs === 1 ? '' : 's'}</div>
          <div class="ww-mood-arc">${arcHtml}</div>
        `,
      });
    }

    // 6. WEIGHT / NUTRITION
    if (d.weight.latest != null || d.nutrition.meals_logged > 0) {
      const hasWeight = d.weight.latest != null;
      const mainValue = hasWeight ? `${d.weight.latest}kg` : String(d.nutrition.meals_logged);
      const mainCaption = hasWeight
        ? (d.weight.change != null
            ? (d.weight.change > 0 ? `+${d.weight.change}kg this week` : `${d.weight.change}kg this week`)
            : 'keep logging to see your trend')
        : `${d.nutrition.meals_logged === 1 ? 'meal' : 'meals'} logged`;
      const trackedDays = Number(d.nutrition.tracked_days || 0);
      const trackedLine = trackedDays > 0
        ? `tracked ${trackedDays}/${d.nutrition.window_days || 7} days${d.nutrition.avg_calories ? ` · avg ${d.nutrition.avg_calories} kcal/day on tracked days` : ''}`
        : '';
      const mealLine = d.nutrition.meals_logged > 0
        ? `${d.nutrition.meals_logged} meal${d.nutrition.meals_logged === 1 ? '' : 's'} logged${trackedLine ? ` · ${trackedLine}` : ''}`
        : trackedLine;
      const detailLine = hasWeight
        ? mealLine
        : (trackedLine || (d.nutrition.avg_calories ? `avg ${d.nutrition.avg_calories} kcal/day` : ''));
      slides.push({
        bg: 'ww-bg-weight',
        html: `
          <div class="ww-halftone"></div>
          <div class="ww-kicker">Body & fuel</div>
          <div class="ww-big-num" style="font-size: clamp(4.5rem, 18vw, 10rem);">${escapeHtml(mainValue)}</div>
          <div class="ww-caption">${escapeHtml(mainCaption)}</div>
          ${detailLine ? `<div class="ww-caption" style="margin-top:6px; opacity:0.8;">${escapeHtml(detailLine)}</div>` : ''}
        `,
      });
    }

    // 7. SOCIAL
    if (d.social.posts > 0 || d.social.reactions_received > 0) {
      slides.push({
        bg: 'ww-bg-social',
        html: `
          <div class="ww-speed-lines"></div>
          <div class="ww-kicker">Your feed</div>
          <div class="ww-big-num">${d.social.reactions_received}</div>
          <div class="ww-caption">reaction${d.social.reactions_received === 1 ? '' : 's'} on your ${d.social.posts} post${d.social.posts === 1 ? '' : 's'}</div>
          ${d.social.reactions_received >= 10 ? `<div class="ww-stamp purple">CROWD PLEASER</div>` : ''}
        `,
      });
    }

    // 8. STREAK
    if (d.streak > 0) {
      slides.push({
        bg: 'ww-bg-streak',
        html: `
          <div class="ww-halftone"></div>
          <div class="ww-kicker">Current streak</div>
          <div class="ww-flame">🔥</div>
          <div class="ww-big-num" style="font-size: clamp(3.5rem, 14vw, 7rem); margin-top:-18px;">${d.streak}</div>
          <div class="ww-caption">day${d.streak === 1 ? '' : 's'} lit — don't let it die</div>
        `,
      });
    }

    // 9. XP + COINS
    if (d.xp > 0 || d.coins > 0 || d.battles.played > 0) {
      const battleLine = d.battles.played > 0
        ? `${d.battles.played} quiz battle${d.battles.played === 1 ? '' : 's'} · ${d.battles.won} won`
        : '';
      slides.push({
        bg: 'ww-bg-xp',
        html: `
          <div class="ww-kicker">Points racked up</div>
          <div style="display:flex; gap:28px; align-items:baseline; justify-content:center; flex-wrap:wrap; margin-top:10px;">
            <div>
              <div class="ww-big-num" style="font-size: clamp(3.5rem, 14vw, 7.5rem);">${d.xp}</div>
              <div class="ww-kicker" style="margin-top:6px;">XP</div>
            </div>
            <div>
              <div class="ww-big-num" style="font-size: clamp(3.5rem, 14vw, 7.5rem);">${d.coins}</div>
              <div class="ww-kicker" style="margin-top:6px;">Coins</div>
            </div>
          </div>
          ${battleLine ? `<div class="ww-caption" style="margin-top:22px;">${escapeHtml(battleLine)}</div>` : ''}
        `,
      });
    }

    // WEEKLY GOALS
    if (d.goals && d.goals.total > 0) {
      const goalRows = d.goals.items.slice(0, 3).map(item => {
        const currentNum = Number(item.current || 0);
        const targetNum = Number(item.target || 0);
        const current = currentNum % 1 === 0 ? String(currentNum) : currentNum.toFixed(1);
        const target = targetNum % 1 === 0 ? String(targetNum) : targetNum.toFixed(1);
        return `
          <div style="width:min(82vw,420px);background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.16);border-radius:16px;padding:12px 14px;margin:8px auto;text-align:left;">
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline;">
              <div style="font-size:.95rem;font-weight:850;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(item.label)}</div>
              <div style="font-size:.9rem;font-weight:950;color:${item.complete ? '#bbf7d0' : '#e0f2fe'};white-space:nowrap;">${escapeHtml(current)} / ${escapeHtml(target)}</div>
            </div>
            <div style="font-size:.68rem;color:rgba(255,255,255,.62);font-weight:800;text-transform:uppercase;letter-spacing:.08em;margin-top:3px;">${escapeHtml(item.category || item.unit || '')}</div>
          </div>
        `;
      }).join('');
      const arcLine = d.goals.arc && d.goals.arc.headline ? d.goals.arc.headline : '';
      const goalReward = d.goals.reward || {};
      const rewardLine = goalReward.just_awarded > 0
        ? `+${goalReward.just_awarded} XP paid in this Wrapped`
        : goalReward.awarded > 0
          ? `${goalReward.awarded} XP already paid from these goals`
          : goalReward.earned > 0 && goalReward.ready !== false
            ? `${goalReward.earned} XP earned from these goals`
            : goalReward.earned > 0
              ? `${goalReward.earned} XP unlocks at the end of the week`
              : 'No goal XP this week';
      const rewardSubline = goalReward.max > 0
        ? `10 XP per goal${goalReward.max >= 50 ? ' + 20 XP for a 3/3 week' : ''}`
        : 'Pick goals next week to earn Wrapped XP';
      slides.push({
        bg: 'ww-bg-social',
        html: `
          <div class="ww-halftone"></div>
          <div class="ww-kicker">Goals you chose</div>
          <div class="ww-big-num" style="font-size:clamp(4rem,16vw,8rem);">${d.goals.completed}/${d.goals.total}</div>
          <div class="ww-caption" style="margin-bottom:12px;">weekly goals hit</div>
          <div style="width:min(84vw,430px);margin:0 auto 12px;padding:12px 14px;border-radius:18px;background:rgba(253,230,138,0.16);border:1px solid rgba(253,230,138,0.34);box-shadow:0 14px 34px rgba(15,23,42,0.24);">
            <div style="font-size:1.05rem;font-weight:950;color:#fef3c7;">${escapeHtml(rewardLine)}</div>
            <div style="font-size:.72rem;font-weight:850;color:rgba(255,255,255,.72);margin-top:3px;text-transform:uppercase;letter-spacing:.06em;">${escapeHtml(rewardSubline)}</div>
          </div>
          ${goalRows}
          ${arcLine ? `<div class="ww-caption" style="margin-top:18px;font-size:.98rem;">${escapeHtml(arcLine)}</div>` : ''}
        `,
      });
    }

    // 10. PREDICTION
    const p = d.predictions;
    const predParts = [];
    if (p.next_week_workouts != null) {
      predParts.push(`<strong>${p.next_week_workouts}</strong> workouts`);
    }
    if (p.next_week_weight && p.next_week_weight.projected != null) {
      const delta = p.next_week_weight.weekly_delta;
      const sign = delta > 0 ? '+' : '';
      predParts.push(`<strong>${p.next_week_weight.projected}kg</strong> (${sign}${delta}kg)`);
    }
    if (p.next_week_mood != null) {
      predParts.push(`mood around <strong>${p.next_week_mood}/10</strong>`);
    }
    const predBody = predParts.length
      ? `At this pace you're on track for ${predParts.join(' · ')}.`
      : `Keep logging — we need 2+ weeks of data to forecast your trend.`;
    slides.push({
      bg: 'ww-bg-predict',
      html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-kicker">Next week's forecast</div>
        <div class="ww-big-num" style="font-size: clamp(4rem, 16vw, 8.5rem);">→</div>
        <div class="ww-caption" style="font-size:1.15rem; max-width:90%;">${predBody}</div>
        <button class="ww-cta-btn" data-ww-finish>Let's go</button>
      `,
      hold_ms: 8000,
    });

    return slides;
  }

  // ============================================================
  //  Marketing Reels — one per feature (+ a full app promo)
  //
  //  Each reel is a screen-recordable slideshow for IG/TikTok with
  //  an emotional problem → solution → payoff arc. All reuse the
  //  same anime-style slide engine, animations, and music synth.
  //
  //  Registry below maps reel id → { name, theme, build, needsFitgotchi }.
  //  Admin dashboard renders a picker with these.
  // ============================================================

  // Shared logo + CTA (every reel ends with the same download card)
  const REEL_LOGO = `<img src="/balance_logo.png" alt="Balance" style="width:clamp(140px, 42vw, 220px); height:clamp(140px, 42vw, 220px); border-radius:50%; border:5px solid #000; box-shadow:10px 10px 0 #000; background:white; object-fit:cover; animation: wwCountPop 0.85s cubic-bezier(.2,1.8,.3,1) both;">`;

  function ctaSlide(){
    return {
      bg: 'ww-bg-intro',
      html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-halftone"></div>
        ${REEL_LOGO}
        <div class="ww-big-num" style="font-size: clamp(2.2rem, 9vw, 4.4rem); margin-top:22px; line-height:1;">BALANCE</div>
        <div class="ww-caption" style="font-size:0.95rem; margin-top:6px; opacity:0.92;">Fitness Gamified</div>
        <div style="display:flex; gap:10px; margin-top:26px; flex-wrap:wrap; justify-content:center;">
          <div class="ww-store-pill">📱 App Store</div>
          <div class="ww-store-pill">▶ Google Play</div>
        </div>
        <div class="ww-stamp gold" style="margin-top:22px;">DOWNLOAD FREE</div>
        <button class="ww-cta-btn" data-ww-finish style="margin-top:24px;">Done</button>
      `,
      hold_ms: 8000,
    };
  }

  // ────────────────────────────────────────────────────────────
  //  REEL 1 — Calorie Tracker ("finally a tracker that's easy")
  // ────────────────────────────────────────────────────────────

  function buildCalorieReel(){
    return [
      { bg: 'ww-bg-intro', hold_ms: 4000, html: `
        <div class="ww-halftone"></div>
        <div class="ww-kicker">Be honest…</div>
        <div class="ww-big-num" style="font-size: clamp(2.6rem, 11vw, 5rem); line-height:1.05;">you quit<br>MyFitnessPal.</div>
      `},
      { bg: 'ww-bg-workouts', hold_ms: 4200, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-kicker">Endless menus.</div>
        <div class="ww-big-num" style="font-size: clamp(3rem, 12vw, 6rem);">😩</div>
        <div class="ww-caption">Wrong portions. Guessing grams. 20 taps per meal.</div>
      `},
      { bg: 'ww-bg-minutes', hold_ms: 4500, html: `
        <div class="ww-halftone"></div>
        <div class="ww-kicker">We fixed it.</div>
        <div class="ww-big-num" style="font-size: clamp(4rem, 18vw, 9rem);">📸</div>
        <div class="ww-caption"><strong>Snap a photo.</strong> AI logs calories + macros in 3 seconds.</div>
        <div class="ww-stamp green" style="margin-top:22px;">3 SECONDS</div>
      `},
      { bg: 'ww-bg-xp', hold_ms: 4500, html: `
        <div class="ww-kicker">Or…</div>
        <div style="font-size: clamp(3rem, 13vw, 6.5rem); line-height:1;">📱<br>🗣️<br>🏷️</div>
        <div class="ww-caption">Barcode scan · voice input · save favourites · re-log in one tap.</div>
      `},
      { bg: 'ww-bg-mood', hold_ms: 4500, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-kicker">The tracker that doesn't</div>
        <div class="ww-big-num" style="font-size: clamp(3.5rem, 14vw, 7rem); line-height:1;">KILL<br>your<br>streak.</div>
      `},
      { bg: 'ww-bg-predict', hold_ms: 4500, html: `
        <div class="ww-kicker">Finally</div>
        <div class="ww-big-num" style="font-size: clamp(2.6rem, 11vw, 5rem); line-height:1.1;">a tracker<br>you'll keep<br>opening.</div>
        <div class="ww-stamp blue" style="margin-top:22px;">NO GUESSWORK</div>
      `},
      ctaSlide(),
    ];
  }

  // ────────────────────────────────────────────────────────────
  //  REEL 2 — FitGotchi ("what if fitness had a face?")
  // ────────────────────────────────────────────────────────────

  function buildFitgotchiReel(){
    const MOUNT = `<div class="ww-fitgotchi-mount" style="width:clamp(240px, 64vw, 340px); height:clamp(240px, 64vw, 340px); display:flex; align-items:center; justify-content:center; position:relative; z-index:2;"></div>`;
    return [
      { bg: 'ww-bg-intro', hold_ms: 3800, html: `
        <div class="ww-halftone"></div>
        <div class="ww-big-num" style="font-size: clamp(2.6rem, 11vw, 5rem); line-height:1.05;">what if<br>fitness<br>had a<br>face?</div>
      `},
      { bg: 'ww-bg-predict', hold_ms: 5500, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-kicker">Meet your FitGotchi</div>
        ${MOUNT}
        <div class="ww-caption" style="margin-top:12px;">Feed it. Train it. Watch it evolve.</div>
      `},
      { bg: 'ww-bg-streak', hold_ms: 4500, html: `
        <div class="ww-halftone"></div>
        <div class="ww-kicker">Skip a workout?</div>
        <div class="ww-big-num" style="font-size: clamp(4rem, 18vw, 9rem);">😴</div>
        <div class="ww-caption">Your FitGotchi knows. It loses energy when you do.</div>
      `},
      { bg: 'ww-bg-social', hold_ms: 4500, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-kicker">BATTLE MODE</div>
        <div class="ww-big-num" style="font-size: clamp(4rem, 18vw, 9rem);">⚔️</div>
        <div class="ww-caption">Challenge your mates. Your FitGotchi vs theirs. Stats brawl.</div>
        <div class="ww-stamp" style="margin-top:20px;">BET COINS</div>
      `},
      { bg: 'ww-bg-pbs', hold_ms: 4500, html: `
        <div class="ww-halftone"></div>
        <div class="ww-kicker" style="color:#1a0a00;">Winner takes</div>
        <div class="ww-big-num" style="font-size: clamp(4rem, 18vw, 9rem); color:#1a0a00; text-shadow: 4px 4px 0 #fff;">🪙</div>
        <div class="ww-caption" style="color:#1a0a00; font-weight:700;">The whole pot. Rare skin drops. Flex forever.</div>
      `},
      { bg: 'ww-bg-xp', hold_ms: 4500, html: `
        <div class="ww-kicker">Video-game motivation</div>
        <div class="ww-big-num" style="font-size: clamp(2.6rem, 11vw, 5rem); line-height:1.1;">for<br>real-life<br>gains.</div>
        <div class="ww-stamp purple" style="margin-top:20px;">EVOLVE</div>
      `},
      ctaSlide(),
    ];
  }

  // ────────────────────────────────────────────────────────────
  //  REEL 3 — Learning ("no more guesswork")
  // ────────────────────────────────────────────────────────────

  function buildLearningReel(){
    return [
      { bg: 'ww-bg-intro', hold_ms: 4000, html: `
        <div class="ww-halftone"></div>
        <div class="ww-kicker">Instagram said protein.</div>
        <div class="ww-caption" style="font-size:1.05rem; max-width:88%;">TikTok said keto. YouTube said carnivore, vegan, and keto again.</div>
        <div class="ww-big-num" style="font-size: clamp(3rem, 13vw, 6.5rem); margin-top:18px;">🤯</div>
      `},
      { bg: 'ww-bg-workouts', hold_ms: 4200, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-kicker">You're not confused.</div>
        <div class="ww-big-num" style="font-size: clamp(3rem, 12vw, 5.8rem); line-height:1.05;">you're<br>lied to.</div>
      `},
      { bg: 'ww-bg-xp', hold_ms: 4800, html: `
        <div class="ww-halftone"></div>
        <div class="ww-kicker">Learn the science.</div>
        <div class="ww-big-num" style="font-size: clamp(4rem, 18vw, 9rem);">🎓</div>
        <div class="ww-caption">Duolingo-style lessons. 5 minutes a day.</div>
      `},
      { bg: 'ww-bg-mood', hold_ms: 4500, html: `
        <div class="ww-kicker">Brain · hormones · hydration</div>
        <div style="font-size: clamp(3rem, 13vw, 6.5rem);">🧠 💪 🥦</div>
        <div class="ww-caption">Sleep · recovery · cycle syncing · protein timing.</div>
      `},
      { bg: 'ww-bg-predict', hold_ms: 4500, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-kicker">Score 100%</div>
        <div class="ww-big-num" style="font-size: clamp(4rem, 18vw, 9rem);">+25 XP</div>
        <div class="ww-caption">Level up your Gotchi AND your body.</div>
      `},
      { bg: 'ww-bg-weight', hold_ms: 4500, html: `
        <div class="ww-halftone"></div>
        <div class="ww-kicker">No more guessing.</div>
        <div class="ww-big-num" style="font-size: clamp(3rem, 12vw, 6rem); line-height:1.1;">you just<br>KNOW.</div>
      `},
      ctaSlide(),
    ];
  }

  // ────────────────────────────────────────────────────────────
  //  REEL 4 — The Feed ("private. your mates. real motivation.")
  // ────────────────────────────────────────────────────────────

  function buildFeedReel(){
    return [
      { bg: 'ww-bg-intro', hold_ms: 4000, html: `
        <div class="ww-halftone"></div>
        <div class="ww-kicker">Instagram was a</div>
        <div class="ww-big-num" style="font-size: clamp(3rem, 12vw, 6rem); line-height:1.05;">highlight<br>reel.</div>
        <div class="ww-caption">Not motivation.</div>
      `},
      { bg: 'ww-bg-social', hold_ms: 4500, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-kicker">Strangers with filters</div>
        <div class="ww-big-num" style="font-size: clamp(4rem, 18vw, 9rem);">😞</div>
        <div class="ww-caption">killed your confidence instead of fuelling it.</div>
      `},
      { bg: 'ww-bg-workouts', hold_ms: 4500, html: `
        <div class="ww-halftone"></div>
        <div class="ww-kicker">Your feed.</div>
        <div class="ww-big-num" style="font-size: clamp(3rem, 12vw, 6rem); line-height:1.05;">your<br>mates.<br>your wins.</div>
      `},
      { bg: 'ww-bg-minutes', hold_ms: 4500, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-kicker">Share the real stuff</div>
        <div style="font-size: clamp(2.8rem, 12vw, 5.5rem);">🏋️ 📸 📈</div>
        <div class="ww-caption">Workouts. PBs. Progress photos. Gym selfies. Real reactions.</div>
      `},
      { bg: 'ww-bg-weight', hold_ms: 4500, html: `
        <div class="ww-halftone"></div>
        <div class="ww-kicker">Private by default</div>
        <div class="ww-big-num" style="font-size: clamp(4rem, 18vw, 9rem);">🔒</div>
        <div class="ww-caption">Only people you invite. No randoms. No hate.</div>
        <div class="ww-stamp green" style="margin-top:18px;">SAFE SPACE</div>
      `},
      { bg: 'ww-bg-xp', hold_ms: 4500, html: `
        <div class="ww-kicker">The accountability group</div>
        <div class="ww-big-num" style="font-size: clamp(2.8rem, 12vw, 5.5rem); line-height:1.1;">you wished<br>you had.</div>
      `},
      ctaSlide(),
    ];
  }

  // ────────────────────────────────────────────────────────────
  //  REEL 5 — Cycle Sync ("your body doesn't work like his")
  // ────────────────────────────────────────────────────────────

  function buildCycleReel(){
    return [
      { bg: 'ww-bg-intro', hold_ms: 4200, html: `
        <div class="ww-halftone"></div>
        <div class="ww-big-num" style="font-size: clamp(3rem, 12vw, 6rem); line-height:1.05;">your<br>body<br>doesn't<br>work<br>like his.</div>
      `},
      { bg: 'ww-bg-workouts', hold_ms: 4200, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-kicker">Every other app</div>
        <div class="ww-caption" style="font-size:1.05rem;">gives you the same program a 25-year-old man gets. Then wonders why you plateau.</div>
      `},
      { bg: 'ww-bg-mood', hold_ms: 4800, html: `
        <div class="ww-halftone"></div>
        <div class="ww-kicker">BALANCE syncs to YOU</div>
        <div style="font-size: clamp(3rem, 13vw, 6.5rem);">🌸</div>
        <div class="ww-caption">Log your cycle once. We handle the rest.</div>
      `},
      { bg: 'ww-bg-pbs', hold_ms: 5200, html: `
        <div class="ww-halftone"></div>
        <div class="ww-kicker" style="color:#1a0a00;">Follicular</div>
        <div class="ww-big-num" style="font-size: clamp(2.4rem, 10vw, 4.5rem); color:#1a0a00; line-height:1.1;">lift<br>heavy.</div>
        <div class="ww-caption" style="color:#1a0a00; font-weight:700; margin-top:10px;">Luteal → pull back · Menstrual → recover.</div>
      `},
      { bg: 'ww-bg-weight', hold_ms: 4500, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-kicker">Period tracker · phase guidance</div>
        <div style="font-size: clamp(3rem, 13vw, 6rem);">📅 ♀️</div>
        <div class="ww-caption">Daily nudges, nutrition tweaks, mood check-ins.</div>
      `},
      { bg: 'ww-bg-predict', hold_ms: 4500, html: `
        <div class="ww-kicker">Train WITH your body.</div>
        <div class="ww-big-num" style="font-size: clamp(2.8rem, 12vw, 5.5rem); line-height:1.05;">not<br>against<br>it.</div>
        <div class="ww-stamp purple" style="margin-top:20px;">FINALLY</div>
      `},
      ctaSlide(),
    ];
  }

  // ────────────────────────────────────────────────────────────
  //  REEL 6 — Quiz Battles ("gym arguments have a winner now")
  // ────────────────────────────────────────────────────────────

  function buildBattlesReel(){
    return [
      { bg: 'ww-bg-intro', hold_ms: 4000, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-big-num" style="font-size: clamp(3rem, 13vw, 6.5rem); line-height:1.05;">gym<br>arguments</div>
      `},
      { bg: 'ww-bg-social', hold_ms: 3800, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-kicker">have a</div>
        <div class="ww-big-num" style="font-size: clamp(4rem, 18vw, 9rem); line-height:1;">WINNER</div>
        <div class="ww-kicker" style="margin-top:6px;">now.</div>
      `},
      { bg: 'ww-bg-workouts', hold_ms: 4500, html: `
        <div class="ww-halftone"></div>
        <div class="ww-kicker">⚡ QUIZ BATTLE ⚡</div>
        <div class="ww-big-num" style="font-size: clamp(4rem, 18vw, 9rem);">15</div>
        <div class="ww-caption">fitness questions. Fastest + most correct wins.</div>
      `},
      { bg: 'ww-bg-pbs', hold_ms: 4500, html: `
        <div class="ww-halftone"></div>
        <div class="ww-kicker" style="color:#1a0a00;">Bet coins</div>
        <div class="ww-big-num" style="font-size: clamp(4rem, 18vw, 9rem); color:#1a0a00;">🪙</div>
        <div class="ww-caption" style="color:#1a0a00; font-weight:700;">Winner takes the pot. Loser does the dishes.</div>
      `},
      { bg: 'ww-bg-predict', hold_ms: 4500, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-kicker">Same 15 Qs, same order</div>
        <div class="ww-big-num" style="font-size: clamp(3.5rem, 14vw, 7rem);">⚔️</div>
        <div class="ww-caption">Pure skill. No luck. Your knowledge vs theirs.</div>
      `},
      { bg: 'ww-bg-streak', hold_ms: 4500, html: `
        <div class="ww-halftone"></div>
        <div class="ww-kicker">Finally</div>
        <div class="ww-big-num" style="font-size: clamp(2.8rem, 12vw, 5.5rem); line-height:1.1;">a way to<br>settle it.</div>
        <div class="ww-stamp" style="margin-top:18px;">TRASH TALK READY</div>
      `},
      ctaSlide(),
    ];
  }

  // ────────────────────────────────────────────────────────────
  //  REEL 7 — Level 55 character unlocks
  // ────────────────────────────────────────────────────────────

  function levelSagaBolts(){
    return `
      <div class="ww-energy-bolt" style="left:12%; top:18%; --r:-24deg; --y:0; --d:0s;"></div>
      <div class="ww-energy-bolt" style="right:13%; top:16%; --r:28deg; --y:10px; --d:0.16s;"></div>
      <div class="ww-energy-bolt" style="left:24%; bottom:14%; --r:18deg; --y:-8px; --d:0.32s;"></div>
      <div class="ww-energy-bolt" style="right:24%; bottom:12%; --r:-18deg; --y:4px; --d:0.48s;"></div>
    `;
  }

  function powerOrbRing(coreText){
    const positions = [
      ['50%', '4%'], ['84%', '19%'], ['96%', '54%'], ['72%', '88%'],
      ['28%', '88%'], ['4%', '54%'], ['16%', '19%'],
    ];
    const orbs = positions.map((p, i) => `
      <div class="ww-wish-orb" style="--x:${p[0]}; --y:${p[1]}; --delay:${(i * 0.08).toFixed(2)}s;"><span>${i + 1}</span></div>
    `).join('');
    return `<div class="ww-orb-ring">${orbs}<div class="ww-ki-core">${escapeHtml(coreText || '55')}</div></div>`;
  }

  function levelLadder(levels){
    return `
      <div class="ww-level-ladder">
        ${levels.map((item, i) => {
          const level = typeof item === 'object' ? item.level : item;
          return `
          <div class="ww-level-node" style="--delay:${(0.1 + i * 0.1).toFixed(2)}s;">
            <strong>LVL ${escapeHtml(level)}</strong>
          </div>
        `; }).join('')}
      </div>
    `;
  }

  function levelSagaLogoFinalSlide(){
    return {
      bg: 'ww-bg-level-saga',
      hold_ms: 8000,
      html: `
        <div class="ww-ki-aura"></div>
        ${levelSagaBolts()}
        <div class="ww-speed-lines"></div>
        <div class="ww-halftone"></div>
        ${REEL_LOGO}
        <div class="ww-big-num" style="font-size: clamp(2.2rem, 9vw, 4.4rem); margin-top:22px; line-height:1;">BALANCE</div>
        <div class="ww-caption" style="font-size:0.95rem; margin-top:6px; opacity:0.92;">Fitness Gamified</div>
        <div class="ww-caption" style="margin-top:16px;">Unlock the DBZ saga from LVL 55. Keep grinding and build the roster every 5 levels.</div>
        <div style="display:flex; gap:10px; margin-top:24px; flex-wrap:wrap; justify-content:center; position:relative; z-index:2;">
          <div class="ww-store-pill">📱 App Store</div>
          <div class="ww-store-pill">▶ Google Play</div>
        </div>
        <button class="ww-cta-btn" data-ww-finish style="margin-top:24px;">Done</button>
      `,
    };
  }

  function buildLevelCharacterReel(){
    return [
      { bg: 'ww-bg-level-saga', hold_ms: 4200, html: `
        <div class="ww-ki-aura"></div>
        ${levelSagaBolts()}
        <div class="ww-speed-lines"></div>
        <div class="ww-halftone"></div>
        <div class="ww-kicker">Feature drop</div>
        <div class="ww-big-num" style="font-size: clamp(2.5rem, 10.5vw, 5.2rem); line-height:1;">UNLOCK THE<br>DBZ SAGA</div>
        <div class="ww-stamp gold" style="margin-top:22px;">FROM LVL 55</div>
      `},
      { bg: 'ww-bg-level-saga', hold_ms: 5000, html: `
        <div class="ww-ki-aura"></div>
        ${levelSagaBolts()}
        <div class="ww-speed-lines"></div>
        <div class="ww-kicker">Reach Level 55</div>
        ${powerOrbRing('55')}
        <div class="ww-caption">The first DBZ character drop lands. The saga begins.</div>
      `},
      { bg: 'ww-bg-pbs', hold_ms: 5000, html: `
        <div class="ww-halftone"></div>
        <div class="ww-kicker" style="color:#1a0a00;">Then every 5 levels</div>
        <div class="ww-big-num" style="font-size: clamp(2.8rem, 12vw, 5.8rem); color:#1a0a00; line-height:1.02; text-shadow:4px 4px 0 #fff, 8px 8px 0 rgba(255,255,255,0.45);">another<br>DBZ<br>legend</div>
        ${levelLadder([55, 60, 65, 70, 75])}
      `},
      { bg: 'ww-bg-level-saga', hold_ms: 5000, html: `
        <div class="ww-ki-aura"></div>
        ${levelSagaBolts()}
        <div class="ww-speed-lines"></div>
        <div class="ww-kicker">The saga keeps climbing</div>
        ${levelLadder([80, 85, 90, 95, 100])}
        <div class="ww-caption">Work your way through the full DBZ arc, one level gate at a time.</div>
      `},
      { bg: 'ww-bg-streak', hold_ms: 4700, html: `
        <div class="ww-halftone"></div>
        ${levelSagaBolts()}
        <div class="ww-kicker">Feed the power meter</div>
        <div style="font-size: clamp(3rem, 13vw, 6.5rem); line-height:1;">🏋️ 🥗 🧠 ⚔️</div>
        <div class="ww-caption">Workouts, meals, quizzes, challenges and streaks all push you toward the next skin.</div>
      `},
      { bg: 'ww-bg-level-saga', hold_ms: 5200, html: `
        <div class="ww-ki-aura"></div>
        ${levelSagaBolts()}
        <div class="ww-speed-lines"></div>
        ${powerOrbRing('100')}
        <div class="ww-kicker" style="margin-top:18px;">Build the DBZ roster</div>
        <div class="ww-caption">Level up, unlock the next character, keep powering up.</div>
        <div class="ww-stamp purple" style="margin-top:18px;">POWER UP</div>
      `},
      levelSagaLogoFinalSlide(),
    ];
  }

  // ────────────────────────────────────────────────────────────
  //  EDUCATIONAL — "Ask ChatGPT" series
  //  Same screen-record workflow as the promo reels, but reframed as
  //  a faux chat with ChatGPT. Indigo/cyan palette signals learn-mode
  //  instead of promo. Bubbles animate in with the user on the right
  //  (cyan) and ChatGPT on the left (grey), with labels + avatars so
  //  the viewer never has to guess who's talking.
  // ────────────────────────────────────────────────────────────

  /**
   * Build a chat-bubble slide with ONE bubble. The bubble fades in,
   * holds long enough to read, then the whole slide cross-fades to the
   * next one — the previous bubble disappears before the next appears.
   *
   * This is the preferred layout for the "Ask ChatGPT" series: easier
   * to read on a phone, lets each sentence land, and paces properly
   * for complex topics (up to 3 minutes).
   *
   *   who:     'user' | 'gpt'
   *   text:    bubble body (HTML allowed — <strong>, <em>, <br>, <ol>, <li>)
   *   hold_ms: how long to hold before advancing (default 3500)
   *   sectionLabel: optional persistent section header shown above the chat
   */
  // ------------------------------------------------------------
  //  REEL 8 - 30 Day Challenge Week 1 wrapped
  // ------------------------------------------------------------

  function compactNumber(n){
    const value = Number(n || 0);
    if (!Number.isFinite(value)) return '0';
    return value.toLocaleString('en-AU');
  }

  function parseDateOnly(value){
    if (!value) return null;
    if (value instanceof Date) {
      const d = new Date(value.getTime());
      d.setHours(0, 0, 0, 0);
      return Number.isFinite(d.getTime()) ? d : null;
    }
    const text = String(value);
    const d = text.length <= 10 ? new Date(text + 'T00:00:00') : new Date(text);
    if (!Number.isFinite(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function addDays(date, days){
    const d = new Date(date.getTime());
    d.setDate(d.getDate() + days);
    return d;
  }

  function shortDate(date){
    try {
      return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    } catch(_) {
      return formatDate(date);
    }
  }

  function challengeWeekWindow(challenge, weekNumber, opts){
    const now = new Date();
    const week = Math.max(1, Math.floor(Number(weekNumber || 1)) || 1);
    const cumulative = !!(opts && opts.cumulative);
    const spanDays = cumulative ? week * 7 : 7;
    const fallbackStart = addDays(now, -((cumulative ? spanDays : (((week - 1) * 7) + 7)) - 1));
    const challengeStart = parseDateOnly(challenge && challenge.start_date) || fallbackStart;
    const start = cumulative ? challengeStart : addDays(challengeStart, (week - 1) * 7);
    const fullEndExclusive = addDays(start, spanDays);
    const hasStarted = now.getTime() >= start.getTime();
    const isPartial = hasStarted && now.getTime() < fullEndExclusive.getTime();
    const endForIso = hasStarted
      ? (isPartial ? now : fullEndExclusive)
      : start;
    const dateEndExclusive = hasStarted
      ? (isPartial ? addDays(now, 1) : fullEndExclusive)
      : start;
    const labelEnd = hasStarted
      ? (isPartial ? now : addDays(fullEndExclusive, -1))
      : start;
    return {
      week,
      cumulative,
      start,
      endForIso,
      sinceIso: start.toISOString(),
      untilIso: endForIso.toISOString(),
      sinceDate: formatDate(start),
      untilDateExclusive: formatDate(dateEndExclusive),
      label: shortDate(start) + ' - ' + shortDate(labelEnd),
    };
  }

  function challengeTitle(challenge){
    if (!challenge) return '30 Day Challenge';
    const label = challenge.name || challenge.title || challenge.cohort_type || '30 Day Challenge';
    return String(label).replace(/_/g, ' ');
  }

  function normaliseCohorts(data){
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
      try { return normaliseCohorts(JSON.parse(data)); } catch(_) { return []; }
    }
    if (Array.isArray(data.cohorts)) return data.cohorts;
    if (data.error) return [];
    return [];
  }

  function pickChallengeCohort(cohorts, weekNumber){
    const today = formatDate(new Date());
    const now = new Date();
    const week = Math.max(1, Math.floor(Number(weekNumber || 1)) || 1);
    const scored = (cohorts || [])
      .filter(Boolean)
      .filter(c => {
        const name = String(c.name || c.title || c.cohort_type || '').toLowerCase();
        const duration = Number(c.duration_days || 0);
        return duration === 30 || name.includes('30') || name.includes('challenge') || name.includes('plant_based') || name.includes('transform');
      })
      .map(c => {
        let score = 0;
        if (c.status === 'active') score += 1000;
        if (Number(c.duration_days || 0) === 30) score += 200;
        if (String(c.cohort_type || '').includes('30')) score += 120;
        if (c.start_date && c.start_date <= today) score += 80;
        if (c.end_date && c.end_date >= today) score += 80;
        if (Array.isArray(c.participants) && c.participants.length) score += 40;
        const started = parseDateOnly(c.start_date);
        if (started) {
          const requestedWeekStart = addDays(started, (week - 1) * 7);
          if (requestedWeekStart.getTime() <= now.getTime()) score += 450;
          else score -= 5000;
          score += Math.floor(started.getTime() / DAY_MS) / 100000;
        }
        const type = String(c.cohort_type || '').toLowerCase();
        if (type === 'plant_based_30' || type === 'transform_30') score += 260;
        if (type.startsWith('manual_')) score -= 320;
        return { cohort: c, score };
      })
      .sort((a, b) => b.score - a.score);
    return scored[0] ? scored[0].cohort : null;
  }

  async function fetchChallengeCohorts(supabase){
    try {
      const { data, error } = await supabase.rpc('admin_get_cohorts');
      if (error) throw error;
      const cohorts = normaliseCohorts(data);
      if (cohorts.length) return cohorts;
    } catch(e) {
      console.warn('[challenge reel] admin_get_cohorts failed', e);
    }

    try {
      const { data, error } = await supabase
        .from('challenges')
        .select('id,name,challenge_type,status,start_date,end_date,duration_days,cohort_type,is_system_cohort,created_at')
        .eq('is_system_cohort', true)
        .order('start_date', { ascending: false })
        .limit(12);
      if (error) throw error;
      const cohorts = data || [];
      for (const cohort of cohorts) {
        const { data: participants, error: pError } = await supabase
          .from('challenge_participants')
          .select('user_id,status,current_points,challenge_points,accepted_at')
          .eq('challenge_id', cohort.id)
          .eq('status', 'accepted')
          .limit(500);
        if (!pError) cohort.participants = participants || [];
      }
      return cohorts;
    } catch(e) {
      console.warn('[challenge reel] direct cohort fetch failed', e);
      return [];
    }
  }

  async function safeChallengeRows(label, queryFactory){
    try {
      const { data, error } = await queryFactory();
      if (error) throw error;
      return Array.isArray(data) ? data : [];
    } catch(e) {
      console.warn('[challenge reel] ' + label + ' failed', e);
      return [];
    }
  }

  function countWorkoutSessions(rows){
    const keys = new Set();
    (rows || []).forEach(row => {
      const dateKey = row.workout_date || (row.created_at || '').slice(0, 10);
      if (!row.user_id || !dateKey) return;
      const template = String(row.template_name || 'Workout').trim().toLowerCase() || 'workout';
      keys.add(row.user_id + '__' + dateKey + '__' + template);
    });
    return keys.size;
  }

  function sumNumbers(rows, key){
    return (rows || []).reduce((total, row) => {
      const n = Number(row && row[key]);
      return Number.isFinite(n) ? total + n : total;
    }, 0);
  }

  function weightValue(row){
    const n = Number(row && (row.weight_kg ?? row.weight));
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function weightDate(row){
    return row && (row.weigh_in_date || row.created_at || row.log_date || '');
  }

  function formatWeightKg(n){
    const value = Math.round(Number(n || 0) * 10) / 10;
    return value.toLocaleString('en-AU', { maximumFractionDigits: 1 }) + 'kg';
  }

  function formatWeightDownKg(n){
    const value = round1(Number(n || 0));
    const suffix = Math.abs(value) === 1 ? 'kg' : 'kgs';
    return value.toLocaleString('en-AU', { maximumFractionDigits: 1 }) + suffix;
  }

  function calculateTeamWeightStats(rows){
    const byUser = new Map();
    (rows || []).forEach(row => {
      const weight = weightValue(row);
      const date = weightDate(row);
      if (!row.user_id || weight == null || !date) return;
      if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
      byUser.get(row.user_id).push({ weight, date });
    });

    let totalLost = 0;
    let netChange = 0;
    let usersWithTwo = 0;
    let usersDown = 0;

    byUser.forEach(entries => {
      entries.sort((a, b) => String(a.date).localeCompare(String(b.date)));
      if (entries.length < 2) return;
      const first = entries[0].weight;
      const last = entries[entries.length - 1].weight;
      const change = last - first;
      usersWithTwo += 1;
      netChange += change;
      if (change < 0) {
        totalLost += Math.abs(change);
        usersDown += 1;
      }
    });

    return {
      weighIns: (rows || []).length,
      trackedUsers: byUser.size,
      usersWithTwo,
      usersDown,
      totalLostKg: round1(totalLost),
      netChangeKg: round1(netChange),
    };
  }

  async function fetchChallengeWeighIns(supabase, participantIds, range){
    try {
      const { data, error } = await supabase
        .from('daily_weigh_ins')
        .select('user_id,weigh_in_date,weight_kg,created_at')
        .in('user_id', participantIds)
        .gte('weigh_in_date', range.sinceDate)
        .lt('weigh_in_date', range.untilDateExclusive)
        .limit(5000);
      if (error) throw error;
      return Array.isArray(data) ? data : [];
    } catch(e) {
      console.warn('[challenge reel] daily_weigh_ins primary fetch failed', e);
    }

    return safeChallengeRows('daily_weigh_ins fallback', () => supabase
      .from('daily_weigh_ins')
      .select('user_id,created_at,weight')
      .in('user_id', participantIds)
      .gte('created_at', range.sinceIso)
      .lt('created_at', range.untilIso)
      .limit(5000));
  }

  function uniqueRowUsers(groups){
    const ids = new Set();
    groups.forEach(rows => (rows || []).forEach(row => {
      if (row.user_id) ids.add(row.user_id);
    }));
    return ids.size;
  }

  async function buildChallengeWeekStats(weekNumber, opts){
    const supabase = window.supabaseClient;
    if (!supabase) throw new Error('Supabase client not ready');

    const cohorts = await fetchChallengeCohorts(supabase);
    const challenge = pickChallengeCohort(cohorts, weekNumber);
    if (!challenge) throw new Error('No 30 day challenge cohort found');

    const participants = Array.isArray(challenge.participants) ? challenge.participants : [];
    const participantIds = [...new Set(participants.map(p => p && p.user_id).filter(Boolean))];
    const range = challengeWeekWindow(challenge, weekNumber, opts);
    const week = range.week || Math.max(1, Math.floor(Number(weekNumber || 1)) || 1);

    if (!participantIds.length) {
      return {
        challenge,
        range,
        week,
        participants: 0,
        workouts: 0,
        meals: 0,
        pbs: 0,
        checkins: 0,
        progressPhotos: 0,
        weighIns: 0,
        moodLogs: 0,
        weightLostKg: 0,
        weightNetChangeKg: 0,
        weightTrackedUsers: 0,
        weightUsersWithTwo: 0,
        weightLossUsers: 0,
        points: 0,
        lessons: 0,
        healthIQQuizzes: 0,
        healthIQAnswers: 0,
        xp: 0,
        movementMinutes: 0,
        activeUsers: 0,
        leaderboard: [],
      };
    }

    const [
      workouts,
      pbs,
      mealsRaw,
      moodLogs,
      weighIns,
      progressPhotos,
      activityLogs,
      lessons,
    ] = await Promise.all([
      safeChallengeRows('workouts', () => supabase
        .from('workouts')
        .select('user_id,workout_date,template_name,created_at')
        .in('user_id', participantIds)
        .eq('workout_type', 'history')
        .eq('is_current_workout', false)
        .gte('workout_date', range.sinceDate)
        .lt('workout_date', range.untilDateExclusive)
        .limit(5000)),
      safeChallengeRows('pb_history', () => supabase
        .from('pb_history')
        .select('user_id,achieved_at,exercise_name,pb_type')
        .in('user_id', participantIds)
        .gte('achieved_at', range.sinceIso)
        .lt('achieved_at', range.untilIso)
        .limit(5000)),
      safeChallengeRows('meal_logs', () => supabase
        .from('meal_logs')
        .select('id,user_id,meal_date,meal_type,calories,created_at')
        .in('user_id', participantIds)
        .gte('meal_date', range.sinceDate)
        .lt('meal_date', range.untilDateExclusive)
        .limit(5000)),
      safeChallengeRows('mood_logs', () => supabase
        .from('mood_logs')
        .select('user_id,created_at,mood_score,energy_score')
        .in('user_id', participantIds)
        .gte('created_at', range.sinceIso)
        .lt('created_at', range.untilIso)
        .limit(5000)),
      fetchChallengeWeighIns(supabase, participantIds, range),
      safeChallengeRows('weekly_progress_photos', () => supabase
        .from('weekly_progress_photos')
        .select('user_id,created_at,photo_week')
        .in('user_id', participantIds)
        .gte('created_at', range.sinceIso)
        .lt('created_at', range.untilIso)
        .limit(5000)),
      safeChallengeRows('activity_logs', () => supabase
        .from('activity_logs')
        .select('user_id,activity_date,duration_minutes,activity_type')
        .in('user_id', participantIds)
        .gte('activity_date', range.sinceDate)
        .lt('activity_date', range.untilDateExclusive)
        .limit(5000)),
      safeChallengeRows('lesson_completions', () => supabase
        .from('lesson_completions')
        .select('user_id,completed_at,xp_earned,games_played')
        .in('user_id', participantIds)
        .gte('completed_at', range.sinceIso)
        .lt('completed_at', range.untilIso)
        .limit(5000)),
    ]);

    const meals = mealsRaw.filter(m => String(m.meal_type || '').toLowerCase() !== 'water');
    const workoutSessions = countWorkoutSessions(workouts);
    const activityMinutes = sumNumbers(activityLogs, 'duration_minutes');
    const weightStats = calculateTeamWeightStats(weighIns);
    const challengePoints = participants.reduce((total, p) => {
      const n = Number(p && (p.challenge_points ?? p.current_points));
      return Number.isFinite(n) ? total + n : total;
    }, 0);
    const leaderboard = buildChallengeLeaderboard(participants);
    const healthIQAnswers = Math.round(sumNumbers(lessons, 'games_played')) || lessons.length;

    return {
      challenge,
      range,
      week,
      participants: participantIds.length,
      workouts: workoutSessions,
      meals: meals.length,
      pbs: pbs.length,
      checkins: moodLogs.length + weighIns.length + progressPhotos.length,
      progressPhotos: progressPhotos.length,
      weighIns: weighIns.length,
      moodLogs: moodLogs.length,
      weightLostKg: weightStats.totalLostKg,
      weightNetChangeKg: weightStats.netChangeKg,
      weightTrackedUsers: weightStats.trackedUsers,
      weightUsersWithTwo: weightStats.usersWithTwo,
      weightLossUsers: weightStats.usersDown,
      points: Math.round(challengePoints),
      lessons: lessons.length,
      healthIQQuizzes: lessons.length,
      healthIQAnswers,
      xp: Math.round(sumNumbers(lessons, 'xp_earned')),
      movementMinutes: Math.round((workoutSessions * 45) + activityMinutes),
      activeUsers: uniqueRowUsers([workouts, pbs, meals, moodLogs, weighIns, progressPhotos, activityLogs, lessons]),
      leaderboard,
    };
  }

  async function buildChallengeWeekOneStats(){
    return buildChallengeWeekStats(1);
  }

  function challengeTape(text){
    const safe = escapeHtml(text);
    return `
      <div class="ww-challenge-tape top"><span>${safe}</span><span>${safe}</span><span>${safe}</span></div>
      <div class="ww-challenge-tape bottom"><span>${safe}</span><span>${safe}</span><span>${safe}</span></div>
    `;
  }

  function challengeLeaderName(participant, fallbackIndex){
    const directName = participant && (participant.name || participant.full_name || participant.display_name || participant.username);
    let name = String(directName || '').replace(/\s+/g, ' ').trim();
    if (!name) name = 'Member ' + fallbackIndex;
    const pieces = name.split(/\s+/).filter(Boolean);
    name = pieces.slice(0, 2).join(' ') || ('Member ' + fallbackIndex);
    return name.length > 18 ? name.slice(0, 15).trim() + '...' : name;
  }

  function buildChallengeLeaderboard(participants){
    return (participants || [])
      .map((participant, index) => {
        const points = Number(participant && (participant.challenge_points ?? participant.current_points));
        return {
          name: challengeLeaderName(participant, index + 1),
          points: Number.isFinite(points) ? Math.round(points) : 0,
        };
      })
      .sort((a, b) => (b.points - a.points) || a.name.localeCompare(b.name))
      .slice(0, 5)
      .map((participant, index) => ({
        rank: index + 1,
        name: participant.name,
        points: participant.points,
      }));
  }

  function challengeLeaderboardRows(rows){
    const leaders = Array.isArray(rows) ? rows.slice(0, 5) : [];
    if (!leaders.length) {
      return `<div class="ww-challenge-bar"><span>Leaderboard</span><span>0 pts</span></div>`;
    }
    return leaders.map((leader, index) => `
      <div class="ww-challenge-bar" style="--delay:${(index * 0.08).toFixed(2)}s;">
        <span>#${compactNumber(leader.rank)} ${escapeHtml(leader.name)}</span>
        <span>${compactNumber(leader.points)} pts</span>
      </div>
    `).join('');
  }

  function buildChallengeWeekOneSlides(stats){
    const title = challengeTitle(stats.challenge);
    const range = stats.range && stats.range.label ? stats.range.label : 'Week 1';
    const members = compactNumber(stats.participants);
    const activeUsers = compactNumber(stats.activeUsers);
    const workouts = compactNumber(stats.workouts);
    const meals = compactNumber(stats.meals);
    const pbs = compactNumber(stats.pbs);
    const checkins = compactNumber(stats.checkins);
    const points = compactNumber(stats.points);
    const minutes = compactNumber(stats.movementMinutes);
    const lessons = compactNumber(stats.lessons);

    return [
      { bg: 'ww-bg-challenge-week', hold_ms: 2400, html: `
        ${challengeTape('week 1 wrapped')}
        <div class="ww-challenge-pill green">30 day challenge</div>
        <div class="ww-big-num" style="font-size: clamp(2.7rem, 12vw, 5.9rem); line-height:0.96; color:#f8f3e7; text-shadow:5px 5px 0 #101820; margin-top:18px;">WEEK 1<br>WRAPPED</div>
        <div class="ww-caption" style="max-width:88%; color:#f8f3e7;">${escapeHtml(title)}<br>${escapeHtml(range)} &middot; ${members} challengers</div>
      `},
      { bg: 'ww-bg-challenge-action', hold_ms: 2600, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-challenge-pill">team total</div>
        <div class="ww-big-num" style="font-size: clamp(5rem, 24vw, 12rem); color:#f8f3e7; text-shadow:6px 6px 0 #101820;">${workouts}</div>
        <div class="ww-caption" style="color:#fff; font-weight:900;">workouts completed</div>
        <div class="ww-challenge-pill coral" style="margin-top:20px;">approx ${minutes} training minutes</div>
      `},
      { bg: 'ww-bg-challenge-night', hold_ms: 2600, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-challenge-pill coral">records board</div>
        <div class="ww-big-num" style="font-size: clamp(5rem, 24vw, 12rem); color:#f3d36b; text-shadow:6px 6px 0 #101820, 0 0 28px rgba(243,211,107,0.45);">${pbs}</div>
        <div class="ww-big-num" style="font-size: clamp(1.8rem, 8vw, 3.7rem); color:#fff; line-height:1; text-shadow:4px 4px 0 #101820;">PBs HIT</div>
        <div class="ww-caption" style="color:#fff; font-weight:900; margin-top:8px;">in week one</div>
      `},
      { bg: 'ww-bg-challenge-night', hold_ms: 2600, html: `
        ${challengeTape('tracked - trained - showed up')}
        <div class="ww-challenge-pill coral">nutrition stack</div>
        <div class="ww-big-num" style="font-size: clamp(5rem, 24vw, 12rem); color:#f3d36b; text-shadow:6px 6px 0 #101820, 0 0 28px rgba(243,211,107,0.42);">${meals}</div>
        <div class="ww-caption" style="max-width:86%; color:#fff; font-weight:900;">meals tracked</div>
        <div class="ww-challenge-pill green" style="margin-top:18px; max-width:86%; white-space:normal; text-align:center; line-height:1.2;">breakfasts &middot; lunches &middot; dinners &middot; snacks</div>
      `},
      { bg: 'ww-bg-challenge-night', hold_ms: 2700, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-challenge-pill green">all the little wins</div>
        <div class="ww-challenge-scorecard" style="margin-top:22px;">
          <div class="ww-challenge-scorecell"><strong>${checkins}</strong><span>check-ins</span></div>
          <div class="ww-challenge-scorecell"><strong>${points}</strong><span>challenge pts</span></div>
          <div class="ww-challenge-scorecell"><strong>${lessons}</strong><span>lessons</span></div>
          <div class="ww-challenge-scorecell"><strong>${activeUsers}</strong><span>active members</span></div>
        </div>
      `},
      { bg: 'ww-bg-challenge-action', hold_ms: 2500, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-halftone"></div>
        <div class="ww-challenge-pill green">week 2 is coming</div>
        <div class="ww-big-num" style="font-size: clamp(2.7rem, 12vw, 5.6rem); color:#f8f3e7; line-height:0.98; text-shadow:6px 6px 0 #101820;">CAN YOU FEEL<br>THE MOMENTUM?</div>
        <div class="ww-caption" style="color:#fff; font-weight:900;">Are you next?</div>
      `},
      { bg: 'ww-bg-challenge-score', hold_ms: 2500, html: `
        <div class="ww-halftone"></div>
        <div class="ww-challenge-logo-final">
          ${REEL_LOGO}
          <div class="ww-big-num" style="font-size: clamp(2.3rem, 9vw, 4.5rem); color:#101820; line-height:1; text-shadow:4px 4px 0 #f8f3e7;">BALANCE</div>
          <div class="ww-caption" style="color:#101820; font-weight:900;">Week 2 starts Monday.</div>
          <div class="ww-challenge-pill green">keep showing up</div>
        </div>
        <button class="ww-cta-btn" data-ww-finish style="margin-top:18px;">Done</button>
      `},
    ];
  }

  async function buildChallengeWeekOneReel(){
    try {
      const stats = await buildChallengeWeekOneStats();
      return buildChallengeWeekOneSlides(stats);
    } catch(e) {
      console.warn('[challenge reel] build failed', e);
      return buildChallengeWeekOneSlides({
        challenge: { name: '30 Day Challenge' },
        range: { label: 'Week 1' },
        participants: 0,
        activeUsers: 0,
        workouts: 0,
        meals: 0,
        pbs: 0,
        checkins: 0,
        weighIns: 0,
        weightLostKg: 0,
        weightNetChangeKg: 0,
        weightTrackedUsers: 0,
        weightUsersWithTwo: 0,
        weightLossUsers: 0,
        points: 0,
        lessons: 0,
        movementMinutes: 0,
      });
    }
  }

  function buildChallengeWeekTwoSlides(stats){
    const title = challengeTitle(stats.challenge);
    const range = stats.range && stats.range.label ? stats.range.label : 'Week 2';
    const members = compactNumber(stats.participants);
    const activeUsers = compactNumber(stats.activeUsers);
    const workouts = compactNumber(stats.workouts);
    const meals = compactNumber(stats.meals);
    const pbs = compactNumber(stats.pbs);
    const checkins = compactNumber(stats.checkins);
    const points = compactNumber(stats.points);
    const minutes = compactNumber(stats.movementMinutes);
    const healthIQAnswers = compactNumber(stats.healthIQAnswers ?? stats.healthIQQuizzes ?? stats.lessons);

    return [
      { bg: 'ww-bg-challenge-week', hold_ms: 2400, html: `
        ${challengeTape('week 2 review')}
        <div class="ww-challenge-pill green">30 day challenge</div>
        <div class="ww-big-num" style="font-size: clamp(2.7rem, 12vw, 5.9rem); line-height:0.96; color:#f3d36b; -webkit-text-stroke:3px #101820; text-shadow:5px 5px 0 #101820, 0 0 24px rgba(248,243,231,0.35); margin-top:18px;">WEEK 2<br>REVIEW</div>
        <div class="ww-caption" style="max-width:88%; color:#101820; background:#f8f3e7; border:3px solid #101820; border-radius:6px; padding:10px 14px; box-shadow:5px 5px 0 #101820; font-weight:900;">${escapeHtml(title)}<br>${escapeHtml(range)} &middot; ${members} challengers</div>
      `},
      { bg: 'ww-bg-challenge-action', hold_ms: 2600, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-challenge-pill">two-week total</div>
        <div class="ww-big-num" style="font-size: clamp(5rem, 24vw, 12rem); color:#f8f3e7; text-shadow:6px 6px 0 #101820;">${workouts}</div>
        <div class="ww-caption" style="color:#fff; font-weight:900;">workouts completed</div>
        <div class="ww-challenge-pill coral" style="margin-top:20px;">approx ${minutes} training minutes</div>
      `},
      { bg: 'ww-bg-challenge-night', hold_ms: 2600, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-challenge-pill coral">records board</div>
        <div class="ww-big-num" style="font-size: clamp(5rem, 24vw, 12rem); color:#f3d36b; text-shadow:6px 6px 0 #101820, 0 0 28px rgba(243,211,107,0.45);">${pbs}</div>
        <div class="ww-big-num" style="font-size: clamp(1.8rem, 8vw, 3.7rem); color:#fff; line-height:1; text-shadow:4px 4px 0 #101820;">PBs HIT</div>
        <div class="ww-caption" style="color:#fff; font-weight:900; margin-top:8px;">across weeks one and two</div>
      `},
      { bg: 'ww-bg-challenge-night', hold_ms: 2600, html: `
        ${challengeTape('tracked - trained - backed it up')}
        <div class="ww-challenge-pill coral">nutrition stack</div>
        <div class="ww-big-num" style="font-size: clamp(5rem, 24vw, 12rem); color:#f3d36b; text-shadow:6px 6px 0 #101820, 0 0 28px rgba(243,211,107,0.42);">${meals}</div>
        <div class="ww-caption" style="max-width:86%; color:#fff; font-weight:900;">meals tracked</div>
        <div class="ww-challenge-pill green" style="margin-top:18px; max-width:86%; white-space:normal; text-align:center; line-height:1.2;">breakfasts &middot; lunches &middot; dinners &middot; snacks</div>
      `},
      { bg: 'ww-bg-challenge-action', hold_ms: 2500, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-halftone"></div>
        <div class="ww-challenge-pill green">health iq</div>
        <div class="ww-big-num" style="font-size: clamp(5rem, 24vw, 12rem); color:#f8f3e7; text-shadow:6px 6px 0 #101820;">${healthIQAnswers}</div>
        <div class="ww-caption" style="color:#fff; font-weight:900;">questions answered</div>
        <div class="ww-challenge-pill coral" style="margin-top:20px;">knowledge reps count too</div>
      `},
      { bg: 'ww-bg-challenge-score', hold_ms: 2600, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-halftone"></div>
        <div class="ww-challenge-pill coral">team progress</div>
        <div class="ww-big-num" style="font-size: clamp(4.8rem, 22vw, 11rem); color:#f8f3e7; -webkit-text-stroke:4px #101820; text-shadow:6px 6px 0 #101820, 0 0 30px rgba(243,211,107,0.5);">2.6kgs</div>
        <div class="ww-big-num" style="font-size: clamp(1.8rem, 8vw, 3.7rem); color:#f8f3e7; -webkit-text-stroke:2px #101820; line-height:1; text-shadow:3px 3px 0 #101820, 0 0 18px rgba(243,211,107,0.45);">DOWN</div>
        <div class="ww-challenge-pill green" style="margin-top:18px;">two weeks in</div>
      `},
      { bg: 'ww-bg-challenge-night', hold_ms: 2700, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-challenge-pill green">momentum board</div>
        <div class="ww-challenge-scorecard" style="margin-top:22px;">
          <div class="ww-challenge-scorecell"><strong>${checkins}</strong><span>check-ins</span></div>
          <div class="ww-challenge-scorecell"><strong>${points}</strong><span>challenge pts</span></div>
          <div class="ww-challenge-scorecell"><strong>${healthIQAnswers}</strong><span>Health IQ answers</span></div>
          <div class="ww-challenge-scorecell"><strong>${activeUsers}</strong><span>active members</span></div>
        </div>
      `},
      { bg: 'ww-bg-challenge-action', hold_ms: 2600, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-halftone"></div>
        <div class="ww-challenge-pill green">the middle is the test</div>
        <div class="ww-big-num" style="font-size: clamp(2.7rem, 12vw, 5.6rem); color:#f8f3e7; line-height:0.98; text-shadow:6px 6px 0 #101820;">TWO WEEKS<br>DOWN.</div>
        <div class="ww-caption" style="color:#fff; font-weight:900;">Now the habits start to stick.</div>
      `},
      { bg: 'ww-bg-challenge-night', hold_ms: 3300, html: `
        ${challengeTape('leaderboard')}
        <div class="ww-speed-lines"></div>
        <div class="ww-challenge-pill coral">leaderboard</div>
        <div class="ww-big-num" style="font-size: clamp(2.3rem, 10vw, 4.5rem); color:#f3d36b; line-height:0.96; text-shadow:5px 5px 0 #101820;">TOP 5</div>
        <div class="ww-challenge-stack">
          ${challengeLeaderboardRows(stats.leaderboard)}
        </div>
      `},
      { bg: 'ww-bg-challenge-score', hold_ms: 2500, html: `
        <div class="ww-halftone"></div>
        <div class="ww-challenge-logo-final">
          ${REEL_LOGO}
          <div class="ww-big-num" style="font-size: clamp(2.3rem, 9vw, 4.5rem); color:#101820; line-height:1; text-shadow:4px 4px 0 #f8f3e7;">BALANCE</div>
          <div class="ww-caption" style="color:#101820; font-weight:900;">Week 3 starts now.</div>
          <div class="ww-challenge-pill green">keep showing up</div>
        </div>
        <button class="ww-cta-btn" data-ww-finish style="margin-top:18px;">Done</button>
      `},
    ];
  }

  async function buildChallengeWeekTwoReel(){
    try {
      const stats = await buildChallengeWeekStats(2, { cumulative: true });
      return buildChallengeWeekTwoSlides(stats);
    } catch(e) {
      console.warn('[challenge reel] week 2 build failed', e);
      return buildChallengeWeekTwoSlides({
        challenge: { name: '30 Day Challenge' },
        range: { label: 'Weeks 1 + 2' },
        week: 2,
        participants: 0,
        activeUsers: 0,
        workouts: 0,
        meals: 0,
        pbs: 0,
        checkins: 0,
        weighIns: 0,
        weightLostKg: 0,
        weightNetChangeKg: 0,
        weightTrackedUsers: 0,
        weightUsersWithTwo: 0,
        weightLossUsers: 0,
        points: 0,
        lessons: 0,
        healthIQQuizzes: 0,
        healthIQAnswers: 0,
        movementMinutes: 0,
        leaderboard: [],
      });
    }
  }

  function buildChallengeWeekThreeSlides(stats){
    const title = challengeTitle(stats.challenge);
    const range = stats.range && stats.range.label ? stats.range.label : 'Weeks 1 - 3';
    const members = compactNumber(stats.participants);
    const activeUsers = compactNumber(stats.activeUsers);
    const workouts = compactNumber(stats.workouts);
    const meals = compactNumber(stats.meals);
    const pbs = compactNumber(stats.pbs);
    const checkins = compactNumber(stats.checkins);
    const points = compactNumber(stats.points);
    const minutes = compactNumber(stats.movementMinutes);
    const healthIQAnswers = compactNumber(stats.healthIQAnswers ?? stats.healthIQQuizzes ?? stats.lessons);
    const weightLost = formatWeightDownKg(stats.weightLostKg);
    const weighIns = compactNumber(stats.weighIns);
    const progressPhotos = compactNumber(stats.progressPhotos);

    return [
      { bg: 'ww-bg-challenge-week', hold_ms: 2400, html: `
        ${challengeTape('week 3 recap')}
        <div class="ww-challenge-pill green">30 day challenge</div>
        <div class="ww-big-num" style="font-size: clamp(2.7rem, 12vw, 5.9rem); line-height:0.96; color:#f3d36b; -webkit-text-stroke:3px #101820; text-shadow:5px 5px 0 #101820, 0 0 24px rgba(248,243,231,0.35); margin-top:18px;">WEEK 3<br>RECAP</div>
        <div class="ww-caption" style="max-width:88%; color:#101820; background:#f8f3e7; border:3px solid #101820; border-radius:6px; padding:10px 14px; box-shadow:5px 5px 0 #101820; font-weight:900;">${escapeHtml(title)}<br>${escapeHtml(range)} &middot; ${members} challengers</div>
      `},
      { bg: 'ww-bg-challenge-action', hold_ms: 2600, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-challenge-pill">three-week total</div>
        <div class="ww-big-num" style="font-size: clamp(5rem, 24vw, 12rem); color:#f8f3e7; text-shadow:6px 6px 0 #101820;">${workouts}</div>
        <div class="ww-caption" style="color:#fff; font-weight:900;">workouts completed</div>
        <div class="ww-challenge-pill coral" style="margin-top:20px;">approx ${minutes} training minutes</div>
      `},
      { bg: 'ww-bg-challenge-night', hold_ms: 2600, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-challenge-pill coral">records board</div>
        <div class="ww-big-num" style="font-size: clamp(5rem, 24vw, 12rem); color:#f3d36b; text-shadow:6px 6px 0 #101820, 0 0 28px rgba(243,211,107,0.45);">${pbs}</div>
        <div class="ww-big-num" style="font-size: clamp(1.8rem, 8vw, 3.7rem); color:#fff; line-height:1; text-shadow:4px 4px 0 #101820;">PBs HIT</div>
        <div class="ww-caption" style="color:#fff; font-weight:900; margin-top:8px;">across the first three weeks</div>
      `},
      { bg: 'ww-bg-challenge-night', hold_ms: 2600, html: `
        ${challengeTape('tracked - trained - backed it up')}
        <div class="ww-challenge-pill coral">nutrition stack</div>
        <div class="ww-big-num" style="font-size: clamp(5rem, 24vw, 12rem); color:#f3d36b; text-shadow:6px 6px 0 #101820, 0 0 28px rgba(243,211,107,0.42);">${meals}</div>
        <div class="ww-caption" style="max-width:86%; color:#fff; font-weight:900;">meals tracked</div>
        <div class="ww-challenge-pill green" style="margin-top:18px; max-width:86%; white-space:normal; text-align:center; line-height:1.2;">breakfasts &middot; lunches &middot; dinners &middot; snacks</div>
      `},
      { bg: 'ww-bg-challenge-action', hold_ms: 2500, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-halftone"></div>
        <div class="ww-challenge-pill green">health iq</div>
        <div class="ww-big-num" style="font-size: clamp(5rem, 24vw, 12rem); color:#f8f3e7; text-shadow:6px 6px 0 #101820;">${healthIQAnswers}</div>
        <div class="ww-caption" style="color:#fff; font-weight:900;">questions answered</div>
        <div class="ww-challenge-pill coral" style="margin-top:20px;">knowledge reps count too</div>
      `},
      { bg: 'ww-bg-challenge-score', hold_ms: 2600, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-halftone"></div>
        <div class="ww-challenge-pill coral">team progress</div>
        <div class="ww-big-num" style="font-size: clamp(4.8rem, 22vw, 11rem); color:#f8f3e7; -webkit-text-stroke:4px #101820; text-shadow:6px 6px 0 #101820, 0 0 30px rgba(243,211,107,0.5);">${weightLost}</div>
        <div class="ww-big-num" style="font-size: clamp(1.8rem, 8vw, 3.7rem); color:#f8f3e7; -webkit-text-stroke:2px #101820; line-height:1; text-shadow:3px 3px 0 #101820, 0 0 18px rgba(243,211,107,0.45);">DOWN</div>
        <div class="ww-challenge-pill green" style="margin-top:18px;">three weeks in</div>
      `},
      { bg: 'ww-bg-challenge-night', hold_ms: 2700, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-challenge-pill green">all the little wins</div>
        <div class="ww-challenge-scorecard" style="margin-top:22px;">
          <div class="ww-challenge-scorecell"><strong>${checkins}</strong><span>check-ins</span></div>
          <div class="ww-challenge-scorecell"><strong>${weighIns}</strong><span>weigh-ins</span></div>
          <div class="ww-challenge-scorecell"><strong>${progressPhotos}</strong><span>progress photos</span></div>
          <div class="ww-challenge-scorecell"><strong>${activeUsers}</strong><span>active members</span></div>
        </div>
      `},
      { bg: 'ww-bg-challenge-action', hold_ms: 2700, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-halftone"></div>
        <div class="ww-challenge-pill coral">three-week scorecard</div>
        <div class="ww-challenge-scorecard" style="margin-top:22px;">
          <div class="ww-challenge-scorecell"><strong>${workouts}</strong><span>workouts</span></div>
          <div class="ww-challenge-scorecell"><strong>${meals}</strong><span>meals tracked</span></div>
          <div class="ww-challenge-scorecell"><strong>${pbs}</strong><span>PBs hit</span></div>
          <div class="ww-challenge-scorecell"><strong>${points}</strong><span>challenge pts</span></div>
        </div>
      `},
      { bg: 'ww-bg-challenge-night', hold_ms: 3300, html: `
        ${challengeTape('leaderboard')}
        <div class="ww-speed-lines"></div>
        <div class="ww-challenge-pill coral">leaderboard</div>
        <div class="ww-big-num" style="font-size: clamp(2.3rem, 10vw, 4.5rem); color:#f3d36b; line-height:0.96; text-shadow:5px 5px 0 #101820;">TOP 5</div>
        <div class="ww-challenge-stack">
          ${challengeLeaderboardRows(stats.leaderboard)}
        </div>
      `},
      { bg: 'ww-bg-challenge-score', hold_ms: 2500, html: `
        <div class="ww-halftone"></div>
        <div class="ww-challenge-logo-final">
          ${REEL_LOGO}
          <div class="ww-big-num" style="font-size: clamp(2.3rem, 9vw, 4.5rem); color:#101820; line-height:1; text-shadow:4px 4px 0 #f8f3e7;">BALANCE</div>
          <div class="ww-caption" style="color:#101820; font-weight:900;">Week 4 starts now.</div>
          <div class="ww-challenge-pill green">finish strong</div>
        </div>
        <button class="ww-cta-btn" data-ww-finish style="margin-top:18px;">Done</button>
      `},
    ];
  }

  async function buildChallengeWeekThreeReel(){
    try {
      const stats = await buildChallengeWeekStats(3, { cumulative: true });
      return buildChallengeWeekThreeSlides(stats);
    } catch(e) {
      console.warn('[challenge reel] week 3 build failed', e);
      return buildChallengeWeekThreeSlides({
        challenge: { name: '30 Day Challenge' },
        range: { label: 'Weeks 1 - 3' },
        week: 3,
        participants: 0,
        activeUsers: 0,
        workouts: 0,
        meals: 0,
        pbs: 0,
        checkins: 0,
        weighIns: 0,
        progressPhotos: 0,
        weightLostKg: 0,
        weightNetChangeKg: 0,
        weightTrackedUsers: 0,
        weightUsersWithTwo: 0,
        weightLossUsers: 0,
        points: 0,
        lessons: 0,
        healthIQQuizzes: 0,
        healthIQAnswers: 0,
        movementMinutes: 0,
        leaderboard: [],
      });
    }
  }

  function balanceReviewWindow(nowInput){
    const now = nowInput ? new Date(nowInput) : new Date();
    const today = parseDateOnly(formatDate(now)) || now;
    const daysSinceMonday = (today.getDay() + 6) % 7;
    const start = addDays(today, -daysSinceMonday);
    const endExclusive = addDays(today, 1);
    return {
      start,
      endForIso: now,
      sinceIso: start.toISOString(),
      untilIso: now.toISOString(),
      sinceDate: formatDate(start),
      untilDateExclusive: formatDate(endExclusive),
      label: shortDate(start) + ' - ' + shortDate(today),
    };
  }

  function filterRowsByAllowedUsers(rows, allowedUserIds){
    if (!allowedUserIds || !allowedUserIds.size) return rows || [];
    return (rows || []).filter(row => row && row.user_id && allowedUserIds.has(row.user_id));
  }

  async function buildBalanceWeeklyReviewStats(){
    const supabase = window.supabaseClient;
    if (!supabase) throw new Error('Supabase client not ready');

    const range = balanceReviewWindow();
    const users = await safeChallengeRows('users', () => supabase
      .from('users')
      .select('id,is_test_account,created_at,last_login,onboarding_complete,subscription_status')
      .limit(10000));
    const appUsers = users.filter(user => user && user.id && user.is_test_account !== true);
    const allowedUserIds = new Set(appUsers.map(user => user.id));
    const newMembers = appUsers.filter(user => {
      const createdAt = user && user.created_at ? new Date(user.created_at) : null;
      return createdAt && Number.isFinite(createdAt.getTime()) && createdAt >= range.start && createdAt <= range.endForIso;
    }).length;

    const [
      workoutsRaw,
      pbsRaw,
      mealsRawAll,
      moodLogsRaw,
      weighInsRaw,
      progressPhotosRaw,
      activityLogsRaw,
      lessonsRaw,
    ] = await Promise.all([
      safeChallengeRows('workouts', () => supabase
        .from('workouts')
        .select('user_id,workout_date,template_name,created_at')
        .eq('workout_type', 'history')
        .eq('is_current_workout', false)
        .gte('workout_date', range.sinceDate)
        .lt('workout_date', range.untilDateExclusive)
        .limit(10000)),
      safeChallengeRows('pb_history', () => supabase
        .from('pb_history')
        .select('user_id,achieved_at,exercise_name,pb_type')
        .gte('achieved_at', range.sinceIso)
        .lt('achieved_at', range.untilIso)
        .limit(10000)),
      safeChallengeRows('meal_logs', () => supabase
        .from('meal_logs')
        .select('id,user_id,meal_date,meal_type,calories,created_at')
        .gte('meal_date', range.sinceDate)
        .lt('meal_date', range.untilDateExclusive)
        .limit(10000)),
      safeChallengeRows('mood_logs', () => supabase
        .from('mood_logs')
        .select('user_id,created_at,mood_score,energy_score')
        .gte('created_at', range.sinceIso)
        .lt('created_at', range.untilIso)
        .limit(10000)),
      safeChallengeRows('daily_weigh_ins', () => supabase
        .from('daily_weigh_ins')
        .select('user_id,weigh_in_date,weight_kg,created_at')
        .gte('weigh_in_date', range.sinceDate)
        .lt('weigh_in_date', range.untilDateExclusive)
        .limit(10000)),
      safeChallengeRows('weekly_progress_photos', () => supabase
        .from('weekly_progress_photos')
        .select('user_id,created_at,photo_week')
        .gte('created_at', range.sinceIso)
        .lt('created_at', range.untilIso)
        .limit(10000)),
      safeChallengeRows('activity_logs', () => supabase
        .from('activity_logs')
        .select('user_id,activity_date,duration_minutes,activity_type')
        .gte('activity_date', range.sinceDate)
        .lt('activity_date', range.untilDateExclusive)
        .limit(10000)),
      safeChallengeRows('lesson_completions', () => supabase
        .from('lesson_completions')
        .select('user_id,completed_at,xp_earned,games_played')
        .gte('completed_at', range.sinceIso)
        .lt('completed_at', range.untilIso)
        .limit(10000)),
    ]);

    const workouts = filterRowsByAllowedUsers(workoutsRaw, allowedUserIds);
    const pbs = filterRowsByAllowedUsers(pbsRaw, allowedUserIds);
    const mealsRaw = filterRowsByAllowedUsers(mealsRawAll, allowedUserIds);
    const moodLogs = filterRowsByAllowedUsers(moodLogsRaw, allowedUserIds);
    const weighIns = filterRowsByAllowedUsers(weighInsRaw, allowedUserIds);
    const progressPhotos = filterRowsByAllowedUsers(progressPhotosRaw, allowedUserIds);
    const activityLogs = filterRowsByAllowedUsers(activityLogsRaw, allowedUserIds);
    const lessons = filterRowsByAllowedUsers(lessonsRaw, allowedUserIds);

    const meals = mealsRaw.filter(m => String(m.meal_type || '').toLowerCase() !== 'water');
    const workoutSessions = countWorkoutSessions(workouts);
    const activityMinutes = sumNumbers(activityLogs, 'duration_minutes');
    const weightStats = calculateTeamWeightStats(weighIns);
    const healthIQAnswers = Math.round(sumNumbers(lessons, 'games_played')) || lessons.length;

    return {
      range,
      members: appUsers.length,
      newMembers,
      activeUsers: uniqueRowUsers([workouts, pbs, meals, moodLogs, weighIns, progressPhotos, activityLogs, lessons]),
      workouts: workoutSessions,
      meals: meals.length,
      pbs: pbs.length,
      checkins: moodLogs.length + weighIns.length + progressPhotos.length,
      progressPhotos: progressPhotos.length,
      weighIns: weighIns.length,
      moodLogs: moodLogs.length,
      weightLostKg: weightStats.totalLostKg,
      weightNetChangeKg: weightStats.netChangeKg,
      weightTrackedUsers: weightStats.trackedUsers,
      weightUsersWithTwo: weightStats.usersWithTwo,
      weightLossUsers: weightStats.usersDown,
      healthIQQuizzes: lessons.length,
      healthIQAnswers,
      xp: Math.round(sumNumbers(lessons, 'xp_earned')),
      movementMinutes: Math.round((workoutSessions * 45) + activityMinutes),
    };
  }

  function buildBalanceWeeklyReviewSlides(stats){
    const range = stats.range && stats.range.label ? stats.range.label : 'This week';
    const members = compactNumber(stats.members);
    const newMembers = compactNumber(stats.newMembers);
    const activeUsers = compactNumber(stats.activeUsers);
    const workouts = compactNumber(stats.workouts);
    const meals = compactNumber(stats.meals);
    const pbs = compactNumber(stats.pbs);
    const checkins = compactNumber(stats.checkins);
    const minutes = compactNumber(stats.movementMinutes);
    const healthIQAnswers = compactNumber(stats.healthIQAnswers ?? stats.healthIQQuizzes);
    const progressPhotos = compactNumber(stats.progressPhotos);
    const weighIns = compactNumber(stats.weighIns);
    const hasWeightLoss = Number(stats.weightLostKg || 0) > 0;
    const weightPrimary = hasWeightLoss ? formatWeightDownKg(stats.weightLostKg) : weighIns;
    const weightLabel = hasWeightLoss ? 'DOWN' : 'WEIGH-INS';
    const weightPill = hasWeightLoss ? 'this week' : 'body data logged';

    return [
      { bg: 'ww-bg-challenge-week', hold_ms: 2400, html: `
        ${challengeTape('weekly app review')}
        <div class="ww-challenge-pill green">Balance app</div>
        <div class="ww-big-num" style="font-size: clamp(2.5rem, 11vw, 5.7rem); line-height:0.96; color:#f3d36b; -webkit-text-stroke:3px #101820; text-shadow:5px 5px 0 #101820, 0 0 24px rgba(248,243,231,0.35); margin-top:18px;">WEEKLY<br>REVIEW</div>
        <div class="ww-caption" style="max-width:88%; color:#101820; background:#f8f3e7; border:3px solid #101820; border-radius:6px; padding:10px 14px; box-shadow:5px 5px 0 #101820; font-weight:900;">${escapeHtml(range)} &middot; ${members} members in the app</div>
      `},
      { bg: 'ww-bg-challenge-action', hold_ms: 2600, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-challenge-pill">training total</div>
        <div class="ww-big-num" style="font-size: clamp(5rem, 24vw, 12rem); color:#f8f3e7; text-shadow:6px 6px 0 #101820;">${workouts}</div>
        <div class="ww-caption" style="color:#fff; font-weight:900;">workouts completed</div>
        <div class="ww-challenge-pill coral" style="margin-top:20px;">approx ${minutes} training minutes</div>
      `},
      { bg: 'ww-bg-challenge-night', hold_ms: 2600, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-challenge-pill coral">records board</div>
        <div class="ww-big-num" style="font-size: clamp(5rem, 24vw, 12rem); color:#f3d36b; text-shadow:6px 6px 0 #101820, 0 0 28px rgba(243,211,107,0.45);">${pbs}</div>
        <div class="ww-big-num" style="font-size: clamp(1.8rem, 8vw, 3.7rem); color:#fff; line-height:1; text-shadow:4px 4px 0 #101820;">PBs HIT</div>
        <div class="ww-caption" style="color:#fff; font-weight:900; margin-top:8px;">stronger is showing up in the logs</div>
      `},
      { bg: 'ww-bg-challenge-night', hold_ms: 2600, html: `
        ${challengeTape('tracked - trained - backed it up')}
        <div class="ww-challenge-pill coral">nutrition stack</div>
        <div class="ww-big-num" style="font-size: clamp(5rem, 24vw, 12rem); color:#f3d36b; text-shadow:6px 6px 0 #101820, 0 0 28px rgba(243,211,107,0.42);">${meals}</div>
        <div class="ww-caption" style="max-width:86%; color:#fff; font-weight:900;">meals tracked</div>
        <div class="ww-challenge-pill green" style="margin-top:18px; max-width:86%; white-space:normal; text-align:center; line-height:1.2;">breakfasts &middot; lunches &middot; dinners &middot; snacks</div>
      `},
      { bg: 'ww-bg-challenge-action', hold_ms: 2500, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-halftone"></div>
        <div class="ww-challenge-pill green">health iq</div>
        <div class="ww-big-num" style="font-size: clamp(5rem, 24vw, 12rem); color:#f8f3e7; text-shadow:6px 6px 0 #101820;">${healthIQAnswers}</div>
        <div class="ww-caption" style="color:#fff; font-weight:900;">questions answered</div>
        <div class="ww-challenge-pill coral" style="margin-top:20px;">knowledge reps count too</div>
      `},
      { bg: 'ww-bg-challenge-score', hold_ms: 2600, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-halftone"></div>
        <div class="ww-challenge-pill coral">team progress</div>
        <div class="ww-big-num" style="font-size: clamp(4.8rem, 22vw, 11rem); color:#f8f3e7; -webkit-text-stroke:4px #101820; text-shadow:6px 6px 0 #101820, 0 0 30px rgba(243,211,107,0.5);">${weightPrimary}</div>
        <div class="ww-big-num" style="font-size: clamp(1.8rem, 8vw, 3.7rem); color:#f8f3e7; -webkit-text-stroke:2px #101820; line-height:1; text-shadow:3px 3px 0 #101820, 0 0 18px rgba(243,211,107,0.45);">${weightLabel}</div>
        <div class="ww-challenge-pill green" style="margin-top:18px;">${weightPill}</div>
      `},
      { bg: 'ww-bg-challenge-night', hold_ms: 2700, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-challenge-pill green">momentum board</div>
        <div class="ww-challenge-scorecard" style="margin-top:22px;">
          <div class="ww-challenge-scorecell"><strong>${checkins}</strong><span>check-ins</span></div>
          <div class="ww-challenge-scorecell"><strong>${progressPhotos}</strong><span>progress photos</span></div>
          <div class="ww-challenge-scorecell"><strong>${activeUsers}</strong><span>active members</span></div>
          <div class="ww-challenge-scorecell"><strong>${newMembers}</strong><span>new members</span></div>
        </div>
      `},
      { bg: 'ww-bg-challenge-score', hold_ms: 2500, html: `
        <div class="ww-halftone"></div>
        <div class="ww-challenge-logo-final">
          ${REEL_LOGO}
          <div class="ww-big-num" style="font-size: clamp(2.3rem, 9vw, 4.5rem); color:#101820; line-height:1; text-shadow:4px 4px 0 #f8f3e7;">BALANCE</div>
          <div class="ww-caption" style="color:#101820; font-weight:900;">Small actions. Big data. Real momentum.</div>
          <div class="ww-challenge-pill green">DM BALANCE to join</div>
        </div>
        <button class="ww-cta-btn" data-ww-finish style="margin-top:18px;">Done</button>
      `},
    ];
  }

  async function buildBalanceWeeklyReviewReel(){
    try {
      const stats = await buildBalanceWeeklyReviewStats();
      return buildBalanceWeeklyReviewSlides(stats);
    } catch(e) {
      console.warn('[balance weekly review] build failed', e);
      return buildBalanceWeeklyReviewSlides({
        range: { label: 'This week' },
        members: 0,
        newMembers: 0,
        activeUsers: 0,
        workouts: 0,
        meals: 0,
        pbs: 0,
        checkins: 0,
        progressPhotos: 0,
        weighIns: 0,
        weightLostKg: 0,
        healthIQQuizzes: 0,
        healthIQAnswers: 0,
        movementMinutes: 0,
      });
    }
  }

  function askLine(who, text, hold_ms, sectionLabel){
    const w = who === 'user' ? 'user' : 'gpt';
    const label = w === 'user' ? 'Shan' : 'ChatGPT';
    const avatarGlyph = w === 'user' ? 'S' : '✦';
    const chrome = `<div class="ask-chrome"><span class="ask-chrome-dot"></span><span>ChatGPT</span></div>`;
    const section = sectionLabel ? `<div class="ask-section">${escapeHtml(sectionLabel)}</div>` : '';
    return {
      bg: 'ww-bg-ask',
      hold_ms: hold_ms || 3500,
      html: `${chrome}${section}<div class="ask-chat"><div class="ask-row ${w}"><div class="ask-avatar ${w}">${avatarGlyph}</div><div class="ask-col"><div class="ask-label">${label}</div><div class="ask-bubble ${w}">${text}</div></div></div></div>`,
    };
  }

  /**
   * Convert a list of rows into one slide per bubble, all sharing the
   * same section label (which stays visible across the whole group).
   * Each row is {who, text, hold?}. Sugar for `.map(r => askLine(...))`.
   */
  function askLines(rows, sectionLabel){
    return rows.map(r => askLine(r.who, r.text, r.hold, sectionLabel));
  }

  /**
   * Build a typewriter slide for the "Ask ChatGPT" series.
   *
   *   who:  'user' | 'gpt' — sets label text + colour
   *   text: plain text OR text with <strong>…</strong> / <em>…</em>.
   *         HTML tags are preserved through typing; only real characters
   *         reveal one at a time.
   *   opts:
   *     speed:    ms per character (default 36; lower = faster)
   *     pause:    ms to hold after typing completes before advancing (default 950)
   *     delayIn:  ms to wait after slide mounts before starting to type (default 280)
   *
   * Total slide hold_ms is computed = delayIn + (chars × speed) + pause,
   * so short lines stay on-screen for less time, long lines longer.
   */
  function twLine(who, text, opts){
    opts = opts || {};
    const speed   = typeof opts.speed   === 'number' ? opts.speed   : 36;
    const pause   = typeof opts.pause   === 'number' ? opts.pause   : 950;
    const delayIn = typeof opts.delayIn === 'number' ? opts.delayIn : 280;
    // Count only *real* chars for pacing — skip tag characters.
    const realChars = text.replace(/<[^>]+>/g, '').length;
    const hold_ms = delayIn + (realChars * speed) + pause;
    const w = who === 'user' ? 'user' : 'gpt';
    const label = w === 'user' ? 'Shan' : 'ChatGPT';
    // Store raw text in data-attribute (base64 to dodge quoting / HTML issues).
    const payload = btoa(unescape(encodeURIComponent(text)));
    return {
      bg: 'ww-bg-ask',
      hold_ms,
      html: `
        <div class="tw-stage">
          <div class="tw-label ${w}"><span class="tw-label-dot"></span><span>${label}</span></div>
          <div class="tw-text" data-tw="${payload}" data-tw-speed="${speed}" data-tw-delay="${delayIn}"></div>
        </div>
      `,
    };
  }

  function storyCardLine(name, text, opts){
    opts = opts || {};
    const speed   = typeof opts.speed   === 'number' ? opts.speed   : 36;
    const pause   = typeof opts.pause   === 'number' ? opts.pause   : 1000;
    const delayIn = typeof opts.delayIn === 'number' ? opts.delayIn : 300;
    const realChars = text.replace(/<[^>]+>/g, '').length;
    const hold_ms = delayIn + (realChars * speed) + pause;
    const label = String(name || '').toUpperCase();
    const labelClass = label === 'SHAN' ? 'shan' : 'client';
    const payload = btoa(unescape(encodeURIComponent(text)));
    return {
      bg: 'ww-bg-story-card',
      hold_ms,
      html: `
        <div class="story-card-stage">
          <div class="story-card">
            <div class="story-card-name ${labelClass}">${escapeHtml(label)}</div>
            <div class="story-type tw-text" data-tw="${payload}" data-tw-speed="${speed}" data-tw-delay="${delayIn}"></div>
          </div>
        </div>
      `,
    };
  }

  /**
   * Activate a typewriter on a freshly-mounted slide. Called from the
   * renderSlides show(i) hook below when a .tw-text[data-tw] element is
   * detected. Walks the source text one real character at a time, moving
   * each char (or tag-open/tag-close) from an invisible "hidden" span
   * into a "visible" span, with a blinking caret sitting between them.
   *
   * Tags (<strong>, </strong>, <em>, </em>, <br>) are emitted instantly
   * and don't count toward the per-char speed budget — only printable
   * text advances the timer. Keeps emphasis working through the type-on.
   */
  function runTypewriter(el){
    if (!el || el.__twStarted) return;
    el.__twStarted = true;
    const payload = el.dataset.tw || '';
    let text;
    try { text = decodeURIComponent(escape(atob(payload))); }
    catch(_) { text = ''; }
    const speed = Number(el.dataset.twSpeed || 36);
    const delay = Number(el.dataset.twDelay || 280);

    // Split the source text into tokens: either an HTML tag, <br>, or a
    // single character. Tags + <br> emit instantly; characters tick.
    const tokens = [];
    let i = 0;
    while (i < text.length) {
      if (text[i] === '<') {
        const end = text.indexOf('>', i);
        if (end === -1) { tokens.push({ kind: 'char', value: text[i] }); i++; continue; }
        const tag = text.slice(i, end + 1);
        tokens.push({ kind: 'tag', value: tag });
        i = end + 1;
      } else {
        tokens.push({ kind: 'char', value: text[i] });
        i++;
      }
    }

    // Build the structure: <visible></visible><cursor/><hidden>...all tokens invisible...</hidden>
    el.innerHTML = '<span class="tw-visible"></span><span class="tw-cursor"></span><span class="tw-hidden"></span>';
    const visible = el.querySelector('.tw-visible');
    const hidden  = el.querySelector('.tw-hidden');
    // Seed the hidden span with the full pre-rendered text so the layout
    // is identical to the final typed state — cursor walks exactly where
    // it'll be on the final frame, no jitter.
    hidden.innerHTML = tokens.map(t => t.value).join('');

    let tokenIdx = 0;
    // Track which token index we're up to in the hidden side. We can't
    // touch hidden DOM nodes directly (it contains fully-rendered HTML
    // that's been re-parsed); instead we rebuild both sides from the
    // tokens array on each step. Cheap for ~80-char lines.
    function tick(){
      if (tokenIdx >= tokens.length) return;
      tokenIdx++;
      // Emit tags instantly: if the next token is a tag, keep consuming
      // until we hit a real char (or run out). This means <strong>word</strong>
      // doesn't leave open tags visible.
      while (tokenIdx < tokens.length && tokens[tokenIdx].kind === 'tag') {
        tokenIdx++;
      }
      const shown = tokens.slice(0, tokenIdx).map(t => t.value).join('');
      const rest  = tokens.slice(tokenIdx).map(t => t.value).join('');
      visible.innerHTML = shown;
      hidden.innerHTML = rest;
      if (tokenIdx < tokens.length) {
        el.__twTimer = setTimeout(tick, speed);
      }
    }
    el.__twTimer = setTimeout(tick, delay);
  }

  /** (Legacy multi-bubble layout — kept for any future rapid-fire slides.) */
  function askSlide(rows, hold_ms, sectionLabel){
    const chrome = `
      <div class="ask-chrome">
        <span class="ask-chrome-dot"></span>
        <span>ChatGPT</span>
      </div>`;
    const section = sectionLabel ? `<div class="ask-section">${escapeHtml(sectionLabel)}</div>` : '';
    const rowsHtml = rows.map(r => {
      const who = r.who === 'user' ? 'user' : 'gpt';
      const label = who === 'user' ? 'Shan' : 'ChatGPT';
      const avatarGlyph = who === 'user' ? 'S' : '✦';
      return `
        <div class="ask-row ${who}">
          <div class="ask-avatar ${who}">${avatarGlyph}</div>
          <div class="ask-col">
            <div class="ask-label">${label}</div>
            <div class="ask-bubble ${who}">${r.text}</div>
          </div>
        </div>`;
    }).join('');
    return {
      bg: 'ww-bg-ask',
      hold_ms: hold_ms || 4500,
      html: `${chrome}${section}<div class="ask-chat">${rowsHtml}</div>`,
    };
  }

  function buildAskMotivationReel(){
    // Speed tiers for typewriter pacing:
    //   FAST  — short punchy lines or tight exchanges (~28ms/char)
    //   NORM  — default conversational speed (~36ms/char)
    //   SLOW  — emphasis beats that should feel deliberate (~52ms/char)
    const FAST = 28, NORM = 36, SLOW = 52;
    return [
      // ── OPENING ──────────────────────────────────────────────
      twLine('user', 'Hey ChatGPT… what is motivation?',                                    { speed: FAST, pause: 700 }),
      twLine('gpt',  'Hear me out. First I have to tell you what your brain actually is.',  { speed: NORM, pause: 900 }),

      // ── THE METAPHOR — prediction engine ─────────────────────
      twLine('gpt',  'Your brain is a <strong>prediction engine</strong>.',                 { speed: SLOW, pause: 1300 }),
      twLine('gpt',  'Every moment, it\'s guessing what happens next —',                    { speed: NORM, pause: 500 }),
      twLine('gpt',  'based on what happened the last thousand times.',                     { speed: NORM, pause: 1000 }),

      // ── THE ONE JOB — broadened definition ───────────────────
      twLine('gpt',  'And it has <strong>one job</strong>: keep you alive.',                { speed: SLOW, pause: 1000 }),
      twLine('gpt',  'But "alive" doesn\'t just mean <em>"not dying."</em>',                { speed: SLOW, pause: 900 }),
      twLine('gpt',  'It means: not alone. Not useless. Not in pain.',                      { speed: NORM, pause: 800 }),
      twLine('gpt',  'Not cast out of the tribe.',                                          { speed: SLOW, pause: 1100 }),
      twLine('gpt',  'Anything your brain decides is part of <em>"alive"</em>…',             { speed: NORM, pause: 700 }),
      twLine('gpt',  'it will fight to keep.',                                              { speed: SLOW, pause: 1200 }),

      // ── THE BRIDGE — Shan pushes back, GPT lands "motivation" ─
      twLine('user', 'Okay. But what\'s that got to do with motivation?',                   { speed: FAST, pause: 700 }),
      twLine('gpt',  'Everything.',                                                         { speed: SLOW, pause: 900 }),
      twLine('gpt',  'When the prediction engine thinks something will keep you <em>"alive"</em>…', { speed: NORM, pause: 600 }),
      twLine('gpt',  'it <strong>pulls you</strong> toward it.',                            { speed: SLOW, pause: 900 }),
      twLine('gpt',  'That pull… is <strong>motivation</strong>.',                          { speed: SLOW, pause: 1400 }),

      // ── WHERE "ALIVE" COMES FROM — training data ─────────────
      twLine('gpt',  'Here\'s the twist.',                                                  { speed: SLOW, pause: 700 }),
      twLine('gpt',  'Your brain learned what <em>"alive"</em> means from your life so far.', { speed: NORM, pause: 900 }),
      twLine('gpt',  'Your family. Your friends. Your phone. Your town.',                   { speed: NORM, pause: 1100 }),
      twLine('gpt',  'So now it predicts: <em>"this is what keeps me safe."</em>',           { speed: NORM, pause: 1100 }),

      // ── THREE DEMONSTRATIONS ─────────────────────────────────
      twLine('gpt',  'Watch three different brains at work.',                               { speed: SLOW, pause: 900 }),
      twLine('gpt',  'Man 1: works on his car every Sunday. Brain predicts: fix things → feel competent → safe.',       { speed: NORM, pause: 900 }),
      twLine('gpt',  'Man 2: sits in a church pew. Brain predicts: show up → belong → safe.',                            { speed: NORM, pause: 900 }),
      twLine('gpt',  'Man 3: feeds his paycheck into the pokies. Brain predicts: near-win → dopamine rush → safe.',      { speed: NORM, pause: 1100 }),
      twLine('gpt',  'Three different men. Three different Sundays.',                       { speed: NORM, pause: 700 }),
      twLine('gpt',  '<strong>Same engine. Different training data.</strong>',              { speed: SLOW, pause: 1300 }),

      // ── WILLPOWER OBJECTION — deflate the concept, pivot to identity ─
      twLine('user', 'So where does willpower fit into this?',                              { speed: FAST, pause: 800 }),
      twLine('gpt',  'Honestly? That\'s just a word we made up.',                           { speed: SLOW, pause: 1000 }),
      twLine('gpt',  'It might not even be that relevant.',                                 { speed: NORM, pause: 1100 }),
      twLine('gpt',  'The truth is…',                                                       { speed: SLOW, pause: 800 }),
      twLine('gpt',  'Who you become…',                                                     { speed: SLOW, pause: 700 }),
      twLine('gpt',  'has a lot less to do with <em>you</em>…',                              { speed: SLOW, pause: 900 }),
      twLine('gpt',  'and a lot more to do with <strong>what you\'ve been through</strong>.', { speed: SLOW, pause: 1400 }),

      // ── THE LEVER — who you become lands naturally into "change the inputs" ─
      twLine('gpt',  'Your brain didn\'t pick its predictions.',                            { speed: NORM, pause: 700 }),
      twLine('gpt',  'Your life picked them for it.',                                       { speed: SLOW, pause: 1100 }),
      twLine('gpt',  'So if you want different predictions…',                               { speed: NORM, pause: 700 }),
      twLine('gpt',  'change the life.',                                                    { speed: SLOW, pause: 1100 }),
      twLine('gpt',  'Change what it sees every day.',                                      { speed: NORM, pause: 700 }),
      twLine('gpt',  'Change who\'s around you.',                                           { speed: NORM, pause: 700 }),
      twLine('gpt',  'Change what your phone shows you when you open it.',                  { speed: NORM, pause: 1000 }),
      twLine('gpt',  '<strong>New inputs → new predictions → new pull.</strong>',            { speed: SLOW, pause: 1300 }),
      twLine('gpt',  'That\'s the only lever you actually have.',                           { speed: NORM, pause: 700 }),
      twLine('gpt',  'And it\'s enough.',                                                   { speed: SLOW, pause: 1500 }),

      // Soft Balance outro
      askOutroSlide(),
    ];
  }

  /** Shared soft-sell outro used by every "Ask ChatGPT" episode. */
  function askOutroSlide(){
    return {
      bg: 'ww-bg-ask',
      hold_ms: 6000,
      html: `
        <div class="ask-chrome"><span class="ask-chrome-dot"></span><span>ChatGPT</span></div>
        ${REEL_LOGO}
        <div class="ww-big-num" style="font-size: clamp(2rem, 8.5vw, 4rem); margin-top:20px; line-height:1;">BALANCE</div>
        <div class="ask-outro-tag">Learn why you do what you do.</div>
        <button class="ww-cta-btn" data-ww-finish style="margin-top:24px;">Done</button>
      `,
    };
  }

  // ────────────────────────────────────────────────────────────
  //  EDUCATIONAL — Episode 2: "What is Pavlovian conditioning?"
  //  Dog bell → casino slot machine → your daily life. Same chat-
  //  bubble format as Ep 1. Reuses ww-bg-ask / ask-chat styles.
  // ────────────────────────────────────────────────────────────

  function buildAskConditioningReel(){
    const FAST = 28, NORM = 36, SLOW = 52;
    return [
      // ── OPENING ──────────────────────────────────────────────
      twLine('user', 'Hey ChatGPT… what\'s Pavlovian conditioning?',                        { speed: FAST, pause: 700 }),
      twLine('gpt',  'It\'s how your <strong>prediction engine</strong> learns.',           { speed: SLOW, pause: 1100 }),
      twLine('gpt',  'Specifically — how it learns that two things are connected.',         { speed: NORM, pause: 1000 }),
      twLine('gpt',  'Watch.',                                                              { speed: SLOW, pause: 700 }),

      // ── THE CLASSIC — Pavlov's dog ───────────────────────────
      twLine('gpt',  'Moscow. 1903.',                                                       { speed: SLOW, pause: 800 }),
      twLine('gpt',  'A scientist named Pavlov has a dog. And a bell.',                     { speed: NORM, pause: 900 }),
      twLine('gpt',  'Every time he rings the bell… he serves the dog steak.',              { speed: NORM, pause: 1100 }),
      twLine('gpt',  'Do it enough times, and something weird happens.',                    { speed: NORM, pause: 900 }),
      twLine('gpt',  'Just the bell. No steak.',                                            { speed: SLOW, pause: 800 }),
      twLine('gpt',  'The dog drools anyway.',                                              { speed: SLOW, pause: 1200 }),

      // ── THE RULE ─────────────────────────────────────────────
      twLine('gpt',  'The prediction engine has filed a new rule:',                         { speed: NORM, pause: 800 }),
      twLine('gpt',  '<em>"When <strong>THIS</strong> happens… <strong>THAT</strong> is coming."</em>', { speed: SLOW, pause: 1200 }),
      twLine('gpt',  'And it fires the reward response <strong>before</strong> the reward even arrives.', { speed: NORM, pause: 1300 }),
      twLine('gpt',  'That\'s it. That\'s the whole trick.',                                { speed: SLOW, pause: 1000 }),

      // ── VERSION 1 — the dog ──────────────────────────────────
      twLine('gpt',  'We use this to teach a dog to sit.',                                  { speed: NORM, pause: 800 }),
      twLine('gpt',  'Say <em>"sit"</em> → push the bum down → treat.',                     { speed: NORM, pause: 900 }),
      twLine('gpt',  'Repeat enough, and <em>"sit"</em> alone triggers the behaviour.',     { speed: NORM, pause: 900 }),
      twLine('gpt',  'The dog\'s brain learned: <em>"sit" predicts "treat."</em>',          { speed: NORM, pause: 1200 }),

      // ── VERSION 2 — CASINOS (explicit parallel to bell + steak) ─
      twLine('user', 'What\'s the scary version?',                                          { speed: FAST, pause: 700 }),
      twLine('gpt',  'Casinos.',                                                            { speed: SLOW, pause: 900 }),
      twLine('gpt',  'They use the <strong>exact same trick</strong>.',                     { speed: SLOW, pause: 1100 }),
      twLine('gpt',  'Remember the bell and the steak?',                                    { speed: NORM, pause: 900 }),
      twLine('gpt',  'Here\'s how a casino does it.',                                       { speed: NORM, pause: 800 }),
      twLine('gpt',  'The bell?',                                                           { speed: SLOW, pause: 700 }),
      twLine('gpt',  '🎰 Flashing lights. Jingling jackpot sounds. Coins clattering.',       { speed: NORM, pause: 1100 }),
      twLine('gpt',  'The steak?',                                                          { speed: SLOW, pause: 700 }),
      twLine('gpt',  'The occasional win — and the dopamine rush that comes with it.',     { speed: NORM, pause: 1200 }),
      twLine('gpt',  'They pair them. All day. Every day. For years.',                     { speed: NORM, pause: 1100 }),
      twLine('gpt',  'Your prediction engine files a new rule:',                            { speed: NORM, pause: 700 }),
      twLine('gpt',  '<em>"This place = dopamine is coming."</em>',                          { speed: SLOW, pause: 1300 }),
      twLine('gpt',  'Soon — just the lights and jingles fire the dopamine.',              { speed: NORM, pause: 1000 }),
      twLine('gpt',  'No win necessary.',                                                   { speed: SLOW, pause: 1100 }),
      twLine('gpt',  'You\'re not chasing the money.',                                      { speed: SLOW, pause: 800 }),
      twLine('gpt',  'You\'re chasing the <strong>bell</strong>.',                          { speed: SLOW, pause: 1400 }),

      // ── NEAR-MISS ────────────────────────────────────────────
      twLine('gpt',  'Here\'s the evil bit.',                                               { speed: SLOW, pause: 900 }),
      twLine('gpt',  'Even a <strong>near-miss</strong> — two cherries and a lemon —',      { speed: NORM, pause: 700 }),
      twLine('gpt',  'lights up the same brain region as a real win.',                      { speed: NORM, pause: 1100 }),
      twLine('gpt',  'Your prediction engine goes: <em>"Almost! Keep going!"</em>',          { speed: NORM, pause: 1100 }),
      twLine('gpt',  'That\'s not luck. That\'s <strong>engineering</strong>.',              { speed: SLOW, pause: 1300 }),

      // ── THIS IS HOW THE BRAIN WORKS — generalise from casino ─
      twLine('gpt',  'And it\'s not just casinos.',                                         { speed: SLOW, pause: 900 }),
      twLine('gpt',  'This is how the brain works.',                                        { speed: SLOW, pause: 700 }),
      twLine('gpt',  'Always.',                                                             { speed: SLOW, pause: 1100 }),
      twLine('gpt',  'Colours. Sounds. Faces. Smells. Words.',                              { speed: NORM, pause: 1000 }),
      twLine('gpt',  'Every experience pairs with a feeling.',                              { speed: NORM, pause: 900 }),
      twLine('gpt',  'Every feeling files a rule — <em>when THIS, expect THAT.</em>',        { speed: NORM, pause: 1300 }),
      twLine('gpt',  'A song → a summer you\'ll never get back.',                            { speed: NORM, pause: 900 }),
      twLine('gpt',  'A voice → someone you loved. Or feared.',                             { speed: NORM, pause: 900 }),
      twLine('gpt',  'A phone buzz → dopamine, before you\'ve read the message.',           { speed: NORM, pause: 900 }),
      twLine('gpt',  'A 9pm fridge door → a craving, before you\'re hungry.',                { speed: NORM, pause: 900 }),
      twLine('gpt',  'A gym car park → dread. Or pride. Depending what got paired.',         { speed: NORM, pause: 1100 }),
      twLine('gpt',  'All of it teaching the engine what to expect next.',                   { speed: SLOW, pause: 1200 }),
      twLine('gpt',  'You didn\'t agree to any of it.',                                      { speed: SLOW, pause: 900 }),
      twLine('gpt',  'You\'ve been conditioned since the day you were born.',                { speed: SLOW, pause: 1000 }),
      twLine('gpt',  'There\'s no opting out.',                                              { speed: SLOW, pause: 1400 }),

      // ── THE FIX — three ways, none of them willpower ─────────
      twLine('user', 'So how do we change?',                                                { speed: FAST, pause: 800 }),
      twLine('gpt',  'You can\'t.',                                                         { speed: SLOW, pause: 1100 }),
      twLine('gpt',  '"Stopping" a prediction is just willpower. That never wins.',          { speed: NORM, pause: 1100 }),
      twLine('gpt',  'But three things actually work.',                                     { speed: SLOW, pause: 1000 }),

      // Method 1 — awareness (the free one)
      twLine('gpt',  '<strong>1. See it.</strong>',                                         { speed: SLOW, pause: 900 }),
      twLine('gpt',  'The moment you notice the pair firing —',                             { speed: NORM, pause: 600 }),
      twLine('gpt',  '<em>"ah, that\'s my engine predicting"</em> —',                         { speed: NORM, pause: 700 }),
      twLine('gpt',  'you create a gap between the trigger and the response.',              { speed: NORM, pause: 1000 }),
      twLine('gpt',  'The pull doesn\'t vanish. But it stops being automatic.',             { speed: NORM, pause: 1100 }),
      twLine('gpt',  'Honestly? Just knowing this mechanism exists is already a win.',      { speed: NORM, pause: 1300 }),

      // Method 2 — starve
      twLine('gpt',  '<strong>2. Starve the old pair.</strong>',                            { speed: SLOW, pause: 900 }),
      twLine('gpt',  'If the bell never rings, there\'s nothing to rehearse.',              { speed: NORM, pause: 1000 }),
      twLine('gpt',  'Keep your phone in another room.',                                    { speed: NORM, pause: 700 }),
      twLine('gpt',  'Don\'t buy the biscuits in the first place.',                         { speed: NORM, pause: 1100 }),

      // Method 3 — replace
      twLine('gpt',  '<strong>3. Teach a better pair.</strong>',                            { speed: SLOW, pause: 900 }),
      twLine('gpt',  '9pm used to mean biscuits? Pair it with a walk instead.',             { speed: NORM, pause: 900 }),
      twLine('gpt',  'Every night. Same time. Same action.',                                { speed: NORM, pause: 1000 }),
      twLine('gpt',  'Eventually the engine files a new rule:',                             { speed: NORM, pause: 700 }),
      twLine('gpt',  '<em>"9pm → walk → dopamine."</em>',                                    { speed: SLOW, pause: 1200 }),

      // ── THE DEEPER CATCH + RESOLUTION (resonance, not choice) ─
      twLine('user', 'But if my old predictions don\'t <em>want</em> me to starve or replace…', { speed: FAST, pause: 700 }),
      twLine('user', 'how do I even start?',                                                { speed: FAST, pause: 1100 }),
      twLine('gpt',  'Honestly? You can\'t.',                                               { speed: SLOW, pause: 900 }),
      twLine('gpt',  'Not by <em>wanting</em> to.',                                          { speed: SLOW, pause: 1100 }),
      twLine('gpt',  'You can only <strong>learn</strong>.',                                { speed: SLOW, pause: 1200 }),

      // The real answer — resonance, not choice. Either it speaks to
      // you (and you stay, and the learning happens) or it doesn't
      // (and you leave). No willpower involved either way.
      twLine('gpt',  'And here\'s the thing about learning.',                                { speed: SLOW, pause: 800 }),
      twLine('gpt',  'If this is speaking to you — you\'re already doing it.',               { speed: NORM, pause: 1200 }),
      twLine('gpt',  'If it wasn\'t, you\'d have clicked away by now.',                       { speed: NORM, pause: 1200 }),
      twLine('gpt',  'The fact that you\'re still here <em>is</em> the answer.',              { speed: SLOW, pause: 1300 }),
      twLine('gpt',  'Your engine is drawn to this.',                                       { speed: NORM, pause: 800 }),
      twLine('gpt',  'Which means it\'s already filing it.',                                 { speed: NORM, pause: 1000 }),
      twLine('gpt',  'And the more it files, the more it predicts differently.',            { speed: NORM, pause: 1200 }),
      twLine('gpt',  'You don\'t have to do anything.',                                      { speed: SLOW, pause: 1000 }),
      twLine('gpt',  'The learning is already doing it.',                                    { speed: SLOW, pause: 1400 }),

      // ── THE THESIS ───────────────────────────────────────────
      twLine('gpt',  'You didn\'t <em>fight</em> the old prediction.',                       { speed: SLOW, pause: 900 }),
      twLine('gpt',  'You <strong>replaced</strong> it with a better one.',                 { speed: SLOW, pause: 1200 }),
      twLine('gpt',  'That\'s how behaviour actually changes.',                             { speed: SLOW, pause: 1500 }),

      // Outro
      askOutroSlide(),
    ];
  }

  // ────────────────────────────────────────────────────────────
  //  EDUCATIONAL — Episode 3: "Do I have free will?"
  //  Walks through 30+ years of neuroscience: Libet's readiness
  //  potential (1983), Soon et al.'s fMRI prediction (2008), and
  //  Desmurget's intraoperative stimulation study (2009), with a
  //  Gazzaniga split-brain confabulation kicker. Payoff ties back
  //  to Ep 1 + Ep 2 — you don't out-willpower the brain, you
  //  change what it learns to decide.
  // ────────────────────────────────────────────────────────────

  function buildAskFreewillReel(){
    const FAST = 28, NORM = 36, SLOW = 52;

    // Dedicated static slide for the Libet timeline — not a typewriter
    // slide. Sandwiched between typed lines so the visual lands cleanly
    // without fighting the typing animation.
    const LIBET_TIMELINE_SLIDE = {
      bg: 'ww-bg-ask',
      hold_ms: 5500,
      html: `
        <div class="tw-stage">
          <div class="tw-label gpt"><span class="tw-label-dot"></span><span>ChatGPT</span></div>
          <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; max-width:460px; width:100%; font-weight:700; line-height:1.2; animation: twLabelIn 0.5s ease-out 0.2s both;">
            <span style="background:#0ea5e9; color:#fff; padding:14px 10px; border-radius:12px; text-align:center; flex:1; box-shadow:0 6px 18px rgba(14,165,233,0.35);">
              <span style="font-size:1.6rem; display:block;">🧠</span>
              <span style="font-size:0.62rem; letter-spacing:1.5px; text-transform:uppercase;">brain fires</span>
            </span>
            <span style="color:#fde047; font-weight:800; font-size:0.72rem; white-space:nowrap;">— 350ms —</span>
            <span style="background:#6366f1; color:#fff; padding:14px 10px; border-radius:12px; text-align:center; flex:1; box-shadow:0 6px 18px rgba(99,102,241,0.35);">
              <span style="font-size:1.6rem; display:block;">👁</span>
              <span style="font-size:0.62rem; letter-spacing:1.5px; text-transform:uppercase;">you feel it</span>
            </span>
            <span style="color:#fde047; font-weight:800; font-size:0.72rem; white-space:nowrap;">— 200ms —</span>
            <span style="background:#22d3ee; color:#042f3a; padding:14px 10px; border-radius:12px; text-align:center; flex:1; box-shadow:0 6px 18px rgba(34,211,238,0.4);">
              <span style="font-size:1.6rem; display:block;">✋</span>
              <span style="font-size:0.62rem; letter-spacing:1.5px; text-transform:uppercase;">hand moves</span>
            </span>
          </div>
        </div>
      `,
    };

    return [
      // ── OPENING ──────────────────────────────────────────────
      twLine('user', 'Hey ChatGPT… do I actually have free will?',                          { speed: FAST, pause: 800 }),
      twLine('gpt',  'Honest answer, from 30 years of brain scans?',                        { speed: NORM, pause: 800 }),
      twLine('gpt',  '<strong>Probably not.</strong>',                                      { speed: SLOW, pause: 1100 }),
      twLine('gpt',  'But stick with me. This one\'s <em>good news</em>.',                  { speed: NORM, pause: 1000 }),

      // ── TIE TO EP 1 — the engine is fast ─────────────────────
      twLine('gpt',  'Remember the <strong>prediction engine</strong>?',                    { speed: SLOW, pause: 900 }),
      twLine('gpt',  'Turns out it\'s faster than <em>you</em>.',                           { speed: SLOW, pause: 900 }),
      twLine('gpt',  'Way faster.',                                                         { speed: SLOW, pause: 1100 }),
      twLine('gpt',  'Here are three experiments.',                                         { speed: NORM, pause: 800 }),

      // ── STUDY 1 — LIBET 1983 ─────────────────────────────────
      twLine('gpt',  '1983. Benjamin Libet hooks you up to an <strong>EEG</strong> — a cap that reads your brain in real time.', { speed: NORM, pause: 1000 }),
      twLine('gpt',  'The task: flick your wrist whenever you feel like it.',               { speed: NORM, pause: 800 }),
      twLine('gpt',  'Watch this clock. The instant you <em>feel the urge</em>, remember where the dot is.', { speed: NORM, pause: 1000 }),
      twLine('gpt',  'He ends up with three timestamps:',                                   { speed: NORM, pause: 700 }),
      twLine('gpt',  'When your <strong>brain</strong> started preparing.',                 { speed: NORM, pause: 700 }),
      twLine('gpt',  'When <strong>you</strong> felt yourself decide.',                     { speed: NORM, pause: 700 }),
      twLine('gpt',  'When your <strong>hand</strong> actually moved.',                     { speed: NORM, pause: 900 }),

      // Timeline visual — static slide, no typewriter
      LIBET_TIMELINE_SLIDE,

      twLine('gpt',  'Your brain committed <strong>a third of a second</strong> before you consciously chose.', { speed: NORM, pause: 1100 }),
      twLine('gpt',  'Your awareness was the <em>last to know</em>.',                       { speed: SLOW, pause: 1300 }),

      // ── STUDY 2 — SOON 2008 ──────────────────────────────────
      twLine('user', 'Okay but that\'s just a wrist flick. Maybe it\'s reflex.',            { speed: FAST, pause: 800 }),
      twLine('gpt',  'That\'s what everyone said. For 25 years.',                           { speed: NORM, pause: 800 }),
      twLine('gpt',  'Then 2008 happened.',                                                 { speed: SLOW, pause: 1000 }),
      twLine('gpt',  'Berlin. A proper <strong>fMRI scanner</strong> — reads deep brain activity, not just the scalp.', { speed: NORM, pause: 900 }),
      twLine('gpt',  'You pick <strong>left button</strong> or <strong>right button</strong>. Whenever you want.', { speed: NORM, pause: 900 }),
      twLine('gpt',  'A computer reads your brain patterns…',                               { speed: NORM, pause: 700 }),
      twLine('gpt',  'and predicts your choice <strong>up to 10 seconds</strong> before you feel yourself choose.', { speed: NORM, pause: 1200 }),
      twLine('user', 'Ten <em>seconds?!</em>',                                              { speed: FAST, pause: 800 }),
      twLine('gpt',  'The decision was already sitting in your brain.',                     { speed: NORM, pause: 800 }),
      twLine('gpt',  'You just hadn\'t been shown it yet.',                                 { speed: SLOW, pause: 1300 }),

      // ── STUDY 3 — DESMURGET 2009 ─────────────────────────────
      twLine('gpt',  'Final experiment. The kicker.',                                       { speed: SLOW, pause: 800 }),
      twLine('gpt',  '2009. France. Awake brain surgery.',                                  { speed: NORM, pause: 900 }),
      twLine('gpt',  '(Yes, awake — the brain has no pain receptors.)',                     { speed: NORM, pause: 1000 }),
      twLine('gpt',  'The surgeon stimulates the <strong>parietal cortex</strong> with a tiny electrode.', { speed: NORM, pause: 900 }),
      twLine('gpt',  'The patient instantly says:',                                         { speed: NORM, pause: 600 }),
      twLine('gpt',  '<em>"I wanted to move my right hand."</em>',                          { speed: SLOW, pause: 1100 }),
      twLine('gpt',  'But their hand never moved.',                                         { speed: SLOW, pause: 900 }),
      twLine('gpt',  'The <em>feeling</em> of willing the action was manufactured by the electrode.', { speed: NORM, pause: 1300 }),
      twLine('gpt',  'Now he moves the electrode a few centimetres over.',                  { speed: NORM, pause: 800 }),
      twLine('gpt',  'This time the hand <strong>actually moves</strong>.',                 { speed: SLOW, pause: 900 }),
      twLine('gpt',  '<em>"Did you just move your hand?"</em>',                             { speed: NORM, pause: 700 }),
      twLine('gpt',  '<strong>"No. I didn\'t do anything."</strong>',                       { speed: SLOW, pause: 1200 }),
      twLine('gpt',  'The movement happened. The <em>feeling</em> of willing it didn\'t.',  { speed: NORM, pause: 1000 }),
      twLine('gpt',  'Feeling-of-choosing and act-of-choosing live in <strong>different rooms</strong>.', { speed: SLOW, pause: 1300 }),

      // ── THE PAYOFF — who's choosing? ─────────────────────────
      twLine('user', 'So… who\'s actually choosing?',                                       { speed: FAST, pause: 800 }),
      twLine('gpt',  'The prediction engine.',                                              { speed: SLOW, pause: 900 }),
      twLine('gpt',  'It\'s predicting, deciding, moving you…',                             { speed: NORM, pause: 700 }),
      twLine('gpt',  'and then generating a feeling of <em>"I chose that"</em> — afterwards.', { speed: NORM, pause: 1000 }),
      twLine('gpt',  'So you\'ll claim it.',                                                { speed: SLOW, pause: 1100 }),
      twLine('gpt',  'You are the <strong>narrator</strong> of your brain\'s decisions.',   { speed: SLOW, pause: 900 }),
      twLine('gpt',  'Not the one making them.',                                            { speed: SLOW, pause: 1400 }),

      // ── THE LESSON ───────────────────────────────────────────
      twLine('user', 'That\'s… terrifying.',                                                { speed: FAST, pause: 700 }),
      twLine('gpt',  'It\'s actually freeing. Here\'s why.',                                { speed: NORM, pause: 900 }),
      twLine('gpt',  'Every time you\'ve called yourself <strong>lazy, weak, no willpower</strong>…', { speed: NORM, pause: 800 }),
      twLine('gpt',  'you were blaming the <em>narrator</em> for what the engine had already done.', { speed: NORM, pause: 1300 }),
      twLine('gpt',  'You can\'t out-will an engine that decided before you felt it.',      { speed: NORM, pause: 1000 }),
      twLine('gpt',  'But you <strong>can</strong> change what it learns to decide.',       { speed: SLOW, pause: 1000 }),
      twLine('gpt',  '<em>What you\'ve been through</em> is what trained the engine.',      { speed: NORM, pause: 1000 }),
      twLine('gpt',  'So change what you\'re going through.',                               { speed: SLOW, pause: 1300 }),
      twLine('gpt',  '<em>"We are not captains of our ship."</em>',                         { speed: SLOW, pause: 800 }),
      twLine('gpt',  '<em>"Our ships never had captains."</em>',                            { speed: SLOW, pause: 800 }),
      twLine('gpt',  '— Sapolsky',                                                          { speed: NORM, pause: 1500 }),

      // Outro
      askOutroSlide(),
    ];
  }

  // ────────────────────────────────────────────────────────────
  //  EDUCATIONAL — Episode 4: "Is what I see even real?"
  //  Opens with the interactive nose trick, walks through the
  //  blind spot + controlled hallucination, then pivots to the
  //  kicker: the "self" is the same kind of construction. Ties
  //  the trilogy together — identity isn't discovered, it's built.
  // ────────────────────────────────────────────────────────────

  function buildAskIdentityReel(){
    const FAST = 28, NORM = 36, SLOW = 52;
    return [
      // ── INTERACTIVE HOOK — the nose trick ────────────────────
      twLine('user', 'Hey ChatGPT, quick question—',                                        { speed: FAST, pause: 600 }),
      twLine('gpt',  'Before you ask.',                                                     { speed: SLOW, pause: 700 }),
      twLine('gpt',  'Look straight at the screen.',                                        { speed: NORM, pause: 900 }),
      twLine('gpt',  'Now think about your nose.',                                          { speed: SLOW, pause: 1400 }),
      twLine('user', '…wait. I can see it now. I couldn\'t a second ago.',                  { speed: FAST, pause: 900 }),
      twLine('gpt',  'Right.',                                                              { speed: SLOW, pause: 900 }),

      // ── WHY — edits reality ──────────────────────────────────
      twLine('gpt',  'Your nose has been in your visual field <strong>every waking second of your life</strong>.', { speed: NORM, pause: 1000 }),
      twLine('gpt',  'Your eyes have been sending that image to your brain the whole time.', { speed: NORM, pause: 900 }),
      twLine('gpt',  'But your brain decided — long ago — it\'s <em>useless information</em>.', { speed: NORM, pause: 1000 }),
      twLine('gpt',  'And your prediction engine\'s first rule is:',                        { speed: NORM, pause: 700 }),
      twLine('gpt',  '<strong>only show what matters</strong>.',                            { speed: SLOW, pause: 1100 }),
      twLine('gpt',  'So it edits the nose out.',                                           { speed: SLOW, pause: 1200 }),

      // ── BLIND SPOT ───────────────────────────────────────────
      twLine('gpt',  'Want something weirder?',                                             { speed: SLOW, pause: 900 }),
      twLine('gpt',  'Every eye has a literal <strong>hole</strong> in the retina.',        { speed: NORM, pause: 900 }),
      twLine('gpt',  'The spot where the optic nerve exits. No photoreceptors. No image.',  { speed: NORM, pause: 1000 }),
      twLine('gpt',  'But you don\'t see two black dots floating in front of you.',         { speed: NORM, pause: 1000 }),
      twLine('gpt',  'Because the prediction engine paints over the hole…',                 { speed: NORM, pause: 800 }),
      twLine('gpt',  'with its <em>best guess</em> of what should be there.',               { speed: SLOW, pause: 1300 }),

      // ── THE RULE ─────────────────────────────────────────────
      twLine('gpt',  'Here\'s the rule you were never taught:',                             { speed: NORM, pause: 800 }),
      twLine('gpt',  'You don\'t see reality.',                                             { speed: SLOW, pause: 900 }),
      twLine('gpt',  'You see your brain\'s <strong>best guess</strong> of reality.',       { speed: SLOW, pause: 900 }),
      twLine('gpt',  'Edited for usefulness.',                                              { speed: SLOW, pause: 1100 }),
      twLine('gpt',  'When the guess is close enough, you never question it.',              { speed: NORM, pause: 900 }),
      twLine('gpt',  'When it isn\'t, you call it an <em>illusion</em>.',                   { speed: NORM, pause: 1200 }),

      // ── NOT JUST EYES ────────────────────────────────────────
      twLine('gpt',  'And it\'s not just your eyes.',                                       { speed: SLOW, pause: 900 }),
      twLine('gpt',  'Every sense you have is a <strong>controlled hallucination</strong>.', { speed: SLOW, pause: 1300 }),
      twLine('gpt',  'Colour is a label your brain invents. A tomato isn\'t "red" — it\'s reflecting a wavelength.', { speed: NORM, pause: 1100 }),
      twLine('gpt',  'Flavour is 80% smell. Block your nose and strawberry tastes like sugar water.', { speed: NORM, pause: 1100 }),
      twLine('gpt',  'Pain is constructed. Amputees feel pain in limbs that aren\'t there anymore.', { speed: NORM, pause: 1200 }),

      // ── PUSHBACK ─────────────────────────────────────────────
      twLine('user', 'Okay. But that\'s just my senses. I\'m still <em>me</em>.',           { speed: FAST, pause: 900 }),
      twLine('gpt',  'Ah.',                                                                 { speed: SLOW, pause: 600 }),
      twLine('gpt',  'About that.',                                                         { speed: SLOW, pause: 1200 }),

      // ── THE TWIST — and so are you ───────────────────────────
      twLine('gpt',  'You feel like there\'s a <strong>"you"</strong> watching through your eyes.', { speed: NORM, pause: 900 }),
      twLine('gpt',  'A single, continuous person. The voice in your head.',                { speed: NORM, pause: 900 }),
      twLine('gpt',  'The one making decisions.',                                           { speed: SLOW, pause: 1000 }),
      twLine('gpt',  'Neuroscientists have spent 50 years looking for that person.',        { speed: NORM, pause: 900 }),
      twLine('gpt',  'They can\'t find one.',                                               { speed: SLOW, pause: 1000 }),
      twLine('gpt',  'There is no single spot in your brain that\'s <em>"you."</em>',       { speed: SLOW, pause: 1400 }),

      // ── MEMORY RECONSTRUCTION ────────────────────────────────
      twLine('gpt',  'You think you <em>remember</em> your past.',                          { speed: NORM, pause: 800 }),
      twLine('gpt',  'You don\'t.',                                                         { speed: SLOW, pause: 800 }),
      twLine('gpt',  'Every time you recall a memory, your brain <strong>rebuilds it from scratch</strong>.', { speed: NORM, pause: 1000 }),
      twLine('gpt',  'The new version overwrites the old one.',                             { speed: NORM, pause: 900 }),
      twLine('gpt',  'Your childhood is a painting your brain repaints every time you look at it.', { speed: NORM, pause: 1300 }),

      // ── RUBBER HAND ──────────────────────────────────────────
      twLine('gpt',  'Classic experiment: the <strong>rubber hand</strong>.',               { speed: SLOW, pause: 900 }),
      twLine('gpt',  'Hide someone\'s real hand. Put a fake rubber hand in front of them.', { speed: NORM, pause: 900 }),
      twLine('gpt',  'Stroke both with a brush at the same time.',                          { speed: NORM, pause: 900 }),
      twLine('gpt',  'In <strong>30 seconds</strong>, their brain decides the rubber hand is theirs.', { speed: NORM, pause: 1000 }),
      twLine('gpt',  'Smash it with a hammer — they flinch. Real panic.',                   { speed: NORM, pause: 1100 }),
      twLine('gpt',  'Your brain doesn\'t even know what counts as <strong>your own body</strong>.', { speed: NORM, pause: 900 }),
      twLine('gpt',  'It\'s guessing.',                                                     { speed: SLOW, pause: 1300 }),

      // ── IDENTITY AS A STORY ──────────────────────────────────
      twLine('user', 'So if there\'s no "me" in the brain… what am I?',                     { speed: FAST, pause: 900 }),
      twLine('gpt',  'You\'re a <strong>story</strong>.',                                   { speed: SLOW, pause: 1000 }),
      twLine('gpt',  'A narrative your prediction engine keeps writing.',                   { speed: NORM, pause: 900 }),
      twLine('gpt',  'From reconstructed memories.',                                        { speed: NORM, pause: 700 }),
      twLine('gpt',  'Hallucinated senses.',                                                { speed: NORM, pause: 700 }),
      twLine('gpt',  'And decisions it already made.',                                      { speed: NORM, pause: 1000 }),
      twLine('gpt',  'Identity isn\'t a thing you <em>have</em>.',                          { speed: SLOW, pause: 900 }),
      twLine('gpt',  'It\'s a thing your brain is <strong>making</strong>.',                { speed: SLOW, pause: 700 }),
      twLine('gpt',  'Right now.',                                                          { speed: SLOW, pause: 1400 }),

      // ── THE LESSON ───────────────────────────────────────────
      twLine('user', 'That\'s terrifying. And also… kind of freeing?',                      { speed: FAST, pause: 900 }),
      twLine('gpt',  'Exactly.',                                                            { speed: SLOW, pause: 900 }),
      twLine('gpt',  'If the "you" is a construction…',                                     { speed: NORM, pause: 700 }),
      twLine('gpt',  'you don\'t have to <em>discover</em> yourself.',                      { speed: NORM, pause: 900 }),
      twLine('gpt',  'You get to <strong>build</strong> yourself.',                         { speed: SLOW, pause: 1200 }),
      twLine('gpt',  'Every action is a brush stroke.',                                     { speed: NORM, pause: 700 }),
      twLine('gpt',  'Every environment, new paint.',                                       { speed: NORM, pause: 700 }),
      twLine('gpt',  'Every choice, a vote for who you\'re becoming.',                      { speed: NORM, pause: 1200 }),
      twLine('gpt',  'You\'re not discovering who you are.',                                { speed: SLOW, pause: 900 }),
      twLine('gpt',  'You\'re <strong>deciding who you become</strong>.',                   { speed: SLOW, pause: 1600 }),

      // Outro
      askOutroSlide(),
    ];
  }

  // ────────────────────────────────────────────────────────────
  //  EDUCATIONAL — Episode 5: "What is addiction?"
  //  A specific, high-stakes application of the prediction-engine
  //  model. Addiction isn't a moral failing — it's the engine
  //  doing its job too well on a stimulus it was never built for.
  //  Closes on compassion + the same lever: new pairs, time.
  // ────────────────────────────────────────────────────────────

  function buildAskAddictionReel(){
    const FAST = 28, NORM = 36, SLOW = 52;
    return [
      // ── OPENING ──────────────────────────────────────────────
      twLine('user', 'Hey ChatGPT… what is addiction?',                                     { speed: FAST, pause: 900 }),
      twLine('gpt',  'Let me answer with the tools we already have.',                       { speed: NORM, pause: 1100 }),

      // ── TIE TO THE ENGINE ────────────────────────────────────
      twLine('gpt',  'Your brain is a <strong>prediction engine</strong>.',                 { speed: SLOW, pause: 900 }),
      twLine('gpt',  'It learns pairs. It predicts rewards. It pulls you toward them.',     { speed: NORM, pause: 1000 }),
      twLine('gpt',  'Addiction is just the engine doing its job <em>too well</em>.',        { speed: SLOW, pause: 1300 }),

      // ── THE MECHANISM — dopamine flood ───────────────────────
      twLine('gpt',  'Here\'s what actually happens.',                                      { speed: SLOW, pause: 800 }),
      twLine('gpt',  'You try something — a drink, a drug, a scroll, a bet.',              { speed: NORM, pause: 900 }),
      twLine('gpt',  'It floods your brain with <strong>dopamine</strong>.',                { speed: SLOW, pause: 900 }),
      twLine('gpt',  'Way more than food, or sex, or winning at anything else.',           { speed: NORM, pause: 1100 }),
      twLine('gpt',  'Your engine goes:',                                                   { speed: NORM, pause: 600 }),
      twLine('gpt',  '<em>"Holy shit. That was MUCH better than I predicted."</em>',         { speed: SLOW, pause: 1200 }),
      twLine('gpt',  'And it files a rule. A loud one.',                                   { speed: SLOW, pause: 900 }),
      twLine('gpt',  '<em>"When THIS is available — nothing else matters."</em>',            { speed: SLOW, pause: 1400 }),

      // ── REINFORCEMENT — the prediction gets louder ───────────
      twLine('gpt',  'Do it again. And again. And again.',                                 { speed: NORM, pause: 900 }),
      twLine('gpt',  'Every rep confirms the rule.',                                       { speed: NORM, pause: 900 }),
      twLine('gpt',  'The prediction gets <strong>louder</strong>.',                        { speed: SLOW, pause: 900 }),
      twLine('gpt',  'Eventually — louder than hunger.',                                   { speed: NORM, pause: 800 }),
      twLine('gpt',  'Louder than love.',                                                  { speed: SLOW, pause: 800 }),
      twLine('gpt',  'Louder than the fear of dying.',                                     { speed: SLOW, pause: 1300 }),

      // ── THE CUES — everything becomes a bell ─────────────────
      twLine('gpt',  'And it doesn\'t stop at the substance.',                              { speed: NORM, pause: 900 }),
      twLine('gpt',  'The engine pairs <em>everything</em> around it.',                      { speed: NORM, pause: 900 }),
      twLine('gpt',  'The friend. The walk home. The lighter. The smell. The time of day.', { speed: NORM, pause: 1100 }),
      twLine('gpt',  'Each one becomes a <strong>bell</strong>.',                           { speed: SLOW, pause: 900 }),
      twLine('gpt',  'And every bell fires the craving — before the thing is in the room.', { speed: NORM, pause: 1300 }),

      // ── TOLERANCE — the cruel part ───────────────────────────
      twLine('gpt',  'Here\'s the cruellest part.',                                         { speed: SLOW, pause: 900 }),
      twLine('gpt',  'The more you use, the <em>less</em> it actually feels good.',          { speed: NORM, pause: 1000 }),
      twLine('gpt',  'Tolerance builds. The dopamine hit shrinks.',                        { speed: NORM, pause: 900 }),
      twLine('gpt',  'But the <strong>prediction</strong> stays just as loud.',              { speed: SLOW, pause: 1000 }),
      twLine('gpt',  'So you crave it more.',                                               { speed: SLOW, pause: 700 }),
      twLine('gpt',  'And enjoy it less.',                                                  { speed: SLOW, pause: 900 }),
      twLine('gpt',  '<strong>Wanting outpaces liking.</strong>',                            { speed: SLOW, pause: 1400 }),

      // ── NOT A MORAL FAILING ──────────────────────────────────
      twLine('gpt',  'Addicts aren\'t weak.',                                                { speed: SLOW, pause: 900 }),
      twLine('gpt',  'They\'re running a perfectly functional brain…',                       { speed: NORM, pause: 800 }),
      twLine('gpt',  'against a stimulus it was never built for.',                          { speed: NORM, pause: 1000 }),
      twLine('gpt',  'Like a race car running on rocket fuel.',                             { speed: SLOW, pause: 1000 }),
      twLine('gpt',  'Nothing\'s broken.',                                                   { speed: SLOW, pause: 700 }),
      twLine('gpt',  'The engine just never stops firing.',                                 { speed: SLOW, pause: 1400 }),

      // ── HOW DO YOU CHANGE? ───────────────────────────────────
      twLine('user', 'So how does anyone get out?',                                         { speed: FAST, pause: 900 }),
      twLine('gpt',  'The same way you change any prediction.',                             { speed: NORM, pause: 900 }),
      twLine('gpt',  'Not by fighting it.',                                                 { speed: SLOW, pause: 900 }),
      twLine('gpt',  'You can\'t out-willpower a prediction this loud.',                    { speed: NORM, pause: 1100 }),

      // The three same methods, applied to addiction
      twLine('gpt',  '<strong>1. See it.</strong>',                                         { speed: SLOW, pause: 800 }),
      twLine('gpt',  'Notice the craving for what it is — a prediction, not a truth.',     { speed: NORM, pause: 1100 }),

      twLine('gpt',  '<strong>2. Starve the cues.</strong>',                                { speed: SLOW, pause: 800 }),
      twLine('gpt',  'New phone. New friends. Sometimes a new city.',                       { speed: NORM, pause: 900 }),
      twLine('gpt',  'If the bells don\'t ring, the prediction can\'t rehearse.',            { speed: NORM, pause: 1100 }),

      twLine('gpt',  '<strong>3. Build new pairs.</strong>',                                { speed: SLOW, pause: 800 }),
      twLine('gpt',  'Meetings. Exercise. A dog. A person who believes you.',              { speed: NORM, pause: 900 }),
      twLine('gpt',  'Pair <em>them</em> with safety, over and over…',                       { speed: NORM, pause: 900 }),
      twLine('gpt',  'until the engine starts predicting <em>those</em> instead.',           { speed: SLOW, pause: 1300 }),

      // ── TIME DOES THE WORK ───────────────────────────────────
      twLine('gpt',  'And the hardest one:',                                                { speed: SLOW, pause: 700 }),
      twLine('gpt',  '<strong>Time.</strong>',                                              { speed: SLOW, pause: 1000 }),
      twLine('gpt',  'Every day you don\'t feed the old prediction, it weakens a little.',  { speed: NORM, pause: 1000 }),
      twLine('gpt',  'Every new pair the engine files, the old one loses ground.',          { speed: NORM, pause: 1100 }),
      twLine('gpt',  'Eventually, it points somewhere else.',                               { speed: SLOW, pause: 1400 }),

      // ── COMPASSION CLOSER ────────────────────────────────────
      twLine('gpt',  'So if someone you love is stuck in this —',                           { speed: NORM, pause: 800 }),
      twLine('gpt',  'their brain isn\'t broken.',                                           { speed: SLOW, pause: 900 }),
      twLine('gpt',  'It\'s just learned something too hard, too deep.',                     { speed: NORM, pause: 1000 }),
      twLine('gpt',  'They\'re not <em>choosing</em> the substance.',                         { speed: SLOW, pause: 900 }),
      twLine('gpt',  'They\'re being pulled by a prediction that drowns everything else.',   { speed: NORM, pause: 1300 }),
      twLine('gpt',  'The answer isn\'t willpower.',                                         { speed: SLOW, pause: 900 }),
      twLine('gpt',  'It\'s time. New bells. Patience.',                                     { speed: SLOW, pause: 1300 }),

      // ── THESIS ───────────────────────────────────────────────
      twLine('gpt',  'Addiction isn\'t a failure of character.',                             { speed: SLOW, pause: 1000 }),
      twLine('gpt',  'It\'s a prediction that got too strong.',                               { speed: SLOW, pause: 1100 }),
      twLine('gpt',  'And predictions can be unlearned.',                                    { speed: SLOW, pause: 1500 }),

      // Outro
      askOutroSlide(),
    ];
  }

  // ────────────────────────────────────────────────────────────
  //  EDUCATIONAL — Episode 6: "What is learning?"
  //  Foundational episode for the series — answers HOW the
  //  prediction engine acquired everything it knows in the first
  //  place. Anchor: brain sealed in a dark skull from birth, no
  //  contact with the body or world, only unlabeled electrical
  //  pulses arriving down nerves. The only path from there to a
  //  full reality is trial-and-error — guess, check the next
  //  pulse, keep good guesses, update bad ones. Lands on
  //  prediction error: when a prediction misses reality, the
  //  brain updates its model — and that update IS learning.
  //  Anchored with a concrete example (rabbit out of the corner
  //  of your eye that turns out not to be there).
  // ────────────────────────────────────────────────────────────

  function buildAskLearningReel(){
    const FAST = 28, NORM = 36, SLOW = 52;

    // Static visual: [PREDICTION] — gap — [SIGNAL IN], with the
    // gap labelled "prediction error". Drops in right after the
    // gap is named, mirroring how the freewill reel uses the
    // Libet timeline to land an abstract concept.
    const PREDICTION_ERROR_SLIDE = {
      bg: 'ww-bg-ask',
      hold_ms: 5500,
      html: `
        <div class="tw-stage">
          <div class="tw-label gpt"><span class="tw-label-dot"></span><span>ChatGPT</span></div>
          <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; max-width:460px; width:100%; font-weight:700; line-height:1.2; animation: twLabelIn 0.5s ease-out 0.2s both;">
            <span style="background:#0ea5e9; color:#fff; padding:14px 10px; border-radius:12px; text-align:center; flex:1; box-shadow:0 6px 18px rgba(14,165,233,0.35);">
              <span style="font-size:1.6rem; display:block;">🔮</span>
              <span style="font-size:0.62rem; letter-spacing:1.5px; text-transform:uppercase;">prediction</span>
            </span>
            <span style="color:#fde047; font-weight:800; font-size:0.72rem; white-space:nowrap; text-align:center;">— GAP —<br><span style="font-size:0.55rem; opacity:0.85; letter-spacing:1px;">prediction error</span></span>
            <span style="background:#22d3ee; color:#042f3a; padding:14px 10px; border-radius:12px; text-align:center; flex:1; box-shadow:0 6px 18px rgba(34,211,238,0.4);">
              <span style="font-size:1.6rem; display:block;">⚡</span>
              <span style="font-size:0.62rem; letter-spacing:1.5px; text-transform:uppercase;">signal in</span>
            </span>
          </div>
        </div>
      `,
    };

    return [
      // ── HOOK — start somewhere unexpected ────────────────────
      twLine('user', 'Hey ChatGPT… what actually <em>is</em> learning?',                  { speed: FAST, pause: 700 }),
      twLine('gpt',  'Going to start somewhere weird.',                                   { speed: NORM, pause: 700 }),
      twLine('gpt',  'Where is your brain right now?',                                    { speed: SLOW, pause: 1000 }),
      twLine('user', 'Inside my skull?',                                                  { speed: FAST, pause: 700 }),
      twLine('gpt',  'Right. And what does it look like in there?',                       { speed: NORM, pause: 900 }),
      twLine('gpt',  '<strong>Pitch black. Soundless. Sealed shut.</strong>',             { speed: SLOW, pause: 1300 }),

      // ── THE BRAIN IN THE DARK ────────────────────────────────
      twLine('gpt',  'Your brain has never seen the outside world.',                      { speed: NORM, pause: 700 }),
      twLine('gpt',  'Not once.',                                                         { speed: SLOW, pause: 1100 }),
      twLine('gpt',  'It can\'t see your face. Can\'t see this screen.',                  { speed: NORM, pause: 700 }),

      // ── THE INPUT — pulses with no labels ────────────────────
      twLine('gpt',  'All it ever gets is <strong>electrical pulses</strong> down a few nerves.', { speed: NORM, pause: 1000 }),
      twLine('gpt',  'Pulses with no labels.',                                            { speed: NORM, pause: 600 }),
      twLine('gpt',  'No captions. No instructions.',                                     { speed: SLOW, pause: 1100 }),
      twLine('gpt',  'And from <em>that</em>…',                                           { speed: SLOW, pause: 800 }),
      twLine('gpt',  'it has to build everything you see, hear, feel, and call <em>"yourself."</em>', { speed: NORM, pause: 1300 }),

      // ── DAY ONE — the survival problem ───────────────────────
      twLine('user', 'Wait. From <em>birth?</em>',                                        { speed: FAST, pause: 800 }),
      twLine('gpt',  'From birth.',                                                       { speed: SLOW, pause: 800 }),
      twLine('gpt',  'Day one. Your brain wakes up in this dark room.',                  { speed: NORM, pause: 800 }),
      twLine('gpt',  'It doesn\'t know what eyes are. What hands are. What food is.',     { speed: NORM, pause: 900 }),
      twLine('gpt',  '<strong>And it has to figure out what they mean to stay alive.</strong>', { speed: SLOW, pause: 1300 }),

      // ── THE METHOD — trial and error ─────────────────────────
      twLine('user', 'Okay. How does it possibly do that?',                               { speed: FAST, pause: 700 }),
      twLine('gpt',  'The only way anything has ever solved a sealed puzzle.',            { speed: NORM, pause: 800 }),
      twLine('gpt',  '<strong>Trial and error.</strong>',                                 { speed: SLOW, pause: 1100 }),
      twLine('gpt',  'It guesses. <em>"These pulses probably mean… food."</em>',          { speed: NORM, pause: 900 }),
      twLine('gpt',  'Then it waits to see what pulse comes next.',                       { speed: NORM, pause: 800 }),
      twLine('gpt',  'If the next pulse fits the guess.',                                { speed: NORM, pause: 600 }),
      twLine('gpt',  '<strong>good guess. Keep it.</strong>',                             { speed: SLOW, pause: 900 }),
      twLine('gpt',  'If it doesn\'t.',                                                  { speed: NORM, pause: 500 }),
      twLine('gpt',  '<strong>update.</strong>',                                          { speed: SLOW, pause: 1300 }),

      // ── THE LOOP BUILT YOUR ENTIRE WORLD ─────────────────────
      twLine('gpt',  'That loop, running a billion times a second, built your reality.',  { speed: NORM, pause: 900 }),
      twLine('gpt',  'The face of your mother. The taste of an apple.',                   { speed: NORM, pause: 700 }),
      twLine('gpt',  'Your own hand.',                                                    { speed: NORM, pause: 800 }),
      twLine('gpt',  'All <strong>guesses that survived</strong> the next pulse.',        { speed: SLOW, pause: 1300 }),

      // ── REALITY IS A GUESS — direct explanation ──────────────
      twLine('gpt',  'Your nose is in your visual field right now. Every waking second.', { speed: NORM, pause: 900 }),
      twLine('gpt',  'Your brain edits it out. Useless info.',                            { speed: NORM, pause: 800 }),
      twLine('gpt',  'Same with the literal hole in your retina. It paints over with a best guess.', { speed: NORM, pause: 1100 }),
      twLine('gpt',  'You don\'t see reality. You see your brain\'s <strong>best running guess</strong> of it.', { speed: SLOW, pause: 1300 }),

      // ── PIVOT — where does learning come in? ─────────────────
      twLine('user', 'So… where does <em>learning</em> come in?',                         { speed: FAST, pause: 800 }),
      twLine('gpt',  'Right here.',                                                       { speed: SLOW, pause: 700 }),
      twLine('gpt',  'Every moment, your brain has a prediction running.',                { speed: NORM, pause: 700 }),
      twLine('gpt',  '<em>"The next signal should feel like X."</em>',                    { speed: NORM, pause: 900 }),
      twLine('gpt',  'Then the next signal arrives.',                                     { speed: NORM, pause: 800 }),
      twLine('gpt',  'If it matches, the prediction <strong>locks in stronger</strong>.', { speed: NORM, pause: 900 }),
      twLine('gpt',  'If it doesn\'t, there\'s a <em>gap</em>.',                         { speed: SLOW, pause: 1000 }),
      twLine('gpt',  'A gap between what the brain expected…',                            { speed: NORM, pause: 600 }),
      twLine('gpt',  'and what actually came in.',                                        { speed: SLOW, pause: 1100 }),

      // ── VISUAL — prediction vs signal, gap labelled ──────────
      PREDICTION_ERROR_SLIDE,

      twLine('gpt',  'That gap has a name: <strong>prediction error</strong>.',           { speed: SLOW, pause: 1100 }),
      twLine('gpt',  'And your brain <em>hates</em> that gap.',                           { speed: SLOW, pause: 1300 }),

      // ── CONCRETE EXAMPLE — the rabbit ────────────────────────
      twLine('gpt',  'Quick example.',                                                    { speed: SLOW, pause: 700 }),
      twLine('gpt',  'You\'re looking for your rabbit. Catch a glimpse out the corner of your eye.', { speed: NORM, pause: 900 }),
      twLine('gpt',  'You turn. <em>She\'s not there.</em>',                              { speed: SLOW, pause: 1000 }),
      twLine('gpt',  'Your brain just <strong>updated the algorithm</strong>.',           { speed: SLOW, pause: 800 }),
      twLine('gpt',  '<em>That</em> is learning.',                                        { speed: SLOW, pause: 1500 }),

      // ── RECAST — what the word actually means ────────────────
      twLine('user', 'So learning isn\'t… memorising things?',                            { speed: FAST, pause: 800 }),
      twLine('gpt',  'Learning is your brain getting <em>less wrong</em>.',               { speed: SLOW, pause: 1200 }),
      twLine('gpt',  'You don\'t learn by being told.',                                   { speed: NORM, pause: 700 }),
      twLine('gpt',  'You learn by being <strong>surprised</strong>. Then updating.',    { speed: SLOW, pause: 1300 }),

      // ── THE LEVER ────────────────────────────────────────────
      twLine('gpt',  'So if you want to learn anything.',                                { speed: NORM, pause: 600 }),
      twLine('gpt',  'A skill. A person. Your own body.',                                 { speed: NORM, pause: 700 }),
      twLine('gpt',  'don\'t just read about it. Don\'t just watch about it.',            { speed: NORM, pause: 800 }),
      twLine('gpt',  'Put yourself somewhere your predictions <strong>break</strong>.',   { speed: SLOW, pause: 1100 }),
      twLine('gpt',  'Then watch the gap close.',                                         { speed: SLOW, pause: 900 }),
      twLine('gpt',  '<em>That</em> is learning.',                                        { speed: SLOW, pause: 1500 }),

      // Outro
      askOutroSlide(),
    ];
  }

  // ────────────────────────────────────────────────────────────
  //  Reel registry
  // ────────────────────────────────────────────────────────────

  function buildGoalSettingReel(){
    const trainingStyle = '--goal-accent:#2563eb;--goal-soft:#eff6ff;--goal-border:#bfdbfe;--goal-gradient:linear-gradient(135deg,#2563eb,#06b6d4);';
    const foodStyle = '--goal-accent:#16a34a;--goal-soft:#f0fdf4;--goal-border:#bbf7d0;--goal-gradient:linear-gradient(135deg,#16a34a,#84cc16);';
    const recoveryStyle = '--goal-accent:#d8b25e;--goal-soft:rgba(216,178,94,0.14);--goal-border:rgba(245,217,138,0.28);--goal-gradient:linear-gradient(135deg,#f5d98a,#d8b25e,#9f7628);';
    const healthStyle = '--goal-accent:#d97706;--goal-soft:#fffbeb;--goal-border:#fde68a;--goal-gradient:linear-gradient(135deg,#f59e0b,#ef4444);';
    const communityStyle = '--goal-accent:#0891b2;--goal-soft:#ecfeff;--goal-border:#a5f3fc;--goal-gradient:linear-gradient(135deg,#0891b2,#14b8a6);';
    const goalCss = `
      <style>
        @keyframes goalTapPulse { 0% { transform: scale(.82); opacity:.95; } 55% { transform: scale(1.55); opacity:.35; } 100% { transform: scale(2.1); opacity:0; } }
        @keyframes goalFloatIn { from { transform: translateY(24px) scale(.96); opacity:0; } to { transform: translateY(0) scale(1); opacity:1; } }
        @keyframes goalSaveGlow { 0%,100% { box-shadow:0 10px 24px rgba(216,178,94,.26); } 50% { box-shadow:0 0 0 5px rgba(216,178,94,.18),0 16px 32px rgba(216,178,94,.38); } }
        .goal-phone{width:min(88vw,376px);height:min(72vh,660px);max-height:660px;border:7px solid #111827;border-radius:34px;background:#f8fafc;box-shadow:10px 12px 0 #000,0 26px 60px rgba(0,0,0,.32);overflow:hidden;position:relative;margin-top:14px;animation:goalFloatIn .55s ease both;}
        .goal-status{height:24px;background:#111827;color:white;display:flex;align-items:center;justify-content:space-between;padding:0 18px;font-size:.62rem;font-weight:900;letter-spacing:.04em;}
        .goal-app{height:calc(100% - 24px);padding:16px;background:linear-gradient(180deg,#f8fafc 0%,#edf2f7 100%);color:#0f172a;position:relative;overflow:hidden;}
        .goal-home-title{font-size:1.05rem;font-weight:950;line-height:1.05;margin-bottom:12px;}
        .goal-home-card{border-radius:18px;background:linear-gradient(135deg,#171717 0%,#0a0a0a 58%,#000 100%);border:1px solid rgba(245,217,138,.18);box-shadow:0 18px 42px rgba(0,0,0,.34);padding:15px;color:white;position:relative;overflow:hidden;}
        .goal-orb{position:absolute;right:14px;top:14px;width:62px;height:62px;border-radius:999px;background:#f8c55a;box-shadow:0 0 28px rgba(248,197,90,.36);opacity:.9;}
        .goal-orb:after{content:"";position:absolute;right:18px;top:-9px;width:54px;height:54px;border-radius:999px;background:#111;}
        .goal-ring{position:absolute;left:16px;bottom:-46px;width:96px;height:96px;border-radius:999px;border:1px solid rgba(255,255,255,.14);}
        .goal-eyebrow{font-size:.58rem;color:#fde68a;text-transform:uppercase;letter-spacing:.08em;font-weight:950;margin-bottom:4px;}
        .goal-title{font-size:1.02rem;font-weight:950;line-height:1.12;}
        .goal-sub{font-size:.72rem;color:rgba(255,255,255,.75);line-height:1.35;margin-top:5px;}
        .goal-count-badge{width:52px;height:52px;border-radius:16px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;color:#fde68a;font-weight:950;font-size:1.18rem;flex-shrink:0;box-shadow:0 10px 24px rgba(15,23,42,.22);position:relative;}
        .goal-set-btn,.goal-save-btn{border:1px solid rgba(245,217,138,.34);background:linear-gradient(135deg,#f5d98a,#d8b25e);color:#090909;border-radius:12px;padding:9px 13px;font-size:.72rem;font-weight:950;box-shadow:0 10px 22px rgba(0,0,0,.28);}
        .goal-save-btn{background:linear-gradient(135deg,#f5d98a,#d8b25e 56%,#9f7628);color:#090909;width:100%;animation:goalSaveGlow 1.7s ease-in-out infinite;}
        .goal-tap{position:absolute;width:22px;height:22px;border-radius:999px;background:#facc15;border:3px solid white;box-shadow:0 6px 16px rgba(0,0,0,.26);z-index:4;}
        .goal-tap:after{content:"";position:absolute;inset:-5px;border-radius:999px;border:3px solid #facc15;animation:goalTapPulse 1.15s ease-out infinite;}
        .goal-sheet{position:absolute;left:0;right:0;bottom:0;height:92%;background:linear-gradient(180deg,#111 0%,#050505 100%);border-radius:24px 24px 0 0;box-shadow:0 -24px 66px rgba(0,0,0,.58);border:1px solid rgba(245,217,138,.16);overflow:hidden;}
        .goal-sheet-head{position:relative;padding:15px 17px;border-bottom:1px solid rgba(245,217,138,.16);background:linear-gradient(135deg,#191919 0%,#090909 58%,#000 100%);color:white;overflow:hidden;}
        .goal-sheet-head:before{content:"";position:absolute;right:48px;top:13px;width:58px;height:58px;border-radius:999px;background:#f8c55a;box-shadow:0 0 30px rgba(248,197,90,.35);opacity:.95;}
        .goal-sheet-head:after{content:"";position:absolute;right:63px;top:5px;width:50px;height:50px;border-radius:999px;background:#111;}
        .goal-sheet-title-row{display:flex;align-items:center;justify-content:space-between;gap:12px;position:relative;z-index:1;}
        .goal-sheet-head .goal-title{font-size:1rem;max-width:220px;}
        .goal-close-btn{width:34px;height:34px;border:none;border-radius:50%;background:white;color:#0f172a;font-size:1.22rem;line-height:1;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 18px rgba(15,23,42,.08);font-weight:800;flex-shrink:0;}
        .goal-sheet-body{height:calc(100% - 78px);overflow:hidden;padding:13px 15px 76px;}
        .goal-selected-panel{padding:11px 13px;border-radius:16px;background:linear-gradient(135deg,#fff,#f8fafc);border:1px solid rgba(15,23,42,.08);box-shadow:0 8px 22px rgba(15,23,42,.05);color:#0f172a;}
        .goal-selected-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:4px;}
        .goal-selected-title{font-size:.82rem;font-weight:950;color:#0f172a;}
        .goal-selected-sub{font-size:.62rem;color:#64748b;font-weight:800;margin-top:2px;line-height:1.25;}
        .goal-selected-count{font-size:.72rem;font-weight:950;color:#047857;}
        .goal-empty{font-size:.76rem;color:#64748b;font-weight:800;padding:10px 0;}
        .goal-category{margin-top:12px;padding:12px;border-radius:18px;background:rgba(255,255,255,.92);border:1px solid rgba(255,255,255,.22);box-shadow:0 12px 26px rgba(18,8,34,.18);color:#0f172a;}
        .goal-category-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px;}
        .goal-category-title{display:flex;align-items:center;gap:8px;font-weight:950;color:#0f172a;font-size:.88rem;}
        .goal-category-badge,.goal-selected-badge{border-radius:10px;background:var(--goal-gradient);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:950;box-shadow:0 8px 16px var(--goal-border);flex-shrink:0;}
        .goal-category-badge{width:27px;height:27px;font-size:.64rem;}
        .goal-category-blurb{font-size:.62rem;color:#475569;font-weight:800;text-align:right;line-height:1.2;}
        .goal-choice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}
        .goal-choice{border:1px solid rgba(15,23,42,.08);background:rgba(255,255,255,.96);color:#0f172a;border-radius:14px;padding:10px;text-align:left;min-height:68px;display:flex;flex-direction:column;justify-content:space-between;gap:6px;box-shadow:0 8px 18px rgba(26,11,50,.08);}
        .goal-choice strong{font-size:.76rem;line-height:1.16;font-weight:950;}
        .goal-choice-bottom{display:flex;align-items:center;justify-content:space-between;gap:6px;}
        .goal-choice span{font-size:.62rem;color:#475569;font-weight:800;line-height:1.15;}
        .goal-choice-pill{background:var(--goal-soft);border:1px solid var(--goal-border);color:var(--goal-accent);border-radius:999px;padding:4px 7px;font-size:.58rem;font-weight:950;white-space:nowrap;}
        .goal-choice.selected{border-color:var(--goal-accent);background:var(--goal-soft);box-shadow:0 0 0 2px rgba(15,23,42,.05) inset,0 10px 22px rgba(15,23,42,.08);}
        .goal-choice.selected .goal-choice-pill{background:#fff;}
        .goal-selected-row{display:flex;align-items:center;gap:9px;padding:10px 0;border-top:1px solid rgba(15,23,42,.08);}
        .goal-selected-row:first-of-type{border-top:0;}
        .goal-selected-badge{width:32px;height:32px;border-radius:12px;font-size:.68rem;}
        .goal-chip-wrap{display:flex;align-items:center;justify-content:flex-end;gap:5px;flex-wrap:wrap;max-width:176px;margin-left:auto;}
        .goal-chip-wrap span,.goal-stepper span{font-size:.62rem;color:#64748b;font-weight:900;margin-left:1px;}
        .goal-target-chip{min-width:29px;height:29px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;color:#334155;font-size:.76rem;font-weight:950;}
        .goal-target-chip.selected{border-color:var(--goal-accent);background:var(--goal-gradient);color:#fff;box-shadow:0 8px 16px var(--goal-border);}
        .goal-stepper{margin-left:auto;display:flex;align-items:center;justify-content:flex-end;gap:5px;flex-wrap:nowrap;}
        .goal-stepper button{width:29px;height:29px;border-radius:10px;border:1px solid var(--goal-border);background:var(--goal-soft);color:var(--goal-accent);font-size:.95rem;font-weight:950;}
        .goal-stepper input{width:54px;border:1px solid #cbd5e1;border-radius:10px;padding:6px 7px;font-size:.8rem;font-weight:900;color:#0f172a;text-align:center;}
        .goal-sheet-actions{position:absolute;left:0;right:0;bottom:0;background:white;border-top:1px solid #e2e8f0;padding:12px 15px 13px;display:flex;gap:9px;}
        .goal-cancel-btn{flex:0 0 auto;border:1px solid #cbd5e1;background:white;color:#0f172a;border-radius:12px;padding:11px 13px;font-weight:950;}
        .goal-progress-card{padding:10px 11px;margin-top:8px;border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.92);border-radius:14px;box-shadow:0 8px 18px rgba(15,23,42,.08);color:#0f172a;}
        .goal-progress-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px;}
        .goal-progress-left{min-width:0;display:flex;gap:9px;align-items:flex-start;}
        .goal-progress-badge{width:30px;height:30px;border-radius:10px;background:var(--goal-gradient);color:white;font-size:.72rem;font-weight:950;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 8px 18px var(--goal-border);}
        .goal-progress-label{font-size:.8rem;font-weight:950;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .goal-progress-category{font-size:.64rem;color:var(--goal-accent);font-weight:850;text-transform:uppercase;letter-spacing:.04em;}
        .goal-progress-num{font-size:.78rem;font-weight:950;color:#334155;white-space:nowrap;}
        .goal-progress-track{height:8px;background:#e2e8f0;border-radius:999px;overflow:hidden;}
        .goal-progress-fill{height:100%;width:var(--pct);background:var(--goal-gradient);border-radius:999px;}
      </style>`;
    const phone = (inner) => `
      ${goalCss}
      <div class="goal-phone">
        <div class="goal-status"><span>9:41</span><span>Balance</span><span>100%</span></div>
        <div class="goal-app">${inner}</div>
      </div>`;
    const choice = (style, label, hint, selected) => `
      <div class="goal-choice ${selected ? 'selected' : ''}" style="${style}">
        <strong>${label}</strong>
        <div class="goal-choice-bottom">
          <span>${hint}</span>
          <span class="goal-choice-pill">${selected ? 'Picked' : 'Choose'}</span>
        </div>
      </div>`;
    const categoryBlock = (style, short, name, blurb, choices) => `
      <div class="goal-category" style="${style}">
        <div class="goal-category-head">
          <div class="goal-category-title"><div class="goal-category-badge">${short}</div><div>${name}</div></div>
          <div class="goal-category-blurb">${blurb}</div>
        </div>
        <div class="goal-choice-grid">${choices}</div>
      </div>`;
    const chipWrap = (style, values, selected, unit) => `
      <div class="goal-chip-wrap">
        ${values.map(value => `<button class="goal-target-chip ${value === selected ? 'selected' : ''}" style="${style}">${value}</button>`).join('')}
        <span>${unit}</span>
      </div>`;
    const stepper = (style, value, unit) => `
      <div class="goal-stepper" style="${style}">
        <button>-</button><input value="${value}" readonly><button>+</button><span>${unit}</span>
      </div>`;
    const selectedRow = (style, short, label, category, targetHtml) => `
      <div class="goal-selected-row" style="${style}">
        <div class="goal-selected-badge">${short}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:.78rem;font-weight:950;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${label}</div>
          <div style="font-size:.64rem;color:var(--goal-accent);font-weight:900;">${category}</div>
        </div>
        ${targetHtml}
      </div>`;
    const progressCard = (style, short, label, category, current, target, pct) => `
      <div class="goal-progress-card" style="${style}">
        <div class="goal-progress-top">
          <div class="goal-progress-left">
            <div class="goal-progress-badge">${short}</div>
            <div style="min-width:0;">
              <div class="goal-progress-label">${label}</div>
              <div class="goal-progress-category">${category}</div>
            </div>
          </div>
          <div class="goal-progress-num">${current} / ${target}</div>
        </div>
        <div class="goal-progress-track"><div class="goal-progress-fill" style="--pct:${pct}%"></div></div>
      </div>`;
    const emptySelectedPanel = `
      <div class="goal-selected-panel">
        <div class="goal-selected-head">
          <div><div class="goal-selected-title">Selected</div><div class="goal-selected-sub">Set the amount that feels right for your week.</div></div>
          <div class="goal-selected-count" style="color:#64748b;">0 / 3</div>
        </div>
        <div class="goal-empty">Pick up to 3 goals. Nothing is mandatory.</div>
      </div>`;
    const selectedPanel = `
      <div class="goal-selected-panel">
        <div class="goal-selected-head">
          <div><div class="goal-selected-title">Selected</div><div class="goal-selected-sub">Set the amount that feels right for your week.</div></div>
          <div class="goal-selected-count">3 / 3</div>
        </div>
        ${selectedRow(trainingStyle, 'T', 'Complete workouts', 'Training', chipWrap(trainingStyle, [1,2,3,4,5], 3, 'workouts'))}
        ${selectedRow(foodStyle, 'F', 'Log meals', 'Food', chipWrap(foodStyle, [3,4,5,6,7], 5, 'days'))}
        ${selectedRow(healthStyle, 'IQ', 'Answer Health IQ questions', 'Health IQ', stepper(healthStyle, 20, 'questions'))}
      </div>`;

    return [
      { bg: 'ww-bg-intro', hold_ms: 3200, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-halftone"></div>
        <div class="ww-kicker">New feature drop</div>
        <div class="ww-big-num" style="font-size: clamp(2.85rem, 12vw, 5.9rem); line-height:0.98;">GOAL<br>SETTING</div>
        <div class="ww-caption">Weekly goals are live in Balance.</div>
      `},
      { bg: 'ww-bg-workouts', hold_ms: 4500, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-kicker">Step 1</div>
        ${phone(`
          <div class="goal-home-title">Today</div>
          <div style="height:58px;border-radius:16px;background:white;border:1px solid #e2e8f0;margin-bottom:12px;"></div>
          <div class="goal-home-card">
            <div class="goal-orb"></div>
            <div class="goal-ring"></div>
            <div style="display:flex;gap:14px;align-items:center;position:relative;">
              <div class="goal-count-badge">3</div>
              <div>
                <div class="goal-eyebrow">Weekly goals</div>
                <div class="goal-title">Choose your 3 for the week</div>
                <div class="goal-sub">Body, training, food, recovery, Health IQ, or community.</div>
              </div>
              <button class="goal-set-btn">Set</button>
            </div>
            <div class="goal-tap" style="right:18px;top:62px;"></div>
          </div>
        `)}
        <div class="ww-caption">Open Balance and tap Set on Weekly goals.</div>
      `},
      { bg: 'ww-bg-xp', hold_ms: 5000, html: `
        <div class="ww-halftone"></div>
        <div class="ww-kicker">Step 2</div>
        ${phone(`
          <div class="goal-sheet">
            <div class="goal-sheet-head">
              <div class="goal-sheet-title-row">
                <div>
                  <div class="goal-eyebrow">Weekly goals</div>
                  <div class="goal-title">Choose 3 for this week</div>
                </div>
                <div class="goal-close-btn">&times;</div>
              </div>
            </div>
            <div class="goal-sheet-body">
              ${emptySelectedPanel}
              ${categoryBlock(trainingStyle, 'T', 'Training', 'Sessions and independence',
                choice(trainingStyle, 'Complete workouts', 'Pick your workout count', false) +
                choice(trainingStyle, 'Build your own workout', 'Pick your workout count', false)
              )}
              ${categoryBlock(foodStyle, 'F', 'Food', 'Protein, calories, and logging',
                choice(foodStyle, 'Hit protein', 'Pick your days after choosing', false) +
                choice(foodStyle, 'Log meals', 'Pick your days after choosing', false)
              )}
              ${categoryBlock(healthStyle, 'IQ', 'Health IQ', 'Learn through quizzes and games',
                choice(healthStyle, 'Complete Daily Quiz', 'Pick your days after choosing', false) +
                choice(healthStyle, 'Answer Health IQ questions', 'Pick your question goal', false)
              )}
            </div>
            <div class="goal-tap" style="left:27%;top:252px;"></div>
          </div>
        `)}
        <div class="ww-caption">Choose from the same category cards clients see.</div>
      `},
      { bg: 'ww-bg-predict', hold_ms: 5200, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-kicker">Step 3</div>
        ${phone(`
          <div class="goal-sheet">
            <div class="goal-sheet-head">
              <div class="goal-sheet-title-row">
                <div>
                  <div class="goal-eyebrow">Weekly goals</div>
                  <div class="goal-title">Choose 3 for this week</div>
                </div>
                <div class="goal-close-btn">&times;</div>
              </div>
            </div>
            <div class="goal-sheet-body">
              ${selectedPanel}
              ${categoryBlock(recoveryStyle, 'R', 'Recovery', 'Sleep, steps, water, check-ins',
                choice(recoveryStyle, 'Sleep 7+ hours', 'Pick your nights after choosing', false) +
                choice(recoveryStyle, 'Mood check-in', 'Pick your days after choosing', false)
              )}
              ${categoryBlock(communityStyle, 'C', 'Community', 'Coach, Feed, friends, and games',
                choice(communityStyle, 'Share workout to Feed', 'Pick your target after choosing', false) +
                choice(communityStyle, 'Message your coach', 'Pick your target after choosing', false)
              )}
            </div>
            <div class="goal-sheet-actions">
              <button class="goal-cancel-btn">Cancel</button>
              <button class="goal-save-btn">Save goals</button>
            </div>
            <div class="goal-tap" style="right:48px;bottom:30px;"></div>
          </div>
        `)}
        <div class="ww-caption">Use the real target chips and steppers, then save.</div>
      `},
      { bg: 'ww-bg-pbs', hold_ms: 5200, html: `
        <div class="ww-halftone"></div>
        <div class="ww-kicker" style="color:#1a0a00;">Step 4</div>
        ${phone(`
          <div class="goal-home-title">Today</div>
          <div class="goal-home-card">
            <div class="goal-orb"></div>
            <div class="goal-ring"></div>
            <div class="goal-eyebrow">Weekly goals</div>
            <div class="goal-title">This week</div>
            <div style="display:flex;align-items:baseline;gap:7px;margin:12px 0 8px;">
              <div style="font-size:2.2rem;line-height:1;font-weight:950;color:white;">0</div>
              <div style="font-size:.88rem;font-weight:850;color:rgba(255,255,255,.72);">of 3 hit</div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">
              <span class="ww-store-pill" style="font-size:.56rem;padding:6px 8px;">T 3 workouts</span>
              <span class="ww-store-pill" style="font-size:.56rem;padding:6px 8px;">F 5 days</span>
              <span class="ww-store-pill" style="font-size:.56rem;padding:6px 8px;">IQ 2 lessons</span>
            </div>
            <div style="margin:8px 0 4px;padding:9px 11px;border-radius:999px;background:rgba(253,230,138,.16);border:1px solid rgba(253,230,138,.3);display:flex;align-items:center;justify-content:space-between;gap:10px;position:relative;">
              <span style="font-size:.62rem;color:#fde68a;font-weight:950;text-transform:uppercase;letter-spacing:.06em;">Wrapped reward</span>
              <span style="font-size:.72rem;color:white;font-weight:950;white-space:nowrap;">Up to 50 XP</span>
            </div>
            ${progressCard(trainingStyle, 'T', 'Complete workouts', 'Training', '0', '3', 0)}
            ${progressCard(foodStyle, 'F', 'Log meals', 'Food', '0', '5', 0)}
            ${progressCard(healthStyle, 'IQ', 'Answer Health IQ questions', 'Health IQ', '0', '20', 0)}
          </div>
        `)}
        <div class="ww-caption" style="color:#1a0a00; font-weight:800;">Now Balance tracks the week you chose.</div>
      `},
      { bg: 'ww-bg-social', hold_ms: 4200, html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-kicker">Want help setting yours?</div>
        <div class="ww-big-num" style="font-size: clamp(3.2rem, 13vw, 6.4rem); line-height:0.98;">DM<br>GOAL</div>
        <div class="ww-stamp green" style="margin-top:20px;">2 MINUTE SETUP</div>
      `},
      ctaSlide(),
    ];
  }

  function buildEmotionalEaterStoryReel(){
    const FAST = 30, NORM = 38, SLOW = 48;
    return [
      storyCardLine('client', 'but shan im an emotional eater', { speed: NORM, pause: 850 }),
      storyCardLine('shan', 'i get it,', { speed: SLOW, pause: 900 }),
      storyCardLine('shan', 'im an emotional eater, and an emotional starver.', { speed: NORM, pause: 1150 }),
      storyCardLine('shan', 'let me tell you a story about how i fluked my way out of a 2 year binge eating cycle', { speed: FAST, pause: 1600 }),
    ];
  }

  const REELS = {
    'goal-setting': { name: 'Goal Setting Feature Drop', emoji: 'GOAL', theme: 'synthwave', build: buildGoalSettingReel, needsFitgotchi: false },
    'full':      { name: 'Full App Promo',    emoji: '🎬', theme: 'synthwave', build: () => buildPromoSlides(), needsFitgotchi: true },
    'calorie':   { name: 'Calorie Tracker',   emoji: '📸', theme: 'lofi',      build: buildCalorieReel,   needsFitgotchi: false },
    'fitgotchi': { name: 'FitGotchi + Battles', emoji: '⚔️', theme: 'phonk',   build: buildFitgotchiReel, needsFitgotchi: true },
    'learning':  { name: 'Learning',          emoji: '🎓', theme: 'jazz',      build: buildLearningReel,  needsFitgotchi: false },
    'feed':      { name: 'The Feed',          emoji: '💬', theme: 'synthwave', build: buildFeedReel,      needsFitgotchi: false },
    'cycle':     { name: 'Cycle Sync',        emoji: '🌸', theme: 'lofi',      build: buildCycleReel,     needsFitgotchi: false },
    'battles':   { name: 'Quiz Battles',      emoji: '⚡', theme: 'techno',    build: buildBattlesReel,   needsFitgotchi: false },
    'level-saga': { name: 'DBZ Saga Unlocks', emoji: '🌟', theme: 'trap', build: buildLevelCharacterReel, needsFitgotchi: false },
    'challenge-week-one': { name: '30 Day Challenge Week 1', emoji: '30', theme: 'techno', build: buildChallengeWeekOneReel, needsFitgotchi: false, loadingLabel: 'Collecting live challenge stats...' },
    'challenge-week-two': { name: '30 Day Challenge Week 2 Review', emoji: 'W2', theme: 'techno', build: buildChallengeWeekTwoReel, needsFitgotchi: false, loadingLabel: 'Collecting live week 2 stats...' },
    'challenge-week-three': { name: '30 Day Challenge Week 3 Recap', emoji: 'W3', theme: 'techno', build: buildChallengeWeekThreeReel, needsFitgotchi: false, loadingLabel: 'Collecting live week 3 stats...' },
    'balance-weekly-review': { name: 'Balance Weekly Review', emoji: 'APP', theme: 'techno', build: buildBalanceWeeklyReviewReel, needsFitgotchi: false, loadingLabel: 'Collecting live Balance app stats...' },
    'emotional-eater-story': { name: 'Emotional Eater Story', emoji: 'TXT', theme: 'lofi', build: buildEmotionalEaterStoryReel, needsFitgotchi: false },
    // Educational "Ask ChatGPT" series — different palette (indigo/cyan),
    // chat-bubble layout, soft-sell outro. Screen-record from admin exactly
    // the same way as the promo reels.
    'ask-motivation':   { name: 'Ask: What is motivation?',             emoji: '🧠', theme: 'lofi', build: buildAskMotivationReel,   needsFitgotchi: false },
    'ask-learning':     { name: 'Ask: What is learning?',               emoji: '💡', theme: 'lofi', build: buildAskLearningReel,     needsFitgotchi: false },
    'ask-conditioning': { name: 'Ask: What is Pavlovian conditioning?', emoji: '🔔', theme: 'lofi', build: buildAskConditioningReel, needsFitgotchi: false },
    'ask-freewill':     { name: 'Ask: Do I have free will?',            emoji: '🧭', theme: 'lofi', build: buildAskFreewillReel,     needsFitgotchi: false },
    'ask-identity':     { name: 'Ask: Is what I see even real?',        emoji: '🪞', theme: 'lofi', build: buildAskIdentityReel,     needsFitgotchi: false },
    'ask-addiction':    { name: 'Ask: What is addiction?',              emoji: '🔗', theme: 'lofi', build: buildAskAddictionReel,    needsFitgotchi: false },
  };

  function buildPromoSlides(){
    const LOGO = `<img src="/balance_logo.png" alt="Balance" style="width:clamp(140px, 42vw, 220px); height:clamp(140px, 42vw, 220px); border-radius:50%; border:5px solid #000; box-shadow:10px 10px 0 #000; background:white; object-fit:cover; animation: wwCountPop 0.85s cubic-bezier(.2,1.8,.3,1) both;">`;

    // Level-5-ish FitGotchi: rendered as a mount point only. The actual
    // <model-viewer> lives hidden on document.body during the pre-load, and
    // gets moved into this mount point on slide activation so the 3D
    // character is already fully decoded + rendering before the user sees
    // the slide. Moving a DOM node doesn't reset WebGL, so the move is
    // instant and the model is visible the moment slide 4 appears.
    const FITGOTCHI_MOUNT = `
      <div class="ww-fitgotchi-mount" style="width:clamp(240px, 64vw, 340px); height:clamp(240px, 64vw, 340px); display:flex; align-items:center; justify-content:center; position:relative; z-index:2;"></div>`;

    const slides = [];

    // 1. LOGO INTRO
    slides.push({
      bg: 'ww-bg-intro',
      html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-halftone"></div>
        ${LOGO}
        <div class="ww-big-num" style="font-size: clamp(3.2rem, 14vw, 7rem); margin-top:28px;">BALANCE</div>
        <div class="ww-caption" style="letter-spacing:4px; text-transform:uppercase; font-size:0.85rem;">fitness · fuel · fitgotchi</div>
      `,
      hold_ms: 4200,
    });

    // 2. WORKOUTS + PBs
    slides.push({
      bg: 'ww-bg-workouts',
      html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-kicker">Track every session</div>
        <div class="ww-big-num" style="font-size: clamp(4.5rem, 18vw, 10rem);">🏋️</div>
        <div class="ww-caption">Log it. Share it. Smash PBs.</div>
        <div class="ww-stamp green" style="margin-top:26px;">NEW RECORD</div>
      `,
      hold_ms: 4500,
    });

    // 3. AI MEAL PHOTO
    slides.push({
      bg: 'ww-bg-minutes',
      html: `
        <div class="ww-halftone"></div>
        <div class="ww-kicker">Log meals in 3 seconds</div>
        <div class="ww-big-num" style="font-size: clamp(4rem, 16vw, 9rem);">📸 → 🤖</div>
        <div class="ww-caption">Snap a plate. AI nails the calories + macros.</div>
      `,
      hold_ms: 4500,
    });

    // 4. FITGOTCHI — actual Level-5-ish 3D character (not the egg)
    slides.push({
      bg: 'ww-bg-predict',
      html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-kicker">Meet your FitGotchi</div>
        ${FITGOTCHI_MOUNT}
        <div class="ww-caption" style="margin-top:12px;">Feed it, train it, evolve it — levels up as you do.</div>
        <div class="ww-stamp purple" style="margin-top:18px;">EVOLVE</div>
      `,
      hold_ms: 5500,
    });

    // 5. MOOD + ENERGY
    slides.push({
      bg: 'ww-bg-mood',
      html: `
        <div class="ww-kicker">Daily mood + energy</div>
        <div style="display:flex; gap:14px; font-size: clamp(2rem, 10vw, 4.5rem); margin-top:14px;">
          <span>😣</span><span>😕</span><span>😐</span><span>🙂</span><span>😄</span>
        </div>
        <div class="ww-caption" style="margin-top:22px;">3 taps a day keeps your coach + AI dialled in.</div>
      `,
      hold_ms: 4500,
    });

    // 6. STREAKS
    slides.push({
      bg: 'ww-bg-streak',
      html: `
        <div class="ww-halftone"></div>
        <div class="ww-kicker">Streak that scares you</div>
        <div class="ww-flame">🔥</div>
        <div class="ww-caption">Don't break the chain.</div>
      `,
      hold_ms: 4200,
    });

    // 7. QUIZ BATTLES
    slides.push({
      bg: 'ww-bg-social',
      html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-kicker">Battle your mates</div>
        <div class="ww-big-num" style="font-size: clamp(4rem, 18vw, 10rem);">⚡</div>
        <div class="ww-caption">Quiz Battles · Workout Duels · Challenge Leagues.</div>
        <div class="ww-stamp blue" style="margin-top:22px;">BET COINS</div>
      `,
      hold_ms: 4500,
    });

    // 8. LEARNING — Duolingo-style fitness lessons
    slides.push({
      bg: 'ww-bg-xp',
      html: `
        <div class="ww-halftone"></div>
        <div class="ww-kicker">Learn + earn XP</div>
        <div class="ww-big-num" style="font-size: clamp(4.5rem, 20vw, 10rem);">🎓</div>
        <div class="ww-caption">Duolingo-style fitness + nutrition lessons. Score 100% on the quiz = bonus XP.</div>
        <div class="ww-stamp gold" style="margin-top:22px;">+25 XP</div>
      `,
      hold_ms: 4500,
    });

    // 9. COINS + RARES
    slides.push({
      bg: 'ww-bg-pbs',
      html: `
        <div class="ww-halftone"></div>
        <div class="ww-kicker" style="color:#1a0a00;">Earn coins. Win rares.</div>
        <div class="ww-big-num" style="font-size: clamp(4.5rem, 20vw, 11rem); color:#1a0a00; text-shadow: 4px 4px 0 #fff, 8px 8px 0 rgba(255,255,255,0.45);">🪙</div>
        <div class="ww-caption" style="color:#1a0a00; font-weight:700;">Monthly raffle drops one rare skin to one lucky winner.</div>
      `,
      hold_ms: 4500,
    });

    // 10. CTA — logo + app store names
    slides.push({
      bg: 'ww-bg-intro',
      html: `
        <div class="ww-speed-lines"></div>
        <div class="ww-halftone"></div>
        ${LOGO}
        <div class="ww-big-num" style="font-size: clamp(2.2rem, 9vw, 4.4rem); margin-top:22px; line-height:1;">BALANCE</div>
        <div class="ww-caption" style="font-size:0.95rem; margin-top:6px; opacity:0.92;">Fitness Gamified</div>
        <div style="display:flex; gap:10px; margin-top:26px; flex-wrap:wrap; justify-content:center;">
          <div class="ww-store-pill">📱 App Store</div>
          <div class="ww-store-pill">▶ Google Play</div>
        </div>
        <div class="ww-stamp gold" style="margin-top:22px;">DOWNLOAD FREE</div>
        <button class="ww-cta-btn" data-ww-finish style="margin-top:24px;">Done</button>
      `,
      hold_ms: 8000,
    });

    return slides;
  }

  // Lazy-load the model-viewer web component once per page load so the
  // FitGotchi slide can render the GLB character. No-op in dashboard.html
  // where it's already loaded.
  //
  // CRITICAL: our character GLBs on Backblaze are meshopt-compressed. We
  // have to set `MV.meshoptDecoderLocation` BEFORE the first GLB load, or
  // model-viewer silently fails with "THREE.GLTFLoader: setMeshoptDecoder
  // must be called before loading compressed files" and never fires 'load'.
  const MESHOPT_DECODER_URL = 'https://cdn.jsdelivr.net/npm/meshoptimizer@0.21.0/meshopt_decoder.min.js';
  let _mvLoadPromise = null;
  function wireMeshoptDecoder(){
    try {
      const MV = customElements.get && customElements.get('model-viewer');
      if (MV && !MV.meshoptDecoderLocation) MV.meshoptDecoderLocation = MESHOPT_DECODER_URL;
    } catch(_){}
  }
  function ensureModelViewer(){
    if (customElements.get && customElements.get('model-viewer')) {
      wireMeshoptDecoder();
      return Promise.resolve();
    }
    if (_mvLoadPromise) return _mvLoadPromise;
    _mvLoadPromise = new Promise((resolve) => {
      // Set up the meshopt-decoder hook so it takes effect as soon as the
      // custom element registers (may race against the script's onload).
      if (customElements.whenDefined) {
        customElements.whenDefined('model-viewer').then(wireMeshoptDecoder).catch(()=>{});
      }
      const existing = document.querySelector('script[src*="model-viewer"]');
      if (existing) { existing.addEventListener('load', () => { wireMeshoptDecoder(); resolve(); }); return; }
      const s = document.createElement('script');
      s.type = 'module';
      s.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js';
      s.onload = () => { wireMeshoptDecoder(); resolve(); };
      s.onerror = () => resolve(); // degrade gracefully
      document.head.appendChild(s);
    });
    return _mvLoadPromise;
  }

  // FitGotchi character GLB — fully preloaded before the promo starts
  // so the slide-4 model-viewer renders instantly from cache.
  const PROMO_FITGOTCHI_URL = 'https://f005.backblazeb2.com/file/shannonsvideos/level_10_real_final.glb';

  async function preloadFitgotchi(onProgress){
    // 1. Instantiate a hidden model-viewer on-screen (tiny corner) with
    //    eager loading reveal. On-screen is important — some browsers skip
    //    WebGL rendering for fully-offscreen canvases which stalls 'load'.
    return new Promise((resolve) => {
      const hidden = document.createElement('model-viewer');
      hidden.id = 'ww-fitgotchi-preload';
      hidden.setAttribute('src', PROMO_FITGOTCHI_URL);
      hidden.setAttribute('reveal', 'auto');
      hidden.setAttribute('loading', 'eager');
      hidden.setAttribute('auto-rotate', '');
      hidden.setAttribute('interaction-prompt', 'none');
      // Start facing the camera. GLBs on Backblaze are authored facing +X,
      // so the default theta (0deg) shows the character's back. 90deg
      // rotates the orbit around to put the character's face toward the
      // camera for the first frame the user sees on slide 4.
      hidden.setAttribute('camera-orbit', '90deg 85deg 22m');
      hidden.setAttribute('field-of-view', '28deg');
      hidden.setAttribute('shadow-intensity', '1.1');
      hidden.setAttribute('exposure', '1.1');
      hidden.setAttribute('rotation-per-second', '45deg');
      hidden.setAttribute('disable-zoom', '');
      hidden.setAttribute('disable-pan', '');
      // Small but visible: 2px in the corner keeps the render loop alive
      // without being noticed on top of the loading screen.
      hidden.style.cssText = 'position:fixed; left:0; bottom:0; width:2px; height:2px; opacity:0.01; pointer-events:none; z-index:99999;';

      let resolved = false;
      const done = () => {
        if (resolved) return;
        resolved = true;
        resolve(hidden);
      };
      hidden.addEventListener('load', done, { once: true });
      hidden.addEventListener('model-visibility', (e) => {
        if (e && e.detail && e.detail.visible) done();
      });
      hidden.addEventListener('error', done, { once: true });
      if (typeof onProgress === 'function') {
        hidden.addEventListener('progress', (e) => {
          const p = (e && e.detail && e.detail.totalProgress) || 0;
          onProgress(p);
        });
      }
      document.body.appendChild(hidden);
      // Safety timeout — very generous (2 min) because user explicitly
      // doesn't mind waiting before the screen recording starts.
      setTimeout(done, 120000);
    });
  }

  async function openReel(reelId, opts){
    opts = opts || {};
    const reel = REELS[reelId] || REELS.full;
    ensureStyles();

    // Fresh overlay with a loading screen so the user sees something while
    // any GLB / web-component deps load.
    let overlay = document.getElementById('weekly-wrapped-overlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'weekly-wrapped-overlay';
    overlay.className = 'ww-overlay';
    const preloadLabel = reel.loadingLabel || (reel.needsFitgotchi ? 'Pre-loading FitGotchi model...' : 'Warming up...');
    overlay.innerHTML = `
      <div class="ww-slide active ww-bg-intro" style="display:flex;">
        <div class="ww-speed-lines"></div>
        <div class="ww-halftone"></div>
        <div class="ww-kicker" style="animation:none;">Loading ${escapeHtml(reel.name)}…</div>
        <div style="width:44px; height:44px; border:3px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation: wwSpeedSpin 0.8s linear infinite; margin-top:18px;"></div>
        <div class="ww-caption" style="margin-top:18px; font-size:0.85rem; opacity:0.75;">${escapeHtml(preloadLabel)}</div>
        <div id="ww-preload-progress" style="margin-top:14px; width:min(240px, 70vw); height:6px; background:rgba(255,255,255,0.18); border-radius:4px; overflow:hidden; ${reel.needsFitgotchi ? '' : 'display:none;'}">
          <div id="ww-preload-progress-fill" style="height:100%; width:0%; background:#fff; transition:width 0.2s ease;"></div>
        </div>
        <div id="ww-preload-progress-label" style="margin-top:8px; font-size:0.7rem; font-weight:700; letter-spacing:2px; color:rgba(255,255,255,0.6); ${reel.needsFitgotchi ? '' : 'display:none;'}">0%</div>
      </div>
      <button class="ww-close" aria-label="Close">&times;</button>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('.ww-close').onclick = () => closeOverlay();

    if (typeof window.pushNavigationState === 'function') {
      try { window.pushNavigationState('weekly-wrapped-overlay', closeOverlay); } catch(_){}
    }

    // Only pre-load the big FitGotchi GLB for reels that actually show it.
    // Other reels start instantly.
    if (reel.needsFitgotchi) {
      try {
        await ensureModelViewer();
        const fill = document.getElementById('ww-preload-progress-fill');
        const label = document.getElementById('ww-preload-progress-label');
        await preloadFitgotchi((p) => {
          const pct = Math.round(p * 100);
          if (fill) fill.style.width = pct + '%';
          if (label) label.textContent = pct + '%';
        });
        if (fill) fill.style.width = '100%';
        if (label) label.textContent = '100%';
      } catch(e) { console.warn('[reel] preload failed, continuing anyway', e); }
    }

    // Bail if the user closed the overlay during preload
    if (!document.getElementById('weekly-wrapped-overlay')) return;

    // Pick music theme — reel-specified, or opts override, or Synthwave.
    let theme = THEMES.find(t => t.id === (opts.theme || reel.theme)) || THEMES[0];

    try {
      if (currentSynth) { currentSynth.stop(); currentSynth = null; }
      currentSynth = createWrappedSynth(theme);
      if (currentSynth) {
        const wasMuted = isMutedPref();
        if (wasMuted) currentSynth.setMuted(true);
        const res = currentSynth.resume();
        const afterResume = () => {
          if (!currentSynth) return;
          if (!wasMuted && currentSynth.state() === 'running') currentSynth.fadeIn();
        };
        if (res && typeof res.then === 'function') res.then(afterResume, afterResume);
        else afterResume();
      }
    } catch(e) { console.warn('[ww] reel synth init failed', e); }

    let slides;
    try {
      const built = reel.build();
      slides = (built && typeof built.then === 'function') ? await built : built;
    } catch(e) {
      console.warn('[reel] build failed', e);
      slides = [
        { bg: 'ww-bg-intro', hold_ms: 4200, html: `
          <div class="ww-speed-lines"></div>
          <div class="ww-kicker">Reel data could not load</div>
          <div class="ww-caption">Close this, refresh the admin dashboard, and try again.</div>
        `},
        ctaSlide(),
      ];
    }
    return new Promise((resolve) => {
      renderSlides(overlay, slides, () => {
        try { if (typeof opts.onFinish === 'function') opts.onFinish(); } catch(_){}
        resolve();
      });
    });
  }

  // Back-compat shim — old callers (and the admin Promo Reel button)
  // still work; they just play the full-app reel.
  async function openPromo(opts){ return openReel('full', opts); }

  function moodFace(score){
    if (score == null) return '·';
    if (score >= 8.5) return '😄';
    if (score >= 7) return '🙂';
    if (score >= 5) return '😐';
    if (score >= 3.5) return '😕';
    return '😣';
  }

  function arrowFor(prev, cur){
    if (prev == null || cur == null) return { cls: 'flat', symbol: '·' };
    const diff = cur - prev;
    if (diff > 0.3) return { cls: 'up', symbol: '↑' };
    if (diff < -0.3) return { cls: 'down', symbol: '↓' };
    return { cls: 'flat', symbol: '→' };
  }

  function escapeHtml(s){
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderSlides(overlay, slides, onFinish){
    let idx = 0;
    let advanceTimer = null;

    // Scaffold: progress bars + close + mute + slides + tap zones
    const progress = slides.map((_, i) => `<div class="ww-progress-bar" data-i="${i}"><div class="ww-progress-bar-fill"></div></div>`).join('');
    overlay.innerHTML = `
      <div class="ww-progress">${progress}</div>
      <button class="ww-close" aria-label="Close">&times;</button>
      <button class="ww-music-btn" aria-label="Toggle sound">🔊</button>
      ${slides.map((_, i) => `<div class="ww-slide" data-slide-i="${i}"></div>`).join('')}
      <div class="ww-tap-hint">Tap to skip</div>
      <div class="ww-tap-zones">
        <div data-ww-zone="back"></div>
        <div data-ww-zone="next"></div>
      </div>
    `;

    const slideEls = overlay.querySelectorAll('.ww-slide');
    const progBars = overlay.querySelectorAll('.ww-progress-bar');

    overlay.querySelector('.ww-close').onclick = () => {
      cleanup();
      closeOverlay();
      if (onFinish) onFinish();
    };

    // ── Music button ────────────────────────────────────────
    const musicBtn = overlay.querySelector('.ww-music-btn');
    function refreshMusicBtn(){
      if (!musicBtn) return;
      if (!currentSynth) {
        musicBtn.textContent = '🔇';
        musicBtn.classList.remove('suspended');
        return;
      }
      const suspended = currentSynth.state() === 'suspended';
      musicBtn.classList.toggle('suspended', suspended);
      if (suspended) {
        musicBtn.textContent = '🔇';
      } else {
        musicBtn.textContent = isMutedPref() ? '🔇' : '🔊';
      }
    }
    refreshMusicBtn();
    // Re-check after a beat in case the context was still pending on open
    setTimeout(refreshMusicBtn, 300);
    if (musicBtn) {
      musicBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!currentSynth) return;
        if (currentSynth.state() === 'suspended') {
          // First-tap resume for iOS Safari autoplay block
          const p = currentSynth.resume();
          const after = () => {
            if (!isMutedPref()) currentSynth.fadeIn();
            refreshMusicBtn();
          };
          if (p && typeof p.then === 'function') p.then(after, after);
          else after();
          return;
        }
        const newMuted = !isMutedPref();
        setMutedPref(newMuted);
        currentSynth.setMuted(newMuted);
        if (!newMuted) currentSynth.fadeIn();
        refreshMusicBtn();
      });
    }

    const zones = overlay.querySelectorAll('[data-ww-zone]');
    zones.forEach(z => {
      z.addEventListener('click', () => {
        if (z.dataset.wwZone === 'next') advance(1);
        else advance(-1);
      });
    });

    // Hold-to-pause
    let pauseTimer = null;
    const onPressStart = () => {
      pauseTimer = setTimeout(() => setPaused(true), 180);
    };
    const onPressEnd = () => {
      clearTimeout(pauseTimer);
      setPaused(false);
    };
    overlay.addEventListener('touchstart', onPressStart, { passive: true });
    overlay.addEventListener('touchend', onPressEnd, { passive: true });
    overlay.addEventListener('mousedown', onPressStart);
    overlay.addEventListener('mouseup', onPressEnd);
    overlay.addEventListener('mouseleave', onPressEnd);

    function setPaused(paused){
      const bar = overlay.querySelector('.ww-progress-bar.current');
      if (!bar) return;
      bar.classList.toggle('paused', paused);
      if (paused) { if (advanceTimer) { clearTimeout(advanceTimer); advanceTimer = null; } }
      else { scheduleAdvance(getRemainingMs(bar)); }
    }

    function getRemainingMs(bar){
      try {
        const fill = bar.querySelector('.ww-progress-bar-fill');
        const w = fill.getBoundingClientRect().width;
        const total = bar.getBoundingClientRect().width;
        const pct = total ? w / total : 0;
        return Math.max(400, SLIDE_DURATION_MS * (1 - pct));
      } catch(_) { return SLIDE_DURATION_MS; }
    }

    function show(i){
      if (i < 0) i = 0;
      if (i >= slides.length) { cleanup(); closeOverlay(); if (onFinish) onFinish(); return; }

      idx = i;
      // Progress bars
      progBars.forEach((b, j) => {
        b.classList.remove('current', 'seen', 'paused');
        if (j < i) b.classList.add('seen');
        if (j === i) {
          b.classList.add('current');
          // Reset the CSS animation by cloning
          const fill = b.querySelector('.ww-progress-bar-fill');
          const newFill = fill.cloneNode(true);
          b.replaceChild(newFill, fill);
          newFill.style.setProperty('--dur', ((slides[i].hold_ms || SLIDE_DURATION_MS) / 1000) + 's');
        }
      });

      // Slides
      slideEls.forEach((el, j) => {
        if (j === i) {
          el.className = 'ww-slide active ' + slides[i].bg;
          el.innerHTML = slides[i].html;
          // Count-up animation for .ww-big-num[data-count]
          const numEl = el.querySelector('.ww-big-num[data-count]');
          if (numEl) animateCount(numEl, Number(numEl.dataset.count));
          // Typewriter — for any .tw-text[data-tw] on an "Ask ChatGPT" slide.
          const twEl = el.querySelector('.tw-text[data-tw]');
          if (twEl) runTypewriter(twEl);
          // FitGotchi mount — move the already-loaded preload model-viewer
          // into this slide. WebGL stays alive so the character renders
          // INSTANTLY (no new decode, no re-download).
          const mount = el.querySelector('.ww-fitgotchi-mount');
          if (mount) {
            const preload = document.getElementById('ww-fitgotchi-preload');
            if (preload) {
              preload.style.cssText = 'width:100%; height:100%; background:transparent; --poster-color:transparent;';
              mount.appendChild(preload);
            }
          }
          // Finish button
          const finishBtn = el.querySelector('[data-ww-finish]');
          if (finishBtn) {
            finishBtn.onclick = (e) => {
              e.stopPropagation();
              cleanup(); closeOverlay(); if (onFinish) onFinish();
            };
          }
          try { if (navigator.vibrate) navigator.vibrate(15); } catch(_){}
        } else {
          // If this slide currently holds the preload model-viewer, move it
          // back to its hidden home on document.body so it survives the
          // innerHTML wipe (in case user scrubs back to this slide).
          const preload = el.querySelector('#ww-fitgotchi-preload');
          if (preload) {
            preload.style.cssText = 'position:fixed; left:-9999px; top:-9999px; width:240px; height:240px; opacity:0; pointer-events:none;';
            document.body.appendChild(preload);
          }
          // Clear any lingering typewriter timer so ticks don't keep firing
          // on detached nodes after we wipe the slide's innerHTML.
          const oldTw = el.querySelector('.tw-text[data-tw]');
          if (oldTw && oldTw.__twTimer) { clearTimeout(oldTw.__twTimer); oldTw.__twTimer = null; }
          el.className = 'ww-slide';
          el.innerHTML = '';
        }
      });

      if (advanceTimer) clearTimeout(advanceTimer);
      scheduleAdvance(slides[i].hold_ms || SLIDE_DURATION_MS);
    }

    function scheduleAdvance(ms){
      if (advanceTimer) clearTimeout(advanceTimer);
      advanceTimer = setTimeout(() => advance(1), ms);
    }

    function advance(dir){
      show(idx + dir);
    }

    function cleanup(){
      if (advanceTimer) clearTimeout(advanceTimer);
      clearTimeout(pauseTimer);
    }

    show(0);
  }

  function animateCount(el, target){
    const duration = 1000;
    const start = performance.now();
    const startVal = 0;
    function frame(now){
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = Math.round(startVal + (target - startVal) * eased);
      el.textContent = val;
      if (t < 1) requestAnimationFrame(frame);
      else el.textContent = target;
    }
    requestAnimationFrame(frame);
  }

  // ============================================================
  //  Public API
  // ============================================================

  window.weeklyWrapped = {
    open,
    openPromo,
    openReel,
    buildData,
    getCurrentISOWeek,
    hasSeen,
    markSeen,
    // Expose theme list so the admin UI can build a dropdown if wanted later
    themes: THEMES.map(t => ({ id: t.id, name: t.name })),
    // Expose reel list so the admin dashboard can render a picker
    reels: Object.keys(REELS).map(id => ({ id, name: REELS[id].name, emoji: REELS[id].emoji, theme: REELS[id].theme })),
  };
})();
