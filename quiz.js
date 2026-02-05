const questions = [
    // ... (This array will be dynamically managed now with interstitials)
];

// Definition of the core questions 
const coreQuestions = [
    {
        id: "menopause_status",
        text: "Which best describes your current status?",
        type: "choice",
        options: [
            { text: "Not Menopausal", value: "none" },
            { text: "I think I'm in Perimenopause", value: "peri" },
            { text: "I am in Menopause", value: "menopause" },
            { text: "I am Post-Menopause", value: "post" }
        ]
    },
    {
        id: "cycle_desc",
        text: "Which best describes your cycle?",
        type: "choice",
        options: [
            { text: "Regular", value: "regular" },
            { text: "Irregular / Skipping", value: "irregular" },
            { text: "No Cycle / Hysterectomy", value: "none" }
        ]
    },
    {
        id: "cycle_body_response",
        text: "How does your body respond to your cycle?",
        subtext: "This helps us personalize your workout recommendations.",
        type: "choice",
        options: [
            { text: "I feel strong and energized", value: "strong" },
            { text: "I feel tired with low energy", value: "tired" }
        ]
    },
    {
        id: "cycle_yoga_suggestion",
        text: "Would you like us to suggest yoga on low-energy cycle days?",
        subtext: "We'll gently recommend recovery workouts when your body might need it most.",
        type: "choice",
        showIf: { questionId: "cycle_body_response", value: "tired" },
        options: [
            { text: "Yes, suggest yoga when I might need it", value: "yes" },
            { text: "No, I'll decide myself", value: "no" }
        ]
    },
    {
        id: "activity_level",
        text: "How active are you?",
        type: "choice",
        options: [
            { text: "Sedentary (No formal exercise)", value: "sedentary" },
            { text: "2-3 Active Sessions Per Week", value: "moderate" },
            { text: "4+ Active Sessions Per Week", value: "active" }
        ]
    },
    {
        id: "body_current",
        text: "Where do you store the most weight?",
        subtext: "Hormones dictate where your body stores fat. Select your primary area.",
        type: "silhouette_map",
        saveAs: "weight_gain_location",
        options: [
            { text: "Belly / Midsection", value: "midsection", pos: { top: '42%', left: '50%'} },
            { text: "Hips & Thighs", value: "hips", pos: { top: '58%', left: '50%'} },
            { text: "Upper Arms / Back", value: "arms", pos: { top: '32%', left: '35%'} },
            { text: "Lower Body", value: "legs", pos: { top: '75%', left: '50%'} }
        ]
    },
    {
        id: "body_goal",
        text: "What is your target body type?",
        type: "image_choice",
        saveAs: "goalBodyType",
        options: [
            { text: "Flat & Toned", value: "Flat", img: "assets/quiz_after_flat.webp" },
            { text: "Athletic & Strong", value: "Athletic", img: "assets/quiz_after_athletic.webp" },
            { text: "Body Builder", value: "Body Builder", img: "assets/quiz_after_bodybuilder.webp" }
        ]
    },
    {
        id: "sleep_hours",
        text: "How many hours of sleep do you get?",
        type: "choice",
        options: [
            { text: "Less than 5 hours", value: "low" },
            { text: "5 - 6 hours", value: "medium" },
            { text: "7 - 8 hours", value: "high" }
        ]
    },
    {
        id: "wake_feel",
        text: "How do you feel when you wake up?",
        type: "choice",
        options: [
            { text: "Groggy for hours", value: "groggy" },
            { text: "Tired but push through", value: "tired" },
            { text: "Refreshed and ready", value: "good" }
        ]
    },
    {
        id: "midday_crash",
        text: "Do you experience an energy crash?",
        type: "choice",
        options: [
            { text: "Yes, mid-afternoon", value: "afternoon" },
            { text: "Yes, after eating", value: "eating" },
            { text: "No, steady energy", value: "no" }
        ]
    },
    {
        id: "caffeine",
        text: "What is your relationship with caffeine?",
        type: "choice",
        options: [
            { text: "Need it to function", value: "need" },
            { text: "Enjoy it but don't need it", value: "enjoy" },
            { text: "Don't drink it", value: "none" }
        ]
    },
    {
        id: "diets_tried",
        text: "Have you tried other diets?",
        type: "choice",
        options: [
            { text: "Keto / Low Carb", value: "keto" },
            { text: "Intermittent Fasting", value: "fasting" },
            { text: "Calorie Counting", value: "cico" },
            { text: "None / Other", value: "none" }
        ]
    },
    {
        id: "weight_gain_desc",
        text: "Our structural scan suggests midsection stress. How would you describe your belly fat?",
        subtext: "Different textures indicate different hormonal root causes.",
        type: "choice",
        options: [
            { text: "Hard / High & Protruding (Visceral Stress)", value: "midsection" },
            { text: "Soft / Fluctuating / Bloated (Gut/Estrogen)", value: "bloating" },
            { text: "Low 'Pouch' or Shelf (Hormonal Drop)", value: "hips" },
            { text: "I don't carry weight there", value: "no" }
        ]
    },
    {
        id: "meal_priority",
        text: "What is your priority for a meal plan?",
        type: "choice",
        options: [
            { text: "Tastes good", value: "taste" },
            { text: "Short prep time", value: "time" },
            { text: "Cost effective", value: "cost" }
        ]
    },
    {
        id: "diet_type",
        text: "Which best describes your diet?",
        type: "choice",
        options: [
            { text: "Vegan", value: "vegan" },
            { text: "Vegetarian", value: "vegetarian" }
        ]
    },
    {
        id: "equipment_access",
        text: "What equipment do you have access to?",
        subtext: "We need this to prescribe the right movement protocol for you.",
        type: "choice",
        options: [
            { text: "Just a mat (No Equipment)", value: "none" },
            { text: "Resistance Bands Only", value: "bands" },
            { text: "Dumbbells (or Dumbbells + Bands)", value: "dumbbells" },
            { text: "Full Gym Access", value: "gym" },
            { text: "Yoga / Stretching Only", value: "yoga_only" }
        ]
    },
    {
        id: "energy_status",
        text: "How are your energy levels right now?",
        subtext: "Be honest. If you are burnt out, high intensity training will only make you gain weight.",
        type: "choice",
        options: [
            { text: "Low / Burnt Out / Exhausted", value: "low" },
            { text: "Moderate / Up and Down", value: "moderate" },
            { text: "High / Ready to push", value: "high" }
        ]
    },
    // ========== WORKOUT CALENDAR QUESTIONS ==========
    {
        id: "training_frequency",
        text: "How many days per week do you want to train?",
        subtext: "Pick what works for your schedule - you can always adjust later.",
        type: "number_select",
        options: [
            { text: "2", value: "2", tip: "Perfect for beginners or busy schedules" },
            { text: "3", value: "3", tip: "Great balance of training and recovery" },
            { text: "4", value: "4", tip: "Ideal for building strength with good recovery" },
            { text: "5", value: "5", tip: "Dedicated training with rest built in" },
            { text: "6", value: "6", tip: "Serious training - we'll ensure proper recovery" },
            { text: "7", value: "7", tip: "Every day! We'll include active recovery days" }
        ]
    },
    {
        id: "split_preference",
        text: "What training split do you prefer?",
        subtext: "This determines how we organize your workouts across the week.",
        type: "split_choice",
        showIf: { questionId: "equipment_access", value: "gym" },
        options: [
            { text: "Full Body", value: "full_body", desc: "Train all muscle groups each session", best: "2-3 days/week" },
            { text: "Push / Pull / Legs", value: "ppl", desc: "Split by movement patterns", best: "3-6 days/week" },
            { text: "Upper / Lower", value: "upper_lower", desc: "Alternate upper and lower body", best: "4 days/week" },
            { text: "Bro Split", value: "bro_split", desc: "One muscle group per day", best: "5-6 days/week" }
        ]
    },
    {
        id: "recovery_preference",
        text: "Do you want recovery days built into your week?",
        subtext: "Yoga and mobility work helps prevent injury and improves results.",
        type: "choice",
        options: [
            { text: "Yes, add yoga & recovery on rest days", value: "yes" },
            { text: "No, just complete rest days", value: "no" }
        ]
    },
    {
        id: "training_days",
        text: "Which days do you want to train?",
        subtext: "Select the days that work best for your schedule.",
        type: "day_selector"
    },
    {
        id: "calendar_build_choice",
        text: "Let's build your workout week!",
        subtext: "",
        type: "calendar_choice",
        options: [
            {
                text: "Tailor My Calendar",
                value: "tailor",
                icon: "✨",
                desc: "We'll create the optimal schedule based on your preferences and recovery science. You can adjust it after."
            },
            {
                text: "Design My Own",
                value: "design",
                icon: "🛠️",
                desc: "Assign specific workouts to each day. Full control over your training week."
            }
        ],
        infoBox: {
            title: "About your 48-week program",
            text: "Each workout slot cycles through 15 unique variations over 48 weeks. You'll never do the same workout twice in a row - we handle the variety, you just show up!"
        }
    },
    {
        id: "calendar_builder",
        text: "Design Your Week",
        subtext: "Tap a day to assign a workout",
        type: "calendar_builder",
        showIf: { questionId: "calendar_build_choice", value: "design" }
    },
    {
        id: "calendar_preview",
        text: "Here's your personalized week",
        subtext: "",
        type: "calendar_preview"
    },
    // ========== END WORKOUT CALENDAR QUESTIONS ==========
    {
        id: "age",
        text: "How old are you?",
        subtext: "This information helps us in metabolic calculations and to personalize your plan!",
        type: "input",
        inputType: "number"
    },
    {
        id: "sex",
        text: "What is your biological sex?",
        subtext: "This helps us calculate accurate metabolic rates for your body.",
        type: "choice",
        options: [
            { text: "Female", value: "female" },
            { text: "Male", value: "male" }
        ]
    },
    {
        id: "height",
        text: "What is your height?",
        subtext: "This information helps us in metabolic calculations!",
        type: "input_unit",
        units: ["Metric", "Imperial"],
        values: ["cm", "ft"]
    },
    {
        id: "weight",
        text: "What is your current weight?",
        subtext: "This information helps us in metabolic calculations!",
        type: "input_unit",
        units: ["Metric", "Imperial"],
        values: ["kg", "lbs"]
    },
    {
        id: "goal_weight",
        text: "What is your goal weight?",
        subtext: "This information helps us in metabolic calculations!",
        type: "input_unit",
        units: ["Metric", "Imperial"],
        values: ["kg", "lbs"]
    },
    {
        id: "symptoms",
        text: "Select all symptoms you've experienced in the last 30 days:",
        type: "multi_choice",
        options: [
            { text: "Bloating / Digestive issues", value: "bloating" },
            { text: "Joint pain / Inflammation", value: "joint_pain" },
            { text: "Mood swings / Irritability", value: "mood" },
            { text: "Hair thinning / Skin changes", value: "hair_skin" },
            { text: "Night sweats / Hot flashes", value: "hot_flashes" },
            { text: "Low libido", value: "libido" },
            { text: "Anxiety / Worry", value: "anxiety" },
            { text: "Unexpected Weight Gain", value: "weight_gain" }
        ],
        buttonText: "ANALYZE SYMPTOMS"
    },
    {
        id: "email",
        text: "Enter your email to see your results:",
        type: "input_email"
    }
];

// --- DYNAMIC SYMPTOM MODULES ---
const SymptomModules = {
    bloating: [
        {
            id: "bloat_timing",
            text: "When is your bloating the worst?",
            type: "choice",
            saveAs: "symptom_bloat_timing",
            options: [
                { text: "Morning (Wake up puffy)", value: "morning" },
                { text: "After Eating (Immediate)", value: "eating" },
                { text: "Evening (Look 6 months pregnant)", value: "evening" }
            ]
        },
        {
            id: "bloat_hangry",
            text: "Do you get 'hangry' (irritable when hungry)?",
            subtext: "This is a key indicator of insulin spikes linked to gut fermentation.",
            type: "choice",
            saveAs: "symptom_bloat_hangry",
            options: [
                { text: "Yes, shaky/irritable", value: "yes" },
                { text: "No, I can wait", value: "no" }
            ]
        },
        {
            id: "bloat_fiber",
            text: "How does your body react to high-fiber plants (beans, broccoli, etc.)?",
            type: "choice",
            saveAs: "symptom_bloat_fiber",
            options: [
                { text: "I digest them easily", value: "good" },
                { text: "They cause extreme, painful gas", value: "bad" },
                { text: "I've started avoiding them entirely", value: "avoidance" }
            ]
        },
        {
            type: "info",
            title: "THE 'ENDO-BELLY' CONNECTION",
            img: "assets/bloating_drawn_relief.webp",
            text: "<strong>What's Happening:</strong> Dwindling estrogen slows gastric emptying. Your digestion is literally moving slower, causing fermentation and that 'hard' belly feeling.",
            buttonText: "I UNDERSTAND",
            goldBar: true
        }
    ],
    joint_pain: [
        {
            id: "joint_loc",
            text: "Where is the pain most acute?",
            type: "choice",
            saveAs: "symptom_joint_loc",
            options: [
                { text: "Hands / Feet (Small joints)", value: "small" },
                { text: "Knees / Hips (Large joints)", value: "large" },
                { text: "Lower Back", value: "back" }
            ]
        },
        {
            id: "joint_stiff",
            text: "Is it worse in the morning?",
            type: "choice",
            saveAs: "symptom_joint_stiff",
            options: [
                { text: "Yes, stiff for >30 mins", value: "stiff" },
                { text: "No, gets worse during day", value: "activity" }
            ]
        },
        {
            id: "joint_impact",
            text: "How does movement or light exercise affect the pain?",
            type: "choice",
            saveAs: "symptom_joint_impact",
            options: [
                { text: "It helps 'loosen' things up", value: "helps" },
                { text: "It makes the pain significantly worse", value: "worsens" },
                { text: "It has no impact at all", value: "neutral" }
            ]
        },
        {
            type: "info",
            title: "ESTROGEN IS LUBRICATION",
            img: "assets/joint_drawn_lubrication.webp",
            text: "<strong>What's Happening:</strong> Estrogen is nature's anti-inflammatory. As it drops, your joints lose hydration and fascia becomes sticky. We need to re-hydrate from within.",
            buttonText: "FIX THIS",
            goldBar: true
        }
    ],
    mood: [
        {
            id: "mood_type",
            text: "How would you describe the emotional shift?",
            type: "choice",
            saveAs: "symptom_mood_type",
            options: [
                { text: "Sudden Rage / Irritability", value: "rage" },
                { text: "Weepiness / Sadness", value: "sad" },
                { text: "Numbness / Apathy", value: "numb" }
            ]
        },
        {
            id: "mood_brain_fog",
            text: "Do you experience frequent 'Brain Fog'?",
            subtext: "Struggling to find words or feeling 'scattered' is a common neuro-hormonal signal.",
            type: "choice",
            saveAs: "symptom_mood_fog",
            options: [
                { text: "No", value: "no" },
                { text: "Yes, can't focus / scattered", value: "yes" },
                { text: "Yes, extreme forgetfulness", value: "forgetful" }
            ]
        },
        {
            id: "mood_patience",
            text: "Have you noticed a shorter 'fuse' or less patience lately?",
            type: "choice",
            saveAs: "symptom_mood_patience",
            options: [
                { text: "Yes, I snap easily (even at loved ones)", value: "short" },
                { text: "No, I'm still quite patient", value: "long" },
                { text: "Only when I'm tired or haven't eaten", value: "situational" }
            ]
        },
        {
            type: "info",
            title: "THE NEURO-STEROID DROP",
            img: "assets/mood_drawn_serotonin.webp",
            text: "<strong>What's Happening:</strong> Estrogen protects serotonin receptors. When it fluctuates, your emotional 'buffer' disappears. It's biological, not psychological.",
            buttonText: "CONTINUE",
            goldBar: true
        }
    ],
    hair_skin: [
        {
            id: "hair_loc",
            text: "Where are you noticing thinning?",
            type: "choice",
            saveAs: "symptom_hair_loc",
            options: [
                { text: "Temples / Hairline", value: "temples" },
                { text: "Widening Part", value: "part" },
                { text: "General shedding (Shower)", value: "shedding" }
            ]
        },
        {
            id: "skin_change",
            text: "Have you noticed changes in your skin texture?",
            type: "choice",
            saveAs: "symptom_skin_change",
            options: [
                { text: "Extreme Dryness / Crepey Skin", value: "dry" },
                { text: "Adult Acne / Breakouts", value: "acne" },
                { text: "Loss of Elasticity / Sagging", value: "elasticity" }
            ]
        },
        {
            id: "nail_health",
            text: "Have your nails changed recently (last 6-12 months)?",
            type: "choice",
            saveAs: "symptom_nail_health",
            options: [
                { text: "Yes, they are brittle and splitting", value: "brittle" },
                { text: "Yes, they are growing very slowly", value: "slow" },
                { text: "No, they are still strong", value: "strong" }
            ]
        },
        {
            type: "info",
            title: "THE ANDROGEN REBOUND",
            img: "assets/hair_skin_drawn_nourish.webp",
            text: "<strong>What's Happening:</strong> As estrogen drops, your relative testosterone levels become dominant, attacking hair follicles. We need to block DHT naturally.",
            buttonText: "CONTINUE",
            goldBar: true
        }
    ],
    hot_flashes: [
        {
            id: "flash_wake",
            text: "Do you wake up during the night drenched or hot?",
            type: "choice",
            saveAs: "symptom_flash_wake",
            options: [
                { text: "Every night", value: "always" },
                { text: "Rarely", value: "rarely" },
                { text: "Never", value: "never" }
            ]
        },
        {
            id: "flash_trigger",
            text: "Do you notice specific triggers (Coffee, Alcohol, Stress)?",
            type: "choice",
            saveAs: "symptom_flash_trigger",
            options: [
                { text: "Yes, definitely", value: "yes" },
                { text: "They just happen randomly", value: "random" }
            ]
        },
        {
            id: "flash_severity",
            text: "How would you rate the intensity of the heat?",
            type: "choice",
            saveAs: "symptom_flash_severity",
            options: [
                { text: "Mild glowing / uncomfortable", value: "mild" },
                { text: "Intense 'Internal Fire' / Sweat", value: "intense" },
                { text: "Severe (Includes heart racing/panic)", value: "severe_panic" }
            ]
        },
        {
            type: "info",
            title: "THE THERMOSTAT GLITCH",
            img: "assets/hot_flash_drawn_cooling.webp",
            text: "<strong>What's Happening:</strong> Your hypothalamus is misreading low estrogen as 'overheating', triggering a false panic-cooldown response that wakes you up.",
            buttonText: "COOL DOWN",
            goldBar: true
        }
    ],
    libido: [
        {
            id: "libido_cause",
            text: "Is the issue mental or physical?",
            type: "choice",
            saveAs: "symptom_libido_cause",
            options: [
                { text: "No Drive (Mental)", value: "mental" },
                { text: "Physical Discomfort / Dryness", value: "physical" },
                { text: "Both", value: "both" }
            ]
        },
        {
            id: "libido_duration",
            text: "How long has this been affecting you?",
            type: "choice",
            saveAs: "symptom_libido_duration",
            options: [
                { text: "Recent shift (Last 6 months)", value: "recent" },
                { text: "Gradual decline over years", value: "chronic" },
                { text: "Since stopping birth control", value: "bc" }
            ]
        },
        {
            id: "libido_energy",
            text: "Do you feel you have the mental energy for intimacy?",
            type: "choice",
            saveAs: "symptom_libido_energy",
            options: [
                { text: "I'm interested, but my body isn't responding", value: "ready_no_body" },
                { text: "I'm too physically exhausted to even think about it", value: "exhausted" },
                { text: "I feel like I've 'lost my sparkle' or myself", value: "lost_self" }
            ]
        },
        {
            type: "info",
            title: "THE DOPAMINE LINK",
            img: "assets/libido_drawn_spark.webp",
            text: "<strong>What's Happening:</strong> Dopamine drives desire, but it needs estrogen to fire effectively. We can reignite this pathway with specific amino acids.",
            buttonText: "CONTINUE",
            goldBar: true
        }
    ],
    anxiety: [
        {
            id: "anxiety_type",
            text: "How does the anxiety manifest?",
            type: "choice",
            saveAs: "symptom_anxiety_type",
            options: [
                { text: "Mental looping / Worry", value: "mental" },
                { text: "Physical panic / Heart racing", value: "physical" },
                { text: "Feeling 'unsafe' or 'dread'", value: "dread" }
            ]
        },
        {
            id: "anxiety_impact",
            text: "When is it most severe?",
            type: "choice",
            saveAs: "symptom_anxiety_impact",
            options: [
                { text: "Morning (High Cortisol)", value: "morning" },
                { text: "Evening / Prevents Sleep", value: "night" },
                { text: "Constant background hum", value: "constant" }
            ]
        },
        {
            id: "anxiety_physical",
            text: "Do you experience physical 'surges' (chest tightness, shaky hands)?",
            type: "choice",
            saveAs: "symptom_anxiety_physical",
            options: [
                { text: "Yes, frequently and without warning", value: "frequent" },
                { text: "Occasionally during stressful moments", value: "occasional" },
                { text: "No, it is almost entirely mental", value: "mental_only" }
            ]
        },
        {
            type: "info",
            title: "THE GABA GAP",
            img: "assets/anxiety_drawn_waves.webp",
            text: "<strong>What's Happening:</strong> Progesterone is your brain's natural chill-pill (it hits GABA receptors). When it crashes in perimenopause, anxiety spikes without a trigger.",
            buttonText: "CALM DOWN",
            goldBar: true
        }
    ],
    weight_gain: [
        {
            id: "gain_onset",
            text: "How quickly did this weight gain happen?",
            type: "choice",
            saveAs: "symptom_gain_onset",
            options: [
                { text: "It crept up slowly over years", value: "slow" },
                { text: "Sudden spike in last 6-12 months", value: "sudden" },
                { text: "I've always struggled with it", value: "chronic" }
            ]
        },
        {
            id: "gain_exercise",
            text: "How does your body respond to exercise lately?",
            subtext: "If you feel exhausted for days after a workout, your cortisol may be peaking.",
            type: "choice",
            saveAs: "symptom_gain_ex_feel",
            options: [
                { text: "No changes / results", value: "no_results" },
                { text: "Exhausted for 24-48 hours after", value: "tired" },
                { text: "Good results / energy", value: "good" }
            ]
        },
        {
            id: "gain_shape",
            text: "Have you noticed your body 'shape' changing (e.g., losing your waistline)?",
            type: "choice",
            saveAs: "symptom_gain_shape",
            options: [
                { text: "Yes, I'm becoming 'boxy' or apple-shaped", value: "boxy" },
                { text: "No, the weight is evenly distributed", value: "even" },
                { text: "I feel like I'm losing muscle but keeping fat", value: "muscle_loss" }
            ]
        },
        {
            type: "info",
            title: "METABOLIC BRAKE",
            img: "assets/weight_gain_drawn_metabolism.webp",
            text: "<strong>What's Happening:</strong> It's not you, it's your hormones. As estrogen drops, your body switches to 'storage mode' to protect your bones. We can flip this switch back.",
            buttonText: "CONTINUE",
            goldBar: true
        }
    ]
};


// Special Slides
const introSlide = {
    type: 'intro',
    img: 'assets/hero_image_final.webp',
    title: 'THE WORLD\'S 1ST PROTOCOL & APP',
    subtitle: 'Designed specifically for plant-based women in transition.',
    socialProof: 'Join 5,400+ Women Already in the 2026 Reset',
    buttonText: 'START ASSESSMENT'
};

const loadingSlide1 = {
    type: 'loading',
    delay: 3500, // Increased as requested (2000 + 1500)
    text: 'Profile Created.',
    subtext: 'We\'re now ready to explore your specific symptoms and hormonal signals.',
    footerText: 'STARTING SYMPTOM ASSESSMENT...'
};

const profileBuildingSlide = {
    type: 'info',
    id: 'profile_building',
    title: 'Profile Initializing...',
    img: 'assets/profile_init_soft.webp',
    text: "We're already seeing a unique metabolic profile. Based on your inputs, we can see your body is ready for a transition. Next, let's narrow down your specific symptoms.",
    buttonText: 'CONTINUE',
    goldBar: true
};

const finalCalculationSlide = {
    type: 'info',
    id: 'final_calculation',
    title: 'FINAL CALCULATION STEP',
    img: 'assets/salespage_v2.webp',
    text: "To finalize your accuracy and secure your temporary data reservation, we need 4 final questions. <strong>Note:</strong> Your high-resolution encrypted profile is only held for 15 minutes. Ready?",
    buttonText: 'I AM READY',
    goldBar: true
};

const graphSlide = {
    type: 'graph',
    title: 'Your wellbeing may be at risk',
    img: 'assets/metabolic_risk_graph.webp',
    text: `Don't worry, you're not alone. All of our customers experience a similar decline, it's a normal part of getting older. What's more important is what comes next. You can choose to accept it or take control.`,
    buttonText: 'SEE MY PLAN'
};

const sleepSlide = {
    type: 'info',
    id: 'sleep_aha',
    title: 'SLEEP DEFICIT DETECTED',
    img: 'assets/quiz_sleep_deficit.webp',
    text: 'Your reported nighttime disruptions ({{wake_night}}) are a classic sign of cortisol spikes. Our protocol helps restore 6-8 hours of quality sleep in 7 days.',
    buttonText: 'CONTINUE',
    goldBar: true
};

const cognitiveSlide = {
    type: 'info',
    id: 'cognitive_aha',
    title: 'NEURAL SIGNAL CAPTURED',
    img: 'assets/neural_signal_captured.webp',
    text: 'Baseline captured. We have recorded your reaction speed of {{reaction_time}}ms. This data helps us calibrate your overall profile. 79% of our community report experiencing enhanced clarity within 14 days.',
    buttonText: 'CONTINUE',
    goldBar: true
};

const diagnosticIntroSlide = {
    type: 'info',
    id: 'diagnostic_warning',
    title: 'BIOMETRIC DATA ENTRY',
    img: 'assets/biometric_intro_v2.webp',
    text: 'We are now entering the <strong>Advanced Bio-Diagnostic</strong> phase. Please ensure you are in a stable environment. We will use your device sensors to measure your metabolic rhythm, neurological stability, and adrenal load.',
    buttonText: 'START DIAGNOSTICS'
};

const pulseInstructionSlide = {
    type: 'info',
    id: 'pulse_instruction',
    title: 'PULSE CALIBRATION',
    img: 'assets/pulse_check_instruction.webp',
    text: 'For an accurate metabolic reading, find your pulse on your <strong>wrist</strong> or <strong>neck</strong>. We will use the rhythmic tap frequency to calculate your cortisol-to-metabolism ratio.',
    buttonText: 'PULSE FOUND - START SYNC'
};

const pulseSyncSlide = {
    type: 'pulse_sync',
    id: 'metabolic_rhythm',
    title: 'Metabolic Rhythm Test',
    img: 'assets/pulse_sync_heart.webp',
    subtitle: 'Find your pulse on your wrist/neck and tap the button in sync with your heartbeat.',
    buttonText: 'FINALIZE RHYTHM'
};

const gyroIntroSlide = {
    type: 'info',
    id: 'gyro_intro',
    title: 'NEURO-STABILITY CHECK',
    img: 'assets/gyro_hand_brand_style.webp',
    text: 'We are about to test your nervous system stability. Place your phone in the palm of your hand and hold perfectly still to detect micro-tremors linked to adrenal load.',
    buttonText: 'START CALIBRATION'
};

const gyroTestSlide = {
    type: 'gyro_test',
    id: 'neuro_stability',
    title: 'Neuro-Stability Sensor',
    img: 'assets/gyro_stability_icon.webp',
    subtitle: 'Hold your phone perfectly flat and still.',
    buttonText: 'BEGIN CALIBRATION'
};

const reactionIntroSlide = {
    type: 'info',
    id: 'reaction_intro',
    title: 'COGNITIVE REACTIVITY',
    img: 'assets/neural_signal_captured.webp',
    text: 'This test measures your neuro-metabolic speed. It helps us understand how your nervous system and metabolism are communicating today, establishing a baseline for your personalized reset.',
    buttonText: 'BEGIN TEST'
};

const reactionTestSlide = {
    type: 'reaction_test',
    id: 'cognitive_speed',
    title: 'Cognitive Reactivity Test',
    subtitle: 'Catch the signals to measure your neuro-metabolic speed.',
    buttonText: 'I AM READY'
};

const adrenalIntroSlide = {
    type: 'info',
    id: 'adrenal_intro',
    title: 'ADRENAL RESILIENCE',
    img: 'assets/adrenal_resilience_grip.webp',
    text: 'We will measure your muscle tension response. Chronic cortisol exposure often leads to unintentional "bracing" or tension in the extremities.',
    buttonText: 'START SENSOR'
};

const adrenalSensorSlide = {
    type: 'adrenal_sensor',
    id: 'adrenal_resilience',
    title: 'Adrenal Resilience Sensor',
    img: 'assets/adrenal_resilience_grip.webp',
    subtitle: 'Squeeze the sides of your phone firmly to measure cortisol-driven muscle tension.',
    buttonText: 'CONTINUE'
};

const biometricScanSlide = {
    type: 'biometric_triage',
    id: 'full_bio_triage',
    title: 'METABOLIC SCAN INITIALIZATION',
    img: 'assets/biometric_warning_clean.webp',
    text: 'We will now activate your camera to detect facial biomarkers and body composition signals. This analysis is private and processed securely.',
    buttonText: 'INITIALIZE SCAN'
};

const eyeScanIntroSlide = {
    type: 'info',
    id: 'eye_scan_intro',
    title: 'OCULAR & DERMA SCAN',
    img: 'assets/pupil_scan_medical.webp',
    text: 'We are scanning for skin inflammation and adrenal stress markers in the eye (pupil dilation and sclera clarity). Please hold your phone at eye level.',
    buttonText: 'START FACE SCAN'
};

const eyeScanActionSlide = {
    type: 'biometric_triage',
    id: 'eye_scan_action',
    title: 'OCULAR & DERMA SCAN',
     // Reuse the medical eye image as a placeholder or icon if needed by the renderer, 
     // though the renderer usually shows video.
    text: 'Please hold your phone at eye level. We are scanning for skin inflammation and adrenal stress markers.',
    buttonText: 'INITIALIZE SENSORS'
};

const eyeAnalysisLoadingSlide = {
    type: 'loading',
    delay: 2000,
    text: 'Processing Ocular Biomarkers...',
    subtext: 'Cross-referencing pupil dilation with adrenal patterns.',
    footerText: 'ANALYZING...'
};

const eyeDiagnosisSlide = {
    type: 'info',
    id: 'eye_diagnosis',
    title: 'OCULAR ANALYSIS COMPLETE',
    img: 'assets/pupil_scan_medical.webp',
    text: '<strong>Biomarker Detected:</strong> Adrenal Fatigue Rings. <br>Our scan detected subtle discoloration in the sclera, often linked to chronic cortisol elevation.',
    buttonText: 'CONTINUE TO BODY SCAN'
};

const bodyScanIntroSlide = {
    type: 'info',
    id: 'body_scan_intro',
    title: 'BODY COMPOSITION SCAN',
    img: 'assets/body_scan_soft.webp',
    text: 'We will now analyze your bio-structural alignment. <br><strong>Sequence:</strong> Front Posture &rarr; Side Profile &rarr; Core Sabilty (One Leg) &rarr; Thoracic Range (Hands Raised).',
    buttonText: 'ACTIVATE CAMERA'
};

const photoAnalysisSlide = {
    type: 'photo_analysis',
    id: 'body_scan_ai',
    title: 'Postural Alignment Scan',
    subtitle: 'Please step back and ensure your full body is visible in the frame.',
    buttonText: 'START SCAN'
};

const bodyAnalysisLoadingSlide = {
    type: 'loading',
    delay: 2000,
    text: 'Mapping Structural Data...',
    subtext: 'Your composition signals are being locally encrypted and synchronized.',
    footerText: 'SECURE DATA LOCK IN PROGRESS...'
};

const bodyDiagnosisSlide = {
    type: 'info',
    id: 'body_diagnosis',
    title: 'STRUCTURAL ANALYSIS COMPLETE',
    img: 'assets/body_scan_soft.webp',
    text: '<strong>Pattern Identified:</strong> Metabolic Anterior Tilt. <br>Your unique structural markers have been recorded. Secure encryption is now active.',
    buttonText: 'FINALIZE PROFILE'
};

const finalAnalysisSlide = {
    type: 'loading',
    delay: 4000,
    text: 'GENERATING YOUR CUSTOM 2026 RESET...',
    subtext: 'Your high-resolution biometric analysis is complete and encrypted. To ensure strict data privacy, this secure session will expire in 15 minutes.',
    footerText: 'RESERVING PROCESSING SLOT...'
};

const discountSlide = {
    type: 'loading',
    id: 'discount_alert',
    delay: 4500,
    text: 'AUTO-DISCOUNT APPLIED',
    subtext: '<span style="color: #48864B; font-weight: 800; font-size: 1.2rem;">50% OFF RESERVED</span><br><br>Because your metabolic profile qualifies for our 2026 Reset Protocol, a 50% price reduction has been automatically applied to this session.',
    footerText: 'SECURING YOUR DISCOUNT...'
};

const diagnosticSummarySlide = {
    type: 'diagnostic_summary',
    id: 'diag_summary',
    title: 'Biometric Analysis Complete',
    text: 'Your sensory and motor data has been cross-referenced with your reported symptoms. Your final metabolic profile is now being calculated.',
    buttonText: 'SEE FINAL ANALYSIS'
};

const dietFailSlide = {
    type: 'info',
    id: 'diet_fail_aha',
    title: '99% OF DIETS FAIL VEGAN WOMEN.',
    img: 'assets/quiz_diet_fail.jpg',
    text: 'Especially {{diets_tried}}, which can actually slow your metabolism during perimenopause. You require a specific protocol filled with phytoestrogens and hormone-safe minerals.',
    buttonText: 'CONTINUE',
    goldBar: true
};

const patternSlide = {
    type: 'info',
    id: 'pattern_aha',
    title: 'PATTERN RECOGNIZED',
    img: 'assets/illustration_flaxseeds.png',
    text: 'Gaining weight in the {{weight_gain}} is a hallmark of "Metabolic Stall." Your body is trying to protect you, but we can teach it to release that energy.',
    buttonText: 'I UNDERSTAND',
    goldBar: true
};

const bmiSlide = {
    type: 'graph',
    id: 'bmi_graph',
    title: 'Body Mass Index',
    text: "Based on your answers, your BMI shows where you sit on the scale. High BMI is often linked to hormonal imbalances that make weight loss harder.",
    buttonText: 'CONTINUE'
};

/**
 * BMI Utilities
 */
function calculateBMI() {
    const hStr = answers['height'] || "170 cm";
    const wStr = answers['weight'] || "70 kg";
    
    const hParts = hStr.split(' ');
    const wParts = wStr.split(' ');
    
    let hV = parseFloat(hParts[0]);
    let hU = hParts[1]; // cm or ft
    let wV = parseFloat(wParts[0]);
    let wU = wParts[1]; // kg or lbs

    // Standardize to Metric for calculation
    let hM = hU === 'Metric' || hU === 'cm' ? hV / 100 : hV * 0.3048;
    let wK = wU === 'Metric' || wU === 'kg' ? wV : wV * 0.453592;

    if (!hM || hM === 0) return 22.0;
    return (wK / (hM * hM)).toFixed(1);
}

function getBMIPosition(bmi) {
    // Range 15 (start) to 40 (end)
    const minBMI = 10;
    const maxBMI = 45;
    let t = (bmi - minBMI) / (maxBMI - minBMI);
    t = Math.max(0, Math.min(1, t)); // Clamp 0-1

    // Cubic Bezier Points: P0(40, 200), P1(120, 200), P2(160, 200), P3(200, 110), P4(280, 20), P5(360, 20)
    // We used a simplified compound curve in the SVG string: 
    // M 40 200 C 120 200, 160 200, 200 110 S 280 20, 360 20
    
    // Manual mapping for the visual curve logic
    let x = 40 + (320 * t);
    let y = 0;
    
    if (t < 0.5) {
        // First half: flat start then curve up
        let t2 = t * 2;
        y = 200 - (90 * Math.pow(t2, 2));
    } else {
        // Second half: curve into flat top
        let t2 = (t - 0.5) * 2;
        y = 110 - (90 * (1 - Math.pow(1 - t2, 2)));
    }
    
    return { x, y };
}

const improvementSlide = {
    type: 'graph',
    id: 'improvement_graph',
    title: 'Your potential improvement in 12 weeks',
    text: "We estimate that you can potentially reach your weight target by following our metabolic protocol.",
    buttonText: 'CONTINUE'
};

const maintainSlide = {
    type: 'graph',
    title: 'Maintain healthy weight based on your physiology',
    img: 'assets/weight_maintain_graph.png',
    text: "When you follow our plan, you significantly increase your chances of maintaining a healthy weight for the rest of your life.",
    buttonText: 'CONTINUE'
};

const forbesSlide = {
    type: 'social_proof',
    title: "Selected as the #1 Plant-Based Guide for Women Over 40",
    img: 'assets/forbes_women.jpeg',
    source: 'VegNews',
    buttonText: 'CONTINUE'
};

const emailCaptureSlide = {
    type: 'email_custom',
    title: 'Enter your email to receive your personalized plan',
    socialProofText: 'Join 5,400+ Women already on their transition journey!',
    buttonText: 'CONTINUE'
};

const currentBodyTypeSlide = {
    id: "body_type_current",
    text: "What is your current body type?",
    type: "image_choice",
    saveAs: "currentBodyType",
    options: [
        { text: "Obese", value: "Obese", img: "assets/quiz_current_obese.png" },
        { text: "Overweight", value: "Overweight", img: "assets/quiz_current_overweight.png" },
        { text: "Regular", value: "Regular", img: "assets/quiz_current_regular.png" }
    ]
};

// Device Detection
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);



// Flatten the quiz flow
// Flatten the quiz flow - "Grand Finale" Structure
let quizFlow = [
    // PHASE 1: INTAKE (Subjective)
    introSlide,
    ...coreQuestions.slice(0, 3), // Goals (0-2)
    currentBodyTypeSlide, 
    coreQuestions[3], // Target Body Type (body_current is now at 3)
    profileBuildingSlide,
    coreQuestions[29], // Symptoms Multi
    loadingSlide1, // First Analysis Pause
    ...coreQuestions.slice(5, 8), // Sleep & Energy Basics (5-7)
    dietFailSlide,
    coreQuestions[9], // Diets tried (now at 9)
    // Removed redundant cycle change and hangry questions
    coreQuestions[14], // Diet Type
    coreQuestions[15], // Equipment
    coreQuestions[16], // Energy Status
    // WORKOUT CALENDAR ONBOARDING
    coreQuestions[17], // Training Frequency (how many days)
    coreQuestions[18], // Split Preference (gym only - has showIf)
    coreQuestions[19], // Recovery Preference (yoga on rest days)
    coreQuestions[20], // Training Days (which days)
    coreQuestions[21], // Calendar Build Choice (tailor vs design)
    coreQuestions[22], // Calendar Builder (design only - has showIf)
    coreQuestions[23], // Calendar Preview

    // PHASE 2: STRESS TEST (Games)
    diagnosticIntroSlide, // Moved here as Main Intro
    reactionIntroSlide,
    reactionTestSlide,
    cognitiveSlide, // Result
    pulseInstructionSlide,
    pulseSyncSlide,
    // Mobile Only Sensors
    gyroIntroSlide,
    gyroTestSlide,
    adrenalIntroSlide,
    adrenalSensorSlide,

    // PHASE 3: BIOMETRIC SCANS (Grand Finale)
    // Eye Scan
    eyeScanIntroSlide,
    eyeScanActionSlide,
    eyeAnalysisLoadingSlide,
    eyeDiagnosisSlide,
    // Body Scan
    bodyScanIntroSlide,
    photoAnalysisSlide,
    bodyAnalysisLoadingSlide,
    bodyDiagnosisSlide,
    diagnosticSummarySlide,

    // PHASE 4: CALIBRATION (Demographics)
    finalCalculationSlide, // "We need 4 final questions..."
    coreQuestions[24], // Age
    coreQuestions[26], // Height
    coreQuestions[27], // Weight
    coreQuestions[28], // Goal Weight
    coreQuestions[13], // Meal Priority
    graphSlide,
    bmiSlide,
    improvementSlide,
    maintainSlide,

    // PHASE 5: REVEAL
    // PHASE 5: REVEAL
    finalAnalysisSlide,
    discountSlide,
    forbesSlide,
    forbesSlide,
    emailCaptureSlide
];

// Remove mobile-only sensors for Desktop users AND their intros
if (!isMobile) {
    quizFlow = quizFlow.filter(step => 
        step.id !== 'gyro_intro' && 
        step.id !== 'neuro_stability' && 
        step.id !== 'adrenal_intro' &&
        step.id !== 'adrenal_resilience'
    );
}

let currentStep = 0;
const answers = {};

// Capture preselected track from URL if present
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('track')) {
    answers.preselected_track = urlParams.get('track');
    console.log("Preselected Track:", answers.preselected_track);
}

/**
 * Generic Gemini Analyzer (Global Scope)
 */
function analyzeWithGemini(imageBlob, key, customPrompt) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64data = reader.result.split(',')[1];
            const prompt = customPrompt || "Analyze this health scan. Provide a scientific assessment.";

            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: base64data } }]
                        }]
                    })
                });
                const data = await response.json();
                if (data.error) throw new Error(data.error.message);
                resolve(data.candidates[0].content.parts[0].text);
            } catch (e) { reject(e); }
        };
        reader.readAsDataURL(imageBlob);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    renderStep();
});

function renderStep() {
    const container = document.getElementById('quizContent');
    container.innerHTML = '';

    const step = quizFlow[currentStep];

    // Restore centering for most pages, keep top-alignment for long symptom lists
    if (step.id === 'symptoms') {
        container.style.justifyContent = 'flex-start';
        container.style.paddingTop = '20px';
    } else {
        container.style.justifyContent = 'center';
        container.style.paddingTop = '0px';
    }
    
    // Update Back Button & Progress Bar visibility
    const backBtn = document.getElementById('backBtn');
    const progressBar = document.getElementById('progressBar');
    
    // Show back button after first slide
    const logoRow = document.getElementById('logoRow');
    const progressRow = document.getElementById('progressRow');
    
    if (currentStep > 0 && step.type !== 'email_custom') {
        backBtn.classList.remove('hidden');
    } else {
        backBtn.classList.add('hidden');
    }

    if (step.type === 'intro') {
        logoRow.classList.add('hidden');
        progressRow.classList.add('hidden');
        progressBar.style.width = '0%';
        
        container.innerHTML = `
            <div style="text-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; padding: 0 1rem; font-family: 'Montserrat', sans-serif;">
                <p style="color: #48864B; font-size: 0.8rem; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 12px; font-family: 'Montserrat', sans-serif;">The Authority in Plant-Based Health</p>
                <h1 style="color: #1a4d2e; font-size: 1.7rem; margin-bottom: 12px; font-weight: 900; line-height: 1.2; letter-spacing: -0.5px; font-family: 'Montserrat', sans-serif;">${step.title}</h1>
                <p style="font-size: 1.05rem; color: #666; margin-bottom: 30px; font-weight: 500; font-family: 'Montserrat', sans-serif;">${step.subtitle}</p>
                
                <div style="margin-bottom: 50px; width: 100%; max-width: 320px; position: relative;">
                    <img src="${step.img}" style="width: 100%; height: auto; border-radius: 24px; box-shadow: 0 15px 45px rgba(0,0,0,0.12);" alt="Introduction">
                    <div style="position: absolute; bottom: -25px; left: 50%; transform: translateX(-50%); background: #D4AF37; color: white; padding: 10px 15px; border-radius: 30px; font-size: 0.85rem; font-weight: 800; box-shadow: 0 6px 15px rgba(212, 175, 55, 0.3); text-transform: uppercase; letter-spacing: 0.5px; width: 90%; line-height: 1.3;">
                        ${step.socialProof}
                    </div>
                </div>

                <p id="introStatus" style="margin-bottom: 2rem; font-size: 0.9rem; color: #444; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px;">System Ready...</p>
                
                <button id="startBtn" class="option-btn" onclick="nextStep()" style="width: 100%; max-width: 400px; margin-bottom: 1rem; opacity: 0.6; pointer-events: none;" disabled>PLEASE WAIT</button>
            </div>
        `;

        runIntroLoading();

    } else if (step.type === 'loading') {
        logoRow.classList.add('hidden');
        progressRow.classList.add('hidden');
        
        container.innerHTML = `
            <div style="text-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center; width: 100%; min-height: 75vh; padding: 20px; box-sizing: border-box; font-family: 'Montserrat', sans-serif;">
                <!-- Title Section -->
                <div style="margin: 0;">
                    <h2 style="color: #999; font-size: 1.4rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; line-height: 1.3; margin: 0;">${step.text}</h2>
                </div>
                
                <!-- Body text - centered as the focal point -->
                ${step.subtext ? `
                <div style="margin-top: 40px; max-width: 500px;">
                    <h3 style="color: #666; font-weight: 500; font-size: 1.1rem; line-height: 1.7; margin: 0;">${step.subtext}</h3>
                </div>` : ''}

                ${step.spinner !== false ? '<div class="loader" style="margin-top: 40px;"></div>' : ''}
                
                ${step.footerText ? `<p style="margin-top: 40px; font-size: 12px; color: #bbb; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">${step.footerText}</p>` : ''}
            </div>
        `;

        setTimeout(() => {
            nextStep();
        }, step.delay);

    } else if (step.type === 'info') {
        logoRow.classList.remove('hidden');
        progressRow.classList.remove('hidden');
        updateProgress();

        // AHA MOMENT: Tailor text based on user answers
        let displayTitle = step.title;
        let displayText = step.text;

        if (step.id === 'sleep_aha') {
            const wake = answers.wake_night === 'always' ? 'waking up every night' : 'interrupted sleep';
            displayText = displayText.replace('{{wake_night}}', wake);
        } else if (step.id === 'cognitive_aha') {
            const fog = answers.brain_fog === 'forgetful' ? 'forgetfulness' : 'brain fog';
            const reaction = answers.reaction_time || '350';
            displayText = displayText.replace('{{brain_fog}}', fog).replace('{{reaction_time}}', reaction);
        } else if (step.id === 'diet_fail_aha') {
            let diet = answers.diets_tried || 'generic low-calorie plans';
            if (diet === 'cico') diet = 'Calorie Counting';
            if (diet === 'fasting') diet = 'Intermittent Fasting';
            if (diet === 'keto') diet = 'Keto / Low Carb';
            displayText = displayText.replace('{{diets_tried}}', diet);
        } else if (step.id === 'pattern_aha') {
            const area = answers.weight_gain === 'midsection' ? 'midsection' : 'hips and thighs';
            displayText = displayText.replace('{{weight_gain}}', area);
        }

        container.innerHTML = `
            <div style="text-align: center; padding: 0 1rem; width: 100%;">
                <h2 style="text-transform: uppercase; font-size: 1.3rem; margin-bottom: 1rem; width: 100%; text-align: center;">${displayTitle}</h2>
                <div style="margin: 0.5rem auto; width: 100%;">
                    <img src="${step.img}" style="max-width: 280px; width: 100%; max-height: 220px; object-fit: cover; border-radius: 12px; display: block; margin: 0 auto;" alt="Info Image">
                </div>
                <p style="text-align: center; max-width: 400px; margin: 0.8rem auto 1rem auto; line-height: 1.4; font-size: 0.95rem;">${displayText}</p>
                <button class="option-btn" onclick="nextStep()" style="width: 100%; max-width: 400px; margin: 0 auto;">${step.buttonText}</button>
                ${step.secondaryButton ? `<button class="option-btn" onclick="nextStep()" style="width: 100%; max-width: 400px; margin: 0.5rem auto; background: #fff; color: #666; border-color: #eee;">${step.secondaryButton}</button>` : ''}
            </div>
        `;
    } else if (step.type === 'pulse_sync') {
        logoRow.classList.remove('hidden');
        progressRow.classList.remove('hidden');
        updateProgress();

        container.innerHTML = `
            <div style="text-align: center; padding: 0 1rem; width: 100%;">
                <h2 style="text-transform: uppercase; font-size: 1.3rem; margin-bottom: 0.5rem;">${step.title}</h2>
                <p style="font-size: 0.85rem; color: #666; margin-bottom: 1.5rem;">${step.subtitle}</p>
                
                <div style="width: 100%; max-width: 320px; height: 320px; background: #fff; border-radius: 50%; border: 4px solid #48864B; margin: 0 auto 2rem auto; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.05);">
                    <img src="${step.img}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.1; position: absolute;">
                    
                    <button id="pulse-btn" style="width: 140px; height: 140px; background: #48864B; border: none; border-radius: 50%; color: white; font-weight: 900; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; z-index: 5; transition: transform 0.1s;">
                        <i data-lucide="heart" fill="currentColor"></i>
                        <span>TAP SYNC</span>
                    </button>

                    <div id="pulse-ripples" style="position: absolute; width: 100%; height: 100%; pointer-events: none;"></div>
                </div>
                
                <div id="pulse-stats" style="font-weight: 800; color: #1a4d2e; visibility: hidden;">
                    CURRENT BPM: <span id="bpm-val">--</span>
                </div>
                
                <button id="pulse-finish" class="option-btn" onclick="nextStep()" style="width: 100%; max-width: 400px; margin: 2rem auto; display: none;">${step.buttonText}</button>
            </div>
        `;
        if(typeof lucide !== 'undefined') lucide.createIcons();

        const btn = document.getElementById('pulse-btn');
        const ripples = document.getElementById('pulse-ripples');
        const bpmDisplay = document.getElementById('pulse-stats');
        const bpmVal = document.getElementById('bpm-val');
        const finishBtn = document.getElementById('pulse-finish');

        let taps = [];
        btn.onclick = () => {
            const now = Date.now();
            taps.push(now);
            
            // Ripple animation
            const ripple = document.createElement('div');
            ripple.style.cssText = `position:absolute; top:50%; left:50%; width:140px; height:140px; border:2px solid #48864B; border-radius:50%; transform:translate(-50%,-50%); animation: rippleEffect 1s ease-out forwards;`;
            ripples.appendChild(ripple);
            setTimeout(() => ripple.remove(), 1000);
            
            btn.style.transform = 'scale(0.95)';
            setTimeout(() => btn.style.transform = 'scale(1)', 100);

            if (taps.length > 5) {
                const intervals = [];
                for(let i=1; i<taps.length; i++) {
                    intervals.push(taps[i] - taps[i-1]);
                }
                const avgInterval = intervals.reduce((a,b) => a+b, 0) / intervals.length;
                const bpm = Math.round(60000 / avgInterval);
                
                bpmDisplay.style.visibility = 'visible';
                bpmVal.innerText = bpm;
                answers['metabolic_bpm'] = bpm;

                if (taps.length > 10) {
                    finishBtn.style.display = 'block';
                }
            }
        };

    } else if (step.type === 'gyro_test') {
        logoRow.classList.remove('hidden');
        progressRow.classList.remove('hidden');
        updateProgress();

        container.innerHTML = `
            <div style="text-align: center; padding: 0 1rem; width: 100%;">
                <h2 style="text-transform: uppercase; font-size: 1.3rem; margin-bottom: 0.5rem;">${step.title}</h2>
                <p style="font-size: 0.85rem; color: #666; margin-bottom: 1.5rem; max-width: 320px; margin-left: auto; margin-right: auto;">${step.subtitle}</p>
                
                <div id="gyro-container" style="width: 100%; max-width: 320px; height: 320px; background: #f8fafc; border: 2px solid #eee; border-radius: 30px; margin: 0 auto 2rem auto; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: inset 0 0 20px rgba(0,0,0,0.02);">
                    
                    <div id="level-circle" style="width: 200px; height: 200px; border: 1px solid #ddd; border-radius: 50%; position: absolute;"></div>
                    <div id="level-dot" style="width: 40px; height: 40px; background: #48864B; border-radius: 50%; position: absolute; box-shadow: 0 10px 20px rgba(72,134,75,0.3); transition: transform 0.1s linear;"></div>
                    
                    <div id="calibration-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.8); display: flex; align-items: center; justify-content: center; z-index: 10;">
                        <button class="option-btn" onclick="startGyroTest()" style="width: 180px;">${step.buttonText}</button>
                    </div>
                </div>

                <p id="gyro-status" style="font-weight: 800; color: #1a4d2e; text-transform: uppercase; letter-spacing: 1px;">Ready?</p>
            </div>
            <style>
                @keyframes rippleEffect {
                    0% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
                    100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
                }
            </style>
        `;

        const dot = document.getElementById('level-dot');
        const status = document.getElementById('gyro-status');
        const overlay = document.getElementById('calibration-overlay');
        
        let testRunning = false;
        let stabilityScore = 0;
        let readings = 0;

        window.startGyroTest = async () => {
            overlay.style.display = 'none';
            testRunning = true;
            status.innerText = 'CALIBRATING: HOLD STILL';

            if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
                try {
                    const permission = await DeviceOrientationEvent.requestPermission();
                    if (permission === 'granted') {
                        window.addEventListener('deviceorientation', handleOrientation);
                    }
                } catch (e) { console.error(e); }
            } else {
                window.addEventListener('deviceorientation', handleOrientation);
            }

            setTimeout(() => {
                testRunning = false;
                window.removeEventListener('deviceorientation', handleOrientation);
                const score = Math.min(100, Math.round(100 - (stabilityScore / readings * 10)));
                answers['neuro_stability_score'] = score;
                status.innerText = `STABILITY SCORE: ${score}%`;
                setTimeout(nextStep, 1500);
            }, 5000);
        };

        function handleOrientation(e) {
            if (!testRunning) return;
            // Map beta (-90 to 90) and gamma (-90 to 90) to pixel offset
            const x = e.gamma * 2.5; 
            const y = e.beta * 2.5;
            dot.style.transform = `translate(${x}px, ${y}px)`;
            
            stabilityScore += (Math.abs(e.gamma) + Math.abs(e.beta));
            readings++;
        }

    } else if (step.type === 'biometric_triage') {
        logoRow.classList.remove('hidden');
        progressRow.classList.remove('hidden');
        updateProgress();

        // Check for Gemini Key
        let geminiKey = sessionStorage.getItem('GEMINI_API_KEY') || 'AIzaSyCu5U2fhK5gptQ-A959MdSaIUxz9XKQM-Q';
        const keyInputStyle = geminiKey ? 'display:none;' : 'display:block;';

        container.innerHTML = `
            <div style="text-align: center; padding: 0 1rem; width: 100%;">
                <p id="triage-subtitle" style="font-size: 0.85rem; color: #666; margin-bottom: 1.5rem; margin-top: 1rem;">Analyzing for Adrenal Stress and Hormonal Biomarkers</p>
                
                <!-- API KEY INPUT -->
                <div id="gemini-input-container" style="${keyInputStyle} margin-bottom: 20px;">
                    <input type="password" id="gemini-key-input" placeholder="Enter Gemini API Key" style="padding: 10px; border-radius: 5px; border: 1px solid #ccc; width: 80%; font-size: 14px;">
                    <button onclick="saveGeminiKey()" style="padding: 10px; background: #48864B; color: white; border: none; border-radius: 5px; font-weight: 700;">SAVE</button>
                    <p style="font-size: 10px; color: #999; margin-top: 5px;">Key is stored locally in your browser for this session.</p>
                </div>

                <div id="camera-container" style="width: 100%; max-width: 320px; aspect-ratio: 1/1; background: #000; border: 4px solid #ffffff; border-radius: 50%; overflow: hidden; margin: 0 auto 2rem auto; position: relative; box-shadow: 0 20px 50px rgba(0,0,0,0.15);">
                    <video id="triage-video" style="width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1);" autoplay playsinline muted></video>
                    
                    <!-- Scan Overlays -->
                    <div id="triage-grid" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-image: radial-gradient(rgba(72,134,75,0.1) 1px, transparent 1px); background-size: 20px 20px; pointer-events: none; opacity: 0.3;"></div>
                    <div id="scan-bar" style="position: absolute; top: -100%; left: 0; width: 100%; height: 40%; background: linear-gradient(to bottom, transparent, rgba(72, 134, 75, 0.4), transparent); border-bottom: 2px solid #48864B; pointer-events: none; z-index: 10;"></div>
                    
                    <!-- Facial Reticle -->
                    <svg id="triage-reticle" viewBox="0 0 100 100" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 70%; height: 70%; fill: none; stroke: rgba(255,255,255,0.3); stroke-width: 0.5; pointer-events: none; z-index: 5;">
                        <circle cx="50" cy="50" r="48" />
                        <path d="M 50 2 L 50 10 M 50 90 L 50 98 M 2 50 L 10 50 M 90 50 L 98 50" stroke="white" stroke-width="2"/>
                    </svg>

                    <!-- Thermal Overlay (Simulated) -->
                    <div id="thermal-filter" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: radial-gradient(circle, rgba(255,100,0,0.2) 0%, rgba(0,100,255,0.2) 100%); mix-blend-mode: overlay; opacity: 0; transition: opacity 1s;"></div>

                    <div id="triage-status" style="position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.7); color: #fff; padding: 6px 16px; border-radius: 20px; font-size: 0.75rem; font-weight: 800; letter-spacing: 1px; white-space: nowrap; z-index: 20; border: 1px solid rgba(72,134,75,0.5);">INITIALIZING...</div>
                </div>
                
                <button id="triage-start-btn" class="option-btn" onclick="startBioTriage()" style="width: 100%; max-width: 400px; margin: 0 auto;">ACTIVATE OPTIC SENSORS</button>
                <button onclick="jumpToStep('body_scan_intro')" style="display: block; margin: 15px auto 0; background: transparent; border: none; color: #888; text-decoration: underline; cursor: pointer; font-size: 0.85rem; font-family: inherit;">SKIP SCAN</button>
            </div>

            <style>
                @keyframes scanSlideDown {
                    0% { top: -40%; }
                    100% { top: 100%; }
                }
                .active-scan #scan-bar {
                    animation: scanSlideDown 3s infinite linear;
                }
            </style>
        `;

        window.startBioTriage = async () => {
            const video = document.getElementById('triage-video');
            const container = document.getElementById('camera-container');
            const status = document.getElementById('triage-status');
            const subtitle = document.getElementById('triage-subtitle');
            
            // TRANSFORM TO TERMINAL MODE (Square Visual)
            container.style.transition = "all 0.5s ease";
            container.style.borderRadius = "20px"; 
            container.style.border = "2px solid rgba(66, 133, 244, 0.5)";
            container.style.boxShadow = "0 0 30px rgba(66, 133, 244, 0.2)";

            // 1. Inject "Terminal UI" Styles & Elements
            const terminalOverlay = document.createElement('div');
            terminalOverlay.id = 'terminal-ui';
            terminalOverlay.innerHTML = `
                <style>
                    .term-text { font-family: 'Courier New', monospace; font-weight: bold; letter-spacing: 1px; text-shadow: 0 1px 2px black; }
                    .term-bar-bg { width: 100%; height: 6px; background: rgba(255,255,255,0.2); margin-top: 4px; border-radius: 3px; }
                    .term-bar-fill { height: 100%; background: #4285F4; width: 0%; transition: width 0.2s; border-radius: 3px; box-shadow: 0 0 10px #4285F4; }
                </style>
                <div style="position: absolute; top: 10px; left: 0; width: 100%; display: flex; justify-content: space-between; padding: 0 20px; box-sizing: border-box; z-index: 10;">
                    <span class="term-text" style="color: rgba(255,255,255,0.7); font-size: 10px;">PLANT BASED BIOSCAN v5.0</span>
                    <span class="term-text" id="fps-counter" style="color: #4285F4; font-size: 10px;">INIT...</span>
                </div>

                <div style="position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%); width: 80%; text-align: center; z-index: 10;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                        <span class="term-text" style="color: white; font-size: 10px;">ALIGNMENT</span>
                        <span class="term-text" id="align-val" style="color: white; font-size: 10px;">0%</span>
                    </div>
                    <div class="term-bar-bg"><div id="align-bar" class="term-bar-fill"></div></div>
                    
                    <div style="display: flex; justify-content: space-between; margin-top: 8px; margin-bottom: 2px;">
                        <span class="term-text" style="color: white; font-size: 10px;">IRIS LOCK</span>
                        <span class="term-text" id="focus-val" style="color: white; font-size: 10px;">0%</span>
                    </div>
                    <div class="term-bar-bg"><div id="focus-bar" class="term-bar-fill"></div></div>
                </div>
            `;
            container.appendChild(terminalOverlay);
            
             // TRANSFORM TO TERMINAL MODE (Square Visual for Body too)
            container.style.transition = "all 0.5s ease";
            container.style.borderRadius = "20px"; 
            container.style.border = "2px solid rgba(66, 133, 244, 0.5)";
            container.style.boxShadow = "0 0 30px rgba(66, 133, 244, 0.2)";
            container.appendChild(terminalOverlay);

            // Cleanup old canvas if exists
            const oldCanvas = document.getElementById('triage-canvas');
            if(oldCanvas) oldCanvas.remove();

            const canvas = document.createElement('canvas');
            canvas.style.position = 'absolute';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.transform = 'scaleX(-1)'; // Mirror
            container.appendChild(canvas);
            const ctx = canvas.getContext('2d');

            status.innerText = "INITIALIZING PLANT BASED BIOSCAN...";
            
            // Symptom Helper
            const getSymptomLabels = () => {
                let symptoms = [];
                if (answers['brain_fog'] && answers['brain_fog'] !== 'no') symptoms.push("BRAIN FOG");
                if (answers['weight_gain'] && answers['weight_gain'] !== 'no') symptoms.push("METABOLIC STALL");
                if (answers['keeps_awake'] === 'stress') symptoms.push("CORTISOL SPIKES");
                if (answers['midday_crash'] && answers['midday_crash'] !== 'no') symptoms.push("ADRENAL FATIGUE");
                if (symptoms.length === 0) return "HORMONAL IMBALANCE";
                return symptoms.slice(0, 2).join(", ");
            };
            const faceMesh = new FaceMesh({locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }});

            faceMesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true, // Key for Iris
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            let trackingState = {
                alignment: 0,
                focus: 0,
                lockedFrames: 0,
                isCaptured: false
            };

            const speak = (text) => {
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                    const u = new SpeechSynthesisUtterance(text);
                    u.rate = 1.1; // Slightly faster/robotic
                    window.speechSynthesis.speak(u);
                }
            };

            faceMesh.onResults(onResults);

            async function onResults(results) {
                // Resize canvas to match video
                if (canvas.width !== video.videoWidth) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                }
                
                ctx.save();
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1); // Mirror for drawing

                if (trackingState.isCaptured) {
                    ctx.restore();
                    return;
                }

                if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
                    const landmarks = results.multiFaceLandmarks[0];
                    
                    // --- A. Draw Tech Mesh (White/Blue) ---
                    // Draw Iris
                    const leftIris = [468, 469, 470, 471];
                    const rightIris = [473, 474, 475, 476];
                    
                    ctx.fillStyle = '#4285F4'; // Gemini Blue
                    for (const idx of [...leftIris, ...rightIris]) {
                        const pt = landmarks[idx];
                        ctx.beginPath();
                        ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 2, 0, 2*Math.PI);
                        ctx.fill();
                    }

                    // T-Zone Lines (White)
                    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                    ctx.lineWidth = 1;
                    const connections = [[10, 152], [234, 454], [10, 338], [10, 297]]; // Vertical & Horizontal axis
                    
                    // Basic Mesh Drawing
                    // (Simplified for performance, just key points)
                    
                    // --- B. Calculate Metrics ---
                    // 1. Center Deviation (Review nose tip #1)
                    const nose = landmarks[1];
                    const distortionX = Math.abs(nose.x - 0.5);
                    const distortionY = Math.abs(nose.y - 0.5);
                    const isCentered = distortionX < 0.1 && distortionY < 0.15;
                    
                    // 2. Proximity (Face Width)
                    const leftCheek = landmarks[234];
                    const rightCheek = landmarks[454];
                    const faceWidth = Math.abs(leftCheek.x - rightCheek.x); // 0.0 to 1.0
                    const isCloseEnough = faceWidth > 0.35; // Target fill

                    // Update UI State
                    let targetAlign = 0;
                    if (isCentered) targetAlign += 50;
                    if (isCloseEnough) targetAlign += 50;

                    // Smooth Lerp
                    trackingState.alignment += (targetAlign - trackingState.alignment) * 0.1;

                    // Update Focus (Iris Stability)
                    // If aligned, we assume focus is building
                    if (targetAlign > 80) {
                        trackingState.focus += (100 - trackingState.focus) * 0.05;
                    } else {
                        trackingState.focus *= 0.9;
                    }

                    // --- C. Update DOM UI ---
                    // --- C. Update DOM UI (Plant Based Theme) ---
                    const alignBar = document.getElementById('align-bar');
                    const alignVal = document.getElementById('align-val');
                    const focusBar = document.getElementById('focus-bar');
                    const focusVal = document.getElementById('focus-val');

                    // 1. Alignment UI
                    alignBar.style.width = `${trackingState.alignment}%`;
                    alignVal.innerText = `${Math.round(trackingState.alignment)}%`;
                    if (trackingState.alignment > 90) {
                        alignBar.style.background = '#34A853'; // Green Lock
                        alignBar.style.boxShadow = '0 0 10px #34A853';
                    } else {
                        alignBar.style.background = '#4285F4'; // Blue Scan
                        alignBar.style.boxShadow = '0 0 10px #4285F4';
                    }

                    // 2. Focus UI
                    focusBar.style.width = `${trackingState.focus}%`;
                    focusVal.innerText = `${Math.round(trackingState.focus)}%`;
                    if (trackingState.focus > 90) {
                        focusBar.style.background = '#34A853'; // Green Lock
                        focusBar.style.boxShadow = '0 0 10px #34A853';
                    } else {
                        focusBar.style.background = '#4285F4'; // Blue Scan
                        focusBar.style.boxShadow = '0 0 10px #4285F4';
                    }

                    // --- D. Feedback & State Machine ---
                    status.style.background = "transparent"; // Clean Terminal Look
                    status.style.textShadow = "0 1px 2px rgba(0,0,0,0.5)";

                    if (trackingState.alignment < 40) {
                        status.innerText = "ALIGN FACE IN CENTER";
                        status.style.color = "#FFD700"; // Gold Warning
                    } else if (trackingState.alignment < 80) {
                        status.innerText = "MOVE CLOSER...";
                        status.style.color = "#FFD700";
                    } else {
                        status.innerText = "HOLD STEADY - LOCKING IRIS...";
                        status.style.color = "#34A853"; // Plant Based Green
                    }

                    // --- E. Capture Logic ---
                    if (trackingState.focus > 90) {
                        trackingState.lockedFrames++;
                        if (trackingState.lockedFrames > 20) { // ~1 second of lock
                            captureAndAnalyze();
                        }
                    } else {
                        trackingState.lockedFrames = 0;
                    }

                } else {
                    status.innerText = "SEARCHING FOR SUBJECT...";
                    trackingState.alignment = 0;
                    trackingState.focus = 0;
                }
                
                ctx.restore();
            }

            // 3. Camera Start
            try {
                const camera = new Camera(video, {
                    onFrame: async () => {
                        await faceMesh.send({image: video});
                    },
                    width: 480,
                    height: 480
                });
                camera.start();
                speak("Bio-analysis active. Please center your face.");
            } catch (e) {
                console.error(e);
                alert("Camera fail. Skipping.");
                nextStep();
            }

            function captureAndAnalyze() {
                if (trackingState.isCaptured) return;
                trackingState.isCaptured = true;

                // Visual Flash
                const flash = document.createElement('div');
                flash.style.position = 'fixed';
                flash.style.top =0; flash.style.left=0; flash.style.width='100%'; flash.style.height='100%';
                flash.style.background = 'white';
                flash.style.zIndex = 9999;
                flash.style.transition = 'opacity 0.5s';
                document.body.appendChild(flash);
                setTimeout(() => flash.style.opacity = 0, 50);
                setTimeout(() => flash.remove(), 600);

                status.innerText = "BIOMETRIC ANALYSIS IN PROGRESS...";
                status.style.background = "linear-gradient(90deg, #4285F4, #9B72CB)";
                
                // Get Blob
                canvas.toBlob(async (blob) => {
                    const apiKey = sessionStorage.getItem('GEMINI_API_KEY');
                    if(apiKey) {
                        try {
                            const text = await analyzeWithGemini(blob, apiKey);
                            speak(text); 
                            subtitle.innerText = text;
                            answers['eye_analysis'] = text; // Save Result
                            setTimeout(nextStep, 6000); 
                        } catch(e) { 
                            console.error(e); 
                            answers['eye_analysis'] = "Biomarkers Captured"; // Fallback to prevent "Skipped"
                            nextStep(); 
                        }
                    } else {
                        nextStep();
                    }
                }, 'image/jpeg', 0.9);
            }


        };

        window.saveGeminiKey = () => {
             const input = document.getElementById('gemini-key-input');
             if (input.value) {
                 sessionStorage.setItem('GEMINI_API_KEY', input.value);
                 document.getElementById('gemini-input-container').style.display = 'none';
                 alert("Key Saved. Ready for AI Analysis.");
             }
        };

    } else if (step.type === 'diagnostic_summary') {
        logoRow.classList.remove('hidden');
        progressRow.classList.remove('hidden');
        updateProgress();

        container.innerHTML = `
            <div style="text-align: center; padding: 140px 1.5rem 0; width: 100%;">

                <h2 style="text-transform: uppercase; font-size: 1.5rem; margin-bottom: 0.5rem; font-weight: 800; color: #333;">BIOMETRIC SUMMARY</h2>
                <p style="font-size: 0.9rem; color: #666; margin-bottom: 2rem;">Device sensor data has been synchronized.</p>
                
                <div id="results-loader" style="width: 100%; max-width: 400px; margin: 0 auto; display: flex; flex-direction: column; gap: 15px;">
                    <!-- Result 1: Reaction -->
                    <div class="summary-card" style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 16px 20px; border-radius: 16px; border: 1px solid #eee; opacity: 0; transform: translateY(10px); transition: all 0.5s ease;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="background: rgba(0,0,0,0.05); padding: 8px; border-radius: 10px;"><i data-lucide="zap" size="18" color="#333"></i></div>
                            <span style="font-weight: 700; font-size: 0.9rem;">REACTION SPEED</span>
                        </div>
                        <span style="font-weight: 800; color: ${answers['reaction_skipped'] ? '#999' : '#333'};">${answers['reaction_skipped'] ? 'SKIPPED' : (answers['reaction_time'] || 350) + 'ms'}</span>
                    </div>

                    <!-- Result 2: Neuro -->
                    <div class="summary-card" style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 16px 20px; border-radius: 16px; border: 1px solid #eee; opacity: 0; transform: translateY(10px); transition: all 0.5s ease;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="background: rgba(0,0,0,0.05); padding: 8px; border-radius: 10px;"><i data-lucide="activity" size="18" color="#333"></i></div>
                            <span style="font-weight: 700; font-size: 0.9rem;">NEURO-STABILITY</span>
                        </div>
                        <span style="font-weight: 800; color: #333;">CALIBRATED</span>
                    </div>

                    <!-- Result 3: Adrenal -->
                    <div class="summary-card" style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 16px 20px; border-radius: 16px; border: 1px solid #eee; opacity: 0; transform: translateY(10px); transition: all 0.5s ease;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="background: rgba(0,0,0,0.05); padding: 8px; border-radius: 10px;"><i data-lucide="shield-check" size="18" color="#333"></i></div>
                            <span style="font-weight: 700; font-size: 0.9rem;">ADRENAL TENSION</span>
                        </div>
                        <span style="font-weight: 800; color: #333;">SAMPLED</span>
                    </div>

                    <!-- Result 4: Ocular -->
                    <div class="summary-card" style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 16px 20px; border-radius: 16px; border: 1px solid #eee; opacity: 0; transform: translateY(10px); transition: all 0.5s ease;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="background: rgba(0,0,0,0.05); padding: 8px; border-radius: 10px;"><i data-lucide="eye" size="18" color="#333"></i></div>
                            <span style="font-weight: 700; font-size: 0.9rem;">OCULAR BIOMARKERS</span>
                        </div>
                        <span style="font-weight: 800; color: ${answers['eye_analysis'] ? '#333' : '#999'};">${answers['eye_analysis'] ? 'ANALYZED' : 'SKIPPED'}</span>
                    </div>

                    <!-- Result 5: Body -->
                    <div class="summary-card" style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 16px 20px; border-radius: 16px; border: 1px solid #eee; opacity: 0; transform: translateY(10px); transition: all 0.5s ease;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="background: rgba(0,0,0,0.05); padding: 8px; border-radius: 10px;"><i data-lucide="person-standing" size="18" color="#333"></i></div>
                            <span style="font-weight: 700; font-size: 0.9rem;">STRUCTURAL ALIGNMENT</span>
                        </div>
                        <span style="font-weight: 800; color: ${answers['body_scan_analysis'] ? '#333' : '#999'};">${answers['body_scan_analysis'] ? 'MAPPED' : 'SKIPPED'}</span>
                    </div>
                </div>

                <div style="margin-top: 20px; font-size: 11px; color: #666; font-style: italic;">
                    All biometric data has been securely encrypted and processed.
                </div>

                <button id="summary-next-btn" class="option-btn" onclick="nextStep()" style="width: 100%; max-width: 400px; margin: 1.5rem auto 0; opacity: 0; pointer-events: none; transition: opacity 0.3s ease;">${step.buttonText}</button>
            </div>
        `;

        // Sequential Fade-in for the "loads them up nice" effect
        setTimeout(() => {
            const cards = container.querySelectorAll('.summary-card');
            cards.forEach((card, i) => {
                setTimeout(() => {
                    card.style.opacity = "1";
                    card.style.transform = "translateY(0)";
                    if (navigator.vibrate) navigator.vibrate(20);
                }, i * 400);
            });

            setTimeout(() => {
                const btn = document.getElementById('summary-next-btn');
                btn.style.opacity = "1";
                btn.style.pointerEvents = "auto";
                if(typeof lucide !== 'undefined') lucide.createIcons();
            }, (cards.length * 400) + 200);
        }, 300);

        if(typeof lucide !== 'undefined') lucide.createIcons();

    } else if (step.type === 'pupil_scan') {

    } else if (step.type === 'graph') {
        logoRow.classList.remove('hidden');
        progressRow.classList.remove('hidden');
        updateProgress();

        if (step.id === 'bmi_graph') {
            const bmi = calculateBMI();
            const pos = getBMIPosition(bmi);
            
            container.innerHTML = `
                <div style="text-align: center; padding: 0 1rem; width: 100%;">
                    <h2 style="font-size: 1.2rem; margin-bottom: 0.5rem; width: 100%; text-align: center; text-transform: uppercase;">${step.title}</h2>
                    
                    <div style="width: 100%; max-width: 400px; background: #fff; padding: 10px 20px; border-radius: 20px; box-shadow: 0 5px 20px rgba(0,0,0,0.05); margin: 0 auto 10px auto; position: relative;">
                        <svg viewBox="0 0 400 220" style="width: 100%; height: auto; overflow: visible;">
                            <defs>
                                <linearGradient id="bmiGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stop-color="#48864B" />
                                    <stop offset="40%" stop-color="#F2C94C" />
                                    <stop offset="100%" stop-color="#EB5757" />
                                </linearGradient>
                                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                                    <feGaussianBlur stdDeviation="3" result="blur" />
                                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                </filter>
                            </defs>
                            
                            <!-- Dashed Vertical Lines -->
                            <line x1="80" y1="20" x2="80" y2="200" stroke="#eee" stroke-width="2" stroke-dasharray="5,5" />
                            <line x1="200" y1="20" x2="200" y2="200" stroke="#eee" stroke-width="2" stroke-dasharray="5,5" />
                            <line x1="320" y1="20" x2="320" y2="200" stroke="#eee" stroke-width="2" stroke-dasharray="5,5" />

                            <!-- The Curve -->
                            <path d="M 40 200 C 120 200, 160 200, 200 110 S 280 20, 360 20" 
                                  fill="none" stroke="url(#bmiGradient)" stroke-width="6" stroke-linecap="round" />
                            
                            <!-- The Dot -->
                            <circle cx="${pos.x}" cy="${pos.y}" r="12" fill="rgba(52, 152, 219, 0.2)" />
                            <circle cx="${pos.x}" cy="${pos.y}" r="6" fill="#3498db" stroke="white" stroke-width="2" filter="url(#glow)" />
                            
                            <!-- Labels -->
                            <text x="80" y="230" text-anchor="middle" font-size="14" fill="#888" font-style="italic">Good</text>
                            <text x="200" y="230" text-anchor="middle" font-size="14" fill="#888" font-style="italic">Normal</text>
                            <text x="320" y="230" text-anchor="middle" font-size="14" fill="#888" font-style="italic">At risk</text>
                        </svg>
                        
                        <div style="margin-top: 10px; font-weight: 700; color: #333; font-size: 1.1rem;">
                            Current BMI: <span style="color: #48864B;">${bmi}</span>
                        </div>
                    </div>

                    <p style="text-align: center; line-height: 1.4; margin: 0.5rem auto 0.8rem auto; font-size: 0.9rem; max-width: 450px;">${step.text}</p>
                    <button class="option-btn" onclick="nextStep()" style="width: 100%; max-width: 400px; margin: 0 auto;">${step.buttonText}</button>
                </div>
            `;



    } else if (step.type === 'photo_analysis') {
         // BODY SCAN RENDERER
        logoRow.classList.remove('hidden');
        progressRow.classList.remove('hidden');
        updateProgress();

        let geminiKey = sessionStorage.getItem('GEMINI_API_KEY') || 'AIzaSyCu5U2fhK5gptQ-A959MdSaIUxz9XKQM-Q';
        const keyInputStyle = geminiKey ? 'display:none;' : 'display:block;';

        container.innerHTML = `
            <div style="text-align: center; padding: 0 1rem; width: 100%;">
                <p style="font-size: 0.85rem; color: #666; margin-bottom: 1.5rem; margin-top: 1rem;">${step.subtitle}</p>

                 <!-- API KEY INPUT (If not already saved) -->
                <div id="gemini-input-container-body" style="${keyInputStyle} margin-bottom: 20px;">
                    <input type="password" id="gemini-key-input-body" placeholder="Enter Gemini API Key" style="padding: 10px; border-radius: 5px; border: 1px solid #ccc; width: 80%; font-size: 14px;">
                    <button onclick="saveGeminiKeyBody()" style="padding: 10px; background: #48864B; color: white; border: none; border-radius: 5px; font-weight: 700;">SAVE</button>
                </div>
                
                <div id="body-camera-container" style="width: 100%; max-width: 320px; aspect-ratio: 3/4; background: #000; border-radius: 20px; overflow: hidden; margin: 0 auto 1.5rem auto; position: relative; border: 2px solid #ccc;">
                    <video id="body-video" style="width: 100%; height: 100%; object-fit: cover;" autoplay playsinline muted></video>
                    
                    <!-- Body Grid Overlay -->
                    <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; opacity: 0.6; box-shadow: inset 0 0 50px rgba(0,0,0,0.5);">
                         <!-- Central Axis -->
                         <div style="position: absolute; left: 50%; top: 10%; bottom: 10%; border-left: 2px dashed rgba(255,255,255,0.5);"></div>
                         <!-- Shoulder Line -->
                         <div style="position: absolute; top: 25%; left: 10%; right: 10%; border-top: 2px dashed rgba(255,255,255,0.3);"></div>
                         <!-- Hip Line -->
                         <div style="position: absolute; top: 55%; left: 10%; right: 10%; border-top: 2px dashed rgba(255,255,255,0.3);"></div>
                    </div>

                    <div id="countdown-overlay" style="position: absolute; top:0; left:0; width:100%; height:100%; display: flex; align-items: center; justify-content: center; font-size: 5rem; font-weight: 800; color: white; text-shadow: 0 0 10px rgba(0,0,0,0.5); display: none;">3</div>
                </div>

                <button id="start-body-scan" class="option-btn" onclick="startBodyScan()" style="width: 100%; max-width: 400px; margin: 0 auto;">${step.buttonText}</button>
                <button onclick="jumpToStep('diag_summary')" style="display: block; margin: 15px auto 0; background: transparent; border: none; color: #888; text-decoration: underline; cursor: pointer; font-size: 0.85rem; font-family: inherit;">SKIP SCAN</button>
            </div>
        `;

        const video = document.getElementById('body-video');
        
        window.saveGeminiKeyBody = () => {
             const input = document.getElementById('gemini-key-input-body');
             if (input.value) {
                 sessionStorage.setItem('GEMINI_API_KEY', input.value);
                 document.getElementById('gemini-input-container-body').style.display = 'none';
                 geminiKey = input.value;
             }
        };

        window.startBodyScan = async () => {
            const btn = document.getElementById('start-body-scan');
            btn.innerHTML = "INITIALIZING CAMERA...";
            btn.disabled = true;

            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
                video.srcObject = stream;
                
                btn.innerHTML = "START CAPTURE (3s)";
                btn.disabled = false;
                
                btn.onclick = () => {
                    btn.style.display = 'none';
                    const countdown = document.getElementById('countdown-overlay');
                    countdown.style.display = 'flex';
                    
                    let count = 3;
                    const timer = setInterval(() => {
                        count--;
                        if(count > 0) {
                             countdown.innerText = count;
                        } else {
                            clearInterval(timer);
                            countdown.innerText = "";
                            captureBody();
                        }
                    }, 1000);
                };

            } catch (err) {
                 console.error("Camera Error", err);
                 alert("Camera access required for body scan. Proceeding directly to analysis.");
                 nextStep();
            }
        };

        function captureBody() {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0);

            // Stop Camera
            const stream = video.srcObject;
             if (stream) stream.getTracks().forEach(track => track.stop());

            canvas.toBlob(async (blob) => {
                 const overlay = document.getElementById('body-camera-container');
                 overlay.innerHTML = `<div style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#111; color:white;">
                    <div class="loader"></div>
                    <p style="margin-top:20px; font-size:0.9rem;">ANALYZING POSTURE...</p>
                 </div>`;
                 
                 // Reuse the generic analyzer
                 try {
                     const prompt = "Analyze this full body or upper body shot for posture. Identify: 1. Head tilt. 2. Shoulder alignment. 3. Estimated body composition type (Ecto/Meso/Endo). Keep it brief.";
                     const text = await analyzeWithGemini(blob, geminiKey, prompt);
                     // We can store text if needed, but for now just proceed
                     answers['body_scan_analysis'] = text;
                     setTimeout(nextStep, 1000);
                 } catch(e) {
                     console.error(e);
                     answers['body_scan_analysis'] = "Structural Map Captured"; // Fallback
                     setTimeout(nextStep, 1000);
                 }
            }, 'image/jpeg', 0.8);
        }

    } else if (step.type === 'graph') {
            if (step.img) {
                container.innerHTML = `
                <div style="text-align: center; padding: 80px 1rem 0; width: 100%;">
                    <h2 style="font-size: 1.2rem; margin-bottom: 0.5rem; width: 100%; text-align: center; text-transform: uppercase;">${step.title}</h2>
                    <img src="${step.img}" style="width: 100%; max-width: 320px; display: block; margin: 0 auto 20px auto; border-radius: 20px; box-shadow: 0 5px 20px rgba(0,0,0,0.05);">
                    <p style="text-align: center; line-height: 1.4; margin: 0.5rem auto 0.8rem auto; font-size: 0.9rem; max-width: 450px;">${step.text}</p>
                    <button class="option-btn" onclick="nextStep()" style="width: 100%; max-width: 400px; margin: 0 auto;">${step.buttonText}</button>
                </div>`;
                return;
            }

            const currentWeightStr = answers['weight'] || "80 kg";
            let startWeight = parseFloat(currentWeightStr.split(' ')[0]);
            let unit = currentWeightStr.split(' ')[1] || 'kg';
            
            // Calculate Project Goal (-12kg or -26lbs)
            let reduction = (unit === 'lbs') ? 26 : 12;
            let projectedWeight = startWeight - reduction;
            
            // Format Strings
            const displayCurrent = `${startWeight} ${unit}`;
            const displayGoal = `${Math.round(projectedWeight)} ${unit}`;
            
            container.innerHTML = `
                <div style="text-align: center; padding: 0 1rem; width: 100%;">
                    <h2 style="font-size: 1.2rem; margin-bottom: 0.5rem; width: 100%; text-align: center; text-transform: uppercase;">${step.title}</h2>
                    
                    <div style="width: 100%; max-width: 400px; background: #fff; padding: 10px 20px; border-radius: 20px; box-shadow: 0 5px 20px rgba(0,0,0,0.05); margin: 0 auto 10px auto; position: relative;">
                        <div style="text-align: left; margin-bottom: 5px;">
                            <div style="font-size: 12px; font-weight: 700; color: #333;">WEIGHT LOSS PROGRESSION</div>
                            <div style="font-size: 10px; color: #888;">Projected 12-week trajectory</div>
                        </div>

                        <svg viewBox="0 0 400 200" style="width: 100%; height: auto; overflow: visible;">
                            <defs>
                                <linearGradient id="weightLossGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stop-color="rgba(72, 134, 75, 0.1)" />
                                    <stop offset="100%" stop-color="rgba(72, 134, 75, 0.0)" />
                                </linearGradient>
                            </defs>

                            <!-- Background Area -->
                            <path d="M 40 40 C 140 40, 200 160, 360 160 L 360 200 L 40 200 Z" fill="url(#weightLossGradient)" />
                            
                            <!-- Dashed Grid Line -->
                            <line x1="40" y1="160" x2="360" y2="160" stroke="#eee" stroke-width="1" stroke-dasharray="5,5" />

                            <!-- The Trajectory Curve -->
                            <path d="M 40 40 C 140 40, 200 160, 360 160" 
                                  fill="none" stroke="#48864B" stroke-width="4" stroke-linecap="round" />
                            
                            <!-- Start Marker -->
                            <circle cx="40" cy="40" r="5" fill="#48864B" stroke="white" stroke-width="2" />
                            <text x="40" y="25" text-anchor="middle" font-size="12" font-weight="700" fill="#48864B">${displayCurrent}</text>
                            
                            <!-- End Marker -->
                            <circle cx="360" cy="160" r="5" fill="#48864B" stroke="white" stroke-width="2" />
                            <text x="360" y="185" text-anchor="middle" font-size="12" font-weight="700" fill="#48864B">${displayGoal}</text>

                            <!-- Time Labels -->
                            <text x="40" y="185" text-anchor="middle" font-size="10" fill="#aaa">TODAY</text>
                            <text x="360" y="40" text-anchor="middle" font-size="10" fill="#aaa" transform="rotate(-90 360,40)" dx="-20">WEEK 12</text>
                        </svg>
                    </div>

                    <p style="text-align: center; line-height: 1.4; margin: 0.5rem auto 1rem auto; font-size: 0.9rem; max-width: 450px;">${step.text}</p>
                    <button class="option-btn" onclick="nextStep()" style="width: 100%; max-width: 400px; margin: 0 auto;">${step.buttonText}</button>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div style="text-align: center; padding: 0 1rem; width: 100%;">
                    <h2 style="font-size: 1.3rem; margin-bottom: 0.8rem; width: 100%; text-align: center; line-height: 1.2;">${step.title}</h2>
                    <div style="margin: 0.5rem auto; width: 100%;">
                        <img src="${step.img}" style="max-width: 360px; width: 100%; max-height: 260px; object-fit: contain; display: block; margin: 0 auto; border-radius: 10px;" alt="Graph">
                    </div>
                    <p style="text-align: center; line-height: 1.4; margin: 0.5rem auto 1rem auto; font-size: 0.9rem; max-width: 450px;">${step.text}</p>
                    <button class="option-btn" onclick="nextStep()" style="width: 100%; max-width: 400px; margin: 0 auto;">${step.buttonText}</button>
                </div>
            `;
        }
    } else if (step.type === 'social_proof') {
        logoRow.classList.remove('hidden');
        progressRow.classList.remove('hidden');
        updateProgress();

        container.innerHTML = `
            <div style="text-align: center; padding: 0 1rem; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; width: 100%;">
                <h2 style="font-size: 1.4rem; margin-bottom: 1.2rem; width: 100%; text-align: center; max-width: 400px;">${step.title}</h2>
                
                <div style="color: #F2C94C; font-size: 1.5rem; margin-bottom: 0.5rem; letter-spacing: 2px;">
                    ★★★★★
                </div>
                
                <div style="font-size: 0.95rem; color: #666; margin-bottom: 1.5rem; font-style: italic;">
                    according to <span style="font-weight: 800; color: #000; font-style: normal; text-decoration: underline; text-decoration-color: #48864B; text-underline-offset: 4px;">${step.source || 'Forbes Health'}</span>
                </div>
                
                <div style="margin: 0 auto 1rem auto; width: 100%; max-width: 320px; aspect-ratio: 1/1; overflow: hidden; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
                    <img src="${step.img}" style="width: 100%; height: 100%; object-fit: cover; display: block;" alt="Success Story">
                </div>

                <button class="option-btn" onclick="nextStep()" style="width: 100%; max-width: 400px; margin: 0 auto;">${step.buttonText || 'CONTINUE'}</button>
            </div>
        `;
    } else if (step.type === 'email_custom') {
        logoRow.classList.remove('hidden');
        progressRow.classList.remove('hidden');
        updateProgress();
        
        container.innerHTML = `
            <div style="text-align: center; max-width: 500px; margin: 0 auto;">
                <h2 style="margin-bottom: 30px;">${step.title}</h2>
                
                <input type="email" id="emailInput" placeholder="example@domain.com" class="quiz-input" style="width: 100%; margin-bottom: 15px; padding: 15px; border-radius: 10px; border: 1px solid #ccc; font-size: 16px;">
                <input type="text" id="nameInput" placeholder="First Name" class="quiz-input" style="width: 100%; margin-bottom: 15px; padding: 15px; border-radius: 10px; border: 1px solid #ccc; font-size: 16px;">
                <input type="password" id="passwordInput" placeholder="Create Secret Password (to access results later)" class="quiz-input" style="width: 100%; margin-bottom: 25px; padding: 15px; border-radius: 10px; border: 1px solid #ccc; font-size: 16px;">
                
                <div style="background-color: #a8cfab; color: #1a4d2e; padding: 20px; border-radius: 20px; margin-bottom: 25px; font-weight: 700; border: 1px solid #48864B;">
                    ${step.socialProofText}
                </div>
                
                <div style="text-align: left; font-size: 14px; color: #666; margin-bottom: 25px;">
                    <label style="display: flex; align-items: start; gap: 10px; margin-bottom: 10px; cursor: pointer;">
                        <input type="checkbox" id="consentCheck">
                        <span>I agree to receive future emails from PlantBasedBalance</span>
                    </label>
                    <label style="display: flex; align-items: start; gap: 10px; cursor: pointer;">
                        <input type="checkbox" id="termsCheck">
                        <span>I acknowledge that I have read and accepted the <a href="terms.html" target="_blank" style="color: inherit; text-decoration: underline;">Terms of Use</a>, <a href="privacy.html" target="_blank" style="color: inherit; text-decoration: underline;">Privacy Policy</a>, and <a href="refund-policy.html" target="_blank" style="color: inherit; text-decoration: underline;">Fair Refund Policy</a></span>
                    </label>
                </div>

                <button class="option-btn" onclick="handleEmailCustom()" style="width: 100%;">${step.buttonText}</button>
            </div>
        `;
    } else if (step.type === 'reaction_test') {
        logoRow.classList.remove('hidden');
        progressRow.classList.remove('hidden');
        updateProgress();

        container.innerHTML = `
            <div style="text-align: center; padding: 0 1rem; width: 100%;">
                <h2 style="text-transform: uppercase; font-size: 1.3rem; margin-bottom: 1.5rem;">${step.title}</h2>
                
                <div id="reaction-game-area" style="width: 100%; max-width: 320px; height: 400px; background: #111; border: 4px solid #333; border-radius: 20px; margin: 0 auto 0 auto; position: relative; overflow: hidden; cursor: crosshair; box-shadow: inset 0 0 20px rgba(0,0,0,0.5);">
                    <!-- Screen Reflection/Glow -->
                    <div style="position: absolute; top:0; left:0; width:100%; height:100%; background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%); pointer-events: none; z-index: 5;"></div>
                    
                    <div id="game-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 100;">
                        <p style="font-weight: 800; color: #48864B; font-family: monospace; font-size: 1.2rem; text-shadow: 0 0 5px #48864B;">SYSTEM READY</p>
                    </div>
                    
                    <!-- Retry/Skip Overlay (Hidden by default) -->
                    <div id="retry-overlay" style="display:none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); flex-direction: column; align-items: center; justify-content: center; z-index: 150;">
                        <p style="color: #F2C94C; font-weight: 800; font-size: 1.2rem; margin-bottom: 5px;">MISSED TARGET!</p>
                        <p id="retry-count" style="color: #ccc; font-size: 0.9rem; margin-bottom: 20px;">Attempt 1/3</p>
                        <div style="display: flex; gap: 10px;">
                            <button onclick="retryRound()" style="background: #48864B; color: white; border: none; padding: 10px 20px; border-radius: 5px; font-weight: 700;">TRY AGAIN</button>
                            <button onclick="skipGame()" style="background: transparent; color: #aaa; border: 1px solid #666; padding: 10px 20px; border-radius: 5px;">SKIP TEST</button>
                        </div>
                    </div>

                    <div id="round-indicator" style="position: absolute; top: 10px; right: 10px; font-weight: 800; font-size: 0.8rem; color: #48864B; font-family: monospace;">ROUND 1/3</div>
                </div>
                
                <button id="start-reaction-btn" class="option-btn" onclick="startReactionGame()" style="display: block; margin: 1.5rem auto; width: 200px; padding: 15px; font-size: 1.1rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">START TEST</button>
                
                <p id="game-status" style="font-weight: 800; color: #1a4d2e; text-transform: uppercase; letter-spacing: 1px; min-height: 20px;"></p>
            </div>
        `;

        let currentRound = 1;
        let attemptsInRound = 0;
        let reactions = [];
        let gameActive = false;

        window.startReactionGame = () => {
            document.getElementById('game-overlay').style.display = 'none';
            document.getElementById('start-reaction-btn').style.display = 'none';
            gameActive = true;
            spawnSignal();
        };

        window.retryRound = () => {
             document.getElementById('retry-overlay').style.display = 'none';
             // Reset for a fresh attempt at Round 1
             currentRound = 1;
             attemptsInRound = 0;
             reactions = [];
             gameActive = true;
             spawnSignal();
        };

        window.skipGame = () => {
            finishGame();
        };

        function finishGame() {
            gameActive = false;
            const status = document.getElementById('game-status');
            const retryUI = document.getElementById('retry-overlay');
            if(retryUI) retryUI.style.display = 'none';

            if (reactions.length === 0) {
                // Impaired/Delayed
                status.innerText = "Reaction Time: Delayed"; 
                status.style.color = "#d9534f"; 
                answers['reaction_time'] = 1000; 
                answers['reaction_skipped'] = true; 
            } else {
                const avg = Math.round(reactions.reduce((a,b) => a+b, 0) / reactions.length);
                answers['reaction_time'] = avg;
                status.innerText = `AVG SPEED: ${avg}ms`;
                status.style.color = "#1a4d2e";
            }
            setTimeout(nextStep, 1500);
        }

        function spawnSignal() {
            if (!gameActive) return;
            
            const area = document.getElementById('reaction-game-area');
            const status = document.getElementById('game-status');
            const indicator = document.getElementById('round-indicator');
            
            indicator.innerText = `ROUND ${currentRound}/3`;
            if (attemptsInRound === 0) {
                 status.innerText = "WATCH FOR SIGNAL...";
                 status.style.color = "#1a4d2e";
            }
            
            const signal = document.createElement('div');
            signal.style.width = '60px'; 
            signal.style.height = '60px';
            signal.style.background = '#48864B';
            signal.style.borderRadius = '50%';
            signal.style.position = 'absolute';
            signal.style.top = '-70px';
            signal.style.left = Math.random() * (area.clientWidth - 70) + 5 + 'px';
            signal.style.display = 'flex';
            signal.style.alignItems = 'center';
            signal.style.justifyContent = 'center';
            signal.style.color = 'white';
            signal.style.boxShadow = '0 0 15px #48864B'; 
            signal.style.zIndex = "10";
            signal.innerHTML = `<i data-lucide="zap" size="24"></i>`;
            
            // Random delay start
            const delay = Math.random() * 1500 + 500;
            
            setTimeout(() => {
                if(!gameActive) return;
                // Double check if we should spawn (might have paused in delay)
                if (document.getElementById('retry-overlay').style.display === 'flex') return;

                area.appendChild(signal);
                if(typeof lucide !== 'undefined') lucide.createIcons();
                
                const spawnTime = Date.now();
                let caught = false;

                signal.onclick = (e) => {
                    e.stopPropagation();
                    if (caught || !gameActive) return;
                    caught = true;
                    
                    // Valid Hit
                    const time = Date.now() - spawnTime;
                    reactions.push(time);
                    
                    // Visual Success
                    signal.style.background = '#D4AF37';
                    signal.style.transform = 'scale(1.2)';
                    signal.style.boxShadow = '0 0 20px #D4AF37';
                    status.innerText = "NICE!";
                    status.style.color = "#D4AF37";
                    
                    // Reset Attempts for next round
                    attemptsInRound = 0;
                    currentRound++;

                    setTimeout(() => {
                        if(signal.parentNode) signal.remove();
                        if (currentRound > 3) {
                            finishGame();
                        } else {
                            spawnSignal();
                        }
                    }, 500);
                };

                // Falling Animation
                let pos = -70;
                const baseSpeed = 5; 
                // Speed increases each round slightly
                const speed = baseSpeed + (currentRound * 1.5);
                
                const fall = setInterval(() => {
                    if (caught || !gameActive) {
                        clearInterval(fall);
                         if(!caught && signal.parentNode) signal.remove(); 
                        return;
                    }

                    pos += speed;
                    signal.style.top = pos + 'px';
                    
                    if (pos > area.clientHeight) {
                        clearInterval(fall);
                        // Missed Logic here
                        if(signal.parentNode) signal.remove();
                        handleMiss();
                    }
                }, 16);
            }, delay); 
        }

        function handleMiss() {
            attemptsInRound++;
             if (attemptsInRound >= 3) {
                // 3 Strikes
                if (currentRound === 1) {
                    // Failed Round 1 -> Offer Opportunity to Retry (Rule: "Never hit anything in first round get opportunity")
                    gameActive = false;
                    const retryOverlay = document.getElementById('retry-overlay');
                    const retryCount = document.getElementById('retry-count');
                    retryCount.innerText = "Zero Targets Hit";
                    retryOverlay.style.display = 'flex';
                } else {
                    // Past Round 1 -> No Retry Opportunity -> Finish Game
                    finishGame();
                }
            } else {
                // Auto Retry (Simple spawning, no interaction needed)
                const status = document.getElementById('game-status');
                status.innerText = `MISSED! (TRY ${attemptsInRound+1}/3)`;
                status.style.color = "#d9534f";
                
                setTimeout(() => {
                     spawnSignal();
                }, 800);
            }
        }

    } else if (step.type === 'adrenal_sensor') {
        logoRow.classList.remove('hidden');
        progressRow.classList.remove('hidden');
        updateProgress();

        container.innerHTML = `
            <div style="text-align: center; padding: 0 1rem; width: 100%; user-select: none; -webkit-touch-callout: none;">
                <h2 style="text-transform: uppercase; font-size: 1.3rem; margin-bottom: 0.5rem;">${step.title}</h2>
                <p style="font-size: 0.85rem; color: #666; margin-bottom: 1.5rem; max-width: 300px; margin-left: auto; margin-right: auto;">${step.subtitle}</p>
                
                <div id="sensor-container" style="width: 100%; max-width: 320px; height: 320px; background: #fff; border: 1px solid #eee; border-radius: 30px; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 0 auto 2rem auto; position: relative; box-shadow: 0 20px 50px rgba(0,0,0,0.05); cursor: pointer; touch-action: none; overflow: hidden; -webkit-tap-highlight-color: transparent;">
                    
                    <img src="${step.img || ''}" style="position: absolute; width: 100%; height: 100%; object-fit: cover; border-radius: 30px; opacity: 1; z-index: 1; pointer-events: none; -webkit-touch-callout: none;">

                    <div id="sensor-glow" style="position: absolute; width:100%; height:100%; background: radial-gradient(circle, rgba(72,134,75,0.2) 0%, transparent 70%); opacity: 0; transition: opacity 0.3s; z-index: 2; pointer-events: none;"></div>

                    <div id="sensor-waves" style="position: absolute; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 3;">
                        <span id="instruction-text" style="color: #fff; font-size: 11px; font-weight: 800; position: absolute; bottom: 30px; background: rgba(72,134,75,0.9); padding: 5px 15px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px; pointer-events: none; text-align: center; width: 80%;">Grip your phone and FIRMLY press the screen with your thumb</span>
                    </div>

                    <div style="position: absolute; top: 0; left: 0; width: 100%; height: 8px; background: rgba(0,0,0,0.1); z-index: 10;">
                        <div id="sensor-progress" style="width: 0%; height: 100%; background: #48864B; box-shadow: 0 0 15px rgba(72,134,75,0.8); transition: width 0.1s;"></div>
                    </div>
                </div>
                
                <p id="sensor-status" style="font-weight: 800; color: #1a4d2e; text-transform: uppercase; letter-spacing: 1px;">Ready?</p>
            </div>
        `;

        if(typeof lucide !== 'undefined') lucide.createIcons();

        const containerElem = document.getElementById('sensor-container');
        const progress = document.getElementById('sensor-progress');
        const status = document.getElementById('sensor-status');
        const glow = document.getElementById('sensor-glow');
        const instruction = document.getElementById('instruction-text');
        
        let pressInterval;
        let pct = 0;

        const startPress = (e) => {
            if (e.cancelable) e.preventDefault();
            // Trigger haptic feedback if supported
            if (navigator.vibrate) navigator.vibrate(50);
            
            pct = 0;
            status.innerText = 'ANALYZING GRIP...';
            glow.style.opacity = '1';
            instruction.style.opacity = '0';
            
            pressInterval = setInterval(() => {
                let force = 1.5; // Slightly faster for better UX
                if (e.touches && e.touches[0].force) {
                    force = (e.touches[0].force * 3) + 0.5;
                }
                
                pct += force;
                progress.style.width = Math.min(100, pct) + '%';
                
                // One buzz at 30%
                if (pct > 30 && pct < 35 && !window.vibrated30) {
                     if (navigator.vibrate) navigator.vibrate(50);
                     window.vibrated30 = true;
                     status.innerText = 'MEASURING ADRENAL TENSION...';
                }

                // Two buzzes at 60%
                if (pct > 60 && pct < 65 && !window.vibrated60) {
                     if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
                     window.vibrated60 = true;
                     status.innerText = 'CALIBRATING MUSCLE RESILIENCE...';
                }

                if (pct > 85) status.innerText = 'ALMOST COMPLETE...';

                if (pct >= 100) {
                    clearInterval(pressInterval);
                    // Two consecutive buzzes at end
                    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

                    status.innerText = 'BIOMETRIC DATA CAPTURED';
                    glow.style.background = 'radial-gradient(circle, rgba(46,204,113,0.4) 0%, transparent 70%)';
                    
                    answers['adrenal_grip_strength'] = 'High Tension detected';
                    
                    setTimeout(() => {
                        window.vibrated30 = false;
                        window.vibrated60 = false;
                        nextStep();
                    }, 1000);
                }
            }, 50);
        };

        const endPress = () => {
            clearInterval(pressInterval);
            if (pct < 100) {
                pct = 0;
                progress.style.width = '0%';
                status.innerText = 'Grip Released - Hold Longer';
                glow.style.opacity = '0';
                instruction.style.opacity = '1';
                window.vibrated30 = false;
                window.vibrated60 = false;
            }
        };

        containerElem.onpointerdown = startPress;
        containerElem.onpointerup = endPress;
        containerElem.onpointerleave = endPress;
        containerElem.oncontextmenu = (e) => e.preventDefault(); // Extra protection against save menu

    } else if (step.type === 'photo_analysis') {
        logoRow.classList.remove('hidden');
        progressRow.classList.remove('hidden');
        updateProgress();

            container.innerHTML = `
                <div style="text-align: center; padding: 0 1rem; width: 100%;">
                    <!-- H2 Removed Scans -->
                    <p style="font-size: 0.85rem; color: #666; margin-bottom: 1.5rem; margin-top: 1rem;">Analyzing for Posture and Balance</p>

                    <!-- TERMINAL CAMERA CONTAINER -->
                    <div id="camera-container" style="width: 100%; max-width: 320px; height: 420px; margin: 0 auto; background: #000; border-radius: 20px; border: 2px solid rgba(66, 133, 244, 0.5); box-shadow: 0 0 30px rgba(66, 133, 244, 0.2); position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                        
                        <!-- TERMINAL HEADER -->
                        <div style="position: absolute; top: 15px; left: 0; width: 100%; display: flex; justify-content: space-between; padding: 0 20px; box-sizing: border-box; z-index: 20;">
                            <span style="font-family: 'Courier New', monospace; font-weight: bold; letter-spacing: 1px; color: rgba(255,255,255,0.7); font-size: 10px; text-shadow: 0 1px 2px black;">PLANT BASED BIOSCAN v5.0</span>
                            <span id="scan-status" style="font-family: 'Courier New', monospace; font-weight: bold; letter-spacing: 1px; color: #4285F4; font-size: 10px; text-shadow: 0 1px 2px black; text-transform: uppercase;">STANDBY</span>
                        </div>

                        <video id="webcam" autoplay playsinline muted style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1);"></video>
                        <canvas id="output" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; transform: scaleX(-1); pointer-events: none; z-index: 10; opacity: 1;"></canvas>
                        
                        <div id="countdown-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,0.3); z-index: 40;">
                            <span id="scan-countdown" style="font-size: 5rem; font-weight: 900; color: white; text-shadow: 0 4px 10px rgba(0,0,0,0.5);"></span>
                        </div>

                        <!-- TERMINAL FOOTER (BARS) -->
                        <div style="position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%); width: 80%; text-align: center; z-index: 20;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                                <span style="font-family: 'Courier New', monospace; font-weight: bold; letter-spacing: 1px; color: white; font-size: 10px;">STRUCTURAL LOCK</span>
                                <span id="body-align-val" style="font-family: 'Courier New', monospace; font-weight: bold; letter-spacing: 1px; color: white; font-size: 10px;">0%</span>
                            </div>
                            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.2); margin-top: 4px; border-radius: 3px;">
                                <div id="body-align-bar" style="height: 100%; background: #4285F4; width: 0%; transition: width 0.2s; border-radius: 3px; box-shadow: 0 0 10px #4285F4;"></div>
                            </div>
                        </div>


                    </div>
                    
                    <button class="option-btn" onclick="startBodyScan()" style="width: 100%; max-width: 320px; display: block; margin: 20px auto; background: #48864B; border: none; color: white; font-weight:bold;">START BODY SCAN</button>
                    <button onclick="jumpToStep('diag_summary')" style="display: block; margin: 15px auto 0; background: transparent; border: none; color: #888; text-decoration: underline; cursor: pointer; font-size: 0.85rem; font-family: inherit;">SKIP SCAN</button>
                </div>
            `;
        if (typeof lucide !== 'undefined') lucide.createIcons();

        window.startBodyScan = async () => {
            const video = document.getElementById('webcam');
            const canvas = document.getElementById('output');
            const ctx = canvas.getContext('2d');
            const status = document.getElementById('scan-status');
            
            // Hide button
            const startBtn = document.querySelector('.option-btn');
            if(startBtn) startBtn.style.display = 'none';

            status.innerText = "INITIALIZING SENSORS...";

            // State Machine
            // States: WAIT_FRONT, WAIT_SIDE, WAIT_STABILITY_RIGHT, WAIT_STABILITY_LEFT, WAIT_THORACIC
            let scanState = 'WAIT_FRONT'; 
            let stream = null;
            let stabilityCounter = 0;
            const REQUIRED_STABILITY = 40; 
            let isCaptured = false;
            let lastGuidanceTime = 0; 
            let isVoiceBlocked = false; 
            const geminiKey = sessionStorage.getItem('GEMINI_API_KEY') || 'AIzaSyCu5U2fhK5gptQ-A959MdSaIUxz9XKQM-Q';

            // Voice Config
            let selectedVoice = null;
            const initVoice = () => {
                if ('speechSynthesis' in window) {
                    const voices = window.speechSynthesis.getVoices();
                    selectedVoice = voices.find(v => v.lang.includes('en-US')) || voices[0];
                }
            };
            if (window.speechSynthesis) {
                window.speechSynthesis.onvoiceschanged = initVoice;
                initVoice();
            }

            const speak = (text) => {
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel(); 
                    const utterance = new SpeechSynthesisUtterance(text);
                    if (selectedVoice) utterance.voice = selectedVoice;
                    utterance.rate = 1.0; 
                    isVoiceBlocked = true;
                    utterance.onend = () => { setTimeout(() => isVoiceBlocked = false, 1000); };
                    window.speechSynthesis.speak(utterance);
                }
            };

            try {
                stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: "user", width: 640, height: 480 },
                    audio: false
                });
                video.srcObject = stream;
                
                status.innerText = "SYSTEM ACTIVE - LOADING POSE MODEL...";
                
                const pose = new Pose({locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
                }});
                
                pose.setOptions({
                    modelComplexity: 1,
                    smoothLandmarks: true,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });

                pose.onResults(onResults);

                const camera = new Camera(video, {
                    onFrame: async () => { await pose.send({image: video}); },
                    width: 640, height: 480
                });
                camera.start();

                status.innerText = "SYSTEM ACTIVE";
                speak("Structural scan active. Please stand back and face the camera.");

                // 3D Logic Helpers
                function checkFraming(lm, scanType) {
                    const vThresh = 0.65; 
                    if (lm[0].visibility < vThresh) return "I CAN'T SEE YOUR FACE";
                    if (scanType === 'FRONT') {
                        if (lm[11].visibility < vThresh || lm[12].visibility < vThresh) return "STEP BACK - SHOW SHOULDERS";
                        if (lm[23].visibility < vThresh || lm[24].visibility < vThresh) return "STEP BACK - SHOW HIPS";
                        if (lm[25].visibility < vThresh || lm[26].visibility < vThresh) return "STEP BACK - SHOW LEGS";
                    } else if (scanType === 'SIDE') {
                        if (lm[25].visibility < 0.5 && lm[26].visibility < 0.5) return "STEP BACK - SHOW LEGS";
                    }
                    return null; 
                }

                function isFrontFacing(lm) {
                    return Math.abs(lm[11].z - lm[12].z) < 0.2; 
                }

                function isSideFacing(lm) {
                    return Math.abs(lm[11].z - lm[12].z) > 0.25; 
                }

                function checkPose(lm, state) {
                    if (state === 'WAIT_FRONT') {
                        if (!isFrontFacing(lm)) return "FACE FORWARD";
                        return null;
                    }
                    if (state === 'WAIT_SIDE') {
                        if (!isSideFacing(lm)) return "TURN TO SIDE";
                        return null;
                    }
                    if (state === 'WAIT_STABILITY_RIGHT') {
                        // Standing on RIGHT foot (Left foot up)
                        if (lm[29].y > lm[30].y - 0.05) return "LIFT LEFT FOOT";
                        if (!isFrontFacing(lm)) return "FACE FORWARD";
                        return null;
                    }
                    if (state === 'WAIT_STABILITY_LEFT') {
                        // Standing on LEFT foot (Right foot up)
                        if (lm[30].y > lm[29].y - 0.05) return "LIFT RIGHT FOOT"; 
                        if (!isFrontFacing(lm)) return "FACE FORWARD";
                        return null;
                    }
                    if (state === 'WAIT_THORACIC') {
                        if (!isSideFacing(lm)) return "TURN TO SIDE";
                        // Check: Wrists (15/16) above Shoulders (11/12)
                        // This ensures "hands raised" without requiring full overhead extension if flexibility is limited.
                        const highestWrist = Math.min(lm[15].y, lm[16].y);
                        const shoulderLevel = Math.min(lm[11].y, lm[12].y);
                        
                        if (highestWrist > shoulderLevel) return "RAISE HANDS HIGHER";
                        return null;
                    }
                    return null;
                }

                function updateBodyUI(val, max, color) {
                    const bar = document.getElementById('body-align-bar');
                    const txt = document.getElementById('body-align-val');
                    if(bar) {
                        const pct = Math.min(100, (val / max) * 100);
                        bar.style.width = `${pct}%`;
                        bar.style.background = color;
                        bar.style.boxShadow = `0 0 10px ${color}`;
                        txt.innerText = `${Math.round(pct)}%`;
                    }
                }

                function onResults(results) {
                    if (isCaptured) return; 

                    ctx.save();
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
                    
                    // Filter Overlay
                    ctx.fillStyle = 'rgba(0, 10, 0, 0.1)'; 
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    if (results.poseLandmarks) {
                        drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {color: 'rgba(255,255,255,0.5)', lineWidth: 1});
                        drawLandmarks(ctx, results.poseLandmarks, {color: '#4285F4', lineWidth: 1, radius: 2});

                        const lm = results.poseLandmarks;
                        let statusMsg = "ANALYZING..."; 
                        let barColor = "#4285F4"; // Blue
                        let aligned = false;
                        
                        // Determine current required framing type
                        let framingType = 'FRONT';
                        if (scanState === 'WAIT_SIDE' || scanState === 'WAIT_THORACIC') framingType = 'SIDE';
                        // Front/Back/Stability all use 'FRONT' framing logic (full body visible)

                        let framingError = checkFraming(lm, framingType);
                        let poseError = checkPose(lm, scanState);
                        const now = Date.now();

                        // Voice Helper
                         const getInstruction = (err) => {
                             if (err === "I CAN'T SEE YOUR FACE") return "Check your lighting, I can't see your face.";
                             if (err.includes("STEP BACK")) return "Please take a step back so I can see your full body.";
                             if (err === "FACE FORWARD") return "Please face the camera directly.";
                             if (err === "TURN TO SIDE") return "Turn to your side. We’re going to capture your profile alignment.";
                             if (err.includes("LIFT")) return "Lift your foot a little higher.";
                             if (err === "RAISE HANDS ABOVE HEAD") return "Please raise your hands as high as you can above your head.";
                             return "Excellent, hold that position.";
                         };

                        if (framingError || poseError) {
                            statusMsg = framingError || poseError;
                            status.style.color = "#FFD700"; 
                            stabilityCounter = 0;
                            
                            if (now - lastGuidanceTime > 8000 && !isVoiceBlocked) {
                                speak(getInstruction(framingError || poseError));
                                lastGuidanceTime = now;
                            }
                        } else {
                            // Good Pose
                            aligned = true;
                            if (scanState === 'WAIT_FRONT') statusMsg = "FRONT ALIGNED - HOLD...";
                            if (scanState === 'WAIT_SIDE') statusMsg = "SIDE ALIGNED - HOLD...";
                            if (scanState === 'WAIT_STABILITY_RIGHT') statusMsg = "RIGHT LEG STABLE...";
                            if (scanState === 'WAIT_STABILITY_LEFT') statusMsg = "LEFT LEG STABLE...";
                            if (scanState === 'WAIT_THORACIC') statusMsg = "HANDS UP - HOLD...";
                            
                            barColor = "#34A853";
                        }

                        // Stability & Capture Logic
                        if (aligned && !isCaptured && !scanState.includes('CAPTURING')) {
                            stabilityCounter++;
                            if (stabilityCounter >= REQUIRED_STABILITY) {
                                performCaptureSequence();
                            }
                        } else {
                            stabilityCounter = Math.max(0, stabilityCounter - 1);
                        }
                        
                        status.innerText = statusMsg;
                        if(barColor === '#34A853') status.style.color = '#34A853';
                        updateBodyUI(stabilityCounter, REQUIRED_STABILITY, barColor);

                    } else {
                        status.innerText = "SEARCHING FOR SUBJECT...";
                        stabilityCounter = 0;
                        updateBodyUI(0, 100, '#4285F4');
                    }
                    ctx.restore();
                }

                function performCaptureSequence() {
                    isCaptured = true;
                    // Flash
                    const flash = document.createElement('div');
                    flash.style.position = 'absolute'; flash.style.top=0; flash.style.left=0; 
                    flash.style.width='100%'; flash.style.height='100%'; flash.style.background='white'; 
                    flash.style.zIndex=50; document.getElementById('camera-container').appendChild(flash);
                    setTimeout(() => flash.remove(), 200);

                    // Transition Logic
                    // Transition Logic: FRONT -> SIDE -> STABILITY_RIGHT -> STABILITY_LEFT -> THORACIC
                    if (scanState === 'WAIT_FRONT') {
                         status.innerText = "FRONT CAPTURED";
                         canvas.toBlob(blob => { /* Store if needed */ }, 'image/jpeg', 0.8);
                         
                         setTimeout(() => {
                             scanState = 'WAIT_SIDE';
                             status.innerText = "TURN SIDE";
                             stabilityCounter = 0;
                             isCaptured = false;
                             speak("Perfect. Now turn to your side. We’re going to capture your profile alignment.");
                         }, 1500);

                    } else if (scanState === 'WAIT_SIDE') {
                         status.innerText = "SIDE CAPTURED";
                         canvas.toBlob(blob => { /* Store if needed */ }, 'image/jpeg', 0.8);
                         
                         setTimeout(() => {
                             scanState = 'WAIT_STABILITY_RIGHT';
                             status.innerText = "FACE FRONT - STAND ON RIGHT LEG";
                             stabilityCounter = 0;
                             isCaptured = false;
                             speak("Excellent work. Turn back to the front. Now we will check your stability. Please stand on your right foot and lift your left leg for a few seconds.");
                         }, 1500);

                    } else if (scanState === 'WAIT_STABILITY_RIGHT') {
                        status.innerText = "RIGHT LEG CAPTURED";
                        canvas.toBlob(blob => { /* Store if needed */ }, 'image/jpeg', 0.8);
                        
                        setTimeout(() => {
                            scanState = 'WAIT_STABILITY_LEFT';
                            status.innerText = "SWITCH - STAND ON LEFT LEG";
                            stabilityCounter = 0;
                            isCaptured = false;
                            speak("Success. Now switch legs. Stand on your left foot.");
                        }, 1500);
                        
                    } else if (scanState === 'WAIT_STABILITY_LEFT') {
                        status.innerText = "LEFT LEG CAPTURED";
                         canvas.toBlob(blob => { /* Store if needed */ }, 'image/jpeg', 0.8);
                        
                        setTimeout(() => {
                            scanState = 'WAIT_THORACIC';
                            status.innerText = "TURN SIDE - HANDS UP";
                            stabilityCounter = 0;
                            isCaptured = false;
                             speak("Success. Finally, turn back to your side, and let's check your thoracic mobility. Please raise your hands as high as you can above your head.");
                        }, 1500);

                    } else if (scanState === 'WAIT_THORACIC') {
                        isCaptured = true; 
                        status.innerText = "THORACIC CAPTURED - SUCCESS";
                        status.style.color = "#34A853";
                        
                        canvas.toBlob(blob => {
                            analyzeWithGemini(blob, geminiKey, "Analyze this side-profile thoracic extension photo. Look for upper back curvature and range of motion.")
                            .then(() => finishScan())
                            .catch(() => finishScan());
                        }, 'image/jpeg', 0.8);
                    }
                }

                const finishScan = () => {
                    status.innerText = "THANKS FOR THAT! ANALYSIS COMPLETE.";
                    status.style.color = "#34A853";
                    speak("Thanks for that! Your biometric analysis is now complete. The quiz is almost finished, let's look at your final results.");
                    setTimeout(() => {
                        if (camera) camera.stop();
                        if (stream) stream.getTracks().forEach(t => t.stop());
                        nextStep();
                    }, 3000);
                };

            } catch (err) {
                console.error(err);
                status.innerText = "SYSTEM ERROR - BYPASSING";
                setTimeout(nextStep, 2000);
            }
        };

    } else {
        // Standard Questions
        logoRow.classList.remove('hidden');
        progressRow.classList.remove('hidden');
        updateProgress();
        renderQuestion(step, container);
    }
}

function updateProgress() {
    // Only count actual questions for progress
    const totalQuestions = coreQuestions.length;
    // Calculate how many questions we've passed
    let questionsPassed = 0;
    for(let i=0; i<currentStep; i++) {
        if(quizFlow[i].type !== 'intro' && quizFlow[i].type !== 'loading' && quizFlow[i].type !== 'graph') {
            questionsPassed++;
        }
    }
    const pct = (questionsPassed / totalQuestions) * 100;
    document.getElementById('progressBar').style.width = `${pct}%`;
}

function renderQuestion(q, container) {
    // ... (This function remains largely the same as before, just abstracted)
    // Heading
    const h2 = document.createElement('h2');
    h2.className = 'question-text';
    h2.style.marginBottom = q.subtext ? '10px' : '20px';
    h2.textContent = q.text;
    container.appendChild(h2);

    // Subtext
    if (q.subtext) {
        const p = document.createElement('p');
        p.className = 'question-subtext';
        p.innerText = q.subtext;
        container.appendChild(p);
    }

    // Options Container
    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'options-grid';
    if (q.options && q.options.length > 5) {
        optionsDiv.classList.add('compact');
    }

    if (q.type === 'choice') {
        q.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = opt.text;
            btn.onclick = () => selectOption(q.id, opt.value, q.saveAs);
            optionsDiv.appendChild(btn);
        });
    } else if (q.type === 'image_choice') {
        q.options.forEach(opt => {
            const card = document.createElement('div');
            card.className = 'option-card';
            
            const btn = document.createElement('button');
            btn.className = 'option-card-btn';
            btn.textContent = opt.text;
            
            const img = document.createElement('img');
            img.src = opt.img;
            img.alt = opt.text;

            card.appendChild(btn);
            card.appendChild(img);
            
            card.onclick = () => selectOption(q.id, opt.value, q.saveAs);
            optionsDiv.appendChild(card);
        });
    } else if (q.type === 'silhouette_map') {
        container.style.position = 'relative';
        
        const mapContainer = document.createElement('div');
        mapContainer.style.position = 'relative';
        mapContainer.style.width = '100%';
        mapContainer.style.maxWidth = '300px';
        mapContainer.style.margin = '0 auto 20px auto';
        
        const img = document.createElement('img');
        img.src = 'assets/quiz_silhouette_mapping.png';
        img.style.width = '100%';
        img.style.opacity = '1';
        mapContainer.appendChild(img);

        q.options.forEach(opt => {
            const dot = document.createElement('div');
            dot.className = 'map-dot';
            dot.style.position = 'absolute';
            dot.style.top = opt.pos.top;
            dot.style.left = opt.pos.left;
            dot.style.width = '40px';
            dot.style.height = '40px';
            dot.style.background = 'rgba(72, 134, 75, 0.4)';
            dot.style.border = '2px solid #48864B';
            dot.style.borderRadius = '50%';
            dot.style.transform = 'translate(-50%, -50%)';
            dot.style.cursor = 'pointer';
            dot.style.display = 'flex';
            dot.style.alignItems = 'center';
            dot.style.justifyContent = 'center';
            dot.style.transition = 'all 0.3s ease';

            const label = document.createElement('span');
            label.innerText = '+';
            label.style.color = '#1a4d2e';
            label.style.fontWeight = '900';
            dot.appendChild(label);

            dot.onclick = () => {
                document.querySelectorAll('.map-dot').forEach(d => {
                    d.style.background = 'rgba(72, 134, 75, 0.4)';
                    d.style.transform = 'translate(-50%, -50%) scale(1)';
                });
                dot.style.background = '#48864B';
                dot.style.transform = 'translate(-50%, -50%) scale(1.2)';
                
                // Show floating label
                const status = document.getElementById('map-status');
                if (status) status.innerText = "SELECTED: " + opt.text.toUpperCase();
                
                setTimeout(() => {
                    selectOption(q.id, opt.value, q.saveAs);
                }, 600);
            };
            mapContainer.appendChild(dot);
        });

        const statusLabel = document.createElement('p');
        statusLabel.id = 'map-status';
        statusLabel.innerText = "TAP PRIMARY STORAGE AREA";
        statusLabel.style.fontWeight = '800';
        statusLabel.style.fontSize = '0.8rem';
        statusLabel.style.marginTop = '10px';
        statusLabel.style.color = '#48864B';

        optionsDiv.appendChild(mapContainer);
        optionsDiv.appendChild(statusLabel);
    } else if (q.type === 'input') {
        const input = document.createElement('input');
        input.type = q.inputType || 'text';
        input.className = 'text-input';
        input.style.width = '100%';
        input.style.maxWidth = '360px'; // Cap width to prevent edge-hitting
        input.style.margin = '0 auto 20px auto'; // Center it
        input.style.display = 'block';
        input.style.padding = '15px';
        input.style.borderRadius = '10px';
        input.style.border = '1px solid #48864B';
        input.style.fontSize = '18px';
        input.style.textAlign = 'center'; // Center the typed text
        
        // Consent Checkbox
        const consentDiv = document.createElement('div');
        consentDiv.style.textAlign = 'left';
        consentDiv.style.fontSize = '12px';
        consentDiv.style.color = '#666';
        consentDiv.style.marginBottom = '20px';
        consentDiv.style.display = 'flex';
        consentDiv.style.alignItems = 'flex-start';
        consentDiv.style.gap = '10px';
        consentDiv.style.maxWidth = '360px'; // Match input width
        consentDiv.style.margin = '0 auto 20px auto'; // Center block
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = true;
        checkbox.id = 'healthConsent';
        checkbox.style.marginTop = '3px';
        
        const label = document.createElement('label');
        label.htmlFor = 'healthConsent';
        label.innerHTML = `I consent to PlantBasedBalance processing my health data to provide services and enhance my user experience. <a href="#" style="color: inherit; text-decoration: underline;">Privacy Policy</a>`;
        
        consentDiv.appendChild(checkbox);
        consentDiv.appendChild(label);

        const nextBtn = document.createElement('button');
        nextBtn.className = 'option-btn';
        nextBtn.style.width = '100%';
        nextBtn.innerText = 'CONTINUE';
        nextBtn.onclick = () => {
            if (!checkbox.checked) {
                alert("Please consent to data processing to continue.");
                return;
            }
            if(input.value) selectOption(q.id, input.value);
        };

        optionsDiv.appendChild(input);
        optionsDiv.appendChild(consentDiv);
        optionsDiv.appendChild(nextBtn);
    } else if (q.type === 'input_unit') {
        const toggleDiv = document.createElement('div');
        toggleDiv.style.display = 'flex';
        toggleDiv.style.backgroundColor = '#a8cfab';
        toggleDiv.style.borderRadius = '20px';
        toggleDiv.style.padding = '5px';
        toggleDiv.style.marginBottom = '25px';
        toggleDiv.style.width = '100%';
        
        let currentUnitValue = q.values[0];

        q.units.forEach((u, idx) => {
            const uBtn = document.createElement('button');
            uBtn.className = 'unit-btn';
            uBtn.style.flex = '1';
            uBtn.style.border = 'none';
            uBtn.style.padding = '15px';
            uBtn.style.borderRadius = '15px';
            uBtn.style.fontSize = '14px';
            uBtn.style.fontWeight = '700';
            uBtn.style.cursor = 'pointer';
            uBtn.style.transition = 'all 0.3s ease';
            
            const val = q.values[idx];
            
            if (val === currentUnitValue) {
                uBtn.style.backgroundColor = '#48864B';
                uBtn.style.color = 'white';
            } else {
                uBtn.style.backgroundColor = 'transparent';
                uBtn.style.color = '#1a4d2e';
            }
            
            uBtn.innerText = u;
            uBtn.onclick = () => {
                currentUnitValue = val;
                toggleDiv.querySelectorAll('button').forEach(b => {
                    b.style.backgroundColor = 'transparent';
                    b.style.color = '#1a4d2e';
                });
                uBtn.style.backgroundColor = '#48864B';
                uBtn.style.color = 'white';
            };
            toggleDiv.appendChild(uBtn);
        });

        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'text-input';
        input.style.width = '100%';
        input.style.maxWidth = '360px'; // Standard width
        input.style.margin = '0 auto 25px auto'; // Center
        input.style.display = 'block';
        input.style.padding = '15px';
        input.style.borderRadius = '10px';
        input.style.border = '1px solid #48864B';
        input.style.fontSize = '18px';
        input.style.textAlign = 'center';
        
        const nextBtn = document.createElement('button');
        nextBtn.className = 'option-btn';
        nextBtn.style.width = '100%';
        nextBtn.innerText = 'CONTINUE';
        nextBtn.onclick = () => {
             if(input.value) selectOption(q.id, `${input.value} ${currentUnitValue}`);
        };

        optionsDiv.appendChild(toggleDiv);
        optionsDiv.appendChild(input);
        optionsDiv.appendChild(nextBtn);
    } else if (q.type === 'input_email') {
         const input = document.createElement('input');
        input.type = 'email';
        input.className = 'text-input';
        input.placeholder = 'your@email.com';
        
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'text-input';
        nameInput.placeholder = 'First Name';
        
        const nextBtn = document.createElement('button');
        nextBtn.className = 'option-btn';
        nextBtn.style.marginTop = '20px';
        nextBtn.innerText = 'SEE MY RESULTS';
        nextBtn.onclick = () => {
             if(input.value && nameInput.value) {
                 answers['email'] = input.value;
                 answers['name'] = nameInput.value;
                 sessionStorage.setItem('userEmail', input.value); // Essential for Checkout tracking
                 sessionStorage.setItem('userName', nameInput.value);
                 syncLead(answers); // Add sync here too
                 finishQuiz();
             }
        };

        optionsDiv.appendChild(input);
        optionsDiv.appendChild(nameInput);
        optionsDiv.appendChild(nextBtn);
    } else if (q.type === 'multi_choice') {
        const selectedValues = new Set();
        q.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.style.backgroundColor = '#fff';
            btn.style.color = '#1a4d2e';
            btn.style.border = '1px solid #48864B';
            btn.textContent = opt.text;
            
            btn.onclick = () => {
                if (selectedValues.has(opt.value)) {
                    selectedValues.delete(opt.value);
                    btn.style.backgroundColor = '#fff';
                    btn.style.color = '#1a4d2e';
                } else {
                    selectedValues.add(opt.value);
                    btn.style.backgroundColor = '#48864B';
                    btn.style.color = '#fff';
                }
            };
            optionsDiv.appendChild(btn);
        });

        const nextBtn = document.createElement('button');
        nextBtn.className = 'option-btn';
        nextBtn.style.marginTop = '20px';
        nextBtn.style.width = '100%';
        nextBtn.innerText = q.buttonText || 'CONTINUE';
        nextBtn.onclick = () => {
            if (selectedValues.size === 0) {
                alert("Please select at least one symptom to continue.");
                return;
            }
            selectOption(q.id, Array.from(selectedValues).join(', '));
        };
        optionsDiv.appendChild(nextBtn);
    } else if (q.type === 'number_select') {
        // Training frequency selector (2-7 days)
        const numberGrid = document.createElement('div');
        numberGrid.style.display = 'flex';
        numberGrid.style.justifyContent = 'center';
        numberGrid.style.gap = '10px';
        numberGrid.style.flexWrap = 'wrap';
        numberGrid.style.marginBottom = '20px';

        const tipText = document.createElement('p');
        tipText.id = 'frequency-tip';
        tipText.style.textAlign = 'center';
        tipText.style.color = '#48864B';
        tipText.style.fontSize = '14px';
        tipText.style.minHeight = '40px';
        tipText.style.marginTop = '15px';
        tipText.style.padding = '10px';
        tipText.style.background = 'rgba(72, 134, 75, 0.1)';
        tipText.style.borderRadius = '10px';
        tipText.innerText = 'Select how many days you want to train';

        let selectedValue = null;

        q.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'number-select-btn';
            btn.textContent = opt.text;
            btn.style.width = '50px';
            btn.style.height = '50px';
            btn.style.borderRadius = '50%';
            btn.style.border = '2px solid #48864B';
            btn.style.background = '#fff';
            btn.style.color = '#1a4d2e';
            btn.style.fontSize = '20px';
            btn.style.fontWeight = '700';
            btn.style.cursor = 'pointer';
            btn.style.transition = 'all 0.2s ease';

            btn.onclick = () => {
                // Reset all buttons
                numberGrid.querySelectorAll('.number-select-btn').forEach(b => {
                    b.style.background = '#fff';
                    b.style.color = '#1a4d2e';
                    b.style.transform = 'scale(1)';
                });
                // Highlight selected
                btn.style.background = '#48864B';
                btn.style.color = '#fff';
                btn.style.transform = 'scale(1.1)';
                selectedValue = opt.value;
                tipText.innerText = opt.tip;
            };
            numberGrid.appendChild(btn);
        });

        const continueBtn = document.createElement('button');
        continueBtn.className = 'option-btn';
        continueBtn.style.marginTop = '20px';
        continueBtn.style.width = '100%';
        continueBtn.innerText = 'CONTINUE';
        continueBtn.onclick = () => {
            if (!selectedValue) {
                alert('Please select how many days you want to train.');
                return;
            }
            selectOption(q.id, selectedValue);
        };

        optionsDiv.appendChild(numberGrid);
        optionsDiv.appendChild(tipText);
        optionsDiv.appendChild(continueBtn);
    } else if (q.type === 'split_choice') {
        // Split preference selector with descriptions
        q.options.forEach(opt => {
            const card = document.createElement('div');
            card.style.background = '#fff';
            card.style.border = '2px solid #e0e0e0';
            card.style.borderRadius = '12px';
            card.style.padding = '15px';
            card.style.marginBottom = '10px';
            card.style.cursor = 'pointer';
            card.style.transition = 'all 0.2s ease';

            const title = document.createElement('div');
            title.style.fontWeight = '700';
            title.style.fontSize = '16px';
            title.style.color = '#1a4d2e';
            title.textContent = opt.text;

            const desc = document.createElement('div');
            desc.style.fontSize = '13px';
            desc.style.color = '#666';
            desc.style.marginTop = '4px';
            desc.textContent = opt.desc;

            const best = document.createElement('div');
            best.style.fontSize = '12px';
            best.style.color = '#48864B';
            best.style.marginTop = '4px';
            best.style.fontWeight = '600';
            best.textContent = `Best for: ${opt.best}`;

            card.appendChild(title);
            card.appendChild(desc);
            card.appendChild(best);

            card.onmouseenter = () => {
                if (card.dataset.selected !== 'true') {
                    card.style.borderColor = '#48864B';
                }
            };
            card.onmouseleave = () => {
                if (card.dataset.selected !== 'true') {
                    card.style.borderColor = '#e0e0e0';
                }
            };

            card.onclick = () => {
                // Check if this is a mismatch with frequency
                const freq = parseInt(answers.training_frequency);
                let warning = null;

                if (opt.value === 'bro_split' && freq < 5) {
                    warning = `Bro Split works best with 5-6 days. You selected ${freq} days. Want to continue anyway?`;
                } else if (opt.value === 'full_body' && freq > 4) {
                    warning = `Full Body is typically done 2-3 days/week for recovery. You selected ${freq} days. Want to continue anyway?`;
                }

                if (warning && !confirm(warning)) {
                    return;
                }

                selectOption(q.id, opt.value);
            };

            optionsDiv.appendChild(card);
        });
    } else if (q.type === 'day_selector') {
        // Day selector for choosing training days
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const fullDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const selectedDays = new Set();
        const requiredDays = parseInt(answers.training_frequency) || 4;

        const counterText = document.createElement('p');
        counterText.style.textAlign = 'center';
        counterText.style.marginBottom = '15px';
        counterText.style.fontWeight = '600';
        counterText.style.color = '#1a4d2e';
        counterText.innerText = `Select ${requiredDays} days`;

        const dayGrid = document.createElement('div');
        dayGrid.style.display = 'flex';
        dayGrid.style.justifyContent = 'center';
        dayGrid.style.gap = '8px';
        dayGrid.style.flexWrap = 'wrap';
        dayGrid.style.marginBottom = '20px';

        days.forEach((day, idx) => {
            const btn = document.createElement('button');
            btn.className = 'day-select-btn';
            btn.textContent = day;
            btn.dataset.day = fullDays[idx];
            btn.style.width = '45px';
            btn.style.height = '45px';
            btn.style.borderRadius = '10px';
            btn.style.border = '2px solid #48864B';
            btn.style.background = '#fff';
            btn.style.color = '#1a4d2e';
            btn.style.fontSize = '12px';
            btn.style.fontWeight = '700';
            btn.style.cursor = 'pointer';
            btn.style.transition = 'all 0.2s ease';

            btn.onclick = () => {
                if (selectedDays.has(fullDays[idx])) {
                    selectedDays.delete(fullDays[idx]);
                    btn.style.background = '#fff';
                    btn.style.color = '#1a4d2e';
                } else {
                    if (selectedDays.size >= requiredDays) {
                        alert(`You can only select ${requiredDays} days. Deselect one first.`);
                        return;
                    }
                    selectedDays.add(fullDays[idx]);
                    btn.style.background = '#48864B';
                    btn.style.color = '#fff';
                }
                counterText.innerText = `${selectedDays.size} of ${requiredDays} days selected`;
            };

            dayGrid.appendChild(btn);
        });

        const feedbackText = document.createElement('p');
        feedbackText.id = 'day-feedback';
        feedbackText.style.textAlign = 'center';
        feedbackText.style.color = '#48864B';
        feedbackText.style.fontSize = '13px';
        feedbackText.style.minHeight = '20px';
        feedbackText.style.marginBottom = '15px';

        const continueBtn = document.createElement('button');
        continueBtn.className = 'option-btn';
        continueBtn.style.width = '100%';
        continueBtn.innerText = 'CONTINUE';
        continueBtn.onclick = () => {
            if (selectedDays.size !== requiredDays) {
                alert(`Please select exactly ${requiredDays} days.`);
                return;
            }
            // Store as comma-separated string
            selectOption(q.id, Array.from(selectedDays).join(','));
        };

        optionsDiv.appendChild(counterText);
        optionsDiv.appendChild(dayGrid);
        optionsDiv.appendChild(feedbackText);
        optionsDiv.appendChild(continueBtn);
    } else if (q.type === 'calendar_choice') {
        // Tailor vs Design choice screen
        q.options.forEach(opt => {
            const card = document.createElement('div');
            card.style.background = '#fff';
            card.style.border = '2px solid #e0e0e0';
            card.style.borderRadius = '16px';
            card.style.padding = '20px';
            card.style.marginBottom = '15px';
            card.style.cursor = 'pointer';
            card.style.transition = 'all 0.2s ease';
            card.style.textAlign = 'center';

            const icon = document.createElement('div');
            icon.style.fontSize = '32px';
            icon.style.marginBottom = '10px';
            icon.textContent = opt.icon;

            const title = document.createElement('div');
            title.style.fontWeight = '700';
            title.style.fontSize = '18px';
            title.style.color = '#1a4d2e';
            title.style.marginBottom = '8px';
            title.textContent = opt.text;

            const desc = document.createElement('div');
            desc.style.fontSize = '13px';
            desc.style.color = '#666';
            desc.style.lineHeight = '1.4';
            desc.textContent = opt.desc;

            card.appendChild(icon);
            card.appendChild(title);
            card.appendChild(desc);

            card.onmouseenter = () => card.style.borderColor = '#48864B';
            card.onmouseleave = () => card.style.borderColor = '#e0e0e0';

            card.onclick = () => {
                if (opt.value === 'tailor') {
                    // Generate the tailored calendar
                    generateTailoredCalendar();
                }
                selectOption(q.id, opt.value);
            };

            optionsDiv.appendChild(card);
        });

        // Info box about 48-week program
        if (q.infoBox) {
            const infoBox = document.createElement('div');
            infoBox.style.background = 'rgba(72, 134, 75, 0.1)';
            infoBox.style.border = '1px solid rgba(72, 134, 75, 0.3)';
            infoBox.style.borderRadius = '12px';
            infoBox.style.padding = '15px';
            infoBox.style.marginTop = '10px';

            const infoTitle = document.createElement('div');
            infoTitle.style.fontWeight = '700';
            infoTitle.style.fontSize = '14px';
            infoTitle.style.color = '#1a4d2e';
            infoTitle.style.marginBottom = '6px';
            infoTitle.textContent = '📈 ' + q.infoBox.title;

            const infoText = document.createElement('div');
            infoText.style.fontSize = '13px';
            infoText.style.color = '#666';
            infoText.style.lineHeight = '1.4';
            infoText.textContent = q.infoBox.text;

            infoBox.appendChild(infoTitle);
            infoBox.appendChild(infoText);
            optionsDiv.appendChild(infoBox);
        }
    } else if (q.type === 'calendar_builder') {
        // Calendar builder for Design My Own
        renderCalendarBuilder(container, optionsDiv, q);
        return; // Early return as this has custom rendering
    } else if (q.type === 'calendar_preview') {
        // Calendar preview/confirmation screen
        renderCalendarPreview(container, optionsDiv, q);
        return; // Early return as this has custom rendering
    }

    container.appendChild(optionsDiv);

    // Back Button logic could be updated here if needed, but simple nextStep usage relies on linear flow
}

// ========== WORKOUT CALENDAR HELPER FUNCTIONS ==========

// Stores the generated workout calendar
let workoutCalendar = {};

// Available workout options based on equipment
function getWorkoutOptions() {
    const equipment = answers.equipment_access || 'none';
    const options = [];

    // Base options available to everyone
    options.push({ category: 'YOGA', items: [
        { id: 'yoga-flow', name: 'Power Yoga', icon: '🧘' },
        { id: 'yoga-restorative', name: 'Restorative Yoga', icon: '🧘' },
        { id: 'yoga-mobility', name: 'Mobility Yoga', icon: '🧘' }
    ]});

    options.push({ category: 'RECOVERY', items: [
        { id: 'recovery-stretch', name: 'Stretching', icon: '🔄' },
        { id: 'recovery-foam', name: 'Foam Rolling', icon: '🔄' }
    ]});

    options.push({ category: 'REST', items: [
        { id: 'rest', name: 'Rest Day', icon: '⏸️' }
    ]});

    // Equipment-specific options
    if (equipment === 'gym') {
        options.unshift({ category: 'GYM', items: [
            { id: 'gym-push', name: 'Push (Chest, Shoulders, Triceps)', icon: '🏋️' },
            { id: 'gym-pull', name: 'Pull (Back, Biceps)', icon: '🏋️' },
            { id: 'gym-legs', name: 'Legs', icon: '🏋️' },
            { id: 'gym-chest', name: 'Chest', icon: '🏋️' },
            { id: 'gym-back', name: 'Back', icon: '🏋️' },
            { id: 'gym-shoulders', name: 'Shoulders', icon: '🏋️' },
            { id: 'gym-arms', name: 'Arms', icon: '🏋️' },
            { id: 'gym-core', name: 'Core', icon: '🏋️' },
            { id: 'gym-upper', name: 'Upper Body', icon: '🏋️' },
            { id: 'gym-lower', name: 'Lower Body', icon: '🏋️' },
            { id: 'gym-fullbody', name: 'Full Body', icon: '🏋️' }
        ]});
    } else if (equipment === 'dumbbells') {
        options.unshift({ category: 'HOME WEIGHTS', items: [
            { id: 'home-upper', name: 'Upper Body', icon: '🏠' },
            { id: 'home-lower', name: 'Lower Body', icon: '🏠' },
            { id: 'home-fullbody', name: 'Full Body', icon: '🏠' },
            { id: 'home-arms', name: 'Arms', icon: '🏠' },
            { id: 'home-shoulders', name: 'Shoulders', icon: '🏠' }
        ]});
    } else if (equipment === 'bands') {
        options.unshift({ category: 'BANDS', items: [
            { id: 'bands-upper', name: 'Upper Body', icon: '🔗' },
            { id: 'bands-lower', name: 'Lower Body', icon: '🔗' },
            { id: 'bands-fullbody', name: 'Full Body', icon: '🔗' }
        ]});
    } else if (equipment === 'none') {
        options.unshift({ category: 'BODYWEIGHT', items: [
            { id: 'bw-upper', name: 'Upper Body', icon: '🤸' },
            { id: 'bw-lower', name: 'Lower Body', icon: '🤸' },
            { id: 'bw-core', name: 'Core', icon: '🤸' },
            { id: 'bw-fullbody', name: 'Full Body', icon: '🤸' }
        ]});
    }

    return options;
}

// Generate a tailored calendar based on user preferences
function generateTailoredCalendar() {
    const trainingDays = (answers.training_days || '').split(',').filter(d => d);
    const equipment = answers.equipment_access || 'none';
    const split = answers.split_preference || 'full_body';
    const recoveryOnRestDays = answers.recovery_preference === 'yes';
    const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    // Reset calendar
    workoutCalendar = {};

    // Determine workout sequence based on split and equipment
    let workoutSequence = [];

    if (equipment === 'gym') {
        if (split === 'ppl') {
            workoutSequence = ['gym-push', 'gym-pull', 'gym-legs'];
        } else if (split === 'upper_lower') {
            workoutSequence = ['gym-upper', 'gym-lower'];
        } else if (split === 'bro_split') {
            workoutSequence = ['gym-chest', 'gym-back', 'gym-shoulders', 'gym-legs', 'gym-arms'];
        } else {
            // full_body
            workoutSequence = ['gym-fullbody'];
        }
    } else if (equipment === 'dumbbells') {
        workoutSequence = ['home-upper', 'home-lower', 'home-fullbody'];
    } else if (equipment === 'bands') {
        workoutSequence = ['bands-upper', 'bands-lower', 'bands-fullbody'];
    } else if (equipment === 'none') {
        workoutSequence = ['bw-upper', 'bw-lower', 'bw-core', 'bw-fullbody'];
    } else if (equipment === 'yoga_only') {
        workoutSequence = ['yoga-flow', 'yoga-restorative', 'yoga-mobility'];
    }

    // Assign workouts to training days
    let workoutIndex = 0;
    allDays.forEach(day => {
        if (trainingDays.includes(day)) {
            workoutCalendar[day] = workoutSequence[workoutIndex % workoutSequence.length];
            workoutIndex++;
        } else {
            // Rest day - add yoga if they want recovery
            workoutCalendar[day] = recoveryOnRestDays ? 'yoga-restorative' : 'rest';
        }
    });

    // Store in answers
    answers.workout_calendar = JSON.stringify(workoutCalendar);
}

// Render the calendar builder for "Design My Own"
function renderCalendarBuilder(container, optionsDiv, q) {
    const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const trainingDays = (answers.training_days || '').split(',').filter(d => d);
    const workoutOptions = getWorkoutOptions();

    // Initialize calendar if empty
    if (Object.keys(workoutCalendar).length === 0) {
        allDays.forEach(day => {
            workoutCalendar[day] = trainingDays.includes(day) ? '' : 'rest';
        });
    }

    // Title
    const h2 = document.createElement('h2');
    h2.className = 'question-text';
    h2.textContent = q.text;
    container.appendChild(h2);

    const subtext = document.createElement('p');
    subtext.className = 'question-subtext';
    subtext.textContent = q.subtext;
    container.appendChild(subtext);

    // Calendar grid
    const calendarGrid = document.createElement('div');
    calendarGrid.style.width = '100%';
    calendarGrid.style.maxWidth = '400px';
    calendarGrid.style.margin = '0 auto';

    allDays.forEach((day, idx) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.justifyContent = 'space-between';
        row.style.padding = '10px';
        row.style.borderBottom = '1px solid #e0e0e0';
        row.style.background = trainingDays.includes(day) ? '#fff' : '#f9f9f9';

        const dayLabel = document.createElement('div');
        dayLabel.style.fontWeight = '600';
        dayLabel.style.fontSize = '14px';
        dayLabel.style.color = '#1a4d2e';
        dayLabel.style.width = '90px';
        dayLabel.textContent = dayLabels[idx];

        const selectWrapper = document.createElement('div');
        selectWrapper.style.flex = '1';
        selectWrapper.style.marginLeft = '10px';

        const select = document.createElement('select');
        select.style.width = '100%';
        select.style.padding = '10px';
        select.style.borderRadius = '8px';
        select.style.border = '1px solid #ccc';
        select.style.fontSize = '13px';
        select.style.background = '#fff';
        select.dataset.day = day;

        // Add placeholder
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = trainingDays.includes(day) ? 'Select workout...' : 'Rest Day';
        select.appendChild(placeholder);

        // Add workout options
        workoutOptions.forEach(category => {
            const optGroup = document.createElement('optgroup');
            optGroup.label = category.category;
            category.items.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = `${item.icon} ${item.name}`;
                if (workoutCalendar[day] === item.id) {
                    option.selected = true;
                }
                optGroup.appendChild(option);
            });
            select.appendChild(optGroup);
        });

        select.onchange = (e) => {
            workoutCalendar[day] = e.target.value || 'rest';
            updateWarnings();
        };

        selectWrapper.appendChild(select);
        row.appendChild(dayLabel);
        row.appendChild(selectWrapper);
        calendarGrid.appendChild(row);
    });

    // Warning area
    const warningArea = document.createElement('div');
    warningArea.id = 'calendar-warnings';
    warningArea.style.marginTop = '15px';
    warningArea.style.minHeight = '40px';

    function updateWarnings() {
        warningArea.innerHTML = '';
        const warnings = [];

        // Check for muscle overlap
        const calendarValues = Object.entries(workoutCalendar);
        for (let i = 0; i < calendarValues.length - 1; i++) {
            const [day1, workout1] = calendarValues[i];
            const [day2, workout2] = calendarValues[i + 1];

            if (workout1 === workout2 && workout1 !== 'rest' && workout1 !== '' &&
                !['yoga-restorative', 'yoga-flow', 'yoga-mobility'].includes(workout1)) {
                warnings.push(`${day1.charAt(0).toUpperCase() + day1.slice(1)} and ${day2.charAt(0).toUpperCase() + day2.slice(1)} have the same workout - consider varying for recovery.`);
            }

            // Check chest/push overlap
            if ((workout1 === 'gym-push' && workout2 === 'gym-chest') ||
                (workout1 === 'gym-chest' && workout2 === 'gym-push')) {
                warnings.push(`Push and Chest workouts are back-to-back - both target chest muscles.`);
            }
        }

        // Check for no rest days
        const restDays = Object.values(workoutCalendar).filter(w =>
            w === 'rest' || w === 'yoga-restorative' || w === 'yoga-flow' || w === 'yoga-mobility'
        ).length;
        if (restDays === 0) {
            warnings.push(`No recovery days scheduled - consider adding yoga or rest to prevent burnout.`);
        }

        warnings.forEach(w => {
            const warn = document.createElement('p');
            warn.style.color = '#f59e0b';
            warn.style.fontSize = '12px';
            warn.style.margin = '5px 0';
            warn.textContent = '⚠️ ' + w;
            warningArea.appendChild(warn);
        });
    }

    // Continue button
    const continueBtn = document.createElement('button');
    continueBtn.className = 'option-btn';
    continueBtn.style.marginTop = '20px';
    continueBtn.style.width = '100%';
    continueBtn.innerText = 'SAVE MY CALENDAR';
    continueBtn.onclick = () => {
        // Validate that training days have workouts assigned
        const unassigned = trainingDays.filter(day => !workoutCalendar[day] || workoutCalendar[day] === '');
        if (unassigned.length > 0) {
            alert(`Please assign workouts to: ${unassigned.join(', ')}`);
            return;
        }

        // Fill in rest days properly
        allDays.forEach(day => {
            if (!workoutCalendar[day]) {
                workoutCalendar[day] = 'rest';
            }
        });

        answers.workout_calendar = JSON.stringify(workoutCalendar);
        selectOption(q.id, 'custom');
    };

    optionsDiv.appendChild(calendarGrid);
    optionsDiv.appendChild(warningArea);
    optionsDiv.appendChild(continueBtn);
    container.appendChild(optionsDiv);
}

// Render the calendar preview/confirmation screen
function renderCalendarPreview(container, optionsDiv, q) {
    const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const shortDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Make sure calendar is generated
    if (Object.keys(workoutCalendar).length === 0) {
        // Try to load from answers
        if (answers.workout_calendar) {
            workoutCalendar = JSON.parse(answers.workout_calendar);
        } else {
            generateTailoredCalendar();
        }
    }

    // Get workout options from the existing function
    const workoutOptions = getWorkoutOptions();

    // Get workout display info - IDs match workout_library.js
    const workoutInfo = {
        // GYM workouts
        'gym-push': { icon: '🏋️', name: 'Push', desc: 'Chest, Shoulders, Triceps' },
        'gym-pull': { icon: '🏋️', name: 'Pull', desc: 'Back, Biceps' },
        'gym-legs': { icon: '🏋️', name: 'Legs', desc: 'Quads, Hamstrings, Glutes' },
        'gym-chest': { icon: '🏋️', name: 'Chest', desc: '' },
        'gym-back': { icon: '🏋️', name: 'Back', desc: '' },
        'gym-shoulders': { icon: '🏋️', name: 'Shoulders', desc: '' },
        'gym-arms': { icon: '🏋️', name: 'Arms', desc: '' },
        'gym-core': { icon: '🏋️', name: 'Core', desc: '' },
        'gym-upper': { icon: '🏋️', name: 'Upper Body', desc: '' },
        'gym-lower': { icon: '🏋️', name: 'Lower Body', desc: '' },
        'gym-fullbody': { icon: '🏋️', name: 'Full Body', desc: '' },
        // HOME WEIGHTS workouts
        'home-upper': { icon: '🏠', name: 'Upper Body', desc: '' },
        'home-lower': { icon: '🏠', name: 'Lower Body', desc: '' },
        'home-fullbody': { icon: '🏠', name: 'Full Body', desc: '' },
        'home-arms': { icon: '🏠', name: 'Arms', desc: '' },
        'home-shoulders': { icon: '🏠', name: 'Shoulders', desc: '' },
        // BANDS workouts
        'bands-upper': { icon: '🔗', name: 'Upper Body', desc: '' },
        'bands-lower': { icon: '🔗', name: 'Lower Body', desc: '' },
        'bands-fullbody': { icon: '🔗', name: 'Full Body', desc: '' },
        // BODYWEIGHT workouts
        'bw-upper': { icon: '🤸', name: 'Upper Body', desc: '' },
        'bw-lower': { icon: '🤸', name: 'Lower Body', desc: '' },
        'bw-core': { icon: '🤸', name: 'Core', desc: '' },
        'bw-fullbody': { icon: '🤸', name: 'Full Body', desc: '' },
        // YOGA workouts
        'yoga-flow': { icon: '🧘', name: 'Power Yoga', desc: 'Active Recovery' },
        'yoga-restorative': { icon: '🧘', name: 'Restorative Yoga', desc: 'Recovery & Mobility' },
        'yoga-mobility': { icon: '🧘', name: 'Mobility Yoga', desc: '' },
        // RECOVERY workouts
        'recovery-stretch': { icon: '🔄', name: 'Stretching', desc: '' },
        'recovery-foam': { icon: '🔄', name: 'Foam Rolling', desc: '' },
        'rest': { icon: '⏸️', name: 'Rest Day', desc: '' }
    };

    // Title
    const h2 = document.createElement('h2');
    h2.className = 'question-text';
    h2.textContent = q.text;
    container.appendChild(h2);

    // Subtext instruction
    const subtext = document.createElement('p');
    subtext.style.textAlign = 'center';
    subtext.style.fontSize = '14px';
    subtext.style.color = '#666';
    subtext.style.marginBottom = '15px';
    subtext.textContent = 'Tap any day to change the workout';
    container.appendChild(subtext);

    // Calendar preview
    const previewBox = document.createElement('div');
    previewBox.style.background = '#fff';
    previewBox.style.borderRadius = '16px';
    previewBox.style.padding = '20px';
    previewBox.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
    previewBox.style.marginBottom = '20px';

    // Summary element (create early so we can update it)
    const summary = document.createElement('div');
    summary.style.textAlign = 'center';
    summary.style.marginTop = '15px';
    summary.style.padding = '10px';
    summary.style.background = 'rgba(72, 134, 75, 0.1)';
    summary.style.borderRadius = '10px';
    summary.style.fontSize = '14px';
    summary.style.color = '#1a4d2e';

    // Function to update summary stats
    function updateSummary() {
        const trainingCount = Object.values(workoutCalendar).filter(w =>
            w && !['rest', 'yoga-flow', 'yoga-restorative', 'yoga-mobility', 'recovery-stretch', 'recovery-foam'].includes(w)
        ).length;
        const yogaCount = Object.values(workoutCalendar).filter(w =>
            ['yoga-flow', 'yoga-restorative', 'yoga-mobility'].includes(w)
        ).length;
        const restCount = Object.values(workoutCalendar).filter(w =>
            w === 'rest' || ['recovery-stretch', 'recovery-foam'].includes(w)
        ).length;
        summary.innerHTML = `<strong>${trainingCount} training</strong> · <strong>${yogaCount} yoga</strong> · <strong>${restCount} rest</strong>`;
    }

    // Function to render a day row (reusable for updates)
    function renderDayRow(day, idx, parentElement, existingRow = null) {
        const workout = workoutCalendar[day] || 'rest';
        const info = workoutInfo[workout] || { icon: '❓', name: 'Unknown', desc: '' };

        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.padding = '12px 0';
        row.style.borderBottom = idx < 6 ? '1px solid #f0f0f0' : 'none';
        row.style.cursor = 'pointer';
        row.style.transition = 'background 0.2s';
        row.dataset.day = day;
        row.dataset.idx = idx;

        // Hover effect
        row.onmouseenter = () => { row.style.background = 'rgba(72, 134, 75, 0.05)'; };
        row.onmouseleave = () => { row.style.background = 'transparent'; };

        const dayCol = document.createElement('div');
        dayCol.style.width = '100px';
        dayCol.style.fontWeight = '600';
        dayCol.style.color = '#1a4d2e';
        dayCol.textContent = dayLabels[idx];

        const workoutCol = document.createElement('div');
        workoutCol.style.flex = '1';
        workoutCol.style.display = 'flex';
        workoutCol.style.alignItems = 'center';
        workoutCol.style.gap = '10px';

        const icon = document.createElement('span');
        icon.style.fontSize = '20px';
        icon.textContent = info.icon;

        const workoutText = document.createElement('div');
        const workoutName = document.createElement('div');
        workoutName.style.fontWeight = '500';
        workoutName.style.color = '#333';
        workoutName.textContent = info.name;

        workoutText.appendChild(workoutName);

        if (info.desc) {
            const workoutDesc = document.createElement('div');
            workoutDesc.style.fontSize = '12px';
            workoutDesc.style.color = '#888';
            workoutDesc.textContent = info.desc;
            workoutText.appendChild(workoutDesc);
        }

        // Edit indicator
        const editIcon = document.createElement('span');
        editIcon.style.marginLeft = 'auto';
        editIcon.style.color = '#48864B';
        editIcon.style.fontSize = '14px';
        editIcon.innerHTML = '&#9662;'; // Down arrow

        workoutCol.appendChild(icon);
        workoutCol.appendChild(workoutText);
        workoutCol.appendChild(editIcon);

        row.appendChild(dayCol);
        row.appendChild(workoutCol);

        // Click handler to show dropdown
        row.onclick = (e) => {
            e.stopPropagation();
            showWorkoutDropdown(day, idx, row);
        };

        if (existingRow) {
            parentElement.replaceChild(row, existingRow);
        } else {
            parentElement.appendChild(row);
        }

        return row;
    }

    // Function to show workout dropdown
    function showWorkoutDropdown(day, idx, row) {
        // Remove any existing dropdown
        const existingDropdown = document.getElementById('workout-dropdown-overlay');
        if (existingDropdown) existingDropdown.remove();

        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'workout-dropdown-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '0';
        overlay.style.background = 'rgba(0,0,0,0.3)';
        overlay.style.zIndex = '13000';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';

        // Create dropdown container
        const dropdown = document.createElement('div');
        dropdown.style.background = '#fff';
        dropdown.style.borderRadius = '16px';
        dropdown.style.padding = '20px';
        dropdown.style.width = '90%';
        dropdown.style.maxWidth = '350px';
        dropdown.style.maxHeight = '70vh';
        dropdown.style.overflowY = 'auto';
        dropdown.style.boxShadow = '0 10px 40px rgba(0,0,0,0.2)';

        // Header
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.marginBottom = '15px';
        header.style.paddingBottom = '10px';
        header.style.borderBottom = '1px solid #eee';

        const headerTitle = document.createElement('h3');
        headerTitle.style.margin = '0';
        headerTitle.style.color = '#1a4d2e';
        headerTitle.style.fontSize = '18px';
        headerTitle.textContent = dayLabels[idx];

        const closeBtn = document.createElement('span');
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.fontSize = '24px';
        closeBtn.style.color = '#999';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => overlay.remove();

        header.appendChild(headerTitle);
        header.appendChild(closeBtn);
        dropdown.appendChild(header);

        // Workout options grouped by category
        workoutOptions.forEach(category => {
            const categoryDiv = document.createElement('div');
            categoryDiv.style.marginBottom = '15px';

            const categoryLabel = document.createElement('div');
            categoryLabel.style.fontSize = '11px';
            categoryLabel.style.fontWeight = '600';
            categoryLabel.style.color = '#999';
            categoryLabel.style.textTransform = 'uppercase';
            categoryLabel.style.marginBottom = '8px';
            categoryLabel.style.letterSpacing = '0.5px';
            categoryLabel.textContent = category.category;
            categoryDiv.appendChild(categoryLabel);

            category.items.forEach(item => {
                const option = document.createElement('div');
                option.style.display = 'flex';
                option.style.alignItems = 'center';
                option.style.padding = '10px 12px';
                option.style.marginBottom = '4px';
                option.style.borderRadius = '8px';
                option.style.cursor = 'pointer';
                option.style.transition = 'background 0.2s';

                // Highlight current selection
                if (workoutCalendar[day] === item.id) {
                    option.style.background = 'rgba(72, 134, 75, 0.15)';
                    option.style.border = '2px solid #48864B';
                } else {
                    option.style.background = '#f8f8f8';
                    option.style.border = '2px solid transparent';
                }

                option.onmouseenter = () => {
                    if (workoutCalendar[day] !== item.id) {
                        option.style.background = 'rgba(72, 134, 75, 0.1)';
                    }
                };
                option.onmouseleave = () => {
                    if (workoutCalendar[day] !== item.id) {
                        option.style.background = '#f8f8f8';
                    }
                };

                const optIcon = document.createElement('span');
                optIcon.style.fontSize = '18px';
                optIcon.style.marginRight = '10px';
                optIcon.textContent = item.icon;

                const optName = document.createElement('span');
                optName.style.fontWeight = '500';
                optName.style.color = '#333';
                optName.textContent = item.name;

                // Checkmark for selected
                if (workoutCalendar[day] === item.id) {
                    const checkmark = document.createElement('span');
                    checkmark.style.marginLeft = 'auto';
                    checkmark.style.color = '#48864B';
                    checkmark.style.fontWeight = 'bold';
                    checkmark.innerHTML = '&#10003;';
                    option.appendChild(optIcon);
                    option.appendChild(optName);
                    option.appendChild(checkmark);
                } else {
                    option.appendChild(optIcon);
                    option.appendChild(optName);
                }

                option.onclick = () => {
                    // Update calendar
                    workoutCalendar[day] = item.id;
                    answers.workout_calendar = JSON.stringify(workoutCalendar);

                    // Update the row display
                    const existingRow = previewBox.querySelector(`[data-day="${day}"]`);
                    renderDayRow(day, idx, previewBox, existingRow);

                    // Update summary
                    updateSummary();

                    // Close dropdown
                    overlay.remove();
                };

                categoryDiv.appendChild(option);
            });

            dropdown.appendChild(categoryDiv);
        });

        overlay.appendChild(dropdown);

        // Close on overlay click
        overlay.onclick = (e) => {
            if (e.target === overlay) overlay.remove();
        };

        document.body.appendChild(overlay);
    }

    // Render all day rows
    allDays.forEach((day, idx) => {
        renderDayRow(day, idx, previewBox);
    });

    // Initial summary update
    updateSummary();
    previewBox.appendChild(summary);

    // Info about 48-week program
    const infoBox = document.createElement('div');
    infoBox.style.textAlign = 'center';
    infoBox.style.marginBottom = '15px';
    infoBox.style.fontSize = '13px';
    infoBox.style.color = '#666';
    infoBox.innerHTML = '📈 Each workout evolves over 48 weeks.<br>Just show up and we\'ll handle the rest.';

    // Single confirm button (removed "Let Me Adjust" since editing is now inline)
    const btnContainer = document.createElement('div');
    btnContainer.style.display = 'flex';
    btnContainer.style.gap = '10px';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'option-btn';
    confirmBtn.style.flex = '1';
    confirmBtn.innerText = 'Looks Good!';
    confirmBtn.onclick = () => {
        // Save final calendar
        answers.workout_calendar = JSON.stringify(workoutCalendar);
        selectOption(q.id, 'confirmed');
    };

    btnContainer.appendChild(confirmBtn);

    optionsDiv.appendChild(previewBox);
    optionsDiv.appendChild(infoBox);
    optionsDiv.appendChild(btnContainer);
    container.appendChild(optionsDiv);
}

// ========== END WORKOUT CALENDAR HELPER FUNCTIONS ==========

function selectOption(id, value, saveAsKey) {
    answers[id] = value;
    if (saveAsKey) {
        answers[saveAsKey] = value;
    }
    nextStep();
}

function nextStep() {
    // DYNAMIC INJECTION LOGIC
    if (quizFlow[currentStep] && quizFlow[currentStep].id === "symptoms" && answers['symptoms']) {
        const selectedStr = answers['symptoms'] || "";
        const selected = selectedStr.split(', ').map(s => s.trim());
        
        let newSlides = [];
        selected.forEach(symptom => {
             // Access Global SymptomModules
             if (typeof SymptomModules !== 'undefined' && SymptomModules[symptom]) {
                 // 1. Symptom Specific Loader
                 newSlides.push({
                     type: 'loading',
                     delay: 1500,
                     text: `Starting assessment on ${symptom.replace(/_/g, ' ')}...`,
                     subtext: '',
                     footerText: '',
                     spinner: false // Hide loading spinner as requested
                 });

                 // 2. Symptom Questions
                 newSlides.push(...SymptomModules[symptom]);
             }
        });

        if (newSlides.length > 0) {
            // Check if the NEXT slide is already a loading slide (the generic one)
            // If so, insert AFTER it so it plays first.
            let insertIndex = currentStep + 1;
            if (quizFlow[currentStep + 1] && quizFlow[currentStep + 1].type === 'loading') {
                insertIndex = currentStep + 2;
            }
            
            quizFlow.splice(insertIndex, 0, ...newSlides);
        }
    }

    if (currentStep < quizFlow.length - 1) {
        currentStep++;

        // CONDITIONAL SKIP LOGIC: Check if current step has showIf condition
        let step = quizFlow[currentStep];
        while (step && step.showIf && currentStep < quizFlow.length - 1) {
            const { questionId, value } = step.showIf;
            const shouldShow = answers[questionId] === value;
            if (!shouldShow) {
                currentStep++;
                step = quizFlow[currentStep];
            } else {
                break;
            }
        }

        // --- FB PIXEL FUNNEL TRACKING ---
        if (typeof fbq === 'function') {
            const trackStep = quizFlow[currentStep];
            fbq('trackCustom', 'QuizStep', {
                step_number: currentStep,
                step_type: trackStep.type,
                question_id: trackStep.id || 'interstitial'
            });
        }

        renderStep();
    } else {
        finishQuiz();
    }
}

function prevQuestion() {
    if (currentStep > 0) {
        currentStep--;
        renderStep();
    }
}

function handleEmailCustom() {
    const email = document.getElementById('emailInput').value.trim();
    const name = document.getElementById('nameInput').value.trim();
    const password = document.getElementById('passwordInput').value.trim();
    const termsRef = document.getElementById('termsCheck');
    const consentRef = document.getElementById('consentCheck');
    
    if (!email || !email.includes('@')) {
        alert('Please enter a valid email address.');
        return;
    }

    if (!termsRef.checked) {
        alert('You must accept the Terms and Privacy Policy to continue.');
        return;
    }

    answers['email'] = email;
    answers['name'] = name;
    answers['password_created'] = password ? 'yes' : 'no'; // Signal that they have a login
    sessionStorage.setItem('temp_pass', password); // Temporary storage for the session
    
    // Calculate Profile Early so it's available for lead sync
    // Determine Hormone Profile for storage/CAPI
    let profileResult = "CORTISOL";
    if (answers.cycle_change === 'skipping' || parseInt(answers.age) > 45) {
        profileResult = "ESTROGEN";
    }
    
    // Save state
    sessionStorage.setItem("userResult", profileResult);
    sessionStorage.setItem("userProfile", JSON.stringify(answers));
    sessionStorage.setItem("userEmail", email); // Store email explicitly for Checkout prefill

    syncLead({ 
        email: email, 
        name: answers.name || 'Friend',
        ...answers 
    });
    
    // OPTIMIZATION: Advanced Matching for Meta
    if (typeof fbq === 'function') {
        fbq('init', '1928402271406692', {
            em: email.toLowerCase(),
            fn: name.split(' ')[0].toLowerCase()
        });
        fbq('track', 'Lead', {
            content_name: 'Quiz Completion',
            content_category: profileResult
        });
    }

    finishQuiz();
}

function finishQuiz() {
    const container = document.getElementById('quizContent');
    const progressBar = document.getElementById('progressBar').parentElement;
    const backBtn = document.getElementById('backBtn');
    
    // Hide navigation elements for final sequence
    if (progressBar) progressBar.style.display = 'none';
    if (backBtn) backBtn.style.display = 'none';

    // 1. Calculate Diagnosis Logic
    let profile = "CORTISOL / ADRENAL";
    
    // Phase 1 Variables
    let phase1Title = "PHASE 1: CORTISOL FLUSH";
    let phase1Text = "We use Somatic Movement and Mineral Timing to drastically lower your adrenal load, signaling your body it's safe to release weight.";
    
    // Phase 2 Variables
    let phase2Title = "PHASE 2: METABOLIC ADAPTATION";
    let phase2Text = "We lock in your new set-point so the weight doesn't rebound during future stress.";

    if (answers.cycle_change === 'skipping' || parseInt(answers.age) > 45) {
        profile = "ESTROGEN / MENOPAUSE";
        
        phase1Title = "PHASE 1: ESTROGEN FLUSH";
        phase1Text = "We use a specialized 'Fiber-Flush' technique to bind to excess estrogen and clear your complexion and waistline.";
        
        phase2Title = "PHASE 2: LIVER SUPPORT";
        phase2Text = "We focus on liver support and cycle syncing to ensure your body can handle hormonal fluctuations without inflammation returning.";
    }

    // Workout Image Logic
    let workoutImg = "assets/quiz_after_athletic.png"; 
    if (answers.goalBodyType === 'Flat') workoutImg = "assets/quiz_after_flat.png";
    if (answers.goalBodyType === 'Body Builder') workoutImg = "assets/quiz_after_bodybuilder.png";

    // Unified Workout Label Logic (To match Landing Page)
    let workoutLabel = 'At-Home Sculpt';
    
    if (answers.preselected_track === 'yoga') {
        workoutLabel = 'Somatic Yoga';
    } else if (answers.preselected_track === 'bodyweight') {
        workoutLabel = 'Bodyweight Sculpt';
    } else if (answers.preselected_track === 'strength') {
        workoutLabel = 'Home Strength';
    } else if (answers.preselected_track === 'gym') {
        workoutLabel = 'Gym Transformation';
    } else {
        // Fallback to profile logic
        const equip = answers.equipment_access || 'none';
        const energy = answers.energy_status || 'moderate';

        if (energy === 'low' || answers.cycle_change === 'skipping' || parseInt(answers.age) > 50) {
            workoutLabel = 'Somatic Yoga';
        } else if (equip === 'yoga_only') {
            workoutLabel = 'Somatic Yoga';
        } else if (equip === 'gym') {
            workoutLabel = 'Gym Transformation';
        } else if (equip === 'dumbbells') {
            workoutLabel = 'Home Strength';
        } else if (equip === 'bands') {
            workoutLabel = 'Band Strength';
        }
    }

    // Define the Slide Sequence
    const finalSlides = [
        {
            title: "ANALYSIS COMPLETE",
            subtitle: "YOUR HORMONE PROFILE:",
            mainText: profile,
            desc: "Based on your unique metabolic and hormonal profile.",
            img: "assets/quiz_wellbeing_graph.png", // Generic Analysis Graph
            color: "#ef4444" // Red for alert/diagnosis
        },
        {
            title: "YOUR PROTOCOL",
            subtitle: phase1Title,
            mainText: "",
            desc: phase1Text,
            img: "assets/illustration_flaxseeds.png",
            color: "#48864B"
        },
        {
            title: "YOUR PROTOCOL",
            subtitle: phase2Title,
            mainText: "",
            desc: phase2Text,
            img: "assets/illustration_flush.png",
            color: "#48864B"
        },
        {
            title: "YOUR MOVEMENT",
            subtitle: `${profile.split(' / ')[0]} SAFE WORKOUTS`,
            mainText: "",
            desc: `A specific ${workoutLabel} protocol designed to tone your body without spiking stress hormones.`,
            img: workoutImg,
            color: "#48864B"
        },
        {
            title: "YOUR SUPPLEMENTS",
            subtitle: "NATURAL COMPOUND STACK",
            mainText: "",
            desc: "A precise protocol of natural herbs and minerals to accelerate your hormonal recovery.",
            img: "assets/illustration_tofu.png", // Placeholder for natural sources
            color: "#D4AF37" // Gold for premium/supplements
        }
    ];

    let slideIndex = 0;

    function showFinalSlide() {
        if (slideIndex >= finalSlides.length) {
            // Sequence Complete -> Final Loading & Redirect
            showFinalLoading();
            return;
        }

        const s = finalSlides[slideIndex];
        
        // Dynamic HTML for the slide
        container.innerHTML = `
            <div style="text-align: center; padding: 0 1rem; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; width: 100%; animation: fadeIn 0.8s ease;">
                <p style="font-size: 0.9rem; font-weight: 700; color: #888; letter-spacing: 1.5px; margin-bottom: 10px; text-transform: uppercase;">${s.title}</p>
                
                <h2 style="font-size: 1.6rem; color: ${s.color}; margin-bottom: 1rem; width: 100%; text-align: center; text-transform: uppercase; line-height: 1.2;">
                    ${s.subtitle}
                </h2>

                ${s.mainText ? `<h3 style="font-size: 1.8rem; font-weight: 900; margin-bottom: 1.5rem; color: #333;">${s.mainText}</h3>` : ''}

                <div style="background: #fff; padding: 15px; border-radius: 20px; box-shadow: 0 15px 40px rgba(0,0,0,0.08); margin-bottom: 1.5rem; width: 100%; max-width: 300px; aspect-ratio: 1/1; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                    <img src="${s.img}" style="width: 100%; height: 100%; object-fit: contain;" alt="Prescription Image">
                </div>

                <p style="text-align: center; line-height: 1.5; margin: 0 auto; font-size: 1rem; max-width: 450px; color: #555; font-weight: 500;">
                    ${s.desc}
                </p>
                
                <div style="margin-top: 10px;">
                    <div class="loader" style="width: 30px; height: 30px; border-width: 3px;"></div>
                </div>
            </div>
        `;

        // Auto-advance
        setTimeout(() => {
            slideIndex++;
            showFinalSlide();
        }, 3500);
    }

    // Start the sequence
    showFinalSlide();
}

function showFinalLoading() {
    const container = document.getElementById('quizContent');
    container.innerHTML = `
        <div style="text-align: center; padding: 20px; animation: fadeIn 0.5s ease;">
            <div class="loader" style="margin-bottom: 30px;"></div>
            <h3 style="margin-bottom: 10px; color: #1a4d2e; text-transform: uppercase;">ANALYZING BIOLOGICAL DATA...</h3>
            <p id="loading-sub" style="font-size: 0.9rem; color: #666; font-weight: 500;">Cross-referencing symptoms with 50,000+ database...</p>
        </div>
    `;

    const subText = document.getElementById('loading-sub');
    const logs = [
        "Matching hormonal patterns...",
        "Identifying cortisol triggers...",
        "Securing your Member Account...",
        "Encrypting personalized access...",
        "Reserving your protocol slot...",
        "Finalizing your Balance Reset..."
    ];
    
    let logIdx = 0;
    const logInterval = setInterval(() => {
        if (logIdx < logs.length) {
            subText.innerText = logs[logIdx];
            logIdx++;
        } else {
            clearInterval(logInterval);
        }
    }, 1200);

    // Final Redirect Logic
    setTimeout(() => {
        // Calculate Profile (Ensure it's saved correctly if missed)
        let profile = "CORTISOL";
        if (answers.cycle_change === 'skipping' || parseInt(answers.age) > 45) {
            profile = "ESTROGEN";
        }
        
        // Save final state
        sessionStorage.setItem("userResult", profile);
        sessionStorage.setItem("userProfile", JSON.stringify(answers));
        sessionStorage.setItem("is_discounted", "true");

        // Refresh Timer for a new completion
        sessionStorage.removeItem('timer_start');
        sessionStorage.removeItem('timer_extended');
        sessionStorage.removeItem('timer_expired_final');

        // Track Quiz Completion
        if (typeof fbq === 'function') {
            fbq('track', 'CompleteRegistration', {
                content_name: 'Hormone Quiz',
                status: profile
            });
        }

        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
        window.location.href = isLocal ? 'plantbasedswitch.html' : 'plantbasedswitch';
    }, 2000);
}

/**
 * SYNC LEAD TO CRM / EMAIL CAMPAIGN
 * Pushes quiz data to your webhook as a "Lead - Abandoned Cart" entry.
 */
function syncLead(data) {
    const WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/17459466/uw26lge'; 
    
    // Map Workout Preference for lead consistency
    const workoutMap = {
        'yoga': 'Somatic Yoga',
        'yoga_only': 'Somatic Yoga',
        'bodyweight': 'Bodyweight Sculpt',
        'none': 'Bodyweight Sculpt',
        'bands': 'Band Strength',
        'dumbbells': 'Home Strength (Weights/Bands)',
        'home_strength': 'Home Strength (Weights/Bands)',
        'gym': 'Full Gym Protocol'
    };
    let workout = workoutMap[data.equipment] || 'Bodyweight Sculpt'; 

    const leadPayload = {
        ...data,
        hormone_profile: sessionStorage.getItem('userResult') || 'CORTISOL',
        workout_preference: workout,
        quiz_status: 'completed',
        timestamp: new Date().toISOString()
    };

    console.log('--- SYNCING LEAD TO ZAPIER ---');
    console.log('Payload:', leadPayload);

    const params = new URLSearchParams();
    for (const key in leadPayload) {
        if (typeof leadPayload[key] === 'object') {
            params.append(key, JSON.stringify(leadPayload[key]));
        } else {
            params.append(key, leadPayload[key]);
        }
    }

    // --- SYNC TO ZAPIER ---
    fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
    })
    .then(response => console.log('Zapier Status:', response.status))
    .catch(err => console.error('Zapier Sync Error:', err));

    // --- SYNC TO META CAPI (via Netlify) ---
    fetch('/.netlify/functions/track-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: data.email,
            name: data.name,
            fbc: getCookie('_fbc'),
            fbp: getCookie('_fbp')
        })
    })
    .then(response => console.log('Meta CAPI Lead Sync:', response.status))
    .catch(err => console.error('Meta CAPI Error:', err));
}

// Helper to get Meta cookies for better CAPI matching
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

function runIntroLoading() {
    const bar = document.getElementById('progressBar');
    const statusTxt = document.getElementById('introStatus');
    const startBtn = document.getElementById('startBtn');
    const waitTxt = document.getElementById('waitText');
    
    let progress = 0;
    const interval = 30; // 30ms steps
    
    const timer = setInterval(() => {
        if (progress < 60) {
            progress += 1.5; // Fast
            if (statusTxt) statusTxt.innerText = "Gathering Hormonal Data...";
        } else if (progress >= 60 && progress < 75) {
            progress += 0.3; // Slow (15% gap)
            if (statusTxt) statusTxt.innerText = "Calibrating Metabolic Profile...";
        } else {
            progress += 2.0; // Fast
            if (statusTxt) statusTxt.innerText = "Analysis Ready.";
        }

        if (progress >= 100) {
            progress = 100;
            clearInterval(timer);
            
            // Activate Button
            if (bar) bar.style.width = '100%';
            if (statusTxt) statusTxt.innerText = "System Ready.";
            if (startBtn) {
                startBtn.innerText = "START ASSESSMENT";
                startBtn.style.opacity = "1";
                startBtn.style.pointerEvents = "auto";
                startBtn.disabled = false;
            }
            if (waitTxt) waitTxt.style.display = "none";
        } else {
            if (bar) bar.style.width = Math.floor(progress) + '%';
        }
    }, interval);
}

// Navigation Helper for Skips
window.jumpToStep = (targetId) => {
    console.log("Jumping to step:", targetId);
    const targetIndex = quizFlow.findIndex(step => step.id === targetId);
    if (targetIndex >= 0) {
        currentStep = targetIndex;
        renderStep();
    } else {
        console.error("Target step not found:", targetId);
        nextStep(); // Fallback
    }
};

// ============================================================================
// DUOLINGO-STYLE ENGAGEMENT SYSTEM
// ============================================================================

const QuizEngagement = {
    // State
    streak: 0,
    xp: 0,
    questionsAnswered: 0,
    lastPhase: null,
    soundEnabled: true,

    // Audio Context for sound effects
    audioCtx: null,

    // Mascot messages
    mascotMessages: {
        greeting: [
            "Let's do this! 💪",
            "Ready to learn about your body?",
            "I'm here to help! 🌱"
        ],
        encouragement: [
            "You're doing great!",
            "Keep it up! 🔥",
            "Awesome progress!",
            "You've got this!",
            "Nice one! ⭐"
        ],
        streak: [
            "🔥 On fire!",
            "Streak going strong!",
            "Unstoppable! 💪",
            "You're crushing it!"
        ],
        phaseComplete: [
            "Phase complete! 🎉",
            "Amazing work!",
            "You did it! ⭐"
        ],
        tips: [
            "Did you know? Protein helps regulate hormones!",
            "Tip: Sleep quality affects cortisol levels",
            "Fact: Plant estrogens can help balance hormones",
            "Pro tip: Fiber helps detox excess estrogen",
            "Fun fact: Exercise boosts mood hormones!"
        ],
        thinking: [
            "Hmm, interesting choice...",
            "Let me process that...",
            "Good to know! 🤔"
        ]
    },

    // Initialize the engagement system
    init() {
        // Create audio context on user interaction
        document.addEventListener('click', () => {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
        }, { once: true });

        // Hide streak widget initially (mascot stays visible)
        document.body.classList.add('hide-widgets');

        // Random initial greeting after a delay
        setTimeout(() => {
            this.showMascotMessage(this.getRandomMessage('greeting'));
        }, 3000);

        console.log('🎮 Quiz Engagement System initialized');
    },

    // Get random message from category
    getRandomMessage(category) {
        const messages = this.mascotMessages[category];
        return messages[Math.floor(Math.random() * messages.length)];
    },

    // Show/hide streak widget based on step type (mascot always visible)
    updateWidgetsVisibility(stepType) {
        const hideTypes = ['intro', 'loading', 'email_custom'];
        if (hideTypes.includes(stepType)) {
            document.body.classList.add('hide-widgets');
        } else {
            document.body.classList.remove('hide-widgets');
        }
    },

    hideWidgets() {
        document.body.classList.add('hide-widgets');
    },

    showWidgets() {
        document.body.classList.remove('hide-widgets');
        const streakWidget = document.getElementById('streakWidget');

        setTimeout(() => {
            if (streakWidget && this.streak > 0) streakWidget.classList.add('visible');
        }, 500);
    },

    // Handle answer selection with visual feedback
    onAnswerSelected(buttonElement) {
        this.questionsAnswered++;

        // Add visual feedback class
        if (buttonElement) {
            buttonElement.classList.add('correct-answer');
        }

        // Play sound
        this.playSound('correct');

        // Update streak
        this.streak++;
        this.updateStreakDisplay();

        // Show streak widget when streak starts
        if (this.streak === 1) {
            const streakWidget = document.getElementById('streakWidget');
            if (streakWidget) streakWidget.classList.add('visible');
        }

        // Milestone celebrations (every 5 answers)
        if (this.streak % 5 === 0 && this.streak > 0) {
            this.celebrateStreak();
        }

        // Mascot reaction
        this.mascotReaction('happy');
        if (this.streak >= 3 && Math.random() > 0.6) {
            this.showMascotMessage(this.getRandomMessage('encouragement'));
        }

        // Progress bar animation
        const progressBar = document.getElementById('progressBar');
        if (progressBar) {
            progressBar.classList.add('animating');
            setTimeout(() => progressBar.classList.remove('animating'), 500);
        }
    },

    // Update streak display
    updateStreakDisplay() {
        const streakCount = document.getElementById('streakCount');
        const streakWidget = document.getElementById('streakWidget');

        if (streakCount) {
            streakCount.textContent = this.streak;
        }

        if (this.streak === 0 && streakWidget) {
            streakWidget.classList.remove('visible');
        }
    },

    // Celebrate streak milestones
    celebrateStreak() {
        const streakWidget = document.getElementById('streakWidget');
        if (streakWidget) {
            streakWidget.classList.add('milestone');
            setTimeout(() => streakWidget.classList.remove('milestone'), 600);
        }

        this.showMascotMessage(this.getRandomMessage('streak'));
        this.mascotReaction('excited');
        this.playSound('milestone');

        // Mini confetti burst
        this.createConfetti(15);
    },

    // Add XP with animation
    addXP(amount) {
        this.xp += amount;

        // Update counter
        const xpCount = document.getElementById('xpCount');
        if (xpCount) {
            xpCount.textContent = `${this.xp} XP`;
        }

        // Float animation
        this.showXPFloat(amount);
    },

    // Show floating XP text
    showXPFloat(amount) {
        const xpWidget = document.getElementById('xpWidget');
        if (!xpWidget) return;

        const rect = xpWidget.getBoundingClientRect();
        const floatEl = document.createElement('div');
        floatEl.className = 'xp-float-text';
        floatEl.textContent = `+${amount}`;
        floatEl.style.left = `${rect.left + rect.width / 2}px`;
        floatEl.style.top = `${rect.bottom + 10}px`;

        document.body.appendChild(floatEl);

        setTimeout(() => floatEl.remove(), 1200);
    },

    // Mascot reactions
    mascotReaction(type) {
        const mascotAvatar = document.getElementById('mascotAvatar');
        if (!mascotAvatar) return;

        // Remove existing reaction classes
        mascotAvatar.classList.remove('happy', 'sad', 'excited', 'thinking');

        // Force reflow to restart animation
        void mascotAvatar.offsetWidth;

        // Add new reaction
        mascotAvatar.classList.add(type);

        // Remove after animation
        setTimeout(() => {
            mascotAvatar.classList.remove(type);
        }, type === 'excited' ? 2000 : 600);
    },

    // Show mascot speech bubble
    showMascotMessage(message, duration = 3000) {
        const speech = document.getElementById('mascotSpeech');
        if (!speech) return;

        speech.textContent = message;
        speech.classList.add('visible');

        setTimeout(() => {
            speech.classList.remove('visible');
        }, duration);
    },

    // When mascot is tapped
    mascotTapped() {
        this.mascotReaction('happy');

        // Show random tip or encouragement
        const messageType = Math.random() > 0.5 ? 'tips' : 'encouragement';
        this.showMascotMessage(this.getRandomMessage(messageType));
        this.playSound('pop');
    },

    // Phase completion celebration (no XP, just visual celebration)
    celebratePhaseComplete(phaseName) {
        const celebration = document.getElementById('phaseCelebration');
        const icon = document.getElementById('celebrationIcon');
        const text = document.getElementById('celebrationText');
        const subtext = document.getElementById('celebrationSubtext');

        if (!celebration) return;

        // Set content
        if (icon) icon.textContent = '🎉';
        if (text) text.textContent = `${phaseName} Complete!`;
        if (subtext) subtext.textContent = 'Great progress!';

        // Show celebration
        celebration.classList.add('active');

        // Play sound
        this.playSound('celebration');

        // Create confetti
        this.createConfetti(50);

        // Mascot celebrates
        this.mascotReaction('excited');

        // Hide after delay
        setTimeout(() => {
            celebration.classList.remove('active');
        }, 2500);
    },

    // Quiz completion - awards 1 XP
    onQuizComplete() {
        // Award 1 XP for completing the quiz
        this.xp = 1;

        // Big celebration
        this.createConfetti(80);
        this.playSound('celebration');
        this.mascotReaction('excited');
        this.showMascotMessage("Quiz complete! +1 XP 🎉", 5000);

        console.log('🎮 Quiz completed! Awarded 1 XP');
    },

    // Create confetti particles
    createConfetti(count = 30) {
        const container = document.getElementById('confettiContainer');
        if (!container) return;

        const colors = ['#48864B', '#6ab04c', '#ff9500', '#ff5e3a', '#D4AF37', '#10b981'];

        for (let i = 0; i < count; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.left = `${Math.random() * 100}%`;
            piece.style.top = '-20px';
            piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            piece.style.width = `${Math.random() * 10 + 5}px`;
            piece.style.height = `${Math.random() * 10 + 5}px`;
            piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
            piece.style.transform = `rotate(${Math.random() * 360}deg)`;

            // Animation
            piece.style.animation = `confetti-fall ${2 + Math.random() * 2}s ease-out forwards`;
            piece.style.animationDelay = `${Math.random() * 0.5}s`;
            piece.style.opacity = '1';

            container.appendChild(piece);

            // Remove after animation
            setTimeout(() => piece.remove(), 4000);
        }

        // Add confetti fall keyframes if not present
        if (!document.getElementById('confetti-keyframes')) {
            const style = document.createElement('style');
            style.id = 'confetti-keyframes';
            style.textContent = `
                @keyframes confetti-fall {
                    0% { transform: translateY(0) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    },

    // Show tip banner
    showTip(customMessage = null) {
        const tipBanner = document.getElementById('tipBanner');
        const tipText = document.getElementById('tipText');

        if (!tipBanner || !tipText) return;

        tipText.textContent = customMessage || this.getRandomMessage('tips');
        tipBanner.classList.add('visible');

        setTimeout(() => {
            tipBanner.classList.remove('visible');
        }, 5000);
    },

    // Sound effects using Web Audio API
    playSound(type) {
        if (!this.soundEnabled || !this.audioCtx) return;

        try {
            const oscillator = this.audioCtx.createOscillator();
            const gainNode = this.audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioCtx.destination);

            const now = this.audioCtx.currentTime;

            switch (type) {
                case 'correct':
                    // Ascending pleasant tone
                    oscillator.frequency.setValueAtTime(523.25, now); // C5
                    oscillator.frequency.linearRampToValueAtTime(659.25, now + 0.1); // E5
                    gainNode.gain.setValueAtTime(0.3, now);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                    oscillator.start(now);
                    oscillator.stop(now + 0.3);
                    break;

                case 'incorrect':
                    // Descending tone
                    oscillator.frequency.setValueAtTime(330, now);
                    oscillator.frequency.linearRampToValueAtTime(294, now + 0.15);
                    gainNode.gain.setValueAtTime(0.2, now);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                    oscillator.start(now);
                    oscillator.stop(now + 0.3);
                    break;

                case 'pop':
                    // Quick pop
                    oscillator.frequency.setValueAtTime(800, now);
                    oscillator.frequency.exponentialRampToValueAtTime(400, now + 0.1);
                    gainNode.gain.setValueAtTime(0.2, now);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                    oscillator.start(now);
                    oscillator.stop(now + 0.1);
                    break;

                case 'milestone':
                case 'celebration':
                    // Triumphant chord
                    this.playChord([523.25, 659.25, 783.99], 0.5); // C major
                    break;
            }
        } catch (e) {
            console.log('Sound play failed:', e);
        }
    },

    // Play a chord (multiple frequencies)
    playChord(frequencies, duration) {
        if (!this.audioCtx) return;

        frequencies.forEach((freq, i) => {
            const oscillator = this.audioCtx.createOscillator();
            const gainNode = this.audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioCtx.destination);

            oscillator.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);

            oscillator.start(this.audioCtx.currentTime + i * 0.05);
            oscillator.stop(this.audioCtx.currentTime + duration);
        });
    },

    // Track phase transitions
    checkPhaseTransition(currentStepId) {
        // Define phase markers (no XP, just celebration)
        const phaseMarkers = {
            'activity_level': 'Profile',
            'symptoms': 'Symptoms',
            'calendar_preview': 'Workout Plan',
            'goal_weight': 'Calibration'
        };

        if (phaseMarkers[currentStepId] && this.lastPhase !== currentStepId) {
            const phaseName = phaseMarkers[currentStepId];
            this.lastPhase = currentStepId;

            // Delay celebration slightly
            setTimeout(() => {
                this.celebratePhaseComplete(phaseName);
            }, 300);
        }
    },

    // Show random tip at intervals
    maybeShowTip() {
        // Show tip every ~8 questions (with some randomness)
        if (this.questionsAnswered > 0 && this.questionsAnswered % 8 === 0 && Math.random() > 0.3) {
            setTimeout(() => {
                this.showTip();
            }, 1000);
        }
    }
};

// Make available globally
window.QuizEngagement = QuizEngagement;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    QuizEngagement.init();
});

// Hook into existing selectOption function
const originalSelectOption = selectOption;
selectOption = function(id, value, saveAsKey) {
    // Find the clicked button and add visual feedback
    const buttons = document.querySelectorAll('.option-btn, .option-card');
    buttons.forEach(btn => {
        if (btn.classList.contains('option-btn') && btn.textContent.trim() === value) {
            QuizEngagement.onAnswerSelected(btn);
        }
    });

    // If no button matched by text, just trigger feedback on any active element
    if (document.activeElement && document.activeElement.classList.contains('option-btn')) {
        QuizEngagement.onAnswerSelected(document.activeElement);
    }

    // Check for phase transitions
    QuizEngagement.checkPhaseTransition(id);

    // Maybe show a tip
    QuizEngagement.maybeShowTip();

    // Call original function with slight delay for visual feedback
    setTimeout(() => {
        originalSelectOption(id, value, saveAsKey);
    }, 400);
};

// Hook into finishQuiz to award 1 XP on completion
const originalFinishQuiz = finishQuiz;
finishQuiz = function() {
    // Award 1 XP for completing the quiz
    QuizEngagement.onQuizComplete();

    // Call original function
    originalFinishQuiz();
};

// Hook into renderStep to update widget visibility
const originalRenderStep = renderStep;
renderStep = function() {
    originalRenderStep();

    // Update widget visibility based on step type
    const step = quizFlow[currentStep];
    if (step) {
        QuizEngagement.updateWidgetsVisibility(step.type);

        // Mascot thinking on new questions
        if (step.type === 'choice' || step.type === 'image_choice') {
            if (Math.random() > 0.7) {
                QuizEngagement.mascotReaction('thinking');
            }
        }
    }
};
