/**
 * Learning Lessons Content
 * All lesson content, games, and questions for the learning system
 */

import { GAME_TYPES } from './learning-config.js';

// =============================================================================
// MIND MODULE - UNIT 1: THE PREDICTION MACHINE
// =============================================================================

const MIND_1_LESSONS = [
  {
    id: 'mind-1-1',
    unitId: 'mind-1',
    order: 1,
    title: "You Don't See Reality",
    content: {
      intro: `Here's something that will change how you see everything: You don't actually perceive the world directly.

Your brain doesn't work like a camera, passively recording what's "out there." Instead, it actively CONSTRUCTS your experience based on predictions.

Right now, your brain is generating a simulation of reality—and checking it against the tiny trickle of sensory data coming in. What you "see" is the simulation, not the raw data.

Here's how limited raw vision actually is: Your eyes only send about 10 megabits per second of data to your brain—less than a basic webcam. Yet you experience rich, detailed, 3D vision. The difference? Your brain fills in about 90% from prediction.

Your retina also has a blind spot where the optic nerve exits—yet you never notice a hole in your vision. That's your brain seamlessly filling gaps with predictions.

This isn't a bug. It's the only way a brain can work fast enough to keep you alive. Waiting for complete sensory data would make you dangerously slow.`,
      keyPoint: "Your experience is a controlled hallucination—a best guess your brain makes about what's causing your sensory signals.",
    },
    games: [
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Your eyes send a complete picture to your brain like a camera.",
        answer: false,
        explanation: "Your eyes send incomplete, compressed signals. Your brain fills in most of what you 'see' from predictions.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Your brain _______ reality rather than passively recording it.",
        options: ['constructs', 'copies', 'ignores', 'delays'],
        answer: 'constructs',
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What does your brain do with sensory input?",
        options: [
          { text: "Records it like a video camera", correct: false },
          { text: "Makes predictions about what's happening", correct: true },
          { text: "Fills in gaps with best guesses", correct: true },
          { text: "Creates a simulation of reality", correct: true },
          { text: "Passes it through unchanged", correct: false },
        ],
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Camera", right: "Passively records" },
          { left: "Brain", right: "Actively constructs" },
          { left: "Your eyes", right: "Send only 10 megabits/sec" },
          { left: "Your experience", right: "90% prediction, 10% data" },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "You walk into a dark room and 'see' a snake on the floor. Your heart races. You turn on the light—it's a rope.",
        question: "What happened?",
        options: [
          { text: "Your eyes made a mistake", correct: false },
          { text: "Your brain predicted 'snake' based on limited data and past experience", correct: true },
          { text: "The lighting was bad", correct: false },
        ],
        explanation: "Your brain made a prediction based on shape, context, and your history. The fear was real because the prediction was real—even though the snake wasn't.",
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Your retina has a blind spot, but your brain fills it in so you never notice.",
        answer: true,
        explanation: "Where your optic nerve exits the eye, there are no light receptors—yet you don't see a hole. Your brain fills the gap with its prediction of what should be there.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "How does perception actually work?",
        items: [
          "Light hits your eyes",
          "Compressed signals travel to brain",
          "Brain generates predictions",
          "Brain compares predictions to signals",
          "You experience the prediction as reality",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Your experience is a 'controlled _______' - a best guess your brain makes.",
        options: ['hallucination', 'recording', 'memory', 'reaction'],
        answer: 'hallucination',
      },
    ],
  },
  {
    id: 'mind-1-2',
    unitId: 'mind-1',
    order: 2,
    title: "Prediction First, Sensation Second",
    content: {
      intro: `Here's what's wild: Your brain generates predictions BEFORE sensory signals even arrive.

Think about that. Your brain isn't waiting to see what happens—it's already guessing. Sensory data from your eyes, ears, and body only matters when it DIFFERS from what your brain predicted.

This is called "predictive processing." Your brain is constantly asking: "Did reality match my prediction?" If yes, carry on. If no, pay attention—something unexpected happened.

Here's a striking example: When you move your eyes, you should see the world blur—but you don't. Your brain predicts the blur and suppresses it before you're aware. This is called "saccadic suppression."

Similarly, you can't tickle yourself because your brain predicts exactly what your own touch will feel like—there's no surprise, so no tickle sensation.

This is why you don't notice the feeling of your clothes until someone mentions it. Your brain predicted that sensation, so it didn't bother telling "you" about it.`,
      keyPoint: "Prediction comes first. Sensation only becomes conscious when it violates prediction.",
    },
    games: [
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Put these in the order they actually happen:",
        items: [
          "Brain generates prediction",
          "Sensory signals arrive",
          "Brain compares prediction to signals",
          "Only differences reach consciousness",
        ],
        correctOrder: [0, 1, 2, 3],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Your brain waits for sensory information before deciding what you're experiencing.",
        answer: false,
        explanation: "Your brain predicts first, then checks. Waiting would be too slow to survive.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Why don't you constantly feel your clothes touching your skin?",
        options: [
          { text: "Your skin goes numb to constant touch", correct: false },
          { text: "Your brain predicts the sensation so it doesn't reach awareness", correct: true },
          { text: "The sensation is too weak to notice", correct: false },
          { text: "Predicted sensations don't need conscious attention", correct: true },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Sensory data only becomes conscious when it _______ the brain's prediction.",
        options: ['violates', 'confirms', 'matches', 'delays'],
        answer: 'violates',
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Prediction matches reality", right: "No conscious awareness needed" },
          { left: "Prediction doesn't match", right: "Pay attention—something's different" },
          { left: "Familiar sound", right: "Brain ignores it" },
          { left: "Unexpected sound", right: "Brain alerts you" },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "You're working at a coffee shop with background music playing. Suddenly you notice the music—it just changed to your favorite song.",
        question: "Why did you suddenly notice the music?",
        options: [
          { text: "The volume increased", correct: false },
          { text: "The change created a prediction error that reached consciousness", correct: true },
          { text: "You decided to pay attention", correct: false },
        ],
        explanation: "Your brain was predicting 'background noise' and filtering it out. The change violated the prediction, creating an error signal that broke through to awareness.",
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Prediction-first processing is slower but more accurate than waiting for data.",
        answer: false,
        explanation: "Prediction-first is FASTER, which is why the brain evolved this way. Speed matters more for survival than perfect accuracy.",
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "You try to tickle yourself but it doesn't work. However, when someone else tickles you with the exact same touch, it's unbearable.",
        question: "Why can't you tickle yourself?",
        options: [
          { text: "Your skin becomes desensitized to your own touch", correct: false },
          { text: "Your brain perfectly predicts your own touch, so there's no surprise", correct: true },
          { text: "Tickling requires social interaction to work", correct: false },
        ],
        explanation: "Tickling requires surprise—a prediction error. When you touch yourself, your brain predicts exactly what it will feel like. No prediction error, no tickle.",
      },
    ],
  },
  {
    id: 'mind-1-3',
    unitId: 'mind-1',
    order: 3,
    title: "Prediction Errors = Learning",
    content: {
      intro: `When reality doesn't match your brain's prediction, that mismatch is called a "prediction error."

Prediction errors are the ONLY way your brain updates its model of the world. No prediction error = no learning. Your brain assumes its model is correct until proven otherwise.

Your brain has a dedicated chemical messenger for this: dopamine. Contrary to popular belief, dopamine isn't about pleasure—it signals prediction errors. When something is BETTER than expected, dopamine spikes. When something is worse than expected, dopamine drops. Expected rewards? Flat dopamine.

This is why the same reward feels less exciting over time—your brain predicted it, so no dopamine spike. It's also why unpredictable rewards (like gambling or social media) are so compelling—each unpredicted win creates a dopamine surge.

For fitness and habit-building, this means: Novel experiences, unexpected outcomes, things that violate your expectations—these create prediction errors that force your brain to update. Doing the same thing the same way stops teaching you anything. No surprise, no error, no update.`,
      keyPoint: "Learning IS prediction error. Your brain only updates when reality surprises it.",
    },
    games: [
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Prediction matches reality", right: "No learning occurs" },
          { left: "Prediction error", right: "Brain updates its model" },
          { left: "Novel experience", right: "Large prediction error" },
          { left: "Routine habit", right: "Minimal prediction error" },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "You've done the same workout routine for 6 months. It used to feel challenging, but now it feels automatic.",
        question: "From a predictive brain perspective, why has adaptation stalled?",
        options: [
          { text: "Your muscles are fully developed", correct: false },
          { text: "Your brain predicts everything perfectly—no prediction error, no signal to adapt", correct: true },
          { text: "You need more protein", correct: false },
        ],
        explanation: "When your brain can perfectly predict an experience, there's no error signal to drive adaptation. Progressive overload works because it creates prediction errors.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Your brain only updates its model when there's a prediction _______.",
        options: ['error', 'success', 'delay', 'memory'],
        answer: 'error',
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Doing the same thing the same way keeps teaching your brain new things.",
        answer: false,
        explanation: "Without surprise or novelty, there's no prediction error—and without prediction error, there's no learning or adaptation.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What creates prediction errors that drive learning?",
        options: [
          { text: "Novel experiences", correct: true },
          { text: "Routine repetition", correct: false },
          { text: "Unexpected outcomes", correct: true },
          { text: "Increasing challenge", correct: true },
          { text: "Doing the familiar", correct: false },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "How does learning actually happen?",
        items: [
          "You experience something new or unexpected",
          "Reality doesn't match your brain's prediction",
          "A prediction error signal is generated",
          "Your brain updates its model",
          "Future predictions are more accurate",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "A child touches a hot stove and gets burned. They never touch it again.",
        question: "Why was this one experience so effective for learning?",
        options: [
          { text: "The child has a good memory", correct: false },
          { text: "The massive prediction error (expecting neutral, getting pain) created a strong update", correct: true },
          { text: "Their parents warned them afterwards", correct: false },
        ],
        explanation: "The larger the prediction error, the stronger the update. This painful surprise created a huge mismatch between expectation and reality, ensuring rapid learning.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What is dopamine's actual role in the brain?",
        options: [
          { text: "Creating feelings of pleasure", correct: false },
          { text: "Signaling prediction errors", correct: true },
          { text: "Spiking when something is better than expected", correct: true },
          { text: "Dropping when something is worse than expected", correct: true },
          { text: "Staying flat for expected rewards", correct: true },
        ],
      },
    ],
  },
  {
    id: 'mind-1-4',
    unitId: 'mind-1',
    order: 4,
    title: "Your Past Creates Your Present",
    content: {
      intro: `Every prediction your brain makes is based on your entire history of experience.

When you look at a face, your brain draws on every face you've ever seen. When you feel anxious, your brain is referencing every past moment that felt similar. When you attempt a lift, your brain predicts the outcome based on every previous attempt.

This is why people who grew up in chaotic environments often perceive threat where others see neutrality. Their brains were trained on different data. It's not pessimism—it's accurate prediction based on their history.

Research shows that your brain doesn't store "objective" memories. Each memory is reconstructed using current predictions. This means your memories themselves change based on who you've become. You remember the past through the lens of the present, just as you perceive the present through the lens of the past.

Two people in identical situations will have completely different experiences because their brains make different predictions. Your history isn't just memory—it's the lens through which you perceive everything happening right now.`,
      keyPoint: "You don't experience the present moment directly—you experience it filtered through every moment that came before.",
    },
    games: [
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Two people can have the same experience if they're in the same situation.",
        answer: false,
        explanation: "Experience is constructed from predictions, and predictions come from personal history. Same situation, different histories, different experiences.",
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Two people hear a dog bark loudly. One person smiles. The other person's heart races with fear.",
        question: "What explains the different reactions?",
        options: [
          { text: "One person has better hearing", correct: false },
          { text: "Their brains made different predictions based on different histories with dogs", correct: true },
          { text: "One person is braver than the other", correct: false },
        ],
        explanation: "The person who was bitten as a child has a brain that predicts 'danger' from barking. The person who grew up with friendly dogs predicts 'excitement.' Same sound, different realities.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Your brain uses your _______ to predict your present experience.",
        options: ['history', 'logic', 'desires', 'senses'],
        answer: 'history',
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Looking at a face", right: "Brain references every face you've seen" },
          { left: "Feeling anxious", right: "Brain recalls similar past moments" },
          { left: "Attempting a lift", right: "Brain predicts based on previous attempts" },
          { left: "Same situation, different people", right: "Completely different experiences" },
        ],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What shapes your brain's predictions about the present moment?",
        options: [
          { text: "Every relevant experience you've ever had", correct: true },
          { text: "Only logical reasoning", correct: false },
          { text: "Your emotional memories", correct: true },
          { text: "Previous similar situations", correct: true },
          { text: "Only conscious memories", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Your memories are stored like files, unchanged from when they happened.",
        answer: false,
        explanation: "Memories are reconstructed each time using your current predictions. This is why memories change over time—you remember the past through who you are now.",
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Someone who had a terrible gym experience in high school walks into a gym as an adult. They immediately feel anxious and want to leave—even though nothing bad is happening.",
        question: "What's causing this reaction?",
        options: [
          { text: "They don't actually want to get fit", correct: false },
          { text: "Their brain is predicting the present through the lens of past gym experiences", correct: true },
          { text: "Gyms are inherently stressful places", correct: false },
        ],
        explanation: "The adult brain is using teenage data to predict the current experience. The past is literally creating the present feeling—even though the current gym is completely different.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "How does past experience shape present perception?",
        items: [
          "You encounter a situation",
          "Brain searches for similar past experiences",
          "Predictions are generated based on that history",
          "Your experience is constructed from those predictions",
          "You perceive the present through your past",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
    ],
  },
  {
    id: 'mind-1-5',
    unitId: 'mind-1',
    order: 5,
    title: "The Bayesian Brain",
    content: {
      intro: `Your brain is essentially a probability calculator running millions of predictions simultaneously.

For every moment, your brain asks: "Given everything I've ever experienced, what is MOST LIKELY to be happening right now?" Then it constructs that most-likely-scenario as your experience.

This is called Bayesian inference—updating beliefs based on evidence. Strong priors (lots of past experience) are hard to override. Weak priors (little experience) update easily.

Think of it mathematically: If you have 1,000 experiences of being "not athletic" and 1 experience of completing a workout, your brain calculates roughly 0.1% probability that you're athletic. Even after 50 good workouts, you're only at about 5%. Real change requires hundreds of new data points—which is why consistency over time is the only path to transformation.

This also explains why early wins are so important: At the beginning, each new experience represents a larger percentage shift. Going from 0 to 10 good workouts changes more than going from 490 to 500.

This is why first impressions matter so much, why habits are hard to break, and why transformation requires consistent new evidence over time.`,
      keyPoint: "Your brain calculates probabilities constantly. Strong beliefs require strong, repeated evidence to change.",
    },
    games: [
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Strong prior belief", right: "Hard to change with new evidence" },
          { left: "Weak prior belief", right: "Updates easily" },
          { left: "Consistent new evidence", right: "Gradually shifts strong beliefs" },
          { left: "One-time experience", right: "Barely moves strong beliefs" },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "You've believed 'I'm not athletic' for 20 years. You complete one great workout.",
        question: "What happens to your self-belief?",
        options: [
          { text: "It completely changes—you now see yourself as athletic", correct: false },
          { text: "It shifts slightly, but one workout barely moves a 20-year belief", correct: true },
          { text: "Nothing changes because beliefs are fixed", correct: false },
        ],
        explanation: "One piece of evidence against a strong prior barely registers. This is why transformation requires consistent, repeated experiences over time—you're slowly shifting a probability distribution.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "How does a strong belief actually change?",
        items: [
          "New experience contradicts old belief",
          "Small prediction error occurs",
          "Repeated experiences accumulate",
          "Prior belief gradually weakens",
          "New belief becomes the stronger prediction",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Your brain calculates _______ constantly based on past experience.",
        options: ['probabilities', 'emotions', 'facts', 'decisions'],
        answer: 'probabilities',
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "First impressions are easy to change with new information.",
        answer: false,
        explanation: "First impressions become strong priors. Once formed, they require substantial contradictory evidence to shift.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Why is transformation hard according to the Bayesian brain?",
        options: [
          { text: "Strong beliefs require lots of evidence to shift", correct: true },
          { text: "People are inherently lazy", correct: false },
          { text: "One-time experiences barely register against years of data", correct: true },
          { text: "The brain resists change to stay consistent", correct: true },
          { text: "Change is physically impossible", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Person A is starting fresh with fitness (no history). Person B has been exercising consistently for 10 years. Both complete 10 workouts this month.",
        question: "Whose brain changes MORE from these 10 workouts?",
        options: [
          { text: "Person B—they're more experienced so it 'counts' more", correct: false },
          { text: "Person A—each workout is a larger percentage shift from their baseline", correct: true },
          { text: "Same effect—10 workouts is 10 workouts", correct: false },
        ],
        explanation: "For Person A, 10 workouts might represent 100% of their history. For Person B, it's just 1% of their 1,000+ workout history. Early wins shift beliefs faster.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Strong beliefs require strong, _______ evidence to change.",
        options: ['repeated', 'logical', 'emotional', 'sudden'],
        answer: 'repeated',
      },
    ],
  },
];

// =============================================================================
// MIND MODULE - UNIT 2: BODY BUDGETING (ALLOSTASIS)
// =============================================================================

const MIND_2_LESSONS = [
  {
    id: 'mind-2-1',
    unitId: 'mind-2',
    order: 1,
    title: "Beyond Homeostasis",
    content: {
      intro: `You've probably heard of homeostasis—the idea that your body maintains balance by reacting to changes.

But here's what's more accurate: Your brain doesn't just react. It PREDICTS what you'll need and prepares in advance. This is called allostasis.

Before you wake up, cortisol rises to prepare you. Before you eat, insulin starts releasing. Before you exercise, your heart rate begins increasing.

Your brain is always running a simulation of the near future and adjusting your body ahead of time. Reaction would be too slow.`,
      keyPoint: "Your brain doesn't wait for problems—it predicts what's coming and prepares your body in advance.",
    },
    games: [
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Homeostasis", right: "Reacting to restore balance" },
          { left: "Allostasis", right: "Predicting and preparing in advance" },
          { left: "Cortisol before waking", right: "Example of allostasis" },
          { left: "Sweating when hot", right: "Example of homeostasis" },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Your body waits until you start exercising to increase heart rate.",
        answer: false,
        explanation: "Your brain predicts exercise is coming and begins cardiovascular changes before you take the first step.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Allostasis means your brain _______ what your body will need.",
        options: ['predicts', 'ignores', 'copies', 'forgets'],
        answer: 'predicts',
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Which are examples of allostasis (preparing in advance)?",
        options: [
          { text: "Cortisol rising before you wake", correct: true },
          { text: "Insulin releasing before you eat", correct: true },
          { text: "Sweating after getting hot", correct: false },
          { text: "Heart rate rising before exercise", correct: true },
          { text: "Shivering when cold", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "You're about to give a presentation. Before you even stand up, your heart is racing and your palms are sweating.",
        question: "What's happening?",
        options: [
          { text: "You have an anxiety disorder", correct: false },
          { text: "Your brain predicted 'challenge ahead' and prepared your body in advance", correct: true },
          { text: "The room is too hot", correct: false },
        ],
        explanation: "Your brain ran a simulation of the upcoming presentation and prepared your body for high performance BEFORE the event. That's allostasis at work.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "How does allostatic preparation work?",
        items: [
          "Brain detects cues about upcoming event",
          "Brain predicts what resources will be needed",
          "Body begins preparing in advance",
          "Resources are ready when needed",
          "Performance is optimized",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Reacting quickly is good enough for survival.",
        answer: false,
        explanation: "Reaction would be too slow in many situations. Predicting and preparing in advance gives your body a crucial head start.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Your brain is always running a _______ of the near future.",
        options: ['simulation', 'recording', 'memory', 'copy'],
        answer: 'simulation',
      },
    ],
  },
  {
    id: 'mind-2-2',
    unitId: 'mind-2',
    order: 2,
    title: "The Body Budget",
    content: {
      intro: `Your brain runs your body like a bank account. Neuroscientist Lisa Feldman Barrett calls this your "body budget."

Deposits: Sleep, food, water, rest, positive social connection, completing goals, time in nature, laughter.

Withdrawals: Physical activity, stress, illness, conflict, uncertainty, intense thinking, social media scrolling, decision-making.

Your brain is constantly predicting the balance. Will you have enough resources? Do you need to conserve? Can you afford this activity?

Here's what's powerful: Your brain doesn't wait for the balance to hit zero. It predicts ahead. If it calculates you can't afford tomorrow's workout, it makes you feel unmotivated TODAY—to prevent the overdraft.

Many feelings that seem psychological—motivation, fatigue, mood, cravings—are actually your brain's predictions about your body budget. That afternoon slump? Often a predicted energy dip. That craving for junk food? Your brain predicting an energy deficit and demanding quick fuel.

Understanding this gives you power: You can make deposits strategically to afford the activities that matter most.`,
      keyPoint: "Your brain tracks energy like a budget. Feelings often reflect predicted deposits and withdrawals.",
    },
    games: [
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Which are 'deposits' to your body budget?",
        options: [
          { text: "Quality sleep", correct: true },
          { text: "Skipping meals", correct: false },
          { text: "Nutritious food", correct: true },
          { text: "Chronic stress", correct: false },
          { text: "Positive social time", correct: true },
          { text: "Completing a goal", correct: true },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "After a week of poor sleep, skipped meals, and work stress, you feel completely unmotivated to exercise.",
        question: "What's happening in body budget terms?",
        options: [
          { text: "You're being lazy", correct: false },
          { text: "Your brain predicts you can't afford the withdrawal—motivation drops to protect resources", correct: true },
          { text: "Exercise doesn't work for you", correct: false },
        ],
        explanation: "Lack of motivation is often your brain's prediction that you're in energy deficit. It's not laziness—it's resource protection.",
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Motivation is purely psychological and unrelated to physical energy.",
        answer: false,
        explanation: "Motivation is deeply tied to your brain's prediction of your body budget. Low predicted resources = low motivation.",
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Good night's sleep", right: "Major deposit" },
          { left: "Work deadline stress", right: "Withdrawal" },
          { left: "Positive social time", right: "Deposit" },
          { left: "Decision fatigue", right: "Withdrawal" },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Your brain predicts energy needs _______ so you feel unmotivated before you're depleted.",
        options: ['ahead', 'after', 'never', 'randomly'],
        answer: 'ahead',
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "How does the body budget affect your workout motivation?",
        items: [
          "Brain tracks recent deposits and withdrawals",
          "Brain predicts tomorrow's available energy",
          "Prediction shows potential deficit",
          "Motivation decreases to prevent overdraft",
          "You feel 'not in the mood' to exercise",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Which are 'withdrawals' from your body budget?",
        options: [
          { text: "Scrolling social media", correct: true },
          { text: "Restorative sleep", correct: false },
          { text: "Making many decisions", correct: true },
          { text: "Time in nature", correct: false },
          { text: "Conflict with others", correct: true },
          { text: "Completing a meaningful goal", correct: false },
        ],
      },
    ],
  },
  {
    id: 'mind-2-3',
    unitId: 'mind-2',
    order: 3,
    title: "Feelings Are Predictions",
    content: {
      intro: `Here's something profound: Hunger isn't a direct readout of your stomach. Fatigue isn't a direct measure of muscle depletion. Even emotions aren't direct responses to events.

These are all PREDICTIONS your brain makes about your body's state.

Your brain asks: "Given the time of day, what I've eaten, and my history—I probably need food soon." That prediction becomes the feeling of hunger.

This is why you can feel hungry at your usual lunchtime even if you ate late breakfast. Your brain predicted hunger based on the clock, not your actual stomach. It's also why jet lag messes with appetite—your body clock predictions are wrong.

Even more surprising: Research shows that people can't reliably tell the difference between hunger and thirst, or between anxiety and excitement. The body sensations are nearly identical—your brain just predicts different causes.

This is both humbling and empowering. Your feelings are real, but they're interpretations, not facts. You can learn to reinterpret them.`,
      keyPoint: "Feelings like hunger, fatigue, and even emotions are predictions about your body—not direct measurements.",
    },
    games: [
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Which feelings are predictions (not direct sensations)?",
        options: [
          { text: "Hunger", correct: true },
          { text: "Fatigue", correct: true },
          { text: "Anxiety", correct: true },
          { text: "Motivation", correct: true },
          { text: "All of these", correct: true },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "It's 12:30pm and you feel very hungry. But you realize you actually ate a huge breakfast just 2 hours ago.",
        question: "Why do you feel hungry?",
        options: [
          { text: "Your metabolism is very fast", correct: false },
          { text: "Your brain predicted hunger based on clock time and habit, not actual stomach state", correct: true },
          { text: "The breakfast wasn't nutritious enough", correct: false },
        ],
        explanation: "Hunger is a prediction based on patterns. Your brain expected you to need food at 12:30 because you usually eat then.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Feelings are your brain's _______ about your body's state.",
        options: ['predictions', 'recordings', 'memories', 'mistakes'],
        answer: 'predictions',
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "People can reliably tell the difference between hunger and thirst.",
        answer: false,
        explanation: "Research shows people often confuse hunger and thirst because the body sensations are similar. The brain predicts the cause based on context.",
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Racing heart + job interview", right: "Brain predicts 'anxiety'" },
          { left: "Racing heart + roller coaster", right: "Brain predicts 'excitement'" },
          { left: "Stomach discomfort + noon", right: "Brain predicts 'hunger'" },
          { left: "Stomach discomfort + conflict", right: "Brain predicts 'nervousness'" },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "You're about to give a presentation. Your heart is racing and your palms are sweaty. You can interpret this as anxiety or as excitement.",
        question: "What does research show about reinterpreting feelings?",
        options: [
          { text: "It doesn't work—feelings are fixed", correct: false },
          { text: "People who reframe anxiety as excitement actually perform better", correct: true },
          { text: "You should always suppress negative feelings", correct: false },
        ],
        explanation: "The body sensations of anxiety and excitement are nearly identical. Studies show that reframing 'I'm anxious' as 'I'm excited' actually improves performance.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "How does a feeling get created?",
        items: [
          "Body sends general signals (heart rate, gut sensations)",
          "Brain receives signals with no inherent meaning",
          "Brain considers context (time, location, recent events)",
          "Brain predicts most likely cause",
          "You experience the prediction as a specific feeling",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Jet lag disrupts appetite because your body clock predictions are wrong.",
        answer: true,
        explanation: "Your brain predicts hunger based on time cues. In a new timezone, the clock says noon but your body thinks it's midnight—the hunger prediction misfires.",
      },
    ],
  },
  {
    id: 'mind-2-4',
    unitId: 'mind-2',
    order: 4,
    title: "Why You Feel Tired Before You're Tired",
    content: {
      intro: `Your brain doesn't wait until you're actually depleted to make you feel tired. That would be dangerous.

Instead, it PREDICTS depletion and creates fatigue in advance to make you slow down. Fatigue is a prediction, not a measurement.

Here's the proof: Studies show marathon runners' "wall" happens at different points depending on whether they know the course distance. When told they're running further, they slow down earlier—even though their bodies are identical. The "wall" is a prediction, not a physical limit.

Similarly, athletes given fake performance feedback push harder or fade earlier based on what they're told, not their actual physiology. Your brain sets limits based on what it predicts will be safe.

This is why fatigue often lifts when something exciting happens—your brain reassesses and decides you can afford more output. It's also why fatigue feels worse when you're dreading an activity—your brain predicts higher cost.

Elite athletes know this: The feeling of "I can't go on" is almost never true. It's a protective prediction with a safety margin built in.`,
      keyPoint: "Fatigue is a protective prediction, not a fuel gauge. Your brain makes you feel tired before you're actually depleted.",
    },
    games: [
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Feeling tired means your body has run out of energy.",
        answer: false,
        explanation: "Fatigue is a prediction designed to make you stop BEFORE depletion. You almost always have more capacity than fatigue suggests.",
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "You're exhausted on the couch, barely able to move. Then a friend calls with exciting news and invites you out. Suddenly you have energy.",
        question: "What happened to your fatigue?",
        options: [
          { text: "You were faking being tired", correct: false },
          { text: "Your brain reassessed the body budget—predicted benefits now outweigh costs", correct: true },
          { text: "The phone call gave you calories", correct: false },
        ],
        explanation: "Your brain recalculated. The exciting opportunity changed the cost-benefit prediction, and fatigue lifted because it was never about actual depletion.",
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Dreading a workout", right: "Brain predicts higher cost, more fatigue" },
          { left: "Exciting opportunity", right: "Brain predicts benefit, fatigue lifts" },
          { left: "'I can't go on'", right: "Protective prediction, rarely true" },
          { left: "Elite athlete mindset", right: "Knows fatigue is negotiable" },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Fatigue is a protective _______, not a fuel gauge.",
        options: ['prediction', 'reflex', 'measurement', 'weakness'],
        answer: 'prediction',
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What can change your fatigue level without changing your actual physical state?",
        options: [
          { text: "Learning the workout is almost done", correct: true },
          { text: "Receiving exciting news", correct: true },
          { text: "Being told you're performing well", correct: true },
          { text: "Drinking actual caffeine", correct: false },
          { text: "Music that pumps you up", correct: true },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "How does fatigue work as a protective mechanism?",
        items: [
          "Brain monitors current energy expenditure",
          "Brain predicts future energy needs",
          "Brain calculates safety margin",
          "Fatigue signal generated to slow you down",
          "You feel tired before true depletion",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Marathon runners told they're running 26.2 miles hit 'the wall' around mile 20. But when secretly told the course is 30 miles, they hit the wall later.",
        question: "What does this reveal about fatigue?",
        options: [
          { text: "The wall is a fixed physical limit", correct: false },
          { text: "Fatigue is predicted based on expected distance—the brain paces you", correct: true },
          { text: "Longer courses build more endurance", correct: false },
        ],
        explanation: "The brain sets fatigue timing based on predicted total effort. Same body, different expectations, different fatigue timing. It's a prediction, not a measurement.",
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Elite athletes never feel fatigue during competition.",
        answer: false,
        explanation: "Elite athletes feel fatigue but understand it's a prediction with a safety margin. They've learned to push past the initial signal when appropriate.",
      },
    ],
  },
  {
    id: 'mind-2-5',
    unitId: 'mind-2',
    order: 5,
    title: "Stress Is a Prediction",
    content: {
      intro: `Cortisol—the "stress hormone"—doesn't rise because something bad happened. It rises because your brain PREDICTS you'll need resources.

Your brain asks: "Based on what's happening and my history, will I need extra energy, focus, or alertness?" If yes, cortisol rises to make resources available.

This is why you can feel stressed about something that hasn't happened yet. Your brain is predicting a future demand and preparing. Sunday night anxiety about Monday morning? That's your brain mobilizing stress resources for a predicted challenge.

Here's the key insight: Cortisol itself isn't bad. It's designed to be a short-term boost—like a credit card for energy. The problem is when your brain predicts constant threat and keeps the "card" permanently charged.

Chronic stress is often a prediction loop: Your brain expects to need stress resources, so it releases cortisol, which becomes the new baseline, which it predicts will continue. Breaking the loop requires new experiences that teach your brain safety.

Interestingly, the body response to stress and excitement is nearly identical. The difference is your brain's prediction: "This is a threat" vs "This is a challenge I can handle."`,
      keyPoint: "Stress is preparation for predicted demands—your brain mobilizing resources for what it thinks is coming.",
    },
    games: [
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Cortisol rises because your brain _______ you'll need extra resources.",
        options: ['predicts', 'knows', 'remembers', 'doubts'],
        answer: 'predicts',
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "You can only feel stressed about things currently happening.",
        answer: false,
        explanation: "Stress is a prediction about future demands. You can feel stressed about things that haven't happened—and may never happen.",
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "You have a difficult presentation next week. Even though nothing bad is happening right now, you feel anxious and can't sleep.",
        question: "Why is your body in stress mode?",
        options: [
          { text: "There's something wrong with your nervous system", correct: false },
          { text: "Your brain is predicting future demand and mobilizing resources now", correct: true },
          { text: "Presentations are inherently dangerous", correct: false },
        ],
        explanation: "Your brain is running a simulation of next week and preparing as if the threat is now. This is useful short-term but costly if it continues.",
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Acute stress response", right: "Helpful energy boost for challenges" },
          { left: "Chronic stress", right: "Harmful prediction loop" },
          { left: "Sunday night anxiety", right: "Brain predicting Monday's demands" },
          { left: "Cortisol", right: "Like a credit card for energy" },
        ],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What can help break a chronic stress prediction loop?",
        options: [
          { text: "New experiences of safety and calm", correct: true },
          { text: "Just thinking positive thoughts", correct: false },
          { text: "Regular relaxation practices", correct: true },
          { text: "Avoiding all stressful situations", correct: false },
          { text: "Building evidence that you can handle challenges", correct: true },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "How does a chronic stress loop form?",
        items: [
          "Brain predicts ongoing threat",
          "Cortisol released to prepare for threat",
          "High cortisol becomes the new baseline",
          "Brain predicts more stress will be needed",
          "Loop reinforces itself",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Cortisol is always harmful to your body.",
        answer: false,
        explanation: "Cortisol is designed to be a helpful short-term boost. It only becomes harmful when chronically elevated due to constant threat predictions.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "The body's response to stress and excitement is nearly _______—the difference is the brain's interpretation.",
        options: ['identical', 'opposite', 'unrelated', 'random'],
        answer: 'identical',
      },
    ],
  },
];

// =============================================================================
// MIND MODULE - UNIT 3: EXPERIENCE SHAPES REALITY
// =============================================================================

const MIND_3_LESSONS = [
  {
    id: 'mind-3-1',
    unitId: 'mind-3',
    order: 1,
    title: "Your Brain as a Time Machine",
    content: {
      intro: `Your brain has one job: keep you alive and well by predicting what's coming next. To do this, it has only one source of data—your past.

Every prediction is essentially your brain asking: "What happened before when things looked/felt/sounded like this?"

Your brain is constantly traveling backward in time to predict forward. Amazingly, neuroscience shows that the same brain regions activate whether you're remembering the past or imagining the future. Your brain literally uses memory systems to simulate what hasn't happened yet.

This is why trauma can feel so present—similar cues trigger the brain to predict the past will repeat. A smell, a sound, a body position can transport someone back to a traumatic moment because the brain is predicting that past will happen again.

It's also why positive experiences matter so much: They give your brain better data for better predictions. Want to be confident in the gym? You need gym experiences where things went well. Want to feel safe trying new foods? You need positive food exploration experiences.

Your brain can only predict from what it's experienced. New experiences literally expand what futures your brain can imagine.`,
      keyPoint: "Your brain uses the past to simulate the future. It can only predict from what it's experienced.",
    },
    games: [
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "To predict the future, your brain uses data from your _______.",
        options: ['past', 'imagination', 'logic', 'instincts'],
        answer: 'past',
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Someone who was in a car accident feels intense fear when they hear brakes screech—even years later in a completely safe situation.",
        question: "What's happening?",
        options: [
          { text: "They're overreacting", correct: false },
          { text: "Their brain predicts 'crash' based on past experience, triggering a real fear response", correct: true },
          { text: "They never fully healed from the accident", correct: false },
        ],
        explanation: "The sound triggers a prediction based on past experience. The fear is real—it's the brain protecting based on its history.",
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Trauma responses are overreactions that people should control.",
        answer: false,
        explanation: "Trauma responses are predictions based on real past experience. The brain is doing exactly what it's designed to do—predict danger from similar cues.",
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Remembering the past", right: "Uses memory brain regions" },
          { left: "Imagining the future", right: "Uses same memory brain regions" },
          { left: "Trauma flashback", right: "Brain predicting past will repeat" },
          { left: "New positive experiences", right: "Better data for predictions" },
        ],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What can trigger a trauma response?",
        options: [
          { text: "A smell similar to the traumatic event", correct: true },
          { text: "A sound similar to the traumatic event", correct: true },
          { text: "A body position similar to the traumatic event", correct: true },
          { text: "Logical reminders that the event is over", correct: false },
          { text: "Being in a similar location", correct: true },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "How does your brain use the past to predict the future?",
        items: [
          "Current situation provides sensory cues",
          "Brain searches for similar past experiences",
          "Brain retrieves relevant memories",
          "Brain uses memories to simulate possible futures",
          "Most likely outcome becomes your prediction/expectation",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Someone has never had a positive gym experience. They try to visualize themselves succeeding at the gym, but it feels fake and doesn't help.",
        question: "Why doesn't pure visualization work here?",
        options: [
          { text: "They're not trying hard enough", correct: false },
          { text: "Their brain has no positive gym data to construct the simulation from", correct: true },
          { text: "Visualization is pseudoscience", correct: false },
        ],
        explanation: "The brain builds future simulations from past experiences. With no positive gym experiences, there's no data to create a believable positive prediction. Real experiences must come first.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "New experiences literally expand what _______ your brain can imagine.",
        options: ['futures', 'memories', 'feelings', 'problems'],
        answer: 'futures',
      },
    ],
  },
  {
    id: 'mind-3-2',
    unitId: 'mind-3',
    order: 2,
    title: "Concepts Are Predictions",
    content: {
      intro: `When you see a "chair," you're not just seeing shapes and colors. You're seeing a prediction: "This thing affords sitting."

Every object, person, and situation you encounter is experienced through the predictions your brain makes about it. "Chair" means "I can sit." "Food" means "I can eat this and gain energy." "Gym" means... whatever your brain predicts from past gym experiences.

This is called "affordance"—what an object or situation affords you based on your history. A ladder affords climbing to someone who's climbed before. To a toddler who's never used one, it might just afford "touching" or "dangerous."

If your past gym experiences were uncomfortable, your brain predicts discomfort. If they were empowering, your brain predicts empowerment. Same gym, same equipment—completely different experiences based on different prediction histories.

This extends to concepts like "healthy food," "exercise," "diet," and "self-care." These words trigger predictions based on YOUR history, not their dictionary definitions. For someone with disordered eating history, "diet" might predict restriction and failure. For someone else, it might predict control and progress.

You don't see the world—you see your predictions about the world. Changing what things "mean" to you requires changing your experiences with them.`,
      keyPoint: "You don't perceive objects directly. You perceive what your brain predicts they mean and afford.",
    },
    games: [
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Seeing a 'chair'", right: "Predicting something to sit on" },
          { left: "Seeing 'food'", right: "Predicting energy source" },
          { left: "Seeing 'gym' (negative history)", right: "Predicting discomfort" },
          { left: "Seeing 'gym' (positive history)", right: "Predicting empowerment" },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Concepts are _______ about what things mean and what you can do with them.",
        options: ['predictions', 'facts', 'opinions', 'labels'],
        answer: 'predictions',
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Two people look at a barbell. One sees an opportunity for growth. The other sees potential injury and embarrassment.",
        question: "Why do they see the same object so differently?",
        options: [
          { text: "One person is more optimistic by nature", correct: false },
          { text: "Their brains make different predictions based on different histories with weights", correct: true },
          { text: "One person knows more about fitness", correct: false },
        ],
        explanation: "The barbell is the same. The predictions are different because the histories are different. This is why creating positive experiences matters—they change future predictions.",
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "The word 'diet' means the same thing to everyone.",
        answer: false,
        explanation: "Words trigger predictions based on personal history. 'Diet' might predict restriction and failure for one person, structure and progress for another.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What determines what an object 'affords' you?",
        options: [
          { text: "Your past experiences with similar objects", correct: true },
          { text: "The dictionary definition of the object", correct: false },
          { text: "What others have told you about it", correct: true },
          { text: "Your current physical capabilities", correct: true },
          { text: "The object's objective properties only", correct: false },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "How do concepts change their meaning for you?",
        items: [
          "You have negative experiences with something (e.g., 'gym')",
          "Brain predicts negativity when encountering that concept",
          "You deliberately create new positive experiences",
          "Brain accumulates new prediction data",
          "The concept's meaning gradually shifts",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Ladder to experienced climber", right: "Affords climbing" },
          { left: "Ladder to toddler", right: "Affords danger" },
          { left: "'Exercise' to athlete", right: "Predicts empowerment" },
          { left: "'Exercise' to bullied kid", right: "Predicts humiliation" },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Changing what things 'mean' to you requires changing your _______ with them.",
        options: ['experiences', 'thoughts', 'beliefs', 'knowledge'],
        answer: 'experiences',
      },
    ],
  },
  {
    id: 'mind-3-3',
    unitId: 'mind-3',
    order: 3,
    title: "Pain Is a Prediction",
    content: {
      intro: `Pain is not a direct signal from your tissues. If it were, the same injury would always produce the same pain. But it doesn't.

The same physical damage can produce wildly different pain depending on context, expectation, and past experience. Soldiers in battle often don't notice severe injuries until later. People in brain studies feel real pain from completely fake stimuli (nocebo effect).

Here's striking evidence: Studies show that simply SEEING your injured body part makes pain worse. And patients feel less pain when they can't see the needle during injections. Vision changes pain because it changes prediction.

Your brain constructs pain based on how dangerous it PREDICTS the situation to be. This is why stress increases pain, why distraction reduces it, and why chronic pain can persist long after tissues heal.

This doesn't mean pain is "fake" or "in your head" in a dismissive sense. Pain is real—it's just that its intensity is determined by prediction, not just tissue state. Understanding this gives you tools: Reducing threat predictions (through understanding, relaxation, positive experiences) can genuinely reduce pain.`,
      keyPoint: "Pain is constructed by the brain based on predicted danger—not a direct readout of tissue damage.",
    },
    games: [
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "The same injury always produces the same amount of pain.",
        answer: false,
        explanation: "Pain depends on predicted danger, not just tissue damage. Context, stress, and past experience all change pain levels.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What can increase pain from the same physical cause?",
        options: [
          { text: "Believing the injury is serious", correct: true },
          { text: "Being stressed or anxious", correct: true },
          { text: "Having chronic pain history", correct: true },
          { text: "Focusing attention on the pain", correct: true },
          { text: "The actual tissue damage", correct: true },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "A person's back pain persists for years after their injury has fully healed according to scans.",
        question: "What's happening?",
        options: [
          { text: "The scans are wrong", correct: false },
          { text: "Their brain still predicts danger and constructs pain to protect them", correct: true },
          { text: "They're imagining the pain", correct: false },
        ],
        explanation: "The pain is real, but it's being generated by prediction, not current tissue damage. The brain learned that this area is 'dangerous' and keeps constructing pain as protection.",
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Soldier in battle with wound", right: "Often feels no pain until safe" },
          { left: "Watching a needle enter arm", right: "Increases pain perception" },
          { left: "Nocebo effect", right: "Fake treatment causes real pain" },
          { left: "Distraction during procedure", right: "Reduces pain perception" },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Pain is real, but its intensity is determined by _______, not just tissue state.",
        options: ['prediction', 'weakness', 'imagination', 'nerves'],
        answer: 'prediction',
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "How can chronic pain persist after healing?",
        items: [
          "Original injury causes pain",
          "Brain learns to predict danger in that area",
          "Tissue heals completely",
          "Brain continues predicting danger",
          "Pain persists despite healed tissue",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What can reduce pain by changing threat predictions?",
        options: [
          { text: "Understanding that pain is constructed by the brain", correct: true },
          { text: "Relaxation techniques", correct: true },
          { text: "Ignoring pain completely", correct: false },
          { text: "Positive movement experiences", correct: true },
          { text: "Reducing stress", correct: true },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "If pain is predicted by the brain, that means it's not real.",
        answer: false,
        explanation: "Pain is absolutely real—you genuinely feel it. But understanding that it's constructed by prediction, not just tissue damage, gives you tools to influence it.",
      },
    ],
  },
  {
    id: 'mind-3-4',
    unitId: 'mind-3',
    order: 4,
    title: "The Placebo Effect Is Real",
    content: {
      intro: `Placebos aren't fake medicine that fools stupid people. They reveal something profound about how your brain works.

When you believe a treatment will help, your brain predicts improvement. That prediction literally changes your physiology—releasing natural painkillers (endorphins), reducing inflammation, altering immune function.

Here's how powerful this is: Placebo pills can be more effective than real medication when branded to look more "medical." Larger pills work better than smaller ones. Expensive placebos outperform cheap ones. Injections beat pills. Even the color matters—blue placebos are better sedatives, red ones better stimulants.

The placebo effect is your predictive brain in action. Expectation shapes experience because prediction shapes reality.

The reverse is also true: The "nocebo effect" happens when expecting something to hurt makes it hurt more. Warning patients about side effects increases how many report those side effects.

This isn't "mind over matter"—it's how the mind IS matter. Your predictions become your biology.`,
      keyPoint: "Placebos work because belief changes prediction, and prediction changes physiology. This is how the brain normally works.",
    },
    games: [
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "The placebo effect means the improvement isn't real.",
        answer: false,
        explanation: "Placebo improvements are real physiological changes. They happen because prediction shapes biology.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "How does the placebo effect work?",
        items: [
          "Person believes treatment will help",
          "Brain predicts improvement",
          "Prediction triggers physiological changes",
          "Real, measurable improvement occurs",
        ],
        correctOrder: [0, 1, 2, 3],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Placebos work because _______ changes biology.",
        options: ['prediction', 'magic', 'sugar', 'deception'],
        answer: 'prediction',
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Expensive placebo", right: "Works better than cheap one" },
          { left: "Blue placebo pill", right: "Better sedative effect" },
          { left: "Red placebo pill", right: "Better stimulant effect" },
          { left: "Nocebo effect", right: "Negative expectation causes harm" },
        ],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What makes placebos more effective?",
        options: [
          { text: "Looking more 'medical' or official", correct: true },
          { text: "Being larger in size", correct: true },
          { text: "Being more expensive", correct: true },
          { text: "Being administered by injection vs pill", correct: true },
          { text: "Having active ingredients", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "A doctor tells a patient about all possible side effects of a medication. The patient experiences several of those side effects, but tests show the medication hasn't even been absorbed yet.",
        question: "What happened?",
        options: [
          { text: "The tests are wrong", correct: false },
          { text: "The nocebo effect—expecting side effects predicted them into existence", correct: true },
          { text: "The patient is lying", correct: false },
        ],
        explanation: "The nocebo effect is the placebo's evil twin. Expecting harm creates predictions that generate real physiological effects—before any medication could have caused them.",
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "The placebo effect only works on gullible or unintelligent people.",
        answer: false,
        explanation: "Placebos work through the brain's predictive architecture, which everyone has. Even knowing something is a placebo doesn't eliminate the effect entirely.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "How does the placebo effect work?",
        items: [
          "Person receives treatment they believe will help",
          "Brain predicts improvement",
          "Prediction triggers physiological changes",
          "Endorphins release, inflammation reduces",
          "Person experiences real, measurable improvement",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
    ],
  },
  {
    id: 'mind-3-5',
    unitId: 'mind-3',
    order: 5,
    title: "You Are What You Repeatedly Experience",
    content: {
      intro: `Every experience updates your predictive model. This is profound because it means you have real power over your future self.

The experiences you choose TODAY become the predictions that shape TOMORROW. Repeatedly experience yourself exercising → your brain predicts "I'm someone who exercises." Repeatedly experience healthy eating → your brain predicts "I eat healthy."

Here's the key insight: It's not about big, dramatic experiences. It's about repeated small ones. One marathon doesn't make you a runner—100 short runs does. One healthy meal doesn't change your identity—200 does.

Your brain is constantly asking: "Based on recent experience, who is this person and what do they do?" It doesn't care about your intentions, goals, or self-image. It only counts actual experiences.

You're not just building habits. You're literally rewiring what your brain expects from you and for you. Each experience is a vote for a particular prediction about your future.

Choose your experiences deliberately. They become your future reality. Not because of manifestation, but because of how the predictive brain works.`,
      keyPoint: "Your experiences become your predictions, which become your reality. Choose experiences that create the future you want.",
    },
    games: [
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Repeated exercise experiences", right: "Brain predicts 'I exercise'" },
          { left: "Repeated avoidance", right: "Brain predicts 'I can't'" },
          { left: "Repeated small wins", right: "Brain predicts success" },
          { left: "Repeated negative self-talk", right: "Brain predicts failure" },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Someone wants to become a morning person but has decades of experience as a night owl.",
        question: "What's the most effective approach?",
        options: [
          { text: "Use pure willpower to force the change", correct: false },
          { text: "Gradually create new morning experiences to build new predictions", correct: true },
          { text: "Accept that personality can't change", correct: false },
        ],
        explanation: "The brain's predictions come from experience. New predictions require new experiences—ideally repeated, gradually accumulated experiences that build a new pattern.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Today's experiences become tomorrow's _______.",
        options: ['predictions', 'memories', 'regrets', 'habits'],
        answer: 'predictions',
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "One marathon does more for your 'runner identity' than 100 short runs.",
        answer: false,
        explanation: "Your brain counts repeated experiences, not dramatic ones. 100 short runs provides far more data points than one marathon.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What does your brain actually count when forming identity predictions?",
        options: [
          { text: "Actual experiences", correct: true },
          { text: "Your stated intentions", correct: false },
          { text: "Repeated behaviors", correct: true },
          { text: "Your goals and aspirations", correct: false },
          { text: "What you've done recently", correct: true },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "How do experiences become identity?",
        items: [
          "You take an action (e.g., go for a walk)",
          "Brain records this as data point",
          "Action is repeated many times",
          "Brain predicts 'this is what this person does'",
          "You experience yourself as 'someone who walks'",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Someone sets an intention to 'become healthier' and reads books about nutrition, but doesn't actually change their eating habits.",
        question: "According to the predictive brain, what's happening to their identity?",
        options: [
          { text: "Their identity is changing because they're learning", correct: false },
          { text: "Nothing—their brain only counts actual experiences, not intentions or knowledge", correct: true },
          { text: "Change is happening slowly through knowledge", correct: false },
        ],
        explanation: "The brain builds predictions from experiences, not intentions. Reading about healthy eating provides no experiential data that you're 'someone who eats healthy.'",
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "100 short runs", right: "Strong 'I am a runner' prediction" },
          { left: "One marathon", right: "Weak identity change" },
          { left: "Daily intentions without action", right: "No prediction change" },
          { left: "Small daily experiences", right: "Powerful identity shifts" },
        ],
      },
    ],
  },
];

// =============================================================================
// MIND MODULE - UNIT 4: TRAINING THE PREDICTIVE BRAIN
// =============================================================================

const MIND_4_LESSONS = [
  {
    id: 'mind-4-1',
    unitId: 'mind-4',
    order: 1,
    title: "Why Consistency Beats Intensity",
    content: {
      intro: `Your brain builds predictions from patterns, not one-time events. One intense workout barely registers. One hundred moderate workouts reshape your entire predictive model.

Think about it: A single data point doesn't shift a probability distribution. But consistent data in the same direction eventually makes that outcome the brain's default prediction.

Here's what this means practically: The person who exercises for 10 minutes every single day for a year builds a stronger "I exercise" prediction than someone who does five 2-hour sessions and then quits.

Your brain is essentially asking: "What has this person been doing consistently?" Not "What's the most impressive thing they've done once?"

This is why "go hard or go home" fails. Sporadic intensity doesn't create reliable patterns to predict from. But boring consistency? That rewrites your brain's entire model of who you are and what you do.

The implication is freeing: You don't need perfect workouts. You need predictable ones.`,
      keyPoint: "Your brain needs patterns to form predictions. Consistency provides patterns; intensity doesn't.",
    },
    games: [
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "One intense workout creates more brain change than ten moderate ones.",
        answer: false,
        explanation: "The brain builds predictions from patterns. Ten experiences provide more data than one, regardless of intensity.",
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "One intense workout", right: "Single data point, weak pattern" },
          { left: "100 moderate workouts", right: "Strong pattern, reliable prediction" },
          { left: "Sporadic training", right: "No consistent pattern emerges" },
          { left: "Daily movement", right: "Brain predicts 'I move every day'" },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Person A does one 2-hour workout per week. Person B does 20 minutes daily. Who sees more identity change over 6 months?",
        question: "Who is more likely to 'become someone who exercises'?",
        options: [
          { text: "Person A—more total intensity", correct: false },
          { text: "Person B—more consistent pattern for the brain to predict from", correct: true },
          { text: "They're equal—same total time", correct: false },
        ],
        explanation: "Person B gives their brain a pattern: 'I exercise daily.' Person A's brain has no reliable pattern—sometimes workout, usually not.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "You don't need perfect workouts. You need _______ ones.",
        options: ['predictable', 'intense', 'long', 'impressive'],
        answer: 'predictable',
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What does your brain use to form predictions about your behavior?",
        options: [
          { text: "Consistent patterns over time", correct: true },
          { text: "Single impressive events", correct: false },
          { text: "Repeated experiences", correct: true },
          { text: "Your stated goals", correct: false },
          { text: "What you do regularly", correct: true },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "How does consistency create identity change?",
        items: [
          "You commit to small, manageable daily action",
          "Each day provides a data point",
          "Data points accumulate into a pattern",
          "Brain recognizes the pattern as reliable",
          "Pattern becomes the brain's default prediction of 'who you are'",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "The 'go hard or go home' approach is effective for long-term change.",
        answer: false,
        explanation: "Sporadic intensity doesn't create patterns. The brain can't reliably predict 'I exercise' from occasional extreme sessions followed by long gaps.",
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Someone exercises intensely every January, then stops by February. This pattern has repeated for 10 years.",
        question: "What prediction has their brain formed?",
        options: [
          { text: "I'm someone who exercises intensely", correct: false },
          { text: "I'm someone who exercises in January then quits", correct: true },
          { text: "Exercise doesn't work for me", correct: false },
        ],
        explanation: "The brain formed a pattern from repeated experience: 'January exercise, February quit.' Consistency means the brain can predict the behavior reliably—even if the behavior is quitting.",
      },
    ],
  },
  {
    id: 'mind-4-2',
    unitId: 'mind-4',
    order: 2,
    title: "The First Weeks Are Updating",
    content: {
      intro: `Starting a new exercise routine feels hard partly because your brain's predictions don't match your new behavior.

Your brain has spent years predicting "I don't exercise," "Exercise is unpleasant," "I'm not athletic." Now you're creating experiences that contradict these predictions. That mismatch creates discomfort.

But here's the key: That discomfort IS the updating process. Each workout sends prediction errors that slowly shift your brain's model.

Think of it like this: The resistance you feel isn't your body saying "stop"—it's your brain saying "this doesn't match my model." Every time you exercise anyway, you're telling your brain "update the model."

This is why the first few weeks are both the hardest AND the most impactful. Your brain hasn't yet updated its predictions, so every session creates friction. But that friction is the signal that change is happening.

After about 6-8 weeks of consistency, many people report exercise feeling "normal" or even "wanted." That's not because their fitness changed dramatically—it's because their brain's predictions updated. The model now expects exercise.

The first weeks aren't about fitness gains—they're about teaching your brain a new story.`,
      keyPoint: "Early discomfort is your brain updating its predictions. You're not just building fitness—you're rewriting your brain's model of who you are.",
    },
    games: [
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Early workout discomfort partly comes from _______ between old predictions and new behavior.",
        options: ['mismatch', 'weakness', 'laziness', 'genetics'],
        answer: 'mismatch',
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "If starting exercise feels hard, it means you're not meant to exercise.",
        answer: false,
        explanation: "Starting feels hard because your brain is updating. The discomfort IS the change happening.",
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Week 1 of a new routine feels terrible. Week 4 feels noticeably easier, even though physical fitness hasn't changed much.",
        question: "What changed?",
        options: [
          { text: "You got dramatically fitter in 4 weeks", correct: false },
          { text: "Your brain updated its predictions—it now expects exercise and prepares for it", correct: true },
          { text: "The placebo effect", correct: false },
        ],
        explanation: "Your brain now predicts exercise. It prepares your body budget, reduces resistance, and the whole experience feels more normal.",
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Early resistance", right: "Brain saying 'this doesn't match my model'" },
          { left: "Week 6-8 shift", right: "Predictions have updated" },
          { left: "Exercise feeling 'normal'", right: "Brain now expects it" },
          { left: "Each workout", right: "Sends 'update the model' signal" },
        ],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What's actually happening during the uncomfortable first weeks?",
        options: [
          { text: "Your brain is updating its predictions", correct: true },
          { text: "Prediction errors are being generated", correct: true },
          { text: "Your brain model is being rewritten", correct: true },
          { text: "Your fitness is dramatically improving", correct: false },
          { text: "You're teaching your brain a new story", correct: true },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "How do the first weeks of a new routine work?",
        items: [
          "Old predictions: 'I don't exercise'",
          "New behavior creates prediction errors",
          "Each session sends 'update' signals",
          "Brain gradually shifts its model",
          "Exercise starts feeling 'normal'",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "After 6-8 weeks, exercise feels more 'normal' because your brain's _______ have updated.",
        options: ['predictions', 'muscles', 'hormones', 'habits'],
        answer: 'predictions',
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "If starting a new habit feels hard, it means you're not suited for that habit.",
        answer: false,
        explanation: "Initial difficulty is your brain's old predictions creating friction. It's a sign of the updating process, not a sign you shouldn't continue.",
      },
    ],
  },
  {
    id: 'mind-4-3',
    unitId: 'mind-4',
    order: 3,
    title: "Adaptation = New Predictions",
    content: {
      intro: `What does it actually mean to "get stronger"?

Yes, your muscles grow and your cardiovascular system improves. But something equally important happens: Your brain's predictions change.

Before: Your brain predicts that a 50lb weight is "heavy" and prepares for struggle.
After: Your brain predicts that 50lbs is "moderate" and prepares accordingly.

The weight didn't change. Your prediction did. And prediction shapes everything—how hard it feels, how much fatigue you experience, even your technique.

This explains why strength gains often come in sudden "jumps" rather than smooth curves. Your muscles might be ready for a heavier weight, but your brain hasn't updated its prediction yet. Then suddenly—after enough evidence—the prediction shifts and the weight "feels" manageable.

It also explains "newbie gains." Beginners improve rapidly partly because their brains are rapidly updating predictions. The neural adaptation—learning to recruit muscles efficiently, updating "what's possible"—happens faster than muscle growth.

Adaptation is as much neural as muscular. When you feel stronger, you often ARE stronger—because feeling is prediction, and prediction shapes performance.`,
      keyPoint: "Getting stronger means your brain predicts you CAN do things it previously predicted you couldn't.",
    },
    games: [
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Before training: 50lbs", right: "Brain predicts 'heavy, difficult'" },
          { left: "After training: 50lbs", right: "Brain predicts 'moderate, manageable'" },
          { left: "Same weight, different prediction", right: "Different experience" },
          { left: "Neural adaptation", right: "Brain learns new predictions" },
        ],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What changes when you 'get stronger'?",
        options: [
          { text: "Muscle size", correct: true },
          { text: "Cardiovascular capacity", correct: true },
          { text: "Brain's predictions about what you can do", correct: true },
          { text: "How hard efforts feel at the same weight", correct: true },
          { text: "Your nervous system's efficiency", correct: true },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Strength adaptation is as much _______ as muscular.",
        options: ['neural', 'genetic', 'hormonal', 'random'],
        answer: 'neural',
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "A beginner gains significant strength in their first month of training—more than should be possible from muscle growth alone.",
        question: "What explains these 'newbie gains'?",
        options: [
          { text: "Beginners have special muscle-building abilities", correct: false },
          { text: "Rapid neural adaptation—the brain updating predictions and muscle recruitment patterns", correct: true },
          { text: "The weights in the gym are mislabeled", correct: false },
        ],
        explanation: "Early gains are largely neural. The brain learns to recruit muscle fibers efficiently and updates its predictions of what's possible. This happens faster than actual muscle growth.",
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Strength gains follow a smooth, linear curve as muscles grow.",
        answer: false,
        explanation: "Gains often come in sudden 'jumps' because your brain's predictions update in steps. The weight feels heavy until suddenly the prediction shifts and it feels manageable.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "How does neural adaptation contribute to 'getting stronger'?",
        items: [
          "You consistently train a movement",
          "Brain learns to recruit more muscle fibers",
          "Brain updates predictions of what you can lift",
          "Same weight starts to 'feel' lighter",
          "Performance improves beyond muscle growth",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What changes when you 'feel stronger'?",
        options: [
          { text: "Your brain's prediction of what you can do", correct: true },
          { text: "How hard efforts feel at the same weight", correct: true },
          { text: "Your technique and muscle recruitment", correct: true },
          { text: "Only your muscle size", correct: false },
          { text: "Your nervous system efficiency", correct: true },
        ],
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Newbie gains", right: "Rapid neural adaptation" },
          { left: "Strength 'jumps'", right: "Prediction updates in steps" },
          { left: "Same weight feels lighter", right: "Brain changed prediction" },
          { left: "Feeling stronger", right: "Often means being stronger" },
        ],
      },
    ],
  },
  {
    id: 'mind-4-4',
    unitId: 'mind-4',
    order: 4,
    title: "Identity Changes Predictions",
    content: {
      intro: `There's a massive difference between "trying to exercise more" and "being someone who exercises."

When your identity is "trying to exercise," your brain predicts constant struggle, willpower battles, and eventual failure (because that's what "trying" implies).

When your identity is "I'm someone who exercises," your brain predicts exercise as normal, expected, part of who you are.

Same behavior, completely different predictions. And predictions determine how everything feels, how much resistance you encounter, how sustainable the change is.

Notice the language difference: "I'm trying to eat better" vs "I eat healthy." "I want to be fit" vs "I'm an active person." The first versions imply your current identity is fighting against the behavior. The second versions make the behavior part of who you are.

This isn't just wordplay. Your brain uses your self-concept to generate predictions. If you see yourself as "a non-exerciser trying to exercise," your brain predicts this as temporary, difficult, unnatural. If you see yourself as "an exerciser," your brain predicts exercise as obvious and normal.

The hack: Start saying "I'm someone who..." before the behavior feels natural. The identity shift helps the predictions update faster.`,
      keyPoint: "How you see yourself changes your brain's predictions about you—which changes your reality.",
    },
    games: [
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "'I'm trying to exercise'", right: "Brain predicts struggle and resistance" },
          { left: "'I'm someone who exercises'", right: "Brain predicts exercise as normal" },
          { left: "Behavior-level goal", right: "Fighting against predictions" },
          { left: "Identity-level change", right: "Predictions support the behavior" },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Two people both exercise 3x per week. Person A says 'I'm trying to be more active.' Person B says 'I'm an active person.' Who is more likely to still be exercising in a year?",
        question: "Who is more likely to maintain the habit?",
        options: [
          { text: "Person A—trying shows effort", correct: false },
          { text: "Person B—identity creates supporting predictions", correct: true },
          { text: "Same odds—same behavior", correct: false },
        ],
        explanation: "Person B's brain predicts that exercise is 'what I do.' Person A's brain predicts struggle and the possibility of failure.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Identity-level change works because it changes the _______.",
        options: ['predictions', 'willpower', 'genetics', 'schedule'],
        answer: 'predictions',
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Which language patterns support identity-based change?",
        options: [
          { text: "'I'm someone who exercises'", correct: true },
          { text: "'I'm trying to exercise more'", correct: false },
          { text: "'I eat healthy'", correct: true },
          { text: "'I want to be fit someday'", correct: false },
          { text: "'I'm an active person'", correct: true },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "How does identity-based language help change?",
        items: [
          "You start saying 'I'm someone who...'",
          "Brain registers new self-concept",
          "Self-concept shapes predictions",
          "Predictions support the behavior",
          "Behavior feels more natural over time",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "You should only say 'I'm a healthy person' after you've become one.",
        answer: false,
        explanation: "Starting to say 'I'm someone who...' before the behavior feels natural actually helps. The identity shift accelerates the prediction update.",
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Two people exercise the same amount. Person A says 'I'm trying to be more active.' Person B says 'I'm an active person.' Both face a busy, stressful week.",
        question: "Who is more likely to maintain their exercise routine?",
        options: [
          { text: "Person A—'trying' shows more effort", correct: false },
          { text: "Person B—their identity predicts exercise as 'what they do' even under stress", correct: true },
          { text: "Same odds—they exercise the same amount", correct: false },
        ],
        explanation: "Person B's brain predicts exercise as part of who they are, not a goal they might abandon. Under stress, they're more likely to default to their identity.",
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "'I'm trying to eat better'", right: "Predicts struggle and possible failure" },
          { left: "'I eat healthy'", right: "Predicts healthy eating as normal" },
          { left: "Identity as 'non-exerciser trying'", right: "Predicts temporary, difficult" },
          { left: "Identity as 'exerciser'", right: "Predicts exercise as obvious" },
        ],
      },
    ],
  },
  {
    id: 'mind-4-5',
    unitId: 'mind-4',
    order: 5,
    title: "The Long Game",
    content: {
      intro: `Your brain doesn't know the difference between "I want to lose 10 pounds" and "I want to be a healthy person for life." But its predictions are very different for each.

Short-term goals create short-term predictions. Your brain prepares for a temporary state, expects an end point, and predicts returning to baseline afterward.

Long-term identity creates long-term predictions. Your brain prepares for a permanent way of being, with no end point, no "after."

This explains the yo-yo diet phenomenon. Someone restricts calories to reach a goal weight. Their brain predicts: "Temporary state → reach goal → return to normal." When they hit the goal, the brain does exactly what it predicted—return to normal eating. The regain was predicted from the start.

Compare this to someone who adopts the identity of "a person who eats mindfully." There's no end goal, no "after," no predicted return to baseline. The brain prepares for this as the permanent state.

Most people fail because they set short-term goals when they want long-term change. The predictions don't match the desire. The fix isn't more willpower—it's framing change as identity rather than achievement.`,
      keyPoint: "Short-term goals create short-term predictions. Long-term identity creates lasting change because the predictions are permanent.",
    },
    games: [
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Setting a specific weight loss goal is the best way to achieve lasting change.",
        answer: false,
        explanation: "Specific short-term goals create predictions of an endpoint. Your brain expects to eventually stop and return to baseline.",
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "'Lose 10 pounds'", right: "Brain predicts temporary effort, then stop" },
          { left: "'Become a healthy person'", right: "Brain predicts permanent way of being" },
          { left: "Short-term goal achieved", right: "Brain predicts 'done, return to normal'" },
          { left: "Identity adopted", right: "Brain predicts 'this is who I am now'" },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Someone loses 20 pounds through intense dieting, then gains it all back within a year.",
        question: "What happened predictively?",
        options: [
          { text: "They lacked willpower", correct: false },
          { text: "Their brain predicted a temporary state, and returned to its baseline prediction after the 'goal' was reached", correct: true },
          { text: "Their metabolism is broken", correct: false },
        ],
        explanation: "The goal was short-term, so the predictions were short-term. After the goal, the brain predicted 'back to normal.' Identity-level change would create different predictions.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What's wrong with short-term weight loss goals?",
        options: [
          { text: "The brain predicts returning to baseline after the goal", correct: true },
          { text: "There's an expected 'end point'", correct: true },
          { text: "They're impossible to achieve", correct: false },
          { text: "The brain prepares for temporary state", correct: true },
          { text: "They require too much willpower", correct: false },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Why do yo-yo diets happen (predictive brain view)?",
        items: [
          "Person sets short-term weight loss goal",
          "Brain predicts temporary restriction",
          "Goal is reached",
          "Brain predicts 'return to normal'",
          "Weight is regained as predicted",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "The fix isn't more willpower—it's framing change as _______ rather than achievement.",
        options: ['identity', 'habit', 'rules', 'restriction'],
        answer: 'identity',
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Two people want to eat healthier. Person A's goal: 'Lose 15 pounds by summer.' Person B's goal: 'Become someone who nourishes their body well.'",
        question: "Whose approach sets up better long-term predictions?",
        options: [
          { text: "Person A—specific goals are better", correct: false },
          { text: "Person B—no end point means no predicted 'return to normal'", correct: true },
          { text: "Same—both approaches work equally well", correct: false },
        ],
        explanation: "Person B's brain prepares for a permanent way of being. Person A's brain predicts reaching a goal then stopping. The prediction shapes the outcome.",
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Once you reach a goal, your brain naturally maintains the new state.",
        answer: false,
        explanation: "If the goal was short-term, the brain predicted returning to baseline. Reaching the goal triggers the predicted 'return to normal' unless identity changed.",
      },
    ],
  },
];

// =============================================================================
// MIND MODULE - UNIT 5: BECOMING YOUR FUTURE SELF
// =============================================================================

const MIND_5_LESSONS = [
  {
    id: 'mind-5-1',
    unitId: 'mind-5',
    order: 1,
    title: "Visualization Works Because...",
    content: {
      intro: `Athletes have used visualization for decades. Science now explains why it works: Your brain can't fully distinguish between vividly imagined and actually experienced events.

When you visualize yourself succeeding, your brain processes it as a data point—not as strong as real experience, but still meaningful. Enough mental rehearsal genuinely shifts predictions.

Brain imaging studies show this directly: When you vividly imagine performing a movement, nearly the same motor cortex areas activate as when you actually perform it. The brain is literally running a simulation.

This isn't magical thinking. It's using the brain's predictive architecture deliberately. You're feeding your prediction machine simulated experiences that move the probability distribution.

The key is vividness and detail. Fuzzy, half-hearted mental images don't register strongly. But richly detailed visualizations—including sensations, sounds, emotions—create meaningful prediction updates.

Real experience is stronger, but visualization is a legitimate multiplier. Combined with actual practice, it accelerates skill acquisition and confidence building.`,
      keyPoint: "Visualization works because your brain uses imagined experiences to update predictions—not as strongly as real ones, but meaningfully.",
    },
    games: [
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Visualization is just positive thinking with no real brain effect.",
        answer: false,
        explanation: "Visualization creates neural activity similar to actual experience. The brain partially processes it as real data for prediction.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "How does visualization create change?",
        items: [
          "Vividly imagine successful experience",
          "Brain processes it as partial data",
          "Predictions shift slightly",
          "Real behavior becomes more aligned",
          "More real experiences compound the effect",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Your brain _______ fully distinguish between vivid imagination and real experience.",
        options: ["can't", "can", "must", "tries to"],
        answer: "can't",
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Vividly imagining a movement", right: "Same motor cortex activates" },
          { left: "Fuzzy mental images", right: "Weak prediction update" },
          { left: "Rich, detailed visualization", right: "Meaningful prediction shift" },
          { left: "Visualization + real practice", right: "Accelerated skill acquisition" },
        ],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What makes visualization more effective?",
        options: [
          { text: "Including vivid sensory details", correct: true },
          { text: "Just thinking about wanting to succeed", correct: false },
          { text: "Imagining sounds and emotions", correct: true },
          { text: "Practicing in rich detail", correct: true },
          { text: "Doing it once before an event", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Two athletes prepare for competition. One vaguely hopes for success. The other spends 10 minutes daily vividly imagining every detail of their performance—the sounds, sensations, and successful outcomes.",
        question: "Whose brain is actually changing?",
        options: [
          { text: "Same effect—both are being positive", correct: false },
          { text: "The detailed visualizer—their brain processes it as experience data", correct: true },
          { text: "Neither—real practice is all that matters", correct: false },
        ],
        explanation: "The brain registers vivid, detailed imagining as partial experience. Vague hoping doesn't create the simulation that updates predictions.",
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Visualization can replace real practice entirely.",
        answer: false,
        explanation: "Visualization is a multiplier, not a replacement. Real experience is stronger for updating predictions. The combination is most effective.",
      },
    ],
  },
  {
    id: 'mind-5-2',
    unitId: 'mind-5',
    order: 2,
    title: "Environment Shapes Prediction",
    content: {
      intro: `Your brain makes predictions based on context. Different environments trigger different predictions, which trigger different behaviors.

The same person can be disciplined at the gym and lazy at home—not because of willpower, but because each environment triggers different predictions.

This is why environment design is so powerful. Put running shoes by the bed, and your brain predicts morning running. Keep snacks visible, and your brain predicts snacking. Every environmental cue shapes what your brain expects to happen next.

Research calls this "behavioral architecture." The physical setup of your space literally scripts your brain's predictions. People eat more from bigger plates (brain predicts more food), walk more when stairs are prominent (brain predicts taking stairs), and exercise more when equipment is visible (brain predicts workout).

The insight: Instead of relying on willpower to override unhelpful predictions, change the environment to generate helpful predictions automatically.

You're not fighting your brain when you change your environment. You're changing what your brain predicts. This is dramatically easier than constant willpower battles.`,
      keyPoint: "Environment changes predictions. Design your environment to trigger the predictions that lead to behaviors you want.",
    },
    games: [
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Running shoes by bed", right: "Brain predicts morning running" },
          { left: "Snacks on counter", right: "Brain predicts snacking" },
          { left: "Gym bag in car", right: "Brain predicts post-work workout" },
          { left: "Phone by bed", right: "Brain predicts scrolling" },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Someone struggles to exercise at home but never misses a workout at the gym.",
        question: "What explains this?",
        options: [
          { text: "The gym has better equipment", correct: false },
          { text: "Home triggers 'relax' predictions; gym triggers 'exercise' predictions", correct: true },
          { text: "They're more motivated at the gym", correct: false },
        ],
        explanation: "The environment is a cue that triggers different predictions. Home predicts rest. Gym predicts exercise. Same person, different context, different predictions.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Which environment changes support exercise predictions?",
        options: [
          { text: "Keeping workout clothes visible", correct: true },
          { text: "Hiding healthy food in the back of fridge", correct: false },
          { text: "Preparing gym bag the night before", correct: true },
          { text: "Keeping TV remote easily accessible", correct: false },
          { text: "Making exercise equipment visible", correct: true },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Changing your environment is easier than constant _______ battles.",
        options: ['willpower', 'motivation', 'thought', 'prediction'],
        answer: 'willpower',
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "How does environment design work?",
        items: [
          "You change a physical cue in your space",
          "Brain notices the cue",
          "Cue triggers a prediction",
          "Prediction makes behavior feel natural",
          "Behavior becomes easier without willpower",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "People eat more from bigger plates because they're greedier.",
        answer: false,
        explanation: "The bigger plate triggers a brain prediction of 'more food to eat.' It's environmental cue → prediction → behavior, not character.",
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Someone wants to eat healthier. They could either: A) Use willpower to resist the visible chips on the counter, or B) Put the chips in a hard-to-reach cabinet and put fruit on the counter.",
        question: "Which approach is more sustainable?",
        options: [
          { text: "A—building willpower is more important", correct: false },
          { text: "B—changing environment changes predictions without needing willpower", correct: true },
          { text: "Neither—food choices are about discipline", correct: false },
        ],
        explanation: "Environment design changes what the brain predicts. Visible chips → brain predicts chips. Visible fruit → brain predicts fruit. No willpower needed.",
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Bigger plates", right: "Brain predicts more food to eat" },
          { left: "Visible stairs", right: "Brain predicts taking stairs" },
          { left: "Visible gym equipment", right: "Brain predicts exercising" },
          { left: "Snacks at eye level", right: "Brain predicts snacking" },
        ],
      },
    ],
  },
  {
    id: 'mind-5-3',
    unitId: 'mind-5',
    order: 3,
    title: "Social Predictions",
    content: {
      intro: `Your brain predicts your behavior partly based on the people around you. This isn't peer pressure—it's prediction.

If everyone around you exercises, your brain predicts that you exercise. If no one around you exercises, your brain predicts that you don't. You're not copying; you're conforming to your brain's prediction of what "people like me" do.

Research shows this powerfully: People with obese friends are more likely to become obese—not because of shared food, but because their brain normalizes larger body size and associated behaviors. Conversely, people who join fitness communities often transform faster—their brain starts predicting athletic behavior as "normal for people like me."

This is why community matters so much for change. Surrounding yourself with people who embody what you want to become feeds your brain data that shifts your predictions about yourself.

The insight: Changing your social environment can be as powerful as changing your physical environment. Both change what your brain predicts about you.

Who you spend time with becomes who you predict you'll be.`,
      keyPoint: "Your brain predicts your behavior partly from observing others. Community shapes your self-predictions.",
    },
    games: [
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "You adopt behaviors of people around you mainly due to peer pressure.",
        answer: false,
        explanation: "It's prediction, not pressure. Your brain uses others as data about what 'people like me' do, then predicts you'll do the same.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Your brain uses other people's behavior as data about what _______ do.",
        options: ["'people like me'", "'superior people'", "'weak people'", "'other people'"],
        answer: "'people like me'",
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Someone joins a running club even though they're not very good yet.",
        question: "How does this help beyond the obvious social support?",
        options: [
          { text: "They'll feel guilty if they skip", correct: false },
          { text: "Their brain starts predicting 'I'm a runner' because they're surrounded by runners", correct: true },
          { text: "They'll learn better technique", correct: false },
        ],
        explanation: "Being around runners feeds the brain data that 'people like me run.' This shifts identity predictions faster than running alone would.",
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Friends who exercise", right: "Brain predicts 'I exercise'" },
          { left: "Friends who eat healthy", right: "Brain normalizes healthy eating" },
          { left: "Social media fitness community", right: "Brain sees fitness as 'normal'" },
          { left: "No active people around", right: "Brain predicts sedentary as 'normal'" },
        ],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "How does social environment change predictions?",
        options: [
          { text: "Brain observes what 'people like me' do", correct: true },
          { text: "Behaviors become normalized as 'what we do'", correct: true },
          { text: "Peer pressure forces conformity", correct: false },
          { text: "Brain predicts you'll be similar to your group", correct: true },
          { text: "Only conscious imitation matters", correct: false },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "How does community accelerate identity change?",
        items: [
          "You join a community of people with desired behavior",
          "Brain observes their behaviors as 'normal'",
          "Brain updates prediction of what 'people like me' do",
          "Your identity prediction shifts toward the group",
          "The behavior starts feeling like 'who you are'",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Changing your social environment can be as powerful as changing your physical environment.",
        answer: true,
        explanation: "Both change predictions. Physical environment changes cue-based predictions. Social environment changes identity-based predictions of 'what people like me do.'",
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Research found that people with obese friends were more likely to become obese, even if they lived far apart and didn't share meals.",
        question: "What explains this finding?",
        options: [
          { text: "They share genetic traits", correct: false },
          { text: "Their brain normalizes larger body size and eating behaviors as 'what people like me do'", correct: true },
          { text: "They encourage each other to eat more", correct: false },
        ],
        explanation: "It's not about shared food or direct influence. The brain uses social reference groups to predict 'normal' body size and behaviors, then conforms to those predictions.",
      },
    ],
  },
  {
    id: 'mind-5-4',
    unitId: 'mind-5',
    order: 4,
    title: "Breaking Prediction Loops",
    content: {
      intro: `Depression, anxiety, chronic pain, and negative self-image often involve prediction loops.

The loop: Experience creates prediction → Prediction shapes attention and interpretation → Biased attention creates more of the same experience → Experience reinforces prediction.

Anxious people predict threat, which makes them scan for threat, which makes them find threat, which confirms the anxiety prediction.

Someone who believes "I always fail" predicts failure, which makes them notice every small setback, which they interpret as proof of failure, which reinforces the belief. Meanwhile, they dismiss successes as "flukes."

Breaking loops requires interrupting the cycle—usually through new experiences that contradict the prediction. Therapy, meditation, and behavior change all work partly by breaking prediction loops.

The key insight: You can't just think your way out. Telling someone "don't be anxious" doesn't break the prediction. They need actual experiences of safety that their brain can use as new data.

This is why small wins matter so much. Each success, even tiny, provides contradiction data that weakens the negative prediction loop.`,
      keyPoint: "Negative patterns are often prediction loops. New experiences that contradict the prediction can break the cycle.",
    },
    games: [
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "How does a negative prediction loop work?",
        items: [
          "Past experience creates negative prediction",
          "Prediction biases attention toward confirming evidence",
          "Biased attention creates more negative experience",
          "New experience reinforces original prediction",
          "Loop continues and strengthens",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What can break a prediction loop?",
        options: [
          { text: "New experiences that contradict the prediction", correct: true },
          { text: "Thinking really hard about why the prediction is wrong", correct: false },
          { text: "Therapy that creates new experiences", correct: true },
          { text: "Meditation that interrupts automatic predictions", correct: true },
          { text: "Just deciding to think differently", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Someone believes 'I always fail.' They've failed many times, which confirms the belief.",
        question: "What's the most effective way to change this?",
        options: [
          { text: "Tell them to think positive thoughts", correct: false },
          { text: "Create small, repeated experiences of success that provide new prediction data", correct: true },
          { text: "Explain logically why the belief is wrong", correct: false },
        ],
        explanation: "Predictions come from experience, not logic. New experiences provide new data. Small wins, repeated, gradually shift the prediction.",
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "You can break a negative prediction loop just by thinking differently.",
        answer: false,
        explanation: "Predictions come from experience. You need actual experiences that contradict the prediction—not just different thoughts.",
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Anxious person scans for threat", right: "Finds threat, confirms anxiety" },
          { left: "'I always fail' prediction", right: "Notices setbacks, ignores wins" },
          { left: "New experience of safety", right: "Provides contradiction data" },
          { left: "Small repeated wins", right: "Gradually weakens negative loop" },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Small wins matter because each success provides _______ data against the negative prediction.",
        options: ['contradiction', 'logical', 'emotional', 'theoretical'],
        answer: 'contradiction',
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Someone with social anxiety is told 'People actually like you—just believe it!' They try to believe it, but their anxiety doesn't improve.",
        question: "Why didn't this work?",
        options: [
          { text: "They didn't believe hard enough", correct: false },
          { text: "Predictions need actual experiences of positive social interaction, not just beliefs", correct: true },
          { text: "Their anxiety is too severe for change", correct: false },
        ],
        explanation: "The brain doesn't update from beliefs—it updates from experiences. They need actual positive social interactions to provide new prediction data.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What actually breaks prediction loops?",
        options: [
          { text: "New experiences that contradict the prediction", correct: true },
          { text: "Just deciding to think positively", correct: false },
          { text: "Repeated small wins", correct: true },
          { text: "Logical arguments against the belief", correct: false },
          { text: "Therapy that creates new experiences", correct: true },
        ],
      },
    ],
  },
  {
    id: 'mind-5-5',
    unitId: 'mind-5',
    order: 5,
    title: "Every Action Is a Vote",
    content: {
      intro: `Every action you take is a vote for the person you're becoming.

Not because of karma or manifestation, but because of prediction. Each behavior becomes data that your brain uses to predict future behavior.

Skip a workout → brain gets data for "I skip workouts"
Do a workout → brain gets data for "I do workouts"

You don't become fit from one workout. You become someone who works out through accumulated votes. Each action either reinforces or weakens your brain's prediction of who you are.

This is both empowering and sobering. Every small choice matters. Not because you should feel guilty about imperfection, but because you're always training your brain's model of who you are.

The flip side: One slip doesn't define you. One bad day is one vote against a potential accumulation of hundreds. Patterns matter more than single events. The question isn't "Was today perfect?" but "What is the pattern I'm creating?"

You are training your brain's prediction of you with every choice. The person you are tomorrow is being voted on today.`,
      keyPoint: "Every action is data that shapes your brain's prediction of who you are. You become what you repeatedly do—literally.",
    },
    games: [
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "One skipped workout", right: "Small vote for 'I skip'" },
          { left: "One completed workout", right: "Small vote for 'I show up'" },
          { left: "Many consistent choices", right: "Strong prediction of identity" },
          { left: "Mixed, inconsistent choices", right: "Weak, uncertain predictions" },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "One bad day undoes weeks of good progress.",
        answer: false,
        explanation: "One action is one vote. It slightly shifts predictions, but it can't override accumulated evidence. Patterns matter more than single events.",
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "It's raining and you don't feel like your planned run. You do it anyway—just 10 minutes.",
        question: "What's the real value of this choice?",
        options: [
          { text: "The 10 minutes of cardiovascular exercise", correct: false },
          { text: "Proving something to yourself", correct: false },
          { text: "A strong vote for 'I'm someone who runs regardless of conditions'—powerful prediction data", correct: true },
        ],
        explanation: "The identity vote is worth more than the exercise. You just taught your brain 'I run even when I don't feel like it.' That prediction will make future runs easier.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "The question isn't 'Was today perfect?' but 'What is the _______ I'm creating?'",
        options: ['pattern', 'excuse', 'feeling', 'goal'],
        answer: 'pattern',
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Why does one bad day not ruin your progress?",
        options: [
          { text: "One vote can't override hundreds of previous votes", correct: true },
          { text: "Patterns matter more than single events", correct: true },
          { text: "The brain counts accumulated data", correct: true },
          { text: "One day is meaningless to the brain", correct: false },
          { text: "What you do most of the time defines you", correct: true },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "How do actions become identity?",
        items: [
          "You make a choice (exercise or skip)",
          "Brain records the choice as data",
          "Repeated choices form a pattern",
          "Brain predicts future behavior from pattern",
          "Pattern becomes 'who you are'",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Someone has exercised 50 days in a row. Today they're exhausted and skip. They feel terrible and think 'I'm a failure.'",
        question: "What's a more accurate perspective?",
        options: [
          { text: "They should feel bad—consistency is ruined", correct: false },
          { text: "50 votes vs 1 vote—their brain still predicts 'I'm someone who exercises'", correct: true },
          { text: "They need to start over from zero", correct: false },
        ],
        explanation: "One skip is one data point against 50. The pattern is what matters. Their brain's prediction of 'I exercise' is barely affected by one vote.",
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "You should feel guilty about every imperfect day because every action matters.",
        answer: false,
        explanation: "Every action matters as data, but patterns matter more than single events. Guilt about imperfection isn't useful—just get back to voting for who you want to become.",
      },
    ],
  },
];

// =============================================================================
// BODY MODULE - UNIT 1: MUSCLE BASICS
// =============================================================================

const BODY_1_LESSONS = [
  {
    id: 'body-1-1',
    unitId: 'body-1',
    order: 1,
    title: "Your Major Muscle Groups",
    content: {
      intro: `Your body has over 600 muscles, but for training purposes, we focus on the major groups that power daily movement and exercise.

Upper body: Chest (pectorals), Back (lats, traps, rhomboids), Shoulders (deltoids), Arms (biceps, triceps)

Core: Abdominals, Obliques, Lower back (erector spinae), Deep stabilizers (transverse abdominis)

Lower body: Glutes (your powerhouse), Quadriceps (front thigh), Hamstrings (back thigh), Calves

Understanding these groups helps you train balanced and avoid imbalances that lead to injury.`,
      keyPoint: "Major muscle groups work in pairs and chains. Training them all creates a balanced, functional body.",
    },
    games: [
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Pectorals", right: "Chest" },
          { left: "Latissimus dorsi", right: "Back" },
          { left: "Deltoids", right: "Shoulders" },
          { left: "Glutes", right: "Buttocks" },
        ],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Which are considered 'core' muscles?",
        options: [
          { text: "Abdominals", correct: true },
          { text: "Biceps", correct: false },
          { text: "Obliques", correct: true },
          { text: "Lower back", correct: true },
          { text: "Calves", correct: false },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Your _______ are considered your body's powerhouse muscles.",
        options: ['glutes', 'biceps', 'calves', 'traps'],
        answer: 'glutes',
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Organize these body regions from top to bottom:",
        items: [
          "Shoulders (Deltoids)",
          "Chest (Pectorals)",
          "Core (Abdominals)",
          "Glutes",
          "Quadriceps",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "The biceps and triceps are both in the lower body.",
        answer: false,
        explanation: "Biceps and triceps are arm muscles—upper body. Biceps bend your elbow, triceps straighten it.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Which muscles are in the lower body?",
        options: [
          { text: "Quadriceps", correct: true },
          { text: "Hamstrings", correct: true },
          { text: "Deltoids", correct: false },
          { text: "Glutes", correct: true },
          { text: "Pectorals", correct: false },
          { text: "Calves", correct: true },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Someone only trains their 'mirror muscles' (chest, biceps, abs) and neglects their back, hamstrings, and glutes.",
        question: "What problem might develop over time?",
        options: [
          { text: "They'll get too muscular", correct: false },
          { text: "Muscle imbalances that can lead to poor posture and injury", correct: true },
          { text: "Nothing—those are the most important muscles", correct: false },
        ],
        explanation: "Training only the front of your body creates imbalances. Muscles work in pairs, and neglecting the back side leads to postural problems and increased injury risk.",
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Upper body front", right: "Chest, biceps, abs" },
          { left: "Upper body back", right: "Lats, traps, triceps" },
          { left: "Lower body front", right: "Quadriceps" },
          { left: "Lower body back", right: "Hamstrings, glutes" },
        ],
      },
    ],
  },
  {
    id: 'body-1-2',
    unitId: 'body-1',
    order: 2,
    title: "What Muscles Actually Do",
    content: {
      intro: `Muscles have one simple job: contract (shorten) to create movement. They can only pull, never push.

This is why muscles work in pairs. Your biceps bends your elbow by contracting. Your triceps straightens it by contracting and pulling the other way.

When one muscle contracts, the opposite muscle (antagonist) must relax. This coordination happens automatically through your nervous system.

Strength training works by creating tiny damage to muscle fibers, which repair stronger—if you give them nutrition and rest.`,
      keyPoint: "Muscles only pull, never push. They work in opposing pairs, and they grow by being damaged and repaired.",
    },
    games: [
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Muscles can both push and pull to create movement.",
        answer: false,
        explanation: "Muscles can only contract (pull). Pushing movements happen when muscles on one side pull a joint in that direction.",
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Biceps contracts", right: "Elbow bends" },
          { left: "Triceps contracts", right: "Elbow straightens" },
          { left: "Quadriceps contracts", right: "Knee extends" },
          { left: "Hamstrings contract", right: "Knee bends" },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "How does muscle growth happen?",
        items: [
          "Training creates tiny tears in muscle fibers",
          "Body senses damage and begins repair",
          "Protein and rest enable recovery",
          "Muscle rebuilds slightly stronger",
          "Repeated cycles create growth over time",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "When one muscle contracts, its opposite muscle (antagonist) must _______.",
        options: ['relax', 'contract', 'grow', 'shrink'],
        answer: 'relax',
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What happens when you do a bicep curl?",
        options: [
          { text: "Biceps contracts (shortens)", correct: true },
          { text: "Triceps relaxes", correct: true },
          { text: "Elbow bends", correct: true },
          { text: "Biceps pushes the weight up", correct: false },
          { text: "Both muscles contract equally", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Someone wonders why they need to train both biceps and triceps if they just want bigger arms.",
        question: "Why is training both important?",
        options: [
          { text: "Just for aesthetics—evenness looks better", correct: false },
          { text: "Muscles work in opposing pairs; imbalances can cause injury and limit strength", correct: true },
          { text: "You don't—just train the muscle you want bigger", correct: false },
        ],
        explanation: "Biceps and triceps work as a pair. If one is much stronger than the other, it creates imbalance, limits performance, and increases injury risk.",
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Muscle contraction", right: "Only pulls, never pushes" },
          { left: "Antagonist muscle", right: "Must relax when partner contracts" },
          { left: "Nervous system", right: "Coordinates muscle pairs automatically" },
          { left: "Muscle repair", right: "Happens with protein and rest" },
        ],
      },
    ],
  },
  {
    id: 'body-1-3',
    unitId: 'body-1',
    order: 3,
    title: "How Muscles Grow",
    content: {
      intro: `Muscle growth (hypertrophy) happens through a process called "stress adaptation."

When you lift weights, you create mechanical tension and metabolic stress that damages muscle fibers. Your body responds by repairing these fibers thicker and stronger—but ONLY if you provide:

1. Progressive overload (gradually increasing demands)
2. Adequate protein (the building blocks)
3. Sufficient rest (when actual growth happens)

Growth doesn't happen during the workout—it happens during recovery. The workout is the stimulus; sleep and nutrition are the actual building phase.`,
      keyPoint: "Muscle grows during rest, not during exercise. Training provides the stimulus; recovery provides the growth.",
    },
    games: [
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What's needed for muscle growth?",
        options: [
          { text: "Progressive overload", correct: true },
          { text: "Adequate protein", correct: true },
          { text: "Training every day without rest", correct: false },
          { text: "Sufficient sleep", correct: true },
          { text: "Avoiding all carbohydrates", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Muscles grow during the workout itself.",
        answer: false,
        explanation: "Workouts create the stimulus (damage). Actual growth happens during recovery when the body repairs and builds.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "The workout provides the stimulus; _______ provides the growth.",
        options: ['recovery', 'intensity', 'supplements', 'cardio'],
        answer: 'recovery',
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Progressive overload", right: "Gradually increasing demands" },
          { left: "Mechanical tension", right: "Force created during lifting" },
          { left: "Metabolic stress", right: "Burn feeling during training" },
          { left: "Sleep", right: "When most growth hormone releases" },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "What's the muscle growth cycle?",
        items: [
          "Challenge muscles beyond current capacity",
          "Create micro-damage in muscle fibers",
          "Consume adequate protein",
          "Rest and sleep for repair",
          "Muscles rebuild stronger than before",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Someone works out hard 7 days a week with no rest days, eating minimal protein, wondering why they're not seeing muscle growth.",
        question: "What's the main problem?",
        options: [
          { text: "They're not training hard enough", correct: false },
          { text: "No rest + low protein means no recovery—which is when actual growth happens", correct: true },
          { text: "They need more supplements", correct: false },
        ],
        explanation: "Workouts create the stimulus, but growth happens during recovery with proper nutrition. Training every day with low protein means constant damage without repair.",
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "More training always equals more muscle growth.",
        answer: false,
        explanation: "Training provides stimulus, but without adequate recovery, you just accumulate damage. There's a point of diminishing returns and even negative returns.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What does 'progressive overload' mean?",
        options: [
          { text: "Gradually increasing weight over time", correct: true },
          { text: "Lifting as heavy as possible every session", correct: false },
          { text: "Adding reps or sets over time", correct: true },
          { text: "Improving form to increase muscle tension", correct: true },
          { text: "Doing the same workout forever", correct: false },
        ],
      },
    ],
  },
  {
    id: 'body-1-4',
    unitId: 'body-1',
    order: 4,
    title: "Muscle Fiber Types",
    content: {
      intro: `You have two main types of muscle fibers, and the ratio affects your training.

Type I (slow-twitch): Built for endurance. Resist fatigue but produce less force. Marathon runners have more of these.

Type II (fast-twitch): Built for power. Produce high force but fatigue quickly. Sprinters have more of these.

Most people have roughly 50/50, but genetics and training can shift this balance. Endurance training develops Type I; heavy, explosive training develops Type II.

You can't fully change your ratio, but you can develop what you have.`,
      keyPoint: "Slow-twitch fibers excel at endurance; fast-twitch excel at power. Your training develops each type differently.",
    },
    games: [
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Type I (slow-twitch)", right: "Endurance, fatigue resistant" },
          { left: "Type II (fast-twitch)", right: "Power, quick fatigue" },
          { left: "Marathon runner", right: "More Type I developed" },
          { left: "Sprinter", right: "More Type II developed" },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Someone wants to build explosive jumping power for basketball.",
        question: "What type of training develops this?",
        options: [
          { text: "Long, slow cardio sessions", correct: false },
          { text: "Heavy, explosive movements like jump squats and power cleans", correct: true },
          { text: "High-rep, light weight circuits", correct: false },
        ],
        explanation: "Explosive power requires fast-twitch fiber development. This needs heavy loads and explosive movements, not endurance work.",
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "You can completely change your muscle fiber ratio through training.",
        answer: false,
        explanation: "You can develop the fibers you have, but your baseline ratio is largely genetic. Training optimizes what you've got.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Type I (slow-twitch) fibers are built for _______.",
        options: ['endurance', 'power', 'speed', 'size'],
        answer: 'endurance',
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What characterizes Type II (fast-twitch) fibers?",
        options: [
          { text: "High force production", correct: true },
          { text: "Quick fatigue", correct: true },
          { text: "Better for explosive movements", correct: true },
          { text: "Great for marathons", correct: false },
          { text: "Used for sprinting", correct: true },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "What type of training develops Type II (fast-twitch) fibers?",
        items: [
          "Choose compound movements",
          "Load with heavier weight",
          "Perform explosive movements",
          "Keep rep ranges lower (3-8)",
          "Allow full recovery between sets",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Type I fibers", right: "Slow-twitch, endurance" },
          { left: "Type II fibers", right: "Fast-twitch, power" },
          { left: "High-rep, low weight", right: "Develops Type I characteristics" },
          { left: "Low-rep, heavy weight", right: "Develops Type II characteristics" },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Someone naturally excels at long-distance running but struggles with sprinting, no matter how much they train for speed.",
        question: "What might explain this?",
        options: [
          { text: "They're not trying hard enough at sprinting", correct: false },
          { text: "They likely have a higher ratio of slow-twitch fibers, which is largely genetic", correct: true },
          { text: "Sprinting is just harder for everyone", correct: false },
        ],
        explanation: "Muscle fiber ratios are largely genetic. Someone with more Type I fibers will naturally excel at endurance but may have a harder ceiling with explosive power.",
      },
    ],
  },
  {
    id: 'body-1-5',
    unitId: 'body-1',
    order: 5,
    title: "Muscle Memory Is Real",
    content: {
      intro: `"Muscle memory" sounds like a myth, but it's backed by science.

When you build muscle, your muscle cells gain new nuclei to support the larger size. If you stop training, you lose size—but the extra nuclei remain for years, possibly forever.

This means regaining lost muscle is much faster than building it initially. Your muscles "remember" their previous size and rebuild quickly.

This is why taking breaks isn't catastrophic. Your previous training created lasting changes that make comebacks faster.`,
      keyPoint: "Muscle memory is real—extra nuclei remain even after detraining. Rebuilding is always faster than building the first time.",
    },
    games: [
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Muscle memory works because extra _______ remain after detraining.",
        options: ['nuclei', 'fibers', 'proteins', 'hormones'],
        answer: 'nuclei',
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "If you take a long break from training, you start completely from zero.",
        answer: false,
        explanation: "Your muscles retain extra nuclei from previous training. Regaining size is faster than building it initially.",
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Someone trained seriously for 3 years, then took 2 years completely off. They start again.",
        question: "What should they expect?",
        options: [
          { text: "Starting from scratch, just like a beginner", correct: false },
          { text: "Faster progress than a true beginner due to muscle memory", correct: true },
          { text: "Impossible to regain what was lost", correct: false },
        ],
        explanation: "Muscle memory means their cells retained nuclei from their training years. Rebuilding will be significantly faster than their original journey.",
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Building muscle initially", right: "Muscle cells gain new nuclei" },
          { left: "Stop training", right: "Lose size, keep extra nuclei" },
          { left: "Restart training", right: "Nuclei quickly rebuild muscle" },
          { left: "Muscle memory", right: "Permanent cellular change" },
        ],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Why is regaining muscle faster than building it initially?",
        options: [
          { text: "Extra nuclei remain from previous training", correct: true },
          { text: "The 'blueprint' for larger muscles exists in cells", correct: true },
          { text: "Neural pathways are still intact", correct: true },
          { text: "Motivation is higher the second time", correct: false },
          { text: "Muscle cells 'remember' their previous size", correct: true },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "How does muscle memory work over time?",
        items: [
          "Training causes muscles to grow",
          "Muscle cells gain extra nuclei to support size",
          "Training stops, muscles shrink",
          "Extra nuclei remain in cells for years",
          "Retraining triggers rapid regrowth using existing nuclei",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.CONNECT_CONCEPTS,
        concepts: [
          { term: "Myonuclear domain theory", definition: "Each nucleus controls a specific region of muscle fiber" },
          { term: "Satellite cells", definition: "Donate new nuclei to growing muscle fibers" },
          { term: "Detraining", definition: "Muscle shrinks but nuclei persist" },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Someone worries about taking a 3-month break from training due to an injury. They fear losing all their gains.",
        question: "What should they understand about muscle memory?",
        options: [
          { text: "They will indeed lose everything and start over", correct: false },
          { text: "Their muscle nuclei are permanent—regaining size after recovery will be faster than their initial build", correct: true },
          { text: "They should train through the injury to avoid losing gains", correct: false },
        ],
        explanation: "Muscle memory means breaks aren't catastrophic. The extra nuclei from previous training remain, making comebacks faster. Health first—the muscle will return.",
      },
    ],
  },
];

// =============================================================================
// FUEL MODULE - UNIT 1: ENERGY FUNDAMENTALS
// =============================================================================

const FUEL_1_LESSONS = [
  {
    id: 'fuel-1-1',
    unitId: 'fuel-1',
    order: 1,
    title: "What Is a Calorie?",
    content: {
      intro: `A calorie is simply a unit of energy. Specifically, it's the energy needed to raise 1 gram of water by 1 degree Celsius.

When we talk about food calories, we actually mean kilocalories (kcal)—1,000 times larger. That "200 calorie" snack is technically 200,000 calories.

Your body extracts energy from food and uses it to power everything: breathing, thinking, moving, digesting, maintaining temperature, and repairing tissue.

Calories aren't "bad"—they're literally the fuel your body runs on. The question is always how much you need and where it comes from.`,
      keyPoint: "Calories are units of energy. Your body needs them for literally everything it does.",
    },
    games: [
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Calories are inherently bad for you.",
        answer: false,
        explanation: "Calories are energy. Without them, you couldn't survive. The question is matching intake to your needs.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What does your body use calories for?",
        options: [
          { text: "Breathing", correct: true },
          { text: "Thinking", correct: true },
          { text: "Digesting food", correct: true },
          { text: "Maintaining body temperature", correct: true },
          { text: "All bodily functions", correct: true },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "A calorie is a unit of _______.",
        options: ['energy', 'weight', 'fat', 'nutrition'],
        answer: 'energy',
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Calorie", right: "Unit of energy" },
          { left: "Kilocalorie (kcal)", right: "What food labels show" },
          { left: "Your body", right: "Converts food to usable energy" },
          { left: "Zero calories", right: "No energy content" },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "What happens to calories you eat?",
        items: [
          "Food enters digestive system",
          "Body breaks down macronutrients",
          "Energy is extracted from food",
          "Energy powers body functions",
          "Excess stored for later (fat, glycogen)",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Someone sees '200 calories' on a snack and thinks 'That's 200 bad things going into my body.'",
        question: "What's a more accurate understanding?",
        options: [
          { text: "They're right—fewer calories is always better", correct: false },
          { text: "Those 200 calories are 200 units of energy their body will use for functions", correct: true },
          { text: "Calories on labels are meaningless numbers", correct: false },
        ],
        explanation: "Calories are energy. The question isn't 'Are calories bad?' but 'Does this amount match what my body needs?'",
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "When a food label says '200 calories,' it technically means 200,000 calories.",
        answer: true,
        explanation: "Food labels show kilocalories (kcal). What we call '200 calories' is technically 200,000 small calories. The term 'calorie' in nutrition is actually a kilocalorie.",
      },
    ],
  },
  {
    id: 'fuel-1-2',
    unitId: 'fuel-1',
    order: 2,
    title: "BMR: Your Baseline Burn",
    content: {
      intro: `BMR (Basal Metabolic Rate) is the energy your body needs just to stay alive while completely at rest.

Even if you lay in bed all day doing nothing, your body would burn your BMR: keeping your heart beating, lungs breathing, brain functioning, cells dividing.

For most people, BMR is 1,200-2,000 calories per day—and it accounts for 60-75% of total daily energy use.

BMR varies based on: body size (bigger bodies burn more), muscle mass (muscle is metabolically "expensive"), age (decreases with age), and genetics.`,
      keyPoint: "BMR is what you burn just being alive. It's the majority of your daily calorie needs.",
    },
    games: [
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "BMR accounts for _______% of most people's daily energy use.",
        options: ['60-75', '10-20', '90-100', '30-40'],
        answer: '60-75',
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What increases BMR?",
        options: [
          { text: "More muscle mass", correct: true },
          { text: "Larger body size", correct: true },
          { text: "Being younger", correct: true },
          { text: "Skipping meals", correct: false },
          { text: "Sleeping more", correct: false },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Exercise is where most of your daily calories are burned.",
        answer: false,
        explanation: "BMR (just being alive) accounts for 60-75% of daily burn. Exercise is typically only 10-30%.",
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "BMR", right: "Basal Metabolic Rate" },
          { left: "Heart beating", right: "Part of BMR" },
          { left: "More muscle mass", right: "Higher BMR" },
          { left: "Aging", right: "BMR typically decreases" },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "Where does your daily energy expenditure go?",
        items: [
          "BMR (60-75%): Just being alive",
          "NEAT (15-20%): Daily movement, fidgeting",
          "Exercise (5-15%): Intentional workouts",
          "TEF (5-10%): Digesting food",
          "Total = TDEE (what you actually burn)",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Two people weigh the same. Person A has 30% body fat. Person B has 20% body fat (more muscle). They both lie in bed all day.",
        question: "Who burns more calories at rest?",
        options: [
          { text: "Same—they weigh the same", correct: false },
          { text: "Person B—muscle is metabolically expensive, higher BMR", correct: true },
          { text: "Person A—fat burns more at rest", correct: false },
        ],
        explanation: "Muscle tissue is 'expensive' to maintain—it burns calories even at rest. More muscle = higher BMR, even at the same body weight.",
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Building muscle increases your metabolism even when you're not exercising.",
        answer: true,
        explanation: "Muscle is metabolically active. More muscle mass means higher BMR—you burn more calories 24/7, not just during workouts.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Which bodily functions are included in BMR?",
        options: [
          { text: "Heart beating", correct: true },
          { text: "Brain functioning", correct: true },
          { text: "Walking to work", correct: false },
          { text: "Cell repair and division", correct: true },
          { text: "Digesting a meal", correct: false },
          { text: "Breathing while asleep", correct: true },
        ],
      },
    ],
  },
  {
    id: 'fuel-1-3',
    unitId: 'fuel-1',
    order: 3,
    title: "TDEE: Your Total Daily Burn",
    content: {
      intro: `TDEE (Total Daily Energy Expenditure) is your BMR plus everything else: moving around, exercising, digesting food, thinking hard.

TDEE = BMR + Activity + TEF (thermic effect of food)

For a moderately active person, TDEE might be 1.5-1.7 times their BMR. Very active people can hit 2x or more.

This is the number that actually matters for weight management. Eat more than TDEE → gain weight. Eat less than TDEE → lose weight. Match TDEE → maintain weight.`,
      keyPoint: "TDEE is your total daily burn including all activity. It's the key number for weight management.",
    },
    games: [
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "What makes up your TDEE?",
        items: [
          "BMR (just staying alive)",
          "NEAT (daily movement, fidgeting)",
          "Exercise activity",
          "TEF (digesting food)",
        ],
        correctOrder: [0, 1, 2, 3],
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Eat more than TDEE", right: "Weight gain over time" },
          { left: "Eat less than TDEE", right: "Weight loss over time" },
          { left: "Eat equal to TDEE", right: "Weight maintenance" },
          { left: "Very active person", right: "Higher TDEE multiplier" },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "For a moderately active person, TDEE is about _______x their BMR.",
        options: ['1.5-1.7', '0.5-0.7', '3-4', '1.0'],
        answer: '1.5-1.7',
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What factors increase TDEE?",
        options: [
          { text: "More physical activity", correct: true },
          { text: "Eating more protein (higher TEF)", correct: true },
          { text: "Having more muscle mass", correct: true },
          { text: "Sitting more throughout the day", correct: false },
          { text: "Being more active outside workouts (NEAT)", correct: true },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Someone calculates their BMR at 1,500 calories. They have a sedentary desk job but exercise 30 minutes daily.",
        question: "What's their approximate TDEE?",
        options: [
          { text: "1,500 calories (same as BMR)", correct: false },
          { text: "Around 2,000-2,200 calories (BMR × ~1.4-1.5)", correct: true },
          { text: "4,500 calories (3× BMR)", correct: false },
        ],
        explanation: "Light activity multiplies BMR by about 1.4-1.5. TDEE includes BMR + daily movement + exercise + digestion.",
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "TDEE is fixed and doesn't change day to day.",
        answer: false,
        explanation: "TDEE varies based on activity level. A rest day burns less than a heavy training day. It's dynamic, not fixed.",
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Sedentary (desk job)", right: "TDEE = BMR × 1.2" },
          { left: "Lightly active", right: "TDEE = BMR × 1.375" },
          { left: "Moderately active", right: "TDEE = BMR × 1.55" },
          { left: "Very active", right: "TDEE = BMR × 1.725" },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "NEAT (Non-Exercise Activity Thermogenesis) includes things like fidgeting and taking stairs.",
        answer: true,
        explanation: "NEAT is all the movement that isn't formal exercise—walking around, fidgeting, standing, taking stairs. It can vary by hundreds of calories daily between people.",
      },
    ],
  },
  {
    id: 'fuel-1-4',
    unitId: 'fuel-1',
    order: 4,
    title: "Energy Balance Basics",
    content: {
      intro: `Energy balance is simple math, but powerful: Energy In vs Energy Out.

Surplus (in > out): Extra energy stored as fat (and some muscle if training)
Deficit (in < out): Body taps stored energy, you lose weight
Maintenance (in = out): Weight stays stable

This isn't just about weight loss. Building muscle requires a slight surplus. Performance requires enough fuel. Recovery requires energy.

Understanding energy balance lets you deliberately choose what you're optimizing for.`,
      keyPoint: "Energy balance determines weight change. Surplus builds, deficit reduces, maintenance sustains.",
    },
    games: [
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Calorie surplus", right: "Weight gain, potential muscle growth" },
          { left: "Calorie deficit", right: "Weight loss, fat burning" },
          { left: "Calorie maintenance", right: "Stable weight" },
          { left: "Large surplus without training", right: "Mostly fat gain" },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Someone wants to build muscle while losing fat at the same time.",
        question: "What's the realistic expectation?",
        options: [
          { text: "Impossible—pick one goal", correct: false },
          { text: "Possible but slower—slight deficit with high protein and resistance training", correct: true },
          { text: "Easy with the right supplements", correct: false },
        ],
        explanation: "Body recomposition is possible, especially for beginners, but it's slower than focusing on one goal. It requires careful nutrition and consistent training.",
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "To build muscle, you must always be in a large calorie surplus.",
        answer: false,
        explanation: "A slight surplus is beneficial, but beginners can build muscle even in a deficit. Large surpluses mostly add fat.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Energy _______ = Energy In vs Energy Out.",
        options: ['balance', 'creation', 'loss', 'intake'],
        answer: 'balance',
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What requires a calorie surplus?",
        options: [
          { text: "Maximum muscle growth", correct: true },
          { text: "Optimal performance", correct: true },
          { text: "Fat loss", correct: false },
          { text: "Recovery from intense training", correct: true },
          { text: "Maintaining weight", correct: false },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "What happens in a calorie deficit over time?",
        items: [
          "You consume less energy than you burn",
          "Body taps into stored energy (fat, glycogen)",
          "Weight decreases over time",
          "Body may also burn some muscle if protein is low",
          "Eventually weight stabilizes at lower level",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "A 500-calorie daily deficit will result in about 1 pound of fat loss per week.",
        answer: true,
        explanation: "One pound of body fat contains roughly 3,500 calories. A 500-calorie daily deficit × 7 days = 3,500 calories = approximately 1 pound of fat loss per week.",
      },
    ],
  },
  {
    id: 'fuel-1-5',
    unitId: 'fuel-1',
    order: 5,
    title: "Why Energy Affects Everything",
    content: {
      intro: `Your brain monitors your body budget constantly. Energy availability affects far more than weight.

Low energy availability triggers:
- Reduced thyroid function (lower metabolism)
- Decreased sex hormones (reproductive system "expensive")
- Lower mood (brain conserving resources)
- Weaker immune function (defense is costly)
- Reduced motivation (prevents costly activities)

This is why crash diets backfire: Your body fights back by lowering output. Sustainable change requires adequate fueling, not starvation.`,
      keyPoint: "Energy affects everything: mood, hormones, metabolism, immunity, motivation. Underfueling triggers conservation mode.",
    },
    games: [
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What can chronic undereating cause?",
        options: [
          { text: "Reduced thyroid function", correct: true },
          { text: "Increased energy", correct: false },
          { text: "Hormonal disruption", correct: true },
          { text: "Lower mood", correct: true },
          { text: "Weaker immunity", correct: true },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Someone eats 1,000 calories daily for months. They feel cold, tired, moody, and stop losing weight despite the low intake.",
        question: "What's happening?",
        options: [
          { text: "They need to eat even less", correct: false },
          { text: "Their body entered conservation mode—metabolism slowed to match low intake", correct: true },
          { text: "They're not tracking accurately", correct: false },
        ],
        explanation: "Severe restriction triggers metabolic adaptation. The body lowers output to survive on the low input. This is why sustainable deficits work better than crashes.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Crash diets often fail because the body _______ its energy output.",
        options: ['reduces', 'increases', 'maintains', 'ignores'],
        answer: 'reduces',
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Chronic undereating", right: "Body enters conservation mode" },
          { left: "Reduced thyroid function", right: "Lower metabolism" },
          { left: "Decreased sex hormones", right: "Reproductive system 'expensive'" },
          { left: "Sustainable deficit", right: "Body adapts without shutting down" },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "What happens during prolonged severe calorie restriction?",
        items: [
          "Body detects significant energy deficit",
          "Metabolism slows to conserve energy",
          "Non-essential functions reduce (hormones, mood)",
          "Weight loss stalls despite low intake",
          "Eating 'normal' again causes rapid regain",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "If you're not losing weight, you should always eat less.",
        answer: false,
        explanation: "Sometimes you're eating too little and your body has slowed metabolism to match. Sustainable change often requires adequate fueling, not more restriction.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What are signs your body might be in 'conservation mode' from undereating?",
        options: [
          { text: "Feeling cold often", correct: true },
          { text: "Constant fatigue", correct: true },
          { text: "Low mood and motivation", correct: true },
          { text: "High energy and drive", correct: false },
          { text: "Weight loss plateau despite low intake", correct: true },
        ],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Someone has been eating 1,200 calories for 6 months. They've lost weight initially but now feel terrible, aren't losing anymore, and are scared to eat more because they think they'll gain.",
        question: "What's likely happening?",
        options: [
          { text: "They need to eat even less to continue progress", correct: false },
          { text: "Their body has adapted by lowering metabolism; eating more might actually help", correct: true },
          { text: "They've reached their final weight", correct: false },
        ],
        explanation: "Chronic restriction causes metabolic adaptation. Sometimes 'reverse dieting' (gradually increasing calories) helps restore metabolism before trying to lose more weight.",
      },
    ],
  },
];

// =============================================================================
// EXPORT ALL LESSONS
// =============================================================================

export const LESSONS = {
  // Mind Module
  'mind-1': MIND_1_LESSONS,
  'mind-2': MIND_2_LESSONS,
  'mind-3': MIND_3_LESSONS,
  'mind-4': MIND_4_LESSONS,
  'mind-5': MIND_5_LESSONS,

  // Body Module (Unit 1 complete, others to be added)
  'body-1': BODY_1_LESSONS,
  'body-2': [], // To be added
  'body-3': [], // To be added
  'body-4': [], // To be added
  'body-5': [], // To be added

  // Fuel Module (Unit 1 complete, others to be added)
  'fuel-1': FUEL_1_LESSONS,
  'fuel-2': [], // To be added
  'fuel-3': [], // To be added
  'fuel-4': [], // To be added
  'fuel-5': [], // To be added
};

/**
 * Get lessons for a specific unit
 */
export const getLessonsForUnit = (unitId) => {
  return LESSONS[unitId] || [];
};

/**
 * Get a specific lesson by ID
 */
export const getLessonById = (lessonId) => {
  for (const unitLessons of Object.values(LESSONS)) {
    const lesson = unitLessons.find(l => l.id === lessonId);
    if (lesson) return lesson;
  }
  return null;
};

/**
 * Get total lesson count
 */
export const getTotalLessonCount = () => {
  return Object.values(LESSONS).reduce((total, unitLessons) => total + unitLessons.length, 0);
};

/**
 * Get completed lesson count for progress display
 * Placeholder - will be connected to database
 */
export const getCompletedLessonCount = (userProgress) => {
  return Object.keys(userProgress?.completedLessons || {}).length;
};

export default {
  LESSONS,
  getLessonsForUnit,
  getLessonById,
  getTotalLessonCount,
  getCompletedLessonCount,
};
