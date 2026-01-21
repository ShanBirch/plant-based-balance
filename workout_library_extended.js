// Extended Workout Library - Yoga, Bodyweight, and Home/Dumbbells
// Organized by: Category > Subcategory > Individual Workouts
// Follows same structure as WORKOUT_LIBRARY for gym workouts

const WORKOUT_LIBRARY_EXTENDED = {
  // ====================
  // YOGA WORKOUTS
  // ====================
  "yoga": {
    name: "Yoga & Mindful Movement",
    icon: "🧘",
    description: "Comprehensive yoga library for all levels and styles",
    subcategories: {

      // RESTORATIVE YOGA
      "restorative": {
        name: "Restorative Yoga",
        description: "Gentle, healing practices for stress relief and recovery",
        workouts: [
          {
            id: "yoga-restorative-1",
            name: "Deep Rest & Release",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["Mat", "Optional: Blocks, Bolster"],
            exercises: [
              { name: "Supported Child's Pose", sets: 1, reps: "5 min", desc: "Grounding and surrender" },
              { name: "Yoga - Reclined Bound Angle (Supta Baddha Konasana)", sets: 1, reps: "5 min", desc: "Hip opening and relaxation" },
              { name: "Yoga - Legs Up the Wall (Viparita Karani)", sets: 1, reps: "7 min", desc: "Lymphatic drainage and calm" },
              { name: "Yoga - Supported Fish Pose (Matsyasana)", sets: 1, reps: "4 min", desc: "Heart opener" },
              { name: "Corpse Pose", sets: 1, reps: "9 min", desc: "Complete integration" }
            ]
          },
          {
            id: "yoga-restorative-2",
            name: "Nervous System Reset",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["Mat", "Optional: Blanket"],
            exercises: [
              { name: "Yoga - Puppy Pose (Anahatasana)", sets: 1, reps: "4 min", desc: "Heart opening" },
              { name: "Yoga - Supported Forward Fold", sets: 1, reps: "5 min", desc: "Calming the mind" },
              { name: "Yoga - Reclined Twist", sets: 2, reps: "4 min/side", desc: "Spinal release" },
              { name: "Yoga - Legs Up the Wall (Viparita Karani)", sets: 1, reps: "8 min", desc: "Restorative inversion" },
              { name: "Corpse Pose", sets: 1, reps: "7 min", desc: "Deep relaxation" }
            ]
          },
          {
            id: "yoga-restorative-3",
            name: "Psoas & Hip Release",
            duration: "25 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Adductor Stretch with Thoracic Twist", sets: 1, reps: "4 min", desc: "Pelvic floor release" },
              { name: "Yoga - Lizard Pose (Utthan Pristhasana)", sets: 2, reps: "3 min/side", desc: "Psoas release" },
              { name: "Yoga - Happy Baby Pose (Ananda Balasana)", sets: 1, reps: "4 min", desc: "Hip socket opening" },
              { name: "Yoga - Supine Twist (Jathara Parivartanasana)", sets: 2, reps: "2 min/side", desc: "Spinal decompression" },
              { name: "Corpse Pose", sets: 1, reps: "8 min", desc: "Integration" }
            ]
          },
          {
            id: "yoga-restorative-4",
            name: "Cortisol Lowering Flow",
            duration: "28 min",
            difficulty: "Beginner",
            equipment: ["Mat", "Optional: Bolster"],
            exercises: [
              { name: "Cat to Cow", sets: 1, reps: "3 min", desc: "Nervous system regulation" },
              { name: "Yoga - Supported Bridge Pose", sets: 1, reps: "5 min", desc: "Passive back bend" },
              { name: "Yoga - Reclined Bound Angle (Supta Baddha Konasana)", sets: 1, reps: "6 min", desc: "Pelvic relaxation" },
              { name: "Yoga - Legs Up the Wall (Viparita Karani)", sets: 1, reps: "7 min", desc: "Calming inversion" },
              { name: "Corpse Pose", sets: 1, reps: "7 min", desc: "Cortisol reduction" }
            ]
          },
          {
            id: "yoga-restorative-5",
            name: "Evening Wind Down",
            duration: "25 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Child's Pose", sets: 1, reps: "4 min", desc: "Gentle compression" },
              { name: "Yoga - Seated Forward Fold (Paschimottanasana)", sets: 1, reps: "5 min", desc: "Hamstring release" },
              { name: "Yoga - Reclined Twist", sets: 2, reps: "3 min/side", desc: "Spinal detox" },
              { name: "Yoga - Legs Up the Wall (Viparita Karani)", sets: 1, reps: "6 min", desc: "Preparation for sleep" },
              { name: "Corpse Pose", sets: 1, reps: "7 min", desc: "Complete rest" }
            ]
          },
          {
            id: "yoga-restorative-6",
            name: "Gentle Morning Wake",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Cat to Cow", sets: 1, reps: "2 min", desc: "Wake up the spine" },
              { name: "Child's Pose", sets: 1, reps: "3 min", desc: "Gentle opening" },
              { name: "Yoga - Supported Fish Pose (Matsyasana)", sets: 1, reps: "3 min", desc: "Chest opener" },
              { name: "Yoga - Supine Twist (Jathara Parivartanasana)", sets: 2, reps: "2 min/side", desc: "Wake up digestion" },
              { name: "Yoga - Legs Up the Wall (Viparita Karani)", sets: 1, reps: "5 min", desc: "Gentle energy" },
              { name: "Corpse Pose", sets: 1, reps: "5 min", desc: "Set intentions" }
            ]
          },
          {
            id: "yoga-restorative-7",
            name: "Stress Relief Sanctuary",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["Mat", "Optional: Eye pillow"],
            exercises: [
              { name: "Yoga - Supported Child's Pose", sets: 1, reps: "5 min", desc: "Surrender stress" },
              { name: "Yoga - Reclined Bound Angle (Supta Baddha Konasana)", sets: 1, reps: "6 min", desc: "Open and release" },
              { name: "Yoga - Supported Forward Fold", sets: 1, reps: "5 min", desc: "Introspection" },
              { name: "Yoga - Legs Up the Wall (Viparita Karani)", sets: 1, reps: "7 min", desc: "Calm activation" },
              { name: "Corpse Pose with body scan", sets: 1, reps: "7 min", desc: "Mind-body awareness" }
            ]
          },
          {
            id: "yoga-restorative-8",
            name: "Hormonal Balance Flow",
            duration: "28 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Adductor Stretch with Thoracic Twist", sets: 1, reps: "4 min", desc: "Pelvic floor safety signal" },
              { name: "Yoga - Happy Baby Pose (Ananda Balasana)", sets: 1, reps: "4 min", desc: "Somatic reset" },
              { name: "Yoga - Supported Bridge Pose", sets: 1, reps: "5 min", desc: "Thyroid stimulation" },
              { name: "Yoga - Supine Twist (Jathara Parivartanasana)", sets: 2, reps: "2 min/side", desc: "Adrenal release" },
              { name: "Yoga - Legs Up the Wall (Viparita Karani)", sets: 1, reps: "6 min", desc: "Endocrine reset" },
              { name: "Corpse Pose", sets: 1, reps: "7 min", desc: "Hormonal integration" }
            ]
          },
          {
            id: "yoga-restorative-9",
            name: "Lower Back Relief",
            duration: "25 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Cat to Cow", sets: 1, reps: "3 min", desc: "Spinal mobilization" },
              { name: "Yoga - Knees to Chest", sets: 1, reps: "3 min", desc: "Lower back release" },
              { name: "Yoga - Supine Twist (Jathara Parivartanasana)", sets: 2, reps: "3 min/side", desc: "Spinal decompression" },
              { name: "Yoga - Happy Baby Pose (Ananda Balasana)", sets: 1, reps: "4 min", desc: "Sacrum release" },
              { name: "Yoga - Legs Up the Wall (Viparita Karani)", sets: 1, reps: "6 min", desc: "Reverse gravity compression" },
              { name: "Corpse Pose", sets: 1, reps: "6 min", desc: "Back relaxation" }
            ]
          },
          {
            id: "yoga-restorative-10",
            name: "Deep Hip Opening",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["Mat", "Optional: Blocks"],
            exercises: [
              { name: "Child's Pose", sets: 1, reps: "3 min", desc: "Grounding" },
              { name: "Yoga - Pigeon Pose (Eka Pada Rajakapotasana)", sets: 2, reps: "5 min/side", desc: "Deep hip release" },
              { name: "Yoga - Reclined Bound Angle (Supta Baddha Konasana)", sets: 1, reps: "6 min", desc: "Inner thigh opening" },
              { name: "Yoga - Happy Baby Pose (Ananda Balasana)", sets: 1, reps: "4 min", desc: "Hip socket release" },
              { name: "Yoga - Legs Up the Wall (Viparita Karani)", sets: 1, reps: "6 min", desc: "Gentle inversion" },
              { name: "Corpse Pose", sets: 1, reps: "6 min", desc: "Integration" }
            ]
          }
        ]
      },

      // POWER VINYASA
      "power": {
        name: "Power Vinyasa",
        description: "Dynamic, strength-building flows",
        workouts: [
          {
            id: "yoga-power-1",
            name: "Full Body Power Flow",
            duration: "40 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Sun Salutation A (Surya Namaskar A)", sets: 5, reps: "1 round", desc: "Build heat" },
              { name: "Yoga - Sun Salutation B (Surya Namaskar B)", sets: 5, reps: "1 round", desc: "Full body activation" },
              { name: "Yoga - Warrior I (Virabhadrasana I)", sets: 2, reps: "5 breaths/side", desc: "Lower body strength" },
              { name: "Yoga - Warrior II (Virabhadrasana II)", sets: 2, reps: "5 breaths/side", desc: "Hip opening strength" },
              { name: "Yoga - Extended Side Angle (Utthita Parsvakonasana)", sets: 2, reps: "5 breaths/side", desc: "Side body power" },
              { name: "Yoga - Chair Pose (Utkatasana)", sets: 3, reps: "5 breaths", desc: "Quad burn" },
              { name: "Plank to Chaturanga Flow", sets: 5, reps: "1 min", desc: "Upper body endurance" },
              { name: "Corpse Pose", sets: 1, reps: "5 min", desc: "Recovery" }
            ]
          },
          {
            id: "yoga-power-2",
            name: "Core Power Integration",
            duration: "35 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Sun Salutation A (Surya Namaskar A)", sets: 3, reps: "1 round", desc: "Warm-up" },
              { name: "Yoga - Boat Pose (Navasana)", sets: 4, reps: "45 sec", desc: "Core activation" },
              { name: "Yoga - Side Plank (Vasisthasana)", sets: 2, reps: "30 sec/side", desc: "Oblique strength" },
              { name: "Yoga - Crow Pose (Bakasana)", sets: 3, reps: "30 sec", desc: "Arm balance" },
              { name: "Plank to Down Dog", sets: 10, reps: "1 rep", desc: "Dynamic core" },
              { name: "Yoga - Reverse Plank", sets: 3, reps: "30 sec", desc: "Posterior chain" },
              { name: "Corpse Pose", sets: 1, reps: "7 min", desc: "Integration" }
            ]
          },
          {
            id: "yoga-power-3",
            name: "Warrior Sequence",
            duration: "38 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Sun Salutation B (Surya Namaskar B)", sets: 5, reps: "1 round", desc: "Build heat" },
              { name: "Yoga - Warrior I (Virabhadrasana I)", sets: 3, reps: "5 breaths/side", desc: "Foundation" },
              { name: "Yoga - Warrior II (Virabhadrasana II)", sets: 3, reps: "5 breaths/side", desc: "Hip strength" },
              { name: "Yoga - Warrior III (Virabhadrasana III)", sets: 3, reps: "5 breaths/side", desc: "Balance and power" },
              { name: "Yoga - Humble Warrior", sets: 2, reps: "5 breaths/side", desc: "Hip and shoulder opening" },
              { name: "Yoga - Goddess Squat", sets: 3, reps: "10 breaths", desc: "Lower body burn" },
              { name: "Corpse Pose", sets: 1, reps: "5 min", desc: "Rest" }
            ]
          },
          {
            id: "yoga-power-4",
            name: "Arm Balance Focus",
            duration: "35 min",
            difficulty: "Advanced",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Sun Salutation A (Surya Namaskar A)", sets: 4, reps: "1 round", desc: "Warm shoulders" },
              { name: "Plank to Chaturanga", sets: 5, reps: "10 reps", desc: "Build strength" },
              { name: "Yoga - Crow Pose (Bakasana)", sets: 4, reps: "hold max time", desc: "Arm balance practice" },
              { name: "Yoga - Side Crow (Parsva Bakasana)", sets: 3, reps: "hold/side", desc: "Advanced balance" },
              { name: "Yoga - Flying Pigeon Pose", sets: 2, reps: "hold/side", desc: "Hip flexibility balance" },
              { name: "Yoga - L-Sit", sets: 3, reps: "20 sec", desc: "Core compression" },
              { name: "Corpse Pose", sets: 1, reps: "8 min", desc: "Deep recovery" }
            ]
          },
          {
            id: "yoga-power-5",
            name: "Sweaty Vinyasa",
            duration: "45 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Towel"],
            exercises: [
              { name: "Yoga - Sun Salutation A (Surya Namaskar A)", sets: 10, reps: "1 round", desc: "Build serious heat" },
              { name: "Yoga - Chair Pose (Utkatasana)", sets: 4, reps: "10 breaths", desc: "Leg burn" },
              { name: "Yoga - Crescent Lunge with twist", sets: 2, reps: "5 breaths/side", desc: "Core twist" },
              { name: "Yoga - Standing Figure 4", sets: 2, reps: "5 breaths/side", desc: "Hip strength" },
              { name: "Yoga - Boat Pose (Navasana)", sets: 4, reps: "1 min", desc: "Core endurance" },
              { name: "Plank Hold", sets: 3, reps: "1 min", desc: "Full body endurance" },
              { name: "Corpse Pose", sets: 1, reps: "7 min", desc: "Cool down" }
            ]
          },
          {
            id: "yoga-power-6",
            name: "Hip Opening Power",
            duration: "40 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Sun Salutation B (Surya Namaskar B)", sets: 5, reps: "1 round", desc: "Warm up" },
              { name: "Yoga - Lizard Pose (Utthan Pristhasana)", sets: 2, reps: "10 breaths/side", desc: "Deep lunge" },
              { name: "Yoga - Pigeon Pose (Eka Pada Rajakapotasana)", sets: 2, reps: "10 breaths/side", desc: "Hip opening" },
              { name: "Yoga - Half Moon Pose (Ardha Chandrasana)", sets: 2, reps: "5 breaths/side", desc: "Balance" },
              { name: "Yoga - Warrior II (Virabhadrasana II) to Reverse Warrior flow", sets: 3, reps: "5 rounds/side", desc: "Hip flexibility" },
              { name: "Yoga - Goddess Squat", sets: 4, reps: "10 breaths", desc: "Hip strength" },
              { name: "Corpse Pose", sets: 1, reps: "5 min", desc: "Integration" }
            ]
          },
          {
            id: "yoga-power-7",
            name: "Backbend Journey",
            duration: "40 min",
            difficulty: "Advanced",
            equipment: ["Mat", "Optional: Blocks"],
            exercises: [
              { name: "Cat to Cow", sets: 1, reps: "3 min", desc: "Spinal warm-up" },
              { name: "Yoga - Sun Salutation B (Surya Namaskar B)", sets: 5, reps: "1 round", desc: "Build heat" },
              { name: "Yoga - Cobra Pose (Bhujangasana)", sets: 4, reps: "5 breaths", desc: "Gentle backbend" },
              { name: "Yoga - Upward Facing Dog (Urdhva Mukha Svanasana)", sets: 4, reps: "5 breaths", desc: "Deeper backbend" },
              { name: "Yoga - Camel Pose (Ustrasana)", sets: 3, reps: "5 breaths", desc: "Heart opening" },
              { name: "Yoga - Wheel Pose (Urdhva Dhanurasana)", sets: 3, reps: "5 breaths", desc: "Full backbend" },
              { name: "Child's Pose", sets: 1, reps: "3 min", desc: "Spinal neutralization" },
              { name: "Corpse Pose", sets: 1, reps: "7 min", desc: "Integration" }
            ]
          },
          {
            id: "yoga-power-8",
            name: "Balance & Focus",
            duration: "35 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Sun Salutation A (Surya Namaskar A)", sets: 3, reps: "1 round", desc: "Centering" },
              { name: "Yoga - Tree Pose (Vrksasana)", sets: 2, reps: "1 min/side", desc: "Standing balance" },
              { name: "Yoga - Eagle Pose (Garudasana)", sets: 2, reps: "1 min/side", desc: "Wrapped balance" },
              { name: "Yoga - Warrior III (Virabhadrasana III)", sets: 3, reps: "45 sec/side", desc: "Flying balance" },
              { name: "Yoga - Half Moon Pose (Ardha Chandrasana)", sets: 2, reps: "45 sec/side", desc: "Side body balance" },
              { name: "Yoga - Crow Pose (Bakasana)", sets: 3, reps: "hold max", desc: "Arm balance" },
              { name: "Corpse Pose", sets: 1, reps: "7 min", desc: "Stillness integration" }
            ]
          },
          {
            id: "yoga-power-9",
            name: "Lower Body Strength",
            duration: "40 min",
            difficulty: "Intermediate",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Sun Salutation B (Surya Namaskar B)", sets: 5, reps: "1 round", desc: "Lower body warm-up" },
              { name: "Yoga - Chair Pose (Utkatasana)", sets: 5, reps: "10 breaths", desc: "Quad strength" },
              { name: "Yoga - Warrior II (Virabhadrasana II)", sets: 3, reps: "10 breaths/side", desc: "Hip endurance" },
              { name: "Yoga - Goddess Squat", sets: 4, reps: "15 breaths", desc: "Wide squat hold" },
              { name: "Yoga - High Lunge pulses", sets: 3, reps: "20 pulses/side", desc: "Lunge strength" },
              { name: "Yoga - Standing Figure 4", sets: 3, reps: "10 breaths/side", desc: "Single leg endurance" },
              { name: "Corpse Pose", sets: 1, reps: "5 min", desc: "Leg recovery" }
            ]
          },
          {
            id: "yoga-power-10",
            name: "Upper Body Burn",
            duration: "35 min",
            difficulty: "Advanced",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Sun Salutation A (Surya Namaskar A)", sets: 5, reps: "1 round", desc: "Shoulder warm-up" },
              { name: "Plank to Chaturanga", sets: 10, reps: "10 reps", desc: "Push-up variation" },
              { name: "Yoga - Dolphin Pose", sets: 4, reps: "1 min", desc: "Shoulder strength" },
              { name: "Yoga - Forearm Plank", sets: 4, reps: "1 min", desc: "Core and shoulders" },
              { name: "Yoga - Crow Pose (Bakasana)", sets: 4, reps: "max hold", desc: "Arm strength" },
              { name: "Yoga - Side Plank (Vasisthasana)", sets: 3, reps: "45 sec/side", desc: "Shoulder stability" },
              { name: "Downward Dog", sets: 1, reps: "3 min", desc: "Active recovery" },
              { name: "Corpse Pose", sets: 1, reps: "7 min", desc: "Upper body rest" }
            ]
          }
        ]
      },

      // YIN YOGA
      "yin": {
        name: "Yin Yoga",
        description: "Long-hold passive stretches for fascia release",
        workouts: [
          {
            id: "yoga-yin-1",
            name: "Deep Fascia Release",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Mat", "Optional: Blocks, Bolster"],
            exercises: [
              { name: "Yoga - Butterfly Pose (Baddha Konasana)", sets: 1, reps: "5 min", desc: "Inner thigh and hips" },
              { name: "Yoga - Dragon Pose (Low Lunge)", sets: 2, reps: "5 min/side", desc: "Hip flexors" },
              { name: "Yoga - Sleeping Swan (Pigeon)", sets: 2, reps: "5 min/side", desc: "Deep hip release" },
              { name: "Yoga - Caterpillar Pose (Seated Forward Fold)", sets: 1, reps: "5 min", desc: "Hamstrings and spine" },
              { name: "Yoga - Supine Twist", sets: 2, reps: "5 min/side", desc: "Spinal fascia" },
              { name: "Corpse Pose", sets: 1, reps: "10 min", desc: "Deep integration" }
            ]
          },
          {
            id: "yoga-yin-2",
            name: "Lower Body Deep Stretch",
            duration: "50 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Butterfly Pose (Baddha Konasana)", sets: 1, reps: "6 min", desc: "Groin opening" },
              { name: "Yoga - Dragon Pose (Low Lunge)", sets: 2, reps: "6 min/side", desc: "Psoas release" },
              { name: "Yoga - Half Frog Pose", sets: 2, reps: "5 min/side", desc: "Quad stretch" },
              { name: "Yoga - Saddle Pose", sets: 1, reps: "5 min", desc: "Thigh and hip flexor" },
              { name: "Yoga - Sleeping Swan (Pigeon)", sets: 2, reps: "5 min/side", desc: "Glute and hip" },
              { name: "Corpse Pose", sets: 1, reps: "10 min", desc: "Complete release" }
            ]
          },
          {
            id: "yoga-yin-3",
            name: "Spine & Hips",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Mat", "Optional: Bolster"],
            exercises: [
              { name: "Yoga - Sphinx Pose", sets: 1, reps: "5 min", desc: "Gentle backbend" },
              { name: "Yoga - Seal Pose", sets: 1, reps: "4 min", desc: "Deeper backbend" },
              { name: "Child's Pose", sets: 1, reps: "3 min", desc: "Counter pose" },
              { name: "Yoga - Dragon Pose (Low Lunge)", sets: 2, reps: "5 min/side", desc: "Hip opening" },
              { name: "Yoga - Sleeping Swan (Pigeon)", sets: 2, reps: "5 min/side", desc: "Deep hip work" },
              { name: "Yoga - Supine Twist", sets: 2, reps: "4 min/side", desc: "Spinal release" },
              { name: "Corpse Pose", sets: 1, reps: "8 min", desc: "Integration" }
            ]
          },
          {
            id: "yoga-yin-4",
            name: "Shoulder & Upper Back Release",
            duration: "40 min",
            difficulty: "Beginner",
            equipment: ["Mat", "Optional: Strap"],
            exercises: [
              { name: "Yoga - Thread the Needle", sets: 2, reps: "5 min/side", desc: "Shoulder and upper back" },
              { name: "Yoga - Melting Heart Pose", sets: 1, reps: "5 min", desc: "Chest and shoulders" },
              { name: "Yoga - Eagle Arms in Seated Pose", sets: 2, reps: "4 min/side", desc: "Shoulder blades" },
              { name: "Yoga - Reclined Twist", sets: 2, reps: "5 min/side", desc: "Upper back release" },
              { name: "Yoga - Supported Fish Pose", sets: 1, reps: "5 min", desc: "Chest opening" },
              { name: "Corpse Pose", sets: 1, reps: "8 min", desc: "Upper body relaxation" }
            ]
          },
          {
            id: "yoga-yin-5",
            name: "Full Body Yin",
            duration: "60 min",
            difficulty: "Beginner",
            equipment: ["Mat", "Optional: Props"],
            exercises: [
              { name: "Yoga - Butterfly Pose", sets: 1, reps: "6 min", desc: "Inner legs" },
              { name: "Yoga - Caterpillar (Seated Forward Fold)", sets: 1, reps: "6 min", desc: "Hamstrings" },
              { name: "Yoga - Dragon Pose", sets: 2, reps: "5 min/side", desc: "Hip flexors" },
              { name: "Yoga - Sleeping Swan", sets: 2, reps: "5 min/side", desc: "Hips" },
              { name: "Yoga - Sphinx to Seal", sets: 1, reps: "5 min", desc: "Spine" },
              { name: "Yoga - Supine Twist", sets: 2, reps: "5 min/side", desc: "Spinal twist" },
              { name: "Yoga - Legs Up the Wall", sets: 1, reps: "7 min", desc: "Inversion" },
              { name: "Corpse Pose", sets: 1, reps: "10 min", desc: "Complete integration" }
            ]
          },
          {
            id: "yoga-yin-6",
            name: "Hip Opening Journey",
            duration: "50 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Optional: Blocks"],
            exercises: [
              { name: "Yoga - Butterfly Pose", sets: 1, reps: "6 min", desc: "Inner hips" },
              { name: "Yoga - Dragon Pose with back knee down", sets: 2, reps: "6 min/side", desc: "Hip flexor depth" },
              { name: "Yoga - Sleeping Swan", sets: 2, reps: "6 min/side", desc: "External rotation" },
              { name: "Yoga - Saddle Pose", sets: 1, reps: "5 min", desc: "Front of hips" },
              { name: "Yoga - Square Pose (Shoelace)", sets: 2, reps: "5 min/side", desc: "Hip stacking" },
              { name: "Corpse Pose", sets: 1, reps: "10 min", desc: "Hip integration" }
            ]
          },
          {
            id: "yoga-yin-7",
            name: "Stress & Anxiety Relief",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Mat", "Optional: Eye pillow"],
            exercises: [
              { name: "Child's Pose", sets: 1, reps: "5 min", desc: "Grounding" },
              { name: "Yoga - Caterpillar (Seated Forward Fold)", sets: 1, reps: "6 min", desc: "Calming fold" },
              { name: "Yoga - Reclined Bound Angle", sets: 1, reps: "7 min", desc: "Heart opening" },
              { name: "Yoga - Banana Pose (Side Bend)", sets: 2, reps: "4 min/side", desc: "Side body stretch" },
              { name: "Yoga - Supine Twist", sets: 2, reps: "5 min/side", desc: "Release tension" },
              { name: "Yoga - Legs Up the Wall", sets: 1, reps: "7 min", desc: "Calming inversion" },
              { name: "Corpse Pose", sets: 1, reps: "8 min", desc: "Nervous system rest" }
            ]
          },
          {
            id: "yoga-yin-8",
            name: "Hamstring & Lower Back",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Mat", "Optional: Strap"],
            exercises: [
              { name: "Yoga - Caterpillar (Seated Forward Fold)", sets: 1, reps: "7 min", desc: "Hamstrings" },
              { name: "Yoga - Half Butterfly", sets: 2, reps: "5 min/side", desc: "Single leg hamstring" },
              { name: "Yoga - Sleeping Swan", sets: 2, reps: "5 min/side", desc: "Glutes and low back" },
              { name: "Yoga - Banana Pose", sets: 2, reps: "5 min/side", desc: "Side body and QL" },
              { name: "Yoga - Supine Twist", sets: 2, reps: "4 min/side", desc: "Spinal release" },
              { name: "Corpse Pose", sets: 1, reps: "8 min", desc: "Back relaxation" }
            ]
          },
          {
            id: "yoga-yin-9",
            name: "Evening Deep Stretch",
            duration: "50 min",
            difficulty: "Beginner",
            equipment: ["Mat", "Optional: Bolster, Blanket"],
            exercises: [
              { name: "Child's Pose", sets: 1, reps: "5 min", desc: "Settle in" },
              { name: "Yoga - Dragon Pose", sets: 2, reps: "6 min/side", desc: "Release day's tension" },
              { name: "Yoga - Sleeping Swan", sets: 2, reps: "6 min/side", desc: "Hip opening" },
              { name: "Yoga - Caterpillar", sets: 1, reps: "6 min", desc: "Forward fold" },
              { name: "Yoga - Reclined Bound Angle", sets: 1, reps: "6 min", desc: "Heart opening" },
              { name: "Yoga - Legs Up the Wall", sets: 1, reps: "8 min", desc: "Prepare for sleep" },
              { name: "Corpse Pose", sets: 1, reps: "10 min", desc: "Complete relaxation" }
            ]
          },
          {
            id: "yoga-yin-10",
            name: "Meridian Flush",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Butterfly Pose", sets: 1, reps: "5 min", desc: "Kidney meridian" },
              { name: "Yoga - Saddle Pose", sets: 1, reps: "5 min", desc: "Stomach and spleen meridians" },
              { name: "Yoga - Dragon Pose", sets: 2, reps: "5 min/side", desc: "Liver and gallbladder" },
              { name: "Yoga - Sleeping Swan", sets: 2, reps: "5 min/side", desc: "Kidney and bladder" },
              { name: "Yoga - Sphinx Pose", sets: 1, reps: "5 min", desc: "Urinary bladder meridian" },
              { name: "Yoga - Supine Twist", sets: 2, reps: "4 min/side", desc: "Digestive organs" },
              { name: "Corpse Pose", sets: 1, reps: "8 min", desc: "Energy integration" }
            ]
          }
        ]
      }

    }
  },

  // TO BE CONTINUED WITH BODYWEIGHT AND HOME LIBRARIES...
  // This file will be extended with bodyweight and home/dumbbell workouts in the same format

};

// Export for use in dashboard
if (typeof window !== 'undefined') {
  window.WORKOUT_LIBRARY_EXTENDED = WORKOUT_LIBRARY_EXTENDED;
}
