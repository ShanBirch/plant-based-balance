(function(root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) {
        root.getVeganMealSafetyIssue = api.getVeganMealSafetyIssue;
        root.isVeganMealFeedStory = api.isVeganMealFeedStory;
        root.isVeganFeedViewer = api.isVeganFeedViewer;
        root.shouldShowMealFeedStory = api.shouldShowMealFeedStory;
    }
})(typeof window !== 'undefined' ? window : globalThis, function(root) {
    const SAFE_ANIMAL_WORD_PHRASES = new RegExp(
        String.raw`\b(?:vegan|plant[ -]?based|dairy[ -]?free|non[ -]?dairy|coconut|soy|soya|oat|almond|cashew|hemp|pea|macadamia|rice)\s+(?:milk|cheese|yogh?urt|cream|ice cream|egg(?:s)?)\b|\b(?:just egg|egg replacer|egg substitute)\b`,
        'gi'
    );

    const UNSAFE_TERMS = [
        { key: 'egg', label: 'egg', pattern: /\beggs?\b/i },
        { key: 'yogurt', label: 'dairy yoghurt', pattern: /\byogh?urt\b/i },
        { key: 'milk', label: 'dairy milk', pattern: /\b(?:skim|cow(?:'s)?|full[ -]?cream)?\s*milk\b/i },
        { key: 'cheese', label: 'dairy cheese', pattern: /\b(?:cheese|cheddar|parmesan|mozzarella|feta|halloumi|ricotta|paneer)\b/i },
        { key: 'dairy', label: 'dairy', pattern: /\bdairy\b/i },
        { key: 'whey', label: 'whey', pattern: /\b(?:whey|wpi|casein)\b/i },
        { key: 'honey', label: 'honey', pattern: /\bhoney\b/i },
        { key: 'meat', label: 'meat', pattern: /\b(?:meat|beef|steak|veal|chicken|turkey|duck|pork|bacon|ham|lamb|mutton)\b/i },
        { key: 'seafood', label: 'fish or seafood', pattern: /\b(?:fish|salmon|tuna|prawn|prawns|shrimp|cod|barramundi|sardines?|anchov(?:y|ies))\b/i },
        { key: 'animal_product', label: 'an animal product', pattern: /\b(?:gelatin|gelatine|collagen|bone broth|lard)\b/i }
    ];

    function collectMealText(value, depth) {
        if (depth > 5 || value === null || value === undefined) return '';
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return '';
            if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && trimmed.length < 100000) {
                try { return collectMealText(JSON.parse(trimmed), depth + 1); } catch (_) {}
            }
            return trimmed;
        }
        if (typeof value === 'number' || typeof value === 'boolean') return '';
        if (Array.isArray(value)) return value.map(item => collectMealText(item, depth + 1)).filter(Boolean).join(' ');
        if (typeof value === 'object') {
            return Object.entries(value)
                .filter(([key]) => !/(?:url|photo|image|media|thumbnail|storage|id|color)/i.test(key))
                .map(([, item]) => collectMealText(item, depth + 1))
                .filter(Boolean)
                .join(' ');
        }
        return '';
    }

    function getVeganMealSafetyIssue(value) {
        const text = collectMealText(value, 0).replace(SAFE_ANIMAL_WORD_PHRASES, ' ');
        for (const term of UNSAFE_TERMS) {
            if (term.pattern.test(text)) return { key: term.key, label: term.label };
        }
        return null;
    }

    function isVeganMealFeedStory(story) {
        if (!story || !['meal_card', 'nutrition_card'].includes(String(story.media_type || ''))) return true;
        let card = story.caption;
        if (typeof card === 'string') {
            try { card = JSON.parse(card); } catch (_) {}
        }
        const isMealCard = story.media_type === 'meal_card'
            || String(card && card.card_type || '').toLowerCase() === 'meal';
        return !isMealCard || !getVeganMealSafetyIssue(card);
    }

    function collectViewerDietTokens(explicitDiet) {
        const tokens = [];
        const add = value => {
            if (Array.isArray(value)) return value.forEach(add);
            if (value === null || value === undefined) return;
            const normalized = String(value).trim().toLowerCase().replace(/[\s-]+/g, '_');
            if (normalized) tokens.push(normalized);
        };

        if (explicitDiet !== undefined) {
            add(explicitDiet);
            return tokens;
        }

        add(root && root.userProfile && root.userProfile.dietary_preference);
        add(root && root.userProfile && root.userProfile.dietary_requirements);
        try {
            const storage = root && root.localStorage;
            if (!storage) return tokens;
            add(storage.getItem('dietaryPreference'));
            add(JSON.parse(storage.getItem('dietaryRequirements') || 'null'));
            const foodPrefs = JSON.parse(storage.getItem('user_food_preferences') || '{}');
            add(foodPrefs.diet_type);
            add(foodPrefs.dietary_requirements);
        } catch (_) {}
        return tokens;
    }

    function isVeganFeedViewer(explicitDiet) {
        return collectViewerDietTokens(explicitDiet).some(value => value === 'vegan' || value === 'plant_based');
    }

    function shouldShowMealFeedStory(story, viewerDiet) {
        return !isVeganFeedViewer(viewerDiet) || isVeganMealFeedStory(story);
    }

    return { getVeganMealSafetyIssue, isVeganMealFeedStory, isVeganFeedViewer, shouldShowMealFeedStory };
});
