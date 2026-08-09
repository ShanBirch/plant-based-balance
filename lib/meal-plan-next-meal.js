(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.BalanceMealPlanNext = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    const SLOT_ORDER = ['breakfast', 'am_snack', 'lunch', 'pm_snack', 'dinner'];

    function normaliseSlot(value) {
        const slot = String(value || '').trim().toLowerCase().replace(/[ -]+/g, '_');
        if (slot === 'morning_snack' || slot === 'snack_morning') return 'am_snack';
        if (slot === 'afternoon_snack' || slot === 'snack_afternoon') return 'pm_snack';
        if (slot === 'snack') return 'snack';
        return slot;
    }

    function logMatchesMeal(logType, mealSlot) {
        const log = normaliseSlot(logType);
        const meal = normaliseSlot(mealSlot);
        if (log === meal) return true;
        return log === 'snack' && (meal === 'am_snack' || meal === 'pm_snack');
    }

    function sortMeals(meals) {
        return (Array.isArray(meals) ? meals : []).map((meal, originalIndex) => ({ meal, originalIndex }))
            .sort((a, b) => {
                const aIndex = SLOT_ORDER.indexOf(normaliseSlot(a.meal?.meal_slot));
                const bIndex = SLOT_ORDER.indexOf(normaliseSlot(b.meal?.meal_slot));
                return (aIndex < 0 ? 99 : aIndex) - (bIndex < 0 ? 99 : bIndex);
            });
    }

    function completionState(meals, loggedMealTypes) {
        const remainingLogs = (Array.isArray(loggedMealTypes) ? loggedMealTypes : []).map(normaliseSlot);
        return sortMeals(meals).map(entry => {
            const matchIndex = remainingLogs.findIndex(log => logMatchesMeal(log, entry.meal?.meal_slot));
            if (matchIndex < 0) return { ...entry, complete: false };
            remainingLogs.splice(matchIndex, 1);
            return { ...entry, complete: true };
        });
    }

    function nextMealIndex(meals, loggedMealTypes) {
        const state = completionState(meals, loggedMealTypes);
        const next = state.find(entry => !entry.complete);
        return next ? next.originalIndex : (state.length ? state[state.length - 1].originalIndex : -1);
    }

    return { SLOT_ORDER, normaliseSlot, logMatchesMeal, sortMeals, completionState, nextMealIndex };
});
