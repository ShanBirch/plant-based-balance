/** Pure weekly meal evolution helpers shared by the app and tests. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) {
        root.weeklyMealEvolution = api;
        if (typeof root.dispatchEvent === 'function' && typeof root.CustomEvent === 'function') {
            root.dispatchEvent(new root.CustomEvent('pbbWeeklyMealEvolutionReady'));
        }
    }
})(typeof window !== 'undefined' ? window : globalThis, function () {
    const SLOTS = ['breakfast', 'am_snack', 'lunch', 'pm_snack', 'dinner'];
    const VARIATION_KEYS = new Set(['2:lunch', '5:dinner']);
    const MICRO_TARGETS = {
        iron: { name: 'iron', rda: 18, plantRda: 32, foods: 'lentils, tofu, leafy greens and vitamin C-rich produce' },
        calcium: { name: 'calcium', rda: 1000, foods: 'calcium-set tofu, fortified plant milk and leafy greens' },
        b12: { name: 'vitamin B12', rda: 2.4, foods: 'B12-fortified foods' },
        omega3: { name: 'omega-3', rda: 1.6, foods: 'chia, flax, hemp or walnuts' },
        zinc: { name: 'zinc', rda: 11, foods: 'pumpkin seeds, beans, tofu and whole grains' },
        vitamin_d: { name: 'vitamin D', rda: 15, foods: 'vitamin D-fortified foods' },
        iodine: { name: 'iodine', rda: 150, foods: 'iodised salt or another reliable iodine source' },
        folate: { name: 'folate', rda: 400, foods: 'lentils, chickpeas and leafy greens' },
        potassium: { name: 'potassium', rda: 2600, foods: 'potatoes, beans, bananas and leafy greens' },
        magnesium: { name: 'magnesium', rda: 400, foods: 'pumpkin seeds, oats, beans and leafy greens' }
    };
    const MICRO_ALIASES = {
        iron: ['iron', 'iron_mg'], calcium: ['calcium', 'calcium_mg'],
        b12: ['b12', 'b12_mcg', 'vitamin_b12', 'vitamin_b12_mcg'],
        omega3: ['omega3', 'omega3_g', 'omega_3', 'omega_3_g'], zinc: ['zinc', 'zinc_mg'],
        vitamin_d: ['vitamin_d', 'vitamin_d_mcg'], iodine: ['iodine', 'iodine_mcg'],
        folate: ['folate', 'folate_mcg'], potassium: ['potassium', 'potassium_mg'], magnesium: ['magnesium', 'magnesium_mg']
    };

    function normalizeType(type) {
        const value = String(type || '').toLowerCase().replace(/[\s-]+/g, '_');
        if (['breakfast', 'lunch', 'dinner'].includes(value)) return value;
        if (value.includes('snack')) return 'snack';
        return '';
    }
    function mealName(meal) {
        const description = String(meal?.meal_description || meal?.notes || '').trim();
        if (description) return description.slice(0, 90);
        const names = Array.isArray(meal?.food_items) ? meal.food_items.map(item => String(item?.name || '').trim()).filter(Boolean) : [];
        return (names.slice(0, 4).join(', ') || 'Familiar meal').slice(0, 90);
    }
    function compactMeal(meal) {
        return {
            name: mealName(meal), calories: Number(meal?.calories) || 0,
            protein_g: Number(meal?.protein_g) || 0, carbs_g: Number(meal?.carbs_g) || 0,
            fat_g: Number(meal?.fat_g) || 0, fiber_g: Number(meal?.fiber_g) || 0,
            ingredients: Array.isArray(meal?.food_items) ? meal.food_items.slice(0, 12).map(item => ({ name: String(item?.name || '').trim(), amount: String(item?.amount || item?.quantity || '').trim() })).filter(item => item.name) : []
        };
    }
    function assessHistory(meals) {
        const rows = Array.isArray(meals) ? meals : [];
        const days = new Set(rows.map(row => row?.meal_date).filter(Boolean));
        const coreTypes = new Set(rows.map(row => normalizeType(row?.meal_type)).filter(type => ['breakfast', 'lunch', 'dinner'].includes(type)));
        const reasons = [];
        if (rows.length < 10) reasons.push(`log ${10 - rows.length} more meal${10 - rows.length === 1 ? '' : 's'}`);
        if (days.size < 4) reasons.push(`log meals on ${4 - days.size} more day${4 - days.size === 1 ? '' : 's'}`);
        if (coreTypes.size < 3) reasons.push('include breakfast, lunch and dinner');
        return { eligible: rows.length >= 10 && days.size >= 4 && coreTypes.size === 3, mealCount: rows.length, dayCount: days.size, reasons };
    }
    function buildBlueprint(meals) {
        const rows = Array.isArray(meals) ? meals : [];
        const pools = { breakfast: [], lunch: [], dinner: [], snack: [] };
        rows.forEach(row => { const type = normalizeType(row?.meal_type); if (pools[type]) pools[type].push(compactMeal(row)); });
        Object.keys(pools).forEach(key => {
            const seen = new Set();
            pools[key] = pools[key].filter(meal => { const id = meal.name.toLowerCase(); if (seen.has(id)) return false; seen.add(id); return true; });
        });
        const fallback = rows.map(compactMeal);
        const slotPool = slot => (slot === 'am_snack' || slot === 'pm_snack') ? (pools.snack.length ? pools.snack : fallback) : (pools[slot].length ? pools[slot] : fallback);
        const offsets = { breakfast: 0, am_snack: 0, lunch: 1, pm_snack: 1, dinner: 2 };
        const blueprint = [];
        for (let day = 0; day < 7; day++) SLOTS.forEach(slot => {
            const pool = slotPool(slot);
            blueprint.push({ day_of_week: day, meal_slot: slot, base_meal: pool[(day + offsets[slot]) % pool.length], variation: VARIATION_KEYS.has(`${day}:${slot}`) });
        });
        return blueprint;
    }
    function microValue(micros, key) {
        const source = micros && typeof micros === 'object' ? micros : {};
        for (const alias of MICRO_ALIASES[key] || [key]) { const value = Number(source[alias]); if (Number.isFinite(value) && value > 0) return value; }
        return 0;
    }
    function buildNutritionFocus(meals, targets, dietType) {
        const rows = Array.isArray(meals) ? meals : [];
        const days = new Map();
        rows.forEach(row => { if (row?.meal_date) { if (!days.has(row.meal_date)) days.set(row.meal_date, []); days.get(row.meal_date).push(row); } });
        const focus = [];
        const sufficientlyLoggedDays = [...days.values()].filter(dayMeals => dayMeals.length >= 2);
        if (sufficientlyLoggedDays.length >= 3) {
            const average = key => sufficientlyLoggedDays.reduce((sum, dayMeals) => sum + dayMeals.reduce((daySum, meal) => daySum + (Number(meal?.[key]) || 0), 0), 0) / sufficientlyLoggedDays.length;
            const proteinTarget = Number(targets?.protein_goal_g) || 0;
            if (proteinTarget && average('protein_g') < proteinTarget * 0.85) focus.push({ key: 'protein', label: 'Protein', suggestion: 'add a clear protein anchor such as tofu, tempeh, legumes, seitan or a suitable alternative to each main meal' });
            if (average('fiber_g') > 0 && average('fiber_g') < 25) focus.push({ key: 'fiber', label: 'Fibre', suggestion: 'add beans, lentils, oats, whole grains, fruit and vegetables across the day' });
        }
        const isPlantBased = ['vegan', 'vegetarian', 'plant_based', 'plant-based'].includes(String(dietType || '').toLowerCase());
        Object.entries(MICRO_TARGETS).forEach(([key, definition]) => {
            const measuredDays = [];
            days.forEach(dayMeals => { const total = dayMeals.reduce((sum, meal) => sum + microValue(meal?.micronutrients, key), 0); if (total > 0) measuredDays.push(total); });
            if (measuredDays.length < 3) return;
            const average = measuredDays.reduce((sum, value) => sum + value, 0) / measuredDays.length;
            const rda = isPlantBased && definition.plantRda ? definition.plantRda : definition.rda;
            if (average < rda * 0.7) focus.push({ key, label: definition.name, suggestion: `work in ${definition.foods}` });
        });
        return focus.slice(0, 3);
    }
    function guidanceText(focus, mealCount) {
        const intro = `Built from ${mealCount} logged meals. Most meals stay familiar, with two small variations this week.`;
        if (!focus?.length) return `${intro} Keep logging meals so Balance can make the nutrition guidance more precise.`;
        return `${intro} Nutrition focus: ${focus.map(item => `${item.label}: ${item.suggestion}`).join(' | ')}. These are estimates from logged meals, not a diagnosis.`;
    }

    function weeklyCycle(nowValue) {
        const now = new Date(nowValue || Date.now());
        const day = now.getDay();
        const targetMonday = new Date(now);
        targetMonday.setHours(0, 0, 0, 0);
        targetMonday.setDate(now.getDate() + (day === 0 ? 1 : day === 1 ? 0 : 8 - day));
        const opensAt = new Date(targetMonday);
        opensAt.setDate(targetMonday.getDate() - 1);
        const closesAt = new Date(targetMonday);
        closesAt.setDate(targetMonday.getDate() + 1);
        const key = `${targetMonday.getFullYear()}-${String(targetMonday.getMonth() + 1).padStart(2, '0')}-${String(targetMonday.getDate()).padStart(2, '0')}`;
        return { key, targetMonday, opensAt, closesAt, isBuildWindow: day === 0 || day === 1 };
    }

    function isEvolvingPlan(plan) {
        return String(plan?.plan_name || '') === 'Your Evolving Weekly Plan';
    }

    function isPlanFreshForCycle(plan, nowValue) {
        if (!isEvolvingPlan(plan)) return false;
        const generatedAt = new Date(plan?.generated_at || plan?.created_at || 0);
        const cycle = weeklyCycle(nowValue);
        return Number.isFinite(generatedAt.getTime()) && generatedAt >= cycle.opensAt && generatedAt < cycle.closesAt;
    }

    function shouldAutoBuild({ now, plan, coverage, lastAttemptAt, retryHours = 6 } = {}) {
        const cycle = weeklyCycle(now);
        if (!cycle.isBuildWindow || !coverage?.eligible || isPlanFreshForCycle(plan, now)) return false;
        const attemptedAt = new Date(lastAttemptAt || 0);
        if (!Number.isFinite(attemptedAt.getTime()) || attemptedAt.getTime() <= 0) return true;
        return new Date(now || Date.now()).getTime() - attemptedAt.getTime() >= retryHours * 3600000;
    }

    return {
        SLOTS, assessHistory, buildBlueprint, buildNutritionFocus, guidanceText,
        mealName, normalizeType, weeklyCycle, isEvolvingPlan, isPlanFreshForCycle, shouldAutoBuild
    };
});
