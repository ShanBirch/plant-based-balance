/**
 * Learning System - Inline Version
 * Duolingo-style fitness education with games and XP rewards
 * This version works without ES modules for compatibility with existing app architecture
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
        'mind-1': { id: 'mind-1', moduleId: 'mind', title: 'The Prediction Machine', description: 'Your brain constructs reality', order: 1 },
        'mind-2': { id: 'mind-2', moduleId: 'mind', title: 'Body Budgeting', description: 'Allostasis and energy management', order: 2 },
        'mind-3': { id: 'mind-3', moduleId: 'mind', title: 'Experience Shapes Reality', description: 'Your past creates your present', order: 3 },
        'mind-4': { id: 'mind-4', moduleId: 'mind', title: 'Training the Predictive Brain', description: 'Why consistency transforms', order: 4 },
        'mind-5': { id: 'mind-5', moduleId: 'mind', title: 'Becoming Your Future Self', description: 'Identity and lasting change', order: 5 },
        'longevity-1': { id: 'longevity-1', moduleId: 'longevity', title: 'The Science of Aging', description: 'Why we age and what we can do about it', order: 1 },
        'longevity-2': { id: 'longevity-2', moduleId: 'longevity', title: 'Metabolic Health', description: 'Blood sugar, insulin, and disease risk', order: 2 },
        'longevity-3': { id: 'longevity-3', moduleId: 'longevity', title: 'Chronic Disease Prevention', description: 'The big killers and how to avoid them', order: 3 },
        'longevity-4': { id: 'longevity-4', moduleId: 'longevity', title: 'Cellular Health & Repair', description: 'Autophagy, mitochondria, and regeneration', order: 4 },
        'longevity-5': { id: 'longevity-5', moduleId: 'longevity', title: 'Lifestyle Medicine', description: 'Sleep, stress, and the pillars of longevity', order: 5 },
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How does perception actually work?", items: [
                        "Light hits your eyes",
                        "Compressed signals travel to brain",
                        "Brain generates predictions",
                        "Brain compares predictions to signals",
                        "You experience the prediction as reality",
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Put these in the order they actually happen:", items: ["Brain generates prediction", "Sensory signals arrive", "Brain compares prediction to signals", "Only differences reach consciousness"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How does learning actually happen?", items: ["You experience something new", "Reality doesn't match prediction", "Prediction error is generated", "Brain updates its model", "Future predictions improve"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How does past experience shape present perception?", items: ["You encounter a situation", "Brain searches for similar past experiences", "Predictions are generated from history", "Your experience is constructed", "You perceive the present through your past"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How does a strong belief actually change?", items: ["New experience contradicts old belief", "Small prediction error occurs", "Repeated experiences accumulate", "Prior belief gradually weakens", "New belief becomes stronger"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How does allostasis work?", items: ["Brain predicts upcoming demand", "Body begins preparing in advance", "Resources are mobilized", "Activity begins", "Body is already ready"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order body budget management for sustainable fitness:", items: ["Ensure adequate sleep", "Eat nutritious meals", "Manage stress levels", "Exercise with available energy", "Rest and recover"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How does a feeling like hunger arise?", items: ["Brain checks time and context", "Brain references past patterns", "Brain generates a prediction", "You experience hunger", "Behavior changes (seek food)"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How does the fatigue prediction work?", items: ["Brain monitors context and activity", "Brain predicts upcoming demands", "Fatigue feeling is generated early", "You slow down before depletion", "Actual reserves are protected"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How does chronic stress become a loop?", items: ["Brain predicts threat", "Stress response activates", "You feel stressed", "Brain interprets stress as confirmation", "Future threat predictions strengthen"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How does a concept get constructed?", items: ["You have experiences related to the concept", "Your brain links sensations, emotions, contexts", "A prediction pattern forms", "Hearing the word triggers the pattern", "You experience the concept your brain built"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How does an emotion get constructed?", items: ["Body sensations arise", "Brain reads the context", "Brain references past experiences", "Brain constructs an emotion category", "You experience the emotion"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How does failure prediction get updated?", items: ["Recognize feeling as prediction, not truth", "Start with small, achievable actions", "Accumulate successful experiences", "Brain receives new data", "Prediction gradually shifts"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How does context shape experience?", items: ["You enter a situation", "Brain reads environmental context", "Context influences predictions", "Predictions shape experience", "Same action, different feeling"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How do predictions get reshaped?", items: ["Have a positive experience with activity", "Brain registers new data point", "Repeat consistently over time", "Old predictions weaken", "New predictions strengthen"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How does a behavior become a habit?", items: ["Conscious decision to act", "Repeated execution builds prediction", "Prediction strengthens over time", "Less conscious effort needed", "Behavior runs automatically"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How does consistency build habits?", items: ["Show up regularly (even briefly)", "Each repetition is a data point", "Brain learns 'this happens often'", "Prediction strengthens", "Behavior becomes automatic"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Why does 'too small to fail' work?", items: ["Make the action tiny", "Success is guaranteed", "'Exercise happened' registers", "Prediction strengthens", "Habit builds reliably"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How does environment design work?", items: ["Identify the behavior you want", "Find cues that trigger that prediction", "Make those cues visible", "Remove competing cues", "Predictions trigger automatically"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "What happens when you miss a day?", items: ["Day is missed", "Brain receives 'didn't happen' data", "Prediction weakens slightly", "If you resume quickly, damage is minimal", "Streak continues building"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How do identity predictions form and change?", items: ["Past experiences accumulate", "Brain creates identity prediction", "Prediction feels like fact", "New consistent experiences occur", "Prediction gradually updates"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How does identity actually change?", items: ["Take action (even if you don't feel like it)", "Action provides evidence", "Evidence accumulates", "Brain updates identity prediction", "You start to feel like that person"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How do small acts compound into identity?", items: ["Perform a small action", "Action registers as evidence", "Repeat the action consistently", "Evidence accumulates", "Pattern becomes identity"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How do today's choices affect future self?", items: ["You make a choice today", "Choice shapes your actions", "Actions become habits/evidence", "Habits shape who you become", "Future self is constructed"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Bringing it all together:", items: ["Brain predicts based on past", "Feelings and identity are predictions", "Predictions update with new evidence", "Consistent actions provide evidence", "You construct your future self"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "You're not changing who you are—you're building who you'll become.", answer: true, explanation: "This reframe is key. You're not fighting your nature. You're providing evidence for a new prediction." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "You are literally the _______ of your future brain's predictions.", options: ['architect', 'victim', 'observer', 'prisoner'], answer: 'architect' },
                ]
            },
        ],
        'body-1': [
            {
                id: 'body-1-1', unitId: 'body-1', order: 1, title: "What Muscles Actually Do",
                content: {
                    intro: `Muscles do one thing: they contract. They pull, never push.\n\nWhen you "push" a door, your muscles are actually pulling your bones to create that pushing motion. Every movement you make—walking, lifting, even breathing—happens because muscles shorten and pull on bones.\n\nThis simple fact explains why muscles come in opposing pairs.`,
                    keyPoint: "Muscles can only pull by contracting. Every movement requires muscles pulling on bones.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Muscles can both push and pull.", answer: false, explanation: "Muscles can only contract (pull). Pushing movements happen because muscles pull bones in ways that create pushing motion." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Muscles create movement by _______ and pulling on bones.", options: ['contracting', 'expanding', 'relaxing', 'stretching'], answer: 'contracting' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "When you do a push-up, your muscles are pushing your body up.", answer: false, explanation: "Your muscles are actually pulling on your bones to create the pushing motion against the floor." },
                    { type: GAME_TYPES.TAP_ALL, question: "Which actions involve muscles contracting?", options: [{ text: "Walking", correct: true }, { text: "Breathing", correct: true }, { text: "Lifting weights", correct: true }, { text: "Sleeping", correct: false }, { text: "Blinking", correct: true }] },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Muscles attach to bones via _______.", options: ['tendons', 'ligaments', 'cartilage', 'skin'], answer: 'tendons' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "You're opening a heavy door by pushing it.", question: "What are your muscles actually doing?", options: [{ text: "Pushing the door directly", correct: false }, { text: "Pulling on bones to create a pushing motion", correct: true }, { text: "Relaxing to let momentum take over", correct: false }], explanation: "Even when 'pushing', your muscles are contracting and pulling on your bones. The bones then push against the door." },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Your heart is also a muscle that contracts.", answer: true, explanation: "Your heart is cardiac muscle that contracts rhythmically to pump blood throughout your body." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order how a muscle creates movement:", items: ["Brain sends signal through nerves", "Muscle fibers receive signal", "Muscle contracts (shortens)", "Muscle pulls on tendon", "Tendon pulls on bone", "Joint moves"], correctOrder: [0, 1, 2, 3, 4, 5] },
                ]
            },
            {
                id: 'body-1-2', unitId: 'body-1', order: 2, title: "Opposing Pairs",
                content: {
                    intro: `Since muscles can only pull, you need opposing pairs to move joints both ways.\n\nYour biceps bends your elbow. Your triceps straightens it. Your quadriceps straightens your knee. Your hamstrings bend it.\n\nWhen one muscle contracts, its opposing muscle must relax. This coordinated dance happens automatically thousands of times per day.`,
                    keyPoint: "Muscles work in opposing pairs—when one contracts, the other relaxes—to move joints in both directions.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "When your biceps contracts, your triceps must _______.", options: ['relax', 'contract', 'stretch', 'grow'], answer: 'relax' },
                    { type: GAME_TYPES.TAP_ALL, question: "Which are opposing muscle pairs?", options: [{ text: "Biceps & Triceps", correct: true }, { text: "Quadriceps & Hamstrings", correct: true }, { text: "Biceps & Hamstrings", correct: false }, { text: "Chest & Back", correct: true }, { text: "Chest & Biceps", correct: false }] },
                    { type: GAME_TYPES.MATCH_PAIRS, pairs: [{ left: "Biceps", right: "Triceps" }, { left: "Quadriceps", right: "Hamstrings" }, { left: "Chest", right: "Back" }, { left: "Hip flexors", right: "Glutes" }] },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Both muscles in an opposing pair can contract at full force simultaneously.", answer: false, explanation: "When one muscle contracts, its opposite must relax. Simultaneous full contraction would lock the joint." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "The quadriceps straighten the knee while the _______ bend it.", options: ['hamstrings', 'calves', 'glutes', 'hip flexors'], answer: 'hamstrings' },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "You're doing a bicep curl, lifting a dumbbell up.", question: "What happens to your triceps?", options: [{ text: "It contracts along with the biceps", correct: false }, { text: "It relaxes to allow the biceps to work", correct: true }, { text: "It pushes the weight up", correct: false }], explanation: "For your biceps to contract and bend your elbow, the triceps must relax to allow that movement." },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Your nervous system automatically coordinates opposing muscle pairs.", answer: true, explanation: "This coordination happens automatically through reciprocal inhibition—your nervous system handles it without conscious thought." },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order what happens when bending your elbow:", items: ["Brain signals biceps to contract", "Nervous system inhibits triceps", "Triceps relaxes", "Biceps shortens and pulls", "Elbow bends"], correctOrder: [0, 1, 2, 3, 4] },
                ]
            },
            {
                id: 'body-1-3', unitId: 'body-1', order: 3, title: "Muscle Fiber Types",
                content: {
                    intro: `Not all muscle fibers are the same. You have two main types:\n\nSlow-twitch (Type I): Efficient, fatigue-resistant, used for endurance. Great for walking, jogging, daily activities.\n\nFast-twitch (Type II): Powerful, tire quickly, used for explosive movements. Great for sprinting, jumping, heavy lifting.\n\nEveryone has both, but ratios vary genetically.`,
                    keyPoint: "Slow-twitch fibers handle endurance; fast-twitch handle power. Training can shift some fibers toward one type.",
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
                    intro: `Muscle growth happens when you challenge muscles beyond their current capacity.\n\nTraining creates microscopic damage to muscle fibers. During recovery, your body repairs these fibers and adds a bit extra—making them slightly bigger and stronger.\n\nThis is why progressive overload matters: you need to keep challenging muscles to keep them adapting.`,
                    keyPoint: "Muscles grow through damage and repair. Challenge creates damage; rest allows repair and growth.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Muscles grow during the workout itself.", answer: false, explanation: "Workouts create the stimulus (damage). Muscles actually grow during recovery when the body repairs and reinforces fibers." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Muscle growth requires both challenge and _______.", options: ['recovery', 'soreness', 'supplements', 'cardio'], answer: 'recovery' },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order the muscle growth process:", items: ["Training challenges muscles", "Microscopic damage occurs", "Body begins repair process", "Protein helps rebuild fibers", "Muscle grows back stronger"], correctOrder: [0, 1, 2, 3, 4] },
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
                    intro: `Your body is efficient—it won't maintain muscle it doesn't need.\n\nWithout regular challenge, muscles atrophy (shrink). This happens faster than you might think—just two weeks of inactivity can begin measurable muscle loss.\n\nThe good news? Muscle memory is real. Previously trained muscles rebuild faster than untrained ones, even after long breaks.`,
                    keyPoint: "Muscles need regular use to be maintained. But muscle memory helps you rebuild faster after breaks.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Once you build muscle, your body maintains it forever automatically.", answer: false, explanation: "Your body only maintains muscle that's being used. Without regular challenge, muscles atrophy." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "_______ memory helps previously trained muscles rebuild faster.", options: ['Muscle', 'Brain', 'Cell', 'Bone'], answer: 'Muscle' },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Muscle loss from inactivity is called _______.", options: ['atrophy', 'hypertrophy', 'dystrophy', 'entropy'], answer: 'atrophy' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Muscle memory means you'll rebuild muscle faster after a break than building it the first time.", answer: true, explanation: "Previously trained muscles retain cellular changes that make rebuilding faster, even after long breaks." },
                    { type: GAME_TYPES.SCENARIO_STORY, scenario: "You trained consistently for 5 years, then took a 1-year break due to injury.", question: "What should you expect when returning?", options: [{ text: "Starting completely from scratch", correct: false }, { text: "Faster progress than a complete beginner", correct: true }, { text: "Never being able to reach your previous level", correct: false }], explanation: "Muscle memory means your body retained adaptations. You'll rebuild faster than someone who never trained." },
                    { type: GAME_TYPES.TAP_ALL, question: "What happens during muscle atrophy?", options: [{ text: "Muscle fibers shrink", correct: true }, { text: "Strength decreases", correct: true }, { text: "Muscle gains extra nuclei", correct: false }, { text: "Body conserves energy", correct: true }, { text: "Muscles grow larger", correct: false }] },
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order what happens when you stop training:", items: ["Training stops", "Body senses muscles aren't needed", "Muscle fibers begin to shrink", "Strength decreases", "Body conserves resources"], correctOrder: [0, 1, 2, 3, 4] },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Two weeks of inactivity can begin measurable muscle loss.", answer: true, explanation: "Studies show detectable muscle loss can begin within just two weeks of complete inactivity." },
                ]
            },
        ],
        'body-2': [
            {
                id: 'body-2-1', unitId: 'body-2', order: 1, title: "What Is 'The Core'?",
                content: {
                    intro: `Your "core" isn't just your abs. It's a cylinder of muscles wrapping around your entire midsection.\n\nFront: Rectus abdominis (the "six-pack") and transverse abdominis (deep stabilizer)\nSides: Internal and external obliques\nBack: Erector spinae and multifidus\nBottom: Pelvic floor\n\nThese muscles work together to stabilize your spine and transfer force.`,
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order the core muscles from front to back:", items: ["Rectus abdominis (front)", "Transverse abdominis (deep front)", "Obliques (sides)", "Erector spinae (back)"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "The pelvic floor is part of your core.", answer: true, explanation: "The pelvic floor forms the bottom of the core cylinder and is essential for stability." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Core muscles work together to stabilize your _______ and transfer force.", options: ['spine', 'arms', 'head', 'feet'], answer: 'spine' },
                ]
            },
            {
                id: 'body-2-2', unitId: 'body-2', order: 2, title: "Core as Force Transfer",
                content: {
                    intro: `Your core's main job isn't creating movement—it's transferring force between your upper and lower body.\n\nWhen you throw a ball, push something heavy, or even walk, force must transfer through your core. A weak core means energy leaks out, like trying to shoot a cannon from a canoe.\n\nEvery powerful movement depends on core stability.`,
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How does force transfer when throwing?", items: ["Legs generate force", "Force travels up through hips", "Core stabilizes and transfers", "Upper body accelerates", "Arm releases the throw"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Your core's main job is creating movement.", answer: false, explanation: "The core's main job is transferring force and stabilizing—not creating movement itself." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Every powerful movement depends on core _______.", options: ['stability', 'flexibility', 'size', 'visibility'], answer: 'stability' },
                ]
            },
            {
                id: 'body-2-3', unitId: 'body-2', order: 3, title: "Bracing vs. Sucking In",
                content: {
                    intro: `Many people "engage their core" by sucking in their stomach. This is wrong.\n\nProper core engagement is bracing—creating tension in all directions like you're about to be punched in the gut. This creates a stable cylinder.\n\nSucking in only engages superficial muscles and actually destabilizes your spine. Brace, don't suck.`,
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How to properly brace your core:", items: ["Take a breath into your belly", "Create tension in all directions", "Imagine bracing for impact", "Maintain the stable cylinder", "Perform the movement"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Sucking in your stomach creates a stable cylinder.", answer: false, explanation: "Sucking in creates instability. Bracing with 360-degree tension creates the stable cylinder." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Brace, don't _______.", options: ['suck', 'push', 'pull', 'flex'], answer: 'suck' },
                ]
            },
            {
                id: 'body-2-4', unitId: 'body-2', order: 4, title: "The Deep Stabilizers",
                content: {
                    intro: `The most important core muscle is one you can't see: the transverse abdominis.\n\nThis deep muscle wraps around your midsection like a corset. When it contracts, it increases abdominal pressure and stabilizes your spine from the inside.\n\nThis muscle activates before any limb movement in healthy backs—it prepares your spine for action.`,
                    keyPoint: "The transverse abdominis is a deep stabilizer that protects your spine. It should activate before any movement.",
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How does the TVA protect your spine?", items: ["Brain plans a movement", "TVA activates first", "Abdominal pressure increases", "Spine is stabilized", "Limb movement begins"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "The transverse abdominis creates visible abs.", answer: false, explanation: "The TVA is deep and invisible. The rectus abdominis creates the visible six-pack." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "The TVA activates _______ any limb movement to protect the spine.", options: ['before', 'after', 'during', 'instead of'], answer: 'before' },
                ]
            },
            {
                id: 'body-2-5', unitId: 'body-2', order: 5, title: "Core in Daily Life",
                content: {
                    intro: `You don't need to do a single crunch to train your core—it's working all day.\n\nEvery time you stand, walk, or lift something, your core stabilizes your spine. Standing on one leg? Core. Carrying groceries? Core. Even sitting upright uses core muscles.\n\nAwareness of core engagement during daily activities builds functional strength that transfers to everything.`,
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Building core strength through daily life:", items: ["Notice when core should engage", "Practice proper bracing", "Apply to daily movements", "Strength builds automatically", "Transfers to all activities"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Standing on one leg requires core engagement.", answer: true, explanation: "Balancing on one leg requires significant core activation to stabilize the spine and pelvis." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "You don't need a single _______ to train your core.", options: ['crunch', 'muscle', 'bone', 'breath'], answer: 'crunch' },
                ]
            },
        ],
        'body-3': [
            {
                id: 'body-3-1', unitId: 'body-3', order: 1, title: "What Is the Kinetic Chain?",
                content: {
                    intro: `Your body doesn't move in isolated parts—it moves as a connected chain.\n\nThe kinetic chain describes how bones, joints, muscles, and nerves work together to produce movement. When you walk, your foot, ankle, knee, hip, and spine all coordinate in a chain of linked segments.\n\nStrength or weakness anywhere in the chain affects everywhere else.`,
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order the kinetic chain from ground up:", items: ["Foot", "Ankle", "Knee", "Hip", "Spine", "Shoulder"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Problems in one part of the kinetic chain stay isolated there.", answer: false, explanation: "Weakness anywhere creates compensation everywhere else in the chain." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Strength or weakness anywhere affects _______ else.", options: ['everywhere', 'nowhere', 'only locally', 'randomly'], answer: 'everywhere' },
                ]
            },
            {
                id: 'body-3-2', unitId: 'body-3', order: 2, title: "The Posterior Chain",
                content: {
                    intro: `The posterior chain is the powerhouse running down your back: glutes, hamstrings, and back muscles.\n\nThese muscles are critical for standing, walking, running, jumping, and lifting. They're also commonly weak from too much sitting.\n\nA strong posterior chain protects your back, improves posture, and generates power for athletic movements.`,
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order the posterior chain from bottom to top:", items: ["Hamstrings", "Glutes", "Lower back muscles", "Upper back muscles"]},
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
                    intro: `When one link in the chain is weak, other muscles compensate.\n\nWeak glutes? Your lower back takes over. Tight hip flexors? Your hamstrings work overtime. These compensations can work for a while, but eventually cause pain or injury.\n\nMany "mystery" pains come from compensation patterns far from where you feel the pain.`,
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How compensation leads to injury:", items: ["One muscle is weak", "Other muscles compensate", "Compensation works temporarily", "Compensating muscles overwork", "Pain or injury develops"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Compensations always cause immediate pain.", answer: false, explanation: "Compensations can work for months or years before finally causing pain." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Many 'mystery' pains come from compensation patterns _______ from where you feel pain.", options: ['far', 'close', 'directly', 'immediately'], answer: 'far' },
                ]
            },
            {
                id: 'body-3-4', unitId: 'body-3', order: 4, title: "Ground Up Force",
                content: {
                    intro: `Most powerful movements start from the ground.\n\nWhen you throw a punch, the force starts in your feet, travels up through your legs, transfers through your core, and releases through your arm. This is ground reaction force traveling up the kinetic chain.\n\nStrong legs and core multiply the power of your arms.`,
                    keyPoint: "Power travels from the ground up through the kinetic chain. Leg and core strength multiply arm power.",
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How power travels in a punch:", items: ["Feet push into ground", "Legs drive upward", "Hips rotate", "Core transfers force", "Arm extends with power"]},
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
                    intro: `Isolation exercises have their place, but real function comes from training movements, not muscles.\n\nCompound exercises like squats, deadlifts, and pushups train entire kinetic chains working together. This builds coordination and strength that transfers to real life.\n\nYour brain doesn't think in muscles—it thinks in movements. Train movements.`,
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order from isolation to compound:", items: ["Bicep curl (single muscle)", "Lunges (multiple leg muscles)", "Squats (legs + core)", "Deadlifts (full posterior chain)", "Olympic lifts (full body)"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Better approach to posture:", items: ["Accept no posture is 'perfect'", "Focus on variety and movement", "Change positions regularly", "Take movement breaks", "Keep the body dynamic"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Standing all day is perfect because sitting is bad.", answer: false, explanation: "Standing all day has its own problems. The key is variety—not standing OR sitting, but movement between positions." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "The best posture is your _______ posture.", options: ['next', 'current', 'first', 'last'], answer: 'next' },
                ]
            },
            {
                id: 'body-4-2', unitId: 'body-4', order: 2, title: "Neutral Spine",
                content: {
                    intro: `Your spine has natural curves—don't try to flatten them.\n\nA "neutral spine" maintains these natural curves: slight inward curve in lower back (lordosis), slight outward curve in upper back (kyphosis), slight inward curve in neck.\n\nNeutral spine distributes load safely. Flattening or exaggerating curves increases stress on discs and joints.`,
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Spinal curves from bottom to top:", items: ["Lumbar lordosis (lower back inward)", "Thoracic kyphosis (upper back outward)", "Cervical lordosis (neck inward)"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Exaggerating your spinal curves is just as bad as flattening them.", answer: true, explanation: "Both extremes increase joint stress. Neutral spine means natural, not exaggerated or flattened." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Neutral spine _______ load safely across spinal structures.", options: ['distributes', 'concentrates', 'ignores', 'blocks'], answer: 'distributes' },
                ]
            },
            {
                id: 'body-4-3', unitId: 'body-4', order: 3, title: "Hip Hinge Pattern",
                content: {
                    intro: `The hip hinge is the most important movement pattern you've probably never heard of.\n\nInstead of bending at the spine to reach down, you push your hips back while keeping your spine neutral. This loads your powerful hip muscles instead of stressing your lower back.\n\nDeadlifts, kettlebell swings, and picking things up safely all use the hip hinge.`,
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How to hip hinge properly:", items: ["Start standing tall", "Push hips back (not down)", "Keep spine neutral", "Feel stretch in hamstrings", "Drive hips forward to return"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order the stacking from bottom to top:", items: ["Ankles", "Knees", "Hips", "Shoulders", "Ears"]},
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
                    intro: `How you move matters more than how much weight you move.\n\nQuality movement means controlling the motion through full range, maintaining good position, and not compensating with other body parts. This builds lasting strength and avoids injury.\n\nAlways earn the right to add difficulty by mastering the basic movement first.`,
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Proper progression:", items: ["Learn the movement pattern", "Master it with bodyweight", "Add light weight with good form", "Gradually increase load", "Maintain quality throughout"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "If you can lift it, your form must be good enough.", answer: false, explanation: "You can lift heavy with terrible form—but you're building bad patterns and risking injury." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "How you move matters more than how much _______ you move.", options: ['weight', 'distance', 'quickly', 'slowly'], answer: 'weight' },
                ]
            },
        ],
        'body-5': [
            {
                id: 'body-5-1', unitId: 'body-5', order: 1, title: "Progressive Overload",
                content: {
                    intro: `Your body adapts to stress. To keep adapting, you must progressively increase the challenge.\n\nThis is progressive overload—the fundamental principle of training. It doesn't mean adding weight every session. Progress can be more reps, more sets, better form, longer time under tension, or less rest.\n\nNo overload = no adaptation.`,
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How progressive overload works:", items: ["Apply training stress", "Body adapts to that stress", "Stress becomes easier", "Increase the challenge", "New adaptation occurs"]},
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
                    intro: `Training creates the stimulus. Recovery creates the adaptation.\n\nMuscle doesn't grow during workouts—it grows during recovery. Sleep, nutrition, and rest days aren't "not training"—they're when training actually works.\n\nMore is not always better. Hard training with poor recovery equals spinning your wheels.`,
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How adaptation actually works:", items: ["Training damages muscle fibers", "Recovery period begins", "Body repairs and strengthens", "Adaptation occurs", "You're now stronger than before"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How to apply specificity:", items: ["Define your specific goal", "Identify the key movements/demands", "Train those specific demands", "General fitness supports but doesn't replace", "Progress in your specific goal"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Finding your minimum effective dose:", items: ["Start with the minimum", "Track if you're progressing", "Add only if needed", "Prioritize sustainability", "Consistent over time wins"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "The path to fitness results:", items: ["Show up consistently", "Don't require perfection", "Allow adaptations to accumulate", "Be patient with the timeline", "Results emerge over time"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How your body uses food energy:", items: ["You eat food containing calories", "Digestion extracts energy", "Energy is stored or used", "Body performs functions", "You need to eat again"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Only exercise uses calories.", answer: false, explanation: "Everything uses calories—breathing, thinking, digesting, existing. Exercise is only a small portion." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Calories aren't bad—they're _______ for life.", options: ['necessary', 'optional', 'harmful', 'confusing'], answer: 'necessary' },
                ]
            },
            {
                id: 'fuel-1-2', unitId: 'fuel-1', order: 2, title: "Energy Balance",
                content: {
                    intro: `Weight change comes down to energy balance: calories in vs. calories out.\n\nCalories In > Calories Out = Weight gain\nCalories In < Calories Out = Weight loss\nCalories In = Calories Out = Weight maintenance\n\nThis is physics, and it always holds true. But "calories out" is more complex than just exercise—it includes all the energy your body uses.`,
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Understanding energy balance:", items: ["Calculate calories in (food)", "Calculate calories out (all expenditure)", "Compare the two", "Surplus = gain, deficit = loss", "Adjust as needed"]},
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Certain foods don't count toward energy balance.", answer: false, explanation: "All food contributes calories. There are no 'free' foods that don't affect energy balance." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Eat more than you burn = _______.", options: ['gain', 'loss', 'maintenance', 'health'], answer: 'gain' },
                ]
            },
            {
                id: 'fuel-1-3', unitId: 'fuel-1', order: 3, title: "Where Calories Out Go",
                content: {
                    intro: `"Calories out" isn't just exercise. It's actually four things:\n\n1. BMR (60-75%): Basal metabolic rate—energy to keep you alive at rest\n2. NEAT (15-30%): Non-exercise activity—fidgeting, walking, daily movement\n3. TEF (10%): Thermic effect of food—energy to digest food\n4. EAT (5-15%): Exercise activity—intentional workouts\n\nExercise is the smallest component!`,
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order components of calories out by size:", items: ["BMR - Resting metabolism (60-75%)", "NEAT - Daily movement (15-30%)", "TEF - Digesting food (10%)", "EAT - Exercise (5-15%)"]},
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
                    intro: `Your metabolism isn't fixed—it adapts to energy intake.\n\nWhen you eat less, your body gradually decreases energy expenditure to conserve resources. When you eat more, it increases expenditure somewhat. This is metabolic adaptation.\n\nThis is why extreme diets often fail long-term: the body adapts, making the deficit harder to maintain.`,
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Why extreme diets fail:", items: ["Start severe restriction", "Initial weight loss occurs", "Body adapts, burns less", "Weight loss stalls", "Restriction becomes unsustainable"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Signs you might be eating too little:", items: ["Constant fatigue", "Irritable mood", "Workouts feel harder", "Poor recovery", "Stalled progress despite effort"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order macros by calories per gram:", items: ["Protein - 4 cal/g", "Carbohydrates - 4 cal/g", "Alcohol - 7 cal/g (not a macro)", "Fat - 9 cal/g"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Why protein matters for fitness:", items: ["You exercise and damage muscle", "Protein provides amino acids", "Body repairs and builds tissue", "Muscle grows stronger", "Process repeats with each workout"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "How carbs fuel exercise:", items: ["You eat carbohydrates", "Body stores as glycogen in muscles", "You exercise", "Glycogen provides quick energy", "Performance is fueled"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Why fat is essential:", items: ["You eat dietary fat", "Body uses it for hormones", "Vitamins get absorbed", "Cell membranes stay healthy", "Body functions properly"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Finding your macro balance:", items: ["Start with general guidelines", "Prioritize protein target", "Focus on whole foods", "Adjust based on how you feel", "Maintain consistently"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Why micronutrients matter:", items: ["Body needs vitamins and minerals", "They enable thousands of processes", "Small amounts are sufficient", "Deficiencies cause problems", "Symptoms may appear late"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Ensuring vitamin variety:", items: ["Eat different colored foods", "Include fruits and vegetables", "Each color has different vitamins", "Variety covers your bases", "Supplements fill specific gaps"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Getting minerals from food:", items: ["Choose whole food sources", "Minerals come with co-factors", "Co-factors aid absorption", "Better absorbed than pills", "Body uses them effectively"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "When electrolyte replacement matters:", items: ["Intense or prolonged exercise", "Hot conditions", "Heavy sweating", "Plain water isn't enough", "Add electrolytes"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "The food first approach:", items: ["Eat varied whole foods", "Include many colors", "Get nutrients naturally", "Supplements for specific gaps", "Diet is the foundation"]},
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Rank these nutrition factors from MOST to LEAST important for most people:", items: ["Total daily calorie intake", "Macronutrient balance", "Food quality and variety", "Specific meal timing"] },
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Order these foods from BEST to WORST as a pre-workout snack 30 min before training:", items: ["Banana", "Toast with jam", "Apple with light peanut butter", "Large burrito with beans"] },
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Rank post-workout nutrition priorities from MOST to LEAST important:", items: ["Adequate protein (20-40g)", "Carbohydrates for glycogen", "Overall food quality", "Eating within exactly 30 minutes"] },
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Rank these factors from MOST to LEAST important for meal planning:", items: ["Hitting total daily nutrition targets", "Choosing a sustainable eating pattern", "Eating enough protein throughout day", "Specific number of meals per day"] },
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Rank these eating patterns from MOST to LEAST aligned with circadian rhythm:", items: ["Larger breakfast and lunch, light dinner", "Even distribution across meals", "Light all day, huge dinner", "Skipping breakfast, feasting at night"] },
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Rank these fat loss strategies from MOST to LEAST effective long-term:", items: ["Moderate deficit with high protein", "Whole foods focus", "Consistent exercise routine", "Extreme restriction"] },
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Rank these factors from MOST to LEAST important for muscle building:", items: ["Consistent training stimulus", "Adequate protein intake", "Calorie surplus for building materials", "Perfect supplement timing"] },
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Rank these for athletic performance from MOST to LEAST important:", items: ["Adequate total calories", "Sufficient carbohydrates", "Quality training and recovery", "Extreme calorie restriction"] },
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Rank these for successful body recomposition from MOST to LEAST important:", items: ["Consistent strength training", "Very high protein intake", "Patience (slower progress)", "Eating at maintenance or slight deficit"] },
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
                    { type: GAME_TYPES.ORDER_SEQUENCE, question: "Rank these nutrition approaches from MOST to LEAST sustainable:", items: ["Gradual habit changes", "Adding nutritious foods", "Moderate, flexible approach", "Extreme elimination diet"] },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Focus on _______ good foods, not just removing bad ones.", options: ['adding', 'eliminating', 'fearing', 'avoiding'], answer: 'adding' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Consistency matters more than perfection in nutrition.", answer: true, explanation: "Being 80% consistent over years beats being 100% perfect for a few weeks. Sustainable nutrition is about long-term patterns, not short-term perfection." },
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
        question: "Put these aging processes in a logical cascade:",
        items: [
          "DNA damage accumulates",
          "Cells become dysfunctional",
          "Tissue repair slows",
          "Organ function declines",
          "Disease risk increases",
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
        question: "What happens as telomeres progressively shorten?",
        items: [
          "Cells divide normally with long telomeres",
          "Telomeres shorten with each division",
          "Critically short telomeres trigger alarms",
          "Cell stops dividing or becomes senescent",
          "Tissue regeneration capacity declines",
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
        question: "How does visceral fat contribute to aging?",
        items: [
          "Excess visceral fat accumulates",
          "Fat cells secrete inflammatory molecules",
          "Chronic inflammation develops",
          "Tissues and organs experience damage",
          "Age-related diseases develop",
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
        question: "How do senescent cells contribute to aging?",
        items: [
          "Cell damage occurs",
          "Damaged cell enters senescence instead of dying",
          "Senescent cell secretes harmful molecules",
          "Surrounding tissue is damaged",
          "More cells become senescent—cascade effect",
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
        question: "How do lifestyle choices affect biological age over time?",
        items: [
          "Daily choices compound",
          "Cellular processes are affected",
          "Epigenetic patterns change",
          "Biological age diverges from chronological age",
          "Health outcomes are determined",
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
        question: "How does insulin resistance develop?",
        items: [
          "Frequent blood sugar spikes occur",
          "Pancreas repeatedly releases insulin",
          "Cells become less responsive to insulin",
          "Pancreas works harder to compensate",
          "System eventually fails (Type 2 diabetes)",
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
        question: "How can insulin resistance be reversed?",
        items: [
          "Reduce refined carbohydrates",
          "Engage muscles through exercise",
          "Improve sleep quality",
          "Manage chronic stress",
          "Consider time-restricted eating",
        ],
        correctOrder: [0, 1, 2, 3, 4],
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
        question: "What's the optimal order to eat food for blood sugar control?",
        items: [
          "Fiber and vegetables first",
          "Protein next",
          "Fats",
          "Carbohydrates last",
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
        question: "How does constant snacking cause metabolic inflexibility?",
        items: [
          "Frequent eating keeps insulin high",
          "High insulin blocks fat burning",
          "Fat-burning pathway weakens from disuse",
          "Body becomes glucose-dependent",
          "Energy crashes without frequent food",
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
        question: "How does atherosclerosis develop?",
        items: [
          "LDL particles infiltrate artery walls",
          "Inflammation causes LDL to oxidize",
          "Immune cells create plaques",
          "Plaques grow and narrow arteries",
          "Plaque ruptures, causing clot (heart attack/stroke)",
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
        question: "How does cancer typically develop?",
        items: [
          "DNA damage occurs",
          "Some damage escapes repair",
          "Damage accumulates over time",
          "Cells begin dividing uncontrollably",
          "Cancer cells evade immune detection and grow",
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
        question: "How does Type 2 diabetes typically develop?",
        items: [
          "Years of blood sugar dysregulation",
          "Insulin resistance develops",
          "Pancreas works harder to compensate",
          "Pancreas can't keep up",
          "Blood sugar rises—diabetes diagnosis",
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
        question: "How do lifestyle factors damage the brain?",
        items: [
          "Poor lifestyle leads to vascular damage",
          "Blood flow to brain is reduced",
          "Chronic inflammation develops",
          "Neurons are damaged over time",
          "Cognitive function declines",
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
        question: "How does lifestyle compound to prevent disease?",
        items: [
          "Consistent healthy choices are made",
          "Multiple biological mechanisms improve",
          "Benefits compound over time",
          "Risk factors stay low for years",
          "Chronic disease is prevented or delayed",
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
        question: "How does fasting activate autophagy?",
        items: [
          "Food intake stops",
          "Insulin and mTOR levels drop",
          "Autophagy signals increase",
          "Cells identify damaged components",
          "Damaged components are recycled",
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
        question: "How does exercise improve mitochondrial health?",
        items: [
          "Exercise creates energy demand",
          "Cellular signals activate mitochondrial genes",
          "New mitochondria are created",
          "Old/damaged mitochondria are cleared",
          "Overall energy production improves",
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
        question: "How does NAD+ decline contribute to aging?",
        items: [
          "NAD+ levels decrease with age",
          "Energy production in cells declines",
          "DNA repair becomes impaired",
          "Sirtuin activity decreases",
          "Aging processes accelerate",
        ],
        correctOrder: [0, 1, 2, 3, 4],
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
        question: "How does DNA damage contribute to aging?",
        items: [
          "DNA damage occurs from various sources",
          "Some damage escapes repair",
          "Damaged DNA accumulates",
          "Cells become dysfunctional or die",
          "Tissue function declines",
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
        question: "How does hormesis work?",
        items: [
          "A stressor is applied",
          "Cells detect the stress",
          "Repair pathways are activated",
          "Response overshoots baseline",
          "You're left stronger than before",
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
        question: "How can you optimize sleep?",
        items: [
          "Set consistent sleep/wake times",
          "Get morning light exposure",
          "Limit caffeine after noon",
          "Avoid screens before bed",
          "Keep bedroom dark and cool",
        ],
        correctOrder: [0, 1, 2, 3, 4],
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
        question: "How does chronic stress accelerate aging?",
        items: [
          "Stress response stays constantly activated",
          "Cortisol remains elevated",
          "Inflammation increases",
          "Telomeres shorten faster",
          "Biological age accelerates",
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
        question: "What's the minimum exercise recommendation?",
        items: [
          "150 min moderate OR 75 min vigorous aerobic/week",
          "2+ strength training sessions per week",
          "Regular movement breaks throughout day",
          "Combination of aerobic and strength",
          "Consistency over intensity",
        ],
        correctOrder: [0, 1, 2, 3, 4],
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
        question: "How can you build connection and purpose?",
        items: [
          "Prioritize quality relationships",
          "Find community with shared interests",
          "Cultivate purpose beyond yourself",
          "Stay engaged in meaningful activities",
          "Balance giving and receiving support",
        ],
        correctOrder: [0, 1, 2, 3, 4],
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
        question: "The longevity fundamentals:",
        items: [
          "Movement (exercise + daily activity)",
          "Nutrition (plants, whole foods)",
          "Sleep (7-9 hours, quality)",
          "Stress management",
          "Connection + Purpose",
        ],
        correctOrder: [0, 1, 2, 3, 4],
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
        }
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
        if (state.isPlaying) {
            clearInterval(state.intervalId);
            state.isPlaying = false;
            document.querySelector('.rsvp-play-btn')?.classList.remove('active');
        } else {
            state.isPlaying = true;
            document.querySelector('.rsvp-play-btn')?.classList.add('active');
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

        const words = lesson.content.intro.split(/\s+/).filter(w => w);
        const state = learningState.rsvpState;

        if (state.wordIndex >= words.length) {
            clearInterval(state.intervalId);
            state.isPlaying = false;
            state.wordIndex = 0;
            document.querySelector('.rsvp-play-btn')?.classList.remove('active');
            return;
        }

        updateRsvpDisplay();
        state.wordIndex++;
    }

    function updateRsvpDisplay() {
        const lesson = learningState.currentLesson;
        if (!lesson) return;

        const words = lesson.content.intro.split(/\s+/).filter(w => w);
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

    async function initLearning() {
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
            if (window.supabase && window.currentUser) {
                const { data, error } = await window.supabase.rpc('get_learning_summary', {
                    p_user_id: window.currentUser.id
                });

                if (!error && data) {
                    // Merge with local progress (prefer DB but keep local if DB is behind)
                    learningState.userProgress = data;
                    if (localProgress) {
                        // Merge lessons - keep union of both
                        const allLessons = new Set([
                            ...(data.lessons_completed || []),
                            ...(localProgress.lessons_completed || [])
                        ]);
                        learningState.userProgress.lessons_completed = Array.from(allLessons);
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

        const modules = getModulesSorted();
        const progress = learningState.userProgress;

        const totalLessons = 100; // 4 modules × 5 units × 5 lessons
        const completedLessons = progress?.lessons_completed?.length || 0;
        const progressPercent = Math.round((completedLessons / totalLessons) * 100);

        container.innerHTML = `
            <div style="margin: 15px; padding: 16px 20px; background: linear-gradient(135deg, #059669 0%, #10b981 100%); border-radius: 16px; display: flex; align-items: center; gap: 15px;">
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

            <div style="margin: 0 15px 20px; padding: 20px; background: white; border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <span style="font-weight: 600; color: var(--text-main);">Your Progress</span>
                    <span style="font-size: 0.9rem; color: var(--text-muted);">${completedLessons}/${totalLessons} lessons</span>
                </div>
                <div style="height: 10px; background: #e5e7eb; border-radius: 5px; overflow: hidden;">
                    <div style="height: 100%; width: ${progressPercent}%; background: linear-gradient(90deg, var(--primary), var(--secondary)); border-radius: 5px;"></div>
                </div>
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
    };

    function renderModuleView(moduleId) {
        const container = document.getElementById('learning-content');
        if (!container) return;

        const module = MODULES[moduleId];
        const units = getUnitsForModule(moduleId);
        const progress = learningState.userProgress;

        container.innerHTML = `
            <div style="padding: 20px; background: white; border-bottom: 1px solid #f1f5f9;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <button onclick="window.renderLearningHome()" style="background: #f1f5f9; border: none; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                        <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: #64748b;"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
                    </button>
                    <div style="flex: 1;">
                        <h2 style="margin: 0; font-size: 1.3rem; font-weight: 700; color: var(--text-main);">${module.title}</h2>
                        <p style="margin: 4px 0 0; font-size: 0.9rem; color: var(--text-muted);">${module.subtitle}</p>
                    </div>
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
    };

    function renderUnitView(unitId) {
        const container = document.getElementById('learning-content');
        if (!container) return;

        const unit = UNITS[unitId];
        const module = MODULES[unit.moduleId];
        const lessons = getLessonsForUnit(unitId);
        const progress = learningState.userProgress;

        container.innerHTML = `
            <div style="padding: 20px; background: white; border-bottom: 1px solid #f1f5f9;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <button onclick="window.openLearningModule('${unit.moduleId}')" style="background: #f1f5f9; border: none; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                        <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: #64748b;"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
                    </button>
                    <div style="flex: 1;">
                        <div style="font-size: 0.8rem; color: ${module.color}; font-weight: 600; margin-bottom: 2px;">${module.title}</div>
                        <h2 style="margin: 0; font-size: 1.2rem; font-weight: 700; color: var(--text-main);">${unit.title}</h2>
                    </div>
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

        renderLessonIntro(lesson);
    };

    function renderLessonIntro(lesson) {
        const container = document.getElementById('learning-content');
        if (!container) return;

        const unit = UNITS[lesson.unitId];
        const module = MODULES[unit.moduleId];
        const mode = learningState.readingMode;

        // Reset RSVP state when re-rendering
        learningState.rsvpState.wordIndex = 0;

        // Process content based on mode
        const paragraphs = splitIntoParagraphs(lesson.content.intro);
        let contentHtml = '';

        if (mode === 'rsvp') {
            contentHtml = `
                <div class="rsvp-container" style="--module-color: ${module.color};">
                    <div class="rsvp-word" style="color: var(--text-main);">Press play to start</div>
                    <div class="rsvp-progress">
                        <div class="rsvp-progress-bar" style="width: 0%;"></div>
                    </div>
                    <div class="rsvp-controls">
                        <button class="rsvp-btn" onclick="window.resetRsvp()" title="Reset">
                            <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: ${module.color};"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
                        </button>
                        <button class="rsvp-btn rsvp-play-btn" onclick="window.toggleRsvp()" title="Play/Pause">
                            <svg viewBox="0 0 24 24" style="width: 24px; height: 24px; fill: ${module.color};"><path d="M8 5v14l11-7z"/></svg>
                        </button>
                    </div>
                    <div class="rsvp-speed">
                        <span>Speed:</span>
                        <input type="range" min="100" max="500" value="${learningState.rsvpState.speed}" onchange="window.setRsvpSpeed(this.value)" style="--module-color: ${module.color};">
                        <span>${Math.round(60000 / learningState.rsvpState.speed)} wpm</span>
                    </div>
                </div>
            `;
        } else if (mode === 'speed') {
            contentHtml = `<div class="bionic-text" style="font-size: 1rem; color: var(--text-main); line-height: 1.8;">`;
            paragraphs.forEach((p, i) => {
                const processedText = parseInteractiveText(toBionicText(p), module.color);
                contentHtml += `<p class="lesson-paragraph lesson-section" style="margin-bottom: 1.2em;">${processedText}</p>`;
            });
            contentHtml += `</div>`;
        } else if (mode === 'focus') {
            contentHtml = `<div class="focus-mode" style="font-size: 1rem; color: var(--text-main); line-height: 1.8;">`;
            paragraphs.forEach((p, i) => {
                const processedText = parseInteractiveText(p, module.color);
                contentHtml += `<p class="lesson-paragraph" style="margin-bottom: 1.2em;">${processedText}</p>`;
            });
            contentHtml += `</div>`;
        } else {
            contentHtml = `<div style="font-size: 1rem; color: var(--text-main); line-height: 1.8;">`;
            paragraphs.forEach((p, i) => {
                const processedText = parseInteractiveText(p, module.color);
                contentHtml += `<p class="lesson-section" style="margin-bottom: 1.2em;">${processedText}</p>`;
            });
            contentHtml += `</div>`;
        }

        // Generate think prompt if lesson has games
        let thinkPromptHtml = '';
        if (lesson.games?.length > 0) {
            const firstGame = lesson.games[0];
            let thinkQuestion = '';
            let thinkAnswer = '';

            if (firstGame.type === 'swipe_true_false') {
                thinkQuestion = `Before we test you: ${firstGame.question.replace(/\\.$/, '')} - true or false?`;
                thinkAnswer = firstGame.answer ? 'True! ' : 'False! ';
                thinkAnswer += firstGame.explanation || '';
            } else if (firstGame.question) {
                thinkQuestion = `Think about it: ${firstGame.question}`;
                thinkAnswer = "You'll find out in the quiz!";
            } else {
                thinkQuestion = "Can you recall the main concept from what you just read?";
                thinkAnswer = lesson.content.keyPoint;
            }

            thinkPromptHtml = `
                <div class="think-prompt lesson-section" style="--module-color: ${module.color};">
                    <div class="think-prompt-icon">
                        <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: white;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                    </div>
                    <div class="think-prompt-content">
                        <div class="think-prompt-label">Quick Check</div>
                        <div class="think-prompt-question">${thinkQuestion}</div>
                        <div class="think-prompt-reveal">
                            <div class="think-prompt-answer">${thinkAnswer}</div>
                            <button class="think-reveal-btn" onclick="window.revealThinkAnswer(this)">Reveal Answer</button>
                        </div>
                    </div>
                </div>
            `;
        }

        container.innerHTML = `
            <div style="min-height: 100vh; background: linear-gradient(180deg, ${module.color}15 0%, white 30%); --module-color: ${module.color};">
                <div class="reading-progress" id="reading-progress" style="--module-color: ${module.color};"></div>

                <div style="padding: 20px; display: flex; align-items: center; gap: 15px;">
                    <button onclick="window.openLearningUnit('${lesson.unitId}')" style="background: white; border: none; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: #64748b;"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                    </button>
                    <div style="flex: 1; text-align: center;">
                        <span style="font-size: 0.8rem; color: ${module.color}; font-weight: 600;">${module.title} • ${unit.title}</span>
                    </div>
                    <div style="width: 40px;"></div>
                </div>

                <div style="margin: 10px 15px; background: white; border-radius: 20px; padding: 25px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
                    <h1 class="lesson-section" style="margin: 0 0 15px; font-size: 1.5rem; font-weight: 700; color: var(--text-main); line-height: 1.3;">${lesson.title}</h1>

                    <div class="reading-mode-toggle lesson-section" style="--module-color: ${module.color};">
                        <button class="reading-mode-btn ${mode === 'normal' ? 'active' : ''}" onclick="window.setReadingMode('normal')" style="${mode === 'normal' ? `color: ${module.color};` : ''}">Normal</button>
                        <button class="reading-mode-btn ${mode === 'focus' ? 'active' : ''}" onclick="window.setReadingMode('focus')" style="${mode === 'focus' ? `color: ${module.color};` : ''}">Focus</button>
                        <button class="reading-mode-btn ${mode === 'speed' ? 'active' : ''}" onclick="window.setReadingMode('speed')" style="${mode === 'speed' ? `color: ${module.color};` : ''}">Speed</button>
                        <button class="reading-mode-btn ${mode === 'rsvp' ? 'active' : ''}" onclick="window.setReadingMode('rsvp')" style="${mode === 'rsvp' ? `color: ${module.color};` : ''}">Flash</button>
                    </div>

                    <p class="lesson-section" style="font-size: 0.75rem; color: #94a3b8; margin: -10px 0 20px; text-align: center;">
                        ${mode === 'normal' ? 'Standard reading with tappable terms' :
                          mode === 'focus' ? 'Text reveals progressively to help you focus' :
                          mode === 'speed' ? 'Bionic reading highlights key parts of words' :
                          'Words flash one at a time for rapid reading'}
                    </p>

                    ${contentHtml}

                    ${mode !== 'rsvp' ? thinkPromptHtml : ''}

                    <div class="lesson-section" style="margin-top: 25px; padding: 16px; background: ${module.color}10; border-radius: 12px; border-left: 4px solid ${module.color};">
                        <div style="font-size: 0.75rem; font-weight: 700; color: ${module.color}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Key Insight</div>
                        <div style="font-size: 0.95rem; color: var(--text-main); line-height: 1.5; font-weight: 500;">${lesson.content.keyPoint}</div>
                    </div>
                </div>

                <div class="lesson-section" style="padding: 20px 15px;">
                    <button onclick="window.startLessonGames()" style="width: 100%; background: ${module.color}; color: white; border: none; padding: 16px; border-radius: 14px; font-size: 1.1rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 4px 12px ${module.color}40; transition: transform 0.2s ease;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                        <span>Test Your Understanding</span>
                        <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: white;"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                    <p style="text-align: center; font-size: 0.85rem; color: var(--text-muted); margin-top: 12px;">${lesson.games?.length || 0} quick games ahead</p>
                </div>

                ${mode !== 'rsvp' ? `
                    <p class="tap-to-continue lesson-section" style="padding-bottom: 30px;">
                        <span style="background: ${module.color}20; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem;">
                            Tip: Tap highlighted terms for definitions
                        </span>
                    </p>
                ` : ''}
            </div>
        `;

        // Add scroll progress tracking
        if (mode !== 'rsvp') {
            const contentArea = container.querySelector('div');
            if (contentArea) {
                contentArea.addEventListener('scroll', () => {
                    const scrollTop = contentArea.scrollTop;
                    const scrollHeight = contentArea.scrollHeight - contentArea.clientHeight;
                    const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
                    const progressBar = document.getElementById('reading-progress');
                    if (progressBar) {
                        progressBar.style.width = `${Math.min(100, progress)}%`;
                    }
                });
            }
        }
    }

    window.startLessonGames = function() {
        const lesson = learningState.currentLesson;
        if (!lesson || !lesson.games?.length) {
            completeLesson();
            return;
        }
        learningState.currentGameIndex = 0;
        renderCurrentGame();
    };

    function renderCurrentGame() {
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
                        <button onclick="window.exitLesson()" style="background: #f1f5f9; border: none; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                            <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: #64748b;"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                        </button>
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
        let allCorrect = true;

        items.forEach((item, i) => {
            const correctIndex = parseInt(item.dataset.correct);
            if (correctIndex !== i) allCorrect = false;
            item.style.background = correctIndex === i ? '#dcfce7' : '#fee2e2';
            item.style.borderColor = correctIndex === i ? '#10b981' : '#ef4444';
        });

        learningState.gamesPlayed++;
        if (allCorrect) learningState.gamesCorrect++;
        setTimeout(() => showGameFeedback(allCorrect), 500);
    };

    window.exitLesson = function() {
        if (confirm('Exit this lesson? Your progress won\'t be saved.')) {
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

        // Try to sync with database (non-blocking)
        try {
            if (window.supabase && window.currentUser) {
                const { data, error } = await window.supabase.rpc('complete_lesson', {
                    p_user_id: window.currentUser.id,
                    p_lesson_id: lesson.id,
                    p_unit_id: lesson.unitId,
                    p_module_id: unit.moduleId,
                    p_games_played: learningState.gamesPlayed,
                    p_games_correct: learningState.gamesCorrect
                });
                // If DB returns different XP, could use that, but local is our source of truth
                if (error) {
                    console.log('DB sync failed, using local progress:', error.message);
                }
            }
        } catch (err) {
            console.log('DB sync failed, using local progress:', err.message);
        }

        // Award XP to user's main account (tamagotchi)
        if (isNewLesson && xpEarned > 0) {
            try {
                if (window.supabase && window.currentUser) {
                    const { data: currentPoints } = await window.supabase
                        .from('user_points')
                        .select('lifetime_points')
                        .eq('user_id', window.currentUser.id)
                        .single();

                    if (currentPoints) {
                        await window.supabase
                            .from('user_points')
                            .update({ lifetime_points: (currentPoints.lifetime_points || 0) + xpEarned })
                            .eq('user_id', window.currentUser.id);
                    } else {
                        await window.supabase
                            .from('user_points')
                            .insert({ user_id: window.currentUser.id, lifetime_points: xpEarned, current_points: 0 });
                    }

                    // Trigger XP animations on tamagotchi
                    if (typeof window.triggerXPBarRainbow === 'function') window.triggerXPBarRainbow();
                    if (typeof window.refreshLevelDisplay === 'function') window.refreshLevelDisplay();
                }
            } catch (e) {
                console.log('XP award to main account pending:', e.message);
            }
        }

        const result = { xp_earned: xpEarned, is_new_lesson: isNewLesson, needs_perfect_score: needsPerfectScore };
        renderLessonComplete(result, lesson, module);
    }

    function renderLessonComplete(result, lesson, module) {
        const container = document.getElementById('learning-content');
        if (!container) return;

        const scorePercent = learningState.gamesPlayed > 0
            ? Math.round((learningState.gamesCorrect / learningState.gamesPlayed) * 100)
            : 100;

        const xpColor = result?.xp_earned > 0 ? '#10b981' : '#9ca3af';

        // Determine status message
        let statusMessage = '';
        if (result?.is_new_lesson === false) {
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
                        <button onclick="window.startLesson('${lesson.id}')" style="background: white; color: ${module.color}; border: none; padding: 16px 30px; border-radius: 30px; font-size: 1.1rem; font-weight: 700; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
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

})();
