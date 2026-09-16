/* Approved social-learning exception only. All other lessons retain their original
 * definitions in learning-inline.js. See docs/learn-original-restoration-2026-09-16.md.
 */
(function(root) {
  'use strict';
  const rows = [
    ['mind-6-5','People Are Your Strongest Environment',
      `The people around you are part of what your brain learns from.\n\nOne long-term study found that when someone's friend became obese, their own likelihood of becoming obese increased by 57%. That was a relative increase in an observational study, not 57 percentage points or a prediction for every friendship. The study did not establish that changes in brain predictions caused the association. Source: Christakis and Fowler, The Spread of Obesity in a Large Social Network over 32 Years (2007), doi:10.1056/NEJMsa066082.\n\nThat doesn't mean you automatically become like your friends. But it shows why our social environment deserves attention.\n\nThrough a predictive-brain lens, the idea is this: your brain learns what to expect from repeated experience. And other people are part of that experience. What they eat. How they move. What they make time for. Those experiences can shape what feels normal, and what you see as possible for yourself.\n\nSo if you're trying to build an exercise routine, give yourself opportunities to spend time with people who make being active part of everyday life. Join their walk. Arrange a workout together. Ask them to show you where to start. You're giving yourself something new to learn from.\n\nFor this week's action, take part in the Balance Feed. Across the week, share three posts about a meal, workout or walk. Leave a meaningful comment on three other people's posts. A PB share can be one of your three posts; a PB is not required. In your weekly check-in, describe what you shared, your interactions and whether participating changed your motivation or what you actually did. If nothing changed, record that too.`,
      'Other people are part of what you learn from: change what you experience together, then notice what changes for you.',
      'What does the 57% finding mean?',['Every person has a 57% chance of becoming obese','The study found a relative increase associated with a friend becoming obese','The study proved a brain mechanism that makes friends alike'],1,
      'The finding is a relative association in that study, not a guaranteed individual outcome or proof of a brain mechanism.',
      'Spending time with active people guarantees that you will automatically become fitter.',false],
  ];
  const practice = {
    'mind-6-5': [
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
