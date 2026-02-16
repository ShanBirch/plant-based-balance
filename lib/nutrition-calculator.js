/**
 * Nutrition Calculator - BMR, TDEE, and Macronutrient Calculations
 * Uses Mifflin-St Jeor Equation for BMR calculation
 */

/**
 * Calculate Basal Metabolic Rate (BMR) using Mifflin-St Jeor Equation
 * This is the most accurate formula for modern populations
 *
 * @param {number} weight - Weight in kg
 * @param {number} height - Height in cm
 * @param {number} age - Age in years
 * @param {string} sex - 'female' or 'male'
 * @returns {number} BMR in calories/day
 */
function calculateBMR(weight, height, age, sex) {
  // Mifflin-St Jeor Equation:
  // Men: BMR = (10 × weight in kg) + (6.25 × height in cm) - (5 × age in years) + 5
  // Women: BMR = (10 × weight in kg) + (6.25 × height in cm) - (5 × age in years) - 161

  const baseCalc = (10 * weight) + (6.25 * height) - (5 * age);

  if (sex === 'male') {
    return Math.round(baseCalc + 5);
  } else {
    return Math.round(baseCalc - 161);
  }
}

/**
 * Calculate Total Daily Energy Expenditure (TDEE)
 * Multiplies BMR by activity factor
 *
 * @param {number} bmr - Basal Metabolic Rate
 * @param {string} activityLevel - 'sedentary', 'moderate', or 'active'
 * @returns {number} TDEE in calories/day
 */
function calculateTDEE(bmr, activityLevel) {
  // Activity multipliers based on research
  const activityMultipliers = {
    'sedentary': 1.2,   // Little to no exercise
    'moderate': 1.375,  // 2-3 sessions per week
    'active': 1.55      // 4+ sessions per week
  };

  const multiplier = activityMultipliers[activityLevel] || 1.2;
  return Math.round(bmr * multiplier);
}

/**
 * Calculate calorie goal based on current weight, goal weight, and hormone profile
 *
 * @param {number} tdee - Total Daily Energy Expenditure
 * @param {number} currentWeight - Current weight in kg
 * @param {number} goalWeight - Goal weight in kg
 * @param {string} goalBodyType - 'Flat', 'Athletic', or 'Body Builder'
 * @returns {number} Daily calorie goal
 */
function calculateCalorieGoal(tdee, currentWeight, goalWeight, goalBodyType) {
  let calorieGoal = tdee;

  // Adjust for weight loss/gain goals
  if (currentWeight > goalWeight) {
    // Weight loss: deficit of 250-500 calories depending on how much to lose
    const deficit = Math.min(500, Math.max(250, (currentWeight - goalWeight) * 50));
    calorieGoal = tdee - deficit;
  } else if (currentWeight < goalWeight) {
    // Weight gain: surplus of 250-500 calories
    calorieGoal = tdee + 300;
  }

  // Adjust for body type goals
  if (goalBodyType === 'Body Builder') {
    // Higher calories for muscle building
    calorieGoal += 200;
  } else if (goalBodyType === 'Flat') {
    // Slight deficit for lean body
    calorieGoal -= 100;
  }

  // Ensure minimum safe calorie intake (1200 for women, 1500 for men)
  calorieGoal = Math.max(1200, calorieGoal);

  return Math.round(calorieGoal);
}

/**
 * Calculate macronutrient goals based on calorie goal and body type
 *
 * @param {number} calorieGoal - Daily calorie goal
 * @param {string} goalBodyType - 'Flat', 'Athletic', or 'Body Builder'
 * @param {number} weight - Current weight in kg
 * @returns {object} Object with protein_g, carbs_g, fat_g
 */
function calculateMacros(calorieGoal, goalBodyType, weight) {
  let proteinPercentage, carbPercentage, fatPercentage;

  // Macro ratios based on goal body type
  if (goalBodyType === 'Body Builder') {
    // High protein for muscle building: 30% protein, 40% carbs, 30% fat
    proteinPercentage = 0.30;
    carbPercentage = 0.40;
    fatPercentage = 0.30;
  } else if (goalBodyType === 'Athletic') {
    // Balanced for athletic performance: 25% protein, 45% carbs, 30% fat
    proteinPercentage = 0.25;
    carbPercentage = 0.45;
    fatPercentage = 0.30;
  } else {
    // Flat & Toned: 20% protein, 45% carbs, 35% fat
    proteinPercentage = 0.20;
    carbPercentage = 0.45;
    fatPercentage = 0.35;
  }

  // Calculate grams from calories
  // Protein: 4 cal/g, Carbs: 4 cal/g, Fat: 9 cal/g
  const proteinCalories = calorieGoal * proteinPercentage;
  const carbCalories = calorieGoal * carbPercentage;
  const fatCalories = calorieGoal * fatPercentage;

  const protein_g = Math.round(proteinCalories / 4);
  const carbs_g = Math.round(carbCalories / 4);
  const fat_g = Math.round(fatCalories / 9);

  // Ensure minimum protein for plant-based diet (at least 1g per kg body weight)
  const minProtein = Math.round(weight * 1.0);

  return {
    protein_g: Math.max(protein_g, minProtein),
    carbs_g: carbs_g,
    fat_g: fat_g
  };
}

/**
 * Calculate all nutrition goals from quiz data
 * Main function to call when quiz is completed
 *
 * @param {object} quizData - Object containing quiz responses
 * @returns {object} Complete nutrition goals
 */
function calculateNutritionGoals(quizData) {
  // Extract quiz data
  const {
    age,
    height, // in cm
    weight, // in kg
    goal_weight, // in kg
    sex,
    activity_level,
    goalBodyType
  } = quizData;

  // Validate inputs
  if (!age || !height || !weight || !goal_weight || !sex || !activity_level || !goalBodyType) {
    console.error('Missing required quiz data for nutrition calculation');
    return null;
  }

  // Calculate BMR
  const bmr = calculateBMR(weight, height, age, sex);

  // Calculate TDEE
  const tdee = calculateTDEE(bmr, activity_level);

  // Calculate calorie goal
  const calorie_goal = calculateCalorieGoal(tdee, weight, goal_weight, goalBodyType);

  // Calculate macros
  const macros = calculateMacros(calorie_goal, goalBodyType, weight);

  return {
    bmr,
    tdee,
    calorie_goal,
    protein_goal_g: macros.protein_g,
    carbs_goal_g: macros.carbs_g,
    fat_goal_g: macros.fat_g
  };
}

/**
 * Convert height from feet/inches to cm
 * @param {number} feet - Feet
 * @param {number} inches - Inches
 * @returns {number} Height in cm
 */
function feetToCm(feet, inches = 0) {
  const totalInches = (feet * 12) + inches;
  return Math.round(totalInches * 2.54);
}

/**
 * Convert weight from lbs to kg
 * @param {number} lbs - Weight in pounds
 * @returns {number} Weight in kg
 */
function lbsToKg(lbs) {
  return Math.round(lbs * 0.453592 * 10) / 10; // Round to 1 decimal
}

/**
 * Helper to convert quiz input units to metric
 * @param {object} quizAnswers - Raw quiz answers with unit data
 * @returns {object} Converted data in metric units
 */
function convertQuizDataToMetric(quizAnswers) {
  let height_cm, weight_kg, goal_weight_kg;

  // Convert height
  if (quizAnswers.height) {
    if (quizAnswers.height.unit === 'ft') {
      // Parse feet and inches (e.g., "5.8" = 5 feet 8 inches)
      const feet = Math.floor(quizAnswers.height.value);
      const inches = Math.round((quizAnswers.height.value - feet) * 12);
      height_cm = feetToCm(feet, inches);
    } else {
      height_cm = quizAnswers.height.value;
    }
  }

  // Convert weight
  if (quizAnswers.weight) {
    if (quizAnswers.weight.unit === 'lbs') {
      weight_kg = lbsToKg(quizAnswers.weight.value);
    } else {
      weight_kg = quizAnswers.weight.value;
    }
  }

  // Convert goal weight
  if (quizAnswers.goal_weight) {
    if (quizAnswers.goal_weight.unit === 'lbs') {
      goal_weight_kg = lbsToKg(quizAnswers.goal_weight.value);
    } else {
      goal_weight_kg = quizAnswers.goal_weight.value;
    }
  }

  return {
    age: parseInt(quizAnswers.age),
    height: height_cm,
    weight: weight_kg,
    goal_weight: goal_weight_kg,
    sex: quizAnswers.sex, // No default - validation will catch missing sex
    activity_level: quizAnswers.activity_level,
    goalBodyType: quizAnswers.goalBodyType
  };
}

/**
 * Analyze whether adaptive calorie adjustment is appropriate.
 * Checks tracking consistency over the past 14 days and compares
 * weight trend against the user's goal direction.
 *
 * @param {Array} nutritionDays - Array of daily_nutrition records (14 days)
 * @param {Array} weighIns - Array of daily_weigh_ins records (14 days)
 * @param {number} currentCalorieGoal - Current daily calorie goal
 * @param {number} goalWeight - User's goal weight in kg
 * @returns {object|null} - Adjustment recommendation or null if not eligible
 */
function analyzeAdaptiveAdjustment(nutritionDays, weighIns, currentCalorieGoal, goalWeight) {
  // --- 1. Check tracking consistency ---
  // Require at least 10 out of 14 days with tracked calories
  const trackedDays = nutritionDays.filter(d => d.total_calories && d.total_calories > 0);
  if (trackedDays.length < 10) {
    return {
      eligible: false,
      reason: 'not_enough_tracking',
      trackedDays: trackedDays.length,
      requiredDays: 10,
      message: `You've tracked ${trackedDays.length} of the last 14 days. Track at least 10 days to unlock adaptive adjustments.`
    };
  }

  // --- 2. Check goal adherence (were they close to their calorie goal?) ---
  let daysOnTarget = 0;
  trackedDays.forEach(day => {
    const goal = day.calorie_goal || currentCalorieGoal;
    if (goal > 0) {
      const ratio = day.total_calories / goal;
      // Within 20% of goal counts as "on target"
      if (ratio >= 0.8 && ratio <= 1.2) {
        daysOnTarget++;
      }
    }
  });

  const adherenceRate = Math.round((daysOnTarget / trackedDays.length) * 100);

  // --- 3. Need at least 2 weigh-ins to establish a trend ---
  if (weighIns.length < 2) {
    return {
      eligible: false,
      reason: 'not_enough_weigh_ins',
      weighInCount: weighIns.length,
      message: `You need at least 2 weigh-ins in the past 2 weeks to see weight trends. You have ${weighIns.length}.`
    };
  }

  // --- 4. Calculate weight trend ---
  // Compare average of first few weigh-ins vs last few weigh-ins
  const sortedWeighIns = [...weighIns].sort((a, b) => a.weigh_in_date.localeCompare(b.weigh_in_date));
  const halfIndex = Math.floor(sortedWeighIns.length / 2);

  const firstHalf = sortedWeighIns.slice(0, halfIndex);
  const secondHalf = sortedWeighIns.slice(halfIndex);

  const firstAvg = firstHalf.reduce((s, w) => s + w.weight_kg, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((s, w) => s + w.weight_kg, 0) / secondHalf.length;
  const weightChange = secondAvg - firstAvg; // positive = gaining, negative = losing

  const latestWeight = sortedWeighIns[sortedWeighIns.length - 1].weight_kg;

  // --- 5. Determine goal direction ---
  const wantToLose = goalWeight < latestWeight;
  const wantToGain = goalWeight > latestWeight;
  const wantToMaintain = !wantToLose && !wantToGain;

  // Threshold: consider >0.2kg change over 2 weeks as meaningful
  const CHANGE_THRESHOLD = 0.2;
  const isGaining = weightChange > CHANGE_THRESHOLD;
  const isLosing = weightChange < -CHANGE_THRESHOLD;
  const isStable = !isGaining && !isLosing;

  // --- 6. Build recommendation ---
  let suggestion = null;
  let adjustmentAmount = 0;

  if (wantToLose) {
    if (isGaining) {
      // Wants to lose but gaining - suggest calorie reduction
      adjustmentAmount = -150;
      suggestion = {
        direction: 'decrease',
        amount: 150,
        reason: `Your weight has gone up ~${Math.abs(weightChange).toFixed(1)}kg over the past 2 weeks, but your goal is to lose weight.`,
        question: 'Have you been tracking everything accurately, or have you been going over your targets?'
      };
    } else if (isStable) {
      // Wants to lose but stable - suggest small reduction
      adjustmentAmount = -100;
      suggestion = {
        direction: 'decrease',
        amount: 100,
        reason: `Your weight has been stable over the past 2 weeks. A small calorie reduction could help kickstart your weight loss.`,
        question: 'Have you been tracking everything accurately?'
      };
    } else if (isLosing) {
      // On track! Positive reinforcement
      suggestion = {
        direction: 'none',
        amount: 0,
        reason: `You're making progress! You've lost ~${Math.abs(weightChange).toFixed(1)}kg over the past 2 weeks. Keep it up!`,
        question: null
      };
    }
  } else if (wantToGain) {
    if (isLosing) {
      // Wants to gain but losing - suggest calorie increase
      adjustmentAmount = 150;
      suggestion = {
        direction: 'increase',
        amount: 150,
        reason: `Your weight has dropped ~${Math.abs(weightChange).toFixed(1)}kg over the past 2 weeks, but your goal is to gain weight.`,
        question: 'Have you been hitting your calorie targets consistently, or have you been falling short?'
      };
    } else if (isStable) {
      // Wants to gain but stable - suggest small increase
      adjustmentAmount = 100;
      suggestion = {
        direction: 'increase',
        amount: 100,
        reason: `Your weight has been stable over the past 2 weeks. A small calorie increase could help you start gaining.`,
        question: 'Have you been hitting your calorie targets consistently?'
      };
    } else if (isGaining) {
      // On track!
      suggestion = {
        direction: 'none',
        amount: 0,
        reason: `You're making progress! You've gained ~${weightChange.toFixed(1)}kg over the past 2 weeks. Keep it up!`,
        question: null
      };
    }
  } else {
    // Maintaining
    if (isGaining || isLosing) {
      const changeDir = isGaining ? 'up' : 'down';
      adjustmentAmount = isGaining ? -100 : 100;
      suggestion = {
        direction: isGaining ? 'decrease' : 'increase',
        amount: 100,
        reason: `Your weight has gone ${changeDir} ~${Math.abs(weightChange).toFixed(1)}kg, but your goal is to maintain.`,
        question: 'Would you like to adjust your calories to stay on track?'
      };
    } else {
      suggestion = {
        direction: 'none',
        amount: 0,
        reason: `Your weight is stable and you're right on track with your maintenance goal!`,
        question: null
      };
    }
  }

  // Calculate the new proposed calorie goal
  const newCalorieGoal = Math.max(1200, currentCalorieGoal + adjustmentAmount);

  return {
    eligible: true,
    trackedDays: trackedDays.length,
    adherenceRate,
    daysOnTarget,
    weightChange: Math.round(weightChange * 10) / 10,
    latestWeight,
    goalWeight,
    wantToLose,
    wantToGain,
    wantToMaintain,
    currentCalorieGoal,
    newCalorieGoal,
    suggestion
  };
}
