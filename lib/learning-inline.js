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
                ]
            },
            {
                id: 'mind-1-2', unitId: 'mind-1', order: 2, title: "Prediction First, Sensation Second",
                content: {
                    intro: `Your brain generates predictions BEFORE sensory signals even arrive.\n\nThink about that. Your brain isn't waiting to see what happens—it's already guessing. Sensory data from your eyes, ears, and body only matters when it DIFFERS from what your brain predicted.\n\nThis is why you don't notice the feeling of your clothes until someone mentions it. Your brain predicted that sensation, so it didn't bother telling "you" about it.`,
                    keyPoint: "Prediction comes first. Sensation only becomes conscious when it violates prediction.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Your brain waits for sensory information before deciding what you're experiencing.", answer: false, explanation: "Your brain predicts first, then checks. Waiting would be too slow to survive." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Sensory signals only reach consciousness when they _______ predictions.", options: ['match', 'violate', 'confirm', 'ignore'], answer: 'violate' },
                ]
            },
            {
                id: 'mind-1-3', unitId: 'mind-1', order: 3, title: "Prediction Errors = Learning",
                content: {
                    intro: `When reality doesn't match your brain's prediction, that mismatch is called a "prediction error."\n\nPrediction errors are the ONLY way your brain updates its model of the world. No prediction error = no learning.\n\nThis is why surprise is so important. Novel experiences, unexpected outcomes—these create prediction errors that force your brain to update.`,
                    keyPoint: "Learning IS prediction error. Your brain only updates when reality surprises it.",
                },
                games: [
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Your brain only updates its model when there's a prediction _______.", options: ['error', 'success', 'delay', 'memory'], answer: 'error' },
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "Doing the exact same routine forever leads to continuous improvement.", answer: false, explanation: "No prediction error = no signal to adapt. You need progressive challenge." },
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
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Your brain uses your _______ to predict your present experience.", options: ['history', 'logic', 'desires', 'senses'], answer: 'history' },
                ]
            },
            {
                id: 'mind-1-5', unitId: 'mind-1', order: 5, title: "The Bayesian Brain",
                content: {
                    intro: `Your brain is essentially a probability calculator running millions of predictions simultaneously.\n\nFor every moment, your brain asks: "Given everything I've ever experienced, what is MOST LIKELY to be happening right now?"\n\nStrong beliefs (lots of past experience) are hard to override. This is why transformation requires consistent new evidence over time.`,
                    keyPoint: "Your brain calculates probabilities constantly. Strong beliefs require strong, repeated evidence to change.",
                },
                games: [
                    { type: GAME_TYPES.SWIPE_TRUE_FALSE, question: "One powerful experience can instantly change a deeply held belief.", answer: false, explanation: "Strong priors require accumulated evidence. One data point rarely shifts a probability distribution much." },
                    { type: GAME_TYPES.FILL_BLANK, sentence: "Strong beliefs require _______, repeated evidence to change.", options: ['consistent', 'occasional', 'dramatic', 'logical'], answer: 'consistent' },
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
    };

    let matchState = { selectedLeft: null, selectedRight: null, matched: [] };

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
        const dailyStatus = progress?.daily_status || { can_learn: true, lessons_remaining: 3 };

        const totalLessons = 75;
        const completedLessons = progress?.lessons_completed?.length || 0;
        const progressPercent = Math.round((completedLessons / totalLessons) * 100);

        container.innerHTML = `
            <div style="margin: 15px; padding: 16px 20px; background: ${dailyStatus.can_learn ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : 'linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)'}; border-radius: 16px; display: flex; align-items: center; gap: 15px;">
                <div style="font-size: 2rem;">${dailyStatus.can_learn ? '🧠' : '😴'}</div>
                <div style="flex: 1;">
                    <div style="font-weight: 700; color: white; font-size: 1rem;">
                        ${dailyStatus.can_learn ? `${dailyStatus.lessons_remaining} lesson${dailyStatus.lessons_remaining !== 1 ? 's' : ''} available today` : 'Daily limit reached'}
                    </div>
                    <div style="font-size: 0.85rem; color: rgba(255,255,255,0.85); margin-top: 2px;">
                        ${dailyStatus.can_learn ? '+1 XP per new lesson completed' : 'Come back tomorrow!'}
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
        const dailyStatus = progress?.daily_status || { can_learn: true };

        return `
            <div onclick="${canAccess && dailyStatus.can_learn ? `window.startLesson('${lesson.id}')` : ''}"
                 style="background: white; border-radius: 12px; padding: 16px; box-shadow: 0 2px 6px rgba(0,0,0,0.05); cursor: ${canAccess && dailyStatus.can_learn ? 'pointer' : 'not-allowed'}; opacity: ${canAccess ? '1' : '0.5'}; display: flex; align-items: center; gap: 14px;">
                <div style="width: 44px; height: 44px; background: ${isComplete ? '#10b98120' : module.color + '20'}; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                    ${isComplete ? '✅' : isLocked ? '🔒' : `<span style="font-weight: 700; font-size: 1.1rem; color: ${module.color};">${index + 1}</span>`}
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 0.95rem; color: var(--text-main);">${lesson.title}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
                        ${lesson.games?.length || 0} games ${isComplete ? '• Completed' : '• +1 XP'}
                    </div>
                </div>
                ${canAccess && !isComplete && dailyStatus.can_learn ? `
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

        container.innerHTML = `
            <div style="min-height: 100vh; background: linear-gradient(180deg, ${module.color}15 0%, white 30%);">
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
                    <h1 style="margin: 0 0 20px; font-size: 1.5rem; font-weight: 700; color: var(--text-main); line-height: 1.3;">${lesson.title}</h1>
                    <div style="font-size: 1rem; color: var(--text-main); line-height: 1.7; white-space: pre-wrap;">${lesson.content.intro}</div>

                    <div style="margin-top: 25px; padding: 16px; background: ${module.color}10; border-radius: 12px; border-left: 4px solid ${module.color};">
                        <div style="font-size: 0.75rem; font-weight: 700; color: ${module.color}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Key Insight</div>
                        <div style="font-size: 0.95rem; color: var(--text-main); line-height: 1.5; font-weight: 500;">${lesson.content.keyPoint}</div>
                    </div>
                </div>

                <div style="padding: 20px 15px;">
                    <button onclick="window.startLessonGames()" style="width: 100%; background: ${module.color}; color: white; border: none; padding: 16px; border-radius: 14px; font-size: 1.1rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <span>Test Your Understanding</span>
                        <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: white;"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                    <p style="text-align: center; font-size: 0.85rem; color: var(--text-muted); margin-top: 12px;">${lesson.games?.length || 0} quick games ahead</p>
                </div>
            </div>
        `;
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
            default:
                gameHtml = renderFillBlank(game, module);
        }

        container.innerHTML = `
            <div style="min-height: 100vh; background: #f8fafc; display: flex; flex-direction: column;">
                <div style="padding: 15px 20px; background: white; border-bottom: 1px solid #e5e7eb;">
                    <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 12px;">
                        <button onclick="window.exitLesson()" style="background: none; border: none; padding: 5px; cursor: pointer;">
                            <svg viewBox="0 0 24 24" style="width: 24px; height: 24px; fill: #9ca3af;"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                        </button>
                        <div style="flex: 1; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden;">
                            <div style="height: 100%; width: ${progressPercent}%; background: ${module.color}; transition: width 0.3s;"></div>
                        </div>
                        <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500;">${gameIndex + 1}/${lesson.games.length}</span>
                    </div>
                </div>
                <div style="flex: 1; padding: 20px; display: flex; flex-direction: column;">
                    ${gameHtml}
                </div>
            </div>
        `;

        matchState = { selectedLeft: null, selectedRight: null, matched: [] };
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
                <div style="font-size: 0.9rem; color: ${module.color}; font-weight: 600; margin-bottom: 10px;">SELECT ALL THAT APPLY</div>
                <p style="font-size: 1rem; color: var(--text-main); margin-bottom: 20px;">${game.question}</p>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${shuffled.map(opt => `
                        <button class="tap-all-option" data-correct="${opt.correct}" onclick="window.toggleTapAllOption(this)"
                            style="background: white; border: 2px solid #e5e7eb; border-radius: 12px; padding: 14px 16px; font-size: 0.95rem; color: var(--text-main); cursor: pointer; text-align: left; display: flex; align-items: center; gap: 12px;">
                            <div class="tap-checkbox" style="width: 24px; height: 24px; border: 2px solid #d1d5db; border-radius: 6px; display: flex; align-items: center; justify-content: center;"></div>
                            <span>${opt.text}</span>
                        </button>
                    `).join('')}
                </div>
                <button onclick="window.checkTapAll()" style="margin-top: 25px; background: ${module.color}; color: white; border: none; padding: 14px; border-radius: 12px; font-size: 1rem; font-weight: 600; cursor: pointer;">Check Answer</button>
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

    window.exitLesson = function() {
        if (confirm('Exit this lesson? Your progress won\'t be saved.')) {
            window.openLearningUnit(learningState.currentLesson.unitId);
        }
    };

    function showGameFeedback(isCorrect, explanation = '') {
        // Remove any existing overlay first
        const existing = document.getElementById('game-feedback-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'game-feedback-overlay';
        overlay.style.cssText = `
            position: fixed; bottom: 0; left: 0; right: 0;
            background: ${isCorrect ? '#10b981' : '#ef4444'};
            padding: 25px 20px; border-radius: 20px 20px 0 0;
            z-index: 99999; transform: translateY(100%);
            transition: transform 0.3s ease;
            box-shadow: 0 -4px 20px rgba(0,0,0,0.3);
        `;

        const continueBtn = document.createElement('button');
        continueBtn.innerText = 'Continue';
        continueBtn.style.cssText = `width: 100%; background: white; color: ${isCorrect ? '#10b981' : '#ef4444'}; border: none; padding: 14px; border-radius: 12px; font-size: 1rem; font-weight: 700; cursor: pointer;`;
        continueBtn.addEventListener('click', function() {
            window.continueAfterFeedback();
        });

        overlay.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: ${explanation ? '15px' : '10px'};">
                <div style="width: 50px; height: 50px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: white;">
                    ${isCorrect ? '✓' : '✗'}
                </div>
                <div style="flex: 1;">
                    <div style="font-size: 1.2rem; font-weight: 700; color: white;">${isCorrect ? 'Correct!' : 'Not quite'}</div>
                </div>
            </div>
            ${explanation ? `<p style="color: rgba(255,255,255,0.95); font-size: 0.95rem; line-height: 1.5; margin: 0 0 20px;">${explanation}</p>` : ''}
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

        // Check if already completed
        const isNewLesson = !progress.lessons_completed.includes(lesson.id);
        let xpEarned = 0;

        // Always update local state first
        if (isNewLesson) {
            progress.lessons_completed.push(lesson.id);
            xpEarned += LEARNING_XP.LESSON_COMPLETE; // 1 XP

            // Update daily status
            if (!progress.daily_status.lessons_today) progress.daily_status.lessons_today = 0;
            progress.daily_status.lessons_today++;
            progress.daily_status.lessons_remaining = Math.max(0, 3 - progress.daily_status.lessons_today);
            progress.daily_status.can_learn = progress.daily_status.lessons_remaining > 0;

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

        const result = { xp_earned: xpEarned, is_new_lesson: isNewLesson };
        renderLessonComplete(result, lesson, module);
    }

    function renderLessonComplete(result, lesson, module) {
        const container = document.getElementById('learning-content');
        if (!container) return;

        const scorePercent = learningState.gamesPlayed > 0
            ? Math.round((learningState.gamesCorrect / learningState.gamesPlayed) * 100)
            : 100;

        const xpColor = result?.xp_earned > 0 ? '#10b981' : '#9ca3af';

        container.innerHTML = `
            <div style="min-height: 100vh; background: linear-gradient(180deg, ${module.color} 0%, ${module.color}ee 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; text-align: center;">
                <div style="width: 120px; height: 120px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 30px; box-shadow: 0 8px 32px rgba(0,0,0,0.2); animation: bounceIn 0.6s ease;">
                    <span style="font-size: 60px;">${scorePercent >= 80 ? '🎉' : scorePercent >= 60 ? '👍' : '💪'}</span>
                </div>

                <h1 style="color: white; font-size: 2rem; font-weight: 800; margin: 0 0 8px; text-shadow: 0 2px 10px rgba(0,0,0,0.2);">Lesson Complete!</h1>
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
                    ${result?.is_new_lesson === false ? `
                        <div style="margin-top: 20px; padding: 12px 16px; background: #fef3c7; border-radius: 12px; font-size: 0.85rem; color: #92400e; font-weight: 500;">
                            Already completed - no additional XP
                        </div>
                    ` : ''}
                </div>

                <button onclick="window.openLearningUnit('${lesson.unitId}')" style="margin-top: 30px; background: white; color: ${module.color}; border: none; padding: 16px 40px; border-radius: 30px; font-size: 1.1rem; font-weight: 700; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                    Continue Learning
                </button>
            </div>
        `;
    }

    // =============================================================================
    // EXPOSE TO GLOBAL SCOPE
    // =============================================================================

    window.initLearning = initLearning;
    window.renderLearningHome = renderLearningHome;

})();
