const assert = require('assert');

const {
  SCIENCE_CATEGORY_ROTATION,
  createDailyPost,
  selectSciencePaper,
} = require('../content-lab/src/balance-content/core');

const sciencePapers = require('../content-lab/config/science-papers.json');

assert.ok(SCIENCE_CATEGORY_ROTATION.length >= 10, 'science category rotation should cover the main content buckets');

for (const paper of sciencePapers) {
  assert.ok(paper.category, `${paper.id} should have a primary science category`);
  assert.ok(paper.categoryLabel, `${paper.id} should have a readable science category label`);
}

const neurosciencePost = createDailyPost({
  dateString: '2026-06-09',
  scienceCategory: 'neuroscience',
});
assert.strictEqual(neurosciencePost.lane, 'science');
assert.strictEqual(neurosciencePost.scienceCategory, 'neuroscience');
assert.strictEqual(neurosciencePost.scienceCategoryLabel, 'Neuroscience');
assert.strictEqual(neurosciencePost.paperId, 'aerobic-exercise-hippocampus-memory');
assert.match(neurosciencePost.caption, /Source:/);

const stateChangePost = createDailyPost({
  dateString: '2026-06-09',
  scienceCategory: 'state_change_mindset',
});
assert.strictEqual(stateChangePost.scienceCategory, 'state_change_mindset');
assert.strictEqual(stateChangePost.scienceCategoryLabel, 'Food, exercise & mindset');
assert.ok([
  'cleaners-exercise-belief',
  'milkshake-belief-ghrelin',
  'ultra-processed-calorie-intake',
  'aerobic-exercise-hippocampus-memory',
  'resistance-training-depression',
].includes(stateChangePost.paperId));

const longevityPost = createDailyPost({
  dateString: '2026-06-09',
  scienceCategory: 'longevity_healthspan',
});
assert.strictEqual(longevityPost.scienceCategory, 'longevity_healthspan');
assert.strictEqual(longevityPost.scienceCategoryLabel, 'Longevity / healthspan');
assert.ok([
  'plant-protein-muscle',
  'training-frequency-volume',
  'ultra-processed-calorie-intake',
  'sleep-restriction-fat-loss',
  'sitting-breaks-glucose-insulin',
  'aerobic-exercise-hippocampus-memory',
  'stair-climbing-exercise-snacks',
].includes(longevityPost.paperId));

const plantBasedSelection = selectSciencePaper({
  dateString: '2026-06-12',
  scienceCategory: 'plant_based_nutrition',
});
assert.strictEqual(plantBasedSelection.paper.category, 'plant_based_nutrition');
assert.strictEqual(plantBasedSelection.category.fallbackUsed, false);

const fallbackSelection = selectSciencePaper({
  dateString: '2026-06-12',
  scienceCategory: 'free_energy_principle',
});
assert.ok(fallbackSelection.paper.id, 'unknown requested categories should still return a paper');
assert.strictEqual(fallbackSelection.category.fallbackUsed, true);

console.log('balance content science category tests passed');
