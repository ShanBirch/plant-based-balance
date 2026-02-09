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
              { name: "Supported Child's Pose", sets: 1, reps: "3 min", desc: "Grounding and surrender" },
              { name: "Yoga - Reclined Bound Angle (Supta Baddha Konasana)", sets: 1, reps: "3 min", desc: "Hip opening and relaxation" },
              { name: "Yoga - Legs Up the Wall (Viparita Karani)", sets: 1, reps: "3 min", desc: "Lymphatic drainage and calm" },
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
              { name: "Yoga - Supported Forward Fold", sets: 1, reps: "3 min", desc: "Calming the mind" },
              { name: "Yoga - Reclined Twist", sets: 2, reps: "4 min/side", desc: "Spinal release" },
              { name: "Yoga - Legs Up the Wall (Viparita Karani)", sets: 1, reps: "3 min", desc: "Restorative inversion" },
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
              { name: "Yoga - Supported Bridge Pose", sets: 1, reps: "3 min", desc: "Passive back bend" },
              { name: "Yoga - Reclined Bound Angle (Supta Baddha Konasana)", sets: 1, reps: "3 min", desc: "Pelvic relaxation" },
              { name: "Yoga - Legs Up the Wall (Viparita Karani)", sets: 1, reps: "3 min", desc: "Calming inversion" },
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
              { name: "Yoga - Seated Forward Fold (Paschimottanasana)", sets: 1, reps: "3 min", desc: "Hamstring release" },
              { name: "Yoga - Reclined Twist", sets: 2, reps: "3 min/side", desc: "Spinal detox" },
              { name: "Yoga - Legs Up the Wall (Viparita Karani)", sets: 1, reps: "3 min", desc: "Preparation for sleep" },
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
              { name: "Yoga - Legs Up the Wall (Viparita Karani)", sets: 1, reps: "3 min", desc: "Gentle energy" },
              { name: "Corpse Pose", sets: 1, reps: "3 min", desc: "Set intentions" }
            ]
          },
          {
            id: "yoga-restorative-7",
            name: "Stress Relief Sanctuary",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["Mat", "Optional: Eye pillow"],
            exercises: [
              { name: "Yoga - Supported Child's Pose", sets: 1, reps: "3 min", desc: "Surrender stress" },
              { name: "Yoga - Reclined Bound Angle (Supta Baddha Konasana)", sets: 1, reps: "3 min", desc: "Open and release" },
              { name: "Yoga - Supported Forward Fold", sets: 1, reps: "3 min", desc: "Introspection" },
              { name: "Yoga - Legs Up the Wall (Viparita Karani)", sets: 1, reps: "3 min", desc: "Calm activation" },
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
              { name: "Yoga - Supported Bridge Pose", sets: 1, reps: "3 min", desc: "Thyroid stimulation" },
              { name: "Yoga - Supine Twist (Jathara Parivartanasana)", sets: 2, reps: "2 min/side", desc: "Adrenal release" },
              { name: "Yoga - Legs Up the Wall (Viparita Karani)", sets: 1, reps: "3 min", desc: "Endocrine reset" },
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
              { name: "Yoga - Legs Up the Wall (Viparita Karani)", sets: 1, reps: "3 min", desc: "Reverse gravity compression" },
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
              { name: "Yoga - Reclined Bound Angle (Supta Baddha Konasana)", sets: 1, reps: "3 min", desc: "Inner thigh opening" },
              { name: "Yoga - Happy Baby Pose (Ananda Balasana)", sets: 1, reps: "3 min", desc: "Hip socket release" },
              { name: "Yoga - Legs Up the Wall (Viparita Karani)", sets: 1, reps: "3 min", desc: "Gentle inversion" },
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
              { name: "Yoga - Butterfly Pose (Baddha Konasana)", sets: 1, reps: "3 min", desc: "Inner thigh and hips" },
              { name: "Yoga - Dragon Pose (Low Lunge)", sets: 2, reps: "3 min/side", desc: "Hip flexors" },
              { name: "Yoga - Sleeping Swan (Pigeon)", sets: 2, reps: "3 min/side", desc: "Deep hip release" },
              { name: "Yoga - Caterpillar Pose (Seated Forward Fold)", sets: 1, reps: "3 min", desc: "Hamstrings and spine" },
              { name: "Yoga - Supine Twist", sets: 2, reps: "2 min/side", desc: "Spinal fascia" },
              { name: "Corpse Pose", sets: 1, reps: "5 min", desc: "Deep integration" }
            ]
          },
          {
            id: "yoga-yin-2",
            name: "Lower Body Deep Stretch",
            duration: "50 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Butterfly Pose (Baddha Konasana)", sets: 1, reps: "3 min", desc: "Groin opening" },
              { name: "Yoga - Dragon Pose (Low Lunge)", sets: 2, reps: "3 min/side", desc: "Psoas release" },
              { name: "Yoga - Half Frog Pose", sets: 2, reps: "2 min/side", desc: "Quad stretch" },
              { name: "Yoga - Saddle Pose", sets: 1, reps: "3 min", desc: "Thigh and hip flexor" },
              { name: "Yoga - Sleeping Swan (Pigeon)", sets: 2, reps: "3 min/side", desc: "Glute and hip" },
              { name: "Corpse Pose", sets: 1, reps: "5 min", desc: "Complete release" }
            ]
          },
          {
            id: "yoga-yin-3",
            name: "Spine & Hips",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Mat", "Optional: Bolster"],
            exercises: [
              { name: "Yoga - Sphinx Pose", sets: 1, reps: "3 min", desc: "Gentle backbend" },
              { name: "Yoga - Seal Pose", sets: 1, reps: "2 min", desc: "Deeper backbend" },
              { name: "Child's Pose", sets: 1, reps: "2 min", desc: "Counter pose" },
              { name: "Yoga - Dragon Pose (Low Lunge)", sets: 2, reps: "3 min/side", desc: "Hip opening" },
              { name: "Yoga - Sleeping Swan (Pigeon)", sets: 2, reps: "3 min/side", desc: "Deep hip work" },
              { name: "Yoga - Supine Twist", sets: 2, reps: "2 min/side", desc: "Spinal release" },
              { name: "Corpse Pose", sets: 1, reps: "5 min", desc: "Integration" }
            ]
          },
          {
            id: "yoga-yin-4",
            name: "Shoulder & Upper Back Release",
            duration: "40 min",
            difficulty: "Beginner",
            equipment: ["Mat", "Optional: Strap"],
            exercises: [
              { name: "Yoga - Thread the Needle", sets: 2, reps: "2 min/side", desc: "Shoulder and upper back" },
              { name: "Yoga - Melting Heart Pose", sets: 1, reps: "3 min", desc: "Chest and shoulders" },
              { name: "Yoga - Eagle Arms in Seated Pose", sets: 2, reps: "2 min/side", desc: "Shoulder blades" },
              { name: "Yoga - Reclined Twist", sets: 2, reps: "2 min/side", desc: "Upper back release" },
              { name: "Yoga - Supported Fish Pose", sets: 1, reps: "3 min", desc: "Chest opening" },
              { name: "Corpse Pose", sets: 1, reps: "5 min", desc: "Upper body relaxation" }
            ]
          },
          {
            id: "yoga-yin-5",
            name: "Full Body Yin",
            duration: "60 min",
            difficulty: "Beginner",
            equipment: ["Mat", "Optional: Props"],
            exercises: [
              { name: "Yoga - Butterfly Pose", sets: 1, reps: "3 min", desc: "Inner legs" },
              { name: "Yoga - Caterpillar (Seated Forward Fold)", sets: 1, reps: "3 min", desc: "Hamstrings" },
              { name: "Yoga - Dragon Pose", sets: 2, reps: "3 min/side", desc: "Hip flexors" },
              { name: "Yoga - Sleeping Swan", sets: 2, reps: "3 min/side", desc: "Hips" },
              { name: "Yoga - Sphinx to Seal", sets: 1, reps: "3 min", desc: "Spine" },
              { name: "Yoga - Supine Twist", sets: 2, reps: "2 min/side", desc: "Spinal twist" },
              { name: "Yoga - Legs Up the Wall", sets: 1, reps: "3 min", desc: "Inversion" },
              { name: "Corpse Pose", sets: 1, reps: "5 min", desc: "Complete integration" }
            ]
          },
          {
            id: "yoga-yin-6",
            name: "Hip Opening Journey",
            duration: "50 min",
            difficulty: "Intermediate",
            equipment: ["Mat", "Optional: Blocks"],
            exercises: [
              { name: "Yoga - Butterfly Pose", sets: 1, reps: "3 min", desc: "Inner hips" },
              { name: "Yoga - Dragon Pose with back knee down", sets: 2, reps: "3 min/side", desc: "Hip flexor depth" },
              { name: "Yoga - Sleeping Swan", sets: 2, reps: "3 min/side", desc: "External rotation" },
              { name: "Yoga - Saddle Pose", sets: 1, reps: "3 min", desc: "Front of hips" },
              { name: "Yoga - Square Pose (Shoelace)", sets: 2, reps: "3 min/side", desc: "Hip stacking" },
              { name: "Corpse Pose", sets: 1, reps: "5 min", desc: "Hip integration" }
            ]
          },
          {
            id: "yoga-yin-7",
            name: "Stress & Anxiety Relief",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Mat", "Optional: Eye pillow"],
            exercises: [
              { name: "Child's Pose", sets: 1, reps: "3 min", desc: "Grounding" },
              { name: "Yoga - Caterpillar (Seated Forward Fold)", sets: 1, reps: "3 min", desc: "Calming fold" },
              { name: "Yoga - Reclined Bound Angle", sets: 1, reps: "3 min", desc: "Heart opening" },
              { name: "Yoga - Banana Pose (Side Bend)", sets: 2, reps: "2 min/side", desc: "Side body stretch" },
              { name: "Yoga - Supine Twist", sets: 2, reps: "2 min/side", desc: "Release tension" },
              { name: "Yoga - Legs Up the Wall", sets: 1, reps: "3 min", desc: "Calming inversion" },
              { name: "Corpse Pose", sets: 1, reps: "5 min", desc: "Nervous system rest" }
            ]
          },
          {
            id: "yoga-yin-8",
            name: "Hamstring & Lower Back",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Mat", "Optional: Strap"],
            exercises: [
              { name: "Yoga - Caterpillar (Seated Forward Fold)", sets: 1, reps: "3 min", desc: "Hamstrings" },
              { name: "Yoga - Half Butterfly", sets: 2, reps: "2 min/side", desc: "Single leg hamstring" },
              { name: "Yoga - Sleeping Swan", sets: 2, reps: "3 min/side", desc: "Glutes and low back" },
              { name: "Yoga - Banana Pose", sets: 2, reps: "2 min/side", desc: "Side body and QL" },
              { name: "Yoga - Supine Twist", sets: 2, reps: "2 min/side", desc: "Spinal release" },
              { name: "Corpse Pose", sets: 1, reps: "5 min", desc: "Back relaxation" }
            ]
          },
          {
            id: "yoga-yin-9",
            name: "Evening Deep Stretch",
            duration: "50 min",
            difficulty: "Beginner",
            equipment: ["Mat", "Optional: Bolster, Blanket"],
            exercises: [
              { name: "Child's Pose", sets: 1, reps: "3 min", desc: "Settle in" },
              { name: "Yoga - Dragon Pose", sets: 2, reps: "3 min/side", desc: "Release day's tension" },
              { name: "Yoga - Sleeping Swan", sets: 2, reps: "3 min/side", desc: "Hip opening" },
              { name: "Yoga - Caterpillar", sets: 1, reps: "3 min", desc: "Forward fold" },
              { name: "Yoga - Reclined Bound Angle", sets: 1, reps: "3 min", desc: "Heart opening" },
              { name: "Yoga - Legs Up the Wall", sets: 1, reps: "3 min", desc: "Prepare for sleep" },
              { name: "Corpse Pose", sets: 1, reps: "5 min", desc: "Complete relaxation" }
            ]
          },
          {
            id: "yoga-yin-10",
            name: "Meridian Flush",
            duration: "45 min",
            difficulty: "Beginner",
            equipment: ["Mat"],
            exercises: [
              { name: "Yoga - Butterfly Pose", sets: 1, reps: "3 min", desc: "Kidney meridian" },
              { name: "Yoga - Saddle Pose", sets: 1, reps: "3 min", desc: "Stomach and spleen meridians" },
              { name: "Yoga - Dragon Pose", sets: 2, reps: "3 min/side", desc: "Liver and gallbladder" },
              { name: "Yoga - Sleeping Swan", sets: 2, reps: "3 min/side", desc: "Kidney and bladder" },
              { name: "Yoga - Sphinx Pose", sets: 1, reps: "3 min", desc: "Urinary bladder meridian" },
              { name: "Yoga - Supine Twist", sets: 2, reps: "2 min/side", desc: "Digestive organs" },
              { name: "Corpse Pose", sets: 1, reps: "5 min", desc: "Energy integration" }
            ]
          }
        ]
      }

    }
  },

  // ====================
  // BODYWEIGHT WORKOUTS
  // ====================
  "bodyweight": {
    name: "Bodyweight Training",
    icon: "💪",
    description: "Build strength anywhere with no equipment needed",
    subcategories: {

      // LOWER BODY
      "lowerbody": {
        name: "Lower Body",
        description: "Legs, glutes, and lower body power",
        workouts: [
          {
            id: "bw-lower-1",
            name: "Leg Power 1",
            duration: "35 min",
            difficulty: "Beginner",
            equipment: ["None"],
            exercises: [
              { name: "Body Weight Squat", sets: 4, reps: "15", desc: "Quad and glute foundation" },
              { name: "Body Weight Reverse Lunge", sets: 3, reps: "12/leg", desc: "Single leg strength" },
              { name: "Glute Bridge", sets: 4, reps: "20", desc: "Glute activation" },
              { name: "Body Weight Sumo Squat", sets: 3, reps: "15", desc: "Inner thigh work" },
              { name: "Wall Sit", sets: 3, reps: "45 sec", desc: "Quad endurance" },
              { name: "Calf Raise", sets: 3, reps: "20", desc: "Calf definition" }
            ]
          },
          {
            id: "bw-lower-2",
            name: "Glute Sculpt",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["None"],
            exercises: [
              { name: "Single Leg Glute Bridge", sets: 3, reps: "15/leg", desc: "Glute isolation" },
              { name: "Fire Hydrant", sets: 3, reps: "15/side", desc: "Glute medius" },
              { name: "Donkey Kick", sets: 3, reps: "15/leg", desc: "Glute max activation" },
              { name: "Body Weight Sumo Squat", sets: 4, reps: "20", desc: "Inner thigh and glutes" },
              { name: "Lateral Leg Raise", sets: 3, reps: "15/side", desc: "Hip abductors" },
              { name: "Standing Glute Kickback", sets: 3, reps: "15/leg", desc: "Glute contraction" }
            ]
          },
          {
            id: "bw-lower-3",
            name: "Plyometric Legs",
            duration: "28 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Body Weight Squat Jump", sets: 4, reps: "12", desc: "Explosive power" },
              { name: "Jump Lunge", sets: 3, reps: "10/leg", desc: "Dynamic strength" },
              { name: "Single Leg Hop", sets: 3, reps: "10/leg", desc: "Unilateral power" },
              { name: "Broad Jump", sets: 4, reps: "8", desc: "Horizontal power" },
              { name: "Skater Jump", sets: 3, reps: "12/side", desc: "Lateral explosiveness" },
              { name: "Glute Bridge", sets: 3, reps: "20", desc: "Recovery activation" }
            ]
          },
          {
            id: "bw-lower-4",
            name: "Endurance Legs",
            duration: "40 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Body Weight Squat", sets: 5, reps: "25", desc: "High volume quads" },
              { name: "Walking Lunge", sets: 4, reps: "20/leg", desc: "Continuous movement" },
              { name: "Glute Bridge", sets: 5, reps: "30", desc: "Glute endurance" },
              { name: "Wall Sit", sets: 4, reps: "60 sec", desc: "Isometric endurance" },
              { name: "Single Leg Deadlift", sets: 3, reps: "15/leg", desc: "Balance and hamstrings" },
              { name: "Calf Raise", sets: 4, reps: "30", desc: "Calf burn" }
            ]
          },
          {
            id: "bw-lower-5",
            name: "Unilateral Focus",
            duration: "35 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Pistol Squat (or assisted)", sets: 3, reps: "8/leg", desc: "Single leg strength" },
              { name: "Body Weight Reverse Lunge", sets: 4, reps: "12/leg", desc: "Controlled descent" },
              { name: "Single Leg Glute Bridge", sets: 4, reps: "15/leg", desc: "Unilateral glutes" },
              { name: "Single Leg Deadlift", sets: 3, reps: "12/leg", desc: "Balance and hamstrings" },
              { name: "Lateral Lunge", sets: 3, reps: "12/side", desc: "Side-to-side strength" },
              { name: "Single Leg Calf Raise", sets: 3, reps: "15/leg", desc: "Calf isolation" }
            ]
          },
          {
            id: "bw-lower-6",
            name: "Quad Burner",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "Body Weight Squat", sets: 5, reps: "20", desc: "Volume work" },
              { name: "Jump Squat", sets: 4, reps: "15", desc: "Explosive quads" },
              { name: "Wall Sit", sets: 4, reps: "90 sec", desc: "Max endurance" },
              { name: "Bulgarian Split Squat (rear foot elevated)", sets: 3, reps: "12/leg", desc: "Quad emphasis" },
              { name: "Sissy Squat", sets: 3, reps: "10", desc: "Quad isolation" },
              { name: "High Knees", sets: 4, reps: "30 sec", desc: "Dynamic finish" }
            ]
          },
          {
            id: "bw-lower-7",
            name: "Hamstring & Glute",
            duration: "32 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Single Leg Deadlift", sets: 4, reps: "12/leg", desc: "Hamstring focus" },
              { name: "Glute Bridge", sets: 5, reps: "25", desc: "Glute power" },
              { name: "Single Leg Glute Bridge", sets: 3, reps: "15/leg", desc: "Unilateral glutes" },
              { name: "Good Morning (bodyweight)", sets: 4, reps: "15", desc: "Posterior chain" },
              { name: "Donkey Kick", sets: 3, reps: "20/leg", desc: "Glute isolation" },
              { name: "Reverse Hyperextension (lying)", sets: 3, reps: "15", desc: "Glute and hamstring" }
            ]
          },
          {
            id: "bw-lower-8",
            name: "Athletic Legs",
            duration: "35 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "Broad Jump", sets: 4, reps: "8", desc: "Power development" },
              { name: "Jump Lunge", sets: 4, reps: "12/leg", desc: "Explosive lunges" },
              { name: "Skater Jump", sets: 4, reps: "15/side", desc: "Lateral power" },
              { name: "Single Leg Hop", sets: 3, reps: "10/leg", desc: "Unilateral explosiveness" },
              { name: "Speed Skater", sets: 4, reps: "20", desc: "Cardio power" },
              { name: "Glute Bridge", sets: 3, reps: "20", desc: "Recovery" }
            ]
          },
          {
            id: "bw-lower-9",
            name: "Mobility & Strength",
            duration: "35 min",
            difficulty: "Beginner",
            equipment: ["None"],
            exercises: [
              { name: "Deep Squat Hold", sets: 3, reps: "45 sec", desc: "Ankle and hip mobility" },
              { name: "Cossack Squat", sets: 3, reps: "10/side", desc: "Lateral mobility" },
              { name: "Body Weight Reverse Lunge", sets: 3, reps: "12/leg", desc: "Hip flexor stretch" },
              { name: "Glute Bridge with pause", sets: 4, reps: "15", desc: "Mind-muscle connection" },
              { name: "Single Leg Deadlift", sets: 3, reps: "10/leg", desc: "Balance and flexibility" },
              { name: "World's Greatest Stretch", sets: 2, reps: "5/side", desc: "Full body mobility" }
            ]
          },
          {
            id: "bw-lower-10",
            name: "Bodyweight Bootcamp",
            duration: "40 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "Body Weight Squat", sets: 5, reps: "20", desc: "Base work" },
              { name: "Jump Squat", sets: 4, reps: "15", desc: "Power" },
              { name: "Walking Lunge", sets: 4, reps: "15/leg", desc: "Continuous tension" },
              { name: "Single Leg Glute Bridge", sets: 4, reps: "15/leg", desc: "Unilateral glutes" },
              { name: "Burpee", sets: 3, reps: "15", desc: "Full body conditioning" },
              { name: "Wall Sit", sets: 3, reps: "60 sec", desc: "Quad finisher" }
            ]
          }
        ]
      },

      // UPPER BODY
      "upperbody": {
        name: "Upper Body",
        description: "Push, pull, and upper body strength",
        workouts: [
          {
            id: "bw-upper-1",
            name: "Push Power",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["None"],
            exercises: [
              { name: "Push Up", sets: 4, reps: "10-15", desc: "Chest and triceps" },
              { name: "Pike Push Up", sets: 3, reps: "8-12", desc: "Shoulder focus" },
              { name: "Tricep Dip (using chair)", sets: 3, reps: "12-15", desc: "Tricep isolation" },
              { name: "Plank to Down Dog", sets: 3, reps: "10", desc: "Dynamic shoulders" },
              { name: "Diamond Push Up", sets: 3, reps: "8-10", desc: "Tricep emphasis" },
              { name: "Plank Hold", sets: 3, reps: "45 sec", desc: "Core stability" }
            ]
          },
          {
            id: "bw-upper-2",
            name: "Pull Focus",
            duration: "28 min",
            difficulty: "Intermediate",
            equipment: ["Pull-up bar or door frame"],
            exercises: [
              { name: "Pull Up (or assisted)", sets: 4, reps: "8-10", desc: "Back width" },
              { name: "Chin Up", sets: 3, reps: "8-10", desc: "Bicep involvement" },
              { name: "Inverted Row (using table)", sets: 4, reps: "12", desc: "Mid-back" },
              { name: "Scapular Pull Up", sets: 3, reps: "10", desc: "Shoulder blade activation" },
              { name: "Dead Hang", sets: 3, reps: "30 sec", desc: "Grip and shoulder health" },
              { name: "Superman", sets: 3, reps: "15", desc: "Posterior chain" }
            ]
          },
          {
            id: "bw-upper-3",
            name: "Chest Builder",
            duration: "32 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Wide Push Up", sets: 4, reps: "12", desc: "Outer chest" },
              { name: "Diamond Push Up", sets: 3, reps: "10", desc: "Inner chest" },
              { name: "Decline Push Up (feet elevated)", sets: 3, reps: "10", desc: "Upper chest" },
              { name: "Incline Push Up", sets: 3, reps: "15", desc: "Lower chest" },
              { name: "Archer Push Up", sets: 3, reps: "8/side", desc: "Unilateral chest" },
              { name: "Push Up Hold (bottom)", sets: 3, reps: "20 sec", desc: "Isometric strength" }
            ]
          },
          {
            id: "bw-upper-4",
            name: "Shoulder Burner",
            duration: "30 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "Pike Push Up", sets: 5, reps: "12", desc: "Shoulder press" },
              { name: "Handstand Hold (wall-assisted)", sets: 4, reps: "30 sec", desc: "Shoulder endurance" },
              { name: "Plank to Down Dog", sets: 4, reps: "15", desc: "Dynamic shoulders" },
              { name: "Arm Circles", sets: 3, reps: "30 sec each direction", desc: "Shoulder burn" },
              { name: "Dolphin Push Up", sets: 3, reps: "12", desc: "Shoulder strength" },
              { name: "Wall Walk", sets: 3, reps: "5", desc: "Shoulder mobility and strength" }
            ]
          },
          {
            id: "bw-upper-5",
            name: "Arm Sculptor",
            duration: "28 min",
            difficulty: "Beginner",
            equipment: ["None"],
            exercises: [
              { name: "Close Grip Push Up", sets: 4, reps: "12", desc: "Tricep focus" },
              { name: "Tricep Dip", sets: 4, reps: "15", desc: "Tricep isolation" },
              { name: "Isometric Bicep Hold (towel curl)", sets: 3, reps: "30 sec", desc: "Bicep engagement" },
              { name: "Push Up to Plank", sets: 3, reps: "10", desc: "Tricep and core" },
              { name: "Reverse Plank", sets: 3, reps: "30 sec", desc: "Tricep and posterior" },
              { name: "Forearm Plank", sets: 3, reps: "45 sec", desc: "Forearm endurance" }
            ]
          },
          {
            id: "bw-upper-6",
            name: "Back Thickness",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["Pull-up bar"],
            exercises: [
              { name: "Wide Grip Pull Up", sets: 4, reps: "8", desc: "Lat width" },
              { name: "Close Grip Chin Up", sets: 4, reps: "10", desc: "Mid-back thickness" },
              { name: "Inverted Row", sets: 4, reps: "12", desc: "Horizontal pull" },
              { name: "Superman", sets: 4, reps: "15", desc: "Lower back" },
              { name: "Scapular Retraction", sets: 3, reps: "20", desc: "Upper back squeeze" },
              { name: "Dead Hang", sets: 3, reps: "40 sec", desc: "Decompression" }
            ]
          },
          {
            id: "bw-upper-7",
            name: "Push-Pull Balance",
            duration: "35 min",
            difficulty: "Intermediate",
            equipment: ["Pull-up bar"],
            exercises: [
              { name: "Push Up", sets: 4, reps: "12", desc: "Push" },
              { name: "Pull Up", sets: 4, reps: "8", desc: "Pull" },
              { name: "Pike Push Up", sets: 3, reps: "10", desc: "Push (shoulders)" },
              { name: "Inverted Row", sets: 3, reps: "12", desc: "Pull (horizontal)" },
              { name: "Tricep Dip", sets: 3, reps: "12", desc: "Push (triceps)" },
              { name: "Superman", sets: 3, reps: "15", desc: "Pull (lower back)" }
            ]
          },
          {
            id: "bw-upper-8",
            name: "Explosive Upper",
            duration: "28 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "Clapping Push Up", sets: 4, reps: "10", desc: "Explosive chest" },
              { name: "Plyo Push Up", sets: 3, reps: "8", desc: "Power development" },
              { name: "Explosive Pull Up", sets: 4, reps: "6", desc: "Explosive back" },
              { name: "Speed Push Up", sets: 4, reps: "15", desc: "Fast twitch" },
              { name: "Plank Jack", sets: 3, reps: "20", desc: "Dynamic core" },
              { name: "Mountain Climber", sets: 3, reps: "30 sec", desc: "Upper body endurance" }
            ]
          },
          {
            id: "bw-upper-9",
            name: "Endurance Push",
            duration: "32 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Push Up", sets: 5, reps: "15", desc: "Volume work" },
              { name: "Pike Push Up", sets: 4, reps: "12", desc: "Shoulder volume" },
              { name: "Tricep Dip", sets: 4, reps: "15", desc: "Tricep endurance" },
              { name: "Plank to Down Dog", sets: 4, reps: "15", desc: "Dynamic endurance" },
              { name: "Forearm Plank", sets: 4, reps: "60 sec", desc: "Core endurance" },
              { name: "Push Up Hold (top)", sets: 3, reps: "45 sec", desc: "Isometric endurance" }
            ]
          },
          {
            id: "bw-upper-10",
            name: "Bodyweight Gains",
            duration: "35 min",
            difficulty: "Advanced",
            equipment: ["Pull-up bar"],
            exercises: [
              { name: "Archer Push Up", sets: 4, reps: "8/side", desc: "Unilateral chest" },
              { name: "One-Arm Push Up (or assisted)", sets: 3, reps: "5/side", desc: "Max strength" },
              { name: "Typewriter Pull Up", sets: 3, reps: "6/side", desc: "Lateral pull strength" },
              { name: "Pseudo Planche Push Up", sets: 3, reps: "8", desc: "Advanced push" },
              { name: "L-Sit Hold", sets: 3, reps: "20 sec", desc: "Core and shoulder" },
              { name: "Handstand Hold", sets: 3, reps: "30 sec", desc: "Shoulder endurance" }
            ]
          }
        ]
      },

      // CORE & ABS
      "core": {
        name: "Core & Abs",
        description: "Core strength, stability, and definition",
        workouts: [
          {
            id: "bw-core-1",
            name: "Ab Burner",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["None"],
            exercises: [
              { name: "Plank Hold", sets: 4, reps: "45 sec", desc: "Core foundation" },
              { name: "Bicycle Crunch", sets: 3, reps: "20", desc: "Obliques" },
              { name: "Dead Bug", sets: 3, reps: "12/side", desc: "Core control" },
              { name: "Mountain Climber", sets: 3, reps: "30 sec", desc: "Dynamic core" },
              { name: "Leg Raise (bent knee)", sets: 3, reps: "15", desc: "Lower abs" },
              { name: "Russian Twist", sets: 3, reps: "20", desc: "Rotational core" }
            ]
          },
          {
            id: "bw-core-2",
            name: "Oblique Focus",
            duration: "22 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Side Plank", sets: 3, reps: "45 sec/side", desc: "Oblique stability" },
              { name: "Bicycle Crunch", sets: 4, reps: "25", desc: "Oblique activation" },
              { name: "Russian Twist", sets: 4, reps: "30", desc: "Rotational strength" },
              { name: "Side Plank Hip Dip", sets: 3, reps: "15/side", desc: "Oblique endurance" },
              { name: "Plank with Hip Twist", sets: 3, reps: "15/side", desc: "Dynamic obliques" },
              { name: "Cross-Body Mountain Climber", sets: 3, reps: "20", desc: "Oblique cardio" }
            ]
          },
          {
            id: "bw-core-3",
            name: "Lower Ab Sculptor",
            duration: "20 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Leg Raise (straight)", sets: 4, reps: "15", desc: "Lower ab activation" },
              { name: "Reverse Crunch", sets: 4, reps: "20", desc: "Lower ab focus" },
              { name: "Flutter Kick", sets: 3, reps: "30 sec", desc: "Lower ab endurance" },
              { name: "Scissors", sets: 3, reps: "20", desc: "Lower ab control" },
              { name: "Dead Bug", sets: 3, reps: "15/side", desc: "Core stability" },
              { name: "Hollow Hold", sets: 3, reps: "30 sec", desc: "Total ab compression" }
            ]
          },
          {
            id: "bw-core-4",
            name: "Anti-Rotation",
            duration: "25 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Plank Hold", sets: 4, reps: "60 sec", desc: "Anti-extension" },
              { name: "Side Plank", sets: 3, reps: "45 sec/side", desc: "Anti-lateral flexion" },
              { name: "Bird Dog", sets: 4, reps: "12/side", desc: "Anti-rotation" },
              { name: "Plank Alternating Arm & Leg Lift", sets: 3, reps: "10/side", desc: "Stabilization" },
              { name: "Dead Bug", sets: 4, reps: "15/side", desc: "Controlled movement" },
              { name: "Pallof Press (isometric)", sets: 3, reps: "30 sec/side", desc: "Anti-rotation hold" }
            ]
          },
          {
            id: "bw-core-5",
            name: "6-Pack Builder",
            duration: "25 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "V-Up", sets: 4, reps: "15", desc: "Full ab engagement" },
              { name: "Toe Touch Crunch", sets: 4, reps: "20", desc: "Upper abs" },
              { name: "Leg Raise (straight)", sets: 4, reps: "15", desc: "Lower abs" },
              { name: "Bicycle Crunch", sets: 4, reps: "30", desc: "Obliques" },
              { name: "Plank to Pike", sets: 3, reps: "12", desc: "Dynamic core" },
              { name: "Hollow Hold", sets: 3, reps: "45 sec", desc: "Total tension" }
            ]
          },
          {
            id: "bw-core-6",
            name: "Functional Core",
            duration: "22 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Bird Dog", sets: 4, reps: "12/side", desc: "Balance and core" },
              { name: "Plank with Shoulder Tap", sets: 4, reps: "20", desc: "Anti-rotation" },
              { name: "Single Leg Bridge", sets: 3, reps: "15/leg", desc: "Posterior core" },
              { name: "Spiderman Plank", sets: 3, reps: "10/side", desc: "Oblique and hip" },
              { name: "Mountain Climber", sets: 4, reps: "30 sec", desc: "Dynamic stability" },
              { name: "Plank Hold", sets: 3, reps: "60 sec", desc: "Core endurance" }
            ]
          },
          {
            id: "bw-core-7",
            name: "Standing Abs",
            duration: "20 min",
            difficulty: "Beginner",
            equipment: ["None"],
            exercises: [
              { name: "Standing Oblique Crunch", sets: 4, reps: "15/side", desc: "Side abs" },
              { name: "Standing Knee to Elbow", sets: 4, reps: "20", desc: "Oblique activation" },
              { name: "High Knees", sets: 3, reps: "30 sec", desc: "Lower ab engagement" },
              { name: "Standing Twist", sets: 4, reps: "20", desc: "Rotational abs" },
              { name: "Wood Chop (no weight)", sets: 3, reps: "15/side", desc: "Diagonal core" },
              { name: "March in Place", sets: 3, reps: "60 sec", desc: "Core activation" }
            ]
          },
          {
            id: "bw-core-8",
            name: "Plank Variations",
            duration: "18 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Forearm Plank", sets: 3, reps: "60 sec", desc: "Front plank" },
              { name: "Side Plank", sets: 3, reps: "45 sec/side", desc: "Lateral plank" },
              { name: "Reverse Plank", sets: 3, reps: "45 sec", desc: "Posterior plank" },
              { name: "Plank with Knee to Elbow", sets: 3, reps: "10/side", desc: "Dynamic plank" },
              { name: "Plank to Down Dog", sets: 3, reps: "12", desc: "Moving plank" },
              { name: "Plank Hold (max effort)", sets: 2, reps: "90 sec", desc: "Endurance" }
            ]
          },
          {
            id: "bw-core-9",
            name: "Core Cardio",
            duration: "22 min",
            difficulty: "Intermediate",
            equipment: ["None"],
            exercises: [
              { name: "Mountain Climber", sets: 4, reps: "45 sec", desc: "Cardio core" },
              { name: "Burpee", sets: 3, reps: "15", desc: "Full body core" },
              { name: "High Knees", sets: 4, reps: "30 sec", desc: "Lower ab cardio" },
              { name: "Plank Jack", sets: 3, reps: "20", desc: "Dynamic plank" },
              { name: "Cross-Body Mountain Climber", sets: 3, reps: "30 sec", desc: "Oblique cardio" },
              { name: "Flutter Kick", sets: 3, reps: "45 sec", desc: "Lower ab burn" }
            ]
          },
          {
            id: "bw-core-10",
            name: "Advanced Abs",
            duration: "25 min",
            difficulty: "Advanced",
            equipment: ["None"],
            exercises: [
              { name: "L-Sit Hold", sets: 4, reps: "30 sec", desc: "Hip flexor and abs" },
              { name: "Dragon Flag (progression)", sets: 3, reps: "6", desc: "Advanced core" },
              { name: "Hollow Hold to Arch Hold", sets: 4, reps: "30 sec each", desc: "Core compression" },
              { name: "V-Up", sets: 4, reps: "20", desc: "Full abs" },
              { name: "Windshield Wiper", sets: 3, reps: "10/side", desc: "Oblique strength" },
              { name: "Toes to Bar (or lying)", sets: 3, reps: "12", desc: "Hanging abs" }
            ]
          }
        ]
      }

    }
  },

  // ====================
  // HOME/DUMBBELL WORKOUTS
  // ====================
  "home": {
    name: "Home Training (Dumbbells)",
    icon: "🏋️",
    description: "Build muscle at home with dumbbells",
    subcategories: {

      // LOWER BODY
      "lowerbody": {
        name: "Lower Body",
        description: "Legs and glutes with dumbbells",
        workouts: [
          {
            id: "home-lower-1",
            name: "Leg Builder 1",
            duration: "40 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Goblet Squat", sets: 4, reps: "12-15", desc: "Quad focus" },
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "12", desc: "Hamstrings and glutes" },
              { name: "Dumbbell Stationary Lunge", sets: 3, reps: "12/leg", desc: "Unilateral strength" },
              { name: "Dumbbell Step Up", sets: 3, reps: "12/leg", desc: "Quad and glute" },
              { name: "Dumbbell Calf Raise", sets: 3, reps: "15", desc: "Calf development" },
              { name: "Dumbbell Sumo Squat", sets: 3, reps: "15", desc: "Inner thigh and glutes" }
            ]
          },
          {
            id: "home-lower-2",
            name: "Glute Focus",
            duration: "38 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "12", desc: "Glute and hamstring" },
              { name: "Dumbbell Bulgarian Split Squat", sets: 3, reps: "12/leg", desc: "Glute builder" },
              { name: "Dumbbell Hip Thrust", sets: 4, reps: "15", desc: "Glute isolation" },
              { name: "Dumbbell Single Leg Deadlift", sets: 3, reps: "12/leg", desc: "Unilateral glutes" },
              { name: "Dumbbell Lateral Lunge", sets: 3, reps: "12/side", desc: "Glute medius" },
              { name: "Dumbbell Sumo Deadlift", sets: 3, reps: "12", desc: "Inner glutes" }
            ]
          },
          {
            id: "home-lower-3",
            name: "Quad Emphasis",
            duration: "42 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Goblet Squat", sets: 5, reps: "15", desc: "Quad volume" },
              { name: "Dumbbell Bulgarian Split Squat", sets: 4, reps: "12/leg", desc: "Quad focus" },
              { name: "Dumbbell Walking Lunge", sets: 3, reps: "12/leg", desc: "Continuous tension" },
              { name: "Dumbbell Step Up", sets: 4, reps: "12/leg", desc: "Quad builder" },
              { name: "Dumbbell Front Squat", sets: 3, reps: "12", desc: "Quad dominant" },
              { name: "Dumbbell Calf Raise", sets: 4, reps: "15", desc: "Lower leg" }
            ]
          },
          {
            id: "home-lower-4",
            name: "Hamstring & Glute Power",
            duration: "40 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells", "Bench"],
            exercises: [
              { name: "Dumbbell Romanian Deadlift", sets: 5, reps: "10", desc: "Heavy hamstrings" },
              { name: "Dumbbell Single Leg Romanian Deadlift", sets: 4, reps: "10/leg", desc: "Unilateral hamstrings" },
              { name: "Dumbbell Hip Thrust", sets: 4, reps: "15", desc: "Glute power" },
              { name: "Dumbbell Stiff Leg Deadlift", sets: 4, reps: "12", desc: "Hamstring stretch" },
              { name: "Dumbbell Reverse Lunge", sets: 3, reps: "12/leg", desc: "Glute emphasis" },
              { name: "Single Leg Glute Bridge (dumbbell on hips)", sets: 3, reps: "15/leg", desc: "Glute isolation" }
            ]
          },
          {
            id: "home-lower-5",
            name: "Unilateral Legs",
            duration: "42 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Bulgarian Split Squat", sets: 4, reps: "12/leg", desc: "Single leg strength" },
              { name: "Dumbbell Single Leg Deadlift", sets: 4, reps: "12/leg", desc: "Balance and hamstrings" },
              { name: "Dumbbell Reverse Lunge", sets: 4, reps: "12/leg", desc: "Controlled descent" },
              { name: "Dumbbell Step Up", sets: 3, reps: "15/leg", desc: "Unilateral power" },
              { name: "Dumbbell Lateral Lunge", sets: 3, reps: "12/side", desc: "Side-to-side strength" },
              { name: "Single Leg Calf Raise (dumbbell)", sets: 3, reps: "15/leg", desc: "Calf isolation" }
            ]
          },
          {
            id: "home-lower-6",
            name: "Leg Hypertrophy",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Goblet Squat", sets: 4, reps: "15", desc: "High volume quads" },
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "12", desc: "Hamstring volume" },
              { name: "Dumbbell Walking Lunge", sets: 4, reps: "15/leg", desc: "Total leg work" },
              { name: "Dumbbell Hip Thrust", sets: 4, reps: "20", desc: "Glute pump" },
              { name: "Dumbbell Sumo Squat", sets: 4, reps: "15", desc: "Inner thigh volume" },
              { name: "Dumbbell Calf Raise", sets: 4, reps: "20", desc: "Calf pump" }
            ]
          },
          {
            id: "home-lower-7",
            name: "Athletic Legs",
            duration: "38 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Jump Squat", sets: 4, reps: "10", desc: "Explosive power" },
              { name: "Dumbbell Bulgarian Split Squat", sets: 3, reps: "12/leg", desc: "Strength" },
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "12", desc: "Posterior chain" },
              { name: "Dumbbell Lateral Lunge", sets: 3, reps: "12/side", desc: "Lateral movement" },
              { name: "Dumbbell Step Up (explosive)", sets: 3, reps: "10/leg", desc: "Power development" },
              { name: "Dumbbell Calf Raise", sets: 3, reps: "15", desc: "Lower leg power" }
            ]
          },
          {
            id: "home-lower-8",
            name: "Strength Foundation",
            duration: "40 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Goblet Squat", sets: 4, reps: "12", desc: "Learn squat pattern" },
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "10", desc: "Hip hinge pattern" },
              { name: "Dumbbell Reverse Lunge", sets: 3, reps: "10/leg", desc: "Controlled movement" },
              { name: "Dumbbell Glute Bridge", sets: 3, reps: "15", desc: "Glute activation" },
              { name: "Dumbbell Sumo Squat", sets: 3, reps: "12", desc: "Wide stance strength" },
              { name: "Dumbbell Calf Raise", sets: 3, reps: "15", desc: "Calf foundation" }
            ]
          },
          {
            id: "home-lower-9",
            name: "Volume Legs",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Goblet Squat", sets: 5, reps: "20", desc: "High rep quads" },
              { name: "Dumbbell Romanian Deadlift", sets: 5, reps: "15", desc: "High rep hamstrings" },
              { name: "Dumbbell Walking Lunge", sets: 4, reps: "20/leg", desc: "Volume work" },
              { name: "Dumbbell Bulgarian Split Squat", sets: 4, reps: "15/leg", desc: "Unilateral volume" },
              { name: "Dumbbell Sumo Squat", sets: 4, reps: "20", desc: "Inner thigh volume" },
              { name: "Dumbbell Calf Raise", sets: 5, reps: "25", desc: "Calf volume" }
            ]
          },
          {
            id: "home-lower-10",
            name: "Total Leg Development",
            duration: "42 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Front Squat", sets: 4, reps: "12", desc: "Quad emphasis" },
              { name: "Dumbbell Romanian Deadlift", sets: 4, reps: "12", desc: "Hamstring focus" },
              { name: "Dumbbell Bulgarian Split Squat", sets: 3, reps: "12/leg", desc: "Unilateral strength" },
              { name: "Dumbbell Hip Thrust", sets: 4, reps: "15", desc: "Glute isolation" },
              { name: "Dumbbell Lateral Lunge", sets: 3, reps: "12/side", desc: "Adductors" },
              { name: "Dumbbell Calf Raise", sets: 3, reps: "15", desc: "Lower leg" }
            ]
          }
        ]
      },

      // UPPER BODY PUSH
      "push": {
        name: "Upper Body Push",
        description: "Chest, shoulders, and triceps",
        workouts: [
          {
            id: "home-push-1",
            name: "Chest Focus",
            duration: "35 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells", "Bench or Floor"],
            exercises: [
              { name: "Dumbbell Bench Press (floor)", sets: 4, reps: "12", desc: "Chest builder" },
              { name: "Dumbbell Fly (floor)", sets: 3, reps: "12", desc: "Chest stretch" },
              { name: "Dumbbell Close Grip Press", sets: 3, reps: "12", desc: "Inner chest" },
              { name: "Dumbbell Pullover", sets: 3, reps: "12", desc: "Chest expansion" },
              { name: "Push Up", sets: 3, reps: "15", desc: "Bodyweight finisher" },
              { name: "Dumbbell Tricep Kickback", sets: 3, reps: "15", desc: "Tricep isolation" }
            ]
          },
          {
            id: "home-push-2",
            name: "Shoulder Builder",
            duration: "38 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Overhead Press", sets: 4, reps: "12", desc: "Shoulder press" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "15", desc: "Side delts" },
              { name: "Dumbbell Front Raise", sets: 3, reps: "12", desc: "Front delts" },
              { name: "Dumbbell Arnold Press", sets: 3, reps: "10", desc: "Full delt activation" },
              { name: "Dumbbell Reverse Fly", sets: 3, reps: "15", desc: "Rear delts" },
              { name: "Pike Push Up", sets: 3, reps: "12", desc: "Bodyweight shoulders" }
            ]
          },
          {
            id: "home-push-3",
            name: "Tricep Sculptor",
            duration: "30 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Overhead Tricep Extension", sets: 4, reps: "12", desc: "Long head triceps" },
              { name: "Dumbbell Tricep Kickback", sets: 4, reps: "15", desc: "Tricep isolation" },
              { name: "Dumbbell Close Grip Press", sets: 3, reps: "12", desc: "Compound triceps" },
              { name: "Dumbbell Lying Tricep Extension", sets: 3, reps: "12", desc: "Skull crusher variation" },
              { name: "Diamond Push Up", sets: 3, reps: "12", desc: "Bodyweight triceps" },
              { name: "Tricep Dip", sets: 3, reps: "15", desc: "Tricep finisher" }
            ]
          },
          {
            id: "home-push-4",
            name: "Push Power",
            duration: "40 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells", "Bench"],
            exercises: [
              { name: "Dumbbell Bench Press", sets: 5, reps: "10", desc: "Heavy chest" },
              { name: "Dumbbell Incline Press", sets: 4, reps: "10", desc: "Upper chest" },
              { name: "Dumbbell Overhead Press", sets: 4, reps: "8", desc: "Heavy shoulders" },
              { name: "Dumbbell Fly", sets: 3, reps: "12", desc: "Chest stretch" },
              { name: "Dumbbell Lateral Raise", sets: 3, reps: "15", desc: "Shoulder width" },
              { name: "Dumbbell Tricep Extension", sets: 3, reps: "12", desc: "Tricep work" }
            ]
          },
          {
            id: "home-push-5",
            name: "Chest & Shoulders",
            duration: "38 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Bench Press (floor)", sets: 4, reps: "12", desc: "Chest focus" },
              { name: "Dumbbell Overhead Press", sets: 4, reps: "12", desc: "Shoulder press" },
              { name: "Dumbbell Fly", sets: 3, reps: "15", desc: "Chest isolation" },
              { name: "Dumbbell Lateral Raise", sets: 3, reps: "15", desc: "Side delts" },
              { name: "Dumbbell Incline Press", sets: 3, reps: "12", desc: "Upper chest" },
              { name: "Dumbbell Front Raise", sets: 3, reps: "12", desc: "Front delts" }
            ]
          },
          {
            id: "home-push-6",
            name: "Hypertrophy Push",
            duration: "42 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Bench Press", sets: 4, reps: "15", desc: "Volume chest" },
              { name: "Dumbbell Fly", sets: 4, reps: "15", desc: "Chest stretch and pump" },
              { name: "Dumbbell Overhead Press", sets: 4, reps: "12", desc: "Shoulder volume" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "20", desc: "Delt pump" },
              { name: "Dumbbell Tricep Extension", sets: 4, reps: "15", desc: "Tricep volume" },
              { name: "Push Up", sets: 3, reps: "20", desc: "Pump finisher" }
            ]
          },
          {
            id: "home-push-7",
            name: "Shoulder Strength",
            duration: "35 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Overhead Press", sets: 5, reps: "10", desc: "Strength press" },
              { name: "Dumbbell Arnold Press", sets: 4, reps: "10", desc: "Rotation press" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "12", desc: "Side delt builder" },
              { name: "Dumbbell Reverse Fly", sets: 4, reps: "15", desc: "Rear delts" },
              { name: "Dumbbell Front Raise", sets: 3, reps: "12", desc: "Front delts" },
              { name: "Pike Push Up", sets: 3, reps: "15", desc: "Shoulder burn" }
            ]
          },
          {
            id: "home-push-8",
            name: "Upper Body Pump",
            duration: "40 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Bench Press", sets: 4, reps: "15", desc: "Chest pump" },
              { name: "Dumbbell Overhead Press", sets: 4, reps: "12", desc: "Shoulder pump" },
              { name: "Dumbbell Fly", sets: 3, reps: "15", desc: "Chest stretch" },
              { name: "Dumbbell Lateral Raise", sets: 3, reps: "20", desc: "Shoulder burn" },
              { name: "Dumbbell Tricep Kickback", sets: 3, reps: "20", desc: "Tricep pump" },
              { name: "Push Up", sets: 3, reps: "max", desc: "Finisher" }
            ]
          },
          {
            id: "home-push-9",
            name: "Beginner Push",
            duration: "32 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Bench Press (floor)", sets: 3, reps: "12", desc: "Learn chest press" },
              { name: "Dumbbell Overhead Press (seated)", sets: 3, reps: "10", desc: "Controlled press" },
              { name: "Dumbbell Lateral Raise", sets: 3, reps: "12", desc: "Shoulder isolation" },
              { name: "Dumbbell Tricep Kickback", sets: 3, reps: "12", desc: "Tricep control" },
              { name: "Push Up (kneeling if needed)", sets: 3, reps: "10", desc: "Push pattern" },
              { name: "Dumbbell Fly (light)", sets: 3, reps: "12", desc: "Chest stretch" }
            ]
          },
          {
            id: "home-push-10",
            name: "Advanced Push Day",
            duration: "45 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells", "Bench"],
            exercises: [
              { name: "Dumbbell Bench Press", sets: 5, reps: "8", desc: "Heavy chest" },
              { name: "Dumbbell Incline Press", sets: 4, reps: "10", desc: "Upper chest" },
              { name: "Dumbbell Overhead Press", sets: 4, reps: "8", desc: "Heavy shoulders" },
              { name: "Dumbbell Fly", sets: 4, reps: "12", desc: "Chest stretch" },
              { name: "Dumbbell Lateral Raise", sets: 4, reps: "15", desc: "Shoulder width" },
              { name: "Dumbbell Reverse Fly", sets: 3, reps: "15", desc: "Rear delts" },
              { name: "Dumbbell Tricep Extension", sets: 3, reps: "12", desc: "Tricep finisher" }
            ]
          }
        ]
      },

      // UPPER BODY PULL
      "pull": {
        name: "Upper Body Pull",
        description: "Back and biceps development",
        workouts: [
          {
            id: "home-pull-1",
            name: "Back Builder",
            duration: "35 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Bent Over Row", sets: 4, reps: "12", desc: "Back thickness" },
              { name: "Dumbbell Single Arm Row", sets: 3, reps: "12/side", desc: "Unilateral back" },
              { name: "Dumbbell Reverse Fly", sets: 3, reps: "15", desc: "Rear delts and upper back" },
              { name: "Dumbbell Shrug", sets: 3, reps: "15", desc: "Trap development" },
              { name: "Dumbbell Bicep Curl", sets: 3, reps: "12", desc: "Bicep work" },
              { name: "Dumbbell Hammer Curl", sets: 3, reps: "12", desc: "Brachialis" }
            ]
          },
          {
            id: "home-pull-2",
            name: "Bicep Focus",
            duration: "30 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "12", desc: "Bicep builder" },
              { name: "Dumbbell Hammer Curl", sets: 4, reps: "12", desc: "Brachialis and forearm" },
              { name: "Dumbbell Concentration Curl", sets: 3, reps: "12/side", desc: "Peak bicep" },
              { name: "Dumbbell Incline Curl", sets: 3, reps: "12", desc: "Long head stretch" },
              { name: "Dumbbell Zottman Curl", sets: 3, reps: "10", desc: "Full arm development" },
              { name: "Dumbbell Preacher Curl (over bench)", sets: 3, reps: "12", desc: "Bicep isolation" }
            ]
          },
          {
            id: "home-pull-3",
            name: "Back Thickness",
            duration: "38 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Bent Over Row", sets: 5, reps: "12", desc: "Back foundation" },
              { name: "Dumbbell Single Arm Row", sets: 4, reps: "12/side", desc: "Unilateral focus" },
              { name: "Dumbbell Pullover", sets: 3, reps: "12", desc: "Lat stretch" },
              { name: "Dumbbell Reverse Fly", sets: 3, reps: "15", desc: "Upper back" },
              { name: "Dumbbell Shrug", sets: 4, reps: "15", desc: "Traps" },
              { name: "Superman", sets: 3, reps: "15", desc: "Lower back" }
            ]
          },
          {
            id: "home-pull-4",
            name: "Pull Power",
            duration: "40 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells", "Pull-up bar"],
            exercises: [
              { name: "Pull Up", sets: 4, reps: "10", desc: "Vertical pull" },
              { name: "Dumbbell Bent Over Row", sets: 4, reps: "10", desc: "Heavy horizontal pull" },
              { name: "Dumbbell Single Arm Row", sets: 4, reps: "10/side", desc: "Unilateral strength" },
              { name: "Dumbbell Pullover", sets: 3, reps: "12", desc: "Lat work" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "10", desc: "Heavy biceps" },
              { name: "Dumbbell Shrug", sets: 3, reps: "12", desc: "Trap strength" }
            ]
          },
          {
            id: "home-pull-5",
            name: "Back & Biceps",
            duration: "38 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Bent Over Row", sets: 4, reps: "12", desc: "Back work" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "12", desc: "Bicep work" },
              { name: "Dumbbell Single Arm Row", sets: 3, reps: "12/side", desc: "Unilateral back" },
              { name: "Dumbbell Hammer Curl", sets: 3, reps: "12", desc: "Brachialis" },
              { name: "Dumbbell Reverse Fly", sets: 3, reps: "15", desc: "Upper back" },
              { name: "Dumbbell Concentration Curl", sets: 3, reps: "12/side", desc: "Bicep peak" }
            ]
          },
          {
            id: "home-pull-6",
            name: "Hypertrophy Pull",
            duration: "42 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Bent Over Row", sets: 5, reps: "15", desc: "Back volume" },
              { name: "Dumbbell Single Arm Row", sets: 4, reps: "15/side", desc: "Unilateral volume" },
              { name: "Dumbbell Pullover", sets: 4, reps: "15", desc: "Lat stretch and pump" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "15", desc: "Bicep volume" },
              { name: "Dumbbell Hammer Curl", sets: 4, reps: "15", desc: "Forearm volume" },
              { name: "Dumbbell Shrug", sets: 4, reps: "20", desc: "Trap pump" }
            ]
          },
          {
            id: "home-pull-7",
            name: "Unilateral Back",
            duration: "35 min",
            difficulty: "Intermediate",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Single Arm Row", sets: 5, reps: "12/side", desc: "Main movement" },
              { name: "Dumbbell Single Arm Pullover", sets: 3, reps: "12/side", desc: "Unilateral lat" },
              { name: "Dumbbell Single Arm Reverse Fly", sets: 3, reps: "15/side", desc: "Rear delt isolation" },
              { name: "Dumbbell Alternating Curl", sets: 4, reps: "12/side", desc: "Bicep focus" },
              { name: "Dumbbell Single Arm Shrug", sets: 3, reps: "15/side", desc: "Trap isolation" },
              { name: "Single Arm Dead Hang", sets: 2, reps: "20 sec/side", desc: "Grip strength" }
            ]
          },
          {
            id: "home-pull-8",
            name: "Back Strength",
            duration: "38 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Bent Over Row", sets: 5, reps: "8", desc: "Heavy back" },
              { name: "Dumbbell Single Arm Row", sets: 4, reps: "8/side", desc: "Unilateral strength" },
              { name: "Dumbbell Pullover", sets: 4, reps: "10", desc: "Lat builder" },
              { name: "Dumbbell Reverse Fly", sets: 4, reps: "12", desc: "Upper back" },
              { name: "Dumbbell Shrug", sets: 4, reps: "10", desc: "Heavy traps" },
              { name: "Dumbbell Bicep Curl", sets: 3, reps: "10", desc: "Heavy biceps" }
            ]
          },
          {
            id: "home-pull-9",
            name: "Beginner Pull",
            duration: "32 min",
            difficulty: "Beginner",
            equipment: ["Dumbbells"],
            exercises: [
              { name: "Dumbbell Bent Over Row", sets: 3, reps: "12", desc: "Learn row pattern" },
              { name: "Dumbbell Single Arm Row", sets: 3, reps: "10/side", desc: "Controlled movement" },
              { name: "Dumbbell Reverse Fly", sets: 3, reps: "12", desc: "Upper back" },
              { name: "Dumbbell Bicep Curl", sets: 3, reps: "12", desc: "Bicep foundation" },
              { name: "Dumbbell Hammer Curl", sets: 3, reps: "12", desc: "Forearm work" },
              { name: "Dumbbell Shrug", sets: 3, reps: "15", desc: "Trap activation" }
            ]
          },
          {
            id: "home-pull-10",
            name: "Complete Pull Day",
            duration: "42 min",
            difficulty: "Advanced",
            equipment: ["Dumbbells", "Pull-up bar"],
            exercises: [
              { name: "Pull Up", sets: 4, reps: "10", desc: "Vertical pull" },
              { name: "Dumbbell Bent Over Row", sets: 4, reps: "12", desc: "Horizontal pull" },
              { name: "Dumbbell Single Arm Row", sets: 4, reps: "12/side", desc: "Unilateral" },
              { name: "Dumbbell Pullover", sets: 3, reps: "12", desc: "Lat stretch" },
              { name: "Dumbbell Bicep Curl", sets: 4, reps: "12", desc: "Biceps" },
              { name: "Dumbbell Hammer Curl", sets: 3, reps: "12", desc: "Forearms" },
              { name: "Dumbbell Shrug", sets: 3, reps: "15", desc: "Traps" }
            ]
          }
        ]
      }

    }
  }

};

// Export for use in dashboard
if (typeof window !== 'undefined') {
  window.WORKOUT_LIBRARY_EXTENDED = WORKOUT_LIBRARY_EXTENDED;
}
