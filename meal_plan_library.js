// Meal Plan Library Database
// Organized by: Plan > Variant > Week > Day > Meal Slot
//
// Structure follows the database schema in database/meal-plans-migration.sql
// This file serves as the source of truth for meal plan content

const MEAL_SLOTS = ['breakfast', 'am_snack', 'lunch', 'pm_snack', 'dinner', 'evening'];

const DIET_TYPES = {
  VEGAN: 'vegan',
  VEGETARIAN: 'vegetarian',
  PESCATARIAN: 'pescatarian',
  OMNIVORE: 'omnivore'
};

const PLAN_TYPES = {
  HORMONE: 'hormone',
  GOAL_BASED: 'goal-based',
  LIFESTYLE: 'lifestyle',
  SEASONAL: 'seasonal'
};

// ============================================================
// MEAL PLAN CATALOG
// ============================================================
const MEAL_PLAN_CATALOG = {
  // ------------------------------------------------------------
  // HORMONE RESET PLANS (for quiz onboarders)
  // ------------------------------------------------------------
  'hormone-cortisol': {
    slug: 'hormone-cortisol',
    name: 'Cortisol Reset Protocol',
    shortName: 'Cortisol Reset',
    icon: '🌿',
    planType: PLAN_TYPES.HORMONE,
    description: 'A 4-week meal plan designed to reduce cortisol levels through anti-inflammatory foods, blood sugar balancing, and adrenal support.',
    tagline: 'Reset your stress hormones with calming, nourishing meals',
    durationWeeks: 4,
    targetSex: 'female',
    goalTags: ['hormone-balance', 'stress-reduction', 'energy', 'sleep-support'],
    priceCents: 0, // Included with quiz
    isIncludedInSubscription: true,
    isFree: false,
    featured: false,
    thumbnail: '/assets/hormone_cortisol_plan.png',
    weekThemes: {
      1: { name: 'Reset & Debloat', description: 'Mineral-rich hydration to lower cortisol and flush water retention' },
      2: { name: 'Nourish & Stabilize', description: 'Blood sugar balancing with protein-rich meals' },
      3: { name: 'Rebuild & Strengthen', description: 'Adrenal-supporting nutrients and adaptogens' },
      4: { name: 'Sustain & Thrive', description: 'Cementing habits with satisfying, stress-reducing meals' }
    },
    keyPrinciples: [
      { title: 'Carbs at Night', description: 'Save starchy carbs for dinner to blunt evening cortisol spike and boost serotonin for sleep.' },
      { title: 'No Fasting', description: 'Eat within 30 minutes of waking. Fasting spikes cortisol and keeps your body in emergency mode.' },
      { title: 'Magnesium Rich', description: 'Prioritize magnesium-rich foods (spinach, pumpkin seeds, dark chocolate) to relax the nervous system.' },
      { title: '4-Hour Rhythm', description: 'Never go more than 4 hours without food. Frequent protein feedings signal safety to your brain.' }
    ],
    variants: ['vegan', 'vegetarian']
  },

  'hormone-estrogen': {
    slug: 'hormone-estrogen',
    name: 'Estrogen Balance Protocol',
    shortName: 'Estrogen Balance',
    icon: '🌸',
    planType: PLAN_TYPES.HORMONE,
    description: 'A 4-week meal plan focused on estrogen metabolism support through liver-friendly foods, fiber-rich meals, and phytoestrogen balance.',
    tagline: 'Support healthy estrogen levels through targeted nutrition',
    durationWeeks: 4,
    targetSex: 'female',
    goalTags: ['hormone-balance', 'menopause-support', 'liver-health', 'energy'],
    priceCents: 0,
    isIncludedInSubscription: true,
    isFree: false,
    featured: false,
    thumbnail: '/assets/hormone_estrogen_plan.png',
    weekThemes: {
      1: { name: 'Fiber Flush', description: 'High-fiber meals to bind and eliminate excess estrogen' },
      2: { name: 'Liver Support', description: 'Cruciferous vegetables and detox-supporting nutrients' },
      3: { name: 'Phytoestrogen Balance', description: 'Plant-based estrogen modulators for hormone harmony' },
      4: { name: 'Metabolic Reset', description: 'Optimized nutrition for long-term hormone balance' }
    },
    keyPrinciples: [
      { title: 'Cruciferous Daily', description: 'Eat broccoli, kale, or brussels sprouts daily. They contain DIM that activates liver detox pathways.' },
      { title: 'Raw Carrot Salad', description: 'Eat raw carrot salad every day. Its unique fiber acts like a sponge for endotoxins and excess estrogen.' },
      { title: 'Hydration', description: 'Drink 3 liters of water. Your kidneys are a major detox organ; keep them flushed to reduce bloating.' },
      { title: 'Zero Alcohol', description: 'Strict no alcohol. Ethanol pauses fat burning and liver detox for up to 48 hours.' }
    ],
    variants: ['vegan', 'vegetarian']
  },

  // ------------------------------------------------------------
  // GOAL-BASED PLANS (for purchase)
  // ------------------------------------------------------------
  'summer-shred': {
    slug: 'summer-shred',
    name: 'Summer Shred 28-Day',
    shortName: 'Summer Shred',
    icon: '☀️',
    planType: PLAN_TYPES.GOAL_BASED,
    description: 'High-protein, calorie-conscious meal plan designed for fat loss while maintaining muscle. Features satisfying, filling meals that keep you energized.',
    tagline: 'Lean out with delicious, high-protein meals',
    durationWeeks: 4,
    targetSex: null, // Both
    goalTags: ['weight-loss', 'muscle-retention', 'energy', 'fat-loss'],
    priceCents: 999,
    stripePriceId: null, // TODO: Create in Stripe
    isIncludedInSubscription: true,
    isFree: false,
    featured: true,
    thumbnail: '/assets/summer_shred_plan.png',
    avgDailyCalories: { min: 1400, max: 1800 },
    avgDailyProtein: 120, // grams
    weekThemes: {
      1: { name: 'Kickstart', description: 'Reset your metabolism with clean, high-protein meals' },
      2: { name: 'Accelerate', description: 'Increase thermogenesis with strategic nutrient timing' },
      3: { name: 'Peak Performance', description: 'Optimize fat burning while preserving muscle' },
      4: { name: 'Maintain & Sustain', description: 'Build habits for long-term success' }
    },
    variants: ['vegan', 'vegetarian', 'pescatarian', 'omnivore']
  },

  'clean-bulk': {
    slug: 'clean-bulk',
    name: 'Clean Bulk Protocol',
    shortName: 'Clean Bulk',
    icon: '💪',
    planType: PLAN_TYPES.GOAL_BASED,
    description: 'A muscle-building meal plan with quality calories from whole foods. High protein, strategic carbs, and nutrient-dense meals for lean mass gain.',
    tagline: 'Build muscle with clean, whole-food nutrition',
    durationWeeks: 4,
    targetSex: null,
    goalTags: ['muscle-gain', 'strength', 'performance', 'mass-building'],
    priceCents: 999,
    stripePriceId: null,
    isIncludedInSubscription: true,
    isFree: false,
    featured: true,
    thumbnail: '/assets/clean_bulk_plan.png',
    avgDailyCalories: { min: 2200, max: 2800 },
    avgDailyProtein: 150,
    weekThemes: {
      1: { name: 'Foundation', description: 'Establish caloric surplus with quality whole foods' },
      2: { name: 'Build Phase', description: 'Strategic carb timing around workouts' },
      3: { name: 'Growth Acceleration', description: 'Maximize muscle protein synthesis' },
      4: { name: 'Consolidation', description: 'Fine-tune nutrition for sustainable gains' }
    },
    variants: ['vegan', 'vegetarian', 'pescatarian', 'omnivore']
  },

  'energy-boost': {
    slug: 'energy-boost',
    name: 'Energy Boost 28-Day',
    shortName: 'Energy Boost',
    icon: '⚡',
    planType: PLAN_TYPES.GOAL_BASED,
    description: 'Combat fatigue with meals designed to stabilize blood sugar, support mitochondrial health, and provide sustained energy throughout the day.',
    tagline: 'All-day energy through balanced, energizing meals',
    durationWeeks: 4,
    targetSex: null,
    goalTags: ['energy', 'focus', 'vitality', 'blood-sugar-balance'],
    priceCents: 999,
    stripePriceId: null,
    isIncludedInSubscription: true,
    isFree: false,
    featured: false,
    thumbnail: '/assets/energy_boost_plan.png',
    variants: ['vegan', 'vegetarian', 'pescatarian', 'omnivore']
  },

  'gut-reset': {
    slug: 'gut-reset',
    name: 'Gut Reset Protocol',
    shortName: 'Gut Reset',
    icon: '🌱',
    planType: PLAN_TYPES.GOAL_BASED,
    description: 'A healing meal plan focused on gut health, featuring prebiotic and probiotic-rich foods, easy-to-digest meals, and inflammation-reducing ingredients.',
    tagline: 'Heal your gut with nourishing, easy-to-digest meals',
    durationWeeks: 4,
    targetSex: null,
    goalTags: ['gut-health', 'digestion', 'inflammation', 'healing'],
    priceCents: 999,
    stripePriceId: null,
    isIncludedInSubscription: true,
    isFree: false,
    featured: false,
    thumbnail: '/assets/gut_reset_plan.png',
    variants: ['vegan', 'vegetarian', 'gluten-free-vegan']
  },

  'quick-easy': {
    slug: 'quick-easy',
    name: 'Quick & Easy Meals',
    shortName: 'Quick & Easy',
    icon: '⏱️',
    planType: PLAN_TYPES.LIFESTYLE,
    description: 'Perfect for busy schedules. Every meal takes 20 minutes or less to prepare. No compromise on nutrition or taste.',
    tagline: 'Healthy eating made simple for busy lives',
    durationWeeks: 4,
    targetSex: null,
    goalTags: ['time-saving', 'beginner-friendly', 'practical', 'simple'],
    priceCents: 999,
    stripePriceId: null,
    isIncludedInSubscription: true,
    isFree: false,
    featured: true,
    thumbnail: '/assets/quick_easy_plan.png',
    maxPrepTime: 20, // minutes
    variants: ['vegan', 'vegetarian', 'pescatarian', 'omnivore']
  }
};

// ============================================================
// EXISTING HORMONE CORTISOL MEALS (extracted from dashboard.html)
// This is the vegan variant - Week 1 as example structure
// ============================================================
const HORMONE_CORTISOL_MEALS = {
  variant: 'vegan',
  planSlug: 'hormone-cortisol',
  weeks: {
    1: {
      theme: 'Reset & Debloat',
      description: 'Mineral-rich hydration to lower cortisol and flush water retention',
      days: {
        // Monday
        0: {
          breakfast: {
            name: 'Ginger Pear Smoothie',
            time: '7:30 AM',
            image: '/assets/ginger_pear_smoothie.png',
            ingredients: [
              { name: 'Pear', amount: '170g' },
              { name: 'Spinach', amount: '50g' },
              { name: 'Cucumber', amount: '80g' },
              { name: 'Pea protein powder', amount: '30g' },
              { name: 'Ground flaxseed', amount: '15g' },
              { name: 'Aloe vera juice', amount: '30ml' },
              { name: 'Almond butter', amount: '15g' },
              { name: 'Water', amount: '100ml' }
            ],
            preparation: 'Blend all ingredients until smooth. Almond butter adds healthy fats.',
            tags: ['smoothie', 'anti-inflammatory', 'quick', 'high-protein'],
            nutrition: { calories: 380, protein: 28, carbs: 42, fat: 12, fiber: 10 }
          },
          am_snack: {
            name: 'Cranberry Chia Pudding',
            time: '10:30 AM',
            image: '/assets/cranberry_chia_pudding.png',
            ingredients: [
              { name: 'Chia seeds', amount: '15g' },
              { name: 'Pea protein', amount: '10g' },
              { name: 'Almond milk', amount: '100ml' },
              { name: 'Cranberries', amount: '10g' },
              { name: 'Berries', amount: '50g' },
              { name: 'Brazil nuts', amount: '5g' }
            ],
            preparation: 'Soak chia. Top with berries/nuts.',
            tags: ['pudding', 'make-ahead', 'high-fiber'],
            nutrition: { calories: 220, protein: 14, carbs: 18, fat: 10, fiber: 12 }
          },
          lunch: {
            name: 'Stuffed Sweet Potato',
            time: '12:30 PM',
            image: '/assets/stuffed_sweet_potato.jpg',
            ingredients: [
              { name: 'Sweet potato', amount: '200g' },
              { name: 'Quinoa', amount: '150g' },
              { name: 'Black beans', amount: '150g' },
              { name: 'Kale', amount: '50g' },
              { name: 'Tahini', amount: '15g' },
              { name: 'Lemon juice', amount: 'to taste' },
              { name: 'Pumpkin seeds', amount: '10g' }
            ],
            preparation: '1. Roast: Bake sweet potato (whole or cubed) until tender (approx 25-30 mins).\n2. Stuff/Assemble: Mix cooked quinoa, rinsed black beans, and massaged kale. Stuff into the split potato or arrange in a bowl.\n3. Serve: Drizzle with a dressing made of tahini and lemon juice. Top with pumpkin seeds.',
            tags: ['bowl', 'high-fiber', 'meal-prep-friendly'],
            nutrition: { calories: 520, protein: 22, carbs: 78, fat: 14, fiber: 18 }
          },
          pm_snack: {
            name: 'Fennel Lime Tonic & Nori',
            time: '3:30 PM',
            image: '/assets/fennel_lime_tonic_nori.png',
            ingredients: [
              { name: 'Fennel bulb', amount: '100g' },
              { name: 'Lime juice', amount: '20ml' },
              { name: 'Nori', amount: '2g' }
            ],
            preparation: 'Juice fennel. Mix with lime water. Serve with toasted nori.',
            tags: ['tonic', 'digestive', 'low-calorie'],
            nutrition: { calories: 45, protein: 2, carbs: 8, fat: 0, fiber: 3 }
          },
          dinner: {
            name: 'Miso Glazed Tempeh',
            time: '6:30 PM',
            image: '/assets/miso_glazed_tempeh.png',
            ingredients: [
              { name: 'Tempeh', amount: '200g' },
              { name: 'Miso', amount: '15g' },
              { name: 'Tamari', amount: '10ml' },
              { name: 'Maple syrup', amount: '10ml' },
              { name: 'Bok choy', amount: '150g' },
              { name: 'Cauliflower rice', amount: '150g' },
              { name: 'Sesame oil', amount: '5ml' },
              { name: 'Tahini', amount: '20g' }
            ],
            preparation: '1. Marinate: Whisk miso, tamari, maple syrup, and sesame oil. Cube tempeh and toss in marinade. Let sit for 15-30 mins.\n2. Cook Tempeh: Pan-fry tempeh over medium-high heat until golden and caramelized (approx 5-8 mins).\n3. Sides: Steam bok choy (3-4 mins). Sauté cauliflower rice with a splash of water or oil until tender.\n4. Serve: Assemble in a bowl and drizzle with any remaining fresh tahini.',
            tags: ['asian', 'high-protein', 'satisfying'],
            nutrition: { calories: 580, protein: 38, carbs: 32, fat: 28, fiber: 8 }
          },
          evening: {
            name: 'Chamomile Maca Moon Milk',
            time: '8:30 PM',
            image: '/assets/chamomile_maca_moon_milk.png',
            ingredients: [
              { name: 'Oat milk', amount: '200ml' },
              { name: 'Chamomile tea bag', amount: '1' },
              { name: 'Maca powder', amount: '5g' },
              { name: 'Honey or maple', amount: '5ml' }
            ],
            preparation: 'Heat milk. Steep chamomile. Whisk in maca and sweetener.',
            tags: ['beverage', 'sleep-support', 'calming'],
            nutrition: { calories: 120, protein: 3, carbs: 18, fat: 4, fiber: 2 }
          }
        },
        // Tuesday (day 1)
        1: {
          breakfast: {
            name: 'Cucumber Mint Green Juice + Tofu Scramble',
            time: '7:30 AM',
            image: '/assets/cucumber_mint_juice_tofu_scramble.png',
            ingredients: [
              { name: 'Cucumber', amount: '200g' },
              { name: 'Fresh mint', amount: '10g' },
              { name: 'Celery', amount: '100g' },
              { name: 'Firm tofu', amount: '200g' },
              { name: 'Turmeric', amount: '2g' },
              { name: 'Nutritional yeast', amount: '10g' },
              { name: 'Spinach', amount: '50g' }
            ],
            preparation: 'Juice cucumber, mint, celery. Crumble tofu, sauté with turmeric and nutritional yeast. Add spinach.',
            tags: ['high-protein', 'savory', 'energizing'],
            nutrition: { calories: 340, protein: 28, carbs: 16, fat: 18, fiber: 6 }
          },
          am_snack: {
            name: 'Fennel Lime Tonic & Nori',
            time: '10:30 AM',
            image: '/assets/fennel_lime_tonic_nori.png',
            ingredients: [
              { name: 'Fennel bulb', amount: '100g' },
              { name: 'Lime juice', amount: '20ml' },
              { name: 'Nori', amount: '2g' }
            ],
            preparation: 'Juice fennel. Mix with lime water. Serve with toasted nori.',
            tags: ['tonic', 'digestive', 'low-calorie'],
            nutrition: { calories: 45, protein: 2, carbs: 8, fat: 0, fiber: 3 }
          },
          lunch: {
            name: 'Rainbow Collard Wraps',
            time: '12:30 PM',
            image: '/assets/rainbow_collard_wraps.png',
            ingredients: [
              { name: 'Collard greens', amount: '4 leaves' },
              { name: 'Hummus', amount: '100g' },
              { name: 'Carrot', amount: '100g' },
              { name: 'Red cabbage', amount: '50g' },
              { name: 'Cucumber', amount: '80g' },
              { name: 'Avocado', amount: '80g' },
              { name: 'Sprouts', amount: '30g' }
            ],
            preparation: 'Blanch collard leaves briefly. Spread hummus, add julienned veggies, roll up tight.',
            tags: ['wrap', 'raw', 'colorful', 'low-carb'],
            nutrition: { calories: 380, protein: 14, carbs: 28, fat: 24, fiber: 14 }
          },
          pm_snack: {
            name: 'Mineral Broth & Edamame',
            time: '3:30 PM',
            image: '/assets/mineral_broth_edamame.png',
            ingredients: [
              { name: 'Vegetable broth', amount: '250ml' },
              { name: 'Kelp', amount: '2g' },
              { name: 'Edamame', amount: '100g' }
            ],
            preparation: 'Heat broth with kelp. Serve with steamed edamame.',
            tags: ['soup', 'mineral-rich', 'warming'],
            nutrition: { calories: 160, protein: 14, carbs: 12, fat: 6, fiber: 5 }
          },
          dinner: {
            name: 'Coconut Curry Red Lentil Soup',
            time: '6:30 PM',
            image: '/assets/coconut_curry_red_lentil_soup.png',
            ingredients: [
              { name: 'Red lentils', amount: '150g' },
              { name: 'Coconut milk', amount: '200ml' },
              { name: 'Curry powder', amount: '10g' },
              { name: 'Ginger', amount: '10g' },
              { name: 'Garlic', amount: '10g' },
              { name: 'Vegetable broth', amount: '500ml' },
              { name: 'Spinach', amount: '100g' }
            ],
            preparation: 'Sauté ginger and garlic. Add curry powder, lentils, broth, and coconut milk. Simmer 20 mins. Stir in spinach.',
            tags: ['soup', 'warming', 'high-protein', 'comfort'],
            nutrition: { calories: 520, protein: 26, carbs: 48, fat: 22, fiber: 16 }
          },
          evening: {
            name: 'Golden Milk',
            time: '8:30 PM',
            image: '/assets/golden_milk.png',
            ingredients: [
              { name: 'Oat milk', amount: '200ml' },
              { name: 'Turmeric', amount: '5g' },
              { name: 'Black pepper', amount: 'pinch' },
              { name: 'Cinnamon', amount: '2g' },
              { name: 'Ginger', amount: '2g' },
              { name: 'Maple syrup', amount: '5ml' }
            ],
            preparation: 'Heat milk with all spices. Whisk until frothy. Sweeten to taste.',
            tags: ['beverage', 'anti-inflammatory', 'sleep-support'],
            nutrition: { calories: 110, protein: 3, carbs: 16, fat: 4, fiber: 1 }
          }
        }
        // TODO: Add remaining days (2-6) for Week 1
        // Days 2 (Wednesday) through 6 (Sunday) follow similar structure
      }
    }
    // TODO: Add Weeks 2, 3, 4
  }
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get a meal plan from the catalog by slug
 */
function getMealPlan(slug) {
  return MEAL_PLAN_CATALOG[slug] || null;
}

/**
 * Get all purchasable meal plans (non-hormone plans)
 */
function getPurchasableMealPlans() {
  return Object.values(MEAL_PLAN_CATALOG).filter(plan =>
    plan.planType !== PLAN_TYPES.HORMONE && plan.priceCents > 0
  );
}

/**
 * Get featured meal plans for the store
 */
function getFeaturedMealPlans() {
  return Object.values(MEAL_PLAN_CATALOG).filter(plan => plan.featured);
}

/**
 * Get meal plans by goal tag
 */
function getMealPlansByGoal(goalTag) {
  return Object.values(MEAL_PLAN_CATALOG).filter(plan =>
    plan.goalTags && plan.goalTags.includes(goalTag)
  );
}

/**
 * Get available variants for a meal plan
 */
function getAvailableVariants(planSlug) {
  const plan = MEAL_PLAN_CATALOG[planSlug];
  return plan ? plan.variants : [];
}

/**
 * Check if a plan has a specific dietary variant
 */
function hasVariant(planSlug, dietType) {
  const plan = MEAL_PLAN_CATALOG[planSlug];
  return plan && plan.variants && plan.variants.includes(dietType);
}

/**
 * Get meals for a specific day in a meal plan variant
 */
function getDayMeals(planSlug, variant, weekNum, dayOfWeek) {
  // TODO: Implement once all meal data is migrated
  if (planSlug === 'hormone-cortisol' && variant === 'vegan') {
    return HORMONE_CORTISOL_MEALS.weeks[weekNum]?.days[dayOfWeek] || null;
  }
  return null;
}

/**
 * Get today's meals based on user's active plan and program day
 */
function getTodaysMeals(planSlug, variant, programStartDate) {
  const start = new Date(programStartDate);
  const now = new Date();
  const diffTime = Math.abs(now - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let currentDayNum = diffDays || 1;
  if (currentDayNum > 28) currentDayNum = 28; // Cap at 28 for 4-week plans

  const weekNum = Math.ceil(currentDayNum / 7);
  const dayOfWeek = (currentDayNum - 1) % 7; // 0 = Monday

  return {
    dayNumber: currentDayNum,
    weekNumber: weekNum,
    dayOfWeek: dayOfWeek,
    meals: getDayMeals(planSlug, variant, weekNum, dayOfWeek)
  };
}

// ============================================================
// EXPORT FOR USE IN OTHER MODULES
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MEAL_PLAN_CATALOG,
    MEAL_SLOTS,
    DIET_TYPES,
    PLAN_TYPES,
    HORMONE_CORTISOL_MEALS,
    getMealPlan,
    getPurchasableMealPlans,
    getFeaturedMealPlans,
    getMealPlansByGoal,
    getAvailableVariants,
    hasVariant,
    getDayMeals,
    getTodaysMeals
  };
}

// Make available globally for browser
if (typeof window !== 'undefined') {
  window.MEAL_PLAN_CATALOG = MEAL_PLAN_CATALOG;
  window.MEAL_SLOTS = MEAL_SLOTS;
  window.DIET_TYPES = DIET_TYPES;
  window.PLAN_TYPES = PLAN_TYPES;
  window.getMealPlan = getMealPlan;
  window.getPurchasableMealPlans = getPurchasableMealPlans;
  window.getFeaturedMealPlans = getFeaturedMealPlans;
  window.getTodaysMeals = getTodaysMeals;
}
