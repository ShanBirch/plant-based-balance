/**
 * Weekly Wrapped
 *
 * Spotify Wrapped-style Sunday afternoon recap. Gathers 7-day + 4-week trends
 * across workouts/mood/PBs/weight/social/XP/coins, computes trend-line
 * predictions, renders a 10-slide animated takeover with anime-style impact
 * frames, speed lines, halftone overlays, and number count-ups.
 *
 * Triggered by:
 *   - Sunday 17:00 AEST push (weekly-wrapped-push.js scheduled fn)
 *   - Auto-open on first login Sun-Wed if unseen for this ISO week
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
  // This is the fix for "opened Monday morning, said 0 workouts" — the
  // wrapped needs to show last week's numbers regardless of which day
  // in the auto-open window (Sun 12:00 → Wed) the user actually opens.
  function getWrappedWeekStart(date){
    const d = new Date(date || Date.now());
    d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0 Sun … 6 Sat
    if (day === 0) {
      // Sunday — this week's Monday is 6 days ago
      d.setDate(d.getDate() - 6);
    } else {
      // Mon–Sat — previous week's Monday
      d.setDate(d.getDate() - (day - 1) - 7);
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

  function formatDate(d){
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + dd;
  }

  function round1(n){ return Math.round(n * 10) / 10; }

  // ============================================================
  //  Data gathering — 4 weeks of source rows in one Promise.all
  // ============================================================

  async function buildData(userId){
    const supabase = window.supabaseClient;
    if (!supabase) throw new Error('Supabase client not ready');

    const now = new Date();
    // IMPORTANT: thisWeekStart is the Monday of the week being REVIEWED,
    // not the Monday of the literal calendar week. On a Mon–Sat open it
    // points to last week's Monday so the wrapped reports on a completed
    // Mon–Sun range instead of an empty half-week.
    const thisWeekStart = getWrappedWeekStart(now);
    const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * DAY_MS);
    const fourWeeksAgo = new Date(thisWeekStart.getTime() - 28 * DAY_MS);

    const sinceThis = thisWeekStart.toISOString();
    const sinceFour = fourWeeksAgo.toISOString();
    const sinceThisDate = formatDate(thisWeekStart);
    const sinceFourDate = formatDate(fourWeeksAgo);

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
        .eq('user_id', userId).gte('achieved_at', sinceThis)
        .order('achieved_at', { ascending: false }),
      supabase.from('daily_weigh_ins')
        .select('weight, created_at')
        .eq('user_id', userId).gte('created_at', sinceFour)
        .order('created_at', { ascending: true }),
      supabase.from('stories')
        .select('id, created_at, media_type')
        .eq('user_id', userId).gte('created_at', sinceThis),
      supabase.from('activity_logs')
        .select('duration_minutes, estimated_calories, activity_date, activity_type')
        .eq('user_id', userId).gte('activity_date', sinceFourDate),
      supabase.from('quiz_battles')
        .select('id, challenger_id, opponent_id, winner_id, status, created_at')
        .or('challenger_id.eq.' + userId + ',opponent_id.eq.' + userId)
        .gte('created_at', sinceThis),
      supabase.from('lesson_completions')
        .select('xp_earned, completed_at')
        .eq('user_id', userId).gte('completed_at', sinceThis),
      supabase.from('coin_transactions')
        .select('amount, created_at')
        .eq('user_id', userId).gt('amount', 0).gte('created_at', sinceThis),
      supabase.from('meal_logs')
        .select('meal_date, calories, created_at')
        .eq('user_id', userId).gte('meal_date', sinceThisDate),
    ]);

    const [
      workoutsR, moodR, pbsR, weighsR, storiesR,
      activityR, battlesR, lessonsR, coinsR, mealsR,
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
    const coins = pick(coinsR);
    const meals = pick(mealsR);

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
      return t >= thisWeekStart.getTime() && t < thisWeekStart.getTime() + 7 * DAY_MS;
    };
    const inLastWeek = r => {
      const t = new Date(r.created_at || r.logged_at || r.achieved_at || r.completed_at || r.activity_date).getTime();
      return t >= lastWeekStart.getTime() && t < thisWeekStart.getTime();
    };

    const workoutsThis = workouts.filter(inThisWeek);
    const workoutsLast = workouts.filter(inLastWeek);
    const workoutDatesThis = [...new Set(workoutsThis.map(w => w.workout_date))];
    const workoutDatesLast = [...new Set(workoutsLast.map(w => w.workout_date))];

    // Minutes — activities have explicit duration; workouts estimate 45min each
    const activityThis = activity.filter(a => {
      const d = a.activity_date || '';
      return d >= formatDate(thisWeekStart) && d < formatDate(new Date(thisWeekStart.getTime() + 7 * DAY_MS));
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
    const caloriesAvg = meals.length
      ? Math.round(meals.reduce((s, m) => s + (m.calories || 0), 0) / Math.max(1, new Set(meals.map(m => m.meal_date)).size))
      : null;

    // Streak (consecutive days ending today or yesterday)
    const allWorkoutDates = [...new Set(workouts.map(w => w.workout_date))].filter(Boolean);
    const streak = computeStreak(allWorkoutDates);

    // Quiz battles
    const battlesComplete = battles.filter(b => b.status === 'complete' || b.status === 'completed');
    const battlesWon = battlesComplete.filter(b => b.winner_id === userId).length;

    // XP + coins
    const xp = lessons.reduce((s, l) => s + (l.xp_earned || 0), 0);
    const coinsEarned = coins.reduce((s, c) => s + (c.amount || 0), 0);

    // ---- Trend-line predictions (last 4 weeks) ----
    const workoutsByWeek = binByWeek(workouts, thisWeekStart, 4, 'created_at')
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
      iso_week: getISOWeek(thisWeekStart),
      generated_at: new Date().toISOString(),
      week_start: thisWeekStart.toISOString(),
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
      nutrition: { meals_logged: mealsCount, avg_calories: caloriesAvg },
      social: { posts: stories.length, reactions_received: reactionsCount },
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
  // across the Sun 12:00 → Wed open window.
  function getCurrentISOWeek(){ return getISOWeek(getWrappedWeekStart(new Date())); }

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
      try { window.pushNavigationState('weekly-wrapped', closeOverlay); } catch(_){}
    }

    // Build data (or reuse pre-built snapshot if passed)
    let data = opts.data;
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
      upsertSnapshot(userId, data);
    }

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
      const wLatest = d.weight.latest != null ? `${d.weight.latest}kg` : '—';
      const wDeltaTxt = d.weight.change != null
        ? (d.weight.change > 0 ? `+${d.weight.change}kg this week` : `${d.weight.change}kg this week`)
        : 'keep logging to see your trend';
      const mealLine = d.nutrition.meals_logged > 0
        ? `${d.nutrition.meals_logged} meal${d.nutrition.meals_logged === 1 ? '' : 's'} logged${d.nutrition.avg_calories ? ` · avg ${d.nutrition.avg_calories} kcal/day` : ''}`
        : '';
      slides.push({
        bg: 'ww-bg-weight',
        html: `
          <div class="ww-halftone"></div>
          <div class="ww-kicker">Body & fuel</div>
          <div class="ww-big-num" style="font-size: clamp(4.5rem, 18vw, 10rem);">${escapeHtml(wLatest)}</div>
          <div class="ww-caption">${escapeHtml(wDeltaTxt)}</div>
          ${mealLine ? `<div class="ww-caption" style="margin-top:6px; opacity:0.8;">${escapeHtml(mealLine)}</div>` : ''}
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
  //  EDUCATIONAL — "Ask ChatGPT" series
  //  Same screen-record workflow as the promo reels, but reframed as
  //  a faux chat with ChatGPT. Indigo/cyan palette signals learn-mode
  //  instead of promo. Bubbles animate in with the user on the right
  //  (cyan) and ChatGPT on the left (grey), with labels + avatars so
  //  the viewer never has to guess who's talking.
  // ────────────────────────────────────────────────────────────

  /** Build a chat-bubble slide. Pass an array of {who: 'user'|'gpt', text}. */
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
    return [
      // 1. Opening prompt
      askSlide([
        { who: 'user', text: 'Hey ChatGPT…<br>what is motivation?' },
        { who: 'gpt',  text: 'Good question. Let me show you.' },
      ], 4200, 'Episode 1'),

      // 2. Three very different Sundays
      askSlide([
        { who: 'user', text: 'Why does one man spend Sunday fixing his car?' },
        { who: 'user', text: 'Why does another sit in a church pew?' },
        { who: 'user', text: 'Why does another feed his paycheck into the pokies?' },
      ], 6000, 'The question'),

      // 3. The setup
      askSlide([
        { who: 'gpt', text: 'Same brain. Different behaviour.' },
        { who: 'gpt', text: 'Here\'s why.' },
      ], 3800),

      // 4. One job
      askSlide([
        { who: 'gpt', text: 'Every human brain has <strong>one job</strong>: keep you alive.' },
      ], 3800),

      // 5. Watches + learns
      askSlide([
        { who: 'gpt', text: 'But it doesn\'t know what "alive" looks like for <em>you</em>.' },
        { who: 'gpt', text: 'So it watches. And it learns.' },
      ], 4500),

      // 6. The HOW — the mechanism
      askSlide([
        { who: 'gpt', text: 'Here\'s how it works:<ol><li>You do something.</li><li>Something happens next — a reward, a feeling, relief.</li><li>Your brain files it: <em>"do this → get that."</em></li><li>Next time, it <strong>nudges you</strong> toward what paid off before.</li></ol>' },
      ], 8500, 'How the brain learns'),

      // 7. The nudge IS motivation
      askSlide([
        { who: 'gpt', text: 'That nudge…<br>is <strong>motivation</strong>.' },
      ], 3800),

      // 8. Three guys → three learned loops
      askSlide([
        { who: 'gpt', text: 'Car guy learned →<br><em>fix the thing → feel competent → safe.</em>' },
        { who: 'gpt', text: 'Churchgoer learned →<br><em>show up → belong → safe.</em>' },
        { who: 'gpt', text: 'Pokies player learned →<br><em>near-win → dopamine → safe.</em>' },
      ], 7000, 'Same code, different inputs'),

      // 9. Same code, different environments
      askSlide([
        { who: 'gpt', text: 'Three different men. Three different Sundays.' },
        { who: 'gpt', text: '<strong>Same survival code. Different environments.</strong>' },
      ], 5000),

      // 10. Shan follow-up
      askSlide([
        { who: 'user', text: 'So motivation isn\'t willpower?' },
        { who: 'gpt',  text: 'No. It\'s your brain predicting what <strong>worked last time</strong>.' },
      ], 5200),

      // 11. The environment lever
      askSlide([
        { who: 'gpt', text: 'Change your <strong>environment</strong> →' },
        { who: 'gpt', text: 'change the <strong>prediction</strong> →' },
        { who: 'gpt', text: 'change what you do.' },
      ], 5500, 'The lever'),

      // 12. Soft Balance outro — educational tag, no app-store pills
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
    return [
      // 1. Opening prompt
      askSlide([
        { who: 'user', text: 'Hey ChatGPT…<br>what\'s Pavlovian conditioning?' },
        { who: 'gpt',  text: 'Oldest trick in the brain.<br>Let me show you three versions of it.' },
      ], 4500, 'Episode 2'),

      // 2. The classic — Pavlov's dog
      askSlide([
        { who: 'gpt', text: 'Pavlov had a dog. And a bell.' },
        { who: 'gpt', text: 'Every time he rang the bell…<br>he served the dog steak.' },
      ], 5000, 'The classic'),

      // 3. The loop visual
      askSlide([
        { who: 'gpt', text: '<span style="font-size:1.6rem; letter-spacing:4px;">🔔 → 🥩 → 🤤</span>' },
        { who: 'gpt', text: 'Do it enough times, and…' },
        { who: 'gpt', text: '<span style="font-size:1.6rem; letter-spacing:4px;">🔔 → 🤤</span><br><em>(no steak needed.)</em>' },
      ], 5500),

      // 4. The rule
      askSlide([
        { who: 'gpt', text: 'The brain doesn\'t just learn <em>"do this → get that."</em>' },
        { who: 'gpt', text: 'It learns:<br><strong>"when THIS happens, THAT is coming."</strong>' },
        { who: 'gpt', text: 'Then it fires the reward response <strong>before</strong> the reward even arrives.' },
      ], 7000, 'The rule'),

      // 5. Version 1 — the dog
      askSlide([
        { who: 'user', text: 'Okay, so that\'s how we teach a dog to sit?' },
        { who: 'gpt',  text: 'Exactly.<br>Say <em>"sit"</em> → push the bum down → treat.' },
        { who: 'gpt',  text: 'Pretty soon the word <strong>"sit"</strong> alone triggers it.<br>The dog\'s brain learned: <em>"sit" = treat is coming.</em>' },
      ], 7000, 'Version 1 — the dog'),

      // 6. Version 2 — casino setup
      askSlide([
        { who: 'user', text: 'What\'s the scary version?' },
        { who: 'gpt',  text: 'Casinos.<br>They\'ve studied this for a hundred years.' },
      ], 4500, 'Version 2 — the casino'),

      // 7. Casino loop
      askSlide([
        { who: 'gpt', text: '<span style="font-size:1.3rem;">🎰 lights → 🔔 jingle → 🪙 coins clatter → <strong>occasional win.</strong></span>' },
        { who: 'gpt', text: 'Do it enough times, and…' },
        { who: 'gpt', text: 'The <strong>lights and sounds alone</strong> give you a dopamine hit.' },
        { who: 'gpt', text: 'You\'re not chasing the money.<br>You\'re chasing <strong>the bell.</strong>' },
      ], 8000),

      // 8. Near-misses — the evil bit
      askSlide([
        { who: 'gpt', text: 'Here\'s the evil bit.' },
        { who: 'gpt', text: 'Even a <strong>near-miss</strong> — two cherries and a lemon — lights up the same brain region as a win.' },
        { who: 'gpt', text: 'Your brain says: <em>"almost! keep going!"</em>' },
        { who: 'gpt', text: 'That\'s not luck. That\'s <strong>engineering</strong>.' },
      ], 7500, 'The near-miss trap'),

      // 9. Version 3 — YOU
      askSlide([
        { who: 'user', text: 'So… is this happening to me too?' },
        { who: 'gpt',  text: 'Every day.<br>You just never called it that.' },
      ], 4500, 'Version 3 — you'),

      // 10. Your bells
      askSlide([
        { who: 'gpt', text: '📱 Phone buzz → dopamine.<br><em>Before you\'ve even read the message.</em>' },
        { who: 'gpt', text: '🧊 Fridge door at 9pm → craving.<br><em>Before you\'re even hungry.</em>' },
        { who: 'gpt', text: '🏋️ Gym car park → dread, or pride.<br><em>Depending on which one your brain paired it with.</em>' },
      ], 8000, 'Your bells'),

      // 11. The realisation
      askSlide([
        { who: 'gpt', text: 'Your life is full of <strong>bells</strong>.' },
        { who: 'gpt', text: 'Every one of them is either training you…<br>or being trained <em>by</em> you.' },
      ], 5500),

      // 12. The fix — break the pair
      askSlide([
        { who: 'user', text: 'So how do I un-train the bad ones?' },
        { who: 'gpt',  text: '<strong>Break the pair.</strong>' },
        { who: 'gpt',  text: '🔔 Ring the bell → <em>don\'t serve the steak.</em>' },
        { who: 'gpt',  text: '📱 Phone buzzes → leave it face-down.<br>🧊 Fridge opens at 9pm → water, not biscuits.' },
        { who: 'gpt',  text: 'Do it enough times, and the bell <strong>stops meaning anything.</strong>' },
      ], 9000, 'The fix'),

      // 13. Outro
      askOutroSlide(),
    ];
  }

  // ────────────────────────────────────────────────────────────
  //  Reel registry
  // ────────────────────────────────────────────────────────────

  const REELS = {
    'full':      { name: 'Full App Promo',    emoji: '🎬', theme: 'synthwave', build: () => buildPromoSlides(), needsFitgotchi: true },
    'calorie':   { name: 'Calorie Tracker',   emoji: '📸', theme: 'lofi',      build: buildCalorieReel,   needsFitgotchi: false },
    'fitgotchi': { name: 'FitGotchi + Battles', emoji: '⚔️', theme: 'phonk',   build: buildFitgotchiReel, needsFitgotchi: true },
    'learning':  { name: 'Learning',          emoji: '🎓', theme: 'jazz',      build: buildLearningReel,  needsFitgotchi: false },
    'feed':      { name: 'The Feed',          emoji: '💬', theme: 'synthwave', build: buildFeedReel,      needsFitgotchi: false },
    'cycle':     { name: 'Cycle Sync',        emoji: '🌸', theme: 'lofi',      build: buildCycleReel,     needsFitgotchi: false },
    'battles':   { name: 'Quiz Battles',      emoji: '⚡', theme: 'techno',    build: buildBattlesReel,   needsFitgotchi: false },
    // Educational "Ask ChatGPT" series — different palette (indigo/cyan),
    // chat-bubble layout, soft-sell outro. Screen-record from admin exactly
    // the same way as the promo reels.
    'ask-motivation':   { name: 'Ask: What is motivation?',       emoji: '🧠', theme: 'lofi', build: buildAskMotivationReel,   needsFitgotchi: false },
    'ask-conditioning': { name: 'Ask: What is Pavlovian conditioning?', emoji: '🔔', theme: 'lofi', build: buildAskConditioningReel, needsFitgotchi: false },
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
    const preloadLabel = reel.needsFitgotchi ? 'Pre-loading FitGotchi model…' : 'Warming up…';
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
      try { window.pushNavigationState('weekly-wrapped', closeOverlay); } catch(_){}
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

    const slides = reel.build();
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
