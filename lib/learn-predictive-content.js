/* Approved social-learning exception only. All other lessons retain their original
 * definitions in learning-inline.js. See docs/learn-original-restoration-2026-09-16.md.
 */
(function(root) {
  'use strict';
  const rows = [
    ['mind-6-5','People Are Your Strongest Environment',
      `The people around you are part of what your brain learns from.\n\nKarl Friston's free-energy principle is a theoretical framework connecting perception, learning and action. It proposes that living systems minimise a mathematical quantity called variational free energy, which bounds the surprise of sensory input. Here, surprise means how improbable an input is under a model, not the feeling of being startled. This is a scientific framework, not a proven explanation of every behaviour.\n\nIn the predictive-brain account, learned expectations work with current signals from your body and environment to infer what is happening and anticipate what comes next. If evidence does not fit, the brain can revise its interpretation or, through learning, its model. Actions also change the signals it receives. The reliability of evidence and the context affect the update; repetition alone does not guarantee change. Source: Friston, The free-energy principle: a unified brain theory? (2010), doi:10.1038/nrn2787.\n\nOther people are part of that environment. What they eat, how they move, what they make time for and how they respond to you become experiences you can learn from. Regularly joining a walk, asking about a workout or seeing ordinary meals can help make an unfamiliar routine feel more normal and achievable. This is our practical application of the framework, not a mechanism proven by the social research or a guarantee that fitness transfers between people.\n\nOne long-term observational study found a 57% relative increase in a person's likelihood of becoming obese when a friend became obese during an interval. This is an association, not 57 percentage points or a guaranteed individual outcome. It does not establish that updating brain predictions caused the association. Source: Christakis and Fowler, The Spread of Obesity in a Large Social Network over 32 Years (2007), doi:10.1056/NEJMsa066082.\n\nPeople can be a powerful part of your environment; the lesson title is not a measured ranking that applies to everyone. You do not automatically become fitter by being near active people. Participating supplies new experiences, and learning from those experiences can gradually change expectations and choices. A coach can help you plan, interpret what happened and adjust what you try next.\n\nFor this week's action, take part in the Balance Feed. Across the week, share three posts about a meal, workout or walk. Leave a meaningful comment on three other people's posts. Ask about their experience, share something relevant or offer support. A PB share can be one of your three posts; a PB is not required. In your weekly check-in, describe what you shared, your interactions and whether participating changed your motivation or what you actually did. If nothing changed, record that too. Three posts and three comments are a manageable experiment, not a scientifically established dose for changing the brain.`,
      'Other people are part of what you learn from: change what you experience together, then notice what changes for you.',
      'What does the 57% finding mean?',['Every person has a 57% chance of becoming obese','The study found a relative increase associated with a friend becoming obese','The study proved a brain mechanism that makes friends alike'],1,
      'The finding is a relative association in that study, not a guaranteed individual outcome or proof of a brain mechanism.',
      'Spending time with active people guarantees that you will automatically become fitter.',false],
  ];
  const practice = {
    'mind-6-5': [
      ['What does surprise mean in this framework?', ['Feeling startled by another person','How improbable a sensory input is under a model','The number of new people you meet'],1,'Surprise is an information-theory concept here, not simply an emotion. Free energy bounds that quantity.'],
      ['How do predictions and feedback work together in this account?', ['The brain copies everyone nearby without using body signals','A model never changes after childhood','Learned expectations combine with current signals; evidence and action can change what is expected or experienced'],2,'The model uses bodily and environmental signals. Evidence can inform learning, and actions change the inputs available.'],
      ['Through a predictive-brain lens, why do other people matter?', ['They choose all your future behaviour','Their everyday actions are part of the experience you learn from','Their fitness transfers directly to you'],1,'What people do can help shape your expectations about what is normal and possible.'],
      ['Which action puts this lesson into practice?', ['Share three meal, workout or walk posts and comment on three other posts','Wait for their habits to transfer without taking part','Publish their identity in your check-in'],0,'Participating in the Feed gives you a specific social experience to reflect on in your check-in.'],
      ['Which check-in best captures the experiment?', ['My friend guarantees I will keep training','I must say it helped even if nothing changed','I shared three posts, commented on three others and noticed no change in motivation'],2,'Record what you shared, how the interactions felt and what changed or stayed the same. A neutral outcome counts too.']
    ],
  };
  function apply(lessons, types, facts) {
    for (const [id,title,intro,keyPoint,question,options,correctIndex,explanation,claim,answer] of rows) {
      const item = Object.values(lessons).flat().find(l=>l.id===id);
      if (!item) throw new Error('Missing predictive lesson: '+id);
      item.title=title;
      item.content={...item.content,intro,keyPoint,image:item.content.image ? {...item.content.image,label:title} : null};
      item.games=[
        {type:types.SCENARIO_STORY,scenario:'Use the lesson to reason through the example.',question,options,correctIndex,explanation},
        {type:types.SWIPE_TRUE_FALSE,question:claim,answer,explanation:keyPoint},
        {type:types.SCENARIO_STORY,scenario:'You are reviewing what this lesson means for your next gym visit.',question:'Which statement best captures this lesson?',options:[keyPoint,'A first impression is always an accurate fact.','Every unexpected outcome guarantees an immediate permanent change.'],correctIndex:0,explanation:keyPoint}
      ];
      if(facts) facts[id]=keyPoint;
    }
    for (const [id, questions] of Object.entries(practice)) {
      const lesson=Object.values(lessons).flat().find(l=>l.id===id);
      if (!lesson) throw new Error('Missing quiz practice lesson: '+id);
      lesson.games.push(...questions.map(([question,options,correctIndex,explanation])=>({
        type:types.SCENARIO_STORY,scenario:'Apply what you learned.',question,options,correctIndex,explanation
      })));
    }
  }
  root.BalancePredictiveContent={apply,titles:Object.fromEntries(rows.map(row=>[row[0],row[1]]))};
})(typeof window!=='undefined'?window:globalThis);
