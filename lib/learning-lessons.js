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
      intro: `Here's something profound: Hunger isn't a direct readout of your stomach. Fatigue isn't a direct measure of muscle depletion. Motivation isn't a direct reflection of your capabilities. Even emotions aren't direct responses to events.

These are all PREDICTIONS your brain makes about your body's state.

Your brain asks: "Given the time of day, what I've eaten, and my history—I probably need food soon." That prediction becomes the feeling of hunger.

This is why you can feel hungry at your usual lunchtime even if you ate late breakfast. Your brain predicted hunger based on the clock, not your actual stomach. It's also why jet lag messes with appetite—your body clock predictions are wrong.

Even more surprising: Research shows that people can't reliably tell the difference between hunger and thirst, or between anxiety and excitement. The body sensations are nearly identical—your brain just predicts different causes.

This is both humbling and empowering. Your feelings are real, but they're interpretations, not facts. You can learn to reinterpret them. In fact, studies show that people who reframe "I'm anxious" as "I'm excited" actually perform better—because they change the brain's prediction without fighting the body sensation.`,
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

Here's the proof: Studies show marathon runners' "wall" happens at different points depending on whether they know the course distance. When told they're running further than expected, the wall shifts accordingly—even though their bodies are identical. The "wall" is a prediction, not a physical limit.

Similarly, athletes given fake performance feedback push harder or fade earlier based on what they're told, not their actual physiology. Your brain sets limits based on what it predicts will be safe.

This is why fatigue often lifts when something exciting happens—your brain reassesses and decides you can afford more output. Even energizing music can shift your fatigue level. It's also why fatigue feels worse when you're dreading an activity—your brain predicts higher cost.

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

This is why trauma can feel so present—similar cues trigger the brain to predict the past will repeat. A smell, a sound, a body position, or a familiar place can transport someone back to a traumatic moment because the brain is predicting that past will happen again.

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

This is called "affordance"—what an object or situation affords you based on your history, what you've been told, and your current physical capabilities. A ladder affords climbing to someone who's climbed before. To a toddler who's never used one, it might just afford "touching" or "dangerous."

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

Remarkably, placebo effects can occur even when people know they're taking a placebo—the brain's predictive machinery is that automatic.

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
        question: "What physiological chain reaction does the placebo effect trigger?",
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
          { left: "Repeated avoidance of challenges", right: "Brain predicts failure" },
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
          { left: "Lats", right: "Back" },
          { left: "Deltoids", right: "Shoulders" },
          { left: "Glutes", right: "Lower body powerhouse" },
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
        explanation: "Biceps and triceps are both arm muscles, which are part of the upper body.",
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
          { left: "Upper body", right: "Chest, shoulders, lats, traps, biceps, triceps" },
          { left: "Core", right: "Abdominals and obliques" },
          { left: "Lower body", right: "Quadriceps, hamstrings, glutes, calves" },
          { left: "Connected system", right: "All groups work together" },
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

This is why muscles work in pairs. Your biceps bends your elbow by contracting. Your triceps straightens it by contracting and pulling the other way. Similarly, your quadriceps extend your knee while your hamstrings bend it.

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
          "Nutrition and rest enable recovery",
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
          { left: "Muscle repair", right: "Happens with nutrition and rest" },
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

When you lift weights, you create mechanical tension (the force your muscles produce) and metabolic stress (the burning sensation from byproducts) that damages muscle fibers. Your body responds by repairing these fibers thicker and stronger—but ONLY if you provide:

1. Progressive overload—gradually increasing demands (more weight, more reps or sets, or better form)
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
          { left: "Sleep", right: "When actual muscle building happens" },
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

Most people have roughly 50/50, but genetics and training can shift this balance. Endurance training (higher reps, lighter weight) develops Type I; heavy, explosive training develops Type II (think compound movements, heavier loads, lower rep ranges of 3-8, with full recovery between sets).

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

When you build muscle, your muscle cells gain new nuclei to support the larger size. These nuclei come from specialized cells called "satellite cells" that donate their nuclei to growing muscle fibers. Scientists call this the "myonuclear domain theory"—each nucleus controls a specific region of muscle fiber.

If you stop training (detraining), you lose muscle size—but the extra nuclei remain for years, possibly forever. This means regaining lost muscle is much faster than building it initially. Your muscles "remember" their previous size and rebuild quickly using those existing nuclei.

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
          { text: "Neural pathways are still intact", correct: false },
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
// BODY MODULE - UNIT 2: HORMONES
// =============================================================================

const BODY_2_LESSONS = [
  {
    id: 'body-2-1',
    unitId: 'body-2',
    order: 1,
    title: "The Chemical Messenger System",
    content: {
      intro: `Hormones aren't feelings. They're chemical molecules that carry instructions from one part of your body to another.

Think of hormones as text messages sent through your bloodstream. Glands produce them, blood carries them, and cells with the right receptors receive them. A hormone that reaches a cell without the matching receptor is ignored—like a locked phone.

The endocrine system includes your hypothalamus, pituitary, thyroid, adrenals, pancreas, and gonads (ovaries or testes). These glands communicate constantly, adjusting hormone levels based on feedback loops.

Here's what makes hormones different from nerves: Nerves send fast, targeted signals (milliseconds). Hormones send slower, body-wide signals (seconds to hours). Nerves are like phone calls to one person. Hormones are like broadcasts that anyone tuned in can receive.

Most hormones work through negative feedback. When a hormone's effect reaches a threshold, the body reduces production. Your thermostat works this way—heat turns off when the target temperature is reached. This keeps your internal environment stable without conscious effort.

Every hormone you'll learn about does something specific and measurable. "Stress hormone" or "happy hormone" are oversimplifications that obscure what these molecules actually do in your cells.`,
      keyPoint: "Hormones are chemical messengers that travel through blood to cells with matching receptors, creating body-wide effects regulated by feedback loops.",
    },
    games: [
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Hormones are basically the same as emotions or feelings.",
        answer: false,
        explanation: "Hormones are physical molecules with specific chemical structures. They can influence how you feel, but they're not feelings themselves—they're messengers carrying instructions.",
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Nerve signals", right: "Fast, targeted (milliseconds)" },
          { left: "Hormone signals", right: "Slower, body-wide (seconds to hours)" },
          { left: "Glands", right: "Produce hormones" },
          { left: "Receptors", right: "Receive hormone messages" },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Hormones travel through your _______ to reach target cells.",
        options: ['bloodstream', 'nerves', 'muscles', 'thoughts'],
        answer: 'bloodstream',
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Which are part of the endocrine (hormone) system?",
        options: [
          { text: "Pituitary gland", correct: true },
          { text: "Thyroid", correct: true },
          { text: "Biceps muscle", correct: false },
          { text: "Adrenal glands", correct: true },
          { text: "Pancreas", correct: true },
          { text: "Stomach lining", correct: false },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "How does hormone signaling work?",
        items: [
          "Gland produces hormone",
          "Hormone enters bloodstream",
          "Blood carries hormone throughout body",
          "Cells with matching receptors receive signal",
          "Target cells change their behavior",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "A hormone is released into the bloodstream. Some cells respond dramatically while others ignore it completely.",
        question: "Why do different cells respond differently?",
        options: [
          { text: "Some cells are healthier than others", correct: false },
          { text: "Only cells with matching receptors can 'hear' the hormone's message", correct: true },
          { text: "The hormone runs out before reaching all cells", correct: false },
        ],
        explanation: "Hormones are like radio broadcasts—only devices tuned to that frequency pick up the signal. Cells without the right receptors simply can't respond.",
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Negative feedback means your body reduces hormone production when the effect is strong enough.",
        answer: true,
        explanation: "Like a thermostat turning off heat when the room is warm enough, negative feedback prevents hormones from overshooting their target effect.",
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Calling cortisol 'the stress hormone' is an _______ of what it actually does.",
        options: ['oversimplification', 'accurate description', 'scientific fact', 'medical term'],
        answer: 'oversimplification',
      },
    ],
  },
  {
    id: 'body-2-2',
    unitId: 'body-2',
    order: 2,
    title: "Energy Mobilizers",
    content: {
      intro: `Cortisol and adrenaline aren't "stress hormones." They're energy mobilizers—their job is to make fuel available for expensive activities.

CORTISOL does several concrete things: It tells your liver to convert stored glycogen into glucose (glycogenolysis). It triggers the creation of new glucose from protein and fat (gluconeogenesis). It suppresses systems that cost energy but aren't immediately necessary—immune function, digestion, reproduction.

Why suppress those systems? Because your body has a limited energy budget. If your brain predicts you'll need energy for something demanding, cortisol shifts resources toward immediate availability. This isn't "stress"—it's resource allocation.

Cortisol follows a daily rhythm: highest in the morning (preparing you for the day), lowest at night (allowing recovery). Chronic elevation disrupts this rhythm, keeping your body in constant mobilization mode—which depletes resources over time.

ADRENALINE (epinephrine) works faster than cortisol. It increases heart rate, dilates airways, redirects blood to muscles, and releases glucose from the liver—all within seconds. Noradrenaline does similar things while also sharpening focus and attention.

The "fight or flight" response isn't about fear. It's about rapid energy availability. Your body doesn't know whether you're fleeing a predator or doing a heavy squat set—it just knows something metabolically expensive is happening and mobilizes accordingly.`,
      keyPoint: "Cortisol and adrenaline mobilize energy by releasing glucose stores and redirecting resources to immediate needs—this is preparation, not panic.",
    },
    games: [
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Cortisol's main job is to make you feel stressed.",
        answer: false,
        explanation: "Cortisol's job is to mobilize energy—converting stored fuel to available glucose and reallocating resources. You might feel 'stressed' as a side effect, but that's not its purpose.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What does cortisol actually do?",
        options: [
          { text: "Tells liver to release glucose", correct: true },
          { text: "Creates new glucose from protein and fat", correct: true },
          { text: "Suppresses immune function to save energy", correct: true },
          { text: "Makes you feel anxious", correct: false },
          { text: "Reduces digestive activity", correct: true },
          { text: "Causes depression", correct: false },
        ],
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Glycogenolysis", right: "Breaking glycogen into glucose" },
          { left: "Gluconeogenesis", right: "Making new glucose from protein/fat" },
          { left: "Morning cortisol spike", right: "Preparing for the day ahead" },
          { left: "Suppressed digestion", right: "Saving energy for immediate needs" },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Adrenaline increases heart rate, dilates airways, and releases glucose—all to make _______ available.",
        options: ['energy', 'stress', 'fear', 'emotions'],
        answer: 'energy',
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "What happens during an adrenaline response?",
        items: [
          "Brain predicts demanding situation",
          "Adrenal glands release adrenaline",
          "Heart rate increases",
          "Blood redirects to muscles",
          "Glucose floods into bloodstream",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "An athlete before a competition and someone about to give a speech both experience racing hearts, sweaty palms, and heightened alertness.",
        question: "What's happening in both cases?",
        options: [
          { text: "Both are experiencing harmful stress", correct: false },
          { text: "Their bodies are mobilizing energy for a demanding task", correct: true },
          { text: "They're both scared and should calm down", correct: false },
        ],
        explanation: "The same physiological preparation happens whether you're excited or nervous. Your body doesn't distinguish—it just makes energy available for something metabolically expensive.",
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Cortisol should be highest in the morning and lowest at night.",
        answer: true,
        explanation: "This natural rhythm prepares you for daily demands and allows recovery at night. Chronic stress disrupts this pattern, keeping cortisol elevated when it should drop.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Why is chronically elevated cortisol problematic?",
        options: [
          { text: "Constantly breaks down tissue for fuel", correct: true },
          { text: "Suppresses immune function long-term", correct: true },
          { text: "Disrupts sleep and recovery", correct: true },
          { text: "Cortisol is always bad", correct: false },
          { text: "Depletes energy reserves over time", correct: true },
        ],
      },
    ],
  },
  {
    id: 'body-2-3',
    unitId: 'body-2',
    order: 3,
    title: "The Anabolic Messengers",
    content: {
      intro: `While cortisol mobilizes and breaks down, anabolic hormones build up. The main players: testosterone, growth hormone, and IGF-1.

TESTOSTERONE isn't just a "male hormone." Both sexes produce it—men in the testes (~7mg/day), women in the ovaries and adrenals (~0.5mg/day). It does concrete things: stimulates muscle protein synthesis, increases bone density, promotes red blood cell production, and affects fat distribution.

In muscle cells, testosterone enters and binds to androgen receptors, which then travel to the nucleus and activate genes for protein synthesis. More testosterone + more receptors = more protein synthesis = more muscle growth potential.

GROWTH HORMONE (GH) is released primarily during deep sleep and after intense exercise. It doesn't directly build muscle—instead, it triggers the liver to produce IGF-1 (Insulin-like Growth Factor 1), which does the actual building. GH also promotes fat breakdown (lipolysis) and helps maintain blood glucose.

IGF-1 is the workhorse. It stimulates muscle cell growth, helps repair damaged tissue, and promotes cell division. Training creates muscle damage; IGF-1 helps repair it bigger and stronger.

These hormones work together. Resistance training elevates all three. Sleep deprivation crushes growth hormone release. Chronic stress (elevated cortisol) suppresses testosterone. Your lifestyle directly influences this anabolic environment.`,
      keyPoint: "Testosterone, growth hormone, and IGF-1 promote tissue building through specific cellular mechanisms—they're affected by training, sleep, and stress.",
    },
    games: [
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Testosterone is only produced in males.",
        answer: false,
        explanation: "Both sexes produce testosterone—men make about 7mg/day, women make about 0.5mg/day. It's essential for muscle maintenance, bone health, and libido in everyone.",
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Testosterone", right: "Activates protein synthesis genes" },
          { left: "Growth hormone", right: "Triggers IGF-1 production" },
          { left: "IGF-1", right: "Directly repairs and builds tissue" },
          { left: "Cortisol", right: "Suppresses anabolic hormones" },
        ],
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "How does growth hormone build muscle?",
        items: [
          "Deep sleep or intense exercise occurs",
          "Pituitary releases growth hormone",
          "GH travels to liver",
          "Liver produces IGF-1",
          "IGF-1 stimulates muscle repair and growth",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What does testosterone actually do in the body?",
        options: [
          { text: "Stimulates muscle protein synthesis", correct: true },
          { text: "Increases aggression (its main purpose)", correct: false },
          { text: "Increases bone density", correct: true },
          { text: "Promotes red blood cell production", correct: true },
          { text: "Makes people competitive", correct: false },
          { text: "Affects fat distribution patterns", correct: true },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Growth hormone is released primarily during _______ and after intense exercise.",
        options: ['deep sleep', 'eating', 'sitting', 'morning'],
        answer: 'deep sleep',
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Two people do identical strength training programs. One sleeps 8 hours nightly, the other averages 5 hours. After 12 weeks, their results differ significantly.",
        question: "Why does the sleep-deprived person gain less muscle?",
        options: [
          { text: "They didn't train hard enough", correct: false },
          { text: "Reduced growth hormone release during poor sleep limits IGF-1 and tissue repair", correct: true },
          { text: "Sleep doesn't affect muscle building", correct: false },
        ],
        explanation: "Growth hormone release is heavily concentrated during deep sleep phases. Poor sleep = less GH = less IGF-1 = impaired recovery and growth.",
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "IGF-1 directly stimulates muscle cell growth and tissue repair.",
        answer: true,
        explanation: "While growth hormone gets the credit, IGF-1 is the molecule that actually enters cells and promotes growth, repair, and regeneration.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What lifestyle factors support anabolic hormone production?",
        options: [
          { text: "Resistance training", correct: true },
          { text: "Adequate deep sleep", correct: true },
          { text: "Managing chronic stress", correct: true },
          { text: "Skipping meals", correct: false },
          { text: "Intense resistance training", correct: true },
          { text: "Sleep deprivation", correct: false },
        ],
      },
    ],
  },
  {
    id: 'body-2-4',
    unitId: 'body-2',
    order: 4,
    title: "Metabolic Regulators",
    content: {
      intro: `Your metabolism runs on a carefully orchestrated set of hormones that manage energy storage, release, and expenditure.

INSULIN is released when blood glucose rises (after eating). It tells cells to absorb glucose, signals the liver to store glucose as glycogen, promotes fat storage, and stimulates protein synthesis. Insulin is your "fed state" coordinator—it says "energy is abundant, store it."

GLUCAGON does the opposite. When blood glucose drops, glucagon tells the liver to break down glycogen and release glucose. It promotes fat breakdown for fuel. Glucagon is your "fasted state" coordinator—it says "mobilize stored energy."

THYROID HORMONES (T3 and T4) set your metabolic rate—how fast your cells use energy. They affect virtually every tissue: heart rate, body temperature, how quickly you burn calories at rest. An underactive thyroid slows everything down; overactive speeds everything up. Thyroid function is sensitive to iodine availability, chronic stress, sleep disruption, and severe calorie restriction.

LEPTIN is produced by fat cells. More fat = more leptin = signal to brain that energy stores are sufficient. It reduces appetite and increases energy expenditure. GHRELIN is produced mainly in the stomach when it's empty. It signals hunger and promotes food-seeking behavior.

Here's the catch: In obesity, leptin resistance can develop—the brain stops "hearing" leptin's signal despite high levels. And with chronic dieting, ghrelin increases while leptin drops, creating a hormonal push toward eating. This is why willpower alone rarely beats hormonal drives.`,
      keyPoint: "Insulin stores energy, glucagon releases it, thyroid sets the burn rate, and leptin/ghrelin regulate hunger—these hormones, not willpower, control metabolism.",
    },
    games: [
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Insulin", right: "Store energy (fed state)" },
          { left: "Glucagon", right: "Release energy (fasted state)" },
          { left: "Leptin", right: "Signal fullness (from fat cells)" },
          { left: "Ghrelin", right: "Signal hunger (from stomach)" },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Insulin's job is to lower blood sugar.",
        answer: false,
        explanation: "Lower blood sugar is a side effect, not the purpose. Insulin's job is to coordinate the fed state—storing glucose, building fat, promoting protein synthesis when energy is abundant.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What does insulin actually do?",
        options: [
          { text: "Tells cells to absorb glucose", correct: true },
          { text: "Signals liver to store glycogen", correct: true },
          { text: "Promotes fat storage", correct: true },
          { text: "Burns fat for fuel", correct: false },
          { text: "Stimulates protein synthesis", correct: true },
          { text: "Releases stored energy", correct: false },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Thyroid hormones set your metabolic _______—how fast your cells use energy.",
        options: ['rate', 'size', 'color', 'location'],
        answer: 'rate',
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "What happens after you eat a meal?",
        items: [
          "Food digests, glucose enters blood",
          "Pancreas detects rising glucose",
          "Insulin is released",
          "Cells absorb glucose from blood",
          "Excess glucose stored as glycogen or fat",
        ],
        correctOrder: [0, 1, 2, 3, 4],
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "Someone loses 50 pounds through dieting. Despite reaching their goal weight, they constantly feel hungry and regain the weight within two years.",
        question: "What's happening hormonally?",
        options: [
          { text: "They lack willpower and discipline", correct: false },
          { text: "Leptin dropped and ghrelin increased, creating powerful hunger signals their brain can't ignore", correct: true },
          { text: "They didn't exercise enough", correct: false },
        ],
        explanation: "Weight loss reduces leptin (fullness signal) and increases ghrelin (hunger signal). The brain perceives this as starvation and drives eating behavior. This is biology, not weakness.",
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "More body fat produces more leptin, which should reduce appetite.",
        answer: true,
        explanation: "This is how it's supposed to work. But in obesity, leptin resistance can develop—the brain stops responding to the signal, even though leptin levels are high.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What affects thyroid hormone function?",
        options: [
          { text: "Iodine intake", correct: true },
          { text: "Chronic stress", correct: true },
          { text: "Sleep quality", correct: true },
          { text: "Hair color", correct: false },
          { text: "Severe calorie restriction", correct: true },
          { text: "Eye color", correct: false },
        ],
      },
    ],
  },
  {
    id: 'body-2-5',
    unitId: 'body-2',
    order: 5,
    title: "Sex Hormones in Context",
    content: {
      intro: `Estrogen, progesterone, and testosterone exist in everyone—in different ratios and patterns that change across life.

ESTROGEN (primarily estradiol) isn't just a "female hormone." It strengthens bones, protects cardiovascular health, affects brain function and mood, maintains skin elasticity, and regulates fat distribution. Men need it too—low estrogen in men causes bone loss and cognitive issues.

In females, estrogen fluctuates across the menstrual cycle. The first half (follicular phase) sees rising estrogen, which improves insulin sensitivity, increases pain tolerance, and supports higher-intensity training. The second half (luteal phase) has more progesterone, which slightly raises body temperature and metabolic rate but can reduce exercise performance.

PROGESTERONE has a calming effect on the nervous system (it enhances GABA receptors). It raises body temperature, affects fluid retention, and prepares the body for pregnancy. Low progesterone relative to estrogen can cause anxiety and sleep problems.

TESTOSTERONE in females (remember, about 0.5mg/day vs men's 7mg) is crucial for libido, energy, muscle maintenance, and bone health. Testosterone in both sexes declines with age—about 1-2% per year after 30.

These hormones interact with everything else. High cortisol suppresses sex hormone production. Poor sleep disrupts the entire endocrine system. Training affects hormone profiles in both sexes. Understanding these interactions, rather than isolated hormones, is what matters.`,
      keyPoint: "Estrogen, progesterone, and testosterone exist in everyone in different ratios—they affect bones, brain, metabolism, and interact with all other hormones.",
    },
    games: [
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "Estrogen is only important for females.",
        answer: false,
        explanation: "Men need estrogen for bone health, brain function, and cardiovascular protection. Low estrogen in men causes real health problems.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "What does estrogen do in the body?",
        options: [
          { text: "Strengthens bones", correct: true },
          { text: "Only regulates periods", correct: false },
          { text: "Protects cardiovascular system", correct: true },
          { text: "Affects brain function and mood", correct: true },
          { text: "Maintains skin elasticity", correct: true },
          { text: "Has no effect on men", correct: false },
        ],
      },
      {
        type: GAME_TYPES.MATCH_PAIRS,
        pairs: [
          { left: "Follicular phase (first half)", right: "Rising estrogen, better insulin sensitivity" },
          { left: "Luteal phase (second half)", right: "Higher progesterone, raised temperature" },
          { left: "Progesterone", right: "Calming effect via GABA receptors" },
          { left: "Testosterone after 30", right: "Declines 1-2% per year" },
        ],
      },
      {
        type: GAME_TYPES.FILL_BLANK,
        sentence: "Women produce about _______ of testosterone per day, which is important for libido and muscle maintenance.",
        options: ['0.5mg', '7mg', '0mg', '20mg'],
        answer: '0.5mg',
      },
      {
        type: GAME_TYPES.SCENARIO_STORY,
        scenario: "A woman notices she performs better in the gym during the first two weeks of her cycle, then feels more fatigued in weeks 3-4.",
        question: "What explains this pattern?",
        options: [
          { text: "It's psychological—cycles don't affect performance", correct: false },
          { text: "Higher estrogen in the follicular phase improves insulin sensitivity and training response", correct: true },
          { text: "She should train the same regardless of cycle", correct: false },
        ],
        explanation: "The follicular phase (weeks 1-2) has rising estrogen which enhances performance. The luteal phase (weeks 3-4) has more progesterone which can reduce intensity capacity. Smart training accounts for this.",
      },
      {
        type: GAME_TYPES.TAP_ALL,
        question: "Why does testosterone matter for females?",
        options: [
          { text: "Maintains libido and sexual function", correct: true },
          { text: "It doesn't—testosterone is only for males", correct: false },
          { text: "Supports muscle maintenance", correct: true },
          { text: "Contributes to bone density", correct: true },
          { text: "Affects energy levels", correct: true },
        ],
      },
      {
        type: GAME_TYPES.SWIPE_TRUE_FALSE,
        question: "High chronic stress suppresses sex hormone production in both males and females.",
        answer: true,
        explanation: "Chronic cortisol elevation directly inhibits the hypothalamic-pituitary-gonadal axis, reducing testosterone, estrogen, and progesterone production.",
      },
      {
        type: GAME_TYPES.ORDER_SEQUENCE,
        question: "How do lifestyle factors affect sex hormones?",
        items: [
          "Chronic stress, poor sleep, or under-eating occurs",
          "Brain detects unfavorable conditions",
          "Signals to reproductive axis decrease",
          "Sex hormone production drops",
          "Libido, energy, and recovery suffer",
        ],
        correctOrder: [0, 1, 2, 3, 4],
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

Your body extracts energy from food and uses it to power everything: breathing, thinking, moving, digesting, maintaining temperature, and repairing tissue. Your body breaks down the macronutrients in food—carbs, protein, and fat—to extract this energy. Any excess beyond what you need is stored as body fat or glycogen for later use.

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
        explanation: "BMR—just being alive—accounts for 60-75% of your daily calorie burn. That makes it the majority, not exercise.",
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
        question: "What factors affect your BMR?",
        items: [
          "Body size (bigger bodies burn more)",
          "Muscle mass (muscle costs more energy)",
          "Age (BMR decreases with age)",
          "Genetics (inherited metabolic traits)",
          "All combine to set your baseline burn",
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

TDEE = BMR + Activity (which includes both NEAT—non-exercise activity like walking, fidgeting, daily movement—and deliberate exercise) + TEF (thermic effect of food)

A sedentary person might have a TDEE of just 1.2x their BMR, lightly active around 1.4x, moderately active 1.55x, active around 1.7x, and very active 2x or more.

Eating more protein increases TEF since protein costs more energy to digest. Having more muscle mass raises your BMR component. And increasing NEAT—your daily non-exercise movement—can significantly boost total burn.

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
          { left: "Lightly active", right: "TDEE = BMR × 1.4" },
          { left: "Moderately active", right: "TDEE = BMR × 1.55" },
          { left: "Very active", right: "TDEE = BMR × 2.0+" },
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

A useful rule of thumb: One pound of body fat contains roughly 3,500 calories. This means a 500-calorie daily deficit results in about one pound of fat loss per week (500 × 7 = 3,500).
In a deficit, your body taps stored fat and glycogen. Without adequate protein, muscle can also be lost. Eventually, as your body adapts, weight may stabilize at a lower level.

This isn't just about weight loss. Building muscle typically requires a slight surplus, though beginners or those returning to training can sometimes build muscle in a mild deficit with high protein and resistance training—a slower process called body recomposition. Optimal performance often benefits from at least maintenance-level intake or a slight surplus. Recovery demands adequate energy—undereating impairs it.

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
        explanation: "A slight surplus helps, and beginners may build muscle even in a mild deficit. But large surpluses mostly add fat, not extra muscle.",
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
- Reduced thyroid function (you feel cold, metabolism drops)
- Decreased sex hormones (reproductive system "expensive")
- Lower mood and persistent fatigue (brain conserving resources)
- Weaker immune function (defense is costly)
- Reduced motivation (prevents costly activities)

This is why crash diets backfire: Your body fights back by lowering output, eventually stalling weight loss despite very low intake. When you return to normal eating, your suppressed metabolism means rapid regain. Sustainable change requires adequate fueling, not starvation.`,
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
        explanation: "Chronic restriction causes the body to lower its output. As the lesson explains, sustainable change requires adequate fueling. Sometimes eating more—not less—is the necessary next step to restore metabolism.",
      },
    ],
  },
];

// =============================================================================
// LONGEVITY MODULE - UNIT 1: THE SCIENCE OF AGING
// =============================================================================

const LONGEVITY_1_LESSONS = [
  {
    id: 'longevity-1-1',
    unitId: 'longevity-1',
    order: 1,
    title: "The Hallmarks of Aging",
    content: {
      intro: `Scientists have identified nine biological "hallmarks" that drive aging at the cellular level. Understanding these gives us targets for intervention.

The hallmarks include: genomic instability (DNA damage accumulates), telomere attrition (protective chromosome caps shorten).

And epigenetic alterations (gene expression patterns drift).

These also include loss of proteostasis (protein quality control fails), deregulated nutrient sensing (cells respond poorly to nutrients).

And mitochondrial dysfunction (energy production declines).

Finally, the hallmarks involve cellular senescence (damaged cells accumulate), stem cell exhaustion (regenerative capacity drops).

And altered intercellular communication (cells miscommunicate).

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
          { left: "Young bodies", right: "Efficiently clear senescent cells" },
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
];

// =============================================================================
// LONGEVITY MODULE - UNIT 2: METABOLIC HEALTH
// =============================================================================

const LONGEVITY_2_LESSONS = [
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
          "Protein and fat next",
          "Carbohydrates last",
        ],
        correctOrder: [0, 1, 2],
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
];

// =============================================================================
// LONGEVITY MODULE - UNIT 3: CHRONIC DISEASE PREVENTION
// =============================================================================

const LONGEVITY_3_LESSONS = [
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
        sentence: "Type 2 diabetes affects over ___% of adults.",
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
];

// =============================================================================
// LONGEVITY MODULE - UNIT 4: CELLULAR HEALTH & REPAIR
// =============================================================================

const LONGEVITY_4_LESSONS = [
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
];

// =============================================================================
// LONGEVITY MODULE - UNIT 5: LIFESTYLE MEDICINE
// =============================================================================

const LONGEVITY_5_LESSONS = [
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

What's needed: Aerobic exercise—improves cardiovascular health, mitochondria, mood. Strength training—essential for maintaining muscle mass with age, functional independence, insulin sensitivity, bone health. Movement throughout the day—breaks up sitting, maintains metabolic flexibility. The combination is more powerful than any single type.

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
        ],
        correctOrder: [0, 1, 2, 3],
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
];

// =============================================================================
// WORKOUTS MODULE - Training Science & Programming
// =============================================================================

// Unit 1: Training Fundamentals
const WORKOUTS_1_LESSONS = [
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
        question: "Put the adaptation process in order:",
        items: [
          "Apply training stress",
          "Body enters alarm phase",
          "Recovery begins",
          "Adaptation occurs",
          "Performance improves",
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

Overload can come in many forms: more weight, more reps, more sets, shorter rest periods, better form, increased range of motion, or more training frequency. These can be grouped as: volume overload (more sets or reps), intensity overload (more weight), density overload (shorter rest periods), and technique overload (better form or range of motion). You can also increase training frequency. The key is progression—not doing more every single session, but trending upward over weeks and months.

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
        question: "Progressive overload timeline:",
        items: [
          "Start with appropriate baseline",
          "Body adapts to current stress",
          "Slightly increase demand",
          "Body adapts to new stress",
          "Continue gradual progression",
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
          { text: "Performance automatically keeps increasing", correct: false },
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
        question: "Applying specificity to training:",
        items: [
          "Define your specific goal",
          "Identify what that goal demands",
          "Design training to match those demands",
          "Include some general work for balance",
          "Assess progress toward the goal",
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
        question: "The training-recovery cycle:",
        items: [
          "Apply training stress",
          "Accumulate fatigue and fitness",
          "Begin recovery",
          "Fatigue dissipates",
          "Net performance gain",
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

Common models include: Linear periodization (gradually increase intensity while decreasing volume), undulating periodization (vary intensity within each week), and block periodization (focused blocks on single qualities like strength, then power, then sport-specific). Linear periodization progresses through phases: hypertrophy (high volume, moderate intensity), strength (moderate volume, higher intensity), power (low volume, high intensity), peaking (very low volume, maximum intensity), then a recovery/transition period.

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
        question: "Linear periodization phases:",
        items: [
          "Hypertrophy phase (high volume, moderate intensity)",
          "Strength phase (moderate volume, higher intensity)",
          "Power phase (low volume, high intensity)",
          "Peaking phase (very low volume, maximum intensity)",
          "Recovery/transition phase",
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
];

// Unit 2: Strength Training
const WORKOUTS_2_LESSONS = [
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
        question: "Timeline of strength adaptations:",
        items: [
          "Begin training",
          "Neural adaptations (first weeks)",
          "Rapid strength gains",
          "Hypertrophy begins contributing (longer term)",
          "Continued strength from muscle + neural factors",
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

This is why training goals determine training methods. Maximum strength requires heavy, slower movements with full recovery between sets and progressive overload over time. Power requires lighter, explosive movements. Different adaptations require different stimuli.`,
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
        question: "Force-velocity relationship (from max force to max velocity):",
        items: [
          "Isometric (no movement) - maximum force",
          "Slow heavy lifts - very high force",
          "Moderate speed - moderate force",
          "Fast movements - lower force",
          "Maximum velocity - minimal force",
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

Exercise selection should prioritize compound movements (squat, deadlift, bench, row, press) that train multiple muscles and allow heavy loading.

Within a session: warm up thoroughly, perform compound lifts first when fresh, follow with accessory work, rest adequately between sets, and cool down.`,
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
        question: "Strength training session structure:",
        items: [
          "Warm-up thoroughly",
          "Compound lifts first (fresh)",
          "Accessory work after",
          "Adequate rest between sets",
          "Cool down",
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
        question: "Progression through training ages:",
        items: [
          "Beginner: Linear progression (session to session)",
          "Intermediate: Weekly progression",
          "Advanced: Multi-week periodization",
        ],
        correctOrder: [0, 1, 2],
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
        question: "Core movement patterns to master:",
        items: [
          "Squat (knee-dominant)",
          "Hip hinge (deadlift)",
          "Horizontal push (bench)",
          "Horizontal pull (rows)",
          "Vertical push/pull (press, pull-ups)",
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
];

// Unit 3: Hypertrophy Training
const WORKOUTS_3_LESSONS = [
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
        question: "The muscle growth process:",
        items: [
          "Training applies mechanical tension",
          "Microdamage and signaling occur",
          "Satellite cells activate during recovery",
          "Additional nuclei added to fibers",
          "Muscle protein synthesis increases",
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

Volume landmarks: MEV (Minimum Effective Volume) is the least volume needed to grow. MAV (Maximum Adaptive Volume) is where you grow fastest. MRV (Maximum Recoverable Volume) is the most you can recover from. Exceeding MRV leads to overtraining—watch for persistent fatigue, declining performance, and mood disturbances.

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
        question: "Progressive volume approach:",
        items: [
          "Start at moderate volume (MEV+)",
          "Monitor recovery and progress",
          "Gradually add volume if recovering",
          "Approach MAV for optimal gains",
          "Deload before reaching MRV",
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
          { text: "15-20 sets per week", correct: false },
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
        question: "Hypertrophy training priorities:",
        items: [
          "Train close to failure (1-3 RIR)",
          "Accumulate adequate volume",
          "Progressive overload over time",
          "Use variety of rep ranges",
          "Control tempo appropriately",
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
        question: "Building a hypertrophy exercise selection:",
        items: [
          "Include compound movements as foundation",
          "Add isolation for undertrained muscles",
          "Select exercises for stretched positions",
          "Vary angles for complete development",
          "Ensure safe technique on all exercises",
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
        question: "Hypertrophy progression strategy:",
        items: [
          "Start with weight at bottom of rep range",
          "Add reps session to session",
          "Reach top of target rep range",
          "Increase weight, drop to bottom of range",
          "Repeat the cycle",
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
          { text: "4-6 exercises per session with 3-4 sets each", correct: true },
          { text: "Progressive overload tracking", correct: true },
          { text: "Never taking deloads", correct: false },
        ],
      },
    ],
  },
];

// Unit 4: Cardiovascular Training
const WORKOUTS_4_LESSONS = [
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
        question: "Energy system dominance by duration:",
        items: [
          "0-10 seconds: Phosphagen dominant",
          "10-30 seconds: Phosphagen + glycolytic",
          "30 sec-2 min: Glycolytic dominant",
          "2-5 min: Glycolytic + aerobic",
          "5+ min: Aerobic dominant",
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
Zone 2 (60-70% HRmax): Aerobic base. Fat burning, build endurance, low injury risk. You can hold a conversation.
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
        question: "Heart rate zones from lowest to highest intensity:",
        items: [
          "Zone 1: Recovery (50-60%)",
          "Zone 2: Aerobic base (60-70%)",
          "Zone 3: Tempo (70-80%)",
          "Zone 4: Threshold (80-90%)",
          "Zone 5: Maximum (90-100%)",
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
        question: "Building cardiovascular fitness:",
        items: [
          "Assess your current fitness level",
          "Build an aerobic base first",
          "Add anaerobic work on top",
          "Monitor and adjust over time",
        ],
        correctOrder: [0, 1, 2, 3],
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
        question: "Cardio intensity from lowest to highest:",
        items: [
          "LISS (walking, easy jogging)",
          "MICT (comfortably hard)",
          "HIIT (hard intervals)",
          "SIT (maximum sprints)",
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
        question: "Building a cardio program:",
        items: [
          "Establish LISS base (2-4 weeks)",
          "Increase LISS duration gradually",
          "Add 1-2 HIIT sessions weekly",
          "Include optional tempo work",
          "Progress and adjust based on recovery",
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
];

// Unit 5: Advanced Modalities
const WORKOUTS_5_LESSONS = [
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
        question: "Force-velocity spectrum (from strength to speed):",
        items: [
          "Maximum strength (heavy, slow)",
          "Strength-speed (moderate, faster)",
          "Speed-strength (light, very fast)",
          "Maximum speed (minimal load)",
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
        question: "A balanced HIIT approach:",
        items: [
          "Limit to 2-3 HIIT sessions per week",
          "Allow recovery between sessions",
          "Balance with lower-intensity work",
          "Monitor for signs of burnout or overtraining",
          "Adjust frequency based on fatigue levels",
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
        question: "Warm-up to cool-down structure:",
        items: [
          "General movement (light cardio)",
          "Dynamic mobility/stretching",
          "Workout-specific warm-up",
          "Main training session",
          "Static stretching (optional cool-down)",
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
        question: "Same-day concurrent training order:",
        items: [
          "Plan your training schedule",
          "Do lifting before cardio if same day",
          "Separate hard sessions when possible",
          "Allow adequate recovery between sessions",
          "Monitor and adjust based on progress",
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
        question: "Building your training program:",
        items: [
          "Identify your primary goal",
          "Choose structure that fits your schedule",
          "Include essentials (strength, cardio, mobility)",
          "Apply progressive overload",
          "Track, adjust, and stay consistent",
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

  // Body Module (Units 1-2 complete, others to be added)
  'body-1': BODY_1_LESSONS,
  'body-2': BODY_2_LESSONS,
  'body-3': [], // To be added
  'body-4': [], // To be added
  'body-5': [], // To be added

  // Fuel Module (Unit 1 complete, others to be added)
  'fuel-1': FUEL_1_LESSONS,
  'fuel-2': [], // To be added
  'fuel-3': [], // To be added
  'fuel-4': [], // To be added
  'fuel-5': [], // To be added

  // Longevity Module (All units complete)
  'longevity-1': LONGEVITY_1_LESSONS,
  'longevity-2': LONGEVITY_2_LESSONS,
  'longevity-3': LONGEVITY_3_LESSONS,
  'longevity-4': LONGEVITY_4_LESSONS,
  'longevity-5': LONGEVITY_5_LESSONS,

  // Workouts Module (All units complete)
  'workouts-1': WORKOUTS_1_LESSONS,
  'workouts-2': WORKOUTS_2_LESSONS,
  'workouts-3': WORKOUTS_3_LESSONS,
  'workouts-4': WORKOUTS_4_LESSONS,
  'workouts-5': WORKOUTS_5_LESSONS,
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
