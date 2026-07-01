import assert from "node:assert/strict";
import { normalizeNutritionData, __test } from "../netlify/edge-functions/lib/nutrition-normalizer.mjs";

const wildProteinMilk = normalizeNutritionData({
  foodItems: [{
    name: "Protein milk bottle",
    portion: "1 bottle",
    portion_weight_g: 500,
    calories: 1200,
    protein_g: 70,
    carbs_g: 120,
    fat_g: 50,
    fiber_g: 0
  }],
  totals: {
    calories: 1200,
    protein_g: 70,
    carbs_g: 120,
    fat_g: 50,
    fiber_g: 0
  },
  confidence: "high",
  notes: "estimated from photo"
}, { description: "" });

assert.ok(wildProteinMilk.totals.calories <= __test.PACKAGED_DRINK_CAP_CALORIES);
assert.equal(wildProteinMilk.confidence, "medium");
assert.equal(wildProteinMilk.adjustments[0].type, "packaged_protein_drink_serving_cap");
assert.match(wildProteinMilk.notes, /one likely serving/i);

const explicitLargeProteinMilk = normalizeNutritionData({
  foodItems: [{
    name: "Protein milk",
    portion: "1 litre",
    portion_weight_g: 1000,
    protein_g: 80,
    carbs_g: 100,
    fat_g: 20,
    fiber_g: 0
  }],
  totals: { protein_g: 80, carbs_g: 100, fat_g: 20, fiber_g: 0 },
  confidence: "medium"
}, { description: "whole 1 litre protein milk" });

assert.ok(explicitLargeProteinMilk.totals.calories > __test.PACKAGED_DRINK_CAP_CALORIES);
assert.equal(explicitLargeProteinMilk.adjustments, undefined);

const normalMeal = normalizeNutritionData({
  foodItems: [{
    name: "tofu rice bowl",
    portion: "1 bowl",
    protein_g: 32,
    carbs_g: 88,
    fat_g: 22,
    fiber_g: 12
  }],
  totals: { protein_g: 1, carbs_g: 1, fat_g: 1, fiber_g: 1 },
  confidence: "medium"
});

assert.equal(normalMeal.totals.calories, (32 * 4) + (88 * 4) + (22 * 9));
assert.equal(normalMeal.totals.fiber_g, 12);

console.log("nutrition normalizer tests passed");
