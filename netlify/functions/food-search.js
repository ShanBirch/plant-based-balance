const USDA_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';

function number(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function round1(value) {
    return Math.round(number(value) * 10) / 10;
}

function nutrient(food, id) {
    const found = (food.foodNutrients || []).find((entry) => Number(entry.nutrientId) === id);
    return found ? number(found.value) : 0;
}

function cleanMeasures(food) {
    const seen = new Set();
    const measures = [];
    const sourceMeasures = (food.foodMeasures || []).slice().sort((a, b) => number(a.rank) - number(b.rank));
    for (const measure of sourceMeasures) {
        const grams = number(measure.gramWeight);
        const label = String(measure.disseminationText || measure.modifier || '').trim();
        if (!label || grams <= 0 || /quantity not specified/i.test(label)) continue;
        const key = `${label.toLowerCase()}|${grams}`;
        if (seen.has(key)) continue;
        seen.add(key);
        measures.push({ label, grams: round1(grams) });
        if (measures.length >= 8) break;
    }

    const servingSize = number(food.servingSize);
    if (servingSize > 0 && food.servingSizeUnit) {
        const label = `1 serving (${round1(servingSize)} ${food.servingSizeUnit})`;
        measures.unshift({ label, grams: round1(servingSize) });
    }
    if (!measures.some((measure) => measure.grams === 100)) {
        measures.push({ label: '100 g', grams: 100 });
    }
    return measures.slice(0, 9);
}

function normalizeFood(food) {
    const calories = nutrient(food, 1008) || nutrient(food, 2047) || nutrient(food, 2048);
    const description = String(food.description || '').trim();
    const brand = String(food.brandOwner || food.brandName || '').trim();
    const measures = cleanMeasures(food);
    return {
        id: String(food.fdcId || ''),
        name: description ? description.toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()) : 'Food',
        brand,
        dataType: String(food.dataType || ''),
        per100g: {
            calories: round1(calories),
            protein_g: round1(nutrient(food, 1003)),
            carbs_g: round1(nutrient(food, 1005)),
            fat_g: round1(nutrient(food, 1004)),
            fiber_g: round1(nutrient(food, 1079))
        },
        micronutrientsPer100g: {
            vitamin_c_mg: round1(nutrient(food, 1162)),
            iron_mg: round1(nutrient(food, 1089)),
            calcium_mg: round1(nutrient(food, 1087)),
            potassium_mg: round1(nutrient(food, 1092)),
            vitamin_a_mcg: round1(nutrient(food, 1106)),
            vitamin_d_mcg: round1(nutrient(food, 1114))
        },
        measures
    };
}

exports.handler = async (event) => {
    const query = String(event.queryStringParameters?.q || '').trim().slice(0, 80);
    if (query.length < 2) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: 'Enter at least two characters' })
        };
    }

    try {
        const apiKey = process.env.USDA_FOODDATA_API_KEY || 'DEMO_KEY';
        const response = await fetch(`${USDA_SEARCH_URL}?api_key=${encodeURIComponent(apiKey)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
                query,
                pageSize: 16,
                pageNumber: 1,
                dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded']
            })
        });
        if (!response.ok) throw new Error(`USDA returned ${response.status}`);
        const data = await response.json();
        function searchRank(food) {
            const description = String(food.description || '').toLowerCase();
            const needle = query.toLowerCase();
            let rank = /Foundation|SR Legacy|Survey/.test(String(food.dataType || '')) ? 500 : 0;
            if (description === needle) rank += 1200;
            else if (description === `${needle}, raw` || description === `${needle}s, raw`) rank += 1050;
            else if (description.startsWith(`${needle},`)) rank += 500;
            if (!/dehydrat|powder|chip|nectar|baked|fried/.test(needle) && /dehydrat|powder|chip|nectar|baked|fried/.test(description)) rank -= 400;
            rank += number(food.score) / 1000;
            return rank;
        }
        const foods = (data.foods || []).slice().sort((a, b) => {
            return searchRank(b) - searchRank(a);
        });
        const results = foods
            .map(normalizeFood)
            .filter((food) => food.name && food.per100g.calories > 0)
            .slice(0, 12);
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
                'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=3600, stale-while-revalidate=86400'
            },
            body: JSON.stringify({ success: true, query, results })
        };
    } catch (error) {
        console.error('food-search failed', error);
        return {
            statusCode: 502,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: 'Food search is temporarily unavailable' })
        };
    }
};

exports._test = { normalizeFood, cleanMeasures, nutrient };
