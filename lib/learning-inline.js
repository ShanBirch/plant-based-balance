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
        // Additional units abbreviated for space - using placeholders
        'mind-3': [], 'mind-4': [], 'mind-5': [],
        'body-1': [], 'body-2': [], 'body-3': [], 'body-4': [], 'body-5': [],
        'fuel-1': [], 'fuel-2': [], 'fuel-3': [], 'fuel-4': [], 'fuel-5': [],
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

    async function initLearning() {
        learningState.isLoading = true;
        renderLearningLoading();

        try {
            if (window.supabase && window.currentUser) {
                const { data, error } = await window.supabase.rpc('get_learning_summary', {
                    p_user_id: window.currentUser.id
                });

                if (!error && data) {
                    learningState.userProgress = data;
                }
            }
        } catch (err) {
            console.error('Error loading learning progress:', err);
        }

        if (!learningState.userProgress) {
            learningState.userProgress = {
                lessons_completed: [],
                units_completed: [],
                modules_completed: [],
                daily_status: { can_learn: true, lessons_remaining: 3 }
            };
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
        const overlay = document.createElement('div');
        overlay.id = 'game-feedback-overlay';
        overlay.style.cssText = `
            position: fixed; bottom: 0; left: 0; right: 0;
            background: ${isCorrect ? '#10b981' : '#ef4444'};
            padding: 25px 20px; border-radius: 20px 20px 0 0;
            z-index: 1000; transform: translateY(100%);
            transition: transform 0.3s ease;
        `;

        overlay.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: ${explanation ? '15px' : '0'};">
                <div style="width: 50px; height: 50px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
                    ${isCorrect ? '✓' : '✗'}
                </div>
                <div style="flex: 1;">
                    <div style="font-size: 1.2rem; font-weight: 700; color: white;">${isCorrect ? 'Correct!' : 'Not quite'}</div>
                </div>
            </div>
            ${explanation ? `<p style="color: rgba(255,255,255,0.95); font-size: 0.95rem; line-height: 1.5; margin: 0 0 20px;">${explanation}</p>` : ''}
            <button onclick="window.continueAfterFeedback()" style="width: 100%; background: white; color: ${isCorrect ? '#10b981' : '#ef4444'}; border: none; padding: 14px; border-radius: 12px; font-size: 1rem; font-weight: 700; cursor: pointer;">Continue</button>
        `;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => { overlay.style.transform = 'translateY(0)'; });
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

        let result = { xp_earned: 0, is_new_lesson: true };

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
                if (!error && data) result = data;
            }
        } catch (err) {
            console.error('Error completing lesson:', err);
        }

        renderLessonComplete(result, lesson, module);
        initLearning(); // Refresh progress
    }

    function renderLessonComplete(result, lesson, module) {
        const container = document.getElementById('learning-content');
        if (!container) return;

        const scorePercent = learningState.gamesPlayed > 0
            ? Math.round((learningState.gamesCorrect / learningState.gamesPlayed) * 100)
            : 100;

        container.innerHTML = `
            <div style="min-height: 100vh; background: linear-gradient(180deg, ${module.color} 0%, ${module.color}dd 50%, #f8fafc 50%); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; text-align: center;">
                <div style="width: 100px; height: 100px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 25px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
                    <span style="font-size: 50px;">${scorePercent >= 80 ? '🎉' : scorePercent >= 60 ? '👍' : '💪'}</span>
                </div>

                <h1 style="color: white; font-size: 1.8rem; font-weight: 700; margin: 0 0 10px;">Lesson Complete!</h1>
                <p style="color: rgba(255,255,255,0.9); font-size: 1rem; margin: 0 0 30px;">${lesson.title}</p>

                <div style="background: white; border-radius: 20px; padding: 25px; width: 100%; max-width: 320px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                    <div style="display: flex; justify-content: space-around; margin-bottom: 20px;">
                        <div style="text-align: center;">
                            <div style="font-size: 2rem; font-weight: 700; color: var(--text-main);">${scorePercent}%</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted);">Score</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 2rem; font-weight: 700; color: ${result?.xp_earned > 0 ? '#10b981' : 'var(--text-muted)'};">${result?.xp_earned > 0 ? '+' + result.xp_earned : '0'}</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted);">XP Earned</div>
                        </div>
                    </div>
                    ${result?.is_new_lesson === false ? `
                        <div style="padding: 12px; background: #fef3c7; border-radius: 10px; font-size: 0.85rem; color: #92400e;">
                            Already completed. No additional XP.
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
