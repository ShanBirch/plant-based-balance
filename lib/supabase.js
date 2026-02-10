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
        .maybeSingle();

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
      const insertData = {
        user_id: userId,
        workout_type: 'history',
        workout_date: workoutData.date,
        exercise_name: workoutData.exercise,
        set_number: workoutData.set,
        time_duration: workoutData.time,
        reps: workoutData.reps,
        weight_kg: workoutData.kg
      };

      // Add drop set data if present
      if (workoutData.isDropSet) {
        insertData.is_drop_set = true;
        insertData.drop_set_weights = workoutData.dropSetWeights || null;
        insertData.drop_set_reps = workoutData.dropSetReps || null;
      }

      let { data, error } = await supabase
        .from('workouts')
        .insert([insertData])
        .select()
        .single();

      // If error is about missing drop set columns, retry without them
      if (error && error.message && error.message.includes('drop_set')) {
        console.warn('Drop set columns not in database, saving without drop set data');
        delete insertData.is_drop_set;
        delete insertData.drop_set_weights;
        delete insertData.drop_set_reps;

        const retryResult = await supabase
          .from('workouts')
          .insert([insertData])
          .select()
          .single();

        data = retryResult.data;
        error = retryResult.error;
      }

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
        .eq('workout_type', 'custom_template')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },

    async updateCustomWorkout(workoutId, templateData) {
      const { data, error } = await supabase
        .from('workouts')
        .update({
          template_data: templateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', workoutId)
        .select()
        .single();

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
     * Get recent workouts grouped by date
     * Returns array of { date, exercises: [{ name, sets }] }
     */
    async getRecentWorkoutsByDate(userId, limit = 10) {
      const { data, error } = await supabase
        .from('workouts')
        .select('workout_date, exercise_name, set_number, reps, weight_kg, time_duration')
        .eq('user_id', userId)
        .eq('workout_type', 'history')
        .not('workout_date', 'is', null)
        .order('workout_date', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Group by date
      const byDate = {};
      data.forEach(row => {
        const date = row.workout_date;
        if (!byDate[date]) {
          byDate[date] = { date, exercises: {} };
        }
        if (!byDate[date].exercises[row.exercise_name]) {
          byDate[date].exercises[row.exercise_name] = { name: row.exercise_name, sets: 0 };
        }
        byDate[date].exercises[row.exercise_name].sets++;
      });

      // Convert to array and limit
      return Object.values(byDate)
        .map(d => ({
          date: d.date,
          exercises: Object.values(d.exercises)
        }))
        .slice(0, limit);
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
   * Workout customizations table operations (user-added/removed exercises per workout)
   */
  workoutCustomizations: {
    /**
     * Get customizations for a specific workout
     * @param {string} userId - User's UUID
     * @param {string} workoutKey - Workout identifier (e.g., "gym/back/gym-back-1")
     * @returns {Object|null} - Customization data or null if none exists
     */
    async get(userId, workoutKey) {
      const { data, error } = await supabase
        .from('workout_customizations')
        .select('*')
        .eq('user_id', userId)
        .eq('workout_key', workoutKey)
        .maybeSingle();

      if (error) throw error;
      return data;
    },

    /**
     * Add an exercise to a workout
     * @param {string} userId - User's UUID
     * @param {string} workoutKey - Workout identifier
     * @param {Object} exercise - Exercise to add { name, sets, reps, desc }
     */
    async addExercise(userId, workoutKey, exercise) {
      // First, get existing customizations
      const existing = await this.get(userId, workoutKey);

      if (existing) {
        // Update existing record
        const addedExercises = existing.added_exercises || [];
        addedExercises.push(exercise);

        const { data, error } = await supabase
          .from('workout_customizations')
          .update({
            added_exercises: addedExercises,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new record
        const { data, error } = await supabase
          .from('workout_customizations')
          .insert([{
            user_id: userId,
            workout_key: workoutKey,
            added_exercises: [exercise],
            removed_exercises: []
          }])
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },

    /**
     * Remove (hide) an exercise from a workout
     * @param {string} userId - User's UUID
     * @param {string} workoutKey - Workout identifier
     * @param {string} exerciseName - Name of exercise to remove
     */
    async removeExercise(userId, workoutKey, exerciseName) {
      const existing = await this.get(userId, workoutKey);

      if (existing) {
        // Check if this is a user-added exercise
        const addedExercises = existing.added_exercises || [];
        const addedIndex = addedExercises.findIndex(ex => ex.name === exerciseName);

        if (addedIndex !== -1) {
          // Remove from added exercises (permanent delete)
          addedExercises.splice(addedIndex, 1);

          const { data, error } = await supabase
            .from('workout_customizations')
            .update({
              added_exercises: addedExercises,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)
            .select()
            .single();

          if (error) throw error;
          return data;
        } else {
          // Add to removed exercises (hide from original workout)
          const removedExercises = existing.removed_exercises || [];
          if (!removedExercises.includes(exerciseName)) {
            removedExercises.push(exerciseName);
          }

          const { data, error } = await supabase
            .from('workout_customizations')
            .update({
              removed_exercises: removedExercises,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)
            .select()
            .single();

          if (error) throw error;
          return data;
        }
      } else {
        // Create new record with exercise in removed list
        const { data, error } = await supabase
          .from('workout_customizations')
          .insert([{
            user_id: userId,
            workout_key: workoutKey,
            added_exercises: [],
            removed_exercises: [exerciseName]
          }])
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },

    /**
     * Restore a removed exercise (unhide it)
     * @param {string} userId - User's UUID
     * @param {string} workoutKey - Workout identifier
     * @param {string} exerciseName - Name of exercise to restore
     */
    async restoreExercise(userId, workoutKey, exerciseName) {
      const existing = await this.get(userId, workoutKey);

      if (existing) {
        const removedExercises = existing.removed_exercises || [];
        const index = removedExercises.indexOf(exerciseName);

        if (index !== -1) {
          removedExercises.splice(index, 1);

          const { data, error } = await supabase
            .from('workout_customizations')
            .update({
              removed_exercises: removedExercises,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)
            .select()
            .single();

          if (error) throw error;
          return data;
        }
      }
      return null;
    },

    /**
     * Get all customizations for a user
     * @param {string} userId - User's UUID
     * @returns {Array} - Array of customization records
     */
    async getAllForUser(userId) {
      const { data, error } = await supabase
        .from('workout_customizations')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;
      return data || [];
    }
  },

  /**
   * Custom workout programs table operations (user-created multi-week programs)
   */
  customPrograms: {
    /**
     * Create a new custom workout program
     * @param {string} userId - User's UUID
     * @param {Object} programData - Program details
     * @returns {Object} - Created program record
     */
    async create(userId, programData) {
      const { data, error } = await supabase
        .from('custom_workout_programs')
        .insert([{
          user_id: userId,
          program_name: programData.name,
          duration_weeks: programData.durationWeeks || 4,
          weekly_schedule: programData.weeklySchedule || [],
          is_active: false,
          start_date: null
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    /**
     * Get all custom programs for a user
     * @param {string} userId - User's UUID
     * @returns {Array} - Array of program records
     */
    async getAll(userId) {
      const { data, error } = await supabase
        .from('custom_workout_programs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },

    /**
     * Get the currently active custom program for a user
     * @param {string} userId - User's UUID
     * @returns {Object|null} - Active program or null
     */
    async getActive(userId) {
      const { data, error } = await supabase
        .from('custom_workout_programs')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },

    /**
     * Get a specific program by ID
     * @param {string} programId - Program UUID
     * @returns {Object|null} - Program record or null
     */
    async get(programId) {
      const { data, error } = await supabase
        .from('custom_workout_programs')
        .select('*')
        .eq('id', programId)
        .single();

      if (error) throw error;
      return data;
    },

    /**
     * Update a custom program
     * @param {string} programId - Program UUID
     * @param {Object} updates - Fields to update
     * @returns {Object} - Updated program record
     */
    async update(programId, updates) {
      const { data, error } = await supabase
        .from('custom_workout_programs')
        .update(updates)
        .eq('id', programId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    /**
     * Activate a custom program (deactivates any other active program)
     * @param {string} userId - User's UUID
     * @param {string} programId - Program UUID to activate
     * @param {string} startDate - Optional start date (defaults to today)
     * @returns {Object} - Activated program record
     */
    async activate(userId, programId, startDate = null) {
      // First, deactivate all programs for this user
      await supabase
        .from('custom_workout_programs')
        .update({ is_active: false })
        .eq('user_id', userId);

      // Then activate the specified program
      const { data, error } = await supabase
        .from('custom_workout_programs')
        .update({
          is_active: true,
          start_date: startDate || new Date().toISOString().split('T')[0]
        })
        .eq('id', programId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    /**
     * Deactivate a custom program
     * @param {string} programId - Program UUID
     * @returns {Object} - Deactivated program record
     */
    async deactivate(programId) {
      const { data, error } = await supabase
        .from('custom_workout_programs')
        .update({ is_active: false })
        .eq('id', programId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    /**
     * Delete a custom program
     * @param {string} programId - Program UUID
     * @returns {boolean} - True if deleted
     */
    async delete(programId) {
      const { error } = await supabase
        .from('custom_workout_programs')
        .delete()
        .eq('id', programId);

      if (error) throw error;
      return true;
    },

    /**
     * Get today's workout from active custom program
     * @param {string} userId - User's UUID
     * @returns {Object|null} - Today's workout assignment or null
     */
    async getTodaysWorkout(userId) {
      const activeProgram = await this.getActive(userId);
      if (!activeProgram) return null;

      // Get today's day of week (0 = Sunday, 1 = Monday, etc.)
      const today = new Date();
      const dayOfWeek = today.getDay();
      // Convert to Monday-based index (0 = Monday, 6 = Sunday)
      const dayIndex = (dayOfWeek + 6) % 7;

      // Get the workout for today from the weekly schedule
      const schedule = activeProgram.weekly_schedule || [];
      const todaysSchedule = schedule[dayIndex];

      if (!todaysSchedule || !todaysSchedule.workout) return null;

      // Calculate which week of the program we're in
      const startDate = new Date(activeProgram.start_date);
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const weeksElapsed = Math.floor((today - startDate) / msPerWeek);
      const currentWeek = weeksElapsed + 1;

      // Check if program is still active (within duration)
      if (currentWeek > activeProgram.duration_weeks) {
        return null; // Program has ended
      }

      return {
        ...todaysSchedule,
        programId: activeProgram.id,
        programName: activeProgram.program_name,
        currentWeek: currentWeek,
        totalWeeks: activeProgram.duration_weeks
      };
    }
  },

  /**
   * Workout replacements table operations (temporary workout swaps on calendar)
   */
  workoutReplacements: {
    /**
     * Create a new workout replacement
     * @param {string} userId - User's UUID
     * @param {Object} replacementData - Replacement details
     * @returns {Object} - Created replacement record
     */
    async create(userId, replacementData) {
      // Calculate end date based on start date and duration
      const startDate = new Date(replacementData.startDate || new Date());
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + (replacementData.durationWeeks * 7) - 1);

      const { data, error } = await supabase
        .from('workout_replacements')
        .insert([{
          user_id: userId,
          day_of_week: replacementData.dayOfWeek,
          replacement_workout: replacementData.workout,
          duration_weeks: replacementData.durationWeeks,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0]
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    /**
     * Get all active replacements for a user (where today is between start_date and end_date)
     * @param {string} userId - User's UUID
     * @returns {Array} - Array of active replacement records
     */
    async getActive(userId) {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('workout_replacements')
        .select('*')
        .eq('user_id', userId)
        .lte('start_date', today)
        .gte('end_date', today);

      if (error) throw error;
      return data || [];
    },

    /**
     * Get replacement for a specific day of week (if active)
     * @param {string} userId - User's UUID
     * @param {number} dayOfWeek - Day of week (0 = Monday, 6 = Sunday)
     * @returns {Object|null} - Active replacement for that day or null
     */
    async getForDay(userId, dayOfWeek) {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('workout_replacements')
        .select('*')
        .eq('user_id', userId)
        .eq('day_of_week', dayOfWeek)
        .lte('start_date', today)
        .gte('end_date', today)
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (error) throw error;
      return data;
    },

    /**
     * Get all replacements for a user (including expired)
     * @param {string} userId - User's UUID
     * @returns {Array} - Array of all replacement records
     */
    async getAll(userId) {
      const { data, error } = await supabase
        .from('workout_replacements')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },

    /**
     * Delete a workout replacement
     * @param {string} replacementId - Replacement UUID
     * @returns {boolean} - True if deleted
     */
    async delete(replacementId) {
      const { error } = await supabase
        .from('workout_replacements')
        .delete()
        .eq('id', replacementId);

      if (error) throw error;
      return true;
    },

    /**
     * Delete all replacements for a specific day (useful when creating a new one)
     * @param {string} userId - User's UUID
     * @param {number} dayOfWeek - Day of week (0 = Monday, 6 = Sunday)
     * @returns {boolean} - True if deleted
     */
    async deleteForDay(userId, dayOfWeek) {
      const today = new Date().toISOString().split('T')[0];

      const { error } = await supabase
        .from('workout_replacements')
        .delete()
        .eq('user_id', userId)
        .eq('day_of_week', dayOfWeek)
        .gte('end_date', today); // Only delete future/active ones

      if (error) throw error;
      return true;
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
      const { data, error} = await supabase
        .from('daily_checkins')
        .upsert({
          user_id: userId,
          checkin_date: date,
          energy: checkinData.energy,
          equipment: checkinData.equipment,
          sleep: checkinData.sleep,
          water_intake: checkinData.water,
          additional_data: checkinData.additional_data || checkinData.additional || {}
        }, {
          onConflict: 'user_id,checkin_date'
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
   * Daily nutrition goals and tracking
   */
  nutrition: {
    async updateGoals(userId, nutritionDate, goals) {
      const { data, error } = await supabase
        .from('daily_nutrition')
        .upsert({
          user_id: userId,
          nutrition_date: nutritionDate,
          calorie_goal: goals.calorie_goal,
          protein_goal_g: goals.protein_goal_g,
          carbs_goal_g: goals.carbs_goal_g,
          fat_goal_g: goals.fat_goal_g
        }, {
          onConflict: 'user_id,nutrition_date'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async getTodayGoals(userId) {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('daily_nutrition')
        .select('*')
        .eq('user_id', userId)
        .eq('nutrition_date', today)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },

    async getGoalsByDate(userId, date) {
      const { data, error } = await supabase
        .from('daily_nutrition')
        .select('*')
        .eq('user_id', userId)
        .eq('nutrition_date', date)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },

    async updateAllGoals(userId, goals) {
      // Update calorie/macro goals for ALL existing daily_nutrition entries
      // This ensures that when onboarding is redone, all historical entries
      // reflect the new goals instead of keeping stale values
      const { data, error } = await supabase
        .from('daily_nutrition')
        .update({
          calorie_goal: goals.calorie_goal,
          protein_goal_g: goals.protein_goal_g,
          carbs_goal_g: goals.carbs_goal_g,
          fat_goal_g: goals.fat_goal_g
        })
        .eq('user_id', userId)
        .select();

      if (error) throw error;
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
        .eq('referral_code', referralCode.toUpperCase())
        .maybeSingle();

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
      try {
        const user = await db.users.get(userId);
        const referrals = await this.getUserReferrals(userId);

        return {
          referralCode: user.referral_code,
          totalReferrals: user.referrals_count || 0,
          freeDaysEarned: user.free_days_earned || 0,
          referrals: referrals
        };
      } catch (error) {
        console.error('Error in getStats:', error);
        throw new Error(`Failed to get referral stats: ${error.message}`);
      }
    },

    /**
     * Generate a unique referral code using database function
     */
    async generateReferralCode() {
      try {
        const { data, error } = await supabase.rpc('generate_referral_code');

        if (error) {
          console.error('Supabase RPC error:', error);
          throw new Error(`Database function error: ${error.message || error.code}`);
        }

        if (!data) {
          throw new Error('Database function returned null/undefined');
        }

        console.log('Generated referral code via RPC:', data);
        return data;
      } catch (error) {
        console.error('Error in generateReferralCode:', error);
        throw error;
      }
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
    },

    /**
     * Toggle a reaction on a feed post (story)
     */
    async toggleReaction(storyId, userId, reaction) {
      const { data, error } = await supabase
        .rpc('toggle_feed_reaction', {
          p_story_id: storyId,
          p_user_id: userId,
          p_reaction: reaction
        });

      if (error) throw error;
      return data;
    },

    /**
     * Get reactions for a story
     */
    async getReactions(storyId) {
      const { data, error } = await supabase
        .rpc('get_story_reactions', { story_uuid: storyId });

      if (error) throw error;
      return data || [];
    },

    /**
     * Get reactions for multiple stories at once
     */
    async getBulkReactions(storyIds) {
      const { data, error } = await supabase
        .from('feed_reactions')
        .select('story_id, reaction, user_id')
        .in('story_id', storyIds);

      if (error) throw error;
      return data || [];
    },

    /**
     * Add a comment to a feed post
     */
    async addComment(storyId, userId, commentText) {
      const { data, error } = await supabase
        .from('feed_comments')
        .insert({ story_id: storyId, user_id: userId, comment_text: commentText })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    /**
     * Get comments for a story
     */
    async getComments(storyId, limit = 20) {
      const { data, error } = await supabase
        .rpc('get_story_comments', { p_story_id: storyId, p_limit: limit });

      if (error) throw error;
      return data || [];
    },

    /**
     * Delete a comment
     */
    async deleteComment(commentId) {
      const { error } = await supabase
        .from('feed_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
    },

    /**
     * Get comment counts for multiple stories at once
     */
    async getBulkCommentCounts(storyIds) {
      const { data, error } = await supabase
        .rpc('get_bulk_comment_counts', { p_story_ids: storyIds });

      if (error) throw error;
      return data || [];
    }
  },

  /**
   * Friends system operations
   */
  friends: {
    /**
     * Send a friend request
     */
    async sendRequest(userId, friendId) {
      const { data, error } = await supabase
        .from('friendships')
        .insert([{
          user_id: userId,
          friend_id: friendId,
          status: 'pending'
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    /**
     * Accept a friend request
     */
    async acceptRequest(requestId) {
      const { data, error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', requestId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    /**
     * Decline a friend request
     */
    async declineRequest(requestId) {
      const { data, error } = await supabase
        .from('friendships')
        .update({ status: 'declined' })
        .eq('id', requestId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    /**
     * Remove a friend
     */
    async removeFriend(userId, friendId) {
      // Delete friendship in either direction
      const { error } = await supabase
        .from('friendships')
        .delete()
        .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);

      if (error) throw error;
      return true;
    },

    /**
     * Get user's friends list
     */
    async getFriends(userId) {
      const { data, error } = await supabase
        .rpc('get_friends', { user_uuid: userId });

      if (error) throw error;
      return data || [];
    },

    /**
     * Get friends with status, with fallback chain for resilience.
     * Tries: get_friends_with_status RPC -> get_friends RPC -> direct query
     */
    async getFriendsWithFallback(userId) {
      // Try get_friends_with_status first (full data)
      const res1 = await supabase.rpc('get_friends_with_status', { user_uuid: userId });
      if (!res1.error) return res1.data || [];

      console.warn('get_friends_with_status failed, trying get_friends:', res1.error.message);

      // Fallback to simpler get_friends RPC
      const res2 = await supabase.rpc('get_friends', { user_uuid: userId });
      if (!res2.error) return res2.data || [];

      console.warn('get_friends failed, trying direct query:', res2.error.message);

      // Final fallback: direct query on friendships + users tables
      const { data: sent, error: e1 } = await supabase
        .from('friendships')
        .select('friend_id, status, users!friendships_friend_id_fkey(id, name, profile_photo)')
        .eq('user_id', userId)
        .eq('status', 'accepted');
      const { data: received, error: e2 } = await supabase
        .from('friendships')
        .select('user_id, status, users!friendships_user_id_fkey(id, name, profile_photo)')
        .eq('friend_id', userId)
        .eq('status', 'accepted');

      if (e1 && e2) throw e1;

      const friends = [];
      if (sent) {
        sent.forEach(r => {
          const u = r.users;
          if (u) friends.push({ friend_id: u.id, friend_name: u.name, friend_photo: u.profile_photo });
        });
      }
      if (received) {
        received.forEach(r => {
          const u = r.users;
          if (u) friends.push({ friend_id: u.id, friend_name: u.name, friend_photo: u.profile_photo });
        });
      }
      return friends;
    },

    /**
     * Get pending friend requests (received)
     */
    async getPendingRequests(userId) {
      const { data, error } = await supabase
        .rpc('get_pending_friend_requests', { user_uuid: userId });

      if (error) throw error;
      return data || [];
    },

    /**
     * Get sent friend requests (pending)
     */
    async getSentRequests(userId) {
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          id,
          friend_id,
          status,
          created_at,
          friend:users!friend_id(id, name, email, profile_photo)
        `)
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },

    /**
     * Search users by email or name
     */
    async searchUsers(searchQuery, currentUserId) {
      const { data, error } = await supabase
        .rpc('search_users_for_friend', {
          search_query: searchQuery,
          current_user_uuid: currentUserId
        });

      if (error) throw error;
      return data || [];
    },

    /**
     * Check if two users are friends
     */
    async areFriends(userId, friendId) {
      const { data, error } = await supabase
        .rpc('are_friends', {
          user1_uuid: userId,
          user2_uuid: friendId
        });

      if (error) throw error;
      return data;
    },

    /**
     * Get friendship status between two users
     */
    async getFriendshipStatus(userId, friendId) {
      const { data, error } = await supabase
        .from('friendships')
        .select('id, status, user_id, friend_id')
        .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`)
        .maybeSingle();

      if (error) throw error;
      return data;
    },

    /**
     * Get friend count
     */
    async getFriendCount(userId) {
      const friends = await this.getFriends(userId);
      return friends.length;
    }
  },

  /**
   * Multiplayer games operations
   */
  games: {
    /**
     * Create a game challenge
     */
    async createChallenge(challengerId, opponentId, gameType, coinBet = 0) {
      const { data, error } = await supabase.rpc('create_game_challenge', {
        p_challenger_id: challengerId,
        p_opponent_id: opponentId,
        p_game_type: gameType,
        p_coin_bet: coinBet
      });
      if (error) throw error;
      return data;
    },

    /**
     * Accept a game challenge
     */
    async acceptChallenge(matchId, userId) {
      const { data, error } = await supabase.rpc('accept_game_challenge', {
        p_match_id: matchId,
        p_user_id: userId
      });
      if (error) throw error;
      return data;
    },

    /**
     * Decline a game challenge
     */
    async declineChallenge(matchId, userId) {
      const { data, error } = await supabase.rpc('decline_game_challenge', {
        p_match_id: matchId,
        p_user_id: userId
      });
      if (error) throw error;
      return data;
    },

    /**
     * Get a specific game match
     */
    async getMatch(matchId) {
      const { data, error } = await supabase
        .from('game_matches')
        .select('*')
        .eq('id', matchId)
        .single();
      if (error) throw error;
      return data;
    },

    /**
     * Get user's active and pending games
     */
    async getUserGames(userId) {
      const { data, error } = await supabase.rpc('get_user_games', {
        user_uuid: userId
      });
      if (error) throw error;
      return data || [];
    },

    /**
     * Update game state (board, turn, move count)
     */
    async updateGameState(matchId, gameState, currentTurn, moveCount) {
      const { data, error } = await supabase
        .from('game_matches')
        .update({
          game_state: gameState,
          current_turn: currentTurn,
          move_count: moveCount,
          last_move_at: new Date().toISOString()
        })
        .eq('id', matchId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    /**
     * Record a move
     */
    async recordMove(matchId, playerId, moveNumber, moveData) {
      const { data, error } = await supabase
        .from('game_moves')
        .insert({
          match_id: matchId,
          player_id: playerId,
          move_number: moveNumber,
          move_data: moveData
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    /**
     * Complete a game (winner or draw)
     */
    async completeGame(matchId, winnerId, isDraw = false) {
      const { data, error } = await supabase.rpc('complete_game', {
        p_match_id: matchId,
        p_winner_id: winnerId,
        p_is_draw: isDraw
      });
      if (error) throw error;
      return data;
    },

    /**
     * Forfeit a game
     */
    async forfeitGame(matchId, userId) {
      const { data, error } = await supabase.rpc('forfeit_game', {
        p_match_id: matchId,
        p_user_id: userId
      });
      if (error) throw error;
      return data;
    },

    /**
     * Get move history for a match
     */
    async getMoves(matchId) {
      const { data, error } = await supabase
        .from('game_moves')
        .select('*')
        .eq('match_id', matchId)
        .order('move_number', { ascending: true });
      if (error) throw error;
      return data || [];
    }
  },

  /**
   * Points system operations
   */
  points: {
    /**
     * Get user's points summary
     */
    async getPoints(userId) {
      const { data, error } = await supabase
        .from('user_points')
        .select('*')
        .eq('user_id', userId)
        .single();

      // PGRST116 = no rows found, which is fine for new users
      if (error && error.code !== 'PGRST116') throw error;

      // Return default values if no record exists
      if (!data) {
        return {
          current_points: 0,
          lifetime_points: 0,
          redeemed_points: 0,
          current_streak: 0,
          longest_streak: 0,
          meal_streak: 0,
          workout_streak: 0,
          total_meals_logged: 0,
          total_workouts_logged: 0,
          weeks_redeemed: 0,
          last_post_date: null
        };
      }

      return data;
    },

    /**
     * Get recent point transactions
     */
    async getTransactions(userId, limit = 20) {
      const { data, error } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },

    /**
     * Get user's milestones
     */
    async getMilestones(userId) {
      const { data, error } = await supabase
        .from('meal_milestones')
        .select('*')
        .eq('user_id', userId)
        .order('achieved_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },

    /**
     * Award points for meal or workout
     * Calls the edge function which handles anti-cheat and streak logic
     */
    async awardPoints(userId, type, referenceId, options = {}) {
      const response = await fetch('/api/award-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          type,
          referenceId,
          photoTimestamp: options.photoTimestamp || null,
          aiConfidence: options.aiConfidence || null,
          photoHash: options.photoHash || null
        })
      });

      const result = await response.json();
      return result;
    },

    /**
     * Redeem points for free week
     * Calls the edge function which handles Stripe subscription extension
     */
    async redeemPoints(userId) {
      const response = await fetch('/api/redeem-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      const result = await response.json();
      return result;
    },

    /**
     * Verify photo timestamp (anti-cheat)
     */
    async verifyPhoto(fileLastModified, exifTimestamp = null) {
      const response = await fetch('/api/verify-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileLastModified,
          exifTimestamp,
          serverTimestamp: Date.now()
        })
      });

      const result = await response.json();
      return result;
    },

    /**
     * Check if user can redeem (has enough points)
     */
    canRedeem(currentPoints) {
      const POINTS_FOR_FREE_WEEK = 200;
      return currentPoints >= POINTS_FOR_FREE_WEEK;
    },

    /**
     * Calculate progress toward free week
     */
    getProgressPercent(currentPoints) {
      const POINTS_FOR_FREE_WEEK = 200;
      return Math.min(100, (currentPoints / POINTS_FOR_FREE_WEEK) * 100);
    },

    /**
     * Generate SHA-256 hash of image data for duplicate detection
     */
    async generatePhotoHash(imageBase64) {
      try {
        // Remove data URL prefix if present
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

        // Convert base64 to ArrayBuffer
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Generate SHA-256 hash
        const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);

        // Convert to hex string
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        return hashHex;
      } catch (error) {
        console.error('Error generating photo hash:', error);
        return null;
      }
    }
  },

  /**
   * Personal Bests (PB) operations for tracking exercise PRs
   */
  personalBests: {
    /**
     * Get all personal bests for a user
     * @param {string} userId - User's UUID
     * @param {number} limit - Max results (default 10)
     * @returns {Array} - Array of personal best records
     */
    async getAll(userId, limit = 10) {
      const { data, error } = await supabase
        .from('personal_bests')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error && error.code !== 'PGRST116') throw error;
      return data || [];
    },

    /**
     * Get personal best for a specific exercise
     * @param {string} userId - User's UUID
     * @param {string} exerciseName - Name of the exercise
     * @returns {Object|null} - Personal best record or null
     */
    async getForExercise(userId, exerciseName) {
      const { data, error } = await supabase
        .from('personal_bests')
        .select('*')
        .eq('user_id', userId)
        .eq('exercise_name', exerciseName)
        .maybeSingle();

      if (error) throw error;
      return data;
    },

    /**
     * Get recent PB history (when PBs were broken)
     * @param {string} userId - User's UUID
     * @param {number} limit - Max results (default 10)
     * @returns {Array} - Array of PB history records
     */
    async getHistory(userId, limit = 10) {
      const { data, error } = await supabase
        .from('pb_history')
        .select('*')
        .eq('user_id', userId)
        .order('achieved_at', { ascending: false })
        .limit(limit);

      if (error && error.code !== 'PGRST116') throw error;
      return data || [];
    },

    /**
     * Check and update personal bests from a completed workout
     * Returns array of new PBs achieved
     * @param {string} userId - User's UUID
     * @param {Array} workoutData - Array of {exercise, reps, kg, date}
     * @returns {Array} - Array of newly achieved PBs
     */
    async checkAndUpdatePBs(userId, workoutData) {
      const newPBs = [];

      // Group by exercise and find best set for each
      const exerciseMap = {};
      for (const set of workoutData) {
        const exercise = set.exercise;
        const weight = parseFloat(set.kg) || 0;
        const reps = parseInt(set.reps) || 0;

        if (!exerciseMap[exercise]) {
          exerciseMap[exercise] = { bestWeight: 0, bestWeightReps: 0, bestReps: 0, bestRepsWeight: 0 };
        }

        // Track best weight (prefer heavier weight, then more reps at that weight)
        if (weight > exerciseMap[exercise].bestWeight ||
            (weight === exerciseMap[exercise].bestWeight && reps > exerciseMap[exercise].bestWeightReps)) {
          exerciseMap[exercise].bestWeight = weight;
          exerciseMap[exercise].bestWeightReps = reps;
        }

        // Track best reps (most reps regardless of weight)
        if (reps > exerciseMap[exercise].bestReps) {
          exerciseMap[exercise].bestReps = reps;
          exerciseMap[exercise].bestRepsWeight = weight;
        }
      }

      const today = new Date().toISOString().split('T')[0];

      for (const [exerciseName, current] of Object.entries(exerciseMap)) {
        // Skip if no significant data
        if (current.bestWeight === 0 && current.bestReps === 0) continue;

        // Get existing PB for this exercise
        const existingPB = await this.getForExercise(userId, exerciseName);

        let isNewWeightPB = false;
        let isNewRepsPB = false;
        let previousWeight = 0;
        let previousReps = 0;

        if (!existingPB) {
          // First time doing this exercise - everything is a PB!
          isNewWeightPB = current.bestWeight > 0;
          isNewRepsPB = current.bestReps > 0;
        } else {
          // Compare to existing PBs
          previousWeight = parseFloat(existingPB.best_weight_kg) || 0;
          previousReps = parseInt(existingPB.best_reps) || 0;

          isNewWeightPB = current.bestWeight > previousWeight;
          isNewRepsPB = current.bestReps > previousReps;
        }

        // Update PB record if any improvement
        if (isNewWeightPB || isNewRepsPB) {
          const updateData = {
            user_id: userId,
            exercise_name: exerciseName,
            updated_at: new Date().toISOString()
          };

          if (isNewWeightPB) {
            updateData.best_weight_kg = current.bestWeight;
            updateData.best_weight_reps = current.bestWeightReps;
            updateData.best_weight_date = today;
          }

          if (isNewRepsPB) {
            updateData.best_reps = current.bestReps;
            updateData.best_reps_weight_kg = current.bestRepsWeight;
            updateData.best_reps_date = today;
          }

          // Upsert the PB record
          const { error: upsertError } = await supabase
            .from('personal_bests')
            .upsert(updateData, {
              onConflict: 'user_id,exercise_name'
            });

          if (upsertError) {
            console.error('Error upserting PB:', upsertError);
            continue;
          }

          // Record PB history
          if (isNewWeightPB && current.bestWeight > 0) {
            try {
              const { error: weightHistErr } = await supabase
                .from('pb_history')
                .insert({
                  user_id: userId,
                  exercise_name: exerciseName,
                  pb_type: 'weight',
                  new_value: current.bestWeight,
                  new_reps: current.bestWeightReps,
                  previous_value: previousWeight || null,
                  improvement: previousWeight ? current.bestWeight - previousWeight : null,
                  workout_date: today
                });
              if (weightHistErr) console.warn('Failed to insert weight PB history:', weightHistErr);
            } catch (histErr) {
              console.warn('Error inserting weight PB history:', histErr);
            }

            newPBs.push({
              exercise: exerciseName,
              type: 'weight',
              value: current.bestWeight,
              reps: current.bestWeightReps,
              previousValue: previousWeight,
              improvement: previousWeight ? current.bestWeight - previousWeight : null
            });
          }

          if (isNewRepsPB && current.bestReps > 0) {
            try {
              const { error: repsHistErr } = await supabase
                .from('pb_history')
                .insert({
                  user_id: userId,
                  exercise_name: exerciseName,
                  pb_type: 'reps',
                  new_value: current.bestReps,
                  new_weight_kg: current.bestRepsWeight,
                  previous_value: previousReps || null,
                  improvement: previousReps ? current.bestReps - previousReps : null,
                  workout_date: today
                });
              if (repsHistErr) console.warn('Failed to insert reps PB history:', repsHistErr);
            } catch (histErr) {
              console.warn('Error inserting reps PB history:', histErr);
            }

            // Only add reps PB if it's not already covered by weight PB
            if (!isNewWeightPB || current.bestReps !== current.bestWeightReps) {
              newPBs.push({
                exercise: exerciseName,
                type: 'reps',
                value: current.bestReps,
                weight: current.bestRepsWeight,
                previousValue: previousReps,
                improvement: previousReps ? current.bestReps - previousReps : null
              });
            }
          }
        }
      }

      return newPBs;
    }
  },

  /**
   * Daily weigh-ins operations
   */
  weighIns: {
    /**
     * Log a daily weigh-in (once per day max)
     * @param {string} userId - User's UUID
     * @param {number} weightKg - Weight in kg
     * @param {string} notes - Optional notes
     * @returns {Object} - Created weigh-in record
     */
    async log(userId, weightKg, notes = null) {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('daily_weigh_ins')
        .upsert({
          user_id: userId,
          weigh_in_date: today,
          weight_kg: weightKg,
          notes: notes
        }, {
          onConflict: 'user_id,weigh_in_date'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    /**
     * Check if user has already weighed in today
     * @param {string} userId - User's UUID
     * @returns {Object|null} - Today's weigh-in record or null
     */
    async getTodaysWeighIn(userId) {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('daily_weigh_ins')
        .select('*')
        .eq('user_id', userId)
        .eq('weigh_in_date', today)
        .maybeSingle();

      if (error) throw error;
      return data;
    },

    /**
     * Get recent weigh-ins for tracking progress
     * @param {string} userId - User's UUID
     * @param {number} limit - Max results (default 30)
     * @returns {Array} - Array of weigh-in records
     */
    async getRecent(userId, limit = 30) {
      const { data, error } = await supabase
        .from('daily_weigh_ins')
        .select('*')
        .eq('user_id', userId)
        .order('weigh_in_date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },

    /**
     * Get total weigh-in count for milestones
     * @param {string} userId - User's UUID
     * @returns {number} - Total weigh-in count
     */
    async getCount(userId) {
      const { count, error } = await supabase
        .from('daily_weigh_ins')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (error) throw error;
      return count || 0;
    },

    /**
     * Get latest weigh-in (most recent, any date)
     * @param {string} userId - User's UUID
     * @returns {Object|null} - Latest weigh-in record
     */
    async getLatest(userId) {
      const { data, error } = await supabase
        .from('daily_weigh_ins')
        .select('*')
        .eq('user_id', userId)
        .order('weigh_in_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    }
  },

  // ==========================================
  // Activity Logs (cardio, classes, sports)
  // ==========================================
  activityLogs: {
    /**
     * Create a new activity log
     */
    async create(userId, activityData) {
      const { data, error } = await supabase
        .from('activity_logs')
        .insert([{
          user_id: userId,
          activity_type: activityData.activity_type,
          activity_label: activityData.activity_label || null,
          duration_minutes: activityData.duration_minutes,
          intensity: activityData.intensity || 'moderate',
          estimated_calories: activityData.estimated_calories || null,
          met_value: activityData.met_value || null,
          photo_url: activityData.photo_url || null,
          photo_verified: activityData.photo_verified || false,
          venue_type: activityData.venue_type || null,
          venue_verifiable: activityData.venue_verifiable || false,
          ai_confidence: activityData.ai_confidence || null,
          detected_elements: activityData.detected_elements || [],
          xp_eligible: activityData.xp_eligible || false,
          xp_awarded: activityData.xp_awarded || false,
          notes: activityData.notes || null,
          activity_date: activityData.activity_date || new Date().toISOString().split('T')[0]
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    /**
     * Get activity history for a user
     */
    async getHistory(userId, limit = 50) {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', userId)
        .order('activity_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },

    /**
     * Get activities for a specific date
     */
    async getByDate(userId, date) {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('activity_date', date)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },

    /**
     * Update an activity log (e.g., mark as shared to feed)
     */
    async update(activityId, updates) {
      const { data, error } = await supabase
        .from('activity_logs')
        .update(updates)
        .eq('id', activityId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    /**
     * Get aggregate stats for a user
     */
    async getStats(userId) {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('activity_type, duration_minutes, estimated_calories')
        .eq('user_id', userId);

      if (error) throw error;

      const stats = {
        totalActivities: (data || []).length,
        totalMinutes: 0,
        totalCalories: 0,
        byType: {}
      };

      (data || []).forEach(a => {
        stats.totalMinutes += a.duration_minutes || 0;
        stats.totalCalories += a.estimated_calories || 0;
        if (!stats.byType[a.activity_type]) {
          stats.byType[a.activity_type] = { count: 0, minutes: 0, calories: 0 };
        }
        stats.byType[a.activity_type].count++;
        stats.byType[a.activity_type].minutes += a.duration_minutes || 0;
        stats.byType[a.activity_type].calories += a.estimated_calories || 0;
      });

      return stats;
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

    if (!urlData) throw new Error('Failed to get public URL');
    return urlData.publicUrl;
  },

  async uploadReflectionImage(userId, file, reflectionId) {
    if (!file || !file.name) throw new Error('Invalid file: file or file.name is missing');
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/reflections/${reflectionId}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('reflection-images')
      .upload(fileName, file);

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('reflection-images')
      .getPublicUrl(fileName);

    if (!urlData) throw new Error('Failed to get public URL');
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

    if (!urlData) throw new Error('Failed to get public URL');
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
