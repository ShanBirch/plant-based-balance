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

        // Render library immediately (doesn't need database)
        const libraryContainer = document.getElementById('your-workouts-library-list');
        if (libraryContainer) {
            try {
                renderYourWorkoutsLibrary(libraryContainer);
                console.log('openYourWorkouts: Library rendered');
            } catch(libErr) {
                console.error('openYourWorkouts: Failed to render library', libErr);
                libraryContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">Could not load workout library</div>';
            }
        }

        // Then load async data (custom workouts and programs)
        renderYourWorkoutsList().catch(err => {
            console.error('openYourWorkouts: Failed to render workouts list', err);
        });

        renderYourProgramsList().catch(err => {
            console.error('openYourWorkouts: Failed to render programs list', err);
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
            // Show empty state when not logged in
            if (listContainer) listContainer.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        // Try to use cached workouts first, then fetch if needed
        let savedWorkouts = window.savedWorkoutsCache;

        if (!savedWorkouts && typeof dbHelpers !== 'undefined' && dbHelpers.workouts) {
            console.log('renderYourWorkoutsList: Fetching from database...');
            savedWorkouts = await dbHelpers.workouts.getCustomWorkouts(user.id);
            window.savedWorkoutsCache = savedWorkouts;
        }

        console.log('renderYourWorkoutsList: Found', savedWorkouts?.length || 0, 'workouts');

        // Render Custom Workouts
        if (!savedWorkouts || savedWorkouts.length === 0) {
            if (listContainer) listContainer.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
        } else {
            if (listContainer) listContainer.style.display = 'flex';
            if (emptyState) emptyState.style.display = 'none';

            listContainer.innerHTML = savedWorkouts.map(w => {
                const name = w.template_name || 'Untitled Workout';
                const exercises = w.template_data?.exercises || [];
                const date = new Date(w.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                return `
                <div onclick="startSavedWorkout('${w.id}')" style="background: white; border-radius: 16px; padding: 16px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 1px solid #f1f5f9; display: flex; align-items: center; gap: 12px;">
                    <div style="width: 48px; height: 48px; background: linear-gradient(135deg, var(--primary), #22c55e); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 1.2rem; flex-shrink: 0;">
                        ${name.charAt(0).toUpperCase()}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">${exercises.length} exercises • Saved ${date}</div>
                    </div>
                    <div style="color: var(--primary); font-weight: 600; font-size: 0.8rem;">Start →</div>
                </div>
                `;
            }).join('');
            console.log('renderYourWorkoutsList: Rendered', savedWorkouts.length, 'workout cards');
        }

    } catch(err) {
        console.error('renderYourWorkoutsList: Error loading workouts:', err);
        if (listContainer) listContainer.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
    }
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