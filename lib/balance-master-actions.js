/* Shared member and coach checklist. Completion is verified and recorded by the server. */
(function () {
    'use strict';
    const weeks = [
        [
            ['muscles', 'Identify the muscles in your workouts', 'List your current exercises and the main muscles each one trains.'],
            ['movements', 'Match each muscle to its movement', 'For the muscles you identified, explain the joint movement or stabilising job they perform.'],
            ['examples', 'Give an exercise example for each muscle', 'Pair each muscle with an exercise and explain how that exercise trains it.']
        ],
        [
            ['squat', 'Record your squat', 'Send one controlled working set for Shannon to review.', 'video'],
            ['hinge', 'Record your hinge', 'Send one controlled working set for Shannon to review.', 'video'],
            ['push', 'Record your push', 'Send one controlled working set for Shannon to review.', 'video'],
            ['pull', 'Record your pull', 'Send one controlled working set for Shannon to review.', 'video']
        ],
        [
            ['selection', 'Choose exercises for your major muscle groups', 'Write an exercise list covering your legs, hips, chest, back, shoulders, arms and trunk.'],
            ['reasons', 'Explain your exercise choices', 'Explain how those exercises suit your goal, experience, equipment and available time.'],
            ['alternatives', 'Choose suitable alternatives', 'Give alternatives for your exercises if equipment is unavailable or a movement does not suit your ability. Explain the substitutions.']
        ],
        [
            ['sets-reps', 'Set the working sets and rep ranges', 'Write a sample workout with an exercise, working sets and rep range for every entry.'],
            ['rest-effort', 'Choose rest periods and effort targets', 'Give each exercise a rest period and effort target, such as how many good repetitions you could still do.'],
            ['adjustments', 'Explain when to adjust the work', 'Describe when you would increase, maintain or reduce the load or volume, using performance and recovery.']
        ],
        [
            ['split', 'Choose and explain your muscle split', 'Save your split, why it fits, training goal and available time.', 'workout'],
            ['workouts', 'Build each workout in Balance', 'Build and link your workouts, then give every exercise sets, reps, rest and effort.', 'workout'],
            ['schedule', 'Plan your seven training and recovery days', 'Place your saved workouts and rest days across the week and explain muscle coverage.', 'workout'],
            ['day-reasons', 'Explain every day of your plan', 'Explain each training day’s exercise choices and order, each recovery day, and your progression rule.', 'workout']
        ],
        [
            ['cardio', 'Plan cardio and everyday movement', 'Add realistic cardio and everyday movement to specific days in your week. Explain how it fits your training.'],
            ['recovery', 'Plan recovery days and a sleep routine', 'Identify your recovery days and describe a sleep routine you can follow.'],
            ['poor-recovery', 'Explain what you will change if recovery is poor', 'Describe the signs you will watch and how you would adjust training, activity or your routine.']
        ],
        [
            ['breakfast', 'Build your breakfast', 'List ingredients and practical portions. Explain why these foods and amounts fit your needs.'],
            ['lunch', 'Build your lunch', 'List ingredients and practical portions. Explain your protein, carbohydrate, vegetables or fruit, and fat choices.'],
            ['dinner', 'Build your dinner', 'List ingredients and practical portions. Explain how this meal supports your day and fits with your other meals.']
        ],
        [
            ['usual-foods', 'Review the foods you usually eat', 'Describe a normal day or week of food, including the variety and nutrient sources you already have.'],
            ['gaps', 'Identify gaps in variety or nutrient sources', 'Identify what is missing or limited and any questions you need help with. If coverage is good, explain why.'],
            ['improvements', 'Make and explain practical improvements', 'Write specific food changes you can make and explain how they address the gaps you identified.']
        ],
        [
            ['meals', 'Build seven days of meals', 'Save breakfast, lunch and dinner for all seven days, with portions and your dietary needs.', 'meal'],
            ['shopping', 'Create a combined shopping list', 'Combine ingredients and quantities across your week and check your pantry.', 'meal'],
            ['prep', 'Plan your food preparation', 'Record when you will shop, prepare meals and use leftovers.', 'meal'],
            ['backup', 'Choose a busy-day backup', 'Save a realistic quick meal or eating-out option.', 'meal']
        ],
        [
            ['workout-review', 'Review your workout program', 'Review how your schedule, exercises, training dose and recovery fit your needs. Use your saved week as evidence.'],
            ['meal-review', 'Review your meal plan', 'Review portions, variety, enjoyment, cost and preparation. Explain what worked or needs adjusting.'],
            ['next-steps', 'Decide what to keep, change and monitor', 'Explain what you will keep, what you will change and why, and what evidence you will monitor next.']
        ]
    ].map(rows => rows.map(([key, title, hint, kind = 'written']) => ({ key, title, hint, kind })));
    const receipt = (data, week, key) => data?.actionReceipts?.[`${week}:${key}`];
    const progress = (data, week) => {
        const rows = weeks[week - 1] || [];
        const completed = rows.filter(row => receipt(data, week, row.key)?.isCurrent === true).length;
        return { completed, total: rows.length, complete: rows.length > 0 && completed === rows.length };
    };
    window.BalanceMasterActions = { weeks, receipt, progress };
})();
