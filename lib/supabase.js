// Supabase Client Configuration
// This file provides the Supabase client for browser use

// Import Supabase from CDN (add this to your HTML files)
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

/**
 * Initialize Supabase client
 * IMPORTANT: Replace these with your actual Supabase project credentials
 * Get them from: https://app.supabase.com/project/_/settings/api
 */
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';

// Create Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
        data: userData // Additional user metadata
      }
    });

    if (error) throw error;

    // Create user profile
    if (data.user) {
      await db.users.create({
        id: data.user.id,
        email: email,
        name: userData.name || null
      });
    }

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
        .order('timestamp', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return data;
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
  }
};

// Export for use in other files
window.supabaseClient = supabase;
window.authHelpers = auth;
window.dbHelpers = db;
window.storageHelpers = storage;
