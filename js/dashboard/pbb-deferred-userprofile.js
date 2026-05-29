// Track which view we came from (so back button returns correctly)

    /**
     * Open profile from the story viewer (full-screen story view)
     */
    function openStoryUserProfile() {
        // Get current story from the stories module
        if (typeof currentUserStories !== 'undefined' && typeof currentUserStoryIndex !== 'undefined') {
            const story = currentUserStories[currentUserStoryIndex];
            if (story && story.user_id) {
                // Close the story viewer first
                if (typeof closeStoryViewer === 'function') closeStoryViewer();
                viewUserProfile(story.user_id, story.user_name, story.profile_photo);
            }
        }
    }
    window.openStoryUserProfile = openStoryUserProfile;

    /**
     * Open another user's profile from the feed
     * @param {string} userId - The UUID of the user whose profile to view
     * @param {string} [userName] - Optional pre-loaded name
     * @param {string} [userPhoto] - Optional pre-loaded photo URL
     */
    async function viewUserProfile(userId, userName, userPhoto) {
        if (!userId) return;

        // Remember where we came from
        const currentView = document.querySelector('.app-view[style*="display: block"], .app-view[style*="display:block"], .app-view.active');
        if (currentView) {
            _userProfilePreviousView = currentView.id || 'friends';
        }

        // Hide all views, show profile
        hideAllAppViews();
        const profileView = document.getElementById('view-user-profile');
        profileView.style.display = 'block';

        // Hide bottom nav for immersive feel
        document.querySelector('.bottom-nav').style.display = 'none';

        // Set initial data if provided
        const headerName = document.getElementById('user-profile-header-name');
        const nameEl = document.getElementById('user-profile-name');
        const avatarEl = document.getElementById('user-profile-avatar');

        if (userName) {
            headerName.textContent = userName;
            nameEl.textContent = userName;
        } else {
            headerName.textContent = 'Profile';
            nameEl.textContent = 'Loading...';
        }

        if (userPhoto) {
            avatarEl.innerHTML = `<img src="${userPhoto}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        } else {
            const initial = (userName || '?').charAt(0).toUpperCase();
            avatarEl.innerHTML = `<span style="font-size:2.2rem; color:white; font-weight:700;">${initial}</span>`;
        }

        // Reset sections
        document.getElementById('user-profile-level').textContent = '1';
        document.getElementById('user-profile-level-title').textContent = 'Newcomer';
        document.getElementById('user-profile-workouts').textContent = '0';
        document.getElementById('user-profile-streak').textContent = '0';
        document.getElementById('user-profile-points').textContent = '0';
        document.getElementById('user-profile-tamagotchi-section').style.display = 'none';
        document.getElementById('user-profile-pbs-section').style.display = 'none';
        document.getElementById('user-profile-badges-section').style.display = 'none';
        document.getElementById('user-profile-posts-grid').innerHTML = '';
        document.getElementById('user-profile-posts-empty').style.display = 'none';

        // Scroll to top
        profileView.scrollTop = 0;

        // Load all data in parallel
        try {
            const [userData, pointsData, personalBests, milestones, stories] = await Promise.all([
                db.users.get(userId).catch(() => null),
                db.points.getPoints(userId).catch(() => null),
                db.personalBests.getAll(userId, 20).catch(() => []),
                db.milestones.getAll(userId, 50).catch(() => []),
                loadUserProfileStories(userId).catch(() => [])
            ]);

            // Update user info
            if (userData) {
                headerName.textContent = userData.name || 'User';
                nameEl.textContent = userData.name || 'User';
                if (userData.profile_photo) {
                    avatarEl.innerHTML = `<img src="${userData.profile_photo}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                }
            }

            // Update level & stats
            let userLevel = 1;
            if (pointsData) {
                const levelInfo = calculateLevelFromPoints(pointsData.lifetime_points || 0);
                userLevel = levelInfo.level;
                document.getElementById('user-profile-level').textContent = levelInfo.level;
                document.getElementById('user-profile-level-title').textContent = levelInfo.title;
                document.getElementById('user-profile-workouts').textContent = pointsData.total_workouts_logged || 0;
                document.getElementById('user-profile-streak').textContent = pointsData.current_streak || 0;
                document.getElementById('user-profile-points').textContent = (pointsData.lifetime_points || 0).toLocaleString();
            }

            // Load tamagotchi model based on user level and gender
            try {
                const EVOLUTIONS_MALE = [
                    { level: 1,  src: "https://f005.backblazeb2.com/file/shannonsvideos/baby_full_animations.glb" },
                    { level: 5,  src: "https://f005.backblazeb2.com/file/shannonsvideos/level_1_good_final.glb" },
                    { level: 10, src: "https://f005.backblazeb2.com/file/shannonsvideos/level_10_real_final.glb" },
                    { level: 20, src: "https://f005.backblazeb2.com/file/shannonsvideos/level_20_real_final.glb" },
                    { level: 30, src: "https://f005.backblazeb2.com/file/shannonsvideos/level_30_real_final.glb" },
                    { level: 40, src: "https://f005.backblazeb2.com/file/shannonsvideos/level_40_real_final.glb" },
                    { level: 50, src: "https://f005.backblazeb2.com/file/shannonsvideos/level_50_real_final.glb" }
                ];
                const EVOLUTIONS_FEMALE = [
                    { level: 1,  src: "https://f005.backblazeb2.com/file/shannonsvideos/baby_full_animations.glb" },
                    { level: 5,  src: "https://f005.backblazeb2.com/file/shannonsvideos/level_1_female_final.glb" },
                    { level: 10, src: "https://f005.backblazeb2.com/file/shannonsvideos/level_10_female_final.glb" },
                    { level: 20, src: "https://f005.backblazeb2.com/file/shannonsvideos/level_20_female_final.glb" },
                    { level: 30, src: "https://f005.backblazeb2.com/file/shannonsvideos/level_30_female_final.glb" },
                    { level: 40, src: "https://f005.backblazeb2.com/file/shannonsvideos/level_40_female_final.glb" },
                    { level: 50, src: "https://f005.backblazeb2.com/file/shannonsvideos/level_50_female_final.glb" }
                ];
                const userSex = userData && userData.sex === 'female' ? 'female' : 'male';
                const evolutions = userSex === 'female' ? EVOLUTIONS_FEMALE : EVOLUTIONS_MALE;
                const evo = [...evolutions].reverse().find(e => userLevel >= e.level) || evolutions[0];

                const tamaSection = document.getElementById('user-profile-tamagotchi-section');
                const tamaFallback = document.getElementById('user-profile-tamagotchi-fallback');

                if (tamaSection && evo.src) {
                    tamaSection.style.display = 'block';
                    // Use universal helper for iOS placeholder support
                    const tamaModel = window._pbbSetModelSrc
                        ? window._pbbSetModelSrc('user-profile-tamagotchi-model', evo.src)
                        : document.getElementById('user-profile-tamagotchi-model');
                    if (tamaModel && !window._pbbSetModelSrc) tamaModel.setAttribute('src', evo.src);
                    if (tamaFallback) tamaFallback.style.display = 'none';
                }
            } catch (tamaErr) {
                console.error('Error loading profile tamagotchi:', tamaErr);
            }

            // Render personal bests
            renderUserProfilePBs(personalBests);

            // Render badges/milestones
            renderUserProfileBadges(milestones, pointsData);

            // Render posts
            renderUserProfilePosts(stories);

        } catch (err) {
            console.error('Error loading user profile:', err);
        }
    }
    window.viewUserProfile = viewUserProfile;

    /**
     * Close the user profile and return to the previous view
     */
    function closeUserProfile() {
        document.getElementById('view-user-profile').style.display = 'none';
        document.querySelector('.bottom-nav').style.display = 'flex';
        // Release the profile tamagotchi model to free its WebGL context
        if (window._pbbClearModelSrc) window._pbbClearModelSrc('user-profile-tamagotchi-model');

        // Map view IDs back to their tab names for proper navigation
        const viewToTab = {
            'view-friends': 'friends',
            'friends': 'friends',
            'view-dashboard': 'dashboard',
            'dashboard': 'dashboard',
            'movement-tab': 'movement-tab',
            'view-meals': 'meals',
            'view-profile': 'profile',
            'view-learning': 'learning',
            'view-cycle': 'cycle'
        };

        const tabName = viewToTab[_userProfilePreviousView];
        if (tabName) {
            switchAppTab(tabName);
        } else {
            // Fallback for unknown views
            switchAppTab('friends');
        }
    }
    window.closeUserProfile = closeUserProfile;

    /**
     * Calculate level info from lifetime points (client-side)
     */
    function calculateLevelFromPoints(lifetimePoints) {
        const CURVE_MULTIPLIER = 0.07;
        const CURVE_EXPONENT = 2.4;
        const LINEAR_BONUS = 0.7;
        const MAX_LEVEL = 99;

        function getPointsForLevel(level) {
            if (level <= 1) return 0;
            return Math.floor(CURVE_MULTIPLIER * Math.pow(level, CURVE_EXPONENT) + LINEAR_BONUS * level);
        }

        let level = 1;
        while (level < MAX_LEVEL) {
            const pointsNeeded = getPointsForLevel(level + 1);
            if (lifetimePoints < pointsNeeded) break;
            level++;
        }

        // Level title
        let title = 'Newcomer';
        if (level >= 99) title = 'Legend';
        else if (level >= 90) title = 'Master';
        else if (level >= 80) title = 'Champion';
        else if (level >= 70) title = 'Expert';
        else if (level >= 60) title = 'Veteran';
        else if (level >= 50) title = 'Dedicated';
        else if (level >= 40) title = 'Committed';
        else if (level >= 30) title = 'Consistent';
        else if (level >= 20) title = 'Growing';
        else if (level >= 10) title = 'Rising';
        else if (level >= 5) title = 'Beginner';

        return { level, title };
    }

    /**
     * Render personal bests grid
     */
    function renderUserProfilePBs(personalBests) {
        const section = document.getElementById('user-profile-pbs-section');
        const grid = document.getElementById('user-profile-pbs-grid');

        if (!personalBests || personalBests.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';

        // Sort: prioritize big compound lifts first, then by weight
        const priorityExercises = ['bench press', 'squat', 'deadlift', 'overhead press', 'barbell row'];
        const sorted = [...personalBests].sort((a, b) => {
            const aIdx = priorityExercises.findIndex(e => a.exercise_name.toLowerCase().includes(e));
            const bIdx = priorityExercises.findIndex(e => b.exercise_name.toLowerCase().includes(e));
            if (aIdx !== -1 && bIdx === -1) return -1;
            if (aIdx === -1 && bIdx !== -1) return 1;
            if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
            return (b.best_weight_kg || 0) - (a.best_weight_kg || 0);
        });

        // Show up to 6 PBs
        grid.innerHTML = sorted.slice(0, 6).map(pb => {
            const weight = pb.best_weight_kg ? `${Number(pb.best_weight_kg).toFixed(1)}kg` : '-';
            const reps = pb.best_weight_reps ? `${pb.best_weight_reps} reps` : '';
            const exerciseName = formatExerciseName(pb.exercise_name);

            return `
                <div class="up-pb-card">
                    <div class="up-pb-exercise">${exerciseName}</div>
                    <div class="up-pb-weight">${weight}</div>
                    ${reps ? `<div class="up-pb-reps">${reps}</div>` : ''}
                </div>
            `;
        }).join('');
    }

    /**
     * Format exercise name for display (capitalize, abbreviate)
     */
    function formatExerciseName(name) {
        if (!name) return '';
        return name.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    /**
     * Render badges/milestones for a user profile
     */
    function renderUserProfileBadges(milestones, pointsData) {
        const section = document.getElementById('user-profile-badges-section');
        const grid = document.getElementById('user-profile-badges-grid');

        // Build badge list from milestones and points data
        const badges = [];

        // Workout count badges
        const workoutCount = pointsData?.total_workouts_logged || 0;
        const workoutThresholds = [
            { value: 1, emoji: '🎉', label: 'First Workout' },
            { value: 5, emoji: '💪', label: '5 Workouts' },
            { value: 10, emoji: '🔥', label: '10 Workouts' },
            { value: 25, emoji: '🌟', label: '25 Workouts' },
            { value: 50, emoji: '🏆', label: '50 Workouts' },
            { value: 100, emoji: '👑', label: '100 Workouts' }
        ];
        workoutThresholds.forEach(t => {
            badges.push({
                emoji: t.emoji,
                label: t.label,
                earned: workoutCount >= t.value
            });
        });

        // Streak badges
        const streak = pointsData?.longest_streak || pointsData?.current_streak || 0;
        const streakThresholds = [
            { value: 7, emoji: '⚡', label: '7-Day Streak' },
            { value: 14, emoji: '⚡', label: '14-Day Streak' },
            { value: 30, emoji: '🔥', label: '30-Day Streak' },
            { value: 100, emoji: '💎', label: '100-Day Streak' }
        ];
        streakThresholds.forEach(t => {
            badges.push({
                emoji: t.emoji,
                label: t.label,
                earned: streak >= t.value
            });
        });

        // Milestone-based badges
        if (milestones && milestones.length > 0) {
            const milestoneTypes = new Set(milestones.map(m => m.milestone_type));
            if (milestoneTypes.has('pr_weight')) {
                badges.push({ emoji: '🏅', label: 'PR Crusher', earned: true });
            }
        }

        // Meal badges
        const mealCount = pointsData?.total_meals_logged || 0;
        if (mealCount >= 1) badges.push({ emoji: '🥗', label: 'First Meal', earned: true });
        if (mealCount >= 50) badges.push({ emoji: '🍽️', label: '50 Meals', earned: true });
        if (mealCount >= 100) badges.push({ emoji: '👨‍🍳', label: '100 Meals', earned: true });

        // Filter to only show earned badges
        const earnedBadges = badges.filter(b => b.earned);

        if (earnedBadges.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';

        grid.innerHTML = earnedBadges.slice(0, 9).map(b => `
            <div class="up-badge-card earned">
                <div class="up-badge-emoji">${b.emoji}</div>
                <div class="up-badge-label">${b.label}</div>
            </div>
        `).join('');
    }

    /**
     * Load stories/posts for a specific user (including expired ones for their profile)
     */
    async function loadUserProfileStories(userId) {
        try {
            const { data, error } = await window.supabaseClient
                .from('stories')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(30);

            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('Error loading user stories:', err);
            return [];
        }
    }

    /**
     * Render post thumbnails grid (Instagram-style 3-column grid)
     */
    function renderUserProfilePosts(stories) {
        const grid = document.getElementById('user-profile-posts-grid');
        const emptyState = document.getElementById('user-profile-posts-empty');

        if (!stories || stories.length === 0) {
            grid.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        grid.innerHTML = stories.map(story => {
            const storyId = story.id;
            const isImage = story.media_type === 'image' || story.media_type === 'video';
            const isCardType = ['workout_card', 'nutrition_card', 'meal_card', 'level_up_card'].includes(story.media_type);
            const isTextPost = story.media_type === 'text' || (!isCardType && !story.media_url && !story.thumbnail_url);

            if (isImage && story.media_url) {
                const thumb = story.thumbnail_url || story.media_url;
                return `
                    <div class="up-post-thumb" onclick="openFeedPostViewer('${storyId}')">
                        <img src="${thumb}" loading="lazy" onerror="this.parentElement.style.background='linear-gradient(135deg, var(--primary), var(--secondary))'; this.style.display='none';">
                        ${story.media_type === 'video' ? '<div style="position:absolute; top:6px; right:6px;"><svg viewBox="0 0 24 24" style="width:16px; height:16px; fill:white; filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));"><path d="M8 5v14l11-7z"/></svg></div>' : ''}
                    </div>
                `;
            } else if (isCardType) {
                const typeEmoji = story.media_type === 'workout_card' ? '💪'
                    : story.media_type === 'nutrition_card' ? '🥗'
                    : story.media_type === 'meal_card' ? '🍽️'
                    : '⭐';
                return `
                    <div class="up-post-card-thumb" onclick="openFeedPostViewer('${storyId}')">
                        <span>${typeEmoji}</span>
                    </div>
                `;
            } else if (isTextPost) {
                return `
                    <div class="up-post-card-thumb" onclick="openFeedPostViewer('${storyId}')">
                        <span style="font-size:1rem; font-weight:800;">Aa</span>
                    </div>
                `;
            }

            return `
                <div class="up-post-thumb" onclick="openFeedPostViewer('${storyId}')" style="background: linear-gradient(135deg, #e2e8f0, #f1f5f9);">
                    <div style="display:flex; align-items:center; justify-content:center; height:100%; font-size:1.5rem;">📷</div>
                </div>
            `;
        }).join('');
    }
