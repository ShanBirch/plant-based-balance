// Supabase Client Configuration
// This file provides the Supabase client for browser use
// VERSION: v3 - Force fresh load (2024-01)

// GUARD: Prevent double execution (fixes SW caching issue)
// But always ensure exports are available
if (window._supabaseInitializedV3 && window.db) {
  console.log('Supabase already initialized, skipping...');
} else {
window._supabaseInitializedV3 = true;

// Import Supabase from CDN (add this to your HTML files)
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

/**
 * Initialize Supabase client
 * IMPORTANT: Replace these with your actual Supabase project credentials
 * Get them from: https://app.supabase.com/project/_/settings/api
 */
const SUPABASE_URL = 'https://hzapaorxqboevxnumxkv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6YXBhb3J4cWJvZXZ4bnVteGt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NjA3MTYsImV4cCI6MjA4NDIzNjcxNn0.L8ZuxevbB1pNx2nXtIiiQ-6dZSeqfdGuiEvscljOxq0';

// Create Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabaseClient = supabase;

/**
 * Authentication helpers
 */
const auth = {
  /**
   * Sign up new user
   */
  async signUp(email, password, userData = {}) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData, // Additional user metadata
        emailRedirectTo: `${window.location.origin}/login.html`
      }
    });

    if (error) throw error;

    // User creation in public.users is now handled by a database trigger
    return data;
  },

  /**
   * Sign in existing user
   */
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    // Update last login
    if (data.user) {
      await db.users.updateLastLogin(data.user.id);
    }

    return data;
  },

  /**
   * Sign out current user
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * Get current user session
   */
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  /**
   * Get current user
   */
  async getUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  },

  /**
   * Listen for auth state changes
   */
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  },

  /**
   * Reset password
   */
  async resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password.html`
    });
    if (error) throw error;
  },

  /**
   * Update password
   */
  async updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    if (error) throw error;
  }
};

/**
 * Database operation helpers
 */
const db = {
  /**
   * Users table operations
   */
  users: {
    async create(userData) {
      const { data, error } = await supabase
        .from('users')
        .insert([userData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async get(userId) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data;
    },

    async update(userId, updates) {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async updateLastLogin(userId) {
      return await this.update(userId, { last_login: new Date().toISOString() });
    },

    async upsert(userId, userData) {
      const { data, error } = await supabase
        .from('users')
        .upsert({
          id: userId,
          ...userData
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async getAll() {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    }
  },

  /**
   * User facts table operations
   */
  userFacts: {
    async get(userId) {
      const { data, error } = await supabase
        .from('user_facts')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data;
    },

    async upsert(userId, facts) {
      const { data, error } = await supabase
        .from('user_facts')
        .upsert({
          user_id: userId,
          ...facts
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  /**
   * Conversations table operations
   */
  conversations: {
    async create(userId, chatType, role, messageText, authorName = null) {
      const timestamp = Date.now();
      const brisbaneTime = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' });

      const { data, error } = await supabase
        .from('conversations')
        .insert([{
          user_id: userId,
          chat_type: chatType,
          role: role,
          message_text: messageText,
          author_name: authorName,
          timestamp: timestamp,
          brisbane_time: brisbaneTime
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async getHistory(userId, chatType, limit = 100) {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .eq('chat_type', chatType)
        .order('timestamp', { ascending: false }) // Get newest first
        .limit(limit);

      if (error) throw error;
      return data.reverse(); // Return in chronological order (oldest to newest)
    },

    async bulkCreate(userId, messages) {
      const { data, error } = await supabase
        .from('conversations')
        .insert(messages.map(msg => ({
          user_id: userId,
          ...msg
        })))
        .select();

      if (error) throw error;
      return data;
    }
  },

  /**
   * Pending Coach Responses table operations
   */
  pendingResponses: {
    async create(userId, messageText, userMessageText = null, contextSnapshot = null) {
      const timestamp = Date.now();
      const brisbaneTime = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' });

      const { data, error } = await supabase
        .from('pending_coach_responses')
        .insert([{
          user_id: userId,
          message_text: messageText,
          original_message_text: messageText,
          chat_type: 'shannon',
          status: 'pending',
          user_message_text: userMessageText,
          context_snapshot: contextSnapshot,
          timestamp: timestamp,
          brisbane_time: brisbaneTime
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async getPending(limit = 50) {
      const { data, error } = await supabase
        .from('pending_coach_responses')
        .select('*, users!user_id(name, email)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    },

    async getById(id) {
      const { data, error } = await supabase
        .from('pending_coach_responses')
        .select('*, users!user_id(name, email)')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },

    async approve(id, approvedBy, editedMessage = null) {
      const updateData = {
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString()
      };

      // If message was edited, update message_text
      if (editedMessage !== null) {
        updateData.message_text = editedMessage;
      }

      const { data, error } = await supabase
        .from('pending_coach_responses')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async reject(id, rejectionReason) {
      const { data, error } = await supabase
        .from('pending_coach_responses')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async getPendingCount() {
      const { count, error } = await supabase
        .from('pending_coach_responses')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) throw error;
      return count || 0;
    }
  },

  /**
   * Push Subscriptions for admin notifications
   */
  pushSubscriptions: {
    async subscribe(subscription, isAdmin = false) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          is_admin: isAdmin
        }, { onConflict: 'endpoint' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async unsubscribe(endpoint) {
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', endpoint);

      if (error) throw error;
      return true;
    },

    async getMySubscription() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },

    async isAdmin() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) return false;
      return !!data;
    }
  },

  /**
   * Workouts table operations
   */
  workouts: {
    async createHistory(userId, workoutData) {
      const { data, error } = await supabase
        .from('workouts')
        .insert([{
          user_id: userId,
          workout_type: 'history',
          workout_date: workoutData.date,
          exercise_name: workoutData.exercise,
          set_number: workoutData.set,
          time_duration: workoutData.time,
          reps: workoutData.reps,
          weight_kg: workoutData.kg
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async getHistory(userId, limit = 100) {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', userId)
        .eq('workout_type', 'history')
        .order('workout_date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    },

    async saveCustomWorkout(userId, templateName, templateData) {
      const { data, error } = await supabase
        .from('workouts')
        .insert([{
          user_id: userId,
          workout_type: 'custom_template',
          template_name: templateName,
          template_data: templateData
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async getCustomWorkouts(userId) {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', userId)
        .eq('workout_type', 'custom_template');

      if (error) throw error;
      return data;
    },

    async setCurrentWorkout(userId, workoutData) {
      // Clear any existing current workout
      await supabase
        .from('workouts')
        .update({ is_current_workout: false })
        .eq('user_id', userId);

      // Set new current workout
      const { data, error } = await supabase
        .from('workouts')
        .insert([{
          user_id: userId,
          workout_type: 'custom_template',
          template_data: workoutData,
          is_current_workout: true
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async getCurrentWorkout(userId) {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_current_workout', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // Ignore "not found" error
      return data;
    },

    /**
     * Get workout count for user (distinct workout dates)
     */
    async getWorkoutCount(userId) {
      const { data, error } = await supabase
        .from('workouts')
        .select('workout_date')
        .eq('user_id', userId)
        .eq('workout_type', 'history')
        .not('workout_date', 'is', null);

      if (error) throw error;

      // Count unique workout dates
      const uniqueDates = new Set(data.map(w => w.workout_date));
      return uniqueDates.size;
    },

    /**
     * Get exercise progress over time (for graphs)
     * Returns history of a specific exercise with best set per workout
     */
    async getExerciseProgress(userId, exerciseName, limit = 10) {
      const { data, error } = await supabase
        .from('workouts')
        .select('workout_date, exercise_name, reps, weight_kg, set_number')
        .eq('user_id', userId)
        .eq('workout_type', 'history')
        .eq('exercise_name', exerciseName)
        .order('workout_date', { ascending: false })
        .limit(limit * 10); // Get extra to filter best sets

      if (error) throw error;

      // Group by workout_date and get best set (highest weight or reps)
      const bestSets = {};
      data.forEach(row => {
        const date = row.workout_date;
        if (!bestSets[date]) {
          bestSets[date] = row;
        } else {
          // Compare weight first, then reps
          const currentWeight = parseFloat(bestSets[date].weight_kg) || 0;
          const rowWeight = parseFloat(row.weight_kg) || 0;
          const currentReps = parseInt(bestSets[date].reps) || 0;
          const rowReps = parseInt(row.reps) || 0;

          if (rowWeight > currentWeight || (rowWeight === currentWeight && rowReps > currentReps)) {
            bestSets[date] = row;
          }
        }
      });

      // Convert to array and sort by date
      return Object.values(bestSets)
        .sort((a, b) => new Date(a.workout_date) - new Date(b.workout_date))
        .slice(-limit);
    },

    /**
     * Get all exercises from user's most recent workout
     */
    async getRecentExercises(userId, limit = 20) {
      const { data, error } = await supabase
        .from('workouts')
        .select('exercise_name')
        .eq('user_id', userId)
        .eq('workout_type', 'history')
        .order('workout_date', { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Return unique exercise names
      const uniqueExercises = [...new Set(data.map(w => w.exercise_name))];
      return uniqueExercises;
    },

    /**
     * Compare current workout to previous workout for same exercise
     * Returns improvements (increased weight/reps)
     */
    async getWorkoutImprovements(userId, currentWorkoutData) {
      const improvements = [];

      // Get unique exercises from current workout
      const exercises = [...new Set(currentWorkoutData.map(w => w.exercise))];

      for (const exercise of exercises) {
        // Get current workout best set for this exercise
        const currentSets = currentWorkoutData.filter(w => w.exercise === exercise);
        const currentBest = currentSets.reduce((best, set) => {
          const bestWeight = parseFloat(best.kg) || 0;
          const setWeight = parseFloat(set.kg) || 0;
          const bestReps = parseInt(best.reps) || 0;
          const setReps = parseInt(set.reps) || 0;

          if (setWeight > bestWeight || (setWeight === bestWeight && setReps > bestReps)) {
            return set;
          }
          return best;
        }, currentSets[0]);

        // Get previous workout history for this exercise (excluding today)
        const { data, error } = await supabase
          .from('workouts')
          .select('workout_date, reps, weight_kg')
          .eq('user_id', userId)
          .eq('workout_type', 'history')
          .eq('exercise_name', exercise)
          .lt('workout_date', currentBest.date)
          .order('workout_date', { ascending: false })
          .limit(10);

        if (error || !data || data.length === 0) continue;

        // Find best from previous workout
        const previousBest = data.reduce((best, set) => {
          if (!best) return set;
          const bestWeight = parseFloat(best.weight_kg) || 0;
          const setWeight = parseFloat(set.weight_kg) || 0;
          const bestReps = parseInt(best.reps) || 0;
          const setReps = parseInt(set.reps) || 0;

          if (setWeight > bestWeight || (setWeight === bestWeight && setReps > bestReps)) {
            return set;
          }
          return best;
        }, null);

        if (!previousBest) continue;

        // Compare and track improvements
        const currentWeight = parseFloat(currentBest.kg) || 0;
        const previousWeight = parseFloat(previousBest.weight_kg) || 0;
        const currentReps = parseInt(currentBest.reps) || 0;
        const previousReps = parseInt(previousBest.reps) || 0;

        if (currentWeight > previousWeight || currentReps > previousReps) {
          improvements.push({
            exercise,
            previousWeight,
            currentWeight,
            previousReps,
            currentReps,
            weightIncrease: currentWeight - previousWeight,
            repsIncrease: currentReps - previousReps
          });
        }
      }

      return improvements;
    }
  },

  /**
   * Workout milestones table operations
   */
  milestones: {
    async create(userId, milestoneData) {
      const { data, error } = await supabase
        .from('workout_milestones')
        .insert([{
          user_id: userId,
          milestone_type: milestoneData.type,
          milestone_value: milestoneData.value,
          exercise_name: milestoneData.exercise || null,
          achievement_data: milestoneData.data || {}
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async getAll(userId, limit = 50) {
      const { data, error } = await supabase
        .from('workout_milestones')
        .select('*')
        .eq('user_id', userId)
        .order('achieved_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    },

    async checkExists(userId, milestoneType, milestoneValue = null) {
      let query = supabase
        .from('workout_milestones')
        .select('id')
        .eq('user_id', userId)
        .eq('milestone_type', milestoneType);

      if (milestoneValue !== null) {
        query = query.eq('milestone_value', milestoneValue);
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;
      return !!data;
    },

    /**
     * Check and record new milestones after workout
     * Returns array of newly achieved milestones
     */
    async checkAndRecordMilestones(userId) {
      const newMilestones = [];

      // Get current workout count
      const workoutCount = await dbHelpers.workouts.getWorkoutCount(userId);

      // Define milestone thresholds
      const countMilestones = [1, 5, 10, 25, 50, 100, 200, 365];

      for (const threshold of countMilestones) {
        if (workoutCount === threshold) {
          const exists = await this.checkExists(userId, 'workout_count', threshold);
          if (!exists) {
            const milestone = await this.create(userId, {
              type: 'workout_count',
              value: threshold,
              data: { total_workouts: workoutCount }
            });
            newMilestones.push({
              ...milestone,
              message: this.getMilestoneMessage(threshold)
            });
          }
        }
      }

      // Check for streak milestones (consecutive days with workouts)
      const recentWorkouts = await dbHelpers.workouts.getHistory(userId, 30);
      const uniqueDates = [...new Set(recentWorkouts.map(w => w.workout_date))].sort();

      let currentStreak = 0;
      let today = new Date().toISOString().split('T')[0];

      for (let i = uniqueDates.length - 1; i >= 0; i--) {
        const date = uniqueDates[i];
        const expectedDate = new Date();
        expectedDate.setDate(expectedDate.getDate() - currentStreak);
        const expectedDateStr = expectedDate.toISOString().split('T')[0];

        if (date === expectedDateStr) {
          currentStreak++;
        } else {
          break;
        }
      }

      // Check streak milestones (7, 14, 30 days)
      const streakMilestones = [7, 14, 30];
      for (const threshold of streakMilestones) {
        if (currentStreak >= threshold) {
          const exists = await this.checkExists(userId, 'workout_streak', threshold);
          if (!exists) {
            const milestone = await this.create(userId, {
              type: 'workout_streak',
              value: threshold,
              data: { streak_days: currentStreak }
            });
            newMilestones.push({
              ...milestone,
              message: `${threshold}-day workout streak!`
            });
          }
        }
      }

      return newMilestones;
    },

    getMilestoneMessage(count) {
      const messages = {
        1: 'Congratulations! You completed your first workout! 🎉',
        5: 'Amazing! 5 workouts complete! 💪',
        10: 'Double digits! 10 workouts done! 🔥',
        25: 'Quarter century! 25 workouts! 🌟',
        50: 'Halfway to 100! 50 workouts! 🏆',
        100: 'CENTURY! 100 workouts complete! 👑',
        200: 'Unstoppable! 200 workouts! 🚀',
        365: 'One full year! 365 workouts! 🎊'
      };
      return messages[count] || `${count} workouts complete! Keep going! 💪`;
    }
  },

  /**
   * Daily check-ins table operations
   */
  checkins: {
    async upsert(userId, date, checkinData) {
      const { data, error } = await supabase
        .from('daily_checkins')
        .upsert({
          user_id: userId,
          checkin_date: date,
          energy: checkinData.energy,
          equipment: checkinData.equipment,
          sleep: checkinData.sleep,
          water_intake: checkinData.water,
          additional_data: checkinData.additional || {}
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async get(userId, date) {
      const { data, error } = await supabase
        .from('daily_checkins')
        .select('*')
        .eq('user_id', userId)
        .eq('checkin_date', date)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },

    async getRecent(userId, limit = 30) {
      const { data, error } = await supabase
        .from('daily_checkins')
        .select('*')
        .eq('user_id', userId)
        .order('checkin_date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    }
  },

  /**
   * Reflections table operations
   */
  reflections: {
    async create(userId, reflectionText, reflectionType = 'standalone', storyKey = null) {
      const { data, error } = await supabase
        .from('reflections')
        .insert([{
          user_id: userId,
          reflection_text: reflectionText,
          reflection_type: reflectionType,
          story_key: storyKey,
          timestamp: Date.now()
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async getAll(userId) {
      const { data, error } = await supabase
        .from('reflections')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      return data;
    }
  },

  /**
   * Quiz results table operations
   */
  quizResults: {
    async create(userId, quizData) {
      const { data, error } = await supabase
        .from('quiz_results')
        .insert([{
          user_id: userId,
          ...quizData
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async getLatest(userId) {
      const { data, error } = await supabase
        .from('quiz_results')
        .select('*')
        .eq('user_id', userId)
        .order('taken_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    }
  },

  /**
   * User activity logging
   */
  activity: {
    async log(userId, activityType, activityData = {}) {
      const { data, error } = await supabase
        .from('user_activity')
        .insert([{
          user_id: userId,
          activity_type: activityType,
          activity_data: activityData
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async getRecent(userId, limit = 50) {
      const { data, error } = await supabase
        .from('user_activity')
        .select('*')
        .eq('user_id', userId)
        .order('occurred_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    }
  },

  /**
   * Admin operations
   */
  admin: {
    async getAllUsers() {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          user_facts(*),
          quiz_results(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },

    async getUserConversations(userId) {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      return data;
    },

    async getAnalytics() {
      // Get user counts
      const { count: totalUsers, error: userCountError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      if (userCountError) throw userCountError;

      // Get active users (logged in last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { count: activeUsers, error: activeCountError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('last_login', sevenDaysAgo.toISOString());

      if (activeCountError) throw activeCountError;

      // Get conversation stats
      const { count: totalMessages, error: messageCountError } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true });

      if (messageCountError) throw messageCountError;

      return {
        totalUsers,
        activeUsers,
        totalMessages,
        inactiveUsers: totalUsers - activeUsers
      };
    }
  },

  /**
   * Referrals table operations
   */
  referrals: {
    /**
     * Create a new referral
     */
    async create(referrerUserId, referredUserId, referralCode) {
      const { data, error } = await supabase
        .from('referrals')
        .insert([{
          referrer_user_id: referrerUserId,
          referred_user_id: referredUserId,
          referral_code_used: referralCode,
          status: 'completed',
          reward_granted: false
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    /**
     * Get user's referrals (people they invited)
     */
    async getUserReferrals(userId) {
      const { data, error } = await supabase
        .from('referrals')
        .select(`
          *,
          referred_user:users!referred_user_id(id, name, email, created_at)
        `)
        .eq('referrer_user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },

    /**
     * Get user by referral code
     */
    async getUserByReferralCode(referralCode) {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, referral_code')
        .eq('referral_code', referralCode)
        .single();

      if (error) throw error;
      return data;
    },

    /**
     * Mark referral reward as granted
     */
    async markRewardGranted(referralId) {
      const { data, error } = await supabase
        .from('referrals')
        .update({
          reward_granted: true,
          reward_granted_at: new Date().toISOString()
        })
        .eq('id', referralId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    /**
     * Get user's referral network (using the database function)
     */
    async getReferralNetwork(userId) {
      const { data, error } = await supabase
        .rpc('get_referral_network', { user_uuid: userId });

      if (error) throw error;
      return data;
    },

    /**
     * Get user's extended referral network (friends + friends of friends)
     */
    async getExtendedNetwork(userId) {
      const { data, error } = await supabase
        .rpc('get_extended_referral_network', { user_uuid: userId });

      if (error) throw error;
      return data;
    },

    /**
     * Get referral stats for a user
     */
    async getStats(userId) {
      const user = await db.users.get(userId);
      const referrals = await this.getUserReferrals(userId);

      return {
        referralCode: user.referral_code,
        totalReferrals: user.referrals_count || 0,
        freeDaysEarned: user.free_days_earned || 0,
        referrals: referrals
      };
    }
  },

  /**
   * Stories table operations
   */
  stories: {
    /**
     * Create a new story
     */
    async create(userId, storyData) {
      const { data, error } = await supabase
        .from('stories')
        .insert([{
          user_id: userId,
          media_type: storyData.media_type || 'image',
          media_url: storyData.media_url,
          thumbnail_url: storyData.thumbnail_url || null,
          caption: storyData.caption || null,
          duration: storyData.duration || 5,
          background_color: storyData.background_color || '#000000'
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    /**
     * Get user's own active stories
     */
    async getUserStories(userId) {
      const { data, error } = await supabase
        .from('stories')
        .select('*')
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },

    /**
     * Get all active stories from user's extended network
     */
    async getNetworkStories(userId) {
      const { data, error } = await supabase
        .rpc('get_network_active_stories', { user_uuid: userId });

      if (error) throw error;
      return data;
    },

    /**
     * Get a single story by ID
     */
    async get(storyId) {
      const { data, error } = await supabase
        .from('stories')
        .select('*')
        .eq('id', storyId)
        .single();

      if (error) throw error;
      return data;
    },

    /**
     * Delete a story
     */
    async delete(storyId) {
      const { data, error } = await supabase
        .from('stories')
        .delete()
        .eq('id', storyId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    /**
     * Mark a story as viewed
     */
    async markAsViewed(storyId, viewerId) {
      const { data, error } = await supabase
        .from('story_views')
        .upsert({
          story_id: storyId,
          viewer_id: viewerId
        }, {
          onConflict: 'story_id,viewer_id'
        })
        .select()
        .single();

      if (error) {
        // Ignore duplicate view errors
        if (error.code === '23505') return null;
        throw error;
      }
      return data;
    },

    /**
     * Get viewers of a story
     */
    async getViewers(storyId) {
      const { data, error } = await supabase
        .from('story_views')
        .select(`
          *,
          viewer:users!viewer_id(id, name, email, profile_photo)
        `)
        .eq('story_id', storyId)
        .order('viewed_at', { ascending: false });

      if (error) throw error;
      return data;
    },

    /**
     * Clean up expired stories
     */
    async cleanupExpired() {
      const { data, error } = await supabase
        .rpc('cleanup_expired_stories');

      if (error) throw error;
      return data; // Returns count of deleted stories
    },

    /**
     * Update story (mainly for caption)
     */
    async update(storyId, updates) {
      const { data, error } = await supabase
        .from('stories')
        .update(updates)
        .eq('id', storyId)
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  }
};

/**
 * Storage helpers (for images/files)
 */
const storage = {
  async uploadProfilePhoto(userId, file) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/profile.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('profile-photos')
      .upload(fileName, file, { upsert: true });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('profile-photos')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  },

  async uploadReflectionImage(userId, file, reflectionId) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/reflections/${reflectionId}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('reflection-images')
      .upload(fileName, file);

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('reflection-images')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  },

  async uploadStoryMedia(userId, file, storyId) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/stories/${storyId}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('story-media')
      .upload(fileName, file, { upsert: true });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('story-media')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  }
};

// Export for use in other files
window.supabaseClient = supabase;
window.authHelpers = auth;
window.dbHelpers = db;
window.db = db; // Also export as db for convenience
window.storageHelpers = storage;

} // End of guard block
