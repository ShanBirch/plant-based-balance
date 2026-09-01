const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const foodSearch = require(path.join(root, 'netlify/functions/food-search.js'));
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const builder = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-meal-builder.js'), 'utf8');
const theme = fs.readFileSync(path.join(root, 'css/dashboard/pbb-premium-overlays.css'), 'utf8');

test('USDA foods are converted into selectable servings and nutrition', () => {
  const food = foodSearch._test.normalizeFood({
    fdcId: 123,
    description: 'banana, raw',
    dataType: 'Survey (FNDDS)',
    foodNutrients: [
      { nutrientId: 1008, value: 97 },
      { nutrientId: 1003, value: 0.74 },
      { nutrientId: 1005, value: 22.71 },
      { nutrientId: 1004, value: 0.28 }
    ],
    foodMeasures: [{ disseminationText: '1 banana', gramWeight: 126 }]
  });
  assert.equal(food.name, 'Banana, Raw');
  assert.equal(food.per100g.calories, 97);
  assert.deepEqual(food.measures[0], { label: '1 banana', grams: 126 });
});

test('the live builder is search first and supports serving selection', () => {
  assert.match(dashboard, /id="meal-builder-food-search"[^>]*placeholder="Search an ingredient"/);
  assert.match(dashboard, /id="meal-builder-serving-measure"/);
  assert.match(dashboard, /id="meal-builder-serving-count"/);
  assert.match(builder, /custom-grams/);
  assert.match(builder, /Weight in grams/);
  assert.doesNotMatch(dashboard, /data-builder-barcode-type="1"/);
  assert.match(builder, /searchBuilderFoods\(query\)/);
  assert.match(builder, /source: selectedBuilderFood\.source \|\| 'usda-food-search'/);
});

test('search, results, serving controls, and focus states have paired theme rules', () => {
  assert.match(theme, /#meal-builder-food-search:focus/);
  assert.match(theme, /\.meal-builder-search-result/);
  assert.match(theme, /html\[data-pbb-theme="light"\] #meal-builder-food-search/);
  assert.match(theme, /html\[data-pbb-theme="light"\] \.meal-builder-serving-preview/);
});

test('food search responses use Netlify durable caching', async () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.USDA_FOODDATA_API_KEY;
  process.env.USDA_FOODDATA_API_KEY = 'test-key';
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ foods: [] })
  });

  try {
    const response = await foodSearch.handler({ queryStringParameters: { q: 'banana' } });
    assert.equal(response.statusCode, 200);
    assert.match(response.headers['Netlify-CDN-Cache-Control'], /durable/);
    assert.match(response.headers['Netlify-CDN-Cache-Control'], /s-maxage=3600/);
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.USDA_FOODDATA_API_KEY;
    else process.env.USDA_FOODDATA_API_KEY = originalKey;
  }
});
