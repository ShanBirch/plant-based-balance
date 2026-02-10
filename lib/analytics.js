// lib/analytics.js - Centralized User Behavior Analytics
// Tracks feature usage, session timing, and engagement metrics
// Logs to Supabase user_activity table via db.activity.log()

(function() {
  'use strict';

  // Prevent double-init
  if (window._analyticsInitialized) return;
  window._analyticsInitialized = true;

  // --- Session Tracking ---
  const SESSION_KEY = 'analytics_session';
  const sessionId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  const sessionStart = Date.now();

  // --- Feature Timer ---
  // Tracks how long a user spends in each feature/view
  let currentFeature = null;
  let featureStartTime = null;
  const featureTimers = {}; // { featureName: totalMs }

  function startFeatureTimer(feature) {
    stopFeatureTimer(); // stop previous
    currentFeature = feature;
    featureStartTime = Date.now();
  }

  function stopFeatureTimer() {
    if (currentFeature && featureStartTime) {
      const elapsed = Date.now() - featureStartTime;
      featureTimers[currentFeature] = (featureTimers[currentFeature] || 0) + elapsed;

      // Log feature view with duration if they spent more than 2 seconds
      if (elapsed > 2000) {
        trackEvent('feature_time', {
          feature: currentFeature,
          duration_seconds: Math.round(elapsed / 1000)
        });
      }
    }
    currentFeature = null;
    featureStartTime = null;
  }

  // --- Core Event Tracking ---
  const eventQueue = [];
  let flushTimer = null;
  const FLUSH_INTERVAL = 10000; // Batch events every 10 seconds
  const MAX_QUEUE = 20;

  function trackEvent(eventType, eventData = {}) {
    const event = {
      event_type: eventType,
      event_data: {
        ...eventData,
        session_id: sessionId,
        timestamp: new Date().toISOString(),
        page: window.location.pathname
      }
    };

    eventQueue.push(event);

    // Flush immediately if queue is full
    if (eventQueue.length >= MAX_QUEUE) {
      flushEvents();
    } else if (!flushTimer) {
      flushTimer = setTimeout(flushEvents, FLUSH_INTERVAL);
    }

    // Also send to GA4 if available
    if (typeof gtag === 'function') {
      gtag('event', eventType, eventData);
    }
  }

  async function flushEvents() {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }

    if (eventQueue.length === 0) return;

    const events = eventQueue.splice(0, eventQueue.length);

    try {
      // Get current user
      const userId = await getCurrentUserId();
      if (!userId) return; // Don't track anonymous users

      // Batch insert via db.activity.log for each event
      // Using a single edge function call for efficiency
      for (const event of events) {
        try {
          if (typeof db !== 'undefined' && db.activity && db.activity.log) {
            await db.activity.log(userId, event.event_type, event.event_data);
          }
        } catch (e) {
          // Silently fail - analytics should never break the app
          console.debug('Analytics log error:', e.message);
        }
      }
    } catch (e) {
      console.debug('Analytics flush error:', e.message);
    }
  }

  async function getCurrentUserId() {
    try {
      if (typeof window.supabaseClient !== 'undefined') {
        const { data } = await window.supabaseClient.auth.getSession();
        return data?.session?.user?.id || null;
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  // --- Session Events ---
  // Track session start
  function trackSessionStart() {
    const returning = localStorage.getItem('analytics_last_visit');
    const daysSinceLast = returning
      ? Math.round((Date.now() - parseInt(returning)) / 86400000)
      : null;

    trackEvent('session_start', {
      returning: !!returning,
      days_since_last: daysSinceLast,
      referrer: document.referrer || 'direct',
      screen_width: window.innerWidth,
      screen_height: window.innerHeight
    });

    localStorage.setItem('analytics_last_visit', Date.now().toString());
  }

  // Track session end (before page unload)
  function trackSessionEnd() {
    stopFeatureTimer();

    const sessionDuration = Math.round((Date.now() - sessionStart) / 1000);

    // Use sendBeacon for reliability on page unload
    const payload = {
      event_type: 'session_end',
      event_data: {
        session_id: sessionId,
        duration_seconds: sessionDuration,
        feature_times: featureTimers,
        timestamp: new Date().toISOString()
      }
    };

    // Try sendBeacon first (works during page unload)
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        '/.netlify/functions/track-analytics',
        JSON.stringify(payload)
      );
    }

    // Also flush remaining events synchronously
    flushEvents();
  }

  // --- Specific Event Trackers ---

  const analytics = {
    // Tab/view navigation
    trackTabSwitch(tabName) {
      startFeatureTimer(tabName);
      trackEvent('tab_view', { tab: tabName });
    },

    // Workout events
    trackWorkoutStart(workoutType, source) {
      trackEvent('workout_start', { workout_type: workoutType, source: source });
    },
    trackWorkoutComplete(duration, exerciseCount, setCount, source) {
      trackEvent('workout_complete', {
        duration_seconds: duration,
        exercise_count: exerciseCount,
        set_count: setCount,
        source: source
      });
    },
    trackWorkoutAbandoned(duration, exerciseCount) {
      trackEvent('workout_abandoned', {
        duration_seconds: duration,
        exercise_count: exerciseCount
      });
    },

    // Check-in events
    trackCheckIn(fields) {
      trackEvent('daily_checkin', {
        fields_completed: fields,
        day_of_week: new Date().toLocaleDateString('en-US', { weekday: 'long' })
      });
    },

    // Meal tracking
    trackMealLogged(method, itemCount) {
      trackEvent('meal_logged', { method: method, item_count: itemCount });
    },
    trackMealPhotoUploaded() {
      trackEvent('meal_photo_uploaded', {});
    },
    trackMealPlanViewed(planName) {
      trackEvent('meal_plan_viewed', { plan: planName });
    },

    // AI Chat
    trackChatMessage(messageLength) {
      trackEvent('chat_message_sent', { message_length: messageLength });
    },
    trackChatSessionStart() {
      trackEvent('chat_session_start', {});
    },

    // Pet/FitGotchi
    trackPetViewed() {
      trackEvent('pet_viewed', {});
    },
    trackPetEvolved(fromStage, toStage) {
      trackEvent('pet_evolved', { from_stage: fromStage, to_stage: toStage });
    },

    // Challenges
    trackChallengeJoined(challengeType, entryFee) {
      trackEvent('challenge_joined', { type: challengeType, entry_fee: entryFee });
    },
    trackChallengeActivity(challengeId, activityType) {
      trackEvent('challenge_activity', { challenge_id: challengeId, activity: activityType });
    },

    // Content engagement
    trackBlogRead(articleSlug, scrollDepth) {
      trackEvent('blog_read', { article: articleSlug, scroll_depth: scrollDepth });
    },
    trackLearningModuleStarted(moduleId) {
      trackEvent('learning_started', { module: moduleId });
    },
    trackLearningModuleCompleted(moduleId) {
      trackEvent('learning_completed', { module: moduleId });
    },

    // Calculator usage
    trackCalculatorUsed(calculatorType) {
      trackEvent('calculator_used', { type: calculatorType });
    },

    // Social features
    trackReferralShared(method) {
      trackEvent('referral_shared', { method: method });
    },
    trackFriendAdded() {
      trackEvent('friend_added', {});
    },
    trackGroupChatOpened() {
      trackEvent('group_chat_opened', {});
    },

    // Cycle tracking
    trackCycleLogged(fields) {
      trackEvent('cycle_logged', { fields: fields });
    },

    // Weigh-in
    trackWeighIn() {
      trackEvent('weigh_in_logged', {});
    },

    // Points & gamification
    trackPointsEarned(points, source) {
      trackEvent('points_earned', { points: points, source: source });
    },
    trackLevelUp(newLevel) {
      trackEvent('level_up', { new_level: newLevel });
    },

    // Onboarding
    trackOnboardingStep(step, totalSteps) {
      trackEvent('onboarding_step', { step: step, total: totalSteps });
    },
    trackOnboardingComplete() {
      trackEvent('onboarding_complete', {});
    },

    // Shop / purchases
    trackShopViewed() {
      trackEvent('shop_viewed', {});
    },
    trackCoinPurchase(packSize, amount) {
      trackEvent('coin_purchase', { pack_size: packSize, amount: amount });
    },

    // Exercise video
    trackVideoPlayed(exerciseName) {
      trackEvent('exercise_video_played', { exercise: exerciseName });
    },

    // Generic custom event
    track(eventType, data) {
      trackEvent(eventType, data);
    },

    // Force flush (call before important navigation)
    flush() {
      return flushEvents();
    }
  };

  // --- Lifecycle Hooks ---
  window.addEventListener('load', () => {
    // Delay session start tracking to not block page load
    setTimeout(trackSessionStart, 1000);
  });

  window.addEventListener('beforeunload', trackSessionEnd);

  // Handle visibility changes (user switches away from tab)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopFeatureTimer();
      flushEvents();
    } else {
      // Resumed - restart feature timer if we know the current view
      if (currentFeature) {
        featureStartTime = Date.now();
      }
    }
  });

  // Expose globally
  window.FitGotchiAnalytics = analytics;
})();
