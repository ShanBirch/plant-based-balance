/**
 * LocalStorage to Supabase Migration Utility
 * This script migrates existing localStorage data to Supabase database
 * Run this once after user logs in for the first time
 */

const migrationHelpers = {
  /**
   * Check if migration has already been done
   */
  async checkMigrationStatus() {
    const migrated = localStorage.getItem('pbb_data_migrated');
    return migrated === 'true';
  },

  /**
   * Mark migration as complete
   */
  markMigrationComplete() {
    localStorage.setItem('pbb_data_migrated', 'true');
    localStorage.setItem('pbb_migration_date', new Date().toISOString());
  },

  /**
   * Main migration function - migrates all localStorage data to database
   */
  async migrateAllData(userId) {
    console.log('🔄 Starting data migration for user:', userId);
    const results = {
      success: [],
      errors: []
    };

    try {
      // 1. Migrate user profile data
      await this.migrateUserProfile(userId);
      results.success.push('User profile');
    } catch (error) {
      console.error('Failed to migrate user profile:', error);
      results.errors.push({ type: 'User profile', error });
    }

    try {
      // 2. Migrate user facts
      await this.migrateUserFacts(userId);
      results.success.push('User facts');
    } catch (error) {
      console.error('Failed to migrate user facts:', error);
      results.errors.push({ type: 'User facts', error });
    }

    try {
      // 3. Migrate Shannon chat history
      await this.migrateShannonChat(userId);
      results.success.push('Shannon chat history');
    } catch (error) {
      console.error('Failed to migrate Shannon chat:', error);
      results.errors.push({ type: 'Shannon chat', error });
    }

    try {
      // 4. Migrate community chat history
      await this.migrateCommunityChat(userId);
      results.success.push('Community chat history');
    } catch (error) {
      console.error('Failed to migrate community chat:', error);
      results.errors.push({ type: 'Community chat', error });
    }

    try {
      // 5. Migrate workout history
      await this.migrateWorkoutHistory(userId);
      results.success.push('Workout history');
    } catch (error) {
      console.error('Failed to migrate workout history:', error);
      results.errors.push({ type: 'Workout history', error });
    }

    try {
      // 6. Migrate custom workouts
      await this.migrateCustomWorkouts(userId);
      results.success.push('Custom workouts');
    } catch (error) {
      console.error('Failed to migrate custom workouts:', error);
      results.errors.push({ type: 'Custom workouts', error });
    }

    try {
      // 7. Migrate current workout
      await this.migrateCurrentWorkout(userId);
      results.success.push('Current workout');
    } catch (error) {
      console.error('Failed to migrate current workout:', error);
      results.errors.push({ type: 'Current workout', error });
    }

    try {
      // 8. Migrate daily check-ins
      await this.migrateDailyCheckins(userId);
      results.success.push('Daily check-ins');
    } catch (error) {
      console.error('Failed to migrate daily check-ins:', error);
      results.errors.push({ type: 'Daily check-ins', error });
    }

    try {
      // 9. Migrate reflections
      await this.migrateReflections(userId);
      results.success.push('Reflections');
    } catch (error) {
      console.error('Failed to migrate reflections:', error);
      results.errors.push({ type: 'Reflections', error });
    }

    try {
      // 10. Migrate Saturday check-in stories
      await this.migrateSaturdayStories(userId);
      results.success.push('Saturday stories');
    } catch (error) {
      console.error('Failed to migrate Saturday stories:', error);
      results.errors.push({ type: 'Saturday stories', error });
    }

    console.log('✅ Migration complete!');
    console.log('Successful migrations:', results.success);
    if (results.errors.length > 0) {
      console.warn('Failed migrations:', results.errors);
    }

    // Mark migration as complete
    this.markMigrationComplete();

    return results;
  },

  /**
   * Migrate user profile data
   */
  async migrateUserProfile(userId) {
    const name = localStorage.getItem('userName');
    const profilePhoto = localStorage.getItem('profile_photo');
    const startDate = localStorage.getItem('pbb_start_date');
    const theme = localStorage.getItem('userThemePreference');
    const onboardingComplete = localStorage.getItem('plantbased_onboarding_complete');
    const rapidApiKey = localStorage.getItem('rapidApiKey');

    const updates = {};
    if (name) updates.name = name;
    if (profilePhoto) updates.profile_photo = profilePhoto;
    if (startDate) updates.program_start_date = startDate;
    if (theme) updates.theme_preference = theme;
    if (onboardingComplete) updates.onboarding_complete = onboardingComplete === 'true';
    if (rapidApiKey) updates.rapid_api_key = rapidApiKey;

    if (Object.keys(updates).length > 0) {
      await dbHelpers.users.update(userId, updates);
      console.log('✅ Migrated user profile');
    }
  },

  /**
   * Migrate user facts
   */
  async migrateUserFacts(userId) {
    const factsString = localStorage.getItem('user_facts');
    const sleepQuality = localStorage.getItem('sleep_quality');
    const energyLevel = localStorage.getItem('energy_level');

    if (factsString || sleepQuality || energyLevel) {
      const facts = factsString ? JSON.parse(factsString) : {};

      const factData = {
        struggles: facts.struggles || [],
        preferences: facts.preferences || [],
        health_notes: facts.health_notes || [],
        personal_details: facts.personal_details || [],
        goals: facts.goals || [],
        sleep_quality: sleepQuality,
        energy_level: energyLevel
      };

      await dbHelpers.userFacts.upsert(userId, factData);
      console.log('✅ Migrated user facts');
    }
  },

  /**
   * Migrate Shannon chat history
   */
  async migrateShannonChat(userId) {
    // Check both possible localStorage keys
    let chatHistoryString = localStorage.getItem('shannon_chat_history');
    if (!chatHistoryString) {
      chatHistoryString = localStorage.getItem('myChatStats'); // Alternative key used by dashboard
    }
    if (!chatHistoryString) return;

    const chatHistory = JSON.parse(chatHistoryString);
    if (!Array.isArray(chatHistory) || chatHistory.length === 0) return;

    const messages = chatHistory.map(msg => ({
      user_id: userId,
      chat_type: 'coach', // Updated to match current implementation
      role: msg.role || msg.sender, // Handle both formats
      message_text: msg.text,
      timestamp: msg.timestamp || msg.time || Date.now(),
      brisbane_time: msg.brisbaneTime || new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })
    }));

    await dbHelpers.conversations.bulkCreate(userId, messages);
    console.log(`✅ Migrated ${messages.length} Shannon chat messages`);
  },

  /**
   * Migrate community chat history
   */
  async migrateCommunityChat(userId) {
    const chatHistoryString = localStorage.getItem('community_chat_history');
    if (!chatHistoryString) return;

    const chatHistory = JSON.parse(chatHistoryString);
    if (!Array.isArray(chatHistory) || chatHistory.length === 0) return;

    const messages = chatHistory.map(msg => ({
      user_id: userId,
      chat_type: 'community',
      role: msg.role,
      message_text: msg.text,
      author_name: msg.authorName || null,
      timestamp: msg.timestamp || Date.now(),
      brisbane_time: new Date(msg.timestamp).toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })
    }));

    await dbHelpers.conversations.bulkCreate(userId, messages);
    console.log(`✅ Migrated ${messages.length} community chat messages`);
  },

  /**
   * Migrate workout history
   */
  async migrateWorkoutHistory(userId) {
    const historyString = localStorage.getItem('workout_history');
    if (!historyString) return;

    const history = JSON.parse(historyString);
    if (!Array.isArray(history) || history.length === 0) return;

    for (const workout of history) {
      await dbHelpers.workouts.createHistory(userId, workout);
    }

    console.log(`✅ Migrated ${history.length} workout history entries`);
  },

  /**
   * Migrate custom saved workouts
   */
  async migrateCustomWorkouts(userId) {
    const workoutsString = localStorage.getItem('saved_custom_workouts');
    if (!workoutsString) return;

    const workouts = JSON.parse(workoutsString);
    if (!Array.isArray(workouts) || workouts.length === 0) return;

    for (const workout of workouts) {
      await dbHelpers.workouts.saveCustomWorkout(
        userId,
        workout.name || 'Custom Workout',
        workout
      );
    }

    console.log(`✅ Migrated ${workouts.length} custom workouts`);
  },

  /**
   * Migrate current active workout
   */
  async migrateCurrentWorkout(userId) {
    const currentWorkoutString = localStorage.getItem('myCurrentWorkout');
    if (!currentWorkoutString) return;

    const currentWorkout = JSON.parse(currentWorkoutString);
    await dbHelpers.workouts.setCurrentWorkout(userId, currentWorkout);

    console.log('✅ Migrated current workout');
  },

  /**
   * Migrate daily check-ins
   */
  async migrateDailyCheckins(userId) {
    let count = 0;

    // Loop through all localStorage keys to find daily_checkin_* entries
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('daily_checkin_')) {
        const date = key.replace('daily_checkin_', '');
        const checkinString = localStorage.getItem(key);

        if (checkinString) {
          const checkin = JSON.parse(checkinString);
          await dbHelpers.checkins.upsert(userId, date, checkin);
          count++;
        }
      }
    }

    if (count > 0) {
      console.log(`✅ Migrated ${count} daily check-ins`);
    }
  },

  /**
   * Migrate reflections
   */
  async migrateReflections(userId) {
    let count = 0;

    // Find standalone reflections
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('standalone_reflection_')) {
        const reflectionString = localStorage.getItem(key);

        if (reflectionString) {
          const reflection = JSON.parse(reflectionString);
          await dbHelpers.reflections.create(
            userId,
            reflection.text,
            'standalone'
          );
          count++;
        }
      }
    }

    // Find numbered reflections
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('reflection_') && !key.startsWith('reflection_standalone_')) {
        const reflectionText = localStorage.getItem(key);

        if (reflectionText) {
          await dbHelpers.reflections.create(userId, reflectionText, 'standalone');
          count++;
        }
      }
    }

    if (count > 0) {
      console.log(`✅ Migrated ${count} reflections`);
    }
  },

  /**
   * Migrate Saturday check-in stories
   */
  async migrateSaturdayStories(userId) {
    const storiesString = localStorage.getItem('saturday_checkin_stories');
    if (!storiesString) return;

    const stories = JSON.parse(storiesString);
    let count = 0;

    for (const [key, story] of Object.entries(stories)) {
      if (story) {
        await dbHelpers.reflections.create(
          userId,
          story,
          'saturday_checkin',
          key
        );
        count++;
      }
    }

    if (count > 0) {
      console.log(`✅ Migrated ${count} Saturday stories`);
    }
  }
};

/**
 * Auto-run migration if user is logged in and hasn't migrated yet
 */
(async function autoMigrate() {
  // Wait for auth to be ready
  await new Promise(resolve => setTimeout(resolve, 1000));

  const session = await authHelpers.getSession();
  if (!session) {
    console.log('No active session - skipping auto-migration');
    return;
  }

  const alreadyMigrated = await migrationHelpers.checkMigrationStatus();
  if (alreadyMigrated) {
    console.log('✅ Data already migrated');
    return;
  }

  // Check if there's any localStorage data to migrate
  const hasData = localStorage.getItem('userName') ||
                  localStorage.getItem('shannon_chat_history') ||
                  localStorage.getItem('workout_history');

  if (!hasData) {
    console.log('No localStorage data to migrate');
    migrationHelpers.markMigrationComplete();
    return;
  }

  console.log('📦 Found localStorage data - starting migration...');

  try {
    const user = await authHelpers.getUser();
    const results = await migrationHelpers.migrateAllData(user.id);

    // Show user-friendly notification
    if (results.errors.length === 0) {
      alert('✅ Your data has been successfully migrated to the cloud! You can now access your account from any device.');
    } else {
      alert(`⚠️ Most of your data was migrated successfully, but some items failed. Please contact support if you notice any missing data.`);
    }
  } catch (error) {
    console.error('Migration failed:', error);
    alert('❌ Failed to migrate your data. Please try logging out and back in, or contact support.');
  }
})();

// Export for manual use
window.migrationHelpers = migrationHelpers;
