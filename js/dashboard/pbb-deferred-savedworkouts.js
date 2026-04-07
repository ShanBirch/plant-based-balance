async function startSavedWorkout(id) {
        // Use cache populated by renderMovementView (205 lines — deferred on iOS)
        const saved = window.savedWorkoutsCache || [];
        const workout = saved.find(w => w.id === id);
        if(!workout) return;

        // Track current custom workout ID so we can update it later with added exercises
        window.currentCustomWorkoutId = id;
        window.currentWorkoutName = workout.template_name || 'Custom Workout';

        // Preload workout history for previous stats and volume tracking
        const user = window.currentUser;
        if (user) {
            try {
                const rawHistory3 = await dbHelpers.workouts.getHistory(user.id);
                window.workoutHistoryCache = normalizeHistoryCache(rawHistory3);
            } catch(e) {
                console.error("Failed to load workout history", e);
            }
        }

        // Preload personal bests
        const exerciseNames = workout.template_data?.exercises || [];
        if (user) {
            try {
                window.personalBestsCache = await dbHelpers.personalBests.getForExercises(user.id, exerciseNames);
            } catch(e) { console.error("Failed to load personal bests", e); window.personalBestsCache = {}; }
        }

        // Map DB format to Player format
        // workout.template_data.exercises is array of strings (names)

        const customWorkout = {
            title: workout.template_name || 'Custom Workout',
            name: workout.template_name || 'Custom Workout',
            description: 'Saved Session • ' + new Date(workout.created_at || new Date()).toLocaleDateString(),
            exercises: exerciseNames.map(key => ({
                name: key,
                sets: 3,
                reps: '12',
                videoUrl: '',
                desc: ''
            }))
        };

        // Hijack the player
        document.getElementById('workout-player-title').innerText = customWorkout.title;
        document.getElementById('workout-player-goal').innerText = customWorkout.description;

        const list = document.getElementById('workout-exercises-list');
        list.innerHTML = '';

        customWorkout.exercises.forEach((ex, idx) => {
            const card = document.createElement('div');
            card.className = 'exercise-logger-card';
            card.setAttribute('data-exercise-name', ex.name);
            card.setAttribute('data-is-user-added', 'false');
            card.style.cssText = "background:white; border-radius:24px; box-shadow:0 10px 30px rgba(0,0,0,0.05); margin-bottom:25px; overflow:hidden; border:1px solid #f1f5f9;";
            const videoUrl = findVideoMatch(ex.name);
            const previousSummaryHtml = formatPreviousWorkoutSummary(ex.name);
            const previousSummary = getPreviousWorkoutSummary(ex.name);
            const escapedName = ex.name.replace(/'/g, "\\'");
            const numSets = previousSummary && previousSummary.setCount > 0 ? previousSummary.setCount : 3;
            const setsHtml = Array.from({length: numSets}, (_, i) => {
                const prevSet = previousSummary && previousSummary.sets[i] ? previousSummary.sets[i] : null;
                return getSetRowHtml(ex.name, i + 1, false, prevSet);
            }).join('');

            card.innerHTML = `
            <div style="padding:15px; background:#f8fafc; border-bottom:1px solid #e2e8f0;">
                <h3 style="margin:0 0 5px 0; font-size:1.05rem; font-weight:700; color:var(--text-main);">${ex.name}</h3>
                <div style="font-size:0.8rem; color:var(--text-muted);">Target: ${numSets} Sets x 12 Reps</div>
                ${previousSummaryHtml}
            </div>

            ${videoUrl ? `
            <div data-video-container style="position:relative; width:100%; padding-top:56.25%; background:black; cursor:pointer;" onclick="playInlineVideo(event, '${videoUrl}')">
                <video style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover;" preload="metadata" muted playsinline>
                    <source src="${videoUrl}" type="video/mp4">
                </video>
                <div class="inline-play-overlay" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); width:60px; height:60px; background:rgba(255,255,255,0.9); border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 10px rgba(0,0,0,0.3);">
                    <svg viewBox="0 0 24 24" style="width:30px; height:30px; fill:var(--primary); margin-left:3px;">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                </div>
            </div>` : ''}

            ${getVolumeDisplayHtml(ex.name)}

            <div style="display:grid; grid-template-columns:40px 1fr 1fr 1fr 32px 32px; gap:8px; padding:10px 15px 0 15px; font-size:0.7rem; color:#94a3b8; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; text-align:center;">
                <div>Set</div><div>Time</div><div>Reps</div><div>Kg</div><div></div><div></div>
            </div>

            <div class="sets-list-container">
                ${setsHtml}
            </div>

            <div style="padding:15px; border-top:1px solid #f8fafc;">
                <button onclick="addWorkoutSet(this, '${escapedName}', false)" style="width:100%; background:transparent; border:2px dashed #e2e8f0; color:#94a3b8; font-weight:700; font-size:0.8rem; padding:12px; border-radius:12px; cursor:pointer;">+ ADD SET</button>
            </div>`;
            list.appendChild(card);

            // Setup volume tracking for this card
            setupVolumeTracking(card);
        });

        hideAllAppViews();
        document.getElementById('view-active-workout').style.display = 'block';
        window.activeWorkoutSessions = customWorkout;

        // Start the workout timer
        startWorkoutTimer();

        // Push navigation state for Android back button
        pushNavigationState('view-active-workout', () => quitWorkout());

        // Show total volume popup and tracker
        showLastVolumePopup();
    }

    async function showWorkoutHistoryDetail(dateStr) {
        // Fetch workout history for this specific date
        const user = window.currentUser;
        if (!user) return;

        try {
            const { data, error } = await window.supabaseClient
                .from('workouts')
                .select('exercise_name, set_number, reps, weight_kg, time_duration')
                .eq('user_id', user.id)
                .eq('workout_type', 'history')
                .eq('workout_date', dateStr)
                .order('exercise_name')
                .order('set_number');

            if (error) throw error;
            if (!data || data.length === 0) {
                alert('No workout data found for this date.');
                return;
            }

            // Group by exercise
            const exercises = {};
            data.forEach(row => {
                if (!exercises[row.exercise_name]) {
                    exercises[row.exercise_name] = [];
                }
                exercises[row.exercise_name].push(row);
            });

            // Format date for display
            const dateObj = new Date(dateStr + 'T00:00:00');
            const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

            // Build modal content
            let content = `
            <div class="workout-summary-modal" style="position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;" onclick="if(event.target === this) this.remove();">
                <div style="background:white; border-radius:24px; max-width:400px; width:100%; max-height:80vh; overflow-y:auto; box-shadow:0 25px 50px rgba(0,0,0,0.25);">
                    <div style="padding:25px; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <h2 style="margin:0 0 5px 0; font-size:1.3rem; color:var(--text-main);">Workout Summary</h2>
                            <div style="font-size:0.85rem; color:var(--text-muted);">${formattedDate}</div>
                        </div>
                        <button onclick="this.closest('.workout-summary-modal').remove()" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:var(--text-muted);">&times;</button>
                    </div>
                    <div style="padding:20px;">
            `;

            Object.entries(exercises).forEach(([name, sets]) => {
                content += `
                    <div style="margin-bottom:20px;">
                        <h4 style="margin:0 0 10px 0; font-size:0.95rem; color:var(--primary);">${name}</h4>
                        <div style="background:#f8fafc; border-radius:12px; padding:10px;">
                `;
                sets.forEach(set => {
                    const weightDisplay = set.weight_kg ? `${set.weight_kg} kg` : '-';
                    const repsDisplay = set.reps || '-';
                    const timeDisplay = set.time_duration || '';
                    content += `
                        <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #e2e8f0; font-size:0.85rem;">
                            <span style="color:var(--text-muted);">Set ${set.set_number}</span>
                            <span style="color:var(--text-main);">${weightDisplay} × ${repsDisplay} reps${timeDisplay ? ' • ' + timeDisplay : ''}</span>
                        </div>
                    `;
                });
                content += `
                        </div>
                    </div>
                `;
            });

            content += `
                    </div>
                </div>
            </div>
            `;

            document.body.insertAdjacentHTML('beforeend', content);
        } catch (err) {
            console.error('Failed to load workout history detail:', err);
            alert('Failed to load workout details.');
        }
    }