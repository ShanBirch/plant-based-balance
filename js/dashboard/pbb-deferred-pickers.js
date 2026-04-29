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

// ── Dietary Requirements Picker (multi-select) ────────────────
// Tags split into eating-style (a single dominant style is derived from these
// for the legacy single-string `dietary_preference` field) and restriction
// tags (which mirror to `allergies[]` for the meal-plan allergy filter).
const _dietEatingStyles = [
    { value: 'omnivore',      label: 'Omnivore',      icon: '🍖' },
    { value: 'flexitarian',   label: 'Flexitarian',   icon: '🥗' },
    { value: 'pescatarian',   label: 'Pescatarian',   icon: '🐟' },
    { value: 'vegetarian',    label: 'Vegetarian',    icon: '🥦' },
    { value: 'vegan',         label: 'Vegan',         icon: '🌱' },
    { value: 'mediterranean', label: 'Mediterranean', icon: '🫒' },
    { value: 'keto',          label: 'Keto',          icon: '🥑' },
    { value: 'paleo',         label: 'Paleo',         icon: '🥩' },
    { value: 'whole30',       label: 'Whole30',       icon: '🍳' }
];
const _dietRestrictions = [
    { value: 'gluten_free',    label: 'Gluten-Free',    icon: '🌾' },
    { value: 'dairy_free',     label: 'Dairy-Free',     icon: '🥛' },
    { value: 'nut_free',       label: 'Nut-Free',       icon: '🥜' },
    { value: 'soy_free',       label: 'Soy-Free',       icon: '🫘' },
    { value: 'egg_free',       label: 'Egg-Free',       icon: '🥚' },
    { value: 'shellfish_free', label: 'Shellfish-Free', icon: '🦐' },
    { value: 'low_fodmap',     label: 'Low FODMAP',     icon: '🍎' },
    { value: 'low_sodium',     label: 'Low Sodium',     icon: '🧂' },
    { value: 'low_sugar',      label: 'Low Sugar',      icon: '🍬' },
    { value: 'halal',          label: 'Halal',          icon: '☪️' },
    { value: 'kosher',         label: 'Kosher',         icon: '✡️' }
];

const _DIET_EATING_STYLE_PRIORITY = ['vegan', 'vegetarian', 'pescatarian', 'flexitarian', 'omnivore'];
const _DIET_RESTRICTION_TO_ALLERGY = {
    gluten_free:    'gluten',
    dairy_free:     'dairy',
    nut_free:       'nuts',
    soy_free:       'soy',
    egg_free:       'eggs',
    shellfish_free: 'shellfish',
    low_fodmap:     'fodmap'
};

let _dietPickerSelected = new Set();

function _loadCurrentDietaryRequirements() {
    // Prefer the dedicated localStorage key, then user_food_preferences,
    // then fall back to the legacy single-string `dietaryPreference`.
    try {
        const raw = JSON.parse(localStorage.getItem('dietaryRequirements') || 'null');
        if (Array.isArray(raw)) return new Set(raw);
    } catch(e) {}
    try {
        const fp = JSON.parse(localStorage.getItem('user_food_preferences') || '{}');
        if (Array.isArray(fp.dietary_requirements)) return new Set(fp.dietary_requirements);
    } catch(e) {}
    const legacy = localStorage.getItem('dietaryPreference');
    return new Set(legacy ? [legacy] : []);
}

function _renderDietaryPickerChips() {
    const container = document.getElementById('dietary-picker-options');
    if (!container) return;
    const renderGroup = (title, opts) => `
        <div style="font-weight:600; font-size:0.78rem; color:#475569; margin:6px 0 8px;">${title}</div>
        <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:14px;">
            ${opts.map(opt => {
                const sel = _dietPickerSelected.has(opt.value);
                return `<div onclick="toggleDietaryPickerChip('${opt.value}')" style="display:inline-flex; align-items:center; gap:6px; padding:8px 12px; border-radius:999px; cursor:pointer; font-size:0.82rem; font-weight:600; background:${sel?'#dcfce7':'#f1f5f9'}; color:${sel?'#166534':'var(--text-main)'}; border:2px solid ${sel?'var(--primary)':'transparent'}; transition:all 0.15s ease;">
                    <span>${opt.icon}</span><span>${opt.label}</span>
                </div>`;
            }).join('')}
        </div>`;
    container.innerHTML = renderGroup('Eating style', _dietEatingStyles)
        + renderGroup('Restrictions & allergies', _dietRestrictions);
}

function openDietaryPicker() {
    _dietPickerSelected = _loadCurrentDietaryRequirements();
    _renderDietaryPickerChips();
    const overlay = document.getElementById('dietary-picker-overlay');
    overlay.style.display = 'flex';
}

function closeDietaryPicker() {
    document.getElementById('dietary-picker-overlay').style.display = 'none';
}

function toggleDietaryPickerChip(value) {
    if (_dietPickerSelected.has(value)) _dietPickerSelected.delete(value);
    else _dietPickerSelected.add(value);
    _renderDietaryPickerChips();
}
window.toggleDietaryPickerChip = toggleDietaryPickerChip;

function _deriveDietType(reqs) {
    for (const tag of _DIET_EATING_STYLE_PRIORITY) if (reqs.has(tag)) return tag;
    return 'omnivore';
}

function _deriveAllergies(reqs) {
    const out = [];
    for (const [tag, key] of Object.entries(_DIET_RESTRICTION_TO_ALLERGY)) {
        if (reqs.has(tag)) out.push(key);
    }
    return out;
}

async function saveDietaryPreferences() {
    const requirements = Array.from(_dietPickerSelected);
    const dietType = _deriveDietType(_dietPickerSelected);
    const allergyKeys = _deriveAllergies(_dietPickerSelected);

    closeDietaryPicker();

    // Update display
    const reqLabels = {};
    [..._dietEatingStyles, ..._dietRestrictions].forEach(o => { reqLabels[o.value] = o.label; });
    const display = document.getElementById('profile-diet-display');
    if (display) {
        display.textContent = requirements.length
            ? requirements.map(r => reqLabels[r] || r).join(', ')
            : 'Not set';
    }

    try {
        // Legacy single-string field (kept for backward compatibility).
        localStorage.setItem('dietaryPreference', dietType);
        localStorage.setItem('dietaryRequirements', JSON.stringify(requirements));

        const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
        userProfile.dietary_preference = dietType;
        userProfile.dietary_requirements = requirements;
        localStorage.setItem('userProfile', JSON.stringify(userProfile));

        if (window.userProfile) {
            window.userProfile.dietary_preference = dietType;
            window.userProfile.dietary_requirements = requirements;
        }
        try {
            const s = JSON.parse(sessionStorage.getItem('userProfile') || '{}');
            s.dietary_preference = dietType;
            s.dietary_requirements = requirements;
            sessionStorage.setItem('userProfile', JSON.stringify(s));
        } catch(e){}

        // Merge allergies derived from restriction tags into the existing food-prefs row
        // so the meal-plan allergy filter sees them. Other allergy entries (e.g., user-typed)
        // are preserved.
        let foodPrefs = {};
        try { foodPrefs = JSON.parse(localStorage.getItem('user_food_preferences') || '{}'); } catch(e){}
        const existingAllergies = new Set(Array.isArray(foodPrefs.allergies) ? foodPrefs.allergies : []);
        // Drop any previously-derived restriction allergies before adding the new set, so
        // unticking "Gluten-Free" actually removes "gluten" from the list.
        for (const k of Object.values(_DIET_RESTRICTION_TO_ALLERGY)) existingAllergies.delete(k);
        for (const k of allergyKeys) existingAllergies.add(k);
        foodPrefs.diet_type = dietType;
        foodPrefs.dietary_requirements = requirements;
        foodPrefs.allergies = Array.from(existingAllergies);
        try { localStorage.setItem('user_food_preferences', JSON.stringify(foodPrefs)); } catch(e){}

        if (window.currentUser && window.supabaseClient) {
            // Update legacy column on quiz_results for any consumer reading it directly.
            window.supabaseClient.from('quiz_results')
                .update({ dietary_preference: dietType })
                .eq('user_id', window.currentUser.id)
                .then(() => {});
            // Upsert the full preference row so the meal-plan generator sees the new tags.
            window.supabaseClient.from('user_food_preferences')
                .upsert({ user_id: window.currentUser.id, ...foodPrefs }, { onConflict: 'user_id' })
                .then(({ error }) => { if (error) console.warn('user_food_preferences upsert failed:', error); });
        }

        // Refresh nutrition view if function available
        if (typeof refreshMealPlanForDiet === 'function') setTimeout(() => refreshMealPlanForDiet(dietType), 100);
    } catch(e) { console.error('Failed to save dietary requirements:', e); }
}
window.saveDietaryPreferences = saveDietaryPreferences;