// Selected existing lessons move into the core path; all others stay in the specialist library.
// Lesson IDs and stored completions are unchanged.
(function(){'use strict';
const lessons=[
  {
    "id": "mind-1-1",
    "title": "Meet the Researchers",
    "unit": "mind-1",
    "topic": "The Prediction Machine",
    "course": "learn",
    "week": 1,
    "required": true
  },
  {
    "id": "mind-1-2",
    "title": "Your Brain Guesses First",
    "unit": "mind-1",
    "topic": "The Prediction Machine",
    "course": "learn",
    "week": 1,
    "required": true
  },
  {
    "id": "mind-1-3",
    "title": "Prediction Errors = Learning",
    "unit": "mind-1",
    "topic": "The Prediction Machine",
    "course": "learn",
    "week": 1,
    "required": true
  },
  {
    "id": "mind-1-4",
    "title": "Your Past Creates Your Present",
    "unit": "mind-1",
    "topic": "The Prediction Machine",
    "course": "learn",
    "week": 1,
    "required": true
  },
  {
    "id": "mind-1-5",
    "title": "The Bayesian Brain",
    "unit": "mind-1",
    "topic": "The Prediction Machine",
    "course": "learn",
    "week": 1,
    "required": true
  },
  {
    "id": "mind-2-1",
    "title": "Beyond Homeostasis",
    "unit": "mind-2",
    "topic": "Body Budgeting",
    "course": "learn",
    "week": 2,
    "required": true
  },
  {
    "id": "mind-2-2",
    "title": "The Body Budget",
    "unit": "mind-2",
    "topic": "Body Budgeting",
    "course": "learn",
    "week": 2,
    "required": true
  },
  {
    "id": "mind-2-3",
    "title": "Feelings Are Predictions",
    "unit": "mind-2",
    "topic": "Body Budgeting",
    "course": "learn",
    "week": 2,
    "required": true
  },
  {
    "id": "mind-2-4",
    "title": "Why You Feel Tired Before You're Tired",
    "unit": "mind-2",
    "topic": "Body Budgeting",
    "course": "learn",
    "week": 2,
    "required": true
  },
  {
    "id": "mind-2-5",
    "title": "Stress Is a Prediction",
    "unit": "mind-2",
    "topic": "Body Budgeting",
    "course": "learn",
    "week": 2,
    "required": true
  },
  {
    "id": "mind-3-1",
    "title": "Concepts Are Constructed",
    "unit": "mind-3",
    "topic": "Experience Shapes Reality",
    "course": "specialist",
    "required": false
  },
  {
    "id": "mind-3-2",
    "title": "Emotion Categories Are Learned",
    "unit": "mind-3",
    "topic": "Experience Shapes Reality",
    "course": "specialist",
    "required": false
  },
  {
    "id": "mind-3-3",
    "title": "Your Past Writes Your Present",
    "unit": "mind-3",
    "topic": "Experience Shapes Reality",
    "course": "specialist",
    "required": false
  },
  {
    "id": "mind-3-4",
    "title": "Context Changes Everything",
    "unit": "mind-3",
    "topic": "Experience Shapes Reality",
    "course": "specialist",
    "required": false
  },
  {
    "id": "mind-3-5",
    "title": "You Can Reshape Experience",
    "unit": "mind-3",
    "topic": "Experience Shapes Reality",
    "course": "specialist",
    "required": false
  },
  {
    "id": "mind-4-1",
    "title": "Why Habits Work",
    "unit": "mind-4",
    "topic": "Training the Predictive Brain",
    "course": "learn",
    "week": 3,
    "required": true
  },
  {
    "id": "mind-4-2",
    "title": "The Power of Consistency",
    "unit": "mind-4",
    "topic": "Training the Predictive Brain",
    "course": "learn",
    "week": 3,
    "required": true
  },
  {
    "id": "mind-4-3",
    "title": "Minimum Viable Actions",
    "unit": "mind-4",
    "topic": "Training the Predictive Brain",
    "course": "learn",
    "week": 3,
    "required": true
  },
  {
    "id": "mind-4-4",
    "title": "Environment as Prediction Trigger",
    "unit": "mind-4",
    "topic": "Training the Predictive Brain",
    "course": "learn",
    "week": 3,
    "required": true
  },
  {
    "id": "mind-4-5",
    "title": "Why Streaks Matter Neurologically",
    "unit": "mind-4",
    "topic": "Training the Predictive Brain",
    "course": "learn",
    "week": 3,
    "required": true
  },
  {
    "id": "mind-5-1",
    "title": "Identity Is a Prediction",
    "unit": "mind-5",
    "topic": "Becoming Your Future Self",
    "course": "become",
    "week": 1,
    "required": false
  },
  {
    "id": "mind-5-2",
    "title": "Acting Into Identity",
    "unit": "mind-5",
    "topic": "Becoming Your Future Self",
    "course": "become",
    "week": 2,
    "required": false
  },
  {
    "id": "mind-5-3",
    "title": "The Compound Effect of Small Acts",
    "unit": "mind-5",
    "topic": "Becoming Your Future Self",
    "course": "become",
    "week": 3,
    "required": false
  },
  {
    "id": "mind-5-4",
    "title": "Future Self Is a Stranger",
    "unit": "mind-5",
    "topic": "Becoming Your Future Self",
    "course": "become",
    "week": 4,
    "required": false
  },
  {
    "id": "mind-5-5",
    "title": "You Are the Architect",
    "unit": "mind-5",
    "topic": "Becoming Your Future Self",
    "course": "become",
    "week": 5,
    "required": false
  },
  {
    "id": "mind-6-1",
    "title": "Willpower Isn't Real",
    "unit": "mind-6",
    "topic": "Change Is Counter-Intuitive",
    "course": "learn",
    "week": 5,
    "required": true
  },
  {
    "id": "mind-6-2",
    "title": "All Behavior Is Prediction",
    "unit": "mind-6",
    "topic": "Change Is Counter-Intuitive",
    "course": "learn",
    "week": 5,
    "required": true
  },
  {
    "id": "mind-6-3",
    "title": "You Didn't Choose Most of Your Habits",
    "unit": "mind-6",
    "topic": "Change Is Counter-Intuitive",
    "course": "learn",
    "week": 5,
    "required": true
  },
  {
    "id": "mind-6-4",
    "title": "Redesign the System, Not Yourself",
    "unit": "mind-6",
    "topic": "Change Is Counter-Intuitive",
    "course": "learn",
    "week": 5,
    "required": true
  },
  {
    "id": "mind-6-5",
    "title": "People Are Your Strongest Environment",
    "unit": "mind-6",
    "topic": "Change Is Counter-Intuitive",
    "course": "learn",
    "week": 5,
    "required": true
  },
  {
    "id": "mind-7-1",
    "title": "Your Brain Minimizes Surprise",
    "unit": "mind-7",
    "topic": "The Free Energy Principle",
    "course": "specialist",
    "required": false
  },
  {
    "id": "mind-7-2",
    "title": "Two Ways to Minimize Surprise",
    "unit": "mind-7",
    "topic": "The Free Energy Principle",
    "course": "specialist",
    "required": false
  },
  {
    "id": "mind-7-3",
    "title": "Precision: What Your Brain Listens To",
    "unit": "mind-7",
    "topic": "The Free Energy Principle",
    "course": "specialist",
    "required": false
  },
  {
    "id": "mind-7-4",
    "title": "Your Body Budget Drives Everything",
    "unit": "mind-7",
    "topic": "The Free Energy Principle",
    "course": "specialist",
    "required": false
  },
  {
    "id": "mind-7-5",
    "title": "You and Your Environment Are One System",
    "unit": "mind-7",
    "topic": "The Free Energy Principle",
    "course": "specialist",
    "required": false
  },
  {
    "id": "mind-8-1",
    "title": "Learning Costs Energy",
    "unit": "mind-8",
    "topic": "Why Your Brain Resists Learning",
    "course": "specialist",
    "required": false
  },
  {
    "id": "mind-8-2",
    "title": "Confirmation Bias Is the Operating System",
    "unit": "mind-8",
    "topic": "Why Your Brain Resists Learning",
    "course": "specialist",
    "required": false
  },
  {
    "id": "mind-8-3",
    "title": "Your Brain Builds Reality to Match",
    "unit": "mind-8",
    "topic": "Why Your Brain Resists Learning",
    "course": "specialist",
    "required": false
  },
  {
    "id": "mind-8-4",
    "title": "Why People Refuse New Information",
    "unit": "mind-8",
    "topic": "Why Your Brain Resists Learning",
    "course": "specialist",
    "required": false
  },
  {
    "id": "mind-8-5",
    "title": "Making Learning Less Expensive",
    "unit": "mind-8",
    "topic": "Why Your Brain Resists Learning",
    "course": "specialist",
    "required": false
  },
  {
    "id": "body-1-1",
    "title": "What Muscles Actually Do",
    "unit": "body-1",
    "topic": "Muscle Basics",
    "course": "master",
    "week": 1,
    "required": false
  },
  {
    "id": "body-1-2",
    "title": "Opposing Pairs",
    "unit": "body-1",
    "topic": "Muscle Basics",
    "course": "master",
    "week": 1,
    "required": false
  },
  {
    "id": "body-1-3",
    "title": "Muscle Fiber Types",
    "unit": "body-1",
    "topic": "Muscle Basics",
    "course": "specialist",
    "required": false
  },
  {
    "id": "body-1-4",
    "title": "How Muscles Grow",
    "unit": "body-1",
    "topic": "Muscle Basics",
    "course": "specialist",
    "required": false
  },
  {
    "id": "body-1-5",
    "title": "Use It or Lose It",
    "unit": "body-1",
    "topic": "Muscle Basics",
    "course": "specialist",
    "required": false
  },
  {
    "id": "body-2-1",
    "title": "What Is 'The Core'?",
    "unit": "body-2",
    "topic": "The Core Foundation",
    "course": "master",
    "week": 2,
    "required": false
  },
  {
    "id": "body-2-2",
    "title": "Core as Force Transfer",
    "unit": "body-2",
    "topic": "The Core Foundation",
    "course": "specialist",
    "required": false
  },
  {
    "id": "body-2-3",
    "title": "Bracing vs. Sucking In",
    "unit": "body-2",
    "topic": "The Core Foundation",
    "course": "master",
    "week": 2,
    "required": false
  },
  {
    "id": "body-2-4",
    "title": "The Deep Stabilizers",
    "unit": "body-2",
    "topic": "The Core Foundation",
    "course": "specialist",
    "required": false
  },
  {
    "id": "body-2-5",
    "title": "Core in Daily Life",
    "unit": "body-2",
    "topic": "The Core Foundation",
    "course": "specialist",
    "required": false
  },
  {
    "id": "body-3-1",
    "title": "What Is the Kinetic Chain?",
    "unit": "body-3",
    "topic": "The Kinetic Chain",
    "course": "master",
    "week": 2,
    "required": false
  },
  {
    "id": "body-3-2",
    "title": "The Posterior Chain",
    "unit": "body-3",
    "topic": "The Kinetic Chain",
    "course": "master",
    "week": 2,
    "required": false
  },
  {
    "id": "body-3-3",
    "title": "Compensation Patterns",
    "unit": "body-3",
    "topic": "The Kinetic Chain",
    "course": "specialist",
    "required": false
  },
  {
    "id": "body-3-4",
    "title": "Ground Up Force",
    "unit": "body-3",
    "topic": "The Kinetic Chain",
    "course": "specialist",
    "required": false
  },
  {
    "id": "body-3-5",
    "title": "Training the Chain",
    "unit": "body-3",
    "topic": "The Kinetic Chain",
    "course": "specialist",
    "required": false
  },
  {
    "id": "body-4-1",
    "title": "Posture Is Dynamic",
    "unit": "body-4",
    "topic": "Posture & Form",
    "course": "master",
    "week": 2,
    "required": false
  },
  {
    "id": "body-4-2",
    "title": "Neutral Spine",
    "unit": "body-4",
    "topic": "Posture & Form",
    "course": "master",
    "week": 2,
    "required": false
  },
  {
    "id": "body-4-3",
    "title": "Hip Hinge Pattern",
    "unit": "body-4",
    "topic": "Posture & Form",
    "course": "master",
    "week": 2,
    "required": false
  },
  {
    "id": "body-4-4",
    "title": "Stacking for Standing",
    "unit": "body-4",
    "topic": "Posture & Form",
    "course": "specialist",
    "required": false
  },
  {
    "id": "body-4-5",
    "title": "Movement Quality",
    "unit": "body-4",
    "topic": "Posture & Form",
    "course": "master",
    "week": 2,
    "required": false
  },
  {
    "id": "body-5-1",
    "title": "Progressive Overload",
    "unit": "body-5",
    "topic": "Training Smart",
    "course": "master",
    "week": 4,
    "required": false
  },
  {
    "id": "body-5-2",
    "title": "Recovery Is Training",
    "unit": "body-5",
    "topic": "Training Smart",
    "course": "master",
    "week": 4,
    "required": false
  },
  {
    "id": "body-5-3",
    "title": "Specificity Principle",
    "unit": "body-5",
    "topic": "Training Smart",
    "course": "master",
    "week": 4,
    "required": false
  },
  {
    "id": "body-5-4",
    "title": "Minimum Effective Dose",
    "unit": "body-5",
    "topic": "Training Smart",
    "course": "specialist",
    "required": false
  },
  {
    "id": "body-5-5",
    "title": "Patience and Consistency",
    "unit": "body-5",
    "topic": "Training Smart",
    "course": "specialist",
    "required": false
  },
  {
    "id": "fuel-1-1",
    "title": "Calories Are Energy",
    "unit": "fuel-1",
    "topic": "Energy Fundamentals",
    "course": "master",
    "week": 7,
    "required": false
  },
  {
    "id": "fuel-1-2",
    "title": "Energy Balance",
    "unit": "fuel-1",
    "topic": "Energy Fundamentals",
    "course": "learn",
    "week": 6,
    "required": true
  },
  {
    "id": "fuel-1-3",
    "title": "Where Calories Out Go",
    "unit": "fuel-1",
    "topic": "Energy Fundamentals",
    "course": "specialist",
    "required": false
  },
  {
    "id": "fuel-1-4",
    "title": "Metabolic Adaptation",
    "unit": "fuel-1",
    "topic": "Energy Fundamentals",
    "course": "specialist",
    "required": false
  },
  {
    "id": "fuel-1-5",
    "title": "Energy for Performance",
    "unit": "fuel-1",
    "topic": "Energy Fundamentals",
    "course": "specialist",
    "required": false
  },
  {
    "id": "fuel-2-1",
    "title": "The Three Macros",
    "unit": "fuel-2",
    "topic": "Macronutrients",
    "course": "master",
    "week": 7,
    "required": false
  },
  {
    "id": "fuel-2-2",
    "title": "Protein Essentials",
    "unit": "fuel-2",
    "topic": "Macronutrients",
    "course": "learn",
    "week": 6,
    "required": true
  },
  {
    "id": "fuel-2-3",
    "title": "Carbohydrates: Not the Enemy",
    "unit": "fuel-2",
    "topic": "Macronutrients",
    "course": "learn",
    "week": 6,
    "required": true
  },
  {
    "id": "fuel-2-4",
    "title": "Fats: Essential, Not Extra",
    "unit": "fuel-2",
    "topic": "Macronutrients",
    "course": "learn",
    "week": 6,
    "required": true
  },
  {
    "id": "fuel-2-5",
    "title": "Finding Your Balance",
    "unit": "fuel-2",
    "topic": "Macronutrients",
    "course": "master",
    "week": 7,
    "required": false
  },
  {
    "id": "fuel-3-1",
    "title": "Micros: The Hidden Essentials",
    "unit": "fuel-3",
    "topic": "Micronutrients",
    "course": "master",
    "week": 8,
    "required": false
  },
  {
    "id": "fuel-3-2",
    "title": "Key Vitamins",
    "unit": "fuel-3",
    "topic": "Micronutrients",
    "course": "specialist",
    "required": false
  },
  {
    "id": "fuel-3-3",
    "title": "Key Minerals",
    "unit": "fuel-3",
    "topic": "Micronutrients",
    "course": "specialist",
    "required": false
  },
  {
    "id": "fuel-3-4",
    "title": "Electrolytes for Performance",
    "unit": "fuel-3",
    "topic": "Micronutrients",
    "course": "specialist",
    "required": false
  },
  {
    "id": "fuel-3-5",
    "title": "Food First Approach",
    "unit": "fuel-3",
    "topic": "Micronutrients",
    "course": "master",
    "week": 8,
    "required": false
  },
  {
    "id": "fuel-4-1",
    "title": "Does Timing Matter?",
    "unit": "fuel-4",
    "topic": "Meal Timing",
    "course": "master",
    "week": 9,
    "required": false
  },
  {
    "id": "fuel-4-2",
    "title": "Pre-Workout Nutrition",
    "unit": "fuel-4",
    "topic": "Meal Timing",
    "course": "master",
    "week": 9,
    "required": false
  },
  {
    "id": "fuel-4-3",
    "title": "Post-Workout Nutrition",
    "unit": "fuel-4",
    "topic": "Meal Timing",
    "course": "master",
    "week": 9,
    "required": false
  },
  {
    "id": "fuel-4-4",
    "title": "Meal Frequency",
    "unit": "fuel-4",
    "topic": "Meal Timing",
    "course": "master",
    "week": 9,
    "required": false
  },
  {
    "id": "fuel-4-5",
    "title": "Circadian Eating",
    "unit": "fuel-4",
    "topic": "Meal Timing",
    "course": "specialist",
    "required": false
  },
  {
    "id": "fuel-5-1",
    "title": "Fat Loss Nutrition",
    "unit": "fuel-5",
    "topic": "Fueling for Goals",
    "course": "master",
    "week": 10,
    "required": false
  },
  {
    "id": "fuel-5-2",
    "title": "Muscle Building Nutrition",
    "unit": "fuel-5",
    "topic": "Fueling for Goals",
    "course": "master",
    "week": 10,
    "required": false
  },
  {
    "id": "fuel-5-3",
    "title": "Performance Nutrition",
    "unit": "fuel-5",
    "topic": "Fueling for Goals",
    "course": "specialist",
    "required": false
  },
  {
    "id": "fuel-5-4",
    "title": "Recomposition: The Middle Path",
    "unit": "fuel-5",
    "topic": "Fueling for Goals",
    "course": "specialist",
    "required": false
  },
  {
    "id": "fuel-5-5",
    "title": "Sustainable Nutrition",
    "unit": "fuel-5",
    "topic": "Fueling for Goals",
    "course": "learn",
    "week": 6,
    "required": true
  },
  {
    "id": "fuel-6-1",
    "title": "Cravings Are Predictions",
    "unit": "fuel-6",
    "topic": "Emotional Eating Decoded",
    "course": "learn",
    "week": 4,
    "required": true
  },
  {
    "id": "fuel-6-2",
    "title": "Your Body Budget Explains Everything",
    "unit": "fuel-6",
    "topic": "Emotional Eating Decoded",
    "course": "learn",
    "week": 4,
    "required": true
  },
  {
    "id": "fuel-6-3",
    "title": "Comfort Food Is Rational (Short-Term)",
    "unit": "fuel-6",
    "topic": "Emotional Eating Decoded",
    "course": "learn",
    "week": 4,
    "required": true
  },
  {
    "id": "fuel-6-4",
    "title": "Emotional Granularity Changes Everything",
    "unit": "fuel-6",
    "topic": "Emotional Eating Decoded",
    "course": "learn",
    "week": 4,
    "required": true
  },
  {
    "id": "fuel-6-5",
    "title": "Fix the Budget, Not the Craving",
    "unit": "fuel-6",
    "topic": "Emotional Eating Decoded",
    "course": "learn",
    "week": 4,
    "required": true
  },
  {
    "id": "fuel-7-1",
    "title": "Do You Really Need Supplements?",
    "unit": "fuel-7",
    "topic": "Vitamins & Supplements Quiz",
    "course": "specialist",
    "required": false
  },
  {
    "id": "fuel-7-2",
    "title": "The Most Common Deficiencies",
    "unit": "fuel-7",
    "topic": "Vitamins & Supplements Quiz",
    "course": "specialist",
    "required": false
  },
  {
    "id": "fuel-7-3",
    "title": "Reading Supplement Labels",
    "unit": "fuel-7",
    "topic": "Vitamins & Supplements Quiz",
    "course": "specialist",
    "required": false
  },
  {
    "id": "fuel-7-4",
    "title": "Evidence-Based Supplements",
    "unit": "fuel-7",
    "topic": "Vitamins & Supplements Quiz",
    "course": "specialist",
    "required": false
  },
  {
    "id": "fuel-7-5",
    "title": "Building Your Supplement Strategy",
    "unit": "fuel-7",
    "topic": "Vitamins & Supplements Quiz",
    "course": "specialist",
    "required": false
  },
  {
    "id": "fuel-8-1",
    "title": "Vitamin Myth Busters",
    "unit": "fuel-8",
    "topic": "Supplement Game",
    "course": "specialist",
    "required": false
  },
  {
    "id": "fuel-8-2",
    "title": "Match the Nutrient to the Source",
    "unit": "fuel-8",
    "topic": "Supplement Game",
    "course": "specialist",
    "required": false
  },
  {
    "id": "fuel-8-3",
    "title": "Spot the Scam",
    "unit": "fuel-8",
    "topic": "Supplement Game",
    "course": "specialist",
    "required": false
  },
  {
    "id": "fuel-8-4",
    "title": "Timing and Stacking Challenge",
    "unit": "fuel-8",
    "topic": "Supplement Game",
    "course": "specialist",
    "required": false
  },
  {
    "id": "fuel-8-5",
    "title": "Build Your Perfect Stack",
    "unit": "fuel-8",
    "topic": "Supplement Game",
    "course": "specialist",
    "required": false
  },
  {
    "id": "longevity-1-1",
    "title": "The Hallmarks of Aging",
    "unit": "longevity-1",
    "topic": "The Science of Aging",
    "course": "specialist",
    "required": false
  },
  {
    "id": "longevity-1-2",
    "title": "DNA: Your Hardware & Software",
    "unit": "longevity-1",
    "topic": "The Science of Aging",
    "course": "specialist",
    "required": false
  },
  {
    "id": "longevity-1-3",
    "title": "Telomeres: Your Cellular Clock",
    "unit": "longevity-1",
    "topic": "The Science of Aging",
    "course": "specialist",
    "required": false
  },
  {
    "id": "longevity-1-4",
    "title": "The Protein Factory & Fuel Sensors",
    "unit": "longevity-1",
    "topic": "The Science of Aging",
    "course": "specialist",
    "required": false
  },
  {
    "id": "longevity-1-5",
    "title": "Mitochondria: Your Energy Engines",
    "unit": "longevity-1",
    "topic": "The Science of Aging",
    "course": "specialist",
    "required": false
  },
  {
    "id": "longevity-1-6",
    "title": "Zombie Cells & Noisy Communication",
    "unit": "longevity-1",
    "topic": "The Science of Aging",
    "course": "specialist",
    "required": false
  },
  {
    "id": "longevity-1-7",
    "title": "Stem Cells: Your Repair Crew",
    "unit": "longevity-1",
    "topic": "The Science of Aging",
    "course": "specialist",
    "required": false
  },
  {
    "id": "longevity-1-8",
    "title": "Biological vs. Chronological Age",
    "unit": "longevity-1",
    "topic": "The Science of Aging",
    "course": "specialist",
    "required": false
  },
  {
    "id": "longevity-2-1",
    "title": "Blood Sugar: The Hidden Crisis",
    "unit": "longevity-2",
    "topic": "Metabolic Health",
    "course": "specialist",
    "required": false
  },
  {
    "id": "longevity-2-2",
    "title": "Insulin Resistance: The Root Problem",
    "unit": "longevity-2",
    "topic": "Metabolic Health",
    "course": "specialist",
    "required": false
  },
  {
    "id": "longevity-2-3",
    "title": "The Glucose Spike Solution",
    "unit": "longevity-2",
    "topic": "Metabolic Health",
    "course": "specialist",
    "required": false
  },
  {
    "id": "longevity-2-4",
    "title": "Metabolic Flexibility",
    "unit": "longevity-2",
    "topic": "Metabolic Health",
    "course": "specialist",
    "required": false
  },
  {
    "id": "longevity-2-5",
    "title": "Time-Restricted Eating",
    "unit": "longevity-2",
    "topic": "Metabolic Health",
    "course": "specialist",
    "required": false
  },
  {
    "id": "longevity-3-1",
    "title": "Heart Disease: The Leading Killer",
    "unit": "longevity-3",
    "topic": "Chronic Disease Prevention",
    "course": "specialist",
    "required": false
  },
  {
    "id": "longevity-3-2",
    "title": "Cancer: Reducing Your Risk",
    "unit": "longevity-3",
    "topic": "Chronic Disease Prevention",
    "course": "specialist",
    "required": false
  },
  {
    "id": "longevity-3-3",
    "title": "Type 2 Diabetes: A Lifestyle Disease",
    "unit": "longevity-3",
    "topic": "Chronic Disease Prevention",
    "course": "specialist",
    "required": false
  },
  {
    "id": "longevity-3-4",
    "title": "Cognitive Decline and Dementia",
    "unit": "longevity-3",
    "topic": "Chronic Disease Prevention",
    "course": "specialist",
    "required": false
  },
  {
    "id": "longevity-3-5",
    "title": "The Common Thread: Prevention Power",
    "unit": "longevity-3",
    "topic": "Chronic Disease Prevention",
    "course": "specialist",
    "required": false
  },
  {
    "id": "longevity-4-1",
    "title": "Autophagy: Cellular Self-Cleaning",
    "unit": "longevity-4",
    "topic": "Cellular Health & Repair",
    "course": "specialist",
    "required": false
  },
  {
    "id": "longevity-4-2",
    "title": "Mitochondria: Your Energy Factories",
    "unit": "longevity-4",
    "topic": "Cellular Health & Repair",
    "course": "specialist",
    "required": false
  },
  {
    "id": "longevity-4-3",
    "title": "NAD+ and Cellular Energy",
    "unit": "longevity-4",
    "topic": "Cellular Health & Repair",
    "course": "specialist",
    "required": false
  },
  {
    "id": "longevity-4-4",
    "title": "DNA Repair and Protection",
    "unit": "longevity-4",
    "topic": "Cellular Health & Repair",
    "course": "specialist",
    "required": false
  },
  {
    "id": "longevity-4-5",
    "title": "Hormesis: Stress That Strengthens",
    "unit": "longevity-4",
    "topic": "Cellular Health & Repair",
    "course": "specialist",
    "required": false
  },
  {
    "id": "longevity-5-1",
    "title": "Sleep: The Foundation of Health",
    "unit": "longevity-5",
    "topic": "Lifestyle Medicine",
    "course": "specialist",
    "required": false
  },
  {
    "id": "longevity-5-2",
    "title": "Stress: The Double-Edged Sword",
    "unit": "longevity-5",
    "topic": "Lifestyle Medicine",
    "course": "specialist",
    "required": false
  },
  {
    "id": "longevity-5-3",
    "title": "Movement: The Non-Negotiable",
    "unit": "longevity-5",
    "topic": "Lifestyle Medicine",
    "course": "specialist",
    "required": false
  },
  {
    "id": "longevity-5-4",
    "title": "Connection and Purpose",
    "unit": "longevity-5",
    "topic": "Lifestyle Medicine",
    "course": "lead",
    "week": 1,
    "required": false
  },
  {
    "id": "longevity-5-5",
    "title": "The Longevity Blueprint",
    "unit": "longevity-5",
    "topic": "Lifestyle Medicine",
    "course": "specialist",
    "required": false
  },
  {
    "id": "workouts-1-1",
    "title": "The Principle of Adaptation",
    "unit": "workouts-1",
    "topic": "Training Fundamentals",
    "course": "master",
    "week": 4,
    "required": false
  },
  {
    "id": "workouts-1-2",
    "title": "Progressive Overload",
    "unit": "workouts-1",
    "topic": "Training Fundamentals",
    "course": "master",
    "week": 4,
    "required": false
  },
  {
    "id": "workouts-1-3",
    "title": "Specificity: Train for Your Goal",
    "unit": "workouts-1",
    "topic": "Training Fundamentals",
    "course": "master",
    "week": 4,
    "required": false
  },
  {
    "id": "workouts-1-4",
    "title": "Recovery: The Hidden Half of Training",
    "unit": "workouts-1",
    "topic": "Training Fundamentals",
    "course": "master",
    "week": 5,
    "required": false
  },
  {
    "id": "workouts-1-5",
    "title": "Periodization: Training in Phases",
    "unit": "workouts-1",
    "topic": "Training Fundamentals",
    "course": "specialist",
    "required": false
  },
  {
    "id": "workouts-2-1",
    "title": "Neural Adaptations to Strength Training",
    "unit": "workouts-2",
    "topic": "Strength Training",
    "course": "specialist",
    "required": false
  },
  {
    "id": "workouts-2-2",
    "title": "Force Production Fundamentals",
    "unit": "workouts-2",
    "topic": "Strength Training",
    "course": "specialist",
    "required": false
  },
  {
    "id": "workouts-2-3",
    "title": "Strength Training Variables",
    "unit": "workouts-2",
    "topic": "Strength Training",
    "course": "master",
    "week": 4,
    "required": false
  },
  {
    "id": "workouts-2-4",
    "title": "Programming for Strength",
    "unit": "workouts-2",
    "topic": "Strength Training",
    "course": "master",
    "week": 5,
    "required": false
  },
  {
    "id": "workouts-2-5",
    "title": "Building Your Strength Foundation",
    "unit": "workouts-2",
    "topic": "Strength Training",
    "course": "master",
    "week": 5,
    "required": false
  },
  {
    "id": "workouts-3-1",
    "title": "The Science of Muscle Growth",
    "unit": "workouts-3",
    "topic": "Hypertrophy Training",
    "course": "specialist",
    "required": false
  },
  {
    "id": "workouts-3-2",
    "title": "Volume: The Key Driver",
    "unit": "workouts-3",
    "topic": "Hypertrophy Training",
    "course": "specialist",
    "required": false
  },
  {
    "id": "workouts-3-3",
    "title": "Rep Ranges and Time Under Tension",
    "unit": "workouts-3",
    "topic": "Hypertrophy Training",
    "course": "specialist",
    "required": false
  },
  {
    "id": "workouts-3-4",
    "title": "Exercise Selection for Growth",
    "unit": "workouts-3",
    "topic": "Hypertrophy Training",
    "course": "master",
    "week": 5,
    "required": false
  },
  {
    "id": "workouts-3-5",
    "title": "Building a Hypertrophy Program",
    "unit": "workouts-3",
    "topic": "Hypertrophy Training",
    "course": "master",
    "week": 5,
    "required": false
  },
  {
    "id": "workouts-4-1",
    "title": "Energy Systems: Your Body's Fuel Pathways",
    "unit": "workouts-4",
    "topic": "Cardiovascular Training",
    "course": "specialist",
    "required": false
  },
  {
    "id": "workouts-4-2",
    "title": "Heart Rate Zones",
    "unit": "workouts-4",
    "topic": "Cardiovascular Training",
    "course": "master",
    "week": 6,
    "required": false
  },
  {
    "id": "workouts-4-3",
    "title": "Aerobic vs Anaerobic Training",
    "unit": "workouts-4",
    "topic": "Cardiovascular Training",
    "course": "specialist",
    "required": false
  },
  {
    "id": "workouts-4-4",
    "title": "Types of Cardio Training",
    "unit": "workouts-4",
    "topic": "Cardiovascular Training",
    "course": "specialist",
    "required": false
  },
  {
    "id": "workouts-4-5",
    "title": "Building Your Cardio Program",
    "unit": "workouts-4",
    "topic": "Cardiovascular Training",
    "course": "master",
    "week": 6,
    "required": false
  },
  {
    "id": "workouts-5-1",
    "title": "Power and Explosiveness",
    "unit": "workouts-5",
    "topic": "Advanced Modalities",
    "course": "specialist",
    "required": false
  },
  {
    "id": "workouts-5-2",
    "title": "HIIT Deep Dive",
    "unit": "workouts-5",
    "topic": "Advanced Modalities",
    "course": "specialist",
    "required": false
  },
  {
    "id": "workouts-5-3",
    "title": "Flexibility and Mobility",
    "unit": "workouts-5",
    "topic": "Advanced Modalities",
    "course": "master",
    "week": 6,
    "required": false
  },
  {
    "id": "workouts-5-4",
    "title": "Concurrent Training: Balancing Multiple Goals",
    "unit": "workouts-5",
    "topic": "Advanced Modalities",
    "course": "specialist",
    "required": false
  },
  {
    "id": "workouts-5-5",
    "title": "Putting It All Together",
    "unit": "workouts-5",
    "topic": "Advanced Modalities",
    "course": "specialist",
    "required": false
  },
  {
    "id": "hormones-1-1",
    "title": "The Chemical Messenger System",
    "unit": "hormones-1",
    "topic": "The Chemical Messenger System",
    "course": "specialist",
    "required": false
  },
  {
    "id": "hormones-2-1",
    "title": "Energy Mobilizers",
    "unit": "hormones-2",
    "topic": "Energy Mobilizers",
    "course": "specialist",
    "required": false
  },
  {
    "id": "hormones-3-1",
    "title": "The Anabolic Messengers",
    "unit": "hormones-3",
    "topic": "The Anabolic Messengers",
    "course": "specialist",
    "required": false
  },
  {
    "id": "hormones-4-1",
    "title": "Metabolic Regulators",
    "unit": "hormones-4",
    "topic": "Metabolic Regulators",
    "course": "specialist",
    "required": false
  },
  {
    "id": "hormones-5-1",
    "title": "Sex Hormones in Context",
    "unit": "hormones-5",
    "topic": "Sex Hormones in Context",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-1-1",
    "title": "Meet Your Glutes: 3 Muscles, 1 System",
    "unit": "growth-1",
    "topic": "Glute Growth",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-1-2",
    "title": "Why Hip Thrusts Outgrow Squats for Glutes",
    "unit": "growth-1",
    "topic": "Glute Growth",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-1-3",
    "title": "Horizontal vs Vertical Loading",
    "unit": "growth-1",
    "topic": "Glute Growth",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-1-4",
    "title": "Glute Med: The Side-Glute Secret",
    "unit": "growth-1",
    "topic": "Glute Growth",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-1-5",
    "title": "Programming Glutes: Frequency, Volume, Mistakes",
    "unit": "growth-1",
    "topic": "Glute Growth",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-2-1",
    "title": "Pec Anatomy: Three Heads, Not One",
    "unit": "growth-2",
    "topic": "Chest Growth",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-2-2",
    "title": "The Incline Angle Sweet Spot",
    "unit": "growth-2",
    "topic": "Chest Growth",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-2-3",
    "title": "Lengthened-Position Pressing",
    "unit": "growth-2",
    "topic": "Chest Growth",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-2-4",
    "title": "Flies vs Presses: Adduction Matters",
    "unit": "growth-2",
    "topic": "Chest Growth",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-2-5",
    "title": "Chest Programming & Common Mistakes",
    "unit": "growth-2",
    "topic": "Chest Growth",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-3-1",
    "title": "Back Anatomy: Lats, Traps, Rhomboids, Rear Delts",
    "unit": "growth-3",
    "topic": "Back & Lat Width",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-3-2",
    "title": "Pulldowns vs Pull-ups: Mechanics Differ",
    "unit": "growth-3",
    "topic": "Back & Lat Width",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-3-3",
    "title": "Width vs Thickness: Different Angles",
    "unit": "growth-3",
    "topic": "Back & Lat Width",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-3-4",
    "title": "Lengthened Lat Work",
    "unit": "growth-3",
    "topic": "Back & Lat Width",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-3-5",
    "title": "Programming Back: Why It's Hard to Feel",
    "unit": "growth-3",
    "topic": "Back & Lat Width",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-4-1",
    "title": "Three Delt Heads: Front, Side, Rear",
    "unit": "growth-4",
    "topic": "Shoulder Growth",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-4-2",
    "title": "Lateral Raise Mechanics",
    "unit": "growth-4",
    "topic": "Shoulder Growth",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-4-3",
    "title": "Rear Delts: Most Underdeveloped",
    "unit": "growth-4",
    "topic": "Shoulder Growth",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-4-4",
    "title": "Overhead Press: Compound King",
    "unit": "growth-4",
    "topic": "Shoulder Growth",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-4-5",
    "title": "Shoulder Programming & Injury Prevention",
    "unit": "growth-4",
    "topic": "Shoulder Growth",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-5-1",
    "title": "Bicep Anatomy: Two Heads + Brachialis",
    "unit": "growth-5",
    "topic": "Biceps & Brachialis",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-5-2",
    "title": "Long vs Short Head: How to Bias Each",
    "unit": "growth-5",
    "topic": "Biceps & Brachialis",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-5-3",
    "title": "Brachialis: The Hidden Arm Mass",
    "unit": "growth-5",
    "topic": "Biceps & Brachialis",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-5-4",
    "title": "Supination Matters",
    "unit": "growth-5",
    "topic": "Biceps & Brachialis",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-5-5",
    "title": "Bicep Programming & Stretch Hypertrophy",
    "unit": "growth-5",
    "topic": "Biceps & Brachialis",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-6-1",
    "title": "Triceps Anatomy: Three Heads",
    "unit": "growth-6",
    "topic": "Triceps Growth",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-6-2",
    "title": "Why Overhead Tricep Extensions Win",
    "unit": "growth-6",
    "topic": "Triceps Growth",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-6-3",
    "title": "Pushdowns vs Skullcrushers: Different Stimulus",
    "unit": "growth-6",
    "topic": "Triceps Growth",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-6-4",
    "title": "The Stretch-Mediated Tricep Bias",
    "unit": "growth-6",
    "topic": "Triceps Growth",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-6-5",
    "title": "Tricep Programming: Most of Your Arm",
    "unit": "growth-6",
    "topic": "Triceps Growth",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-7-1",
    "title": "Quad Anatomy: Four Heads",
    "unit": "growth-7",
    "topic": "Quads & Hamstrings",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-7-2",
    "title": "Depth & ROM: The Hypertrophy Difference",
    "unit": "growth-7",
    "topic": "Quads & Hamstrings",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-7-3",
    "title": "Rectus Femoris Bias: Sissy Squats & Hip-Extended Work",
    "unit": "growth-7",
    "topic": "Quads & Hamstrings",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-7-4",
    "title": "Hamstrings: Three Muscles, Two Functions",
    "unit": "growth-7",
    "topic": "Quads & Hamstrings",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-7-5",
    "title": "RDL vs Leg Curl: Hip vs Knee Dominant",
    "unit": "growth-7",
    "topic": "Quads & Hamstrings",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-8-1",
    "title": "Calf Anatomy: Gastroc vs Soleus",
    "unit": "growth-8",
    "topic": "Calves, Core & Forearms",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-8-2",
    "title": "Why Calves Are Hard to Grow",
    "unit": "growth-8",
    "topic": "Calves, Core & Forearms",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-8-3",
    "title": "Can You Actually Grow Abs? (Yes — Here's How)",
    "unit": "growth-8",
    "topic": "Calves, Core & Forearms",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-8-4",
    "title": "Oblique & Core Anti-Rotation",
    "unit": "growth-8",
    "topic": "Calves, Core & Forearms",
    "course": "specialist",
    "required": false
  },
  {
    "id": "growth-8-5",
    "title": "Forearm & Grip: Often Limiting",
    "unit": "growth-8",
    "topic": "Calves, Core & Forearms",
    "course": "specialist",
    "required": false
  }
];
window.BalanceCurriculum={lessons,forCourse:(course,week)=>lessons.filter(l=>l.course===course&&(!week||l.week===week)),owner:id=>lessons.find(l=>l.id===id)};
})();
