// Workout Library Database
// Organized by: Category > Subcategory > Individual Workouts

const WORKOUT_LIBRARY = {
  // ====================
  // FULL GYM ACCESS
  // ====================
  "gym": {
    name: "Full Gym Access",
    icon: "💪",
    description: "Complete workout library for gym equipment",
    subcategories: {

      // BACK DAY WORKOUTS
      "back": {
        name: "Back Day",
        description: "Build a strong, wide back",
        workouts: [
          {
            id: "gym-back-1",
            name: "Back 1",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Cable", "Dumbbells"],
            exercises: [
              { name: "Barbell Romanian Deadlift", sets: 4, reps: "8-10", desc: "Posterior chain compound" },
              { name: "Wide Grip Pull Up", sets: 4, reps: "8-10", desc: "Lat width" },
              { name: "Cable Seated Rotational Row", sets: 4, reps: "10-12", desc: "Mid-back thickness" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "12-15", desc: "Rear delts and upper back" },
              { name: "Dumbbell Shrug", sets: 4, reps: "12-15", desc: "Trap isolation" }
            ]
          },
          {
            id: "gym-back-2",
            name: "Back 2",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Cable", "Machine"],
            exercises: [
              { name: "Barbell Bent Over Row", sets: 4, reps: "8-10", desc: "Compound back builder" },
              { name: "Lat Machine Wide Bar Close Grip Pulldown", sets: 4, reps: "10-12", desc: "Lat focus" },
              { name: "Cable Single Arm Row", sets: 4, reps: "10-12 each", desc: "Unilateral rows" },
              { name: "Cable Single Arm Reverse Fly", sets: 4, reps: "12-15 each", desc: "Rear delt isolation" },
              { name: "Cable Shrug", sets: 4, reps: "12-15", desc: "Trap work" }
            ]
          },
          {
            id: "gym-back-3",
            name: "Back 3",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Cable", "Pull-up Bar"],
            exercises: [
              { name: "Barbell Romanian Deadlift", sets: 4, reps: "6-8", desc: "Heavy posterior chain" },
              { name: "Wide Grip Pull Up", sets: 4, reps: "6-8", desc: "Weighted or bodyweight" },
              { name: "Landmine T-Bar Close Grip Row", sets: 4, reps: "8-10", desc: "Back thickness" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "12-15", desc: "Upper back and rear delts" },
              { name: "Barbell Shrug", sets: 4, reps: "10-12", desc: "Heavy trap work" }
            ]
          },
          {
            id: "gym-back-4",
            name: "Back 4",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells", "Cable", "Machine"],
            exercises: [
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "10-12", desc: "Hamstrings and back" },
              { name: "Machine Assisted Wide Grip Pull Up", sets: 4, reps: "10-12", desc: "Lat development" },
              { name: "Lat Machine Parallel Grip Row", sets: 4, reps: "10-12", desc: "Mid-back focus" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "12-15", desc: "Rear delt work" },
              { name: "Dumbbell Shrug", sets: 4, reps: "12-15", desc: "Trap finisher" }
            ]
          },
          {
            id: "gym-back-5",
            name: "Back 5",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Cable", "Machine", "Dumbbells"],
            exercises: [
              { name: "Cable Seated Rotational Row", sets: 4, reps: "10-12", desc: "Controlled rows" },
              { name: "Lat Machine Wide Bar Close Grip Pulldown", sets: 4, reps: "10-12", desc: "Lat stretch" },
              { name: "Machine Seated Row", sets: 4, reps: "10-12", desc: "Supported rowing" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "12-15", desc: "Upper back" },
              { name: "Dumbbell Shrug", sets: 4, reps: "12-15", desc: "Trap isolation" }
            ]
          },
          {
            id: "gym-back-6",
            name: "Back 6",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Bent Over Row", sets: 4, reps: "6-8", desc: "Heavy compound" },
              { name: "Chin Up", sets: 4, reps: "6-8", desc: "Bicep-assisted pull" },
              { name: "Dumbbell Single Arm Bent Over Row", sets: 4, reps: "8-10 each", desc: "Unilateral strength" },
              { name: "Cable Single Arm Reverse Fly", sets: 4, reps: "12-15 each", desc: "Rear delt focus" },
              { name: "Barbell Shrug", sets: 4, reps: "8-10", desc: "Heavy traps" }
            ]
          },
          {
            id: "gym-back-7",
            name: "Back 7",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Cable", "Machine", "Dumbbells"],
            exercises: [
              { name: "Cable Seated Rotational Row", sets: 4, reps: "10-12", desc: "Back thickness" },
              { name: "Lat Machine Wide Bar Close Grip Pulldown", sets: 4, reps: "10-12", desc: "Wide lats" },
              { name: "Dumbbell Incline Row", sets: 4, reps: "10-12", desc: "Chest-supported row" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "12-15", desc: "Rear delts" },
              { name: "Cable Shrug", sets: 4, reps: "12-15", desc: "Constant tension traps" }
            ]
          },
          {
            id: "gym-back-8",
            name: "Back 8",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "T-Bar", "Cable"],
            exercises: [
              { name: "Barbell Romanian Deadlift", sets: 4, reps: "6-8", desc: "Posterior chain strength" },
              { name: "Landmine T-Bar Close Grip Row", sets: 4, reps: "8-10", desc: "Thick back" },
              { name: "Cable Seated Rotational Row", sets: 4, reps: "10-12", desc: "Mid-back squeeze" },
              { name: "Cable Single Arm Reverse Fly", sets: 4, reps: "12-15 each", desc: "Rear delt isolation" },
              { name: "Barbell Shrug", sets: 4, reps: "8-10", desc: "Trap strength" }
            ]
          },
          {
            id: "gym-back-9",
            name: "Back 9",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells", "Cable", "Pull-up Bar"],
            exercises: [
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "10-12", desc: "Posterior chain" },
              { name: "Wide Grip Pull Up", sets: 4, reps: "8-10", desc: "Lat width builder" },
              { name: "Cable Single Arm Row", sets: 4, reps: "10-12 each", desc: "Unilateral focus" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "12-15", desc: "Rear delts" },
              { name: "Dumbbell Shrug", sets: 4, reps: "12-15", desc: "Trap pump" }
            ]
          },
          {
            id: "gym-back-10",
            name: "Back 10",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Machine", "Cable", "Dumbbells"],
            exercises: [
              { name: "Machine Seated Row", sets: 4, reps: "10-12", desc: "Supported compound" },
              { name: "Machine Assisted Wide Grip Pull Up", sets: 4, reps: "10-12", desc: "Assisted lat work" },
              { name: "Lat Machine Parallel Grip Row", sets: 4, reps: "10-12", desc: "Back thickness" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "12-15", desc: "Upper back health" },
              { name: "Dumbbell Shrug", sets: 4, reps: "12-15", desc: "Trap isolation" }
            ]
          },
          {
            id: "gym-back-11",
            name: "Back 11",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Cable", "Dumbbells"],
            exercises: [
              { name: "Barbell Bent Over Row", sets: 4, reps: "8-10", desc: "Classic compound" },
              { name: "Lat Machine Wide Bar Close Grip Pulldown", sets: 4, reps: "10-12", desc: "Lat focus" },
              { name: "Dumbbell Single Arm Bent Over Row", sets: 4, reps: "10-12 each", desc: "Single arm strength" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "12-15", desc: "Rear delt and traps" },
              { name: "Cable Shrug", sets: 4, reps: "12-15", desc: "Trap finisher" }
            ]
          },
          {
            id: "gym-back-12",
            name: "Back 12",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Pull-up Bar", "Cable"],
            exercises: [
              { name: "Barbell Romanian Deadlift", sets: 4, reps: "6-8", desc: "Heavy hip hinge" },
              { name: "Chin Up", sets: 4, reps: "6-8", desc: "Weighted chins" },
              { name: "Cable Seated Rotational Row", sets: 4, reps: "8-10", desc: "Controlled rows" },
              { name: "Cable Single Arm Reverse Fly", sets: 4, reps: "12-15 each", desc: "Rear delt work" },
              { name: "Barbell Shrug", sets: 4, reps: "8-10", desc: "Heavy trap shrugs" }
            ]
          },
          {
            id: "gym-back-13",
            name: "Back 13",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells", "Machine", "Cable"],
            exercises: [
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "10-12", desc: "Posterior chain work" },
              { name: "Machine Assisted Wide Grip Pull Up", sets: 4, reps: "10-12", desc: "Lat builder" },
              { name: "Machine Seated Row", sets: 4, reps: "10-12", desc: "Back thickness" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "12-15", desc: "Upper back" },
              { name: "Dumbbell Shrug", sets: 4, reps: "12-15", desc: "Trap isolation" }
            ]
          },
          {
            id: "gym-back-14",
            name: "Back 14",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Cable", "Machine", "Dumbbells"],
            exercises: [
              { name: "Lat Machine Parallel Grip Row", sets: 4, reps: "10-12", desc: "Neutral grip rows" },
              { name: "Lat Machine Wide Bar Close Grip Pulldown", sets: 4, reps: "10-12", desc: "Lat stretch" },
              { name: "Cable Seated Rotational Row", sets: 4, reps: "10-12", desc: "Mid-back" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "12-15", desc: "Rear delts" },
              { name: "Dumbbell Shrug", sets: 4, reps: "12-15", desc: "Trap work" }
            ]
          },
          {
            id: "gym-back-15",
            name: "Back 15",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Bent Over Row", sets: 4, reps: "6-8", desc: "Power rows" },
              { name: "Wide Grip Pull Up", sets: 4, reps: "6-8", desc: "Strict form" },
              { name: "Dumbbell Single Arm Bent Over Row", sets: 4, reps: "8-10 each", desc: "Heavy unilateral" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "12-15", desc: "Rear delt and traps" },
              { name: "Barbell Shrug", sets: 4, reps: "8-10", desc: "Trap strength" }
            ]
          }
        ]
      },

      // LEG DAY WORKOUTS
      "legs": {
        name: "Leg Day",
        description: "Complete lower body development",
        workouts: [
          {
            id: "gym-legs-1",
            name: "Legs 1",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Machine", "Dumbbells"],
            exercises: [
              { name: "Barbell Back Squat", sets: 4, reps: "8-10", desc: "Quad and glute compound" },
              { name: "Barbell Romanian Deadlift", sets: 4, reps: "10-12", desc: "Hamstring focus" },
              { name: "Dumbbell Walking Lunge", sets: 4, reps: "10-12 each", desc: "Unilateral legs" },
              { name: "Machine Seated Leg Curl", sets: 4, reps: "12-15", desc: "Hamstring isolation" },
              { name: "Smith Machine Calf Raise", sets: 4, reps: "15-20", desc: "Calf development" }
            ]
          },
          {
            id: "gym-legs-2",
            name: "Legs 2",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Machine"],
            exercises: [
              { name: "Barbell Front Squat", sets: 4, reps: "8-10", desc: "Quad dominant squat" },
              { name: "Barbell Hip Thrust", sets: 4, reps: "10-12", desc: "Glute builder" },
              { name: "Seated Leg Press", sets: 4, reps: "10-12", desc: "Leg compound" },
              { name: "Machine Single Leg Extension", sets: 4, reps: "12-15 each", desc: "Quad isolation" },
              { name: "Machine Seated Single Leg Calf Raise", sets: 4, reps: "15-20 each", desc: "Calf work" }
            ]
          },
          {
            id: "gym-legs-3",
            name: "Legs 3",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Machine", "Dumbbells"],
            exercises: [
              { name: "Barbell Back Squat", sets: 4, reps: "6-8", desc: "Heavy squats" },
              { name: "Barbell Romanian Deadlift", sets: 4, reps: "8-10", desc: "Posterior chain" },
              { name: "Dumbbell Bulgarian Split Squat", sets: 4, reps: "8-10 each", desc: "Unilateral strength" },
              { name: "Machine Seated Leg Curl", sets: 4, reps: "10-12", desc: "Hamstring curl" },
              { name: "Smith Machine Calf Raise", sets: 4, reps: "12-15", desc: "Heavy calves" }
            ]
          },
          {
            id: "gym-legs-4",
            name: "Legs 4",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Machine", "Dumbbells"],
            exercises: [
              { name: "Seated Leg Press", sets: 4, reps: "10-12", desc: "Supported compound" },
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "10-12", desc: "Hamstring stretch" },
              { name: "Dumbbell Walking Lunge", sets: 4, reps: "10-12 each", desc: "Walking lunges" },
              { name: "Machine Single Leg Extension", sets: 4, reps: "12-15 each", desc: "Quad isolation" },
              { name: "Machine Seated Single Leg Calf Raise", sets: 4, reps: "15-20 each", desc: "Calf isolation" }
            ]
          },
          {
            id: "gym-legs-5",
            name: "Legs 5",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Cable", "Machine"],
            exercises: [
              { name: "Barbell Back Squat", sets: 4, reps: "10-12", desc: "Volume squats" },
              { name: "Cable Pull Through", sets: 4, reps: "12-15", desc: "Glute and hamstring" },
              { name: "Machine Sumo Leg Press", sets: 4, reps: "10-12", desc: "Wide stance press" },
              { name: "Machine Seated Leg Curl", sets: 4, reps: "12-15", desc: "Hamstring work" },
              { name: "Smith Machine Calf Raise", sets: 4, reps: "15-20", desc: "Calf finisher" }
            ]
          },
          {
            id: "gym-legs-6",
            name: "Legs 6",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Machine"],
            exercises: [
              { name: "Barbell Front Squat", sets: 4, reps: "6-8", desc: "Heavy front squats" },
              { name: "Barbell Hip Thrust", sets: 4, reps: "8-10", desc: "Heavy hip thrust" },
              { name: "Dumbbell Bulgarian Split Squat", sets: 4, reps: "8-10 each", desc: "Single leg strength" },
              { name: "Machine Single Leg Extension", sets: 4, reps: "10-12 each", desc: "Quad burnout" },
              { name: "Smith Machine Calf Raise", sets: 4, reps: "12-15", desc: "Calf strength" }
            ]
          },
          {
            id: "gym-legs-7",
            name: "Legs 7",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Machine", "Dumbbells"],
            exercises: [
              { name: "Barbell Back Squat", sets: 4, reps: "8-10", desc: "Classic squat" },
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "10-12", desc: "DB RDL" },
              { name: "Seated Leg Press", sets: 4, reps: "10-12", desc: "Leg press" },
              { name: "Machine Seated Leg Curl", sets: 4, reps: "12-15", desc: "Hamstring curl" },
              { name: "Machine Seated Single Leg Calf Raise", sets: 4, reps: "15-20 each", desc: "Seated calf" }
            ]
          },
          {
            id: "gym-legs-8",
            name: "Legs 8",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Dumbbells", "Machine"],
            exercises: [
              { name: "Barbell Hip Thrust", sets: 4, reps: "10-12", desc: "Glute focus" },
              { name: "Barbell Romanian Deadlift", sets: 4, reps: "10-12", desc: "Hamstring stretch" },
              { name: "Dumbbell Walking Lunge", sets: 4, reps: "10-12 each", desc: "Lunge pattern" },
              { name: "Machine Single Leg Extension", sets: 4, reps: "12-15 each", desc: "Quad isolation" },
              { name: "Smith Machine Calf Raise", sets: 4, reps: "15-20", desc: "Calf work" }
            ]
          },
          {
            id: "gym-legs-9",
            name: "Legs 9",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Machine"],
            exercises: [
              { name: "Barbell Back Squat", sets: 4, reps: "6-8", desc: "Strength squats" },
              { name: "Barbell Front Squat", sets: 4, reps: "8-10", desc: "Front squat" },
              { name: "Machine Sumo Leg Press", sets: 4, reps: "8-10", desc: "Heavy press" },
              { name: "Machine Seated Leg Curl", sets: 4, reps: "10-12", desc: "Hamstring work" },
              { name: "Smith Machine Calf Raise", sets: 4, reps: "12-15", desc: "Calf strength" }
            ]
          },
          {
            id: "gym-legs-10",
            name: "Legs 10",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Machine", "Dumbbells"],
            exercises: [
              { name: "Seated Leg Press", sets: 4, reps: "10-12", desc: "Machine compound" },
              { name: "Dumbbell Goblet Squat", sets: 4, reps: "10-12", desc: "Goblet squat" },
              { name: "Dumbbell Walking Lunge", sets: 4, reps: "10-12 each", desc: "Lunges" },
              { name: "Machine Seated Leg Curl", sets: 4, reps: "12-15", desc: "Hamstring curl" },
              { name: "Machine Seated Single Leg Calf Raise", sets: 4, reps: "15-20 each", desc: "Calf raises" }
            ]
          },
          {
            id: "gym-legs-11",
            name: "Legs 11",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Dumbbells", "Machine"],
            exercises: [
              { name: "Barbell Front Squat", sets: 4, reps: "8-10", desc: "Quad focus squat" },
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "10-12", desc: "Hamstring RDL" },
              { name: "Dumbbell Bulgarian Split Squat", sets: 4, reps: "10-12 each", desc: "Split squat" },
              { name: "Machine Single Leg Extension", sets: 4, reps: "12-15 each", desc: "Quad isolation" },
              { name: "Smith Machine Calf Raise", sets: 4, reps: "15-20", desc: "Standing calf" }
            ]
          },
          {
            id: "gym-legs-12",
            name: "Legs 12",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Machine", "Cable"],
            exercises: [
              { name: "Barbell Back Squat", sets: 4, reps: "6-8", desc: "Heavy back squat" },
              { name: "Barbell Hip Thrust", sets: 4, reps: "8-10", desc: "Glute power" },
              { name: "Cable Pull Through", sets: 4, reps: "10-12", desc: "Hip hinge" },
              { name: "Machine Seated Leg Curl", sets: 4, reps: "10-12", desc: "Hamstring isolation" },
              { name: "Smith Machine Calf Raise", sets: 4, reps: "12-15", desc: "Calf development" }
            ]
          },
          {
            id: "gym-legs-13",
            name: "Legs 13",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Dumbbells", "Machine"],
            exercises: [
              { name: "Barbell Romanian Deadlift", sets: 4, reps: "8-10", desc: "RDL compound" },
              { name: "Barbell Back Squat", sets: 4, reps: "10-12", desc: "Back squat" },
              { name: "Dumbbell Walking Lunge", sets: 4, reps: "10-12 each", desc: "Walking lunge" },
              { name: "Machine Single Leg Extension", sets: 4, reps: "12-15 each", desc: "Quad work" },
              { name: "Machine Seated Single Leg Calf Raise", sets: 4, reps: "15-20 each", desc: "Seated calf" }
            ]
          },
          {
            id: "gym-legs-14",
            name: "Legs 14",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells", "Machine"],
            exercises: [
              { name: "Dumbbell Goblet Squat", sets: 4, reps: "10-12", desc: "Beginner squat" },
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "10-12", desc: "RDL pattern" },
              { name: "Seated Leg Press", sets: 4, reps: "10-12", desc: "Leg press" },
              { name: "Machine Seated Leg Curl", sets: 4, reps: "12-15", desc: "Hamstring curl" },
              { name: "Machine Seated Single Leg Calf Raise", sets: 4, reps: "15-20 each", desc: "Calf isolation" }
            ]
          },
          {
            id: "gym-legs-15",
            name: "Legs 15",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Machine"],
            exercises: [
              { name: "Barbell Front Squat", sets: 4, reps: "6-8", desc: "Heavy front squat" },
              { name: "Barbell Romanian Deadlift", sets: 4, reps: "6-8", desc: "Heavy RDL" },
              { name: "Dumbbell Bulgarian Split Squat", sets: 4, reps: "8-10 each", desc: "Heavy split squat" },
              { name: "Machine Seated Leg Curl", sets: 4, reps: "10-12", desc: "Hamstring isolation" },
              { name: "Smith Machine Calf Raise", sets: 4, reps: "12-15", desc: "Calf strength" }
            ]
          }
        ]
      },

      // CHEST DAY WORKOUTS
      "chest": {
        name: "Chest Day",
        description: "Build a powerful chest",
        workouts: [
          {
            id: "gym-chest-1",
            name: "Chest 1",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Bench Press", sets: 4, reps: "8-10", desc: "Flat bench compound" },
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "10-12", desc: "Upper chest" },
              { name: "Dumbbell Flat Bench Fly", sets: 4, reps: "12-15", desc: "Chest stretch" },
              { name: "Cable Standing High To Low Fly", sets: 4, reps: "12-15", desc: "Lower chest" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "12-15", desc: "Tricep finisher" }
            ]
          },
          {
            id: "gym-chest-2",
            name: "Chest 2",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells", "Cable", "Machine"],
            exercises: [
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "8-10", desc: "DB press" },
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "10-12", desc: "Incline press" },
              { name: "Cable Standing High To Low Fly", sets: 4, reps: "12-15", desc: "Cable fly" },
              { name: "Machine Seated Parallel Grip Chest Press", sets: 4, reps: "12-15", desc: "Machine press" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "12-15", desc: "Tricep work" }
            ]
          },
          {
            id: "gym-chest-3",
            name: "Chest 3",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Bench Press", sets: 4, reps: "6-8", desc: "Heavy bench" },
              { name: "Barbell Incline Bench Press", sets: 4, reps: "8-10", desc: "Incline strength" },
              { name: "Dumbbell Flat Bench Fly", sets: 4, reps: "10-12", desc: "Chest isolation" },
              { name: "Cable Low to High Fly", sets: 4, reps: "12-15", desc: "Upper chest cable" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "10-12", desc: "Tricep strength" }
            ]
          },
          {
            id: "gym-chest-4",
            name: "Chest 4",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells", "Machine", "Cable"],
            exercises: [
              { name: "Machine Seated Parallel Grip Chest Press", sets: 4, reps: "10-12", desc: "Supported press" },
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "10-12", desc: "Incline DB" },
              { name: "Dumbbell Flat Bench Fly", sets: 4, reps: "12-15", desc: "Fly movement" },
              { name: "Cable Standing High To Low Fly", sets: 4, reps: "12-15", desc: "Cable work" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "12-15", desc: "Tricep isolation" }
            ]
          },
          {
            id: "gym-chest-5",
            name: "Chest 5",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Incline Bench Press", sets: 4, reps: "8-10", desc: "Incline barbell" },
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "10-12", desc: "Flat DB press" },
              { name: "Cable Low to High Fly", sets: 4, reps: "12-15", desc: "Low to high" },
              { name: "Dumbbell Incline Bench Fly", sets: 4, reps: "12-15", desc: "Incline fly" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "12-15", desc: "Tricep pump" }
            ]
          },
          {
            id: "gym-chest-6",
            name: "Chest 6",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Bench Press", sets: 4, reps: "6-8", desc: "Power pressing" },
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "8-10", desc: "Upper chest" },
              { name: "Dumbbell Flat Bench Fly", sets: 4, reps: "10-12", desc: "Stretch and squeeze" },
              { name: "Cable Standing High To Low Fly", sets: 4, reps: "10-12", desc: "Lower chest cable" },
              { name: "Dumbbell Skull Crusher", sets: 4, reps: "10-12", desc: "Tricep isolation" }
            ]
          },
          {
            id: "gym-chest-7",
            name: "Chest 7",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells", "Cable", "Machine"],
            exercises: [
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "10-12", desc: "Incline focus" },
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "10-12", desc: "Flat press" },
              { name: "Cable Standing High To Low Fly", sets: 4, reps: "12-15", desc: "High to low" },
              { name: "Machine Seated Parallel Grip Chest Press", sets: 4, reps: "12-15", desc: "Machine finisher" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "12-15", desc: "Tricep work" }
            ]
          },
          {
            id: "gym-chest-8",
            name: "Chest 8",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Bench Press", sets: 4, reps: "8-10", desc: "Bench strength" },
              { name: "Dumbbell Incline Bench Fly", sets: 4, reps: "10-12", desc: "Incline fly" },
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "10-12", desc: "DB flat press" },
              { name: "Cable Low to High Fly", sets: 4, reps: "12-15", desc: "Upper chest" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "12-15", desc: "Tricep finisher" }
            ]
          },
          {
            id: "gym-chest-9",
            name: "Chest 9",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Incline Bench Press", sets: 4, reps: "6-8", desc: "Heavy incline" },
              { name: "Barbell Bench Press", sets: 4, reps: "8-10", desc: "Flat bench" },
              { name: "Dumbbell Flat Bench Fly", sets: 4, reps: "10-12", desc: "Chest stretch" },
              { name: "Cable Standing High To Low Fly", sets: 4, reps: "10-12", desc: "Lower chest" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "10-12", desc: "Tricep strength" }
            ]
          },
          {
            id: "gym-chest-10",
            name: "Chest 10",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells", "Machine", "Cable"],
            exercises: [
              { name: "Machine Seated Parallel Grip Chest Press", sets: 4, reps: "10-12", desc: "Machine press" },
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "10-12", desc: "DB press" },
              { name: "Dumbbell Incline Bench Fly", sets: 4, reps: "12-15", desc: "Incline fly" },
              { name: "Cable Standing High To Low Fly", sets: 4, reps: "12-15", desc: "Cable fly" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "12-15", desc: "Tricep work" }
            ]
          },
          {
            id: "gym-chest-11",
            name: "Chest 11",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Bench Press", sets: 4, reps: "8-10", desc: "Classic bench" },
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "10-12", desc: "Upper chest DB" },
              { name: "Cable Low to High Fly", sets: 4, reps: "12-15", desc: "Upper chest cable" },
              { name: "Dumbbell Flat Bench Fly", sets: 4, reps: "12-15", desc: "Flat fly" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "12-15", desc: "Tricep isolation" }
            ]
          },
          {
            id: "gym-chest-12",
            name: "Chest 12",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Bench Press", sets: 4, reps: "6-8", desc: "Strength bench" },
              { name: "Barbell Incline Bench Press", sets: 4, reps: "6-8", desc: "Heavy incline" },
              { name: "Dumbbell Flat Bench Fly", sets: 4, reps: "10-12", desc: "Fly stretch" },
              { name: "Cable Standing High To Low Fly", sets: 4, reps: "10-12", desc: "Cable isolation" },
              { name: "Dumbbell Skull Crusher", sets: 4, reps: "10-12", desc: "Tricep strength" }
            ]
          },
          {
            id: "gym-chest-13",
            name: "Chest 13",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells", "Cable", "Machine"],
            exercises: [
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "10-12", desc: "DB compound" },
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "10-12", desc: "Incline work" },
              { name: "Cable Standing High To Low Fly", sets: 4, reps: "12-15", desc: "High to low cable" },
              { name: "Dumbbell Flat Bench Fly", sets: 4, reps: "12-15", desc: "Chest stretch" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "12-15", desc: "Tricep pump" }
            ]
          },
          {
            id: "gym-chest-14",
            name: "Chest 14",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells", "Machine", "Cable"],
            exercises: [
              { name: "Machine Seated Parallel Grip Chest Press", sets: 4, reps: "10-12", desc: "Beginner press" },
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "10-12", desc: "Incline DB press" },
              { name: "Dumbbell Flat Bench Fly", sets: 4, reps: "12-15", desc: "Fly pattern" },
              { name: "Cable Low to High Fly", sets: 4, reps: "12-15", desc: "Low cable fly" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "12-15", desc: "Tricep finisher" }
            ]
          },
          {
            id: "gym-chest-15",
            name: "Chest 15",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Incline Bench Press", sets: 4, reps: "6-8", desc: "Power incline" },
              { name: "Barbell Bench Press", sets: 4, reps: "6-8", desc: "Power bench" },
              { name: "Dumbbell Incline Bench Fly", sets: 4, reps: "10-12", desc: "Incline stretch" },
              { name: "Cable Standing High To Low Fly", sets: 4, reps: "10-12", desc: "Lower chest work" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "10-12", desc: "Tricep strength" }
            ]
          }
        ]
      },

      // PUSH DAY WORKOUTS
      "push": {
        name: "Push Day",
        description: "Chest, shoulders, and triceps",
        workouts: [
          {
            id: "gym-push-1",
            name: "Push 1",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Bench Press", sets: 4, reps: "8-10", desc: "Chest compound" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Shoulder press" },
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "10-12", desc: "Upper chest" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", desc: "Side delts" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "12-15", desc: "Tricep isolation" }
            ]
          },
          {
            id: "gym-push-2",
            name: "Push 2",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells", "Cable", "Machine"],
            exercises: [
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "8-10", desc: "DB chest press" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Shoulder work" },
              { name: "Cable Standing High To Low Fly", sets: 4, reps: "12-15", desc: "Lower chest" },
              { name: "Cable Single Arm Lateral Raise", sets: 4, reps: "12-15 each", desc: "Side delt cable" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "12-15", desc: "Tricep finisher" }
            ]
          },
          {
            id: "gym-push-3",
            name: "Push 3",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Bench Press", sets: 4, reps: "6-8", desc: "Heavy bench" },
              { name: "Barbell Overhead Press", sets: 4, reps: "6-8", desc: "Heavy OHP" },
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "8-10", desc: "Incline strength" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "10-12", desc: "Side delts" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "10-12", desc: "Tricep strength" }
            ]
          },
          {
            id: "gym-push-4",
            name: "Push 4",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells", "Machine", "Cable"],
            exercises: [
              { name: "Machine Seated Parallel Grip Chest Press", sets: 4, reps: "10-12", desc: "Chest press" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Shoulder press" },
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "10-12", desc: "Incline work" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", desc: "Side delts" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "12-15", desc: "Tricep work" }
            ]
          },
          {
            id: "gym-push-5",
            name: "Push 5",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Incline Bench Press", sets: 4, reps: "8-10", desc: "Incline barbell" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "DB shoulder press" },
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "10-12", desc: "Flat DB press" },
              { name: "Dumbbell Front Raise", sets: 4, reps: "12-15", desc: "Front delts" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "12-15", desc: "Tricep isolation" }
            ]
          },
          {
            id: "gym-push-6",
            name: "Push 6",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Overhead Press", sets: 4, reps: "6-8", desc: "Shoulder strength" },
              { name: "Barbell Bench Press", sets: 4, reps: "6-8", desc: "Chest strength" },
              { name: "Dumbbell Incline Bench Fly", sets: 4, reps: "10-12", desc: "Upper chest stretch" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "10-12", desc: "Lateral work" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "10-12", desc: "Tricep finisher" }
            ]
          },
          {
            id: "gym-push-7",
            name: "Push 7",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells", "Cable", "Machine"],
            exercises: [
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "10-12", desc: "Chest compound" },
              { name: "Dumbbell Arnold Press", sets: 4, reps: "10-12", desc: "Arnold press" },
              { name: "Cable Standing High To Low Fly", sets: 4, reps: "12-15", desc: "Cable fly" },
              { name: "Cable Single Arm Lateral Raise", sets: 4, reps: "12-15 each", desc: "Side delt isolation" },
              { name: "Dumbbell Skull Crusher", sets: 4, reps: "12-15", desc: "Tricep work" }
            ]
          },
          {
            id: "gym-push-8",
            name: "Push 8",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Bench Press", sets: 4, reps: "8-10", desc: "Bench press" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Shoulder compound" },
              { name: "Dumbbell Incline Bench Fly", sets: 4, reps: "10-12", desc: "Incline fly" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", desc: "Side delts" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "12-15", desc: "Tricep pump" }
            ]
          },
          {
            id: "gym-push-9",
            name: "Push 9",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Bench Press", sets: 4, reps: "6-8", desc: "Power bench" },
              { name: "Barbell Overhead Press", sets: 4, reps: "8-10", desc: "OHP work" },
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "8-10", desc: "Incline DB" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "10-12", desc: "Side delt work" },
              { name: "Dumbbell Skull Crusher", sets: 4, reps: "10-12", desc: "Tricep strength" }
            ]
          },
          {
            id: "gym-push-10",
            name: "Push 10",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells", "Machine", "Cable"],
            exercises: [
              { name: "Machine Seated Parallel Grip Chest Press", sets: 4, reps: "10-12", desc: "Machine chest" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "DB shoulders" },
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "10-12", desc: "Flat press" },
              { name: "Dumbbell Front Raise", sets: 4, reps: "12-15", desc: "Front delts" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "12-15", desc: "Tricep isolation" }
            ]
          },
          {
            id: "gym-push-11",
            name: "Push 11",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Incline Bench Press", sets: 4, reps: "8-10", desc: "Incline strength" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Shoulder press" },
              { name: "Dumbbell Flat Bench Fly", sets: 4, reps: "10-12", desc: "Chest fly" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", desc: "Side delts" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "12-15", desc: "Tricep cable" }
            ]
          },
          {
            id: "gym-push-12",
            name: "Push 12",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Bench Press", sets: 4, reps: "6-8", desc: "Heavy pressing" },
              { name: "Barbell Overhead Press", sets: 4, reps: "6-8", desc: "Heavy OHP" },
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "8-10", desc: "Upper chest" },
              { name: "Cable Single Arm Lateral Raise", sets: 4, reps: "10-12 each", desc: "Side delt" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "10-12", desc: "Tricep work" }
            ]
          },
          {
            id: "gym-push-13",
            name: "Push 13",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells", "Cable", "Machine"],
            exercises: [
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "10-12", desc: "Incline focus" },
              { name: "Dumbbell Arnold Press", sets: 4, reps: "10-12", desc: "Arnold variation" },
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "10-12", desc: "Flat chest" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", desc: "Lateral raises" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "12-15", desc: "Tricep finisher" }
            ]
          },
          {
            id: "gym-push-14",
            name: "Push 14",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells", "Machine", "Cable"],
            exercises: [
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "10-12", desc: "DB bench" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Machine Seated Parallel Grip Chest Press", sets: 4, reps: "10-12", desc: "Machine chest" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", desc: "Side delts" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "12-15", desc: "Tricep work" }
            ]
          },
          {
            id: "gym-push-15",
            name: "Push 15",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Overhead Press", sets: 4, reps: "6-8", desc: "Strict press" },
              { name: "Barbell Bench Press", sets: 4, reps: "6-8", desc: "Bench strength" },
              { name: "Dumbbell Incline Bench Fly", sets: 4, reps: "10-12", desc: "Incline stretch" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "10-12", desc: "Side delt work" },
              { name: "Dumbbell Skull Crusher", sets: 4, reps: "10-12", desc: "Tricep strength" }
            ]
          }
        ]
      },

      // PULL DAY WORKOUTS
      "pull": {
        name: "Pull Day",
        description: "Back and biceps",
        workouts: [
          {
            id: "gym-pull-1",
            name: "Pull 1",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Cable", "Dumbbells"],
            exercises: [
              { name: "Barbell Romanian Deadlift", sets: 4, reps: "8-10", desc: "Posterior chain" },
              { name: "Wide Grip Pull Up", sets: 4, reps: "8-10", desc: "Lat width" },
              { name: "Cable Seated Rotational Row", sets: 4, reps: "10-12", desc: "Back thickness" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "12-15", desc: "Rear delts" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "12-15", desc: "Bicep isolation" }
            ]
          },
          {
            id: "gym-pull-2",
            name: "Pull 2",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells", "Cable", "Machine"],
            exercises: [
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "10-12", desc: "DB RDL" },
              { name: "Lat Machine Wide Bar Close Grip Pulldown", sets: 4, reps: "10-12", desc: "Lat pulldown" },
              { name: "Cable Single Arm Row", sets: 4, reps: "10-12 each", desc: "Unilateral row" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "12-15", desc: "Rear delts" },
              { name: "Dumbbell Hammer Curl", sets: 4, reps: "12-15", desc: "Bicep and forearm" }
            ]
          },
          {
            id: "gym-pull-3",
            name: "Pull 3",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "T-Bar", "Dumbbells"],
            exercises: [
              { name: "Barbell Romanian Deadlift", sets: 4, reps: "6-8", desc: "Heavy RDL" },
              { name: "Landmine T-Bar Close Grip Row", sets: 4, reps: "8-10", desc: "T-bar rows" },
              { name: "Wide Grip Pull Up", sets: 4, reps: "6-8", desc: "Weighted pull-ups" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "10-12", desc: "Upper back" },
              { name: "Barbell Curl", sets: 4, reps: "10-12", desc: "Bicep strength" }
            ]
          },
          {
            id: "gym-pull-4",
            name: "Pull 4",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Machine", "Cable", "Dumbbells"],
            exercises: [
              { name: "Machine Seated Row", sets: 4, reps: "10-12", desc: "Supported row" },
              { name: "Machine Assisted Wide Grip Pull Up", sets: 4, reps: "10-12", desc: "Assisted pull-up" },
              { name: "Lat Machine Parallel Grip Row", sets: 4, reps: "10-12", desc: "Cable row" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "12-15", desc: "Rear delts" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "12-15", desc: "Bicep work" }
            ]
          },
          {
            id: "gym-pull-5",
            name: "Pull 5",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Cable", "Dumbbells"],
            exercises: [
              { name: "Barbell Bent Over Row", sets: 4, reps: "8-10", desc: "Barbell rows" },
              { name: "Chin Up", sets: 4, reps: "8-10", desc: "Chin-ups" },
              { name: "Cable Seated Rotational Row", sets: 4, reps: "10-12", desc: "Cable rows" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "12-15", desc: "Rear delt fly" },
              { name: "Cable Single Arm Bicep Curl", sets: 4, reps: "12-15 each", desc: "Cable curl" }
            ]
          },
          {
            id: "gym-pull-6",
            name: "Pull 6",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Cable", "Pull-up Bar"],
            exercises: [
              { name: "Barbell Romanian Deadlift", sets: 4, reps: "6-8", desc: "Posterior chain" },
              { name: "Wide Grip Pull Up", sets: 4, reps: "6-8", desc: "Strict pull-ups" },
              { name: "Barbell Bent Over Row", sets: 4, reps: "8-10", desc: "Heavy rows" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "10-12", desc: "Face pulls" },
              { name: "Barbell Curl", sets: 4, reps: "10-12", desc: "Bicep curl" }
            ]
          },
          {
            id: "gym-pull-7",
            name: "Pull 7",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells", "Cable", "Machine"],
            exercises: [
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "10-12", desc: "RDL pattern" },
              { name: "Machine Assisted Wide Grip Pull Up", sets: 4, reps: "10-12", desc: "Lat work" },
              { name: "Dumbbell Single Arm Bent Over Row", sets: 4, reps: "10-12 each", desc: "DB rows" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "12-15", desc: "Rear delts" },
              { name: "Dumbbell Hammer Curl", sets: 4, reps: "12-15", desc: "Hammer curls" }
            ]
          },
          {
            id: "gym-pull-8",
            name: "Pull 8",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Cable", "Dumbbells"],
            exercises: [
              { name: "Barbell Bent Over Row", sets: 4, reps: "8-10", desc: "Row compound" },
              { name: "Lat Machine Wide Bar Close Grip Pulldown", sets: 4, reps: "10-12", desc: "Pulldown" },
              { name: "Cable Single Arm Row", sets: 4, reps: "10-12 each", desc: "Cable row" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "12-15", desc: "Rear delt work" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "12-15", desc: "Bicep isolation" }
            ]
          },
          {
            id: "gym-pull-9",
            name: "Pull 9",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Romanian Deadlift", sets: 4, reps: "6-8", desc: "Heavy deadlift" },
              { name: "Chin Up", sets: 4, reps: "6-8", desc: "Weighted chins" },
              { name: "Dumbbell Single Arm Bent Over Row", sets: 4, reps: "8-10 each", desc: "Heavy rows" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "10-12", desc: "Upper back" },
              { name: "Barbell Curl", sets: 4, reps: "10-12", desc: "Barbell curl" }
            ]
          },
          {
            id: "gym-pull-10",
            name: "Pull 10",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells", "Machine", "Cable"],
            exercises: [
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "10-12", desc: "Beginner RDL" },
              { name: "Lat Machine Wide Bar Close Grip Pulldown", sets: 4, reps: "10-12", desc: "Lat pulldown" },
              { name: "Machine Seated Row", sets: 4, reps: "10-12", desc: "Machine row" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "12-15", desc: "Face pull" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "12-15", desc: "DB curl" }
            ]
          },
          {
            id: "gym-pull-11",
            name: "Pull 11",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Cable", "Dumbbells"],
            exercises: [
              { name: "Barbell Bent Over Row", sets: 4, reps: "8-10", desc: "Barbell row" },
              { name: "Wide Grip Pull Up", sets: 4, reps: "8-10", desc: "Pull-ups" },
              { name: "Cable Seated Rotational Row", sets: 4, reps: "10-12", desc: "Rotational row" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "12-15", desc: "Rear delts" },
              { name: "Dumbbell Hammer Curl", sets: 4, reps: "12-15", desc: "Hammer curl" }
            ]
          },
          {
            id: "gym-pull-12",
            name: "Pull 12",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "T-Bar", "Cable"],
            exercises: [
              { name: "Barbell Romanian Deadlift", sets: 4, reps: "6-8", desc: "RDL strength" },
              { name: "Landmine T-Bar Close Grip Row", sets: 4, reps: "6-8", desc: "Heavy T-bar" },
              { name: "Chin Up", sets: 4, reps: "8-10", desc: "Chin-up" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "10-12", desc: "Face pull" },
              { name: "Cable Single Arm Bicep Curl", sets: 4, reps: "10-12 each", desc: "Cable curl" }
            ]
          },
          {
            id: "gym-pull-13",
            name: "Pull 13",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells", "Cable", "Machine"],
            exercises: [
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "10-12", desc: "DB RDL" },
              { name: "Lat Machine Parallel Grip Row", sets: 4, reps: "10-12", desc: "Parallel grip" },
              { name: "Dumbbell Single Arm Bent Over Row", sets: 4, reps: "10-12 each", desc: "Single arm row" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "12-15", desc: "Rear delt work" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "12-15", desc: "Bicep finisher" }
            ]
          },
          {
            id: "gym-pull-14",
            name: "Pull 14",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Machine", "Cable", "Dumbbells"],
            exercises: [
              { name: "Machine Seated Row", sets: 4, reps: "10-12", desc: "Row machine" },
              { name: "Lat Machine Wide Bar Close Grip Pulldown", sets: 4, reps: "10-12", desc: "Pulldown" },
              { name: "Cable Single Arm Row", sets: 4, reps: "10-12 each", desc: "Cable row" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "12-15", desc: "Rear delt fly" },
              { name: "Dumbbell Hammer Curl", sets: 4, reps: "12-15", desc: "Hammer curl" }
            ]
          },
          {
            id: "gym-pull-15",
            name: "Pull 15",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Bent Over Row", sets: 4, reps: "6-8", desc: "Power rows" },
              { name: "Wide Grip Pull Up", sets: 4, reps: "6-8", desc: "Weighted pull-up" },
              { name: "Barbell Romanian Deadlift", sets: 4, reps: "8-10", desc: "RDL" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "10-12", desc: "Upper back" },
              { name: "Barbell Curl", sets: 4, reps: "10-12", desc: "Bicep strength" }
            ]
          }
        ]
      },

      // SHOULDER DAY WORKOUTS
      "shoulders": {
        name: "Shoulder Day",
        description: "Build strong, wide shoulders",
        workouts: [
          {
            id: "gym-shoulders-1",
            name: "Shoulders 1",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Overhead Press", sets: 4, reps: "8-10", desc: "Shoulder compound" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", desc: "Side delts" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "12-15", desc: "Rear delts" },
              { name: "Dumbbell Front Raise", sets: 4, reps: "12-15", desc: "Front delts" },
              { name: "Dumbbell Shrug", sets: 4, reps: "12-15", desc: "Trap work" }
            ]
          },
          {
            id: "gym-shoulders-2",
            name: "Shoulders 2",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells", "Cable"],
            exercises: [
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "DB press" },
              { name: "Cable Single Arm Lateral Raise", sets: 4, reps: "12-15 each", desc: "Cable lateral" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "12-15", desc: "Rear delt fly" },
              { name: "Dumbbell Front Raise", sets: 4, reps: "12-15", desc: "Front delts" },
              { name: "Cable Shrug", sets: 4, reps: "12-15", desc: "Trap isolation" }
            ]
          },
          {
            id: "gym-shoulders-3",
            name: "Shoulders 3",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Overhead Press", sets: 4, reps: "6-8", desc: "Heavy OHP" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "10-12", desc: "Side delt work" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "10-12", desc: "Rear delts" },
              { name: "Dumbbell Front Raise", sets: 4, reps: "10-12", desc: "Front delt" },
              { name: "Barbell Shrug", sets: 4, reps: "10-12", desc: "Heavy shrugs" }
            ]
          },
          {
            id: "gym-shoulders-4",
            name: "Shoulders 4",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells", "Cable"],
            exercises: [
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Seated press" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", desc: "Lateral raise" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "12-15", desc: "Face pull" },
              { name: "Dumbbell Front Raise", sets: 4, reps: "12-15", desc: "Front raise" },
              { name: "Dumbbell Shrug", sets: 4, reps: "12-15", desc: "Shrugs" }
            ]
          },
          {
            id: "gym-shoulders-5",
            name: "Shoulders 5",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells", "Cable"],
            exercises: [
              { name: "Dumbbell Arnold Press", sets: 4, reps: "10-12", desc: "Arnold press" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", desc: "Side delts" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "12-15", desc: "Rear delt work" },
              { name: "Cable Single Arm Front Raise", sets: 4, reps: "12-15 each", desc: "Cable front raise" },
              { name: "Cable Shrug", sets: 4, reps: "12-15", desc: "Trap work" }
            ]
          },
          {
            id: "gym-shoulders-6",
            name: "Shoulders 6",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Overhead Press", sets: 4, reps: "6-8", desc: "Strict press" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "8-10", desc: "DB shoulder press" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "10-12", desc: "Lateral work" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "10-12", desc: "Face pulls" },
              { name: "Barbell Shrug", sets: 4, reps: "8-10", desc: "Heavy traps" }
            ]
          },
          {
            id: "gym-shoulders-7",
            name: "Shoulders 7",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells", "Cable"],
            exercises: [
              { name: "Dumbbell Standing Shoulder Press", sets: 4, reps: "10-12", desc: "Standing press" },
              { name: "Cable Single Arm Lateral Raise", sets: 4, reps: "12-15 each", desc: "Cable lateral" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "12-15", desc: "Rear delts" },
              { name: "Dumbbell Front Raise", sets: 4, reps: "12-15", desc: "Front delts" },
              { name: "Dumbbell Shrug", sets: 4, reps: "12-15", desc: "Shrug work" }
            ]
          },
          {
            id: "gym-shoulders-8",
            name: "Shoulders 8",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Overhead Press", sets: 4, reps: "8-10", desc: "OHP" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", desc: "Side delt raise" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "12-15", desc: "Rear delt fly" },
              { name: "Dumbbell Front Raise", sets: 4, reps: "12-15", desc: "Front raise" },
              { name: "Cable Shrug", sets: 4, reps: "12-15", desc: "Cable trap" }
            ]
          },
          {
            id: "gym-shoulders-9",
            name: "Shoulders 9",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Overhead Press", sets: 4, reps: "6-8", desc: "Power press" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "10-12", desc: "Lateral raises" },
              { name: "Cable Single Arm Reverse Fly", sets: 4, reps: "10-12 each", desc: "Rear delt cable" },
              { name: "Dumbbell Front Raise", sets: 4, reps: "10-12", desc: "Front delt work" },
              { name: "Barbell Shrug", sets: 4, reps: "8-10", desc: "Trap strength" }
            ]
          },
          {
            id: "gym-shoulders-10",
            name: "Shoulders 10",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells", "Cable"],
            exercises: [
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Press" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", desc: "Side delts" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "12-15", desc: "Rear delts" },
              { name: "Dumbbell Front Raise", sets: 4, reps: "12-15", desc: "Front delts" },
              { name: "Dumbbell Shrug", sets: 4, reps: "12-15", desc: "Traps" }
            ]
          },
          {
            id: "gym-shoulders-11",
            name: "Shoulders 11",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells", "Cable"],
            exercises: [
              { name: "Dumbbell Arnold Press", sets: 4, reps: "10-12", desc: "Arnold variation" },
              { name: "Cable Single Arm Lateral Raise", sets: 4, reps: "12-15 each", desc: "Side delt cable" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "12-15", desc: "Rear delts" },
              { name: "Dumbbell Front Raise", sets: 4, reps: "12-15", desc: "Front raise" },
              { name: "Cable Shrug", sets: 4, reps: "12-15", desc: "Trap isolation" }
            ]
          },
          {
            id: "gym-shoulders-12",
            name: "Shoulders 12",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Overhead Press", sets: 4, reps: "6-8", desc: "Heavy press" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "10-12", desc: "Side delt" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "10-12", desc: "Face pull" },
              { name: "Dumbbell Front Raise", sets: 4, reps: "10-12", desc: "Front delt" },
              { name: "Barbell Shrug", sets: 4, reps: "8-10", desc: "Heavy shrug" }
            ]
          },
          {
            id: "gym-shoulders-13",
            name: "Shoulders 13",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells", "Cable"],
            exercises: [
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Shoulder press" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", desc: "Lateral work" },
              { name: "Cable Single Arm Reverse Fly", sets: 4, reps: "12-15 each", desc: "Rear delt" },
              { name: "Cable Single Arm Front Raise", sets: 4, reps: "12-15 each", desc: "Front delt" },
              { name: "Dumbbell Shrug", sets: 4, reps: "12-15", desc: "Shrug" }
            ]
          },
          {
            id: "gym-shoulders-14",
            name: "Shoulders 14",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells", "Cable"],
            exercises: [
              { name: "Dumbbell Standing Shoulder Press", sets: 4, reps: "10-12", desc: "Standing OHP" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", desc: "Side raise" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "12-15", desc: "Face pull" },
              { name: "Dumbbell Front Raise", sets: 4, reps: "12-15", desc: "Front raise" },
              { name: "Dumbbell Shrug", sets: 4, reps: "12-15", desc: "Trap work" }
            ]
          },
          {
            id: "gym-shoulders-15",
            name: "Shoulders 15",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Overhead Press", sets: 4, reps: "6-8", desc: "Strength press" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "8-10", desc: "DB press" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "10-12", desc: "Side delt" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "10-12", desc: "Rear delt" },
              { name: "Barbell Shrug", sets: 4, reps: "8-10", desc: "Trap strength" }
            ]
          }
        ]
      },

      // ARMS WORKOUTS
      "arms": {
        name: "Arms",
        description: "Build powerful arms with dedicated bicep and tricep training",
        workouts: [
          {
            id: "gym-arms-1",
            name: "Arms 1",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Cable", "Dumbbells"],
            exercises: [
              { name: "Barbell Close Grip Bench Press", sets: 4, reps: "8-10", desc: "Tricep compound" },
              { name: "Barbell Bicep Curl", sets: 4, reps: "10-12", desc: "Bicep mass builder" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "10-12", desc: "Tricep isolation" },
              { name: "Cable Bicep Curl", sets: 4, reps: "12-15", desc: "Bicep pump" },
              { name: "Dumbbell Hammer Curl", sets: 4, reps: "12-15", desc: "Brachialis and forearms" }
            ]
          },
          {
            id: "gym-arms-2",
            name: "Arms 2",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Skull Crusher", sets: 4, reps: "10-12", desc: "Tricep builder" },
              { name: "Barbell Preacher Curl", sets: 4, reps: "10-12", desc: "Strict bicep" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "10-12", desc: "Long head focus" },
              { name: "Dumbbell Incline Bicep Curl", sets: 4, reps: "12-15", desc: "Stretch position" },
              { name: "Cable Single Arm Tricep Extension", sets: 4, reps: "12-15 each", desc: "Unilateral tricep" }
            ]
          },
          {
            id: "gym-arms-3",
            name: "Arms 3",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dip Bar", "Cable"],
            exercises: [
              { name: "Weighted Dips", sets: 4, reps: "6-8", desc: "Heavy tricep compound" },
              { name: "Barbell Bicep Curl", sets: 4, reps: "6-8", desc: "Heavy bicep" },
              { name: "Cable Rope Overhead Tricep Extension", sets: 4, reps: "8-10", desc: "Tricep stretch" },
              { name: "Cable Rope Hammer Curl", sets: 4, reps: "10-12", desc: "Brachialis" },
              { name: "Barbell Close Grip Bench Press", sets: 4, reps: "8-10", desc: "Tricep finisher" }
            ]
          },
          {
            id: "gym-arms-4",
            name: "Arms 4",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Cable", "Dumbbells", "Machine"],
            exercises: [
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "12-15", desc: "Tricep isolation" },
              { name: "Cable Bicep Curl", sets: 4, reps: "12-15", desc: "Bicep curl" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "12-15", desc: "Tricep extension" },
              { name: "Dumbbell Hammer Curl", sets: 4, reps: "12-15", desc: "Hammer curl" },
              { name: "Machine Tricep Dip", sets: 4, reps: "12-15", desc: "Assisted dips" }
            ]
          },
          {
            id: "gym-arms-5",
            name: "Arms 5",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Cable", "EZ Bar"],
            exercises: [
              { name: "EZ Bar Skull Crusher", sets: 4, reps: "10-12", desc: "Tricep builder" },
              { name: "EZ Bar Preacher Curl", sets: 4, reps: "10-12", desc: "Bicep peak" },
              { name: "Cable Single Arm Overhead Tricep Extension", sets: 4, reps: "10-12 each", desc: "Unilateral" },
              { name: "Cable Single Arm Bicep Curl", sets: 4, reps: "12-15 each", desc: "Peak contraction" },
              { name: "Barbell Wrist Curl", sets: 4, reps: "15-20", desc: "Forearm mass" }
            ]
          },
          {
            id: "gym-arms-6",
            name: "Arms 6",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Close Grip Bench Press", sets: 4, reps: "6-8", desc: "Heavy tricep" },
              { name: "Barbell Bicep Curl", sets: 4, reps: "8-10", desc: "Power curls" },
              { name: "Dumbbell Skull Crusher", sets: 4, reps: "8-10", desc: "DB skulls" },
              { name: "Dumbbell Concentration Curl", sets: 4, reps: "10-12 each", desc: "Bicep peak" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "12-15", desc: "Rear delt and arms" }
            ]
          },
          {
            id: "gym-arms-7",
            name: "Arms 7",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Cable", "Dumbbells", "Machine"],
            exercises: [
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "10-12", desc: "Cable tricep" },
              { name: "Cable Rope Hammer Curl", sets: 4, reps: "10-12", desc: "Cable hammer" },
              { name: "Dumbbell Tricep Kickback", sets: 4, reps: "12-15 each", desc: "Tricep isolation" },
              { name: "Dumbbell Spider Curl", sets: 4, reps: "12-15", desc: "Bicep stretch" },
              { name: "Machine Preacher Curl", sets: 4, reps: "12-15", desc: "Machine curl" }
            ]
          },
          {
            id: "gym-arms-8",
            name: "Arms 8",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells", "Cable", "Machine"],
            exercises: [
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "12-15", desc: "Overhead ext" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "12-15", desc: "Basic curl" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "12-15", desc: "Cable tricep" },
              { name: "Cable Bicep Curl", sets: 4, reps: "12-15", desc: "Cable bicep" },
              { name: "Dumbbell Hammer Curl", sets: 4, reps: "15-20", desc: "Forearms" }
            ]
          },
          {
            id: "gym-arms-9",
            name: "Arms 9",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "EZ Bar", "Cable"],
            exercises: [
              { name: "Barbell Skull Crusher", sets: 4, reps: "6-8", desc: "Heavy skulls" },
              { name: "Barbell Preacher Curl", sets: 4, reps: "6-8", desc: "Heavy preacher" },
              { name: "Cable Rope Overhead Tricep Extension", sets: 4, reps: "10-12", desc: "Cable overhead" },
              { name: "EZ Bar Spider Curl", sets: 4, reps: "10-12", desc: "Spider curl" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "12-15", desc: "Finisher" }
            ]
          },
          {
            id: "gym-arms-10",
            name: "Arms 10",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Cable", "Machine", "Dumbbells"],
            exercises: [
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "12-15", desc: "Cable tricep" },
              { name: "Cable Bicep Curl", sets: 4, reps: "12-15", desc: "Cable bicep" },
              { name: "Machine Tricep Dip", sets: 4, reps: "12-15", desc: "Machine dips" },
              { name: "Machine Preacher Curl", sets: 4, reps: "12-15", desc: "Machine curl" },
              { name: "Dumbbell Wrist Curl", sets: 4, reps: "15-20", desc: "Forearms" }
            ]
          },
          {
            id: "gym-arms-11",
            name: "Arms 11",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Close Grip Bench Press", sets: 4, reps: "8-10", desc: "Tricep press" },
              { name: "Dumbbell Alternating Bicep Curl", sets: 4, reps: "10-12 each", desc: "Alternating curls" },
              { name: "Cable Single Arm Tricep Extension", sets: 4, reps: "10-12 each", desc: "Unilateral tricep" },
              { name: "Cable Single Arm Bicep Curl", sets: 4, reps: "12-15 each", desc: "Unilateral bicep" },
              { name: "Dumbbell Reverse Curl", sets: 4, reps: "12-15", desc: "Brachioradialis" }
            ]
          },
          {
            id: "gym-arms-12",
            name: "Arms 12",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Dip Bar", "Barbell", "Cable"],
            exercises: [
              { name: "Weighted Dips", sets: 4, reps: "8-10", desc: "Compound tricep" },
              { name: "Barbell Bicep Curl", sets: 4, reps: "8-10", desc: "Barbell curl" },
              { name: "Cable Rope Overhead Tricep Extension", sets: 4, reps: "10-12", desc: "Long head" },
              { name: "Cable Rope Hammer Curl", sets: 4, reps: "10-12", desc: "Cable hammer" },
              { name: "Barbell Reverse Curl", sets: 4, reps: "10-12", desc: "Forearm builder" }
            ]
          },
          {
            id: "gym-arms-13",
            name: "Arms 13",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["EZ Bar", "Cable", "Dumbbells"],
            exercises: [
              { name: "EZ Bar Skull Crusher", sets: 4, reps: "10-12", desc: "EZ bar skulls" },
              { name: "EZ Bar Bicep Curl", sets: 4, reps: "10-12", desc: "EZ bar curl" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "12-15", desc: "Cable rope" },
              { name: "Dumbbell Incline Bicep Curl", sets: 4, reps: "12-15", desc: "Incline curl" },
              { name: "Dumbbell Tricep Kickback", sets: 4, reps: "12-15 each", desc: "Kickback" }
            ]
          },
          {
            id: "gym-arms-14",
            name: "Arms 14",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells", "Cable", "Machine"],
            exercises: [
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "12-15", desc: "Overhead" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "12-15", desc: "Bicep curl" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "12-15", desc: "Cable tricep" },
              { name: "Cable Bicep Curl", sets: 4, reps: "12-15", desc: "Cable bicep" },
              { name: "Machine Preacher Curl", sets: 4, reps: "15-20", desc: "Machine" }
            ]
          },
          {
            id: "gym-arms-15",
            name: "Arms 15",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Cable", "Dumbbells"],
            exercises: [
              { name: "Barbell Close Grip Bench Press", sets: 4, reps: "6-8", desc: "Power press" },
              { name: "Barbell Preacher Curl", sets: 4, reps: "6-8", desc: "Power curl" },
              { name: "Dumbbell Skull Crusher", sets: 4, reps: "8-10", desc: "DB skulls" },
              { name: "Dumbbell Concentration Curl", sets: 4, reps: "10-12 each", desc: "Peak contraction" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "12-15", desc: "High rep finisher" }
            ]
          }
        ]
      },

      // CORE WORKOUTS
      "core": {
        name: "Core",
        description: "Build a strong, stable core with gym equipment",
        workouts: [
          {
            id: "gym-core-1",
            name: "Core 1",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Cable", "Ab Wheel", "Weight Plate"],
            exercises: [
              { name: "Cable Kneeling Crunch", sets: 4, reps: "12-15", desc: "Weighted crunch" },
              { name: "Hanging Leg Raise", sets: 4, reps: "10-12", desc: "Lower abs" },
              { name: "Cable Wood Chop", sets: 4, reps: "12-15 each", desc: "Rotational power" },
              { name: "Ab Wheel Rollout", sets: 4, reps: "8-10", desc: "Core stability" },
              { name: "Cable Pallof Press", sets: 4, reps: "12-15 each", desc: "Anti-rotation" }
            ]
          },
          {
            id: "gym-core-2",
            name: "Core 2",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Cable", "Medicine Ball", "Decline Bench"],
            exercises: [
              { name: "Cable Standing Crunch", sets: 4, reps: "12-15", desc: "Standing abs" },
              { name: "Decline Weighted Sit Up", sets: 4, reps: "12-15", desc: "Weighted sit ups" },
              { name: "Medicine Ball Russian Twist", sets: 4, reps: "20-30 total", desc: "Oblique rotation" },
              { name: "Cable Reverse Crunch", sets: 4, reps: "12-15", desc: "Lower abs" },
              { name: "Cable Side Bend", sets: 4, reps: "15-20 each", desc: "Oblique isolation" }
            ]
          },
          {
            id: "gym-core-3",
            name: "Core 3",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Pull-up Bar", "Cable", "Ab Wheel"],
            exercises: [
              { name: "Hanging Leg Raise", sets: 4, reps: "12-15", desc: "Strict form" },
              { name: "Cable Kneeling Crunch", sets: 4, reps: "15-20", desc: "Heavy weight" },
              { name: "Ab Wheel Rollout", sets: 4, reps: "12-15", desc: "Full extension" },
              { name: "Cable Wood Chop", sets: 4, reps: "15-20 each", desc: "Explosive rotation" },
              { name: "Toes To Bar", sets: 4, reps: "10-12", desc: "Advanced hanging" }
            ]
          },
          {
            id: "gym-core-4",
            name: "Core 4",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Cable", "Medicine Ball", "Mat"],
            exercises: [
              { name: "Cable Kneeling Crunch", sets: 4, reps: "12-15", desc: "Cable crunch" },
              { name: "Medicine Ball Dead Bug", sets: 4, reps: "10-12 each", desc: "Stability" },
              { name: "Cable Pallof Press", sets: 4, reps: "12-15 each", desc: "Anti-rotation" },
              { name: "Weighted Plank", sets: 4, reps: "30-45 sec", desc: "Isometric hold" },
              { name: "Cable Side Bend", sets: 4, reps: "15-20 each", desc: "Obliques" }
            ]
          },
          {
            id: "gym-core-5",
            name: "Core 5",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Cable", "Decline Bench", "Weight Plate"],
            exercises: [
              { name: "Cable Standing Crunch", sets: 4, reps: "12-15", desc: "Standing abs" },
              { name: "Decline Weighted Sit Up", sets: 4, reps: "10-12", desc: "Decline sit up" },
              { name: "Cable Reverse Wood Chop", sets: 4, reps: "12-15 each", desc: "Low to high" },
              { name: "Weighted Russian Twist", sets: 4, reps: "20-30 total", desc: "Plate twist" },
              { name: "Hanging Knee Raise", sets: 4, reps: "12-15", desc: "Knee raises" }
            ]
          },
          {
            id: "gym-core-6",
            name: "Core 6",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Cable", "Ab Wheel", "Pull-up Bar"],
            exercises: [
              { name: "Toes To Bar", sets: 4, reps: "12-15", desc: "Advanced T2B" },
              { name: "Cable Kneeling Crunch", sets: 4, reps: "15-20", desc: "Heavy crunch" },
              { name: "Ab Wheel Rollout", sets: 4, reps: "15-20", desc: "Extended rollouts" },
              { name: "Cable Wood Chop", sets: 4, reps: "15-20 each", desc: "Power chop" },
              { name: "Hanging Windshield Wiper", sets: 4, reps: "8-10 each", desc: "Advanced oblique" }
            ]
          },
          {
            id: "gym-core-7",
            name: "Core 7",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Cable", "Medicine Ball", "Decline Bench"],
            exercises: [
              { name: "Cable Kneeling Crunch", sets: 4, reps: "12-15", desc: "Cable crunch" },
              { name: "Medicine Ball Slam", sets: 4, reps: "15-20", desc: "Explosive core" },
              { name: "Decline Weighted Sit Up", sets: 4, reps: "12-15", desc: "Weighted sit up" },
              { name: "Cable Pallof Press", sets: 4, reps: "12-15 each", desc: "Anti-rotation" },
              { name: "Hanging Leg Raise", sets: 4, reps: "10-12", desc: "Leg raises" }
            ]
          },
          {
            id: "gym-core-8",
            name: "Core 8",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Cable", "Mat", "Weight Plate"],
            exercises: [
              { name: "Cable Standing Crunch", sets: 4, reps: "12-15", desc: "Standing crunch" },
              { name: "Weighted Plank", sets: 4, reps: "30-45 sec", desc: "Plate plank" },
              { name: "Cable Side Bend", sets: 4, reps: "15-20 each", desc: "Side bend" },
              { name: "Cable Reverse Crunch", sets: 4, reps: "12-15", desc: "Reverse crunch" },
              { name: "Cable Pallof Press", sets: 4, reps: "12-15 each", desc: "Pallof press" }
            ]
          },
          {
            id: "gym-core-9",
            name: "Core 9",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Pull-up Bar", "Ab Wheel", "Cable"],
            exercises: [
              { name: "Hanging Leg Raise", sets: 4, reps: "15-20", desc: "High reps" },
              { name: "Ab Wheel Rollout", sets: 4, reps: "15-20", desc: "Full rollouts" },
              { name: "Toes To Bar", sets: 4, reps: "12-15", desc: "Strict T2B" },
              { name: "Cable Wood Chop", sets: 4, reps: "15-20 each", desc: "Heavy chop" },
              { name: "Cable Kneeling Crunch", sets: 4, reps: "15-20", desc: "Heavy crunch" }
            ]
          },
          {
            id: "gym-core-10",
            name: "Core 10",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Cable", "Medicine Ball", "Mat"],
            exercises: [
              { name: "Cable Kneeling Crunch", sets: 4, reps: "12-15", desc: "Crunch" },
              { name: "Medicine Ball Dead Bug", sets: 4, reps: "10-12 each", desc: "Dead bug" },
              { name: "Cable Pallof Press", sets: 4, reps: "12-15 each", desc: "Pallof" },
              { name: "Weighted Plank", sets: 4, reps: "30-45 sec", desc: "Plank" },
              { name: "Hanging Knee Raise", sets: 4, reps: "10-12", desc: "Knee raise" }
            ]
          },
          {
            id: "gym-core-11",
            name: "Core 11",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Cable", "Decline Bench", "Medicine Ball"],
            exercises: [
              { name: "Cable Standing Crunch", sets: 4, reps: "12-15", desc: "Standing" },
              { name: "Decline Weighted Sit Up", sets: 4, reps: "12-15", desc: "Decline" },
              { name: "Medicine Ball Russian Twist", sets: 4, reps: "20-30 total", desc: "Twist" },
              { name: "Cable Wood Chop", sets: 4, reps: "12-15 each", desc: "Chop" },
              { name: "Hanging Leg Raise", sets: 4, reps: "12-15", desc: "Leg raise" }
            ]
          },
          {
            id: "gym-core-12",
            name: "Core 12",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Ab Wheel", "Cable", "Pull-up Bar"],
            exercises: [
              { name: "Ab Wheel Rollout", sets: 4, reps: "15-20", desc: "Rollouts" },
              { name: "Toes To Bar", sets: 4, reps: "15-20", desc: "T2B" },
              { name: "Cable Kneeling Crunch", sets: 4, reps: "15-20", desc: "Heavy" },
              { name: "Hanging Windshield Wiper", sets: 4, reps: "10-12 each", desc: "Wipers" },
              { name: "Cable Wood Chop", sets: 4, reps: "15-20 each", desc: "Chop" }
            ]
          },
          {
            id: "gym-core-13",
            name: "Core 13",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Cable", "Medicine Ball", "Weight Plate"],
            exercises: [
              { name: "Cable Kneeling Crunch", sets: 4, reps: "12-15", desc: "Crunch" },
              { name: "Medicine Ball Slam", sets: 4, reps: "15-20", desc: "Slam" },
              { name: "Cable Pallof Press", sets: 4, reps: "12-15 each", desc: "Pallof" },
              { name: "Weighted Russian Twist", sets: 4, reps: "20-30 total", desc: "Twist" },
              { name: "Hanging Leg Raise", sets: 4, reps: "12-15", desc: "Leg raise" }
            ]
          },
          {
            id: "gym-core-14",
            name: "Core 14",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Cable", "Mat", "Medicine Ball"],
            exercises: [
              { name: "Cable Standing Crunch", sets: 4, reps: "12-15", desc: "Crunch" },
              { name: "Weighted Plank", sets: 4, reps: "30-45 sec", desc: "Plank" },
              { name: "Cable Side Bend", sets: 4, reps: "15-20 each", desc: "Side bend" },
              { name: "Medicine Ball Dead Bug", sets: 4, reps: "10-12 each", desc: "Dead bug" },
              { name: "Cable Reverse Crunch", sets: 4, reps: "12-15", desc: "Reverse" }
            ]
          },
          {
            id: "gym-core-15",
            name: "Core 15",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Pull-up Bar", "Ab Wheel", "Cable"],
            exercises: [
              { name: "Toes To Bar", sets: 4, reps: "15-20", desc: "High rep T2B" },
              { name: "Ab Wheel Rollout", sets: 4, reps: "15-20", desc: "Full rollouts" },
              { name: "Hanging Leg Raise", sets: 4, reps: "15-20", desc: "Strict legs" },
              { name: "Cable Wood Chop", sets: 4, reps: "15-20 each", desc: "Power" },
              { name: "Hanging Windshield Wiper", sets: 4, reps: "10-12 each", desc: "Advanced" }
            ]
          }
        ]
      },

      // ARMS + CORE COMBO WORKOUTS
      "armscore": {
        name: "Arms & Core",
        description: "Powerful arms and strong core combo workouts",
        workouts: [
          {
            id: "gym-armscore-1",
            name: "Arms & Core 1",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Cable", "Pull-up Bar"],
            exercises: [
              { name: "Barbell Close Grip Bench Press", sets: 4, reps: "8-10", desc: "Tricep compound" },
              { name: "Barbell Bicep Curl", sets: 4, reps: "10-12", desc: "Bicep builder" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "12-15", desc: "Tricep isolation" },
              { name: "Cable Kneeling Crunch", sets: 4, reps: "12-15", desc: "Weighted abs" },
              { name: "Hanging Leg Raise", sets: 4, reps: "10-12", desc: "Lower abs" }
            ]
          },
          {
            id: "gym-armscore-2",
            name: "Arms & Core 2",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["EZ Bar", "Cable", "Dumbbells"],
            exercises: [
              { name: "EZ Bar Skull Crusher", sets: 4, reps: "10-12", desc: "Tricep builder" },
              { name: "EZ Bar Preacher Curl", sets: 4, reps: "10-12", desc: "Strict bicep" },
              { name: "Dumbbell Hammer Curl", sets: 4, reps: "12-15", desc: "Brachialis" },
              { name: "Cable Wood Chop", sets: 4, reps: "12-15 each", desc: "Rotational power" },
              { name: "Cable Pallof Press", sets: 4, reps: "12-15 each", desc: "Anti-rotation" }
            ]
          },
          {
            id: "gym-armscore-3",
            name: "Arms & Core 3",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Dip Bar", "Barbell", "Cable", "Ab Wheel"],
            exercises: [
              { name: "Weighted Dips", sets: 4, reps: "6-8", desc: "Heavy tricep" },
              { name: "Barbell Bicep Curl", sets: 4, reps: "8-10", desc: "Heavy bicep" },
              { name: "Cable Rope Hammer Curl", sets: 4, reps: "10-12", desc: "Brachialis focus" },
              { name: "Ab Wheel Rollout", sets: 4, reps: "12-15", desc: "Full core" },
              { name: "Toes To Bar", sets: 4, reps: "10-12", desc: "Advanced abs" }
            ]
          },
          {
            id: "gym-armscore-4",
            name: "Arms & Core 4",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells", "Cable", "Medicine Ball"],
            exercises: [
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "12-15", desc: "Tricep isolation" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "12-15", desc: "Basic curl" },
              { name: "Cable Bicep Curl", sets: 4, reps: "12-15", desc: "Cable bicep" },
              { name: "Cable Kneeling Crunch", sets: 4, reps: "12-15", desc: "Cable crunch" },
              { name: "Medicine Ball Dead Bug", sets: 4, reps: "10-12 each", desc: "Core stability" }
            ]
          },
          {
            id: "gym-armscore-5",
            name: "Arms & Core 5",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Cable", "Decline Bench"],
            exercises: [
              { name: "Barbell Skull Crusher", sets: 4, reps: "10-12", desc: "Tricep mass" },
              { name: "Barbell Preacher Curl", sets: 4, reps: "10-12", desc: "Bicep peak" },
              { name: "Cable Single Arm Tricep Extension", sets: 4, reps: "12-15 each", desc: "Unilateral tricep" },
              { name: "Decline Weighted Sit Up", sets: 4, reps: "12-15", desc: "Weighted abs" },
              { name: "Cable Wood Chop", sets: 4, reps: "12-15 each", desc: "Obliques" }
            ]
          },
          {
            id: "gym-armscore-6",
            name: "Arms & Core 6",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Cable", "Pull-up Bar"],
            exercises: [
              { name: "Barbell Close Grip Bench Press", sets: 4, reps: "6-8", desc: "Heavy press" },
              { name: "Cable Rope Hammer Curl", sets: 4, reps: "10-12", desc: "Brachialis" },
              { name: "Dumbbell Concentration Curl", sets: 4, reps: "10-12 each", desc: "Bicep peak" },
              { name: "Hanging Leg Raise", sets: 4, reps: "12-15", desc: "Lower abs strength" },
              { name: "Cable Kneeling Crunch", sets: 4, reps: "15-20", desc: "Heavy abs" }
            ]
          },
          {
            id: "gym-armscore-7",
            name: "Arms & Core 7",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Cable", "Dumbbells", "Medicine Ball"],
            exercises: [
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "10-12", desc: "Tricep pump" },
              { name: "Cable Bicep Curl", sets: 4, reps: "10-12", desc: "Bicep pump" },
              { name: "Dumbbell Tricep Kickback", sets: 4, reps: "12-15 each", desc: "Tricep finisher" },
              { name: "Medicine Ball Russian Twist", sets: 4, reps: "20-30 total", desc: "Oblique rotation" },
              { name: "Cable Pallof Press", sets: 4, reps: "12-15 each", desc: "Anti-rotation" }
            ]
          },
          {
            id: "gym-armscore-8",
            name: "Arms & Core 8",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells", "Cable", "Mat"],
            exercises: [
              { name: "Dumbbell Skull Crusher", sets: 4, reps: "12-15", desc: "Tricep work" },
              { name: "Dumbbell Hammer Curl", sets: 4, reps: "12-15", desc: "Hammer curl" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "12-15", desc: "Cable tricep" },
              { name: "Cable Standing Crunch", sets: 4, reps: "12-15", desc: "Standing abs" },
              { name: "Weighted Plank", sets: 4, reps: "30-45 sec", desc: "Core hold" }
            ]
          },
          {
            id: "gym-armscore-9",
            name: "Arms & Core 9",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["EZ Bar", "Cable", "Ab Wheel", "Pull-up Bar"],
            exercises: [
              { name: "EZ Bar Skull Crusher", sets: 4, reps: "8-10", desc: "Heavy skulls" },
              { name: "EZ Bar Spider Curl", sets: 4, reps: "10-12", desc: "Spider curl" },
              { name: "Cable Rope Overhead Tricep Extension", sets: 4, reps: "10-12", desc: "Long head" },
              { name: "Ab Wheel Rollout", sets: 4, reps: "15-20", desc: "Full rollouts" },
              { name: "Toes To Bar", sets: 4, reps: "12-15", desc: "T2B" }
            ]
          },
          {
            id: "gym-armscore-10",
            name: "Arms & Core 10",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Close Grip Bench Press", sets: 4, reps: "8-10", desc: "Tricep compound" },
              { name: "Dumbbell Alternating Bicep Curl", sets: 4, reps: "10-12 each", desc: "Alternating curls" },
              { name: "Cable Single Arm Bicep Curl", sets: 4, reps: "12-15 each", desc: "Unilateral bicep" },
              { name: "Cable Kneeling Crunch", sets: 4, reps: "12-15", desc: "Cable abs" },
              { name: "Cable Wood Chop", sets: 4, reps: "12-15 each", desc: "Rotational core" }
            ]
          }
        ]
      },

      // FULL BODY WORKOUTS
      "fullbody": {
        name: "Full Body",
        description: "Total body workouts",
        workouts: [
          {
            id: "gym-fullbody-1",
            name: "Full Body 1",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Back Squat", sets: 4, reps: "8-10", desc: "Leg compound" },
              { name: "Barbell Bench Press", sets: 4, reps: "8-10", desc: "Chest compound" },
              { name: "Cable Seated Rotational Row", sets: 4, reps: "10-12", desc: "Back work" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "12-15", desc: "Biceps" }
            ]
          },
          {
            id: "gym-fullbody-2",
            name: "Full Body 2",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells", "Cable", "Machine"],
            exercises: [
              { name: "Seated Leg Press", sets: 4, reps: "10-12", desc: "Leg press" },
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "10-12", desc: "Chest" },
              { name: "Lat Machine Wide Bar Close Grip Pulldown", sets: 4, reps: "10-12", desc: "Lats" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", desc: "Side delts" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "12-15", desc: "Triceps" }
            ]
          },
          {
            id: "gym-fullbody-3",
            name: "Full Body 3",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Front Squat", sets: 4, reps: "6-8", desc: "Front squat" },
              { name: "Barbell Overhead Press", sets: 4, reps: "6-8", desc: "OHP" },
              { name: "Barbell Romanian Deadlift", sets: 4, reps: "8-10", desc: "RDL" },
              { name: "Wide Grip Pull Up", sets: 4, reps: "8-10", desc: "Pull-ups" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "12-15", desc: "Rear delts" }
            ]
          },
          {
            id: "gym-fullbody-4",
            name: "Full Body 4",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells", "Machine", "Cable"],
            exercises: [
              { name: "Dumbbell Goblet Squat", sets: 4, reps: "10-12", desc: "Squat" },
              { name: "Machine Seated Parallel Grip Chest Press", sets: 4, reps: "10-12", desc: "Chest" },
              { name: "Machine Seated Row", sets: 4, reps: "10-12", desc: "Back" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Dumbbell Hammer Curl", sets: 4, reps: "12-15", desc: "Biceps" }
            ]
          },
          {
            id: "gym-fullbody-5",
            name: "Full Body 5",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Back Squat", sets: 4, reps: "10-12", desc: "Squats" },
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "10-12", desc: "Incline press" },
              { name: "Cable Single Arm Row", sets: 4, reps: "10-12 each", desc: "Cable rows" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", desc: "Side delts" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "12-15", desc: "Triceps" }
            ]
          },
          {
            id: "gym-fullbody-6",
            name: "Full Body 6",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Romanian Deadlift", sets: 4, reps: "6-8", desc: "Deadlift" },
              { name: "Barbell Bench Press", sets: 4, reps: "6-8", desc: "Bench" },
              { name: "Chin Up", sets: 4, reps: "8-10", desc: "Chin-ups" },
              { name: "Barbell Overhead Press", sets: 4, reps: "8-10", desc: "Shoulders" },
              { name: "Barbell Curl", sets: 4, reps: "10-12", desc: "Biceps" }
            ]
          },
          {
            id: "gym-fullbody-7",
            name: "Full Body 7",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells", "Cable", "Machine"],
            exercises: [
              { name: "Dumbbell Walking Lunge", sets: 4, reps: "10-12 each", desc: "Lunges" },
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "10-12", desc: "Chest press" },
              { name: "Lat Machine Parallel Grip Row", sets: 4, reps: "10-12", desc: "Row" },
              { name: "Dumbbell Arnold Press", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "12-15", desc: "Triceps" }
            ]
          },
          {
            id: "gym-fullbody-8",
            name: "Full Body 8",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Front Squat", sets: 4, reps: "8-10", desc: "Front squat" },
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "10-12", desc: "Chest" },
              { name: "Cable Seated Rotational Row", sets: 4, reps: "10-12", desc: "Rows" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "12-15", desc: "Biceps" }
            ]
          },
          {
            id: "gym-fullbody-9",
            name: "Full Body 9",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Back Squat", sets: 4, reps: "6-8", desc: "Heavy squats" },
              { name: "Barbell Bent Over Row", sets: 4, reps: "6-8", desc: "Heavy rows" },
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "8-10", desc: "Incline" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "10-12", desc: "Side delts" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "10-12", desc: "Triceps" }
            ]
          },
          {
            id: "gym-fullbody-10",
            name: "Full Body 10",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells", "Machine", "Cable"],
            exercises: [
              { name: "Seated Leg Press", sets: 4, reps: "10-12", desc: "Leg press" },
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "10-12", desc: "Chest" },
              { name: "Machine Assisted Wide Grip Pull Up", sets: 4, reps: "10-12", desc: "Lats" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Dumbbell Hammer Curl", sets: 4, reps: "12-15", desc: "Arms" }
            ]
          },
          {
            id: "gym-fullbody-11",
            name: "Full Body 11",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Hip Thrust", sets: 4, reps: "10-12", desc: "Glutes" },
              { name: "Barbell Bench Press", sets: 4, reps: "8-10", desc: "Chest" },
              { name: "Lat Machine Wide Bar Close Grip Pulldown", sets: 4, reps: "10-12", desc: "Lats" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "12-15", desc: "Biceps" }
            ]
          },
          {
            id: "gym-fullbody-12",
            name: "Full Body 12",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Romanian Deadlift", sets: 4, reps: "6-8", desc: "RDL" },
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "8-10", desc: "Chest" },
              { name: "Wide Grip Pull Up", sets: 4, reps: "6-8", desc: "Pull-ups" },
              { name: "Barbell Overhead Press", sets: 4, reps: "8-10", desc: "OHP" },
              { name: "Cable Single Arm Bicep Curl", sets: 4, reps: "10-12 each", desc: "Biceps" }
            ]
          },
          {
            id: "gym-fullbody-13",
            name: "Full Body 13",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells", "Cable", "Machine"],
            exercises: [
              { name: "Dumbbell Bulgarian Split Squat", sets: 4, reps: "10-12 each", desc: "Split squat" },
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "10-12", desc: "Incline" },
              { name: "Cable Single Arm Row", sets: 4, reps: "10-12 each", desc: "Rows" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", desc: "Side delts" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "12-15", desc: "Triceps" }
            ]
          },
          {
            id: "gym-fullbody-14",
            name: "Full Body 14",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells", "Machine", "Cable"],
            exercises: [
              { name: "Dumbbell Goblet Squat", sets: 4, reps: "10-12", desc: "Squat" },
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "10-12", desc: "Chest" },
              { name: "Lat Machine Parallel Grip Row", sets: 4, reps: "10-12", desc: "Back" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "12-15", desc: "Triceps" }
            ]
          },
          {
            id: "gym-fullbody-15",
            name: "Full Body 15",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Back Squat", sets: 4, reps: "6-8", desc: "Squats" },
              { name: "Barbell Bench Press", sets: 4, reps: "6-8", desc: "Bench" },
              { name: "Chin Up", sets: 4, reps: "6-8", desc: "Chins" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "8-10", desc: "Shoulders" },
              { name: "Barbell Curl", sets: 4, reps: "10-12", desc: "Biceps" }
            ]
          }
        ]
      },

      // UPPER/LOWER SPLIT
      "upper": {
        name: "Upper Body",
        description: "Complete upper body workouts",
        workouts: [
          {
            id: "gym-upper-1",
            name: "Upper 1",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Bench Press", sets: 4, reps: "8-10", desc: "Chest compound" },
              { name: "Cable Seated Rotational Row", sets: 4, reps: "10-12", desc: "Back rows" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", desc: "Side delts" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "12-15", desc: "Biceps" }
            ]
          },
          {
            id: "gym-upper-2",
            name: "Upper 2",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells", "Cable", "Machine"],
            exercises: [
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "10-12", desc: "Chest" },
              { name: "Lat Machine Wide Bar Close Grip Pulldown", sets: 4, reps: "10-12", desc: "Lats" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "12-15", desc: "Rear delts" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "12-15", desc: "Triceps" }
            ]
          },
          {
            id: "gym-upper-3",
            name: "Upper 3",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Bench Press", sets: 4, reps: "6-8", desc: "Heavy bench" },
              { name: "Wide Grip Pull Up", sets: 4, reps: "6-8", desc: "Pull-ups" },
              { name: "Barbell Overhead Press", sets: 4, reps: "8-10", desc: "OHP" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "10-12", desc: "Side delts" },
              { name: "Barbell Curl", sets: 4, reps: "10-12", desc: "Biceps" }
            ]
          },
          {
            id: "gym-upper-4",
            name: "Upper 4",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells", "Machine", "Cable"],
            exercises: [
              { name: "Machine Seated Parallel Grip Chest Press", sets: 4, reps: "10-12", desc: "Chest press" },
              { name: "Machine Seated Row", sets: 4, reps: "10-12", desc: "Back row" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "12-15", desc: "Rear delts" },
              { name: "Dumbbell Hammer Curl", sets: 4, reps: "12-15", desc: "Biceps" }
            ]
          },
          {
            id: "gym-upper-5",
            name: "Upper 5",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "10-12", desc: "Incline" },
              { name: "Cable Single Arm Row", sets: 4, reps: "10-12 each", desc: "Cable row" },
              { name: "Dumbbell Arnold Press", sets: 4, reps: "10-12", desc: "Arnold press" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "12-15", desc: "Rear delts" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "12-15", desc: "Triceps" }
            ]
          },
          {
            id: "gym-upper-6",
            name: "Upper 6",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Overhead Press", sets: 4, reps: "6-8", desc: "Shoulder strength" },
              { name: "Chin Up", sets: 4, reps: "6-8", desc: "Chins" },
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "8-10", desc: "Chest" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "10-12", desc: "Side delts" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "10-12", desc: "Triceps" }
            ]
          },
          {
            id: "gym-upper-7",
            name: "Upper 7",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells", "Cable", "Machine"],
            exercises: [
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "10-12", desc: "Chest" },
              { name: "Lat Machine Parallel Grip Row", sets: 4, reps: "10-12", desc: "Row" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", desc: "Side delts" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "12-15", desc: "Biceps" }
            ]
          },
          {
            id: "gym-upper-8",
            name: "Upper 8",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Incline Bench Press", sets: 4, reps: "8-10", desc: "Incline bench" },
              { name: "Cable Seated Rotational Row", sets: 4, reps: "10-12", desc: "Back" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "12-15", desc: "Rear delts" },
              { name: "Dumbbell Hammer Curl", sets: 4, reps: "12-15", desc: "Biceps" }
            ]
          },
          {
            id: "gym-upper-9",
            name: "Upper 9",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Bench Press", sets: 4, reps: "6-8", desc: "Bench strength" },
              { name: "Barbell Bent Over Row", sets: 4, reps: "6-8", desc: "Row strength" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "8-10", desc: "Shoulders" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "10-12", desc: "Side delts" },
              { name: "Barbell Curl", sets: 4, reps: "10-12", desc: "Biceps" }
            ]
          },
          {
            id: "gym-upper-10",
            name: "Upper 10",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells", "Machine", "Cable"],
            exercises: [
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "10-12", desc: "Chest" },
              { name: "Machine Assisted Wide Grip Pull Up", sets: 4, reps: "10-12", desc: "Lats" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", desc: "Side delts" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "12-15", desc: "Triceps" }
            ]
          },
          {
            id: "gym-upper-11",
            name: "Upper 11",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "10-12", desc: "Incline" },
              { name: "Wide Grip Pull Up", sets: 4, reps: "8-10", desc: "Pull-ups" },
              { name: "Dumbbell Arnold Press", sets: 4, reps: "10-12", desc: "Arnold press" },
              { name: "Cable Single Arm Reverse Fly", sets: 4, reps: "12-15 each", desc: "Rear delts" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "12-15", desc: "Biceps" }
            ]
          },
          {
            id: "gym-upper-12",
            name: "Upper 12",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Overhead Press", sets: 4, reps: "6-8", desc: "OHP" },
              { name: "Barbell Bench Press", sets: 4, reps: "6-8", desc: "Bench" },
              { name: "Chin Up", sets: 4, reps: "8-10", desc: "Chins" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "10-12", desc: "Side delts" },
              { name: "Dumbbell Skull Crusher", sets: 4, reps: "10-12", desc: "Triceps" }
            ]
          },
          {
            id: "gym-upper-13",
            name: "Upper 13",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells", "Cable", "Machine"],
            exercises: [
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "10-12", desc: "Chest" },
              { name: "Cable Single Arm Row", sets: 4, reps: "10-12 each", desc: "Rows" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "12-15", desc: "Rear delts" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "12-15", desc: "Triceps" }
            ]
          },
          {
            id: "gym-upper-14",
            name: "Upper 14",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells", "Machine", "Cable"],
            exercises: [
              { name: "Machine Seated Parallel Grip Chest Press", sets: 4, reps: "10-12", desc: "Chest" },
              { name: "Lat Machine Wide Bar Close Grip Pulldown", sets: 4, reps: "10-12", desc: "Lats" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "12-15", desc: "Rear delts" },
              { name: "Dumbbell Hammer Curl", sets: 4, reps: "12-15", desc: "Biceps" }
            ]
          },
          {
            id: "gym-upper-15",
            name: "Upper 15",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Bench Press", sets: 4, reps: "6-8", desc: "Heavy bench" },
              { name: "Wide Grip Pull Up", sets: 4, reps: "6-8", desc: "Heavy pull-ups" },
              { name: "Barbell Overhead Press", sets: 4, reps: "6-8", desc: "Heavy OHP" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "10-12", desc: "Side delts" },
              { name: "Barbell Curl", sets: 4, reps: "10-12", desc: "Biceps" }
            ]
          }
        ]
      },

      "lower": {
        name: "Lower Body",
        description: "Complete lower body workouts",
        workouts: [
          {
            id: "gym-lower-1",
            name: "Lower 1",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Machine", "Dumbbells"],
            exercises: [
              { name: "Barbell Back Squat", sets: 4, reps: "8-10", desc: "Squat compound" },
              { name: "Barbell Romanian Deadlift", sets: 4, reps: "10-12", desc: "RDL" },
              { name: "Dumbbell Walking Lunge", sets: 4, reps: "10-12 each", desc: "Lunges" },
              { name: "Machine Seated Leg Curl", sets: 4, reps: "12-15", desc: "Hamstrings" },
              { name: "Smith Machine Calf Raise", sets: 4, reps: "15-20", desc: "Calves" }
            ]
          },
          {
            id: "gym-lower-2",
            name: "Lower 2",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Machine"],
            exercises: [
              { name: "Barbell Front Squat", sets: 4, reps: "8-10", desc: "Front squat" },
              { name: "Barbell Hip Thrust", sets: 4, reps: "10-12", desc: "Glutes" },
              { name: "Seated Leg Press", sets: 4, reps: "10-12", desc: "Leg press" },
              { name: "Machine Single Leg Extension", sets: 4, reps: "12-15 each", desc: "Quads" },
              { name: "Machine Seated Single Leg Calf Raise", sets: 4, reps: "15-20 each", desc: "Calves" }
            ]
          },
          {
            id: "gym-lower-3",
            name: "Lower 3",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Machine"],
            exercises: [
              { name: "Barbell Back Squat", sets: 4, reps: "6-8", desc: "Heavy squats" },
              { name: "Barbell Romanian Deadlift", sets: 4, reps: "6-8", desc: "Heavy RDL" },
              { name: "Dumbbell Bulgarian Split Squat", sets: 4, reps: "8-10 each", desc: "Split squats" },
              { name: "Machine Seated Leg Curl", sets: 4, reps: "10-12", desc: "Hamstrings" },
              { name: "Smith Machine Calf Raise", sets: 4, reps: "12-15", desc: "Calves" }
            ]
          },
          {
            id: "gym-lower-4",
            name: "Lower 4",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells", "Machine"],
            exercises: [
              { name: "Dumbbell Goblet Squat", sets: 4, reps: "10-12", desc: "Goblet squat" },
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "10-12", desc: "RDL" },
              { name: "Seated Leg Press", sets: 4, reps: "10-12", desc: "Leg press" },
              { name: "Machine Seated Leg Curl", sets: 4, reps: "12-15", desc: "Hamstrings" },
              { name: "Machine Seated Single Leg Calf Raise", sets: 4, reps: "15-20 each", desc: "Calves" }
            ]
          },
          {
            id: "gym-lower-5",
            name: "Lower 5",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Machine", "Cable"],
            exercises: [
              { name: "Barbell Back Squat", sets: 4, reps: "10-12", desc: "Volume squats" },
              { name: "Cable Pull Through", sets: 4, reps: "12-15", desc: "Glute work" },
              { name: "Machine Sumo Leg Press", sets: 4, reps: "10-12", desc: "Wide press" },
              { name: "Machine Single Leg Extension", sets: 4, reps: "12-15 each", desc: "Quad isolation" },
              { name: "Smith Machine Calf Raise", sets: 4, reps: "15-20", desc: "Calves" }
            ]
          },
          {
            id: "gym-lower-6",
            name: "Lower 6",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Machine"],
            exercises: [
              { name: "Barbell Front Squat", sets: 4, reps: "6-8", desc: "Heavy front squat" },
              { name: "Barbell Hip Thrust", sets: 4, reps: "8-10", desc: "Heavy hip thrust" },
              { name: "Dumbbell Bulgarian Split Squat", sets: 4, reps: "8-10 each", desc: "Heavy split squat" },
              { name: "Machine Seated Leg Curl", sets: 4, reps: "10-12", desc: "Hamstrings" },
              { name: "Smith Machine Calf Raise", sets: 4, reps: "12-15", desc: "Calves" }
            ]
          },
          {
            id: "gym-lower-7",
            name: "Lower 7",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Dumbbells", "Machine"],
            exercises: [
              { name: "Barbell Back Squat", sets: 4, reps: "8-10", desc: "Squats" },
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "10-12", desc: "DB RDL" },
              { name: "Dumbbell Walking Lunge", sets: 4, reps: "10-12 each", desc: "Walking lunges" },
              { name: "Machine Single Leg Extension", sets: 4, reps: "12-15 each", desc: "Quads" },
              { name: "Machine Seated Single Leg Calf Raise", sets: 4, reps: "15-20 each", desc: "Calves" }
            ]
          },
          {
            id: "gym-lower-8",
            name: "Lower 8",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Machine"],
            exercises: [
              { name: "Barbell Hip Thrust", sets: 4, reps: "10-12", desc: "Glute focus" },
              { name: "Barbell Romanian Deadlift", sets: 4, reps: "10-12", desc: "Hamstrings" },
              { name: "Seated Leg Press", sets: 4, reps: "10-12", desc: "Leg press" },
              { name: "Machine Seated Leg Curl", sets: 4, reps: "12-15", desc: "Hamstring curl" },
              { name: "Smith Machine Calf Raise", sets: 4, reps: "15-20", desc: "Calves" }
            ]
          },
          {
            id: "gym-lower-9",
            name: "Lower 9",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Machine"],
            exercises: [
              { name: "Barbell Back Squat", sets: 4, reps: "6-8", desc: "Strength squats" },
              { name: "Barbell Front Squat", sets: 4, reps: "8-10", desc: "Front squats" },
              { name: "Machine Sumo Leg Press", sets: 4, reps: "8-10", desc: "Heavy press" },
              { name: "Machine Seated Leg Curl", sets: 4, reps: "10-12", desc: "Hamstrings" },
              { name: "Smith Machine Calf Raise", sets: 4, reps: "12-15", desc: "Calves" }
            ]
          },
          {
            id: "gym-lower-10",
            name: "Lower 10",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells", "Machine"],
            exercises: [
              { name: "Seated Leg Press", sets: 4, reps: "10-12", desc: "Leg press" },
              { name: "Dumbbell Goblet Squat", sets: 4, reps: "10-12", desc: "Goblet squat" },
              { name: "Dumbbell Walking Lunge", sets: 4, reps: "10-12 each", desc: "Lunges" },
              { name: "Machine Single Leg Extension", sets: 4, reps: "12-15 each", desc: "Quads" },
              { name: "Machine Seated Single Leg Calf Raise", sets: 4, reps: "15-20 each", desc: "Calves" }
            ]
          },
          {
            id: "gym-lower-11",
            name: "Lower 11",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Dumbbells", "Machine"],
            exercises: [
              { name: "Barbell Front Squat", sets: 4, reps: "8-10", desc: "Front squat" },
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "10-12", desc: "RDL" },
              { name: "Dumbbell Bulgarian Split Squat", sets: 4, reps: "10-12 each", desc: "Split squats" },
              { name: "Machine Seated Leg Curl", sets: 4, reps: "12-15", desc: "Hamstrings" },
              { name: "Smith Machine Calf Raise", sets: 4, reps: "15-20", desc: "Calves" }
            ]
          },
          {
            id: "gym-lower-12",
            name: "Lower 12",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Machine", "Cable"],
            exercises: [
              { name: "Barbell Back Squat", sets: 4, reps: "6-8", desc: "Heavy back squat" },
              { name: "Barbell Hip Thrust", sets: 4, reps: "8-10", desc: "Glute power" },
              { name: "Cable Pull Through", sets: 4, reps: "10-12", desc: "Hip hinge" },
              { name: "Machine Single Leg Extension", sets: 4, reps: "10-12 each", desc: "Quad burnout" },
              { name: "Smith Machine Calf Raise", sets: 4, reps: "12-15", desc: "Calves" }
            ]
          },
          {
            id: "gym-lower-13",
            name: "Lower 13",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Dumbbells", "Machine"],
            exercises: [
              { name: "Barbell Romanian Deadlift", sets: 4, reps: "8-10", desc: "RDL" },
              { name: "Barbell Back Squat", sets: 4, reps: "10-12", desc: "Squats" },
              { name: "Dumbbell Walking Lunge", sets: 4, reps: "10-12 each", desc: "Lunges" },
              { name: "Machine Seated Leg Curl", sets: 4, reps: "12-15", desc: "Hamstrings" },
              { name: "Machine Seated Single Leg Calf Raise", sets: 4, reps: "15-20 each", desc: "Calves" }
            ]
          },
          {
            id: "gym-lower-14",
            name: "Lower 14",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells", "Machine"],
            exercises: [
              { name: "Dumbbell Goblet Squat", sets: 4, reps: "10-12", desc: "Squat" },
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "10-12", desc: "RDL" },
              { name: "Seated Leg Press", sets: 4, reps: "10-12", desc: "Leg press" },
              { name: "Machine Single Leg Extension", sets: 4, reps: "12-15 each", desc: "Quads" },
              { name: "Machine Seated Single Leg Calf Raise", sets: 4, reps: "15-20 each", desc: "Calves" }
            ]
          },
          {
            id: "gym-lower-15",
            name: "Lower 15",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Machine"],
            exercises: [
              { name: "Barbell Front Squat", sets: 4, reps: "6-8", desc: "Heavy front squat" },
              { name: "Barbell Romanian Deadlift", sets: 4, reps: "6-8", desc: "Heavy RDL" },
              { name: "Dumbbell Bulgarian Split Squat", sets: 4, reps: "8-10 each", desc: "Heavy split squat" },
              { name: "Machine Seated Leg Curl", sets: 4, reps: "10-12", desc: "Hamstrings" },
              { name: "Smith Machine Calf Raise", sets: 4, reps: "12-15", desc: "Calves" }
            ]
          }
        ]
      }
    }
  },

  // ====================
  // AT HOME WITH WEIGHTS
  // ====================
  "home_weights": {
    name: "At Home with Weights",
    icon: "🏋️",
    description: "Effective workouts with dumbbells at home",
    subcategories: {

      "upper": {
        name: "Upper Body",
        description: "Build upper body strength at home",
        workouts: [
          {
            id: "home-upper-1",
            name: "Upper 1",
            duration: "40 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "10-12", desc: "Chest compound" },
              { name: "Dumbbell Bent Over Row", sets: 4, reps: "10-12", desc: "Back rows" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", desc: "Side delts" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "12-15", desc: "Biceps" }
            ]
          },
          {
            id: "home-upper-2",
            name: "Upper 2",
            duration: "40 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "10-12", desc: "Upper chest" },
              { name: "Dumbbell Single Arm Bent Over Row", sets: 4, reps: "10-12 each", desc: "Unilateral back" },
              { name: "Dumbbell Arnold Press", sets: 4, reps: "10-12", desc: "Arnold press" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "12-15", desc: "Rear delts" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "12-15", desc: "Triceps" }
            ]
          },
          {
            id: "home-upper-3",
            name: "Upper 3",
            duration: "40 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "8-10", desc: "Heavy chest" },
              { name: "Dumbbell Bent Over Row", sets: 4, reps: "8-10", desc: "Heavy rows" },
              { name: "Dumbbell Standing Shoulder Press", sets: 4, reps: "8-10", desc: "Standing press" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "10-12", desc: "Side delts" },
              { name: "Dumbbell Hammer Curl", sets: 4, reps: "10-12", desc: "Biceps" }
            ]
          },
          {
            id: "home-upper-4",
            name: "Upper 4",
            duration: "40 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Floor Press", sets: 4, reps: "10-12", desc: "Chest press" },
              { name: "Dumbbell Bent Over Row", sets: 4, reps: "10-12", desc: "Back work" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Dumbbell Front Raise", sets: 4, reps: "12-15", desc: "Front delts" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "12-15", desc: "Biceps" }
            ]
          },
          {
            id: "home-upper-5",
            name: "Upper 5",
            duration: "40 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "10-12", desc: "Incline chest" },
              { name: "Dumbbell Renegade Row", sets: 4, reps: "10-12 each", desc: "Core and back" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", desc: "Side delts" },
              { name: "Dumbbell Skull Crusher", sets: 4, reps: "12-15", desc: "Triceps" }
            ]
          },
          {
            id: "home-upper-6",
            name: "Upper 6",
            duration: "40 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "8-10", desc: "Chest strength" },
              { name: "Dumbbell Single Arm Bent Over Row", sets: 4, reps: "8-10 each", desc: "Heavy rows" },
              { name: "Dumbbell Arnold Press", sets: 4, reps: "8-10", desc: "Shoulders" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "10-12", desc: "Rear delts" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "10-12", desc: "Biceps" }
            ]
          },
          {
            id: "home-upper-7",
            name: "Upper 7",
            duration: "40 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Floor Press", sets: 4, reps: "10-12", desc: "Floor press" },
              { name: "Dumbbell Bent Over Row", sets: 4, reps: "10-12", desc: "Rows" },
              { name: "Dumbbell Standing Shoulder Press", sets: 4, reps: "10-12", desc: "Standing press" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", desc: "Side delts" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "12-15", desc: "Triceps" }
            ]
          },
          {
            id: "home-upper-8",
            name: "Upper 8",
            duration: "40 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "10-12", desc: "Chest" },
              { name: "Dumbbell Single Arm Bent Over Row", sets: 4, reps: "10-12 each", desc: "Single arm row" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Dumbbell Front Raise", sets: 4, reps: "12-15", desc: "Front delts" },
              { name: "Dumbbell Hammer Curl", sets: 4, reps: "12-15", desc: "Biceps" }
            ]
          },
          {
            id: "home-upper-9",
            name: "Upper 9",
            duration: "40 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "8-10", desc: "Heavy incline" },
              { name: "Dumbbell Bent Over Row", sets: 4, reps: "8-10", desc: "Heavy back" },
              { name: "Dumbbell Arnold Press", sets: 4, reps: "8-10", desc: "Arnold press" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "10-12", desc: "Side delts" },
              { name: "Dumbbell Skull Crusher", sets: 4, reps: "10-12", desc: "Triceps" }
            ]
          },
          {
            id: "home-upper-10",
            name: "Upper 10",
            duration: "40 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "10-12", desc: "Chest press" },
              { name: "Dumbbell Bent Over Row", sets: 4, reps: "10-12", desc: "Back rows" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "12-15", desc: "Rear delts" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "12-15", desc: "Biceps" }
            ]
          },
          {
            id: "home-upper-11",
            name: "Upper 11",
            duration: "40 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "10-12", desc: "Incline press" },
              { name: "Dumbbell Renegade Row", sets: 4, reps: "10-12 each", desc: "Renegade row" },
              { name: "Dumbbell Arnold Press", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", desc: "Side delts" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "12-15", desc: "Triceps" }
            ]
          },
          {
            id: "home-upper-12",
            name: "Upper 12",
            duration: "40 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "8-10", desc: "Power chest" },
              { name: "Dumbbell Single Arm Bent Over Row", sets: 4, reps: "8-10 each", desc: "Heavy single arm" },
              { name: "Dumbbell Standing Shoulder Press", sets: 4, reps: "8-10", desc: "Standing OHP" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "10-12", desc: "Rear delts" },
              { name: "Dumbbell Hammer Curl", sets: 4, reps: "10-12", desc: "Biceps" }
            ]
          },
          {
            id: "home-upper-13",
            name: "Upper 13",
            duration: "40 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Floor Press", sets: 4, reps: "10-12", desc: "Floor press" },
              { name: "Dumbbell Bent Over Row", sets: 4, reps: "10-12", desc: "Back rows" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Dumbbell Front Raise", sets: 4, reps: "12-15", desc: "Front delts" },
              { name: "Dumbbell Skull Crusher", sets: 4, reps: "12-15", desc: "Triceps" }
            ]
          },
          {
            id: "home-upper-14",
            name: "Upper 14",
            duration: "40 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "10-12", desc: "Incline chest" },
              { name: "Dumbbell Single Arm Bent Over Row", sets: 4, reps: "10-12 each", desc: "Single arm back" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", desc: "Side delts" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "12-15", desc: "Biceps" }
            ]
          },
          {
            id: "home-upper-15",
            name: "Upper 15",
            duration: "40 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "8-10", desc: "Heavy bench" },
              { name: "Dumbbell Bent Over Row", sets: 4, reps: "8-10", desc: "Heavy rows" },
              { name: "Dumbbell Arnold Press", sets: 4, reps: "8-10", desc: "Heavy Arnold" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "10-12", desc: "Side delts" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "10-12", desc: "Triceps" }
            ]
          }
        ]
      },

      "lower": {
        name: "Lower Body",
        description: "Build strong legs at home",
        workouts: [
          {
            id: "home-lower-1",
            name: "Lower 1",
            duration: "40 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Goblet Squat", sets: 4, reps: "10-12", desc: "Quad compound" },
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "10-12", desc: "Hamstrings" },
              { name: "Dumbbell Walking Lunge", sets: 4, reps: "10-12 each", desc: "Unilateral legs" },
              { name: "Dumbbell Hip Thrust", sets: 4, reps: "12-15", desc: "Glute isolation" },
              { name: "Dumbbell Calf Raise", sets: 4, reps: "15-20", desc: "Calves" }
            ]
          },
          {
            id: "home-lower-2",
            name: "Lower 2",
            duration: "40 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Front Squat", sets: 4, reps: "10-12", desc: "Quad focus" },
              { name: "Dumbbell Single Leg Deadlift", sets: 4, reps: "10-12 each", desc: "Unilateral hamstrings" },
              { name: "Dumbbell Reverse Lunge", sets: 4, reps: "10-12 each", desc: "Step back lunge" },
              { name: "Dumbbell Glute Bridge", sets: 4, reps: "12-15", desc: "Glute activation" },
              { name: "Dumbbell Single Leg Calf Raise", sets: 4, reps: "15-20 each", desc: "Unilateral calves" }
            ]
          },
          {
            id: "home-lower-3",
            name: "Lower 3",
            duration: "40 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Goblet Squat", sets: 4, reps: "8-10", desc: "Heavy squats" },
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "8-10", desc: "Heavy RDL" },
              { name: "Dumbbell Bulgarian Split Squat", sets: 4, reps: "8-10 each", desc: "Advanced split squat" },
              { name: "Dumbbell Hip Thrust", sets: 4, reps: "10-12", desc: "Glute power" },
              { name: "Dumbbell Calf Raise", sets: 4, reps: "12-15", desc: "Calves" }
            ]
          },
          {
            id: "home-lower-4",
            name: "Lower 4",
            duration: "40 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Goblet Squat", sets: 4, reps: "12-15", desc: "Beginner squat" },
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "12-15", desc: "Hamstrings" },
              { name: "Dumbbell Stationary Lunge", sets: 4, reps: "10-12 each", desc: "Basic lunge" },
              { name: "Dumbbell Glute Bridge", sets: 4, reps: "15-20", desc: "Glutes" },
              { name: "Dumbbell Calf Raise", sets: 4, reps: "15-20", desc: "Calves" }
            ]
          },
          {
            id: "home-lower-5",
            name: "Lower 5",
            duration: "40 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Sumo Squat", sets: 4, reps: "10-12", desc: "Wide stance squat" },
              { name: "Dumbbell Stiff Leg Deadlift", sets: 4, reps: "10-12", desc: "Hamstring stretch" },
              { name: "Dumbbell Walking Lunge", sets: 4, reps: "10-12 each", desc: "Walking lunge" },
              { name: "Dumbbell Hip Thrust", sets: 4, reps: "12-15", desc: "Glute focus" },
              { name: "Dumbbell Single Leg Calf Raise", sets: 4, reps: "15-20 each", desc: "Calves" }
            ]
          },
          {
            id: "home-lower-6",
            name: "Lower 6",
            duration: "40 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Front Squat", sets: 4, reps: "8-10", desc: "Heavy front squat" },
              { name: "Dumbbell Single Leg Deadlift", sets: 4, reps: "8-10 each", desc: "Heavy single leg" },
              { name: "Dumbbell Bulgarian Split Squat", sets: 4, reps: "8-10 each", desc: "Advanced unilateral" },
              { name: "Dumbbell Glute Bridge", sets: 4, reps: "10-12", desc: "Glute power" },
              { name: "Dumbbell Calf Raise", sets: 4, reps: "12-15", desc: "Calves" }
            ]
          },
          {
            id: "home-lower-7",
            name: "Lower 7",
            duration: "40 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Goblet Squat", sets: 4, reps: "10-12", desc: "Goblet squat" },
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "10-12", desc: "RDL" },
              { name: "Dumbbell Step Up", sets: 4, reps: "10-12 each", desc: "Step ups" },
              { name: "Dumbbell Hip Thrust", sets: 4, reps: "12-15", desc: "Glutes" },
              { name: "Dumbbell Seated Calf Raise", sets: 4, reps: "15-20", desc: "Seated calves" }
            ]
          },
          {
            id: "home-lower-8",
            name: "Lower 8",
            duration: "40 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Sumo Squat", sets: 4, reps: "10-12", desc: "Sumo squat" },
              { name: "Dumbbell Stiff Leg Deadlift", sets: 4, reps: "10-12", desc: "Stiff leg" },
              { name: "Dumbbell Reverse Lunge", sets: 4, reps: "10-12 each", desc: "Reverse lunge" },
              { name: "Dumbbell Glute Bridge", sets: 4, reps: "12-15", desc: "Glutes" },
              { name: "Dumbbell Single Leg Calf Raise", sets: 4, reps: "15-20 each", desc: "Single leg calf" }
            ]
          },
          {
            id: "home-lower-9",
            name: "Lower 9",
            duration: "40 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Goblet Squat", sets: 4, reps: "8-10", desc: "Power squats" },
              { name: "Dumbbell Single Leg Deadlift", sets: 4, reps: "8-10 each", desc: "Single leg RDL" },
              { name: "Dumbbell Walking Lunge", sets: 4, reps: "8-10 each", desc: "Heavy lunges" },
              { name: "Dumbbell Hip Thrust", sets: 4, reps: "10-12", desc: "Glute strength" },
              { name: "Dumbbell Calf Raise", sets: 4, reps: "12-15", desc: "Calves" }
            ]
          },
          {
            id: "home-lower-10",
            name: "Lower 10",
            duration: "40 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Front Squat", sets: 4, reps: "12-15", desc: "Front squat" },
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "12-15", desc: "Hamstrings" },
              { name: "Dumbbell Stationary Lunge", sets: 4, reps: "12-15 each", desc: "Stationary lunge" },
              { name: "Dumbbell Glute Bridge", sets: 4, reps: "15-20", desc: "Glutes" },
              { name: "Dumbbell Calf Raise", sets: 4, reps: "15-20", desc: "Calves" }
            ]
          },
          {
            id: "home-lower-11",
            name: "Lower 11",
            duration: "40 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Goblet Squat", sets: 4, reps: "10-12", desc: "Quad compound" },
              { name: "Dumbbell Stiff Leg Deadlift", sets: 4, reps: "10-12", desc: "Hamstring focus" },
              { name: "Dumbbell Bulgarian Split Squat", sets: 4, reps: "10-12 each", desc: "Split squat" },
              { name: "Dumbbell Hip Thrust", sets: 4, reps: "12-15", desc: "Glute isolation" },
              { name: "Dumbbell Single Leg Calf Raise", sets: 4, reps: "15-20 each", desc: "Calves" }
            ]
          },
          {
            id: "home-lower-12",
            name: "Lower 12",
            duration: "40 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Sumo Squat", sets: 4, reps: "8-10", desc: "Heavy sumo" },
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "8-10", desc: "Heavy RDL" },
              { name: "Dumbbell Step Up", sets: 4, reps: "8-10 each", desc: "Heavy step up" },
              { name: "Dumbbell Glute Bridge", sets: 4, reps: "10-12", desc: "Glute power" },
              { name: "Dumbbell Calf Raise", sets: 4, reps: "12-15", desc: "Calves" }
            ]
          },
          {
            id: "home-lower-13",
            name: "Lower 13",
            duration: "40 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Front Squat", sets: 4, reps: "10-12", desc: "Front squat" },
              { name: "Dumbbell Single Leg Deadlift", sets: 4, reps: "10-12 each", desc: "Single leg RDL" },
              { name: "Dumbbell Reverse Lunge", sets: 4, reps: "10-12 each", desc: "Reverse lunge" },
              { name: "Dumbbell Hip Thrust", sets: 4, reps: "12-15", desc: "Glutes" },
              { name: "Dumbbell Seated Calf Raise", sets: 4, reps: "15-20", desc: "Seated calf" }
            ]
          },
          {
            id: "home-lower-14",
            name: "Lower 14",
            duration: "40 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Goblet Squat", sets: 4, reps: "12-15", desc: "Beginner goblet" },
              { name: "Dumbbell Stiff Leg Deadlift", sets: 4, reps: "12-15", desc: "Hamstrings" },
              { name: "Dumbbell Walking Lunge", sets: 4, reps: "10-12 each", desc: "Walking lunge" },
              { name: "Dumbbell Glute Bridge", sets: 4, reps: "15-20", desc: "Glutes" },
              { name: "Dumbbell Calf Raise", sets: 4, reps: "15-20", desc: "Calves" }
            ]
          },
          {
            id: "home-lower-15",
            name: "Lower 15",
            duration: "40 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Sumo Squat", sets: 4, reps: "8-10", desc: "Power sumo" },
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "8-10", desc: "Heavy hamstrings" },
              { name: "Dumbbell Bulgarian Split Squat", sets: 4, reps: "8-10 each", desc: "Advanced split" },
              { name: "Dumbbell Hip Thrust", sets: 4, reps: "10-12", desc: "Glute strength" },
              { name: "Dumbbell Single Leg Calf Raise", sets: 4, reps: "12-15 each", desc: "Calves" }
            ]
          }
        ]
      },

      "fullbody": {
        name: "Full Body",
        description: "Complete dumbbell workouts",
        workouts: [
          {
            id: "home-fullbody-1",
            name: "Full Body 1",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Goblet Squat", sets: 4, reps: "10-12", desc: "Leg compound" },
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "10-12", desc: "Chest press" },
              { name: "Dumbbell Bent Over Row", sets: 4, reps: "10-12", desc: "Back rows" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "12-15", desc: "Biceps" }
            ]
          },
          {
            id: "home-fullbody-2",
            name: "Full Body 2",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "10-12", desc: "Posterior chain" },
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "10-12", desc: "Upper chest" },
              { name: "Dumbbell Single Arm Bent Over Row", sets: 4, reps: "10-12 each", desc: "Unilateral back" },
              { name: "Dumbbell Arnold Press", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "12-15", desc: "Triceps" }
            ]
          },
          {
            id: "home-fullbody-3",
            name: "Full Body 3",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Front Squat", sets: 4, reps: "8-10", desc: "Heavy quads" },
              { name: "Dumbbell Floor Press", sets: 4, reps: "8-10", desc: "Chest power" },
              { name: "Dumbbell Bent Over Row", sets: 4, reps: "8-10", desc: "Heavy back" },
              { name: "Dumbbell Standing Shoulder Press", sets: 4, reps: "8-10", desc: "Standing press" },
              { name: "Dumbbell Hammer Curl", sets: 4, reps: "10-12", desc: "Biceps" }
            ]
          },
          {
            id: "home-fullbody-4",
            name: "Full Body 4",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Goblet Squat", sets: 4, reps: "12-15", desc: "Beginner squat" },
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "12-15", desc: "Chest" },
              { name: "Dumbbell Bent Over Row", sets: 4, reps: "12-15", desc: "Back" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "12-15", desc: "Shoulders" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "15-20", desc: "Biceps" }
            ]
          },
          {
            id: "home-fullbody-5",
            name: "Full Body 5",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Walking Lunge", sets: 4, reps: "10-12 each", desc: "Legs" },
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "10-12", desc: "Chest" },
              { name: "Dumbbell Renegade Row", sets: 4, reps: "10-12 each", desc: "Core and back" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", desc: "Side delts" },
              { name: "Dumbbell Skull Crusher", sets: 4, reps: "12-15", desc: "Triceps" }
            ]
          },
          {
            id: "home-fullbody-6",
            name: "Full Body 6",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Bulgarian Split Squat", sets: 4, reps: "8-10 each", desc: "Advanced legs" },
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "8-10", desc: "Heavy chest" },
              { name: "Dumbbell Single Arm Bent Over Row", sets: 4, reps: "8-10 each", desc: "Heavy rows" },
              { name: "Dumbbell Arnold Press", sets: 4, reps: "8-10", desc: "Shoulders" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "10-12", desc: "Biceps" }
            ]
          },
          {
            id: "home-fullbody-7",
            name: "Full Body 7",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Sumo Squat", sets: 4, reps: "10-12", desc: "Inner thigh focus" },
              { name: "Dumbbell Floor Press", sets: 4, reps: "10-12", desc: "Chest" },
              { name: "Dumbbell Bent Over Row", sets: 4, reps: "10-12", desc: "Back" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "12-15", desc: "Triceps" }
            ]
          },
          {
            id: "home-fullbody-8",
            name: "Full Body 8",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Step Up", sets: 4, reps: "10-12 each", desc: "Step ups" },
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "10-12", desc: "Upper chest" },
              { name: "Dumbbell Single Arm Bent Over Row", sets: 4, reps: "10-12 each", desc: "Single arm row" },
              { name: "Dumbbell Front Raise", sets: 4, reps: "12-15", desc: "Front delts" },
              { name: "Dumbbell Hammer Curl", sets: 4, reps: "12-15", desc: "Biceps" }
            ]
          },
          {
            id: "home-fullbody-9",
            name: "Full Body 9",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Goblet Squat", sets: 4, reps: "8-10", desc: "Heavy goblet" },
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "8-10", desc: "Chest power" },
              { name: "Dumbbell Bent Over Row", sets: 4, reps: "8-10", desc: "Heavy back" },
              { name: "Dumbbell Standing Shoulder Press", sets: 4, reps: "8-10", desc: "OHP" },
              { name: "Dumbbell Skull Crusher", sets: 4, reps: "10-12", desc: "Triceps" }
            ]
          },
          {
            id: "home-fullbody-10",
            name: "Full Body 10",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Stationary Lunge", sets: 4, reps: "10-12 each", desc: "Basic lunges" },
              { name: "Dumbbell Floor Press", sets: 4, reps: "12-15", desc: "Floor press" },
              { name: "Dumbbell Bent Over Row", sets: 4, reps: "12-15", desc: "Back rows" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "12-15", desc: "Shoulders" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "15-20", desc: "Biceps" }
            ]
          },
          {
            id: "home-fullbody-11",
            name: "Full Body 11",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "10-12", desc: "Hamstrings" },
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "10-12", desc: "Chest" },
              { name: "Dumbbell Renegade Row", sets: 4, reps: "10-12 each", desc: "Core and back" },
              { name: "Dumbbell Arnold Press", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "12-15", desc: "Triceps" }
            ]
          },
          {
            id: "home-fullbody-12",
            name: "Full Body 12",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Front Squat", sets: 4, reps: "8-10", desc: "Front squat" },
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "8-10", desc: "Heavy bench" },
              { name: "Dumbbell Single Arm Bent Over Row", sets: 4, reps: "8-10 each", desc: "Heavy single arm" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "10-12", desc: "Side delts" },
              { name: "Dumbbell Hammer Curl", sets: 4, reps: "10-12", desc: "Biceps" }
            ]
          },
          {
            id: "home-fullbody-13",
            name: "Full Body 13",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Walking Lunge", sets: 4, reps: "10-12 each", desc: "Lunges" },
              { name: "Dumbbell Floor Press", sets: 4, reps: "10-12", desc: "Chest" },
              { name: "Dumbbell Bent Over Row", sets: 4, reps: "10-12", desc: "Back" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "12-15", desc: "Rear delts" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "12-15", desc: "Biceps" }
            ]
          },
          {
            id: "home-fullbody-14",
            name: "Full Body 14",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Goblet Squat", sets: 4, reps: "12-15", desc: "Goblet squat" },
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "12-15", desc: "Incline press" },
              { name: "Dumbbell Single Arm Bent Over Row", sets: 4, reps: "12-15 each", desc: "Single arm row" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "12-15", desc: "Shoulders" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "15-20", desc: "Triceps" }
            ]
          },
          {
            id: "home-fullbody-15",
            name: "Full Body 15",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Bulgarian Split Squat", sets: 4, reps: "8-10 each", desc: "Advanced unilateral" },
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "8-10", desc: "Power chest" },
              { name: "Dumbbell Bent Over Row", sets: 4, reps: "8-10", desc: "Heavy rows" },
              { name: "Dumbbell Standing Shoulder Press", sets: 4, reps: "8-10", desc: "Standing OHP" },
              { name: "Dumbbell Skull Crusher", sets: 4, reps: "10-12", desc: "Triceps" }
            ]
          }
        ]
      },

      "arms": {
        name: "Arms",
        description: "Build strong arms at home",
        workouts: [
          {
            id: "home-arms-1",
            name: "Arms 1",
            duration: "35 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Close Grip Press", sets: 4, reps: "10-12", desc: "Tricep compound" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "10-12", desc: "Bicep mass" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "10-12", desc: "Tricep long head" },
              { name: "Dumbbell Hammer Curl", sets: 4, reps: "12-15", desc: "Brachialis" },
              { name: "Dumbbell Tricep Kickback", sets: 4, reps: "12-15", desc: "Tricep isolation" }
            ]
          },
          {
            id: "home-arms-2",
            name: "Arms 2",
            duration: "35 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Skull Crusher", sets: 4, reps: "10-12", desc: "Tricep compound" },
              { name: "Dumbbell Alternating Bicep Curl", sets: 4, reps: "10-12 each", desc: "Alternating curls" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "10-12", desc: "Long head" },
              { name: "Dumbbell Concentration Curl", sets: 4, reps: "12-15 each", desc: "Peak bicep" },
              { name: "Dumbbell Tricep Kickback", sets: 4, reps: "12-15 each", desc: "Tricep finisher" }
            ]
          },
          {
            id: "home-arms-3",
            name: "Arms 3",
            duration: "35 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Close Grip Press", sets: 4, reps: "8-10", desc: "Heavy tricep" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "8-10", desc: "Heavy bicep" },
              { name: "Dumbbell Skull Crusher", sets: 4, reps: "8-10", desc: "Tricep power" },
              { name: "Dumbbell Hammer Curl", sets: 4, reps: "10-12", desc: "Brachialis" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "10-12", desc: "Long head" }
            ]
          },
          {
            id: "home-arms-4",
            name: "Arms 4",
            duration: "35 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "12-15", desc: "Tricep basics" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "12-15", desc: "Basic curls" },
              { name: "Dumbbell Tricep Kickback", sets: 4, reps: "12-15 each", desc: "Tricep isolation" },
              { name: "Dumbbell Hammer Curl", sets: 4, reps: "12-15", desc: "Hammer curls" },
              { name: "Dumbbell Concentration Curl", sets: 4, reps: "15-20 each", desc: "Bicep finisher" }
            ]
          },
          {
            id: "home-arms-5",
            name: "Arms 5",
            duration: "35 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Skull Crusher", sets: 4, reps: "10-12", desc: "Tricep compound" },
              { name: "Dumbbell Zottman Curl", sets: 4, reps: "10-12", desc: "Bicep and forearm" },
              { name: "Dumbbell Close Grip Press", sets: 4, reps: "10-12", desc: "Tricep press" },
              { name: "Dumbbell Alternating Bicep Curl", sets: 4, reps: "12-15 each", desc: "Alternating" },
              { name: "Dumbbell Tricep Kickback", sets: 4, reps: "12-15 each", desc: "Finisher" }
            ]
          },
          {
            id: "home-arms-6",
            name: "Arms 6",
            duration: "35 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Close Grip Press", sets: 4, reps: "8-10", desc: "Power tricep" },
              { name: "Dumbbell Preacher Curl", sets: 4, reps: "8-10", desc: "Strict bicep" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "8-10", desc: "Heavy long head" },
              { name: "Dumbbell Hammer Curl", sets: 4, reps: "10-12", desc: "Brachialis" },
              { name: "Dumbbell Skull Crusher", sets: 4, reps: "10-12", desc: "Tricep finisher" }
            ]
          },
          {
            id: "home-arms-7",
            name: "Arms 7",
            duration: "35 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "10-12", desc: "Long head" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "10-12", desc: "Biceps" },
              { name: "Dumbbell Tricep Kickback", sets: 4, reps: "10-12 each", desc: "Tricep isolation" },
              { name: "Dumbbell Concentration Curl", sets: 4, reps: "12-15 each", desc: "Peak" },
              { name: "Dumbbell Close Grip Press", sets: 4, reps: "12-15", desc: "Tricep finisher" }
            ]
          },
          {
            id: "home-arms-8",
            name: "Arms 8",
            duration: "35 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Skull Crusher", sets: 4, reps: "10-12", desc: "Tricep compound" },
              { name: "Dumbbell Alternating Bicep Curl", sets: 4, reps: "10-12 each", desc: "Alternating" },
              { name: "Dumbbell Close Grip Press", sets: 4, reps: "10-12", desc: "Tricep press" },
              { name: "Dumbbell Hammer Curl", sets: 4, reps: "12-15", desc: "Brachialis" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "12-15", desc: "Long head" }
            ]
          },
          {
            id: "home-arms-9",
            name: "Arms 9",
            duration: "35 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Close Grip Press", sets: 4, reps: "8-10", desc: "Heavy press" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "8-10", desc: "Heavy curls" },
              { name: "Dumbbell Skull Crusher", sets: 4, reps: "8-10", desc: "Heavy skull crush" },
              { name: "Dumbbell Zottman Curl", sets: 4, reps: "10-12", desc: "Zottman" },
              { name: "Dumbbell Tricep Kickback", sets: 4, reps: "10-12 each", desc: "Tricep finisher" }
            ]
          },
          {
            id: "home-arms-10",
            name: "Arms 10",
            duration: "35 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "12-15", desc: "Tricep" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "12-15", desc: "Bicep" },
              { name: "Dumbbell Skull Crusher", sets: 4, reps: "12-15", desc: "Skull crush" },
              { name: "Dumbbell Hammer Curl", sets: 4, reps: "15-20", desc: "Hammer" },
              { name: "Dumbbell Tricep Kickback", sets: 4, reps: "15-20 each", desc: "Kickback" }
            ]
          },
          {
            id: "home-arms-11",
            name: "Arms 11",
            duration: "35 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Close Grip Press", sets: 4, reps: "10-12", desc: "Tricep compound" },
              { name: "Dumbbell Preacher Curl", sets: 4, reps: "10-12", desc: "Strict bicep" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "10-12", desc: "Long head" },
              { name: "Dumbbell Alternating Bicep Curl", sets: 4, reps: "12-15 each", desc: "Alternating" },
              { name: "Dumbbell Tricep Kickback", sets: 4, reps: "12-15 each", desc: "Isolation" }
            ]
          },
          {
            id: "home-arms-12",
            name: "Arms 12",
            duration: "35 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Skull Crusher", sets: 4, reps: "8-10", desc: "Heavy skulls" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "8-10", desc: "Heavy bicep" },
              { name: "Dumbbell Close Grip Press", sets: 4, reps: "8-10", desc: "Heavy press" },
              { name: "Dumbbell Hammer Curl", sets: 4, reps: "10-12", desc: "Brachialis" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "10-12", desc: "Finisher" }
            ]
          },
          {
            id: "home-arms-13",
            name: "Arms 13",
            duration: "35 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "10-12", desc: "Long head" },
              { name: "Dumbbell Zottman Curl", sets: 4, reps: "10-12", desc: "Zottman" },
              { name: "Dumbbell Tricep Kickback", sets: 4, reps: "10-12 each", desc: "Kickback" },
              { name: "Dumbbell Concentration Curl", sets: 4, reps: "12-15 each", desc: "Peak" },
              { name: "Dumbbell Close Grip Press", sets: 4, reps: "12-15", desc: "Press" }
            ]
          },
          {
            id: "home-arms-14",
            name: "Arms 14",
            duration: "35 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Skull Crusher", sets: 4, reps: "12-15", desc: "Skull crush" },
              { name: "Dumbbell Alternating Bicep Curl", sets: 4, reps: "12-15 each", desc: "Alternating" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "12-15", desc: "Overhead" },
              { name: "Dumbbell Hammer Curl", sets: 4, reps: "15-20", desc: "Hammer" },
              { name: "Dumbbell Tricep Kickback", sets: 4, reps: "15-20 each", desc: "Finisher" }
            ]
          },
          {
            id: "home-arms-15",
            name: "Arms 15",
            duration: "35 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Close Grip Press", sets: 4, reps: "8-10", desc: "Power press" },
              { name: "Dumbbell Preacher Curl", sets: 4, reps: "8-10", desc: "Strict curl" },
              { name: "Dumbbell Skull Crusher", sets: 4, reps: "8-10", desc: "Heavy tricep" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "10-12", desc: "Bicep" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "10-12", desc: "Long head" }
            ]
          }
        ]
      },

      "shoulders": {
        name: "Shoulders",
        description: "Build strong shoulders at home",
        workouts: [
          {
            id: "home-shoulders-1",
            name: "Shoulders 1",
            duration: "35 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Shoulder compound" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", desc: "Side delts" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "12-15", desc: "Rear delts" },
              { name: "Dumbbell Front Raise", sets: 4, reps: "12-15", desc: "Front delts" },
              { name: "Dumbbell Shrug", sets: 4, reps: "12-15", desc: "Traps" }
            ]
          },
          {
            id: "home-shoulders-2",
            name: "Shoulders 2",
            duration: "35 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Arnold Press", sets: 4, reps: "10-12", desc: "Arnold press" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", desc: "Side delts" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "12-15", desc: "Rear delts" },
              { name: "Dumbbell Front Raise", sets: 4, reps: "12-15", desc: "Front delts" },
              { name: "Dumbbell Upright Row", sets: 4, reps: "12-15", desc: "Overall shoulder" }
            ]
          },
          {
            id: "home-shoulders-3",
            name: "Shoulders 3",
            duration: "35 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Standing Shoulder Press", sets: 4, reps: "8-10", desc: "Heavy press" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "10-12", desc: "Side delts" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "10-12", desc: "Rear delts" },
              { name: "Dumbbell Front Raise", sets: 4, reps: "10-12", desc: "Front delts" },
              { name: "Dumbbell Shrug", sets: 4, reps: "10-12", desc: "Heavy traps" }
            ]
          },
          {
            id: "home-shoulders-4",
            name: "Shoulders 4",
            duration: "35 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "12-15", desc: "Beginner press" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "15-20", desc: "Side delts" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "15-20", desc: "Rear delts" },
              { name: "Dumbbell Front Raise", sets: 4, reps: "15-20", desc: "Front delts" },
              { name: "Dumbbell Shrug", sets: 4, reps: "15-20", desc: "Traps" }
            ]
          },
          {
            id: "home-shoulders-5",
            name: "Shoulders 5",
            duration: "35 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Arnold Press", sets: 4, reps: "10-12", desc: "Arnold press" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", desc: "Side delts" },
              { name: "Dumbbell Face Pull", sets: 4, reps: "12-15", desc: "Rear delts" },
              { name: "Dumbbell Front Raise", sets: 4, reps: "12-15", desc: "Front delts" },
              { name: "Dumbbell Upright Row", sets: 4, reps: "12-15", desc: "Traps and delts" }
            ]
          },
          {
            id: "home-shoulders-6",
            name: "Shoulders 6",
            duration: "35 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Standing Shoulder Press", sets: 4, reps: "8-10", desc: "Power press" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "10-12", desc: "Side delts" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "10-12", desc: "Rear delts" },
              { name: "Dumbbell Front Raise", sets: 4, reps: "10-12", desc: "Front delts" },
              { name: "Dumbbell Upright Row", sets: 4, reps: "10-12", desc: "Heavy rows" }
            ]
          },
          {
            id: "home-shoulders-7",
            name: "Shoulders 7",
            duration: "35 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Seated press" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", desc: "Side delts" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "12-15", desc: "Rear delts" },
              { name: "Dumbbell Front Raise", sets: 4, reps: "12-15", desc: "Front delts" },
              { name: "Dumbbell Shrug", sets: 4, reps: "12-15", desc: "Traps" }
            ]
          },
          {
            id: "home-shoulders-8",
            name: "Shoulders 8",
            duration: "35 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Arnold Press", sets: 4, reps: "10-12", desc: "Arnold" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", desc: "Lateral" },
              { name: "Dumbbell Face Pull", sets: 4, reps: "12-15", desc: "Face pull" },
              { name: "Dumbbell Front Raise", sets: 4, reps: "12-15", desc: "Front" },
              { name: "Dumbbell Shrug", sets: 4, reps: "12-15", desc: "Traps" }
            ]
          },
          {
            id: "home-shoulders-9",
            name: "Shoulders 9",
            duration: "35 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Standing Shoulder Press", sets: 4, reps: "8-10", desc: "Standing OHP" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "10-12", desc: "Side delts" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "10-12", desc: "Rear delts" },
              { name: "Dumbbell Front Raise", sets: 4, reps: "10-12", desc: "Front delts" },
              { name: "Dumbbell Upright Row", sets: 4, reps: "10-12", desc: "Upright row" }
            ]
          },
          {
            id: "home-shoulders-10",
            name: "Shoulders 10",
            duration: "35 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "12-15", desc: "Press" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "15-20", desc: "Lateral" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "15-20", desc: "Rear" },
              { name: "Dumbbell Front Raise", sets: 4, reps: "15-20", desc: "Front" },
              { name: "Dumbbell Upright Row", sets: 4, reps: "15-20", desc: "Upright" }
            ]
          },
          {
            id: "home-shoulders-11",
            name: "Shoulders 11",
            duration: "35 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Arnold Press", sets: 4, reps: "10-12", desc: "Arnold press" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", desc: "Side delts" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "12-15", desc: "Rear delts" },
              { name: "Dumbbell Front Raise", sets: 4, reps: "12-15", desc: "Front delts" },
              { name: "Dumbbell Shrug", sets: 4, reps: "12-15", desc: "Traps" }
            ]
          },
          {
            id: "home-shoulders-12",
            name: "Shoulders 12",
            duration: "35 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Standing Shoulder Press", sets: 4, reps: "8-10", desc: "Heavy OHP" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "10-12", desc: "Lateral raise" },
              { name: "Dumbbell Face Pull", sets: 4, reps: "10-12", desc: "Face pull" },
              { name: "Dumbbell Front Raise", sets: 4, reps: "10-12", desc: "Front raise" },
              { name: "Dumbbell Upright Row", sets: 4, reps: "10-12", desc: "Upright row" }
            ]
          },
          {
            id: "home-shoulders-13",
            name: "Shoulders 13",
            duration: "35 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10-12", desc: "Seated OHP" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", desc: "Side delts" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "12-15", desc: "Rear delts" },
              { name: "Dumbbell Front Raise", sets: 4, reps: "12-15", desc: "Front delts" },
              { name: "Dumbbell Upright Row", sets: 4, reps: "12-15", desc: "Traps" }
            ]
          },
          {
            id: "home-shoulders-14",
            name: "Shoulders 14",
            duration: "35 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Arnold Press", sets: 4, reps: "12-15", desc: "Arnold" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "15-20", desc: "Lateral" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "15-20", desc: "Rear" },
              { name: "Dumbbell Front Raise", sets: 4, reps: "15-20", desc: "Front" },
              { name: "Dumbbell Shrug", sets: 4, reps: "15-20", desc: "Shrugs" }
            ]
          },
          {
            id: "home-shoulders-15",
            name: "Shoulders 15",
            duration: "35 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Standing Shoulder Press", sets: 4, reps: "8-10", desc: "Power press" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "10-12", desc: "Side delts" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "10-12", desc: "Rear delts" },
              { name: "Dumbbell Front Raise", sets: 4, reps: "10-12", desc: "Front delts" },
              { name: "Dumbbell Shrug", sets: 4, reps: "10-12", desc: "Heavy traps" }
            ]
          }
        ]
      }
    }
  },

  // ====================
  // AT HOME BODYWEIGHT
  // ====================
  "bodyweight": {
    name: "At Home Bodyweight",
    icon: "💪",
    description: "No equipment needed",
    subcategories: {

      "upper": {
        name: "Upper Body",
        description: "Build upper body with bodyweight",
        workouts: [
          {
            id: "bw-upper-1",
            name: "Upper 1",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Push Up", sets: 4, reps: "12-15", desc: "Chest compound" },
              { name: "Pike Push Up", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Diamond Push Up", sets: 4, reps: "10-12", desc: "Triceps" },
              { name: "Plank Shoulder Tap", sets: 4, reps: "12-15 each", desc: "Core and delts" },
              { name: "Tricep Dip", sets: 4, reps: "12-15", desc: "Tricep isolation" }
            ]
          },
          {
            id: "bw-upper-2",
            name: "Upper 2",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Wide Grip Push Up", sets: 4, reps: "12-15", desc: "Wide chest" },
              { name: "Pike Push Up", sets: 4, reps: "10-12", desc: "Shoulder press" },
              { name: "Close Grip Push Up", sets: 4, reps: "10-12", desc: "Tricep focus" },
              { name: "Push Up to T-rotation", sets: 4, reps: "10-12 each", desc: "Chest and core" },
              { name: "Plank", sets: 4, reps: "45-60 sec", desc: "Core finisher" }
            ]
          },
          {
            id: "bw-upper-3",
            name: "Upper 3",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "Decline Push Up", sets: 4, reps: "10-12", desc: "Upper chest" },
              { name: "Pike Push Up", sets: 4, reps: "8-10", desc: "Heavy shoulders" },
              { name: "Diamond Push Up", sets: 4, reps: "8-10", desc: "Tricep power" },
              { name: "Archer Push Up", sets: 4, reps: "8-10 each", desc: "Unilateral chest" },
              { name: "Tricep Dip", sets: 4, reps: "10-12", desc: "Triceps" }
            ]
          },
          {
            id: "bw-upper-4",
            name: "Upper 4",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["None"],
            exercises: [
              { name: "Incline Push Up", sets: 4, reps: "12-15", desc: "Beginner push" },
              { name: "Pike Push Up", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Push Up", sets: 4, reps: "10-12", desc: "Standard push" },
              { name: "Plank", sets: 4, reps: "30-45 sec", desc: "Core stability" },
              { name: "Tricep Dip", sets: 4, reps: "12-15", desc: "Triceps" }
            ]
          },
          {
            id: "bw-upper-5",
            name: "Upper 5",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Push Up", sets: 4, reps: "12-15", desc: "Chest" },
              { name: "Pike Push Up", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Close Grip Push Up", sets: 4, reps: "10-12", desc: "Triceps" },
              { name: "Plank Shoulder Tap", sets: 4, reps: "12-15 each", desc: "Core and delts" },
              { name: "Tricep Dip", sets: 4, reps: "12-15", desc: "Tricep finisher" }
            ]
          },
          {
            id: "bw-upper-6",
            name: "Upper 6",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "Wide Grip Push Up", sets: 4, reps: "10-12", desc: "Wide chest" },
              { name: "Pike Push Up", sets: 4, reps: "8-10", desc: "Heavy shoulders" },
              { name: "Diamond Push Up", sets: 4, reps: "8-10", desc: "Tricep power" },
              { name: "Push Up to T-rotation", sets: 4, reps: "8-10 each", desc: "Rotation" },
              { name: "Plank", sets: 4, reps: "60 sec", desc: "Core endurance" }
            ]
          },
          {
            id: "bw-upper-7",
            name: "Upper 7",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Decline Push Up", sets: 4, reps: "10-12", desc: "Upper chest" },
              { name: "Pike Push Up", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Close Grip Push Up", sets: 4, reps: "10-12", desc: "Triceps" },
              { name: "Plank Shoulder Tap", sets: 4, reps: "12-15 each", desc: "Shoulder taps" },
              { name: "Tricep Dip", sets: 4, reps: "12-15", desc: "Tricep isolation" }
            ]
          },
          {
            id: "bw-upper-8",
            name: "Upper 8",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Push Up", sets: 4, reps: "12-15", desc: "Standard" },
              { name: "Pike Push Up", sets: 4, reps: "10-12", desc: "Pike" },
              { name: "Diamond Push Up", sets: 4, reps: "10-12", desc: "Diamond" },
              { name: "Push Up to T-rotation", sets: 4, reps: "10-12 each", desc: "T-rotation" },
              { name: "Plank", sets: 4, reps: "45-60 sec", desc: "Plank" }
            ]
          },
          {
            id: "bw-upper-9",
            name: "Upper 9",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "Archer Push Up", sets: 4, reps: "8-10 each", desc: "Unilateral chest" },
              { name: "Pike Push Up", sets: 4, reps: "8-10", desc: "Heavy pike" },
              { name: "Close Grip Push Up", sets: 4, reps: "8-10", desc: "Tricep power" },
              { name: "Plank Shoulder Tap", sets: 4, reps: "10-12 each", desc: "Core power" },
              { name: "Tricep Dip", sets: 4, reps: "10-12", desc: "Triceps" }
            ]
          },
          {
            id: "bw-upper-10",
            name: "Upper 10",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["None"],
            exercises: [
              { name: "Incline Push Up", sets: 4, reps: "12-15", desc: "Incline" },
              { name: "Pike Push Up", sets: 4, reps: "10-12", desc: "Pike" },
              { name: "Push Up", sets: 4, reps: "10-12", desc: "Standard" },
              { name: "Plank Shoulder Tap", sets: 4, reps: "10-12 each", desc: "Taps" },
              { name: "Tricep Dip", sets: 4, reps: "12-15", desc: "Dips" }
            ]
          },
          {
            id: "bw-upper-11",
            name: "Upper 11",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Wide Grip Push Up", sets: 4, reps: "12-15", desc: "Wide" },
              { name: "Pike Push Up", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Diamond Push Up", sets: 4, reps: "10-12", desc: "Triceps" },
              { name: "Plank", sets: 4, reps: "45-60 sec", desc: "Core" },
              { name: "Tricep Dip", sets: 4, reps: "12-15", desc: "Dips" }
            ]
          },
          {
            id: "bw-upper-12",
            name: "Upper 12",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "Decline Push Up", sets: 4, reps: "10-12", desc: "Decline" },
              { name: "Pike Push Up", sets: 4, reps: "8-10", desc: "Heavy pike" },
              { name: "Close Grip Push Up", sets: 4, reps: "8-10", desc: "Close grip" },
              { name: "Push Up to T-rotation", sets: 4, reps: "8-10 each", desc: "Rotation" },
              { name: "Plank Shoulder Tap", sets: 4, reps: "10-12 each", desc: "Taps" }
            ]
          },
          {
            id: "bw-upper-13",
            name: "Upper 13",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Push Up", sets: 4, reps: "12-15", desc: "Chest" },
              { name: "Pike Push Up", sets: 4, reps: "10-12", desc: "Pike" },
              { name: "Diamond Push Up", sets: 4, reps: "10-12", desc: "Diamond" },
              { name: "Plank Shoulder Tap", sets: 4, reps: "12-15 each", desc: "Shoulder taps" },
              { name: "Tricep Dip", sets: 4, reps: "12-15", desc: "Triceps" }
            ]
          },
          {
            id: "bw-upper-14",
            name: "Upper 14",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["None"],
            exercises: [
              { name: "Incline Push Up", sets: 4, reps: "12-15", desc: "Beginner chest" },
              { name: "Pike Push Up", sets: 4, reps: "10-12", desc: "Beginner shoulders" },
              { name: "Close Grip Push Up", sets: 4, reps: "10-12", desc: "Triceps" },
              { name: "Plank", sets: 4, reps: "30-45 sec", desc: "Core" },
              { name: "Tricep Dip", sets: 4, reps: "12-15", desc: "Dips" }
            ]
          },
          {
            id: "bw-upper-15",
            name: "Upper 15",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "Archer Push Up", sets: 4, reps: "8-10 each", desc: "Advanced chest" },
              { name: "Pike Push Up", sets: 4, reps: "8-10", desc: "Power shoulders" },
              { name: "Diamond Push Up", sets: 4, reps: "8-10", desc: "Tricep power" },
              { name: "Push Up to T-rotation", sets: 4, reps: "8-10 each", desc: "Rotation" },
              { name: "Plank", sets: 4, reps: "60 sec", desc: "Core endurance" }
            ]
          }
        ]
      },

      "lower": {
        name: "Lower Body",
        description: "Bodyweight leg workouts",
        workouts: [
          {
            id: "bw-lower-1",
            name: "Lower 1",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Air Squat", sets: 4, reps: "15-20", desc: "Quad compound" },
              { name: "Reverse Lunge", sets: 4, reps: "12-15 each", desc: "Unilateral legs" },
              { name: "Glute Bridge", sets: 4, reps: "15-20", desc: "Glute activation" },
              { name: "Wall Sit", sets: 4, reps: "45-60 sec", desc: "Quad endurance" },
              { name: "Calf Raise", sets: 4, reps: "20-25", desc: "Calves" }
            ]
          },
          {
            id: "bw-lower-2",
            name: "Lower 2",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Sumo Squat", sets: 4, reps: "15-20", desc: "Inner thigh" },
              { name: "Walking Lunge", sets: 4, reps: "12-15 each", desc: "Walking lunge" },
              { name: "Single Leg Glute Bridge", sets: 4, reps: "12-15 each", desc: "Unilateral glute" },
              { name: "Step Up", sets: 4, reps: "12-15 each", desc: "Step ups" },
              { name: "Single Leg Calf Raise", sets: 4, reps: "15-20 each", desc: "Calves" }
            ]
          },
          {
            id: "bw-lower-3",
            name: "Lower 3",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "Jump Squat", sets: 4, reps: "12-15", desc: "Explosive squats" },
              { name: "Bulgarian Split Squat", sets: 4, reps: "10-12 each", desc: "Split squat" },
              { name: "Glute Bridge", sets: 4, reps: "15-20", desc: "Glutes" },
              { name: "Lateral Lunge", sets: 4, reps: "10-12 each", desc: "Lateral" },
              { name: "Calf Raise", sets: 4, reps: "20-25", desc: "Calves" }
            ]
          },
          {
            id: "bw-lower-4",
            name: "Lower 4",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["None"],
            exercises: [
              { name: "Air Squat", sets: 4, reps: "12-15", desc: "Basic squat" },
              { name: "Stationary Lunge", sets: 4, reps: "10-12 each", desc: "Stationary" },
              { name: "Glute Bridge", sets: 4, reps: "15-20", desc: "Glute bridge" },
              { name: "Wall Sit", sets: 4, reps: "30-45 sec", desc: "Wall sit" },
              { name: "Calf Raise", sets: 4, reps: "15-20", desc: "Calves" }
            ]
          },
          {
            id: "bw-lower-5",
            name: "Lower 5",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Sumo Squat", sets: 4, reps: "15-20", desc: "Sumo" },
              { name: "Reverse Lunge", sets: 4, reps: "12-15 each", desc: "Reverse lunge" },
              { name: "Single Leg Glute Bridge", sets: 4, reps: "12-15 each", desc: "Single leg bridge" },
              { name: "Step Up", sets: 4, reps: "12-15 each", desc: "Steps" },
              { name: "Single Leg Calf Raise", sets: 4, reps: "15-20 each", desc: "Single calf" }
            ]
          },
          {
            id: "bw-lower-6",
            name: "Lower 6",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "Jumping Split Squat", sets: 4, reps: "10-12 each", desc: "Explosive lunges" },
              { name: "Bulgarian Split Squat", sets: 4, reps: "10-12 each", desc: "Bulgarian" },
              { name: "Glute Bridge", sets: 4, reps: "15-20", desc: "Glutes" },
              { name: "Lateral Lunge", sets: 4, reps: "10-12 each", desc: "Lateral" },
              { name: "Calf Raise", sets: 4, reps: "20-25", desc: "Calves" }
            ]
          },
          {
            id: "bw-lower-7",
            name: "Lower 7",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Air Squat", sets: 4, reps: "15-20", desc: "Squats" },
              { name: "Walking Lunge", sets: 4, reps: "12-15 each", desc: "Walking" },
              { name: "Glute Bridge", sets: 4, reps: "15-20", desc: "Bridge" },
              { name: "Wall Sit", sets: 4, reps: "45-60 sec", desc: "Wall sit" },
              { name: "Single Leg Calf Raise", sets: 4, reps: "15-20 each", desc: "Calves" }
            ]
          },
          {
            id: "bw-lower-8",
            name: "Lower 8",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Sumo Squat", sets: 4, reps: "15-20", desc: "Sumo squat" },
              { name: "Reverse Lunge", sets: 4, reps: "12-15 each", desc: "Reverse" },
              { name: "Single Leg Glute Bridge", sets: 4, reps: "12-15 each", desc: "Single bridge" },
              { name: "Step Up", sets: 4, reps: "12-15 each", desc: "Step up" },
              { name: "Calf Raise", sets: 4, reps: "20-25", desc: "Calves" }
            ]
          },
          {
            id: "bw-lower-9",
            name: "Lower 9",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "Jump Squat", sets: 4, reps: "12-15", desc: "Jump squat" },
              { name: "Bulgarian Split Squat", sets: 4, reps: "10-12 each", desc: "Bulgarian" },
              { name: "Glute Bridge", sets: 4, reps: "15-20", desc: "Glutes" },
              { name: "Lateral Lunge", sets: 4, reps: "10-12 each", desc: "Lateral lunge" },
              { name: "Single Leg Calf Raise", sets: 4, reps: "15-20 each", desc: "Calves" }
            ]
          },
          {
            id: "bw-lower-10",
            name: "Lower 10",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["None"],
            exercises: [
              { name: "Air Squat", sets: 4, reps: "12-15", desc: "Air squat" },
              { name: "Stationary Lunge", sets: 4, reps: "10-12 each", desc: "Lunge" },
              { name: "Glute Bridge", sets: 4, reps: "15-20", desc: "Bridge" },
              { name: "Wall Sit", sets: 4, reps: "30-45 sec", desc: "Wall" },
              { name: "Calf Raise", sets: 4, reps: "15-20", desc: "Calves" }
            ]
          },
          {
            id: "bw-lower-11",
            name: "Lower 11",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Sumo Squat", sets: 4, reps: "15-20", desc: "Sumo" },
              { name: "Walking Lunge", sets: 4, reps: "12-15 each", desc: "Walking" },
              { name: "Single Leg Glute Bridge", sets: 4, reps: "12-15 each", desc: "Single bridge" },
              { name: "Step Up", sets: 4, reps: "12-15 each", desc: "Steps" },
              { name: "Calf Raise", sets: 4, reps: "20-25", desc: "Calves" }
            ]
          },
          {
            id: "bw-lower-12",
            name: "Lower 12",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "Jumping Split Squat", sets: 4, reps: "10-12 each", desc: "Jumping lunge" },
              { name: "Bulgarian Split Squat", sets: 4, reps: "10-12 each", desc: "Bulgarian" },
              { name: "Glute Bridge", sets: 4, reps: "15-20", desc: "Bridge" },
              { name: "Lateral Lunge", sets: 4, reps: "10-12 each", desc: "Lateral" },
              { name: "Single Leg Calf Raise", sets: 4, reps: "15-20 each", desc: "Single calf" }
            ]
          },
          {
            id: "bw-lower-13",
            name: "Lower 13",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Air Squat", sets: 4, reps: "15-20", desc: "Squat" },
              { name: "Reverse Lunge", sets: 4, reps: "12-15 each", desc: "Reverse" },
              { name: "Glute Bridge", sets: 4, reps: "15-20", desc: "Glutes" },
              { name: "Wall Sit", sets: 4, reps: "45-60 sec", desc: "Wall" },
              { name: "Calf Raise", sets: 4, reps: "20-25", desc: "Calves" }
            ]
          },
          {
            id: "bw-lower-14",
            name: "Lower 14",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["None"],
            exercises: [
              { name: "Sumo Squat", sets: 4, reps: "12-15", desc: "Sumo" },
              { name: "Stationary Lunge", sets: 4, reps: "10-12 each", desc: "Stationary" },
              { name: "Single Leg Glute Bridge", sets: 4, reps: "10-12 each", desc: "Single bridge" },
              { name: "Step Up", sets: 4, reps: "10-12 each", desc: "Step" },
              { name: "Calf Raise", sets: 4, reps: "15-20", desc: "Calves" }
            ]
          },
          {
            id: "bw-lower-15",
            name: "Lower 15",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "Jump Squat", sets: 4, reps: "12-15", desc: "Explosive" },
              { name: "Bulgarian Split Squat", sets: 4, reps: "10-12 each", desc: "Bulgarian" },
              { name: "Single Leg Glute Bridge", sets: 4, reps: "12-15 each", desc: "Single glute" },
              { name: "Lateral Lunge", sets: 4, reps: "10-12 each", desc: "Lateral" },
              { name: "Single Leg Calf Raise", sets: 4, reps: "15-20 each", desc: "Single calf" }
            ]
          }
        ]
      },

      "fullbody": {
        name: "Full Body",
        description: "Total body no-equipment workouts",
        workouts: [
          {
            id: "bw-fullbody-1",
            name: "Full Body 1",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Air Squat", sets: 4, reps: "15-20", desc: "Leg compound" },
              { name: "Push Up", sets: 4, reps: "12-15", desc: "Chest" },
              { name: "Reverse Lunge", sets: 4, reps: "12-15 each", desc: "Unilateral legs" },
              { name: "Pike Push Up", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Plank", sets: 4, reps: "45-60 sec", desc: "Core" }
            ]
          },
          {
            id: "bw-fullbody-2",
            name: "Full Body 2",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Sumo Squat", sets: 4, reps: "15-20", desc: "Inner thigh" },
              { name: "Wide Grip Push Up", sets: 4, reps: "12-15", desc: "Wide chest" },
              { name: "Walking Lunge", sets: 4, reps: "12-15 each", desc: "Walking" },
              { name: "Diamond Push Up", sets: 4, reps: "10-12", desc: "Triceps" },
              { name: "Glute Bridge", sets: 4, reps: "15-20", desc: "Glutes" }
            ]
          },
          {
            id: "bw-fullbody-3",
            name: "Full Body 3",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "Jump Squat", sets: 4, reps: "12-15", desc: "Explosive legs" },
              { name: "Decline Push Up", sets: 4, reps: "10-12", desc: "Upper chest" },
              { name: "Bulgarian Split Squat", sets: 4, reps: "10-12 each", desc: "Split squat" },
              { name: "Pike Push Up", sets: 4, reps: "8-10", desc: "Shoulders" },
              { name: "Plank Shoulder Tap", sets: 4, reps: "12-15 each", desc: "Core" }
            ]
          },
          {
            id: "bw-fullbody-4",
            name: "Full Body 4",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["None"],
            exercises: [
              { name: "Air Squat", sets: 4, reps: "12-15", desc: "Basic squat" },
              { name: "Incline Push Up", sets: 4, reps: "12-15", desc: "Beginner push" },
              { name: "Stationary Lunge", sets: 4, reps: "10-12 each", desc: "Lunge" },
              { name: "Pike Push Up", sets: 4, reps: "10-12", desc: "Shoulders" },
              { name: "Glute Bridge", sets: 4, reps: "15-20", desc: "Glutes" }
            ]
          },
          {
            id: "bw-fullbody-5",
            name: "Full Body 5",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Sumo Squat", sets: 4, reps: "15-20", desc: "Sumo" },
              { name: "Push Up", sets: 4, reps: "12-15", desc: "Push up" },
              { name: "Step Up", sets: 4, reps: "12-15 each", desc: "Steps" },
              { name: "Close Grip Push Up", sets: 4, reps: "10-12", desc: "Triceps" },
              { name: "Plank", sets: 4, reps: "45-60 sec", desc: "Core" }
            ]
          },
          {
            id: "bw-fullbody-6",
            name: "Full Body 6",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "Jumping Split Squat", sets: 4, reps: "10-12 each", desc: "Explosive lunge" },
              { name: "Archer Push Up", sets: 4, reps: "8-10 each", desc: "Unilateral chest" },
              { name: "Bulgarian Split Squat", sets: 4, reps: "10-12 each", desc: "Bulgarian" },
              { name: "Pike Push Up", sets: 4, reps: "8-10", desc: "Shoulders" },
              { name: "Mountain Climber", sets: 4, reps: "20-30 each", desc: "Core cardio" }
            ]
          },
          {
            id: "bw-fullbody-7",
            name: "Full Body 7",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Air Squat", sets: 4, reps: "15-20", desc: "Squats" },
              { name: "Wide Grip Push Up", sets: 4, reps: "12-15", desc: "Wide push" },
              { name: "Reverse Lunge", sets: 4, reps: "12-15 each", desc: "Reverse" },
              { name: "Diamond Push Up", sets: 4, reps: "10-12", desc: "Diamond" },
              { name: "Single Leg Glute Bridge", sets: 4, reps: "12-15 each", desc: "Single bridge" }
            ]
          },
          {
            id: "bw-fullbody-8",
            name: "Full Body 8",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Sumo Squat", sets: 4, reps: "15-20", desc: "Sumo" },
              { name: "Push Up", sets: 4, reps: "12-15", desc: "Chest" },
              { name: "Walking Lunge", sets: 4, reps: "12-15 each", desc: "Walking" },
              { name: "Pike Push Up", sets: 4, reps: "10-12", desc: "Pike" },
              { name: "Plank Shoulder Tap", sets: 4, reps: "12-15 each", desc: "Core" }
            ]
          },
          {
            id: "bw-fullbody-9",
            name: "Full Body 9",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "Jump Squat", sets: 4, reps: "12-15", desc: "Jump squat" },
              { name: "Decline Push Up", sets: 4, reps: "10-12", desc: "Decline" },
              { name: "Lateral Lunge", sets: 4, reps: "10-12 each", desc: "Lateral" },
              { name: "Close Grip Push Up", sets: 4, reps: "8-10", desc: "Close grip" },
              { name: "Glute Bridge", sets: 4, reps: "15-20", desc: "Glutes" }
            ]
          },
          {
            id: "bw-fullbody-10",
            name: "Full Body 10",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["None"],
            exercises: [
              { name: "Air Squat", sets: 4, reps: "12-15", desc: "Air squat" },
              { name: "Incline Push Up", sets: 4, reps: "12-15", desc: "Incline" },
              { name: "Stationary Lunge", sets: 4, reps: "10-12 each", desc: "Stationary" },
              { name: "Pike Push Up", sets: 4, reps: "10-12", desc: "Pike" },
              { name: "Plank", sets: 4, reps: "30-45 sec", desc: "Plank" }
            ]
          },
          {
            id: "bw-fullbody-11",
            name: "Full Body 11",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Sumo Squat", sets: 4, reps: "15-20", desc: "Sumo" },
              { name: "Wide Grip Push Up", sets: 4, reps: "12-15", desc: "Wide" },
              { name: "Step Up", sets: 4, reps: "12-15 each", desc: "Step" },
              { name: "Diamond Push Up", sets: 4, reps: "10-12", desc: "Diamond" },
              { name: "Single Leg Glute Bridge", sets: 4, reps: "12-15 each", desc: "Bridge" }
            ]
          },
          {
            id: "bw-fullbody-12",
            name: "Full Body 12",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "Jumping Split Squat", sets: 4, reps: "10-12 each", desc: "Jumping" },
              { name: "Archer Push Up", sets: 4, reps: "8-10 each", desc: "Archer" },
              { name: "Bulgarian Split Squat", sets: 4, reps: "10-12 each", desc: "Bulgarian" },
              { name: "Pike Push Up", sets: 4, reps: "8-10", desc: "Pike" },
              { name: "Plank", sets: 4, reps: "60 sec", desc: "Core" }
            ]
          },
          {
            id: "bw-fullbody-13",
            name: "Full Body 13",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Air Squat", sets: 4, reps: "15-20", desc: "Squat" },
              { name: "Push Up", sets: 4, reps: "12-15", desc: "Push up" },
              { name: "Reverse Lunge", sets: 4, reps: "12-15 each", desc: "Reverse" },
              { name: "Close Grip Push Up", sets: 4, reps: "10-12", desc: "Triceps" },
              { name: "Glute Bridge", sets: 4, reps: "15-20", desc: "Glutes" }
            ]
          },
          {
            id: "bw-fullbody-14",
            name: "Full Body 14",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["None"],
            exercises: [
              { name: "Sumo Squat", sets: 4, reps: "12-15", desc: "Sumo" },
              { name: "Incline Push Up", sets: 4, reps: "12-15", desc: "Incline" },
              { name: "Walking Lunge", sets: 4, reps: "10-12 each", desc: "Walking" },
              { name: "Pike Push Up", sets: 4, reps: "10-12", desc: "Pike" },
              { name: "Plank", sets: 4, reps: "30-45 sec", desc: "Core" }
            ]
          },
          {
            id: "bw-fullbody-15",
            name: "Full Body 15",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "Jump Squat", sets: 4, reps: "12-15", desc: "Explosive" },
              { name: "Decline Push Up", sets: 4, reps: "10-12", desc: "Decline" },
              { name: "Bulgarian Split Squat", sets: 4, reps: "10-12 each", desc: "Bulgarian" },
              { name: "Diamond Push Up", sets: 4, reps: "8-10", desc: "Diamond" },
              { name: "Mountain Climber", sets: 4, reps: "20-30 each", desc: "Core cardio" }
            ]
          }
        ]
      },

      "core": {
        name: "Core",
        description: "Strengthen your core",
        workouts: [
          {
            id: "bw-core-1",
            name: "Core 1",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Plank", sets: 4, reps: "45-60 sec", desc: "Isometric hold" },
              { name: "Bicycle Crunch", sets: 4, reps: "20-30 each", desc: "Obliques" },
              { name: "Lying Straight Leg Raise", sets: 4, reps: "12-15", desc: "Lower abs" },
              { name: "Side Plank", sets: 4, reps: "30-45 sec each", desc: "Oblique hold" },
              { name: "Dead Bug", sets: 4, reps: "12-15 each", desc: "Core stability" }
            ]
          },
          {
            id: "bw-core-2",
            name: "Core 2",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Plank Shoulder Tap", sets: 4, reps: "12-15 each", desc: "Dynamic plank" },
              { name: "Crunch", sets: 4, reps: "20-25", desc: "Upper abs" },
              { name: "Plank Hip Twist", sets: 4, reps: "15-20 each", desc: "Oblique twist" },
              { name: "Reverse Crunch", sets: 4, reps: "15-20", desc: "Lower abs" },
              { name: "Side Plank", sets: 4, reps: "30-45 sec each", desc: "Obliques" }
            ]
          },
          {
            id: "bw-core-3",
            name: "Core 3",
            duration: "25 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "Plank", sets: 4, reps: "60 sec", desc: "Long hold" },
              { name: "V-Up", sets: 4, reps: "12-15", desc: "Full core" },
              { name: "Lying Straight Leg Raise", sets: 4, reps: "15-20", desc: "Lower abs" },
              { name: "Side Plank with Hip Dip", sets: 4, reps: "12-15 each", desc: "Dynamic oblique" },
              { name: "Hollow Body Hold", sets: 4, reps: "30-45 sec", desc: "Compression" }
            ]
          },
          {
            id: "bw-core-4",
            name: "Core 4",
            duration: "25 min",
            difficulty: "Beginner",
            equipment: ["None"],
            exercises: [
              { name: "Plank", sets: 4, reps: "30-45 sec", desc: "Basic plank" },
              { name: "Crunch", sets: 4, reps: "15-20", desc: "Basic crunch" },
              { name: "Bicycle Crunch", sets: 4, reps: "15-20 each", desc: "Obliques" },
              { name: "Dead Bug", sets: 4, reps: "10-12 each", desc: "Stability" },
              { name: "Side Plank", sets: 4, reps: "20-30 sec each", desc: "Side hold" }
            ]
          },
          {
            id: "bw-core-5",
            name: "Core 5",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Plank Shoulder Tap", sets: 4, reps: "12-15 each", desc: "Shoulder taps" },
              { name: "Bicycle Crunch", sets: 4, reps: "20-30 each", desc: "Bicycle" },
              { name: "Reverse Crunch", sets: 4, reps: "15-20", desc: "Reverse" },
              { name: "Plank Hip Twist", sets: 4, reps: "15-20 each", desc: "Hip twist" },
              { name: "Dead Bug", sets: 4, reps: "12-15 each", desc: "Dead bug" }
            ]
          },
          {
            id: "bw-core-6",
            name: "Core 6",
            duration: "25 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "Plank", sets: 4, reps: "60-75 sec", desc: "Extended hold" },
              { name: "V-Up", sets: 4, reps: "15-20", desc: "V-up" },
              { name: "Lying Straight Leg Raise", sets: 4, reps: "15-20", desc: "Leg raise" },
              { name: "Side Plank with Leg Lift", sets: 4, reps: "10-12 each", desc: "Leg lift" },
              { name: "Hollow Body Hold", sets: 4, reps: "45-60 sec", desc: "Hollow hold" }
            ]
          },
          {
            id: "bw-core-7",
            name: "Core 7",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Plank", sets: 4, reps: "45-60 sec", desc: "Plank" },
              { name: "Crunch", sets: 4, reps: "20-25", desc: "Crunch" },
              { name: "Bicycle Crunch", sets: 4, reps: "20-30 each", desc: "Bicycle" },
              { name: "Side Plank", sets: 4, reps: "30-45 sec each", desc: "Side plank" },
              { name: "Reverse Crunch", sets: 4, reps: "15-20", desc: "Reverse" }
            ]
          },
          {
            id: "bw-core-8",
            name: "Core 8",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Plank Shoulder Tap", sets: 4, reps: "12-15 each", desc: "Taps" },
              { name: "Lying Straight Leg Raise", sets: 4, reps: "12-15", desc: "Leg raise" },
              { name: "Plank Hip Twist", sets: 4, reps: "15-20 each", desc: "Twist" },
              { name: "Dead Bug", sets: 4, reps: "12-15 each", desc: "Dead bug" },
              { name: "Side Plank", sets: 4, reps: "30-45 sec each", desc: "Side" }
            ]
          },
          {
            id: "bw-core-9",
            name: "Core 9",
            duration: "25 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "Plank", sets: 4, reps: "60 sec", desc: "Hold" },
              { name: "V-Up", sets: 4, reps: "12-15", desc: "V-up" },
              { name: "Bicycle Crunch", sets: 4, reps: "25-30 each", desc: "Bicycle" },
              { name: "Side Plank with Hip Dip", sets: 4, reps: "12-15 each", desc: "Hip dip" },
              { name: "Hollow Body Hold", sets: 4, reps: "30-45 sec", desc: "Hollow" }
            ]
          },
          {
            id: "bw-core-10",
            name: "Core 10",
            duration: "25 min",
            difficulty: "Beginner",
            equipment: ["None"],
            exercises: [
              { name: "Plank", sets: 4, reps: "30-45 sec", desc: "Plank" },
              { name: "Crunch", sets: 4, reps: "15-20", desc: "Crunch" },
              { name: "Dead Bug", sets: 4, reps: "10-12 each", desc: "Dead bug" },
              { name: "Side Plank", sets: 4, reps: "20-30 sec each", desc: "Side" },
              { name: "Reverse Crunch", sets: 4, reps: "12-15", desc: "Reverse" }
            ]
          },
          {
            id: "bw-core-11",
            name: "Core 11",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Plank Shoulder Tap", sets: 4, reps: "12-15 each", desc: "Shoulder tap" },
              { name: "Bicycle Crunch", sets: 4, reps: "20-30 each", desc: "Bicycle" },
              { name: "Lying Straight Leg Raise", sets: 4, reps: "12-15", desc: "Leg raise" },
              { name: "Plank Hip Twist", sets: 4, reps: "15-20 each", desc: "Hip twist" },
              { name: "Side Plank", sets: 4, reps: "30-45 sec each", desc: "Side plank" }
            ]
          },
          {
            id: "bw-core-12",
            name: "Core 12",
            duration: "25 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "Plank", sets: 4, reps: "60-75 sec", desc: "Long plank" },
              { name: "V-Up", sets: 4, reps: "15-20", desc: "V-up" },
              { name: "Reverse Crunch", sets: 4, reps: "15-20", desc: "Reverse" },
              { name: "Side Plank with Leg Lift", sets: 4, reps: "10-12 each", desc: "Leg lift" },
              { name: "Hollow Body Hold", sets: 4, reps: "45-60 sec", desc: "Hollow" }
            ]
          },
          {
            id: "bw-core-13",
            name: "Core 13",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Plank", sets: 4, reps: "45-60 sec", desc: "Plank" },
              { name: "Crunch", sets: 4, reps: "20-25", desc: "Crunch" },
              { name: "Bicycle Crunch", sets: 4, reps: "20-30 each", desc: "Bicycle" },
              { name: "Dead Bug", sets: 4, reps: "12-15 each", desc: "Dead bug" },
              { name: "Side Plank", sets: 4, reps: "30-45 sec each", desc: "Side" }
            ]
          },
          {
            id: "bw-core-14",
            name: "Core 14",
            duration: "25 min",
            difficulty: "Beginner",
            equipment: ["None"],
            exercises: [
              { name: "Plank Shoulder Tap", sets: 4, reps: "10-12 each", desc: "Taps" },
              { name: "Crunch", sets: 4, reps: "15-20", desc: "Crunch" },
              { name: "Lying Straight Leg Raise", sets: 4, reps: "10-12", desc: "Leg raise" },
              { name: "Dead Bug", sets: 4, reps: "10-12 each", desc: "Dead bug" },
              { name: "Side Plank", sets: 4, reps: "20-30 sec each", desc: "Side" }
            ]
          },
          {
            id: "bw-core-15",
            name: "Core 15",
            duration: "25 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "Plank", sets: 4, reps: "60 sec", desc: "Hold" },
              { name: "V-Up", sets: 4, reps: "15-20", desc: "V-up" },
              { name: "Bicycle Crunch", sets: 4, reps: "25-30 each", desc: "Bicycle" },
              { name: "Side Plank with Hip Dip", sets: 4, reps: "12-15 each", desc: "Hip dip" },
              { name: "Hollow Body Hold", sets: 4, reps: "45-60 sec", desc: "Hollow body" }
            ]
          }
        ]
      }
    }
  },

  // ====================
  // SOMATIC YOGA
  // ====================
  "yoga": {
    name: "Somatic Yoga",
    icon: "🧘",
    description: "Mind-body connection and somatic awareness",
    subcategories: {

      "flow": {
        name: "Flow",
        description: "Dynamic flowing sequences",
        workouts: [
          {
            id: "yoga-flow-1",
            name: "Flow 1",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Cat Cow", sets: 1, reps: "2 min", desc: "Spinal warmup" },
              { name: "Yoga - Downward Dog", sets: 1, reps: "1 min", desc: "Full body stretch" },
              { name: "Yoga - Warrior I", sets: 1, reps: "1 min each", desc: "Strength and balance" },
              { name: "Yoga - Warrior II", sets: 1, reps: "1 min each", desc: "Hip opening" },
              { name: "Yoga - Savasana", sets: 1, reps: "3 min", desc: "Integration" }
            ]
          },
          {
            id: "yoga-flow-2",
            name: "Flow 2",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Sun Salutation A", sets: 1, reps: "5 breaths", desc: "Flow warmup" },
              { name: "Yoga - Triangle Pose", sets: 1, reps: "1 min each", desc: "Side body" },
              { name: "Yoga - Extended Side Angle", sets: 1, reps: "1 min each", desc: "Side stretch" },
              { name: "Yoga - Pigeon Pose", sets: 1, reps: "2 min each", desc: "Hip release" },
              { name: "Yoga - Savasana", sets: 1, reps: "3 min", desc: "Rest" }
            ]
          },
          {
            id: "yoga-flow-3",
            name: "Flow 3",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Sun Salutation B", sets: 1, reps: "5 breaths", desc: "Dynamic warmup" },
              { name: "Yoga - Warrior III", sets: 1, reps: "45 sec each", desc: "Balance" },
              { name: "Yoga - Half Moon Pose", sets: 1, reps: "45 sec each", desc: "Balance challenge" },
              { name: "Yoga - Crow Pose", sets: 1, reps: "30 sec", desc: "Arm balance" },
              { name: "Yoga - Savasana", sets: 1, reps: "3 min", desc: "Integration" }
            ]
          },
          {
            id: "yoga-flow-4",
            name: "Flow 4",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Child's Pose", sets: 1, reps: "2 min", desc: "Center and breathe" },
              { name: "Yoga - Cat Cow", sets: 1, reps: "2 min", desc: "Spinal movement" },
              { name: "Yoga - Downward Dog", sets: 1, reps: "1 min", desc: "Full stretch" },
              { name: "Yoga - Seated Forward Fold", sets: 1, reps: "2 min", desc: "Hamstring release" },
              { name: "Yoga - Savasana", sets: 1, reps: "3 min", desc: "Rest" }
            ]
          },
          {
            id: "yoga-flow-5",
            name: "Flow 5",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Sun Salutation A", sets: 1, reps: "5 breaths", desc: "Warmup" },
              { name: "Yoga - Warrior I", sets: 1, reps: "1 min each", desc: "Warrior" },
              { name: "Yoga - Warrior II", sets: 1, reps: "1 min each", desc: "Hip strength" },
              { name: "Yoga - Triangle Pose", sets: 1, reps: "1 min each", desc: "Side body" },
              { name: "Yoga - Savasana", sets: 1, reps: "3 min", desc: "Integration" }
            ]
          },
          {
            id: "yoga-flow-6",
            name: "Flow 6",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Sun Salutation B", sets: 1, reps: "5 breaths", desc: "Flow" },
              { name: "Yoga - Side Plank", sets: 1, reps: "45 sec each", desc: "Core power" },
              { name: "Yoga - Wheel Pose", sets: 1, reps: "45 sec", desc: "Backbend" },
              { name: "Yoga - Shoulder Stand", sets: 1, reps: "2 min", desc: "Inversion" },
              { name: "Yoga - Savasana", sets: 1, reps: "3 min", desc: "Rest" }
            ]
          },
          {
            id: "yoga-flow-7",
            name: "Flow 7",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Cat Cow", sets: 1, reps: "2 min", desc: "Spinal warmup" },
              { name: "Yoga - Low Lunge", sets: 1, reps: "1 min each", desc: "Hip flexor" },
              { name: "Yoga - Pigeon Pose", sets: 1, reps: "2 min each", desc: "Hip release" },
              { name: "Yoga - Seated Spinal Twist", sets: 1, reps: "1 min each", desc: "Twist" },
              { name: "Yoga - Savasana", sets: 1, reps: "3 min", desc: "Integration" }
            ]
          },
          {
            id: "yoga-flow-8",
            name: "Flow 8",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Sun Salutation A", sets: 1, reps: "5 breaths", desc: "Flow warmup" },
              { name: "Yoga - Extended Side Angle", sets: 1, reps: "1 min each", desc: "Side body" },
              { name: "Yoga - Half Moon Pose", sets: 1, reps: "45 sec each", desc: "Balance" },
              { name: "Yoga - Forward Fold", sets: 1, reps: "2 min", desc: "Hamstrings" },
              { name: "Yoga - Savasana", sets: 1, reps: "3 min", desc: "Rest" }
            ]
          },
          {
            id: "yoga-flow-9",
            name: "Flow 9",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Sun Salutation B", sets: 1, reps: "5 breaths", desc: "Dynamic" },
              { name: "Yoga - Warrior III", sets: 1, reps: "45 sec each", desc: "Balance" },
              { name: "Yoga - Crow Pose", sets: 1, reps: "30 sec", desc: "Arm balance" },
              { name: "Yoga - Fish Pose", sets: 1, reps: "1 min", desc: "Heart opener" },
              { name: "Yoga - Savasana", sets: 1, reps: "3 min", desc: "Integration" }
            ]
          },
          {
            id: "yoga-flow-10",
            name: "Flow 10",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Child's Pose", sets: 1, reps: "2 min", desc: "Grounding" },
              { name: "Yoga - Cat Cow", sets: 1, reps: "2 min", desc: "Spine mobility" },
              { name: "Yoga - Downward Dog", sets: 1, reps: "1 min", desc: "Full body" },
              { name: "Yoga - Cobra Pose", sets: 1, reps: "1 min", desc: "Gentle backbend" },
              { name: "Yoga - Savasana", sets: 1, reps: "3 min", desc: "Rest" }
            ]
          },
          {
            id: "yoga-flow-11",
            name: "Flow 11",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Sun Salutation A", sets: 1, reps: "5 breaths", desc: "Warmup" },
              { name: "Yoga - Warrior I", sets: 1, reps: "1 min each", desc: "Warrior" },
              { name: "Yoga - Triangle Pose", sets: 1, reps: "1 min each", desc: "Triangle" },
              { name: "Yoga - Pigeon Pose", sets: 1, reps: "2 min each", desc: "Hips" },
              { name: "Yoga - Savasana", sets: 1, reps: "3 min", desc: "Integration" }
            ]
          },
          {
            id: "yoga-flow-12",
            name: "Flow 12",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Sun Salutation B", sets: 1, reps: "5 breaths", desc: "Dynamic" },
              { name: "Yoga - Side Plank", sets: 1, reps: "45 sec each", desc: "Core" },
              { name: "Yoga - Wheel Pose", sets: 1, reps: "45 sec", desc: "Backbend" },
              { name: "Yoga - Shoulder Stand", sets: 1, reps: "2 min", desc: "Inversion" },
              { name: "Yoga - Savasana", sets: 1, reps: "3 min", desc: "Rest" }
            ]
          },
          {
            id: "yoga-flow-13",
            name: "Flow 13",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Cat Cow", sets: 1, reps: "2 min", desc: "Spinal warmup" },
              { name: "Yoga - Warrior II", sets: 1, reps: "1 min each", desc: "Hip opening" },
              { name: "Yoga - Extended Side Angle", sets: 1, reps: "1 min each", desc: "Side stretch" },
              { name: "Yoga - Seated Forward Fold", sets: 1, reps: "2 min", desc: "Fold" },
              { name: "Yoga - Savasana", sets: 1, reps: "3 min", desc: "Integration" }
            ]
          },
          {
            id: "yoga-flow-14",
            name: "Flow 14",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Child's Pose", sets: 1, reps: "2 min", desc: "Center" },
              { name: "Yoga - Cat Cow", sets: 1, reps: "2 min", desc: "Spine" },
              { name: "Yoga - Low Lunge", sets: 1, reps: "1 min each", desc: "Hip stretch" },
              { name: "Yoga - Supine Twist", sets: 1, reps: "1 min each", desc: "Twist" },
              { name: "Yoga - Savasana", sets: 1, reps: "3 min", desc: "Rest" }
            ]
          },
          {
            id: "yoga-flow-15",
            name: "Flow 15",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Sun Salutation B", sets: 1, reps: "5 breaths", desc: "Flow" },
              { name: "Yoga - Warrior III", sets: 1, reps: "45 sec each", desc: "Balance" },
              { name: "Yoga - Half Moon Pose", sets: 1, reps: "45 sec each", desc: "Balance" },
              { name: "Yoga - Camel Pose", sets: 1, reps: "1 min", desc: "Backbend" },
              { name: "Yoga - Savasana", sets: 1, reps: "3 min", desc: "Integration" }
            ]
          }
        ]
      },

      "restorative": {
        name: "Restorative",
        description: "Gentle, healing practices",
        workouts: [
          {
            id: "yoga-rest-1",
            name: "Restorative 1",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Child's Pose", sets: 1, reps: "3 min", desc: "Ground and center" },
              { name: "Yoga - Supported Bridge", sets: 1, reps: "3 min", desc: "Passive backbend" },
              { name: "Yoga - Supine Twist", sets: 1, reps: "2 min each", desc: "Spinal release" },
              { name: "Yoga - Legs Up the Wall", sets: 1, reps: "3 min", desc: "Gentle inversion" },
              { name: "Yoga - Savasana", sets: 1, reps: "5 min", desc: "Deep rest" }
            ]
          },
          {
            id: "yoga-rest-2",
            name: "Restorative 2",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Reclined Butterfly", sets: 1, reps: "3 min", desc: "Hip opening" },
              { name: "Yoga - Supine Twist", sets: 1, reps: "2 min each", desc: "Twist" },
              { name: "Yoga - Happy Baby", sets: 1, reps: "3 min", desc: "Hip release" },
              { name: "Yoga - Legs Up the Wall", sets: 1, reps: "3 min", desc: "Inversion" },
              { name: "Yoga - Savasana", sets: 1, reps: "5 min", desc: "Rest" }
            ]
          },
          {
            id: "yoga-rest-3",
            name: "Restorative 3",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Butterfly Pose", sets: 1, reps: "4 min", desc: "Deep hip" },
              { name: "Yoga - Dragon Pose", sets: 1, reps: "3 min each", desc: "Hip flexor" },
              { name: "Yoga - Sphinx Pose", sets: 1, reps: "3 min", desc: "Backbend" },
              { name: "Yoga - Supine Twist", sets: 1, reps: "2 min each", desc: "Twist" },
              { name: "Yoga - Savasana", sets: 1, reps: "5 min", desc: "Integration" }
            ]
          },
          {
            id: "yoga-rest-4",
            name: "Restorative 4",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Child's Pose", sets: 1, reps: "3 min", desc: "Grounding" },
              { name: "Yoga - Cat Cow", sets: 1, reps: "2 min", desc: "Gentle spine" },
              { name: "Yoga - Seated Forward Fold", sets: 1, reps: "3 min", desc: "Calming" },
              { name: "Yoga - Supine Twist", sets: 1, reps: "2 min each", desc: "Release" },
              { name: "Yoga - Savasana", sets: 1, reps: "5 min", desc: "Rest" }
            ]
          },
          {
            id: "yoga-rest-5",
            name: "Restorative 5",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Supported Bridge", sets: 1, reps: "3 min", desc: "Backbend" },
              { name: "Yoga - Reclined Butterfly", sets: 1, reps: "3 min", desc: "Hip opening" },
              { name: "Yoga - Happy Baby", sets: 1, reps: "3 min", desc: "Hip release" },
              { name: "Yoga - Legs Up the Wall", sets: 1, reps: "3 min", desc: "Inversion" },
              { name: "Yoga - Savasana", sets: 1, reps: "5 min", desc: "Deep rest" }
            ]
          },
          {
            id: "yoga-rest-6",
            name: "Restorative 6",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Caterpillar Pose", sets: 1, reps: "4 min", desc: "Deep fold" },
              { name: "Yoga - Sleeping Swan", sets: 1, reps: "3 min each", desc: "Deep hip" },
              { name: "Yoga - Sphinx Pose", sets: 1, reps: "3 min", desc: "Backbend" },
              { name: "Yoga - Supine Twist", sets: 1, reps: "2 min each", desc: "Twist" },
              { name: "Yoga - Savasana", sets: 1, reps: "5 min", desc: "Integration" }
            ]
          },
          {
            id: "yoga-rest-7",
            name: "Restorative 7",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Child's Pose", sets: 1, reps: "3 min", desc: "Center" },
              { name: "Yoga - Supine Twist", sets: 1, reps: "2 min each", desc: "Spinal release" },
              { name: "Yoga - Reclined Butterfly", sets: 1, reps: "3 min", desc: "Hips" },
              { name: "Yoga - Legs Up the Wall", sets: 1, reps: "3 min", desc: "Inversion" },
              { name: "Yoga - Savasana", sets: 1, reps: "5 min", desc: "Rest" }
            ]
          },
          {
            id: "yoga-rest-8",
            name: "Restorative 8",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Butterfly Pose", sets: 1, reps: "3 min", desc: "Hip opening" },
              { name: "Yoga - Supported Bridge", sets: 1, reps: "3 min", desc: "Backbend" },
              { name: "Yoga - Happy Baby", sets: 1, reps: "3 min", desc: "Hip release" },
              { name: "Yoga - Supine Twist", sets: 1, reps: "2 min each", desc: "Twist" },
              { name: "Yoga - Savasana", sets: 1, reps: "5 min", desc: "Deep rest" }
            ]
          },
          {
            id: "yoga-rest-9",
            name: "Restorative 9",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Dragon Pose", sets: 1, reps: "3 min each", desc: "Hip flexor" },
              { name: "Yoga - Caterpillar Pose", sets: 1, reps: "4 min", desc: "Hamstrings" },
              { name: "Yoga - Sphinx Pose", sets: 1, reps: "3 min", desc: "Backbend" },
              { name: "Yoga - Supine Twist", sets: 1, reps: "2 min each", desc: "Twist" },
              { name: "Yoga - Savasana", sets: 1, reps: "5 min", desc: "Integration" }
            ]
          },
          {
            id: "yoga-rest-10",
            name: "Restorative 10",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Child's Pose", sets: 1, reps: "3 min", desc: "Grounding" },
              { name: "Yoga - Cat Cow", sets: 1, reps: "2 min", desc: "Spine" },
              { name: "Yoga - Reclined Butterfly", sets: 1, reps: "3 min", desc: "Hips" },
              { name: "Yoga - Legs Up the Wall", sets: 1, reps: "3 min", desc: "Inversion" },
              { name: "Yoga - Savasana", sets: 1, reps: "5 min", desc: "Rest" }
            ]
          },
          {
            id: "yoga-rest-11",
            name: "Restorative 11",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Supported Bridge", sets: 1, reps: "3 min", desc: "Backbend" },
              { name: "Yoga - Supine Twist", sets: 1, reps: "2 min each", desc: "Twist" },
              { name: "Yoga - Happy Baby", sets: 1, reps: "3 min", desc: "Hip release" },
              { name: "Yoga - Reclined Butterfly", sets: 1, reps: "3 min", desc: "Hips" },
              { name: "Yoga - Savasana", sets: 1, reps: "5 min", desc: "Deep rest" }
            ]
          },
          {
            id: "yoga-rest-12",
            name: "Restorative 12",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Sleeping Swan", sets: 1, reps: "3 min each", desc: "Deep hip" },
              { name: "Yoga - Dragon Pose", sets: 1, reps: "3 min each", desc: "Hip flexor" },
              { name: "Yoga - Caterpillar Pose", sets: 1, reps: "4 min", desc: "Fold" },
              { name: "Yoga - Supine Twist", sets: 1, reps: "2 min each", desc: "Twist" },
              { name: "Yoga - Savasana", sets: 1, reps: "5 min", desc: "Integration" }
            ]
          },
          {
            id: "yoga-rest-13",
            name: "Restorative 13",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Child's Pose", sets: 1, reps: "3 min", desc: "Center" },
              { name: "Yoga - Butterfly Pose", sets: 1, reps: "3 min", desc: "Hips" },
              { name: "Yoga - Supine Twist", sets: 1, reps: "2 min each", desc: "Twist" },
              { name: "Yoga - Legs Up the Wall", sets: 1, reps: "3 min", desc: "Inversion" },
              { name: "Yoga - Savasana", sets: 1, reps: "5 min", desc: "Rest" }
            ]
          },
          {
            id: "yoga-rest-14",
            name: "Restorative 14",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Child's Pose", sets: 1, reps: "3 min", desc: "Grounding" },
              { name: "Yoga - Seated Forward Fold", sets: 1, reps: "3 min", desc: "Fold" },
              { name: "Yoga - Happy Baby", sets: 1, reps: "3 min", desc: "Hip release" },
              { name: "Yoga - Supine Twist", sets: 1, reps: "2 min each", desc: "Release" },
              { name: "Yoga - Savasana", sets: 1, reps: "5 min", desc: "Rest" }
            ]
          },
          {
            id: "yoga-rest-15",
            name: "Restorative 15",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Sphinx Pose", sets: 1, reps: "3 min", desc: "Backbend" },
              { name: "Yoga - Dragon Pose", sets: 1, reps: "3 min each", desc: "Hip flexor" },
              { name: "Yoga - Sleeping Swan", sets: 1, reps: "3 min each", desc: "Deep hip" },
              { name: "Yoga - Supine Twist", sets: 1, reps: "2 min each", desc: "Twist" },
              { name: "Yoga - Savasana", sets: 1, reps: "5 min", desc: "Integration" }
            ]
          }
        ]
      },

      "mobility": {
        name: "Mobility",
        description: "Improve flexibility and range of motion",
        workouts: [
          {
            id: "yoga-mob-1",
            name: "Mobility 1",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Cat Cow", sets: 1, reps: "2 min", desc: "Spinal mobility" },
              { name: "Yoga - Low Lunge", sets: 1, reps: "1 min each", desc: "Hip flexor" },
              { name: "Yoga - Pigeon Pose", sets: 1, reps: "2 min each", desc: "Hip external rotation" },
              { name: "Yoga - Supine Twist", sets: 1, reps: "1 min each", desc: "Spinal rotation" },
              { name: "Yoga - Savasana", sets: 1, reps: "3 min", desc: "Rest" }
            ]
          },
          {
            id: "yoga-mob-2",
            name: "Mobility 2",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Thread the Needle", sets: 1, reps: "1 min each", desc: "Thoracic rotation" },
              { name: "Yoga - Lizard Pose", sets: 1, reps: "1 min each", desc: "Deep hip opener" },
              { name: "Yoga - Sphinx Pose", sets: 1, reps: "2 min", desc: "Gentle backbend" },
              { name: "Yoga - Reclined Butterfly", sets: 1, reps: "2 min", desc: "Hip opening" },
              { name: "Yoga - Savasana", sets: 1, reps: "3 min", desc: "Rest" }
            ]
          },
          {
            id: "yoga-mob-3",
            name: "Mobility 3",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Sun Salutation A", sets: 1, reps: "5 breaths", desc: "Dynamic warmup" },
              { name: "Yoga - Low Lunge with Twist", sets: 1, reps: "1 min each", desc: "Hip and spine" },
              { name: "Yoga - Pyramid Pose", sets: 1, reps: "1 min each", desc: "Hamstring length" },
              { name: "Yoga - Camel Pose", sets: 1, reps: "1 min", desc: "Backbend" },
              { name: "Yoga - Savasana", sets: 1, reps: "3 min", desc: "Integration" }
            ]
          },
          {
            id: "yoga-mob-4",
            name: "Mobility 4",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Cat Cow", sets: 1, reps: "2 min", desc: "Spine warmup" },
              { name: "Yoga - Child's Pose", sets: 1, reps: "2 min", desc: "Hip and back" },
              { name: "Yoga - Downward Dog", sets: 1, reps: "1 min", desc: "Full body" },
              { name: "Yoga - Cobra Pose", sets: 1, reps: "1 min", desc: "Gentle backbend" },
              { name: "Yoga - Savasana", sets: 1, reps: "3 min", desc: "Rest" }
            ]
          },
          {
            id: "yoga-mob-5",
            name: "Mobility 5",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Cat Cow", sets: 1, reps: "2 min", desc: "Spine" },
              { name: "Yoga - Low Lunge", sets: 1, reps: "1 min each", desc: "Hip flexor" },
              { name: "Yoga - Fire Log Pose", sets: 1, reps: "2 min each", desc: "Hip stacking" },
              { name: "Yoga - Supine Twist", sets: 1, reps: "1 min each", desc: "Twist" },
              { name: "Yoga - Savasana", sets: 1, reps: "3 min", desc: "Rest" }
            ]
          },
          {
            id: "yoga-mob-6",
            name: "Mobility 6",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Sun Salutation A", sets: 1, reps: "5 breaths", desc: "Warmup" },
              { name: "Yoga - Lizard Pose", sets: 1, reps: "1 min each", desc: "Deep hip" },
              { name: "Yoga - Triangle Pose", sets: 1, reps: "1 min each", desc: "Side body" },
              { name: "Yoga - Camel Pose", sets: 1, reps: "1 min", desc: "Backbend" },
              { name: "Yoga - Savasana", sets: 1, reps: "3 min", desc: "Integration" }
            ]
          },
          {
            id: "yoga-mob-7",
            name: "Mobility 7",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Thread the Needle", sets: 1, reps: "1 min each", desc: "Thoracic" },
              { name: "Yoga - Pigeon Pose", sets: 1, reps: "2 min each", desc: "Hip external" },
              { name: "Yoga - Sphinx Pose", sets: 1, reps: "2 min", desc: "Backbend" },
              { name: "Yoga - Supine Twist", sets: 1, reps: "1 min each", desc: "Rotation" },
              { name: "Yoga - Savasana", sets: 1, reps: "3 min", desc: "Rest" }
            ]
          },
          {
            id: "yoga-mob-8",
            name: "Mobility 8",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Cat Cow", sets: 1, reps: "2 min", desc: "Spinal mobility" },
              { name: "Yoga - Low Lunge", sets: 1, reps: "1 min each", desc: "Hip flexor" },
              { name: "Yoga - Seated Forward Fold", sets: 1, reps: "2 min", desc: "Hamstrings" },
              { name: "Yoga - Reclined Butterfly", sets: 1, reps: "2 min", desc: "Hip opening" },
              { name: "Yoga - Savasana", sets: 1, reps: "3 min", desc: "Rest" }
            ]
          },
          {
            id: "yoga-mob-9",
            name: "Mobility 9",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Sun Salutation A", sets: 1, reps: "5 breaths", desc: "Dynamic" },
              { name: "Yoga - Low Lunge with Twist", sets: 1, reps: "1 min each", desc: "Hip and spine" },
              { name: "Yoga - Pyramid Pose", sets: 1, reps: "1 min each", desc: "Hamstring" },
              { name: "Yoga - Wheel Pose", sets: 1, reps: "45 sec", desc: "Deep backbend" },
              { name: "Yoga - Savasana", sets: 1, reps: "3 min", desc: "Integration" }
            ]
          },
          {
            id: "yoga-mob-10",
            name: "Mobility 10",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Cat Cow", sets: 1, reps: "2 min", desc: "Spine" },
              { name: "Yoga - Child's Pose", sets: 1, reps: "2 min", desc: "Rest" },
              { name: "Yoga - Downward Dog", sets: 1, reps: "1 min", desc: "Full stretch" },
              { name: "Yoga - Supine Twist", sets: 1, reps: "1 min each", desc: "Rotation" },
              { name: "Yoga - Savasana", sets: 1, reps: "3 min", desc: "Rest" }
            ]
          },
          {
            id: "yoga-mob-11",
            name: "Mobility 11",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Thread the Needle", sets: 1, reps: "1 min each", desc: "Thoracic" },
              { name: "Yoga - Lizard Pose", sets: 1, reps: "1 min each", desc: "Hip opener" },
              { name: "Yoga - Pigeon Pose", sets: 1, reps: "2 min each", desc: "External rotation" },
              { name: "Yoga - Sphinx Pose", sets: 1, reps: "2 min", desc: "Backbend" },
              { name: "Yoga - Savasana", sets: 1, reps: "3 min", desc: "Rest" }
            ]
          },
          {
            id: "yoga-mob-12",
            name: "Mobility 12",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Sun Salutation A", sets: 1, reps: "5 breaths", desc: "Warmup" },
              { name: "Yoga - Triangle Pose", sets: 1, reps: "1 min each", desc: "Side body" },
              { name: "Yoga - Low Lunge with Twist", sets: 1, reps: "1 min each", desc: "Hip and spine" },
              { name: "Yoga - Camel Pose", sets: 1, reps: "1 min", desc: "Backbend" },
              { name: "Yoga - Savasana", sets: 1, reps: "3 min", desc: "Integration" }
            ]
          },
          {
            id: "yoga-mob-13",
            name: "Mobility 13",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Cat Cow", sets: 1, reps: "2 min", desc: "Spine warmup" },
              { name: "Yoga - Low Lunge", sets: 1, reps: "1 min each", desc: "Hip flexor" },
              { name: "Yoga - Fire Log Pose", sets: 1, reps: "2 min each", desc: "Hip stacking" },
              { name: "Yoga - Reclined Butterfly", sets: 1, reps: "2 min", desc: "Hip opening" },
              { name: "Yoga - Savasana", sets: 1, reps: "3 min", desc: "Rest" }
            ]
          },
          {
            id: "yoga-mob-14",
            name: "Mobility 14",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Cat Cow", sets: 1, reps: "2 min", desc: "Spine" },
              { name: "Yoga - Child's Pose", sets: 1, reps: "2 min", desc: "Hip and back" },
              { name: "Yoga - Cobra Pose", sets: 1, reps: "1 min", desc: "Gentle backbend" },
              { name: "Yoga - Supine Twist", sets: 1, reps: "1 min each", desc: "Rotation" },
              { name: "Yoga - Savasana", sets: 1, reps: "3 min", desc: "Rest" }
            ]
          },
          {
            id: "yoga-mob-15",
            name: "Mobility 15",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Sun Salutation A", sets: 1, reps: "5 breaths", desc: "Dynamic" },
              { name: "Yoga - Lizard Pose", sets: 1, reps: "1 min each", desc: "Deep hip" },
              { name: "Yoga - Pyramid Pose", sets: 1, reps: "1 min each", desc: "Hamstring" },
              { name: "Yoga - Camel Pose", sets: 1, reps: "1 min", desc: "Backbend" },
              { name: "Yoga - Savasana", sets: 1, reps: "3 min", desc: "Integration" }
            ]
          }
        ]
      }
    }
  },

  // ====================
  // RECOVERY
  // ====================
  "recovery": {
    name: "Recovery",
    icon: "🔄",
    description: "Active recovery and mobility work",
    subcategories: {

      "stretch": {
        name: "Stretching",
        description: "Improve flexibility and reduce soreness",
        workouts: [
          {
            id: "recovery-stretch-1",
            name: "Stretch 1",
            duration: "20 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Neck Stretch", sets: 1, reps: "1 min each", desc: "Neck release" },
              { name: "Chest Stretch", sets: 1, reps: "1 min", desc: "Chest opener" },
              { name: "Seated Forward Fold", sets: 1, reps: "2 min", desc: "Hamstrings" },
              { name: "Figure Four Stretch", sets: 1, reps: "1 min each", desc: "Hip and glute" },
              { name: "Calf Stretch", sets: 1, reps: "1 min each", desc: "Calves" }
            ]
          },
          {
            id: "recovery-stretch-2",
            name: "Stretch 2",
            duration: "20 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Shoulder Stretch", sets: 1, reps: "1 min each", desc: "Shoulders" },
              { name: "Tricep Stretch", sets: 1, reps: "1 min each", desc: "Triceps" },
              { name: "Quad Stretch", sets: 1, reps: "1 min each", desc: "Quads" },
              { name: "Butterfly Stretch", sets: 1, reps: "2 min", desc: "Inner thigh" },
              { name: "Pigeon Pose", sets: 1, reps: "1 min each", desc: "Hip opener" }
            ]
          },
          {
            id: "recovery-stretch-3",
            name: "Stretch 3",
            duration: "20 min",
            difficulty: "Advanced",
            equipment: ["Mat"],
            exercises: [
              { name: "Cat Cow", sets: 1, reps: "2 min", desc: "Spinal mobility" },
              { name: "Standing Hamstring Stretch", sets: 1, reps: "1 min each", desc: "Hamstrings" },
              { name: "Pigeon Pose", sets: 1, reps: "2 min each", desc: "Deep hip" },
              { name: "Chest Doorway Stretch", sets: 1, reps: "1 min", desc: "Chest" },
              { name: "Lying Hamstring Stretch", sets: 1, reps: "1 min each", desc: "Hamstring release" }
            ]
          },
          {
            id: "recovery-stretch-4",
            name: "Stretch 4",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Neck Rolls", sets: 1, reps: "1 min", desc: "Neck" },
              { name: "Shoulder Rolls", sets: 1, reps: "1 min", desc: "Shoulders" },
              { name: "Seated Forward Fold", sets: 1, reps: "2 min", desc: "Back and hamstrings" },
              { name: "Quad Stretch", sets: 1, reps: "1 min each", desc: "Quads" },
              { name: "Calf Stretch", sets: 1, reps: "1 min each", desc: "Calves" }
            ]
          },
          {
            id: "recovery-stretch-5",
            name: "Stretch 5",
            duration: "20 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Cross Body Shoulder Stretch", sets: 1, reps: "1 min each", desc: "Rear delt" },
              { name: "Chest Stretch", sets: 1, reps: "1 min", desc: "Chest" },
              { name: "Figure Four Stretch", sets: 1, reps: "1 min each", desc: "Glutes" },
              { name: "Butterfly Stretch", sets: 1, reps: "2 min", desc: "Inner thigh" },
              { name: "Cat Cow", sets: 1, reps: "2 min", desc: "Spine" }
            ]
          },
          {
            id: "recovery-stretch-6",
            name: "Stretch 6",
            duration: "20 min",
            difficulty: "Advanced",
            equipment: ["Mat"],
            exercises: [
              { name: "Standing Hamstring Stretch", sets: 1, reps: "1 min each", desc: "Hamstrings" },
              { name: "Pigeon Pose", sets: 1, reps: "2 min each", desc: "Deep hip" },
              { name: "Chest Doorway Stretch", sets: 1, reps: "1 min", desc: "Chest" },
              { name: "Tricep Stretch", sets: 1, reps: "1 min each", desc: "Triceps" },
              { name: "Lying Hamstring Stretch", sets: 1, reps: "1 min each", desc: "Hamstring release" }
            ]
          },
          {
            id: "recovery-stretch-7",
            name: "Stretch 7",
            duration: "20 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Neck Stretch", sets: 1, reps: "1 min each", desc: "Neck" },
              { name: "Shoulder Stretch", sets: 1, reps: "1 min each", desc: "Shoulders" },
              { name: "Seated Forward Fold", sets: 1, reps: "2 min", desc: "Hamstrings" },
              { name: "Quad Stretch", sets: 1, reps: "1 min each", desc: "Quads" },
              { name: "Calf Stretch", sets: 1, reps: "1 min each", desc: "Calves" }
            ]
          },
          {
            id: "recovery-stretch-8",
            name: "Stretch 8",
            duration: "20 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Cross Body Shoulder Stretch", sets: 1, reps: "1 min each", desc: "Rear delt" },
              { name: "Chest Stretch", sets: 1, reps: "1 min", desc: "Chest opener" },
              { name: "Figure Four Stretch", sets: 1, reps: "1 min each", desc: "Hip and glute" },
              { name: "Butterfly Stretch", sets: 1, reps: "2 min", desc: "Inner thigh" },
              { name: "Cat Cow", sets: 1, reps: "2 min", desc: "Spinal mobility" }
            ]
          },
          {
            id: "recovery-stretch-9",
            name: "Stretch 9",
            duration: "20 min",
            difficulty: "Advanced",
            equipment: ["Mat"],
            exercises: [
              { name: "Standing Hamstring Stretch", sets: 1, reps: "1 min each", desc: "Deep hamstring" },
              { name: "Pigeon Pose", sets: 1, reps: "2 min each", desc: "Deep hip opener" },
              { name: "Chest Doorway Stretch", sets: 1, reps: "1 min", desc: "Deep chest" },
              { name: "Tricep Stretch", sets: 1, reps: "1 min each", desc: "Triceps" },
              { name: "Lying Hamstring Stretch", sets: 1, reps: "1 min each", desc: "Hamstring" }
            ]
          },
          {
            id: "recovery-stretch-10",
            name: "Stretch 10",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Neck Rolls", sets: 1, reps: "1 min", desc: "Neck release" },
              { name: "Shoulder Rolls", sets: 1, reps: "1 min", desc: "Shoulder release" },
              { name: "Seated Forward Fold", sets: 1, reps: "2 min", desc: "Back" },
              { name: "Quad Stretch", sets: 1, reps: "1 min each", desc: "Quads" },
              { name: "Calf Stretch", sets: 1, reps: "1 min each", desc: "Calves" }
            ]
          },
          {
            id: "recovery-stretch-11",
            name: "Stretch 11",
            duration: "20 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Neck Stretch", sets: 1, reps: "1 min each", desc: "Neck" },
              { name: "Chest Stretch", sets: 1, reps: "1 min", desc: "Chest" },
              { name: "Figure Four Stretch", sets: 1, reps: "1 min each", desc: "Glutes" },
              { name: "Butterfly Stretch", sets: 1, reps: "2 min", desc: "Inner thigh" },
              { name: "Cat Cow", sets: 1, reps: "2 min", desc: "Spine" }
            ]
          },
          {
            id: "recovery-stretch-12",
            name: "Stretch 12",
            duration: "20 min",
            difficulty: "Advanced",
            equipment: ["Mat"],
            exercises: [
              { name: "Standing Hamstring Stretch", sets: 1, reps: "1 min each", desc: "Hamstrings" },
              { name: "Pigeon Pose", sets: 1, reps: "2 min each", desc: "Deep hip" },
              { name: "Chest Doorway Stretch", sets: 1, reps: "1 min", desc: "Chest" },
              { name: "Cross Body Shoulder Stretch", sets: 1, reps: "1 min each", desc: "Shoulders" },
              { name: "Lying Hamstring Stretch", sets: 1, reps: "1 min each", desc: "Hamstring" }
            ]
          },
          {
            id: "recovery-stretch-13",
            name: "Stretch 13",
            duration: "20 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Shoulder Stretch", sets: 1, reps: "1 min each", desc: "Shoulders" },
              { name: "Tricep Stretch", sets: 1, reps: "1 min each", desc: "Triceps" },
              { name: "Seated Forward Fold", sets: 1, reps: "2 min", desc: "Hamstrings" },
              { name: "Quad Stretch", sets: 1, reps: "1 min each", desc: "Quads" },
              { name: "Calf Stretch", sets: 1, reps: "1 min each", desc: "Calves" }
            ]
          },
          {
            id: "recovery-stretch-14",
            name: "Stretch 14",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Neck Stretch", sets: 1, reps: "1 min each", desc: "Neck" },
              { name: "Chest Stretch", sets: 1, reps: "1 min", desc: "Chest" },
              { name: "Figure Four Stretch", sets: 1, reps: "1 min each", desc: "Hip" },
              { name: "Butterfly Stretch", sets: 1, reps: "2 min", desc: "Inner thigh" },
              { name: "Cat Cow", sets: 1, reps: "2 min", desc: "Spine" }
            ]
          },
          {
            id: "recovery-stretch-15",
            name: "Stretch 15",
            duration: "20 min",
            difficulty: "Advanced",
            equipment: ["Mat"],
            exercises: [
              { name: "Standing Hamstring Stretch", sets: 1, reps: "1 min each", desc: "Deep hamstring" },
              { name: "Pigeon Pose", sets: 1, reps: "2 min each", desc: "Deep hip opener" },
              { name: "Chest Doorway Stretch", sets: 1, reps: "1 min", desc: "Deep chest" },
              { name: "Tricep Stretch", sets: 1, reps: "1 min each", desc: "Triceps" },
              { name: "Lying Hamstring Stretch", sets: 1, reps: "1 min each", desc: "Hamstring release" }
            ]
          }
        ]
      },

      "foam_rolling": {
        name: "Foam Rolling",
        description: "Self-myofascial release",
        workouts: [
          {
            id: "recovery-foam-1",
            name: "Foam Rolling 1",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["Foam Roller"],
            exercises: [
              { name: "Foam Roller Quad", sets: 1, reps: "2 min each", desc: "Quad release" },
              { name: "Foam Roller Hamstring", sets: 1, reps: "2 min each", desc: "Hamstring release" },
              { name: "Foam Roller IT Band", sets: 1, reps: "2 min each", desc: "IT band work" },
              { name: "Foam Roller Calf", sets: 1, reps: "2 min each", desc: "Calf release" },
              { name: "Foam Roller Glute", sets: 1, reps: "2 min each", desc: "Glute release" }
            ]
          },
          {
            id: "recovery-foam-2",
            name: "Foam Rolling 2",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["Foam Roller"],
            exercises: [
              { name: "Foam Roller Upper Back", sets: 1, reps: "3 min", desc: "T-spine extension" },
              { name: "Foam Roller Lat", sets: 1, reps: "2 min each", desc: "Lat release" },
              { name: "Foam Roller Mid Back", sets: 1, reps: "2 min", desc: "Mid back mobility" },
              { name: "Foam Roller Chest", sets: 1, reps: "2 min each", desc: "Pec release" },
              { name: "Foam Roller Thoracic Rotation", sets: 1, reps: "2 min each", desc: "T-spine rotation" }
            ]
          },
          {
            id: "recovery-foam-3",
            name: "Foam Rolling 3",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["Foam Roller"],
            exercises: [
              { name: "Foam Roller Adductor", sets: 1, reps: "2 min each", desc: "Inner thigh release" },
              { name: "Foam Roller TFL", sets: 1, reps: "2 min each", desc: "Hip flexor area" },
              { name: "Foam Roller Hip Flexor", sets: 1, reps: "2 min each", desc: "Psoas area" },
              { name: "Foam Roller Piriformis", sets: 1, reps: "2 min each", desc: "Deep glute" },
              { name: "Foam Roller Lower Back", sets: 1, reps: "2 min", desc: "Gentle lumbar" }
            ]
          },
          {
            id: "recovery-foam-4",
            name: "Foam Rolling 4",
            duration: "20 min",
            difficulty: "Intermediate",
            equipment: ["Foam Roller"],
            exercises: [
              { name: "Foam Roller Quad Sweep", sets: 1, reps: "3 min each", desc: "Full quad work" },
              { name: "Foam Roller IT Band Slow", sets: 1, reps: "3 min each", desc: "Deep IT band" },
              { name: "Foam Roller Hamstring Pin", sets: 1, reps: "2 min each", desc: "Targeted hamstring" },
              { name: "Foam Roller Calf Rotation", sets: 1, reps: "2 min each", desc: "All angles" },
              { name: "Foam Roller Shin", sets: 1, reps: "1 min each", desc: "Tibialis release" }
            ]
          },
          {
            id: "recovery-foam-5",
            name: "Foam Rolling 5",
            duration: "20 min",
            difficulty: "Intermediate",
            equipment: ["Foam Roller"],
            exercises: [
              { name: "Foam Roller T-Spine Extension", sets: 1, reps: "3 min", desc: "Thoracic mobility" },
              { name: "Foam Roller Lat Sweep", sets: 1, reps: "2 min each", desc: "Full lat release" },
              { name: "Foam Roller Rhomboid", sets: 1, reps: "2 min", desc: "Between shoulder blades" },
              { name: "Foam Roller Pec Minor", sets: 1, reps: "2 min each", desc: "Deep chest" },
              { name: "Foam Roller Tricep", sets: 1, reps: "1 min each", desc: "Arm release" }
            ]
          },
          {
            id: "recovery-foam-6",
            name: "Foam Rolling 6",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Foam Roller"],
            exercises: [
              { name: "Foam Roller Full Quad", sets: 1, reps: "3 min each", desc: "Complete quad work" },
              { name: "Foam Roller Hamstring Sweep", sets: 1, reps: "3 min each", desc: "Full hamstring" },
              { name: "Foam Roller Glute Circle", sets: 1, reps: "2 min each", desc: "All glute areas" },
              { name: "Foam Roller Adductor Long", sets: 1, reps: "2 min each", desc: "Deep adductors" },
              { name: "Foam Roller IT Band Deep", sets: 1, reps: "2 min each", desc: "Intense IT work" }
            ]
          },
          {
            id: "recovery-foam-7",
            name: "Foam Rolling 7",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Foam Roller"],
            exercises: [
              { name: "Foam Roller Upper Back Sweep", sets: 1, reps: "3 min", desc: "Full upper back" },
              { name: "Foam Roller Lat Full", sets: 1, reps: "3 min each", desc: "Complete lat work" },
              { name: "Foam Roller T-Spine Rotation", sets: 1, reps: "2 min each", desc: "Rotational mobility" },
              { name: "Foam Roller Chest Open", sets: 1, reps: "2 min", desc: "Chest opener" },
              { name: "Foam Roller Shoulder", sets: 1, reps: "2 min each", desc: "Posterior shoulder" }
            ]
          },
          {
            id: "recovery-foam-8",
            name: "Foam Rolling 8",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["Foam Roller"],
            exercises: [
              { name: "Foam Roller Calf Medial", sets: 1, reps: "2 min each", desc: "Inner calf" },
              { name: "Foam Roller Calf Lateral", sets: 1, reps: "2 min each", desc: "Outer calf" },
              { name: "Foam Roller Peroneals", sets: 1, reps: "1 min each", desc: "Outer shin" },
              { name: "Foam Roller Shin Front", sets: 1, reps: "1 min each", desc: "Tibialis anterior" },
              { name: "Foam Roller Foot Arch", sets: 1, reps: "1 min each", desc: "Plantar release" }
            ]
          },
          {
            id: "recovery-foam-9",
            name: "Foam Rolling 9",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Foam Roller"],
            exercises: [
              { name: "Foam Roller Hip Flexor Deep", sets: 1, reps: "3 min each", desc: "Deep hip flexor" },
              { name: "Foam Roller TFL Focus", sets: 1, reps: "2 min each", desc: "TFL release" },
              { name: "Foam Roller Piriformis Pin", sets: 1, reps: "2 min each", desc: "Deep piriformis" },
              { name: "Foam Roller Glute Med", sets: 1, reps: "2 min each", desc: "Side glute" },
              { name: "Foam Roller Hip Circle", sets: 1, reps: "2 min each", desc: "All hip areas" }
            ]
          },
          {
            id: "recovery-foam-10",
            name: "Foam Rolling 10",
            duration: "25 min",
            difficulty: "Advanced",
            equipment: ["Foam Roller"],
            exercises: [
              { name: "Foam Roller Quad Pin and Stretch", sets: 1, reps: "3 min each", desc: "Pin and move" },
              { name: "Foam Roller Hamstring Contract Relax", sets: 1, reps: "3 min each", desc: "Active release" },
              { name: "Foam Roller IT Band Crossover", sets: 1, reps: "2 min each", desc: "Deep crossover" },
              { name: "Foam Roller Calf Contract Relax", sets: 1, reps: "2 min each", desc: "Active calf" },
              { name: "Foam Roller Glute Contract Relax", sets: 1, reps: "2 min each", desc: "Active glute" }
            ]
          },
          {
            id: "recovery-foam-11",
            name: "Foam Rolling 11",
            duration: "25 min",
            difficulty: "Advanced",
            equipment: ["Foam Roller"],
            exercises: [
              { name: "Foam Roller T-Spine Pin and Reach", sets: 1, reps: "3 min", desc: "Active thoracic" },
              { name: "Foam Roller Lat Contract Relax", sets: 1, reps: "2 min each", desc: "Active lat work" },
              { name: "Foam Roller Chest Contract Relax", sets: 1, reps: "2 min each", desc: "Active pec" },
              { name: "Foam Roller Upper Back Wave", sets: 1, reps: "3 min", desc: "Wave technique" },
              { name: "Foam Roller Shoulder Pin", sets: 1, reps: "2 min each", desc: "Shoulder focus" }
            ]
          },
          {
            id: "recovery-foam-12",
            name: "Foam Rolling 12",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["Foam Roller"],
            exercises: [
              { name: "Foam Roller Quad Full Length", sets: 1, reps: "3 min each", desc: "Complete quad" },
              { name: "Foam Roller Hamstring Full", sets: 1, reps: "3 min each", desc: "Complete hamstring" },
              { name: "Foam Roller Upper Back Complete", sets: 1, reps: "3 min", desc: "Full upper back" },
              { name: "Foam Roller Lat Complete", sets: 1, reps: "2 min each", desc: "Full lat" },
              { name: "Foam Roller Glute Complete", sets: 1, reps: "2 min each", desc: "Full glute" }
            ]
          },
          {
            id: "recovery-foam-13",
            name: "Foam Rolling 13",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["Foam Roller"],
            exercises: [
              { name: "Foam Roller IT Band Gentle", sets: 1, reps: "2 min each", desc: "Light IT band" },
              { name: "Foam Roller Quad Gentle", sets: 1, reps: "2 min each", desc: "Light quad" },
              { name: "Foam Roller Upper Back Light", sets: 1, reps: "2 min", desc: "Light upper back" },
              { name: "Foam Roller Calf Light", sets: 1, reps: "2 min each", desc: "Light calf" },
              { name: "Foam Roller Glute Light", sets: 1, reps: "2 min each", desc: "Light glute" }
            ]
          },
          {
            id: "recovery-foam-14",
            name: "Foam Rolling 14",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Foam Roller"],
            exercises: [
              { name: "Foam Roller Adductor Deep", sets: 1, reps: "3 min each", desc: "Deep inner thigh" },
              { name: "Foam Roller Hip Flexor Complete", sets: 1, reps: "3 min each", desc: "Full hip flexor" },
              { name: "Foam Roller Glute Med Deep", sets: 1, reps: "2 min each", desc: "Deep side glute" },
              { name: "Foam Roller TFL Complete", sets: 1, reps: "2 min each", desc: "Full TFL" },
              { name: "Foam Roller Piriformis Deep", sets: 1, reps: "2 min each", desc: "Deep piriformis" }
            ]
          },
          {
            id: "recovery-foam-15",
            name: "Foam Rolling 15",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["Foam Roller"],
            exercises: [
              { name: "Foam Roller Full Body Sweep Lower", sets: 1, reps: "5 min", desc: "Complete lower body" },
              { name: "Foam Roller Full Body Sweep Upper", sets: 1, reps: "5 min", desc: "Complete upper body" },
              { name: "Foam Roller Hip Complex", sets: 1, reps: "4 min each", desc: "All hip muscles" },
              { name: "Foam Roller T-Spine Complex", sets: 1, reps: "3 min", desc: "All thoracic work" },
              { name: "Foam Roller Problem Areas", sets: 1, reps: "3 min", desc: "Personal focus areas" }
            ]
          }
        ]
      },

      "active_recovery": {
        name: "Active Recovery",
        description: "Light movement to promote recovery",
        workouts: [
          {
            id: "recovery-active-1",
            name: "Active Recovery 1",
            duration: "25 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Walking in Place", sets: 1, reps: "5 min", desc: "Light warmup" },
              { name: "Cat Cow", sets: 1, reps: "2 min", desc: "Spinal mobility" },
              { name: "Hip Circles", sets: 1, reps: "2 min each", desc: "Hip mobility" },
              { name: "Arm Circles", sets: 1, reps: "2 min", desc: "Shoulder warmth" },
              { name: "Gentle Twist", sets: 1, reps: "2 min each", desc: "Spinal rotation" }
            ]
          },
          {
            id: "recovery-active-2",
            name: "Active Recovery 2",
            duration: "25 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "World's Greatest Stretch", sets: 1, reps: "2 min each", desc: "Full body opener" },
              { name: "Thread the Needle", sets: 1, reps: "2 min each", desc: "Thoracic rotation" },
              { name: "90/90 Hip Stretch", sets: 1, reps: "2 min each", desc: "Hip mobility" },
              { name: "Child's Pose", sets: 1, reps: "3 min", desc: "Rest position" },
              { name: "Seated Forward Fold", sets: 1, reps: "3 min", desc: "Hamstring release" }
            ]
          },
          {
            id: "recovery-active-3",
            name: "Active Recovery 3",
            duration: "25 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Downward Dog", sets: 1, reps: "2 min", desc: "Full body stretch" },
              { name: "Low Lunge", sets: 1, reps: "2 min each", desc: "Hip flexor release" },
              { name: "Pigeon Pose", sets: 1, reps: "2 min each", desc: "Hip opener" },
              { name: "Supine Twist", sets: 1, reps: "2 min each", desc: "Spinal release" },
              { name: "Knees to Chest", sets: 1, reps: "2 min", desc: "Lower back release" }
            ]
          },
          {
            id: "recovery-active-4",
            name: "Active Recovery 4",
            duration: "25 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Gentle March", sets: 1, reps: "3 min", desc: "Light movement" },
              { name: "Neck Circles", sets: 1, reps: "2 min", desc: "Neck release" },
              { name: "Shoulder Rolls", sets: 1, reps: "2 min", desc: "Shoulder mobility" },
              { name: "Side Bend", sets: 1, reps: "2 min each", desc: "Lateral stretch" },
              { name: "Standing Forward Fold", sets: 1, reps: "3 min", desc: "Hamstrings and back" }
            ]
          },
          {
            id: "recovery-active-5",
            name: "Active Recovery 5",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Sun Salutation A Modified", sets: 1, reps: "5 rounds", desc: "Gentle flow" },
              { name: "Lizard Pose", sets: 1, reps: "2 min each", desc: "Deep hip stretch" },
              { name: "Cobra Pose", sets: 1, reps: "2 min", desc: "Gentle backbend" },
              { name: "Figure Four Stretch", sets: 1, reps: "2 min each", desc: "Hip and glute" },
              { name: "Savasana", sets: 1, reps: "3 min", desc: "Final rest" }
            ]
          },
          {
            id: "recovery-active-6",
            name: "Active Recovery 6",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Bird Dog", sets: 1, reps: "10 each slow", desc: "Core stability" },
              { name: "Dead Bug", sets: 1, reps: "10 each slow", desc: "Core activation" },
              { name: "Glute Bridge Hold", sets: 1, reps: "5 x 30 sec", desc: "Glute activation" },
              { name: "Side Lying Leg Raise", sets: 1, reps: "10 each slow", desc: "Hip abduction" },
              { name: "Prone Y Raise", sets: 1, reps: "10 slow", desc: "Upper back activation" }
            ]
          },
          {
            id: "recovery-active-7",
            name: "Active Recovery 7",
            duration: "25 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Ankle Circles", sets: 1, reps: "2 min each", desc: "Ankle mobility" },
              { name: "Calf Raises Slow", sets: 1, reps: "20 slow", desc: "Calf activation" },
              { name: "Quad Stretch Standing", sets: 1, reps: "2 min each", desc: "Quad release" },
              { name: "Standing Hip Circles", sets: 1, reps: "2 min each", desc: "Hip mobility" },
              { name: "Wall Sit Light", sets: 1, reps: "3 x 30 sec", desc: "Light leg activation" }
            ]
          },
          {
            id: "recovery-active-8",
            name: "Active Recovery 8",
            duration: "25 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Wrist Circles", sets: 1, reps: "2 min", desc: "Wrist mobility" },
              { name: "Finger Stretches", sets: 1, reps: "2 min", desc: "Hand release" },
              { name: "Forearm Stretch", sets: 1, reps: "2 min each", desc: "Forearm release" },
              { name: "Chest Doorway Stretch", sets: 1, reps: "2 min each", desc: "Chest opener" },
              { name: "Upper Trap Stretch", sets: 1, reps: "2 min each", desc: "Neck and shoulder" }
            ]
          },
          {
            id: "recovery-active-9",
            name: "Active Recovery 9",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Half Kneeling Hip Flexor Stretch", sets: 1, reps: "2 min each", desc: "Hip flexor release" },
              { name: "Frog Stretch", sets: 1, reps: "3 min", desc: "Adductor stretch" },
              { name: "Couch Stretch", sets: 1, reps: "2 min each", desc: "Quad and hip flexor" },
              { name: "Spiderman Stretch", sets: 1, reps: "2 min each", desc: "Hip mobility" },
              { name: "Scorpion Stretch", sets: 1, reps: "2 min each", desc: "Hip and spine" }
            ]
          },
          {
            id: "recovery-active-10",
            name: "Active Recovery 10",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Band Pull Apart Slow", sets: 1, reps: "20 slow", desc: "Upper back activation" },
              { name: "Face Pull Slow", sets: 1, reps: "15 slow", desc: "Rear delt activation" },
              { name: "Scapular Push Up", sets: 1, reps: "15 slow", desc: "Scapular control" },
              { name: "Wall Angels", sets: 1, reps: "15 slow", desc: "Shoulder mobility" },
              { name: "Prone Cobra Hold", sets: 1, reps: "5 x 20 sec", desc: "Upper back endurance" }
            ]
          },
          {
            id: "recovery-active-11",
            name: "Active Recovery 11",
            duration: "25 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Legs Up the Wall", sets: 1, reps: "5 min", desc: "Leg drainage" },
              { name: "Happy Baby Pose", sets: 1, reps: "3 min", desc: "Hip opener" },
              { name: "Reclined Butterfly", sets: 1, reps: "3 min", desc: "Inner thigh release" },
              { name: "Knees to Chest Rock", sets: 1, reps: "3 min", desc: "Spinal massage" },
              { name: "Corpse Pose", sets: 1, reps: "5 min", desc: "Full relaxation" }
            ]
          },
          {
            id: "recovery-active-12",
            name: "Active Recovery 12",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Controlled Articular Rotations Hip", sets: 1, reps: "5 each way", desc: "Hip CARs" },
              { name: "Controlled Articular Rotations Shoulder", sets: 1, reps: "5 each way", desc: "Shoulder CARs" },
              { name: "Controlled Articular Rotations Spine", sets: 1, reps: "5 each way", desc: "Spine CARs" },
              { name: "Controlled Articular Rotations Ankle", sets: 1, reps: "5 each way", desc: "Ankle CARs" },
              { name: "Controlled Articular Rotations Wrist", sets: 1, reps: "5 each way", desc: "Wrist CARs" }
            ]
          },
          {
            id: "recovery-active-13",
            name: "Active Recovery 13",
            duration: "25 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Diaphragmatic Breathing", sets: 1, reps: "5 min", desc: "Deep breathing" },
              { name: "Box Breathing", sets: 1, reps: "5 min", desc: "Breath control" },
              { name: "Body Scan Relaxation", sets: 1, reps: "5 min", desc: "Mental release" },
              { name: "Gentle Neck Stretch", sets: 1, reps: "2 min each", desc: "Neck release" },
              { name: "Seated Meditation", sets: 1, reps: "5 min", desc: "Mind calm" }
            ]
          },
          {
            id: "recovery-active-14",
            name: "Active Recovery 14",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Crocodile Breathing", sets: 1, reps: "5 min", desc: "Diaphragm activation" },
              { name: "Quadruped Rock Back", sets: 1, reps: "3 min", desc: "Hip and spine mobility" },
              { name: "Half Kneeling Rotation", sets: 1, reps: "2 min each", desc: "Thoracic rotation" },
              { name: "Tall Kneeling Hip Hinge", sets: 1, reps: "2 min", desc: "Hip hinge pattern" },
              { name: "Squat Hold", sets: 1, reps: "3 min total", desc: "Deep squat mobility" }
            ]
          },
          {
            id: "recovery-active-15",
            name: "Active Recovery 15",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["Mat"],
            exercises: [
              { name: "Flow Sequence A", sets: 1, reps: "5 min", desc: "Movement integration" },
              { name: "Flow Sequence B", sets: 1, reps: "5 min", desc: "Continuous movement" },
              { name: "Ground Flow", sets: 1, reps: "5 min", desc: "Floor transitions" },
              { name: "Standing Flow", sets: 1, reps: "5 min", desc: "Standing transitions" },
              { name: "Integration Rest", sets: 1, reps: "5 min", desc: "Full body rest" }
            ]
          }
        ]
      }
    }
  },

  // ====================
  // RESISTANCE BANDS
  // ====================
  "bands": {
    name: "Resistance Bands",
    icon: "🎯",
    description: "Complete band-based workouts for any fitness level",
    subcategories: {

      // UPPER BODY BAND WORKOUTS
      "upper": {
        name: "Upper Body",
        description: "Build upper body strength with resistance bands",
        workouts: [
          {
            id: "bands-upper-1",
            name: "Band Upper 1 - Push Focus",
            duration: "35 min",
            difficulty: "Intermediate",
            equipment: ["Resistance Bands", "Door Anchor"],
            exercises: [
              { name: "Band Anchored Chest Press", sets: 4, reps: "12-15", desc: "Chest builder" },
              { name: "Band Anchored Decline Chest Press", sets: 4, reps: "12-15", desc: "Lower chest focus" },
              { name: "Band Shoulder Press", sets: 4, reps: "10-12", desc: "Shoulder development" },
              { name: "Band Anchored Tricep Pushdown", sets: 3, reps: "12-15", desc: "Tricep isolation" },
              { name: "Band Lateral Raise", sets: 3, reps: "15-20", desc: "Side delt finisher" }
            ]
          },
          {
            id: "bands-upper-2",
            name: "Band Upper 2 - Pull Focus",
            duration: "35 min",
            difficulty: "Intermediate",
            equipment: ["Resistance Bands", "Door Anchor"],
            exercises: [
              { name: "Band Lat Pull Down", sets: 4, reps: "12-15", desc: "Lat development" },
              { name: "Band Bent Over Row", sets: 4, reps: "12-15", desc: "Back thickness" },
              { name: "SuperBand Face Pulls", sets: 4, reps: "15-20", desc: "Rear delts and upper back" },
              { name: "Band Bicep Curl", sets: 3, reps: "12-15", desc: "Bicep builder" },
              { name: "Mini Band Pull Aparts", sets: 3, reps: "20-25", desc: "Shoulder health" }
            ]
          },
          {
            id: "bands-upper-3",
            name: "Band Upper 3 - Chest & Back",
            duration: "40 min",
            difficulty: "Advanced",
            equipment: ["Resistance Bands", "Door Anchor"],
            exercises: [
              { name: "SuperBand Push Up", sets: 4, reps: "10-12", desc: "Weighted push up variation" },
              { name: "Band Anchored Chest Fly", sets: 3, reps: "12-15", desc: "Chest stretch and squeeze" },
              { name: "Band Standing Row", sets: 4, reps: "12-15", desc: "Mid-back rows" },
              { name: "Band Single Arm Lat Pull Down", sets: 3, reps: "10-12 each", desc: "Unilateral lat work" },
              { name: "Band Upright Row", sets: 3, reps: "12-15", desc: "Upper trap and delt work" }
            ]
          },
          {
            id: "bands-upper-4",
            name: "Band Upper 4 - Arms & Shoulders",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["Resistance Bands", "Door Anchor"],
            exercises: [
              { name: "Band Alternating Shoulder Press", sets: 3, reps: "10-12 each", desc: "Shoulder strength" },
              { name: "Band Front To Lateral Raise", sets: 3, reps: "12-15", desc: "Delt combo move" },
              { name: "Band Single Arm Bicep Curl", sets: 3, reps: "12-15 each", desc: "Bicep isolation" },
              { name: "Band Overhead Tricep Extension", sets: 3, reps: "12-15", desc: "Tricep stretch" },
              { name: "Mini Band Bent Over Y's", sets: 3, reps: "15-20", desc: "Rear delt and trap activation" }
            ]
          },
          {
            id: "bands-upper-5",
            name: "Band Upper 5 - Complete Upper",
            duration: "40 min",
            difficulty: "Intermediate",
            equipment: ["Resistance Bands", "Door Anchor", "Mini Band"],
            exercises: [
              { name: "Band Anchored Standing Incline Chest Press", sets: 4, reps: "12-15", desc: "Upper chest press" },
              { name: "SuperBand Seated Row", sets: 4, reps: "12-15", desc: "Horizontal pulling" },
              { name: "Band Alternating Front Raise", sets: 3, reps: "12-15 each", desc: "Front delt work" },
              { name: "Band Alternating Bicep Curl", sets: 3, reps: "12-15 each", desc: "Alternating curls" },
              { name: "Band Tricep Kickback", sets: 3, reps: "12-15", desc: "Tricep finisher" },
              { name: "Mini Band External Rotation", sets: 2, reps: "15-20", desc: "Rotator cuff health" }
            ]
          }
        ]
      },

      // LOWER BODY BAND WORKOUTS
      "lower": {
        name: "Lower Body",
        description: "Strengthen legs and glutes with resistance bands",
        workouts: [
          {
            id: "bands-lower-1",
            name: "Band Lower 1 - Glute Focus",
            duration: "35 min",
            difficulty: "Intermediate",
            equipment: ["Resistance Bands", "Mini Band"],
            exercises: [
              { name: "SuperBand Glute Bridge", sets: 4, reps: "15-20", desc: "Glute activation" },
              { name: "SuperBand Deadlift", sets: 4, reps: "12-15", desc: "Posterior chain builder" },
              { name: "Mini Band Glute Kickback", sets: 3, reps: "15-20 each", desc: "Glute isolation" },
              { name: "Mini Band Fire Hydrants", sets: 3, reps: "15-20 each", desc: "Glute med activation" },
              { name: "Mini Band Clamshell", sets: 3, reps: "20-25 each", desc: "Hip external rotation" }
            ]
          },
          {
            id: "bands-lower-2",
            name: "Band Lower 2 - Quad Focus",
            duration: "35 min",
            difficulty: "Intermediate",
            equipment: ["Resistance Bands", "Mini Band"],
            exercises: [
              { name: "Resistance Band Squat", sets: 4, reps: "15-20", desc: "Quad builder" },
              { name: "Band Split Squat", sets: 4, reps: "12-15 each", desc: "Single leg strength" },
              { name: "Mini Band Squat", sets: 3, reps: "20-25", desc: "Quad burn with abduction" },
              { name: "Band Reverse Lunge", sets: 3, reps: "12-15 each", desc: "Lunge variation" },
              { name: "Mini Band Wall Sit with Abductions", sets: 3, reps: "30-45 sec", desc: "Isometric quad and glute work" }
            ]
          },
          {
            id: "bands-lower-3",
            name: "Band Lower 3 - Hamstring Focus",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["Resistance Bands", "Mini Band"],
            exercises: [
              { name: "SuperBand Deadlift", sets: 4, reps: "12-15", desc: "Hamstring and glute work" },
              { name: "Band Pull Through", sets: 4, reps: "15-20", desc: "Hip hinge pattern" },
              { name: "Mini Band Single Leg Glute Bridge", sets: 3, reps: "12-15 each", desc: "Unilateral glute work" },
              { name: "Mini Band Single Leg Deadlift", sets: 3, reps: "10-12 each", desc: "Balance and hamstrings" },
              { name: "Band Calf Raise", sets: 3, reps: "15-20", desc: "Calf finisher" }
            ]
          },
          {
            id: "bands-lower-4",
            name: "Band Lower 4 - Hip & Glute",
            duration: "40 min",
            difficulty: "Advanced",
            equipment: ["Resistance Bands", "Mini Band"],
            exercises: [
              { name: "SuperBand Single Leg Glute Bridge", sets: 4, reps: "12-15 each", desc: "Advanced glute work" },
              { name: "SuperBand Kneeling Hip Thrust", sets: 4, reps: "15-20", desc: "Hip thrust variation" },
              { name: "Mini Band Lateral Squat Walk (Knees)", sets: 3, reps: "10-12 each way", desc: "Lateral movement" },
              { name: "Mini Band Side Lying Hip Abduction", sets: 3, reps: "15-20 each", desc: "Glute med isolation" },
              { name: "Mini Band Standing Hip Abduction", sets: 3, reps: "15-20 each", desc: "Standing abduction" },
              { name: "Mini Band Frog Pumps", sets: 3, reps: "20-25", desc: "Glute finisher" }
            ]
          },
          {
            id: "bands-lower-5",
            name: "Band Lower 5 - Complete Lower",
            duration: "40 min",
            difficulty: "Intermediate",
            equipment: ["Resistance Bands", "Mini Band"],
            exercises: [
              { name: "Superband Squat", sets: 4, reps: "15-20", desc: "Compound leg movement" },
              { name: "Superband Good Morning", sets: 4, reps: "12-15", desc: "Hamstring and lower back" },
              { name: "Band Lying Leg Press", sets: 3, reps: "15-20", desc: "Leg press variation" },
              { name: "Resistance Band Lateral Lunge", sets: 3, reps: "12-15 each", desc: "Lateral strength" },
              { name: "Mini Band Glute Bridge", sets: 3, reps: "20-25", desc: "Glute pump" },
              { name: "Mini Band Donkey Kicks", sets: 3, reps: "15-20 each", desc: "Glute isolation finisher" }
            ]
          }
        ]
      },

      // FULL BODY BAND WORKOUTS
      "fullbody": {
        name: "Full Body",
        description: "Complete full body resistance band training",
        workouts: [
          {
            id: "bands-fullbody-1",
            name: "Band Full Body 1",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Resistance Bands", "Mini Band", "Door Anchor"],
            exercises: [
              { name: "SuperBand Thruster", sets: 4, reps: "12-15", desc: "Full body compound" },
              { name: "Band Anchored Squat to Row", sets: 4, reps: "12-15", desc: "Legs and back combo" },
              { name: "Band Anchored Chest Press", sets: 3, reps: "12-15", desc: "Chest work" },
              { name: "Band Lat Pull Down", sets: 3, reps: "12-15", desc: "Lat development" },
              { name: "SuperBand Pallof Press", sets: 3, reps: "12-15 each", desc: "Anti-rotation core" },
              { name: "Mini Band Glute Bridge", sets: 3, reps: "15-20", desc: "Glute finisher" }
            ]
          },
          {
            id: "bands-fullbody-2",
            name: "Band Full Body 2",
            duration: "40 min",
            difficulty: "Beginner",
            equipment: ["Resistance Bands", "Mini Band"],
            exercises: [
              { name: "Resistance Band Squat", sets: 3, reps: "15-20", desc: "Leg foundation" },
              { name: "Band Standing Row", sets: 3, reps: "12-15", desc: "Back rows" },
              { name: "Band Shoulder Press", sets: 3, reps: "10-12", desc: "Shoulder press" },
              { name: "Band Bicep Curl", sets: 3, reps: "12-15", desc: "Bicep work" },
              { name: "Band Overhead Tricep Extension", sets: 3, reps: "12-15", desc: "Tricep extension" },
              { name: "Mini Band Mountain Climbers", sets: 3, reps: "30 sec", desc: "Core and cardio finisher" }
            ]
          },
          {
            id: "bands-fullbody-3",
            name: "Band Full Body 3 - Athletic",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Resistance Bands", "Mini Band"],
            exercises: [
              { name: "Superband Deadlift to Row", sets: 4, reps: "10-12", desc: "Compound power move" },
              { name: "Banded Thruster", sets: 4, reps: "12-15", desc: "Legs and shoulders" },
              { name: "SuperBand Push Up", sets: 3, reps: "12-15", desc: "Weighted push variation" },
              { name: "Band Lunge to Curl", sets: 3, reps: "10-12 each", desc: "Leg and arm combo" },
              { name: "SuperBand Mountain Climber", sets: 3, reps: "30 sec", desc: "Core stability" },
              { name: "Mini Band Plank Alternating Leg Lift", sets: 3, reps: "10-12 each", desc: "Core and glute" }
            ]
          },
          {
            id: "bands-fullbody-4",
            name: "Band Full Body 4 - Strength",
            duration: "50 min",
            difficulty: "Intermediate",
            equipment: ["Resistance Bands", "Mini Band", "Door Anchor"],
            exercises: [
              { name: "SuperBand Deadlift", sets: 4, reps: "12-15", desc: "Posterior chain" },
              { name: "Band Anchored Chest Press", sets: 4, reps: "12-15", desc: "Chest press" },
              { name: "Band Bent Over Row", sets: 4, reps: "12-15", desc: "Back rows" },
              { name: "Band Split Squat", sets: 3, reps: "12-15 each", desc: "Single leg work" },
              { name: "Band Pallof Press", sets: 3, reps: "12-15 each", desc: "Core stability" },
              { name: "Band Alternating Shoulder Press", sets: 3, reps: "10-12 each", desc: "Shoulder work" },
              { name: "Mini Band Bicycle Crunch", sets: 3, reps: "20-25", desc: "Core finisher" }
            ]
          },
          {
            id: "bands-fullbody-5",
            name: "Band Full Body 5 - Functional",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Resistance Bands", "Mini Band"],
            exercises: [
              { name: "Reverse Lunge to Band Pull Apart", sets: 4, reps: "12-15 each", desc: "Leg and back combo" },
              { name: "SuperBand Overhead Squat", sets: 3, reps: "12-15", desc: "Overhead stability squat" },
              { name: "SuperBand Standing Row", sets: 4, reps: "12-15", desc: "Standing row" },
              { name: "Resistance Band Chest Press", sets: 3, reps: "12-15", desc: "Chest press" },
              { name: "Half Kneeling Band Pallof Press", sets: 3, reps: "12-15 each", desc: "Anti-rotation" },
              { name: "Mini Band Bear Crawl (Around Legs)", sets: 3, reps: "30 sec", desc: "Full body crawl" },
              { name: "Band Pull Through", sets: 3, reps: "15-20", desc: "Hip hinge finisher" }
            ]
          }
        ]
      }
    }
  },

  // ====================
  // HIIT TRAINING
  // ====================
  "hiit": {
    name: "HIIT Training",
    icon: "⚡",
    description: "High-intensity interval training for maximum calorie burn",
    subcategories: {

      // BODYWEIGHT HIIT
      "bodyweight": {
        name: "Bodyweight HIIT",
        description: "No equipment needed — just you and max effort",
        workouts: [
          {
            id: "hiit-bodyweight-1",
            name: "Bodyweight Blitz 1",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["None"],
            exercises: [
              { name: "Jumping Jack", sets: 4, reps: "40 sec", desc: "Full body warm-up cardio" },
              { name: "Mountain Climber", sets: 4, reps: "30 sec", desc: "Core and cardio burst" },
              { name: "Push Up", sets: 4, reps: "30 sec", desc: "Upper body push" },
              { name: "High Knees", sets: 4, reps: "30 sec", desc: "Cardio intensity" },
              { name: "Plank Hip Twist", sets: 4, reps: "30 sec", desc: "Core rotational work" }
            ]
          },
          {
            id: "hiit-bodyweight-2",
            name: "Bodyweight Blitz 2",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["None"],
            exercises: [
              { name: "High Knees", sets: 4, reps: "40 sec", desc: "Cardio blast" },
              { name: "Push Up", sets: 4, reps: "30 sec", desc: "Chest and triceps" },
              { name: "Skater", sets: 4, reps: "30 sec", desc: "Lateral power" },
              { name: "Plank Alternating Leg Lift", sets: 4, reps: "30 sec", desc: "Core stability" },
              { name: "Pulse Sumo Squats", sets: 4, reps: "30 sec", desc: "Lower body burn" }
            ]
          },
          {
            id: "hiit-bodyweight-3",
            name: "Bodyweight Blitz 3",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Burpee", sets: 5, reps: "30 sec", desc: "Full body power" },
              { name: "Mountain Climber", sets: 5, reps: "40 sec", desc: "Core cardio" },
              { name: "Jump Squat", sets: 5, reps: "30 sec", desc: "Lower body explosive" },
              { name: "Push Up to T-rotation", sets: 5, reps: "30 sec", desc: "Push with rotation" },
              { name: "High Plank Jacks", sets: 5, reps: "30 sec", desc: "Plank cardio" }
            ]
          },
          {
            id: "hiit-bodyweight-4",
            name: "Bodyweight Blitz 4",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Alternating Jump Lunge", sets: 5, reps: "30 sec", desc: "Explosive lunges" },
              { name: "Cross Body Mountain Climber", sets: 5, reps: "40 sec", desc: "Oblique focus" },
              { name: "Burpee", sets: 5, reps: "30 sec", desc: "Full body conditioning" },
              { name: "Jumping Jack", sets: 5, reps: "40 sec", desc: "Active recovery cardio" },
              { name: "Oblique Crunch", sets: 5, reps: "30 sec", desc: "Core finisher" }
            ]
          },
          {
            id: "hiit-bodyweight-5",
            name: "Bodyweight Blitz 5",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "High Knees", sets: 5, reps: "40 sec", desc: "Sprint in place" },
              { name: "Tuck Jump to Push Up", sets: 5, reps: "30 sec", desc: "Explosive combo" },
              { name: "Skater", sets: 5, reps: "30 sec", desc: "Lateral agility" },
              { name: "Mountain Climbers to Plank Jack", sets: 5, reps: "40 sec", desc: "Core complex" },
              { name: "Reverse Burpee", sets: 5, reps: "30 sec", desc: "Full body reverse" },
              { name: "Pulse Squat to Curtsy Pulse", sets: 5, reps: "30 sec", desc: "Lower body burn" }
            ]
          },
          {
            id: "hiit-bodyweight-6",
            name: "Bodyweight Blitz 6",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["None"],
            exercises: [
              { name: "Jumping Jack", sets: 4, reps: "40 sec", desc: "Get the heart rate up" },
              { name: "Slow Mountain Climbers", sets: 4, reps: "30 sec", desc: "Controlled core work" },
              { name: "Push Up", sets: 4, reps: "30 sec", desc: "Upper body strength" },
              { name: "Pogo Hops", sets: 4, reps: "30 sec", desc: "Calf and ankle cardio" },
              { name: "Plank Alternating Arm & Leg Lift", sets: 4, reps: "30 sec", desc: "Balance and core" }
            ]
          },
          {
            id: "hiit-bodyweight-7",
            name: "Bodyweight Blitz 7",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Burpee", sets: 5, reps: "30 sec", desc: "Full body explosive" },
              { name: "Push Up to Cross Body Mountain Climbers", sets: 5, reps: "40 sec", desc: "Push and core combo" },
              { name: "Jump Squat", sets: 5, reps: "30 sec", desc: "Quad and glute power" },
              { name: "High Plank Jacks", sets: 5, reps: "30 sec", desc: "Plank cardio" },
              { name: "Alternating Jump Lunge", sets: 5, reps: "30 sec", desc: "Single leg explosive" }
            ]
          },
          {
            id: "hiit-bodyweight-8",
            name: "Bodyweight Blitz 8",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "Burpee to Tuck Jump", sets: 6, reps: "30 sec", desc: "Max intensity burst" },
              { name: "Mountain Climber", sets: 6, reps: "40 sec", desc: "Speed core work" },
              { name: "Tuck Jump to Push Up", sets: 6, reps: "30 sec", desc: "Explosive full body" },
              { name: "Skater", sets: 6, reps: "30 sec", desc: "Lateral power" },
              { name: "Cross Body Mountain Climber", sets: 6, reps: "40 sec", desc: "Oblique shred" },
              { name: "Piked Push Up", sets: 6, reps: "30 sec", desc: "Shoulder burner" }
            ]
          },
          {
            id: "hiit-bodyweight-9",
            name: "Bodyweight Blitz 9",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "Burpee Broad Jump", sets: 6, reps: "30 sec", desc: "Explosive distance" },
              { name: "High Knees", sets: 6, reps: "40 sec", desc: "Sprint intervals" },
              { name: "Push Up to T-rotation", sets: 6, reps: "30 sec", desc: "Anti-rotation push" },
              { name: "Jump Squat", sets: 6, reps: "30 sec", desc: "Plyometric legs" },
              { name: "Oblique Mountain Climbers", sets: 6, reps: "40 sec", desc: "Oblique focused" },
              { name: "Reverse Burpee", sets: 6, reps: "30 sec", desc: "Coordination challenge" }
            ]
          },
          {
            id: "hiit-bodyweight-10",
            name: "Bodyweight Blitz 10",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "High Knee Skipping", sets: 5, reps: "40 sec", desc: "Explosive cardio" },
              { name: "Burpee", sets: 5, reps: "30 sec", desc: "Classic full body" },
              { name: "Plank Hip Twist", sets: 5, reps: "30 sec", desc: "Rotational core" },
              { name: "Jumping Jack", sets: 5, reps: "40 sec", desc: "Active recovery" },
              { name: "Push Up", sets: 5, reps: "30 sec", desc: "Push endurance" },
              { name: "Mountain Climber", sets: 5, reps: "30 sec", desc: "Core finisher" }
            ]
          },
          {
            id: "hiit-bodyweight-11",
            name: "Bodyweight Blitz 11",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["None"],
            exercises: [
              { name: "Jumping Jack", sets: 4, reps: "40 sec", desc: "Warm up and go" },
              { name: "Mountain Climber", sets: 4, reps: "30 sec", desc: "Core cardio" },
              { name: "Pulse Lateral Lunge", sets: 4, reps: "30 sec", desc: "Inner thigh focus" },
              { name: "High Knees", sets: 4, reps: "30 sec", desc: "Cardio spike" },
              { name: "Push Up", sets: 4, reps: "30 sec", desc: "Upper body push" }
            ]
          },
          {
            id: "hiit-bodyweight-12",
            name: "Bodyweight Blitz 12",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Burpee to Target", sets: 5, reps: "30 sec", desc: "Targeted burpee" },
              { name: "Skater", sets: 5, reps: "30 sec", desc: "Lateral explosiveness" },
              { name: "High Plank Jacks", sets: 5, reps: "30 sec", desc: "Plank with cardio" },
              { name: "Alternating Jump Lunge", sets: 5, reps: "30 sec", desc: "Split jump power" },
              { name: "Cross Body Mountain Climber", sets: 5, reps: "40 sec", desc: "Oblique emphasis" },
              { name: "Jump Squat", sets: 5, reps: "30 sec", desc: "Leg power finisher" }
            ]
          },
          {
            id: "hiit-bodyweight-13",
            name: "Bodyweight Blitz 13",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "Burpee to Tuck Jump", sets: 6, reps: "30 sec", desc: "Max power output" },
              { name: "Push Up to Cross Body Mountain Climbers", sets: 6, reps: "40 sec", desc: "Upper and core" },
              { name: "Alternating Jump Lunge", sets: 6, reps: "30 sec", desc: "Single leg plyos" },
              { name: "High Knees", sets: 6, reps: "40 sec", desc: "Sprint work" },
              { name: "Reverse Burpee", sets: 6, reps: "30 sec", desc: "Full body reverse" },
              { name: "Pistol Squat to Sit", sets: 6, reps: "30 sec", desc: "Unilateral leg strength" }
            ]
          },
          {
            id: "hiit-bodyweight-14",
            name: "Bodyweight Blitz 14",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["None"],
            exercises: [
              { name: "High Knees", sets: 4, reps: "40 sec", desc: "Quick feet" },
              { name: "Slow Mountain Climbers", sets: 4, reps: "30 sec", desc: "Controlled pace" },
              { name: "Jumping Jack", sets: 4, reps: "40 sec", desc: "Classic cardio" },
              { name: "Push Up", sets: 4, reps: "30 sec", desc: "Strength intervals" },
              { name: "Plank Alternating Leg Lift", sets: 4, reps: "30 sec", desc: "Core stability" }
            ]
          },
          {
            id: "hiit-bodyweight-15",
            name: "Bodyweight Blitz 15",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "Burpee Broad Jump", sets: 6, reps: "30 sec", desc: "Distance power" },
              { name: "Tuck Jump to Push Up", sets: 6, reps: "30 sec", desc: "Complex combo" },
              { name: "Mountain Climbers to Plank Jack", sets: 6, reps: "40 sec", desc: "Core complex" },
              { name: "Jump Squat", sets: 6, reps: "30 sec", desc: "Explosive legs" },
              { name: "Piked Push Up", sets: 6, reps: "30 sec", desc: "Shoulder intensity" },
              { name: "Skater", sets: 6, reps: "30 sec", desc: "Lateral finisher" }
            ]
          }
        ]
      },

      // DUMBBELL HIIT
      "dumbbell": {
        name: "Dumbbell HIIT",
        description: "High-intensity circuits with dumbbells",
        workouts: [
          {
            id: "hiit-dumbbell-1",
            name: "Dumbbell Fire 1",
            duration: "25 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Squat to Press", sets: 4, reps: "40 sec", desc: "Full body compound" },
              { name: "Mountain Climber", sets: 4, reps: "30 sec", desc: "Bodyweight cardio" },
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "40 sec", desc: "Posterior chain" },
              { name: "Push Up", sets: 4, reps: "30 sec", desc: "Bodyweight push" },
              { name: "Dumbbell Goblet Squat", sets: 4, reps: "40 sec", desc: "Front loaded squat" }
            ]
          },
          {
            id: "hiit-dumbbell-2",
            name: "Dumbbell Fire 2",
            duration: "25 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Walking Lunge", sets: 4, reps: "40 sec", desc: "Walking legs" },
              { name: "Jumping Jack", sets: 4, reps: "30 sec", desc: "Cardio burst" },
              { name: "Dumbbell Standing Shoulder Press", sets: 4, reps: "40 sec", desc: "Overhead press" },
              { name: "High Knees", sets: 4, reps: "30 sec", desc: "Cardio spike" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "40 sec", desc: "Rear delt work" }
            ]
          },
          {
            id: "hiit-dumbbell-3",
            name: "Dumbbell Fire 3",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Squat to Curl to Press", sets: 5, reps: "40 sec", desc: "Triple combo" },
              { name: "Burpee", sets: 5, reps: "30 sec", desc: "Bodyweight blast" },
              { name: "Dumbbell Single Arm Snatch", sets: 5, reps: "30 sec each", desc: "Explosive pull" },
              { name: "Mountain Climber", sets: 5, reps: "30 sec", desc: "Core cardio" },
              { name: "Dumbbell Bulgarian Split Squat", sets: 5, reps: "30 sec each", desc: "Single leg power" }
            ]
          },
          {
            id: "hiit-dumbbell-4",
            name: "Dumbbell Fire 4",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Half Burpee with Dumbbell", sets: 5, reps: "30 sec", desc: "Loaded burpee" },
              { name: "Dumbbell Step-Up to Overhead Press", sets: 5, reps: "30 sec each", desc: "Step and press" },
              { name: "High Plank Jacks", sets: 5, reps: "30 sec", desc: "Cardio plank" },
              { name: "Dumbbell Squat to Press", sets: 5, reps: "40 sec", desc: "Thruster" },
              { name: "Skater", sets: 5, reps: "30 sec", desc: "Lateral power" },
              { name: "Dumbbell Shrug", sets: 5, reps: "40 sec", desc: "Trap pump" }
            ]
          },
          {
            id: "hiit-dumbbell-5",
            name: "Dumbbell Fire 5",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Squat Clean and Press", sets: 5, reps: "40 sec", desc: "Clean and press complex" },
              { name: "Cross Body Mountain Climber", sets: 5, reps: "30 sec", desc: "Oblique cardio" },
              { name: "Dumbbell Walking Lunge Curl to Shoulder Press", sets: 5, reps: "40 sec", desc: "Multi-joint combo" },
              { name: "Jumping Jack", sets: 5, reps: "30 sec", desc: "Active recovery" },
              { name: "Dumbbell Jump Squat to Press", sets: 5, reps: "30 sec", desc: "Explosive squat press" }
            ]
          },
          {
            id: "hiit-dumbbell-6",
            name: "Dumbbell Fire 6",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbell Burpee with Curl to Press", sets: 6, reps: "30 sec", desc: "Loaded burpee complex" },
              { name: "Dumbbell Jump Squat to Press", sets: 6, reps: "30 sec", desc: "Explosive power" },
              { name: "Mountain Climber", sets: 6, reps: "40 sec", desc: "Core cardio" },
              { name: "Dumbbell Single Arm Snatch", sets: 6, reps: "30 sec each", desc: "Unilateral explosive" },
              { name: "Burpee", sets: 6, reps: "30 sec", desc: "Full body blast" },
              { name: "Dumbbell Squat to Curl to Press", sets: 6, reps: "40 sec", desc: "Complex finisher" }
            ]
          },
          {
            id: "hiit-dumbbell-7",
            name: "Dumbbell Fire 7",
            duration: "25 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Goblet Squat", sets: 4, reps: "40 sec", desc: "Squat foundation" },
              { name: "High Knees", sets: 4, reps: "30 sec", desc: "Cardio interval" },
              { name: "Dumbbell Standing Overhead Push Press", sets: 4, reps: "40 sec", desc: "Push press power" },
              { name: "Mountain Climber", sets: 4, reps: "30 sec", desc: "Core work" },
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "40 sec", desc: "Hinge pattern" }
            ]
          },
          {
            id: "hiit-dumbbell-8",
            name: "Dumbbell Fire 8",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbell Burpee to Overhead Swing", sets: 5, reps: "30 sec", desc: "Overhead burpee" },
              { name: "Dumbbell Step-Up to Curl Press (Alternating)", sets: 5, reps: "40 sec", desc: "Step up complex" },
              { name: "Alternating Jump Lunge", sets: 5, reps: "30 sec", desc: "Plyometric lunge" },
              { name: "Dumbbell Squat to Press", sets: 5, reps: "40 sec", desc: "Thruster" },
              { name: "Cross Body Mountain Climber", sets: 5, reps: "30 sec", desc: "Oblique burn" }
            ]
          },
          {
            id: "hiit-dumbbell-9",
            name: "Dumbbell Fire 9",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Squat Clean and Jerk", sets: 6, reps: "40 sec", desc: "Olympic-style complex" },
              { name: "Burpee", sets: 6, reps: "30 sec", desc: "Full body burst" },
              { name: "Dumbbell Single Arm Squat Clean and Press", sets: 6, reps: "30 sec each", desc: "Unilateral clean" },
              { name: "High Plank Jacks", sets: 6, reps: "30 sec", desc: "Core cardio" },
              { name: "Dumbbell Jump Squat to Press", sets: 6, reps: "30 sec", desc: "Max power" },
              { name: "Mountain Climber", sets: 6, reps: "40 sec", desc: "Core finisher" }
            ]
          },
          {
            id: "hiit-dumbbell-10",
            name: "Dumbbell Fire 10",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Squat to Press", sets: 5, reps: "40 sec", desc: "Compound drive" },
              { name: "Skater", sets: 5, reps: "30 sec", desc: "Lateral agility" },
              { name: "Dumbbell Single Arm Squat Snatch", sets: 5, reps: "30 sec each", desc: "Single arm power" },
              { name: "Jumping Jack", sets: 5, reps: "30 sec", desc: "Cardio interval" },
              { name: "Half Burpee with Dumbbell", sets: 5, reps: "30 sec", desc: "Modified burpee" },
              { name: "Plank Hip Twist", sets: 5, reps: "30 sec", desc: "Core rotation" }
            ]
          },
          {
            id: "hiit-dumbbell-11",
            name: "Dumbbell Fire 11",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Walking Lunge", sets: 4, reps: "40 sec", desc: "Leg conditioning" },
              { name: "Jumping Jack", sets: 4, reps: "30 sec", desc: "Heart rate boost" },
              { name: "Dumbbell Squat to Press", sets: 4, reps: "40 sec", desc: "Full body compound" },
              { name: "Mountain Climber", sets: 4, reps: "30 sec", desc: "Core blast" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 4, reps: "40 sec", desc: "Upper back" }
            ]
          },
          {
            id: "hiit-dumbbell-12",
            name: "Dumbbell Fire 12",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Squat Clean and Press", sets: 5, reps: "40 sec", desc: "Full body clean" },
              { name: "Burpee", sets: 5, reps: "30 sec", desc: "Bodyweight blast" },
              { name: "Dumbbell Step-Up to Overhead Press", sets: 5, reps: "30 sec each", desc: "Step and press" },
              { name: "High Knees", sets: 5, reps: "30 sec", desc: "Sprint in place" },
              { name: "Dumbbell Goblet Squat", sets: 5, reps: "40 sec", desc: "Squat endurance" },
              { name: "Oblique Crunch", sets: 5, reps: "30 sec", desc: "Core finisher" }
            ]
          },
          {
            id: "hiit-dumbbell-13",
            name: "Dumbbell Fire 13",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbell Burpee Clean to Press", sets: 6, reps: "30 sec", desc: "Loaded clean burpee" },
              { name: "Dumbbell Jump Squat to Press", sets: 6, reps: "30 sec", desc: "Explosive squat press" },
              { name: "Cross Body Mountain Climber", sets: 6, reps: "40 sec", desc: "Oblique cardio" },
              { name: "Dumbbell Single Arm Snatch", sets: 6, reps: "30 sec each", desc: "Power snatch" },
              { name: "Alternating Jump Lunge", sets: 6, reps: "30 sec", desc: "Split jump" },
              { name: "Dumbbell Squat to Curl to Press", sets: 6, reps: "40 sec", desc: "Triple threat" }
            ]
          },
          {
            id: "hiit-dumbbell-14",
            name: "Dumbbell Fire 14",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Goblet Squat", sets: 4, reps: "40 sec", desc: "Squat base" },
              { name: "High Knees", sets: 4, reps: "30 sec", desc: "Cardio interval" },
              { name: "Dumbbell Standing Shoulder Press", sets: 4, reps: "40 sec", desc: "Shoulder work" },
              { name: "Jumping Jack", sets: 4, reps: "30 sec", desc: "Classic cardio" },
              { name: "Dumbbell Walking Lunge", sets: 4, reps: "40 sec", desc: "Leg endurance" }
            ]
          },
          {
            id: "hiit-dumbbell-15",
            name: "Dumbbell Fire 15",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbell Burpee with Curl to Press", sets: 6, reps: "30 sec", desc: "Max effort complex" },
              { name: "Dumbbell Squat Clean and Jerk", sets: 6, reps: "40 sec", desc: "Olympic complex" },
              { name: "Tuck Jump to Push Up", sets: 6, reps: "30 sec", desc: "Bodyweight explosive" },
              { name: "Dumbbell Single Arm Squat Snatch", sets: 6, reps: "30 sec each", desc: "Single arm power" },
              { name: "Mountain Climbers to Plank Jack", sets: 6, reps: "40 sec", desc: "Core complex" },
              { name: "Dumbbell Jump Squat to Press", sets: 6, reps: "30 sec", desc: "Power finisher" }
            ]
          }
        ]
      },

      // KETTLEBELL HIIT
      "kettlebell": {
        name: "Kettlebell HIIT",
        description: "Explosive kettlebell interval circuits",
        workouts: [
          {
            id: "hiit-kettlebell-1",
            name: "Kettlebell Storm 1",
            duration: "25 min",
            difficulty: "Beginner",
            equipment: ["Kettlebell"],
            exercises: [
              { name: "Kettlebell Goblet Squat", sets: 4, reps: "40 sec", desc: "Squat foundation" },
              { name: "Mountain Climber", sets: 4, reps: "30 sec", desc: "Cardio burst" },
              { name: "Kettlebell Kickstand Swing", sets: 4, reps: "40 sec", desc: "Hip hinge power" },
              { name: "High Knees", sets: 4, reps: "30 sec", desc: "Sprint cardio" },
              { name: "Kettlebell Kneeling Overhead Press", sets: 4, reps: "40 sec", desc: "Shoulder stability" }
            ]
          },
          {
            id: "hiit-kettlebell-2",
            name: "Kettlebell Storm 2",
            duration: "25 min",
            difficulty: "Beginner",
            equipment: ["Kettlebell"],
            exercises: [
              { name: "Kettlebell Walking Lunges", sets: 4, reps: "40 sec", desc: "Walking leg work" },
              { name: "Jumping Jack", sets: 4, reps: "30 sec", desc: "Cardio interval" },
              { name: "Kettlebell Half Kneeling Overhead Press", sets: 4, reps: "30 sec each", desc: "Kneeling press" },
              { name: "Burpee", sets: 4, reps: "30 sec", desc: "Full body blast" },
              { name: "Kettlebell Goblet Squat", sets: 4, reps: "40 sec", desc: "Front squat" }
            ]
          },
          {
            id: "hiit-kettlebell-3",
            name: "Kettlebell Storm 3",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Kettlebell"],
            exercises: [
              { name: "Kettlebell Single Arm Clean and Press", sets: 5, reps: "30 sec each", desc: "Clean to press complex" },
              { name: "Mountain Climber", sets: 5, reps: "30 sec", desc: "Core cardio" },
              { name: "Kettlebell Kickstand Swing", sets: 5, reps: "40 sec", desc: "Hip power" },
              { name: "High Plank Jacks", sets: 5, reps: "30 sec", desc: "Plank cardio" },
              { name: "Kettlebell Pop Clean To Squat", sets: 5, reps: "40 sec", desc: "Explosive clean" }
            ]
          },
          {
            id: "hiit-kettlebell-4",
            name: "Kettlebell Storm 4",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Kettlebell"],
            exercises: [
              { name: "Kettlebell Single Arm Snatch", sets: 5, reps: "30 sec each", desc: "Snatch power" },
              { name: "Burpee", sets: 5, reps: "30 sec", desc: "Bodyweight burst" },
              { name: "Kettlebell Reverse Lunge with Ipsilateral Press", sets: 5, reps: "30 sec each", desc: "Lunge and press" },
              { name: "Jumping Jack", sets: 5, reps: "30 sec", desc: "Active recovery" },
              { name: "Kettlebell Goblet Squat", sets: 5, reps: "40 sec", desc: "Front loaded squat" },
              { name: "Cross Body Mountain Climber", sets: 5, reps: "30 sec", desc: "Oblique work" }
            ]
          },
          {
            id: "hiit-kettlebell-5",
            name: "Kettlebell Storm 5",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Kettlebell"],
            exercises: [
              { name: "Kettlebell Curtsy to Clean", sets: 5, reps: "40 sec", desc: "Curtsy clean combo" },
              { name: "High Knees", sets: 5, reps: "30 sec", desc: "Sprint intervals" },
              { name: "Kettlebell Single Arm Clean and Press", sets: 5, reps: "30 sec each", desc: "Power clean press" },
              { name: "Skater", sets: 5, reps: "30 sec", desc: "Lateral cardio" },
              { name: "Kettlebell Side Lunge to Press", sets: 5, reps: "40 sec", desc: "Lateral lunge complex" }
            ]
          },
          {
            id: "hiit-kettlebell-6",
            name: "Kettlebell Storm 6",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["Kettlebell"],
            exercises: [
              { name: "Kettlebell Single Arm Snatch to Overhead Squat", sets: 6, reps: "30 sec each", desc: "Snatch to OH squat" },
              { name: "Burpee to Tuck Jump", sets: 6, reps: "30 sec", desc: "Max intensity" },
              { name: "Kettlebell Clean and Jerk", sets: 6, reps: "40 sec", desc: "Olympic KB complex" },
              { name: "Mountain Climber", sets: 6, reps: "40 sec", desc: "Core burn" },
              { name: "Kettlebell Single Arm Squat Clean", sets: 6, reps: "30 sec each", desc: "Deep clean" },
              { name: "Tuck Jump to Push Up", sets: 6, reps: "30 sec", desc: "Plyometric combo" }
            ]
          },
          {
            id: "hiit-kettlebell-7",
            name: "Kettlebell Storm 7",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["Kettlebell"],
            exercises: [
              { name: "Kettlebell Goblet Squat", sets: 4, reps: "40 sec", desc: "Goblet squat" },
              { name: "Jumping Jack", sets: 4, reps: "30 sec", desc: "Heart rate up" },
              { name: "Kettlebell Kickstand Swing", sets: 4, reps: "40 sec", desc: "Swing power" },
              { name: "Mountain Climber", sets: 4, reps: "30 sec", desc: "Core work" },
              { name: "Kettlebell Walking Lunges", sets: 4, reps: "40 sec", desc: "Loaded lunges" }
            ]
          },
          {
            id: "hiit-kettlebell-8",
            name: "Kettlebell Storm 8",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Kettlebell"],
            exercises: [
              { name: "Kettlebell Single Arm Squat Clean and Jerk", sets: 5, reps: "30 sec each", desc: "Full clean and jerk" },
              { name: "Alternating Jump Lunge", sets: 5, reps: "30 sec", desc: "Explosive lunges" },
              { name: "Kettlebell Pop Clean To Squat", sets: 5, reps: "40 sec", desc: "Pop clean" },
              { name: "High Knees", sets: 5, reps: "30 sec", desc: "Sprint burst" },
              { name: "Kettlebell Reverse Lunge with Contralateral Press", sets: 5, reps: "30 sec each", desc: "Cross body lunge press" }
            ]
          },
          {
            id: "hiit-kettlebell-9",
            name: "Kettlebell Storm 9",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["Kettlebell"],
            exercises: [
              { name: "Kettlebell Clean and Jerk", sets: 6, reps: "40 sec", desc: "KB Olympic lift" },
              { name: "Burpee Broad Jump", sets: 6, reps: "30 sec", desc: "Distance burpee" },
              { name: "Kettlebell Single Arm Snatch", sets: 6, reps: "30 sec each", desc: "Single arm power" },
              { name: "Cross Body Mountain Climber", sets: 6, reps: "40 sec", desc: "Oblique shred" },
              { name: "Kettlebell Single Leg Dead Lift to Snatch", sets: 6, reps: "30 sec each", desc: "Deadlift to snatch" },
              { name: "High Plank Jacks", sets: 6, reps: "30 sec", desc: "Plank finisher" }
            ]
          },
          {
            id: "hiit-kettlebell-10",
            name: "Kettlebell Storm 10",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Kettlebell"],
            exercises: [
              { name: "Kettlebell Single Arm Clean and Press", sets: 5, reps: "30 sec each", desc: "Clean press combo" },
              { name: "Skater", sets: 5, reps: "30 sec", desc: "Lateral agility" },
              { name: "Kettlebell Curtsy to Clean", sets: 5, reps: "40 sec", desc: "Curtsy clean" },
              { name: "Burpee", sets: 5, reps: "30 sec", desc: "Full body cardio" },
              { name: "Kettlebell Goblet Squat", sets: 5, reps: "40 sec", desc: "Squat endurance" },
              { name: "Oblique Mountain Climbers", sets: 5, reps: "30 sec", desc: "Core oblique" }
            ]
          },
          {
            id: "hiit-kettlebell-11",
            name: "Kettlebell Storm 11",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["Kettlebell"],
            exercises: [
              { name: "Kettlebell Walking Lunges", sets: 4, reps: "40 sec", desc: "Loaded lunge walk" },
              { name: "High Knees", sets: 4, reps: "30 sec", desc: "Quick feet" },
              { name: "Kettlebell Standing Alternating Overhead Press", sets: 4, reps: "40 sec", desc: "Alternating press" },
              { name: "Jumping Jack", sets: 4, reps: "30 sec", desc: "Classic cardio" },
              { name: "Kettlebell Kickstand Swing", sets: 4, reps: "40 sec", desc: "Hip hinge" }
            ]
          },
          {
            id: "hiit-kettlebell-12",
            name: "Kettlebell Storm 12",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Kettlebell"],
            exercises: [
              { name: "Kettlebell Single Arm Snatch", sets: 5, reps: "30 sec each", desc: "Explosive snatch" },
              { name: "Mountain Climbers to Plank Jack", sets: 5, reps: "40 sec", desc: "Core complex" },
              { name: "Kettlebell Side Lunge to Press", sets: 5, reps: "30 sec each", desc: "Lateral lunge press" },
              { name: "Alternating Jump Lunge", sets: 5, reps: "30 sec", desc: "Jump lunges" },
              { name: "Kettlebell Pop Clean To Squat", sets: 5, reps: "40 sec", desc: "Pop clean squat" }
            ]
          },
          {
            id: "hiit-kettlebell-13",
            name: "Kettlebell Storm 13",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["Kettlebell"],
            exercises: [
              { name: "Kettlebell Single Arm Snatch to Overhead Squat", sets: 6, reps: "30 sec each", desc: "Full snatch complex" },
              { name: "Burpee to Tuck Jump", sets: 6, reps: "30 sec", desc: "Max power burst" },
              { name: "Kettlebell Single Arm Squat Clean and Jerk", sets: 6, reps: "30 sec each", desc: "Full KB complex" },
              { name: "High Knees", sets: 6, reps: "40 sec", desc: "Sprint intervals" },
              { name: "Kettlebell Clean and Jerk", sets: 6, reps: "40 sec", desc: "Double KB power" },
              { name: "Cross Body Mountain Climber", sets: 6, reps: "30 sec", desc: "Oblique finisher" }
            ]
          },
          {
            id: "hiit-kettlebell-14",
            name: "Kettlebell Storm 14",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["Kettlebell"],
            exercises: [
              { name: "Kettlebell Goblet Squat", sets: 4, reps: "40 sec", desc: "Goblet squat base" },
              { name: "Mountain Climber", sets: 4, reps: "30 sec", desc: "Core cardio" },
              { name: "Kettlebell Half Kneeling Bottom Up Press", sets: 4, reps: "30 sec each", desc: "Stability press" },
              { name: "Jumping Jack", sets: 4, reps: "30 sec", desc: "Cardio recovery" },
              { name: "Kettlebell Walking Lunges", sets: 4, reps: "40 sec", desc: "Lunge endurance" }
            ]
          },
          {
            id: "hiit-kettlebell-15",
            name: "Kettlebell Storm 15",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["Kettlebell"],
            exercises: [
              { name: "Kettlebell Clean and Jerk", sets: 6, reps: "40 sec", desc: "Olympic KB power" },
              { name: "Tuck Jump to Push Up", sets: 6, reps: "30 sec", desc: "Full body plyometric" },
              { name: "Kettlebell Single Leg Dead Lift to Snatch", sets: 6, reps: "30 sec each", desc: "Unilateral power" },
              { name: "Burpee", sets: 6, reps: "30 sec", desc: "Classic burpee" },
              { name: "Kettlebell Single Arm Snatch to Overhead Squat", sets: 6, reps: "30 sec each", desc: "Snatch complex" },
              { name: "Mountain Climbers to Plank Jack", sets: 6, reps: "40 sec", desc: "Core finisher" }
            ]
          }
        ]
      }
    }
  },

  // ====================
  // REHABILITATION
  // ====================
  "rehab": {
    name: "Rehabilitation",
    icon: "🏥",
    description: "Guided rehab workouts for injury recovery and pain relief",
    subcategories: {

      // SHOULDER REHAB
      "shoulder": {
        name: "Shoulder Rehab",
        description: "Rotator cuff, impingement, and shoulder mobility recovery",
        workouts: [
          {
            id: "rehab-shoulder-1",
            name: "Shoulder Rehab 1",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Arm Circles", sets: 2, reps: "30 sec each direction", desc: "Gentle warm-up" },
              { name: "Wall Angels", sets: 3, reps: "10 slow", desc: "Shoulder mobility and scapular control" },
              { name: "Scapular Push Up", sets: 3, reps: "10 slow", desc: "Scapular stability activation" },
              { name: "Prone Cobra Hold", sets: 3, reps: "20 sec", desc: "Upper back and posterior shoulder" },
              { name: "Cross Body Shoulder Stretch", sets: 1, reps: "1 min each", desc: "Posterior capsule stretch" }
            ]
          },
          {
            id: "rehab-shoulder-2",
            name: "Shoulder Rehab 2",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["Mat", "Light Resistance Band"],
            exercises: [
              { name: "Shoulder Rolls", sets: 2, reps: "1 min", desc: "Joint warm-up" },
              { name: "Mini Band External Rotation", sets: 3, reps: "15", desc: "Rotator cuff activation" },
              { name: "Mini Band Pull Aparts", sets: 3, reps: "15", desc: "Rear delt and rhomboid activation" },
              { name: "Wall Angels", sets: 3, reps: "10 slow", desc: "Overhead range of motion" },
              { name: "Shoulder Stretch", sets: 1, reps: "1 min each", desc: "Gentle shoulder release" }
            ]
          },
          {
            id: "rehab-shoulder-3",
            name: "Shoulder Rehab 3",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["Mat", "Light Resistance Band"],
            exercises: [
              { name: "Yoga - Cat Cow", sets: 1, reps: "2 min", desc: "Thoracic warm-up" },
              { name: "Band Pull Apart Slow", sets: 3, reps: "15 slow", desc: "Upper back activation" },
              { name: "Face Pull Slow", sets: 3, reps: "12 slow", desc: "Rear delt and external rotation" },
              { name: "Yoga - Thread the Needle", sets: 1, reps: "1 min each", desc: "Thoracic rotation and shoulder release" },
              { name: "Yoga - Child's Pose", sets: 1, reps: "2 min", desc: "Lat and shoulder stretch" }
            ]
          },
          {
            id: "rehab-shoulder-4",
            name: "Shoulder Rehab 4",
            duration: "25 min",
            difficulty: "Beginner",
            equipment: ["Mat", "Light Resistance Band"],
            exercises: [
              { name: "Arm Circles", sets: 2, reps: "30 sec each direction", desc: "Circulation warm-up" },
              { name: "Mini Band External Rotation", sets: 3, reps: "15", desc: "Infraspinatus activation" },
              { name: "Scapular Push Up", sets: 3, reps: "12 slow", desc: "Serratus anterior strengthening" },
              { name: "Mini Band Bent Over Y's", sets: 3, reps: "12", desc: "Lower trap activation" },
              { name: "Prone Cobra Hold", sets: 3, reps: "25 sec", desc: "Posterior chain endurance" },
              { name: "Upper Trap Stretch", sets: 1, reps: "1 min each", desc: "Upper trap release" }
            ]
          },
          {
            id: "rehab-shoulder-5",
            name: "Shoulder Rehab 5",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Light Resistance Band"],
            exercises: [
              { name: "Shoulder Rolls", sets: 2, reps: "1 min", desc: "Warm-up" },
              { name: "Mini Band Pull Aparts", sets: 3, reps: "20", desc: "Scapular retraction" },
              { name: "SuperBand Face Pulls", sets: 3, reps: "15", desc: "External rotation under load" },
              { name: "Wall Angels", sets: 3, reps: "12 slow", desc: "Full ROM overhead" },
              { name: "Band Pull Apart Slow", sets: 3, reps: "15 slow", desc: "Endurance hold" },
              { name: "Cross Body Shoulder Stretch", sets: 1, reps: "1 min each", desc: "Posterior capsule mobility" }
            ]
          },
          {
            id: "rehab-shoulder-6",
            name: "Shoulder Rehab 6",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Light Resistance Band", "Light Dumbbells"],
            exercises: [
              { name: "Yoga - Cat Cow", sets: 1, reps: "2 min", desc: "Spinal warm-up" },
              { name: "Mini Band External Rotation", sets: 3, reps: "15", desc: "Cuff prehab" },
              { name: "Dumbbell Lateral Raise", sets: 3, reps: "12 light", desc: "Deltoid activation with control" },
              { name: "Dumbbell Reverse Fly", sets: 3, reps: "12 light", desc: "Posterior delt strengthening" },
              { name: "Scapular Push Up", sets: 3, reps: "12", desc: "Scapular control" },
              { name: "Yoga - Thread the Needle", sets: 1, reps: "1 min each", desc: "Thoracic release" }
            ]
          },
          {
            id: "rehab-shoulder-7",
            name: "Shoulder Rehab 7",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Light Resistance Band"],
            exercises: [
              { name: "Arm Circles", sets: 2, reps: "30 sec each direction", desc: "Warm-up" },
              { name: "Face Pull Slow", sets: 3, reps: "15 slow", desc: "Rear delt and rotator cuff" },
              { name: "Mini Band Bent Over Y's", sets: 3, reps: "15", desc: "Lower trap strengthening" },
              { name: "Mini Band Pull Aparts", sets: 3, reps: "20", desc: "Scapular endurance" },
              { name: "Prone Cobra Hold", sets: 4, reps: "25 sec", desc: "Upper back endurance" },
              { name: "Shoulder Stretch", sets: 1, reps: "1 min each", desc: "Cool-down stretch" }
            ]
          },
          {
            id: "rehab-shoulder-8",
            name: "Shoulder Rehab 8",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Light Resistance Band", "Light Dumbbells"],
            exercises: [
              { name: "Shoulder Rolls", sets: 2, reps: "1 min", desc: "Joint warm-up" },
              { name: "Mini Band External Rotation", sets: 3, reps: "15", desc: "Cuff activation" },
              { name: "Band Alternating Front Raise", sets: 3, reps: "10 each", desc: "Anterior delt control" },
              { name: "Band Lateral Raise", sets: 3, reps: "15", desc: "Side delt strengthening" },
              { name: "Wall Angels", sets: 3, reps: "12 slow", desc: "Overhead mobility" },
              { name: "Yoga - Child's Pose", sets: 1, reps: "2 min", desc: "Shoulder and lat stretch" }
            ]
          },
          {
            id: "rehab-shoulder-9",
            name: "Shoulder Rehab 9",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Light Resistance Band", "Light Dumbbells"],
            exercises: [
              { name: "Yoga - Cat Cow", sets: 1, reps: "2 min", desc: "Thoracic warm-up" },
              { name: "SuperBand Face Pulls", sets: 3, reps: "15", desc: "Scapular retraction and external rotation" },
              { name: "Dumbbell Lateral Raise", sets: 3, reps: "12 light", desc: "Controlled delt work" },
              { name: "Scapular Push Up", sets: 3, reps: "15", desc: "Advanced scapular control" },
              { name: "Dumbbell Reverse Fly", sets: 3, reps: "12 light", desc: "Posterior chain balance" },
              { name: "Upper Trap Stretch", sets: 1, reps: "1 min each", desc: "Trap and neck release" }
            ]
          },
          {
            id: "rehab-shoulder-10",
            name: "Shoulder Rehab 10",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Light Resistance Band", "Light Dumbbells"],
            exercises: [
              { name: "Arm Circles", sets: 2, reps: "30 sec each direction", desc: "Full warm-up" },
              { name: "Mini Band External Rotation", sets: 3, reps: "15", desc: "Rotator cuff" },
              { name: "Mini Band Pull Aparts", sets: 3, reps: "20", desc: "Retraction endurance" },
              { name: "Dumbbell Overhead Press", sets: 3, reps: "10 light", desc: "Overhead strengthening" },
              { name: "Mini Band Bent Over Y's", sets: 3, reps: "15", desc: "Lower trap endurance" },
              { name: "Yoga - Thread the Needle", sets: 1, reps: "1 min each", desc: "Thoracic rotation cool-down" }
            ]
          }
        ]
      },

      // KNEE REHAB
      "knee": {
        name: "Knee Rehab",
        description: "ACL, meniscus, patella, and general knee recovery",
        workouts: [
          {
            id: "rehab-knee-1",
            name: "Knee Rehab 1",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Ankle Circles", sets: 2, reps: "1 min each", desc: "Lower limb warm-up" },
              { name: "Glute Bridge Hold", sets: 3, reps: "30 sec", desc: "Glute activation without knee stress" },
              { name: "Side Lying Leg Raise", sets: 3, reps: "12 each", desc: "Hip abductor strengthening" },
              { name: "Wall Sit Light", sets: 3, reps: "20 sec", desc: "Isometric quad activation" },
              { name: "Quad Stretch Standing", sets: 1, reps: "1 min each", desc: "Quad flexibility" }
            ]
          },
          {
            id: "rehab-knee-2",
            name: "Knee Rehab 2",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["Mat", "Mini Band"],
            exercises: [
              { name: "Hip Circles", sets: 2, reps: "1 min each", desc: "Joint warm-up" },
              { name: "Mini Band Clamshell", sets: 3, reps: "15 each", desc: "Hip external rotation and glute med" },
              { name: "Glute Bridge Hold", sets: 3, reps: "30 sec", desc: "Posterior chain activation" },
              { name: "Wall Sit Light", sets: 3, reps: "25 sec", desc: "Quad isometric hold" },
              { name: "Calf Raises Slow", sets: 3, reps: "15 slow", desc: "Calf and ankle stability" }
            ]
          },
          {
            id: "rehab-knee-3",
            name: "Knee Rehab 3",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["Mat", "Mini Band"],
            exercises: [
              { name: "Ankle Circles", sets: 2, reps: "1 min each", desc: "Mobility warm-up" },
              { name: "Mini Band Fire Hydrants", sets: 3, reps: "12 each", desc: "Hip abductor and rotator" },
              { name: "Mini Band Glute Kickback", sets: 3, reps: "12 each", desc: "Glute max activation" },
              { name: "Bird Dog", sets: 3, reps: "8 each slow", desc: "Core stability and hip extension" },
              { name: "Figure Four Stretch", sets: 1, reps: "1 min each", desc: "Hip and glute release" }
            ]
          },
          {
            id: "rehab-knee-4",
            name: "Knee Rehab 4",
            duration: "25 min",
            difficulty: "Beginner",
            equipment: ["Mat", "Mini Band"],
            exercises: [
              { name: "Standing Hip Circles", sets: 2, reps: "1 min each", desc: "Hip warm-up" },
              { name: "Mini Band Squat", sets: 3, reps: "12 slow", desc: "Controlled squat with abduction cue" },
              { name: "Mini Band Clamshell", sets: 3, reps: "15 each", desc: "Glute med strengthening" },
              { name: "Wall Sit Light", sets: 3, reps: "30 sec", desc: "Progressive quad endurance" },
              { name: "Calf Stretch", sets: 1, reps: "1 min each", desc: "Calf flexibility" },
              { name: "Quad Stretch Standing", sets: 1, reps: "1 min each", desc: "Quad flexibility" }
            ]
          },
          {
            id: "rehab-knee-5",
            name: "Knee Rehab 5",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Mini Band"],
            exercises: [
              { name: "Hip Circles", sets: 2, reps: "1 min each", desc: "Warm-up" },
              { name: "Mini Band Squat", sets: 3, reps: "15", desc: "Quad and glute co-activation" },
              { name: "SuperBand Glute Bridge", sets: 3, reps: "15", desc: "Loaded glute bridge" },
              { name: "Mini Band Side Lying Hip Abduction", sets: 3, reps: "12 each", desc: "Hip stability" },
              { name: "Step Up", sets: 3, reps: "10 each", desc: "Functional single leg strength" },
              { name: "Calf Raises Slow", sets: 3, reps: "15 slow", desc: "Ankle stability" }
            ]
          },
          {
            id: "rehab-knee-6",
            name: "Knee Rehab 6",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Mini Band"],
            exercises: [
              { name: "Ankle Circles", sets: 2, reps: "1 min each", desc: "Lower limb warm-up" },
              { name: "Mini Band Wall Sit with Abductions", sets: 3, reps: "30 sec", desc: "Quad and glute med isometric" },
              { name: "Mini Band Fire Hydrants", sets: 3, reps: "15 each", desc: "Hip rotator strength" },
              { name: "Mini Band Single Leg Glute Bridge", sets: 3, reps: "10 each", desc: "Unilateral glute strength" },
              { name: "Band Reverse Lunge", sets: 3, reps: "10 each", desc: "Controlled lunge pattern" },
              { name: "Figure Four Stretch", sets: 1, reps: "1 min each", desc: "Hip release" }
            ]
          },
          {
            id: "rehab-knee-7",
            name: "Knee Rehab 7",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Mini Band"],
            exercises: [
              { name: "Standing Hip Circles", sets: 2, reps: "1 min each", desc: "Warm-up" },
              { name: "Resistance Band Squat", sets: 3, reps: "12", desc: "Squat patterning with resistance" },
              { name: "Mini Band Clamshell", sets: 3, reps: "20 each", desc: "Glute med endurance" },
              { name: "Step Up", sets: 3, reps: "12 each", desc: "Progressive step-up" },
              { name: "Mini Band Frog Pumps", sets: 3, reps: "15", desc: "Glute activation" },
              { name: "Quad Stretch Standing", sets: 1, reps: "1 min each", desc: "Quad flexibility" }
            ]
          },
          {
            id: "rehab-knee-8",
            name: "Knee Rehab 8",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Mini Band", "Light Dumbbells"],
            exercises: [
              { name: "Hip Circles", sets: 2, reps: "1 min each", desc: "Warm-up" },
              { name: "Dumbbell Glute Bridge", sets: 3, reps: "12", desc: "Loaded glute bridge" },
              { name: "Mini Band Squat", sets: 3, reps: "15", desc: "Controlled squat" },
              { name: "Dumbbell Step Up", sets: 3, reps: "10 each", desc: "Weighted step-up" },
              { name: "Mini Band Standing Hip Abduction", sets: 3, reps: "12 each", desc: "Standing hip stability" },
              { name: "Calf Stretch", sets: 1, reps: "1 min each", desc: "Calf release" }
            ]
          },
          {
            id: "rehab-knee-9",
            name: "Knee Rehab 9",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Mini Band", "Light Dumbbells"],
            exercises: [
              { name: "Ankle Circles", sets: 2, reps: "1 min each", desc: "Mobility warm-up" },
              { name: "Band Split Squat", sets: 3, reps: "10 each", desc: "Single leg squat pattern" },
              { name: "Dumbbell Glute Bridge", sets: 3, reps: "15", desc: "Posterior chain strength" },
              { name: "Mini Band Donkey Kicks", sets: 3, reps: "12 each", desc: "Glute isolation" },
              { name: "Single Leg Calf Raise", sets: 3, reps: "12 each", desc: "Unilateral calf strength" },
              { name: "Figure Four Stretch", sets: 1, reps: "1 min each", desc: "Hip and glute release" }
            ]
          },
          {
            id: "rehab-knee-10",
            name: "Knee Rehab 10",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Mini Band", "Light Dumbbells"],
            exercises: [
              { name: "Standing Hip Circles", sets: 2, reps: "1 min each", desc: "Full warm-up" },
              { name: "Dumbbell Step Up", sets: 3, reps: "12 each", desc: "Functional strength" },
              { name: "Dumbbell Reverse Lunge", sets: 3, reps: "10 each", desc: "Controlled lunge" },
              { name: "Mini Band Wall Sit with Abductions", sets: 3, reps: "35 sec", desc: "Isometric endurance" },
              { name: "Dumbbell Calf Raise", sets: 3, reps: "15", desc: "Calf strengthening" },
              { name: "Quad Stretch Standing", sets: 1, reps: "1 min each", desc: "Cool-down stretch" }
            ]
          }
        ]
      },

      // LOWER BACK REHAB
      "lower_back": {
        name: "Lower Back Rehab",
        description: "Core stability, spinal mobility, and lower back pain relief",
        workouts: [
          {
            id: "rehab-lowerback-1",
            name: "Lower Back Rehab 1",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Cat Cow", sets: 1, reps: "2 min", desc: "Gentle spinal mobilization" },
              { name: "Dead Bug", sets: 3, reps: "8 each slow", desc: "Core activation without back stress" },
              { name: "Glute Bridge Hold", sets: 3, reps: "30 sec", desc: "Glute activation and lumbar support" },
              { name: "Knees to Chest", sets: 1, reps: "2 min", desc: "Lower back decompression" },
              { name: "Yoga - Child's Pose", sets: 1, reps: "2 min", desc: "Spinal release" }
            ]
          },
          {
            id: "rehab-lowerback-2",
            name: "Lower Back Rehab 2",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Cat Cow", sets: 1, reps: "2 min", desc: "Spinal warm-up" },
              { name: "Bird Dog", sets: 3, reps: "8 each slow", desc: "Core and posterior chain stability" },
              { name: "Yoga - Sphinx Pose", sets: 1, reps: "2 min", desc: "Gentle lumbar extension" },
              { name: "Yoga - Supine Twist", sets: 1, reps: "2 min each", desc: "Spinal rotation and release" },
              { name: "Yoga - Child's Pose", sets: 1, reps: "2 min", desc: "Restful forward fold" }
            ]
          },
          {
            id: "rehab-lowerback-3",
            name: "Lower Back Rehab 3",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Hip Circles", sets: 2, reps: "1 min each", desc: "Hip and pelvis warm-up" },
              { name: "Dead Bug", sets: 3, reps: "10 each slow", desc: "Anti-extension core work" },
              { name: "Side Lying Leg Raise", sets: 3, reps: "10 each", desc: "Hip abductor and lateral stability" },
              { name: "Glute Bridge Hold", sets: 3, reps: "30 sec", desc: "Posterior chain activation" },
              { name: "Yoga - Happy Baby", sets: 1, reps: "2 min", desc: "Lower back and hip release" }
            ]
          },
          {
            id: "rehab-lowerback-4",
            name: "Lower Back Rehab 4",
            duration: "25 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Cat Cow", sets: 1, reps: "2 min", desc: "Spinal mobilization" },
              { name: "Bird Dog", sets: 3, reps: "10 each slow", desc: "Cross-body stability" },
              { name: "Dead Bug", sets: 3, reps: "10 each slow", desc: "Deep core engagement" },
              { name: "Yoga - Cobra Pose", sets: 3, reps: "30 sec", desc: "Extension strengthening" },
              { name: "Half Kneeling Hip Flexor Stretch", sets: 1, reps: "1 min each", desc: "Hip flexor release for lumbar relief" },
              { name: "Knees to Chest", sets: 1, reps: "2 min", desc: "Spinal decompression" }
            ]
          },
          {
            id: "rehab-lowerback-5",
            name: "Lower Back Rehab 5",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Hip Circles", sets: 2, reps: "1 min each", desc: "Warm-up" },
              { name: "Bird Dog", sets: 3, reps: "10 each", desc: "Core stability" },
              { name: "Glute Bridge Hold", sets: 4, reps: "30 sec", desc: "Glute endurance" },
              { name: "Prone Y Raise", sets: 3, reps: "10 slow", desc: "Upper back and posterior chain" },
              { name: "Yoga - Pigeon Pose", sets: 1, reps: "2 min each", desc: "Hip external rotation and piriformis release" },
              { name: "Yoga - Supine Twist", sets: 1, reps: "2 min each", desc: "Spinal rotation" }
            ]
          },
          {
            id: "rehab-lowerback-6",
            name: "Lower Back Rehab 6",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Mini Band"],
            exercises: [
              { name: "Yoga - Cat Cow", sets: 1, reps: "2 min", desc: "Spinal warm-up" },
              { name: "Dead Bug", sets: 3, reps: "12 each", desc: "Progressive core work" },
              { name: "Mini Band Clamshell", sets: 3, reps: "15 each", desc: "Hip stability for lumbar support" },
              { name: "Mini Band Glute Kickback", sets: 3, reps: "12 each", desc: "Glute strengthening" },
              { name: "Yoga - Sphinx Pose", sets: 1, reps: "2 min", desc: "Gentle extension" },
              { name: "Seated Forward Fold", sets: 1, reps: "2 min", desc: "Posterior chain stretch" }
            ]
          },
          {
            id: "rehab-lowerback-7",
            name: "Lower Back Rehab 7",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Mini Band"],
            exercises: [
              { name: "Standing Hip Circles", sets: 2, reps: "1 min each", desc: "Warm-up" },
              { name: "Bird Dog", sets: 3, reps: "12 each", desc: "Advanced core stability" },
              { name: "SuperBand Glute Bridge", sets: 3, reps: "12", desc: "Loaded glute activation" },
              { name: "Side Lying Leg Raise", sets: 3, reps: "12 each", desc: "Lateral hip strength" },
              { name: "Half Kneeling Hip Flexor Stretch", sets: 1, reps: "1 min each", desc: "Anterior chain release" },
              { name: "Yoga - Child's Pose", sets: 1, reps: "2 min", desc: "Cool-down" }
            ]
          },
          {
            id: "rehab-lowerback-8",
            name: "Lower Back Rehab 8",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Light Dumbbells"],
            exercises: [
              { name: "Yoga - Cat Cow", sets: 1, reps: "2 min", desc: "Spinal warm-up" },
              { name: "Dead Bug", sets: 3, reps: "12 each", desc: "Core endurance" },
              { name: "Dumbbell Glute Bridge", sets: 3, reps: "12", desc: "Weighted glute bridge" },
              { name: "Prone Y Raise", sets: 3, reps: "12 slow", desc: "Upper back strength" },
              { name: "Yoga - Pigeon Pose", sets: 1, reps: "2 min each", desc: "Piriformis and hip release" },
              { name: "Knees to Chest", sets: 1, reps: "2 min", desc: "Decompression" }
            ]
          },
          {
            id: "rehab-lowerback-9",
            name: "Lower Back Rehab 9",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Mini Band"],
            exercises: [
              { name: "Hip Circles", sets: 2, reps: "1 min each", desc: "Warm-up" },
              { name: "Bird Dog", sets: 4, reps: "10 each", desc: "Core endurance" },
              { name: "Mini Band Fire Hydrants", sets: 3, reps: "12 each", desc: "Hip rotator strength" },
              { name: "Mini Band Single Leg Glute Bridge", sets: 3, reps: "10 each", desc: "Unilateral glute work" },
              { name: "Yoga - Cobra Pose", sets: 3, reps: "30 sec", desc: "Extension mobility" },
              { name: "Yoga - Supine Twist", sets: 1, reps: "2 min each", desc: "Spinal release" }
            ]
          },
          {
            id: "rehab-lowerback-10",
            name: "Lower Back Rehab 10",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Mini Band", "Light Dumbbells"],
            exercises: [
              { name: "Yoga - Cat Cow", sets: 1, reps: "2 min", desc: "Full spinal warm-up" },
              { name: "Dead Bug", sets: 3, reps: "12 each", desc: "Core stabilization" },
              { name: "Bird Dog", sets: 3, reps: "12 each", desc: "Cross-body coordination" },
              { name: "Dumbbell Glute Bridge", sets: 3, reps: "15", desc: "Glute endurance" },
              { name: "Prone Y Raise", sets: 3, reps: "12", desc: "Posterior chain strengthening" },
              { name: "Half Kneeling Hip Flexor Stretch", sets: 1, reps: "1 min each", desc: "Hip flexor release" },
              { name: "Yoga - Child's Pose", sets: 1, reps: "2 min", desc: "Full cool-down" }
            ]
          }
        ]
      },

      // HIP REHAB
      "hip": {
        name: "Hip Rehab",
        description: "Hip mobility, labral recovery, and hip flexor rehabilitation",
        workouts: [
          {
            id: "rehab-hip-1",
            name: "Hip Rehab 1",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Hip Circles", sets: 2, reps: "1 min each", desc: "Gentle hip warm-up" },
              { name: "Glute Bridge Hold", sets: 3, reps: "30 sec", desc: "Glute activation" },
              { name: "Yoga - Reclined Butterfly", sets: 1, reps: "2 min", desc: "Passive hip opening" },
              { name: "Knees to Chest", sets: 1, reps: "2 min", desc: "Hip flexion and back relief" },
              { name: "Yoga - Happy Baby", sets: 1, reps: "2 min", desc: "Hip release" }
            ]
          },
          {
            id: "rehab-hip-2",
            name: "Hip Rehab 2",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Standing Hip Circles", sets: 2, reps: "1 min each", desc: "Standing hip warm-up" },
              { name: "Side Lying Leg Raise", sets: 3, reps: "10 each", desc: "Hip abductor activation" },
              { name: "Yoga - Low Lunge", sets: 1, reps: "1 min each", desc: "Hip flexor stretch" },
              { name: "Figure Four Stretch", sets: 1, reps: "1 min each", desc: "Piriformis stretch" },
              { name: "Yoga - Child's Pose", sets: 1, reps: "2 min", desc: "Rest and release" }
            ]
          },
          {
            id: "rehab-hip-3",
            name: "Hip Rehab 3",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["Mat", "Mini Band"],
            exercises: [
              { name: "Hip Circles", sets: 2, reps: "1 min each", desc: "Warm-up" },
              { name: "Mini Band Clamshell", sets: 3, reps: "12 each", desc: "External rotation activation" },
              { name: "Mini Band Fire Hydrants", sets: 3, reps: "10 each", desc: "Hip abduction and rotation" },
              { name: "Yoga - Pigeon Pose", sets: 1, reps: "2 min each", desc: "Deep hip opener" },
              { name: "Yoga - Reclined Butterfly", sets: 1, reps: "2 min", desc: "Passive adductor stretch" }
            ]
          },
          {
            id: "rehab-hip-4",
            name: "Hip Rehab 4",
            duration: "25 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Ankle Circles", sets: 2, reps: "1 min each", desc: "Lower limb warm-up" },
              { name: "Glute Bridge Hold", sets: 3, reps: "30 sec", desc: "Glute and hip extension" },
              { name: "Bird Dog", sets: 3, reps: "8 each slow", desc: "Hip extension with stability" },
              { name: "Half Kneeling Hip Flexor Stretch", sets: 1, reps: "2 min each", desc: "Deep hip flexor release" },
              { name: "Yoga - Dragon Pose", sets: 1, reps: "2 min each", desc: "Hip flexor and quad stretch" },
              { name: "Yoga - Supine Twist", sets: 1, reps: "2 min each", desc: "Spinal and hip release" }
            ]
          },
          {
            id: "rehab-hip-5",
            name: "Hip Rehab 5",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Mini Band"],
            exercises: [
              { name: "Standing Hip Circles", sets: 2, reps: "1 min each", desc: "Warm-up" },
              { name: "Mini Band Clamshell", sets: 3, reps: "15 each", desc: "Glute med strengthening" },
              { name: "Mini Band Glute Kickback", sets: 3, reps: "12 each", desc: "Glute max activation" },
              { name: "Mini Band Side Lying Hip Abduction", sets: 3, reps: "12 each", desc: "Hip abductor endurance" },
              { name: "Yoga - Lizard Pose", sets: 1, reps: "1 min each", desc: "Deep hip flexor stretch" },
              { name: "Yoga - Happy Baby", sets: 1, reps: "2 min", desc: "Hip release" }
            ]
          },
          {
            id: "rehab-hip-6",
            name: "Hip Rehab 6",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Mini Band"],
            exercises: [
              { name: "Hip Circles", sets: 2, reps: "1 min each", desc: "Warm-up" },
              { name: "SuperBand Glute Bridge", sets: 3, reps: "12", desc: "Loaded hip extension" },
              { name: "Mini Band Fire Hydrants", sets: 3, reps: "15 each", desc: "Rotator strengthening" },
              { name: "Mini Band Standing Hip Abduction", sets: 3, reps: "12 each", desc: "Standing stability" },
              { name: "Frog Stretch", sets: 1, reps: "2 min", desc: "Adductor stretch" },
              { name: "Figure Four Stretch", sets: 1, reps: "1 min each", desc: "Piriformis release" }
            ]
          },
          {
            id: "rehab-hip-7",
            name: "Hip Rehab 7",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Mini Band"],
            exercises: [
              { name: "Standing Hip Circles", sets: 2, reps: "1 min each", desc: "Warm-up" },
              { name: "Mini Band Squat", sets: 3, reps: "12 slow", desc: "Controlled hip flexion and extension" },
              { name: "Mini Band Single Leg Glute Bridge", sets: 3, reps: "10 each", desc: "Unilateral hip strength" },
              { name: "Mini Band Frog Pumps", sets: 3, reps: "15", desc: "Glute activation in external rotation" },
              { name: "Yoga - Pigeon Pose", sets: 1, reps: "2 min each", desc: "Deep external rotation" },
              { name: "Couch Stretch", sets: 1, reps: "1 min each", desc: "Quad and hip flexor release" }
            ]
          },
          {
            id: "rehab-hip-8",
            name: "Hip Rehab 8",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Mini Band", "Light Dumbbells"],
            exercises: [
              { name: "Hip Circles", sets: 2, reps: "1 min each", desc: "Warm-up" },
              { name: "Dumbbell Glute Bridge", sets: 3, reps: "12", desc: "Weighted glute bridge" },
              { name: "Mini Band Clamshell", sets: 3, reps: "20 each", desc: "Glute med endurance" },
              { name: "Step Up", sets: 3, reps: "10 each", desc: "Functional hip loading" },
              { name: "Half Kneeling Hip Flexor Stretch", sets: 1, reps: "2 min each", desc: "Deep hip flexor release" },
              { name: "Yoga - Supine Twist", sets: 1, reps: "2 min each", desc: "Hip and spine release" }
            ]
          },
          {
            id: "rehab-hip-9",
            name: "Hip Rehab 9",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Mini Band"],
            exercises: [
              { name: "Controlled Articular Rotations Hip", sets: 2, reps: "5 each way", desc: "Hip CARs warm-up" },
              { name: "Mini Band Donkey Kicks", sets: 3, reps: "12 each", desc: "Glute isolation" },
              { name: "Mini Band Single Leg Deadlift", sets: 3, reps: "8 each", desc: "Balance and hamstring" },
              { name: "Mini Band Side Lying Hip Abduction", sets: 3, reps: "15 each", desc: "Abductor endurance" },
              { name: "Yoga - Dragon Pose", sets: 1, reps: "2 min each", desc: "Hip flexor stretch" },
              { name: "Yoga - Reclined Butterfly", sets: 1, reps: "2 min", desc: "Passive hip opening" }
            ]
          },
          {
            id: "rehab-hip-10",
            name: "Hip Rehab 10",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Mini Band", "Light Dumbbells"],
            exercises: [
              { name: "Standing Hip Circles", sets: 2, reps: "1 min each", desc: "Full warm-up" },
              { name: "Dumbbell Glute Bridge", sets: 3, reps: "15", desc: "Loaded hip extension" },
              { name: "Mini Band Squat", sets: 3, reps: "15", desc: "Full range squat" },
              { name: "Dumbbell Step Up", sets: 3, reps: "10 each", desc: "Functional strength" },
              { name: "Mini Band Standing Hip Abduction", sets: 3, reps: "15 each", desc: "Hip stability" },
              { name: "Yoga - Pigeon Pose", sets: 1, reps: "2 min each", desc: "Deep hip release" },
              { name: "Yoga - Child's Pose", sets: 1, reps: "2 min", desc: "Cool-down" }
            ]
          }
        ]
      },

      // NECK & CERVICAL REHAB
      "neck": {
        name: "Neck & Cervical Rehab",
        description: "Cervical strain, whiplash recovery, and neck tension relief",
        workouts: [
          {
            id: "rehab-neck-1",
            name: "Neck Rehab 1",
            duration: "15 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Neck Rolls", sets: 2, reps: "1 min", desc: "Gentle cervical warm-up" },
              { name: "Neck Stretch", sets: 1, reps: "1 min each", desc: "Lateral neck release" },
              { name: "Upper Trap Stretch", sets: 1, reps: "1 min each", desc: "Upper trapezius release" },
              { name: "Shoulder Rolls", sets: 2, reps: "1 min", desc: "Shoulder and neck tension release" },
              { name: "Yoga - Child's Pose", sets: 1, reps: "2 min", desc: "Cervical and upper back rest" }
            ]
          },
          {
            id: "rehab-neck-2",
            name: "Neck Rehab 2",
            duration: "15 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Gentle Neck Stretch", sets: 1, reps: "2 min each", desc: "Slow cervical release" },
              { name: "Shoulder Rolls", sets: 2, reps: "1 min", desc: "Tension release" },
              { name: "Yoga - Cat Cow", sets: 1, reps: "2 min", desc: "Cervical and thoracic mobility" },
              { name: "Yoga - Thread the Needle", sets: 1, reps: "1 min each", desc: "Upper back and neck release" },
              { name: "Yoga - Child's Pose", sets: 1, reps: "2 min", desc: "Restful position" }
            ]
          },
          {
            id: "rehab-neck-3",
            name: "Neck Rehab 3",
            duration: "15 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Neck Circles", sets: 2, reps: "1 min", desc: "Cervical mobility" },
              { name: "Neck Stretch", sets: 1, reps: "1 min each", desc: "Side flexion release" },
              { name: "Cross Body Shoulder Stretch", sets: 1, reps: "1 min each", desc: "Posterior shoulder and neck" },
              { name: "Prone Cobra Hold", sets: 3, reps: "15 sec", desc: "Cervical extensor strengthening" },
              { name: "Yoga - Supine Twist", sets: 1, reps: "2 min each", desc: "Spinal release" }
            ]
          },
          {
            id: "rehab-neck-4",
            name: "Neck Rehab 4",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Neck Rolls", sets: 2, reps: "1 min", desc: "Warm-up" },
              { name: "Upper Trap Stretch", sets: 1, reps: "1 min each", desc: "Trap release" },
              { name: "Wall Angels", sets: 3, reps: "8 slow", desc: "Postural correction and scapular control" },
              { name: "Scapular Push Up", sets: 3, reps: "8 slow", desc: "Scapular stability" },
              { name: "Yoga - Thread the Needle", sets: 1, reps: "1 min each", desc: "Thoracic rotation" },
              { name: "Yoga - Child's Pose", sets: 1, reps: "2 min", desc: "Cool-down rest" }
            ]
          },
          {
            id: "rehab-neck-5",
            name: "Neck Rehab 5",
            duration: "20 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Gentle Neck Stretch", sets: 1, reps: "1 min each", desc: "Cervical warm-up" },
              { name: "Shoulder Rolls", sets: 2, reps: "1 min", desc: "Tension release" },
              { name: "Wall Angels", sets: 3, reps: "10 slow", desc: "Overhead mobility with posture" },
              { name: "Prone Cobra Hold", sets: 3, reps: "20 sec", desc: "Cervical and thoracic extensor strength" },
              { name: "Yoga - Cat Cow", sets: 1, reps: "2 min", desc: "Full spinal mobility" },
              { name: "Neck Stretch", sets: 1, reps: "1 min each", desc: "Cool-down release" }
            ]
          },
          {
            id: "rehab-neck-6",
            name: "Neck Rehab 6",
            duration: "20 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Light Resistance Band"],
            exercises: [
              { name: "Neck Rolls", sets: 2, reps: "1 min", desc: "Warm-up" },
              { name: "Band Pull Apart Slow", sets: 3, reps: "12 slow", desc: "Upper back and postural muscles" },
              { name: "Face Pull Slow", sets: 3, reps: "12 slow", desc: "Rear delt and mid-trap" },
              { name: "Wall Angels", sets: 3, reps: "10 slow", desc: "Scapular and postural control" },
              { name: "Upper Trap Stretch", sets: 1, reps: "1 min each", desc: "Trap release" },
              { name: "Yoga - Child's Pose", sets: 1, reps: "2 min", desc: "Rest" }
            ]
          },
          {
            id: "rehab-neck-7",
            name: "Neck Rehab 7",
            duration: "20 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Light Resistance Band"],
            exercises: [
              { name: "Neck Circles", sets: 2, reps: "1 min", desc: "Cervical warm-up" },
              { name: "Mini Band Pull Aparts", sets: 3, reps: "15", desc: "Scapular retraction" },
              { name: "Scapular Push Up", sets: 3, reps: "12", desc: "Serratus anterior strength" },
              { name: "Prone Cobra Hold", sets: 3, reps: "25 sec", desc: "Extensor endurance" },
              { name: "Yoga - Thread the Needle", sets: 1, reps: "1 min each", desc: "Thoracic release" },
              { name: "Gentle Neck Stretch", sets: 1, reps: "1 min each", desc: "Cool-down" }
            ]
          },
          {
            id: "rehab-neck-8",
            name: "Neck Rehab 8",
            duration: "20 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Light Resistance Band"],
            exercises: [
              { name: "Shoulder Rolls", sets: 2, reps: "1 min", desc: "Warm-up" },
              { name: "Mini Band External Rotation", sets: 3, reps: "12", desc: "Rotator cuff and postural support" },
              { name: "Band Pull Apart Slow", sets: 3, reps: "15 slow", desc: "Mid-back strengthening" },
              { name: "Wall Angels", sets: 3, reps: "12 slow", desc: "Full overhead mobility" },
              { name: "Yoga - Cat Cow", sets: 1, reps: "2 min", desc: "Spinal mobility" },
              { name: "Neck Stretch", sets: 1, reps: "1 min each", desc: "Cool-down" }
            ]
          },
          {
            id: "rehab-neck-9",
            name: "Neck Rehab 9",
            duration: "20 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Light Resistance Band"],
            exercises: [
              { name: "Neck Rolls", sets: 2, reps: "1 min", desc: "Warm-up" },
              { name: "SuperBand Face Pulls", sets: 3, reps: "12", desc: "Upper back and external rotation" },
              { name: "Mini Band Bent Over Y's", sets: 3, reps: "12", desc: "Lower trap strengthening" },
              { name: "Prone Cobra Hold", sets: 4, reps: "20 sec", desc: "Posterior chain endurance" },
              { name: "Cross Body Shoulder Stretch", sets: 1, reps: "1 min each", desc: "Shoulder release" },
              { name: "Upper Trap Stretch", sets: 1, reps: "1 min each", desc: "Trap release" }
            ]
          },
          {
            id: "rehab-neck-10",
            name: "Neck Rehab 10",
            duration: "20 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Light Resistance Band"],
            exercises: [
              { name: "Gentle Neck Stretch", sets: 1, reps: "1 min each", desc: "Full cervical warm-up" },
              { name: "Mini Band Pull Aparts", sets: 3, reps: "20", desc: "Scapular endurance" },
              { name: "Face Pull Slow", sets: 3, reps: "15 slow", desc: "Postural strengthening" },
              { name: "Scapular Push Up", sets: 3, reps: "15", desc: "Scapular control" },
              { name: "Wall Angels", sets: 3, reps: "12 slow", desc: "Overhead mobility" },
              { name: "Yoga - Supine Twist", sets: 1, reps: "2 min each", desc: "Full spinal release" }
            ]
          }
        ]
      },

      // ANKLE & FOOT REHAB
      "ankle": {
        name: "Ankle & Foot Rehab",
        description: "Ankle sprain recovery, Achilles rehab, and foot stability",
        workouts: [
          {
            id: "rehab-ankle-1",
            name: "Ankle Rehab 1",
            duration: "15 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Ankle Circles", sets: 3, reps: "1 min each", desc: "Gentle ankle mobilization" },
              { name: "Calf Raises Slow", sets: 3, reps: "10 slow", desc: "Calf and ankle activation" },
              { name: "Calf Stretch", sets: 1, reps: "1 min each", desc: "Gastrocnemius stretch" },
              { name: "Glute Bridge Hold", sets: 3, reps: "20 sec", desc: "Lower limb chain activation" },
              { name: "Yoga - Child's Pose", sets: 1, reps: "2 min", desc: "Rest and ankle dorsiflexion" }
            ]
          },
          {
            id: "rehab-ankle-2",
            name: "Ankle Rehab 2",
            duration: "15 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Ankle Circles", sets: 3, reps: "1 min each", desc: "Mobility warm-up" },
              { name: "Controlled Articular Rotations Ankle", sets: 2, reps: "5 each way", desc: "Ankle CARs for joint health" },
              { name: "Calf Raises Slow", sets: 3, reps: "12 slow", desc: "Eccentric calf control" },
              { name: "Side Lying Leg Raise", sets: 3, reps: "10 each", desc: "Hip stability for ankle support" },
              { name: "Calf Stretch", sets: 1, reps: "1 min each", desc: "Calf and Achilles stretch" }
            ]
          },
          {
            id: "rehab-ankle-3",
            name: "Ankle Rehab 3",
            duration: "15 min",
            difficulty: "Beginner",
            equipment: ["Mat", "Mini Band"],
            exercises: [
              { name: "Ankle Circles", sets: 2, reps: "1 min each", desc: "Warm-up" },
              { name: "Calf Raises Slow", sets: 3, reps: "12 slow", desc: "Progressive calf work" },
              { name: "Mini Band Clamshell", sets: 3, reps: "12 each", desc: "Hip stability for ankle alignment" },
              { name: "Wall Sit Light", sets: 3, reps: "20 sec", desc: "Lower limb isometric" },
              { name: "Calf Stretch", sets: 1, reps: "1 min each", desc: "Calf flexibility" }
            ]
          },
          {
            id: "rehab-ankle-4",
            name: "Ankle Rehab 4",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["Mat", "Foam Roller"],
            exercises: [
              { name: "Ankle Circles", sets: 2, reps: "1 min each", desc: "Warm-up" },
              { name: "Foam Roller Calf", sets: 1, reps: "2 min each", desc: "Calf tissue release" },
              { name: "Foam Roller Shin Front", sets: 1, reps: "1 min each", desc: "Tibialis anterior release" },
              { name: "Foam Roller Foot Arch", sets: 1, reps: "1 min each", desc: "Plantar fascia release" },
              { name: "Calf Raises Slow", sets: 3, reps: "12 slow", desc: "Calf activation post-release" },
              { name: "Calf Stretch", sets: 1, reps: "1 min each", desc: "Stretch" }
            ]
          },
          {
            id: "rehab-ankle-5",
            name: "Ankle Rehab 5",
            duration: "20 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Ankle Circles", sets: 2, reps: "1 min each", desc: "Warm-up" },
              { name: "Controlled Articular Rotations Ankle", sets: 3, reps: "5 each way", desc: "Progressive ankle CARs" },
              { name: "Single Leg Calf Raise", sets: 3, reps: "10 each", desc: "Unilateral calf strengthening" },
              { name: "Mini Band Squat", sets: 3, reps: "10 slow", desc: "Controlled ankle dorsiflexion" },
              { name: "Step Up", sets: 3, reps: "8 each", desc: "Functional ankle loading" },
              { name: "Calf Stretch", sets: 1, reps: "1 min each", desc: "Cool-down" }
            ]
          },
          {
            id: "rehab-ankle-6",
            name: "Ankle Rehab 6",
            duration: "20 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Foam Roller"],
            exercises: [
              { name: "Foam Roller Calf", sets: 1, reps: "2 min each", desc: "Calf release" },
              { name: "Foam Roller Peroneals", sets: 1, reps: "1 min each", desc: "Lateral ankle support release" },
              { name: "Ankle Circles", sets: 2, reps: "1 min each", desc: "Post-release mobility" },
              { name: "Single Leg Calf Raise", sets: 3, reps: "12 each", desc: "Calf endurance" },
              { name: "Mini Band Standing Hip Abduction", sets: 3, reps: "10 each", desc: "Hip stability for ankle chain" },
              { name: "Calf Stretch", sets: 1, reps: "1 min each", desc: "Stretch" }
            ]
          },
          {
            id: "rehab-ankle-7",
            name: "Ankle Rehab 7",
            duration: "20 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Mini Band"],
            exercises: [
              { name: "Ankle Circles", sets: 2, reps: "1 min each", desc: "Warm-up" },
              { name: "Calf Raises Slow", sets: 3, reps: "15 slow", desc: "Eccentric focus" },
              { name: "Mini Band Squat", sets: 3, reps: "12", desc: "Full ankle ROM under load" },
              { name: "Band Reverse Lunge", sets: 3, reps: "8 each", desc: "Controlled ankle stability" },
              { name: "Mini Band Clamshell", sets: 3, reps: "15 each", desc: "Hip and ankle chain stability" },
              { name: "Calf Stretch", sets: 1, reps: "1 min each", desc: "Cool-down stretch" }
            ]
          },
          {
            id: "rehab-ankle-8",
            name: "Ankle Rehab 8",
            duration: "20 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Light Dumbbells"],
            exercises: [
              { name: "Ankle Circles", sets: 2, reps: "1 min each", desc: "Warm-up" },
              { name: "Dumbbell Calf Raise", sets: 3, reps: "12", desc: "Loaded calf work" },
              { name: "Dumbbell Step Up", sets: 3, reps: "8 each", desc: "Functional ankle loading" },
              { name: "Single Leg Calf Raise", sets: 3, reps: "10 each", desc: "Unilateral strength" },
              { name: "Controlled Articular Rotations Ankle", sets: 2, reps: "5 each way", desc: "Ankle CARs" },
              { name: "Calf Stretch", sets: 1, reps: "1 min each", desc: "Cool-down" }
            ]
          },
          {
            id: "rehab-ankle-9",
            name: "Ankle Rehab 9",
            duration: "20 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Foam Roller", "Mini Band"],
            exercises: [
              { name: "Foam Roller Calf", sets: 1, reps: "2 min each", desc: "Pre-exercise release" },
              { name: "Foam Roller Foot Arch", sets: 1, reps: "1 min each", desc: "Plantar release" },
              { name: "Ankle Circles", sets: 2, reps: "1 min each", desc: "Mobility work" },
              { name: "Single Leg Calf Raise", sets: 3, reps: "12 each", desc: "Progressive calf strength" },
              { name: "Mini Band Squat", sets: 3, reps: "12", desc: "Ankle and knee stability" },
              { name: "Calf Stretch", sets: 1, reps: "1 min each", desc: "Stretch" }
            ]
          },
          {
            id: "rehab-ankle-10",
            name: "Ankle Rehab 10",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Light Dumbbells", "Mini Band"],
            exercises: [
              { name: "Controlled Articular Rotations Ankle", sets: 3, reps: "5 each way", desc: "Full ankle CARs" },
              { name: "Dumbbell Calf Raise", sets: 3, reps: "15", desc: "Loaded calf endurance" },
              { name: "Step Up", sets: 3, reps: "10 each", desc: "Functional single leg work" },
              { name: "Band Reverse Lunge", sets: 3, reps: "10 each", desc: "Ankle stability under load" },
              { name: "Mini Band Standing Hip Abduction", sets: 3, reps: "12 each", desc: "Kinetic chain stability" },
              { name: "Calf Stretch", sets: 1, reps: "1 min each", desc: "Cool-down" }
            ]
          }
        ]
      }
    }
  }
};

// Export for use in the dashboard
if (typeof window !== 'undefined') {
  window.WORKOUT_LIBRARY = WORKOUT_LIBRARY;
}
