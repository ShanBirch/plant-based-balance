// ── Equipment Picker ──────────────────────────────────────────
const _eqOptions = [
    { value: 'gym',       label: 'Full Gym Access',        icon: '🏋️' },
    { value: 'dumbbells', label: 'Home / Dumbbells',       icon: '🏠' },
    { value: 'bands',     label: 'Resistance Bands',       icon: '💪' },
    { value: 'yoga_only', label: 'Yoga / Stretching Only', icon: '🧘' },
    { value: 'none',      label: 'No Equipment',           icon: '🚶' }
];

function openEquipmentPicker() {
    const current = (document.getElementById('profile-equipment-display')?.dataset.raw) || 'none';
    const container = document.getElementById('equipment-picker-options');
    container.innerHTML = _eqOptions.map(opt => `
        <div onclick="selectEquipment('${opt.value}')" style="display:flex; align-items:center; gap:14px; padding:14px 12px; border-radius:12px; cursor:pointer; margin-bottom:6px; background:${opt.value===current?'#f0fdf4':'#f8fafc'}; border:2px solid ${opt.value===current?'var(--primary)':'transparent'};">
            <span style="font-size:1.4rem;">${opt.icon}</span>
            <span style="font-weight:600; font-size:0.95rem; color:var(--text-main);">${opt.label}</span>
            ${opt.value===current?'<svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:var(--primary);margin-left:auto;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>':''}
        </div>
    `).join('');
    const overlay = document.getElementById('equipment-picker-overlay');
    overlay.style.display = 'flex';
}

function closeEquipmentPicker() {
    document.getElementById('equipment-picker-overlay').style.display = 'none';
}

async function selectEquipment(value) {
    closeEquipmentPicker();
    const eqMap = { gym:'Full Gym Access', dumbbells:'Home / Dumbbells', home:'Home / Dumbbells', bands:'Resistance Bands', yoga_only:'Yoga / Stretching Only', none:'No Equipment', bodyweight:'No Equipment' };
    const display = document.getElementById('profile-equipment-display');
    if (display) { display.textContent = eqMap[value] || 'No Equipment'; display.dataset.raw = value; }

    // Persist to all stores
    try {
        const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
        userProfile.equipment_access = value;
        userProfile.gym_access = (value === 'gym');
        userProfile.equipment_updated_at = new Date().toISOString();
        localStorage.setItem('userProfile', JSON.stringify(userProfile));
        localStorage.setItem('equipmentUpdatedAt', userProfile.equipment_updated_at);

        if (window.userProfile) { window.userProfile.equipment_access = value; window.userProfile.gym_access = (value === 'gym'); }
        try { const s = JSON.parse(sessionStorage.getItem('userProfile') || '{}'); s.equipment_access = value; s.gym_access = (value === 'gym'); sessionStorage.setItem('userProfile', JSON.stringify(s)); } catch(e){}

        if (window.currentUser && window.supabaseClient) {
            await window.supabaseClient.from('quiz_results').update({ equipment_access: value }).eq('user_id', window.currentUser.id);
        }

        // Refresh workout views
        if (typeof renderMovementView === 'function') setTimeout(renderMovementView, 100);
        if (typeof renderWeeklyCalendar === 'function') setTimeout(renderWeeklyCalendar, 150);
    } catch(e) { console.error('Failed to save equipment:', e); }
}

// ── Dietary Preference Picker ─────────────────────────────────
const _dietOptions = [
    { value: 'omnivore',     label: 'Omnivore',     icon: '🍖' },
    { value: 'flexitarian',  label: 'Flexitarian',  icon: '🥗' },
    { value: 'pescatarian',  label: 'Pescatarian',  icon: '🐟' },
    { value: 'vegetarian',   label: 'Vegetarian',   icon: '🥦' },
    { value: 'vegan',        label: 'Vegan',        icon: '🌱' }
];

function openDietaryPicker() {
    const dietLabels = { omnivore:'Omnivore', pescatarian:'Pescatarian', vegetarian:'Vegetarian', vegan:'Vegan', flexitarian:'Flexitarian' };
    const currentText = document.getElementById('profile-diet-display')?.textContent || 'Not set';
    const current = Object.keys(dietLabels).find(k => dietLabels[k] === currentText) || '';
    const container = document.getElementById('dietary-picker-options');
    container.innerHTML = _dietOptions.map(opt => `
        <div onclick="selectDietaryPreference('${opt.value}')" style="display:flex; align-items:center; gap:14px; padding:14px 12px; border-radius:12px; cursor:pointer; margin-bottom:6px; background:${opt.value===current?'#f0fdf4':'#f8fafc'}; border:2px solid ${opt.value===current?'var(--primary)':'transparent'};">
            <span style="font-size:1.4rem;">${opt.icon}</span>
            <span style="font-weight:600; font-size:0.95rem; color:var(--text-main);">${opt.label}</span>
            ${opt.value===current?'<svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:var(--primary);margin-left:auto;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>':''}
        </div>
    `).join('');
    const overlay = document.getElementById('dietary-picker-overlay');
    overlay.style.display = 'flex';
}

function closeDietaryPicker() {
    document.getElementById('dietary-picker-overlay').style.display = 'none';
}

async function selectDietaryPreference(value) {
    closeDietaryPicker();
    const dietLabels = { omnivore:'Omnivore', pescatarian:'Pescatarian', vegetarian:'Vegetarian', vegan:'Vegan', flexitarian:'Flexitarian' };
    const display = document.getElementById('profile-diet-display');
    if (display) display.textContent = dietLabels[value] || value;

    // Persist to all stores
    try {
        localStorage.setItem('dietaryPreference', value);
        const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
        userProfile.dietary_preference = value;
        localStorage.setItem('userProfile', JSON.stringify(userProfile));

        if (window.userProfile) window.userProfile.dietary_preference = value;
        try { const s = JSON.parse(sessionStorage.getItem('userProfile') || '{}'); s.dietary_preference = value; sessionStorage.setItem('userProfile', JSON.stringify(s)); } catch(e){}

        if (window.currentUser && window.supabaseClient) {
            await window.supabaseClient.from('quiz_results').update({ dietary_preference: value }).eq('user_id', window.currentUser.id);
        }

        // Refresh nutrition view if function available
        if (typeof refreshMealPlanForDiet === 'function') setTimeout(() => refreshMealPlanForDiet(value), 100);
    } catch(e) { console.error('Failed to save dietary preference:', e); }
}