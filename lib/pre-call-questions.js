(function (root) {
    const text = (id, label, hint = '') => ({ id, label, hint, type: 'text' });
    const choice = (id, label, options, multi = false) => ({ id, label, options, type: multi ? 'multi' : 'choice' });
    const support = ['An organised workout plan', 'Food guidance', 'Accountability', 'Regular feedback', 'Live training', 'Not sure yet'];
    const general = [
        text('reason', 'What prompted you to book this call?'),
        text('goal', 'What would you most like to change about your fitness, food, or routine?'),
        text('future', 'If the next three months went well, what would be different in your everyday life?'),
        text('past', 'What have you tried before, and what worked—even for a little while?'),
        text('early_influences', 'Growing up, who—if anyone—influenced how you looked after your health and fitness?', 'What did you pick up from them? Brief answers are fine.'),
        text('easier_environment', 'Think of a time when looking after yourself felt easier. What was different around you then?', 'Who were you spending time with, and what did your days look like?'),
        text('current_support', 'Who supports your health or fitness goals now, and what does that support look like?', 'This could be encouragement, doing things together or practical help.'),
        text('environment', 'In your usual week, what makes being active and eating the way you want feel easier? What makes it harder?', 'Think about home, work, the people around you and the places you spend time.'),
        text('blocker', 'What tends to get in the way when you try to stay consistent?'),
        text('week', 'What does a typical week look like, and where could training realistically fit?'),
        text('food', 'What does a typical day of eating look like for you?', 'Mention any food preferences, allergies or intolerances you’d like me to know about. No calorie tracking needed.'),
        text('movement', 'What exercise are you doing now, and how do you feel afterwards?'),
        choice('support', 'What kind of help would be most useful?', support, true),
        text('health', 'Anything about your health, injuries, current treatment, or advice from your clinician that you’d like me to consider?', 'Optional. You can discuss this privately on the call instead.'),
        text('call', 'What would make our call useful to you?')
    ];
    const menopause = [
        choice('goal', 'What would you most like help with right now?', ['Managing weight changes', 'Getting stronger', 'Finding a food routine', 'Improving energy', 'Staying consistent with exercise', 'Feeling more comfortable and confident', 'Something else'], true),
        choice('stage', 'Which best describes where you’re at?', ['I think I may be in perimenopause', 'I’ve been told I’m in perimenopause', 'I’m going through menopause or am postmenopausal', 'Menopause following surgery or medical treatment', 'I’m not sure', 'Prefer to discuss on the call']),
        choice('hrt', 'Are you currently using hormone replacement therapy (HRT)?', ['Yes', 'No', 'I’m not sure', 'Prefer to discuss on the call']),
        text('hrt_medication', 'If you’re using HRT, what medication or product do you use?', 'The name and how you take it—for example, a patch, gel or tablet—are helpful if you know them. Include more than one product if relevant. You can leave this blank or discuss it on the call.'),
        text('changes', 'What changes have you noticed, and roughly when did they start?', 'For example: weight, waist measurement, strength, appetite, sleep, or how you feel.'),
        choice('experiences', 'Which experiences are affecting your everyday life?', ['Hot flushes or night sweats', 'Difficulty sleeping', 'Low energy or fatigue', 'Difficulty concentrating or brain fog', 'Mood changes or stress', 'Joint discomfort', 'Bloating or digestive discomfort', 'Appetite changes or cravings', 'Weight or body-shape changes', 'None of these', 'Something else'], true),
        text('priorities', 'Of those experiences, which one or two affect you most?', 'You can describe anything not listed above here too.'),
        text('weight', 'If weight loss is a goal, what feels different or more difficult now?'),
        choice('sleep', 'How has your sleep been lately?', ['Mostly restful', 'Difficulty falling asleep', 'Waking during the night', 'Waking earlier than I’d like', 'Enough hours but still tired', 'It varies'], true),
        text('energy', 'What are your energy levels like across a typical day?'),
        text('food', 'What does a typical day of eating look like for you?', 'Meals, snacks and drinks if useful. No calorie tracking needed.'),
        text('nutrition_symptoms', 'Have you ever changed what you eat or drink to try to manage menopause-related symptoms? If so, what did you try, and what did you notice?', 'It’s fine if you haven’t tried this or aren’t sure whether it made a difference. Brief answers are fine.'),
        choice('food_support', 'What would make food easier to manage?', ['Knowing what to eat', 'Getting enough protein', 'Quick meals', 'Meals that suit the household', 'Managing hunger or cravings', 'Working around digestive discomfort', 'Affordable options', 'More plant-based options', 'Something else'], true),
        text('preferences', 'Any food preferences, allergies or intolerances you’d like me to know about?'),
        text('movement', 'What exercise are you doing, and how do you feel afterwards?', 'What do you enjoy? Is anything uncomfortable or difficult to recover from?'),
        text('past', 'What have you already tried, and what helped—or made things harder?'),
        text('health', 'Anything about your health, current treatment, injuries, or advice from your clinician that you’d like me to consider?', 'Optional. Share only what you’re comfortable sharing, or discuss this privately on the call.'),
        text('call', 'What would make our call useful to you?')
    ];
    const forms = {
        general: { title: 'Let’s make our chat useful.', subtitle: 'A few questions before your Balance call', intro: 'Tell me a little about your goals, your routine, and what’s been getting in the way. I’ll use your answers to prepare for our conversation.', questions: general },
        menopause: { title: 'Let’s understand what’s changed.', subtitle: 'Your menopause & fitness pre-call form', intro: 'If menopause-related changes have made your usual food and fitness routine harder to manage, this is a space to tell me what you’ve noticed. I’ll use your answers to prepare for our conversation.', questions: menopause }
    };
    if (typeof module !== 'undefined') module.exports = forms;
    else root.BalancePreCallForms = forms;
})(typeof window !== 'undefined' ? window : globalThis);
