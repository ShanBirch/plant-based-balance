# Measured meal library — 10 September 2026

## Coverage

Nine eating styles: vegan, vegetarian, omnivore, pescatarian, flexitarian, Mediterranean, keto, paleo and Whole30. Twenty-four recipes each have their own generated photograph. Each weekly plan has seven days and five meal slots per day. Compatible recipes are reused between styles; these are not 315 distinct recipes.

Eleven combinable food requirements: gluten-free, dairy-free, nut-free, soy-free, egg-free, shellfish-free, low FODMAP, low sodium, lower added sugar, halal and kosher. Unsupported allergies or combinations stop with a clear review message, preserving the current plan. Multiple eating styles are rejected instead of silently selecting a fallback.

## Nutrition and shopping contract

- `data/meal-ingredient-nutrients.js` contains 42 ingredient records from [FSANZ AFCD Release 3](https://www.foodstandards.gov.au/science-data/food-nutrient-databases/afcd/data-files). Each record carries its exact food ID, source food name and nutrient-file URL.
- Recipe amounts are edible grams in the named raw, cooked, peeled or drained state. Energy uses AFCD energy with fibre (kJ / 4.184); carbohydrate uses available carbohydrate directly. Fibre must not be subtracted again.
- Portion optimisation changes actual ingredient grams. Calories and macros are recomputed after rounding grams to one decimal. Display rounding is one calorie and 0.1 g macros. No calorie or macro total is changed independently of the recipe.
- A day must be within 5% of the calorie target or fail for review. The permitted input range is 1,200–4,000 kcal; restrictive combinations may not have a feasible portion solution, including some high-calorie keto days. Protein shortfalls are disclosed; this library does not guarantee every personalised macro target can be reached.
- Shopping quantities sum the saved recipe grams, preserving edible/cooked state and product qualifiers. They are usable food amounts, not package counts or estimates of peel, shells, bones or cooking loss. Buy ready-cooked grains or prepare and weigh the named cooked amount. Water is retained because the list includes all recipe ingredients.
- Nutrition values are composition estimates, not laboratory measurements of a member's food. Brand differences, cooking yield and product labels still matter. Photographs illustrate the recipe, not every personalised portion size.

## Screening definitions and limits

- Vegan excludes meat, fish, dairy and eggs; vegetarian excludes meat and fish; pescatarian excludes meat. Flexitarian and Mediterranean menus emphasise plant dishes with two fish dinners per week. Mediterranean excludes red meat.
- Paleo and Whole30 exclude grains, legumes, soy and dairy in this library. Current [Whole30 rules](https://whole30.com/original-program-rules/) also require checking additives and product labels; no recipe has an added sweetener.
- Keto requires no more than 30 g available carbohydrate per day and 60–80% of energy from fat. These are library bounds, not medical treatment targets.
- Gluten-free excludes oats as well as gluten-containing grains, consistent with [Australian allergen guidance](https://www.foodstandards.gov.au/consumer/foodallergies/Allergen-labelling-exemptions).
- Low sodium is capped at 1,500 mg per day from the listed ingredients, with no added salt. Lower added sugar uses recipes without added sweeteners; it does not claim low total sugar in fruit or dairy.
- Low FODMAP uses conservative ingredient caps and foods screened against [Monash public guidance](https://www.monashfodmap.com/about-fodmap-and-ibs/high-and-low-fodmap-foods/). The caps are library screening limits, not independently certified Monash thresholds. Product-specific serving sizes, stacking and individual tolerance need dietitian/current Monash guidance. This is not a clinical elimination/reintroduction programme or a Monash-certified plan.
- Halal requires certified meat. Kosher screening uses plant, egg, dairy and permitted fish dishes, avoiding meat/dairy timing conflicts. Certification, equipment, separation and preparation requirements remain household-specific. These plans do not provide religious certification. Allergens require checking packaging and cross-contact.

## Persistence and maintenance

Onboarding and profile changes use `buildPreparedMealPlan` and `persistBuiltMealPlan`. Week continuation uses the same engine. A parent starts as generating; all weeks and meals save before activation. Only then are older active plans retired. Failed child inserts clean up the incomplete parent and preserve the previous plan. No user plans are migrated in place.

The continuation endpoint returns the same measured recipes and exact photos. Logged meals can influence selection only when a matching eligible library recipe exists; a generated recipe is never renamed to a different logged dish.

## Launch measurement

- Hypothesis: matching plans to all offered eating styles reduces failed onboarding and improves meal-plan activation.
- Variant: `diet-library-v3`.
- Primary KPI: completed plans per member starting meal-plan generation, segmented by eating style.
- Events: `diet_library_plan_started`, `diet_library_plan_ready` and `diet_library_plan_failed`, plus existing onboarding start/completion (no ingredient/allergy details in failure events).
- Diagnostics: selected style, generated meal count and library version on successful plans; build/save failures on unsuccessful attempts.
- Guardrails: no silent diet fallback, no missing exact photo, ingredient-to-nutrition reconciliation, shopping reconciliation, safe replacement on save failure.
- Decision date: 24 September 2026. Compare completion and failure rates with the prior two weeks; expand recipe variety using actual selection demand and review failed restriction combinations.

## Verification

Run `node --test tests/measured-diet-plans.test.js tests/meal-plan-shopping-list.test.js tests/prepared-meal-plan-library.test.js tests/meal-plan-recipe-quality.test.js tests/meal-plan-photo-coverage.test.js`.

The new matrix exercises all nine styles at 1,200, 1,500, 2,000, 2,500 and 3,000 kcal, every individual restriction at 2,000 kcal, combined ingredient exclusions, source provenance, invalid choices, nutrition arithmetic, photo existence, exact shopping sums and save-failure ordering. Legacy template tests remain for backwards compatibility and do not describe the v3 catalogue.
