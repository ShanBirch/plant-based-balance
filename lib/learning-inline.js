/**
 * ✅ ACTIVE FILE - Learning System (Inline Version)
 * ✅ This is the file used by dashboard.html - edit this one for learning features!
 *
 * Duolingo-style fitness education with games and XP rewards
 * This version works without ES modules for compatibility with existing app architecture
 *
 * Note: lib/learning.js exists but is NOT used - it's kept for future ES module migration.
 */

(function() {
    'use strict';

    // =============================================================================
    // CONFIGURATION
    // =============================================================================

    const LEARNING_XP = {
        LESSON_COMPLETE: 1,
        UNIT_COMPLETE_BONUS: 2,
        MODULE_COMPLETE_BONUS: 5,
        DAILY_LESSON_LIMIT: 3,
    };

    const GAME_TYPES = {
        SWIPE_TRUE_FALSE: 'swipe_true_false',
        MATCH_PAIRS: 'match_pairs',
        ORDER_SEQUENCE: 'order_sequence',
        FILL_BLANK: 'fill_blank',
        SCENARIO_STORY: 'scenario_story',
        TAP_ALL: 'tap_all',
    };

    const MODULES = {
        body: {
            id: 'body',
            title: 'Body',
            subtitle: 'Anatomy & Movement',
            icon: 'bone',
            color: '#E57373',
            description: 'Understand how your body works, moves, and adapts to training.',
            order: 1,
        },
        fuel: {
            id: 'fuel',
            title: 'Fuel',
            subtitle: 'Nutrition & Energy',
            icon: 'apple',
            color: '#81C784',
            description: 'Learn how food becomes energy and fuels your transformation.',
            order: 2,
        },
        mind: {
            id: 'mind',
            title: 'Mind',
            subtitle: 'Brain & Adaptation',
            icon: 'brain',
            color: '#7986CB',
            description: 'Discover how your brain predicts, adapts, and creates lasting change.',
            order: 3,
        },
        longevity: {
            id: 'longevity',
            title: 'Longevity',
            subtitle: 'Health Span & Disease Prevention',
            icon: 'heart-pulse',
            color: '#9575CD',
            description: 'Learn how to extend your healthy years and prevent chronic disease through science-backed strategies.',
            order: 4,
        },
        workouts: {
            id: 'workouts',
            title: 'Workouts',
            subtitle: 'Training Science & Programming',
            icon: 'dumbbell',
            color: '#FF7043',
            description: 'Master the science of training—from adaptation principles to strength, hypertrophy, and cardiovascular programming.',
            order: 5,
        },
        hormones: {
            id: 'hormones',
            title: 'Hormones',
            subtitle: 'Chemical Signaling & Metabolism',
            icon: 'activity',
            color: '#F06292',
            description: 'Understand how hormones regulate everything from energy and metabolism to stress, recovery, and adaptation.',
            order: 6,
        },
    };

    const UNITS = {
        'body-1': { id: 'body-1', moduleId: 'body', title: 'Muscle Basics', description: 'The building blocks of movement', order: 1 },
        'body-2': { id: 'body-2', moduleId: 'body', title: 'The Core Foundation', description: 'Your center of power', order: 2 },
        'body-3': { id: 'body-3', moduleId: 'body', title: 'The Kinetic Chain', description: 'How muscles work together', order: 3 },
        'body-4': { id: 'body-4', moduleId: 'body', title: 'Posture & Form', description: 'Moving with intention', order: 4 },
        'body-5': { id: 'body-5', moduleId: 'body', title: 'Training Smart', description: 'Principles that work', order: 5 },
        'fuel-1': { id: 'fuel-1', moduleId: 'fuel', title: 'Energy Fundamentals', description: 'What powers your body', order: 1 },
        'fuel-2': { id: 'fuel-2', moduleId: 'fuel', title: 'Macronutrients', description: 'Protein, carbs, and fats', order: 2 },
        'fuel-3': { id: 'fuel-3', moduleId: 'fuel', title: 'Micronutrients', description: 'The hidden essentials', order: 3 },
        'fuel-4': { id: 'fuel-4', moduleId: 'fuel', title: 'Meal Timing', description: 'When you eat matters', order: 4 },
        'fuel-5': { id: 'fuel-5', moduleId: 'fuel', title: 'Fueling for Goals', description: 'Eating with purpose', order: 5 },
        'fuel-6': { id: 'fuel-6', moduleId: 'fuel', title: 'Emotional Eating Decoded', description: 'What cravings really are', order: 6 },
        'fuel-7': { id: 'fuel-7', moduleId: 'fuel', title: 'Vitamins & Supplements Quiz', description: 'Test your supplement knowledge', order: 7 },
        'fuel-8': { id: 'fuel-8', moduleId: 'fuel', title: 'Supplement Game', description: 'Play to master supplements', order: 8 },
        'mind-1': { id: 'mind-1', moduleId: 'mind', title: 'The Prediction Machine', description: 'Your brain constructs reality', order: 1 },
        'mind-2': { id: 'mind-2', moduleId: 'mind', title: 'Body Budgeting', description: 'Allostasis and energy management', order: 2 },
        'mind-3': { id: 'mind-3', moduleId: 'mind', title: 'Experience Shapes Reality', description: 'Your past creates your present', order: 3 },
        'mind-4': { id: 'mind-4', moduleId: 'mind', title: 'Training the Predictive Brain', description: 'Why consistency transforms', order: 4 },
        'mind-5': { id: 'mind-5', moduleId: 'mind', title: 'Becoming Your Future Self', description: 'Identity and lasting change', order: 5 },
        'mind-6': { id: 'mind-6', moduleId: 'mind', title: 'Change Is Counter-Intuitive', description: 'Why environment changes you, not willpower', order: 6 },
        'mind-7': { id: 'mind-7', moduleId: 'mind', title: 'The Free Energy Principle', description: 'How your brain actually works', order: 7 },
        'mind-8': { id: 'mind-8', moduleId: 'mind', title: 'Why Your Brain Resists Learning', description: 'Surprise is expensive', order: 8 },
        'longevity-1': { id: 'longevity-1', moduleId: 'longevity', title: 'The Science of Aging', description: 'Why we age and what we can do about it', order: 1 },
        'longevity-2': { id: 'longevity-2', moduleId: 'longevity', title: 'Metabolic Health', description: 'Blood sugar, insulin, and disease risk', order: 2 },
        'longevity-3': { id: 'longevity-3', moduleId: 'longevity', title: 'Chronic Disease Prevention', description: 'The big killers and how to avoid them', order: 3 },
        'longevity-4': { id: 'longevity-4', moduleId: 'longevity', title: 'Cellular Health & Repair', description: 'Autophagy, mitochondria, and regeneration', order: 4 },
        'longevity-5': { id: 'longevity-5', moduleId: 'longevity', title: 'Lifestyle Medicine', description: 'Sleep, stress, and the pillars of longevity', order: 5 },
        'workouts-1': { id: 'workouts-1', moduleId: 'workouts', title: 'Training Fundamentals', description: 'Core principles of adaptation', order: 1 },
        'workouts-2': { id: 'workouts-2', moduleId: 'workouts', title: 'Strength Training', description: 'Neural adaptations and force production', order: 2 },
        'workouts-3': { id: 'workouts-3', moduleId: 'workouts', title: 'Hypertrophy Training', description: 'Muscle growth science', order: 3 },
        'workouts-4': { id: 'workouts-4', moduleId: 'workouts', title: 'Cardiovascular Training', description: 'Energy systems and endurance', order: 4 },
        'workouts-5': { id: 'workouts-5', moduleId: 'workouts', title: 'Advanced Modalities', description: 'Power, HIIT, and concurrent training', order: 5 },
        'hormones-1': { id: 'hormones-1', moduleId: 'hormones', title: 'The Chemical Messenger System', description: 'How hormones work', order: 1 },
        'hormones-2': { id: 'hormones-2', moduleId: 'hormones', title: 'Energy Mobilizers', description: 'Cortisol, adrenaline, and energy', order: 2 },
        'hormones-3': { id: 'hormones-3', moduleId: 'hormones', title: 'The Anabolic Messengers', description: 'Building hormones', order: 3 },
        'hormones-4': { id: 'hormones-4', moduleId: 'hormones', title: 'Metabolic Regulators', description: 'Insulin, thyroid, and metabolism', order: 4 },
        'hormones-5': { id: 'hormones-5', moduleId: 'hormones', title: 'Sex Hormones in Context', description: 'Estrogen, testosterone, and balance', order: 5 },
    };

    // =============================================================================
    // LESSON CONTENT (Abbreviated for initial version - full content in separate file)
    // =============================================================================

    const LESSONS = {
        'mind-1': [
            {
                id: 'mind-1-1', unitId: 'mind-1', order: 1, title: "You Don't See Reality",
                content: {
                    intro: `Here's something that will change how you see everything: You don't actually perceive the world directly.\n\nYour brain doesn't work like a camera, passively recording what's "out there." Instead, it actively CONSTRUCTS your experience based on predictions.\n\nRight now, your brain is generating a simulation of reality—and checking it against the tiny trickle of sensory data coming in. What you "see" is the simulation, not the raw data.`,
                    keyPoint: "Your experience is a controlled hallucination—a best guess your brain makes about what's causing your sensory signals.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Your eyes send a complete picture to your brain like a camera.", answer: false, explanation: "Your eyes send incomplete, compressed signals. Your brain fills in most of what you 'see' from predictions." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Your brain _______ reality rather than passively recording it.", options: ['constructs', 'copies', 'ignores', 'delays'], answer: 'constructs' },
                    { type: GAME_TYPES.TAP_ALL, question: "What does your brain do with sensory input?", options: [
                        { text: "Records it like a video camera", correct: false },
                        { text: "Makes predictions about what's happening", correct: true },
                        { text: "Fills in gaps with best guesses", correct: true },
                        { text: "Creates a simulation of reality", correct: true },
                        { text: "Passes it through unchanged", correct: false },
                    ]},
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Camera", right: "Passively records" },
                        { left: "Brain", right: "Actively constructs" },
                        { left: "Your eyes", right: "Send incomplete signals" },
                        { left: "Your experience", right: "A controlled hallucination" },
                    ]},
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "You walk into a dark room and 'see' a snake on the floor. Your heart races. You turn on the light—it's a rope.", question: "What happened?", options: [
                        { text: "Your eyes made a mistake", correct: false },
                        { text: "Your brain predicted 'snake' based on limited data and past experience", correct: true },
                        { text: "The lighting was bad", correct: false },
                    ], explanation: "Your brain made a prediction based on shape, context, and your history. The fear was real because the prediction was real." },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "What you 'see' is the actual raw data from your eyes.", answer: false, explanation: "What you see is your brain's simulation—a best guess about what's causing your sensory signals." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Put the steps of perception in order, from what happens first to last:", items: [
                        "1. Light hits your eyes",
                        "2. Compressed signals travel to brain",
                        "3. Brain generates predictions about what it expects",
                        "4. Brain compares its predictions to the actual signals",
                        "5. You experience the brain's best guess as reality",
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Your experience is a 'controlled _______' - a best guess your brain makes.", options: ['hallucination', 'recording', 'memory', 'reaction'], answer: 'hallucination' },
                ]
            },
            {
                id: 'mind-1-2', unitId: 'mind-1', order: 2, title: "Prediction First, Sensation Second",
                content: {
                    intro: `Your brain generates predictions BEFORE sensory signals even arrive.\n\nThink about that. Your brain isn't waiting to see what happens—it's already guessing. Sensory data from your eyes, ears, and body only matters when it DIFFERS from what your brain predicted.\n\nThis is why you don't notice the feeling of your clothes until someone mentions it. Your brain predicted that sensation, so it didn't bother telling "you" about it.`,
                    keyPoint: "Prediction comes first. Sensation only becomes conscious when it violates prediction.",
                },
                games: [
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "What happens first, second, third, and fourth when you perceive something?", items: ["1. Brain generates a prediction before you sense anything", "2. Sensory signals arrive from the outside world", "3. Brain compares its prediction to the incoming signals", "4. Only the differences (surprises) reach your awareness"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Your brain waits for sensory information before deciding what you're experiencing.", answer: false, explanation: "Your brain predicts first, then checks. Waiting would be too slow to survive." },
                    { type: GAME_TYPES.TAP_ALL, question: "Why don't you constantly feel your clothes touching your skin?", options: [
                        { text: "Your skin goes numb to constant touch", correct: false },
                        { text: "Your brain predicts the sensation so it doesn't reach awareness", correct: true },
                        { text: "The sensation is too weak to notice", correct: false },
                        { text: "Predicted sensations don't need conscious attention", correct: true },
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Sensory data only becomes conscious when it _______ the brain's prediction.", options: ['violates', 'confirms', 'matches', 'delays'], answer: 'violates' },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Prediction matches reality", right: "No conscious awareness needed" },
                        { left: "Prediction doesn't match", right: "Pay attention—something's different" },
                        { left: "Familiar sound", right: "Brain ignores it" },
                        { left: "Unexpected sound", right: "Brain alerts you" },
                    ]},
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "You're working at a coffee shop with background music playing. Suddenly you notice the music—it just changed to your favorite song.", question: "Why did you suddenly notice the music?", options: [
                        { text: "The volume increased", correct: false },
                        { text: "The change created a prediction error that reached consciousness", correct: true },
                        { text: "You decided to pay attention", correct: false },
                    ], explanation: "Your brain was predicting 'background noise' and filtering it out. The change violated the prediction." },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Prediction-first processing is slower but more accurate than waiting for data.", answer: false, explanation: "Prediction-first is FASTER, which is why the brain evolved this way." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Your brain asks: 'Did reality match my _______?'", options: ['prediction', 'desire', 'memory', 'logic'], answer: 'prediction' },
                ]
            },
            {
                id: 'mind-1-3', unitId: 'mind-1', order: 3, title: "Prediction Errors = Learning",
                content: {
                    intro: `When reality doesn't match your brain's prediction, that mismatch is called a "prediction error."\n\nPrediction errors are the ONLY way your brain updates its model of the world. No prediction error = no learning.\n\nThis is why surprise is so important. Novel experiences, unexpected outcomes—these create prediction errors that force your brain to update.`,
                    keyPoint: "Learning IS prediction error. Your brain only updates when reality surprises it.",
                },
                games: [
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Prediction matches reality", right: "No learning occurs" },
                        { left: "Prediction error", right: "Brain updates its model" },
                        { left: "Novel experience", right: "Large prediction error" },
                        { left: "Routine habit", right: "Minimal prediction error" },
                    ]},
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "You've done the same workout routine for 6 months. It used to feel challenging, but now it feels automatic.", question: "From a predictive brain perspective, why has adaptation stalled?", options: [
                        { text: "Your muscles are fully developed", correct: false },
                        { text: "Your brain predicts everything perfectly—no prediction error, no signal to adapt", correct: true },
                        { text: "You need more protein", correct: false },
                    ], explanation: "When your brain can perfectly predict an experience, there's no error signal to drive adaptation." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Your brain only updates its model when there's a prediction _______.", options: ['error', 'success', 'delay', 'memory'], answer: 'error' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Doing the same thing the same way keeps teaching your brain new things.", answer: false, explanation: "Without surprise or novelty, there's no prediction error—and without prediction error, there's no learning." },
                    { type: GAME_TYPES.TAP_ALL, question: "What creates prediction errors that drive learning?", options: [
                        { text: "Novel experiences", correct: true },
                        { text: "Routine repetition", correct: false },
                        { text: "Unexpected outcomes", correct: true },
                        { text: "Increasing challenge", correct: true },
                        { text: "Doing the familiar", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order the 5 stages of how the brain learns, from the trigger to the result:", items: ["You experience something new", "Reality doesn't match what your brain predicted", "A 'prediction error' signal is generated", "Brain updates its internal model", "Future predictions become more accurate"]},
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "A child touches a hot stove and gets burned. They never touch it again.", question: "Why was this one experience so effective for learning?", options: [
                        { text: "The child has a good memory", correct: false },
                        { text: "The massive prediction error created a strong update", correct: true },
                        { text: "Their parents warned them", correct: false },
                    ], explanation: "The larger the prediction error, the stronger the update." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "No surprise, no error, no _______.", options: ['update', 'memory', 'feeling', 'prediction'], answer: 'update' },
                ]
            },
            {
                id: 'mind-1-4', unitId: 'mind-1', order: 4, title: "Your Past Creates Your Present",
                content: {
                    intro: `Every prediction your brain makes is based on your entire history of experience.\n\nWhen you look at a face, your brain draws on every face you've ever seen. When you feel anxious, your brain is referencing every past moment that felt similar.\n\nThis means you literally experience the world through your past. Two people in identical situations will have completely different experiences.`,
                    keyPoint: "You don't experience the present moment directly—you experience it filtered through every moment that came before.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Two people can have the exact same experience in the same situation.", answer: false, explanation: "Experience is constructed from predictions based on personal history. Same situation, different histories, different experiences." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Two people hear a dog bark loudly. One person smiles. The other person's heart races with fear.", question: "What explains the different reactions?", options: [
                        { text: "One person has better hearing", correct: false },
                        { text: "Their brains made different predictions based on different histories with dogs", correct: true },
                        { text: "One person is braver", correct: false },
                    ], explanation: "The person bitten as a child predicts 'danger.' The person who grew up with friendly dogs predicts 'excitement.'" },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Your brain uses your _______ to predict your present experience.", options: ['history', 'logic', 'desires', 'senses'], answer: 'history' },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Looking at a face", right: "Brain references every face you've seen" },
                        { left: "Feeling anxious", right: "Brain recalls similar past moments" },
                        { left: "Attempting a lift", right: "Brain predicts based on previous attempts" },
                        { left: "Same situation, different people", right: "Completely different experiences" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "What shapes your brain's predictions about the present moment?", options: [
                        { text: "Every relevant experience you've ever had", correct: true },
                        { text: "Only logical reasoning", correct: false },
                        { text: "Your emotional memories", correct: true },
                        { text: "Previous similar situations", correct: true },
                        { text: "Only conscious memories", correct: false },
                    ]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Your history is just memory—it doesn't affect how you perceive things now.", answer: false, explanation: "Your history isn't just memory—it's the lens through which you perceive everything happening right now." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone who had a terrible gym experience in high school walks into a gym as an adult. They immediately feel anxious—even though nothing bad is happening.", question: "What's causing this reaction?", options: [
                        { text: "They don't want to get fit", correct: false },
                        { text: "Their brain is predicting the present through the lens of past gym experiences", correct: true },
                        { text: "Gyms are inherently stressful", correct: false },
                    ], explanation: "The adult brain is using teenage data to predict the current experience." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Put these in order from first to last: How does past experience shape what you perceive right now?", items: ["You walk into a new situation", "Your brain searches for similar past experiences", "It generates predictions based on that history", "Those predictions construct what you actually experience", "You end up perceiving the present through the lens of your past"]},
                ]
            },
            {
                id: 'mind-1-5', unitId: 'mind-1', order: 5, title: "The Bayesian Brain",
                content: {
                    intro: `Your brain is essentially a probability calculator running millions of predictions simultaneously.\n\nFor every moment, your brain asks: "Given everything I've ever experienced, what is MOST LIKELY to be happening right now?"\n\nStrong beliefs (lots of past experience) are hard to override. This is why transformation requires consistent new evidence over time.`,
                    keyPoint: "Your brain calculates probabilities constantly. Strong beliefs require strong, repeated evidence to change.",
                },
                games: [
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Strong prior belief", right: "Hard to change with new evidence" },
                        { left: "Weak prior belief", right: "Updates easily" },
                        { left: "Consistent new evidence", right: "Gradually shifts strong beliefs" },
                        { left: "One-time experience", right: "Barely moves strong beliefs" },
                    ]},
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "You've believed 'I'm not athletic' for 20 years. You complete one great workout.", question: "What happens to your self-belief?", options: [
                        { text: "It completely changes—you now see yourself as athletic", correct: false },
                        { text: "It shifts slightly, but one workout barely moves a 20-year belief", correct: true },
                        { text: "Nothing changes because beliefs are fixed", correct: false },
                    ], explanation: "One piece of evidence against a strong prior barely registers. Transformation requires consistent new evidence." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order the stages of how a strong belief changes over time, from the first spark to the final shift:", items: ["A new experience contradicts the old belief", "A small prediction error is registered", "More contradicting experiences accumulate over time", "The old belief gradually weakens", "A new belief takes its place"]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Your brain calculates _______ constantly based on past experience.", options: ['probabilities', 'emotions', 'facts', 'decisions'], answer: 'probabilities' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "First impressions are easy to change with new information.", answer: false, explanation: "First impressions become strong priors. Once formed, they require substantial contradictory evidence to shift." },
                    { type: GAME_TYPES.TAP_ALL, question: "Why is transformation hard according to the Bayesian brain?", options: [
                        { text: "Strong beliefs require lots of evidence to shift", correct: true },
                        { text: "People are inherently lazy", correct: false },
                        { text: "One-time experiences barely register against years of data", correct: true },
                        { text: "The brain resists change to stay consistent", correct: true },
                        { text: "Change is physically impossible", correct: false },
                    ]},
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone tries a new diet for 3 days, doesn't see results, and concludes 'diets don't work for me.'", question: "What's happening from a Bayesian perspective?", options: [
                        { text: "They have a slow metabolism", correct: false },
                        { text: "3 days of evidence can't outweigh years of 'diets don't work' beliefs", correct: true },
                        { text: "The diet was wrong for them", correct: false },
                    ], explanation: "Their strong prior belief wasn't going to shift from 3 data points." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Strong beliefs require strong, _______ evidence to change.", options: ['repeated', 'logical', 'emotional', 'sudden'], answer: 'repeated' },
                ]
            },
        ],
        'mind-2': [
            {
                id: 'mind-2-1', unitId: 'mind-2', order: 1, title: "Beyond Homeostasis",
                content: {
                    intro: `You've probably heard of homeostasis—the idea that your body maintains balance by reacting to changes.\n\nBut here's what's more accurate: Your brain doesn't just react. It PREDICTS what you'll need and prepares in advance. This is called allostasis.\n\nBefore you wake up, cortisol rises to prepare you. Before you exercise, your heart rate begins increasing.`,
                    keyPoint: "Your brain doesn't wait for problems—it predicts what's coming and prepares your body in advance.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Your body waits until you start exercising to increase heart rate.", answer: false, explanation: "Your brain predicts exercise is coming and begins cardiovascular changes before you take the first step." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Allostasis means your brain _______ what your body will need.", options: ['predicts', 'ignores', 'copies', 'forgets'], answer: 'predicts' },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Homeostasis", right: "Reacts to changes" },
                        { left: "Allostasis", right: "Predicts and prepares" },
                        { left: "Morning cortisol rise", right: "Prepares you to wake" },
                        { left: "Pre-exercise heart rate", right: "Anticipates movement" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "Which are examples of allostasis (predictive preparation)?", options: [
                        { text: "Cortisol rising before you wake up", correct: true },
                        { text: "Sweating after getting hot", correct: false },
                        { text: "Heart rate increasing before exercise", correct: true },
                        { text: "Salivating when you see food", correct: true },
                        { text: "Shivering when you're already cold", correct: false },
                    ]},
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "An athlete sits in the locker room before a big race. Even before moving, their heart rate increases and breathing quickens.", question: "What explains this?", options: [
                        { text: "They're nervous and anxious", correct: false },
                        { text: "Their brain is predicting upcoming demands and preparing in advance", correct: true },
                        { text: "Something is wrong with their heart", correct: false },
                    ], explanation: "This is allostasis in action—the brain predicting physical demands and mobilizing resources before they're needed." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Put these in order from first to last: How does your body prepare for activity before it starts?", items: ["Brain predicts an upcoming physical demand", "Body begins preparing in advance of the activity", "Energy and resources are mobilized", "The activity actually begins", "Body is already fueled and ready to perform"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Allostasis is less efficient than homeostasis because it uses energy before it's needed.", answer: false, explanation: "Allostasis is more efficient because being prepared prevents larger problems and allows better performance." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Your brain doesn't wait for problems—it _______ what's coming.", options: ['anticipates', 'ignores', 'forgets', 'delays'], answer: 'anticipates' },
                ]
            },
            {
                id: 'mind-2-2', unitId: 'mind-2', order: 2, title: "The Body Budget",
                content: {
                    intro: `Your brain runs your body like a bank account—the "body budget."\n\nDeposits: Sleep, food, water, rest, positive social connection.\nWithdrawals: Physical activity, stress, illness, conflict, even thinking.\n\nMany feelings that seem psychological—motivation, fatigue, mood—are actually your brain's predictions about your body budget.`,
                    keyPoint: "Your brain tracks energy like a budget. Feelings often reflect predicted deposits and withdrawals.",
                },
                games: [
                    { type: GAME_TYPES.TAP_ALL, question: "Which are 'deposits' to your body budget?", options: [{ text: "Quality sleep", correct: true }, { text: "Skipping meals", correct: false }, { text: "Nutritious food", correct: true }, { text: "Chronic stress", correct: false }, { text: "Positive social time", correct: true }] },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Low motivation is just laziness with no physical basis.", answer: false, explanation: "Low motivation often reflects your brain's prediction that you can't afford the energy expenditure." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Sleep", right: "Major deposit" },
                        { left: "Chronic stress", right: "Constant withdrawal" },
                        { left: "Nutritious meal", right: "Energy deposit" },
                        { left: "Intense workout", right: "Temporary withdrawal" },
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Your brain runs your body like a _______ account.", options: ['bank', 'social', 'email', 'random'], answer: 'bank' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "After a week of poor sleep, skipped meals, and work stress, you feel unmotivated to exercise even though you 'should' want to.", question: "What's happening?", options: [
                        { text: "You're being lazy and need more willpower", correct: false },
                        { text: "Your brain predicts your body budget can't afford the withdrawal", correct: true },
                        { text: "You don't actually like exercise", correct: false },
                    ], explanation: "Your brain is protecting you. With a depleted body budget, it predicts exercise as too costly right now." },
                    { type: GAME_TYPES.TAP_ALL, question: "Which are 'withdrawals' from your body budget?", options: [
                        { text: "Physical activity", correct: true },
                        { text: "Adequate sleep", correct: false },
                        { text: "Mental stress", correct: true },
                        { text: "Illness", correct: true },
                        { text: "Relaxation", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Rank these body budget priorities from MOST foundational to LEAST (what should you address first?):", items: ["Sleep — the foundation everything else depends on", "Nutrition — fuel your body properly", "Stress — manage it so it doesn't drain your reserves", "Exercise — train with the energy you've built up", "Recovery — rest and rebuild after training"], acceptableOrders: [[0,1,2,3,4],[0,2,1,3,4]]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Thinking hard doesn't really use much energy compared to physical activity.", answer: false, explanation: "Mental effort is a significant withdrawal. Your brain consumes about 20% of your energy even at rest." },
                ]
            },
            {
                id: 'mind-2-3', unitId: 'mind-2', order: 3, title: "Feelings Are Predictions",
                content: {
                    intro: `Hunger isn't a direct readout of your stomach. Fatigue isn't a direct measure of muscle depletion. Even emotions aren't direct responses to events.\n\nThese are all PREDICTIONS your brain makes about your body's state.\n\nThis is why you can feel hungry at your usual lunchtime even if you ate late breakfast—your brain predicted hunger based on the clock.`,
                    keyPoint: "Feelings like hunger, fatigue, and emotions are predictions about your body—not direct measurements.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Feelings are your brain's _______ about your body's state.", options: ['predictions', 'recordings', 'memories', 'mistakes'], answer: 'predictions' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Hunger is a direct signal from your stomach about its emptiness.", answer: false, explanation: "Hunger is a prediction based on time, habits, and context—not just stomach sensors." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "You always eat lunch at noon. Today you had a big breakfast at 11am. At noon, you still feel hungry.", question: "Why do you feel hungry despite recently eating?", options: [
                        { text: "Your stomach digested the food very quickly", correct: false },
                        { text: "Your brain predicted hunger based on your usual schedule", correct: true },
                        { text: "Breakfast wasn't nutritious enough", correct: false },
                    ], explanation: "Hunger is a prediction based on time patterns, not just stomach emptiness." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Hunger", right: "Prediction, not stomach reading" },
                        { left: "Fatigue", right: "Prediction, not muscle measurement" },
                        { left: "Thirst", right: "Prediction, not hydration sensor" },
                        { left: "Anxiety", right: "Prediction, not danger detection" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "Which factors influence your brain's hunger predictions?", options: [
                        { text: "Time of day", correct: true },
                        { text: "What you see or smell", correct: true },
                        { text: "Only stomach sensors", correct: false },
                        { text: "Past eating patterns", correct: true },
                        { text: "Social context", correct: true },
                    ]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Emotions are direct, automatic responses to events.", answer: false, explanation: "Emotions are predictions your brain constructs based on context, history, and bodily state." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Put these in order from first to last: How does your brain create the feeling of hunger?", items: ["Brain checks the time of day and your current context", "Brain references what happened in similar past situations", "Brain generates a prediction: 'you should be hungry now'", "You actually experience the feeling of hunger", "Your behavior changes — you start seeking food"]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "You feel hungry at your usual lunchtime because of _______, not stomach signals.", options: ['prediction', 'digestion', 'vitamins', 'hormones'], answer: 'prediction' },
                ]
            },
            {
                id: 'mind-2-4', unitId: 'mind-2', order: 4, title: "Why You Feel Tired Before You're Tired",
                content: {
                    intro: `Your brain doesn't wait until you're actually depleted to make you feel tired. That would be dangerous.\n\nInstead, it PREDICTS depletion and creates fatigue in advance. Fatigue is a prediction, not a measurement.\n\nThis is why fatigue often lifts when something exciting happens—your brain reassesses and decides you can afford more output.`,
                    keyPoint: "Fatigue is a protective prediction, not a fuel gauge. Your brain makes you feel tired before you're actually depleted.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Feeling tired means your body has run out of energy.", answer: false, explanation: "Fatigue is a prediction designed to make you stop BEFORE depletion." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Elite athletes know that 'I can't go on' is almost never _______.", options: ['true', 'false', 'helpful', 'harmful'], answer: 'true' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "You're exhausted at the end of a long day. Suddenly you get exciting news—a friend is visiting from overseas. Your fatigue vanishes.", question: "What happened to your tiredness?", options: [
                        { text: "The news gave you actual energy", correct: false },
                        { text: "Your brain reassessed and predicted you could afford more output", correct: true },
                        { text: "You were faking being tired", correct: false },
                    ], explanation: "Fatigue is a prediction. New information can change your brain's assessment of what you can afford." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Fatigue", right: "Protective prediction" },
                        { left: "Second wind", right: "Brain reassesses resources" },
                        { left: "'I can't go on'", right: "Almost never literally true" },
                        { left: "Exciting news lifting tiredness", right: "Prediction update in action" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "Why is fatigue a prediction rather than a measurement?", options: [
                        { text: "It protects you before actual depletion", correct: true },
                        { text: "Context can instantly change it", correct: true },
                        { text: "Athletes can push past it", correct: true },
                        { text: "It's always accurate", correct: false },
                        { text: "It can't be influenced", correct: false },
                    ]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "When you experience a 'second wind' during exercise, your body suddenly produced more energy.", answer: false, explanation: "Your brain simply updated its prediction about what you could afford to expend." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order these from first to last: How does your brain use fatigue to protect you?", items: ["Brain monitors your current activity and context", "Brain predicts how much energy you'll need going forward", "A feeling of fatigue is generated BEFORE you're actually depleted", "You slow down in response to the fatigue feeling", "Your actual energy reserves are protected from running out"]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Fatigue is designed to make you stop _______ you're actually depleted.", options: ['before', 'after', 'when', 'unless'], answer: 'before' },
                ]
            },
            {
                id: 'mind-2-5', unitId: 'mind-2', order: 5, title: "Stress Is a Prediction",
                content: {
                    intro: `Cortisol—the "stress hormone"—doesn't rise because something bad happened. It rises because your brain PREDICTS you'll need resources.\n\nThis is why you can feel stressed about something that hasn't happened yet. Your brain is predicting a future demand and preparing.\n\nChronic stress is often a prediction loop that becomes self-reinforcing.`,
                    keyPoint: "Stress is preparation for predicted demands—your brain mobilizing resources for what it thinks is coming.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Cortisol rises because your brain _______ you'll need extra resources.", options: ['predicts', 'knows', 'remembers', 'doubts'], answer: 'predicts' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "You can only feel stressed about things currently happening.", answer: false, explanation: "Stress is a prediction about future demands. You can feel stressed about things that haven't happened." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "You have an important presentation tomorrow. You're safe at home tonight, but your heart races and you can't sleep.", question: "Why is your body acting like it's in danger?", options: [
                        { text: "Your body can't tell the difference between now and tomorrow", correct: false },
                        { text: "Your brain is predicting tomorrow's demands and mobilizing resources now", correct: true },
                        { text: "You have a medical condition", correct: false },
                    ], explanation: "Stress is preparation for predicted future demands. Your brain is getting ready for tomorrow." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Cortisol", right: "Mobilizes energy for predicted demand" },
                        { left: "Stress about the future", right: "Brain preparing in advance" },
                        { left: "Chronic stress", right: "Self-reinforcing prediction loop" },
                        { left: "Relaxation", right: "Brain predicts safety" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "What can trigger stress predictions?", options: [
                        { text: "Thinking about future challenges", correct: true },
                        { text: "Past experiences of difficulty", correct: true },
                        { text: "Only actual danger", correct: false },
                        { text: "Uncertain situations", correct: true },
                        { text: "Environmental cues linked to stress", correct: true },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order this vicious cycle from the starting trigger through to where it loops back:", items: ["Brain predicts a threat (even if one isn't really there)", "The stress response activates in your body", "You feel stressed and anxious", "Brain interprets the stress feeling as proof the threat was real", "Future threat predictions get even stronger — and the cycle repeats"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Chronic stress is usually caused by actual ongoing danger.", answer: false, explanation: "Chronic stress is often a prediction loop—your brain keeps predicting threat even without actual danger." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Stress is your brain _______ resources for what it thinks is coming.", options: ['mobilizing', 'wasting', 'hiding', 'destroying'], answer: 'mobilizing' },
                ]
            },
        ],
        'mind-3': [
            {
                id: 'mind-3-1', unitId: 'mind-3', order: 1, title: "Concepts Are Constructed",
                content: {
                    intro: `Your brain doesn't just predict physical sensations—it constructs concepts too.\n\nThe concept of "exercise" isn't built into your brain. It was learned through experience. For some people, "exercise" predicts pain, exhaustion, and failure. For others, it predicts energy, accomplishment, and joy.\n\nSame word. Completely different internal predictions. Completely different experiences.`,
                    keyPoint: "Concepts like 'exercise' or 'healthy eating' are predictions built from your personal history—and they shape what you actually experience.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Everyone experiences 'exercise' the same way because it's the same physical activity.", answer: false, explanation: "The concept 'exercise' triggers different predictions based on personal history, creating different experiences." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Concepts are _______ from personal experience, not hardwired.", options: ['constructed', 'inherited', 'universal', 'random'], answer: 'constructed' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Two people hear the word 'gym.' One feels excited and energized. The other feels dread and shame.", question: "What explains this difference?", options: [
                        { text: "One person is more disciplined than the other", correct: false },
                        { text: "Their brains constructed different concepts of 'gym' from different experiences", correct: true },
                        { text: "One person is lazy", correct: false },
                    ], explanation: "The concept 'gym' triggers different predictions based on each person's history with gyms." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "'Exercise' for some", right: "Predicts pain and failure" },
                        { left: "'Exercise' for others", right: "Predicts energy and joy" },
                        { left: "'Healthy eating'", right: "Different meaning for everyone" },
                        { left: "Same word", right: "Different internal experience" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "What shapes how you experience a concept like 'diet'?", options: [
                        { text: "Your past experiences with diets", correct: true },
                        { text: "Messages you received about diets", correct: true },
                        { text: "The dictionary definition", correct: false },
                        { text: "Emotions linked to past diet attempts", correct: true },
                        { text: "Universal human programming", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "From earliest stage to final result: How does your brain build a concept (like 'exercise')?", items: ["You have many experiences related to that concept over time", "Your brain links the sensations, emotions, and contexts from those experiences", "A repeating prediction pattern forms in your brain", "Later, just hearing the word triggers that entire pattern", "You experience the concept as your brain constructed it — shaped by your unique history"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "You can change how a concept feels by creating new experiences.", answer: true, explanation: "Since concepts are constructed from experience, new experiences can update and reshape them." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Same word, different history, different _______.", options: ['experience', 'spelling', 'definition', 'pronunciation'], answer: 'experience' },
                ]
            },
            {
                id: 'mind-3-2', unitId: 'mind-3', order: 2, title: "Emotion Categories Are Learned",
                content: {
                    intro: `Here's something that surprises most people: emotions aren't universal biological responses. They're concepts your brain learned.\n\nA racing heart doesn't "mean" anxiety. Your brain decides what it means based on context and past experience. The same physical sensation could be excitement, fear, anticipation, or exercise—depending on what your brain predicts.\n\nYou literally construct your emotional experiences.`,
                    keyPoint: "Emotions are constructed predictions, not triggered reactions. Your brain decides what physical sensations 'mean.'",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "A racing heart always means you're anxious.", answer: false, explanation: "Physical sensations are ambiguous. Your brain constructs what they 'mean' based on context and past experience." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Emotions are _______, not triggered biological reactions.", options: ['constructed', 'automatic', 'inherited', 'universal'], answer: 'constructed' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Your heart is racing and your palms are sweaty. You're about to give a presentation.", question: "What emotion are you experiencing?", options: [
                        { text: "Definitely anxiety—those are anxiety symptoms", correct: false },
                        { text: "It depends on how your brain interprets these sensations", correct: true },
                        { text: "Definitely excitement—presentations are fun", correct: false },
                    ], explanation: "The same physical sensations can be constructed as anxiety, excitement, or anticipation depending on context and history." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Racing heart before exercise", right: "Anticipation/readiness" },
                        { left: "Racing heart on a date", right: "Could be excitement or nerves" },
                        { left: "Racing heart in danger", right: "Fear" },
                        { left: "Same sensation", right: "Different constructed meaning" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "What determines what emotion you construct from a racing heart?", options: [
                        { text: "The context you're in", correct: true },
                        { text: "Your past experiences", correct: true },
                        { text: "The racing heart itself", correct: false },
                        { text: "What you expect to feel", correct: true },
                        { text: "Universal emotion circuits", correct: false },
                    ]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Different cultures experience and categorize emotions identically.", answer: false, explanation: "Emotion concepts are learned and vary across cultures. Not all languages have the same emotion words." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order these from first to last: How does your brain construct an emotion?", items: ["Raw body sensations arise (racing heart, tight stomach, etc.)", "Brain reads the current context (where are you? what's happening?)", "Brain references similar past experiences for a match", "Brain categorizes the sensation as a specific emotion (anger, excitement, anxiety)", "You consciously experience that emotion as if it were simply 'happening to you'"]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Your brain _______ what physical sensations mean.", options: ['decides', 'records', 'ignores', 'copies'], answer: 'decides' },
                ]
            },
            {
                id: 'mind-3-3', unitId: 'mind-3', order: 3, title: "Your Past Writes Your Present",
                content: {
                    intro: `Every experience you've ever had becomes data for future predictions.\n\nIf you've repeatedly tried to get fit and "failed," your brain has learned to predict failure. When you think about starting again, your brain generates the experience of "this won't work" before you've even begun.\n\nThis isn't weakness. This is your brain doing its job—predicting based on evidence. The key is understanding you can provide new evidence.`,
                    keyPoint: "Past 'failures' become predictions of future failure. But predictions can be updated with consistent new experiences.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Feeling like 'this won't work' before starting is always an accurate assessment.", answer: false, explanation: "It's a prediction based on past data, not truth. New consistent experiences can update this prediction." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Past experiences become _______ for future predictions.", options: ['data', 'barriers', 'excuses', 'memories'], answer: 'data' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "You've tried to exercise regularly five times before and 'failed' each time. You're thinking about trying again but feel defeated before starting.", question: "What's creating this feeling?", options: [
                        { text: "You're just not meant to be fit", correct: false },
                        { text: "Your brain is predicting failure based on past data", correct: true },
                        { text: "You're making excuses", correct: false },
                    ], explanation: "Your brain isn't being negative—it's doing its job, predicting based on evidence. New evidence can update this." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Multiple past 'failures'", right: "Brain predicts future failure" },
                        { left: "Consistent new successes", right: "Prediction gradually updates" },
                        { left: "'This won't work' feeling", right: "Prediction, not fact" },
                        { left: "Understanding prediction", right: "Freedom to provide new data" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "How do you update a prediction of failure?", options: [
                        { text: "Provide consistent new successes", correct: true },
                        { text: "Start smaller to guarantee wins", correct: true },
                        { text: "Just believe harder", correct: false },
                        { text: "Create positive experiences around the activity", correct: true },
                        { text: "Ignore the feeling completely", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order these steps from first to last: How do you change a 'I'll fail' prediction?", items: ["Recognize that the 'I'll fail' feeling is a prediction, not a fact", "Start with intentionally small, achievable actions", "Accumulate a track record of successful experiences", "Brain receives this new data that contradicts the old prediction", "Over time, the failure prediction gradually shifts to an expectation of success"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Your brain is being mean when it predicts failure.", answer: false, explanation: "Your brain is just doing its job—predicting based on available evidence. It's not personal." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "You can provide new _______ to update negative predictions.", options: ['evidence', 'thoughts', 'wishes', 'complaints'], answer: 'evidence' },
                ]
            },
            {
                id: 'mind-3-4', unitId: 'mind-3', order: 4, title: "Context Changes Everything",
                content: {
                    intro: `Your brain doesn't predict in a vacuum—context shapes everything.\n\nThe same workout feels different in a supportive gym vs. a judgmental one. The same meal feels different when you're stressed vs. relaxed. The same body feels different depending on what you're comparing it to.\n\nThis is why environment matters so much. Context literally changes your experience.`,
                    keyPoint: "Context shapes prediction. The same action in different contexts creates genuinely different experiences.",
                },
                games: [
                    { type: GAME_TYPES.TAP_ALL, question: "Which contexts might make exercise feel harder?", options: [{ text: "Feeling judged by others", correct: true }, { text: "Exercising with supportive friends", correct: false }, { text: "Sleep-deprived", correct: true }, { text: "After a stressful day", correct: true }, { text: "In a comfortable environment", correct: false }] },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "A workout is equally difficult regardless of your environment or mental state.", answer: false, explanation: "Context shapes prediction, which shapes experience. The same workout genuinely feels different in different contexts." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "You do the exact same workout twice. On Monday at a friendly gym with your supportive friend. On Wednesday at a crowded gym where you feel watched.", question: "Will the workouts feel the same?", options: [
                        { text: "Yes—same exercises, same difficulty", correct: false },
                        { text: "No—context changes prediction, which changes experience", correct: true },
                        { text: "Only if you're weak-minded", correct: false },
                    ], explanation: "The Wednesday workout will genuinely feel harder because context shapes the predictions your brain makes." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Supportive environment", right: "Easier predictions, better experience" },
                        { left: "Judgmental environment", right: "Harder predictions, worse experience" },
                        { left: "Stressed state", right: "Everything feels harder" },
                        { left: "Rested and relaxed", right: "Same task feels easier" },
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Context literally changes your _______.", options: ['experience', 'genetics', 'muscles', 'age'], answer: 'experience' },
                    { type: GAME_TYPES.TAP_ALL, question: "What context factors improve exercise experience?", options: [
                        { text: "Good sleep the night before", correct: true },
                        { text: "Exercising with supportive people", correct: true },
                        { text: "Harsh self-criticism", correct: false },
                        { text: "Comfortable environment", correct: true },
                        { text: "Comparing yourself to others", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from first to last: Why does the same exercise feel different in different settings?", items: ["You enter a specific environment (e.g., a gym vs. a park)", "Your brain reads the environmental context and cues", "That context changes which predictions your brain generates", "Those predictions shape how the activity actually feels", "Result: the same exercise feels different depending on where you do it"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "You should ignore context and just push through.", answer: false, explanation: "Understanding context lets you design better conditions for success. Fighting context is fighting neuroscience." },
                ]
            },
            {
                id: 'mind-3-5', unitId: 'mind-3', order: 5, title: "You Can Reshape Experience",
                content: {
                    intro: `Here's the empowering part: if experience is constructed from predictions, and predictions come from past experience, then creating new experiences changes future predictions.\n\nEvery time you exercise and it goes okay, you're providing data. Every positive association you build matters. You're not just doing a workout—you're training your brain to predict differently.\n\nThis is why small, consistent wins matter more than occasional heroic efforts.`,
                    keyPoint: "Every positive experience is data that updates predictions. Small consistent wins reshape what your brain expects.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Small consistent wins provide _______ that updates your brain's predictions.", options: ['evidence', 'motivation', 'willpower', 'hope'], answer: 'evidence' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "One intense workout creates more lasting change than ten easy ones.", answer: false, explanation: "Consistency provides more data points for prediction updating than intensity." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "You want to change how your brain predicts 'exercise.' You have two options: one amazing workout, or ten 10-minute walks where you feel good.", question: "Which reshapes predictions better?", options: [
                        { text: "The one amazing workout—more impressive data", correct: false },
                        { text: "The ten walks—more data points for prediction updating", correct: true },
                        { text: "Neither—predictions can't change", correct: false },
                    ], explanation: "Ten positive experiences provide more prediction-updating data than one intense experience." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Each positive experience", right: "Data for prediction update" },
                        { left: "Consistent small wins", right: "Compound over time" },
                        { left: "Occasional heroic efforts", right: "Less prediction change" },
                        { left: "Training your brain", right: "Every workout matters" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "How do you reshape your experience of exercise?", options: [
                        { text: "Create positive associations", correct: true },
                        { text: "Have consistent good experiences", correct: true },
                        { text: "Push through pain until you like it", correct: false },
                        { text: "Start small enough to succeed", correct: true },
                        { text: "Force yourself harder", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from first to last: How do you reshape a negative prediction about exercise?", items: ["Have one positive experience with the activity", "Brain registers it as a new data point", "Repeat the positive experience consistently over weeks", "The old negative prediction weakens from lack of reinforcement", "A new, positive prediction strengthens and takes over"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "You're 'just doing a workout'—there's no deeper significance.", answer: false, explanation: "Every workout is training your brain to predict differently. You're reshaping future experience." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Small consistent wins matter more than occasional _______ efforts.", options: ['heroic', 'gentle', 'planned', 'simple'], answer: 'heroic' },
                ]
            },
        ],
        'mind-4': [
            {
                id: 'mind-4-1', unitId: 'mind-4', order: 1, title: "Why Habits Work",
                content: {
                    intro: `Habits aren't just behavioral shortcuts—they're predictions that have become so strong they run automatically.\n\nWhen you first learned to drive, you had to think about every action. Now your brain predicts the sequence so confidently that you can drive while having a conversation.\n\nBuilding fitness habits means building predictions so strong that healthy choices become automatic.`,
                    keyPoint: "Habits are predictions that have become so reliable they run without conscious effort.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Habits form when predictions become strong enough to run _______.", options: ['automatically', 'occasionally', 'consciously', 'randomly'], answer: 'automatically' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Habits require constant willpower to maintain.", answer: false, explanation: "True habits run automatically precisely because they don't require willpower—the prediction is strong enough." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "When you first learned to drive, you had to consciously think about every action. Now you can drive while having a conversation.", question: "What changed neurologically?", options: [
                        { text: "You got better at multitasking", correct: false },
                        { text: "The driving predictions became so strong they run automatically", correct: true },
                        { text: "Your car became easier to drive", correct: false },
                    ], explanation: "Driving became a habit—the predictions are so reliable that your brain doesn't need conscious attention." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "New behavior", right: "Requires conscious effort" },
                        { left: "Developing habit", right: "Getting easier" },
                        { left: "Strong habit", right: "Runs automatically" },
                        { left: "True habit", right: "No willpower needed" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "What indicates a behavior has become a habit?", options: [
                        { text: "It feels effortless", correct: true },
                        { text: "You do it without thinking", correct: true },
                        { text: "It still requires willpower", correct: false },
                        { text: "Missing it feels uncomfortable", correct: true },
                        { text: "You have to remind yourself constantly", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order the journey from conscious effort to automatic habit:", items: ["You make a conscious, effortful decision to act", "Repeating the action builds a prediction in your brain", "That prediction strengthens each time you repeat it", "The behavior starts requiring less conscious effort", "Eventually the behavior runs on autopilot"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Building fitness habits is fundamentally different from building any other habit.", answer: false, explanation: "All habits work the same way—predictions that become strong enough to run automatically." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "The goal is predictions so strong that healthy choices become _______.", options: ['automatic', 'difficult', 'optional', 'impressive'], answer: 'automatic' },
                ]
            },
            {
                id: 'mind-4-2', unitId: 'mind-4', order: 2, title: "The Power of Consistency",
                content: {
                    intro: `Your brain updates predictions based on frequency, not intensity.\n\nTen moderate workouts provide more prediction-updating data than one extreme workout. Your brain is essentially asking: "How often does this happen?" not "How intense was that one time?"\n\nThis is why showing up matters more than performance. Every repetition strengthens the prediction.`,
                    keyPoint: "Frequency of experience updates predictions more effectively than intensity. Showing up consistently > occasional heroics.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Working out intensely once a week builds stronger habits than light exercise daily.", answer: false, explanation: "Frequency matters more than intensity for prediction formation. Daily repetition builds stronger predictions." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Your brain updates predictions based on _______, not intensity.", options: ['frequency', 'desire', 'genetics', 'willpower'], answer: 'frequency' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Two people want to build an exercise habit. Person A does intense hour-long workouts twice a week. Person B does 10-minute walks every day.", question: "Who builds the stronger habit?", options: [
                        { text: "Person A—more total exercise time", correct: false },
                        { text: "Person B—more frequent repetitions strengthen predictions faster", correct: true },
                        { text: "They're equal", correct: false },
                    ], explanation: "Seven data points per week (Person B) builds predictions faster than two (Person A)." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Frequency", right: "How often it happens" },
                        { left: "Intensity", right: "How hard it is" },
                        { left: "Prediction strength", right: "Built through repetition" },
                        { left: "Showing up", right: "More important than performance" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "Why does frequency matter more than intensity for habits?", options: [
                        { text: "More data points update predictions faster", correct: true },
                        { text: "Consistency builds the 'this happens regularly' prediction", correct: true },
                        { text: "Intense workouts are dangerous", correct: false },
                        { text: "Regular repetition becomes automatic faster", correct: true },
                        { text: "Intensity burns more calories", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from first to last: How does showing up consistently turn into an automatic habit?", items: ["You show up regularly, even if only briefly", "Each time you show up, your brain logs it as a data point", "After enough repetitions, brain learns 'this is something I do regularly'", "The prediction that you'll do it gets stronger and stronger", "The behavior becomes automatic — you do it without thinking"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "A 'bad' workout where you just showed up still counts for habit building.", answer: true, explanation: "Every repetition counts. Your brain tracks frequency, not quality. Showing up matters most." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Every repetition _______ the prediction.", options: ['strengthens', 'weakens', 'ignores', 'delays'], answer: 'strengthens' },
                ]
            },
            {
                id: 'mind-4-3', unitId: 'mind-4', order: 3, title: "Minimum Viable Actions",
                content: {
                    intro: `The goal isn't to do impressive workouts—it's to build the prediction that "I exercise."\n\nA 5-minute walk counts as data. A single pushup counts. Your brain doesn't distinguish between "real" and "not real" exercise—it just tracks: did the predicted behavior happen?\n\nThis is why "too small to fail" works. Any action that matches the prediction strengthens it.`,
                    keyPoint: "Any action that matches the prediction strengthens it. The smallest exercise still counts as 'exercise happened.'",
                },
                games: [
                    { type: GAME_TYPES.TAP_ALL, question: "Which count as 'exercise happened' to your brain?", options: [{ text: "A 5-minute walk", correct: true }, { text: "A single pushup", correct: true }, { text: "Stretching for 2 minutes", correct: true }, { text: "Thinking about exercising", correct: false }, { text: "Planning to exercise tomorrow", correct: false }] },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "A workout only 'counts' if you do it for at least 30 minutes.", answer: false, explanation: "Your brain tracks whether the predicted behavior happened, not duration. Any exercise strengthens the prediction." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "You planned a 30-minute workout but only have 5 minutes. You could skip it or do 5 minutes.", question: "What should you do from a habit-building perspective?", options: [
                        { text: "Skip it—5 minutes isn't a real workout", correct: false },
                        { text: "Do the 5 minutes—it still counts as 'exercise happened'", correct: true },
                        { text: "Make up for it with a longer workout tomorrow", correct: false },
                    ], explanation: "Five minutes provides the same 'exercise happened' data point as 30 minutes for prediction building." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "5-minute walk", right: "Counts as exercise" },
                        { left: "Single pushup", right: "Counts as exercise" },
                        { left: "2-minute stretch", right: "Counts as exercise" },
                        { left: "Too small to fail", right: "Guarantees the habit builds" },
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Your brain tracks: did the predicted _______ happen?", options: ['behavior', 'duration', 'intensity', 'perfection'], answer: 'behavior' },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from first to last: Why does making a habit 'too small to fail' actually work?", items: ["You make the required action tiny (e.g., 1 push-up)", "Because it's so small, success is basically guaranteed", "Your brain registers 'exercise happened today' — a win", "The 'I exercise' prediction gets a little stronger each day", "Over time, the habit builds reliably because you never skip it"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Doing a single pushup when you're tired builds the habit more than skipping a planned full workout.", answer: true, explanation: "The pushup provides 'exercise happened' data. Skipping provides 'exercise didn't happen' data." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Any action that matches the prediction _______ it.", options: ['strengthens', 'weakens', 'resets', 'ignores'], answer: 'strengthens' },
                ]
            },
            {
                id: 'mind-4-4', unitId: 'mind-4', order: 4, title: "Environment as Prediction Trigger",
                content: {
                    intro: `Your brain uses environmental cues to know which predictions to activate.\n\nSee your gym bag? Prediction: exercise might happen. Walk into the kitchen? Prediction: eating might happen. This is why environment design is so powerful.\n\nMake healthy choice cues visible. Remove unhealthy cues. You're not relying on willpower—you're engineering which predictions get triggered.`,
                    keyPoint: "Environmental cues trigger predictions. Design your environment to trigger the predictions you want.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Environmental cues _______ which predictions your brain activates.", options: ['determine', 'ignore', 'block', 'confuse'], answer: 'determine' },
                    { type: GAME_TYPES.TAP_ALL, question: "Which environment changes support exercise predictions?", options: [{ text: "Gym bag by the door", correct: true }, { text: "Workout clothes laid out", correct: true }, { text: "Hiding running shoes in closet", correct: false }, { text: "Exercise equipment visible", correct: true }, { text: "Keeping gym membership card in a drawer", correct: false }] },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "You want to exercise in the morning. Your gym clothes are in a drawer, and your phone (with social media) is on your nightstand.", question: "How could you redesign this environment?", options: [
                        { text: "Just rely on willpower to resist the phone", correct: false },
                        { text: "Put gym clothes on nightstand, phone in another room", correct: true },
                        { text: "Environment doesn't matter if you're motivated enough", correct: false },
                    ], explanation: "Make the desired behavior easy to trigger (visible clothes) and unwanted behavior hard (distant phone)." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Visible gym bag", right: "Triggers exercise prediction" },
                        { left: "Walking into kitchen", right: "Triggers eating prediction" },
                        { left: "Removing junk food", right: "Removes unhealthy trigger" },
                        { left: "Visible water bottle", right: "Triggers hydration prediction" },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order these environment design steps from first to last:", items: ["Decide which specific behavior you want to build", "Identify the visual cues that would trigger that behavior", "Make those cues visible and obvious in your space", "Remove or hide cues that trigger competing behaviors", "Over time, the desired behavior gets triggered automatically by your surroundings"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Willpower is more reliable than environment design for behavior change.", answer: false, explanation: "Willpower is limited and depletes. Environment design triggers predictions automatically without effort." },
                    { type: GAME_TYPES.TAP_ALL, question: "What makes environment design so powerful?", options: [
                        { text: "It triggers predictions automatically", correct: true },
                        { text: "It doesn't require willpower", correct: true },
                        { text: "It only works for some people", correct: false },
                        { text: "Cues work without conscious thought", correct: true },
                        { text: "You have to think about it constantly", correct: false },
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "You're not relying on willpower—you're _______ which predictions get triggered.", options: ['engineering', 'hoping', 'forcing', 'ignoring'], answer: 'engineering' },
                ]
            },
            {
                id: 'mind-4-5', unitId: 'mind-4', order: 5, title: "Why Streaks Matter Neurologically",
                content: {
                    intro: `Streaks aren't just motivational tricks—they serve a neurological purpose.\n\nEvery day you maintain a streak, you provide another data point: "This behavior happens daily." Your brain's prediction strengthens. Miss a day? You've provided data that "this behavior is optional."\n\nThis isn't about guilt—it's about understanding that continuity builds prediction strength.`,
                    keyPoint: "Streaks provide continuous data that strengthens predictions. Each day is another vote for 'this is who I am.'",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Missing one day completely undoes a habit.", answer: false, explanation: "One miss provides one data point. The prediction weakens but doesn't reset. Resume quickly to maintain strength." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Each day of a streak is another _______ for the prediction 'this is who I am.'", options: ['vote', 'test', 'challenge', 'barrier'], answer: 'vote' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "You've exercised for 14 days straight. Today you're exhausted and considering skipping.", question: "From a neurological perspective, what happens if you skip?", options: [
                        { text: "Your entire habit resets to zero", correct: false },
                        { text: "You provide one data point that 'this behavior is optional'", correct: true },
                        { text: "Nothing—one day doesn't matter", correct: false },
                    ], explanation: "One miss is one data point. It doesn't reset everything, but it does weaken the 'this happens daily' prediction." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Each day of streak", right: "Vote for 'this is who I am'" },
                        { left: "Missing a day", right: "Vote for 'this is optional'" },
                        { left: "Quick recovery after miss", right: "Minimizes prediction damage" },
                        { left: "Long streak", right: "Strong 'daily behavior' prediction" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "Why do streaks matter neurologically?", options: [
                        { text: "They provide continuous data points", correct: true },
                        { text: "They build 'this happens daily' prediction", correct: true },
                        { text: "They're just a motivational trick", correct: false },
                        { text: "Consistency strengthens neural pathways", correct: true },
                        { text: "Longer streaks create stronger predictions", correct: true },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from what happens first to last: What happens to your habit when you miss a day?", items: ["A day is missed — you don't do the behavior", "Brain receives a 'didn't happen' data point", "The habit prediction weakens slightly", "If you resume the very next day, the setback is minimal", "The overall habit streak continues building from where you left off"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "The goal is to never miss a single day ever.", answer: false, explanation: "The goal is consistency. If you miss, resume quickly. Never miss twice—that's when predictions really weaken." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Continuity builds prediction _______.", options: ['strength', 'weakness', 'confusion', 'delay'], answer: 'strength' },
                ]
            },
        ],
        'mind-5': [
            {
                id: 'mind-5-1', unitId: 'mind-5', order: 1, title: "Identity Is a Prediction",
                content: {
                    intro: `Who you believe yourself to be is—you guessed it—a prediction.\n\nYour brain maintains a model of "self" based on accumulated experience. "I'm not a morning person." "I hate exercise." "I can't stick to things." These feel like facts, but they're predictions.\n\nAnd like all predictions, they can be updated with consistent new evidence.`,
                    keyPoint: "Self-identity is a prediction based on past experience. 'Who you are' can change with consistent new evidence.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "'I'm not an exercise person' is a permanent fact about yourself.", answer: false, explanation: "It's a prediction based on past experience that can be updated with new, consistent data." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Identity is a _______ that can be updated with consistent new evidence.", options: ['prediction', 'fact', 'gene', 'choice'], answer: 'prediction' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone believes 'I'm not a morning person' because they've always struggled with mornings.", question: "Is this belief a fixed fact or something else?", options: [
                        { text: "It's a fixed fact determined at birth", correct: false },
                        { text: "It's a prediction based on accumulated past experience", correct: true },
                        { text: "It's purely a choice they're making", correct: false },
                    ], explanation: "This identity belief is a prediction your brain made based on past data. New experiences can update it." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "'I'm not athletic'", right: "Prediction, not fact" },
                        { left: "'I can't stick to things'", right: "Prediction, not fact" },
                        { left: "'I hate vegetables'", right: "Prediction, not fact" },
                        { left: "All identity beliefs", right: "Can be updated with evidence" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "Which identity statements are actually predictions that can change?", options: [
                        { text: "'I'm not a gym person'", correct: true },
                        { text: "'I always fail at diets'", correct: true },
                        { text: "'I have brown eyes'", correct: false },
                        { text: "'I'm just not disciplined'", correct: true },
                        { text: "'I'm 5'8\" tall'", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from how identity forms to how it changes:", items: ["Past experiences accumulate over years", "Brain creates an identity prediction ('I'm not a fitness person')", "That prediction starts to feel like an unchangeable fact about you", "Then new, consistent experiences start to contradict it", "The identity prediction gradually updates to match the new evidence"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Identity predictions are harder to change than other predictions.", answer: true, explanation: "Identity predictions have lots of accumulated evidence. They need consistent new evidence over time to shift." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "'Who you are' can change with consistent new _______.", options: ['evidence', 'wishes', 'thoughts', 'feelings'], answer: 'evidence' },
                ]
            },
            {
                id: 'mind-5-2', unitId: 'mind-5', order: 2, title: "Acting Into Identity",
                content: {
                    intro: `You don't change your identity and then change your behavior. You change your behavior and your identity follows.\n\nEvery time you exercise, you provide evidence: "Someone who exercises did that." Do it enough times, and your brain updates its prediction of who you are.\n\nYou're not waiting to become a fit person. You're building the evidence that you already are one.`,
                    keyPoint: "Behavior changes identity, not the other way around. Each action is evidence for who you are becoming.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "You build identity by accumulating _______ of who you are.", options: ['evidence', 'wishes', 'plans', 'motivation'], answer: 'evidence' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "You need to feel like a fit person before you can act like one.", answer: false, explanation: "Acting comes first. The feeling of identity follows accumulated behavioral evidence." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone wants to become 'a fit person' but doesn't feel like one yet. They're waiting until they feel ready.", question: "What's the problem with this approach?", options: [
                        { text: "Nothing—you should wait until you feel ready", correct: false },
                        { text: "Identity follows behavior, not the other way around. Act first.", correct: true },
                        { text: "They need more motivation", correct: false },
                    ], explanation: "The feeling of being a 'fit person' comes FROM accumulated exercise, not before it." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Every workout", right: "Evidence 'I exercise'" },
                        { left: "Every healthy meal", right: "Evidence 'I eat well'" },
                        { left: "Accumulated actions", right: "Builds identity prediction" },
                        { left: "Waiting to feel ready", right: "Gets it backwards" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "How do you become 'someone who exercises'?", options: [
                        { text: "Wait until you feel like an exerciser", correct: false },
                        { text: "Exercise and let identity follow", correct: true },
                        { text: "Accumulate behavioral evidence", correct: true },
                        { text: "Find the right motivation first", correct: false },
                        { text: "Act like someone who exercises", correct: true },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order these steps from first to last: How does your identity actually change?", items: ["Take an action that matches who you want to be (even if it doesn't feel natural yet)", "That action provides one piece of evidence to your brain", "Over time, those pieces of evidence accumulate", "Brain updates its identity prediction based on the new evidence", "You start to genuinely feel like that kind of person"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Each small action is a vote for who you are becoming.", answer: true, explanation: "Every action provides evidence. Small actions add up to shift your brain's prediction of your identity." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Behavior changes identity, not the other way _______.", options: ['around', 'through', 'over', 'under'], answer: 'around' },
                ]
            },
            {
                id: 'mind-5-3', unitId: 'mind-5', order: 3, title: "The Compound Effect of Small Acts",
                content: {
                    intro: `Small actions compound not just physically, but in terms of identity.\n\nOne workout: "I did a workout." Ten workouts: "I work out sometimes." Fifty workouts: "I'm someone who works out." Two hundred workouts: "I'm an active person."\n\nThe same small action, repeated, shifts from behavior to identity. This is how lasting change happens.`,
                    keyPoint: "Repeated small actions compound into identity. What you do occasionally becomes who you permanently are.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Identity change requires dramatic life transformations.", answer: false, explanation: "Identity changes through accumulated small actions. Dramatic changes often don't stick because they don't build gradually." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "What you do _______ becomes who you permanently are.", options: ['repeatedly', 'dramatically', 'perfectly', 'intensely'], answer: 'repeatedly' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Consider the progression: 1 workout = 'I did a workout.' 10 = 'I work out sometimes.' 50 = 'I'm someone who works out.' 200 = 'I'm an active person.'", question: "What does this illustrate?", options: [
                        { text: "You need to do 200 workouts before anything counts", correct: false },
                        { text: "Small actions compound into identity over time", correct: true },
                        { text: "Numbers don't matter, only intensity", correct: false },
                    ], explanation: "The same small action, repeated, shifts from 'something I did' to 'who I am.'" },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "One workout", right: "'I did a workout'" },
                        { left: "Ten workouts", right: "'I work out sometimes'" },
                        { left: "Fifty workouts", right: "'I'm someone who works out'" },
                        { left: "Two hundred workouts", right: "'I'm an active person'" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "Why do small actions compound into identity?", options: [
                        { text: "Each action is a piece of evidence", correct: true },
                        { text: "Repetition builds prediction strength", correct: true },
                        { text: "Only big actions matter", correct: false },
                        { text: "Patterns become 'who you are'", correct: true },
                        { text: "Identity is fixed and unchangeable", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from the first small step to the big shift: How do tiny actions become part of who you are?", items: ["Perform one small action (e.g., a 10-minute walk)", "Your brain registers that action as a piece of evidence", "You repeat the small action consistently, day after day", "The evidence accumulates into a clear pattern", "The pattern becomes part of your identity: 'I'm someone who moves daily'"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Dramatic one-time changes create more lasting identity shift than small repeated actions.", answer: false, explanation: "Dramatic changes lack the accumulated evidence that small, repeated actions provide." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "The same small action, repeated, shifts from behavior to _______.", options: ['identity', 'routine', 'burden', 'memory'], answer: 'identity' },
                ]
            },
            {
                id: 'mind-5-4', unitId: 'mind-5', order: 4, title: "Future Self Is a Stranger",
                content: {
                    intro: `Brain imaging shows something fascinating: when people think about their future selves, the brain activates patterns similar to thinking about strangers.\n\nThis is why it's easy to sacrifice future wellbeing for present comfort. Your future self doesn't feel like "you."\n\nBut here's the key: every action you take today literally constructs your future self. You're not sacrificing for a stranger—you're building who you'll become.`,
                    keyPoint: "Your brain treats your future self like a stranger. Recognize that today's actions literally construct who you'll become.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Your brain naturally treats your future self as 'you.'", answer: false, explanation: "Brain imaging shows we process future self more like a stranger. This explains why we sacrifice future wellbeing for present comfort." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Today's actions literally _______ who you'll become.", options: ['construct', 'delay', 'predict', 'imagine'], answer: 'construct' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "You're deciding whether to skip tonight's workout to watch TV. Your future self would benefit from the workout.", question: "Why is it so easy to choose present comfort over future benefit?", options: [
                        { text: "You're just lazy", correct: false },
                        { text: "Your brain processes future self like a stranger, making it easy to sacrifice their wellbeing", correct: true },
                        { text: "Exercise is bad for you", correct: false },
                    ], explanation: "Your brain doesn't feel connected to your future self, so it's easy to sacrifice future you for present you." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Thinking about future self", right: "Brain activates 'stranger' patterns" },
                        { left: "Present comfort vs future benefit", right: "Present usually wins" },
                        { left: "Every action today", right: "Constructs who you become" },
                        { left: "Understanding this tendency", right: "Helps you overcome it" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "What can help you make choices that benefit your future self?", options: [
                        { text: "Visualizing your future self vividly", correct: true },
                        { text: "Writing a letter to your future self", correct: true },
                        { text: "Ignoring the future completely", correct: false },
                        { text: "Recognizing today's actions construct tomorrow's you", correct: true },
                        { text: "Treating future self as a stranger to protect", correct: true },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order the chain from a single choice today to who you become in the future:", items: ["You make a choice today (e.g., to eat well or exercise)", "That choice shapes what you actually do", "Repeated actions become habits and build evidence", "Those habits shape the kind of person you're becoming", "Your future self is constructed by the accumulated choices"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Sacrificing for your future self is like sacrificing for a stranger.", answer: false, explanation: "While your brain processes it that way, the truth is you ARE your future self. Every choice today builds tomorrow's you." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "You're not sacrificing for a stranger—you're _______ who you'll become.", options: ['building', 'predicting', 'imagining', 'delaying'], answer: 'building' },
                ]
            },
            {
                id: 'mind-5-5', unitId: 'mind-5', order: 5, title: "You Are the Architect",
                content: {
                    intro: `Let's bring it all together.\n\nYour brain predicts reality based on past experience. Your feelings, motivations, and sense of self are all predictions. And predictions update through consistent new experiences.\n\nThis means you're not stuck with who you've been. Every day you can provide new evidence. Every action matters. You are literally the architect of your future brain's predictions.`,
                    keyPoint: "You construct your future self through present actions. You're not changing who you are—you're building who you'll become.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Every consistent action provides _______ that updates your brain's predictions.", options: ['evidence', 'hope', 'motivation', 'willpower'], answer: 'evidence' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Your past permanently determines who you can become.", answer: false, explanation: "Your past shapes current predictions, but predictions update with new evidence. You're always under construction." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "After learning about the predictive brain, you understand: your feelings are predictions, your identity is a prediction, and predictions update with new experiences.", question: "What's the empowering takeaway?", options: [
                        { text: "You're stuck with who you are", correct: false },
                        { text: "You are the architect of your future brain's predictions", correct: true },
                        { text: "Nothing you do matters", correct: false },
                    ], explanation: "Every day you can provide new evidence. Every action matters. You're building who you'll become." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Reality", right: "Brain's prediction based on past" },
                        { left: "Feelings and identity", right: "Also predictions" },
                        { left: "New consistent experiences", right: "Update predictions" },
                        { left: "You", right: "The architect of future predictions" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "What have you learned about change in this module?", options: [
                        { text: "You're stuck with who you've been", correct: false },
                        { text: "Every day you can provide new evidence", correct: true },
                        { text: "Small consistent actions build identity", correct: true },
                        { text: "Only dramatic changes work", correct: false },
                        { text: "You're always under construction", correct: true },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order the complete picture from the brain's starting point to your future self:", items: ["Your brain constantly predicts based on past experience", "Your feelings and identity are those predictions (not fixed truths)", "Predictions can be updated when new evidence arrives", "Consistent daily actions are what provide that new evidence", "Through those actions, you literally construct your future self"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "You're not changing who you are—you're building who you'll become.", answer: true, explanation: "This reframe is key. You're not fighting your nature. You're providing evidence for a new prediction." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "You are literally the _______ of your future brain's predictions.", options: ['architect', 'victim', 'observer', 'prisoner'], answer: 'architect' },
                ]
            },
        ],
        'mind-6': [
            {
                id: 'mind-6-1', unitId: 'mind-6', order: 1, title: "Willpower Isn't Real",
                content: {
                    intro: `Here's something that contradicts almost everything you've been taught: willpower doesn't exist as a thing you have or lack. It's not a muscle. It's not a fuel tank. It isn't real.\n\nWhat we call "willpower" is actually just competing predictions in your brain. When you resist a cookie, that's not a special force called discipline—it's a higher-level prediction ("I'm someone who eats healthy") temporarily winning over a lower-level prediction ("that cookie would taste good"). Which prediction wins depends entirely on context—how tired you are, what's visible, who's around you.\n\nPeople who seem disciplined haven't built stronger willpower. They've built environments where the predictions they want already have the advantage. There's nothing to resist when the competing prediction never fires.`,
                    keyPoint: "Willpower isn't a real mechanism—it's just competing predictions. Which prediction wins depends on context, not character. Change the context, change the outcome.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Willpower is a separate mental resource that some people have more of.", answer: false, explanation: "Willpower isn't a resource at all. What we call 'willpower' is just one prediction winning over another—and context determines which wins." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "What we call 'willpower' is actually competing _______ in your brain.", options: ['predictions', 'muscles', 'chemicals', 'desires'], answer: 'predictions' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Two coworkers both want to eat healthier. Person A keeps junk food in their desk but tries to resist it. Person B removed all junk food and keeps fruit on their desk instead.", question: "Who is more likely to eat healthy long-term?", options: [
                        { text: "Person A—resisting builds stronger willpower", correct: false },
                        { text: "Person B—the junk food prediction never fires because the trigger is gone", correct: true },
                        { text: "Neither—it depends on how motivated they are", correct: false },
                    ], explanation: "Person B eliminated the environmental cue that triggers the junk food prediction. There's nothing to 'resist' because the prediction was never activated." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "What feels like 'resisting'", right: "Competing predictions in conflict" },
                        { left: "What feels like 'giving in'", right: "Lower-level prediction won" },
                        { left: "'Disciplined' people", right: "Have environments that avoid conflict" },
                        { left: "Context (tiredness, stress, cues)", right: "Determines which prediction wins" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "Under the predictive brain framework, what is 'willpower'?", options: [
                        { text: "A limited resource that depletes", correct: false },
                        { text: "One prediction winning over a competing prediction", correct: true },
                        { text: "Something that depends entirely on context", correct: true },
                        { text: "An innate trait some people have more of", correct: false },
                        { text: "A description of which prediction currently has more weight", correct: true },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from the initial trigger to the outcome: What actually happens when you 'resist' temptation?", items: ["You see a cookie — your brain fires a prediction: 'eat it!'", "A competing prediction fires: 'I'm someone who eats healthy'", "Your brain weighs which prediction is stronger in this context", "The stronger prediction wins and drives your behavior", "You experience the result as either 'willpower' or 'giving in'"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "The same person can resist a temptation in one context and give in to it in another—because context changes which prediction wins.", answer: true, explanation: "This is why 'willpower' seems to come and go. It was never a fixed resource—it's context-dependent prediction weighting." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "People who seem disciplined have built environments where competing predictions never _______.", options: ['fire', 'exist', 'matter', 'win'], answer: 'fire' },
                ]
            },
            {
                id: 'mind-6-2', unitId: 'mind-6', order: 2, title: "All Behavior Is Prediction",
                content: {
                    intro: `Not some of your behavior. Not most of it. All of it.\n\nEvery action you take—from brushing your teeth to choosing a career—is driven by your brain's predictions. Even what feels like a "conscious decision" is a prediction generated by your brain before you become aware of it. The feeling of "deciding" is your brain's way of narrating a process that already happened.\n\nWalk into the kitchen—eating prediction activates. Sit on the couch—scrolling prediction activates. Enter the gym—exercise prediction activates. The same person behaves completely differently in different environments. Not because they "chose" to, but because different contexts activate different predictions.\n\nThis is the Free Energy Principle: your brain is a prediction machine that is always, in every moment, generating predictions and acting to minimize the gap between what it predicts and what it senses.`,
                    keyPoint: "ALL behavior is prediction-driven—not most, all. Even 'conscious decisions' are predictions your brain generated. Context determines which predictions activate.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Only habits and automatic behaviors are prediction-driven. Conscious decisions are different.", answer: false, explanation: "All behavior is prediction-driven. 'Conscious decisions' are just higher-level predictions—your brain generated them before you experienced the 'choice.'" },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Your brain is always generating predictions and acting to minimize the _______ between what it predicts and what it senses.", options: ['gap', 'reward', 'pain', 'time'], answer: 'gap' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "You eat healthy all day at work but overeat every night at home on the couch watching TV. You blame your 'lack of discipline' in the evening.", question: "What's actually happening?", options: [
                        { text: "Your willpower runs out at night", correct: false },
                        { text: "Different environments activate different predictions—couch + TV predicts snacking", correct: true },
                        { text: "You're a disciplined person at work but undisciplined at home", correct: false },
                    ], explanation: "The couch-TV context activates a snacking prediction. At work, that prediction never fires. It's not about discipline—it's about which predictions your environment activates." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Walk into kitchen", right: "Eating prediction activates" },
                        { left: "Sit on couch", right: "Scrolling/snacking prediction" },
                        { left: "Enter the gym", right: "Exercise prediction activates" },
                        { left: "'Conscious decision'", right: "Still a prediction your brain made" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "Which behaviors are driven by predictions?", options: [
                        { text: "Habits like brushing teeth", correct: true },
                        { text: "Choosing what to eat for dinner", correct: true },
                        { text: "Career decisions", correct: true },
                        { text: "Only automatic or unconscious behaviors", correct: false },
                        { text: "Every single action you take", correct: true },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from first to last: What's really happening in your brain when you 'make a decision'?", items: ["Your current context activates several relevant predictions at once", "Your brain weighs the competing predictions against each other", "The strongest prediction wins and drives your action", "You become consciously aware of what you did", "You experience the whole thing as a deliberate 'choice'"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "The same person behaves completely differently in different environments because context changes which predictions fire.", answer: true, explanation: "You at the gym vs. you on the couch aren't different levels of discipline—they're different prediction landscapes." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "You don't decide your behavior. Your _______ decides it by activating predictions.", options: ['context', 'willpower', 'personality', 'genetics'], answer: 'context' },
                ]
            },
            {
                id: 'mind-6-3', unitId: 'mind-6', order: 3, title: "You Didn't Choose Most of Your Habits",
                content: {
                    intro: `Here's another counter-intuitive truth: you didn't consciously decide to form most of your habits. Your environment shaped them for you.\n\nThe food that was available in your home growing up shaped your eating predictions. The activity level of your family shaped your movement predictions. The routines of your social circle shaped your daily patterns.\n\nYour brain absorbed all of this automatically, building predictions from whatever context it was immersed in. You didn't fail at building good habits—you were simply immersed in environments that built different ones. This isn't about blame. It's about understanding that the same mechanism that built your current habits can build new ones—if you change the environment.`,
                    keyPoint: "Most habits weren't consciously chosen—they were absorbed from your environment. The same process that built your current habits can build new ones through environment change.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Most of your current habits were formed through conscious, deliberate choices.", answer: false, explanation: "Most habits formed automatically through repeated exposure to environmental cues and contexts you didn't choose." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Your brain built predictions from whatever _______ it was immersed in.", options: ['context', 'motivation', 'discipline', 'desire'], answer: 'context' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone grew up in a household where the TV was always on, snacks were always available, and no one exercised. Now they struggle with sedentary habits and overeating.", question: "Why do they have these habits?", options: [
                        { text: "They lack discipline and motivation", correct: false },
                        { text: "Their brain built predictions from the environment it was immersed in", correct: true },
                        { text: "It's genetic and unchangeable", correct: false },
                    ], explanation: "Their brain did exactly what brains do—it built predictions from repeated experience. Different environment, different habits." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Food available at home", right: "Shaped eating predictions" },
                        { left: "Family activity level", right: "Shaped movement predictions" },
                        { left: "Social circle routines", right: "Shaped daily patterns" },
                        { left: "Repeated environmental exposure", right: "Built habits automatically" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "Which shaped your habits without conscious choice?", options: [
                        { text: "Food available in your childhood home", correct: true },
                        { text: "Your family's activity patterns", correct: true },
                        { text: "A decision you made on January 1st", correct: false },
                        { text: "The routines of people around you", correct: true },
                        { text: "A motivational speech you heard once", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from the beginning to the end result: How did your existing habits form without you choosing them?", items: ["You were immersed in an environment for a long time (family, school, work)", "Your brain automatically tracked the patterns it observed", "Predictions about 'what you do' built up without conscious effort", "Those predictions became habitual behaviors you do on autopilot", "You assumed 'this is just who I am' — but it was just learned predictions"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "If your habits were shaped by environment, they can be reshaped by changing your environment.", answer: true, explanation: "The same mechanism that built your current habits—environmental immersion—can build new ones." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "You didn't fail at building good habits—you were immersed in environments that built _______ ones.", options: ['different', 'better', 'perfect', 'impossible'], answer: 'different' },
                ]
            },
            {
                id: 'mind-6-4', unitId: 'mind-6', order: 4, title: "Redesign the System, Not Yourself",
                content: {
                    intro: `Stop trying to become a "better" person. Start building a better system.\n\nThis feels like cheating—like you're supposed to be strong enough to resist temptation, disciplined enough to force yourself. But that feeling is itself a prediction—one our culture installed in you. The idea that change requires personal struggle is a cultural story, not a scientific one.\n\nThe science is clear: reduce friction for behaviors you want, increase friction for behaviors you don't. Put the vegetables at eye level. Put running shoes by the door. Delete social media from your phone. Make the healthy choice the easy choice.\n\nYou're not weak for needing this. This IS how your brain works. Your predictive brain will automate whatever the environment makes easiest. You don't fight predictions—you redesign what triggers them.`,
                    keyPoint: "Change your environment, not yourself. Reduce friction for desired behaviors, increase friction for unwanted ones. You don't fight predictions—you redesign what triggers them.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Reduce _______ for behaviors you want, increase it for behaviors you don't.", options: ['friction', 'motivation', 'awareness', 'willpower'], answer: 'friction' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Needing to redesign your environment means you're weak.", answer: false, explanation: "It means you understand how your brain actually works. Working with your predictive brain is smart, not weak." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "You want to drink more water during the day. You currently keep water in the fridge and your phone on your desk.", question: "What system redesign would help most?", options: [
                        { text: "Set phone reminders to drink water every hour", correct: false },
                        { text: "Put a filled water bottle on your desk where you can see it", correct: true },
                        { text: "Promise yourself you'll be more disciplined about hydration", correct: false },
                    ], explanation: "A visible water bottle triggers a hydration prediction automatically. No willpower or reminders needed—your brain does the work." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Vegetables at eye level", right: "Reduces friction for healthy eating" },
                        { left: "Running shoes by the door", right: "Reduces friction for exercise" },
                        { left: "Phone in another room", right: "Increases friction for scrolling" },
                        { left: "Junk food out of sight", right: "Increases friction for snacking" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "Which are examples of redesigning the system?", options: [
                        { text: "Meal prepping on Sunday so healthy food is ready", correct: true },
                        { text: "Telling yourself to try harder", correct: false },
                        { text: "Laying out workout clothes the night before", correct: true },
                        { text: "Keeping only healthy food in the house", correct: true },
                        { text: "Relying on motivation to kick in", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order these system-redesign steps from first to last:", items: ["Identify which specific behavior you want to change", "Find the friction points — what makes the old behavior easy and the new one hard?", "Reduce friction for the desired behavior (make it easier)", "Increase friction for the unwanted behavior (make it harder)", "Let your predictive brain gradually automate the new pattern"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Making healthy choices easier through environment design is 'cheating.'", answer: false, explanation: "There's no cheating—this IS how behavior change works. The myth that you should just be 'strong enough' is what fails people." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Your predictive brain will automate whatever the environment makes _______.", options: ['easiest', 'hardest', 'scariest', 'newest'], answer: 'easiest' },
                ]
            },
            {
                id: 'mind-6-5', unitId: 'mind-6', order: 5, title: "People Are Your Strongest Environment",
                content: {
                    intro: `Your social environment shapes your brain's predictions more powerfully than anything else.\n\nResearch shows that if your close friend becomes obese, your own risk increases by 57%. Not because of shared meals or genetics—because your brain recalibrates what's "normal" based on the people around you. Your predictions about eating, moving, and living are constantly updated by observing others.\n\nThis is the most counter-intuitive part: you don't change yourself by deciding to change. You change by immersing yourself in environments—especially social ones—where the new behavior is normal. Your brain absorbs "what people like me do" and updates its predictions automatically. The environment changes you. Not the other way around.`,
                    keyPoint: "Social environment is the strongest predictor of behavior. Your brain recalibrates 'normal' based on the people around you. Immerse yourself in contexts where the desired behavior is standard.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Your social circle has minimal impact on your health behaviors.", answer: false, explanation: "Research shows your social environment is one of the strongest predictors of your health behaviors—your brain recalibrates 'normal' based on those around you." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Your brain recalibrates what's '_______ ' based on the people around you.", options: ['normal', 'possible', 'impossible', 'wrong'], answer: 'normal' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone joins a running club where everyone runs three times a week. They weren't a runner before. After three months, they're running regularly without forcing themselves.", question: "What happened?", options: [
                        { text: "They finally found enough willpower", correct: false },
                        { text: "Their brain absorbed 'people like me run' and updated its predictions", correct: true },
                        { text: "Running clubs have a magic effect", correct: false },
                    ], explanation: "Being immersed in a social context where running is normal updated their brain's prediction of 'what I do.' The environment changed them." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Friends who exercise", right: "Your brain predicts exercise is normal" },
                        { left: "Friends who eat well", right: "Your brain predicts healthy eating is normal" },
                        { left: "Social circle norms", right: "Recalibrate your 'normal'" },
                        { left: "Immersion in new group", right: "Updates predictions automatically" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "Why is social environment the strongest predictor of behavior?", options: [
                        { text: "Your brain tracks 'what people like me do'", correct: true },
                        { text: "Social norms recalibrate your predictions automatically", correct: true },
                        { text: "Peer pressure forces you to comply", correct: false },
                        { text: "Observing others updates your sense of 'normal'", correct: true },
                        { text: "You copy others only when you choose to", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from first to last: How does being around new people gradually change your behavior?", items: ["You immerse yourself in a new social group or community", "Your brain observes 'what people here do' and absorbs their norms", "Your internal sense of 'what's normal' recalibrates to match the group", "New behaviors start to feel natural rather than forced", "You find yourself changing without ever having 'decided' to change"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "You change by immersing yourself in environments where the desired behavior is already normal—not by forcing yourself to change.", answer: true, explanation: "This is the core counter-intuitive insight. The environment changes you. You don't muscle through change—you absorb it." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "The environment changes you. Not the other way _______.", options: ['around', 'through', 'over', 'down'], answer: 'around' },
                ]
            },
        ],
        'mind-7': [
            {
                id: 'mind-7-1', unitId: 'mind-7', order: 1, title: "Your Brain Minimizes Surprise",
                content: {
                    intro: `The Free Energy Principle, developed by neuroscientist Karl Friston, makes a profound claim: your brain has one job—minimize surprise.\n\nNot surprise like a birthday party. "Surprise" here means the gap between what your brain predicts and what actually happens. Your brain is constantly generating predictions about everything—what you'll see, hear, feel, taste—and then comparing those predictions against incoming sensory data.\n\nWhen prediction matches reality, surprise is low, and everything runs smoothly. When they don't match, that's a prediction error—and your brain must resolve it. This isn't something your brain sometimes does. It's the only thing your brain ever does.`,
                    keyPoint: "The Free Energy Principle: your brain's single function is minimizing the gap between its predictions and reality. This drives ALL perception, action, and learning.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "In the Free Energy Principle, 'surprise' means the _______ between what your brain predicts and what actually happens.", options: ['gap', 'reward', 'emotion', 'memory'], answer: 'gap' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Minimizing prediction error is something your brain does occasionally, alongside other functions.", answer: false, explanation: "It's not occasional—it's the only thing your brain ever does. Every perception, action, emotion, and thought is prediction error minimization." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "You reach for your coffee mug and it's much lighter than expected—it's empty. You feel a small jolt of surprise.", question: "What just happened in your brain?", options: [
                        { text: "Your muscles malfunctioned", correct: false },
                        { text: "Your brain predicted the weight of a full mug, and the mismatch created a prediction error", correct: true },
                        { text: "You weren't paying attention", correct: false },
                    ], explanation: "Your brain predicted the sensory experience of lifting a full mug. The lighter-than-expected input was a prediction error that demanded attention." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Prediction matches reality", right: "Low surprise, smooth operation" },
                        { left: "Prediction doesn't match", right: "Prediction error, brain must respond" },
                        { left: "Free energy", right: "The gap your brain minimizes" },
                        { left: "Karl Friston", right: "Developed the Free Energy Principle" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "What does the Free Energy Principle claim?", options: [
                        { text: "The brain minimizes the gap between prediction and reality", correct: true },
                        { text: "This drives all perception, action, and learning", correct: true },
                        { text: "The brain works like a camera recording reality", correct: false },
                        { text: "Every thought is prediction error minimization", correct: true },
                        { text: "Surprise minimization is an occasional brain function", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order the prediction cycle from first step to last:", items: ["Brain generates a prediction about what will happen next", "Actual sensory data arrives from the outside world", "Brain compares its prediction to the real data", "Any mismatch between prediction and reality creates a 'prediction error'", "Brain takes action to minimize that error (update the model or change the world)"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "A fish out of water is in a high-surprise state—its brain's predictions about the world no longer match reality.", answer: true, explanation: "The fish's entire predictive model expects water. On land, every sensory signal is a massive prediction error. It must minimize surprise (get back to water) or cease to exist." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Your brain's single function is minimizing the gap between its _______ and reality.", options: ['predictions', 'desires', 'memories', 'emotions'], answer: 'predictions' },
                ]
            },
            {
                id: 'mind-7-2', unitId: 'mind-7', order: 2, title: "Two Ways to Minimize Surprise",
                content: {
                    intro: `Your brain has exactly two ways to close the gap between prediction and reality.\n\nFirst: change your mind. Update your predictions to match what's actually happening. This is perception and learning. You expected rain but the sun is out—your brain updates the prediction.\n\nSecond: change the world. Act on your environment to make reality match your predictions. You predict your body should be warm. You feel cold. Instead of updating the prediction to "I should be cold," you put on a sweater. Your action changed reality to match your prediction.\n\nThis is the key insight: action and perception are not separate processes. They're two sides of the same coin—both serving to minimize the gap between prediction and reality.`,
                    keyPoint: "The brain minimizes surprise two ways: change your mind (update predictions to match reality) or change the world (act to make reality match predictions). Action and perception are two sides of the same coin.",
                },
                games: [
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Change your mind", right: "Update predictions to match reality" },
                        { left: "Change the world", right: "Act to make reality match predictions" },
                        { left: "Perception", right: "A form of prediction updating" },
                        { left: "Action", right: "Making the world match predictions" },
                    ]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Action and perception are completely separate brain processes.", answer: false, explanation: "They're two sides of the same coin—both are strategies for minimizing the gap between prediction and reality." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "You predict your room should be at a comfortable temperature. You start feeling cold.", question: "What are the two ways your brain can minimize this surprise?", options: [
                        { text: "Ignore it or complain", correct: false },
                        { text: "Update the prediction (accept the cold) or act (put on a sweater/turn up heat)", correct: true },
                        { text: "Wait for someone else to fix it", correct: false },
                    ], explanation: "Change your mind (accept this temperature) or change the world (put on a sweater). Both close the gap between prediction and reality." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "When you act on the environment, you're making _______ match your predictions.", options: ['reality', 'predictions', 'emotions', 'memories'], answer: 'reality' },
                    { type: GAME_TYPES.TAP_ALL, question: "Which are examples of 'changing the world' to match predictions?", options: [
                        { text: "Putting on a sweater when cold", correct: true },
                        { text: "Getting food when you predict hunger", correct: true },
                        { text: "Accepting that it's raining", correct: false },
                        { text: "Moving to a quieter room", correct: true },
                        { text: "Learning that spiders are harmless", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from first to last: How does your brain use 'active inference' to change the world instead of updating its model?", items: ["Brain predicts a desired state (e.g., 'my body should be warm')", "Sensory signals don't match — you feel cold", "Brain generates an action plan to fix the mismatch", "You take action (put on a sweater)", "Now the sensory signals match the prediction — mismatch resolved"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Every action you take is your brain trying to make reality match its predictions.", answer: true, explanation: "This is the core of active inference. You eat because your brain predicts you should be fed. You exercise because your brain predicts movement. All action serves prediction." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Action and perception are two sides of the same _______.", options: ['coin', 'brain', 'problem', 'process'], answer: 'coin' },
                ]
            },
            {
                id: 'mind-7-3', unitId: 'mind-7', order: 3, title: "Precision: What Your Brain Listens To",
                content: {
                    intro: `Not all predictions are equal. Your brain assigns precision—basically confidence—to each prediction. High-precision predictions dominate your experience. Low-precision predictions get ignored as noise.\n\nThis is what attention actually is. When you "pay attention" to something, your brain is cranking up the precision on prediction errors from that source. When you're "distracted," precision has shifted elsewhere.\n\nHere's why this matters: context changes precision. When you're well-rested and in a supportive environment, higher-level predictions ("I'm someone who eats healthy") have high precision. When you're exhausted and stressed, lower-level, immediate predictions ("that food would feel good right now") gain precision. Same person, same predictions—different precision weights based on context.`,
                    keyPoint: "Precision is the brain's confidence weighting. Context shifts which predictions get high precision. Attention IS precision. Stress and fatigue shift precision to immediate, lower-level predictions.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Precision is the brain's _______ weighting for predictions—higher precision means the brain takes that prediction more seriously.", options: ['confidence', 'speed', 'size', 'emotional'], answer: 'confidence' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Attention is something separate from the brain's prediction system.", answer: false, explanation: "Attention IS precision weighting. When you 'pay attention,' your brain is increasing the precision of prediction errors from that source." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "After a terrible night's sleep and a stressful day, you find yourself reaching for junk food—even though you normally eat healthy without thinking about it.", question: "What happened to your predictions?", options: [
                        { text: "Your healthy eating prediction disappeared", correct: false },
                        { text: "Stress and fatigue shifted precision from your higher-level 'eat healthy' prediction to the immediate 'food feels good' prediction", correct: true },
                        { text: "You lost your willpower", correct: false },
                    ], explanation: "Both predictions still exist. But context (exhaustion, stress) shifted precision weighting to the immediate, lower-level prediction. This is what people mistakenly call 'running out of willpower.'" },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "High precision prediction", right: "Dominates your experience" },
                        { left: "Low precision prediction", right: "Gets ignored as noise" },
                        { left: "Attention", right: "Is precision weighting" },
                        { left: "Stress and fatigue", right: "Shift precision to immediate predictions" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "What shifts precision to lower-level, immediate predictions?", options: [
                        { text: "Sleep deprivation", correct: true },
                        { text: "Chronic stress", correct: true },
                        { text: "Being well-rested", correct: false },
                        { text: "Metabolic depletion", correct: true },
                        { text: "Supportive social environment", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from first to last: Why does your 'eat healthy' intention lose to comfort food when you're stressed?", items: ["Two predictions compete: 'eat healthy' vs. 'eat comfort food'", "Your context changes — you become exhausted and stressed", "The brain gives more weight (precision) to the immediate comfort-food prediction", "The comfort-food prediction now overpowers the healthy-eating one", "You act on whichever prediction your brain weighted most heavily"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "The same person can act on completely different predictions depending on their current context—because context changes precision weighting.", answer: true, explanation: "Same brain, same predictions—different precision weights. This is why managing your context (sleep, stress, environment) is more powerful than trying to 'resist.'" },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "What people call 'willpower failing' is actually precision shifting to _______ predictions due to context.", options: ['immediate', 'abstract', 'future', 'rational'], answer: 'immediate' },
                ]
            },
            {
                id: 'mind-7-4', unitId: 'mind-7', order: 4, title: "Your Body Budget Drives Everything",
                content: {
                    intro: `Your brain's deepest predictions aren't about the outside world—they're about your body's internal state.\n\nYour brain is constantly predicting and managing what scientists call allostasis—your body's energy budget. Body temperature, blood glucose, hydration, cortisol—your brain is forecasting these needs and preparing to meet them BEFORE they arise.\n\nThis is why your blood pressure rises slightly before you stand up. Your brain predicted you'd need it. This is why cortisol peaks before you wake. Your brain is pre-loading energy for the day.\n\nEvery behavior ultimately serves this body budget. You eat because your brain predicts a metabolic need. You sleep because your brain predicts energy restoration is needed. You seek social connection because isolation is metabolically expensive—your brain has to do all its own regulation without help.`,
                    keyPoint: "Your brain's deepest predictions manage your body's energy budget (allostasis). Every behavior—eating, sleeping, socializing—ultimately serves body budget regulation.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Allostasis is your brain's predictive management of the body's energy _______.", options: ['budget', 'level', 'output', 'waste'], answer: 'budget' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Your brain waits until your body needs something, then reacts to fix it.", answer: false, explanation: "That's homeostasis (reactive). Allostasis is predictive—your brain prepares BEFORE needs arise. Blood pressure rises before you stand, cortisol peaks before you wake." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Your cortisol peaks in the morning before you even wake up, and your blood pressure rises slightly just before you stand.", question: "Why does this happen?", options: [
                        { text: "These are stress responses to waking up", correct: false },
                        { text: "Your brain predicted these needs and prepared in advance—this is allostasis", correct: true },
                        { text: "Your body just does this randomly", correct: false },
                    ], explanation: "Your brain doesn't react—it predicts. It forecasts that you'll need energy (cortisol) to wake and blood flow (pressure) to stand, and prepares ahead of time." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Homeostasis", right: "Reactive: detect problem, then fix" },
                        { left: "Allostasis", right: "Predictive: prepare before need arises" },
                        { left: "Eating", right: "Predicted metabolic need" },
                        { left: "Social connection", right: "Reduces metabolic cost of self-regulation" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "Which behaviors serve your body budget?", options: [
                        { text: "Eating", correct: true },
                        { text: "Sleeping", correct: true },
                        { text: "Seeking social connection", correct: true },
                        { text: "None of the above—they're separate from the body budget", correct: false },
                        { text: "All behavior serves the body budget", correct: true },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from first to last: How does allostasis keep your body one step ahead?", items: ["Brain forecasts an upcoming metabolic need (e.g., you'll need energy soon)", "Brain starts preparing resources in advance of the actual demand", "Body state adjusts before the need actually arises", "When the need arrives, it's met smoothly because the body was already prepared", "The result: minimal surprise and efficient energy use"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Social isolation is metabolically expensive because your brain has to do all its own regulation without others helping.", answer: true, explanation: "Your brain co-regulates with other people—synchronizing breathing, heart rates, and hormonal cycles. Alone, it has to do all this work solo, which costs more energy." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Every behavior ultimately serves your body's energy _______ regulation.", options: ['budget', 'crisis', 'waste', 'surplus'], answer: 'budget' },
                ]
            },
            {
                id: 'mind-7-5', unitId: 'mind-7', order: 5, title: "You and Your Environment Are One System",
                content: {
                    intro: `The Free Energy Principle reveals something most people miss: you and your environment are not separate. You are a single coupled system.\n\nYour brain models the environment. Your actions shape the environment. The environment feeds data back to your brain. Your brain updates its predictions. Round and round, constantly.\n\nThis is why changing yourself through pure internal effort—"trying harder," "being more disciplined"—is working against the physics of how your brain operates. You can't separate the prediction machine from what it's predicting about.\n\nChange the environment, and the predictions change. The predictions change, and the behavior changes. The behavior changes, and the environment changes further. You don't change yourself. You change the system—and the system changes you.`,
                    keyPoint: "You and your environment form one coupled system. Change the environment and predictions update automatically. You don't change yourself—you change the system, and the system changes you.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "You can meaningfully separate a person from their environment when analyzing behavior.", answer: false, explanation: "Under the Free Energy Principle, person and environment form one coupled system. The brain's predictions are shaped by and shape the environment continuously." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "You and your environment are not separate—you are a single coupled _______.", options: ['system', 'accident', 'problem', 'reaction'], answer: 'system' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone keeps trying to 'be more disciplined' and 'try harder' to change their eating habits, but nothing sticks despite genuine effort.", question: "Why doesn't pure internal effort work?", options: [
                        { text: "They're not trying hard enough", correct: false },
                        { text: "You can't separate the prediction machine from what it predicts about—the environment shapes predictions, not internal effort", correct: true },
                        { text: "Some people just can't change", correct: false },
                    ], explanation: "The brain's predictions are generated from environmental data. 'Trying harder' without changing the environment is like trying to change a river's course without moving the banks." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Brain models the environment", right: "Predictions reflect surroundings" },
                        { left: "Actions shape the environment", right: "You change the prediction landscape" },
                        { left: "Environment feeds data back", right: "Brain updates predictions" },
                        { left: "Change the system", right: "The system changes you" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "What does 'you and your environment are one system' mean for behavior change?", options: [
                        { text: "Change the environment, and predictions update automatically", correct: true },
                        { text: "Internal effort alone is working against how the brain operates", correct: true },
                        { text: "You should just think harder about changing", correct: false },
                        { text: "The system changes you when you change the system", correct: true },
                        { text: "Discipline is all you need", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order this positive feedback loop from the first change to the cycle repeating:", items: ["You change something in your environment (e.g., join a gym, clear junk food)", "New data from that changed environment reaches your brain", "Brain automatically updates its predictions based on the new surroundings", "Those updated predictions drive new behaviors you wouldn't have done before", "Those new behaviors further shape your environment — and the cycle continues"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "You don't change yourself—you change the system, and the system changes you.", answer: true, explanation: "This is the fundamental insight of the Free Energy Principle applied to behavior change. Person and environment are inseparable." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Change the environment, and the _______ change automatically.", options: ['predictions', 'genetics', 'muscles', 'memories'], answer: 'predictions' },
                ]
            },
        ],
        'mind-8': [
            {
                id: 'mind-8-1', unitId: 'mind-8', order: 1, title: "Learning Costs Energy",
                content: {
                    intro: `Here's something your brain doesn't want you to know: learning is metabolically expensive.\n\nEvery time your brain encounters a prediction error—something that surprises it—it has to rebuild part of its internal model. That rebuilding requires energy. Glucose gets burned. Neural pathways get rewired. New synaptic connections form while old ones weaken.\n\nYour brain uses about 20% of your body's total energy despite being only 2% of your weight. It can't afford to rebuild its models constantly. So it does something clever: it avoids surprise whenever possible.\n\nThis is the dark side of the Free Energy Principle. Minimizing surprise doesn't just mean "predict well." It also means "avoid situations that would prove your predictions wrong." Your brain would rather be right than learn.`,
                    keyPoint: "Updating predictions costs real metabolic energy. Your brain avoids surprise not just for efficiency—but because learning is expensive. It would rather be right than learn.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Learning is metabolically free—it just requires attention.", answer: false, explanation: "Learning requires rebuilding neural models. That means burning glucose, rewiring pathways, and forming new connections. It's genuinely, physically expensive." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Your brain uses about _______% of your total energy despite being 2% of your weight.", options: ['20', '5', '50', '2'], answer: '20' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "After a long day of learning a completely new skill, you feel exhausted—even though you were just sitting down the whole time.", question: "Why are you so tired?", options: [
                        { text: "You're imagining it—sitting isn't tiring", correct: false },
                        { text: "Your brain burned significant metabolic energy rebuilding its prediction models", correct: true },
                        { text: "You need more coffee", correct: false },
                    ], explanation: "Learning = prediction errors = model rebuilding = real energy expenditure. Mental exhaustion after deep learning is genuinely metabolic, not imagined." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Prediction matches reality", right: "Cheap—no update needed" },
                        { left: "Prediction error", right: "Expensive—model needs rebuilding" },
                        { left: "Avoiding surprise", right: "Energy conservation strategy" },
                        { left: "Seeking novelty", right: "Metabolically costly" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "Why does the brain prefer to avoid surprise?", options: [
                        { text: "Updating predictions costs real metabolic energy", correct: true },
                        { text: "Neural rewiring requires glucose and resources", correct: true },
                        { text: "The brain is lazy", correct: false },
                        { text: "Sticking with existing models is cheaper than rebuilding", correct: true },
                        { text: "Surprise is always dangerous", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order the chain of reasoning from first to last: Why does the brain resist learning new things?", items: ["Something surprising happens, creating a prediction error", "Fixing that error requires updating the brain's internal model", "Updating the model costs real metabolic energy", "The brain prefers to conserve energy whenever possible", "So the brain actively avoids surprise and resists change"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Your brain would rather be wrong efficiently than be right expensively.", answer: true, explanation: "If the cost of updating is higher than the cost of being slightly wrong, your brain will stick with the wrong prediction. Energy conservation wins." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Your brain would rather be _______ than learn.", options: ['right', 'wrong', 'fast', 'slow'], answer: 'right' },
                ]
            },
            {
                id: 'mind-8-2', unitId: 'mind-8', order: 2, title: "Confirmation Bias Is the Operating System",
                content: {
                    intro: `Confirmation bias isn't a flaw in your thinking. It IS your thinking.\n\nThe Free Energy Principle says your brain minimizes surprise. What's the easiest way to minimize surprise? Seek out information that confirms what you already predict. Avoid information that would create prediction errors.\n\nThis is why you're drawn to news sources that agree with you, why you notice evidence that supports your beliefs and overlook evidence that contradicts them, and why arguments rarely change anyone's mind. Your brain isn't being stubborn—it's being efficient. Confirming evidence is cheap to process. Disconfirming evidence is expensive.\n\nEveryone thinks they're right. Not because humans are arrogant—but because the brain is literally engineered to confirm its own predictions. Being "right" is the low-energy state. Learning you're wrong is the high-energy state.`,
                    keyPoint: "Confirmation bias isn't a flaw—it's your brain's primary operating mode. Confirming predictions is cheap. Being wrong is expensive. Everyone thinks they're right because the brain is built to confirm its own model.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Confirmation bias is a thinking error that rational people can simply avoid.", answer: false, explanation: "Confirmation bias isn't a bug—it's the brain's core operating system. Minimizing surprise MEANS seeking confirmation. Everyone does it because every brain does it." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Confirming evidence is _______ to process. Disconfirming evidence is expensive.", options: ['cheap', 'difficult', 'dangerous', 'useless'], answer: 'cheap' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Two people with opposite political views both watch the same debate. Each one comes away more convinced they were right all along.", question: "What happened?", options: [
                        { text: "One of them wasn't paying attention", correct: false },
                        { text: "Both brains filtered the same information to confirm their existing predictions—minimizing surprise", correct: true },
                        { text: "Debates don't contain useful information", correct: false },
                    ], explanation: "Both brains did exactly the same thing: minimize surprise by attending to confirming evidence and discounting disconfirming evidence. Neither was 'wrong'—both were running the same operating system." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Seeking confirming evidence", right: "Low energy—predictions confirmed" },
                        { left: "Encountering disconfirming evidence", right: "High energy—model needs updating" },
                        { left: "Everyone thinks they're right", right: "Being 'right' is the low-energy state" },
                        { left: "Confirmation bias", right: "The brain's primary operating mode" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "Why does everyone think they're right?", options: [
                        { text: "The brain is built to confirm its own predictions", correct: true },
                        { text: "Being 'right' is the low-energy state", correct: true },
                        { text: "Some people are just more stubborn", correct: false },
                        { text: "Processing confirming evidence costs less energy", correct: true },
                        { text: "Only unintelligent people have confirmation bias", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from first to last: How does confirmation bias work in the brain?", items: ["Brain holds an existing prediction (a belief you already have)", "New information arrives from the outside world", "Brain checks: does this information confirm or contradict my belief?", "Information that confirms the belief is absorbed cheaply — no energy needed", "Information that contradicts it is discounted or ignored — saving energy"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "The smarter you are, the less susceptible you are to confirmation bias.", answer: false, explanation: "Intelligence doesn't reduce confirmation bias—it can actually make you better at constructing arguments to SUPPORT your existing predictions. Every brain minimizes surprise." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Being 'right' is the _______-energy state for your brain.", options: ['low', 'high', 'no', 'maximum'], answer: 'low' },
                ]
            },
            {
                id: 'mind-8-3', unitId: 'mind-8', order: 3, title: "Your Brain Builds Reality to Match",
                content: {
                    intro: `Your brain doesn't just passively predict and then check. It actively constructs your perception, attention, and behavior to CONFIRM its predictions.\n\nIf your brain predicts someone is unfriendly, you'll notice their frown and miss their smile. If your brain predicts exercise is painful, it'll amplify the discomfort and mute the endorphins. If your brain predicts you'll fail, it'll direct your attention to every small mistake and filter out every success.\n\nYou literally see what you expect to see. Not metaphorically—literally. Your brain generates the visual scene based on predictions and only updates it when prediction errors are large enough to break through.\n\nThis is how beliefs become self-fulfilling prophecies. The prediction shapes what you notice, what you notice shapes your experience, and your experience "confirms" the prediction. The loop closes. Your brain built the evidence for its own case.`,
                    keyPoint: "Your brain doesn't just predict—it actively constructs your perception to match its predictions. You literally see what you expect. Beliefs become self-fulfilling because the brain builds confirming evidence.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Your brain actively constructs your _______ to match its predictions.", options: ['perception', 'muscles', 'DNA', 'food'], answer: 'perception' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "You see reality as it objectively is, and then your brain interprets it.", answer: false, explanation: "Your brain generates the visual scene FROM predictions. You literally see what your brain expects. Reality only breaks through when prediction errors are large enough." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone who believes 'I'm bad at fitness' starts a workout program. They complete 9 exercises with good form but struggle on the 10th.", question: "What will their brain focus on?", options: [
                        { text: "The 9 successful exercises", correct: false },
                        { text: "The 1 struggle—because it confirms the prediction 'I'm bad at fitness'", correct: true },
                        { text: "Their overall improvement", correct: false },
                    ], explanation: "The brain highlighted the confirming evidence (the struggle) and filtered out the disconfirming evidence (the 9 successes). The prediction shaped what got noticed." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Predict someone is unfriendly", right: "Notice their frown, miss their smile" },
                        { left: "Predict exercise is painful", right: "Amplify discomfort, mute endorphins" },
                        { left: "Predict you'll fail", right: "Attend to mistakes, filter out successes" },
                        { left: "The prediction loop", right: "Brain builds evidence for its own case" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "How does the brain make predictions self-fulfilling?", options: [
                        { text: "Directs attention to confirming evidence", correct: true },
                        { text: "Filters out disconfirming evidence", correct: true },
                        { text: "Objectively evaluates all evidence equally", correct: false },
                        { text: "Constructs perception to match expectations", correct: true },
                        { text: "Only processes information that matches beliefs", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order the self-fulfilling prophecy cycle from starting belief to reinforcement:", items: ["Brain holds a prediction like 'exercise is miserable for me'", "That prediction filters what you notice — you focus on discomfort", "What you notice shapes your actual experience — it feels worse", "The bad experience seems to 'confirm' the original belief", "The belief strengthens further — making it even harder to change"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "If you believe you'll fail at a new diet, your brain will literally construct your experience to confirm that prediction.", answer: true, explanation: "Your brain will amplify every slip, filter out every success, and direct your attention to evidence of failure. The prediction builds its own case." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Beliefs become self-fulfilling because the brain builds _______ evidence for its own case.", options: ['confirming', 'contradicting', 'random', 'neutral'], answer: 'confirming' },
                ]
            },
            {
                id: 'mind-8-4', unitId: 'mind-8', order: 4, title: "Why People Refuse New Information",
                content: {
                    intro: `Now you can understand something frustrating about humans: why people refuse to learn even when the evidence is right in front of them.\n\nIt's not stupidity. It's not stubbornness. It's energy economics.\n\nNew information that contradicts existing predictions creates prediction errors. Prediction errors require model updating. Model updating costs metabolic energy. The brain has multiple strategies to avoid this cost:\n\n1. Ignore the information entirely\n2. Reinterpret it to fit existing predictions\n3. Discredit the source\n4. Avoid environments where you'd encounter it\n5. Surround yourself with people who share your predictions\n\nEvery one of these strategies minimizes surprise and conserves energy. Your brain is not being closed-minded. It's being economical. Understanding this doesn't make it less frustrating—but it does explain why simply showing someone "the facts" almost never changes their mind.`,
                    keyPoint: "People resist new information because updating predictions is metabolically expensive. The brain has multiple strategies to avoid prediction errors: ignore, reinterpret, discredit, avoid, or find agreement.",
                },
                games: [
                    { type: GAME_TYPES.TAP_ALL, question: "How does the brain avoid the cost of updating its predictions?", options: [
                        { text: "Ignore disconfirming information", correct: true },
                        { text: "Reinterpret it to fit existing beliefs", correct: true },
                        { text: "Objectively evaluate all evidence", correct: false },
                        { text: "Discredit the source", correct: true },
                        { text: "Surround yourself with agreeing people", correct: true },
                    ]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "People who reject clear evidence are simply being stupid or stubborn.", answer: false, explanation: "It's not stupidity—it's energy economics. Updating predictions is metabolically expensive. Every brain, including yours, runs the same cost-avoidance strategies." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "You share solid scientific evidence about nutrition with a friend. They dismiss the study, question the researchers, and say their doctor told them differently.", question: "What is their brain doing?", options: [
                        { text: "Being closed-minded on purpose", correct: false },
                        { text: "Running cost-avoidance strategies: discrediting the source to avoid the metabolic cost of updating their prediction model", correct: true },
                        { text: "They just don't care about nutrition", correct: false },
                    ], explanation: "Their brain detected incoming prediction errors and deployed defenses—discredit the source, cite alternative authority—to avoid the expensive process of model updating." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Simply showing someone 'the facts' almost never changes their mind because updating is _______.", options: ['expensive', 'easy', 'automatic', 'free'], answer: 'expensive' },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Ignoring evidence", right: "Prevents prediction error" },
                        { left: "Reinterpreting to fit", right: "Avoids model updating" },
                        { left: "Discrediting the source", right: "Invalidates the prediction error" },
                        { left: "Echo chambers", right: "Environments with zero surprise" },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from first to last: Why doesn't showing someone the facts change their mind?", items: ["New factual information arrives that contradicts what they already believe", "Brain detects that accepting this would create a large prediction error", "Processing that error would require an expensive model update (real energy cost)", "Brain deploys a cost-avoidance strategy (rationalization, dismissal, etc.)", "The information is rejected — energy is conserved and the old belief survives"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "You are immune to these information-rejection strategies because you're aware of them.", answer: false, explanation: "Awareness helps, but your brain runs these strategies automatically. You do this too—everyone's brain minimizes surprise the same way." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Echo chambers are environments designed for zero _______.", options: ['surprise', 'information', 'people', 'energy'], answer: 'surprise' },
                ]
            },
            {
                id: 'mind-8-5', unitId: 'mind-8', order: 5, title: "Making Learning Less Expensive",
                content: {
                    intro: `If learning is expensive and the brain avoids it, how does anyone ever change?\n\nThe answer: reduce the cost of updating.\n\nSmall prediction errors are cheap. Massive ones are expensive and get rejected. This is why gradual change works and radical overhauls fail. If you try to change everything at once, the prediction errors are so large your brain fights back with everything it has.\n\nBut small, consistent prediction errors? Those get processed. A 5-minute walk when your brain predicts sedentary. One vegetable when your brain predicts junk food. Each one is a small, affordable update.\n\nEnvironment design works for the same reason—it creates prediction errors your brain can process without triggering massive resistance. And social immersion works because being around people who do things differently generates constant, small prediction errors that gradually reshape your model.\n\nYou don't overcome your brain's resistance to learning. You work with it—making updates small enough to be affordable.`,
                    keyPoint: "Make learning affordable: small, consistent prediction errors get processed. Large ones get rejected. Gradual change, environment design, and social immersion all work because they keep the update cost low enough for your brain to pay.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Small prediction errors are cheap. Massive ones are expensive and get _______.", options: ['rejected', 'accepted', 'celebrated', 'ignored'], answer: 'rejected' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Radical overnight life overhauls are the most effective way to create lasting change.", answer: false, explanation: "Radical changes create massive prediction errors that the brain fights. Small, consistent changes create affordable prediction errors that actually get processed." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Person A decides to completely overhaul their diet, exercise routine, sleep schedule, and social habits all at once. Person B makes one small change per week.", question: "Whose brain is more likely to accept the changes?", options: [
                        { text: "Person A—bigger changes create bigger results", correct: false },
                        { text: "Person B—small prediction errors are affordable for the brain to process", correct: true },
                        { text: "Neither—change is impossible", correct: false },
                    ], explanation: "Person A's brain is flooded with massive prediction errors and will fight back hard. Person B's brain can afford to process one small update at a time." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Small prediction error", right: "Affordable—brain processes it" },
                        { left: "Massive prediction error", right: "Expensive—brain rejects it" },
                        { left: "Gradual change", right: "Low update cost" },
                        { left: "Radical overhaul", right: "Triggers maximum resistance" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "Why do these change strategies work?", options: [
                        { text: "Environment design creates small, automatic prediction errors", correct: true },
                        { text: "Social immersion generates constant small updates", correct: true },
                        { text: "Willpower forces the brain to accept big changes", correct: false },
                        { text: "Gradual change keeps update costs affordable", correct: true },
                        { text: "Dramatic overhauls shock the brain into submission", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order these steps from first to last: How to make change small enough that your brain won't resist it:", items: ["Identify the specific change you want to make", "Break it into the smallest possible first step", "Take that step — introducing one small, manageable prediction error", "Brain processes the affordable update without resistance", "Repeat with the next small step — building change gradually"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "You don't overcome your brain's resistance to learning—you work with it by keeping updates affordable.", answer: true, explanation: "Fighting your brain is fighting physics. Work with the prediction system: small errors, gradual updates, environment changes that make new predictions easier to form." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "You don't overcome your brain's resistance. You make updates small enough to be _______.", options: ['affordable', 'invisible', 'painful', 'dramatic'], answer: 'affordable' },
                ]
            },
        ],
        'body-1': [
            {
                id: 'body-1-1', unitId: 'body-1', order: 1, title: "What Muscles Actually Do",
                content: {
                    intro: `Muscles do one thing: they contract. They pull, never push.\n\nWhen you "push" a door, your muscles are actually pulling your bones to create that pushing motion. Every movement you make—walking, lifting, even breathing—happens because muscles shorten and pull on bones. Even your heart is a muscle that contracts rhythmically to pump blood.\n\nHere's how it works: your brain sends a signal through nerves to the muscle fibers. When the fibers receive the signal, the muscle contracts (shortens), pulling on the tendon, which pulls on the bone, creating movement.\n\nMuscles attach to bones through tough, fibrous cords called tendons. (Ligaments are different—they connect bones to other bones at joints.)\n\nThis simple fact—that muscles can only pull—explains why muscles come in opposing pairs.`,
                    keyPoint: "Muscles can only pull by contracting. Your brain signals muscles through nerves, and tendons transmit the pulling force to bones.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Muscles can both push and pull.", answer: false, explanation: "Muscles can only contract (pull). Pushing movements happen because muscles pull bones in ways that create pushing motion." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Muscles create movement by _______ and pulling on bones.", options: ['contracting', 'expanding', 'relaxing', 'stretching'], answer: 'contracting' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "When you do a push-up, your muscles are pushing your body up.", answer: false, explanation: "Your muscles are actually pulling on your bones to create the pushing motion against the floor." },
                    { type: GAME_TYPES.TAP_ALL, question: "Which actions involve muscles contracting?", options: [{ text: "Walking", correct: true }, { text: "Breathing", correct: true }, { text: "Lifting weights", correct: true }, { text: "Sleeping", correct: false }, { text: "Blinking", correct: true }] },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Muscles attach to bones via _______.", options: ['tendons', 'ligaments', 'cartilage', 'skin'], answer: 'tendons' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "You're opening a heavy door by pushing it.", question: "What are your muscles actually doing?", options: [{ text: "Pushing the door directly", correct: false }, { text: "Pulling on bones to create a pushing motion", correct: true }, { text: "Relaxing to let momentum take over", correct: false }], explanation: "Even when 'pushing', your muscles are contracting and pulling on your bones. The bones then push against the door." },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Your heart is also a muscle that contracts.", answer: true, explanation: "Your heart is cardiac muscle that contracts rhythmically to pump blood throughout your body." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Put these 6 steps in order from brain signal to body movement:", items: ["Brain sends an electrical signal through the nerves", "Muscle fibers receive the signal", "Muscle contracts (shortens)", "Shortened muscle pulls on the tendon", "Tendon pulls on the bone it's attached to", "The joint moves"], correctOrder: [0, 1, 2, 3, 4, 5] },
                ]
            },
            {
                id: 'body-1-2', unitId: 'body-1', order: 2, title: "Opposing Pairs",
                content: {
                    intro: `Since muscles can only pull, you need opposing pairs to move joints both ways.\n\nYour biceps bends your elbow. Your triceps straightens it. Your quadriceps straightens your knee. Your hamstrings bend it.\n\nThis pattern repeats throughout your body: chest muscles pull your arms forward, back muscles pull them backward. Hip flexors lift your leg up, glutes extend it behind you.\n\nWhen one muscle contracts, its opposing muscle must relax. This is called reciprocal inhibition—your nervous system automatically signals one muscle to contract while inhibiting (relaxing) its opposite. When you bend your elbow, your brain signals your biceps to contract while your nervous system inhibits your triceps, allowing it to relax. This coordinated dance happens automatically thousands of times per day.`,
                    keyPoint: "Muscles work in opposing pairs through reciprocal inhibition—your nervous system signals one to contract while inhibiting the other.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "When your biceps contracts, your triceps must _______.", options: ['relax', 'contract', 'stretch', 'grow'], answer: 'relax' },
                    { type: GAME_TYPES.TAP_ALL, question: "Which are opposing muscle pairs?", options: [{ text: "Biceps & Triceps", correct: true }, { text: "Quadriceps & Hamstrings", correct: true }, { text: "Biceps & Hamstrings", correct: false }, { text: "Chest & Back", correct: true }, { text: "Chest & Biceps", correct: false }] },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [{ left: "Biceps", right: "Triceps" }, { left: "Quadriceps", right: "Hamstrings" }, { left: "Chest", right: "Back" }, { left: "Hip flexors", right: "Glutes" }] },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Both muscles in an opposing pair can contract at full force simultaneously.", answer: false, explanation: "When one muscle contracts, its opposite must relax. Simultaneous full contraction would lock the joint." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "The quadriceps straighten the knee while the _______ bend it.", options: ['hamstrings', 'calves', 'glutes', 'hip flexors'], answer: 'hamstrings' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "You're doing a bicep curl, lifting a dumbbell up.", question: "What happens to your triceps?", options: [{ text: "It contracts along with the biceps", correct: false }, { text: "It relaxes to allow the biceps to work", correct: true }, { text: "It pushes the weight up", correct: false }], explanation: "For your biceps to contract and bend your elbow, the triceps must relax to allow that movement." },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Your nervous system automatically coordinates opposing muscle pairs.", answer: true, explanation: "This coordination happens automatically through reciprocal inhibition—your nervous system handles it without conscious thought." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Put these in order from first to last: What happens when you bend your elbow?", items: ["Brain sends a signal telling the biceps to contract", "Nervous system sends an inhibiting signal to the triceps", "Triceps relaxes and stops resisting", "Biceps shortens and pulls the forearm up", "Elbow bends"], correctOrder: [0, 1, 2, 3, 4], acceptableOrders: [[0,1,2,3,4],[1,0,2,3,4]] },
                ]
            },
            {
                id: 'body-1-3', unitId: 'body-1', order: 3, title: "Muscle Fiber Types",
                content: {
                    intro: `Not all muscle fibers are the same. You have two main types:\n\nSlow-twitch (Type I): Fatigue-resistant and efficient at using oxygen for sustained energy. Great for endurance activities like walking, jogging, and daily activities.\n\nFast-twitch (Type II): Produce more force for explosive power, but tire quickly. Great for sprinting, jumping, and heavy lifting.\n\nEveryone has both types, but ratios vary genetically. Training can shift some fibers—endurance training develops slow-twitch; power training develops fast-twitch.`,
                    keyPoint: "Slow-twitch fibers use oxygen efficiently for endurance; fast-twitch produce more force for power but fatigue quickly.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "_______ fibers are used for endurance activities like walking.", options: ['Slow-twitch', 'Fast-twitch', 'Mixed', 'Static'], answer: 'Slow-twitch' },
                    { type: GAME_TYPES.TAP_ALL, question: "Which activities primarily use fast-twitch fibers?", options: [{ text: "Sprinting", correct: true }, { text: "Marathon running", correct: false }, { text: "Jumping", correct: true }, { text: "Walking", correct: false }, { text: "Heavy lifting", correct: true }] },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [{ left: "Slow-twitch (Type I)", right: "Endurance activities" }, { left: "Fast-twitch (Type II)", right: "Explosive power" }, { left: "Marathon runner", right: "More slow-twitch" }, { left: "Sprinter", right: "More fast-twitch" }] },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Your muscle fiber ratio is entirely determined by genetics and cannot change.", answer: false, explanation: "While genetics set your baseline, training can shift some fibers. Endurance training develops slow-twitch; power training develops fast-twitch." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone wants to improve their marathon time.", question: "Which type of training should they focus on?", options: [{ text: "Heavy, explosive weightlifting", correct: false }, { text: "Long, steady-state cardio and tempo runs", correct: true }, { text: "Short sprints with long rests", correct: false }], explanation: "Marathon running requires slow-twitch fiber endurance. Long cardio sessions develop these fibers and their efficiency." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Fast-twitch fibers produce more _______ but fatigue quickly.", options: ['force', 'endurance', 'flexibility', 'oxygen'], answer: 'force' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "A 100m sprinter would benefit from having more slow-twitch fibers.", answer: false, explanation: "Sprinting is an explosive activity requiring fast-twitch fibers for maximum power output over a short duration." },
                    { type: GAME_TYPES.TAP_ALL, question: "Which describe slow-twitch fibers?", options: [{ text: "Fatigue-resistant", correct: true }, { text: "High endurance", correct: true }, { text: "Explosive power", correct: false }, { text: "Efficient oxygen use", correct: true }, { text: "Tire quickly", correct: false }] },
                ]
            },
            {
                id: 'body-1-4', unitId: 'body-1', order: 4, title: "How Muscles Grow",
                content: {
                    intro: `Muscle growth happens when you challenge muscles beyond their current capacity.\n\nTraining creates microscopic damage to muscle fibers. During recovery—especially during sleep—your body repairs these fibers and adds a bit extra, making them slightly bigger and stronger. Protein provides the building blocks for this repair.\n\nThis is why progressive overload matters: you need to keep challenging muscles to keep them adapting. And why rest, sleep, and adequate protein are just as important as the training itself.\n\nNote: Soreness isn't required for growth. You can build muscle without being sore after every workout—soreness just indicates damage, not progress.`,
                    keyPoint: "Muscles grow through damage and repair. Training creates stimulus; sleep and protein enable growth. Soreness isn't required.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Muscles grow during the workout itself.", answer: false, explanation: "Workouts create the stimulus (damage). Muscles actually grow during recovery when the body repairs and reinforces fibers." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Muscle growth requires both challenge and _______.", options: ['recovery', 'soreness', 'supplements', 'cardio'], answer: 'recovery' },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order the muscle growth process from the gym to the gains:", items: ["Training challenges muscles beyond their current capacity", "Microscopic damage occurs in the muscle fibers", "Body begins the repair process during rest", "Protein provides building blocks to rebuild the fibers", "Muscle grows back slightly stronger than before"], correctOrder: [0, 1, 2, 3, 4] },
                    { type: GAME_TYPES.TAP_ALL, question: "What's needed for muscle growth?", options: [{ text: "Progressive overload", correct: true }, { text: "Adequate protein", correct: true }, { text: "Training every day without rest", correct: false }, { text: "Sufficient sleep", correct: true }, { text: "Avoiding all discomfort", correct: false }] },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Progressive _______ means gradually increasing the demands on your muscles.", options: ['overload', 'relaxation', 'stretching', 'warmup'], answer: 'overload' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "You've been lifting the same weights for 3 months and stopped seeing results.", question: "What should you do?", options: [{ text: "Keep doing exactly the same thing", correct: false }, { text: "Increase the challenge through more weight, reps, or sets", correct: true }, { text: "Stop working out since it's not working", correct: false }], explanation: "Without progressive overload, muscles stop adapting. You need to increase demands to continue growing." },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Soreness is required for muscle growth.", answer: false, explanation: "Soreness indicates damage but isn't required for growth. You can build muscle without being sore after every workout." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [{ left: "Workout", right: "Creates stimulus" }, { left: "Sleep", right: "When growth happens" }, { left: "Protein", right: "Building blocks" }, { left: "Progressive overload", right: "Continued adaptation" }] },
                ]
            },
            {
                id: 'body-1-5', unitId: 'body-1', order: 5, title: "Use It or Lose It",
                content: {
                    intro: `Your body is efficient—it won't maintain muscle it doesn't need.\n\nWithout regular challenge, muscles atrophy (shrink). During atrophy, muscle fibers shrink, strength decreases, and your body conserves energy. This happens faster than you might think—just two weeks of inactivity can begin measurable muscle loss.\n\nThe good news? Muscle memory is real. When you train, your muscles gain extra nuclei (myonuclei). Even after atrophy, these nuclei persist—they don't disappear. This is why previously trained muscles rebuild faster than untrained ones, even after long breaks.`,
                    keyPoint: "Muscles atrophy without use, but muscle memory (retained nuclei) helps you rebuild faster after breaks.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Once you build muscle, your body maintains it forever automatically.", answer: false, explanation: "Your body only maintains muscle that's being used. Without regular challenge, muscles atrophy." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "_______ memory helps previously trained muscles rebuild faster.", options: ['Muscle', 'Brain', 'Cell', 'Bone'], answer: 'Muscle' },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Muscle loss from inactivity is called _______.", options: ['atrophy', 'hypertrophy', 'dystrophy', 'entropy'], answer: 'atrophy' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Muscle memory means you'll rebuild muscle faster after a break than building it the first time.", answer: true, explanation: "Previously trained muscles retain cellular changes that make rebuilding faster, even after long breaks." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "You trained consistently for 5 years, then took a 1-year break due to injury.", question: "What should you expect when returning?", options: [{ text: "Starting completely from scratch", correct: false }, { text: "Faster progress than a complete beginner", correct: true }, { text: "Never being able to reach your previous level", correct: false }], explanation: "Muscle memory means your body retained adaptations. You'll rebuild faster than someone who never trained." },
                    { type: GAME_TYPES.TAP_ALL, question: "What happens during muscle atrophy?", options: [{ text: "Muscle fibers shrink", correct: true }, { text: "Strength decreases", correct: true }, { text: "Muscle gains extra nuclei", correct: false }, { text: "Body conserves energy", correct: true }, { text: "Muscles grow larger", correct: false }] },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from first to last: What happens to your muscles when you stop training?", items: ["You stop training (no more stimulus)", "Body senses the muscles aren't being challenged anymore", "Muscle fibers begin to shrink (atrophy)", "Your strength gradually decreases", "Body conserves resources by only maintaining what it needs"], correctOrder: [0, 1, 2, 3, 4] },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Two weeks of inactivity can begin measurable muscle loss.", answer: true, explanation: "Studies show detectable muscle loss can begin within just two weeks of complete inactivity." },
                ]
            },
        ],
        'body-2': [
            {
                id: 'body-2-1', unitId: 'body-2', order: 1, title: "What Is 'The Core'?",
                content: {
                    intro: `Your "core" isn't just your abs. It's a cylinder of muscles wrapping around your entire midsection.\n\nFront: Rectus abdominis (the "six-pack") and transverse abdominis (deep stabilizer)\nSides: Internal and external obliques\nBack: Erector spinae and multifidus\nBottom: Pelvic floor\n\nThese muscles work together to stabilize your spine and transfer force. This is why exercises like crunches aren't enough—they only work the front, leaving the sides, back, and deep stabilizers weak.`,
                    keyPoint: "The core is a cylinder of muscles—front, sides, back, and bottom—that stabilizes your spine and transfers force.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Your 'core' refers only to your abdominal muscles.", answer: false, explanation: "The core includes muscles wrapping all around your midsection—abs, obliques, back muscles, and pelvic floor." },
                    { type: GAME_TYPES.TAP_ALL, question: "Which are core muscles?", options: [{ text: "Rectus abdominis", correct: true }, { text: "Obliques", correct: true }, { text: "Biceps", correct: false }, { text: "Erector spinae", correct: true }, { text: "Quadriceps", correct: false }] },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Front", right: "Rectus abdominis, transverse abdominis" },
                        { left: "Sides", right: "Internal and external obliques" },
                        { left: "Back", right: "Erector spinae, multifidus" },
                        { left: "Bottom", right: "Pelvic floor" },
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "The core is a _______ of muscles wrapping around your midsection.", options: ['cylinder', 'line', 'single', 'pair'], answer: 'cylinder' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone does 100 crunches daily but still has a weak core and back pain.", question: "What might explain this?", options: [
                        { text: "They need more crunches", correct: false },
                        { text: "Crunches only work one part of the core cylinder—they're neglecting sides, back, and deep stabilizers", correct: true },
                        { text: "Core strength doesn't affect back pain", correct: false },
                    ], explanation: "The core is a complete cylinder. Training only the front leaves the back and sides weak." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Arrange these core muscles from the FRONT of your body to the BACK:", items: ["Rectus abdominis — the 'six-pack' at the very front", "Transverse abdominis — deep stabilizer behind the six-pack", "Obliques — on the sides of your torso", "Erector spinae — along your spine at the back"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "The pelvic floor is part of your core.", answer: true, explanation: "The pelvic floor forms the bottom of the core cylinder and is essential for stability." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Core muscles work together to stabilize your _______ and transfer force.", options: ['spine', 'arms', 'head', 'feet'], answer: 'spine' },
                ]
            },
            {
                id: 'body-2-2', unitId: 'body-2', order: 2, title: "Core as Force Transfer",
                content: {
                    intro: `Your core's main job isn't creating movement—it's transferring force between your upper and lower body.\n\nWhen you throw a ball, force travels up from your legs, through your hips, your core stabilizes and transfers it, your upper body accelerates, and your arm releases. Push something heavy or even walk—the same pattern applies.\n\nA weak core means energy leaks out, like trying to shoot a cannon from a canoe. Every powerful movement depends on core stability.`,
                    keyPoint: "The core transfers force between upper and lower body. Weak core = energy leaks and reduced power.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "A weak core causes energy to _______ during powerful movements.", options: ['leak', 'increase', 'double', 'focus'], answer: 'leak' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Core strength only matters for ab exercises.", answer: false, explanation: "Core stability affects every movement that transfers force between upper and lower body—which is most movements." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "A person tries to push a heavy object but can't generate power even though their arms and legs are strong.", question: "What's the likely problem?", options: [
                        { text: "They need stronger arms", correct: false },
                        { text: "Their core is weak, so force leaks out instead of transferring", correct: true },
                        { text: "The object is too heavy for anyone", correct: false },
                    ], explanation: "Like shooting a cannon from a canoe—without a stable core, arm and leg strength can't transfer effectively." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Strong core", right: "Efficient force transfer" },
                        { left: "Weak core", right: "Energy leaks" },
                        { left: "Throwing a ball", right: "Force transfers through core" },
                        { left: "Cannon from canoe", right: "Analogy for weak core" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "Which movements require force transfer through the core?", options: [
                        { text: "Throwing", correct: true },
                        { text: "Pushing", correct: true },
                        { text: "Walking", correct: true },
                        { text: "Blinking", correct: false },
                        { text: "Lifting", correct: true },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from where force is GENERATED to where it's RELEASED: How does your body transfer force when throwing?", items: ["Legs push against the ground, generating the initial force", "Force travels upward through the hips", "Core stabilizes the torso and transfers force to the upper body", "Upper body accelerates as the force reaches it", "Arm releases the throw with all the accumulated power"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Your core's main job is creating movement.", answer: false, explanation: "The core's main job is transferring force and stabilizing—not creating movement itself." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Every powerful movement depends on core _______.", options: ['stability', 'flexibility', 'size', 'visibility'], answer: 'stability' },
                ]
            },
            {
                id: 'body-2-3', unitId: 'body-2', order: 3, title: "Bracing vs. Sucking In",
                content: {
                    intro: `Many people "engage their core" by sucking in their stomach. This is wrong.\n\nProper core engagement is bracing—take a breath into your belly, then create tension in all directions like you're about to be punched in the gut. This creates a stable cylinder.\n\nSucking in only engages superficial muscles and actually destabilizes your spine. Brace, don't suck.`,
                    keyPoint: "Proper core engagement means bracing (360-degree tension) not sucking in (which destabilizes).",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Sucking in your stomach is the correct way to engage your core.", answer: false, explanation: "Sucking in only engages superficial muscles. Proper engagement is bracing—creating tension in all directions." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Proper core engagement creates tension in _______ directions.", options: ['all', 'forward', 'one', 'upward'], answer: 'all' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone is about to lift something heavy. They suck in their stomach to 'engage their core.'", question: "What's wrong with this approach?", options: [
                        { text: "Nothing—sucking in is correct", correct: false },
                        { text: "Sucking in destabilizes the spine; they should brace with 360-degree tension instead", correct: true },
                        { text: "They should hold their breath instead", correct: false },
                    ], explanation: "Bracing creates a stable cylinder. Sucking in only engages superficial muscles and actually reduces stability." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Bracing", right: "360-degree tension" },
                        { left: "Sucking in", right: "Only superficial muscles" },
                        { left: "About to be punched", right: "How bracing feels" },
                        { left: "Stable cylinder", right: "Result of proper bracing" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "What describes proper core bracing?", options: [
                        { text: "Tension in all directions", correct: true },
                        { text: "Like preparing for a punch", correct: true },
                        { text: "Sucking stomach toward spine", correct: false },
                        { text: "Creating a stable cylinder", correct: true },
                        { text: "Only tightening the front", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order these core bracing steps from setup to execution:", items: ["Take a deep breath into your belly (not your chest)", "Create tension in all directions — front, sides, and back", "Imagine someone is about to poke you in the stomach", "Hold that stable 'cylinder' of tension throughout", "Now perform the movement while maintaining the brace"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Sucking in your stomach creates a stable cylinder.", answer: false, explanation: "Sucking in creates instability. Bracing with 360-degree tension creates the stable cylinder." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Brace, don't _______.", options: ['suck', 'push', 'pull', 'flex'], answer: 'suck' },
                ]
            },
            {
                id: 'body-2-4', unitId: 'body-2', order: 4, title: "The Deep Stabilizers",
                content: {
                    intro: `The most important core muscle is one you can't see: the transverse abdominis (TVA).\n\nThis deep muscle wraps around your midsection like a corset. When it contracts, it increases abdominal pressure and stabilizes your spine from the inside.\n\nThe TVA activates before any limb movement in healthy backs—your brain plans a movement, the TVA fires first to stabilize your spine, then the movement begins.`,
                    keyPoint: "The transverse abdominis (TVA) is a deep stabilizer that protects your spine. It should activate before any movement.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "The transverse abdominis wraps around you like a _______.", options: ['corset', 'belt', 'rope', 'blanket'], answer: 'corset' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "The most important core muscle is the visible 'six-pack.'", answer: false, explanation: "The transverse abdominis—a deep, invisible muscle—is more important for spinal stability." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Research shows that in people with healthy backs, a certain muscle activates before any arm or leg movement.", question: "Which muscle is this?", options: [
                        { text: "The rectus abdominis (six-pack)", correct: false },
                        { text: "The transverse abdominis (deep stabilizer)", correct: true },
                        { text: "The biceps", correct: false },
                    ], explanation: "The transverse abdominis activates anticipatorily to protect and stabilize the spine before movement." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Transverse abdominis", right: "Deep stabilizer, like a corset" },
                        { left: "Rectus abdominis", right: "Visible six-pack" },
                        { left: "Increased abdominal pressure", right: "How TVA stabilizes spine" },
                        { left: "Activates before movement", right: "Anticipatory stabilization" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "What's true about the transverse abdominis?", options: [
                        { text: "It's invisible from the outside", correct: true },
                        { text: "It wraps like a corset", correct: true },
                        { text: "It's the six-pack muscle", correct: false },
                        { text: "It activates before limb movement", correct: true },
                        { text: "It's only for looking good", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from first to last: How does your deep core (TVA) automatically protect your spine during movement?", items: ["Brain plans a movement (e.g., lifting something)", "TVA (deep core muscle) activates BEFORE anything else moves", "Abdominal pressure increases, creating a supportive 'belt'", "Spine is now stabilized and protected", "Only then does the actual limb movement begin"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "The transverse abdominis creates visible abs.", answer: false, explanation: "The TVA is deep and invisible. The rectus abdominis creates the visible six-pack." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "The TVA activates _______ any limb movement to protect the spine.", options: ['before', 'after', 'during', 'instead of'], answer: 'before' },
                ]
            },
            {
                id: 'body-2-5', unitId: 'body-2', order: 5, title: "Core in Daily Life",
                content: {
                    intro: `You don't need to do a single crunch to train your core—it's working all day.\n\nEvery time you stand, walk, or lift something, your core stabilizes your spine. Standing on one leg? Core. Carrying groceries on one side? Your core prevents rotation and keeps you upright. Even sitting upright uses core muscles to maintain posture.\n\nAwareness of core engagement during daily activities builds functional strength that transfers to everything.`,
                    keyPoint: "Your core works constantly in daily life. Building awareness of this engagement creates functional strength.",
                },
                games: [
                    { type: GAME_TYPES.TAP_ALL, question: "Which daily activities use your core?", options: [{ text: "Standing", correct: true }, { text: "Walking", correct: true }, { text: "Carrying groceries", correct: true }, { text: "Sitting upright", correct: true }, { text: "Lying flat on your back", correct: false }] },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "You need special exercises to train your core.", answer: false, explanation: "Your core works in daily activities. Awareness and proper engagement during daily movement builds functional core strength." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone wants to strengthen their core but hates doing crunches and planks.", question: "What should they know?", options: [
                        { text: "They must do crunches—there's no other way", correct: false },
                        { text: "Their core works during daily activities; awareness and proper engagement builds functional strength", correct: true },
                        { text: "Core strength isn't important anyway", correct: false },
                    ], explanation: "Standing, walking, carrying things—all of these engage your core. Building awareness creates real strength." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Standing", right: "Core stabilizes spine" },
                        { left: "Walking", right: "Core transfers force" },
                        { left: "Carrying groceries", right: "Core prevents rotation" },
                        { left: "Sitting upright", right: "Core maintains posture" },
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Awareness of core engagement builds _______ strength.", options: ['functional', 'visual', 'temporary', 'isolated'], answer: 'functional' },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order the progression from awareness to automatic core strength:", items: ["Start by noticing moments when your core should be engaged (lifting, bending)", "Practice proper bracing technique during those moments", "Gradually apply bracing to everyday movements (carrying groceries, standing up)", "Core strength builds automatically through consistent daily use", "That strength transfers to improve all your activities and exercises"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Standing on one leg requires core engagement.", answer: true, explanation: "Balancing on one leg requires significant core activation to stabilize the spine and pelvis." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "You don't need a single _______ to train your core.", options: ['crunch', 'muscle', 'bone', 'breath'], answer: 'crunch' },
                ]
            },
        ],
        'body-3': [
            {
                id: 'body-3-1', unitId: 'body-3', order: 1, title: "What Is the Kinetic Chain?",
                content: {
                    intro: `Your body doesn't move in isolated parts—it moves as a connected chain.\n\nThe kinetic chain describes how bones, joints, muscles, and nerves work together to produce movement. When you walk, your foot, ankle, knee, hip, spine, and even shoulders all coordinate in a chain of linked segments.\n\nStrength or weakness anywhere in the chain affects everywhere else.`,
                    keyPoint: "The kinetic chain is how body segments link together. Weakness anywhere creates compensation everywhere.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "The kinetic chain describes how body segments _______ together during movement.", options: ['link', 'separate', 'compete', 'isolate'], answer: 'link' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Your muscles work independently of each other during movement.", answer: false, explanation: "Muscles are linked in kinetic chains. They coordinate together, and weakness in one affects others." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "A person has knee pain, but their physical therapist examines their hips and ankles.", question: "Why look at other body parts?", options: [
                        { text: "The therapist doesn't know what they're doing", correct: false },
                        { text: "Weakness elsewhere in the kinetic chain often causes knee problems", correct: true },
                        { text: "Knee pain is always from the knee itself", correct: false },
                    ], explanation: "The kinetic chain means weakness in hips or ankles can cause knee problems." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Kinetic chain", right: "Linked body segments" },
                        { left: "Walking", right: "Foot, ankle, knee, hip coordinate" },
                        { left: "Weakness in one area", right: "Affects entire chain" },
                        { left: "Isolation thinking", right: "Misses the connections" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "What's part of the kinetic chain when walking?", options: [
                        { text: "Foot", correct: true },
                        { text: "Ankle", correct: true },
                        { text: "Knee", correct: true },
                        { text: "Hip", correct: true },
                        { text: "Only the legs", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Arrange the kinetic chain joints from the GROUND upward to the top of your body:", items: ["Foot (ground contact)", "Ankle", "Knee", "Hip", "Spine", "Shoulder (top of the chain)"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Problems in one part of the kinetic chain stay isolated there.", answer: false, explanation: "Weakness anywhere creates compensation everywhere else in the chain." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Strength or weakness anywhere affects _______ else.", options: ['everywhere', 'nowhere', 'only locally', 'randomly'], answer: 'everywhere' },
                ]
            },
            {
                id: 'body-3-2', unitId: 'body-3', order: 2, title: "The Posterior Chain",
                content: {
                    intro: `The posterior chain is the powerhouse running down your back: glutes (the powerhouse of the chain), hamstrings, and back muscles—from lower back to upper back.\n\nThese muscles are critical for standing, walking, running, jumping, and lifting. They're also commonly weak from too much sitting.\n\nA strong posterior chain protects your back, improves posture, and generates power for athletic movements.`,
                    keyPoint: "The posterior chain (back of body) generates power and protects your spine. Often weak from sitting.",
                },
                games: [
                    { type: GAME_TYPES.TAP_ALL, question: "Which muscles are part of the posterior chain?", options: [{ text: "Glutes", correct: true }, { text: "Hamstrings", correct: true }, { text: "Quadriceps", correct: false }, { text: "Back muscles", correct: true }, { text: "Chest", correct: false }] },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "The posterior chain often becomes weak from too much _______.", options: ['sitting', 'standing', 'walking', 'sleeping'], answer: 'sitting' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "An office worker who sits 8+ hours daily has weak glutes and frequent lower back pain.", question: "What's the connection?", options: [
                        { text: "Just bad luck", correct: false },
                        { text: "Sitting weakens the posterior chain, and weak glutes cause back compensation", correct: true },
                        { text: "Back pain is unrelated to sitting", correct: false },
                    ], explanation: "Prolonged sitting weakens glutes and hamstrings. The lower back then overworks to compensate." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Glutes", right: "Powerhouse of posterior chain" },
                        { left: "Hamstrings", right: "Back of thigh" },
                        { left: "Erector spinae", right: "Back muscles" },
                        { left: "Too much sitting", right: "Weakens posterior chain" },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Arrange the posterior chain (back-of-body muscles) from LOWEST on the body to HIGHEST:", items: ["Hamstrings (back of thighs)", "Glutes (buttocks)", "Lower back muscles (erector spinae)", "Upper back muscles (traps, rhomboids)"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "The posterior chain is only important for athletes.", answer: false, explanation: "Everyone uses their posterior chain for standing, walking, and basic daily movements." },
                    { type: GAME_TYPES.TAP_ALL, question: "What does a strong posterior chain help with?", options: [
                        { text: "Protecting your back", correct: true },
                        { text: "Improving posture", correct: true },
                        { text: "Generating power", correct: true },
                        { text: "Looking good from the front", correct: false },
                        { text: "Standing and walking", correct: true },
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "A strong posterior chain protects your _______ and improves posture.", options: ['back', 'knees', 'arms', 'neck'], answer: 'back' },
                ]
            },
            {
                id: 'body-3-3', unitId: 'body-3', order: 3, title: "Compensation Patterns",
                content: {
                    intro: `When one link in the chain is weak, other muscles compensate.\n\nWeak glutes? Your lower back takes over. Tight hip flexors? Your hamstrings work overtime. Injury history can create lasting compensations. A sedentary lifestyle weakens key muscles, forcing others to pick up the slack.\n\nThese compensations can work for a while, but eventually cause pain or injury. Many "mystery" pains come from compensation patterns far from where you feel the pain.`,
                    keyPoint: "Weakness creates compensation. The pain often shows up far from the actual problem.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "If your lower back hurts, the problem is always in your lower back.", answer: false, explanation: "Back pain often results from weakness elsewhere (like glutes) forcing the back to compensate." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Weak glutes often cause the _______ to compensate and overwork.", options: ['lower back', 'shoulders', 'arms', 'feet'], answer: 'lower back' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone has chronic shoulder pain. A movement assessment reveals weak core and poor hip mobility.", question: "How could hips affect shoulders?", options: [
                        { text: "They can't—shoulders and hips are unrelated", correct: false },
                        { text: "Poor hip mobility causes compensation up the chain that eventually affects shoulders", correct: true },
                        { text: "It's just coincidence", correct: false },
                    ], explanation: "The kinetic chain links everything. Hip problems can cause compensations that travel all the way up." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Weak glutes", right: "Lower back compensates" },
                        { left: "Tight hip flexors", right: "Hamstrings overwork" },
                        { left: "Mystery pain", right: "Often from distant compensation" },
                        { left: "Pain location", right: "Not always the problem source" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "What creates compensation patterns?", options: [
                        { text: "Weakness in one muscle", correct: true },
                        { text: "Tightness in one area", correct: true },
                        { text: "Perfect muscle balance", correct: false },
                        { text: "Injury history", correct: true },
                        { text: "Sedentary lifestyle", correct: true },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from the root cause to the injury: How does muscle compensation lead to pain?", items: ["One muscle or muscle group is weak or inactive", "Surrounding muscles compensate by doing extra work", "The compensation works well enough in the short term", "Over time, the compensating muscles become overworked and strained", "Pain or injury eventually develops in the overworked areas"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Compensations always cause immediate pain.", answer: false, explanation: "Compensations can work for months or years before finally causing pain." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Many 'mystery' pains come from compensation patterns _______ from where you feel pain.", options: ['far', 'close', 'directly', 'immediately'], answer: 'far' },
                ]
            },
            {
                id: 'body-3-4', unitId: 'body-3', order: 4, title: "Ground Up Force",
                content: {
                    intro: `Most powerful movements start from the ground.\n\nWhen you throw a punch, the force starts in your feet pushing into the ground, travels up through your legs, your hips rotate to add power, your core transfers the force, and your arm releases it. This is ground reaction force traveling up the kinetic chain.\n\nStrong legs, powerful hips, and a stable core multiply the power of your arms.`,
                    keyPoint: "Power travels from the ground up through the kinetic chain. Leg, hip, and core strength multiply arm power.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "A powerful throw starts from the _______, not the arm.", options: ['ground', 'shoulder', 'wrist', 'elbow'], answer: 'ground' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "To throw harder, focus only on arm strength.", answer: false, explanation: "Throwing power comes from ground-up force transfer. Legs and core often matter more than arms." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "A baseball pitcher wants to throw faster. The coach has them do leg and core exercises.", question: "Why focus on legs and core for throwing?", options: [
                        { text: "The coach is confused—throwing is about arms", correct: false },
                        { text: "Throwing power starts from the ground and transfers through legs and core", correct: true },
                        { text: "It's just for general fitness", correct: false },
                    ], explanation: "Power travels from ground up. Strong legs and core multiply the force delivered by the arm." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Ground reaction force", right: "Foundation of power" },
                        { left: "Legs", right: "Generate initial force" },
                        { left: "Core", right: "Transfers force" },
                        { left: "Arms", right: "Final release of power" },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from where power starts to where it ends: How does force travel through the body in a punch?", items: ["Feet push into the ground (force starts here)", "Legs drive the force upward", "Hips rotate to amplify the force", "Core transfers the force from lower body to upper body", "Arm extends and delivers all the accumulated power"]},
                    { type: GAME_TYPES.TAP_ALL, question: "What helps you throw/punch harder?", options: [
                        { text: "Strong legs", correct: true },
                        { text: "Powerful hips", correct: true },
                        { text: "Stable core", correct: true },
                        { text: "Only arm strength", correct: false },
                        { text: "Ground connection", correct: true },
                    ]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Professional boxers have weak legs because they only need arm power.", answer: false, explanation: "Boxing power comes from the ground up. Professional boxers have powerful legs and hips." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Strong legs and core _______ the power of your arms.", options: ['multiply', 'reduce', 'ignore', 'bypass'], answer: 'multiply' },
                ]
            },
            {
                id: 'body-3-5', unitId: 'body-3', order: 5, title: "Training the Chain",
                content: {
                    intro: `Isolation exercises have their place, but real function comes from training movements, not muscles.\n\nCompound exercises train entire kinetic chains working together: squats train legs, core, and back together; deadlifts train the full posterior chain; pushups train chest, shoulders, and core; lunges work multiple leg muscles. At the advanced end, Olympic lifts train the full body as one unit.\n\nYour brain doesn't think in muscles—it thinks in movements. Train movements for strength that transfers to real life.`,
                    keyPoint: "Train movements, not just muscles. Compound exercises build kinetic chains that transfer to real life.",
                },
                games: [
                    { type: GAME_TYPES.TAP_ALL, question: "Which exercises train kinetic chains (multiple muscles together)?", options: [{ text: "Squats", correct: true }, { text: "Bicep curls", correct: false }, { text: "Pushups", correct: true }, { text: "Deadlifts", correct: true }, { text: "Leg extensions", correct: false }] },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Your brain thinks in _______, not individual muscles.", options: ['movements', 'reps', 'sets', 'weights'], answer: 'movements' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone wants to get stronger for daily life activities like carrying groceries and climbing stairs.", question: "What training approach works best?", options: [
                        { text: "Isolation exercises targeting each muscle separately", correct: false },
                        { text: "Compound movements that train kinetic chains", correct: true },
                        { text: "Only cardio training", correct: false },
                    ], explanation: "Daily activities use integrated chains. Compound exercises build coordination that transfers to real life." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Squats", right: "Train legs, core, back together" },
                        { left: "Deadlifts", right: "Train posterior chain" },
                        { left: "Pushups", right: "Train chest, shoulders, core" },
                        { left: "Bicep curls", right: "Isolation exercise" },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Arrange these exercises from FEWEST muscles used (isolation) to MOST muscles used (compound):", items: ["Bicep curl — targets a single muscle", "Lunges — works several leg muscles", "Squats — engages legs + core together", "Deadlifts — activates the full posterior chain", "Olympic lifts — uses nearly every muscle in the body"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Isolation exercises are useless.", answer: false, explanation: "Isolation exercises have their place—for rehab, targeting weak links, or bodybuilding. But compound movements build function." },
                    { type: GAME_TYPES.TAP_ALL, question: "Why train movements instead of muscles?", options: [
                        { text: "It's how your body actually works", correct: true },
                        { text: "Builds coordination", correct: true },
                        { text: "Transfers to real life", correct: true },
                        { text: "Your brain thinks in movements", correct: true },
                        { text: "It's the only way to get strong", correct: false },
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Compound exercises build kinetic chains that _______ to real life.", options: ['transfer', 'block', 'prevent', 'isolate'], answer: 'transfer' },
                ]
            },
        ],
        'body-4': [
            {
                id: 'body-4-1', unitId: 'body-4', order: 1, title: "Posture Is Dynamic",
                content: {
                    intro: `There's no single "perfect posture" to hold forever. Posture is dynamic.\n\nThe best posture is your next posture. Human bodies are designed to move, not hold static positions. Problems arise not from any single position, but from being stuck in one position too long.\n\nVariety of positions matters more than finding the "right" one.`,
                    keyPoint: "The best posture is your next posture. Variety of positions beats searching for 'perfect' static posture.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "There is one perfect posture you should hold at all times.", answer: false, explanation: "Posture is dynamic. The best posture is your next posture—variety matters more than perfection." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Problems arise from being stuck in one position too _______.", options: ['long', 'short', 'often', 'rarely'], answer: 'long' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone obsesses over maintaining 'perfect' posture while sitting at their desk all day.", question: "What's the real problem?", options: [
                        { text: "They haven't found the right posture yet", correct: false },
                        { text: "Sitting all day is the problem—no single posture fixes prolonged static positioning", correct: true },
                        { text: "Their chair is wrong", correct: false },
                    ], explanation: "The best posture is your next posture. Variety and movement matter more than finding one 'perfect' position." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Best posture", right: "Your next posture" },
                        { left: "Human body design", right: "Made for movement" },
                        { left: "Holding one position", right: "Creates problems" },
                        { left: "Position variety", right: "Better than 'perfection'" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "What helps prevent posture-related problems?", options: [
                        { text: "Changing positions frequently", correct: true },
                        { text: "Moving throughout the day", correct: true },
                        { text: "Finding perfect posture and never moving", correct: false },
                        { text: "Taking movement breaks", correct: true },
                        { text: "Variety of positions", correct: true },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order this mindset shift about posture, from the first realization to the final approach:", items: ["Accept that no single posture is 'perfect' or 'correct'", "Shift your focus from one ideal position to variety and movement", "Make a habit of changing positions regularly throughout the day", "Take movement breaks to break up long periods in one position", "The goal: keep your body dynamic rather than static"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Standing all day is perfect because sitting is bad.", answer: false, explanation: "Standing all day has its own problems. The key is variety—not standing OR sitting, but movement between positions." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "The best posture is your _______ posture.", options: ['next', 'current', 'first', 'last'], answer: 'next' },
                ]
            },
            {
                id: 'body-4-2', unitId: 'body-4', order: 2, title: "Neutral Spine",
                content: {
                    intro: `Your spine has natural curves—don't try to flatten them.\n\nA "neutral spine" maintains these natural curves: lumbar lordosis (slight inward curve in lower back), thoracic kyphosis (slight outward curve in upper back), and cervical lordosis (slight inward curve in neck).\n\nNeutral spine distributes load safely. Flattening or exaggerating curves increases stress on discs and joints.`,
                    keyPoint: "Neutral spine preserves your back's natural curves. This distributes load safely across structures.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "A completely straight spine is the healthiest position.", answer: false, explanation: "Your spine has natural curves that distribute load. Trying to flatten them increases joint stress." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "A neutral spine maintains the back's natural _______.", options: ['curves', 'tension', 'flatness', 'rigidity'], answer: 'curves' },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Lordosis", right: "Inward curve (lower back)" },
                        { left: "Kyphosis", right: "Outward curve (upper back)" },
                        { left: "Neutral spine", right: "Natural curves preserved" },
                        { left: "Flat back", right: "Increased disc stress" },
                    ]},
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone tries to sit with a perfectly straight, flat back because they think curves are 'bad posture.'", question: "What's the problem?", options: [
                        { text: "Nothing—flat is correct", correct: false },
                        { text: "Flattening natural curves increases stress on discs and joints", correct: true },
                        { text: "They need a better chair", correct: false },
                    ], explanation: "Your spine's curves exist to distribute load. Fighting them increases stress." },
                    { type: GAME_TYPES.TAP_ALL, question: "What's true about neutral spine?", options: [
                        { text: "Maintains natural curves", correct: true },
                        { text: "Distributes load safely", correct: true },
                        { text: "Is completely flat", correct: false },
                        { text: "Has a slight lower back arch", correct: true },
                        { text: "Reduces disc stress", correct: true },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Arrange the three spinal curves from BOTTOM of the spine to TOP:", items: ["Lumbar lordosis — lower back curves inward", "Thoracic kyphosis — upper back curves outward", "Cervical lordosis — neck curves inward"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Exaggerating your spinal curves is just as bad as flattening them.", answer: true, explanation: "Both extremes increase joint stress. Neutral spine means natural, not exaggerated or flattened." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Neutral spine _______ load safely across spinal structures.", options: ['distributes', 'concentrates', 'ignores', 'blocks'], answer: 'distributes' },
                ]
            },
            {
                id: 'body-4-3', unitId: 'body-4', order: 3, title: "Hip Hinge Pattern",
                content: {
                    intro: `The hip hinge is the most important movement pattern you've probably never heard of.\n\nInstead of bending at the spine to reach down, you push your hips back while keeping your spine neutral. You should feel a stretch in your hamstrings. Then drive your hips forward to return. This loads your powerful hip muscles instead of stressing your lower back.\n\nDeadlifts, Romanian deadlifts, kettlebell swings, and picking things up safely all use the hip hinge.`,
                    keyPoint: "Hip hinge means bending at the hips, not the spine. This protects your back and uses powerful hip muscles.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "The hip hinge loads your _______ instead of stressing your lower back.", options: ['hip muscles', 'spine', 'knees', 'shoulders'], answer: 'hip muscles' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Bending over should come from rounding your lower back.", answer: false, explanation: "Bending should come from hinging at the hips while maintaining neutral spine. This protects your back." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone picks up a heavy box by bending their spine and keeping their legs straight.", question: "What's wrong with this technique?", options: [
                        { text: "Nothing—this is the natural way to bend", correct: false },
                        { text: "They should hip hinge: push hips back, keep spine neutral, use powerful hip muscles", correct: true },
                        { text: "They should use only their arms", correct: false },
                    ], explanation: "Hip hinge protects the back by using powerful hip muscles instead of stressing the spine." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Hip hinge", right: "Bend at hips, not spine" },
                        { left: "Spine rounding", right: "Stresses lower back" },
                        { left: "Push hips back", right: "Key to hip hinge" },
                        { left: "Deadlift", right: "Uses hip hinge pattern" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "Which movements use the hip hinge pattern?", options: [
                        { text: "Deadlifts", correct: true },
                        { text: "Kettlebell swings", correct: true },
                        { text: "Picking things up", correct: true },
                        { text: "Bicep curls", correct: false },
                        { text: "Romanian deadlifts", correct: true },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order these hip hinge steps from starting position to return:", items: ["Start standing tall with feet hip-width apart", "Push your hips straight BACK (not down like a squat)", "Keep your spine in a neutral position as you hinge", "You should feel a stretch in your hamstrings at the bottom", "Drive your hips forward to return to standing"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "The hip hinge uses your weak lower back muscles.", answer: false, explanation: "Hip hinge uses your powerful hip muscles—glutes and hamstrings—instead of stressing the lower back." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Push your hips _______ while keeping your spine neutral.", options: ['back', 'forward', 'up', 'down'], answer: 'back' },
                ]
            },
            {
                id: 'body-4-4', unitId: 'body-4', order: 4, title: "Stacking for Standing",
                content: {
                    intro: `Good standing posture is about stacking your body segments efficiently.\n\nEars over shoulders, shoulders over hips, hips over knees, knees over ankles. When segments stack, bones bear weight efficiently and muscles don't have to work as hard.\n\nMisaligned segments create muscle tension as your body fights to stay upright.`,
                    keyPoint: "Stack ears over shoulders over hips over knees over ankles. Alignment lets bones bear weight efficiently.",
                },
                games: [
                    { type: GAME_TYPES.TAP_ALL, question: "What should stack above your ankles in good standing posture?", options: [{ text: "Knees", correct: true }, { text: "Hips", correct: true }, { text: "Shoulders", correct: true }, { text: "Ears", correct: true }, { text: "Elbows", correct: false }] },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "When segments stack properly, _______ bear weight efficiently.", options: ['bones', 'muscles', 'tendons', 'nerves'], answer: 'bones' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone's head juts forward of their shoulders while standing. They complain of neck and upper back tension.", question: "What's causing the tension?", options: [
                        { text: "They need to stretch more", correct: false },
                        { text: "Misaligned segments force muscles to work harder to hold the head up", correct: true },
                        { text: "They're just tense by nature", correct: false },
                    ], explanation: "When segments don't stack, muscles must work overtime to fight gravity." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Segments stacked", right: "Bones bear weight efficiently" },
                        { left: "Segments misaligned", right: "Muscles work overtime" },
                        { left: "Head forward", right: "Neck muscles strain" },
                        { left: "Proper alignment", right: "Less muscle tension" },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "In ideal standing alignment, arrange these body landmarks from BOTTOM to TOP:", items: ["Ankles (base)", "Knees", "Hips", "Shoulders", "Ears (top)"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "If your posture looks good, your muscles must be strong.", answer: false, explanation: "Good posture means your bones, not muscles, are bearing the load. It's about efficient alignment, not muscle strength." },
                    { type: GAME_TYPES.TAP_ALL, question: "What happens when body segments are misaligned?", options: [
                        { text: "Muscles work harder", correct: true },
                        { text: "Tension develops", correct: true },
                        { text: "Bones bear weight efficiently", correct: false },
                        { text: "Body fights gravity", correct: true },
                        { text: "Less energy required", correct: false },
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Ears over shoulders over hips over knees over _______.", options: ['ankles', 'toes', 'heels', 'arches'], answer: 'ankles' },
                ]
            },
            {
                id: 'body-4-5', unitId: 'body-4', order: 5, title: "Movement Quality",
                content: {
                    intro: `How you move matters more than how much weight you move.\n\nQuality movement means controlling the motion through full range, maintaining good position, and not compensating with other body parts. If you start compensating, that's a sign to reduce intensity. This builds lasting strength and avoids injury.\n\nAlways earn the right to add difficulty by mastering the basic movement first—start with bodyweight, then add load gradually.`,
                    keyPoint: "Quality over quantity. Master movement patterns before adding weight or difficulty.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Adding weight is more important than perfecting form.", answer: false, explanation: "Form first, weight second. Poor form with heavy weight leads to injury and builds bad patterns." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "_______ the right to add difficulty by mastering the basic movement.", options: ['Earn', 'Demand', 'Skip', 'Ignore'], answer: 'Earn' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone can squat 200 lbs but their knees cave in and their back rounds at the bottom.", question: "What should they do?", options: [
                        { text: "Add more weight to get stronger", correct: false },
                        { text: "Reduce weight and fix the movement pattern first", correct: true },
                        { text: "Just keep going—it'll fix itself", correct: false },
                    ], explanation: "Quality first. Poor form with heavy weight builds bad patterns and leads to injury." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Movement quality", right: "More important than weight" },
                        { left: "Poor form + heavy weight", right: "Recipe for injury" },
                        { left: "Master basic pattern", right: "Then add difficulty" },
                        { left: "Compensation", right: "Sign to reduce intensity" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "What defines quality movement?", options: [
                        { text: "Full range of motion", correct: true },
                        { text: "Controlled motion", correct: true },
                        { text: "Maximum weight possible", correct: false },
                        { text: "Good position throughout", correct: true },
                        { text: "No compensation patterns", correct: true },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order the proper exercise progression from beginner to advanced:", items: ["Learn the correct movement pattern with no weight", "Master the pattern using just your bodyweight", "Add light weight while maintaining good form", "Gradually increase the load over time", "Always maintain movement quality even as weight goes up"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "If you can lift it, your form must be good enough.", answer: false, explanation: "You can lift heavy with terrible form—but you're building bad patterns and risking injury." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "How you move matters more than how much _______ you move.", options: ['weight', 'distance', 'quickly', 'slowly'], answer: 'weight' },
                ]
            },
        ],
        'body-5': [
            {
                id: 'body-5-1', unitId: 'body-5', order: 1, title: "Progressive Overload",
                content: {
                    intro: `Your body adapts to stress. To keep adapting, you must progressively increase the challenge.\n\nThis is progressive overload—the fundamental principle of training. It doesn't mean adding weight every session. Progress can be more reps, more sets, better form, longer time under tension, or less rest.\n\nSigns you need to increase overload: workouts feel too easy, you're no longer challenged, or results have plateaued. No overload = no adaptation.`,
                    keyPoint: "Progressive overload is essential: gradually increase challenge over time to keep adapting.",
                },
                games: [
                    { type: GAME_TYPES.TAP_ALL, question: "Which are ways to progressively overload?", options: [{ text: "More weight", correct: true }, { text: "More reps", correct: true }, { text: "Less rest time", correct: true }, { text: "Better form", correct: true }, { text: "Same workout forever", correct: false }] },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Without progressive _______, your body stops adapting.", options: ['overload', 'rest', 'nutrition', 'stretching'], answer: 'overload' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone does the exact same workout with the same weights for 6 months. They stopped seeing results after the first few weeks.", question: "What went wrong?", options: [
                        { text: "They're training too hard", correct: false },
                        { text: "No progressive overload—their body adapted and stopped improving", correct: true },
                        { text: "They need to eat less", correct: false },
                    ], explanation: "Your body adapts to stress. Without progressive overload, adaptation stops." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "More weight", right: "Type of progressive overload" },
                        { left: "More reps", right: "Type of progressive overload" },
                        { left: "Less rest", right: "Type of progressive overload" },
                        { left: "Same workout forever", right: "No adaptation" },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order the progressive overload cycle from first step to completing the loop:", items: ["Apply a training stress (e.g., lift a challenging weight)", "Body adapts to handle that specific stress", "The same stress becomes easier than before", "You increase the challenge (more weight, reps, or sets)", "A new round of adaptation occurs — and the cycle repeats"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Progressive overload means adding weight every single session.", answer: false, explanation: "Overload can be more reps, sets, better form, less rest, or more time under tension—not just weight." },
                    { type: GAME_TYPES.TAP_ALL, question: "Signs you need to increase overload:", options: [
                        { text: "Workout feels too easy", correct: true },
                        { text: "No longer getting sore or challenged", correct: true },
                        { text: "You're exhausted after every session", correct: false },
                        { text: "Results have plateaued", correct: true },
                        { text: "You're getting injured often", correct: false },
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "No overload = no _______.", options: ['adaptation', 'rest', 'food', 'water'], answer: 'adaptation' },
                ]
            },
            {
                id: 'body-5-2', unitId: 'body-5', order: 2, title: "Recovery Is Training",
                content: {
                    intro: `Training creates the stimulus. Recovery creates the adaptation.\n\nMuscle doesn't grow during workouts—it grows during recovery. Sleep, nutrition, rest days, and stress management aren't "not training"—they're when training actually works.\n\nMore is not always better. Hard training with poor recovery equals spinning your wheels.`,
                    keyPoint: "Adaptation happens during recovery, not training. Recovery isn't optional—it's where gains are made.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Training more always leads to better results.", answer: false, explanation: "More training without adequate recovery can prevent adaptation. Recovery is when gains are made." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Muscles grow during _______, not during workouts.", options: ['recovery', 'training', 'stretching', 'cardio'], answer: 'recovery' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone trains intensely 7 days a week, sleeps 5 hours a night, and wonders why they're not gaining muscle.", question: "What's the problem?", options: [
                        { text: "They need to train harder", correct: false },
                        { text: "Insufficient recovery—adaptation happens during rest, not training", correct: true },
                        { text: "They need more protein", correct: false },
                    ], explanation: "Training creates the stimulus; recovery creates the adaptation. No recovery = no gains." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Training", right: "Creates the stimulus" },
                        { left: "Recovery", right: "Creates the adaptation" },
                        { left: "Sleep", right: "Critical for muscle growth" },
                        { left: "Rest days", right: "When training actually works" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "What counts as recovery?", options: [
                        { text: "Sleep", correct: true },
                        { text: "Proper nutrition", correct: true },
                        { text: "More training", correct: false },
                        { text: "Rest days", correct: true },
                        { text: "Stress management", correct: true },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from the workout to the result: How does your body actually get stronger?", items: ["Training creates microscopic damage in muscle fibers", "The recovery period begins after you stop training", "Body repairs the damaged fibers and reinforces them", "Adaptation occurs — the muscle rebuilds slightly stronger", "You're now capable of handling more than before"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Elite athletes take rest days because they're lazy.", answer: false, explanation: "Elite athletes understand recovery is where adaptation happens. Rest is part of training." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Hard training with poor recovery equals spinning your _______.", options: ['wheels', 'bike', 'arms', 'head'], answer: 'wheels' },
                ]
            },
            {
                id: 'body-5-3', unitId: 'body-5', order: 3, title: "Specificity Principle",
                content: {
                    intro: `Your body adapts specifically to the demands you place on it.\n\nWant to get better at running? Run. Want stronger legs? Train legs. Want to do 50 pushups? Practice pushups.\n\nThis is the specificity principle. General fitness helps, but specific goals require specific training. Train for what you want to achieve.`,
                    keyPoint: "Your body adapts specifically to what you train. Specific goals require specific training.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "The _______ principle says your body adapts specifically to demands placed on it.", options: ['specificity', 'overload', 'recovery', 'variety'], answer: 'specificity' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "General strength training automatically makes you good at any physical task.", answer: false, explanation: "Adaptation is specific. General fitness helps, but specific skills require specific practice." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone wants to run a marathon but only does weightlifting and cycling.", question: "What's wrong with this approach?", options: [
                        { text: "Nothing—all exercise is the same", correct: false },
                        { text: "To run well, you need to run—specificity principle", correct: true },
                        { text: "Weightlifting is better than running", correct: false },
                    ], explanation: "Your body adapts specifically to what you train. Want to run better? Run." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Want to run better", right: "Practice running" },
                        { left: "Want stronger legs", right: "Train legs" },
                        { left: "Want more pushups", right: "Practice pushups" },
                        { left: "Specificity principle", right: "Train what you want to improve" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "What does specificity mean for training?", options: [
                        { text: "Train for your specific goal", correct: true },
                        { text: "Practice the movement you want to improve", correct: true },
                        { text: "Any exercise works for any goal", correct: false },
                        { text: "General fitness helps but specific training matters most", correct: true },
                        { text: "Cross-training replaces specific practice", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order these steps for applying the specificity principle to your training:", items: ["Define your specific goal (e.g., stronger squat, faster 5K)", "Identify the key movements and energy demands of that goal", "Make those specific demands the focus of your training", "Use general fitness work as support — but don't let it replace the specific work", "Track and measure progress toward your specific goal"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "A great swimmer is automatically a great runner.", answer: false, explanation: "Specificity means fitness in one activity doesn't fully transfer to another. Each requires specific training." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Specific goals require _______ training.", options: ['specific', 'general', 'random', 'easy'], answer: 'specific' },
                ]
            },
            {
                id: 'body-5-4', unitId: 'body-5', order: 4, title: "Minimum Effective Dose",
                content: {
                    intro: `More isn't always better. There's a minimum effective dose—the least amount of training that produces results.\n\nGoing far beyond this doesn't speed progress; it just increases recovery needs and injury risk. The goal is consistent minimum doses over time, not occasional maximum efforts.\n\nSustainable training beats optimal training you can't maintain.`,
                    keyPoint: "Find the minimum effective dose. Sustainable consistency beats unsustainable intensity.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Doing twice as much training produces twice the results.", answer: false, explanation: "There's a minimum effective dose. Beyond it, you mainly increase recovery needs and injury risk." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Sustainable training beats _______ training you can't maintain.", options: ['optimal', 'easy', 'slow', 'simple'], answer: 'optimal' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Two people start training. Person A does 2-hour workouts 6 days a week. Person B does 30-minute workouts 3 days a week. After a year, Person B has better results.", question: "How is this possible?", options: [
                        { text: "Person A had bad genetics", correct: false },
                        { text: "Person B found the minimum effective dose and could sustain it; Person A burned out", correct: true },
                        { text: "Longer workouts don't work", correct: false },
                    ], explanation: "Sustainable training beats unsustainable intensity. Person A likely burned out or got injured." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Minimum effective dose", right: "Least training that produces results" },
                        { left: "Beyond MED", right: "More recovery needs, injury risk" },
                        { left: "Sustainable training", right: "Can maintain long-term" },
                        { left: "Maximum efforts occasionally", right: "Often leads to burnout" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "What happens when you go way beyond minimum effective dose?", options: [
                        { text: "Faster results", correct: false },
                        { text: "Increased injury risk", correct: true },
                        { text: "More recovery needed", correct: true },
                        { text: "Potential burnout", correct: true },
                        { text: "Guaranteed better fitness", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order these steps for finding the minimum effective dose of training:", items: ["Start with the minimum amount of training that might work", "Track whether you're making progress with that amount", "Add more volume or intensity ONLY if progress stalls", "Prioritize a level that's sustainable for the long term", "Remember: consistent effort over time beats short bursts of maximum effort"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "The goal is to train as much as possible.", answer: false, explanation: "The goal is to train the minimum that produces results and is sustainable long-term." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "The goal is consistent minimum doses over time, not occasional _______ efforts.", options: ['maximum', 'minimum', 'moderate', 'easy'], answer: 'maximum' },
                ]
            },
            {
                id: 'body-5-5', unitId: 'body-5', order: 5, title: "Patience and Consistency",
                content: {
                    intro: `Fitness transformation is measured in months and years, not days and weeks.\n\nConsistency over time beats intensity in the moment. Showing up at 70% effort for years beats showing up at 100% for weeks then burning out.\n\nThe people who get results aren't special—they just kept going long enough for adaptations to accumulate.`,
                    keyPoint: "Fitness is a long game. Consistent moderate effort over years beats intense effort that burns out.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Fitness transformation is measured in months and _______, not days.", options: ['years', 'weeks', 'hours', 'reps'], answer: 'years' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "People who achieve great fitness results have special genetics or willpower.", answer: false, explanation: "They kept going consistently long enough for adaptations to accumulate. Consistency is the 'secret.'" },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Two people start the same program. One goes all-out for 3 months then quits. The other shows up at 70% effort for 3 years.", question: "Who gets better results?", options: [
                        { text: "The intense 3-month person", correct: false },
                        { text: "The consistent 3-year person", correct: true },
                        { text: "They'll be about equal", correct: false },
                    ], explanation: "Adaptations accumulate over time. Three years of consistent effort beats three months of intensity." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Fitness transformation", right: "Measured in months and years" },
                        { left: "70% effort for years", right: "Beats 100% for weeks" },
                        { left: "The 'secret'", right: "Consistency over time" },
                        { left: "Results", right: "Adaptations accumulating" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "What makes people successful at fitness long-term?", options: [
                        { text: "Consistency over time", correct: true },
                        { text: "Showing up even at 70%", correct: true },
                        { text: "Special genetics", correct: false },
                        { text: "Patience with the process", correct: true },
                        { text: "Going 100% all the time", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order the realistic path to fitness results from the start of the journey to the payoff:", items: ["Show up consistently — even on days you don't feel like it", "Don't require every session to be perfect", "Allow small adaptations to accumulate week after week", "Be patient — real change takes longer than you expect", "Results emerge gradually as all that consistency compounds"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "If you don't see results in 2 weeks, the program isn't working.", answer: false, explanation: "Real transformation takes months and years. Two weeks isn't enough time for significant adaptation." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Showing up at 70% effort for years beats showing up at 100% for weeks then burning _______.", options: ['out', 'up', 'in', 'bright'], answer: 'out' },
                ]
            },
        ],
        'fuel-1': [
            {
                id: 'fuel-1-1', unitId: 'fuel-1', order: 1, title: "Calories Are Energy",
                content: {
                    intro: `A calorie is simply a unit of energy—specifically, the energy needed to raise 1 gram of water by 1°C.\n\nYour body extracts this energy from food through digestion. Everything you do—breathing, thinking, moving—requires energy. Calories in food are potential energy; your body converts them to usable energy.\n\nCalories aren't bad. They're necessary for life.`,
                    keyPoint: "Calories are units of energy your body extracts from food to power everything you do.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Calories are inherently bad for you.", answer: false, explanation: "Calories are just energy units. Your body needs them to function. It's about the right amount, not zero." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "A calorie is a unit of _______.", options: ['energy', 'weight', 'fat', 'protein'], answer: 'energy' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone says they're 'avoiding calories' to be healthy.", question: "What's wrong with this thinking?", options: [
                        { text: "Nothing—fewer calories is always better", correct: false },
                        { text: "Calories are necessary for life; it's about the right amount, not zero", correct: true },
                        { text: "They should avoid only fat calories", correct: false },
                    ], explanation: "Calories are just energy. Your body needs energy to function. Zero calories = death." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Calorie", right: "Unit of energy" },
                        { left: "Everything you do", right: "Requires energy" },
                        { left: "Food calories", right: "Potential energy" },
                        { left: "Your body", right: "Converts food to usable energy" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "Which activities require calories (energy)?", options: [
                        { text: "Breathing", correct: true },
                        { text: "Thinking", correct: true },
                        { text: "Moving", correct: true },
                        { text: "Sleeping", correct: true },
                        { text: "Being dead", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from eating to needing food again: How does your body use food for energy?", items: ["You eat food containing calories (energy)", "Digestion breaks down the food and extracts usable energy", "That energy is either used immediately or stored for later", "Body uses the energy to perform all its functions", "Energy runs low and you need to eat again"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Only exercise uses calories.", answer: false, explanation: "Everything uses calories—breathing, thinking, digesting, existing. Exercise is only a small portion." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Calories aren't bad—they're _______ for life.", options: ['necessary', 'optional', 'harmful', 'confusing'], answer: 'necessary' },
                ]
            },
            {
                id: 'fuel-1-2', unitId: 'fuel-1', order: 2, title: "Energy Balance",
                content: {
                    intro: `Weight change comes down to energy balance: calories in vs. calories out.\n\nCalories In > Calories Out = Weight gain\nCalories In < Calories Out = Weight loss\nCalories In = Calories Out = Weight maintenance\n\nThis is physics, and it always holds true. But "calories out" is more complex than just exercise—it includes resting metabolism, daily movement, digesting food, and exercise.`,
                    keyPoint: "Weight changes based on energy balance. Eat more than you burn = gain. Burn more than you eat = lose.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Weight loss occurs when calories in is _______ than calories out.", options: ['less', 'more', 'equal', 'double'], answer: 'less' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "You can gain weight eating only healthy foods.", answer: true, explanation: "Energy balance determines weight. Even healthy foods add calories. Too much of anything causes gain." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone eats nothing but chicken breast, vegetables, and brown rice but is gaining weight.", question: "How is this possible?", options: [
                        { text: "Healthy foods can't cause weight gain", correct: false },
                        { text: "They're eating more calories than they burn—even healthy foods count", correct: true },
                        { text: "Their metabolism is broken", correct: false },
                    ], explanation: "Energy balance always applies. Healthy foods still have calories. Too much = weight gain." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Calories in > calories out", right: "Weight gain" },
                        { left: "Calories in < calories out", right: "Weight loss" },
                        { left: "Calories in = calories out", right: "Weight maintenance" },
                        { left: "Energy balance", right: "Always determines weight" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "What contributes to 'calories out'?", options: [
                        { text: "Resting metabolism", correct: true },
                        { text: "Exercise", correct: true },
                        { text: "Daily movement", correct: true },
                        { text: "Digesting food", correct: true },
                        { text: "The food type you eat", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order the steps of managing energy balance from first to last:", items: ["Estimate your calories IN (everything you eat and drink)", "Estimate your calories OUT (metabolism + activity + digestion)", "Compare the two numbers", "If calories in > out = weight gain; if calories in < out = weight loss", "Adjust your intake or activity as needed based on your goal"], acceptableOrders: [[0,1,2,3,4],[1,0,2,3,4]]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Certain foods don't count toward energy balance.", answer: false, explanation: "All food contributes calories. There are no 'free' foods that don't affect energy balance." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Eat more than you burn = _______.", options: ['gain', 'loss', 'maintenance', 'health'], answer: 'gain' },
                ]
            },
            {
                id: 'fuel-1-3', unitId: 'fuel-1', order: 3, title: "Where Calories Out Go",
                content: {
                    intro: `"Calories out" isn't just exercise. It's actually four things:\n\n1. BMR (60-75%): Basal metabolic rate—energy to keep you alive at rest\n2. NEAT (15-30%): Non-exercise activity—fidgeting, walking, daily movement. Increase it by taking stairs, walking during phone calls, parking farther away, standing more.\n3. TEF (10%): Thermic effect of food—energy to digest food\n4. EAT (5-15%): Exercise activity—intentional workouts\n\nExercise is the smallest component!`,
                    keyPoint: "Exercise is only 5-15% of calories burned. Daily movement (NEAT) and resting metabolism (BMR) matter more.",
                },
                games: [
                    { type: GAME_TYPES.TAP_ALL, question: "Which contribute to 'calories out'?", options: [{ text: "Resting metabolism (BMR)", correct: true }, { text: "Daily movement (NEAT)", correct: true }, { text: "Digesting food (TEF)", correct: true }, { text: "Exercise (EAT)", correct: true }, { text: "Sleeping thoughts", correct: false }] },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Exercise is the biggest component of calories burned.", answer: false, explanation: "BMR (resting metabolism) accounts for 60-75%. Exercise is typically only 5-15%." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "BMR (60-75%)", right: "Resting metabolism" },
                        { left: "NEAT (15-30%)", right: "Daily non-exercise movement" },
                        { left: "TEF (10%)", right: "Digesting food" },
                        { left: "EAT (5-15%)", right: "Intentional exercise" },
                    ]},
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone exercises for 1 hour daily but is sedentary the rest of the time. They wonder why they're not losing weight.", question: "What might help more?", options: [
                        { text: "Exercise harder", correct: false },
                        { text: "Increase daily movement (NEAT)—it accounts for more calories than exercise", correct: true },
                        { text: "Skip meals", correct: false },
                    ], explanation: "NEAT (15-30%) often exceeds exercise (5-15%). More daily movement can be more impactful." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Rank these components of calorie expenditure from LARGEST share to SMALLEST:", items: ["BMR (Resting metabolism) — 60-75% of total calories burned", "NEAT (Daily movement like walking, fidgeting) — 15-30%", "TEF (Energy used to digest food) — about 10%", "EAT (Actual exercise sessions) — only 5-15%"]},
                    { type: GAME_TYPES.TAP_ALL, question: "Ways to increase NEAT (non-exercise activity):", options: [
                        { text: "Take the stairs", correct: true },
                        { text: "Walk while on phone calls", correct: true },
                        { text: "Park farther away", correct: true },
                        { text: "Only do gym workouts", correct: false },
                        { text: "Stand more often", correct: true },
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Exercise is the _______ component of calories burned.", options: ['smallest', 'largest', 'only', 'most important'], answer: 'smallest' },
                ]
            },
            {
                id: 'fuel-1-4', unitId: 'fuel-1', order: 4, title: "Metabolic Adaptation",
                content: {
                    intro: `Your metabolism isn't fixed—it adapts to energy intake.\n\nWhen you eat less, your body gradually decreases energy expenditure to conserve resources. Hormones change to conserve energy, and NEAT (daily movement) decreases automatically—you fidget less, move less without realizing it. When you eat more, expenditure increases somewhat.\n\nThis is why extreme diets often fail long-term: the body adapts, making the deficit harder to maintain.`,
                    keyPoint: "Your metabolism adapts to intake. Severe restriction causes your body to burn less, making further loss harder.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "When you eat less, your body _______ energy expenditure over time.", options: ['decreases', 'increases', 'doubles', 'ignores'], answer: 'decreases' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Eating very little forever is an effective long-term weight loss strategy.", answer: false, explanation: "Metabolic adaptation means your body burns less when you eat very little, making the approach unsustainable." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone goes on a very low-calorie diet. They lose weight initially but then stop losing even though they're still eating very little.", question: "What's happening?", options: [
                        { text: "They're secretly eating more", correct: false },
                        { text: "Metabolic adaptation—their body reduced calorie burning to match the low intake", correct: true },
                        { text: "Weight loss is impossible for them", correct: false },
                    ], explanation: "The body adapts to severe restriction by lowering metabolism, making further loss harder." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Eat much less", right: "Body burns less over time" },
                        { left: "Eat more", right: "Body burns somewhat more" },
                        { left: "Metabolic adaptation", right: "Body adjusting to intake" },
                        { left: "Extreme diets", right: "Often fail due to adaptation" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "What happens during severe calorie restriction?", options: [
                        { text: "Body decreases energy expenditure", correct: true },
                        { text: "Hormones change to conserve energy", correct: true },
                        { text: "NEAT decreases automatically", correct: true },
                        { text: "Metabolism stays exactly the same", correct: false },
                        { text: "Body burns more to compensate", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order the crash diet cycle from the hopeful start to the inevitable crash:", items: ["You start with severe calorie restriction", "Initial weight loss occurs (mostly water and muscle)", "Body adapts by slowing metabolism and burning fewer calories", "Weight loss stalls despite continued restriction", "The restriction becomes unsustainable and you give up"]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "This is why extreme diets often fail long-term: the body _______.", options: ['adapts', 'grows', 'ignores', 'burns more'], answer: 'adapts' },
                ]
            },
            {
                id: 'fuel-1-5', unitId: 'fuel-1', order: 5, title: "Energy for Performance",
                content: {
                    intro: `Your energy intake affects more than weight—it affects everything.\n\nToo few calories: poor recovery, low energy, bad mood, weak workouts, hormone disruption\nRight amount: stable energy, good recovery, consistent progress\nToo many: potential fat gain (though some excess is needed to build muscle)\n\nFood is fuel for performance, not just a weight management number.`,
                    keyPoint: "Calories affect energy, mood, recovery, and hormones—not just weight. Fuel for performance, not just numbers.",
                },
                games: [
                    { type: GAME_TYPES.TAP_ALL, question: "What can be affected by eating too few calories?", options: [{ text: "Energy levels", correct: true }, { text: "Workout quality", correct: true }, { text: "Mood", correct: true }, { text: "Recovery", correct: true }, { text: "Hair color", correct: false }] },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Food is _______ for performance, not just a weight number.", options: ['fuel', 'punishment', 'optional', 'entertainment'], answer: 'fuel' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "An athlete is irritable, constantly tired, and their workouts are getting weaker despite training hard.", question: "What might be the issue?", options: [
                        { text: "They need to train harder", correct: false },
                        { text: "They may be eating too few calories for their activity level", correct: true },
                        { text: "They should skip rest days", correct: false },
                    ], explanation: "Underfueling affects energy, mood, recovery, and performance—not just weight." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Too few calories", right: "Low energy, poor recovery, bad mood" },
                        { left: "Right amount", right: "Stable energy, good progress" },
                        { left: "Too many calories", right: "Potential fat gain" },
                        { left: "Food", right: "Fuel for performance" },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order these warning signs of under-eating from the EARLIEST clues to the LATEST consequences:", items: ["Constant fatigue and low energy (first sign)", "Irritable mood and difficulty concentrating", "Workouts start feeling much harder than they should", "Poor recovery — soreness lasts longer, sleep suffers", "Progress stalls completely despite consistent effort"], acceptableOrders: [[0,1,2,3,4],[0,2,1,3,4]]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Calories only affect your weight.", answer: false, explanation: "Calories affect energy, mood, recovery, hormones, and performance—far more than just weight." },
                    { type: GAME_TYPES.TAP_ALL, question: "What does adequate fuel provide?", options: [
                        { text: "Stable energy", correct: true },
                        { text: "Good recovery", correct: true },
                        { text: "Better workouts", correct: true },
                        { text: "Guaranteed weight loss", correct: false },
                        { text: "Consistent progress", correct: true },
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Calories affect energy, mood, recovery, and _______—not just weight.", options: ['hormones', 'height', 'hair', 'bones'], answer: 'hormones' },
                ]
            },
        ],
        'fuel-2': [
            {
                id: 'fuel-2-1', unitId: 'fuel-2', order: 1, title: "The Three Macros",
                content: {
                    intro: `All calories come from three macronutrients:\n\nProtein: 4 calories per gram — builds and repairs tissue\nCarbohydrates: 4 calories per gram — primary energy source\nFat: 9 calories per gram — energy storage, hormones, absorption\n\n(Alcohol has 7 cal/g but isn't a macronutrient—it has no nutritional benefit.)\n\nEach macro serves different functions. You need all three.`,
                    keyPoint: "Protein and carbs have 4 cal/g; fat has 9 cal/g. Each macronutrient serves essential, different functions.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Fat contains _______ calories per gram.", options: ['9', '4', '7', '12'], answer: '9' },
                    { type: GAME_TYPES.TAP_ALL, question: "Which are macronutrients?", options: [{ text: "Protein", correct: true }, { text: "Carbohydrates", correct: true }, { text: "Fat", correct: true }, { text: "Vitamins", correct: false }, { text: "Minerals", correct: false }] },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Protein", right: "4 cal/g - builds tissue" },
                        { left: "Carbohydrates", right: "4 cal/g - primary energy" },
                        { left: "Fat", right: "9 cal/g - hormones, storage" },
                        { left: "Alcohol", right: "7 cal/g - no nutritional benefit" },
                    ]},
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone wants to cut calories and decides to eliminate all dietary fat.", question: "What's wrong with this approach?", options: [
                        { text: "Nothing—fat has the most calories so cutting it makes sense", correct: false },
                        { text: "Fat is essential for hormones, vitamin absorption, and cell function", correct: true },
                        { text: "Fat doesn't have calories", correct: false },
                    ], explanation: "You need all three macros. Fat is essential for many body functions." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Arrange these from FEWEST calories per gram to MOST calories per gram:", items: ["Protein — 4 calories per gram", "Carbohydrates — 4 calories per gram (tied with protein)", "Alcohol — 7 calories per gram (not technically a macro)", "Fat — 9 calories per gram (the most calorie-dense)"], acceptableOrders: [[0,1,2,3],[1,0,2,3]]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "You can be healthy while completely eliminating one macronutrient.", answer: false, explanation: "Each macro serves essential functions. You need all three for optimal health." },
                    { type: GAME_TYPES.TAP_ALL, question: "What do the three macronutrients provide?", options: [
                        { text: "Energy (calories)", correct: true },
                        { text: "Different bodily functions", correct: true },
                        { text: "Building blocks for tissue", correct: true },
                        { text: "All your vitamin needs", correct: false },
                        { text: "Hormone production", correct: true },
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Each macro serves different functions. You need all _______.", options: ['three', 'two', 'one', 'four'], answer: 'three' },
                ]
            },
            {
                id: 'fuel-2-2', unitId: 'fuel-2', order: 2, title: "Protein Essentials",
                content: {
                    intro: `Protein builds and repairs every tissue in your body—muscles, organs, skin, hair, enzymes, hormones.\n\nProtein is made of amino acids. Nine are "essential"—your body can't make them, so you must eat them.\n\nFor active people, aim for 0.7-1g per pound of body weight. Protein also keeps you fuller longer than other macros.`,
                    keyPoint: "Protein builds and repairs tissue. Active people need 0.7-1g per pound of bodyweight daily.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Active people should aim for 0.7-1g of protein per _______ of bodyweight.", options: ['pound', 'kilogram', 'calorie', 'meal'], answer: 'pound' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Your body can produce all the amino acids it needs.", answer: false, explanation: "Nine amino acids are 'essential'—your body cannot make them, so you must get them from food." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone wants to build muscle but only eats 50g of protein per day while weighing 180 lbs.", question: "What's the issue?", options: [
                        { text: "They're eating too much protein", correct: false },
                        { text: "They need 126-180g protein daily for optimal muscle building", correct: true },
                        { text: "Protein doesn't matter for muscle", correct: false },
                    ], explanation: "At 180 lbs, they need 126-180g protein (0.7-1g/lb) for optimal muscle building." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Protein", right: "Builds and repairs tissue" },
                        { left: "Essential amino acids", right: "Must come from food" },
                        { left: "0.7-1g per pound", right: "Target for active people" },
                        { left: "Satiety", right: "Protein keeps you fuller" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "What does protein do in your body?", options: [
                        { text: "Builds muscle", correct: true },
                        { text: "Repairs tissue", correct: true },
                        { text: "Creates enzymes and hormones", correct: true },
                        { text: "Primary energy source", correct: false },
                        { text: "Helps with satiety", correct: true },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from workout to growth: Why is protein essential for fitness results?", items: ["You exercise, creating microscopic muscle damage", "Protein from your diet provides amino acids (building blocks)", "Body uses those amino acids to repair and rebuild the damaged tissue", "The repaired muscle comes back slightly stronger", "This process repeats with each workout — compounding over time"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Protein only matters if you're a bodybuilder.", answer: false, explanation: "Everyone needs protein for tissue repair, enzymes, and hormones—not just bodybuilders." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Protein keeps you _______ longer than other macros.", options: ['fuller', 'hungrier', 'weaker', 'tired'], answer: 'fuller' },
                ]
            },
            {
                id: 'fuel-2-3', unitId: 'fuel-2', order: 3, title: "Carbohydrates: Not the Enemy",
                content: {
                    intro: `Carbs are your body's preferred energy source—especially for high-intensity activity.\n\nYour brain runs almost entirely on glucose from carbs. Your muscles store carbs as glycogen for quick energy.\n\nCarbs aren't "bad." Processed, low-fiber carbs that spike blood sugar can be problematic. Whole food carbs with fiber are excellent fuel.`,
                    keyPoint: "Carbs fuel high-intensity activity and your brain. Choose whole food sources with fiber over processed ones.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "All carbohydrates are bad for you.", answer: false, explanation: "Carbs are your body's preferred fuel. Whole food carbs with fiber are healthy. It's processed carbs that can be problematic." },
                    { type: GAME_TYPES.TAP_ALL, question: "Which are good carbohydrate sources?", options: [{ text: "Oats", correct: true }, { text: "Sweet potatoes", correct: true }, { text: "Fruit", correct: true }, { text: "Soda", correct: false }, { text: "Candy", correct: false }] },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone eliminates all carbs to 'be healthy' and wonders why they feel foggy, tired, and their workouts suffer.", question: "What's happening?", options: [
                        { text: "They're detoxing—it'll pass", correct: false },
                        { text: "Their brain and muscles need carbs for optimal function", correct: true },
                        { text: "They should eliminate more foods", correct: false },
                    ], explanation: "Your brain runs on glucose. Muscles need glycogen. Carbs aren't the enemy—choose whole food sources." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Whole food carbs", right: "Excellent fuel with fiber" },
                        { left: "Processed carbs", right: "Can spike blood sugar" },
                        { left: "Brain fuel", right: "Glucose from carbs" },
                        { left: "Muscle glycogen", right: "Stored carbs for energy" },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from plate to performance: How do carbohydrates fuel your workouts?", items: ["You eat carbohydrate-rich foods", "Body converts and stores them as glycogen in your muscles", "You start exercising", "Muscles tap into glycogen for quick, powerful energy", "Your workout performance is fueled by that stored energy"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Your brain can function well without any carbohydrates.", answer: false, explanation: "Your brain runs almost entirely on glucose. While it can adapt to some ketone use, carbs are its preferred fuel." },
                    { type: GAME_TYPES.TAP_ALL, question: "Why are whole food carbs better than processed carbs?", options: [
                        { text: "They contain fiber", correct: true },
                        { text: "They digest more slowly", correct: true },
                        { text: "Steadier blood sugar", correct: true },
                        { text: "They have zero calories", correct: false },
                        { text: "They provide micronutrients", correct: true },
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Carbs are your body's _______ energy source.", options: ['preferred', 'worst', 'only', 'optional'], answer: 'preferred' },
                ]
            },
            {
                id: 'fuel-2-4', unitId: 'fuel-2', order: 4, title: "Fats: Essential, Not Extra",
                content: {
                    intro: `Fat isn't just stored energy—it's essential for life.\n\nFat produces hormones (including testosterone and estrogen), absorbs vitamins (A, D, E, K), protects organs, and maintains cell membranes.\n\nHealthy fats come from nuts, avocados, olive oil, and fish. Minimize trans fats and don't fear natural saturated fats in whole foods.`,
                    keyPoint: "Fats are essential for hormones, vitamin absorption, and cell function. Choose whole food fat sources.",
                },
                games: [
                    { type: GAME_TYPES.TAP_ALL, question: "What does dietary fat do in your body?", options: [{ text: "Produce hormones", correct: true }, { text: "Absorb certain vitamins", correct: true }, { text: "Maintain cell membranes", correct: true }, { text: "Build muscle directly", correct: false }, { text: "Replace carbs for brain fuel", correct: false }] },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Vitamins A, D, E, and K need _______ to be absorbed.", options: ['fat', 'water', 'protein', 'carbs'], answer: 'fat' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone on a very low-fat diet notices their skin is dry, mood is off, and hormones seem disrupted.", question: "What could be the cause?", options: [
                        { text: "They're eating too much fat", correct: false },
                        { text: "They're not getting enough essential fats for hormone and cell function", correct: true },
                        { text: "Fat doesn't affect these things", correct: false },
                    ], explanation: "Fat is essential for hormones, cell membranes, and vitamin absorption. Too little causes problems." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Healthy fats", right: "Nuts, avocados, olive oil, fish" },
                        { left: "Hormones", right: "Require fat to produce" },
                        { left: "Vitamins A, D, E, K", right: "Need fat for absorption" },
                        { left: "Trans fats", right: "Should be minimized" },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from eating fat to the body benefiting: Why is dietary fat essential?", items: ["You eat foods containing dietary fat", "Body uses the fat to produce hormones (like estrogen and testosterone)", "Fat-soluble vitamins (A, D, E, K) get absorbed properly", "Cell membranes throughout your body stay healthy and flexible", "As a result, your body functions properly at every level"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Eating fat makes you fat.", answer: false, explanation: "Excess calories from any source cause fat gain. Dietary fat is essential and doesn't automatically become body fat." },
                    { type: GAME_TYPES.TAP_ALL, question: "Which are healthy fat sources?", options: [
                        { text: "Avocados", correct: true },
                        { text: "Nuts", correct: true },
                        { text: "Olive oil", correct: true },
                        { text: "Trans fats", correct: false },
                        { text: "Fatty fish", correct: true },
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Fat isn't just stored energy—it's _______ for life.", options: ['essential', 'optional', 'harmful', 'unnecessary'], answer: 'essential' },
                ]
            },
            {
                id: 'fuel-2-5', unitId: 'fuel-2', order: 5, title: "Finding Your Balance",
                content: {
                    intro: `There's no perfect macro ratio for everyone. It depends on your goals, activity level, and preferences.\n\nGeneral starting point: 30% protein, 35% carbs, 35% fat. But this varies widely.\n\nMore important than exact ratios: hit your protein target, eat whole foods, and find a balance you can maintain consistently.`,
                    keyPoint: "No perfect macro ratio exists. Prioritize protein, eat whole foods, and find a sustainable personal balance.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "There is one ideal macro ratio that works best for everyone.", answer: false, explanation: "Optimal ratios depend on individual goals, activity, and preferences. Sustainability matters most." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "More important than exact ratios is finding a balance you can maintain _______.", options: ['consistently', 'intensely', 'perfectly', 'temporarily'], answer: 'consistently' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone keeps trying different 'optimal' macro ratios they read about but can't stick to any of them.", question: "What should they focus on instead?", options: [
                        { text: "Find an even more optimal ratio", correct: false },
                        { text: "Find a balance they can maintain consistently, prioritizing protein and whole foods", correct: true },
                        { text: "Give up on tracking macros entirely", correct: false },
                    ], explanation: "Sustainability beats optimization. Hit protein targets, eat whole foods, find what works for you." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Perfect macro ratio", right: "Doesn't exist for everyone" },
                        { left: "30/35/35", right: "A starting point, not a rule" },
                        { left: "Protein target", right: "Priority to hit" },
                        { left: "Sustainability", right: "More important than perfection" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "What matters most for macro balance?", options: [
                        { text: "Hitting protein targets", correct: true },
                        { text: "Eating whole foods", correct: true },
                        { text: "Finding a sustainable balance", correct: true },
                        { text: "Following exact ratios perfectly", correct: false },
                        { text: "Consistency over time", correct: true },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order these steps for finding YOUR ideal macro balance, from starting point to long-term approach:", items: ["Start with general macro guidelines as a baseline", "Prioritize hitting your protein target first (most important macro)", "Focus on getting those macros from whole, minimally processed foods", "Adjust ratios based on how you feel, perform, and recover", "Maintain your approach consistently — don't keep changing it"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "You must follow exact macro percentages to be healthy.", answer: false, explanation: "General guidelines help, but individual needs vary. Consistency with whole foods matters more than precision." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "No perfect macro ratio exists. Find a sustainable personal _______.", options: ['balance', 'restriction', 'extreme', 'rule'], answer: 'balance' },
                ]
            },
        ],
        'fuel-3': [
            {
                id: 'fuel-3-1', unitId: 'fuel-3', order: 1, title: "Micros: The Hidden Essentials",
                content: {
                    intro: `Micronutrients—vitamins and minerals—don't provide calories but are essential for thousands of body processes.\n\nThey enable energy production, immune function, bone health, blood clotting, muscle contraction, and more.\n\nUnlike macros, you need these in small amounts. But deficiencies cause serious problems—often before you notice symptoms.`,
                    keyPoint: "Micronutrients enable thousands of body processes. Small amounts needed, but deficiencies cause serious issues.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Micronutrients provide significant calories.", answer: false, explanation: "Micronutrients (vitamins and minerals) enable body processes but don't provide calories. Macros provide calories." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Micronutrient _______ can cause serious problems even before you notice symptoms.", options: ['deficiencies', 'excesses', 'variations', 'spikes'], answer: 'deficiencies' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone eats enough calories and protein but still feels tired, gets sick often, and recovers slowly.", question: "What might be the issue?", options: [
                        { text: "They need more protein", correct: false },
                        { text: "They may be missing micronutrients despite adequate macros", correct: true },
                        { text: "They should eat fewer calories", correct: false },
                    ], explanation: "Micronutrients enable body processes. Deficiencies cause problems even with good macro intake." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Micronutrients", right: "Vitamins and minerals" },
                        { left: "Calories", right: "Not provided by micronutrients" },
                        { left: "Small amounts", right: "All that's needed" },
                        { left: "Deficiencies", right: "Cause serious problems" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "What do micronutrients enable?", options: [
                        { text: "Energy production", correct: true },
                        { text: "Immune function", correct: true },
                        { text: "Bone health", correct: true },
                        { text: "Direct calorie provision", correct: false },
                        { text: "Muscle contraction", correct: true },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from what micronutrients do to what happens when they're missing:", items: ["Your body needs vitamins and minerals to function", "These micronutrients enable thousands of essential biological processes", "Only small amounts are needed — but those small amounts are critical", "When you're deficient, processes start to break down", "Symptoms often don't appear until the deficiency is severe (a late warning sign)"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "You need large amounts of micronutrients, like you do macros.", answer: false, explanation: "Unlike macros, micronutrients are needed in small amounts. But small doesn't mean unimportant." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Micronutrients enable thousands of body _______.", options: ['processes', 'calories', 'macros', 'meals'], answer: 'processes' },
                ]
            },
            {
                id: 'fuel-3-2', unitId: 'fuel-3', order: 2, title: "Key Vitamins",
                content: {
                    intro: `Some vitamins most people need to watch:\n\nVitamin D: Bone health, immunity, mood. Most people are deficient, especially in winter.\nB vitamins: Energy production, nerve function. Important for active people.\nVitamin C: Immunity, skin health, antioxidant. Easy to get from fruits and vegetables.\n\nFood variety is the best strategy—different colors mean different vitamins.`,
                    keyPoint: "D, B vitamins, and C are commonly under-consumed. Eat varied colors to cover your vitamin bases.",
                },
                games: [
                    { type: GAME_TYPES.TAP_ALL, question: "Which vitamins are commonly under-consumed?", options: [{ text: "Vitamin D", correct: true }, { text: "B vitamins", correct: true }, { text: "Vitamin C", correct: true }, { text: "Vitamin A excess", correct: false }] },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Different food _______ often mean different vitamins.", options: ['colors', 'textures', 'brands', 'prices'], answer: 'colors' },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Vitamin D", right: "Bone health, immunity, mood" },
                        { left: "B vitamins", right: "Energy production, nerve function" },
                        { left: "Vitamin C", right: "Immunity, skin health, antioxidant" },
                        { left: "Food variety", right: "Best vitamin strategy" },
                    ]},
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone lives in a northern climate and feels tired and down during winter months.", question: "What vitamin might they be lacking?", options: [
                        { text: "Vitamin C", correct: false },
                        { text: "Vitamin D—which requires sunlight and is commonly deficient in winter", correct: true },
                        { text: "Vitamin B12", correct: false },
                    ], explanation: "Vitamin D is produced with sun exposure. Most people in northern climates are deficient in winter." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order this approach to getting enough vitamins, from the most important step to the last resort:", items: ["Eat a wide variety of differently colored foods", "Make sure fruits and vegetables are a major part of your diet", "Each color provides different vitamins (red, orange, green, purple, etc.)", "Eating a wide variety of colors covers most of your vitamin needs", "Use supplements only to fill specific gaps you can't cover with food"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Eating all the same foods every day is fine for vitamins.", answer: false, explanation: "Different foods provide different vitamins. Variety (different colors) is the best strategy." },
                    { type: GAME_TYPES.TAP_ALL, question: "What does Vitamin D help with?", options: [
                        { text: "Bone health", correct: true },
                        { text: "Immunity", correct: true },
                        { text: "Mood", correct: true },
                        { text: "Direct energy from food", correct: false },
                        { text: "Muscle strength", correct: true },
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Most people are _______ in Vitamin D, especially in winter.", options: ['deficient', 'excessive', 'perfect', 'overloaded'], answer: 'deficient' },
                ]
            },
            {
                id: 'fuel-3-3', unitId: 'fuel-3', order: 3, title: "Key Minerals",
                content: {
                    intro: `Critical minerals for active people:\n\nIron: Carries oxygen in blood. Deficiency causes fatigue. Women need more than men.\nMagnesium: Muscle function, sleep, 300+ reactions. Most people are low.\nZinc: Immunity, healing, hormones. Lost through sweat.\nCalcium: Bones, muscle contraction. Critical throughout life.\n\nWhole foods generally provide better mineral absorption than supplements.`,
                    keyPoint: "Iron, magnesium, zinc, and calcium are key for active people. Whole foods beat supplements for absorption.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "_______ carries oxygen in your blood and deficiency causes fatigue.", options: ['Iron', 'Calcium', 'Zinc', 'Magnesium'], answer: 'Iron' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Supplements are always better absorbed than whole foods.", answer: false, explanation: "Whole foods generally provide better absorption because nutrients come with co-factors that aid absorption." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Iron", right: "Carries oxygen, fatigue if low" },
                        { left: "Magnesium", right: "Muscle function, 300+ reactions" },
                        { left: "Zinc", right: "Immunity, lost in sweat" },
                        { left: "Calcium", right: "Bones and muscle contraction" },
                    ]},
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "An active woman feels chronically fatigued despite adequate sleep and calories.", question: "What mineral should she check?", options: [
                        { text: "Calcium—for bone health", correct: false },
                        { text: "Iron—women need more, and deficiency causes fatigue", correct: true },
                        { text: "Sodium—from sweat loss", correct: false },
                    ], explanation: "Iron carries oxygen in blood. Women need more due to menstruation, and active women are at higher risk of deficiency." },
                    { type: GAME_TYPES.TAP_ALL, question: "Which minerals are critical for active people?", options: [
                        { text: "Iron", correct: true },
                        { text: "Magnesium", correct: true },
                        { text: "Zinc", correct: true },
                        { text: "Calcium", correct: true },
                        { text: "Aluminum", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from food choice to absorption: Why are food-based minerals better than pills?", items: ["Choose whole food sources of minerals (nuts, seeds, legumes, greens)", "Those foods naturally contain co-factors alongside the minerals", "The co-factors help your body absorb the minerals more efficiently", "This makes food-based minerals better absorbed than isolated supplement pills", "Your body can use the minerals more effectively when they come packaged with co-factors"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Magnesium is only important for bone health.", answer: false, explanation: "Magnesium is involved in 300+ reactions including muscle function, sleep, and energy production." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Whole foods generally provide better mineral _______ than supplements.", options: ['absorption', 'quantity', 'cost', 'taste'], answer: 'absorption' },
                ]
            },
            {
                id: 'fuel-3-4', unitId: 'fuel-3', order: 4, title: "Electrolytes for Performance",
                content: {
                    intro: `Electrolytes are minerals that carry electrical charge: sodium, potassium, magnesium, calcium.\n\nThey regulate fluid balance, muscle contractions, and nerve signals. You lose them in sweat.\n\nFor most people eating whole foods, supplementation isn't needed. But during intense or prolonged exercise, especially in heat, electrolyte replacement becomes important.`,
                    keyPoint: "Electrolytes regulate fluids, muscles, and nerves. Lost in sweat—replace during intense or prolonged activity.",
                },
                games: [
                    { type: GAME_TYPES.TAP_ALL, question: "Which are electrolytes?", options: [{ text: "Sodium", correct: true }, { text: "Potassium", correct: true }, { text: "Magnesium", correct: true }, { text: "Protein", correct: false }, { text: "Carbohydrates", correct: false }] },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Electrolytes are lost through _______ during exercise.", options: ['sweat', 'breathing', 'thinking', 'digesting'], answer: 'sweat' },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Electrolytes", right: "Minerals with electrical charge" },
                        { left: "Sodium", right: "Major electrolyte lost in sweat" },
                        { left: "Fluid balance", right: "Regulated by electrolytes" },
                        { left: "Intense exercise", right: "May need replacement" },
                    ]},
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone does a 2-hour intense workout in summer heat and only drinks plain water. They feel crampy and weak afterward.", question: "What might help?", options: [
                        { text: "More plain water", correct: false },
                        { text: "Electrolyte replacement—they lost sodium and other minerals in sweat", correct: true },
                        { text: "Less exercise", correct: false },
                    ], explanation: "Intense exercise in heat depletes electrolytes. Plain water can dilute remaining electrolytes further." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order the conditions that escalate from 'water is fine' to 'you need electrolytes':", items: ["You're doing intense or prolonged exercise (60+ minutes)", "Conditions are hot, increasing your sweat rate", "You're sweating heavily and losing sodium, potassium, and other minerals", "At this point, plain water alone isn't enough to replace what's lost", "You need to add electrolytes to properly rehydrate"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Everyone needs electrolyte supplements every day.", answer: false, explanation: "Most people eating whole foods get enough. Supplements mainly help during intense or prolonged exercise." },
                    { type: GAME_TYPES.TAP_ALL, question: "What do electrolytes regulate?", options: [
                        { text: "Fluid balance", correct: true },
                        { text: "Muscle contractions", correct: true },
                        { text: "Nerve signals", correct: true },
                        { text: "Fat storage", correct: false },
                        { text: "Protein synthesis directly", correct: false },
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Electrolytes regulate fluids, muscles, and _______.", options: ['nerves', 'bones', 'fat', 'hair'], answer: 'nerves' },
                ]
            },
            {
                id: 'fuel-3-5', unitId: 'fuel-3', order: 5, title: "Food First Approach",
                content: {
                    intro: `The best micronutrient strategy: food first.\n\nWhole foods contain micronutrients in natural ratios with co-factors that aid absorption. Supplements can help fill specific gaps but shouldn't replace a varied diet.\n\nEat colorful vegetables, fruits, whole grains, nuts, seeds, and quality proteins. Variety is the simplest and best approach.`,
                    keyPoint: "Prioritize whole foods over supplements. Variety and color in diet naturally covers micronutrient needs.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "The 'food _______' approach prioritizes whole foods over supplements.", options: ['first', 'last', 'only', 'free'], answer: 'first' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Supplements can fully replace a varied, whole food diet.", answer: false, explanation: "Whole foods provide nutrients in natural ratios with absorption aids that supplements can't replicate." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone takes a dozen different vitamin pills but eats mostly processed food with little variety.", question: "What's wrong with this approach?", options: [
                        { text: "They're taking too many supplements", correct: false },
                        { text: "Pills lack the co-factors and natural ratios of whole foods; supplements should fill gaps, not replace diet", correct: true },
                        { text: "Processed food is fine if you supplement", correct: false },
                    ], explanation: "Whole foods provide nutrients with natural co-factors. Supplements fill gaps but can't replace food variety." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Food first", right: "Prioritize whole foods" },
                        { left: "Supplements", right: "Fill specific gaps" },
                        { left: "Natural ratios", right: "Found in whole foods" },
                        { left: "Variety", right: "Best micronutrient strategy" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "What should you eat for micronutrient variety?", options: [
                        { text: "Colorful vegetables", correct: true },
                        { text: "Fruits", correct: true },
                        { text: "Whole grains", correct: true },
                        { text: "Only supplements", correct: false },
                        { text: "Nuts and seeds", correct: true },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Rank the 'food first' approach from MOST important foundation to LEAST important addition:", items: ["Eat a varied diet of whole, minimally processed foods", "Include many different colors of fruits and vegetables", "Get the vast majority of your nutrients naturally from those foods", "Use supplements only for specific, identified gaps", "Remember: your overall diet is always the foundation — supplements are extras"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Different food colors provide the same nutrients.", answer: false, explanation: "Different colors often indicate different vitamins and antioxidants. Eating the rainbow covers more bases." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Variety and _______ in diet naturally covers micronutrient needs.", options: ['color', 'size', 'cost', 'brand'], answer: 'color' },
                ]
            },
        ],
        'fuel-4': [
            {
                id: 'fuel-4-1', unitId: 'fuel-4', order: 1, title: "Does Timing Matter?",
                content: {
                    intro: `Good news: meal timing is far less important than what and how much you eat.\n\nFor most people, total daily intake matters more than when you eat. The "don't eat after 7pm" rule has no scientific basis for most goals.\n\nThat said, timing CAN matter for performance and recovery around workouts, and for some metabolic goals.`,
                    keyPoint: "Total intake matters more than timing for most people. Timing can help optimize performance, not replace good nutrition.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Eating after 7pm automatically causes weight gain.", answer: false, explanation: "Total daily calories matter most, not timing. Your body doesn't suddenly store food as fat after a certain hour." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "For most people, _______ daily intake matters more than meal timing.", options: ['total', 'morning', 'evening', 'workout'], answer: 'total' },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [{ left: "Total daily calories", right: "Most important" }, { left: "Late night eating", right: "Overstated concern" }, { left: "Workout timing", right: "Can optimize performance" }, { left: "Perfect meal times", right: "Not required" }] },
                    { type: GAME_TYPES.TAP_ALL, question: "When does meal timing actually matter?", options: [{ text: "Around intense workouts", correct: true }, { text: "For athletic performance", correct: true }, { text: "For weight loss in most people", correct: false }, { text: "Recovery from training", correct: true }, { text: "Eating after 7pm", correct: false }] },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Alex has been avoiding eating anything after 6pm because they heard it causes weight gain, but they often go to bed hungry and struggle to sleep.", question: "What advice would you give?", options: ["Keep avoiding late eating for weight loss", "Total daily intake matters more than timing", "Only eat breakfast and lunch"], correctIndex: 1, explanation: "The time you eat matters far less than total daily intake. Going to bed uncomfortably hungry can actually disrupt sleep and recovery." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Rank from MOST impactful to LEAST impactful: Which nutrition factors matter most for results?", items: ["Total daily calorie intake — the single biggest factor", "Macronutrient balance (protein, carbs, fat ratios)", "Food quality and variety (whole foods vs. processed)", "Specific meal timing — matters least for most people"], acceptableOrders: [[0,1,2,3],[0,2,1,3]] },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Your body has a 'cutoff time' after which all food is stored as fat.", answer: false, explanation: "This is a myth. Your metabolism doesn't have a clock that suddenly switches to fat storage mode at night." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Timing CAN matter for performance and _______ around workouts.", options: ['recovery', 'fashion', 'socializing', 'entertainment'], answer: 'recovery' },
                ]
            },
            {
                id: 'fuel-4-2', unitId: 'fuel-4', order: 2, title: "Pre-Workout Nutrition",
                content: {
                    intro: `Eating before training gives you fuel for performance.\n\n2-3 hours before: A balanced meal with carbs, protein, and some fat\n30-60 minutes before: A small snack, mostly carbs, easy to digest\n\nTraining fasted is fine for low intensity, but for hard efforts, some fuel helps performance. Experiment to find what works for you.`,
                    keyPoint: "Pre-workout food provides fuel. Eat a meal 2-3 hours before or a small snack 30-60 minutes before hard training.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Eat a balanced meal _______-3 hours before training.", options: ['2', '5', '0.5', '6'], answer: '2' },
                    { type: GAME_TYPES.TAP_ALL, question: "What makes a good pre-workout snack 30-60 min before?", options: [{ text: "Easy to digest carbs", correct: true }, { text: "Banana", correct: true }, { text: "Large fatty meal", correct: false }, { text: "High fiber foods", correct: false }, { text: "Toast with jam", correct: true }] },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "You must always train fasted for best fat burning results.", answer: false, explanation: "Training fasted is fine for low intensity, but for hard efforts, some fuel improves performance. Fat loss depends on total daily deficit, not training state." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [{ left: "2-3 hours before", right: "Balanced meal" }, { left: "30-60 minutes before", right: "Small carb snack" }, { left: "Low intensity training", right: "Fasted is okay" }, { left: "High intensity training", right: "Fuel helps performance" }] },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Jordan has a hard interval session in 45 minutes and hasn't eaten in 4 hours. They're considering having a large pasta meal.", question: "What should Jordan do?", options: ["Eat the large pasta meal", "Have a banana or small carb snack", "Train completely fasted"], correctIndex: 1, explanation: "With only 45 minutes, a large meal won't digest in time and may cause discomfort. A small, easy-to-digest carb snack like a banana is ideal." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Rank from BEST to WORST pre-workout snack choice 30 minutes before training (fastest to digest = best):", items: ["Banana — quick-digesting, pure carbs, easy on the stomach", "Toast with jam — simple carbs, digests fast", "Apple with light peanut butter — good but the fat slows digestion slightly", "Large burrito with beans — too heavy, too much fat/fiber, will sit in your stomach"] },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "For a quick snack 30-60 minutes before training, focus mostly on _______.", options: ['carbs', 'fat', 'fiber', 'protein'], answer: 'carbs' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "High fiber foods make great pre-workout snacks right before training.", answer: false, explanation: "High fiber foods take longer to digest and can cause GI discomfort during training. Save them for meals further from your workout." },
                ]
            },
            {
                id: 'fuel-4-3', unitId: 'fuel-4', order: 3, title: "Post-Workout Nutrition",
                content: {
                    intro: `After training, your body wants to replenish glycogen and repair muscle.\n\nThe "30-minute anabolic window" is overblown for most people. But eating protein and carbs within a couple hours of training does support recovery.\n\nPrioritize protein (20-40g) and carbs. Fat is fine but doesn't specifically help recovery.`,
                    keyPoint: "Eat protein and carbs within a couple hours post-workout for recovery. The 'anabolic window' isn't as urgent as claimed.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "You must eat within exactly 30 minutes after working out or you lose all gains.", answer: false, explanation: "The 'anabolic window' is overblown. Eating within a couple hours is fine for most people." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Post-workout, prioritize protein and _______ for recovery.", options: ['carbs', 'fat', 'fiber', 'water only'], answer: 'carbs' },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [{ left: "Protein post-workout", right: "Muscle repair" }, { left: "Carbs post-workout", right: "Glycogen replenishment" }, { left: "30-minute window", right: "Overblown myth" }, { left: "Eating within 2 hours", right: "Good practice" }] },
                    { type: GAME_TYPES.TAP_ALL, question: "What makes a good post-workout meal?", options: [{ text: "20-40g protein", correct: true }, { text: "Carbohydrates", correct: true }, { text: "Only water", correct: false }, { text: "Whole foods", correct: true }, { text: "Avoiding all food for 3 hours", correct: false }] },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Sam finished a strength training session 45 minutes ago and is now home. They're worried they've missed the 'anabolic window' and wonder if eating now is pointless.", question: "What should Sam do?", options: ["Skip the meal since the window is closed", "Eat protein and carbs now - it's still beneficial", "Wait until tomorrow to eat"], correctIndex: 1, explanation: "The 'anabolic window' is much longer than advertised. Eating protein and carbs within a couple hours supports recovery just fine." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Rank from MOST to LEAST important: What matters most after a workout?", items: ["Getting adequate protein (20-40g) — the #1 priority", "Eating carbohydrates to replenish glycogen stores", "Overall food quality (whole foods over processed)", "Eating within exactly 30 minutes — this matters much less than people think"], acceptableOrders: [[0,1,2,3],[0,2,1,3]] },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Aim for _______-40g of protein in your post-workout meal.", options: ['20', '5', '100', '0'], answer: '20' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Fat should be completely avoided after workouts.", answer: false, explanation: "Fat is fine post-workout - it doesn't specifically help recovery but won't hurt it either. Don't stress about avoiding it." },
                ]
            },
            {
                id: 'fuel-4-4', unitId: 'fuel-4', order: 4, title: "Meal Frequency",
                content: {
                    intro: `3 meals? 6 small meals? Intermittent fasting?\n\nFor total daily nutrition, meal frequency doesn't matter much. What matters is hitting your targets in a way you can sustain.\n\nSome people do better with more frequent small meals. Others prefer fewer larger meals. Both work. Find your preference.`,
                    keyPoint: "Meal frequency is personal preference. Whether 2 meals or 6, total daily intake is what matters for most goals.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Eating 6 small meals 'stokes your metabolism' better than 3 meals.", answer: false, explanation: "Meal frequency doesn't significantly affect metabolism. Total daily intake matters more than number of meals." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Whether 2 meals or 6, what matters most is _______ daily intake.", options: ['total', 'first', 'last', 'largest'], answer: 'total' },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [{ left: "6 small meals", right: "Works for some people" }, { left: "3 larger meals", right: "Works for some people" }, { left: "Intermittent fasting", right: "Works for some people" }, { left: "Total daily intake", right: "What actually matters" }] },
                    { type: GAME_TYPES.TAP_ALL, question: "What should guide your meal frequency choice?", options: [{ text: "Personal preference", correct: true }, { text: "What you can sustain", correct: true }, { text: "Fitting your schedule", correct: true }, { text: "Instagram trends", correct: false }, { text: "'Stoking metabolism' myths", correct: false }] },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Chris reads online that eating 6 small meals per day is essential for keeping metabolism 'fired up.' But Chris finds this inconvenient and prefers 3 regular meals.", question: "What should Chris do?", options: ["Force themselves to eat 6 meals for metabolism", "Stick with 3 meals since total intake matters more", "Skip meals entirely to boost metabolism"], correctIndex: 1, explanation: "Meal frequency doesn't significantly affect metabolism. Chris should eat in whatever pattern is sustainable and hits their nutritional targets." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Rank from MOST to LEAST important when planning your meals:", items: ["Hitting your total daily nutrition targets (calories and macros)", "Choosing an eating pattern you can actually sustain long-term", "Spreading protein intake throughout the day (not all in one meal)", "The specific number of meals per day — this matters least"], acceptableOrders: [[0,1,2,3],[1,0,2,3]] },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Intermittent fasting is the only effective way to lose weight.", answer: false, explanation: "Intermittent fasting works for some people, but it's not magic. Any eating pattern that creates a calorie deficit will work for weight loss." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "The best meal frequency is one you can _______ long-term.", options: ['sustain', 'suffer through', 'hate', 'quit'], answer: 'sustain' },
                ]
            },
            {
                id: 'fuel-4-5', unitId: 'fuel-4', order: 5, title: "Circadian Eating",
                content: {
                    intro: `Your body has internal clocks that affect how you process food.\n\nResearch suggests most people process carbs better earlier in the day. Eating more of your calories earlier and less at night may support metabolism and sleep.\n\nThis isn't about strict rules—it's about working with your body's natural rhythms when possible.`,
                    keyPoint: "Your body may process food better earlier in the day. Align eating with your circadian rhythm when practical.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Research suggests carbs may be processed better _______ in the day.", options: ['earlier', 'later', 'midnight', 'never'], answer: 'earlier' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "You must follow strict eating schedules to be healthy.", answer: false, explanation: "Circadian eating can help but isn't required. Consistency and total intake matter more than perfect timing." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [{ left: "Circadian rhythm", right: "Body's internal clock" }, { left: "Earlier eating", right: "May support metabolism" }, { left: "Late night eating", right: "Can affect sleep" }, { left: "Strict schedules", right: "Not required" }] },
                    { type: GAME_TYPES.TAP_ALL, question: "What are potential benefits of eating more calories earlier in the day?", options: [{ text: "Better carb processing", correct: true }, { text: "Improved sleep", correct: true }, { text: "Aligns with circadian rhythm", correct: true }, { text: "Guaranteed weight loss", correct: false }, { text: "Works with body's natural patterns", correct: true }] },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Pat typically eats a small breakfast, medium lunch, and huge dinner late at night. They often have trouble sleeping and feel sluggish in the morning.", question: "What might help Pat?", options: ["Eat even less during the day", "Shift more calories to earlier meals and lighter dinner", "Skip breakfast entirely"], correctIndex: 1, explanation: "Eating more earlier and less at night may help with sleep and energy. Large late meals can disrupt sleep quality." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Rank from BEST to WORST for your body's circadian rhythm (early eating = better):", items: ["Larger breakfast and lunch, lighter dinner — best match for your body clock", "Even distribution across meals — reasonable but dinner is still equal to breakfast", "Light all day, huge dinner — poor timing, body processes food worse at night", "Skipping breakfast and feasting at night — worst match for circadian rhythm"] },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Your body processes food exactly the same way at all hours.", answer: false, explanation: "Research shows your body's ability to process nutrients changes throughout the day based on your circadian rhythm." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Eating more calories _______ and less at night may support metabolism and sleep.", options: ['earlier', 'later', 'never', 'randomly'], answer: 'earlier' },
                ]
            },
        ],
        'fuel-5': [
            {
                id: 'fuel-5-1', unitId: 'fuel-5', order: 1, title: "Fat Loss Nutrition",
                content: {
                    intro: `Fat loss requires a calorie deficit—eating less than you burn.\n\nKey strategies:\n- Moderate deficit (500 cal/day = ~1 lb/week loss)\n- High protein (preserves muscle, increases fullness)\n- High fiber (increases fullness, supports gut health)\n- Mostly whole foods (more filling per calorie)\n\nSustainability matters more than speed. Extreme deficits backfire.`,
                    keyPoint: "Fat loss needs a moderate deficit, high protein, high fiber, and whole foods. Sustainable beats extreme.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "A 500 calorie daily deficit leads to roughly 1 _______ per week of fat loss.", options: ['pound', 'kilogram', 'ounce', 'stone'], answer: 'pound' },
                    { type: GAME_TYPES.TAP_ALL, question: "Which support fat loss?", options: [{ text: "High protein", correct: true }, { text: "High fiber", correct: true }, { text: "Moderate deficit", correct: true }, { text: "Extreme restriction", correct: false }, { text: "Skipping protein", correct: false }] },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Extreme calorie deficits lead to faster, more sustainable fat loss.", answer: false, explanation: "Extreme deficits often backfire - causing muscle loss, metabolic adaptation, and rebounds. Moderate deficits are more sustainable." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [{ left: "High protein", right: "Preserves muscle" }, { left: "High fiber", right: "Increases fullness" }, { left: "Whole foods", right: "More filling per calorie" }, { left: "Moderate deficit", right: "Sustainable approach" }] },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Taylor wants to lose fat fast and decides to eat only 800 calories per day while doing hours of cardio daily.", question: "What's the likely outcome?", options: ["Fast, sustainable fat loss", "Initial loss followed by plateau, muscle loss, and rebound", "Optimal body composition"], correctIndex: 1, explanation: "Extreme deficits cause metabolic adaptation, muscle loss, and often lead to weight regain. A moderate deficit is more effective long-term." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Rank from MOST to LEAST effective for long-term fat loss:", items: ["Moderate calorie deficit with high protein — sustainable and muscle-sparing", "Whole foods focus — nutrient-dense and filling", "Consistent exercise routine — supports metabolism and muscle", "Extreme calorie restriction — works short-term but always backfires long-term"], acceptableOrders: [[0,1,2,3],[0,2,1,3]] },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Sustainability matters more than _______ when it comes to fat loss.", options: ['speed', 'perfection', 'restriction', 'suffering'], answer: 'speed' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "High protein during fat loss helps preserve muscle mass.", answer: true, explanation: "Protein is essential during a deficit - it helps maintain muscle, keeps you fuller longer, and has a higher thermic effect." },
                ]
            },
            {
                id: 'fuel-5-2', unitId: 'fuel-5', order: 2, title: "Muscle Building Nutrition",
                content: {
                    intro: `Building muscle requires a calorie surplus—eating more than you burn.\n\nKey strategies:\n- Slight surplus (200-500 cal/day)\n- High protein (0.7-1g per lb bodyweight)\n- Adequate carbs (fuel for training)\n- Consistent training stimulus\n\nYou can't build muscle from nothing. Excess calories provide building materials.`,
                    keyPoint: "Muscle building needs a slight surplus, high protein, enough carbs, and consistent training. Can't build from nothing.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "You can build significant muscle while eating in a large calorie deficit.", answer: false, explanation: "Muscle building requires surplus calories for building materials. Deficits limit muscle growth potential." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "For muscle building, aim for a _______ calorie surplus of 200-500.", options: ['slight', 'massive', 'zero', 'negative'], answer: 'slight' },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [{ left: "Calorie surplus", right: "Provides building materials" }, { left: "High protein", right: "0.7-1g per lb bodyweight" }, { left: "Adequate carbs", right: "Fuel for training" }, { left: "Consistent training", right: "Stimulates muscle growth" }] },
                    { type: GAME_TYPES.TAP_ALL, question: "What do you need for muscle building?", options: [{ text: "Calorie surplus", correct: true }, { text: "High protein", correct: true }, { text: "Adequate carbs", correct: true }, { text: "Large calorie deficit", correct: false }, { text: "Consistent training", correct: true }] },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Morgan wants to build muscle but is afraid of gaining any fat, so they eat at a 500 calorie deficit while lifting weights.", question: "What will likely happen?", options: ["Significant muscle gain", "Limited muscle growth due to insufficient calories", "Massive fat loss and muscle gain"], correctIndex: 1, explanation: "You can't build muscle from nothing. A calorie deficit limits the materials available for muscle growth. Morgan needs at least maintenance or a slight surplus." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Rank from MOST to LEAST important for building muscle:", items: ["Consistent training stimulus — without challenging workouts, nothing else matters", "Adequate protein intake — your muscles need building blocks", "Calorie surplus — provides extra energy for muscle construction", "Perfect supplement timing — has the smallest effect of all these factors"], acceptableOrders: [[0,1,2,3],[0,2,1,3]] },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Aim for _______-1g of protein per pound of bodyweight when building muscle.", options: ['0.7', '0.2', '2.0', '0.1'], answer: '0.7' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Carbs are unnecessary for muscle building.", answer: false, explanation: "Carbs fuel your training and help with recovery. They're important for providing energy for hard workouts that stimulate muscle growth." },
                ]
            },
            {
                id: 'fuel-5-3', unitId: 'fuel-5', order: 3, title: "Performance Nutrition",
                content: {
                    intro: `If performance is your goal, nutrition supports training.\n\nCarbs become more important—they fuel high-intensity work. Pre and post-workout nutrition matters more. Adequate calories prevent fatigue and overtraining.\n\nDon't sacrifice performance for a diet. Eat to train well. Body composition often improves as a side effect of training hard.`,
                    keyPoint: "For performance, eat to fuel training. Adequate carbs and calories prevent fatigue. Don't diet yourself weak.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "For high-intensity performance, _______ become especially important.", options: ['carbs', 'fasts', 'deficits', 'restrictions'], answer: 'carbs' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "You should always prioritize fat loss over athletic performance.", answer: false, explanation: "Underfueling hurts performance and recovery. Sometimes eating more improves both performance and body composition." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [{ left: "Carbs", right: "Fuel high-intensity work" }, { left: "Adequate calories", right: "Prevent fatigue" }, { left: "Pre-workout nutrition", right: "Supports performance" }, { left: "Underfueling", right: "Hurts performance" }] },
                    { type: GAME_TYPES.TAP_ALL, question: "What supports athletic performance?", options: [{ text: "Adequate carbohydrates", correct: true }, { text: "Enough total calories", correct: true }, { text: "Pre/post workout nutrition", correct: true }, { text: "Severe calorie restriction", correct: false }, { text: "Cutting carbs completely", correct: false }] },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Casey is training for a marathon but has been dieting hard, eating very few carbs. Their training runs have become exhausting and their times are getting worse.", question: "What's likely the problem?", options: ["Not enough cardio", "Underfueling - needs more carbs and calories", "Too much sleep"], correctIndex: 1, explanation: "Carbs are the primary fuel for high-intensity and endurance work. Underfueling with carbs directly hurts performance and recovery." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Rank from MOST helpful to MOST harmful for athletic performance:", items: ["Quality training and recovery — the foundation of performance", "Adequate total calories — you can't perform without fuel", "Sufficient carbohydrates — the primary fuel for intense exercise", "Extreme calorie restriction — actively HARMS performance"] },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Don't sacrifice performance for a _______.", options: ['diet', 'workout', 'rest day', 'carb'], answer: 'diet' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Body composition often improves as a side effect of training hard and eating well.", answer: true, explanation: "When you fuel properly and train consistently, your body composition often improves naturally - sometimes better than when you're actively dieting." },
                ]
            },
            {
                id: 'fuel-5-4', unitId: 'fuel-5', order: 4, title: "Recomposition: The Middle Path",
                content: {
                    intro: `Can you build muscle AND lose fat simultaneously? Sometimes.\n\nThis "body recomposition" works best for: beginners, those returning after breaks, and overweight individuals.\n\nStrategy: eat at maintenance or slight deficit, very high protein, consistent strength training. Progress is slower but you improve both directions.`,
                    keyPoint: "Recomposition (muscle gain + fat loss) is possible for beginners or those returning. Requires high protein and patience.",
                },
                games: [
                    { type: GAME_TYPES.TAP_ALL, question: "Who benefits most from recomposition approach?", options: [{ text: "Beginners", correct: true }, { text: "Those returning after breaks", correct: true }, { text: "Overweight individuals", correct: true }, { text: "Advanced lean athletes", correct: false }] },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Recomposition requires very high _______ and consistent strength training.", options: ['protein', 'carbs', 'fats', 'calories'], answer: 'protein' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Body recomposition works equally well for advanced lean athletes as it does for beginners.", answer: false, explanation: "Recomposition works best for beginners, those returning after breaks, and overweight individuals. Advanced lean athletes usually need to choose bulking or cutting phases." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [{ left: "Beginners", right: "Great recomp candidates" }, { left: "Returning after breaks", right: "Great recomp candidates" }, { left: "Maintenance calories", right: "Common recomp approach" }, { left: "Very high protein", right: "Essential for recomp" }] },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Jamie is a complete beginner to strength training and is slightly overweight. They're confused about whether to bulk or cut first.", question: "What approach might work best?", options: ["Extreme cutting diet", "Aggressive bulking", "Recomposition - maintenance calories with high protein and consistent strength training"], correctIndex: 2, explanation: "As a beginner who is overweight, Jamie is an ideal candidate for recomposition. They can build muscle and lose fat simultaneously with proper nutrition and training." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Rank from MOST to LEAST important for body recomposition (losing fat while building muscle):", items: ["Consistent strength training — the #1 signal telling your body to build muscle", "Very high protein intake — preserves and builds muscle during fat loss", "Eating at maintenance or a slight deficit — provides the right energy environment", "Patience — recomp is slower than pure fat loss or muscle gain, but it works"], acceptableOrders: [[0,1,2,3],[0,2,1,3]] },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Recomposition progress is _______ but you improve in both directions.", options: ['slower', 'faster', 'impossible', 'instant'], answer: 'slower' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "You can build muscle AND lose fat simultaneously under certain conditions.", answer: true, explanation: "Body recomposition is possible, especially for beginners, those returning after breaks, and overweight individuals, though progress is slower than dedicated bulk/cut cycles." },
                ]
            },
            {
                id: 'fuel-5-5', unitId: 'fuel-5', order: 5, title: "Sustainable Nutrition",
                content: {
                    intro: `The best diet is one you can follow forever.\n\nNo diet works if you can't sustain it. Extreme approaches produce extreme rebounds. The goal is building habits that become automatic—not willpower-dependent restrictions.\n\nFind your balance. Make gradual changes. Focus on adding good foods, not just removing "bad" ones. Consistency over perfection.`,
                    keyPoint: "The best nutrition plan is sustainable. Build habits, make gradual changes, add good foods. Consistency wins.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "The most restrictive diet is always the most effective.", answer: false, explanation: "Extreme diets produce extreme rebounds. The best diet is one you can sustain long-term." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "The best diet is one you can follow _______.", options: ['forever', 'intensely', 'perfectly', 'temporarily'], answer: 'forever' },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [{ left: "Sustainable habits", right: "Long-term success" }, { left: "Extreme restriction", right: "Rebounds and failure" }, { left: "Adding good foods", right: "Positive approach" }, { left: "Consistency", right: "Beats perfection" }] },
                    { type: GAME_TYPES.TAP_ALL, question: "What makes nutrition sustainable?", options: [{ text: "Building automatic habits", correct: true }, { text: "Making gradual changes", correct: true }, { text: "Focusing on adding good foods", correct: true }, { text: "Extreme willpower dependence", correct: false }, { text: "Perfect restriction", correct: false }] },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Riley has tried many extreme diets - keto, juice cleanses, extreme low calorie - and always rebounds hard, gaining back more weight than they lost.", question: "What approach should Riley try instead?", options: ["An even more extreme diet", "Gradual sustainable changes they can maintain forever", "Complete food elimination"], correctIndex: 1, explanation: "Extreme approaches produce extreme rebounds. Riley needs sustainable habits that become automatic, not another willpower-dependent restriction cycle." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Rank from MOST sustainable to LEAST sustainable over the long term:", items: ["Gradual habit changes — small shifts you barely notice", "Adding nutritious foods (rather than removing favorite foods)", "Moderate, flexible approach — allows for treats without guilt", "Extreme elimination diet — works briefly but almost no one sustains it"], acceptableOrders: [[0,1,2,3],[0,2,1,3],[1,0,2,3],[1,2,0,3],[2,0,1,3],[2,1,0,3]] },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Focus on _______ good foods, not just removing bad ones.", options: ['adding', 'eliminating', 'fearing', 'avoiding'], answer: 'adding' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Consistency matters more than perfection in nutrition.", answer: true, explanation: "Being 80% consistent over years beats being 100% perfect for a few weeks. Sustainable nutrition is about long-term patterns, not short-term perfection." },
                ]
            },
        ],
        'fuel-6': [
            {
                id: 'fuel-6-1', unitId: 'fuel-6', order: 1, title: "Cravings Are Predictions",
                content: {
                    intro: `That craving for chocolate isn't a command from your body. It's a prediction.\n\nYour brain is constantly managing your body's energy budget—predicting metabolic needs and preparing to meet them. When the budget runs low (from stress, poor sleep, or just a long day), your brain generates unpleasant feelings and searches for the fastest predicted fix.\n\nIf eating calorie-dense food has previously been followed by feeling better (and it has—sugar genuinely does provide a quick glucose boost), your brain predicts: "eating this will fix how I feel." You experience that prediction as a craving.\n\nBut here's the key: it's a prediction, not a fact. The same body signals that your brain categorizes as "I need chocolate" could equally be "I need sleep," "I need to move," or "I need to call a friend."`,
                    keyPoint: "Cravings are your brain's predictions about what will fix a body budget deficit—not commands you must obey. The same signals can be categorized as hunger, fatigue, loneliness, or stress.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "A food craving is a direct signal from your body telling you exactly what it needs.", answer: false, explanation: "A craving is your brain's prediction about what will fix a body budget deficit. It's a best guess, not a fact—the same signals could mean you need sleep, connection, or movement." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Cravings are _______, not commands.", options: ['predictions', 'needs', 'facts', 'instincts'], answer: 'predictions' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "After a stressful day, you feel a strong craving for ice cream. You assume your body 'needs' sugar.", question: "What's actually happening?", options: [
                        { text: "Your body has a genuine sugar deficiency", correct: false },
                        { text: "Your brain is predicting that ice cream will fix a body budget deficit caused by stress", correct: true },
                        { text: "You lack the willpower to resist", correct: false },
                    ], explanation: "Your body budget is depleted from stress. Your brain searched for the fastest predicted fix based on past experience—and sugar has 'worked' before. But the actual deficit might be better served by rest, connection, or stress relief." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Body budget deficit", right: "Your brain detects you're running low" },
                        { left: "Unpleasant feelings", right: "Brain's signal that something's off" },
                        { left: "Craving", right: "Brain's predicted fix for the deficit" },
                        { left: "Eating comfort food", right: "One possible fix, not the only one" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "What could your brain's 'I need chocolate' prediction actually mean?", options: [
                        { text: "You need sleep", correct: true },
                        { text: "You need social connection", correct: true },
                        { text: "You specifically need chocolate", correct: false },
                        { text: "You need to move or destress", correct: true },
                        { text: "You need hydration", correct: true },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from the trigger to the craving: How does your brain create a food craving?", items: ["Your body budget runs low (from stress, fatigue, poor sleep, etc.)", "Brain generates unpleasant feelings (irritability, restlessness)", "Brain searches its memory for something that helped before", "It finds a match: sugar/comfort food provided quick relief in the past", "You experience that prediction as an intense craving"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Because cravings are predictions (not facts), they can be examined and responded to differently.", answer: true, explanation: "Once you understand a craving is your brain's prediction, not a command, you can ask: 'What does my body budget actually need right now?'" },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "The same body signals your brain calls 'hunger' could equally be categorized as _______, fatigue, or loneliness.", options: ['stress', 'happiness', 'strength', 'focus'], answer: 'stress' },
                ]
            },
            {
                id: 'fuel-6-2', unitId: 'fuel-6', order: 2, title: "Your Body Budget Explains Everything",
                content: {
                    intro: `Lisa Feldman Barrett's research reveals that hunger, tiredness, anxiety, sadness, and cravings all come from the same system—your brain's body budget management.\n\nYour brain receives signals from your gut, heart, muscles, hormones, and blood chemistry. It doesn't get a neat label saying "you're hungry" or "you're anxious." It gets raw, ambiguous data. Then it makes a prediction about what those signals mean, based on context and past experience.\n\nThis means "Am I hungry or am I tired?" isn't a question with an objectively correct answer. It's a question about which prediction your brain chose. A churning stomach could be hunger, anxiety, or dehydration. A low-energy feeling could be sadness, sleepiness, or low blood sugar. Your brain picks the explanation it has the most practice with.`,
                    keyPoint: "Hunger, emotions, fatigue, and cravings all arise from the same interoceptive system. Your brain categorizes ambiguous body signals based on context and past experience—not objective readouts.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Hunger and emotions come from separate, independent systems in the brain.", answer: false, explanation: "They come from the same interoceptive prediction system. The brain receives ambiguous body signals and categorizes them as hunger, emotion, or fatigue based on context." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Your brain receives _______ body signals and categorizes them based on context and past experience.", options: ['ambiguous', 'clear', 'labeled', 'simple'], answer: 'ambiguous' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "You feel a churning stomach and low energy at 3pm at work. You assume you're hungry and grab a snack. But you had a big lunch an hour ago.", question: "What might actually be happening?", options: [
                        { text: "Your lunch wasn't nutritious enough", correct: false },
                        { text: "Your brain categorized stress or fatigue signals as hunger—because that's a well-practiced prediction", correct: true },
                        { text: "You have an unusually fast metabolism", correct: false },
                    ], explanation: "The body signals (churning stomach, low energy) were real. But your brain's categorization as 'hunger' was a prediction. In context (stressful afternoon, big recent lunch), it might really be stress or fatigue." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Churning stomach", right: "Could be hunger, anxiety, or dehydration" },
                        { left: "Low energy", right: "Could be sadness, sleepiness, or low blood sugar" },
                        { left: "Restlessness", right: "Could be boredom, anxiety, or need to move" },
                        { left: "All of these", right: "Come from the same body budget system" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "Which all arise from the same interoceptive prediction system?", options: [
                        { text: "Hunger", correct: true },
                        { text: "Anxiety", correct: true },
                        { text: "Fatigue", correct: true },
                        { text: "Sadness", correct: true },
                        { text: "None of these—they're all separate", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from body signal to conscious feeling: How does the brain construct 'hunger'?", items: ["Body sends raw internal signals (stomach contractions, blood sugar changes)", "Brain receives this data — but the signals are ambiguous on their own", "Brain checks the context (time of day, what you see/smell) and past experience", "Brain generates a prediction: 'this feeling means you're hungry'", "You consciously experience that prediction as the feeling of hunger"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "'Am I hungry or am I tired?' is a question with an objectively correct answer that your body knows.", answer: false, explanation: "It's a question about which prediction your brain chose. The same signals can be categorized either way depending on context." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Your brain picks the explanation it has the most _______ with.", options: ['practice', 'evidence', 'patience', 'desire'], answer: 'practice' },
                ]
            },
            {
                id: 'fuel-6-3', unitId: 'fuel-6', order: 3, title: "Comfort Food Is Rational (Short-Term)",
                content: {
                    intro: `Here's something important: your brain isn't being stupid when it craves comfort food. It's being rational—just short-sighted.\n\nSugar genuinely does raise blood glucose quickly. Fat genuinely does activate reward pathways. Highly palatable food actually suppresses your stress system temporarily. Your brain has learned from real experience that calorie-dense food provides a quick body budget boost.\n\nThe problem isn't that the prediction is wrong. In the short term, it's correct. The problem is that the body budget deficit was caused by something food can't actually fix—chronic stress, sleep deprivation, loneliness, inactivity. The sugar wears off in 30 minutes, but the underlying deficit remains. So the craving returns.\n\nThis reframe matters: you're not "weak" for craving comfort food. Your brain is running a biologically rational short-term optimization. The solution isn't to fight the craving—it's to fix the underlying body budget.`,
                    keyPoint: "Comfort food cravings are biologically rational short-term predictions. Sugar and fat genuinely do provide quick body budget boosts. The problem is the underlying deficit (stress, sleep, loneliness) that food can't fix.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Craving comfort food means your brain is being irrational or weak.", answer: false, explanation: "Your brain is being completely rational—sugar and fat genuinely provide quick body budget boosts. It's just optimizing for the short term." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Comfort food cravings are biologically _______ short-term predictions.", options: ['rational', 'random', 'irrational', 'imaginary'], answer: 'rational' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "You've been sleeping poorly all week and feel exhausted. You crave sugary coffee drinks and pastries constantly. You eat them, feel better for 30 minutes, then crave more.", question: "What's happening?", options: [
                        { text: "You're addicted to sugar", correct: false },
                        { text: "Sugar gives a real short-term body budget boost, but can't fix the actual deficit (sleep deprivation)—so the craving cycles", correct: true },
                        { text: "You lack self-discipline", correct: false },
                    ], explanation: "Sugar genuinely raises blood glucose and provides temporary relief. But the body budget deficit is caused by sleep deprivation—something food can't fix. So 30 minutes later, the deficit is back and so is the craving." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Sugar", right: "Genuinely raises blood glucose quickly" },
                        { left: "Fat", right: "Genuinely activates reward pathways" },
                        { left: "Palatable food", right: "Temporarily suppresses stress response" },
                        { left: "The real problem", right: "Underlying deficit food can't fix" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "What can actually cause the body budget deficit behind comfort food cravings?", options: [
                        { text: "Chronic stress", correct: true },
                        { text: "Sleep deprivation", correct: true },
                        { text: "Social isolation", correct: true },
                        { text: "Not enough sugar in your diet", correct: false },
                        { text: "Physical inactivity", correct: true },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order this cycle from the cause to why the craving keeps coming back:", items: ["A body budget deficit exists (from stress, poor sleep, overwork, etc.)", "Brain predicts that sugar/fat will fix the deficit", "You eat comfort food — and it genuinely provides brief relief", "But the underlying deficit remains because food can't fix stress or exhaustion", "The craving returns 30 minutes later — because the real problem was never solved"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "The solution to comfort food cravings is to fight them harder with willpower.", answer: false, explanation: "The solution is to fix the underlying body budget deficit—sleep, stress management, social connection, movement. Address the cause, not the symptom." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "The solution isn't to fight the craving—it's to fix the underlying body _______.", options: ['budget', 'weight', 'image', 'type'], answer: 'budget' },
                ]
            },
            {
                id: 'fuel-6-4', unitId: 'fuel-6', order: 4, title: "Emotional Granularity Changes Everything",
                content: {
                    intro: `Research by Lisa Feldman Barrett shows that people who can make fine-grained distinctions between their feelings are far less likely to use food as a one-size-fits-all fix.\n\nThis skill is called emotional granularity. It's the difference between "I feel bad" and "I feel disappointed because my expectations weren't met, and underneath that I'm fatigued from poor sleep, which is making everything feel heavier."\n\nWhen all you can say is "I feel bad," eating is a reliable fix for "bad." But when you can distinguish between tired, lonely, frustrated, and hungry, you can address each one specifically. Tired? Sleep. Lonely? Call someone. Frustrated? Take a walk. Actually hungry? Eat.\n\nGranularity is trainable. The more concepts you have for your body's states, the more precisely your brain can categorize those ambiguous signals—and the less often it defaults to "eat something."`,
                    keyPoint: "Emotional granularity—the ability to make fine-grained distinctions between feelings—reduces emotional eating. More concepts = more precise predictions = better responses to body budget signals.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Emotional _______ is the ability to make fine-grained distinctions between your feelings.", options: ['granularity', 'intensity', 'control', 'suppression'], answer: 'granularity' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "People who can only describe their feelings as 'good' or 'bad' are more likely to use food as a catch-all fix.", answer: true, explanation: "When all you know is 'I feel bad,' eating is a reliable fix for 'bad.' More specific categorization leads to more specific (and effective) responses." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Two people both feel 'bad' after a long day. Person A can only describe it as 'I feel bad—I need chocolate.' Person B recognizes: 'I'm feeling lonely and under-slept, and my body is interpreting that as a craving.'", question: "Who is more likely to address the actual problem?", options: [
                        { text: "Person A—they trust their gut", correct: false },
                        { text: "Person B—higher emotional granularity lets them target the real need", correct: true },
                        { text: "Neither—feelings are unreliable", correct: false },
                    ], explanation: "Person B's granularity lets them see through the craving prediction to the actual needs: connection and sleep. Person A defaults to food because it's the only solution for 'bad.'" },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Low granularity", right: "'I feel bad, I need food'" },
                        { left: "High granularity", right: "'I'm tired and lonely, not hungry'" },
                        { left: "More emotion concepts", right: "More precise predictions" },
                        { left: "Granularity", right: "Trainable with practice" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "How does emotional granularity reduce emotional eating?", options: [
                        { text: "You can distinguish tired from hungry", correct: true },
                        { text: "You can target the actual need instead of defaulting to food", correct: true },
                        { text: "It suppresses all emotions", correct: false },
                        { text: "More concepts give your brain more precise categorization options", correct: true },
                        { text: "It makes you stop having cravings entirely", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from the vague feeling to the precise response: How does emotional granularity change your response to cravings?", items: ["A body budget signal arrives — you just feel 'bad' or 'off'", "Instead of automatically assuming you're hungry, you pause", "You ask yourself: am I actually hungry? Or tired? Lonely? Stressed?", "You identify the SPECIFIC underlying need", "You address that actual need directly (rest, connection, stress relief, or food)"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Emotional granularity is a fixed trait you're born with.", answer: false, explanation: "Granularity is trainable. The more you practice distinguishing your feelings, the more concepts your brain has for categorizing body signals." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "More emotion concepts give your brain more precise _______ options.", options: ['categorization', 'eating', 'avoidance', 'defense'], answer: 'categorization' },
                ]
            },
            {
                id: 'fuel-6-5', unitId: 'fuel-6', order: 5, title: "Fix the Budget, Not the Craving",
                content: {
                    intro: `If comfort food cravings are driven by body budget deficits, the solution is clear: keep the budget balanced.\n\nSleep is a deposit. Movement is a deposit. Social connection is a deposit. Nutritious food is a deposit. Hydration is a deposit.\n\nChronic stress is a withdrawal. Sleep deprivation is a withdrawal. Social isolation is a withdrawal. Sedentary living is a withdrawal.\n\nWhen your budget is chronically in deficit, your brain will keep generating cravings because it's genuinely trying to restore balance. Fighting the cravings treats the symptom. Balancing the budget treats the cause.\n\nThis is the ultimate reframe: "emotional eating" isn't an emotional problem with a food solution. It's a body budget problem that needs a body budget solution—sleep, movement, connection, and genuine nourishment.`,
                    keyPoint: "Fix the body budget, not the craving. Sleep, movement, social connection, and nutrition are deposits. Chronic stress and deprivation are withdrawals. Balance the budget and cravings resolve at the source.",
                },
                games: [
                    { type: GAME_TYPES.TAP_ALL, question: "Which are body budget deposits?", options: [
                        { text: "Quality sleep", correct: true },
                        { text: "Regular movement", correct: true },
                        { text: "Social connection", correct: true },
                        { text: "Chronic stress", correct: false },
                        { text: "Nutritious food", correct: true },
                    ]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Fighting cravings with willpower addresses the root cause of emotional eating.", answer: false, explanation: "Fighting cravings treats the symptom. The root cause is a body budget deficit. Balance the budget (sleep, movement, connection, nutrition) and cravings resolve at the source." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone has been sleeping 5 hours a night, skipping meals, not exercising, and feeling isolated. They have constant sugar cravings and call themselves 'addicted to sugar.'", question: "What's the real problem?", options: [
                        { text: "Sugar addiction", correct: false },
                        { text: "A massive body budget deficit—their brain is desperately trying to restore balance through the fastest predicted fix", correct: true },
                        { text: "Lack of willpower", correct: false },
                    ], explanation: "Their body budget is in chronic deficit from every direction—sleep, nutrition, movement, connection. Their brain's sugar cravings are a rational attempt to get quick energy. Fix the budget deficits and the 'addiction' resolves." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Quality sleep", right: "Body budget deposit" },
                        { left: "Chronic stress", right: "Body budget withdrawal" },
                        { left: "Social isolation", right: "Body budget withdrawal" },
                        { left: "Regular movement", right: "Body budget deposit" },
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "'Emotional eating' isn't an emotional problem—it's a body _______ problem.", options: ['budget', 'image', 'weight', 'type'], answer: 'budget' },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order the steps to actually resolving chronic cravings at the root cause:", items: ["Recognize that chronic cravings signal a body budget deficit (not a willpower failure)", "Investigate what's actually draining your budget (poor sleep? chronic stress? loneliness?)", "Address those actual deficits directly (improve sleep, reduce stress, build connection)", "As the deficits are addressed, your body budget begins to balance", "Cravings naturally reduce because the underlying need is finally being met"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Social connection is a genuine body budget deposit—not just nice to have.", answer: true, explanation: "Your brain co-regulates with others. Social connection literally reduces the metabolic cost of self-regulation. Isolation is expensive for your body budget." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Balance the budget and cravings resolve at the _______.", options: ['source', 'surface', 'table', 'gym'], answer: 'source' },
                ]
            },
        ],
        'fuel-7': [
            {
                id: 'fuel-7-1', unitId: 'fuel-7', order: 1, title: "Do You Really Need Supplements?",
                content: {
                    intro: `The supplement industry is worth billions—but how much of it is backed by science?\n\nMost healthy people eating a varied diet get the nutrients they need from food. Supplements can help fill genuine gaps, but they can't replace a poor diet.\n\nKey idea: supplements should supplement, not substitute. A handful of pills can't undo the damage of eating mostly processed food, and megadosing vitamins rarely helps and can even be harmful.`,
                    keyPoint: "Supplements fill gaps but can't replace a varied diet. Most healthy people eating well don't need most supplements.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Taking supplements can fully replace the need for a balanced diet.", answer: false, explanation: "Supplements fill specific gaps but lack the co-factors, fiber, and phytonutrients found in whole foods. Food first, always." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Supplements should _______, not substitute for a healthy diet.", options: ['supplement', 'replace', 'dominate', 'eliminate'], answer: 'supplement' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "A friend eats mostly fast food but takes 15 different supplement pills daily. They say they're covered nutritionally.", question: "Is this a good strategy?", options: [
                        { text: "Yes—supplements cover all nutritional needs", correct: false },
                        { text: "No—supplements can't replicate the full benefits of whole foods and a varied diet", correct: true },
                        { text: "Only if they take more supplements", correct: false },
                    ], explanation: "Whole foods provide thousands of compounds that work synergistically. Supplements can't replicate that complexity." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Supplements", right: "Fill specific nutrient gaps" },
                        { left: "Whole foods", right: "Provide synergistic nutrients" },
                        { left: "Megadosing vitamins", right: "Rarely helps, can harm" },
                        { left: "Varied diet", right: "Best nutrient strategy" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "When might supplements be genuinely useful?", options: [
                        { text: "Documented deficiency", correct: true },
                        { text: "Limited food access or variety", correct: true },
                        { text: "Replacing meals", correct: false },
                        { text: "Pregnancy", correct: true },
                        { text: "Restricted or limited diets", correct: true },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Prioritize your nutrition approach:", items: ["Eat a varied whole food diet", "Include colorful fruits and vegetables", "Identify any specific gaps", "Supplement only what's needed", "Recheck periodically"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "The supplement industry is tightly regulated like prescription drugs.", answer: false, explanation: "Supplements are far less regulated than drugs. They don't need to prove effectiveness before being sold, and quality varies widely between brands." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Most healthy people eating a _______ diet get the nutrients they need from food.", options: ['varied', 'restricted', 'liquid', 'supplement-heavy'], answer: 'varied' },
                ]
            },
            {
                id: 'fuel-7-2', unitId: 'fuel-7', order: 2, title: "The Most Common Deficiencies",
                content: {
                    intro: `Certain vitamins and minerals are commonly under-consumed, regardless of diet:\n\nVitamin D: Hard to get from food alone. Sunlight is the primary source, but many people don't get enough—especially in winter.\nVitamin B12: Essential for nerve function and energy. Older adults, those on certain medications, and restricted diets are at risk.\nOmega-3 (DHA/EPA): Critical for heart and brain health. Found in fatty fish, or available as supplements.\nIron: Especially important for women, athletes, and growing teens. Pairing iron-rich foods with vitamin C boosts absorption.\nMagnesium: Involved in 300+ body processes. Most people don't get enough from food alone.`,
                    keyPoint: "Vitamin D, B12, omega-3, iron, and magnesium are the most common deficiencies. Many people benefit from targeted supplementation.",
                },
                games: [
                    { type: GAME_TYPES.TAP_ALL, question: "Which nutrients are most commonly deficient?", options: [
                        { text: "Vitamin D", correct: true },
                        { text: "Vitamin B12", correct: true },
                        { text: "Magnesium", correct: true },
                        { text: "Vitamin C", correct: false },
                        { text: "Iron", correct: true },
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Vitamin _______ is hard to get from food alone, and sunlight is the primary source.", options: ['D', 'C', 'A', 'K'], answer: 'D' },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Vitamin D", right: "Sunlight is primary source" },
                        { left: "B12", right: "Nerve function and energy" },
                        { left: "DHA/EPA", right: "Heart and brain health" },
                        { left: "Iron absorption", right: "Boosted by vitamin C" },
                    ]},
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone feels increasingly fatigued and has tingling in their hands. Blood work reveals very low B12.", question: "What's likely happening?", options: [
                        { text: "They need more protein", correct: false },
                        { text: "B12 deficiency—which can cause nerve damage if untreated", correct: true },
                        { text: "They should eat more carbs", correct: false },
                    ], explanation: "B12 deficiency causes fatigue and neurological symptoms. If caught late, nerve damage can be irreversible. Supplementation or dietary changes are essential." },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Most people get enough Vitamin D from food alone.", answer: false, explanation: "Very few foods contain meaningful Vitamin D. Sunlight exposure is the primary source, and many people need supplements—especially in winter months." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How to boost iron absorption:", items: ["Choose iron-rich foods (red meat, lentils, spinach)", "Pair with vitamin C source", "Avoid tea or coffee with the meal", "Vitamin C dramatically increases absorption", "Meet iron needs effectively"], acceptableOrders: [[0,1,2,3,4],[0,2,1,3,4]]},
                    { type: GAME_TYPES.TAP_ALL, question: "Who is at higher risk of B12 deficiency?", options: [
                        { text: "Older adults", correct: true },
                        { text: "People on acid-reducing medications", correct: true },
                        { text: "People with restricted diets", correct: true },
                        { text: "Athletes eating varied diets", correct: false },
                        { text: "Those with absorption disorders", correct: true },
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Magnesium is involved in over _______ body processes.", options: ['300', '10', '50', '3'], answer: '300' },
                ]
            },
            {
                id: 'fuel-7-3', unitId: 'fuel-7', order: 3, title: "Reading Supplement Labels",
                content: {
                    intro: `Not all supplements are created equal. Here's what to look for:\n\nThird-party testing: Look for USP, NSF, or Informed Sport certifications. These verify what's on the label is actually in the product.\nBioavailability: The form matters. Magnesium citrate absorbs better than magnesium oxide. Methylcobalamin (B12) is preferred over cyanocobalamin.\nDosage: More isn't better. Check the % Daily Value and understand that exceeding 100% DV is rarely beneficial and sometimes harmful.\n\nWatch for red flags: proprietary blends (hiding doses), unrealistic health claims, and missing third-party testing.`,
                    keyPoint: "Look for third-party testing (USP/NSF), bioavailable forms, and appropriate doses. Watch for proprietary blends and unrealistic claims.",
                },
                games: [
                    { type: GAME_TYPES.TAP_ALL, question: "Which are signs of a quality supplement?", options: [
                        { text: "USP or NSF certification", correct: true },
                        { text: "Third-party testing", correct: true },
                        { text: "Proprietary blend", correct: false },
                        { text: "Transparent ingredient list", correct: true },
                        { text: "Unrealistic health claims", correct: false },
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Magnesium _______ absorbs better than magnesium oxide.", options: ['citrate', 'sulfate', 'hydroxide', 'chloride'], answer: 'citrate' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Proprietary blends on supplement labels are a sign of quality and innovation.", answer: false, explanation: "Proprietary blends hide individual ingredient doses. This means you can't verify if you're getting effective amounts of each ingredient." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "USP/NSF", right: "Third-party quality verification" },
                        { left: "Proprietary blend", right: "Red flag—hides doses" },
                        { left: "Bioavailability", right: "How well the body absorbs it" },
                        { left: "Megadosing", right: "Rarely beneficial, sometimes harmful" },
                    ]},
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "You see a supplement with amazing health claims, no third-party testing badge, a 'proprietary blend,' and costs half the price of competitors.", question: "Should you buy it?", options: [
                        { text: "Yes—it's a great deal", correct: false },
                        { text: "No—multiple red flags: no testing, proprietary blend, and unrealistic claims", correct: true },
                        { text: "Maybe—price doesn't matter", correct: false },
                    ], explanation: "No third-party testing means you can't verify contents. Proprietary blends hide doses. Unrealistic claims suggest marketing over science." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How to evaluate a supplement:", items: ["Check for third-party testing (USP/NSF)", "Review the ingredient forms", "Check dosages against Daily Values", "Look for red flags (proprietary blends)", "Research if the claims are evidence-based"], acceptableOrders: [[0,1,2,3,4],[0,3,1,2,4],[0,1,3,2,4],[4,0,1,2,3],[4,0,3,1,2],[0,3,2,1,4],[0,2,1,3,4],[0,2,3,1,4]]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Taking more than 100% Daily Value of a vitamin is always better.", answer: false, explanation: "Exceeding 100% DV is rarely beneficial and can be harmful for fat-soluble vitamins (A, D, E, K) that accumulate in the body." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "_______ vitamins (A, D, E, K) can accumulate in the body and become toxic in excess.", options: ['Fat-soluble', 'Water-soluble', 'All', 'Synthetic'], answer: 'Fat-soluble' },
                ]
            },
            {
                id: 'fuel-7-4', unitId: 'fuel-7', order: 4, title: "Evidence-Based Supplements",
                content: {
                    intro: `Which supplements actually have strong scientific evidence?\n\nStrong evidence: Vitamin D (most people), Creatine (strength and cognition), Omega-3 DHA/EPA (heart and brain health), Vitamin B12 (if deficient).\n\nModerate evidence: Magnesium (if deficient), Zinc (immune function), Protein powder (convenience, not magic).\n\nWeak or no evidence: Most fat burners, detox supplements, testosterone boosters, most nootropics.\n\nThe pattern: supplements that address real deficiencies or provide well-studied compounds work. "Miracle" supplements rarely do.`,
                    keyPoint: "B12, Vitamin D, creatine, and omega-3 have strong evidence. Most marketed 'miracle' supplements have weak or no evidence.",
                },
                games: [
                    { type: GAME_TYPES.TAP_ALL, question: "Which supplements have STRONG scientific evidence?", options: [
                        { text: "Vitamin B12", correct: true },
                        { text: "Creatine", correct: true },
                        { text: "Fat burners", correct: false },
                        { text: "Vitamin D", correct: true },
                        { text: "Detox supplements", correct: false },
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "_______ is one of the most studied supplements with benefits for both strength and cognition.", options: ['Creatine', 'Green tea extract', 'Garcinia', 'CLA'], answer: 'Creatine' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Testosterone booster supplements have strong scientific evidence for increasing testosterone.", answer: false, explanation: "Most over-the-counter testosterone boosters have weak or no evidence. Sleep, exercise, and nutrition have far more impact on testosterone levels." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "B12, Vitamin D", right: "Strong evidence" },
                        { left: "Creatine", right: "Strong evidence for strength & cognition" },
                        { left: "Fat burners", right: "Weak or no evidence" },
                        { left: "Detox supplements", right: "No scientific evidence" },
                    ]},
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "A friend wants to spend $200/month on a stack of supplements: a fat burner, testosterone booster, detox tea, and a nootropic blend. They haven't considered B12 or Vitamin D.", question: "What advice would you give?", options: [
                        { text: "Sounds like a solid supplement plan", correct: false },
                        { text: "Skip the unproven supplements and invest in B12, Vitamin D, and whole foods first", correct: true },
                        { text: "Add more supplements to the stack", correct: false },
                    ], explanation: "The expensive stack has little evidence. B12 and Vitamin D are cheap, well-studied, and address common deficiencies. Food quality matters more than any supplement." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Rank these by strength of scientific evidence (strongest first):", items: ["Vitamin D for most people", "Creatine for strength and cognition", "Magnesium if deficient", "Protein powder for convenience", "Fat burners for weight loss"], acceptableOrders: [[0,1,2,3,4],[1,0,2,3,4],[0,1,3,2,4],[1,0,3,2,4]]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Protein powder is a magic muscle builder that everyone needs.", answer: false, explanation: "Protein powder is just a convenient way to hit protein targets. It's not magic—whole food protein works just as well." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Supplements that address real _______ or provide well-studied compounds are the ones that work.", options: ['deficiencies', 'desires', 'trends', 'brands'], answer: 'deficiencies' },
                ]
            },
            {
                id: 'fuel-7-5', unitId: 'fuel-7', order: 5, title: "Building Your Supplement Strategy",
                content: {
                    intro: `Here's how to build a smart, personalized supplement plan:\n\n1. Get blood work done to identify actual deficiencies.\n2. Prioritize food-based solutions first.\n3. Add evidence-based supplements for confirmed gaps.\n4. Choose quality brands with third-party testing.\n5. Reassess periodically—your needs change with seasons, diet, and life stage.\n\nFor most active people, a basic stack might be: Vitamin D (especially in winter), omega-3 if not eating fatty fish regularly, and creatine for performance. Everything else depends on individual testing.`,
                    keyPoint: "Test, don't guess. Get blood work, prioritize food, then supplement confirmed gaps with quality, evidence-based products.",
                },
                games: [
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Steps to build a smart supplement plan:", items: ["Get blood work to identify deficiencies", "Prioritize food-based solutions first", "Add evidence-based supplements for gaps", "Choose brands with third-party testing", "Reassess periodically"]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "The principle is: _______, don't guess.", options: ['test', 'hope', 'buy', 'stack'], answer: 'test' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "You should take the same supplements year-round without ever reassessing.", answer: false, explanation: "Needs change with seasons (Vitamin D in winter), diet changes, age, and life stage. Periodic blood work helps you adjust." },
                    { type: GAME_TYPES.TAP_ALL, question: "What's commonly recommended for most active people?", options: [
                        { text: "Vitamin D", correct: true },
                        { text: "Omega-3 (if not eating fatty fish)", correct: true },
                        { text: "Creatine", correct: true },
                        { text: "Fat burner", correct: false },
                        { text: "Testosterone booster", correct: false },
                    ]},
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "You want to start supplementing but haven't had any blood work done. You're tempted to just buy a popular 'all-in-one' mega supplement.", question: "What's the better approach?", options: [
                        { text: "Buy the all-in-one—it covers everything", correct: false },
                        { text: "Get blood work first to know what you actually need, then supplement specifically", correct: true },
                        { text: "Skip supplements entirely", correct: false },
                    ], explanation: "Without testing, you're guessing. Blood work reveals actual deficiencies so you can target what you need and avoid wasting money or risking excess." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Blood work", right: "Identifies actual deficiencies" },
                        { left: "Food first", right: "Prioritize whole food solutions" },
                        { left: "Third-party testing", right: "Ensures supplement quality" },
                        { left: "Periodic reassessment", right: "Needs change over time" },
                    ]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Vitamin D, omega-3, and creatine are a solid evidence-based starting stack for most active people.", answer: true, explanation: "These three have strong scientific evidence and address common gaps. Everything else should be based on individual blood work and needs." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Your supplement needs change with seasons, diet, and life _______.", options: ['stage', 'goals', 'partner', 'style'], answer: 'stage' },
                ]
            },
        ],
        'fuel-8': [
            {
                id: 'fuel-8-1', unitId: 'fuel-8', order: 1, title: "Vitamin Myth Busters",
                content: {
                    intro: `Time to bust some vitamin myths!\n\nMyth: "Vitamin C cures colds." Reality: It may slightly reduce duration but doesn't prevent them.\nMyth: "More vitamins = better health." Reality: Excess water-soluble vitamins are just excreted. Excess fat-soluble vitamins can be toxic.\nMyth: "Natural supplements are always safer." Reality: Natural doesn't mean safe. Dosage and quality matter more than source.\n\nLet's test your ability to separate vitamin facts from fiction.`,
                    keyPoint: "Many vitamin beliefs are myths. Vitamin C doesn't cure colds, more isn't always better, and 'natural' doesn't mean safe.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Vitamin C cures the common cold.", answer: false, explanation: "Vitamin C may slightly reduce cold duration if taken regularly, but it doesn't prevent or cure colds. This is one of the most persistent nutrition myths." },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Excess water-soluble vitamins (B, C) are mostly just excreted by the body.", answer: true, explanation: "Your body doesn't store most water-soluble vitamins. Excess is excreted in urine—you're literally flushing money away with megadoses." },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "All 'natural' supplements are automatically safer than synthetic ones.", answer: false, explanation: "Natural doesn't equal safe. Arsenic is natural. What matters is dosage, quality, and third-party verification—not whether something comes from a plant." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Excess fat-soluble vitamins (A, D, E, K) can be _______ because they accumulate in body tissue.", options: ['toxic', 'helpful', 'neutral', 'energizing'], answer: 'toxic' },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Vitamin C and colds", right: "Slightly reduces duration, not a cure" },
                        { left: "Megadose vitamins", right: "Excess is excreted or harmful" },
                        { left: "'Natural' supplements", right: "Not automatically safer" },
                        { left: "Fat-soluble vitamins", right: "Can accumulate and become toxic" },
                    ]},
                    { type: GAME_TYPES.TAP_ALL, question: "Which statements are MYTHS?", options: [
                        { text: "Vitamin C cures colds", correct: true },
                        { text: "More vitamins always means better health", correct: true },
                        { text: "Fat-soluble vitamins can accumulate", correct: false },
                        { text: "Natural always means safe", correct: true },
                        { text: "B12 deficiency causes nerve damage", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "From most to least important for supplement safety:", items: ["Third-party testing and certification", "Appropriate dosage for your needs", "Bioavailable form of the nutrient", "Brand reputation", "Whether it's 'natural' or synthetic"], acceptableOrders: [[0,1,2,3,4],[1,0,2,3,4],[0,1,3,2,4],[1,0,3,2,4]]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Taking 10x the recommended dose of Vitamin E is a good preventive strategy.", answer: false, explanation: "High-dose Vitamin E supplementation has been linked to increased health risks. More is definitely not better with fat-soluble vitamins." },
                ]
            },
            {
                id: 'fuel-8-2', unitId: 'fuel-8', order: 2, title: "Match the Nutrient to the Source",
                content: {
                    intro: `Can you match vitamins and minerals to their best food sources?\n\nKnowing where nutrients come from helps you eat strategically without relying heavily on supplements.\n\nExamples: Iron comes from red meat, lentils, and spinach. Calcium from dairy, sardines, and leafy greens. Omega-3 from salmon, mackerel, and walnuts. B12 from meat, eggs, and dairy.\n\nThe more diverse your plate, the fewer supplements you need.`,
                    keyPoint: "Knowing food sources for key nutrients reduces supplement dependence. Diversity on your plate = diversity in your nutrients.",
                },
                games: [
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Iron", right: "Red meat, lentils, and spinach" },
                        { left: "Calcium", right: "Dairy, sardines, and leafy greens" },
                        { left: "Zinc", right: "Oysters, beef, and pumpkin seeds" },
                        { left: "Omega-3", right: "Salmon, mackerel, and walnuts" },
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "_______ is one of the richest food sources of iron.", options: ['Red meat', 'Bananas', 'Apples', 'Rice'], answer: 'Red meat' },
                    { type: GAME_TYPES.TAP_ALL, question: "Which are good calcium sources?", options: [
                        { text: "Dairy products", correct: true },
                        { text: "Sardines with bones", correct: true },
                        { text: "Broccoli and kale", correct: true },
                        { text: "White bread", correct: false },
                        { text: "Fortified orange juice", correct: true },
                    ]},
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "B12", right: "Meat, eggs, and dairy" },
                        { left: "Vitamin C", right: "Bell peppers and citrus" },
                        { left: "Vitamin K", right: "Dark leafy greens" },
                        { left: "Iodine", right: "Seafood and iodized salt" },
                    ]},
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "You want to increase your iron intake naturally. You make a steak and spinach dinner.", question: "What should you add to boost iron absorption?", options: [
                        { text: "A cup of coffee", correct: false },
                        { text: "A squeeze of lemon or some bell peppers (vitamin C)", correct: true },
                        { text: "More bread", correct: false },
                    ], explanation: "Vitamin C dramatically increases iron absorption. Coffee and tea contain tannins that inhibit iron absorption—save them for between meals." },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Fatty fish like salmon is one of the best food sources of omega-3.", answer: true, explanation: "Fatty fish (salmon, mackerel, sardines) are the richest dietary sources of DHA and EPA omega-3 fatty acids." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Top dietary iron sources (highest to lowest):", items: ["Organ meats and red meat", "Shellfish (oysters, clams)", "Lentils and beans", "Spinach and dark greens", "Fortified cereals"], acceptableOrders: [[0,1,2,3,4],[1,0,2,3,4]]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "The more _______ your plate, the fewer supplements you need.", options: ['diverse', 'expensive', 'bland', 'restricted'], answer: 'diverse' },
                ]
            },
            {
                id: 'fuel-8-3', unitId: 'fuel-8', order: 3, title: "Spot the Scam",
                content: {
                    intro: `The supplement industry is full of misleading marketing. Can you spot the red flags?\n\nCommon scam signals:\n- "Clinically proven" without citing actual studies\n- Before/after photos (often fake or misleading)\n- "Proprietary blend" (hides actual ingredient amounts)\n- "Detox" or "cleanse" claims (your liver and kidneys already do this)\n- Celebrity endorsements instead of scientific evidence\n\nYour best defense: critical thinking and checking for third-party verification.`,
                    keyPoint: "Learn to spot supplement scams: vague 'clinical proof,' proprietary blends, detox claims, and reliance on testimonials over evidence.",
                },
                games: [
                    { type: GAME_TYPES.TAP_ALL, question: "Which are red flags on a supplement label?", options: [
                        { text: "Proprietary blend", correct: true },
                        { text: "USP verified", correct: false },
                        { text: "'Clinically proven' with no study cited", correct: true },
                        { text: "'Detox' or 'cleanse' claims", correct: true },
                        { text: "Transparent ingredient list", correct: false },
                    ]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Your body needs special supplements to 'detox' and 'cleanse.'", answer: false, explanation: "Your liver, kidneys, and lymphatic system detoxify your body naturally. 'Detox' supplements are marketing, not science." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "A '_______ blend' hides individual ingredient amounts, which is a red flag.", options: ['proprietary', 'premium', 'organic', 'natural'], answer: 'proprietary' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "An Instagram influencer promotes a 'fat-melting detox tea' with dramatic before/after photos. It has a proprietary blend and no third-party testing.", question: "How many red flags can you count?", options: [
                        { text: "None—influencers are trustworthy", correct: false },
                        { text: "Multiple: detox claim, before/after photos, proprietary blend, no testing, influencer marketing", correct: true },
                        { text: "Just one—the proprietary blend", correct: false },
                    ], explanation: "This product hits nearly every red flag: unproven claims, misleading photos, hidden ingredients, no verification, and paid endorsement instead of evidence." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "'Clinically proven'", right: "Often lacks actual cited studies" },
                        { left: "Before/after photos", right: "Often misleading or fake" },
                        { left: "Celebrity endorsement", right: "Marketing, not evidence" },
                        { left: "Third-party testing", right: "Actual quality verification" },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How to evaluate a supplement claim:", items: ["Read the specific claims being made", "Look for cited scientific studies", "Check for third-party testing badges", "Search for independent reviews", "Be skeptical of 'too good to be true' promises"], acceptableOrders: [[0,1,2,3,4],[0,2,1,3,4],[0,1,3,2,4],[0,2,3,1,4],[0,3,1,2,4],[0,3,2,1,4]]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "If a supplement has great customer reviews on the company's website, that's strong evidence it works.", answer: false, explanation: "Company-hosted reviews can be curated, fake, or biased. Independent scientific evidence matters far more than testimonials." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Your _______ and kidneys already detoxify your body naturally.", options: ['liver', 'muscles', 'bones', 'skin'], answer: 'liver' },
                ]
            },
            {
                id: 'fuel-8-4', unitId: 'fuel-8', order: 4, title: "Timing and Stacking Challenge",
                content: {
                    intro: `When and how you take supplements matters for absorption:\n\nFat-soluble vitamins (A, D, E, K): Take with a meal containing fat for better absorption.\nIron: Take on an empty stomach with vitamin C. Avoid taking with calcium, coffee, or tea.\nCalcium: Split doses (body absorbs ~500mg at a time). Don't take with iron.\nB12: Can be taken anytime—it's water-soluble.\nMagnesium: Evening is popular as it may support sleep.\n\nSome nutrients compete for absorption, so spacing matters.`,
                    keyPoint: "Timing matters: fat-soluble vitamins with meals, iron with vitamin C on empty stomach, calcium in split doses, and avoid competing nutrients together.",
                },
                games: [
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Vitamin D", right: "Take with a meal containing fat" },
                        { left: "Iron", right: "Empty stomach with vitamin C" },
                        { left: "Calcium", right: "Split into smaller doses" },
                        { left: "Magnesium", right: "Evening for sleep support" },
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Fat-soluble vitamins should be taken with a meal containing _______ for better absorption.", options: ['fat', 'fiber', 'sugar', 'water'], answer: 'fat' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Iron and calcium should be taken at the same time for best absorption.", answer: false, explanation: "Calcium competes with iron for absorption. Take them at different times of day for best results." },
                    { type: GAME_TYPES.TAP_ALL, question: "What reduces iron absorption?", options: [
                        { text: "Coffee", correct: true },
                        { text: "Tea", correct: true },
                        { text: "Calcium supplements", correct: true },
                        { text: "Vitamin C", correct: false },
                        { text: "Citrus fruits", correct: false },
                    ]},
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone takes their iron supplement with a cup of coffee and a calcium tablet every morning.", question: "What should they change?", options: [
                        { text: "Nothing—this is fine", correct: false },
                        { text: "Take iron separately with vitamin C, away from coffee and calcium", correct: true },
                        { text: "Take more iron to compensate", correct: false },
                    ], explanation: "Coffee and calcium both inhibit iron absorption. Iron should be taken on an empty stomach with vitamin C, spaced apart from calcium and coffee." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Best morning supplement routine:", items: ["Iron with vitamin C on empty stomach", "Wait 30-60 minutes", "Breakfast with fat-soluble vitamins (D, K)", "Calcium with a later meal", "Magnesium in the evening"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Your body can absorb unlimited calcium at once, so take it all in one large dose.", answer: false, explanation: "Your body absorbs about 500mg of calcium at a time. Split larger doses throughout the day for better absorption." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Iron should be taken on an empty stomach paired with vitamin _______ for best absorption.", options: ['C', 'D', 'K', 'E'], answer: 'C' },
                ]
            },
            {
                id: 'fuel-8-5', unitId: 'fuel-8', order: 5, title: "Build Your Perfect Stack",
                content: {
                    intro: `Final challenge: put it all together and build the ideal supplement strategy for different scenarios.\n\nActive athlete: Vitamin D + Creatine + Omega-3 (if not eating fish) + Iron (if tested low)\nWinter months: Add or increase Vitamin D\nStress and sleep issues: Consider magnesium glycinate\nPregnancy: Prenatal with folate, iron, DHA, and B12\n\nRemember: test, don't guess. Personalize based on blood work. Quality over quantity. Food always comes first.`,
                    keyPoint: "Build your stack based on your specific needs, diet, and test results. An athlete's stack differs from a general wellness stack.",
                },
                games: [
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "An athlete trains 5 days a week and lives in a northern climate. Blood work shows low Vitamin D and they want to optimize performance.", question: "What stack would you recommend?", options: [
                        { text: "Fat burner and testosterone booster", correct: false },
                        { text: "Vitamin D, creatine, omega-3, and magnesium", correct: true },
                        { text: "Just a multivitamin", correct: false },
                    ], explanation: "This covers the confirmed deficiency (D), adds well-evidenced performance supplements (creatine, omega-3), and magnesium supports recovery." },
                    { type: GAME_TYPES.TAP_ALL, question: "What belongs in a solid evidence-based supplement stack?", options: [
                        { text: "Vitamin D", correct: true },
                        { text: "Creatine", correct: true },
                        { text: "Omega-3", correct: true },
                        { text: "Detox tea", correct: false },
                        { text: "Fat burner", correct: false },
                    ]},
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Active athlete", right: "D + Creatine + Omega-3" },
                        { left: "Winter months", right: "Increase Vitamin D" },
                        { left: "Sleep issues", right: "Consider magnesium glycinate" },
                        { left: "Everyone", right: "Test, don't guess" },
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "For sleep support, _______ glycinate is a form of magnesium often recommended.", options: ['magnesium', 'calcium', 'zinc', 'iron'], answer: 'magnesium' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "A generic multivitamin is always the best approach to supplementation.", answer: false, explanation: "Multivitamins often contain low doses of many nutrients, some you don't need. Targeted supplementation based on testing is more effective." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "The supplement strategy hierarchy:", items: ["Eat a varied whole food diet first", "Get blood work to identify gaps", "Add targeted evidence-based supplements", "Choose quality brands with testing", "Reassess as needs change"]},
                    { type: GAME_TYPES.TAP_ALL, question: "Key principles of smart supplementation:", options: [
                        { text: "Test don't guess", correct: true },
                        { text: "Food comes first", correct: true },
                        { text: "More supplements = better", correct: false },
                        { text: "Quality over quantity", correct: true },
                        { text: "Personalize based on blood work", correct: true },
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Remember: _______ always comes first before any supplement.", options: ['food', 'price', 'branding', 'flavor'], answer: 'food' },
                ]
            },
        ],
        'longevity-1': [
  {
    id: 'longevity-1-1',
    unitId: 'longevity-1',
    order: 1,
    title: "The Hallmarks of Aging",
    content: {
      intro: `Scientists have identified nine biological "hallmarks" that drive aging at the cellular level. Understanding these gives us targets for intervention.

The hallmarks include: genomic instability (DNA damage accumulates), telomere attrition (protective chromosome caps shorten), epigenetic alterations (gene expression patterns drift), loss of proteostasis (protein quality control fails), deregulated nutrient sensing (cells respond poorly to nutrients), mitochondrial dysfunction (energy production declines), cellular senescence (damaged cells accumulate), stem cell exhaustion (regenerative capacity drops), and altered intercellular communication (cells miscommunicate).

Here's what's remarkable: These hallmarks are interconnected. Addressing one often improves others. And many are influenced by lifestyle factors—meaning they're not purely genetic destiny.

Research on centenarians shows they often have slower rates of these aging processes. The goal isn't to stop aging entirely, but to slow these processes and extend "healthspan"—the years you live in good health.`,
      keyPoint: "Aging has identifiable biological causes that can be influenced through lifestyle choices.",
    },
    games: [
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Which are recognized hallmarks of aging?",
        options: [
          { text: "DNA damage accumulation", correct: true },
          { text: "Telomere shortening", correct: true },
          { text: "Mitochondrial dysfunction", correct: true },
          { text: "Increased muscle mass", correct: false },
          { text: "Cellular senescence", correct: true },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Aging is purely determined by genetics and cannot be influenced.",
        answer: false,
        explanation: "While genetics play a role, lifestyle factors significantly influence the rate at which aging hallmarks progress.",
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Telomeres", right: "Protective chromosome caps" },
          { left: "Mitochondria", right: "Energy production" },
          { left: "Senescent cells", right: "Damaged cells that accumulate" },
          { left: "Stem cells", right: "Regenerative capacity" },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "The goal of longevity science is to extend _______ - the years lived in good health.",
        options: ['healthspan', 'lifespan', 'metabolism', 'youth'],
        answer: 'healthspan',
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "A 70-year-old who exercises regularly, eats well, and sleeps 8 hours has the biological markers of someone 15 years younger.",
        question: "What does this demonstrate?",
        options: [
          { text: "They have lucky genetics", correct: false },
          { text: "Lifestyle choices can slow the biological aging process", correct: true },
          { text: "Age testing is inaccurate", correct: false },
        ],
        explanation: "Biological age (how old your cells act) can differ significantly from chronological age based on lifestyle factors.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order this aging cascade from the microscopic start to the visible outcome:",
        items: [
          "DNA damage accumulates at the cellular level",
          "Cells with damaged DNA become dysfunctional",
          "Tissue repair slows because cells can't divide properly",
          "Organ function declines as damaged tissue accumulates",
          "Disease risk increases as organs can no longer compensate",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Centenarians typically show slower rates of the hallmarks of aging.",
        answer: true,
        explanation: "Research shows that people who live past 100 often have biological markers that age more slowly than average.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What makes the hallmarks of aging significant for longevity science?",
        options: [
          { text: "They are interconnected—improving one often helps others", correct: true },
          { text: "Many can be influenced by lifestyle", correct: true },
          { text: "They provide targets for intervention", correct: true },
          { text: "They are completely unchangeable", correct: false },
        ],
      },
    ],
  },
  {
    id: 'longevity-1-2',
    unitId: 'longevity-1',
    order: 2,
    title: "Telomeres: Your Cellular Clock",
    content: {
      intro: `At the end of each chromosome sits a protective cap called a telomere—like the plastic tips on shoelaces. Every time a cell divides, telomeres get slightly shorter. When they get too short, the cell can no longer divide safely and either dies or becomes senescent.

This is one reason we age: Our cells literally run out of division capacity. By age 60, many cells have significantly shorter telomeres than at 20.

But here's what's fascinating: Telomere length isn't fixed by age alone. Studies show that chronic stress, poor sleep, smoking, and sedentary behavior accelerate telomere shortening. Meanwhile, regular exercise, meditation, social connection, and healthy diet have been shown to slow—and in some cases partially reverse—telomere shortening.

The enzyme telomerase can actually rebuild telomeres. While we can't take telomerase as a pill (it's complicated—too much could increase cancer risk), lifestyle factors that reduce cellular stress help preserve telomere length naturally.

Your biological age at the cellular level is partially within your control.`,
      keyPoint: "Telomeres shorten with age but lifestyle factors significantly influence the rate of decline.",
    },
    games: [
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Telomeres are protective caps at the ends of _______ that shorten with each cell division.",
        options: ['chromosomes', 'proteins', 'mitochondria', 'neurons'],
        answer: 'chromosomes',
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Chronic stress", right: "Accelerates telomere shortening" },
          { left: "Regular exercise", right: "Slows telomere shortening" },
          { left: "Telomerase", right: "Enzyme that rebuilds telomeres" },
          { left: "Very short telomeres", right: "Cell death or senescence" },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Telomere length is entirely determined by your chronological age.",
        answer: false,
        explanation: "Lifestyle factors like stress, exercise, sleep, and diet significantly affect telomere length independent of age.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Which behaviors accelerate telomere shortening?",
        options: [
          { text: "Chronic psychological stress", correct: true },
          { text: "Regular exercise", correct: false },
          { text: "Smoking", correct: true },
          { text: "Sedentary lifestyle", correct: true },
          { text: "Adequate sleep", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Two 50-year-old twins are tested. One has been sedentary and stressed; the other exercises regularly and practices meditation. Their telomere lengths differ significantly.",
        question: "What explains this difference?",
        options: [
          { text: "Measurement error—twins should be identical", correct: false },
          { text: "Lifestyle choices affect telomere length independent of genetics", correct: true },
          { text: "One twin is actually older", correct: false },
        ],
        explanation: "Even with identical genetics, lifestyle factors can cause significant differences in biological aging markers.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order from healthy cells to declining tissue: What happens as telomeres get shorter over time?",
        items: [
          "Young cells divide normally — their telomeres are long",
          "Each cell division makes the telomeres slightly shorter",
          "Eventually telomeres reach a critically short length, triggering alarms",
          "The cell stops dividing entirely or becomes 'senescent' (zombie-like)",
          "The tissue's ability to regenerate and repair declines",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Some lifestyle changes have been shown to partially reverse telomere shortening.",
        answer: true,
        explanation: "Research has shown that comprehensive lifestyle changes including diet, exercise, stress management, and social support can increase telomere length over time.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Your _______ age at the cellular level can differ from your chronological age.",
        options: ['biological', 'mental', 'emotional', 'physical'],
        answer: 'biological',
      },
    ],
  },
  {
    id: 'longevity-1-3',
    unitId: 'longevity-1',
    order: 3,
    title: "Inflammation: The Silent Accelerator",
    content: {
      intro: `Acute inflammation is essential—it's how your body heals wounds and fights infections. But chronic, low-grade inflammation is one of the biggest drivers of aging and disease.

Scientists call this "inflammaging"—the persistent, low-level inflammation that increases with age. It's linked to virtually every age-related disease: heart disease, cancer, Alzheimer's, diabetes, and more.

What causes chronic inflammation? Visceral fat (belly fat) constantly secretes inflammatory molecules. A damaged gut microbiome triggers immune responses. Chronic stress keeps inflammatory pathways activated. Senescent "zombie" cells pump out inflammatory signals. Poor sleep disrupts immune regulation.

The good news: Anti-inflammatory lifestyle choices are powerful. Plant-rich diets reduce inflammatory markers. Regular exercise is powerfully anti-inflammatory. Adequate sleep allows immune system regulation. Stress management calms inflammatory pathways. Maintaining healthy weight reduces visceral fat.

The Mediterranean diet, regular physical activity, and stress management all share a common mechanism: They reduce chronic inflammation. This is likely why they all extend healthy lifespan.`,
      keyPoint: "Chronic low-grade inflammation accelerates aging and disease, but lifestyle choices can significantly reduce it.",
    },
    games: [
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Acute inflammation", right: "Necessary for healing" },
          { left: "Chronic inflammation", right: "Drives aging and disease" },
          { left: "Inflammaging", right: "Age-related persistent inflammation" },
          { left: "Visceral fat", right: "Secretes inflammatory molecules" },
        ],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Which conditions are linked to chronic inflammation?",
        options: [
          { text: "Heart disease", correct: true },
          { text: "Alzheimer's disease", correct: true },
          { text: "Type 2 diabetes", correct: true },
          { text: "Cancer", correct: true },
          { text: "None—inflammation is always helpful", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "All inflammation is harmful and should be suppressed.",
        answer: false,
        explanation: "Acute inflammation is essential for healing. It's chronic, low-grade inflammation that causes problems.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Scientists use the term '________' to describe age-related persistent low-grade inflammation.",
        options: ['inflammaging', 'immunoaging', 'cytoaging', 'metaaging'],
        answer: 'inflammaging',
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What lifestyle factors reduce chronic inflammation?",
        options: [
          { text: "Plant-rich diet", correct: true },
          { text: "Regular exercise", correct: true },
          { text: "Chronic stress", correct: false },
          { text: "Adequate sleep", correct: true },
          { text: "Sedentary behavior", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "A person with high inflammatory markers switches to a Mediterranean diet, starts walking daily, and begins a meditation practice. After 6 months, their inflammatory markers are significantly lower.",
        question: "Why did these changes work?",
        options: [
          { text: "Placebo effect", correct: false },
          { text: "Each intervention reduces chronic inflammation through proven mechanisms", correct: true },
          { text: "Random fluctuation in test results", correct: false },
        ],
        explanation: "Diet, exercise, and stress management all have evidence-based mechanisms for reducing chronic inflammation.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order from belly fat to disease: How does visceral fat accelerate aging?",
        items: [
          "Excess visceral fat (deep belly fat) accumulates around organs",
          "Those fat cells actively secrete inflammatory molecules into the bloodstream",
          "Chronic, low-grade inflammation develops throughout the body",
          "Tissues and organs experience ongoing damage from the inflammation",
          "Over time, age-related diseases develop (heart disease, diabetes, cancer)",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "The Mediterranean diet, exercise, and stress management may all extend healthspan through the common mechanism of reducing inflammation.",
        answer: true,
        explanation: "Reducing chronic inflammation is a shared mechanism through which many longevity interventions work.",
      },
    ],
  },
  {
    id: 'longevity-1-4',
    unitId: 'longevity-1',
    order: 4,
    title: "Senescent Cells: The Zombie Problem",
    content: {
      intro: `When cells become too damaged to function properly, they should die through a process called apoptosis. But sometimes they don't die—they enter a "zombie" state called senescence.

Senescent cells are alive but dysfunctional. Worse, they actively harm surrounding tissue by secreting inflammatory molecules, enzymes that break down tissue, and signals that can turn nearby cells senescent too.

Young bodies efficiently clear senescent cells. But as we age, they accumulate—in skin, joints, organs, and blood vessels. This accumulation is increasingly recognized as a major driver of aging.

Research in mice has shown remarkable results: Clearing senescent cells extends healthy lifespan, reduces age-related diseases, and even reverses some aging symptoms. "Senolytics"—drugs that selectively kill senescent cells—are now in human trials.

While we wait for senolytic drugs, lifestyle factors matter: Exercise helps clear senescent cells. Fasting triggers cellular cleanup. Certain plant compounds like quercetin and fisetin show senolytic properties. Reducing chronic stress prevents premature senescence.

The accumulation of zombie cells isn't inevitable—it can be influenced.`,
      keyPoint: "Senescent 'zombie' cells accumulate with age and actively damage tissue, but lifestyle factors can help clear them.",
    },
    games: [
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Senescent cells are sometimes called '_______ cells' because they're alive but no longer functioning properly.",
        options: ['zombie', 'ghost', 'sleeping', 'dead'],
        answer: 'zombie',
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What do senescent cells do that makes them harmful?",
        options: [
          { text: "Secrete inflammatory molecules", correct: true },
          { text: "Release tissue-damaging enzymes", correct: true },
          { text: "Trigger senescence in nearby cells", correct: true },
          { text: "Efficiently repair surrounding tissue", correct: false },
          { text: "Die quickly through apoptosis", correct: false },
        ],
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Apoptosis", right: "Programmed cell death" },
          { left: "Senescence", right: "Zombie state—alive but dysfunctional" },
          { left: "Senolytics", right: "Drugs that clear senescent cells" },
          { left: "Young immune system", right: "Efficiently clears senescent cells" },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Clearing senescent cells in mice has been shown to extend healthy lifespan.",
        answer: true,
        explanation: "Research demonstrates that removing senescent cells in mice extends lifespan and reduces age-related disease.",
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Researchers genetically modify mice to clear senescent cells when given a drug. These mice live longer and have fewer age-related problems than normal mice.",
        question: "What does this suggest about human aging?",
        options: [
          { text: "Human aging works completely differently", correct: false },
          { text: "Senescent cell accumulation may be a targetable cause of aging in humans too", correct: true },
          { text: "Genetics is the only factor in aging", correct: false },
        ],
        explanation: "While human biology is more complex, this research suggests senescent cells are a promising target for human longevity interventions.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Which lifestyle factors may help clear or prevent senescent cells?",
        options: [
          { text: "Regular exercise", correct: true },
          { text: "Periodic fasting", correct: true },
          { text: "Chronic stress", correct: false },
          { text: "Sedentary lifestyle", correct: false },
          { text: "Plant compounds like quercetin", correct: true },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order from the initial damage to the cascade: How do 'zombie cells' (senescent cells) accelerate aging?",
        items: [
          "A cell sustains damage (from stress, toxins, or normal wear)",
          "Instead of dying cleanly, the damaged cell enters senescence — it becomes a 'zombie'",
          "The zombie cell starts secreting harmful inflammatory molecules into its surroundings",
          "Those molecules damage the surrounding healthy tissue",
          "The damage causes MORE cells to become senescent — creating a harmful cascade",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "_______ bodies efficiently clear senescent cells, but this ability declines with age.",
        options: ['Young', 'Unhealthy', 'Sedentary', 'Stressed'],
        answer: 'Young',
      },
    ],
  },
  {
    id: 'longevity-1-5',
    unitId: 'longevity-1',
    order: 5,
    title: "Biological vs. Chronological Age",
    content: {
      intro: `Your chronological age is how many years you've been alive. Your biological age is how old your cells and systems actually function.

These can differ dramatically. A hard-living 40-year-old might have the biological age of 55. A healthy 60-year-old might have the biological age of 45. The difference predicts health outcomes far better than calendar age.

How is biological age measured? Epigenetic clocks analyze DNA methylation patterns—chemical markers that change predictably with aging. Other markers include telomere length, inflammatory markers, metabolic function, and physical performance measures.

What influences biological age? Exercise consistently lowers biological age. Plant-rich diets slow epigenetic aging. Quality sleep is essential for cellular repair. Chronic stress accelerates biological aging. Social connection is associated with slower aging. Purpose and engagement matter for longevity.

The empowering truth: While you can't change your birthday, you can significantly influence your biological age. People who adopt healthy lifestyles often test younger than their years. Those who neglect their health often test older.

Your choices today affect your biological age tomorrow.`,
      keyPoint: "Biological age—how old your cells function—can be significantly influenced by lifestyle and differs from chronological age.",
    },
    games: [
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Chronological age", right: "Years since birth" },
          { left: "Biological age", right: "How old cells function" },
          { left: "Epigenetic clocks", right: "Measure DNA methylation patterns" },
          { left: "Healthy lifestyle", right: "Lower biological age" },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "A 50-year-old cannot have the biological age of a 40-year-old.",
        answer: false,
        explanation: "Biological age can differ significantly from chronological age based on lifestyle factors.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What factors lower biological age?",
        options: [
          { text: "Regular exercise", correct: true },
          { text: "Plant-rich diet", correct: true },
          { text: "Quality sleep", correct: true },
          { text: "Chronic stress", correct: false },
          { text: "Social connection", correct: true },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "_______ age predicts health outcomes better than how many birthdays you've had.",
        options: ['Biological', 'Mental', 'Calendar', 'Chronological'],
        answer: 'Biological',
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Two people are both 55 years old. Person A exercises daily, eats well, sleeps 8 hours, and has strong relationships. Person B is sedentary, eats poorly, sleeps 5 hours, and is socially isolated. Their biological age tests show a 15-year difference.",
        question: "What explains this gap?",
        options: [
          { text: "Different genetics", correct: false },
          { text: "Lifestyle factors significantly affect biological aging", correct: true },
          { text: "Test inaccuracy", correct: false },
        ],
        explanation: "Lifestyle choices compound over time to create significant differences in biological age.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "How can biological age be measured?",
        options: [
          { text: "Epigenetic clock analysis", correct: true },
          { text: "Telomere length", correct: true },
          { text: "Inflammatory markers", correct: true },
          { text: "Birth certificate", correct: false },
          { text: "Physical performance tests", correct: true },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order from daily choices to long-term outcomes: How does lifestyle affect biological age?",
        items: [
          "Your daily choices (diet, exercise, sleep, stress) compound over months and years",
          "Those choices directly affect cellular processes (repair, inflammation, metabolism)",
          "Over time, your epigenetic patterns (DNA markers) change to reflect your lifestyle",
          "Your biological age starts to diverge from your chronological age",
          "Those biological age differences ultimately determine your health outcomes",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Purpose, social connection, and engagement are associated with slower biological aging.",
        answer: true,
        explanation: "Research shows that psychosocial factors like purpose, relationships, and engagement correlate with slower biological aging.",
      },
    ],
  },
        ],
        'longevity-2': [
  {
    id: 'longevity-2-1',
    unitId: 'longevity-2',
    order: 1,
    title: "Blood Sugar: The Hidden Crisis",
    content: {
      intro: `Most people think blood sugar is only a concern for diabetics. This is dangerously wrong.

Blood sugar dysregulation is a spectrum. Long before diabetes diagnosis, years of elevated blood sugar cause damage—to blood vessels, nerves, brain, and organs. An estimated 88% of American adults have some degree of metabolic dysfunction.

Here's what happens when blood sugar spikes: Your pancreas releases insulin. Cells absorb glucose. Blood sugar drops. If spikes are frequent, cells become resistant to insulin's signal. Pancreas works harder. Eventually, the system fails—this is Type 2 diabetes.

But the damage starts decades earlier. Elevated post-meal glucose, even in "normal" range, accelerates aging through: Glycation—glucose binds to proteins and damages them. Oxidative stress—excess glucose generates free radicals. Inflammation—blood sugar spikes trigger inflammatory responses. Blood vessel damage—the lining of arteries is harmed.

The good news: Blood sugar control is largely within your power. What you eat, when you eat, how you move, and how you sleep all profoundly affect your glucose response.`,
      keyPoint: "Blood sugar dysregulation causes damage long before diabetes and affects most adults, but it's highly modifiable through lifestyle.",
    },
    games: [
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Blood sugar problems only matter if you have diabetes.",
        answer: false,
        explanation: "Blood sugar dysregulation causes damage for years before diabetes diagnosis. Most adults have some degree of metabolic dysfunction.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "An estimated ___% of American adults have some degree of metabolic dysfunction.",
        options: ['88', '50', '25', '10'],
        answer: '88',
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Frequent glucose spikes", right: "Cells become insulin resistant" },
          { left: "Glycation", right: "Glucose damages proteins" },
          { left: "Insulin resistance", right: "Pancreas works harder" },
          { left: "Type 2 diabetes", right: "System eventually fails" },
        ],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "How does elevated blood sugar cause damage?",
        options: [
          { text: "Glycation—glucose binds and damages proteins", correct: true },
          { text: "Oxidative stress from free radicals", correct: true },
          { text: "Inflammatory responses", correct: true },
          { text: "Blood vessel lining damage", correct: true },
          { text: "It doesn't cause damage until diabetes", correct: false },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order from the initial problem to the final breakdown: How does insulin resistance develop?",
        items: [
          "Frequent blood sugar spikes occur (from refined carbs, sugary foods)",
          "Pancreas repeatedly floods the body with insulin to bring sugar down",
          "Over time, cells become less responsive to insulin's signal (like ignoring a car alarm)",
          "Pancreas works even harder, producing more and more insulin to compensate",
          "Eventually the pancreas can't keep up — blood sugar rises = Type 2 diabetes",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "A person's fasting blood sugar is 95—technically 'normal.' But after eating refined carbs, their glucose spikes to 180 before crashing. They feel tired and hungry 2 hours after meals.",
        question: "What's happening?",
        options: [
          { text: "This is completely normal and healthy", correct: false },
          { text: "They have metabolic dysfunction despite 'normal' fasting glucose", correct: true },
          { text: "They just need more willpower", correct: false },
        ],
        explanation: "Fasting glucose doesn't tell the whole story. Post-meal spikes can indicate metabolic problems that precede diabetes by years.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What factors influence your blood sugar response?",
        options: [
          { text: "What you eat", correct: true },
          { text: "When you eat", correct: true },
          { text: "Physical activity", correct: true },
          { text: "Sleep quality", correct: true },
          { text: "Only genetics—nothing you can control", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Blood sugar control is largely within your power through lifestyle choices.",
        answer: true,
        explanation: "Diet, movement, meal timing, and sleep all profoundly affect glucose regulation.",
      },
    ],
  },
  {
    id: 'longevity-2-2',
    unitId: 'longevity-2',
    order: 2,
    title: "Insulin Resistance: The Root Problem",
    content: {
      intro: `Insulin resistance is arguably the most important health concept most people have never heard of. It underlies obesity, Type 2 diabetes, heart disease, many cancers, and even Alzheimer's (now called "Type 3 diabetes" by some researchers).

When you're insulin sensitive, a small amount of insulin efficiently signals cells to absorb glucose. When you're insulin resistant, cells ignore the signal. The pancreas compensates by producing more insulin.

High insulin itself is harmful. It promotes fat storage (especially visceral fat). It blocks fat burning. It drives inflammation. It accelerates aging. It promotes cell growth (including potentially cancerous cells).

The causes of insulin resistance: Chronic overconsumption, especially refined carbohydrates. Sedentary behavior—muscles are the main glucose sink. Poor sleep—even one bad night impairs insulin sensitivity. Visceral fat—actively produces insulin resistance signals. Chronic stress—cortisol opposes insulin's action.

The reversal path: Reducing refined carbs and eating whole foods. Regular muscle-engaging exercise. Quality sleep prioritized. Stress management. Time-restricted eating.

Improving insulin sensitivity may be the single highest-leverage intervention for longevity.`,
      keyPoint: "Insulin resistance underlies most metabolic diseases and accelerates aging, but is reversible through lifestyle changes.",
    },
    games: [
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Insulin sensitive", right: "Cells respond to small insulin amounts" },
          { left: "Insulin resistant", right: "Cells ignore insulin's signal" },
          { left: "High insulin levels", right: "Promotes fat storage, blocks fat burning" },
          { left: "Visceral fat", right: "Produces insulin resistance signals" },
        ],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Which conditions are linked to insulin resistance?",
        options: [
          { text: "Type 2 diabetes", correct: true },
          { text: "Heart disease", correct: true },
          { text: "Some cancers", correct: true },
          { text: "Alzheimer's disease", correct: true },
          { text: "Broken bones", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Some researchers call Alzheimer's 'Type 3 diabetes' due to its link with insulin resistance.",
        answer: true,
        explanation: "Brain insulin resistance is increasingly recognized as a factor in Alzheimer's development.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "High _______ levels promote fat storage, block fat burning, and accelerate aging.",
        options: ['insulin', 'glucose', 'cortisol', 'protein'],
        answer: 'insulin',
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What causes insulin resistance?",
        options: [
          { text: "Chronic overconsumption of refined carbs", correct: true },
          { text: "Sedentary behavior", correct: true },
          { text: "Poor sleep", correct: true },
          { text: "Regular exercise", correct: false },
          { text: "Chronic stress", correct: true },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "A person has been eating a standard diet high in refined carbs and rarely exercises. Their doctor says their blood sugar is 'still normal' but their fasting insulin levels are very high.",
        question: "What does this indicate?",
        options: [
          { text: "They're perfectly healthy—blood sugar is normal", correct: false },
          { text: "Their pancreas is working overtime to keep blood sugar normal—insulin resistance is developing", correct: true },
          { text: "High insulin is a sign of good health", correct: false },
        ],
        explanation: "High fasting insulin with normal blood sugar means the body is compensating for insulin resistance. This is an early warning sign.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Rank these insulin resistance interventions from MOST impactful to supplementary:",
        items: [
          "Reduce refined carbohydrates — directly reduces the blood sugar spikes causing the problem",
          "Engage muscles through exercise — muscles are the biggest glucose sinks in the body",
          "Improve sleep quality — even one bad night worsens insulin sensitivity",
          "Manage chronic stress — cortisol directly opposes insulin's action",
          "Consider time-restricted eating — gives insulin levels extended time to drop",
        ],
        correctOrder: [0, 1, 2, 3, 4],
        acceptableOrders: [[0,1,2,3,4],[1,0,2,3,4],[0,1,3,2,4],[1,0,3,2,4]],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Improving insulin sensitivity may be the single highest-leverage intervention for longevity.",
        answer: true,
        explanation: "Because insulin resistance underlies so many chronic diseases, improving it addresses multiple health risks simultaneously.",
      },
    ],
  },
  {
    id: 'longevity-2-3',
    unitId: 'longevity-2',
    order: 3,
    title: "The Glucose Spike Solution",
    content: {
      intro: `Not all foods affect blood sugar equally, and even the same food affects different people differently. But there are evidence-based strategies to reduce glucose spikes.

Order matters. Eating fiber and vegetables first, then protein and fat, then carbohydrates reduces the glucose spike by up to 75% compared to eating carbs first. The fiber and fat slow gastric emptying.

Move after meals. A 10-15 minute walk after eating can reduce glucose spikes by 30-50%. Muscles actively absorb glucose without needing insulin.

Pair carbs with fiber, protein, and fat. A piece of fruit causes less spike than fruit juice. Pasta with vegetables and olive oil causes less spike than plain pasta.

Avoid naked carbs. Eating refined carbohydrates alone (bread, crackers, sweets) causes rapid spikes. Always pair with protein, fat, or fiber.

Vinegar before meals. Just 1-2 tablespoons of vinegar (or lemon juice) before eating can reduce glucose response by 20-30% by slowing carbohydrate digestion.

Sleep and stress matter. Poor sleep the night before increases glucose response to the same meal. High stress does the same through cortisol.`,
      keyPoint: "Simple meal modifications—eating order, movement, food pairing—can dramatically reduce glucose spikes.",
    },
    games: [
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "What should you eat FIRST through LAST in a meal to minimize blood sugar spikes?",
        items: [
          "Fiber and vegetables FIRST — they slow down digestion",
          "Protein SECOND — adds bulk and slows gastric emptying",
          "Fats THIRD — further slows everything down",
          "Carbohydrates LAST — absorbed slowly because of everything eaten before them",
        ],
        correctOrder: [0, 1, 2, 3],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Eating vegetables and fiber first can reduce glucose spikes by up to ___% compared to eating carbs first.",
        options: ['75', '25', '10', '50'],
        answer: '75',
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Post-meal walk", right: "Reduces spike 30-50%" },
          { left: "Vinegar before meals", right: "Reduces spike 20-30%" },
          { left: "Eating order (veggies first)", right: "Reduces spike up to 75%" },
          { left: "Naked carbs", right: "Causes rapid glucose spikes" },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "A 10-15 minute walk after eating can significantly reduce glucose spikes.",
        answer: true,
        explanation: "Active muscles absorb glucose without needing insulin, reducing post-meal blood sugar elevation.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Which strategies reduce glucose spikes?",
        options: [
          { text: "Eating fiber before carbs", correct: true },
          { text: "Walking after meals", correct: true },
          { text: "Pairing carbs with protein and fat", correct: true },
          { text: "Eating refined carbs alone", correct: false },
          { text: "Vinegar before meals", correct: true },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Two people eat identical pasta meals. Person A starts with salad, eats the pasta last, then takes a 10-minute walk. Person B eats just the pasta while sitting. Person A's glucose spike is 60% lower.",
        question: "What explains this dramatic difference?",
        options: [
          { text: "Different genetics", correct: false },
          { text: "Eating order and post-meal movement profoundly affect glucose response", correct: true },
          { text: "Measurement error", correct: false },
        ],
        explanation: "Simple behavioral changes—eating order and movement—can dramatically change how the same food affects your blood sugar.",
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Poor sleep the night before increases your glucose response to the same meal.",
        answer: true,
        explanation: "Sleep deprivation impairs insulin sensitivity, causing higher blood sugar spikes from the same food.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "'Naked _______' (refined carbs eaten alone) cause the most rapid blood sugar spikes.",
        options: ['carbs', 'proteins', 'fats', 'fibers'],
        answer: 'carbs',
      },
    ],
  },
  {
    id: 'longevity-2-4',
    unitId: 'longevity-2',
    order: 4,
    title: "Metabolic Flexibility",
    content: {
      intro: `A metabolically healthy person can efficiently switch between burning glucose and burning fat for fuel. This is called "metabolic flexibility"—and most modern adults have lost it.

When you're metabolically flexible: You can go hours without eating without energy crashes. You burn fat efficiently during fasting or exercise. Your energy is stable throughout the day. You're not controlled by hunger and cravings.

When you're metabolically inflexible: You need to eat every few hours or feel terrible. You burn glucose almost exclusively, even when fat would be appropriate. Energy swings and crashes are common. Hunger feels urgent and hard to ignore.

Why has this happened? Constant eating (especially refined carbs) keeps insulin high. High insulin blocks fat burning. The fat-burning metabolic pathway weakens from disuse. You become dependent on frequent glucose hits.

How to restore metabolic flexibility: Reduce refined carbohydrates—lower insulin, allow fat burning. Extend time between meals—practice using fat for fuel. Exercise in fasted states—train the fat-burning pathway. Be patient—it takes weeks for metabolic flexibility to return.`,
      keyPoint: "Metabolic flexibility—the ability to switch between burning glucose and fat—can be restored through dietary and timing changes.",
    },
    games: [
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Metabolically flexible", right: "Can switch between glucose and fat burning" },
          { left: "Metabolically inflexible", right: "Dependent on constant glucose" },
          { left: "High insulin", right: "Blocks fat burning" },
          { left: "Extended time between meals", right: "Trains fat-burning pathway" },
        ],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Signs of metabolic flexibility:",
        options: [
          { text: "Stable energy throughout the day", correct: true },
          { text: "Can skip meals without crashes", correct: true },
          { text: "Burns fat efficiently during fasting", correct: true },
          { text: "Needs to eat every 2-3 hours", correct: false },
          { text: "Not controlled by cravings", correct: true },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Most modern adults have good metabolic flexibility.",
        answer: false,
        explanation: "Constant eating and refined carbohydrates have made metabolic inflexibility the norm.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "High _______ levels block the body's ability to burn fat for fuel.",
        options: ['insulin', 'glucose', 'cortisol', 'protein'],
        answer: 'insulin',
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "A person who typically eats every 3 hours starts extending time between meals. The first week is hard—they feel irritable and low-energy. By week 3, they feel fine going 6+ hours without eating.",
        question: "What happened?",
        options: [
          { text: "Their body is shutting down from starvation", correct: false },
          { text: "They restored metabolic flexibility—their body learned to burn fat for fuel", correct: true },
          { text: "They just got used to being hungry", correct: false },
        ],
        explanation: "The initial discomfort was their body's inability to efficiently burn fat. With practice, the fat-burning pathway was restored.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "How can metabolic flexibility be restored?",
        options: [
          { text: "Reduce refined carbohydrates", correct: true },
          { text: "Extend time between meals", correct: true },
          { text: "Exercise in fasted states", correct: true },
          { text: "Eat more frequently", correct: false },
          { text: "Be patient—it takes weeks", correct: true },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order from the cause to the consequence: How does constant snacking trap you in metabolic inflexibility?",
        items: [
          "Eating frequently throughout the day keeps insulin levels constantly high",
          "Elevated insulin blocks your body's ability to burn stored fat",
          "The fat-burning pathway weakens from lack of use (use it or lose it)",
          "Your body becomes entirely dependent on glucose for energy",
          "You experience energy crashes whenever you go more than a few hours without food",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Metabolic flexibility takes weeks to restore after years of metabolic inflexibility.",
        answer: true,
        explanation: "The metabolic pathways for fat burning need time to rebuild after being suppressed.",
      },
    ],
  },
  {
    id: 'longevity-2-5',
    unitId: 'longevity-2',
    order: 5,
    title: "Time-Restricted Eating",
    content: {
      intro: `Time-restricted eating (TRE) means consuming all calories within a specific window—typically 8-12 hours—and fasting the rest of the day. It's one of the most accessible interventions for metabolic health.

The benefits are substantial. Lower insulin levels for more hours per day. Enhanced fat burning during the fasted window. Improved insulin sensitivity. Cellular cleanup (autophagy) is activated. Circadian rhythm alignment—your body expects food during certain hours.

Important: The timing matters. Eating earlier (8am-4pm) shows better metabolic outcomes than eating late (12pm-8pm). Late-night eating disrupts circadian metabolism.

What happens during the fasted window: Insulin drops, allowing fat burning. Growth hormone increases, preserving muscle. Cellular repair processes activate. Inflammation decreases. Mental clarity often improves.

Getting started: Choose an 8-12 hour eating window. Eat your first meal no earlier than your chosen start time. Finish eating before your cutoff. During fasting: Water, black coffee, and plain tea are fine.

This isn't about eating less—it's about eating within a compressed window. The fasting hours allow metabolic processes that can't happen when insulin is elevated.`,
      keyPoint: "Time-restricted eating improves metabolic health by allowing extended periods of low insulin and activating repair processes.",
    },
    games: [
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Time-restricted eating typically involves consuming all calories within a ___ to 12 hour window.",
        options: ['8', '4', '16', '2'],
        answer: '8',
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What are benefits of time-restricted eating?",
        options: [
          { text: "Lower insulin levels", correct: true },
          { text: "Enhanced fat burning", correct: true },
          { text: "Cellular cleanup (autophagy)", correct: true },
          { text: "Circadian rhythm alignment", correct: true },
          { text: "Higher insulin levels", correct: false },
        ],
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Fasted state", right: "Low insulin, fat burning enabled" },
          { left: "Fed state", right: "High insulin, fat burning blocked" },
          { left: "Autophagy", right: "Cellular cleanup and repair" },
          { left: "Early eating window", right: "Better metabolic outcomes" },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Eating the same food earlier in the day (8am-4pm) has better metabolic effects than later (12pm-8pm).",
        answer: true,
        explanation: "Circadian rhythms affect metabolism—the body processes food better earlier in the day.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What happens during the fasted window?",
        options: [
          { text: "Insulin drops", correct: true },
          { text: "Fat burning increases", correct: true },
          { text: "Growth hormone increases", correct: true },
          { text: "Cellular repair activates", correct: true },
          { text: "Metabolism shuts down", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "A person switches from eating 7am-10pm (15 hours) to eating 9am-5pm (8 hours) without changing what they eat. After 4 weeks, their metabolic markers improve significantly.",
        question: "Why did restricting the eating window help?",
        options: [
          { text: "They ate less food", correct: false },
          { text: "The extended fasting window allowed metabolic processes that can't happen when insulin is elevated", correct: true },
          { text: "Placebo effect", correct: false },
        ],
        explanation: "Even without changing food quantity or quality, the timing change allowed more hours of low insulin and activated repair processes.",
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Time-restricted eating is primarily about eating fewer calories.",
        answer: false,
        explanation: "It's about the timing, not the amount. The fasting hours enable metabolic processes that can't happen when constantly fed.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Late-night eating disrupts _______ metabolism, which is why earlier eating windows show better results.",
        options: ['circadian', 'morning', 'protein', 'muscle'],
        answer: 'circadian',
      },
    ],
  },
        ],
        'longevity-3': [
  {
    id: 'longevity-3-1',
    unitId: 'longevity-3',
    order: 1,
    title: "Heart Disease: The Leading Killer",
    content: {
      intro: `Heart disease kills more people than any other cause—about 1 in 4 deaths. Yet it's largely preventable and even reversible through lifestyle.

The process starts decades before a heart attack. LDL cholesterol particles infiltrate artery walls. Inflammation causes these particles to oxidize. Immune cells rush in, creating plaques. Plaques grow, narrowing arteries. Eventually, a plaque ruptures, causing a clot—heart attack or stroke.

What drives this process? High LDL cholesterol (especially small, dense particles). Chronic inflammation. High blood pressure damages artery walls. Insulin resistance promotes all of the above. Smoking dramatically accelerates damage.

What reverses it? Plant-based diets consistently show heart disease reversal. Regular aerobic exercise improves every cardiac risk factor. Stress management lowers blood pressure and inflammation. Not smoking—the single most impactful change a smoker can make. Healthy weight—especially reducing visceral fat.

Dr. Dean Ornish's research proved that comprehensive lifestyle change can reverse heart disease without drugs—arteries actually opened up. This isn't just prevention; it's reversal.`,
      keyPoint: "Heart disease is the leading killer but is largely preventable and even reversible through diet, exercise, and lifestyle changes.",
    },
    games: [
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Heart disease causes about 1 in ___ deaths, making it the leading killer.",
        options: ['4', '10', '20', '2'],
        answer: '4',
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order from the silent start to the heart attack: How does atherosclerosis develop over decades?",
        items: [
          "LDL cholesterol particles infiltrate artery walls (silent — no symptoms)",
          "Inflammation causes those trapped LDL particles to oxidize and become toxic",
          "Immune cells rush in and create fatty plaques in the artery wall",
          "Plaques grow over years, gradually narrowing the arteries",
          "A plaque ruptures, triggering a blood clot — heart attack or stroke",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What drives heart disease development?",
        options: [
          { text: "High LDL cholesterol", correct: true },
          { text: "Chronic inflammation", correct: true },
          { text: "High blood pressure", correct: true },
          { text: "Insulin resistance", correct: true },
          { text: "Regular exercise", correct: false },
        ],
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Plant-based diets", right: "Can reverse heart disease" },
          { left: "Regular aerobic exercise", right: "Improves all cardiac risk factors" },
          { left: "Smoking", right: "Dramatically accelerates damage" },
          { left: "Visceral fat", right: "Major risk factor to reduce" },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Heart disease can only be slowed, not reversed.",
        answer: false,
        explanation: "Research by Dr. Dean Ornish and others has shown that comprehensive lifestyle change can actually reverse heart disease—arteries can open up.",
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "A patient with significant artery blockages adopts a whole-food plant-based diet, starts exercising, quits smoking, and manages stress. A year later, imaging shows their arteries have actually opened up.",
        question: "What does this demonstrate?",
        options: [
          { text: "Medical imaging is unreliable", correct: false },
          { text: "Heart disease can be reversed through comprehensive lifestyle change", correct: true },
          { text: "This was a rare genetic anomaly", correct: false },
        ],
        explanation: "Multiple studies have shown that intensive lifestyle changes can reverse atherosclerosis, not just slow it.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Which lifestyle factors reduce heart disease risk?",
        options: [
          { text: "Plant-rich diet", correct: true },
          { text: "Regular aerobic exercise", correct: true },
          { text: "Not smoking", correct: true },
          { text: "Chronic stress", correct: false },
          { text: "Healthy weight", correct: true },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "The process of heart disease begins decades before a heart attack occurs.",
        answer: true,
        explanation: "Atherosclerosis develops over years to decades, which is why prevention should start early.",
      },
    ],
  },
  {
    id: 'longevity-3-2',
    unitId: 'longevity-3',
    order: 2,
    title: "Cancer: Reducing Your Risk",
    content: {
      intro: `Cancer is the second leading cause of death, but 30-50% of cancers are preventable through lifestyle modification. This isn't about perfect protection—it's about dramatically shifting the odds.

How cancer develops: DNA damage occurs (from various causes). Repair mechanisms usually fix it. Sometimes damage escapes repair and accumulates. Cells with enough damage start dividing uncontrollably. Immune system usually catches these. Sometimes cancer cells evade detection and grow.

What increases cancer risk? Obesity—particularly visceral fat, which secretes growth factors. Chronic inflammation—creates an environment where cancer thrives. Insulin resistance—high insulin promotes cell growth. Processed meat—classified as carcinogenic by WHO. Alcohol—directly damages DNA. Smoking—causes ~30% of all cancer deaths.

What decreases cancer risk? Healthy weight—one of the most impactful factors. Plant-rich diet—fiber, antioxidants, phytochemicals are protective. Regular exercise—enhances immune surveillance, reduces inflammation. Limiting alcohol—no amount is truly "safe" for cancer risk. Not smoking—the biggest single risk factor you can eliminate.`,
      keyPoint: "30-50% of cancers are preventable through lifestyle—maintaining healthy weight, eating plants, exercising, and avoiding tobacco and excess alcohol.",
    },
    games: [
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "___-50% of cancers are preventable through lifestyle modification.",
        options: ['30', '10', '70', '5'],
        answer: '30',
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What increases cancer risk?",
        options: [
          { text: "Obesity", correct: true },
          { text: "Chronic inflammation", correct: true },
          { text: "Processed meat", correct: true },
          { text: "Alcohol", correct: true },
          { text: "Regular exercise", correct: false },
        ],
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Visceral fat", right: "Secretes growth factors promoting cancer" },
          { left: "Processed meat", right: "Classified as carcinogenic by WHO" },
          { left: "Smoking", right: "Causes ~30% of all cancer deaths" },
          { left: "Plant-rich diet", right: "Protective through fiber and phytochemicals" },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Moderate alcohol consumption is safe from a cancer risk perspective.",
        answer: false,
        explanation: "Even moderate alcohol increases cancer risk. No amount is truly 'safe' when it comes to cancer.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order from the first damage to the disease: How does cancer typically develop over time?",
        items: [
          "DNA damage occurs (from sun, toxins, inflammation, or random errors)",
          "Some damage escapes the body's repair mechanisms",
          "Unrepaired damage accumulates over years or decades",
          "Cells with enough accumulated damage begin dividing uncontrollably",
          "If those cancer cells evade immune detection, they grow into a tumor",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What lifestyle factors reduce cancer risk?",
        options: [
          { text: "Maintaining healthy weight", correct: true },
          { text: "Plant-rich diet", correct: true },
          { text: "Regular exercise", correct: true },
          { text: "Limiting alcohol", correct: true },
          { text: "Eating more processed meat", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "A population study follows two groups for 20 years. Group A eats a whole-food plant-based diet, exercises, doesn't smoke, and limits alcohol. Group B follows the standard Western lifestyle. Group A has 40% lower cancer rates.",
        question: "What explains this difference?",
        options: [
          { text: "Random chance", correct: false },
          { text: "Cumulative effect of multiple protective lifestyle factors", correct: true },
          { text: "Group A had better genetics", correct: false },
        ],
        explanation: "Lifestyle factors compound—each protective behavior adds to the others, significantly reducing overall cancer risk.",
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Obesity is one of the most impactful modifiable risk factors for cancer.",
        answer: true,
        explanation: "Excess body fat, especially visceral fat, creates an environment that promotes cancer development through multiple mechanisms.",
      },
    ],
  },
  {
    id: 'longevity-3-3',
    unitId: 'longevity-3',
    order: 3,
    title: "Type 2 Diabetes: A Lifestyle Disease",
    content: {
      intro: `Type 2 diabetes affects over 10% of adults and is a major driver of heart disease, kidney failure, blindness, and amputations. Yet it's almost entirely a lifestyle disease—and it's reversible.

The progression: Years of blood sugar dysregulation. Insulin resistance develops. Pancreas compensates by producing more insulin. Eventually, pancreas can't keep up. Blood sugar rises—diabetes diagnosis. Complications develop over subsequent years.

But here's what's remarkable: This progression can be halted and reversed at almost any stage. Comprehensive lifestyle change can normalize blood sugar, often eliminating the need for medication.

What reverses Type 2 diabetes? Significant weight loss—especially visceral fat reduction. Low-carbohydrate diets—reduce the glucose load. Intensive lifestyle intervention—often more effective than medication. Regular exercise—improves insulin sensitivity. Time-restricted eating—allows insulin levels to drop.

Studies show that even after years of diabetes, significant lifestyle change can lead to remission. The longer you've had it and the more pancreatic function has declined, the harder it becomes—but improvement is almost always possible.`,
      keyPoint: "Type 2 diabetes is largely reversible through lifestyle changes including weight loss, diet modification, and exercise.",
    },
    games: [
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Type 2 diabetes affects over ___% of adults in the US.",
        options: ['10', '2', '25', '50'],
        answer: '10',
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order the progression from early warning signs to diagnosis: How does Type 2 diabetes develop?",
        items: [
          "Years of blood sugar ups and downs from diet and lifestyle",
          "Cells gradually become resistant to insulin's signal",
          "Pancreas works harder and harder, producing more insulin to compensate",
          "Eventually the pancreas can't keep up with the demand",
          "Blood sugar rises above normal — leading to a diabetes diagnosis",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What complications can result from Type 2 diabetes?",
        options: [
          { text: "Heart disease", correct: true },
          { text: "Kidney failure", correct: true },
          { text: "Blindness", correct: true },
          { text: "Amputations", correct: true },
          { text: "Improved vision", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Type 2 diabetes is a permanent condition that cannot be reversed.",
        answer: false,
        explanation: "Type 2 diabetes can often be put into remission through comprehensive lifestyle changes.",
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Significant weight loss", right: "Often reverses Type 2 diabetes" },
          { left: "Visceral fat reduction", right: "Key target for remission" },
          { left: "Regular exercise", right: "Improves insulin sensitivity" },
          { left: "Intensive lifestyle change", right: "Often more effective than medication" },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "A person diagnosed with Type 2 diabetes for 5 years makes major lifestyle changes: loses 30 pounds, eliminates refined carbs, and starts exercising daily. After 6 months, their blood sugar normalizes without medication.",
        question: "What happened?",
        options: [
          { text: "Temporary improvement that won't last", correct: false },
          { text: "They achieved diabetes remission through comprehensive lifestyle change", correct: true },
          { text: "Lab error in the new tests", correct: false },
        ],
        explanation: "Type 2 diabetes remission through lifestyle change is well-documented. The body can recover when the underlying causes are addressed.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Which lifestyle changes help reverse Type 2 diabetes?",
        options: [
          { text: "Significant weight loss", correct: true },
          { text: "Low-carbohydrate diets", correct: true },
          { text: "Regular exercise", correct: true },
          { text: "Time-restricted eating", correct: true },
          { text: "Eating more refined carbs", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Intensive lifestyle intervention is often more effective than medication for Type 2 diabetes.",
        answer: true,
        explanation: "Research shows that comprehensive lifestyle change addresses the root causes of Type 2 diabetes, whereas medication manages symptoms.",
      },
    ],
  },
  {
    id: 'longevity-3-4',
    unitId: 'longevity-3',
    order: 4,
    title: "Cognitive Decline and Dementia",
    content: {
      intro: `Dementia affects 55 million people worldwide and is projected to nearly triple by 2050. While there's no cure, research increasingly shows that lifestyle factors significantly affect risk.

The brain is vulnerable to the same processes that damage the rest of the body. Vascular damage—what harms the heart harms the brain. Chronic inflammation—neuroinflammation accelerates decline. Insulin resistance—the brain needs glucose, and resistance impairs it. Oxidative stress—damages neurons over time. Poor sleep—the brain clears toxins during sleep.

What increases dementia risk? Cardiovascular risk factors—high blood pressure, high cholesterol, diabetes. Physical inactivity—one of the strongest modifiable risk factors. Social isolation—lack of cognitive stimulation. Poor diet—especially one that promotes inflammation. Depression and chronic stress.

What reduces dementia risk? Regular exercise—may be the single most protective factor. Cognitive engagement—learning, social interaction, purpose. Mediterranean-style diet—consistently associated with lower risk. Quality sleep—allows brain clearance of toxic proteins. Cardiovascular health—what's good for the heart is good for the brain.`,
      keyPoint: "Dementia risk is significantly influenced by modifiable lifestyle factors—especially exercise, diet, sleep, and cardiovascular health.",
    },
    games: [
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Dementia affects ___ million people worldwide and is projected to nearly triple by 2050.",
        options: ['55', '10', '100', '200'],
        answer: '55',
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Cardiovascular health", right: "What's good for heart is good for brain" },
          { left: "Regular exercise", right: "May be single most protective factor" },
          { left: "Quality sleep", right: "Allows brain to clear toxic proteins" },
          { left: "Physical inactivity", right: "One of strongest modifiable risk factors" },
        ],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What increases dementia risk?",
        options: [
          { text: "High blood pressure", correct: true },
          { text: "Physical inactivity", correct: true },
          { text: "Social isolation", correct: true },
          { text: "Regular exercise", correct: false },
          { text: "Poor sleep", correct: true },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Dementia is entirely genetic and cannot be influenced by lifestyle.",
        answer: false,
        explanation: "While genetics play a role, lifestyle factors significantly affect dementia risk—exercise, diet, sleep, and social engagement all matter.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What reduces dementia risk?",
        options: [
          { text: "Regular exercise", correct: true },
          { text: "Cognitive engagement", correct: true },
          { text: "Mediterranean-style diet", correct: true },
          { text: "Quality sleep", correct: true },
          { text: "Social isolation", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Research compares two groups of 70-year-olds over 10 years. Group A exercises regularly, stays socially active, sleeps well, and eats a Mediterranean diet. Group B is sedentary and isolated. Group A has 60% lower rates of cognitive decline.",
        question: "What explains this dramatic difference?",
        options: [
          { text: "Group A had better genes", correct: false },
          { text: "Lifestyle factors cumulatively protect brain health", correct: true },
          { text: "Random chance", correct: false },
        ],
        explanation: "Multiple lifestyle factors work together to protect the brain through reducing inflammation, maintaining blood flow, and promoting neuroplasticity.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order from unhealthy habits to cognitive decline: How do lifestyle factors damage the brain?",
        items: [
          "Poor lifestyle choices (inactivity, bad diet, poor sleep) damage blood vessels",
          "Blood flow to the brain is reduced — it gets less oxygen and nutrients",
          "Chronic inflammation develops in the brain (neuroinflammation)",
          "Neurons are gradually damaged and connections are lost over time",
          "Cognitive function noticeably declines — memory, thinking, processing speed",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Physical inactivity is one of the strongest modifiable risk factors for dementia.",
        answer: true,
        explanation: "Research consistently shows that sedentary behavior significantly increases dementia risk, making exercise crucial for brain health.",
      },
    ],
  },
  {
    id: 'longevity-3-5',
    unitId: 'longevity-3',
    order: 5,
    title: "The Common Thread: Prevention Power",
    content: {
      intro: `Here's what's remarkable: The same lifestyle factors prevent nearly ALL major chronic diseases. This isn't coincidence—they address the same underlying biological processes.

The common mechanisms: Chronic inflammation drives heart disease, cancer, diabetes, dementia, and more. Insulin resistance underlies metabolic dysfunction across diseases. Oxidative stress damages tissues throughout the body. Poor circulation affects every organ. Immune dysregulation contributes to multiple conditions.

The lifestyle factors that address all of these: Regular physical activity reduces inflammation, improves insulin sensitivity, enhances circulation, and boosts immune function. Whole-food, plant-rich diet provides anti-inflammatory compounds, fiber, and protective phytochemicals. Quality sleep allows repair, immune regulation, and waste clearance. Stress management lowers cortisol, reduces inflammation, and improves immune function. Social connection affects immune function, inflammation, and overall health. Healthy weight reduces inflammation and insulin resistance.

The power of synergy: Each factor helps. Multiple factors together multiply the benefit. You don't need perfection—consistent good choices in each area compounds over years into dramatically reduced disease risk.`,
      keyPoint: "The same lifestyle factors prevent nearly all major chronic diseases because they address common underlying biological mechanisms.",
    },
    games: [
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Which diseases are affected by chronic inflammation?",
        options: [
          { text: "Heart disease", correct: true },
          { text: "Cancer", correct: true },
          { text: "Type 2 diabetes", correct: true },
          { text: "Dementia", correct: true },
          { text: "None—inflammation is always beneficial", correct: false },
        ],
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Regular exercise", right: "Reduces inflammation, improves insulin sensitivity" },
          { left: "Plant-rich diet", right: "Anti-inflammatory, protective phytochemicals" },
          { left: "Quality sleep", right: "Repair, immune regulation, waste clearance" },
          { left: "Stress management", right: "Lowers cortisol and inflammation" },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "You need to address each chronic disease with completely different lifestyle interventions.",
        answer: false,
        explanation: "The same core lifestyle factors—exercise, diet, sleep, stress management—prevent nearly all major chronic diseases.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Chronic _______ is a common mechanism underlying heart disease, cancer, diabetes, and dementia.",
        options: ['inflammation', 'exercise', 'protein', 'hydration'],
        answer: 'inflammation',
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What biological mechanisms do healthy lifestyle factors address?",
        options: [
          { text: "Chronic inflammation", correct: true },
          { text: "Insulin resistance", correct: true },
          { text: "Oxidative stress", correct: true },
          { text: "Poor circulation", correct: true },
          { text: "None—lifestyle doesn't affect biology", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "A person starts exercising, improves their diet, prioritizes sleep, and manages stress. Their risk of heart disease, cancer, diabetes, AND dementia all significantly decrease.",
        question: "Why do the same changes affect so many different diseases?",
        options: [
          { text: "Coincidence", correct: false },
          { text: "These lifestyle factors address common underlying biological mechanisms", correct: true },
          { text: "Different mechanisms for each disease", correct: false },
        ],
        explanation: "Chronic diseases share common drivers—inflammation, insulin resistance, oxidative stress. Healthy lifestyle addresses all of these simultaneously.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order from daily choices to long-term protection: How does a healthy lifestyle prevent chronic disease?",
        items: [
          "You make consistent healthy choices day after day (diet, exercise, sleep)",
          "Multiple biological mechanisms improve simultaneously (inflammation, insulin, etc.)",
          "Those benefits compound over months and years",
          "Your risk factors stay low for years and decades",
          "Chronic diseases are prevented entirely — or significantly delayed",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "You need perfection to benefit from healthy lifestyle choices.",
        answer: false,
        explanation: "Consistent good choices—not perfection—compound over years into dramatically reduced disease risk.",
      },
    ],
  },
        ],
        'longevity-4': [
  {
    id: 'longevity-4-1',
    unitId: 'longevity-4',
    order: 1,
    title: "Autophagy: Cellular Self-Cleaning",
    content: {
      intro: `Your cells have a remarkable self-cleaning process called autophagy—literally "self-eating." Damaged proteins, dysfunctional organelles, and cellular debris are identified, broken down, and recycled into new components.

Autophagy is essential for healthy aging. It prevents accumulation of damaged components. It recycles nutrients efficiently. It helps cells survive stress. It may prevent cancer by eliminating pre-cancerous cells. The 2016 Nobel Prize in Medicine was awarded for autophagy research.

The problem: Autophagy declines with age, and modern life suppresses it. Constant eating keeps autophagy turned off. Insulin and mTOR signaling (growth pathways) inhibit autophagy. Lack of physical stress means less activation.

How to enhance autophagy: Fasting or time-restricted eating—autophagy ramps up after 12-16 hours without food. Exercise—especially intensive exercise triggers autophagy. Sleep—autophagy is active during quality sleep. Reducing protein/calories at times—constant high intake suppresses it. Certain compounds—resveratrol, spermidine, and others may help.

Think of it like your cell's maintenance crew—they can't clean when the factory is constantly running. Breaks are necessary.`,
      keyPoint: "Autophagy—cellular self-cleaning—is essential for healthy aging and can be enhanced through fasting, exercise, and quality sleep.",
    },
    games: [
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Autophagy literally means 'self-_______' and is the cell's self-cleaning process.",
        options: ['eating', 'healing', 'growing', 'dividing'],
        answer: 'eating',
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What does autophagy do for cells?",
        options: [
          { text: "Breaks down damaged proteins", correct: true },
          { text: "Recycles cellular components", correct: true },
          { text: "Helps cells survive stress", correct: true },
          { text: "May prevent cancer", correct: true },
          { text: "Increases cellular damage", correct: false },
        ],
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Fasting 12-16+ hours", right: "Ramps up autophagy" },
          { left: "Constant eating", right: "Keeps autophagy suppressed" },
          { left: "Exercise", right: "Triggers autophagy" },
          { left: "2016 Nobel Prize", right: "Awarded for autophagy research" },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Eating frequently throughout the day enhances autophagy.",
        answer: false,
        explanation: "Constant eating suppresses autophagy. Fasting periods are needed for this cleaning process to activate.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order from stopping eating to cellular cleanup: How does fasting activate autophagy?",
        items: [
          "You stop eating — food intake ceases",
          "Insulin and mTOR (growth signals) levels drop significantly",
          "With growth signals low, autophagy (cleanup) signals ramp up",
          "Cells begin identifying and tagging their damaged components",
          "Those damaged components are broken down and recycled into useful parts",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "A person eating 6 small meals throughout the day never goes more than 3 hours without food. Their autophagy levels are measured and found to be very low.",
        question: "Why is their autophagy suppressed?",
        options: [
          { text: "They're eating too little", correct: false },
          { text: "Constant eating keeps insulin and mTOR high, which blocks autophagy", correct: true },
          { text: "Their genetics are preventing autophagy", correct: false },
        ],
        explanation: "Autophagy requires periods without food. Constant eating keeps the growth signals high and cleaning signals low.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "How can you enhance autophagy?",
        options: [
          { text: "Time-restricted eating", correct: true },
          { text: "Intensive exercise", correct: true },
          { text: "Quality sleep", correct: true },
          { text: "Eating every 2-3 hours", correct: false },
          { text: "Periodic calorie reduction", correct: true },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Autophagy is like a cellular maintenance crew that can only work when the factory stops running.",
        answer: true,
        explanation: "Just as factory maintenance happens during downtime, cellular cleaning (autophagy) happens when the cell isn't constantly processing food.",
      },
    ],
  },
  {
    id: 'longevity-4-2',
    unitId: 'longevity-4',
    order: 2,
    title: "Mitochondria: Your Energy Factories",
    content: {
      intro: `Every cell contains hundreds to thousands of mitochondria—tiny organelles that produce ATP, the energy currency of life. Their health is fundamental to your health.

Mitochondria do more than make energy: They regulate metabolism. They control cell death (apoptosis). They influence inflammation. They affect how you age.

The problem is mitochondrial dysfunction. With age and poor lifestyle: Mitochondria become damaged. They produce more reactive oxygen species (free radicals). Energy production declines. Cells don't function properly. This dysfunction underlies many age-related diseases.

What damages mitochondria: Chronic inflammation. Oxidative stress. Sedentary behavior—unused mitochondria atrophy. Blood sugar dysregulation. Poor sleep. Environmental toxins.

What enhances mitochondrial health: Exercise—especially high-intensity and endurance training—stimulates mitochondrial biogenesis (creation of new mitochondria). Cold exposure activates mitochondria. Intermittent fasting triggers mitochondrial renewal. Quality sleep allows repair. Nutrients like CoQ10, NAD+ precursors, and polyphenols support function.

You can literally grow new, healthier mitochondria through lifestyle choices.`,
      keyPoint: "Mitochondrial health determines energy production and aging—exercise, fasting, and quality sleep can create new, healthier mitochondria.",
    },
    games: [
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Mitochondria produce ___, the energy currency of life.",
        options: ['ATP', 'DNA', 'glucose', 'protein'],
        answer: 'ATP',
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What do mitochondria do beyond producing energy?",
        options: [
          { text: "Regulate metabolism", correct: true },
          { text: "Control cell death", correct: true },
          { text: "Influence inflammation", correct: true },
          { text: "Affect aging", correct: true },
          { text: "Only produce energy—nothing else", correct: false },
        ],
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Exercise", right: "Stimulates new mitochondria creation" },
          { left: "Sedentary behavior", right: "Mitochondria atrophy from disuse" },
          { left: "Mitochondrial biogenesis", right: "Creation of new mitochondria" },
          { left: "Mitochondrial dysfunction", right: "Underlies many age-related diseases" },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "You can grow new, healthier mitochondria through lifestyle choices.",
        answer: true,
        explanation: "Exercise, cold exposure, fasting, and quality sleep all stimulate mitochondrial biogenesis—the creation of new mitochondria.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What damages mitochondria?",
        options: [
          { text: "Chronic inflammation", correct: true },
          { text: "Sedentary behavior", correct: true },
          { text: "Blood sugar dysregulation", correct: true },
          { text: "Regular exercise", correct: false },
          { text: "Poor sleep", correct: true },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "A sedentary person starts an exercise program. After 8 weeks, muscle biopsies show a significant increase in mitochondrial number and function.",
        question: "What happened?",
        options: [
          { text: "They just revealed mitochondria they already had", correct: false },
          { text: "Exercise stimulated mitochondrial biogenesis—new mitochondria were created", correct: true },
          { text: "Measurement error", correct: false },
        ],
        explanation: "Exercise is one of the most powerful stimuli for mitochondrial biogenesis. The body responds to increased energy demand by creating more energy factories.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order from the workout to improved energy: How does exercise improve your mitochondria?",
        items: [
          "Exercise creates a sudden demand for more energy than usual",
          "This demand triggers cellular signals that activate mitochondrial genes",
          "New, healthy mitochondria are created (mitochondrial biogenesis)",
          "Old and damaged mitochondria are identified and cleared out",
          "The result: your overall cellular energy production improves",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What enhances mitochondrial health?",
        options: [
          { text: "High-intensity exercise", correct: true },
          { text: "Intermittent fasting", correct: true },
          { text: "Cold exposure", correct: true },
          { text: "Quality sleep", correct: true },
          { text: "Constant sedentary behavior", correct: false },
        ],
      },
    ],
  },
  {
    id: 'longevity-4-3',
    unitId: 'longevity-4',
    order: 3,
    title: "NAD+ and Cellular Energy",
    content: {
      intro: `NAD+ (nicotinamide adenine dinucleotide) is a molecule found in every cell that's essential for energy production, DNA repair, and longevity pathways. Its decline with age may be a key driver of aging.

NAD+ is a coenzyme for hundreds of metabolic reactions. It's required for mitochondria to produce ATP. It activates sirtuins—longevity-associated proteins. It's essential for DNA repair. It regulates circadian rhythms.

The problem: NAD+ levels decline significantly with age—by age 50, levels may be half of what they were at 20. This decline contributes to: Reduced energy production. Impaired DNA repair. Dysfunctional metabolism. Accelerated aging.

What depletes NAD+: Chronic inflammation consumes NAD+. DNA damage increases demand. Overeating (especially high-fat diets). Alcohol consumption. Sedentary behavior.

What supports NAD+ levels: Exercise—powerfully increases NAD+. Fasting and calorie restriction. NAD+ precursor supplements (NMN, NR). Quality sleep. Reducing inflammation.

Maintaining NAD+ levels may be one of the keys to healthy aging, and lifestyle factors significantly affect it.`,
      keyPoint: "NAD+ is essential for energy and repair but declines with age—exercise, fasting, and quality sleep help maintain levels.",
    },
    games: [
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "NAD+ levels may decline by ___% by age 50 compared to age 20.",
        options: ['50', '10', '90', '25'],
        answer: '50',
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What does NAD+ do in the body?",
        options: [
          { text: "Required for ATP production", correct: true },
          { text: "Activates longevity-associated sirtuins", correct: true },
          { text: "Essential for DNA repair", correct: true },
          { text: "Regulates circadian rhythms", correct: true },
          { text: "Causes cellular damage", correct: false },
        ],
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "NAD+ decline", right: "Key driver of aging" },
          { left: "Sirtuins", right: "Longevity proteins activated by NAD+" },
          { left: "Exercise", right: "Powerfully increases NAD+" },
          { left: "Chronic inflammation", right: "Consumes NAD+" },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "NAD+ levels naturally increase as we age.",
        answer: false,
        explanation: "NAD+ significantly declines with age, which is thought to contribute to many aspects of aging.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What depletes NAD+ levels?",
        options: [
          { text: "Chronic inflammation", correct: true },
          { text: "Overeating", correct: true },
          { text: "Alcohol consumption", correct: true },
          { text: "Regular exercise", correct: false },
          { text: "Sedentary behavior", correct: true },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "A 60-year-old who exercises regularly, practices intermittent fasting, and sleeps well has NAD+ levels comparable to someone 15 years younger.",
        question: "What explains this?",
        options: [
          { text: "They have special genetics", correct: false },
          { text: "Lifestyle factors significantly affect NAD+ levels regardless of age", correct: true },
          { text: "The test was inaccurate", correct: false },
        ],
        explanation: "While NAD+ declines with age, lifestyle choices can significantly influence levels—exercise and fasting in particular can boost NAD+.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order the NAD+ decline cascade from the initial drop to the aging consequences:",
        items: [
          "NAD+ levels naturally decrease as you age (by 50% by age 50)",
          "Cells produce less energy because NAD+ is needed for ATP production",
          "DNA repair becomes impaired because repair enzymes need NAD+ to function",
          "Sirtuin activity decreases — these longevity proteins depend on NAD+",
          "Multiple aging processes accelerate as all these systems decline simultaneously",
        ],
        correctOrder: [0, 1, 2, 3, 4],
        acceptableOrders: [[0,1,2,3,4],[0,1,3,2,4],[0,2,1,3,4],[0,2,3,1,4],[0,3,1,2,4],[0,3,2,1,4]],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What supports NAD+ levels?",
        options: [
          { text: "Regular exercise", correct: true },
          { text: "Fasting and calorie restriction", correct: true },
          { text: "Quality sleep", correct: true },
          { text: "Reducing inflammation", correct: true },
          { text: "Chronic overeating", correct: false },
        ],
      },
    ],
  },
  {
    id: 'longevity-4-4',
    unitId: 'longevity-4',
    order: 4,
    title: "DNA Repair and Protection",
    content: {
      intro: `Your DNA is under constant assault—tens of thousands of damage events per cell per day from metabolism, UV light, toxins, and replication errors. Your survival depends on sophisticated repair mechanisms.

DNA damage accumulates with age because: Repair mechanisms become less efficient. Damage rate may increase with inflammation and oxidative stress. Senescent cells accumulate damaged DNA. This genomic instability is one of the hallmarks of aging.

Why DNA repair matters: Unrepaired damage can cause cell death. It can lead to cellular dysfunction. It can result in cancer if growth-controlling genes are affected. Accumulated damage accelerates aging.

What damages DNA: Oxidative stress (free radicals). Chronic inflammation. UV radiation and environmental toxins. Metabolic processes (unavoidable baseline). Poor lifestyle accelerates damage.

What enhances DNA repair: Quality sleep—repair processes are highly active during sleep. Avoiding DNA-damaging behaviors (smoking, excess sun, toxins). Anti-inflammatory diet and lifestyle. Certain nutrients—zinc, selenium, B vitamins support repair enzymes. NAD+ is required for key repair pathways.

You can't prevent all DNA damage, but you can minimize it and maximize repair.`,
      keyPoint: "DNA is constantly damaged but repair mechanisms exist—sleep, anti-inflammatory lifestyle, and proper nutrients support repair.",
    },
    games: [
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Cells experience tens of _______ of DNA damage events per day.",
        options: ['thousands', 'dozens', 'hundreds', 'millions'],
        answer: 'thousands',
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Why does DNA damage accumulate with age?",
        options: [
          { text: "Repair mechanisms become less efficient", correct: true },
          { text: "Damage rate may increase with inflammation", correct: true },
          { text: "Senescent cells accumulate damaged DNA", correct: true },
          { text: "Repair mechanisms get stronger", correct: false },
          { text: "Oxidative stress increases", correct: true },
        ],
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Quality sleep", right: "When DNA repair is highly active" },
          { left: "Oxidative stress", right: "Causes DNA damage" },
          { left: "Unrepaired DNA damage", right: "Can lead to cancer" },
          { left: "NAD+", right: "Required for key repair pathways" },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "DNA damage can be completely prevented through healthy lifestyle.",
        answer: false,
        explanation: "Some DNA damage is unavoidable as it occurs from normal metabolism. The goal is to minimize damage and maximize repair.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What enhances DNA repair?",
        options: [
          { text: "Quality sleep", correct: true },
          { text: "Avoiding smoking and toxins", correct: true },
          { text: "Anti-inflammatory diet", correct: true },
          { text: "Chronic sleep deprivation", correct: false },
          { text: "Proper nutrients (zinc, selenium, B vitamins)", correct: true },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Two people are exposed to the same environmental DNA-damaging agent. One sleeps well, eats anti-inflammatory foods, and has low stress. The other is sleep-deprived and chronically stressed. The first person's cells show much better DNA repair.",
        question: "Why did their repair differ?",
        options: [
          { text: "Different genetics", correct: false },
          { text: "Lifestyle factors significantly affect DNA repair efficiency", correct: true },
          { text: "Random chance", correct: false },
        ],
        explanation: "Sleep, nutrition, and stress levels all affect the efficiency of DNA repair mechanisms.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order from the microscopic damage to the visible decline: How does DNA damage contribute to aging?",
        items: [
          "DNA damage occurs daily from metabolism, UV light, toxins, and errors",
          "Most is repaired, but some damage escapes the repair mechanisms",
          "Over years, unrepaired DNA damage accumulates in your cells",
          "Cells with too much damage become dysfunctional or die",
          "Tissue function declines as damaged and dead cells accumulate",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "DNA repair processes are particularly active during quality sleep.",
        answer: true,
        explanation: "Sleep is a critical time for cellular repair processes including DNA repair. Poor sleep impairs this essential maintenance.",
      },
    ],
  },
  {
    id: 'longevity-4-5',
    unitId: 'longevity-4',
    order: 5,
    title: "Hormesis: Stress That Strengthens",
    content: {
      intro: `Not all stress is bad. In fact, the right kinds of stress—in the right amounts—make your cells stronger. This is called hormesis.

Hormesis is the biological principle that low doses of stressors that would be harmful at high doses actually trigger adaptive responses that make you more resilient.

Examples of hormetic stressors: Exercise—muscle damage and metabolic stress trigger growth and adaptation. Fasting—nutrient stress activates cellular cleanup and efficiency. Cold exposure—activates brown fat, improves mitochondria, increases stress resilience. Heat exposure (sauna)—activates heat shock proteins that repair damaged proteins. Plant phytochemicals—many "antioxidants" are actually mild toxins that trigger protective responses.

How hormesis works: A stressor is applied. Cells detect the stress. Repair and protective pathways are activated. These pathways overshoot—leaving you stronger than before. Result: Increased resilience.

The key is dose—too little stress provides no stimulus; too much causes harm. The "sweet spot" of moderate stress triggers adaptation without damage.

This is why avoiding all discomfort makes you weaker, while strategic discomfort makes you stronger.`,
      keyPoint: "Hormesis—the principle that moderate stress triggers adaptive responses—explains why exercise, fasting, and temperature stress improve health.",
    },
    games: [
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "_______ is the principle that low doses of stressors trigger adaptive responses that make you stronger.",
        options: ['Hormesis', 'Homeostasis', 'Metabolism', 'Catabolism'],
        answer: 'Hormesis',
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Which are examples of hormetic stressors?",
        options: [
          { text: "Exercise", correct: true },
          { text: "Fasting", correct: true },
          { text: "Cold exposure", correct: true },
          { text: "Sauna/heat exposure", correct: true },
          { text: "Chronic unrelenting stress", correct: false },
        ],
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Exercise stress", right: "Triggers growth and adaptation" },
          { left: "Fasting stress", right: "Activates cellular cleanup" },
          { left: "Cold exposure", right: "Improves mitochondria" },
          { left: "Heat shock proteins", right: "Repair damaged proteins" },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Avoiding all stress and discomfort is the best way to stay healthy.",
        answer: false,
        explanation: "Some stress is necessary for adaptation and resilience. Avoiding all stress actually makes you weaker.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order from the stress to the strength: How does hormesis make you stronger?",
        items: [
          "A moderate stressor is applied (exercise, cold, fasting, etc.)",
          "Your cells detect the stress and sound the alarm",
          "Repair and protective pathways are activated in response",
          "The repair response OVERSHOOTS — building more protection than you started with",
          "You're left stronger and more resilient than before the stress",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "A person starts taking cold showers. Initially it's very uncomfortable, but over weeks, they find cold doesn't bother them as much, their energy improves, and they get sick less often.",
        question: "What happened?",
        options: [
          { text: "They just got used to the cold", correct: false },
          { text: "Cold exposure triggered adaptive responses that improved their stress resilience", correct: true },
          { text: "Placebo effect", correct: false },
        ],
        explanation: "Cold exposure activates adaptive pathways including improved mitochondrial function, brown fat activation, and enhanced stress response.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Why is dose important in hormesis?",
        options: [
          { text: "Too little stress provides no stimulus", correct: true },
          { text: "Too much stress causes harm", correct: true },
          { text: "Moderate stress triggers adaptation", correct: true },
          { text: "Any amount of stress is equally beneficial", correct: false },
          { text: "The 'sweet spot' maximizes benefit", correct: true },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Many 'antioxidant' plant compounds are actually mild toxins that trigger protective responses.",
        answer: true,
        explanation: "Plants evolved these compounds for defense. At low doses, they trigger our cells' protective pathways—a hormetic response.",
      },
    ],
  },
        ],
        'longevity-5': [
  {
    id: 'longevity-5-1',
    unitId: 'longevity-5',
    order: 1,
    title: "Sleep: The Foundation of Health",
    content: {
      intro: `Sleep is not a luxury—it's a biological necessity that affects every aspect of health and longevity. Chronic sleep deprivation accelerates aging and increases disease risk.

What happens during sleep: Brain clears toxic waste (including Alzheimer's-linked proteins). Memory consolidation and learning occur. Hormones are regulated (growth hormone, cortisol, leptin, ghrelin). Immune system is maintained. DNA repair is active. Cellular restoration throughout the body.

What sleep deprivation does: Impairs insulin sensitivity (one bad night measurably affects it). Increases inflammation. Raises cortisol. Impairs immune function. Increases appetite and cravings. Reduces cognitive function. Accelerates biological aging.

The target: 7-9 hours for most adults. Quality matters as much as quantity. Consistency is crucial—irregular schedules disrupt circadian rhythms.

Sleep optimization: Consistent sleep/wake times (even weekends). Dark, cool room. No screens 1-2 hours before bed. Limit caffeine after noon. Morning light exposure sets circadian rhythm. Regular exercise (but not too close to bedtime).

Sleep may be the single most underrated health intervention.`,
      keyPoint: "Sleep is essential for brain cleanup, hormone regulation, immune function, and repair—chronic deprivation accelerates aging.",
    },
    games: [
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What happens during quality sleep?",
        options: [
          { text: "Brain clears toxic waste", correct: true },
          { text: "Memory consolidation", correct: true },
          { text: "Hormones are regulated", correct: true },
          { text: "DNA repair is active", correct: true },
          { text: "Nothing important—just rest", correct: false },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Most adults need ___-9 hours of quality sleep for optimal health.",
        options: ['7', '4', '10', '5'],
        answer: '7',
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "One night of poor sleep", right: "Measurably impairs insulin sensitivity" },
          { left: "Chronic sleep deprivation", right: "Accelerates biological aging" },
          { left: "Morning light exposure", right: "Sets circadian rhythm" },
          { left: "Brain waste clearance", right: "Most active during sleep" },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "You can 'catch up' on sleep with no consequences by sleeping extra on weekends.",
        answer: false,
        explanation: "Irregular sleep schedules disrupt circadian rhythms. Consistent timing is more important than occasional catch-up.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What does sleep deprivation cause?",
        options: [
          { text: "Increased inflammation", correct: true },
          { text: "Impaired insulin sensitivity", correct: true },
          { text: "Increased appetite and cravings", correct: true },
          { text: "Improved immune function", correct: false },
          { text: "Raised cortisol", correct: true },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "A person who normally sleeps 8 hours gets only 4 hours for one night. The next day, their blood sugar response to the same breakfast is significantly higher than usual.",
        question: "Why did one night affect metabolism?",
        options: [
          { text: "Coincidence", correct: false },
          { text: "Even one night of poor sleep measurably impairs insulin sensitivity", correct: true },
          { text: "The breakfast was different", correct: false },
        ],
        explanation: "Sleep deprivation rapidly affects metabolic function—insulin sensitivity decreases measurably after just one poor night.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order these sleep optimization steps from what you do in the MORNING to what you do at BEDTIME:",
        items: [
          "Set consistent sleep/wake times (anchor your body clock)",
          "Get bright light exposure in the morning (sets your circadian rhythm)",
          "Cut off caffeine after noon (it stays in your system for 8+ hours)",
          "Avoid screens 1-2 hours before bed (blue light suppresses melatonin)",
          "Keep your bedroom dark and cool when you sleep",
        ],
        correctOrder: [0, 1, 2, 3, 4],
        acceptableOrders: [[0,1,2,3,4],[1,0,2,3,4]],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Sleep may be the single most underrated health intervention.",
        answer: true,
        explanation: "Sleep affects virtually every system in the body. Optimizing it provides compounding benefits across all aspects of health.",
      },
    ],
  },
  {
    id: 'longevity-5-2',
    unitId: 'longevity-5',
    order: 2,
    title: "Stress: The Double-Edged Sword",
    content: {
      intro: `Acute stress is essential—it helped our ancestors survive. But chronic stress, the kind modern life generates constantly, is a major driver of aging and disease.

Acute vs. chronic stress: Acute stress mobilizes resources, enhances focus, then resolves. Chronic stress keeps your system in constant high alert. The stress response is meant to be temporary—not perpetual.

How chronic stress damages health: Keeps cortisol elevated—promotes belly fat, insulin resistance, bone loss. Suppresses immune function. Increases inflammation. Accelerates telomere shortening. Impairs sleep. Drives unhealthy behaviors (eating, drinking, smoking).

The stress-disease connection: Chronic stress increases risk of heart disease, diabetes, depression, cognitive decline, and even cancer. It accelerates biological aging measurably.

Stress management strategies: Exercise—one of the most effective stress reducers. Meditation and breathwork—activates the relaxation response. Social connection—buffers stress effects. Time in nature—reduces cortisol. Sleep—stress and sleep form a vicious or virtuous cycle. Purpose and meaning—provides resilience.

You can't eliminate stress, but you can build resilience and activate recovery.`,
      keyPoint: "Chronic stress accelerates aging and disease through multiple pathways—exercise, meditation, social connection, and sleep build resilience.",
    },
    games: [
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Acute stress", right: "Temporary, adaptive response" },
          { left: "Chronic stress", right: "Constant high alert—damaging" },
          { left: "Elevated cortisol", right: "Promotes belly fat and insulin resistance" },
          { left: "Social connection", right: "Buffers stress effects" },
        ],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "How does chronic stress damage health?",
        options: [
          { text: "Keeps cortisol elevated", correct: true },
          { text: "Suppresses immune function", correct: true },
          { text: "Increases inflammation", correct: true },
          { text: "Accelerates telomere shortening", correct: true },
          { text: "Builds muscle", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "The stress response is designed to be active constantly.",
        answer: false,
        explanation: "The stress response is meant to be temporary—mobilize, respond, recover. Chronic activation causes damage.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Chronic stress increases risk of heart disease, diabetes, depression, and accelerates _______ aging.",
        options: ['biological', 'mental', 'emotional', 'spiritual'],
        answer: 'biological',
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Which strategies help manage chronic stress?",
        options: [
          { text: "Regular exercise", correct: true },
          { text: "Meditation and breathwork", correct: true },
          { text: "Social connection", correct: true },
          { text: "Chronic isolation", correct: false },
          { text: "Time in nature", correct: true },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Two people face the same work stressor. Person A exercises regularly, meditates, has strong social connections, and sleeps well. Person B is sedentary, isolated, and sleep-deprived. Person A copes much better with no lasting health effects.",
        question: "Why the difference?",
        options: [
          { text: "Person A has less stressful work", correct: false },
          { text: "Person A has built stress resilience through lifestyle", correct: true },
          { text: "Genetics", correct: false },
        ],
        explanation: "Lifestyle factors build stress resilience. The same stressor affects people differently based on their coping resources.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order from the cause to the consequence: How does chronic stress speed up aging?",
        items: [
          "The stress response stays constantly activated (it was designed to be temporary)",
          "Cortisol remains elevated day after day",
          "High cortisol drives chronic inflammation throughout the body",
          "Telomeres shorten faster under chronic inflammatory conditions",
          "Your biological age accelerates — you age faster than your calendar age",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Exercise is one of the most effective stress management tools available.",
        answer: true,
        explanation: "Exercise reduces cortisol, increases endorphins, improves sleep, and builds overall stress resilience.",
      },
    ],
  },
  {
    id: 'longevity-5-3',
    unitId: 'longevity-5',
    order: 3,
    title: "Movement: The Non-Negotiable",
    content: {
      intro: `If exercise were a pill, it would be the most powerful medicine ever invented. Nothing else provides so many benefits with so few side effects.

What exercise does: Improves insulin sensitivity. Reduces inflammation. Enhances mitochondrial function. Promotes autophagy. Builds and maintains muscle (crucial for aging). Protects brain function. Reduces risk of virtually every chronic disease. Extends lifespan and healthspan.

Sedentary behavior is uniquely harmful. Even if you exercise, prolonged sitting still causes damage. Movement throughout the day matters, not just workouts.

What's needed: Aerobic exercise—improves cardiovascular health, mitochondria, mood. Strength training—essential for maintaining muscle mass with age, insulin sensitivity, bone health. Movement throughout the day—breaks up sitting, maintains metabolic flexibility. The combination is more powerful than any single type.

Minimum effective dose: 150 minutes moderate or 75 minutes vigorous aerobic per week. 2+ strength sessions per week. Regular movement breaks throughout the day.

The best exercise is the one you'll actually do consistently. But including both cardio and strength provides complementary benefits.`,
      keyPoint: "Exercise is the closest thing to a miracle drug—it improves virtually every health marker and both aerobic and strength training are essential.",
    },
    games: [
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What does regular exercise do?",
        options: [
          { text: "Improves insulin sensitivity", correct: true },
          { text: "Reduces inflammation", correct: true },
          { text: "Enhances mitochondrial function", correct: true },
          { text: "Protects brain function", correct: true },
          { text: "Accelerates aging", correct: false },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Minimum recommendation: ___ minutes of moderate aerobic exercise per week.",
        options: ['150', '30', '60', '300'],
        answer: '150',
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Aerobic exercise", right: "Cardiovascular health, mitochondria" },
          { left: "Strength training", right: "Muscle mass, bone health, insulin sensitivity" },
          { left: "Movement breaks", right: "Breaks up harmful sitting" },
          { left: "Sedentary behavior", right: "Harmful even if you exercise" },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "If you do a daily workout, sitting the rest of the day doesn't matter.",
        answer: false,
        explanation: "Prolonged sitting is harmful independent of exercise. Movement throughout the day matters.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Why is strength training important for aging?",
        options: [
          { text: "Maintains muscle mass", correct: true },
          { text: "Improves insulin sensitivity", correct: true },
          { text: "Protects bone health", correct: true },
          { text: "Only matters for athletes", correct: false },
          { text: "Supports functional independence", correct: true },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Two 70-year-olds are studied. One has done both cardio and strength training for decades. The other only walks. The strength trainer has maintained much more muscle mass and has better metabolic markers.",
        question: "What explains the difference?",
        options: [
          { text: "Genetics", correct: false },
          { text: "Walking is equally effective as combined training", correct: false },
          { text: "Strength training provides unique benefits for aging that cardio alone doesn't provide", correct: true },
        ],
        explanation: "While walking is excellent, strength training is essential for maintaining muscle mass, which declines significantly without resistance training.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Rank these exercise priorities from the MOST essential baseline to the guiding principle:",
        items: [
          "150 min moderate OR 75 min vigorous aerobic exercise per week (the baseline)",
          "2+ strength training sessions per week (essential for muscle and bone)",
          "Regular movement breaks throughout the day (sitting is harmful even if you exercise)",
          "Combine both aerobic AND strength training (each provides unique benefits)",
          "Prioritize consistency over intensity (showing up regularly beats occasional hard sessions)",
        ],
        correctOrder: [0, 1, 2, 3, 4],
        acceptableOrders: [[0,1,2,3,4],[1,0,2,3,4]],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "The best exercise is the one you'll actually do consistently.",
        answer: true,
        explanation: "Consistency matters more than optimal programming. But including both cardio and strength provides the most complete benefits.",
      },
    ],
  },
  {
    id: 'longevity-5-4',
    unitId: 'longevity-5',
    order: 4,
    title: "Connection and Purpose",
    content: {
      intro: `Loneliness is as harmful to health as smoking 15 cigarettes a day. Social connection and sense of purpose are not luxuries—they're biological necessities.

The research is clear: Strong social connections reduce mortality by ~50%. Loneliness increases inflammation, impairs immune function, and accelerates aging. Blue Zones (regions with most centenarians) share strong community ties. Purpose in life predicts longer lifespan independent of other factors.

How connection affects biology: Positive social interaction reduces cortisol. Oxytocin from bonding reduces inflammation. Social support buffers stress effects. Engagement provides cognitive stimulation.

How purpose affects health: Having a reason to get up reduces mortality risk. Purpose provides stress resilience. Engaged people take better care of themselves. Meaning creates motivation for healthy behaviors.

Building connection and purpose: Prioritize relationships—quantity matters less than quality. Find community—shared interests, values, or goals. Cultivate purpose—what matters to you beyond yourself? Stay engaged—retirement from work shouldn't mean retirement from life.

These "soft" factors have hard biological effects.`,
      keyPoint: "Social connection and purpose are biological necessities—loneliness is as harmful as smoking and purpose extends lifespan.",
    },
    games: [
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Loneliness is as harmful to health as smoking ___ cigarettes a day.",
        options: ['15', '5', '2', '30'],
        answer: '15',
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "How does social connection affect health?",
        options: [
          { text: "Reduces mortality by ~50%", correct: true },
          { text: "Decreases inflammation", correct: true },
          { text: "Reduces cortisol", correct: true },
          { text: "Buffers stress effects", correct: true },
          { text: "No biological effects", correct: false },
        ],
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Loneliness", right: "Increases inflammation and accelerates aging" },
          { left: "Strong social ties", right: "Common in Blue Zones (longevity regions)" },
          { left: "Purpose in life", right: "Predicts longer lifespan" },
          { left: "Oxytocin from bonding", right: "Reduces inflammation" },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Social connection is a 'nice to have' but doesn't really affect health.",
        answer: false,
        explanation: "Social connection has profound biological effects—isolation is one of the strongest predictors of early death.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "How does purpose affect health?",
        options: [
          { text: "Reduces mortality risk", correct: true },
          { text: "Provides stress resilience", correct: true },
          { text: "Creates motivation for healthy behaviors", correct: true },
          { text: "Has no measurable health effects", correct: false },
          { text: "Keeps people engaged and active", correct: true },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "A retiree who was previously very social becomes isolated after retirement. Despite good diet and exercise, their health markers worsen significantly over two years.",
        question: "What likely explains this decline?",
        options: [
          { text: "Normal aging", correct: false },
          { text: "Social isolation has profound negative effects on biology independent of other health behaviors", correct: true },
          { text: "They need more exercise", correct: false },
        ],
        explanation: "Connection is a biological need. Isolation increases inflammation, cortisol, and accelerates aging even with other healthy behaviors.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order these from the foundation to the full picture: How to build connection and purpose in your life:",
        items: [
          "Start by prioritizing quality relationships (depth over quantity)",
          "Find or build a community around shared interests or values",
          "Cultivate a sense of purpose that extends beyond yourself",
          "Stay engaged in meaningful activities that challenge and fulfill you",
          "Balance giving support to others with being open to receiving it",
        ],
        correctOrder: [0, 1, 2, 3, 4],
        acceptableOrders: [[0,1,2,3,4],[0,1,3,2,4]],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Blue Zones (regions with most centenarians) share strong community ties as a common factor.",
        answer: true,
        explanation: "Social connection is one of the consistent factors across all Blue Zones, suggesting its fundamental importance for longevity.",
      },
    ],
  },
  {
    id: 'longevity-5-5',
    unitId: 'longevity-5',
    order: 5,
    title: "The Longevity Blueprint",
    content: {
      intro: `All the science points to the same core principles. Here's your longevity blueprint—the fundamentals that, when practiced consistently, maximize your healthy years.

The pillars of longevity: Movement—both structured exercise and daily activity. Nutrition—predominantly plants, whole foods, appropriate calories. Sleep—7-9 hours, consistent timing, quality focus. Stress management—build recovery into your life. Connection—relationships and community. Purpose—reason and meaning beyond yourself.

What the research consistently shows: No single intervention matters as much as the combination. Consistency beats intensity—small actions compounded over years. It's never too late to start—benefits occur at any age. Perfect isn't the goal—sustainable is.

The 80/20 principle: Get the basics right most of the time. Exercise regularly. Eat mostly plants and whole foods. Sleep enough. Manage stress. Stay connected. Have purpose.

These aren't complicated interventions—they're the fundamentals our biology evolved to expect. Modern life has made them harder to achieve, but they remain what our bodies need.

Start where you are. Improve what you can. Be patient with the process.`,
      keyPoint: "Longevity comes from consistent practice of the fundamentals: movement, nutrition, sleep, stress management, connection, and purpose.",
    },
    games: [
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What are the core pillars of longevity?",
        options: [
          { text: "Movement", correct: true },
          { text: "Nutrition (plants, whole foods)", correct: true },
          { text: "Quality sleep", correct: true },
          { text: "Stress management", correct: true },
          { text: "Expensive supplements", correct: false },
        ],
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Consistency", right: "Beats intensity over time" },
          { left: "Starting at any age", right: "Still provides benefits" },
          { left: "Perfection", right: "Not the goal—sustainable is" },
          { left: "The fundamentals", right: "What our biology evolved to expect" },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "There's one single intervention that matters more than all the others combined.",
        answer: false,
        explanation: "The combination of lifestyle factors matters more than any single intervention. Synergy between them provides the greatest benefit.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "The 80/20 principle: Get the _______ right most of the time.",
        options: ['basics', 'supplements', 'genetics', 'tests'],
        answer: 'basics',
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What does the research consistently show?",
        options: [
          { text: "Combination matters more than single interventions", correct: true },
          { text: "Consistency beats intensity", correct: true },
          { text: "Benefits occur at any starting age", correct: true },
          { text: "Sustainable beats perfect", correct: true },
          { text: "Only genetics matter", correct: false },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Rank the longevity fundamentals from the physical foundation to the psychological pillars:",
        items: [
          "Movement — both structured exercise and daily activity (the physical foundation)",
          "Nutrition — predominantly plants and whole foods (fuel for everything)",
          "Sleep — 7-9 hours of quality sleep (when repair and recovery happen)",
          "Stress management — build recovery and calm into your life",
          "Connection + Purpose — relationships and meaning (the psychological pillars)",
        ],
        correctOrder: [0, 1, 2, 3, 4],
        acceptableOrders: [[0,1,2,3,4],[0,2,1,3,4],[1,0,2,3,4],[1,2,0,3,4],[2,0,1,3,4],[2,1,0,3,4]],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Person A follows an 80/20 approach—mostly healthy with occasional indulgences, consistent over 20 years. Person B is perfect for 3 months, then quits and restarts repeatedly. Person A has far better outcomes.",
        question: "What's the lesson?",
        options: [
          { text: "Person A has better genetics", correct: false },
          { text: "Sustainable consistency beats intermittent perfection", correct: true },
          { text: "Person B wasn't trying hard enough", correct: false },
        ],
        explanation: "Long-term consistency with the fundamentals creates compounding benefits. Perfect short-term efforts that can't be sustained don't provide the same results.",
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "It's never too late to start—benefits from lifestyle changes occur at any age.",
        answer: true,
        explanation: "Research shows that adopting healthy behaviors provides benefits even later in life. The best time to start is now.",
      },
    ],
  },
        ],
        'workouts-1': [
  {
    id: 'workouts-1-1',
    unitId: 'workouts-1',
    order: 1,
    title: "The Principle of Adaptation",
    content: {
      intro: `Your body is a remarkable adaptation machine. When you stress it through exercise, it doesn't just recover—it overcompensates, becoming stronger, faster, or more efficient.

This is the General Adaptation Syndrome (GAS), first described by Hans Selye. There are three phases: Alarm (the stress disrupts homeostasis), Resistance (the body adapts to handle the stress), and Exhaustion (if stress continues too long without recovery, performance declines).

The key insight: Training doesn't make you fitter—recovery does. The workout is the stimulus; the adaptation happens during rest. This is why sleep, nutrition, and recovery days are as important as the training itself.

Your body adapts specifically to the demands placed on it. This means training must be intentional. Random exercise produces random results.`,
      keyPoint: "Training provides the stimulus; adaptation and improvement happen during recovery.",
    },
    games: [
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What are the phases of General Adaptation Syndrome?",
        options: [
          { text: "Alarm", correct: true },
          { text: "Resistance", correct: true },
          { text: "Exhaustion", correct: true },
          { text: "Acceleration", correct: false },
          { text: "Maintenance", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Training itself makes you stronger.",
        answer: false,
        explanation: "Training provides the stimulus, but adaptation (getting stronger) happens during recovery.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "The body doesn't just recover from training stress—it _______, becoming stronger.",
        options: ['overcompensates', 'maintains', 'weakens', 'stabilizes'],
        answer: 'overcompensates',
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Alarm phase", right: "Stress disrupts homeostasis" },
          { left: "Resistance phase", right: "Body adapts to handle stress" },
          { left: "Exhaustion phase", right: "Performance declines" },
          { left: "Recovery", right: "Where adaptation happens" },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Alex trains hard every day without rest days, hoping to maximize gains. After 6 weeks, performance has actually declined and motivation is low.",
        question: "What happened?",
        options: [
          { text: "Alex didn't train hard enough", correct: false },
          { text: "Alex reached the exhaustion phase from insufficient recovery", correct: true },
          { text: "Alex needs different exercises", correct: false },
        ],
        explanation: "Without adequate recovery, the body enters the exhaustion phase of GAS, leading to overtraining and decreased performance.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order the adaptation process from the workout to improved performance:",
        items: [
          "Apply training stress (the workout)",
          "Body enters the alarm phase — homeostasis is disrupted",
          "Recovery begins during rest, sleep, and nutrition",
          "Adaptation occurs — body rebuilds stronger than before",
          "Performance improves as a result of the full cycle",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Sleep and nutrition are as important as training for adaptation.",
        answer: true,
        explanation: "Recovery—including sleep and nutrition—is when adaptation actually happens. Without proper recovery, training stress doesn't lead to improvement.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What factors support training adaptation?",
        options: [
          { text: "Quality sleep", correct: true },
          { text: "Proper nutrition", correct: true },
          { text: "Rest days", correct: true },
          { text: "Training every day without breaks", correct: false },
        ],
      },
    ],
  },
  {
    id: 'workouts-1-2',
    unitId: 'workouts-1',
    order: 2,
    title: "Progressive Overload",
    content: {
      intro: `Progressive overload is the most fundamental training principle: To continue adapting, you must gradually increase the demands on your body over time.

Your body is efficient—it only maintains adaptations it needs. If you keep doing the same workout with the same weights and reps, your body has no reason to get stronger. It's already adapted to that stress.

Overload can come in many forms: more weight, more reps, more sets, shorter rest periods, better form, increased range of motion, or more training frequency. The key is progression—not doing more every single session, but trending upward over weeks and months.

Important: Progressive overload must be gradual. Jumping too fast causes injury and overtraining. A 2-5% increase in load per week is sustainable for most people.`,
      keyPoint: "To keep improving, gradually increase training demands over time.",
    },
    games: [
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Doing the same workout indefinitely will continue producing gains.",
        answer: false,
        explanation: "The body adapts to the stress it receives. Without progressive overload, adaptations plateau.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Which are valid ways to apply progressive overload?",
        options: [
          { text: "Increase weight", correct: true },
          { text: "Increase reps", correct: true },
          { text: "Decrease rest periods", correct: true },
          { text: "Improve form/range of motion", correct: true },
          { text: "Always double the weight each week", correct: false },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "A sustainable rate of load increase is typically _______% per week.",
        options: ['2-5', '10-15', '20-25', '50'],
        answer: '2-5',
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Maria has been bench pressing 50kg for 3x10 for six months. She's frustrated that she's not getting stronger.",
        question: "What's the issue?",
        options: [
          { text: "She needs more protein", correct: false },
          { text: "She hasn't applied progressive overload—the stimulus hasn't increased", correct: true },
          { text: "Bench press doesn't build strength", correct: false },
        ],
        explanation: "Without progressive overload, the body has no reason to continue adapting. Maria needs to gradually increase weight, reps, or sets.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order the progressive overload cycle from starting point to ongoing progress:",
        items: [
          "Start with an appropriate baseline (weight, reps, sets)",
          "Body adapts to that level of stress over several sessions",
          "Slightly increase the demand (add weight, reps, or sets)",
          "Body adapts to the new, higher level of stress",
          "Continue this gradual progression over weeks and months",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Volume overload", right: "More sets or reps" },
          { left: "Intensity overload", right: "More weight" },
          { left: "Density overload", right: "Shorter rest periods" },
          { left: "Technique overload", right: "Better form or range of motion" },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "You should increase training demand every single session.",
        answer: false,
        explanation: "Progressive overload is about trending upward over weeks and months, not necessarily every session. Some fluctuation is normal.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What happens without progressive overload?",
        options: [
          { text: "Progress plateaus", correct: true },
          { text: "Body maintains but doesn't improve", correct: true },
          { text: "Efficiency stays the same", correct: false },
          { text: "Continuous improvement", correct: false },
        ],
      },
    ],
  },
  {
    id: 'workouts-1-3',
    unitId: 'workouts-1',
    order: 3,
    title: "Specificity: Train for Your Goal",
    content: {
      intro: `The SAID principle—Specific Adaptation to Imposed Demands—means your body adapts specifically to the type of stress you apply. Want to get better at running? Run. Want to get stronger at squats? Squat.

This seems obvious, but many people train randomly and wonder why they don't reach their goals. A marathon runner who only lifts weights won't improve their running. A powerlifter who only does cardio won't get stronger.

Specificity applies to: movement patterns (squat vs. lunge), energy systems (aerobic vs. anaerobic), muscle groups, speed of movement, and even angles and ranges of motion.

However, this doesn't mean only doing one thing. General fitness supports specific goals, and variety prevents overuse injuries. The balance is: most training should be specific to your goal, with some general work for balance.`,
      keyPoint: "Your body adapts specifically to the demands you place on it—train for what you want to achieve.",
    },
    games: [
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "SAID stands for Specific Adaptation to _______ Demands.",
        options: ['Imposed', 'Internal', 'Increasing', 'Individual'],
        answer: 'Imposed',
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Goal: Run faster", right: "Train: Running with speed work" },
          { left: "Goal: Bigger muscles", right: "Train: Hypertrophy training" },
          { left: "Goal: Lift heavier", right: "Train: Strength training" },
          { left: "Goal: Better endurance", right: "Train: Aerobic conditioning" },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Tom wants to improve his 5K running time. He spends most of his training time doing heavy weightlifting with minimal running.",
        question: "Is this an effective approach?",
        options: [
          { text: "Yes, strength helps running", correct: false },
          { text: "No, his training lacks specificity—he needs to run more", correct: true },
          { text: "Yes, any exercise improves all fitness", correct: false },
        ],
        explanation: "While some strength training can support running, the majority of training should be running if that's the specific goal.",
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Specificity means you should only ever do one type of exercise.",
        answer: false,
        explanation: "Most training should be specific to your goal, but general fitness work provides balance and prevents overuse injuries.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Specificity applies to which training factors?",
        options: [
          { text: "Movement patterns", correct: true },
          { text: "Energy systems used", correct: true },
          { text: "Speed of movement", correct: true },
          { text: "Time of day", correct: false },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order these specificity steps from goal-setting to progress tracking:",
        items: [
          "Define your specific goal (e.g., stronger squat, faster 5K)",
          "Identify what that goal physically demands (strength? endurance? power?)",
          "Design your training to match those specific demands",
          "Include some general fitness work for balance and injury prevention",
          "Regularly assess your progress toward the specific goal",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "A powerlifter should spend most training time doing powerlifting movements.",
        answer: true,
        explanation: "Specificity dictates that to get better at powerlifting, most training should involve the specific movements and intensities of powerlifting.",
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Sarah wants to build muscle. She alternates between heavy strength training, long-distance running, yoga, and swimming throughout the week.",
        question: "What's the concern with this approach?",
        options: [
          { text: "Too much variety leads to overtraining", correct: false },
          { text: "Lack of specificity—training doesn't consistently target muscle growth", correct: true },
          { text: "These exercises don't work together", correct: false },
        ],
        explanation: "While variety is good, building muscle requires consistent hypertrophy-focused training. Too much conflicting training dilutes the specific stimulus.",
      },
    ],
  },
  {
    id: 'workouts-1-4',
    unitId: 'workouts-1',
    order: 4,
    title: "Recovery: The Hidden Half of Training",
    content: {
      intro: `Recovery is not just the absence of training—it's an active process that determines whether training stress becomes adaptation or breakdown.

Key recovery factors include: Sleep (7-9 hours for most athletes—this is when growth hormone peaks and tissue repair occurs), nutrition (adequate protein for muscle repair, carbs for glycogen replenishment, overall calories for energy), stress management (chronic stress impairs recovery), and active recovery (light movement promotes blood flow without adding stress).

Signs of poor recovery include: persistent fatigue, decreased performance, mood changes, increased illness frequency, and loss of motivation. These are warnings to address recovery before pushing harder.

The fitness-fatigue model explains this well: After training, you accumulate both fitness and fatigue. Performance only improves when fatigue dissipates faster than fitness—which requires adequate recovery.`,
      keyPoint: "Recovery determines whether training stress becomes improvement or breakdown.",
    },
    games: [
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What are key factors in training recovery?",
        options: [
          { text: "Sleep (7-9 hours)", correct: true },
          { text: "Adequate nutrition", correct: true },
          { text: "Stress management", correct: true },
          { text: "Training every day without breaks", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Growth hormone and tissue repair peak during sleep.",
        answer: true,
        explanation: "Sleep is when the body does most of its repair and adaptation work, making it essential for training results.",
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Protein", right: "Muscle repair" },
          { left: "Carbohydrates", right: "Glycogen replenishment" },
          { left: "Sleep", right: "Growth hormone release" },
          { left: "Active recovery", right: "Blood flow without stress" },
        ],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Which are warning signs of inadequate recovery?",
        options: [
          { text: "Persistent fatigue", correct: true },
          { text: "Decreased performance", correct: true },
          { text: "Increased illness frequency", correct: true },
          { text: "Feeling energized and strong", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Jake trains hard 6 days a week but only sleeps 5 hours per night. Despite consistent training, his strength has plateaued for months.",
        question: "What's the likely issue?",
        options: [
          { text: "He needs to train harder", correct: false },
          { text: "Insufficient sleep is impairing recovery and adaptation", correct: true },
          { text: "He should add a 7th training day", correct: false },
        ],
        explanation: "Sleep is essential for recovery and adaptation. Without adequate sleep, training stress doesn't translate into improvement.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "In the fitness-fatigue model, performance improves when fatigue dissipates faster than _______.",
        options: ['fitness', 'motivation', 'stress', 'volume'],
        answer: 'fitness',
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order the training-recovery cycle from workout to performance gain:",
        items: [
          "Apply training stress (your workout session)",
          "Both fatigue AND fitness accumulate from the session",
          "Recovery begins (sleep, nutrition, rest days)",
          "Fatigue dissipates faster than the fitness you gained",
          "Net result: a performance gain emerges",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Active recovery (light movement) can enhance recovery compared to complete rest.",
        answer: true,
        explanation: "Light movement promotes blood flow and nutrient delivery to muscles without adding significant stress, often enhancing recovery.",
      },
    ],
  },
  {
    id: 'workouts-1-5',
    unitId: 'workouts-1',
    order: 5,
    title: "Periodization: Training in Phases",
    content: {
      intro: `Periodization is the systematic planning of training into distinct phases to optimize long-term progress and prevent plateaus. Rather than doing the same training year-round, you vary intensity, volume, and focus in planned cycles.

The basic structure: Macrocycle (long-term plan, often a year), mesocycle (training block of 3-6 weeks with specific focus), and microcycle (typically a week of training).

Common models include: Linear periodization (gradually increase intensity while decreasing volume), undulating periodization (vary intensity within each week), and block periodization (focused blocks on single qualities like strength, then power, then sport-specific).

Why periodize? You can't maximize everything at once. Focusing on one quality at a time is more effective. It also prevents monotony, manages fatigue, and allows peaking for important events or goals.`,
      keyPoint: "Periodization organizes training into strategic phases for optimal long-term progress.",
    },
    games: [
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Macrocycle", right: "Long-term plan (often a year)" },
          { left: "Mesocycle", right: "Training block (3-6 weeks)" },
          { left: "Microcycle", right: "Single week of training" },
          { left: "Periodization", right: "Systematic phase planning" },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Linear periodization gradually increases _______ while decreasing volume.",
        options: ['intensity', 'frequency', 'variety', 'rest'],
        answer: 'intensity',
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "You can maximize strength, endurance, and hypertrophy all at the same time.",
        answer: false,
        explanation: "Different qualities require different training emphases. Periodization allows focusing on one quality at a time for better results.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What are benefits of periodization?",
        options: [
          { text: "Prevents training plateaus", correct: true },
          { text: "Manages fatigue accumulation", correct: true },
          { text: "Allows peaking for events", correct: true },
          { text: "Eliminates the need for recovery", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Coach designs a program: 4 weeks of higher volume/moderate weight, then 4 weeks of moderate volume/heavier weight, then 4 weeks of low volume/very heavy weight before competition.",
        question: "What type of periodization is this?",
        options: [
          { text: "Undulating periodization", correct: false },
          { text: "Linear periodization—systematic progression from volume to intensity", correct: true },
          { text: "Random periodization", correct: false },
        ],
        explanation: "This is linear periodization, progressively shifting from higher volume/lower intensity to lower volume/higher intensity.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order the phases of linear periodization from first to last:",
        items: [
          "Hypertrophy phase — high volume, moderate intensity (build muscle base)",
          "Strength phase — moderate volume, higher intensity (build max strength)",
          "Power phase — low volume, high intensity (convert strength to power)",
          "Peaking phase — very low volume, maximum intensity (reach peak performance)",
          "Recovery/transition phase — deload and prepare for next cycle",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Undulating periodization varies intensity within each week rather than across months.",
        answer: true,
        explanation: "Undulating (or nonlinear) periodization changes training variables more frequently, often varying intensity throughout a single week.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Common periodization models include:",
        options: [
          { text: "Linear periodization", correct: true },
          { text: "Undulating periodization", correct: true },
          { text: "Block periodization", correct: true },
          { text: "Chaos periodization", correct: false },
        ],
      },
    ],
  },
        ],
        'workouts-2': [
  {
    id: 'workouts-2-1',
    unitId: 'workouts-2',
    order: 1,
    title: "Neural Adaptations to Strength Training",
    content: {
      intro: `When you start strength training, your initial gains come primarily from your nervous system, not bigger muscles. This is why beginners can double their strength in months without much visible muscle growth.

Neural adaptations include: improved motor unit recruitment (activating more muscle fibers), better rate coding (firing motor units faster), enhanced intermuscular coordination (muscles working together), improved intramuscular coordination (fibers within a muscle synchronizing), and reduced antagonist co-activation (less braking from opposing muscles).

These neural improvements explain why skill matters in strength training. A lift isn't just about muscle size—it's about your nervous system's ability to coordinate forceful, efficient movement. This is why practicing the specific movements you want to improve is essential.

Neural adaptations occur quickly (weeks) and account for most early strength gains. Muscle hypertrophy contributes more to long-term strength development.`,
      keyPoint: "Early strength gains come from neural adaptations—your brain learning to use your muscles more effectively.",
    },
    games: [
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What are neural adaptations to strength training?",
        options: [
          { text: "Better motor unit recruitment", correct: true },
          { text: "Improved muscle coordination", correct: true },
          { text: "Faster motor unit firing", correct: true },
          { text: "Immediate muscle growth", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Beginners can significantly increase strength without visible muscle growth.",
        answer: true,
        explanation: "Early strength gains are primarily neural—the nervous system learns to use existing muscle more effectively.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Motor unit _______ means activating more muscle fibers during a contraction.",
        options: ['recruitment', 'relaxation', 'fatigue', 'atrophy'],
        answer: 'recruitment',
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Motor unit recruitment", right: "Activating more muscle fibers" },
          { left: "Rate coding", right: "Firing motor units faster" },
          { left: "Intermuscular coordination", right: "Muscles working together" },
          { left: "Reduced co-activation", right: "Less braking from opposing muscles" },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "A new lifter increases their squat from 60kg to 100kg in 8 weeks. Their legs don't look noticeably bigger.",
        question: "How is this possible?",
        options: [
          { text: "The scale must be wrong", correct: false },
          { text: "Neural adaptations allow strength gains without significant muscle growth", correct: true },
          { text: "They lost fat while gaining muscle", correct: false },
        ],
        explanation: "Beginners experience rapid neural adaptations that dramatically improve strength before significant hypertrophy occurs.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order the timeline of strength adaptations from when you start training:",
        items: [
          "You begin strength training for the first time",
          "Neural adaptations kick in first (weeks 1-6) — brain learns to use muscles better",
          "You experience rapid strength gains despite little visible muscle change",
          "Hypertrophy (muscle growth) begins contributing (after week 6+)",
          "Long-term strength comes from BOTH continued neural AND muscle adaptations",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Practicing specific movements improves neural efficiency for those movements.",
        answer: true,
        explanation: "Strength has a skill component—the nervous system becomes more efficient at coordinating specific movement patterns with practice.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Why does technique matter for strength?",
        options: [
          { text: "Better coordination produces more force", correct: true },
          { text: "Efficient movement uses muscles optimally", correct: true },
          { text: "Neural pathways strengthen with practice", correct: true },
          { text: "Muscle size is all that matters", correct: false },
        ],
      },
    ],
  },
  {
    id: 'workouts-2-2',
    unitId: 'workouts-2',
    order: 2,
    title: "Force Production Fundamentals",
    content: {
      intro: `Strength is the ability to produce force. Understanding how force is produced helps you train more effectively.

Force production depends on: muscle cross-sectional area (bigger muscles can produce more force), neural drive (how effectively you recruit and coordinate muscle fibers), muscle fiber type (fast-twitch fibers produce more force), biomechanics (leverage and joint angles), and stretch-shortening cycle (using elastic energy).

The force-velocity relationship is crucial: You can either move heavy weight slowly or light weight quickly, but not heavy weight quickly. Maximum force occurs at zero velocity (isometric); maximum velocity occurs at zero load. Power is the combination—force times velocity.

This is why training goals determine training methods. Maximum strength requires heavy, slower movements. Power requires lighter, explosive movements. Different adaptations require different stimuli.`,
      keyPoint: "Force production depends on muscle size, neural factors, and biomechanics working together.",
    },
    games: [
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Muscle size", right: "More cross-sectional area = more force" },
          { left: "Neural drive", right: "Motor unit recruitment efficiency" },
          { left: "Fast-twitch fibers", right: "High force production" },
          { left: "Biomechanics", right: "Leverage and joint angles" },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Power equals force multiplied by _______.",
        options: ['velocity', 'time', 'distance', 'mass'],
        answer: 'velocity',
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Maximum force is produced during fast movements.",
        answer: false,
        explanation: "The force-velocity relationship shows that maximum force occurs at zero or very low velocities (isometric or slow movements).",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What factors influence force production?",
        options: [
          { text: "Muscle cross-sectional area", correct: true },
          { text: "Neural drive and recruitment", correct: true },
          { text: "Joint angles and leverage", correct: true },
          { text: "The color of your gym clothes", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Two athletes squat the same weight. Athlete A has longer femurs than Athlete B. Athlete A finds the lift harder.",
        question: "Why might this be?",
        options: [
          { text: "Athlete A is weaker", correct: false },
          { text: "Biomechanics—longer limbs create different leverage demands", correct: true },
          { text: "Athlete B cheated", correct: false },
        ],
        explanation: "Limb length affects leverage and joint angles, changing the mechanical demands of a lift. Longer limbs often increase the difficulty.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Arrange these from MAXIMUM FORCE (slowest) to MAXIMUM SPEED (lightest):",
        items: [
          "Isometric hold (no movement) — produces the most force possible",
          "Slow heavy lifts — very high force, low speed",
          "Moderate speed movements — moderate force output",
          "Fast movements — force decreases as speed increases",
          "Maximum velocity movements — minimal force, maximum speed",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Fast-twitch muscle fibers produce more force than slow-twitch fibers.",
        answer: true,
        explanation: "Fast-twitch (Type II) fibers generate higher forces but fatigue quickly. Slow-twitch (Type I) fibers produce less force but resist fatigue.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "To train for maximum strength, you should:",
        options: [
          { text: "Use heavy loads", correct: true },
          { text: "Allow full recovery between sets", correct: true },
          { text: "Focus on progressive overload", correct: true },
          { text: "Only do high-rep sets", correct: false },
        ],
      },
    ],
  },
  {
    id: 'workouts-2-3',
    unitId: 'workouts-2',
    order: 3,
    title: "Strength Training Variables",
    content: {
      intro: `Effective strength training requires understanding how to manipulate key variables: intensity, volume, frequency, rest periods, and exercise selection.

Intensity (load) is the percentage of your one-rep max (1RM). For strength, 80-90%+ of 1RM is most effective. This means sets of 1-6 reps typically.

Volume is sets × reps × load. For strength, moderate volume with high intensity works best—quality over quantity.

Rest periods for strength should be 2-5 minutes between sets. This allows neural recovery for maximum force production each set.

Frequency depends on recovery capacity. Most can train a movement pattern 2-3x per week. More advanced lifters often need more recovery time.

Exercise selection should prioritize compound movements (squat, deadlift, bench, row, press) that train multiple muscles and allow heavy loading.`,
      keyPoint: "Strength training uses heavy loads (80-90%+ 1RM), low reps (1-6), long rest (2-5min), and compound exercises.",
    },
    games: [
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "For strength training, the optimal intensity is typically _______% of 1RM or higher.",
        options: ['80-90', '40-50', '60-70', '100+'],
        answer: '80-90',
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What are appropriate rep ranges for strength training?",
        options: [
          { text: "1-3 reps", correct: true },
          { text: "4-6 reps", correct: true },
          { text: "15-20 reps", correct: false },
          { text: "30+ reps", correct: false },
        ],
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Intensity", right: "Percentage of 1RM" },
          { left: "Volume", right: "Sets × reps × load" },
          { left: "Frequency", right: "Training sessions per week" },
          { left: "Rest periods", right: "Recovery between sets" },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Short rest periods (30-60 seconds) are optimal for strength training.",
        answer: false,
        explanation: "Strength training requires 2-5 minutes rest between sets to allow neural recovery for maximum force production.",
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "A lifter does 5 sets of squats with only 60 seconds rest. By set 4, their strength has dropped significantly.",
        question: "What's happening?",
        options: [
          { text: "They're not strong enough", correct: false },
          { text: "Insufficient rest prevents neural recovery, reducing force production", correct: true },
          { text: "They need more cardio", correct: false },
        ],
        explanation: "Strength training requires longer rest periods (2-5 minutes) to maintain force output across sets.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Which exercises are best for strength training?",
        options: [
          { text: "Squat", correct: true },
          { text: "Deadlift", correct: true },
          { text: "Bench press", correct: true },
          { text: "Wrist curls only", correct: false },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order a strength session from start to finish:",
        items: [
          "Warm-up thoroughly (raise body temperature, mobilize joints)",
          "Compound lifts first — do your heaviest work while fresh",
          "Accessory/isolation work after — these need less neural freshness",
          "Take adequate rest between sets (2-5 min for strength)",
          "Cool down (light movement, stretching)",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Compound movements are preferred for strength because they allow heavier loading.",
        answer: true,
        explanation: "Compound exercises like squats and deadlifts engage multiple muscle groups, allowing you to lift heavier loads and develop more total-body strength.",
      },
    ],
  },
  {
    id: 'workouts-2-4',
    unitId: 'workouts-2',
    order: 4,
    title: "Programming for Strength",
    content: {
      intro: `Strength programs organize training variables into coherent plans. Several proven approaches exist.

Linear progression: Add weight each session (beginner-friendly). Examples: Starting Strength, StrongLifts 5×5. Works until you can't recover between sessions.

Weekly progression: Add weight each week. Better for intermediates who need more recovery time.

Periodized programs: Vary intensity/volume in planned phases. Examples include Texas Method (volume day, recovery day, intensity day) and 5/3/1 (wave loading across weeks).

Key principles across all programs: progressive overload drives gains, consistency matters more than perfection, compound lifts form the foundation, and recovery must match training stress.

Choose a program based on your training age (experience), recovery capacity, and schedule. The best program is one you'll actually follow consistently.`,
      keyPoint: "Effective strength programs provide structure for progressive overload while managing fatigue.",
    },
    games: [
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Linear progression", right: "Add weight each session" },
          { left: "Weekly progression", right: "Add weight each week" },
          { left: "Periodized program", right: "Planned intensity/volume phases" },
          { left: "5/3/1", right: "Wave loading across weeks" },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Linear progression works indefinitely for all lifters.",
        answer: false,
        explanation: "Linear progression eventually stalls when you can't recover between sessions. More advanced methods are then needed.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What are examples of beginner strength programs?",
        options: [
          { text: "Starting Strength", correct: true },
          { text: "StrongLifts 5×5", correct: true },
          { text: "Advanced Russian peaking cycles", correct: false },
          { text: "Bodybuilding splits with isolation exercises", correct: false },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "The Texas Method uses a _______ day, recovery day, and intensity day each week.",
        options: ['volume', 'cardio', 'flexibility', 'technique'],
        answer: 'volume',
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "A beginner adds 2.5kg to their squat every session. After 3 months, progress has stalled and they can't complete their sets anymore.",
        question: "What should they do?",
        options: [
          { text: "Keep trying the same weight until it works", correct: false },
          { text: "Switch to a weekly progression program—they've outgrown linear progression", correct: true },
          { text: "Stop strength training entirely", correct: false },
        ],
        explanation: "When linear progression stalls, it's time for a program with slower progression that allows more recovery.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What principles are common across effective strength programs?",
        options: [
          { text: "Progressive overload", correct: true },
          { text: "Compound lifts as foundation", correct: true },
          { text: "Recovery matching training stress", correct: true },
          { text: "Random exercise selection each day", correct: false },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order these from BEGINNER to ELITE: How does progression strategy change as you advance?",
        items: [
          "Beginner — can add weight session to session (linear progression)",
          "Intermediate — can add weight week to week (weekly progression)",
          "Advanced — needs multi-week periodization to keep progressing",
          "Elite — requires annual periodization with planned peaks",
        ],
        correctOrder: [0, 1, 2, 3],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "The best strength program is one you'll actually follow consistently.",
        answer: true,
        explanation: "Consistency over time matters more than having the 'perfect' program. A good program followed consistently beats a perfect program done inconsistently.",
      },
    ],
  },
  {
    id: 'workouts-2-5',
    unitId: 'workouts-2',
    order: 5,
    title: "Building Your Strength Foundation",
    content: {
      intro: `Practical strength training comes down to mastering fundamentals and being consistent over time.

The core lifts to master: Squat (knee-dominant, whole lower body), hip hinge/deadlift (hip-dominant, posterior chain), horizontal push (bench press, chest/shoulders/triceps), horizontal pull (rows, back/biceps), vertical push (overhead press), and vertical pull (pull-ups/lat pulldowns).

Form fundamentals: Maintain neutral spine under load, create full-body tension, control the weight through full range of motion, and breathe properly (brace before lift, exhale through sticking point or at lockout).

Common mistakes: Going too heavy too soon (ego lifting), neglecting warm-ups, inconsistent training, not tracking progress, and ignoring recovery. Avoid these, be patient, and strength will come.

Remember: Strength is built over years, not weeks. Trust the process.`,
      keyPoint: "Master fundamental movement patterns, maintain consistency, and build strength progressively over years.",
    },
    games: [
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Squat", right: "Knee-dominant, lower body" },
          { left: "Deadlift", right: "Hip-dominant, posterior chain" },
          { left: "Bench press", right: "Horizontal push" },
          { left: "Row", right: "Horizontal pull" },
        ],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What are form fundamentals for strength training?",
        options: [
          { text: "Maintain neutral spine under load", correct: true },
          { text: "Create full-body tension", correct: true },
          { text: "Control through full range of motion", correct: true },
          { text: "Hold your breath the entire set", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "You should lift as heavy as possible from day one to maximize gains.",
        answer: false,
        explanation: "Going too heavy too soon (ego lifting) leads to poor form and injury. Build up progressively with good technique.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "The deadlift is a _______-dominant movement targeting the posterior chain.",
        options: ['hip', 'knee', 'ankle', 'shoulder'],
        answer: 'hip',
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "A new lifter wants to get strong as fast as possible. They skip warm-ups to save time, load the bar heavy immediately, and train 7 days a week.",
        question: "What's likely to happen?",
        options: [
          { text: "Fastest possible gains", correct: false },
          { text: "Increased injury risk and poor recovery leading to stalled progress", correct: true },
          { text: "Moderate but steady progress", correct: false },
        ],
        explanation: "Skipping warm-ups, ego lifting, and inadequate recovery are recipes for injury and burnout, not faster gains.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Common strength training mistakes include:",
        options: [
          { text: "Ego lifting (too heavy too soon)", correct: true },
          { text: "Neglecting warm-ups", correct: true },
          { text: "Inconsistent training", correct: true },
          { text: "Progressive overload", correct: false },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Arrange the fundamental movement patterns from lower body to upper body:",
        items: [
          "Squat — knee-dominant lower body (legs, glutes, core)",
          "Hip hinge — hip-dominant lower body (hamstrings, glutes, back)",
          "Horizontal push — chest, shoulders, triceps (bench press)",
          "Horizontal pull — back, biceps (rows)",
          "Vertical push/pull — overhead work (press, pull-ups, lat pulldowns)",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Strength is built over years, not weeks.",
        answer: true,
        explanation: "Meaningful strength development takes consistent training over months and years. Patience and consistency are key.",
      },
    ],
  },
        ],
        'workouts-3': [
  {
    id: 'workouts-3-1',
    unitId: 'workouts-3',
    order: 1,
    title: "The Science of Muscle Growth",
    content: {
      intro: `Muscle hypertrophy (growth) occurs when muscle protein synthesis exceeds muscle protein breakdown over time. This is the fundamental equation: build more than you break down.

Three primary mechanisms drive hypertrophy: mechanical tension (force on the muscle), metabolic stress (the "burn" and pump), and muscle damage (microtears that repair larger). Of these, mechanical tension is most important—lifting challenging weights through a full range of motion.

The process: Training causes micro-damage and signals adaptation. During recovery, satellite cells donate nuclei to muscle fibers. These additional nuclei allow the fiber to produce more protein, growing larger. This is why recovery is essential.

Muscle memory is real: Once you've built muscle, the extra nuclei remain even if the muscle shrinks. This makes regaining lost muscle easier than building it initially.`,
      keyPoint: "Muscle grows when protein synthesis exceeds breakdown, driven primarily by mechanical tension.",
    },
    games: [
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What are the primary mechanisms of muscle hypertrophy?",
        options: [
          { text: "Mechanical tension", correct: true },
          { text: "Metabolic stress", correct: true },
          { text: "Muscle damage", correct: true },
          { text: "Cardio endurance", correct: false },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Muscle grows when protein _______ exceeds protein breakdown.",
        options: ['synthesis', 'consumption', 'digestion', 'storage'],
        answer: 'synthesis',
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Of the hypertrophy mechanisms, mechanical tension is most important.",
        answer: true,
        explanation: "While all three mechanisms contribute, mechanical tension (lifting challenging weights) is the primary driver of muscle growth.",
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Mechanical tension", right: "Force on the muscle" },
          { left: "Metabolic stress", right: "The burn and pump" },
          { left: "Muscle damage", right: "Microtears repaired larger" },
          { left: "Satellite cells", right: "Donate nuclei for growth" },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Someone built significant muscle 10 years ago but stopped training. Now they want to rebuild. They reach their previous size in 3 months instead of the 2 years it originally took.",
        question: "How is this possible?",
        options: [
          { text: "They used different exercises", correct: false },
          { text: "Muscle memory—extra nuclei remain, making regrowth faster", correct: true },
          { text: "They're younger now", correct: false },
        ],
        explanation: "The additional nuclei gained during initial muscle building remain even after muscle shrinks, allowing faster regrowth.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order the muscle growth process from the gym session to bigger muscles:",
        items: [
          "Training applies mechanical tension to the muscle fibers",
          "Microdamage occurs and growth signals are released",
          "During recovery, satellite cells activate and move to the damaged fibers",
          "Satellite cells donate additional nuclei to the muscle fibers",
          "Extra nuclei enable increased protein synthesis — the muscle grows larger",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "The 'pump' (metabolic stress) alone is enough to maximize muscle growth.",
        answer: false,
        explanation: "While the pump contributes to hypertrophy, mechanical tension from challenging weights is the primary driver. You need both.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Why is recovery essential for muscle growth?",
        options: [
          { text: "Protein synthesis occurs during rest", correct: true },
          { text: "Satellite cells activate during recovery", correct: true },
          { text: "Muscle repairs and grows between sessions", correct: true },
          { text: "Muscles grow during the workout", correct: false },
        ],
      },
    ],
  },
  {
    id: 'workouts-3-2',
    unitId: 'workouts-3',
    order: 2,
    title: "Volume: The Key Driver",
    content: {
      intro: `Training volume (sets × reps × load) is the primary driver of hypertrophy when intensity is adequate. More volume generally means more growth—up to a point.

Research suggests optimal ranges: Minimum effective dose is around 10 sets per muscle group per week. Maximum recoverable volume varies but is often 15-20+ sets for most people. More volume works until recovery is compromised.

Volume landmarks: MEV (Minimum Effective Volume) is the least volume needed to grow. MAV (Maximum Adaptive Volume) is where you grow fastest. MRV (Maximum Recoverable Volume) is the most you can recover from. Exceeding MRV leads to overtraining.

Practical application: Start with moderate volume (10-15 sets/muscle/week). Add volume progressively if recovering well. Reduce if showing signs of overreaching. Individual response varies significantly.`,
      keyPoint: "Volume drives hypertrophy—more sets generally means more growth, up to your recovery limits.",
    },
    games: [
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "The minimum effective volume for hypertrophy is approximately _______ sets per muscle per week.",
        options: ['10', '2', '30', '50'],
        answer: '10',
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "MEV", right: "Minimum volume to grow" },
          { left: "MAV", right: "Where you grow fastest" },
          { left: "MRV", right: "Maximum recoverable volume" },
          { left: "Volume", right: "Sets × reps × load" },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "More volume always means more muscle growth.",
        answer: false,
        explanation: "More volume helps until you exceed your Maximum Recoverable Volume (MRV), then growth stalls or reverses.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Signs you may have exceeded your MRV include:",
        options: [
          { text: "Persistent fatigue", correct: true },
          { text: "Declining performance", correct: true },
          { text: "Mood disturbances", correct: true },
          { text: "Feeling energized and making gains", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "A lifter doing 10 sets for chest per week is growing but wants faster results. They jump to 30 sets per week. Two weeks later, they're exhausted and strength has dropped.",
        question: "What happened?",
        options: [
          { text: "They didn't train hard enough", correct: false },
          { text: "They exceeded their MRV and can't recover from that volume", correct: true },
          { text: "30 sets is always better than 10", correct: false },
        ],
        explanation: "Exceeding Maximum Recoverable Volume leads to overreaching. Volume should increase gradually.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order the volume progression approach from starting point to planned deload:",
        items: [
          "Start at moderate volume — just above your Minimum Effective Volume (MEV)",
          "Monitor your recovery and progress closely",
          "Gradually add more sets IF you're recovering well",
          "Approach your Maximum Adaptive Volume (MAV) for optimal gains",
          "Deload (reduce volume) BEFORE reaching your Maximum Recoverable Volume (MRV)",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Individual volume tolerance varies significantly between people.",
        answer: true,
        explanation: "Genetics, training history, sleep, nutrition, and stress all affect how much volume someone can recover from.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What is considered moderate hypertrophy volume for most muscles?",
        options: [
          { text: "10-15 sets per week", correct: true },
          { text: "15-20 sets per week", correct: true },
          { text: "2-3 sets per week", correct: false },
          { text: "50+ sets per week", correct: false },
        ],
      },
    ],
  },
  {
    id: 'workouts-3-3',
    unitId: 'workouts-3',
    order: 3,
    title: "Rep Ranges and Time Under Tension",
    content: {
      intro: `The hypertrophy rep range has traditionally been cited as 6-12 reps, but research shows muscle can be built across a wider range (5-30+ reps) if sets are taken close to failure.

What matters more than specific rep ranges: proximity to failure (last 1-4 reps should be hard), total volume accumulated, and progressive overload over time.

Time under tension (TUT) refers to how long muscles are under load during a set. Moderate tempos (2-3 seconds per rep) seem optimal for hypertrophy. Very fast reps may reduce tension; very slow reps limit load.

Practical recommendations: Use mostly moderate reps (6-12) for compounds. Include some heavier work (4-6 reps) for strength. Include some higher reps (12-20+) for isolation and variety. Take most sets within 1-3 reps of failure.`,
      keyPoint: "Hypertrophy occurs across rep ranges when training close to failure with adequate volume.",
    },
    games: [
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Muscle can only be built in the 8-12 rep range.",
        answer: false,
        explanation: "Research shows hypertrophy occurs across a wide rep range (5-30+) when sets are taken close to failure.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What matters most for hypertrophy?",
        options: [
          { text: "Training close to failure", correct: true },
          { text: "Adequate total volume", correct: true },
          { text: "Progressive overload", correct: true },
          { text: "Exactly 10 reps every set", correct: false },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "For hypertrophy, most sets should be taken within _______-3 reps of failure.",
        options: ['1', '10', '20', '0'],
        answer: '1',
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Low reps (4-6)", right: "Strength emphasis, some hypertrophy" },
          { left: "Moderate reps (6-12)", right: "Classic hypertrophy range" },
          { left: "Higher reps (12-20+)", right: "Metabolic stress, still builds muscle" },
          { left: "Time under tension", right: "Duration muscles are loaded" },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "A lifter does 4 sets of 12 reps but stops each set when it starts feeling hard, keeping 6+ reps in reserve.",
        question: "Is this optimal for hypertrophy?",
        options: [
          { text: "Yes, 12 reps is the hypertrophy range", correct: false },
          { text: "No—sets aren't close enough to failure to maximize growth stimulus", correct: true },
          { text: "Yes, avoiding failure is always best", correct: false },
        ],
        explanation: "Proximity to failure matters more than rep count. Sets should be within 1-3 reps of failure for optimal hypertrophy.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Rank these hypertrophy factors from MOST important to LEAST important:",
        items: [
          "Train close to failure (1-3 reps in reserve) — the #1 growth signal",
          "Accumulate adequate total volume (sets per muscle per week)",
          "Apply progressive overload consistently over time",
          "Use a variety of rep ranges (heavy, moderate, and high reps)",
          "Control your rep tempo appropriately (2-3 seconds per rep)",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Very slow rep tempos (10+ seconds per rep) are superior for hypertrophy.",
        answer: false,
        explanation: "Extremely slow tempos limit the load you can use. Moderate tempos (2-3 seconds per rep) balance tension and load.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What rep ranges should be included in a hypertrophy program?",
        options: [
          { text: "6-12 reps for main compounds", correct: true },
          { text: "4-6 reps for strength work", correct: true },
          { text: "12-20+ reps for isolation/variety", correct: true },
          { text: "Only one rep range, always", correct: false },
        ],
      },
    ],
  },
  {
    id: 'workouts-3-4',
    unitId: 'workouts-3',
    order: 4,
    title: "Exercise Selection for Growth",
    content: {
      intro: `Effective hypertrophy training uses a mix of compound and isolation exercises strategically chosen to target all muscle groups through their full range of motion.

Compound exercises (squat, deadlift, bench, rows) train multiple muscles efficiently and allow heavy loading. They form the foundation of any program.

Isolation exercises (curls, extensions, lateral raises) target specific muscles that may be undertrained by compounds. They allow focused work without systemic fatigue.

Exercise selection principles: Include at least one exercise per muscle group, use exercises that challenge muscles in their stretched position (often more growth stimulus), vary angles and grips for complete development, and choose exercises you can perform safely with good technique.

Most muscles benefit from 2-4 exercises per week hitting different angles or portions of the strength curve.`,
      keyPoint: "Combine compound and isolation exercises to fully develop each muscle group.",
    },
    games: [
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Compound exercise", right: "Multiple muscles, heavy loading" },
          { left: "Isolation exercise", right: "Single muscle focus" },
          { left: "Stretched position", right: "Often more growth stimulus" },
          { left: "Varied angles", right: "Complete muscle development" },
        ],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Which are compound exercises?",
        options: [
          { text: "Squat", correct: true },
          { text: "Bench press", correct: true },
          { text: "Rows", correct: true },
          { text: "Bicep curls", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Isolation exercises are unnecessary for hypertrophy.",
        answer: false,
        explanation: "While compounds form the foundation, isolation exercises target muscles that may be undertrained by compounds and allow focused work.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Most muscles benefit from _______-4 exercises per week hitting different angles.",
        options: ['2', '10', '1', '15'],
        answer: '2',
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "A lifter only does bench press for chest—no incline, no flyes, no dips. After a year, their upper chest and inner chest are noticeably underdeveloped.",
        question: "What's the issue?",
        options: [
          { text: "Bench press doesn't work chest", correct: false },
          { text: "Lack of exercise variety leaves parts of the muscle undertrained", correct: true },
          { text: "They need more bench press volume", correct: false },
        ],
        explanation: "Different exercises and angles target different portions of muscles. Variety ensures complete development.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Exercise selection principles include:",
        options: [
          { text: "Challenge muscles in stretched positions", correct: true },
          { text: "Vary angles and grips", correct: true },
          { text: "Choose exercises with good technique", correct: true },
          { text: "Only do one exercise per muscle ever", correct: false },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order these exercise selection steps from the foundation to the fine-tuning:",
        items: [
          "Include compound movements as the foundation (squat, bench, rows)",
          "Add isolation exercises for muscles undertrained by compounds",
          "Select exercises that challenge muscles in stretched positions (more growth stimulus)",
          "Vary angles and grips for complete muscle development",
          "Ensure you can perform every exercise with safe, controlled technique",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Exercises that challenge muscles in their stretched position often produce more growth.",
        answer: true,
        explanation: "Research suggests exercises loading muscles in the stretched position may provide additional hypertrophy stimulus.",
      },
    ],
  },
  {
    id: 'workouts-3-5',
    unitId: 'workouts-3',
    order: 5,
    title: "Building a Hypertrophy Program",
    content: {
      intro: `Bringing it together: An effective hypertrophy program balances volume, intensity, exercise selection, and recovery.

Program structures: Push/Pull/Legs (train each 2x/week), Upper/Lower split (4 days/week), Full body (3 days/week), or Bro split (each muscle 1x/week—less optimal for most). Higher frequency (2x/week per muscle) often works better.

Weekly setup example (PPL): Push A (chest focus), Pull A (back focus), Legs A, Push B (shoulder focus), Pull B (back width), Legs B. Each session: 4-6 exercises, 3-4 sets each, moderate to high intensity.

Progression: Track weights and reps. Add reps within target range, then add weight when you hit the top of the range. Every 4-6 weeks, take a deload (reduced volume/intensity) to manage fatigue.

Remember: Consistency beats perfection. The best program is one you'll do consistently with effort.`,
      keyPoint: "Effective hypertrophy programs train muscles 2x/week with adequate volume and progressive overload.",
    },
    games: [
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Push/Pull/Legs", right: "6 sessions, 2x frequency per muscle" },
          { left: "Upper/Lower", right: "4 sessions, 2x frequency" },
          { left: "Full body", right: "3 sessions, 3x frequency" },
          { left: "Bro split", right: "Each muscle 1x/week" },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Training each muscle once per week is optimal for most people.",
        answer: false,
        explanation: "Research suggests training each muscle 2x per week typically produces better results than 1x per week for most people.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What are effective hypertrophy program structures?",
        options: [
          { text: "Push/Pull/Legs", correct: true },
          { text: "Upper/Lower split", correct: true },
          { text: "Full body 3x/week", correct: true },
          { text: "Training randomly with no structure", correct: false },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "A deload (reduced volume/intensity) should occur every _______-6 weeks to manage fatigue.",
        options: ['4', '1', '12', '20'],
        answer: '4',
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "A lifter has been training hard for 8 weeks straight. Performance is declining, motivation is low, and joints are achy.",
        question: "What should they do?",
        options: [
          { text: "Push through—more training is always better", correct: false },
          { text: "Take a deload week to allow accumulated fatigue to dissipate", correct: true },
          { text: "Quit lifting entirely", correct: false },
        ],
        explanation: "After several weeks of hard training, a deload (reduced volume/intensity) allows recovery and sets up the next training block.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order the double progression method from starting point to cycle restart:",
        items: [
          "Start with a weight at the BOTTOM of your target rep range (e.g., 3x8)",
          "Each session, try to add reps (3x9, 3x10, etc.)",
          "Reach the TOP of your target rep range (e.g., 3x12)",
          "Increase the weight and drop back to the bottom of the range (3x8 again)",
          "Repeat this cycle — you're now stronger than where you started",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Tracking weights and reps is important for progressive overload.",
        answer: true,
        explanation: "Without tracking, it's hard to ensure you're actually progressively overloading. Data helps ensure continued progress.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Key elements of a hypertrophy program include:",
        options: [
          { text: "2x per week muscle frequency", correct: true },
          { text: "10-20 sets per muscle per week", correct: true },
          { text: "Progressive overload tracking", correct: true },
          { text: "Never taking deloads", correct: false },
        ],
      },
    ],
  },
        ],
        'workouts-4': [
  {
    id: 'workouts-4-1',
    unitId: 'workouts-4',
    order: 1,
    title: "Energy Systems: Your Body's Fuel Pathways",
    content: {
      intro: `Your body has three energy systems that power different types of activity. Understanding them helps you train smarter.

The phosphagen system (ATP-PC): Provides immediate, explosive energy for 0-10 seconds. Think: sprints, heavy lifts, jumps. No oxygen needed, but very limited capacity.

The glycolytic system: Kicks in for 10 seconds to 2 minutes of high-intensity work. Burns glucose, produces lactate. The "burning" sensation during hard intervals.

The aerobic system: Powers longer-duration activities (2+ minutes to hours). Uses oxygen to burn carbs and fat. Lower intensity but nearly unlimited capacity.

All three systems work simultaneously—the dominant one depends on intensity and duration. Sprint training develops the phosphagen system. Interval training improves glycolytic capacity. Long, steady cardio builds aerobic base.`,
      keyPoint: "Three energy systems power different activities: phosphagen (explosive), glycolytic (high-intensity), aerobic (endurance).",
    },
    games: [
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Phosphagen (ATP-PC)", right: "0-10 seconds, explosive" },
          { left: "Glycolytic", right: "10 sec-2 min, high intensity" },
          { left: "Aerobic", right: "2+ min to hours, endurance" },
          { left: "All three systems", right: "Work simultaneously" },
        ],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Which activities primarily use the phosphagen system?",
        options: [
          { text: "Sprinting (10 seconds)", correct: true },
          { text: "Heavy single-rep lifts", correct: true },
          { text: "Vertical jumps", correct: true },
          { text: "30-minute jog", correct: false },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "The _______ system produces the 'burning' sensation during hard intervals.",
        options: ['glycolytic', 'aerobic', 'phosphagen', 'digestive'],
        answer: 'glycolytic',
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "During a 400m sprint race, an athlete feels their legs 'burning' intensely and slowing down significantly in the final 100m.",
        question: "What's happening physiologically?",
        options: [
          { text: "They didn't warm up enough", correct: false },
          { text: "The glycolytic system is producing lactate faster than it can be cleared", correct: true },
          { text: "They ran out of fat to burn", correct: false },
        ],
        explanation: "The 400m heavily taxes the glycolytic system, producing lactate and hydrogen ions that cause the burning sensation.",
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "The aerobic system can only burn carbohydrates for fuel.",
        answer: false,
        explanation: "The aerobic system can burn both carbohydrates and fat for fuel, making it sustainable for long-duration activity.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Arrange these from SHORTEST duration to LONGEST — which energy system dominates at each?",
        items: [
          "0-10 seconds — Phosphagen system dominant (explosive power)",
          "10-30 seconds — Phosphagen fading, glycolytic kicking in",
          "30 sec-2 min — Glycolytic system dominant (the 'burn')",
          "2-5 min — Glycolytic fading, aerobic system taking over",
          "5+ min — Aerobic system dominant (sustainable endurance)",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What does the aerobic system provide?",
        options: [
          { text: "Sustained energy for long activities", correct: true },
          { text: "Uses oxygen to produce ATP", correct: true },
          { text: "Can burn fat for fuel", correct: true },
          { text: "Maximum explosive power", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Only one energy system works at a time.",
        answer: false,
        explanation: "All three energy systems work simultaneously—the dominant one depends on the intensity and duration of the activity.",
      },
    ],
  },
  {
    id: 'workouts-4-2',
    unitId: 'workouts-4',
    order: 2,
    title: "Heart Rate Zones",
    content: {
      intro: `Heart rate training uses zones based on percentage of your maximum heart rate (HRmax) to target different adaptations.

Estimated HRmax: 220 minus age (rough estimate) or better measured through a max test.

Zone 1 (50-60% HRmax): Recovery, very light. Active recovery, warm-ups.

Zone 2 (60-70% HRmax): Aerobic base. Fat burning, build endurance. You can hold a conversation.

Zone 3 (70-80% HRmax): Tempo/threshold. Comfortably hard, improves aerobic capacity.

Zone 4 (80-90% HRmax): High intensity. Hard effort, improves lactate threshold.

Zone 5 (90-100% HRmax): Maximum effort. Very short duration, develops power and speed.

The "80/20 rule" is well-supported: Approximately 80% of training at low intensity (Zone 1-2) and 20% at high intensity (Zone 4-5). This builds a strong aerobic base while developing speed.`,
      keyPoint: "Heart rate zones target different adaptations—most training should be low intensity with some high-intensity work.",
    },
    games: [
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Zone 1-2 (50-70%)", right: "Aerobic base, fat burning" },
          { left: "Zone 3 (70-80%)", right: "Tempo, aerobic capacity" },
          { left: "Zone 4 (80-90%)", right: "Lactate threshold" },
          { left: "Zone 5 (90-100%)", right: "Maximum power/speed" },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "The 80/20 rule suggests _______% of training at low intensity and 20% at high intensity.",
        options: ['80', '50', '20', '100'],
        answer: '80',
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Zone 2 training means you should be breathing too hard to hold a conversation.",
        answer: false,
        explanation: "Zone 2 (aerobic base) is low enough intensity that you can maintain a conversation while training.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What are benefits of Zone 2 (aerobic base) training?",
        options: [
          { text: "Builds endurance foundation", correct: true },
          { text: "Improves fat utilization", correct: true },
          { text: "Low injury risk", correct: true },
          { text: "Maximizes sprint speed", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "A runner trains at moderate-hard intensity every run, never going easy or doing intervals. They plateau despite training consistently.",
        question: "What might help?",
        options: [
          { text: "More moderate-intensity runs", correct: false },
          { text: "Polarize training—more easy Zone 2 work and some hard Zone 4-5 intervals", correct: true },
          { text: "Stop running entirely", correct: false },
        ],
        explanation: "The 80/20 polarized approach (mostly easy, some very hard) typically produces better results than always training at moderate intensity.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Arrange heart rate zones from EASIEST (lowest intensity) to HARDEST (maximum effort):",
        items: [
          "Zone 1: Recovery — 50-60% max HR (very easy, conversational)",
          "Zone 2: Aerobic base — 60-70% max HR (comfortable, can talk in full sentences)",
          "Zone 3: Tempo — 70-80% max HR (comfortably hard, shorter sentences only)",
          "Zone 4: Threshold — 80-90% max HR (hard, only a few words at a time)",
          "Zone 5: Maximum — 90-100% max HR (all-out, can't talk at all)",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "220 minus age gives an exact measurement of maximum heart rate.",
        answer: false,
        explanation: "220 minus age is only a rough estimate. Individual variation is significant—actual max HR is better measured through testing.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What does Zone 4 training improve?",
        options: [
          { text: "Lactate threshold", correct: true },
          { text: "Ability to sustain harder efforts", correct: true },
          { text: "High-intensity performance", correct: true },
          { text: "Recovery and rest", correct: false },
        ],
      },
    ],
  },
  {
    id: 'workouts-4-3',
    unitId: 'workouts-4',
    order: 3,
    title: "Aerobic vs Anaerobic Training",
    content: {
      intro: `Aerobic training uses oxygen to produce energy and can be sustained for long periods. Anaerobic training exceeds oxygen supply and relies on stored fuels, limiting duration.

Aerobic adaptations include: increased mitochondria (more energy factories), improved capillary density (better oxygen delivery), enhanced heart stroke volume (more blood per beat), better fat utilization, and improved recovery capacity.

Anaerobic adaptations include: higher lactate tolerance, improved buffering capacity (handling acid), faster phosphocreatine recovery, and increased glycolytic enzymes.

Most sports and fitness goals benefit from both. Aerobic fitness provides the foundation—better recovery between intervals, sustained performance, and health benefits. Anaerobic training adds the ability to work at high intensities.

Training both doesn't mean doing both in equal amounts. Build the aerobic base first; add anaerobic work on top.`,
      keyPoint: "Aerobic training builds the foundation; anaerobic training adds high-intensity capacity.",
    },
    games: [
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What are aerobic training adaptations?",
        options: [
          { text: "Increased mitochondria", correct: true },
          { text: "Improved capillary density", correct: true },
          { text: "Better fat utilization", correct: true },
          { text: "Maximum sprint speed", correct: false },
        ],
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Aerobic", right: "Uses oxygen, sustainable" },
          { left: "Anaerobic", right: "Exceeds oxygen supply, limited duration" },
          { left: "Mitochondria", right: "Cellular energy factories" },
          { left: "Lactate tolerance", right: "Handling acid buildup" },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Aerobic fitness improves heart stroke _______, meaning more blood pumped per beat.",
        options: ['volume', 'rate', 'pressure', 'flow'],
        answer: 'volume',
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Anaerobic training should be prioritized before building an aerobic base.",
        answer: false,
        explanation: "The aerobic system provides the foundation—better recovery, sustained performance. Build aerobic fitness first, then add anaerobic work.",
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "An athlete does only sprint intervals, never any steady-state cardio. They're fast in short bursts but gas out quickly and recover slowly between efforts.",
        question: "What's missing?",
        options: [
          { text: "More sprints", correct: false },
          { text: "Aerobic base training for better recovery and sustained performance", correct: true },
          { text: "They're training perfectly", correct: false },
        ],
        explanation: "Without aerobic fitness, recovery between high-intensity efforts suffers. A strong aerobic base supports all other training.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Anaerobic adaptations include:",
        options: [
          { text: "Higher lactate tolerance", correct: true },
          { text: "Improved acid buffering", correct: true },
          { text: "Faster phosphocreatine recovery", correct: true },
          { text: "Increased capillary density", correct: false },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order the cardiovascular training progression from the foundation to the peak:",
        items: [
          "Establish an aerobic base with easy Zone 2 work (the foundation)",
          "Develop aerobic capacity with tempo/Zone 3 work",
          "Add anaerobic intervals (Zone 4-5) on top of your base",
          "Include sport-specific high-intensity work for your goals",
          "Maintain your aerobic base while peaking for performance",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "A strong aerobic base improves recovery between high-intensity intervals.",
        answer: true,
        explanation: "Aerobic fitness enhances recovery capacity, allowing you to do more quality high-intensity work.",
      },
    ],
  },
  {
    id: 'workouts-4-4',
    unitId: 'workouts-4',
    order: 4,
    title: "Types of Cardio Training",
    content: {
      intro: `Different cardio modalities produce different adaptations. Understanding them helps you choose the right tool for your goals.

Low-Intensity Steady State (LISS): Zone 2, sustainable pace. Builds aerobic base, promotes recovery, low stress. Examples: walking, easy jogging, cycling.

Moderate-Intensity Continuous Training (MICT): Zone 3, "comfortably hard." Improves aerobic capacity and lactate threshold. The classic "cardio" workout.

High-Intensity Interval Training (HIIT): Repeated bursts of hard effort (Zone 4-5) with recovery periods. Time-efficient, improves both aerobic and anaerobic fitness.

Sprint Interval Training (SIT): Maximum effort sprints with full recovery. Develops power and anaerobic capacity.

The best approach: Mostly LISS for base building (it's the foundation), some HIIT for time efficiency and fitness gains, occasional MICT for specific threshold work. Match modality to goals.`,
      keyPoint: "Different cardio types serve different purposes—use LISS for base, HIIT for efficiency, and match to your goals.",
    },
    games: [
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "LISS", right: "Low intensity, Zone 2, base building" },
          { left: "MICT", right: "Moderate intensity, comfortably hard" },
          { left: "HIIT", right: "Hard intervals with recovery" },
          { left: "SIT", right: "Max effort sprints, full recovery" },
        ],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What are benefits of LISS (Low-Intensity Steady State)?",
        options: [
          { text: "Builds aerobic base", correct: true },
          { text: "Low stress and injury risk", correct: true },
          { text: "Promotes recovery", correct: true },
          { text: "Maximizes anaerobic power", correct: false },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "HIIT stands for High-Intensity _______ Training.",
        options: ['Interval', 'Incremental', 'Impact', 'Isolated'],
        answer: 'Interval',
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Someone with limited time wants to improve cardiovascular fitness. They can only train 3x per week for 20-30 minutes.",
        question: "What cardio approach might work best?",
        options: [
          { text: "Only 3-hour long runs", correct: false },
          { text: "HIIT—time-efficient with good aerobic and anaerobic benefits", correct: true },
          { text: "Complete rest is better", correct: false },
        ],
        explanation: "HIIT is time-efficient and produces significant cardiovascular improvements in shorter sessions.",
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "HIIT should replace all other forms of cardio.",
        answer: false,
        explanation: "HIIT is valuable but should complement LISS for base building. Too much high-intensity work leads to burnout.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Arrange these cardio types from LOWEST intensity to HIGHEST intensity:",
        items: [
          "LISS — walking, easy jogging (lowest intensity, highly sustainable)",
          "MICT — 'comfortably hard' steady pace (moderate intensity)",
          "HIIT — hard intervals with recovery periods (high intensity)",
          "SIT — all-out maximum sprints (highest intensity, shortest duration)",
        ],
        correctOrder: [0, 1, 2, 3],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "HIIT improves:",
        options: [
          { text: "Aerobic fitness", correct: true },
          { text: "Anaerobic capacity", correct: true },
          { text: "Time efficiency", correct: true },
          { text: "Only fat burning", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Sprint Interval Training (SIT) uses maximum effort with full recovery between sprints.",
        answer: true,
        explanation: "SIT involves all-out sprints (typically 10-30 seconds) with complete recovery (2-4 minutes) to allow repeated maximum efforts.",
      },
    ],
  },
  {
    id: 'workouts-4-5',
    unitId: 'workouts-4',
    order: 5,
    title: "Building Your Cardio Program",
    content: {
      intro: `A well-designed cardio program balances different intensities and progresses appropriately over time.

Starting point: If you're new to cardio, begin with LISS (walking, easy cycling) for 2-4 weeks. Build the aerobic base before adding intensity.

Weekly structure example: 2-3 LISS sessions (30-60 min Zone 2), 1-2 HIIT sessions (15-25 min), optional tempo/threshold work (20-40 min Zone 3).

Progression: Increase duration before intensity. Add 10% volume per week maximum. Add intensity gradually after base is established.

Integration with lifting: Separate cardio and lifting by several hours if possible, or do cardio on separate days. Do lifting first if doing both same day. Keep interference minimal by not overdoing HIIT.

Listen to your body: Heart rate variability (HRV), resting heart rate, and subjective fatigue guide recovery needs. More isn't always better.`,
      keyPoint: "Build aerobic base first, add intensity gradually, and balance cardio with other training.",
    },
    games: [
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order the steps for building a cardio program from scratch:",
        items: [
          "Establish a LISS base — easy cardio only for the first 2-4 weeks",
          "Gradually increase LISS duration (max 10% per week)",
          "Add 1-2 HIIT sessions per week once your base is solid",
          "Include optional tempo work for threshold development",
          "Continuously adjust volume and intensity based on your recovery",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "When progressing cardio, increase volume by maximum _______% per week.",
        options: ['10', '50', '100', '5'],
        answer: '10',
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "A balanced weekly cardio structure might include:",
        options: [
          { text: "2-3 LISS sessions (Zone 2)", correct: true },
          { text: "1-2 HIIT sessions", correct: true },
          { text: "Optional tempo work", correct: true },
          { text: "HIIT every day", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "If combining cardio and lifting in one session, do cardio first.",
        answer: false,
        explanation: "Do lifting first to ensure strength performance isn't compromised. Cardio can follow if needed.",
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Someone new to exercise jumps straight into 5 HIIT sessions per week with no base building. Within 3 weeks, they're exhausted and injured.",
        question: "What went wrong?",
        options: [
          { text: "HIIT doesn't work", correct: false },
          { text: "Too much too soon—no aerobic base, excessive high-intensity stress", correct: true },
          { text: "They needed 7 HIIT sessions", correct: false },
        ],
        explanation: "Building an aerobic base and progressing gradually prevents overtraining and injury. Start with LISS, add intensity slowly.",
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Duration before intensity", right: "Progress time first, then add intensity" },
          { left: "10% rule", right: "Maximum weekly volume increase" },
          { left: "HRV and resting HR", right: "Recovery indicators" },
          { left: "Separate cardio and lifting", right: "Minimize interference" },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "More cardio is always better for fitness.",
        answer: false,
        explanation: "Like all training, cardio requires recovery. More isn't always better—listen to recovery indicators and avoid overtraining.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Recovery indicators for cardio training include:",
        options: [
          { text: "Heart rate variability (HRV)", correct: true },
          { text: "Resting heart rate", correct: true },
          { text: "Subjective fatigue levels", correct: true },
          { text: "The temperature outside", correct: false },
        ],
      },
    ],
  },
        ],
        'workouts-5': [
  {
    id: 'workouts-5-1',
    unitId: 'workouts-5',
    order: 1,
    title: "Power and Explosiveness",
    content: {
      intro: `Power is force times velocity—the ability to produce force quickly. While strength is about maximum force, power is about expressing force at speed.

Power training includes: Olympic lifts (cleans, snatches), plyometrics (jumps, bounds), medicine ball throws, and speed work. These train the nervous system to recruit muscle fibers rapidly.

The force-velocity spectrum: Maximum strength (heavy, slow) → Strength-speed (moderately heavy, faster) → Speed-strength (lighter, very fast) → Maximum speed (minimal load). Complete athletes train across this spectrum.

Power development requires quality over volume. You can't develop power while fatigued—rest fully between sets (2-5 minutes). Keep reps low (1-5) and focus on maximum intent and bar speed.

Power training is best done fresh, at the beginning of workouts, when the nervous system is primed for explosive output.`,
      keyPoint: "Power is force at speed—train explosively when fresh, with full recovery between sets.",
    },
    games: [
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Power equals force multiplied by _______.",
        options: ['velocity', 'time', 'distance', 'weight'],
        answer: 'velocity',
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What exercises develop power?",
        options: [
          { text: "Olympic lifts (cleans, snatches)", correct: true },
          { text: "Plyometrics (jumps, bounds)", correct: true },
          { text: "Medicine ball throws", correct: true },
          { text: "Slow, controlled bicep curls", correct: false },
        ],
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Maximum strength", right: "Heavy, slow" },
          { left: "Strength-speed", right: "Moderately heavy, faster" },
          { left: "Speed-strength", right: "Lighter, very fast" },
          { left: "Maximum speed", right: "Minimal load" },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Power training should be done while fatigued to build work capacity.",
        answer: false,
        explanation: "Power development requires a fresh nervous system. Train power at the start of workouts with full recovery between sets.",
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "An athlete does box jumps at the end of their workout when exhausted, with minimal rest between sets and high reps.",
        question: "Is this effective power training?",
        options: [
          { text: "Yes, more volume is better", correct: false },
          { text: "No—fatigue and short rest prevent quality explosive output", correct: true },
          { text: "Yes, fatigue builds power", correct: false },
        ],
        explanation: "Power training requires freshness and full recovery. Fatigued, high-rep plyometrics don't develop power effectively and increase injury risk.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Arrange the force-velocity spectrum from HEAVIEST/SLOWEST to LIGHTEST/FASTEST:",
        items: [
          "Maximum strength — heavy loads, slow movement (e.g., heavy squat)",
          "Strength-speed — moderate loads, faster movement (e.g., power clean)",
          "Speed-strength — light loads, very fast movement (e.g., medicine ball throw)",
          "Maximum speed — minimal load, fastest possible movement (e.g., sprint)",
        ],
        correctOrder: [0, 1, 2, 3],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Power training guidelines include:",
        options: [
          { text: "Do when fresh (start of workout)", correct: true },
          { text: "Full recovery between sets (2-5 min)", correct: true },
          { text: "Low reps (1-5) with max intent", correct: true },
          { text: "High reps until exhaustion", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Complete athletes should train across the entire force-velocity spectrum.",
        answer: true,
        explanation: "Different sports and activities require different points on the force-velocity curve. Training across the spectrum develops complete athleticism.",
      },
    ],
  },
  {
    id: 'workouts-5-2',
    unitId: 'workouts-5',
    order: 2,
    title: "HIIT Deep Dive",
    content: {
      intro: `High-Intensity Interval Training (HIIT) alternates intense work with recovery periods. It's time-efficient and produces significant fitness adaptations.

HIIT variables: Work interval duration (10 sec - 4 min), intensity (80-100% effort), rest interval duration, work-to-rest ratio, and total number of intervals.

Common protocols: Tabata (20 sec work / 10 sec rest × 8), 30/30 (30 sec work / 30 sec rest), 4×4 (4 min work / 3 min rest).

Physiological benefits: Improved VO2max, enhanced mitochondrial function, increased EPOC (calories burned post-exercise), improved insulin sensitivity.

Important limitations: HIIT is stressful and requires recovery. 2-3 sessions per week is appropriate for most people. More isn't better—overuse leads to burnout and overtraining. Balance HIIT with lower-intensity work.`,
      keyPoint: "HIIT is powerful but stressful—2-3 sessions weekly balanced with lower-intensity work is optimal.",
    },
    games: [
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Tabata", right: "20 sec work / 10 sec rest × 8" },
          { left: "30/30", right: "30 sec work / 30 sec rest" },
          { left: "4×4", right: "4 min work / 3 min rest" },
          { left: "EPOC", right: "Calories burned post-exercise" },
        ],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "HIIT variables include:",
        options: [
          { text: "Work interval duration", correct: true },
          { text: "Rest interval duration", correct: true },
          { text: "Work intensity", correct: true },
          { text: "The color of your shoes", correct: false },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Most people should limit HIIT to _______-3 sessions per week.",
        options: ['2', '7', '10', '0'],
        answer: '2',
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "HIIT can improve VO2max.",
        answer: true,
        explanation: "HIIT is highly effective for improving VO2max (maximum oxygen consumption), a key marker of cardiovascular fitness.",
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Someone loves HIIT and does it 6 days per week. After a month, they're constantly tired, performance is declining, and they're getting sick.",
        question: "What's happening?",
        options: [
          { text: "They're finally getting fit", correct: false },
          { text: "Overtraining from too much high-intensity work without recovery", correct: true },
          { text: "HIIT doesn't work", correct: false },
        ],
        explanation: "HIIT is stressful and requires recovery. 6 days per week is excessive and leads to overtraining symptoms.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Benefits of HIIT include:",
        options: [
          { text: "Improved VO2max", correct: true },
          { text: "Time efficiency", correct: true },
          { text: "Enhanced mitochondrial function", correct: true },
          { text: "No need for recovery days", correct: false },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order these steps from the foundation to fine-tuning: How to add HIIT to your program safely:",
        items: [
          "Build an aerobic base with LISS training first (this is the prerequisite)",
          "Introduce 1-2 HIIT sessions per week once your base is solid",
          "Allow full recovery between high-intensity sessions (48+ hours)",
          "Balance your HIIT with continued LISS work for ongoing base maintenance",
          "Monitor fatigue and adjust session frequency based on how you're recovering",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Longer work intervals (3-4 min) target different adaptations than short intervals (20-30 sec).",
        answer: true,
        explanation: "Longer intervals emphasize aerobic capacity; shorter intervals stress anaerobic systems. Both have value.",
      },
    ],
  },
  {
    id: 'workouts-5-3',
    unitId: 'workouts-5',
    order: 3,
    title: "Flexibility and Mobility",
    content: {
      intro: `Flexibility is passive range of motion; mobility is active control through that range. Both matter for performance and injury prevention.

Static stretching: Holding a stretch for 15-60 seconds. Best post-workout or separate from training. May temporarily reduce strength if done before.

Dynamic stretching: Moving through range of motion actively. Ideal for warm-ups, prepares muscles for activity.

Mobility work: Developing strength and control at end ranges. More valuable than passive flexibility for most athletes.

When to stretch: Dynamic mobility before training, static stretching post-workout or separate sessions. Focus on areas that limit your movements.

The goal isn't maximum flexibility—it's having enough range of motion to perform your activities safely and effectively. More isn't always better; hypermobility can increase injury risk.`,
      keyPoint: "Mobility (active control) matters more than passive flexibility—train what your activities require.",
    },
    games: [
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Flexibility", right: "Passive range of motion" },
          { left: "Mobility", right: "Active control through range" },
          { left: "Static stretching", right: "Hold stretch 15-60 sec" },
          { left: "Dynamic stretching", right: "Active movement through range" },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Static stretching before training enhances strength performance.",
        answer: false,
        explanation: "Static stretching before training may temporarily reduce strength. Dynamic mobility is better for warm-ups.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "When is static stretching most appropriate?",
        options: [
          { text: "Post-workout", correct: true },
          { text: "Separate flexibility sessions", correct: true },
          { text: "Before heavy lifting", correct: false },
          { text: "During the main workout", correct: false },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "_______ stretching involves moving through range of motion actively and is ideal for warm-ups.",
        options: ['Dynamic', 'Static', 'Passive', 'Ballistic'],
        answer: 'Dynamic',
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "An athlete can do the splits but has no strength or control at that range. During sports, they frequently pull muscles despite being 'flexible.'",
        question: "What's missing?",
        options: [
          { text: "More static stretching", correct: false },
          { text: "Mobility—active strength and control through their range of motion", correct: true },
          { text: "They should avoid stretching", correct: false },
        ],
        explanation: "Passive flexibility without mobility (active control) doesn't protect against injury. Strength through the full range of motion matters.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order a complete training session from warm-up to cool-down:",
        items: [
          "General movement — 5-10 min light cardio to raise body temperature",
          "Dynamic mobility/stretching — active movements through your range of motion",
          "Workout-specific warm-up — lighter sets of your first exercises",
          "Main training session — your actual workout",
          "Cool-down — static stretching and light movement (optional but helpful)",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Maximum flexibility is always better.",
        answer: false,
        explanation: "The goal is sufficient range of motion for your activities. Hypermobility without control can increase injury risk.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Mobility work focuses on:",
        options: [
          { text: "Strength at end ranges", correct: true },
          { text: "Active control through range", correct: true },
          { text: "Movement-specific flexibility", correct: true },
          { text: "Holding stretches for 5+ minutes", correct: false },
        ],
      },
    ],
  },
  {
    id: 'workouts-5-4',
    unitId: 'workouts-5',
    order: 4,
    title: "Concurrent Training: Balancing Multiple Goals",
    content: {
      intro: `Concurrent training means developing multiple fitness qualities (strength, endurance, power) simultaneously. Most people want some of everything, but there are tradeoffs.

The interference effect: Heavy endurance training can blunt strength and hypertrophy gains. Heavy strength training can limit endurance adaptations. They use some of the same recovery resources.

Minimizing interference: Separate strength and cardio sessions by 6+ hours if possible. Keep cardio volume moderate. Prioritize which quality matters most. Do lifting before cardio if doing both same day.

Practical approach: Choose your primary goal (strength, hypertrophy, endurance) and give it priority. Train secondary qualities at maintenance levels. You can improve everything—just not everything maximally at once.

For most general fitness: 2-4 strength sessions, 2-3 cardio sessions, adequate recovery. This builds strength, muscle, and cardiovascular health without excessive interference.`,
      keyPoint: "You can train multiple qualities, but prioritize what matters most—you can't maximize everything simultaneously.",
    },
    games: [
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What is the interference effect?",
        options: [
          { text: "Endurance training can blunt strength gains", correct: true },
          { text: "Strength training can limit endurance adaptations", correct: true },
          { text: "They compete for recovery resources", correct: true },
          { text: "All training types help each other equally", correct: false },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "To minimize interference, separate strength and cardio sessions by _______+ hours if possible.",
        options: ['6', '1', '24', '0'],
        answer: '6',
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Primary goal", right: "Train with full effort and volume" },
          { left: "Secondary goals", right: "Train at maintenance levels" },
          { left: "Same-day training", right: "Lift before cardio" },
          { left: "Interference effect", right: "Competing adaptations" },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "If doing both lifting and cardio in one session, do cardio first.",
        answer: false,
        explanation: "Lifting should come first to preserve strength performance. Cardio can follow afterward.",
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "An athlete wants to maximize muscle gain while also training for a marathon. They do heavy lifting and long runs every day.",
        question: "What's the likely outcome?",
        options: [
          { text: "Maximum gains in both", correct: false },
          { text: "Interference effect limits both goals; neither is optimized", correct: true },
          { text: "Only running will improve", correct: false },
        ],
        explanation: "Maximizing muscle and marathon training are competing goals. The interference effect means doing both aggressively compromises both.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Strategies to minimize interference include:",
        options: [
          { text: "Separate strength and cardio sessions", correct: true },
          { text: "Keep secondary training moderate", correct: true },
          { text: "Prioritize your main goal", correct: true },
          { text: "Do maximum volume of everything", correct: false },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "If doing strength AND cardio on the same day, order the session from start to finish:",
        items: [
          "Warm-up — prepare the body for what's coming",
          "Power work first (if included) — needs maximum neural freshness",
          "Strength training — do this before cardio to preserve force output",
          "Cardio AFTER lifting — performance here matters less than strength",
          "Cool-down — light movement and stretching",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Most general fitness seekers can effectively train strength and cardio concurrently.",
        answer: true,
        explanation: "For general fitness (not extreme specialization), 2-4 strength sessions and 2-3 cardio sessions weekly works well with proper recovery.",
      },
    ],
  },
  {
    id: 'workouts-5-5',
    unitId: 'workouts-5',
    order: 5,
    title: "Putting It All Together",
    content: {
      intro: `Effective training comes from understanding principles and applying them consistently over time. Here's the synthesis.

Core principles: Progressive overload drives adaptation. Specificity means training for your goals. Recovery is when adaptation happens. Periodization organizes training for long-term progress.

Building your program: Identify your primary goal. Choose a structure that fits your schedule. Include the essentials (strength, cardio, mobility) in appropriate proportions. Track progress and adjust.

Common mistakes to avoid: Too much too soon, no progressive overload, inadequate recovery, lack of specificity, inconsistency.

The most important factors: Consistency over years, not weeks. Effort during training. Progressive challenge. Adequate recovery. Patience.

There's no perfect program—only the one you'll actually do consistently with effort. Start where you are, apply the principles, and trust the process.`,
      keyPoint: "Master the principles, apply them consistently, and trust the long-term process.",
    },
    games: [
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Progressive overload", right: "Drives adaptation" },
          { left: "Specificity", right: "Train for your goals" },
          { left: "Recovery", right: "When adaptation happens" },
          { left: "Periodization", right: "Long-term organization" },
        ],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "The most important training factors are:",
        options: [
          { text: "Consistency over years", correct: true },
          { text: "Effort during training", correct: true },
          { text: "Progressive challenge", correct: true },
          { text: "Finding the 'perfect' program", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "There is one perfect program that works best for everyone.",
        answer: false,
        explanation: "The best program is one you'll do consistently with effort. Individual needs, goals, and preferences vary.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Fitness is built over _______, not weeks.",
        options: ['years', 'days', 'hours', 'minutes'],
        answer: 'years',
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Common training mistakes include:",
        options: [
          { text: "Too much too soon", correct: true },
          { text: "No progressive overload", correct: true },
          { text: "Inadequate recovery", correct: true },
          { text: "Consistent, patient training", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Two people start training. Person A finds a 'perfect' program but switches every 3 weeks and skips sessions. Person B follows a simple program consistently for 2 years, progressively overloading.",
        question: "Who likely makes better progress?",
        options: [
          { text: "Person A—they found the perfect program", correct: false },
          { text: "Person B—consistency and progressive overload over time wins", correct: true },
          { text: "Neither—programs don't matter", correct: false },
        ],
        explanation: "Consistency and progressive overload over time matter far more than program 'perfection.' Person B's approach builds lasting results.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Order these program-building steps from first decision to ongoing practice:",
        items: [
          "Identify your primary goal (strength, muscle, endurance, general fitness)",
          "Choose a program structure that fits your actual schedule",
          "Include the essentials: strength, cardio, and mobility in appropriate proportions",
          "Apply progressive overload — gradually increase the challenge over time",
          "Track your progress, adjust when needed, and stay consistent for years",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Start where you are, apply the principles, and trust the process.",
        answer: true,
        explanation: "This is the essence of effective training. Meet yourself where you are, apply sound principles consistently, and results will come over time.",
      },
    ],
  },
        ],
        'hormones-1': [
            {
                id: 'hormones-1-1', unitId: 'hormones-1', order: 1, title: "The Chemical Messenger System",
                content: {
                    intro: `Hormones aren't feelings. They're chemical molecules that carry instructions from one part of your body to another.\n\nThink of hormones as text messages sent through your bloodstream. Glands produce them, blood carries them, and cells with the right receptors receive them. A hormone that reaches a cell without the matching receptor is ignored—like a locked phone.\n\nThe endocrine system includes your hypothalamus, pituitary, thyroid, adrenals, pancreas, and gonads (ovaries or testes). These glands communicate constantly, adjusting hormone levels based on feedback loops.\n\nMost hormones work through negative feedback. When a hormone's effect reaches a threshold, the body reduces production. Your thermostat works this way—heat turns off when the target temperature is reached.`,
                    keyPoint: "Hormones are chemical messengers that travel through blood to cells with matching receptors, creating body-wide effects regulated by feedback loops.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Hormones are basically the same as emotions or feelings.", answer: false, explanation: "Hormones are physical molecules with specific chemical structures. They can influence how you feel, but they're not feelings themselves—they're messengers carrying instructions." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Nerve signals", right: "Fast, targeted (milliseconds)" },
                        { left: "Hormone signals", right: "Slower, body-wide (seconds to hours)" },
                        { left: "Glands", right: "Produce hormones" },
                        { left: "Receptors", right: "Receive hormone messages" },
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Hormones travel through your _______ to reach target cells.", options: ['bloodstream', 'nerves', 'muscles', 'thoughts'], answer: 'bloodstream' },
                    { type: GAME_TYPES.TAP_ALL, question: "Which are part of the endocrine (hormone) system?", options: [
                        { text: "Pituitary gland", correct: true },
                        { text: "Thyroid", correct: true },
                        { text: "Biceps muscle", correct: false },
                        { text: "Adrenal glands", correct: true },
                        { text: "Pancreas", correct: true },
                        { text: "Stomach lining", correct: false },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from production to effect: How does a hormone signal travel through your body?", items: ["A gland produces and releases a hormone", "The hormone enters your bloodstream", "Blood carries the hormone throughout your entire body", "Only cells with matching receptors can 'read' the hormone's message", "Those target cells change their behavior in response"]},
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "A hormone is released into the bloodstream. Some cells respond dramatically while others ignore it completely.", question: "Why do different cells respond differently?", options: [
                        { text: "Some cells are healthier than others", correct: false },
                        { text: "Only cells with matching receptors can 'hear' the hormone's message", correct: true },
                        { text: "The hormone runs out before reaching all cells", correct: false },
                    ], explanation: "Hormones are like radio broadcasts—only devices tuned to that frequency pick up the signal. Cells without the right receptors simply can't respond." },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Negative feedback means your body reduces hormone production when the effect is strong enough.", answer: true, explanation: "Like a thermostat turning off heat when the room is warm enough, negative feedback prevents hormones from overshooting their target effect." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Calling cortisol 'the stress hormone' is an _______ of what it actually does.", options: ['oversimplification', 'accurate description', 'scientific fact', 'medical term'], answer: 'oversimplification' },
                ]
            },
        ],
        'hormones-2': [
            {
                id: 'hormones-2-1', unitId: 'hormones-2', order: 1, title: "Energy Mobilizers",
                content: {
                    intro: `Cortisol and adrenaline aren't "stress hormones." They're energy mobilizers—their job is to make fuel available for expensive activities.\n\nCORTISOL does several concrete things: It tells your liver to convert stored glycogen into glucose (glycogenolysis). It triggers the creation of new glucose from protein and fat (gluconeogenesis). It suppresses systems that cost energy but aren't immediately necessary—immune function, digestion, reproduction.\n\nCortisol follows a daily rhythm: highest in the morning (preparing you for the day), lowest at night (allowing recovery). Chronic elevation disrupts this rhythm, keeping your body in constant mobilization mode.\n\nADRENALINE works faster than cortisol. It increases heart rate, dilates airways, redirects blood to muscles, and releases glucose from the liver—all within seconds.\n\nThe "fight or flight" response isn't about fear. It's about rapid energy availability.`,
                    keyPoint: "Cortisol and adrenaline mobilize energy by releasing glucose stores and redirecting resources to immediate needs—this is preparation, not panic.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Cortisol's main job is to make you feel stressed.", answer: false, explanation: "Cortisol's job is to mobilize energy—converting stored fuel to available glucose and reallocating resources. You might feel 'stressed' as a side effect, but that's not its purpose." },
                    { type: GAME_TYPES.TAP_ALL, question: "What does cortisol actually do?", options: [
                        { text: "Tells liver to release glucose", correct: true },
                        { text: "Creates new glucose from protein and fat", correct: true },
                        { text: "Suppresses immune function to save energy", correct: true },
                        { text: "Makes you feel anxious", correct: false },
                        { text: "Reduces digestive activity", correct: true },
                        { text: "Causes depression", correct: false },
                    ]},
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Glycogenolysis", right: "Breaking glycogen into glucose" },
                        { left: "Gluconeogenesis", right: "Making new glucose from protein/fat" },
                        { left: "Morning cortisol spike", right: "Preparing for the day ahead" },
                        { left: "Suppressed digestion", right: "Saving energy for immediate needs" },
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Adrenaline increases heart rate, dilates airways, and releases glucose—all to make _______ available.", options: ['energy', 'stress', 'fear', 'emotions'], answer: 'energy' },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from trigger to full activation: What happens during an adrenaline response?", items: ["Brain predicts a demanding or threatening situation", "Adrenal glands release adrenaline into the bloodstream", "Heart rate increases to pump more blood", "Blood redirects away from digestion and toward muscles", "Glucose floods into the bloodstream for immediate energy"], acceptableOrders: [[0,1,2,3,4],[0,1,2,4,3],[0,1,3,2,4],[0,1,3,4,2],[0,1,4,2,3],[0,1,4,3,2]]},
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "An athlete before a competition and someone about to give a speech both experience racing hearts, sweaty palms, and heightened alertness.", question: "What's happening in both cases?", options: [
                        { text: "Both are experiencing harmful stress", correct: false },
                        { text: "Their bodies are mobilizing energy for a demanding task", correct: true },
                        { text: "They're both scared and should calm down", correct: false },
                    ], explanation: "The same physiological preparation happens whether you're excited or nervous. Your body doesn't distinguish—it just makes energy available for something metabolically expensive." },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Cortisol should be highest in the morning and lowest at night.", answer: true, explanation: "This natural rhythm prepares you for daily demands and allows recovery at night. Chronic stress disrupts this pattern, keeping cortisol elevated when it should drop." },
                    { type: GAME_TYPES.TAP_ALL, question: "Why is chronically elevated cortisol problematic?", options: [
                        { text: "Constantly breaks down tissue for fuel", correct: true },
                        { text: "Suppresses immune function long-term", correct: true },
                        { text: "Disrupts sleep and recovery", correct: true },
                        { text: "Cortisol is always bad", correct: false },
                        { text: "Depletes energy reserves over time", correct: true },
                    ]},
                ]
            },
        ],
        'hormones-3': [
            {
                id: 'hormones-3-1', unitId: 'hormones-3', order: 1, title: "The Anabolic Messengers",
                content: {
                    intro: `While cortisol mobilizes and breaks down, anabolic hormones build up. The main players: testosterone, growth hormone, and IGF-1.\n\nTESTOSTERONE isn't just a "male hormone." Both sexes produce it—men in the testes (~7mg/day), women in the ovaries and adrenals (~0.5mg/day). It stimulates muscle protein synthesis, increases bone density, promotes red blood cell production, and affects fat distribution.\n\nGROWTH HORMONE (GH) is released primarily during deep sleep and after intense exercise. It doesn't directly build muscle—instead, it triggers the liver to produce IGF-1 (Insulin-like Growth Factor 1), which does the actual building.\n\nIGF-1 is the workhorse. It stimulates muscle cell growth, helps repair damaged tissue, and promotes cell division.\n\nThese hormones work together. Resistance training elevates all three. Sleep deprivation crushes growth hormone release. Chronic stress (elevated cortisol) suppresses testosterone.`,
                    keyPoint: "Testosterone, growth hormone, and IGF-1 promote tissue building through specific cellular mechanisms—they're affected by training, sleep, and stress.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Testosterone is only produced in males.", answer: false, explanation: "Both sexes produce testosterone—men make about 7mg/day, women make about 0.5mg/day. It's essential for muscle maintenance, bone health, and libido in everyone." },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Testosterone", right: "Activates protein synthesis genes" },
                        { left: "Growth hormone", right: "Triggers IGF-1 production" },
                        { left: "IGF-1", right: "Directly repairs and builds tissue" },
                        { left: "Cortisol", right: "Suppresses anabolic hormones" },
                    ]},
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from the trigger to muscle growth: How does growth hormone build muscle?", items: ["Deep sleep or intense exercise triggers the process", "Pituitary gland releases growth hormone (GH) into the blood", "GH travels to the liver", "Liver converts it into IGF-1 (insulin-like growth factor)", "IGF-1 reaches muscles and stimulates repair and growth"]},
                    { type: GAME_TYPES.TAP_ALL, question: "What does testosterone actually do in the body?", options: [
                        { text: "Stimulates muscle protein synthesis", correct: true },
                        { text: "Increases aggression (its main purpose)", correct: false },
                        { text: "Increases bone density", correct: true },
                        { text: "Promotes red blood cell production", correct: true },
                        { text: "Makes people competitive", correct: false },
                        { text: "Affects fat distribution patterns", correct: true },
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Growth hormone is released primarily during _______ and after intense exercise.", options: ['deep sleep', 'eating', 'sitting', 'morning'], answer: 'deep sleep' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Two people do identical strength training programs. One sleeps 8 hours nightly, the other averages 5 hours. After 12 weeks, their results differ significantly.", question: "Why does the sleep-deprived person gain less muscle?", options: [
                        { text: "They didn't train hard enough", correct: false },
                        { text: "Reduced growth hormone release during poor sleep limits IGF-1 and tissue repair", correct: true },
                        { text: "Sleep doesn't affect muscle building", correct: false },
                    ], explanation: "Growth hormone release is heavily concentrated during deep sleep phases. Poor sleep = less GH = less IGF-1 = impaired recovery and growth." },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "IGF-1 directly stimulates muscle cell growth and tissue repair.", answer: true, explanation: "While growth hormone gets the credit, IGF-1 is the molecule that actually enters cells and promotes growth, repair, and regeneration." },
                    { type: GAME_TYPES.TAP_ALL, question: "What lifestyle factors support anabolic hormone production?", options: [
                        { text: "Resistance training", correct: true },
                        { text: "Adequate deep sleep", correct: true },
                        { text: "Managing chronic stress", correct: true },
                        { text: "Skipping meals", correct: false },
                        { text: "Sufficient protein intake", correct: true },
                        { text: "Sleep deprivation", correct: false },
                    ]},
                ]
            },
        ],
        'hormones-4': [
            {
                id: 'hormones-4-1', unitId: 'hormones-4', order: 1, title: "Metabolic Regulators",
                content: {
                    intro: `Your metabolism runs on a carefully orchestrated set of hormones that manage energy storage, release, and expenditure.\n\nINSULIN is released when blood glucose rises (after eating). It tells cells to absorb glucose, signals the liver to store glucose as glycogen, promotes fat storage, and stimulates protein synthesis. Insulin is your "fed state" coordinator—it says "energy is abundant, store it."\n\nGLUCAGON does the opposite. When blood glucose drops, glucagon tells the liver to break down glycogen and release glucose. It's your "fasted state" coordinator.\n\nTHYROID HORMONES (T3 and T4) set your metabolic rate—how fast your cells use energy. They affect virtually every tissue.\n\nLEPTIN is produced by fat cells. More fat = more leptin = signal to brain that energy stores are sufficient. GHRELIN is produced mainly in the stomach when it's empty. It signals hunger.\n\nIn obesity, leptin resistance can develop—the brain stops "hearing" leptin's signal despite high levels.`,
                    keyPoint: "Insulin stores energy, glucagon releases it, thyroid sets the burn rate, and leptin/ghrelin regulate hunger—these hormones, not willpower, control metabolism.",
                },
                games: [
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Insulin", right: "Store energy (fed state)" },
                        { left: "Glucagon", right: "Release energy (fasted state)" },
                        { left: "Leptin", right: "Signal fullness (from fat cells)" },
                        { left: "Ghrelin", right: "Signal hunger (from stomach)" },
                    ]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Insulin's job is to lower blood sugar.", answer: false, explanation: "Lower blood sugar is a side effect, not the purpose. Insulin's job is to coordinate the fed state—storing glucose, building fat, promoting protein synthesis when energy is abundant." },
                    { type: GAME_TYPES.TAP_ALL, question: "What does insulin actually do?", options: [
                        { text: "Tells cells to absorb glucose", correct: true },
                        { text: "Signals liver to store glycogen", correct: true },
                        { text: "Promotes fat storage", correct: true },
                        { text: "Burns fat for fuel", correct: false },
                        { text: "Stimulates protein synthesis", correct: true },
                        { text: "Releases stored energy", correct: false },
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Thyroid hormones set your metabolic _______—how fast your cells use energy.", options: ['rate', 'size', 'color', 'location'], answer: 'rate' },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from eating to energy storage: What happens after you eat a meal?", items: ["Food is digested and glucose enters your bloodstream", "Pancreas detects the rising blood glucose levels", "Pancreas releases insulin into the bloodstream", "Insulin signals cells to absorb glucose from the blood (blood sugar drops)", "Any excess glucose is stored as glycogen in muscles/liver, or converted to fat"]},
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "Someone loses 50 pounds through dieting. Despite reaching their goal weight, they constantly feel hungry and regain the weight within two years.", question: "What's happening hormonally?", options: [
                        { text: "They lack willpower and discipline", correct: false },
                        { text: "Leptin dropped and ghrelin increased, creating powerful hunger signals their brain can't ignore", correct: true },
                        { text: "They didn't exercise enough", correct: false },
                    ], explanation: "Weight loss reduces leptin (fullness signal) and increases ghrelin (hunger signal). The brain perceives this as starvation and drives eating behavior. This is biology, not weakness." },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "More body fat produces more leptin, which should reduce appetite.", answer: true, explanation: "This is how it's supposed to work. But in obesity, leptin resistance can develop—the brain stops responding to the signal, even though leptin levels are high." },
                    { type: GAME_TYPES.TAP_ALL, question: "What affects thyroid hormone function?", options: [
                        { text: "Iodine intake", correct: true },
                        { text: "Chronic stress", correct: true },
                        { text: "Sleep quality", correct: true },
                        { text: "Hair color", correct: false },
                        { text: "Severe calorie restriction", correct: true },
                        { text: "Eye color", correct: false },
                    ]},
                ]
            },
        ],
        'hormones-5': [
            {
                id: 'hormones-5-1', unitId: 'hormones-5', order: 1, title: "Sex Hormones in Context",
                content: {
                    intro: `Estrogen, progesterone, and testosterone exist in everyone—in different ratios and patterns that change across life.\n\nESTROGEN isn't just a "female hormone." It strengthens bones, protects cardiovascular health, affects brain function and mood, maintains skin elasticity, and regulates fat distribution. Men need it too—low estrogen in men causes bone loss and cognitive issues.\n\nIn females, estrogen fluctuates across the menstrual cycle. The first half (follicular phase) sees rising estrogen, which improves insulin sensitivity and supports higher-intensity training. The second half (luteal phase) has more progesterone, which slightly raises body temperature and metabolic rate.\n\nPROGESTERONE has a calming effect on the nervous system (it enhances GABA receptors). It raises body temperature and affects fluid retention.\n\nTESTOSTERONE in females (~0.5mg/day vs men's 7mg) is crucial for libido, energy, muscle maintenance, and bone health. Testosterone in both sexes declines with age—about 1-2% per year after 30.\n\nHigh cortisol suppresses sex hormone production. Poor sleep disrupts the entire endocrine system.`,
                    keyPoint: "Estrogen, progesterone, and testosterone exist in everyone in different ratios—they affect bones, brain, metabolism, and interact with all other hormones.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Estrogen is only important for females.", answer: false, explanation: "Men need estrogen for bone health, brain function, and cardiovascular protection. Low estrogen in men causes real health problems." },
                    { type: GAME_TYPES.TAP_ALL, question: "What does estrogen do in the body?", options: [
                        { text: "Strengthens bones", correct: true },
                        { text: "Only regulates periods", correct: false },
                        { text: "Protects cardiovascular system", correct: true },
                        { text: "Affects brain function and mood", correct: true },
                        { text: "Maintains skin elasticity", correct: true },
                        { text: "Has no effect on men", correct: false },
                    ]},
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [
                        { left: "Follicular phase (first half)", right: "Rising estrogen, better insulin sensitivity" },
                        { left: "Luteal phase (second half)", right: "Higher progesterone, raised temperature" },
                        { left: "Progesterone", right: "Calming effect via GABA receptors" },
                        { left: "Testosterone after 30", right: "Declines 1-2% per year" },
                    ]},
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Women produce about _______ of testosterone per day, which is important for libido and muscle maintenance.", options: ['0.5mg', '7mg', '0mg', '20mg'], answer: '0.5mg' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "A woman notices she performs better in the gym during the first two weeks of her cycle, then feels more fatigued in weeks 3-4.", question: "What explains this pattern?", options: [
                        { text: "It's psychological—cycles don't affect performance", correct: false },
                        { text: "Higher estrogen in the follicular phase improves insulin sensitivity and training response", correct: true },
                        { text: "She should train the same regardless of cycle", correct: false },
                    ], explanation: "The follicular phase (weeks 1-2) has rising estrogen which enhances performance. The luteal phase (weeks 3-4) has more progesterone which can reduce intensity capacity. Smart training accounts for this." },
                    { type: GAME_TYPES.TAP_ALL, question: "Why does testosterone matter for females?", options: [
                        { text: "Maintains libido and sexual function", correct: true },
                        { text: "It doesn't—testosterone is only for males", correct: false },
                        { text: "Supports muscle maintenance", correct: true },
                        { text: "Contributes to bone density", correct: true },
                        { text: "Affects energy levels", correct: true },
                    ]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "High chronic stress suppresses sex hormone production in both males and females.", answer: true, explanation: "Chronic cortisol elevation directly inhibits the hypothalamic-pituitary-gonadal axis, reducing testosterone, estrogen, and progesterone production." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from the lifestyle problem to the hormonal consequence: How do poor habits affect sex hormones?", items: ["Chronic stress, poor sleep, or under-eating creates an unfavorable environment", "Brain detects the body is under too much strain to prioritize reproduction", "Signals from the brain to the reproductive system decrease", "Sex hormone production (estrogen, testosterone) drops significantly", "You experience lower libido, decreased energy, and slower recovery"]},
                ]
            },
        ],
    };

    // =============================================================================
    // STATE
    // =============================================================================

    let learningState = {
        currentModule: null,
        currentUnit: null,
        currentLesson: null,
        currentGameIndex: 0,
        gamesCorrect: 0,
        gamesPlayed: 0,
        userProgress: null,
        isLoading: false,
        isDailyQuiz: false,
        // Duolingo-style additions
        currentStreak: 0,
        maxStreak: 0,
        soundEnabled: true,
        // Interactive reading mode: 'normal', 'focus', 'speed', 'rsvp'
        readingMode: 'focus',
        rsvpState: {
            isPlaying: false,
            wordIndex: 0,
            speed: 250, // ms per word
            intervalId: null
        },
        // Story reveal state for new animated content display
        storyState: {
            currentSlide: 0,
            totalSlides: 0,
            isPlaying: false,
            autoPlayTimer: null,
            slides: []
        },
        // Current view for swipe-back navigation
        currentView: 'home'
    };

    let matchState = { selectedLeft: null, selectedRight: null, matched: [] };

    // =============================================================================
    // DUOLINGO-STYLE ENHANCEMENTS
    // =============================================================================

    // Inject CSS animations
    function injectAnimationStyles() {
        if (document.getElementById('learning-animations-inline')) return;

        const style = document.createElement('style');
        style.id = 'learning-animations-inline';
        style.textContent = `
            @keyframes cardEnter {
                0% { opacity: 0; transform: translateY(30px) scale(0.9); }
                100% { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes confettiFall {
                0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
                100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
            }
            @keyframes streakFire {
                0%, 100% { transform: scale(1) rotate(-5deg); }
                50% { transform: scale(1.15) rotate(5deg); }
            }
            @keyframes celebrationBounce {
                0%, 100% { transform: translateY(0) scale(1); }
                30% { transform: translateY(-20px) scale(1.1); }
            }
            @keyframes correctPulse {
                0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
                50% { box-shadow: 0 0 0 15px rgba(16, 185, 129, 0); }
            }
            @keyframes incorrectShake {
                0%, 100% { transform: translateX(0); }
                20%, 60% { transform: translateX(-8px); }
                40%, 80% { transform: translateX(8px); }
            }
            @keyframes swipeLeft {
                to { transform: translateX(-150%) rotate(-30deg); opacity: 0; }
            }
            @keyframes swipeRight {
                to { transform: translateX(150%) rotate(30deg); opacity: 0; }
            }
            .confetti-container { position: fixed; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 9999; overflow: hidden; }
            .confetti-piece { position: absolute; width: 10px; height: 10px; animation: confettiFall 3s ease-out forwards; }
            .streak-fire { animation: streakFire 0.6s ease-in-out infinite; display: inline-block; }
            .card-enter { animation: cardEnter 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards; }
            .celebration-bounce { animation: celebrationBounce 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55); }

            /* Interactive Reading Mode Styles */
            .reading-mode-toggle { display: flex; gap: 8px; padding: 4px; background: #f1f5f9; border-radius: 12px; margin-bottom: 20px; }
            .reading-mode-btn { flex: 1; padding: 8px 12px; border: none; border-radius: 8px; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.2s ease; background: transparent; color: #64748b; }
            .reading-mode-btn.active { background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .reading-mode-btn:hover:not(.active) { background: rgba(255,255,255,0.5); }

            /* Bionic Reading */
            .bionic-text .bionic-bold { font-weight: 700; color: var(--text-main, #1a1a2e); }
            .bionic-text .bionic-light { font-weight: 400; color: #64748b; }

            /* Focus Mode - Progressive Reveal */
            @keyframes paragraphReveal { 0% { opacity: 0; transform: translateY(20px); filter: blur(4px); } 100% { opacity: 1; transform: translateY(0); filter: blur(0); } }
            .focus-mode .lesson-paragraph { opacity: 0; animation: paragraphReveal 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
            .focus-mode .lesson-paragraph:nth-child(1) { animation-delay: 0.2s; }
            .focus-mode .lesson-paragraph:nth-child(2) { animation-delay: 0.8s; }
            .focus-mode .lesson-paragraph:nth-child(3) { animation-delay: 1.4s; }
            .focus-mode .lesson-paragraph:nth-child(4) { animation-delay: 2.0s; }
            .focus-mode .lesson-paragraph:nth-child(5) { animation-delay: 2.6s; }
            .focus-mode .lesson-paragraph:nth-child(6) { animation-delay: 3.2s; }

            /* Interactive Terms */
            .interactive-term { position: relative; background: linear-gradient(180deg, transparent 60%, var(--module-color, #48864B)30 100%); cursor: pointer; border-radius: 2px; transition: all 0.2s ease; }
            .interactive-term:hover { background: linear-gradient(180deg, transparent 40%, var(--module-color, #48864B)40 100%); }
            .interactive-term.expanded { background: var(--module-color, #48864B)20; padding: 2px 6px; margin: -2px -6px; border-radius: 6px; }
            @keyframes tooltipPop { 0% { opacity: 0; transform: translateY(10px) scale(0.9); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
            .term-tooltip { position: absolute; left: 0; top: 100%; margin-top: 8px; background: white; border-radius: 12px; padding: 12px 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); font-size: 0.85rem; line-height: 1.5; z-index: 100; min-width: 200px; max-width: 280px; animation: tooltipPop 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
            .term-tooltip::before { content: ''; position: absolute; top: -6px; left: 20px; width: 12px; height: 12px; background: white; transform: rotate(45deg); box-shadow: -2px -2px 4px rgba(0,0,0,0.05); }

            /* Think Prompt */
            @keyframes promptSlideIn { 0% { opacity: 0; transform: translateX(-20px); } 100% { opacity: 1; transform: translateX(0); } }
            .think-prompt { display: flex; align-items: flex-start; gap: 12px; padding: 16px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; margin: 20px 0; animation: promptSlideIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
            .think-prompt-icon { width: 32px; height: 32px; background: #f59e0b; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; animation: thinkPulse 2s ease-in-out infinite; }
            @keyframes thinkPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
            .think-prompt-content { flex: 1; }
            .think-prompt-label { font-size: 0.7rem; font-weight: 700; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
            .think-prompt-question { font-size: 0.9rem; color: #78350f; font-weight: 500; line-height: 1.4; }
            .think-prompt-reveal { margin-top: 12px; padding-top: 12px; border-top: 1px dashed #d97706; }
            .think-prompt-answer { font-size: 0.85rem; color: #78350f; line-height: 1.5; opacity: 0; max-height: 0; overflow: hidden; transition: all 0.3s ease; }
            .think-prompt-answer.revealed { opacity: 1; max-height: 200px; }
            .think-reveal-btn { background: #f59e0b; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
            .think-reveal-btn:hover { background: #d97706; transform: scale(1.02); }

            /* RSVP Mode */
            .rsvp-container { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; padding: 40px 20px; }
            .rsvp-word { font-size: 2rem; font-weight: 600; text-align: center; min-height: 50px; display: flex; align-items: center; justify-content: center; }
            .rsvp-word .rsvp-focus { color: var(--module-color, #48864B); font-weight: 800; }
            .rsvp-controls { display: flex; gap: 12px; margin-top: 30px; }
            .rsvp-btn { width: 50px; height: 50px; border-radius: 50%; border: 2px solid var(--module-color, #48864B); background: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; }
            .rsvp-btn:hover { transform: scale(1.05); }
            .rsvp-btn.active { background: var(--module-color, #48864B); }
            .rsvp-btn.active svg { fill: white; }
            .rsvp-speed { display: flex; align-items: center; gap: 8px; margin-top: 20px; font-size: 0.85rem; color: #64748b; }
            .rsvp-speed input[type="range"] { width: 120px; accent-color: var(--module-color, #48864B); }
            .rsvp-progress { width: 100%; max-width: 300px; height: 4px; background: #e5e7eb; border-radius: 2px; margin-top: 20px; overflow: hidden; }
            .rsvp-progress-bar { height: 100%; background: var(--module-color, #48864B); transition: width 0.1s linear; }

            /* Section animations */
            @keyframes sectionSlideUp { 0% { opacity: 0; transform: translateY(30px); } 100% { opacity: 1; transform: translateY(0); } }
            .lesson-section { opacity: 0; animation: sectionSlideUp 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
            .lesson-section:nth-child(1) { animation-delay: 0.1s; }
            .lesson-section:nth-child(2) { animation-delay: 0.2s; }
            .lesson-section:nth-child(3) { animation-delay: 0.3s; }
            .lesson-section:nth-child(4) { animation-delay: 0.4s; }

            /* Reading progress */
            .reading-progress { position: fixed; top: 0; left: 0; height: 3px; background: var(--module-color, #48864B); width: 0%; transition: width 0.1s linear; z-index: 1000; }

            /* Tap prompt */
            @keyframes tapPrompt { 0%, 100% { opacity: 0.5; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-5px); } }
            .tap-to-continue { text-align: center; padding: 20px; color: #94a3b8; font-size: 0.85rem; animation: tapPrompt 2s ease-in-out infinite; }

            /* =============================================================================
               STORY REVEAL MODE - Animated Content Display
               ============================================================================= */

            /* Story container */
            .story-container {
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                position: relative;
                overflow: hidden;
            }

            /* Story slide */
            .story-slide {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 40px 25px;
                min-height: 60vh;
                position: relative;
            }

            /* Story visual/icon area */
            @keyframes iconFloat {
                0%, 100% { transform: translateY(0) scale(1); }
                50% { transform: translateY(-8px) scale(1.02); }
            }
            @keyframes iconPulse {
                0%, 100% { opacity: 0.8; transform: scale(1); }
                50% { opacity: 1; transform: scale(1.05); }
            }
            .story-visual {
                width: 120px;
                height: 120px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 30px;
                animation: iconFloat 3s ease-in-out infinite;
                box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            }
            .story-visual svg {
                width: 56px;
                height: 56px;
            }
            .story-visual-emoji {
                font-size: 3rem;
                animation: iconPulse 2s ease-in-out infinite;
            }

            /* Story text content */
            @keyframes storyTextReveal {
                0% {
                    opacity: 0;
                    transform: translateY(30px);
                    filter: blur(8px);
                }
                100% {
                    opacity: 1;
                    transform: translateY(0);
                    filter: blur(0);
                }
            }
            .story-text {
                font-size: 1.25rem;
                line-height: 1.7;
                color: var(--text-main, #1a1a2e);
                text-align: center;
                max-width: 340px;
                opacity: 0;
                animation: storyTextReveal 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
                animation-delay: 0.3s;
            }
            .story-text strong {
                color: var(--module-color);
                font-weight: 700;
            }

            /* Progress dots */
            .story-progress-dots {
                display: flex;
                gap: 8px;
                justify-content: center;
                padding: 20px;
            }
            .story-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #e5e7eb;
                transition: all 0.3s ease;
            }
            .story-dot.active {
                width: 24px;
                border-radius: 4px;
                background: var(--module-color);
            }
            .story-dot.completed {
                background: var(--module-color);
                opacity: 0.5;
            }

            /* Story controls */
            .story-controls {
                display: flex;
                gap: 12px;
                padding: 20px 25px 30px;
            }
            .story-skip-btn {
                flex: 1;
                padding: 16px;
                border: 2px solid #e5e7eb;
                border-radius: 14px;
                background: white;
                color: #64748b;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .story-skip-btn:hover {
                border-color: var(--module-color);
                color: var(--module-color);
            }
            .story-next-btn {
                flex: 2;
                padding: 16px;
                border: none;
                border-radius: 14px;
                background: var(--module-color);
                color: white;
                font-size: 1rem;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            .story-next-btn:hover {
                transform: scale(1.02);
                box-shadow: 0 6px 20px rgba(0,0,0,0.2);
            }

            /* Tap area overlay */
            .story-tap-area {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 180px;
                cursor: pointer;
                z-index: 10;
            }

            /* Key insight card in story mode */
            @keyframes keyInsightReveal {
                0% {
                    opacity: 0;
                    transform: translateY(40px) scale(0.95);
                }
                100% {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
            .story-key-insight {
                background: white;
                border-radius: 20px;
                padding: 24px;
                margin: 0 20px 20px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.1);
                border-left: 5px solid var(--module-color);
                animation: keyInsightReveal 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            }
            .story-key-insight-label {
                font-size: 0.7rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: var(--module-color);
                margin-bottom: 8px;
            }
            .story-key-insight-text {
                font-size: 1.1rem;
                line-height: 1.5;
                color: var(--text-main);
                font-weight: 500;
            }

            /* Slide transitions */
            @keyframes slideOutLeft {
                to {
                    opacity: 0;
                    transform: translateX(-50px);
                }
            }
            @keyframes slideInRight {
                from {
                    opacity: 0;
                    transform: translateX(50px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            .slide-out { animation: slideOutLeft 0.3s ease forwards; }
            .slide-in { animation: slideInRight 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        `;
        document.head.appendChild(style);
    }

    // Sound effects using Web Audio API
    let audioCtx = null;
    function playSound(type) {
        if (!learningState.soundEnabled) return;
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);

            if (type === 'correct') {
                osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
                osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
                osc.start(); osc.stop(audioCtx.currentTime + 0.3);
            } else if (type === 'incorrect') {
                osc.frequency.setValueAtTime(330, audioCtx.currentTime);
                osc.frequency.setValueAtTime(294, audioCtx.currentTime + 0.15);
                gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
                osc.start(); osc.stop(audioCtx.currentTime + 0.3);
            } else if (type === 'streak') {
                [523.25, 659.25, 783.99].forEach((freq, i) => {
                    const o = audioCtx.createOscillator();
                    const g = audioCtx.createGain();
                    o.connect(g); g.connect(audioCtx.destination);
                    o.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.05);
                    g.gain.setValueAtTime(0.15, audioCtx.currentTime + i * 0.05);
                    g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
                    o.start(audioCtx.currentTime + i * 0.05);
                    o.stop(audioCtx.currentTime + 0.5);
                });
            }
        } catch (e) {}
    }

    // Confetti system
    function createConfetti(count = 50, colors = ['#10b981', '#f59e0b', '#3b82f6', '#ec4899']) {
        const container = document.createElement('div');
        container.className = 'confetti-container';
        document.body.appendChild(container);

        for (let i = 0; i < count; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti-piece';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
            confetti.style.animationDelay = Math.random() * 0.5 + 's';
            if (Math.random() > 0.5) confetti.style.borderRadius = '50%';
            container.appendChild(confetti);
        }
        setTimeout(() => container.remove(), 4000);
    }

    // Character reactions
    const characterEmojis = {
        correct: ['🎉', '✨', '💪', '🌟', '🔥', '👏', '💚'],
        incorrect: ['🤔', '💭', '🧠', '📚', '💡'],
    };
    const feedbackMessages = {
        correct: ["Nailed it!", "You got it!", "Brilliant!", "Exactly right!", "Perfect!", "Great thinking!"],
        incorrect: ["Almost there!", "Not quite...", "Good try!", "Keep learning!"],
    };
    function getRandomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    // =============================================================================
    // HELPERS
    // =============================================================================

    function getUnitsForModule(moduleId) {
        return Object.values(UNITS)
            .filter(unit => unit.moduleId === moduleId)
            .sort((a, b) => a.order - b.order);
    }

    function getModulesSorted() {
        return Object.values(MODULES).sort((a, b) => a.order - b.order);
    }

    function getLessonsForUnit(unitId) {
        return LESSONS[unitId] || [];
    }

    function getLessonById(lessonId) {
        for (const unitLessons of Object.values(LESSONS)) {
            const lesson = unitLessons.find(l => l.id === lessonId);
            if (lesson) return lesson;
        }
        return null;
    }

    /**
     * Get today's date in YYYY-MM-DD format using local timezone
     */
    function getLocalDateString() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    /**
     * Find the next available (uncompleted) lesson across all modules
     * Returns the first uncompleted lesson in module/unit order, or null if all done
     */
    function getNextAvailableLesson(progress) {
        const modules = getModulesSorted();
        for (const module of modules) {
            const units = getUnitsForModule(module.id);
            for (const unit of units) {
                const lessons = getLessonsForUnit(unit.id);
                for (const lesson of lessons) {
                    if (!progress?.lessons_completed?.includes(lesson.id)) {
                        return { lesson, unit, module };
                    }
                }
            }
        }
        return null;
    }

    /**
     * Get a random available (unlocked + uncompleted) lesson from any category
     * Respects the sequential unlock progression within each module's units/lessons
     */
    function getRandomAvailableLesson(progress) {
        const available = [];
        const modules = getModulesSorted();
        for (const module of modules) {
            const units = getUnitsForModule(module.id);
            for (let ui = 0; ui < units.length; ui++) {
                const unit = units[ui];
                // Unit unlock: first unit is always accessible, others need previous unit completed
                const unitLocked = ui > 0 && !progress?.units_completed?.includes(units[ui - 1].id);
                if (unitLocked) continue;

                const lessons = getLessonsForUnit(unit.id);
                for (let li = 0; li < lessons.length; li++) {
                    const lesson = lessons[li];
                    if (progress?.lessons_completed?.includes(lesson.id)) continue;
                    // Lesson unlock: first lesson is always accessible, others need previous lesson completed
                    const lessonLocked = li > 0 && !progress?.lessons_completed?.includes(lessons[li - 1].id);
                    if (lessonLocked) continue;
                    available.push({ lesson, unit, module });
                }
            }
        }
        if (available.length === 0) return null;
        return available[Math.floor(Math.random() * available.length)];
    }

    /**
     * Check if the daily quiz has been completed today
     */
    function isDailyQuizCompletedToday() {
        const lastDate = localStorage.getItem('dailyQuizCompletedDate');
        return lastDate === getLocalDateString();
    }

    /**
     * Mark the daily quiz as completed for today
     */
    function markDailyQuizCompleted() {
        localStorage.setItem('dailyQuizCompletedDate', getLocalDateString());
    }

    // =============================================================================
    // INTERACTIVE READING HELPERS
    // =============================================================================

    // Convert text to bionic reading format (bold first part of each word)
    function toBionicText(text) {
        return text.split(/(\s+)/).map(word => {
            if (!word.trim()) return word;
            const len = word.length;
            const boldLen = Math.max(1, Math.ceil(len * 0.4));
            const boldPart = word.slice(0, boldLen);
            const lightPart = word.slice(boldLen);
            return `<span class="bionic-word"><span class="bionic-bold">${boldPart}</span><span class="bionic-light">${lightPart}</span></span>`;
        }).join('');
    }

    // Parse text for interactive terms and auto-detect key terms
    function parseInteractiveText(text, moduleColor) {
        const keyTerms = {
            'contract': 'To shorten and generate force - the only action muscles can perform.',
            'antagonist': 'The opposing muscle that relaxes while the other contracts.',
            'muscle fibers': 'The individual cells that make up muscle tissue.',
            'biceps': 'The muscle on the front of your upper arm that bends the elbow.',
            'triceps': 'The muscle on the back of your upper arm that straightens the elbow.',
            'opposing pairs': 'Muscles that work together by taking turns contracting and relaxing.',
            'nervous system': 'The body\'s control center that coordinates muscle movements.',
            'strength training': 'Exercise that creates resistance to build muscle.',
            'protein': 'A macronutrient essential for muscle repair and growth.',
            'calories': 'Units of energy from food that fuel your body.',
            'metabolism': 'The process by which your body converts food into energy.',
            'macros': 'Short for macronutrients: protein, carbs, and fats.',
            'progressive overload': 'Gradually increasing workout difficulty to continue making gains.',
            'recovery': 'The rest period when muscles repair and grow stronger.',
            'compound movements': 'Exercises that work multiple muscle groups at once.',
            'isolation exercises': 'Exercises that target a single muscle group.'
        };

        let processedText = text;
        Object.entries(keyTerms).forEach(([term, definition]) => {
            const regex = new RegExp(`\\b(${term})\\b`, 'gi');
            processedText = processedText.replace(regex,
                `<span class="interactive-term" data-definition="${definition.replace(/"/g, '&quot;')}" onclick="window.toggleTermDefinition(this, '${moduleColor}')">$1</span>`
            );
        });
        return processedText;
    }

    // Toggle term definition tooltip
    window.toggleTermDefinition = function(element, moduleColor) {
        document.querySelectorAll('.term-tooltip').forEach(t => t.remove());
        document.querySelectorAll('.interactive-term.expanded').forEach(t => t.classList.remove('expanded'));

        if (element.querySelector('.term-tooltip')) {
            element.classList.remove('expanded');
            return;
        }

        element.classList.add('expanded');
        const definition = element.getAttribute('data-definition');

        const tooltip = document.createElement('div');
        tooltip.className = 'term-tooltip';
        tooltip.innerHTML = `
            <div style="font-weight: 600; color: ${moduleColor}; margin-bottom: 4px;">Definition</div>
            <div>${definition}</div>
        `;
        tooltip.style.setProperty('--module-color', moduleColor);

        element.style.position = 'relative';
        element.appendChild(tooltip);

        setTimeout(() => {
            document.addEventListener('click', function closeTooltip(e) {
                if (!element.contains(e.target)) {
                    tooltip.remove();
                    element.classList.remove('expanded');
                    document.removeEventListener('click', closeTooltip);
                }
            });
        }, 10);
    };

    // Split text into paragraphs for progressive reveal
    function splitIntoParagraphs(text) {
        return text.split(/\n\n+/).filter(p => p.trim());
    }

    // Set reading mode and re-render
    window.setReadingMode = function(mode) {
        learningState.readingMode = mode;
        if (mode !== 'rsvp' && learningState.rsvpState.intervalId) {
            clearInterval(learningState.rsvpState.intervalId);
            learningState.rsvpState.isPlaying = false;
        }
        if (learningState.currentLesson) {
            renderLessonIntro(learningState.currentLesson);
        }
    };

    // RSVP Controls
    window.toggleRsvp = function() {
        const state = learningState.rsvpState;
        const playBtn = document.querySelector('.rsvp-play-btn');
        const unit = UNITS[learningState.currentLesson?.unitId];
        const module = unit ? MODULES[unit.moduleId] : { color: '#48864B' };

        if (state.isPlaying) {
            clearInterval(state.intervalId);
            state.isPlaying = false;
            if (playBtn) {
                playBtn.classList.remove('active');
                playBtn.innerHTML = `<svg viewBox="0 0 24 24" style="width: 40px; height: 40px; fill: white;"><path d="M8 5v14l11-7z"/></svg>`;
            }
        } else {
            state.isPlaying = true;
            if (playBtn) {
                playBtn.classList.add('active');
                playBtn.innerHTML = `<svg viewBox="0 0 24 24" style="width: 40px; height: 40px; fill: white;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
            }
            advanceRsvpWord();
            state.intervalId = setInterval(advanceRsvpWord, state.speed);
        }
    };

    window.resetRsvp = function() {
        const state = learningState.rsvpState;
        clearInterval(state.intervalId);
        state.isPlaying = false;
        state.wordIndex = 0;
        document.querySelector('.rsvp-play-btn')?.classList.remove('active');
        updateRsvpDisplay();
    };

    window.setRsvpSpeed = function(speed) {
        learningState.rsvpState.speed = parseInt(speed);
        if (learningState.rsvpState.isPlaying) {
            clearInterval(learningState.rsvpState.intervalId);
            learningState.rsvpState.intervalId = setInterval(advanceRsvpWord, learningState.rsvpState.speed);
        }
    };

    function advanceRsvpWord() {
        const lesson = learningState.currentLesson;
        if (!lesson) return;

        // Split on whitespace AND hyphens/dashes to get individual words
        const words = lesson.content.intro
            .split(/[\s]+/)
            .flatMap(word => word.split(/[-—–]+/))
            .filter(w => w.trim());
        const state = learningState.rsvpState;

        if (state.wordIndex >= words.length) {
            clearInterval(state.intervalId);
            state.isPlaying = false;
            state.wordIndex = 0;
            // Show replay state
            const playBtn = document.querySelector('.rsvp-play-btn');
            if (playBtn) {
                playBtn.classList.remove('active');
                playBtn.innerHTML = `<svg viewBox="0 0 24 24" style="width: 40px; height: 40px; fill: white;"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>`;
            }
            const wordEl = document.querySelector('.rsvp-word');
            if (wordEl) {
                wordEl.innerHTML = `<span style="font-size: 1.5rem; color: #94a3b8;">Tap to replay</span>`;
            }
            return;
        }

        updateRsvpDisplay();
        state.wordIndex++;
    }

    function updateRsvpDisplay() {
        const lesson = learningState.currentLesson;
        if (!lesson) return;

        // Split on whitespace AND hyphens/dashes to get individual words
        const words = lesson.content.intro
            .split(/[\s]+/)
            .flatMap(word => word.split(/[-—–]+/))
            .filter(w => w.trim());
        const state = learningState.rsvpState;
        const word = words[state.wordIndex] || '';

        const focusIndex = Math.floor(word.length * 0.3);
        const before = word.slice(0, focusIndex);
        const focus = word.charAt(focusIndex);
        const after = word.slice(focusIndex + 1);

        const wordEl = document.querySelector('.rsvp-word');
        if (wordEl) {
            wordEl.innerHTML = `${before}<span class="rsvp-focus">${focus}</span>${after}`;
        }

        const progressEl = document.querySelector('.rsvp-progress-bar');
        if (progressEl) {
            progressEl.style.width = `${(state.wordIndex / words.length) * 100}%`;
        }
    }

    // Reveal answer in think prompt
    window.revealThinkAnswer = function(btn) {
        const answerEl = btn.parentElement.querySelector('.think-prompt-answer');
        if (answerEl) {
            answerEl.classList.add('revealed');
            btn.textContent = 'Got it!';
            btn.onclick = () => btn.parentElement.style.display = 'none';
        }
    };

    // =============================================================================
    // INITIALIZATION
    // =============================================================================

    // Local storage key for progress
    const LEARNING_STORAGE_KEY = 'plant_based_learning_progress';

    function loadLocalProgress() {
        try {
            const stored = localStorage.getItem(LEARNING_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Check if daily limit should reset (new day)
                const today = new Date().toDateString();
                if (parsed.lastDate !== today) {
                    parsed.daily_status = { can_learn: true, lessons_remaining: 3, lessons_today: 0 };
                    parsed.lastDate = today;
                }
                return parsed;
            }
        } catch (e) {
            console.error('Error loading local progress:', e);
        }
        return null;
    }

    function saveLocalProgress() {
        try {
            const progress = learningState.userProgress;
            progress.lastDate = new Date().toDateString();
            localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(progress));
        } catch (e) {
            console.error('Error saving local progress:', e);
        }
    }

    /**
     * Load learning progress only (no UI rendering).
     * Used by dashboard to populate daily quiz card without switching to learning tab.
     */
    async function ensureLearningProgressLoaded() {
        if (learningState.userProgress) return; // already loaded

        let localProgress = loadLocalProgress();

        try {
            if (window.supabaseClient && window.currentUser) {
                const { data, error } = await window.supabaseClient.rpc('get_learning_summary', {
                    p_user_id: window.currentUser.id
                });

                if (!error && data) {
                    learningState.userProgress = data;
                    const ensureArray = (val) => Array.isArray(val) ? val : [];
                    learningState.userProgress.lessons_completed = ensureArray(data.lessons_completed);
                    learningState.userProgress.units_completed = ensureArray(data.units_completed);
                    learningState.userProgress.modules_completed = ensureArray(data.modules_completed);

                    if (localProgress) {
                        const allLessons = new Set([...ensureArray(data.lessons_completed), ...ensureArray(localProgress.lessons_completed)]);
                        learningState.userProgress.lessons_completed = Array.from(allLessons);
                        const allUnits = new Set([...ensureArray(data.units_completed), ...ensureArray(localProgress.units_completed)]);
                        learningState.userProgress.units_completed = Array.from(allUnits);
                        const allModules = new Set([...ensureArray(data.modules_completed), ...ensureArray(localProgress.modules_completed)]);
                        learningState.userProgress.modules_completed = Array.from(allModules);
                    }
                } else if (localProgress) {
                    learningState.userProgress = localProgress;
                }
            } else if (localProgress) {
                learningState.userProgress = localProgress;
            }
        } catch (err) {
            console.error('Error loading learning progress for dashboard:', err);
            if (localProgress) {
                learningState.userProgress = localProgress;
            }
        }

        if (!learningState.userProgress) {
            learningState.userProgress = {
                lessons_completed: [],
                units_completed: [],
                modules_completed: [],
                daily_status: { can_learn: true, lessons_remaining: 3, lessons_today: 0 },
                lastDate: new Date().toDateString()
            };
        }
    }

    async function initLearning() {
        window._learningInitInProgress = true;
        learningState.isLoading = true;
        renderLearningLoading();

        // Inject Duolingo-style animations
        injectAnimationStyles();

        // Reset streak for new session
        learningState.currentStreak = 0;
        learningState.maxStreak = 0;

        // First try to load from localStorage
        let localProgress = loadLocalProgress();

        try {
            if (window.supabaseClient && window.currentUser) {
                const { data, error } = await window.supabaseClient.rpc('get_learning_summary', {
                    p_user_id: window.currentUser.id
                });

                if (!error && data) {
                    // Merge with local progress (prefer DB but keep local if DB is behind)
                    learningState.userProgress = data;

                    // Ensure arrays are properly initialized (handle edge case where DB returns {} instead of [])
                    const ensureArray = (val) => Array.isArray(val) ? val : [];
                    learningState.userProgress.lessons_completed = ensureArray(data.lessons_completed);
                    learningState.userProgress.units_completed = ensureArray(data.units_completed);
                    learningState.userProgress.modules_completed = ensureArray(data.modules_completed);

                    if (localProgress) {
                        // Merge lessons - keep union of both (Supabase is source of truth)
                        const dbLessons = ensureArray(data.lessons_completed);
                        const localLessons = ensureArray(localProgress.lessons_completed);
                        const allLessons = new Set([...dbLessons, ...localLessons]);
                        learningState.userProgress.lessons_completed = Array.from(allLessons);

                        // Also merge units and modules
                        const dbUnits = ensureArray(data.units_completed);
                        const localUnits = ensureArray(localProgress.units_completed);
                        const allUnits = new Set([...dbUnits, ...localUnits]);
                        learningState.userProgress.units_completed = Array.from(allUnits);

                        const dbModules = ensureArray(data.modules_completed);
                        const localModules = ensureArray(localProgress.modules_completed);
                        const allModules = new Set([...dbModules, ...localModules]);
                        learningState.userProgress.modules_completed = Array.from(allModules);
                    }
                } else if (localProgress) {
                    learningState.userProgress = localProgress;
                }
            } else if (localProgress) {
                learningState.userProgress = localProgress;
            }
        } catch (err) {
            console.error('Error loading learning progress:', err);
            if (localProgress) {
                learningState.userProgress = localProgress;
            }
        }

        if (!learningState.userProgress) {
            learningState.userProgress = {
                lessons_completed: [],
                units_completed: [],
                modules_completed: [],
                daily_status: { can_learn: true, lessons_remaining: 3, lessons_today: 0 },
                lastDate: new Date().toDateString()
            };
        }

        // Ensure daily_status exists
        if (!learningState.userProgress.daily_status) {
            learningState.userProgress.daily_status = { can_learn: true, lessons_remaining: 3, lessons_today: 0 };
        }

        learningState.isLoading = false;
        window._learningInitInProgress = false;
        // Don't overwrite the view if a daily quiz was already started
        // (race condition: startDailyQuiz may fire before initLearning finishes)
        if (learningState.isDailyQuiz && learningState.currentView === 'lessonIntro') {
            // Daily quiz is already showing - don't overwrite it
            return;
        }
        renderLearningHome();
    }

    // =============================================================================
    // VIEWS
    // =============================================================================

    function renderLearningLoading() {
        const container = document.getElementById('learning-content');
        if (!container) return;
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; gap: 20px;">
                <div class="learning-spinner"></div>
                <p style="color: var(--text-muted); font-size: 0.95rem;">Loading your learning journey...</p>
            </div>
        `;
    }

    function renderLearningHome() {
        const container = document.getElementById('learning-content');
        if (!container) return;
        learningState.currentView = 'home';

        const modules = getModulesSorted();
        const progress = learningState.userProgress;

        const totalLessons = 125; // 5 modules × 5 units × 5 lessons
        const completedLessons = progress?.lessons_completed?.length || 0;
        const progressPercent = Math.round((completedLessons / totalLessons) * 100);

        const xpBannerDismissed = localStorage.getItem('xpBannerDismissed') === 'true';

        container.innerHTML = `
            ${!xpBannerDismissed ? `
            <div id="xp-info-banner" style="margin: 15px; padding: 16px 20px; background: linear-gradient(135deg, #059669 0%, #10b981 100%); border-radius: 16px; display: flex; align-items: center; gap: 15px; position: relative;">
                <button onclick="document.getElementById('xp-info-banner').style.display='none'; localStorage.setItem('xpBannerDismissed','true');" style="position: absolute; top: 8px; right: 8px; background: rgba(255,255,255,0.2); border: none; color: white; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; line-height: 1; padding: 0;">✕</button>
                <div style="font-size: 2rem;">🧠</div>
                <div style="flex: 1;">
                    <div style="font-weight: 700; color: white; font-size: 1rem;">
                        Learn at your own pace
                    </div>
                    <div style="font-size: 0.85rem; color: rgba(255,255,255,0.85); margin-top: 2px;">
                        Get 100% on a quiz and earn 1 XP
                    </div>
                </div>
            </div>
            ` : ''}

            <div style="margin: 0 15px 20px; padding: 20px; background: white; border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <span style="font-weight: 600; color: var(--text-main);">Your Progress</span>
                    <span style="font-size: 0.9rem; color: var(--text-muted);">${completedLessons}/${totalLessons} lessons</span>
                </div>
                <div style="height: 10px; background: #e5e7eb; border-radius: 5px; overflow: hidden;">
                    <div style="height: 100%; width: ${progressPercent}%; background: linear-gradient(90deg, var(--primary), var(--secondary)); border-radius: 5px;"></div>
                </div>
            </div>

            <div onclick="window.showQuizBattleInviteModal()" style="margin: 0 15px 20px; padding: 18px 20px; background: linear-gradient(135deg, #7c3aed 0%, #6366f1 50%, #8b5cf6 100%); border-radius: 16px; cursor: pointer; display: flex; align-items: center; gap: 15px; box-shadow: 0 4px 15px rgba(124,58,237,0.3);">
                <div style="width: 50px; height: 50px; background: rgba(255,255,255,0.2); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 1.6rem;">⚡</div>
                <div style="flex: 1;">
                    <div style="font-weight: 700; color: white; font-size: 1.05rem;">Quiz Battle</div>
                    <div style="font-size: 0.82rem; color: rgba(255,255,255,0.85); margin-top: 2px;">Challenge a friend to 15 random questions!</div>
                </div>
                <svg viewBox="0 0 24 24" style="width: 22px; height: 22px; fill: rgba(255,255,255,0.7);"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>
            </div>

            <div style="padding: 0 15px;">
                <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin-bottom: 15px;">Choose a Topic</h3>
                <div style="display: flex; flex-direction: column; gap: 15px;">
                    ${modules.map(module => renderModuleCard(module, progress)).join('')}
                </div>
            </div>

            ${progress?.current_streak > 0 ? `
                <div style="margin: 20px 15px; padding: 16px 20px; background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%); border-radius: 16px; display: flex; align-items: center; gap: 15px;">
                    <div style="font-size: 2rem;">🔥</div>
                    <div>
                        <div style="font-weight: 700; color: white; font-size: 1rem;">${progress.current_streak} Day Learning Streak!</div>
                        <div style="font-size: 0.85rem; color: rgba(255,255,255,0.9);">Keep it going!</div>
                    </div>
                </div>
            ` : ''}
        `;
    }

    function renderModuleCard(module, progress) {
        const units = getUnitsForModule(module.id);
        const completedUnits = units.filter(u => progress?.units_completed?.includes(u.id)).length;
        const isModuleComplete = progress?.modules_completed?.includes(module.id);

        let completedLessons = 0;
        units.forEach(unit => {
            const lessons = getLessonsForUnit(unit.id);
            lessons.forEach(lesson => {
                if (progress?.lessons_completed?.includes(lesson.id)) completedLessons++;
            });
        });

        const totalLessons = units.length * 5;
        const moduleProgress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

        return `
            <div onclick="window.openLearningModule('${module.id}')"
                 style="background: white; border-radius: 16px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); cursor: pointer; border-left: 4px solid ${module.color};">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="width: 56px; height: 56px; background: ${module.color}20; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 1.8rem;">
                        ${module.id === 'body' ? '💪' : module.id === 'fuel' ? '🥗' : '🧠'}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 700; font-size: 1.1rem; color: var(--text-main);">${module.title}</div>
                        <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 2px;">${module.subtitle}</div>
                        <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
                            <div style="flex: 1; height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden;">
                                <div style="height: 100%; width: ${moduleProgress}%; background: ${module.color};"></div>
                            </div>
                            <span style="font-size: 0.75rem; color: var(--text-muted);">${completedUnits}/${units.length}</span>
                        </div>
                    </div>
                    <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: #d1d5db;"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>
                </div>
            </div>
        `;
    }

    window.openLearningModule = function(moduleId) {
        learningState.currentModule = MODULES[moduleId];
        renderModuleView(moduleId);
        pushLearningHistoryState();
    };

    function renderModuleView(moduleId) {
        const container = document.getElementById('learning-content');
        if (!container) return;
        learningState.currentView = 'module';

        const module = MODULES[moduleId];
        const units = getUnitsForModule(moduleId);
        const progress = learningState.userProgress;

        container.innerHTML = `
            <div style="padding: 20px; background: white; border-bottom: 1px solid #f1f5f9;">
                <div>
                    <h2 style="margin: 0; font-size: 1.3rem; font-weight: 700; color: var(--text-main);">${module.title}</h2>
                    <p style="margin: 4px 0 0; font-size: 0.9rem; color: var(--text-muted);">${module.subtitle}</p>
                </div>
            </div>

            <div style="margin: 15px; padding: 16px; background: ${module.color}10; border-radius: 12px; border-left: 3px solid ${module.color};">
                <p style="margin: 0; font-size: 0.9rem; color: var(--text-main); line-height: 1.5;">${module.description}</p>
            </div>

            <div style="padding: 0 15px 100px;">
                <h3 style="font-size: 1rem; font-weight: 600; color: var(--text-main); margin-bottom: 15px;">Units</h3>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${units.map((unit, index) => renderUnitCard(unit, index, progress, module)).join('')}
                </div>
            </div>
        `;
    }

    function renderUnitCard(unit, index, progress, module) {
        const lessons = getLessonsForUnit(unit.id);
        const completedLessons = lessons.filter(l => progress?.lessons_completed?.includes(l.id)).length;
        const isUnitComplete = progress?.units_completed?.includes(unit.id);
        const prevUnit = index > 0 ? getUnitsForModule(unit.moduleId)[index - 1] : null;
        const isLocked = prevUnit && !progress?.units_completed?.includes(prevUnit.id);
        const canAccess = index === 0 || !isLocked;
        const hasLessons = lessons.length > 0;

        return `
            <div onclick="${canAccess && hasLessons ? `window.openLearningUnit('${unit.id}')` : ''}"
                 style="background: white; border-radius: 14px; padding: 16px; box-shadow: 0 2px 6px rgba(0,0,0,0.05); cursor: ${canAccess && hasLessons ? 'pointer' : 'not-allowed'}; opacity: ${canAccess ? '1' : '0.6'};">
                <div style="display: flex; align-items: center; gap: 14px;">
                    <div style="width: 48px; height: 48px; background: ${isUnitComplete ? '#10b98120' : module.color + '20'}; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                        ${isUnitComplete ? '✅' : isLocked ? '🔒' : `<span style="font-weight: 700; font-size: 1.2rem; color: ${module.color};">${index + 1}</span>`}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 1rem; color: var(--text-main);">${unit.title}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">${unit.description}</div>
                        ${hasLessons ? `
                            <div style="display: flex; align-items: center; gap: 6px; margin-top: 8px;">
                                ${[0,1,2,3,4].map(i => `<div style="width: 8px; height: 8px; border-radius: 50%; background: ${i < completedLessons ? '#10b981' : '#e5e7eb'};"></div>`).join('')}
                                <span style="font-size: 0.7rem; color: var(--text-muted); margin-left: 4px;">${completedLessons}/5</span>
                            </div>
                        ` : `<div style="font-size: 0.75rem; color: #f59e0b; margin-top: 6px;">Coming soon!</div>`}
                    </div>
                </div>
            </div>
        `;
    }

    window.openLearningUnit = function(unitId) {
        learningState.currentUnit = UNITS[unitId];
        renderUnitView(unitId);
        pushLearningHistoryState();
    };

    function renderUnitView(unitId) {
        const container = document.getElementById('learning-content');
        if (!container) return;
        learningState.currentView = 'unit';

        const unit = UNITS[unitId];
        const module = MODULES[unit.moduleId];
        const lessons = getLessonsForUnit(unitId);
        const progress = learningState.userProgress;

        container.innerHTML = `
            <div style="padding: 20px; background: white; border-bottom: 1px solid #f1f5f9;">
                <div>
                    <div style="font-size: 0.8rem; color: ${module.color}; font-weight: 600; margin-bottom: 2px;">${module.title}</div>
                    <h2 style="margin: 0; font-size: 1.2rem; font-weight: 700; color: var(--text-main);">${unit.title}</h2>
                </div>
            </div>

            <div style="padding: 15px 15px 100px;">
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${lessons.length > 0 ? lessons.map((lesson, index) => renderLessonCard(lesson, index, progress, module)).join('') : `
                        <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                            <div style="font-size: 3rem; margin-bottom: 15px;">🚧</div>
                            <div style="font-weight: 600; margin-bottom: 5px;">Content Coming Soon</div>
                            <div style="font-size: 0.9rem;">We're working on these lessons!</div>
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    function renderLessonCard(lesson, index, progress, module) {
        const isComplete = progress?.lessons_completed?.includes(lesson.id);
        const prevLesson = index > 0 ? getLessonsForUnit(lesson.unitId)[index - 1] : null;
        const isLocked = prevLesson && !progress?.lessons_completed?.includes(prevLesson.id);
        const canAccess = index === 0 || !isLocked;

        return `
            <div onclick="${canAccess ? `window.startLesson('${lesson.id}')` : ''}"
                 style="background: white; border-radius: 12px; padding: 16px; box-shadow: 0 2px 6px rgba(0,0,0,0.05); cursor: ${canAccess ? 'pointer' : 'not-allowed'}; opacity: ${canAccess ? '1' : '0.5'}; display: flex; align-items: center; gap: 14px;">
                <div style="width: 44px; height: 44px; background: ${isComplete ? '#10b98120' : module.color + '20'}; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                    ${isComplete ? '✅' : isLocked ? '🔒' : `<span style="font-weight: 700; font-size: 1.1rem; color: ${module.color};">${index + 1}</span>`}
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 0.95rem; color: var(--text-main);">${lesson.title}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
                        ${lesson.games?.length || 0} games ${isComplete ? '• Completed' : '• +1 XP'}
                    </div>
                </div>
                ${canAccess && !isComplete ? `
                    <div style="background: ${module.color}; color: white; padding: 6px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 600;">Start</div>
                ` : ''}
            </div>
        `;
    }

    // =============================================================================
    // LESSON & GAME LOGIC
    // =============================================================================

    window.startLesson = function(lessonId) {
        const lesson = getLessonById(lessonId);
        if (!lesson) return;

        learningState.currentLesson = lesson;
        learningState.currentGameIndex = 0;
        learningState.gamesCorrect = 0;
        learningState.gamesPlayed = 0;
        learningState.isDailyQuiz = false;

        renderLessonIntro(lesson);
        pushLearningHistoryState();
    };

    window.startDailyQuiz = function(lessonId) {
        const lesson = getLessonById(lessonId);
        if (!lesson) return;

        learningState.currentLesson = lesson;
        learningState.currentGameIndex = 0;
        learningState.gamesCorrect = 0;
        learningState.gamesPlayed = 0;
        learningState.isDailyQuiz = true;

        renderLessonIntro(lesson);
        pushLearningHistoryState();
    };

    // =============================================================================
    // STORY REVEAL SYSTEM - Animated Content Display
    // =============================================================================

    /**
     * Get visual element (emoji/icon) for a paragraph based on content keywords
     */
    function getStoryVisual(text, moduleId, slideIndex) {
        const textLower = text.toLowerCase();

        // Module-specific icon sets
        const moduleIcons = {
            mind: ['🧠', '💭', '🔮', '⚡', '🎯', '🌟'],
            body: ['💪', '🦴', '🏃', '⚙️', '🔄', '📈'],
            fuel: ['🍎', '⚡', '🔥', '💚', '🌱', '📊'],
            longevity: ['⏳', '🧬', '💫', '🌿', '❤️', '🔬'],
            workouts: ['🏋️', '💥', '🎯', '📈', '⚡', '🔄']
        };

        // Keyword-based emoji selection
        const keywordEmojis = {
            // Brain/Mind related
            'brain': '🧠', 'prediction': '🔮', 'perceive': '👁️', 'experience': '✨',
            'consciousness': '💫', 'attention': '🎯', 'memory': '💭', 'learning': '📚',
            'surprise': '😮', 'error': '⚠️', 'update': '🔄', 'model': '🗺️',

            // Body related
            'muscle': '💪', 'strength': '🦾', 'movement': '🏃', 'bone': '🦴',
            'heart': '❤️', 'blood': '🩸', 'nerve': '⚡', 'hormone': '🧪',

            // Nutrition related
            'energy': '⚡', 'food': '🍽️', 'nutrient': '🌱', 'protein': '🥩',
            'carb': '🍞', 'fat': '🥑', 'vitamin': '💊', 'digest': '🔄',

            // Longevity related
            'age': '⏳', 'cell': '🧬', 'dna': '🧬', 'repair': '🔧',
            'inflammation': '🔥', 'disease': '🦠', 'health': '💚', 'lifespan': '📈',

            // Workout related
            'exercise': '🏋️', 'train': '🎯', 'adapt': '📈', 'recover': '😴',
            'intensity': '💥', 'volume': '📊', 'progressive': '📈', 'overload': '⬆️',

            // General
            'important': '⭐', 'key': '🔑', 'transform': '🦋', 'change': '🔄',
            'why': '❓', 'how': '🤔', 'what': '📍', 'fact': '✅'
        };

        // Try to find a keyword match
        for (const [keyword, emoji] of Object.entries(keywordEmojis)) {
            if (textLower.includes(keyword)) {
                return emoji;
            }
        }

        // Fallback to module-specific rotating icons
        const icons = moduleIcons[moduleId] || moduleIcons.mind;
        return icons[slideIndex % icons.length];
    }

    /**
     * Highlight key terms in text with module color
     */
    function highlightKeyTerms(text) {
        // Bold text between asterisks or ALL CAPS words
        let highlighted = text
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\b([A-Z]{2,})\b/g, '<strong>$1</strong>');

        // Also highlight quoted phrases
        highlighted = highlighted.replace(/"([^"]+)"/g, '<strong>"$1"</strong>');

        return highlighted;
    }

    /**
     * Prepare slides from lesson content
     */
    function prepareStorySlides(lesson) {
        const paragraphs = lesson.content.intro
            .split(/\n\n+/)
            .map(p => p.trim())
            .filter(p => p.length > 0);

        const unit = UNITS[lesson.unitId];
        const moduleId = unit.moduleId;

        return paragraphs.map((text, index) => ({
            text: highlightKeyTerms(text),
            visual: getStoryVisual(text, moduleId, index),
            index
        }));
    }

    /**
     * Render a single story slide
     */
    function renderStorySlide(slide, module, isLast) {
        return `
            <div class="story-slide slide-in" id="story-slide-${slide.index}">
                <div class="story-visual" style="background: linear-gradient(135deg, ${module.color}20 0%, ${module.color}40 100%);">
                    <span class="story-visual-emoji">${slide.visual}</span>
                </div>
                <div class="story-text">${slide.text}</div>
            </div>
        `;
    }

    /**
     * Render progress dots
     */
    function renderStoryDots(currentSlide, totalSlides) {
        let dots = '';
        for (let i = 0; i < totalSlides; i++) {
            let className = 'story-dot';
            if (i === currentSlide) className += ' active';
            else if (i < currentSlide) className += ' completed';
            dots += `<div class="${className}"></div>`;
        }
        return dots;
    }

    /**
     * Main story reveal renderer - replaces renderLessonIntro
     */
    function renderLessonIntro(lesson) {
        const container = document.getElementById('learning-content');
        if (!container) return;
        learningState.currentView = 'lessonIntro';

        const unit = UNITS[lesson.unitId];
        const module = MODULES[unit.moduleId];

        // Reset story state
        const slides = prepareStorySlides(lesson);
        learningState.storyState = {
            currentSlide: 0,
            totalSlides: slides.length,
            isPlaying: false,
            autoPlayTimer: null,
            slides: slides
        };

        // Also reset old RSVP state
        learningState.rsvpState.isPlaying = false;
        if (learningState.rsvpState.intervalId) {
            clearInterval(learningState.rsvpState.intervalId);
        }

        const currentSlide = slides[0];
        const isLastSlide = slides.length === 1;

        container.innerHTML = `
            <div class="story-container" style="background: linear-gradient(180deg, ${module.color}15 0%, ${module.color}05 50%, white 100%); --module-color: ${module.color};">
                <!-- Header -->
                <div style="padding: 20px;">
                    <div style="text-align: center;">
                        <span style="font-size: 0.8rem; color: ${module.color}; font-weight: 600;">${module.title} • ${unit.title}</span>
                    </div>
                </div>

                <!-- Lesson Title -->
                <div style="text-align: center; padding: 0 20px 10px;">
                    <h1 style="margin: 0; font-size: 1.4rem; font-weight: 700; color: var(--text-main);">${lesson.title}</h1>
                </div>

                <!-- Progress Dots -->
                <div class="story-progress-dots" id="story-progress-dots">
                    ${renderStoryDots(0, slides.length)}
                </div>

                <!-- Tap area for advancing -->
                <div class="story-tap-area" onclick="window.advanceStory()"></div>

                <!-- Story Content Area -->
                <div id="story-content-area">
                    ${renderStorySlide(currentSlide, module, isLastSlide)}
                </div>

                <!-- Controls -->
                <div class="story-controls">
                    <button class="story-skip-btn" onclick="window.skipToQuiz()">
                        Skip
                    </button>
                    <button class="story-next-btn" id="story-next-btn" onclick="window.advanceStory()">
                        <span id="story-next-text">${isLastSlide ? 'Continue' : 'Next'}</span>
                        <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: white;"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>
                    </button>
                </div>

                <!-- Key Insight (shown on last slide) -->
                <div id="story-key-insight" style="display: none;">
                    <div class="story-key-insight">
                        <div class="story-key-insight-label">💡 Key Insight</div>
                        <div class="story-key-insight-text">${lesson.content.keyPoint}</div>
                    </div>
                </div>

                <!-- Quiz Button (shown after content) -->
                <div id="story-quiz-btn" style="display: none; padding: 0 20px 30px;">
                    <button onclick="window.startLessonGames()" style="width: 100%; background: ${module.color}; color: white; border: none; padding: 18px; border-radius: 14px; font-size: 1.1rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 4px 12px ${module.color}40; transition: transform 0.2s ease;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                        <span>Test Your Understanding</span>
                        <svg viewBox="0 0 24 24" style="width: 22px; height: 22px; fill: white;"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                    <p style="text-align: center; font-size: 0.85rem; color: var(--text-muted); margin-top: 12px;">${lesson.games?.length || 0} quick games ahead</p>
                </div>
            </div>
        `;
    }

    /**
     * Advance to next story slide
     */
    window.advanceStory = function() {
        const state = learningState.storyState;
        const lesson = learningState.currentLesson;
        if (!lesson) return;

        const unit = UNITS[lesson.unitId];
        const module = MODULES[unit.moduleId];

        // If we're on the last slide and key insight is showing, go to quiz
        if (state.currentSlide >= state.totalSlides - 1) {
            const keyInsight = document.getElementById('story-key-insight');
            if (keyInsight && keyInsight.style.display !== 'none') {
                window.startLessonGames();
                return;
            }
        }

        // If we've shown all slides, show key insight
        if (state.currentSlide >= state.totalSlides - 1) {
            showKeyInsightAndQuiz();
            return;
        }

        // Advance to next slide
        state.currentSlide++;
        const slide = state.slides[state.currentSlide];
        const isLastSlide = state.currentSlide >= state.totalSlides - 1;

        // Animate out current slide
        const contentArea = document.getElementById('story-content-area');
        const currentSlideEl = contentArea?.querySelector('.story-slide');
        if (currentSlideEl) {
            currentSlideEl.classList.remove('slide-in');
            currentSlideEl.classList.add('slide-out');
        }

        // After animation, show new slide
        setTimeout(() => {
            if (contentArea) {
                contentArea.innerHTML = renderStorySlide(slide, module, isLastSlide);
            }

            // Update progress dots
            const dotsContainer = document.getElementById('story-progress-dots');
            if (dotsContainer) {
                dotsContainer.innerHTML = renderStoryDots(state.currentSlide, state.totalSlides);
            }

            // Update button text
            const nextText = document.getElementById('story-next-text');
            if (nextText) {
                nextText.textContent = isLastSlide ? 'Continue' : 'Next';
            }
        }, 300);
    };

    /**
     * Show key insight card and quiz button
     */
    function showKeyInsightAndQuiz() {
        const keyInsight = document.getElementById('story-key-insight');
        const quizBtn = document.getElementById('story-quiz-btn');
        const controls = document.querySelector('.story-controls');
        const tapArea = document.querySelector('.story-tap-area');

        if (keyInsight) keyInsight.style.display = 'block';
        if (quizBtn) quizBtn.style.display = 'block';
        if (controls) controls.style.display = 'none';
        if (tapArea) tapArea.style.display = 'none';

        // Update progress dots to show completion
        const dotsContainer = document.getElementById('story-progress-dots');
        const state = learningState.storyState;
        if (dotsContainer) {
            dotsContainer.innerHTML = renderStoryDots(state.totalSlides, state.totalSlides);
        }
    }

    /**
     * Skip directly to quiz
     */
    window.skipToQuiz = function() {
        showKeyInsightAndQuiz();
    };

    window.startLessonGames = function() {
        const lesson = learningState.currentLesson;
        if (!lesson || !lesson.games?.length) {
            completeLesson();
            return;
        }

        // Show mascot for games
        if (window.LearningMascot) {
            window.LearningMascot.show();
        }

        learningState.currentGameIndex = 0;
        renderCurrentGame();
        pushLearningHistoryState();
    };

    function renderCurrentGame() {
        learningState.currentView = 'game';
        const lesson = learningState.currentLesson;
        const gameIndex = learningState.currentGameIndex;

        if (gameIndex >= lesson.games.length) {
            completeLesson();
            return;
        }

        const game = lesson.games[gameIndex];
        const unit = UNITS[lesson.unitId];
        const module = MODULES[unit.moduleId];
        const container = document.getElementById('learning-content');
        if (!container) return;

        const progressPercent = (gameIndex / lesson.games.length) * 100;
        const streak = learningState.currentStreak;
        let gameHtml = '';

        switch (game.type) {
            case GAME_TYPES.SWIPE_TRUE_FALSE:
                gameHtml = renderSwipeTrueFalse(game, module);
                break;
            case GAME_TYPES.FILL_BLANK:
                gameHtml = renderFillBlank(game, module);
                break;
            case GAME_TYPES.TAP_ALL:
                gameHtml = renderTapAll(game, module);
                break;
            case GAME_TYPES.MATCH_PAIRS:
                gameHtml = renderMatchPairs(game, module);
                break;
            case GAME_TYPES.ORDER_SEQUENCE:
                gameHtml = renderOrderSequence(game, module);
                break;
            case GAME_TYPES.SCENARIO_STORY:
                gameHtml = renderScenarioStory(game, module);
                break;
            default:
                gameHtml = renderFillBlank(game, module);
        }

        container.innerHTML = `
            <div style="min-height: 100vh; background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%); display: flex; flex-direction: column;">
                <div style="padding: 15px 20px; background: white; border-bottom: 1px solid #e5e7eb; box-shadow: 0 2px 10px rgba(0,0,0,0.03);">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="flex: 1; height: 12px; background: #e5e7eb; border-radius: 6px; overflow: hidden;">
                            <div style="height: 100%; width: ${progressPercent}%; background: linear-gradient(90deg, ${module.color}, ${module.color}dd); border-radius: 6px; transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);"></div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            ${streak >= 2 ? `
                                <div style="display: flex; align-items: center; gap: 4px; background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%); padding: 4px 10px; border-radius: 20px; box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);">
                                    <span class="streak-fire" style="font-size: 14px;">🔥</span>
                                    <span style="font-size: 0.8rem; font-weight: 700; color: white;">${streak}</span>
                                </div>
                            ` : ''}
                            <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600; background: #f1f5f9; padding: 4px 10px; border-radius: 12px;">${gameIndex + 1}/${lesson.games.length}</span>
                        </div>
                    </div>
                </div>
                <div class="card-enter" style="flex: 1; padding: 20px; display: flex; flex-direction: column;">
                    ${gameHtml}
                </div>
            </div>
        `;

        matchState = { selectedLeft: null, selectedRight: null, matched: [] };

        // Initialize drag and drop for ORDER_SEQUENCE games
        if (game.type === GAME_TYPES.ORDER_SEQUENCE) {
            initOrderDragAndDrop();
        }
    }

    /**
     * Initialize drag and drop for order sequence games (with touch support)
     */
    function initOrderDragAndDrop() {
        const container = document.getElementById('order-container');
        if (!container) return;

        let draggedItem = null;

        container.querySelectorAll('.order-item').forEach(item => {
            // Desktop drag events
            item.addEventListener('dragstart', (e) => {
                draggedItem = item;
                item.style.opacity = '0.5';
            });

            item.addEventListener('dragend', () => {
                draggedItem.style.opacity = '1';
                draggedItem = null;
                updateOrderNumbers();
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (draggedItem && draggedItem !== item) {
                    const rect = item.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    if (e.clientY < midY) {
                        container.insertBefore(draggedItem, item);
                    } else {
                        container.insertBefore(draggedItem, item.nextSibling);
                    }
                }
            });

            // Touch events for mobile
            item.addEventListener('touchstart', (e) => {
                draggedItem = item;
                item.style.opacity = '0.7';
                item.style.transform = 'scale(1.02)';
                item.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.15)';
                item.style.zIndex = '1000';
                item.style.transition = 'none';
            }, { passive: true });

            item.addEventListener('touchmove', (e) => {
                if (!draggedItem) return;
                e.preventDefault();

                const touchY = e.touches[0].clientY;
                const items = Array.from(container.querySelectorAll('.order-item'));

                // Find the item we're hovering over
                for (const otherItem of items) {
                    if (otherItem === draggedItem) continue;

                    const rect = otherItem.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;

                    if (touchY < midY && touchY > rect.top - 20) {
                        container.insertBefore(draggedItem, otherItem);
                        break;
                    } else if (touchY > midY && touchY < rect.bottom + 20) {
                        container.insertBefore(draggedItem, otherItem.nextSibling);
                        break;
                    }
                }
            }, { passive: false });

            item.addEventListener('touchend', () => {
                if (draggedItem) {
                    draggedItem.style.opacity = '1';
                    draggedItem.style.transform = '';
                    draggedItem.style.boxShadow = '';
                    draggedItem.style.zIndex = '';
                    draggedItem.style.transition = '';
                    draggedItem = null;
                    updateOrderNumbers();
                }
            });
        });

        function updateOrderNumbers() {
            document.querySelectorAll('.order-item').forEach((item, i) => {
                const numberEl = item.querySelector('.order-number');
                if (numberEl) numberEl.textContent = i + 1;
            });
        }
    }

    // Game Renderers
    function renderSwipeTrueFalse(game, module) {
        return `
            <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 20px;">
                <div style="font-size: 0.9rem; color: ${module.color}; font-weight: 600; margin-bottom: 15px;">TRUE OR FALSE?</div>
                <div style="background: white; border-radius: 20px; padding: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 340px; width: 100%;">
                    <p style="font-size: 1.2rem; color: var(--text-main); line-height: 1.5; margin: 0;">${game.question}</p>
                </div>
                <div style="display: flex; gap: 40px; margin-top: 40px;">
                    <button onclick="window.answerSwipe(false)" style="width: 70px; height: 70px; border-radius: 50%; background: white; border: 3px solid #ef4444; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 1.5rem;">❌</button>
                    <button onclick="window.answerSwipe(true)" style="width: 70px; height: 70px; border-radius: 50%; background: white; border: 3px solid #10b981; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 1.5rem;">✅</button>
                </div>
                <div style="margin-top: 20px; display: flex; gap: 30px; font-size: 0.85rem; color: var(--text-muted);">
                    <span>FALSE</span>
                    <span>TRUE</span>
                </div>
            </div>
        `;
    }

    function renderFillBlank(game, module) {
        const shuffled = [...game.options].sort(() => Math.random() - 0.5);
        return `
            <div style="flex: 1; display: flex; flex-direction: column;">
                <div style="font-size: 0.9rem; color: ${module.color}; font-weight: 600; margin-bottom: 20px;">FILL IN THE BLANK</div>
                <div style="background: white; border-radius: 16px; padding: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.06); margin-bottom: 30px;">
                    <p style="font-size: 1.15rem; color: var(--text-main); line-height: 1.6; margin: 0;">
                        ${game.sentence.replace('_______', `<span id="blank-slot" style="display: inline-block; min-width: 100px; border-bottom: 3px solid ${module.color}; margin: 0 5px; text-align: center; font-weight: 600; color: ${module.color};">_______</span>`)}
                    </p>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;">
                    ${shuffled.map(opt => `
                        <button class="fill-blank-option" data-value="${opt}" onclick="window.selectFillBlank('${opt}')"
                            style="background: white; border: 2px solid #e5e7eb; border-radius: 25px; padding: 12px 24px; font-size: 1rem; font-weight: 500; color: var(--text-main); cursor: pointer;">
                            ${opt}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    function renderTapAll(game, module) {
        const shuffled = [...game.options].sort(() => Math.random() - 0.5);
        return `
            <div style="flex: 1; display: flex; flex-direction: column;">
                <div style="display: inline-flex; align-items: center; gap: 8px; background: ${module.color}15; padding: 8px 16px; border-radius: 20px; margin-bottom: 15px; align-self: flex-start;">
                    <span style="font-size: 1.2rem;">☑️</span>
                    <span style="font-size: 0.85rem; color: ${module.color}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Select All That Apply</span>
                </div>
                <p style="font-size: 1.1rem; color: var(--text-main); margin-bottom: 25px; font-weight: 600; line-height: 1.5;">${game.question}</p>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${shuffled.map((opt, i) => `
                        <button class="tap-all-option" data-correct="${opt.correct}" onclick="window.toggleTapAllOption(this)"
                            style="background: white; border: 3px solid #e5e7eb; border-radius: 16px; padding: 16px 18px; font-size: 1rem; color: var(--text-main); cursor: pointer; text-align: left; display: flex; align-items: center; gap: 14px; box-shadow: 0 3px 10px rgba(0,0,0,0.05); transition: all 0.2s; opacity: 0; animation: cardEnter 0.3s ease-out forwards; animation-delay: ${i * 0.05}s;">
                            <div class="tap-checkbox" style="width: 28px; height: 28px; border: 3px solid #d1d5db; border-radius: 8px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"></div>
                            <span style="flex: 1; font-weight: 500; line-height: 1.4;">${opt.text}</span>
                        </button>
                    `).join('')}
                </div>
                <button onclick="window.checkTapAll()" style="margin-top: 30px; background: linear-gradient(135deg, ${module.color} 0%, ${module.color}dd 100%); color: white; border: none; padding: 16px; border-radius: 16px; font-size: 1.05rem; font-weight: 700; cursor: pointer; box-shadow: 0 4px 15px ${module.color}40;">Check Answer</button>
            </div>
        `;
    }

    function renderMatchPairs(game, module) {
        const leftItems = game.pairs.map((p, i) => ({ text: p.left, index: i }));
        const rightItems = game.pairs.map((p, i) => ({ text: p.right, index: i })).sort(() => Math.random() - 0.5);
        return `
            <div style="flex: 1; display: flex; flex-direction: column;">
                <div style="display: inline-flex; align-items: center; gap: 8px; background: ${module.color}15; padding: 8px 16px; border-radius: 20px; margin-bottom: 15px; align-self: flex-start;">
                    <span style="font-size: 1.2rem;">🔗</span>
                    <span style="font-size: 0.85rem; color: ${module.color}; font-weight: 700; text-transform: uppercase;">Match the Pairs</span>
                </div>
                <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 20px;">Tap one item from each column to match them</p>
                <div style="display: flex; gap: 20px;">
                    <div style="flex: 1; display: flex; flex-direction: column; gap: 12px;">
                        ${leftItems.map((item, i) => `
                            <div class="match-item match-left" data-index="${item.index}" onclick="window.selectMatchItem(this, 'left')"
                                style="background: white; border: 3px solid #e5e7eb; border-radius: 16px; padding: 16px; font-size: 0.95rem; cursor: pointer; text-align: center; font-weight: 500; box-shadow: 0 3px 10px rgba(0,0,0,0.05); transition: all 0.2s; opacity: 0; animation: cardEnter 0.3s ease-out forwards; animation-delay: ${i * 0.05}s;">
                                ${item.text}
                            </div>
                        `).join('')}
                    </div>
                    <div style="flex: 1; display: flex; flex-direction: column; gap: 12px;">
                        ${rightItems.map((item, i) => `
                            <div class="match-item match-right" data-index="${item.index}" onclick="window.selectMatchItem(this, 'right')"
                                style="background: white; border: 3px solid #e5e7eb; border-radius: 16px; padding: 16px; font-size: 0.95rem; cursor: pointer; text-align: center; font-weight: 500; box-shadow: 0 3px 10px rgba(0,0,0,0.05); transition: all 0.2s; opacity: 0; animation: cardEnter 0.3s ease-out forwards; animation-delay: ${(i + leftItems.length) * 0.05}s;">
                                ${item.text}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    function renderOrderSequence(game, module) {
        const shuffled = game.items.map((item, i) => ({ text: item, correctIndex: i })).sort(() => Math.random() - 0.5);
        return `
            <div style="flex: 1; display: flex; flex-direction: column;">
                <div style="display: inline-flex; align-items: center; gap: 8px; background: ${module.color}15; padding: 8px 16px; border-radius: 20px; margin-bottom: 15px; align-self: flex-start;">
                    <span style="font-size: 1.2rem;">📋</span>
                    <span style="font-size: 0.85rem; color: ${module.color}; font-weight: 700; text-transform: uppercase;">Put in Order</span>
                </div>
                <p style="font-size: 1rem; color: var(--text-main); margin-bottom: 20px; font-weight: 500;">${game.question}</p>
                <div id="order-container" style="display: flex; flex-direction: column; gap: 12px;">
                    ${shuffled.map((item, i) => `
                        <div class="order-item" data-correct="${item.correctIndex}" draggable="true"
                            style="background: white; border: 3px solid #e5e7eb; border-radius: 16px; padding: 16px 18px; font-size: 1rem; cursor: grab; display: flex; align-items: center; gap: 14px; box-shadow: 0 3px 10px rgba(0,0,0,0.05); transition: all 0.2s; opacity: 0; animation: cardEnter 0.3s ease-out forwards; animation-delay: ${i * 0.05}s;">
                            <div class="order-number" style="width: 32px; height: 32px; background: ${module.color}20; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; color: ${module.color}; font-size: 0.9rem;">${i + 1}</div>
                            <span style="flex: 1; font-weight: 500;">${item.text}</span>
                            <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: #9ca3af;"><path d="M3 15h18v-2H3v2zm0 4h18v-2H3v2zm0-8h18V9H3v2zm0-6v2h18V5H3z"/></svg>
                        </div>
                    `).join('')}
                </div>
                <button onclick="window.checkOrderSequence()" style="margin-top: 30px; background: linear-gradient(135deg, ${module.color} 0%, ${module.color}dd 100%); color: white; border: none; padding: 16px; border-radius: 16px; font-size: 1.05rem; font-weight: 700; cursor: pointer; box-shadow: 0 4px 15px ${module.color}40;">Check Order</button>
            </div>
        `;
    }

    function renderScenarioStory(game, module) {
        return `
            <div style="flex: 1; display: flex; flex-direction: column;">
                <div style="display: inline-flex; align-items: center; gap: 8px; background: ${module.color}15; padding: 8px 16px; border-radius: 20px; margin-bottom: 15px; align-self: flex-start;">
                    <span style="font-size: 1.2rem;">📖</span>
                    <span style="font-size: 0.85rem; color: ${module.color}; font-weight: 700; text-transform: uppercase;">Scenario</span>
                </div>
                <div style="background: white; border-radius: 20px; padding: 24px; box-shadow: 0 6px 25px rgba(0,0,0,0.08); margin-bottom: 25px; position: relative; overflow: hidden;">
                    <div style="position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, ${module.color}, ${module.color}aa);"></div>
                    <div style="display: flex; gap: 15px; margin-bottom: 15px;">
                        <div style="width: 40px; height: 40px; background: ${module.color}15; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                            <span style="font-size: 1.3rem;">💭</span>
                        </div>
                        <p style="font-size: 1.05rem; color: var(--text-main); line-height: 1.65; margin: 0; flex: 1;">${game.scenario}</p>
                    </div>
                    <div style="border-top: 1px solid #e5e7eb; padding-top: 15px; margin-top: 10px;">
                        <p style="font-size: 1.05rem; color: var(--text-main); font-weight: 700; margin: 0;">${game.question}</p>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${game.options.map((option, i) => `
                        <button class="scenario-option" data-correct="${option.correct}" onclick="window.selectScenarioOption(this)"
                            style="background: white; border: 3px solid #e5e7eb; border-radius: 16px; padding: 18px; font-size: 1rem; color: var(--text-main); cursor: pointer; text-align: left; display: flex; align-items: flex-start; gap: 14px; box-shadow: 0 3px 10px rgba(0,0,0,0.05); transition: all 0.2s; opacity: 0; animation: cardEnter 0.3s ease-out forwards; animation-delay: ${i * 0.08}s;">
                            <span style="width: 32px; height: 32px; background: ${module.color}15; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 700; color: ${module.color}; font-size: 0.95rem; flex-shrink: 0;">${String.fromCharCode(65 + i)}</span>
                            <span style="flex: 1; font-weight: 500; line-height: 1.5;">${option.text}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Game Handlers
    window.answerSwipe = function(answer) {
        const lesson = learningState.currentLesson;
        const game = lesson.games[learningState.currentGameIndex];
        const isCorrect = answer === game.answer;
        learningState.gamesPlayed++;
        if (isCorrect) learningState.gamesCorrect++;
        showGameFeedback(isCorrect, game.explanation);
    };

    window.selectFillBlank = function(value) {
        const lesson = learningState.currentLesson;
        const game = lesson.games[learningState.currentGameIndex];
        const isCorrect = value === game.answer;

        document.querySelectorAll('.fill-blank-option').forEach(btn => {
            btn.style.opacity = '0.5';
            btn.style.pointerEvents = 'none';
            if (btn.dataset.value === value) {
                btn.style.background = isCorrect ? '#dcfce7' : '#fee2e2';
                btn.style.borderColor = isCorrect ? '#10b981' : '#ef4444';
                btn.style.opacity = '1';
            }
            if (btn.dataset.value === game.answer && !isCorrect) {
                btn.style.background = '#dcfce7';
                btn.style.borderColor = '#10b981';
                btn.style.opacity = '1';
            }
        });

        document.getElementById('blank-slot').textContent = value;
        learningState.gamesPlayed++;
        if (isCorrect) learningState.gamesCorrect++;
        setTimeout(() => showGameFeedback(isCorrect), 500);
    };

    window.toggleTapAllOption = function(element) {
        const checkbox = element.querySelector('.tap-checkbox');
        const isSelected = element.classList.toggle('selected');
        if (isSelected) {
            element.style.borderColor = '#7c3aed';
            element.style.background = '#f5f3ff';
            checkbox.style.background = '#7c3aed';
            checkbox.style.borderColor = '#7c3aed';
            checkbox.innerHTML = '✓';
            checkbox.style.color = 'white';
        } else {
            element.style.borderColor = '#e5e7eb';
            element.style.background = 'white';
            checkbox.style.background = 'white';
            checkbox.style.borderColor = '#d1d5db';
            checkbox.innerHTML = '';
        }
    };

    window.checkTapAll = function() {
        const options = document.querySelectorAll('.tap-all-option');
        let allCorrect = true;

        options.forEach(opt => {
            const isSelected = opt.classList.contains('selected');
            const shouldBeSelected = opt.dataset.correct === 'true';
            opt.style.pointerEvents = 'none';
            if (shouldBeSelected) {
                opt.style.background = '#dcfce7';
                opt.style.borderColor = '#10b981';
            }
            if (isSelected !== shouldBeSelected) {
                allCorrect = false;
                if (isSelected && !shouldBeSelected) {
                    opt.style.background = '#fee2e2';
                    opt.style.borderColor = '#ef4444';
                }
            }
        });

        learningState.gamesPlayed++;
        if (allCorrect) learningState.gamesCorrect++;
        setTimeout(() => showGameFeedback(allCorrect), 500);
    };

    // Match Pairs handler
    window.selectMatchItem = function(element, side) {
        const unit = UNITS[learningState.currentLesson.unitId];
        const module = MODULES[unit.moduleId];
        if (element.classList.contains('matched')) return;

        document.querySelectorAll(`.match-${side}`).forEach(el => {
            if (!el.classList.contains('matched')) {
                el.style.borderColor = '#e5e7eb';
                el.style.background = 'white';
            }
        });

        element.style.borderColor = module.color;
        element.style.background = module.color + '15';

        if (side === 'left') matchState.selectedLeft = element;
        else matchState.selectedRight = element;

        if (matchState.selectedLeft && matchState.selectedRight) {
            const leftIndex = matchState.selectedLeft.dataset.index;
            const rightIndex = matchState.selectedRight.dataset.index;

            if (leftIndex === rightIndex) {
                matchState.selectedLeft.classList.add('matched');
                matchState.selectedRight.classList.add('matched');
                matchState.selectedLeft.style.background = '#dcfce7';
                matchState.selectedLeft.style.borderColor = '#10b981';
                matchState.selectedRight.style.background = '#dcfce7';
                matchState.selectedRight.style.borderColor = '#10b981';
                matchState.matched.push(leftIndex);

                const lesson = learningState.currentLesson;
                const game = lesson.games[learningState.currentGameIndex];
                if (matchState.matched.length === game.pairs.length) {
                    learningState.gamesPlayed++;
                    learningState.gamesCorrect++;
                    setTimeout(() => showGameFeedback(true), 500);
                }
            } else {
                matchState.selectedLeft.style.background = '#fee2e2';
                matchState.selectedLeft.style.borderColor = '#ef4444';
                matchState.selectedRight.style.background = '#fee2e2';
                matchState.selectedRight.style.borderColor = '#ef4444';
                setTimeout(() => {
                    if (!matchState.selectedLeft?.classList.contains('matched')) {
                        matchState.selectedLeft.style.background = 'white';
                        matchState.selectedLeft.style.borderColor = '#e5e7eb';
                    }
                    if (!matchState.selectedRight?.classList.contains('matched')) {
                        matchState.selectedRight.style.background = 'white';
                        matchState.selectedRight.style.borderColor = '#e5e7eb';
                    }
                }, 500);
            }
            matchState.selectedLeft = null;
            matchState.selectedRight = null;
        }
    };

    // Scenario option handler
    window.selectScenarioOption = function(element) {
        const isCorrect = element.dataset.correct === 'true';
        const lesson = learningState.currentLesson;
        const game = lesson.games[learningState.currentGameIndex];

        document.querySelectorAll('.scenario-option').forEach(opt => {
            opt.style.pointerEvents = 'none';
            if (opt.dataset.correct === 'true') {
                opt.style.background = '#dcfce7';
                opt.style.borderColor = '#10b981';
            }
            if (opt === element && !isCorrect) {
                opt.style.background = '#fee2e2';
                opt.style.borderColor = '#ef4444';
            }
        });

        learningState.gamesPlayed++;
        if (isCorrect) learningState.gamesCorrect++;
        setTimeout(() => showGameFeedback(isCorrect, game.explanation), 500);
    };

    // Order sequence handler
    window.checkOrderSequence = function() {
        const items = document.querySelectorAll('.order-item');
        const game = learningState.currentLesson.games[learningState.currentGameIndex];

        // Build the user's current ordering as an array of original item indices
        const userOrder = Array.from(items).map(item => parseInt(item.dataset.correct));

        // Default correct order is [0, 1, 2, ..., n-1] (items array order)
        const defaultOrder = game.items.map((_, i) => i);
        const validOrders = game.acceptableOrders || [defaultOrder];

        // Check if user's order matches ANY valid ordering
        const allCorrect = validOrders.some(order =>
            order.length === userOrder.length && order.every((val, i) => val === userOrder[i])
        );

        // For per-item feedback, find which items are correct in at least one valid order
        items.forEach((item, i) => {
            const itemIndex = parseInt(item.dataset.correct);
            const isItemCorrect = validOrders.some(order => order[i] === itemIndex);
            item.style.background = isItemCorrect ? '#dcfce7' : '#fee2e2';
            item.style.borderColor = isItemCorrect ? '#10b981' : '#ef4444';
        });

        learningState.gamesPlayed++;
        if (allCorrect) learningState.gamesCorrect++;
        setTimeout(() => showGameFeedback(allCorrect), 500);
    };

    window.exitLesson = function() {
        if (confirm('Exit this lesson? Your progress won\'t be saved.')) {
            // Hide mascot
            if (window.LearningMascot) {
                window.LearningMascot.hide();
            }
            window.openLearningUnit(learningState.currentLesson.unitId);
        }
    };

    function showGameFeedback(isCorrect, explanation = '') {
        // Remove any existing overlay first
        const existing = document.getElementById('game-feedback-overlay');
        if (existing) existing.remove();

        const unit = UNITS[learningState.currentLesson.unitId];
        const module = MODULES[unit.moduleId];

        // Update streak
        if (isCorrect) {
            learningState.currentStreak++;
            if (learningState.currentStreak > learningState.maxStreak) {
                learningState.maxStreak = learningState.currentStreak;
            }

            // Mascot reaction
            if (window.LearningMascot) {
                window.LearningMascot.onCorrect(learningState.currentStreak);
            }

            // Sound and effects based on streak
            if (learningState.currentStreak >= 3 && learningState.currentStreak % 3 === 0) {
                playSound('streak');
                createConfetti(30, [module.color, '#f59e0b', '#10b981']);
            } else {
                playSound('correct');
            }
        } else {
            learningState.currentStreak = 0;
            playSound('incorrect');

            // Mascot reaction
            if (window.LearningMascot) {
                window.LearningMascot.onIncorrect();
            }
        }

        // Get dynamic feedback
        const emoji = getRandomItem(isCorrect ? characterEmojis.correct : characterEmojis.incorrect);
        const message = getRandomItem(isCorrect ? feedbackMessages.correct : feedbackMessages.incorrect);
        const streak = learningState.currentStreak;

        const overlay = document.createElement('div');
        overlay.id = 'game-feedback-overlay';
        overlay.style.cssText = `
            position: fixed; bottom: 0; left: 0; right: 0;
            background: ${isCorrect ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'};
            padding: 28px 20px; border-radius: 24px 24px 0 0;
            z-index: 99999; transform: translateY(100%);
            transition: transform 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            box-shadow: 0 -8px 30px rgba(0,0,0,0.25);
        `;

        const continueBtn = document.createElement('button');
        continueBtn.innerText = 'Continue';
        continueBtn.style.cssText = `width: 100%; background: white; color: ${isCorrect ? '#10b981' : '#ef4444'}; border: none; padding: 16px; border-radius: 14px; font-size: 1.1rem; font-weight: 800; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.15);`;
        continueBtn.addEventListener('click', function() {
            window.continueAfterFeedback();
        });

        let streakHtml = '';
        if (isCorrect && streak >= 2) {
            streakHtml = `<div style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
                <span class="streak-fire" style="font-size: 1rem;">🔥</span>
                <span style="font-size: 0.9rem; color: rgba(255,255,255,0.95); font-weight: 600;">${streak} in a row!</span>
            </div>`;
        }

        overlay.innerHTML = `
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: ${explanation ? '18px' : '12px'};">
                <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.25); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2rem; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                    ${emoji}
                </div>
                <div style="flex: 1;">
                    <div style="font-size: 1.4rem; font-weight: 800; color: white; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">${message}</div>
                    ${streakHtml}
                </div>
                ${isCorrect ? `<div style="width: 50px; height: 50px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                    <svg viewBox="0 0 24 24" style="width: 28px; height: 28px; fill: white;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                </div>` : ''}
            </div>
            ${explanation ? `<div style="background: rgba(255,255,255,0.15); padding: 14px 16px; border-radius: 14px; margin-bottom: 18px;"><p style="color: white; font-size: 0.95rem; line-height: 1.55; margin: 0; font-weight: 500;">${explanation}</p></div>` : ''}
        `;
        overlay.appendChild(continueBtn);

        document.body.appendChild(overlay);
        setTimeout(() => { overlay.style.transform = 'translateY(0)'; }, 50);
    }

    window.continueAfterFeedback = function() {
        const overlay = document.getElementById('game-feedback-overlay');
        if (overlay) {
            overlay.style.transform = 'translateY(100%)';
            setTimeout(() => overlay.remove(), 300);
        }
        learningState.currentGameIndex++;
        renderCurrentGame();
    };

    async function completeLesson() {
        // Hide mascot when lesson completes
        if (window.LearningMascot) {
            window.LearningMascot.hide();
        }

        const lesson = learningState.currentLesson;
        const unit = UNITS[lesson.unitId];
        const module = MODULES[unit.moduleId];
        const progress = learningState.userProgress;

        // Calculate score percentage
        const scorePercent = learningState.gamesPlayed > 0
            ? Math.round((learningState.gamesCorrect / learningState.gamesPlayed) * 100)
            : 0;

        // Check if already completed with 100%
        const isNewLesson = !progress.lessons_completed.includes(lesson.id);
        const needsPerfectScore = scorePercent < 100 && isNewLesson;
        let xpEarned = 0;

        // Only mark as completed and award XP if user gets 100%
        if (isNewLesson && scorePercent === 100) {
            progress.lessons_completed.push(lesson.id);
            xpEarned += LEARNING_XP.LESSON_COMPLETE; // 1 XP

            // Check if unit is now complete
            const unitLessons = getLessonsForUnit(lesson.unitId);
            const completedInUnit = unitLessons.filter(l => progress.lessons_completed.includes(l.id)).length;
            if (completedInUnit === unitLessons.length && !progress.units_completed.includes(lesson.unitId)) {
                progress.units_completed.push(lesson.unitId);
                xpEarned += LEARNING_XP.UNIT_COMPLETE_BONUS; // 2 XP

                // Check if module is now complete
                const moduleUnits = getUnitsForModule(unit.moduleId);
                const completedUnits = moduleUnits.filter(u => progress.units_completed.includes(u.id)).length;
                if (completedUnits === moduleUnits.length && !progress.modules_completed.includes(unit.moduleId)) {
                    progress.modules_completed.push(unit.moduleId);
                    xpEarned += LEARNING_XP.MODULE_COMPLETE_BONUS; // 5 XP
                }
            }
        }

        // Save to localStorage immediately
        saveLocalProgress();

        // Sync with database - the RPC handles XP awards to user_points
        let dbXpEarned = 0;
        let dbIsNewLesson = isNewLesson;
        let dbNeedsPerfectScore = needsPerfectScore;
        let rpcSucceeded = false;

        try {
            if (window.supabaseClient && window.currentUser) {
                const { data, error } = await window.supabaseClient.rpc('complete_lesson', {
                    p_user_id: window.currentUser.id,
                    p_lesson_id: lesson.id,
                    p_unit_id: lesson.unitId,
                    p_module_id: unit.moduleId,
                    p_games_played: learningState.gamesPlayed,
                    p_games_correct: learningState.gamesCorrect
                });

                if (error) {
                    console.log('DB sync failed, using local progress:', error.message);
                } else if (data) {
                    // Use database result as source of truth for XP
                    rpcSucceeded = true;
                    dbXpEarned = data.xp_earned || 0;
                    dbIsNewLesson = data.is_new_lesson;
                    dbNeedsPerfectScore = data.needs_perfect_score;

                    // Sync local progress with DB result
                    if (dbIsNewLesson && data.score_percentage === 100) {
                        // Ensure local progress matches DB
                        if (!progress.lessons_completed.includes(lesson.id)) {
                            progress.lessons_completed.push(lesson.id);
                            saveLocalProgress();
                        }

                        // Check if unit is now complete and sync with DB
                        // Always call complete_unit RPC when all lessons are done — the RPC handles dedup
                        const unitLessons = getLessonsForUnit(lesson.unitId);
                        const completedInUnit = unitLessons.filter(l => progress.lessons_completed.includes(l.id)).length;
                        if (completedInUnit === unitLessons.length) {
                            try {
                                const { data: unitData, error: unitError } = await window.supabaseClient.rpc('complete_unit', {
                                    p_user_id: window.currentUser.id,
                                    p_unit_id: lesson.unitId,
                                    p_module_id: unit.moduleId
                                });
                                if (!unitError && unitData) {
                                    if (unitData.xp_earned > 0) {
                                        dbXpEarned += unitData.xp_earned;
                                    }
                                    if (!progress.units_completed.includes(lesson.unitId)) {
                                        progress.units_completed.push(lesson.unitId);
                                    }
                                    saveLocalProgress();

                                    // Check if module is now complete and sync with DB
                                    const moduleUnits = getUnitsForModule(unit.moduleId);
                                    const completedUnits = moduleUnits.filter(u => progress.units_completed.includes(u.id)).length;
                                    if (completedUnits === moduleUnits.length) {
                                        const { data: moduleData, error: moduleError } = await window.supabaseClient.rpc('complete_module', {
                                            p_user_id: window.currentUser.id,
                                            p_module_id: unit.moduleId
                                        });
                                        if (!moduleError && moduleData) {
                                            if (moduleData.xp_earned > 0) {
                                                dbXpEarned += moduleData.xp_earned;
                                            }
                                            if (!progress.modules_completed.includes(unit.moduleId)) {
                                                progress.modules_completed.push(unit.moduleId);
                                            }
                                            saveLocalProgress();
                                        }
                                    }
                                }
                            } catch (e) {
                                console.log('Unit/module completion check failed:', e.message);
                            }
                        }
                    }

                    // If DB says we earned XP, trigger rainbow animation
                    if (dbXpEarned > 0) {
                        if (typeof window.triggerXPBarRainbow === 'function') window.triggerXPBarRainbow();
                    }
                }
            }
        } catch (err) {
            console.log('DB sync failed, using local progress:', err.message);
        }

        // Daily Quiz Bonus: award +5 XP if this was a daily quiz and lesson completed with 100%
        let dailyQuizBonus = 0;
        if (learningState.isDailyQuiz && scorePercent === 100 && !isDailyQuizCompletedToday()) {
            dailyQuizBonus = 5;
            markDailyQuizCompleted();

            // Award bonus XP to user_points in database
            try {
                if (window.supabaseClient && window.currentUser) {
                    const { data: currentPoints } = await window.supabaseClient
                        .from('user_points')
                        .select('lifetime_points')
                        .eq('user_id', window.currentUser.id)
                        .maybeSingle();

                    if (currentPoints) {
                        await window.supabaseClient
                            .from('user_points')
                            .update({ lifetime_points: (currentPoints.lifetime_points || 0) + dailyQuizBonus })
                            .eq('user_id', window.currentUser.id);
                    } else {
                        await window.supabaseClient
                            .from('user_points')
                            .insert({ user_id: window.currentUser.id, lifetime_points: dailyQuizBonus, current_points: 0 });
                    }

                    if (typeof window.triggerXPBarRainbow === 'function') window.triggerXPBarRainbow();
                }
            } catch (bonusErr) {
                console.log('Daily quiz bonus XP award skipped:', bonusErr);
            }

            learningState.isDailyQuiz = false;

            // Update the dashboard daily quiz card
            if (typeof window.refreshDailyQuizCard === 'function') {
                window.refreshDailyQuizCard();
            }
        }

        // ALWAYS refresh tamagotchi display after lesson completion to sync with database
        if (typeof window.refreshLevelDisplay === 'function') {
            window.refreshLevelDisplay();
        }

        // Use DB result if RPC succeeded (source of truth), otherwise fall back to local calculation
        const finalXpEarned = (rpcSucceeded ? dbXpEarned : xpEarned) + dailyQuizBonus;
        const result = { xp_earned: finalXpEarned, is_new_lesson: dbIsNewLesson, needs_perfect_score: dbNeedsPerfectScore, daily_quiz_bonus: dailyQuizBonus, was_daily_quiz: learningState.isDailyQuiz };
        renderLessonComplete(result, lesson, module);
    }

    function renderLessonComplete(result, lesson, module) {
        const container = document.getElementById('learning-content');
        if (!container) return;
        learningState.currentView = 'lessonComplete';

        const scorePercent = learningState.gamesPlayed > 0
            ? Math.round((learningState.gamesCorrect / learningState.gamesPlayed) * 100)
            : 100;

        const xpColor = result?.xp_earned > 0 ? '#10b981' : '#9ca3af';

        // Determine status message
        let statusMessage = '';
        if (result?.daily_quiz_bonus > 0) {
            statusMessage = `<div style="margin-top: 20px; padding: 12px 16px; background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); border-radius: 12px; font-size: 0.9rem; color: white; font-weight: 600; text-align: center;">
                Daily Quiz Bonus: +${result.daily_quiz_bonus} XP
            </div>`;
        } else if (result?.is_new_lesson === false) {
            statusMessage = `<div style="margin-top: 20px; padding: 12px 16px; background: rgba(255,255,255,0.2); border-radius: 12px; font-size: 0.85rem; color: white; font-weight: 500;">
                You've already earned XP for this lesson.
            </div>`;
        } else if (result?.needs_perfect_score) {
            statusMessage = `<div style="margin-top: 20px; padding: 12px 16px; background: rgba(255,255,255,0.2); border-radius: 12px; font-size: 0.85rem; color: white; font-weight: 500;">
                Get 100% to earn XP! You can retake this lesson.
            </div>`;
        }

        container.innerHTML = `
            <div style="min-height: 100vh; background: ${module.color}; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; text-align: center;">
                <div style="width: 120px; height: 120px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 30px; box-shadow: 0 8px 32px rgba(0,0,0,0.2); animation: bounceIn 0.6s ease;">
                    <span style="font-size: 60px;">${scorePercent === 100 ? '🎉' : scorePercent >= 80 ? '👍' : '💪'}</span>
                </div>

                <h1 style="color: white; font-size: 2rem; font-weight: 800; margin: 0 0 8px; text-shadow: 0 2px 10px rgba(0,0,0,0.2);">${scorePercent === 100 ? 'Perfect Score!' : 'Lesson Complete!'}</h1>
                <p style="color: rgba(255,255,255,0.95); font-size: 1.1rem; margin: 0 0 40px; font-weight: 500;">${lesson.title}</p>

                <div style="background: white; border-radius: 24px; padding: 30px 40px; width: 100%; max-width: 300px; box-shadow: 0 8px 32px rgba(0,0,0,0.15);">
                    <div style="display: flex; justify-content: space-around; align-items: center;">
                        <div style="text-align: center;">
                            <div style="font-size: 2.5rem; font-weight: 800; color: #1f2937;">${scorePercent}%</div>
                            <div style="font-size: 0.85rem; color: #6b7280; font-weight: 600;">Score</div>
                        </div>
                        <div style="width: 1px; height: 50px; background: #e5e7eb;"></div>
                        <div style="text-align: center;">
                            <div style="font-size: 2.5rem; font-weight: 800; color: ${xpColor};">${result?.xp_earned > 0 ? '+' + result.xp_earned : '0'}</div>
                            <div style="font-size: 0.85rem; color: #6b7280; font-weight: 600;">XP Earned</div>
                        </div>
                    </div>
                    ${statusMessage}
                </div>

                <div style="display: flex; gap: 12px; margin-top: 30px; flex-wrap: wrap; justify-content: center;">
                    ${scorePercent < 100 && result?.is_new_lesson !== false ? `
                        <button onclick="${result?.was_daily_quiz ? `window.startDailyQuiz('${lesson.id}')` : `window.startLesson('${lesson.id}')`}" style="background: white; color: ${module.color}; border: none; padding: 16px 30px; border-radius: 30px; font-size: 1.1rem; font-weight: 700; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                            Try Again
                        </button>
                    ` : ''}
                    <button onclick="window.openLearningUnit('${lesson.unitId}')" style="background: ${scorePercent < 100 && result?.is_new_lesson !== false ? 'rgba(255,255,255,0.2)' : 'white'}; color: ${scorePercent < 100 && result?.is_new_lesson !== false ? 'white' : module.color}; border: none; padding: 16px 30px; border-radius: 30px; font-size: 1.1rem; font-weight: 700; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                        Continue Learning
                    </button>
                </div>
            </div>
        `;
    }

    // =============================================================================
    // EXPOSE TO GLOBAL SCOPE
    // =============================================================================

    window.initLearning = initLearning;
    window.renderLearningHome = renderLearningHome;

    // Expose daily quiz helpers for dashboard card
    window._isDailyQuizCompletedToday = isDailyQuizCompletedToday;
    window._getNextAvailableLesson = function() {
        return getNextAvailableLesson(learningState.userProgress);
    };
    window._getRandomAvailableLesson = function() {
        return getRandomAvailableLesson(learningState.userProgress);
    };
    window._getLessonById = function(lessonId) {
        const lesson = getLessonById(lessonId);
        if (!lesson) return null;
        const unit = UNITS[lesson.unitId];
        if (!unit) return null;
        const module = MODULES[unit.moduleId];
        if (!module) return null;
        return { lesson, unit, module };
    };
    window._isLessonCompleted = function(lessonId) {
        return learningState.userProgress?.lessons_completed?.includes(lessonId) || false;
    };
    window._ensureLearningProgressLoaded = ensureLearningProgressLoaded;

    // =============================================================================
    // LEARNING HISTORY STATE MANAGEMENT
    // Pushes browser history entries so system back gestures (iOS swipe, Android
    // back button/gesture) navigate within the learning tab instead of leaving
    // the page entirely.
    // =============================================================================

    let learningHistoryDepth = 0;
    // When true, navigation functions skip pushing history (used during back navigation)
    let learningIsNavigatingBack = false;

    function pushLearningHistoryState() {
        if (learningIsNavigatingBack) return;
        learningHistoryDepth++;
        history.pushState({ learningNav: true, depth: learningHistoryDepth }, '', window.location.href);
    }

    function popLearningHistoryState() {
        if (learningHistoryDepth > 0) {
            learningHistoryDepth--;
        }
    }

    // Reset depth when returning to learning home (e.g. via custom swipe or direct call)
    const originalRenderLearningHome = renderLearningHome;
    renderLearningHome = function() {
        learningHistoryDepth = 0;
        originalRenderLearningHome();
    };
    // Update the window reference to use the wrapped version
    window.renderLearningHome = renderLearningHome;

    // Flag to prevent double-handling when the custom swipe handler also pops history
    window._learningSwipeHandledBack = false;

    window.addEventListener('popstate', function(event) {
        // If the custom swipe handler already handled this back, skip
        if (window._learningSwipeHandledBack) {
            window._learningSwipeHandledBack = false;
            return;
        }

        // Only handle learning-related history states
        const viewLearning = document.getElementById('view-learning');
        if (!viewLearning || viewLearning.style.display === 'none') return;

        // Check if this was a learning history entry
        if (event.state && event.state.learningNav) {
            popLearningHistoryState();
            const backAction = window.getLearningBackAction();
            if (backAction) {
                // Prevent the back action's navigation from pushing new history
                learningIsNavigatingBack = true;
                backAction();
                learningIsNavigatingBack = false;
            }
        }
    });

    // Expose for use by the swipe handler in dashboard.html
    window._popLearningHistoryState = popLearningHistoryState;
    window._setLearningNavigatingBack = function(val) { learningIsNavigatingBack = val; };

    // Swipe-back navigation support for learning tab
    window.getLearningBackAction = function() {
        const view = learningState.currentView;
        if (view === 'module') {
            return () => window.renderLearningHome();
        } else if (view === 'unit') {
            const moduleId = learningState.currentUnit?.moduleId || learningState.currentModule?.id;
            if (moduleId) return () => window.openLearningModule(moduleId);
            return () => window.renderLearningHome();
        } else if (view === 'lessonIntro') {
            const unitId = learningState.currentLesson?.unitId;
            if (unitId) return () => window.openLearningUnit(unitId);
            return () => window.renderLearningHome();
        } else if (view === 'game') {
            return () => window.exitLesson();
        } else if (view === 'lessonComplete') {
            const unitId = learningState.currentLesson?.unitId;
            if (unitId) return () => window.openLearningUnit(unitId);
            return () => window.renderLearningHome();
        }
        return null; // 'home' - no back action
    };

    // =============================================================================
    // QUIZ BATTLE SYSTEM
    // =============================================================================

    const QUIZ_BATTLE_TIME_LIMITS = {
        [GAME_TYPES.SWIPE_TRUE_FALSE]: 8,
        [GAME_TYPES.FILL_BLANK]: 10,
        [GAME_TYPES.TAP_ALL]: 12,
        [GAME_TYPES.SCENARIO_STORY]: 15,
        [GAME_TYPES.MATCH_PAIRS]: 18,
        [GAME_TYPES.ORDER_SEQUENCE]: 18,
    };

    const QUIZ_BATTLE_QUESTIONS = 15;

    // Quiz battle state
    let quizBattleState = {
        battleId: null,
        channel: null,
        questions: [],
        currentIndex: 0,
        score: 0,
        totalTimeMs: 0,
        questionStartTime: 0,
        timerInterval: null,
        opponentScore: 0,
        opponentFinished: false,
        isChallenger: false,
        opponentName: '',
        coinBet: 0,
        answered: false,
        matchedPairs: [],
        selectedLeft: null,
    };

    // Seeded random number generator (mulberry32)
    function seededRandom(seed) {
        let t = seed >>> 0;
        return function() {
            t = (t + 0x6D2B79F5) | 0;
            let r = Math.imul(t ^ (t >>> 15), 1 | t);
            r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
            return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
        };
    }

    // Hash string to number for seeding
    function hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return Math.abs(hash);
    }

    // Collect all games from LESSONS into a flat array with references
    function getAllGamesFlat() {
        const allGames = [];
        for (const unitId of Object.keys(LESSONS)) {
            const lessons = LESSONS[unitId];
            for (let li = 0; li < lessons.length; li++) {
                const lesson = lessons[li];
                for (let gi = 0; gi < lesson.games.length; gi++) {
                    allGames.push({
                        ref: { unitId, lessonIdx: li, gameIdx: gi },
                        game: lesson.games[gi]
                    });
                }
            }
        }
        return allGames;
    }

    // Generate 15 deterministic questions from a battle ID seed
    function generateQuizBattleQuestions(battleId) {
        const allGames = getAllGamesFlat();
        const rng = seededRandom(hashString(battleId));

        // Shuffle using Fisher-Yates with seeded random
        const shuffled = [...allGames];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        // Pick 15 with variety (max 3 of any type)
        const typeCounts = {};
        const selected = [];
        for (const entry of shuffled) {
            if (selected.length >= QUIZ_BATTLE_QUESTIONS) break;
            const type = entry.game.type;
            typeCounts[type] = (typeCounts[type] || 0) + 1;
            if (typeCounts[type] <= 3) {
                selected.push(entry);
            }
        }

        // If not enough due to type limits, fill from remaining
        if (selected.length < QUIZ_BATTLE_QUESTIONS) {
            for (const entry of shuffled) {
                if (selected.length >= QUIZ_BATTLE_QUESTIONS) break;
                if (!selected.includes(entry)) {
                    selected.push(entry);
                }
            }
        }

        return selected.map(e => e.game);
    }

    // ---- QUIZ BATTLE INVITE MODAL ----

    window.showQuizBattleInviteModal = async function() {
        // Remove existing overlay if any
        const existing = document.getElementById('quiz-battle-invite-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'battle-invite-overlay';
        overlay.id = 'quiz-battle-invite-overlay';
        overlay.style.zIndex = '10001';

        // Get coin balance
        let coinBalance = 0;
        try {
            if (window.supabaseClient && window.currentUser) {
                const { data } = await window.supabaseClient.rpc('get_coin_balance', { user_uuid: window.currentUser.id });
                coinBalance = data || 0;
            }
        } catch (e) {}

        // Fetch friends
        let friendsHtml = '';
        try {
            if (window.supabaseClient && window.currentUser) {
                const { data: friends, error } = await window.supabaseClient
                    .rpc('get_friends_with_status', { user_uuid: window.currentUser.id });

                if (!error && friends && friends.length > 0) {
                    friendsHtml = friends.map(friend => {
                        const initials = (friend.friend_name || '?').charAt(0).toUpperCase();
                        const isActive = friend.has_workout_today || friend.has_meal_today;
                        const statusText = isActive ? 'Active today' : (friend.days_inactive > 0 ? `${friend.days_inactive}d ago` : 'Online');
                        const statusClass = isActive ? 'active' : '';
                        const photoHtml = friend.friend_photo
                            ? `<img src="${friend.friend_photo}" alt="${friend.friend_name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
                            : initials;
                        const streak = friend.current_streak > 0 ? ` 🔥${friend.current_streak}` : '';
                        const safeName = (friend.friend_name || '').replace(/'/g, "\\'");

                        return `
                            <div class="battle-invite-friend" onclick="window._sendQuizBattleInvite('${friend.friend_id}', '${safeName}')">
                                <div class="battle-invite-avatar">${photoHtml}</div>
                                <div class="battle-invite-info">
                                    <div class="battle-invite-name">${friend.friend_name || 'Friend'}${streak}</div>
                                    <div class="battle-invite-status ${statusClass}">${statusText}</div>
                                </div>
                                <button class="battle-invite-btn" style="background: linear-gradient(135deg, #7c3aed, #6366f1);">Challenge</button>
                            </div>`;
                    }).join('');
                } else {
                    friendsHtml = `<div style="text-align: center; padding: 30px 20px; color: rgba(255,255,255,0.5);">
                        <div style="font-size: 2rem; margin-bottom: 10px;">👥</div>
                        <div>Add friends to start quiz battles!</div>
                    </div>`;
                }
            }
        } catch (e) {
            console.warn('Could not fetch friends for quiz battle:', e);
        }

        overlay.innerHTML = `
            <div class="battle-invite-modal" style="border-color: rgba(124,58,237,0.3); box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(124,58,237,0.15);">
                <div class="battle-invite-header" style="border-bottom-color: rgba(124,58,237,0.2);">
                    <h2>⚡ Quiz Battle</h2>
                    <p>15 questions, same for both players!</p>
                </div>
                <div class="battle-invite-body">
                    <!-- Coin Bet Picker -->
                    <div style="padding: 10px 0 14px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                            <span style="font-size: 0.8rem; color: rgba(255,255,255,0.6); font-weight: 600;">WAGER COINS</span>
                            <span style="font-size: 0.75rem; color: rgba(255,255,255,0.4);">Balance: 🪙 ${coinBalance.toLocaleString()}</span>
                        </div>
                        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                            <button onclick="window._setQuizBattleBet(0, this)" class="qb-bet-btn active" style="flex: 1; min-width: 50px; padding: 8px; background: rgba(124,58,237,0.3); border: 2px solid rgba(124,58,237,0.5); border-radius: 8px; color: white; font-weight: 700; font-size: 0.8rem; cursor: pointer;">Free</button>
                            <button onclick="window._setQuizBattleBet(10, this)" class="qb-bet-btn" style="flex: 1; min-width: 50px; padding: 8px; background: rgba(255,255,255,0.08); border: 2px solid rgba(255,255,255,0.15); border-radius: 8px; color: white; font-weight: 700; font-size: 0.8rem; cursor: pointer;">🪙 10</button>
                            <button onclick="window._setQuizBattleBet(50, this)" class="qb-bet-btn" style="flex: 1; min-width: 50px; padding: 8px; background: rgba(255,255,255,0.08); border: 2px solid rgba(255,255,255,0.15); border-radius: 8px; color: white; font-weight: 700; font-size: 0.8rem; cursor: pointer;">🪙 50</button>
                            <button onclick="window._setQuizBattleBet(100, this)" class="qb-bet-btn" style="flex: 1; min-width: 50px; padding: 8px; background: rgba(255,255,255,0.08); border: 2px solid rgba(255,255,255,0.15); border-radius: 8px; color: white; font-weight: 700; font-size: 0.8rem; cursor: pointer;">🪙 100</button>
                            <button onclick="window._setQuizBattleBet(500, this)" class="qb-bet-btn" style="flex: 1; min-width: 50px; padding: 8px; background: rgba(255,255,255,0.08); border: 2px solid rgba(255,255,255,0.15); border-radius: 8px; color: white; font-weight: 700; font-size: 0.8rem; cursor: pointer;">🪙 500</button>
                        </div>
                        <div style="margin-top: 8px;">
                            <input type="number" id="qb-custom-bet" placeholder="Or enter custom amount..." min="0" style="width: 100%; padding: 8px 12px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: white; font-size: 0.85rem; box-sizing: border-box;" oninput="window._setQuizBattleBet(parseInt(this.value) || 0)">
                        </div>
                    </div>

                    <div style="padding: 8px 0 4px; font-size: 0.7rem; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px;">Challenge a friend</div>
                    ${friendsHtml}
                </div>
                <div class="battle-invite-footer">
                    <button class="battle-invite-close" onclick="window._closeQuizBattleInvite()">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) window._closeQuizBattleInvite();
        });
    };

    window._currentQuizBattleBet = 0;

    window._setQuizBattleBet = function(amount, btnEl) {
        window._currentQuizBattleBet = amount;
        if (btnEl) {
            document.querySelectorAll('.qb-bet-btn').forEach(b => {
                b.style.background = 'rgba(255,255,255,0.08)';
                b.style.borderColor = 'rgba(255,255,255,0.15)';
                b.className = 'qb-bet-btn';
            });
            btnEl.style.background = 'rgba(124,58,237,0.3)';
            btnEl.style.borderColor = 'rgba(124,58,237,0.5)';
            btnEl.className = 'qb-bet-btn active';
        }
    };

    window._closeQuizBattleInvite = function() {
        const overlay = document.getElementById('quiz-battle-invite-overlay');
        if (overlay) overlay.remove();
    };

    // ---- SEND QUIZ BATTLE INVITE ----

    window._sendQuizBattleInvite = async function(friendId, friendName) {
        const betAmount = window._currentQuizBattleBet || 0;

        // Debit coins
        if (betAmount > 0 && window.supabaseClient && window.currentUser) {
            try {
                const { data: newBalance, error } = await window.supabaseClient
                    .rpc('debit_coins', {
                        user_uuid: window.currentUser.id,
                        coin_amount: betAmount,
                        txn_type: 'battle_bet',
                        txn_description: 'Quiz battle bet vs ' + friendName,
                        txn_reference: friendId
                    });
                if (error) throw error;
                if (newBalance === -1) {
                    alert('Not enough coins for this bet!');
                    return;
                }
                if (typeof updateCoinBalanceDisplay === 'function') updateCoinBalanceDisplay(newBalance);
            } catch (e) {
                console.warn('Could not debit quiz battle bet:', e);
                alert('Failed to place bet. Please try again.');
                return;
            }
        }

        window._closeQuizBattleInvite();

        // Create quiz battle in DB
        let battleId = null;
        try {
            if (window.supabaseClient && window.currentUser) {
                const tempId = crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2));
                const { data, error } = await window.supabaseClient
                    .rpc('create_quiz_battle', {
                        p_challenger_id: window.currentUser.id,
                        p_opponent_id: friendId,
                        p_coin_bet: betAmount,
                        p_question_seed: tempId
                    });
                if (error) throw error;
                battleId = data;
            }
        } catch (e) {
            console.warn('Could not create quiz battle:', e);
            if (typeof showToast === 'function') showToast('Failed to create quiz battle', 'error');
            return;
        }

        if (!battleId) return;

        // Send nudge
        try {
            if (window.supabaseClient && window.currentUser) {
                await window.supabaseClient.from('nudges').insert({
                    sender_id: window.currentUser.id,
                    receiver_id: friendId,
                    message: betAmount > 0
                        ? '⚡ QUIZ BATTLE! 🪙 ' + betAmount + ' coin bet! Tap to accept!'
                        : '⚡ QUIZ BATTLE! Tap to accept and play!',
                    coin_bet: betAmount
                });
            }
        } catch (e) {
            console.warn('Could not send quiz battle nudge:', e);
        }

        // Start the battle as challenger
        startQuizBattle(battleId, friendName, betAmount, true);
    };

    // ---- ACCEPT QUIZ BATTLE (called from notification) ----

    window.acceptQuizBattle = async function(battleId, fromName, betAmount) {
        // Debit coins from opponent
        if (betAmount > 0 && window.supabaseClient && window.currentUser) {
            try {
                const { data: newBalance, error } = await window.supabaseClient
                    .rpc('debit_coins', {
                        user_uuid: window.currentUser.id,
                        coin_amount: betAmount,
                        txn_type: 'battle_bet',
                        txn_description: 'Quiz battle bet vs ' + fromName,
                        txn_reference: battleId
                    });
                if (error) throw error;
                if (newBalance === -1) {
                    alert('Not enough coins for this bet!');
                    return;
                }
                if (typeof updateCoinBalanceDisplay === 'function') updateCoinBalanceDisplay(newBalance);
            } catch (e) {
                console.warn('Could not debit quiz battle bet:', e);
                alert('Failed to place bet. Please try again.');
                return;
            }
        }

        // Join in DB
        try {
            if (window.supabaseClient && window.currentUser) {
                const { data, error } = await window.supabaseClient
                    .rpc('join_quiz_battle', {
                        p_battle_id: battleId,
                        p_user_id: window.currentUser.id
                    });
                if (error) throw error;
                if (data && data.error) {
                    if (typeof showToast === 'function') showToast('Battle ' + data.error, 'error');
                    return;
                }
            }
        } catch (e) {
            console.warn('Could not join quiz battle:', e);
            return;
        }

        // Switch to learning tab
        if (typeof switchAppTab === 'function') switchAppTab('learning');

        // Start the battle as opponent
        startQuizBattle(battleId, fromName, betAmount, false);
    };

    // ---- START QUIZ BATTLE ----

    function startQuizBattle(battleId, opponentName, coinBet, isChallenger) {
        // Reset state
        quizBattleState = {
            battleId,
            channel: null,
            questions: generateQuizBattleQuestions(battleId),
            currentIndex: 0,
            score: 0,
            totalTimeMs: 0,
            questionStartTime: 0,
            timerInterval: null,
            opponentScore: 0,
            opponentFinished: false,
            isChallenger,
            opponentName,
            coinBet,
            answered: false,
            matchedPairs: [],
            selectedLeft: null,
        };

        // Set up Supabase Realtime channel
        if (window.supabaseClient) {
            const channel = window.supabaseClient.channel('quiz-battle-' + battleId);

            channel.on('broadcast', { event: 'score_update' }, (payload) => {
                quizBattleState.opponentScore = payload.payload.score;
                updateQuizBattleScoreboard();
            });

            channel.on('broadcast', { event: 'battle_finished' }, (payload) => {
                quizBattleState.opponentFinished = true;
                quizBattleState.opponentScore = payload.payload.score;
                updateQuizBattleScoreboard();
                // If we're also done, show results
                if (quizBattleState.currentIndex >= QUIZ_BATTLE_QUESTIONS) {
                    showQuizBattleResults();
                }
            });

            channel.subscribe((status) => {
                console.log('Quiz battle channel:', status);
            });

            quizBattleState.channel = channel;
        }

        // Show countdown then start
        showQuizBattleCountdown();
    }

    function showQuizBattleCountdown() {
        const container = document.getElementById('learning-content');
        if (!container) return;

        const playerName = window.currentUser?.user_metadata?.name || window.currentUser?.email?.split('@')[0] || 'You';

        container.innerHTML = `
            <div style="min-height: 80vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); padding: 30px;">
                <div style="text-align: center; color: white;">
                    <div style="font-size: 1.2rem; color: rgba(255,255,255,0.6); margin-bottom: 20px; text-transform: uppercase; letter-spacing: 2px;">Quiz Battle</div>
                    <div style="display: flex; align-items: center; justify-content: center; gap: 20px; margin-bottom: 40px;">
                        <div style="text-align: center;">
                            <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #7c3aed, #6366f1); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin: 0 auto 8px;">
                                ${playerName.charAt(0).toUpperCase()}
                            </div>
                            <div style="font-size: 0.85rem; font-weight: 600;">${playerName}</div>
                        </div>
                        <div style="font-size: 1.5rem; font-weight: 800; color: #fbbf24;">VS</div>
                        <div style="text-align: center;">
                            <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #e74c3c, #ff6b6b); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin: 0 auto 8px;">
                                ${quizBattleState.opponentName.charAt(0).toUpperCase()}
                            </div>
                            <div style="font-size: 0.85rem; font-weight: 600;">${quizBattleState.opponentName}</div>
                        </div>
                    </div>
                    ${quizBattleState.coinBet > 0 ? `<div style="font-size: 0.9rem; color: #fbbf24; margin-bottom: 20px;">🪙 ${quizBattleState.coinBet} coin wager</div>` : ''}
                    <div style="font-size: 0.85rem; color: rgba(255,255,255,0.5); margin-bottom: 30px;">15 questions · Timed · Same questions for both</div>
                    <div id="qb-countdown" style="font-size: 4rem; font-weight: 800; color: #fbbf24; text-shadow: 0 0 30px rgba(251,191,36,0.5);">3</div>
                </div>
            </div>
        `;

        let count = 3;
        const countdownEl = document.getElementById('qb-countdown');
        if (quizBattleState.countdownInterval) clearInterval(quizBattleState.countdownInterval);
        quizBattleState.countdownInterval = setInterval(() => {
            count--;
            if (countdownEl) countdownEl.textContent = count > 0 ? count : 'GO!';
            if (count <= 0) {
                clearInterval(quizBattleState.countdownInterval);
                quizBattleState.countdownInterval = null;
                setTimeout(() => renderQuizBattleQuestion(), 500);
            }
        }, 1000);
    }

    // ---- RENDER QUIZ BATTLE QUESTION ----

    function renderQuizBattleQuestion() {
        const container = document.getElementById('learning-content');
        if (!container) return;

        const idx = quizBattleState.currentIndex;
        if (idx >= QUIZ_BATTLE_QUESTIONS) {
            finishQuizBattle();
            return;
        }

        const game = quizBattleState.questions[idx];
        const timeLimit = QUIZ_BATTLE_TIME_LIMITS[game.type] || 10;

        quizBattleState.answered = false;
        quizBattleState.matchedPairs = [];
        quizBattleState.selectedLeft = null;
        quizBattleState.questionStartTime = Date.now();

        // Build the question HTML
        let questionHtml = '';
        switch (game.type) {
            case GAME_TYPES.SWIPE_TRUE_FALSE:
                questionHtml = renderBattleSwipeTF(game);
                break;
            case GAME_TYPES.FILL_BLANK:
                questionHtml = renderBattleFillBlank(game);
                break;
            case GAME_TYPES.TAP_ALL:
                questionHtml = renderBattleTapAll(game);
                break;
            case GAME_TYPES.MATCH_PAIRS:
                questionHtml = renderBattleMatchPairs(game);
                break;
            case GAME_TYPES.ORDER_SEQUENCE:
                questionHtml = renderBattleOrderSequence(game);
                break;
            case GAME_TYPES.SCENARIO_STORY:
                questionHtml = renderBattleScenario(game);
                break;
        }

        // Progress dots
        let dotsHtml = '';
        for (let i = 0; i < QUIZ_BATTLE_QUESTIONS; i++) {
            const dotStyle = i < idx ? 'background: #10b981;' : i === idx ? 'background: #7c3aed; transform: scale(1.3);' : 'background: rgba(255,255,255,0.2);';
            dotsHtml += `<div style="width: 8px; height: 8px; border-radius: 50%; ${dotStyle} transition: all 0.3s;"></div>`;
        }

        container.innerHTML = `
            <div style="min-height: 100vh; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); display: flex; flex-direction: column;">
                <!-- Top Bar -->
                <div style="padding: 12px 16px; display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="background: linear-gradient(135deg, #7c3aed, #6366f1); border-radius: 8px; padding: 4px 10px; font-weight: 700; color: white; font-size: 0.85rem;" id="qb-my-score">You: ${quizBattleState.score}</div>
                    </div>
                    <div style="font-size: 0.75rem; color: rgba(255,255,255,0.5);">${idx + 1}/${QUIZ_BATTLE_QUESTIONS}</div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="background: linear-gradient(135deg, #e74c3c, #ff6b6b); border-radius: 8px; padding: 4px 10px; font-weight: 700; color: white; font-size: 0.85rem;" id="qb-opp-score">${quizBattleState.opponentName.split(' ')[0]}: ${quizBattleState.opponentScore}</div>
                    </div>
                </div>

                <!-- Timer Bar -->
                <div style="padding: 0 16px; margin-bottom: 8px;">
                    <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                        <div id="qb-timer-bar" style="height: 100%; width: 100%; background: linear-gradient(90deg, #10b981, #fbbf24); border-radius: 3px; transition: width 0.1s linear;"></div>
                    </div>
                    <div style="display: flex; justify-content: flex-end; margin-top: 4px;">
                        <span id="qb-timer-text" style="font-size: 0.8rem; color: rgba(255,255,255,0.6); font-weight: 600; font-variant-numeric: tabular-nums;">${timeLimit}s</span>
                    </div>
                </div>

                <!-- Progress Dots -->
                <div style="display: flex; gap: 5px; justify-content: center; padding: 0 16px 12px;">
                    ${dotsHtml}
                </div>

                <!-- Question Area -->
                <div style="flex: 1; padding: 0 16px 100px; overflow-y: auto;">
                    ${questionHtml}
                </div>
            </div>
        `;

        // Start timer
        let timeRemaining = timeLimit;
        quizBattleState.timerInterval = setInterval(() => {
            timeRemaining -= 0.1;
            const percent = Math.max(0, (timeRemaining / timeLimit) * 100);
            const bar = document.getElementById('qb-timer-bar');
            const text = document.getElementById('qb-timer-text');
            if (bar) {
                bar.style.width = percent + '%';
                if (percent < 30) bar.style.background = 'linear-gradient(90deg, #ef4444, #f97316)';
                else if (percent < 60) bar.style.background = 'linear-gradient(90deg, #f97316, #fbbf24)';
            }
            if (text) text.textContent = Math.max(0, Math.ceil(timeRemaining)) + 's';

            if (timeRemaining <= 0) {
                clearInterval(quizBattleState.timerInterval);
                if (!quizBattleState.answered) {
                    handleQuizBattleAnswer(false);
                }
            }
        }, 100);

        // Init drag-and-drop for order sequence
        if (game.type === GAME_TYPES.ORDER_SEQUENCE) {
            setTimeout(() => initBattleOrderDragDrop(), 50);
        }
    }

    // ---- GAME TYPE RENDERERS (Battle versions) ----

    function renderBattleSwipeTF(game) {
        return `
            <div style="text-align: center; padding: 20px 0;">
                <div style="font-size: 0.75rem; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">True or False</div>
                <div style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 24px 20px; margin-bottom: 30px;">
                    <p style="font-size: 1.05rem; color: white; line-height: 1.6; margin: 0;">${game.question}</p>
                </div>
                <div style="display: flex; gap: 16px; justify-content: center;">
                    <button onclick="window._qbAnswerSwipe(true)" style="flex: 1; max-width: 140px; padding: 16px; background: linear-gradient(135deg, #10b981, #059669); border: none; border-radius: 14px; color: white; font-weight: 700; font-size: 1.1rem; cursor: pointer; box-shadow: 0 4px 15px rgba(16,185,129,0.3);">
                        ✓ True
                    </button>
                    <button onclick="window._qbAnswerSwipe(false)" style="flex: 1; max-width: 140px; padding: 16px; background: linear-gradient(135deg, #ef4444, #dc2626); border: none; border-radius: 14px; color: white; font-weight: 700; font-size: 1.1rem; cursor: pointer; box-shadow: 0 4px 15px rgba(239,68,68,0.3);">
                        ✕ False
                    </button>
                </div>
            </div>
        `;
    }

    function renderBattleFillBlank(game) {
        const shuffledOptions = [...game.options].sort(() => Math.random() - 0.5);
        const sentenceHtml = game.sentence.replace('_______', '<span style="display: inline-block; min-width: 100px; border-bottom: 2px dashed rgba(124,58,237,0.6); margin: 0 4px; padding: 2px 8px; color: #a78bfa;">_______</span>');
        return `
            <div style="padding: 20px 0;">
                <div style="font-size: 0.75rem; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; text-align: center;">Fill in the Blank</div>
                <div style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 24px 20px; margin-bottom: 20px;">
                    <p style="font-size: 1.05rem; color: white; line-height: 1.8; margin: 0;">${sentenceHtml}</p>
                </div>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${shuffledOptions.map(opt => `
                        <button onclick="window._qbAnswerFillBlank('${opt.replace(/'/g, "\\'")}')" style="padding: 14px 18px; background: rgba(255,255,255,0.08); border: 2px solid rgba(255,255,255,0.12); border-radius: 12px; color: white; font-size: 0.95rem; cursor: pointer; text-align: left; transition: all 0.2s;">${opt}</button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    function renderBattleTapAll(game) {
        return `
            <div style="padding: 20px 0;">
                <div style="font-size: 0.75rem; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; text-align: center;">Select All That Apply</div>
                <div style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 20px; margin-bottom: 20px;">
                    <p style="font-size: 1.05rem; color: white; margin: 0;">${game.question}</p>
                </div>
                <div style="display: flex; flex-direction: column; gap: 10px;" id="qb-tap-all-options">
                    ${game.options.map((opt, i) => `
                        <button onclick="window._qbToggleTapAll(this, ${i})" data-idx="${i}" data-selected="false" style="padding: 14px 18px; background: rgba(255,255,255,0.08); border: 2px solid rgba(255,255,255,0.12); border-radius: 12px; color: white; font-size: 0.95rem; cursor: pointer; text-align: left; transition: all 0.2s; display: flex; align-items: center; gap: 10px;">
                            <span style="width: 22px; height: 22px; border: 2px solid rgba(255,255,255,0.3); border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s;" class="qb-checkbox"></span>
                            ${opt.text}
                        </button>
                    `).join('')}
                </div>
                <button onclick="window._qbCheckTapAll()" style="width: 100%; margin-top: 16px; padding: 14px; background: linear-gradient(135deg, #7c3aed, #6366f1); border: none; border-radius: 12px; color: white; font-weight: 700; font-size: 1rem; cursor: pointer;">Check Answer</button>
            </div>
        `;
    }

    function renderBattleMatchPairs(game) {
        const shuffledRight = [...game.pairs].sort(() => Math.random() - 0.5);
        return `
            <div style="padding: 20px 0;">
                <div style="font-size: 0.75rem; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; text-align: center;">Match the Pairs</div>
                <div style="display: flex; gap: 12px;">
                    <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;" id="qb-match-left">
                        ${game.pairs.map((p, i) => `
                            <button onclick="window._qbSelectMatchLeft(${i}, this)" data-idx="${i}" style="padding: 12px 10px; background: rgba(124,58,237,0.15); border: 2px solid rgba(124,58,237,0.3); border-radius: 10px; color: white; font-size: 0.8rem; cursor: pointer; text-align: center; transition: all 0.2s; min-height: 48px;">${p.left}</button>
                        `).join('')}
                    </div>
                    <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;" id="qb-match-right">
                        ${shuffledRight.map((p, i) => `
                            <button onclick="window._qbSelectMatchRight('${p.right.replace(/'/g, "\\'")}', this)" data-right="${p.right}" style="padding: 12px 10px; background: rgba(255,255,255,0.08); border: 2px solid rgba(255,255,255,0.15); border-radius: 10px; color: white; font-size: 0.8rem; cursor: pointer; text-align: center; transition: all 0.2s; min-height: 48px;">${p.right}</button>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    function renderBattleOrderSequence(game) {
        const shuffled = game.items.map((item, i) => ({ text: item, correctIdx: i })).sort(() => Math.random() - 0.5);
        return `
            <div style="padding: 20px 0;">
                <div style="font-size: 0.75rem; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; text-align: center;">Put in Order</div>
                <div style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 16px; margin-bottom: 16px;">
                    <p style="font-size: 0.95rem; color: white; margin: 0;">${game.question}</p>
                </div>
                <div id="qb-order-list" style="display: flex; flex-direction: column; gap: 8px;">
                    ${shuffled.map((item, i) => `
                        <div class="qb-order-item" draggable="true" data-correct="${item.correctIdx}" style="padding: 14px 16px; background: rgba(255,255,255,0.08); border: 2px solid rgba(255,255,255,0.12); border-radius: 12px; color: white; font-size: 0.9rem; cursor: grab; display: flex; align-items: center; gap: 12px; transition: all 0.2s; user-select: none;">
                            <span style="width: 28px; height: 28px; background: rgba(124,58,237,0.3); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8rem; flex-shrink: 0;" class="qb-order-num">${i + 1}</span>
                            ${item.text}
                        </div>
                    `).join('')}
                </div>
                <button onclick="window._qbCheckOrder()" style="width: 100%; margin-top: 16px; padding: 14px; background: linear-gradient(135deg, #7c3aed, #6366f1); border: none; border-radius: 12px; color: white; font-weight: 700; font-size: 1rem; cursor: pointer;">Check Order</button>
            </div>
        `;
    }

    function renderBattleScenario(game) {
        return `
            <div style="padding: 20px 0;">
                <div style="font-size: 0.75rem; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; text-align: center;">Scenario</div>
                <div style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 20px; margin-bottom: 12px;">
                    <p style="font-size: 0.9rem; color: rgba(255,255,255,0.85); line-height: 1.6; margin: 0;">${game.scenario}</p>
                </div>
                <div style="background: rgba(124,58,237,0.1); border: 1px solid rgba(124,58,237,0.2); border-radius: 12px; padding: 14px 16px; margin-bottom: 16px;">
                    <p style="font-size: 1rem; color: white; font-weight: 600; margin: 0;">${game.question}</p>
                </div>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${game.options.map((opt, i) => `
                        <button onclick="window._qbAnswerScenario(${i})" style="padding: 14px 18px; background: rgba(255,255,255,0.08); border: 2px solid rgba(255,255,255,0.12); border-radius: 12px; color: white; font-size: 0.92rem; cursor: pointer; text-align: left; transition: all 0.2s;">${opt.text}</button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // ---- ANSWER HANDLERS ----

    window._qbAnswerSwipe = function(answer) {
        if (!quizBattleState || quizBattleState.currentIndex >= quizBattleState.questions.length) return;
        if (quizBattleState.answered) return;
        const game = quizBattleState.questions[quizBattleState.currentIndex];
        handleQuizBattleAnswer(answer === game.answer);
    };

    window._qbAnswerFillBlank = function(answer) {
        if (!quizBattleState || quizBattleState.currentIndex >= quizBattleState.questions.length) return;
        if (quizBattleState.answered) return;
        const game = quizBattleState.questions[quizBattleState.currentIndex];
        handleQuizBattleAnswer(answer === game.answer);
    };

    window._qbToggleTapAll = function(btn, idx) {
        if (quizBattleState.answered) return;
        const isSelected = btn.dataset.selected === 'true';
        btn.dataset.selected = (!isSelected).toString();
        const checkbox = btn.querySelector('.qb-checkbox');
        if (!isSelected) {
            btn.style.borderColor = 'rgba(124,58,237,0.5)';
            btn.style.background = 'rgba(124,58,237,0.15)';
            if (checkbox) checkbox.innerHTML = '✓';
        } else {
            btn.style.borderColor = 'rgba(255,255,255,0.12)';
            btn.style.background = 'rgba(255,255,255,0.08)';
            if (checkbox) checkbox.innerHTML = '';
        }
    };

    window._qbCheckTapAll = function() {
        if (!quizBattleState || quizBattleState.currentIndex >= quizBattleState.questions.length) return;
        if (quizBattleState.answered) return;
        const game = quizBattleState.questions[quizBattleState.currentIndex];
        const buttons = document.querySelectorAll('#qb-tap-all-options button');
        let correct = true;
        buttons.forEach((btn, i) => {
            const isSelected = btn.dataset.selected === 'true';
            const shouldBeSelected = game.options[i].correct;
            if (isSelected !== shouldBeSelected) correct = false;
        });
        handleQuizBattleAnswer(correct);
    };

    window._qbSelectMatchLeft = function(idx, btn) {
        if (quizBattleState.answered) return;
        // Deselect previous
        document.querySelectorAll('#qb-match-left button').forEach(b => {
            b.style.borderColor = 'rgba(124,58,237,0.3)';
            b.style.background = 'rgba(124,58,237,0.15)';
        });
        btn.style.borderColor = '#7c3aed';
        btn.style.background = 'rgba(124,58,237,0.35)';
        quizBattleState.selectedLeft = idx;
    };

    window._qbSelectMatchRight = function(rightText, btn) {
        if (!quizBattleState || quizBattleState.currentIndex >= quizBattleState.questions.length) return;
        if (quizBattleState.answered) return;
        if (quizBattleState.selectedLeft === null) return;

        const game = quizBattleState.questions[quizBattleState.currentIndex];
        const leftIdx = quizBattleState.selectedLeft;
        const correctRight = game.pairs[leftIdx].right;

        if (rightText === correctRight) {
            // Correct match
            quizBattleState.matchedPairs.push(leftIdx);
            const leftBtns = document.querySelectorAll('#qb-match-left button');
            const rightBtns = document.querySelectorAll('#qb-match-right button');
            if (leftBtns[leftIdx]) {
                leftBtns[leftIdx].style.background = 'rgba(16,185,129,0.3)';
                leftBtns[leftIdx].style.borderColor = '#10b981';
                leftBtns[leftIdx].style.pointerEvents = 'none';
            }
            btn.style.background = 'rgba(16,185,129,0.3)';
            btn.style.borderColor = '#10b981';
            btn.style.pointerEvents = 'none';

            quizBattleState.selectedLeft = null;

            // Check if all matched
            if (quizBattleState.matchedPairs.length === game.pairs.length) {
                handleQuizBattleAnswer(true);
            }
        } else {
            // Wrong match - flash red briefly
            btn.style.background = 'rgba(239,68,68,0.3)';
            btn.style.borderColor = '#ef4444';
            setTimeout(() => {
                btn.style.background = 'rgba(255,255,255,0.08)';
                btn.style.borderColor = 'rgba(255,255,255,0.15)';
            }, 500);
            quizBattleState.selectedLeft = null;
            document.querySelectorAll('#qb-match-left button').forEach(b => {
                if (!quizBattleState.matchedPairs.includes(parseInt(b.dataset.idx))) {
                    b.style.borderColor = 'rgba(124,58,237,0.3)';
                    b.style.background = 'rgba(124,58,237,0.15)';
                }
            });
        }
    };

    function initBattleOrderDragDrop() {
        const list = document.getElementById('qb-order-list');
        if (!list) return;

        let dragItem = null;
        let dragOverItem = null;

        list.querySelectorAll('.qb-order-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                dragItem = item;
                item.style.opacity = '0.5';
            });
            item.addEventListener('dragend', () => {
                item.style.opacity = '1';
                dragItem = null;
                updateOrderNumbers();
            });
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                dragOverItem = item;
            });
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                if (dragItem && dragItem !== item) {
                    const items = [...list.querySelectorAll('.qb-order-item')];
                    const dragIdx = items.indexOf(dragItem);
                    const dropIdx = items.indexOf(item);
                    if (dragIdx < dropIdx) {
                        list.insertBefore(dragItem, item.nextSibling);
                    } else {
                        list.insertBefore(dragItem, item);
                    }
                    updateOrderNumbers();
                }
            });

            // Touch support
            let touchStartY = 0;
            item.addEventListener('touchstart', (e) => {
                dragItem = item;
                touchStartY = e.touches[0].clientY;
                item.style.opacity = '0.7';
                item.style.zIndex = '100';
            }, { passive: true });

            item.addEventListener('touchmove', (e) => {
                if (!dragItem) return;
                e.preventDefault();
                const touch = e.touches[0];
                const items = [...list.querySelectorAll('.qb-order-item')];
                for (const other of items) {
                    if (other === dragItem) continue;
                    const rect = other.getBoundingClientRect();
                    if (touch.clientY > rect.top && touch.clientY < rect.bottom) {
                        const dragIdx = items.indexOf(dragItem);
                        const otherIdx = items.indexOf(other);
                        if (dragIdx < otherIdx) {
                            list.insertBefore(dragItem, other.nextSibling);
                        } else {
                            list.insertBefore(dragItem, other);
                        }
                        updateOrderNumbers();
                        break;
                    }
                }
            }, { passive: false });

            item.addEventListener('touchend', () => {
                if (dragItem) {
                    dragItem.style.opacity = '1';
                    dragItem.style.zIndex = '';
                    dragItem = null;
                }
            });
        });

        function updateOrderNumbers() {
            list.querySelectorAll('.qb-order-item').forEach((item, i) => {
                const num = item.querySelector('.qb-order-num');
                if (num) num.textContent = i + 1;
            });
        }
    }

    window._qbCheckOrder = function() {
        if (quizBattleState.answered) return;
        const list = document.getElementById('qb-order-list');
        if (!list) return;
        const items = [...list.querySelectorAll('.qb-order-item')];
        let correct = true;
        items.forEach((item, i) => {
            if (parseInt(item.dataset.correct) !== i) correct = false;
        });
        handleQuizBattleAnswer(correct);
    };

    window._qbAnswerScenario = function(idx) {
        if (!quizBattleState || quizBattleState.currentIndex >= quizBattleState.questions.length) return;
        if (quizBattleState.answered) return;
        const game = quizBattleState.questions[quizBattleState.currentIndex];
        handleQuizBattleAnswer(game.options[idx].correct);
    };

    // ---- HANDLE ANSWER + ADVANCE ----

    function handleQuizBattleAnswer(isCorrect) {
        if (quizBattleState.answered) return;
        quizBattleState.answered = true;

        // Stop timer
        if (quizBattleState.timerInterval) {
            clearInterval(quizBattleState.timerInterval);
            quizBattleState.timerInterval = null;
        }

        // Record time
        const elapsed = Date.now() - quizBattleState.questionStartTime;
        quizBattleState.totalTimeMs += elapsed;

        if (isCorrect) {
            quizBattleState.score++;
        }

        // Broadcast score update
        if (quizBattleState.channel) {
            quizBattleState.channel.send({
                type: 'broadcast',
                event: 'score_update',
                payload: { score: quizBattleState.score }
            });
        }

        // Flash feedback
        const container = document.getElementById('learning-content');
        if (container) {
            const feedbackDiv = document.createElement('div');
            feedbackDiv.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 3rem; z-index: 100; pointer-events: none; animation: qbFeedbackPop 0.6s ease-out forwards;';
            feedbackDiv.textContent = isCorrect ? '✓' : '✗';
            feedbackDiv.style.color = isCorrect ? '#10b981' : '#ef4444';
            document.body.appendChild(feedbackDiv);
            setTimeout(() => feedbackDiv.remove(), 700);
        }

        // Advance after brief delay
        quizBattleState.currentIndex++;
        setTimeout(() => {
            renderQuizBattleQuestion();
        }, 800);
    }

    function updateQuizBattleScoreboard() {
        const oppEl = document.getElementById('qb-opp-score');
        if (oppEl) {
            oppEl.textContent = quizBattleState.opponentName.split(' ')[0] + ': ' + quizBattleState.opponentScore;
        }
    }

    // ---- FINISH QUIZ BATTLE ----

    async function finishQuizBattle() {
        // Broadcast finished
        if (quizBattleState.channel) {
            quizBattleState.channel.send({
                type: 'broadcast',
                event: 'battle_finished',
                payload: {
                    score: quizBattleState.score,
                    timeMs: quizBattleState.totalTimeMs
                }
            });
        }

        // Submit result to DB
        let result = null;
        try {
            if (window.supabaseClient && window.currentUser) {
                const { data, error } = await window.supabaseClient
                    .rpc('submit_quiz_battle_result', {
                        p_battle_id: quizBattleState.battleId,
                        p_user_id: window.currentUser.id,
                        p_score: quizBattleState.score,
                        p_time_ms: quizBattleState.totalTimeMs
                    });
                if (!error) result = data;
            }
        } catch (e) {
            console.warn('Could not submit quiz battle result:', e);
        }

        if (result && result.finished) {
            showQuizBattleResults(result);
        } else if (quizBattleState.opponentFinished) {
            // Both done now via realtime
            showQuizBattleResults(result);
        } else {
            showQuizBattleWaiting();
        }
    }

    function showQuizBattleWaiting() {
        const container = document.getElementById('learning-content');
        if (!container) return;

        container.innerHTML = `
            <div style="min-height: 80vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); padding: 30px; text-align: center;">
                <div style="font-size: 3rem; margin-bottom: 20px;">⏳</div>
                <div style="font-size: 1.2rem; font-weight: 700; color: white; margin-bottom: 8px;">You scored ${quizBattleState.score}/${QUIZ_BATTLE_QUESTIONS}!</div>
                <div style="font-size: 0.9rem; color: rgba(255,255,255,0.6); margin-bottom: 30px;">Waiting for ${quizBattleState.opponentName} to finish...</div>
                <div class="learning-spinner"></div>
            </div>
        `;

        // Poll for completion or wait for realtime
        if (quizBattleState.pollInterval) clearInterval(quizBattleState.pollInterval);
        quizBattleState.pollInterval = setInterval(async () => {
            if (quizBattleState.opponentFinished) {
                clearInterval(quizBattleState.pollInterval);
                quizBattleState.pollInterval = null;
                // Re-fetch result
                try {
                    if (window.supabaseClient) {
                        const { data } = await window.supabaseClient
                            .from('quiz_battles')
                            .select('*')
                            .eq('id', quizBattleState.battleId)
                            .single();
                        if (data && data.status === 'completed') {
                            showQuizBattleResults({
                                finished: true,
                                winner_id: data.winner_id,
                                challenger_score: data.challenger_score,
                                opponent_score: data.opponent_score,
                                challenger_time_ms: data.challenger_time_ms,
                                opponent_time_ms: data.opponent_time_ms,
                                coin_bet: data.coin_bet
                            });
                        }
                    }
                } catch (e) {}
                return;
            }

            // Also poll DB as fallback
            try {
                if (window.supabaseClient) {
                    const { data } = await window.supabaseClient
                        .from('quiz_battles')
                        .select('status, winner_id, challenger_score, opponent_score, challenger_time_ms, opponent_time_ms, coin_bet')
                        .eq('id', quizBattleState.battleId)
                        .single();
                    if (data && data.status === 'completed') {
                        clearInterval(quizBattleState.pollInterval);
                        quizBattleState.pollInterval = null;
                        showQuizBattleResults({
                            finished: true,
                            winner_id: data.winner_id,
                            challenger_score: data.challenger_score,
                            opponent_score: data.opponent_score,
                            challenger_time_ms: data.challenger_time_ms,
                            opponent_time_ms: data.opponent_time_ms,
                            coin_bet: data.coin_bet
                        });
                    }
                }
            } catch (e) {}
        }, 3000);

        // Auto-timeout after 5 minutes
        setTimeout(() => {
            if (quizBattleState.pollInterval) {
                clearInterval(quizBattleState.pollInterval);
                quizBattleState.pollInterval = null;
            }
        }, 300000);
    }

    // ---- RESULTS SCREEN ----

    function showQuizBattleResults(result) {
        // Clean up realtime channel
        if (quizBattleState.channel) {
            quizBattleState.channel.unsubscribe();
            quizBattleState.channel = null;
        }

        const container = document.getElementById('learning-content');
        if (!container) return;

        const myScore = quizBattleState.score;
        const oppScore = quizBattleState.opponentScore;
        const iWon = result && result.winner_id && result.winner_id === window.currentUser?.id;
        const isDraw = myScore === oppScore;
        const coinBet = quizBattleState.coinBet;
        const winnings = coinBet * 2;

        const playerName = window.currentUser?.user_metadata?.name || window.currentUser?.email?.split('@')[0] || 'You';

        // Reload coin balance
        if (typeof loadCoinBalance === 'function') loadCoinBalance();

        let resultEmoji, resultText, resultColor;
        if (iWon) {
            resultEmoji = '🏆';
            resultText = 'You Win!';
            resultColor = '#10b981';
        } else if (isDraw) {
            resultEmoji = '🤝';
            resultText = 'Draw!';
            resultColor = '#fbbf24';
        } else {
            resultEmoji = '😤';
            resultText = 'You Lost!';
            resultColor = '#ef4444';
        }

        const myTimeStr = (quizBattleState.totalTimeMs / 1000).toFixed(1) + 's';
        const oppTimeMs = result ? (quizBattleState.isChallenger ? result.opponent_time_ms : result.challenger_time_ms) : 0;
        const oppTimeStr = oppTimeMs ? (oppTimeMs / 1000).toFixed(1) + 's' : '—';

        container.innerHTML = `
            <div style="min-height: 80vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); padding: 30px; text-align: center;">
                <div style="font-size: 4rem; margin-bottom: 16px;">${resultEmoji}</div>
                <div style="font-size: 1.8rem; font-weight: 800; color: ${resultColor}; margin-bottom: 24px; text-shadow: 0 0 20px ${resultColor}40;">${resultText}</div>

                <!-- Score Cards -->
                <div style="display: flex; gap: 16px; margin-bottom: 24px; width: 100%; max-width: 320px;">
                    <div style="flex: 1; background: ${iWon ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)'}; border: 2px solid ${iWon ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}; border-radius: 16px; padding: 16px;">
                        <div style="font-size: 0.75rem; color: rgba(255,255,255,0.5); margin-bottom: 6px;">${playerName}</div>
                        <div style="font-size: 2rem; font-weight: 800; color: white;">${myScore}</div>
                        <div style="font-size: 0.7rem; color: rgba(255,255,255,0.4);">${myTimeStr}</div>
                    </div>
                    <div style="flex: 1; background: ${!iWon && !isDraw ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)'}; border: 2px solid ${!iWon && !isDraw ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}; border-radius: 16px; padding: 16px;">
                        <div style="font-size: 0.75rem; color: rgba(255,255,255,0.5); margin-bottom: 6px;">${quizBattleState.opponentName}</div>
                        <div style="font-size: 2rem; font-weight: 800; color: white;">${oppScore}</div>
                        <div style="font-size: 0.7rem; color: rgba(255,255,255,0.4);">${oppTimeStr}</div>
                    </div>
                </div>

                <!-- Coin Result -->
                ${coinBet > 0 ? `
                    <div style="background: ${iWon ? 'rgba(251,191,36,0.15)' : 'rgba(239,68,68,0.1)'}; border: 1px solid ${iWon ? 'rgba(251,191,36,0.3)' : 'rgba(239,68,68,0.2)'}; border-radius: 12px; padding: 12px 20px; margin-bottom: 24px;">
                        <span style="font-size: 1rem; color: ${iWon ? '#fbbf24' : '#ef4444'}; font-weight: 700;">
                            ${iWon ? '🪙 +' + winnings + ' coins won!' : '🪙 -' + coinBet + ' coins lost'}
                        </span>
                    </div>
                ` : ''}

                <div style="font-size: 0.8rem; color: rgba(255,255,255,0.4); margin-bottom: 24px;">
                    ${myScore}/${QUIZ_BATTLE_QUESTIONS} correct · ${myTimeStr} total
                </div>

                <!-- Actions -->
                <div style="display: flex; flex-direction: column; gap: 10px; width: 100%; max-width: 280px;">
                    <button onclick="window.showQuizBattleInviteModal()" style="padding: 14px; background: linear-gradient(135deg, #7c3aed, #6366f1); border: none; border-radius: 12px; color: white; font-weight: 700; font-size: 1rem; cursor: pointer;">Play Again</button>
                    <button onclick="window.renderLearningHome()" style="padding: 14px; background: rgba(255,255,255,0.08); border: 2px solid rgba(255,255,255,0.15); border-radius: 12px; color: white; font-weight: 600; font-size: 0.95rem; cursor: pointer;">Back to Learning</button>
                </div>
            </div>
        `;

        // Show toast
        if (typeof showToast === 'function') {
            if (iWon && coinBet > 0) {
                showToast('Quiz Battle Won! +🪙 ' + winnings + ' coins!', 'success');
            } else if (iWon) {
                showToast('Quiz Battle Won!', 'success');
            } else {
                showToast('Better luck next time!', 'info');
            }
        }
    }

    // Inject CSS animation for feedback pop
    const qbStyle = document.createElement('style');
    qbStyle.textContent = `
        @keyframes qbFeedbackPop {
            0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
            30% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
            100% { opacity: 0; transform: translate(-50%, -70%) scale(1); }
        }
    `;
    document.head.appendChild(qbStyle);

    // =============================================================================
    // LEARNING MASCOT SYSTEM
    // =============================================================================

    window.LearningMascot = {
        messages: {
            greeting: ["Let's learn! 🌱", "Ready to grow?", "Time to level up! 💪"],
            correct: ["Nice one! 🎉", "You got it!", "Brilliant! ⭐", "Keep going!", "Awesome! 💪"],
            incorrect: ["Almost there!", "Try again!", "You'll get it! 💪", "Keep learning!"],
            streak: ["On fire! 🔥", "Unstoppable!", "You're crushing it!", "Amazing streak! 💪"],
            encouragement: ["You've got this!", "Keep it up! 🌟", "Great progress!", "Learning is power!"],
            tips: ["Protein builds muscle!", "Sleep = recovery 💤", "Hydration matters!", "Consistency wins! 🏆"]
        },

        show() {
            const mascot = document.getElementById('learnMascot');
            if (mascot) {
                mascot.classList.add('visible');
                setTimeout(() => this.showMessage(this.getRandomMessage('greeting')), 500);
            }
        },

        hide() {
            const mascot = document.getElementById('learnMascot');
            if (mascot) mascot.classList.remove('visible');
        },

        getRandomMessage(category) {
            const msgs = this.messages[category];
            return msgs[Math.floor(Math.random() * msgs.length)];
        },

        showMessage(message, duration = 3000) {
            const speech = document.getElementById('learnMascotSpeech');
            if (!speech) return;
            speech.textContent = message;
            speech.classList.add('visible');
            setTimeout(() => speech.classList.remove('visible'), duration);
        },

        react(type) {
            const avatar = document.getElementById('learnMascotAvatar');
            if (!avatar) return;
            avatar.classList.remove('happy', 'sad', 'excited', 'thinking');
            void avatar.offsetWidth;
            avatar.classList.add(type);
            setTimeout(() => avatar.classList.remove(type), type === 'excited' ? 2000 : 600);
        },

        onCorrect(streak) {
            this.react('happy');
            if (streak >= 3 && streak % 3 === 0) {
                this.react('excited');
                this.showMessage(this.getRandomMessage('streak'));
            } else if (Math.random() > 0.6) {
                this.showMessage(this.getRandomMessage('correct'));
            }
        },

        onIncorrect() {
            this.react('sad');
            if (Math.random() > 0.5) {
                this.showMessage(this.getRandomMessage('incorrect'));
            }
        },

        tapped() {
            this.react('happy');
            const msgType = Math.random() > 0.5 ? 'tips' : 'encouragement';
            this.showMessage(this.getRandomMessage(msgType));
        }
    };

})();
