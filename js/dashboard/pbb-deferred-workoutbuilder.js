let customWorkoutSelection = [];

function openWorkoutBuilder() {
    customWorkoutSelection = []; // Reset on open
    window.currentBuilderWorkoutName = null; // Reset name so a fresh name is prompted
    document.getElementById('builder-search').value = '';
    filterExerciseLibrary('');
    updateBuilderUI();
    hideAllAppViews();
    document.getElementById('view-workout-builder').style.display = 'block';
    document.querySelector('.bottom-nav').style.display = 'none';

    // Push navigation state for Android back button
    if (typeof pushNavigationState === 'function') {
        pushNavigationState('view-workout-builder', () => switchAppTab('movement-tab'));
    }
}

// Initialize filter state
if (typeof window.activeFilters === 'undefined') {
    window.activeFilters = {
        workoutType: [],
        equipment: [],
        muscle: []
    };
}

// Toggle filter chip
function toggleFilter(category, value) {
    const filters = window.activeFilters[category];
    const index = filters.indexOf(value);

    // Find the button element
    const btn = document.querySelector(`.filter-chip[data-category="${category}"][data-value="${value}"]`);

    if (index > -1) {
        // Remove filter
        filters.splice(index, 1);
        btn.style.background = 'white';
        btn.style.color = '#64748b';
        btn.style.borderColor = '#e2e8f0';
    } else {
        // Add filter
        filters.push(value);
        btn.style.background = 'var(--primary)';
        btn.style.color = 'white';
        btn.style.borderColor = 'var(--primary)';
    }

    // Show/hide clear button
    const hasActiveFilters = Object.values(window.activeFilters).some(arr => arr.length > 0);
    document.getElementById('clear-filters-btn').style.display = hasActiveFilters ? 'block' : 'none';

    // Re-run filter
    filterExerciseLibrary(document.getElementById('builder-search').value);
}

// Clear all filters
function clearAllFilters() {
    window.activeFilters = {
        workoutType: [],
        equipment: [],
        muscle: []
    };

    // Reset all filter chip styles
    document.querySelectorAll('.filter-chip').forEach(btn => {
        btn.style.background = 'white';
        btn.style.color = '#64748b';
        btn.style.borderColor = '#e2e8f0';
    });

    // Hide clear button
    document.getElementById('clear-filters-btn').style.display = 'none';

    // Re-run filter
    filterExerciseLibrary(document.getElementById('builder-search').value);
}

// Toggle filter section expand/collapse
function toggleFilterSection(sectionId) {
    const content = document.getElementById(`filter-content-${sectionId}`);
    const chevron = document.getElementById(`chevron-${sectionId}`);

    if (content.style.display === 'none') {
        content.style.display = 'block';
        chevron.style.transform = 'rotate(180deg)';
    } else {
        content.style.display = 'none';
        chevron.style.transform = 'rotate(0deg)';
    }
}

// Check if exercise matches category filter
function matchesFilter(exerciseName) {
    const nameLower = exerciseName.toLowerCase();

    // Check workout type filters
    if (window.activeFilters.workoutType.length > 0) {
        const matchesWorkoutType = window.activeFilters.workoutType.some(type => {
            if (type === 'yoga') return nameLower.includes('yoga');
            if (type === 'pilates') return nameLower.includes('pilates');
            if (type === 'cardio') return nameLower.includes('sprint') || nameLower.includes('run') || nameLower.includes('jump') || nameLower.includes('hop') || nameLower.includes('burpee');
            if (type === 'stretch') return nameLower.includes('stretch') || nameLower.includes('foam roller');
            return false;
        });
        if (!matchesWorkoutType) return false;
    }

    // Check equipment filters
    if (window.activeFilters.equipment.length > 0) {
        const matchesEquipment = window.activeFilters.equipment.some(equip => {
            if (equip === 'dumbbell') return nameLower.includes('dumbbell');
            if (equip === 'barbell') return nameLower.includes('barbell');
            if (equip === 'cable') return nameLower.includes('cable');
            if (equip === 'band') return nameLower.includes('band') || nameLower.includes('miniband');
            if (equip === 'kettlebell') return nameLower.includes('kettlebell');
            if (equip === 'machine') return nameLower.includes('machine');
            if (equip === 'bodyweight') {
                // Bodyweight = doesn't contain any equipment keywords
                return !nameLower.includes('dumbbell') &&
                       !nameLower.includes('barbell') &&
                       !nameLower.includes('cable') &&
                       !nameLower.includes('band') &&
                       !nameLower.includes('kettlebell') &&
                       !nameLower.includes('machine') &&
                       !nameLower.includes('ball') &&
                       !nameLower.includes('trx') &&
                       !nameLower.includes('sled');
            }
            return false;
        });
        if (!matchesEquipment) return false;
    }

    // Check muscle group filters
    if (window.activeFilters.muscle.length > 0) {
        const matchesMuscle = window.activeFilters.muscle.some(muscle => {
            if (muscle === 'chest') return nameLower.includes('chest') || nameLower.includes('pec') || (nameLower.includes('press') && (nameLower.includes('bench') || nameLower.includes('floor')));
            if (muscle === 'back') return nameLower.includes('back') || nameLower.includes('lat') || nameLower.includes('row') || nameLower.includes('pull up') || nameLower.includes('pullup');
            if (muscle === 'shoulders') return nameLower.includes('shoulder') || nameLower.includes('delt') || nameLower.includes('raise') || nameLower.includes('overhead press');
            if (muscle === 'arms') return nameLower.includes('bicep') || nameLower.includes('tricep') || nameLower.includes('curl') || nameLower.includes('extension') && !nameLower.includes('leg') && !nameLower.includes('back');
            if (muscle === 'core') return nameLower.includes('ab') || nameLower.includes('core') || nameLower.includes('crunch') || nameLower.includes('plank') || nameLower.includes('oblique');
            if (muscle === 'legs') return nameLower.includes('squat') || nameLower.includes('lunge') || nameLower.includes('leg') || nameLower.includes('quad') || nameLower.includes('hamstring') || nameLower.includes('calf');
            if (muscle === 'glutes') return nameLower.includes('glute') || nameLower.includes('hip') || nameLower.includes('kickback');
            return false;
        });
        if (!matchesMuscle) return false;
    }

    return true;
}

function filterExerciseLibrary(query) {
    const list = document.getElementById('builder-library-list');
    if (!list) {
        console.error("Builder library list element not found!");
        return;
    }
    list.innerHTML = '';

    // Safety check for library loading
    if (typeof EXERCISE_VIDEOS === 'undefined') {
        list.innerHTML = `
            <div style="padding:20px; text-align:center; color:red; background:#fee2e2; border-radius:12px;">
                <strong>Error: Exercise Library Not Loaded</strong><br>
                <div style="font-size:0.8rem; margin-top:5px;">Please verify 'exercise_videos.js' file exists and is in the same folder.</div>
            </div>`;
        return;
    }

    // Global or scoped state for pagination
    if(typeof window.builderLimit === 'undefined') window.builderLimit = 50;

    const terms = query.toLowerCase().split(' ').filter(t => t);

    const allKeys = Object.keys(EXERCISE_VIDEOS);
    if (allKeys.length === 0) {
        list.innerHTML = '<div style="padding:20px; text-align:center;">Library is empty.</div>';
        return;
    }

    // 1. Gather Matches (search query + category filters)
    const matchedKeys = [];
    for (let key of allKeys) {
        const keyLower = key.toLowerCase();

        // Check search query
        let matchesQuery = true;
        if (terms.length > 0) {
            for (let term of terms) {
                if (!keyLower.includes(term)) {
                    matchesQuery = false;
                    break;
                }
            }
        }

        // Check category filters
        const matchesCategories = matchesFilter(key);

        if (matchesQuery && matchesCategories) {
            matchedKeys.push(key);
        }
    }

    // 2. Sort by relevance score if there's a search query
    if (terms.length > 0) {
        matchedKeys.sort((a, b) => {
            const scoreA = scoreExerciseMatch(a, terms, query);
            const scoreB = scoreExerciseMatch(b, terms, query);
            return scoreB - scoreA;
        });
    }

    // 3. Render Selection
    const keysToRender = matchedKeys.slice(0, window.builderLimit);

    keysToRender.forEach(key => {
        const isSelected = customWorkoutSelection.includes(key);
        const div = document.createElement('div');
        div.style.cssText = `background:white; border:1px solid ${isSelected ? 'var(--primary)' : '#f1f5f9'}; padding:15px; border-radius:16px; display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; min-height:60px;`;
        if(isSelected) div.style.background = '#f0fdf4';

        div.innerHTML = `
            <div style="font-weight:600; font-size:0.95rem; color:var(--text-main); flex:1; padding-right:10px;">${key}</div>
            <button onclick="toggleBuilderItem(this, '${key.replace(/'/g, "\\'")}')" style="width:32px; height:32px; border-radius:50%; border:none; background:${isSelected ? 'var(--primary)' : '#f1f5f9'}; color:${isSelected ? 'white' : '#94a3b8'}; display:flex; align-items:center; justify-content:center; cursor:pointer;">
                ${isSelected ? '✓' : '+'}
            </button>
        `;
        list.appendChild(div);
    });

    // 4. Load More Button
    if (matchedKeys.length > window.builderLimit) {
        const moreDiv = document.createElement('div');
        moreDiv.innerHTML = `<button onclick="window.builderLimit += 50; filterExerciseLibrary(document.getElementById('builder-search').value)" style="width:100%; padding:15px; border:none; background:#f1f5f9; color:var(--text-muted); font-weight:600; border-radius:12px; cursor:pointer;">Load More (${matchedKeys.length - window.builderLimit} remaining)</button>`;
        list.appendChild(moreDiv);
    }

    if (matchedKeys.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">No exercises found</div>';
    }
}

// Ensure limit reset on open
const originalOpenBuilder = window.openWorkoutBuilder;
window.openWorkoutBuilder = function() {
    window.builderLimit = 50;
    if(originalOpenBuilder) originalOpenBuilder(); // Recursion risk if defined by name? 
    // Wait, openWorkoutBuilder is defined above. We should edit it directly or just resetting global var here is risky.
    // Better: Update openWorkoutBuilder in a separate chunk or rely on the input handler resetting it?
    // Let's simple check: if query length < previous query? No.
    // I'll just Replace openWorkoutBuilder in a separate edit or use MultiReplace.
};

function toggleBuilderItem(btn, key) {
    const index = customWorkoutSelection.indexOf(key);
    const parent = btn.parentElement;
    
    if (index > -1) {
        customWorkoutSelection.splice(index, 1);
        parent.style.borderColor = '#f1f5f9';
        parent.style.background = 'white';
        btn.style.background = '#f1f5f9';
        btn.style.color = '#94a3b8';
        btn.innerHTML = '+';
    } else {
        customWorkoutSelection.push(key);
        parent.style.borderColor = 'var(--primary)';
        parent.style.background = '#f0fdf4';
        btn.style.background = 'var(--primary)';
        btn.style.color = 'white';
        btn.innerHTML = '✓';
    }
    updateBuilderUI();
}

function updateBuilderUI() {
    const floatAction = document.getElementById('builder-floating-action');
    const countSpan = document.getElementById('builder-count');
    
    if (customWorkoutSelection.length > 0) {
        floatAction.style.display = 'block';
        countSpan.innerText = customWorkoutSelection.length;
    } else {
        floatAction.style.display = 'none';
    }
}

async function startCustomBuilderWorkout() {
    if (customWorkoutSelection.length === 0) return;

    // Reuse name if already set by the SAVE button, otherwise prompt once
    const workoutName = window.currentBuilderWorkoutName || prompt("Name your workout:");
    if (!workoutName) return; // User cancelled
    window.currentBuilderWorkoutName = workoutName;

    // Auto-save the workout to database
    const user = window.currentUser;
    if (user) {
        try {
            const savedWorkout = await dbHelpers.workouts.saveCustomWorkout(user.id, workoutName, {
                exercises: customWorkoutSelection,
                date: new Date().toISOString()
            });
            // Track the workout ID so any added exercises get saved back
            window.currentCustomWorkoutId = savedWorkout?.id || null;
            window.currentWorkoutName = workoutName;
            // Refresh the cache
            const savedWorkouts = await dbHelpers.workouts.getCustomWorkouts(user.id);
            window.savedWorkoutsCache = savedWorkouts;
            // Preload workout history for previous stats and volume tracking
            const rawHistory1 = await dbHelpers.workouts.getHistory(user.id);
            window.workoutHistoryCache = normalizeHistoryCache(rawHistory1);
        } catch(e) {
            console.error("Failed to auto-save workout:", e);
            window.currentCustomWorkoutId = null;
        }
    }

    // Preload personal bests for all exercises in this workout
    if (user) {
        try {
            window.personalBestsCache = await dbHelpers.personalBests.getForExercises(user.id, customWorkoutSelection);
        } catch(e) { console.error("Failed to load personal bests", e); window.personalBestsCache = {}; }
    }

    // Construct a dynamic workout object
    const customWorkout = {
        title: workoutName,
        name: workoutName,
        description: 'Your personalized session',
        exercises: customWorkoutSelection.map(key => ({
            name: key,
            sets: 3,
            reps: '12',
            videoUrl: '', // Will be looked up
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
        card.className = 'exercise-logger-card'; // Required for addWorkoutSet to find parent
        card.setAttribute('data-exercise-name', ex.name);
        card.setAttribute('data-is-user-added', 'false');
        card.style.cssText = "background:white; border-radius:24px; box-shadow:0 10px 30px rgba(0,0,0,0.05); margin-bottom:25px; overflow:hidden; border:1px solid #f1f5f9;";

        const videoUrl = findVideoMatch(ex.name);
        const previousSummaryHtml = formatPreviousWorkoutSummary(ex.name);
        const previousSummary = getPreviousWorkoutSummary(ex.name);
        const escapedName = ex.name.replace(/'/g, "\\'");

        card.innerHTML = `
            <div style="padding: 15px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <h3 style="margin: 0 0 5px 0; font-size: 1.05rem; font-weight: 700; color: var(--text-main);">${ex.name}</h3>
                <div style="color: var(--text-muted); font-size: 0.85rem;">Custom Exercise</div>
                ${previousSummaryHtml}
            </div>

            ${videoUrl ? `
            <div data-video-container style="position: relative; width: 100%; padding-top: 56.25%; background: black; cursor: pointer;" onclick="playInlineVideo(event, '${videoUrl}')">
                <video style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;" preload="metadata" muted playsinline>
                    <source src="${videoUrl}" type="video/mp4">
                </video>
                <div class="inline-play-overlay" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 60px; height: 60px; background: rgba(255,255,255,0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                    <svg viewBox="0 0 24 24" style="width: 30px; height: 30px; fill: var(--primary); margin-left: 3px;">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                </div>
            </div>` : ''}

            <!-- Volume Tracker -->
            <div class="volume-display" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%); border-bottom: 1px solid #fef08a;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: #ca8a04;"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
                    <span style="font-size: 0.75rem; font-weight: 700; color: #a16207; text-transform: uppercase;">Volume</span>
                </div>
                <div style="text-align: right;">
                    <div class="volume-value" style="font-size: 1rem; font-weight: 800; color: #854d0e;">0 kg</div>
                    <div class="volume-comparison" style="font-size: 0.7rem; font-weight: 600;">${previousSummary && previousSummary.totalVolume > 0 ? `<span style="color: #94a3b8;">Last: ${previousSummary.totalVolume.toLocaleString()} kg — beat it!</span>` : '<span style="color: #94a3b8;">Enter weight & reps</span>'}</div>
                </div>
                <div class="volume-progress-container" style="display: ${previousSummary && previousSummary.totalVolume > 0 ? 'block' : 'none'}; margin-top: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span class="volume-target-label" style="font-size: 0.65rem; font-weight: 600; color: #a16207;">Target: ${previousSummary && previousSummary.totalVolume > 0 ? previousSummary.totalVolume.toLocaleString() + ' kg' : '—'}</span>
                        <span class="volume-percentage" style="font-size: 0.65rem; font-weight: 700; color: #a16207;">0%</span>
                    </div>
                    <div style="height: 6px; background: #fef08a; border-radius: 3px; overflow: hidden;">
                        <div class="volume-progress-bar" style="height: 100%; width: 0%; background: #ca8a04; border-radius: 3px; transition: width 0.3s ease, background 0.3s ease;"></div>
                    </div>
                </div>
            </div>

            <div style="display:grid; grid-template-columns:40px 1fr 1fr 1fr 32px 32px; gap:8px; padding:10px 15px 0 15px; font-size:0.7rem; color:#94a3b8; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; text-align:center;">
                <div>Set</div><div>Time</div><div>Reps</div><div>Kg</div><div></div><div></div>
            </div>

            <div class="sets-list-container">
                ${(() => {
                    const numSets = previousSummary && previousSummary.setCount > 0 ? previousSummary.setCount : ex.sets;
                    return Array.from({length: numSets}, (_, setIdx) => {
                        const prevSet = previousSummary && previousSummary.sets[setIdx] ? previousSummary.sets[setIdx] : null;
                        const prefillKg = prevSet && prevSet.kg && prevSet.kg !== '0' && prevSet.kg !== '' ? prevSet.kg : '';
                        const prefillReps = prevSet && prevSet.reps ? prevSet.reps : '';
                        const hasPrefill = prefillKg || prefillReps;
                        return `
                        <div class="set-wrapper"${hasPrefill ? ' data-prefilled="true"' : ''}>
                            <div class="workout-set-row" style="display: grid; grid-template-columns: 40px 1fr 1fr 1fr 32px 32px; gap: 8px; align-items: center; padding: 10px 15px; border-top: 1px solid #f8fafc;">
                                <div class="set-number" style="font-weight: 800; color: #94a3b8; font-size: 0.85rem; text-align: center;">${setIdx + 1}</div>
                                <input type="text" class="input-time" placeholder="-" data-exercise="${ex.name}" data-set="${setIdx + 1}" data-field="time" style="width:100%; border: none; background: #f8fafc; border-radius: 8px; padding: 10px 5px; text-align: center; font-weight: 700; color: var(--text-main); font-size: 0.9rem;">
                                <input type="text" class="input-reps" placeholder="Reps" value="${prefillReps}" data-exercise="${ex.name}" data-set="${setIdx + 1}" data-field="reps" style="width:100%; border: none; background: #f8fafc; border-radius: 8px; padding: 10px 5px; text-align: center; font-weight: 700; color: var(--text-main); font-size: 0.9rem;">
                                <input type="text" class="input-kg" placeholder="Kg" value="${prefillKg}" data-exercise="${ex.name}" data-set="${setIdx + 1}" data-field="weight" style="width:100%; border: none; background: #f8fafc; border-radius: 8px; padding: 10px 5px; text-align: center; font-weight: 700; color: var(--text-main); font-size: 0.9rem;">
                                <button class="drop-set-toggle" onclick="toggleDropSet(this)" title="Toggle Drop Set">DS</button>
                                <button class="delete-set-btn" onclick="deleteSetRow(this)" title="Delete Set" style="width:32px; height:32px; border:none; background:transparent; color:#ef4444; cursor:pointer; border-radius:8px; display:flex; align-items:center; justify-content:center; transition:background 0.2s;"><svg viewBox="0 0 24 24" style="width:16px; height:16px; fill:currentColor;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
                            </div>
                            <div class="drop-set-container">
                                <div class="drop-set-inputs">
                                    <div class="drop-set-row">
                                        <div class="drop-indicator">↓1</div>
                                        <input type="text" class="drop-reps" placeholder="Reps">
                                        <input type="text" class="drop-kg" placeholder="Kg">
                                        <button class="drop-add-btn" onclick="addDropRow(this)">+</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `}).join('');
                })()}
            </div>

            <div style="padding:15px; border-top:1px solid #f8fafc;">
                <button onclick="addWorkoutSet(this, '${ex.name.replace(/'/g, "\\'")}', false)" style="width:100%; background:transparent; border:2px dashed #e2e8f0; color:#94a3b8; font-weight:700; font-size:0.8rem; padding:12px; border-radius:12px; cursor:pointer;">+ ADD SET</button>
            </div>
        `;
        list.appendChild(card);

        // Setup volume tracking for this card
        setupVolumeTracking(card);
    });

    hideAllAppViews();
    document.getElementById('view-active-workout').style.display = 'block';
    startWorkoutTimer();

    // Push navigation state for Android back button
    pushNavigationState('view-active-workout', () => quitWorkout());

    // Show total volume popup and tracker
    showLastVolumePopup();

}