// Cardio Activities Library
// Defines all cardio activity types with their specific fields, presets, and display information

const CARDIO_ACTIVITIES = {
    // ====================
    // RUNNING & WALKING
    // ====================
    "running": {
        id: "running",
        name: "Running",
        icon: "🏃",
        category: "endurance",
        description: "Outdoor or treadmill running",
        hasDistance: true,
        hasSpeed: true,
        hasPace: true,
        defaultUnit: "km",
        fields: ["duration", "distance", "pace", "elevation"],
        intensityGuide: {
            low: "Easy jog, conversation pace",
            moderate: "Steady run, slightly breathless",
            high: "Tempo run, hard to talk",
            very_high: "Sprint intervals, all-out effort"
        },
        presets: [
            { name: "Easy Run", duration: 30, intensity: "low", description: "Recovery or beginner run" },
            { name: "5K Run", duration: 25, distance: 5, intensity: "moderate", description: "Standard 5K distance" },
            { name: "10K Run", duration: 50, distance: 10, intensity: "moderate", description: "Standard 10K distance" },
            { name: "Interval Training", duration: 30, intensity: "very_high", description: "Sprint intervals with recovery" },
            { name: "Long Run", duration: 60, intensity: "low", description: "Endurance building run" }
        ],
        caloriesPerMinute: { low: 8, moderate: 11, high: 14, very_high: 17 }
    },

    "walking": {
        id: "walking",
        name: "Walking",
        icon: "🚶",
        category: "endurance",
        description: "Brisk walking or power walking",
        hasDistance: true,
        hasSpeed: true,
        hasPace: true,
        defaultUnit: "km",
        fields: ["duration", "distance", "steps"],
        intensityGuide: {
            low: "Leisurely stroll",
            moderate: "Brisk walk, slightly elevated heart rate",
            high: "Power walk, arms pumping",
            very_high: "Race walking or incline walking"
        },
        presets: [
            { name: "Morning Walk", duration: 30, intensity: "low", description: "Easy morning routine" },
            { name: "Brisk Walk", duration: 45, intensity: "moderate", description: "Heart-healthy pace" },
            { name: "Power Walk", duration: 30, intensity: "high", description: "Fitness walking" },
            { name: "Lunch Walk", duration: 20, intensity: "low", description: "Quick midday movement" }
        ],
        caloriesPerMinute: { low: 3, moderate: 5, high: 7, very_high: 9 }
    },

    "hiking": {
        id: "hiking",
        name: "Hiking",
        icon: "🥾",
        category: "endurance",
        description: "Trail hiking and hill walking",
        hasDistance: true,
        hasElevation: true,
        defaultUnit: "km",
        fields: ["duration", "distance", "elevation_gain", "terrain"],
        intensityGuide: {
            low: "Flat trail, easy terrain",
            moderate: "Rolling hills, some incline",
            high: "Steep trail, challenging terrain",
            very_high: "Mountain hiking, extreme elevation"
        },
        presets: [
            { name: "Nature Walk", duration: 60, intensity: "low", description: "Easy trail exploration" },
            { name: "Day Hike", duration: 120, intensity: "moderate", description: "Half-day trail hike" },
            { name: "Mountain Hike", duration: 180, intensity: "high", description: "Challenging elevation hike" }
        ],
        caloriesPerMinute: { low: 5, moderate: 8, high: 10, very_high: 13 }
    },

    // ====================
    // CYCLING
    // ====================
    "cycling": {
        id: "cycling",
        name: "Cycling",
        icon: "🚴",
        category: "endurance",
        description: "Outdoor cycling or road biking",
        hasDistance: true,
        hasSpeed: true,
        hasElevation: true,
        defaultUnit: "km",
        fields: ["duration", "distance", "avg_speed", "max_speed", "elevation_gain"],
        intensityGuide: {
            low: "Easy cruise, flat terrain",
            moderate: "Steady pace, some hills",
            high: "Fast pace, challenging route",
            very_high: "Racing pace or steep climbs"
        },
        presets: [
            { name: "Easy Ride", duration: 30, intensity: "low", description: "Casual cycling" },
            { name: "Commute Ride", duration: 20, intensity: "moderate", description: "Bike commute" },
            { name: "Training Ride", duration: 60, intensity: "high", description: "Structured training" },
            { name: "Long Ride", duration: 120, intensity: "moderate", description: "Endurance ride" }
        ],
        caloriesPerMinute: { low: 5, moderate: 8, high: 11, very_high: 14 }
    },

    "spinning": {
        id: "spinning",
        name: "Spinning / Indoor Cycling",
        icon: "🚲",
        category: "endurance",
        description: "Indoor cycling class or stationary bike",
        hasDistance: false,
        fields: ["duration", "resistance_level", "cadence"],
        intensityGuide: {
            low: "Warm-up or cool-down pace",
            moderate: "Steady cycling, moderate resistance",
            high: "High resistance, fast cadence",
            very_high: "Sprint intervals, max effort"
        },
        presets: [
            { name: "Beginner Spin", duration: 30, intensity: "moderate", description: "Introductory class" },
            { name: "Spin Class", duration: 45, intensity: "high", description: "Standard spin class" },
            { name: "HIIT Spin", duration: 30, intensity: "very_high", description: "High intensity intervals" },
            { name: "Endurance Spin", duration: 60, intensity: "moderate", description: "Long steady session" }
        ],
        caloriesPerMinute: { low: 6, moderate: 10, high: 13, very_high: 16 }
    },

    // ====================
    // SWIMMING
    // ====================
    "swimming": {
        id: "swimming",
        name: "Swimming",
        icon: "🏊",
        category: "endurance",
        description: "Pool or open water swimming",
        hasDistance: true,
        hasLaps: true,
        defaultUnit: "m",
        fields: ["duration", "distance", "laps", "pool_length", "stroke_type"],
        strokeTypes: ["freestyle", "backstroke", "breaststroke", "butterfly", "mixed"],
        intensityGuide: {
            low: "Easy laps, rest between sets",
            moderate: "Continuous swimming, steady pace",
            high: "Fast laps, minimal rest",
            very_high: "Sprint sets, race pace"
        },
        presets: [
            { name: "Easy Swim", duration: 30, laps: 20, intensity: "low", description: "Relaxed swimming" },
            { name: "Lap Swim", duration: 45, laps: 40, intensity: "moderate", description: "Standard workout" },
            { name: "Interval Swim", duration: 30, intensity: "high", description: "Speed work" },
            { name: "Distance Swim", duration: 60, laps: 60, intensity: "moderate", description: "Endurance training" }
        ],
        caloriesPerMinute: { low: 6, moderate: 9, high: 12, very_high: 14 }
    },

    // ====================
    // COMBAT & MARTIAL ARTS
    // ====================
    "boxing": {
        id: "boxing",
        name: "Boxing",
        icon: "🥊",
        category: "combat",
        description: "Boxing training, bag work, or sparring",
        hasDistance: false,
        hasRounds: true,
        fields: ["duration", "rounds", "round_duration", "rest_duration"],
        intensityGuide: {
            low: "Shadow boxing, technique focus",
            moderate: "Bag work, steady pace",
            high: "Intense bag work, pad work",
            very_high: "Sparring or competition pace"
        },
        presets: [
            { name: "Shadow Boxing", duration: 20, rounds: 6, intensity: "low", description: "Technique practice" },
            { name: "Bag Work", duration: 30, rounds: 10, intensity: "moderate", description: "Heavy bag training" },
            { name: "Boxing Class", duration: 45, rounds: 12, intensity: "high", description: "Full boxing workout" },
            { name: "Sparring Session", duration: 30, rounds: 6, intensity: "very_high", description: "Partner sparring" }
        ],
        caloriesPerMinute: { low: 6, moderate: 10, high: 13, very_high: 16 }
    },

    "kickboxing": {
        id: "kickboxing",
        name: "Kickboxing",
        icon: "🦵",
        category: "combat",
        description: "Kickboxing classes or training",
        hasDistance: false,
        hasRounds: true,
        fields: ["duration", "rounds", "round_duration"],
        intensityGuide: {
            low: "Technique drills",
            moderate: "Cardio kickboxing class",
            high: "Intense pad work and combinations",
            very_high: "Sparring or competition training"
        },
        presets: [
            { name: "Cardio Kickboxing", duration: 45, intensity: "moderate", description: "Fitness class" },
            { name: "Technical Training", duration: 60, intensity: "high", description: "Skill development" },
            { name: "Intense Session", duration: 30, intensity: "very_high", description: "High intensity workout" }
        ],
        caloriesPerMinute: { low: 7, moderate: 10, high: 13, very_high: 15 }
    },

    "martial_arts": {
        id: "martial_arts",
        name: "Martial Arts",
        icon: "🥋",
        category: "combat",
        description: "Karate, Taekwondo, Judo, BJJ, MMA, etc.",
        hasDistance: false,
        fields: ["duration", "style", "focus_area"],
        styles: ["karate", "taekwondo", "judo", "bjj", "mma", "kung_fu", "muay_thai", "other"],
        intensityGuide: {
            low: "Forms and kata practice",
            moderate: "Technique drilling",
            high: "Intense training session",
            very_high: "Sparring or competition prep"
        },
        presets: [
            { name: "Class Session", duration: 60, intensity: "moderate", description: "Standard class" },
            { name: "Sparring Practice", duration: 45, intensity: "high", description: "Partner work" },
            { name: "Competition Prep", duration: 90, intensity: "very_high", description: "Intense training" }
        ],
        caloriesPerMinute: { low: 6, moderate: 9, high: 12, very_high: 15 }
    },

    // ====================
    // CARDIO MACHINES
    // ====================
    "rowing": {
        id: "rowing",
        name: "Rowing",
        icon: "🚣",
        category: "machine",
        description: "Rowing machine or on-water rowing",
        hasDistance: true,
        defaultUnit: "m",
        fields: ["duration", "distance", "split_time", "strokes_per_minute"],
        intensityGuide: {
            low: "Easy steady state",
            moderate: "Moderate pace, controlled strokes",
            high: "Fast pace, powerful strokes",
            very_high: "Sprint pieces, race pace"
        },
        presets: [
            { name: "Easy Row", duration: 20, distance: 4000, intensity: "low", description: "Warm-up or recovery" },
            { name: "2K Row", duration: 8, distance: 2000, intensity: "very_high", description: "Standard test piece" },
            { name: "5K Row", duration: 20, distance: 5000, intensity: "high", description: "Middle distance" },
            { name: "Steady State", duration: 30, intensity: "moderate", description: "Endurance training" }
        ],
        caloriesPerMinute: { low: 6, moderate: 9, high: 12, very_high: 15 }
    },

    "elliptical": {
        id: "elliptical",
        name: "Elliptical",
        icon: "⭕",
        category: "machine",
        description: "Elliptical trainer or cross-trainer",
        hasDistance: true,
        defaultUnit: "km",
        fields: ["duration", "distance", "resistance", "incline"],
        intensityGuide: {
            low: "Low resistance, easy pace",
            moderate: "Medium resistance, steady movement",
            high: "High resistance, fast pace",
            very_high: "Max resistance, interval training"
        },
        presets: [
            { name: "Easy Session", duration: 20, intensity: "low", description: "Light cardio" },
            { name: "Standard Workout", duration: 30, intensity: "moderate", description: "Regular session" },
            { name: "Interval Training", duration: 25, intensity: "high", description: "Varied intensity" },
            { name: "Endurance Session", duration: 45, intensity: "moderate", description: "Longer workout" }
        ],
        caloriesPerMinute: { low: 5, moderate: 8, high: 11, very_high: 13 }
    },

    "stair_climbing": {
        id: "stair_climbing",
        name: "Stair Climbing",
        icon: "🪜",
        category: "machine",
        description: "Stair climber, StairMaster, or actual stairs",
        hasFloors: true,
        fields: ["duration", "floors", "steps", "resistance"],
        intensityGuide: {
            low: "Slow pace, low resistance",
            moderate: "Steady climb, moderate pace",
            high: "Fast pace or high resistance",
            very_high: "Sprint climbing, max effort"
        },
        presets: [
            { name: "Easy Climb", duration: 15, intensity: "low", description: "Warm-up climbing" },
            { name: "Steady Climb", duration: 20, intensity: "moderate", description: "Standard session" },
            { name: "Interval Climb", duration: 15, intensity: "high", description: "Varied intensity" },
            { name: "Endurance Climb", duration: 30, intensity: "moderate", description: "Longer session" }
        ],
        caloriesPerMinute: { low: 6, moderate: 9, high: 12, very_high: 15 }
    },

    // ====================
    // JUMP TRAINING
    // ====================
    "jump_rope": {
        id: "jump_rope",
        name: "Jump Rope",
        icon: "🪢",
        category: "hiit",
        description: "Skipping rope workout",
        hasJumps: true,
        fields: ["duration", "total_jumps", "style"],
        styles: ["basic", "double_unders", "crossovers", "mixed"],
        intensityGuide: {
            low: "Easy pace, basic jumps",
            moderate: "Steady jumping, some variations",
            high: "Fast pace, continuous jumping",
            very_high: "Double unders, max speed intervals"
        },
        presets: [
            { name: "Warm-up Jump", duration: 5, intensity: "low", description: "Pre-workout warm-up" },
            { name: "Basic Session", duration: 15, intensity: "moderate", description: "Standard jump rope" },
            { name: "HIIT Jump Rope", duration: 20, intensity: "very_high", description: "Interval training" },
            { name: "Skill Practice", duration: 10, intensity: "moderate", description: "Technique work" }
        ],
        caloriesPerMinute: { low: 8, moderate: 12, high: 15, very_high: 18 }
    },

    // ====================
    // HIIT & CLASSES
    // ====================
    "hiit": {
        id: "hiit",
        name: "HIIT",
        icon: "⚡",
        category: "hiit",
        description: "High-Intensity Interval Training",
        hasDistance: false,
        hasRounds: true,
        fields: ["duration", "rounds", "work_duration", "rest_duration"],
        intensityGuide: {
            low: "Modified movements, longer rest",
            moderate: "Standard HIIT workout",
            high: "Intense intervals, short rest",
            very_high: "Tabata or max effort intervals"
        },
        presets: [
            { name: "Quick HIIT", duration: 15, rounds: 5, intensity: "high", description: "Short intense session" },
            { name: "Standard HIIT", duration: 25, rounds: 8, intensity: "high", description: "Full HIIT workout" },
            { name: "Tabata", duration: 20, rounds: 8, intensity: "very_high", description: "20s work, 10s rest" },
            { name: "HIIT Circuit", duration: 30, rounds: 10, intensity: "high", description: "Full body circuit" }
        ],
        caloriesPerMinute: { low: 8, moderate: 12, high: 15, very_high: 18 }
    },

    "aerobics": {
        id: "aerobics",
        name: "Aerobics / Dance Fitness",
        icon: "💃",
        category: "class",
        description: "Aerobics class, Zumba, dance cardio",
        hasDistance: false,
        fields: ["duration", "class_type"],
        classTypes: ["aerobics", "zumba", "dance_cardio", "step_aerobics", "jazzercise", "other"],
        intensityGuide: {
            low: "Low impact, beginner class",
            moderate: "Standard class pace",
            high: "High energy, advanced class",
            very_high: "Intense choreography, non-stop movement"
        },
        presets: [
            { name: "Beginner Class", duration: 30, intensity: "low", description: "Intro aerobics" },
            { name: "Zumba Class", duration: 45, intensity: "moderate", description: "Dance fitness" },
            { name: "Step Aerobics", duration: 45, intensity: "high", description: "Step class" },
            { name: "Dance Cardio", duration: 60, intensity: "high", description: "Extended dance workout" }
        ],
        caloriesPerMinute: { low: 5, moderate: 8, high: 11, very_high: 13 }
    },

    "circuit_training": {
        id: "circuit_training",
        name: "Circuit Training",
        icon: "🔄",
        category: "hiit",
        description: "Circuit-based cardio workout",
        hasRounds: true,
        fields: ["duration", "rounds", "stations", "work_duration"],
        intensityGuide: {
            low: "Light weights, longer rest",
            moderate: "Balanced circuit",
            high: "Heavy weights, minimal rest",
            very_high: "Max effort at each station"
        },
        presets: [
            { name: "Beginner Circuit", duration: 20, rounds: 2, intensity: "low", description: "Introduction to circuits" },
            { name: "Standard Circuit", duration: 30, rounds: 3, intensity: "moderate", description: "Full body circuit" },
            { name: "Advanced Circuit", duration: 45, rounds: 4, intensity: "high", description: "Challenging workout" }
        ],
        caloriesPerMinute: { low: 6, moderate: 10, high: 13, very_high: 15 }
    },

    // ====================
    // SPORTS
    // ====================
    "tennis": {
        id: "tennis",
        name: "Tennis",
        icon: "🎾",
        category: "sports",
        description: "Tennis match or practice",
        hasDistance: false,
        fields: ["duration", "match_type"],
        matchTypes: ["singles", "doubles", "practice", "drills"],
        intensityGuide: {
            low: "Light rallying, practice",
            moderate: "Casual match or drills",
            high: "Competitive match",
            very_high: "Intense singles match"
        },
        presets: [
            { name: "Practice Session", duration: 60, intensity: "low", description: "Drills and rallying" },
            { name: "Singles Match", duration: 90, intensity: "high", description: "Competitive singles" },
            { name: "Doubles Match", duration: 60, intensity: "moderate", description: "Doubles game" }
        ],
        caloriesPerMinute: { low: 5, moderate: 7, high: 10, very_high: 12 }
    },

    "basketball": {
        id: "basketball",
        name: "Basketball",
        icon: "🏀",
        category: "sports",
        description: "Basketball game or practice",
        hasDistance: false,
        fields: ["duration", "game_type"],
        gameTypes: ["full_court", "half_court", "practice", "pickup"],
        intensityGuide: {
            low: "Shooting practice",
            moderate: "Half-court game or drills",
            high: "Full-court pickup game",
            very_high: "Competitive full game"
        },
        presets: [
            { name: "Shooting Practice", duration: 30, intensity: "low", description: "Solo practice" },
            { name: "Pickup Game", duration: 45, intensity: "high", description: "Casual game" },
            { name: "Full Game", duration: 60, intensity: "very_high", description: "Competitive match" }
        ],
        caloriesPerMinute: { low: 5, moderate: 8, high: 11, very_high: 13 }
    },

    "soccer": {
        id: "soccer",
        name: "Soccer / Football",
        icon: "⚽",
        category: "sports",
        description: "Soccer match or training",
        hasDistance: true,
        fields: ["duration", "game_type", "position"],
        gameTypes: ["full_match", "5_a_side", "practice", "drills"],
        intensityGuide: {
            low: "Light practice or drills",
            moderate: "5-a-side or casual game",
            high: "Full match",
            very_high: "Competitive match, midfield"
        },
        presets: [
            { name: "Training Session", duration: 60, intensity: "moderate", description: "Team practice" },
            { name: "5-a-Side", duration: 45, intensity: "high", description: "Small-sided game" },
            { name: "Full Match", duration: 90, intensity: "very_high", description: "Full game" }
        ],
        caloriesPerMinute: { low: 5, moderate: 8, high: 11, very_high: 14 }
    },

    // ====================
    // OTHER
    // ====================
    "other": {
        id: "other",
        name: "Other Cardio",
        icon: "❤️",
        category: "other",
        description: "Any other cardio activity",
        hasDistance: false,
        fields: ["duration", "activity_name"],
        intensityGuide: {
            low: "Light activity",
            moderate: "Moderate effort",
            high: "High effort",
            very_high: "Maximum effort"
        },
        presets: [],
        caloriesPerMinute: { low: 5, moderate: 8, high: 11, very_high: 14 }
    }
};

// Activity categories for UI grouping
const CARDIO_CATEGORIES = {
    endurance: {
        name: "Endurance",
        icon: "🏃",
        description: "Running, cycling, swimming and more",
        activities: ["running", "walking", "hiking", "cycling", "spinning", "swimming"]
    },
    combat: {
        name: "Combat & Martial Arts",
        icon: "🥊",
        description: "Boxing, kickboxing, and martial arts",
        activities: ["boxing", "kickboxing", "martial_arts"]
    },
    machine: {
        name: "Cardio Machines",
        icon: "🏋️",
        description: "Gym cardio equipment",
        activities: ["rowing", "elliptical", "stair_climbing"]
    },
    hiit: {
        name: "HIIT & Intervals",
        icon: "⚡",
        description: "High-intensity training",
        activities: ["hiit", "jump_rope", "circuit_training"]
    },
    class: {
        name: "Fitness Classes",
        icon: "💃",
        description: "Group fitness and dance",
        activities: ["aerobics"]
    },
    sports: {
        name: "Sports",
        icon: "🏆",
        description: "Team and individual sports",
        activities: ["tennis", "basketball", "soccer"]
    },
    other: {
        name: "Other",
        icon: "❤️",
        description: "Custom activities",
        activities: ["other"]
    }
};

// Intensity levels for display
const INTENSITY_LEVELS = {
    low: { name: "Low", color: "#4CAF50", description: "Light effort, easy breathing" },
    moderate: { name: "Moderate", color: "#FFC107", description: "Moderate effort, can hold conversation" },
    high: { name: "High", color: "#FF9800", description: "Hard effort, difficult to talk" },
    very_high: { name: "Very High", color: "#F44336", description: "Maximum effort, cannot talk" }
};

// Helper function to calculate estimated calories
function calculateEstimatedCalories(activityId, durationMinutes, intensity) {
    const activity = CARDIO_ACTIVITIES[activityId];
    if (!activity || !activity.caloriesPerMinute) {
        return Math.round(durationMinutes * 8); // Default estimate
    }
    const caloriesPerMin = activity.caloriesPerMinute[intensity] || activity.caloriesPerMinute.moderate;
    return Math.round(durationMinutes * caloriesPerMin);
}

// Helper function to format duration
function formatDuration(minutes) {
    if (minutes < 60) {
        return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// Helper function to format pace (min/km)
function formatPace(durationMinutes, distanceKm) {
    if (!distanceKm || distanceKm === 0) return null;
    const paceMinutes = durationMinutes / distanceKm;
    const mins = Math.floor(paceMinutes);
    const secs = Math.round((paceMinutes - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')} /km`;
}

// Helper function to convert distance units
function convertDistance(distance, fromUnit, toUnit) {
    if (fromUnit === toUnit) return distance;
    if (fromUnit === 'km' && toUnit === 'miles') {
        return distance * 0.621371;
    }
    if (fromUnit === 'miles' && toUnit === 'km') {
        return distance * 1.60934;
    }
    if (fromUnit === 'm' && toUnit === 'km') {
        return distance / 1000;
    }
    if (fromUnit === 'km' && toUnit === 'm') {
        return distance * 1000;
    }
    return distance;
}

// Get activity by ID
function getCardioActivity(activityId) {
    return CARDIO_ACTIVITIES[activityId] || CARDIO_ACTIVITIES.other;
}

// Get all activities in a category
function getActivitiesByCategory(categoryId) {
    const category = CARDIO_CATEGORIES[categoryId];
    if (!category) return [];
    return category.activities.map(id => CARDIO_ACTIVITIES[id]).filter(Boolean);
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CARDIO_ACTIVITIES,
        CARDIO_CATEGORIES,
        INTENSITY_LEVELS,
        calculateEstimatedCalories,
        formatDuration,
        formatPace,
        convertDistance,
        getCardioActivity,
        getActivitiesByCategory
    };
}

// Make available globally for browser
if (typeof window !== 'undefined') {
    window.CARDIO_ACTIVITIES = CARDIO_ACTIVITIES;
    window.CARDIO_CATEGORIES = CARDIO_CATEGORIES;
    window.INTENSITY_LEVELS = INTENSITY_LEVELS;
    window.calculateEstimatedCalories = calculateEstimatedCalories;
    window.formatDuration = formatDuration;
    window.formatPace = formatPace;
    window.convertDistance = convertDistance;
    window.getCardioActivity = getCardioActivity;
    window.getActivitiesByCategory = getActivitiesByCategory;
}
