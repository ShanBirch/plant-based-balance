/**
 * Resolves a meal-plan meal only when the photo is known to depict that exact
 * meal. Generated/member photos win, while curated photos are used only for an
 * exact recipe-name match. A missing photo is intentionally better than a
 * misleading photo of a different meal.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) {
        root.mealPlanPhotoResolver = api;
        root.resolveMealPlanPhoto = function (meal) {
            return api.resolve(meal, root.VEGAN_CHALLENGE_MEAL_PLAN).url;
        };
        root.resolveMealPlanPhotoDetails = function (meal) {
            return api.resolve(meal, root.VEGAN_CHALLENGE_MEAL_PLAN);
        };
    }
})(typeof window !== 'undefined' ? window : globalThis, function () {
    function safeImageUrl(value) {
        const url = String(value || '').trim();
        return /^(?:https:\/\/|images\/meals\/)[^"'<>]+$/i.test(url) ? url : '';
    }

    function normalizeText(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    function slotGroup(value) {
        const slot = normalizeText(value).replace(/\s+/g, '_');
        if (slot.includes('snack')) return 'snack';
        if (slot.includes('breakfast')) return 'breakfast';
        if (slot.includes('lunch')) return 'lunch';
        if (slot.includes('dinner')) return 'dinner';
        return '';
    }

    function recipeCandidates(template) {
        const recipes = template && template.RECIPES ? Object.values(template.RECIPES) : [];
        return recipes.map(recipe => ({
            recipe,
            url: safeImageUrl(recipe?.image),
            normalizedName: normalizeText(recipe?.name)
        })).filter(candidate => candidate.url);
    }

    function resolve(meal, template) {
        // User photos and generated remote photos describe this specific meal.
        const remoteExplicit = [meal?.photo_url, meal?.image_url, meal?.image]
            .map(safeImageUrl)
            .find(url => /^https:\/\//i.test(url)) || '';
        if (remoteExplicit) return { url: remoteExplicit, source: 'explicit', recipeName: null };

        const candidates = recipeCandidates(template);
        if (!candidates.length) return { url: '', source: 'missing', recipeName: null };

        const targetName = normalizeText(meal?.name);
        const exact = candidates.find(candidate => candidate.normalizedName === targetName);
        if (exact) return { url: exact.url, source: 'exact', recipeName: exact.recipe.name };

        return { url: '', source: 'missing', recipeName: null };
    }

    return { resolve, safeImageUrl, slotGroup };
});
