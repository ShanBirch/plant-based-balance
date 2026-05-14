// Program Builder State
let programBuilderState = {
    name: '',
    durationWeeks: 4,
    weeklySchedule: [
        { day: 'Mon', workout: null },
        { day: 'Tue', workout: null },
        { day: 'Wed', workout: null },
        { day: 'Thu', workout: null },
        { day: 'Fri', workout: null },
        { day: 'Sat', workout: null },
        { day: 'Sun', workout: null }
    ],
    currentPickerDayIndex: null
};

// Day names for display
const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ============================================
// WORKOUT PREVIEW FEATURE (Simplified)
// ============================================

// Workout Preview State
let workoutPreviewState = {
    mode: null, // 'replacement' or 'programBuilder'
    category: null,
    subcategory: null,
    subcategoryName: null,
    icon: null,
    selectedWorkout: null,
    allWorkouts: []
};

// Open variations list when clicking a subcategory
window.openWorkoutPreview = function(mode, categoryKey, subcategoryKey, subcategoryName, icon) {
    const category = WORKOUT_LIBRARY[categoryKey];
    if (!category || !category.subcategories) return;

    const subcategory = category.subcategories[subcategoryKey];
    if (!subcategory || !subcategory.workouts || subcategory.workouts.length === 0) {
        showToast('No workouts available for this category');
        return;
    }

    // Store state
    workoutPreviewState = {
        mode: mode,
        category: categoryKey,
        subcategory: subcategoryKey,
        subcategoryName: subcategoryName,
        icon: icon,
        selectedWorkout: null,
        allWorkouts: subcategory.workouts
    };

    // Update title
    document.getElementById('variations-modal-title').textContent = subcategoryName;

    // Render variations list
    const container = document.getElementById('variations-list');
    container.innerHTML = subcategory.workouts.map((workout, index) => `
        <div onclick="openExercisesList(${index})" style="background: white; border-radius: 16px; padding: 16px; cursor: pointer; display: flex; align-items: center; gap: 12px; border: 1px solid #f1f5f9;">
            <div style="width: 44px; height: 44px; background: #f1f5f9; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.3rem;">
                ${icon}
            </div>
            <div style="flex: 1;">
                <div style="font-weight: 600; color: var(--text-main);">${workout.name}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">${workout.exercises?.length || 0} exercises · ${workout.duration || '45 min'}</div>
            </div>
            <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: #94a3b8;"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
        </div>
    `).join('');

    // Hide previous modals
    if (mode === 'replacement') {
        document.getElementById('replacement-subcategory-modal').style.display = 'none';
    } else if (mode === 'programBuilder') {
        document.getElementById('workout-subcategory-picker').style.display = 'none';
    }

    // Show variations modal
    document.getElementById('workout-variations-modal').style.display = 'flex';
};

// Open exercises list for a specific workout
window.openExercisesList = function(workoutIndex) {
    const workout = workoutPreviewState.allWorkouts[workoutIndex];
    if (!workout) return;

    workoutPreviewState.selectedWorkout = workout;

    // Update title
    document.getElementById('exercises-modal-title').textContent = workout.name;

    // Update workout info
    document.getElementById('exercises-duration').innerHTML = `
        <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: var(--text-muted);"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
        <span>${workout.duration || '45 min'}</span>
    `;
    document.getElementById('exercises-difficulty').textContent = workout.difficulty || 'Intermediate';

    // Render exercises
    const container = document.getElementById('exercises-list');
    const exercises = workout.exercises || [];

    container.innerHTML = exercises.map((ex, index) => `
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; display: flex; align-items: center; gap: 12px;">
            <div style="width: 32px; height: 32px; background: linear-gradient(135deg, var(--primary), #22c55e); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 0.85rem; flex-shrink: 0;">
                ${index + 1}
            </div>
            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 600; color: var(--text-main); font-size: 0.95rem;">${ex.name}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">${ex.sets} sets × ${ex.reps}</div>
            </div>
        </div>
    `).join('');

    // Update button text
    const btn = document.getElementById('select-workout-btn');
    btn.textContent = workoutPreviewState.mode === 'replacement' ? 'Select This Workout' : 'Add This Workout';

    // Hide variations modal and show exercises modal
    document.getElementById('workout-variations-modal').style.display = 'none';
    document.getElementById('workout-exercises-modal').style.display = 'flex';
};

// Close variations modal and go back to subcategory
window.closeVariationsModal = function() {
    document.getElementById('workout-variations-modal').style.display = 'none';

    // Re-open the subcategory modal
    if (workoutPreviewState.mode === 'replacement') {
        document.getElementById('replacement-subcategory-modal').style.display = 'flex';
    } else if (workoutPreviewState.mode === 'programBuilder') {
        document.getElementById('workout-subcategory-picker').style.display = 'flex';
    }
};

// Close exercises modal and go back to variations
window.closeExercisesModal = function() {
    document.getElementById('workout-exercises-modal').style.display = 'none';
    document.getElementById('workout-variations-modal').style.display = 'flex';
};

// Close all preview-related modals
window.closeAllVariationsModals = function() {
    document.getElementById('workout-exercises-modal').style.display = 'none';
    document.getElementById('workout-variations-modal').style.display = 'none';
    document.getElementById('replacement-subcategory-modal').style.display = 'none';
    document.getElementById('replacement-picker-modal').style.display = 'none';
    document.getElementById('calendar-activity-modal').style.display = 'none';
    document.getElementById('workout-subcategory-picker').style.display = 'none';
    document.getElementById('workout-picker-modal').style.display = 'none';
    document.getElementById('calendar-workout-action-modal').style.display = 'none';
};

// Select the previewed workout
window.selectPreviewedWorkout = function() {
    const { mode, subcategoryName, category, subcategory, icon } = workoutPreviewState;

    // Close all modals
    closeAllVariationsModals();

    if (mode === 'replacement') {
        // For replacement mode, proceed to duration picker
        selectReplacementWorkout('library', subcategoryName, {
            category: category,
            subcategory: subcategory,
            icon: icon
        });
    } else if (mode === 'programBuilder') {
        // For program builder mode, select the workout for the day
        selectWorkoutForDay('library', subcategoryName, {
            category: category,
            subcategory: subcategory,
            icon: icon
        });
    }
};

// ============================================
// END WORKOUT PREVIEW FEATURE
// ============================================

function openProgramBuilder() {
    // Reset state
    programBuilderState = {
        name: '',
        durationWeeks: 4,
        weeklySchedule: [
            { day: 'Mon', workout: null },
            { day: 'Tue', workout: null },
            { day: 'Wed', workout: null },
            { day: 'Thu', workout: null },
            { day: 'Fri', workout: null },
            { day: 'Sat', workout: null },
            { day: 'Sun', workout: null }
        ],
        currentPickerDayIndex: null
    };

    // Reset UI
    document.getElementById('program-name-input').value = '';
    selectProgramDuration(4);
    renderWeeklyScheduleBuilder();
    updateSaveButtonState();

    // Show view
    hideAllAppViews();
    document.getElementById('view-program-builder').style.display = 'block';
    document.querySelector('.bottom-nav').style.display = 'none';

    if (typeof pushNavigationState === 'function') {
        pushNavigationState('view-program-builder', () => closeProgramBuilder());
    }
}

function closeProgramBuilder() {
    document.getElementById('view-program-builder').style.display = 'none';
    closeWorkoutPicker();
    closeSubcategoryPicker();
    switchAppTab('movement-tab');
}

function selectProgramDuration(weeks) {
    programBuilderState.durationWeeks = weeks;

    // Update UI
    document.querySelectorAll('.duration-btn').forEach(btn => {
        const btnWeeks = parseInt(btn.dataset.weeks);
        if (btnWeeks === weeks) {
            btn.style.borderColor = 'var(--primary)';
            btn.style.background = 'rgba(4, 106, 56, 0.05)';
        } else {
            btn.style.borderColor = '#e2e8f0';
            btn.style.background = 'white';
        }
    });
}

function renderWeeklyScheduleBuilder() {
    const container = document.getElementById('program-weekly-schedule');
    if (!container) return;

    container.innerHTML = programBuilderState.weeklySchedule.map((scheduleItem, index) => {
        const workout = scheduleItem.workout;
        const isRest = workout && workout.type === 'rest';
        const hasWorkout = workout && workout.type !== 'rest';

        let workoutDisplay = '';
        if (isRest) {
            workoutDisplay = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 1.2rem;">😴</span>
                    <span style="font-weight: 600; color: var(--text-muted);">Rest Day</span>
                </div>`;
        } else if (hasWorkout) {
            workoutDisplay = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 1.2rem;">${workout.icon || '💪'}</span>
                    <div>
                        <div style="font-weight: 600; color: var(--text-main); font-size: 0.9rem;">${workout.name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${workout.category || ''}</div>
                    </div>
                </div>`;
        } else {
            workoutDisplay = `
                <div style="color: var(--text-muted); font-size: 0.9rem;">Tap to assign workout</div>`;
        }

        return `
            <div onclick="openWorkoutPickerForDay(${index})" style="background: white; border-radius: 16px; padding: 16px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border: 1px solid ${hasWorkout || isRest ? 'var(--primary)' : '#e2e8f0'}; ${hasWorkout || isRest ? 'border-left: 4px solid var(--primary);' : ''}">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="width: 50px; font-weight: 800; color: var(--primary); font-size: 0.95rem;">${scheduleItem.day}</div>
                    ${workoutDisplay}
                </div>
                <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: #94a3b8; flex-shrink: 0;"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </div>
        `;
    }).join('');
}

function openWorkoutPickerForDay(dayIndex) {
    programBuilderState.currentPickerDayIndex = dayIndex;
    document.getElementById('picker-day-name').textContent = dayNames[dayIndex];

    // Render custom workouts (if any)
    renderPickerActivities();
    renderPickerCustomWorkouts();

    // Render workout categories
    renderWorkoutPickerCategories();

    // Show modal
    const modal = document.getElementById('workout-picker-modal');
    modal.style.display = 'flex';
}

function renderPickerActivities() {
    const container = document.getElementById('picker-activities-list');
    if (!container) return;

    const preferredTypes = ['walking', 'fitness_class', 'pilates', 'yoga', 'running', 'other'];
    const activityTypes = getCalendarActivityTypes()
        .filter(t => preferredTypes.includes(t.key))
        .sort((a, b) => preferredTypes.indexOf(a.key) - preferredTypes.indexOf(b.key));

    container.innerHTML = activityTypes.map(typeInfo => `
        <button type="button" onclick="selectWorkoutForDay('activity', '${typeInfo.label.replace(/'/g, "\\'")}', { activityType: '${typeInfo.key.replace(/'/g, "\\'")}', durationMinutes: 30, intensity: 'moderate', icon: '${String(typeInfo.emoji || '').replace(/'/g, "\\'")}' })"
             style="background: white; border-radius: 14px; padding: 13px 10px; cursor: pointer; display: flex; align-items: center; gap: 10px; border: 1px solid #e2e8f0; text-align: left;">
            <span style="font-size: 1.2rem; min-width: 22px;">${escapeCalendarActivityHtml(typeInfo.emoji || '')}</span>
            <span style="font-weight: 700; color: var(--text-main); font-size: 0.84rem;">${escapeCalendarActivityHtml(typeInfo.label)}</span>
        </button>
    `).join('');
}

async function renderPickerCustomWorkouts() {
    const section = document.getElementById('picker-custom-workouts-section');
    const container = document.getElementById('picker-custom-workouts-list');
    if (!section || !container) return;

    try {
        // Use cached workouts if available, otherwise fetch
        let customWorkouts = window.savedWorkoutsCache;

        if (!customWorkouts) {
            const user = window.currentUser;
            if (user && typeof dbHelpers !== 'undefined' && dbHelpers.workouts) {
                customWorkouts = await dbHelpers.workouts.getCustomWorkouts(user.id);
                window.savedWorkoutsCache = customWorkouts;
            }
        }

        if (!customWorkouts || customWorkouts.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        container.innerHTML = customWorkouts.map(w => {
            const name = w.template_name || 'Untitled Workout';
            const exercises = w.template_data?.exercises || [];

            return `
                <div onclick="selectWorkoutForDay('custom', '${name.replace(/'/g, "\\'")}', { customWorkoutId: '${w.id}', exerciseCount: ${exercises.length} })"
                     style="background: white; border-radius: 16px; padding: 16px; cursor: pointer; display: flex; align-items: center; gap: 12px; border: 1px solid #f1f5f9;">
                    <div style="width: 48px; height: 48px; background: linear-gradient(135deg, var(--primary), #22c55e); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 1rem;">
                        ${name.charAt(0).toUpperCase()}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 700; color: var(--text-main);">${name}</div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">${exercises.length} exercises</div>
                    </div>
                    <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: var(--primary);"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('renderPickerCustomWorkouts: Error', err);
        section.style.display = 'none';
    }
}

function closeWorkoutPicker() {
    document.getElementById('workout-picker-modal').style.display = 'none';
    programBuilderState.currentPickerDayIndex = null;
}

function renderWorkoutPickerCategories() {
    const container = document.getElementById('workout-picker-categories');
    if (!container || typeof WORKOUT_LIBRARY === 'undefined') {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">Workout library not available</div>';
        return;
    }

    const categoryIcons = {
        'gym': '🏋️',
        'yoga': '🧘',
        'bodyweight': '💪',
        'home': '🏠',
        'cardio': '🏃',
        'hiit': '⚡',
        'bands': '🎯'
    };

    const categoryNames = {
        'gym': 'Gym Workouts',
        'yoga': 'Yoga & Recovery',
        'bodyweight': 'Bodyweight',
        'home': 'Home (Dumbbells)',
        'cardio': 'Cardio',
        'hiit': 'HIIT',
        'bands': 'Resistance Bands'
    };

    const categories = Object.keys(WORKOUT_LIBRARY);

    container.innerHTML = categories.map(categoryKey => {
        const category = WORKOUT_LIBRARY[categoryKey];
        const subcategoryCount = Object.keys(category.subcategories || {}).length;

        return `
            <div onclick="openSubcategoryPicker('${categoryKey}')" style="background: white; border-radius: 16px; padding: 16px; cursor: pointer; display: flex; align-items: center; gap: 12px; border: 1px solid #f1f5f9;">
                <div style="width: 48px; height: 48px; background: linear-gradient(135deg, var(--primary), #22c55e); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem;">
                    ${categoryIcons[categoryKey] || '💪'}
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 700; color: var(--text-main);">${categoryNames[categoryKey] || category.name || categoryKey}</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">${subcategoryCount} workout types</div>
                </div>
                <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: #94a3b8;"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </div>
        `;
    }).join('');
}

function openSubcategoryPicker(categoryKey) {
    const category = WORKOUT_LIBRARY[categoryKey];
    if (!category || !category.subcategories) return;

    document.getElementById('subcategory-picker-title').textContent = category.name || categoryKey;

    const container = document.getElementById('workout-subcategory-list');
    const subcategories = category.subcategories;

    const subcategoryIcons = {
        'back': '🔙', 'chest': '💪', 'legs': '🦵', 'shoulders': '🏋️', 'arms': '💪', 'core': '🎯',
        'push': '👐', 'pull': '🤲', 'lowerbody': '🦵', 'upperbody': '💪',
        'power': '⚡', 'yin': '🧘', 'restorative': '😌', 'flow': '🌊',
        'fullbody': '🏃', 'tabata': '🔥', 'armscore': '💪'
    };

    container.innerHTML = Object.keys(subcategories).map(subKey => {
        const sub = subcategories[subKey];
        const workoutCount = sub.workouts?.length || 0;
        const icon = subcategoryIcons[subKey] || '💪';
        const subName = sub.name || subKey;

        return `
            <div onclick="openWorkoutPreview('programBuilder', '${categoryKey}', '${subKey}', '${subName.replace(/'/g, "\\'")}', '${icon}')"
                 style="background: white; border-radius: 16px; padding: 16px; cursor: pointer; display: flex; align-items: center; gap: 12px; border: 1px solid #f1f5f9;">
                <div style="width: 44px; height: 44px; background: #f1f5f9; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.3rem;">
                    ${icon}
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: var(--text-main);">${subName}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${workoutCount} variations</div>
                </div>
                <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: #94a3b8;"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </div>
        `;
    }).join('');

    // Show subcategory picker
    document.getElementById('workout-subcategory-picker').style.display = 'flex';
}

function closeSubcategoryPicker() {
    document.getElementById('workout-subcategory-picker').style.display = 'none';
}

function backToWorkoutPicker() {
    closeSubcategoryPicker();
}

function selectWorkoutForDay(type, name, data) {
    const dayIndex = programBuilderState.currentPickerDayIndex;
    if (dayIndex === null) return;

    if (type === 'rest') {
        programBuilderState.weeklySchedule[dayIndex].workout = {
            type: 'rest',
            name: 'Rest Day'
        };
    } else if (type === 'custom') {
        // Custom workout from user's saved workouts
        programBuilderState.weeklySchedule[dayIndex].workout = {
            type: 'custom',
            name: name,
            customWorkoutId: data?.customWorkoutId || '',
            exerciseCount: data?.exerciseCount || 0,
            icon: '🛠️'
        };
    } else if (type === 'activity') {
        programBuilderState.weeklySchedule[dayIndex].workout = {
            type: 'activity',
            name: name,
            activityType: data?.activityType || 'other',
            durationMinutes: data?.durationMinutes || 30,
            intensity: data?.intensity || 'moderate',
            category: `Activity - ${data?.durationMinutes || 30} min`,
            icon: data?.icon || ''
        };
    } else {
        // Library workout
        programBuilderState.weeklySchedule[dayIndex].workout = {
            type: type,
            name: name,
            category: data?.category || '',
            subcategory: data?.subcategory || '',
            icon: data?.icon || '💪'
        };
    }

    // Update UI
    renderWeeklyScheduleBuilder();
    updateSaveButtonState();

    // Close pickers
    closeSubcategoryPicker();
    closeWorkoutPicker();
}

function updateSaveButtonState() {
    const nameInput = document.getElementById('program-name-input');
    const saveBtn = document.getElementById('save-program-btn');

    const hasName = nameInput.value.trim().length > 0;
    const hasAtLeastOneWorkout = programBuilderState.weeklySchedule.some(s => s.workout !== null);

    if (hasName && hasAtLeastOneWorkout) {
        saveBtn.disabled = false;
        saveBtn.style.opacity = '1';
    } else {
        saveBtn.disabled = true;
        saveBtn.style.opacity = '0.5';
    }
}

// Listen for name input changes
document.getElementById('program-name-input')?.addEventListener('input', function() {
    programBuilderState.name = this.value.trim();
    updateSaveButtonState();
});

async function saveProgramBuilder() {
    const nameInput = document.getElementById('program-name-input');
    const programName = nameInput.value.trim();

    if (!programName) {
        alert('Please enter a program name');
        return;
    }

    const hasWorkouts = programBuilderState.weeklySchedule.some(s => s.workout !== null);
    if (!hasWorkouts) {
        alert('Please assign at least one workout to your program');
        return;
    }

    try {
        const user = window.currentUser;
        if (!user) {
            alert('Please log in to save your program');
            return;
        }

        // Save to database
        const programData = {
            name: programName,
            durationWeeks: programBuilderState.durationWeeks,
            weeklySchedule: programBuilderState.weeklySchedule
        };

        const savedProgram = await dbHelpers.customPrograms.create(user.id, programData);

        // Ask if user wants to activate the program
        const startNow = confirm(`Program "${programName}" saved!\n\nWould you like to start this program now? It will replace your current workout schedule.`);

        if (startNow) {
            await dbHelpers.customPrograms.activate(user.id, savedProgram.id);
            alert(`Program activated! Your ${programBuilderState.durationWeeks}-week program starts today.`);
        }

        // Close and refresh
        closeProgramBuilder();

        if (typeof renderMovementView === 'function') {
            renderMovementView();
        }
        if (typeof renderWeeklyCalendar === 'function') {
            renderWeeklyCalendar();
        }

    } catch (error) {
        console.error('Failed to save program:', error);
        alert('Failed to save program. Please try again.');
    }
}

// Initialize name input listener on page load
document.addEventListener('DOMContentLoaded', function() {
    const nameInput = document.getElementById('program-name-input');
    if (nameInput) {
        nameInput.addEventListener('input', function() {
            programBuilderState.name = this.value.trim();
            updateSaveButtonState();
        });
    }
});

// ============================================================
// WORKOUT REPLACEMENT FEATURE
// ============================================================

// State for workout replacement
let workoutReplacementState = {
    dayIndex: null,           // Day of week being replaced (0 = Monday)
    targetDate: null,         // Local YYYY-MM-DD date for the selected calendar slot
    currentWorkoutName: '',   // Original workout name
    selectedWorkout: null,    // Selected replacement workout
    selectedDuration: null,   // Selected duration in weeks
    currentReplacement: null  // Existing replacement (if any)
};

let calendarActivityState = {
    selectedType: 'walking',
    durationMinutes: 30,
    intensity: 'moderate',
    durationWeeks: 1
};

// Cache for active replacements (refreshed when needed)
let activeReplacementsCache = null;

const CALENDAR_ACTIVITY_FALLBACK_TYPES = [
    { key: 'walking', label: 'Walking', emoji: 'Walk', color: '#059669' },
    { key: 'fitness_class', label: 'Fitness Class', emoji: 'Class', color: '#dc2626' },
    { key: 'pilates', label: 'Pilates', emoji: 'Pilates', color: '#0d9488' },
    { key: 'yoga', label: 'Yoga', emoji: 'Yoga', color: '#c026d3' },
    { key: 'running', label: 'Running', emoji: 'Run', color: '#ea580c' },
    { key: 'other', label: 'Other', emoji: 'Other', color: '#64748b' }
];

function escapeCalendarActivityHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getCalendarActivityTypes() {
    try {
        if (typeof ACTIVITY_TYPES !== 'undefined' && Array.isArray(ACTIVITY_TYPES)) {
            return ACTIVITY_TYPES;
        }
    } catch (e) {}
    return CALENDAR_ACTIVITY_FALLBACK_TYPES;
}

function getCalendarActivityTypeInfo(typeKey) {
    return getCalendarActivityTypes().find(t => t.key === typeKey) || getCalendarActivityTypes().find(t => t.key === 'other') || CALENDAR_ACTIVITY_FALLBACK_TYPES[0];
}

function getCalendarActivityDefaultName(typeKey) {
    const typeInfo = getCalendarActivityTypeInfo(typeKey);
    return typeInfo?.label || 'Activity';
}

function setCalendarActivityButtonStates() {
    document.querySelectorAll('.calendar-activity-type-btn').forEach(btn => {
        const selected = btn.dataset.type === calendarActivityState.selectedType;
        const typeInfo = getCalendarActivityTypeInfo(btn.dataset.type);
        btn.style.border = selected ? `2px solid ${typeInfo.color}` : '1px solid #e2e8f0';
        btn.style.background = selected ? `${typeInfo.color}15` : 'white';
    });

    document.querySelectorAll('.calendar-activity-intensity-btn').forEach(btn => {
        const selected = btn.dataset.intensity === calendarActivityState.intensity;
        btn.style.borderColor = selected ? 'var(--primary)' : '#e2e8f0';
        btn.style.background = selected ? 'rgba(4, 106, 56, 0.08)' : 'white';
    });

    document.querySelectorAll('.calendar-activity-weeks-btn').forEach(btn => {
        const selected = parseInt(btn.dataset.weeks, 10) === calendarActivityState.durationWeeks;
        btn.style.borderColor = selected ? 'var(--primary)' : '#e2e8f0';
        btn.style.background = selected ? 'rgba(4, 106, 56, 0.08)' : 'white';
    });
}

function renderCalendarActivityTypePicker() {
    const grid = document.getElementById('calendar-activity-type-grid');
    if (!grid) return;

    const preferredTypes = ['walking', 'fitness_class', 'pilates', 'yoga', 'running', 'other'];
    const activityTypes = getCalendarActivityTypes()
        .filter(t => preferredTypes.includes(t.key))
        .sort((a, b) => preferredTypes.indexOf(a.key) - preferredTypes.indexOf(b.key));

    grid.innerHTML = activityTypes.map(typeInfo => `
        <button type="button" class="calendar-activity-type-btn" data-type="${escapeCalendarActivityHtml(typeInfo.key)}" onclick="selectCalendarActivityType('${typeInfo.key.replace(/'/g, "\\'")}')" style="padding: 12px 8px; border-radius: 14px; border: 1px solid #e2e8f0; background: white; cursor: pointer; text-align: center;">
            <div style="font-size: 1.35rem; min-height: 28px;">${escapeCalendarActivityHtml(typeInfo.emoji || '')}</div>
            <div style="font-weight: 700; font-size: 0.76rem; color: var(--text-main);">${escapeCalendarActivityHtml(typeInfo.label)}</div>
        </button>
    `).join('');

    setCalendarActivityButtonStates();
}

// Load active replacements from database
async function loadActiveReplacements() {
    try {
        const user = window.currentUser;
        if (!user || !dbHelpers?.workoutReplacements) {
            activeReplacementsCache = [];
            return [];
        }
        activeReplacementsCache = await dbHelpers.workoutReplacements.getActive(user.id);
        return activeReplacementsCache;
    } catch (err) {
        console.error('loadActiveReplacements error:', err);
        activeReplacementsCache = [];
        return [];
    }
}

function normalizeReplacementDateString(value) {
    if (!value) return getLocalDateString();
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    return getLocalDateString(value);
}

function replacementCoversDate(replacement, targetDate) {
    if (!replacement) return false;
    const dateStr = normalizeReplacementDateString(targetDate);
    const startDate = replacement.start_date || dateStr;
    const endDate = replacement.end_date || dateStr;
    return startDate <= dateStr && endDate >= dateStr;
}

// Get replacement for a specific calendar day (from cache)
function getReplacementForDay(dayIndex, targetDate) {
    if (!activeReplacementsCache) return null;
    const dateStr = normalizeReplacementDateString(targetDate);
    return activeReplacementsCache.find(r =>
        r.day_of_week === dayIndex && replacementCoversDate(r, dateStr)
    ) || null;
}

// Open the calendar action modal when clicking a workout on the calendar
window.openCalendarActionModal = async function(dayIndex, workoutName, targetDate) {
    const dateStr = normalizeReplacementDateString(targetDate);
    workoutReplacementState.dayIndex = dayIndex;
    workoutReplacementState.targetDate = dateStr;
    workoutReplacementState.currentWorkoutName = workoutName;
    workoutReplacementState.selectedWorkout = null;
    workoutReplacementState.selectedDuration = null;

    // Update modal title
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    document.getElementById('action-modal-title').textContent = dayNames[dayIndex];
    document.getElementById('action-modal-workout-name').textContent = workoutName;

    // Check for existing replacement
    await loadActiveReplacements();
    const existingReplacement = getReplacementForDay(dayIndex, dateStr);
    workoutReplacementState.currentReplacement = existingReplacement;

    const noticeEl = document.getElementById('action-modal-replacement-notice');
    const removeBtn = document.getElementById('remove-replacement-btn');
    const noticeIcon = document.getElementById('replacement-notice-icon');
    const noticeTitle = document.getElementById('replacement-notice-title');
    const startLabel = document.getElementById('action-modal-start-label');

    if (existingReplacement) {
        const replacementWorkout = existingReplacement.replacement_workout || {};
        const isActivity = replacementWorkout.type === 'activity';
        const isRest = replacementWorkout.type === 'rest';

        // Calculate weeks remaining
        const endDate = new Date(existingReplacement.end_date);
        const today = new Date();
        const msPerWeek = 7 * 24 * 60 * 60 * 1000;
        const weeksRemaining = Math.ceil((endDate - today) / msPerWeek);

        if (noticeIcon) noticeIcon.textContent = isActivity ? (replacementWorkout.icon || 'Activity') : 'Swap';
        if (noticeTitle) noticeTitle.textContent = isActivity ? 'Activity Scheduled' : 'Replacement Active';
        if (startLabel) startLabel.textContent = isActivity ? 'Log Activity' : (isRest ? 'Rest Day' : 'Start Workout');

        document.getElementById('replacement-notice-text').textContent =
            weeksRemaining <= 1 ? 'Ends this week' : `${weeksRemaining} weeks remaining`;
        noticeEl.style.display = 'block';
        removeBtn.style.display = 'flex';
    } else {
        if (noticeIcon) noticeIcon.textContent = 'Swap';
        if (noticeTitle) noticeTitle.textContent = 'Replacement Active';
        if (startLabel) startLabel.textContent = 'Start Workout';
        noticeEl.style.display = 'none';
        removeBtn.style.display = 'none';
    }

    // Show modal
    document.getElementById('calendar-workout-action-modal').style.display = 'flex';
};

// Close the action modal
window.closeCalendarActionModal = function() {
    document.getElementById('calendar-workout-action-modal').style.display = 'none';
    workoutReplacementState.dayIndex = null;
    workoutReplacementState.targetDate = null;
};

// Start workout from action modal (delegates to existing function)
window.startWorkoutFromActionModal = function() {
    // Capture the day index before closing the modal — closeCalendarActionModal
    // resets it to null, which would otherwise make openCalendarWorkout a no-op.
    const dayIndex = workoutReplacementState.dayIndex;
    const targetDate = workoutReplacementState.targetDate;
    closeCalendarActionModal();
    if (typeof openCalendarWorkout === 'function') {
        openCalendarWorkout(dayIndex, targetDate);
    }
};

window.openWorkoutBuilderFromActionModal = async function() {
    closeCalendarActionModal();

    if (typeof openWorkoutBuilderSafe === 'function') {
        await openWorkoutBuilderSafe();
        return;
    }

    if (typeof openWorkoutBuilder === 'function') {
        openWorkoutBuilder();
        return;
    }

    if (typeof showToast === 'function') {
        showToast('Workout builder is loading. Please try again.');
    } else {
        alert('Workout builder is loading. Please try again.');
    }
};

// Open replacement picker
window.openReplacementPicker = function() {
    document.getElementById('calendar-workout-action-modal').style.display = 'none';

    // Render custom workouts
    renderReplacementCustomWorkouts();

    // Render library categories
    renderReplacementCategories();

    document.getElementById('replacement-picker-modal').style.display = 'flex';
};

// Close replacement picker
window.closeReplacementPicker = function() {
    document.getElementById('replacement-picker-modal').style.display = 'none';
    closeReplacementSubcategory();
    closeDurationModal();
};

// Back to action modal from replacement picker
window.backToActionModal = function() {
    document.getElementById('replacement-picker-modal').style.display = 'none';
    document.getElementById('calendar-workout-action-modal').style.display = 'flex';
};

window.openCalendarActivityModal = function() {
    document.getElementById('calendar-workout-action-modal').style.display = 'none';

    calendarActivityState = {
        selectedType: 'walking',
        durationMinutes: 30,
        intensity: 'moderate',
        durationWeeks: 1
    };

    const nameInput = document.getElementById('calendar-activity-name-input');
    const minutesDisplay = document.getElementById('calendar-activity-minutes-display');
    const saveBtn = document.getElementById('calendar-activity-save-btn');

    if (nameInput) {
        nameInput.value = '';
        nameInput.placeholder = 'e.g. Beach walk, reformer class';
    }
    if (minutesDisplay) minutesDisplay.textContent = String(calendarActivityState.durationMinutes);
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Add to Cycle';
    }

    renderCalendarActivityTypePicker();
    document.getElementById('calendar-activity-modal').style.display = 'flex';
};

window.closeCalendarActivityModal = function() {
    document.getElementById('calendar-activity-modal').style.display = 'none';
    document.getElementById('calendar-workout-action-modal').style.display = 'flex';
};

window.selectCalendarActivityType = function(typeKey) {
    calendarActivityState.selectedType = typeKey || 'other';
    const nameInput = document.getElementById('calendar-activity-name-input');
    if (nameInput && !nameInput.value.trim()) {
        nameInput.placeholder = `e.g. ${getCalendarActivityDefaultName(typeKey)}`;
    }
    setCalendarActivityButtonStates();
};

window.adjustCalendarActivityMinutes = function(delta) {
    calendarActivityState.durationMinutes = Math.max(5, Math.min(300, calendarActivityState.durationMinutes + delta));
    const minutesDisplay = document.getElementById('calendar-activity-minutes-display');
    if (minutesDisplay) minutesDisplay.textContent = String(calendarActivityState.durationMinutes);
};

window.selectCalendarActivityIntensity = function(intensity) {
    calendarActivityState.intensity = intensity || 'moderate';
    setCalendarActivityButtonStates();
};

window.selectCalendarActivityWeeks = function(weeks) {
    calendarActivityState.durationWeeks = Math.max(1, parseInt(weeks, 10) || 1);
    setCalendarActivityButtonStates();
};

window.saveCalendarActivity = async function() {
    const dayIndex = workoutReplacementState.dayIndex;
    if (dayIndex === null) {
        showToast('Choose a calendar day first');
        return;
    }

    const user = window.currentUser;
    if (!user) {
        showToast('Please log in to save activities');
        return;
    }

    const saveBtn = document.getElementById('calendar-activity-save-btn');
    const nameInput = document.getElementById('calendar-activity-name-input');
    const typeInfo = getCalendarActivityTypeInfo(calendarActivityState.selectedType);
    const activityName = (nameInput?.value || '').trim() || getCalendarActivityDefaultName(calendarActivityState.selectedType);

    try {
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
        }

        await dbHelpers.workoutReplacements.deleteForDay(user.id, dayIndex);
        await dbHelpers.workoutReplacements.create(user.id, {
            dayOfWeek: dayIndex,
            workout: {
                type: 'activity',
                activityType: calendarActivityState.selectedType,
                name: activityName,
                durationMinutes: calendarActivityState.durationMinutes,
                intensity: calendarActivityState.intensity,
                icon: typeInfo?.emoji || ''
            },
            durationWeeks: calendarActivityState.durationWeeks,
            startDate: getReplacementStartDateForDay(dayIndex)
        });

        await loadActiveReplacements();

        document.getElementById('calendar-activity-modal').style.display = 'none';
        closeCalendarActionModal();

        if (typeof renderWeeklyCalendar === 'function') renderWeeklyCalendar();
        if (typeof renderMonthlyCalendar === 'function') renderMonthlyCalendar();

        showToast(`${activityName} added to Cycle`);
    } catch (err) {
        console.error('saveCalendarActivity error:', err);
        showToast('Failed to save activity. Please try again.');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Add to Cycle';
        }
    }
};

// Render custom workouts for replacement picker
async function renderReplacementCustomWorkouts() {
    const section = document.getElementById('replacement-custom-section');
    const container = document.getElementById('replacement-custom-list');
    if (!section || !container) return;

    try {
        let customWorkouts = window.savedWorkoutsCache;

        if (!customWorkouts) {
            const user = window.currentUser;
            if (user && dbHelpers?.workouts) {
                customWorkouts = await dbHelpers.workouts.getCustomWorkouts(user.id);
                window.savedWorkoutsCache = customWorkouts;
            }
        }

        if (!customWorkouts || customWorkouts.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        container.innerHTML = customWorkouts.map(w => {
            const name = w.template_name || 'Untitled Workout';
            const exercises = w.template_data?.exercises || [];

            return `
                <div onclick="selectReplacementWorkout('custom', '${name.replace(/'/g, "\\'")}', { customWorkoutId: '${w.id}', exerciseCount: ${exercises.length} })"
                     style="background: white; border-radius: 16px; padding: 16px; cursor: pointer; display: flex; align-items: center; gap: 12px; border: 1px solid #f1f5f9;">
                    <div style="width: 48px; height: 48px; background: linear-gradient(135deg, var(--primary), #22c55e); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 1rem;">
                        ${name.charAt(0).toUpperCase()}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 700; color: var(--text-main);">${name}</div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">${exercises.length} exercises</div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('renderReplacementCustomWorkouts error:', err);
        section.style.display = 'none';
    }
}

// Render workout library categories for replacement picker
function renderReplacementCategories() {
    const container = document.getElementById('replacement-categories');
    if (!container || typeof WORKOUT_LIBRARY === 'undefined') {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">Workout library not available</div>';
        return;
    }

    const categoryIcons = {
        'gym': '🏋️', 'yoga': '🧘', 'bodyweight': '💪', 'home': '🏠',
        'cardio': '🏃', 'hiit': '⚡', 'bands': '🎯'
    };

    const categoryNames = {
        'gym': 'Gym Workouts', 'yoga': 'Yoga & Recovery', 'bodyweight': 'Bodyweight',
        'home': 'Home (Dumbbells)', 'cardio': 'Cardio', 'hiit': 'HIIT', 'bands': 'Resistance Bands'
    };

    const categories = Object.keys(WORKOUT_LIBRARY);

    container.innerHTML = categories.map(categoryKey => {
        const category = WORKOUT_LIBRARY[categoryKey];
        const subcategoryCount = Object.keys(category.subcategories || {}).length;

        return `
            <div onclick="openReplacementSubcategory('${categoryKey}')" style="background: white; border-radius: 16px; padding: 16px; cursor: pointer; display: flex; align-items: center; gap: 12px; border: 1px solid #f1f5f9;">
                <div style="width: 48px; height: 48px; background: linear-gradient(135deg, var(--primary), #22c55e); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem;">
                    ${categoryIcons[categoryKey] || '💪'}
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 700; color: var(--text-main);">${categoryNames[categoryKey] || category.name || categoryKey}</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">${subcategoryCount} workout types</div>
                </div>
                <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: #94a3b8;"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </div>
        `;
    }).join('');
}

// Open subcategory picker for replacement
window.openReplacementSubcategory = function(categoryKey) {
    const category = WORKOUT_LIBRARY[categoryKey];
    if (!category || !category.subcategories) return;

    document.getElementById('replacement-subcategory-title').textContent = category.name || categoryKey;

    const container = document.getElementById('replacement-subcategory-list');
    const subcategories = category.subcategories;

    const subcategoryIcons = {
        'back': '🔙', 'chest': '💪', 'legs': '🦵', 'shoulders': '🏋️', 'arms': '💪', 'core': '🎯',
        'push': '👐', 'pull': '🤲', 'lowerbody': '🦵', 'upperbody': '💪',
        'power': '⚡', 'yin': '🧘', 'restorative': '😌', 'flow': '🌊',
        'fullbody': '🏃', 'tabata': '🔥', 'armscore': '💪'
    };

    container.innerHTML = Object.keys(subcategories).map(subKey => {
        const sub = subcategories[subKey];
        const workoutCount = sub.workouts?.length || 0;
        const icon = subcategoryIcons[subKey] || '💪';
        const subName = sub.name || subKey;

        return `
            <div onclick="openWorkoutPreview('replacement', '${categoryKey}', '${subKey}', '${subName.replace(/'/g, "\\'")}', '${icon}')"
                 style="background: white; border-radius: 16px; padding: 16px; cursor: pointer; display: flex; align-items: center; gap: 12px; border: 1px solid #f1f5f9;">
                <div style="width: 44px; height: 44px; background: #f1f5f9; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.3rem;">
                    ${icon}
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: var(--text-main);">${subName}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${workoutCount} variations</div>
                </div>
                <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: #94a3b8;"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </div>
        `;
    }).join('');

    document.getElementById('replacement-subcategory-modal').style.display = 'flex';
};

// Close replacement subcategory picker
window.closeReplacementSubcategory = function() {
    document.getElementById('replacement-subcategory-modal').style.display = 'none';
};

// Back to replacement picker from subcategory
window.backToReplacementPicker = function() {
    closeReplacementSubcategory();
};

// Select a workout for replacement (then show duration picker)
window.selectReplacementWorkout = function(type, name, data) {
    workoutReplacementState.selectedWorkout = { type, name, data };
    workoutReplacementState.selectedDuration = null;

    // Close previous modals
    document.getElementById('replacement-picker-modal').style.display = 'none';
    closeReplacementSubcategory();

    // Update duration modal with selected workout name
    document.getElementById('duration-workout-name').textContent = name;

    // Reset duration selection UI
    document.querySelectorAll('.duration-option-btn').forEach(btn => {
        btn.style.borderColor = '#e2e8f0';
        btn.style.background = 'white';
    });
    document.getElementById('confirm-replacement-btn').disabled = true;
    document.getElementById('confirm-replacement-btn').style.opacity = '0.5';

    // Show duration picker
    document.getElementById('replacement-duration-modal').style.display = 'flex';
};

// Select replacement duration
window.selectReplacementDuration = function(weeks) {
    workoutReplacementState.selectedDuration = weeks;

    // Update UI
    document.querySelectorAll('.duration-option-btn').forEach(btn => {
        const btnWeeks = parseInt(btn.dataset.weeks);
        if (btnWeeks === weeks) {
            btn.style.borderColor = 'var(--primary)';
            btn.style.background = 'rgba(4, 106, 56, 0.1)';
        } else {
            btn.style.borderColor = '#e2e8f0';
            btn.style.background = 'white';
        }
    });

    // Enable confirm button
    document.getElementById('confirm-replacement-btn').disabled = false;
    document.getElementById('confirm-replacement-btn').style.opacity = '1';
};

// Close duration modal
window.closeDurationModal = function() {
    document.getElementById('replacement-duration-modal').style.display = 'none';
    // Re-open action modal
    document.getElementById('calendar-workout-action-modal').style.display = 'flex';
};

function getReplacementStartDateForDay(dayIndex) {
    const today = new Date();
    const todayDayOfWeek = (today.getDay() + 6) % 7; // Monday = 0
    let daysUntilTarget = dayIndex - todayDayOfWeek;
    if (daysUntilTarget < 0) daysUntilTarget += 7;
    const startDate = new Date(today);
    startDate.setDate(today.getDate() + daysUntilTarget);
    return getLocalDateString(startDate);
}

// Confirm and save the replacement
window.confirmReplacement = async function() {
    const { dayIndex, selectedWorkout, selectedDuration } = workoutReplacementState;

    if (dayIndex === null || !selectedWorkout || !selectedDuration) {
        showToast('Please select a workout and duration');
        return;
    }

    try {
        const user = window.currentUser;
        if (!user) {
            showToast('Please log in to save replacements');
            return;
        }

        // Build replacement workout object
        const workoutData = {
            type: selectedWorkout.type,
            name: selectedWorkout.name,
            ...(selectedWorkout.data || {})
        };

        // Delete any existing replacement for this day first
        await dbHelpers.workoutReplacements.deleteForDay(user.id, dayIndex);

        // Create new replacement
        await dbHelpers.workoutReplacements.create(user.id, {
            dayOfWeek: dayIndex,
            workout: workoutData,
            durationWeeks: selectedDuration,
            startDate: getReplacementStartDateForDay(dayIndex)
        });

        // Refresh cache
        await loadActiveReplacements();

        // Close all modals
        closeDurationModal();
        closeCalendarActionModal();

        // Refresh calendar
        if (typeof renderWeeklyCalendar === 'function') {
            renderWeeklyCalendar();
        }
        if (typeof renderMonthlyCalendar === 'function') {
            renderMonthlyCalendar();
        }

        showToast(`Workout replaced for ${selectedDuration} week${selectedDuration > 1 ? 's' : ''}`);

    } catch (err) {
        console.error('confirmReplacement error:', err);
        showToast('Failed to save replacement. Please try again.');
    }
};

// Remove current replacement
window.removeCurrentReplacement = async function() {
    const replacement = workoutReplacementState.currentReplacement;
    if (!replacement) return;

    try {
        await dbHelpers.workoutReplacements.delete(replacement.id);

        // Refresh cache
        await loadActiveReplacements();

        // Close modal
        closeCalendarActionModal();

        // Refresh calendar
        if (typeof renderWeeklyCalendar === 'function') {
            renderWeeklyCalendar();
        }
        if (typeof renderMonthlyCalendar === 'function') {
            renderMonthlyCalendar();
        }

        showToast('Replacement removed');

    } catch (err) {
        console.error('removeCurrentReplacement error:', err);
        showToast('Failed to remove replacement. Please try again.');
    }
};

// Initialize replacements cache on page load
document.addEventListener('DOMContentLoaded', async function() {
    // Load active replacements cache
    setTimeout(() => {
        if (window.currentUser) {
            loadActiveReplacements();
        }
    }, 1000);
});
