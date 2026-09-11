# Six prepared weeks, 11 September 2026

Nine eating styles now have six distinct weekly menus (54 weekly menus, 210 meal placements per style). The measured recipe bank contains 36 recipes and 36 exact photos, including 12 newly authored and photographed dishes. Recipes are shared between compatible diets; this is not 1,890 different recipes.

Week one retains the previous v3 choices. Later weeks introduce one to three first-time recipes per style at the standard 2,000 kcal selection, retaining familiar dishes and adjacent-day repeats for preparation. Restriction combinations can have fewer eligible recipes and therefore more repetition. Selection never overrides dietary exclusions to manufacture variety.

Recipes and photos are prepared before use. Onboarding calculates portions once and saves all six weeks. Viewing weeks and their shopping lists uses the saved meals and does not call a recipe or image generator. The selected week advances every seven days from the saved plan's generation date and repeats after week six. Browsing a different week does not change the schedule.

Nutrition, ingredient state, source provenance, restriction screening and limitations remain as documented in [diet-library-v3.md](diet-library-v3.md). Quantities and nutrient totals still come from the AFCD ingredient records; no independent macro clamping was introduced. Each shopping list sums that week's saved ingredient grams. Food photographs illustrate the recipe, not an individual's portion.

The database migration extends both week checks to six and adds an owner-authorized, invoker-security append function. It locks the parent, validates complete days/slots, and adds missing weeks in one transaction. It never replaces existing meal rows. Repeat calls skip already complete weeks. New plans keep the existing save-all-children-before-activation flow.

An offline preparation command, `node scripts/prepare-six-week-library.cjs`, writes all nine complete plans and 54 shopping lists to ignored `work/six-week-library/` for review. No external generation or database writes occur in that command.

Existing standard plans may receive only their missing weeks using their saved diet, preferences and targets. Bespoke coach plans with a different structure or unresolved screening remain intact for individual review. Keep before/after fingerprints of the original meal rows during backfill.

## Measurement

- Hypothesis: six ready weeks improve weekly meal-plan use and remove continuation waiting.
- Variant: `six-prepared-meal-weeks-v1`; recipe library version 4.
- Primary KPI: members opening weeks 2–6 divided by members opening a six-week plan.
- Diagnostics: existing `diet_library_plan_started`, `diet_library_plan_ready`, `diet_library_plan_failed`; `prepared_meal_week_opened` with week and library version only.
- Guardrails: no diet fallback, no missing photos, original meal fingerprints retained, exact shopping reconciliation, no auto-replacement of a complete six-week plan.
- Review date: 25 September 2026.

## Verification

`node --test tests/measured-diet-plans.test.js tests/measured-diet-endpoint.test.js tests/six-week-meal-library.test.js tests/meal-plan-shopping-list.test.js tests/meal-plan-next-layout.test.js tests/meal-plan-recipe-quality.test.js tests/meal-plan-photo-coverage.test.js tests/weekly-meal-home-card.test.js`

The measured matrix checks every saved day of every week at five calorie targets and with all individual restrictions plus combined exclusions. Mobile review uses the actual Meals markup, styles and renderer in an isolated browser fixture, covering portrait, small portrait and landscape, light/dark, zero and nonzero safe areas, week switching, recipe expansion, shopping-list reachability and reopening.
