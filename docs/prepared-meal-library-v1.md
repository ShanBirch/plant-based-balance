# Prepared meal library v1

## Inventory and deduplication

- Existing curated vegan recipe records audited: **31**.
- Existing curated vegan photo files audited: **31**.
- Duplicate curated photo hashes: **0**.
- Additional client-specific photo-backed meals found under `images/meals/arunima`: **20**. These remain client-specific because their recipes and photos were created for that member and are not silently reassigned to the shared bank.
- Existing omnivore demo photos found under `assets/meal-plans/balance-four-meal`: **4**. They are not used by the launch bank because the safe common bank is plant-based and those photos would not match it.

## Exact launch counts

- Raw UI selections: **96** (`3 × 2^5`).
- Normalized prepared templates: **80**. Vegan + dairy-free maps to the same template as vegan because dairy-free is already implied.
- Daily-menu templates: **240** (three per plan).
- Meal-slot placements: **1,200** (five slots per daily menu).
- Shared recipes used by the prepared templates: **15** (three per slot).
- Existing curated photos reused in the approved prepared bank: **3**.
- Newly created exact meal photos: **12**.
- Total approved prepared-bank photos: **15**.
- Remaining recipes/photos needed for the 80-template launch after this change: **0 / 0**.

## Safety and scaling policy

The launch bank is deliberately a conservative common-denominator bank. Every recipe is vegan, gluten-free, dairy-free, nut-free, soy-free and low-FODMAP, so it is suitable for vegan, vegetarian and omnivore members with any supported restriction combination. Eating style is permissive: an omnivore may eat a plant-based meal; Balance does not force animal products into an omnivore week.

Low-FODMAP portions are reviewed at ingredient level. Threshold-sensitive fruit, seeds and vegetables carry `scalable: false`; calorie scaling changes the safe starch, oil and rice-protein portions instead. Garlic-infused oil is used without garlic solids. No customer path calls meal or image generation for this prepared week.

The three menus repeat Monday-Wednesday, Thursday-Friday and Saturday-Sunday. The database stores the expanded seven-day week so the existing renderer, shopping list and meal logging continue to work without a schema migration.
