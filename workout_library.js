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
            name: "Classic Back Builder",
            duration: "45-50 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Cable", "Dumbbells"],
            exercises: [
              { name: "Barbell Romanian Deadlift", sets: 4, reps: "8-10", desc: "Warm up the posterior chain" },
              { name: "Cable Seated Rotational Row", sets: 4, reps: "10-12", desc: "Focus on the squeeze" },
              { name: "Lat Machine Wide Bar Close Grip Pulldown", sets: 4, reps: "10-12", desc: "Control the negative" },
              { name: "Dumbbell Single Arm Bent Over Row", sets: 3, reps: "12 each", desc: "Pull to hip" },
              { name: "Cable Single Arm Reverse Fly", sets: 3, reps: "15 each", desc: "Rear delts" },
              { name: "Dumbbell Shrug", sets: 3, reps: "15", desc: "Trap focus" }
            ]
          },
          {
            id: "gym-back-2",
            name: "Pull Day Power",
            duration: "50-55 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Cable", "Pull-up Bar"],
            exercises: [
              { name: "Barbell Romanian Deadlift", sets: 4, reps: "6-8", desc: "Heavy pulls" },
              { name: "Wide Grip Pull Up", sets: 4, reps: "8-10", desc: "Go to failure" },
              { name: "Cable Seated Rotational Row", sets: 4, reps: "8-10", desc: "Explosive pull, slow return" },
              { name: "Lat Machine Parallel Grip Row", sets: 3, reps: "12", desc: "Squeeze at top" },
              { name: "Cable Rope Face Pull", sets: 3, reps: "15", desc: "Upper back" },
              { name: "Cable Shrug", sets: 3, reps: "12", desc: "Trap finisher" }
            ]
          },
          {
            id: "gym-back-3",
            name: "Hypertrophy Back",
            duration: "50 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells", "Cable", "Machine"],
            exercises: [
              { name: "Dumbbell Single Leg Deadlift", sets: 4, reps: "10 each", desc: "Unilateral strength" },
              { name: "Machine Assisted Wide Grip Pull Up", sets: 4, reps: "12", desc: "Lats focus" },
              { name: "Cable Single Arm Row", sets: 4, reps: "12 each", desc: "Feel the stretch" },
              { name: "Lat Machine Wide Bar Close Grip Pulldown", sets: 3, reps: "15", desc: "Pump work" },
              { name: "Dumbbell Incline Row", sets: 3, reps: "12", desc: "Upper back thickness" },
              { name: "Cable Single Arm Reverse Fly", sets: 3, reps: "20 each", desc: "Rear delt burnout" }
            ]
          },
          {
            id: "gym-back-4",
            name: "Back Strength Focus",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Cable", "T-Bar"],
            exercises: [
              { name: "Barbell Romanian Deadlift", sets: 5, reps: "5", desc: "Strength building" },
              { name: "Landmine T-Bar Close Grip Row", sets: 4, reps: "6-8", desc: "Heavy rows" },
              { name: "Cable Seated Rotational Row", sets: 4, reps: "8", desc: "Power pulls" },
              { name: "Wide Grip Pull Up", sets: 3, reps: "Max", desc: "Bodyweight finisher" },
              { name: "Cable Rope Face Pull", sets: 3, reps: "15", desc: "Upper back volume" }
            ]
          },
          {
            id: "gym-back-5",
            name: "Volume Back Blitz",
            duration: "55 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells", "Cable", "Machine"],
            exercises: [
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "12", desc: "Mind-muscle connection" },
              { name: "Lat Machine Parallel Grip Row", sets: 4, reps: "12", desc: "Full ROM" },
              { name: "Cable Single Arm Row", sets: 4, reps: "15 each", desc: "High volume" },
              { name: "Machine Assisted Wide Grip Pull Up", sets: 3, reps: "15", desc: "Lat stretch" },
              { name: "Dumbbell Single Arm Bent Over Row", sets: 3, reps: "15 each", desc: "Unilateral volume" },
              { name: "Cable Single Arm Reverse Fly", sets: 3, reps: "20 each", desc: "Rear delt pump" },
              { name: "Dumbbell Shrug", sets: 3, reps: "20", desc: "Trap finisher" }
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
            name: "Quad Focused",
            duration: "50-55 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Machine", "Dumbbells"],
            exercises: [
              { name: "Barbell Back Squat", sets: 4, reps: "8-10", desc: "Control the descent" },
              { name: "Barbell Front Squat", sets: 4, reps: "8-10", desc: "Keep chest up" },
              { name: "Machine Single Leg Extension", sets: 3, reps: "12 each", desc: "Squeeze at top" },
              { name: "Seated Leg Press", sets: 4, reps: "12", desc: "Full range of motion" },
              { name: "Dumbbell Walking Lunge", sets: 3, reps: "10 each leg", desc: "Step and drive" },
              { name: "Machine Seated Single Leg Calf Raise", sets: 4, reps: "15 each", desc: "Calf finisher" }
            ]
          },
          {
            id: "gym-legs-2",
            name: "Glute & Hamstring Day",
            duration: "50 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Cable", "Machine"],
            exercises: [
              { name: "Barbell Romanian Deadlift", sets: 4, reps: "10", desc: "Feel the stretch" },
              { name: "Barbell Hip Thrust", sets: 4, reps: "12", desc: "Full glute activation" },
              { name: "Machine Seated Leg Curl", sets: 4, reps: "12", desc: "Hamstring focus" },
              { name: "Dumbbell Bulgarian Split Squat", sets: 3, reps: "10 each", desc: "Glute emphasis" },
              { name: "Cable Pull Through", sets: 3, reps: "15", desc: "Hip hinge pattern" },
              { name: "Smith Machine Glute Bridge", sets: 3, reps: "15", desc: "Glute burnout" }
            ]
          },
          {
            id: "gym-legs-3",
            name: "Full Leg Power",
            duration: "60 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Machine", "Dumbbells"],
            exercises: [
              { name: "Barbell Back Squat", sets: 5, reps: "5", desc: "Heavy strength work" },
              { name: "Barbell Romanian Deadlift", sets: 4, reps: "6", desc: "Posterior chain power" },
              { name: "Barbell Front Squat", sets: 4, reps: "8", desc: "Quad strength" },
              { name: "Machine Sumo Leg Press", sets: 4, reps: "10", desc: "Glute emphasis" },
              { name: "Machine Seated Leg Curl", sets: 3, reps: "10", desc: "Hamstring work" },
              { name: "Machine Single Leg Extension", sets: 3, reps: "12 each", desc: "Quad finisher" },
              { name: "Smith Machine Calf Raise", sets: 4, reps: "12", desc: "Calf strength" }
            ]
          },
          {
            id: "gym-legs-4",
            name: "Leg Hypertrophy",
            duration: "55 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells", "Machine", "Barbell"],
            exercises: [
              { name: "Barbell Back Squat", sets: 4, reps: "12", desc: "Volume work" },
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "12", desc: "Hamstring stretch" },
              { name: "Seated Leg Press", sets: 4, reps: "15", desc: "High reps" },
              { name: "Machine Seated Single Leg Curl", sets: 4, reps: "12 each", desc: "Unilateral hamstrings" },
              { name: "Dumbbell Walking Lunge", sets: 3, reps: "12 each", desc: "Glute and quad pump" },
              { name: "Machine Single Leg Extension", sets: 3, reps: "15 each", desc: "Quad isolation" },
              { name: "Machine Seated Single Leg Calf Raise", sets: 4, reps: "20 each", desc: "Calf volume" }
            ]
          },
          {
            id: "gym-legs-5",
            name: "Athletic Legs",
            duration: "50 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Plyometric Box"],
            exercises: [
              { name: "Barbell Front Squat", sets: 4, reps: "8", desc: "Explosive drive" },
              { name: "Box Jump", sets: 4, reps: "8", desc: "Power development" },
              { name: "Barbell Romanian Deadlift", sets: 4, reps: "8", desc: "Hip power" },
              { name: "Dumbbell Bulgarian Split Squat", sets: 3, reps: "10 each", desc: "Unilateral strength" },
              { name: "Jumping Split Squat", sets: 3, reps: "8 each", desc: "Explosive power" },
              { name: "Smith Machine Calf Raise", sets: 3, reps: "15", desc: "Calf power" }
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
            name: "Chest Power",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Bench Press", sets: 4, reps: "8", desc: "Chest strength" },
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "10", desc: "Upper chest" },
              { name: "Dumbbell Flat Bench Fly", sets: 3, reps: "12", desc: "Chest stretch" },
              { name: "Cable Standing High To Low Fly", sets: 3, reps: "15", desc: "Lower chest" },
              { name: "Dumbbell Close Grip Press", sets: 3, reps: "12", desc: "Inner chest" }
            ]
          },
          {
            id: "gym-chest-2",
            name: "Chest Hypertrophy",
            duration: "50 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells", "Cable", "Machine"],
            exercises: [
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "12", desc: "Upper chest volume" },
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "12", desc: "Mid chest" },
              { name: "Cable Standing High To Low Fly", sets: 4, reps: "15", desc: "Lower chest pump" },
              { name: "Machine Seated Parallel Grip Chest Press", sets: 3, reps: "15", desc: "Machine pump" },
              { name: "Dumbbell Flat Bench Fly", sets: 3, reps: "15", desc: "Chest stretch" },
              { name: "Push Up", sets: 3, reps: "Max", desc: "Bodyweight finisher" }
            ]
          },
          {
            id: "gym-chest-3",
            name: "Upper Chest Focus",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Incline Bench Press", sets: 4, reps: "8", desc: "Upper chest strength" },
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "10", desc: "Upper chest volume" },
              { name: "Cable Low to High Fly", sets: 4, reps: "12", desc: "Upper chest isolation" },
              { name: "Dumbbell Incline Bench Fly", sets: 3, reps: "15", desc: "Upper chest stretch" },
              { name: "Piked Push Up", sets: 3, reps: "12", desc: "Bodyweight finisher" }
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
            name: "Complete Push",
            duration: "55 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Bench Press", sets: 4, reps: "8", desc: "Chest strength" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "10", desc: "Shoulder power" },
              { name: "Dumbbell Incline Bench Press", sets: 3, reps: "12", desc: "Upper chest" },
              { name: "Dumbbell Lateral Raise", sets: 3, reps: "15", desc: "Side delts" },
              { name: "Cable Rope Tricep Extension", sets: 3, reps: "12", desc: "Tricep isolation" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 3, reps: "12", desc: "Long head tricep" }
            ]
          },
          {
            id: "gym-push-2",
            name: "Power Push",
            duration: "50 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Bench Press", sets: 5, reps: "5", desc: "Heavy pressing" },
              { name: "Barbell Overhead Press", sets: 4, reps: "6", desc: "Shoulder strength" },
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "8", desc: "Upper chest power" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "10", desc: "Tricep work" },
              { name: "Dumbbell Lateral Raise", sets: 3, reps: "12", desc: "Delt volume" }
            ]
          },
          {
            id: "gym-push-3",
            name: "Volume Push",
            duration: "60 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells", "Cable", "Machine"],
            exercises: [
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "12", desc: "Chest volume" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "12", desc: "Shoulder volume" },
              { name: "Cable Standing High To Low Fly", sets: 3, reps: "15", desc: "Lower chest" },
              { name: "Dumbbell Front Raise", sets: 3, reps: "15", desc: "Front delts" },
              { name: "Dumbbell Lateral Raise", sets: 3, reps: "15", desc: "Side delts" },
              { name: "Cable Rope Tricep Extension", sets: 4, reps: "15", desc: "Tricep pump" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 3, reps: "15", desc: "Tricep finisher" }
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
            name: "Complete Pull",
            duration: "50 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Cable", "Dumbbells"],
            exercises: [
              { name: "Barbell Romanian Deadlift", sets: 4, reps: "8", desc: "Posterior chain" },
              { name: "Wide Grip Pull Up", sets: 4, reps: "8-10", desc: "Lat width" },
              { name: "Cable Seated Rotational Row", sets: 4, reps: "10", desc: "Back thickness" },
              { name: "Dumbbell Hammer Curl", sets: 3, reps: "12", desc: "Bicep work" },
              { name: "Cable Rope Face Pull", sets: 3, reps: "15", desc: "Rear delts" },
              { name: "Dumbbell Bicep Curl", sets: 3, reps: "12", desc: "Bicep finisher" }
            ]
          },
          {
            id: "gym-pull-2",
            name: "Power Pull",
            duration: "50 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "T-Bar", "Dumbbells"],
            exercises: [
              { name: "Barbell Romanian Deadlift", sets: 5, reps: "5", desc: "Heavy strength" },
              { name: "Landmine T-Bar Close Grip Row", sets: 4, reps: "6-8", desc: "Back power" },
              { name: "Wide Grip Pull Up", sets: 4, reps: "Max", desc: "Lat strength" },
              { name: "Barbell Curl", sets: 4, reps: "8", desc: "Bicep strength" },
              { name: "Dumbbell Hammer Curl", sets: 3, reps: "10", desc: "Forearm and bicep" }
            ]
          },
          {
            id: "gym-pull-3",
            name: "Hypertrophy Pull",
            duration: "55 min",
            difficulty: "Intermediate",
            equipment: ["Cable", "Dumbbells", "Machine"],
            exercises: [
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "12", desc: "Hamstring work" },
              { name: "Lat Machine Parallel Grip Row", sets: 4, reps: "12", desc: "Back volume" },
              { name: "Cable Single Arm Row", sets: 4, reps: "12 each", desc: "Unilateral work" },
              { name: "Machine Assisted Wide Grip Pull Up", sets: 3, reps: "15", desc: "Lat pump" },
              { name: "Cable Single Arm Bicep Curl", sets: 3, reps: "15 each", desc: "Bicep isolation" },
              { name: "Dumbbell Hammer Curl", sets: 3, reps: "15", desc: "Bicep finisher" },
              { name: "Cable Rope Face Pull", sets: 3, reps: "20", desc: "Rear delt volume" }
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
            name: "Complete Shoulder",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Overhead Press", sets: 4, reps: "8", desc: "Shoulder strength" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12", desc: "Side delts" },
              { name: "Dumbbell Front Raise", sets: 3, reps: "12", desc: "Front delts" },
              { name: "Cable Rope Face Pull", sets: 3, reps: "15", desc: "Rear delts" },
              { name: "Dumbbell Shrug", sets: 3, reps: "15", desc: "Traps" }
            ]
          },
          {
            id: "gym-shoulders-2",
            name: "Shoulder Hypertrophy",
            duration: "50 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells", "Cable", "Machine"],
            exercises: [
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "12", desc: "Overall delts" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "15", desc: "Side delt volume" },
              { name: "Cable Single Arm Lateral Raise", sets: 3, reps: "15 each", desc: "Side delt isolation" },
              { name: "Cable Rope Face Pull", sets: 4, reps: "15", desc: "Rear delt work" },
              { name: "Dumbbell Front Raise", sets: 3, reps: "15", desc: "Front delt pump" },
              { name: "Cable Shrug", sets: 3, reps: "20", desc: "Trap finisher" }
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
            name: "Full Body Strength",
            duration: "60 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Back Squat", sets: 4, reps: "6", desc: "Leg strength" },
              { name: "Barbell Bench Press", sets: 4, reps: "6", desc: "Chest strength" },
              { name: "Barbell Romanian Deadlift", sets: 4, reps: "6", desc: "Posterior chain" },
              { name: "Barbell Overhead Press", sets: 3, reps: "8", desc: "Shoulder strength" },
              { name: "Cable Seated Rotational Row", sets: 3, reps: "10", desc: "Back work" },
              { name: "Dumbbell Walking Lunge", sets: 3, reps: "8 each", desc: "Leg finisher" }
            ]
          },
          {
            id: "gym-fullbody-2",
            name: "Full Body Hypertrophy",
            duration: "60 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells", "Cable", "Machine"],
            exercises: [
              { name: "Seated Leg Press", sets: 4, reps: "12", desc: "Leg volume" },
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "12", desc: "Chest work" },
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "12", desc: "Hamstrings" },
              { name: "Cable Seated Rotational Row", sets: 4, reps: "12", desc: "Back volume" },
              { name: "Dumbbell Seated Shoulder Press", sets: 3, reps: "12", desc: "Shoulders" },
              { name: "Dumbbell Bicep Curl", sets: 3, reps: "15", desc: "Biceps" },
              { name: "Cable Rope Tricep Extension", sets: 3, reps: "15", desc: "Triceps" }
            ]
          },
          {
            id: "gym-fullbody-3",
            name: "Athletic Full Body",
            duration: "55 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Plyometric"],
            exercises: [
              { name: "Barbell Clean and Press", sets: 4, reps: "6", desc: "Total body power" },
              { name: "Box Jump", sets: 4, reps: "8", desc: "Explosive power" },
              { name: "Barbell Front Squat", sets: 4, reps: "8", desc: "Leg power" },
              { name: "Dumbbell Renegade Row", sets: 3, reps: "10 each", desc: "Core and back" },
              { name: "Dumbbell Thruster", sets: 3, reps: "12", desc: "Full body" },
              { name: "Burpee", sets: 3, reps: "15", desc: "Conditioning finisher" }
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
            name: "Upper Strength",
            duration: "50 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Dumbbells", "Cable"],
            exercises: [
              { name: "Barbell Bench Press", sets: 4, reps: "6", desc: "Chest strength" },
              { name: "Barbell Overhead Press", sets: 4, reps: "6", desc: "Shoulder strength" },
              { name: "Wide Grip Pull Up", sets: 4, reps: "8", desc: "Back strength" },
              { name: "Cable Seated Rotational Row", sets: 3, reps: "10", desc: "Back work" },
              { name: "Dumbbell Bicep Curl", sets: 3, reps: "10", desc: "Biceps" },
              { name: "Cable Rope Tricep Extension", sets: 3, reps: "10", desc: "Triceps" }
            ]
          },
          {
            id: "gym-upper-2",
            name: "Upper Hypertrophy",
            duration: "55 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells", "Cable", "Machine"],
            exercises: [
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "12", desc: "Upper chest" },
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "12", desc: "Mid chest" },
              { name: "Lat Machine Parallel Grip Row", sets: 4, reps: "12", desc: "Back thickness" },
              { name: "Cable Single Arm Row", sets: 3, reps: "12 each", desc: "Unilateral back" },
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "12", desc: "Shoulders" },
              { name: "Dumbbell Lateral Raise", sets: 3, reps: "15", desc: "Side delts" },
              { name: "Cable Single Arm Bicep Curl", sets: 3, reps: "15 each", desc: "Bicep pump" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 3, reps: "15", desc: "Tricep pump" }
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
            name: "Lower Strength",
            duration: "50 min",
            difficulty: "Advanced",
            equipment: ["Barbell", "Machine"],
            exercises: [
              { name: "Barbell Back Squat", sets: 5, reps: "5", desc: "Leg strength" },
              { name: "Barbell Romanian Deadlift", sets: 4, reps: "6", desc: "Posterior chain" },
              { name: "Barbell Front Squat", sets: 4, reps: "6", desc: "Quad strength" },
              { name: "Machine Seated Leg Curl", sets: 3, reps: "10", desc: "Hamstrings" },
              { name: "Smith Machine Calf Raise", sets: 4, reps: "12", desc: "Calves" }
            ]
          },
          {
            id: "gym-lower-2",
            name: "Lower Hypertrophy",
            duration: "55 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells", "Machine", "Barbell"],
            exercises: [
              { name: "Barbell Back Squat", sets: 4, reps: "12", desc: "Quad volume" },
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "12", desc: "Hamstring stretch" },
              { name: "Seated Leg Press", sets: 4, reps: "15", desc: "Leg pump" },
              { name: "Dumbbell Bulgarian Split Squat", sets: 3, reps: "12 each", desc: "Unilateral legs" },
              { name: "Machine Seated Leg Curl", sets: 4, reps: "15", desc: "Hamstring volume" },
              { name: "Machine Single Leg Extension", sets: 3, reps: "15 each", desc: "Quad isolation" },
              { name: "Machine Seated Single Leg Calf Raise", sets: 4, reps: "20 each", desc: "Calf volume" }
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
            name: "Dumbbell Upper Power",
            duration: "40 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "10", desc: "Chest strength" },
              { name: "Dumbbell Bent Over Row", sets: 4, reps: "10", desc: "Back strength" },
              { name: "Dumbbell Seated Shoulder Press", sets: 3, reps: "12", desc: "Shoulder work" },
              { name: "Dumbbell Bicep Curl", sets: 3, reps: "12", desc: "Biceps" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 3, reps: "12", desc: "Triceps" }
            ]
          },
          {
            id: "home-upper-2",
            name: "Upper Body Sculpt",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Incline Bench Press", sets: 4, reps: "12", desc: "Upper chest" },
              { name: "Dumbbell Flat Bench Fly", sets: 3, reps: "15", desc: "Chest stretch" },
              { name: "Dumbbell Single Arm Bent Over Row", sets: 4, reps: "12 each", desc: "Back work" },
              { name: "Dumbbell Lateral Raise", sets: 3, reps: "15", desc: "Side delts" },
              { name: "Dumbbell Front Raise", sets: 3, reps: "15", desc: "Front delts" },
              { name: "Dumbbell Hammer Curl", sets: 3, reps: "15", desc: "Biceps" },
              { name: "Dumbbell Skull Crusher", sets: 3, reps: "15", desc: "Triceps" }
            ]
          },
          {
            id: "home-upper-3",
            name: "Push Pull Upper",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Floor Press", sets: 4, reps: "12", desc: "Chest press" },
              { name: "Dumbbell Bent Over Row", sets: 4, reps: "12", desc: "Back rows" },
              { name: "Dumbbell Seated Shoulder Press", sets: 3, reps: "12", desc: "Shoulders" },
              { name: "Dumbbell Renegade Row", sets: 3, reps: "10 each", desc: "Core and back" },
              { name: "Dumbbell Bicep Curl", sets: 3, reps: "15", desc: "Bicep pump" },
              { name: "Dumbbell Tricep Kickback", sets: 3, reps: "15 each", desc: "Tricep isolation" }
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
            name: "Dumbbell Leg Day",
            duration: "40 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Goblet Squat", sets: 4, reps: "12", desc: "Quad focus" },
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "12", desc: "Hamstrings" },
              { name: "Dumbbell Walking Lunge", sets: 3, reps: "10 each", desc: "Unilateral legs" },
              { name: "Dumbbell Bulgarian Split Squat", sets: 3, reps: "12 each", desc: "Glute work" },
              { name: "Dumbbell Calf Raise", sets: 4, reps: "15", desc: "Calves" }
            ]
          },
          {
            id: "home-lower-2",
            name: "Glute & Hamstring Focus",
            duration: "40 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "12", desc: "Hamstring stretch" },
              { name: "Dumbbell Hip Thrust", sets: 4, reps: "15", desc: "Glute activation" },
              { name: "Dumbbell Single Leg Deadlift", sets: 3, reps: "12 each", desc: "Unilateral hamstrings" },
              { name: "Dumbbell Bulgarian Split Squat", sets: 3, reps: "12 each", desc: "Glute emphasis" },
              { name: "Dumbbell Sumo Squat", sets: 3, reps: "15", desc: "Inner thigh and glutes" },
              { name: "Dumbbell Single Leg Calf Raise", sets: 3, reps: "15 each", desc: "Calf work" }
            ]
          },
          {
            id: "home-lower-3",
            name: "Quad Focused Lower",
            duration: "40 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Goblet Squat", sets: 4, reps: "15", desc: "Quad volume" },
              { name: "Dumbbell Front Squat", sets: 4, reps: "12", desc: "Quad emphasis" },
              { name: "Dumbbell Walking Lunge", sets: 3, reps: "12 each", desc: "Quad and glute" },
              { name: "Dumbbell Step Up", sets: 3, reps: "12 each", desc: "Unilateral quads" },
              { name: "Dumbbell Romanian Deadlift", sets: 3, reps: "12", desc: "Hamstring work" },
              { name: "Dumbbell Calf Raise", sets: 4, reps: "20", desc: "Calf finisher" }
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
            name: "Total Body Strength",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Goblet Squat", sets: 4, reps: "10", desc: "Legs" },
              { name: "Dumbbell Flat Bench Press", sets: 4, reps: "10", desc: "Chest" },
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "10", desc: "Hamstrings" },
              { name: "Dumbbell Bent Over Row", sets: 3, reps: "12", desc: "Back" },
              { name: "Dumbbell Seated Shoulder Press", sets: 3, reps: "12", desc: "Shoulders" },
              { name: "Dumbbell Bicep Curl", sets: 3, reps: "12", desc: "Biceps" }
            ]
          },
          {
            id: "home-fullbody-2",
            name: "Dumbbell Circuit",
            duration: "40 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Thruster", sets: 4, reps: "12", desc: "Total body" },
              { name: "Dumbbell Renegade Row", sets: 3, reps: "10 each", desc: "Core and back" },
              { name: "Dumbbell Walking Lunge", sets: 3, reps: "10 each", desc: "Legs" },
              { name: "Dumbbell Floor Press", sets: 3, reps: "12", desc: "Chest" },
              { name: "Dumbbell Single Leg Deadlift", sets: 3, reps: "10 each", desc: "Hamstrings and balance" },
              { name: "Dumbbell Man Maker", sets: 3, reps: "8", desc: "Full body finisher" }
            ]
          },
          {
            id: "home-fullbody-3",
            name: "Home Metabolic",
            duration: "35 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Squat to Press", sets: 4, reps: "15", desc: "Legs and shoulders" },
              { name: "Dumbbell Man Maker", sets: 3, reps: "10", desc: "Total body power" },
              { name: "Dumbbell Romanian Deadlift To Bent Over Row", sets: 3, reps: "12", desc: "Posterior chain" },
              { name: "Dumbbell Thruster", sets: 3, reps: "15", desc: "Explosive work" },
              { name: "Dumbbell Renegade Row", sets: 3, reps: "12 each", desc: "Core finisher" }
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
            name: "Arm Blaster",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "12", desc: "Bicep mass" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "12", desc: "Tricep long head" },
              { name: "Dumbbell Hammer Curl", sets: 3, reps: "15", desc: "Forearm and bicep" },
              { name: "Dumbbell Skull Crusher", sets: 3, reps: "15", desc: "Tricep isolation" },
              { name: "Dumbbell Concentration Curl", sets: 3, reps: "15 each", desc: "Bicep peak" },
              { name: "Dumbbell Tricep Kickback", sets: 3, reps: "15 each", desc: "Tricep finisher" }
            ]
          },
          {
            id: "home-arms-2",
            name: "Bicep & Tricep Pump",
            duration: "35 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Alternating Bicep Curl", sets: 4, reps: "12 each", desc: "Alternating biceps" },
              { name: "Dumbbell Close Grip Press", sets: 4, reps: "12", desc: "Tricep compound" },
              { name: "Dumbbell Hammer Curl", sets: 3, reps: "15", desc: "Brachialis work" },
              { name: "Dumbbell Overhead Tricep Extension", sets: 3, reps: "15", desc: "Long head tricep" },
              { name: "Dumbbell Zottman Curl", sets: 3, reps: "12", desc: "Bicep and forearm" },
              { name: "Dumbbell Tricep Kickback", sets: 3, reps: "20 each", desc: "Tricep burnout" }
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
            name: "Dumbbell Shoulder Builder",
            duration: "35 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Seated Shoulder Press", sets: 4, reps: "12", desc: "Overall delts" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "15", desc: "Side delts" },
              { name: "Dumbbell Front Raise", sets: 3, reps: "15", desc: "Front delts" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 3, reps: "15", desc: "Rear delts" },
              { name: "Dumbbell Shrug", sets: 3, reps: "15", desc: "Traps" }
            ]
          },
          {
            id: "home-shoulders-2",
            name: "Shoulder Sculpt",
            duration: "40 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Standing Shoulder Press", sets: 4, reps: "12", desc: "Core engaged press" },
              { name: "Dumbbell Arnold Press", sets: 3, reps: "12", desc: "All three heads" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "15", desc: "Side delt volume" },
              { name: "Dumbbell Front Raise to Lateral Raise", sets: 3, reps: "12", desc: "Combo movement" },
              { name: "Dumbbell Bent Over Reverse Fly", sets: 3, reps: "15", desc: "Rear delt work" },
              { name: "Dumbbell Upright Row", sets: 3, reps: "12", desc: "Overall shoulder" }
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
            name: "Push-Up Variations",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["None"],
            exercises: [
              { name: "Push Up", sets: 4, reps: "12", desc: "Standard push-up" },
              { name: "Wide Grip Push Up", sets: 3, reps: "10", desc: "Chest emphasis" },
              { name: "Diamond Push Up", sets: 3, reps: "10", desc: "Tricep focus" },
              { name: "Decline Push Up", sets: 3, reps: "12", desc: "Upper chest" },
              { name: "Plank", sets: 3, reps: "45 sec", desc: "Core finisher" }
            ]
          },
          {
            id: "bw-upper-2",
            name: "Bodyweight Upper Power",
            duration: "35 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Pike Push Up", sets: 4, reps: "10", desc: "Shoulder work" },
              { name: "Push Up", sets: 4, reps: "15", desc: "Chest volume" },
              { name: "Tricep Dip", sets: 3, reps: "12", desc: "Tricep focus" },
              { name: "Plank Shoulder Tap", sets: 3, reps: "20 total", desc: "Core and shoulders" },
              { name: "Push Up to T-rotation", sets: 3, reps: "10", desc: "Chest and core" }
            ]
          },
          {
            id: "bw-upper-3",
            name: "Advanced Bodyweight Upper",
            duration: "40 min",
            difficulty: "Advanced",
            equipment: ["Pull-up Bar"],
            exercises: [
              { name: "Pull Up", sets: 4, reps: "8", desc: "Back strength" },
              { name: "Chin Up", sets: 3, reps: "10", desc: "Bicep emphasis" },
              { name: "Pike Push Up to Reach", sets: 3, reps: "12", desc: "Shoulders" },
              { name: "Diamond Push Up", sets: 3, reps: "15", desc: "Triceps" },
              { name: "Plank Alternating Arm & Leg Lift", sets: 3, reps: "12 each", desc: "Core stability" }
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
            name: "Bodyweight Leg Burner",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["None"],
            exercises: [
              { name: "Air Squat", sets: 4, reps: "15", desc: "Basic squat" },
              { name: "Reverse Lunge", sets: 3, reps: "12 each", desc: "Unilateral legs" },
              { name: "Glute Bridge", sets: 3, reps: "15", desc: "Glute activation" },
              { name: "Wall Sit", sets: 3, reps: "45 sec", desc: "Quad endurance" },
              { name: "Calf Raise", sets: 3, reps: "20", desc: "Calf work" }
            ]
          },
          {
            id: "bw-lower-2",
            name: "Plyometric Lower",
            duration: "35 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Jump Squat", sets: 4, reps: "12", desc: "Explosive power" },
              { name: "Jumping Split Squat", sets: 3, reps: "10 each", desc: "Unilateral power" },
              { name: "Lateral Lunge", sets: 3, reps: "12 each", desc: "Side to side" },
              { name: "Single Leg Glute Bridge", sets: 3, reps: "12 each", desc: "Glute isolation" },
              { name: "Single Leg Calf Raise", sets: 3, reps: "15 each", desc: "Calf strength" }
            ]
          },
          {
            id: "bw-lower-3",
            name: "Advanced Bodyweight Legs",
            duration: "40 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "Pistol Squat", sets: 4, reps: "8 each", desc: "Advanced unilateral" },
              { name: "Jump Squat to Reverse Lunge", sets: 3, reps: "10", desc: "Power combo" },
              { name: "Pulse Sumo Squats", sets: 3, reps: "20", desc: "Inner thigh burn" },
              { name: "Single Leg Glute Bridge", sets: 3, reps: "15 each", desc: "Glute finisher" },
              { name: "Pogo Hops", sets: 3, reps: "30", desc: "Calf power" }
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
            name: "Bodyweight HIIT",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Burpee", sets: 4, reps: "12", desc: "Total body cardio" },
              { name: "Jump Squat", sets: 3, reps: "15", desc: "Lower body power" },
              { name: "Push Up", sets: 3, reps: "15", desc: "Upper body push" },
              { name: "Mountain Climber", sets: 3, reps: "30 total", desc: "Core and cardio" },
              { name: "Jumping Jacks", sets: 3, reps: "30", desc: "Conditioning finisher" }
            ]
          },
          {
            id: "bw-fullbody-2",
            name: "Bodyweight Strength",
            duration: "35 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Air Squat", sets: 4, reps: "20", desc: "Leg volume" },
              { name: "Push Up", sets: 4, reps: "15", desc: "Chest and triceps" },
              { name: "Reverse Lunge", sets: 3, reps: "12 each", desc: "Unilateral legs" },
              { name: "Pike Push Up", sets: 3, reps: "12", desc: "Shoulders" },
              { name: "Glute Bridge", sets: 3, reps: "20", desc: "Glutes" },
              { name: "Plank", sets: 3, reps: "60 sec", desc: "Core endurance" }
            ]
          },
          {
            id: "bw-fullbody-3",
            name: "Athletic Bodyweight",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "Burpee", sets: 4, reps: "15", desc: "Power and cardio" },
              { name: "Jumping Split Squat", sets: 3, reps: "12 each", desc: "Explosive legs" },
              { name: "Push Up to T-rotation", sets: 3, reps: "12", desc: "Upper body power" },
              { name: "Jump Squat to Reverse Lunge", sets: 3, reps: "10", desc: "Leg combo" },
              { name: "Plank Alternating Arm & Leg Lift", sets: 3, reps: "15 each", desc: "Core stability" }
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
            name: "Core Foundation",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["None"],
            exercises: [
              { name: "Plank", sets: 3, reps: "45 sec", desc: "Isometric hold" },
              { name: "Crunch", sets: 3, reps: "20", desc: "Upper abs" },
              { name: "Bicycle Crunch", sets: 3, reps: "30 total", desc: "Obliques" },
              { name: "Dead Bug", sets: 3, reps: "12 each", desc: "Core stability" },
              { name: "Side Plank", sets: 2, reps: "30 sec each", desc: "Oblique strength" }
            ]
          },
          {
            id: "bw-core-2",
            name: "Core Sculptor",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Plank Shoulder Tap", sets: 4, reps: "20 total", desc: "Dynamic plank" },
              { name: "Bicycle Crunch", sets: 4, reps: "40 total", desc: "Oblique work" },
              { name: "Lying Straight Leg Raise", sets: 3, reps: "15", desc: "Lower abs" },
              { name: "Plank Hip Twist", sets: 3, reps: "20 total", desc: "Obliques" },
              { name: "Side Plank", sets: 3, reps: "45 sec each", desc: "Oblique endurance" }
            ]
          },
          {
            id: "bw-core-3",
            name: "Advanced Core",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "Plank Alternating Arm & Leg Lift", sets: 4, reps: "15 each", desc: "Anti-rotation" },
              { name: "Hollow Body Hold", sets: 3, reps: "45 sec", desc: "Core compression" },
              { name: "V-Up", sets: 3, reps: "15", desc: "Total core" },
              { name: "Plank Hip Twist", sets: 3, reps: "30 total", desc: "Oblique power" },
              { name: "Lying Straight Leg Raise", sets: 3, reps: "20", desc: "Lower ab strength" },
              { name: "Side Plank with Leg Lift", sets: 3, reps: "12 each", desc: "Oblique finisher" }
            ]
          }
        ]
      }
    }
  },

  // ====================
  // YOGA
  // ====================
  "yoga": {
    name: "Yoga",
    icon: "🧘",
    description: "Mind-body connection and flexibility",
    subcategories: {

      "flow": {
        name: "Yoga Flow",
        description: "Dynamic flowing sequences",
        workouts: [
          {
            id: "yoga-flow-1",
            name: "Morning Flow",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Child's Pose", sets: 1, reps: "2 min", desc: "Center and breathe" },
              { name: "Yoga - Cat Cow", sets: 2, reps: "1 min", desc: "Spinal warmup" },
              { name: "Yoga - Downward Dog", sets: 3, reps: "1 min", desc: "Full body stretch" },
              { name: "Yoga - Warrior I", sets: 2, reps: "45 sec each", desc: "Strength and balance" },
              { name: "Yoga - Warrior II", sets: 2, reps: "45 sec each", desc: "Hip opening" },
              { name: "Yoga - Triangle Pose", sets: 2, reps: "45 sec each", desc: "Side body stretch" },
              { name: "Yoga - Seated Forward Fold", sets: 1, reps: "2 min", desc: "Hamstring release" }
            ]
          },
          {
            id: "yoga-flow-2",
            name: "Vinyasa Flow",
            duration: "40 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Sun Salutation A", sets: 3, reps: "5 breaths each", desc: "Flow warmup" },
              { name: "Yoga - Warrior I", sets: 2, reps: "1 min each", desc: "Build heat" },
              { name: "Yoga - Warrior II", sets: 2, reps: "1 min each", desc: "Hip strength" },
              { name: "Yoga - Extended Side Angle", sets: 2, reps: "45 sec each", desc: "Side body work" },
              { name: "Yoga - Half Moon Pose", sets: 2, reps: "30 sec each", desc: "Balance challenge" },
              { name: "Yoga - Pigeon Pose", sets: 1, reps: "2 min each", desc: "Hip release" },
              { name: "Yoga - Seated Spinal Twist", sets: 1, reps: "1 min each", desc: "Detox twist" },
              { name: "Yoga - Savasana", sets: 1, reps: "5 min", desc: "Final relaxation" }
            ]
          },
          {
            id: "yoga-flow-3",
            name: "Power Flow",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Sun Salutation B", sets: 5, reps: "5 breaths each", desc: "Dynamic warmup" },
              { name: "Yoga - Warrior III", sets: 3, reps: "45 sec each", desc: "Balance and strength" },
              { name: "Yoga - Side Plank", sets: 2, reps: "1 min each", desc: "Core power" },
              { name: "Yoga - Crow Pose", sets: 3, reps: "30 sec", desc: "Arm balance" },
              { name: "Yoga - Wheel Pose", sets: 2, reps: "45 sec", desc: "Backbend" },
              { name: "Yoga - Shoulder Stand", sets: 1, reps: "2 min", desc: "Inversion" },
              { name: "Yoga - Fish Pose", sets: 1, reps: "1 min", desc: "Counter pose" },
              { name: "Yoga - Savasana", sets: 1, reps: "5 min", desc: "Integration" }
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
            name: "Gentle Restore",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["Mat", "Blocks", "Bolster"],
            exercises: [
              { name: "Yoga - Child's Pose", sets: 1, reps: "3 min", desc: "Ground and center" },
              { name: "Yoga - Supported Bridge", sets: 1, reps: "5 min", desc: "Passive backbend" },
              { name: "Yoga - Supine Twist", sets: 1, reps: "3 min each", desc: "Spinal release" },
              { name: "Yoga - Legs Up the Wall", sets: 1, reps: "5 min", desc: "Gentle inversion" },
              { name: "Yoga - Reclined Butterfly", sets: 1, reps: "5 min", desc: "Hip opening" },
              { name: "Yoga - Savasana", sets: 1, reps: "10 min", desc: "Deep rest" }
            ]
          },
          {
            id: "yoga-rest-2",
            name: "Yin Yoga",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Mat", "Blocks"],
            exercises: [
              { name: "Yoga - Butterfly Pose", sets: 1, reps: "5 min", desc: "Hip opening" },
              { name: "Yoga - Dragon Pose", sets: 1, reps: "4 min each", desc: "Hip flexor release" },
              { name: "Yoga - Caterpillar Pose", sets: 1, reps: "5 min", desc: "Spine and hamstrings" },
              { name: "Yoga - Sphinx Pose", sets: 1, reps: "4 min", desc: "Gentle backbend" },
              { name: "Yoga - Sleeping Swan", sets: 1, reps: "4 min each", desc: "Deep hip work" },
              { name: "Yoga - Supine Twist", sets: 1, reps: "3 min each", desc: "Spinal mobility" },
              { name: "Yoga - Savasana", sets: 1, reps: "10 min", desc: "Integration" }
            ]
          },
          {
            id: "yoga-rest-3",
            name: "Evening Wind Down",
            duration: "25 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Seated Forward Fold", sets: 1, reps: "3 min", desc: "Calming fold" },
              { name: "Yoga - Supine Twist", sets: 1, reps: "2 min each", desc: "Release tension" },
              { name: "Yoga - Happy Baby", sets: 1, reps: "3 min", desc: "Hip release" },
              { name: "Yoga - Legs Up the Wall", sets: 1, reps: "5 min", desc: "Restore circulation" },
              { name: "Yoga - Savasana", sets: 1, reps: "10 min", desc: "Prepare for sleep" }
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
            name: "Hip Mobility",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Cat Cow", sets: 2, reps: "1 min", desc: "Pelvic mobility" },
              { name: "Yoga - Low Lunge", sets: 2, reps: "1 min each", desc: "Hip flexor stretch" },
              { name: "Yoga - Lizard Pose", sets: 2, reps: "1 min each", desc: "Deep hip opener" },
              { name: "Yoga - Pigeon Pose", sets: 1, reps: "2 min each", desc: "External rotation" },
              { name: "Yoga - Fire Log Pose", sets: 1, reps: "2 min each", desc: "Hip stacking" },
              { name: "Yoga - Reclined Butterfly", sets: 1, reps: "3 min", desc: "Passive opening" }
            ]
          },
          {
            id: "yoga-mob-2",
            name: "Spine Mobility",
            duration: "25 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Cat Cow", sets: 3, reps: "1 min", desc: "Spinal flexion/extension" },
              { name: "Yoga - Thread the Needle", sets: 2, reps: "1 min each", desc: "Thoracic rotation" },
              { name: "Yoga - Sphinx Pose", sets: 2, reps: "1 min", desc: "Gentle backbend" },
              { name: "Yoga - Cobra Pose", sets: 2, reps: "45 sec", desc: "Active backbend" },
              { name: "Yoga - Child's Pose", sets: 2, reps: "1 min", desc: "Counter pose" },
              { name: "Yoga - Supine Twist", sets: 1, reps: "2 min each", desc: "Spinal rotation" }
            ]
          },
          {
            id: "yoga-mob-3",
            name: "Full Body Flow",
            duration: "35 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Sun Salutation A", sets: 3, reps: "5 breaths", desc: "Dynamic warmup" },
              { name: "Yoga - Low Lunge with Twist", sets: 2, reps: "45 sec each", desc: "Hip and spine" },
              { name: "Yoga - Pyramid Pose", sets: 2, reps: "1 min each", desc: "Hamstring length" },
              { name: "Yoga - Triangle Pose", sets: 2, reps: "1 min each", desc: "Side body mobility" },
              { name: "Yoga - Camel Pose", sets: 2, reps: "45 sec", desc: "Backbend" },
              { name: "Yoga - Seated Forward Fold", sets: 1, reps: "3 min", desc: "Cool down" }
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
            name: "Full Body Stretch",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Neck Stretch", sets: 2, reps: "30 sec each direction", desc: "Release neck tension" },
              { name: "Shoulder Stretch", sets: 2, reps: "30 sec each", desc: "Open shoulders" },
              { name: "Chest Stretch", sets: 2, reps: "45 sec", desc: "Counter desk posture" },
              { name: "Seated Forward Fold", sets: 1, reps: "2 min", desc: "Hamstrings and back" },
              { name: "Figure Four Stretch", sets: 1, reps: "1 min each", desc: "Hip and glute" },
              { name: "Quad Stretch", sets: 2, reps: "45 sec each", desc: "Front of thigh" },
              { name: "Calf Stretch", sets: 2, reps: "45 sec each", desc: "Lower leg" }
            ]
          },
          {
            id: "recovery-stretch-2",
            name: "Lower Body Stretch",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Standing Quad Stretch", sets: 2, reps: "1 min each", desc: "Front thigh" },
              { name: "Standing Hamstring Stretch", sets: 2, reps: "1 min each", desc: "Back thigh" },
              { name: "Calf Stretch", sets: 2, reps: "1 min each", desc: "Lower leg" },
              { name: "Figure Four Stretch", sets: 2, reps: "1 min each", desc: "Glute and hip" },
              { name: "Butterfly Stretch", sets: 1, reps: "2 min", desc: "Inner thigh" },
              { name: "Pigeon Pose", sets: 1, reps: "2 min each", desc: "Deep hip opener" },
              { name: "Lying Hamstring Stretch", sets: 1, reps: "1 min each", desc: "Hamstring release" }
            ]
          },
          {
            id: "recovery-stretch-3",
            name: "Upper Body Stretch",
            duration: "15 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Neck Rolls", sets: 2, reps: "1 min", desc: "Release neck" },
              { name: "Shoulder Rolls", sets: 2, reps: "30 sec each direction", desc: "Loosen shoulders" },
              { name: "Cross Body Shoulder Stretch", sets: 2, reps: "45 sec each", desc: "Rear delt" },
              { name: "Chest Doorway Stretch", sets: 2, reps: "1 min", desc: "Open chest" },
              { name: "Tricep Stretch", sets: 2, reps: "45 sec each", desc: "Back of arm" },
              { name: "Wrist Stretch", sets: 2, reps: "30 sec each", desc: "Forearm and wrist" },
              { name: "Cat Cow", sets: 2, reps: "1 min", desc: "Spinal mobility" }
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
            name: "Full Body Foam Roll",
            duration: "25 min",
            difficulty: "Beginner",
            equipment: ["Foam Roller"],
            exercises: [
              { name: "Foam Roller Calf", sets: 2, reps: "1 min each", desc: "Release calves" },
              { name: "Foam Roller Hamstring", sets: 2, reps: "1 min each", desc: "Hamstring release" },
              { name: "Foam Roller Quad", sets: 2, reps: "1 min each", desc: "Quad release" },
              { name: "Foam Roller IT Band", sets: 2, reps: "1 min each", desc: "IT band work" },
              { name: "Foam Roller Side Glute", sets: 2, reps: "1 min each", desc: "Glute release" },
              { name: "Foam Roller Upper Back", sets: 2, reps: "2 min", desc: "T-spine mobility" },
              { name: "Foam Roller Lat", sets: 2, reps: "1 min each", desc: "Lat release" }
            ]
          },
          {
            id: "recovery-foam-2",
            name: "Lower Body Foam Roll",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["Foam Roller"],
            exercises: [
              { name: "Foam Roller Calf Smash", sets: 2, reps: "1 min each", desc: "Deep calf work" },
              { name: "Foam Roller Hamstring", sets: 2, reps: "1 min each", desc: "Hamstring release" },
              { name: "Foam Roller Quad", sets: 2, reps: "1 min each", desc: "Quad mobility" },
              { name: "Foam Roller Adductor", sets: 2, reps: "1 min each", desc: "Inner thigh" },
              { name: "Foam Roller Side Glute", sets: 2, reps: "1 min each", desc: "Glute med/min" },
              { name: "Foam Roller IT Band", sets: 2, reps: "1 min each", desc: "IT band release" }
            ]
          },
          {
            id: "recovery-foam-3",
            name: "Upper Body Foam Roll",
            duration: "15 min",
            difficulty: "Beginner",
            equipment: ["Foam Roller"],
            exercises: [
              { name: "Foam Roller T-Spine", sets: 3, reps: "2 min", desc: "Thoracic extension" },
              { name: "Foam Roller Lat", sets: 2, reps: "1 min each", desc: "Lat release" },
              { name: "Foam Roller Upper Back", sets: 2, reps: "2 min", desc: "Upper back" },
              { name: "Foam Roller Chest", sets: 2, reps: "1 min each", desc: "Pec release" },
              { name: "Foam Roller 9090 Thoracic Opener", sets: 2, reps: "1 min each", desc: "T-spine rotation" }
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
            name: "Gentle Movement",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Walking", sets: 1, reps: "10 min", desc: "Light cardio" },
              { name: "Cat Cow", sets: 3, reps: "1 min", desc: "Spinal mobility" },
              { name: "Child's Pose", sets: 2, reps: "2 min", desc: "Rest and stretch" },
              { name: "Downward Dog", sets: 3, reps: "1 min", desc: "Full body stretch" },
              { name: "Gentle Twist", sets: 2, reps: "1 min each", desc: "Spinal rotation" },
              { name: "Hip Circles", sets: 2, reps: "1 min each direction", desc: "Hip mobility" },
              { name: "Arm Circles", sets: 2, reps: "1 min", desc: "Shoulder mobility" }
            ]
          },
          {
            id: "recovery-active-2",
            name: "Mobility Flow",
            duration: "25 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "World's Greatest Stretch", sets: 3, reps: "5 each side", desc: "Full body opener" },
              { name: "Hip Circles", sets: 2, reps: "10 each direction", desc: "Hip mobility" },
              { name: "Arm Circles", sets: 2, reps: "15 each direction", desc: "Shoulder health" },
              { name: "Cat Cow", sets: 3, reps: "1 min", desc: "Spinal flow" },
              { name: "Thread the Needle", sets: 2, reps: "1 min each", desc: "Thoracic rotation" },
              { name: "90/90 Hip Switch", sets: 2, reps: "10 switches", desc: "Hip internal/external rotation" },
              { name: "Gentle Backbend", sets: 2, reps: "30 sec", desc: "Chest opening" }
            ]
          },
          {
            id: "recovery-active-3",
            name: "Yoga Recovery",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Sun Salutation A", sets: 3, reps: "3 rounds", desc: "Gentle flow" },
              { name: "Yoga - Child's Pose", sets: 2, reps: "2 min", desc: "Rest" },
              { name: "Yoga - Pigeon Pose", sets: 1, reps: "2 min each", desc: "Hip release" },
              { name: "Yoga - Supine Twist", sets: 1, reps: "2 min each", desc: "Spinal release" },
              { name: "Yoga - Happy Baby", sets: 1, reps: "2 min", desc: "Hip opener" },
              { name: "Yoga - Legs Up the Wall", sets: 1, reps: "5 min", desc: "Restore" },
              { name: "Yoga - Savasana", sets: 1, reps: "5 min", desc: "Deep rest" }
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
