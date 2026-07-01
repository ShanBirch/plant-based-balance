const OFF_FIELDS = [
    'code',
    'product_name',
    'product_name_en',
    'brands',
    'quantity',
    'serving_size',
    'image_front_small_url',
    'image_url',
    'nutriments'
].join(',');

const OFF_ENDPOINTS = [
    'https://au.openfoodfacts.org',
    'https://world.openfoodfacts.org'
];

function num(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function round1(value) {
    return Math.round(num(value) * 10) / 10;
}

function readCalories(nutrients, suffix) {
    const kcal = num(nutrients[`energy-kcal_${suffix}`]);
    if (kcal > 0) return kcal;

    const kj = num(nutrients[`energy-kj_${suffix}`]);
    if (kj > 0) return kj / 4.184;

    const energy = num(nutrients[`energy_${suffix}`]);
    if (energy <= 0) return 0;
    const unit = String(nutrients.energy_unit || nutrients[`energy_unit_${suffix}`] || '').toLowerCase();
    if (unit.includes('kcal') || unit === 'cal') return energy;
    return energy / 4.184;
}

function parseServingWeight(servingSize) {
    const text = String(servingSize || '').replace(',', '.');
    const match = text.match(/([\d.]+)\s*(g|gram|grams|ml|mL|millilitre|milliliter)/i);
    return match ? num(match[1]) : null;
}

function scaledNutrition(per100g, grams) {
    const scale = grams > 0 ? grams / 100 : 1;
    return {
        calories: round1(per100g.calories * scale),
        protein_g: round1(per100g.protein_g * scale),
        carbs_g: round1(per100g.carbs_g * scale),
        fat_g: round1(per100g.fat_g * scale),
        fiber_g: round1(per100g.fiber_g * scale),
        sugars_g: round1(per100g.sugars_g * scale),
        saturated_fat_g: round1(per100g.saturated_fat_g * scale),
        sodium_mg: round1(per100g.sodium_mg * scale)
    };
}

function normalizeProduct(product, code, source) {
    const nutrients = product.nutriments || {};
    const servingSize = product.serving_size || '';
    const servingWeightG = parseServingWeight(servingSize);

    const per100g = {
        calories: round1(readCalories(nutrients, '100g')),
        protein_g: round1(nutrients.proteins_100g),
        carbs_g: round1(nutrients.carbohydrates_100g),
        fat_g: round1(nutrients.fat_100g),
        fiber_g: round1(nutrients.fiber_100g),
        sugars_g: round1(nutrients.sugars_100g),
        saturated_fat_g: round1(nutrients['saturated-fat_100g']),
        sodium_mg: round1(num(nutrients.sodium_100g) * 1000)
    };

    const hasServingCalories = readCalories(nutrients, 'serving') > 0;
    const perServing = hasServingCalories ? {
        calories: round1(readCalories(nutrients, 'serving')),
        protein_g: round1(nutrients.proteins_serving),
        carbs_g: round1(nutrients.carbohydrates_serving),
        fat_g: round1(nutrients.fat_serving),
        fiber_g: round1(nutrients.fiber_serving),
        sugars_g: round1(nutrients.sugars_serving),
        saturated_fat_g: round1(nutrients['saturated-fat_serving']),
        sodium_mg: round1(num(nutrients.sodium_serving) * 1000)
    } : scaledNutrition(per100g, servingWeightG || 100);

    const micro100g = {
        vitamin_c_mg: round1(nutrients['vitamin-c_100g']),
        iron_mg: round1(nutrients['iron_100g']),
        calcium_mg: round1(nutrients['calcium_100g']),
        potassium_mg: round1(nutrients['potassium_100g']),
        vitamin_a_mcg: round1(nutrients['vitamin-a_100g']),
        vitamin_d_mcg: round1(nutrients['vitamin-d_100g'])
    };

    const microScale = hasServingCalories
        ? 1
        : ((servingWeightG || 100) / 100);

    return {
        name: product.product_name || product.product_name_en || 'Unknown product',
        brand: product.brands || '',
        quantity: product.quantity || '',
        image: product.image_front_small_url || product.image_url || '',
        servingSize,
        servingWeightG,
        perServing,
        per100g,
        micro100g,
        micronutrients: {
            vitamin_c_mg: round1(num(nutrients['vitamin-c_serving']) || micro100g.vitamin_c_mg * microScale),
            iron_mg: round1(num(nutrients['iron_serving']) || micro100g.iron_mg * microScale),
            calcium_mg: round1(num(nutrients['calcium_serving']) || micro100g.calcium_mg * microScale),
            potassium_mg: round1(num(nutrients['potassium_serving']) || micro100g.potassium_mg * microScale),
            vitamin_a_mcg: round1(num(nutrients['vitamin-a_serving']) || micro100g.vitamin_a_mcg * microScale),
            vitamin_d_mcg: round1(num(nutrients['vitamin-d_serving']) || micro100g.vitamin_d_mcg * microScale)
        },
        isPerServing: hasServingCalories || !!servingWeightG,
        hasUsableNutrition: perServing.calories > 0 || per100g.calories > 0,
        barcode: code,
        source
    };
}

async function lookupFromEndpoint(baseUrl, code) {
    const url = `${baseUrl}/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`;
    const response = await fetch(url, {
        headers: {
            Accept: 'application/json',
            'User-Agent': 'BalanceFitnessGamified/1.0 (contact: shannon@plantbased-balance.org)'
        }
    });

    if (!response.ok) {
        throw new Error(`${baseUrl} returned ${response.status}`);
    }

    const data = await response.json();
    if (data.status !== 1 || !data.product) return null;
    return normalizeProduct(data.product, code, baseUrl);
}

exports.handler = async (event) => {
    const code = String(event.queryStringParameters?.code || '').replace(/\D/g, '');
    if (!code || code.length < 6) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: 'Valid barcode required' })
        };
    }

    const errors = [];
    for (const endpoint of OFF_ENDPOINTS) {
        try {
            const product = await lookupFromEndpoint(endpoint, code);
            if (product) {
                return {
                    statusCode: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'public, max-age=86400'
                    },
                    body: JSON.stringify({ success: true, product })
                };
            }
        } catch (error) {
            errors.push(error.message);
        }
    }

    return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            success: false,
            error: 'Product not found',
            code,
            details: errors.join(' | ')
        })
    };
};

exports._test = {
    normalizeProduct,
    readCalories,
    parseServingWeight
};
