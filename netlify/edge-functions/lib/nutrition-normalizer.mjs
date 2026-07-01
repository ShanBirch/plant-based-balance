const PACKAGED_DRINK_CAP_CALORIES = 450;

function numberValue(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round1(value) {
  return Math.round(numberValue(value) * 10) / 10;
}

function macroCalories(source) {
  return Math.round(
    numberValue(source?.protein_g) * 4
    + numberValue(source?.carbs_g) * 4
    + numberValue(source?.fat_g) * 9
  );
}

function appendNote(existing, addition) {
  const cleanExisting = String(existing || "").trim();
  if (!addition) return cleanExisting;
  if (!cleanExisting) return addition;
  if (cleanExisting.toLowerCase().includes(addition.toLowerCase())) return cleanExisting;
  return `${cleanExisting} ${addition}`;
}

function itemText(item, context) {
  return [
    context?.description,
    item?.name,
    item?.portion,
    context?.notes,
  ].filter(Boolean).join(" ").toLowerCase();
}

function hasExplicitWholeContainer(text) {
  return /\b(?:whole|entire|full)\s+(?:bottle|carton|container|shake|drink)\b/i.test(text)
    || /\b(?:750|800|900|1000)\s?m?l\b/i.test(text)
    || /\b[1-9](?:\.\d+)?\s?(?:l|litre|liter)s?\b/i.test(text)
    || /\b(?:2|3|4)\s+(?:bottles|cartons|servings|serves)\b/i.test(text);
}

function isPackagedProteinDrink(item, context) {
  const text = itemText(item, context);
  const proteinDrink = /\bprotein\s*(?:milk|shake|drink|beverage)\b/i.test(text)
    || /\b(?:milk|shake|drink|beverage)\b.*\bprotein\b/i.test(text)
    || /\bprotein\b.*\b(?:milk|shake|drink|beverage)\b/i.test(text);
  const packageCue = /\b(?:barcode|label|bottle|carton|pack|tetra|ready\s*to\s*drink|rtd|up\s*&?\s*go|musashi|rokeby|yo[-\s]?pro|oak|dare|breaka)\b/i.test(text);
  return proteinDrink || (/\b(?:milk|shake|drink|beverage)\b/i.test(text) && packageCue);
}

function scaleItem(item, scale) {
  item.protein_g = round1(numberValue(item.protein_g) * scale);
  item.carbs_g = round1(numberValue(item.carbs_g) * scale);
  item.fat_g = round1(numberValue(item.fat_g) * scale);
  item.fiber_g = round1(numberValue(item.fiber_g) * scale);
  item.calories = macroCalories(item);
}

function normalizeItem(item) {
  item.protein_g = round1(item?.protein_g);
  item.carbs_g = round1(item?.carbs_g);
  item.fat_g = round1(item?.fat_g);
  item.fiber_g = round1(item?.fiber_g);
  item.portion_weight_g = numberValue(item?.portion_weight_g);
  item.calories = macroCalories(item);
}

function applyPackagedDrinkGuard(item, nutritionData, context, adjustments) {
  const text = itemText(item, context);
  if (!isPackagedProteinDrink(item, context) || hasExplicitWholeContainer(text)) return;

  const calories = macroCalories(item);
  if (calories <= PACKAGED_DRINK_CAP_CALORIES) return;

  const scale = PACKAGED_DRINK_CAP_CALORIES / calories;
  scaleItem(item, scale);
  item.portion = item.portion || "1 likely serving";
  nutritionData.confidence = nutritionData.confidence === "high" ? "medium" : (nutritionData.confidence || "medium");
  const note = "Packaged protein drink photo adjusted to one likely serving because no exact amount was entered. Use barcode or manual label entry for exact macros.";
  nutritionData.notes = appendNote(nutritionData.notes, note);
  adjustments.push({
    type: "packaged_protein_drink_serving_cap",
    original_calories: calories,
    adjusted_calories: item.calories,
    max_calories: PACKAGED_DRINK_CAP_CALORIES,
  });
}

function recomputeTotalsFromItems(nutritionData) {
  const totals = {
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    fiber_g: 0,
  };

  for (const item of nutritionData.foodItems || []) {
    totals.protein_g += numberValue(item.protein_g);
    totals.carbs_g += numberValue(item.carbs_g);
    totals.fat_g += numberValue(item.fat_g);
    totals.fiber_g += numberValue(item.fiber_g);
  }

  totals.protein_g = round1(totals.protein_g);
  totals.carbs_g = round1(totals.carbs_g);
  totals.fat_g = round1(totals.fat_g);
  totals.fiber_g = round1(totals.fiber_g);
  totals.calories = macroCalories(totals);
  nutritionData.totals = totals;
}

export function normalizeNutritionData(rawData, context = {}) {
  const nutritionData = rawData && typeof rawData === "object" ? rawData : {};
  const adjustments = [];

  if (Array.isArray(nutritionData.foodItems)) {
    for (const item of nutritionData.foodItems) {
      if (!item || typeof item !== "object") continue;
      normalizeItem(item);
      applyPackagedDrinkGuard(item, nutritionData, context, adjustments);
    }
    recomputeTotalsFromItems(nutritionData);
  } else if (nutritionData.totals) {
    nutritionData.totals.calories = macroCalories(nutritionData.totals);
  }

  if (adjustments.length > 0) {
    nutritionData.adjustments = [
      ...(Array.isArray(nutritionData.adjustments) ? nutritionData.adjustments : []),
      ...adjustments,
    ];
  }

  return nutritionData;
}

export const __test = {
  macroCalories,
  isPackagedProteinDrink,
  hasExplicitWholeContainer,
  PACKAGED_DRINK_CAP_CALORIES,
};
