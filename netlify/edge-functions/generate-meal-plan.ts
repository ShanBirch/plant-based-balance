import '../../data/meal-ingredient-nutrients.js';
import '../../data/balance-diet-recipes.js';
import '../../lib/prepared-diet-engine.js';

/** The weekly continuation uses the same measured recipes as onboarding. */
export default async function(request: Request) {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  try {
    const body = await request.json();
    const week = Number(body.weekNumber ?? 1);
    const day = Number(body.dayNumber ?? 0);
    if (!Number.isInteger(week) || week < 1 || week > 4 || !Number.isInteger(day) || day < 0 || day > 6) {
      return new Response(JSON.stringify({ error: 'Choose a valid week and day.' }), { status: 400, headers });
    }
    const engine = (globalThis as any).BALANCE_PREPARED_MEAL_LIBRARY;
    const userData = body.userData || {};
    const preferences = { ...(userData.foodPreferences || {}) };
    const familiar = Array.isArray(body.adaptiveWeek?.meals) ? body.adaptiveWeek.meals : [];
    preferences.preferred_meals = Object.fromEntries(familiar.filter((meal: any) => !meal.variation).map((meal: any) => [day + ':' + meal.meal_slot, meal.base_meal?.name]));
    const targets = userData.quizResults || userData.profile || {};
    const template = engine.selectTemplate(preferences);
    const placement = engine.expandTemplate(template)[day];
    const scaled = engine.scaleDay(placement.meals, template, targets);
    const result: any = {
      success: true,
      day: { ...placement, meals: scaled.meals, nutrition_totals: scaled.totals },
      nutrition_notices: scaled.notices,
      plan_description: engine.nutritionGuidance(template, scaled.notices),
      library_version: 3
    };
    if (day === 0) result.weekMeta = { week_number: week, theme: 'Your food, your preferences', theme_description: 'Measured recipes matched to your current eating style and portions.' };
    return new Response(JSON.stringify(result), { headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Your food choices need a review.', details: error instanceof Error ? error.message : String(error) }), { status: 422, headers });
  }
}
