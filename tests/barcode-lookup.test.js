const assert = require('node:assert/strict');
const { _test } = require('../netlify/functions/barcode-lookup.js');

assert.equal(Math.round(_test.readCalories({ 'energy-kj_100g': 418.4 }, '100g')), 100);
assert.equal(_test.parseServingWeight('500 ml'), 500);

const product = _test.normalizeProduct({
    product_name: 'High Protein Milk',
    brands: 'Test Dairy',
    quantity: '500ml',
    serving_size: '500 ml',
    image_front_small_url: 'https://example.com/milk.jpg',
    nutriments: {
        'energy-kj_100g': 276,
        proteins_100g: 6,
        carbohydrates_100g: 5,
        fat_100g: 1.5,
        fiber_100g: 0,
        sugars_100g: 5,
        sodium_100g: 0.05
    }
}, '9300000000000', 'test');

assert.equal(product.name, 'High Protein Milk');
assert.equal(product.servingWeightG, 500);
assert.equal(product.isPerServing, true);
assert.equal(product.hasUsableNutrition, true);
assert.equal(Math.round(product.perServing.calories), 330);
assert.equal(product.perServing.protein_g, 30);
assert.equal(product.perServing.sodium_mg, 250);

console.log('barcode lookup tests passed');
