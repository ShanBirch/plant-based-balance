/**
 * Meal Plan Populator
 *
 * Builds a 4-week plant-based meal plan from the curated template
 * (data/vegan-challenge-meal-plan.js), scales the macros to the user's
 * calorie target, and inserts the rows into ai_generated_meal_plans /
 * ai_meal_plan_weeks / ai_generated_meals.
 *
 * Usage:
 *   const result = await populateVeganChallengeMealPlan(supabaseClient, userId, {
 *     calorie_goal: 1800,
 *     protein_goal_g: 110,
 *     carbs_goal_g: 200,
 *     fat_goal_g: 60
 *   });
 *   // result = { success: true, plan_id, plan: {...nested cache shape...} }
 */

(function () {
  const BASE_DAILY_CALORIES = 2000;

  function roundTo(n, places = 1) {
    const m = Math.pow(10, places);
    return Math.round(n * m) / m;
  }

  function parseAmountNumber(raw) {
    const text = String(raw || '').trim().toLowerCase();
    if (!text) return null;
    const words = {
      half: 0.5,
      quarter: 0.25,
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10
    };
    if (Object.prototype.hasOwnProperty.call(words, text)) return words[text];
    const mixed = text.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixed) return Number(mixed[1]) + (Number(mixed[2]) / Number(mixed[3]));
    const fraction = text.match(/^(\d+)\/(\d+)$/);
    if (fraction) return Number(fraction[1]) / Number(fraction[2]);
    const numeric = Number(text);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function formatScaledNumber(value, unit) {
    if (!Number.isFinite(value) || value <= 0) return null;
    const normalizedUnit = String(unit || '').toLowerCase();

    if (['g', 'gram', 'grams', 'ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters'].includes(normalizedUnit)) {
      const rounded = value >= 20 ? Math.round(value / 5) * 5 : Math.round(value);
      return String(Math.max(1, rounded));
    }

    const whole = Math.floor(value);
    const remainder = value - whole;
    const fractions = [
      [0.125, '1/8'],
      [0.25, '1/4'],
      [1 / 3, '1/3'],
      [0.5, '1/2'],
      [2 / 3, '2/3'],
      [0.75, '3/4']
    ];
    let closest = null;
    for (const [fractionValue, label] of fractions) {
      const distance = Math.abs(remainder - fractionValue);
      if (!closest || distance < closest.distance) {
        closest = { value: fractionValue, label, distance };
      }
    }

    if (whole >= 1) {
      if (remainder >= 0.875) return String(whole + 1);
      if (remainder <= 0.08) return String(whole);
      if (!closest || closest.distance > 0.08) return roundTo(value, 1).toString();
      return `${whole} ${closest.label}`;
    }

    if (closest && closest.distance <= 0.12) return closest.label;
    return roundTo(value, value < 0.5 ? 2 : 1).toString();
  }

  function scaleParentheticalWeights(rest, multiplier) {
    return String(rest || '').replace(/\((\d+(?:\.\d+)?)\s*(g|grams?|ml|mL)\)/gi, function(match, amount, unit) {
      const scaled = formatScaledNumber(Number(amount) * multiplier, unit);
      return scaled ? `(${scaled}${unit})` : match;
    });
  }

  function scaleAmountString(amount, multiplier) {
    const text = String(amount || '').trim();
    if (!text || !Number.isFinite(multiplier) || Math.abs(multiplier - 1) < 0.001) return amount;
    if (/^(to taste|pinch|dash|sprinkle)$/i.test(text)) return amount;

    const match = text.match(/^((?:\d+\s+)?\d+\/\d+|\d+(?:\.\d+)?|half|quarter|one|two|three|four|five|six|seven|eight|nine|ten)\s*([a-zA-Z]+)?(.*)$/i);
    if (!match) return amount;

    const value = parseAmountNumber(match[1]);
    if (!Number.isFinite(value)) return amount;

    let unit = match[2] || '';
    let rest = scaleParentheticalWeights(match[3] || '', multiplier);
    let scaledValue = value * multiplier;

    if (/^tbsp|tablespoons?$/i.test(unit) && scaledValue < 1) {
      unit = 'tsp';
      scaledValue *= 3;
    }

    const scaledText = formatScaledNumber(scaledValue, unit);
    if (!scaledText) return amount;
    return `${scaledText}${unit ? ' ' + unit : ''}${rest}`;
  }

  function scaleIngredients(ingredients, multiplier) {
    return (ingredients || []).map(ingredient => {
      if (!ingredient || typeof ingredient !== 'object' || Array.isArray(ingredient)) return ingredient;
      return {
        ...ingredient,
        amount: scaleAmountString(ingredient.amount, multiplier)
      };
    });
  }

  function macroCalories(meal) {
    return Math.round(
      (Number(meal.protein_g) || 0) * 4 +
      (Number(meal.carbs_g) || 0) * 4 +
      (Number(meal.fat_g) || 0) * 9
    );
  }

  function auditScaledPlan(plan) {
    const issues = [];
    for (const week of plan.weeks || []) {
      for (const day of week.days || []) {
        const meals = day.meals || [];
        if (meals.length !== 5) {
          issues.push(`week ${week.week_number} ${day.day_name}: expected 5 meals, got ${meals.length}`);
        }
        const dayCalories = meals.reduce((sum, meal) => sum + (Number(meal.calories) || 0), 0);
        if (plan.calorie_goal && Math.abs(dayCalories - plan.calorie_goal) > Math.max(25, plan.calorie_goal * 0.03)) {
          issues.push(`week ${week.week_number} ${day.day_name}: ${Math.round(dayCalories)} cal vs ${plan.calorie_goal} goal`);
        }
        for (const meal of meals) {
          const calculated = macroCalories(meal);
          if (calculated > 0 && Math.abs((Number(meal.calories) || 0) - calculated) > Math.max(50, (Number(meal.calories) || 0) * 0.18)) {
            issues.push(`${meal.name}: calories ${meal.calories} do not match macros ${calculated}`);
          }
          if (!meal.ingredients || meal.ingredients.length === 0) {
            issues.push(`${meal.name}: missing ingredients`);
          }
        }
      }
    }
    return { ok: issues.length === 0, issues };
  }

  /**
   * Scale a recipe's nutrition to fit the user's calorie target.
   * Preserves the recipe's intrinsic protein/carb/fat ratio.
   */
  function scaleRecipe(recipe, calorieMultiplier) {
    const f = calorieMultiplier;
    return {
      slot: recipe.slot,
      name: recipe.name,
      description: recipe.description,
      calories: Math.round(recipe.base_calories * f),
      protein_g: roundTo((recipe.protein_g || 0) * f, 1),
      carbs_g:   roundTo((recipe.carbs_g   || 0) * f, 1),
      fat_g:     roundTo((recipe.fat_g     || 0) * f, 1),
      fiber_g:   roundTo((recipe.fiber_g   || 0) * f, 1),
      ingredients: scaleIngredients(recipe.ingredients || [], f),
      preparation: recipe.preparation || '',
      prep_time_mins: recipe.prep_time_mins || 0,
      cook_time_mins: recipe.cook_time_mins || 0,
      tags: recipe.tags || [],
      cuisine: recipe.cuisine || '',
      image_url: recipe.image || ''
    };
  }

  /**
   * Build the in-memory plan structure that matches what the renderer expects.
   * Doesn't touch the database.
   */
  function buildScaledPlan(userTargets) {
    const tpl = window.VEGAN_CHALLENGE_MEAL_PLAN;
    if (!tpl) throw new Error('VEGAN_CHALLENGE_MEAL_PLAN template not loaded');

    const calorieGoal = userTargets.calorie_goal || BASE_DAILY_CALORIES;
    const multiplier = calorieGoal / BASE_DAILY_CALORIES;

    const SLOT_ORDER = ['breakfast', 'am_snack', 'lunch', 'pm_snack', 'dinner'];
    const weeks = [];

    for (let w = 1; w <= 4; w++) {
      const themeRow = tpl.WEEK_THEMES.find(t => t.week_number === w) || {};
      const days = [];
      for (let d = 0; d < 7; d++) {
        const flatIndex = (w - 1) * 7 + d;
        const daySched = tpl.SCHEDULE[flatIndex];
        const meals = SLOT_ORDER.map(slot => {
          const recipeId = daySched[slot];
          const recipe = tpl.RECIPES[recipeId];
          if (!recipe) {
            console.warn(`[meal-plan] missing recipe ${recipeId} at week ${w} day ${d} slot ${slot}`);
            return null;
          }
          const scaled = scaleRecipe(recipe, multiplier);
          return {
            meal_slot: slot,
            meal_time: tpl.MEAL_TIMES[slot],
            ...scaled
          };
        }).filter(Boolean);

        days.push({
          day_of_week: d,
          day_name: tpl.DAY_NAMES[d],
          meals
        });
      }
      weeks.push({
        week_number: w,
        theme: themeRow.theme || `Week ${w}`,
        theme_description: themeRow.theme_description || '',
        days
      });
    }

    const plan = {
      plan_name: tpl.PLAN_NAME,
      plan_description: tpl.PLAN_DESCRIPTION,
      diet_type: 'vegan',
      total_meals: 140,
      current_week: 1,
      calorie_goal: calorieGoal,
      protein_goal_g: userTargets.protein_goal_g || null,
      carbs_goal_g:   userTargets.carbs_goal_g   || null,
      fat_goal_g:     userTargets.fat_goal_g     || null,
      weeks
    };

    const audit = auditScaledPlan(plan);
    if (!audit.ok) {
      throw new Error(`Meal plan nutrition audit failed: ${audit.issues.slice(0, 4).join('; ')}`);
    }

    return plan;
  }

  /**
   * Insert the scaled plan into Supabase. Returns the plan_id and the
   * full nested structure (matches the renderer's _aiMealPlanCache shape).
   */
  async function populateVeganChallengeMealPlan(supabase, userId, userTargets) {
    if (!supabase || !userId) {
      throw new Error('populateVeganChallengeMealPlan: supabase + userId required');
    }
    const scaled = buildScaledPlan(userTargets || {});

    // 1) Insert the parent plan row
    const planInsert = await supabase
      .from('ai_generated_meal_plans')
      .insert({
        user_id: userId,
        plan_name: scaled.plan_name,
        plan_description: scaled.plan_description,
        status: 'active',
        calorie_goal: scaled.calorie_goal,
        protein_goal_g: scaled.protein_goal_g,
        carbs_goal_g:   scaled.carbs_goal_g,
        fat_goal_g:     scaled.fat_goal_g,
        diet_type: 'vegan',
        total_meals: 140,
        current_week: 1
      })
      .select('id')
      .single();

    if (planInsert.error) throw planInsert.error;
    const planId = planInsert.data.id;

    // 2) Insert the 4 week-theme rows
    const weekRows = scaled.weeks.map(w => ({
      plan_id: planId,
      week_number: w.week_number,
      theme: w.theme,
      theme_description: w.theme_description
    }));
    const weekInsert = await supabase
      .from('ai_meal_plan_weeks')
      .insert(weekRows);
    if (weekInsert.error) throw weekInsert.error;

    // 3) Build & insert all 140 meal rows in one batch
    const mealRows = [];
    for (const week of scaled.weeks) {
      for (const day of week.days) {
        for (const meal of day.meals) {
          mealRows.push({
            plan_id: planId,
            week_number: week.week_number,
            day_of_week: day.day_of_week,
            day_name: day.day_name,
            meal_slot: meal.meal_slot,
            meal_time: meal.meal_time,
            name: meal.name,
            description: meal.description,
            calories: meal.calories,
            protein_g: meal.protein_g,
            carbs_g: meal.carbs_g,
            fat_g: meal.fat_g,
            fiber_g: meal.fiber_g,
            ingredients: meal.ingredients,
            preparation: meal.preparation,
            prep_time_mins: meal.prep_time_mins,
            cook_time_mins: meal.cook_time_mins,
            tags: meal.tags,
            cuisine: meal.cuisine,
            image_url: meal.image_url
          });
        }
      }
    }
    const mealsInsert = await supabase
      .from('ai_generated_meals')
      .insert(mealRows);
    if (mealsInsert.error) throw mealsInsert.error;

    return {
      success: true,
      plan_id: planId,
      plan: { id: planId, ...scaled }
    };
  }

  /**
   * Idempotent helper: if user already has an active meal plan, return it.
   * Otherwise create one. Used by the cohort-enrollment auto-trigger.
   */
  async function ensureVeganChallengeMealPlan(supabase, userId, userTargets) {
    if (!supabase || !userId) return { success: false, reason: 'missing-args' };
    try {
      const existing = await supabase
        .from('ai_generated_meal_plans')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      if (existing.error) {
        console.warn('[meal-plan] lookup error:', existing.error);
      }
      if (existing.data?.id) {
        return { success: true, already_exists: true, plan_id: existing.data.id };
      }
    } catch (e) {
      console.warn('[meal-plan] existing lookup threw:', e);
    }

    return populateVeganChallengeMealPlan(supabase, userId, userTargets || {});
  }

  /**
   * Pull the user's current calorie/macro targets from the quiz_results /
   * users tables so the populator can scale meals correctly.
   */
  async function getUserNutritionTargets(supabase, userId) {
    if (!supabase || !userId) return {};

    try {
      // Try quiz_results first (richest source)
      const qr = await supabase
        .from('quiz_results')
        .select('calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!qr.error && qr.data?.calorie_goal) {
        return {
          calorie_goal: qr.data.calorie_goal,
          protein_goal_g: qr.data.protein_goal_g,
          carbs_goal_g:   qr.data.carbs_goal_g,
          fat_goal_g:     qr.data.fat_goal_g
        };
      }
    } catch (e) {
      console.warn('[meal-plan] quiz_results lookup failed:', e);
    }

    // Fallback: users table
    try {
      const u = await supabase
        .from('users')
        .select('calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g')
        .eq('id', userId)
        .maybeSingle();
      if (!u.error && u.data?.calorie_goal) {
        return {
          calorie_goal: u.data.calorie_goal,
          protein_goal_g: u.data.protein_goal_g,
          carbs_goal_g:   u.data.carbs_goal_g,
          fat_goal_g:     u.data.fat_goal_g
        };
      }
    } catch (e) {
      console.warn('[meal-plan] users lookup failed:', e);
    }

    return {};
  }

  /**
   * Returns true if the user signed up via the vegan-challenge funnel
   * (i.e. has a claimed `cohort_invitations` row, regardless of whether
   * the cohort has started yet). Used to gate auto-populate-on-view-load
   * so non-funnel users still see the manual `Generate My Meal Plan` CTA.
   */
  async function isVeganChallengeUser(supabase, userId) {
    if (!supabase || !userId) return false;
    try {
      const { data, error } = await supabase
        .from('cohort_invitations')
        .select('id')
        .eq('claimed_by_user_id', userId)
        .eq('cohort_type', 'plant_based_30')
        .limit(1)
        .maybeSingle();
      if (error) {
        console.warn('[meal-plan] vegan-challenge gate lookup error:', error);
        return false;
      }
      return !!data?.id;
    } catch (e) {
      console.warn('[meal-plan] vegan-challenge gate lookup threw:', e);
      return false;
    }
  }

  // Expose
  window.buildScaledMealPlan = buildScaledPlan;
  window.populateVeganChallengeMealPlan = populateVeganChallengeMealPlan;
  window.ensureVeganChallengeMealPlan = ensureVeganChallengeMealPlan;
  window.getUserNutritionTargets = getUserNutritionTargets;
  window.isVeganChallengeUser = isVeganChallengeUser;
})();
