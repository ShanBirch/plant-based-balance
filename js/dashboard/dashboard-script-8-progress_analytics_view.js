// --- PROGRESS / ANALYTICS VIEW ---
async function initProgressView() {
    const user = window.currentUser;
    if (!user) {
        console.error('No user logged in');
        return;
    }

    console.log('Initializing Progress View for user:', user.id);

    try {
        // Show loading
        document.getElementById('progress-loading').style.display = 'block';
        document.getElementById('progress-main-content').style.display = 'none';

        // Fetch data individually with fallbacks
        let workoutCount = 0;
        let workoutHistory = [];
        let milestones = [];
        let checkins = [];
        let pointsData = null;
        let recentExercises = [];

        // Load workout count
        try {
            workoutCount = await dbHelpers.workouts.getWorkoutCount(user.id);
            console.log('Workout count:', workoutCount);
        } catch (e) {
            console.warn('Failed to load workout count:', e);
        }

        // Load workout history
        try {
            workoutHistory = await dbHelpers.workouts.getHistory(user.id, 30);
            console.log('Workout history:', workoutHistory?.length || 0, 'records');
        } catch (e) {
            console.warn('Failed to load workout history:', e);
        }

        // Load milestones
        try {
            milestones = await dbHelpers.milestones.getAll(user.id, 20);
            console.log('Milestones:', milestones?.length || 0);
        } catch (e) {
            console.warn('Failed to load milestones:', e);
        }

        // Load check-ins
        try {
            checkins = await dbHelpers.checkins.getRecent(user.id, 14);
            console.log('Check-ins:', checkins?.length || 0);
        } catch (e) {
            console.warn('Failed to load check-ins:', e);
        }

        // Load points data
        try {
            pointsData = await dbHelpers.points.getPoints(user.id);
            console.log('Points data:', pointsData);
        } catch (e) {
            console.warn('Failed to load points data:', e);
        }

        // Load recent exercises
        try {
            recentExercises = await dbHelpers.workouts.getRecentExercises(user.id, 100);
            console.log('Recent exercises:', recentExercises?.length || 0);
        } catch (e) {
            console.warn('Failed to load recent exercises:', e);
        }

        // Restore PB display slots from Supabase if localStorage is empty
        try {
            const localSlots = localStorage.getItem('customPBSlots');
            if (!localSlots || localSlots === '[]' || localSlots === 'null') {
                const savedSlots = await loadPBSlotsFromSupabase();
                if (savedSlots) {
                    localStorage.setItem('customPBSlots', JSON.stringify(savedSlots));
                    console.log('Restored PB display slots from Supabase:', savedSlots.filter(Boolean).length, 'exercises');
                }
            }
        } catch (e) {
            console.warn('Failed to restore PB slots from Supabase:', e);
        }

        // Load personal bests
        let personalBests = [];
        let recentPBs = [];
        try {
            [personalBests, recentPBs] = await Promise.all([
                dbHelpers.personalBests.getAll(user.id, 50),
                dbHelpers.personalBests.getHistory(user.id, 5)
            ]);
            console.log('Personal bests:', personalBests?.length || 0);
            console.log('Recent PBs:', recentPBs?.length || 0);
        } catch (e) {
            console.warn('Failed to load personal bests:', e);
        }

        // Update overview stats (commented out as UI was removed in redesign)
        /*
        document.getElementById('total-workouts-stat').innerText = workoutCount || 0;
        document.getElementById('current-streak-stat').innerText = pointsData?.current_streak || 0;
        document.getElementById('total-points-stat').innerText = pointsData?.current_points || 0;
        document.getElementById('avg-calories-stat').innerText = '-';
        */

        // Cache PBs for the custom slot picker
        window._cachedPersonalBests = personalBests;
        window._cachedRecentPBs = recentPBs;

        // Load weigh-in data for body weight graph
        let weighIns = [];
        try {
            weighIns = await dbHelpers.weighIns.getRecent(user.id, 90);
            console.log('Weigh-ins:', weighIns?.length || 0);
        } catch (e) {
            console.warn('Failed to load weigh-ins:', e);
        }

        // Load progress photos
        let progressPhotos = [];
        try {
            progressPhotos = await db.progressPhotos.getAll(user.id, 52);
            console.log('Progress photos:', progressPhotos?.length || 0);
        } catch (e) {
            console.warn('Failed to load progress photos:', e);
        }

        // Render sections
        renderPersonalBests(personalBests, recentPBs);
        renderBodyWeightGraph(weighIns);
        renderProgressPhotosTimeline(progressPhotos);
        // renderCheckins(checkins); // UI removed in redesign
        await renderExerciseProgress(user.id, recentExercises);

        // Hide loading, show content
        document.getElementById('progress-loading').style.display = 'none';
        document.getElementById('progress-main-content').style.display = 'block';

        console.log('✅ Progress view loaded successfully');

    } catch (error) {
        console.error('Critical error loading progress view:', error);
        document.getElementById('progress-loading').innerHTML = `
            <div style="font-size: 2rem; margin-bottom: 10px;">😔</div>
            <div style="color: var(--text-muted); margin-bottom: 10px;">Failed to load progress data</div>
            <div style="font-size: 0.85rem; color: var(--text-muted); font-family: monospace;">${error.message}</div>
        `;
    }
}

function renderWorkoutHistory(workoutHistory) {
    const container = document.getElementById('workout-history-list');

    if (!workoutHistory || workoutHistory.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">No workouts yet. Start your first workout!</div>';
        return;
    }

    // Group by date
    const grouped = {};
    workoutHistory.forEach(w => {
        const date = w.workout_date;
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(w);
    });

    // Get unique dates and sort descending
    const dates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a)).slice(0, 7);

    const html = dates.map(date => {
        const workouts = grouped[date];
        const exercises = [...new Set(workouts.map(w => w.exercise_name))];
        const formattedDate = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const exerciseList = exercises.slice(0, 3).join(', ');

        return `
            <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between;">
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: var(--primary); margin-bottom: 5px;">${formattedDate}</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">
                        ${exerciseList}${exercises.length > 3 ? ` +${exercises.length - 3} more` : ''}
                    </div>
                </div>
                <button onclick="shareWorkoutHistoryToFeed('${formattedDate}', '${exerciseList.replace(/'/g, "\\'")}')" style="background: linear-gradient(135deg, #f59e0b, #eab308); color: white; border: none; padding: 6px 10px; border-radius: 8px; font-size: 0.7rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                    <span>🎉</span> Share
                </button>
            </div>
        `;
    }).join('');

    container.innerHTML = html || '<div style="text-align: center; color: var(--text-muted); padding: 20px;">No recent workouts</div>';
}

// Render Body Weight Graph - line chart of weigh-in data over time
function renderBodyWeightGraph(weighIns) {
    const container = document.getElementById('bodyweight-graph');
    if (!container) return;

    if (!weighIns || weighIns.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 30px 20px;"><div style="font-size: 2rem; margin-bottom: 10px; opacity: 0.5;">&#9878;</div><div style="font-size: 0.9rem;">Log your first weigh-in to see your progress here!</div></div>';
        return;
    }

    const preferLbs = localStorage.getItem('weightUnitPreference') === 'lbs';
    const unitLabel = preferLbs ? 'lbs' : 'kg';

    // Sort ascending by date
    const sorted = [...weighIns].sort((a, b) => new Date(a.weigh_in_date) - new Date(b.weigh_in_date));

    const dates = sorted.map(w => {
        const d = new Date(w.weigh_in_date);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const weights = sorted.map(w => {
        const kg = parseFloat(w.weight_kg) || 0;
        return preferLbs ? +(kg * 2.20462).toFixed(1) : +kg.toFixed(1);
    });

    const minWeight = Math.min(...weights);
    const maxWeight = Math.max(...weights);
    // Add some padding to the range so the line doesn't hug the edges
    const range = maxWeight - minWeight || 1;
    const yMin = minWeight - range * 0.15;
    const yMax = maxWeight + range * 0.15;

    // Chart dimensions
    const width = 400;
    const height = 230;
    const padding = { top: 20, right: 15, bottom: 45, left: 45 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const pointCount = sorted.length;
    const xStep = pointCount > 1 ? chartWidth / (pointCount - 1) : 0;

    // Build SVG
    let svg = `<svg viewBox="0 0 ${width} ${height}" style="width: 100%; display: block; overflow: visible;">`;

    // Gradient fill under the line
    svg += `
        <defs>
            <linearGradient id="weightFillGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#7BA883" stop-opacity="0.3"/>
                <stop offset="100%" stop-color="#7BA883" stop-opacity="0.02"/>
            </linearGradient>
        </defs>
    `;

    // Horizontal grid lines (5 lines)
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
        const y = padding.top + (chartHeight / gridLines) * i;
        const val = yMax - ((yMax - yMin) / gridLines) * i;
        svg += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#f1f5f9" stroke-width="1"/>`;
        svg += `<text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="#94a3b8">${val.toFixed(1)}</text>`;
    }

    // Y-axis unit label
    svg += `<text x="${padding.left - 35}" y="${padding.top + chartHeight / 2}" text-anchor="middle" font-size="9" fill="#94a3b8" transform="rotate(-90, ${padding.left - 35}, ${padding.top + chartHeight / 2})">${unitLabel}</text>`;

    // Build line path and area fill
    let linePath = '';
    let areaPath = '';
    const points = [];

    weights.forEach((weight, i) => {
        const x = padding.left + xStep * i;
        const y = padding.top + chartHeight - ((weight - yMin) / (yMax - yMin)) * chartHeight;
        points.push({ x, y, weight, date: dates[i] });
        if (i === 0) {
            linePath = `M ${x},${y}`;
            areaPath = `M ${x},${padding.top + chartHeight} L ${x},${y}`;
        } else {
            linePath += ` L ${x},${y}`;
            areaPath += ` L ${x},${y}`;
        }
    });

    // Close area path
    if (points.length > 0) {
        areaPath += ` L ${points[points.length - 1].x},${padding.top + chartHeight} Z`;
    }

    // Area fill
    svg += `<path d="${areaPath}" fill="url(#weightFillGrad)"/>`;

    // Line
    svg += `<path d="${linePath}" fill="none" stroke="#7BA883" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;

    // Data points
    points.forEach((p, i) => {
        const isFirst = i === 0;
        const isLast = i === points.length - 1;
        const r = (isFirst || isLast) ? 5 : 3.5;
        svg += `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${isLast ? '#7BA883' : 'white'}" stroke="#7BA883" stroke-width="2"/>`;
    });

    // X-axis date labels
    const labelFreq = Math.max(1, Math.ceil(pointCount / 7));
    points.forEach((p, i) => {
        const showLabel = pointCount <= 8 || i === 0 || i === pointCount - 1 || i % labelFreq === 0;
        if (showLabel) {
            let anchor = 'middle';
            if (i === 0 && pointCount > 1) anchor = 'start';
            else if (i === pointCount - 1 && pointCount > 1) anchor = 'end';
            svg += `<text x="${p.x}" y="${height - 8}" text-anchor="${anchor}" font-size="9" fill="#94a3b8">${p.date}</text>`;
        }
    });

    svg += '</svg>';

    // Stats
    const currentWeight = weights[weights.length - 1];
    const startWeight = weights[0];
    const change = currentWeight - startWeight;
    const changeColor = change < 0 ? '#10b981' : (change > 0 ? '#ef4444' : '#94a3b8');
    const changePrefix = change > 0 ? '+' : '';

    const stats = `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 16px;">
            <div style="background: #f0fdf4; padding: 12px 8px; border-radius: 12px; text-align: center;">
                <div style="font-size: 1.3rem; font-weight: 700; color: var(--primary);">${currentWeight}</div>
                <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 3px;">Current (${unitLabel})</div>
            </div>
            <div style="background: #f0fdf4; padding: 12px 8px; border-radius: 12px; text-align: center;">
                <div style="font-size: 1.3rem; font-weight: 700; color: ${changeColor};">${changePrefix}${change.toFixed(1)}</div>
                <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 3px;">Change (${unitLabel})</div>
            </div>
            <div style="background: #f0fdf4; padding: 12px 8px; border-radius: 12px; text-align: center;">
                <div style="font-size: 1.3rem; font-weight: 700; color: var(--primary);">${sorted.length}</div>
                <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 3px;">Weigh-ins</div>
            </div>
        </div>
    `;

    container.innerHTML = svg + stats;
}

// Render Progress Photos Timeline - grid of weekly progress photos
function renderProgressPhotosTimeline(photos) {
    const container = document.getElementById('progress-photos-container');
    if (!container) return;

    if (!photos || photos.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 30px 20px;"><div style="font-size: 2rem; margin-bottom: 10px; opacity: 0.5;">📸</div><div style="font-size: 0.9rem;">Upload your first progress photo on Monday to start tracking your transformation!</div></div>';
        return;
    }

    // Build a grid of photo thumbnails with dates
    let html = '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">';

    photos.forEach(function(photo, index) {
        const weekDate = new Date(photo.photo_week + 'T00:00:00');
        const dateLabel = weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const yearLabel = weekDate.getFullYear();

        html += '<div onclick="openProgressPhotoModal(' + index + ')" style="cursor: pointer; position: relative; border-radius: 12px; overflow: hidden; aspect-ratio: 3/4; background: #f1f5f9;">';
        html += '<img src="' + photo.photo_url + '" alt="Progress photo" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy">';
        html += '<div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.7)); padding: 8px 6px 6px; color: white;">';
        html += '<div style="font-size: 0.7rem; font-weight: 600;">' + dateLabel + '</div>';
        html += '<div style="font-size: 0.6rem; opacity: 0.8;">' + yearLabel + '</div>';
        html += '</div></div>';
    });

    html += '</div>';

    // Stats row
    html += '<div style="display: flex; justify-content: center; gap: 20px; margin-top: 16px; padding-top: 12px; border-top: 1px solid #f1f5f9;">';
    html += '<div style="text-align: center;">';
    html += '<div style="font-size: 1.3rem; font-weight: 700; color: var(--primary);">' + photos.length + '</div>';
    html += '<div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 3px;">Photos</div>';
    html += '</div>';

    // Calculate weeks span
    if (photos.length >= 2) {
        var firstDate = new Date(photos[photos.length - 1].photo_week);
        var lastDate = new Date(photos[0].photo_week);
        var weeksDiff = Math.round((lastDate - firstDate) / (7 * 24 * 60 * 60 * 1000));
        html += '<div style="text-align: center;">';
        html += '<div style="font-size: 1.3rem; font-weight: 700; color: var(--primary);">' + weeksDiff + '</div>';
        html += '<div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 3px;">Weeks tracked</div>';
        html += '</div>';
    }

    html += '</div>';

    container.innerHTML = html;

    // Store photos for modal
    window._progressPhotosData = photos;
}

// Full-screen modal for viewing a single progress photo
function openProgressPhotoModal(index) {
    var photos = window._progressPhotosData;
    if (!photos || !photos[index]) return;
    var photo = photos[index];

    var weekDate = new Date(photo.photo_week + 'T00:00:00');
    var dateLabel = weekDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    // Create or reuse modal
    var modal = document.getElementById('progress-photo-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'progress-photo-modal';
        modal.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(0,0,0,0.9); z-index:200001; align-items:center; justify-content:center; flex-direction:column; padding:20px;';
        document.body.appendChild(modal);
    }

    modal.innerHTML = '<button onclick="closeProgressPhotoModal()" style="position:absolute; top:15px; right:15px; background:rgba(255,255,255,0.2); border:none; color:white; width:40px; height:40px; border-radius:50%; cursor:pointer; font-size:1.2rem; z-index:2;">&#x2715;</button>'
        + '<img src="' + photo.photo_url + '" style="max-width:100%; max-height:75vh; object-fit:contain; border-radius:12px;">'
        + '<div style="color:white; text-align:center; margin-top:15px;">'
        + '<div style="font-weight:700; font-size:1rem;">' + dateLabel + '</div>'
        + '<div style="font-size:0.85rem; opacity:0.7; margin-top:4px;">Week ' + (photos.length - index) + ' of ' + photos.length + '</div>'
        + '</div>';

    // Navigation arrows
    if (index > 0) {
        modal.innerHTML += '<button onclick="openProgressPhotoModal(' + (index - 1) + ')" style="position:absolute; right:15px; top:50%; transform:translateY(-50%); background:rgba(255,255,255,0.2); border:none; color:white; width:40px; height:40px; border-radius:50%; cursor:pointer; font-size:1.2rem;">&#x276F;</button>';
    }
    if (index < photos.length - 1) {
        modal.innerHTML += '<button onclick="openProgressPhotoModal(' + (index + 1) + ')" style="position:absolute; left:15px; top:50%; transform:translateY(-50%); background:rgba(255,255,255,0.2); border:none; color:white; width:40px; height:40px; border-radius:50%; cursor:pointer; font-size:1.2rem;">&#x276E;</button>';
    }

    modal.style.display = 'flex';
}

function closeProgressPhotoModal() {
    var modal = document.getElementById('progress-photo-modal');
    if (modal) modal.style.display = 'none';
}
window.openProgressPhotoModal = openProgressPhotoModal;
window.closeProgressPhotoModal = closeProgressPhotoModal;

// Render Personal Bests section
function renderPersonalBests(personalBests, recentPBs) {
    const pbsContainer = document.getElementById('personal-bests-list');
    const recentPBsContainer = document.getElementById('recent-pbs-list');

    recentPBsContainer.style.display = 'none';

    const preferLbs = localStorage.getItem('weightUnitPreference') === 'lbs';

    // Default exercises for first 3 slots (user can change all of them)
    const DEFAULT_SLOTS = ['Barbell Bench Press', 'Barbell Back Squat', 'Barbell Romanian Deadlift', null, null, null];

    // Build PB lookup map
    const pbMap = {};
    if (personalBests) {
        personalBests.forEach(pb => { pbMap[pb.exercise_name] = pb; });
    }

    // Get all 6 slots from localStorage (all user-configurable)
    let allSlots = [];
    try {
        allSlots = JSON.parse(localStorage.getItem('customPBSlots') || '[]');
    } catch (e) { allSlots = []; }
    // If empty (fresh install / cleared), use defaults
    if (!allSlots || allSlots.length === 0) {
        allSlots = [...DEFAULT_SLOTS];
        localStorage.setItem('customPBSlots', JSON.stringify(allSlots));
    }
    // Migrate from old 3-slot format: prepend the default Big 3 before the user's custom picks
    if (allSlots.length <= 3 && !localStorage.getItem('pbSlotsMigratedV2')) {
        const oldCustom = [...allSlots];
        allSlots = [...DEFAULT_SLOTS.slice(0, 3), ...oldCustom];
        while (allSlots.length < 6) allSlots.push(null);
        allSlots = allSlots.slice(0, 6);
        localStorage.setItem('customPBSlots', JSON.stringify(allSlots));
        localStorage.setItem('pbSlotsMigratedV2', 'true');
        // Also persist the migrated slots to Supabase
        savePBSlotsToSupabase(allSlots);
    }
    // Ensure exactly 6 slots
    while (allSlots.length < 6) allSlots.push(null);
    allSlots = allSlots.slice(0, 6);

    function formatPBCard(pb, label, slotIndex) {
        if (!pb || !pb.best_weight_kg) {
            // Empty slot - show add button
            if (!label) {
                return `
                    <div onclick="openCustomPBPicker(${slotIndex})" style="background: white; padding: 18px; border-radius: 18px; box-shadow: var(--card-shadow); border: 2px dashed rgba(0,0,0,0.1); position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 140px; cursor: pointer; transition: border-color 0.2s; touch-action: manipulation; user-select: none; -webkit-tap-highlight-color: transparent;">
                        <div style="font-size: 1.5rem; opacity: 0.3; margin-bottom: 8px;">+</div>
                        <div style="font-weight: 600; color: var(--text-muted); font-size: 0.75rem; opacity: 0.6;">Add Exercise</div>
                    </div>
                `;
            }
            // Slot with name but no data yet
            return `
                <div onclick="openCustomPBPicker(${slotIndex})" style="background: white; padding: 18px; border-radius: 18px; box-shadow: var(--card-shadow); border: 1px solid rgba(0,0,0,0.02); position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; min-height: 140px; cursor: pointer; touch-action: manipulation; user-select: none; -webkit-tap-highlight-color: transparent;">
                    <div style="position: absolute; top: 12px; right: 12px; font-size: 1.2rem; opacity: 0.15;">🏆</div>
                    <div style="font-weight: 600; color: var(--text-muted); font-size: 0.8rem; margin-bottom: 15px; padding-right: 25px; line-height: 1.2;">${label}</div>
                    <div>
                        <div style="font-size: 1.8rem; font-weight: 800; color: #e5e7eb; line-height: 1;">-</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500; margin-top: 4px; opacity: 0.5;">No data yet</div>
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 12px; font-weight: 500; opacity: 0.5; text-align: right;">-</div>
                </div>
            `;
        }

        let weightDisplay;
        if (preferLbs) {
            const lbs = (pb.best_weight_kg * 2.20462).toFixed(0);
            weightDisplay = `${lbs}lbs`;
        } else {
            weightDisplay = `${pb.best_weight_kg}kg`;
        }
        const reps = pb.best_weight_reps || pb.best_reps || '-';
        const date = pb.best_weight_date
            ? new Date(pb.best_weight_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : '';

        return `
            <div onclick="openCustomPBPicker(${slotIndex})" style="background: white; padding: 18px; border-radius: 18px; box-shadow: var(--card-shadow); border: 1px solid rgba(0,0,0,0.02); position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; min-height: 140px; cursor: pointer; touch-action: manipulation; user-select: none; -webkit-tap-highlight-color: transparent;">
                <div style="position: absolute; top: 12px; right: 12px; font-size: 1.2rem; opacity: 0.3;">🏆</div>
                <div style="font-weight: 600; color: var(--text-muted); font-size: 0.8rem; margin-bottom: 15px; padding-right: 25px; line-height: 1.2;">${label}</div>
                <div>
                    <div style="font-size: 1.8rem; font-weight: 800; color: #f59e0b; line-height: 1;">${weightDisplay}</div>
                    <div style="font-size: 0.9rem; color: var(--text-muted); font-weight: 500; margin-top: 4px;">x ${reps} reps</div>
                </div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 12px; font-weight: 500; opacity: 0.8; text-align: right;">${date}</div>
            </div>
        `;
    }

    // Render all 6 configurable slots
    let html = '';
    allSlots.forEach((exerciseName, i) => {
        const pb = exerciseName ? pbMap[exerciseName] : null;
        html += formatPBCard(pb, exerciseName, i);
    });

    pbsContainer.innerHTML = html;
}

// Custom PB slot picker - uses a reusable overlay for instant display
(function() {
    // Create the persistent overlay once on load
    const overlay = document.createElement('div');
    overlay.id = 'pb-picker-overlay';
    overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 200001; display: none; align-items: flex-end; justify-content: center;';
    overlay.innerHTML = `
        <div style="background: white; border-radius: 20px 20px 0 0; width: 100%; max-width: 500px; max-height: 70vh; display: flex; flex-direction: column; overflow: hidden;">
            <div style="padding: 20px; border-bottom: 1px solid rgba(0,0,0,0.08); display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-weight: 700; font-size: 1.05rem;">Choose Exercise</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">Select a personal best to track</div>
                </div>
                <div onclick="closePBPicker()" style="width: 32px; height: 32px; border-radius: 50%; background: #f3f4f6; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 1.2rem; color: var(--text-muted); touch-action: manipulation;">✕</div>
            </div>
            <div id="pb-picker-exercise-list" style="overflow-y: auto; flex: 1;"></div>
        </div>
    `;
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closePBPicker();
    });
    document.body.appendChild(overlay);
})();

function openCustomPBPicker(slotIndex) {
    let allSlots = [];
    try {
        allSlots = JSON.parse(localStorage.getItem('customPBSlots') || '[]');
    } catch (e) { allSlots = []; }
    while (allSlots.length < 6) allSlots.push(null);

    // Get all available exercises from the stored PBs
    const allPBs = window._cachedPersonalBests || [];
    // Only exclude exercises already used in OTHER slots (allow current slot's exercise to be re-selected)
    const usedExercises = new Set(allSlots.filter((name, i) => name && i !== slotIndex));

    const availableExercises = allPBs
        .map(pb => pb.exercise_name)
        .filter(name => !usedExercises.has(name));

    availableExercises.sort();

    const exerciseListHtml = availableExercises.length > 0
        ? availableExercises.map(name => `
            <div onclick="selectCustomPBSlot(${slotIndex}, '${name.replace(/'/g, "\\'")}')" style="padding: 14px 18px; border-bottom: 1px solid rgba(0,0,0,0.06); cursor: pointer; font-size: 0.95rem; font-weight: 500; transition: background 0.15s; touch-action: manipulation;" ontouchstart="this.style.background='#f3f4f6'" ontouchend="this.style.background=''" onmouseenter="this.style.background='#f3f4f6'" onmouseleave="this.style.background=''">
                ${name}
            </div>
        `).join('')
        : `<div style="padding: 30px 20px; text-align: center; color: var(--text-muted);">
            <div style="font-size: 1.5rem; margin-bottom: 8px; opacity: 0.4;">🏋️</div>
            <div style="font-size: 0.9rem;">Complete more workouts to unlock exercises for tracking!</div>
        </div>`;

    const clearBtnHtml = allSlots[slotIndex]
        ? `<div onclick="selectCustomPBSlot(${slotIndex}, null)" style="padding: 14px 18px; border-bottom: 1px solid rgba(0,0,0,0.06); cursor: pointer; font-size: 0.95rem; font-weight: 500; color: #ef4444; transition: background 0.15s; touch-action: manipulation;" ontouchstart="this.style.background='#fef2f2'" ontouchend="this.style.background=''" onmouseenter="this.style.background='#fef2f2'" onmouseleave="this.style.background=''">
            Remove this exercise
        </div>`
        : '';

    // Update the exercise list content and show the overlay
    document.getElementById('pb-picker-exercise-list').innerHTML = clearBtnHtml + exerciseListHtml;
    document.getElementById('pb-picker-overlay').style.display = 'flex';
}

function selectCustomPBSlot(slotIndex, exerciseName) {
    let allSlots = [];
    try {
        allSlots = JSON.parse(localStorage.getItem('customPBSlots') || '[]');
    } catch (e) { allSlots = []; }
    while (allSlots.length < 6) allSlots.push(null);

    allSlots[slotIndex] = exerciseName;
    localStorage.setItem('customPBSlots', JSON.stringify(allSlots));

    // Persist to Supabase so selections survive app reinstall
    savePBSlotsToSupabase(allSlots);

    closePBPicker();

    // Re-render with cached data
    if (window._cachedPersonalBests) {
        renderPersonalBests(window._cachedPersonalBests, window._cachedRecentPBs || []);
    }
}

// Save PB slot selections to Supabase user_facts for persistence across reinstalls
async function savePBSlotsToSupabase(slots) {
    try {
        const user = window.currentUser;
        if (!user) return;
        let existingFacts = {};
        try { existingFacts = await dbHelpers.userFacts.get(user.id); } catch(e) {}
        const currentDetails = existingFacts?.personal_details || {};
        await dbHelpers.userFacts.upsert(user.id, {
            personal_details: { ...currentDetails, pb_display_slots: slots }
        });
    } catch (e) {
        console.warn('Failed to save PB slots to Supabase:', e);
    }
}

// Load PB slot selections from Supabase (called on progress view init)
async function loadPBSlotsFromSupabase() {
    try {
        const user = window.currentUser;
        if (!user) return null;
        const facts = await dbHelpers.userFacts.get(user.id);
        const slots = facts?.personal_details?.pb_display_slots;
        if (slots && Array.isArray(slots) && slots.length > 0) {
            return slots;
        }
    } catch (e) {
        console.warn('Failed to load PB slots from Supabase:', e);
    }
    return null;
}

function closePBPicker() {
    const overlay = document.getElementById('pb-picker-overlay');
    if (overlay) overlay.style.display = 'none';
}

// Share past workout - go to group chats
function shareWorkoutHistoryToFeed(date, exercises) {
    window.pendingWinShare = {
        type: 'workout_complete',
        message: `Throwback to my ${date} workout! 💪`,
        workoutName: exercises || 'Workout',
        improvement: ''
    };
    switchAppTab('friends');
    showToast('Open a group chat to share your win! 💬', 'success');
}

function renderMilestones(milestones, workoutCount = 0, pointsData = null, personalBests = []) {
    const container = document.getElementById('milestones-list');

    const getMilestoneEmoji = (type, value) => {
        if (type === 'workout_count') {
            if (value === 1) return '🎉';
            if (value >= 100) return '👑';
            if (value >= 50) return '🏆';
            if (value >= 25) return '🌟';
            if (value >= 10) return '🔥';
            return '💪';
        }
        if (type === 'workout_streak') return '⚡';
        if (type === 'personal_best') return '🏅';
        if (type === 'points') return '⭐';
        return '🎖️';
    };

    const getMilestoneMessage = (type, value) => {
        if (type === 'workout_count') {
            if (value === 1) return 'First Workout!';
            if (value >= 100) return '100 Workouts - Legend!';
            if (value >= 50) return '50 Workouts - Unstoppable!';
            if (value >= 25) return '25 Workouts - Amazing!';
            if (value >= 10) return '10 Workouts - On Fire!';
            if (value >= 5) return '5 Workouts - Great Start!';
            return `${value} Workouts Complete`;
        }
        if (type === 'workout_streak') return `${value}-Day Streak!`;
        if (type === 'personal_best') return `${value} Personal Best${value > 1 ? 's' : ''}!`;
        if (type === 'points') return `${value} Points Earned!`;
        return 'Achievement Unlocked';
    };

    // If no milestones from database, generate achievements from available data
    let achievementsToShow = milestones || [];

    if (achievementsToShow.length === 0 && (workoutCount > 0 || (personalBests && personalBests.length > 0) || (pointsData && pointsData.current_points > 0))) {
        const generatedAchievements = [];

        // Generate workout count achievements
        if (workoutCount >= 1) {
            const thresholds = [1, 5, 10, 25, 50, 100];
            for (const threshold of thresholds) {
                if (workoutCount >= threshold) {
                    generatedAchievements.push({
                        milestone_type: 'workout_count',
                        milestone_value: threshold,
                        achieved_at: new Date().toISOString()
                    });
                }
            }
        }

        // Generate streak achievements
        const streak = pointsData?.current_streak || 0;
        if (streak >= 7) {
            generatedAchievements.push({
                milestone_type: 'workout_streak',
                milestone_value: streak >= 30 ? 30 : (streak >= 14 ? 14 : 7),
                achieved_at: new Date().toISOString()
            });
        }

        // Generate personal bests achievement
        if (personalBests && personalBests.length > 0) {
            generatedAchievements.push({
                milestone_type: 'personal_best',
                milestone_value: personalBests.length,
                achieved_at: new Date().toISOString()
            });
        }

        // Generate points achievement
        if (pointsData && pointsData.lifetime_points >= 10) {
            generatedAchievements.push({
                milestone_type: 'points',
                milestone_value: pointsData.lifetime_points,
                achieved_at: new Date().toISOString()
            });
        }

        achievementsToShow = generatedAchievements;
    }

    if (achievementsToShow.length === 0) {
        container.innerHTML = '<div style="background: white; padding: 20px; border-radius: 16px; box-shadow: var(--card-shadow); text-align: center; color: var(--text-muted);">Complete your first workout to unlock achievements!</div>';
        return;
    }

    const html = achievementsToShow.slice(0, 6).map(m => {
        const emoji = getMilestoneEmoji(m.milestone_type, m.milestone_value);
        const message = getMilestoneMessage(m.milestone_type, m.milestone_value);
        const date = new Date(m.achieved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        return `
            <div style="background: white; padding: 20px; border-radius: 16px; box-shadow: var(--card-shadow); margin-bottom: 12px; display: flex; align-items: center; gap: 15px;">
                <div style="font-size: 2.5rem;">${emoji}</div>
                <div style="flex: 1;">
                    <div style="font-weight: 700; color: var(--primary); font-size: 1rem; margin-bottom: 3px;">${message}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${date}</div>
                </div>
                <button onclick="shareMilestoneToFeed('${message}', '${emoji}')" style="background: linear-gradient(135deg, #f59e0b, #eab308); color: white; border: none; padding: 8px 12px; border-radius: 8px; font-size: 0.75rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                    <span>🎉</span> Share
                </button>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

// Share milestone - go to group chats
function shareMilestoneToFeed(message, emoji) {
    window.pendingWinShare = {
        type: 'milestone',
        message: `${message} ${emoji}`,
        workoutName: '',
        improvement: ''
    };
    switchAppTab('friends');
    showToast('Open a group chat to share your win! 💬', 'success');
}

function renderCheckins(checkins) {
    const container = document.getElementById('checkins-list');
    if (!container) return; // UI element removed in redesign

    if (!checkins || checkins.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">No check-ins yet</div>';
        return;
    }

    const getEnergyEmoji = (level) => {
        if (level === 'high') return '⚡';
        if (level === 'moderate') return '🔋';
        return '🪫';
    };

    const getSleepEmoji = (quality) => {
        if (quality === 'excellent') return '😴';
        if (quality === 'good') return '😊';
        if (quality === 'fair') return '😐';
        return '😓';
    };

    const html = checkins.slice(0, 7).map(c => {
        const date = new Date(c.checkin_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const energyEmoji = getEnergyEmoji(c.energy);
        const sleepEmoji = getSleepEmoji(c.sleep);

        return `
            <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-weight: 600; color: var(--primary); margin-bottom: 3px;">${date}</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">
                        Energy: ${energyEmoji} ${c.energy || 'N/A'} | Sleep: ${sleepEmoji} ${c.sleep || 'N/A'}
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 0.85rem; color: var(--text-muted);">💧 ${c.water_intake || 0} cups</div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

async function renderExerciseProgress(userId, exercises) {
    const dropdown = document.getElementById('exercise-selection-dropdown');
    if (!dropdown) return;

    if (!exercises || exercises.length === 0) {
        dropdown.innerHTML = '<option value="">No exercises tracked yet</option>';
        return;
    }

    // Sort exercises alphabetically
    const sortedExercises = [...exercises].sort();

    // Clear and populate dropdown
    dropdown.innerHTML = '<option value="">Select an exercise...</option>' + 
        sortedExercises.map(ex => `<option value="${ex.replace(/"/g, '&quot;')}">${ex}</option>`).join('');
}

// Show detailed exercise chart modal
async function showExerciseDetailChart(exerciseName, userId) {
    console.log('Opening chart for:', exerciseName);

    // Show modal
    const modal = document.getElementById('exercise-chart-modal');
    modal.style.display = 'flex';
    document.getElementById('exercise-chart-title').innerText = exerciseName;
    document.getElementById('exercise-chart-content').innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">Loading chart...</div>';

    try {
        // Fetch detailed progress (last 20 workouts)
        const progress = await dbHelpers.workouts.getExerciseProgress(userId, exerciseName, 20);

        if (!progress || progress.length === 0) {
            document.getElementById('exercise-chart-content').innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">No progress data available</div>';
            return;
        }

        // Render the chart
        renderExerciseChart(progress);

    } catch (error) {
        console.error('Error loading exercise chart:', error);
        document.getElementById('exercise-chart-content').innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">Failed to load chart</div>';
    }
}

// Close the exercise chart modal
function closeExerciseChartModal() {
    document.getElementById('exercise-chart-modal').style.display = 'none';
}

// Render SVG chart for exercise progress
function renderExerciseChart(progress) {
    const container = document.getElementById('exercise-chart-content');

    // Prepare data
    const dates = progress.map(p => {
        const d = new Date(p.workout_date);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const weights = progress.map(p => parseFloat(p.weight_kg) || 0);
    const reps = progress.map(p => parseInt(p.reps) || 0);

    const hasWeight = weights.some(w => w > 0);
    const hasReps = reps.some(r => r > 0);

    // Chart dimensions
    const width = 400;
    const height = 250;
    const padding = { top: 20, right: 50, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Calculate scales
    const maxWeight = Math.max(...weights, 1);
    const maxReps = Math.max(...reps, 1);

    // Create SVG
    let svg = `<svg viewBox="0 0 ${width} ${height}" style="width: 100%; max-width: 500px; margin: 0 auto; display: block; overflow: visible;">`;

    // Grid lines
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartHeight / 4) * i;
        svg += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#f1f5f9" stroke-width="1"/>`;
    }

    // X-axis labels (dates)
    const labelFrequency = Math.ceil(dates.length / 5);
    const xStep = dates.length > 1 ? chartWidth / (dates.length - 1) : 0;
    dates.forEach((date, i) => {
        if (i % labelFrequency === 0 || i === dates.length - 1) {
            const x = padding.left + xStep * i;
            // Use text-anchor start for first label, end for last, middle for others
            let anchor = 'middle';
            if (i === 0) anchor = 'start';
            else if (i === dates.length - 1 && dates.length > 1) anchor = 'end';
            svg += `<text x="${x}" y="${height - 10}" text-anchor="${anchor}" font-size="10" fill="#718096">${date}</text>`;
        }
    });

    // Y-axis labels and data lines
    const dataXStep = dates.length > 1 ? chartWidth / (dates.length - 1) : 0;

    if (hasWeight) {
        // Weight line (primary - green)
        let weightPath = 'M';
        weights.forEach((weight, i) => {
            const x = padding.left + dataXStep * i;
            const y = padding.top + chartHeight - (weight / maxWeight) * chartHeight;
            weightPath += ` ${x},${y}`;

            // Add point
            svg += `<circle cx="${x}" cy="${y}" r="4" fill="#7BA883" stroke="white" stroke-width="2"/>`;
        });
        svg += `<path d="${weightPath}" fill="none" stroke="#7BA883" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;

        // Y-axis labels for weight
        for (let i = 0; i <= 4; i++) {
            const value = (maxWeight / 4) * (4 - i);
            const y = padding.top + (chartHeight / 4) * i;
            svg += `<text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" font-size="10" fill="#7BA883" font-weight="600">${value.toFixed(0)}kg</text>`;
        }
    }

    if (hasReps) {
        // Reps line (secondary - gold)
        let repsPath = 'M';
        reps.forEach((rep, i) => {
            const x = padding.left + dataXStep * i;
            const y = padding.top + chartHeight - (rep / maxReps) * chartHeight;
            repsPath += ` ${x},${y}`;

            // Add point
            svg += `<circle cx="${x}" cy="${y}" r="4" fill="#E8D68E" stroke="white" stroke-width="2"/>`;
        });
        svg += `<path d="${repsPath}" fill="none" stroke="#E8D68E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;

        // Y-axis labels for reps (on right side)
        for (let i = 0; i <= 4; i++) {
            const value = (maxReps / 4) * (4 - i);
            const y = padding.top + (chartHeight / 4) * i;
            svg += `<text x="${width - padding.right + 10}" y="${y + 4}" text-anchor="start" font-size="10" fill="#E8D68E" font-weight="600">${value.toFixed(0)} reps</text>`;
        }
    }

    svg += '</svg>';

    // Add legend
    let legend = '<div style="display: flex; justify-content: center; gap: 20px; margin-top: 20px; font-size: 0.85rem;">';
    if (hasWeight) {
        legend += '<div style="display: flex; align-items: center; gap: 8px;"><div style="width: 20px; height: 3px; background: #7BA883; border-radius: 2px;"></div><span style="color: var(--text-muted);">Weight (kg)</span></div>';
    }
    if (hasReps) {
        legend += '<div style="display: flex; align-items: center; gap: 8px;"><div style="width: 20px; height: 3px; background: #E8D68E; border-radius: 2px;"></div><span style="color: var(--text-muted);">Reps</span></div>';
    }
    legend += '</div>';

    // Stats summary
    const firstWeight = weights[0] || 0;
    const lastWeight = weights[weights.length - 1] || 0;
    const firstReps = reps[0] || 0;
    const lastReps = reps[reps.length - 1] || 0;
    const weightChange = lastWeight - firstWeight;
    const repsChange = lastReps - firstReps;

    let stats = '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px;">';

    if (hasWeight && weightChange !== 0) {
        stats += `
            <div style="background: #f0fdf4; padding: 15px; border-radius: 12px; text-align: center;">
                <div style="font-size: 1.5rem; font-weight: 700; color: ${weightChange > 0 ? '#10b981' : '#ef4444'};">${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)}kg</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 5px;">Weight Change</div>
            </div>
        `;
    }

    if (hasReps && repsChange !== 0) {
        stats += `
            <div style="background: #fefce8; padding: 15px; border-radius: 12px; text-align: center;">
                <div style="font-size: 1.5rem; font-weight: 700; color: ${repsChange > 0 ? '#10b981' : '#ef4444'};">${repsChange > 0 ? '+' : ''}${repsChange}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 5px;">Reps Change</div>
            </div>
        `;
    }

    stats += '</div>';

    container.innerHTML = `
        <div style="padding: 20px; overflow: visible;">
            ${svg}
            ${legend}
            ${stats}
        </div>
    `;
}
