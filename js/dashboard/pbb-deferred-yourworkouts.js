function openYourWorkouts() {
    console.log('openYourWorkouts: Starting...');

    try {
        // First, hide all other views
        hideAllAppViews();

        // Get the view element
        const viewEl = document.getElementById('view-your-workouts');
        if (!viewEl) {
            console.error('openYourWorkouts: view-your-workouts element not found!');
            return;
        }

        // Show the view with explicit styles to ensure visibility
        viewEl.style.display = 'block';
        viewEl.style.visibility = 'visible';
        viewEl.style.opacity = '1';
        viewEl.scrollTop = 0; // Scroll to top of view
        window.scrollTo(0, 0); // Also scroll main window
        console.log('openYourWorkouts: View displayed');

        // Hide bottom nav safely
        const bottomNav = document.querySelector('.bottom-nav');
        if (bottomNav) {
            bottomNav.style.display = 'none';
        }

        // Hide any open modals/overlays that might be covering the view
        // Skip the onboarding wizard — closing it without setting completion flags causes it to re-trigger
        document.querySelectorAll('.modal-overlay, .onboarding-overlay, .completion-modal-overlay').forEach(el => {
            if (el.id === 'onboarding-wizard') return;
            el.style.display = 'none';
            el.classList.remove('active');
        });

        // This page is deliberately only a history of completed sessions.
        renderYourWorkoutsList().catch(err => {
            console.error('openYourWorkouts: Failed to render workouts list', err);
        });

        // Push navigation state
        if (typeof pushNavigationState === 'function') {
            pushNavigationState('view-your-workouts', () => closeYourWorkouts());
        }

        console.log('openYourWorkouts: Complete');
    } catch(err) {
        console.error('openYourWorkouts: Error occurred', err);
        // Even if there's an error, try to show the view
        const viewEl = document.getElementById('view-your-workouts');
        if (viewEl) {
            viewEl.style.display = 'block';
        }
    }
}

function closeYourWorkouts() {
    document.getElementById('view-your-workouts').style.display = 'none';
    switchAppTab('movement-tab');
}

// Track where the progress view was opened from ('home' or 'movement')
window._progressViewOrigin = 'movement';

function openProgressFromMovement() {
    window._progressViewOrigin = 'movement';
    hideAllAppViews();

    const viewEl = document.getElementById('view-progress');
    if (viewEl) {
        viewEl.style.display = 'block';
        viewEl.scrollTop = 0;
        window.scrollTo(0, 0);
    }

    // Hide bottom nav
    const bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) {
        bottomNav.style.display = 'none';
    }

    // Initialize progress data
    if (typeof initProgressView === 'function') {
        initProgressView();
    }

    // Push navigation state for back button support
    if (typeof pushNavigationState === 'function') {
        pushNavigationState('view-progress', () => closeProgressView());
    }
}

function closeProgressView() {
    const viewEl = document.getElementById('view-progress');
    if (viewEl) {
        viewEl.style.display = 'none';
    }
    // Navigate back to wherever Progress was opened from
    if (window._progressViewOrigin === 'home') {
        switchAppTab('dashboard');
    } else {
        switchAppTab('movement-tab');
    }
}

async function renderYourWorkoutsList() {
    console.log('renderYourWorkoutsList: Starting...');
    const listContainer = document.getElementById('your-workouts-list');
    const emptyState = document.getElementById('your-workouts-empty');

    if (!listContainer) {
        console.error('renderYourWorkoutsList: listContainer not found');
        return;
    }

    try {
        const user = window.currentUser;
        if (!user) {
            console.log('renderYourWorkoutsList: No user logged in');
            if (listContainer) listContainer.style.display = 'none';
            if (emptyState) emptyState.style.display = 'flex';
            return;
        }

        if (typeof dbHelpers === 'undefined' || !dbHelpers.workouts || typeof dbHelpers.workouts.getHistory !== 'function') {
            throw new Error('Workout history is unavailable');
        }

        const history = await dbHelpers.workouts.getHistory(user.id);
        const sessions = buildWorkoutHistorySessions(history || []);
        console.log('renderYourWorkoutsList: Found', sessions.length, 'completed sessions');

        if (sessions.length === 0) {
            if (listContainer) listContainer.style.display = 'none';
            if (emptyState) emptyState.style.display = 'flex';
        } else {
            if (listContainer) listContainer.style.display = 'grid';
            if (emptyState) emptyState.style.display = 'none';
            window._journalWorkoutSessions = sessions;
            listContainer.innerHTML = sessions.map((session, index) => renderWorkoutHistoryItem(session, index)).join('');
            console.log('renderYourWorkoutsList: Rendered', sessions.length, 'history cards');
        }

    } catch(err) {
        console.error('renderYourWorkoutsList: Error loading workouts:', err);
        if (listContainer) listContainer.style.display = 'none';
        if (emptyState) emptyState.style.display = 'flex';
    }
}

function escapeWorkoutHistoryHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function buildWorkoutHistorySessions(rows) {
    const byDate = new Map();
    rows.forEach(row => {
        const date = row && row.workout_date;
        if (!date) return;
        if (!byDate.has(date)) byDate.set(date, []);
        byDate.get(date).push(row);
    });

    return Array.from(byDate.entries()).map(([date, sets]) => {
        const exercisesByName = new Map();
        sets.forEach(set => {
            const name = String(set.exercise_name || 'Exercise').trim();
            if (!exercisesByName.has(name)) exercisesByName.set(name, { name, sets: 0, bestWeight: 0, bestReps: 0, setList: [] });
            const exercise = exercisesByName.get(name);
            const weight = Number(set.weight_kg) || 0;
            const reps = Number(set.reps) || 0;
            exercise.sets += 1;
            exercise.bestWeight = Math.max(exercise.bestWeight, weight);
            exercise.bestReps = Math.max(exercise.bestReps, reps);
            exercise.setList.push({ set_number: set.set_number, reps, weight_kg: weight, created_at: set.created_at });
        });
        const exercises = Array.from(exercisesByName.values());
        return {
            date,
            created_at: sets.reduce((latest, row) => !latest || String(row.created_at || '') > String(latest) ? row.created_at : latest, null),
            sets,
            exercises,
            activities: [],
            workoutName: sets.find(row => row.template_name)?.template_name || ''
        };
    }).sort((a, b) => new Date(b.date + 'T12:00:00') - new Date(a.date + 'T12:00:00'));
}

function renderWorkoutHistoryItem(session, index) {
    const date = new Date(session.date + 'T12:00:00');
    const dateLabel = date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    const title = session.workoutName || 'Workout';
    const setCount = session.exercises.reduce((total, exercise) => total + exercise.sets, 0);
    const exerciseNames = session.exercises.slice(0, 3).map(exercise => escapeWorkoutHistoryHtml(exercise.name)).join(', ')
        + (session.exercises.length > 3 ? ' +' + (session.exercises.length - 3) : '');
    return `<button type="button" class="balance-workout-history-item" onclick="openWorkoutJournalDetail(${index})">
        <span class="balance-workout-history-date">${escapeWorkoutHistoryHtml(dateLabel)}</span>
        <span class="balance-workout-history-copy">
            <span class="balance-workout-history-name">${escapeWorkoutHistoryHtml(title)}</span>
            <span class="balance-workout-history-meta">${session.exercises.length} exercise${session.exercises.length === 1 ? '' : 's'} · ${setCount} set${setCount === 1 ? '' : 's'}</span>
            <span class="balance-workout-history-exercises">${exerciseNames}</span>
        </span>
        <span class="balance-workout-history-chevron" aria-hidden="true">›</span>
    </button>`;
}

async function renderYourProgramsList() {
    console.log('renderYourProgramsList: Starting...');
    const listContainer = document.getElementById('your-programs-list');
    const emptyState = document.getElementById('your-programs-empty');

    if (!listContainer) {
        console.error('renderYourProgramsList: listContainer not found');
        return;
    }

    try {
        const user = window.currentUser;
        if (!user) {
            console.log('renderYourProgramsList: No user logged in');
            if (listContainer) listContainer.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        // Fetch programs from database
        let programs = [];
        if (typeof dbHelpers !== 'undefined' && dbHelpers.customPrograms) {
            console.log('renderYourProgramsList: Fetching from database...');
            programs = await dbHelpers.customPrograms.getAll(user.id);
            window.savedProgramsCache = programs;
        }

        console.log('renderYourProgramsList: Found', programs?.length || 0, 'programs');

        if (!programs || programs.length === 0) {
            if (listContainer) listContainer.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
        } else {
            if (listContainer) listContainer.style.display = 'flex';
            if (emptyState) emptyState.style.display = 'none';

            listContainer.innerHTML = programs.map(p => {
                const name = p.program_name || 'Untitled Program';
                const duration = p.duration_weeks || 4;
                const isActive = p.is_active;
                const schedule = p.weekly_schedule || [];
                const workoutDays = schedule.filter(s => s.workout && s.workout.type !== 'rest').length;

                // Calculate progress if active
                let progressHtml = '';
                if (isActive && p.start_date) {
                    const startDate = new Date(p.start_date);
                    const today = new Date();
                    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
                    const weeksElapsed = Math.floor((today - startDate) / msPerWeek) + 1;
                    const progress = Math.min(100, Math.round((weeksElapsed / duration) * 100));
                    progressHtml = `
                        <div style="margin-top: 8px; background: #e2e8f0; border-radius: 4px; height: 4px; overflow: hidden;">
                            <div style="background: var(--primary); height: 100%; width: ${progress}%;"></div>
                        </div>
                        <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px;">Week ${Math.min(weeksElapsed, duration)} of ${duration}</div>
                    `;
                }

                return `
                <div onclick="viewProgramDetails('${p.id}')" style="background: white; border-radius: 16px; padding: 16px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: ${isActive ? '2px solid var(--primary)' : '1px solid #f1f5f9'}; ${isActive ? 'border-left: 4px solid var(--primary);' : ''}">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 48px; height: 48px; background: ${isActive ? 'linear-gradient(135deg, var(--primary), #22c55e)' : 'linear-gradient(135deg, #64748b, #94a3b8)'}; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 1rem; flex-shrink: 0;">
                            ${duration}w
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</div>
                                ${isActive ? '<span style="background: var(--primary); color: white; font-size: 0.65rem; padding: 2px 8px; border-radius: 10px; font-weight: 700;">ACTIVE</span>' : ''}
                            </div>
                            <div style="font-size: 0.8rem; color: var(--text-muted);">${workoutDays} workout days • ${duration} weeks</div>
                            ${progressHtml}
                        </div>
                        <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: #94a3b8; flex-shrink: 0;"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
                    </div>
                </div>
                `;
            }).join('');
            console.log('renderYourProgramsList: Rendered', programs.length, 'program cards');
        }

    } catch(err) {
        console.error('renderYourProgramsList: Error loading programs:', err);
        if (listContainer) listContainer.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
    }
}

async function viewProgramDetails(programId) {
    // Show program details with options to activate, edit, or delete
    try {
        const user = window.currentUser;
        if (!user) return;

        const programs = window.savedProgramsCache || await dbHelpers.customPrograms.getAll(user.id);
        const program = programs.find(p => p.id === programId);
        if (!program) return;

        const schedule = program.weekly_schedule || [];
        const scheduleText = schedule.map(s => {
            if (!s.workout) return `${s.day}: Not set`;
            if (s.workout.type === 'rest') return `${s.day}: Rest Day`;
            return `${s.day}: ${s.workout.name}`;
        }).join('\n');

        const action = prompt(
            `${program.program_name}\n` +
            `Duration: ${program.duration_weeks} weeks\n` +
            `Status: ${program.is_active ? 'Active' : 'Inactive'}\n\n` +
            `Weekly Schedule:\n${scheduleText}\n\n` +
            `Options:\n` +
            `1 = ${program.is_active ? 'Deactivate' : 'Activate'}\n` +
            `2 = Delete\n` +
            `Cancel = Close`,
            ''
        );

        if (action === '1') {
            if (program.is_active) {
                await dbHelpers.customPrograms.deactivate(programId);
                alert('Program deactivated. Your calendar will use the default schedule.');
            } else {
                await dbHelpers.customPrograms.activate(user.id, programId);
                alert(`Program "${program.program_name}" activated! Your ${program.duration_weeks}-week program starts today.`);
            }
            renderYourProgramsList();
            if (typeof renderWeeklyCalendar === 'function') renderWeeklyCalendar();
            if (typeof renderMovementView === 'function') renderMovementView();
        } else if (action === '2') {
            if (confirm(`Are you sure you want to delete "${program.program_name}"? This cannot be undone.`)) {
                await dbHelpers.customPrograms.delete(programId);
                alert('Program deleted.');
                renderYourProgramsList();
                if (typeof renderWeeklyCalendar === 'function') renderWeeklyCalendar();
                if (typeof renderMovementView === 'function') renderMovementView();
            }
        }
    } catch (err) {
        console.error('viewProgramDetails: Error', err);
        alert('An error occurred. Please try again.');
    }
}

function renderYourWorkoutsLibrary(container) {
    console.log('renderYourWorkoutsLibrary: Starting...');
    if (typeof WORKOUT_LIBRARY === 'undefined') {
        console.warn('renderYourWorkoutsLibrary: WORKOUT_LIBRARY is undefined');
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">Workout library not available</div>';
        return;
    }

    const categories = Object.keys(WORKOUT_LIBRARY);
    const categoryIcons = {
        'gym': '🏋️',
        'yoga': '🧘',
        'bodyweight': '💪',
        'home': '🏠',
        'cardio': '🏃',
        'hiit': '⚡'
    };

    container.innerHTML = categories.map(categoryKey => {
        const category = WORKOUT_LIBRARY[categoryKey];
        const icon = categoryIcons[categoryKey] || category.icon || '💪';
        const name = category.name || categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1);

        // Count total workouts in category
        let totalWorkouts = 0;
        if (category.subcategories) {
            Object.values(category.subcategories).forEach(sub => {
                if (sub.workouts) totalWorkouts += sub.workouts.length;
            });
        }

        return `
        <div onclick="openLibraryCategory('${categoryKey}')" style="background: white; border-radius: 16px; padding: 16px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 1px solid #f1f5f9; display: flex; align-items: center; gap: 12px;">
            <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #f59e0b, #ef4444); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; flex-shrink: 0;">
                ${icon}
            </div>
            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem; margin-bottom: 2px;">${name}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">${totalWorkouts} workouts available</div>
            </div>
            <div style="color: #f59e0b; font-weight: 600; font-size: 0.8rem;">Browse →</div>
        </div>
        `;
    }).join('');
    console.log('renderYourWorkoutsLibrary: Rendered', categories.length, 'categories');
}

function viewWorkoutHistoryDetail(date) {
    // Navigate to progress view (now inside Movement tab)
    closeYourWorkouts();
    setTimeout(() => { if(typeof openProgressFromMovement === 'function') openProgressFromMovement(); }, 100);
}
