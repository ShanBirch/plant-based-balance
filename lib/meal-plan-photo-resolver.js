/**
 * Resolves every meal-plan meal to the closest photo in the curated library.
 * Explicit meal photos always win. Photo-less legacy and evolving meals are
 * matched by their name, description and ingredients, then fall back to a
 * deterministic photo from the same meal slot.
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
    const STOP_WORDS = new Set([
        'a', 'an', 'and', 'with', 'the', 'of', 'for', 'to', 'in', 'on', 'or',
        'vegan', 'plant', 'based', 'high', 'protein', 'meal', 'fresh', 'whole',
        'easy', 'quick', 'healthy', 'style', 'power', 'pack'
    ]);

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

    function tokens(value) {
        return new Set(normalizeText(value).split(/\s+/).filter(token => token.length > 2 && !STOP_WORDS.has(token)));
    }

    function slotGroup(value) {
        const slot = normalizeText(value).replace(/\s+/g, '_');
        if (slot.includes('snack')) return 'snack';
        if (slot.includes('breakfast')) return 'breakfast';
        if (slot.includes('lunch')) return 'lunch';
        if (slot.includes('dinner')) return 'dinner';
        return '';
    }

    function ingredientNames(ingredients) {
        return (Array.isArray(ingredients) ? ingredients : []).map(ingredient => {
            if (typeof ingredient === 'string') return ingredient;
            return ingredient && typeof ingredient === 'object' ? ingredient.name || '' : '';
        }).filter(Boolean).join(' ');
    }

    function mealSearchText(meal) {
        return [meal?.name, meal?.description, ingredientNames(meal?.ingredients)].filter(Boolean).join(' ');
    }

    function overlapScore(left, right) {
        let score = 0;
        left.forEach(token => {
            if (!right.has(token)) return;
            score += token.length >= 7 ? 12 : token.length >= 5 ? 9 : 6;
        });
        return score;
    }

    function stableHash(value) {
        let hash = 2166136261;
        const text = String(value || 'meal');
        for (let index = 0; index < text.length; index += 1) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    function recipeCandidates(template) {
        const recipes = template && template.RECIPES ? Object.values(template.RECIPES) : [];
        return recipes.map(recipe => ({
            recipe,
            url: safeImageUrl(recipe?.image),
            normalizedName: normalizeText(recipe?.name),
            searchTokens: tokens(mealSearchText(recipe)),
            slot: slotGroup(recipe?.slot)
        })).filter(candidate => candidate.url);
    }

    function resolve(meal, template) {
        const explicit = [meal?.image_url, meal?.image, meal?.photo_url].map(safeImageUrl).find(Boolean) || '';
        if (explicit) return { url: explicit, source: 'explicit', recipeName: null };

        const candidates = recipeCandidates(template);
        if (!candidates.length) return { url: '', source: 'missing', recipeName: null };

        const targetName = normalizeText(meal?.name);
        const targetSlot = slotGroup(meal?.meal_slot || meal?.slot || meal?.meal_type);
        const targetTokens = tokens(mealSearchText(meal));
        let pool = targetSlot ? candidates.filter(candidate => candidate.slot === targetSlot) : candidates;
        if (!pool.length) pool = candidates;

        const exact = pool.find(candidate => candidate.normalizedName === targetName);
        if (exact) return { url: exact.url, source: 'exact', recipeName: exact.recipe.name };

        const scored = pool.map(candidate => ({
            ...candidate,
            score: overlapScore(targetTokens, candidate.searchTokens)
        })).sort((left, right) => right.score - left.score || left.url.localeCompare(right.url));

        if (scored[0].score > 0) {
            return { url: scored[0].url, source: 'matched', recipeName: scored[0].recipe.name };
        }

        const fallback = pool[stableHash(`${targetSlot}:${targetName}`) % pool.length];
        return { url: fallback.url, source: 'slot_fallback', recipeName: fallback.recipe.name };
    }

    return { resolve, safeImageUrl, slotGroup };
});
