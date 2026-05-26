import assert from "node:assert/strict";
import { parseModelJsonObject } from "../netlify/edge-functions/lib/model-json.mjs";

const malformedMealJson = `{
  "foodItems": [
    {
      "name": "toast",
      "portion": "2 slices"
      "portion_weight_g": 80,
      "calories": 220,
      "protein_g": 8,
      "carbs_g": 40,
      "fat_g": 3,
      "fiber_g": 4
    }
  ],
  "totals": {
    "calories": 220,
    "protein_g": 8,
    "carbs_g": 40,
    "fat_g": 3,
    "fiber_g": 4
  },
  "micronutrients": {},
  "confidence": "medium",
  "notes": "estimated",
  "meal_insight": "A simple carb and protein breakfast."
}`;

const parsed = parseModelJsonObject(malformedMealJson, "test malformed meal");
assert.equal(parsed.foodItems[0].name, "toast");
assert.equal(parsed.foodItems[0].portion_weight_g, 80);
assert.equal(parsed.totals.protein_g, 8);

const fencedWithText = `Here is the JSON:\n\`\`\`json\n{
  "foodItems": [],
  "totals": {
    "calories": 10
    "protein_g": 1
  },
  "confidence": "low"
}\n\`\`\``;

const parsedFenced = parseModelJsonObject(fencedWithText, "test fenced meal");
assert.equal(parsedFenced.totals.calories, 10);
assert.equal(parsedFenced.totals.protein_g, 1);

console.log("meal analyzer JSON repair tests passed");
