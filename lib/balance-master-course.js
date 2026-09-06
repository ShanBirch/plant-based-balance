/* Balance Master: applied learning and private course projects. */
(function () {
    'use strict';
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const LEGACY_STAGES = [
        { title: 'Know the muscles you train', outcome: 'Connect a muscle to its job and an exercise.',
          lessons: [
            ['Your lower body', 'Your quadriceps straighten the knee. Your hamstrings bend the knee and most also help extend the hip. Your glutes extend the hip, while the muscles at the side of the hip help control the pelvis. Your calves help raise your heel. A balanced week needs more than one favourite leg exercise.'],
            ['Your upper body and core', 'Your chest helps bring the upper arm across your body. Your back muscles help pull the arm and control the shoulder blades. Your shoulders raise and press the arm; biceps bend the elbow and triceps straighten it. Your core helps control your trunk and transfer force. Think about what moves and what stays steady.'],
            ['Turn anatomy into choices', 'A press uses the chest, shoulders and triceps together. A row uses the back with help from the arms. A squat and a hip hinge overlap, but emphasise different actions. Identify the main job of each exercise before adding it. You do not need to memorise every anatomical name to build a balanced plan.']
          ], refs: [['body-1-1', 'What Muscles Actually Do'], ['body-1-2', 'Opposing Pairs'], ['body-3-2', 'The Posterior Chain']],
          questions: [
            ['Which pairing matches a muscle to a main action?', ['Quadriceps: straighten the knee', 'Biceps: straighten the knee', 'Calves: bend the elbow'], 0, 'The quadriceps extend the knee. Use the joint action to understand the exercise.'],
            ['Your plan has plenty of presses but no pulling. What needs attention?', ['More chest work only', 'Back and pulling work', 'Remove every compound exercise'], 1, 'Include pulling work as well as pressing so your plan covers the major muscle groups.']
          ], practice: 'Name one muscle, its main action, and an exercise you use to train it.' },
        { title: 'Understand compound lifts', outcome: 'Film a squat, hinge, push and pull for Shannon to review.',
          lessons: [
            ['Why compounds are useful', 'Compound exercises move more than one joint and involve several muscles. Squats, presses and rows can train a lot in a limited session. Isolation exercises still have a place when a muscle needs more focused work. A compound exercise is useful because of what it trains, not because it must be heavy or use a barbell.'],
            ['Build around movement patterns', 'Use a squat or knee-dominant movement, a hip hinge, a push and a pull as a planning checklist. Across the week, consider both horizontal and vertical upper-body work and some trunk work. Equipment, experience and comfortable movement determine the version you choose. Machines, bands, dumbbells and bodyweight can all be useful.'],
            ['Watch, practise, then load', 'Open the exercise demonstration in Build a Workout. Check the setup, brace, movement path and a range you can control. Practise with a manageable load and stop a set before technique breaks down. For a hinge, move through the hips while controlling your trunk. Do not push through sharp pain; change the exercise and get help if needed. A video is a guide, not an individual technique assessment.']
          ], refs: [['body-2-3', 'Bracing vs. Sucking In'], ['body-4-3', 'Hip Hinge Pattern'], ['body-4-5', 'Movement Quality'], ['workouts-2-5', 'Building Your Strength Foundation']],
          questions: [
            ['Why include a compound lift?', ['It always replaces all other exercises', 'It guarantees you cannot get injured', 'It trains several muscles through multiple joints'], 2, 'Compounds are efficient, but exercise choice still depends on the person and goal.'],
            ['You lose control as the load increases. What comes next?', ['Reduce the load and practise the movement', 'Add more weight immediately', 'Ignore technique if you finish the set'], 0, 'Build control before adding difficulty. Choose a suitable variation if needed.']
          ], practice: 'Choose a compound exercise from the app. Describe its main movement and one setup or technique cue from the demonstration.' },
        { title: 'Build your workout program', outcome: 'Save a repeatable week with exercises and progression.',
          lessons: [
            ['Start with your real week', 'Choose a goal, available days, session length and equipment before choosing exercises. Two or three full-body sessions can be a practical starting structure. Training the major muscle groups at least twice a week is a useful general target for healthy adults. Leave room to recover. A plan you can repeat is more useful than one that only fits an ideal week.'],
            ['Give every exercise a prescription', 'An exercise list becomes a workout when you decide the working sets, repetition range, rest and effort. For a general beginner plan, two working sets of 8 to 12 controlled repetitions can be a starting example, not a rule for every goal. Use a manageable load, leave a few good repetitions available and rest long enough to repeat the work with control. Warm-up sets are separate.'],
            ['Know when to progress', 'Write a progression rule before starting. For example: when every working set reaches the top of the planned rep range with controlled technique and the intended effort, increase the load by the smallest available step next time. If recovery or performance drops, hold steady or reduce the work. Repeat the structure and review your logs instead of changing everything after one session.']
          ], refs: [['workouts-1-2', 'Progressive Overload'], ['workouts-1-3', 'Specificity: Train for Your Goal'], ['workouts-1-4', 'Recovery: The Hidden Half of Training'], ['workouts-3-4', 'Exercise Selection for Growth'], ['workouts-3-5', 'Building a Hypertrophy Program']],
          questions: [
            ['Which is a usable program?', ['A list of favourite exercises only', 'Training days, exercises, sets, reps, rest and a progression rule', 'A new random workout every day'], 1, 'A program tells you what to do, when to do it and how to adjust it.'],
            ['When should the example progression rule increase load?', ['Whenever you are sore', 'After every session regardless of performance', 'After all sets reach the target with control and the intended effort'], 2, 'Use the evidence in your workout log, not soreness, to guide the next step.']
          ], project: 'workout' },
        { title: 'Learn how to build a meal', outcome: 'Choose foods and portions that support your day.',
          lessons: [
            ['Give your food a job', 'Protein supports repair and maintenance. Carbohydrates provide fuel. Fats have essential roles and help meals feel satisfying. Build from foods you enjoy rather than treating one nutrient as good and another as bad. Your total intake and the pattern you can maintain matter more than making one meal perfect.'],
            ['Build a balanced base', 'Start a meal with a protein food, add a grain or other starchy food, include vegetables or fruit, and consider a source of unsaturated fat. For a plant-based meal, examples include tofu, tempeh, beans or lentils, alongside rice, potatoes or whole grains and vegetables. Across the day, include variety and suitable calcium-rich foods such as fortified alternatives.'],
            ['Make portions visible', 'Write a practical portion for each main ingredient: grams, cups, slices or a household measure. Use the app food tools or package label if you need an estimate. Your course planner does not calculate nutrition from a meal name. Use an existing agreed target if you have one; review energy, hunger and training over time. A fully vegan pattern also needs a reliable vitamin B12 source, with individual supplement advice when needed.']
          ], refs: [['fuel-2-1', 'The Three Macros'], ['fuel-2-2', 'Protein Essentials'], ['fuel-2-3', 'Carbohydrates: Not the Enemy'], ['fuel-2-4', 'Fats: Essential, Not Extra'], ['fuel-3-5', 'Food First Approach']],
          questions: [
            ['Which entry is easiest to shop for and repeat?', ['A healthy bowl', 'Eat better', 'Tofu, rice and vegetables with ingredient amounts'], 2, 'Food names and portions make your plan practical and allow more useful nutrition estimates.'],
            ['What makes a plant-based plan useful?', ['Varied foods, protein choices and attention to essential nutrients', 'Removing carbohydrates', 'Making every meal identical forever'], 0, 'Use variety and think about nutrients across your day, including reliable B12 for a vegan pattern.']
          ], practice: 'Describe one meal with its protein source, carbohydrate food, vegetables or fruit, and practical portions.' },
        { title: 'Design one week of meals', outcome: 'Save seven days with shopping, prep and a backup.',
          lessons: [
            ['Plan around your life', 'Choose the coming seven days. Note dietary needs, allergies, budget, cooking time and meals away from home. Pick a few meals you already enjoy. Repeating breakfasts or using dinner leftovers for lunch can make planning much easier. You are designing one workable week, not committing to eating this way forever.'],
            ['Fill the week yourself', 'Write breakfast, lunch and dinner for each day, or describe your usual meal rhythm in those spaces. Add snacks when useful. Include amounts for the main ingredients so each entry can guide preparation. If you are eating out, write a realistic intended choice and flexible portion approach. Copy a previous day when it helps, then adjust it to fit.'],
            ['Turn meals into a shopping plan', 'Check the pantry before making the shopping list. Combine repeated ingredients and note quantities. Write when you will shop and prepare food, then choose a quick backup meal for a busy day. Store and reheat food safely, following the packaging and local food-safety guidance. The form saves your own plan; it does not replace an existing coached meal plan.']
          ], refs: [['fuel-2-5', 'Finding Your Balance'], ['fuel-4-4', 'Meal Frequency'], ['fuel-5-5', 'Sustainable Nutrition']],
          questions: [
            ['What should shape your weekly meal plan?', ['Only recipes that take hours', 'Your schedule, preferences, budget and dietary needs', 'Seven completely different breakfasts'], 1, 'A useful plan fits your real life and can repeat meals.'],
            ['What makes the plan ready to use?', ['Meal names with no portions or preparation', 'An automatic plan you never review', 'Seven days, practical portions, shopping, prep and a backup'], 2, 'The practical details turn an idea into a week you can follow.']
          ], project: 'meal' },
        { title: 'Review and adjust your plans', outcome: 'Explain what you would keep and what you would change.',
          lessons: [
            ['Review the workout', 'Look at completed sessions, exercise performance, effort and recovery. Did the week fit? Did the main muscle groups get trained? If you missed a session because the schedule was unrealistic, adjust the schedule before adding more work. Use your progression rule when performance supports it.'],
            ['Review the food', 'Look at hunger, energy, training, enjoyment, cost and how much preparation you actually managed. A single day or scale reading does not tell the whole story. Adjust portions, meal timing or convenience where the pattern suggests a need. You can keep the meals that worked and replace the ones that did not.'],
            ['Leave with a decision rule', 'Write one change and why you chose it. Then decide what you will observe before changing again. Your goal is to understand your choices and build confidence. Ask Shannon for help when you are unsure about exercise suitability; medical conditions, allergies or complex nutrition needs may require an appropriate health professional.']
          ], refs: [['body-5-4', 'Minimum Effective Dose'], ['body-5-5', 'Patience and Consistency'], ['fuel-5-5', 'Sustainable Nutrition']],
          questions: [
            ['You repeatedly cannot fit your fourth session. What is a sensible first adjustment?', ['Design a realistic three-day structure', 'Add a fifth session', 'Abandon training'], 0, 'Adjust the structure to the week you actually have.'],
            ['Which review is most useful?', ['One bad day means the whole plan failed', 'Keep what works, change one relevant thing and observe the result', 'Change every meal and exercise at once'], 1, 'A clear reason and a manageable change make the result easier to understand.']
          ], practice: 'Review both projects: what will you keep, what is one change you would make, and what evidence will you watch next week?' }
    ];
    const EXTRA_STAGES = [
    {
        "title": "Choose exercises for your muscles",
        "outcome": "Explain your exercise choices and suitable alternatives.",
        "lessons": [
            [
                "Start with the job",
                "Choose exercises by the movement and muscles you want to train, then check whether you can perform them comfortably with the equipment you have. The deeper lessons cover individual muscle groups."
            ],
            [
                "Build coverage",
                "Use your squat, hinge, push and pull as the starting structure. Add focused work where it serves your goal and fits your recovery. You do not need every exercise from the library."
            ],
            [
                "Keep an alternative",
                "Write an alternative for a busy gym or unavailable piece of equipment. Aim to preserve the purpose of the movement rather than its exact appearance."
            ]
        ],
        "questions": [
            [
                "What should guide exercise choice?",
                [
                    "What is most popular",
                    "Your goal, control and available equipment",
                    "The longest exercise list"
                ],
                1,
                "Choose exercises you can repeat and explain."
            ],
            [
                "The gym machine is busy. What helps?",
                [
                    "A suitable alternative for the same purpose",
                    "Skip every session",
                    "Double the load elsewhere"
                ],
                0,
                "An alternative makes the plan more usable."
            ]
        ],
        "practice": "Choose three exercises. For each, name the main muscles, explain why it belongs and give a suitable alternative."
    },
    {
        "title": "Set your training dose",
        "outcome": "Choose sets, reps, rest and a progression rule.",
        "lessons": [
            [
                "Make the session specific",
                "Use sets, repetitions, rest and effort to describe how you will perform each exercise. These details let you compare sessions."
            ],
            [
                "Match the dose to your week",
                "A plan needs to fit your available time and recovery. Start with work you can perform consistently, then review what your training log shows."
            ],
            [
                "Progress with a reason",
                "Choose a rule for adding repetitions or load when you can complete the planned work with controlled technique. A difficult week can be a reason to hold steady."
            ]
        ],
        "questions": [
            [
                "What makes sessions comparable?",
                [
                    "Changing every exercise",
                    "Recording sets, reps, load and effort",
                    "Only recording soreness"
                ],
                1,
                "A training log gives you something concrete to review."
            ],
            [
                "When is holding steady useful?",
                [
                    "Never",
                    "Whenever someone else lifts more",
                    "When control or recovery needs attention"
                ],
                2,
                "Progress includes repeating good work."
            ]
        ],
        "practice": "Write an example exercise prescription and your rule for increasing, holding or reducing the work."
    },
    {
        "title": "Fit cardio and recovery into your plan",
        "outcome": "Make room for conditioning, sleep and recovery.",
        "lessons": [
            [
                "Look at the whole week",
                "Consider conditioning, walking, other sport and work alongside strength sessions. A plan that ignores the rest of your week can be difficult to repeat."
            ],
            [
                "Give recovery a place",
                "Write where rest and easier days fit. Notice sleep, energy and how the next session feels. Use these observations alongside performance rather than relying on one signal alone."
            ],
            [
                "Use deeper science carefully",
                "Use your training log to review how conditioning and recovery fit the strength work. Detailed hormone and physiology topics remain available in the specialist library when you want more depth."
            ]
        ],
        "questions": [
            [
                "What belongs in a weekly plan?",
                [
                    "Only gym sessions",
                    "Training plus other demands and recovery",
                    "Only the hardest sessions"
                ],
                1,
                "Plan for the week you actually live."
            ],
            [
                "What is the role of hormone lessons?",
                [
                    "Diagnosing yourself",
                    "Choosing medication",
                    "Understanding background physiology"
                ],
                2,
                "Education does not replace an individual assessment."
            ]
        ],
        "practice": "Add conditioning or everyday movement and recovery to your week. Explain how you will recognise when to adjust the load."
    },
    {
        "title": "Check variety and essential nutrients",
        "outcome": "Review your food choices before building the full week.",
        "lessons": [
            [
                "Look across the day",
                "Use a variety of food groups and check your main protein and calcium-rich choices. Your existing agreed nutrition targets can guide your plan."
            ],
            [
                "Keep the detail useful",
                "The deeper lessons introduce micronutrients and a food-first approach. Detailed supplement lessons remain in the specialist library. Use food labels and reliable sources to check what a product supplies; a supplement is not a substitute for a workable food pattern."
            ],
            [
                "Write down what needs checking",
                "Record allergies, foods you avoid and questions to take to Shannon or a qualified nutrition professional. Use the previous meal-building lesson as your starting point."
            ]
        ],
        "questions": [
            [
                "Which review is useful?",
                [
                    "Checking variety and essential nutrients",
                    "Assuming one food supplies everything",
                    "Buying every supplement"
                ],
                0,
                "Look at the overall pattern."
            ],
            [
                "What should you do with an individual nutrition question you cannot resolve?",
                [
                    "Guess a dose",
                    "Ask for appropriate help",
                    "Ignore the question"
                ],
                1,
                "Write down what needs checking."
            ]
        ],
        "practice": "Review a normal day of food. Name the variety and nutrient sources you already have, one improvement and any question you need help with."
    }
];
    const STAGES = [LEGACY_STAGES[0], LEGACY_STAGES[1], EXTRA_STAGES[0], EXTRA_STAGES[1], LEGACY_STAGES[2], EXTRA_STAGES[2], LEGACY_STAGES[3], EXTRA_STAGES[3], LEGACY_STAGES[4], LEGACY_STAGES[5]];
    STAGES.forEach(stage => { stage.refs ||= []; });
    const OLD_WEEKS = [0,1,4,6,8,9];
    function migrate(data) {
        if (data.curriculumVersion === 2) return data;
        const next = { ...data, answers: {}, reflections: {}, completedStages: {}, curriculumVersion: 2 };
        for (const [key,value] of Object.entries(data.answers || {})) { const [old,q] = key.split('-'); if (OLD_WEEKS[old] !== undefined) next.answers[`${OLD_WEEKS[old]}-${q}`] = value; }
        for (const [key,value] of Object.entries(data.reflections || {})) if (OLD_WEEKS[key] !== undefined) next.reflections[OLD_WEEKS[key]] = value;
        for (const [key,value] of Object.entries(data.completedStages || {})) if (OLD_WEEKS[key] !== undefined) next.completedStages[OLD_WEEKS[key]] = value;
        return next;
    }
    let startedAt = null;
    let state = null, owner = null, context = null, stageIndex = 0, loadPromise = null, templates = [], busy = false, submissions = {}, submissionError = "";
    const LIFTS = [["squat", "Squat", "For example, a goblet squat"], ["hinge", "Hinge", "For example, a Romanian deadlift"], ["push", "Push", "For example, a push-up or chest press"], ["pull", "Pull", "For example, a row or pulldown"]];
    const blank = () => ({ answers: {}, reflections: {}, workout: {}, meal: {}, completedStages: {}, curriculumVersion: 2 });
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const uid = () => window.currentUser?.id || null;
    function current() { if (owner !== uid()) { owner = uid(); state = null; loadPromise = null; templates = []; startedAt = null; submissions = {}; submissionError = ""; } return state || blank(); }
    const filled = value => typeof value === 'string' && value.trim().length >= 3;
    function workoutValid(workout, available = templates) {
        if (!filled(workout.goal) || !filled(workout.constraints) || !filled(workout.progression) || !filled(workout.coverage)) return false;
        if (!Array.isArray(workout.days) || workout.days.length !== 7 || workout.days.some(id => typeof id !== 'string' || (id !== 'rest' && !available.some(t => t.id === id)))) return false;
        const ids = [...new Set(workout.days.filter(id => id !== 'rest'))];
        if (!ids.length) return false;
        return ids.every(id => {
            const exercises = available.find(t => t.id === id)?.template_data?.exercises;
            return Array.isArray(exercises) && exercises.length > 0 && exercises.every((_, i) => {
                const row = workout.prescriptions?.[id]?.[i];
                return row && row.exercise === exerciseName(exercises[i]) && Number.isInteger(Number(row.sets)) && Number(row.sets) >= 1 && Number(row.sets) <= 20 && String(row.reps || '').trim() && String(row.rest || '').trim() && filled(row.effort);
            });
        });
    }
    function mealValid(meal) {
        return filled(meal.needs) && filled(meal.shopping) && filled(meal.prep) && filled(meal.backup) && Array.isArray(meal.days) && meal.days.length === 7 && meal.days.every(day => ['breakfast', 'lunch', 'dinner'].every(key => filled(day?.[key])));
    }
    function stageReady(i, data = current()) {
        const s = STAGES[i];
        if (i === 1 && (submissionError || !LIFTS.every(([key]) => submissions[key]?.id))) return false;
        if (!s.questions.every((q, n) => data.answers?.[`${i}-${n}`] === q[2])) return false;
        return s.project === 'workout' ? workoutValid(data.workout || []) : s.project === 'meal' ? mealValid(data.meal || {}) : filled(data.reflections?.[i]);
    }
    function stageDone(i, data = current()) { return data.completedStages?.[i] === true && stageReady(i, data); }
    function progress() {
        const completed = STAGES.filter((_, i) => stageDone(i)).length;
        return { completed, total: 10, totalTopics: 10, percent: Math.round(completed / 10 * 100), isComplete: completed === 10 };
    }
    function event(name, extra = {}) { context?.track?.(`master_${name}`, { stage: stageIndex + 1, curriculum_version: 'balance_master_10_weeks_v2', form_check_requirement: 'master_compound_video_v1', ...extra }); }
    async function load(force = false) {
        current();
        if (!owner || !window.supabaseClient) throw new Error('Sign in to save your course projects.');
        if (loadPromise && !force) return loadPromise;
        const userId = owner;
        loadPromise = (async () => {
            const [project, workouts] = await Promise.all([
                window.supabaseClient.from('balance_master_projects').select('data').eq('user_id', userId).maybeSingle(),
                window.supabaseClient.from('workouts').select('id,template_name,template_data').eq('user_id', userId).eq('workout_type', 'custom_template').order('created_at', { ascending: false })
            ]);
            if (project.error || workouts.error) throw new Error('Could not load your saved work. Please retry.');
            if (uid() !== userId) throw new Error('Your account changed. Open the course again.');
            state = { ...blank(), ...migrate(project.data?.data || {}) }; templates = workouts.data || [];
            startedAt = await window.BalanceCourseWeeks.read('master');
            await loadSubmissions();
        })().catch(error => { loadPromise = null; throw error; });
        return loadPromise;
    }
    async function loadSubmissions() {
        const userId = uid();
        try {
            const session = await window.supabaseClient.auth.getSession();
            const token = session.data?.session?.access_token;
            if (!token) throw new Error('Sign in again to check your videos.');
            const response = await window.fetch('/.netlify/functions/master-form-check-status', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Could not check your videos.');
            if (uid() !== userId) return;
            submissions = result.submissions || {}; submissionError = '';
        } catch (error) { if (uid() === userId) { submissions = {}; submissionError = error.message; } }
    }
    function videoForm() {
        return '<h3>Film your compound lifts</h3><p>Send one working set of each movement below using a manageable load. Choose variations that suit you. Keep your whole body and the equipment in frame, from the side or a 45-degree angle, ideally under 60 seconds. If a movement is unsuitable or painful, contact Shannon for an alternative before filming.</p><p>Each clip goes privately to Shannon through Form Check. All four must be successfully sent before this stage can be completed. Sent means submitted for review, not technique approved. Read and apply your feedback in your coach conversation.</p>' +
            LIFTS.map(([key, title, example]) => '<fieldset><legend>' + title + '</legend><p>' + example + '</p><p>' + (submissions[key]?.id ? 'Sent for Shannon to review' : 'Video required') + '</p><button type="button" data-master-action="formcheck" data-lift="' + key + '">' + (submissions[key]?.id ? 'Send another ' : 'Film / upload ') + title.toLowerCase() + '</button></fieldset>').join('') +
            '<button type="button" data-master-action="videos">Check submitted videos</button><p>After the upload finishes, check your submissions here. Uploads still in progress or failed uploads do not count.</p>' + (submissionError ? '<p role="alert">' + esc(submissionError) + '</p>' : '');
    }
    async function save(data) {
        if (busy) return false;
        busy = true;
        const userId = uid();
        try {
            if (!userId || userId !== owner || !state) throw new Error('Open the course again before saving.');
            const result = await window.supabaseClient.from('balance_master_projects').upsert({ user_id: userId, data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }).select('data').single();
            if (result.error || !result.data) throw new Error('Your work was not saved. Please retry.');
            if (uid() !== userId) throw new Error('Your account changed. Open the course again.');
            state = result.data.data; event('project_saved', { complete: stageDone(stageIndex) });
            status('Saved to your account.');
            return true;
        } catch (error) { status(error.message, true); return false; }
        finally { busy = false; }
    }
    function status(message, error = false) {
        const el = document.getElementById('master-status');
        if (el) { el.textContent = message; el.setAttribute('role', error ? 'alert' : 'status'); el.classList.toggle('is-error', error); }
    }
    function field(label, name, value, hint = '', type = 'textarea') {
        return `<label class="master-field"><span>${esc(label)}</span>${hint ? `<small>${esc(hint)}</small>` : ''}${type === 'textarea' ? `<textarea name="${esc(name)}" rows="3" maxlength="3000">${esc(value)}</textarea>` : `<input name="${esc(name)}" type="${type}" ${type === 'number' ? 'min="1" max="20"' : ''} maxlength="160" value="${esc(value)}">`}</label>`;
    }
    function exerciseName(ex) { return typeof ex === 'string' ? ex : ex?.name || ex?.exercise || ex?.exercise_name || 'Exercise'; }
    function workoutForm(data) {
        const w = data.workout || {}, days = w.days || DAYS.map(() => 'rest');
        const selected = [...new Set(days.filter(id => id !== 'rest'))];
        return `<h3>Your workout program</h3><p>Build and save each workout with the existing exercise library, then return here and link it to your week. This course project keeps your plan separate from your current coached schedule.</p>
            <button type="button" data-master-action="builder">Open Build a Workout</button>
            <button type="button" data-master-action="refresh">Refresh saved workouts</button>
            ${!templates.length ? '<p>No saved workouts yet. Use Save in the builder, then return to Course → Balance Master.</p>' : ''}
            ${field('Training goal', 'goal', w.goal, 'What are you training for?')}
            ${field('Time, equipment and recovery', 'constraints', w.constraints, 'Available days, session length, equipment and how you will make room for recovery.')}
            <div class="master-days">${DAYS.map((day, i) => `<label class="master-field"><span>${day}</span><select name="day-${i}"><option value="rest">Rest / other activity</option>${templates.map(t => `<option value="${esc(t.id)}" ${days[i] === t.id ? 'selected' : ''}>${esc(t.template_name || 'Saved workout')}</option>`).join('')}</select></label>`).join('')}</div>
            <p>Choose your days, then update the exercise details below. A saved workout can appear on more than one day.</p><button type="button" data-master-action="schedule">Update exercise details</button>
            ${selected.map(id => {
                const t = templates.find(t => t.id === id);
                if (!t) return '<p>A linked workout is no longer available. Choose a saved workout again.</p>';
                return `<fieldset><legend>${esc(t.template_name)}</legend>${(t.template_data?.exercises || []).map((ex, i) => {
                    const p = w.prescriptions?.[id]?.[i] || {};
                    return `<div class="master-prescription"><h4>${esc(exerciseName(ex))}</h4><div class="master-pair">${field('Working sets', `${id}:${i}:sets`, p.sets, '', 'number')}${field('Rep range', `${id}:${i}:reps`, p.reps, 'For example: 8-12', 'text')}${field('Rest', `${id}:${i}:rest`, p.rest, 'For example: 2 minutes', 'text')}${field('Effort', `${id}:${i}:effort`, p.effort, 'For example: 2 reps left', 'text')}</div></div>`;
                }).join('')}</fieldset>`;
            }).join('')}
            ${field('Check your coverage', 'coverage', w.coverage, 'Explain how your week covers the major muscle groups and where you recover.')}
            ${field('Your progression rule', 'progression', w.progression, 'When will you add reps or load, and when will you hold steady or reduce the work?')}`;
    }
    function mealForm(data) {
        const m = data.meal || {};
        return `<h3>Your seven-day meal plan</h3><p>Write your own choices and portions. Repeated meals are welcome. This is a planning worksheet, so nutrition totals are not calculated from these entries.</p>
            ${field('Preferences, budget and dietary needs', 'needs', m.needs, 'Include allergies or foods to avoid, time to cook and who you are cooking for. Write none where appropriate.')}
            ${DAYS.map((day, i) => `<details class="master-meal-day" ${i === 0 ? 'open' : ''}><summary>${day}</summary>${i ? `<button type="button" data-master-action="copy" data-day="${i}">Copy ${DAYS[i - 1]}</button>` : ''}${['breakfast', 'lunch', 'dinner', 'snacks'].map(key => field(key.charAt(0).toUpperCase() + key.slice(1) + (key === 'snacks' ? ' (optional)' : ''), `${i}:${key}`, m.days?.[i]?.[key], key === 'breakfast' ? 'Include main ingredients and amounts. If your meal rhythm differs, describe it.' : '')).join('')}</details>`).join('')}
            ${field('Shopping list with quantities', 'shopping', m.shopping, 'Combine ingredients across the week and check what you already have.')}
            ${field('Shopping and prep plan', 'prep', m.prep, 'When will you shop and cook? Which meals use leftovers?')}
            ${field('Your busy-day backup', 'backup', m.backup, 'One realistic quick meal or eating-out option.')}`;
    }
    function collect() {
        const form = document.getElementById('master-form');
        const values = Object.fromEntries(new FormData(form));
        const data = JSON.parse(JSON.stringify(current()));
        STAGES[stageIndex].questions.forEach((_, n) => { const v = values[`quiz-${n}`]; if (v !== undefined) data.answers[`${stageIndex}-${n}`] = Number(v); });
        const project = STAGES[stageIndex].project;
        if (project === 'workout') {
            const w = data.workout || {};
            ['goal', 'constraints', 'coverage', 'progression'].forEach(key => w[key] = values[key] || '');
            w.days = DAYS.map((_, i) => values[`day-${i}`] || 'rest'); w.prescriptions ||= {};
            Object.entries(values).filter(([key]) => key.includes(':')).forEach(([key, value]) => { const [id, index, field] = key.split(':'); w.prescriptions[id] ||= {}; w.prescriptions[id][index] ||= {}; w.prescriptions[id][index][field] = value; w.prescriptions[id][index].exercise = exerciseName(templates.find(t => t.id === id)?.template_data?.exercises?.[index]); });
            data.workout = w;
        } else if (project === 'meal') {
            const m = data.meal || {};
            ['needs', 'shopping', 'prep', 'backup'].forEach(key => m[key] = values[key] || '');
            m.days = DAYS.map((_, i) => Object.fromEntries(['breakfast', 'lunch', 'dinner', 'snacks'].map(key => [key, values[`${i}:${key}`] || ''])));
            data.meal = m;
        } else data.reflections[stageIndex] = values.reflection || '';
        return data;
    }
    function unlocked(i) { return i < window.BalanceCourseWeeks.available(startedAt, 10) || stageDone(i); }
    function render(data = current()) {
        const host = document.getElementById('learning-content'); if (!host) return;
        if (!startedAt) {
            host.innerHTML = '<div class="master-course"><header><h2>Balance Master: ten weeks</h2><p>Build your workout program, submit your compound lifts and design one week of meals. One week opens every seven days from the day you start. Your saved work stays with you.</p></header><section>' + STAGES.map((s,i)=>'<h3>Week '+(i+1)+': '+esc(s.title)+'</h3><p>'+esc(s.outcome)+'</p>').join('') + '<button id="master-start">Start my ten weeks</button><button id="master-library">View all courses</button><p id="master-status" role="status"></p></section></div>';
            host.querySelector('#master-start').onclick = async () => { if (busy) return; busy=true; try { startedAt=await window.BalanceCourseWeeks.start('master'); stageIndex=0; event('course_started'); render(); } catch(e){status(e.message,true);} finally{busy=false;} };
            host.querySelector('#master-library').onclick = () => context?.library?.(); return;
        }
        if (!unlocked(stageIndex)) stageIndex=0;
        const s = STAGES[stageIndex], p = progress();
        host.innerHTML = `<div id="balance-master" class="master-course">
            <header><span class="master-kicker">Balance Master · Week ${stageIndex + 1} of 10</span><h2>Build your workout program.<br>Plan your week of food.</h2><p>Ten weeks, with one week opening every seven days. Leave with two saved projects, submitted form checks and a clear reason for your choices.</p><p>${p.completed} of 10 weeks complete</p><progress max="10" value="${p.completed}" aria-label="Course progress"></progress></header>
            <nav aria-label="Master weeks">${STAGES.map((s, i) => `<button type="button" data-master-action="stage" data-stage="${i}" ${!unlocked(i) ? 'disabled' : ''} ${i === stageIndex ? 'aria-current="step"' : ''}>${stageDone(i) ? '✓' : i + 1}. ${esc(s.title)}${!unlocked(i) ? ' · Opens ' + window.BalanceCourseWeeks.date(startedAt, i) : ''}</button>`).join('')}</nav>
            <section><h2>${esc(s.title)}</h2><p class="master-outcome">${esc(s.outcome)}</p>
            ${s.lessons.map(([title, body]) => `<article class="master-lesson"><h3>${esc(title)}</h3><p>${esc(body)}</p></article>`).join('')}
            ${context?.deeper?.(stageIndex + 1) || ''}
            <form id="master-form"><h3>Check your understanding</h3>${s.questions.map((q, n) => `<fieldset><legend>${esc(q[0])}</legend>${q[1].map((answer, a) => `<label class="master-answer"><input type="radio" name="quiz-${n}" value="${a}" ${data.answers?.[`${stageIndex}-${n}`] === a ? 'checked' : ''}><span>${esc(answer)}</span></label>`).join('')}<p id="master-feedback-${n}" class="master-feedback" role="status"></p></fieldset>`).join('')}
            ${s.project === 'workout' ? workoutForm(data) : s.project === 'meal' ? mealForm(data) : field(s.practice, 'reflection', data.reflections?.[stageIndex])}
            ${stageIndex === 1 ? videoForm() : ''}
            <div class="master-actions"><button type="button" data-master-action="save">Save draft</button><button type="submit" class="master-primary">Check and complete week</button></div><p id="master-status" role="status"></p></form>
            ${p.isComplete ? '<div class="master-complete"><h3>Master complete</h3><p>You have built a workout program, planned seven days of food and explained how you will adjust. Your projects stay here to review and edit.</p></div>' : ''}
            <button type="button" data-master-action="library">View all courses</button>
            <details class="master-sources"><summary>Learning sources</summary><p>This course brings together How Your Body Moves, Train With Purpose and Fuel for Results.</p><a href="https://acsm.org/resistance-training-guidelines-update-2026/" target="_blank" rel="noopener">ACSM: resistance training guidance</a><a href="https://www.eatforhealth.gov.au/eating-well/tips-eating-well/meal-planning" target="_blank" rel="noopener">Eat for Health: meal planning</a><a href="https://www.eatforhealth.gov.au/food-essentials/five-food-groups" target="_blank" rel="noopener">Eat for Health: food groups</a></details></section></div>`;
        host.querySelector('#master-form').addEventListener('submit', async e => {
            e.preventDefault();
            if (busy || !unlocked(stageIndex)) return;
            const submittedStage = stageIndex, submittedOwner = owner, submittedForm = e.currentTarget;
            const draft = collect();
            const previouslyComplete = stageDone(stageIndex);
            const coursePreviouslyComplete = progress().isComplete;
            const correct = s.questions.every((q, n) => draft.answers[`${stageIndex}-${n}`] === q[2]);
            s.questions.forEach((q, n) => { document.getElementById(`master-feedback-${n}`).textContent = `${draft.answers[`${stageIndex}-${n}`] === q[2] ? 'Correct. ' : 'Try again. '}${q[3]}`; });
            if (!correct) { status('Review the explanations and try the knowledge check again. Your form is still here.', true); return; }
            if (stageIndex === 1) await loadSubmissions();
            if (stageIndex !== submittedStage || uid() !== submittedOwner || document.getElementById('master-form') !== submittedForm) return;
            if (!stageReady(stageIndex, draft)) { status(stageIndex === 1 ? 'Add your practical answer and successfully send all four videos. Use Check submitted videos to see what is still needed.' : s.project === 'workout' ? 'Finish your goal, schedule, exercise details, coverage and progression rule. Link at least one saved workout and update its exercise details.' : s.project === 'meal' ? 'Finish all seven days plus dietary needs, shopping, prep and your backup meal.' : 'Add your practical answer before completing this stage.', true); return; }
            draft.completedStages ||= {};
            draft.completedStages[stageIndex] = true;
            if (await save(draft)) { if (!previouslyComplete) event('stage_completed'); if (!coursePreviouslyComplete && progress().isComplete) event('course_completed'); render(); status('Week complete. Continue with an available week, or review your work.'); }
        });
        host.querySelectorAll('[data-master-action]').forEach(button => button.addEventListener('click', () => action(button)));
    }
    async function action(button) {
        if (busy) return;
        const type = button.dataset.masterAction;
        if (type === 'save') { await save(collect()); return; }
        if (type === 'schedule') { const data = collect(); if (await save(data)) { render(); status('Schedule saved. Add sets, reps, rest and effort for each exercise.'); } return; }
        if (type === 'copy') {
            const day = Number(button.dataset.day); const form = document.getElementById('master-form');
            ['breakfast', 'lunch', 'dinner', 'snacks'].forEach(key => { form.elements[`${day}:${key}`].value = form.elements[`${day - 1}:${key}`].value; });
            status(`${DAYS[day - 1]} copied into ${DAYS[day]}. Edit as needed, then save.`); return;
        }
        // Preserve the draft before navigating away, including when opening the existing builder.
        if (!(await save(collect()))) return;
        if (type === 'videos') { await loadSubmissions(); render(); status(submissionError || 'Video submissions checked.', !!submissionError); }
        if (type === 'formcheck') {
            const lift = LIFTS.find(([key]) => key === button.dataset.lift);
            if (!lift) return;
            if (typeof window.openFormCheck !== 'function') { status('Form Check is still loading. Please retry.', true); return; }
            window.openFormCheck({ source: 'master', workoutName: 'Balance Master: ' + lift[0] });
            event('form_check_opened', { movement: lift[0] });
        }
        if (type === 'stage') { if (!unlocked(Number(button.dataset.stage))) return; stageIndex = Number(button.dataset.stage); render(); document.getElementById('balance-master')?.scrollIntoView({ block: 'start' }); event('stage_opened'); }
        if (type === 'library') context?.library?.();
        if (type === 'lesson') { event('existing_lesson_opened', { lesson_id: button.dataset.lesson }); context?.lesson?.(button.dataset.lesson); }
        if (type === 'refresh') { try { await load(true); render(); status('Saved workouts refreshed.'); } catch (e) { status(e.message, true); } }
        if (type === 'builder') { try { if (typeof window.openWorkoutBuilderSafe !== 'function') throw new Error('The workout builder is still loading. Please retry.'); await window.openWorkoutBuilderSafe(); event('workout_builder_opened'); } catch (e) { status(e.message, true); } }
    }
    async function open(options) {
        context = options; current();
        const host = document.getElementById('learning-content');
        if (!host) return;
        if (!options.unlocked) {
            host.innerHTML = `<div class="master-course"><header><span class="master-kicker">Balance Master</span><h2>Build your workout program and one week of meals</h2><p>Complete Balance Learn to begin. You can preview all ten weeks here.</p></header><section>${STAGES.map((s, i) => `<h3>${i + 1}. ${esc(s.title)}</h3><p>${esc(s.outcome)}</p>`).join('')}<button type="button" id="master-library">View all courses</button></section></div>`;
            host.querySelector('#master-library').onclick = options.library; return;
        }
        host.innerHTML = '<div class="master-course"><section><p>Loading your saved course projects...</p></section></div>';
        try { await load(true); if (context !== options) return; render(); event('opened'); }
        catch (e) { host.innerHTML = `<div class="master-course"><section><p role="alert">${esc(e.message)}</p><button id="master-retry">Retry</button><button id="master-library">View all courses</button></section></div>`; host.querySelector('#master-retry').onclick = () => open(options); host.querySelector('#master-library').onclick = options.library; }
    }
    async function leave(callback) {
        if (document.getElementById('master-form') && !(await save(collect()))) return;
        context = null;
        callback?.();
    }
    window.BalanceMaster = { open, progress, load, leave, cancel: () => { context = null; }, stages: STAGES, workoutValid, mealValid, stageDone, migrate, unlocked };
})();
